<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { LineContextKey } from '~/utils/symbols'

defineOptions({
  inheritAttrs: false,
})

const {
  branch,
} = defineProps<{
  branch: Branch
  reverse?: boolean
}>()

const loop = defineModel<OneWayLoop>({
  required: true,
})

const showPropertiesDialog = ref(false)
const lineContext = inject<LineContext>(LineContextKey)!

/*
 * Compatibilité avec les anciennes boucles :
 * - `stop`  = ancien prototype mono-arrêt ;
 * - `stops` = première version multi-arrêts sur la voie déviée.
 *
 * La nouvelle voie principale utilise `mainStops`, optionnel :
 * les anciens JSON restent donc lisibles sans migration globale.
 */
function ensureDetourStops() {
  const data = loop.value.$oneWayLoop

  if (!Array.isArray(data.stops)) {
    data.stops = data.stop
      ? [data.stop]
      : []
  }

  data.stop = undefined

  return data.stops
}

function ensureMainStops() {
  const data = loop.value.$oneWayLoop

  if (!Array.isArray(data.mainStops)) {
    data.mainStops = []
  }

  return data.mainStops
}

const detourStops = computed(() => ensureDetourStops())
const mainStops = computed(() => ensureMainStops())

const loopSize = computed(() => {
  const value = Number(loop.value.$oneWayLoop.size)
  return Number.isFinite(value)
    ? Math.max(4, Math.min(18, value))
    : 6
})

/*
 * Chaque côté peut avoir un nombre d'arrêts différent.
 * La largeur dépend donc du côté le plus chargé, sans imposer
 * de symétrie entre les deux parcours.
 */
const effectiveLoopSize = computed(() => {
  const maxStops = Math.max(
    detourStops.value.length,
    mainStops.value.length,
  )

  return Math.max(
    loopSize.value,
    maxStops > 0
      ? 5 + maxStops * 3
      : 0,
  )
})

const loopPosition = computed<'TOP' | 'BOTTOM'>(() =>
  loop.value.$oneWayLoop.position === 'BOTTOM'
    ? 'BOTTOM'
    : 'TOP',
)

const loopWidth = computed(() => `${effectiveLoopSize.value}em`)

/*
 * La hauteur reste déterministe : aucune mesure DOM, aucun observer.
 * On réserve simplement plus de place lorsqu'il y a des arrêts sur
 * les deux côtés afin d'éviter les collisions entre leurs libellés.
 */
const loopHeight = computed(() =>
  mainStops.value.length > 0 && detourStops.value.length > 0
    ? '7em'
    : '6em',
)

const color = computed(() => lineContext?.color.value ?? '#000000')
const lineWidth = computed(() =>
  Math.max(
    .18,
    Number(lineContext?.lineThickness.value ?? .375),
  ),
)
const strokeWidth = computed(() => `${lineWidth.value}em`)

function arrowClass(direction: 'LEFT' | 'RIGHT') {
  return direction === 'LEFT'
    ? 'i-tabler-arrow-left'
    : 'i-tabler-arrow-right'
}

const detourDirection = computed<'LEFT' | 'RIGHT'>(() =>
  loop.value.$oneWayLoop.direction === 'LEFT'
    ? 'LEFT'
    : 'RIGHT',
)

const mainDirection = computed<'LEFT' | 'RIGHT'>(() =>
  detourDirection.value === 'LEFT'
    ? 'RIGHT'
    : 'LEFT',
)

const detourArrowClass = computed(() =>
  arrowClass(detourDirection.value),
)

const mainArrowClass = computed(() =>
  arrowClass(mainDirection.value),
)

/*
 * La boucle n'est plus un rectangle CSS.
 * Un unique chemin SVG part du rail principal, s'en écarte avec
 * une courbe douce, suit la voie déviée puis fusionne naturellement.
 */
const detourPath = computed(() =>
  loopPosition.value === 'TOP'
    ? 'M 2 50 C 8 50 8 14 20 14 L 80 14 C 92 14 92 50 98 50'
    : 'M 2 50 C 8 50 8 86 20 86 L 80 86 C 92 86 92 50 98 50',
)

/*
 * Les arrêts laissent volontairement une zone libre au centre.
 * Les deux flèches restent ainsi réellement centrées sur leur voie,
 * même avec un nombre impair d'arrêts.
 */
