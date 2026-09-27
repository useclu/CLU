<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { useDateFormat } from '@vueuse/shared'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import AnnotationPropertiesDialog from '~/components/editor/dialogs/AnnotationPropertiesDialog.vue'
import cdgExpressIcon from '~/assets/svg/services/cdg_express.svg'
import cdgvalIcon from '~/assets/svg/services/cdgval.svg'
import funicularIcon from '~/assets/svg/services/funicular.svg'
import longDistanceBusIcon from '~/assets/svg/services/long_distance_bus.svg'
import orlybusIcon from '~/assets/svg/services/orlybus.svg'
import orlyvalIcon from '~/assets/svg/services/orlyval.svg'
import roissybusIcon from '~/assets/svg/services/roissybus.svg'
import terIcon from '~/assets/svg/services/ter.svg'
import tgvIcon from '~/assets/svg/services/tgv.svg'
import useVersion from '~/composables/useVersion'
import type { PreviewMode } from '~/composables/useCluPreviewMode'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useProject } from '~/stores/useProject'
import { getMapFontCssFamily } from '~/utils/mapFonts'
import {
  isBranch,
  isBuiltin,
  isCustom,
  isFork,
  isLoop,
  isParallelBranches,
  isStop,
  isVerticalSegment,
} from '~/utils/types'

const props = withDefaults(
  defineProps<{
    previewMode?: PreviewMode | null
  }>(),
  {
    previewMode: null,
  },
)

const { applicationVersion } = useVersion()
const { t } = useI18n()

const {
  line,
  outdated,
  presetBased,
} = storeToRefs(useProject())

type TransportService =
  | 'TGV'
  | 'TER'
  | 'CAR'
  | 'FUNICULAIRE'
  | 'ROISSYBUS'
  | 'ORLYBUS'
  | 'CDGVAL'
  | 'ORLYVAL'
  | 'CDG_EXPRESS'
  | 'CUSTOM'

type CustomTransportService = {
  name?: string
  icon?: string | null
  renderMode?: Mode
}

type LineWithTransportService = Line & {
  transportService?: TransportService | null
  customTransportService?: CustomTransportService
}

type BuiltinTransportService =
  Exclude<TransportService, 'CUSTOM'>

const transportServiceIcons:
  Record<BuiltinTransportService, string> = {
    TGV: tgvIcon,
    TER: terIcon,
    CAR: longDistanceBusIcon,
    FUNICULAIRE: funicularIcon,
    ROISSYBUS: roissybusIcon,
    ORLYBUS: orlybusIcon,
    CDGVAL: cdgvalIcon,
    ORLYVAL: orlyvalIcon,
    CDG_EXPRESS: cdgExpressIcon,
  }

const isPreviewing =
  computed(() => props.previewMode !== null)

const isSncfSignage =
  computed(() => props.previewMode === 'SNCF')

const isRatpPreview =
  computed(() => props.previewMode === 'RATP')

const RATP_BRAND_BLUE =
  '#2452a3'

const RATP_BODY_BACKGROUND =
  '#e6dfdc'

const RATP_MAIN_LANE_X = 30
const RATP_BRANCH_LANE_GAP = 12
const RATP_CONNECTIONS_WIDTH = 28.5
const RATP_STOP_BLOCK_WIDTH = 62.5

/*
 * Géométrie universelle du contenu d'un arrêt RATP.
 *
 * Le nombre/type de correspondances ne doit JAMAIS changer leur distance
 * à l'axe. On ancre le bord droit du bloc juste à gauche du point :
 * 1.45em depuis le centre, soit environ 0.55em de vide après le bord
 * d'un point terminus de 1.82em. Tout surplus grandit uniquement vers
 * la gauche. Le nom reste, lui, à 3.2em à droite du tracé.
 */
const RATP_CONNECTION_AXIS_GAP = 1.45
const RATP_LABEL_AXIS_GAP = 3.2
const RATP_ADJACENT_LANE_CLEARANCE = 1.6
const RATP_CONNECTION_LABEL_SPACER =
  RATP_CONNECTION_AXIS_GAP
  + RATP_LABEL_AXIS_GAP

const mapFontStyle = computed(() => ({
  '--map-font-family':
    getMapFontCssFamily(
      line.value.fontFamily,
    ),
}))

const transportService =
  computed<TransportService | null>(() =>
    (
      line.value as LineWithTransportService
    ).transportService
    ?? null,
  )

function getTransportServiceIcon(
  service: TransportService | null | undefined,
): string | null {
  if (!service) {
    return null
  }

  /*
   * Le Service personnalisé ne possède évidemment pas
   * de SVG statique dans assets/svg/services.
   *
   * Son image est enregistrée directement dans le projet
   * (généralement sous forme de data URL) par
   * GeneralMapSettings.vue.
   */
  if (service === 'CUSTOM') {
    return (
      (
        line.value as LineWithTransportService
      ).customTransportService?.icon
      ?? null
    )
  }

  return transportServiceIcons[service]
}

const transportServiceIcon =
  computed(() =>
    getTransportServiceIcon(
      transportService.value,
    ),
  )

const isWideTransportService =
  computed(() =>
    transportService.value === 'ROISSYBUS'
    || transportService.value === 'ORLYBUS'
    || transportService.value === 'CUSTOM',
  )

const {
  findIndexById,
} = useCustomLineIndices()

const now = useNow()

const date = useDateFormat(
  now.value,
  'DD.MM.YYYY',
)

const content =
  ref<HTMLElement | null>(null)

const classicIdentityPanel =
  ref<HTMLElement | null>(null)

const classicIdentityShiftPx =
  ref(0)

const classicIdentityStyle =
  computed(() => ({
    marginLeft:
      classicIdentityShiftPx.value > 0
        ? `-${classicIdentityShiftPx.value}px`
        : undefined,

    /*
     * Même valeur en positif à droite :
     * le panneau bouge vers la gauche mais sa largeur
     * occupée dans le flex reste identique.
     *
     * Résultat : SectionsGroup et la ligne verte
     * ne changent absolument pas de position.
     */
    marginRight:
      classicIdentityShiftPx.value > 0
        ? `${classicIdentityShiftPx.value}px`
        : undefined,
  }))


const tramIdentityStyle =
  computed(() => {
    const sidePadding =
      Math.max(
        0,
        Number(line.value.mapSize) - 15,
      ) / 2

    if (sidePadding <= 0) {
      return undefined
    }

    return {
      marginLeft: `-${sidePadding}em`,
      marginRight: `${sidePadding}em`,
    }
  })

const contentAdaptiveStyle =
  computed(() => {
    const basePadding =
      `${Math.max(
        0,
        Number(line.value.mapSize) - 15,
      ) / 2}em`

    if (classicIdentityShiftPx.value <= 0) {
      return {
        minHeight:
          `${line.value.mapSize}em`,
        paddingLeft: basePadding,
        paddingRight: basePadding,
      }
    }

    return {
      minHeight:
        `${line.value.mapSize}em`,

      /*
       * Le panneau d'identité peut sortir vers la gauche.
       *
       * On agrandit donc automatiquement la feuille blanche
       * du même nombre de pixels, tout en décalant son bord
       * gauche d'autant.
       *
       * Les éléments internes gardent exactement leur position
       * écran : la ligne verte ne bouge pas.
       */
      marginLeft:
        `-${classicIdentityShiftPx.value}px`,

      paddingLeft:
        `calc(${basePadding} + ${classicIdentityShiftPx.value}px)`,

      paddingRight:
        basePadding,
    }
  })

let classicIdentityObserver:
  ResizeObserver | null = null

let classicIdentityMutationObserver:
  MutationObserver | null = null

let classicIdentityFrame:
  number | null = null

function measureClassicIdentityCollision() {
  const root = content.value
  const panel = classicIdentityPanel.value

  if (
    !root
    || !panel
  ) {
    classicIdentityShiftPx.value = 0
    return
  }

  const direction =
    root.querySelector<HTMLElement>(
      '.terminus-line-direction.branch-start',
    )

  if (
    !direction
    || direction.offsetParent === null
  ) {
    classicIdentityShiftPx.value = 0
    return
  }

  const panelRect =
    panel.getBoundingClientRect()

  const directionRect =
    direction.getBoundingClientRect()

  /*
   * margin-left déplace déjà le panneau.
   * On reconstitue son bord droit avant correction
   * pour éviter tout effet de va-et-vient.
   */
  const naturalPanelRight =
    panelRect.right
    + classicIdentityShiftPx.value

  const gap = 20

  const needed =
    Math.max(
      0,
      naturalPanelRight
      - directionRect.left
      + gap,
    )

  if (
    Math.abs(
      needed
      - classicIdentityShiftPx.value,
    ) < 0.5
  ) {
    return
  }

  classicIdentityShiftPx.value =
    needed
}

function scheduleClassicIdentityCollision() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (classicIdentityFrame !== null) {
    cancelAnimationFrame(
      classicIdentityFrame,
    )
  }

  classicIdentityFrame =
    requestAnimationFrame(
      async () => {
        classicIdentityFrame = null

        await nextTick()

        measureClassicIdentityCollision()
      },
    )
}

function reconnectClassicIdentityObservers() {
  classicIdentityObserver?.disconnect()
  classicIdentityMutationObserver?.disconnect()

  const root = content.value
  const panel = classicIdentityPanel.value

  if (
    !root
    || !panel
  ) {
    return
  }

  classicIdentityObserver =
    new ResizeObserver(
      scheduleClassicIdentityCollision,
    )

  classicIdentityObserver.observe(root)
  classicIdentityObserver.observe(panel)

  const direction =
    root.querySelector<HTMLElement>(
      '.terminus-line-direction.branch-start',
    )

  if (direction) {
    classicIdentityObserver.observe(direction)
  }

  classicIdentityMutationObserver =
    new MutationObserver(
      scheduleClassicIdentityCollision,
    )

  classicIdentityMutationObserver.observe(
    root,
    {
      childList: true,
      subtree: true,
      characterData: true,
    },
  )

  scheduleClassicIdentityCollision()
}

onMounted(async () => {
  await nextTick()

  reconnectClassicIdentityObservers()
  scheduleSncfTramZoneMetrics()

  window.addEventListener(
    'resize',
    scheduleClassicIdentityCollision,
  )
  window.addEventListener(
    'resize',
    scheduleSncfTramZoneMetrics,
  )
})

onUnmounted(() => {
  classicIdentityObserver?.disconnect()
  classicIdentityMutationObserver?.disconnect()

  if (classicIdentityFrame !== null) {
    cancelAnimationFrame(
      classicIdentityFrame,
    )
  }

  if (sncfTramZoneFrame !== null) {
    cancelAnimationFrame(sncfTramZoneFrame)
  }

  window.removeEventListener(
    'resize',
    scheduleClassicIdentityCollision,
  )
  window.removeEventListener(
    'resize',
    scheduleSncfTramZoneMetrics,
  )
})

watch(
  () => line.value.topology,
  async () => {
    await nextTick()
    reconnectClassicIdentityObservers()
    scheduleSncfTramZoneMetrics()
  },
  {
    deep: true,
  },
)

const annotationPropertiesVisible =
  ref(false)

const selectedAnnotation =
  ref<Annotation | null>(null)

const draggingAnnotationId =
  ref<string | null>(null)

let startPointerX = 0
let startPointerY = 0

let startOffsetX = 0
let startOffsetY = 0

let hasMoved = false

const annotations = computed(() =>
  line.value.annotations ?? [],
)

/*
 * =========================================================
 * PLAN BUS / BRT / NOCTILIEN / CABLE / VELO / BOAT
 * =========================================================
 */

const isBusMode = computed(() =>
  line.value.mode === 'BUS'
  || line.value.mode === 'BRT'
  || line.value.mode === 'NOCTILIEN'
  || line.value.mode === 'CABLE'
  || line.value.mode === 'VELO'
  || line.value.mode === 'BOAT',
)

/*
 * =========================================================
 * PLAN TRAMWAY
 * =========================================================
 *
 * Le Tram conserve la topologie et la ligne existantes.
 * Seul le panneau d'identité à gauche reçoit
 * une présentation spécifique.
 */
const isTramMode = computed(() =>
  line.value.mode === 'TRAM',
)

const isSncfRerMode = computed(() =>
  line.value.mode === 'RER',
)

const isSncfHeavyRailMode = computed(() =>
  line.value.mode === 'RER'
  || line.value.mode === 'TRAIN',
)

/*
 * Les modes utilisant le bandeau Bus peuvent afficher
 * leur pictogramme juste avant l'indice de ligne.
 *
 * Lorsqu'un Service de transport est actif, son logo
 * remplace toujours le pictogramme technique de line.mode.
 * Ainsi OrlyBus / RoissyBus / Car ne montrent jamais
 * le pictogramme Bus à la place de leur propre identité.
 */
const showTransportModePictogram = computed(() =>
  transportService.value !== null
  || line.value.mode === 'BUS'
  || line.value.mode === 'BRT'
  || line.value.mode === 'NOCTILIEN'
  || line.value.mode === 'CABLE'
  || line.value.mode === 'VELO'
  || line.value.mode === 'BOAT',
)

/*
 * Certains projets utilisent encore l'ancien champ
 * "stop" des VerticalSegment.
 *
 * Les versions plus récentes peuvent contenir
 * plusieurs arrêts dans "stops".
 */
type VerticalSegmentWithStops =
  VerticalSegment & {
    $verticalSegment:
      VerticalSegment['$verticalSegment'] & {
        stops?: Stop[]
      }
  }

/*
 * Récupère récursivement les arrêts d'une section.
 */
function getStopsFromSection(
  section: LineSection,
): Stop[] {
  const stops: Stop[] = []

  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      /*
       * `invertedElements` inverse le rendu du contenu de l'arrêt
       * (nom / correspondances), PAS l'ordre persistant des éléments.
       * On conserve donc toujours l'ordre réel du tableau.
       */
      stops.push(
        ...element
          .$branch
          .elements
          .filter(isStop),
      )

      continue
    }

    if (isFork(element)) {
      const forkSections =
        element.$fork.sections

      if (forkSections) {
        for (
          const subSection
          of forkSections
        ) {
          stops.push(
            ...getStopsFromSection(
              subSection,
            ),
          )
        }
      }

      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element
          .$parallelBranches
          .sections
      ) {
        stops.push(
          ...getStopsFromSection(
            subSection,
          ),
        )
      }

      continue
    }

    /*
     * IMPORTANT : ce bloc avait été écrasé accidentellement par une
     * copie de `onAnnotationPointerDown()`. Les arrêts placés dans un
     * VerticalSegment n'étaient donc plus comptés. Une sortie de
     * fourche pouvait alors être considérée comme "vide", ce qui
     * supprimait ou retournait toute la branche en prévisualisation.
     */
    if (isVerticalSegment(element)) {
      const data =
        element.$verticalSegment as
          VerticalSegment['$verticalSegment'] & {
            stops?: Stop[]
          }

      const segmentStops =
        data.stops
        ?? (
          data.stop
            ? [data.stop]
            : []
        )

      stops.push(...segmentStops)
      continue
    }

    if (isLoop(element)) {
      const data =
        element.$loop as
          Loop['$loop'] & {
            stops?: Stop[]
          }

      const loopStops =
        data.stops
        ?? (
          data.stop
            ? [data.stop]
            : []
        )

      stops.push(...loopStops)
    }
  }

  return stops
}

/*
 * Tous les arrêts du plan.
 */
const mapStops = computed(() =>
  line.value.topology.flatMap(
    section =>
      getStopsFromSection(
        section,
      ),
  ),
)

/*
 * =========================================================
 * IDENTITÉS DE LIGNES PRÉSENTES SUR LE PLAN
 * =========================================================
 *
 * La ligne principale reste la première identité.
 *
 * Sont ensuite récupérées :
 * - les lignes supplémentaires ajoutées aux branches ;
 * - les identités utilisées seulement sur une portion via
 *   "Changer de ligne après cet arrêt".
 *
 * Toutes sont dédupliquées par identité visible + indice.
 *
 * Le Service de la ligne principale est volontairement
 * séparé d'une éventuelle ligne supplémentaire utilisant
 * le même mode technique.
 *
 * Exemples :
 * - Métro 16 + Métro 17 :
 *   un seul pictogramme Métro puis 16 et 17 côte à côte ;
 * - RER C + Transilien V :
 *   une ligne RER C puis une ligne Transilien V dessous ;
 * - RER C + RER A :
 *   un seul pictogramme RER puis C et A côte à côte.
 */
type DisplayLineIdentity = {
  key: string
  mode: Mode
  index: LineIndex | null
  transportService: TransportService | null
}

type DisplayLineModeGroup = {
  key: string
  mode: Mode
  transportService: TransportService | null
  identities: DisplayLineIdentity[]
}

/*
 * Une identité peut aussi apparaître uniquement sur une
 * portion du plan grâce à "Changer de ligne après cet arrêt".
 *
 * Elle n'a pas besoin d'être déclarée comme ligne
 * supplémentaire de la branche.
 */
type StopWithLineTransition = Stop['$stop'] & {
  lineAfterStopMode?: Mode | null
  lineAfterStopIndex?: LineIndex | null
  lineAfterStopColor?: string | null
}

function lineIdentityKey(
  mode: Mode,
  index: LineIndex | null,
  service: TransportService | null = null,
) {
  const identityPrefix =
    service
      ? `service:${service}`
      : `mode:${mode}`

  if (index === null) {
    return `${identityPrefix}:none`
  }

  if (isBuiltin(index)) {
    return (
      `${identityPrefix}:builtin:`
      + index
        .$builtinLineIndex
        .index
    )
  }

  if (isCustom(index)) {
    return (
      `${identityPrefix}:custom:`
      + index
        .$customLineIndex
        .id
    )
  }

  return `${identityPrefix}:unknown`
}

function getAdditionalLinesFromSection(
  section: LineSection,
) {
  const identities:
    DisplayLineIdentity[] = []

  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      for (
        const additionalLine
        of (
          element
            .$branch
            .additionalLines
          ?? []
        )
      ) {
        identities.push({
          key: lineIdentityKey(
            additionalLine.mode,
            additionalLine.index,
          ),
          mode: additionalLine.mode,
          index: additionalLine.index,
          transportService: null,
        })
      }

      continue
    }

    if (
      isFork(element)
      && element.$fork.sections
    ) {
      for (
        const subSection
        of element.$fork.sections
      ) {
        identities.push(
          ...getAdditionalLinesFromSection(
            subSection,
          ),
        )
      }

      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element
          .$parallelBranches
          .sections
      ) {
        identities.push(
          ...getAdditionalLinesFromSection(
            subSection,
          ),
        )
      }
    }
  }

  return identities
}

const planLineIdentities =
  computed(
    (): DisplayLineIdentity[] => {
      const identities:
        DisplayLineIdentity[] = [
          {
            key: lineIdentityKey(
              line.value.mode,
              line.value.index,
              transportService.value,
            ),
            mode: line.value.mode,
            index: line.value.index,
            transportService:
              transportService.value,
          },
        ]

      for (
        const section
        of line.value.topology
      ) {
        identities.push(
          ...getAdditionalLinesFromSection(
            section,
          ),
        )
      }

      /*
       * Ajoute aussi toutes les identités utilisées seulement
       * sur une portion du tracé.
       *
       * Exemple :
       * - plan principal RER C ;
       * - de Versailles à Massy : Transilien V.
       *
       * Le panneau d'identité affichera alors :
       *
       * [RER] [C]
       * [Transilien] [V]
       *
       * Si la seconde identité était RER A :
       *
       * [RER] [C] [A]
       *
       * grâce au regroupement par mode déjà utilisé plus bas.
       */
      for (
        const stop
        of mapStops.value
      ) {
        const transition = stop.$stop as StopWithLineTransition

        if (!transition.lineAfterStopMode) {
          continue
        }

        identities.push({
          key: lineIdentityKey(
            transition.lineAfterStopMode,
            transition.lineAfterStopIndex
            ?? null,
          ),
          mode:
            transition.lineAfterStopMode,
          index:
            transition.lineAfterStopIndex
            ?? null,
          transportService: null,
        })
      }

      const seen =
        new Set<string>()

      return identities.filter(
        (identity) => {
          if (
            seen.has(identity.key)
          ) {
            return false
          }

          seen.add(identity.key)

          return true
        },
      )
    },
  )

const planLineModeGroups =
  computed<DisplayLineModeGroup[]>(
    () => {
      const groups:
        DisplayLineModeGroup[] = []

      for (
        const identity
        of planLineIdentities.value
      ) {
        const identityService =
          identity.transportService

        let group =
          groups.find(
            item =>
              item.mode === identity.mode
              && item.transportService
              === identityService,
          )

        if (!group) {
          group = {
            key:
              identityService
                ? `service:${identityService}`
                : `mode:${identity.mode}`,
            mode: identity.mode,
            transportService:
              identityService,
            identities: [],
          }

          groups.push(group)
        }

        group.identities.push(
          identity,
        )
      }

      return groups
    },
  )

/*
 * Évite les doublons éventuels.
 */
function uniqueStops(
  stops: Stop[],
): Stop[] {
  const seen =
    new Set<string>()

  return stops.filter(
    (stop) => {
      if (
        seen.has(stop.id)
      ) {
        return false
      }

      seen.add(stop.id)

      return true
    },
  )
}

/*
 * =========================================================
 * DESTINATIONS BUS
 * =========================================================
 *
 * Priorité :
 *
 * 1. arrêts explicitement définis comme terminus ;
 * 2. sinon premier et dernier arrêt nommés.
 */

const busDestinations =
  computed(() => {
    const stops =
      uniqueStops(
        mapStops.value,
      )

    const terminusStops =
      stops.filter(
        stop =>
          stop.$stop.terminus
          && stop
            .$stop
            .name
            .trim()
            !== '',
      )

    if (
      terminusStops.length > 0
    ) {
      return terminusStops.map(
        stop =>
          stop
            .$stop
            .name
            .trim(),
      )
    }

    const namedStops =
      stops.filter(
        stop =>
          stop
            .$stop
            .name
            .trim()
            !== '',
      )

    if (
      namedStops.length
      === 0
    ) {
      return []
    }

    if (
      namedStops.length
      === 1
    ) {
      return [
        namedStops[0]
          .$stop
          .name
          .trim(),
      ]
    }

    return [
      namedStops[0]
        .$stop
        .name
        .trim(),

      namedStops[
        namedStops.length - 1
      ]
        .$stop
        .name
        .trim(),
    ]
  })

/*
 * =========================================================
 * INDICE BUS
 * =========================================================
 *
 * Contrairement au LineIndex classique, le bandeau Bus
 * affiche directement le texte de l'indice dans un
 * cartouche rectangulaire.
 */

const busCustomIndex =
  computed<CustomLineIndexDescription | null>(
    () => {
      const index =
        line.value.index

      if (
        index === null
        || !isCustom(index)
      ) {
        return null
      }

      return (
        findIndexById(
          index
            .$customLineIndex
            .id,
        )
        ?? null
      )
    },
  )

const busCustomIndexImage =
  computed(() =>
    busCustomIndex.value?.image
    ?? null,
  )

/*
 * =========================================================
 * AFFICHAGE DE L'INDICE DANS LE BANDEAU BUS
 * =========================================================
 *
 * Les services OrlyBus et RoissyBus portent déjà leur propre
 * identité de ligne dans leur logo : aucun cartouche d'indice
 * Bus ne doit donc être ajouté à côté.
 *
 * Pour Car, l'indice reste facultatif :
 * - aucun indice choisi => aucun cartouche ;
 * - un indice choisi => le cartouche est affiché.
 *
 * Pour les vrais modes BUS / BRT / NOCTILIEN, on conserve le
 * comportement historique, y compris le '?' si l'indice manque.
 */
const showBusIndex =
  computed(() => {
    if (
      transportService.value === 'ORLYBUS'
      || transportService.value === 'ROISSYBUS'
    ) {
      return false
    }

    if (
      transportService.value === 'CAR'
    ) {
      return line.value.index !== null
    }

    return true
  })

const busIndexText =
  computed(() => {
    const index =
      line.value.index

    if (
      index === null
    ) {
      return '?'
    }

    /*
     * Indice BULB standard.
     */
    if (isBuiltin(index)) {
      return (
        index
          .$builtinLineIndex
          .index
        || '?'
      )
    }

    /*
     * Indice personnalisé.
     */
    if (isCustom(index)) {
      const customIndex =
        busCustomIndex.value

      if (
        customIndex === null
      ) {
        return '?'
      }

      return (
        `${customIndex.prefix ?? ''}`
        + `${customIndex.index}`
        + `${customIndex.suffix ?? ''}`
      )
    }

    return '?'
  })

/*
 * Couleur du cartouche.
 *
 * On utilise directement la couleur choisie
 * pour la ligne dans le projet.
 */
const busIndexBackground =
  computed(() =>
    line.value.color
    ?? '#f5c400',
  )

/*
 * Détermine automatiquement si le texte
 * du cartouche doit être blanc ou noir
 * selon la luminosité de la couleur.
 */
const busIndexForeground =
  computed(() => {
    const rawColor =
      busIndexBackground
        .value
        .trim()

    const match =
      rawColor.match(
        /^#?([0-9a-f]{6})$/i,
      )

    if (
      match === null
    ) {
      return '#111111'
    }

    const hex =
      match[1]

    const red =
      Number.parseInt(
        hex.slice(0, 2),
        16,
      )

    const green =
      Number.parseInt(
        hex.slice(2, 4),
        16,
      )

    const blue =
      Number.parseInt(
        hex.slice(4, 6),
        16,
      )

    const luminance =
      (
        red * 299
        + green * 587
        + blue * 114
      )
      / 1000

    return (
      luminance > 150
        ? '#111111'
        : '#ffffff'
    )
  })

const busIndexStyle =
  computed(() => ({
    backgroundColor:
      busIndexBackground.value,

    color:
      busIndexForeground.value,
  }))

const sncfStopPropertiesVisible =
  ref(false)

const sncfConnectionsVisible =
  ref(false)

const selectedSncfStop =
  ref<Stop | null>(null)

const selectedSncfBranch =
  ref<Branch | null>(null)

