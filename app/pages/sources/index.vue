<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Source } from '#shared/types'

useHead({ title: 'Sources · Knowbook' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const store = useSourcesStore()
const toast = useToast()
const pendingDeleteId = ref<number | null>(null)
const deleteModalOpen = computed({
  get: () => pendingDeleteId.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDeleteId.value = null
  },
})

await useAsyncData('sources', () => store.fetchAll())

const columns: TableColumn<Source>[] = [
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

    <UTable
      v-if="store.sources.length"
      :data="store.sources"
      :columns="columns"
      :loading="store.loading"
    />
    <UCard v-else-if="!store.loading">
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
