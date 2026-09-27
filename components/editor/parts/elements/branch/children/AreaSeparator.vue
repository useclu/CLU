<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProject } from '~/stores/useProject'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const areaSeparator = defineModel<AreaSeparator>({ required: true })

const showPropertiesDialog = ref(false)
const project = useProject()

const isBusAreaMode = computed(() =>
  project.line.mode === 'BUS'
  || project.line.mode === 'BRT'
  || project.line.mode === 'NOCTILIEN',
)

const tramStyle = computed<TramStyle>(() =>
  (
    project.line as Line & {
      tramStyle?: TramStyle
    }
  ).tramStyle
  ?? 'ANGLED',
)

const isAngledSeparatorStyle = computed(() =>
  !isBusAreaMode.value
  && (
    project.line.mode !== 'TRAM'
    || tramStyle.value === 'ANGLED'
  ),
)

const autoSpacing = computed(() => {
  if (isBusAreaMode.value) {
    return false
  }

  return areaSeparator.value.$areaSeparator.autoSpacing !== false
})

const spacing = computed(() => {
  const value = areaSeparator.value.$areaSeparator.spacing

  return typeof value === 'number' ? value : 3
})

const height = computed(() => {
  const value = areaSeparator.value.$areaSeparator.height

  return typeof value === 'number' ? value : 10
})

const separatorWidth = computed(() => {
  if (isBusAreaMode.value) {
    /*
     * La limite doit rester discrète et ne pas créer le grand
     * espace qui était utile à l'ancienne séparation verticale.
     */
    return '.8em'
  }

  if (!autoSpacing.value) {
    return '1em'
  }

  return `calc(1em + ${spacing.value * 2}em)`
})

const separatorHeight = computed(() => {
  if (isBusAreaMode.value) {
    return '4em'
  }

  return `${height.value}em`
})

/*
 * La partie haute est volontairement plus longue que la hauteur
 * configurée afin de dégager les noms d'arrêts inclinés et de
 * laisser de la place au libellé de ville au-dessus.
 */
const angledUpperLength = computed(() =>
  `${Math.max(0, height.value + 4)}em`,
)

const angledUpperOffset = computed(() =>
  `${Math.max(0, (height.value + 4) * Math.sin(Math.PI / 3))}em`,
)

function openProperties(event: Event) {
  event.stopPropagation()
  showPropertiesDialog.value = true
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="area-separator-wrapper"
    :class="{
      'bus-area-boundary': isBusAreaMode,
      'angled-area-separator': isAngledSeparatorStyle,
    }"
  >
    <div
      class="dynamic-part branch-element-handle area-separator"
      :class="{
        'bus-area-boundary-handle': isBusAreaMode,
        'angled-area-separator-handle': isAngledSeparatorStyle,
      }"
      :title="
        isBusAreaMode
          ? $t('ui.map_editor.toolbox.bus_area_boundary')
          : undefined
      "
      @click="openProperties"
    >
      <template v-if="isBusAreaMode">
        <span class="bus-area-boundary-tick export-hide" />
      </template>

      <template v-else>
        <div class="area-separator-labels">
          <div
            v-if="areaSeparator.$areaSeparator.cityName"
            class="area-separator-city"
          >
            {{ areaSeparator.$areaSeparator.cityName }}
          </div>

          <div
            v-if="areaSeparator.$areaSeparator.zoneName"
            class="area-separator-zone"
          >
            {{ areaSeparator.$areaSeparator.zoneName }}
          </div>
        </div>

        <template v-if="isAngledSeparatorStyle">
          <div class="area-separator-line area-separator-line-upper" />
          <div class="area-separator-line area-separator-line-lower" />
        </template>

        <div
          v-else
          class="area-separator-line"
        />
      </template>
    </div>
  </div>

  <BusAreaBoundaryPropertiesDialog
    v-if="isBusAreaMode"
    v-model:visible="showPropertiesDialog"
    v-model="areaSeparator"
  />

  <AreaSeparatorPropertiesDialog
    v-else
    v-model:visible="showPropertiesDialog"
    v-model="areaSeparator"
  />
</template>

<style scoped lang="scss">
.area-separator-wrapper {
  position: relative;

  display: flex;
  justify-content: center;
  align-items: flex-start;

  width: v-bind(separatorWidth);
  min-width: v-bind(separatorWidth);

  min-height: calc(v-bind(separatorHeight) + 3em);

  z-index: 3;
}

