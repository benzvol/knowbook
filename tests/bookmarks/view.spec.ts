import { describe, expect, it } from 'vitest'
import type { BookmarkQueryInput } from '#shared/schemas/bookmark'
import type { BookmarkWithItem, Item } from '#shared/types'
import { applyBookmarkView } from '~~/server/bookmarks/view'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    sourceId: 1,
    guid: 'g1',
    title: 'Title',
    description: null,
    link: null,
    publishedAt: null,
    tags: null,
    imageUrl: null,
    fetchedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeRow(overrides: Partial<BookmarkWithItem> = {}): BookmarkWithItem {
  const { item: itemOverrides, ...rest } = overrides
  return {
    id: 1,
    itemId: 1,
    sortOrder: 0,
    tags: null,
    createdAt: new Date('2024-01-01'),
    item: makeItem(itemOverrides),
    ...rest,
  }
}

function baseQuery(
  overrides: Partial<BookmarkQueryInput> = {},
): BookmarkQueryInput {
  return { tags: [], sourceIds: [], sort: 'manual', page: 1, ...overrides }
}

describe('applyBookmarkView', () => {
  describe('q', () => {
    it("matches the item's title case-insensitively", () => {
      const rows = [
        makeRow({ id: 1, item: makeItem({ title: 'Breaking NEWS today' }) }),
      ]
      const result = applyBookmarkView(rows, baseQuery({ q: 'news' }), 25)
      expect(result.items.map((r) => r.id)).toEqual([1])
    })

    it("matches the item's description case-insensitively", () => {
      const rows = [
        makeRow({
          id: 1,
          item: makeItem({ title: 'Untitled', description: 'about DUCKS' }),
        }),
      ]
      const result = applyBookmarkView(rows, baseQuery({ q: 'ducks' }), 25)
      expect(result.items.map((r) => r.id)).toEqual([1])
    })
  })

  describe('tags', () => {
    it('matches a tag on the bookmark itself', () => {
      const rows = [makeRow({ id: 1, tags: ['rust'], item: makeItem() })]
      const result = applyBookmarkView(rows, baseQuery({ tags: ['rust'] }), 25)
      expect(result.items.map((r) => r.id)).toEqual([1])
    })

    it('matches a tag on the underlying item', () => {
      const rows = [makeRow({ id: 1, item: makeItem({ tags: ['rust'] }) })]
      const result = applyBookmarkView(rows, baseQuery({ tags: ['rust'] }), 25)
      expect(result.items.map((r) => r.id)).toEqual([1])
    })

    it('applies AND semantics across a mix of bookmark and item tags', () => {
      const rows = [
        // has both -> matches
        makeRow({ id: 1, tags: ['a'], item: makeItem({ tags: ['b'] }) }),
        // only the bookmark tag -> no match
        makeRow({ id: 2, tags: ['a'], item: makeItem({ tags: [] }) }),
        // only the item tag -> no match
        makeRow({ id: 3, tags: [], item: makeItem({ tags: ['b'] }) }),
      ]
      const result = applyBookmarkView(
        rows,
        baseQuery({ tags: ['a', 'b'] }),
        25,
      )
      expect(result.items.map((r) => r.id)).toEqual([1])
    })
  })

  describe('facets', () => {
    it('lists the union of bookmark and item tags, ignoring the active filter', () => {
      const rows = [
        makeRow({ id: 1, tags: ['a'], item: makeItem({ tags: ['b'] }) }),
        makeRow({ id: 2, tags: [], item: makeItem({ tags: ['c'] }) }),
      ]
      const result = applyBookmarkView(rows, baseQuery({ tags: ['a'] }), 25)
      expect(result.facets.tags).toEqual(['a', 'b', 'c'])
    })

    it('lists sources from the items, ignoring the active filter', () => {
      const rows = [
        makeRow({ id: 1, item: makeItem({ sourceId: 10 }) }),
        makeRow({ id: 2, item: makeItem({ sourceId: 20 }) }),
      ]
      const titles = new Map([
        [10, 'Source A'],
        [20, 'Source B'],
      ])
      const result = applyBookmarkView(
        rows,
        baseQuery({ sourceIds: [10] }),
        25,
        { sourceTitleById: titles },
      )
      expect(result.facets.sources).toEqual([
        { id: 10, title: 'Source A' },
        { id: 20, title: 'Source B' },
      ])
    })
  })

  describe('sort', () => {
    it('manual: by sortOrder ascending', () => {
      const rows = [
        makeRow({ id: 1, sortOrder: 5 }),
        makeRow({ id: 2, sortOrder: -3 }),
        makeRow({ id: 3, sortOrder: 0 }),
      ]
      const result = applyBookmarkView(rows, baseQuery({ sort: 'manual' }), 25)
      expect(result.items.map((r) => r.id)).toEqual([2, 3, 1])
    })

    it('bookmarked: newest-saved-first', () => {
      const rows = [
        makeRow({ id: 1, createdAt: new Date('2024-01-01') }),
        makeRow({ id: 2, createdAt: new Date('2024-01-03') }),
        makeRow({ id: 3, createdAt: new Date('2024-01-02') }),
      ]
      const result = applyBookmarkView(
        rows,
        baseQuery({ sort: 'bookmarked' }),
        25,
      )
      expect(result.items.map((r) => r.id)).toEqual([2, 3, 1])
    })

    it("newest/oldest/title delegate to the item's own comparators", () => {
      const rows = [
        makeRow({ id: 1, item: makeItem({ title: 'Charlie' }) }),
        makeRow({ id: 2, item: makeItem({ title: 'Alpha' }) }),
        makeRow({ id: 3, item: makeItem({ title: 'Bravo' }) }),
      ]
      const result = applyBookmarkView(rows, baseQuery({ sort: 'title' }), 25)
      expect(result.items.map((r) => r.id)).toEqual([2, 3, 1])
    })
  })

  describe('paging', () => {
    const rows = Array.from({ length: 7 }, (_, i) => makeRow({ id: i + 1 }))

    it('total counts the post-filter, pre-slice set', () => {
      const result = applyBookmarkView(rows, baseQuery({ page: 1 }), 3)
      expect(result.total).toBe(7)
      expect(result.items).toHaveLength(3)
    })

    it('the last page is short rather than padded', () => {
      const result = applyBookmarkView(rows, baseQuery({ page: 3 }), 3)
      expect(result.items).toHaveLength(1)
      expect(result.pageCount).toBe(3)
    })

    it('a page beyond pageCount yields an empty page rather than throwing', () => {
      const result = applyBookmarkView(rows, baseQuery({ page: 99 }), 3)
      expect(result.items).toEqual([])
      expect(result.total).toBe(7)
    })
  })
})