function findBranchForStopInSection(
  section: LineSection,
  stopId: string,
): Branch | null {
  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      const hasStop =
        element.$branch.elements.some(
          branchElement =>
            isStop(branchElement)
            && branchElement.id === stopId,
        )

      if (hasStop) {
        return element
      }

      continue
    }

    if (
      isFork(element)
      && element.$fork.sections
    ) {
      for (
        const subSection
        of element.$fork.sections
      ) {
        const branch =
          findBranchForStopInSection(
            subSection,
            stopId,
          )

        if (branch) {
          return branch
        }
      }

      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element
          .$parallelBranches
          .sections
      ) {
        const branch =
          findBranchForStopInSection(
            subSection,
            stopId,
          )

        if (branch) {
          return branch
        }
      }
    }
  }

  return null
}

function findBranchForStop(
  stopId: string,
): Branch | null {
  for (
    const section
    of line.value.topology
  ) {
    const branch =
      findBranchForStopInSection(
        section,
        stopId,
      )

    if (branch) {
      return branch
    }
  }

  return null
}

function openSncfStopProperties(
  stop: Stop,
) {
  const branch =
    findBranchForStop(
      stop.id,
    )

  if (!branch) {
    return
  }

  selectedSncfStop.value =
    stop

  selectedSncfBranch.value =
    branch

  sncfStopPropertiesVisible.value =
    true
}

function deleteSncfStop(
  stop: Stop,
) {
  const branch =
    findBranchForStop(
      stop.id,
    )

  if (!branch) {
    return
  }

  const index =
    branch
      .$branch
      .elements
      .findIndex(
        element =>
          isStop(element)
          && element.id === stop.id,
      )

  if (index < 0) {
    return
  }

  branch
    .$branch
    .elements
    .splice(
      index,
      1,
    )

  if (
    selectedSncfStop.value?.id
    === stop.id
  ) {
    selectedSncfStop.value =
      null

    selectedSncfBranch.value =
      null

    sncfStopPropertiesVisible.value =
      false

    sncfConnectionsVisible.value =
      false
  }
}

/*
 * =========================================================
 * SIGNALÉTIQUE SNCF — PREMIÈRE BASE
 * =========================================================
 *
 * Important :
 * - le rendu IDFM existant reste entièrement inchangé ;
 * - cette vue lit seulement les données existantes ;
 * - elle n'écrit rien dans la topologie ;
 * - le changement de ligne local est rendu directement sur l’arrêt.
 */

const sncfStops =
  computed(() =>
    uniqueStops(
      mapStops.value,
    ),
  )

watch(
  () => sncfStops.value.map(stop => stop.id).join('|'),
  async () => {
    await nextTick()
    scheduleSncfTramZoneMetrics()
  },
)


function stopHasUrbanBubble(stop: Stop) {
  return stop.$stop.urbanBubble === true
}

function sncfUrbanBubbleClass(index: number) {
  const previous =
    index > 0
    && stopHasUrbanBubble(sncfStops.value[index - 1])

  const next =
    index < sncfStops.value.length - 1
    && stopHasUrbanBubble(sncfStops.value[index + 1])

  return {
    'is-bubble-start': !previous,
    'is-bubble-end': !next,
  }
}

function networkUrbanBubbleClass(
  rowIndex: number,
  lane: number,
) {
  function hasNeighbor(direction: -1 | 1) {
    for (
      let index = rowIndex + direction;
      index >= 0
      && index < sncfNetwork.value.rows.length;
      index += direction
    ) {
      const row = sncfNetwork.value.rows[index]
      const sameLaneStop =
        row.stops.find(entry => entry.lane === lane)

      if (sameLaneStop) {
        return stopHasUrbanBubble(sameLaneStop.stop)
      }

      if (row.stops.length > 0) {
        return false
      }
    }

    return false
  }

  return {
    'is-bubble-start': !hasNeighbor(-1),
    'is-bubble-end': !hasNeighbor(1),
  }
}

function urbanBubbleLabelForStop(stop: Stop) {
  const placeName = stop.$stop.placeName?.trim()

  if (placeName) return placeName

  const ratpAreaLabel =
    ratpAreaLabelByStopId.value.get(stop.id)?.trim()

  if (ratpAreaLabel) return ratpAreaLabel

  const sncfAreaLabel =
    sncfTramAreaMarkerByStopId.value.get(stop.id)?.city?.trim()

  return sncfAreaLabel || ''
}

function sncfUrbanBubbleLabel(index: number) {
  const stop = sncfStops.value[index]

  if (!stopHasUrbanBubble(stop)) {
    return ''
  }

  let start = index
  let end = index

  while (
    start > 0
    && stopHasUrbanBubble(sncfStops.value[start - 1])
  ) {
    start -= 1
  }

  while (
    end < sncfStops.value.length - 1
    && stopHasUrbanBubble(sncfStops.value[end + 1])
  ) {
    end += 1
  }

  const middleIndex = Math.floor((start + end) / 2)

  if (index != middleIndex) {
    return ''
  }

  for (let cursor = start; cursor <= end; cursor += 1) {
    const label =
      urbanBubbleLabelForStop(sncfStops.value[cursor])

    if (label.length > 0) {
      return label
    }
  }

  return ''
}

function networkUrbanBubbleLabel(
  rowIndex: number,
  lane: number,
) {
  function laneStopAt(index: number) {
    return sncfNetwork.value.rows[index]?.stops.find(
      entry => entry.lane === lane,
    )
  }

  const entry = laneStopAt(rowIndex)

  if (!entry || !stopHasUrbanBubble(entry.stop)) {
    return ''
  }

  let start = rowIndex
  let end = rowIndex

  while (start > 0) {
    const previous = laneStopAt(start - 1)

    if (!previous || !stopHasUrbanBubble(previous.stop)) {
      break
    }

    start -= 1
  }

  while (end < sncfNetwork.value.rows.length - 1) {
    const next = laneStopAt(end + 1)

    if (!next || !stopHasUrbanBubble(next.stop)) {
      break
    }

    end += 1
  }

  const middleIndex = Math.floor((start + end) / 2)

  if (rowIndex != middleIndex) {
    return ''
  }

  for (let cursor = start; cursor <= end; cursor += 1) {
    const candidate = laneStopAt(cursor)
    const label = candidate
      ? urbanBubbleLabelForStop(candidate.stop)
      : ''

    if (label.length > 0) {
      return label
    }
  }

  return ''
}

/*
 * Identité locale d'un arrêt en signalétique SNCF.
 *
 * Les champs lineAfterStop* conservent leur nom historique dans
 * les sauvegardes pour ne casser aucun ancien projet, mais leur
 * sémantique est désormais strictement "sur cet arrêt".
 */
function sncfStopLocalLineIdentity(
  stop: Stop,
) {
  const data =
    stop.$stop as StopWithLineTransition

  if (!data.lineAfterStopMode) {
    return null
  }

  return {
    mode:
      data.lineAfterStopMode,
    index:
      data.lineAfterStopIndex
      ?? null,
    color:
      data.lineAfterStopColor
      || line.value.color
      || '#ffffff',
  }
}

function sncfOutgoingLineIdentity(
  stop: Stop,
) {
  return sncfStopLocalLineIdentity(stop)
}

function sncfIncomingLineIdentity(
  index: number,
) {
  if (index <= 0) {
    return null
  }

  return sncfStopLocalLineIdentity(
    sncfStops.value[index - 1],
  )
}

function sncfSegmentColorBefore(
  index: number,
) {
  return (
    sncfIncomingLineIdentity(index)
      ?.color
    ?? line.value.color
    ?? '#ffffff'
  )
}

function sncfSegmentColorAfter(
  stop: Stop,
) {
  return (
    sncfOutgoingLineIdentity(stop)
      ?.color
    ?? line.value.color
    ?? '#ffffff'
  )
}

function sncfStopMarkerLineColor(
  stop: Stop,
  index: number,
) {
  return (
    sncfOutgoingLineIdentity(stop)
      ?.color
    ?? sncfIncomingLineIdentity(index)
      ?.color
    ?? line.value.color
    ?? '#ffffff'
  )
}

/*
 * =========================================================
 * RÉSEAU DE BRANCHES — PRÉVISUALISATION SNCF
 * =========================================================
 *
 * L'éditeur normal reste la source de vérité : Branch, Fork et
 * ParallelBranches sont toujours construits dans la vue d'édition.
 * Cette structure ne fait que traduire la topologie persistée vers
 * un réseau vertical lisible.
 *
 * La profondeur n'est plus volontairement écrasée après deux niveaux :
 * les RER / Transilien complexes peuvent réellement imbriquer plusieurs
 * bifurcations. Une garde haute reste conservée uniquement contre un JSON
 * pathologique ou une référence cyclique accidentelle.
 */
type SncfNetworkStop = {
  key: string
  stop: Stop
  lane: number
}

type SncfNetworkRow = {
  key: string
  stops: SncfNetworkStop[]
  forks: SncfNetworkFork[]
}

type SncfNetworkFork = {
  key: string
  fromLane: number
  toLane: number
  color: string
  kind: 'SPLIT' | 'MERGE'
}

type SncfNetworkLane = {
  lane: number
  startRow: number
  endRow: number
  color: string
  activeRows: Set<number>
}

type SncfNetworkLocalRange = {
  key: string
  lane: number
  startRow: number
  endRow: number
  color: string
}

type SncfOpenParallelLayout = {
  sourceLane: number
  primaryLane: number
  secondaryLane: number
  primaryColor: string
  secondaryColor: string
  primaryEnd: number
  secondaryEnd: number
}

type ForkWithPairId = Fork['$fork'] & {
  parallelBranchesId?: string
}

type ParallelBranchesWithPairId =
  ParallelBranches['$parallelBranches'] & {
    forkId?: string
  }

const SNCF_MAX_BRANCH_DEPTH = 6

/*
 * Une voie SNCF n'est pas seulement un trait : elle possède aussi
 * toute sa colonne de noms / correspondances. L'ancien espacement
 * (6.4em) convenait au trait seul mais faisait se superposer les
 * deux branches. Chaque branche reçoit désormais une vraie colonne.
 */
const SNCF_NETWORK_LANE_GAP = 35
const SNCF_NETWORK_LABEL_OFFSET = 2.15
const SNCF_NETWORK_LABEL_WIDTH = 30.5
const SNCF_NETWORK_SIDE_PADDING = 2.5
/*
 * On réserve à gauche la même largeur que celle nécessaire aux
 * libellés à droite. Le réseau (traits + branches) est donc centré
 * visuellement au lieu d'être collé au bord gauche du panneau.
 */
const SNCF_NETWORK_SIDE_RESERVE =
  SNCF_NETWORK_LABEL_OFFSET
  + SNCF_NETWORK_LABEL_WIDTH
  + SNCF_NETWORK_SIDE_PADDING
const SNCF_NETWORK_LANE_START =
  SNCF_NETWORK_SIDE_RESERVE
const SNCF_NETWORK_FORK_HEIGHT = 8.2

/*
 * Ordre des sorties d'une fourche en aperçu vertical.
 *
 * Dans l'éditeur horizontal, un levelOffset positif place la sortie
 * AU-DESSUS du tronc et un levelOffset négatif EN-DESSOUS. En aperçu
 * vertical on transpose cette information sans la retourner :
 *
 *   niveau le plus haut  -> colonne de gauche
 *   niveau le plus bas   -> colonne de droite
 *
 * Le sens LEFT / RIGHT de la Fork indique si l'on fusionne ou si l'on
 * sépare ; il ne doit jamais inverser les deux sorties.
 */
function sncfSectionLevelOffset(
  section: LineSection,
) {
  const value = Number(
    section.$lineSection.levelOffset
    ?? 0,
  )

  return Number.isFinite(value)
    ? value
    : 0
}

function sncfOutputSectionSides(
  sections: [LineSection, LineSection],
): ['LEFT' | 'RIGHT', 'LEFT' | 'RIGHT'] {
  const first =
    sncfSectionLevelOffset(sections[0])

  const second =
    sncfSectionLevelOffset(sections[1])

  if (Math.abs(first - second) > .0001) {
    return first > second
      ? ['LEFT', 'RIGHT']
      : ['RIGHT', 'LEFT']
  }

  /*
   * Ancien JSON sans levelOffset exploitable : on garde un ordre stable
   * par index au lieu de dépendre du sens de la Fork.
   */
  return ['LEFT', 'RIGHT']
}

function sncfSingleOutputSide(
  sections: [LineSection, LineSection],
  populatedIndex: number,
) {
  return sncfOutputSectionSides(sections)[populatedIndex]
}

function sncfStraightOutputIndex(
  sections: [LineSection, LineSection],
) {
  const first =
    sncfSectionLevelOffset(sections[0])

  const second =
    sncfSectionLevelOffset(sections[1])

  const firstIsStraight =
    Math.abs(first) < .0001

  const secondIsStraight =
    Math.abs(second) < .0001

  if (firstIsStraight === secondIsStraight) {
    return -1
  }

  return firstIsStraight ? 0 : 1
}

function sncfBranchColor(
  branch: Branch,
  fallback: string,
) {
  const data = branch.$branch

  if (
    data.primaryLineVisible === false
    && data.additionalLines
    && data.additionalLines.length > 0
  ) {
    return (
      data.additionalLines[0].color
      || fallback
    )
  }

  return fallback
}

function sncfSectionColor(
  section: LineSection,
  fallback: string,
) {
  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      return sncfBranchColor(
        element,
        fallback,
      )
    }
  }

  return fallback
}

function sncfForkSections(
  fork: Fork,
  sectionElements: LineElement[],
) {
  const directSections =
    fork.$fork.sections

  const pairId =
    (fork.$fork as ForkWithPairId)
      .parallelBranchesId

  if (
    directSections
    && directSections.length === 2
  ) {
    return {
      sections: directSections,
      pairedParallelBranchesId:
        pairId ?? null,
    }
  }

  if (!pairId) {
    /*
     * Compatibilité avec les anciens préréglages CLU : ils n'ont pas
     * toujours parallelBranchesId / forkId. La relation est alors
     * portée par l'ordre topologique :
     *
     *   ParallelBranches -> Fork LEFT  = fusion
     *   Fork RIGHT -> ParallelBranches = séparation
     *
     * C'est notamment le cas du préréglage RER B. Sans cette détection,
     * le ParallelBranches était rendu comme une fourche autonome puis
     * la Fork voisine était ignorée, ce qui créait les grands rectangles.
     */
    const forkIndex =
      sectionElements.findIndex(
        element => element.id === fork.id,
      )

    const adjacentIndex =
      fork.$fork.toward === 'LEFT'
        ? forkIndex - 1
        : forkIndex + 1

    const adjacentPair =
      forkIndex >= 0
        ? sectionElements[adjacentIndex]
        : undefined

    if (
      adjacentPair
      && isParallelBranches(adjacentPair)
    ) {
      return {
        sections:
          adjacentPair.$parallelBranches.sections,
        pairedParallelBranchesId:
          adjacentPair.id,
      }
    }

    return {
      sections: null,
      pairedParallelBranchesId: null,
    }
  }

  const pair =
    sectionElements.find(
      element =>
        element.id === pairId
        && isParallelBranches(element),
    )

  if (
    pair
    && isParallelBranches(pair)
  ) {
    return {
      sections:
        pair.$parallelBranches.sections,
      pairedParallelBranchesId:
        pair.id,
    }
  }

  return {
    sections: null,
    pairedParallelBranchesId: null,
  }
}

