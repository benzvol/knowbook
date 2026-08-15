<script setup lang="ts">
import type {
  BookmarkMoveInput,
  BookmarkQueryInput,
} from '#shared/schemas/bookmark'
import type { BookmarkWithItem } from '#shared/types'

const props = defineProps<{
  bookmark: BookmarkWithItem
  sort: BookmarkQueryInput['sort']
  /** Suggested tag names — from the tags table and tags already in use. */
  suggestedTags?: string[]
}>()

const emit = defineEmits<{
  move: [target: BookmarkMoveInput]
  remove: []
  'update-tags': [tags: string[] | null]
}>()

const canReorder = computed(() => props.sort === 'manual')

// Same shape as `SourceForm`'s tag-creation gate, but against plain strings
// rather than tag ids: bookmark tags are free-form JSON, never promoted into
// the tags table (issue 08's "out of scope" list) — the select only
// *suggests* existing names.
const tagSearch = ref('')
const canCreateTag = computed(() => {
  const term = tagSearch.value.trim()
  if (!term) return false
  const existing = [
    ...(props.suggestedTags ?? []),
    ...(props.bookmark.tags ?? []),
  ]
  return !existing.some((tag) => tag.toLowerCase() === term.toLowerCase())
})
const createTagItem = computed(() =>
  canCreateTag.value
    ? ({ when: 'always', position: 'bottom' } as const)
    : false,
)

function onTagsChange(tags: string[]) {
  emit('update-tags', tags.length ? tags : null)
}

function onCreateTag(name: string) {
  onTagsChange([...(props.bookmark.tags ?? []), name])
  tagSearch.value = ''
}

const menuItems = computed(() => [
  [
    {
      label: 'Move to top',
      icon: 'i-ph-arrow-line-up',
      disabled: !canReorder.value,
      onSelect: () => emit('move', { to: 'first' }),
    },
    {
      label: 'Move to bottom',
      icon: 'i-ph-arrow-line-down',
      disabled: !canReorder.value,
      onSelect: () => emit('move', { to: 'last' }),
    },
  ],
  [
    {
      label: 'Delete',
      icon: 'i-ph-trash',
      color: 'error' as const,
      onSelect: () => emit('remove'),
    },
  ],
])
</script>

<template>
  <ItemsItemCard
    :item="bookmark.item"
    mode="list"
    bookmarkable
    bookmarked
    @toggle-bookmark="emit('remove')"
  >
    <template #footer>
      <div class="mt-2 flex items-center gap-2">
        <UIcon
          v-if="canReorder"
          name="i-ph-dots-six-vertical"
          class="bookmark-handle h-5 w-5 flex-shrink-0 cursor-grab text-muted"
          aria-label="Drag to reorder"
        />

        <USelectMenu
          v-model:search-term="tagSearch"
          :model-value="bookmark.tags ?? []"
          :items="suggestedTags ?? []"
          multiple
          :create-item="createTagItem"
          placeholder="Add tags"
          size="sm"
          class="flex-1"
          @update:model-value="onTagsChange"
          @create="onCreateTag"
        />

        <UDropdownMenu :items="menuItems">
          <UButton
            icon="i-ph-dots-three-vertical"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="More actions"
          />
        </UDropdownMenu>
      </div>
    </template>
  </ItemsItemCard>
</template>
