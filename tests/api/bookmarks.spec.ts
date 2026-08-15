import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookmarkWithItem, Item, Source } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  listBookmarksWithItems: vi.fn(),
  listBookmarkRefs: vi.fn(),
  listSources: vi.fn(),
  getItem: vi.fn(),
  getBookmark: vi.fn(),
  getBookmarkWithItem: vi.fn(),
  createBookmark: vi.fn(),
  updateBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  moveBookmark: vi.fn(),
}))
vi.mock('~~/server/utils/settings', () => ({
  pageSizeSetting: vi.fn(() => 25),
}))

const repos = await import('~~/server/db/repositories')
const settings = await import('~~/server/utils/settings')

const listBookmarksWithItems = repos.listBookmarksWithItems as ReturnType<
  typeof vi.fn
>
const listBookmarkRefs = repos.listBookmarkRefs as ReturnType<typeof vi.fn>
const listSources = repos.listSources as ReturnType<typeof vi.fn>
const getItem = repos.getItem as ReturnType<typeof vi.fn>
const getBookmark = repos.getBookmark as ReturnType<typeof vi.fn>
const getBookmarkWithItem = repos.getBookmarkWithItem as ReturnType<
  typeof vi.fn
>
const createBookmark = repos.createBookmark as ReturnType<typeof vi.fn>
const updateBookmark = repos.updateBookmark as ReturnType<typeof vi.fn>
const deleteBookmark = repos.deleteBookmark as ReturnType<typeof vi.fn>
const moveBookmark = repos.moveBookmark as ReturnType<typeof vi.fn>
const pageSizeSetting = settings.pageSizeSetting as ReturnType<typeof vi.fn>

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

function makeBookmark(
  overrides: Partial<BookmarkWithItem> = {},
): BookmarkWithItem {
  const { item: itemOverrides, ...rest } = overrides
  return {
    id: 1,
    itemId: 1,
    sortOrder: 0,
    tags: null,
    createdAt: new Date('2024-01-01'),
    item: makeItem(itemOverrides),
    ...rest,
  }
}

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  pageSizeSetting.mockReturnValue(25)
  app = createApp()
  const router = createRouter()

  const getIndex = (await import('~~/server/api/bookmarks/index.get')).default
  const postIndex = (await import('~~/server/api/bookmarks/index.post')).default
  const refs = (await import('~~/server/api/bookmarks/refs.get')).default
  const patchOne = (await import('~~/server/api/bookmarks/[id].patch')).default
  const deleteOne = (await import('~~/server/api/bookmarks/[id].delete'))
    .default
  const move = (await import('~~/server/api/bookmarks/[id]/move.post')).default

  router.get('/api/bookmarks', getIndex)
  router.post('/api/bookmarks', postIndex)
  router.get('/api/bookmarks/refs', refs)
  router.patch('/api/bookmarks/:id', patchOne)
  router.delete('/api/bookmarks/:id', deleteOne)
  router.post('/api/bookmarks/:id/move', move)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/bookmarks', () => {
  it('defaults to sort=manual and returns a paged result with facets', async () => {
    listBookmarksWithItems.mockReturnValue([
      makeBookmark({ id: 1, sortOrder: 1, item: makeItem({ id: 1 }) }),
      makeBookmark({ id: 2, sortOrder: 0, item: makeItem({ id: 2 }) }),
    ])
    listSources.mockReturnValue([makeSource({ id: 1, title: 'Hacker News' })])

    const res = await handler(new Request('http://localhost/api/bookmarks'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    // manual order: sortOrder 0 (id 2) before sortOrder 1 (id 1)
    expect(body.items.map((b: BookmarkWithItem) => b.id)).toEqual([2, 1])
  })

  it('returns 400 on sort=fetched (dropped for bookmarks)', async () => {
    listBookmarksWithItems.mockReturnValue([])
    listSources.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/bookmarks?sort=fetched'),
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when pageSize exceeds the cap', async () => {
    listBookmarksWithItems.mockReturnValue([])
    listSources.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/bookmarks?pageSize=500'),
    )

    expect(res.status).toBe(400)
  })

  it('falls back to the pageSize setting when the query omits it', async () => {
    listBookmarksWithItems.mockReturnValue([])
    listSources.mockReturnValue([])
    pageSizeSetting.mockReturnValue(10)

    const res = await handler(new Request('http://localhost/api/bookmarks'))

    expect((await res.json()).pageSize).toBe(10)
  })
})

