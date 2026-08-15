<script setup lang="ts">
import { moveArrayElement, useSortable } from '@vueuse/integrations/useSortable'
import type {
  BookmarkMoveInput,
  BookmarkQueryInput,
} from '#shared/schemas/bookmark'
import type { BookmarkWithItem } from '#shared/types'

/**
 * The Sortable.js-touching half of the bookmark list, split into its own
 * component so `sortablejs` (a client-only dependency) is only ever imported
 * inside `<ClientOnly>`'s default slot — `BookmarkList.vue` owns that
 * boundary and renders a plain, non-interactive list as the SSR/hydration
 * fallback.
 */
const props = defineProps<{
  items: BookmarkWithItem[]
  sort: BookmarkQueryInput['sort']
  /** Whether the visible page is the first — see `dropTarget` for why. */
  isFirstPage: boolean
  suggestedTags?: string[]
}>()

const emit = defineEmits<{
  move: [id: number, target: BookmarkMoveInput]
  remove: [id: number]
  'update-tags': [id: number, tags: string[] | null]
}>()

// Sortable.js mutates this array directly (via `moveArrayElement`) as the
// optimistic reorder; the `move` emit is the persistence half.
const rows = shallowRef<BookmarkWithItem[]>([...props.items])
watch(
  () => props.items,
  (next) => {
    rows.value = [...next]
  },
)

const listEl = useTemplateRef('listEl')

const { option } = useSortable(listEl, rows, {
  handle: '.bookmark-handle',
  animation: 150,
  disabled: props.sort !== 'manual',
  onUpdate(e) {
    const ids = rows.value.map((row) => row.id)
    const target = dropTarget(ids, e.oldIndex!, e.newIndex!, props.isFirstPage)
    moveArrayElement(rows, e.oldIndex!, e.newIndex!, e)
    const id = ids[e.oldIndex!]
    if (target && id !== undefined) emit('move', id, target)
  },
})

// Dragging is only meaningful in manual sort (`BookmarkCard`'s handle is
// hidden the same way) — kept in sync after the initial mount-time value set
// above.
watch(
  () => props.sort,
  (sort) => option('disabled', sort !== 'manual'),
)
</script>

<template>
  <div ref="listEl" class="flex flex-col gap-2">
    <BookmarksBookmarkCard
      v-for="row in rows"
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
