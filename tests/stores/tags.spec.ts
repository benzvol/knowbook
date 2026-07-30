// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tag } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useTagsStore } = await import('~/stores/tags')

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: 1, name: 'daily', ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useTagsStore', () => {
  it('fetchAll populates tags on success', async () => {
    fetchMock.mockResolvedValue([makeTag()])
    const store = useTagsStore()

    await store.fetchAll()

    expect(store.tags).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('fetchAll sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Server error' })
    const store = useTagsStore()

    await store.fetchAll()

    expect(store.tags).toEqual([])
    expect(store.error).toBe('Server error')
  })

  it('create appends the created tag', async () => {
    const created = makeTag({ id: 2, name: 'dev' })
    fetchMock.mockResolvedValue(created)
    const store = useTagsStore()

    const result = await store.create({ name: 'dev' })

    expect(result).toEqual(created)
    expect(store.tags).toEqual([created])
  })

  it('create sets a 409-shaped error on a duplicate name', async () => {
    fetchMock.mockRejectedValue({
      statusMessage: 'A tag named "daily" already exists',
    })
    const store = useTagsStore()

    const result = await store.create({ name: 'daily' })

    expect(result).toBeUndefined()
    expect(store.error).toBe('A tag named "daily" already exists')
  })

  it('update replaces the matching tag in state', async () => {
    const original = makeTag({ id: 3, name: 'old' })
    const updated = { ...original, name: 'new' }
    fetchMock.mockResolvedValue(updated)
    const store = useTagsStore()
    store.tags = [original]

    const result = await store.update(3, { name: 'new' })

    expect(result?.name).toBe('new')
    expect(store.tags[0]!.name).toBe('new')
  })

  it('remove drops the tag from state on success', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useTagsStore()
    store.tags = [makeTag({ id: 4 })]

    const ok = await store.remove(4)

    expect(ok).toBe(true)
    expect(store.tags).toEqual([])
  })

  it('remove keeps state and sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Boom' })
    const store = useTagsStore()
    const existing = makeTag({ id: 5 })
    store.tags = [existing]

    const ok = await store.remove(5)

    expect(ok).toBe(false)
    expect(store.tags).toEqual([existing])
    expect(store.error).toBe('Boom')
  })
})
