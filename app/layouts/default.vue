<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-ph-house', to: '/' },
  { label: 'Sources', icon: 'i-ph-rss', to: '/sources' },
  { label: 'Organise', icon: 'i-ph-tag', to: '/organise' },
]
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex items-center py-3">
        <UNavigationMenu :items="items" />
      </UContainer>
    </header>
    <UContainer class="py-8">
      <slot />
    </UContainer>
  </div>
</template>
