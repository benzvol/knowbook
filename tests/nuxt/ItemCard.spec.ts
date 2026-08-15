// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { Item } from '#shared/types'

const { default: ItemCard } = await import('~/components/items/ItemCard.vue')

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

describe('ItemCard', () => {
  it('renders an image only when item.imageUrl is set', async () => {
    const withImage = await mountSuspended(ItemCard, {
      props: {
        item: makeItem({ imageUrl: 'https://img.example.com/a.jpg' }),
        mode: 'list',
      },
    })
    expect(withImage.find('img').exists()).toBe(true)

    const withoutImage = await mountSuspended(ItemCard, {
      props: { item: makeItem({ imageUrl: null }), mode: 'list' },
    })
    expect(withoutImage.find('img').exists()).toBe(false)
  })

  it('renders a link only when item.link is set', async () => {
    const withLink = await mountSuspended(ItemCard, {
      props: {
        item: makeItem({ link: 'https://example.com/a' }),
        mode: 'list',
      },
    })
    expect(withLink.find('a').exists()).toBe(true)

    const withoutLink = await mountSuspended(ItemCard, {
      props: { item: makeItem({ link: null }), mode: 'list' },
    })
    expect(withoutLink.find('a').exists()).toBe(false)
    expect(withoutLink.text()).toContain('A headline')
  })

  it('shows a placeholder block instead of a shorter card in grid mode when the view reserves media', async () => {
    const wrapper = await mountSuspended(ItemCard, {
      props: {
        item: makeItem({ imageUrl: null }),
        mode: 'grid',
        reserveMedia: true,
      },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    // The image-slot container still renders even with no image, so the
    // card keeps its full height alongside siblings that do have one.
    expect(wrapper.find('.aspect-video').exists()).toBe(true)
  })

  it('drops the grid placeholder entirely when nothing in the view has an image', async () => {
    const wrapper = await mountSuspended(ItemCard, {
      props: {
        item: makeItem({ imageUrl: null }),
        mode: 'grid',
        reserveMedia: false,
      },
    })

    expect(wrapper.find('.aspect-video').exists()).toBe(false)
  })

  it('hides the image slot entirely in list mode when there is no image', async () => {
    const wrapper = await mountSuspended(ItemCard, {
      props: { item: makeItem({ imageUrl: null }), mode: 'list' },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.aspect-video').exists()).toBe(false)
  })
})
