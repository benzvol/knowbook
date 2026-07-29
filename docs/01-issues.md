# 01 — Implementation Issues

High-level breakdown of the work described in [`00-plan.md`](./00-plan.md).
Each issue below gets its own detailed file under [`issues/`](./issues/), using
the same two-digit prefix. Tasks here are intentionally coarse — one paragraph
of intent per issue; acceptance criteria and detail live in the issue files.

Ordering reflects dependencies: foundation first, then domain features, then
platform concerns.

| #   | Issue                              | Depends on |
| --- | ---------------------------------- | ---------- |
| 00  | Project scaffolding & tooling      | —          |
| 01  | Persistence & data layer           | 00         |
| 02  | Feed fetch & parse engine          | 01         |
| 03  | Source management                  | 01, 02     |
| 04  | Categories, types & tagging        | 03         |
| 05  | Subfeeds & columns                 | 03         |
| 06  | Composed feeds                     | 03, 05     |
| 07  | Shared content views               | 02, 03     |
| 08  | Bookmarks                          | 07         |
| 09  | Managed sources from config        | 03         |
| 10  | Export & import                    | 03, 06, 08 |
| 11  | Settings & theming                 | 00         |

---

## 00 — Project scaffolding & tooling

Initialise the Nuxt (TypeScript, SSR) app with pnpm; wire up Nuxt UI, Pinia,
ESLint, Prettier, Vitest + Nuxt Test Utils, and a Docker / Docker Compose setup.
Establish project structure and a CI-friendly `lint`/`test`/`build` baseline so
every later issue lands on a working foundation.

## 01 — Persistence & data layer

Introduce SQLite + Drizzle with drizzle-kit migrations. Model the core domain
(sources, categories/types, tags, subfeeds, feeds, items, bookmarks, settings)
and expose a typed data-access layer the server routes build on.

## 02 — Feed fetch & parse engine

Server-side fetching and parsing of RSS/Atom into a normalised `Item` shape,
with a reusable pagination abstraction driving standard and custom query params.
Includes item caching and the foundation for *search-until-found* paging.

## 03 — Source management

Full CRUD (add / list / edit / remove) for sources across API, Pinia store and
UI, including per-source pagination and custom query-param configuration. First
end-to-end vertical slice tying persistence, engine and UI together.

## 04 — Categories, types & tagging

Let users classify sources by category/type and apply free-form tags; surface
grouping and tag-based filtering in the source list.

## 05 — Subfeeds & columns

Derive subfeeds from a source using custom query params, plus a specialised
"columns" view for news-type sources keyed by a source-specific param. Manage
(add / list / edit / remove) subfeeds under their parent source.

## 06 — Composed feeds

Create and manage feeds that aggregate items from multiple sources (and
subfeeds), with merge + de-duplication of normalised items into one stream.

## 07 — Shared content views

A reusable view layer for sources, subfeeds and feeds providing filtering,
automatic sorting, title/description search, and search-until-found pagination
with a configurable max-page cap. No drag-and-drop here.

## 08 — Bookmarks

Manage a list of bookmarks with filtering, automatic sorting, and manual
drag-and-drop ordering persisted per bookmark. Bookmark any item from a source,
subfeed or feed view.

## 09 — Managed sources from config

Load app-managed sources from a config file (URL, pagination, custom params,
item tags, columns), reconciled on startup. Allow promoting an existing source
to "managed", and reserve schema seams for later scraping / TTS.

## 10 — Export & import

Export sources, feeds, bookmarks and settings to a portable file and import them
back, with validation and sensible merge/replace behaviour.

## 11 — Settings & theming

App settings (default page size, search cap, …) plus light (beige) and dark
(dark brown) themes with persisted user preference.
