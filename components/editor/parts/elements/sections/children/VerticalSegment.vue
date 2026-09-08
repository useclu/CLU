<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import {
  computed,
  inject,
  ref,
  watch,
} from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { LineContextKey } from '~/utils/symbols'

const segment = defineModel<VerticalSegment>({
  required: true,
})

/*
 * Le composant possède maintenant deux dimensions
 * différentes :
 *
 * - "el" mesure uniquement le raccord de 7em ;
 * - "attachedBranchElement" mesure la vraie largeur
 *   de la Branch déposée sur le segment.
 *
 * C'est important car la Branch reste positionnée
 * visuellement en absolute, mais sa largeur doit
 * quand même être annoncée au layout général.
 */
const el = ref<HTMLElement | null>(null)

const attachedBranchElement =
  ref<HTMLElement | null>(null)

const {
  width,
  height,
} = useElementSize(el)

const {
  width: attachedBranchWidth,
} = useElementSize(attachedBranchElement)

const lineContext = inject<LineContext>(LineContextKey)!

const color = computed(() =>
  lineContext?.color.value ?? '#000000',
)

const lineWidth = computed(() =>
  lineContext.lineThickness.value,
)

/*
 * Direction verticale.
 *
 * -1 = vers le haut
 *  1 = vers le bas
 */
const verticalDirection = computed(() => {
  if (
    segment.value.$verticalSegment.levelChange !== undefined
  ) {
    return segment.value.$verticalSegment.levelChange < 0
      ? -1
      : 1
  }

  switch (segment.value.$verticalSegment.direction) {
    case 'UP':
      return -1

    case 'DOWN':
      return 1

    case 'BOTH':
    default:
      return 1
  }
})

/*
 * Côté sur lequel se développe
 * la branche secondaire.
 */
const side = computed<VerticalSegmentSide>(() =>
  segment.value.$verticalSegment.side ?? 'RIGHT',
)

/*
 * Migration de l'ancien système utilisant
 * un unique "stop".
 *
 * On initialise directement le tableau
 * afin de conserver les anciens projets.
 */
if (
  segment.value.$verticalSegment.stops === undefined
) {
  segment.value.$verticalSegment.stops = []

  if (
    segment.value.$verticalSegment.stop !== undefined
  ) {
    segment.value.$verticalSegment.stops.push(
      segment.value.$verticalSegment.stop,
    )

    segment.value.$verticalSegment.stop = undefined
  }
}

/*
 * Tableau historique des arrêts.
 *
 * Il reste utilisé pour assurer la migration
 * des VerticalSegment créés avant l'arrivée
 * de la vraie propriété "branch".
 */
const stops = computed<Stop[]>(() =>
  segment.value.$verticalSegment.stops ?? [],
)

/*
 * Migration automatique des anciens segments.
 *
 * Si un ancien VerticalSegment possède déjà
 * des arrêts mais ne possède pas encore
 * de vraie Branch, on transforme son ancien
 * tableau d'arrêts en véritable Branch.
 *
 * IMPORTANT :
 *
 * si le segment est vide, aucune Branch
 * n'est créée automatiquement.
 *
 * Un nouveau VerticalSegment reste donc
 * totalement neutre.
 */
if (
  segment.value.$verticalSegment.branch === undefined
  && stops.value.length > 0
) {
  segment.value.$verticalSegment.branch = {
    id: `${segment.value.id}-branch`,

    $branch: {
      elementSpacing: 2,
      marginLeft: 0,
      marginRight: 0,
      invertedElements: false,
      elements: stops.value,
    },
  }
}

/*
 * Vraie Branch du VerticalSegment.
 *
 * Contrairement à l'ancien système,
 * elle n'est plus créée automatiquement.
 *
 * Elle existe uniquement :
 *
 * - si elle était déjà enregistrée ;
 * - si un ancien segment possédait des arrêts ;
 * - ou si l'utilisateur glisse une Branch
 *   depuis les outils.
 */
const attachedBranch = computed<Branch | null>({
  get: () =>
    segment.value.$verticalSegment.branch
    ?? null,

  set: (value) => {
    if (value === null) {
      segment.value.$verticalSegment.branch =
        undefined

      return
    }

    segment.value.$verticalSegment.branch =
      value
  },
})

/*
 * Modèle non nullable utilisé uniquement
 * par Branch.vue.
 *
 * Le composant Branch n'est affiché que
 * lorsque attachedBranch existe réellement.
 */
