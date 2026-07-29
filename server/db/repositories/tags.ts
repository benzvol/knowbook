import { and, eq } from 'drizzle-orm'
import type { NewTag, Tag } from '#shared/types'
import { db, type DB } from '../client'
import { sourceTags, tags } from '../schema'

export function listTags(database: DB = db): Tag[] {
  return database.select().from(tags).all()
}

export function getTag(id: number, database: DB = db): Tag | undefined {
  return database.select().from(tags).where(eq(tags.id, id)).get()
}

export function createTag(data: NewTag, database: DB = db): Tag {
  return database.insert(tags).values(data).returning().get()
}

export function updateTag(
  id: number,
  patch: Partial<NewTag>,
  database: DB = db,
): Tag | undefined {
  return database
    .update(tags)
    .set(patch)
    .where(eq(tags.id, id))
    .returning()
    .get()
}

export function deleteTag(id: number, database: DB = db): void {
  database.delete(tags).where(eq(tags.id, id)).run()
}

// --- source <-> tag membership --------------------------------------------

export function tagsForSource(sourceId: number, database: DB = db): Tag[] {
  return database
    .select({
      id: tags.id,
      name: tags.name,
    })
    .from(sourceTags)
    .innerJoin(tags, eq(tags.id, sourceTags.tagId))
    .where(eq(sourceTags.sourceId, sourceId))
    .all()
}

export function attachTag(
  sourceId: number,
  tagId: number,
  database: DB = db,
): void {
  database
    .insert(sourceTags)
    .values({ sourceId, tagId })
    .onConflictDoNothing()
    .run()
}

export function detachTag(
  sourceId: number,
  tagId: number,
  database: DB = db,
): void {
  database
    .delete(sourceTags)
    .where(and(eq(sourceTags.sourceId, sourceId), eq(sourceTags.tagId, tagId)))
    .run()
}
