import { describe, expect, it, vi } from 'vitest'
import { buildPageUrl, pages } from '~~/server/feed/pagination'
import { makeSource, RSS_FEED } from './fixtures'

function fakeFetchImpl(bodyByPage: (string | null)[]): typeof fetch {
  let call = 0
  return vi.fn(async (url: string | URL | Request) => {
    const body = bodyByPage[call] ?? null
    call++
    return new Response(body ?? '', {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' },
    })
  }) as unknown as typeof fetch
}

describe('buildPageUrl', () => {
  it('returns the base url unchanged when there is no pagination config', () => {
    const source = makeSource()
    expect(buildPageUrl(source, 0)).toBe('https://example.com/feed')
  })

  it('merges static query params', () => {
    const source = makeSource({ queryParams: { lang: 'en' } })
    expect(buildPageUrl(source, 0)).toBe('https://example.com/feed?lang=en')
  })

  it('applies pageParam offset by startPage', () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    expect(buildPageUrl(source, 0)).toContain('page=1')
    expect(buildPageUrl(source, 2)).toContain('page=3')
  })

  it('applies a zero-based startPage', () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 0 },
    })
    expect(buildPageUrl(source, 0)).toContain('page=0')
  })

  it('applies sizeParam only when pageSize is also set', () => {
    const source = makeSource({
      pagination: { pageParam: 'page', sizeParam: 'limit', pageSize: 25 },
    })
    const url = buildPageUrl(source, 0)
    expect(url).toContain('limit=25')
  })
})

describe('pages', () => {
  it('yields exactly one page for a source without pagination, regardless of maxPages', async () => {
    const source = makeSource()
    const fetchImpl = fakeFetchImpl([RSS_FEED, RSS_FEED])

    const collected = []
    for await (const page of pages(source, { fetchImpl, maxPages: 5 })) {
      collected.push(page)
    }

    expect(collected).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('stops once a page returns no items', async () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const fetchImpl = fakeFetchImpl([
      RSS_FEED,
      '<rss version="2.0"><channel/></rss>',
    ])

    const collected = []
    for await (const page of pages(source, { fetchImpl, maxPages: 5 })) {
      collected.push(page)
    }

    expect(collected).toHaveLength(1)
  })

  it('stops at maxPages even when more items are available', async () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const fetchImpl = fakeFetchImpl([RSS_FEED, RSS_FEED, RSS_FEED])

    const collected = []
    for await (const page of pages(source, { fetchImpl, maxPages: 2 })) {
      collected.push(page)
    }

    expect(collected).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
