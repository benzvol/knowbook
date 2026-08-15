import { defineStore } from 'pinia'
import type {
  BookmarkMoveInput,
  BookmarkQueryInput,
} from '#shared/schemas/bookmark'
import type {
  BookmarkRef,
  BookmarkWithItem,
  ItemFacets,
  ItemPage,
} from '#shared/types'

type BookmarkPage = ItemPage<BookmarkWithItem> & {
  facets: ItemFacets
  defaultPageSize: number
}

// A separate store from `useItemsStore`: this one holds one un-keyed page
// plus its own mutations (create/update/delete/move), not N read-only keyed
// views. The `refs` set is what item-view cards consult to render their
// toggle state — see `ItemView.vue`'s `fetchRefs` call.
export const useBookmarksStore = defineStore('bookmarks', {
  state: () => ({
    page: null as BookmarkPage | null,
    refs: [] as BookmarkRef[],
    loading: false,
    error: null as string | null,
    errorStatus: null as number | null,
  }),
  getters: {
    // A getter, not state, so the SSR payload stays plain JSON (a `Set`
    // wouldn't (de)serialise across the wire).
    bookmarkedItemIds(state): Set<number> {
      return new Set(state.refs.map((r) => r.itemId))
    },
    refByItemId(state): Map<number, BookmarkRef> {
      return new Map(state.refs.map((r) => [r.itemId, r]))
    },
  },
  actions: {
    async fetchPage(
      query: BookmarkQueryInput,
    ): Promise<BookmarkPage | undefined> {
      this.loading = true
      this.error = null
      this.errorStatus = null
      try {
        const result = await $fetch<BookmarkPage>('/api/bookmarks', {
          query,
        })
        this.page = result
        return result
      } catch (cause) {
        // Deliberately leaves the previous page untouched — a failed
        // refetch shouldn't blank out what's already on screen.
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      } finally {
        this.loading = false
      }
    },

    // Fetched once per page load by `ItemView`/the bookmarks page — the
    // bookmark list is small enough that a client-side set beats stamping
    // `bookmarked` onto every item-view response. See the seam noted in
    // issue 08 task 6 if per-page accuracy is ever needed instead.
    async fetchRefs(): Promise<BookmarkRef[]> {
      try {
        this.refs = await $fetch<BookmarkRef[]>('/api/bookmarks/refs')
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
      }
      return this.refs
    },

    async add(itemId: number): Promise<BookmarkWithItem | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const created = await $fetch<BookmarkWithItem>('/api/bookmarks', {
          method: 'POST',
          body: { itemId },
        })
        this.refs.push({ id: created.id, itemId: created.itemId })
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      this.errorStatus = null
      try {
        await $fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
        this.refs = this.refs.filter((r) => r.id !== id)
        if (this.page) {
          this.page.items = this.page.items.filter((b) => b.id !== id)
        }
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return false
      }
    },

    // Toggles by item id, so a card only needs to know the item it's on —
    // updates `refs` locally on success so every visible card flips without
    // a refetch.
    async toggle(itemId: number): Promise<void> {
      const existing = this.refByItemId.get(itemId)
      if (existing) await this.remove(existing.id)
      else await this.add(itemId)
    },

    async updateTags(
      id: number,
      tags: string[] | null,
    ): Promise<BookmarkWithItem | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const updated = await $fetch<BookmarkWithItem>(`/api/bookmarks/${id}`, {
          method: 'PATCH',
          body: { tags },
        })
        if (this.page) {
          const index = this.page.items.findIndex((b) => b.id === id)
          if (index !== -1) this.page.items[index] = updated
        }
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    // Applies the returned order optimistically (the drag has already
    // reordered the local array visually); on failure the caller's page
    // reload restores the persisted order.
    async move(
      id: number,
      target: BookmarkMoveInput,
    ): Promise<BookmarkRef[] | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        return await $fetch<BookmarkRef[]>(`/api/bookmarks/${id}/move`, {
          method: 'POST',
          body: target,
        })
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },
  },
})
