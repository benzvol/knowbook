---
id: "12"
title: Feed generator for sites without RSS
description: >-
  Turn an ordinary HTML listing page into a normalised item stream: the user
  gives a URL, a selector for the item list, and selectors for each item's link,
  title and optional description, image and date. Scraped sources are then
  ordinary sources everywhere else in the app.
status: todo
dependencies: ["02", "03"]
affects: [app, server, db, tests]
---

# 12 — Feed generator for sites without RSS

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Plenty of sites worth following publish no feed at all. Let the user point
Knowbook at an HTML listing page and describe where the items are with CSS
selectors — item container, link, title, and optionally description, image and
date — and get the same normalised `Item` rows an RSS source produces. A scraped
source is then an ordinary source: it has subfeeds, joins composed feeds, appears
in the shared views from issue 07, is searchable and bookmarkable, with no
special-casing anywhere above the parser.

Worked examples, all real pages with no feed (Hungarian Integrity Authority):

- `https://integritashatosag.hu/hirek/hirek/` — news
- `https://integritashatosag.hu/hirek/blog/` — blog
- `https://integritashatosag.hu/ugyek/vizsgalatok/lezart-vizsgalatok/` — closed
  investigations

**Depends on:** 02 (feed fetch & parse engine), 03 (source management).

**This is user-facing**, unlike issue 09's managed sources: the user authors the
selectors through the source form.

**The one architectural insight:** the engine's real seam is
`response body -> ParsedItem[]`. `fetch.ts` already returns a body without caring
what it contains, and `pagination.ts`, `refresh.ts`, `search.ts`, `compose.ts`
and `view.ts` all operate on `ParsedItem`/`Item` and never on XML. So a scrape
config is a **second parser behind the existing seam**, not a second pipeline —
caching, deduplication, pagination, search-until-found, subfeed linking and the
whole view layer come along for free.

## Tasks

### 1. Scrape config on a source

- `sources.scrape` — nullable JSON column, `text('scrape', { mode: 'json' })
  .$type<ScrapeConfig>()`. **Presence of `scrape` is what makes a source
  scraped**; no separate `kind` enum. One nullable column carrying one meaning
  beats two columns that can contradict each other (`kind: 'scrape'` with a null
  config, or vice versa), and it needs no backfill for existing rows.
- `shared/types/domain.ts` gains the hand-written structural types, alongside
  `PaginationConfig` and `QueryParams` and for the same reason — they back both
  the Drizzle JSON column and the Zod schema without a runtime dependency:

  ```ts
  /** Where to find one field within an item element. */
  export interface FieldSelector {
    selector: string
    /** Attribute to read (`href`, `src`, `datetime`, …). Omit for text content. */
    attr?: string
  }

  export interface ScrapeConfig {
    /** Selects each item's container element. */
    itemSelector: string
    /** Required: without a resolvable link an item has no stable identity. */
    link: FieldSelector
    title: FieldSelector
    description?: FieldSelector
    image?: FieldSelector
    date?: FieldSelector & { format?: string }
  }
  ```

- `shared/schemas/source.ts` gains `scrapeSchema` and admits
  `scrape: scrapeSchema.nullable().optional()` on create/update. Unlike
  `managed`, this **is** client-writable — the user authors it.

### 2. The HTML parser (`server/feed/scrape.ts`)

`parseScrape(body: string, config: ScrapeConfig, pageUrl: string): ParsedItem[]`
— the mirror of `parseFeed`, returning the identical shape.

- **Needs a real CSS selector engine.** `fast-xml-parser` walks XML nodes and
  cannot do this. `pnpm add cheerio` — the most widely used, best selector
  coverage, tolerant of the malformed markup real pages ship. Alternatives worth a
  sentence in the commit if rejected: `linkedom` (a truer DOM, lighter) and
  `node-html-parser` (fastest, least spec-faithful).
- **`guid` is the resolved absolute link.** Scraped items have no guid, and
  `mapRssItem` already falls back to link when guid is absent, so
  `items_source_guid_unique` on `(sourceId, guid)` keeps working with **no schema
  change** and dedupes re-scrapes correctly.
- **Resolve relative URLs** against `pageUrl` with `new URL(href, pageUrl)`.
  This is deliberately the *opposite* of issue 07's rule for RSS images, which
  rejects relative URLs outright: RSS carries absolute URLs by convention and a
  relative one signals a broken feed, whereas scraped markup is relative by
  nature and resolving it is the whole job. Keep issue 07's `http(s)`-only guard
  **after** resolution, so a `javascript:` or `data:` href still yields nothing.
- **Drop items with no resolvable link**, mirroring `mapRssItem`'s drop of items
  with neither guid nor link — an item with no identity cannot be cached or
  deduplicated.
- Missing optional fields yield `null`, never `undefined`, since the result goes
  straight into a `NewItem` (the same constraint issue 07 documented for
  `imageUrl`).
- **Dates are the honestly hard part.** Prefer a machine-readable
  `<time datetime="…">` attribute when the selector points at one, fall back to
  text, and fall back to `null` when neither parses — which the view layer
  already sorts last, so a dateless scraped source degrades gracefully rather
  than throwing. Real pages print locale text (`2026. augusztus 13.`) that
  `new Date()` will not parse; the optional `format` field is the escape hatch,
  and guessing is worse than `null`.
- Text extraction trims and collapses whitespace — HTML indentation otherwise
  becomes part of every title.

### 3. Wire the parser into the existing engine

