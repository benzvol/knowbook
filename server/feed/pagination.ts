import type { FeedTarget } from '#shared/types'
import { fetchFeed, type FetchFeedOptions } from './fetch'
import { parseFeed, type ParsedItem } from './parse'

export const DEFAULT_MAX_PAGES = 5

export function buildPageUrl(target: FeedTarget, page: number): string {
  const url = new URL(target.url)

  for (const [key, value] of Object.entries(target.queryParams ?? {})) {
    url.searchParams.set(key, value)
  }

  const pagination = target.pagination
  if (pagination?.pageParam) {
    const startPage = pagination.startPage ?? 1
    url.searchParams.set(pagination.pageParam, String(startPage + page))
  }
  if (pagination?.sizeParam && pagination.pageSize) {
    url.searchParams.set(pagination.sizeParam, String(pagination.pageSize))
  }

  return url.toString()
}

export interface PagesOptions extends FetchFeedOptions {
  maxPages?: number
}

export async function* pages(
  target: FeedTarget,
  opts: PagesOptions = {},
): AsyncGenerator<ParsedItem[]> {
  const isPaginated = !!target.pagination?.pageParam
  const maxPages = isPaginated ? (opts.maxPages ?? DEFAULT_MAX_PAGES) : 1

  for (let page = 0; page < maxPages; page++) {
    const url = buildPageUrl(target, page)
    const { body } = await fetchFeed(url, opts)
    const items = parseFeed(body)

    if (items.length === 0) return
    yield items

    if (!isPaginated) return
  }
}
