<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  sourceCreateSchema,
  type SourceCreateInput,
} from '#shared/schemas/source'
import type { SourceWithTags } from '#shared/types'

const props = defineProps<{ source?: SourceWithTags; submitting?: boolean }>()
const emit = defineEmits<{ submit: [payload: SourceCreateInput] }>()

const tagsStore = useTagsStore()
const toast = useToast()
await tagsStore.fetchAll()

// `managed` is intentionally not editable here — it is written only by the
// managed-source config loader, never from a client payload.
const state = reactive<Partial<SourceCreateInput>>({
  url: props.source?.url,
  title: props.source?.title,
  pagination: props.source?.pagination ?? null,
  queryParams: props.source?.queryParams ?? null,
  tagIds: props.source?.tags.map((t) => t.id) ?? [],
})

async function onCreateTag(name: string) {
  const tag = await tagsStore.create({ name })
  if (tag) {
    state.tagIds = [...(state.tagIds ?? []), tag.id]
  } else {
    toast.add({
      title: 'Failed to create tag',
      description: tagsStore.error ?? undefined,
      color: 'error',
    })
  }
}

function onSubmit(event: FormSubmitEvent<SourceCreateInput>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="sourceCreateSchema"
    :state="state"
    class="flex flex-col gap-4"
    @submit="onSubmit"
  >
    <UFormField label="Title" name="title" required>
      <UInput v-model="state.title" class="w-full" />
    </UFormField>

    <UFormField label="URL" name="url" required>
      <UInput
        v-model="state.url"
        class="w-full"
        placeholder="https://example.com/feed"
      />
    </UFormField>

    <UFormField label="Tags" name="tagIds">
      <USelectMenu
        v-model="state.tagIds"
        :items="tagsStore.tags"
        value-key="id"
        label-key="name"
        multiple
        create-item
        placeholder="Select or create tags"
        class="w-full"
        @create="onCreateTag"
      />
    </UFormField>

    <SourcesPaginationParamsEditor
      v-model:pagination="state.pagination"
      v-model:query-params="state.queryParams"
    />

    <div class="flex gap-2">
      <UButton type="submit" :loading="submitting">
        {{ source ? 'Save changes' : 'Add source' }}
      </UButton>
      <UButton label="Cancel" color="neutral" variant="subtle" to="/sources" />
    </div>
  </UForm>
</template>
