<script setup lang="ts">
import type { DraggableEvent, SortableEvent } from 'vue-draggable-plus'
import { useCssVar, useElementSize } from '@vueuse/core'
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import useElementGrabbing from '~/composables/useElementGrabbing'
import { useProject } from '~/stores/useProject'
import { LineContextKey } from '~/utils/symbols'

const {
  fluid = false,
} = defineProps<{
  fluid?: boolean
}>()

const el = ref<HTMLElement>()
const line = ref()

const sizeFactor = computed(() =>
  Number.parseInt(useCssVar('--base-size', el).value ?? '1'),
)

const { width: branchLength } = useElementSize(line)

const branch = defineModel<Branch>({ required: true })

const project = useProject()
type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

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

const showOutOfFareZoneBackground =
  computed(
    () =>
      project.line
        .showOutOfFareZoneBackground
      !== false,
  )

const defaultOutOfFareZoneText =
  'HORS TARIFICATION ÎLE-DE-FRANCE'

interface OutOfFareZoneLabelDrag {
  pointerId: number
  zoneKey: string
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  hasMoved: boolean
}

const outOfFareZoneLabelDrag =
  ref<OutOfFareZoneLabelDrag | null>(null)

const showOutOfFareZoneLabelProperties =
  ref(false)

const activeOutOfFareZoneLabelZoneKey =
  ref<string | null>(null)

function ensureOutOfFareZoneLabel() {
  if (!project.line.outOfFareZoneLabel) {
    project.line.outOfFareZoneLabel = {
      text: defaultOutOfFareZoneText,
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
      fontSize: 0.7,
      zones: {},
      positions: {},
    }
  }

  const label =
    project.line.outOfFareZoneLabel

  if (
    !label.text
    || label.text.trim().length === 0
  ) {
    label.text =
      defaultOutOfFareZoneText
  }

  if (!label.zones) {
    label.zones = {}
  }

  if (!label.positions) {
    label.positions = {}
  }

  return label
}

function ensureOutOfFareZoneLabelSettings(
  zoneKey: string,
) {
  const label =
    ensureOutOfFareZoneLabel()

  const zones =
    label.zones!

  if (!zones[zoneKey]) {
    const legacyPosition =
      label.positions?.[zoneKey]

    zones[zoneKey] = {
      /*
       * Une nouvelle zone utilise toujours la mention
       * officielle par défaut.
       *
       * On ne recopie plus l'ancien texte global
       * (qui pouvait par exemple contenir "test").
       */
      text:
        defaultOutOfFareZoneText,

      bold:
        label.bold
        ?? true,

      italic:
        label.italic
        ?? false,

      underline:
        label.underline
        ?? false,

      color:
        label.color
        ?? '#000000',

      fontSize:
        label.fontSize
        ?? 0.7,

      offsetX:
        legacyPosition?.offsetX
        ?? label.offsetX
        ?? 0,

      offsetY:
        legacyPosition?.offsetY
        ?? label.offsetY
        ?? 0,
    }
  }

  if (
    !zones[zoneKey].text
    || zones[zoneKey].text.trim().length === 0
  ) {
    zones[zoneKey].text =
      defaultOutOfFareZoneText
  }

  return zones[zoneKey]
}

function getOutOfFareZoneLabelSettings(
  zoneKey: string,
) {
  const label =
    project.line.outOfFareZoneLabel

  const zoneSettings =
    label?.zones?.[zoneKey]

  if (zoneSettings) {
    return {
      ...zoneSettings,

      text:
        zoneSettings.text?.trim().length > 0
          ? zoneSettings.text
          : defaultOutOfFareZoneText,
    }
  }

  const legacyPosition =
    label?.positions?.[zoneKey]

  return {
    text:
      label?.text?.trim().length
        ? label.text
        : defaultOutOfFareZoneText,

    bold:
      label?.bold
      ?? true,

    italic:
      label?.italic
      ?? false,

    underline:
      label?.underline
      ?? false,

    color:
      label?.color
      ?? '#000000',

    fontSize:
      label?.fontSize
      ?? 0.7,

    offsetX:
      legacyPosition?.offsetX
      ?? label?.offsetX
      ?? 0,

    offsetY:
      legacyPosition?.offsetY
      ?? label?.offsetY
      ?? 0,
  }
}

function ensureOutOfFareZoneLabelPosition(
  zoneKey: string,
) {
  return ensureOutOfFareZoneLabelSettings(
    zoneKey,
  )
}

function getOutOfFareZoneLabelPosition(
  zoneKey: string,
) {
  const settings =
    getOutOfFareZoneLabelSettings(
      zoneKey,
    )

  return {
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
  }
}

function openOutOfFareZoneLabelProperties(
  zoneKey: string,
) {
  ensureOutOfFareZoneLabel()

  activeOutOfFareZoneLabelZoneKey.value =
    zoneKey

  showOutOfFareZoneLabelProperties.value =
    true
}

function moveOutOfFareZoneLabel(
  event: PointerEvent,
) {
  const drag =
    outOfFareZoneLabelDrag.value

  if (
    !drag
    || drag.pointerId !== event.pointerId
  ) {
    return
  }

  const deltaX =
    event.clientX - drag.startX

  const deltaY =
    event.clientY - drag.startY

  /*
   * Un petit mouvement de souris ne doit pas
   * transformer un simple clic en déplacement.
   */
  if (
    !drag.hasMoved
    && Math.hypot(deltaX, deltaY) < 4
  ) {
    return
  }

  drag.hasMoved = true

  const position =
    ensureOutOfFareZoneLabelPosition(
      drag.zoneKey,
    )

  position.offsetX =
    drag.offsetX + deltaX

  position.offsetY =
    drag.offsetY + deltaY
}

function stopOutOfFareZoneLabelDrag(
  event: PointerEvent,
) {
  const drag =
    outOfFareZoneLabelDrag.value

  if (
    !drag
    || drag.pointerId !== event.pointerId
  ) {
    return
  }

  const hasMoved =
    drag.hasMoved

  outOfFareZoneLabelDrag.value = null

  window.removeEventListener(
    'pointermove',
    moveOutOfFareZoneLabel,
  )

  window.removeEventListener(
    'pointerup',
    stopOutOfFareZoneLabelDrag,
  )

  window.removeEventListener(
    'pointercancel',
    stopOutOfFareZoneLabelDrag,
  )

  /*
   * Aucun déplacement réel :
   * il s'agissait d'un simple clic.
   */
  if (!hasMoved) {
  openOutOfFareZoneLabelProperties(
    drag.zoneKey,
  )
}
}

function startOutOfFareZoneLabelDrag(
  event: PointerEvent,
  zoneKey: string,
) {
  event.stopPropagation()

  const position =
    ensureOutOfFareZoneLabelPosition(
      zoneKey,
    )

  outOfFareZoneLabelDrag.value = {
    pointerId: event.pointerId,
    zoneKey,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: position.offsetX,
    offsetY: position.offsetY,
    hasMoved: false,
  }

  window.addEventListener(
    'pointermove',
    moveOutOfFareZoneLabel,
  )

  window.addEventListener(
    'pointerup',
    stopOutOfFareZoneLabelDrag,
  )

  window.addEventListener(
    'pointercancel',
    stopOutOfFareZoneLabelDrag,
  )
}

const emphasize = ref(false)

const { grab, release } = useElementGrabbing((event) => {
  emphasize.value = [
    'STOP',
    'SPACER',
    'AREA_SEPARATOR',
  ].includes(event.type ?? '')
})

const elements = computed({
  get: () => branch.value.$branch.elements ?? [],
  set: val => branch.value.$branch.elements = val,
})

const lineContext = inject<LineContext>(LineContextKey)!

const elementSpacing = computed(
  () => `${branch.value.$branch.elementSpacing}em`,
)

const leftMargin = computed(
  () => `${branch.value.$branch.marginLeft || 0}em`,
)

const rightMargin = computed(
  () => `${branch.value.$branch.marginRight || 0}em`,
)

const color = computed(
  () => lineContext?.color.value ?? '#000000',
)

/*
 * =========================================================
 * CORRIDOR MULTI-LIGNES
 * =========================================================
 *
 * Une Branch peut maintenant contenir plusieurs identités
 * de ligne tout en restant un seul objet topologique.
 *
 * Ordre visuel :
 *
 * - les lignes supplémentaires sont au-dessus ;
 * - la ligne principale du projet reste en dessous.
 *
 * On conserve également le mode et l'indice dans cette
 * structure afin que les prochains composants (arrêts,
 * bifurcations, changements de ligne) puissent s'appuyer
 * sur exactement la même source de vérité.
 */
/*
 * Une ligne transmise par une Fork reste disponible LOGIQUEMENT
 * dans la Branch enfant (donc visible dans les propriétés d'arrêt),
 * mais elle ne doit pas être dessinée tant qu'aucun arrêt de cette
 * Branch ne l'utilise réellement.
 *
 * Exemple Fork D :
 * - D est la ligne bifurquée : visible immédiatement ;
 * - S est seulement "disponible en continuité" ;
 * - S n'apparaît que lorsqu'un arrêt de cette sortie est coché S.
 */
type BranchWithPassthrough = Branch['$branch'] & {
  passthroughLineIds?: string[]
}

/*
 * Ligne implicite d'un Stop qui ne possède pas encore lineIds.
 *
 * Ancien comportement :
 *   pas de lineIds => primary
 *
 * Cela est faux dans une sortie de Fork S : D peut être seulement
 * passthrough tandis que S est la vraie ligne cible de la Branch.
 *
 * On déduit donc la ligne naturelle uniquement depuis l'état logique
 * déjà présent sur la Branch, sans modifier le Stop et sans écrire
 * pendant un drag Sortable.
 */
function defaultStopLineIdForBranch() {
  const branchData =
    branch.value.$branch as BranchWithPassthrough

  const passthroughIds =
    new Set(
      branchData.passthroughLineIds
      ?? [],
    )

  if (
    branch.value.$branch.primaryLineVisible
    !== false
    && !passthroughIds.has(
      'primary',
    )
  ) {
    return 'primary'
  }

  const directAdditionalLine =
    (
      branch.value.$branch.additionalLines
      ?? []
    ).find(
      line =>
        !passthroughIds.has(
          line.id,
        ),
    )

  if (directAdditionalLine) {
    return directAdditionalLine.id
  }

  /*
   * Fallback de sécurité pour les anciens projets :
   * si toute la structure est marquée passthrough, on conserve quand
   * même un rail existant plutôt que d'inventer D.
   */
  if (
    branch.value.$branch.primaryLineVisible
    !== false
  ) {
    return 'primary'
  }

  return (
    branch.value.$branch.additionalLines?.[0]?.id
    ?? 'primary'
  )
}


/*
 * Appartenance implicite complète d'un ancien Stop sans lineIds.
 *
 * - corridor partagé D + S : le Stop appartient aux deux lignes directes ;
 * - sortie de Fork : les lignes seulement passthrough restent exclues ;
 * - si aucune ligne directe n'est disponible, on retombe sur la ligne
 *   naturelle historique de la Branch.
 *
 * Cette fonction ne persiste rien : elle sert uniquement de source de
 * vérité commune au rendu et aux recalculs physiques de Branch.vue.
 */
function implicitStopLineIdsForBranch() {
  const branchData =
    branch.value.$branch as BranchWithPassthrough

  const passthroughIds =
    new Set(
      branchData.passthroughLineIds
      ?? [],
    )

  const ids: string[] = []

  if (
    branch.value.$branch.primaryLineVisible
    !== false
    && !passthroughIds.has('primary')
  ) {
    ids.push('primary')
  }

  for (
    const line
    of branch.value.$branch.additionalLines
    ?? []
  ) {
    if (!passthroughIds.has(line.id)) {
      ids.push(line.id)
    }
  }

  if (ids.length > 0) {
    return ids
  }

  return [
    defaultStopLineIdForBranch(),
  ]
}

function branchUsesLine(
  lineId: string,
) {
  return (
    branch.value.$branch.elements ?? []
  ).some((element) => {
    if (!('$stop' in element)) {
      return false
    }

    const ids =
      (
        element.$stop as Stop['$stop'] & {
          lineIds?: string[]
        }
      ).lineIds

    if (
      !ids
      || ids.length === 0
    ) {
      return implicitStopLineIdsForBranch()
        .includes(lineId)
    }

    return ids.includes(lineId)
  })
}

function branchLineIsVisible(
  lineId: string,
) {
  const branchData =
    branch.value.$branch as BranchWithPassthrough

  const passthroughIds =
    branchData.passthroughLineIds
    ?? []

  return (
    !passthroughIds.includes(lineId)
    || branchUsesLine(lineId)
  )
}

/*
 * Lignes réellement dessinées dans cette Branch.
 *
 * La principale est toujours en haut lorsqu'elle est visible.
 */
const branchLines = computed(() => {
  const lines = [] as Array<{
    id: string
    mode: Mode | null
    index: LineIndex | null
    color: string
    primary: boolean
  }>

  if (
    branch.value.$branch.primaryLineVisible
    !== false
    && branchLineIsVisible('primary')
  ) {
    lines.push({
      id: 'primary',
      mode: project.line.mode,
      index: project.line.index,
      color: color.value,
      primary: true,
    })
  }

  lines.push(
    ...(
      branch.value.$branch.additionalLines ?? []
    )
      .filter(
        branchLine =>
          branchLineIsVisible(
            branchLine.id,
          ),
      )
      .map(branchLine => ({
        id: branchLine.id,
        mode: branchLine.mode,
        index: branchLine.index,
        color:
          branchLine.color
          || '#000000',
        primary: false,
      })),
  )

  return lines
})

/*
 * =========================================================
 * SLOTS VERTICAUX DU CORRIDOR
 * =========================================================
 *
 * Très important :
 *
 * masquer la ligne principale dans une Branch ne doit PAS
 * recentrer une ligne secondaire.
 *
 * Exemple :
 *
 * D  ─────────────
 * S  ─────────────
 *
 * puis une Branch S seule :
 *
 *    (slot D conservé)
 * S  ─────────────
 *
 * On conserve donc toujours le slot vertical de "primary"
 * dans la géométrie, même lorsque son trait n'est pas dessiné.
 *
 * branchLines       = rails visibles
 * branchLayoutLines = places verticales du corridor
 */
const branchLayoutLines = computed(() => [
  {
    id: 'primary',
    mode: project.line.mode,
    index: project.line.index,
    color: color.value,
    primary: true,
  },

  ...(
    branch.value.$branch.additionalLines ?? []
  ).map(branchLine => ({
    id: branchLine.id,
    mode: branchLine.mode,
    index: branchLine.index,
    color:
      branchLine.color
      || '#000000',
    primary: false,
  })),
])

