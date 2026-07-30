---
id: 04b
title: Simplify classification
description: >-
  Collapse the overlapping source-classification axes down to tags: drop
  `sources.type`, the `categories` table and `sources.categoryId`, and the
  unused `subfeeds.columnParam`, re-keying the source list's grouping onto tags.
status: done
dependencies: ["04"]
affects: [app, server, db, tests]
---

# 04b — Simplify classification

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Issues 01–04 built four ways to classify a source — a fixed `type`, a
single-valued `category`, many-valued `tags`, and a reserved `columnParam` — and
in practice they overlap or carry no behaviour at all. This issue reduces them to
**one axis: tags**, and removes the dead schema and code behind the others. The
source list keeps its grouping and filtering; both are simply re-keyed onto tags.

It also closes a smaller mismatch: **`managed` is currently user-writable** (it
sits in `sourceCreateSchema` with a checkbox in the source form), even though the
flag is meant to mean "declared by the app maintainer in a config file". This
issue makes it server-owned, which also retires the planned _"save as managed"_
feature — see task 3.

Rationale, verified against the current code rather than the plan:

- **`sources.type` carries no behaviour.** Nothing under `server/feed/` reads it
  — the engine branches on `source.pagination?.pageParam`
  (`server/feed/pagination.ts:34`), not on `type`. Its only consumers are a form
  select, a list filter, and seed data. What "news-type" was meant to signal is
  already expressed, and actually acted upon, by `pagination` being configured.
- **Categories are tags with a ration of one.** A tag set strictly subsumes a
  single category, and the ration is a cost rather than a feature: a source is
  legitimately both _news_ and _hungarian_, and forcing a pick buys nothing. That
  a tag-grouped list shows such a source under both headings is the desired
  behaviour for a reader sidebar.
- **Composed feeds already own reading-time grouping.** Issue 06's `feeds` are
  the "sources I read together" primitive, which is what categories were
  competing for. That leaves a clean split: **tags** to organise, **feeds** to
  consume, **subfeeds** to slice one source.
- **`subfeeds.columnParam` encodes the wrong model.** See issue 05 — a column is
  just a subfeed, and the "one param name, many values" shape cannot express a
  real-world column key. The field is unused by any code today.

**Depends on:** 04 (categories, types & tagging) — this trims part of what 04
delivered, so it lands after it rather than replacing it in history.

## Tasks

### 1. Schema & migration

In `server/db/schema.ts`:

- Drop the `categories` table and `sources.categoryId` (with its
  `on delete set null` reference).
- Drop `sources.type`.
- Drop `subfeeds.columnParam`.
- Leave `tags`, `source_tags`, and everything else untouched.

Then `pnpm db:generate`. SQLite cannot drop a column that participates in a
foreign key, so drizzle-kit emits a table-recreate (`__new_sources` → copy →
drop → rename) guarded by `PRAGMA foreign_keys=OFF`. Give the generated SQL a
read to confirm it recreates `sources` with the surviving columns and its
autoincrement primary key.

The app is not in live use until all planned issues are done, so **existing data
is expendable**: no data-preservation test or careful migration rehearsal is
needed here. If the recreate misbehaves, delete `data/knowbook.sqlite*` and let
`server/plugins/migrate.ts` rebuild from scratch, then re-run `pnpm db:seed`.

Also delete `SourceType` from `shared/types/domain.ts`.

### 2. Remove the categories vertical slice

Delete, in full:

- `server/db/repositories/categories.ts` and its re-export in
  `server/db/repositories/index.ts`.
- `server/api/categories/` (all five routes).
- `shared/schemas/category.ts`.
- `app/stores/categories.ts`.
- `Category` / `NewCategory` from `shared/types/db.ts`, and the `categories`
  import from the schema.

### 3. Drop `type`, and make `managed` server-owned

- `shared/schemas/source.ts` — remove the `type` field from `sourceCreateSchema`
  (`sourceUpdateSchema` follows automatically). Also remove **`managed`**: it is
  not a user-supplied property. `managed` means _the app maintainer declared this
  source in a config file_ (issue 09), so only the config loader may set it. A
  user marking their own source "managed" is meaningless, and leaving it writable
  would let a client forge the flag. The column stays in the schema, defaulting to
  `false`; issue 09's loader is its only writer.
- `app/components/sources/SourceForm.vue` — remove `typeOptions`, the Type
  `UFormField`, the `categoriesStore` / `categoryOptions` and the Category
  `UFormField`, **and the "Managed source" `UCheckbox`** plus `managed` from
  `state`. The form keeps title, url, tags, and the pagination/query-param
  editor.
- `app/pages/sources/index.vue` — **keep** the read-only "Managed" badge column.
  Users cannot set the flag, but seeing which sources are maintainer-managed is
  useful, and issue 09 will make it meaningful.
