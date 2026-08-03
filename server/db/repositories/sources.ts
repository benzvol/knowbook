import { eq } from 'drizzle-orm'
import type {
  NewSource,
  Source,
  SourceListItem,
  SourceWithTags,
} from '#shared/types'
import { db, type DB } from '../client'
import { sources } from '../schema'
import { subfeedCountsForSources } from './subfeeds'
import { tagsForSources } from './tags'

export function listSources(database: DB = db): Source[] {
  return database.select().from(sources).all()
}

export function getSource(id: number, database: DB = db): Source | undefined {
  return database.select().from(sources).where(eq(sources.id, id)).get()
}

// Hydrated variant used by the source list route: tags plus a subfeed count
// for the row-menu badge, each fetched with one batched query instead of N.
export function listSourcesWithTags(database: DB = db): SourceListItem[] {
  const rows = listSources(database)
  const sourceIds = rows.map((s) => s.id)
  const tagsBySource = tagsForSources(sourceIds, database)
  const subfeedCounts = subfeedCountsForSources(sourceIds, database)
  return rows.map((source) => ({
    ...source,
    tags: tagsBySource.get(source.id) ?? [],
    subfeedCount: subfeedCounts.get(source.id) ?? 0,
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
