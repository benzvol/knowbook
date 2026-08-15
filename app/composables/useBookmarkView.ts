import {
  bookmarkQuerySchema,
  type BookmarkQueryInput,
} from '#shared/schemas/bookmark'

// Reuses the server's own coercion/defaults, the way `useItemView`'s
// `parseQuery` does for the item query contract.
function parseQuery(query: Record<string, unknown>): BookmarkQueryInput {
  return parseViewQuery(bookmarkQuerySchema, query, {
    tags: [],
    sourceIds: [],
    sort: 'manual',
    page: 1,
  })
}

/**
 * The `useItemView` counterpart for the bookmarks page: owns the reactive
 * `BookmarkQueryInput`, syncs it to the URL, and drives `useBookmarksStore`.
 * No layout mode (the bookmarks page only ever renders `list`, since drag
 * ordering has no meaning in `grid`/`editorial`) and no refresh/search-deep
 * (the bookmark set is always fully cached — there is nothing to walk over
 * the network).
 *
 * Does **not** fetch on its own: the page wraps `reload()` in its own
 * `useAsyncData`, matching `useItemView`'s SSR-await pattern.
 */
export function useBookmarkView() {
  const route = useRoute()
  const router = useRouter()
  const store = useBookmarksStore()

  const state = reactive<BookmarkQueryInput>(parseQuery(route.query))

  const query = computed<BookmarkQueryInput>(() => ({ ...state }))
  const view = computed(() => store.page ?? undefined)
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)

  function syncUrl() {
    router.replace({ query: viewQueryToUrlParams(state, 'manual') })
  }

  async function load() {
    return store.fetchPage(query.value)
  }

  /**
   * Apply a filter/sort/page-size change. Always resets to page 1 — the
   * previous page's contents are no longer meaningful once the result set
   * has changed underneath it.
   */
  async function patch(partial: Partial<Omit<BookmarkQueryInput, 'page'>>) {
    Object.assign(state, partial, { page: 1 })
    syncUrl()
    await load()
  }

  async function setPage(page: number) {
    state.page = page
    syncUrl()
    await load()
  }

  return {
    query,
    view,
    loading,
    error,
    patch,
    setPage,
    reload: load,
  }
}