function branchLayoutIndex(
  visibleLineIndex: number,
) {
  const lineId =
    branchLines.value[
      visibleLineIndex
    ]?.id

  if (!lineId) {
    return visibleLineIndex
  }

  const layoutIndex =
    branchLayoutLines.value.findIndex(
      branchLine =>
        branchLine.id === lineId,
    )

  return layoutIndex >= 0
    ? layoutIndex
    : visibleLineIndex
}

const lineWidth = computed(() => {
  if (project.line.mode === 'TRAM') {
    return Math.max(
      0.18,
      lineContext.lineThickness.value * 0.55,
    )
  }

  return lineContext.lineThickness.value
})

/*
 * Espace minimum entre deux lignes secondaires.
 *
 * Même lorsque les arrêts ne demandent aucun espace
 * particulier, deux traits ne doivent plus se toucher.
 */
const minimumLineGap = computed(
  () =>
    Math.max(
      /*
       * CORRIDOR D / S :
       *
       * On ne déforme plus les Fork et on ne déplace plus
       * individuellement les noms / correspondances.
       *
       * Une Fork symétrique d'origine occupe 2.75em vers
       * l'intérieur de son rail. Avec une Fork D et une Fork S,
       * il faut donc au moins 5.5em entre leurs centres, plus
       * l'épaisseur des traits et une respiration visuelle.
       *
       * En imposant ce minimum GLOBAL, la ligne S entière descend
       * de façon cohérente partout : avant, pendant et après les Fork.
       * Les raccords restent donc alignés.
       */
      5.85,
      lineWidth.value * 0.35,
    ),
)

/*
 * Espace mesuré entre la ligne principale et
 * la ligne supplémentaire la plus proche.
 *
 * Cette valeur est recalculée à partir de la hauteur
 * réelle des noms placés au-dessus de la ligne.
 */
const measuredPrimaryLineGap =
  ref(0)


/*
 * Minimum structurel calculé directement depuis les Fork du
 * SectionEditor parent. Il existe dès le premier rendu après F5.
 */
const getSectionStructuralPrimaryLineGap =
  inject<
    () => number
  >(
    'sectionStructuralPrimaryLineGapEm',
    () => 0,
  )

const sectionStructuralPrimaryLineGap =
  computed(() =>
    Math.max(
      0,
      getSectionStructuralPrimaryLineGap(),
    ),
  )

/*
 * Dans une sortie de Fork, le rail non bifurqué doit rester
 * exactement à la même hauteur que dans le corridor d'entrée.
 *
 * Fork.vue fournit donc l'écart D/S nécessaire à cette sortie.
 * C'est uniquement une valeur de rendu CSS, jamais persistée.
 */
const getForkOutputPrimaryLineGap =
  inject<
    (
      branchId: string,
    ) => number
  >(
    'forkOutputPrimaryLineGapForBranch',
    () => 0,
  )

const forkOutputPrimaryLineGap =
  computed(() =>
    Math.max(
      0,
      getForkOutputPrimaryLineGap(
        branch.value.id,
      ),
    ),
  )


/*
 * L'écart dynamique ne concerne que la séparation
 * immédiatement au-dessus de la ligne principale.
 *
 * Avec trois lignes ou plus, les lignes secondaires
 * restent compactes entre elles tandis que le bloc
 * complet s'écarte juste assez pour laisser respirer
 * les noms de la ligne principale.
 */
const primaryLineGap = computed(() => {
  if (
    branchLayoutLines.value.length <= 1
  ) {
    return 0
  }

  /*
   * Dans une sortie de Fork qui transporte une ligne tout droit,
   * l'écart imposé par la Fork est la géométrie de référence.
   * Le recalcul local ne doit jamais déplacer S après un F5.
   */
  if (
    forkOutputPrimaryLineGap.value > 0
  ) {
    return Math.max(
      minimumLineGap.value,
      forkOutputPrimaryLineGap.value,
    )
  }

  /*
   * La Section nous donne l'emprise verticale des Fork présentes :
   *
   *   primaryDown + secondaryUp + 0.68em de respiration.
   *
   * Avec le corridor D/S désormais volontairement large, cette
   * emprise ne doit plus REMPLACER l'écart de base : elle doit
   * s'AJOUTER à lui.
   *
   * C'est précisément ce qui manquait sur la portion avant la Fork :
   * S restait un cran plus haut, alors qu'après la Fork elle était
   * déjà descendue avec la géométrie de sortie.
   *
   * On retire seulement les 0.68em de respiration déjà inclus dans
   * le calcul structurel, afin de n'ajouter que le déplacement réel
   * provoqué par les Fork.
   */
  const structuralForkMovement =
    Math.max(
      0,
      sectionStructuralPrimaryLineGap.value
      - 0.68,
    )

  return Math.max(
    minimumLineGap.value
    + structuralForkMovement,
    measuredPrimaryLineGap.value,
    sectionStructuralPrimaryLineGap.value,
  )
})

/*
 * Espace situé APRÈS une ligne du tableau visuel.
 *
 * Le dernier espace avant la ligne principale est
 * dynamique. Tous les autres restent compacts.
 */
function gapAfterBranchLine(
  index: number,
) {
  /*
   * Le slot de primary existe toujours dans la géométrie,
   * même lorsque son trait est masqué.
   *
   * Le premier espace du corridor reste donc l'espace D/S.
   * C'est précisément ce qui empêche S de se recentrer.
   */
  if (
    branchLayoutLines.value.length > 1
    && index === 0
  ) {
    return primaryLineGap.value
  }

  return minimumLineGap.value
}

/*
 * Hauteur totale réelle du corridor.
 *
 * Elle comprend :
 * - l'épaisseur de chaque ligne ;
 * - chaque espace entre deux lignes.
 *
 * En mono-ligne, le résultat reste strictement égal
 * à l'épaisseur historique de la ligne.
 */
const totalLineWidth = computed(() => {
  /*
   * La hauteur du corridor repose sur les SLOTS logiques.
   * Ainsi une Branch S seule garde la même hauteur / position
   * qu'une S située sous D dans un corridor D + S.
   */
  const count =
    Math.max(
      1,
      branchLayoutLines.value.length,
    )

  let total =
    lineWidth.value * count

  for (
    let index = 0;
    index < count - 1;
    index++
  ) {
    total +=
      gapAfterBranchLine(index)
  }

  return total
})

/*
 * Position verticale d'une ligne dans le SVG,
 * exprimée en em à partir du haut du corridor.
 */
function branchLineOffsetEm(
  visibleLineIndex: number,
) {
  const index =
    branchLayoutIndex(
      visibleLineIndex,
    )

  let offset =
    lineWidth.value / 2

  for (
    let currentIndex = 0;
    currentIndex < index;
    currentIndex++
  ) {
    offset +=
      lineWidth.value
      + gapAfterBranchLine(
        currentIndex,
      )
  }

  return offset
}

/*
 * Le SVG travaille en pixels.
 *
 * Le projet utilise déjà --base-size comme facteur
 * de conversion ; on conserve donc exactement
 * la même logique que le rendu historique.
 */
function branchLineOffset(
  index: number,
) {
  return (
    sizeFactor.value
    * 16
    * branchLineOffsetEm(index)
  )
}

/*
 * Décalage d'une ligne par rapport au centre logique
 * historique de la Branch.
 *
 * Cette valeur est utilisée par les overlays
 * (hors tarification / hors plan) afin qu'ils suivent
 * chaque ligne séparément au lieu de remplir tout
 * l'espace blanc entre les lignes.
 */
function branchLineCenterOffset(
  index: number,
) {
  return (
    sizeFactor.value
    * 16
    * (
      branchLineOffsetEm(index)
      - totalLineWidth.value / 2
    )
  )
}


/*
 * =========================================================
 * ZONE DE DROP = RAIL RÉELLEMENT VISIBLE
 * =========================================================
 *
 * Une sortie de Fork peut conserver plusieurs SLOTS logiques
 * (ex. D + S) alors qu'un seul rail est réellement dessiné.
 *
 * Exemple Fork S :
 *   slot D conservé
 *   S visible plus bas
 *
 * Le rail S était donc correctement dessiné plus bas, mais la zone
 * VueDraggable de la Branch restait au CENTRE du corridor.
 * Visuellement on lâchait le Stop sur S, alors que la vraie zone de
 * drop se trouvait ailleurs.
 *
 * On déplace uniquement le CONTENEUR draggable sur l'unique rail
 * visible. Aucun rail, aucune Fork et aucune donnée du projet ne bouge.
 */
const branchDropRailOffsetPx =
  computed(() => {
    if (branchLines.value.length !== 1) {
      return 0
    }

    return branchLineCenterOffset(0)
  })

const branchDropRailOffsetCss =
  computed(
    () =>
      `${branchDropRailOffsetPx.value}px`,
  )

/*
 * Mesure la place réellement prise par les noms
 * d'arrêts situés AU-DESSUS de la ligne principale.
 *
 * Exemple :
 *
 * "Aéroport Charles de Gaulle"
 *
 * Si son bloc monte haut, la ligne supplémentaire
 * monte automatiquement juste assez pour ne pas
 * traverser le texte.
 *
 * Si les noms sont courts ou placés dessous,
 * l'écart revient naturellement au minimum.
 */
function updateMultiLineSpacing() {
  if (
    !el.value
    || branchLines.value.length <= 1
  ) {
    measuredPrimaryLineGap.value = 0
    return
  }

  /*
   * =========================================================
   * RÈGLE DU CORRIDOR : RIEN NE TOUCHE RIEN
   * =========================================================
   *
   * À ce stade D et S restent DEUX RAILS DROITS.
   * Une différence d'appartenance des arrêts ne crée JAMAIS
   * automatiquement une pente / une bifurcation.
   *
   * L'unique rôle de ce calcul est d'augmenter l'espace entre
   * la dernière ligne supplémentaire (au-dessus) et primary
   * (en dessous) lorsqu'un contenu visuel risque de toucher
   * l'autre rail :
   *
   * - point d'arrêt ;
   * - nom ;
   * - sous-titre / nom de lieu ;
   * - correspondances ;
   * - tout descendant visible du Stop.
   *
   * On mesure les débordements PAR RAPPORT AU CENTRE DE LEUR
   * PROPRE RAIL. Le résultat est donc stable : agrandir l'écart
   * ne s'ajoute pas au calcul suivant.
   */
  const upperLine =
    branchLines.value[
      branchLines.value.length - 2
    ]

  const lowerLine =
    branchLines.value[
      branchLines.value.length - 1
    ]

  if (!upperLine || !lowerLine) {
    measuredPrimaryLineGap.value = 0
    return
  }

  const upperRail =
    el.value.querySelector<SVGGElement>(
      `.line > svg [data-line-id="${CSS.escape(upperLine.id)}"]`,
    )

  const lowerRail =
    el.value.querySelector<SVGGElement>(
      `.line > svg [data-line-id="${CSS.escape(lowerLine.id)}"]`,
    )

  if (!upperRail || !lowerRail) {
    measuredPrimaryLineGap.value =
      minimumLineGap.value
    return
  }

  const upperRailRect =
    upperRail.getBoundingClientRect()

  const lowerRailRect =
    lowerRail.getBoundingClientRect()

  const upperCenterY =
    upperRailRect.top
    + upperRailRect.height / 2

  const lowerCenterY =
    lowerRailRect.top
    + lowerRailRect.height / 2

  let upperDownPx =
    upperRailRect.height / 2

  let lowerUpPx =
    lowerRailRect.height / 2

  const stopElements =
    el.value.querySelectorAll<HTMLElement>(
      '.stop-wrapper',
    )

  function displayedIds(
    stopElement: HTMLElement,
  ) {
    const ids =
      (stopElement.getAttribute(
        'data-line-ids',
      ) ?? '')
        .split(/\s+/)
        .map(id => id.trim())
        .filter(Boolean)

    return ids.length > 0
      ? ids
      : implicitStopLineIdsForBranch()
  }

  function visibleRects(
    stopElement: HTMLElement,
  ) {
    const candidates = [
      stopElement,
      ...Array.from(
        stopElement.querySelectorAll<HTMLElement>(
          '*',
        ),
      ),
    ]

    return candidates
      .filter((candidate) => {
        const style =
          window.getComputedStyle(candidate)

        if (
          style.display === 'none'
          || style.visibility === 'hidden'
          || Number.parseFloat(
            style.opacity || '1',
          ) === 0
        ) {
          return false
        }

        const rect =
          candidate.getBoundingClientRect()

        return (
          rect.width > 0
          && rect.height > 0
        )
      })
      .map(candidate =>
        candidate.getBoundingClientRect(),
      )
  }

  stopElements.forEach((stopElement) => {
    const ids =
      displayedIds(stopElement)

    /*
     * Un arrêt partagé appartient aux deux rails :
     * son marqueur de liaison est volontairement autorisé à
     * occuper l'espace ENTRE les rails. On ne l'utilise donc
     * pas pour repousser artificiellement D et S à l'infini.
     *
     * Les arrêts exclusifs, eux, doivent rester entièrement
     * dans leur propre territoire.
     */
    if (ids.length !== 1) {
      return
    }

    const [lineId] = ids
    const rects =
      visibleRects(stopElement)

    if (lineId === upperLine.id) {
      rects.forEach((rect) => {
        upperDownPx =
          Math.max(
            upperDownPx,
            rect.bottom - upperCenterY,
          )
      })
    }

    if (lineId === lowerLine.id) {
      rects.forEach((rect) => {
        lowerUpPx =
          Math.max(
            lowerUpPx,
            lowerCenterY - rect.top,
          )
      })
    }
  })

  /*
   * =========================================================
   * FOURCHES : CLEARANCE DÉTERMINISTE
   * =========================================================
   *
   * SectionEditor expose l'encombrement intrinsèque des Fork
   * en em via des variables CSS. On ne dépend donc plus de la
   * position DOM actuelle des Fork, ce qui supprime la différence
   * entre le rendu immédiat et le rendu après F5.
   */
  const sectionStyle =
    window.getComputedStyle(
      el.value,
    )

  function inheritedEm(
    name: string,
  ) {
    const value =
      Number.parseFloat(
        sectionStyle
          .getPropertyValue(name)
          .trim(),
      )

    return Number.isFinite(value)
      ? Math.max(0, value)
      : 0
  }

  const forkPrimaryDownEm =
    inheritedEm(
      '--fork-primary-down-em',
    )

  const forkSecondaryUpEm =
    inheritedEm(
      '--fork-secondary-up-em',
    )


  const pixelsPerEm =
    Math.max(
      1,
      sizeFactor.value * 16,
    )

  /*
   * D est le rail principal haut, S (ou autre ligne additionnelle)
   * est située dessous. La Fork D peut déborder vers le bas et la
   * Fork secondaire vers le haut.
   */
  if (upperLine.id === 'primary') {
    upperDownPx =
      Math.max(
        upperDownPx,
        forkPrimaryDownEm
        * pixelsPerEm
        + lineWidth.value
        * pixelsPerEm / 2,
      )
  }

  if (lowerLine.id !== 'primary') {
    lowerUpPx =
      Math.max(
        lowerUpPx,
        forkSecondaryUpEm
        * pixelsPerEm
        + lineWidth.value
        * pixelsPerEm / 2,
      )
  }

  const safetyPx =
    Math.max(
      12,
      /*
       * Le corridor est maintenant plus large globalement.
       * Cette marge garde encore de l'air autour des noms et
       * correspondances, sans déplacer leur contenu séparément.
       */
      pixelsPerEm * 0.82,
    )

  /*
   * Distance nécessaire entre les CENTRES des deux rails.
   */
  const requiredCentersPx =
    upperDownPx
    + lowerUpPx
    + safetyPx

  /*
   * gapAfterBranchLine() représente l'espace LIBRE entre les
   * deux traits, donc on retire une épaisseur complète de rail.
   */
  const requiredGapEm =
    Math.max(
      minimumLineGap.value,
      requiredCentersPx / pixelsPerEm
      - lineWidth.value,
    )

  if (
    Math.abs(
      measuredPrimaryLineGap.value
      - requiredGapEm,
    ) > 0.02
  ) {
    measuredPrimaryLineGap.value =
      requiredGapEm
  }
}

