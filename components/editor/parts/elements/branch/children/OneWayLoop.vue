<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { LineContextKey } from '~/utils/symbols'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  branch: Branch
  reverse?: boolean
}>()

const loop = defineModel<OneWayLoop>({
  required: true,
})

const showPropertiesDialog = ref(false)
const lineContext = inject<LineContext>(LineContextKey)!

const loopSize = computed(() => {
  const value = Number(loop.value.$oneWayLoop.size)
  return Number.isFinite(value)
    ? Math.max(4, Math.min(18, value))
    : 6
})

const loopPosition = computed<'TOP' | 'BOTTOM'>(() =>
  loop.value.$oneWayLoop.position === 'BOTTOM'
    ? 'BOTTOM'
    : 'TOP',
)

const loopWidth = computed(() => `${loopSize.value}em`)
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
</script>

<template>
  <div
    v-bind="$attrs"
    class="one-way-loop-wrapper"
    :style="{
      '--one-way-loop-width': loopWidth,
      '--one-way-loop-color': color,
      '--one-way-loop-stroke': strokeWidth,
    }"
  >
    <div
      class="one-way-loop dynamic-part"
      :class="loopPosition === 'BOTTOM' ? 'placement-bottom' : 'placement-top'"
      role="button"
      tabindex="0"
      :aria-label="$t('ui.map_editor.toolbox.loop')"
      @click="(e: Event) => {
        e.stopPropagation()
        showPropertiesDialog = true
      }"
      @keydown.enter.prevent="showPropertiesDialog = true"
      @keydown.space.prevent="showPropertiesDialog = true"
    >
      <div class="one-way-loop-track branch-element-handle" />

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
  />
</template>

<style scoped lang="scss">
.one-way-loop-wrapper {
  position: relative;

  flex: 0 0 var(--one-way-loop-width);
  width: var(--one-way-loop-width);
  min-width: var(--one-way-loop-width);
  min-height: 5em;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: visible;
}

.one-way-loop {
  position: relative;

  width: 100%;
  height: 5em;

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
</style>
