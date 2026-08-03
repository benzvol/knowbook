import type {
  FeedTarget,
  NewItem,
  RefreshCounts,
  RefreshSummary,
  SubfeedRefreshSummary,
} from '#shared/types'
import { db, type DB } from '../db/client'
import {
  getItemBySourceGuid,
  getSource,
  getSubfeed,
  upsertItem,
} from '../db/repositories'
import { SourceNotFoundError, SubfeedNotFoundError } from './errors'
import { pages, type PagesOptions } from './pagination'
import { subfeedTarget } from './target'

export type { RefreshSummary, SubfeedRefreshSummary } from '#shared/types'

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
