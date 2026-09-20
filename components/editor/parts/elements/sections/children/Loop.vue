<script setup lang="ts">
import { useCssVar } from '@vueuse/core'
import { computed, inject, ref } from 'vue'
import { LineContextKey } from '~/utils/symbols'

const {
  meta,
  embedded = false,
} = defineProps<{
  meta: Loop
  /**
   * Dans une Branch, le demi-tour fait partie de la séquence locale.
   * Ses niveaux doivent modifier son ouverture, sans appliquer la
   * translation absolue utilisée par l'ancien élément de Section.
   */
  embedded?: boolean
}>()

const el = ref()
const sizeFactor = useCssVar('--base-size', el)

const CLEARANCE = 16
const SIZE = 16 * Number.parseFloat(sizeFactor.value ?? '1')

const lineContext = inject<LineContext>(LineContextKey)!
const color = computed(() => lineContext?.color.value ?? '#000000')
const lineWidth = computed(() => lineContext.lineThickness.value)

const LEVEL_SPACING = 2.75 * SIZE

/*
 * Dans une branche, les deux champs du demi-tour représentent deux
 * distances indépendantes autour du rail principal :
 *   - section 1 = partie haute ;
 *   - section 2 = partie basse.
 *
 * On utilise donc leur valeur absolue. Ainsi, faire passer la section 2
 * de -1 à 1 ne peut plus ramener les deux liaisons au même niveau et
 * faire disparaître graphiquement le demi-tour.
 *
 * Hors mode `embedded`, on conserve strictement le calcul historique :
 * les valeurs restent des niveaux absolus de LineSection.
 */
const embeddedTopDistance = computed(() =>
  Math.abs(Number(meta.$loop.linksOffsets[0]) || 0) * LEVEL_SPACING,
)
const embeddedBottomDistance = computed(() =>
  Math.abs(Number(meta.$loop.linksOffsets[1]) || 0) * LEVEL_SPACING,
)

const strokeHeight = computed(() => SIZE * lineWidth.value)

const height = computed(() => {
  if (embedded) {
    return embeddedTopDistance.value
      + embeddedBottomDistance.value
      + strokeHeight.value
  }

  return Math.abs(
    meta.$loop.linksOffsets[0]
    - meta.$loop.linksOffsets[1],
  ) * LEVEL_SPACING + strokeHeight.value
})

const width = computed(() => (height.value / 2) + lineWidth.value + CLEARANCE)

const orientation = computed(() => {
  switch (meta.$loop.toward) {
    case 'LEFT':
      return [1, 0, 1]
    case 'RIGHT':
      return [0, width.value, -1]
  }
  return [0, 0]
})

const lowestOffset = computed(() => Math.min(meta.$loop.linksOffsets[0], meta.$loop.linksOffsets[1]))
const highestOffset = computed(() => Math.max(meta.$loop.linksOffsets[0], meta.$loop.linksOffsets[1]))
const globalOffset = computed(() => (lowestOffset.value + highestOffset.value) / 2)

/*
 * Le composant est centré sur le rail de la branche par le flex parent.
 * Si les hauteurs haut/bas sont différentes, on décale seulement le SVG
 * pour garder le rail à y=0 : le haut reste à -section1 et le bas à
 * +section2. Aucun des deux réglages ne déplace donc l'autre moitié.
 */
const wrapperOffset = computed(() => {
  if (embedded) {
    const shift = (
      embeddedBottomDistance.value
      - embeddedTopDistance.value
    ) / 2

    return `${shift}px`
  }

  return `calc(${globalOffset.value} * -2.75em)`
})

const path = computed(() => {
  const [arc, fromX, flip] = orientation.value

  let fromY: number
  let toY: number

  if (embedded) {
    const halfStroke = strokeHeight.value / 2
    fromY = halfStroke
    toY = height.value - halfStroke
  }
  else {
    fromY = offsetToY(meta.$loop.linksOffsets[0])
    toY = offsetToY(meta.$loop.linksOffsets[1])
  }

  return `M ${fromX} ${fromY} L ${fromX + (CLEARANCE * flip)} ${fromY} A 1 1 0 0 ${arc} ${fromX + (CLEARANCE * flip)} ${toY} L ${fromX} ${toY}`
})

function offsetToY(offset: number) {
  return height.value / 2
    - (offset - globalOffset.value) * LEVEL_SPACING
}
</script>

<template>
  <div ref="el" class="loop flex-shrink-0">
    <svg :width="`${width}px`" :height="`${height}px`">
      <SvgLine
        :path="path"
        :color="color"
        :line-width="lineWidth"
        :striped="lineContext.lineStyle.value === 'STRIPED'"
      />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.loop {
  transform: translateY(v-bind(wrapperOffset));
  z-index: 0;
}
</style>