- `server/db/seed.ts` — drop `createCategory` and the `type` / `categoryId`
  arguments. Keep the tags, and keep `pagination` on the sample paginated
  source; that is now what marks it as news-like.

### 4. Re-key the source list onto tags

`app/pages/sources/index.vue` keeps grouping and filtering — only the axis
changes. Filtering by tag (AND semantics) already exists and stays as is.

- Remove the type filter, the `type` table column, `groupByCategory`, the
  `CategoryGroup` interface, the `groups` computed, and `categoriesStore`.
- Add **group by tag**, reusing the shape of the removed `groups` computed: one
  section per tag, ordered by name, plus a trailing **Untagged** section. A
  source with several tags intentionally appears under each of them — state that
  in the UI so the repetition reads as deliberate.
- Keep the separate "no sources match these filters" and "no sources yet"
  messages.

### 5. Organise page becomes tags-only

`app/pages/organise.vue` — remove `categoryCounts`, the three category handlers,
and the categories `OrganiseEntityList`; collapse the two-column grid to a
single column. `app/components/organise/EntityList.vue` is generic and needs no
change — it stays in use for tags.

### 6. Tests

- Delete `tests/api/categories.spec.ts` and `tests/stores/categories.spec.ts`.
- Drop `type` and `categoryId` from every `makeSource` fixture and
  `createSource` call — `tests/feed/fixtures.ts`, `tests/api/sources.spec.ts`,
  `tests/stores/sources.spec.ts`, `tests/nuxt/SourcesList.spec.ts`,
  `tests/db/schema.spec.ts`, `tests/db/constraints.spec.ts`. Remove the
  `listCategories` mock from `tests/api/sources.spec.ts`.
- Remove the now-meaningless cases: `stores category grouping`
  (`tests/db/schema.spec.ts`) and `sets category_id null on category delete`
  (`tests/db/constraints.spec.ts`). Keep the source-delete cascade test, which
  still covers items/subfeeds/tags/feed membership.
- Replace the list's group-by-category and type-filter assertions in
  `tests/nuxt/SourcesList.spec.ts` with group-by-tag ones, including a
  multi-tagged source appearing in two groups and an untagged source landing in
  **Untagged**.
- `managed` stays in the DB fixtures (it is still a column), but drop it from
  `SourceForm.spec.ts`'s submitted-payload expectations. Add a route test
  asserting a `managed: true` in a create/update body is **ignored**, not
  persisted — that is the one new behaviour here, not just a deletion.

### 7. Docs

- `docs/00-plan.md` — goals, the core domain model, and the delivery phases all
  describe categories/types and a `columnParam`-keyed column; bring them in line.
- `docs/01-issues.md` — retitle 04, add this issue, retitle 05 (see issue 05).
- `docs/issues/04-categories-types-tagging.md` — leave the body as the
  historical record; add a short note at the top pointing here for what was
  subsequently removed.
- `docs/00-plan.md` also promises users can _"save as managed"_ — drop that
  sentence; see the note in issue 09's summary in `docs/01-issues.md`.
- `docs/features.txt` is the original input and stays untouched; this issue is
  the resolution of its `categories/types **and/or** tags` ambiguity and of its
  `Save a source and its settings as managed` line.

## Testing

Mostly deletion, so the bar is that the surviving suite still passes:

- `pnpm test` green with the removed specs gone and the re-keyed list/store
  assertions updated.
- The new route test proves `managed` cannot be set from a request body.
- Manually: delete `data/knowbook.sqlite*`, start the app, `pnpm db:seed`, then
  load `/sources` and `/organise` — grouping by tag works and the source form has
  no type, category, or managed field.
- `pnpm lint` and `pnpm build` catch the dangling imports and auto-imported
  store references that deletion tends to leave behind.

## Acceptance criteria

- `sources` has no `type` and no `category_id`; the `categories` table and
  `subfeeds.column_param` are gone; `tags` / `source_tags` are unchanged.
- No `categories` route, store, schema, repository, or type remains, and no
  `SourceType` remains.
- `managed` is absent from the source schemas and the form, and a `managed` value
  in a request body has no effect; the read-only badge still renders.
- The source list still filters by tag and can group by tag, with a multi-tagged
  source appearing under each of its tags and untagged sources grouped together.
- The Organise page manages tags only.
- A fresh database migrates and seeds cleanly.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- Subfeeds — issue 05, which lands on this simplified schema.
- Composed feeds, which take over reading-time grouping — issue 06.
- Item-level tags and content-view filtering / sorting / search — issue 07.
- Bookmark tags — issue 08.
- The config loader that actually **writes** `managed`, the user-facing "load this
  managed source" flow, and the per-source plugin seam — issue 09. This issue only
  closes the write path; it adds no loader.
- The export-to-config script that replaces "save as managed" — issue 10 territory,
  once export exists.
- Renaming or renumbering issues 05–11.
