---
id: "04"
title: Categories, types & tagging
description: >-
  Let users manage categories and free-form tags, assign them to sources, and
  group or filter the source list by category, type and tag.
status: todo
dependencies: ["03"]
affects: [app, server, tests]
---

# 04 — Categories, types & tagging

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Turn the classification seams left open by issue 03 into a usable feature: full
CRUD for **categories** and **tags**, tag membership on sources, and grouping /
filtering of the source list by category, source **type** (`news` | `standard`)
and tag. The schema (`categories`, `tags`, `source_tags`) and repositories
already exist from issue 01, and issue 03 already writes `categoryId`; this
issue adds the missing API routes, stores, and UI, and makes a source's tags
visible end-to-end.

Note on "types": the plan's _category/type_ grouping is covered by the existing
user-defined `categories` table plus the fixed `SourceType` field on a source —
no new table is introduced here.

**Depends on:** 03 (source management).

## Tasks

### 1. Category API routes

`server/api/categories/index.get.ts` already exists. Complete the resource,
mirroring the thin validate → repository → typed result style of the sources
routes:

- `POST /api/categories` — create; 201 with the created row.
- `GET /api/categories/:id` — 404 when missing.
- `PATCH /api/categories/:id` — rename; 404 when missing.
- `DELETE /api/categories/:id` — 204. Sources keep existing but lose the
  category (`categoryId` is `on delete set null` in the schema) — surface that
  in the UI confirmation rather than blocking the delete.
- `categories.name` is unique: translate the SQLite constraint violation into a
  **409** with a clear message instead of leaking a 500.

### 2. Tag API routes

New routes under `server/api/tags/` backed by the issue 01 tag repository:

- `GET /api/tags` — list all tags.
- `POST /api/tags` — create (409 on duplicate name, as above).
- `PATCH /api/tags/:id` — rename.
- `DELETE /api/tags/:id` — 204; `source_tags` rows cascade away.

### 3. Source ↔ tag membership

Expose the existing `tagsForSource` / `attachTag` / `detachTag` helpers:

- `GET /api/sources/:id/tags` — the source's tags.
- `PUT /api/sources/:id/tags` — replace the whole set from a `tagIds` array
  (simplest thing that matches how the form submits); attach/detach diffed
  server-side, unknown tag ids rejected with 400.
- Extend the source read routes so the client gets tags without an N+1: add a
  repository helper that hydrates tags for the listed/fetched sources and return
  a `SourceWithTags` shape (`Source & { tags: Tag[] }`) from `GET /api/sources`
  and `GET /api/sources/:id`. Add that type to `shared/types` and keep the plain
  `Source` type for writes.
- Optionally allow `tagIds` on the source create/update payload so the issue 03
  form can save a source and its tags in one request; if added, apply it in the
  same handler after the row is written.

### 4. Validation

- `shared/schemas/category.ts` and `shared/schemas/tag.ts` — `name` (trimmed,
  `min(1)`), with `…UpdateSchema` as the `.partial()` variant, matching the
  `sourceCreateSchema` / `sourceUpdateSchema` pattern.
- A small schema for the membership payload (`{ tagIds: number[] }`, positive
  ints, deduped).
- If `tagIds` lands on the source payload, extend `shared/schemas/source.ts`
  rather than defining a second shape.

### 5. Stores

- Extend `app/stores/categories.ts` with `create`, `update`, `remove` and the
  same `error` handling the sources store uses (it currently only has
  `fetchAll` and no error state).
- Add `app/stores/tags.ts` — `useTagsStore` with `fetchAll`, `create`, `update`,
  `remove`.
- Extend `app/stores/sources.ts` for tags: hold the hydrated `SourceWithTags`
  list and add a `setTags(id, tagIds)` action; keep the store the single source
  of truth so the list and filters read the same data.
- Typed against the shared types — no `any`.

### 6. UI — managing categories & tags

A management surface under `app/pages/` (e.g. `/categories` and `/tags`, or one
"Organise" page with two sections — decide at impl) plus components under
`app/components/`:

- List, inline create, rename, and delete for both entities, with Nuxt UI empty
  / loading / error states as in the sources page.
- Delete confirmation that spells out the consequence (category: sources become
  uncategorised; tag: removed from all sources) and shows how many sources are
  affected.
- Duplicate-name errors from the API shown on the form field, not as a bare
  toast.

### 7. UI — assigning and using classification

- **Source form** (`app/components/sources/SourceForm.vue`) — add a tag picker
  (multi-select, allowing creation of a new tag inline) next to the existing
  category select.
- **Source list** (`app/pages/sources/index.vue`) — show tags as badges in a new
  column, and add controls to **group by category** (grouped sections or a
  category filter) and **filter by type and tag** (multi-tag filter; AND
  semantics, stated in the UI). Filtering is client-side over the store list —
  the source count is small and issue 07 owns server-side view logic.
- Empty filter results get their own message, distinct from "no sources yet".
- Add nav entries for the new page(s) in `app/layouts/default.vue`.

### 8. Seed (optional)

Extend `server/db/seed.ts` with a couple of tags attached to the sample sources
so the grouping/filtering UI has something to show in dev.

## Testing

- **Server** (`tests/api/`): route tests in the style of
  `tests/api/sources.spec.ts` (h3 router + mocked repositories) covering
  category and tag list/create/rename/delete happy paths, 404 on missing id,
  400 on invalid body, 409 on duplicate name, and the membership route replacing
  a source's tag set (attach/detach diff) plus 400 on unknown tag ids.
- **Server** (`tests/db/`): a test against the in-memory DB helper asserting the
  tag-hydration helper returns each source's tags, that deleting a category
  nulls `sources.categoryId`, and that deleting a tag removes its `source_tags`
  rows.
- **Stores** (`tests/stores/`): category, tag, and `setTags` actions update state
  on success and surface errors on failure (API mocked).
- **Component** (`tests/nuxt/`): the source form emits the selected `tagIds`;
  the source list filters by tag/type and groups by category given a seeded
  store.

## Acceptance criteria

- A user can create, rename, and delete categories and tags from the UI, with
  duplicate names rejected and reported clearly.
- A source can be assigned a category and any number of tags, persisted across
  reloads.
- Deleting a category leaves its sources intact but uncategorised; deleting a
  tag removes it from all sources.
- The source list can be grouped by category and filtered by type and tag, with
  tags visible per row.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- Subfeeds & columns — issue 05.
- Composed feeds — issue 06.
- Item-level tags and the shared content views' filtering / sorting / search —
  issue 07 (this issue filters the **source list** only).
- Bookmark tags and their filtering — issue 08.
- Item tags supplied by managed-source config — issue 09.
- Export / import of categories and tags — issue 10.
