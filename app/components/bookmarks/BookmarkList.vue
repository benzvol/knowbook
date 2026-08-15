<script setup lang="ts">
import type {
  BookmarkMoveInput,
  BookmarkQueryInput,
} from '#shared/schemas/bookmark'
import type { BookmarkWithItem } from '#shared/types'

const props = defineProps<{
  items: BookmarkWithItem[]
  sort: BookmarkQueryInput['sort']
  page: number
  loading?: boolean
  error?: string | null
  /**
   * Whether a search/tag/source filter is currently narrowing the set — the
   * empty state reads differently for "nothing saved yet" vs "this filter
   * matched nothing".
   */
  isFiltered?: boolean
  suggestedTags?: string[]
}>()

const emit = defineEmits<{
  move: [id: number, target: BookmarkMoveInput]
  remove: [id: number]
  'update-tags': [id: number, tags: string[] | null]
}>()

const isFirstPage = computed(() => props.page === 1)
</script>

<template>
  <UAlert v-if="error" color="error" variant="subtle" :title="error" />
  <UCard v-else-if="loading">
    <p class="text-muted">Loading…</p>
  </UCard>
  <UCard v-else-if="items.length === 0">
    <p class="text-muted">
      {{
        isFiltered
          ? 'No bookmarks match this view.'
          : 'No bookmarks yet — bookmark an item from any source, subfeed or feed view.'
      }}
    </p>
  </UCard>
  <div v-else class="flex flex-col gap-2">
    <p v-if="sort !== 'manual'" class="text-sm text-muted">
      Switch sort to Manual to drag and reorder bookmarks.
    </p>

    <!--
      Sortable.js is client-only — the interactive half lives in
      `BookmarkSortableList.vue` so its import never reaches the SSR bundle.
      The fallback below is the same cards, statically, so there's no flash
      of empty content while the client-only slot mounts.
    -->
    <ClientOnly>
      <BookmarksBookmarkSortableList
        :items="items"
        :sort="sort"
        :is-first-page="isFirstPage"
        :suggested-tags="suggestedTags"
        @move="(id, target) => emit('move', id, target)"
        @remove="(id) => emit('remove', id)"
        @update-tags="(id, tags) => emit('update-tags', id, tags)"
      />
      <template #fallback>
        <div class="flex flex-col gap-2">
          <BookmarksBookmarkCard
            v-for="row in items"
            :key="row.id"
            :bookmark="row"
            :sort="sort"
            :suggested-tags="suggestedTags"
            @move="(target) => emit('move', row.id, target)"
            @remove="emit('remove', row.id)"
            @update-tags="(tags) => emit('update-tags', row.id, tags)"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
