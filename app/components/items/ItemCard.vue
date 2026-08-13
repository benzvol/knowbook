<script setup lang="ts">
import type { Item } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'

const props = defineProps<{
  item: Item
  mode: ItemViewMode
  /** The item's source title, resolved by the caller from the view's facets. */
  sourceTitle?: string
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
        v-else-if="mode === 'grid'"
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
      </div>
    </div>
  </UCard>
</template>
