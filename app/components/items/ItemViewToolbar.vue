<script setup lang="ts">
import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { ItemFacets } from '#shared/types'
import { ITEM_VIEW_MODES, type ItemViewMode } from '~/composables/useItemView'

const props = defineProps<{
  facets: ItemFacets
  query: ItemQueryInput
  mode: ItemViewMode
}>()

// Emits query patches; holds no fetch logic itself — `useItemView` decides
// what a patch means (e.g. resetting the page).
const emit = defineEmits<{
  patch: [partial: Partial<ItemQueryInput>]
  'update:mode': [mode: ItemViewMode]
}>()

const SEARCH_DEBOUNCE_MS = 300

const searchTerm = ref(props.query.q ?? '')
let debounceHandle: ReturnType<typeof setTimeout> | undefined

watch(searchTerm, (value) => {
  if (debounceHandle) clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => {
    const trimmed = value.trim()
    emit('patch', { q: trimmed.length ? trimmed : undefined })
  }, SEARCH_DEBOUNCE_MS)
})

// Keeps the input in sync when the query changes from outside this
// component (e.g. browser back/forward navigating the URL).
watch(
  () => props.query.q,
  (value) => {
    if ((value ?? '') !== searchTerm.value) searchTerm.value = value ?? ''
  },
)

// Only shown when the view spans more than one source — a source or subfeed
// view's facets never carry more than one, so the select would be pointless.
const showSourceFilter = computed(() => props.facets.sources.length > 1)

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Title', value: 'title' },
  { label: 'Last fetched', value: 'fetched' },
]

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const MODE_OPTIONS = ITEM_VIEW_MODES.map((value) => ({
  label: value[0]!.toUpperCase() + value.slice(1),
  value,
}))

function onTagsChange(tags: string[]) {
  emit('patch', { tags })
}

function onSourceIdsChange(sourceIds: number[]) {
  emit('patch', { sourceIds })
}

function onSortChange(value: string) {
  emit('patch', { sort: value as ItemQueryInput['sort'] })
}

function onPageSizeChange(value: number) {
  emit('patch', { pageSize: value })
}

function onModeChange(value: string) {
  emit('update:mode', value as ItemViewMode)
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-4">
    <UFormField label="Search">
      <UInput
        v-model="searchTerm"
        icon="i-ph-magnifying-glass"
        placeholder="Search title and description"
        class="w-64"
      />
    </UFormField>

    <UFormField label="Tags" description="Shows items with all selected tags.">
      <USelectMenu
        :model-value="query.tags"
        :items="facets.tags"
        multiple
        placeholder="Filter by tag"
        class="w-48"
        @update:model-value="onTagsChange"
      />
    </UFormField>

    <UFormField v-if="showSourceFilter" label="Sources">
      <USelectMenu
        :model-value="query.sourceIds"
        :items="facets.sources"
        value-key="id"
        label-key="title"
        multiple
        placeholder="Filter by source"
        class="w-48"
        @update:model-value="onSourceIdsChange"
      />
    </UFormField>

    <UFormField label="Sort">
      <USelect
        :model-value="query.sort"
        :items="SORT_OPTIONS"
        class="w-36"
        @update:model-value="onSortChange"
      />
    </UFormField>

    <UFormField label="Page size">
      <USelect
        :model-value="query.pageSize"
        :items="PAGE_SIZE_OPTIONS"
        placeholder="Default"
        class="w-24"
        @update:model-value="onPageSizeChange"
      />
    </UFormField>

    <UFormField label="Layout">
      <USelect
        :model-value="mode"
        :items="MODE_OPTIONS"
        class="w-32"
        @update:model-value="onModeChange"
      />
    </UFormField>
  </div>
</template>
