import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceWithTags } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  listSources: vi.fn(),
  getSource: vi.fn(),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  listCategories: vi.fn(),
  listSourcesWithTags: vi.fn(),
  getSourceWithTags: vi.fn(),
  tagsForSource: vi.fn(),
  findTagsByIds: vi.fn(),
  setSourceTags: vi.fn(),
}))
vi.mock('~~/server/feed', () => ({
  refreshSource: vi.fn(),
}))

const repos = await import('~~/server/db/repositories')
const feed = await import('~~/server/feed')

const getSource = repos.getSource as ReturnType<typeof vi.fn>
const createSource = repos.createSource as ReturnType<typeof vi.fn>
const updateSource = repos.updateSource as ReturnType<typeof vi.fn>
const deleteSource = repos.deleteSource as ReturnType<typeof vi.fn>
const refreshSource = feed.refreshSource as ReturnType<typeof vi.fn>
const listSourcesWithTags = repos.listSourcesWithTags as ReturnType<
  typeof vi.fn
>
const getSourceWithTags = repos.getSourceWithTags as ReturnType<typeof vi.fn>
const tagsForSource = repos.tagsForSource as ReturnType<typeof vi.fn>
const findTagsByIds = repos.findTagsByIds as ReturnType<typeof vi.fn>
const setSourceTags = repos.setSourceTags as ReturnType<typeof vi.fn>

function makeSource(overrides: Partial<SourceWithTags> = {}): SourceWithTags {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Test source',
    type: 'standard',
    managed: false,
    categoryId: null,
    pagination: null,
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
    ...overrides,
  }
}

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  app = createApp()
  const router = createRouter()

  const getIndex = (await import('~~/server/api/sources/index.get')).default
  const postIndex = (await import('~~/server/api/sources/index.post')).default
  const getOne = (await import('~~/server/api/sources/[id].get')).default
  const patchOne = (await import('~~/server/api/sources/[id].patch')).default
  const deleteOne = (await import('~~/server/api/sources/[id].delete')).default
  const refresh = (await import('~~/server/api/sources/[id]/refresh.post'))
    .default
  const getTags = (await import('~~/server/api/sources/[id]/tags.get')).default
  const putTags = (await import('~~/server/api/sources/[id]/tags.put')).default

  router.get('/api/sources', getIndex)
  router.post('/api/sources', postIndex)
  router.get('/api/sources/:id', getOne)
  router.patch('/api/sources/:id', patchOne)
  router.delete('/api/sources/:id', deleteOne)
  router.post('/api/sources/:id/refresh', refresh)
  router.get('/api/sources/:id/tags', getTags)
  router.put('/api/sources/:id/tags', putTags)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/sources', () => {
  it('returns the list of sources with their tags', async () => {
    listSourcesWithTags.mockReturnValue([
      makeSource({ tags: [{ id: 1, name: 'dev' }] }),
    ])

    const res = await handler(new Request('http://localhost/api/sources'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].tags).toEqual([{ id: 1, name: 'dev' }])
  })
})

describe('GET /api/sources/:id', () => {
  it('returns 404 when missing', async () => {
    getSourceWithTags.mockReturnValue(undefined)

    const res = await handler(new Request('http://localhost/api/sources/999'))

    expect(res.status).toBe(404)
  })

  it('returns the source when found', async () => {
    getSourceWithTags.mockReturnValue(makeSource({ id: 42 }))

    const res = await handler(new Request('http://localhost/api/sources/42'))

    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(42)
  })
})

