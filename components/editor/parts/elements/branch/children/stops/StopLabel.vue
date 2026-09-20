<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useProject } from '~/stores/useProject'
import { LineContextKey } from '~/utils/symbols'

const props = defineProps<{
  value: string
  placeName: string | null
  subtitle: string | null
  preventSubtitleOverlapping: boolean
  interestPoint?: boolean
  terminus?: boolean
  future?: boolean
  reverse: boolean
  accessible: boolean | 'undefined' | undefined
  nameStyle?: StopNameStyle
  terminusArrow?: boolean
  terminusArrowText?: string | null
  branchStart?: boolean
}>()

const lineContext = inject<LineContext>(LineContextKey)!

const { line } = storeToRefs(useProject())

const formatStyle = computed<FormatStyle>(() =>
  line.value.formatStyle ?? 'RATP',
)

const isTramMode = computed(() =>
  line.value.mode === 'TRAM',
)

/*
 * Cartouche de terminus.
 *
 * Rendu classique :
 * - uniquement si l'option de cartouche est activée ;
 * - uniquement en style RATP.
 *
 * Rendu TRAM :
 * - les terminus utilisent toujours le cartouche,
 *   comme sur le plan Tram de référence.
 */
const useTerminusFrame = computed(() =>
  props.terminus === true
  && (
    isTramMode.value
    || (
      lineContext.frameTerminusNames.value
      && (
        formatStyle.value === 'RATP'
        || formatStyle.value === 'SNCF'
      )
    )
  ),
)
</script>

<template>
  <StopTerminusLabel
    v-if="useTerminusFrame"
    :value="props.value"
    :place-name="props.placeName"
    :subtitle="props.subtitle"
    :interest-point="props.interestPoint"
    :accessible="props.accessible"
    :reverse="props.reverse"
    :future="props.future"
    :name-style="props.nameStyle"
    :terminus-arrow="props.terminusArrow"
    :terminus-arrow-text="props.terminusArrowText"
    :branch-start="props.branchStart"
  />

  <StopRegularLabel
    v-else
    :value="props.value"
    :place-name="props.placeName"
    :subtitle="props.subtitle"
    :interest-point="props.interestPoint"
    :accessible="props.accessible"
    :reverse="props.reverse"
    :future="props.future"
    :terminus="props.terminus"
    :name-style="props.nameStyle"
    :prevent-subtitle-overlapping="preventSubtitleOverlapping"
  />
</template>