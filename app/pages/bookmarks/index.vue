<script setup lang="ts">
import type {
  BookmarkMoveInput,
  BookmarkQueryInput,
} from '#shared/schemas/bookmark'

useHead({ title: 'Bookmarks · Knowbook' })

const bookmarksStore = useBookmarksStore()
const tagsStore = useTagsStore()
const toast = useToast()

const { query, view, loading, error, patch, setPage, reload } =
  useBookmarkView()

await useAsyncData('bookmarks', () =>
  Promise.all([reload(), tagsStore.fetchAll()]),
)

const BOOKMARK_SORT_OPTIONS: {
  label: string
  value: BookmarkQueryInput['sort']
}[] = [
  { label: 'Manual', value: 'manual' },
  { label: 'Recently saved', value: 'bookmarked' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Title', value: 'title' },
]

const facets = computed(() => view.value?.facets ?? { tags: [], sources: [] })

// The tags table plus every tag already in use (bookmark or item side) —
// same union `applyBookmarkView`'s facets are built from, so nothing is
// suggested that couldn't also be filtered on.
const suggestedTags = computed(() => {
  const names = new Set(tagsStore.tags.map((t) => t.name))
  for (const row of view.value?.items ?? []) {
    for (const tag of row.tags ?? []) names.add(tag)
    for (const tag of row.item.tags ?? []) names.add(tag)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
})

const isFiltered = computed(
  () =>
    !!query.value.q ||
    query.value.tags.length > 0 ||
    query.value.sourceIds.length > 0,
)

async function onMove(id: number, target: BookmarkMoveInput) {
  const result = await bookmarksStore.move(id, target)
  if (!result) {
    toast.add({
      title: 'Move failed',
      description: bookmarksStore.error ?? undefined,
      color: 'error',
    })
    // The optimistic drag already reordered the on-screen list — reload to
    // restore the actual persisted order.
    await reload()
  }
}

async function onRemove(id: number) {
  const ok = await bookmarksStore.remove(id)
  if (!ok) {
    toast.add({
      title: 'Delete failed',
      description: bookmarksStore.error ?? undefined,
      color: 'error',
    })
  }
}

async function onUpdateTags(id: number, tags: string[] | null) {
  const updated = await bookmarksStore.updateTags(id, tags)
  if (!updated) {
    toast.add({
      title: 'Failed to update tags',
      description: bookmarksStore.error ?? undefined,
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold">Bookmarks</h1>

    <ItemsItemViewToolbar
      :facets="facets"
      :query="query"
      :default-page-size="view?.defaultPageSize"
      :sort-options="BOOKMARK_SORT_OPTIONS"
      :show-modes="false"
      :show-refresh="false"
      @patch="patch"
    />

    <ItemsItemPager
      v-if="view && view.pageCount > 1"
      nav-only
      :total="view.total"
      :page="view.page"
      :page-size="view.pageSize"
      :has-query="false"
      :paginated="false"
      @update:page="setPage"
    />

    <BookmarksBookmarkList
      :items="view?.items ?? []"
      :sort="query.sort"
      :page="query.page"
      :loading="loading"
      :error="error"
      :is-filtered="isFiltered"
      :suggested-tags="suggestedTags"
      @move="onMove"
      @remove="onRemove"
      @update-tags="onUpdateTags"
    />

    <ItemsItemPager
      v-if="view"
      :total="view.total"
      :page="view.page"
      :page-size="view.pageSize"
      :has-query="false"
      :paginated="false"
      @update:page="setPage"
    />
  </div>
</template>
