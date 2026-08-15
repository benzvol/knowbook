<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Subfeed · Knowbook' })

const subfeedsStore = useSubfeedsStore()
const sourcesStore = useSourcesStore()
const toast = useToast()

const { data: subfeed } = await useAsyncData(`subfeed-${id}`, () =>
  subfeedsStore.fetchOne(id),
)
const { data: source } = await useAsyncData(`subfeed-${id}-source`, () =>
  subfeed.value ? sourcesStore.fetchOne(subfeed.value.sourceId) : undefined,
)

const itemView = useItemView(
  { kind: 'subfeed', id },
  { refresh: () => subfeedsStore.refresh(id) },
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

async function onRefresh() {
  const summary = await refresh()
  toast.add(
    summary
      ? {
          title: 'Subfeed refreshed',
          description: `${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
          color: 'success',
        }
      : {
          title: 'Refresh failed',
          description: subfeedsStore.error ?? undefined,
          color: 'error',
        },
  )
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="subfeed && source">
      <AppBackLink
        :to="`/sources/${source.id}/subfeeds`"
        :label="`${source.title} subfeeds`"
      />

      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">{{ subfeed.name }}</h1>
            <p class="text-sm text-muted">
              <NuxtLink :to="`/sources/${source.id}/items`" class="underline">
                {{ source.title }}
              </NuxtLink>
              · <span class="break-all">{{ source.url }}</span>
            </p>
          </div>
          <UButton
            label="Parent items"
            icon="i-ph-newspaper"
            color="neutral"
            variant="subtle"
            :to="`/sources/${source.id}/items`"
          />
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
      />
    </template>
    <UAlert v-else color="error" variant="subtle" title="Subfeed not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
