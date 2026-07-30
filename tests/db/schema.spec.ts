import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import * as schema from '~~/server/db/schema'
import {
  addFeedSource,
  attachTag,
  createBookmark,
  createFeed,
  createItem,
  createSource,
  createSubfeed,
  createTag,
  feedMembers,
  getSetting,
  listBookmarks,
  listSources,
  reorderBookmarks,
  setSetting,
  tagsForSource,
  updateSource,
  upsertItem,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('round-trips', () => {
  it('creates and lists a source with JSON pagination + boolean/date fields', () => {
    const created = createSource(
      {
        url: 'https://example.com/rss',
        title: 'Example',
        managed: true,
        pagination: { pageParam: 'page', sizeParam: 'limit', pageSize: 25 },
        queryParams: { lang: 'en' },
      },
      db,
    )

    expect(created.id).toBeGreaterThan(0)
    expect(created.managed).toBe(true)
    expect(created.pagination).toEqual({
      pageParam: 'page',
      sizeParam: 'limit',
      pageSize: 25,
    })
    expect(created.createdAt).toBeInstanceOf(Date)

    const all = listSources(db)
    expect(all).toHaveLength(1)
    expect(all[0]!.queryParams).toEqual({ lang: 'en' })
  })

  it('updates a source and bumps updatedAt', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const updated = updateSource(s.id, { title: 'B' }, db)
    expect(updated?.title).toBe('B')
  })

  it('attaches tags to a source', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const t1 = createTag({ name: 'tech' }, db)
    const t2 = createTag({ name: 'daily' }, db)
    attachTag(s.id, t1.id, db)
    attachTag(s.id, t2.id, db)

    const tags = tagsForSource(s.id, db)
    expect(tags.map((t) => t.name).sort()).toEqual(['daily', 'tech'])
  })

  it('adds sources and subfeeds to a feed', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sf = createSubfeed({ sourceId: s.id, name: 'Politics' }, db)
    const feed = createFeed({ name: 'Morning' }, db)

    addFeedSource(feed.id, s.id, null, db)
    addFeedSource(feed.id, s.id, sf.id, db)

    expect(feedMembers(feed.id, db)).toHaveLength(2)
  })

  it('reads and writes JSON settings', () => {
    setSetting('theme', 'dark', db)
    setSetting('pageSize', 50, db)
    expect(getSetting('theme', db)).toBe('dark')
    expect(getSetting('pageSize', db)).toBe(50)
    // upsert overwrites
    setSetting('theme', 'light', db)
    expect(getSetting('theme', db)).toBe('light')
  })

  it('reorders bookmarks by persisting sortOrder', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const mk = (guid: string) =>
      createItem({ sourceId: s.id, guid, title: guid }, db)
    const i1 = mk('a')
    const i2 = mk('b')
    const i3 = mk('c')
    const b1 = createBookmark({ itemId: i1.id }, db)
    const b2 = createBookmark({ itemId: i2.id }, db)
    const b3 = createBookmark({ itemId: i3.id }, db)

    reorderBookmarks([b3.id, b1.id, b2.id], db)

    const ordered = listBookmarks(db).map((b) => b.id)
    expect(ordered).toEqual([b3.id, b1.id, b2.id])
  })
})

describe('items caching', () => {
  it('upserts by (sourceId, guid) instead of duplicating', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    upsertItem({ sourceId: s.id, guid: 'x', title: 'First' }, db)
    const second = upsertItem(
      { sourceId: s.id, guid: 'x', title: 'Updated' },
      db,
    )

    expect(second.title).toBe('Updated')
    const rows = db.select().from(schema.items).all()
    expect(rows).toHaveLength(1)
  })
})
