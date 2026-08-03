import type { FeedTarget, Source, Subfeed } from '#shared/types'

// A subfeed is its parent's endpoint and pagination with the subfeed's own
// query params merged over the parent's — the subfeed wins on key collisions.
// Pagination is deliberately inherited, not overridable: paging is a property
// of the endpoint, and both the source and its subfeeds hit the same one.
export function subfeedTarget(
  source: Pick<Source, 'url' | 'pagination' | 'queryParams'>,
  subfeed: Pick<Subfeed, 'queryParams'>,
): FeedTarget {
  return {
    url: source.url,
    pagination: source.pagination,
    queryParams: { ...source.queryParams, ...subfeed.queryParams },
  }
}
