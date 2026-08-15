// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { Item } from '#shared/types'

const { default: ItemList } = await import('~/components/items/ItemList.vue')

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

describe('ItemList', () => {
  it('reserves the grid media slot when at least one item has an image', async () => {
    const wrapper = await mountSuspended(ItemList, {
      props: {
        mode: 'grid',
        items: [
          makeItem({ id: 1, imageUrl: 'https://img.example.com/a.jpg' }),
          makeItem({ id: 2, imageUrl: null }),
        ],
      },
    })

    // The imageless card keeps a placeholder so the grid stays uniform.
    expect(wrapper.findAll('.aspect-video')).toHaveLength(2)
  })

  it('reserves nothing when no item in the view has an image', async () => {
    const wrapper = await mountSuspended(ItemList, {
      props: {
        mode: 'grid',
        items: [
          makeItem({ id: 1, imageUrl: null }),
          makeItem({ id: 2, imageUrl: null }),
        ],
      },
    })

    expect(wrapper.findAll('.aspect-video')).toHaveLength(0)
  })

  it('shows the shared empty state regardless of mode', async () => {
    const wrapper = await mountSuspended(ItemList, {
      props: { mode: 'grid', items: [] },
    })

    expect(wrapper.text()).toContain('No items match this view.')
  })
})
