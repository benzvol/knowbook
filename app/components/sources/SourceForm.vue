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

// Minimum length before offering to create a tag, so a single stray keystroke
// doesn't suggest a one-letter tag.
const MIN_CREATE_TAG_LENGTH = 2

const tagSearch = ref('')

// USelectMenu's own `create-item` only offers creation when the filtered list
// is *empty*, so typing `ai` hides it as soon as anything matches the
// substring (e.g. `daily`). Its `when: 'always'` mode is no help either: that
// compares via `by ?? valueKey`, which here is `id`, so it matches a numeric
// tag id against the search string and never fires. Gate it ourselves instead:
// offer creation whenever the term is long enough and no tag has that exact
// name. Compared case-insensitively to match the menu's own filtering, so
// typing `DAILY` when `daily` exists doesn't offer a near-duplicate.
const canCreateTag = computed(() => {
  const term = tagSearch.value.trim()
  if (term.length < MIN_CREATE_TAG_LENGTH) return false
  return !tagsStore.tags.some(
    (tag) => tag.name.toLowerCase() === term.toLowerCase(),
  )
})

// Kept at the bottom: the first item is keyboard-highlighted, so putting
// "Create …" on top would make Enter create a tag when the user meant to pick
// the match they were typing towards.
const createTagItem = computed(() =>
  canCreateTag.value ? ({ when: 'always', position: 'bottom' } as const) : false,
)

async function onCreateTag(name: string) {
  const tag = await tagsStore.create({ name })
  if (tag) {
    state.tagIds = [...(state.tagIds ?? []), tag.id]
    // Clear the search so the full list (including the new tag) is visible
    // again and the create option doesn't linger.
    tagSearch.value = ''
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
        v-model:search-term="tagSearch"
        :items="tagsStore.tags"
        value-key="id"
        label-key="name"
        multiple
        :create-item="createTagItem"
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
