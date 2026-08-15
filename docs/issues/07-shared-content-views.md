---
id: "07"
title: Shared content views
description: >-
  One reusable view layer — filtering, sorting, title/description search,
  paging and item images, in list / grid / editorial modes — shared by source,
  subfeed and feed pages, plus search-until-found escalation to the network
  with a configurable page cap.
status: done
dependencies: ["02", "03"]
affects: [app, server, db, tests]
---

# 07 — Shared content views

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Turn the cached `items` table into something you actually read. Issues 03, 05
and 06 each ended at "configuration plus refresh"; the only item rendering that
exists today is the unfiltered list at the bottom of the feed detail page
(`app/pages/feeds/[id].vue:190`). This issue builds **one** view layer — filter
by tag and (for feeds) by member source, sort, search title + description, page
through the result, show each item's image — and uses it unchanged for a source,
a subfeed and a feed, in three swappable layouts (list, grid, editorial). When a
cached search comes up empty on a paginated source, the same view offers
_search-until-found_: walk further pages over the network through the existing
pagination engine, caching what it fetches, up to a configurable page cap.

**Depends on:** 02 (feed fetch & parse engine), 03 (source management) — both
done, as are 05 and 06, whose views this issue also owns.

**This issue closes the subfeed↔item gap that 05 and 06 deferred to it.** Issue
05 chose not to persist which subfeed an item arrived through and named issue 07
as the owner of "any persisted subfeed↔item association if cached filtering
proves necessary" (its "Out of scope"); issue 06 then had to collapse feed
members to distinct source ids and put a caveat in the UI
(`app/pages/feeds/[id].vue:176`). Cached filtering is now necessary — a subfeed
view that silently shows its parent's full item set is not a subfeed view — so
task 1 adds the join table, and the caveat alert comes out.

**Item images extend the engine (task 2), not just the UI.** A grid or editorial
layout without images is pointless, and nothing currently extracts them, so this
issue widens `ParsedItem`/`items` by one column and teaches `parse.ts` the
several competing image conventions. That is issue 02's territory, brought
forward here because it is what the views need; if it wants to land separately
it splits cleanly into its own issue with no other task depending on it beyond
the layouts.

## Tasks

### 1. Persist which subfeed an item arrived through

Additive join table in `server/db/schema.ts`, alongside `sourceTags`
(`server/db/schema.ts:48`) as the shape to follow:

```ts
export const itemSubfeeds = sqliteTable(
  'item_subfeeds',
  {
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    subfeedId: integer('subfeed_id')
      .notNull()
      .references(() => subfeeds.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.subfeedId] })],
)
```

- Items keep caching under the **parent** `sourceId` — issue 05's decision and
  the `items_source_guid_unique` index (`server/db/schema.ts:127`) are
  unchanged. This table only records the additional fact "this cached row was
  also seen through subfeed X", so an item can belong to several sibling
  subfeeds.
- `server/db/repositories/items.ts` gains `linkItemSubfeed(itemId, subfeedId)`
  (insert, `onConflictDoNothing` — a refresh re-sees the same items every run)
  and `itemsForSubfeed(subfeedId)`.
- `server/feed/refresh.ts#refreshTarget` takes the subfeed id it is refreshing
  for (`refreshSubfeed` passes it, `refreshSource` doesn't) and calls
  `linkItemSubfeed` with each `upsertItem` result. `upsertItem` already returns
  the row (`server/db/repositories/items.ts:39`), so no extra read.
- New table, no column drops — `pnpm db:generate` emits a plain `CREATE TABLE`,
  not the table-recreate dance. Still read the generated SQL once.
- **Rows cached before this migration have no join rows**, so a subfeed view is
  empty until its next refresh. Don't backfill (there is no way to know which
  subfeed an old row came through): the subfeed empty state says "refresh to
  populate this view", and per CLAUDE.md a local
  `rm data/knowbook.sqlite*` + `pnpm db:seed` reset is equally acceptable.

Then narrow the two places that had to over-read:

