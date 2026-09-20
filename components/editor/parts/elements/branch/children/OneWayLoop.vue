<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
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
 * Compatibilité avec l'ancien prototype mono-arrêt.
 *
 * On normalise dès le rendu afin que l'ancien arrêt réapparaisse
 * automatiquement sur la voie déviée sans demander de migration.
 */
function ensureLoopStops() {
  const data = loop.value.$oneWayLoop

  if (!Array.isArray(data.stops)) {
    data.stops = data.stop
      ? [data.stop]
      : []
  }

  data.stop = undefined

  return data.stops
}

const loopStops = computed(() =>
  ensureLoopStops(),
)

const loopSize = computed(() => {
  const value = Number(loop.value.$oneWayLoop.size)
  return Number.isFinite(value)
    ? Math.max(4, Math.min(18, value))
    : 6
})

/*
 * Plusieurs arrêts ont besoin d'un minimum de largeur réelle.
 *
 * Le réglage manuel reste prioritaire tant qu'il est suffisant ;
 * au-delà, la boucle s'agrandit uniquement pour éviter que les points
 * d'arrêt ne se superposent.
 */
const effectiveLoopSize = computed(() =>
  Math.max(
    loopSize.value,
    loopStops.value.length > 0
      ? 5 + loopStops.value.length * 3
      : 0,
  ),
)

const loopPosition = computed<'TOP' | 'BOTTOM'>(() =>
  loop.value.$oneWayLoop.position === 'BOTTOM'
    ? 'BOTTOM'
    : 'TOP',
)

const loopWidth = computed(() => `${effectiveLoopSize.value}em`)
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

const detachedDirection = computed<'LEFT' | 'RIGHT'>(() =>
  loop.value.$oneWayLoop.direction === 'LEFT'
    ? 'LEFT'
    : 'RIGHT',
)

const mainDirection = computed<'LEFT' | 'RIGHT'>(() =>
  detachedDirection.value === 'LEFT'
    ? 'RIGHT'
    : 'LEFT',
)

const topArrowClass = computed(() =>
  arrowClass(
    loopPosition.value === 'TOP'
      ? detachedDirection.value
      : mainDirection.value,
  ),
)

const bottomArrowClass = computed(() =>
  arrowClass(
    loopPosition.value === 'BOTTOM'
      ? detachedDirection.value
      : mainDirection.value,
  ),
)

/*
 * =========================================================
 * DÉGAGEMENT AUTOMATIQUE DES CORRESPONDANCES
 * =========================================================
 *
 * La ligne principale de la Branch reste toujours à 50 %.
 * La voie déviée, elle, reste près du bord haut/bas de ce composant.
 *
 * Lorsqu'une correspondance devient plus haute, on mesure son débord
 * réel et on augmente la hauteur du composant. Le rail principal reste
 * donc au centre tandis que la voie déviée s'en éloigne automatiquement.
 * Aucun pictogramme de correspondance ne vient ainsi toucher le plan.
 */
const loopRoot = ref<HTMLElement | null>(null)
const dynamicHeightPx = ref<number | null>(null)

const loopHeight = computed(() =>
  dynamicHeightPx.value === null
    ? '5em'
    : `${dynamicHeightPx.value}px`,
)

let clearanceFrame: number | null = null
let mutationObserver: MutationObserver | null = null

function scheduleClearanceUpdate() {
  if (typeof window === 'undefined') {
    return
  }

  if (clearanceFrame !== null) {
    cancelAnimationFrame(clearanceFrame)
  }

  clearanceFrame = requestAnimationFrame(
    async () => {
      clearanceFrame = null
      await nextTick()
      updateClearance()
    },
  )
}

function updateClearance() {
  const root = loopRoot.value

  if (!root || loopStops.value.length === 0) {
    dynamicHeightPx.value = null
    return
  }

  const rootRect = root.getBoundingClientRect()
  const fontSize = Number.parseFloat(
    getComputedStyle(root).fontSize,
  ) || 16

  const baseHeight = fontSize * 5
  const safety = fontSize * .65

  const visibleParts = root.querySelectorAll<HTMLElement>(
    [
      '.one-way-loop-stop-render .names > *',
      '.one-way-loop-stop-render .dot',
      '.one-way-loop-stop-render .connections > div',
    ].join(', '),
  )

  if (visibleParts.length === 0) {
    dynamicHeightPx.value = baseHeight
    return
  }

  let targetHeight = baseHeight

  if (loopPosition.value === 'TOP') {
    let furthestBottom = rootRect.top

    visibleParts.forEach((part) => {
      const rect = part.getBoundingClientRect()
      furthestBottom = Math.max(
        furthestBottom,
        rect.bottom,
      )
    })

    const inwardExtent = Math.max(
      0,
      furthestBottom - rootRect.top,
    )

    targetHeight = Math.max(
      baseHeight,
      (inwardExtent + safety) * 2,
    )
  }
  else {
    let furthestTop = rootRect.bottom

    visibleParts.forEach((part) => {
      const rect = part.getBoundingClientRect()
      furthestTop = Math.min(
        furthestTop,
        rect.top,
      )
    })

    const inwardExtent = Math.max(
      0,
      rootRect.bottom - furthestTop,
    )

    targetHeight = Math.max(
      baseHeight,
      (inwardExtent + safety) * 2,
    )
  }

  const rounded = Math.ceil(targetHeight)

  if (
    dynamicHeightPx.value === null
    || Math.abs(dynamicHeightPx.value - rounded) > 1
  ) {
    dynamicHeightPx.value = rounded
  }
}

