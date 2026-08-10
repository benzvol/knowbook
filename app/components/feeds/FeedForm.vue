<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { feedCreateSchema, type FeedCreateInput } from '#shared/schemas/feed'
import type { Feed } from '#shared/types'

const props = defineProps<{
  feed?: Feed
  nameError?: string
  submitting?: boolean
}>()
const emit = defineEmits<{ submit: [payload: FeedCreateInput] }>()

const state = reactive<Partial<FeedCreateInput>>({
  name: props.feed?.name,
})

function onSubmit(event: FormSubmitEvent<FeedCreateInput>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="feedCreateSchema"
    :state="state"
    class="flex flex-col gap-4"
    @submit="onSubmit"
  >
    <UFormField label="Name" name="name" :error="nameError" required>
      <UInput v-model="state.name" class="w-full" />
    </UFormField>

    <div class="flex gap-2">
      <UButton type="submit" :loading="submitting">
        {{ feed ? 'Save changes' : 'Add feed' }}
      </UButton>
      <slot name="cancel" />
    </div>
  </UForm>
</template>
