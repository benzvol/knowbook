<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Subfeed · Knowbook' })

const subfeedsStore = useSubfeedsStore()
const sourcesStore = useSourcesStore()

const { data: subfeed } = await useAsyncData(`subfeed-${id}`, () =>
  subfeedsStore.fetchOne(id),
)
const { data: source } = await useAsyncData(`subfeed-${id}-source`, () =>
  subfeed.value ? sourcesStore.fetchOne(subfeed.value.sourceId) : undefined,
)

const {
  query,
  mode,
  view,
  searchMeta,
  loading,
  error,
  patch,
  setPage,
  setMode,
  searchDeep,
  reload,
} = useItemView({ kind: 'subfeed', id })

await useAsyncData(`subfeed-items-${id}`, () => reload())

// Pagination is always inherited from the parent source (issue 05), never
// overridable, so this reflects both the subfeed's and the source's own
// paginated-ness.
const paginated = computed(() => !!source.value?.pagination?.pageParam)

const sourceTitles = computed(
  () => new Map(view.value?.facets.sources.map((s) => [s.id, s.title]) ?? []),
)

// Same "effective query params" presentation as the subfeeds list page
// (app/pages/sources/[id]/subfeeds.vue).
const effectiveEntries = computed(() =>
  Object.entries({
    ...source.value?.queryParams,
    ...subfeed.value?.queryParams,
  }),
)

function isOverride(key: string): boolean {
  return !!subfeed.value?.queryParams && key in subfeed.value.queryParams
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="subfeed && source">
      <div class="flex flex-col gap-2">
        <div>
          <h1 class="text-xl font-semibold">{{ subfeed.name }}</h1>
          <p class="text-sm text-muted">
            <NuxtLink :to="`/sources/${source.id}/subfeeds`" class="underline">
              {{ source.title }}
            </NuxtLink>
            · <span class="break-all">{{ source.url }}</span>
          </p>
        </div>
        <ul v-if="effectiveEntries.length" class="flex flex-col gap-1 text-sm">
          <li
            v-for="[key, value] in effectiveEntries"
            :key="key"
            class="flex items-center gap-2"
          >
            <span class="font-mono">{{ key }}</span>
            <UBadge v-if="isOverride(key)" size="sm" variant="subtle">
              overrides parent
            </UBadge>
            <span class="text-muted">{{ value }}</span>
          </li>
        </ul>
      </div>

      <ItemsItemViewToolbar
        v-if="view"
        :facets="view.facets"
        :query="query"
        :mode="mode"
        @patch="patch"
        @update:mode="setMode"
      />

      <ItemsItemList
        :items="view?.items ?? []"
        :mode="mode"
        :source-titles="sourceTitles"
        :loading="loading"
        :error="error"
      />

      <ItemsItemPager
        v-if="view"
        :total="view.total"
        :page="view.page"
        :page-size="view.pageSize"
        :has-query="!!query.q"
        :paginated="paginated"
        :search-meta="searchMeta"
        @update:page="setPage"
        @search-deep="searchDeep"
      />
    </template>
    <UAlert v-else color="error" variant="subtle" title="Subfeed not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
