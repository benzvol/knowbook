<script setup lang="ts">
import type { SourceCreateInput } from '#shared/schemas/source'

useHead({ title: 'Add source · Knowbook' })

const store = useSourcesStore()
const toast = useToast()
const submitting = ref(false)

async function onSubmit(payload: SourceCreateInput) {
  submitting.value = true
  const created = await store.create(payload)
  submitting.value = false

  if (created) {
    toast.add({ title: 'Source added', color: 'success' })
    await navigateTo('/sources')
  } else {
    toast.add({
      title: 'Failed to add source',
      description: store.error ?? undefined,
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 max-w-lg">
    <h1 class="text-xl font-semibold">Add source</h1>
    <SourcesSourceForm :submitting="submitting" @submit="onSubmit" />
  </div>
</template>