const sncfNetwork = computed(() => {
  /*
   * Les lignes sont placées sur une grille logique (row/lane).
   * Point important : les deux sorties d'une fourche commencent à
   * la MEME ligne. Elles sont donc réellement parallèles au lieu
   * d'être ajoutées l'une après l'autre dans la hauteur du plan.
   */
  const rowMap =
    new Map<number, SncfNetworkRow>()

  const lanes =
    new Map<number, SncfNetworkLane>()

  const laneColorEvents =
    new Map<
      number,
      Map<number, string>
    >()

  const handledParallelBranches =
    new Set<string>()

  const openParallelLayouts =
    new Map<string, SncfOpenParallelLayout>()

  const seenStops =
    new Set<string>()

  let minLane = 0
  let maxLane = 0
  let maxRow = 0
  let hasBranches = false

  const mainColor =
    line.value.color
    ?? '#ffffff'

  function ensureRow(
    rowIndex: number,
  ) {
    const existing =
      rowMap.get(rowIndex)

    if (existing) {
      return existing
    }

    const row: SncfNetworkRow = {
      key: `network-row-${rowIndex}`,
      stops: [],
      forks: [],
    }

    rowMap.set(
      rowIndex,
      row,
    )

    maxRow = Math.max(
      maxRow,
      rowIndex,
    )

    return row
  }

  function touchLane(
    lane: number,
    row: number,
    color: string,
  ) {
    const colorEvents =
      laneColorEvents.get(lane)
      ?? new Map<number, string>()

    colorEvents.set(
      row,
      color,
    )

    laneColorEvents.set(
      lane,
      colorEvents,
    )

    const existing = lanes.get(lane)

    if (!existing) {
      lanes.set(
        lane,
        {
          lane,
          startRow: row,
          endRow: row,
          color,
          activeRows: new Set([row]),
        },
      )

      minLane = Math.min(
        minLane,
        lane,
      )
      maxLane = Math.max(
        maxLane,
        lane,
      )

      return
    }

    existing.startRow = Math.min(
      existing.startRow,
      row,
    )
    existing.endRow = Math.max(
      existing.endRow,
      row,
    )
    existing.activeRows.add(row)
  }

  /*
   * Une même colonne logique peut être réutilisée plus loin par une
   * autre branche (cas RER B : branche nord puis branche sud).
   * `touchLane()` n'active donc qu'une ligne précise et ne remplit
   * jamais implicitement le vide entre deux usages distincts.
   *
   * Quand on veut réellement prolonger une branche courte jusqu'à
   * une fusion, on le demande explicitement avec cette fonction.
   */
  function extendLaneTo(
    lane: number,
    row: number,
    color: string,
  ) {
    const existing = lanes.get(lane)

    if (!existing) {
      touchLane(lane, row, color)
      return
    }

    const fromRow = existing.endRow

    for (
      let activeRow = fromRow;
      activeRow <= row;
      activeRow += 1
    ) {
      existing.activeRows.add(activeRow)
    }

    touchLane(lane, row, color)
  }

  function addStop(
    stop: Stop,
    lane: number,
    color: string,
    rowIndex: number,
  ) {
    if (seenStops.has(stop.id)) {
      return rowIndex
    }

    ensureRow(rowIndex).stops.push({
      key: `stop-${stop.id}`,
      stop,
      lane,
    })

    seenStops.add(stop.id)
    touchLane(
      lane,
      rowIndex,
      color,
    )

    return rowIndex + 1
  }

  function allocateLane(
    fromLane: number,
    toward: 'LEFT' | 'RIGHT',
  ) {
    /*
     * Une sous-fourche doit sortir vers l'extérieur du réseau.
     * Sinon une bifurcation de la voie de gauche vers la droite
     * traverserait visuellement la branche déjà placée à droite.
     */
    if (minLane < maxLane) {
      if (fromLane <= minLane) {
        minLane -= 1
        return minLane
      }

      if (fromLane >= maxLane) {
        maxLane += 1
        return maxLane
      }
    }

    if (toward === 'LEFT') {
      minLane -= 1
      return minLane
    }

    maxLane += 1
    return maxLane
  }

  function addForkRow(
    fromLane: number,
    toLane: number,
    color: string,
    key: string,
    rowIndex: number,
    kind: 'SPLIT' | 'MERGE',
  ) {
    ensureRow(rowIndex).forks.push({
      key,
      fromLane,
      toLane,
      color,
      kind,
    })

    if (kind === 'SPLIT') {
      /*
       * La voie source existe avant la fourche. La voie secondaire
       * commence seulement sous le raccord.
       */
      touchLane(
        fromLane,
        rowIndex,
        lanes.get(fromLane)?.color
        ?? mainColor,
      )

      touchLane(
        toLane,
        rowIndex + 1,
        color,
      )
    }
    else {
      /*
       * Pour une fourche LEFT le ParallelBranches est AVANT la Fork
       * dans la topologie de l'éditeur : on dessine donc une fusion.
       * Les deux voies arrivent par le haut et la voie commune repart
       * sous le raccord, exactement comme dans le rendu IDFM.
       */
      touchLane(
        fromLane,
        rowIndex,
        color,
      )

      touchLane(
        toLane,
        rowIndex + 1,
        lanes.get(toLane)?.color
        ?? mainColor,
      )
    }

    maxRow = Math.max(
      maxRow,
      rowIndex,
    )
  }

  function addVerticalSegmentStops(
    element: VerticalSegment,
    lane: number,
    color: string,
    startRow: number,
  ) {
    const data =
      element.$verticalSegment as
        VerticalSegment['$verticalSegment'] & {
          stops?: Stop[]
        }

    const stops =
      data.stops
      ?? (
        data.stop
          ? [data.stop]
          : []
      )

    let row = startRow

    for (const stop of stops) {
      row = addStop(
        stop,
        lane,
        color,
        row,
      )
    }

    return row
  }

  function addLoopStops(
    element: Loop,
    lane: number,
    color: string,
    startRow: number,
  ) {
    const data =
      element.$loop as
        Loop['$loop'] & {
          stops?: Stop[]
        }

    const stops =
      data.stops
      ?? (
        data.stop
          ? [data.stop]
          : []
      )

    let row = startRow

    for (const stop of stops) {
      row = addStop(
        stop,
        lane,
        color,
        row,
      )
    }

    return row
  }

  function processParallelSections(
    sections: [LineSection, LineSection],
    lane: number,
    depth: number,
    color: string,
    toward: 'LEFT' | 'RIGHT',
    key: string,
    startRow: number,
    layoutId?: string | null,
  ) {
    /*
     * Deux niveaux visuels maximum : fourche principale puis une
     * sous-fourche dans l'une des branches. Au-delà on garde tous
     * les arrêts mais sur la dernière voie disponible.
     */
    if (
      depth >= SNCF_MAX_BRANCH_DEPTH
    ) {
      let row = startRow

      for (const subSection of sections) {
        row = processSection(
          subSection,
          lane,
          depth + 1,
          color,
          row,
        )
      }

      return row
    }

    hasBranches = true

    const primaryColor =
      sncfSectionColor(
        sections[0],
        color,
      )

    const secondaryColor =
      sncfSectionColor(
        sections[1],
        color,
      )

    /*
     * Certaines lignes utilisent une branche parallèle asymétrique :
     * une des deux sous-sections est volontairement vide et représente
     * la continuité de la branche déjà dessinée sur `lane`.
     *
     * Exemple : Tram T8 avant la fourche LEFT.
     * - la branche Épinay existe déjà sur la voie courante ;
     * - une seule sous-section contient Villetaneuse Université ;
     * - les deux se rejoignent ensuite vers le tronc commun.
     *
     * Il ne faut surtout pas créer une seconde voie vide : c'était la
     * cause du trait mort à droite et de la coupure sous Blumenthal.
     */
    const sectionHasStops = [
      getStopsFromSection(sections[0]).length > 0,
      getStopsFromSection(sections[1]).length > 0,
    ] as const

    const populatedSectionCount =
      sectionHasStops.filter(Boolean).length

    /*
     * Une sortie à levelOffset 0 est la continuation géométrique du
     * tronc dans l'éditeur. Elle doit donc rester sur la même colonne
     * dans les aperçus SNCF/RATP. Sinon on fabrique artificiellement un
     * grand V alors que seule l'autre sortie bifurque (cas Transilien R,
     * sous-fourches avec [4, 0] ou [0, -4], etc.).
     */
    const straightOutputIndex =
      populatedSectionCount === 2
        ? sncfStraightOutputIndex(sections)
        : -1

    if (straightOutputIndex >= 0) {
      const branchIndex =
        straightOutputIndex === 0 ? 1 : 0

      const straightSection =
        sections[straightOutputIndex]

      const branchSection =
        sections[branchIndex]

      const straightColor =
        straightOutputIndex === 0
          ? primaryColor
          : secondaryColor

      const branchColor =
        branchIndex === 0
          ? primaryColor
          : secondaryColor

      const branchLane =
        allocateLane(
          lane,
          sncfSingleOutputSide(
            sections,
            branchIndex,
          ),
        )

      if (toward === 'RIGHT') {
        addForkRow(
          lane,
          branchLane,
          branchColor,
          `${key}-offset-branch`,
          startRow,
          'SPLIT',
        )

        const branchStartRow =
          startRow + 1

        const straightEnd =
          processSection(
            straightSection,
            lane,
            depth + 1,
            straightColor,
            branchStartRow,
          )

        const branchEnd =
          processSection(
            branchSection,
            branchLane,
            depth + 1,
            branchColor,
            branchStartRow,
          )

        if (layoutId) {
          const sectionLanes: [number, number] =
            straightOutputIndex === 0
              ? [lane, branchLane]
              : [branchLane, lane]

          const sectionColors: [string, string] =
            [primaryColor, secondaryColor]

          const sectionEnds: [number, number] =
            straightOutputIndex === 0
              ? [straightEnd, branchEnd]
              : [branchEnd, straightEnd]

          openParallelLayouts.set(
            layoutId,
            {
              sourceLane: lane,
              primaryLane: sectionLanes[0],
              secondaryLane: sectionLanes[1],
              primaryColor: sectionColors[0],
              secondaryColor: sectionColors[1],
              primaryEnd: sectionEnds[0],
              secondaryEnd: sectionEnds[1],
            },
          )
        }

        return Math.max(
          straightEnd,
          branchEnd,
        )
      }

      const straightEnd =
        processSection(
          straightSection,
          lane,
          depth + 1,
          straightColor,
          startRow,
        )

      const branchEnd =
        processSection(
          branchSection,
          branchLane,
          depth + 1,
          branchColor,
          startRow,
        )

      const mergeRow = Math.max(
        straightEnd,
        branchEnd,
      )

      extendLaneTo(
        lane,
        mergeRow,
        straightColor,
      )

      extendLaneTo(
        branchLane,
        mergeRow,
        branchColor,
      )

      addForkRow(
        branchLane,
        lane,
        color,
        `${key}-offset-branch`,
        mergeRow,
        'MERGE',
      )

      return mergeRow + 1
    }

    if (
      toward === 'RIGHT'
      && populatedSectionCount === 1
    ) {
      /*
       * Certaines topologies Transilien (notamment R/P) encodent une
       * sous-fourche avec une section vide. La section vide signifie
       * « la voie courante continue » ; elle ne représente pas une
       * seconde branche graphique.
       *
       * L'ancien rendu créait malgré tout deux voies puis retraitait la
       * même ParallelBranches à la fermeture : d'où les grands rectangles
       * et traits morts. On ne crée ici que la vraie branche latérale.
       */
      const branchIndex =
        sectionHasStops[0] ? 0 : 1

      const branchSection =
        sections[branchIndex]

      const branchColor =
        branchIndex === 0
          ? primaryColor
          : secondaryColor

      const branchLane =
        allocateLane(
          lane,
          sncfSingleOutputSide(
            sections,
            branchIndex,
          ),
        )

      addForkRow(
        lane,
        branchLane,
        branchColor,
        `${key}-single-branch`,
        startRow,
        'SPLIT',
      )

      const branchEnd =
        processSection(
          branchSection,
          branchLane,
          depth + 1,
          branchColor,
          startRow + 1,
        )

      /*
       * La voie principale continue pendant toute la branche latérale.
       * Les éléments qui suivent reprennent donc sur cette même voie,
       * sous la branche terminée, sans créer de voie fantôme.
       */
      extendLaneTo(
        lane,
        branchEnd,
        lanes.get(lane)?.color
        ?? color,
      )

      return branchEnd
    }

    if (
      toward === 'LEFT'
      && populatedSectionCount === 1
    ) {
      const branchIndex =
        sectionHasStops[0] ? 0 : 1

      const branchSection =
        sections[branchIndex]

      const branchColor =
        branchIndex === 0
          ? primaryColor
          : secondaryColor

      /*
       * La branche existante reste sur `lane`. La vraie branche
       * parallèle est placée sur une voie latérale, puis rejoint la
       * voie existante avec un seul raccord MERGE arrondi.
       */
      const branchLane =
        allocateLane(
          lane,
          sncfSingleOutputSide(
            sections,
            branchIndex,
          ),
        )

      const branchEnd =
        processSection(
          branchSection,
          branchLane,
          depth + 1,
          branchColor,
          startRow,
        )

      const mergeRow = branchEnd

      /*
       * Prolonge explicitement les deux branches jusqu'à la fusion.
       * La voie courante contient ici les arrêts déjà rencontrés avant
       * ParallelBranches (Épinay / Blumenthal dans le preset T8).
       */
      extendLaneTo(
        lane,
        mergeRow,
        lanes.get(lane)?.color
        ?? color,
      )

      extendLaneTo(
        branchLane,
        mergeRow,
        branchColor,
      )

      addForkRow(
        branchLane,
        lane,
        color,
        `${key}-single-branch`,
        mergeRow,
        'MERGE',
      )

      return mergeRow + 1
    }

    /*
     * La topologie CLU donne un vrai sens à toward :
     *
     * - RIGHT : Fork puis ParallelBranches -> séparation ;
     * - LEFT  : ParallelBranches puis Fork -> fusion.
     *
     * L'ancien aperçu SNCF traitait les deux cas comme une séparation
     * vers le bas. C'est exactement ce qui transformait une branche
     * parallèle comme Plailly en grande fourche flottante au-dessus
     * de la ligne commune.
     */
    if (toward === 'RIGHT') {
      /*
       * Comme pour LEFT, les deux sections après la fourche sont deux
       * vraies branches. Le tronc commun ne doit donc pas continuer sur
       * l'axe central sous la bifurcation.
       *
       * On place la section 0 à gauche et la section 1 à droite du tronc
       * puis on dessine deux raccords arrondis depuis la voie commune.
       * Cela donne le miroir du cas LEFT validé par l'utilisateur.
       */
      const [
        primarySide,
        secondarySide,
      ] = sncfOutputSectionSides(
        sections,
      )

      const primaryLane =
        lane
        + (primarySide === 'LEFT' ? -1 : 1)

      const secondaryLane =
        lane
        + (secondarySide === 'LEFT' ? -1 : 1)

      minLane = Math.min(
        minLane,
        primaryLane,
        secondaryLane,
      )
      maxLane = Math.max(
        maxLane,
        primaryLane,
        secondaryLane,
      )

      addForkRow(
        lane,
        primaryLane,
        primaryColor,
        `${key}-primary`,
        startRow,
        'SPLIT',
      )

      addForkRow(
        lane,
        secondaryLane,
        secondaryColor,
        `${key}-secondary`,
        startRow,
        'SPLIT',
      )

      const branchStartRow =
        startRow + 1

      const primaryEnd =
        processSection(
          sections[0],
          primaryLane,
          depth + 1,
          primaryColor,
          branchStartRow,
        )

      const secondaryEnd =
        processSection(
          sections[1],
          secondaryLane,
          depth + 1,
          secondaryColor,
          branchStartRow,
        )

      if (layoutId) {
        openParallelLayouts.set(
          layoutId,
          {
            sourceLane: lane,
            primaryLane,
            secondaryLane,
            primaryColor,
            secondaryColor,
            primaryEnd,
            secondaryEnd,
          },
        )
      }

      return Math.max(
        primaryEnd,
        secondaryEnd,
      )
    }

    /*
     * LEFT : le couple ParallelBranches est situé AVANT la Fork.
     * Les DEUX sections sont donc de vraies branches et aucune d'elles
     * ne doit être confondue avec le tronc commun.
     *
     * L'ordre gauche/droite vient désormais des `levelOffset` persistés
     * dans les deux LineSection. Le sens LEFT signifie seulement que
     * l'on FUSIONNE vers le tronc ; il ne retourne jamais les sorties.
     */
    const [
      primarySide,
      secondarySide,
    ] = sncfOutputSectionSides(
      sections,
    )

    const primaryLane =
      lane
      + (primarySide === 'LEFT' ? -1 : 1)

    const secondaryLane =
      lane
      + (secondarySide === 'LEFT' ? -1 : 1)

    minLane = Math.min(
      minLane,
      primaryLane,
      secondaryLane,
    )
    maxLane = Math.max(
      maxLane,
      primaryLane,
      secondaryLane,
    )

    const primaryEnd =
      processSection(
        sections[0],
        primaryLane,
        depth + 1,
        primaryColor,
        startRow,
      )

    const secondaryEnd =
      processSection(
        sections[1],
        secondaryLane,
        depth + 1,
        secondaryColor,
        startRow,
      )

    const mergeRow = Math.max(
      primaryEnd,
      secondaryEnd,
    )

    /*
     * Une branche courte est prolongée jusqu'au DÉBUT de la ligne de
     * fusion. Le rendu de cette dernière ligne s'arrête exactement au
     * bord supérieur : aucun petit trait ne dépasse sous le dernier
     * arrêt (cas La Borne Blanche).
     */
    extendLaneTo(
      primaryLane,
      mergeRow,
      primaryColor,
    )

    extendLaneTo(
      secondaryLane,
      mergeRow,
      secondaryColor,
    )

    /*
     * Deux raccords arrondis, un pour chaque branche, rejoignent le
     * même tronc central. On obtient une vraie fourche symétrique au
     * lieu d'une branche courbe venant se greffer sur une ligne droite.
     */
    addForkRow(
      primaryLane,
      lane,
      color,
      `${key}-primary`,
      mergeRow,
      'MERGE',
    )

    addForkRow(
      secondaryLane,
      lane,
      color,
      `${key}-secondary`,
      mergeRow,
      'MERGE',
    )

    return mergeRow + 1
  }

  function processSection(
    section: LineSection,
    lane: number,
    depth: number,
    color: string,
    startRow: number,
  ) {
    const sectionElements =
      section.$lineSection.elements

    let row = startRow

    for (
      const element
      of sectionElements
    ) {
      if (isBranch(element)) {
        const branchColor =
          sncfBranchColor(
            element,
            color,
          )

        /*
         * `invertedElements` ne retourne pas la desserte dans l'éditeur.
         * Il inverse seulement l'orientation visuelle de l'arrêt.
         * Inverser le tableau ici retournait des branches entières en
         * aperçu SNCF/RATP (ex. branche Mantes-la-Jolie du Transilien N).
         */
        const branchElements =
          element.$branch.elements

        for (
          const branchElement
          of branchElements
        ) {
          if (isStop(branchElement)) {
            row = addStop(
              branchElement,
              lane,
              branchColor,
              row,
            )
          }
        }

        continue
      }

      if (isFork(element)) {
        const forkResult =
          sncfForkSections(
            element,
            sectionElements,
          )

        const pairedParallelBranchesId =
          forkResult.pairedParallelBranchesId

        if (
          element.$fork.toward === 'LEFT'
          && pairedParallelBranchesId
          && handledParallelBranches.has(
            pairedParallelBranchesId,
          )
        ) {
          const openLayout =
            openParallelLayouts.get(
              pairedParallelBranchesId,
            )

          if (openLayout) {
            const mergeRow = Math.max(
              row,
              openLayout.primaryEnd,
              openLayout.secondaryEnd,
            )

            extendLaneTo(
              openLayout.primaryLane,
              mergeRow,
              openLayout.primaryColor,
            )

            extendLaneTo(
              openLayout.secondaryLane,
              mergeRow,
              openLayout.secondaryColor,
            )

            if (
              openLayout.primaryLane
              !== openLayout.sourceLane
            ) {
              addForkRow(
                openLayout.primaryLane,
                openLayout.sourceLane,
                color,
                `${element.id}-close-primary`,
                mergeRow,
                'MERGE',
              )
            }

            if (
              openLayout.secondaryLane
              !== openLayout.sourceLane
            ) {
              addForkRow(
                openLayout.secondaryLane,
                openLayout.sourceLane,
                color,
                `${element.id}-close-secondary`,
                mergeRow,
                'MERGE',
              )
            }

            openParallelLayouts.delete(
              pairedParallelBranchesId,
            )

            row = mergeRow + 1
            continue
          }
        }

        if (pairedParallelBranchesId) {
          handledParallelBranches.add(
            pairedParallelBranchesId,
          )
        }

        if (!forkResult.sections) {
          continue
        }

        row = processParallelSections(
          forkResult.sections,
          lane,
          depth,
          color,
          element.$fork.toward,
          element.id,
          row,
          pairedParallelBranchesId,
        )

        continue
      }

      if (isParallelBranches(element)) {
        if (
          handledParallelBranches.has(
            element.id,
          )
        ) {
          continue
        }

        const pairData =
          element.$parallelBranches as ParallelBranchesWithPairId

        const pairId =
          pairData.forkId

        if (pairId) {
          const pair =
            sectionElements.find(
              candidate =>
                candidate.id === pairId
                && isFork(candidate),
            )

          if (pair) {
            continue
          }
        }

        /*
         * Ancien format sans IDs de liaison : lorsqu'un
         * ParallelBranches est immédiatement suivi d'une Fork LEFT,
         * il ne faut surtout pas le rendre ici comme une séparation
         * RIGHT. On attend la Fork suivante, qui le récupérera via
         * sncfForkSections() et dessinera la vraie fusion.
         */
        const parallelIndex =
          sectionElements.findIndex(
            candidate =>
              candidate.id === element.id,
          )

        const nextElement =
          parallelIndex >= 0
            ? sectionElements[parallelIndex + 1]
            : undefined

        if (
          nextElement
          && isFork(nextElement)
          && nextElement.$fork.toward === 'LEFT'
        ) {
          continue
        }

        row = processParallelSections(
          element
            .$parallelBranches
            .sections,
          lane,
          depth,
          color,
          'RIGHT',
          element.id,
          row,
          element.id,
        )

        continue
      }

      if (isVerticalSegment(element)) {
        row = addVerticalSegmentStops(
          element,
          lane,
          color,
          row,
        )

        continue
      }

      if (isLoop(element)) {
        row = addLoopStops(
          element,
          lane,
          color,
          row,
        )
      }
    }

    return row
  }

  /*
   * Ne pas pré-créer la voie 0 : si le plan commence par un couple
   * ParallelBranches -> Fork (fusion), la voie commune doit seulement
   * apparaître APRÈS les deux branches. Les arrêts et les fourches
   * créent eux-mêmes les voies au moment logique où elles existent.
   */
  let rootRow = 0

  for (
    const section
    of line.value.topology
  ) {
    rootRow = processSection(
      section,
      0,
      0,
      mainColor,
      rootRow,
    )
  }

  maxRow = Math.max(
    maxRow,
    rootRow - 1,
    0,
  )

  const rows =
    Array.from(
      { length: maxRow + 1 },
      (_, rowIndex) =>
        rowMap.get(rowIndex)
        ?? {
          key: `network-row-${rowIndex}`,
          stops: [],
          forks: [],
        },
    )

  const stopRowsByLane =
    new Map<
      number,
      Array<{
        row: number
        stop: Stop
      }>
    >()

  rows.forEach((row, rowIndex) => {
    for (const entry of row.stops) {
      const laneStops =
        stopRowsByLane.get(entry.lane)
        ?? []

      laneStops.push({
        row: rowIndex,
        stop: entry.stop,
      })

      stopRowsByLane.set(
        entry.lane,
        laneStops,
      )
    }
  })

  const localRanges:
    SncfNetworkLocalRange[] = []

  function laneIsActiveBetween(
    lane: number,
    startRow: number,
    endRow: number,
  ) {
    const laneData = lanes.get(lane)

    if (!laneData) {
      return false
    }

    for (
      let row = startRow;
      row <= endRow;
      row += 1
    ) {
      if (!laneData.activeRows.has(row)) {
        return false
      }
    }

    return true
  }

  stopRowsByLane.forEach(
    (laneStops, lane) => {
      laneStops.forEach(
        (item, index) => {
          const identity =
            sncfStopLocalLineIdentity(
              item.stop,
            )

          if (!identity) {
            return
          }

          const next =
            laneStops[index + 1]

          const previous =
            laneStops[index - 1]

          if (
            next
            && laneIsActiveBetween(
              lane,
              item.row,
              next.row,
            )
          ) {
            localRanges.push({
              key:
                `local-${item.stop.id}`
                + `-${next.stop.id}`,
              lane,
              startRow: item.row,
              endRow: next.row,
              color: identity.color,
            })

            return
          }

          if (
            previous
            && laneIsActiveBetween(
              lane,
              previous.row,
              item.row,
            )
          ) {
            localRanges.push({
              key:
                `local-${previous.stop.id}`
                + `-${item.stop.id}`,
              lane,
              startRow: previous.row,
              endRow: item.row,
              color: identity.color,
            })
          }
        },
      )
    },
  )

  return {
    rows,
    lanes:
      Array.from(lanes.values()),
    localRanges,
    laneColorEvents,
    minLane,
    maxLane,
    hasBranches,
  }
})

const sncfNetworkMaxLaneDistance =
  computed(() =>
    Math.max(
      Math.abs(sncfNetwork.value.minLane),
      Math.abs(sncfNetwork.value.maxLane),
    ),
  )

const sncfNetworkLaneAreaWidth =
  computed(() => {
    /*
     * La voie 0 est la voie commune du plan. Elle doit rester au
     * centre du panneau même lorsqu'une seule branche part à gauche
     * ou à droite. L'ancien calcul compactait uniquement les voies
     * existantes : avec [-1, 0], la voie commune se retrouvait donc
     * visuellement décalée à droite.
     *
     * On réserve désormais le même espace des deux côtés de la voie
     * centrale. Les branches s'écartent autour d'elle sans déplacer
     * le tronc principal.
     */
    return (
      SNCF_NETWORK_SIDE_RESERVE * 2
      + sncfNetworkMaxLaneDistance.value
      * SNCF_NETWORK_LANE_GAP * 2
    )
  })

function sncfNetworkLaneX(
  lane: number,
) {
  return (
    SNCF_NETWORK_LANE_START
    + sncfNetworkMaxLaneDistance.value
    * SNCF_NETWORK_LANE_GAP
    + lane * SNCF_NETWORK_LANE_GAP
  )
}

function sncfNetworkStopContentX(
  lane: number,
) {
  return (
    sncfNetworkLaneX(lane)
    + SNCF_NETWORK_LABEL_OFFSET
  )
}

function sncfNetworkLanesAtRow(
  rowIndex: number,
) {
  return sncfNetwork.value.lanes.filter(
    lane => lane.activeRows.has(rowIndex),
  )
}

function sncfNetworkLaneStartsFromFork(
  lane: number,
  rowIndex: number,
) {
  if (rowIndex <= 0) {
    return false
  }

  /*
   * Une voie de sortie de SPLIT comme le tronc commun créé par MERGE
   * commence au bord supérieur de la ligne suivante : le SVG de la
   * fourche arrive précisément sur ce bord.
   */
  return (
    sncfNetwork.value.rows[
      rowIndex - 1
    ]?.forks.some(
      fork =>
        fork.toLane === lane,
    )
    ?? false
  )
}

function sncfNetworkLaneEndsIntoMerge(
  lane: number,
  rowIndex: number,
) {
  return (
    sncfNetwork.value.rows[
      rowIndex
    ]?.forks.some(
      fork =>
        fork.kind === 'MERGE'
        && fork.fromLane === lane,
    )
    ?? false
  )
}

function sncfNetworkLaneColorAtRow(
  lane: SncfNetworkLane,
  rowIndex: number,
) {
  const events =
    sncfNetwork.value
      .laneColorEvents
      .get(lane.lane)

  if (!events) {
    return lane.color
  }

  let color = lane.color
  let latestRow = -Infinity

  events.forEach(
    (eventColor, eventRow) => {
      if (
        eventRow <= rowIndex
        && eventRow >= latestRow
      ) {
        latestRow = eventRow
        color = eventColor
      }
    },
  )

  return color
}

function sncfNetworkLaneStyle(
  lane: SncfNetworkLane,
  rowIndex: number,
) {
  /*
   * Une voie peut maintenant avoir plusieurs segments disjoints.
   * On calcule donc le début / la fin du segment ACTUEL à partir des
   * lignes actives voisines, et non plus avec le startRow/endRow global.
   * C'est ce qui empêche une branche nord du RER B de rester visible
   * jusqu'à une branche sud qui réutilise la même colonne.
   */
  const startsSegment =
    !lane.activeRows.has(rowIndex - 1)

  const endsSegment =
    !lane.activeRows.has(rowIndex + 1)

  return {
    left:
      `${sncfNetworkLaneX(lane.lane)}em`,
    top:
      startsSegment
        ? (
            sncfNetworkLaneStartsFromFork(
              lane.lane,
              rowIndex,
            )
              ? '0'
              : '50%'
          )
        : '0',
    bottom:
      endsSegment
        ? (
            sncfNetworkLaneEndsIntoMerge(
              lane.lane,
              rowIndex,
            )
              ? '100%'
              : '50%'
          )
        : '0',
    backgroundColor:
      sncfNetworkLaneColorAtRow(
        lane,
        rowIndex,
      ),
  }
}

function sncfNetworkLocalRangesAtRow(
  rowIndex: number,
) {
  return sncfNetwork.value.localRanges
    .filter(
      range =>
        rowIndex >= range.startRow
        && rowIndex <= range.endRow,
    )
}

function sncfNetworkLocalRangeStyle(
  range: SncfNetworkLocalRange,
  rowIndex: number,
) {
  return {
    left:
      `${sncfNetworkLaneX(range.lane)}em`,
    top:
      rowIndex === range.startRow
        ? '50%'
        : '0',
    bottom:
      rowIndex === range.endRow
        ? '50%'
        : '0',
    backgroundColor:
      range.color,
  }
}

function sncfNetworkForkPath(
  fork: SncfNetworkFork,
  _rowIndex: number,
) {
  const fromX =
    sncfNetworkLaneX(
      fork.fromLane,
    )

  const toX =
    sncfNetworkLaneX(
      fork.toLane,
    )

  const height =
    SNCF_NETWORK_FORK_HEIGHT

  /*
   * Les deux sens utilisent exactement la même géométrie ROUNDED,
   * simplement inversée verticalement :
   *
   * - MERGE : deux branches -> tronc commun ;
   * - SPLIT : tronc commun -> deux branches.
   *
   * On évite ainsi les grandes Bézier diagonales qui donnaient un
   * aspect "trait au crayon". Le raccord est composé de deux quarts
   * de cercle et d'un court segment horizontal, comme la fourche
   * arrondie du rendu IDFM.
   */
  const direction =
    Math.sign(toX - fromX) || 1

  const horizontalSpace =
    Math.abs(toX - fromX)

  const radius = Math.min(
    height * (isSncfHeavyRailMode.value ? .36 : .24),
    horizontalSpace / (isSncfHeavyRailMode.value ? 2.35 : 3),
  )

  const bendY =
    height * .5

  const firstHorizontalX =
    fromX + direction * radius

  const lastHorizontalX =
    toX - direction * radius

  if (fork.kind === 'MERGE') {
    const beforeBendY =
      bendY - radius

    const afterBendY =
      bendY + radius

    return (
      `M ${fromX} 0 `
      + `L ${fromX} ${beforeBendY} `
      + `Q ${fromX} ${bendY} `
      + `${firstHorizontalX} ${bendY} `
      + `L ${lastHorizontalX} ${bendY} `
      + `Q ${toX} ${bendY} `
      + `${toX} ${afterBendY} `
      + `L ${toX} ${height}`
    )
  }

  /*
   * SPLIT = miroir vertical parfait du MERGE.
   * Le tronc reste droit jusqu'au coeur de la bifurcation, puis
   * chaque branche part latéralement avant de redevenir verticale.
   */
  const beforeBendY =
    bendY - radius

  const afterBendY =
    bendY + radius

  return (
    `M ${fromX} 0 `
    + `L ${fromX} ${beforeBendY} `
    + `Q ${fromX} ${bendY} `
    + `${firstHorizontalX} ${bendY} `
    + `L ${lastHorizontalX} ${bendY} `
    + `Q ${toX} ${bendY} `
    + `${toX} ${afterBendY} `
    + `L ${toX} ${height}`
  )
}

function sncfNetworkStopMarkerColor(
  rowIndex: number,
  lane: number,
) {
  const outgoing =
    sncfNetwork.value.localRanges
      .find(
        range =>
          range.lane === lane
          && range.startRow === rowIndex,
      )

  if (outgoing) {
    return outgoing.color
  }

  const incoming =
    sncfNetwork.value.localRanges
      .find(
        range =>
          range.lane === lane
          && range.endRow === rowIndex,
      )

  if (incoming) {
    return incoming.color
  }

  return (
    sncfNetwork.value.lanes.find(
      item => item.lane === lane,
    )?.color
    ?? line.value.color
    ?? '#ffffff'
  )
}

function sncfNetworkFirstStopId() {
  for (const row of sncfNetwork.value.rows) {
    const firstStop = row.stops[0]

    if (firstStop) {
      return firstStop.stop.id
    }
  }

  return null
}

const sncfDestinations =
  computed(() => {
    const namedStops =
      sncfStops.value.filter(
        stop =>
          stop.$stop.name.trim() !== '',
      )

    const terminusStops =
      namedStops.filter(
        stop =>
          stop.$stop.terminus,
      )

    const source =
      terminusStops.length > 0
        ? terminusStops
        : namedStops.length > 1
          ? [
              namedStops[0],
              namedStops[
                namedStops.length - 1
              ],
            ]
          : namedStops

    const seen =
      new Set<string>()

    return source
      .map(
        stop =>
          stop.$stop.name.trim(),
      )
      .filter((name) => {
        if (
          name === ''
          || seen.has(name)
        ) {
          return false
        }

        seen.add(name)

        return true
      })
  })

const sncfDestinationText =
  computed(() =>
    sncfDestinations.value.length > 0
      ? sncfDestinations.value.join(' • ')
      : t('ui.map_editor.destination'),
  )

type SncfTramAreaMarker = {
  city: string | null
  zone: string | null
}

type SncfTramZoneRange = {
  zone: string
  span: number
  isStart: boolean
}

const sncfSignageRoot = ref<HTMLElement | null>(null)
const sncfTramZoneRangeStyleByStopId = ref(
  new Map<string, Record<string, string>>(),
)

let sncfTramZoneFrame: number | null = null


function getSncfTramAreaMarkersFromSection(
  section: LineSection,
  markers: Map<string, SncfTramAreaMarker>,
) {
  for (const element of section.$lineSection.elements) {
    if (isBranch(element)) {
      let pendingCity: string | null = null
      let pendingZone: string | null = null
      let lastStopSeen: Stop | null = null

      const branchElements =
        element.$branch.invertedElements
          ? [...element.$branch.elements].reverse()
          : element.$branch.elements

      for (const branchElement of branchElements) {
        if ('$areaSeparator' in branchElement) {
          const city =
            branchElement.$areaSeparator.cityName?.trim() ?? ''
          const zone =
            branchElement.$areaSeparator.zoneName?.trim() ?? ''

          if (city !== '') pendingCity = city
          if (zone !== '') pendingZone = zone
          continue
        }

        if (isStop(branchElement)) {
          lastStopSeen = branchElement

          if (pendingCity !== null || pendingZone !== null) {
            markers.set(branchElement.id, {
              city: pendingCity,
              zone: pendingZone,
            })

            pendingCity = null
            pendingZone = null
          }
        }
      }

      if (
        lastStopSeen
        && (pendingCity !== null || pendingZone !== null)
      ) {
        markers.set(lastStopSeen.id, {
          city: pendingCity,
          zone: pendingZone,
        })
      }

      continue
    }

    if (isFork(element) && element.$fork.sections) {
      for (const subSection of element.$fork.sections) {
        getSncfTramAreaMarkersFromSection(subSection, markers)
      }
      continue
    }

    if (isParallelBranches(element)) {
      for (const subSection of element.$parallelBranches.sections) {
        getSncfTramAreaMarkersFromSection(subSection, markers)
      }
    }
  }
}

const sncfTramAreaMarkerByStopId = computed(() => {
  const markers = new Map<string, SncfTramAreaMarker>()

  for (const section of line.value.topology) {
    getSncfTramAreaMarkersFromSection(section, markers)
  }

  return markers
})

