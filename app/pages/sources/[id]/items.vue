<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Items · Knowbook' })

const sourcesStore = useSourcesStore()
const { data: source } = await useAsyncData(`source-${id}`, () =>
  sourcesStore.fetchOne(id),
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
} = useItemView({ kind: 'source', id })

await useAsyncData(`source-items-${id}`, () => reload())

// Inherited straight from the source's own pagination config — a subfeed of
// this source would inherit the same value (issue 05's target merge), so
// this is also correct for a "By subfeed" column added later.
const paginated = computed(() => !!source.value?.pagination?.pageParam)

const sourceTitles = computed(
  () => new Map(view.value?.facets.sources.map((s) => [s.id, s.title]) ?? []),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="source">
      <div>
        <h1 class="text-xl font-semibold">{{ source.title }}</h1>
        <p class="text-sm text-muted break-all">{{ source.url }}</p>
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
    <UAlert v-else color="error" variant="subtle" title="Source not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
