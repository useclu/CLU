<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import {
  computed,
  onUnmounted,
  ref,
} from 'vue'
import AnnotationPropertiesDialog from '~/components/editor/dialogs/AnnotationPropertiesDialog.vue'
import VerticalSegmentPropertiesDialog from '~/components/editor/dialogs/VerticalSegmentPropertiesDialog.vue'
import VerticalSegment from '~/components/editor/parts/elements/sections/children/VerticalSegment.vue'
import {
  isAnnotation,
  isBranch,
  isFork,
  isLoop,
  isParallelBranches,
  isVerticalSegment,
} from '~/utils/types'

const {
  fluid = false,
  dummy = false,
  forkOverlayOffsetPx = 0,
  forkOverlayCompensationPx = 0,
} = defineProps<{
  fluid?: boolean
  dummy?: boolean
  forkOverlayOffsetPx?: number
  forkOverlayCompensationPx?: number
}>()

const emit = defineEmits<{
  forkExtentChange: [
    elementId: string,
    width: number,
  ]
  forkClearanceChange: [
    elementId: string,
    up: number,
    down: number,
  ]
}>()

const element = defineModel<LineElement>({ required: true })
const showPropertiesDialog = ref(false)

const el = ref()
const hoverDialog = useElementHover(el)

const annotationEl = ref<HTMLElement | null>(null)
const draggingAnnotation = ref(false)

let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0
let annotationEmSize = 16
let suppressNextClick = false

const sectionElementKind = computed(() => {
  if (isBranch(element.value)) {
    return 'BRANCH'
  }

  if (isFork(element.value)) {
    return 'FORK'
  }

  if (isParallelBranches(element.value)) {
    return 'PARALLEL_BRANCHES'
  }

  if (isVerticalSegment(element.value)) {
    return 'VERTICAL_SEGMENT'
  }

  if (isLoop(element.value)) {
    return 'LOOP'
  }

  if (isAnnotation(element.value)) {
    return 'ANNOTATION'
  }

  return 'UNKNOWN'
})

const zIndex = computed(() => {
  if (
    isLoop(element.value)
    || isFork(element.value)
    || isVerticalSegment(element.value)
  ) {
    return 0
  }

  if (
    isBranch(element.value)
    || isParallelBranches(element.value)
  ) {
    return 1
  }

  if (isAnnotation(element.value)) {
    return 2
  }

  return 0
})

const annotationStyle = computed(() => {
  if (!isAnnotation(element.value)) {
    return {}
  }

  const annotation = element.value.$annotation

  return {
    color:
      annotation.color
      ?? 'var(--blue-ratp-paper)',
    fontSize:
      `${annotation.fontSize}em`,
    fontWeight:
      annotation.bold ? 'bold' : 'normal',
    fontStyle:
      annotation.italic ? 'italic' : 'normal',
    textDecoration:
      annotation.underline ? 'underline' : 'none',
    textAlign:
      annotation.alignment.toLowerCase(),
    transform:
      `translate(${annotation.offsetX}em, ${annotation.offsetY}em)`,
  }
})

type BranchWithPassthrough =
  Branch['$branch'] & {
    passthroughLineIds?: string[]
  }

function stopExplicitlyUsesLine(
  currentBranch: Branch,
  lineId: string,
) {
  return (
    currentBranch.$branch.elements
    ?? []
  ).some((child) => {
    if (!('$stop' in child)) {
      return false
    }

    const ids =
      (
        child.$stop as Stop['$stop'] & {
          lineIds?: string[]
        }
      ).lineIds

    return Boolean(
      ids?.includes(lineId),
    )
  })
}

/*
 * Certaines sorties multi-lignes servent uniquement de conteneur
 * logique pour une ligne passthrough. Tant qu'aucun Stop ne l'utilise,
 * Branch.vue ne dessine volontairement aucun rail.
 *
 * L'ancien SectionElement restait pourtant large et cliquable : on
 * obtenait alors une grande zone vide ouvrant "Propriétés de la
 * branche" entre la Fork et son vrai ParallelBranches.
 *
 * On collapse uniquement CES Branch totalement invisibles. Dès qu'une
 * ligne devient réellement visible, le SectionElement retrouve
 * automatiquement son comportement normal.
 */
const branchIsFullyInvisible =
  computed(() => {
    if (!isBranch(element.value)) {
      return false
    }

    const currentBranch =
      element.value

    const data =
      currentBranch.$branch as BranchWithPassthrough

    const passthrough =
      new Set(
        data.passthroughLineIds
        ?? [],
      )

    const primaryVisible =
      currentBranch.$branch.primaryLineVisible
      !== false
      && (
        !passthrough.has('primary')
        || stopExplicitlyUsesLine(
          currentBranch,
          'primary',
        )
      )

    if (primaryVisible) {
      return false
    }

    const additionalVisible =
      (
        currentBranch.$branch.additionalLines
        ?? []
      ).some(
        line =>
          !passthrough.has(line.id)
          || stopExplicitlyUsesLine(
            currentBranch,
            line.id,
          ),
      )

    return !additionalVisible
  })

function onElementClick() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }

  showPropertiesDialog.value = true
}

function startAnnotationDrag(
  event: PointerEvent,
) {
  if (
    dummy
    || !isAnnotation(element.value)
  ) {
    return
  }

  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  dragStartX = event.clientX
  dragStartY = event.clientY

  dragStartOffsetX =
    element.value.$annotation.offsetX

  dragStartOffsetY =
    element.value.$annotation.offsetY

  if (annotationEl.value) {
    annotationEmSize =
      Number.parseFloat(
        window
          .getComputedStyle(annotationEl.value)
          .fontSize,
      ) || 16
  }

  draggingAnnotation.value = false

  window.addEventListener(
    'pointermove',
    moveAnnotation,
  )

  window.addEventListener(
    'pointerup',
    stopAnnotationDrag,
  )
}

