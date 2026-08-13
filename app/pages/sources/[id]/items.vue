<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Items · Knowbook' })

const sourcesStore = useSourcesStore()
const subfeedsStore = useSubfeedsStore()
const itemsStore = useItemsStore()

const { data: source } = await useAsyncData(`source-${id}`, () =>
  sourcesStore.fetchOne(id),
)
const { data: subfeeds } = await useAsyncData(`source-${id}-subfeeds`, () =>
  subfeedsStore.fetchForSource(id),
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
// this source inherits the same value (issue 05's target merge).
const paginated = computed(() => !!source.value?.pagination?.pageParam)

const sourceTitles = computed(
  () => new Map(view.value?.facets.sources.map((s) => [s.id, s.title]) ?? []),
)

// "By subfeed": one ItemList per sibling subfeed, side by side. One shared
// query and mode drive every column — this is a layout over the existing
// per-target store views (`subfeed:N`), not a fourth code path or a
// per-column query/mode/pager (out of scope: see issue 07 task 12).
const bySubfeed = ref(false)

function subfeedView(subfeedId: number) {
  return itemsStore.views[`subfeed:${subfeedId}`]
}

async function reloadSubfeedColumns() {
  await Promise.all(
    (subfeeds.value ?? []).map((subfeed) =>
      itemsStore.fetchItems({ kind: 'subfeed', id: subfeed.id }, query.value),
    ),
  )
}

watch(bySubfeed, (enabled) => {
  if (enabled) reloadSubfeedColumns()
})

// Re-runs every visible column's fetch whenever the shared query changes —
// mirroring what `patch`/`setPage` already do for the plain source view.
watch(query, () => {
  if (bySubfeed.value) reloadSubfeedColumns()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="source">
      <div>
        <h1 class="text-xl font-semibold">{{ source.title }}</h1>
        <p class="text-sm text-muted break-all">{{ source.url }}</p>
      </div>

      <div class="flex items-center justify-between gap-4">
        <ItemsItemViewToolbar
          v-if="view"
          class="flex-1"
          :facets="view.facets"
          :query="query"
          :mode="mode"
          @patch="patch"
          @update:mode="setMode"
        />
        <USwitch
          v-if="subfeeds?.length"
          v-model="bySubfeed"
          label="By subfeed"
        />
      </div>

      <ItemsItemList
        v-if="!bySubfeed"
        :items="view?.items ?? []"
        :mode="mode"
        :source-titles="sourceTitles"
        :loading="loading"
        :error="error"
      />
      <div v-else class="flex gap-4 overflow-x-auto pb-2">
        <div
          v-for="subfeed in subfeeds"
          :key="subfeed.id"
          class="flex min-w-80 flex-1 flex-col gap-2"
        >
          <h2 class="font-medium text-highlighted">
            {{ subfeed.name }} ({{ subfeedView(subfeed.id)?.total ?? 0 }})
          </h2>
          <ItemsItemList
            :items="subfeedView(subfeed.id)?.items ?? []"
            :mode="mode"
            :loading="loading"
            :error="error"
          />
        </div>
      </div>

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
