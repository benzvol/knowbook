import { describe, expect, it, vi } from 'vitest'
import { buildPageUrl, pages } from '~~/server/feed/pagination'
import { makeSource, RSS_FEED } from './fixtures'

function fakeFetchImpl(bodyByPage: (string | null)[]): typeof fetch {
  let call = 0
  return vi.fn(async (_url: string | URL | Request) => {
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
  it('follows RSS Atom rel=next links by default, resolving relative URLs', async () => {
    const first = RSS_FEED.replace('</channel>', '<atom:link rel="next" href="?page=2"/></channel>').replace('<rss', '<rss xmlns:atom="http://www.w3.org/2005/Atom"')
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      return new Response(url.includes('page=2') ? RSS_FEED : first, { status: 200 })
    }) as unknown as typeof fetch
    const collected = []
    for await (const page of pages(makeSource(), { fetchImpl, maxPages: 3 })) collected.push(page)
    expect(collected).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(vi.mocked(fetchImpl).mock.calls[1]?.[0])).toBe('https://example.com/feed?page=2')
  })

  it('follows Atom rel=next links and honors the maximum page count', async () => {
    const atom = (next: number) => `<feed xmlns="http://www.w3.org/2005/Atom"><link rel="next" href="/feed?page=${next}"/><entry><id>${next}</id><title>Page ${next}</title></entry></feed>`
    const fetchImpl = vi.fn(async () => new Response(atom(2), { status: 200 })) as unknown as typeof fetch
    const collected = []
    for await (const page of pages(makeSource(), { fetchImpl, maxPages: 2 })) collected.push(page)
    expect(collected).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

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
