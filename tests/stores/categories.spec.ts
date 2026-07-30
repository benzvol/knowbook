// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useCategoriesStore } = await import('~/stores/categories')

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 1, name: 'News', ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useCategoriesStore', () => {
  it('fetchAll populates categories on success', async () => {
    fetchMock.mockResolvedValue([makeCategory()])
    const store = useCategoriesStore()

    await store.fetchAll()

    expect(store.categories).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('fetchAll sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Server error' })
    const store = useCategoriesStore()

    await store.fetchAll()

    expect(store.categories).toEqual([])
    expect(store.error).toBe('Server error')
  })

  it('create appends the created category', async () => {
    const created = makeCategory({ id: 2, name: 'Tech' })
    fetchMock.mockResolvedValue(created)
    const store = useCategoriesStore()

    const result = await store.create({ name: 'Tech' })

    expect(result).toEqual(created)
    expect(store.categories).toEqual([created])
  })

  it('create sets a 409-shaped error on a duplicate name', async () => {
    fetchMock.mockRejectedValue({
      statusMessage: 'A category named "News" already exists',
    })
    const store = useCategoriesStore()

    const result = await store.create({ name: 'News' })

    expect(result).toBeUndefined()
    expect(store.error).toBe('A category named "News" already exists')
  })

  it('update replaces the matching category in state', async () => {
    const original = makeCategory({ id: 3, name: 'Old' })
    const updated = { ...original, name: 'New' }
    fetchMock.mockResolvedValue(updated)
    const store = useCategoriesStore()
    store.categories = [original]

    const result = await store.update(3, { name: 'New' })

    expect(result?.name).toBe('New')
    expect(store.categories[0]!.name).toBe('New')
  })

  it('remove drops the category from state on success', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useCategoriesStore()
    store.categories = [makeCategory({ id: 4 })]

    const ok = await store.remove(4)

    expect(ok).toBe(true)
    expect(store.categories).toEqual([])
  })

  it('remove keeps state and sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Boom' })
    const store = useCategoriesStore()
    const existing = makeCategory({ id: 5 })
    store.categories = [existing]

    const ok = await store.remove(5)

    expect(ok).toBe(false)
    expect(store.categories).toEqual([existing])
    expect(store.error).toBe('Boom')
  })
})
