<script setup lang="ts">
import { useCssVar } from '@vueuse/core'
import { computed, inject, ref } from 'vue'
import leftArrow from '~/assets/svg/left-arrow.svg'
import rightArrow from '~/assets/svg/right-arrow.svg'
import { LineContextKey } from '~/utils/symbols'

const {
  meta,
} = defineProps<{
  meta: Fork
}>()

const el = ref()

const sizeFactor = computed(() =>
  Number.parseInt(
    useCssVar('--base-size', el).value ?? '1',
  ),
)

const CLEARANCE = 48

const size = computed(() => 16 * sizeFactor.value)
const slopeWidth = computed(() => size.value * 4.75)

/*
 * Les LineSection déplacent leurs niveaux avec 2.75em.
 * Il faut donc utiliser ici la taille réelle du "em" du plan
 * pour la géométrie verticale de la fourche.
 *
 * --base-size reste utilisé pour la géométrie horizontale
 * historique de la fourche.
 */
const emSize = computed(() => {
  const value = Number.parseFloat(
    useCssVar('--font-size', el).value ?? '',
  )

  return Number.isFinite(value) && value > 0
    ? value
    : 16
})

const lineContext = inject<LineContext>(LineContextKey)!

const color = computed(() =>
  lineContext?.color.value ?? '#000000',
)

const lineWidth = computed(() => {
  const value = Number(lineContext.lineThickness.value)
  return Number.isFinite(value) && value > 0 ? value : 0.375
})

/*
 * L'épaisseur visuelle ne doit pas multiplier toute la géométrie de la fourche.
 * On ajoute seulement l'espace réellement nécessaire au trait plus épais.
 */
const strokeExtra = computed(() =>
  Math.max(0, lineWidth.value - 0.375) * size.value,
)

const effectiveClearance = computed(() =>
  CLEARANCE * sizeFactor.value
  + size.value
  + strokeExtra.value,
)

const forkStyle = computed<ForkStyle>(() =>
  meta.$fork.forkStyle ?? 'ORIGINAL',
)

const maxHeight = computed(() => {
  return (
    (meta.$fork.offsetMultiplier ?? 1)
    * Math.max(
      Math.abs(meta.$fork.linksOffset[0]),
      Math.abs(meta.$fork.linksOffset[1]),
    )
    * 2
    * 2.75
    * emSize.value
    + (size.value * lineWidth.value)
  )
})

const normalWidth = computed(() =>
  slopeWidth.value
  * (meta.$fork.offsetMultiplier ?? 1)
  + effectiveClearance.value * 2,
)

const orientation = computed(() => {
  switch (meta.$fork.toward) {
    case 'LEFT':
      return [
        normalWidth.value,
        0,
        -1,
      ]

    case 'RIGHT':
      return [
        0,
        normalWidth.value,
        1,
      ]

    default:
      return [
        0,
        0,
        0,
      ]
  }
})

/*
 * Le repère vertical de la fourche est toujours verrouillé
 * sur la ligne droite d'origine.
 *
 * Ainsi, changer la forme (symétrique / vers le haut /
 * vers le bas) ne déplace jamais la ligne principale :
 * seules les deux branches changent de niveau.
 */
const offset = computed(() =>
  meta.$fork.originOffset,
)

const wrapperOffset = computed(() =>
  `calc(${
    offset.value
    * (meta.$fork.offsetMultiplier ?? 1)
  } * -2.75em)`,
)

function getY(value: number) {
  /*
   * Un niveau de fourche doit correspondre exactement
   * à un levelOffset de LineSection.
   *
   * LineSection utilise 2.75em par niveau.
   * On convertit donc ici avec la taille réelle du em du plan.
   */
  return (
    maxHeight.value / 2
    - (
      value - offset.value
    )
    * 2.75
    * emSize.value
    * (meta.$fork.offsetMultiplier ?? 1)
  )
}

/*
 * Tracé historique de BULB.
 * On le conserve tel quel.
 */
function getOriginalPath(
  fromOffset: number,
  toOffset: number,
) {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return `
    M ${fromX} ${fromY}
    L ${fromX + effectiveClearance.value * flip} ${fromY}
    L ${toX - effectiveClearance.value * flip} ${toY}
    L ${toX} ${toY}
  `
}

/*
 * Nouvelle variante :
 *
 * une branche qui reste au même niveau
 * reste parfaitement droite.
 *
 * Une branche qui change de niveau utilise
 * deux raccords arrondis avec une partie verticale.
 */
function getRoundedPath(
  fromOffset: number,
  toOffset: number,
) {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  if (fromOffset === toOffset) {
    return `
      M ${fromX} ${fromY}
      L ${toX} ${toY}
    `
  }

  const startInnerX
    = fromX
      + effectiveClearance.value * flip

  const endInnerX
    = toX
      - effectiveClearance.value * flip

  const bendX
    = (startInnerX + endInnerX) / 2

  const horizontalDirection
    = Math.sign(endInnerX - startInnerX) || 1

  const verticalDirection
    = Math.sign(toY - fromY) || 1

  const horizontalSpace
    = Math.abs(endInnerX - startInnerX)

  const verticalSpace
    = Math.abs(toY - fromY)

  const radius = Math.min(
    size.value
    * 0.9
    * (meta.$fork.offsetMultiplier ?? 1),
    horizontalSpace / 4,
    verticalSpace / 2,
  )

  const beforeBendX
    = bendX
      - horizontalDirection * radius

  const afterBendX
    = bendX
      + horizontalDirection * radius

  const firstVerticalY
    = fromY
      + verticalDirection * radius

  const lastVerticalY
    = toY
      - verticalDirection * radius

  return `
    M ${fromX} ${fromY}

    L ${beforeBendX} ${fromY}

    Q
      ${bendX} ${fromY}
      ${bendX} ${firstVerticalY}

    L
      ${bendX}
      ${lastVerticalY}

    Q
      ${bendX} ${toY}
      ${afterBendX} ${toY}

    L ${toX} ${toY}
  `
}