function sncfTramCommuneLabel(stop: Stop) {
  if (!isTramMode.value) return null

  const placeName = stop.$stop.placeName?.trim()
  if (placeName) return placeName

  return sncfTramAreaMarkerByStopId.value.get(stop.id)?.city ?? null
}

const sncfTramEffectiveZoneByStopId = computed(() => {
  const zones = new Map<string, string | null>()

  if (!isTramMode.value) return zones

  let currentZone: string | null = null

  for (const stop of sncfStops.value) {
    const markerZone =
      sncfTramAreaMarkerByStopId.value.get(stop.id)?.zone?.trim()

    if (markerZone) currentZone = markerZone
    zones.set(stop.id, currentZone)
  }

  return zones
})

const sncfTramZoneRanges = computed(() => {
  const ranges = new Map<string, SncfTramZoneRange>()

  if (!isTramMode.value) return ranges

  let index = 0

  while (index < sncfStops.value.length) {
    const stop = sncfStops.value[index]
    const zone = sncfTramEffectiveZoneByStopId.value.get(stop.id) ?? null

    if (!zone) {
      index += 1
      continue
    }

    let end = index

    while (end + 1 < sncfStops.value.length) {
      const nextStop = sncfStops.value[end + 1]
      const nextZone =
        sncfTramEffectiveZoneByStopId.value.get(nextStop.id) ?? null

      if (nextZone !== zone) break
      end += 1
    }

    const span = end - index + 1

    ranges.set(stop.id, {
      zone,
      span,
      isStart: true,
    })

    for (let inner = index + 1; inner <= end; inner += 1) {
      ranges.set(sncfStops.value[inner].id, {
        zone,
        span: 0,
        isStart: false,
      })
    }

    index = end + 1
  }

  return ranges
})

function sncfTramZoneRange(stop: Stop) {
  return sncfTramZoneRanges.value.get(stop.id) ?? null
}

function recomputeSncfTramZoneMetrics() {
  const styles = new Map<string, Record<string, string>>()

  if (!isTramMode.value) {
    if (sncfTramZoneRangeStyleByStopId.value.size > 0) {
      sncfTramZoneRangeStyleByStopId.value = styles
    }
    return
  }

  const root = sncfSignageRoot.value
  if (!root) return

  const rowByStopId = new Map<string, HTMLElement>()
  const dotByStopId = new Map<string, HTMLElement>()

  root
    .querySelectorAll<HTMLElement>('[data-sncf-stop-row-id]')
    .forEach((element) => {
      const stopId = element.dataset.sncfStopRowId
      if (stopId) rowByStopId.set(stopId, element)
    })

  root
    .querySelectorAll<HTMLElement>('[data-sncf-stop-dot-id]')
    .forEach((element) => {
      const stopId = element.dataset.sncfStopDotId
      if (stopId) dotByStopId.set(stopId, element)
    })

  for (let index = 0; index < sncfStops.value.length; index += 1) {
    const stop = sncfStops.value[index]
    const range = sncfTramZoneRange(stop)

    if (!range?.isStart) continue

    const startRow = rowByStopId.get(stop.id)
    const startDot = dotByStopId.get(stop.id)

    if (!(startRow && startDot)) continue

    const startRowRect = startRow.getBoundingClientRect()
    const startDotRect = startDot.getBoundingClientRect()
    const startCenter = (
      startDotRect.top
      + (startDotRect.height / 2)
      - startRowRect.top
    )

    let height = 0

    if (range.span > 1) {
      const endStop = sncfStops.value[index + range.span - 1]
      const endDot = endStop
        ? dotByStopId.get(endStop.id)
        : null

      if (endDot) {
        const endDotRect = endDot.getBoundingClientRect()
        height = Math.max(
          0,
          (
            endDotRect.top
            + (endDotRect.height / 2)
          ) - (
            startDotRect.top
            + (startDotRect.height / 2)
          ),
        )
      }
    }

    styles.set(stop.id, {
      '--sncf-zone-range-start': `${startCenter}px`,
      '--sncf-zone-range-height': `${height}px`,
      '--sncf-zone-range-mid': `${startCenter + (height / 2)}px`,
    })
  }

  const current = sncfTramZoneRangeStyleByStopId.value
  const currentEntries = JSON.stringify([...current.entries()])
  const nextEntries = JSON.stringify([...styles.entries()])

  if (currentEntries !== nextEntries) {
    sncfTramZoneRangeStyleByStopId.value = styles
  }
}

function scheduleSncfTramZoneMetrics() {
  if (typeof window === 'undefined') return

  if (sncfTramZoneFrame !== null) {
    cancelAnimationFrame(sncfTramZoneFrame)
  }

  sncfTramZoneFrame = requestAnimationFrame(() => {
    sncfTramZoneFrame = requestAnimationFrame(() => {
      sncfTramZoneFrame = null
      recomputeSncfTramZoneMetrics()
    })
  })
}

function sncfTramZoneRangeStyle(stop: Stop) {
  return (
    sncfTramZoneRangeStyleByStopId.value.get(stop.id)
    ?? {
      '--sncf-zone-range-start': '50%',
      '--sncf-zone-range-height': '0px',
      '--sncf-zone-range-mid': '50%',
    }
  )
}

const sncfDirectionDestination = computed(() => {
  const firstName = sncfStops.value[0]?.$stop.name.trim() ?? ''

  const destinations = sncfDestinations.value.filter(
    name => name !== '' && name !== firstName,
  )

  if (destinations.length > 0) {
    return destinations.join(' • ')
  }

  for (let index = sncfStops.value.length - 1; index >= 0; index -= 1) {
    const name = sncfStops.value[index]?.$stop.name.trim() ?? ''

    if (name !== '' && name !== firstName) return name
  }

  return t('ui.map_editor.destination')
})

const ratpPrimaryLineIdentity =
  computed<DisplayLineIdentity>(() =>
    planLineIdentities.value[0]
    ?? {
      key: lineIdentityKey(
        line.value.mode,
        line.value.index,
        transportService.value,
      ),
      mode: line.value.mode,
      index: line.value.index,
      transportService:
        transportService.value,
    },
  )

/*
 * L'en-tête RATP doit aussi refléter les identités ajoutées via
 * « Changer de ligne sur cet arrêt ».
 *
 * Important : on ne lit volontairement PAS les additionalLines
 * des branches ici. Ce bloc concerne uniquement le changement
 * local de ligne sur un arrêt, pas le système multi-ligne.
 */
const ratpHeaderLineIdentities =
  computed<DisplayLineIdentity[]>(() => {
    const identities: DisplayLineIdentity[] = [
      ratpPrimaryLineIdentity.value,
    ]

    for (const stop of mapStops.value) {
      const transition =
        stop.$stop as StopWithLineTransition

      if (!transition.lineAfterStopMode) {
        continue
      }

      identities.push({
        key: lineIdentityKey(
          transition.lineAfterStopMode,
          transition.lineAfterStopIndex
          ?? null,
        ),
        mode: transition.lineAfterStopMode,
        index:
          transition.lineAfterStopIndex
          ?? null,
        transportService: null,
      })
    }

    const seen = new Set<string>()

    return identities.filter((identity) => {
      if (seen.has(identity.key)) {
        return false
      }

      seen.add(identity.key)
      return true
    })
  })

const ratpHeaderLineModeGroups =
  computed<DisplayLineModeGroup[]>(() => {
    const groups: DisplayLineModeGroup[] = []

    for (
      const identity
      of ratpHeaderLineIdentities.value
    ) {
      const identityService =
        identity.transportService

      let group = groups.find(
        item =>
          item.mode === identity.mode
          && item.transportService
          === identityService,
      )

      if (!group) {
        group = {
          key:
            identityService
              ? `service:${identityService}`
              : `mode:${identity.mode}`,
          mode: identity.mode,
          transportService:
            identityService,
          identities: [],
        }

        groups.push(group)
      }

      group.identities.push(identity)
    }

    return groups
  })

function getRatpAreaNamesFromSection(
  section: LineSection,
): string[] {
  const names: string[] = []

  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      for (
        const branchElement
        of element.$branch.elements
      ) {
        if (
          '$areaSeparator' in branchElement
          && branchElement
            .$areaSeparator
            .cityName
            .trim() !== ''
        ) {
          names.push(
            branchElement
              .$areaSeparator
              .cityName
              .trim(),
          )
        }
      }

      continue
    }

    if (
      isFork(element)
      && element.$fork.sections
    ) {
      for (const subSection of element.$fork.sections) {
        names.push(
          ...getRatpAreaNamesFromSection(
            subSection,
          ),
        )
      }
      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element.$parallelBranches.sections
      ) {
        names.push(
          ...getRatpAreaNamesFromSection(
            subSection,
          ),
        )
      }
    }
  }

  return names
}

const ratpAreaNames = computed(() => {
  const seen = new Set<string>()

  return line.value.topology
    .flatMap(getRatpAreaNamesFromSection)
    .filter((name) => {
      if (seen.has(name)) {
        return false
      }

      seen.add(name)
      return true
    })
})

function getRatpAreaLabelsFromSection(
  section: LineSection,
  labels: Map<string, string>,
) {
  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      const branchElements =
        element.$branch.invertedElements
          ? [...element.$branch.elements].reverse()
          : element.$branch.elements

      for (
        let index = 0;
        index < branchElements.length;
        index += 1
      ) {
        const branchElement =
          branchElements[index]

        if (
          !('$areaSeparator' in branchElement)
          || branchElement
            .$areaSeparator
            .cityName
            .trim() === ''
        ) {
          continue
        }

        const cityName =
          branchElement
            .$areaSeparator
            .cityName
            .trim()

        let previousStop: Stop | null = null
        let nextStop: Stop | null = null

        for (
          let previousIndex = index - 1;
          previousIndex >= 0;
          previousIndex -= 1
        ) {
          const previousElement =
            branchElements[previousIndex]

          if (isStop(previousElement)) {
            previousStop = previousElement
            break
          }
        }

        for (
          let nextIndex = index + 1;
          nextIndex < branchElements.length;
          nextIndex += 1
        ) {
          const nextElement =
            branchElements[nextIndex]

          if (isStop(nextElement)) {
            nextStop = nextElement
            break
          }
        }

        /*
         * Dans la preview RATP, le trait de commune associé à
         * un arrêt est dessiné SOUS cet arrêt. Une AreaSeparator
         * placée entre A et B doit donc être rattachée à A :
         * visuellement, le trait reste exactement entre A et B.
         *
         * Exemple : une séparation « Paris » placée juste avant
         * Porte de Clichy doit apparaître après Saint-Ouen, et non
         * après Porte de Clichy.
         *
         * Si la séparation précède le tout premier arrêt de la
         * branche, aucun arrêt précédent n'existe ; on conserve alors
         * l'arrêt suivant comme solution de repli pour ne pas perdre
         * l'information dans les anciens projets.
         */
        const targetStop =
          previousStop ?? nextStop

        if (targetStop) {
          labels.set(
            targetStop.id,
            cityName,
          )
        }
      }

      continue
    }

    if (
      isFork(element)
      && element.$fork.sections
    ) {
      for (const subSection of element.$fork.sections) {
        getRatpAreaLabelsFromSection(
          subSection,
          labels,
        )
      }
      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element.$parallelBranches.sections
      ) {
        getRatpAreaLabelsFromSection(
          subSection,
          labels,
        )
      }
    }
  }
}

const ratpAreaLabelByStopId = computed(() => {
  const labels = new Map<string, string>()

  for (const section of line.value.topology) {
    getRatpAreaLabelsFromSection(
      section,
      labels,
    )
  }

  return labels
})

/*
 * Le rendu RATP affiche TOUJOURS la topologie complète du projet.
 * La référence visuelle ne sert qu'au style : elle ne doit jamais
 * imposer une fenêtre, un nombre d'arrêts ou un sous-parcours.
 */
const ratpVisibleRows = computed(() => {
  const stopRowIndexes =
    sncfNetwork.value.rows
      .map((row, rowIndex) => ({
        row,
        rowIndex,
      }))
      .filter(item => item.row.stops.length > 0)
      .map(item => item.rowIndex)

  if (stopRowIndexes.length === 0) {
    return []
  }

  const firstVisibleStopRow =
    stopRowIndexes[0]

  const lastVisibleStopRow =
    stopRowIndexes[
      stopRowIndexes.length - 1
    ]

  return sncfNetwork.value.rows
    .map((row, rowIndex) => ({
      row,
      rowIndex,
    }))
    .filter(
      item =>
        item.rowIndex >= firstVisibleStopRow
        && item.rowIndex <= lastVisibleStopRow,
    )
})

const ratpHasCompactTopology = computed(() =>
  ratpVisibleRows.value.filter(
    item => item.row.stops.length > 0,
  ).length <= 6,
)

const ratpVisibleStops = computed(() =>
  ratpVisibleRows.value.flatMap(
    item => item.row.stops.map(
      entry => entry.stop,
    ),
  ),
)

const ratpFirstVisibleStop = computed(() =>
  ratpVisibleStops.value[0]
  ?? null,
)

const ratpLastVisibleStop = computed(() =>
  ratpVisibleStops.value[
    ratpVisibleStops.value.length - 1
  ]
  ?? null,
)

const ratpFirstVisibleLane = computed(() =>
  ratpVisibleRows.value[0]
    ?.row
    .stops[0]
    ?.lane
  ?? 0,
)

const ratpPlanNamedStops = computed(() =>
  uniqueStops(mapStops.value).filter(
    stop => stop.$stop.name.trim() !== '',
  ),
)

const ratpTopologyEndpointStops = computed(() => {
  const stopsByLane =
    new Map<
      number,
      Array<{
        stop: Stop
        rowIndex: number
      }>
    >()

  for (const item of ratpVisibleRows.value) {
    for (const entry of item.row.stops) {
      const laneStops =
        stopsByLane.get(entry.lane)
        ?? []

      laneStops.push({
        stop: entry.stop,
        rowIndex: item.rowIndex,
      })

      stopsByLane.set(
        entry.lane,
        laneStops,
      )
    }
  }

  const result: Stop[] = []
  const seen = new Set<string>()

  const pushStop = (stop: Stop) => {
    if (
      stop.$stop.name.trim() === ''
      || seen.has(stop.id)
    ) {
      return
    }

    seen.add(stop.id)
    result.push(stop)
  }

  for (const [lane, laneStops] of stopsByLane) {
    if (laneStops.length === 0) {
      continue
    }

    laneStops.sort(
      (a, b) => a.rowIndex - b.rowIndex,
    )

    const first = laneStops[0]
    const last =
      laneStops[laneStops.length - 1]

    const hasIncomingFork =
      ratpVisibleRows.value.some(
        item =>
          item.rowIndex <= first.rowIndex
          && item.row.forks.some(
            fork => fork.toLane === lane,
          ),
      )

    const hasOutgoingFork =
      ratpVisibleRows.value.some(
        item =>
          item.rowIndex >= last.rowIndex
          && item.row.forks.some(
            fork => fork.fromLane === lane,
          ),
      )

    if (!hasIncomingFork) {
      pushStop(first.stop)
    }

    if (!hasOutgoingFork) {
      pushStop(last.stop)
    }
  }

  return result
})

const ratpHeaderTermini = computed(() => {
  const namedStops = ratpPlanNamedStops.value

  if (namedStops.length === 0) {
    return []
  }

  const explicitTermini =
    namedStops.filter(
      stop => stop.$stop.terminus,
    )

  const topologyEndpoints =
    ratpTopologyEndpointStops.value

  const source =
    explicitTermini.length >= 3
      ? explicitTermini
      : topologyEndpoints.length >= 2
        ? topologyEndpoints
        : explicitTermini.length >= 2
          ? explicitTermini
          : namedStops.length >= 2
            ? [
                namedStops[0],
                namedStops[namedStops.length - 1],
              ]
            : namedStops

  const seen = new Set<string>()

  return source
    .map(stop => stop.$stop.name.trim())
    .filter((name) => {
      if (name === '' || seen.has(name)) {
        return false
      }

      seen.add(name)
      return true
    })
})

const ratpHeaderDestination = computed(() => {
  const headerDestinations =
    ratpHeaderTermini.value

  const lastDestination =
    headerDestinations[
      headerDestinations.length - 1
    ]

  if (lastDestination) {
    return lastDestination
  }

  const stop = ratpLastVisibleStop.value

  if (!stop) {
    return t('ui.map_editor.destination')
  }

  return (
    stop.$stop.name.trim()
    || stop.$stop.placeName?.trim()
    || t('ui.map_editor.destination')
  )
})

const ratpHeaderOppositeTerminus = computed(() => {
  const firstDestination =
    ratpHeaderTermini.value[0]

  if (
    firstDestination
    && firstDestination
      !== ratpHeaderDestination.value
  ) {
    return firstDestination
  }

  const stop = ratpFirstVisibleStop.value

  if (!stop) {
    return null
  }

  const label =
    stop.$stop.name.trim()
    || stop.$stop.placeName?.trim()
    || ''

  return label === ''
    || label === ratpHeaderDestination.value
    ? null
    : label
})

const ratpHeaderTerminiLabel = computed(() => {
  const termini = ratpHeaderTermini.value

  if (termini.length >= 3) {
    const [origin, ...destinations] = termini

    if (destinations.length === 0) {
      return origin
    }

    return `${origin} ↔ ${destinations.join(' / ')}`
  }

  const opposite = ratpHeaderOppositeTerminus.value
  const destination = ratpHeaderDestination.value

  if (!opposite) {
    return destination
  }

  return `${opposite} ↔ ${destination}`
})

const ratpHeaderDirectionLength = computed(() =>
  ratpHeaderTerminiLabel.value.length,
)

function ratpSectionHasLoop(
  section: LineSection,
): boolean {
  for (const element of section.$lineSection.elements) {
    if (isLoop(element)) {
      return true
    }

    if (
      isFork(element)
      && element.$fork.sections
      && element.$fork.sections.some(
        ratpSectionHasLoop,
      )
    ) {
      return true
    }

    if (
      isParallelBranches(element)
      && element.$parallelBranches.sections.some(
        ratpSectionHasLoop,
      )
    ) {
      return true
    }
  }

  return false
}

const ratpTopologyHasLoop = computed(() =>
  line.value.topology.some(
    ratpSectionHasLoop,
  ),
)

const ratpFirstMultiStopRow = computed(() =>
  ratpVisibleRows.value.find(
    item => item.row.stops.length >= 2,
  )
  ?? null,
)

const ratpHasMergeFork = computed(() =>
  ratpVisibleRows.value.some(
    item => item.row.forks.some(
      fork => fork.kind === 'MERGE',
    ),
  ),
)

const ratpIsMetro15 = computed(() => {
  const index = line.value.index

  return (
    line.value.mode === 'METRO'
    && index !== null
    && isBuiltin(index)
    && index.$builtinLineIndex.index === '15'
  )
})

const ratpShouldCloseCircularNetwork = computed(() => {
  /*
   * Un élément `Loop` de l'éditeur représente un demi-tour local :
   * il ne faut surtout pas l'interpréter comme une ligne circulaire.
   * C'était la cause de la grande barre horizontale parasite visible
   * notamment sur le RER D et le métro 7 bis.
   *
   * Pour l'instant, la fermeture circulaire est réservée à la ligne 15,
   * dont le plan utilisateur est réellement pensé comme une boucle.
   */
  if (!ratpIsMetro15.value) {
    return false
  }

  return (
    ratpVisibleLaneStats.value.lanes.length > 1
    && ratpHasMergeFork.value
  )
})

const ratpVisibleLaneStats = computed(() => {
  const counts = new Map<number, number>()
  const lanes = new Set<number>()
  let hasFork = false

  for (const item of ratpVisibleRows.value) {
    if (item.row.forks.length > 0) {
      hasFork = true
    }

    for (const entry of item.row.stops) {
      lanes.add(entry.lane)
      counts.set(
        entry.lane,
        (counts.get(entry.lane) ?? 0) + 1,
      )
    }

    for (const fork of item.row.forks) {
      lanes.add(fork.fromLane)
      lanes.add(fork.toLane)
    }
  }

  const sortedLanes = [...lanes].sort(
    (a, b) => a - b,
  )

  const dominantLane = sortedLanes
    .slice()
    .sort((a, b) => {
      const countDifference =
        (counts.get(b) ?? 0)
        - (counts.get(a) ?? 0)

      if (countDifference !== 0) {
        return countDifference
      }

      return Math.abs(a) - Math.abs(b)
    })[0] ?? 0

  return {
    lanes: sortedLanes,
    minLane: sortedLanes[0] ?? dominantLane,
    maxLane:
      sortedLanes[sortedLanes.length - 1]
      ?? dominantLane,
    dominantLane,
    hasFork,
  }
})

const ratpUsesExpandedForkColumns = computed(() =>
  ratpVisibleLaneStats.value.hasFork
  && ratpVisibleLaneStats.value.lanes.length > 1,
)

const ratpMaxConcurrentLaneCount = computed(() => {
  let maxCount = 1

  for (const item of ratpVisibleRows.value) {
    maxCount = Math.max(
      maxCount,
      sncfNetworkLanesAtRow(item.rowIndex).length,
    )
  }

  return maxCount
})

const ratpHasNestedBranchDensity = computed(() => {
  let denseRows = 0

  for (const item of ratpVisibleRows.value) {
    const laneCount =
      sncfNetworkLanesAtRow(item.rowIndex).length

    if (laneCount >= 3) {
      denseRows += 1
    }
  }

  return (
    ratpVisibleLaneStats.value.lanes.length >= 4
    || denseRows >= 2
  )
})

function ratpEstimatedTextWidth(
  value: string,
) {
  let width = 0

  for (const char of value.trim()) {
    if (" ilIjtfr'’.,:;".includes(char)) {
      width += .48
      continue
    }

    if ('MWmw'.includes(char)) {
      width += 1.32
      continue
    }

    if ('-–—'.includes(char)) {
      width += .65
      continue
    }

    width += char === char.toUpperCase()
      && char !== char.toLowerCase()
      ? 1.06
      : .92
  }

  return width * 1.08
}

function ratpEstimatedOrnamentWidth(
  ornament: Ornament | null | undefined,
) {
  if (!ornament) {
    return 0
  }

  if ('$textOrnament' in ornament) {
    return Math.min(
      12,
      1
      + ratpEstimatedTextWidth(
        ornament.$textOrnament.text,
      ) * .48,
    )
  }

  if ('$airportNameOrnament' in ornament) {
    return Math.min(
      14,
      1.3
      + ratpEstimatedTextWidth(
        ornament.$airportNameOrnament.name,
      ) * .52,
    )
  }

  if ('$airportOrnament' in ornament) {
    return 1.4
  }

  return 0
}

function ratpEstimatedConnectionWidth(
  stop: Stop,
) {
  let width = 0
  let groups = 0

  for (const connection of stop.$stop.connections) {
    groups += 1

    if ('$modeConnection' in connection) {
      const data = connection.$modeConnection
      let groupWidth = 1.25

      if (data.walk || data.transfer) {
        groupWidth += 1.15
      }

      for (const element of data.elements) {
        const elementData =
          element.$modeConnectionElement

        groupWidth += 1.12

        if (elementData.walk || elementData.transfer) {
          groupWidth += 1.05
        }

        groupWidth +=
          ratpEstimatedOrnamentWidth(
            elementData.ornament,
          )
      }

      width += groupWidth
      continue
    }

    if ('$serviceConnection' in connection) {
      const data = connection.$serviceConnection
      let groupWidth = 0

      if (data.walk) {
        groupWidth += 1.1
      }

      for (const element of data.elements) {
        const elementData =
          element.$serviceConnectionElement

        groupWidth += 1.2

        groupWidth +=
          ratpEstimatedOrnamentWidth(
            elementData.ornament,
          )
      }

      width += Math.max(1.2, groupWidth)
    }
  }

  width += (
    stop.$stop.customConnections
    ?? []
  ).filter(
    connection => connection.image !== '',
  ).length * 1.4

  if (groups > 1) {
    width += (groups - 1) * .78
  }

  return Math.min(
    28,
    Math.max(
      ratpStopHasConnections(stop)
        ? 1.4
        : 0,
      width,
    ),
  )
}

function ratpEstimatedLabelWidth(
  stop: Stop,
) {
  const base =
    ratpEstimatedTextWidth(
      stop.$stop.name.trim(),
    )

  return Math.min(
    34,
    Math.max(
      7,
      base
      + (stop.$stop.terminus ? .8 : 0),
    ),
  )
}

const ratpLaneContentMetrics = computed(() => {
  const metrics = new Map<
    number,
    {
      maxLabelWidth: number
      maxConnectionWidth: number
      stops: Array<{
        rowIndex: number
        stop: Stop
      }>
    }
  >()

  for (const item of ratpVisibleRows.value) {
    for (const entry of item.row.stops) {
      const current =
        metrics.get(entry.lane)
        ?? {
          maxLabelWidth: 0,
          maxConnectionWidth: 0,
          stops: [],
        }

      current.maxLabelWidth = Math.max(
        current.maxLabelWidth,
        ratpEstimatedLabelWidth(entry.stop),
      )

      current.maxConnectionWidth = Math.max(
        current.maxConnectionWidth,
        ratpEstimatedConnectionWidth(entry.stop),
      )

      current.stops.push({
        rowIndex: item.rowIndex,
        stop: entry.stop,
      })

      metrics.set(
        entry.lane,
        current,
      )
    }
  }

  return metrics
})

const ratpBaseParallelLaneGap = computed(() => {
  if (ratpHasNestedBranchDensity.value) {
    return 28
  }

  return ratpMaxConcurrentLaneCount.value >= 3
    ? 26
    : 22
})

function ratpPairKey(
  leftLane: number,
  rightLane: number,
) {
  return `${leftLane}:${rightLane}`
}

