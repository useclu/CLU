<script setup lang="ts">
import type { DraggableEvent } from 'vue-draggable-plus'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import { storeToRefs } from 'pinia'
import useElementGrabbing from '~/composables/useElementGrabbing'
import { useProject } from '~/stores/useProject'

interface Element {
  label: string
  icon: string
  type: 'STOP' | 'SPACER' | 'AREA_SEPARATOR'
}

const { grab, release } = useElementGrabbing()
const { line } = storeToRefs(useProject())
const { t } = useI18n()

const isBusAreaMode = computed(() =>
  line.value.mode === 'BUS'
  || line.value.mode === 'BRT'
  || line.value.mode === 'NOCTILIEN',
)

const elements = ref<Element[]>([
  {
    label: 'ui.map_editor.toolbox.stop',
    icon: 'i-bulb-stop',
    type: 'STOP',
  },
  {
    label: 'ui.map_editor.toolbox.spacer',
    icon: 'i-bulb-spacer',
    type: 'SPACER',
  },
  {
    label: 'ui.map_editor.toolbox.area_separator',
    icon: 'i-bulb-spacer',
    type: 'AREA_SEPARATOR',
  },
])

function clone(element: Element): BranchElement {
  switch (element.type) {
    case 'STOP':
      return {
        id: uuidv4(),
        $stop: {
          name: '',
          subtitle: '',
          placeName: '',
          accessible: 'undefined',
          reverse: false,
          interestPoint: false,
          preventSubtitleOverlapping: true,
          terminus: false,
          closed: false,
          future: false,
          outOfFareZone: false,
          connections: [],
          nameStyle: {
            bold: true,
            italic: false,
            underline: false,
            color: null,
            image: null,
            imageSize: 1,
          },
        },
      }

    case 'SPACER':
      return {
        id: uuidv4(),
        $spacer: {
          size: 5,
        },
      }

    case 'AREA_SEPARATOR':
      return {
        id: uuidv4(),
        $areaSeparator: {
          /*
           * Sur un plan Bus, l'AreaSeparator devient une limite
           * entre plages Commune / Zone. On conserve néanmoins les
           * valeurs historiques afin qu'un
           * projet repassé vers un mode non-Bus retrouve le rendu
           * classique de l'AreaSeparator sans migration.
           */
          cityName: t('ui.map_editor.defaults.city'),
          zoneName: t('ui.map_editor.defaults.zone', { number: 1 }),
          autoSpacing: true,
          spacing: 3,
          height: 10,
          busCityBoundary: true,
          busZoneBoundary: true,
        },
      }
  }
}

function onStart(
  e: DraggableEvent<Element>,
) {
  grab(e.data.type)
}
</script>

<template>
    <VueDraggable
    v-model="elements"
    class="toolbox-section"
    :group="{
      name: 'branchElements',
      pull: 'clone',
      put: false,
    }"
    :clone="clone"
    :sort="false"
    @start="e => onStart(e as DraggableEvent<Element>)"
    @end="release()"
  >
    <div
      v-for="element in elements"
      :key="element.label"
      class="toolbox-item"
    >
      <div class="item hidden">
        <div class="flex flex-col items-center">
          <i
            :class="
              element.type === 'AREA_SEPARATOR'
              && isBusAreaMode
                ? 'i-tabler-map-pin'
                : element.icon
            "
          />
          <span>
            {{
              element.type === 'AREA_SEPARATOR'
              && isBusAreaMode
                ? $t('ui.map_editor.toolbox.bus_area_boundary')
                : $t(element.label)
            }}
          </span>
        </div>
      </div>

      <div class="preview h-full flex items-center">
        <BranchElement
          :model-value="clone(element)"
          :reverse="false"
        />
      </div>
    </div>
  </VueDraggable>
</template>

<style scoped lang="scss">
.toolbox-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;

  .toolbox-item {
    cursor: grab;
    background-color: white;
    border: 1px solid var(--p-slate-200);
    border-radius: .375rem;
    min-width: 5rem;
    padding: .5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition:
      box-shadow .2s ease-in-out,
      transform .2s ease-in-out;

    span {
      font-size: 1rem;
      user-select: none;
    }

    &:active {
      cursor: grabbing;
    }

    &:hover {
      box-shadow: 0 0 1em 0 rgb(0 0 0 / 25%);
      transform: scale(1.05);
    }

    & .item {
      display: block;
    }

    & .preview {
      display: none;
    }
  }
}

</style>