`pages()` currently hardcodes `parseFeed`. Rather than branch at every call site,
give `FeedTarget` (`shared/types/domain.ts`) an optional
`scrape?: ScrapeConfig | null` and branch **once** inside `pages()`:

- `FeedTarget` is already the structural "what to fetch" contract, so this is
  where the choice belongs.
- `subfeedTarget` (`server/feed/target.ts`) then propagates it for free, so
  **subfeeds of a scraped source work with no extra code** — a subfeed inherits
  the parent's selectors exactly as it already inherits pagination.
- `refreshSource`/`refreshSubfeed` pass `source` straight through as the target
  today, so they need no change at all.

Query-param pagination is reused as-is: many paginated listings do use
`?page=2`, so a scraped source with a `pagination.pageParam` walks pages through
the existing `buildPageUrl` and gets search-until-found for free.

### 4. Selector preview endpoint

Authoring selectors blind is miserable, and this is what makes the feature usable
rather than a guessing game.

- `POST /api/scrape/preview` — body is a URL plus a `ScrapeConfig`, response is
  the first N extracted `ParsedItem`s **and the item count**, with **no DB
  writes**. Reuses `fetchFeed` and `parseScrape` directly.
- A malformed selector is a 400 with the parser's message, not a 500; an
  unreachable page maps through the existing `isNotFoundError`/fetch error
  classification the refresh routes already use.

### 5. Source form integration

- `app/components/sources/ScrapeConfigEditor.vue`, alongside the existing
  `PaginationParamsEditor` and `QueryParamsEditor` and following their
  `v-model`-per-config-object shape.
- A source-type switch on `SourceForm.vue` — **RSS/Atom** (today's behaviour,
  the default) or **Scraped page** — showing the selector editor for the latter.
- A **Test selectors** button calling the preview endpoint and rendering the
  extracted items with the same `ItemsItemCard` the real views use, so the
  preview looks like the result.
- A scraped source needs no visible difference anywhere else: the source list,
  refresh action, subfeeds page and all issue 07 views work unchanged.

## Testing

- **Parsing** (`tests/feed/scrape.spec.ts`, new): trimmed real markup from the
  three integritashatosag.hu pages, saved as `tests/feed/fixtures/*.html` and read
  from disk — HTML fixtures are far too bulky to inline as template literals the
  way `tests/feed/fixtures.ts` does for XML. Cover: items extracted with the
  expected count and order; relative `href`/`src` resolved against the page URL;
  missing optional fields yield `null`; an item whose link selector matches
  nothing is dropped; a `javascript:`/`data:` href yields no item; an unparseable
  date yields `null`; whitespace-heavy markup yields trimmed titles.
- **Engine** (`tests/feed/refresh.spec.ts`, extended): refreshing a scraped
  source caches items under it and a second run updates rather than duplicating
  (the link-as-guid path); a subfeed of a scraped source inherits the parent's
  selectors; a paginated scraped source walks pages through `buildPageUrl`. All
  with an injected `fetchImpl`, so tests stay offline.
- **Server** (`tests/api/scrape.spec.ts`, new): preview returns extracted items
  and writes nothing to the DB; a malformed selector is a 400; a fetch failure
  maps to the same status the refresh routes produce.
- **Component** (`tests/nuxt/`): `ScrapeConfigEditor` emits a well-formed
  `ScrapeConfig`; `SourceForm` shows the selector editor only for the scraped
  type and submits `scrape: null` for an RSS source.

## Acceptance criteria

- A user can create a source from an HTML page with no feed by giving a URL, an
  item selector, and link + title selectors, with description, image and date
  optional.
- All three integritashatosag.hu pages above produce correct items — titles,
  absolute links, and images where present.
- Relative URLs are resolved against the page URL; non-`http(s)` URLs are
  rejected; an item with no resolvable link is dropped rather than cached without
  identity.
- Re-scraping the same page updates existing rows instead of duplicating them,
  via link-as-guid and the unchanged `(sourceId, guid)` unique index.
- A scraped source behaves as an ordinary source everywhere above the parser:
  subfeeds, composed feeds, the issue 07 views, filtering, sorting, search,
  paging and bookmarks all work with no scrape-specific branches.
- "Test selectors" previews the extracted items before saving, and writes nothing.
- Typed end-to-end with no `any` leaks; `pnpm test`, `pnpm lint` and `pnpm build`
  pass; runs under Docker Compose.

## Out of scope

- **JavaScript-rendered pages.** No headless browser: the fetched HTML is what
  gets parsed. A page that renders its list client-side is not supported, and
  should fail visibly in the preview rather than silently yielding zero items.
- **Article-content extraction** — following each item's link to pull the full
  article body. That remains a [`00-plan.md`](../00-plan.md) non-goal and the
  precondition for TTS; this issue scrapes *listing metadata* only.
- **Non-query-param pagination**: path-segment (`/page/2/`) and follow-the-next-link
  crawling. Query-param pagination is reused as-is; a `nextPageSelector` is the
  natural extension and the reason `pages()` should stay the only page-walking
  path.
- **Auto-discovering selectors** from a page. The user (or a later heuristic)
  supplies them; the preview endpoint is what makes authoring them tractable.
- **`robots.txt` enforcement and rate limiting.** A single-user, self-hosted
  reader refreshing on demand is not a crawler; send an honest User-Agent and
  don't add a politeness layer that would be theatre at this scale. Revisit if
  scheduled refresh (issue 09+) ever fans out.
- Per-item deduplication across *different* scraped sources — items stay scoped
  per source, exactly as RSS items are.
