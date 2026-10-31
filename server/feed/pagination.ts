import type { FeedTarget } from '#shared/types'
import { DEFAULT_MAX_PAGES } from '#shared/schemas/settings'
import { fetchFeed, type FetchFeedOptions } from './fetch'
import { parseFeed, parseNextLink, type ParsedItem } from './parse'

export { DEFAULT_MAX_PAGES }

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
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
  let nextUrl: string | undefined
  const requested = new Set<string>()

  for (let page = 0; page < maxPages; page++) {
    const url = isPaginated ? buildPageUrl(target, page) : (nextUrl ?? buildPageUrl(target, 0))
    if (requested.has(url)) return
    requested.add(url)
    const { body, url: responseUrl } = await fetchFeed(url, opts)
    const items = parseFeed(body)

    if (items.length === 0) return
    yield items

    if (!isPaginated) {
      nextUrl = parseNextLink(body, responseUrl)
      if (!nextUrl || requested.has(nextUrl)) return
    }
  }
}
