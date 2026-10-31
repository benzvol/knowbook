<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :page-key="(route) => route.path" />
    </NuxtLayout>
  </UApp>
</template>
<script setup lang="ts">
const { data: initialSettings } = await useFetch('/api/settings')
const appSettings = useState(
  'app-settings',
  () =>
    initialSettings.value ?? {
      pageSize: 25,
      searchMaxPages: 5,
      theme: 'light',
      editorialColumnRatio: [1, 1, 1],
      autoRefreshThresholdMinutes: 60,
    },
)
const systemPrefersDark = useState('system-prefers-dark', () => false)
if (initialSettings.value) appSettings.value = initialSettings.value
useHead({
  htmlAttrs: {
    class: computed(() =>
      appSettings.value.theme === 'system'
        ? systemPrefersDark.value
          ? 'dark'
          : 'light'
        : appSettings.value.theme,
    ),
  },
})
onMounted(() => {
  const preference = window.matchMedia('(prefers-color-scheme: dark)')
  const syncPreference = () => {
    systemPrefersDark.value = preference.matches
  }
  syncPreference()
  preference.addEventListener('change', syncPreference)
  onUnmounted(() => preference.removeEventListener('change', syncPreference))
})
</script>