describe('POST /api/bookmarks', () => {
  it('creates a bookmark and returns 201', async () => {
    const item = makeItem({ id: 5 })
    getItem.mockReturnValue(item)
    createBookmark.mockReturnValue(makeBookmark({ id: 1, itemId: 5 }))

    const res = await handler(
      new Request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 5 }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createBookmark).toHaveBeenCalledWith({
      itemId: 5,
      tags: undefined,
    })
  })

  it('returns 400 without an itemId', async () => {
    const res = await handler(
      new Request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )

    expect(res.status).toBe(400)
    expect(createBookmark).not.toHaveBeenCalled()
  })

  it('strips a client-supplied sortOrder', async () => {
    getItem.mockReturnValue(makeItem({ id: 5 }))
    createBookmark.mockReturnValue(makeBookmark({ id: 1, itemId: 5 }))

    await handler(
      new Request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 5, sortOrder: 999 }),
      }),
    )

    expect(createBookmark).toHaveBeenCalledWith({
      itemId: 5,
      tags: undefined,
    })
  })

  it('returns 404 when the item does not exist', async () => {
    getItem.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 999 }),
      }),
    )

    expect(res.status).toBe(404)
    expect(createBookmark).not.toHaveBeenCalled()
  })

  it('returns 409 on a unique violation', async () => {
    getItem.mockReturnValue(makeItem({ id: 5 }))
    createBookmark.mockImplementation(() => {
      throw { code: 'SQLITE_CONSTRAINT_UNIQUE' }
    })

    const res = await handler(
      new Request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: 5 }),
      }),
    )

    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/bookmarks/:id', () => {
  it('updates tags', async () => {
    updateBookmark.mockReturnValue(makeBookmark({ id: 1, tags: ['rust'] }))
    getBookmarkWithItem.mockReturnValue(makeBookmark({ id: 1, tags: ['rust'] }))

    const res = await handler(
      new Request('http://localhost/api/bookmarks/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tags: ['rust'] }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).tags).toEqual(['rust'])
  })

  it('rejects an unrecognised key (strict)', async () => {
    const res = await handler(
      new Request('http://localhost/api/bookmarks/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tags: ['rust'], sortOrder: 1 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(updateBookmark).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown id', async () => {
    updateBookmark.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/bookmarks/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tags: null }),
      }),
    )

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/bookmarks/:id', () => {
  it('returns 404 for an unknown id', async () => {
    getBookmark.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/bookmarks/999', { method: 'DELETE' }),
    )

    expect(res.status).toBe(404)
    expect(deleteBookmark).not.toHaveBeenCalled()
  })

  it('deletes and returns 204', async () => {
    getBookmark.mockReturnValue(makeBookmark({ id: 1 }))

    const res = await handler(
      new Request('http://localhost/api/bookmarks/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteBookmark).toHaveBeenCalledWith(1)
  })
})

describe('POST /api/bookmarks/:id/move', () => {
  it('returns 400 on {to: "after"} without afterId', async () => {
    const res = await handler(
      new Request('http://localhost/api/bookmarks/1/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'after' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(moveBookmark).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown afterId', async () => {
    moveBookmark.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/bookmarks/1/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'after', afterId: 999 }),
      }),
    )

    expect(res.status).toBe(404)
  })

  it('returns the new ref order', async () => {
    moveBookmark.mockReturnValue([
      { id: 2, itemId: 2 },
      { id: 1, itemId: 1 },
    ])

    const res = await handler(
      new Request('http://localhost/api/bookmarks/1/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'first' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 2, itemId: 2 },
      { id: 1, itemId: 1 },
    ])
  })
})

describe('GET /api/bookmarks/refs', () => {
  it('returns the ref pairs, unpaged', async () => {
    listBookmarkRefs.mockReturnValue([
      { id: 1, itemId: 10 },
      { id: 2, itemId: 20 },
    ])

    const res = await handler(
      new Request('http://localhost/api/bookmarks/refs'),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 1, itemId: 10 },
      { id: 2, itemId: 20 },
    ])
  })
})
