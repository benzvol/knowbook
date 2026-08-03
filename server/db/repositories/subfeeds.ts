import { and, eq, inArray, ne } from 'drizzle-orm'
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

// Duplicate-name check for create/update routes. `excludeId` lets an update
// exclude the subfeed being patched, so renaming it to its own current name
// isn't reported as a collision.
export function findSubfeedByName(
  sourceId: number,
  name: string,
  excludeId?: number,
  database: DB = db,
): Subfeed | undefined {
  const conditions = [eq(subfeeds.sourceId, sourceId), eq(subfeeds.name, name)]
  if (excludeId !== undefined) conditions.push(ne(subfeeds.id, excludeId))
  return database
    .select()
    .from(subfeeds)
    .where(and(...conditions))
    .get()
}

// Hydration helper for the source list's subfeed-count badge: one query
// instead of N `subfeedsForSource` calls. Sources with no subfeeds are simply
// absent from the map.
export function subfeedCountsForSources(
  sourceIds: number[],
  database: DB = db,
): Map<number, number> {
  const result = new Map<number, number>()
  if (sourceIds.length === 0) return result

  const rows = database
    .select({ sourceId: subfeeds.sourceId })
    .from(subfeeds)
    .where(inArray(subfeeds.sourceId, sourceIds))
    .all()

  for (const { sourceId } of rows) {
    result.set(sourceId, (result.get(sourceId) ?? 0) + 1)
  }
  return result
}
