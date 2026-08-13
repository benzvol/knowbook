import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Feed, FeedSource, Source, Subfeed } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  listFeedsWithCounts: vi.fn(),
  getFeed: vi.fn(),
  createFeed: vi.fn(),
  updateFeed: vi.fn(),
  deleteFeed: vi.fn(),
  findFeedByName: vi.fn(),
  feedMembers: vi.fn(),
  getFeedMember: vi.fn(),
  addFeedSource: vi.fn(),
  removeFeedSource: vi.fn(),
  getSource: vi.fn(),
  getSubfeed: vi.fn(),
}))
vi.mock('~~/server/feed', () => ({
  refreshFeed: vi.fn(),
}))

const repos = await import('~~/server/db/repositories')
const feedModule = await import('~~/server/feed')
const { FeedNotFoundError, SourceNotFoundError, SubfeedNotFoundError } =
  await import('~~/server/feed/errors')

const listFeedsWithCounts = repos.listFeedsWithCounts as ReturnType<
  typeof vi.fn
>
const getFeed = repos.getFeed as ReturnType<typeof vi.fn>
const createFeed = repos.createFeed as ReturnType<typeof vi.fn>
const updateFeed = repos.updateFeed as ReturnType<typeof vi.fn>
const deleteFeed = repos.deleteFeed as ReturnType<typeof vi.fn>
const findFeedByName = repos.findFeedByName as ReturnType<typeof vi.fn>
const feedMembers = repos.feedMembers as ReturnType<typeof vi.fn>
const getFeedMember = repos.getFeedMember as ReturnType<typeof vi.fn>
const addFeedSource = repos.addFeedSource as ReturnType<typeof vi.fn>
const removeFeedSource = repos.removeFeedSource as ReturnType<typeof vi.fn>
const getSource = repos.getSource as ReturnType<typeof vi.fn>
const getSubfeed = repos.getSubfeed as ReturnType<typeof vi.fn>
const refreshFeed = feedModule.refreshFeed as ReturnType<typeof vi.fn>

function makeFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    name: 'Morning read',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeFeedSource(overrides: Partial<FeedSource> = {}): FeedSource {
  return {
    id: 1,
    feedId: 1,
    sourceId: 1,
    subfeedId: null,
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

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  app = createApp()
  const router = createRouter()

  const list = (await import('~~/server/api/feeds/index.get')).default
  const create = (await import('~~/server/api/feeds/index.post')).default
  const getOne = (await import('~~/server/api/feeds/[id].get')).default
  const patchOne = (await import('~~/server/api/feeds/[id].patch')).default
  const deleteOne = (await import('~~/server/api/feeds/[id].delete')).default
  const membersGet = (await import('~~/server/api/feeds/[id]/members.get'))
    .default
  const membersPost = (await import('~~/server/api/feeds/[id]/members.post'))
    .default
  const refresh = (await import('~~/server/api/feeds/[id]/refresh.post'))
    .default
  const deleteMember = (await import('~~/server/api/feed-members/[id].delete'))
    .default

  router.get('/api/feeds', list)
  router.post('/api/feeds', create)
  router.get('/api/feeds/:id', getOne)
  router.patch('/api/feeds/:id', patchOne)
  router.delete('/api/feeds/:id', deleteOne)
  router.get('/api/feeds/:id/members', membersGet)
  router.post('/api/feeds/:id/members', membersPost)
  router.post('/api/feeds/:id/refresh', refresh)
  router.delete('/api/feed-members/:id', deleteMember)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/feeds', () => {
  it('returns the feed list with member counts', async () => {
    listFeedsWithCounts.mockReturnValue([{ ...makeFeed(), memberCount: 2 }])

    const res = await handler(new Request('http://localhost/api/feeds'))

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})

describe('POST /api/feeds', () => {
  it('returns 400 for an invalid payload', async () => {
    const res = await handler(
      new Request('http://localhost/api/feeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createFeed).not.toHaveBeenCalled()
  })

  it('returns 400 when the body carries a feedId', async () => {
    const res = await handler(
      new Request('http://localhost/api/feeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'F', feedId: 2 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createFeed).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name', async () => {
    findFeedByName.mockReturnValue(makeFeed())

    const res = await handler(
      new Request('http://localhost/api/feeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Morning read' }),
      }),
    )

    expect(res.status).toBe(409)
    expect(createFeed).not.toHaveBeenCalled()
  })

  it('creates a feed and returns 201', async () => {
    findFeedByName.mockReturnValue(undefined)
    createFeed.mockReturnValue(makeFeed({ id: 5 }))

    const res = await handler(
      new Request('http://localhost/api/feeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Morning read' }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createFeed).toHaveBeenCalledWith({ name: 'Morning read' })
    expect((await res.json()).id).toBe(5)
  })
})

describe('GET /api/feeds/:id', () => {
  it('returns 404 when the feed does not exist', async () => {
    getFeed.mockReturnValue(undefined)

    const res = await handler(new Request('http://localhost/api/feeds/999'))

    expect(res.status).toBe(404)
  })

  it('hydrates a whole-source member with source and a null subfeed', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    feedMembers.mockReturnValue([
      makeFeedSource({ id: 1, feedId: 1, sourceId: 1, subfeedId: null }),
    ])
    getSource.mockReturnValue(makeSource({ id: 1 }))

    const res = await handler(new Request('http://localhost/api/feeds/1'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.members).toHaveLength(1)
    expect(body.members[0].subfeed).toBeNull()
    expect(body.members[0].source.id).toBe(1)
    expect(getSubfeed).not.toHaveBeenCalled()
  })

  it('hydrates a narrowed member with its subfeed', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    feedMembers.mockReturnValue([
      makeFeedSource({ id: 1, feedId: 1, sourceId: 1, subfeedId: 7 }),
    ])
    getSource.mockReturnValue(makeSource({ id: 1 }))
    getSubfeed.mockReturnValue(makeSubfeed({ id: 7, sourceId: 1 }))

    const res = await handler(new Request('http://localhost/api/feeds/1'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.members[0].subfeed.id).toBe(7)
  })
})

describe('PATCH /api/feeds/:id', () => {
  it('returns 404 when the feed does not exist', async () => {
    getFeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feeds/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    )

    expect(res.status).toBe(404)
    expect(updateFeed).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid payload', async () => {
    getFeed.mockReturnValue(makeFeed())

    const res = await handler(
      new Request('http://localhost/api/feeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(updateFeed).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name, excluding itself', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    findFeedByName.mockReturnValue(makeFeed({ id: 2 }))

    const res = await handler(
      new Request('http://localhost/api/feeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'taken' }),
      }),
    )

    expect(res.status).toBe(409)
    expect(findFeedByName).toHaveBeenCalledWith('taken', 1)
    expect(updateFeed).not.toHaveBeenCalled()
  })

  it('renames the feed', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    findFeedByName.mockReturnValue(undefined)
    updateFeed.mockReturnValue(makeFeed({ id: 1, name: 'renamed' }))

    const res = await handler(
      new Request('http://localhost/api/feeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('renamed')
  })
})

describe('DELETE /api/feeds/:id', () => {
  it('deletes and returns 204', async () => {
    const res = await handler(
      new Request('http://localhost/api/feeds/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteFeed).toHaveBeenCalledWith(1)
  })
})

describe('GET /api/feeds/:id/members', () => {
  it('returns 404 when the feed does not exist', async () => {
    getFeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feeds/999/members'),
    )

    expect(res.status).toBe(404)
    expect(feedMembers).not.toHaveBeenCalled()
  })

  it("returns the feed's membership rows", async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    feedMembers.mockReturnValue([makeFeedSource()])

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members'),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})

describe('POST /api/feeds/:id/members', () => {
  it('returns 404 when the feed does not exist', async () => {
    getFeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feeds/999/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1 }),
      }),
    )

    expect(res.status).toBe(404)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid payload', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: -1 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 400 when the body carries a feedId', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1, feedId: 2 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 404 when the sourceId does not exist', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 999 }),
      }),
    )

    expect(res.status).toBe(404)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 404 when the subfeedId does not exist', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    getSubfeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1, subfeedId: 999 }),
      }),
    )

    expect(res.status).toBe(404)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 400 when the subfeed does not belong to the given source', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    getSubfeed.mockReturnValue(makeSubfeed({ id: 7, sourceId: 2 }))

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1, subfeedId: 7 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(addFeedSource).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate membership (unique constraint)', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    addFeedSource.mockImplementation(() => {
      throw { code: 'SQLITE_CONSTRAINT_UNIQUE' }
    })

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1 }),
      }),
    )

    expect(res.status).toBe(409)
  })

  it('adds a whole-source member and returns 201', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    addFeedSource.mockReturnValue(
      makeFeedSource({ id: 9, feedId: 1, sourceId: 1, subfeedId: null }),
    )

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1 }),
      }),
    )

    expect(res.status).toBe(201)
    expect(addFeedSource).toHaveBeenCalledWith(1, 1, null)
    const body = await res.json()
    expect(body.id).toBe(9)
    expect(body.subfeed).toBeNull()
  })

  it('adds a subfeed-narrowed member and returns 201', async () => {
    getFeed.mockReturnValue(makeFeed({ id: 1 }))
    getSource.mockReturnValue(makeSource({ id: 1 }))
    getSubfeed.mockReturnValue(makeSubfeed({ id: 7, sourceId: 1 }))
    addFeedSource.mockReturnValue(
      makeFeedSource({ id: 9, feedId: 1, sourceId: 1, subfeedId: 7 }),
    )

    const res = await handler(
      new Request('http://localhost/api/feeds/1/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 1, subfeedId: 7 }),
      }),
    )

    expect(res.status).toBe(201)
    expect(addFeedSource).toHaveBeenCalledWith(1, 1, 7)
    const body = await res.json()
    expect(body.subfeed.id).toBe(7)
  })
})

