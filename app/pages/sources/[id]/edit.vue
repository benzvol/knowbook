<script setup lang="ts">
import type { SourceCreateInput } from '#shared/schemas/source'

const route = useRoute()
const id = Number(route.params.id)

useHead({ title: 'Edit source · Knowbook' })

const store = useSourcesStore()
const toast = useToast()
const submitting = ref(false)

const { data: source } = await useAsyncData(`source-${id}`, () =>
  store.fetchOne(id),
)

async function onSubmit(payload: SourceCreateInput) {
  submitting.value = true
  const updated = await store.update(id, payload)
  submitting.value = false

  if (updated) {
    toast.add({ title: 'Source updated', color: 'success' })
    await navigateTo('/sources')
  } else {
    toast.add({
      title: 'Failed to update source',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 max-w-lg">
    <template v-if="source">
      <AppBackLink to="/sources" label="sources" />
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-xl font-semibold">Edit source</h1>
        <div class="flex gap-2">
          <UButton
            label="Items"
            icon="i-ph-newspaper"
            color="neutral"
            variant="subtle"
            size="sm"
            :to="`/sources/${id}/items`"
          />
          <UButton
            label="Subfeeds"
            icon="i-ph-stack"
            color="neutral"
            variant="subtle"
            size="sm"
            :to="`/sources/${id}/subfeeds`"
          />
        </div>
      </div>
      <SourcesSourceForm
        :source="source"
        :submitting="submitting"
        @submit="onSubmit"
      />
    </template>
    <UAlert v-else color="error" variant="subtle" title="Source not found">
      <template #description>
        <NuxtLink to="/sources" class="underline">Back to sources</NuxtLink>
      </template>
    </UAlert>
  </div>
</template>
