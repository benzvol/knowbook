// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceListItem } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useSourcesStore } = await import('~/stores/sources')

function makeSource(overrides: Partial<SourceListItem> = {}): SourceListItem {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Test source',
    managed: false,
    pagination: null,
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    subfeedCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useSourcesStore', () => {
  it('fetchAll populates sources on success', async () => {
    fetchMock.mockResolvedValue([makeSource()])
    const store = useSourcesStore()

    await store.fetchAll()

    expect(store.sources).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchAll sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Server error' })
    const store = useSourcesStore()

    await store.fetchAll()

    expect(store.sources).toEqual([])
    expect(store.error).toBe('Server error')
  })

  it('create refetches the list and returns the created source', async () => {
    const created = makeSource({ id: 2 })
    fetchMock
      .mockResolvedValueOnce(created) // POST
      .mockResolvedValueOnce([created]) // fetchAll refetch
    const store = useSourcesStore()

    const result = await store.create({
      url: created.url,
      title: created.title,
    })

    expect(result).toEqual(created)
    expect(store.sources).toEqual([created])
  })

  it('update replaces the matching source in state', async () => {
    const original = makeSource({ id: 3, title: 'Old' })
    const updated = { ...original, title: 'New' }
    fetchMock.mockResolvedValue(updated)
    const store = useSourcesStore()
    store.sources = [original]

    const result = await store.update(3, { title: 'New' })

    expect(result?.title).toBe('New')
    expect(store.sources[0]!.title).toBe('New')
  })

  it('update preserves subfeedCount, since the PATCH response has none', async () => {
    const original = makeSource({ id: 3, title: 'Old', subfeedCount: 2 })
    // The PATCH response mirrors SourceWithTags: no `subfeedCount` field.
    const patchResponse: Omit<typeof original, 'subfeedCount'> = {
      id: original.id,
      url: original.url,
      title: 'New',
      managed: original.managed,
      pagination: original.pagination,
      queryParams: original.queryParams,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      tags: original.tags,
    }
    fetchMock.mockResolvedValue(patchResponse)
    const store = useSourcesStore()
    store.sources = [original]

    await store.update(3, { title: 'New' })

    expect(store.sources[0]!.subfeedCount).toBe(2)
  })

  it('remove drops the source from state on success', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useSourcesStore()
    store.sources = [makeSource({ id: 4 })]

    const ok = await store.remove(4)

    expect(ok).toBe(true)
    expect(store.sources).toEqual([])
  })

  it('remove keeps state and sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Boom' })
    const store = useSourcesStore()
    const existing = makeSource({ id: 5 })
    store.sources = [existing]

    const ok = await store.remove(5)

    expect(ok).toBe(false)
    expect(store.sources).toEqual([existing])
    expect(store.error).toBe('Boom')
  })

  it('refresh returns the summary from the API', async () => {
    const summary = {
      sourceId: 1,
      seen: 2,
      inserted: 1,
      updated: 1,
      pagesFetched: 1,
    }
    fetchMock.mockResolvedValue(summary)
    const store = useSourcesStore()

    const result = await store.refresh(1)

    expect(result).toEqual(summary)
  })

  it('setTags patches the tags on the matching source', async () => {
    const tags = [{ id: 1, name: 'dev' }]
    fetchMock.mockResolvedValue(tags)
    const store = useSourcesStore()
    store.sources = [makeSource({ id: 6 })]

    const result = await store.setTags(6, [1])

    expect(result).toEqual(tags)
    expect(store.sources[0]!.tags).toEqual(tags)
  })

  it('setTags sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Unknown tag ids: 9' })
    const store = useSourcesStore()
    store.sources = [makeSource({ id: 6 })]

    const result = await store.setTags(6, [9])

    expect(result).toBeUndefined()
    expect(store.error).toBe('Unknown tag ids: 9')
    expect(store.sources[0]!.tags).toEqual([])
  })
})
