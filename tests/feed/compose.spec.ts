import { beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '~~/server/db/client'
import {
  addFeedSource,
  createFeed,
  createItem,
  createSource,
  createSubfeed,
  linkItemSubfeed,
} from '~~/server/db/repositories'
import { feedItems } from '~~/server/feed/compose'
import { FeedNotFoundError } from '~~/server/feed/errors'
import { createTestDb } from '../db/helpers'

let db: DB

beforeEach(() => {
  db = createTestDb()
})

describe('feedItems', () => {
  it('merges items across a feed’s distinct member sources, newest first', () => {
    const a = createSource({ url: 'a', title: 'A' }, db)
    const b = createSource({ url: 'b', title: 'B' }, db)
    createItem(
      {
        sourceId: a.id,
        guid: 'a1',
        title: 'a1',
        publishedAt: new Date('2024-01-01'),
      },
      db,
    )
    createItem(
      {
        sourceId: b.id,
        guid: 'b1',
        title: 'b1',
        publishedAt: new Date('2024-01-03'),
      },
      db,
    )
    createItem(
      {
        sourceId: b.id,
        guid: 'b2',
        title: 'b2',
        publishedAt: new Date('2024-01-02'),
      },
      db,
    )
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, a.id, null, db)
    addFeedSource(feed.id, b.id, null, db)

    const result = feedItems(feed.id, { database: db })

    expect(result.map((i) => i.guid)).toEqual(['b1', 'b2', 'a1'])
  })

  it('returns exactly one copy of an item shared by a whole-source and a subfeed membership of the same source', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const sf = createSubfeed({ sourceId: s.id, name: 'sub' }, db)
    const i1 = createItem({ sourceId: s.id, guid: 'i1', title: 'i1' }, db)
    createItem({ sourceId: s.id, guid: 'i2', title: 'i2' }, db)
    // Only i1 is linked to the subfeed, so the whole-source membership's read
    // of i2 and the subfeed membership's read of i1 legitimately overlap on
    // i1 without duplicating it.
    linkItemSubfeed(i1.id, sf.id, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)
    addFeedSource(feed.id, s.id, sf.id, db)

    const result = feedItems(feed.id, { database: db })

    expect(result.map((i) => i.guid).toSorted()).toEqual(['i1', 'i2'])
  })

  it('narrows a subfeed member to only the items linked to that subfeed', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    const subA = createSubfeed({ sourceId: s.id, name: 'a' }, db)
    const itemA = createItem({ sourceId: s.id, guid: 'a1', title: 'a1' }, db)
    createItem({ sourceId: s.id, guid: 'b1', title: 'b1' }, db)
    linkItemSubfeed(itemA.id, subA.id, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, subA.id, db)

    const result = feedItems(feed.id, { database: db })

    expect(result.map((i) => i.guid)).toEqual(['a1'])
  })

  it('sorts items without a publishedAt last', () => {
    const s = createSource({ url: 'u', title: 'A' }, db)
    createItem(
      {
        sourceId: s.id,
        guid: 'dated',
        title: 'dated',
        publishedAt: new Date('2024-01-01'),
      },
      db,
    )
    createItem({ sourceId: s.id, guid: 'undated', title: 'undated' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, s.id, null, db)

    const result = feedItems(feed.id, { database: db })

    expect(result.map((i) => i.guid)).toEqual(['dated', 'undated'])
  })

  it('ignores items belonging to a source that is not a member', () => {
    const member = createSource({ url: 'a', title: 'A' }, db)
    const other = createSource({ url: 'b', title: 'B' }, db)
    createItem({ sourceId: member.id, guid: 'i1', title: 'i1' }, db)
    createItem({ sourceId: other.id, guid: 'i2', title: 'i2' }, db)
    const feed = createFeed({ name: 'F' }, db)
    addFeedSource(feed.id, member.id, null, db)

    const result = feedItems(feed.id, { database: db })

    expect(result.map((i) => i.guid)).toEqual(['i1'])
  })

  it('returns an empty list for a feed with no members', () => {
    const feed = createFeed({ name: 'F' }, db)

    expect(feedItems(feed.id, { database: db })).toEqual([])
  })

  it('throws FeedNotFoundError for an unknown feed', () => {
    expect(() => feedItems(999, { database: db })).toThrow(FeedNotFoundError)
  })
})
