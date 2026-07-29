import { eq } from 'drizzle-orm'
import type { NewSubfeed, Subfeed } from '#shared/types'
import { db, type DB } from '../client'
import { subfeeds } from '../schema'

export function listSubfeeds(database: DB = db): Subfeed[] {
  return database.select().from(subfeeds).all()
}

export function subfeedsForSource(
  sourceId: number,
  database: DB = db,
): Subfeed[] {
  return database
    .select()
    .from(subfeeds)
    .where(eq(subfeeds.sourceId, sourceId))
    .all()
}

export function getSubfeed(id: number, database: DB = db): Subfeed | undefined {
  return database.select().from(subfeeds).where(eq(subfeeds.id, id)).get()
}

export function createSubfeed(data: NewSubfeed, database: DB = db): Subfeed {
  return database.insert(subfeeds).values(data).returning().get()
}

export function updateSubfeed(
  id: number,
  patch: Partial<NewSubfeed>,
  database: DB = db,
): Subfeed | undefined {
  return database
    .update(subfeeds)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(subfeeds.id, id))
    .returning()
    .get()
}

export function deleteSubfeed(id: number, database: DB = db): void {
  database.delete(subfeeds).where(eq(subfeeds.id, id)).run()
}
