---
id: "08"
title: Bookmarks
description: >-
  Bookmark any item from a source, subfeed or feed view, and read them back on
  a dedicated page with the same filtering and sorting as the item views plus a
  manual drag-and-drop order persisted per bookmark.
status: done
dependencies: ["07"]
affects: [app, server, db, tests]
---

# 08 — Bookmarks

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

The `bookmarks` table has existed since issue 01 (`server/db/schema.ts:152`) and
its repository even has a `reorderBookmarks` helper commented "used by the
bookmarks UI (issue 08)" (`server/db/repositories/bookmarks.ts:47`) — but
nothing writes to it, no route exposes it, and no UI mentions it. This issue
makes bookmarking real end to end: a toggle on every item card in the three
views issue 07 built, a `/bookmarks` page that filters and sorts the saved set
the same way those views do, per-bookmark tags, and a **manual** order the user
sets by dragging, persisted in `sortOrder`.

**Depends on:** 07 (shared content views) — done. Bookmarks are the fourth
consumer of `ItemCard`/`ItemList` and the second consumer of the query
contract, so almost all of this issue is reuse plus one genuinely new
mechanism: manual ordering.

**Manual ordering is the only part with no precedent in the codebase.** Every
other list in the app is sorted by a rule; a bookmark list is sorted by
opinion, which means a persisted position, a wire format for "move this there",
and a drag interaction. Those three are tasks 2, 5 and 9; the rest follows the
shape issue 07 already set.

## Tasks

### 1. Schema: one bookmark per item

The table needs exactly one change — a unique index:

```ts
(t) => [uniqueIndex('bookmarks_item_unique').on(t.itemId)]
```

- Without it, clicking the bookmark toggle twice on a slow connection leaves two
  rows for one item, and "is this bookmarked?" stops having an answer. With it,
  the create route turns the collision into a 409 through the existing
  `isUniqueViolation` (`server/utils/errors.ts:13`), exactly as
  `server/api/tags/index.post.ts:27` does.
- Additive: `pnpm db:generate` emits a plain `CREATE UNIQUE INDEX`, no
  table-recreate. It **will** fail on a local DB that already holds duplicate
  rows — there are none in practice (nothing writes bookmarks yet), and per
  CLAUDE.md a `rm data/knowbook.sqlite*` + `pnpm db:seed` reset is acceptable.
- No other column: no `updatedAt` (nothing displays it), no `note`, no snapshot
  of the item's title/link. Bookmarks keep cascading from `items`
  (`onDelete: 'cascade'`), so deleting a source deletes bookmarks of its items.
  That is issue 01's design and stays — but it is invisible today, so task 10
  says it out loud in the delete dialog.

`shared/types/db.ts` gains the two hydrated shapes, beside `FeedMemberDetail`:

```ts
export type BookmarkWithItem = Bookmark & { item: Item }
/** Just enough to render a toggle's state and delete without a lookup. */
export type BookmarkRef = Pick<Bookmark, 'id' | 'itemId'>
```

### 2. Repository: reads, hydration, and position arithmetic

`server/db/repositories/bookmarks.ts` keeps its existing functions and gains:

- `listBookmarksWithItems()` — inner join `bookmarks` × `items`, mapped to
  `BookmarkWithItem`, ordered `sortOrder asc, id asc`. Inner join is safe: the
  FK plus cascade means a bookmark without its item cannot exist.
- `listBookmarkRefs()` — `{ id, itemId }[]` for task 6's toggle-state endpoint.
- `getBookmarkByItemId(itemId)` — for the create route's pre-check and for
  toggling off.
- **`createBookmark` assigns the position** when the caller supplies none:
  `sortOrder = (min(sortOrder) ?? 0) - 1`, i.e. **new bookmarks go to the top**.
  Today every row would default to `0` (`server/db/schema.ts:157`) and the
  manual order would be arbitrary. Top rather than bottom because the thing you
  just saved is the thing you want to see without paging; everything else keeps
  its relative order, and negative values are harmless since any move
  resequences the whole list. An explicitly supplied `sortOrder` is still
  honoured — issue 10's import needs that.
