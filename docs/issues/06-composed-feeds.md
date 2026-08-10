---
id: "06"
title: Composed feeds
description: >-
  Manage feeds that aggregate items from multiple sources and subfeeds, and
  merge + de-duplicate their already-cached items into one chronological
  stream.
status: done
dependencies: ["03", "05"]
affects: [app, server, tests]
---

# 06 — Composed feeds

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Make the `feeds` / `feed_sources` tables from issue 01 a usable feature: a
**feed** is a user-defined "read these together" group of sources (optionally
narrowed to one of their subfeeds), and this issue adds CRUD for feeds, add/
remove for their membership, an aggregate refresh across members, and a merge
engine that turns a feed's members into one de-duplicated, chronologically
ordered stream of already-cached items. Filtering, automatic sorting options,
full-text search and search-until-found pagination over that stream are issue
07's shared content-view layer — this issue only has to produce the base
stream for that layer to build on.

**Depends on:** 03 (source management), 05 (subfeeds) — **both are done**.
This issue consumes the `feed_sources.subfeedId` seam issue 05 left in place
(see its "Out of scope").

**The merge has a known limitation, inherited from issue 05 by design.**
Cached items carry only `sourceId` — issue 05 deliberately did not persist
which subfeed an item arrived through, deferring an `item_subfeeds` join to
issue 07 "if it needs cached filtering". That means a feed member narrowed to
a specific subfeed cannot, today, be resolved to *that subfeed's* cached items
specifically — only to its parent source's. The merge engine therefore
operates at the **source** level: it collapses a feed's members to the
distinct set of `sourceId`s they reference (a whole-source membership and a
subfeed-of-that-source membership collapse to the same one) and reads each
source's cached items once. The `subfeedId` on a membership row is still
meaningful — it records *which* subfeed the user asked to include, it drives
the refresh (task 3) through the correct merged query params, and it is shown
in the UI — it just doesn't yet narrow which cached items surface. Note this
plainly in the UI rather than papering over it.

## Tasks

### 1. Validation

`shared/schemas/feed.ts`, following `shared/schemas/subfeed.ts`:

- `feedCreateSchema` — `name: z.string().trim().min(1)`.
- `feedUpdateSchema` = the `.partial()` variant.
- `feedMemberSchema` — `{ sourceId: z.number().int().positive(), subfeedId: z.number().int().positive().nullable().optional() }` for add-member payloads. `feedId` comes from the route path, never the body.

### 2. Repository additions

`server/db/repositories/feeds.ts` already has feed CRUD and
`feedMembers`/`addFeedSource`/`removeFeedSource`/`clearFeedSources`. Add:

- `getFeedMember(id)` — a single `feed_sources` row, for 404s before delete.
- `memberCountsForFeeds(feedIds)` — batched `Map<number, number>` helper for
  the feed-list badge, following the `subfeedCountsForSources` /
  `tagsForSources` pattern (`server/db/repositories/subfeeds.ts:67`,
  `server/db/repositories/tags.ts:74`).

No new hydration helper for a single feed's members: a feed has few members,
so the detail route (task 4) composes `feedMembers` with the existing
`getSource`/`getSubfeed` per row rather than adding a join — the batched
helpers stay reserved for list-page fan-out over many rows, matching how
`listSourcesWithTags` uses them versus `getSourceWithTags`'s single-row calls
(`server/db/repositories/sources.ts`).

### 3. Engine — merging cached items across members

Add `server/feed/compose.ts`:

- `feedItems(feedId, database): Item[]` — loads `feedMembers(feedId)`,
  collapses their `sourceId`s to a `Set` (per the limitation above), calls
  `itemsForSource` once per distinct id, concatenates, and sorts by
  `publishedAt` descending (items without a `publishedAt` sort last). No
  per-item de-dup pass is needed beyond the source-id collapse: `items` already
  enforces one row per `(sourceId, guid)`
  (`items_source_guid_unique`, `server/db/schema.ts:127`), and collapsing to
  distinct source ids means each source's rows are read exactly once.
- Throw `FeedNotFoundError` (task 5) when the feed doesn't exist, mirroring
  `SourceNotFoundError`/`SubfeedNotFoundError`.
- Export from `server/feed/index.ts`.

This reads only the SQLite item cache — no network fetch. Freshness comes from
each member's own (sub)source refresh, or the aggregate refresh in task 4.

