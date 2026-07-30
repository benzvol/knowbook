import { defineStore } from 'pinia'
import type { Category } from '#shared/types'
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
} from '#shared/schemas/category'

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [] as Category[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchAll(): Promise<Category[]> {
      this.loading = true
      this.error = null
      try {
        this.categories = await $fetch<Category[]>('/api/categories')
      } catch (cause) {
        this.error = errorMessage(cause)
      } finally {
        this.loading = false
      }
      return this.categories
    },

    async create(input: CategoryCreateInput): Promise<Category | undefined> {
      this.error = null
      try {
        const created = await $fetch<Category>('/api/categories', {
          method: 'POST',
          body: input,
        })
        this.categories.push(created)
        return created
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async update(
      id: number,
      patch: CategoryUpdateInput,
    ): Promise<Category | undefined> {
      this.error = null
      try {
        const updated = await $fetch<Category>(`/api/categories/${id}`, {
          method: 'PATCH',
          body: patch,
        })
        const index = this.categories.findIndex((c) => c.id === id)
        if (index !== -1) this.categories[index] = updated
        return updated
      } catch (cause) {
        this.error = errorMessage(cause)
        return undefined
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      try {
        await $fetch(`/api/categories/${id}`, { method: 'DELETE' })
        this.categories = this.categories.filter((c) => c.id !== id)
        return true
      } catch (cause) {
        this.error = errorMessage(cause)
        return false
      }
    },
  },
})
