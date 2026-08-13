import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, Source, Subfeed } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  getSource: vi.fn(),
  getSubfeed: vi.fn(),
  itemsForSource: vi.fn(),
  itemsForSubfeed: vi.fn(),
  feedMembers: vi.fn(),
}))
// applyItemView/matchesQuery stay real (pure, deterministic) — only the
// I/O-touching entry points are mocked, same spirit as the refresh mocks in
// tests/api/feeds.spec.ts.
vi.mock('~~/server/feed', async () => {
  const actual = await vi.importActual<object>('~~/server/feed')
  return {
    ...actual,
    feedItems: vi.fn(),
    searchSource: vi.fn(),
    searchSubfeed: vi.fn(),
    searchFeed: vi.fn(),
  }
})
vi.mock('~~/server/utils/settings', () => ({
  pageSizeSetting: vi.fn(() => 25),
  searchMaxPagesSetting: vi.fn(() => 5),
}))

const repos = await import('~~/server/db/repositories')
const feedModule = await import('~~/server/feed')
const settings = await import('~~/server/utils/settings')
const { FeedNotFoundError } = await import('~~/server/feed/errors')

const getSource = repos.getSource as ReturnType<typeof vi.fn>
const getSubfeed = repos.getSubfeed as ReturnType<typeof vi.fn>
const itemsForSource = repos.itemsForSource as ReturnType<typeof vi.fn>
const itemsForSubfeed = repos.itemsForSubfeed as ReturnType<typeof vi.fn>
const feedMembers = repos.feedMembers as ReturnType<typeof vi.fn>
const feedItems = feedModule.feedItems as ReturnType<typeof vi.fn>
const searchSource = feedModule.searchSource as ReturnType<typeof vi.fn>
const searchSubfeed = feedModule.searchSubfeed as ReturnType<typeof vi.fn>
const searchFeed = feedModule.searchFeed as ReturnType<typeof vi.fn>
const pageSizeSetting = settings.pageSizeSetting as ReturnType<typeof vi.fn>
const searchMaxPagesSetting = settings.searchMaxPagesSetting as ReturnType<
  typeof vi.fn
>

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

function makeSubfeed(overrides: Partial<Subfeed> = {}): Subfeed {
  return {
    id: 1,
    sourceId: 1,
    name: 'Test subfeed',
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    sourceId: 1,
    guid: 'g1',
    title: 'Title',
    description: null,
    link: null,
    publishedAt: null,
    tags: null,
    imageUrl: null,
    fetchedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  pageSizeSetting.mockReturnValue(25)
  searchMaxPagesSetting.mockReturnValue(5)
  app = createApp()
  const router = createRouter()

  const sourceItems = (await import('~~/server/api/sources/[id]/items.get'))
    .default
  const sourceSearch = (await import('~~/server/api/sources/[id]/search.post'))
    .default
  const subfeedItems = (await import('~~/server/api/subfeeds/[id]/items.get'))
    .default
  const subfeedSearch = (
    await import('~~/server/api/subfeeds/[id]/search.post')
  ).default
  const feedItemsRoute = (await import('~~/server/api/feeds/[id]/items.get'))
    .default
  const feedSearch = (await import('~~/server/api/feeds/[id]/search.post'))
    .default

  router.get('/api/sources/:id/items', sourceItems)
  router.post('/api/sources/:id/search', sourceSearch)
  router.get('/api/subfeeds/:id/items', subfeedItems)
  router.post('/api/subfeeds/:id/search', subfeedSearch)
  router.get('/api/feeds/:id/items', feedItemsRoute)
  router.post('/api/feeds/:id/search', feedSearch)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/sources/:id/items', () => {
  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/items'),
    )

    expect(res.status).toBe(404)
  })

  it('returns a paged result with facets', async () => {
    getSource.mockReturnValue(makeSource({ id: 1, title: 'Hacker News' }))
    itemsForSource.mockReturnValue([
      makeItem({ id: 1, title: 'A', tags: ['tech'] }),
      makeItem({ id: 2, title: 'B' }),
    ])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.items).toHaveLength(2)
    expect(body.facets.tags).toEqual(['tech'])
    expect(body.facets.sources).toEqual([{ id: 1, title: 'Hacker News' }])
  })

  it('returns 400 for an invalid sort', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items?sort=random'),
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when pageSize exceeds the cap', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items?pageSize=500'),
    )

    expect(res.status).toBe(400)
  })

  it('falls back to the pageSize setting when the query omits it', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([])
    pageSizeSetting.mockReturnValue(10)

    const res = await handler(
      new Request('http://localhost/api/sources/1/items'),
    )

    expect((await res.json()).pageSize).toBe(10)
  })

  it('parses repeated tags params with AND semantics', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([
      makeItem({ id: 1, tags: ['a'] }),
      makeItem({ id: 2, tags: ['a', 'b'] }),
    ])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items?tags=a&tags=b'),
    )

    const body = await res.json()
    expect(body.items.map((i: Item) => i.id)).toEqual([2])
  })

  it('parses comma-separated tags params with AND semantics', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([
      makeItem({ id: 1, tags: ['a'] }),
      makeItem({ id: 2, tags: ['a', 'b'] }),
    ])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items?tags=a,b'),
    )

    const body = await res.json()
    expect(body.items.map((i: Item) => i.id)).toEqual([2])
  })

  it('ignores a client-only mode param rather than 400ing', async () => {
    getSource.mockReturnValue(makeSource())
    itemsForSource.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/sources/1/items?mode=grid'),
    )

    expect(res.status).toBe(200)
  })
})

