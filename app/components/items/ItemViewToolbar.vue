<script setup lang="ts">
import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { ItemFacets } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'

const props = defineProps<{
  facets: ItemFacets
  query: ItemQueryInput
  mode: ItemViewMode
  /**
   * The page size actually in effect when the query names none — the server's
   * `pageSizeSetting()` value, echoed back on the response. Shown in the
   * placeholder so "Default" states what it means.
   */
  defaultPageSize?: number
  canRefresh?: boolean
  refreshing?: boolean
}>()

// Emits query patches; holds no fetch logic itself — `useItemView` decides
// what a patch means (e.g. resetting the page).
const emit = defineEmits<{
  patch: [partial: Partial<ItemQueryInput>]
  'update:mode': [mode: ItemViewMode]
  refresh: []
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

// `0` is a sentinel for "no explicit size", mapped back to `undefined` before
// emitting — `itemQuerySchema.pageSize` is `min(1)` and would reject a literal
// 0. Without this option a chosen size could never be cleared.
const DEFAULT_PAGE_SIZE_VALUE = 0

const pageSizeOptions = computed(() => [
  {
    label: props.defaultPageSize
      ? `Default (${props.defaultPageSize})`
      : 'Default',
    value: DEFAULT_PAGE_SIZE_VALUE,
  },
  ...[10, 25, 50, 100].map((n) => ({ label: String(n), value: n })),
])

// Three options never warranted a dropdown. Icons carry the meaning, with a
// tooltip and aria-label for the name. (`i-ph-columns` is only an icon name —
// issue 07's naming rule is about not calling the *layout* "columns".)
const MODE_BUTTONS: { mode: ItemViewMode; icon: string; label: string }[] = [
  { mode: 'list', icon: 'i-ph-list', label: 'List' },
  { mode: 'grid', icon: 'i-ph-grid-four', label: 'Grid' },
  { mode: 'editorial', icon: 'i-ph-columns', label: 'Editorial' },
]

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
  emit('patch', {
    pageSize: value === DEFAULT_PAGE_SIZE_VALUE ? undefined : value,
  })
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

    <UFormField label="Tags">
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
        :model-value="query.pageSize ?? 0"
        :items="pageSizeOptions"
        class="w-36"
        @update:model-value="onPageSizeChange"
      />
    </UFormField>

    <UFormField label="Layout">
      <!--
        Native `title` rather than UTooltip: it needs no app-level provider
        (so the component mounts standalone in tests) and gives the same hover
        hint, with `aria-label` carrying the name for assistive tech.
      -->
      <UFieldGroup>
        <UButton
          v-for="option in MODE_BUTTONS"
          :key="option.mode"
          :icon="option.icon"
          :title="option.label"
          :aria-label="option.label"
          :variant="mode === option.mode ? 'solid' : 'outline'"
          color="neutral"
          @click="emit('update:mode', option.mode)"
        />
      </UFieldGroup>
    </UFormField>

    <UButton
      v-if="canRefresh"
      class="ml-auto"
      label="Refresh"
      icon="i-ph-arrow-clockwise"
      color="neutral"
      variant="subtle"
      :loading="refreshing"
      @click="emit('refresh')"
    />
  </div>
</template>
