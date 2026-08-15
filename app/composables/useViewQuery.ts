import type { ZodType } from 'zod'
import type { ViewQuery } from '#shared/types'

/**
 * Parses a view's query params (source/subfeed/feed item views, or the
 * bookmarks view) through its own Zod schema. `safeParse` because a
 * hand-edited/stale URL must fall back to defaults, not crash the page.
 * Shared by `useItemView` and `useBookmarkView` so the two URL formats can't
 * drift apart.
 */
export function parseViewQuery<Q extends ViewQuery>(
  schema: ZodType<Q>,
  query: Record<string, unknown>,
  fallback: Q,
): Q {
  const parsed = schema.safeParse(query)
  return parsed.success ? parsed.data : fallback
}

/**
 * The inverse: only writes params that differ from their default, so the URL
 * stays clean for the common case. `mode` (item views only, never `sort`) is
 * added by the caller on top of this.
 */
export function viewQueryToUrlParams<Q extends ViewQuery>(
  state: Q,
  defaultSort: Q['sort'],
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {}
  if (state.q) next.q = state.q
  if (state.tags.length) next.tags = state.tags
  if (state.sourceIds.length) next.sourceIds = state.sourceIds.map(String)
  if (state.sort !== defaultSort) next.sort = state.sort
  if (state.page !== 1) next.page = String(state.page)
  if (state.pageSize) next.pageSize = String(state.pageSize)
  return next
}
