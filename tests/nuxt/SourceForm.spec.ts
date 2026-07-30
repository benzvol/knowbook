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
