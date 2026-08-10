import type { Item } from '#shared/types'
import { db, type DB } from '../db/client'
import { feedMembers, getFeed, itemsForSource } from '../db/repositories'
import { FeedNotFoundError } from './errors'

export interface FeedItemsOptions {
  database?: DB
}

// DESC by publishedAt, with undated items last. `itemsForSource` already
// orders each source's own rows; this re-sorts across the concatenated sets.
// `-Infinity` on both sides makes undated items compare equal to each other
// and sort after every dated item, without the `NaN` a raw subtraction on
// `null` would produce.
function byPublishedAtDesc(a: Item, b: Item): number {
  return (
    (b.publishedAt?.getTime() ?? -Infinity) -
    (a.publishedAt?.getTime() ?? -Infinity)
  )
}

/**
 * Merge a feed's members into one de-duplicated, chronologically ordered
 * stream of already-cached items. Reads only the SQLite item cache — no
 * network fetch; freshness comes from each member's own refresh, or the
 * aggregate `refreshFeed`.
 *
 * Members collapse to their distinct `sourceId`s before reading: cached
 * items carry only `sourceId` (issue 05 deliberately didn't persist which
 * subfeed an item arrived through), so a whole-source membership and a
 * subfeed-of-that-source membership resolve to the same items. Reading each
 * source once is therefore also the de-dup pass — `items_source_guid_unique`
 * already guarantees one row per (sourceId, guid).
 */
export function feedItems(feedId: number, opts: FeedItemsOptions = {}): Item[] {
  const database = opts.database ?? db
  if (!getFeed(feedId, database)) {
    throw new FeedNotFoundError(feedId)
  }

  const sourceIds = new Set(
    feedMembers(feedId, database).map((member) => member.sourceId),
  )

  return [...sourceIds]
    .flatMap((sourceId) => itemsForSource(sourceId, database))
    .sort(byPublishedAtDesc)
}
