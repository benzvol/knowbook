# 00 — Knowbook: High-Level Plan

A single-user, self-hosted RSS reader with first-class support for paginated
sources, custom query params, composed feeds, and bookmarks. This document is
the north star; concrete work is tracked as issues in [`01-issues.md`](./01-issues.md)
and expanded into individual files under [`issues/`](./issues/).

## 1. Goals

- Manage (add / list / edit / remove) **sources**, organised by
  categories/types and **tags**.
- Robust **pagination** using standard and source-specific custom query params
  (e.g. `page`, `limit`).
- **Subfeeds** (subsources) derived from a source via custom query params —
  including per-**column** views of a news-type source.
- **Compose feeds** aggregating items from multiple sources.
- Consistent **content views** across sources, subfeeds and feeds: filtering,
  automatic sorting, full-text search over title & description, and
  _search-until-found_ pagination with a configurable page cap.
- **Bookmarks** with filtering plus automatic **and** manual (drag-and-drop)
  sorting.
- **App-managed sources** defined in a config file (URL, pagination params,
  item tags, columns, …), designed to extend later into scraping and TTS.
- **Export / import** of sources, feeds, bookmarks and settings.
- **Light** (beige) and **dark** (dark brown) themes.

## 2. Non-Goals (for now)

- Multi-user, auth, sync across devices.
- Content scraping and text-to-speech — only _prepared for_ via config schema
  and service seams; not implemented.
- Mobile-native apps (responsive web only).

## 3. Tech Stack

| Concern      | Choice                                            |
| ------------ | ------------------------------------------------- |
| Runtime / PM | Node 24, pnpm                                     |
| Framework    | Nuxt (TypeScript, SSR)                            |
| UI           | Vue + Nuxt UI                                     |
| Icons        | Phosphor Icons via `@nuxt/icon` (`ph` collection) |
| State        | Pinia                                             |
| Persistence  | SQLite via Drizzle ORM (+ drizzle-kit migrations) |
| Testing      | Vitest + Nuxt Test Utils                          |
| Quality      | ESLint + Prettier                                 |
| Packaging    | Docker + Docker Compose                           |

Server logic lives in Nuxt's Nitro `server/` layer (API routes, scheduled
fetches, config loading); the browser talks only to our own API, never directly
to remote feeds (avoids CORS and keeps parsing server-side).

## 4. Architecture Overview

```
┌── Vue pages/components (Nuxt UI) ──┐
│   sources · subfeeds · feeds       │
│   bookmarks · settings             │
└──────────────┬─────────────────────┘
               │ Pinia stores
┌──────────────┴─────────────────────┐
│ Nitro server/ (API routes)         │
│  ├─ fetch+parse engine (RSS/Atom)  │
│  ├─ pagination + search-until-found│
│  ├─ config loader (managed sources)│
│  └─ export/import                  │
└──────────────┬─────────────────────┘
               │ Drizzle
        ┌──────┴──────┐
        │   SQLite    │
        └─────────────┘
```

### Core domain model (indicative)

- **Source** — url, type (`news` | `standard`), pagination config, custom query
  params, `managed` flag, category, tags.
- **Category / Type**, **Tag** (+ join tables) — grouping and tagging.
- **Subfeed** — belongs to a Source; defined by extra query params. A **Column**
  is a specialised subfeed keyed by a source-specific query param.
- **Feed** — user-defined aggregate; many-to-many with Sources/Subfeeds.
- **Item** — normalised, cached feed entry (guid, title, description, link,
  publishedAt, tags, sourceId).
- **Bookmark** — references an Item; carries manual `sortOrder` and tags.
- **Setting** — key/value (theme, default page size, search cap, …).

_App-managed_ sources are seeded from a config file and reconciled on startup;
users can also "save as managed" to promote an existing source.

## 5. Cross-Cutting Concerns

- **Pagination engine**: a single abstraction maps standard + custom params onto
  a source and iterates pages; reused by list views and _search-until-found_.
- **Normalisation**: all fetched entries collapse into the `Item` shape so
  views, search and bookmarks are source-agnostic.
- **Views layer**: filtering / sorting / search implemented once and shared by
  source, subfeed and feed pages (drag-and-drop sorting is bookmarks-only).
- **Config-first extensibility**: the managed-source schema reserves fields for
  scraping/TTS so those can be added without a migration.

## 6. Delivery Phases

1. **Foundation** — scaffolding, tooling, persistence, fetch/parse engine.
2. **Sources** — CRUD, categories/types, tags; subfeeds & columns.
3. **Aggregation & consumption** — composed feeds; shared content views.
4. **Curation** — bookmarks with manual sorting.
5. **Platform** — managed-source config, export/import, settings & theming.

See [`01-issues.md`](./01-issues.md) for the issue-by-issue breakdown.

## 7. Definition of Done (per issue)

- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- Vitest coverage for server logic and store behaviour.
- Passes ESLint/Prettier; runs under Docker Compose.
