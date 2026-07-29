import { describe, expect, it, vi } from 'vitest'
import { searchUntilFound } from '~~/server/feed/search'
import { makeSource, RSS_FEED } from './fixtures'

function fakeFetchImpl(bodyByPage: string[]): typeof fetch {
  let call = 0
  return vi.fn(async () => {
    const body = bodyByPage[call] ?? ''
    call++
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' },
    })
  }) as unknown as typeof fetch
}

const NO_MATCH_FEED = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Unrelated</title><guid>u1</guid><link>https://e.com/u1</link></item>
</channel></rss>`

describe('searchUntilFound', () => {
  it('returns the first matching item without exhausting the cap', async () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const fetchImpl = fakeFetchImpl([NO_MATCH_FEED, RSS_FEED])

    const result = await searchUntilFound(
      source,
      (item) => item.title === 'First post',
      { fetchImpl, maxPages: 5 },
    )

    expect(result.capHit).toBe(false)
    expect(result.match?.title).toBe('First post')
    expect(result.pagesSearched).toBe(2)
  })

  it('reports capHit when no match is found within maxPages', async () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const fetchImpl = fakeFetchImpl([
      NO_MATCH_FEED,
      NO_MATCH_FEED,
      NO_MATCH_FEED,
    ])

    const result = await searchUntilFound(
      source,
      (item) => item.title === 'Nope',
      {
        fetchImpl,
        maxPages: 3,
      },
    )

    expect(result.capHit).toBe(true)
    expect(result.match).toBeUndefined()
    expect(result.pagesSearched).toBe(3)
  })

  it('does not report capHit when the feed simply runs out of pages', async () => {
    const source = makeSource({
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const fetchImpl = fakeFetchImpl([
      NO_MATCH_FEED,
      '<rss version="2.0"><channel/></rss>',
    ])

    const result = await searchUntilFound(
      source,
      (item) => item.title === 'Nope',
      {
        fetchImpl,
        maxPages: 5,
      },
    )

    expect(result.capHit).toBe(false)
    expect(result.pagesSearched).toBe(1)
  })
})
