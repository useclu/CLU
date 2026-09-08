<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import {
  computed,
  inject,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useProject } from '~/stores/useProject'
import { StopContextKey } from '~/utils/symbols'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const {
  value,
  placeName = '',
  subtitle = '',
  interestPoint = false,
  accessible = 'undefined',
  reverse = false,
  future = false,
  nameStyle,
} = defineProps<{
  value: string
  placeName?: string | null
  subtitle?: string | null
  interestPoint?: boolean
  reverse?: boolean
  accessible?: boolean | 'undefined' | undefined
  future?: boolean
  nameStyle?: StopNameStyle
}>()

const stopContext = inject<StopContext>(StopContextKey)!

const project = useProject()

const effectiveValue = computed(() =>
  value.trim(),
)

/*
 * =========================================================
 * NOM MULTILIGNE
 * =========================================================
 */

const valueParts = computed(() =>
  value
    .split('\n')
    .filter(part => part.trim() !== ''),
)

const isMultiline = computed(() =>
  valueParts.value.length > 1,
)

/*
 * =========================================================
 * TRAMWAY
 * =========================================================
 */

const isTramMode = computed(() =>
  project.line.mode === 'TRAM',
)

const tramStyle = computed<TramStyle>(() =>
  (
    project.line as Line & {
      tramStyle?: TramStyle
    }
  ).tramStyle
  ?? 'ANGLED',
)

const isTramHorizontal = computed(() =>
  isTramMode.value
  && tramStyle.value === 'HORIZONTAL',
)

const isTramAngled = computed(() =>
  isTramMode.value
  && tramStyle.value === 'ANGLED',
)

/*
 * =========================================================
 * POSITION DU TERMINUS TRAM
 * =========================================================
 *
 * On applique volontairement le déplacement directement
 * sur le wrapper avec :style.
 *
 * Cela évite qu'une autre règle CSS ne remplace
 * accidentellement la position du terminus.
 *
 * HORIZONTAL :
 * le déplacement est effectué sur
 * .tram-terminus-content plus bas.
 *
 * ANGLED 1 ligne :
 * -1.65em
 *
 * ANGLED plusieurs lignes :
 * -2.35em
 */
const tramWrapperStyle = computed(() => {
  if (!isTramMode.value) {
    return undefined
  }

  if (isTramHorizontal.value) {
    return {
      transform: 'none',
    }
  }

  if (isTramAngled.value) {
    return {
      transform:
        isMultiline.value
          ? 'translateY(-2.85em)'
          : 'translateY(-1.65em)',
    }
  }

  return undefined
})

const frame = ref<HTMLDivElement | null>(null)

const { stop } = useResizeObserver(
  frame,
  e => updateMargins(
    e[0].target as HTMLDivElement,
  ),
)

watch(
  stopContext.inverted,
  () => {
    if (frame.value) {
      updateMargins(frame.value)
    }
  },
)

watch(
  [
    () => interestPoint,
    () => subtitle,
    isTramMode,
  ],
  ([
    _interestPoint,
    _subtitle,
    _isTramMode,
  ]) => {
    /*
     * En Tram, le sous-titre est directement
     * intégré au bloc du terminus.
     */
    if (_isTramMode) {
      stopContext.margins.rightMargin.subtitle =
        '0em'

      return
    }

    let margin = 1

    if (_interestPoint) {
      margin += 0.5
    }

    if (_subtitle) {
      stopContext.margins.rightMargin.subtitle =
        `${margin}em`
    }
    else {
      stopContext.margins.rightMargin.subtitle =
        '0em'
    }
  },
  { immediate: true },
)

function updateMargins(element: HTMLElement) {
  /*
   * =======================================================
   * TRAMWAY HORIZONTAL
   * =======================================================
   *
   * La largeur réelle du cartouche participe
   * directement au layout.
   */
  if (isTramHorizontal.value) {
    stopContext.margins.leftMargin.name = '0px'
    stopContext.margins.rightMargin.name = '0px'

    return
  }

  const size = element.offsetHeight

  if (reverse) {
    stopContext.margins.rightMargin.name =
      `calc(${size * 2}px - 1.5em)`

    stopContext.margins.leftMargin.name =
      '0px'
  }
  else {
    stopContext.margins.leftMargin.name =
      `calc(${size * 2}px - 1.5em)`

    stopContext.margins.rightMargin.name =
      '0px'
  }
}

onUnmounted(() => {
  stop()

  stopContext.margins.rightMargin.name = '0px'
  stopContext.margins.leftMargin.name = '0px'
})
</script>

