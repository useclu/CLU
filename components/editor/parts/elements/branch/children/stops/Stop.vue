<script setup lang="ts">
import { useElementHover, useElementSize } from '@vueuse/core'
import { computed, inject, provide, reactive, ref } from 'vue'
import { useProject } from '~/stores/useProject'
import { STOP_PADDING } from '~/utils/dimensions'
import { LineContextKey, StopContextKey } from '~/utils/symbols'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const {
  reverse = false,
  branch,
} = defineProps<{
  reverse?: boolean
  branch?: Branch
}>()

const stop = defineModel<Stop>({
  required: true,
})

const lineContext = inject<LineContext>(LineContextKey)!

const project = useProject()

const showPropertiesDialog = ref(false)
const showConnectionsEditor = ref(false)

const el = ref()
const hovering = useElementHover(el)

const padding = computed(() => STOP_PADDING)

const margins = reactive({
  leftMargin: {
    name: '0px',
    connections: '0px',
  },
  rightMargin: {
    name: '0px',
    subtitle: '0px',
    connections: '0px',
  },
})

const leftMargin = computed(() =>
  `max(${margins.leftMargin.name}, ${margins.leftMargin.connections})`,
)

const rightMargin = computed(() =>
  `max(${margins.rightMargin.name}, ${margins.rightMargin.subtitle}, ${margins.rightMargin.connections})`,
)

const namesMargin = computed(() =>
  `min(-.125em, -${Math.max(0, lineContext.lineThickness.value - 0.375) / 2}em)`,
)

/*
 * Une capsule verticale est plus haute
 * qu'un rond classique.
 *
 * On éloigne donc légèrement le nom
 * afin de conserver visuellement le même
 * espace qu'avec un arrêt normal.
 */
const verticalNamesMargin = computed(() =>
  `calc(${namesMargin.value} - .6em)`,
)

const connectionsMargin = computed(() =>
  `max(.125em, ${Math.max(0, lineContext.lineThickness.value - 0.825) / 2}em)`,
)

const connectionsInverted = computed(() =>
  isSharedStop.value
    ? false
    : inverted.value,
)

const inverted = computed(() =>
  !!stop.value.$stop.reverse !== reverse,
)

// Compatibilité avec les anciens projets.
const isFuture = computed(() =>
  stop.value.$stop.future === true,
)

// Compatibilité avec les anciens projets.
// Un arrêt sans propriété "vertical" reste un arrêt classique.
const isVertical = computed(() =>
  stop.value.$stop.vertical === true,
)

/*
 * Arrêt affiché hors plan / atténué.
 *
 * Chaque arrêt possède son propre état.
 * Aucun autre arrêt n'est automatiquement modifié.
 */
const isOffLine = computed(() =>
  stop.value.$stop.offLine === true,
)

/*
 * =========================================================
 * APPARTENANCE MULTI-LIGNES DE L'ARRÊT
 * =========================================================
 *
 * Compatibilité :
 * - un ancien arrêt sans lineIds appartient à la ligne
 *   principale ;
 * - "primary" désigne toujours la ligne principale ;
 * - les autres identifiants correspondent aux lignes
 *   supplémentaires de la Branch.
 *
 * Le champ est volontairement lu de façon compatible
 * avant l'ajout définitif au schéma TypeScript global.
 */
type MultiLineStopData = Stop['$stop'] & {
  lineIds?: string[]
}

type StopBranchLine = {
  id: string
  mode: Mode
  index: LineIndex | null
  color: string
  primary: boolean
}

const stopData = computed(() =>
  stop.value.$stop as MultiLineStopData,
)

const branchLines =
  computed<StopBranchLine[]>(() => [
    ...(
      branch?.$branch.additionalLines
      ?? []
    ).map(branchLine => ({
      id: branchLine.id,
      mode: branchLine.mode,
      index: branchLine.index,
      color:
        branchLine.color
        || '#000000',
      primary: false,
    })),
    {
      id: 'primary',
      mode: project.line.mode,
      index: project.line.index,
      color:
        lineContext.color.value,
      primary: true,
    },
  ])