- `moveBookmark(id, target)` where `target` is
  `{ to: 'first' } | { to: 'last' } | { to: 'after'; afterId: number } | { to: 'before'; beforeId: number }`
  (see task 3's note on `before`) — read every id in current manual order,
  splice `id` to its new place, and delegate to the existing
  `reorderBookmarks` so there is one resequencing implementation. Returns
  `undefined` when `id` (or `afterId`/`beforeId`) is unknown, so the route can
  404 without a second read.

**Why a move, not a reordered id list.** `reorderBookmarks(orderedIds)` sets
`sortOrder = index` for the ids it is given, which is only correct if it is
given *all* of them. The list is paged and filtered, so the client never holds
the full order — sending one page's ids would collide with the rows off-page.
A single move ("put this after that") is a globally meaningful statement even
when only a page is visible, and it makes "move to top/bottom" first-class
without the client having to know the last id. `reorderBookmarks` stays as the
whole-list primitive (used here and by issue 10's import).

Export the new functions through `server/db/repositories/index.ts` (it
re-exports `./bookmarks` already).

### 3. Query contract

`shared/schemas/bookmark.ts` — new file, following `shared/schemas/source.ts`'s
conventions:

```ts
export const bookmarkCreateSchema = z.object({
  itemId: z.number().int().positive(),
  tags: z.array(z.string().trim().min(1)).optional(),
})

export const bookmarkUpdateSchema = z.strictObject({
  tags: z.array(z.string().trim().min(1)).nullable(),
})

export const bookmarkMoveSchema = z.discriminatedUnion('to', [
  z.strictObject({ to: z.literal('first') }),
  z.strictObject({ to: z.literal('last') }),
  z.strictObject({ to: z.literal('after'), afterId: z.number().int().positive() }),
  z.strictObject({ to: z.literal('before'), beforeId: z.number().int().positive() }),
])
```

**Revised during implementation: a fourth variant, `before`.** The drop
arithmetic sketched in task 9 emits `{ to: 'first' }` for a drop at visual
index 0, which is only correct on the first page — on page 2+, the row
dropped at index 0 is not the global first bookmark, and `{ to: 'first' }`
would jump it to the top of the *entire* list rather than the top of the
visible page. `before` lets a page-2+ top-of-page drop anchor to the row now
second on that page instead (`{ to: 'before', beforeId: <that row> }`).

- **`sortOrder` is absent from the create schema on purpose**, the way `managed`
  is absent from `sourceCreateSchema` (`shared/schemas/source.ts:14`): position
  is server-owned, written only by `createBookmark`'s default and
  `moveBookmark`. A non-strict object, so a client that sends one has it
  stripped rather than 400'd.
- `bookmarkUpdateSchema` is strict — tags are the only user-editable field, so
  an unrecognised key is a mistake worth reporting (the `feedCreateSchema`
  reasoning, `shared/schemas/feed.ts:3`). Nullable so a bookmark's tags can be
  cleared back to `null`.

The list query extends issue 07's, rather than widening it:

```ts
export const bookmarkQuerySchema = itemQuerySchema.extend({
  sort: z.enum(['manual', 'bookmarked', 'newest', 'oldest', 'title']).default('manual'),
})
```

- `manual` is `sortOrder asc`; `bookmarked` is the bookmark's own `createdAt`
  descending ("recently saved"); `newest`/`oldest`/`title` read through to the
  item and reuse the item comparators verbatim.
- `fetched` is dropped — when an item was last re-fetched says nothing about a
  bookmark. Conversely `manual` must **not** leak into `itemQuerySchema`: an
  item view has no per-item position to sort by, and 07b's precedent is that a
  contract change stays in the schema that needs it.
- `q`, `tags`, `sourceIds`, `page` and `pageSize` are inherited unchanged, so
  the URL format, the coercion of repeated/comma-separated params, and the
  page-size bound are shared by construction. `sourceIds` is finally properly
  useful here: a bookmark list spans every source.

### 4. The bookmark view layer

New folder `server/bookmarks/` with `view.ts` exporting
`applyBookmarkView(rows, query, pageSize): ItemPage<BookmarkWithItem> & { facets: ItemFacets }`.
`ItemPage<T>` is already generic (`shared/types/domain.ts:80`) and `ItemFacets`
fits as-is, so no new response types.

Reuse from `server/feed/view.ts`, which owns the semantics today:

- `matchesQuery(item, q)` (`server/feed/view.ts:43`) applied to `row.item`, so
  bookmark search and item search can't diverge.
- the four comparators (`server/feed/view.ts:8`) — widen their parameter types
  to the `Pick<Item, …>` they actually read and export them, so the bookmark
  comparators can delegate (`(a, b) => byTitle(a.item, b.item)`).
- a small exported `paginate(sorted, page, pageSize)` returning the
  `{ items, total, page, pageSize, pageCount }` block, since that arithmetic
  (including "a page past the end is empty, not an error") must stay identical.

**Deliberately not a generic `applyView<T>` with pluggable projections.** The
two filter chains genuinely differ — a bookmark's searchable fields sit one
level down, its tag set is a union (below), and it has no subfeed narrowing —
so the abstraction would cost more indirection than the ~20 lines it saves.
Two small functions over shared primitives, not one parameterised one.

**Tag filtering matches either tag set.** A bookmark carries its own tags *and*
its item carries the feed's, and the user filtering for "rust" does not know or
care which one holds it. So the predicate runs against
`effectiveTags(row) = unique([...(row.item.tags ?? []), ...(row.tags ?? [])])`,
with issue 07's AND semantics across selected tags, and `facets.tags` is built
from the same union — otherwise a tag could be selectable but never match, or
match but never be selectable. Write the union down in a comment: it is the
kind of thing a later reader would "fix" into item-tags-only.

Filtering stays **in memory** over the full set, for issue 07's reasons
(`server/feed/view.ts:84`) — plus one more: `bookmarks.tags` is a JSON column
too, and a single user's bookmark list is the smallest set in the app.

### 5. HTTP API routes

Thin, in the established style — validate, call the repository, translate
errors:

- `GET /api/bookmarks` — `bookmarkQuerySchema` over `getQuery`, then
  `applyBookmarkView(listBookmarksWithItems(), query, pageSize)`, returning the
  page plus `defaultPageSize` exactly as `server/api/sources/[id]/items.get.ts`
  does. `facets.sources` needs the source titles: read them once via the
  sources repository and pass a `Map` in `sourceTitleById`.
- `POST /api/bookmarks` — 400 on an invalid body, **404 when the item doesn't
  exist** (checked before the insert, as `members.post.ts:64` explains), 409 on
  `isUniqueViolation` (already bookmarked), otherwise 201 with the created
  `BookmarkWithItem` so the client can render it without a refetch.
- `GET /api/bookmarks/refs` — `BookmarkRef[]`, no paging. Static segment, so it
  routes ahead of `[id]` handlers.
- `PATCH /api/bookmarks/:id` — tags only; 404 when unknown.
- `DELETE /api/bookmarks/:id` — 404 when unknown, otherwise 204, mirroring the
  other delete routes.
- `POST /api/bookmarks/:id/move` — `bookmarkMoveSchema`; 404 when either id is
  unknown; returns the new full manual order as `BookmarkRef[]` so an optimistic
  client can reconcile rather than guess.

Use `getIdParam` (`server/utils/params.ts`) for every `:id`.

### 6. Knowing whether an item is bookmarked

The item views' responses say nothing about bookmarks, and the toggle needs to
render its state on every card. Two ways:

1. **Denormalise** — every item-view route reads the bookmark set and stamps
   `bookmarked` onto each row. Accurate per page, but it touches all six issue-07
   routes plus `applyItemView`, for a boolean.
2. **A client-side set** — `GET /api/bookmarks/refs` once per page load into the
   bookmarks store; cards consult it by `item.id`.

**Take (2).** This is a single-user app whose entire bookmark list is small
enough to page through by hand; one array of `{ id, itemId }` pairs is cheaper
than widening the item contract, and it gives the toggle the bookmark id it
needs to delete without a lookup round trip. If per-page accuracy ever matters
(a shared instance, thousands of bookmarks), option 1 is the seam — note that
in the store rather than pre-building it.

### 7. Store

`app/stores/bookmarks.ts` — a separate store from `app/stores/items.ts:51`,
because it holds one un-keyed view plus mutations, not N read-only keyed views:

- state: `page` (`ItemPage<BookmarkWithItem> & { facets; defaultPageSize }` or
  `null`), `refs: BookmarkRef[]`, `loading` / `error` / `errorStatus` in the
  `app/stores/feeds.ts` shape.
- getters: `bookmarkedItemIds` (a `Set<number>` computed from `refs` — kept out
  of state so the SSR payload stays plain JSON) and `refByItemId`.
- actions: `fetchPage(query)`, `fetchRefs()`, `add(itemId)`, `remove(id)`,
  `toggle(itemId)`, `updateTags(id, tags)`, `move(id, target)`.
- `toggle` updates `refs` locally on success so every visible card flips without
  a refetch; `move` applies the new order optimistically, then reconciles with
  the `BookmarkRef[]` the route returns and re-fetches the page on failure. A
  failed fetch leaves the previous page in place, for the reason
  `app/stores/items.ts:73` gives.

### 8. Bookmarking from the item views

Keep `ItemCard`/`ItemList` presentational — they mount standalone in
`tests/nuxt/` and a store dependency would drag a Pinia instance into those
tests:

- **`ItemCard`** gains `bookmarkable?: boolean` and `bookmarked?: boolean` props
  and a `toggle-bookmark` emit, rendered as an icon button
  (`i-ph-bookmark-simple` / `i-ph-bookmark-simple-fill`) in the card's content
  column (`app/components/items/ItemCard.vue:76`). It also gains an empty
  `#footer` slot there, which task 9 fills — one card chrome, not two nested
  `UCard`s.
- **`ItemList`** takes `bookmarkedItemIds?: Set<number>` and re-emits
  `toggle-bookmark`.
- **`ItemView`** is where the store is wired: it is the one component all three
  item pages already share (`app/components/items/ItemView.vue`), so the three
  pages need no change at all. Expose `bookmarkedItemIds` and the toggle handler
  as `#list` **slot props**, so the source page's side-by-side subfeed columns
  (`app/pages/sources/[id]/items.vue:162`) inherit the toggle instead of
  silently lacking it.
- `ItemView` calls `fetchRefs()` on mount only if `refs` is empty, so paging and
  filtering inside a view never re-fetch it.

### 9. The bookmarks page

- **`app/pages/bookmarks/index.vue`** — heading, toolbar, pager, list; the same
  `useAsyncData`-wrapping-`reload()` pattern the item pages use, so the first
  page is awaited during SSR.
- **`app/composables/useBookmarkView.ts`** — the `useItemView` counterpart:
  owns the reactive `BookmarkQueryInput`, syncs it to the URL, resets `page` on
  any filter/sort change. To keep the two URL formats from drifting, extract
  `useItemView`'s `parseQuery`/`syncUrl` pair (`app/composables/useItemView.ts:19`
  and `:75`) into a shared helper taking the schema as an argument, and have both
  composables use it. No `mode` here (see below).
- **`app/components/items/ItemViewToolbar.vue` becomes generic** over its query
  type (`<script setup lang="ts" generic="Q extends ViewQuery">`), with new
  `sortOptions` / `showModes` / `showRefresh` props. That keeps `patch`'s payload
  typed as `Partial<Q>` — a non-generic shared toolbar would have to widen `sort`
  to `string` and force a cast at every call site. `ViewQuery` is the structural
  supertype (`q`, `tags`, `sourceIds`, `sort: string`, `page`, `pageSize`) both
  inputs satisfy; put it in `shared/types/domain.ts`.
- **`app/components/bookmarks/BookmarkList.vue`** — the sortable container: one
  `BookmarkCard` per row, `UAlert`/loading/empty states copied in behaviour from
  `ItemList` ("No bookmarks yet — bookmark an item from any source, subfeed or
  feed view." when the unfiltered set is empty, "No bookmarks match this view."
  when a filter emptied it — those are different problems and deserve different
  sentences).
- **`app/components/bookmarks/BookmarkCard.vue`** — wraps `ItemsItemCard`
  (`bookmarked` fixed true, toggle mapped to remove), adds the drag handle
  (`i-ph-dots-six-vertical`), fills ItemCard's `#footer` with the bookmark's own
  tag editor (`USelectMenu`, `multiple` + `create-item`, suggesting names from
  the tags table and tags already in use while still accepting free text), and a
  row menu with **Move to top** / **Move to bottom** / **Delete**.

**Drag and drop.** Nuxt UI ships no sortable component; its own docs implement
this with `useSortable` from `@vueuse/integrations` (a Sortable.js wrapper), so
use that: `pnpm add @vueuse/integrations sortablejs` and
`pnpm add -D @types/sortablejs`. It handles touch dragging and the move
animation, which a hand-rolled HTML5 `dragstart`/`drop` handler does not — that
is the fallback if the dependency proves troublesome, at the cost of touch
support. Constraints:

- **Sortable.js is client-only.** Mount the sortable container inside
  `<ClientOnly>` (or import it lazily) so SSR never touches `document`.
- Sortable.js reorders the DOM/array itself; take the drop's `oldIndex`/
  `newIndex`, resolve the id now above the dragged row, and emit
  `{ to: 'after', afterId }` — the array mutation is the optimistic update, the
  emit is the persistence. **A drop at `newIndex === 0` is `{ to: 'first' }`
  only on the first page** — on page 2+ it must be `{ to: 'before', beforeId }`
  anchored to the row now second on that page, or the move would jump the
  bookmark to the top of the whole list rather than the top of the visible
  page. This is exactly the `before` variant task 3 added.
- **Dragging works while a filter is active, too.** `after`/`before` an anchor
  bookmark is a globally meaningful statement even when rows in between are
  hidden by the current filter — the dropped row lands directly next to the
  anchor in the full order, possibly jumping over hidden rows. There is no
  need to disable dragging on a filtered view.
- **Dragging is enabled only when `sort === 'manual'`.** Rearranging a
  title-sorted list would either lie (the order snaps back on reload) or silently
  rewrite positions the user can't see. Outside manual sort the handle is hidden
  and the row menu's move actions are disabled, with a one-line hint pointing at
  the sort select.
- Drag-and-drop is not keyboard accessible, so **Move to top / Move to bottom in
  the row menu are not optional garnish** — they are the accessible path, and
  they also cover the cross-page move a drag cannot express.
- Only `list` mode: `grid` would be workable but `editorial`'s CSS `columns`
  cannot express a linear order at all, so the bookmarks page omits the mode
  switch entirely rather than offering a layout where dragging is meaningless.

### 10. Entry points and consequences

- `app/layouts/default.vue:4` — a **Bookmarks** nav entry
  (`i-ph-bookmark-simple`) after Feeds.
- `app/pages/sources/index.vue:310` — the delete-source dialog currently says it
  "removes the source and its cached items". It also removes every bookmark of
  those items (task 1's cascade), so say so.
- `CLAUDE.md` — add `server/bookmarks/` to the architecture map and note
  bookmarks in the data-flow list, since the file documents every other slice.

## Testing

- **DB** (`tests/db/bookmarks.spec.ts`, new, against `createTestDb()`): a second
  bookmark for the same item throws (the unique index); `createBookmark` puts
  each new row above the previous one and honours an explicit `sortOrder`;
  `moveBookmark` handles `first` / `last` / `after`, resequences every row (no
  gaps, no ties), is a no-op for a move onto the current position, and returns
  `false` for an unknown id; `listBookmarksWithItems` hydrates the item and
  orders by `sortOrder, id`; `listBookmarkRefs` returns one pair per bookmark.
  Extend `tests/db/constraints.spec.ts` with: deleting an item cascades its
  bookmark, and deleting a *source* cascades bookmarks of its items (the
  behaviour task 10 surfaces in the dialog). `tests/db/schema.spec.ts:96`
  already covers `reorderBookmarks` and stays.
- **View layer** (`tests/bookmarks/view.spec.ts`, new — pure, no DB): `q`
  matches the item's title and description case-insensitively; a tag on the
  **bookmark** and a tag on the **item** both match, and AND semantics hold
  across a mixed pair; `facets.tags` lists the union while `facets.sources`
  comes from the items' sources and both ignore the active filter; each sort
  orders as specified, with `manual` following `sortOrder` and `bookmarked`
  newest-saved-first; paging matches the item view's (short last page, empty
  page past the end).
- **Server** (`tests/api/bookmarks.spec.ts`, new): h3 router with mocked
  repositories, in the style of `tests/api/items.spec.ts` — create returns 201,
  404s for an unknown item, 409s on a unique violation, 400s on a missing
  `itemId`, and strips a client-supplied `sortOrder`; the list route defaults to
  `sort=manual`, 400s on `sort=fetched` (dropped for bookmarks) and on a
  `pageSize` over the cap, and falls back to the page-size setting; patch
  rejects an unknown key (strict) and 404s for an unknown id; delete 404s then
  204s; move 400s on `{ to: 'after' }` without `afterId`, 404s for an unknown
  `afterId`, and returns the new ref order.
- **Store** (`tests/stores/bookmarks.spec.ts`): `toggle` adds then removes and
  keeps `bookmarkedItemIds` in step without refetching the page; a failed `move`
  restores the previous order and sets `error`; a failed `fetchPage` leaves the
  previous page rendered.
- **Component** (`tests/nuxt/`): `ItemCard` renders the toggle only when
  `bookmarkable`, shows the filled icon when `bookmarked`, and emits
  `toggle-bookmark` with nothing else changing; `ItemViewToolbar` still emits the
  same patches after being made generic, and hides the mode switch and refresh
  button when told to (guard against regressing the three item pages);
  `BookmarkCard` hides the drag handle and disables the move actions when the
  sort isn't `manual`, and emits `{ to: 'first' }` / `{ to: 'last' }` from the
  row menu; `BookmarkList` shows the "no bookmarks yet" and "nothing matches"
  states for the right reasons. The drag gesture itself isn't unit-tested —
  Sortable.js needs real pointer events; the move payload arithmetic is tested
  as a plain function instead.

## Acceptance criteria

- Any item in a source, subfeed or feed view can be bookmarked and un-bookmarked
  from its card, including inside the side-by-side subfeed columns, and every
  visible card reflects the change immediately without a page refetch.
- Bookmarking the same item twice is impossible: the second attempt is a 409, and
  the DB enforces it independently of the client.
- `/bookmarks` filters by search term, tag and source, and sorts by manual order,
  when saved, published date and title — reusing one query contract, one toolbar
  and the same card rendering as the item views.
- A tag matches whether it sits on the bookmark or on the underlying item, and
  the tag select lists both kinds.
- Dragging a bookmark persists its new position, survives a reload, and is
  offered only in manual sort order; Move to top / Move to bottom do the same
  from the keyboard and work across pages.
- Positions stay a total order: after any move every bookmark has a distinct
  `sortOrder`, and a newly saved bookmark appears at the top.
- Position is server-owned — a `sortOrder` in a create or patch body is ignored,
  never persisted.
- The delete-source dialog states that bookmarks of that source's items go with
  it.
- Typed end-to-end (schema → API → store → UI) with no `any` leaks.
- `pnpm test`, `pnpm lint` and `pnpm build` all pass; runs under Docker Compose.

## Out of scope

- **Export / import of bookmarks** — issue 10, which reuses `reorderBookmarks`
  and the create schema's explicit `sortOrder` path.
- **Recent bookmarks on the homepage** — issue 13, which will reuse
  `BookmarkList`.
- **`grid` / `editorial` layouts for the bookmark list**: dragging cannot express
  a linear order in a CSS-`columns` layout, and a mode where the page's primary
  interaction stops working is worse than no mode switch. Revisit only if reading
  bookmarks as a grid is actually wanted, with drag restricted to `list`.
- **Cross-page dragging.** A drag can only target a visible row; Move to
  top/bottom covers the common case, and a larger page size covers the rest.
- **Notes, highlights, or an archived/read state on a bookmark.** Read/unread was
  deferred by issue 07 and nothing here needs it.
- **Folders or collections.** Tags are the classification axis (issue 04b), and
  bookmark tags plus feeds already cover grouping.
- **Promoting bookmark tags into the `tags` table.** They stay free-form JSON, as
  item tags are; the editor merely *suggests* existing names. Unifying the two
  vocabularies is a separate decision, not a side effect of this issue.
- **Snapshotting an item's fields onto its bookmark** so it survives deletion of
  its source. The cascade is issue 01's design and is now stated in the UI; if
  losing bookmarks to a source deletion turns out to hurt, denormalising
  title/link/imageUrl onto `bookmarks` is the escape hatch.
- **Stamping `bookmarked` onto item-view responses** — task 6 chose the
  client-side ref set; that is the seam if per-page accuracy is ever needed.
- **Bookmarking a whole source, subfeed or feed.** That is what a feed is
  (issue 06).
- **Keyboard shortcuts** (e.g. `b` on a focused card) and any bulk actions
  (multi-select delete, bulk retag). Both are additive once the single-item
  paths exist.
