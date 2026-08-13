import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { Item, ItemFacets, ItemPage } from '#shared/types'

// DESC/ASC by publishedAt, with undated items always last regardless of
// direction. Handles "both items undated" explicitly rather than via an
// Infinity-minus-Infinity trick, which produces `NaN` (not `0`) for that case
// and would violate the sort comparator contract.
export function byPublishedAtDesc(a: Item, b: Item): number {
  if (a.publishedAt == null) return b.publishedAt == null ? 0 : 1
  if (b.publishedAt == null) return -1
  return b.publishedAt.getTime() - a.publishedAt.getTime()
}

function byPublishedAtAsc(a: Item, b: Item): number {
  if (a.publishedAt == null) return b.publishedAt == null ? 0 : 1
  if (b.publishedAt == null) return -1
  return a.publishedAt.getTime() - b.publishedAt.getTime()
}

function byTitle(a: Item, b: Item): number {
  return a.title.localeCompare(b.title)
}

function byFetchedAtDesc(a: Item, b: Item): number {
  return b.fetchedAt.getTime() - a.fetchedAt.getTime()
}

const comparators: Record<ItemQueryInput['sort'], (a: Item, b: Item) => number> =
  {
    newest: byPublishedAtDesc,
    oldest: byPublishedAtAsc,
    title: byTitle,
    fetched: byFetchedAtDesc,
  }

/**
 * The title/description match both the view layer's `q` filter and
 * search-until-found use, so cached and network search can never disagree
 * about what "found" means. Case-insensitive; matches either field.
 */
export function matchesQuery(
  item: Pick<Item, 'title' | 'description'>,
  q: string,
): boolean {
  const needle = q.toLowerCase()
  return (
    item.title.toLowerCase().includes(needle) ||
    (item.description ?? '').toLowerCase().includes(needle)
  )
}

// Facets always come from the pre-filter set (the caller's full candidate
// list), so filtering to one tag doesn't empty the tag select.
function buildFacets(
  items: Item[],
  sourceTitleById: Map<number, string>,
): ItemFacets {
  const tagSet = new Set<string>()
  const sourceIds = new Set<number>()
  for (const item of items) {
    for (const tag of item.tags ?? []) tagSet.add(tag)
    sourceIds.add(item.sourceId)
  }

  return {
    tags: [...tagSet].sort((a, b) => a.localeCompare(b)),
    sources: [...sourceIds]
      .map((id) => ({ id, title: sourceTitleById.get(id) ?? String(id) }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  }
}

export interface ApplyItemViewOptions {
  /**
   * Source titles for `facets.sources`. Only a feed view has more than one
   * possible source; source/subfeed routes pass a single-entry map for their
   * own title.
   */
  sourceTitleById?: Map<number, string>
}

/**
 * Filter -> sort -> page a target's already-cached items. Pure and
 * synchronous: the caller has already read every candidate row (a source's,
 * a subfeed's, or a feed's merged set) out of SQLite — this function does no
 * I/O of its own.
 *
 * Filtering and sorting run **in memory** over the full candidate set rather
 * than in SQL: `items.tags` is a JSON column, and a feed's candidate set is
 * already materialised by `feedItems` before this runs, so pushing the
 * filter into SQL would mean either JSON1 predicates or three divergent
 * queries for one behaviour. At single-user cache sizes the in-memory pass
 * is the simpler correct thing — this function, plus the repository reads
 * that feed it, is the single seam to replace with an FTS5 index if cache
 * sizes ever justify it.
 */
export function applyItemView(
  items: Item[],
  query: ItemQueryInput,
  pageSize: number,
  opts: ApplyItemViewOptions = {},
): ItemPage<Item> & { facets: ItemFacets } {
  const facets = buildFacets(items, opts.sourceTitleById ?? new Map())

  let filtered = items
  if (query.q) {
    const q = query.q
    filtered = filtered.filter((item) => matchesQuery(item, q))
  }
  if (query.tags.length) {
    filtered = filtered.filter((item) =>
      query.tags.every((tag) => item.tags?.includes(tag)),
    )
  }
  if (query.sourceIds.length) {
    filtered = filtered.filter((item) =>
      query.sourceIds.includes(item.sourceId),
    )
  }

  const sorted = [...filtered].sort(comparators[query.sort])

  const total = sorted.length
  const pageCount = Math.ceil(total / pageSize)
  const start = (query.page - 1) * pageSize

  return {
    items: sorted.slice(start, start + pageSize),
    total,
    page: query.page,
    pageSize,
    pageCount,
    facets,
  }
}
