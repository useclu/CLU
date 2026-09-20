<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import type { DraggableEvent } from 'vue-draggable-plus'
import useElementGrabbing from '~/composables/useElementGrabbing'
import { VueDraggable } from 'vue-draggable-plus'

interface Element {
  label: string
  icon: string
  type:
    | 'BRANCH'
    | 'FORK'
    | 'VERTICAL_SEGMENT'
    | 'PARALLEL_BRANCHES'
}

const elements = ref<Element[]>([
  {
    label: 'ui.map_editor.toolbox.branch',
    icon: 'i-bulb-branch',
    type: 'BRANCH',
  },
  {
    label: 'ui.map_editor.toolbox.fork',
    icon: 'i-bulb-fork',
    type: 'FORK',
  },
  {
    label: 'ui.map_editor.toolbox.vertical_segment',
    icon: 'i-tabler-arrows-vertical',
    type: 'VERTICAL_SEGMENT',
  },
  {
    label: 'ui.map_editor.toolbox.parallel_branches',
    icon: 'i-bulb-parallel-branches',
    type: 'PARALLEL_BRANCHES',
  },
])

function createBranch(): Branch {
  return {
    id: uuidv4(),
    $branch: {
      elementSpacing: 0,
      marginLeft: 0,
      marginRight: 0,
      invertedElements: false,
      elements: [],
    },
  }
}

function createForkSection(
  levelOffset: number,
): LineSection {
  return {
    id: uuidv4(),
    $lineSection: {
      levelOffset,
      elements: [
        createBranch(),
      ],
    },
  }
}

function clone(element: Element): LineElement {
  switch (element.type) {
    case 'BRANCH':
      return createBranch()

    case 'FORK':
      return {
        id: uuidv4(),
        $fork: {
          toward: 'RIGHT',
          originOffset: 0,
          linksOffset: [1, -1],
          offsetMultiplier: 1,

          /*
           * Une nouvelle Fork cible explicitement la ligne principale.
           *
           * IMPORTANT :
           * la Fork naît désormais SEULE, sans sections de sortie.
           * L'utilisateur ajoute ensuite manuellement un vrai
           * "Branches parallèles" depuis la toolbox.
           *
           * Si ce ParallelBranches est posé juste à côté de la Fork,
           * SectionEditor les associe par IDs et toute la logique
           * simple / multi-ligne reprend automatiquement.
           */
          lineId: 'primary',
        },
      }

    case 'VERTICAL_SEGMENT':
      return {
        id: uuidv4(),
        $verticalSegment: {
          levelChange: 1,
          side: 'RIGHT',
          stops: [],
        },
      }

    case 'PARALLEL_BRANCHES':
      return {
        id: uuidv4(),
        $parallelBranches: {
          alignement: 'LEFT',
          sections: [
            createForkSection(1),
            createForkSection(-1),
          ],
        },
      }
  }
}


interface OneWayLoopToolElement {
  label: string
  icon: string
  type: 'ONE_WAY_LOOP'
}

const oneWayLoopElements = ref<OneWayLoopToolElement[]>([
  {
    label: 'ui.map_editor.toolbox.loop',
    icon: 'i-bulb-u-turn',
    type: 'ONE_WAY_LOOP',
  },
])

const { grab, release } = useElementGrabbing()

function cloneOneWayLoop(): OneWayLoop {
  return {
    id: uuidv4(),
    $oneWayLoop: {
      size: 6,
      direction: 'RIGHT',
      position: 'TOP',
    },
  }
}

function onOneWayLoopStart(
  event: DraggableEvent<OneWayLoopToolElement>,
) {
  grab(event.data.type)
}
</script>

<template>
  <div class="toolbox-section">
    <VueDraggable
      v-model="elements"
      class="draggable-elements"
      :group="{ name: 'sectionElements', pull: 'clone', put: false }"
      :clone="clone"
      :sort="false"
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
          <SectionElement
            dummy
            :model-value="clone(element)"
          />
        </div>
      </div>
    </VueDraggable>

    <VueDraggable
      v-model="oneWayLoopElements"
      class="draggable-elements one-way-loop-tools"
      :group="{
        name: 'branchElements',
        pull: 'clone',
        put: false,
      }"
      :clone="cloneOneWayLoop"
      :sort="false"
      @start="e => onOneWayLoopStart(e as DraggableEvent<OneWayLoopToolElement>)"
      @end="release()"
    >
      <div
        v-for="element in oneWayLoopElements"
        :key="element.label"
        class="toolbox-item"
      >
        <div class="item hidden">
          <div class="flex flex-col items-center">
            <i :class="element.icon" />
            <span>{{ $t(element.label) }}</span>
          </div>
        </div>
      </div>
    </VueDraggable>
  </div>
</template>

<style scoped lang="scss">
.toolbox-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;
}

.draggable-elements {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;
}

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
</style>