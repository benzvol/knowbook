// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { default: FeedMemberForm } =
  await import('~/components/feeds/FeedMemberForm.vue')

const sources = [
  { id: 1, title: 'Source A', url: 'https://a.example.com/feed' },
  { id: 2, title: 'Source B', url: 'https://b.example.com/feed' },
]
const subfeeds = [{ id: 7, sourceId: 1, name: 'g7' }]

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/sources') return Promise.resolve(sources)
    if (url === '/api/sources/1/subfeeds') return Promise.resolve(subfeeds)
    return Promise.resolve([])
  })
})

describe('FeedMemberForm', () => {
  it('disables the subfeed select until a source is chosen', async () => {
    const wrapper = await mountSuspended(FeedMemberForm)

    const menus = wrapper.findAllComponents({ name: 'USelectMenu' })
    const subfeedMenu = menus[1]!
    expect(subfeedMenu.props('disabled')).toBe(true)
  })

  it('lists that source’s subfeeds plus a whole-source option once a source is chosen', async () => {
    const wrapper = await mountSuspended(FeedMemberForm)

    const sourceMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[0]!
    await sourceMenu.vm.$emit('update:modelValue', 1)
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const subfeedMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[1]!
    expect(subfeedMenu.props('disabled')).toBe(false)
    const items = subfeedMenu.props('items') as { id: number; name: string }[]
    expect(items[0]).toMatchObject({ id: 0, name: 'Whole source' })
    expect(items).toContainEqual({ id: 7, sourceId: 1, name: 'g7' })
  })

  it('emits subfeedId: null for "Whole source"', async () => {
    const wrapper = await mountSuspended(FeedMemberForm)

    const sourceMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[0]!
    await sourceMenu.vm.$emit('update:modelValue', 2)
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]![0]).toMatchObject({ sourceId: 2, subfeedId: null })
  })

  it('emits the chosen subfeed id when one is picked', async () => {
    const wrapper = await mountSuspended(FeedMemberForm)

    const sourceMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[0]!
    await sourceMenu.vm.$emit('update:modelValue', 1)
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const subfeedMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[1]!
    await subfeedMenu.vm.$emit('update:modelValue', 7)
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted![0]![0]).toMatchObject({ sourceId: 1, subfeedId: 7 })
  })

  it('resets the subfeed choice back to "Whole source" when the source changes', async () => {
    const wrapper = await mountSuspended(FeedMemberForm)

    const sourceMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[0]!
    await sourceMenu.vm.$emit('update:modelValue', 1)
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    let subfeedMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[1]!
    await subfeedMenu.vm.$emit('update:modelValue', 7)
    await wrapper.vm.$nextTick()

    await sourceMenu.vm.$emit('update:modelValue', 2)
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    subfeedMenu = wrapper.findAllComponents({ name: 'USelectMenu' })[1]!
    expect(subfeedMenu.props('modelValue')).toBe(0)
  })

  it('surfaces a duplicate-membership error on the source field', async () => {
    const wrapper = await mountSuspended(FeedMemberForm, {
      props: { memberError: '"Source A" is already a member of this feed' },
    })

    expect(wrapper.text()).toContain(
      '"Source A" is already a member of this feed',
    )
  })
})
