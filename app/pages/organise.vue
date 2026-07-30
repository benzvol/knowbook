<script setup lang="ts">
useHead({ title: 'Organise · Knowbook' })

const tagsStore = useTagsStore()
const sourcesStore = useSourcesStore()

await useAsyncData('organise', () =>
  Promise.all([tagsStore.fetchAll(), sourcesStore.fetchAll()]),
)

const tagCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (const source of sourcesStore.sources) {
    for (const tag of source.tags) {
      counts[tag.id] = (counts[tag.id] ?? 0) + 1
    }
  }
  return counts
})

async function onCreateTag(name: string, done: (error?: string) => void) {
  await tagsStore.create({ name })
  done(tagsStore.error ?? undefined)
}

async function onRenameTag(
  id: number,
  name: string,
  done: (error?: string) => void,
) {
  await tagsStore.update(id, { name })
  done(tagsStore.error ?? undefined)
}

async function onRemoveTag(id: number) {
  await tagsStore.remove(id)
  await sourcesStore.fetchAll()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold">Organise</h1>

    <div class="grid gap-6">
      <OrganiseEntityList
        title="Tags"
        singular="Tag"
        :entities="tagsStore.tags"
        :counts="tagCounts"
        :loading="tagsStore.loading"
        :error="tagsStore.error"
        :delete-warning="
          (name, count) =>
            `Deleting “${name}” removes it from ${count} source${count === 1 ? '' : 's'}.`
        "
        @create="onCreateTag"
        @rename="onRenameTag"
        @remove="onRemoveTag"
      />
    </div>
  </div>
</template>
