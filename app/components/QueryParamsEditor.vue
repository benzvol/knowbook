<script setup lang="ts">
import type { QueryParams } from '#shared/types'

const queryParams = defineModel<QueryParams | null | undefined>()

function serialise(rows: { key: string; value: string }[]): QueryParams {
  const entries = rows
    .map((row) => [row.key.trim(), row.value] as const)
    .filter(([key]) => key.length > 0)
  return Object.fromEntries(entries)
}

const paramRows = ref<{ key: string; value: string }[]>(
  Object.entries(queryParams.value ?? {}).map(([key, value]) => ({
    key,
    value,
  })),
)

// Reseed when the model changes from outside (e.g. an edit form loading its
// subfeed after this component has already mounted). Guarded by comparing the
// serialised forms rather than reacting unconditionally, so a row mid-edit
// (say, a half-typed key) doesn't get clobbered by the round trip its own
// `syncQueryParams` call just triggered.
watch(queryParams, (incoming) => {
  if (JSON.stringify(serialise(paramRows.value)) === JSON.stringify(incoming ?? {})) {
    return
  }
  paramRows.value = Object.entries(incoming ?? {}).map(([key, value]) => ({
    key,
    value,
  }))
})

function syncQueryParams() {
  const entries = serialise(paramRows.value)
  queryParams.value = Object.keys(entries).length ? entries : null
}

function addRow() {
  paramRows.value.push({ key: '', value: '' })
}

function removeRow(index: number) {
  paramRows.value.splice(index, 1)
  syncQueryParams()
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(row, index) in paramRows"
      :key="index"
      class="flex items-center gap-2"
    >
      <UInput
        v-model="row.key"
        placeholder="key"
        class="flex-1"
        @update:model-value="syncQueryParams"
      />
      <UInput
        v-model="row.value"
        placeholder="value"
        class="flex-1"
        @update:model-value="syncQueryParams"
      />
      <UButton
        icon="i-ph-trash"
        color="error"
        variant="ghost"
        aria-label="Remove param"
        @click="removeRow(index)"
      />
    </div>
    <UButton
      label="Add param"
      icon="i-ph-plus"
      color="neutral"
      variant="subtle"
      class="w-fit"
      @click="addRow"
    />
  </div>
</template>