function loopStopPosition(index: number, total: number) {
  if (total <= 0) return { left: '50%' }

  const leftCount = Math.ceil(total / 2)
  const isLeft = index < leftCount

  const groupIndex = isLeft
    ? index
    : index - leftCount
  const groupCount = isLeft
    ? leftCount
    : total - leftCount

  const start = isLeft ? 16 : 60
  const end = isLeft ? 40 : 84
  const position = groupCount <= 1
    ? (start + end) / 2
    : start + ((end - start) * groupIndex) / (groupCount - 1)

  return {
    left: `${position}%`,
  }
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="one-way-loop-wrapper"
    :style="{
      '--one-way-loop-width': loopWidth,
      '--one-way-loop-height': loopHeight,
      '--one-way-loop-color': color,
      '--one-way-loop-stroke': strokeWidth,
    }"
  >
    <div
      class="one-way-loop dynamic-part"
      :class="loopPosition === 'BOTTOM' ? 'placement-bottom' : 'placement-top'"
      role="button"
      tabindex="0"
      :aria-label="$t('ui.map_editor.toolbox.one_way_loop')"
      @click="(e: Event) => {
        e.stopPropagation()
        showPropertiesDialog = true
      }"
      @keydown.enter.prevent="showPropertiesDialog = true"
      @keydown.space.prevent="showPropertiesDialog = true"
    >
      <svg
        class="one-way-loop-track branch-element-handle"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          class="one-way-loop-detour-path"
          :d="detourPath"
        />
      </svg>

      <div
        v-if="detourStops.length > 0"
        class="one-way-loop-stops one-way-loop-stops-detour"
        @click.stop
        @pointerdown.stop
      >
        <div
          v-for="(stop, index) in detourStops"
          :key="stop.id"
          class="one-way-loop-stop-slot"
          :style="loopStopPosition(index, detourStops.length)"
        >
          <Stop
            v-model="detourStops[index]"
            class="one-way-loop-stop-render"
            :branch="branch"
            :reverse="loopPosition === 'BOTTOM'"
          />
        </div>
      </div>

      <div
        v-if="mainStops.length > 0"
        class="one-way-loop-stops one-way-loop-stops-main"
        @click.stop
        @pointerdown.stop
      >
        <div
          v-for="(stop, index) in mainStops"
          :key="stop.id"
          class="one-way-loop-stop-slot"
          :style="loopStopPosition(index, mainStops.length)"
        >
          <Stop
            v-model="mainStops[index]"
            class="one-way-loop-stop-render"
            :branch="branch"
            :reverse="loopPosition === 'TOP'"
          />
        </div>
      </div>

      <div class="one-way-loop-arrow one-way-loop-arrow-detour">
        <i :class="detourArrowClass" />
      </div>

      <div class="one-way-loop-arrow one-way-loop-arrow-main">
        <i :class="mainArrowClass" />
      </div>
    </div>
  </div>

  <OneWayLoopPropertiesDialog
    v-model:visible="showPropertiesDialog"
    v-model="loop"
    :branch="branch"
  />
</template>

<style scoped lang="scss">
.one-way-loop-wrapper {
  position: relative;

  flex: 0 0 var(--one-way-loop-width);
  width: var(--one-way-loop-width);
  min-width: var(--one-way-loop-width);
  height: var(--one-way-loop-height);
  min-height: var(--one-way-loop-height);

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: visible;

  transition:
    height .16s ease,
    min-height .16s ease,
    width .16s ease,
    min-width .16s ease;
}

.one-way-loop {
  position: relative;

  width: 100%;
  height: 100%;

  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &:hover::after,
  &:focus-visible::after {
    opacity: 1;
  }

  &::after {
    content: '';

    position: absolute;
    inset: .2em -.15em;

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
}

/*
 * Géométrie réelle du détour.
 * Le rail principal reste celui de Branch.vue à 50 %, tandis que le
 * SVG ne dessine que la partie qui se sépare puis revient sur ce rail.
 */
.one-way-loop-track {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;
  z-index: 2;
}

.one-way-loop-detour-path {
  fill: none;
  stroke: var(--one-way-loop-color);
  stroke-width: var(--one-way-loop-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.one-way-loop-stops {
  position: absolute;
  left: 0;
  right: 0;

  height: 0;

  z-index: 8;
}

.one-way-loop-stops-main {
  top: 50%;
}

.one-way-loop.placement-top .one-way-loop-stops-detour {
  top: 14%;
}

.one-way-loop.placement-bottom .one-way-loop-stops-detour {
  top: 86%;
}

.one-way-loop-stop-slot {
  position: absolute;
  top: 0;

  min-width: 2.2em;

  display: flex;
  align-items: center;
  justify-content: center;

  transform: translate(-50%, -50%);
}

:deep(.one-way-loop-stop-render) {
  margin: 0 !important;
  flex: 0 0 auto;
}

/*
 * Les flèches restent au centre géométrique de chaque parcours.
 * Les arrêts sont distribués autour d'elles : aucune flèche n'est
 * repoussée sur le côté lorsqu'un arrêt est ajouté.
 */
.one-way-loop-arrow {
  position: absolute;
  left: 50%;

  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.15em;
  height: 1.15em;

  border-radius: 999px;

  background: rgb(255 255 255 / 94%);
  color: #202020;

  font-size: .78em;
  line-height: 1;

  transform: translate(-50%, -50%);

  pointer-events: none;
  z-index: 10;
}

.one-way-loop-arrow-main {
  top: 50%;
}

.one-way-loop.placement-top .one-way-loop-arrow-detour {
  top: 14%;
}

.one-way-loop.placement-bottom .one-way-loop-arrow-detour {
  top: 86%;
}
</style>
