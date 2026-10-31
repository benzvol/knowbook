<script setup lang="ts">
import { appSettingsSchema, type AppSettings } from '#shared/schemas/settings'
const router = useRouter()
const settings = useState<AppSettings>('app-settings')
const draft = reactive({
  ...settings.value,
  editorialColumnRatio: [...settings.value.editorialColumnRatio],
})
const saving = ref(false)
const error = ref('')
const toast = useToast()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let requestVersion = 0

async function saveChanges() {
  const parsed = appSettingsSchema.safeParse(draft)
  if (!parsed.success) return

  const version = ++requestVersion
  saving.value = true
  error.value = ''
  try {
    const result = await $fetch('/api/settings', {
      method: 'PATCH',
      body: parsed.data,
    })
    settings.value = result
    if (version === requestVersion) {
      toast.add({ title: 'Settings saved', color: 'success' })
    }
  } catch {
    if (version === requestVersion) {
      error.value = 'Could not save settings. Check the values and try again.'
    }
  } finally {
    if (version === requestVersion) saving.value = false
  }
}
watch(
  draft,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    error.value = ''
    if (!appSettingsSchema.safeParse(draft).success) return
    saveTimer = setTimeout(saveChanges, 400)
  },
  { deep: true },
)
const themeOptions = [
  { label: 'Light', value: 'light', icon: 'i-ph-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-ph-moon' },
  { label: 'System', value: 'system', icon: 'i-ph-monitor' },
]
const ratioOptions = [
  { label: 'Equal thirds', value: '1,1,1' },
  { label: 'Wider middle', value: '1,2,1' },
]
const ratioPreset = computed({
  get: () => draft.editorialColumnRatio.join(','),
  set: (v: string) => {
    draft.editorialColumnRatio = v.split(',').map(Number)
  },
})
const refreshPresets = [1, 5, 10, 30, 60, 180, 360, 720, 1440].map((value) => ({
  label: value < 60 ? `${value}m` : `${value / 60}h`, value,
}))
function goBack() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    navigateTo('/')
  }
}
</script>
<template>
  <div class="mx-auto max-w-xl space-y-6">
    <UButton
      label="Back"
      icon="i-ph-arrow-left"
      color="neutral"
      variant="link"
      class="-ml-2 px-2"
      @click="goBack"
    />
    <h1 class="text-3xl font-semibold">Settings</h1>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UCard
      ><div class="space-y-5">
        <UFormField label="Theme"
          ><USelect v-model="draft.theme" :items="themeOptions" class="w-56"
        /></UFormField>
        <UFormField label="Default page size"
          ><UInput
            v-model.number="draft.pageSize"
            type="number"
            min="1"
            max="200"
        /></UFormField>
        <p class="text-sm text-muted">
          Page size and search cap apply when a request supplies no override.
        </p>
        <UFormField label="Search page cap"
          ><UInput v-model.number="draft.searchMaxPages" type="number" min="1"
        /></UFormField>
        <UFormField label="Automatic refresh after this much time since the last visit">
          <div class="flex flex-wrap gap-2">
            <UButton v-for="preset in refreshPresets" :key="preset.value" :label="preset.label" size="sm" :variant="draft.autoRefreshThresholdMinutes === preset.value ? 'solid' : 'outline'" @click="draft.autoRefreshThresholdMinutes = preset.value" />
          </div>
          <div class="mt-2 flex items-center gap-2">
            <UInput v-model.number="draft.autoRefreshThresholdMinutes" type="number" min="1" max="1440" step="1" class="w-40" />
            <span class="text-sm text-muted">minutes</span>
          </div>
          <p v-if="!appSettingsSchema.shape.autoRefreshThresholdMinutes.safeParse(draft.autoRefreshThresholdMinutes).success" class="mt-1 text-sm text-error">Enter a whole number from 1 to 1440 minutes.</p>
        </UFormField>
        <UFormField label="Editorial columns"
          ><USelect v-model="ratioPreset" :items="ratioOptions" class="w-56"
        /></UFormField>
        <p class="text-sm text-muted">
          Current ratio: {{ draft.editorialColumnRatio.join(' : ') }}
        </p>
        <p v-if="saving" class="text-sm text-muted" role="status">
          Saving settings…
        </p>
      </div></UCard
    >
  </div>
</template>
