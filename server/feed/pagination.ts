import type { Source } from '#shared/types'
import { fetchFeed, type FetchFeedOptions } from './fetch'
import { parseFeed, type ParsedItem } from './parse'

export const DEFAULT_MAX_PAGES = 5

export function buildPageUrl(source: Source, page: number): string {
  const url = new URL(source.url)

  for (const [key, value] of Object.entries(source.queryParams ?? {})) {
    url.searchParams.set(key, value)
  }

  const pagination = source.pagination
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
  source: Source,
  opts: PagesOptions = {},
): AsyncGenerator<ParsedItem[]> {
  const isPaginated = !!source.pagination?.pageParam
  const maxPages = isPaginated ? (opts.maxPages ?? DEFAULT_MAX_PAGES) : 1

  for (let page = 0; page < maxPages; page++) {
    const url = buildPageUrl(source, page)
    const { body } = await fetchFeed(url, opts)
    const items = parseFeed(body)

    if (items.length === 0) return
    yield items

    if (!isPaginated) return
  }
}
