<script setup lang="ts">
useHead({ title: 'Organise · Knowbook' })

const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const sourcesStore = useSourcesStore()

await useAsyncData('organise', () =>
  Promise.all([
    categoriesStore.fetchAll(),
    tagsStore.fetchAll(),
    sourcesStore.fetchAll(),
  ]),
)

const categoryCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (const source of sourcesStore.sources) {
    if (source.categoryId === null) continue
    counts[source.categoryId] = (counts[source.categoryId] ?? 0) + 1
  }
  return counts
})

const tagCounts = computed(() => {
  const counts: Record<number, number> = {}
  for (const source of sourcesStore.sources) {
    for (const tag of source.tags) {
      counts[tag.id] = (counts[tag.id] ?? 0) + 1
    }
  }
  return counts
})

async function onCreateCategory(name: string, done: (error?: string) => void) {
  await categoriesStore.create({ name })
  done(categoriesStore.error ?? undefined)
}

async function onRenameCategory(
  id: number,
  name: string,
  done: (error?: string) => void,
) {
  await categoriesStore.update(id, { name })
  done(categoriesStore.error ?? undefined)
}

async function onRemoveCategory(id: number) {
  await categoriesStore.remove(id)
  await sourcesStore.fetchAll()
}

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

    <div class="grid gap-6 md:grid-cols-2">
      <OrganiseEntityList
        title="Categories"
        singular="Category"
        :entities="categoriesStore.categories"
        :counts="categoryCounts"
        :loading="categoriesStore.loading"
        :error="categoriesStore.error"
        :delete-warning="
          (name, count) =>
            `Deleting “${name}” leaves its ${count} source${count === 1 ? '' : 's'} uncategorised.`
        "
        @create="onCreateCategory"
        @rename="onRenameCategory"
        @remove="onRemoveCategory"
      />

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