describe('POST /api/sources', () => {
  it('creates a source and returns 201', async () => {
    createSource.mockReturnValue(makeSource())

    const res = await handler(
      new Request('http://localhost/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/feed',
          title: 'Test',
        }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createSource).toHaveBeenCalledOnce()
    // tagIds must not reach the repository's `NewSource` insert.
    expect(createSource).toHaveBeenCalledWith(
      expect.not.objectContaining({ tagIds: expect.anything() }),
    )
  })

  it('returns 400 for an invalid payload', async () => {
    const res = await handler(
      new Request('http://localhost/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createSource).not.toHaveBeenCalled()
  })

  it('attaches tagIds after creating the source', async () => {
    createSource.mockReturnValue(makeSource())
    findTagsByIds.mockReturnValue([
      { id: 1, name: 'dev' },
      { id: 2, name: 'daily' },
    ])
    setSourceTags.mockReturnValue([
      { id: 1, name: 'dev' },
      { id: 2, name: 'daily' },
    ])

    const res = await handler(
      new Request('http://localhost/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/feed',
          title: 'Test',
          tagIds: [1, 2],
        }),
      }),
    )

    expect(res.status).toBe(201)
    expect(setSourceTags).toHaveBeenCalledWith(1, [1, 2])
    expect((await res.json()).tags).toHaveLength(2)
  })

  it('rejects unknown tag ids with 400 and does not create the source', async () => {
    findTagsByIds.mockReturnValue([])

    const res = await handler(
      new Request('http://localhost/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/feed',
          title: 'Test',
          tagIds: [7],
        }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createSource).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/sources/:id', () => {
  it('returns 404 when the source does not exist', async () => {
    updateSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' }),
      }),
    )

    expect(res.status).toBe(404)
  })

  it('leaves tags untouched when tagIds is omitted', async () => {
    updateSource.mockReturnValue(makeSource({ title: 'Renamed' }))
    tagsForSource.mockReturnValue([{ id: 1, name: 'dev' }])

    const res = await handler(
      new Request('http://localhost/api/sources/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Renamed' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(setSourceTags).not.toHaveBeenCalled()
    expect((await res.json()).tags).toEqual([{ id: 1, name: 'dev' }])
  })
})

describe('DELETE /api/sources/:id', () => {
  it('deletes and returns 204', async () => {
    const res = await handler(
      new Request('http://localhost/api/sources/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteSource).toHaveBeenCalledWith(1)
  })
})

describe('GET /api/sources/:id/tags', () => {
  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/tags'),
    )

    expect(res.status).toBe(404)
  })

  it("returns the source's tags", async () => {
    getSource.mockReturnValue(makeSource())
    tagsForSource.mockReturnValue([{ id: 1, name: 'dev' }])

    const res = await handler(
      new Request('http://localhost/api/sources/1/tags'),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, name: 'dev' }])
  })
})

describe('PUT /api/sources/:id/tags', () => {
  it('replaces the tag set and returns the result', async () => {
    getSource.mockReturnValue(makeSource())
    findTagsByIds.mockReturnValue([
      { id: 1, name: 'dev' },
      { id: 2, name: 'daily' },
    ])
    setSourceTags.mockReturnValue([
      { id: 1, name: 'dev' },
      { id: 2, name: 'daily' },
    ])

    const res = await handler(
      new Request('http://localhost/api/sources/1/tags', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tagIds: [1, 2, 2] }),
      }),
    )

    expect(res.status).toBe(200)
    expect(setSourceTags).toHaveBeenCalledWith(1, [1, 2])
    expect(await res.json()).toHaveLength(2)
  })

  it('returns 400 on unknown tag ids without writing', async () => {
    getSource.mockReturnValue(makeSource())
    findTagsByIds.mockReturnValue([{ id: 1, name: 'dev' }])

    const res = await handler(
      new Request('http://localhost/api/sources/1/tags', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tagIds: [1, 9] }),
      }),
    )

    expect(res.status).toBe(400)
    expect(setSourceTags).not.toHaveBeenCalled()
  })

  it('returns 404 when the source does not exist', async () => {
    getSource.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/sources/999/tags', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tagIds: [1] }),
      }),
    )

    expect(res.status).toBe(404)
  })
})

describe('POST /api/sources/:id/refresh', () => {
  it('returns the refresh summary', async () => {
    refreshSource.mockResolvedValue({
      sourceId: 1,
      seen: 3,
      inserted: 2,
      updated: 1,
      pagesFetched: 1,
    })

    const res = await handler(
      new Request('http://localhost/api/sources/1/refresh', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ seen: 3, inserted: 2, updated: 1 })
  })

  it('maps a not-found error to 404', async () => {
    refreshSource.mockRejectedValue(new Error('Source not found: 999'))

    const res = await handler(
      new Request('http://localhost/api/sources/999/refresh', {
        method: 'POST',
      }),
    )

    expect(res.status).toBe(404)
  })
})
