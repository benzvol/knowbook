// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Subfeed } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useSubfeedsStore } = await import('~/stores/subfeeds')

function makeSubfeed(overrides: Partial<Subfeed> = {}): Subfeed {
  return {
    id: 1,
    sourceId: 1,
    name: 'Test subfeed',
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useSubfeedsStore', () => {
  it('fetchForSource populates the per-source map on success', async () => {
    fetchMock.mockResolvedValue([makeSubfeed()])
    const store = useSubfeedsStore()

    await store.fetchForSource(1)

    expect(store.bySource[1]).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('fetchForSource sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Server error' })
    const store = useSubfeedsStore()

    await store.fetchForSource(1)

    expect(store.error).toBe('Server error')
  })

  it('create appends to the per-source map and returns the created subfeed', async () => {
    const created = makeSubfeed({ id: 2 })
    fetchMock.mockResolvedValue(created)
    const store = useSubfeedsStore()
    store.bySource[1] = [makeSubfeed({ id: 1 })]

    const result = await store.create(1, {
      name: created.name,
      queryParams: created.queryParams,
    })

    expect(result).toEqual(created)
    expect(store.bySource[1]).toHaveLength(2)
  })

  it('create sets error and errorStatus on a 409', async () => {
    fetchMock.mockRejectedValue({
      statusMessage: 'A subfeed named "g7" already exists',
      statusCode: 409,
    })
    const store = useSubfeedsStore()

    const result = await store.create(1, { name: 'g7' })

    expect(result).toBeUndefined()
    expect(store.error).toBe('A subfeed named "g7" already exists')
    expect(store.errorStatus).toBe(409)
  })

  it('update replaces the matching subfeed in the per-source map', async () => {
    const updated = makeSubfeed({ id: 3, name: 'renamed' })
    fetchMock.mockResolvedValue(updated)
    const store = useSubfeedsStore()
    store.bySource[1] = [makeSubfeed({ id: 3, name: 'old' })]

    const result = await store.update(1, 3, { name: 'renamed' })

    expect(result?.name).toBe('renamed')
    expect(store.bySource[1]![0]!.name).toBe('renamed')
  })

  it('remove drops the subfeed from the per-source map on success', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useSubfeedsStore()
    store.bySource[1] = [makeSubfeed({ id: 4 })]

    const ok = await store.remove(1, 4)

    expect(ok).toBe(true)
    expect(store.bySource[1]).toEqual([])
  })

  it('remove keeps state and sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Boom' })
    const store = useSubfeedsStore()
    const existing = makeSubfeed({ id: 5 })
    store.bySource[1] = [existing]

    const ok = await store.remove(1, 5)

    expect(ok).toBe(false)
    expect(store.bySource[1]).toEqual([existing])
    expect(store.error).toBe('Boom')
  })

  it('refresh returns the summary from the API', async () => {
    const summary = {
      subfeedId: 1,
      sourceId: 2,
      seen: 2,
      inserted: 1,
      updated: 1,
      pagesFetched: 1,
    }
    fetchMock.mockResolvedValue(summary)
    const store = useSubfeedsStore()

    const result = await store.refresh(1)

    expect(result).toEqual(summary)
  })
})
