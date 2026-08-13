// Hand-written structural types shared between server and client.
// These have no runtime dependencies and are safe to import from either side;
// they also back the JSON columns in the DB schema via Drizzle's `.$type<>()`.

/**
 * How to paginate a source. Query-param names are configurable because feeds
 * differ (e.g. `page`/`limit` vs `p`/`per_page`).
 */
export interface PaginationConfig {
  /** Query-param name carrying the page number (e.g. `page`). */
  pageParam?: string
  /** Query-param name carrying the page size (e.g. `limit`, `per_page`). */
  sizeParam?: string
  /** Default page size to request when listing. */
  pageSize?: number
  /** 1-based (most feeds) or 0-based page indexing. */
  startPage?: number
}

/** Arbitrary extra query params appended to a source/subfeed request URL. */
export type QueryParams = Record<string, string>

/** Free-form tags carried on a fetched item or a bookmark. */
export type ItemTags = string[]

/** Value stored in the key/value settings table (JSON-encoded). */
export type SettingValue =
  | string
  | number
  | boolean
  | null
  | SettingValue[]
  | { [key: string]: SettingValue }

/**
 * Anything the feed engine can turn into fetchable page URLs: a source, or a
 * subfeed merged over its parent (`subfeedTarget` in `server/feed/target.ts`).
 * Declared structurally rather than as `Pick<Source, ...>` so this
 * hand-written, dependency-free file never has to import back from the
 * Drizzle-inferred `Source` type it partly describes.
 */
export interface FeedTarget {
  url: string
  pagination?: PaginationConfig | null
  queryParams?: QueryParams | null
}

/** How many items a refresh saw/cached, independent of what it refreshed. */
export interface RefreshCounts {
  seen: number
  inserted: number
  updated: number
  pagesFetched: number
}

/** Result of refreshing a source. */
export interface RefreshSummary extends RefreshCounts {
  sourceId: number
}

/**
 * Result of refreshing a subfeed. `sourceId` keeps its single meaning — the
 * source items are cached under — which for a subfeed is the parent.
 */
export interface SubfeedRefreshSummary extends RefreshSummary {
  subfeedId: number
}

/**
 * Result of refreshing every member of a feed. Counts are the aggregate
 * across members; `members` keeps each member's own summary so the UI can
 * report a partial failure per-member later.
 */
export interface FeedRefreshSummary extends RefreshCounts {
  feedId: number
  members: (RefreshSummary | SubfeedRefreshSummary)[]
}

/** One page of a filtered/sorted item view (`server/feed/view.ts`). */
export interface ItemPage<T> {
  items: T[]
  /** Matches before paging. */
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** Distinct values present in the *unfiltered* set, for the toolbar's selects. */
export interface ItemFacets {
  tags: string[]
  sources: { id: number; title: string }[]
}