- `server/feed/compose.ts#feedItems` — resolve each member individually
  (`itemsForSubfeed` when `subfeedId` is set, `itemsForSource` otherwise) and
  de-duplicate by **item id** across members, since a whole-source membership
  and a subfeed-of-that-source membership legitimately overlap. The
  collapse-to-distinct-`sourceId` shortcut and its comment go away.
- `app/pages/feeds/[id].vue` — drop the "Subfeed members show their parent
  source's items" alert and the per-member `shows the whole source's items`
  badge.

### 2. Item images — one column, several feed conventions

**There is no single standard thumbnail tag.** Extraction is therefore a
precedence ladder in `server/feed/parse.ts`, tried in this order and stopping at
the first usable absolute `http(s)` URL:

1. `<media:thumbnail url="…"/>` — Media RSS
   (`xmlns:media="http://search.yahoo.com/mrss/"`), the only element actually
   meant for thumbnails.
2. `<media:content url="…" medium="image" type="image/*"/>` — same namespace;
   may repeat and may sit inside `<media:group>`. Prefer `isDefault="true"`,
   else the first entry whose `medium` is `image` or whose `type` starts
   `image/`.
3. `<enclosure url="…" type="image/jpeg" length="0"/>` — RSS 2.0 core, and
   **the telex.hu case**. Filter on `type` starting `image/`: enclosures also
   carry podcast audio and video, and an `audio/mpeg` URL in an `<img>` is a
   broken image. The spec makes `length` required and single-enclosure-per-item;
   real feeds ignore both (telex sends `length="0"`), so treat `length` as
   noise and accept repeated enclosures.
4. `<itunes:image href="…"/>` — podcast feeds. Note `href`, not `url`.
5. Atom: `<link rel="enclosure" type="image/*" href="…"/>`, picked out of the
   `links` array `mapAtomEntry` already builds
   (`server/feed/parse.ts:79`); Atom feeds also commonly carry `media:*`, so
   steps 1–2 apply to them unchanged.
6. `<image><url>…</url></image>` **inside** an item — non-standard (RSS 2.0
   defines `<image>` at channel level only) but present in the wild.

Deliberately **not** in the ladder: scraping the first `<img src>` out of
`description` / `content:encoded`. It needs HTML parsing in a module that
currently only walks XML nodes, and it is the variant that yields tracking
pixels and 1×1 spacers. Out of scope, noted below.

Implementation notes:

- `items.imageUrl` — `text('image_url')`, nullable. One column, no
  width/height: only MRSS supplies dimensions, so a column that is null for
  most feeds buys nothing the CSS can't do with a fixed `aspect-ratio` crop.
- `ParsedItem` is `Pick<NewItem, …>` (`server/feed/parse.ts:5`), so add
  `'imageUrl'` there and the type flows end-to-end.
- **`upsertItem`'s update set must list `imageUrl`**
  (`server/db/repositories/items.ts:43`) — it enumerates columns explicitly, so
  omitting it would mean already-cached rows never gain an image no matter how
  often they are refreshed. That same enumeration is the backfill: one refresh
  populates images for existing items.
- Add `enclosure` and `media:content` to `ARRAY_TAGS`
  (`server/feed/parse.ts:10`) — both can repeat. No other parser-config change:
  `ignoreAttributes: false` plus the default (namespace-preserving) key naming
  already surface `media:thumbnail` as `'media:thumbnail'` with `@_url`.
- Factor the ladder into one `itemImageUrl(node)` helper used by both
  `mapRssItem` and `mapAtomEntry`, rather than duplicating it per format.
- Reject relative and non-`http(s)` URLs (`data:` included) at parse time, so
  the view layer can render `item.imageUrl` without re-validating.
- Images are **hotlinked** from the origin: `<img>` fetches don't hit CORS, so
  the "browser only talks to our own API" rule (CLAUDE.md) doesn't force a
  proxy here. Render with `loading="lazy"`, `decoding="async"` and
  `referrerpolicy="no-referrer"`, and hide the element on `error` rather than
  showing a broken frame. A caching `/api/images?url=` proxy is out of scope.

### 3. The query contract

`shared/schemas/itemQuery.ts` — one schema, used by every view route:

- `q` — `z.string().trim().min(1).optional()`; matched case-insensitively
  against title **and** description.
- `tags` — `z.array(z.string().min(1))`, coerced from a repeated or
  comma-separated query param; AND semantics (an item must carry every selected
  tag), matching the source list's tag filter (`app/pages/sources/index.vue:30`).
- `sourceIds` — `z.array(z.number().int().positive())`, meaningful only on a
  feed view (narrow to some members); ignored elsewhere.
- `sort` — `z.enum(['newest', 'oldest', 'title', 'fetched']).default('newest')`.
- `page` — `z.coerce.number().int().min(1).default(1)`.
- `pageSize` — `z.coerce.number().int().min(1).max(200).optional()`; unset means
  the settings default (task 6).

These arrive as URL query params, not a JSON body, so coercion is part of the
schema rather than something routes do by hand. The layout mode is **not** in
here — it changes nothing about which items the server returns (task 11).

Add
`searchQuerySchema = itemQuerySchema.extend({ maxPages: … }).required({ q: true })`
for the deep-search route (task 8): a search-until-found with no `q` is
meaningless.

`shared/types/domain.ts` gains the response shapes:

```ts
export interface ItemPage<T> {
  items: T[]
  total: number // matches before paging
  page: number
  pageSize: number
  pageCount: number
}