const stopLineIds = computed(() => {
  const stored =
    stopData.value.lineIds

  if (
    !stored
    || stored.length === 0
  ) {
    return ['primary']
  }

  const availableIds =
    new Set(
      branchLines.value.map(
        branchLine =>
          branchLine.id,
      ),
    )

  const validIds =
    stored.filter(
      id =>
        availableIds.has(id),
    )

  return (
    validIds.length > 0
      ? validIds
      : ['primary']
  )
})

const stopLines = computed(() =>
  branchLines.value.filter(
    branchLine =>
      stopLineIds.value.includes(
        branchLine.id,
      ),
  ),
)

const isSharedStop = computed(
  () =>
    stopLines.value.length > 1,
)

const stopLineColor = computed(() => {
  if (isOffLine.value) {
    return '#8a8a8a'
  }

  return (
    stopLines.value[0]?.color
    ?? lineContext.color.value
  )
})

const stopLineIdsAttribute =
  computed(() =>
    stopLineIds.value.join(' '),
  )

/*
 * =========================================================
 * STYLE TRAMWAY
 * =========================================================
 *
 * Le style Horizontal nécessite un traitement
 * particulier de l'espacement.
 *
 * Contrairement aux noms inclinés, les noms
 * horizontaux occupent directement l'espace
 * entre deux arrêts.
 *
 * On va donc utiliser leur largeur réelle afin
 * que chaque arrêt réserve suffisamment de place.
 */
const tramStyle = computed<TramStyle>(() =>
  (
    project.line as Line & {
      tramStyle?: TramStyle
    }
  ).tramStyle
  ?? 'ANGLED',
)

const isTramHorizontal = computed(() =>
  project.line.mode === 'TRAM'
  && tramStyle.value === 'HORIZONTAL',
)

// Style par défaut si le projet est ancien
// et ne possède pas encore nameStyle.
const nameStyle = computed<StopNameStyle>(() =>
  stop.value.$stop.nameStyle ?? {
    bold: true,
    italic: false,
    underline: false,
    color: null,
    image: null,
    imageSize: 1,
  },
)

const hasConnections = computed(() =>
  stop.value.$stop.connections.length > 0
  || (stop.value.$stop.customConnections?.length ?? 0) > 0,
)

const names = ref()

const { width } = useElementSize(names)

const namesWidth = computed(() =>
  `${width.value}px`,
)

/*
 * =========================================================
 * ESPACEMENT AUTOMATIQUE DU TRAM HORIZONTAL
 * =========================================================
 *
 * On utilise directement la largeur mesurée du
 * bloc contenant le nom.
 *
 * Cela signifie qu'un nom court conserve un
 * espacement compact alors qu'un nom long pousse
 * réellement les arrêts voisins.
 *
 * STOP_PADDING est ajouté de chaque côté pour
 * éviter que deux noms se touchent exactement.
 */
const tramHorizontalMinWidth = computed(() =>
  `max(
    1em,
    calc(
      ${namesWidth.value}
      + ${padding.value}
      + ${padding.value}
    )
  )`,
)

provide<StopContext>(
  StopContextKey,
  {
    margins,
    namesWidth,
    inverted,
  },
)
</script>

