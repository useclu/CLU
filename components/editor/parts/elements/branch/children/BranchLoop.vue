<script setup lang="ts">
import { ref } from 'vue'
import SectionLoopGraphic from '~/components/editor/parts/elements/sections/children/Loop.vue'

defineOptions({
  inheritAttrs: false,
})

const loop = defineModel<Loop>({
  required: true,
})

const showPropertiesDialog = ref(false)
</script>

<template>
  <div
    v-bind="$attrs"
    class="branch-loop-wrapper"
  >
    <div
      class="branch-loop branch-element-handle dynamic-part"
      role="button"
      tabindex="0"
      :aria-label="$t('ui.map_editor.toolbox.loop')"
      @click.stop="showPropertiesDialog = true"
      @keydown.enter.prevent="showPropertiesDialog = true"
      @keydown.space.prevent="showPropertiesDialog = true"
    >
      <SectionLoopGraphic
        :meta="loop"
        embedded
      />
    </div>
  </div>

  <Teleport to="body">
    <div>
      <LoopPropertiesDialog
        v-model="loop"
        v-model:visible="showPropertiesDialog"
      />
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.branch-loop-wrapper {
  position: relative;

  flex: 0 0 auto;
  min-height: 5em;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: visible;
}

.branch-loop {
  position: relative;

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &::after {
    content: '';

    position: absolute;
    inset: -.3em;

    border: 1px dashed
      color-mix(
        in srgb,
        var(--p-slate-400),
        transparent 20%
      );
    border-radius: .45em;

    background:
      color-mix(
        in srgb,
        var(--p-slate-200),
        transparent 82%
      );

    opacity: 0;
    pointer-events: none;

    transition: opacity .15s ease;
  }

  &:hover::after,
  &:focus-visible::after {
    opacity: 1;
  }
}
</style>