/** Distinct values present in the *unfiltered* set, for the toolbar's selects. */
export interface ItemFacets {
  tags: string[]
  sources: { id: number; title: string }[]
}
```

### 4. The view layer

`server/feed/view.ts` — a pure function, the single implementation all three
view kinds share:

`applyItemView(items: Item[], query: ItemQuery, pageSize: number): ItemPage<Item> & { facets: ItemFacets }`

- Filter (`q`, `tags`, `sourceIds`) → sort → slice one page; `total` is the
  post-filter, pre-slice count.
- `sort: 'newest'` reuses the comparator `compose.ts` already got right
  (`byPublishedAtDesc`, `server/feed/compose.ts:15`, undated items last) —
  **move** it here and have `compose.ts` import it rather than keeping two
  copies. `'oldest'` inverts it but keeps undated last (not first);
  `'title'` is `localeCompare`; `'fetched'` is `fetchedAt` descending.
- Facets come from the pre-filter set, so filtering to one tag doesn't empty the
  tag select.
- Filtering and sorting happen **in JS over the full cached set**, not in SQL.
  `items.tags` is a JSON column and `feedItems` already materialises every
  member's rows, so pushing this into SQL would mean either JSON1 predicates or
  three divergent queries for one behaviour; at single-user cache sizes the
  in-memory pass is the simpler correct thing. If it ever stops being, the seam
  to change is this one function plus the repository reads behind it — note that
  in a comment rather than pre-optimising (an FTS5 index is the escape hatch).
- Nothing here knows whether it was given a source's, a subfeed's or a feed's
  items, and nothing here knows about layout: images are just another column on
  the rows it passes through.

Export from `server/feed/index.ts`.

### 5. Repository reads per view kind

`server/db/repositories/items.ts` already has `itemsForSource`; task 1 adds
`itemsForSubfeed`. The feed case stays in `compose.ts#feedItems` (it needs
membership). No batched hydration helpers needed: a view reads exactly one
target's items.

