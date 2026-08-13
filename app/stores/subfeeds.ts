import { defineStore } from 'pinia'
import type { Subfeed, SubfeedRefreshSummary } from '#shared/types'
import type {
  SubfeedCreateInput,
  SubfeedUpdateInput,
} from '#shared/schemas/subfeed'

export const useSubfeedsStore = defineStore('subfeeds', {
  state: () => ({
    bySource: {} as Record<number, Subfeed[]>,
    loading: false,
    error: null as string | null,
    errorStatus: null as number | null,
  }),
  actions: {
    async fetchOne(id: number): Promise<Subfeed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        return await $fetch<Subfeed>(`/api/subfeeds/${id}`)
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async fetchForSource(sourceId: number): Promise<Subfeed[]> {
      this.loading = true
      this.error = null
      this.errorStatus = null
      try {
        const subfeeds = await $fetch<Subfeed[]>(
          `/api/sources/${sourceId}/subfeeds`,
        )
        this.bySource[sourceId] = subfeeds
        return subfeeds
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return this.bySource[sourceId] ?? []
      } finally {
        this.loading = false
      }
    },

    async create(
      sourceId: number,
      input: SubfeedCreateInput,
    ): Promise<Subfeed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const created = await $fetch<Subfeed>(
          `/api/sources/${sourceId}/subfeeds`,
          { method: 'POST', body: input },
        )
        this.bySource[sourceId] = [...(this.bySource[sourceId] ?? []), created]
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async update(
      sourceId: number,
      id: number,
      patch: SubfeedUpdateInput,
    ): Promise<Subfeed | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        const updated = await $fetch<Subfeed>(`/api/subfeeds/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const subfeeds = this.bySource[sourceId] ?? []
        const index = subfeeds.findIndex((s) => s.id === id)
        if (index !== -1) subfeeds[index] = updated
        this.bySource[sourceId] = subfeeds
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },

    async remove(sourceId: number, id: number): Promise<boolean> {
      this.error = null
      this.errorStatus = null
      try {
        await $fetch(`/api/subfeeds/${id}`, { method: 'DELETE' })
        this.bySource[sourceId] = (this.bySource[sourceId] ?? []).filter(
          (s) => s.id !== id,
        )
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return false
      }
    },

    async refresh(
      id: number,
      maxPages?: number,
    ): Promise<SubfeedRefreshSummary | undefined> {
      this.error = null
      this.errorStatus = null
      try {
        return await $fetch<SubfeedRefreshSummary>(
          `/api/subfeeds/${id}/refresh`,
          { method: 'POST', body: { maxPages } },
        )
      } catch (cause) {
        this.error = errorMessage(cause)
        this.errorStatus = errorStatus(cause)
        return undefined
      }
    },
  },
})
