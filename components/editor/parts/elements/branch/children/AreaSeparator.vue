<script setup lang="ts">
import { computed, ref } from 'vue'

const areaSeparator = defineModel<AreaSeparator>({ required: true })

const showPropertiesDialog = ref(false)

const autoSpacing = computed(() => {
  return areaSeparator.value.$areaSeparator.autoSpacing !== false
})

const spacing = computed(() => {
  const value = areaSeparator.value.$areaSeparator.spacing

  return typeof value === 'number' ? value : 3
})

const height = computed(() => {
  const value = areaSeparator.value.$areaSeparator.height

  return typeof value === 'number' ? value : 10
})

const separatorWidth = computed(() => {
  if (!autoSpacing.value) {
    return '1em'
  }

  return `calc(1em + ${spacing.value * 2}em)`
})

const separatorHeight = computed(() => {
  return `${height.value}em`
})
</script>

<template>
  <div
    v-bind="$attrs"
    class="area-separator-wrapper"
  >
    <div
      class="dynamic-part branch-element-handle area-separator"
      @click="(e: Event) => {
        e.stopPropagation()
        showPropertiesDialog = true
      }"
    >
      <div class="area-separator-labels">
        <div
          v-if="areaSeparator.$areaSeparator.cityName"
          class="area-separator-city"
        >
          {{ areaSeparator.$areaSeparator.cityName }}
        </div>

        <div
          v-if="areaSeparator.$areaSeparator.zoneName"
          class="area-separator-zone"
        >
          {{ areaSeparator.$areaSeparator.zoneName }}
        </div>
      </div>

      <div class="area-separator-line" />
    </div>
  </div>

  <AreaSeparatorPropertiesDialog
    v-model:visible="showPropertiesDialog"
    v-model="areaSeparator"
  />
</template>

<style scoped lang="scss">
.area-separator-wrapper {
  position: relative;

  display: flex;
  justify-content: center;
  align-items: flex-start;

  width: v-bind(separatorWidth);
  min-width: v-bind(separatorWidth);

  min-height: calc(v-bind(separatorHeight) + 3em);

  z-index: 3;
}

.area-separator {
  position: relative;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;

  width: 100%;

  padding: .25em;

  border-radius: .25em;
  background-color: transparent;

  cursor: grab;

  transition: background-color .2s ease;

  &:hover {
    background-color: color-mix(
      in srgb,
      var(--p-slate-300),
      transparent 70%
    );
  }

  &:active {
    cursor: grabbing;
  }
}

.area-separator-labels {
  display: flex;
  flex-direction: column;
  align-items: center;

  margin-bottom: .25em;

  white-space: nowrap;

  pointer-events: none;
}

.area-separator-city {
  font-size: .7em;
  font-weight: 600;
  line-height: 1.1;

  text-align: center;
}

.area-separator-zone {
  margin-top: .15em;

  font-size: .6em;
  font-weight: 500;
  line-height: 1.1;

  opacity: .7;

  text-align: center;
}

.area-separator-line {
  width: 0;
  height: v-bind(separatorHeight);
  min-height: v-bind(separatorHeight);

  border-left: 1px dashed var(--p-slate-500);

  pointer-events: none;
}
</style>