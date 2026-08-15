// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

const { default: ItemPager } = await import('~/components/items/ItemPager.vue')

describe('ItemPager', () => {
  it('shows "Search further pages" only for a paginated target with q set and no matches', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: true,
      },
    })

    expect(wrapper.text()).toContain('Search further pages')
  })

  it('hides the button when the target is not paginated', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: false,
      },
    })

    expect(wrapper.text()).not.toContain('Search further pages')
  })

  it('hides the button when there is no search term', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: false,
        paginated: true,
      },
    })

    expect(wrapper.text()).not.toContain('Search further pages')
  })

  it('hides the button when there are already matches', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 3,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: true,
      },
    })

    expect(wrapper.text()).not.toContain('Search further pages')
  })

  it('emits search-deep when clicked', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: true,
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('search-deep')).toBeTruthy()
  })

  it('paginates by items-per-page, so the page count matches the server page size', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 713,
        page: 1,
        pageSize: 25,
        hasQuery: false,
        paginated: true,
      },
    })

    // `page-count` is not a UPagination prop — passing it was silently ignored
    // and paged as if 10 items per page (72 pages for 713 items).
    const pagination = wrapper.findComponent({ name: 'UPagination' })
    expect(pagination.props('itemsPerPage')).toBe(25)
  })

  it('hides the deep-search affordance on a nav-only pager', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: true,
        navOnly: true,
      },
    })

    expect(wrapper.text()).not.toContain('Search further pages')
  })

  it('reports the page cap being hit', async () => {
    const wrapper = await mountSuspended(ItemPager, {
      props: {
        total: 0,
        page: 1,
        pageSize: 25,
        hasQuery: true,
        paginated: true,
        searchMeta: {
          matched: false,
          pagesSearched: 5,
          capHit: true,
          counts: { seen: 5, inserted: 5, updated: 0, pagesFetched: 5 },
        },
      },
    })

    expect(wrapper.text()).toContain('Stopped at the page cap')
  })
})
