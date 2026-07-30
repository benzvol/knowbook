// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceWithTags } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { default: SourcesIndexPage } = await import('~/pages/sources/index.vue')

function makeSource(overrides: Partial<SourceWithTags> = {}): SourceWithTags {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Source',
    type: 'standard',
    managed: false,
    categoryId: null,
    pagination: null,
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    ...overrides,
  }
}

const tech = { id: 1, name: 'Technology' }
const news = { id: 2, name: 'News' }
const dev = { id: 1, name: 'dev' }
const daily = { id: 2, name: 'daily' }

const sources = [
  makeSource({ id: 1, title: 'Hacker News', categoryId: tech.id, tags: [dev] }),
  makeSource({
    id: 2,
    title: 'BBC News',
    type: 'news',
    categoryId: news.id,
    tags: [daily],
  }),
  makeSource({ id: 3, title: 'Lobsters', categoryId: null, tags: [] }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  clearNuxtData('sources')
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/sources') return Promise.resolve(sources)
    if (url === '/api/categories') return Promise.resolve([tech, news])
    if (url === '/api/tags') return Promise.resolve([dev, daily])
    return Promise.resolve([])
  })
})

describe('sources list page', () => {
  it('filters by type', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    const typeSelect = wrapper.findComponent({ name: 'USelect' })
    await typeSelect.vm.$emit('update:modelValue', 'news')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('BBC News')
    expect(wrapper.text()).not.toContain('Hacker News')
  })

  it('applies AND semantics across selected tags', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    // No source carries both tags, so selecting both should match nothing.
    const tagFilter = wrapper.findComponent({ name: 'USelectMenu' })
    await tagFilter.vm.$emit('update:modelValue', [dev.id, daily.id])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No sources match these filters.')
  })

  it('groups by category with an Uncategorised section', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    const groupSwitch = wrapper.findComponent({ name: 'USwitch' })
    await groupSwitch.vm.$emit('update:modelValue', true)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Technology (1)')
    expect(wrapper.text()).toContain('News (1)')
    expect(wrapper.text()).toContain('Uncategorised (1)')
  })

  it('shows the no-sources-yet message distinct from no-matches', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/sources') return Promise.resolve([])
      return Promise.resolve([])
    })
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No sources yet. Add one to get started.')
    expect(wrapper.text()).not.toContain('No sources match these filters.')
  })
})
