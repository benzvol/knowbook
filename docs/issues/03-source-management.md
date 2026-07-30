---
id: "03"
title: Source management
description: >-
  Deliver full CRUD for sources across the Nitro API, a Pinia store, and Nuxt
  UI, including pagination/query-param config and a refresh action that runs
  the fetch engine.
status: done
dependencies: ["01", "02"]
affects: [app, server, tests]
---

# 03 — Source management

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Deliver the first end-to-end vertical slice: full CRUD (add / list / edit /
remove) for **sources** across the Nitro API, a Pinia store, and Nuxt UI —
including per-source pagination config and custom query params from issue 01,
and a "refresh" action that runs the issue 02 engine to fetch and cache items.
This ties persistence, engine, and UI together and establishes the API + store +
page patterns every later feature reuses.

**Depends on:** 01 (persistence & data layer), 02 (fetch & parse engine).

## Tasks

### 1. HTTP API routes

Add typed Nitro routes under `server/api/sources/` backed by the issue 01
repositories:

- `GET /api/sources` — list all sources.
- `GET /api/sources/:id` — fetch one (404 when missing).
- `POST /api/sources` — create; body validated (see task 2).
- `PATCH /api/sources/:id` — partial update.
- `DELETE /api/sources/:id` — remove (cascades to items/subfeeds/tags per the
  schema).
- `POST /api/sources/:id/refresh` — invoke the issue 02 `refreshSource`; return
  the refresh summary (items seen / inserted / updated). Optional `maxPages`.
- Routes are thin: validate → call repository/engine → return typed result. Use
  `h3` helpers (`readBody`, `getRouterParam`, `createError`) and consistent
  error shapes.

### 2. Validation

- Validate request bodies with a schema library (add via `pnpm add`; e.g. `zod`)
  shared between create and update (update = partial). Cover `url` (valid URL),
  `title`, `type` (`news` | `standard`), `managed`, optional `categoryId`, and
  the nested `pagination` (`PaginationConfig`) and `queryParams` shapes.
- Reject unknown/malformed pagination or query-param payloads with a 400 and a
  helpful message; keep the validation types aligned with `shared/types`.

### 3. Pinia store

- `app/stores/sources.ts` — a `useSourcesStore` holding the source list and
  per-source loading/error state, with actions `fetchAll`, `fetchOne`, `create`,
  `update`, `remove`, and `refresh`, each calling the API via `$fetch`/`useFetch`.
- Keep the store the single source of truth for source data used by pages;
  optimistic vs refetch behaviour decided at impl and kept simple.
- Typed against the shared `Source`/`NewSource` types — no `any`.

### 4. UI — list & management

Under `app/pages/sources/` and `app/components/sources/`, using Nuxt UI + the
`ph` icon collection:

- **List page** (`/sources`) — table/cards of sources showing title, url, type,
  managed flag, item count or last-refresh, with per-row edit / delete / refresh
  actions and an "Add source" button.
- **Create / edit form** — modal or dedicated page with fields for url, title,
  type, category (select; may be a plain id until issue 04), and an editor for
  **pagination and custom query params** (page param, size param, page size,
  start page; key/value rows for `queryParams`). Client-side validation mirrors
  the server schema.
- **Delete** — confirmation before removing (destructive, cascades).
- **Refresh** — trigger `POST …/refresh` and surface the summary (e.g. a toast);
  reflect updated item count.
- Empty, loading, and error states handled with Nuxt UI components.

### 5. Wiring & navigation

- Add a nav entry/link to the sources area in the app shell/layout.
- Ensure SSR-friendly data loading (initial list fetched on the page) and that
  the store hydrates without duplicate requests.

## Testing

- **Server**: route tests (Nuxt Test Utils / `$fetch` against the app, or direct
  handler tests) covering list/get/create/update/delete happy paths, 404 on
  missing id, 400 on invalid body, and that `:id/refresh` calls the engine and
  returns a summary (engine mocked or run against an in-memory DB).
- **Store**: Pinia store tests for actions updating state correctly on success
  and surfacing errors on failure (API mocked).
- **Component** (light): the create/edit form validates required fields and
  emits the expected payload; the list renders rows from the store.

## Acceptance criteria

- A user can add, list, edit, and remove a source through the UI, with pagination
  and custom query params configurable per source and persisted via issue 01.
- Refreshing a source runs the issue 02 engine, caches items, and shows a
  summary; the item count reflects the refresh.
- Invalid input is rejected client- and server-side with clear messages.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- Category/type management UI and tag CRUD/filtering — issue 04 (this issue may
  reference an existing `categoryId` but doesn't manage categories).
- Subfeeds & columns — issue 05.
- Composed feeds — issue 06.
- The shared content views (filtering / sorting / search / search-until-found
  UI) over a source's items — issue 07.
- Scheduled/background refresh and managed-source config — issue 09.
