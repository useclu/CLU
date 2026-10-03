<script setup lang="ts">
import { navigateTo } from '#app'
import { onMounted } from 'vue'

onMounted(() => {
  const suffix = typeof window !== 'undefined'
    ? `${window.location.search}${window.location.hash}`
    : ''

  navigateTo(`/game${suffix}`, { replace: true })
})
</script>

<template>
  CLU
</template>
