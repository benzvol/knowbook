import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DB } from '~~/server/db/client'
import { createSource, itemsForSource } from '~~/server/db/repositories'
import { refreshSource } from '~~/server/feed/refresh'
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

  it('throws when the source does not exist', async () => {
    await expect(
      refreshSource(999, { database: db, fetchImpl: fakeFetchImpl(RSS_FEED) }),
    ).rejects.toThrow(/not found/i)
  })
})
