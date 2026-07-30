import { and, eq, inArray, notInArray } from 'drizzle-orm'
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

// Hydration helper for lists of sources: one join instead of N `tagsForSource`
// calls. Keyed by sourceId; sources with no tags are simply absent from the map.
export function tagsForSources(
  sourceIds: number[],
  database: DB = db,
): Map<number, Tag[]> {
  const result = new Map<number, Tag[]>()
  if (sourceIds.length === 0) return result

  const rows = database
    .select({
      sourceId: sourceTags.sourceId,
      id: tags.id,
      name: tags.name,
    })
    .from(sourceTags)
    .innerJoin(tags, eq(tags.id, sourceTags.tagId))
    .where(inArray(sourceTags.sourceId, sourceIds))
    .all()

  for (const { sourceId, ...tag } of rows) {
    const existing = result.get(sourceId)
    if (existing) existing.push(tag)
    else result.set(sourceId, [tag])
  }
  return result
}

// Looks up tags by id; used to validate a membership payload's tagIds before
// touching source_tags, so unknown ids can be reported as a 400.
export function findTagsByIds(ids: number[], database: DB = db): Tag[] {
  if (ids.length === 0) return []
  return database.select().from(tags).where(inArray(tags.id, ids)).all()
}

// Replaces a source's whole tag set from a `tagIds` array: detaches anything
// not in the target set, attaches anything missing, in one transaction.
export function setSourceTags(
  sourceId: number,
  tagIds: number[],
  database: DB = db,
): Tag[] {
  const targetIds = [...new Set(tagIds)]

  database.transaction((tx) => {
    if (targetIds.length > 0) {
      tx.delete(sourceTags)
        .where(
          and(
            eq(sourceTags.sourceId, sourceId),
            notInArray(sourceTags.tagId, targetIds),
          ),
        )
        .run()
    } else {
      tx.delete(sourceTags).where(eq(sourceTags.sourceId, sourceId)).run()
    }

    if (targetIds.length > 0) {
      tx.insert(sourceTags)
        .values(targetIds.map((tagId) => ({ sourceId, tagId })))
        .onConflictDoNothing()
        .run()
    }
  })

  return tagsForSource(sourceId, database)
}
