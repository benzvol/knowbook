import type { FeedTarget } from '#shared/types'
import { DEFAULT_MAX_PAGES, pages, type PagesOptions } from './pagination'
import type { ParsedItem } from './parse'

export interface SearchUntilFoundResult {
  match?: ParsedItem
  items: ParsedItem[]
  pagesSearched: number
  capHit: boolean
}

export async function searchUntilFound(
  target: FeedTarget,
  predicate: (item: ParsedItem) => boolean,
  opts: PagesOptions = {},
): Promise<SearchUntilFoundResult> {
  const isPaginated = !!target.pagination?.pageParam
  const maxPages = isPaginated ? (opts.maxPages ?? DEFAULT_MAX_PAGES) : 1

  const items: ParsedItem[] = []
  let pagesSearched = 0

  for await (const page of pages(target, opts)) {
    pagesSearched++
    items.push(...page)

    const match = page.find(predicate)
    if (match) {
      return { match, items, pagesSearched, capHit: false }
    }
  }

  // The generator can also stop early because the feed ran out of items
  // before the cap; only report capHit when we actually exhausted maxPages.
  return { items, pagesSearched, capHit: pagesSearched >= maxPages }
}
