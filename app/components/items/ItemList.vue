<script setup lang="ts">
import type { Item } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'

const props = defineProps<{
  items: Item[]
  mode: ItemViewMode
  /** Source titles keyed by `sourceId`, for the card's label. */
  sourceTitles?: Map<number, string>
  loading?: boolean
  error?: string | null
}>()

// Empty and loading states are shared across modes, not re-implemented per
// mode — switching layout never changes what "no items" or "loading" looks
// like.
const containerClass = computed(() => {
  switch (props.mode) {
    case 'grid':
      return 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
    case 'editorial':
      // CSS `columns`, not a JS masonry library: images keep their natural
      // aspect ratio and text lengths differ, so cards settle into uneven
      // column heights on their own.
      return 'columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4'
    default:
      return 'flex flex-col gap-2'
  }
})
</script>

<template>
  <UAlert v-if="error" color="error" variant="subtle" :title="error" />
  <UCard v-else-if="loading">
    <p class="text-muted">Loading…</p>
  </UCard>
  <UCard v-else-if="items.length === 0">
    <p class="text-muted">No items match this view.</p>
  </UCard>
  <div v-else :class="containerClass">
    <ItemsItemCard
      v-for="item in items"
      :key="item.id"
      :item="item"
      :mode="mode"
      :source-title="sourceTitles?.get(item.sourceId)"
    />
  </div>
</template>
