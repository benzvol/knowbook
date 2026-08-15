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
  /**
   * Pagination controls only, for the instance rendered above the list —
   * "Search further pages" is a terminal action, not a navigation control, so
   * it belongs on the bottom instance alone.
   */
  navOnly?: boolean
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'search-deep': []
}>()

const noMatches = computed(() => props.total === 0)
// Non-paginated targets never show the button — there are no further pages
// to walk (`pages()` only ever yields one page for them).
const showSearchFurther = computed(
  () => !props.navOnly && props.hasQuery && noMatches.value && props.paginated,
)

function onUpdatePage(page: number) {
  emit('update:page', page)
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <!--
      `items-per-page`, not `page-count`: Nuxt UI's UPagination declares
      `itemsPerPage` (default 10) and exposes `pageCount` only as a slot value.
      Passing `page-count` is silently ignored, which paged 25-item responses as
      if they held 10 and offered page numbers the server has no items for.
    -->
    <UPagination
      v-if="total > 0"
      :page="page"
      :items-per-page="pageSize"
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
