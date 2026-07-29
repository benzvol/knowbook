import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import * as schema from '~~/server/db/schema'
import {
  addFeedSource,
  attachTag,
  createFeed,
  createItem,
  createSource,
  createSubfeed,
  createTag,
  deleteSource,
  upsertItem,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('constraints', () => {
  it('rejects duplicate (sourceId, guid) items', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    createItem({ sourceId: s.id, guid: 'dup', title: 'One' }, db)
    expect(() =>
      createItem({ sourceId: s.id, guid: 'dup', title: 'Two' }, db),
    ).toThrow()
  })

  it('allows the same guid across different sources', () => {
    const a = createSource({ url: 'a', title: 'A', type: 'standard' }, db)
    const b = createSource({ url: 'b', title: 'B', type: 'standard' }, db)
    createItem({ sourceId: a.id, guid: 'g', title: 'in a' }, db)
    expect(() =>
      createItem({ sourceId: b.id, guid: 'g', title: 'in b' }, db),
    ).not.toThrow()
  })

  it('rejects duplicate category/tag names (unique index)', () => {
    createTag({ name: 'tech' }, db)
    expect(() => createTag({ name: 'tech' }, db)).toThrow()
  })

  it('enforces foreign keys (item requires an existing source)', () => {
    expect(() =>
      createItem({ sourceId: 999, guid: 'x', title: 'orphan' }, db),
    ).toThrow()
  })

  it('cascades delete from source to items, subfeeds, tags, feed membership', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const tag = createTag({ name: 'daily' }, db)
    const feed = createFeed({ name: 'F' }, db)
    createItem({ sourceId: s.id, guid: 'i1', title: 'i1' }, db)
    createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    attachTag(s.id, tag.id, db)
    addFeedSource(feed.id, s.id, null, db)

    deleteSource(s.id, db)

    expect(db.select().from(schema.items).all()).toHaveLength(0)
    expect(db.select().from(schema.subfeeds).all()).toHaveLength(0)
    expect(db.select().from(schema.sourceTags).all()).toHaveLength(0)
    expect(db.select().from(schema.feedSources).all()).toHaveLength(0)
    // the tag itself survives (only the association is removed)
    expect(db.select().from(schema.tags).all()).toHaveLength(1)
  })

  it('keeps whole-source feed membership unique (partial index)', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)
    expect(() => addFeedSource(feed.id, s.id, null, db)).toThrow()
  })

  it('allows distinct subfeed memberships but rejects duplicates', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const sf = createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, sf.id, db)
    expect(() => addFeedSource(feed.id, s.id, sf.id, db)).toThrow()
  })

  it('sets category_id null on category delete (set null)', () => {
    const cat = db
      .insert(schema.categories)
      .values({ name: 'News' })
      .returning()
      .get()
    const s = createSource(
      { url: 'u', title: 'A', type: 'news', categoryId: cat.id },
      db,
    )
    db.delete(schema.categories).where(eq(schema.categories.id, cat.id)).run()

    const reloaded = db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.id, s.id))
      .get()
    expect(reloaded?.categoryId).toBeNull()
  })
})
