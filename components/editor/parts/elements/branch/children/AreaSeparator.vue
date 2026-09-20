<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProject } from '~/stores/useProject'

const areaSeparator = defineModel<AreaSeparator>({ required: true })

const showPropertiesDialog = ref(false)
const project = useProject()

const isBusAreaMode = computed(() =>
  project.line.mode === 'BUS'
  || project.line.mode === 'BRT'
  || project.line.mode === 'NOCTILIEN',
)

const autoSpacing = computed(() => {
  if (isBusAreaMode.value) {
    return false
  }

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
  if (isBusAreaMode.value) {
    /*
     * La limite doit rester discrète et ne pas créer le grand
     * espace qui était utile à l'ancienne séparation verticale.
     */
    return '.8em'
  }

  if (!autoSpacing.value) {
    return '1em'
  }

  return `calc(1em + ${spacing.value * 2}em)`
})

const separatorHeight = computed(() => {
  if (isBusAreaMode.value) {
    return '4em'
  }

  return `${height.value}em`
})

function openProperties(event: Event) {
  event.stopPropagation()
  showPropertiesDialog.value = true
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="area-separator-wrapper"
    :class="{
      'bus-area-boundary': isBusAreaMode,
    }"
  >
    <div
      class="dynamic-part branch-element-handle area-separator"
      :class="{
        'bus-area-boundary-handle': isBusAreaMode,
      }"
      :title="
        isBusAreaMode
          ? $t('ui.map_editor.toolbox.bus_area_boundary')
          : undefined
      "
      @click="openProperties"
    >
      <template v-if="isBusAreaMode">
        <span class="bus-area-boundary-tick export-hide" />
      </template>

      <template v-else>
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
      </template>
    </div>
  </div>

  <BusAreaBoundaryPropertiesDialog
    v-if="isBusAreaMode"
    v-model:visible="showPropertiesDialog"
    v-model="areaSeparator"
  />

  <AreaSeparatorPropertiesDialog
    v-else
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

.area-separator-wrapper.bus-area-boundary {
  align-items: center;

  min-height: 4em;
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

.area-separator.bus-area-boundary-handle {
  justify-content: center;

  height: 4em;
  min-height: 4em;
  padding: 0;
}

.bus-area-boundary-tick {
  display: block;

  width: .34em;
  height: 1.55em;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-slate-500),
      transparent 25%
    );

  opacity: .4;

  transition:
    opacity .15s ease,
    transform .15s ease;
}

.bus-area-boundary-handle:hover
.bus-area-boundary-tick {
  opacity: .9;
  transform: scaleY(1.12);
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