function getPath(
  fromOffset: number,
  toOffset: number,
) {
  if (forkStyle.value === 'ROUNDED') {
    return getRoundedPath(
      fromOffset,
      toOffset,
    )
  }

  return getOriginalPath(
    fromOffset,
    toOffset,
  )
}

const path = computed(() => {
  return (
    getPath(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[0],
    )
    + getPath(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[1],
    )
  )
})

const arrow = computed(() => {
  if (meta.$fork.directionalArrows === 'CW') {
    return rightArrow
  }

  if (meta.$fork.directionalArrows === 'CCW') {
    return leftArrow
  }

  return null
})

/*
 * Position historique des flèches.
 */
function getOriginalMiddlePoint(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return [
    (
      (
        fromX
        + effectiveClearance.value * flip
      )
      + (
        toX
        - effectiveClearance.value * flip
      )
    ) / 2,

    (fromY + toY) / 2,
  ]
}

/*
 * Position des flèches sur la variante arrondie.
 */
function getRoundedArrowPosition(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  if (fromOffset === toOffset) {
    return [
      (fromX + toX) / 2,
      fromY,
    ]
  }

  const startInnerX
    = fromX
      + effectiveClearance.value * flip

  const endInnerX
    = toX
      - effectiveClearance.value * flip

  const bendX
    = (startInnerX + endInnerX) / 2

  const horizontalDirection
    = Math.sign(endInnerX - startInnerX) || 1

  const horizontalSpace
    = Math.abs(endInnerX - startInnerX)

  const verticalSpace
    = Math.abs(toY - fromY)

  const radius = Math.min(
    size.value
    * 0.9
    * (meta.$fork.offsetMultiplier ?? 1),
    horizontalSpace / 4,
    verticalSpace / 2,
  )

  const afterBendX
    = bendX
      + horizontalDirection * radius

  return [
    (afterBendX + toX) / 2,
    toY,
  ]
}

function getArrowPosition(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  if (forkStyle.value === 'ROUNDED') {
    return getRoundedArrowPosition(
      fromOffset,
      toOffset,
    )
  }

  return getOriginalMiddlePoint(
    fromOffset,
    toOffset,
  )
}

function getOriginalAngle(
  fromOffset: number,
  toOffset: number,
): number {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return Math.round(
    Math.atan2(
      toY - fromY,
      (
        toX
        - effectiveClearance.value * flip
      )
      - (
        fromX
        + effectiveClearance.value * flip
      ),
    )
    * 180
    / Math.PI,
  )
}

function getArrowAngle(
  fromOffset: number,
  toOffset: number,
): number {
  if (forkStyle.value === 'ROUNDED') {
    return 0
  }

  return getOriginalAngle(
    fromOffset,
    toOffset,
  )
}

const linkOffsetsArrowPositions = computed(() => {
  return [
    getArrowPosition(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[0],
    ),

    getArrowPosition(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[1],
    ),
  ]
})

const linkOffsetsArrowRotations = computed(() => {
  return [
    getArrowAngle(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[0],
    ),

    getArrowAngle(
      meta.$fork.originOffset,
      meta.$fork.linksOffset[1],
    ),
  ]
})
</script>

<template>
  <div
    ref="el"
    class="fork flex-shrink-0"
    :style="{
      width: `${normalWidth}px`,
    }"
  >
    <svg
      width="100%"
      :height="`${maxHeight}px`"
      overflow="visible"
    >
      <SvgLine
        :path="path"
        :color="color"
        :line-width="lineWidth"
        :striped="lineContext.lineStyle.value === 'STRIPED'"
      />

      <!--
        Flèche de la première branche.
      -->
      <g
        v-if="arrow !== null"
        :transform="`
          translate(
            ${linkOffsetsArrowPositions[0][0]}
            ${linkOffsetsArrowPositions[0][1]}
          )
        `"
      >
        <image
          :href="arrow"
          :transform="`
            rotate(
              ${
                linkOffsetsArrowRotations[0]
                + (
                  orientation[2] < 0
                    ? 180
                    : 0
                )
              }
            )
            translate(
              -29
              ${-22 - (lineWidth * 16)}
            )
            scale(.75)
          `"
        />
      </g>

      <!--
        Flèche de la seconde branche.
      -->
      <g
        v-if="arrow !== null"
        :transform="`
          translate(
            ${linkOffsetsArrowPositions[1][0]}
            ${linkOffsetsArrowPositions[1][1]}
          )
        `"
      >
        <image
          :href="arrow"
          :transform="`
            rotate(
              ${
                linkOffsetsArrowRotations[1]
                + (
                  orientation[2] > 0
                    ? 180
                    : 0
                )
              }
            )
            translate(
              -29
              ${-22 - (lineWidth * 16)}
            )
            scale(.75)
          `"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped lang="scss">
.fork {
  transform: translateY(v-bind(wrapperOffset));
  z-index: 1;
}
</style>