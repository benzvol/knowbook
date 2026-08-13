// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useItemView } = await import('~/composables/useItemView')

function makePage() {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    pageCount: 0,
    facets: { tags: [], sources: [] },
  }
}

// Exposes the composable's return value on the instance, so the test can
// drive it directly without a full page around it.
const TestHost = defineComponent({
  props: { targetId: { type: Number, required: true } },
  setup(props) {
    const itemView = useItemView({ kind: 'source', id: props.targetId })
    return { itemView }
  },
  render() {
    return h('div')
  },
})

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(makePage())
})

describe('useItemView', () => {
  it('resets page to 1 when a filter/sort/search changes', async () => {
    const wrapper = await mountSuspended(TestHost, { props: { targetId: 1 } })
    const itemView = (
      wrapper.vm as unknown as { itemView: ReturnType<typeof useItemView> }
    ).itemView

    await itemView.setPage(3)
    expect(itemView.query.value.page).toBe(3)

    await itemView.patch({ sort: 'title' })
    expect(itemView.query.value.page).toBe(1)
    expect(itemView.query.value.sort).toBe('title')
  })

  it('does not reset the page when only the mode changes', async () => {
    const wrapper = await mountSuspended(TestHost, { props: { targetId: 2 } })
    const itemView = (
      wrapper.vm as unknown as { itemView: ReturnType<typeof useItemView> }
    ).itemView

    await itemView.setPage(3)
    expect(itemView.query.value.page).toBe(3)

    itemView.setMode('grid')
    expect(itemView.mode.value).toBe('grid')
    expect(itemView.query.value.page).toBe(3)
  })

  it('mode switching triggers no additional fetch', async () => {
    const wrapper = await mountSuspended(TestHost, { props: { targetId: 3 } })
    const itemView = (
      wrapper.vm as unknown as { itemView: ReturnType<typeof useItemView> }
    ).itemView

    fetchMock.mockClear()
    itemView.setMode('editorial')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
