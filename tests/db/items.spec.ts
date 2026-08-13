import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  createItem,
  createSource,
  createSubfeed,
  itemsForSubfeed,
  linkItemSubfeed,
  upsertItem,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('linkItemSubfeed', () => {
  it('is idempotent for a repeated (itemId, subfeedId)', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sub = createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    const item = createItem({ sourceId: s.id, guid: 'g1', title: 'One' }, db)

    expect(() => {
      linkItemSubfeed(item.id, sub.id, db)
      linkItemSubfeed(item.id, sub.id, db)
    }).not.toThrow()

    expect(itemsForSubfeed(sub.id, db)).toHaveLength(1)
  })
})

describe('itemsForSubfeed', () => {
  it('returns only linked rows, excluding sibling subfeeds’ items', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const subA = createSubfeed({ sourceId: s.id, name: 'a' }, db)
    const subB = createSubfeed({ sourceId: s.id, name: 'b' }, db)
    const itemA = createItem({ sourceId: s.id, guid: 'a1', title: 'A1' }, db)
    const itemB = createItem({ sourceId: s.id, guid: 'b1', title: 'B1' }, db)
    linkItemSubfeed(itemA.id, subA.id, db)
    linkItemSubfeed(itemB.id, subB.id, db)

    const result = itemsForSubfeed(subA.id, db)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(itemA.id)
  })

  it('returns an empty array for a subfeed with no linked items', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sub = createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    createItem({ sourceId: s.id, guid: 'g1', title: 'One' }, db)

    expect(itemsForSubfeed(sub.id, db)).toHaveLength(0)
  })

  it('lets an item belong to several sibling subfeeds at once', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const subA = createSubfeed({ sourceId: s.id, name: 'a' }, db)
    const subB = createSubfeed({ sourceId: s.id, name: 'b' }, db)
    const item = createItem({ sourceId: s.id, guid: 'g1', title: 'One' }, db)
    linkItemSubfeed(item.id, subA.id, db)
    linkItemSubfeed(item.id, subB.id, db)

    expect(itemsForSubfeed(subA.id, db)).toHaveLength(1)
    expect(itemsForSubfeed(subB.id, db)).toHaveLength(1)
  })
})

describe('upsertItem', () => {
  it('backfills imageUrl on an already-cached row', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    upsertItem({ sourceId: s.id, guid: 'g1', title: 'One', imageUrl: null }, db)

    const updated = upsertItem(
      {
        sourceId: s.id,
        guid: 'g1',
        title: 'One',
        imageUrl: 'https://img.example.com/one.jpg',
      },
      db,
    )

    expect(updated.imageUrl).toBe('https://img.example.com/one.jpg')
  })
})
