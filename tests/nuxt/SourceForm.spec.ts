// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { default: SourceForm } =
  await import('~/components/sources/SourceForm.vue')

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  fetchMock.mockResolvedValue([])
})

describe('SourceForm', () => {
  it('blocks submit and shows an error when required fields are missing', async () => {
    const wrapper = await mountSuspended(SourceForm)

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toMatch(/invalid|required/i)
  })

  it('emits submit with the filled payload when valid', async () => {
    const wrapper = await mountSuspended(SourceForm)

    await wrapper
      .find('input[placeholder]')
      .setValue('https://example.com/feed')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('My source')
    await inputs[1]!.setValue('https://example.com/feed')

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]![0]).toMatchObject({
      title: 'My source',
      url: 'https://example.com/feed',
      tagIds: [],
    })
  })

  describe('tag creation offer', () => {
    // USelectMenu only offers creation when its filtered list is empty, so the
    // form gates `create-item` itself. These assert on the resolved prop
    // because the menu's content is portalled and only mounted when open.
    const tags = [
      { id: 1, name: 'daily' },
      { id: 2, name: 'dev' },
    ]

    async function mountWithSearch(term: string) {
      fetchMock.mockResolvedValue(tags)
      const wrapper = await mountSuspended(SourceForm)
      const menu = wrapper.findComponent({ name: 'USelectMenu' })
      await menu.vm.$emit('update:searchTerm', term)
      await wrapper.vm.$nextTick()
      return wrapper.findComponent({ name: 'USelectMenu' })
    }

    it('offers creation for a substring of an existing tag', async () => {
      // `ai` matches `daily`, so the built-in empty-list rule would hide this.
      const menu = await mountWithSearch('ai')

      expect(menu.props('createItem')).toMatchObject({ position: 'bottom' })
    })

    it('withholds creation when a tag with that exact name exists', async () => {
      const menu = await mountWithSearch('daily')

      expect(menu.props('createItem')).toBe(false)
    })

    it('withholds creation for an exact name differing only in case', async () => {
      const menu = await mountWithSearch('DAILY')

      expect(menu.props('createItem')).toBe(false)
    })

    it('withholds creation below the two-character minimum', async () => {
      const menu = await mountWithSearch('a')

      expect(menu.props('createItem')).toBe(false)
    })

    it('ignores surrounding whitespace when deciding', async () => {
      const exact = await mountWithSearch('  daily  ')
      expect(exact.props('createItem')).toBe(false)

      const tooShort = await mountWithSearch('  a  ')
      expect(tooShort.props('createItem')).toBe(false)
    })

    it('selects the new tag and clears the search after creating', async () => {
      fetchMock.mockResolvedValueOnce(tags) // initial fetchAll
      const wrapper = await mountSuspended(SourceForm)
      const menu = wrapper.findComponent({ name: 'USelectMenu' })
      await menu.vm.$emit('update:searchTerm', 'ai')
      await wrapper.vm.$nextTick()

      fetchMock.mockResolvedValueOnce({ id: 3, name: 'ai' }) // POST /api/tags
      await menu.vm.$emit('create', 'ai')
      // `onCreateTag` awaits the store, so let the promise chain settle.
      await new Promise((resolve) => setTimeout(resolve, 0))
      await wrapper.vm.$nextTick()

      const updated = wrapper.findComponent({ name: 'USelectMenu' })
      expect(updated.props('modelValue')).toEqual([3])
      // Search cleared, so the create option no longer lingers.
      expect(updated.props('createItem')).toBe(false)
    })
  })

  it('pre-selects the tags of an existing source and includes them on submit', async () => {
    const wrapper = await mountSuspended(SourceForm, {
      props: {
        source: {
          id: 1,
          url: 'https://example.com/feed',
          title: 'My source',
          managed: false,
          pagination: null,
          queryParams: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 1, name: 'dev' }],
        },
      },
    })

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]![0]).toMatchObject({ tagIds: [1] })
  })
})
