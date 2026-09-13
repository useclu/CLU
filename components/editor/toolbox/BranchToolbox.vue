<script setup lang="ts">
import type { DraggableEvent } from 'vue-draggable-plus'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import useElementGrabbing from '~/composables/useElementGrabbing'
import { useProject } from '~/stores/useProject'

interface Element {
  label: string
  icon: string
  type: 'STOP' | 'SPACER' | 'AREA_SEPARATOR'
}

type SignageStyle =
  | 'IDFM'
  | 'SNCF'

const { grab, release } = useElementGrabbing()
const { line } = storeToRefs(useProject())

const signageStyle = computed<SignageStyle>(() =>
  (
    line.value as Line & {
      signageStyle?: SignageStyle
    }
  ).signageStyle
  ?? 'IDFM',
)

const isSncfSignage = computed(() =>
  signageStyle.value === 'SNCF',
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
          cityName: 'Ville',
          zoneName: 'Zone 1',
          autoSpacing: true,
          spacing: 3,
          height: 10,
        },
      }
  }
}

function lastBranchInSection(
  section: LineSection,
): Branch | null {
  const sectionElements =
    section.$lineSection.elements

  for (
    let index = sectionElements.length - 1;
    index >= 0;
    index--
  ) {
    const sectionElement =
      sectionElements[index]

    if ('$branch' in sectionElement) {
      return sectionElement
    }

    if (
      '$fork' in sectionElement
      && sectionElement.$fork.sections
    ) {
      const forkSections =
        sectionElement.$fork.sections

      for (
        let forkIndex = forkSections.length - 1;
        forkIndex >= 0;
        forkIndex--
      ) {
        const branch =
          lastBranchInSection(
            forkSections[forkIndex],
          )

        if (branch) {
          return branch
        }
      }
    }

    if (
      '$parallelBranches'
      in sectionElement
    ) {
      const parallelSections =
        sectionElement
          .$parallelBranches
          .sections

      for (
        let parallelIndex = parallelSections.length - 1;
        parallelIndex >= 0;
        parallelIndex--
      ) {
        const branch =
          lastBranchInSection(
            parallelSections[
              parallelIndex
            ],
          )

        if (branch) {
          return branch
        }
      }
    }
  }

  return null
}

const sncfTargetBranch =
  computed<Branch | null>(() => {
    const sections =
      line.value.topology

    for (
      let index = sections.length - 1;
      index >= 0;
      index--
    ) {
      const branch =
        lastBranchInSection(
          sections[index],
        )

      if (branch) {
        return branch
      }
    }

    return null
  })

function addDirectlyInSncf(
  element: Element,
) {
  const branch =
    sncfTargetBranch.value

  if (!branch) {
    return
  }

  branch
    .$branch
    .elements
    .push(
      clone(element),
    )
}

function onStart(
  e: DraggableEvent<Element>,
) {
  grab(e.data.type)
}
</script>

<template>
  <!--
    SNCF :
    vrais boutons simples, sans VueDraggable.
    On peut cliquer autant de fois que nécessaire.
  -->
  <div
    v-if="isSncfSignage"
    class="toolbox-section sncf-toolbox-section"
  >
    <button
      v-for="element in elements"
      :key="element.label"
      type="button"
      class="toolbox-item sncf-toolbox-button"
      @click="addDirectlyInSncf(element)"
    >
      <div class="flex flex-col items-center">
        <i :class="element.icon" />
        <span>{{ $t(element.label) }}</span>
      </div>
    </button>
  </div>

  <!--
    IDFM :
    comportement historique strictement conservé.
  -->
  <VueDraggable
    v-else
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
          <i :class="element.icon" />
          <span>{{ $t(element.label) }}</span>
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

.sncf-toolbox-button {
  appearance: none;
  font-family: inherit;
  color: inherit;
  cursor: pointer !important;
}

.sncf-toolbox-button:active {
  cursor: pointer !important;
}
</style>