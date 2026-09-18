<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { useDateFormat } from '@vueuse/shared'
import { storeToRefs } from 'pinia'
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
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useProject } from '~/stores/useProject'
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

const { applicationVersion } = useVersion()

const {
  line,
  outdated,
  presetBased,
} = storeToRefs(useProject())

type SignageStyle =
  | 'IDFM'
  | 'SNCF'

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

const signageStyle =
  computed<SignageStyle>(() =>
    (
      line.value as Line & {
        signageStyle?: SignageStyle
      }
    ).signageStyle
    ?? 'IDFM',
  )

const isSncfSignage =
  computed(() =>
    signageStyle.value === 'SNCF',
  )

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

  window.addEventListener(
    'resize',
    scheduleClassicIdentityCollision,
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

  window.removeEventListener(
    'resize',
    scheduleClassicIdentityCollision,
  )
})

watch(
  () => line.value.topology,
  async () => {
    await nextTick()
    reconnectClassicIdentityObservers()
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
    /*
     * Branche classique.
     */
    if (isBranch(element)) {
      stops.push(
        ...element
          .$branch
          .elements
          .filter(isStop),
      )

      continue
    }

    /*
     * Fourche autonome.
     *
     * En signalétique SNCF on ne réutilise pas la géométrie
     * horizontale de Fork.vue, mais ses deux sections de sortie
     * doivent quand même rester présentes dans la desserte.
     */
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

    /*
     * Branches parallèles.
     *
     * Conservé pour les anciens projets utilisant encore
     * Fork + ParallelBranches.
     */
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
     * Segment vertical.
     */
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

    /*
     * Boucle avec arrêt.
     */
    if (isLoop(element)) {
      const loopStop =
        element
          .$loop
          .stop

      if (
        loopStop !== undefined
      ) {
        stops.push(
          loopStop,
        )
      }
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
 * - le multi-ligne n'est pas rendu ici.
 */

const sncfStops =
  computed(() =>
    uniqueStops(
      mapStops.value,
    ),
  )

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
      : 'Destination',
  )

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
    v-if="isSncfSignage"
    class="sncf-signage"
    :style="{
      '--sncf-line-color':
        line.color ?? '#ffcd00',
    }"
  >
    <div class="sncf-signage-header">
      <div class="sncf-signage-identity">
        <img
          v-if="transportServiceIcon"
          :src="transportServiceIcon"
          class="sncf-signage-service-icon"
          alt=""
          aria-hidden="true"
        >

        <Mode
          v-else
          plain
          :mode="line.mode"
          class="sncf-signage-mode"
        />

        <LineIndex
          :mode="line.mode"
          :index="line.index"
          class="sncf-signage-index"
        />
      </div>

      <div class="sncf-signage-direction">
        <div class="sncf-signage-direction-line">
          <span class="sncf-signage-direction-label">
            vers
          </span>

          <span class="sncf-signage-direction-main">
            {{ sncfDestinations[0] || 'Destination' }}
          </span>
        </div>

        <div
          v-if="sncfDestinations.length > 1"
          class="sncf-signage-destinations"
        >
          {{ sncfDestinationText }}
        </div>
      </div>
    </div>

    <div class="sncf-signage-body">
      <div class="sncf-signage-route">
        <div
          v-for="(stop, index) in sncfStops"
          :key="stop.id"
          class="sncf-signage-stop"
          :class="{
            'is-first':
              isSncfFirstStop(index),
            'is-last':
              isSncfLastStop(index),
            'is-terminus':
              stop.$stop.terminus,
          }"
          @click="openSncfStopProperties(stop)"
        >
          <div class="sncf-signage-rail-column">
            <div
              v-if="index > 0"
              class="sncf-signage-rail sncf-signage-rail-top"
              :style="{
                backgroundColor:
                  line.color ?? '#ffffff',
              }"
            />

            <div
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
                '--sncf-line-color':
                  line.color ?? '#ffffff',
              }"
            />

            <div
              v-if="
                index
                < sncfStops.length - 1
              "
              class="sncf-signage-rail sncf-signage-rail-bottom"
              :style="{
                backgroundColor:
                  line.color ?? '#ffffff',
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
                    || stop.$stop.placeName
                  "
                  class="sncf-signage-stop-subtitle"
                >
                  {{
                    stop.$stop.subtitle
                    || stop.$stop.placeName
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

            <button
              type="button"
              class="sncf-signage-stop-delete export-hide"
              :title="$t('ui.map_editor.delete_stop')"
              @click.stop="deleteSncfStop(stop)"
            >
              <i class="i-tabler-trash" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <StopPropertiesDialog
      v-if="
        selectedSncfStop
        && selectedSncfBranch
      "
      v-model:visible="
        sncfStopPropertiesVisible
      "
      v-model="selectedSncfStop"
      :allow-city="
        line.frameTerminusNames
      "
      :branch="
        selectedSncfBranch
      "
      @open-connections="
        sncfConnectionsVisible = true
      "
    />

    <ConnectionsEditor
      v-if="
        selectedSncfStop
        && selectedSncfBranch
      "
      v-model:visible="
        sncfConnectionsVisible
      "
      v-model:stop="
        selectedSncfStop
      "
      :branch="
        selectedSncfBranch
      "
    />
  </div>

  <div
    v-else
    ref="content"
    v-bind="$attrs"
    class="relative content bg-white flex gap-10 flex-row"
    :class="{
      'bus-map': isBusMode,
    }"
    :style="contentAdaptiveStyle"
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
          Destinations
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
      https://useclu.pro ° Créateur de lignes urbaines ° {{ date }}
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
          title="Supprimer l'annotation"
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
          Non affilié à la RATP, à Île-de-France Mobilités ou à toute autre société. Les pictogrammes ainsi que les polices utilisés demeurent la propriété intellectuelle exclusive des entités susmentionnées.
        </span>

        <span
          class="italic text-.75em"
        >
          Not affiliated with RATP, Île-de-France Mobilités or any other company. The pictograms and fonts used remain the exclusive intellectual property of the aforementioned entities.
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
    'Parisine Ptf',
    Arial,
    Helvetica,
    sans-serif;

  outline:
    1px
    solid
    var(--p-gray-200);
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
  display: flex;
  align-items: baseline;
  gap: .72em;

  min-width: 0;
}