### 4. Engine — refreshing a feed

In `server/feed/refresh.ts`, add `refreshFeed(feedId, opts)`:

- Load `feedMembers(feedId)`; throw `FeedNotFoundError` if the feed itself
  doesn't exist.
- For each member, call `refreshSource` (no `subfeedId`) or `refreshSubfeed`
  (has one) — reusing the existing per-target loop rather than a new one, so a
  member is refreshed through the exact same path as refreshing it stand-alone.
- Aggregate the per-member `RefreshCounts` into one total, and add
  `FeedRefreshSummary` to `shared/types/domain.ts`:

  ```ts
  export interface FeedRefreshSummary extends RefreshCounts {
    feedId: number
    members: (RefreshSummary | SubfeedRefreshSummary)[]
  }
  ```

  `members` carries each member's own summary so the UI can report a partial
  failure per-member later; for now the route (task 6) surfaces only the
  totals plus member count, matching the source/subfeed refresh toasts.

### 5. Errors

`server/feed/errors.ts` — add `FeedNotFoundError` (same shape as
`SourceNotFoundError`/`SubfeedNotFoundError`). Update
`server/utils/errors.ts#isNotFoundError` to include it.

### 6. HTTP API routes

Nested for list/create/members, flat for by-id — the shape subfeeds already
use:

- `GET /api/feeds` — all feeds with a member count (task 2 helper) for the
  list badge.
- `GET /api/feeds/:id` — the feed plus its hydrated members (source
  title/url, and subfeed name when narrowed); 404 when missing.
- `POST /api/feeds` — create; 201 with the row.
- `PATCH /api/feeds/:id` — rename.
- `DELETE /api/feeds/:id` — 204; cascades membership (already covered by the
  existing constraint, `tests/db/constraints.spec.ts:70`).
- `GET /api/feeds/:id/members` — a feed's raw membership rows; 404 when the
  feed is missing.
- `POST /api/feeds/:id/members` — add a member. Validate the body (task 1);
  404 if `sourceId` doesn't exist; if `subfeedId` is present, 404 if it
  doesn't exist and 400 if it doesn't belong to `sourceId` (mismatched parent);
  409 on a duplicate membership, translating the schema's partial unique-index
  violation (`feed_sources_source_unique` / `feed_sources_subfeed_unique`,
  `server/db/schema.ts:100`) via `isUniqueViolation`, mirroring the subfeed
  409 (`server/api/sources/[id]/subfeeds.post.ts:30`).
- `DELETE /api/feed-members/:id` — 204; 404 when the membership row is
  missing.
- `POST /api/feeds/:id/refresh` — `refreshFeed` with optional `maxPages`
  forwarded to every member; return the summary; mirror the not-found
  translation in `server/api/sources/[id]/refresh.post.ts`.
- `GET /api/feeds/:id/items` — `feedItems`; the merged, de-duplicated,
  chronologically ordered stream; 404 when the feed is missing. Issue 07 layers
  filtering/sorting/search/pagination on top of this — this route stays
  unfiltered and unpaginated.

Routes stay thin: validate → repository/engine → typed result.

### 7. Types

`shared/types/db.ts`:

- `FeedListItem = Feed & { memberCount: number }`, mirroring `SourceListItem`.
- `FeedMemberDetail = FeedSource & { source: Source; subfeed: Subfeed | null }`
  for the hydrated `GET /api/feeds/:id` response.

### 8. Store

`app/stores/feeds.ts` — `useFeedsStore` holding `feeds: FeedListItem[]`,
`membersByFeed: Record<number, FeedMemberDetail[]>`, `loading`/`error`/
`errorStatus`, with actions `fetchAll`, `fetchOne` (feed + members),
`create`, `update`, `remove`, `addMember`, `removeMember`, `refresh`, and
`fetchItems(feedId)`. Follow the `$fetch` + `errorMessage(cause)` /
`errorStatus(cause)` shape of `app/stores/subfeeds.ts` — typed against the
shared types and schema input types, no `any`.

### 9. UI

