# 01 — Implementation Issues

High-level breakdown of the work described in [`00-plan.md`](./00-plan.md).
Each issue below gets its own detailed file under [`issues/`](./issues/), using
the same two-digit prefix. Tasks here are intentionally coarse — one paragraph
of intent per issue; acceptance criteria and detail live in the issue files.

Ordering reflects dependencies: foundation first, then domain features, then
platform concerns.

| #   | Issue                         | Depends on |
| --- | ----------------------------- | ---------- |
| 00  | Project scaffolding & tooling | —          |
| 01  | Persistence & data layer      | 00         |
| 02  | Feed fetch & parse engine     | 01         |
| 03  | Source management             | 01, 02     |
| 04  | Categories, types & tagging   | 03         |
| 04b | Simplify classification       | 04         |
| 05  | Subfeeds                      | 03, 04b    |
| 06  | Composed feeds                | 03, 05     |
| 07  | Shared content views          | 02, 03     |
| 07b | Tag include/exclude           | 07         |
| 08  | Bookmarks                     | 07         |
| 09  | Managed sources from config   | 03, 05     |
| 10  | Export & import               | 03, 06, 08 |
| 11  | Settings & theming            | 00         |
| 12  | Feed generator (no-RSS sites) | 02, 03     |
| 13  | Homepage                      | 07, 08     |

---

## 00 — Project scaffolding & tooling

Initialise the Nuxt (TypeScript, SSR) app with pnpm; wire up Nuxt UI, Pinia,
ESLint, Prettier, Vitest + Nuxt Test Utils, and a Docker / Docker Compose setup.
Establish project structure and a CI-friendly `lint`/`test`/`build` baseline so
every later issue lands on a working foundation.

## 01 — Persistence & data layer

Introduce SQLite + Drizzle with drizzle-kit migrations. Model the core domain
(sources, tags, subfeeds, feeds, items, bookmarks, settings)
and expose a typed data-access layer the server routes build on.

## 02 — Feed fetch & parse engine

Server-side fetching and parsing of RSS/Atom into a normalised `Item` shape,
with a reusable pagination abstraction driving standard and custom query params.
Includes item caching and the foundation for _search-until-found_ paging.

## 03 — Source management

Full CRUD (add / list / edit / remove) for sources across API, Pinia store and
UI, including per-source pagination and custom query-param configuration. First
end-to-end vertical slice tying persistence, engine and UI together.

## 04 — Categories, types & tagging

Let users classify sources by category/type and apply free-form tags; surface
grouping and tag-based filtering in the source list. Partly superseded by 04b.

## 04b — Simplify classification

Collapse the overlapping classification axes onto **tags** alone: drop
`sources.type` (no behaviour — the engine branches on `pagination`), the
`categories` table (tags subsume it; composed feeds cover reading-time grouping),
and the unused `subfeeds.columnParam`. Re-key the source list's grouping onto
tags.

## 05 — Subfeeds

Derive named subfeeds from a source using extra query params merged over the
parent's, and manage (add / list / edit / remove) plus refresh them under their
parent source. A "column" is simply a subfeed — the distinguishing value can sit
inside a JSON-encoded param, which the old `columnParam` model could not express;
showing siblings side-by-side is a view concern in issue 07.

## 06 — Composed feeds

Create and manage feeds that aggregate items from multiple sources (and
subfeeds), with merge + de-duplication of normalised items into one stream.

## 07 — Shared content views

A reusable view layer for sources, subfeeds and feeds providing filtering,
automatic sorting, title/description search, and search-until-found pagination
with a configurable max-page cap, in three layouts (list, grid, editorial). No
drag-and-drop here. Extracts item images from the several competing feed
conventions (`media:thumbnail`, `media:content`, `image/*` enclosures, …) so the
image-led layouts have something to show. Also settles what 05 and 06 deferred
here: an `item_subfeeds` join so a subfeed view (and a subfeed-narrowed feed
member) shows only its own items, and sibling subfeeds side-by-side as columns.

## 07b — Tag include/exclude

Extend 07's include-only tag filter so a tag can also be **excluded** — muting
"Sport" rather than only selecting for it. Split out from 07's follow-up fixes
because it is the one change there that touches the query contract itself: the
schema field, the URL format, the view-layer predicate and the toolbar control
move together. Inclusion stays AND, exclusion is OR, and exclusion wins on a tag
set to both.

## 08 — Bookmarks

Manage a list of bookmarks with filtering, automatic sorting, and manual
drag-and-drop ordering persisted per bookmark. Bookmark any item from a source,
subfeed or feed view.

## 09 — Managed sources from config

Load app-**maintainer**-managed sources from a config file (URL, pagination,
custom params, item tags, subfeeds), reconciled on startup; the user chooses which
to load into their own sources list. Designed to grow into per-source plugin-style
handling of individual sources' quirks, and reserves schema seams for later
scraping / TTS.

A managed source can additionally declare its filtering API **natively**: a
**query template** (Handlebars) that renders the source's filter param, plus a
**filter schema** of allowed values per template variable. Authoring a subfeed of
such a source then becomes a form of labelled selects instead of a hand-typed
JSON blob — for telex.hu, picking site `g7` renders
`filters={"superTagSiteSlugs":["g7"],…}` for you. Both fields are system-defined
and config-only; rendering happens at save time into the existing `queryParams`,
so the feed engine is untouched.

Users cannot create or edit managed sources, and the planned _"save as managed"_
promotion is **dropped**: `managed` is written only by the config loader (see
04b). Once export exists (issue 10), a small script can lift a source's properties
out of an export into the config file, which covers the same need without a
user-facing write path.

## 10 — Export & import

Export sources, feeds, bookmarks and settings to a portable file and import them
back, with validation and sensible merge/replace behaviour.

## 11 — Settings & theming

App settings (default page size, search cap, …) plus light (beige) and dark
(dark brown) themes with persisted user preference. Also the **editorial
layout's column ratio**: issue 07 hard-codes an even three-column split, and the
whole point of that layout is uneven emphasis, so the ratio (33/33/33, 25/50/25,
…) belongs in settings alongside the default layout mode.

## 12 — Feed generator (no-RSS sites)

User-facing: turn an ordinary HTML listing page into a normalised item stream for
sites that publish no feed. The user gives a URL, a CSS selector for the item
list, and selectors for each item's link and title, with description, image and
date optional. A second parser behind the engine's existing
`body -> ParsedItem[]` seam, so caching, pagination, search-until-found, subfeeds,
composed feeds and the issue 07 views all apply unchanged. A selector-preview
endpoint makes authoring selectors tractable. No headless browser, and no
article-content extraction — listing metadata only.

## 13 — Homepage

Give the homepage a purpose — it is currently a title and a tagline, so the first
thing the app shows says nothing about what is in it. Placeholder issue: the
direction (dashboard vs. reading surface) is deliberately undecided, and the
issue file records the questions to settle first, including whether "all items
across every source" should become a real view kind.
