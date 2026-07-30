---
id: "01"
title: Persistence & data layer
description: >-
  Introduce SQLite + Drizzle with migrations, model the core domain schema,
  and expose a typed data-access layer in the Nitro server layer that all
  later API routes build on.
status: done
dependencies: ["00"]
affects: [server, db, tests]
---

# 01 — Persistence & data layer

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Introduce SQLite + Drizzle with drizzle-kit migrations, model the core domain,
and expose a typed data-access layer in the Nitro `server/` layer that all later
API routes build on. No feature endpoints or UI yet — this is the persistence
foundation.

**Depends on:** 00 (scaffolding).

## Tasks

### 1. Database client

Create a single SQLite connection (`better-sqlite3`) wrapped by Drizzle, living
under `server/db/`:

- `server/db/client.ts` — instantiate `better-sqlite3` at `DATABASE_PATH`
  (env var, already wired into Docker/compose; default to a local
  `./knowbook.sqlite` in dev), enable `PRAGMA journal_mode = WAL` and
  `PRAGMA foreign_keys = ON`, and export a typed `db` (Drizzle instance).
- Ensure the connection is created once and reused across requests (Nitro
  singleton / `nitroApp` context), not per-request.

### 2. Schema

Define the schema in `server/db/schema.ts` (one Drizzle table per domain entity
from the [plan's domain model](../00-plan.md#core-domain-model-indicative)):

- **sources** — `id`, `url`, `title`, `type` (`news` | `standard`), `managed`
  (bool), `categoryId` (fk, nullable), pagination config + custom query params
  (JSON columns), timestamps.
- **categories** — `id`, `name` (unique). (Category/Type grouping.)
- **tags** — `id`, `name` (unique).
- **source_tags** — join (`sourceId`, `tagId`), composite PK.
- **subfeeds** — `id`, `sourceId` (fk), `name`, extra query params (JSON), and a
  `columnParam` (nullable) marking a news "column" subfeed.
- **feeds** — `id`, `name`, timestamps.
- **feed_sources** — join (`feedId`, `sourceId`, nullable `subfeedId`) for the
  many-to-many aggregate.
- **items** — `id`, `sourceId` (fk), `guid`, `title`, `description`, `link`,
  `publishedAt`, `tags` (JSON), `fetchedAt`; unique index on
  (`sourceId`, `guid`) for de-dup/caching.
- **bookmarks** — `id`, `itemId` (fk), `sortOrder` (int, for manual ordering),
  `tags` (JSON), `createdAt`.
- **settings** — `key` (PK), `value` (JSON/text).

Notes:

- Use integer epoch-millis (or `text` ISO) consistently for timestamps; pick one
  and document it.
- JSON columns store structured config (pagination params, custom query params,
  item tags) so the _managed-source / scraping / TTS_ extension reserves space
  without a later migration, per the plan's config-first principle.
- Define foreign keys with sensible `onDelete` (cascade for join tables and
  items→source; restrict/set-null where data loss would surprise the user).

### 3. Migrations

- Configure `drizzle.config.ts` (dialect `sqlite`, `better-sqlite3` driver,
  schema path, `out: ./server/db/migrations`).
- Generate the initial migration with `drizzle-kit generate` and commit it.
- Add an idempotent **migrate-on-startup** step (a Nitro plugin) that applies
  pending migrations via `drizzle-orm/better-sqlite3/migrator` when the server
  boots, so a fresh volume/container self-initialises.
- Add scripts: `db:generate`, `db:migrate`, `db:studio`.

### 4. Typed data-access layer

Expose thin, typed repository helpers under `server/db/` (or `server/repos/`)
rather than letting routes touch Drizzle directly — keeps issue 03+ simple:

- Inferred types exported from the schema (`Source`, `NewSource`, …) via
  Drizzle's `$inferSelect` / `$inferInsert`.
- Re-export the shared row types into `shared/types/` where the client will also
  need them (e.g. `Source`, `Item`, `Bookmark`), keeping server-only types out
  of the client bundle.
- Full typed CRUD repositories for every entity now (one module per aggregate
  under `server/db/repositories/`, plus a barrel `index.ts`), so later feature
  issues only wire API + UI. Includes membership helpers (source↔tag,
  feed↔source), `upsertItem` by `(sourceId, guid)` for issue 02 caching,
  `reorderBookmarks` for issue 08, and `getSetting`/`setSetting`/`getAllSettings`.
- Repository functions are synchronous (better-sqlite3 is a sync driver) and
  take a trailing `database: DB = db` param so tests can inject an in-memory DB.

### 5. Seeding (dev convenience)

A small, optional seed script (`server/db/seed.ts`, script `db:seed`) inserting
a couple of sample sources so later UI work has data. Not run automatically.

## Testing

- Vitest specs (`tests/db/*.spec.ts`) using an **in-memory** or temp-file SQLite
  DB: run migrations, then assert insert/read round-trips and that constraints
  hold (unique `(sourceId, guid)`, cascade deletes, FK enforcement).
- A test helper that builds a fresh migrated DB per test file.

## Acceptance criteria

- `pnpm db:generate` produces a migration; `pnpm db:migrate` applies it to a
  fresh database file with no errors.
- Server boots and auto-applies pending migrations on a clean volume.
- Drizzle-inferred types are exported and importable from both `server/` and
  `shared/types/`.
- `pnpm test` covers schema round-trips and key constraints; all green.
- `pnpm lint` and `pnpm build` still pass.

## Out of scope

- HTTP API routes and Pinia stores — issue 03 (source management) onward.
- Fetching/parsing remote feeds and populating `items` — issue 02.
- Any UI.