For facets on a feed view the route needs member source titles — `feedMembers`
plus the existing `getSource` per row, as `GET /api/feeds/:id` already does
(issue 06 task 2's reasoning: few members, no join).

### 6. Settings-backed defaults

`server/utils/settings.ts` — small typed readers over the existing
`getSetting` (`server/db/repositories/settings.ts:10`), which returns an
untyped `SettingValue`:

- `pageSizeSetting()` — key `pageSize`, fallback `25`.
- `searchMaxPagesSetting()` — key `searchMaxPages`, fallback
  `DEFAULT_MAX_PAGES` (`server/feed/pagination.ts:5`), so the engine keeps one
  default and this only overrides it.

Both clamp to the same bounds the schemas enforce and ignore a non-number
stored value rather than throwing. Issue 11 adds the UI that writes these keys
(and the default layout mode, task 11); nothing seeds them here — the fallbacks
are the behaviour until then.

### 7. Search-until-found, caching what it fetches

`searchUntilFound` (`server/feed/search.ts:12`) walks pages and returns matches
but never touches the DB, and has no callers outside its tests — so a deep
search today would re-fetch the same pages on every query. Fold it into the
walk-and-upsert loop instead of adding a third page-walking path:

- `refreshTarget` (`server/feed/refresh.ts:44`) gains an optional
  `until?: (item: ParsedItem) => boolean`: when supplied, stop after the first
  page containing a match and report `matched` alongside the counts. Everything
  else — page iteration, upsert, dedupe, the new subfeed linking — is reused
  as-is.
- Rewrite `search.ts`'s export on top of it:
  `searchAndCache(target, sourceId, predicate, opts): Promise<{ matched, pagesSearched, capHit, counts }>`.
  It no longer returns `ParsedItem`s — the caller re-reads the cache, which is
  the point of caching. Keep the `capHit` semantics the current implementation
  documents (`server/feed/search.ts:33`: only when the cap was actually
  exhausted, not when the feed simply ran out).
- `searchTarget` entry points mirroring refresh: source, subfeed (via
  `subfeedTarget`, so the link rows land), and feed (loop its members, as
  `refreshFeed` does at `server/feed/refresh.ts:134`, and aggregate).
- `tests/feed/search.spec.ts` adapts to the new signature (it already injects
  `fetchImpl`; it now also needs `createTestDb()`).

The predicate the routes pass is the **same** title/description match the view
layer filters with — factor it out of `applyItemView` as
`matchesQuery(item, q)` over the fields both a `ParsedItem` and an `Item`
carry, so cached and network search can never disagree about what "found"
means.

### 8. HTTP API routes

Cache reads are `GET`; search-until-found is a `POST`, because it fetches and
upserts:

- `GET /api/sources/:id/items` — 404 when the source is missing.
- `GET /api/subfeeds/:id/items` — 404 when the subfeed is missing.
- `GET /api/feeds/:id/items` — **extend the existing route**
  (`server/api/feeds/[id]/items.get.ts`) to validate the query and run it
  through the view layer instead of returning the raw stream. Issue 06's
  unfiltered contract was explicitly a base for this issue to build on.
- `POST /api/{sources,subfeeds,feeds}/:id/search` — validate with
  `searchQuerySchema`, run task 7's entry point with
  `maxPages ?? searchMaxPagesSetting()`, then return the same
  `ItemPage`-plus-facets payload the `GET` would, wrapped with the search meta:
  `{ page, search: { matched, pagesSearched, capHit, counts } }`. Mirror the
  not-found translation in `server/api/sources/[id]/refresh.post.ts`.

All three `GET`s return `ItemPage<Item> & { facets: ItemFacets }`. Validate with
`getValidatedQuery` + the task 3 schema, 400 with `parsed.error.issues` on
failure, as `members.post.ts` does for bodies
(`server/api/feeds/[id]/members.post.ts:29`). Routes stay thin.

### 9. Store

`app/stores/items.ts` — `useItemsStore`, keyed by view so three pages can share
one store without stomping each other:

- `views: Record<string, ItemPage<Item> & { facets: ItemFacets }>` keyed
  `source:1` / `subfeed:2` / `feed:3`, plus `loading` / `error` / `errorStatus`
  in the `app/stores/feeds.ts` shape.
- Actions `fetchItems(view, query)` and `searchDeep(view, query)`, both taking a
  discriminated `{ kind: 'source' | 'subfeed' | 'feed'; id: number }` so the URL
  is built in one place, and `lastSearch: Record<string, SearchMeta>` for the
  cap-hit notice.
- Typed against the shared types and `ItemQueryInput`; `$fetch` +
  `errorMessage(cause)` / `errorStatus(cause)`, no `any`.

### 10. UI — the shared view, used three times

- **`app/composables/useItemView.ts`** — owns the reactive `ItemQuery` **and**
  the layout mode, syncs both to the page's URL query (so a filtered view in
  grid mode is linkable and survives reload), resets `page` to 1 whenever a
  filter/sort/search changes — but **not** when only the mode changes, which is
  purely presentational — and calls the store.