describe('DELETE /api/feed-members/:id', () => {
  it('returns 404 when the member does not exist', async () => {
    getFeedMember.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/feed-members/999', {
        method: 'DELETE',
      }),
    )

    expect(res.status).toBe(404)
    expect(removeFeedSource).not.toHaveBeenCalled()
  })

  it('deletes and returns 204', async () => {
    getFeedMember.mockReturnValue(makeFeedSource({ id: 1 }))

    const res = await handler(
      new Request('http://localhost/api/feed-members/1', {
        method: 'DELETE',
      }),
    )

    expect(res.status).toBe(204)
    expect(removeFeedSource).toHaveBeenCalledWith(1)
  })
})

describe('POST /api/feeds/:id/refresh', () => {
  it('returns the aggregate refresh summary', async () => {
    refreshFeed.mockResolvedValue({
      feedId: 1,
      members: [],
      seen: 4,
      inserted: 2,
      updated: 2,
      pagesFetched: 2,
    })

    const res = await handler(
      new Request('http://localhost/api/feeds/1/refresh', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ seen: 4, inserted: 2, updated: 2 })
  })

  it('forwards maxPages to refreshFeed', async () => {
    refreshFeed.mockResolvedValue({
      feedId: 1,
      members: [],
      seen: 0,
      inserted: 0,
      updated: 0,
      pagesFetched: 0,
    })

    await handler(
      new Request('http://localhost/api/feeds/1/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ maxPages: 2 }),
      }),
    )

    expect(refreshFeed).toHaveBeenCalledWith(1, { maxPages: 2 })
  })

  it('maps a feed-not-found error to 404', async () => {
    refreshFeed.mockRejectedValue(new FeedNotFoundError(999))

    const res = await handler(
      new Request('http://localhost/api/feeds/999/refresh', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })

  it('maps a member source-not-found error to 404', async () => {
    refreshFeed.mockRejectedValue(new SourceNotFoundError(2))

    const res = await handler(
      new Request('http://localhost/api/feeds/1/refresh', { method: 'POST' }),
    )

    expect(res.status).toBe(404)
  })

  it('maps a member subfeed-not-found error to 404', async () => {
    refreshFeed.mockRejectedValue(new SubfeedNotFoundError(3))

    const res = await handler(
      new Request('http://localhost/api/feeds/1/refresh', { method: 'POST' }),
    )

    expect(res.status).toBe(404)
  })
})