const attachedBranchModel = computed<Branch>({
  get: () =>
    segment.value.$verticalSegment.branch!,

  set: (value) => {
    segment.value.$verticalSegment.branch =
      value
  },
})

/*
 * Petite liste temporaire utilisée uniquement
 * comme zone de dépôt.
 *
 * Une Branch glissée depuis la toolbox arrive
 * d'abord ici puis est immédiatement transférée
 * dans segment.$verticalSegment.branch.
 */
const branchDropZone = ref<LineElement[]>([])

/*
 * Détecte lorsqu'un élément est déposé
 * sur le VerticalSegment.
 *
 * Seules les vraies Branch sont acceptées.
 *
 * Si l'élément déposé est une Branch,
 * elle devient la branche secondaire
 * persistante du segment.
 */
watch(
  branchDropZone,
  (elements) => {
    if (elements.length === 0) {
      return
    }

    const droppedElement = elements[0]

    branchDropZone.value = []

    if (
      droppedElement === undefined
      || !('$branch' in droppedElement)
    ) {
      return
    }

    /*
     * Une Branch déposée sur un VerticalSegment
     * doit commencer exactement au raccord.
     *
     * Les marges d'une Branch normale ne doivent
     * donc pas créer d'espace supplémentaire ici.
     */
    droppedElement.$branch.marginLeft = 0
    droppedElement.$branch.marginRight = 0

    segment.value.$verticalSegment.branch =
      droppedElement

    /*
     * L'ancien stockage devient inutile
     * dès qu'une vraie Branch est présente.
     *
     * On conserve toutefois la propriété
     * dans le type pour les anciens projets.
     */
    segment.value.$verticalSegment.stops =
      droppedElement.$branch.elements.filter(
        (element): element is Stop =>
          '$stop' in element,
      )

    segment.value.$verticalSegment.stop =
      undefined
  },
)

/*
 * Synchronisation de compatibilité :
 *
 * lorsqu'une vraie Branch existe,
 * l'ancien tableau "stops" reflète
 * les arrêts présents dans cette Branch.
 *
 * Cette synchronisation sert uniquement
 * à ne pas casser les anciennes parties
 * du code qui utilisent encore "stops".
 */
watch(
  () =>
    segment.value.$verticalSegment.branch
      ?.$branch.elements,
  (elements) => {
    if (elements === undefined) {
      return
    }

    const branchStops =
      elements.filter(
        (element): element is Stop =>
          '$stop' in element,
      )

    segment.value.$verticalSegment.stops =
      branchStops

    segment.value.$verticalSegment.stop =
      undefined
  },
)

/*
 * Une Branch attachée au VerticalSegment
 * ne possède aucune marge du côté du raccord.
 *
 * Elle doit commencer exactement là où se
 * termine le petit raccord horizontal dessiné
 * par le VerticalSegment.
 *
 * On force les deux marges à zéro afin que
 * le comportement reste correct si le côté
 * du segment est modifié après sa création.
 */
watch(
  attachedBranch,
  (branch) => {
    if (branch === null) {
      return
    }

    branch.$branch.marginLeft = 0
    branch.$branch.marginRight = 0
  },
  {
    immediate: true,
  },
)

/*
 * Niveau de la ligne principale.
 */
const centerY = computed(() =>
  height.value / 2,
)

/*
 * Niveau de la branche secondaire.
 */
const outerY = computed(() =>
  verticalDirection.value < 0
    ? 0
    : height.value,
)

/*
 * Position horizontale du raccord vertical.
 */
const verticalX = computed(() => {
  if (side.value === 'LEFT') {
    return width.value * 0.38
  }

  return width.value * 0.62
})

/*
 * Petite portion horizontale entre
 * le virage et la Branch.
 */
const branchConnectorLength = computed(() => {
  if (width.value === 0) {
    return 0
  }

  return Math.min(
    width.value * 0.22,
    28,
  )
})

/*
 * Extrémité horizontale du raccord.
 */
const branchConnectionX = computed(() => {
  if (side.value === 'RIGHT') {
    return (
      verticalX.value
      + branchConnectorLength.value
    )
  }

  return (
    verticalX.value
    - branchConnectorLength.value
  )
})

/*
 * Rayon du virage.
 */
const radius = computed(() => {
  if (
    width.value === 0
    || height.value === 0
  ) {
    return 0
  }

  return Math.min(
    width.value * 0.12,
    height.value * 0.1,
  )
})

/*
 * Le SVG dessine uniquement le raccord.
 *
 * La branche horizontale n'est jamais
 * créée automatiquement ici.
 *
 * Elle apparaît uniquement lorsqu'une
 * vraie Branch a été déposée sur le segment.
 */