describe('GET /api/subfeeds/:id/items', () => {
  it('returns 404 when the subfeed does not exist', async () => {
    getSubfeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/subfeeds/999/items'),
    )

    expect(res.status).toBe(404)
  })

  it('returns a paged result of the subfeed’s own linked items', async () => {
    getSubfeed.mockReturnValue(makeSubfeed({ id: 1, sourceId: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    itemsForSubfeed.mockReturnValue([makeItem({ id: 1 })])

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1/items'),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).total).toBe(1)
    expect(itemsForSubfeed).toHaveBeenCalledWith(1)
  })
})

describe('GET /api/feeds/:id/items', () => {
  it('returns 404 when the feed does not exist', async () => {
    feedItems.mockImplementation(() => {
      throw new FeedNotFoundError(999)
    })

    const res = await handler(
      new Request('http://localhost/api/feeds/999/items'),
    )

    expect(res.status).toBe(404)
  })

  it('returns a paged result with member source titles in facets', async () => {
    feedItems.mockReturnValue([
      makeItem({ id: 1, sourceId: 1 }),
      makeItem({ id: 2, sourceId: 2 }),
    ])
    feedMembers.mockReturnValue([
      { id: 1, feedId: 1, sourceId: 1, subfeedId: null },
      { id: 2, feedId: 1, sourceId: 2, subfeedId: null },
    ])
    getSource.mockImplementation((id: number) =>
      makeSource({ id, title: `Source ${id}` }),
    )

    const res = await handler(new Request('http://localhost/api/feeds/1/items'))

    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.facets.sources).toEqual([
      { id: 1, title: 'Source 1' },
      { id: 2, title: 'Source 2' },
    ])
  })
})

describe('POST /api/sources/:id/search', () => {
  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/search?q=news', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
    expect(searchSource).not.toHaveBeenCalled()
  })

  it('returns 400 when q is missing', async () => {
    getSource.mockReturnValue(makeSource())

    const res = await handler(
      new Request('http://localhost/api/sources/1/search', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(400)
    expect(searchSource).not.toHaveBeenCalled()
  })

  it('forwards maxPages and surfaces capHit', async () => {
    getSource.mockReturnValue(makeSource({ id: 1 }))
    itemsForSource.mockReturnValue([])
    searchSource.mockResolvedValue({
      matched: false,
      pagesSearched: 3,
      capHit: true,
      counts: { seen: 3, inserted: 3, updated: 0, pagesFetched: 3 },
    })

    const res = await handler(
      new Request('http://localhost/api/sources/1/search?q=news&maxPages=3', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(200)
    expect(searchSource).toHaveBeenCalledWith(
      1,
      expect.any(Function),
      expect.objectContaining({ maxPages: 3 }),
    )
    const body = await res.json()
    expect(body.search.capHit).toBe(true)
  })

  it('falls back to the searchMaxPages setting when maxPages is omitted', async () => {
    getSource.mockReturnValue(makeSource({ id: 1 }))
    itemsForSource.mockReturnValue([])
    searchMaxPagesSetting.mockReturnValue(7)
    searchSource.mockResolvedValue({
      matched: false,
      pagesSearched: 0,
      capHit: false,
      counts: { seen: 0, inserted: 0, updated: 0, pagesFetched: 0 },
    })

    await handler(
      new Request('http://localhost/api/sources/1/search?q=news', {
        method: 'POST',
      }),
    )

    expect(searchSource).toHaveBeenCalledWith(
      1,
      expect.any(Function),
      expect.objectContaining({ maxPages: 7 }),
    )
  })
})

describe('POST /api/subfeeds/:id/search', () => {
  it('returns 404 when the subfeed does not exist', async () => {
    getSubfeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/subfeeds/999/search?q=news', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 when q is missing', async () => {
    getSubfeed.mockReturnValue(makeSubfeed())
    getSource.mockReturnValue(makeSource())

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1/search', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(400)
  })

  it('surfaces a matched search', async () => {
    getSubfeed.mockReturnValue(makeSubfeed({ id: 1, sourceId: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    itemsForSubfeed.mockReturnValue([makeItem({ id: 1 })])
    searchSubfeed.mockResolvedValue({
      matched: true,
      pagesSearched: 1,
      capHit: false,
      counts: { seen: 1, inserted: 1, updated: 0, pagesFetched: 1 },
    })

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1/search?q=news', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).search.matched).toBe(true)
  })
})

describe('POST /api/feeds/:id/search', () => {
  it('returns 404 when the feed does not exist', async () => {
    searchFeed.mockImplementation(() => {
      throw new FeedNotFoundError(999)
    })

    const res = await handler(
      new Request('http://localhost/api/feeds/999/search?q=news', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 when q is missing', async () => {
    const res = await handler(
      new Request('http://localhost/api/feeds/1/search', { method: 'POST' }),
    )

    expect(res.status).toBe(400)
    expect(searchFeed).not.toHaveBeenCalled()
  })

  it('surfaces capHit', async () => {
    searchFeed.mockResolvedValue({
      matched: false,
      pagesSearched: 5,
      capHit: true,
      counts: { seen: 5, inserted: 5, updated: 0, pagesFetched: 5 },
    })
    feedItems.mockReturnValue([])
    feedMembers.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/feeds/1/search?q=news', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).search.capHit).toBe(true)
  })
})