<template>
  <div
    ref="el"
    v-bind="$attrs"
    class="stop-wrapper relative z-100"
    :class="{
      reverse: inverted,
      future: isFuture,
      vertical: isVertical,
      'off-line': isOffLine,
      'tram-horizontal': isTramHorizontal,
      'multi-line-stop': branchLines.length > 1,
      'shared-line-stop': isSharedStop,
    }"
    :data-line-ids="stopLineIdsAttribute"
    :data-shared-lines="
      isSharedStop
        ? 'true'
        : 'false'
    "
  >
    <div
      class="flex items-start"
      :class="{
        'flex-col-reverse': inverted,
        'flex-col': !inverted,
      }"
    >
      <div
        ref="names"
        class="names dynamic-part"
      >
        <StopLabel
          :value="stop.$stop.name"
          :subtitle="stop.$stop.subtitle"
          :place-name="stop.$stop.placeName"
          :interest-point="stop.$stop.interestPoint"
          :prevent-subtitle-overlapping="stop.$stop.preventSubtitleOverlapping"
          :terminus="stop.$stop.terminus"
          :accessible="stop.$stop.accessible"
          :reverse="inverted"
          :future="isFuture"
          :name-style="nameStyle"
          @click="(e: Event) => {
            e.stopPropagation()
            showPropertiesDialog = true
          }"
        />
      </div>

      <div class="dot-connections">
        <div
          class="dot"
          :class="{
            'shared-dot':
              isSharedStop,
          }"
        >
          <StopDot
            class="branch-element-handle z-1"
            :terminus="stop.$stop.terminus"
            :connection="hasConnections"
            :color="stopLineColor"
            :closed="stop.$stop.closed"
            :future="isFuture"
            :vertical="isVertical"
            :shared="isSharedStop"
            @click="(e: Event) => e.stopPropagation()"
          />
        </div>

        <div
          class="w-0 connections dynamic-part"
          :class="{
            'connections-primary-side': isSharedStop,
          }"
        >
          <div
            @click="(e: Event) => {
              e.stopPropagation()
              showConnectionsEditor = true
            }"
          >
            <Connections
              :connections="stop.$stop.connections"
              :custom-connections="stop.$stop.customConnections ?? []"
              :reverse="connectionsInverted"
            />

            <Transition
              v-if="!hasConnections"
              name="fade"
            >
              <div
                v-show="hovering"
                class="button-holder export-hide"
              >
                <Button
                  icon="i-tabler-playlist-add"
                  rounded
                  @click="showConnectionsEditor = true"
                />
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>

  <StopPropertiesDialog
    v-if="branch"
    v-model:visible="showPropertiesDialog"
    v-model="stop"
    :allow-city="lineContext.frameTerminusNames.value"
    :branch="branch"
    @open-connections="showConnectionsEditor = true"
  />

  <ConnectionsEditor
    v-model:visible="showConnectionsEditor"
    v-model:stop="stop"
    :branch="branch"
  />
</template>

<style scoped lang="scss">
.stop-wrapper {
  padding-left: v-bind(leftMargin);
  padding-right: v-bind(rightMargin);
  min-width: 1em;
  min-height: 5em;
  z-index: 20;

  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: center;

  /*
   * =======================================================
   * TRAMWAY HORIZONTAL
   * =======================================================
   *
   * Le wrapper réserve maintenant au minimum
   * la largeur réelle du nom de l'arrêt.
   *
   * Le layout de la branche est donc obligé
   * d'écarter les arrêts voisins lorsque le
   * texte devient long.
   */
  &.tram-horizontal {
    min-width: v-bind(tramHorizontalMinWidth);
  }

  .branch-elements > &:first-child,
  .branch-elements > .branch-element-ghost:first-child & {
    margin-left: calc((v-bind(namesWidth) - 1em) / -2) !important;
    padding-left: 0;

    .names {
      margin-left: 0;
    }

    /*
 * =========================================================
 * BASE VISUELLE DES ARRÊTS MULTI-LIGNES
 * =========================================================
 *
 * La position sur la ligne haute/basse est pilotée par
 * l'appartenance choisie dans les propriétés de l'arrêt.
 *
 * Pour un arrêt partagé, Stop.vue transmet maintenant
 * explicitement "shared" à StopDot : un seul marqueur commun
 * peut donc traverser les rails sélectionnés.
 *
 * Les classes et data-* restent exposées à Branch.vue pour
 * conserver la géométrie dynamique et la compatibilité avec
 * les anciens plans mono-ligne.
 */
.multi-line-stop {
  --stop-multi-line-ready: 1;
}

.shared-line-stop {
  --stop-shared-line-ready: 1;
}

.shared-dot {
  position: relative;
  z-index: 2;
}

.dot-connections {
      margin-left: calc((v-bind(namesWidth) - 1em) / 2);
    }
  }

  .branch-elements > &:last-child,
  .branch-elements > .branch-element-ghost:last-child & {
    margin-right: calc((v-bind(namesWidth) - 1em) / -2) !important;
    padding-right: 0;

    .names {
      margin-right: 0;
    }

    .dot-connections {
      width: 1em;
    }
  }

  /*
   * Le fonctionnement BULB classique autorise le
   * premier et le dernier nom à dépasser de la branche.
   *
   * C'est pratique pour les noms inclinés mais beaucoup
   * moins pour le Tram horizontal : un long terminus peut
   * alors recouvrir le panneau d'identité situé à gauche.
   *
   * On annule donc uniquement ces marges négatives
   * pour le style Tram Horizontal.
   */
  .branch-elements > &:first-child.tram-horizontal,
  .branch-elements > .branch-element-ghost:first-child &.tram-horizontal {
    margin-left: 0 !important;
  }

  .branch-elements > &:last-child.tram-horizontal,
  .branch-elements > .branch-element-ghost:last-child &.tram-horizontal {
    margin-right: 0 !important;
  }

  .debug & {
    outline: 1px solid cyan;
  }
}

