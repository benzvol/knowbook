<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SourceType, SourceWithTags } from '#shared/types'

useHead({ title: 'Sources · Knowbook' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const store = useSourcesStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const toast = useToast()
const pendingDeleteId = ref<number | null>(null)
const deleteModalOpen = computed({
  get: () => pendingDeleteId.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDeleteId.value = null
  },
})

await useAsyncData('sources', () =>
  Promise.all([
    store.fetchAll(),
    categoriesStore.fetchAll(),
    tagsStore.fetchAll(),
  ]),
)

const typeFilter = ref<SourceType | 'all'>('all')
const typeFilterOptions = [
  { label: 'All types', value: 'all' as const },
  { label: 'Standard', value: 'standard' as const },
  { label: 'News', value: 'news' as const },
]
const tagFilter = ref<number[]>([])
const groupByCategory = ref(false)

const filtered = computed(() =>
  store.sources.filter((source) => {
    if (typeFilter.value !== 'all' && source.type !== typeFilter.value) {
      return false
    }
    return tagFilter.value.every((tagId) =>
      source.tags.some((tag) => tag.id === tagId),
    )
  }),
)

const noSourcesYet = computed(
  () => !store.loading && store.sources.length === 0,
)
const noMatches = computed(
  () =>
    !store.loading && store.sources.length > 0 && filtered.value.length === 0,
)

interface CategoryGroup {
  key: string
  label: string
  count: number
  sources: SourceWithTags[]
}

const groups = computed<CategoryGroup[]>(() => {
  const byCategory = new Map<number | null, SourceWithTags[]>()
  for (const source of filtered.value) {
    const key = source.categoryId
    const list = byCategory.get(key)
    if (list) list.push(source)
    else byCategory.set(key, [source])
  }

  const named = categoriesStore.categories
    .filter((c) => byCategory.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      key: String(c.id),
      label: c.name,
      count: byCategory.get(c.id)!.length,
      sources: byCategory.get(c.id)!,
    }))

  const uncategorised = byCategory.get(null)
  if (uncategorised?.length) {
    named.push({
      key: 'uncategorised',
      label: 'Uncategorised',
      count: uncategorised.length,
      sources: uncategorised,
    })
  }

  return named
})

const columns: TableColumn<SourceWithTags>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'url', header: 'URL' },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) =>
      h(
        UBadge,
        { variant: 'subtle', color: 'neutral' },
        () => row.original.type,
      ),
  },
  {
    id: 'tags',
    header: 'Tags',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        row.original.tags.map((tag) =>
          h(
            UBadge,
            { key: tag.id, variant: 'subtle', color: 'neutral' },
            () => tag.name,
          ),
        ),
      ),
  },
  {
    accessorKey: 'managed',
    header: 'Managed',
    cell: ({ row }) =>
      row.original.managed
        ? h(UBadge, { variant: 'subtle', color: 'primary' }, () => 'Managed')
        : null,
  },
  {
    id: 'actions',
    cell: ({ row }) =>
      h(
        UDropdownMenu,
        {
          items: [
            {
              label: 'Edit',
              icon: 'i-ph-pencil',
              to: `/sources/${row.original.id}/edit`,
            },
            {
              label: 'Refresh',
              icon: 'i-ph-arrow-clockwise',
              onSelect: () => onRefresh(row.original.id),
            },
            {
              label: 'Delete',
              icon: 'i-ph-trash',
              color: 'error',
              onSelect: () => {
                pendingDeleteId.value = row.original.id
              },
            },
          ],
        },
        () =>
          h(UButton, {
            icon: 'i-ph-dots-three-vertical',
            color: 'neutral',
            variant: 'ghost',
            'aria-label': 'Actions',
          }),
      ),
  },
]

async function onRefresh(id: number) {
  const summary = await store.refresh(id)

  if (summary) {
    toast.add({
      title: 'Source refreshed',
      description: `${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
      color: 'success',
    })
  } else {
    toast.add({
      title: 'Refresh failed',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}

async function confirmDelete() {
  if (pendingDeleteId.value == null) return
  const ok = await store.remove(pendingDeleteId.value)
  pendingDeleteId.value = null
  toast.add(
    ok
      ? { title: 'Source deleted', color: 'success' }
      : {
          title: 'Delete failed',
          description: store.error ?? undefined,
          color: 'error',
        },
  )
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Sources</h1>
      <UButton label="Add source" icon="i-ph-plus" to="/sources/new" />
    </div>

    <UAlert
      v-if="store.error"
      color="error"
      variant="subtle"
      :title="store.error"
    />

    <div v-if="store.sources.length" class="flex flex-wrap items-end gap-4">
      <UFormField label="Type">
        <USelect
          v-model="typeFilter"
          :items="typeFilterOptions"
          value-key="value"
          class="w-40"
        />
      </UFormField>

      <UFormField
        label="Tags"
        description="Shows sources with all selected tags."
      >
        <USelectMenu
          v-model="tagFilter"
          :items="tagsStore.tags"
          value-key="id"
          label-key="name"
          multiple
          placeholder="Filter by tag"
          class="w-56"
        />
      </UFormField>

      <USwitch v-model="groupByCategory" label="Group by category" />
    </div>

    <template v-if="filtered.length">
      <div v-if="groupByCategory" class="flex flex-col gap-6">
        <div
          v-for="group in groups"
          :key="group.key"
          class="flex flex-col gap-2"
        >
          <h2 class="font-medium text-highlighted">
            {{ group.label }} ({{ group.count }})
          </h2>
          <UTable :data="group.sources" :columns="columns" />
        </div>
      </div>
      <UTable
        v-else
        :data="filtered"
        :columns="columns"
        :loading="store.loading"
      />
    </template>
    <UCard v-else-if="noMatches">
      <p class="text-muted">No sources match these filters.</p>
    </UCard>
    <UCard v-else-if="noSourcesYet">
      <p class="text-muted">No sources yet. Add one to get started.</p>
    </UCard>

    <UModal v-model:open="deleteModalOpen" title="Delete source">
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <p>Are you sure? This removes the source and its cached items.</p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="pendingDeleteId = null"
            />
            <UButton label="Delete" color="error" @click="confirmDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