<template>
  <div
    class="terminus-label"
    :class="{
      reverse,
      future,
      'tram-mode': isTramMode,
      'tram-horizontal': isTramHorizontal,
      'tram-angled': isTramAngled,
      'tram-multiline': isMultiline,
    }"
    :style="tramWrapperStyle"
  >
    <!--
      ======================================================
      TRAMWAY
      ======================================================
    -->
    <TiltedText
      v-if="isTramMode"
      :reverse="reverse"
    >
      <div
        ref="frame"
        class="tram-terminus-content"
        :class="{
          'opacity-50 export-hide':
            !effectiveValue,
        }"
      >
        <div class="title-holder">
          <TerminusLabel
            :value="
              effectiveValue
              || $t(
                'ui.map_editor.toolbox.untitled_stop',
              )
            "
            :place-name="placeName"
            :name-style="nameStyle"
          />

          <Wheelchair
            v-if="
              accessible !== 'undefined'
            "
            class="tram-terminus-wheelchair"
            :off="!accessible"
          />
        </div>

        <StopSubtitle
          v-if="subtitle"
          class="tram-terminus-subtitle"
          :interest-point="interestPoint"
          :value="subtitle"
        />
      </div>
    </TiltedText>

    <!--
      ======================================================
      RENDU CLASSIQUE
      ======================================================
    -->
    <template v-else>
      <TiltedText :reverse="reverse">
        <div
          ref="frame"
          class="flex flex-col items-end gap-1"
          :class="{
            'opacity-50 export-hide':
              !effectiveValue,
          }"
        >
          <div class="title-holder">
            <TerminusLabel
              :value="
                effectiveValue
                || $t(
                  'ui.map_editor.toolbox.untitled_stop',
                )
              "
              :place-name="placeName"
              :name-style="nameStyle"
            />

            <Wheelchair
              v-if="
                accessible !== 'undefined'
              "
              :off="!accessible"
            />
          </div>

          <StopSubtitle
            v-if="subtitle && reverse"
            :interest-point="interestPoint"
            :value="subtitle"
          />
        </div>
      </TiltedText>

      <TiltedText
        v-if="subtitle && !reverse"
        class="subtitle-holder"
        :class="{
          'interest-point': interestPoint,
        }"
      >
        <StopSubtitle
          :interest-point="interestPoint"
          :value="subtitle"
        />
      </TiltedText>
    </template>
  </div>
</template>

<style scoped lang="scss">
.terminus-label {
  display: flex;
  flex-direction: row;

  align-items: end;

  gap: .75em;

  transform:
    translateY(-.125em);

  width: 1em;
  height: 0;

  transition:
    opacity .2s ease,
    filter .2s ease;

  &.future {
    opacity: .55;
  }

  .reverse & {
    transform:
      translateY(.125em);
  }
}

/*
 * =========================================================
 * TITRE
 * =========================================================
 */

.title-holder {
  display: flex;
  flex-direction: row;

  align-items: center;

  gap: .25em;

  .reverse & {
    flex-direction: row-reverse;
  }
}

/*
 * =========================================================
 * TRAMWAY
 * =========================================================
 */

.tram-terminus-content {
  display: flex;
  flex-direction: column;

  align-items: center;

  width: max-content;

  gap: .18em;
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL — UNE LIGNE
 * =========================================================
 */

.terminus-label.tram-horizontal {
  width: max-content;
  min-width: max-content;

  .tram-terminus-content {
    width: max-content;
    min-width: max-content;

    transform:
      translateY(-1.15em);
  }

  .tram-terminus-subtitle {
    display: block;

    width: max-content;

    align-self: center;

    line-height: 1;
  }

  /*
   * PMR spécifique au cartouche Horizontal.
   */
  .tram-terminus-wheelchair {
    position: relative;

    top: -.38em;

    flex-shrink: 0;
  }
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL — PLUSIEURS LIGNES
 * =========================================================
 */

.terminus-label.tram-horizontal.tram-multiline {
  .tram-terminus-content {
    /*
     * Ton réglage multiligne horizontal actuel.
     */
    transform:
      translateY(-2.50em);
  }

  .tram-terminus-wheelchair {
    top: -.48em;
  }
}

/*
 * =========================================================
 * TRAMWAY INCLINÉ
 * =========================================================
 *
 * IMPORTANT :
 *
 * le déplacement vertical du wrapper Incliné n'est
 * PLUS défini ici.
 *
 * Il est maintenant appliqué directement par Vue
 * dans tramWrapperStyle.
 *
 * Ça permet de garantir :
 *
 * 1 ligne      -> -1.65em
 * plusieurs    -> -2.35em
 */

.terminus-label.tram-angled {
  width: 1em;

  .tram-terminus-content {
    align-items: flex-start;

    position: relative;

    top: 0;
  }

  .tram-terminus-subtitle {
    display: block;

    width: max-content;

    align-self: flex-start;

    line-height: 1;
  }
}

/*
 * =========================================================
 * SOUS-TITRE CLASSIQUE
 * =========================================================
 */

.subtitle-holder {
  --initial: -.75;
  --interest-point: 0;

  transform:
    translateX(
      calc(
        (
          var(--initial)
          + var(--interest-point)
        )
        * 1em
      )
    );

  width: 0;

  &.interest-point {
    --interest-point: .5;
  }
}
</style>