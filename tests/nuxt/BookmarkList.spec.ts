// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import type { BookmarkWithItem, Item } from '#shared/types'

// The drag gesture itself isn't unit-testable in happy-dom (Sortable.js
// needs real pointer events) — `dropTarget`'s arithmetic is covered by
// tests/nuxt/bookmarkMove.spec.ts instead. Mocking useSortable here keeps
// this spec focused on the states BookmarkList itself owns.
vi.mock('@vueuse/integrations/useSortable', () => ({
  useSortable: () => ({ option: vi.fn() }),
  moveArrayElement: vi.fn(),
}))

const { default: BookmarkList } =
  await import('~/components/bookmarks/BookmarkList.vue')

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    sourceId: 1,
    guid: 'g1',
    title: 'A headline',
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

describe('BookmarkList', () => {
  it('shows the "no bookmarks yet" state when the unfiltered set is empty', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: { items: [], sort: 'manual', page: 1, isFiltered: false },
    })

    expect(wrapper.text()).toContain('No bookmarks yet')
  })

  it('shows the "nothing matches" state when a filter emptied the set', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: { items: [], sort: 'manual', page: 1, isFiltered: true },
    })

    expect(wrapper.text()).toContain('No bookmarks match this view.')
  })

  it('shows the error state', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: {
        items: [],
        sort: 'manual',
        page: 1,
        error: 'Something broke',
      },
    })

    expect(wrapper.text()).toContain('Something broke')
  })

  it('shows the loading state', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: { items: [], sort: 'manual', page: 1, loading: true },
    })

    expect(wrapper.text()).toContain('Loading…')
  })

  it('shows a hint to switch to manual sort when sort is not manual', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: { items: [makeBookmark()], sort: 'title', page: 1 },
    })

    expect(wrapper.text()).toContain('Switch sort to Manual')
  })

  it('shows no hint when already in manual sort', async () => {
    const wrapper = await mountSuspended(BookmarkList, {
      props: { items: [makeBookmark()], sort: 'manual', page: 1 },
    })

    expect(wrapper.text()).not.toContain('Switch sort to Manual')
  })
})
