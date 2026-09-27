<script setup lang="ts">
import { definePageMeta, useHead } from '#imports'

definePageMeta({
  layout: 'default-fixed-size',
})

useHead({
  bodyAttrs: {
    class: 'clu-editor-responsive',
  },
})
</script>

<template>
  <div class="layout">
    <Panel
      class="editor-panel"
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


@media (max-width: 1100px) {
  .layout {
    width: 100%;
  }

  .editor-panel :deep(.p-panel-header) {
    min-height: 2.25rem;
    padding: .45rem .65rem;

    font-size: .82rem;
  }

  .editor-panel :deep(.p-panel-content) {
    padding: .45rem;
  }
}

@media (max-width: 720px) {
  .editor-panel {
    border-radius: .35rem;
  }

  .editor-panel :deep(.p-panel-header) {
    min-height: 2rem;
    padding: .35rem .5rem;

    font-size: .78rem;
  }

  .editor-panel :deep(.p-panel-content) {
    padding: .25rem;
  }
}

</style>