const path = computed(() => {
  if (
    width.value === 0
    || height.value === 0
  ) {
    return ''
  }

  const r = radius.value

  const direction =
    verticalDirection.value < 0
      ? -1
      : 1

  if (side.value === 'RIGHT') {
    return [
      `M 0 ${centerY.value}`,

      `L ${verticalX.value - r} ${centerY.value}`,

      `Q ${verticalX.value} ${centerY.value} ${verticalX.value} ${centerY.value + direction * r}`,

      `L ${verticalX.value} ${outerY.value}`,

      `L ${branchConnectionX.value} ${outerY.value}`,
    ].join(' ')
  }

  return [
    `M ${width.value} ${centerY.value}`,

    `L ${verticalX.value + r} ${centerY.value}`,

    `Q ${verticalX.value} ${centerY.value} ${verticalX.value} ${centerY.value + direction * r}`,

    `L ${verticalX.value} ${outerY.value}`,

    `L ${branchConnectionX.value} ${outerY.value}`,
  ].join(' ')
})

/*
 * Position de la branche secondaire.
 *
 * La zone de drop et la vraie Branch
 * utilisent exactement la même position.
 */
const branchStyle = computed(() => {
  if (side.value === 'RIGHT') {
    return {
      left: `${branchConnectionX.value}px`,
      top: `${outerY.value}px`,
    }
  }

  return {
    right: `${
      width.value
      - branchConnectionX.value
    }px`,

    top: `${outerY.value}px`,
  }
})

/*
 * Largeur réellement occupée par la partie
 * de la Branch qui dépasse du raccord.
 *
 * C'est différent selon le côté.
 *
 * À droite :
 *
 * la Branch commence à branchConnectionX
 * et se développe vers la droite.
 *
 * À gauche :
 *
 * son bord droit se trouve à branchConnectionX
 * et toute la Branch se développe vers la gauche.
 *
 * On ne réserve donc surtout pas simplement
 * "7em + largeur de la Branch", car cela créerait
 * de l'espace vide du mauvais côté.
 */
const branchLayoutExtension = computed(() => {
  if (
    attachedBranch.value === null
    || attachedBranchWidth.value === 0
    || width.value === 0
  ) {
    return 0
  }

  if (side.value === 'LEFT') {
    return Math.max(
      0,
      attachedBranchWidth.value
      - branchConnectionX.value,
    )
  }

  return Math.max(
    0,
    branchConnectionX.value
    + attachedBranchWidth.value
    - width.value,
  )
})

/*
 * Largeur réellement réservée dans le plan.
 *
 * Le raccord conserve sa largeur historique
 * de 7em.
 *
 * On lui ajoute uniquement la portion de Branch
 * qui dépasse réellement de ce raccord.
 *
 * Cela évite notamment qu'une Branch orientée
 * vers la gauche réserve sa largeur à droite
 * et crée un énorme espace avant l'élément suivant.
 */
const layoutStyle = computed(() => {
  if (branchLayoutExtension.value === 0) {
    return {
      width: '7em',
      minWidth: '7em',
    }
  }

  return {
    width:
      `calc(7em + ${branchLayoutExtension.value}px)`,

    minWidth:
      `calc(7em + ${branchLayoutExtension.value}px)`,
  }
})

/*
 * Position réelle du raccord à l'intérieur
 * du conteneur participant au layout.
 *
 * Si la Branch part vers la gauche, son espace
 * doit être réservé AVANT le raccord.
 *
 * On décale donc le raccord vers la droite
 * exactement de la largeur qui dépasse.
 *
 * Si la Branch part vers la droite,
 * aucun décalage n'est nécessaire.
 */
const wrapperStyle = computed(() => {
  if (
    side.value !== 'LEFT'
    || branchLayoutExtension.value === 0
  ) {
    return undefined
  }

  return {
    marginLeft:
      `${branchLayoutExtension.value}px`,
  }
})
</script>

