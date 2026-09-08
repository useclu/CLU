<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  layout: 'default-fixed-size',
})
</script>

<template>
  <div class="layout">
    <Panel
      :header="$t('ui.map_editor.title')"
      pt:root:class="flex flex-col min-h-0 max-h-full"
      pt:content-container:class="flex-grow min-h-0"
      pt:content:class="h-full"
    >
      <MapEditor />
    </Panel>
  </div>

  <BrowserCheck />
</template>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: 1fr;

  min-height: 0;
  max-height: 100%;
  height: 100%;
}
</style>