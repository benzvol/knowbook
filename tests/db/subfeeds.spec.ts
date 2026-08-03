import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  createSource,
  createSubfeed,
  findSubfeedByName,
  subfeedCountsForSources,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('subfeedCountsForSources', () => {
  it('counts each source’s subfeeds in one call', () => {
    const a = createSource({ url: 'a', title: 'A' }, db)
    const b = createSource({ url: 'b', title: 'B' }, db)
    createSubfeed({ sourceId: a.id, name: 'one' }, db)
    createSubfeed({ sourceId: a.id, name: 'two' }, db)
    createSubfeed({ sourceId: b.id, name: 'one' }, db)

    const result = subfeedCountsForSources([a.id, b.id], db)

    expect(result.get(a.id)).toBe(2)
    expect(result.get(b.id)).toBe(1)
  })

  it('omits sources with no subfeeds', () => {
    const a = createSource({ url: 'a', title: 'A' }, db)

    const result = subfeedCountsForSources([a.id], db)

    expect(result.has(a.id)).toBe(false)
  })

  it('returns an empty map for an empty input', () => {
    expect(subfeedCountsForSources([], db).size).toBe(0)
  })
})

describe('findSubfeedByName', () => {
  it('finds a subfeed by (sourceId, name)', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sub = createSubfeed({ sourceId: s.id, name: 'g7' }, db)

    const found = findSubfeedByName(s.id, 'g7', undefined, db)

    expect(found?.id).toBe(sub.id)
  })

  it('does not match a name in a different source', () => {
    const a = createSource({ url: 'a', title: 'A' }, db)
    const b = createSource({ url: 'b', title: 'B' }, db)
    createSubfeed({ sourceId: a.id, name: 'g7' }, db)

    expect(findSubfeedByName(b.id, 'g7', undefined, db)).toBeUndefined()
  })

  it('excludes the given id, so a subfeed does not collide with itself', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sub = createSubfeed({ sourceId: s.id, name: 'g7' }, db)

    expect(findSubfeedByName(s.id, 'g7', sub.id, db)).toBeUndefined()
  })
})
