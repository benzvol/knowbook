// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

const { default: SubfeedForm } = await import(
  '~/components/subfeeds/SubfeedForm.vue'
)

describe('SubfeedForm', () => {
  it('blocks submit and shows an error when the name is missing', async () => {
    const wrapper = await mountSuspended(SubfeedForm)

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toMatch(/invalid|required/i)
  })

  it('emits submit with the filled payload when valid', async () => {
    const wrapper = await mountSuspended(SubfeedForm)

    await wrapper.find('input').setValue('g7')

    await wrapper.find('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]![0]).toMatchObject({ name: 'g7' })
  })

  it('renders the effective merged params, including an overridden key', async () => {
    const wrapper = await mountSuspended(SubfeedForm, {
      props: {
        subfeed: {
          id: 1,
          sourceId: 1,
          name: 'g7',
          queryParams: { section: 'g7' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        parentQueryParams: { lang: 'en', section: 'a' },
      },
    })

    // `section` is overridden by the subfeed; `lang` is inherited untouched.
    expect(wrapper.text()).toContain('lang')
    expect(wrapper.text()).toContain('en')
    expect(wrapper.text()).toContain('section')
    expect(wrapper.text()).toContain('g7')
    expect(wrapper.text()).toContain('overrides parent')
  })

  it('surfaces a duplicate-name error on the name field', async () => {
    const wrapper = await mountSuspended(SubfeedForm, {
      props: { nameError: 'A subfeed named "g7" already exists' },
    })

    expect(wrapper.text()).toContain('A subfeed named "g7" already exists')
  })
})
