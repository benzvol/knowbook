<script setup lang="ts">
import type { SubfeedCreateInput } from '#shared/schemas/subfeed'

const route = useRoute()
const sourceId = Number(route.params.id)

useHead({ title: 'Subfeeds · Knowbook' })

const sourcesStore = useSourcesStore()
const subfeedsStore = useSubfeedsStore()
const toast = useToast()

const { data: source } = await useAsyncData(`source-${sourceId}`, () =>
  sourcesStore.fetchOne(sourceId),
)
await useAsyncData(`subfeeds-${sourceId}`, () =>
  subfeedsStore.fetchForSource(sourceId),
)

const subfeeds = computed(() => subfeedsStore.bySource[sourceId] ?? [])
const noSubfeedsYet = computed(
  () => !subfeedsStore.loading && subfeeds.value.length === 0,
)

// `null` means "add"; an id means "edit that subfeed".
const editingId = ref<number | null>(null)
const formModalOpen = ref(false)
const submitting = ref(false)
const nameError = ref<string>()

const editingSubfeed = computed(() =>
  editingId.value == null
    ? undefined
    : subfeeds.value.find((s) => s.id === editingId.value),
)

function openAdd() {
  editingId.value = null
  nameError.value = undefined
  formModalOpen.value = true
}

function openEdit(id: number) {
  editingId.value = id
  nameError.value = undefined
  formModalOpen.value = true
}

async function onSubmit(payload: SubfeedCreateInput) {
  submitting.value = true
  nameError.value = undefined

  const result =
    editingId.value == null
      ? await subfeedsStore.create(sourceId, payload)
      : await subfeedsStore.update(sourceId, editingId.value, payload)

  submitting.value = false

  if (result) {
    formModalOpen.value = false
    toast.add({
      title: editingId.value == null ? 'Subfeed added' : 'Subfeed updated',
      color: 'success',
    })
  } else if (subfeedsStore.errorStatus === 409) {
    nameError.value = subfeedsStore.error ?? undefined
  } else {
    toast.add({
      title: 'Failed to save subfeed',
      description: subfeedsStore.error ?? undefined,
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
  const ok = await subfeedsStore.remove(sourceId, pendingDeleteId.value)
  pendingDeleteId.value = null
  toast.add(
    ok
      ? { title: 'Subfeed deleted', color: 'success' }
      : {
          title: 'Delete failed',
          description: subfeedsStore.error ?? undefined,
          color: 'error',
        },
  )
}

async function onRefresh(id: number) {
  const summary = await subfeedsStore.refresh(id)

  if (summary) {
    toast.add({
      title: 'Subfeed refreshed',
      description: `${summary.seen} items seen, ${summary.inserted} new, ${summary.updated} updated.`,
      color: 'success',
    })
  } else {
    toast.add({
      title: 'Refresh failed',
      description: subfeedsStore.error ?? undefined,
      color: 'error',
    })
  }
}

function effectiveEntries(queryParams: Record<string, string> | null) {
  return Object.entries({ ...source.value?.queryParams, ...queryParams })
}

function isOverride(key: string, queryParams: Record<string, string> | null) {
  return !!queryParams && key in queryParams
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="source">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">Subfeeds</h1>
          <p class="text-sm text-muted">
            {{ source.title }} ·
            <span class="break-all">{{ source.url }}</span>
          </p>
        </div>
        <UButton label="Add subfeed" icon="i-ph-plus" @click="openAdd" />
      </div>

      <UAlert
        v-if="subfeedsStore.error && subfeedsStore.errorStatus !== 409"
        color="error"
        variant="subtle"
        :title="subfeedsStore.error"
      />

      <div v-if="subfeeds.length" class="flex flex-col gap-3">
        <UCard v-for="subfeed in subfeeds" :key="subfeed.id">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-2">
              <h2 class="font-medium text-highlighted">{{ subfeed.name }}</h2>
              <ul class="flex flex-col gap-1 text-sm">
                <li
                  v-for="[key, value] in effectiveEntries(
                    subfeed.queryParams,
                  )"
                  :key="key"
                  class="flex flex-col gap-0.5"
                >
                  <div class="flex items-center gap-2">
                    <span class="font-mono">{{ key }}</span>
                    <UBadge
                      v-if="isOverride(key, subfeed.queryParams)"
                      size="sm"
                      variant="subtle"
                    >
                      overrides parent
                    </UBadge>
                  </div>
                  <span class="whitespace-pre-wrap break-all text-muted">
                    {{ value }}
                  </span>
                </li>
              </ul>
            </div>
            <div class="flex gap-2">
              <UButton
                icon="i-ph-arrow-clockwise"
                color="neutral"
                variant="ghost"
                aria-label="Refresh subfeed"
                @click="onRefresh(subfeed.id)"
              />
              <UButton
                icon="i-ph-pencil"
                color="neutral"
                variant="ghost"
                aria-label="Edit subfeed"
                @click="openEdit(subfeed.id)"
              />
              <UButton
                icon="i-ph-trash"
                color="error"
                variant="ghost"
                aria-label="Delete subfeed"
                @click="pendingDeleteId = subfeed.id"
              />
            </div>
          </div>
        </UCard>
      </div>
      <UCard v-else-if="noSubfeedsYet">
        <p class="text-muted">
          No subfeeds yet. Add one to slice this source by extra query params.
        </p>
      </UCard>

      <UModal
        v-model:open="formModalOpen"
        :title="editingSubfeed ? 'Edit subfeed' : 'Add subfeed'"
      >
        <template #content>
          <div class="p-4">
            <SubfeedsSubfeedForm
              :key="editingId ?? 'new'"
              :subfeed="editingSubfeed"
              :parent-query-params="source.queryParams"
              :parent-pagination="source.pagination"
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
            </SubfeedsSubfeedForm>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="deleteModalOpen" title="Delete subfeed">
        <template #content>
          <div class="flex flex-col gap-4 p-4">
            <p>
              Are you sure? This removes the subfeed; cached items stay, since
              they belong to the parent source.
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
    </template>
    <UAlert v-else color="error" variant="subtle" title="Source not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
