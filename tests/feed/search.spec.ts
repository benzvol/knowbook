import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  addFeedSource,
  createFeed,
  createSource,
  createSubfeed,
  itemsForSource,
  itemsForSubfeed,
} from '~~/server/db/repositories'
import {
  searchAndCache,
  searchFeed,
  searchSource,
  searchSubfeed,
} from '~~/server/feed/search'
import { createTestDb } from '../db/helpers'
import { RSS_FEED } from './fixtures'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

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

describe('searchAndCache', () => {
  it('stops at the page carrying the match and caches every page it fetched', async () => {
    const source = createSource(
      {
        url: 'https://example.com/feed',
        title: 'Test',
        pagination: { pageParam: 'page', startPage: 1 },
      },
      db,
    )
    const fetchImpl = fakeFetchImpl([NO_MATCH_FEED, RSS_FEED])

    const result = await searchAndCache(
      source,
      source.id,
      (item) => item.title === 'First post',
      { database: db, fetchImpl, maxPages: 5 },
    )

    expect(result.matched).toBe(true)
    expect(result.capHit).toBe(false)
    expect(result.pagesSearched).toBe(2)
    // Both the no-match page's item and the matching page's items were
    // cached, not just the one that matched.
    const cached = itemsForSource(source.id, db)
    expect(cached.map((i) => i.title).toSorted()).toEqual([
      'First post',
      'Second post',
      'Unrelated',
    ])
  })

  it('reports capHit only when the cap is actually exhausted without a match', async () => {
    const source = createSource(
      {
        url: 'https://example.com/feed',
        title: 'Test',
        pagination: { pageParam: 'page', startPage: 1 },
      },
      db,
    )
    const fetchImpl = fakeFetchImpl([
      NO_MATCH_FEED,
      NO_MATCH_FEED,
      NO_MATCH_FEED,
    ])

    const result = await searchAndCache(
      source,
      source.id,
      (item) => item.title === 'Nope',
      { database: db, fetchImpl, maxPages: 3 },
    )

    expect(result.matched).toBe(false)
    expect(result.capHit).toBe(true)
    expect(result.pagesSearched).toBe(3)
  })

  it('does not report capHit when the feed simply runs out of pages', async () => {
    const source = createSource(
      {
        url: 'https://example.com/feed',
        title: 'Test',
        pagination: { pageParam: 'page', startPage: 1 },
      },
      db,
    )
    const fetchImpl = fakeFetchImpl([
      NO_MATCH_FEED,
      '<rss version="2.0"><channel/></rss>',
    ])

    const result = await searchAndCache(
      source,
      source.id,
      (item) => item.title === 'Nope',
      { database: db, fetchImpl, maxPages: 5 },
    )

    expect(result.matched).toBe(false)
    expect(result.capHit).toBe(false)
    expect(result.pagesSearched).toBe(1)
  })

  it('yields exactly one page for a non-paginated target, regardless of maxPages', async () => {
    // No pagination config, so `pages()` only ever yields one page.
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const fetchImpl = fakeFetchImpl([NO_MATCH_FEED, RSS_FEED])

    const result = await searchAndCache(
      source,
      source.id,
      (item) => item.title === 'First post',
      { database: db, fetchImpl, maxPages: 5 },
    )

    expect(result.matched).toBe(false)
    expect(result.pagesSearched).toBe(1)
  })
})

describe('searchSource', () => {
  it('throws SourceNotFoundError when the source does not exist', async () => {
    await expect(
      searchSource(999, () => true, {
        database: db,
        fetchImpl: fakeFetchImpl([RSS_FEED]),
      }),
    ).rejects.toThrow('Source not found')
  })
})

describe('searchSubfeed', () => {
  it('links matched-page items to the subfeed, same as a refresh', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const subfeed = createSubfeed({ sourceId: source.id, name: 'sub' }, db)
    const fetchImpl = fakeFetchImpl([RSS_FEED])

    const result = await searchSubfeed(
      subfeed.id,
      (item) => item.title === 'First post',
      { database: db, fetchImpl },
    )

    expect(result.matched).toBe(true)
    expect(itemsForSubfeed(subfeed.id, db)).toHaveLength(2)
  })

  it('throws SubfeedNotFoundError when the subfeed does not exist', async () => {
    await expect(
      searchSubfeed(999, () => true, {
        database: db,
        fetchImpl: fakeFetchImpl([RSS_FEED]),
      }),
    ).rejects.toThrow('Subfeed not found')
  })
})

describe('searchFeed', () => {
  it('stops at the first member that matches, without searching the rest', async () => {
    const a = createSource(
      { url: 'https://a.example.com/feed', title: 'A' },
      db,
    )
    const b = createSource(
      { url: 'https://b.example.com/feed', title: 'B' },
      db,
    )
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, a.id, null, db)
    addFeedSource(feed.id, b.id, null, db)

    // Only member A's fetch is ever consulted, since it matches immediately.
    const fetchImpl = vi.fn(
      async () => new Response(RSS_FEED, { status: 200 }),
    ) as unknown as typeof fetch

    const result = await searchFeed(
      feed.id,
      (item) => item.title === 'First post',
      { database: db, fetchImpl },
    )

    expect(result.matched).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('aggregates counts across members when none match', async () => {
    const a = createSource(
      { url: 'https://a.example.com/feed', title: 'A' },
      db,
    )
    const b = createSource(
      { url: 'https://b.example.com/feed', title: 'B' },
      db,
    )
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, a.id, null, db)
    addFeedSource(feed.id, b.id, null, db)
    const fetchImpl = fakeFetchImpl([NO_MATCH_FEED, NO_MATCH_FEED])

    const result = await searchFeed(feed.id, (item) => item.title === 'Nope', {
      database: db,
      fetchImpl,
    })

    expect(result.matched).toBe(false)
    expect(result.counts.seen).toBe(2)
  })

  it('throws FeedNotFoundError when the feed does not exist', async () => {
    await expect(
      searchFeed(999, () => true, {
        database: db,
        fetchImpl: fakeFetchImpl([RSS_FEED]),
      }),
    ).rejects.toThrow('Feed not found')
  })
})
