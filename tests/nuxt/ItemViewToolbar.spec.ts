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

  it('emits update:mode from the layout buttons', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })

    const grid = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label') === 'Grid')!
    await grid.trigger('click')

    expect(wrapper.emitted('update:mode')).toContainEqual(['grid'])
  })

  it('labels every layout button for accessibility', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })

    const labels = wrapper
      .findAll('button')
      .map((b) => b.attributes('aria-label'))

    expect(labels).toContain('List')
    expect(labels).toContain('Grid')
    expect(labels).toContain('Editorial')
  })

  it('names the effective page size in the Default option', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: baseQuery(),
        mode: 'list',
        defaultPageSize: 25,
      },
    })

    const pageSizeSelect = wrapper.findAllComponents({ name: 'USelect' })[1]!
    const items = pageSizeSelect.props('items') as { label: string }[]
    expect(items[0]!.label).toBe('Default (25)')
  })

  it('clears an explicit page size back to the default', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: baseQuery({ pageSize: 50 }),
        mode: 'list',
        defaultPageSize: 25,
      },
    })

    // `0` is the sentinel for "no explicit size"; the schema's `min(1)` would
    // reject a literal 0, so it must reach the query as `undefined`.
    const pageSizeSelect = wrapper.findAllComponents({ name: 'USelect' })[1]!
    await pageSizeSelect.vm.$emit('update:modelValue', 0)

    expect(wrapper.emitted('patch')).toContainEqual([{ pageSize: undefined }])
  })

  it('shows a refresh button only when the view can refresh', async () => {
    const without = await mountSuspended(ItemViewToolbar, {
      props: { facets: singleSourceFacets, query: baseQuery(), mode: 'list' },
    })
    expect(without.text()).not.toContain('Refresh')

    const withRefresh = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: baseQuery(),
        mode: 'list',
        canRefresh: true,
      },
    })
    expect(withRefresh.text()).toContain('Refresh')
  })

  it('no longer carries a description that misaligns the Tags label', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: { facets: multiSourceFacets, query: baseQuery(), mode: 'list' },
    })

    expect(wrapper.text()).not.toContain('Shows items with all selected tags.')
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

  it('hides the mode switch when showModes is false', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: baseQuery(),
        showModes: false,
      },
    })

    const labels = wrapper
      .findAll('button')
      .map((b) => b.attributes('aria-label'))
    expect(labels).not.toContain('List')
    expect(labels).not.toContain('Grid')
    expect(labels).not.toContain('Editorial')
  })

  it('hides the refresh button when showRefresh is false, even if canRefresh', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: baseQuery(),
        mode: 'list',
        canRefresh: true,
        showRefresh: false,
      },
    })

    expect(wrapper.text()).not.toContain('Refresh')
  })

  it('accepts a custom sortOptions list', async () => {
    const wrapper = await mountSuspended(ItemViewToolbar, {
      props: {
        facets: singleSourceFacets,
        query: { tags: [], sourceIds: [], sort: 'manual', page: 1 },
        mode: 'list',
        sortOptions: [
          { label: 'Manual', value: 'manual' },
          { label: 'Saved', value: 'bookmarked' },
        ],
      },
    })

    const sortSelect = wrapper.findAllComponents({ name: 'USelect' })[0]!
    const items = sortSelect.props('items') as { label: string }[]
    expect(items.map((i) => i.label)).toEqual(['Manual', 'Saved'])
  })
})
