import { asc, eq } from 'drizzle-orm'
import type { Bookmark, NewBookmark } from '#shared/types'
import { db, type DB } from '../client'
import { bookmarks } from '../schema'

export function listBookmarks(database: DB = db): Bookmark[] {
  return database
    .select()
    .from(bookmarks)
    .orderBy(asc(bookmarks.sortOrder))
    .all()
}

export function getBookmark(
  id: number,
  database: DB = db,
): Bookmark | undefined {
  return database.select().from(bookmarks).where(eq(bookmarks.id, id)).get()
}

export function createBookmark(data: NewBookmark, database: DB = db): Bookmark {
  return database.insert(bookmarks).values(data).returning().get()
}

export function updateBookmark(
  id: number,
  patch: Partial<NewBookmark>,
  database: DB = db,
): Bookmark | undefined {
  return database
    .update(bookmarks)
    .set(patch)
    .where(eq(bookmarks.id, id))
    .returning()
    .get()
}

export function deleteBookmark(id: number, database: DB = db): void {
  database.delete(bookmarks).where(eq(bookmarks.id, id)).run()
}

/**
 * Persist a manual drag-and-drop ordering: `orderedIds` lists bookmark ids in
 * their new visual order, and each row's sortOrder is set to its index.
 * Used by the bookmarks UI (issue 08).
 */
export function reorderBookmarks(
  orderedIds: number[],
  database: DB = db,
): void {
  database.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(bookmarks)
        .set({ sortOrder: index })
        .where(eq(bookmarks.id, id))
        .run()
    })
  })
}
