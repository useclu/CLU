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
      && formatStyle.value === 'RATP'
    )
  ),
)
</script>

<template>
  <StopTerminusLabel
    v-if="useTerminusFrame"
    v-bind="props"
  />

  <StopRegularLabel
    v-else
    v-bind="props"
    :prevent-subtitle-overlapping="preventSubtitleOverlapping"
  />
</template>