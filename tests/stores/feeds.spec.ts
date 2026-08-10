// @vitest-environment nuxt
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Feed,
  FeedListItem,
  FeedMemberDetail,
  Source,
} from '#shared/types'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const { useFeedsStore } = await import('~/stores/feeds')

function makeFeed(overrides: Partial<FeedListItem> = {}): FeedListItem {
  return {
    id: 1,
    name: 'Morning read',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 0,
    ...overrides,
  }
}

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Test source',
    managed: false,
    pagination: null,
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(
  overrides: Partial<FeedMemberDetail> = {},
): FeedMemberDetail {
  return {
    id: 1,
    feedId: 1,
    sourceId: 1,
    subfeedId: null,
    source: makeSource(),
    subfeed: null,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
})

describe('useFeedsStore', () => {
  it('fetchAll populates feeds on success', async () => {
    fetchMock.mockResolvedValue([makeFeed()])
    const store = useFeedsStore()

    await store.fetchAll()

    expect(store.feeds).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchAll sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Server error' })
    const store = useFeedsStore()

    await store.fetchAll()

    expect(store.feeds).toEqual([])
    expect(store.error).toBe('Server error')
  })

  it('fetchOne populates membersByFeed and returns the feed', async () => {
    const feed: Feed = {
      id: 1,
      name: 'Morning read',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    fetchMock.mockResolvedValue({ ...feed, members: [makeMember()] })
    const store = useFeedsStore()

    const result = await store.fetchOne(1)

    expect(result).toEqual(feed)
    expect(store.membersByFeed[1]).toHaveLength(1)
  })

  it('fetchOne sets error and errorStatus on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Not found', statusCode: 404 })
    const store = useFeedsStore()

    const result = await store.fetchOne(999)

    expect(result).toBeUndefined()
    expect(store.error).toBe('Not found')
    expect(store.errorStatus).toBe(404)
  })

  it('create refetches the list and returns the created feed', async () => {
    const created = makeFeed({ id: 2 })
    fetchMock
      .mockResolvedValueOnce(created) // POST
      .mockResolvedValueOnce([created]) // fetchAll refetch
    const store = useFeedsStore()

    const result = await store.create({ name: created.name })

    expect(result).toEqual(created)
    expect(store.feeds).toEqual([created])
  })

  it('create sets error and errorStatus on a 409', async () => {
    fetchMock.mockRejectedValue({
      statusMessage: 'A feed named "Morning read" already exists',
      statusCode: 409,
    })
    const store = useFeedsStore()

    const result = await store.create({ name: 'Morning read' })

    expect(result).toBeUndefined()
    expect(store.error).toBe('A feed named "Morning read" already exists')
    expect(store.errorStatus).toBe(409)
  })

  it('update preserves memberCount, since the PATCH response has none', async () => {
    const original = makeFeed({ id: 3, name: 'Old', memberCount: 2 })
    const patchResponse: Feed = {
      id: original.id,
      name: 'New',
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    }
    fetchMock.mockResolvedValue(patchResponse)
    const store = useFeedsStore()
    store.feeds = [original]

    await store.update(3, { name: 'New' })

    expect(store.feeds[0]!.name).toBe('New')
    expect(store.feeds[0]!.memberCount).toBe(2)
  })

  it('remove drops the feed and its members from state on success', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useFeedsStore()
    store.feeds = [makeFeed({ id: 4 })]
    store.membersByFeed[4] = [makeMember()]

    const ok = await store.remove(4)

    expect(ok).toBe(true)
    expect(store.feeds).toEqual([])
    expect(store.membersByFeed[4]).toBeUndefined()
  })

  it('remove keeps state and sets error on failure', async () => {
    fetchMock.mockRejectedValue({ statusMessage: 'Boom' })
    const store = useFeedsStore()
    const existing = makeFeed({ id: 5 })
    store.feeds = [existing]

    const ok = await store.remove(5)

    expect(ok).toBe(false)
    expect(store.feeds).toEqual([existing])
    expect(store.error).toBe('Boom')
  })

  it('addMember appends to membersByFeed and bumps memberCount', async () => {
    const member = makeMember({ id: 2 })
    fetchMock.mockResolvedValue(member)
    const store = useFeedsStore()
    store.feeds = [makeFeed({ id: 1, memberCount: 1 })]
    store.membersByFeed[1] = [makeMember({ id: 1 })]

    const result = await store.addMember(1, { sourceId: 1 })

    expect(result).toEqual(member)
    expect(store.membersByFeed[1]).toHaveLength(2)
    expect(store.feeds[0]!.memberCount).toBe(2)
  })

  it('addMember sets error and errorStatus on a 409', async () => {
    fetchMock.mockRejectedValue({
      statusMessage: '"Test source" is already a member of this feed',
      statusCode: 409,
    })
    const store = useFeedsStore()
    store.feeds = [makeFeed({ id: 1, memberCount: 1 })]
    store.membersByFeed[1] = [makeMember({ id: 1 })]

    const result = await store.addMember(1, { sourceId: 1 })

    expect(result).toBeUndefined()
    expect(store.errorStatus).toBe(409)
    expect(store.membersByFeed[1]).toHaveLength(1)
    expect(store.feeds[0]!.memberCount).toBe(1)
  })

  it('removeMember filters membersByFeed and decrements memberCount', async () => {
    fetchMock.mockResolvedValue(undefined)
    const store = useFeedsStore()
    store.feeds = [makeFeed({ id: 1, memberCount: 1 })]
    store.membersByFeed[1] = [makeMember({ id: 1 })]

    const ok = await store.removeMember(1, 1)

    expect(ok).toBe(true)
    expect(store.membersByFeed[1]).toEqual([])
    expect(store.feeds[0]!.memberCount).toBe(0)
  })

  it('refresh returns the aggregate summary from the API', async () => {
    const summary = {
      feedId: 1,
      members: [],
      seen: 4,
      inserted: 2,
      updated: 2,
      pagesFetched: 2,
    }
    fetchMock.mockResolvedValue(summary)
    const store = useFeedsStore()

    const result = await store.refresh(1)

    expect(result).toEqual(summary)
  })

  it('fetchItems returns the merged item list without touching state', async () => {
    fetchMock.mockResolvedValue([{ id: 1 }, { id: 2 }])
    const store = useFeedsStore()

    const result = await store.fetchItems(1)

    expect(result).toHaveLength(2)
  })
})
