import { defineStore } from 'pinia'
import type { Tag } from '#shared/types'
import type { TagCreateInput, TagUpdateInput } from '#shared/schemas/tag'

export const useTagsStore = defineStore('tags', {
  state: () => ({
    tags: [] as Tag[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll(): Promise<Tag[]> {
      this.loading = true
      this.error = null
      try {
        this.tags = await $fetch<Tag[]>('/api/tags')
      } catch (cause) {
        this.error = errorMessage(cause)
      } finally {
        this.loading = false
      }
      return this.tags
    },

    async create(input: TagCreateInput): Promise<Tag | undefined> {
      this.error = null
      try {
        const created = await $fetch<Tag>('/api/tags', {
          method: 'POST',
          body: input,
        })
        this.tags.push(created)
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async update(id: number, patch: TagUpdateInput): Promise<Tag | undefined> {
      this.error = null
      try {
        const updated = await $fetch<Tag>(`/api/tags/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const index = this.tags.findIndex((t) => t.id === id)
        if (index !== -1) this.tags[index] = updated
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      try {
        await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
        this.tags = this.tags.filter((t) => t.id !== id)
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        return false
      }
    },
  },
})
