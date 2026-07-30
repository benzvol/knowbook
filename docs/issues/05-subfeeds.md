---
id: "05"
title: Subfeeds
description: >-
  Derive named subfeeds from a source via extra query params merged over the
  parent's, and manage (add / list / edit / remove) plus refresh them under
  their parent source.
status: todo
dependencies: ["03", "04b"]
affects: [app, server, tests]
---

# 05 — Subfeeds

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Make the `subfeeds` table from issue 01 a usable feature: a **subfeed** is a
named variation of its parent source, defined by extra query params merged over
the source's own. This issue adds the engine seam that turns a subfeed into
fetchable page URLs, the API + store + UI to manage subfeeds under their parent
source, and a per-subfeed refresh. Rendering a subfeed's items with
filtering/sorting/search belongs to issue 07; here a subfeed is configuration
plus refresh.

**A "column" is just a subfeed.** The plan originally described columns as a
list of values for one source-level query param, backed by
`subfeeds.columnParam`. That model cannot express a real column key — on
telex.hu the column identity is nested _inside_ a JSON-encoded param:

```
https://telex.hu/rss/archivum?filters={"superTagSiteSlugs":["g7"],"superTagSlugs":[null],"parentId":["null"]}&oldal=2&perPage=10
```

`g7` is a value inside `filters`, not the value of a param — so "one param name,
many values" has nowhere to put it. A subfeed's own `queryParams` bag handles it
with no schema change: `{ filters: '{"superTagSiteSlugs":["g7"],…}' }` is a valid
`Record<string, string>`, and `URLSearchParams.set` encodes it correctly. The
paging params `oldal` / `perPage` are ordinary `pageParam` / `sizeParam` on the
parent source. Issue 04b drops `columnParam`; displaying sibling subfeeds
side-by-side is a **view** concern and belongs to issue 07.

**Depends on:** 03 (source management), 04b (simplify classification) — 04b
removes `columnParam` and `sources.type`, both of which this issue would
otherwise have to reason about.

## Tasks

### 1. Engine — subfeeds as fetch targets

`server/feed/pagination.ts` builds page URLs from a `Source`. Widen that seam so
a subfeed drives the same iterator without duplicating logic:

- Add a `FeedTarget` type — `Pick<Source, 'url' | 'pagination' | 'queryParams'>`
  — to `shared/types/domain.ts`, and change `buildPageUrl` and `pages`
  (`server/feed/pagination.ts`) plus `searchUntilFound` (`server/feed/search.ts`)
  to accept a `FeedTarget` instead of a full `Source`. A `Source` already
  satisfies it structurally, so no existing caller changes.
- Add `server/feed/target.ts` with `subfeedTarget(source, subfeed): FeedTarget`
  — the parent's `url` and `pagination`, with `queryParams` merged as
  `{ ...source.queryParams, ...subfeed.queryParams }` so the subfeed wins on key
  collisions. Export it from `server/feed/index.ts`.

Pagination is deliberately **inherited, not overridable**: paging is a property
of the endpoint, and both the source and its subfeeds hit the same one.

### 2. Engine — refreshing a subfeed

- Extract the fetch/parse/upsert loop in `server/feed/refresh.ts` into a helper
  over `(target: FeedTarget, sourceId: number, opts)`; `refreshSource` becomes a
  thin wrapper that passes the source as its own target.
- Add `refreshSubfeed(subfeedId, opts)` — load the subfeed and its parent, build
  the target, run the same loop. Return a `SubfeedRefreshSummary` that adds
  `subfeedId` rather than overloading `RefreshSummary.sourceId`.
- **Items cache under the parent `sourceId`.** A subfeed is a different _view_ of
  the same feed, so the same entry legitimately arrives via both the source and
  its subfeeds; the existing `(sourceId, guid)` unique index
  (`server/db/schema.ts:142`) then keeps it a single row and `upsertItem`'s
  dedupe stays correct. Consequence: which subfeed an item arrived through is
  **not** persisted. Issue 07 resolves a subfeed view through the engine, or adds
  an `item_subfeeds` join if it needs cached filtering. No migration here.

### 3. Validation

`shared/schemas/subfeed.ts`, following `shared/schemas/source.ts`:

- `name` — `z.string().trim().min(1)`.
- `queryParams` — import and reuse `queryParamsSchema` rather than redefining it;
  nullable and optional.
- `subfeedUpdateSchema` = the `.partial()` variant.
- `sourceId` comes from the route path, never the body.

No cross-field refinement is needed now that `columnParam` is gone.

### 4. HTTP API routes

Nested for create/list, flat for by-id — the shape the tag-membership routes
already use:

- `GET /api/sources/:id/subfeeds` — the source's subfeeds; 404 when the source is
  missing.
- `POST /api/sources/:id/subfeeds` — create under that source; 201 with the row.
- `GET /api/subfeeds/:id` — 404 when missing.
- `PATCH /api/subfeeds/:id` — partial update; reject a `sourceId` in the body, so
  a subfeed cannot be moved between sources.
