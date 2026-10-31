<script setup lang="ts">
import type { Item } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'
const settings = useState<{ editorialColumnRatio: number[] }>(
  'app-settings',
  () => ({ editorialColumnRatio: [1, 1, 1], autoRefreshThresholdMinutes: 60 }),
)

const props = defineProps<{
  items: Item[]
  mode: ItemViewMode
  /** Source titles keyed by `sourceId`, for the card's label. */
  sourceTitles?: Map<number, string>
  loading?: boolean
  error?: string | null
  /**
   * Render as a single vertical stack whatever the mode. Set by callers that
   * are already a narrow column (the side-by-side subfeed view), where grid's
   * and editorial's own multi-column tracks would subdivide an ~20rem column
   * into unreadable slivers. The cards keep their per-mode styling — only the
   * container stops splitting.
   */
  singleColumn?: boolean
  /**
   * Item ids currently bookmarked, for the toggle's filled/outline state.
   * Absent (rather than an empty `Set`) means "no bookmark toggle at all" —
   * the source/subfeed/feed item pages that don't wire up bookmarking simply
   * omit this prop.
   */
  bookmarkedItemIds?: Set<number>
}>()

const emit = defineEmits<{
  'toggle-bookmark': [itemId: number]
}>()

// Grid mode reserves a fixed-ratio image slot so cards stay uniform even when
// only some items have an image. When *nothing* in the view has one, that
// reasoning doesn't apply and every card would carry a pointless grey box, so
// the slot is dropped for the whole view rather than per card.
const anyImage = computed(() => props.items.some((item) => !!item.imageUrl))
const tracks = computed(() => {
  // The wider center track leads with the newest item, the left track follows
  // with the second newest, and the right track takes the third sequence.
  const sequenceByColumn = [1, 0, 2]
  return [0, 1, 2].map((column) => {
    return props.items.flatMap((item, itemIndex) =>
      itemIndex % 3 === sequenceByColumn[column] ? [{ item, itemIndex }] : [],
    )
  })
})

// Empty and loading states are shared across modes, not re-implemented per
// mode — switching layout never changes what "no items" or "loading" looks
// like.
const containerClass = computed(() => {
  if (props.singleColumn) {
    return props.mode === 'list' ? 'flex flex-col gap-2' : 'flex flex-col gap-4'
  }

  switch (props.mode) {
    case 'grid':
      return 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
    case 'editorial':
      // At desktop, every third item goes into each vertical track. Below
      // desktop the explicit order restores row-like reading order.
      return 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[var(--editorial-columns)]'
    default:
      return 'flex flex-col gap-2'
  }
})
</script>

<template>
  <UAlert v-if="error" color="error" variant="subtle" :title="error" />
  <p v-if="loading" class="text-sm text-muted" role="status">Loading…</p>
  <UCard v-if="items.length === 0 && !loading">
    <p class="text-muted">No items match this view.</p>
  </UCard>
  <div
    v-else-if="props.mode === 'editorial' && !singleColumn"
    :class="containerClass"
    :style="{
      '--editorial-columns': settings.editorialColumnRatio
        .map((weight) => `minmax(0, ${weight}fr)`)
        .join(' '),
    }"
  >
    <div
      v-for="(track, index) in tracks"
      :key="index"
      class="contents lg:flex lg:flex-col lg:gap-4"
    >
      <ItemsItemCard
        v-for="entry in track"
        :key="entry.item.id"
        :item="entry.item"
        :style="{ order: entry.itemIndex }"
        :mode="mode"
        :reserve-media="anyImage"
        :source-title="sourceTitles?.get(entry.item.sourceId)"
        :bookmarkable="!!bookmarkedItemIds"
        :bookmarked="bookmarkedItemIds?.has(entry.item.id)"
        @toggle-bookmark="emit('toggle-bookmark', entry.item.id)"
      />
    </div>
  </div>
  <div v-else :class="containerClass">
    <ItemsItemCard
      v-for="item in items"
      :key="item.id"
      :item="item"
      :mode="mode"
      :reserve-media="anyImage"
      :source-title="sourceTitles?.get(item.sourceId)"
      :bookmarkable="!!bookmarkedItemIds"
      :bookmarked="bookmarkedItemIds?.has(item.id)"
      @toggle-bookmark="emit('toggle-bookmark', item.id)"
    />
  </div>
</template>
