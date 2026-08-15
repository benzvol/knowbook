import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  addFeedSource,
  createFeed,
  createSource,
  findFeedByName,
  getFeedMember,
  createSubfeed,
  listFeedsWithCounts,
  memberCountsForFeeds,
  memberLabelsForFeeds,
} from '~~/server/db/repositories'
import { createTestDb } from './helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('memberCountsForFeeds', () => {
  it('counts each feed’s members in one call', () => {
    const s1 = createSource({ url: 'a', title: 'A' }, db)
    const s2 = createSource({ url: 'b', title: 'B' }, db)
    const a = createFeed({ name: 'A' }, db)
    const b = createFeed({ name: 'B' }, db)
    addFeedSource(a.id, s1.id, null, db)
    addFeedSource(a.id, s2.id, null, db)
    addFeedSource(b.id, s1.id, null, db)

    const result = memberCountsForFeeds([a.id, b.id], db)

    expect(result.get(a.id)).toBe(2)
    expect(result.get(b.id)).toBe(1)
  })

  it('omits feeds with no members', () => {
    const a = createFeed({ name: 'A' }, db)

    const result = memberCountsForFeeds([a.id], db)

    expect(result.has(a.id)).toBe(false)
  })

  it('returns an empty map for an empty input', () => {
    expect(memberCountsForFeeds([], db).size).toBe(0)
  })
})

describe('getFeedMember', () => {
  it('returns the membership row by id', () => {
    const source = createSource({ url: 'u', title: 'A' }, db)
    const feed = createFeed({ name: 'F' }, db)
    const member = addFeedSource(feed.id, source.id, null, db)

    expect(getFeedMember(member.id, db)?.id).toBe(member.id)
  })

  it('returns undefined for an unknown id', () => {
    expect(getFeedMember(999, db)).toBeUndefined()
  })
})

describe('findFeedByName', () => {
  it('finds a feed by name', () => {
    const feed = createFeed({ name: 'Morning read' }, db)

    expect(findFeedByName('Morning read', undefined, db)?.id).toBe(feed.id)
  })

  it('excludes the given id, so a feed does not collide with itself', () => {
    const feed = createFeed({ name: 'Morning read' }, db)

    expect(findFeedByName('Morning read', feed.id, db)).toBeUndefined()
  })
})

describe('memberLabelsForFeeds', () => {
  it('labels a whole-source member by its source title', () => {
    const s = createSource({ url: 'a', title: 'Hacker News' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)

    expect(memberLabelsForFeeds([feed.id], db).get(feed.id)).toEqual([
      'Hacker News',
    ])
  })

  it('labels a narrowed member as "Source → Subfeed"', () => {
    const s = createSource({ url: 'a', title: 'Telex' }, db)
    const sf = createSubfeed({ sourceId: s.id, name: 'G7' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, sf.id, db)

    expect(memberLabelsForFeeds([feed.id], db).get(feed.id)).toEqual([
      'Telex → G7',
    ])
  })

  it('keeps labels per feed and omits feeds with no members', () => {
    const s = createSource({ url: 'a', title: 'A' }, db)
    const a = createFeed({ name: 'A feed' }, db)
    const b = createFeed({ name: 'B feed' }, db)
    addFeedSource(a.id, s.id, null, db)

    const result = memberLabelsForFeeds([a.id, b.id], db)

    expect(result.get(a.id)).toEqual(['A'])
    expect(result.has(b.id)).toBe(false)
  })

  it('returns an empty map for an empty input', () => {
    expect(memberLabelsForFeeds([], db).size).toBe(0)
  })
})

describe('listFeedsWithCounts', () => {
  it('hydrates member labels alongside the count', () => {
    const s = createSource({ url: 'a', title: 'Telex' }, db)
    const sf = createSubfeed({ sourceId: s.id, name: 'G7' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)
    addFeedSource(feed.id, s.id, sf.id, db)
    createFeed({ name: 'Empty' }, db)

    const rows = listFeedsWithCounts(db)

    expect(rows.find((r) => r.id === feed.id)?.memberLabels.toSorted()).toEqual(
      ['Telex', 'Telex → G7'],
    )
    expect(rows.find((r) => r.name === 'Empty')?.memberLabels).toEqual([])
  })

  it('reports each feed’s member count', () => {
    const s1 = createSource({ url: 'a', title: 'A' }, db)
    const s2 = createSource({ url: 'b', title: 'B' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s1.id, null, db)
    addFeedSource(feed.id, s2.id, null, db)
    createFeed({ name: 'Empty' }, db)

    const rows = listFeedsWithCounts(db)

    expect(rows.find((r) => r.id === feed.id)?.memberCount).toBe(2)
    expect(rows.find((r) => r.name === 'Empty')?.memberCount).toBe(0)
  })
})
