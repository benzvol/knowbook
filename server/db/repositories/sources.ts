import { eq } from 'drizzle-orm'
import type { NewSource, Source } from '#shared/types'
import { db, type DB } from '../client'
import { sources } from '../schema'

export function listSources(database: DB = db): Source[] {
  return database.select().from(sources).all()
}

export function getSource(id: number, database: DB = db): Source | undefined {
  return database.select().from(sources).where(eq(sources.id, id)).get()
}

export function createSource(data: NewSource, database: DB = db): Source {
  return database.insert(sources).values(data).returning().get()
}

export function updateSource(
  id: number,
  patch: Partial<NewSource>,
  database: DB = db,
): Source | undefined {
  return database
    .update(sources)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sources.id, id))
    .returning()
    .get()
}

export function deleteSource(id: number, database: DB = db): void {
  database.delete(sources).where(eq(sources.id, id)).run()
}
