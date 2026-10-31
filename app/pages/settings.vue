<script setup lang="ts">
import { appSettingsSchema, type AppSettings } from '#shared/schemas/settings'
import { transferDocumentSchema, transferSections, type TransferDocument, type TransferSelection } from '#shared/schemas/transfer'
import { invalidateDataCacheEpoch } from '~/utils/dataCacheEpoch'
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
let saveInFlight: Promise<unknown> | undefined
const importing = ref(false)
const transferOpen = ref(false)
const transferFile = ref<File | null>(null)
const transferDoc = shallowRef<TransferDocument | null>(null)
const transferMode = ref<'merge' | 'replace'>('merge')
const selection = reactive<TransferSelection>({ sources: true, subfeeds: true, feeds: true, bookmarks: true, tags: true, settings: true })
const preview = ref<{ counts: Record<string, number>; hasOverwrite: boolean; overwrite: Record<string, number>; required: string[] } | null>(null)
const transferError = ref('')
const transferBusy = ref(false)
const overwriteAcknowledged = ref(false)
let previewVersion = 0
const sectionLabels: Record<(typeof transferSections)[number], string> = { sources: 'Sources', subfeeds: 'Subfeeds', feeds: 'Feeds', bookmarks: 'Bookmarks', tags: 'Tags', settings: 'Settings' }
const sectionDisabled = computed(() => ({
  subfeeds: !selection.sources && Boolean(transferDoc.value?.subfeeds.length),
  feeds: (!selection.sources && Boolean(transferDoc.value?.feedSources.length)) || (!selection.subfeeds && Boolean(transferDoc.value?.feedSources.some((relation) => relation.subfeedId !== null))),
  bookmarks: !selection.sources && Boolean(transferDoc.value?.bookmarks.length),
  tags: selection.sources && Boolean(transferDoc.value?.sources.some((source) => source.tagIds.length)),
}))
const sectionHelp: Record<(typeof transferSections)[number], string> = {
  sources: 'Sources, their articles, and labels.',
  subfeeds: 'Subfeeds and the articles in them.',
  feeds: 'Combined feeds and the sources they include.',
  bookmarks: 'Saved articles, labels, and order.',
  tags: 'Labels, including unused ones.',
  settings: 'App preferences.',
}
function messageOf(cause: unknown, fallback: string): string {
  if (cause && typeof cause === 'object') {
    const value = cause as { message?: string; data?: { message?: string; statusMessage?: string } }
    return value.data?.statusMessage || value.data?.message || value.message || fallback
  }
  return fallback
}

