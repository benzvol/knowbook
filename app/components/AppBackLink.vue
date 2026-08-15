<script setup lang="ts">
/**
 * Back navigation for a subpage — any page with no entry in the nav menu.
 *
 * Deliberately takes an explicit `to` rather than calling `router.back()`:
 * these pages are frequently arrived at by direct link or a fresh reload, where
 * history has nowhere sensible to go back to. A fixed parent is always correct.
 */
defineProps<{ to: string; label: string }>()
</script>

<template>
  <div>
    <UButton
      :to="to"
      :label="`Back to ${label}`"
      icon="i-ph-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
      class="-ml-2 px-2"
    />
  </div>
</template>
