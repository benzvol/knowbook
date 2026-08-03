import { defineStore } from 'pinia'
import type {
  RefreshSummary,
  SourceListItem,
  SourceWithTags,
  Tag,
} from '#shared/types'
import type {
  SourceCreateInput,
  SourceUpdateInput,
} from '#shared/schemas/source'

export const useSourcesStore = defineStore('sources', {
  state: () => ({
    sources: [] as SourceListItem[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll(): Promise<SourceListItem[]> {
      this.loading = true
      this.error = null
      try {
        this.sources = await $fetch<SourceListItem[]>('/api/sources')
      } catch (cause) {
        this.error = errorMessage(cause)
      } finally {
        this.loading = false
      }
      return this.sources
    },

    async fetchOne(id: number): Promise<SourceWithTags | undefined> {
      this.error = null
      try {
        return await $fetch<SourceWithTags>(`/api/sources/${id}`)
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async create(
      input: SourceCreateInput,
    ): Promise<SourceWithTags | undefined> {
      this.error = null
      try {
        const created = await $fetch<SourceWithTags>('/api/sources', {
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
    ): Promise<SourceWithTags | undefined> {
      this.error = null
      try {
        const updated = await $fetch<SourceWithTags>(`/api/sources/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const index = this.sources.findIndex((s) => s.id === id)
        // The PATCH response has no `subfeedCount` (only the list route
        // hydrates it), so carry the existing count forward rather than
        // losing the badge on every edit.
        if (index !== -1) {
          this.sources[index] = {
            ...updated,
            subfeedCount: this.sources[index]!.subfeedCount,
          }
        }
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

    async setTags(id: number, tagIds: number[]): Promise<Tag[] | undefined> {
      this.error = null
      try {
        const tags = await $fetch<Tag[]>(`/api/sources/${id}/tags`, {
          method: 'PUT',
          body: { tagIds },
        })
        const index = this.sources.findIndex((s) => s.id === id)
        if (index !== -1) this.sources[index]!.tags = tags
        return tags
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },
  },
})
