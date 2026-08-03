// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceListItem } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { default: SourcesIndexPage } = await import('~/pages/sources/index.vue')

function makeSource(overrides: Partial<SourceListItem> = {}): SourceListItem {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Source',
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

const dev = { id: 1, name: 'dev' }
const daily = { id: 2, name: 'daily' }
const world = { id: 3, name: 'world' }

const sources = [
  makeSource({ id: 1, title: 'Hacker News', tags: [dev] }),
  // Two tags on purpose, so grouping must repeat it. It deliberately does not
  // carry `dev`, so the AND-semantics test below still matches nothing.
  makeSource({ id: 2, title: 'BBC News', tags: [daily, world] }),
  makeSource({ id: 3, title: 'Lobsters', tags: [] }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  clearNuxtData('sources')
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/sources') return Promise.resolve(sources)
    // Unsorted on purpose: the grouped view must order the groups itself.
    if (url === '/api/tags') return Promise.resolve([dev, world, daily])
    return Promise.resolve([])
  })
})

describe('sources list page', () => {
  it('applies AND semantics across selected tags', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    // No source carries both tags, so selecting both should match nothing.
    const tagFilter = wrapper.findComponent({ name: 'USelectMenu' })
    await tagFilter.vm.$emit('update:modelValue', [dev.id, daily.id])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No sources match these filters.')
  })

  it('matches a source carrying every selected tag', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    const tagFilter = wrapper.findComponent({ name: 'USelectMenu' })
    await tagFilter.vm.$emit('update:modelValue', [daily.id, world.id])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('BBC News')
    expect(wrapper.text()).not.toContain('Hacker News')
    expect(wrapper.text()).not.toContain('Lobsters')
  })

  it('groups by tag, repeating multi-tagged sources, with a trailing Untagged section', async () => {
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    const groupSwitch = wrapper.findComponent({ name: 'USwitch' })
    await groupSwitch.vm.$emit('update:modelValue', true)
    await wrapper.vm.$nextTick()

    // The counts are load-bearing: the Tags column renders a badge per tag, so
    // the bare tag name appears in the text whether or not grouping works.
    expect(wrapper.text()).toContain('daily (1)')
    expect(wrapper.text()).toContain('dev (1)')
    expect(wrapper.text()).toContain('world (1)')
    expect(wrapper.text()).toContain('Untagged (1)')

    // One table per group, alphabetical by tag name with Untagged last. BBC News
    // appears twice because it carries two tags.
    const rowsPerGroup = wrapper
      .findAllComponents({ name: 'UTable' })
      .map((table) =>
        (table.props('data') as SourceListItem[]).map((s) => s.title),
      )

    expect(rowsPerGroup).toEqual([
      ['BBC News'], // daily
      ['Hacker News'], // dev
      ['BBC News'], // world
      ['Lobsters'], // Untagged
    ])
  })

  it('shows a subfeed count in the row menu when present', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/sources') {
        return Promise.resolve([
          makeSource({ id: 1, title: 'Hacker News', subfeedCount: 2 }),
          makeSource({ id: 2, title: 'BBC News', subfeedCount: 0 }),
        ])
      }
      return Promise.resolve([])
    })
    const wrapper = await mountSuspended(SourcesIndexPage)
    await wrapper.vm.$nextTick()

    // The dropdown's items are portalled and only rendered once opened, so
    // assert on the `items` prop rather than the rendered text.
    const menus = wrapper.findAllComponents({ name: 'UDropdownMenu' })
    const labelsByMenu = menus.map((menu) =>
      (menu.props('items') as { label: string }[]).map((i) => i.label),
    )

    expect(labelsByMenu[0]).toContain('Subfeeds (2)')
    expect(labelsByMenu[1]).toContain('Subfeeds')
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