async function saveChanges() {
  if (importing.value) return
  const parsed = appSettingsSchema.safeParse(draft)
  if (!parsed.success) return

  const version = ++requestVersion
  saving.value = true
  error.value = ''
  try {
    const operation = $fetch('/api/settings', {
      method: 'PATCH',
      body: parsed.data,
    })
    saveInFlight = operation
    const result = await operation
    settings.value = result
    if (version === requestVersion) {
      toast.add({ title: 'Settings saved', color: 'success' })
    }
  } catch {
    if (version === requestVersion) {
      error.value = 'Could not save settings. Check the values and try again.'
    }
  } finally {
    saveInFlight = undefined
    if (version === requestVersion) saving.value = false
  }
}
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url; anchor.download = filename; window.document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function exportAll() {
  try {
    const document = await $fetch<TransferDocument>('/api/transfer/export')
    downloadJson(document, `knowbook-backup-${new Date().toISOString().replace(/[-:]/g, '')}.json`)
  } catch (cause: unknown) { error.value = messageOf(cause, 'Could not export backup.') }
}
function schedulePreview() {
  const version = ++previewVersion
  preview.value = null; transferError.value = ''; overwriteAcknowledged.value = false
  if (!transferDoc.value || !transferSections.some((section) => selection[section])) return
  setTimeout(async () => {
    try {
      const result = await $fetch<NonNullable<typeof preview.value>>('/api/transfer/preview', { method: 'POST', body: { document: transferDoc.value, selection: { ...selection }, mode: transferMode.value } })
      if (version === previewVersion) preview.value = result
    } catch (cause: unknown) { if (version === previewVersion) transferError.value = messageOf(cause, 'Could not preview this backup.') }
  }, 100)
}
function updateSelection(section: keyof TransferSelection, checked: boolean) {
  if (section === 'tags' && !checked && sectionDisabled.value.tags) return
  selection[section] = checked
  if (!checked && section === 'sources') { selection.subfeeds = false; selection.feeds = false; selection.bookmarks = false }
  if (!checked && section === 'subfeeds') selection.feeds = false
  schedulePreview()
}
async function chooseTransferFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  transferFile.value = file ?? null
  transferDoc.value = null; preview.value = null; transferError.value = ''; overwriteAcknowledged.value = false
  if (!file) return
  if (file.size > 50 * 1024 * 1024) { transferError.value = 'This file is larger than the 50 MiB limit.'; return }
  try {
    const parsed = transferDocumentSchema.safeParse(JSON.parse(await file.text()))
    if (!parsed.success) throw new Error('This is not a supported Knowbook backup file.')
    transferDoc.value = parsed.data; schedulePreview()
  } catch (cause: unknown) { transferError.value = messageOf(cause, 'Could not read this backup file.') }
}
async function runImport() {
  if (!transferDoc.value || !preview.value || !transferSections.some((section) => selection[section])) return
  transferBusy.value = true; transferError.value = ''; importing.value = true
  if (saveTimer) clearTimeout(saveTimer)
  if (saveInFlight) await saveInFlight
  try {
    const body = { document: transferDoc.value, selection: { ...selection }, mode: transferMode.value, acknowledgeOverwrite: overwriteAcknowledged.value }
    const prepared = await $fetch<{ token: string; backup?: TransferDocument; backupFilename?: string }>('/api/transfer/prepare', { method: 'POST', body })
    if (transferMode.value === 'replace') {
      if (!prepared.backup || !prepared.backupFilename) throw new Error('The receiving instance backup could not be prepared.')
      downloadJson(prepared.backup, prepared.backupFilename)
    }
    const result = await $fetch<{ sections: Record<string, { created: number; updated: number; unchanged: number; removed: number }> }>('/api/transfer/commit', { method: 'POST', body: { token: prepared.token } })
    const latest = await $fetch<AppSettings>('/api/settings')
    settings.value = latest; Object.assign(draft, latest)
    invalidateDataCacheEpoch()
    useSourcesStore().$reset(); useSubfeedsStore().$reset(); useFeedsStore().$reset(); useBookmarksStore().$reset(); useTagsStore().$reset(); useItemsStore().$reset()
    const totals = Object.values(result.sections).reduce((sum, section) => ({ created: sum.created + section.created, updated: sum.updated + section.updated, unchanged: sum.unchanged + section.unchanged, removed: sum.removed + section.removed }), { created: 0, updated: 0, unchanged: 0, removed: 0 })
    toast.add({ title: 'Import complete', description: `${totals.created} created · ${totals.updated} updated · ${totals.unchanged} unchanged · ${totals.removed} removed.`, color: 'success' })
    transferOpen.value = false
  } catch (cause: unknown) { transferError.value = messageOf(cause, 'Import failed. No changes were applied.') }
  finally { importing.value = false; transferBusy.value = false }
}
watch(
  draft,
  () => {
    if (importing.value) return
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
  <div class="flex flex-col gap-4">
    <UButton
      label="Back"
      icon="i-ph-arrow-left"
      color="neutral"
      variant="link"
      class="-ml-2 px-2"
      @click="goBack"
    />
    <h1 class="text-xl font-semibold">Settings</h1>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Preferences</h2>
      </template>
      <div class="space-y-5">
        <UFormField label="Theme"
          ><USelect v-model="draft.theme" :items="themeOptions" class="w-56"
        /></UFormField>
        <div class="flex flex-wrap items-start justify-start gap-5">
          <UFormField label="Default page size" class="w-64">
            <UInput
              v-model.number="draft.pageSize"
              type="number"
              min="1"
              max="200"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Search page cap" class="w-64">
            <UInput v-model.number="draft.searchMaxPages" type="number" min="1" class="w-full" />
          </UFormField>
          <p class="basis-full text-sm text-muted">
            Page size and search cap apply when a request supplies no override.
          </p>
        </div>
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
      </div>
    </UCard>
    <UCard>
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">Export &amp; import</h2>
          <p class="text-sm text-muted">Download a backup or restore items from one.</p>
        </div>
      </template>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex gap-2"><UButton label="Export" icon="i-ph-download-simple" variant="outline" @click="exportAll" /><UButton label="Import" icon="i-ph-upload-simple" @click="transferOpen = true" /></div>
      </div>
    </UCard>
    <UModal v-model:open="transferOpen" title="Import backup" description="Choose what to import and how to handle items already in Knowbook." :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-5">
          <div class="flex flex-wrap items-center gap-3">
            <label for="transfer-file" class="relative inline-flex cursor-pointer items-center gap-2 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/80 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <UIcon name="i-ph-upload-simple" aria-hidden="true" />
              Choose file
              <input id="transfer-file" class="sr-only" type="file" accept=".json,application/json" aria-label="Choose a backup file" @change="chooseTransferFile" />
            </label>
            <span class="text-sm text-muted">{{ transferFile?.name ?? 'No file chosen' }}</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label v-for="section in transferSections" :key="section" class="flex items-start gap-3 rounded border border-default p-3">
              <input type="checkbox" :checked="selection[section]" :disabled="section !== 'sources' && section !== 'settings' && sectionDisabled[section]" @change="updateSelection(section, ($event.target as HTMLInputElement).checked)" />
              <span><span class="font-medium">{{ sectionLabels[section] }}</span><span class="block text-xs text-muted">{{ section === 'subfeeds' && sectionDisabled.subfeeds ? 'Select Sources too because subfeeds belong to them.' : section === 'feeds' && sectionDisabled.feeds ? (!selection.sources ? 'Select Sources too because these feeds include them.' : 'Select Subfeeds too because some feeds include them.') : section === 'bookmarks' && sectionDisabled.bookmarks ? 'Select Sources too because saved articles come from them.' : section === 'tags' && sectionDisabled.tags ? 'Required because selected sources use labels.' : sectionHelp[section] }}</span></span>
            </label>
          </div>
          <fieldset class="flex gap-5"><legend class="mb-2 font-medium">Mode</legend><label class="flex gap-2"><input v-model="transferMode" type="radio" value="merge" @change="schedulePreview" />Merge</label><label class="flex gap-2"><input v-model="transferMode" type="radio" value="replace" @change="schedulePreview" />Replace</label></fieldset>
          <p class="text-sm text-muted">Article and bookmark labels stay with their saved items. Merge updates items that are already here and keeps everything else. Replace makes the selected sections match this backup. Before replacing, Knowbook downloads a full backup of its current data.</p>
          <div v-if="preview" class="rounded bg-muted/30 p-3 text-sm"><p class="font-medium">This backup contains</p><p>{{ preview.counts.sources }} sources · {{ preview.counts.cachedArticles }} articles · {{ preview.counts.subfeeds }} subfeeds · {{ preview.counts.feeds }} feeds · {{ preview.counts.bookmarks }} bookmarks · {{ preview.counts.tags }} labels · {{ preview.counts.settings }} preferences</p><div v-if="preview.hasOverwrite" class="mt-2"><UAlert color="warning" title="Some items differ from what is already here. Review how many would change before continuing." /><details class="mt-2"><summary>Show affected section counts</summary><ul class="mt-1 list-inside list-disc"> <li v-for="(count, section) in preview.overwrite" v-show="count" :key="section">{{ section }}: {{ count }} item(s) would be updated</li></ul></details><label class="mt-2 flex gap-2"><input v-model="overwriteAcknowledged" type="checkbox" />I understand these items will replace different versions already here.</label></div></div>
          <UAlert v-if="transferError" color="error" :title="transferError" />
        </div>
      </template>
      <template #footer><div class="flex justify-end gap-2"><UButton label="Cancel" color="neutral" variant="outline" @click="transferOpen = false" /><UButton label="Import" :loading="transferBusy" :disabled="!transferDoc || !preview || !transferSections.some((section) => selection[section]) || (preview?.hasOverwrite && !overwriteAcknowledged)" @click="runImport" /></div></template>
    </UModal>
  </div>
</template>
