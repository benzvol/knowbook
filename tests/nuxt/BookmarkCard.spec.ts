// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { BookmarkWithItem, Item } from '#shared/types'

const { default: BookmarkCard } =
  await import('~/components/bookmarks/BookmarkCard.vue')

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

describe('BookmarkCard', () => {
  it('shows the drag handle and enabled move actions in manual sort', async () => {
    const wrapper = await mountSuspended(BookmarkCard, {
      props: { bookmark: makeBookmark(), sort: 'manual' },
    })

    expect(wrapper.find('.bookmark-handle').exists()).toBe(true)
    const menu = wrapper.findComponent({ name: 'UDropdownMenu' })
    const items = menu.props('items') as {
      label: string
      disabled?: boolean
    }[][]
    const moveItems = items[0]!
    expect(moveItems.every((item) => !item.disabled)).toBe(true)
  })

  it('hides the drag handle and disables move actions outside manual sort', async () => {
    const wrapper = await mountSuspended(BookmarkCard, {
      props: { bookmark: makeBookmark(), sort: 'title' },
    })

    expect(wrapper.find('.bookmark-handle').exists()).toBe(false)
    const menu = wrapper.findComponent({ name: 'UDropdownMenu' })
    const items = menu.props('items') as {
      label: string
      disabled?: boolean
    }[][]
    const moveItems = items[0]!
    expect(moveItems.every((item) => item.disabled)).toBe(true)
  })

  it('emits move targets from the row menu', async () => {
    const wrapper = await mountSuspended(BookmarkCard, {
      props: { bookmark: makeBookmark(), sort: 'manual' },
    })

    const menu = wrapper.findComponent({ name: 'UDropdownMenu' })
    const items = menu.props('items') as {
      label: string
      onSelect?: () => void
    }[][]
    items[0]!.find((item) => item.label === 'Move to top')!.onSelect!()
    items[0]!.find((item) => item.label === 'Move to bottom')!.onSelect!()

    expect(wrapper.emitted('move')).toEqual([
      [{ to: 'first' }],
      [{ to: 'last' }],
    ])
  })

  it('emits remove when the delete row action is chosen', async () => {
    const wrapper = await mountSuspended(BookmarkCard, {
      props: { bookmark: makeBookmark(), sort: 'manual' },
    })

    const menu = wrapper.findComponent({ name: 'UDropdownMenu' })
    const items = menu.props('items') as {
      label: string
      onSelect?: () => void
    }[][]
    items[1]!.find((item) => item.label === 'Delete')!.onSelect!()

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('emits remove when the item card toggle is clicked', async () => {
    const wrapper = await mountSuspended(BookmarkCard, {
      props: { bookmark: makeBookmark(), sort: 'manual' },
    })

    await wrapper.find('button[aria-label="Remove bookmark"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})
