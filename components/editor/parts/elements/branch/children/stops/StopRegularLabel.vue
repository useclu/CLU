<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { useProject } from '~/stores/useProject'
import { StopContextKey } from '~/utils/symbols'
import { goesBelowLine } from '~/utils/text'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const {
  value,
  preventSubtitleOverlapping,
  subtitle = '',
  interestPoint = false,
  accessible = 'undefined',
  reverse = false,
  future = false,
  terminus = false,
  nameStyle,
} = defineProps<{
  value: string
  preventSubtitleOverlapping: boolean
  placeName: string | null
  subtitle?: string | null
  accessible?: boolean | 'undefined' | undefined
  interestPoint?: boolean
  reverse?: boolean
  future?: boolean
  terminus?: boolean
  nameStyle?: StopNameStyle
}>()

const stopContext = inject<StopContext>(StopContextKey)!

const project = useProject()

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

const valueParts = computed(() =>
  value
    .split('\n')
    .filter(part => part.trim() !== ''),
)

const isMultiline = computed(() =>
  valueParts.value.length > 1,
)

const shift = computed(() => {
  if (valueParts.value.length === 0) {
    return false
  }

  return (
    goesBelowLine(
      valueParts.value[valueParts.value.length - 1],
    )
    && preventSubtitleOverlapping
  )
})

watch(
  [
    shift,
    () => interestPoint,
    () => subtitle,
    isTramMode,
  ],
  ([
    _shift,
    _interestPoint,
    _subtitle,
    _isTramMode,
  ]) => {
    if (_isTramMode) {
      stopContext.margins.rightMargin.subtitle = '0em'
      return
    }

    let margin = 1

    if (_shift) {
      margin += 0.25
    }

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
</script>

<template>
  <div
    class="regular-label"
    :class="{
      reverse,
      future,
      'tram-mode': isTramMode,
      'tram-horizontal': isTramHorizontal,
      'tram-angled': isTramAngled,
      'tram-multiline': isMultiline,
      'opacity-50 export-hide': valueParts.length === 0,
    }"
  >
    <!--
      ======================================================
      TRAMWAY
      ======================================================
    -->
    <div
      v-if="isTramMode && valueParts.length > 0"
      class="tram-label-wrapper"
    >
      <TiltedText
        :reverse="reverse"
      >
        <div class="tram-title-holder">
          <div
            v-for="(part, index) in valueParts"
            :key="`${part}-${index}`"
            class="tram-title-line"
          >
            <TitleLabel
              :value="part"
              :name-style="nameStyle"
              :terminus="terminus"
            />

            <Wheelchair
              v-if="
                index === valueParts.length - 1
                  && accessible !== 'undefined'
              "
              class="tram-wheelchair"
              :off="!accessible"
            />
          </div>

          <div
            v-if="subtitle"
            class="tram-subtitle"
            :class="{
              'interest-point': interestPoint,
            }"
          >
            <StopSubtitle
              :interest-point="interestPoint"
              :value="subtitle"
            />
          </div>
        </div>
      </TiltedText>
    </div>

    <!--
      ======================================================
      RENDU CLASSIQUE
      ======================================================
    -->
    <div
      v-else
      class="flex gap-1em"
    >
      <TiltedText
        v-for="(part, index) in valueParts"
        :key="`${part}-${index}`"
        :reverse="reverse"
      >
        <div class="title-holder">
          <TitleLabel
            :value="part"
            :name-style="nameStyle"
            :terminus="terminus"
          />

          <Wheelchair
            v-if="
              index === valueParts.length - 1
                && accessible !== 'undefined'
            "
            :off="!accessible"
          />
        </div>
      </TiltedText>

      <TiltedText
        v-if="valueParts.length === 0"
        :reverse="reverse"
      >
        <TitleLabel
          :value="$t('ui.map_editor.toolbox.untitled_stop')"
          :name-style="nameStyle"
          :terminus="terminus"
        />
      </TiltedText>
    </div>

    <!--
      ======================================================
      SOUS-TITRE CLASSIQUE
      ======================================================
    -->
    <div
      v-if="!isTramMode && subtitle"
      class="subtitle-holder"
      :class="{
        'interest-point': interestPoint,
        shift,
      }"
    >
      <TiltedText :reverse="reverse">
        <StopSubtitle
          :interest-point="interestPoint"
          :value="subtitle"
        />
      </TiltedText>
    </div>
  </div>
</template>

<style scoped lang="scss">
.regular-label {
  position: relative;

  display: flex;
  flex-direction: row;
  align-items: end;
  justify-content: center;

  min-width: 1em;
  height: 0;

  transition:
    opacity .2s ease,
    filter .2s ease;

  &.future {
    opacity: .55;
  }
}