- **List page** (`app/pages/feeds/index.vue`) — table/cards of feeds (name,
  member count), an "Add feed" action (inline modal — a feed is just a name,
  so no dedicated create page like sources'), and a per-row menu: manage
  (→ `/feeds/:id`), refresh, delete. Nuxt UI empty/loading/error states as on
  the sources page. Rename is also an inline modal, reached from the same row
  menu.
- **Detail / member-management page** (`app/pages/feeds/[id].vue`) — feed
  title, "Add member" action opening a form that picks a source and then
  (optionally) one of that source's subfeeds — a cascading `USelectMenu` pair,
  the second populated once a source is chosen and defaulting to "whole
  source" — plus the member list (source title/url, or "title → subfeed name"
  when narrowed) with a per-row remove action, a "Refresh feed" button
  (aggregate summary toast, as source/subfeed refresh do), and below it the
  merged item stream (title, published date, and which source it came from)
  as a plain read-only list — no filtering/search yet, that's issue 07. State
  near the member list, plainly, that a subfeed-narrowed member currently
  shows its parent source's full item set (the limitation from the Goal
  section) rather than leaving it to be discovered.
- **Delete feed** — confirm, stating memberships go but cached items stay.
- **Delete member** — confirm; cached items stay regardless.
- **Entry point** — a "Feeds" item in `app/layouts/default.vue`'s nav, next
  to Sources and Organise.
- Duplicate-membership 409s surface on the add-member form, not as a bare
  toast; same treatment subfeeds give duplicate names.

### 10. Seed (optional)

Add a feed combining two seeded sources — including one narrowed to a subfeed
if issue 05's seed added one — to `server/db/seed.ts` so `/feeds` renders
something in dev.

## Testing

- **Server** (`tests/api/feeds.spec.ts`): h3 router + mocked repositories in
  the style of `tests/api/subfeeds.spec.ts` — list/create/get/update/delete
  happy paths; 404 for an unknown feed; member add/remove happy paths; 404 for
  an unknown `sourceId`/`subfeedId`; 400 for a `subfeedId` that doesn't belong
  to the given `sourceId`; 409 on a duplicate membership; `:id/refresh` and
  `:id/items` returning the engine's results with not-found → 404 mapping.
- **Engine** (`tests/feed/compose.spec.ts`): against `createTestDb()` with
  items inserted directly (no network needed — this reads cache only) —
  `feedItems` merges across two distinct sources, sorts by `publishedAt`
  descending, and returns exactly one copy of a source's items when the feed
  has both a whole-source membership and a subfeed membership of that same
  source (the collapse-to-distinct-sourceId case). `tests/feed/refresh.spec.ts`
  gets a case for `refreshFeed` aggregating counts across a mixed
  whole-source + subfeed membership set, using the fixture `fetchImpl`.
- **DB** (`tests/db/`): the feed-delete cascade already covers `feed_sources`
  (`tests/db/constraints.spec.ts:70`); add coverage for the batched
  member-count helper, following the subfeed-count test's shape.
- **Store** (`tests/stores/feeds.spec.ts`): actions keep `feeds` and
  `membersByFeed` in sync on success and surface errors on failure, API
  mocked.
- **Component** (`tests/nuxt/`): the feed form emits the expected payload; the
  member-add form only enables the subfeed select once a source is chosen and
  emits `subfeedId: null` for "whole source".

## Acceptance criteria

- A user can add, list, rename, and remove feeds, and add/remove members
  (a source, optionally narrowed to one of its subfeeds) to/from a feed.
- Adding a duplicate membership is rejected with a field-level 409; adding a
  subfeed that doesn't belong to the chosen source is rejected with a 400.
- `GET /api/feeds/:id/items` returns a merged, de-duplicated, chronologically
  ordered stream of cached items across a feed's distinct member sources.
- "Refresh feed" runs refresh across every member and reports an aggregate
  summary.
- Deleting a feed removes its memberships; deleting a member, a source, or a
  subfeed that is a feed member leaves cached items intact.
- The UI states plainly that a subfeed-narrowed member currently surfaces its
  parent source's full cached item set, not just that subfeed's.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- Filtering, automatic sorting options, title/description search, and
  search-until-found pagination over a feed's items — issue 07, which
  consumes the base stream `GET /api/feeds/:id/items` provides here.
- Narrowing a feed member's cached items to its specific subfeed (the
  `item_subfeeds` join issue 05 already flagged as deferred) — issue 07, if it
  proves necessary.
- Bookmarking from a feed view — issue 08.
- Feeds declared in the managed-source config file — issue 09.
- Export / import of feeds — issue 10.
- Scheduled/background refresh — issue 09+.
