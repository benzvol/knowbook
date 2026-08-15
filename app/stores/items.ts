import { defineStore } from 'pinia'
import type {
  ItemQueryInput,
  SearchQueryInput,
} from '#shared/schemas/itemQuery'
import type { Item, ItemFacets, ItemPage, RefreshCounts } from '#shared/types'

export type ItemViewKind = 'source' | 'subfeed' | 'feed'

/** Identifies which target's items view a call is for. */
export interface ItemViewRef {
  kind: ItemViewKind
  id: number
}

export interface SearchMeta {
  matched: boolean
  pagesSearched: number
  capHit: boolean
  counts: RefreshCounts
}

type ViewResult = ItemPage<Item> & {
  facets: ItemFacets
  /**
   * The settings-backed page size used when the query names none. Distinct
   * from `pageSize` (the size actually applied), so the UI can label "Default"
   * without an explicitly chosen size masquerading as the default.
   */
  defaultPageSize: number
}

const SEGMENT: Record<ItemViewKind, string> = {
  source: 'sources',
  subfeed: 'subfeeds',
  feed: 'feeds',
}

function viewKey(ref: ItemViewRef): string {
  return `${ref.kind}:${ref.id}`
}

function basePath(ref: ItemViewRef): string {
  return `/api/${SEGMENT[ref.kind]}/${ref.id}`
}

// Keyed by view (`source:1` / `subfeed:2` / `feed:3`), so a source, subfeed
// and feed page can share this one store without stomping each other's
// results — and so a page switching filters doesn't briefly show a blank
// page belonging to a different target.
export const useItemsStore = defineStore('items', {
  state: () => ({
    views: {} as Record<string, ViewResult>,
    lastSearch: {} as Record<string, SearchMeta>,
    loading: false,
    error: null as string | null,
    errorStatus: null as number | null,
  }),
  actions: {
    async fetchItems(
      ref: ItemViewRef,
      query: ItemQueryInput,
    ): Promise<ViewResult | undefined> {
      this.loading = true
      this.error = null
      this.errorStatus = null
      try {
        const result = await $fetch<ViewResult>(`${basePath(ref)}/items`, {
          query,
        })
        this.views[viewKey(ref)] = result
        return result
      } catch (cause) {
        // Deliberately leaves the previous page in `views` untouched — a
        // failed refetch (e.g. a flaky request while paging) shouldn't blank
        // out what's already on screen.
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      } finally {
        this.loading = false
      }
    },

    async searchDeep(
      ref: ItemViewRef,
      query: SearchQueryInput,
    ): Promise<SearchMeta | undefined> {
      this.loading = true
      this.error = null
      this.errorStatus = null
      try {
        const result = await $fetch<{ page: ViewResult; search: SearchMeta }>(
          `${basePath(ref)}/search`,
          { method: 'POST', query },
        )
        const key = viewKey(ref)
        this.views[key] = result.page
        this.lastSearch[key] = result.search
        return result.search
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      } finally {
        this.loading = false
      }
    },
  },
})