<template>
  <!--
    Ce conteneur participe réellement au layout.

    Sa largeur augmente uniquement de la partie
    de la Branch qui dépasse réellement du raccord.

    Pour une Branch orientée à gauche, cet espace
    est placé avant le raccord afin de ne plus
    créer de vide après le VerticalSegment.
  -->
  <div
    class="vertical-segment-layout dynamic-part"
    :style="layoutStyle"
  >
    <!--
      Le raccord lui-même reste volontairement
      fixé à 7em.

      Lorsqu'une Branch part vers la gauche,
      wrapperStyle le décale vers la droite afin
      que l'espace réservé corresponde réellement
      à la position visuelle de cette Branch.
    -->
    <div
      ref="el"
      class="vertical-segment-wrapper"
      :style="wrapperStyle"
    >
      <svg
        width="100%"
        height="100%"
        overflow="visible"
      >
        <SvgLine
          v-if="path"
          :path="path"
          :color="color"
          :line-width="lineWidth"
          :striped="
            lineContext.lineStyle.value === 'STRIPED'
          "
        />
      </svg>

      <!--
        Aucune Branch n'existe encore.

        Cette zone est uniquement une cible
        de drag & drop pour l'outil "Branche"
        déjà présent dans la toolbox.

        Elle ne dessine aucune ligne.
      -->
      <VueDraggable
        v-if="attachedBranch === null"
        v-model="branchDropZone"
        group="sectionElements"
        class="branch-drop-zone"
        :class="{
          left: side === 'LEFT',
          right: side === 'RIGHT',
        }"
        :style="branchStyle"
      />

      <!--
        Une vraie Branch a été déposée.

        Elle reste désormais visible même vide
        et peut recevoir ses arrêts normalement.

        Le conteneur possède également un ref
        afin que sa largeur réelle puisse être
        communiquée au layout général.
      -->
      <div
        v-else
        ref="attachedBranchElement"
        class="attached-branch"
        :class="{
          left: side === 'LEFT',
          right: side === 'RIGHT',
        }"
        :style="branchStyle"
      >
        <Branch
          v-model="attachedBranchModel"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/*
 * Conteneur participant au flux normal
 * de SectionsGroup.
 *
 * Sa largeur correspond maintenant exactement :
 *
 * raccord de 7em
 * +
 * portion de Branch qui dépasse réellement.
 *
 * Cela permet de réserver la place du bon côté.
 */
.vertical-segment-layout {
  position: relative;

  height: 7em;
  min-height: 7em;

  flex-shrink: 0;

  overflow: visible;
}

.vertical-segment-wrapper {
  position: relative;

  /*
   * IMPORTANT :
   *
   * Le raccord conserve toujours exactement
   * ses dimensions historiques.
   *
   * La Branch peut donc devenir très longue
   * sans modifier verticalX, les virages ou
   * la forme du VerticalSegment.
   */
  width: 7em;
  min-width: 7em;

  /*
   * Le centre reste le niveau
   * de la ligne principale.
   */
  height: 7em;
  min-height: 7em;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: visible;

  cursor: pointer;

  &:hover {
    background-color: rgb(0 0 0 / 3%);
  }

  .debug & {
    outline: 1px solid purple;
  }
}

svg {
  display: block;

  width: 100%;
  height: 100%;

  overflow: visible;

  pointer-events: none;
}

/*
 * Zone invisible permettant de déposer
 * une Branch depuis les outils.
 *
 * Elle occupe la future position de la
 * branche secondaire mais ne dessine
 * absolument aucune ligne.
 */
.branch-drop-zone {
  position: absolute;

  transform: translateY(-50%);

  /*
   * Zone volontairement plus compacte
   * afin de ne pas recouvrir les segments
   * placés juste à côté.
   */
  width: 5em;
  min-width: 5em;

  height: 2.5em;
  min-height: 2.5em;

  z-index: 11;

  overflow: visible;

  /*
   * Rien n'est affiché au repos.
   *
   * Le léger contour au survol sert
   * simplement à comprendre que le
   * segment peut recevoir une Branch.
   */
  border: 1px dashed transparent;
  border-radius: .4em;

  &:hover {
    border-color: rgb(0 0 0 / 20%);
    background-color: rgb(0 0 0 / 3%);
  }

  &.right {
    transform-origin: left center;
  }

  &.left {
    transform-origin: right center;
  }
}

.attached-branch {
  position: absolute;

  /*
   * top correspond au centre exact
   * de la ligne dessinée par Branch.vue.
   */
  transform: translateY(-50%);

  /*
   * Largeur minimale réduite pour éviter
   * qu'une branche vide prenne une place
   * disproportionnée autour du segment.
   */
  min-width: 5em;

  z-index: 10;

  overflow: visible;

  /*
   * Il n'y a volontairement plus
   * de classe ".empty".
   *
   * Une fois que l'utilisateur a lui-même
   * déposé une Branch sur le segment,
   * cette Branch doit rester visible
   * même si elle ne contient aucun arrêt.
   */
  &.right {
    transform-origin: left center;
  }

  &.left {
    transform-origin: right center;
  }
}
</style>