const ratpPairLaneGaps = computed(() => {
  const gaps = new Map<string, number>()
  const lanes = ratpVisibleLaneStats.value.lanes
  const baseGap = ratpBaseParallelLaneGap.value

  for (let index = 0; index < lanes.length - 1; index++) {
    const leftLane = lanes[index]
    const rightLane = lanes[index + 1]

    const leftMetrics =
      ratpLaneContentMetrics.value.get(leftLane)

    const rightMetrics =
      ratpLaneContentMetrics.value.get(rightLane)

    let requiredGap = baseGap

    if (leftMetrics && rightMetrics) {
      /*
       * Collision réelle entre deux colonnes adjacentes :
       *
       *   axe gauche -> nom à droite
       *   axe droit  -> correspondances à gauche
       *
       * On ne réserve de largeur supplémentaire que lorsque deux arrêts
       * sont réellement proches verticalement. Un nom long situé tout en
       * bas d'une branche ne doit donc plus écarter toute la ligne.
       */
      for (const left of leftMetrics.stops) {
        for (const right of rightMetrics.stops) {
          if (
            Math.abs(
              left.rowIndex - right.rowIndex,
            ) > 1
          ) {
            continue
          }

          requiredGap = Math.max(
            requiredGap,
            RATP_LABEL_AXIS_GAP
            + ratpEstimatedLabelWidth(left.stop)
            + RATP_ADJACENT_LANE_CLEARANCE
            + ratpEstimatedConnectionWidth(right.stop)
            + RATP_CONNECTION_AXIS_GAP,
          )
        }
      }
    }

    gaps.set(
      ratpPairKey(leftLane, rightLane),
      Math.min(44, requiredGap),
    )
  }

  return gaps
})

const ratpShouldCenterBranchedTram = computed(() =>
  line.value.mode === 'TRAM'
  && ratpUsesExpandedForkColumns.value,
)

function ratpCenterLanePositionsForBranchedTram(
  positions: Map<number, number>,
  lanes: number[],
) {
  if (
    !ratpShouldCenterBranchedTram.value
    || lanes.length < 2
  ) {
    return positions
  }

  let minContentX = Number.POSITIVE_INFINITY
  let maxContentX = Number.NEGATIVE_INFINITY

  for (const lane of lanes) {
    const x = positions.get(lane)

    if (x === undefined) {
      continue
    }

    const metrics =
      ratpLaneContentMetrics.value.get(lane)

    const connectionReach =
      (metrics?.maxConnectionWidth ?? 0)
      + RATP_CONNECTION_AXIS_GAP

    const labelReach =
      RATP_LABEL_AXIS_GAP
      + (metrics?.maxLabelWidth ?? 7)

    minContentX = Math.min(
      minContentX,
      x - connectionReach,
    )

    maxContentX = Math.max(
      maxContentX,
      x + labelReach,
    )
  }

  if (
    !Number.isFinite(minContentX)
    || !Number.isFinite(maxContentX)
  ) {
    return positions
  }

  /*
   * Le réseau tramway à branches est centré d'après son enveloppe
   * réellement visible (correspondances à gauche + noms à droite),
   * pas seulement d'après les axes. Une ligne droite comme T9 garde
   * donc exactement son placement actuel.
   */
  const contentWidth =
    maxContentX - minContentX

  const targetWidth = Math.max(
    80,
    contentWidth + 10,
  )

  const currentCenter =
    (minContentX + maxContentX) / 2

  const targetCenter =
    targetWidth / 2

  const shift =
    targetCenter - currentCenter

  if (Math.abs(shift) < .01) {
    return positions
  }

  for (const lane of lanes) {
    const x = positions.get(lane)

    if (x !== undefined) {
      positions.set(
        lane,
        x + shift,
      )
    }
  }

  return positions
}

const ratpLanePositions = computed(() => {
  const positions = new Map<number, number>()
  const lanes = ratpVisibleLaneStats.value.lanes

  if (lanes.length === 0) {
    positions.set(0, RATP_MAIN_LANE_X)
    return positions
  }

  if (!ratpUsesExpandedForkColumns.value) {
    for (const lane of lanes) {
      positions.set(
        lane,
        RATP_MAIN_LANE_X
        + lane * RATP_BRANCH_LANE_GAP,
      )
    }

    return positions
  }

  const firstLane = lanes[0]
  const firstMetrics =
    ratpLaneContentMetrics.value.get(firstLane)

  let x = Math.max(
    30,
    (firstMetrics?.maxConnectionWidth ?? 0)
    + RATP_CONNECTION_AXIS_GAP
    + 5,
  )

  positions.set(firstLane, x)

  for (let index = 1; index < lanes.length; index++) {
    const previousLane = lanes[index - 1]
    const lane = lanes[index]

    x += ratpPairLaneGaps.value.get(
      ratpPairKey(previousLane, lane),
    ) ?? ratpBaseParallelLaneGap.value

    positions.set(lane, x)
  }

  return ratpCenterLanePositionsForBranchedTram(
    positions,
    lanes,
  )
})

const ratpHeaderRequiredWidthEm = computed(() => {
  const modeGroupCount =
    ratpHeaderLineModeGroups.value.length

  const indexCount =
    ratpHeaderLineModeGroups.value.reduce(
      (total, group) =>
        total + group.identities.length,
      0,
    )

  /*
   * L'en-tête RATP est en nowrap : sa largeur doit donc
   * inclure l'identité de ligne ET le libellé complet.
   *
   * Estimation volontairement conservatrice en em :
   * - pictogramme de mode / service ;
   * - indices de ligne ;
   * - gaps + paddings ;
   * - largeur moyenne du texte selon sa classe de taille.
   *
   * Le but n'est pas de modifier la typographie mais
   * d'agrandir la feuille lorsque l'en-tête l'exige.
   */
  const identityWidth =
    (modeGroupCount * 8.2)
    + (indexCount * 8.2)
    + Math.max(0, indexCount - modeGroupCount) * .55
    + Math.max(0, modeGroupCount - 1) * 1.5

  const length = ratpHeaderDirectionLength.value

  const directionFontSize =
    length >= 64
      ? 2.08
      : length >= 40
        ? 2.55
        : length >= 28
          ? 2.95
          : 3.55

  const directionWidth =
    length * directionFontSize * .56

  return (
    10.6 // padding horizontal de l'en-tête
    + identityWidth
    + 2.9 // gap identité ↔ direction
    + directionWidth
    + 2 // petite marge de sécurité
  )
})

const ratpPreviewWidthEm = computed(() => {
  let networkRequiredWidth = 80

  if (ratpUsesExpandedForkColumns.value) {
    const lanes = ratpVisibleLaneStats.value.lanes
    const lastLane = lanes[lanes.length - 1]
    const lastX =
      ratpLanePositions.value.get(lastLane)
      ?? RATP_MAIN_LANE_X

    const lastMetrics =
      ratpLaneContentMetrics.value.get(lastLane)

    networkRequiredWidth = Math.max(
      80,
      lastX
      + RATP_LABEL_AXIS_GAP
      + (lastMetrics?.maxLabelWidth ?? 12)
      + 7,
    )
  }

  return Math.max(
    networkRequiredWidth,
    ratpHeaderRequiredWidthEm.value,
  )
})

const ratpLineMaxConnectionCount = computed(() => {
  let maxCount = 0

  for (const stop of ratpVisibleStops.value) {
    maxCount = Math.max(
      maxCount,
      ratpStopConnectionCount(stop),
    )
  }

  return maxCount
})

const ratpAdaptiveConnectionsWidth = computed(() => {
  if (ratpHasNestedBranchDensity.value) {
    return RATP_CONNECTIONS_WIDTH
  }

  if (ratpUsesExpandedForkColumns.value) {
    return ratpLineMaxConnectionCount.value >= 8
      ? 26.5
      : 24.5
  }

  return ratpLineMaxConnectionCount.value >= 8
    ? 26
    : 24
})

const ratpAdaptiveStopBlockWidth = computed(() =>
  RATP_STOP_BLOCK_WIDTH
  + Math.max(
    0,
    RATP_CONNECTIONS_WIDTH
    - ratpAdaptiveConnectionsWidth.value,
  ),
)

function ratpLaneX(
  lane: number,
) {
  return (
    ratpLanePositions.value.get(lane)
    ?? (
      RATP_MAIN_LANE_X
      + lane * RATP_BRANCH_LANE_GAP
    )
  )
}

const ratpCircularClosurePath = computed(() => {
  if (!ratpShouldCloseCircularNetwork.value) {
    return ''
  }

  const leftX = ratpLaneX(
    ratpVisibleLaneStats.value.minLane,
  )
  const rightX = ratpLaneX(
    ratpVisibleLaneStats.value.maxLane,
  )

  const height = SNCF_NETWORK_FORK_HEIGHT
  const bendY = height * .48
  const radius = Math.min(
    1.8,
    Math.abs(rightX - leftX) / 6,
  )

  return (
    `M ${leftX} ${height} `
    + `L ${leftX} ${bendY + radius} `
    + `Q ${leftX} ${bendY} ${leftX + radius} ${bendY} `
    + `L ${rightX - radius} ${bendY} `
    + `Q ${rightX} ${bendY} ${rightX} ${bendY + radius} `
    + `L ${rightX} ${height}`
  )
})

function ratpLaneStyle(
  lane: SncfNetworkLane,
  rowIndex: number,
) {
  const style =
    sncfNetworkLaneStyle(
      lane,
      rowIndex,
    )

  return {
    ...style,
    left:
      `${ratpLaneX(lane.lane)}em`,
  }
}

function ratpLocalRangeStyle(
  range: SncfNetworkLocalRange,
  rowIndex: number,
) {
  const style =
    sncfNetworkLocalRangeStyle(
      range,
      rowIndex,
    )

  return {
    ...style,
    left:
      `${ratpLaneX(range.lane)}em`,
  }
}

function ratpForkPath(
  fork: SncfNetworkFork,
) {
  const fromX = ratpLaneX(fork.fromLane)
  const toX = ratpLaneX(fork.toLane)
  const height = SNCF_NETWORK_FORK_HEIGHT
  const direction = Math.sign(toX - fromX) || 1
  const horizontalSpace = Math.abs(toX - fromX)
  const radius = Math.min(
    height * .16,
    horizontalSpace / 4,
  )
  const bendY = height * .5
  const firstHorizontalX =
    fromX + direction * radius
  const lastHorizontalX =
    toX - direction * radius
  const beforeBendY = bendY - radius
  const afterBendY = bendY + radius

  return (
    `M ${fromX} 0 `
    + `L ${fromX} ${beforeBendY} `
    + `Q ${fromX} ${bendY} `
    + `${firstHorizontalX} ${bendY} `
    + `L ${lastHorizontalX} ${bendY} `
    + `Q ${toX} ${bendY} `
    + `${toX} ${afterBendY} `
    + `L ${toX} ${height}`
  )
}

function ratpStopPlaceLabel(
  stop: Stop,
) {
  const areaLabel =
    ratpAreaLabelByStopId.value.get(
      stop.id,
    )

  if (areaLabel) {
    return areaLabel
  }

  const label =
    stop.$stop.placeName?.trim()

  if (label === undefined || label === '') {
    return null
  }

  return label
}

function ratpNetworkStopBlockX(
  lane: number,
) {
  return (
    ratpLaneX(lane)
    - ratpAdaptiveConnectionsWidth.value
    - RATP_CONNECTION_AXIS_GAP
  )
}

function ratpNetworkStopBlockStyle(
  lane: number,
) {
  return {
    left:
      `${ratpLaneX(lane) - ratpAdaptiveConnectionsWidth.value - RATP_CONNECTION_AXIS_GAP}em`,
    width:
      `${ratpAdaptiveStopBlockWidth.value}em`,
  }
}

function isRatpHighlightedStop(
  stop: Stop,
) {
  return (
    stop.id === ratpFirstVisibleStop.value?.id
    || stop.id === ratpLastVisibleStop.value?.id
    || stop.$stop.terminus
  )
}

function ratpStopHasConnections(
  stop: Stop,
) {
  return (
    stop.$stop.connections.length > 0
    || (
      stop.$stop.customConnections
      ?? []
    ).length > 0
  )
}

function ratpStopConnectionCount(
  stop: Stop,
) {
  return (
    stop.$stop.connections.length
    + (
      stop.$stop.customConnections
      ?? []
    ).length
  )
}

function ratpStopHasDenseConnections(
  stop: Stop,
) {
  return ratpStopConnectionCount(stop) >= 5
}

function ratpStopHasVeryDenseConnections(
  stop: Stop,
) {
  return ratpStopConnectionCount(stop) >= 8
}

function ratpStopHasUltraDenseConnections(
  stop: Stop,
) {
  return ratpStopConnectionCount(stop) >= 11
}

function ratpStopUsesWhiteMarker(
  stop: Stop,
) {
  return (
    ratpStopHasConnections(stop)
    || stop.$stop.terminus
  )
}

function ratpStopUsesPlainMarker(
  stop: Stop,
) {
  return !ratpStopUsesWhiteMarker(stop)
}

function isSncfFirstStop(
  index: number,
) {
  return index === 0
}

function isSncfLastStop(
  index: number,
) {
  return index
    === sncfStops.value.length - 1
}

/*
 * =========================================================
 * CORRESPONDANCES — ADAPTATION SNCF
 * =========================================================
 *
 * En signalétique SNCF, les petits ornements aéroport
 * (Orly / CDG) affichés sous certaines lignes ne sont pas
 * utilisés dans cette vue.
 *
 * Important :
 * - les données du projet ne sont jamais modifiées ;
 * - le rendu IDFM conserve intégralement ces ornements ;
 * - tous les autres pictogrammes / services restent présents.
 */

function isSncfHiddenAirportOrnament(
  ornament: Ornament | null | undefined,
) {
  if (!ornament) {
    return false
  }

  return (
    '$airportOrnament' in ornament
    || '$airportNameOrnament' in ornament
  )
}

function getSncfConnections(
  connections: Connection[],
): Connection[] {
  return connections.map(
    (connection) => {
      if ('$modeConnection' in connection) {
        return {
          ...connection,

          $modeConnection: {
            ...connection.$modeConnection,

            elements:
              connection
                .$modeConnection
                .elements
                .map(
                  element => ({
                    ...element,

                    $modeConnectionElement: {
                      ...element
                        .$modeConnectionElement,

                      ornament:
                        isSncfHiddenAirportOrnament(
                          element
                            .$modeConnectionElement
                            .ornament,
                        )
                          ? null
                          : element
                              .$modeConnectionElement
                              .ornament,
                    },
                  }),
                ),
          },
        }
      }

      if ('$serviceConnection' in connection) {
        return {
          ...connection,

          $serviceConnection: {
            ...connection.$serviceConnection,

            elements:
              connection
                .$serviceConnection
                .elements
                .map(
                  element => ({
                    ...element,

                    $serviceConnectionElement: {
                      ...element
                        .$serviceConnectionElement,

                      ornament:
                        isSncfHiddenAirportOrnament(
                          element
                            .$serviceConnectionElement
                            .ornament,
                        )
                          ? null
                          : element
                              .$serviceConnectionElement
                              .ornament,
                    },
                  }),
                ),
          },
        }
      }

      return connection
    },
  )
}

/*
 * =========================================================
 * ANNOTATIONS
 * =========================================================
 */

function annotationPositionStyle(
  annotation: Annotation,
) {
  return {
    left:
      `${annotation.$annotation.offsetX}em`,

    top:
      `${annotation.$annotation.offsetY}em`,
  }
}

function normalizeAnnotationColor(
  color: string | null,
) {
  if (
    color === null
    || color.trim() === ''
  ) {
    return (
      'var(--blue-ratp-paper)'
    )
  }

  const value =
    color.trim()

  if (
    /^[0-9a-f]{3,8}$/i
      .test(value)
  ) {
    return `#${value}`
  }

  return value
}

function annotationTextStyle(
  annotation: Annotation,
) {
  return {
    color:
      normalizeAnnotationColor(
        annotation
          .$annotation
          .color,
      ),

    fontSize:
      `${
        annotation
          .$annotation
          .fontSize
      }em`,

    fontWeight:
      annotation
        .$annotation
        .bold
        ? 'bold'
        : 'normal',

    fontStyle:
      annotation
        .$annotation
        .italic
        ? 'italic'
        : 'normal',

    textDecoration:
      annotation
        .$annotation
        .underline
        ? 'underline'
        : 'none',
  }
}

function getContentFontSize() {
  if (
    content.value === null
  ) {
    return 16
  }

  const fontSize =
    Number.parseFloat(
      window
        .getComputedStyle(
          content.value,
        )
        .fontSize,
    )

  if (
    Number.isNaN(
      fontSize,
    )
  ) {
    return 16
  }

  return fontSize
}

function onAnnotationPointerDown(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    event.button !== 0
  ) {
    return
  }

  const target =
  event.target as HTMLElement

  if (
    target.closest(
      '.annotation-delete',
    )
  ) {
    return
  }

  event.preventDefault()

  const element =
  event.currentTarget as HTMLElement

  element.setPointerCapture(
    event.pointerId,
  )

  draggingAnnotationId.value =
    annotation.id

  startPointerX =
    event.clientX

  startPointerY =
    event.clientY

  startOffsetX =
    annotation
      .$annotation
      .offsetX

  startOffsetY =
    annotation
      .$annotation
      .offsetY

  hasMoved = false
}

function onAnnotationPointerMove(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const deltaX =
    event.clientX
    - startPointerX

  const deltaY =
    event.clientY
    - startPointerY

  if (
    Math.abs(deltaX) > 3
    || Math.abs(deltaY) > 3
  ) {
    hasMoved = true
  }

  if (!hasMoved) {
    return
  }

  const fontSize =
    getContentFontSize()

  annotation
    .$annotation
    .offsetX =
      startOffsetX
      + deltaX
      / fontSize

  annotation
    .$annotation
    .offsetY =
      startOffsetY
      + deltaY
      / fontSize
}

function onAnnotationPointerCancel(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const element =
  event.currentTarget as HTMLElement

  if (
    element.hasPointerCapture(
      event.pointerId,
    )
  ) {
    element.releasePointerCapture(
      event.pointerId,
    )
  }

  draggingAnnotationId.value =
    null
}

function onAnnotationPointerUp(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const element =
    event.currentTarget as HTMLElement

  if (
    element.hasPointerCapture(
      event.pointerId,
    )
  ) {
    element.releasePointerCapture(
      event.pointerId,
    )
  }

  draggingAnnotationId.value =
    null

  if (!hasMoved) {
    openAnnotationProperties(
      annotation,
    )
  }
}

function openAnnotationProperties(
  annotation: Annotation,
) {
  selectedAnnotation.value =
    annotation

  annotationPropertiesVisible.value =
    true
}

function deleteAnnotation(
  annotation: Annotation,
) {
  if (
    line.value.annotations
    === undefined
  ) {
    return
  }

  const index =
    line
      .value
      .annotations
      .findIndex(
        item =>
          item.id
          === annotation.id,
      )

  if (
    index === -1
  ) {
    return
  }

  line.value.annotations.splice(
    index,
    1,
  )

  if (
    selectedAnnotation
      .value
      ?.id
    === annotation.id
  ) {
    selectedAnnotation.value =
      null

    annotationPropertiesVisible.value =
      false
  }
}
</script>

