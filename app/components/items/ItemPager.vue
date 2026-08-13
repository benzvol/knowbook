<script setup lang="ts">
import type { SearchMeta } from '~/stores/items'

const props = defineProps<{
  total: number
  page: number
  pageSize: number
  /** Whether the current query has a search term (`q`) set. */
  hasQuery: boolean
  /** Whether the target has further pages to walk over the network at all. */
  paginated: boolean
  searching?: boolean
  searchMeta?: SearchMeta
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'search-deep': []
}>()

const noMatches = computed(() => props.total === 0)
// Non-paginated targets never show the button — there are no further pages
// to walk (`pages()` only ever yields one page for them).
const showSearchFurther = computed(
  () => props.hasQuery && noMatches.value && props.paginated,
)

function onUpdatePage(page: number) {
  emit('update:page', page)
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <UPagination
      v-if="total > 0"
      :page="page"
      :page-count="pageSize"
      :total="total"
      @update:page="onUpdatePage"
    />

    <div v-if="showSearchFurther" class="flex flex-col items-center gap-1">
      <UButton
        label="Search further pages"
        icon="i-ph-magnifying-glass-plus"
        variant="subtle"
        :loading="searching"
        @click="emit('search-deep')"
      />
      <p v-if="searchMeta" class="text-sm text-muted">
        Searched {{ searchMeta.pagesSearched }}
        {{ searchMeta.pagesSearched === 1 ? 'page' : 'pages' }}.
        <template v-if="searchMeta.capHit">
          Stopped at the page cap — raise it in settings to search further.
        </template>
        <template v-else-if="!searchMeta.matched"> No match found. </template>
      </p>
    </div>
  </div>
</template>
