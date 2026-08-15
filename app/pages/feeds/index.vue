<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { FeedCreateInput } from '#shared/schemas/feed'
import type { FeedListItem } from '#shared/types'

useHead({ title: 'Feeds · Knowbook' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const NuxtLink = resolveComponent('NuxtLink')

const store = useFeedsStore()
const toast = useToast()

await useAsyncData('feeds', () => store.fetchAll())

const noFeedsYet = computed(() => !store.loading && store.feeds.length === 0)

// Fixed layout plus explicit widths, matching the sources list.
const tableUi = { base: 'table-fixed w-full' }

const columns: TableColumn<FeedListItem>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    meta: { class: { th: 'w-1/2', td: 'truncate' } },
    // The name is the obvious thing to click on a list, so make it the primary
    // way in rather than leaving the row's only destination behind a menu.
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/feeds/${row.original.id}`,
          class: 'font-medium text-highlighted hover:underline',
        },
        () => row.original.name,
      ),
  },
  {
    id: 'members',
    header: 'Members',
    meta: { class: { th: 'w-1/4' } },
    cell: ({ row }) =>
      h(UBadge, { variant: 'subtle', color: 'neutral' }, () =>
        String(row.original.memberCount),
      ),
  },
  {
    id: 'actions',
    // Same split as the sources list: navigation destinations get a dedicated
    // button, one-off actions stay in the row menu.
    meta: { class: { th: 'w-24' } },
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UButton, {
          icon: 'i-ph-newspaper',
          color: 'neutral',
          variant: 'ghost',
          to: `/feeds/${row.original.id}`,
          title: 'Open',
          'aria-label': `Open ${row.original.name}`,
        }),
        h(
          UDropdownMenu,
          {
            items: [
              {
                label: 'Rename',
                icon: 'i-ph-pencil',
                onSelect: () => openEdit(row.original),
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
              'aria-label': 'More actions',
            }),
        ),
      ]),
  },
]

// `null` means "add"; an id means "rename that feed".
const editingId = ref<number | null>(null)
const formModalOpen = ref(false)
const submitting = ref(false)
const nameError = ref<string>()

const editingFeed = computed(() =>
  editingId.value == null
    ? undefined
    : store.feeds.find((f) => f.id === editingId.value),
)

function openAdd() {
  editingId.value = null
  nameError.value = undefined
  formModalOpen.value = true
}

function openEdit(feed: FeedListItem) {
  editingId.value = feed.id
  nameError.value = undefined
  formModalOpen.value = true
}

async function onSubmit(payload: FeedCreateInput) {
  submitting.value = true
  nameError.value = undefined

  const result =
    editingId.value == null
      ? await store.create(payload)
      : await store.update(editingId.value, payload)

  submitting.value = false

  if (result) {
    formModalOpen.value = false
    toast.add({
      title: editingId.value == null ? 'Feed added' : 'Feed renamed',
      color: 'success',
    })
  } else if (store.errorStatus === 409) {
    nameError.value = store.error ?? undefined
  } else {
    toast.add({
      title: 'Failed to save feed',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}

async function onRefresh(id: number) {
  const summary = await store.refresh(id)

  if (summary) {
    toast.add({
      title: 'Feed refreshed',
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

const pendingDeleteId = ref<number | null>(null)
const deleteModalOpen = computed({
  get: () => pendingDeleteId.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDeleteId.value = null
  },
})

async function confirmDelete() {
  if (pendingDeleteId.value == null) return
  const ok = await store.remove(pendingDeleteId.value)
  pendingDeleteId.value = null
  toast.add(
    ok
      ? { title: 'Feed deleted', color: 'success' }
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
      <h1 class="text-xl font-semibold">Feeds</h1>
      <UButton label="Add feed" icon="i-ph-plus" @click="openAdd" />
    </div>

    <UAlert
      v-if="store.error && store.errorStatus !== 409"
      color="error"
      variant="subtle"
      :title="store.error"
    />

    <UTable
      v-if="store.feeds.length"
      :data="store.feeds"
      :columns="columns"
      :ui="tableUi"
      :loading="store.loading"
    />
    <UCard v-else-if="noFeedsYet">
      <p class="text-muted">
        No feeds yet. Add one to read several sources together.
      </p>
    </UCard>

    <UModal
      v-model:open="formModalOpen"
      :title="editingFeed ? 'Rename feed' : 'Add feed'"
    >
      <template #content>
        <div class="p-4">
          <FeedsFeedForm
            :key="editingId ?? 'new'"
            :feed="editingFeed"
            :name-error="nameError"
            :submitting="submitting"
            @submit="onSubmit"
          >
            <template #cancel>
              <UButton
                label="Cancel"
                color="neutral"
                variant="subtle"
                @click="formModalOpen = false"
              />
            </template>
          </FeedsFeedForm>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteModalOpen" title="Delete feed">
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <p>
            Are you sure? This removes the feed and its memberships. Cached
            items and the sources themselves stay.
          </p>
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
