import type {
  FeedRefreshSummary,
  FeedTarget,
  NewItem,
  RefreshCounts,
  RefreshSummary,
  SubfeedRefreshSummary,
} from '#shared/types'
import { db, type DB } from '../db/client'
import {
  feedMembers,
  getFeed,
  getItemBySourceGuid,
  getSource,
  getSubfeed,
  upsertItem,
} from '../db/repositories'
import {
  FeedNotFoundError,
  SourceNotFoundError,
  SubfeedNotFoundError,
} from './errors'
import { pages, type PagesOptions } from './pagination'
import { subfeedTarget } from './target'

export type {
  FeedRefreshSummary,
  RefreshSummary,
  SubfeedRefreshSummary,
} from '#shared/types'

export interface RefreshOptions extends PagesOptions {
  database?: DB
}

// Kept as a separate exported name for backwards compatibility with callers
// that referred to it before subfeed refresh existed.
export type RefreshSourceOptions = RefreshOptions

// Shared fetch/parse/upsert loop, over any FeedTarget. Items always cache
// under `sourceId` — for a subfeed that's the parent's id — so the existing
// `(sourceId, guid)` unique index keeps a single row per entry regardless of
// which target it arrived through.
async function refreshTarget(
  target: FeedTarget,
  sourceId: number,
  database: DB,
  opts: PagesOptions,
): Promise<RefreshCounts> {
  const counts: RefreshCounts = {
    seen: 0,
    inserted: 0,
    updated: 0,
    pagesFetched: 0,
  }

  for await (const page of pages(target, opts)) {
    counts.pagesFetched++

    for (const parsed of page) {
      counts.seen++
      const existing = getItemBySourceGuid(sourceId, parsed.guid, database)
      const newItem: NewItem = { ...parsed, sourceId }
      upsertItem(newItem, database)
      if (existing) counts.updated++
      else counts.inserted++
    }
  }

  return counts
}

export async function refreshSource(
  sourceId: number,
  opts: RefreshSourceOptions = {},
): Promise<RefreshSummary> {
  const database = opts.database ?? db
  const source = getSource(sourceId, database)
  if (!source) {
    throw new SourceNotFoundError(sourceId)
  }

  const counts = await refreshTarget(source, sourceId, database, opts)
  return { sourceId, ...counts }
}

export async function refreshSubfeed(
  subfeedId: number,
  opts: RefreshOptions = {},
): Promise<SubfeedRefreshSummary> {
  const database = opts.database ?? db
  const subfeed = getSubfeed(subfeedId, database)
  if (!subfeed) {
    throw new SubfeedNotFoundError(subfeedId)
  }

  const source = getSource(subfeed.sourceId, database)
  if (!source) {
    throw new SourceNotFoundError(subfeed.sourceId)
  }

  const target = subfeedTarget(source, subfeed)
  const counts = await refreshTarget(target, source.id, database, opts)
  return { subfeedId, sourceId: source.id, ...counts }
}

export async function refreshFeed(
  feedId: number,
  opts: RefreshOptions = {},
): Promise<FeedRefreshSummary> {
  const database = opts.database ?? db
  if (!getFeed(feedId, database)) {
    throw new FeedNotFoundError(feedId)
  }

  const summary: FeedRefreshSummary = {
    feedId,
    members: [],
    seen: 0,
    inserted: 0,
    updated: 0,
    pagesFetched: 0,
  }

  // Sequential, not `Promise.all`: members frequently share a source, and
  // concurrent upserts to the same (sourceId, guid) row would race on the
  // one shared SQLite connection. Each member goes through the exact same
  // `refreshSource`/`refreshSubfeed` path as refreshing it stand-alone,
  // forwarding `opts` whole — both callees resolve `opts.database` (and any
  // injected `fetchImpl`) themselves. A member's rejection propagates
  // immediately (fail-fast) rather than being collected: `members` exists so
  // a later issue can report a partial failure per-member, not to make that
  // reporting possible today.
  for (const member of feedMembers(feedId, database)) {
    const result = member.subfeedId
      ? await refreshSubfeed(member.subfeedId, opts)
      : await refreshSource(member.sourceId, opts)

    summary.members.push(result)
    summary.seen += result.seen
    summary.inserted += result.inserted
    summary.updated += result.updated
    summary.pagesFetched += result.pagesFetched
  }

  return summary
}
