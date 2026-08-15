import { itemQuerySchema, type ItemQueryInput } from '#shared/schemas/itemQuery'
import type { RefreshCounts } from '#shared/types'
import type { ItemViewRef, SearchMeta } from '~/stores/items'

export const ITEM_VIEW_MODES = ['list', 'grid', 'editorial'] as const
export type ItemViewMode = (typeof ITEM_VIEW_MODES)[number]

function isViewMode(value: unknown): value is ItemViewMode {
  return (
    typeof value === 'string' &&
    (ITEM_VIEW_MODES as readonly string[]).includes(value)
  )
}

// Reuses the server's own coercion/defaults (repeated-or-comma-separated
// tags, string->number, sort enum, …) rather than re-implementing the query
// contract client-side.
function parseQuery(query: Record<string, unknown>): ItemQueryInput {
  return parseViewQuery(itemQuerySchema, query, {
    tags: [],
    sourceIds: [],
    sort: 'newest',
    page: 1,
  })
}

export interface UseItemViewOptions {
  /**
   * Refetches the target from its origin. Each view kind refreshes through a
   * different store (`useSourcesStore`/`useSubfeedsStore`/`useFeedsStore`), so
   * the page supplies the call and this composable owns the surrounding
   * reload + pending state. All three summaries extend `RefreshCounts`, so one
   * shared success message covers them.
   */
  refresh?: () => Promise<RefreshCounts | undefined>
}

/**
 * Owns the reactive item-view query and layout mode for one target (a
 * source, a subfeed, or a feed), syncs both to the page's URL query, and
 * drives `useItemsStore`. Shared unchanged by every items page — a filter or
 * sort emitted from `ItemViewToolbar` calls `patch`, a pager click calls
 * `setPage`, and the mode switch calls `setMode`.
 *
 * Does **not** fetch on its own: the caller wraps `reload()` in its own
 * `useAsyncData`, matching every other page in the app
 * (`app/pages/feeds/[id].vue`), so the initial load is awaited during SSR
 * instead of racing hydration.
 */
export function useItemView(
  target: ItemViewRef,
  opts: UseItemViewOptions = {},
) {
  const route = useRoute()
  const router = useRouter()
  const store = useItemsStore()

  const initial = parseQuery(route.query)
  const state = reactive<ItemQueryInput>(initial)
  const mode = ref<ItemViewMode>(
    isViewMode(route.query.mode) ? route.query.mode : 'list',
  )

  const query = computed<ItemQueryInput>(() => ({ ...state }))
  const key = `${target.kind}:${target.id}`
  const view = computed(() => store.views[key])
  const searchMeta = computed<SearchMeta | undefined>(
    () => store.lastSearch[key],
  )
  const loading = computed(() => store.loading)
  const error = computed(() => store.error)

  // The mode switch is deliberately not part of `itemQuerySchema` — it's
  // client-only presentation and never sent to the API — but it still lives
  // in the URL so a grid view survives a reload.
  function syncUrl() {
    const next = viewQueryToUrlParams(state, 'newest')
    if (mode.value !== 'list') next.mode = mode.value
    router.replace({ query: next })
  }

  // Returns the fetched page rather than void: `useAsyncData(key, () =>
  // reload())` needs a non-`undefined` result to cache in the Nuxt payload,
  // or it can't tell "not yet fetched" from "fetched, got nothing" and
  // refetches on the client — racing hydration against the view's own
  // Pinia-store-backed render.
  async function load() {
    return store.fetchItems(target, query.value)
  }

  /**
   * Apply a filter/sort/search/page-size change. Always resets to page 1 —
   * the previous page's contents are no longer meaningful once the result
   * set has changed underneath it.
   */
  async function patch(partial: Partial<Omit<ItemQueryInput, 'page'>>) {
    Object.assign(state, partial, { page: 1 })
    syncUrl()
    await load()
  }

  async function setPage(page: number) {
    state.page = page
    syncUrl()
    await load()
  }

  // Purely presentational: no refetch, no page reset.
  function setMode(next: ItemViewMode) {
    mode.value = next
    syncUrl()
  }

  async function searchDeep(): Promise<SearchMeta | undefined> {
    if (!state.q) return undefined
    return store.searchDeep(target, { ...query.value, q: state.q })
  }

  // Refreshing from inside the view saves the round trip through the sources
  // list that reading a stale view otherwise required.
  const refreshing = ref(false)
  const canRefresh = computed(() => !!opts.refresh)

  async function refresh(): Promise<RefreshCounts | undefined> {
    if (!opts.refresh) return undefined
    refreshing.value = true
    try {
      const summary = await opts.refresh()
      // Reload regardless: a partial refresh still cached something worth
      // showing, and a failed one leaves the previous page in place.
      await load()
      return summary
    } finally {
      refreshing.value = false
    }
  }

  return {
    query,
    mode,
    view,
    searchMeta,
    loading,
    error,
    patch,
    setPage,
    setMode,
    searchDeep,
    refresh,
    refreshing,
    canRefresh,
    reload: load,
  }
}
