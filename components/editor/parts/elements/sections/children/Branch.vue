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
const branchLines = computed(() => [
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
  {
    id: 'primary',
    mode: project.line.mode,
    index: project.line.index,
    color: color.value,
    primary: true,
  },
])

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
      0.18,
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
 * L'écart dynamique ne concerne que la séparation
 * immédiatement au-dessus de la ligne principale.
 *
 * Avec trois lignes ou plus, les lignes secondaires
 * restent compactes entre elles tandis que le bloc
 * complet s'écarte juste assez pour laisser respirer
 * les noms de la ligne principale.
 */
const primaryLineGap = computed(() => {
  if (branchLines.value.length <= 1) {
    return 0
  }

  return Math.max(
    minimumLineGap.value,
    measuredPrimaryLineGap.value,
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
  const lastAdditionalLineIndex =
    branchLines.value.length - 2

  if (
    index === lastAdditionalLineIndex
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
  const count =
    Math.max(
      1,
      branchLines.value.length,
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
  index: number,
) {
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

  const wrapperRect =
    el.value.getBoundingClientRect()

  const baselineY =
    wrapperRect.top
    + wrapperRect.height / 2

  const nameElements =
    el.value.querySelectorAll<HTMLElement>(
      '.stop-wrapper .names',
    )

  let upperClearance = 0

  nameElements.forEach(
    (nameElement) => {
      const stopElement =
        nameElement.closest<HTMLElement>(
          '.stop-wrapper',
        )

      /*
       * Un arrêt inversé affiche son nom sous la ligne :
       * il n'a donc pas besoin de pousser la ligne
       * supplémentaire située au-dessus.
       */
      if (
        stopElement?.classList
          .contains('reverse')
      ) {
        return
      }

      const style =
        window.getComputedStyle(
          nameElement,
        )

      if (
        style.display === 'none'
        || style.visibility === 'hidden'
      ) {
        return
      }

      const rect =
        nameElement
          .getBoundingClientRect()

      if (
        rect.width === 0
        || rect.height === 0
      ) {
        return
      }

      if (
        rect.top >= baselineY
      ) {
        return
      }

      upperClearance =
        Math.max(
          upperClearance,
          baselineY - rect.top,
        )
    },
  )

  /*
   * Les correspondances d'un arrêt commun peuvent prendre
   * beaucoup de hauteur juste au niveau de la future fourche.
   *
   * On mesure donc aussi leur bloc réel afin que les deux
   * rails soient déjà suffisamment espacés AVANT de partir
   * chacun dans leur direction.
   *
   * Cela évite qu'une diagonale de séparation traverse les
   * pictogrammes de correspondance au dernier arrêt commun.
   */
  let sharedConnectionsClearance = 0

  const sharedConnectionElements =
    el.value.querySelectorAll<HTMLElement>(
      '.stop-wrapper.shared-line-stop .connections',
    )

  sharedConnectionElements.forEach(
    (connectionsElement) => {
      const style =
        window.getComputedStyle(
          connectionsElement,
        )

      if (
        style.display === 'none'
        || style.visibility === 'hidden'
      ) {
        return
      }

      const rect =
        connectionsElement
          .getBoundingClientRect()

      if (
        rect.width === 0
        || rect.height === 0
      ) {
        return
      }

      sharedConnectionsClearance =
        Math.max(
          sharedConnectionsClearance,
          rect.height,
        )
    },
  )

  const pixelsPerEm =
    Math.max(
      1,
      sizeFactor.value * 16,
    )

  const clearanceEm =
    upperClearance
    / pixelsPerEm

  /*
   * Petite respiration entre le haut du nom
   * et le bord inférieur de la ligne du dessus.
   */
  const safetyGapEm =
    0.35

  const connectionsClearanceEm =
    sharedConnectionsClearance
    / pixelsPerEm

  const requiredGapFromNames =
    Math.max(
      0,
      clearanceEm
      + safetyGapEm
      - lineWidth.value / 2,
    )

  /*
   * On ne reprend pas toute la hauteur des correspondances :
   * cela créerait un corridor exagérément grand.
   *
   * En revanche, on réserve une part suffisante pour que
   * les deux lignes droites respirent avant la fourche.
   */
  const requiredGapFromConnections =
    sharedConnectionsClearance > 0
      ? Math.max(
          minimumLineGap.value,
          connectionsClearanceEm * 0.62
          + 0.45,
        )
      : 0

  const requiredGap =
    Math.max(
      requiredGapFromNames,
      requiredGapFromConnections,
    )

  /*
   * Évite de déclencher une cascade de ResizeObserver
   * pour une variation de quelques sous-pixels.
   */
  if (
    Math.abs(
      measuredPrimaryLineGap.value
      - requiredGap,
    ) > 0.02
  ) {
    measuredPrimaryLineGap.value =
      requiredGap
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

  return ids.length > 0
    ? ids
    : ['primary']
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

  return validIds.length > 0
    ? validIds
    : ['primary']
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
  if (
    !el.value
    || !line.value
    || branchLines.value.length <= 1
  ) {
    return
  }

  const stopElements =
    branchStops.value.map(
      stop =>
        findStopElement(stop.id),
    )

  /*
   * On repart toujours des positions naturelles de Flexbox.
   * Cela évite qu'un recalcul se base sur nos anciens décalages.
   */
  stopElements.forEach((stopElement) => {
    if (!stopElement) {
      return
    }

    stopElement.style.left = ''
  })

  const wrapperRect =
    el.value.getBoundingClientRect()

  const lineRect =
    line.value.getBoundingClientRect()

  const lineStartX =
    lineRect.left
    - wrapperRect.left

  const lineEndX =
    lineRect.right
    - wrapperRect.left

  for (
    let forkIndex = 0;
    forkIndex < stopElements.length - 1;
    forkIndex++
  ) {
    const forkElement =
      stopElements[forkIndex]

    const nextElement =
      stopElements[forkIndex + 1]

    if (
      !forkElement
      || !nextElement
    ) {
      continue
    }

    const forkIds =
      stopDisplayedLineIds(
        forkElement,
      )

    const nextIds =
      stopDisplayedLineIds(
        nextElement,
      )

    if (forkIds.length <= 1) {
      continue
    }

    const sameMembership =
      forkIds.length === nextIds.length
      && forkIds.every(
        id => nextIds.includes(id),
      )

    if (sameMembership) {
      continue
    }

    const forkX =
      stopAnchorX(
        forkElement,
        wrapperRect,
      )

    const naturalNextX =
      stopAnchorX(
        nextElement,
        wrapperRect,
      )

    const direction =
      naturalNextX >= forkX
        ? 1
        : -1

    const visualEndX =
      direction > 0
        ? lineEndX
        : lineStartX

    const availableLength =
      Math.abs(
        visualEndX - forkX,
      )

    if (availableLength <= 1) {
      continue
    }

    /*
     * Chaque ligne présente au dernier arrêt commun reçoit
     * sa propre liste d'arrêts exclusifs après la fourche.
     */
    forkIds.forEach((lineId) => {
      const exclusiveStops:
        Array<{
          element: HTMLElement
          naturalX: number
        }> = []

      for (
        let stopIndex = forkIndex + 1;
        stopIndex < stopElements.length;
        stopIndex++
      ) {
        const stopElement =
          stopElements[stopIndex]

        if (!stopElement) {
          continue
        }

        const ids =
          stopDisplayedLineIds(
            stopElement,
          )

        /*
         * On ne déplace ici que les arrêts propres à cette
         * ligne. Un éventuel arrêt partagé plus loin reste
         * un point topologique commun.
         */
        if (
          ids.length !== 1
          || ids[0] !== lineId
        ) {
          continue
        }

        exclusiveStops.push({
          element: stopElement,
          naturalX:
            stopAnchorX(
              stopElement,
              wrapperRect,
            ),
        })
      }

      if (exclusiveStops.length === 0) {
        return
      }

      /*
       * La dernière station de chaque ligne atteint le bord
       * utile du tracé ; toutes les autres sont réparties
       * régulièrement depuis la fourche.
       */
      const step =
        availableLength
        / exclusiveStops.length

      exclusiveStops.forEach(
        (item, rank) => {
          const desiredX =
            forkX
            + direction
              * step
              * (rank + 1)

          const deltaX =
            desiredX
            - item.naturalX

          item.element.style.left =
            `${deltaX}px`
        },
      )
    })

    /*
     * Une seule séparation principale est traitée par
     * corridor pour cette première base multi-lignes.
     * Les futures réunions / nouvelles fourches pourront
     * ensuite être ajoutées proprement par tronçons.
     */
    break
  }
}

/*
 * Retourne le décalage vertical RÉEL d'une ligne pour
 * un arrêt donné.
 *
 * Contrairement à branchLineCenterOffset(), cette fonction
 * tient compte de la fourche déjà dessinée :
 *
 * - avant la séparation : position normale du corridor ;
 * - pendant la pente : position interpolée sur la diagonale ;
 * - après deux arrêts environ : position finale séparée.
 */
function displayedLineCenterOffsetAtStop(
  lineId: string,
  stopIndex: number,
  stopElements: Array<HTMLElement | null>,
) {
  const lineIndex =
    branchLines.value.findIndex(
      branchLine =>
        branchLine.id === lineId,
    )

  if (lineIndex < 0) {
    return 0
  }

  const baseOffset =
    branchLineCenterOffset(lineIndex)

  if (
    !el.value
    || !line.value
    || stopIndex <= 0
  ) {
    return baseOffset
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const lineRect =
    line.value.getBoundingClientRect()

  const corridorCenterY =
    lineRect.top
    - wrapperRect.top
    + lineRect.height / 2

  /*
   * Même valeur que celle utilisée par la fourche.
   * Elle doit absolument rester identique afin que
   * le point de station tombe exactement sur le rail.
   */
  const finalSeparation =
    Math.max(
      38,
      sizeFactor.value * 16 * 2.75,
    )

  const currentBaseY =
    lineRect.top
    - wrapperRect.top
    + branchLineOffset(lineIndex)

  /*
   * La direction de séparation est déterminée plus bas,
   * une fois la fourche réellement identifiée.
   *
   * IMPORTANT :
   * lorsqu'une fourche comporte trois rails ou plus,
   * le rail le plus proche de l'axe du corridor est
   * considéré comme la continuité droite.
   *
   * Ce rail ne doit JAMAIS bouger lorsque l'écartement
   * de la fourche augmente : seules les branches qui
   * s'en écartent sont déplacées.
   */

  /*
   * On cherche la dernière séparation située avant
   * l'arrêt courant et qui concernait réellement cette ligne.
   */
  for (
    let forkIndex = stopIndex - 1;
    forkIndex >= 0;
    forkIndex--
  ) {
    const forkElement =
      stopElements[forkIndex]

    const afterForkElement =
      stopElements[forkIndex + 1]

    if (
      !forkElement
      || !afterForkElement
    ) {
      continue
    }

    const forkIds =
      stopDisplayedLineIds(
        forkElement,
      )

    const afterForkIds =
      stopDisplayedLineIds(
        afterForkElement,
      )

    /*
     * Une fourche ne démarre que sur un arrêt
     * encore partagé par plusieurs lignes.
     */
    if (forkIds.length <= 1) {
      continue
    }

    const sameMembership =
      forkIds.length === afterForkIds.length
      && forkIds.every(
        id => afterForkIds.includes(id),
      )

    if (sameMembership) {
      continue
    }

    if (!forkIds.includes(lineId)) {
      continue
    }

    /*
     * À partir de trois rails, on garde une vraie
     * continuité droite parfaitement fixe.
     *
     * On choisit le rail dont la position naturelle est
     * la plus proche du centre du corridor. Les autres
     * rails sont les branches qui doivent s'écarter.
     */
    const straightLineId =
      forkIds.length >= 3
        ? forkIds
            .map((forkLineId) => {
              const forkLineIndex =
                branchLines.value.findIndex(
                  branchLine =>
                    branchLine.id === forkLineId,
                )

              if (forkLineIndex < 0) {
                return {
                  id: forkLineId,
                  distance: Number.POSITIVE_INFINITY,
                }
              }

              const forkLineY =
                lineRect.top
                - wrapperRect.top
                + branchLineOffset(forkLineIndex)

              return {
                id: forkLineId,
                distance:
                  Math.abs(
                    forkLineY - corridorCenterY,
                  ),
              }
            })
            .sort(
              (first, second) =>
                first.distance - second.distance,
            )[0]?.id
        : null

    const separationDirection =
      lineId === straightLineId
        ? 0
        : currentBaseY < corridorCenterY
          ? -1
          : 1

    const forkX =
      stopAnchorX(
        forkElement,
        wrapperRect,
      )

    const naturalNextElement =
      stopElements[
        Math.min(
          forkIndex + 1,
          stopElements.length - 1,
        )
      ]

    if (!naturalNextElement) {
      continue
    }

    const naturalNextX =
      stopAnchorX(
        naturalNextElement,
        wrapperRect,
      )

    if (forkX === naturalNextX) {
      continue
    }

    const direction =
      naturalNextX > forkX
        ? 1
        : -1

    const straightClearance =
      forkStraightClearance(
        forkElement,
        wrapperRect,
        direction,
      )

    const slopeStartX =
      forkX
      + direction
        * straightClearance

    const rampTargetIndex =
      Math.min(
        forkIndex + 2,
        stopElements.length - 1,
      )

    const rampTargetElement =
      stopElements[rampTargetIndex]

    if (!rampTargetElement) {
      continue
    }

    const naturalRampEndX =
      stopAnchorX(
        rampTargetElement,
        wrapperRect,
      )

    const maximumRampLength =
      Math.max(
        58,
        sizeFactor.value * 16 * 5.4,
      )

    const minimumRampLength =
      Math.max(
        42,
        sizeFactor.value * 16 * 2.8,
      )

    const naturalAvailableRamp =
      direction > 0
        ? naturalRampEndX - slopeStartX
        : slopeStartX - naturalRampEndX

    const rampLength =
      Math.max(
        minimumRampLength,
        Math.min(
          maximumRampLength,
          Math.max(
            minimumRampLength,
            naturalAvailableRamp,
          ),
        ),
      )

    const rampEndX =
      slopeStartX
      + direction
        * rampLength

    const stopElement =
      stopElements[stopIndex]

    if (!stopElement) {
      return baseOffset
    }

    const stopX =
      stopAnchorX(
        stopElement,
        wrapperRect,
      )

    const effectiveRampLength =
      Math.max(
        1,
        Math.abs(
          rampEndX - slopeStartX,
        ),
      )

    const travelled =
      direction > 0
        ? stopX - slopeStartX
        : slopeStartX - stopX

    const progress =
      Math.max(
        0,
        Math.min(
          1,
          travelled
          / effectiveRampLength,
        ),
      )

    return (
      baseOffset
      + separationDirection
        * finalSeparation
        * progress
    )
  }

  return baseOffset
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

      stopElement.style.top =
        `${stopCenter}px`

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
  if (
    !el.value
    || !line.value
    || branchLines.value.length <= 1
  ) {
    multiLineSeparationCues.value = []
    return
  }

  const wrapperRect =
    el.value.getBoundingClientRect()

  const lineRect =
    line.value.getBoundingClientRect()

  const stopElements =
    branchStops.value.map(
      stop =>
        findStopElement(stop.id),
    )

  const cues: MultiLineSeparationCue[] = []

  for (
    let stopIndex = 0;
    stopIndex < stopElements.length - 1;
    stopIndex++
  ) {
    const currentStopElement =
      stopElements[stopIndex]

    const nextStopElement =
      stopElements[stopIndex + 1]

    if (
      !currentStopElement
      || !nextStopElement
    ) {
      continue
    }

    const currentIds =
      stopDisplayedLineIds(
        currentStopElement,
      )

    const nextIds =
      stopDisplayedLineIds(
        nextStopElement,
      )

    const sameMembership =
      currentIds.length === nextIds.length
      && currentIds.every(
        id => nextIds.includes(id),
      )

    if (sameMembership) {
      continue
    }

    /*
     * La fourche démarre uniquement depuis le dernier
     * arrêt encore commun à plusieurs lignes.
     */
    if (currentIds.length <= 1) {
      continue
    }

    const forkX =
      stopAnchorX(
        currentStopElement,
        wrapperRect,
      )

    const naturalNextX =
      stopAnchorX(
        nextStopElement,
        wrapperRect,
      )

    if (forkX === naturalNextX) {
      continue
    }

    const direction =
      naturalNextX > forkX
        ? 1
        : -1

    /*
     * NOUVEAU :
     *
     * les deux lignes restent d'abord parfaitement
     * horizontales après le dernier arrêt commun.
     *
     * La longueur de ce tronçon dépend de la place
     * réellement prise par les correspondances.
     */
    const straightClearance =
      forkStraightClearance(
        currentStopElement,
        wrapperRect,
        direction,
      )

    const slopeStartX =
      forkX
      + direction
        * straightClearance

    /*
     * La pente reste courte et haute.
     *
     * On garde le deuxième arrêt suivant comme limite
     * naturelle, mais sans jamais étaler la diagonale
     * sur une trop grande longueur.
     */
    const rampTargetIndex =
      Math.min(
        stopIndex + 2,
        stopElements.length - 1,
      )

    const rampTargetElement =
      stopElements[rampTargetIndex]

    if (!rampTargetElement) {
      continue
    }

    const naturalRampEndX =
      stopAnchorX(
        rampTargetElement,
        wrapperRect,
      )

    const maximumRampLength =
      Math.max(
        58,
        sizeFactor.value * 16 * 5.4,
      )

    const naturalAvailableRamp =
      direction > 0
        ? naturalRampEndX - slopeStartX
        : slopeStartX - naturalRampEndX

    /*
     * Même si les correspondances prennent beaucoup de place,
     * on garantit une vraie diagonale visible.
     */
    const minimumRampLength =
      Math.max(
        42,
        sizeFactor.value * 16 * 2.8,
      )

    const rampLength =
      Math.max(
        minimumRampLength,
        Math.min(
          maximumRampLength,
          Math.max(
            minimumRampLength,
            naturalAvailableRamp,
          ),
        ),
      )

    const rampEndX =
      slopeStartX
      + direction
        * rampLength

    const branchEndX =
      direction > 0
        ? wrapperRect.width
        : 0

    const corridorCenterY =
      lineRect.top
      - wrapperRect.top
      + lineRect.height / 2

    const finalSeparation =
      Math.max(
        38,
        sizeFactor.value * 16 * 2.75,
      )

    /*
     * Si la fourche possède trois rails ou plus, le rail
     * le plus proche du centre est la continuité droite.
     *
     * On ne lui applique ni masque, ni nouvelle trajectoire :
     * son tracé historique reste donc strictement au même
     * endroit, quelle que soit la taille de la fourche.
     */
    const straightLineId =
      currentIds.length >= 3
        ? currentIds
            .map((currentLineId) => {
              const currentLineIndex =
                branchLines.value.findIndex(
                  branchLine =>
                    branchLine.id === currentLineId,
                )

              if (currentLineIndex < 0) {
                return {
                  id: currentLineId,
                  distance: Number.POSITIVE_INFINITY,
                }
              }

              const currentLineY =
                lineRect.top
                - wrapperRect.top
                + branchLineOffset(currentLineIndex)

              return {
                id: currentLineId,
                distance:
                  Math.abs(
                    currentLineY - corridorCenterY,
                  ),
              }
            })
            .sort(
              (first, second) =>
                first.distance - second.distance,
            )[0]?.id
        : null

    currentIds.forEach((lineId) => {
      /*
       * La ligne droite reste exactement celle du tracé
       * de base. On ne la redessine surtout pas.
       */
      if (lineId === straightLineId) {
        return
      }
      const lineIndex =
        branchLines.value.findIndex(
          branchLine =>
            branchLine.id === lineId,
        )

      if (lineIndex < 0) {
        return
      }

      const branchLine =
        branchLines.value[lineIndex]

      const baseY =
        lineRect.top
        - wrapperRect.top
        + branchLineOffset(lineIndex)

      const outwardDirection =
        baseY < corridorCenterY
          ? -1
          : 1

      const separatedY =
        baseY
        + outwardDirection
          * finalSeparation

      /*
       * On conserve volontairement le rail historique
       * entre Le Bourget et slopeStartX.
       *
       * Il sert de tronçon horizontal propre sous les
       * correspondances.
       *
       * Le masque commence donc seulement au début réel
       * de la pente.
       */
      const maskPath =
        `M ${slopeStartX} ${baseY}`
        + ` L ${branchEndX} ${baseY}`

      /*
       * Vraie géométrie :
       *
       * arrêt commun
       * -----------\
       *             \
       *              \____________
       *
       * Le premier segment horizontal est fourni par
       * le rail de base. L'overlay commence seulement
       * à slopeStartX avec la diagonale.
       */
      const path =
        `M ${slopeStartX} ${baseY}`
        + ` L ${rampEndX} ${separatedY}`
        + ` L ${branchEndX} ${separatedY}`

      cues.push({
        key:
          `multi-line-clean-fork`
          + `-${stopIndex}`
          + `-${lineId}`,
        path,
        maskPath,
        color: branchLine.color,
      })
    })
  }

  multiLineSeparationCues.value =
    cues
}

/*
 * Toutes les correspondances d'un arrêt
 * classées par signature.
 *
 * Une même signature peut exceptionnellement
 * être présente plusieurs fois : on conserve
 * donc un tableau.
 */
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

        updateMultiLineSpacing()

        await nextTick()

        updateMultiLineStopHorizontalPositions()
        updateMultiLineStopPositions()

        await nextTick()

        updateMultiLineSeparationCues()
        updateLineIdentityChangeVisuals()
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