// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { ItemFacets } from '#shared/types'

const { default: ItemViewToolbar } =
  await import('~/components/items/ItemViewToolbar.vue')

function baseQuery(overrides: Partial<ItemQueryInput> = {}): ItemQueryInput {
  return { tags: [], sourceIds: [], sort: 'newest', page: 1, ...overrides }
}

const multiSourceFacets: ItemFacets = {
  tags: ['tech', 'news'],
  sources: [
    { id: 1, title: 'Hacker News' },
    { id: 2, title: 'BBC' },
  ],
}

const singleSourceFacets: ItemFacets = {
  tags: [],
  sources: [{ id: 1, title: 'Hacker News' }],
}

describe('ItemViewToolbar', () => {
  it('emits a patch with the new tags when the tag select changes', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: multiSourceFacets, query: baseQuery(), mode: 'list' },
    })

    const tagSelect = wrapper.findComponent({ name: 'USelectMenu' })
    await tagSelect.vm.$emit('update:modelValue', ['tech'])

    expect(wrapper.emitted('patch')).toContainEqual([{ tags: ['tech'] }])
  })

  it('emits a patch with the new sort when the sort select changes', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })

    const sortSelect = wrapper.findAllComponents({ name: 'USelect' })[0]!
    await sortSelect.vm.$emit('update:modelValue', 'title')

    expect(wrapper.emitted('patch')).toContainEqual([{ sort: 'title' }])
  })

  it('emits update:mode from the layout select', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })

    const selects = wrapper.findAllComponents({ name: 'USelect' })
    const layoutSelect = selects[selects.length - 1]!
    await layoutSelect.vm.$emit('update:modelValue', 'grid')

    expect(wrapper.emitted('update:mode')).toContainEqual(['grid'])
  })

  it('hides the source select for a single-source facet set', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })

    expect(wrapper.text()).not.toContain('Sources')
  })

  it('shows the source select when facets span more than one source', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: multiSourceFacets, query: baseQuery(), mode: 'list' },
    })

    expect(wrapper.text()).toContain('Sources')
  })
})
