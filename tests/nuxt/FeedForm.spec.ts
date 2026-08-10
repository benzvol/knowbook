// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

const { default: FeedForm } = await import('~/components/feeds/FeedForm.vue')

describe('FeedForm', () => {
  it('blocks submit and shows an error when the name is missing', async () => {
    const wrapper = await mountSuspended(FeedForm)

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toMatch(/invalid|required/i)
  })

  it('emits submit with the filled payload when valid', async () => {
    const wrapper = await mountSuspended(FeedForm)

    await wrapper.find('input').setValue('Morning read')
    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]![0]).toMatchObject({ name: 'Morning read' })
  })

  it('seeds the input from a feed prop', async () => {
    const wrapper = await mountSuspended(FeedForm, {
      props: {
        feed: {
          id: 1,
          name: 'Morning read',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    })

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      'Morning read',
    )
  })

  it('surfaces a duplicate-name error on the name field', async () => {
    const wrapper = await mountSuspended(FeedForm, {
      props: { nameError: 'A feed named "Morning read" already exists' },
    })

    expect(wrapper.text()).toContain(
      'A feed named "Morning read" already exists',
    )
  })
})
