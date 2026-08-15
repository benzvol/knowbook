// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedListItem } from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { default: FeedsIndexPage } = await import('~/pages/feeds/index.vue')

function makeFeed(overrides: Partial<FeedListItem> = {}): FeedListItem {
  return {
    id: 1,
    name: 'Developer',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 2,
    memberLabels: [],
    ...overrides,
  }
}

const feeds = [
  makeFeed({
    id: 1,
    name: 'Developer',
    memberCount: 2,
    memberLabels: ['Hacker News', 'Telex → G7'],
  }),
  makeFeed({ id: 2, name: 'Data', memberCount: 1, memberLabels: ['Telex'] }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  clearNuxtData('feeds')
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(url === '/api/feeds' ? feeds : []),
  )
})

describe('feeds list page', () => {
  it('links each feed name to its page', async () => {
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    const named = wrapper.findAll('a').filter((a) => a.text() === 'Developer')
    expect(named).toHaveLength(1)
    expect(named[0]!.attributes('href')).toBe('/feeds/1')
  })

  it('gives each row a dedicated Open button', async () => {
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    const opens = wrapper
      .findAll('a')
      .filter((a) => a.attributes('title') === 'Open')
      .map((a) => a.attributes('href'))

    expect(opens).toEqual(['/feeds/1', '/feeds/2'])
  })

  it('keeps the one-off actions in the row menu', async () => {
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    // The dropdown's items are portalled and only rendered once opened, so
    // assert on the `items` prop rather than the rendered text.
    const labels = (
      wrapper
        .findAllComponents({ name: 'UDropdownMenu' })[0]!
        .props('items') as { label: string }[]
    ).map((i) => i.label)

    expect(labels).toEqual(['Rename', 'Refresh', 'Delete'])
  })

  it('names the members rather than only counting them', async () => {
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Hacker News')
    expect(wrapper.text()).toContain('Telex → G7')
  })

  it('collapses members past the cap into a "+N more" chip', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/feeds'
          ? [
              makeFeed({
                id: 1,
                memberCount: 15,
                memberLabels: Array.from({ length: 15 }, (_, i) => `S${i + 1}`),
              }),
            ]
          : [],
      ),
    )
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('S1')
    expect(wrapper.text()).toContain('S3')
    expect(wrapper.text()).toContain('+12 more')
    // The 4th onwards are only in the overflow chip's title, not rendered.
    expect(wrapper.text()).not.toContain('S4')
  })

  it('shows the empty state when there are no feeds', async () => {
    fetchMock.mockImplementation(() => Promise.resolve([]))
    const wrapper = await mountSuspended(FeedsIndexPage)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No feeds yet.')
  })
})