/*
 * Un assemblage correspond à une suite complète
 * d'arrêts consécutifs possédant exactement
 * le même ensemble de correspondances.
 */
interface ConnectionBridge {
  key: string
  path: string
}

const connectionBridges =
  ref<ConnectionBridge[]>([])


/*
 * Prolongement très simple d'un rail jusqu'à la Fork suivante.
 *
 * La Branch garde la main sur son propre rail :
 * elle ne change ni de ligne, ni de hauteur, ni de topologie.
 * Elle continue seulement horizontalement jusqu'à l'entrée
 * de la bifurcation qui cible cette même ligne.
 */
interface LineToForkExtension {
  key: string
  lineId: string
  path: string
  color: string
}

const lineToForkExtensions =
  ref<LineToForkExtension[]>([])

let lineToForkMutationObserver:
  MutationObserver | null = null

interface OutOfFareZoneSegment {
  key: string
  startX: number
  endX: number
}

const outOfFareZoneSegments =
  ref<OutOfFareZoneSegment[]>([])

/*
 * Segments visuels liés aux arrêts
 * "hors plan / atténués".
 *
 * SOLID :
 * raccord entre un arrêt normal
 * et un arrêt hors plan.
 *
 * DASHED :
 * raccord entre deux arrêts
 * hors plan consécutifs.
 */
interface OffLineSegment {
  key: string
  startX: number
  endX: number
  style: 'SOLID' | 'DASHED'
}

const offLineSegments =
  ref<OffLineSegment[]>([])

/*
 * =========================================================
 * SÉPARATION LÉGÈRE DES LIGNES
 * =========================================================
 *
 * Lorsqu'un corridor commun se termine sur un arrêt
 * partagé, cet arrêt devient le point de départ d'une
 * vraie séparation visuelle.
 *
 * Chaque rail :
 * - reste d'abord droit après le dernier arrêt commun ;
 * - réserve automatiquement la place prise par les
 *   correspondances de cet arrêt ;
 * - commence ensuite une vraie diagonale haute et nette ;
 * - continue enfin parfaitement droit dans sa
 *   nouvelle position.
 *
 * Il ne s'agit plus d'une petite courbe douce :
 * le rendu doit réellement se lire comme une fourche.
 */
interface MultiLineSeparationCue {
  key: string
  path: string
  color: string
  maskPath?: string
}

const multiLineSeparationCues =
  ref<MultiLineSeparationCue[]>([])

/*
 * =========================================================
 * CHANGEMENT D'IDENTITÉ DE LIGNE APRÈS UN ARRÊT
 * =========================================================
 *
 * StopPropertiesDialog peut maintenant définir librement
 * l'identité utilisée après un arrêt :
 *
 * - mode ;
 * - indice ;
 * - couleur automatique issue de l'indice.
 *
 * Cette nouvelle identité n'a PAS besoin d'exister dans
 * "Lignes de cette branche".
 *
 * Exemple :
 *
 * RER C -------- Versailles -------- Ligne V
 *
 * La branche reste donc mono-ligne si on le souhaite,
 * mais une portion du même tracé peut changer d'identité.
 *
 * lineAfterStopId est conservé uniquement pour les projets
 * créés avec la première version expérimentale du système.
 */
type MultiLineTransitionStopData = Stop['$stop'] & {
  lineIds?: string[]
  lineAfterStopId?: string | null
  lineAfterStopMode?: Mode | null
  lineAfterStopIndex?: LineIndex | null
  lineAfterStopColor?: string | null
}

interface TransitionLineIdentity {
  id: string
  mode: Mode
  index: LineIndex | null
  color: string
}

interface LineIdentityChangeVisual {
  key: string
  path: string
  color: string
  sourceLineId: string
  startX: number
  endX: number
}

const lineIdentityChangeVisuals =
  ref<LineIdentityChangeVisual[]>([])

/*
 * Retrouve l'identité demandée après un arrêt.
 *
 * Priorité :
 *
 * 1. nouvelle identité libre enregistrée directement
 *    sur l'arrêt ;
 * 2. ancien lineAfterStopId, pour compatibilité avec
 *    les projets déjà créés pendant nos essais.
 */
function transitionIdentityAfterStop(
  stop: Stop,
): TransitionLineIdentity | null {
  const data = stop.$stop as MultiLineTransitionStopData

  if (data.lineAfterStopMode) {
    return {
      id:
        `transition-${stop.id}`,
      mode:
        data.lineAfterStopMode,
      index:
        data.lineAfterStopIndex
        ?? null,
      color:
        data.lineAfterStopColor
        || '#000000',
    }
  }

  if (!data.lineAfterStopId) {
    return null
  }

  const branchLine =
    branchLines.value.find(
      line =>
        line.id === data.lineAfterStopId,
    )

  if (!branchLine) {
    return null
  }

  return {
    id:
      branchLine.id,
    mode:
      branchLine.mode,
    index:
      branchLine.index,
    color:
      branchLine.color,
  }
}

let resizeObserver:
  ResizeObserver | null = null

let mutationObserver:
  MutationObserver | null = null

/*
 * Observe les éléments structurels voisins (notamment les Fork)
 * dans la même Section. Sans cela, une Fork ajoutée APRÈS le
 * montage de la Branch n'entrait dans le calcul d'espacement
 * qu'au prochain rechargement de page.
 */
let sectionStyleObserver:
  MutationObserver | null = null

let bridgeUpdateFrame:
  number | null = null

/*
 * Liste logique des arrêts de la branche.
 *
 * Spacer et AreaSeparator servent uniquement
 * au dessin : ils n'interrompent pas la suite
 * logique des stations.
 */
const branchStops = computed(() =>
  elements.value.filter(
    (element): element is Stop =>
      '$stop' in element,
  ),
)


interface ParentForkContext {
  fork: Fork
  sourceBranch: Branch
  outputIndex: 0 | 1
}

/*
 * Retrouve la Fork propriétaire de CETTE Branch directement dans
 * project.line.topology.
 *
 * Aucun DOM n'est utilisé ici. Donc le résultat est identique :
 * - juste après l'édition ;
 * - après F5.
 */
