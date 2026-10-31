import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  createFeed,
  createSource,
  createSubfeed,
  recordVisit,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB
beforeEach(() => { db = createTestDb() })

describe('recordVisit', () => {
  it('refreshes on first visit and at the inclusive threshold, resetting on every visit', () => {
    const source = createSource({ url: 'https://example.com', title: 'Example' }, db)
    expect(recordVisit({ kind: 'source', id: source.id }, 1, db, 10_000)).toEqual({ lastVisitedAt: 10_000, shouldRefresh: true })
    expect(recordVisit({ kind: 'source', id: source.id }, 1, db, 69_999)?.shouldRefresh).toBe(false)
    expect(recordVisit({ kind: 'source', id: source.id }, 1, db, 129_998)?.shouldRefresh).toBe(false)
    expect(recordVisit({ kind: 'source', id: source.id }, 1, db, 189_998)?.shouldRefresh).toBe(true)
    expect(recordVisit({ kind: 'source', id: source.id }, 1, db, 189_999)?.shouldRefresh).toBe(false)
  })

  it('keeps targets independent and does not change updatedAt', () => {
    const source = createSource({ url: 'https://example.com', title: 'Example' }, db)
    const subfeed = createSubfeed({ sourceId: source.id, name: 'News' }, db)
    const feed = createFeed({ name: 'Daily' }, db)
    expect(recordVisit({ kind: 'subfeed', id: subfeed.id }, 60, db, 100)?.shouldRefresh).toBe(true)
    expect(recordVisit({ kind: 'feed', id: feed.id }, 60, db, 100)?.shouldRefresh).toBe(true)
    const unchanged = db.$client.prepare('SELECT updated_at FROM sources WHERE id = ?').get(source.id) as { updated_at: number }
    expect(unchanged.updated_at).toBe(source.updatedAt.getTime())
  })

  it('replaces a future stored timestamp and leaves unknown targets untouched', () => {
    const source = createSource({ url: 'https://example.com', title: 'Example' }, db)
    db.$client.prepare('UPDATE sources SET last_visited_at = ? WHERE id = ?').run(20_000, source.id)
    expect(recordVisit({ kind: 'source', id: source.id }, 60, db, 10_000)).toEqual({ lastVisitedAt: 10_000, shouldRefresh: true })
    expect(recordVisit({ kind: 'feed', id: 999 }, 60, db, 10_000)).toBeUndefined()
  })
})
