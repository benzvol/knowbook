import { describe, expect, it } from 'vitest'
import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { Item } from '#shared/types'
import { applyItemView } from '~~/server/feed/view'

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

function baseQuery(overrides: Partial<ItemQueryInput> = {}): ItemQueryInput {
  return {
    tags: [],
    sourceIds: [],
    sort: 'newest',
    page: 1,
    ...overrides,
  }
}

describe('applyItemView', () => {
  describe('q', () => {
    it('matches the title case-insensitively', () => {
      const items = [makeItem({ id: 1, title: 'Breaking NEWS today' })]
      const result = applyItemView(items, baseQuery({ q: 'news' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([1])
    })

    it('matches the description case-insensitively', () => {
      const items = [
        makeItem({ id: 1, title: 'Untitled', description: 'about DUCKS' }),
      ]
      const result = applyItemView(items, baseQuery({ q: 'ducks' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([1])
    })

    it('ignores an item matching neither field', () => {
      const items = [
        makeItem({ id: 1, title: 'Cats', description: 'about cats' }),
      ]
      const result = applyItemView(items, baseQuery({ q: 'ducks' }), 25)
      expect(result.items).toEqual([])
    })
  })

  describe('tags', () => {
    it('applies AND semantics, not OR', () => {
      const items = [
        makeItem({ id: 1, tags: ['a'] }),
        makeItem({ id: 2, tags: ['a', 'b'] }),
        makeItem({ id: 3, tags: ['b'] }),
      ]
      const result = applyItemView(items, baseQuery({ tags: ['a', 'b'] }), 25)
      expect(result.items.map((i) => i.id)).toEqual([2])
    })
  })

  describe('sort', () => {
    const dated = (id: number, date: string) =>
      makeItem({ id, publishedAt: new Date(date) })

    it('newest: DESC by publishedAt with undated items last', () => {
      const items = [
        dated(1, '2024-01-01'),
        dated(2, '2024-01-03'),
        makeItem({ id: 3 }),
        makeItem({ id: 4 }),
        dated(5, '2024-01-02'),
      ]
      const result = applyItemView(items, baseQuery({ sort: 'newest' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([2, 5, 1, 3, 4])
    })

    it('oldest: ASC by publishedAt, still with undated items last', () => {
      const items = [
        dated(1, '2024-01-01'),
        dated(2, '2024-01-03'),
        makeItem({ id: 3 }),
        makeItem({ id: 4 }),
        dated(5, '2024-01-02'),
      ]
      const result = applyItemView(items, baseQuery({ sort: 'oldest' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([1, 5, 2, 3, 4])
    })

    it('title: localeCompare', () => {
      const items = [
        makeItem({ id: 1, title: 'Charlie' }),
        makeItem({ id: 2, title: 'Alpha' }),
        makeItem({ id: 3, title: 'Bravo' }),
      ]
      const result = applyItemView(items, baseQuery({ sort: 'title' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([2, 3, 1])
    })

    it('fetched: DESC by fetchedAt', () => {
      const items = [
        makeItem({ id: 1, fetchedAt: new Date('2024-01-01') }),
        makeItem({ id: 2, fetchedAt: new Date('2024-01-03') }),
        makeItem({ id: 3, fetchedAt: new Date('2024-01-02') }),
      ]
      const result = applyItemView(items, baseQuery({ sort: 'fetched' }), 25)
      expect(result.items.map((i) => i.id)).toEqual([2, 3, 1])
    })
  })

  describe('paging', () => {
    const items = Array.from({ length: 7 }, (_, i) => makeItem({ id: i + 1 }))

    it('total counts the post-filter, pre-slice set', () => {
      const result = applyItemView(items, baseQuery({ page: 1 }), 3)
      expect(result.total).toBe(7)
      expect(result.items).toHaveLength(3)
    })

    it('the last page is short rather than padded', () => {
      const result = applyItemView(items, baseQuery({ page: 3 }), 3)
      expect(result.items).toHaveLength(1)
      expect(result.pageCount).toBe(3)
    })

    it('a page beyond pageCount yields an empty page rather than throwing', () => {
      const result = applyItemView(items, baseQuery({ page: 99 }), 3)
      expect(result.items).toEqual([])
      expect(result.total).toBe(7)
    })
  })

  describe('facets', () => {
    it('come from the unfiltered set, so a filter cannot empty the facet lists', () => {
      const items = [
        makeItem({ id: 1, sourceId: 10, tags: ['a'] }),
        makeItem({ id: 2, sourceId: 20, tags: ['b'] }),
      ]
      const titles = new Map([
        [10, 'Source A'],
        [20, 'Source B'],
      ])

      const result = applyItemView(items, baseQuery({ tags: ['a'] }), 25, {
        sourceTitleById: titles,
      })

      expect(result.items.map((i) => i.id)).toEqual([1])
      expect(result.facets.tags).toEqual(['a', 'b'])
      expect(result.facets.sources).toEqual([
        { id: 10, title: 'Source A' },
        { id: 20, title: 'Source B' },
      ])
    })
  })
})
