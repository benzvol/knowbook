import { defineStore } from 'pinia'
import type { RefreshSummary, Source } from '#shared/types'
import type {
  SourceCreateInput,
  SourceUpdateInput,
} from '#shared/schemas/source'

export const useSourcesStore = defineStore('sources', {
  state: () => ({
    sources: [] as Source[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll(): Promise<Source[]> {
      this.loading = true
      this.error = null
      try {
        this.sources = await $fetch<Source[]>('/api/sources')
      } catch (cause) {
        this.error = errorMessage(cause)
      } finally {
        this.loading = false
      }
      return this.sources
    },

    async fetchOne(id: number): Promise<Source | undefined> {
      this.error = null
      try {
        return await $fetch<Source>(`/api/sources/${id}`)
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async create(input: SourceCreateInput): Promise<Source | undefined> {
      this.error = null
      try {
        const created = await $fetch<Source>('/api/sources', {
          method: 'POST',
          body: input,
        })
        await this.fetchAll()
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async update(
      id: number,
      patch: SourceUpdateInput,
    ): Promise<Source | undefined> {
      this.error = null
      try {
        const updated = await $fetch<Source>(`/api/sources/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const index = this.sources.findIndex((s) => s.id === id)
        if (index !== -1) this.sources[index] = updated
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      try {
        await $fetch(`/api/sources/${id}`, { method: 'DELETE' })
        this.sources = this.sources.filter((s) => s.id !== id)
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        return false
      }
    },

    async refresh(
      id: number,
      maxPages?: number,
    ): Promise<RefreshSummary | undefined> {
      this.error = null
      try {
        return await $fetch<RefreshSummary>(`/api/sources/${id}/refresh`, {
          method: 'POST',
          body: { maxPages },
        })
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },
  },
})

function errorMessage(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'statusMessage' in cause) {
    return String((cause as { statusMessage?: string }).statusMessage)
  }
  return cause instanceof Error ? cause.message : 'Unknown error'
}
