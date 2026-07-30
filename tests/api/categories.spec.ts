import { createApp, createRouter, toWebHandler, type App } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '#shared/types'

vi.mock('~~/server/db/repositories', () => ({
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const repos = await import('~~/server/db/repositories')

const listCategories = repos.listCategories as ReturnType<typeof vi.fn>
const getCategory = repos.getCategory as ReturnType<typeof vi.fn>
const createCategory = repos.createCategory as ReturnType<typeof vi.fn>
const updateCategory = repos.updateCategory as ReturnType<typeof vi.fn>
const deleteCategory = repos.deleteCategory as ReturnType<typeof vi.fn>

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 1, name: 'News', ...overrides }
}

let app: App
let handler: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  app = createApp()
  const router = createRouter()

  const getIndex = (await import('~~/server/api/categories/index.get')).default
  const postIndex = (await import('~~/server/api/categories/index.post'))
    .default
  const getOne = (await import('~~/server/api/categories/[id].get')).default
  const patchOne = (await import('~~/server/api/categories/[id].patch')).default
  const deleteOne = (await import('~~/server/api/categories/[id].delete'))
    .default

  router.get('/api/categories', getIndex)
  router.post('/api/categories', postIndex)
  router.get('/api/categories/:id', getOne)
  router.patch('/api/categories/:id', patchOne)
  router.delete('/api/categories/:id', deleteOne)

  app.use(router)
  handler = toWebHandler(app)
})

describe('GET /api/categories', () => {
  it('returns the list of categories', async () => {
    listCategories.mockReturnValue([makeCategory()])

    const res = await handler(new Request('http://localhost/api/categories'))

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })
})

describe('GET /api/categories/:id', () => {
  it('returns 404 when missing', async () => {
    getCategory.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/categories/999'),
    )

    expect(res.status).toBe(404)
  })

  it('returns the category when found', async () => {
    getCategory.mockReturnValue(makeCategory({ id: 42 }))

    const res = await handler(new Request('http://localhost/api/categories/42'))

    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(42)
  })
})

describe('POST /api/categories', () => {
  it('creates a category and returns 201', async () => {
    createCategory.mockReturnValue(makeCategory())

    const res = await handler(
      new Request('http://localhost/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'News' }),
      }),
    )

    expect(res.status).toBe(201)
    expect(createCategory).toHaveBeenCalledOnce()
  })

  it('returns 400 for an invalid payload', async () => {
    const res = await handler(
      new Request('http://localhost/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )

    expect(res.status).toBe(400)
    expect(createCategory).not.toHaveBeenCalled()
  })

  it('returns 409 on a duplicate name', async () => {
    createCategory.mockImplementation(() => {
      throw { code: 'SQLITE_CONSTRAINT_UNIQUE' }
    })

    const res = await handler(
      new Request('http://localhost/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'News' }),
      }),
    )

    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/categories/:id', () => {
  it('renames a category', async () => {
    updateCategory.mockReturnValue(makeCategory({ name: 'Renamed' }))

    const res = await handler(
      new Request('http://localhost/api/categories/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      }),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Renamed')
  })

  it('returns 404 when the category does not exist', async () => {
    updateCategory.mockReturnValue(undefined)

    const res = await handler(
      new Request('http://localhost/api/categories/999', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
      }),
    )

    expect(res.status).toBe(404)
  })

  it('returns 409 on a duplicate name', async () => {
    updateCategory.mockImplementation(() => {
      throw { code: 'SQLITE_CONSTRAINT_UNIQUE' }
    })

    const res = await handler(
      new Request('http://localhost/api/categories/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Technology' }),
      }),
    )

    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/categories/:id', () => {
  it('deletes and returns 204', async () => {
    const res = await handler(
      new Request('http://localhost/api/categories/1', { method: 'DELETE' }),
    )

    expect(res.status).toBe(204)
    expect(deleteCategory).toHaveBeenCalledWith(1)
  })
})
