// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BookmarkWithItem,
  Item,
  ItemFacets,
  ItemPage,
} from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useBookmarksStore } = await import('~/stores/bookmarks')

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

function makeBookmark(
  overrides: Partial<BookmarkWithItem> = {},
): BookmarkWithItem {
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

function makePage(
  overrides: Partial<
    ItemPage<BookmarkWithItem> & { facets: ItemFacets; defaultPageSize: number }
  > = {},
) {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    pageCount: 0,
    facets: { tags: [], sources: [] },
    defaultPageSize: 25,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useBookmarksStore', () => {
  describe('toggle', () => {
    it('adds then removes, keeping bookmarkedItemIds in step without refetching the page', async () => {
      const store = useBookmarksStore()
      store.page = makePage()

      fetchMock.mockResolvedValueOnce(makeBookmark({ id: 1, itemId: 42 }))
      await store.toggle(42)
      expect(store.bookmarkedItemIds.has(42)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('/api/bookmarks', {
        method: 'POST',
        body: { itemId: 42 },
      })

      fetchMock.mockResolvedValueOnce(undefined)
      await store.toggle(42)
      expect(store.bookmarkedItemIds.has(42)).toBe(false)
      expect(fetchMock).toHaveBeenCalledWith('/api/bookmarks/1', {
        method: 'DELETE',
      })

      // Neither call touched the page fetch endpoint.
      const pageCalls = fetchMock.mock.calls.filter(
        ([url]) => url === '/api/bookmarks',
      )
      expect(pageCalls.every(([, opts]) => opts?.method === 'POST')).toBe(true)
    })
  })

  describe('move', () => {
    it('sets error and leaves the caller to restore order on failure', async () => {
      const store = useBookmarksStore()
      fetchMock.mockRejectedValueOnce({
        statusCode: 404,
        statusMessage: 'Bookmark not found',
      })

      const result = await store.move(1, { to: 'first' })

      expect(result).toBeUndefined()
      expect(store.error).toBe('Bookmark not found')
      expect(store.errorStatus).toBe(404)
    })

    it('returns the new ref order on success', async () => {
      const store = useBookmarksStore()
      const refs = [
        { id: 2, itemId: 20 },
        { id: 1, itemId: 10 },
      ]
      fetchMock.mockResolvedValueOnce(refs)

      const result = await store.move(1, { to: 'first' })

      expect(result).toEqual(refs)
      expect(store.error).toBeNull()
    })
  })

  describe('fetchPage', () => {
    it('leaves the previous page in place on a failed fetch', async () => {
      const store = useBookmarksStore()
      const previous = makePage({ total: 3 })
      store.page = previous

      fetchMock.mockRejectedValueOnce({
        statusCode: 500,
        statusMessage: 'Server error',
      })

      const result = await store.fetchPage({
        tags: [],
        sourceIds: [],
        sort: 'manual',
        page: 1,
      })

      expect(result).toBeUndefined()
      expect(store.page).toEqual(previous)
      expect(store.error).toBe('Server error')
    })

    it('replaces the page on success', async () => {
      const store = useBookmarksStore()
      const fresh = makePage({ total: 5 })
      fetchMock.mockResolvedValueOnce(fresh)

      const result = await store.fetchPage({
        tags: [],
        sourceIds: [],
        sort: 'manual',
        page: 1,
      })

      expect(result).toEqual(fresh)
      expect(store.page).toEqual(fresh)
    })
  })

  describe('updateTags', () => {
    it('replaces the items array reference, not just the row in place', async () => {
      const store = useBookmarksStore()
      const row = makeBookmark({ id: 1, tags: null })
      store.page = makePage({ items: [row] })
      const previousItems = store.page.items

      fetchMock.mockResolvedValueOnce(makeBookmark({ id: 1, tags: ['rust'] }))
      await store.updateTags(1, ['rust'])

      // A consumer that copies `page.items` into its own ref (as
      // BookmarkSortableList does) only re-syncs on a watcher comparing by
      // reference — an in-place index assignment would never trigger it.
      expect(store.page?.items).not.toBe(previousItems)
      expect(store.page?.items[0]?.tags).toEqual(['rust'])
    })
  })

  describe('fetchRefs', () => {
    it('populates refs and the derived getters', async () => {
      const store = useBookmarksStore()
      fetchMock.mockResolvedValueOnce([
        { id: 1, itemId: 10 },
        { id: 2, itemId: 20 },
      ])

      await store.fetchRefs()

      expect(store.bookmarkedItemIds).toEqual(new Set([10, 20]))
      expect(store.refByItemId.get(10)).toEqual({ id: 1, itemId: 10 })
    })
  })
})