<template>
  <div
    v-if="isRatpPreview"
    v-bind="$attrs"
    class="ratp-preview"
    :class="{
      'is-compact-height':
        ratpHasCompactTopology,
    }"
    :style="[
      {
        '--ratp-line-color':
          line.color ?? '#ffcd00',
        '--ratp-brand-blue':
          RATP_BRAND_BLUE,
        '--ratp-body-background':
          RATP_BODY_BACKGROUND,
        '--ratp-preview-width':
          `${ratpPreviewWidthEm}em`,
        '--ratp-network-width':
          `${ratpPreviewWidthEm}em`,
        '--ratp-stop-block-width':
          `${ratpAdaptiveStopBlockWidth}em`,
        '--ratp-connections-width':
          `${ratpAdaptiveConnectionsWidth}em`,
        '--ratp-connection-label-spacer':
          `${RATP_CONNECTION_LABEL_SPACER}em`,
      },
      mapFontStyle,
    ]"
  >
    <div class="ratp-preview-top-stripe" />

    <div class="ratp-preview-header">
      <div class="ratp-preview-header-identity">
        <div
          v-for="group in ratpHeaderLineModeGroups"
          :key="group.key"
          class="ratp-preview-header-line-group"
        >
          <img
            v-if="getTransportServiceIcon(group.transportService)"
            :src="getTransportServiceIcon(group.transportService) ?? undefined"
            class="ratp-preview-service-icon"
            alt=""
            aria-hidden="true"
          >

          <template v-else>
            <Mode
              plain
              :mode="group.mode"
              class="ratp-preview-mode"
            />

            <div class="ratp-preview-header-indices">
              <LineIndex
                v-for="identity in group.identities"
                :key="identity.key"
                :mode="identity.mode"
                :index="identity.index"
                class="ratp-preview-index"
              />
            </div>
          </template>
        </div>
      </div>

      <div class="ratp-preview-header-text">
        <div
          class="ratp-preview-header-direction"
          :class="{
            'is-long':
              ratpHeaderDirectionLength >= 28,
            'is-very-long':
              ratpHeaderDirectionLength >= 40,
            'is-ultra-long':
              ratpHeaderDirectionLength >= 64,
          }"
        >
          {{ ratpHeaderTerminiLabel }}
        </div>
      </div>
    </div>

    <div class="ratp-preview-body">
      <div class="ratp-preview-network">
        <div
          v-if="ratpShouldCloseCircularNetwork"
          class="ratp-network-row ratp-network-row-circular-closure"
        >
          <svg
            class="ratp-network-fork"
            :viewBox="`0 0 ${ratpPreviewWidthEm} ${SNCF_NETWORK_FORK_HEIGHT}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              :d="ratpCircularClosurePath"
              :stroke="line.color ?? '#ffffff'"
            />
          </svg>
        </div>

        <div
          v-for="item in ratpVisibleRows"
          :key="item.row.key"
          class="ratp-network-row"
          :class="{
            'is-fork-row':
              item.row.forks.length > 0
              && item.row.stops.length === 0,
            'is-crowded-branch-row':
              sncfNetworkLanesAtRow(
                item.rowIndex,
              ).length >= 2,
            'is-ultra-crowded-branch-row':
              sncfNetworkLanesAtRow(
                item.rowIndex,
              ).length >= 3,
          }"
        >
          <div
            class="ratp-network-lanes"
            :style="{
              width:
                `${ratpPreviewWidthEm}em`,
            }"
          >
            <template
              v-for="entry in item.row.stops"
              :key="`ratp-urban-bubble-${entry.key}`"
            >
              <div
                v-if="stopHasUrbanBubble(entry.stop)"
                class="ratp-network-urban-bubble"
                :class="networkUrbanBubbleClass(item.rowIndex, entry.lane)"
                :style="{
                  left: `${ratpLaneX(entry.lane)}em`,
                }"
                aria-hidden="true"
              >
                <span
                  v-if="networkUrbanBubbleLabel(item.rowIndex, entry.lane)"
                  class="ratp-urban-bubble-label"
                >
                  {{ networkUrbanBubbleLabel(item.rowIndex, entry.lane) }}
                </span>
              </div>
            </template>

            <div
              v-for="lane in sncfNetworkLanesAtRow(item.rowIndex)"
              :key="`ratp-lane-${lane.lane}-${item.rowIndex}`"
              class="ratp-network-lane-line"
              :style="ratpLaneStyle(lane, item.rowIndex)"
            />

            <div
              v-for="range in sncfNetworkLocalRangesAtRow(item.rowIndex)"
              :key="`${range.key}-${item.rowIndex}`"
              class="ratp-network-local-line"
              :style="ratpLocalRangeStyle(range, item.rowIndex)"
            />

            <svg
              v-if="item.row.forks.length > 0"
              class="ratp-network-fork"
              :viewBox="`0 0 ${ratpPreviewWidthEm} ${SNCF_NETWORK_FORK_HEIGHT}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                v-for="fork in item.row.forks"
                :key="fork.key"
                :d="ratpForkPath(fork)"
                :stroke="fork.color"
              />
            </svg>

            <template
              v-for="entry in item.row.stops"
              :key="`ratp-marker-${entry.key}`"
            >
              <div
                v-if="ratpStopUsesPlainMarker(entry.stop)"
                class="ratp-network-stop-dot ratp-network-stop-dot-plain"
                :style="{
                  left:
                    `${ratpLaneX(entry.lane)}em`,
                }"
              />

              <div
                v-else
                class="ratp-network-stop-dot"
                :class="{
                  'is-terminus':
                    entry.stop.$stop.terminus,
                  'is-first':
                    entry.stop.id
                    === ratpFirstVisibleStop?.id,
                }"
                :style="{
                  left:
                    `${ratpLaneX(entry.lane)}em`,
                  '--ratp-stop-line-color':
                    sncfNetworkStopMarkerColor(
                      item.rowIndex,
                      entry.lane,
                    ),
                }"
              />
            </template>
          </div>

          <div
            v-for="entry in item.row.stops"
            :key="`ratp-content-${entry.key}`"
            class="ratp-stop-block"
            :style="ratpNetworkStopBlockStyle(
              entry.lane,
            )"
          >
            <div
              class="ratp-stop-connections"
              :class="{
                'is-dense':
                  ratpStopHasDenseConnections(
                    entry.stop,
                  ),
                'is-very-dense':
                  ratpStopHasVeryDenseConnections(
                    entry.stop,
                  ),
                'is-ultra-dense':
                  ratpStopHasUltraDenseConnections(
                    entry.stop,
                  ),
              }"
              @click.stop
            >
              <Connections
                :connections="entry.stop.$stop.connections"
                :custom-connections="entry.stop.$stop.customConnections ?? []"
                :reverse="false"
              />
            </div>

            <div class="ratp-stop-main">
              <div class="ratp-stop-header">

                <div
                  class="ratp-stop-name"
                  :class="{
                    'is-highlighted':
                      isRatpHighlightedStop(
                        entry.stop,
                      ),
                    'is-closed':
                      entry.stop.$stop.closed,
                    'is-future':
                      entry.stop.$stop.future,
                  }"
                >
                  {{
                    entry.stop.$stop.name
                    || $t('ui.map_editor.toolbox.untitled_stop')
                  }}
                </div>
              </div>

              <div
                v-if="entry.stop.$stop.subtitle"
                class="ratp-stop-subtitle"
              >
                {{ entry.stop.$stop.subtitle }}
              </div>

              <div
                v-if="ratpStopPlaceLabel(entry.stop)"
                class="ratp-stop-place"
              >
                <span class="ratp-stop-place-line" />

                <span class="ratp-stop-place-label">
                  {{ ratpStopPlaceLabel(entry.stop) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ratp-preview-bottom-stripe" />
  </div>

  <div
    v-else-if="isSncfSignage"
    ref="sncfSignageRoot"
    v-bind="$attrs"
    class="sncf-signage"
    :class="{
      'is-tram-reference': isTramMode,
      'is-rer-reference': isSncfRerMode,
      'is-heavy-rail-reference': isSncfHeavyRailMode,
    }"
    :style="[
      {
        '--sncf-line-color':
          line.color ?? '#ffcd00',
      },
      mapFontStyle,
    ]"
  >
    <div class="sncf-signage-header">
      <div class="sncf-signage-identity">
        <div
          v-for="group in planLineModeGroups"
          :key="group.key"
          class="sncf-signage-identity-group"
        >
          <img
            v-if="getTransportServiceIcon(group.transportService)"
            :src="getTransportServiceIcon(group.transportService) ?? undefined"
            class="sncf-signage-service-icon"
            alt=""
            aria-hidden="true"
          >

          <Mode
            v-else
            plain
            :mode="group.mode"
            class="sncf-signage-mode"
          />

          <div
            class="sncf-signage-indices"
            :class="{
              'is-stacked':
                group.identities.length > 1,
            }"
          >
            <LineIndex
              v-for="identity in group.identities"
              :key="identity.key"
              :mode="identity.mode"
              :index="identity.index"
              class="sncf-signage-index"
            />
          </div>
        </div>
      </div>

      <div class="sncf-signage-direction">
        <div class="sncf-signage-direction-line">
          <span class="sncf-signage-direction-label">
            {{
              isSncfRerMode
                ? $t('ui.map_editor.towards')
                : $t('ui.map_editor.direction')
            }}
          </span>

          <span class="sncf-signage-direction-main">
            {{
              isSncfRerMode
                ? sncfDestinations[0] || $t('ui.map_editor.destination')
                : sncfDirectionDestination
            }}
          </span>
        </div>

        <div
          v-if="isSncfRerMode && sncfDestinations.length > 1"
          class="sncf-signage-destinations"
        >
          {{ sncfDestinationText }}
        </div>
      </div>
    </div>

    <div
      class="sncf-signage-body"
      :class="{
        'has-network':
          sncfNetwork.hasBranches,
      }"
    >
      <div
        v-if="sncfNetwork.hasBranches"
        class="sncf-signage-network"
        :style="{
          width:
            `${sncfNetworkLaneAreaWidth}em`,
        }"
      >
        <div
          v-for="(row, rowIndex) in sncfNetwork.rows"
          :key="row.key"
          class="sncf-network-row"
          :class="{
            'is-fork-row':
              row.forks.length > 0
              && row.stops.length === 0,
          }"
          :style="{
            '--sncf-network-lane-area-width':
              `${sncfNetworkLaneAreaWidth}em`,
          }"
        >
          <div
            class="sncf-network-lanes"
            :style="{
              width:
                `${sncfNetworkLaneAreaWidth}em`,
            }"
          >
            <template
              v-for="entry in row.stops"
              :key="`sncf-urban-bubble-${entry.key}`"
            >
              <div
                v-if="stopHasUrbanBubble(entry.stop)"
                class="sncf-network-urban-bubble"
                :class="networkUrbanBubbleClass(rowIndex, entry.lane)"
                :style="{
                  left: `${sncfNetworkLaneX(entry.lane)}em`,
                }"
                aria-hidden="true"
              >
                <span
                  v-if="networkUrbanBubbleLabel(rowIndex, entry.lane)"
                  class="sncf-urban-bubble-label"
                >
                  {{ networkUrbanBubbleLabel(rowIndex, entry.lane) }}
                </span>
              </div>
            </template>

            <div
              v-for="lane in sncfNetworkLanesAtRow(rowIndex)"
              :key="`lane-${lane.lane}-${rowIndex}`"
              class="sncf-network-lane-line"
              :style="sncfNetworkLaneStyle(lane, rowIndex)"
            />

            <div
              v-for="range in sncfNetworkLocalRangesAtRow(rowIndex)"
              :key="`${range.key}-${rowIndex}`"
              class="sncf-network-local-line"
              :style="sncfNetworkLocalRangeStyle(range, rowIndex)"
            />

            <svg
              v-if="row.forks.length > 0"
              class="sncf-network-fork"
              :viewBox="`0 0 ${sncfNetworkLaneAreaWidth} ${SNCF_NETWORK_FORK_HEIGHT}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                v-for="fork in row.forks"
                :key="fork.key"
                :d="sncfNetworkForkPath(fork, rowIndex)"
                :stroke="fork.color"
              />
            </svg>

            <div
              v-for="entry in row.stops"
              :key="`dot-${entry.key}`"
              class="sncf-network-stop-dot sncf-signage-dot"
              :class="{
                'is-terminus':
                  entry.stop.$stop.terminus,
                'is-first':
                  entry.stop.id
                  === sncfNetworkFirstStopId(),
              }"
              :style="{
                left:
                  `${sncfNetworkLaneX(entry.lane)}em`,
                '--sncf-stop-line-color':
                  sncfNetworkStopMarkerColor(
                    rowIndex,
                    entry.lane,
                  ),
              }"
            >
              <span
                v-if="!isSncfRerMode && entry.stop.id === sncfNetworkFirstStopId()"
                class="sncf-first-direction-arrow"
                aria-hidden="true"
              />
            </div>
          </div>

          <!--
            Une branche = une vraie colonne de contenu.
            Les arrêts de deux sorties d'une fourche peuvent donc
            partager la même hauteur sans se masquer mutuellement.
          -->
          <div
            v-for="entry in row.stops"
            :key="`content-${entry.key}`"
            class="sncf-signage-stop-main sncf-network-stop-main"
            :style="{
              left:
                `${sncfNetworkStopContentX(entry.lane)}em`,
              width:
                `${SNCF_NETWORK_LABEL_WIDTH}em`,
            }"
          >
            <div
              class="sncf-signage-stop-content"
              :class="{
                'terminus-card':
                  entry.stop.$stop.terminus
                  && entry.stop.id
                  === sncfNetworkFirstStopId(),
              }"
            >
              <div class="sncf-signage-stop-text-line">
                <div
                  class="sncf-signage-stop-name"
                  :class="{
                    'is-terminus':
                      entry.stop.$stop.terminus,
                  }"
                >
                  {{
                    entry.stop.$stop.name
                    || $t('ui.map_editor.toolbox.untitled_stop')
                  }}
                </div>

                <div
                  v-if="
                    entry.stop.$stop.subtitle
                    || (
                      !isTramMode
                      && entry.stop.$stop.placeName
                    )
                  "
                  class="sncf-signage-stop-subtitle"
                >
                  {{
                    entry.stop.$stop.subtitle
                    || (
                      !isTramMode
                        ? entry.stop.$stop.placeName
                        : ''
                    )
                  }}
                </div>
              </div>
            </div>

            <div class="sncf-signage-connections">
              <Connections
                :connections="
                  getSncfConnections(
                    entry.stop.$stop.connections,
                  )
                "
                :custom-connections="
                  entry.stop.$stop.customConnections
                  ?? []
                "
                :reverse="false"
              />
            </div>
        

            <div
              v-if="sncfTramCommuneLabel(entry.stop)"
              class="sncf-tram-commune sncf-tram-network-commune"
            >
              {{ sncfTramCommuneLabel(entry.stop) }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="sncf-signage-route"
      >
        <div
          v-for="(stop, index) in sncfStops"
          :key="stop.id"
          :data-sncf-stop-row-id="stop.id"
          class="sncf-signage-stop"
          :class="{
            'is-first':
              isSncfFirstStop(index),
            'is-last':
              isSncfLastStop(index),
            'is-terminus':
              stop.$stop.terminus,
          }"
        >
          <div
            v-if="stopHasUrbanBubble(stop)"
            class="sncf-route-urban-bubble"
            :class="sncfUrbanBubbleClass(index)"
            aria-hidden="true"
          >
            <span
              v-if="sncfUrbanBubbleLabel(index)"
              class="sncf-urban-bubble-label"
            >
              {{ sncfUrbanBubbleLabel(index) }}
            </span>
          </div>

          <div
            v-if="sncfTramZoneRange(stop)?.isStart"
            class="sncf-tram-zone"
            :style="sncfTramZoneRangeStyle(stop)"
          >
            <span class="sncf-tram-zone-label">
              {{ sncfTramZoneRange(stop)?.zone }}
            </span>

            <span
              v-if="(sncfTramZoneRange(stop)?.span ?? 1) > 1"
              class="sncf-tram-zone-range-line"
              aria-hidden="true"
            />
          </div>

          <div class="sncf-signage-rail-column">
            <div
              v-if="sncfIncomingLineIdentity(index)"
              class="sncf-signage-local-segment sncf-signage-local-segment-top"
              :style="{
                backgroundColor:
                  sncfSegmentColorBefore(index),
              }"
            />

            <div
              v-if="
                index < sncfStops.length - 1
                && sncfOutgoingLineIdentity(stop)
              "
              class="sncf-signage-local-segment sncf-signage-local-segment-bottom"
              :style="{
                backgroundColor:
                  sncfSegmentColorAfter(stop),
              }"
            />

            <div
              v-if="index > 0"
              class="sncf-signage-rail sncf-signage-rail-top"
              :style="{
                backgroundColor:
                  sncfSegmentColorBefore(index),
              }"
            />

            <div
              :data-sncf-stop-dot-id="stop.id"
              class="sncf-signage-dot"
              :class="{
                'is-terminus':
                  stop.$stop.terminus,
                'is-first':
                  isSncfFirstStop(index),
                'is-last':
                  isSncfLastStop(index),
              }"
              :style="{
                '--sncf-stop-line-color':
                  sncfStopMarkerLineColor(
                    stop,
                    index,
                  ),
              }"
            >
              <span
                v-if="!isSncfRerMode && isSncfFirstStop(index)"
                class="sncf-first-direction-arrow"
                aria-hidden="true"
              />
            </div>

            <div
              v-if="
                index
                < sncfStops.length - 1
              "
              class="sncf-signage-rail sncf-signage-rail-bottom"
              :style="{
                backgroundColor:
                  sncfSegmentColorAfter(stop),
              }"
            />
          </div>

          <div class="sncf-signage-stop-main">
            <div
              class="sncf-signage-stop-content"
              :class="{
                'terminus-card':
                  stop.$stop.terminus
                  && isSncfFirstStop(index),
              }"
            >
              <div class="sncf-signage-stop-text-line">
                <div
                  class="sncf-signage-stop-name"
                  :class="{
                    'is-terminus':
                      stop.$stop.terminus,
                  }"
                >
                  {{
                    stop.$stop.name
                    || $t('ui.map_editor.toolbox.untitled_stop')
                  }}
                </div>

                <div
                  v-if="
                    stop.$stop.subtitle
                    || (
                      !isTramMode
                      && stop.$stop.placeName
                    )
                  "
                  class="sncf-signage-stop-subtitle"
                >
                  {{
                    stop.$stop.subtitle
                    || (
                      !isTramMode
                        ? stop.$stop.placeName
                        : ''
                    )
                  }}
                </div>
              </div>
            </div>

            <div
              class="sncf-signage-connections"
              @click.stop
            >
              <Connections
                :connections="
                  getSncfConnections(
                    stop.$stop.connections,
                  )
                "
                :custom-connections="
                  stop.$stop.customConnections
                  ?? []
                "
                :reverse="false"
              />
            </div>

          </div>

          <div
            v-if="sncfTramCommuneLabel(stop)"
            class="sncf-tram-commune"
          >
            {{ sncfTramCommuneLabel(stop) }}
          </div>
        </div>
      </div>
    </div>

  </div>

  <div
    v-else
    ref="content"
    v-bind="$attrs"
    class="relative content bg-white flex gap-10 flex-row"
    :class="{
      'bus-map': isBusMode,
      'tram-map': isTramMode,
      'preview-readonly': isPreviewing,
    }"
    :style="[contentAdaptiveStyle, mapFontStyle]"
  >
    <!--
      ======================================================
      BANDEAU BUS / BRT / NOCTILIEN
      ======================================================
    -->
    <div
      v-if="isBusMode"
      class="bus-header"
    >
      <!--
        Pictogramme du moyen de transport.

        Affiché uniquement pour :
        - Téléphérique
        - Vélo
        - Navette fluviale

        Le Bus conserve son bandeau sans ce bloc.
      -->
      <div
        v-if="showTransportModePictogram"
        class="bus-mode-box"
        :class="{
          'has-service':
            Boolean(transportServiceIcon),
          'wide-service':
            isWideTransportService,
        }"
      >
        <img
          v-if="transportServiceIcon"
          :src="transportServiceIcon"
          class="bus-service-icon"
          alt=""
          aria-hidden="true"
        >

        <Mode
          v-else
          :mode="line.mode"
        />
      </div>

      <!--
        Indice de ligne.
      -->
      <div
        v-if="showBusIndex"
        class="bus-index-box"
        :class="{
          'has-custom-image':
            Boolean(busCustomIndexImage),
        }"
        :style="
          busCustomIndexImage
            ? undefined
            : busIndexStyle
        "
      >
        <img
          v-if="busCustomIndexImage"
          :src="busCustomIndexImage"
          class="bus-index-custom-image"
          alt=""
        >

        <template v-else>
          {{ busIndexText }}
        </template>
      </div>

      <!--
        Accessibilité.

        Le bloc reste présent uniquement
        lorsque la ligne est accessible.
      -->
      <div
        v-if="line.fullyAccessible"
        class="bus-accessibility-box"
      >
        <Wheelchair />
      </div>

      <!--
        Destinations.
      -->
      <div
        class="bus-destinations-box"
      >
        <template
          v-if="
            busDestinations.length > 0
          "
        >
          <template
            v-for="(
              destination,
              index
            ) in busDestinations"
            :key="
              `${destination}-${index}`
            "
          >
            <span
              v-if="index > 0"
              class="bus-destination-arrow"
            >
              ↔
            </span>

            <span
              class="bus-destination-name"
            >
              {{ destination }}
            </span>
          </template>
        </template>

        <span
          v-else
          class="
            bus-destination-placeholder
            export-hide
          "
        >
          {{ $t('ui.map_editor.destinations') }}
        </span>
      </div>
    </div>

    <!--
      ======================================================
      IDENTITÉ TRAMWAY
      ======================================================

      Le Tram conserve exactement la ligne et la topologie
      existantes.

      Seul le panneau d'identité situé à gauche est adapté
      au style des plans Tramway Île-de-France.
    -->
    <div
      v-if="isTramMode"
      class="tram-identity-panel"
      :style="tramIdentityStyle"
    >
      <!--
        ====================================================
        EN-TÊTE ÎLE-DE-FRANCE MOBILITÉS
        ====================================================

        Ce bloc reproduit uniquement l'identité visuelle
        du panneau de référence.

        Il ne touche absolument pas à la ligne du plan.
      -->
      <div class="tram-idfm-header">
        <div class="tram-idfm-wordmark">
          <span class="tram-idfm-main">
            Île-de-France
          </span>

          <span class="tram-idfm-sub">
            mobilités
          </span>
        </div>

        <div class="tram-idfm-logo-mark">
          <i class="i-tabler-accessible" />
        </div>
      </div>

      <!--
        ====================================================
        IDENTITÉ DE LA LIGNE
        ====================================================

        IMPORTANT :
        on affiche UNIQUEMENT le LineIndex Tram natif.

        Le SVG tram_T*.svg contient déjà l'identité
        graphique Tram + l'indice de la ligne.

        On ne rajoute donc plus <Mode> à côté :
        c'était lui qui provoquait le Tram en double.

        L'indice reste totalement dynamique :
        T1, T3a, T7, T14, etc.
      -->
        <div class="tram-identity-body">
          <div class="tram-mode-index">
            <div class="tram-mode">
              <img
                v-if="transportServiceIcon"
                :src="transportServiceIcon"
                class="tram-service-icon"
                alt=""
                aria-hidden="true"
              >

              <Mode
                v-else
                :mode="line.mode"
              />
            </div>

            <div class="tram-native-index">
              <LineIndex
                :mode="line.mode"
                :index="line.index"
              />
            </div>
          </div>
        </div>

        <div class="flex-grow" />

        <div
          class="
            tram-project-info
            text-[var(--blue-ratp-paper)]
          "
        >
          <div class="flex flex-row gap-.5">
            <span>CLU •</span>

          <span v-if="presetBased">
            PBP •
          </span>

          <span>
            {{ outdated ? 'PVU' : 'PVS' }} •
          </span>

          <span>{{ date }} •</span>

          <span>V{{ applicationVersion }}</span>
        </div>
      </div>
    </div>

    <!--
      ======================================================
      IDENTITÉ CLASSIQUE BULB
      ======================================================

      Conservée pour tous les modes qui n'utilisent
      ni le bandeau Bus, ni le panneau Tramway.
    -->
    <div
      v-if="!isBusMode && !isTramMode"
      ref="classicIdentityPanel"
      class="
        line-identity-panel
        ml-3
        flex
        flex-col
        min-w-fit
        gap-3
      "
      :style="classicIdentityStyle"
    >
      <div
        class="
          w-full
          h-8
          bg-[var(--blue-ratp-paper)]
        "
      />

      <div
        class="
          classic-line-identities
          w-full
          flex
          flex-col
          gap-3
          justify-center
          items-center
          text-4em
        "
      >
        <div
          v-for="
            group
            in planLineModeGroups
          "
          :key="group.key"
          class="classic-line-mode-group"
        >
          <img
            v-if="
              getTransportServiceIcon(
                group.transportService,
              )
            "
            :src="
              getTransportServiceIcon(
                group.transportService,
              )
              ?? undefined
            "
            class="classic-service-icon"
            alt=""
            aria-hidden="true"
          >

          <Mode
            v-else
            :mode="group.mode"
          />

          <div
            class="classic-line-indices"
          >
            <LineIndex
              v-for="
                identity
                in group.identities
              "
              :key="identity.key"
              :mode="identity.mode"
              :index="identity.index"
            />
          </div>
        </div>
      </div>

      <div
        v-if="line.fullyAccessible"
        class="
          w-full
          flex
          flex-row
          gap-3
          justify-center
          items-center
          bg-[var(--blue-ratp-paper-secondary)]/50
          mt-.5em
          py-3
          text-1.75em
        "
      >
        <Wheelchair />
      </div>

      <div class="flex-grow" />

<div
  class="
    text-.25em
    flex
    flex-col
    line-height-1.75
    text-[var(--blue-ratp-paper)]
    mb-3
  "
>
  <div
    class="
      flex
      flex-row
      gap-.5
    "
  >
    <span>
      https://useclu.pro ° {{ $t('ui.topbar.brand') }} ° {{ date }}
    </span>
  </div>
</div>
    </div>

    <!--
      ======================================================
      TOPOLOGIE
      ======================================================
    -->
    <SectionsGroup
      v-model="line.topology"
      class="
        sections-group
        w-max-content
        min-h-15em
        p-1em
        pt-20
        pr-10em
      "
    />

    <!--
      ======================================================
      ANNOTATIONS LIBRES
      ======================================================
    -->
    <div
      class="annotations-layer"
    >
      <div
        v-for="
          annotation in annotations
        "
        :key="annotation.id"
        class="free-annotation"
        :class="{
          dragging:
            draggingAnnotationId
            === annotation.id,
        }"
        :style="
          annotationPositionStyle(
            annotation,
          )
        "
        @pointerdown="
          event =>
            onAnnotationPointerDown(
              event,
              annotation,
            )
        "
        @pointermove="
          event =>
            onAnnotationPointerMove(
              event,
              annotation,
            )
        "
        @pointerup="
          event =>
            onAnnotationPointerUp(
              event,
              annotation,
            )
        "
        @pointercancel="
          event =>
            onAnnotationPointerCancel(
              event,
              annotation,
            )
        "
      >
        <span
          class="annotation-text"
          :style="
            annotationTextStyle(
              annotation,
            )
          "
        >
          {{
            annotation
              .$annotation
              .text
          }}
        </span>

        <button
          type="button"
          class="annotation-delete"
          :title="$t('ui.map_editor.delete_annotation')"
          @pointerdown.stop
          @click.stop="
            deleteAnnotation(
              annotation,
            )
          "
        >
          <i
            class="i-tabler-trash"
          />
        </button>
      </div>
    </div>

    <!--
      ======================================================
      MENTIONS LÉGALES
      ======================================================
    -->
    <div
      v-if="!isBusMode"
      class="
        mr-3
        my-3
        rotate-180
        text-[var(--blue-ratp-paper)]
        text-.125em
        opacity-50
      "
    >
      <div
        class="
          legal-notice
          flex
          flex-col
          line-height-1
        "
      >
        <span>
          {{ $t('ui.map_editor.legal_notice') }}
        </span>
      </div>
    </div>

    <AnnotationPropertiesDialog
      v-if="selectedAnnotation"
      v-model:visible="
        annotationPropertiesVisible
      "
      v-model="
        selectedAnnotation
      "
    />
  </div>
</template>

<style scoped lang="scss">
.preview-engine-pending {
  box-sizing: border-box;

  width: max(32rem, 58vw);
  min-height: 24rem;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;

  padding: 3rem;

  border: 1px solid var(--p-content-border-color);
  border-radius: 1rem;

  background: var(--p-content-background);
  color: var(--p-text-color);

  font-family: var(--map-font-family);
  text-align: center;
}

.preview-engine-pending-icon {
  font-size: 3rem;
}

.preview-engine-pending-title {
  font-size: 1.4rem;
}

.preview-engine-pending-description {
  max-width: 34rem;

  color: var(--p-text-muted-color);

  line-height: 1.5;
}

.content.preview-readonly {
  pointer-events: none;
}

.content.preview-readonly :deep(.export-hide) {
  display: none !important;
}

/*
 * =========================================================
 * PRÉVISUALISATION RATP
 * =========================================================
 *
 * Le moteur RATP possède sa propre feuille et sa propre échelle.
 * Il ne dépend pas de mapSize : un grand projet ne doit jamais
 * miniaturiser la signalétique à l'intérieur d'une feuille immense.
 *
 * Les points, le trait et les blocs d'arrêts restent cependant
 * ancrés aux mêmes lignes logiques que le réseau SNCF, ce qui
 * garantit l'alignement point <-> arrêt, y compris sur les fourches.
 */

.ratp-preview {
  width: var(--ratp-preview-width, 80em);
  min-width: var(--ratp-preview-width, 80em);
  max-width: var(--ratp-preview-width, 80em);
  min-height: 72.25em;

  display: flex;
  flex-direction: column;

  box-sizing: border-box;

  font-family: var(--map-font-family);
  font-size: 16px;

  background: white;
  color: var(--ratp-brand-blue);

  overflow: hidden;
}

.ratp-preview.is-compact-height {
  min-height: auto;
}

.ratp-preview.is-compact-height .ratp-preview-body {
  padding-bottom: 1.4em;
}

.ratp-preview.is-compact-height .ratp-preview-bottom-stripe {
  margin-top: 0;
}

.ratp-preview-top-stripe,
.ratp-preview-bottom-stripe {
  width: 100%;
  height: .65em;

  flex: 0 0 auto;

  background: var(--ratp-brand-blue);
}

.ratp-preview-bottom-stripe {
  margin-top: auto;
  height: 4.6em;
}

.ratp-preview-header {
  height: 11.8em;

  flex: 0 0 auto;

  display: flex;
  align-items: center;
  gap: 2.9em;

  box-sizing: border-box;
  padding: 1.35em 5.3em 1.45em;

  background: #fbfbfb;
}

.ratp-preview-header-identity {
  display: flex;
  align-items: center;
  gap: 1.5em;

  flex: 0 0 auto;
}

.ratp-preview-header-line-group {
  display: flex;
  align-items: center;
  gap: 1.5em;

  flex: 0 0 auto;
}

.ratp-preview-header-indices {
  display: flex;
  align-items: center;
  gap: .55em;

  flex: 0 0 auto;
}

.ratp-preview-service-icon {
  width: auto;
  max-width: 8em;
  height: 6.7em;
  max-height: 6.7em;

  object-fit: contain;
}

.ratp-preview-mode,
.ratp-preview-index {
  display: block;

  flex: 0 0 auto;

  font-size: 8.2em;
  line-height: 1;
}

.ratp-preview-header-text {
  min-width: 0;

  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: .35em;
}

.ratp-preview-header-direction {
  color: var(--ratp-brand-blue);

  font-size: 3.55em;
  font-weight: 700;
  line-height: .96;
  letter-spacing: -.035em;

  white-space: nowrap;
}

.ratp-preview-header-direction.is-long {
  font-size: 2.95em;
}

.ratp-preview-header-direction.is-very-long {
  font-size: 2.55em;
  letter-spacing: -.045em;
}


.ratp-preview-header-direction.is-ultra-long {
  font-size: 2.08em;
  letter-spacing: -.05em;
}


.ratp-preview-body {
  position: relative;

  flex: 1 0 auto;

  box-sizing: border-box;
  padding: 4.45em 0 3em;

  background: var(--ratp-body-background);
}

.ratp-preview-network {
  position: relative;

  width: var(--ratp-network-width, 80em);
  min-width: var(--ratp-network-width, 80em);
}


.ratp-network-row {
  position: relative;

  width: var(--ratp-network-width, 80em);
  height: 3.9em;
  min-height: 3.9em;

  flex: 0 0 auto;
}

.ratp-network-row.is-fork-row {
  height: 8.2em;
  min-height: 8.2em;
}


.ratp-network-row-circular-closure {
  height: 8.2em;
  min-height: 8.2em;
}

.ratp-network-row.is-crowded-branch-row .ratp-stop-name {
  font-size: 2em;
}

.ratp-network-row.is-ultra-crowded-branch-row .ratp-stop-name {
  font-size: 1.84em;
}

