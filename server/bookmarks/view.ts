import type { BookmarkQueryInput } from '#shared/schemas/bookmark'
import type { BookmarkWithItem, ItemFacets, ItemPage } from '#shared/types'
import {
  byPublishedAtAsc,
  byPublishedAtDesc,
  byTitle,
  matchesQuery,
  paginate,
} from '../feed/view'

// Deliberately not a generic `applyView<T>` shared with `applyItemView`: the
// two filter chains genuinely differ (a bookmark's searchable fields sit one
// level down, its tag set is a union, and it has no subfeed narrowing), so
// the abstraction would cost more indirection than the ~20 lines it saves.
// What *is* shared — the comparators, `matchesQuery` and `paginate` — is
// imported from `server/feed/view.ts`, which owns those semantics.

/**
 * A bookmark carries its own tags *and* its item carries the feed's, and the
 * user filtering for "rust" does not know or care which one holds it. So
 * every predicate and facet below runs against the **union** of the two —
 * this is deliberate, not a bug to "fix" into item-tags-only: otherwise a tag
 * could be selectable but never match, or match but never be selectable.
 */
function effectiveTags(row: BookmarkWithItem): string[] {
  return [...new Set([...(row.item.tags ?? []), ...(row.tags ?? [])])]
}

function byBookmarkedDesc(a: BookmarkWithItem, b: BookmarkWithItem): number {
  return b.createdAt.getTime() - a.createdAt.getTime()
}

function bySortOrder(a: BookmarkWithItem, b: BookmarkWithItem): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.id - b.id
}

const comparators: Record<
  BookmarkQueryInput['sort'],
  (a: BookmarkWithItem, b: BookmarkWithItem) => number
> = {
  manual: bySortOrder,
  bookmarked: byBookmarkedDesc,
  newest: (a, b) => byPublishedAtDesc(a.item, b.item),
  oldest: (a, b) => byPublishedAtAsc(a.item, b.item),
  title: (a, b) => byTitle(a.item, b.item),
}

// Facets always come from the pre-filter set, and from the same tag union the
// filter matches against — otherwise a tag could be offered but never match.
function buildFacets(
  rows: BookmarkWithItem[],
  sourceTitleById: Map<number, string>,
): ItemFacets {
  const tagSet = new Set<string>()
  const sourceIds = new Set<number>()
  for (const row of rows) {
    for (const tag of effectiveTags(row)) tagSet.add(tag)
    sourceIds.add(row.item.sourceId)
  }

  return {
    tags: [...tagSet].sort((a, b) => a.localeCompare(b)),
    sources: [...sourceIds]
      .map((id) => ({ id, title: sourceTitleById.get(id) ?? String(id) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  }
}

export interface ApplyBookmarkViewOptions {
  /** Source titles for `facets.sources`, resolved by the caller. */
  sourceTitleById?: Map<number, string>
}

/**
 * Filter -> sort -> page the full bookmark set, already hydrated with items.
 * Pure and synchronous, mirroring `applyItemView` — filtering and sorting run
 * in memory over the full set, for `server/feed/view.ts`'s reasons plus one
 * more: `bookmarks.tags` is a JSON column too, and a single user's bookmark
 * list is the smallest set in the app.
 */
export function applyBookmarkView(
  rows: BookmarkWithItem[],
  query: BookmarkQueryInput,
  pageSize: number,
  opts: ApplyBookmarkViewOptions = {},
): ItemPage<BookmarkWithItem> & { facets: ItemFacets } {
  const facets = buildFacets(rows, opts.sourceTitleById ?? new Map())

  let filtered = rows
  if (query.q) {
    const q = query.q
    filtered = filtered.filter((row) => matchesQuery(row.item, q))
  }
  if (query.tags.length) {
    filtered = filtered.filter((row) => {
      const tags = effectiveTags(row)
      return query.tags.every((tag) => tags.includes(tag))
    })
  }
  if (query.sourceIds.length) {
    filtered = filtered.filter((row) =>
      query.sourceIds.includes(row.item.sourceId),
    )
  }

  const sorted = [...filtered].sort(comparators[query.sort])

  return { ...paginate(sorted, query.page, pageSize), facets }
}
