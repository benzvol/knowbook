// Hand-written structural types shared between server and client.
// These have no runtime dependencies and are safe to import from either side;
// they also back the JSON columns in the DB schema via Drizzle's `.$type<>()`.

/** A source is either a standard RSS/Atom feed or a paginated news-style feed. */
export type SourceType = 'news' | 'standard'

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