function findParentForkContext(
  targetBranchId: string,
): ParentForkContext | null {
  type LinkedForkData =
    Fork['$fork'] & {
      parallelBranchesId?: string
    }

  type LinkedParallelData =
    ParallelBranches['$parallelBranches'] & {
      forkId?: string
    }

  function sourceBranchForFork(
    elements: LineElement[],
    forkIndex: number,
    fork: Fork,
  ): Branch | null {
    const step =
      fork.$fork.toward === 'LEFT'
        ? 1
        : -1

    for (
      let index = forkIndex + step;
      index >= 0
      && index < elements.length;
      index += step
    ) {
      const candidate =
        elements[index]

      if ('$branch' in candidate) {
        return candidate
      }

      if ('$parallelBranches' in candidate) {
        continue
      }

      if ('$fork' in candidate) {
        break
      }
    }

    return null
  }

  function scanSection(
    currentSection: LineSection,
    ownerFork: Fork | null = null,
    ownerForkSourceBranch: Branch | null = null,
    ownerOutputIndex: 0 | 1 | null = null,
  ): ParentForkContext | null {
    const sectionElements =
      currentSection.$lineSection.elements
      ?? []

    for (
      let elementIndex = 0;
      elementIndex < sectionElements.length;
      elementIndex++
    ) {
      const element =
        sectionElements[elementIndex]

      if ('$branch' in element) {
        if (
          element.id === targetBranchId
          && ownerFork
          && ownerForkSourceBranch
          && ownerOutputIndex !== null
        ) {
          return {
            fork:
              ownerFork,

            sourceBranch:
              ownerForkSourceBranch,

            outputIndex:
              ownerOutputIndex,
          }
        }

        continue
      }

      if ('$parallelBranches' in element) {
        const linkedForkId =
          (
            element.$parallelBranches as LinkedParallelData
          ).forkId

        const linkedForkIndex =
          linkedForkId
            ? sectionElements.findIndex(
                candidate =>
                  '$fork' in candidate
                  && candidate.id
                    === linkedForkId,
              )
            : -1

        const linkedFork =
          linkedForkIndex >= 0
            ? sectionElements[
                linkedForkIndex
              ]
            : null

        const actualFork =
          linkedFork
          && '$fork' in linkedFork
            ? linkedFork
            : ownerFork

        const actualSourceBranch =
          actualFork
          && '$fork' in actualFork
          && linkedForkIndex >= 0
            ? sourceBranchForFork(
                sectionElements,
                linkedForkIndex,
                actualFork,
              )
            : ownerForkSourceBranch

        const childSections =
          element.$parallelBranches.sections
          ?? []

        for (
          let index = 0;
          index < childSections.length;
          index++
        ) {
          const found =
            scanSection(
              childSections[index],
              actualFork,
              actualSourceBranch,
              linkedForkIndex >= 0
                ? index as 0 | 1
                : ownerOutputIndex,
            )

          if (found) {
            return found
          }
        }

        continue
      }

      if ('$fork' in element) {
        const linkedPairId =
          (
            element.$fork as LinkedForkData
          ).parallelBranchesId

        /*
         * Une Fork appairée possède ses sorties dans le vrai
         * ParallelBranches sibling, qui sera parcouru séparément.
         */
        if (linkedPairId) {
          continue
        }

        /*
         * Compatibilité avec les anciens projets encore autonomes.
         */
        const sourceBranch =
          sourceBranchForFork(
            sectionElements,
            elementIndex,
            element,
          )

        if (!sourceBranch) {
          continue
        }

        const childSections =
          element.$fork.sections
          ?? []

        for (
          let index = 0;
          index < childSections.length;
          index++
        ) {
          const found =
            scanSection(
              childSections[index],
              element,
              sourceBranch,
              index as 0 | 1,
            )

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const rootSection
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(
        rootSection,
      )

    if (found) {
      return found
    }
  }

  return null
}


function stopRequestedLineIds() {
  const ids =
    new Set<string>()

  for (
    const stop
    of branchStops.value
  ) {
    const stored =
      (
        stop.$stop as Stop['$stop'] & {
          lineIds?: string[]
        }
      ).lineIds

    if (
      !stored
      || stored.length === 0
    ) {
      implicitStopLineIdsForBranch()
        .forEach(
          lineId =>
            ids.add(lineId),
        )

      continue
    }

    stored.forEach(
      lineId =>
        ids.add(lineId),
    )
  }

  return ids
}

/*
 * Une ligne non ciblée par la Fork n'a le droit de continuer que
 * dans UNE sortie.
 *
 * D + S, Fork D :
 * - sortie haute : D
 * - sortie basse : D + S
 */
function lineBelongsToForkOutput(
  context: ParentForkContext,
  lineId: string,
) {
  const targetLineId =
    context.fork.$fork.lineId
    || 'primary'

  if (lineId === targetLineId) {
    return true
  }

  const inputIds = [
    ...(
      context.sourceBranch.$branch.primaryLineVisible
      !== false
        ? ['primary']
        : []
    ),

    ...(
      context.sourceBranch.$branch.additionalLines
      ?? []
    ).map(
      line =>
        line.id,
    ),
  ]

  const targetRank =
    inputIds.indexOf(
      targetLineId,
    )

  const lineRank =
    inputIds.indexOf(
      lineId,
    )

  if (
    targetRank < 0
    || lineRank < 0
  ) {
    return false
  }

  const topOutputIndex: 0 | 1 =
    context.fork.$fork.linksOffset[0]
      >= context.fork.$fork.linksOffset[1]
      ? 0
      : 1

  const bottomOutputIndex: 0 | 1 =
    topOutputIndex === 0
      ? 1
      : 0

  const destination =
    lineRank < targetRank
      ? topOutputIndex
      : bottomOutputIndex

  return (
    destination
    === context.outputIndex
  )
}

/*
 * C'est le déclencheur qui manquait.
 *
 * Quand l'utilisateur coche S sur un arrêt de la sortie :
 * Branch.vue ajoute immédiatement S à CETTE Branch de sortie,
 * uniquement si S existe dans le corridor d'entrée et si cette
 * sortie est bien celle dans laquelle S doit continuer.
 *
 * passthroughLineIds garde ensuite S invisible dès qu'aucun arrêt
 * ne la demande.
 */
function ensureRequestedForkLinesImmediately() {
  const context =
    findParentForkContext(
      branch.value.id,
    )

  if (!context) {
    return
  }

  const requested =
    stopRequestedLineIds()

  if (requested.size === 0) {
    return
  }

  const targetLineId =
    context.fork.$fork.lineId
    || 'primary'

  const branchData =
    branch.value.$branch as BranchWithPassthrough

  const nextPassthrough =
    new Set(
      branchData.passthroughLineIds
      ?? [],
    )

  for (
    const lineId
    of requested
  ) {
    if (
      !lineBelongsToForkOutput(
        context,
        lineId,
      )
    ) {
      continue
    }

    if (lineId === 'primary') {
      if (
        branch.value.$branch.primaryLineVisible
        === false
      ) {
        branch.value.$branch.primaryLineVisible =
          true
      }

      if (
        targetLineId !== 'primary'
      ) {
        nextPassthrough.add(
          'primary',
        )
      }

      continue
    }

    const sourceLine =
      (
        context.sourceBranch
          .$branch
          .additionalLines
        ?? []
      ).find(
        line =>
          line.id === lineId,
      )

    if (!sourceLine) {
      continue
    }

    const alreadyPresent =
      (
        branch.value.$branch.additionalLines
        ?? []
      ).some(
        line =>
          line.id === lineId,
      )

    if (!alreadyPresent) {
      branch.value.$branch.additionalLines = [
        ...(
          branch.value.$branch.additionalLines
          ?? []
        ),
        {
          ...sourceLine,
        },
      ]
    }

    if (
      lineId !== targetLineId
    ) {
      nextPassthrough.add(
        lineId,
      )
    }
  }

  const nextPassthroughIds =
    Array.from(
      nextPassthrough,
    )

  if (
    JSON.stringify(
      branchData.passthroughLineIds
      ?? [],
    )
    !== JSON.stringify(
      nextPassthroughIds,
    )
  ) {
    branchData.passthroughLineIds =
      nextPassthroughIds
  }
}

const stopLineMembershipSignature =
  computed(() =>
    JSON.stringify(
      branchStops.value.map(
        stop => ({
          id:
            stop.id,

          lineIds:
            (
              stop.$stop as Stop['$stop'] & {
                lineIds?: string[]
              }
            ).lineIds
            ?? [],
        }),
      ),
    ),
  )

watch(
  stopLineMembershipSignature,
  async () => {
    ensureRequestedForkLinesImmediately()

    await nextTick()

    scheduleConnectionBridgeUpdate()
  },
  {
    immediate: true,
    flush: 'post',
  },
)

/*
 * Groupe logique d'arrêts consécutifs situés
 * hors de la zone tarifaire principale.
 */
interface OutOfFareZoneGroup {
  key: string
  stops: Stop[]
}

interface OutOfFareZoneVisualZone {
  key: string
  startX: number
  endX: number
  top: number
  bottom: number
  labelTop: number
}

const outOfFareZoneVisualZones =
  ref<OutOfFareZoneVisualZone[]>([])

/*
 * Détecte automatiquement les groupes d'arrêts
 * consécutifs marqués "Hors de la zone tarifaire".
 *
 * Spacer et AreaSeparator sont ignorés puisque
 * branchStops contient uniquement les arrêts.
 *
 * Un arrêt normal interrompt immédiatement le groupe.
 */
const outOfFareZoneGroups = computed<
  OutOfFareZoneGroup[]
>(() => {
  const groups: OutOfFareZoneGroup[] = []

  let currentGroup: Stop[] = []

  function addCurrentGroup() {
    if (currentGroup.length === 0) {
      return
    }

    groups.push({
      /*
       * L'identité de la zone repose sur les arrêts
       * réellement hors tarification.
       *
       * Elle reste donc indépendante des autres
       * groupes présents dans la branche.
       */
      key:
        `out-of-fare-zone-group`
        + `-${currentGroup
          .map(stop => stop.id)
          .join('-')}`,
      stops: currentGroup,
    })

    currentGroup = []
  }

  branchStops.value.forEach((stop) => {
    if (stop.$stop.outOfFareZone === true) {
      currentGroup.push(stop)
      return
    }

    /*
     * Un arrêt normal coupe obligatoirement
     * la zone hors tarification.
     */
    addCurrentGroup()
  })

  addCurrentGroup()

  return groups
})

/*
 * Retrouve l'élément DOM correspondant
 * à un arrêt précis.
 */
function findStopElement(
  stopId: string,
) {
  if (!el.value) {
    return null
  }

  const stopElements =
    el.value.querySelectorAll<HTMLElement>(
      '.stop-wrapper[data-id]',
    )

  return Array.from(
    stopElements,
  ).find(
    stopElement =>
      stopElement.getAttribute('data-id')
      === stopId,
  ) ?? null
}

/*
 * Lit l'appartenance multi-lignes exposée par Stop.vue.
 *
 * Un arrêt ancien ou dépourvu de data-line-ids reste
 * considéré comme appartenant à la ligne principale.
 */
function stopDisplayedLineIds(
  stopElement: HTMLElement,
) {
  const ids =
    (stopElement.getAttribute('data-line-ids') ?? '')
      .split(/\s+/)
      .map(id => id.trim())
      .filter(Boolean)

  if (ids.length > 0) {
    return ids
  }

  /*
   * Compatibilité :
   * - corridor normal : ancien arrêt => primary ;
   * - Branch S seule : ancien arrêt => première ligne visible,
   *   afin de ne pas remettre le Stop au centre du slot primary.
   */
  return implicitStopLineIdsForBranch()
}

/*
 * Appartenance logique d'un arrêt lue directement dans
 * les données du projet.
 *
 * On conserve exactement la même compatibilité que Stop.vue :
 * un ancien arrêt sans lineIds appartient à "primary".
 */
function stopStoredLineIds(
  stop: Stop,
) {
  const data =
    stop.$stop as MultiLineTransitionStopData

  const stored =
    data.lineIds

  if (
    !stored
    || stored.length === 0
  ) {
    return implicitStopLineIdsForBranch()
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

  return validIds.length > 0
    ? validIds
    : (
        branchLines.value[0]
          ? [branchLines.value[0].id]
          : ['primary']
      )
}

/*
 * Ligne physique sur laquelle on applique le changement.
 *
 * Une transition libre ne crée pas un deuxième rail :
 * elle repeint le rail réellement desservi par l'arrêt.
 *
 * Si l'arrêt est partagé par plusieurs lignes, on préfère
 * la ligne principale lorsqu'elle fait partie de l'arrêt ;
 * sinon on utilise la première ligne desservie.
 *
 * Une sélection explicite du rail source pourra être ajoutée
 * plus tard pour les cas multi-lignes très complexes.
 */
function sourceLineIdForIdentityChange(
  stop: Stop,
) {
  const ids =
    stopStoredLineIds(stop)

  if (ids.includes('primary')) {
    return 'primary'
  }

  return (
    ids[0]
    ?? 'primary'
  )
}

/*
 * Construit les portions colorées correspondant aux
 * changements d'identité enregistrés sur les arrêts.
 *
 * Le chemin part exactement du centre de l'arrêt.
 * Il s'arrête au prochain changement d'identité, ou à
 * l'extrémité de la branche.
 *
 * Les points intermédiaires suivent les positions réelles
 * des arrêts du rail source afin de rester compatibles avec
 * la géométrie multi-lignes et les fourches déjà calculées.
 */
function updateLineIdentityChangeVisuals() {
  if (
    !el.value
    || !line.value
  ) {
    lineIdentityChangeVisuals.value = []
    return
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const lineRect =
    line.value.getBoundingClientRect()

  const corridorCenterY =
    lineRect.top
    - wrapperRect.top
    + lineRect.height / 2

  const stopElements =
    branchStops.value.map(
      stop =>
        findStopElement(stop.id),
    )

  /*
   * On repart toujours d'un état propre avant de recolorer
   * les marqueurs d'arrêt appartenant à une portion changée.
   */
  stopElements.forEach((stopElement) => {
    if (!stopElement) {
      return
    }

    stopElement.classList.remove(
      'line-identity-changed-stop',
    )

    stopElement.style.removeProperty(
      '--line-identity-change-color',
    )
  })

  /*
   * Une case cochée indique que cet arrêt appartient à la
   * portion dont l'identité a changé.
   *
   * Des arrêts consécutifs ayant exactement la même nouvelle
   * identité sont donc fusionnés en UNE seule portion.
   *
   * Exemple :
   *
   * Versailles [V]
   * Petit Jouy [V]
   * Jouy [V]
   * ...
   * Massy-Palaiseau [V]
   *
   * => un seul segment V de Versailles à Massy-Palaiseau.
   *
   * Dès que l'arrêt suivant n'est plus coché, la nouvelle
   * couleur s'arrête au dernier arrêt coché.
   */
  type TransitionRange = {
    startIndex: number
    endIndex: number
    sourceLineId: string
    identity: TransitionLineIdentity
  }

  const ranges: TransitionRange[] = []

  let currentRange:
    TransitionRange | null = null

  function sameIdentity(
    first: TransitionLineIdentity,
    second: TransitionLineIdentity,
  ) {
    /*
     * LineIndex peut être un objet.
     *
     * Deux arrêts configurés séparément avec le même indice
     * peuvent donc posséder deux objets différents en mémoire.
     * Une comparaison avec === les considérait à tort comme
     * deux lignes différentes et cassait la plage en segments
     * d'un seul arrêt, qui étaient ensuite ignorés.
     *
     * On compare maintenant leur contenu réel.
     */
    const firstIndex =
      JSON.stringify(
        first.index ?? null,
      )

    const secondIndex =
      JSON.stringify(
        second.index ?? null,
      )

    return (
      first.mode === second.mode
      && firstIndex === secondIndex
      && first.color === second.color
    )
  }

  branchStops.value.forEach(
    (stop, stopIndex) => {
      const identity =
        transitionIdentityAfterStop(stop)

      if (!identity) {
        if (currentRange) {
          ranges.push(currentRange)
          currentRange = null
        }

        return
      }

      const sourceLineId =
        sourceLineIdForIdentityChange(
          stop,
        )

      if (
        currentRange
        && currentRange.endIndex
          === stopIndex - 1
        && currentRange.sourceLineId
          === sourceLineId
        && sameIdentity(
          currentRange.identity,
          identity,
        )
      ) {
        currentRange.endIndex =
          stopIndex

        return
      }

      if (currentRange) {
        ranges.push(currentRange)
      }

      currentRange = {
        startIndex: stopIndex,
        endIndex: stopIndex,
        sourceLineId,
        identity,
      }
    },
  )

  if (currentRange) {
    ranges.push(currentRange)
  }

  const visuals:
    LineIdentityChangeVisual[] = []

  ranges.forEach((range) => {
    const startElement =
      stopElements[range.startIndex]

    const endElement =
      stopElements[range.endIndex]

    if (
      !startElement
      || !endElement
    ) {
      return
    }

    const startX =
      stopAnchorX(
        startElement,
        wrapperRect,
      )

    const endX =
      stopAnchorX(
        endElement,
        wrapperRect,
      )

    /*
     * Une seule station cochée ne crée volontairement pas
     * une portion jusqu'au bout du plan.
     *
     * Il faut au moins deux arrêts pour définir une longueur
     * visible. Cela évite précisément qu'une ligne V parte
     * jusqu'aux Saules lorsqu'on voulait une zone locale.
     */
    if (endX <= startX) {
      return
    }

    const points:
      Array<{
        x: number
        y: number
      }> = []

    for (
      let stopIndex = range.startIndex;
      stopIndex <= range.endIndex;
      stopIndex++
    ) {
      const stopElement =
        stopElements[stopIndex]

      if (!stopElement) {
        continue
      }

      points.push({
        x:
          stopAnchorX(
            stopElement,
            wrapperRect,
          ),
        y:
          corridorCenterY
          + displayedLineCenterOffsetAtStop(
            range.sourceLineId,
            stopIndex,
            stopElements,
          ),
      })
    }

    if (points.length < 2) {
      return
    }

    /*
     * Les marqueurs des arrêts de la portion prennent eux aussi
     * l'identité de la nouvelle ligne.
     *
     * Les arrêts de correspondance / terminus conservent leurs
     * règles noires historiques grâce au CSS ciblé plus bas.
     */
    for (
      let stopIndex = range.startIndex;
      stopIndex <= range.endIndex;
      stopIndex++
    ) {
      const stopElement =
        stopElements[stopIndex]

      if (!stopElement) {
        continue
      }

      stopElement.classList.add(
        'line-identity-changed-stop',
      )

      stopElement.style.setProperty(
        '--line-identity-change-color',
        range.identity.color,
      )
    }

    const path =
      points
        .map(
          (point, pointIndex) =>
            `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
        )
        .join(' ')

    visuals.push({
      key:
        `line-identity-range`
        + `-${range.startIndex}`
        + `-${range.endIndex}`
        + `-${range.identity.mode}`
        + `-${String(
          range.identity.index ?? '',
        )}`,
      path,
      color:
        range.identity.color,
      sourceLineId:
        range.sourceLineId,
      startX,
      endX,
    })
  })

  lineIdentityChangeVisuals.value =
    visuals
}

/*
 * Segments de la ligne historique qui doivent rester visibles.
 *
 * Contrairement aux versions précédentes, on ne recouvre plus
 * l'ancienne couleur avec un trait plus large.
 *
 * On NE DESSINE tout simplement PAS la couleur d'origine sous
 * une portion dont l'identité change.
 *
 * Résultat :
 * - aucun liseré jaune possible ;
 * - aucune surépaisseur ;
 * - aucune bordure artificielle.
 */
function baseLineVisibleSegments(
  lineId: string,
) {
  const ranges =
    lineIdentityChangeVisuals.value
      .filter(
        visual =>
          visual.sourceLineId === lineId,
      )
      .map(visual => ({
        startX:
          Math.max(
            0,
            Math.min(
              branchLength.value,
              visual.startX,
            ),
          ),
        endX:
          Math.max(
            0,
            Math.min(
              branchLength.value,
              visual.endX,
            ),
          ),
      }))
      .filter(
        range =>
          range.endX > range.startX,
      )
      .sort(
        (first, second) =>
          first.startX - second.startX,
      )

  if (ranges.length === 0) {
    return [
      {
        key: `${lineId}-full`,
        startX: 0,
        endX: branchLength.value,
      },
    ]
  }

  const segments:
    Array<{
      key: string
      startX: number
      endX: number
    }> = []

  let cursor = 0

  ranges.forEach((range, index) => {
    if (range.startX > cursor) {
      segments.push({
        key:
          `${lineId}-before-${index}`,
        startX: cursor,
        endX: range.startX,
      })
    }

    cursor =
      Math.max(
        cursor,
        range.endX,
      )
  })

  if (cursor < branchLength.value) {
    segments.push({
      key: `${lineId}-after`,
      startX: cursor,
      endX: branchLength.value,
    })
  }

  return segments
}

/*
 * Portions de remplacement d'une ligne donnée.
 *
 * En mono-ligne elles sont dessinées directement dans le
 * même <g> SVG que la ligne historique. Cela garantit une
 * hauteur strictement identique, au pixel près.
 */
function lineIdentitySegmentsForLine(
  lineId: string,
) {
  return lineIdentityChangeVisuals.value
    .filter(
      visual =>
        visual.sourceLineId === lineId,
    )
    .map(visual => ({
      key: `${visual.key}-same-rail`,
      startX: visual.startX,
      endX: visual.endX,
      color: visual.color,
    }))
}


/*
 * Mesure l'espace horizontal réellement occupé par les
 * correspondances au dernier arrêt commun.
 *
 * La fourche ne doit jamais démarrer au milieu des
 * pictogrammes RER / Tram / Bus / etc.
 *
 * On laisse donc les deux rails continuer DROITS après
 * l'arrêt, juste assez longtemps pour dépasser le bloc
 * de correspondances, puis seulement on commence la pente.
 *
 * Si l'arrêt n'a presque rien dessous, le tronçon droit
 * reste court : aucun grand espace fixe inutile.
 */
function forkStraightClearance(
  forkElement: HTMLElement,
  wrapperRect: DOMRect,
  direction: number,
) {
  const forkX =
    stopAnchorX(
      forkElement,
      wrapperRect,
    )

  const connections =
    forkElement.querySelector<HTMLElement>(
      '.connections',
    )

  /*
   * Même sans correspondance, une petite portion droite
   * rend la naissance de la fourche beaucoup plus propre.
   */
  const minimumClearance =
    Math.max(
      16,
      sizeFactor.value * 16 * 0.9,
    )

  if (!connections) {
    return minimumClearance
  }

  const visualElements = [
    connections,
    ...Array.from(
      connections.querySelectorAll<HTMLElement>(
        '*',
      ),
    ),
  ]

  let furthestX =
    forkX

  visualElements.forEach((element) => {
    const style =
      window.getComputedStyle(element)

    if (
      style.display === 'none'
      || style.visibility === 'hidden'
    ) {
      return
    }

    const rect =
      element.getBoundingClientRect()

    if (
      rect.width === 0
      || rect.height === 0
    ) {
      return
    }

    if (direction >= 0) {
      furthestX =
        Math.max(
          furthestX,
          rect.right - wrapperRect.left,
        )
    }
    else {
      furthestX =
        Math.min(
          furthestX,
          rect.left - wrapperRect.left,
        )
    }
  })

  const occupied =
    direction >= 0
      ? furthestX - forkX
      : forkX - furthestX

  const safetyPadding =
    Math.max(
      10,
      sizeFactor.value * 16 * 0.55,
    )

  return Math.max(
    minimumClearance,
    occupied + safetyPadding,
  )
}

/*
 * =========================================================
 * POSITION RÉELLE DES ARRÊTS SUR LEURS LIGNES
 * =========================================================
 *
 * Stop.vue expose maintenant data-line-ids.
 *
 * Branch.vue connaît, lui, la position verticale exacte de
 * chaque rail, y compris l'écart dynamique calculé à partir
 * des noms d'arrêts.
 *
 * On réunit donc ici les deux informations :
 *
 * - arrêt sur une seule ligne :
 *   son marqueur / nom / correspondances suivent ce rail ;
 *
 * - arrêt partagé :
 *   son centre est placé au milieu des rails sélectionnés
 *   et on expose la hauteur totale à Stop.vue via des
 *   variables CSS pour construire ensuite un marqueur commun.
 *
 * IMPORTANT :
 * on utilise "top" sur le wrapper plutôt que "transform"
 * afin de ne pas gêner VueDraggable / les autres effets qui
 * peuvent déjà utiliser transform.
 */
/*
 * =========================================================
 * RÉPARTITION HORIZONTALE INDÉPENDANTE APRÈS UNE FOURCHE
 * =========================================================
 *
 * Une Branch conserve une seule liste d'éléments pour rester
 * compatible avec tout l'éditeur existant.
 *
 * Visuellement, en revanche, chaque ligne séparée doit avoir
 * sa PROPRE suite d'arrêts.
 *
 * Sans ce recalcul, les arrêts du Métro 17 peuvent se retrouver
 * "après" tous ceux du Métro 16 simplement parce qu'ils arrivent
 * plus tard dans le tableau global.
 *
 * Ici :
 * - le dernier arrêt commun reste le point de départ ;
 * - les arrêts exclusifs de chaque ligne sont redistribués
 *   indépendamment entre la fourche et la fin du tracé ;
 * - le premier arrêt du 17 commence donc juste après la fourche,
 *   exactement comme le premier arrêt du 16.
 */
function updateMultiLineStopHorizontalPositions() {
  if (!el.value) {
    return
  }

  /*
   * Sans bifurcation implicite, tous les arrêts conservent leur
   * position horizontale naturelle dans la Branch.
   *
   * Une future Fork explicite pourra gérer ses propres sections
   * enfants sans déplacer artificiellement les arrêts du corridor.
   */
  branchStops.value.forEach((stop) => {
    const stopElement =
      findStopElement(stop.id)

    if (stopElement) {
      stopElement.style.left = ''
    }
  })
}

function displayedLineCenterOffsetAtStop(
  lineId: string,
  _stopIndex: number,
  _stopElements: Array<HTMLElement | null>,
) {
  const lineIndex =
    branchLines.value.findIndex(
      branchLine =>
        branchLine.id === lineId,
    )

  if (lineIndex < 0) {
    return 0
  }

  /*
   * MODE SIMPLE :
   *
   * D et S restent toujours sur leurs rails droits du corridor.
   * Un changement d'appartenance des arrêts ne crée plus
   * automatiquement une pente vers le haut / vers le bas.
   *
   * Les vraies bifurcations restent gérées uniquement par Fork.vue.
   */
  return branchLineCenterOffset(
    lineIndex,
  )
}

/*
 * =========================================================
 * POSITION RÉELLE DES ARRÊTS SUR LEURS LIGNES
 * =========================================================
 *
 * Cette version suit maintenant la GÉOMÉTRIE RÉELLE
 * de la fourche.
 *
 * Donc :
 *
 * - un arrêt de la ligne haute monte AVEC la pente ;
 * - un arrêt de la ligne basse descend AVEC la pente ;
 * - après la pente, les arrêts restent parfaitement
 *   centrés sur les nouvelles lignes droites ;
 * - un arrêt partagé reste centré entre les rails concernés.
 */
function updateMultiLineStopPositions() {
  if (!el.value) {
    return
  }

  const stopElements =
    branchStops.value.map(
      stop =>
        findStopElement(stop.id),
    )

  stopElements.forEach(
    (stopElement, stopIndex) => {
      if (!stopElement) {
        return
      }

      const ids =
        stopDisplayedLineIds(
          stopElement,
        )

      const centers =
        ids
          .map(lineId =>
            displayedLineCenterOffsetAtStop(
              lineId,
              stopIndex,
              stopElements,
            ),
          )

      if (centers.length === 0) {
        stopElement.style.top = ''
        stopElement.style.removeProperty(
          '--shared-line-span',
        )
        stopElement.style.removeProperty(
          '--shared-line-top',
        )
        stopElement.style.removeProperty(
          '--shared-line-bottom',
        )
        return
      }

      const minCenter =
        Math.min(...centers)

      const maxCenter =
        Math.max(...centers)

      const stopCenter =
        (minCenter + maxCenter) / 2

      /*
       * .branch-elements est lui-même translaté sur l'unique rail
       * visible pour rendre le drop naturel.
       *
       * On retire donc ce même offset à l'enfant afin que sa position
       * VISUELLE finale reste exactement celle calculée auparavant.
       */
      stopElement.style.top =
        `${
          stopCenter
          - branchDropRailOffsetPx.value
        }px`

      stopElement.style.setProperty(
        '--shared-line-top',
        `${minCenter - stopCenter}px`,
      )

      stopElement.style.setProperty(
        '--shared-line-bottom',
        `${maxCenter - stopCenter}px`,
      )

      stopElement.style.setProperty(
        '--shared-line-span',
        `${Math.max(
          0,
          maxCenter - minCenter,
        )}px`,
      )
    },
  )
}

/*
 * Détecte uniquement les transitions où l'on passe :
 *
 * - d'un arrêt partagé à un arrêt moins partagé ;
 * - ou d'un arrêt moins partagé à un arrêt partagé.
 *
 * Il faut conserver au moins une ligne commune entre
 * les deux arrêts : sinon il ne s'agit plus d'une
 * simple séparation du corridor et on laisse la
 * topologie classique gérer le cas.
 */
function updateMultiLineSeparationCues() {
  /*
   * MODE SIMPLE :
   *
   * Plus de séparation graphique implicite entre D et S.
   * Les deux rails restent parallèles et droits.
   *
   * Une bifurcation réelle doit venir d'un élément Fork explicite,
   * ce qui évite qu'une Branch fasse croire aux Fork suivantes
   * qu'un rail a changé de niveau alors que la topologie ne l'a pas fait.
   */
  multiLineSeparationCues.value = []
}

function connectionGroupsBySignature(
  stopElement: HTMLElement,
) {
  const result =
    new Map<string, HTMLElement[]>()

  const groups =
    stopElement.querySelectorAll<HTMLElement>(
      '.connection-group[data-connection-signature]',
    )

  groups.forEach((group) => {
    const signature =
      group.getAttribute(
        'data-connection-signature',
      )

    if (!signature) {
      return
    }

    const existing =
      result.get(signature) ?? []

    existing.push(group)

    result.set(
      signature,
      existing,
    )
  })

  return result
}

/*
 * Construit une signature représentant
 * TOUTES les correspondances d'un arrêt.
 *
 * L'ordre d'affichage ne compte pas :
 * les signatures sont triées.
 *
 * Les doublons sont conservés grâce à leur
 * répétition dans le tableau.
 *
 * Ainsi :
 *
 * Arrêt A :
 * - RER A
 *
 * Arrêt B :
 * - RER A
 * - Métro 1
 *
 * ne sont PAS considérés comme identiques.
 */
function completeConnectionsSignature(
  groups: Map<string, HTMLElement[]>,
) {
  const signatures: string[] = []

  groups.forEach(
    (matchingGroups, signature) => {
      for (
        let index = 0;
        index < matchingGroups.length;
        index++
      ) {
        signatures.push(signature)
      }
    },
  )

  signatures.sort()

  return JSON.stringify(signatures)
}

/*
 * Deux arrêts sont assemblables uniquement
 * si leur ensemble COMPLET de correspondances
 * est strictement identique.
 */
function sameCompleteConnections(
  firstGroups: Map<string, HTMLElement[]>,
  secondGroups: Map<string, HTMLElement[]>,
) {
  const firstSignature =
    completeConnectionsSignature(
      firstGroups,
    )

  const secondSignature =
    completeConnectionsSignature(
      secondGroups,
    )

  return (
    firstSignature !== '[]'
    && firstSignature === secondSignature
  )
}

/*
 * Avant chaque nouveau calcul, toutes les
 * correspondances sont rendues visibles.
 *
 * On remet également à zéro les éventuels
 * décalages appliqués au bloc représentatif.
 */
function resetSharedConnectionGroups() {
  if (!el.value) {
    return
  }

  el.value
    .querySelectorAll<HTMLElement>(
      '.connection-group[data-connection-signature]',
    )
    .forEach((group) => {
      group.classList.remove(
        'shared-connection-hidden',
      )

      group.style.position = ''
      group.style.left = ''
      group.style.top = ''
    })
}

/*
 * Centre horizontal réel du rond de station.
 */
function stopAnchorX(
  stopElement: HTMLElement,
  wrapperRect: DOMRect,
) {
  const dot =
    stopElement.querySelector<HTMLElement>(
      '.dot',
    )

  const rect =
    (dot ?? stopElement)
      .getBoundingClientRect()

  return (
    rect.left
    + rect.width / 2
    - wrapperRect.left
  )
}

/*
 * Limites horizontales réelles du NOM d'un arrêt.
 *
 * Le fond gris "hors tarification" doit suivre le nom
 * de la station, et non le centre du rond de station
 * ni l'arrêt normal précédent.
 *
 * On cherche le plus petit élément DOM dont le texte
 * correspond exactement au nom de l'arrêt.
 *
 * En cas de nom sur plusieurs lignes, les espaces et
 * retours à la ligne sont normalisés avant comparaison.
 *
 * Si aucun élément précis n'est trouvé, on revient
 * prudemment au centre du rond de station.
 */

function updateLineToForkExtensions() {
  if (
    typeof window === 'undefined'
    || !el.value
  ) {
    lineToForkExtensions.value = []
    return
  }

  const host =
    el.value.closest<HTMLElement>(
      '.section-element',
    )

  if (!host) {
    lineToForkExtensions.value = []
    return
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const extensions:
    LineToForkExtension[] = []

  /*
   * Plusieurs Fork peuvent partager le même X.
   * On parcourt donc les Fork consécutives juste après la Branch.
   */
  let sibling =
    host.nextElementSibling

  while (
    sibling instanceof HTMLElement
    && sibling.classList.contains(
      'section-element',
    )
  ) {
    const fork =
      sibling.querySelector<HTMLElement>(
        '.fork[data-fork-line-id]',
      )

    if (!fork) {
      break
    }

    const lineId =
      fork.dataset.forkLineId

    if (!lineId) {
      sibling =
        sibling.nextElementSibling
      continue
    }

    const visibleLine =
      branchLines.value.find(
        candidate =>
          candidate.id === lineId,
      )

    /*
     * Rien n'est inventé :
     * si cette Branch ne dessine pas cette ligne, on ne fait rien.
     */
    if (!visibleLine) {
      sibling =
        sibling.nextElementSibling
      continue
    }

    const rail =
      el.value.querySelector<SVGGElement>(
        `.line > svg [data-line-id="${CSS.escape(lineId)}"]`,
      )

    const forkSvg =
      fork.querySelector<SVGSVGElement>(
        '.fork-svg',
      )

    if (
      !rail
      || !forkSvg
    ) {
      sibling =
        sibling.nextElementSibling
      continue
    }

    const railRect =
      rail.getBoundingClientRect()

    const forkRect =
      forkSvg.getBoundingClientRect()

    const towardLeft =
      fork.classList.contains(
        'toward-left',
      )

    const railY =
      railRect.top
      + railRect.height / 2
      - wrapperRect.top

    const railEdgeX =
      (
        towardLeft
          ? railRect.left
          : railRect.right
      )
      - wrapperRect.left

    const forkEntryX =
      (
        towardLeft
          ? forkRect.right
          : forkRect.left
      )
      - wrapperRect.left

    /*
     * Seulement une petite superposition pour éviter un cheveu blanc
     * entre les deux SVG. Aucun offset persistant.
     */
    const overlap =
      Math.max(
        1,
        railRect.height * 0.45,
      )

    const startX =
      towardLeft
        ? railEdgeX + overlap
        : railEdgeX - overlap

    const endX =
      towardLeft
        ? forkEntryX - overlap
        : forkEntryX + overlap

    extensions.push({
      key:
        `line-to-fork-${lineId}-${extensions.length}`,
      lineId,
      color:
        visibleLine.color,
      path:
        `M ${startX} ${railY} H ${endX}`,
    })

    sibling =
      sibling.nextElementSibling
  }

  lineToForkExtensions.value =
    extensions
}

function stopNameBoundsX(
  stop: Stop,
  stopElement: HTMLElement,
  wrapperRect: DOMRect,
) {
  const expectedName =
    stop.$stop.name
      .replace(/\s+/g, ' ')
      .trim()

  const candidates =
    Array.from(
      stopElement.querySelectorAll<HTMLElement>('*'),
    )
      .filter((element) => {
        const text =
          (element.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()

        if (
          expectedName === ''
          || text !== expectedName
        ) {
          return false
        }

        const style =
          window.getComputedStyle(element)

        if (
          style.display === 'none'
          || style.visibility === 'hidden'
        ) {
          return false
        }

        const rect =
          element.getBoundingClientRect()

        return (
          rect.width > 0
          && rect.height > 0
        )
      })
      .map((element) => {
        const rect =
          element.getBoundingClientRect()

        return {
          element,
          rect,
          area:
            rect.width
            * rect.height,
        }
      })
      .sort(
        (first, second) =>
          first.area - second.area,
      )

  const bestCandidate =
    candidates[0]

  if (bestCandidate) {
    /*
     * Petite marge visuelle afin que le gris commence
     * juste avant la première lettre et finisse juste
     * après la dernière.
     */
    const horizontalPadding =
      Math.max(
        2,
        sizeFactor.value * 0.12,
      )

    return {
      left:
        Math.max(
          0,
          bestCandidate.rect.left
          - wrapperRect.left
          - horizontalPadding,
        ),

      right:
        Math.min(
          wrapperRect.width,
          bestCandidate.rect.right
          - wrapperRect.left
          + horizontalPadding,
        ),
    }
  }

  const x =
    stopAnchorX(
      stopElement,
      wrapperRect,
    )

  const fallbackHalfWidth =
    Math.max(
      18,
      sizeFactor.value * 1.25,
    )

  return {
    left:
      Math.max(
        0,
        x - fallbackHalfWidth,
      ),

    right:
      Math.min(
        wrapperRect.width,
        x + fallbackHalfWidth,
      ),
  }
}

function updateOutOfFareZoneSegments() {
  if (!el.value) {
    outOfFareZoneSegments.value = []
    outOfFareZoneVisualZones.value = []
    return
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const stops =
    branchStops.value

  const segments:
    OutOfFareZoneSegment[] = []

  const visualZones:
    OutOfFareZoneVisualZone[] = []

  /*
   * Chaque groupe est traité indépendamment.
   *
   * Un arrêt normal coupe donc réellement deux
   * zones hors tarification, même si les deux
   * zones sont très proches visuellement.
   */
  outOfFareZoneGroups.value.forEach(
    (group) => {
      if (group.stops.length === 0) {
        return
      }

      const firstStop =
        group.stops[0]

      const lastStop =
        group.stops[
          group.stops.length - 1
        ]

      const firstStopElement =
        findStopElement(firstStop.id)

      const lastStopElement =
        findStopElement(lastStop.id)

      if (
        !firstStopElement
        || !lastStopElement
      ) {
        return
      }

      const firstGroupStopIndex =
        stops.findIndex(
          stop => stop.id === firstStop.id,
        )

      const lastGroupStopIndex =
        stops.findIndex(
          stop => stop.id === lastStop.id,
        )

      /*
       * Le raccord vers la zone commence au dernier
       * arrêt normal situé juste avant le groupe,
       * lorsqu'il existe.
       */
      const previousStop =
  firstGroupStopIndex > 0
    ? stops[firstGroupStopIndex - 1]
    : null

const previousStopElement =
  previousStop
    ? findStopElement(previousStop.id)
    : null

const nextStop =
  lastGroupStopIndex >= 0
  && lastGroupStopIndex < stops.length - 1
    ? stops[lastGroupStopIndex + 1]
    : null

const nextStopElement =
  nextStop
    ? findStopElement(nextStop.id)
    : null

      const firstX =
        stopAnchorX(
          firstStopElement,
          wrapperRect,
        )

      const lastX =
        stopAnchorX(
          lastStopElement,
          wrapperRect,
        )

      /*
       * Limites visuelles du fond gris.
       *
       * Le gris suit maintenant les NOMS des arrêts :
       *
       * - un seul arrêt hors zone :
       *   juste avant la première lettre du nom
       *   jusqu'à juste après la dernière ;
       *
       * - plusieurs arrêts hors zone consécutifs :
       *   du nom du premier arrêt au nom du dernier.
       *
       * Le centre du rond et les arrêts normaux voisins
       * ne servent plus à dimensionner le fond.
       */
      const firstNameBounds =
        stopNameBoundsX(
          firstStop,
          firstStopElement,
          wrapperRect,
        )

      const lastNameBounds =
        stopNameBoundsX(
          lastStop,
          lastStopElement,
          wrapperRect,
        )

      let zoneStartX =
        Math.min(
          firstNameBounds.left,
          lastNameBounds.left,
        )

      let zoneEndX =
        Math.max(
          firstNameBounds.right,
          lastNameBounds.right,
        )

      /*
       * Segment d'entrée :
       *
       * dernier arrêt normal -> premier arrêt
       * hors tarification.
       *
       * Il appartient uniquement à CE groupe.
       */
      if (previousStopElement) {
        const previousX =
          stopAnchorX(
            previousStopElement,
            wrapperRect,
          )

        if (previousX !== firstX) {
          segments.push({
            key:
              `${group.key}-entry`
              + `-${previousStop!.id}`
              + `-${firstStop.id}`,
            startX:
              Math.min(previousX, firstX),
            endX:
              Math.max(previousX, firstX),
          })

        }
      }

      /*
       * Micro-segments internes au groupe.
       *
       * Ils ne traversent jamais un arrêt normal.
       */
      for (
        let index = 0;
        index < group.stops.length - 1;
        index++
      ) {
        const currentStop =
          group.stops[index]

        const nextStop =
          group.stops[index + 1]

        const currentStopElement =
          findStopElement(currentStop.id)

        const nextStopElement =
          findStopElement(nextStop.id)

        if (
          !currentStopElement
          || !nextStopElement
        ) {
          continue
        }

        const currentX =
          stopAnchorX(
            currentStopElement,
            wrapperRect,
          )

        const nextX =
          stopAnchorX(
            nextStopElement,
            wrapperRect,
          )

        if (currentX === nextX) {
          continue
        }

        segments.push({
          key:
            `${group.key}`
            + `-${currentStop.id}`
            + `-${nextStop.id}`,
          startX:
            Math.min(currentX, nextX),
          endX:
            Math.max(currentX, nextX),
        })

      }

      /*
       * Segment de sortie :
       *
       * dernier arrêt hors tarification
       * -> premier arrêt normal après la zone.
       *
       * On prolonge uniquement la ligne
       * micro-segmentée.
       *
       * Le fond gris ne bouge pas.
       */
      const nextStopAfterGroup =
        lastGroupStopIndex >= 0
        && lastGroupStopIndex
          < stops.length - 1
          ? stops[lastGroupStopIndex + 1]
          : null

      const nextStopAfterGroupElement =
        nextStopAfterGroup
          ? findStopElement(
              nextStopAfterGroup.id,
            )
          : null

      if (nextStopAfterGroupElement) {
        const nextX =
          stopAnchorX(
            nextStopAfterGroupElement,
            wrapperRect,
          )

        if (lastX !== nextX) {
          segments.push({
            key:
              `${group.key}-exit`
              + `-${lastStop.id}`
              + `-${nextStopAfterGroup!.id}`,

            startX:
              Math.min(
                lastX,
                nextX,
              ),

            endX:
              Math.max(
                lastX,
                nextX,
              ),
          })
        }
      }

      /*
       * Pour calculer la hauteur du fond gris,
       * on regarde uniquement les arrêts appartenant
       * réellement à ce groupe.
       *
       * Un arrêt normal placé entre deux groupes
       * n'est donc jamais absorbé par le fond.
       */
      let top =
        wrapperRect.height / 2 - 20

      let bottom =
        wrapperRect.height / 2 + 20

      group.stops.forEach((stop) => {
        const stopElement =
          findStopElement(stop.id)

        if (!stopElement) {
          return
        }

        const visualElements = [
          stopElement,
          ...Array.from(
            stopElement
              .querySelectorAll<HTMLElement>(
                '*',
              ),
          ),
        ]

        visualElements.forEach(
          (visualElement) => {
            const style =
              window.getComputedStyle(
                visualElement,
              )

            if (
              style.display === 'none'
              || style.visibility === 'hidden'
            ) {
              return
            }

            const rect =
              visualElement
                .getBoundingClientRect()

            if (
              rect.width === 0
              || rect.height === 0
            ) {
              return
            }

            top =
              Math.min(
                top,
                rect.top
                - wrapperRect.top,
              )

            bottom =
              Math.max(
                bottom,
                rect.bottom
                - wrapperRect.top,
              )
          },
        )
      })

      const padding = 6

      const backgroundTop =
        top - padding

      const labelGap = 22

      const labelTop =
        bottom + labelGap

/*
 * On réserve davantage de hauteur sous les arrêts
 * pour permettre à une mention longue de s'afficher
 * sur plusieurs lignes.
 *
 * La largeur de la zone ne change jamais :
 * aucun arrêt normal voisin n'est donc absorbé
 * par le fond gris.
 */
const zoneWidth =
  Math.max(
    1,
    zoneEndX - zoneStartX,
  )

const labelSettings =
  getOutOfFareZoneLabelSettings(
    group.key,
  )

const estimatedCharacterWidth =
  Math.max(
    4,
    labelSettings.fontSize
    * sizeFactor.value
    * 0.55,
  )

const charactersPerLine =
  Math.max(
    2,
    Math.floor(
      (zoneWidth - 12)
      / estimatedCharacterWidth,
    ),
  )

const estimatedLineCount =
  Math.max(
    1,
    Math.ceil(
      labelSettings.text.length
      / charactersPerLine,
    ),
  )

const estimatedLineHeight =
  Math.max(
    12,
    labelSettings.fontSize
    * sizeFactor.value
    * 1.2,
  )

const labelHeight =
  estimatedLineCount
  * estimatedLineHeight
  + 12

const backgroundBottom =
  labelTop + labelHeight

      visualZones.push({
        /*
         * IMPORTANT :
         *
         * contrairement à l'ancien système,
         * la clé vient directement du groupe.
         *
         * Elle pourra donc servir juste après
         * pour enregistrer la position propre
         * de sa mention.
         */
        key: group.key,
        startX: zoneStartX,
        endX: zoneEndX,
        top: backgroundTop,
        bottom: backgroundBottom,
        labelTop,
      })
    },
  )

    outOfFareZoneSegments.value =
    segments

  outOfFareZoneVisualZones.value =
    visualZones
}

/*
 * Calcule l'apparence de la ligne entre
 * chaque paire d'arrêts consécutifs.
 *
 * La propriété offLine appartient uniquement
 * à l'arrêt lui-même : aucune zone ou continuité
 * n'est imposée automatiquement.
 *
 * Règles :
 *
 * normal -> normal
 * = ligne BULB normale.
 *
 * normal -> hors plan
 * hors plan -> normal
 * = segment gris plein.
 *
 * hors plan -> hors plan
 * = segment gris micro-segmenté.
 *
 * Spacer et AreaSeparator sont ignorés
 * puisque branchStops contient uniquement
 * les vrais arrêts.
 */
function updateOffLineSegments() {
  if (!el.value) {
    offLineSegments.value = []
    return
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const stops =
    branchStops.value

  const segments: OffLineSegment[] = []

  for (
    let index = 0;
    index < stops.length - 1;
    index++
  ) {
    const currentStop =
      stops[index]

    const nextStop =
      stops[index + 1]

    const currentOffLine =
      currentStop.$stop.offLine === true

    const nextOffLine =
      nextStop.$stop.offLine === true

    /*
     * Deux arrêts normaux :
     * aucun overlay.
     */
    if (
      !currentOffLine
      && !nextOffLine
    ) {
      continue
    }

    const currentStopElement =
      findStopElement(currentStop.id)

    const nextStopElement =
      findStopElement(nextStop.id)

    if (
      !currentStopElement
      || !nextStopElement
    ) {
      continue
    }

    const currentX =
      stopAnchorX(
        currentStopElement,
        wrapperRect,
      )

    const nextX =
      stopAnchorX(
        nextStopElement,
        wrapperRect,
      )

    if (currentX === nextX) {
      continue
    }

    /*
     * Deux arrêts hors plan :
     * micro-segmenté.
     *
     * Sinon :
     * gris plein.
     */
    const style: OffLineSegment['style'] =
      currentOffLine && nextOffLine
        ? 'DASHED'
        : 'SOLID'

        /*
     * On dépasse très légèrement derrière
     * les deux points d'arrêt.
     *
     * Sans cette marge, la ligne originale
     * peut rester visible sous forme d'un
     * petit croissant coloré au bord du rond.
     */
    const overlap =
      Math.max(
        2,
        sizeFactor.value * 0.12,
      )

    segments.push({
      key:
        `off-line-${currentStop.id}`
        + `-${nextStop.id}`,

      startX:
        Math.max(
          0,
          Math.min(currentX, nextX)
          - overlap,
        ),

      endX:
        Math.min(
          wrapperRect.width,
          Math.max(currentX, nextX)
          + overlap,
        ),

      style,
    })
  }

  offLineSegments.value =
    segments
}

/*
 * Point de départ vertical de la tige.
 *
 * On part du rond de station lui-même.
 */
function stopAnchorY(
  stopElement: HTMLElement,
  wrapperRect: DOMRect,
  reverse: boolean,
) {
  const dot =
    stopElement.querySelector<HTMLElement>(
      '.dot',
    )

  const rect =
    (dot ?? stopElement)
      .getBoundingClientRect()

  return reverse
    ? rect.top - wrapperRect.top
    : rect.bottom - wrapperRect.top
}

/*
 * Construit tous les assemblages automatiques.
 *
 * Règle importante :
 *
 * une suite ne peut exister que si chaque arrêt
 * possède exactement le même ensemble COMPLET
 * de correspondances.
 *
 * Une correspondance supplémentaire sur un seul
 * arrêt casse donc entièrement l'assemblage.
 */
function updateConnectionBridges() {
  if (!el.value) {
    connectionBridges.value = []
    return
  }

  resetSharedConnectionGroups()

  const wrapperRect =
    el.value.getBoundingClientRect()

  const stops =
    branchStops.value

  const stopElements =
    stops.map(
      stop =>
        findStopElement(stop.id),
    )

  const groupsPerStop =
    stopElements.map(
      stopElement =>
        stopElement
          ? connectionGroupsBySignature(
              stopElement,
            )
          : new Map<
              string,
              HTMLElement[]
            >(),
    )

  /*
   * Signature COMPLETE des correspondances
   * de chaque arrêt.
   *
   * Exemple :
   *
   * RER B + Métro 17
   *
   * devient un seul ensemble logique.
   */
  const completeSignatures =
    groupsPerStop.map(
      groups =>
        completeConnectionsSignature(groups),
    )

  const bridges:
    ConnectionBridge[] = []

  let runStart = 0

  while (
    runStart < stops.length
  ) {
    const signature =
      completeSignatures[runStart]

    /*
     * Aucun assemblage possible lorsqu'il
     * n'y a aucune correspondance.
     */
    if (
      !signature
      || signature === '[]'
    ) {
      runStart++
      continue
    }

    let runEnd =
      runStart

    /*
     * On prolonge la série tant que les arrêts
     * possèdent exactement le même ensemble
     * COMPLET de correspondances.
     */
    while (
      runEnd + 1 < stops.length
      && completeSignatures[runEnd + 1]
        === signature
      && sameCompleteConnections(
        groupsPerStop[runStart],
        groupsPerStop[runEnd + 1],
      )
    ) {
      runEnd++
    }

    const runLength =
      runEnd - runStart + 1

    /*
     * Un arrêt isolé conserve son affichage normal.
     */
    if (runLength < 2) {
      runStart++
      continue
    }

    const representativeIndex =
      Math.floor(
        (
          runStart
          + runEnd
        ) / 2,
      )

    const representativeStopElement =
      stopElements[
        representativeIndex
      ]

    const firstStopElement =
      stopElements[runStart]

    const lastStopElement =
      stopElements[runEnd]

    if (
      !representativeStopElement
      || !firstStopElement
      || !lastStopElement
    ) {
      runStart =
        runEnd + 1

      continue
    }

    const reverse =
      representativeStopElement
        .classList
        .contains('reverse')

    /*
     * Tous les arrêts de l'assemblage doivent
     * être affichés du même côté de la ligne.
     */
    let sameDirection = true

    for (
      let index = runStart;
      index <= runEnd;
      index++
    ) {
      const stopElement =
        stopElements[index]

      if (!stopElement) {
        sameDirection = false
        break
      }

      const currentReverse =
        stopElement
          .classList
          .contains('reverse')

      if (
        currentReverse !== reverse
      ) {
        sameDirection = false
        break
      }
    }

    if (!sameDirection) {
      runStart =
        runEnd + 1

      continue
    }

    /*
     * Tous les groupes du représentant :
     *
     * RER B
     * Métro 17
     * Tram...
     *
     * Ils sont maintenant considérés comme
     * UN SEUL bloc visuel.
     */
    const representativeGroups =
      Array.from(
        groupsPerStop[
          representativeIndex
        ].values(),
      ).flat()

    if (
      representativeGroups.length === 0
    ) {
      runStart =
        runEnd + 1

      continue
    }

    /*
     * On masque TOUTES les correspondances
     * des autres arrêts de la série.
     *
     * Le représentant central conserve
     * l'ensemble complet.
     */
    for (
      let index = runStart;
      index <= runEnd;
      index++
    ) {
      if (
        index === representativeIndex
      ) {
        continue
      }

      groupsPerStop[index]
        .forEach((groups) => {
          groups.forEach((group) => {
            group.classList.add(
              'shared-connection-hidden',
            )
          })
        })
    }

    const firstX =
      stopAnchorX(
        firstStopElement,
        wrapperRect,
      )

    const lastX =
      stopAnchorX(
        lastStopElement,
        wrapperRect,
      )

    const sharedCenterX =
      (firstX + lastX) / 2

    /*
     * Rectangle total du bloc complet :
     *
     * ┌─────────────┐
     * │ RER B       │
     * │ Métro 17    │
     * └─────────────┘
     *
     * On ne mesure plus une correspondance
     * indépendamment des autres.
     */
    const representativeRects =
      representativeGroups.map(
        group =>
          group.getBoundingClientRect(),
      )

    const blockLeft =
      Math.min(
        ...representativeRects.map(
          rect => rect.left,
        ),
      )

    const blockRight =
      Math.max(
        ...representativeRects.map(
          rect => rect.right,
        ),
      )

    const blockTop =
      Math.min(
        ...representativeRects.map(
          rect => rect.top,
        ),
      )

    const blockBottom =
      Math.max(
        ...representativeRects.map(
          rect => rect.bottom,
        ),
      )

    const blockCenterX =
      (
        blockLeft
        + blockRight
      ) / 2
      - wrapperRect.left

    const horizontalOffset =
      sharedCenterX
      - blockCenterX

    /*
     * Espace réservé entre le U et
     * le premier pictogramme.
     */
    const pixelsPerEm =
      Math.max(
        1,
        sizeFactor.value * 16,
      )

    const stemLength =
      pixelsPerEm * 0.50

    /*
     * On déplace TOUS les groupes ensemble.
     *
     * Ils conservent donc leur disposition :
     *
     * RER B
     * M 17
     *
     * au lieu d'être traités séparément.
     */
    representativeGroups.forEach(
      (group) => {
        group.style.position =
          'relative'

        group.style.left =
          `${horizontalOffset}px`

        group.style.top =
          reverse
            ? '-0.75em'
            : '0.75em'
      },
    )

    /*
     * Barre horizontale du U.
     *
     * Elle se place avant l'ensemble complet
     * des correspondances.
     */
    const baselineY =
      reverse
        ? blockBottom
          - wrapperRect.top
        : blockTop
          - wrapperRect.top

    let path =
      `M ${firstX} ${baselineY}`
      + ` H ${lastX}`

    /*
     * Tige entre chaque arrêt
     * et la barre commune.
     */
    for (
      let index = runStart;
      index <= runEnd;
      index++
    ) {
      const currentStopElement =
        stopElements[index]

      if (!currentStopElement) {
        continue
      }

      const x =
        stopAnchorX(
          currentStopElement,
          wrapperRect,
        )

      const y =
        stopAnchorY(
          currentStopElement,
          wrapperRect,
          reverse,
        )

      path +=
        ` M ${x} ${y}`
        + ` V ${baselineY}`
    }

    /*
     * Une SEULE tige centrale pour
     * l'ensemble complet.
     *
     *      │       │
     *      └───┬───┘
     *          │
     *        RER B
     *         M17
     */
    const stemEndY =
      reverse
        ? baselineY - stemLength
        : baselineY + stemLength

    path +=
      ` M ${sharedCenterX} ${baselineY}`
      + ` V ${stemEndY}`

    bridges.push({
      key:
        `complete-connections`
        + `-${runStart}`
        + `-${runEnd}`
        + `-${signature}`,
      path,
    })

    runStart =
      runEnd + 1
  }

  connectionBridges.value =
    bridges
}

function scheduleConnectionBridgeUpdate() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (
    bridgeUpdateFrame !== null
  ) {
    cancelAnimationFrame(
      bridgeUpdateFrame,
    )
  }

  bridgeUpdateFrame =
    requestAnimationFrame(
      async () => {
        bridgeUpdateFrame = null

        await nextTick()

        updateMultiLineStopHorizontalPositions()
        updateMultiLineStopPositions()

        await nextTick()

        updateMultiLineSpacing()

        await nextTick()

        /*
         * L'écart D/S vient éventuellement de changer :
         * on replace les arrêts exactement sur leurs rails.
         */
        updateMultiLineStopPositions()

        await nextTick()

        updateMultiLineSeparationCues()
        updateLineIdentityChangeVisuals()
        updateLineToForkExtensions()
        updateConnectionBridges()
        updateOutOfFareZoneSegments()
        updateOffLineSegments()
      },
    )
}

watch(
  branch,
  () => {
    scheduleConnectionBridgeUpdate()
  },
  {
    deep: true,
  },
)

onMounted(
  async () => {
    await nextTick()

    scheduleConnectionBridgeUpdate()

    if (!el.value) {
      return
    }

    const branchElements =
      el.value.querySelector<HTMLElement>(
        '.branch-elements',
      )

    resizeObserver =
      new ResizeObserver(
        () => {
          scheduleConnectionBridgeUpdate()
        },
      )

    resizeObserver.observe(
      el.value,
    )

    if (branchElements) {
      resizeObserver.observe(
        branchElements,
      )

      mutationObserver =
        new MutationObserver(
          () => {
            scheduleConnectionBridgeUpdate()
          },
        )

      mutationObserver.observe(
        branchElements,
        {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            'data-connection-signature',
            'data-line-ids',
            'class',
          ],
        },
      )
    }

    /*
     * SectionEditor modifie uniquement les variables CSS de clearance
     * lorsque les Fork changent. On observe donc uniquement le style
     * de la Section, sans observer tout le sous-arbre.
     */
    const sectionRoot =
      el.value.closest<HTMLElement>(
        '.section',
      )

    if (sectionRoot) {
      sectionStyleObserver =
        new MutationObserver(
          () => {
            scheduleConnectionBridgeUpdate()
          },
        )

      sectionStyleObserver.observe(
        sectionRoot,
        {
          attributes: true,
          attributeFilter: ['style'],
        },
      )

      lineToForkMutationObserver =
        new MutationObserver(
          () => {
            scheduleConnectionBridgeUpdate()
          },
        )

      lineToForkMutationObserver.observe(
        sectionRoot,
        {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'data-fork-line-id',
          ],
        },
      )

      resizeObserver?.observe(
        sectionRoot,
      )
    }

    window.addEventListener(
      'resize',
      scheduleConnectionBridgeUpdate,
    )
  },
)

onBeforeUnmount(
  () => {
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    sectionStyleObserver?.disconnect()
    lineToForkMutationObserver?.disconnect()

    window.removeEventListener(
      'resize',
      scheduleConnectionBridgeUpdate,
    )

    if (
      bridgeUpdateFrame !== null
    ) {
      cancelAnimationFrame(
        bridgeUpdateFrame,
      )
    }
  },
)

/* Simply because the lib is muffin broken */
function moveOut(event: DraggableEvent<BranchElement>) {
  const el = event.from

  for (let i = 0; i < el.children.length; i++) {
    const child = el.children.item(i)!

    if (
      child.hasAttribute('data-id')
      && child.getAttribute('data-id') === event.data.id
    ) {
      el.removeChild(child)
    }
  }
}

function getElementType(element: BranchElement) {
  if ('$areaSeparator' in element) {
    return 'AREA_SEPARATOR'
  }

  if ('$spacer' in element) {
    return 'SPACER'
  }

  return 'STOP'
}

function onStart(event: DraggableEvent<BranchElement>) {
  grab(getElementType(event.data))
}
</script>

<template>
  <div
    ref="el"
    class="branch-wrapper"
    :data-branch-id="branch.id"
    :class="{
      empty: elements?.length === 0,
      fluid,
      negativeLeftMargin: (branch.$branch.marginLeft ?? 0) < 0,
      negativeRightMargin: (branch.$branch.marginRight ?? 0) < 0,
      positiveLeftMargin: (branch.$branch.marginLeft ?? 0) > 0,
      positiveRightMargin: (branch.$branch.marginRight ?? 0) > 0,
    }"
  >
    <VueDraggable
      v-model="elements"
      :animation="150"
      class="branch-elements open"
      :class="{
      emphasize,
      'tram-horizontal': isTramHorizontal,
      }"
      group="branchElements"
      ghost-class="branch-element-ghost"
      :swap-threshold=".75"
      handle=".branch-element-handle"
      @remove="(e: SortableEvent) => moveOut(e as DraggableEvent<BranchElement>)"
      @start="e => onStart(e as DraggableEvent<BranchElement>)"
      @end="release()"
    >
      <BranchElement
        v-for="(element, i) in elements"
        :key="element.id"
        v-model="elements[i]"
        :data-id="element.id"
        :reverse="branch.$branch.invertedElements"
        :branch="branch"
      />
    </VueDraggable>

    <svg
      v-if="connectionBridges.length > 0"
      class="connection-bridges"
      width="100%"
      height="100%"
      overflow="visible"
      aria-hidden="true"
    >
      <path
        v-for="bridge in connectionBridges"
        :key="bridge.key"
        :d="bridge.path"
      />
    </svg>

      <svg
  v-if="
    showOutOfFareZoneBackground
    && outOfFareZoneVisualZones.length > 0
  "
  class="out-of-fare-zone-lines"
  width="100%"
  height="100%"
  overflow="visible"
  aria-hidden="true"
>
  <g
    v-for="zone in outOfFareZoneVisualZones"
    :key="zone.key"
  >
    <rect
      class="out-of-fare-zone-background"
      :x="zone.startX"
      :y="zone.top"
      :width="zone.endX - zone.startX"
      :height="zone.bottom - zone.top"
    />
  </g>
</svg>

<svg
  v-if="outOfFareZoneSegments.length > 0"
  class="out-of-fare-zone-lines"
  width="100%"
  height="100%"
  overflow="visible"
  aria-hidden="true"
>
  <template
    v-for="segment in outOfFareZoneSegments"
    :key="segment.key"
  >
    <line
      v-for="(branchLine, lineIndex) in branchLines"
      :key="`${segment.key}-${branchLine.id}-mask`"
      class="out-of-fare-zone-mask"
      :x1="segment.startX"
      y1="50%"
      :x2="segment.endX"
      y2="50%"
      :transform="
        `translate(0 ${branchLineCenterOffset(lineIndex)})`
      "
    />

    <line
      v-for="(branchLine, lineIndex) in branchLines"
      :key="`${segment.key}-${branchLine.id}-dashes`"
      class="out-of-fare-zone-dashes"
      :style="{
        stroke: branchLine.color,
      }"
      :x1="segment.startX"
      y1="50%"
      :x2="segment.endX"
      y2="50%"
      :transform="
        `translate(0 ${branchLineCenterOffset(lineIndex)})`
      "
    />
  </template>
</svg>

<svg
  v-if="offLineSegments.length > 0"
  class="off-line-segments"
  width="100%"
  height="100%"
  overflow="visible"
  aria-hidden="true"
>
  <template
    v-for="segment in offLineSegments"
    :key="segment.key"
  >
    <line
      v-for="(branchLine, lineIndex) in branchLines"
      :key="`${segment.key}-${branchLine.id}-mask`"
      class="off-line-segment-mask"
      :x1="segment.startX"
      y1="50%"
      :x2="segment.endX"
      y2="50%"
      :transform="
        `translate(0 ${branchLineCenterOffset(lineIndex)})`
      "
    />

    <line
      v-for="(branchLine, lineIndex) in branchLines"
      :key="`${segment.key}-${branchLine.id}`"
      :class="[
        'off-line-segment',
        {
          'off-line-segment-solid':
            segment.style === 'SOLID',

          'off-line-segment-dashed':
            segment.style === 'DASHED',
        },
      ]"
      :x1="segment.startX"
      y1="50%"
      :x2="segment.endX"
      y2="50%"
      :transform="
        `translate(0 ${branchLineCenterOffset(lineIndex)})`
      "
    />
  </template>
</svg>

    <div
  v-for="zone in (
    showOutOfFareZoneBackground
      ? outOfFareZoneVisualZones
      : []
  )"
  :key="`${zone.key}-label`"
      class="out-of-fare-zone-label"
      :class="{
  dragging:
    outOfFareZoneLabelDrag?.zoneKey
    === zone.key,
      }"
      :style="{
  left: `${zone.startX}px`,
  top: `${zone.labelTop}px`,
  width: `${zone.endX - zone.startX}px`,
  transform: `translate(${getOutOfFareZoneLabelPosition(zone.key).offsetX}px, ${getOutOfFareZoneLabelPosition(zone.key).offsetY}px)`,
  fontSize: `${getOutOfFareZoneLabelSettings(zone.key).fontSize}em`,
  fontWeight: getOutOfFareZoneLabelSettings(zone.key).bold ? '700' : '400',
  fontStyle: getOutOfFareZoneLabelSettings(zone.key).italic ? 'italic' : 'normal',
  textDecoration: getOutOfFareZoneLabelSettings(zone.key).underline ? 'underline' : 'none',
  color: getOutOfFareZoneLabelSettings(zone.key).color,
}"
>
  <span
    class="out-of-fare-zone-label-text"
    @pointerdown.stop="
      startOutOfFareZoneLabelDrag(
        $event,
        zone.key,
      )
    "
    @click.stop.prevent
  >
    {{ getOutOfFareZoneLabelSettings(zone.key).text }}
  </span>
    </div>

    <OutOfFareZoneLabelPropertiesDialog
  v-model:visible="showOutOfFareZoneLabelProperties"
  :zone-key="activeOutOfFareZoneLabelZoneKey"
  />

    <!--
      Vraie fourche multi-lignes.
      Depuis le dernier arrêt commun, le rail supérieur monte
      franchement et le rail inférieur descend franchement
      pendant environ deux arrêts, puis chacun continue droit.
    -->
    <svg
      v-if="multiLineSeparationCues.length > 0"
      class="multi-line-separation-cues"
      width="100%"
      height="100%"
      overflow="visible"
      aria-hidden="true"
    >
      <template
        v-for="cue in multiLineSeparationCues"
        :key="cue.key"
      >
        <path
          v-if="cue.maskPath"
          class="multi-line-fork-mask"
          :d="cue.maskPath"
        />

        <path
          class="multi-line-fork-path"
          :d="cue.path"
          :stroke="cue.color"
        />
      </template>
    </svg>

    <!--
      Toc toc : la Branch prolonge son rail jusqu'à la bifurcation
      suivante qui cible exactement cette ligne.
    -->
    <svg
      v-if="lineToForkExtensions.length > 0"
      class="line-to-fork-extensions"
      width="100%"
      height="100%"
      overflow="visible"
      aria-hidden="true"
    >
      <path
        v-for="extension in lineToForkExtensions"
        :key="extension.key"
        class="line-to-fork-extension"
        :d="extension.path"
        :stroke="extension.color"
      />
    </svg>

    <div ref="line" class="line">
      <svg
        width="100%"
        :height="`${totalLineWidth}em`"
        overflow="visible"
      >
        <g
          v-for="(branchLine, lineIndex) in branchLines"
          :key="branchLine.id"
          :data-line-id="branchLine.id"
          :data-line-mode="branchLine.mode"
          :data-line-primary="branchLine.primary ? 'true' : 'false'"
          :transform="
            `translate(0 ${branchLineOffset(lineIndex)})`
          "
        >
          <SvgLine
            v-for="segment in baseLineVisibleSegments(
              branchLine.id,
            )"
            :key="segment.key"
            :path="`
              M ${segment.startX} 0
              L ${segment.endX} 0
            `"
            :color="branchLine.color"
            :line-width="lineWidth"
            :striped="
              lineContext.lineStyle.value
              === 'STRIPED'
            "
          />

          <!--
            En mono-ligne, la portion changée est dessinée dans
            exactement le même groupe que le rail original :
            aucun décalage vertical n'est alors possible.
          -->
          <SvgLine
            v-for="segment in (
              branchLines.length === 1
                ? lineIdentitySegmentsForLine(
                    branchLine.id,
                  )
                : []
            )"
            :key="segment.key"
            :path="`
              M ${segment.startX} 0
              L ${segment.endX} 0
            `"
            :color="segment.color"
            :line-width="lineWidth"
            :striped="false"
          />

          <!--
            Le dernier arrêt est hors plan :
            chaque ligne du corridor conserve
            exactement la même extrémité
            puis est repeinte en gris.
          -->
          <SvgLine
            v-if="
              branchStops.length > 0
              && branchStops[
                branchStops.length - 1
              ].$stop.offLine === true
            "
            :path="`
              M ${
                branchLength
                - Math.max(
                  8,
                  sizeFactor * 0.55,
                )
              } 0
              L ${branchLength} 0
            `"
            color="#8a8a8a"
            :line-width="lineWidth"
            :striped="false"
          />
        </g>
      </svg>
    </div>

    <!--
      Portion dont l'identité change.
      Aucun pictogramme n'est ajouté sur les arrêts :
      seule la couleur du tracé change.
    -->
    <svg
      v-if="
        branchLines.length > 1
        && lineIdentityChangeVisuals.length > 0
      "
      class="line-identity-change-lines"
      width="100%"
      height="100%"
      overflow="visible"
      aria-hidden="true"
    >
      <path
        v-for="visual in lineIdentityChangeVisuals"
        :key="visual.key"
        class="line-identity-change-color"
        :d="visual.path"
        :stroke="visual.color"
      />
    </svg>
  </div>
</template>

<style lang="scss">
.element-ghost {
  opacity: .5;
}

/*
 * Les correspondances identiques sont toujours
 * présentes dans les données du projet.
 *
 * On masque uniquement leur représentation
 * graphique lorsqu'elles font partie d'un
 * assemblage automatique.
 */
.shared-connection-hidden {
  display: none !important;
}
</style>

<style scoped lang="scss">
.branch-wrapper {
  .debug & {
    outline: 1px solid orange;
    outline-offset: 1px;
  }

  position: relative;
  z-index: 2;

  &.fluid {
    flex-grow: 1;
  }

  &.empty {
    min-width: 3em;
  }

  &.negativeLeftMargin {
    margin-left: v-bind(leftMargin);
  }

  &.negativeRightMargin {
    margin-right: v-bind(rightMargin);
  }

  &.positiveLeftMargin {
    padding-left: v-bind(leftMargin);
  }

  &.positiveRightMargin {
    padding-right: v-bind(rightMargin);
  }

  .section-element + .section-element & {
    .line {
      padding-left: 0;
      clip: rect(
        auto,
        calc(v-bind(branchLength) * 1px + 1em),
        auto,
        0
      );
    }
  }

  .section-element:not(:last-child) & {
    .line {
      padding-right: 0;
      clip: rect(
        auto,
        calc(v-bind(branchLength) * 1px + .5em),
        auto,
        calc(v-bind(lineWidth) * -.25em)
      );
    }
  }

  .section-element:not(:last-child):has(+ .section-element)
  .section-element:not(:first-child) &,
  .section-element + .section-element
  .section-element:not(:last-child) &,
  .section-element + .section-element:not(:last-child) & {
    .line {
      padding: 0;
      clip: rect(
        auto,
        calc(v-bind(branchLength) * 1px),
        auto,
        0
      );
    }
  }
}

.branch-elements {
  position: relative;

  /*
   * Hitbox du drag/drop alignée sur le rail réellement visible.
   * transform ne modifie pas le flux : la géométrie validée du plan
   * reste donc strictement inchangée.
   */
  transform:
    translateY(
      v-bind(branchDropRailOffsetCss)
    );

  min-height: 4em;
  display: flex;
  z-index: 10;
  flex-grow: 1;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: center;
  gap: calc(v-bind(elementSpacing));
  pointer-events: fill;

  &:after {
    position: absolute;
    pointer-events: none;
    content: '';
    top: 50%;
    left: 0;
    right: 0;
    bottom: 0;
    min-height: 5em;
    transform: translateY(-50%);
    background-color: transparent;
    border: 2px dashed transparent;
    border-radius: .25em;
    padding: 0 2em;
    margin: 0 -2em;
    transition:
      background-color .2s ease,
      border-color .2s ease;
  }
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL
 * =========================================================
 *
 * Dans ce style, la largeur réelle des noms doit
 * participer à la largeur de la branche.
 *
 * Les arrêts ne sont donc plus compressés pour
 * rentrer artificiellement dans l'espace disponible.
 */
.branch-elements.tram-horizontal {
  justify-content: flex-start;

  > * {
    flex-shrink: 0;
  }
}

.emphasize {
  --border-color: var(--p-blue-400);
  padding: 0 2em;
  margin: 0 -2em;

  &:after {
    background: color-mix(
      in srgb,
      var(--border-color),
      transparent 85%
    );
    border-color: var(--border-color);
    padding: 0;
    margin: 0;
  }
}

:deep(.stop-wrapper[data-line-ids]) {
  /*
   * Lorsqu'on coche / décoche une ligne dans les propriétés
   * de l'arrêt, le marqueur rejoint son rail sans saut brutal.
   */
  position: relative;

  transition:
    top .18s ease,
    left .18s ease;
}

.multi-line-separation-cues {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  /*
   * La fourche est dessinée au-dessus du tracé de base,
   * mais toujours sous les arrêts et leurs informations.
   */
  z-index: 4;

  path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .multi-line-fork-mask {
    stroke: white;
    stroke-width:
      calc(v-bind(lineWidth) * 1em + .18em);
  }

  .multi-line-fork-path {
    stroke-width:
      calc(v-bind(lineWidth) * 1em);
  }
}

/*
 * =========================================================
 * CHANGEMENT D'IDENTITÉ DE LIGNE
 * =========================================================
 */

.line-identity-change-lines {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  /*
   * Au-dessus de la ligne de base et de la fourche,
   * sous les arrêts et les correspondances.
   */
  z-index: 5;

  path {
    fill: none;

    stroke-linecap: butt;
    stroke-linejoin: round;
  }

  /*
   * La nouvelle couleur recouvre directement l'ancienne.
   *
   * On la dessine très légèrement plus large que le rail
   * historique : assez pour supprimer le fin liseré de
   * l'ancienne couleur, mais sans créer de contour ou de
   * masque visible autour du nouveau tracé.
   */
  .line-identity-change-color {
    stroke-width:
      calc(v-bind(lineWidth) * 1em);
  }
}


/*
 * Les arrêts standards situés sur une portion qui change
 * d'identité prennent la couleur de cette portion.
 *
 * Les arrêts "connection" et "terminus" gardent leurs contours
 * noirs historiques ; seuls les marqueurs colorés classiques
 * et futurs suivent la nouvelle couleur.
 */
:deep(
  .stop-wrapper.line-identity-changed-stop
  .dot:not(.connection):not(.terminus)
) {
  border-color:
    var(--line-identity-change-color) !important;
}

:deep(
  .stop-wrapper.line-identity-changed-stop
  .dot.terminus:not(.connection)
) {
  background-color:
    var(--line-identity-change-color) !important;
}

.connection-bridges {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;

  pointer-events: none;

  z-index: 15;

  path {
    fill: none;

    stroke: #000000;
    stroke-width: .0625em;

    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.out-of-fare-zone-lines {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  z-index: 3;
}

.out-of-fare-zone-background {
  fill: #d9dde2;
  opacity: .7;
}

.out-of-fare-zone-mask {
  stroke: white;
  stroke-width:
    calc(v-bind(lineWidth) * 1em + .08em);
  stroke-linecap: butt;
}

.out-of-fare-zone-dashes {
  stroke: v-bind(color);
  stroke-width:
    calc(v-bind(lineWidth) * 1em);
  stroke-linecap: butt;

  stroke-dasharray: 6 3;
}

/*
 * Portions de ligne associées
 * aux arrêts hors plan / atténués.
 */
.off-line-segments {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  z-index: 4;
}

/*
 * Masque la ligne colorée originale.
 */
.off-line-segment-mask {
  stroke: white;
  stroke-width:
    calc(v-bind(lineWidth) * 1em + .08em);
  stroke-linecap: butt;
}

/*
 * Ligne hors plan.
 */
.off-line-segment {
  stroke: #7d7d7d;
  stroke-width:
    calc(v-bind(lineWidth) * 1em);
  stroke-linecap: butt;
}

/*
 * Normal <-> hors plan.
 */
.off-line-segment-solid {
  stroke-dasharray: none;
}

/*
 * Hors plan <-> hors plan.
 */
.off-line-segment-dashed {
  stroke-dasharray: 6 3;
}

.out-of-fare-zone-label {
  position: absolute;

  display: block;

  box-sizing: border-box;

  padding: 0 .3em;

  overflow: hidden;

  line-height: 1.15;
  text-align: center;

  cursor: grab;
  touch-action: none;
  user-select: none;

  z-index: 20;

  &.dragging {
    cursor: grabbing;
  }
}

.out-of-fare-zone-label-text {
  display: block;

  width: 100%;
  max-width: 100%;

  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-word;

  text-align: center;

  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  user-select: none;

  .dragging & {
    cursor: grabbing;
  }
}

.out-of-fare-zone-label-text {
  display: inline-block;

  max-width: none;

  white-space: nowrap;

  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  user-select: none;

  transform-origin: center top;

  .dragging & {
    cursor: grabbing;
  }
}

.line-to-fork-extensions {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  z-index: 4;
}

.line-to-fork-extension {
  fill: none;

  stroke-width:
    calc(v-bind(lineWidth) * 1em);

  stroke-linecap: butt;
  stroke-linejoin: round;
}

.line {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  padding: 0 calc(v-bind(lineWidth) * .5em / v-bind(lineWidth));
  z-index: -1;

  /*
   * L'espace du corridor peut évoluer lorsque
   * la hauteur réelle d'un nom change.
   *
   * Une courte transition évite un déplacement
   * brutal pendant l'édition du nom.
   */
  transition:
    height .12s ease;
}
</style>