function moveAnnotation(
  event: PointerEvent,
) {
  if (!isAnnotation(element.value)) {
    return
  }

  const deltaX =
    event.clientX - dragStartX

  const deltaY =
    event.clientY - dragStartY

  if (
    !draggingAnnotation.value
    && Math.hypot(deltaX, deltaY) < 3
  ) {
    return
  }

  draggingAnnotation.value = true

  element.value.$annotation.offsetX =
    dragStartOffsetX
    + deltaX / annotationEmSize

  element.value.$annotation.offsetY =
    dragStartOffsetY
    + deltaY / annotationEmSize
}

function stopAnnotationDrag() {
  if (draggingAnnotation.value) {
    suppressNextClick = true
  }

  draggingAnnotation.value = false

  window.removeEventListener(
    'pointermove',
    moveAnnotation,
  )

  window.removeEventListener(
    'pointerup',
    stopAnnotationDrag,
  )
}

onUnmounted(() => {
  window.removeEventListener(
    'pointermove',
    moveAnnotation,
  )

  window.removeEventListener(
    'pointerup',
    stopAnnotationDrag,
  )
})
</script>

<template>
  <div
    class="section-element dynamic-part"
    :data-section-element-id="element.id"
    :data-section-element-kind="sectionElementKind"
    :class="{
      fluid,
      'fully-invisible-branch':
        branchIsFullyInvisible,
    }"
    :style="{ zIndex }"
    @click="onElementClick"
    @click.stop
  >
    <div class="flex-grow flex flex-col justify-center items-center h-full w-full">
      <div
        class="content flex items-center w-full"
        :class="{
          emphasis:
            hoverDialog
            && showPropertiesDialog
            && false,
        }"
      >
        <Branch
          v-if="isBranch(element)"
          v-model="element"
          :fluid="fluid"
        />

        <Fork
          v-else-if="isFork(element)"
          :meta="element"
          :overlay-offset-px="forkOverlayOffsetPx"
          :overlay-compensation-px="
            forkOverlayCompensationPx
          "
          @extent-change="
            width =>
              emit(
                'forkExtentChange',
                element.id,
                width,
              )
          "
          @clearance-change="
            (up, down) =>
              emit(
                'forkClearanceChange',
                element.id,
                up,
                down,
              )
          "
        />

        <VerticalSegment
          v-else-if="isVerticalSegment(element)"
          v-model="element"
        />

        <Loop
          v-else-if="isLoop(element)"
          :meta="element"
        />

        <ParallelBranches
          v-else-if="isParallelBranches(element)"
          v-model="element"
        />

        <div
          v-else-if="isAnnotation(element)"
          ref="annotationEl"
          class="annotation-wrapper dynamic-part"
          :class="{
            dragging: draggingAnnotation,
          }"
          :style="annotationStyle"
        >
          <button
            v-if="!dummy"
            type="button"
            class="annotation-move-handle"
            :title="$t('ui.map_editor.free_move')"
            @pointerdown="startAnnotationDrag"
            @click.stop
          >
            <i class="i-tabler-arrows-move" />
          </button>

          <div class="annotation-text">
            {{ element.$annotation.text }}
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="!dummy"
        ref="el"
      >
        <BranchPropertiesDialog
          v-if="isBranch(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />

        <ForkPropertiesDialog
          v-if="isFork(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />

        <VerticalSegmentPropertiesDialog
          v-if="isVerticalSegment(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />

        <LoopPropertiesDialog
          v-if="isLoop(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />

        <ParallelBranchesPropertiesDialog
          v-if="isParallelBranches(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />

        <AnnotationPropertiesDialog
          v-if="isAnnotation(element)"
          v-model="element"
          v-model:visible="showPropertiesDialog"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.section-element {
  min-width: 1em;
  user-select: none;
  transition: background-color .2s ease;
  border-radius: .25em;
  cursor: grab;

  &.fully-invisible-branch {
    min-width: 0;
    width: 0;
    flex: 0 0 0;
    pointer-events: none;
    overflow: visible;
    background: transparent !important;
  }

  &:active {
    cursor: grabbing;
  }

  &:hover:not(&:has(.dynamic-part:hover)) {
    background-color: var(--p-slate-100);
  }

  &.fluid {
    flex-grow: 1;
  }

  .title {
    padding: .25em .5em;
    color: var(--p-slate-400);
  }
}

.content {
  transition: outline-color .2s ease;
  outline: 3px solid transparent;
  outline-offset: .25em;
  border-radius: .125rem;

  &.emphasis {
    outline-color: var(--p-primary-500);
    z-index: 100;
  }
}

.annotation-wrapper {
  position: relative;
  min-width: max-content;
  white-space: pre-wrap;
  line-height: 1.1;
  padding: .25em .375em;
  cursor: pointer;

  &:hover .annotation-move-handle {
    opacity: 1;
    pointer-events: auto;
  }

  &.dragging .annotation-move-handle {
    opacity: 1;
    cursor: grabbing;
  }
}

.annotation-text {
  min-width: max-content;
}

.annotation-move-handle {
  position: absolute;
  top: -1.5em;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.35em;
  height: 1.35em;
  padding: 0;
  border: 1px solid var(--p-slate-300);
  border-radius: .25em;
  background-color: white;
  color: var(--p-slate-600);
  font-size: .75em;
  cursor: move;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity .15s ease,
    background-color .15s ease;
  z-index: 10;

  &:hover {
    background-color: var(--p-slate-100);
  }

  i {
    display: block;
  }
}
</style>