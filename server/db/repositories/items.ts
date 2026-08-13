import { and, desc, eq } from 'drizzle-orm'
import type { Item, ItemSubfeed, NewItem } from '#shared/types'
import { db, type DB } from '../client'
import { itemSubfeeds, items } from '../schema'

export function itemsForSource(sourceId: number, database: DB = db): Item[] {
  return database
    .select()
    .from(items)
    .where(eq(items.sourceId, sourceId))
    .orderBy(desc(items.publishedAt))
    .all()
}

// Only items linked to this subfeed via `item_subfeeds` — a strict subset of
// its parent source's cached items. A row cached before this join table
// existed (or before this subfeed's next refresh) has no link row, so it is
// absent here even though it is present in `itemsForSource`.
export function itemsForSubfeed(subfeedId: number, database: DB = db): Item[] {
  return database
    .select({ items })
    .from(items)
    .innerJoin(itemSubfeeds, eq(itemSubfeeds.itemId, items.id))
    .where(eq(itemSubfeeds.subfeedId, subfeedId))
    .orderBy(desc(items.publishedAt))
    .all()
    .map((row) => row.items)
}

export function getItem(id: number, database: DB = db): Item | undefined {
  return database.select().from(items).where(eq(items.id, id)).get()
}

export function getItemBySourceGuid(
  sourceId: number,
  guid: string,
  database: DB = db,
): Item | undefined {
  return database
    .select()
    .from(items)
    .where(and(eq(items.sourceId, sourceId), eq(items.guid, guid)))
    .get()
}

export function createItem(data: NewItem, database: DB = db): Item {
  return database.insert(items).values(data).returning().get()
}

/**
 * Insert an item, or update the cached copy when one already exists for the
 * same (sourceId, guid). Used by the fetch engine (issue 02) for feed caching.
 */
export function upsertItem(data: NewItem, database: DB = db): Item {
  return database
    .insert(items)
    .values(data)
    .onConflictDoUpdate({
      target: [items.sourceId, items.guid],
      set: {
        title: data.title,
        description: data.description,
        link: data.link,
        publishedAt: data.publishedAt,
        tags: data.tags,
        fetchedAt: new Date(),
      },
    })
    .returning()
    .get()
}

export function deleteItem(id: number, database: DB = db): void {
  database.delete(items).where(eq(items.id, id)).run()
}

/**
 * Record that `itemId` was seen through `subfeedId`. A refresh re-sees the
 * same items every run, so a repeat link is a no-op rather than an error.
 */
export function linkItemSubfeed(
  itemId: number,
  subfeedId: number,
  database: DB = db,
): ItemSubfeed {
  return database
    .insert(itemSubfeeds)
    .values({ itemId, subfeedId })
    .onConflictDoNothing()
    .returning()
    .get() ?? { itemId, subfeedId }
}
