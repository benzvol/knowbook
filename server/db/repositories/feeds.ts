import { and, eq } from 'drizzle-orm'
import type { Feed, FeedSource, NewFeed } from '#shared/types'
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

// --- feed membership -------------------------------------------------------

export function feedMembers(feedId: number, database: DB = db): FeedSource[] {
  return database
    .select()
    .from(feedSources)
    .where(eq(feedSources.feedId, feedId))
    .all()
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