/*
 * =========================================================
 * RENDU CLASSIQUE
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

.tram-label-wrapper {
  display: flex;

  width: 0;

  justify-content: center;
  align-items: flex-end;
}

.tram-title-holder {
  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: flex-end;

  width: max-content;

  gap: .08em;
}

.tram-title-line {
  display: flex;
  flex-direction: row;

  align-items: center;
  justify-content: center;

  width: max-content;

  gap: .25em;
}

/*
 * =========================================================
 * PMR TRAMWAY
 * =========================================================
 */

.tram-wheelchair {
  position: relative;

  top: -.06em;

  flex-shrink: 0;
}

/*
 * =========================================================
 * SOUS-TITRE TRAMWAY
 * =========================================================
 */

.tram-subtitle {
  display: flex;

  width: max-content;

  align-items: center;
  justify-content: center;

  margin-top: .12em;

  line-height: 1;
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL — UNE LIGNE
 * =========================================================
 */

.regular-label.tram-horizontal {
  width: max-content;
  min-width: max-content;

  .tram-label-wrapper {
    width: max-content;
    min-width: max-content;

    transform:
      translateY(-1.02em);
  }

  .tram-title-holder {
    align-items: center;

    gap: .08em;
  }

  .tram-title-line {
    justify-content: center;
  }

  .tram-subtitle {
    justify-content: center;

    margin-top: .14em;
  }

  .tram-wheelchair {
    top: -.06em;
  }
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL — PLUSIEURS LIGNES
 * =========================================================
 *
 * Ici on ne déplace plus artificiellement
 * uniquement la seconde ligne.
 *
 * Chaque ligne possède désormais une vraie hauteur.
 *
 * Le navigateur réserve donc réellement :
 *
 * Couilly–Saint-Germain
 *
 * Quincy
 *
 * au lieu de laisser leurs boîtes se chevaucher.
 */

.regular-label.tram-horizontal.tram-multiline {
  .tram-label-wrapper {
    transform:
      translateY(-2.50em);
  }

  .tram-title-holder {
    gap: .12em;
  }

  /*
   * C'est la correction principale.
   *
   * Chaque ligne possède une vraie hauteur minimale,
   * au lieu de dépendre uniquement de la hauteur
   * interne de Typography / TitleLabel.
   */
  .tram-title-line {
    min-height: 1.18em;

    line-height: 1.18em;

    align-items: center;
  }

  /*
   * La première ligne reste naturelle.
   */
  .tram-title-line:first-child {
    margin-bottom: 0;
  }

  /*
   * Les lignes suivantes ont une petite respiration
   * supplémentaire.
   */
  .tram-title-line + .tram-title-line {
    margin-top: .08em;
  }
}

/*
 * =========================================================
 * TRAMWAY INCLINÉ
 * =========================================================
 */

.regular-label.tram-angled {
  .tram-label-wrapper {
    width: 0;

    transform:
      translateY(-.22em);
  }

  .tram-title-holder {
    align-items: flex-start;

    gap: .14em;
  }

  .tram-title-line {
    justify-content: flex-start;

    /*
     * Une petite hauteur réelle aide aussi
     * les noms inclinés multilignes.
     */
    min-height: 1.05em;
  }

  .tram-subtitle {
    justify-content: flex-start;

    margin-top: .13em;
  }

  /*
   * Le PMR incliné reste comme validé.
   */
  .tram-wheelchair {
    top: -.06em;
  }
}

/*
 * =========================================================
 * ARRÊT INVERSÉ
 * =========================================================
 */

.regular-label.tram-mode.reverse {
  .tram-title-holder {
    flex-direction: column;
  }

  .tram-title-line {
    flex-direction: row-reverse;
  }
}

/*
 * =========================================================
 * SOUS-TITRE CLASSIQUE
 * =========================================================
 */

.subtitle-holder {
  --initial: 0em;
  --interest-point: 0em;
  --shift: 0em;

  transform:
    translate(
      calc(
        var(--initial)
        + var(--interest-point)
        + var(--shift)
      ),
      -.125em
    );

  width: 0;

  .reverse & {
    --initial: 0.5625em;

    transform:
      translate(
        calc(
          var(--initial)
          + var(--interest-point)
          + var(--shift)
        ),
        .25em
      );
  }

  &.shift {
    --shift: .25em;
  }

  &.interest-point {
    --interest-point: .5em;

    .reverse & {
      --interest-point: 0em;
    }
  }
}
</style>