.ratp-network-row.is-ultra-crowded-branch-row .ratp-stop-subtitle,
.ratp-network-row.is-ultra-crowded-branch-row .ratp-stop-place-label {
  font-size: .92em;
}

.ratp-network-row.is-ultra-crowded-branch-row .ratp-stop-connections {
  font-size: 1.02em;
}

.ratp-network-lanes {
  position: absolute;
  inset: 0;

  width: var(--ratp-network-width, 80em);
  min-height: inherit;

  pointer-events: none;
  isolation: isolate;
}

.ratp-network-urban-bubble {
  position: absolute;
  top: 0;

  width: 9.4em;
  height: 100%;

  transform: translateX(-50%);

  background: rgb(44 146 135 / 14%);
  border-radius: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  pointer-events: none;
  z-index: 0;
}

.ratp-network-urban-bubble.is-bubble-start {
  border-top-left-radius: 4.7em;
  border-top-right-radius: 4.7em;
}

.ratp-network-urban-bubble.is-bubble-end {
  border-bottom-left-radius: 4.7em;
  border-bottom-right-radius: 4.7em;
}

.ratp-network-urban-bubble.is-bubble-start.is-bubble-end {
  border-radius: 4.7em;
}

.ratp-urban-bubble-label {
  width: 100%;
  padding: 0 .65em;

  color: rgb(22 74 99 / 72%);
  font-size: 1.65em;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.ratp-network-lane-line,
.ratp-network-local-line {
  position: absolute;

  width: 1em;

  transform: translateX(-50%);

  border-radius: 0;

  pointer-events: none;
}

.ratp-network-lane-line {
  z-index: 1;
}

.ratp-network-local-line {
  /*
   * Un changement de ligne local doit remplacer visuellement
   * toute l'épaisseur du tracé RATP entre les deux arrêts.
   *
   * Avec .46em, la couleur principale restait visible de part
   * et d'autre du segment, donnant un faux effet multi-ligne.
   */
  width: 1em;
  z-index: 3;
}

.ratp-network-fork {
  position: absolute;
  inset: 0;

  width: var(--ratp-network-width, 80em);
  height: 100%;

  overflow: visible;

  pointer-events: none;
  z-index: 2;
}

.ratp-network-fork path {
  fill: none;

  stroke-width: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ratp-network-stop-dot {
  position: absolute;
  top: 50%;

  width: 1.75em;
  height: 1.75em;

  box-sizing: border-box;

  transform: translate(-50%, -50%);

  border: .16em solid #111;
  border-radius: 50%;

  background: white;

  z-index: 7;
}

.ratp-network-stop-dot-plain {
  width: 1.32em;
  height: 1.32em;

  border: none;

  background: var(--ratp-line-color);

  box-shadow:
    0 0 0 .12em var(--ratp-line-color);
}

.ratp-network-stop-dot.is-first,
.ratp-network-stop-dot.is-terminus {
  width: 1.82em;
  height: 1.82em;
}

.ratp-stop-block {
  position: absolute;
  top: 50%;

  height: 100%;

  display: grid;
  grid-template-columns:
    var(--ratp-connections-width)
    var(--ratp-connection-label-spacer)
    minmax(0, 1fr);
  column-gap: 0;
  align-items: center;

  box-sizing: border-box;
  padding: 0;
  margin: 0;

  transform: translateY(-50%);

  z-index: 6;
}

.ratp-stop-connections {
  position: relative;
  grid-column: 1;

  /*
   * IMPORTANT : la largeur de cette cellule est déjà définie par
   * grid-template-columns sur .ratp-stop-block.
   *
   * Ne jamais réutiliser ici --ratp-connections-width en `em` :
   * ce bloc change de font-size selon la densité des correspondances,
   * ce qui redimensionnait la cellule elle-même et déplaçait son bord
   * droit. C'était la cause des correspondances tantôt collées / à
   * droite du point, tantôt beaucoup trop éloignées.
   *
   * 100% remplit exactement la colonne du parent, indépendamment du
   * font-size local. Le bord droit reste donc invariant pour TOUS les
   * arrêts et TOUS les niveaux de densité.
   */
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;

  box-sizing: border-box;

  font-size: 1.16em;
  text-align: right;

  overflow: visible;
}

.ratp-stop-connections :deep(.connections-box > .flex) {
  display: none;
}

.ratp-stop-connections :deep(.connections-box),
.ratp-stop-connections :deep(.connection-groups),
.ratp-stop-connections :deep(.connection-group),
.ratp-stop-connections :deep(.connection-group-lines),
.ratp-stop-connections :deep(.container) {
  overflow: visible;
}

/*
 * RATP: ancrage géométrique unique des correspondances.
 *
 * La largeur réelle des pictogrammes et la topologie de la ligne
 * n'influencent jamais leur distance au tracé. Le bord droit du groupe
 * est ancré à RATP_CONNECTION_AXIS_GAP de l'axe ; tout surplus de largeur
 * part uniquement vers la gauche.
 */
.ratp-stop-connections :deep(.connections-box) {
  position: absolute;
  top: 50%;
  right: 0;

  width: max-content;
  min-width: max-content;
  max-width: none;

  transform: translateY(-50%);
}

.ratp-stop-connections :deep(.connection-groups) {
  width: max-content;
  min-width: max-content;
  max-width: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: .18em .42em;
}

.ratp-stop-connections :deep(.connection-group) {
  width: max-content;
  min-width: max-content;

  display: grid;
  grid-template-columns: max-content max-content;
  gap: .18em;
  align-items: center;
  justify-items: end;

  flex: 0 0 auto;

  margin: 0;
}

.ratp-stop-connections :deep(.connection-group-mode) {
  min-width: 1.25em;
  width: max-content;
  justify-items: center;
}

.ratp-stop-connections :deep(.mode-wrapper.transfer),
.ratp-stop-connections :deep(.mode-wrapper.pedestrian) {
  margin-left: 0;
  gap: .14em;
}

.ratp-stop-connections :deep(.transfer-indicator) {
  gap: .08em;
  margin-right: .05em;
}

.ratp-stop-connections :deep(.transfer-duration) {
  font-size: .48em;
}

.ratp-stop-connections :deep(.text-ornament) {
  font-size: .46em;
  line-height: 1.05;
}

.ratp-stop-connections :deep(.ornament-right) {
  min-width: max-content;
}

.ratp-stop-connections.is-dense {
  font-size: .98em;
}

.ratp-stop-connections.is-dense :deep(.connection-groups) {
  gap: .1em .32em;
}

.ratp-stop-connections.is-dense :deep(.connection-group) {
  grid-template-columns: max-content max-content;
}

.ratp-stop-connections.is-very-dense {
  font-size: .86em;
}

.ratp-stop-connections.is-very-dense :deep(.connection-groups) {
  gap: .06em .24em;
}

.ratp-stop-connections.is-very-dense :deep(.connection-group) {
  grid-template-columns: max-content max-content;
}

.ratp-stop-connections.is-ultra-dense {
  font-size: .76em;
}

.ratp-stop-connections.is-ultra-dense :deep(.connection-groups) {
  gap: .05em .18em;
}

.ratp-stop-connections.is-ultra-dense :deep(.connection-group) {
  grid-template-columns: max-content max-content;
}






.ratp-stop-connections :deep(.connection-group-lines) {
  width: max-content;
  min-width: max-content;
  max-width: none;

  grid-auto-flow: column;
  grid-auto-columns: max-content;
}

.ratp-stop-connections :deep(.mode-wrapper),
.ratp-stop-connections :deep(.transfer-indicator),
.ratp-stop-connections :deep(.container),
.ratp-stop-connections :deep(.ornament-right),
.ratp-stop-connections :deep(.ornament-bottom),
.ratp-stop-connections :deep(.airport-name),
.ratp-stop-connections :deep(.airport-name-label),
.ratp-stop-connections :deep(.text-ornament) {
  width: max-content;
  min-width: max-content;
  max-width: none;
}

.ratp-stop-connections :deep(.mode-wrapper.transfer),
.ratp-stop-connections :deep(.mode-wrapper.pedestrian) {
  margin-left: 0;
}

.ratp-stop-connections :deep(.text-ornament),
.ratp-stop-connections :deep(.airport-name-label) {
  white-space: nowrap;
}

.ratp-stop-connections :deep(.connection-group-mode .sep-line) {
  display: none;
}

.ratp-stop-connections :deep(.connection-group-lines) {
  width: max-content;
  align-items: center;
  justify-content: end;
  margin-bottom: 0;
}

/*
 * RATP : un mode = une rangée horizontale stable.
 * Les RER A/B/D, métros multiples, etc. restent tous
 * sur le même axe au lieu d'hériter de la grille IDFM.
 */
.ratp-stop-connections :deep(.connection-group-lines:not(.condensed)) {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-end !important;
  flex-wrap: nowrap !important;

  gap: .2em !important;
  margin: 0 !important;
}

.ratp-stop-connections :deep(.connection-group-lines:not(.condensed) > *) {
  flex: 0 0 auto !important;
  align-self: center !important;

  min-width: max-content !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

/*
 * Les ornements placés sous un indice (ex. avion sous RER B)
 * ne doivent pas modifier l'axe vertical de l'indice lui-même.
 * L'indice reste aligné avec A/D ; l'ornement flotte en dessous.
 */
.ratp-stop-connections
:deep(.connection-group-lines:not(.condensed) > .container.ornament-bottom) {
  position: relative !important;

  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;

  height: 1em !important;
  min-height: 1em !important;

  margin-inline: .08em !important;

  grid-row: auto !important;

  overflow: visible !important;
}

.ratp-stop-connections
:deep(.connection-group-lines:not(.condensed) > .container.ornament-bottom > .relative) {
  position: absolute !important;
  top: 1.06em !important;
  left: 50% !important;

  width: max-content !important;
  min-width: max-content !important;

  transform: translateX(-50%) !important;

  z-index: 2;
}

/*
 * Le petit séparateur vertical interne d'IDFM n'appartient pas
 * au rendu RATP. On garde uniquement le pictogramme du mode.
 */
.ratp-stop-connections :deep(.connection-group-mode) {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;

  height: auto !important;
}

.ratp-stop-connections :deep(.connection-group-mode > :last-child:not(.mode-wrapper)) {
  display: none !important;
}

/*
 * Séparation visuelle entre modes distincts :
 * Métro | RER | Transilien | Tram | services.
 * On conserve un blanc perceptible même sur les gros pôles.
 */
.ratp-stop-connections :deep(.connection-groups) {
  column-gap: .78em !important;
  row-gap: .18em !important;
}

.ratp-stop-connections.is-dense :deep(.connection-groups) {
  column-gap: .72em !important;
}

.ratp-stop-connections.is-very-dense :deep(.connection-groups) {
  column-gap: .66em !important;
}

.ratp-stop-connections.is-ultra-dense :deep(.connection-groups) {
  column-gap: .6em !important;
}

.ratp-stop-connections :deep(.connection-group > *) {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;

  width: max-content;
  min-width: max-content;
  max-width: none;

  line-height: 1;
  white-space: nowrap;
}

.ratp-stop-connections :deep(.connection-group > * > *),
.ratp-stop-connections :deep(.connection-group > * > * > *) {
  align-self: center;
  vertical-align: middle;

  margin-top: 0;
  margin-bottom: 0;
}

.ratp-stop-main {
  grid-column: 3;

  min-width: 0;
  height: 100%;

  display: flex;
  flex-direction: column;
  justify-content: center;

  box-sizing: border-box;
}

.ratp-stop-header {
  min-width: 0;

  display: flex;
  align-items: center;
  gap: .2em;
}

.ratp-stop-name {
  display: inline-block;

  width: max-content;
  max-width: 25em;

  padding: 0;

  color: var(--ratp-brand-blue);

  font-size: 2.18em;
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -.025em;

  white-space: nowrap;
}

.ratp-stop-name.is-highlighted {
  padding: .13em .32em .1em;

  background: var(--ratp-brand-blue);
  color: white;
}

.ratp-stop-name.is-closed {
  text-decoration: line-through;
}

.ratp-stop-name.is-future {
  opacity: .68;
}

.ratp-stop-subtitle {
  margin-top: .14em;
  margin-left: 0;

  color: rgb(36 82 163 / 72%);

  font-size: .92em;
  line-height: 1.08;
}

.ratp-stop-place {
  position: absolute;
  left: calc(var(--ratp-connections-width) + 22em);
  right: -7em;
  bottom: -.1em;

  display: flex;
  align-items: center;
  gap: .55em;
}

.ratp-stop-place-line {
  height: .08em;

  flex: 1 1 auto;

  background: rgb(0 0 0 / 40%);
}

.ratp-stop-place-label {
  flex: 0 0 auto;

  color: rgb(0 0 0 / 50%);

  font-size: .9em;
  font-style: italic;
  font-weight: 600;
  line-height: 1;

  white-space: nowrap;
}

/*
 * =========================================================
 * SIGNALÉTIQUE SNCF — RENDU DESSERTE V12
 * =========================================================
 *
 * Cette version s'appuie sur la vraie structure de
 * Connections.vue :
 *
 * .connections-box
 *   ├─ wrapper VerticalLine
 *   └─ .connection-groups
 *        └─ .connection-group
 *
 * On ne force donc plus tous les descendants.
 * Cela permet de récupérer les pictogrammes natifs
 * Métro / RER / Train / Tram / services.
 */

.sncf-signage {
  --sncf-rail-width: 1.25em;
  --sncf-fork-stroke-width: 1.25;
  --sncf-rail-center-x: 1.825em;

  font-size:
    calc(var(--font-size) * .26);

  /*
   * Largeur automatique :
   * 76em reste la largeur minimale correspondant au rendu
   * actuel, mais si un arrêt (ex. Châtelet) possède davantage
   * de correspondances, le fond SNCF s'agrandit tout seul.
   */
  width: max-content;
  min-width: 76em;
  max-width: none;
  min-height: 0;

  display: flex;
  flex-direction: column;

  align-self: flex-start;

  overflow: hidden;

  background: #1f2f3d;
  color: white;

  font-family:
    var(
      --map-font-family,
      'Parisine Ptf',
      sans-serif
    );

  outline:
    1px
    solid
    var(--p-gray-200);
}

.sncf-signage.is-tram-reference {
  --sncf-rail-width: 1.62em;
  --sncf-fork-stroke-width: 1.62;
  --sncf-rail-center-x: 1.92em;
}

.sncf-signage.is-heavy-rail-reference {
  --sncf-rail-width: 2.18em;
  --sncf-fork-stroke-width: 2.18;
  --sncf-rail-center-x: 2.18em;

  font-size: calc(var(--font-size) * .285);
}

.sncf-signage-header {
  display: flex;
  align-items: flex-start;

  min-height: 11.5em;

  padding:
    2.3em
    4em
    1.45em;

  gap: 1.4em;
}

.sncf-signage-identity {
  display: flex;
  align-items: center;
  gap: .8em;

  flex-shrink: 0;
}

.sncf-signage-identity-group {
  display: flex;
  align-items: flex-start;
  gap: .35em;

  flex-shrink: 0;
}

.sncf-signage-indices {
  display: flex;
  align-items: center;
  gap: .12em;

  flex-shrink: 0;
}

.sncf-signage-indices.is-stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: .18em;

  margin-top: 0;
}

.sncf-signage-mode {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 7em;

  line-height: 1;
}

.sncf-signage-service-icon {
  display: block;

  width: auto;
  height: 7em;

  max-width: 14em;
  max-height: 7em;

  flex-shrink: 0;

  object-fit: contain;
  object-position: center;
}

.sncf-signage-index {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 7em;

  line-height: 1;
}

.sncf-signage-direction {
  min-width: 0;

  display: flex;
  flex-direction: column;

  padding-top: .4em;
}

.sncf-signage-direction-line {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .18em;

  min-width: 0;
}

.sncf-signage-direction-label {
  flex-shrink: 0;

  font-size: 2.35em;
  font-weight: 700;

  line-height: 1;
}

.sncf-signage-direction-main {
  min-width: 0;

  font-size: 3.35em;
  font-weight: 400;

  line-height: 1;

  letter-spacing: -.014em;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sncf-signage-destinations {
  margin-top: .32em;

  font-size: 3.15em;
  font-weight: 700;

  line-height: 1;

  letter-spacing: -.01em;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sncf-signage-body {
  flex: 1 1 auto;

  /*
   * max-content fait remonter jusqu'au fond du plan la largeur
   * réellement nécessaire au plus gros pôle de correspondances.
   */
  width: max-content;
  min-width: 100%;
  max-width: none;

  box-sizing: border-box;

  padding:
    .9em
    5.5em
    3em
    22em;
}

.sncf-signage-body.has-network {
  width: 100%;
  min-width: 100%;

  padding-left: 2.5em;
  padding-right: 2.5em;
}

.sncf-signage-network {
  position: relative;

  width: max-content;
  min-width: 58em;

  margin-inline: auto;

  display: flex;
  flex-direction: column;
}

.sncf-network-row {
  position: relative;

  height: 4.25em;
  min-height: 4.25em;

  width:
    var(--sncf-network-lane-area-width);
  min-width:
    var(--sncf-network-lane-area-width);

  flex: 0 0 auto;
}

.sncf-network-row.is-fork-row {
  height: 8.2em;
  min-height: 8.2em;
}

.sncf-network-lanes {
  position: absolute;
  inset: 0;

  min-height: inherit;

  pointer-events: none;
  isolation: isolate;
}

.sncf-network-urban-bubble {
  position: absolute;
  top: 0;

  width: 8.8em;
  height: 100%;

  transform: translateX(-50%);

  background: rgb(0 112 91 / 24%);
  border-radius: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  pointer-events: none;
  z-index: 0;
}

.sncf-network-urban-bubble.is-bubble-start {
  border-top-left-radius: 4.4em;
  border-top-right-radius: 4.4em;
}

.sncf-network-urban-bubble.is-bubble-end {
  border-bottom-left-radius: 4.4em;
  border-bottom-right-radius: 4.4em;
}

.sncf-network-urban-bubble.is-bubble-start.is-bubble-end {
  border-radius: 4.4em;
}

.sncf-network-lane-line,
.sncf-network-local-line {
  position: absolute;

  width: var(--sncf-rail-width);

  transform: translateX(-50%);

  /*
   * Pas d'arrondi sur chaque ligne de grille : sinon chaque arrêt
   * crée une micro-coupure visible dans le trait vertical.
   */
  border-radius: 0;

  pointer-events: none;
}

.sncf-network-lane-line {
  z-index: 0;
}

.sncf-network-local-line {
  z-index: 2;
}

.sncf-network-fork {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;

  pointer-events: none;

  z-index: 1;
}

.sncf-network-fork path {
  fill: none;

  stroke-width: var(--sncf-fork-stroke-width);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sncf-network-stop-dot {
  position: absolute;
  top: 50%;

  transform:
    translate(-50%, -50%);

  z-index: 4;
}

/*
 * Le contenu d'un arrêt est ancré à la voie à laquelle il appartient.
 * Cela permet d'avoir, sur une même ligne horizontale, un arrêt de la
 * branche A et un arrêt de la branche B sans que l'un remplace l'autre.
 */
.sncf-network-stop-main {
  position: absolute;
  top: 0;
  bottom: 0;

  /*
   * Le point et tout le contenu utilisent exactement le même centre
   * de ligne. Cela évite les petits décalages cumulés arrêt après arrêt.
   */
  transform: none;
  align-items: center;

  min-width: 0;
  max-width: none;

  box-sizing: border-box;

  padding: 0;

  z-index: 5;
}

.sncf-network-stop-main
.sncf-signage-stop-content.terminus-card {
  margin-top: 0;
  margin-bottom: 0;
}

.sncf-signage-route {
  position: relative;

  display: flex;
  flex-direction: column;

  width: max-content;
  min-width: 47em;
  max-width: none;
}

/*
 * Ligne principale plus large.
 *
 * Le centre du trait reste exactement aligné avec
 * le centre de .sncf-signage-rail-column.
 */
.sncf-signage-route::before {
  content: '';

  position: absolute;

  top: 1.05em;
  bottom: 1.05em;

  left:
    calc(
      var(--sncf-rail-center-x)
      - var(--sncf-rail-width) / 2
    );

  width: var(--sncf-rail-width);

  background:
    var(--sncf-line-color);

  border-radius: 999px;

  z-index: 0;
}

.sncf-signage-stop {
  position: relative;
  isolation: isolate;

  width: max-content;
  min-width: 100%;
  max-width: none;

  min-height: 2.8em;

  display: flex;
  align-items: center;

  cursor: default;

  border-radius: .14em;

  transition:
    background-color .12s ease;
}

.sncf-route-urban-bubble {
  position: absolute;
  top: 0;
  bottom: 0;

  left:
    calc(
      var(--sncf-rail-center-x)
      - 3.9em
    );

  width: 8.8em;

  background: rgb(0 112 91 / 24%);
  border-radius: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  pointer-events: none;
  z-index: 0;
}

.sncf-route-urban-bubble.is-bubble-start {
  border-top-left-radius: 4.4em;
  border-top-right-radius: 4.4em;
}

.sncf-route-urban-bubble.is-bubble-end {
  border-bottom-left-radius: 4.4em;
  border-bottom-right-radius: 4.4em;
}

.sncf-route-urban-bubble.is-bubble-start.is-bubble-end {
  border-radius: 4.4em;
}


.sncf-urban-bubble-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  padding: 0 .55em;

  color: rgb(205 225 227 / 74%);
  font-size: 1.75em;
  font-weight: 650;
  line-height: 1;
  letter-spacing: .01em;
  text-align: center;

  white-space: nowrap;
}

.sncf-signage-rail-column {
  position: relative;

  width: 3.65em;
  min-height: 2.8em;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 1;
}

.sncf-signage-rail {
  display: none;
}

/*
 * Changement local de ligne en signalétique SNCF :
 * - moitié basse de l'arrêt de départ ;
 * - moitié haute de l'arrêt d'arrivée.
 *
 * Les deux moitiés se rejoignent exactement entre les centres
 * des arrêts, quel que soit leur contenu ou leur hauteur.
 */
.sncf-signage-local-segment {
  position: absolute;

  left:
    calc(
      var(--sncf-rail-center-x)
      - var(--sncf-rail-width) / 2
    );
  width: var(--sncf-rail-width);

  z-index: 1;

  pointer-events: none;
}

.sncf-signage-local-segment-top {
  top: 0;
  bottom: 50%;
}

.sncf-signage-local-segment-bottom {
  top: 50%;
  bottom: 0;
}

/*
 * Points intermédiaires très discrets.
 */
.sncf-signage-dot {
  position: relative;

  width: .34em;
  height: .34em;

  flex-shrink: 0;

  border: 0;
  border-radius: 50%;

  background: #1f2f3d;

  z-index: 2;
}

.sncf-signage-dot.is-terminus {
  width: 1.6em;
  height: 1.6em;

  border:
    .28em
    solid
    white;

  background: #1f2f3d;

  box-shadow:
    0
    0
    0
    .1em
    var(--sncf-stop-line-color, var(--sncf-line-color));
}

.sncf-signage-dot.is-first {
  width: 2em;
  height: 2em;

  background:
    var(--sncf-stop-line-color, var(--sncf-line-color));

  border:
    .34em
    solid
    white;

  box-shadow:
    0
    0
    0
    .32em
    rgb(255 255 255 / 48%);
}

.sncf-signage-dot.is-last {
  width: 1.72em;
  height: 1.72em;

  border:
    .29em
    solid
    white;

  background: #1f2f3d;

  box-shadow: none;
}


.sncf-signage-stop-main {
  position: relative;

  width: max-content;
  min-width: max-content;
  max-width: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;

  flex: 0 0 auto;

  padding:
    .1em
    0;
}

.sncf-signage-stop-content {
  width: max-content;
  min-width: max-content;
  max-width: none;

  flex: 0 0 auto;

  display: inline-flex;
  flex-direction: column;
  justify-content: center;

  padding:
    .04em
    .35em
    .04em
    .55em;
}

.sncf-signage-stop-content.terminus-card {
  margin:
    .02em
    .55em
    .08em
    0;

  padding:
    .22em
    .72em
    .2em
    .72em;

  background: white;

  color: #1f2f3d;
}

/*
 * Arrêts normaux : graisse normale.
 * Seuls les terminus sont mis en valeur.
 */
.sncf-signage-stop-text-line {
  display: inline-flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: nowrap;

  min-width: 0;

  white-space: nowrap;
}

.sncf-signage-stop-name {
  font-size: 1.45em;
  font-weight: 400;

  line-height: 1.02;

  letter-spacing: -.008em;

  white-space: nowrap;
}

.sncf-signage-stop-name.is-terminus {
  font-weight: 700;
}

.sncf-signage-stop-subtitle {
  margin-left: .48em;

  font-size: 1.03em;
  font-style: italic;
  font-weight: 400;

  line-height: 1;

  opacity: .82;

  white-space: nowrap;
}

.sncf-signage-stop-content.terminus-card
.sncf-signage-stop-subtitle {
  color: #1f2f3d;
  opacity: .72;
}


.sncf-signage.is-heavy-rail-reference .sncf-network-row {
  height: 4.55em;
  min-height: 4.55em;
}

.sncf-signage.is-heavy-rail-reference .sncf-network-row.is-fork-row {
  height: 8.8em;
  min-height: 8.8em;
}

.sncf-signage.is-heavy-rail-reference .sncf-signage-route::before {
  top: .95em;
  bottom: .95em;
}

.sncf-signage.is-heavy-rail-reference .sncf-signage-dot {
  width: .42em;
  height: .42em;
}

.sncf-signage.is-heavy-rail-reference .sncf-signage-dot.is-terminus {
  width: 1.82em;
  height: 1.82em;
  border-width: .31em;
}

.sncf-signage.is-heavy-rail-reference .sncf-signage-dot.is-first {
  width: 2.2em;
  height: 2.2em;
  border-width: .36em;
}

.sncf-signage.is-heavy-rail-reference .sncf-signage-dot.is-last {
  width: 1.88em;
  height: 1.88em;
  border-width: .31em;
}

.sncf-signage.is-heavy-rail-reference .sncf-route-urban-bubble,
.sncf-signage.is-heavy-rail-reference .sncf-network-urban-bubble {
  background: rgb(12 91 86 / 34%);
}

.sncf-signage.is-heavy-rail-reference .sncf-route-urban-bubble {
  left: calc(var(--sncf-rail-center-x) - 4.65em);
  width: 10.4em;
}

.sncf-signage.is-heavy-rail-reference .sncf-network-urban-bubble {
  width: 10.4em;
}

.sncf-signage.is-heavy-rail-reference .sncf-urban-bubble-label {
  color: rgb(210 226 228 / 72%);
  font-size: 1.82em;
}

/*
 * RER — exception SNCF : pas de départ officiel forcé.
 * On conserve la présentation historique du bandeau et
 * aucune flèche n'est ajoutée sur le premier arrêt.
 */
.sncf-signage.is-rer-reference
.sncf-signage-direction-line {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: .72em;
}

.sncf-signage.is-rer-reference
.sncf-signage-direction-label {
  font-size: 2.9em;
  line-height: 1;
}

.sncf-signage.is-rer-reference
.sncf-signage-direction-main {
  font-size: 4.3em;
  line-height: .98;
}

/*
 * =========================================================
 * TRAMWAY / SNCF — FICHE VERTICALE
 * =========================================================
 */
.sncf-signage.is-tram-reference
.sncf-signage-route {
  min-width: 68em;
}

.sncf-signage.is-tram-reference
.sncf-signage-direction-line {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .18em;
}

.sncf-signage.is-tram-reference
.sncf-signage-direction-label {
  font-size: 2.35em;
  line-height: 1;
}

.sncf-signage.is-tram-reference
.sncf-signage-direction-main {
  font-size: 3.35em;
  line-height: 1;
}

.sncf-signage.is-tram-reference
.sncf-signage-stop {
  display: grid;
  grid-template-columns: 12.8em 3.85em max-content 11.5em;
  align-items: center;
  column-gap: 0;
}

.sncf-signage.is-tram-reference
.sncf-signage-rail-column {
  grid-column: 2;

  width: 3.85em;
}

/*
 * Le rail de fond doit suivre exactement le centre de la colonne
 * qui contient les points. La première colonne est réservée aux zones.
 */
.sncf-signage.is-tram-reference
.sncf-signage-route::before {
  left:
    calc(
      12.8em
      + var(--sncf-rail-center-x)
      - var(--sncf-rail-width) / 2
    );
}

.sncf-signage.is-tram-reference
.sncf-signage-stop {
  min-height: 3.15em;
}

.sncf-signage.is-tram-reference
.sncf-signage-dot:not(.is-terminus):not(.is-first):not(.is-last),
.sncf-signage.is-tram-reference
.sncf-network-stop-dot:not(.is-terminus):not(.is-first) {
  width: .92em;
  height: .92em;

  border:
    .18em
    solid
    var(--sncf-stop-line-color, var(--sncf-line-color));

  background: white;
  box-sizing: border-box;
}

.sncf-first-direction-arrow {
  position: absolute;
  top: 50%;
  left: 50%;

  width: .55em;
  height: .55em;

  border-right: .16em solid white;
  border-bottom: .16em solid white;

  transform:
    translate(-50%, -62%)
    rotate(45deg);

  pointer-events: none;
}

.sncf-tram-zone {
  position: absolute;
  top: 50%;
  right: calc(100% + .8em);

  width: 14em;

  color: rgb(255 255 255 / 72%);

  font-size: .82em;
  font-weight: 700;
  line-height: 1.05;
  text-transform: uppercase;

  pointer-events: none;
  overflow: visible;
}

.sncf-signage.is-tram-reference
.sncf-tram-zone:not(.sncf-tram-network-zone) {
  position: absolute;
  inset: 0 auto 0 0;

  width: 12.8em;
  margin: 0;

  color: rgb(255 255 255 / 78%);

  z-index: 3;
}

.sncf-tram-zone-label {
  position: absolute;
  top: var(--sncf-zone-range-mid, 50%);
  right: 1.35em;

  width: 11.5em;

  text-align: right;

  transform: translateY(-50%);

  white-space: nowrap;
}

.sncf-signage.is-tram-reference
.sncf-tram-zone:not(.sncf-tram-network-zone)
.sncf-tram-zone-label {
  right: 1.05em;
  width: 10.6em;
}

.sncf-tram-zone-range-line {
  position: absolute;
  top: var(--sncf-zone-range-start, 50%);
  right: .25em;

  width: 0;
  height: var(--sncf-zone-range-height, 0px);

  border-right: 1px solid rgb(255 255 255 / 46%);
}

.sncf-signage.is-tram-reference
.sncf-tram-zone:not(.sncf-tram-network-zone)
.sncf-tram-zone-range-line {
  right: .18em;
  border-right: 1px solid rgb(255 255 255 / 46%);
}

.sncf-tram-zone-range-line::before,
.sncf-tram-zone-range-line::after {
  content: '';

  position: absolute;
  right: 0;

  width: .9em;

  border-top: 1px solid rgb(255 255 255 / 46%);
}

.sncf-signage.is-tram-reference
.sncf-tram-zone:not(.sncf-tram-network-zone)
.sncf-tram-zone-range-line::before,
.sncf-signage.is-tram-reference
.sncf-tram-zone:not(.sncf-tram-network-zone)
.sncf-tram-zone-range-line::after {
  border-top: 1px solid rgb(255 255 255 / 46%);
}

.sncf-tram-zone-range-line::before {
  top: 0;
}

.sncf-tram-zone-range-line::after {
  bottom: 0;
}

.sncf-tram-commune {
  position: absolute;
  top: 50%;
  left: 49em;

  width: 16em;

  color: rgb(255 255 255 / 58%);

  font-size: .82em;
  font-weight: 700;
  line-height: 1;
  text-align: left;
  text-transform: uppercase;

  transform: translateY(-50%);

  white-space: nowrap;
  pointer-events: none;
}

.sncf-signage.is-tram-reference
.sncf-tram-commune:not(.sncf-tram-network-commune) {
  position: static;
  top: auto;
  left: auto;

  grid-column: 4;
  justify-self: start;
  align-self: center;

  width: 10.8em;
  margin-left: 1.05em;

  color: rgb(255 255 255 / 64%);

  transform: none;
}

.sncf-tram-network-commune {
  left: calc(100% + 1.25em);
}

.sncf-signage.is-tram-reference
.sncf-signage-route
.sncf-signage-stop-main {
  grid-column: 3;
}

/*
 * =========================================================
 * CORRESPONDANCES SNCF
 * =========================================================
 *
 * Connections.vue utilise naturellement une colonne.
 * Ici on ne change QUE ses conteneurs de layout.
 * Le contenu de ModeConnection / ServiceConnection
 * reste totalement natif.
 */

.sncf-signage-connections {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;

  flex: 0 0 auto;

  width: max-content;
  min-width: max-content;
  max-width: none;

  margin-left: 1em;

  /*
   * Agrandissement global des correspondances.
   *
   * Les composants internes utilisent l'unité em :
   * augmenter ici la taille conserve donc leurs proportions,
   * leurs pictogrammes et leur structure native.
   */
  font-size: 1.52em;

  line-height: 1;

  white-space: nowrap;

  overflow: visible;
}

/*
 * Racine réelle de Connections.vue.
 */
.sncf-signage-connections
:deep(.connections-box) {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;

  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;

  white-space: nowrap !important;

  overflow: visible !important;
}

/*
 * Le petit VerticalLine vertical utilisé sur le plan IDFM
 * n'a pas de sens ici.
 */
.sncf-signage-connections
:deep(
  .connections-box
  > .flex.flex-col.items-center.w-1em
) {
  display: none !important;
}

/*
 * Les séparateurs VerticalLine bleus appartiennent au rendu IDFM.
 *
 * Connections.vue possède un premier séparateur à la racine,
 * tandis que ModeConnection / ServiceConnection peuvent aussi
 * en contenir un dans leur propre groupe.
 *
 * En SNCF, on masque uniquement ces wrappers précis.
 */
.sncf-signage-connections
:deep(
  .connection-group
  .flex.flex-col.items-center.w-1em
) {
  display: none !important;
}

/*
 * Tous les groupes de correspondances restent
 * sur UNE SEULE ligne.
 */
.sncf-signage-connections
:deep(.connection-groups) {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  flex-wrap: nowrap !important;

  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;

  gap: 1.05em !important;

  white-space: nowrap !important;

  overflow: visible !important;
}

/*
 * Chaque groupe conserve sa structure interne native :
 * pictogramme de mode + indices + ornements.
 */
.sncf-signage-connections
:deep(.connection-group) {
  display: grid !important;

  grid-template-columns:
    auto
    1fr !important;

  align-items: center !important;

  gap: .125em !important;

  margin-top: 0 !important;

  flex: 0 0 auto !important;

  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;

  white-space: nowrap !important;

  overflow: visible !important;
}

/*
 * Racine de ModeConnection / ServiceConnection.
 *
 * On impose seulement une rangée infinie à ce niveau.
 * On ne modifie PAS les pictogrammes ni leurs dimensions.
 * C'est ce qui permet à un mégapôle comme Châtelet de garder
 * Métro 4/7/11/14 + RER + services sur la même ligne.
 */
.sncf-signage-connections
:deep(.connection-group > *) {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  flex-wrap: nowrap !important;

  flex: 0 0 auto !important;

  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;

  margin-top: 0 !important;
  margin-bottom: 0 !important;

  line-height: 1 !important;

  white-space: nowrap !important;

  overflow: visible !important;
}

/*
 * Les enfants directs de chaque groupe ne peuvent pas être
 * comprimés. Leur structure native reste néanmoins intacte.
 */
.sncf-signage-connections
:deep(.connection-group > * > *) {
  flex-shrink: 0 !important;

  align-self: center !important;

  max-width: none !important;

  margin-top: 0 !important;
  margin-bottom: 0 !important;

  vertical-align: middle !important;

  white-space: nowrap !important;
}

/*
 * Certains sous-conteneurs natifs de ModeConnection utilisent
 * leur propre alignement vertical. En SNCF on les remet tous
 * exactement au centre de la rangée afin que le pictogramme
 * de mode et les indices soient sur le même axe horizontal.
 */
.sncf-signage-connections
:deep(.connection-group > * > * > *) {
  align-self: center !important;

  margin-top: 0 !important;
  margin-bottom: 0 !important;

  vertical-align: middle !important;
}

/*
 * Les petits séparateurs bleu RATP n'appartiennent pas à la
 * signalétique SNCF.
 *
 * Leur couleur provient de --blue-ratp-paper. On les masque
 * uniquement à l'intérieur des correspondances SNCF.
 */
.sncf-signage-connections
:deep([class*="blue-ratp-paper"]) {
  display: none !important;
}

/*
 * Sécurité supplémentaire pour les VerticalLine générées
 * avec une classe de couleur utilitaire différente mais
 * conservant le wrapper étroit d'origine.
 */
.sncf-signage-connections
:deep(.connection-group [class*="w-1em"][class*="items-center"]) {
  display: none !important;
}

/*
 * Corbeille hors du flux.
 */
.sncf-signage-stop-delete {
  position: absolute;

  top: 50%;
  right: -2.4em;

  width: 1.8em;
  height: 1.8em;

  padding: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 0;
  border-radius: 50%;

  background:
    rgb(255 255 255 / 8%);

  color:
    rgb(255 255 255 / 68%);

  cursor: pointer;

  opacity: 0;

  transform:
    translateY(-50%);

  transition:
    opacity .12s ease,
    background-color .12s ease,
    color .12s ease;
}

.sncf-signage-stop:hover
.sncf-signage-stop-delete {
  opacity: 1;
}

.sncf-signage-stop-delete:hover {
  background:
    rgb(220 38 38 / 78%);

  color: white;
}

.content {
  position: relative;

  font-size: var(--font-size);
  font-family:
    var(
      --map-font-family,
      'Parisine Ptf',
      sans-serif
    );

  outline:
    1px
    solid
    var(--p-gray-200);

  box-sizing: content-box;

  overflow: hidden;

  min-width: max-content;
}

/*
 * =========================================================
 * PLAN BUS
 * =========================================================
 */

.content.bus-map {
  /*
   * Espace réservé au bandeau.
   *
   * Beaucoup plus compact que la
   * première version.
   */
  padding-top: 3.35em;

  /*
   * Le plan Bus n'a plus le panneau
   * vertical historique à gauche.
   */
  gap: 0;
}

/*
 * =========================================================
 * BANDEAU BUS
 * =========================================================
 */

.bus-header {
  position: absolute;

  top: 0;
  left: 0;
  right: 0;

  z-index: 15;

  display: flex;
  flex-direction: row;
  align-items: stretch;

  /*
   * Petit espace blanc entre les blocs,
   * comme sur la référence.
   */
  gap: .2em;

  height: 2.65em;

  padding:
    .2em
    .25em;

  box-sizing: border-box;

  /*
   * La référence possède un fond clair
   * derrière les trois blocs.
   */
  background-color: white;

  overflow: hidden;
}

/*
 * =========================================================
 * PICTOGRAMME DU MODE
 * =========================================================
 */

.bus-mode-box {
  width: 2.4em;
  height: 100%;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  padding: .35em;

  background-color: white;

  border:
    1px
    solid
    rgb(0 0 0 / 12%);

  border-radius: .32em;

  font-size: 1.25em;

  overflow: hidden;
}

.bus-mode-box :deep(svg),
.bus-mode-box :deep(img) {
  max-width: 100%;
  max-height: 100%;
}

.bus-mode-box.has-service {
  padding: .25em;
}

.bus-mode-box.wide-service {
  width: 6.4em;

  padding:
    .35em
    .45em;
}

.bus-service-icon {
  display: block;

  width: 100%;
  height: 100%;

  object-fit: contain;
  object-position: center;
}

/*
 * =========================================================
 * CARTOUCHE INDICE
 * =========================================================
 */

.bus-index-box {
  /*
   * Dimensions proches du cartouche
   * carré / rectangulaire des plans Bus.
   */
  min-width: 4em;
  height: 100%;

  padding:
    0
    .75em;

  display: flex;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  border-radius: .32em;

  flex-shrink: 0;

  white-space: nowrap;

  /*
   * Le texte est volontairement plus
   * lourd que les destinations.
   */
  font-family: inherit;

  font-size: 1.25em;
  font-weight: 800;

  line-height: 1;

  letter-spacing: -.02em;
}

/*
 * Lorsqu'un indice personnalisé possède une image,
 * elle remplace complètement le cartouche texte/couleur.
 */
.bus-index-box.has-custom-image {
  min-width: 0;
  width: auto;

  padding: 0;

  background: transparent !important;
  color: inherit;

  overflow: visible;
}

.bus-index-custom-image {
  display: block;

  width: auto;
  max-width: 6em;

  height: 100%;
  max-height: 100%;

  object-fit: contain;
  object-position: center;

  border: 0;

  background: transparent;
}

/*
 * =========================================================
 * ACCESSIBILITÉ
 * =========================================================
 */

.bus-accessibility-box {
  width: 2.4em;
  height: 100%;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  /*
   * Bleu accessibilité séparé du bandeau
   * destinations.
   */
  background-color: #1475b8;

  color: white;

  border-radius: .05em;

  font-size: 1.2em;

  line-height: 1;
}

/*
 * =========================================================
 * DESTINATIONS
 * =========================================================
 */

.bus-destinations-box {
  /*
   * Occupe tout l'espace restant.
   */
  flex: 1 1 auto;

  min-width: 20em;
  height: 100%;

  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .18em;

  padding:
    0
    1em;

  box-sizing: border-box;

  /*
   * Bleu nuit très sombre,
   * proche du bandeau de référence.
   */
  background-color: #1d3142;

  color: white;

  /*
   * Le bord est quasiment droit
   * sur le plan de référence.
   */
  border-radius: .03em;

  overflow: hidden;

  white-space: nowrap;

  font-family: inherit;

  font-size: 1.02em;

  line-height: 1;
}

.bus-destination-name {
  display: block;

  flex-shrink: 0;

  font-weight: 600;

  /*
   * Le texte du vrai bandeau est
   * moins massif que notre première version.
   */
  letter-spacing: -.01em;
}

.bus-destination-arrow {
  display: block;

  flex-shrink: 0;

  margin:
    0
    .15em;

  font-size: 1.25em;
  font-weight: 400;

  /*
   * Gris légèrement plus clair que
   * le texte des destinations.
   */
  color: rgb(255 255 255 / 78%);
}

.bus-destination-placeholder {
  font-weight: 400;

  opacity: .45;
}

/*
 * =========================================================
 * TOPOLOGIE EN MODE TRAMWAY
 * =========================================================
 *
 * Le blanc restant à gauche ne venait pas du panneau
 * d'identité lui-même, mais de l'espacement global entre
 * le panneau et la topologie, plus le padding gauche du
 * SectionsGroup.
 *
 * On compacte uniquement le layout Tram pour rapprocher
 * la ligne du panneau, sans toucher aux autres modes.
 */

.content.tram-map {
  gap: 0;
}

.tram-map .sections-group {
  margin-left: .2em;
  padding-left: .2em !important;
}

/*
 * =========================================================
 * TOPOLOGIE EN MODE BUS
 * =========================================================
 */

.bus-map .sections-group {
  /*
   * Comme le panneau latéral BULB
   * disparaît, on remet simplement
   * une petite marge à gauche.
   */
  margin-left: 1em;

  /*
   * Le padding supérieur natif du
   * SectionsGroup reste conservé pour
   * laisser la place aux noms inclinés.
   */
}

/*
 * =========================================================
 * ANNOTATIONS
 * =========================================================
 */

.annotations-layer {
  position: absolute;

  inset: 0;

  z-index: 20;

  pointer-events: none;
}

.free-annotation {
  position: absolute;

  width: max-content;

  line-height: 1.1;

  white-space: pre-wrap;

  pointer-events: auto;

  user-select: none;

  cursor: grab;

  touch-action: none;

  padding: .15em;

  border-radius: .15em;

  outline:
    1px
    dashed
    transparent;

  transition:
    outline-color
    .15s
    ease,

    background-color
    .15s
    ease;

  &:hover {
    outline-color:
      rgb(
        0
        0
        0
        / 20%
      );

    background-color:
      rgb(
        255
        255
        255
        / 70%
      );

    .annotation-delete {
      opacity: 1;

      pointer-events: auto;
    }
  }

  &.dragging {
    cursor: grabbing;

    outline-color:
      rgb(
        0
        0
        0
        / 35%
      );

    .annotation-delete {
      opacity: 0;

      pointer-events: none;
    }
  }
}

.annotation-text {
  display: block;

  width: max-content;

  max-width: 30em;

  line-height: 1.1;

  white-space: pre-wrap;

  pointer-events: none;
}

.annotation-delete {
  position: absolute;

  top: -.8rem;
  right: -.8rem;

  width: 1.35rem;
  height: 1.35rem;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border:
    1px
    solid
    var(--p-slate-300);

  border-radius: 50%;

  background-color: white;

  color:
    var(--p-red-500);

  font-size: .8rem;

  cursor: pointer;

  opacity: 0;

  pointer-events: none;

  transition:
    opacity
    .15s
    ease,

    transform
    .15s
    ease;

  &:hover {
    transform:
      scale(1.1);
  }
}

/*
 * =========================================================
 * PANNEAU D'IDENTITÉ TRAMWAY
 * =========================================================
 *
 * Ce panneau n'agit ni sur SectionsGroup, ni sur Branch,
 * ni sur les arrêts, ni sur la ligne du plan.
 */

.tram-identity-panel {
  width: 11.5em;
  min-width: 11.5em;
  min-height: inherit;

  flex-shrink: 0;

  display: flex;
  flex-direction: column;

  background-color: white;

  border-right:
    1px
    solid
    rgb(0 0 0 / 18%);

  box-sizing: border-box;
}

/*
 * =========================================================
 * EN-TÊTE ÎLE-DE-FRANCE MOBILITÉS
 * =========================================================
 */

.tram-idfm-header {
  width: 100%;
  height: 3.15em;

  flex-shrink: 0;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: .28em;

  box-sizing: border-box;

  padding:
    .48em
    .4em
    .48em
    .34em;

  background-color: #1d3142;

  color: white;
}

.tram-idfm-wordmark {
  display: flex;
  flex-direction: column;

  align-items: flex-end;
  justify-content: center;

  line-height: .82;

  white-space: nowrap;
}

.tram-idfm-main {
  font-family: inherit;

  font-size: .83em;
  font-weight: 800;

  letter-spacing: -.055em;

  color: #59b9e8;
}

.tram-idfm-sub {
  margin-top: .14em;

  font-family: inherit;

  font-size: .43em;
  font-weight: 700;

  letter-spacing: -.02em;

  color: white;
}

.tram-idfm-logo-mark {
  width: 1.45em;
  height: 1.45em;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: .25em;

  background-color: #59b9e8;

  color: white;

  font-size: .82em;
}

.tram-idfm-logo-mark > i {
  display: block;

  width: 1.05em;
  height: 1.05em;
}

/*
 * =========================================================
 * IDENTITÉ DE LA LIGNE TRAM
 * =========================================================
 *
 * Le LineIndex Tram natif contient déjà le dessin complet
 * de l'identité de ligne.
 *
 * On ne fabrique donc plus un deuxième Tram autour.
 */

.tram-identity-body {
  display: flex;
  flex-direction: column;

  align-items: flex-start;
  justify-content: center;

  width: 100%;

  flex: 1 1 auto;

  padding:
    1em
    .9em
    1em
    1.35em;

  box-sizing: border-box;
}

.tram-mode-index {
  width: auto;
  max-width: 100%;

  display: flex;
  flex-direction: row;

  align-items: center;
  justify-content: flex-start;

  gap: .65em;
}

.tram-mode {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 3.6em;

  line-height: 1;

  flex-shrink: 0;
}

.tram-mode :deep(svg),
.tram-mode :deep(img) {
  display: block;

  max-width: 1em;
  max-height: 1em;
}

.tram-service-icon {
  display: block;

  width: 1em;
  height: 1em;

  object-fit: contain;
  object-position: center;
}

.tram-native-index {
  width: auto;

  display: flex;
  align-items: center;
  justify-content: center;

  flex: 0 0 auto;

  font-size: 1em;

  line-height: 1;

  margin-left: 0;
}

.tram-native-index :deep(> div) {
  display: flex;

  align-items: center;
  justify-content: center;

  width: auto;

  /*
   * Même grande échelle pour les indices officiels
   * et pour les CustomLineIndex.
   * La largeur intrinsèque évite tout chevauchement
   * avec le pictogramme de mode.
   */
  font-size: 3.6em;
}

.tram-native-index :deep(img),
.tram-native-index :deep(svg) {
  display: block;

  /*
   * 1em relatif au LineIndex ci-dessus = 2.2em visuels.
   * Les indices Tram natifs conservent donc leur taille
   * historique, sans double agrandissement.
   */
  width: 1em;
  height: 1em;

  max-width: none;
  max-height: none;

  object-fit: contain;
}

.tram-project-info {
  margin: 0 .65em .65em;
  font-size: .25em;
  line-height: 1.75;
}

.line-identity-panel {
  transition:
    margin-left .12s ease,
    margin-right .12s ease;
}

.classic-line-identities {
  flex-wrap: nowrap;
}

.classic-line-mode-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: .3em;

  flex-shrink: 0;
  width: max-content;
  min-width: max-content;
}

.classic-line-indices {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: 0.05mm;

  /*
   * Ne jamais autoriser les indices d'une même identité à passer
   * à la ligne pendant l'export PNG.
   *
   * html/canvas calcule parfois la largeur min-content d'un flex
   * différemment du navigateur vivant ; avec flex-wrap: wrap,
   * l'indice 19 pouvait donc tomber sous le 18 et chevaucher le
   * bloc accessibilité.
   */
  flex-wrap: nowrap;
  width: max-content;
  min-width: max-content;
}

.classic-service-icon {
  display: block;

  width: auto;
  height: 1em;

  max-width: 2.4em;
  max-height: 1em;

  flex-shrink: 0;

  object-fit: contain;
  object-position: center;
}

.classic-line-mode-group :deep(svg),
.classic-line-mode-group :deep(img) {
  display: block;
}

/*
 * =========================================================
 * FINITIONS PRÉVISUALISATION SNCF
 * =========================================================
 *
 * Les règles génériques de .sncf-signage-stop-main sont
 * déclarées après celles du réseau à branches. Elles pouvaient
 * donc remettre le contenu en position relative et créer un
 * léger décalage vertical par rapport au point de station.
 *
 * Dans le réseau SNCF, le point ET tout le bloc de l'arrêt
 * utilisent maintenant strictement le même centre de ligne.
 */
.sncf-signage-network .sncf-network-stop-main {
  position: absolute;

  top: 50%;
  bottom: auto;

  transform: translateY(-50%);

  display: flex;
  flex-direction: row;
  align-items: center;

  padding: 0;
  margin: 0;
}

.sncf-signage-network
.sncf-network-stop-main
.sncf-signage-stop-content {
  margin-top: 0;
  margin-bottom: 0;
}

/*
 * .sncf-signage-dot est déclaré plus bas dans la feuille avec
 * position: relative. Sans cette règle plus spécifique, il écrasait
 * le position:absolute du réseau : les points glissaient vers le bas
 * et n'étaient plus en face de leur nom d'arrêt.
 */
.sncf-signage-network .sncf-network-stop-dot {
  position: absolute;
  top: 50%;

  margin: 0;

  transform:
    translate(-50%, -50%);
}

/*
 * En signalétique SNCF, les éléments de correspondance qui
 * utilisent normalement le bleu RATP doivent rester lisibles
 * sur le fond bleu foncé : pictogramme piéton et libellés de
 * liaison (Auber, Nanterre Préfecture, etc.) passent en blanc.
 */
.sncf-signage-connections :deep(.pedestrian) {
  background-color: #fff !important;
}

.sncf-signage-connections :deep(.text-ornament),
.sncf-signage-connections :deep(.transfer-duration) {
  color: #fff !important;
}

.legal-notice {
  writing-mode: vertical-rl;
}
</style>
