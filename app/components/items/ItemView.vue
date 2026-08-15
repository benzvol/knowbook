<script setup lang="ts">
import type { ItemQueryInput } from '#shared/schemas/itemQuery'
import type { Item, ItemFacets, ItemPage } from '#shared/types'
import type { ItemViewMode } from '~/composables/useItemView'
import type { SearchMeta } from '~/stores/items'

/**
 * The toolbar + pager + list trio every items page shows, in one place. The
 * three pages (source, subfeed, feed) previously repeated this block with
 * ~7 props each, so any change to the shared controls had to be made three
 * times. Pass a `useItemView()` result straight through.
 *
 * The `#list` slot lets a page substitute its own body — the source page uses
 * it for the side-by-side subfeed columns — while still inheriting the
 * toolbar, both pagers and refresh.
 */
const props = defineProps<{
  view?: ItemPage<Item> & { facets: ItemFacets }
  query: ItemQueryInput
  mode: ItemViewMode
  /** Whether the target can walk further pages over the network. */
  paginated: boolean
  sourceTitles?: Map<number, string>
  loading?: boolean
  error?: string | null
  searchMeta?: SearchMeta
  canRefresh?: boolean
  refreshing?: boolean
}>()

const emit = defineEmits<{
  patch: [partial: Partial<ItemQueryInput>]
  'update:mode': [mode: ItemViewMode]
  'update:page': [page: number]
  'search-deep': []
  refresh: []
}>()

// Only worth the vertical space once there is somewhere to page to.
const showTopPager = computed(() => (props.view?.pageCount ?? 0) > 1)
</script>

<template>
  <div class="flex flex-col gap-4">
    <ItemsItemViewToolbar
      v-if="view"
      :facets="view.facets"
      :query="query"
      :mode="mode"
      :default-page-size="view.pageSize"
      :can-refresh="canRefresh"
      :refreshing="refreshing"
      @patch="emit('patch', $event)"
      @update:mode="emit('update:mode', $event)"
      @refresh="emit('refresh')"
    />

    <ItemsItemPager
      v-if="view && showTopPager"
      nav-only
      :total="view.total"
      :page="view.page"
      :page-size="view.pageSize"
      :has-query="!!query.q"
      :paginated="paginated"
      @update:page="emit('update:page', $event)"
    />

    <slot name="list">
      <ItemsItemList
        :items="view?.items ?? []"
        :mode="mode"
        :source-titles="sourceTitles"
        :loading="loading"
        :error="error"
      />
    </slot>

    <ItemsItemPager
      v-if="view"
      :total="view.total"
      :page="view.page"
      :page-size="view.pageSize"
      :has-query="!!query.q"
      :paginated="paginated"
      :searching="loading"
      :search-meta="searchMeta"
      @update:page="emit('update:page', $event)"
      @search-deep="emit('search-deep')"
    />
  </div>
</template>
