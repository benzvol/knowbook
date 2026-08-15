import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  createBookmark,
  createItem,
  createSource,
  getBookmarkByItemId,
  listBookmarkRefs,
  listBookmarksWithItems,
  moveBookmark,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

function makeItems(count: number) {
  const source = createSource({ url: 'u', title: 'A' }, db)
  return Array.from({ length: count }, (_, i) =>
    createItem({ sourceId: source.id, guid: `g${i}`, title: `Item ${i}` }, db),
  )
}

describe('bookmarks repository', () => {
  it('rejects a second bookmark for the same item (unique index)', () => {
    const [item] = makeItems(1)
    createBookmark({ itemId: item.id }, db)
    expect(() => createBookmark({ itemId: item.id }, db)).toThrow()
  })

  it('puts each new bookmark above the previous one', () => {
    const [i1, i2, i3] = makeItems(3)
    const b1 = createBookmark({ itemId: i1.id }, db)
    const b2 = createBookmark({ itemId: i2.id }, db)
    const b3 = createBookmark({ itemId: i3.id }, db)

    expect(b2.sortOrder).toBeLessThan(b1.sortOrder)
    expect(b3.sortOrder).toBeLessThan(b2.sortOrder)

    const ordered = listBookmarksWithItems(db).map((b) => b.id)
    expect(ordered).toEqual([b3.id, b2.id, b1.id])
  })

  it('honours an explicitly supplied sortOrder', () => {
    const [item] = makeItems(1)
    const b = createBookmark({ itemId: item.id, sortOrder: 42 }, db)
    expect(b.sortOrder).toBe(42)
  })

  it('hydrates each row with its item, ordered by sortOrder then id', () => {
    const [i1, i2] = makeItems(2)
    const b1 = createBookmark({ itemId: i1.id }, db)
    const b2 = createBookmark({ itemId: i2.id }, db)

    const rows = listBookmarksWithItems(db)
    expect(rows.map((r) => r.id)).toEqual([b2.id, b1.id])
    expect(rows[0].item.id).toBe(i2.id)
    expect(rows[1].item.id).toBe(i1.id)
  })

  it('lists one ref pair per bookmark', () => {
    const [i1, i2] = makeItems(2)
    const b1 = createBookmark({ itemId: i1.id }, db)
    const b2 = createBookmark({ itemId: i2.id }, db)

    const refs = listBookmarkRefs(db)
    expect(refs).toHaveLength(2)
    expect(refs).toEqual(
      expect.arrayContaining([
        { id: b1.id, itemId: i1.id },
        { id: b2.id, itemId: i2.id },
      ]),
    )
  })

  it('finds a bookmark by its item id', () => {
    const [item] = makeItems(1)
    const b = createBookmark({ itemId: item.id }, db)
    expect(getBookmarkByItemId(item.id, db)?.id).toBe(b.id)
    expect(getBookmarkByItemId(999, db)).toBeUndefined()
  })

  describe('moveBookmark', () => {
    function makeThree() {
      const [i1, i2, i3] = makeItems(3)
      // Insert in order so sortOrder is -1, -2, -3 (b3 currently first).
      const b1 = createBookmark({ itemId: i1.id }, db)
      const b2 = createBookmark({ itemId: i2.id }, db)
      const b3 = createBookmark({ itemId: i3.id }, db)
      // Current manual order: b3, b2, b1
      return { b1, b2, b3 }
    }

    it('moves to first', () => {
      const { b1, b2, b3 } = makeThree()
      const refs = moveBookmark(b1.id, { to: 'first' }, db)
      expect(refs?.map((r) => r.id)).toEqual([b1.id, b3.id, b2.id])
    })

    it('moves to last', () => {
      const { b1, b2, b3 } = makeThree()
      const refs = moveBookmark(b3.id, { to: 'last' }, db)
      expect(refs?.map((r) => r.id)).toEqual([b2.id, b1.id, b3.id])
    })

    it('moves after another bookmark', () => {
      const { b1, b2, b3 } = makeThree()
      // order: b3, b2, b1 -> move b1 after b3
      const refs = moveBookmark(b1.id, { to: 'after', afterId: b3.id }, db)
      expect(refs?.map((r) => r.id)).toEqual([b3.id, b1.id, b2.id])
    })

    it('moves before another bookmark', () => {
      const { b1, b2, b3 } = makeThree()
      // order: b3, b2, b1 -> move b1 before b2
      const refs = moveBookmark(b1.id, { to: 'before', beforeId: b2.id }, db)
      expect(refs?.map((r) => r.id)).toEqual([b3.id, b1.id, b2.id])
    })

    it('resequences every row with no gaps or ties', () => {
      const { b1, b2, b3 } = makeThree()
      moveBookmark(b1.id, { to: 'first' }, db)

      const rows = listBookmarksWithItems(db)
      const orders = rows.map((r) => r.sortOrder)
      expect(orders).toEqual([0, 1, 2])
      expect(new Set(orders).size).toBe(3)
      expect(rows.map((r) => r.id)).toEqual([b1.id, b3.id, b2.id])
    })

    it('is a no-op for a move onto the current position', () => {
      const { b1, b2, b3 } = makeThree()
      const before = listBookmarksWithItems(db).map((r) => r.sortOrder)

      const refs = moveBookmark(b2.id, { to: 'after', afterId: b3.id }, db)

      expect(refs?.map((r) => r.id)).toEqual([b3.id, b2.id, b1.id])
      const after = listBookmarksWithItems(db).map((r) => r.sortOrder)
      expect(after).toEqual(before)
    })

    it('returns undefined for an unknown id', () => {
      const { b1 } = makeThree()
      expect(moveBookmark(999, { to: 'first' }, db)).toBeUndefined()
      expect(
        moveBookmark(b1.id, { to: 'after', afterId: 999 }, db),
      ).toBeUndefined()
      expect(
        moveBookmark(b1.id, { to: 'before', beforeId: 999 }, db),
      ).toBeUndefined()
    })
  })
})
