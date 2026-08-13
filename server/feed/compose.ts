import type { Item } from '#shared/types'
import { db, type DB } from '../db/client'
import {
  feedMembers,
  getFeed,
  itemsForSource,
  itemsForSubfeed,
} from '../db/repositories'
import { FeedNotFoundError } from './errors'

export interface FeedItemsOptions {
  database?: DB
}

// DESC by publishedAt, with undated items last. Each member's own read already
// orders its rows; this re-sorts across the concatenated sets. `-Infinity` on
// both sides makes undated items compare equal to each other and sort after
// every dated item, without the `NaN` a raw subtraction on `null` would
// produce.
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
 * Each member is resolved individually — `itemsForSubfeed` when narrowed to a
 * subfeed, `itemsForSource` for a whole-source membership — rather than
 * collapsing to distinct `sourceId`s: a subfeed member now only contributes
 * the items linked to it (`item_subfeeds`), which can be a strict subset of
 * its source's full cache. A whole-source membership and a
 * subfeed-of-that-source membership can therefore legitimately overlap, so
 * the merge de-dupes by item id rather than relying on one read per source.
 */
export function feedItems(feedId: number, opts: FeedItemsOptions = {}): Item[] {
  const database = opts.database ?? db
  if (!getFeed(feedId, database)) {
    throw new FeedNotFoundError(feedId)
  }

  const byId = new Map<number, Item>()
  for (const member of feedMembers(feedId, database)) {
    const memberItems = member.subfeedId
      ? itemsForSubfeed(member.subfeedId, database)
      : itemsForSource(member.sourceId, database)
    for (const item of memberItems) byId.set(item.id, item)
  }

  return [...byId.values()].sort(byPublishedAtDesc)
}
