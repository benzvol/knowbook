<script setup lang="ts">
import type { Item } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'

const props = defineProps<{
  item: Item
  mode: ItemViewMode
  /**
   * Whether `grid` mode should reserve its fixed-ratio image slot. The list
   * decides this for the whole view (see `ItemList.vue`): reserving it keeps
   * cards uniform when only some items have images, but a view where none do
   * would otherwise show a placeholder on every card.
   */
  reserveMedia?: boolean
  /** The item's source title, resolved by the caller from the view's facets. */
  sourceTitle?: string
  /** Whether to render the bookmark toggle at all — off by default so the
   * card stays presentational until a caller opts in (issue 08). */
  bookmarkable?: boolean
  bookmarked?: boolean
}>()

const emit = defineEmits<{
  'toggle-bookmark': []
}>()

// A broken/hotlinked image that 404s or times out disappears rather than
// showing the browser's default broken-image frame. Origin images are never
// proxied (CLAUDE.md's "browser only talks to our own API" rule doesn't
// apply to plain <img> fetches, which don't hit CORS).
const imageFailed = ref(false)
const showImage = computed(() => !!props.item.imageUrl && !imageFailed.value)

const publishedLabel = computed(() =>
  props.item.publishedAt
    ? new Date(props.item.publishedAt).toLocaleString()
    : undefined,
)
</script>

<template>
  <UCard :class="mode === 'editorial' ? 'break-inside-avoid' : undefined">
    <div
      :class="
        mode === 'list' ? 'flex items-start gap-3' : 'flex flex-col gap-3'
      "
    >
      <img
        v-if="showImage && mode === 'list'"
        :src="item.imageUrl!"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="h-16 w-16 flex-shrink-0 rounded object-cover"
        @error="imageFailed = true"
      />
      <div
        v-else-if="mode === 'grid' && reserveMedia"
        class="aspect-video w-full overflow-hidden rounded bg-elevated"
      >
        <img
          v-if="showImage"
          :src="item.imageUrl!"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover"
          @error="imageFailed = true"
        />
      </div>
      <img
        v-else-if="showImage && mode === 'editorial'"
        :src="item.imageUrl!"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="w-full rounded object-cover"
        @error="imageFailed = true"
      />

      <div class="flex flex-1 flex-col gap-1">
        <div class="flex items-start justify-between gap-2">
          <a
            v-if="item.link"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-highlighted underline"
          >
            {{ item.title }}
          </a>
          <span v-else class="font-medium text-highlighted">
            {{ item.title }}
          </span>

          <!--
            One card chrome, not two nested UCards — bookmarkable views
            (issue 08) render the toggle here; other item views simply omit
            `bookmarkable` and get nothing.
          -->
          <UButton
            v-if="bookmarkable"
            :icon="
              bookmarked ? 'i-ph-bookmark-simple-fill' : 'i-ph-bookmark-simple'
            "
            :color="bookmarked ? 'primary' : 'neutral'"
            variant="ghost"
            size="sm"
            :aria-label="bookmarked ? 'Remove bookmark' : 'Bookmark'"
            :title="bookmarked ? 'Remove bookmark' : 'Bookmark'"
            @click="emit('toggle-bookmark')"
          />
        </div>

        <p v-if="sourceTitle || publishedLabel" class="text-sm text-muted">
          <template v-if="sourceTitle">{{ sourceTitle }}</template>
          <template v-if="sourceTitle && publishedLabel"> · </template>
          <template v-if="publishedLabel">{{ publishedLabel }}</template>
        </p>

        <div v-if="item.tags?.length" class="flex flex-wrap gap-1">
          <UBadge
            v-for="tag in item.tags"
            :key="tag"
            size="sm"
            variant="subtle"
            color="neutral"
          >
            {{ tag }}
          </UBadge>
        </div>

        <slot name="footer" />
      </div>
    </div>
  </UCard>
</template>