/*
 * =========================================================
 * STYLE INCLINÉ : SÉPARATION VILLE / ZONE
 * =========================================================
 */
.area-separator-wrapper.angled-area-separator {
  align-items: center;

  /*
   * Plus de réserve verticale pour placer Ville au-dessus
   * et Zone sous la ligne sans les rapprocher de l'arrêt.
   */
  min-height: calc(v-bind(separatorHeight) + 8em);
}

.angled-area-separator-handle {
  position: relative;

  justify-content: center;

  height: calc(v-bind(separatorHeight) + 8em);
  min-height: calc(v-bind(separatorHeight) + 8em);

  padding: 0;
}

.angled-area-separator-handle
.area-separator-labels {
  position: absolute;
  inset: 0;

  display: block;

  margin: 0;
}

.angled-area-separator-handle
.area-separator-city,
.angled-area-separator-handle
.area-separator-zone {
  position: absolute;

  width: max-content;
  max-width: calc(v-bind(separatorWidth) + 12em);

  white-space: nowrap;
}

/*
 * Ville reste au-dessus du pointillé incliné. L'ancrage est fait
 * sur son bord droit : un nom plus long grandit vers la gauche
 * et ne revient pas se poser sur l'arrêt voisin.
 */
.angled-area-separator-handle
.area-separator-city {
  top: .2em;
  left: calc(50% + v-bind(angledUpperOffset));

  font-size: .7em;
  font-weight: 650;
  line-height: 1.05;

  text-align: right;

  transform: translateX(-100%);
}

/*
 * La zone est toujours sous le tracé, centrée sur la partie
 * verticale basse du séparateur.
 */
.angled-area-separator-handle
.area-separator-zone {
  bottom: .2em;
  left: 50%;

  margin-top: 0;

  font-size: .58em;
  font-weight: 500;
  line-height: 1.05;

  opacity: .72;

  text-align: center;

  transform: translateX(-50%);
}

.angled-area-separator-handle
.area-separator-line {
  position: absolute;
  left: 50%;

  width: 0;
  min-height: 0;

  border-left:
    1px
    dotted
    var(--p-slate-500);
}

/*
 * Le point de cassure reste exactement au niveau du tracé :
 * - sous le tracé : vertical ;
 * - au-dessus : même inclinaison qu'avant, mais plus longue.
 */
.angled-area-separator-handle
.area-separator-line-lower {
  top: 50%;
  bottom: 1.8em;

  height: auto;

  transform: translateX(-50%);
}

.angled-area-separator-handle
.area-separator-line-upper {
  bottom: 50%;

  height: v-bind(angledUpperLength);

  transform: rotate(60deg);
  transform-origin: bottom center;
}

.area-separator-wrapper.bus-area-boundary {
  align-items: center;

  min-height: 4em;
}

.area-separator {
  position: relative;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;

  width: 100%;

  padding: .25em;

  border-radius: .25em;
  background-color: transparent;

  cursor: grab;

  transition: background-color .2s ease;

  &:hover {
    background-color: color-mix(
      in srgb,
      var(--p-slate-300),
      transparent 70%
    );
  }

  &:active {
    cursor: grabbing;
  }
}

.area-separator.bus-area-boundary-handle {
  justify-content: center;

  height: 4em;
  min-height: 4em;
  padding: 0;
}

.bus-area-boundary-tick {
  display: block;

  width: .34em;
  height: 1.55em;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-slate-500),
      transparent 25%
    );

  opacity: .4;

  transition:
    opacity .15s ease,
    transform .15s ease;
}

.bus-area-boundary-handle:hover
.bus-area-boundary-tick {
  opacity: .9;
  transform: scaleY(1.12);
}

.area-separator-labels {
  display: flex;
  flex-direction: column;
  align-items: center;

  margin-bottom: .25em;

  white-space: nowrap;

  pointer-events: none;
}

.area-separator-city {
  font-size: .7em;
  font-weight: 600;
  line-height: 1.1;

  text-align: center;
}

.area-separator-zone {
  margin-top: .15em;

  font-size: .6em;
  font-weight: 500;
  line-height: 1.1;

  opacity: .7;

  text-align: center;
}

.area-separator-line {
  width: 0;
  height: v-bind(separatorHeight);
  min-height: v-bind(separatorHeight);

  border-left: 1px dashed var(--p-slate-500);

  pointer-events: none;
}
</style>