.sncf-signage-direction-label {
  flex-shrink: 0;

  font-size: 2.9em;
  font-weight: 700;

  line-height: 1;
}

.sncf-signage-direction-main {
  min-width: 0;

  font-size: 4.3em;
  font-weight: 400;

  line-height: .98;

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

  left: 1.2em;

  width: 1.25em;

  background:
    var(--sncf-line-color);

  border-radius: 999px;

  z-index: 0;
}

.sncf-signage-stop {
  position: relative;

  width: max-content;
  min-width: 100%;
  max-width: none;

  min-height: 2.8em;

  display: flex;
  align-items: center;

  cursor: pointer;

  border-radius: .14em;

  transition:
    background-color .12s ease;
}

.sncf-signage-stop:hover {
  background:
    rgb(255 255 255 / 4%);
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
    var(--sncf-line-color);
}

.sncf-signage-dot.is-first {
  width: 2em;
  height: 2em;

  background:
    var(--sncf-line-color);

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
    'Parisine Ptf',
    sans-serif;

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

  font-size: 1.15em;

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
  font-family:
    Arial,
    Helvetica,
    sans-serif;

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

  font-family:
    Arial,
    Helvetica,
    sans-serif;

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
  width: 8.5em;
  min-width: 8.5em;
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
    .48em;

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
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: .83em;
  font-weight: 800;

  letter-spacing: -.055em;

  color: #59b9e8;
}

.tram-idfm-sub {
  margin-top: .14em;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

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

  align-items: center;
  justify-content: center;

  width: 100%;

  flex: 1 1 auto;

  padding:
    1em
    .72em;

  box-sizing: border-box;
}

.tram-mode-index {
  width: 100%;

  display: flex;
  flex-direction: row;

  align-items: center;
  justify-content: center;

  gap: .7em;
}

.tram-mode {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 2.2em;

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
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 1em;

  line-height: 1;

  margin-left: -2.45em;
}

.tram-native-index :deep(> div) {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 100%;
}

.tram-native-index :deep(img),
.tram-native-index :deep(svg) {
  display: block;

  width: 2.2em;
  height: 2.2em;

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

.legal-notice {
  writing-mode: vertical-rl;
}
</style>
