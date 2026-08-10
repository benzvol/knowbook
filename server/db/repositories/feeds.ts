import { and, eq, inArray, ne } from 'drizzle-orm'
import type { Feed, FeedListItem, FeedSource, NewFeed } from '#shared/types'
import { db, type DB } from '../client'
import { feedSources, feeds } from '../schema'

export function listFeeds(database: DB = db): Feed[] {
  return database.select().from(feeds).all()
}

export function getFeed(id: number, database: DB = db): Feed | undefined {
  return database.select().from(feeds).where(eq(feeds.id, id)).get()
}

export function createFeed(data: NewFeed, database: DB = db): Feed {
  return database.insert(feeds).values(data).returning().get()
}

export function updateFeed(
  id: number,
  patch: Partial<NewFeed>,
  database: DB = db,
): Feed | undefined {
  return database
    .update(feeds)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(feeds.id, id))
    .returning()
    .get()
}

export function deleteFeed(id: number, database: DB = db): void {
  database.delete(feeds).where(eq(feeds.id, id)).run()
}

// Duplicate-name check for create/rename routes. `excludeId` lets a rename
// exclude the feed being patched, so renaming it to its own current name
// isn't reported as a collision.
export function findFeedByName(
  name: string,
  excludeId?: number,
  database: DB = db,
): Feed | undefined {
  const conditions = [eq(feeds.name, name)]
  if (excludeId !== undefined) conditions.push(ne(feeds.id, excludeId))
  return database
    .select()
    .from(feeds)
    .where(and(...conditions))
    .get()
}

// --- feed membership -------------------------------------------------------

export function feedMembers(feedId: number, database: DB = db): FeedSource[] {
  return database
    .select()
    .from(feedSources)
    .where(eq(feedSources.feedId, feedId))
    .all()
}

export function getFeedMember(
  id: number,
  database: DB = db,
): FeedSource | undefined {
  return database.select().from(feedSources).where(eq(feedSources.id, id)).get()
}

// Hydration helper for the feed list's member-count badge: one query instead
// of N `feedMembers` calls. Feeds with no members are simply absent from the
// map.
export function memberCountsForFeeds(
  feedIds: number[],
  database: DB = db,
): Map<number, number> {
  const result = new Map<number, number>()
  if (feedIds.length === 0) return result

  const rows = database
    .select({ feedId: feedSources.feedId })
    .from(feedSources)
    .where(inArray(feedSources.feedId, feedIds))
    .all()

  for (const { feedId } of rows) {
    result.set(feedId, (result.get(feedId) ?? 0) + 1)
  }
  return result
}

// Hydrated variant used by the feed list route: a member count for the
// row-menu badge, fetched with one batched query instead of N.
export function listFeedsWithCounts(database: DB = db): FeedListItem[] {
  const rows = listFeeds(database)
  const feedIds = rows.map((f) => f.id)
  const memberCounts = memberCountsForFeeds(feedIds, database)
  return rows.map((feed) => ({
    ...feed,
    memberCount: memberCounts.get(feed.id) ?? 0,
  }))
}

/** Add a source (optionally narrowed to a subfeed) to a feed. */
export function addFeedSource(
  feedId: number,
  sourceId: number,
  subfeedId: number | null = null,
  database: DB = db,
): FeedSource {
  return database
    .insert(feedSources)
    .values({ feedId, sourceId, subfeedId })
    .returning()
    .get()
}

export function removeFeedSource(id: number, database: DB = db): void {
  database.delete(feedSources).where(eq(feedSources.id, id)).run()
}

export function clearFeedSources(feedId: number, database: DB = db): void {
  database.delete(feedSources).where(eq(feedSources.feedId, feedId)).run()
}
