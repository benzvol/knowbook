import type { FeedTarget, RefreshCounts } from '#shared/types'
import { db } from '../db/client'
import { feedMembers, getFeed, getSource, getSubfeed } from '../db/repositories'
import {
  FeedNotFoundError,
  SourceNotFoundError,
  SubfeedNotFoundError,
} from './errors'
import { DEFAULT_MAX_PAGES } from './pagination'
import type { ParsedItem } from './parse'
import { refreshTarget, type RefreshOptions } from './refresh'
import { subfeedTarget } from './target'

export interface SearchOptions extends RefreshOptions {
  subfeedId?: number
}

export interface SearchResult {
  matched: boolean
  pagesSearched: number
  /** True only when the cap was actually exhausted without a match — not
   * when the feed simply ran out of pages before reaching it. */
  capHit: boolean
  counts: RefreshCounts
}

/**
 * Walk a target's pages via the same fetch/parse/upsert loop a plain refresh
 * uses (`refreshTarget`), stopping at the first page containing a match —
 * caching every page it fetches along the way, so the same search is instant
 * next time. Callers re-read the cache for the actual matched item(s); this
 * only reports whether/where a match landed.
 */
export async function searchAndCache(
  target: FeedTarget,
  sourceId: number,
  predicate: (item: ParsedItem) => boolean,
  opts: SearchOptions = {},
): Promise<SearchResult> {
  const database = opts.database ?? db
  const isPaginated = !!target.pagination?.pageParam
  const maxPages = isPaginated ? (opts.maxPages ?? DEFAULT_MAX_PAGES) : 1

  const { matched, ...counts } = await refreshTarget(
    target,
    sourceId,
    database,
    opts,
    { subfeedId: opts.subfeedId, until: predicate },
  )

  return {
    matched,
    pagesSearched: counts.pagesFetched,
    capHit: !matched && counts.pagesFetched >= maxPages,
    counts,
  }
}

export async function searchSource(
  sourceId: number,
  predicate: (item: ParsedItem) => boolean,
  opts: RefreshOptions = {},
): Promise<SearchResult> {
  const database = opts.database ?? db
  const source = getSource(sourceId, database)
  if (!source) {
    throw new SourceNotFoundError(sourceId)
  }

  return searchAndCache(source, sourceId, predicate, { ...opts, database })
}

export async function searchSubfeed(
  subfeedId: number,
  predicate: (item: ParsedItem) => boolean,
  opts: RefreshOptions = {},
): Promise<SearchResult> {
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
  return searchAndCache(target, source.id, predicate, {
    ...opts,
    database,
    subfeedId,
  })
}

export async function searchFeed(
  feedId: number,
  predicate: (item: ParsedItem) => boolean,
  opts: RefreshOptions = {},
): Promise<SearchResult> {
  const database = opts.database ?? db
  if (!getFeed(feedId, database)) {
    throw new FeedNotFoundError(feedId)
  }

  const counts: RefreshCounts = {
    seen: 0,
    inserted: 0,
    updated: 0,
    pagesFetched: 0,
  }
  let matched = false
  let capHit = false

  // Sequential, mirroring `refreshFeed`: stop as soon as one member matches
  // — there's no need to walk the rest once the item has been found and
  // cached.
  for (const member of feedMembers(feedId, database)) {
    const result = member.subfeedId
      ? await searchSubfeed(member.subfeedId, predicate, opts)
      : await searchSource(member.sourceId, predicate, opts)

    counts.seen += result.counts.seen
    counts.inserted += result.counts.inserted
    counts.updated += result.counts.updated
    counts.pagesFetched += result.counts.pagesFetched
    capHit = capHit || result.capHit

    if (result.matched) {
      matched = true
      break
    }
  }

  return {
    matched,
    pagesSearched: counts.pagesFetched,
    capHit: !matched && capHit,
    counts,
  }
}
