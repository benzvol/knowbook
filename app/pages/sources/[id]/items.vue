<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Items · Knowbook' })

const sourcesStore = useSourcesStore()
const subfeedsStore = useSubfeedsStore()
const itemsStore = useItemsStore()
const toast = useToast()

const { data: source } = await useAsyncData(`source-${id}`, () =>
  sourcesStore.fetchOne(id),
)
const { data: subfeeds } = await useAsyncData(`source-${id}-subfeeds`, () =>
  subfeedsStore.fetchForSource(id),
)

const itemView = useItemView(
  { kind: 'source', id },
  { refresh: () => sourcesStore.refresh(id) },
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
  refresh,
  refreshing,
  canRefresh,
  reload,
} = itemView

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

// The count reads as "items visible in this column" unless a filter is
// narrowing things, so only show it when it is actually saying something —
// it is the post-filter total from `applyItemView`, not a cached-row count.
const isFiltered = computed(
  () =>
    !!query.value.q ||
    query.value.tags.length > 0 ||
    query.value.sourceIds.length > 0,
)

function columnHeading(subfeedId: number, name: string): string {
  if (!isFiltered.value) return name
  const total = subfeedView(subfeedId)?.total ?? 0
  return `${name} · ${total} ${total === 1 ? 'match' : 'matches'}`
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

async function onRefresh() {
  const summary = await refresh()
  if (summary && bySubfeed.value) await reloadSubfeedColumns()
  toast.add(
    summary
      ? {
          title: 'Source refreshed',
          description: `${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
          color: 'success',
        }
      : {
          title: 'Refresh failed',
          description: sourcesStore.error ?? undefined,
          color: 'error',
        },
  )
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="source">
      <AppBackLink to="/sources" label="sources" />

      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">{{ source.title }}</h1>
          <p class="text-sm text-muted break-all">{{ source.url }}</p>
        </div>
        <div class="flex gap-2">
          <UButton
            label="Subfeeds"
            icon="i-ph-stack"
            color="neutral"
            variant="subtle"
            :to="`/sources/${source.id}/subfeeds`"
          />
          <UButton
            label="Edit"
            icon="i-ph-pencil"
            color="neutral"
            variant="subtle"
            :to="`/sources/${source.id}/edit`"
          />
        </div>
      </div>

      <div v-if="subfeeds?.length" class="flex justify-end">
        <USwitch v-model="bySubfeed" label="By subfeed" />
      </div>

      <ItemsItemView
        :view="view"
        :query="query"
        :mode="mode"
        :paginated="paginated"
        :source-titles="sourceTitles"
        :loading="loading"
        :error="error"
        :search-meta="searchMeta"
        :can-refresh="canRefresh"
        :refreshing="refreshing"
        @patch="patch"
        @update:mode="setMode"
        @update:page="setPage"
        @search-deep="searchDeep"
        @refresh="onRefresh"
      >
        <template v-if="bySubfeed" #list>
          <!--
            Fixed-width columns rather than `flex-1`, so they stop compressing
            as subfeeds are added and simply scroll — predictable at three and
            still usable at ten.
          -->
          <div class="flex gap-4 overflow-x-auto pb-2">
            <div
              v-for="subfeed in subfeeds"
              :key="subfeed.id"
              class="flex w-80 shrink-0 flex-col gap-2"
            >
              <h2 class="font-medium text-highlighted">
                <NuxtLink
                  :to="`/subfeeds/${subfeed.id}`"
                  class="hover:underline"
                >
                  {{ columnHeading(subfeed.id, subfeed.name) }}
                </NuxtLink>
              </h2>
              <ItemsItemList
                single-column
                :items="subfeedView(subfeed.id)?.items ?? []"
                :mode="mode"
                :loading="loading"
                :error="error"
              />
            </div>
          </div>
        </template>
      </ItemsItemView>
    </template>
    <UAlert v-else color="error" variant="subtle" title="Source not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
