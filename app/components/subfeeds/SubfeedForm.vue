<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  subfeedCreateSchema,
  type SubfeedCreateInput,
} from '#shared/schemas/subfeed'
import type { PaginationConfig, QueryParams, Subfeed } from '#shared/types'

const props = defineProps<{
  subfeed?: Subfeed
  parentQueryParams?: QueryParams | null
  parentPagination?: PaginationConfig | null
  nameError?: string
  submitting?: boolean
}>()
const emit = defineEmits<{ submit: [payload: SubfeedCreateInput] }>()

const state = reactive<Partial<SubfeedCreateInput>>({
  name: props.subfeed?.name,
  queryParams: props.subfeed?.queryParams ?? null,
})

// The merged result a refresh would actually request: parent overlaid with
// this subfeed's own params, the subfeed winning on collisions — mirrors
// `subfeedTarget` (`server/feed/target.ts`).
interface EffectiveParam {
  key: string
  value: string
  overridesParent: boolean
  overriddenByPagination: boolean
}

const effectiveParams = computed<EffectiveParam[]>(() => {
  const parent = props.parentQueryParams ?? {}
  const own = state.queryParams ?? {}
  const merged = { ...parent, ...own }
  const paginationKeys = new Set(
    [
      props.parentPagination?.pageParam,
      props.parentPagination?.sizeParam,
    ].filter((k): k is string => !!k),
  )

  return Object.entries(merged).map(([key, value]) => ({
    key,
    value,
    overridesParent: key in own && parent[key] !== value,
    // `buildPageUrl` writes pagination params after query params, so a key
    // that collides with the parent's page/size param is silently clobbered
    // on every request — surfaced here rather than left invisible.
    overriddenByPagination: paginationKeys.has(key),
  }))
})

function onSubmit(event: FormSubmitEvent<SubfeedCreateInput>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="subfeedCreateSchema"
    :state="state"
    class="flex flex-col gap-4"
    @submit="onSubmit"
  >
    <UFormField label="Name" name="name" :error="nameError" required>
      <UInput v-model="state.name" class="w-full" />
    </UFormField>

    <div class="flex flex-col gap-2">
      <p class="text-sm font-medium text-highlighted">Query params</p>
      <p class="text-sm text-muted">
        Merged over the parent source's own params — pagination is always
        inherited from the parent.
      </p>
      <QueryParamsEditor v-model="state.queryParams" />
    </div>

    <div v-if="effectiveParams.length" class="flex flex-col gap-2">
      <p class="text-sm font-medium text-highlighted">Effective params</p>
      <ul class="flex flex-col gap-1 text-sm">
        <li
          v-for="param in effectiveParams"
          :key="param.key"
          class="flex flex-col gap-0.5 rounded border border-default p-2"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono">{{ param.key }}</span>
            <UBadge v-if="param.overridesParent" size="sm" variant="subtle">
              overrides parent
            </UBadge>
            <UBadge
              v-if="param.overriddenByPagination"
              size="sm"
              color="warning"
              variant="subtle"
            >
              overridden by pagination
            </UBadge>
          </div>
          <span class="whitespace-pre-wrap break-all text-muted">
            {{ param.value }}
          </span>
        </li>
      </ul>
    </div>

    <div class="flex gap-2">
      <UButton type="submit" :loading="submitting">
        {{ subfeed ? 'Save changes' : 'Add subfeed' }}
      </UButton>
      <slot name="cancel" />
    </div>
  </UForm>
</template>
