<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { feedMemberSchema, type FeedMemberInput } from '#shared/schemas/feed'

defineProps<{ memberError?: string; submitting?: boolean }>()
const emit = defineEmits<{ submit: [payload: FeedMemberInput] }>()

const sourcesStore = useSourcesStore()
const subfeedsStore = useSubfeedsStore()
await sourcesStore.fetchAll()

const state = reactive<Partial<FeedMemberInput>>({
  sourceId: undefined,
  subfeedId: null,
})

// Sentinel rather than a `null`-valued select item: USelectMenu treats a
// `null` model as "nothing selected", so an item whose value is `null` could
// never render as chosen. `0` is safe as a stand-in — `feedMemberSchema`
// requires a positive int, so it can never collide with a real subfeed id —
// and is mapped back to `null` on the way into `state`, which is what's
// actually emitted.
const WHOLE_SOURCE = 0

const subfeedItems = computed(() => [
  { id: WHOLE_SOURCE, name: 'Whole source' },
  ...(subfeedsStore.bySource[state.sourceId ?? -1] ?? []),
])

const subfeedChoice = computed<number>({
  get: () => state.subfeedId ?? WHOLE_SOURCE,
  set: (value) => {
    state.subfeedId = value === WHOLE_SOURCE ? null : value
  },
})

watch(
  () => state.sourceId,
  async (sourceId) => {
    state.subfeedId = null
    if (sourceId) await subfeedsStore.fetchForSource(sourceId)
  },
)

function onSubmit(event: FormSubmitEvent<FeedMemberInput>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="feedMemberSchema"
    :state="state"
    class="flex flex-col gap-4"
    @submit="onSubmit"
  >
    <UFormField label="Source" name="sourceId" :error="memberError" required>
      <USelectMenu
        v-model="state.sourceId"
        :items="sourcesStore.sources"
        value-key="id"
        label-key="title"
        placeholder="Select a source"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Subfeed"
      name="subfeedId"
      description="Leave as “Whole source” to include everything from it."
    >
      <USelectMenu
        v-model="subfeedChoice"
        :items="subfeedItems"
        value-key="id"
        label-key="name"
        :disabled="!state.sourceId"
        :loading="subfeedsStore.loading"
        class="w-full"
      />
    </UFormField>

    <div class="flex gap-2">
      <UButton type="submit" :loading="submitting" label="Add member" />
      <slot name="cancel" />
    </div>
  </UForm>
</template>
