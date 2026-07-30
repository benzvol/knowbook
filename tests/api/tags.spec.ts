import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tag } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

const repos = await import('~~/server/db/repositories')

const listTags = repos.listTags as ReturnType<typeof vi.fn>
const createTag = repos.createTag as ReturnType<typeof vi.fn>
const updateTag = repos.updateTag as ReturnType<typeof vi.fn>
const deleteTag = repos.deleteTag as ReturnType<typeof vi.fn>

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: 1, name: 'daily', ...overrides }
}

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  app = createApp()
  const router = createRouter()

  const getIndex = (await import('~~/server/api/tags/index.get')).default
  const postIndex = (await import('~~/server/api/tags/index.post')).default
  const patchOne = (await import('~~/server/api/tags/[id].patch')).default
  const deleteOne = (await import('~~/server/api/tags/[id].delete')).default

  router.get('/api/tags', getIndex)
  router.post('/api/tags', postIndex)
  router.patch('/api/tags/:id', patchOne)
  router.delete('/api/tags/:id', deleteOne)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/tags', () => {
  it('returns the list of tags', async () => {
    listTags.mockReturnValue([makeTag()])

    const res = await handler(new Request('http://localhost/api/tags'))

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})

describe('POST /api/tags', () => {
  it('creates a tag and returns 201', async () => {
    createTag.mockReturnValue(makeTag())

    const res = await handler(
      new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'daily' }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createTag).toHaveBeenCalledOnce()
  })

  it('returns 400 for an invalid payload', async () => {
    const res = await handler(
      new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createTag).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name', async () => {
    createTag.mockImplementation(() => {
      throw { code: 'SQLITE_CONSTRAINT_UNIQUE' }
    })

    const res = await handler(
      new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'daily' }),
      }),
    )

    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/tags/:id', () => {
  it('renames a tag', async () => {
    updateTag.mockReturnValue(makeTag({ name: 'dev' }))

    const res = await handler(
      new Request('http://localhost/api/tags/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'dev' }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('dev')
  })

  it('returns 404 when the tag does not exist', async () => {
    updateTag.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/tags/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'dev' }),
      }),
    )

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/tags/:id', () => {
  it('deletes and returns 204', async () => {
    const res = await handler(
      new Request('http://localhost/api/tags/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteTag).toHaveBeenCalledWith(1)
  })
})
