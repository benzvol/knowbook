import { asc, eq, min } from 'drizzle-orm'
import type {
  Bookmark,
  BookmarkRef,
  BookmarkWithItem,
  NewBookmark,
} from '#shared/types'
import { db, type DB } from '../client'
import { bookmarks, items } from '../schema'

export function listBookmarks(database: DB = db): Bookmark[] {
  return database
    .select()
    .from(bookmarks)
    .orderBy(asc(bookmarks.sortOrder), asc(bookmarks.id))
    .all()
}

/**
 * Every bookmark hydrated with its item, in manual order. Inner join is safe:
 * the FK plus cascade means a bookmark without its item cannot exist.
 */
export function listBookmarksWithItems(database: DB = db): BookmarkWithItem[] {
  return database
    .select({ bookmarks, items })
    .from(bookmarks)
    .innerJoin(items, eq(bookmarks.itemId, items.id))
    .orderBy(asc(bookmarks.sortOrder), asc(bookmarks.id))
    .all()
    .map((row) => ({ ...row.bookmarks, item: row.items }))
}

/**
 * `{ id, itemId }` pairs for every bookmark, for the toggle-state endpoint and
 * `moveBookmark`'s return value. Ordered the same as `listBookmarks` so a move
 * result reflects the new manual order, not rowid order.
 */
export function listBookmarkRefs(database: DB = db): BookmarkRef[] {
  return database
    .select({ id: bookmarks.id, itemId: bookmarks.itemId })
    .from(bookmarks)
    .orderBy(asc(bookmarks.sortOrder), asc(bookmarks.id))
    .all()
}

export function getBookmark(
  id: number,
  database: DB = db,
): Bookmark | undefined {
  return database.select().from(bookmarks).where(eq(bookmarks.id, id)).get()
}

/** A single bookmark hydrated with its item, for the create/patch responses. */
export function getBookmarkWithItem(
  id: number,
  database: DB = db,
): BookmarkWithItem | undefined {
  const row = database
    .select({ bookmarks, items })
    .from(bookmarks)
    .innerJoin(items, eq(bookmarks.itemId, items.id))
    .where(eq(bookmarks.id, id))
    .get()
  return row && { ...row.bookmarks, item: row.items }
}

export function getBookmarkByItemId(
  itemId: number,
  database: DB = db,
): Bookmark | undefined {
  return database
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.itemId, itemId))
    .get()
}

/**
 * When `data.sortOrder` is omitted, the new bookmark goes to the top of the
 * manual order — the thing you just saved is the thing you want to see
 * without paging. An explicitly supplied `sortOrder` is still honoured
 * (issue 10's import needs that). Negative values are harmless: any move
 * resequences the whole list.
 */
export function createBookmark(data: NewBookmark, database: DB = db): Bookmark {
  return database.transaction((tx) => {
    let sortOrder = data.sortOrder
    if (sortOrder === undefined) {
      const [row] = tx
        .select({ min: min(bookmarks.sortOrder) })
        .from(bookmarks)
        .all()
      sortOrder = (row?.min ?? 0) - 1
    }
    return tx
      .insert(bookmarks)
      .values({ ...data, sortOrder })
      .returning()
      .get()
  })
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
 * The whole-list resequencing primitive — used by `moveBookmark` below and by
 * issue 10's import.
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

export type BookmarkMoveTarget =
  | { to: 'first' }
  | { to: 'last' }
  | { to: 'after'; afterId: number }
  | { to: 'before'; beforeId: number }

/**
 * Move one bookmark to a new position in the manual order and resequence
 * every row through `reorderBookmarks`, so there is one resequencing
 * implementation. A move onto the current position is a no-op. Returns the
 * new full order, or `undefined` when `id` (or `afterId`/`beforeId`) is
 * unknown, so the route can 404 without a second read.
 *
 * A move rather than a client-supplied reordered id list: the bookmark list
 * is paged and filtered, so the client never holds every id — `moveBookmark`
 * is a globally meaningful statement ("put this after/before that") even
 * when only a page is visible.
 */
export function moveBookmark(
  id: number,
  target: BookmarkMoveTarget,
  database: DB = db,
): BookmarkRef[] | undefined {
  const ids = listBookmarks(database).map((b) => b.id)
  if (!ids.includes(id)) return undefined

  const withoutId = ids.filter((existing) => existing !== id)

  let to: number
  switch (target.to) {
    case 'first':
      to = 0
      break
    case 'last':
      to = withoutId.length
      break
    case 'after': {
      const anchor = withoutId.indexOf(target.afterId)
      if (anchor === -1) return undefined
      to = anchor + 1
      break
    }
    case 'before': {
      const anchor = withoutId.indexOf(target.beforeId)
      if (anchor === -1) return undefined
      to = anchor
      break
    }
  }

  withoutId.splice(to, 0, id)

  // No-op when the move doesn't change the order — avoids bumping every
  // row's sortOrder for nothing.
  const changed = withoutId.some((existing, index) => existing !== ids[index])
  if (changed) reorderBookmarks(withoutId, database)
  return listBookmarkRefs(database)
}