.names {
  .debug & {
    outline: 1px solid blue;
  }

  position: relative;
  top: v-bind(namesMargin);
  height: 0;
  cursor: pointer;
  margin: 0 v-bind(STOP_PADDING);
  transition:
    filter .2s ease,
    opacity .2s ease;

  .reverse & {
    top: auto;
    bottom: v-bind(namesMargin);
  }

  /*
   * La capsule verticale dépasse davantage
   * au-dessus et au-dessous de la ligne.
   *
   * Son nom est donc repoussé pour conserver
   * la même respiration visuelle qu'un rond.
   */
  .vertical & {
    top: v-bind(verticalNamesMargin);
  }

  .vertical.reverse & {
    top: auto;
    bottom: v-bind(verticalNamesMargin);
  }

  &:hover {
    filter: brightness(.5);
  }

  /*
   * Le nom d'un arrêt hors plan reste
   * personnalisable mais visuellement atténué.
   */
  .off-line & {
    opacity: .48;
    filter: grayscale(1);
  }

  .off-line &:hover {
    opacity: .65;
    filter:
      grayscale(1)
      brightness(.75);
  }
}

.dot-connections {
  display: flex;
  flex-direction: column;
  align-items: start;

  margin-left: calc((v-bind(namesWidth) - 1em) / 2 + v-bind(padding));

  .reverse & {
    flex-direction: column-reverse;
  }
}

.dot {
  .debug & {
    outline: 1px solid magenta;
  }

  display: flex;
  flex-direction: row;
  align-items: center;

  /*
   * IMPORTANT :
   *
   * le point d'un arrêt hors plan doit rester
   * totalement opaque.
   *
   * Sa couleur est déjà remplacée par du gris
   * dans le template via la prop "color".
   *
   * On évite donc toute opacité ici afin que
   * la ligne colorée située derrière l'arrêt
   * ne puisse pas apparaître à travers le point.
   */
  .off-line & {
    opacity: 1;
    filter: none;
  }
}

.connections {
  min-width: 1em;
  position: relative;
  top: v-bind(connectionsMargin);
  height: 0;

  &.connections-primary-side {
    top: v-bind(connectionsMargin) !important;
    bottom: auto !important;

    > div {
      transform: none !important;
    }
  }

  .reverse & {
    top: auto;
    bottom: v-bind(connectionsMargin);
  }

  > div {
    display: flex;
    flex-direction: column;
    align-items: start;
    cursor: pointer;

    .reverse & {
      transform: translateY(-100%);
    }

    .button-holder {
      left: .5em;
      transform: translateX(-50%);
      top: calc(v-bind(connectionsMargin) * -1);
      padding-top: .5em;
      width: .125em;
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--p-button-primary-background);

      .reverse & {
        top: auto;
        bottom: calc(v-bind(connectionsMargin) * -1);
        padding-top: 0;
        padding-bottom: .5em;
      }
    }

    transition: filter .2s ease;

    &:hover {
      filter: brightness(.5);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>