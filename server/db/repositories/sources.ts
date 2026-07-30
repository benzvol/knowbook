import { eq } from 'drizzle-orm'
import type { NewSource, Source, SourceWithTags } from '#shared/types'
import { db, type DB } from '../client'
import { sources } from '../schema'
import { tagsForSources } from './tags'

export function listSources(database: DB = db): Source[] {
  return database.select().from(sources).all()
}

export function getSource(id: number, database: DB = db): Source | undefined {
  return database.select().from(sources).where(eq(sources.id, id)).get()
}

// Hydrated variants used by the source read routes, avoiding an N+1 tag query.
export function listSourcesWithTags(database: DB = db): SourceWithTags[] {
  const rows = listSources(database)
  const tagsBySource = tagsForSources(
    rows.map((s) => s.id),
    database,
  )
  return rows.map((source) => ({
    ...source,
    tags: tagsBySource.get(source.id) ?? [],
  }))
}

export function getSourceWithTags(
  id: number,
  database: DB = db,
): SourceWithTags | undefined {
  const source = getSource(id, database)
  if (!source) return undefined
  const tagsBySource = tagsForSources([id], database)
  return { ...source, tags: tagsBySource.get(id) ?? [] }
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
