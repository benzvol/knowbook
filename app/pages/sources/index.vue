<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SourceWithTags } from '#shared/types'

useHead({ title: 'Sources · Knowbook' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const store = useSourcesStore()
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
  Promise.all([store.fetchAll(), tagsStore.fetchAll()]),
)

const tagFilter = ref<number[]>([])
const groupByTag = ref(false)

const filtered = computed(() =>
  store.sources.filter((source) =>
    tagFilter.value.every((tagId) =>
      source.tags.some((tag) => tag.id === tagId),
    ),
  ),
)

const noSourcesYet = computed(
  () => !store.loading && store.sources.length === 0,
)
const noMatches = computed(
  () =>
    !store.loading && store.sources.length > 0 && filtered.value.length === 0,
)

interface TagGroup {
  key: string
  label: string
  count: number
  sources: SourceWithTags[]
}

const groups = computed<TagGroup[]>(() => {
  // Labels come from each source's own hydrated tags rather than the tag store,
  // so a source can never drop out of the grouped view if the store is stale.
  const byTag = new Map<number, { name: string; sources: SourceWithTags[] }>()
  const untagged: SourceWithTags[] = []

  for (const source of filtered.value) {
    if (source.tags.length === 0) {
      untagged.push(source)
      continue
    }
    // A source with several tags is pushed into each of their buckets on
    // purpose: the grouped view shows it under every tag it carries.
    for (const tag of source.tags) {
      const bucket = byTag.get(tag.id)
      if (bucket) bucket.sources.push(source)
      else byTag.set(tag.id, { name: tag.name, sources: [source] })
    }
  }

  const named = [...byTag.entries()]
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, { name, sources }]) => ({
      key: String(id),
      label: name,
      count: sources.length,
      sources,
    }))

  // Appended rather than sorted in, so it always trails the named tags.
  if (untagged.length) {
    named.push({
      key: 'untagged',
      label: 'Untagged',
      count: untagged.length,
      sources: untagged,
    })
  }

  return named
})

// Fixed layout plus explicit widths, so every group's table lines up with the
// others instead of each sizing itself to its own longest URL.
const tableUi = { base: 'table-fixed w-full' }

const columns: TableColumn<SourceWithTags>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    meta: { class: { th: 'w-1/4', td: 'truncate' } },
  },
  {
    accessorKey: 'url',
    header: 'URL',
    meta: { class: { th: 'w-2/5', td: 'truncate' } },
    // Long feed URLs are truncated rather than allowed to widen the column;
    // the full value stays available as a tooltip.
    cell: ({ row }) =>
      h(
        'span',
        { class: 'block truncate text-muted', title: row.original.url },
        row.original.url,
      ),
  },
  {
    id: 'tags',
    header: 'Tags',
    meta: { class: { th: 'w-1/4' } },
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
    id: 'actions',
    meta: { class: { th: 'w-16' } },
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

    <div v-if="store.sources.length" class="flex flex-wrap items-center gap-6">
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

      <USwitch v-model="groupByTag" label="Group by tag" />
    </div>

    <template v-if="filtered.length">
      <div v-if="groupByTag" class="flex flex-col gap-6">
        <div
          v-for="group in groups"
          :key="group.key"
          class="flex flex-col gap-2"
        >
          <h2 class="font-medium text-highlighted">
            {{ group.label }} ({{ group.count }})
          </h2>
          <UTable :data="group.sources" :columns="columns" :ui="tableUi" />
        </div>
      </div>
      <UTable
        v-else
        :data="filtered"
        :columns="columns"
        :ui="tableUi"
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
