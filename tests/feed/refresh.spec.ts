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
  FeedNotFoundError,
  SourceNotFoundError,
  SubfeedNotFoundError,
} from '~~/server/feed/errors'
import {
  refreshFeed,
  refreshSource,
  refreshSubfeed,
} from '~~/server/feed/refresh'
import { createTestDb } from '../db/helpers'
import { RSS_FEED } from './fixtures'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

function fakeFetchImpl(body: string): typeof fetch {
  return vi.fn(
    async () => new Response(body, { status: 200 }),
  ) as unknown as typeof fetch
}

describe('refreshSource', () => {
  it('inserts new items on first run', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )

    const summary = await refreshSource(source.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(summary).toMatchObject({
      sourceId: source.id,
      seen: 2,
      inserted: 2,
      updated: 0,
      pagesFetched: 1,
    })
    expect(itemsForSource(source.id, db)).toHaveLength(2)
  })

  it('updates existing items instead of duplicating on re-run', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )

    await refreshSource(source.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })
    const second = await refreshSource(source.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(second).toMatchObject({ seen: 2, inserted: 0, updated: 2 })
    expect(itemsForSource(source.id, db)).toHaveLength(2)
  })

  it('throws SourceNotFoundError when the source does not exist', async () => {
    await expect(
      refreshSource(999, { database: db, fetchImpl: fakeFetchImpl(RSS_FEED) }),
    ).rejects.toThrow(SourceNotFoundError)
  })
})

describe('refreshSubfeed', () => {
  it('caches items under the parent sourceId', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const subfeed = createSubfeed(
      { sourceId: source.id, name: 'sub', queryParams: { lang: 'en' } },
      db,
    )

    const summary = await refreshSubfeed(subfeed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(summary).toMatchObject({
      subfeedId: subfeed.id,
      sourceId: source.id,
      seen: 2,
      inserted: 2,
      updated: 0,
      pagesFetched: 1,
    })
    expect(itemsForSource(source.id, db)).toHaveLength(2)
  })

  it('updates instead of duplicating on re-run, even via the source directly', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const subfeed = createSubfeed({ sourceId: source.id, name: 'sub' }, db)

    await refreshSubfeed(subfeed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })
    // The same entries arriving via the parent source dedupe against what the
    // subfeed already cached, since both write under the same sourceId.
    const second = await refreshSource(source.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(second).toMatchObject({ seen: 2, inserted: 0, updated: 2 })
    expect(itemsForSource(source.id, db)).toHaveLength(2)
  })

  it('links each upserted item to the subfeed, without duplicating on re-run', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const subfeed = createSubfeed({ sourceId: source.id, name: 'sub' }, db)

    await refreshSubfeed(subfeed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })
    await refreshSubfeed(subfeed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(itemsForSubfeed(subfeed.id, db)).toHaveLength(2)
  })

  it('does not link items refreshed directly through the parent source', async () => {
    const source = createSource(
      { url: 'https://example.com/feed', title: 'Test' },
      db,
    )
    const subfeed = createSubfeed({ sourceId: source.id, name: 'sub' }, db)

    await refreshSource(source.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(itemsForSubfeed(subfeed.id, db)).toHaveLength(0)
  })

  it('throws SubfeedNotFoundError when the subfeed does not exist', async () => {
    await expect(
      refreshSubfeed(999, {
        database: db,
        fetchImpl: fakeFetchImpl(RSS_FEED),
      }),
    ).rejects.toThrow(SubfeedNotFoundError)
  })
})

describe('refreshFeed', () => {
  it('aggregates counts across a mixed whole-source + subfeed membership set', async () => {
    const a = createSource(
      { url: 'https://a.example.com/feed', title: 'A' },
      db,
    )
    const b = createSource(
      { url: 'https://b.example.com/feed', title: 'B' },
      db,
    )
    const sub = createSubfeed({ sourceId: a.id, name: 'sub' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, b.id, null, db)
    addFeedSource(feed.id, a.id, sub.id, db)

    const summary = await refreshFeed(feed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(summary).toMatchObject({
      feedId: feed.id,
      seen: 4,
      inserted: 4,
      updated: 0,
      pagesFetched: 2,
    })
    expect(summary.members).toHaveLength(2)
    expect(summary.members).toContainEqual(
      expect.objectContaining({ sourceId: b.id }),
    )
    expect(summary.members).toContainEqual(
      expect.objectContaining({ sourceId: a.id, subfeedId: sub.id }),
    )
  })

  it('updates instead of duplicating when two members share a source', async () => {
    const s = createSource({ url: 'https://example.com/feed', title: 'A' }, db)
    const sub = createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)
    addFeedSource(feed.id, s.id, sub.id, db)

    const summary = await refreshFeed(feed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(summary).toMatchObject({ seen: 4, inserted: 2, updated: 2 })
    expect(itemsForSource(s.id, db)).toHaveLength(2)
  })

  it('returns zero counts and no members for a memberless feed', async () => {
    const feed = createFeed({ name: 'F' }, db)

    const summary = await refreshFeed(feed.id, {
      database: db,
      fetchImpl: fakeFetchImpl(RSS_FEED),
    })

    expect(summary).toMatchObject({
      feedId: feed.id,
      members: [],
      seen: 0,
      inserted: 0,
      updated: 0,
      pagesFetched: 0,
    })
  })

  it('throws FeedNotFoundError when the feed does not exist', async () => {
    await expect(
      refreshFeed(999, { database: db, fetchImpl: fakeFetchImpl(RSS_FEED) }),
    ).rejects.toThrow(FeedNotFoundError)
  })
})