watch(
  loop,
  () => {
    scheduleClearanceUpdate()
  },
  {
    deep: true,
  },
)

watch(
  loopPosition,
  () => {
    dynamicHeightPx.value = null
    scheduleClearanceUpdate()
  },
)

onMounted(() => {
  scheduleClearanceUpdate()

  if (loopRoot.value) {
    mutationObserver = new MutationObserver(
      scheduleClearanceUpdate,
    )

    mutationObserver.observe(
      loopRoot.value,
      {
        subtree: true,
        childList: true,
        characterData: true,
      },
    )
  }

  window.addEventListener(
    'resize',
    scheduleClearanceUpdate,
  )
})

onBeforeUnmount(() => {
  mutationObserver?.disconnect()

  window.removeEventListener(
    'resize',
    scheduleClearanceUpdate,
  )

  if (clearanceFrame !== null) {
    cancelAnimationFrame(clearanceFrame)
  }
})
</script>

<template>
  <div
    ref="loopRoot"
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
      :class="[
        loopPosition === 'BOTTOM' ? 'placement-bottom' : 'placement-top',
        { 'has-stops': loopStops.length > 0 },
      ]"
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
      <div class="one-way-loop-track branch-element-handle" />

      <div
        v-if="loopStops.length > 0"
        class="one-way-loop-stops"
        @click.stop
        @pointerdown.stop
      >
        <div
          v-for="(stop, index) in loopStops"
          :key="stop.id"
          class="one-way-loop-stop-slot"
        >
          <Stop
            v-model="loopStops[index]"
            class="one-way-loop-stop-render"
            :branch="branch"
            :reverse="loopPosition === 'BOTTOM'"
          />
        </div>
      </div>

      <div class="one-way-loop-arrow one-way-loop-arrow-top">
        <i :class="topArrowClass" />
      </div>

      <div class="one-way-loop-arrow one-way-loop-arrow-bottom">
        <i :class="bottomArrowClass" />
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
 * La ligne principale de Branch.vue reste au centre du composant.
 * La boucle dessine uniquement le détour, au-dessus ou en dessous,
 * sans casser le rail principal.
 */
.one-way-loop-track {
  position: absolute;

  left: .45em;
  right: .45em;

  box-sizing: border-box;
  pointer-events: none;
  z-index: 2;
}

.one-way-loop.placement-top .one-way-loop-track {
  top: .55em;
  bottom: 50%;

  border-top: var(--one-way-loop-stroke) solid var(--one-way-loop-color);
  border-left: var(--one-way-loop-stroke) solid var(--one-way-loop-color);
  border-right: var(--one-way-loop-stroke) solid var(--one-way-loop-color);
  border-bottom: 0;

  border-radius: .75em .75em 0 0;
}

.one-way-loop.placement-bottom .one-way-loop-track {
  top: 50%;
  bottom: .55em;

  border-top: 0;
  border-left: var(--one-way-loop-stroke) solid var(--one-way-loop-color);
  border-right: var(--one-way-loop-stroke) solid var(--one-way-loop-color);
  border-bottom: var(--one-way-loop-stroke) solid var(--one-way-loop-color);

  border-radius: 0 0 .75em .75em;
}

/*
 * Les arrêts sont réellement posés sur la voie déviée.
 * Leur couche reste indépendante de la poignée de drag de la boucle :
 * cliquer/modifier un arrêt ne déplace donc pas accidentellement la boucle.
 */
.one-way-loop-stops {
  position: absolute;
  left: 1.1em;
  right: 1.1em;

  display: flex;
  align-items: center;
  justify-content: space-evenly;

  z-index: 8;
}

.one-way-loop.placement-top .one-way-loop-stops {
  top: .55em;
  transform: translateY(-50%);
}

.one-way-loop.placement-bottom .one-way-loop-stops {
  bottom: .55em;
  transform: translateY(50%);
}

.one-way-loop-stop-slot {
  min-width: 2.2em;
  flex: 1 1 0;

  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.one-way-loop-stop-render) {
  margin: 0 !important;
  flex: 0 0 auto;
}

.one-way-loop-arrow {
  position: absolute;

  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.1em;
  height: 1.1em;

  border-radius: .2em;

  background: rgb(255 255 255 / 88%);
  color: #202020;

  font-size: .72em;
  line-height: 1;

  pointer-events: none;
  z-index: 5;
}

.one-way-loop-arrow-top,
.one-way-loop-arrow-bottom {
  left: 50%;
  transform: translate(-50%, -50%);
}

.one-way-loop.placement-top .one-way-loop-arrow-top {
  top: .55em;
}

.one-way-loop.placement-top .one-way-loop-arrow-bottom {
  top: 50%;
}

.one-way-loop.placement-bottom .one-way-loop-arrow-top {
  top: 50%;
}

.one-way-loop.placement-bottom .one-way-loop-arrow-bottom {
  top: calc(100% - .55em);
}

/*
 * Avec des arrêts, la flèche de la voie déviée quitte le centre afin
 * de ne jamais recouvrir le point d'un arrêt placé au milieu.
 */
.one-way-loop.has-stops.placement-top .one-way-loop-arrow-top,
.one-way-loop.has-stops.placement-bottom .one-way-loop-arrow-bottom {
  left: auto;
  right: .65em;
  transform: translateY(-50%);
}
</style>
