import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Source, Subfeed } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  getSource: vi.fn(),
  listSubfeeds: vi.fn(),
  subfeedsForSource: vi.fn(),
  getSubfeed: vi.fn(),
  createSubfeed: vi.fn(),
  updateSubfeed: vi.fn(),
  deleteSubfeed: vi.fn(),
  findSubfeedByName: vi.fn(),
}))
vi.mock('~~/server/feed', () => ({
  refreshSubfeed: vi.fn(),
}))

const repos = await import('~~/server/db/repositories')
const feed = await import('~~/server/feed')
const { SourceNotFoundError, SubfeedNotFoundError } = await import(
  '~~/server/feed/errors'
)

const getSource = repos.getSource as ReturnType<typeof vi.fn>
const subfeedsForSource = repos.subfeedsForSource as ReturnType<typeof vi.fn>
const getSubfeed = repos.getSubfeed as ReturnType<typeof vi.fn>
const createSubfeed = repos.createSubfeed as ReturnType<typeof vi.fn>
const updateSubfeed = repos.updateSubfeed as ReturnType<typeof vi.fn>
const deleteSubfeed = repos.deleteSubfeed as ReturnType<typeof vi.fn>
const findSubfeedByName = repos.findSubfeedByName as ReturnType<typeof vi.fn>
const refreshSubfeed = feed.refreshSubfeed as ReturnType<typeof vi.fn>

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

  const getForSource = (
    await import('~~/server/api/sources/[id]/subfeeds.get')
  ).default
  const postForSource = (
    await import('~~/server/api/sources/[id]/subfeeds.post')
  ).default
  const getOne = (await import('~~/server/api/subfeeds/[id].get')).default
  const patchOne = (await import('~~/server/api/subfeeds/[id].patch')).default
  const deleteOne = (await import('~~/server/api/subfeeds/[id].delete'))
    .default
  const refresh = (await import('~~/server/api/subfeeds/[id]/refresh.post'))
    .default

  router.get('/api/sources/:id/subfeeds', getForSource)
  router.post('/api/sources/:id/subfeeds', postForSource)
  router.get('/api/subfeeds/:id', getOne)
  router.patch('/api/subfeeds/:id', patchOne)
  router.delete('/api/subfeeds/:id', deleteOne)
  router.post('/api/subfeeds/:id/refresh', refresh)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/sources/:id/subfeeds', () => {
  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/subfeeds'),
    )

    expect(res.status).toBe(404)
  })

  it("returns the source's subfeeds", async () => {
    getSource.mockReturnValue(makeSource())
    subfeedsForSource.mockReturnValue([makeSubfeed()])

    const res = await handler(
      new Request('http://localhost/api/sources/1/subfeeds'),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})

describe('POST /api/sources/:id/subfeeds', () => {
  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/subfeeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sub' }),
      }),
    )

    expect(res.status).toBe(404)
    expect(createSubfeed).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid payload', async () => {
    getSource.mockReturnValue(makeSource())

    const res = await handler(
      new Request('http://localhost/api/sources/1/subfeeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createSubfeed).not.toHaveBeenCalled()
  })

  it('returns 400 when the body carries a sourceId', async () => {
    getSource.mockReturnValue(makeSource())

    const res = await handler(
      new Request('http://localhost/api/sources/1/subfeeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sub', sourceId: 2 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createSubfeed).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name within the source', async () => {
    getSource.mockReturnValue(makeSource())
    findSubfeedByName.mockReturnValue(makeSubfeed())

    const res = await handler(
      new Request('http://localhost/api/sources/1/subfeeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sub' }),
      }),
    )

    expect(res.status).toBe(409)
    expect(createSubfeed).not.toHaveBeenCalled()
  })

  it('creates a subfeed under the source and returns 201', async () => {
    getSource.mockReturnValue(makeSource({ id: 1 }))
    findSubfeedByName.mockReturnValue(undefined)
    createSubfeed.mockReturnValue(makeSubfeed({ id: 5, sourceId: 1 }))

    const res = await handler(
      new Request('http://localhost/api/sources/1/subfeeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sub', queryParams: { filters: '{}' } }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createSubfeed).toHaveBeenCalledWith({
      name: 'sub',
      queryParams: { filters: '{}' },
      sourceId: 1,
    })
    expect((await res.json()).id).toBe(5)
  })
})

describe('GET /api/subfeeds/:id', () => {
  it('returns 404 when missing', async () => {
    getSubfeed.mockReturnValue(undefined)

    const res = await handler(new Request('http://localhost/api/subfeeds/999'))

    expect(res.status).toBe(404)
  })

  it('returns the subfeed when found', async () => {
    getSubfeed.mockReturnValue(makeSubfeed({ id: 42 }))

    const res = await handler(new Request('http://localhost/api/subfeeds/42'))

    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(42)
  })
})

describe('PATCH /api/subfeeds/:id', () => {
  it('returns 404 when the subfeed does not exist', async () => {
    getSubfeed.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/subfeeds/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    )

    expect(res.status).toBe(404)
    expect(updateSubfeed).not.toHaveBeenCalled()
  })

  it('returns 400 when the body carries a sourceId', async () => {
    getSubfeed.mockReturnValue(makeSubfeed())

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: 2 }),
      }),
    )

    expect(res.status).toBe(400)
    expect(updateSubfeed).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name, excluding itself', async () => {
    getSubfeed.mockReturnValue(makeSubfeed({ id: 1, sourceId: 1 }))
    findSubfeedByName.mockReturnValue(makeSubfeed({ id: 2 }))

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'taken' }),
      }),
    )

    expect(res.status).toBe(409)
    expect(findSubfeedByName).toHaveBeenCalledWith(1, 'taken', 1)
    expect(updateSubfeed).not.toHaveBeenCalled()
  })

  it('updates the subfeed', async () => {
    getSubfeed.mockReturnValue(makeSubfeed({ id: 1, sourceId: 1 }))
    findSubfeedByName.mockReturnValue(undefined)
    updateSubfeed.mockReturnValue(makeSubfeed({ id: 1, name: 'renamed' }))

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('renamed')
  })
})

describe('DELETE /api/subfeeds/:id', () => {
  it('deletes and returns 204', async () => {
    const res = await handler(
      new Request('http://localhost/api/subfeeds/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteSubfeed).toHaveBeenCalledWith(1)
  })
})

describe('POST /api/subfeeds/:id/refresh', () => {
  it('returns the refresh summary', async () => {
    refreshSubfeed.mockResolvedValue({
      subfeedId: 1,
      sourceId: 2,
      seen: 3,
      inserted: 2,
      updated: 1,
      pagesFetched: 1,
    })

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1/refresh', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ seen: 3, inserted: 2, updated: 1 })
  })

  it('maps a subfeed-not-found error to 404', async () => {
    refreshSubfeed.mockRejectedValue(new SubfeedNotFoundError(999))

    const res = await handler(
      new Request('http://localhost/api/subfeeds/999/refresh', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })

  it('maps a source-not-found error to 404', async () => {
    refreshSubfeed.mockRejectedValue(new SourceNotFoundError(2))

    const res = await handler(
      new Request('http://localhost/api/subfeeds/1/refresh', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })
})
