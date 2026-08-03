import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  createSource,
  createSubfeed,
  itemsForSource,
} from '~~/server/db/repositories'
import { SourceNotFoundError, SubfeedNotFoundError } from '~~/server/feed/errors'
import { refreshSource, refreshSubfeed } from '~~/server/feed/refresh'
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

  it('throws SubfeedNotFoundError when the subfeed does not exist', async () => {
    await expect(
      refreshSubfeed(999, {
        database: db,
        fetchImpl: fakeFetchImpl(RSS_FEED),
      }),
    ).rejects.toThrow(SubfeedNotFoundError)
  })
})
