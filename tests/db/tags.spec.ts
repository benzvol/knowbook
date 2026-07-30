import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  attachTag,
  createSource,
  createTag,
  setSourceTags,
  tagsForSource,
  tagsForSources,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('tagsForSources', () => {
  it('returns each source’s tags in one call', () => {
    const a = createSource({ url: 'a', title: 'A', type: 'standard' }, db)
    const b = createSource({ url: 'b', title: 'B', type: 'standard' }, db)
    const dev = createTag({ name: 'dev' }, db)
    const daily = createTag({ name: 'daily' }, db)
    attachTag(a.id, dev.id, db)
    attachTag(a.id, daily.id, db)
    attachTag(b.id, daily.id, db)

    const result = tagsForSources([a.id, b.id], db)

    expect(
      result
        .get(a.id)
        ?.map((t) => t.name)
        .sort(),
    ).toEqual(['daily', 'dev'])
    expect(result.get(b.id)?.map((t) => t.name)).toEqual(['daily'])
  })

  it('omits sources with no tags', () => {
    const a = createSource({ url: 'a', title: 'A', type: 'standard' }, db)

    const result = tagsForSources([a.id], db)

    expect(result.has(a.id)).toBe(false)
  })

  it('returns an empty map for an empty input', () => {
    expect(tagsForSources([], db).size).toBe(0)
  })
})

describe('setSourceTags', () => {
  it('attaches the given tags', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const dev = createTag({ name: 'dev' }, db)
    const daily = createTag({ name: 'daily' }, db)

    const result = setSourceTags(s.id, [dev.id, daily.id], db)

    expect(result.map((t) => t.name).sort()).toEqual(['daily', 'dev'])
  })

  it('detaches tags no longer in the target set', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const dev = createTag({ name: 'dev' }, db)
    const daily = createTag({ name: 'daily' }, db)
    attachTag(s.id, dev.id, db)
    attachTag(s.id, daily.id, db)

    const result = setSourceTags(s.id, [daily.id], db)

    expect(result.map((t) => t.name)).toEqual(['daily'])
  })

  it('clears all tags when given an empty array', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const dev = createTag({ name: 'dev' }, db)
    attachTag(s.id, dev.id, db)

    const result = setSourceTags(s.id, [], db)

    expect(result).toEqual([])
    expect(tagsForSource(s.id, db)).toEqual([])
  })

  it('is idempotent on a repeat call with the same set', () => {
    const s = createSource({ url: 'u', title: 'A', type: 'standard' }, db)
    const dev = createTag({ name: 'dev' }, db)

    setSourceTags(s.id, [dev.id], db)
    const result = setSourceTags(s.id, [dev.id], db)

    expect(result.map((t) => t.name)).toEqual(['dev'])
  })
})
