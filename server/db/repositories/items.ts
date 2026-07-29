import { and, desc, eq } from 'drizzle-orm'
import type { Item, NewItem } from '#shared/types'
import { db, type DB } from '../client'
import { items } from '../schema'

export function itemsForSource(sourceId: number, database: DB = db): Item[] {
  return database
    .select()
    .from(items)
    .where(eq(items.sourceId, sourceId))
    .orderBy(desc(items.publishedAt))
    .all()
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