- `DELETE /api/subfeeds/:id` — 204.
- `POST /api/subfeeds/:id/refresh` — `refreshSubfeed` with optional `maxPages`,
  returning the summary; mirror the not-found translation in
  `server/api/sources/[id]/refresh.post.ts`.

Names must be unique within a source. There is no DB index for that, and a
single-user app does not need one — enforce it in the route as a **409** via one
repository helper, so the rule has a single home if an index is added later.
Routes stay thin: validate → repository/engine → typed result.

### 5. Repository additions

`server/db/repositories/subfeeds.ts` already has list/get/create/update/delete.
Add:

- A lookup by `(sourceId, name)` for the 409 check.
- A per-source subfeed **count** helper for the source-list badge, following the
  batched `tagsForSources` pattern (`server/db/repositories/tags.ts:74`) — return
  a `Map<number, number>` for a list of source ids rather than querying per row.

### 6. Store

`app/stores/subfeeds.ts` — `useSubfeedsStore` holding
`bySource: Record<number, Subfeed[]>` plus `loading` / `error`, with
`fetchForSource`, `create`, `update`, `remove`, `refresh`. Follow the `$fetch` +
`errorMessage(cause)` shape of `app/stores/sources.ts`, typed against `Subfeed`
and the schema input types — no `any`.

### 7. UI

- **Page** — `app/pages/sources/[id]/subfeeds.vue`: parent title/url as context,
  the subfeed list (name, effective params, per-row edit / delete / refresh), an
  "Add subfeed" action, and Nuxt UI empty / loading / error states as on the
  sources page.
- **Form** — `app/components/subfeeds/SubfeedForm.vue`: `name` plus a key/value
  query-param editor. Extract the param-rows half of
  `app/components/sources/PaginationParamsEditor.vue` into a reusable
  `QueryParamsEditor` that both use, rather than copy-pasting it. State on the
  form that pagination is inherited from the source.
- **Effective params** — show the merged result (parent overlaid with the
  subfeed's), marking which keys the subfeed overrides, so it is obvious what
  will be requested. Long values like the telex `filters` JSON need to stay
  readable — allow wrapping rather than truncating to one line.
- **Entry point** — a "Subfeeds" item in the source-list row menu
  (`app/pages/sources/index.vue`) with a count badge from the task 5 helper.
- **Delete** — confirm, stating the subfeed goes but cached items stay (they
  belong to the parent source).
- **Refresh** — summary toast, as the source refresh does.
- Duplicate-name 409s surface on the form field, not as a bare toast.

### 8. Seed (optional)

Add a subfeed or two to `server/db/seed.ts` so the page renders something in dev
— a telex-style source with a JSON `filters` subfeed is the useful case to have
in front of you.

## Testing

- **Server** (`tests/api/subfeeds.spec.ts`): h3 router + mocked repositories in
  the style of `tests/api/sources.spec.ts` — list/create/get/update/delete happy
  paths, 404 for unknown source and unknown subfeed, 400 on an invalid body and
  on a `sourceId` in a PATCH, 409 on a duplicate name, and `:id/refresh`
  returning the engine's summary with the not-found → 404 mapping.
- **Engine** (`tests/feed/`): `subfeedTarget` merges params with the subfeed
  winning on collisions and inherits the parent's pagination; `buildPageUrl` over
  a subfeed target produces the expected URL across pages — include a
  JSON-valued param asserting it survives encoding intact, since that is the
  case the old `columnParam` model got wrong; `refreshSubfeed` against
  `createTestDb()` caches under the **parent** `sourceId` and a second run
  updates instead of duplicating. Keep using the fixture feeds and injected
  `fetchImpl` so tests stay offline.
- **DB** (`tests/db/`): the source-delete cascade already covers subfeeds
  (`tests/db/constraints.spec.ts:52`); add coverage for the batched count helper.
- **Store** (`tests/stores/subfeeds.spec.ts`): actions keep the per-source map in
  sync on success and surface errors on failure, API mocked.
- **Component** (`tests/nuxt/`): the form emits the expected payload and renders
  the effective merged params, including an overridden key.

## Acceptance criteria

- A user can add, list, edit, and remove subfeeds under a source, each defined by
  its own query params merged over the parent's, with the parent's pagination
  inherited.
- A subfeed whose distinguishing param is a JSON-encoded value (the telex case)
  round-trips through the form, the API, and URL construction unaltered.
- Refreshing a subfeed fetches through the shared pagination engine using the
  merged params and caches items under the parent source without duplicating
  items already cached.
- Duplicate subfeed names within a source are rejected with a field-level
  message.
- Deleting a source removes its subfeeds; deleting a subfeed leaves cached items
  intact.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- Composed feeds over sources and subfeeds — issue 06, which consumes the
  `feed_sources.subfeedId` seam this issue makes meaningful.
- Rendering a subfeed's items, and **displaying sibling subfeeds side-by-side as
  columns** — issue 07, which also owns any persisted subfeed↔item association
  if cached filtering proves necessary.
- Bookmarking from a subfeed view — issue 08.
- Subfeeds declared in the managed-source config file — issue 09.
- Export / import of subfeeds — issue 10.
- Scheduled/background refresh — issue 09+.
