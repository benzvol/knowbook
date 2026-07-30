import { defineStore } from 'pinia'
import type { Category } from '#shared/types'

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [] as Category[],
    loading: false,
  }),
  actions: {
    async fetchAll(): Promise<Category[]> {
      this.loading = true
      try {
        this.categories = await $fetch<Category[]>('/api/categories')
      } finally {
        this.loading = false
      }
      return this.categories
    },
  },
})
