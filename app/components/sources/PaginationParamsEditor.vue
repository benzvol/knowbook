<script setup lang="ts">
import type { PaginationConfig, QueryParams } from '#shared/types'

const pagination = defineModel<PaginationConfig | null | undefined>(
  'pagination',
)
const queryParams = defineModel<QueryParams | null | undefined>('queryParams')

const paramRows = ref<{ key: string; value: string }[]>(
  Object.entries(queryParams.value ?? {}).map(([key, value]) => ({
    key,
    value,
  })),
)

function syncQueryParams() {
  const entries = paramRows.value
    .map((row) => [row.key.trim(), row.value] as const)
    .filter(([key]) => key.length > 0)
  queryParams.value = entries.length ? Object.fromEntries(entries) : null
}

function addRow() {
  paramRows.value.push({ key: '', value: '' })
}

function removeRow(index: number) {
  paramRows.value.splice(index, 1)
  syncQueryParams()
}

function updatePagination(patch: Partial<PaginationConfig>) {
  const next = { ...pagination.value, ...patch }
  const hasAnyValue = Object.values(next).some(
    (v) => v !== undefined && v !== '',
  )
  pagination.value = hasAnyValue ? next : null
}
</script>

<template>
  <UCollapsible class="flex flex-col gap-3">
    <UButton
      class="group -mx-2 w-fit"
      label="Pagination & query params"
      color="neutral"
      variant="ghost"
      trailing-icon="i-ph-caret-right"
      :ui="{
        trailingIcon:
          'transition-transform duration-200 group-data-[state=open]:rotate-90',
      }"
    />

    <template #content>
      <div class="flex flex-col gap-4 pt-2">
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Page param">
            <UInput
              :model-value="pagination?.pageParam ?? ''"
              placeholder="page"
              @update:model-value="
                updatePagination({ pageParam: String($event) || undefined })
              "
            />
          </UFormField>
          <UFormField label="Size param">
            <UInput
              :model-value="pagination?.sizeParam ?? ''"
              placeholder="limit"
              @update:model-value="
                updatePagination({ sizeParam: String($event) || undefined })
              "
            />
          </UFormField>
          <UFormField label="Page size">
            <UInput
              :model-value="pagination?.pageSize ?? ''"
              type="number"
              min="1"
              @update:model-value="
                updatePagination({
                  pageSize: $event === '' ? undefined : Number($event),
                })
              "
            />
          </UFormField>
          <UFormField label="Start page">
            <UInput
              :model-value="pagination?.startPage ?? ''"
              type="number"
              min="0"
              @update:model-value="
                updatePagination({
                  startPage: $event === '' ? undefined : Number($event),
                })
              "
            />
          </UFormField>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium text-highlighted">
            Custom query params
          </p>
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
      </div>
    </template>
  </UCollapsible>
</template>