- **`app/components/items/ItemViewToolbar.vue`** — search input (debounced),
  tag `USelectMenu` (multiple, from `facets.tags`), source `USelectMenu` shown
  only when `facets.sources.length > 1`, sort `USelect`, page-size `USelect`,
  and the mode switch (task 11). Emits query patches; holds no fetch logic.
- **`app/components/items/ItemCard.vue`** — one item, rendered for whichever
  mode is active: image (when `item.imageUrl`), title as a link when
  `item.link` is set, source label, published date, item tags as badges. The
  mode is a prop that decides whether the image leads (grid/editorial) or sits
  inline/absent (list) — one component, not three, so a field added to an item
  shows up everywhere at once.
- **`app/components/items/ItemList.vue`** — the container: the item cards
  currently inlined in the feed page (`app/pages/feeds/[id].vue:192`),
  extracted, plus the per-mode layout wrapper (task 11). Takes an optional
  `sourceTitles` map for the label; Nuxt UI empty / loading / error states.
- **`app/components/items/ItemPager.vue`** — `UPagination` over `total` /
  `pageSize`, plus the "no cached match" affordance: when `q` is set and
  `total === 0`, a **"Search further pages"** button calling `searchDeep`, and
  after it runs a line reporting pages searched and, when `capHit`, that the cap
  was reached and how to raise it (issue 11's setting). Non-paginated targets
  (no `pagination.pageParam`) never show the button — there are no further pages
  to walk.
- **Pages** — `app/pages/sources/[id]/items.vue` and
  `app/pages/subfeeds/[id].vue` (a subfeed's first page of its own: name, parent
  context, effective params link back to
  `app/pages/sources/[id]/subfeeds.vue`), and `app/pages/feeds/[id].vue`
  refactored to use the same components in place of its inline list.
- **Entry points** — "Items" in the source-list row menu
  (`app/pages/sources/index.vue:141`) and on each subfeed row of the subfeeds
  page. Adding a row-menu entry needs no new column, so the `table-fixed`
  widths there stay untouched.

### 11. View modes — list, grid, editorial

A `mode` on `ItemList`, switched from the toolbar, defaulting to `list` (today's
behaviour) with the default overridable from settings later (issue 11):

- **`list`** — what exists now: one row per item, image as a small leading
  thumbnail when present, text-first. The mode that stays readable for a
  text-only feed.
- **`grid`** — uniform cards in a responsive grid, image on top under a fixed
  `aspect-ratio` crop (`object-fit: cover`), title and date below. Items with
  no image get a neutral placeholder block rather than a shorter card, so the
  grid stays a grid.
- **`editorial`** — multiple columns with uneven item heights: CSS
  `columns` (or `grid-template-rows: masonry` behind a feature check, falling
  back to `columns`) so images keep their natural aspect ratio and text lengths
  differ. No JS masonry library.

Constraints worth writing down: the mode is client-only (never sent to the API,
never in `itemQuerySchema`), all three modes render the same `ItemCard` with the
same data, and no mode may reorder or hide items — that's the view layer's job,
not the layout's. Empty and loading states are shared across modes, not
re-implemented per mode.

**Naming, to avoid a collision with task 12:** the multi-column *layout* is
`editorial`; "columns" in this project already means sibling subfeeds
side-by-side (issue 05's language). Don't reuse the word for the layout.

### 12. Sibling subfeeds side-by-side

Issue 05 assigned "displaying sibling subfeeds side-by-side as columns" here,
and task 1 is what makes it possible. Keep it small: a **By subfeed** toggle on
`app/pages/sources/[id]/items.vue` that renders one `ItemList` per subfeed of
the source in a horizontally scrolling row, each headed by the subfeed name and
count. One shared query and one shared mode drive every column (the toolbar
filters/sorts/searches all of them alike); each column is a separate store view
(`subfeed:N`), so this is a layout over existing pieces, not a fourth code
path.

## Testing

- **DB** (`tests/db/items.spec.ts`, new): against `createTestDb()` —
  `linkItemSubfeed` is idempotent for a repeated `(itemId, subfeedId)`;
  `itemsForSubfeed` returns only linked rows and excludes sibling subfeeds'
  items; `upsertItem` updates `imageUrl` on an already-cached row (the backfill
  path); add to `tests/db/constraints.spec.ts` that deleting an item **and**
  deleting a subfeed each cascade their `item_subfeeds` rows, following the
  existing cascade cases (`tests/db/constraints.spec.ts:52`).
- **Parsing** (`tests/feed/parse.spec.ts`): one fixture per rung of task 2's
  ladder in `tests/feed/fixtures.ts` — `media:thumbnail`; `media:content` with
  several entries where only one is an image; an `<enclosure type="image/jpeg"
  length="0">` **modelled on the real telex.hu item**; an
  `<enclosure type="audio/mpeg">` that must yield `imageUrl: null`;
  `itunes:image` with `href`; an Atom `<link rel="enclosure" type="image/png">`;
  and precedence when a single item carries both `media:thumbnail` and an
  `enclosure`. Plus: a relative or `data:` URL is rejected, and an item with no
  image parses to `null` rather than `undefined` (it goes straight into a
  `NewItem`).
- **View layer** (`tests/feed/view.spec.ts`, new): pure-function tests, no DB —
  `q` matches title and description case-insensitively and ignores non-matches;
  `tags` is AND not OR; each `sort` orders as specified with undated items last
  in both `newest` and `oldest`; `total` counts pre-slice while `items` is one
  page; the last page is short rather than padded; `page` beyond `pageCount`
  yields an empty page rather than throwing; facets come from the unfiltered set.
- **Engine** (`tests/feed/`): `refreshSubfeed` writes link rows under the parent
  `sourceId` and a second run adds no duplicates (extend
  `tests/feed/refresh.spec.ts`); `feedItems` returns a subfeed member's items
  only, and returns one copy of an item shared by a whole-source and a
  subfeed membership of the same source (rewrite that case in
  `tests/feed/compose.spec.ts`, which currently asserts the collapse
  behaviour); `searchAndCache` stops at the page carrying the match, caches
  every page it fetched, reports `capHit` only on cap exhaustion, and yields
  one page for a non-paginated target — fixture `fetchImpl` throughout, so
  tests stay offline.
- **Server** (`tests/api/items.spec.ts`, new): h3 router + mocked
  repositories/engine in the style of `tests/api/feeds.spec.ts` — each `GET`
  returns a paged result and 404s for an unknown target; an invalid `sort` or a
  `pageSize` over the cap is a 400; `pageSize` absent falls back to the setting;
  repeated and comma-separated `tags` params both parse; a `mode` param is
  ignored rather than 400ing (it's client-only, and old links shouldn't break);
  the `POST /search` routes forward `maxPages` and surface `capHit`; a
  `POST /search` without `q` is a 400.
- **Store** (`tests/stores/items.spec.ts`): per-view keying keeps two views
  independent; a failed fetch sets `error`/`errorStatus` and leaves the previous
  page in place rather than blanking it.
- **Component** (`tests/nuxt/`): `ItemViewToolbar` emits the expected query
  patches and hides the source select for a single-source facet set;
  `ItemCard` renders an image only when `item.imageUrl` is set, a link only when
  `item.link` is set, and a placeholder instead of a short card in `grid` mode;
  switching mode doesn't reset `page` while changing a filter does;
  `ItemPager` shows "Search further pages" only for a paginated target with `q`
  set and no matches.

## Acceptance criteria

- A source, a subfeed and a feed each have an items view with the same
  filtering (tags, and member source on a feed), sorting, title/description
  search and paging, backed by one server-side implementation and one set of
  UI components.
- A subfeed's view shows only items that arrived through that subfeed; a feed
  member narrowed to a subfeed contributes only that subfeed's items, and the
  issue-06 caveat alert is gone from the feed page.
- An item seen through both a source and one of its subfeeds is stored once and
  appears once in a feed that includes both.
- Item images are extracted from `media:thumbnail`, `media:content`, an
  `image/*` `enclosure` (the telex.hu shape, `length="0"` and all),
  `itunes:image`, an Atom `image/*` enclosure link, and an item-level
  `<image><url>`, in that precedence order; a non-image enclosure never becomes
  an image; refreshing an already-cached item backfills its image.
- The three layouts (list, grid, editorial) render the same items and the same
  card data, switch from the toolbar without refetching or reordering, and
  survive a reload via the URL.
- Searching a paginated source with no cached match offers "search further
  pages", walks the network through the existing pagination engine up to the
  configurable cap, caches what it fetched (so the same search is instant next
  time), and says plainly when it stopped at the cap. Non-paginated sources
  don't offer it.
- Page size and the search cap come from settings with documented fallbacks
  (25 and `DEFAULT_MAX_PAGES`), not from hard-coded literals in routes or
  components.
- A filtered/sorted view is linkable: its query lives in the URL and survives
  reload.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass; runs under Docker
  Compose.

## Out of scope

- Bookmarking from any of these views, and drag-and-drop ordering — issue 08,
  which reuses `ItemCard`/`ItemList` for the bookmark list.
- Scraping an image out of `description` / `content:encoded` HTML, and
  channel-level `<image>` / `itunes:image` as a per-source fallback logo — both
  deferred until a real feed in use needs them (see task 2's reasoning).
- Proxying, resizing or caching image binaries (`/api/images?url=`): images are
  hotlinked from the origin, lazily and without a referrer.
- Storing image dimensions: only MRSS supplies them, and the layouts use a CSS
  `aspect-ratio` crop instead.
- Per-column independent queries, modes or paging in the side-by-side subfeed
  layout (task 12) — one shared query drives every column.
- Read/unread state, or any per-item state beyond bookmarks.
- SQL/FTS5-level search and filtering: the in-memory pass in
  `server/feed/view.ts` is deliberate and is the single seam to replace if cache
  sizes ever justify it.
- Backfilling `item_subfeeds` for items cached before task 1's migration —
  impossible to derive; a refresh (or a local DB reset) populates it.
- Settings **UI** for page size, the search cap and the default layout mode —
  issue 11; this issue only reads the keys.
- Scheduled/background refresh, so views never fetch on load — issue 09+.

## Known issues

**Sorting by `oldest` failed once and has not reproduced.** Reported as a few
seconds of loading followed by an error reading `undefined`. Not reproducible
afterwards: all four sorts return 200 in ~0.2s from
`GET /api/sources/:id/items?sort=…`, and selecting Oldest in the browser rendered
correctly with an empty console. Cached data was ~760 rows at the time, so the
delay was not the in-memory pass in `server/feed/view.ts` straining.

The message is the useful clue if it recurs: `app/utils/errorMessage.ts`
stringifies `statusMessage`, so a literal `undefined` means the server returned an
error carrying none — i.e. an unhandled throw surfacing as a bare 500 rather than
one of the `createError` paths the routes use. Check the Nitro server log rather
than the browser console.

## Follow-ups applied after completion

- `UPagination` was wired to a non-existent `pageCount` prop (it takes
  `itemsPerPage`, default 10), so pagers derived their page count as if every
  response held 10 items. The sliding sibling window hid this on page 1.
- `grid` mode reserved its image slot unconditionally, putting a placeholder on
  every card of a view where nothing has an image; `ItemList` now decides per view.
- The toolbar/pager/list trio moved into `app/components/items/ItemView.vue`,
  which also gained a top pager and an in-view Refresh button; the layout switch
  became three icon buttons rather than a select.
- Side-by-side subfeed columns became fixed-width (they compressed instead of
  scrolling), and their counts now appear only when a filter is narrowing them.
