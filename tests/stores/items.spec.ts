// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, ItemFacets, ItemPage } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useItemsStore } = await import('~/stores/items')

function makePage(
  overrides: Partial<ItemPage<Item> & { facets: ItemFacets }> = {},
): ItemPage<Item> & { facets: ItemFacets } {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    pageCount: 0,
    facets: { tags: [], sources: [] },
    ...overrides,
  }
}

function baseQuery() {
  return { tags: [], sourceIds: [], sort: 'newest' as const, page: 1 }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useItemsStore', () => {
  it('fetchItems populates the view keyed by kind and id', async () => {
    const page = makePage({ total: 2 })
    fetchMock.mockResolvedValue(page)
    const store = useItemsStore()

    const result = await store.fetchItems(
      { kind: 'source', id: 1 },
      baseQuery(),
    )

    expect(result).toEqual(page)
    expect(store.views['source:1']).toEqual(page)
    expect(store.error).toBeNull()
  })

  it('keeps two views independent', async () => {
    const sourcePage = makePage({ total: 1 })
    const subfeedPage = makePage({ total: 5 })
    fetchMock
      .mockResolvedValueOnce(sourcePage)
      .mockResolvedValueOnce(subfeedPage)
    const store = useItemsStore()

    await store.fetchItems({ kind: 'source', id: 1 }, baseQuery())
    await store.fetchItems({ kind: 'subfeed', id: 1 }, baseQuery())

    expect(store.views['source:1']).toEqual(sourcePage)
    expect(store.views['subfeed:1']).toEqual(subfeedPage)
  })

  it('a failed fetch sets error/errorStatus and leaves the previous page in place', async () => {
    const page = makePage({ total: 3 })
    fetchMock.mockResolvedValueOnce(page)
    const store = useItemsStore()
    await store.fetchItems({ kind: 'source', id: 1 }, baseQuery())

    fetchMock.mockRejectedValueOnce({
      statusMessage: 'Server error',
      statusCode: 500,
    })
    const result = await store.fetchItems(
      { kind: 'source', id: 1 },
      baseQuery(),
    )

    expect(result).toBeUndefined()
    expect(store.error).toBe('Server error')
    expect(store.errorStatus).toBe(500)
    expect(store.views['source:1']).toEqual(page)
  })

  it('searchDeep updates the view and records search meta', async () => {
    const page = makePage({ total: 1 })
    const search = {
      matched: true,
      pagesSearched: 2,
      capHit: false,
      counts: { seen: 2, inserted: 1, updated: 1, pagesFetched: 2 },
    }
    fetchMock.mockResolvedValue({ page, search })
    const store = useItemsStore()

    const result = await store.searchDeep(
      { kind: 'source', id: 1 },
      { ...baseQuery(), q: 'news' },
    )

    expect(result).toEqual(search)
    expect(store.views['source:1']).toEqual(page)
    expect(store.lastSearch['source:1']).toEqual(search)
  })

  it('searchDeep sets error on failure without touching views', async () => {
    const store = useItemsStore()
    fetchMock.mockRejectedValue({ statusMessage: 'Boom', statusCode: 500 })

    const result = await store.searchDeep(
      { kind: 'feed', id: 2 },
      { ...baseQuery(), q: 'news' },
    )

    expect(result).toBeUndefined()
    expect(store.error).toBe('Boom')
    expect(store.views['feed:2']).toBeUndefined()
  })
})
