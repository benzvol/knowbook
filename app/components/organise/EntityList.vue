<script setup lang="ts">
const props = defineProps<{
  title: string
  singular: string
  entities: { id: number; name: string }[]
  counts: Record<number, number>
  loading?: boolean
  error?: string | null
  deleteWarning: (name: string, count: number) => string
}>()

const emit = defineEmits<{
  create: [name: string, done: (error?: string) => void]
  rename: [id: number, name: string, done: (error?: string) => void]
  remove: [id: number]
}>()

const newName = ref('')
const createError = ref<string | undefined>()
const creating = ref(false)

const editingId = ref<number | null>(null)
const editingName = ref('')
const renameError = ref<string | undefined>()
const renaming = ref(false)

const pendingDeleteId = ref<number | null>(null)
const deleteModalOpen = computed({
  get: () => pendingDeleteId.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDeleteId.value = null
  },
})
const pendingDelete = computed(() =>
  props.entities.find((e) => e.id === pendingDeleteId.value),
)

function onCreate() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  createError.value = undefined
  emit('create', name, (error) => {
    creating.value = false
    createError.value = error
    if (!error) newName.value = ''
  })
}

function startEdit(entity: { id: number; name: string }) {
  editingId.value = entity.id
  editingName.value = entity.name
  renameError.value = undefined
}

function cancelEdit() {
  editingId.value = null
  renameError.value = undefined
}

function onRename() {
  if (editingId.value === null) return
  const name = editingName.value.trim()
  if (!name) return
  renaming.value = true
  renameError.value = undefined
  emit('rename', editingId.value, name, (error) => {
    renaming.value = false
    renameError.value = error
    if (!error) editingId.value = null
  })
}

function confirmDelete() {
  if (pendingDeleteId.value === null) return
  emit('remove', pendingDeleteId.value)
  pendingDeleteId.value = null
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold">{{ title }}</h2>
    </template>

    <div class="flex flex-col gap-4">
      <form class="flex items-start gap-2" @submit.prevent="onCreate">
        <UFormField class="flex-1" :error="createError">
          <UInput
            v-model="newName"
            :placeholder="`New ${singular.toLowerCase()}`"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          icon="i-ph-plus"
          :loading="creating"
          :disabled="!newName.trim()"
        />
      </form>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <div v-if="entities.length" class="flex flex-col gap-1">
        <div
          v-for="entity in entities"
          :key="entity.id"
          class="flex items-center gap-2 py-1"
        >
          <template v-if="editingId === entity.id">
            <UFormField class="flex-1" :error="renameError">
              <UInput
                v-model="editingName"
                class="w-full"
                autofocus
                @keyup.enter="onRename"
                @keyup.escape="cancelEdit"
              />
            </UFormField>
            <UButton
              icon="i-ph-check"
              color="primary"
              variant="ghost"
              :loading="renaming"
              aria-label="Save"
              @click="onRename"
            />
            <UButton
              icon="i-ph-x"
              color="neutral"
              variant="ghost"
              aria-label="Cancel"
              @click="cancelEdit"
            />
          </template>
          <template v-else>
            <span class="flex-1 truncate">{{ entity.name }}</span>
            <span class="text-sm text-muted">
              {{ counts[entity.id] ?? 0 }}
            </span>
            <UDropdownMenu
              :items="[
                [
                  {
                    label: 'Rename',
                    icon: 'i-ph-pencil',
                    onSelect: () => startEdit(entity),
                  },
                  {
                    label: 'Delete',
                    icon: 'i-ph-trash',
                    color: 'error',
                    onSelect: () => {
                      pendingDeleteId = entity.id
                    },
                  },
                ],
              ]"
            >
              <UButton
                icon="i-ph-dots-three-vertical"
                color="neutral"
                variant="ghost"
                aria-label="Actions"
              />
            </UDropdownMenu>
          </template>
        </div>
      </div>
      <p v-else-if="!loading" class="text-muted">
        No {{ title.toLowerCase() }} yet.
      </p>
    </div>

    <UModal
      v-model:open="deleteModalOpen"
      :title="`Delete ${singular.toLowerCase()}`"
    >
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <p v-if="pendingDelete">
            {{
              deleteWarning(pendingDelete.name, counts[pendingDelete.id] ?? 0)
            }}
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
  </UCard>
</template>
