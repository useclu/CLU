<script setup lang="ts">
import { useCssVar } from '@vueuse/core'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import leftArrow from '~/assets/svg/left-arrow.svg'
import rightArrow from '~/assets/svg/right-arrow.svg'
import { useProject } from '~/stores/useProject'
import { LineContextKey } from '~/utils/symbols'

const {
  meta,
  overlayOffsetPx = 0,
  overlayCompensationPx = 0,
} = defineProps<{
  meta: Fork
  overlayOffsetPx?: number
  overlayCompensationPx?: number
}>()

const emit = defineEmits<{
  extentChange: [width: number]
  clearanceChange: [
    up: number,
    down: number,
  ]
}>()

const el = ref()

const sizeFactor = computed(() =>
  Number.parseInt(
    useCssVar('--base-size', el).value ?? '1',
  ),
)

const CLEARANCE = 48

const size = computed(() => 16 * sizeFactor.value)
const slopeWidth = computed(() => size.value * 4.75)

/*
 * Les LineSection déplacent leurs niveaux avec 2.75em.
 * Il faut donc utiliser ici la taille réelle du "em" du plan
 * pour la géométrie verticale de la fourche.
 *
 * --base-size reste utilisé pour la géométrie horizontale
 * historique de la fourche.
 */
const emSize = computed(() => {
  const value = Number.parseFloat(
    useCssVar('--font-size', el).value ?? '',
  )

  return Number.isFinite(value) && value > 0
    ? value
    : 16
})

const lineContext = inject<LineContext>(LineContextKey)!
const project = useProject()

const getParallelBranchesForFork =
  inject<
    (
      forkId: string,
    ) => ParallelBranches | null
  >(
    'parallelBranchesForFork',
    () => null,
  )

const pairedParallelBranches =
  computed(() =>
    getParallelBranchesForFork(
      meta.id,
    ),
  )

const outputSections =
  computed<LineSection[] | null>(() =>
    pairedParallelBranches.value
      ?.$parallelBranches
      .sections
    ?? meta.$fork.sections
    ?? null,
  )

const hasExternalParallelBranches =
  computed(() =>
    pairedParallelBranches.value
    !== null,
  )

/*
 * Identifiant DOM uniquement utilisé pour relier proprement la Fork
 * à son vrai ParallelBranches sibling lors des mesures de rendu.
 *
 * Rien n'est persisté ici : la source de vérité reste
 * $fork.parallelBranchesId / $parallelBranches.forkId.
 */
const pairedParallelBranchesId =
  computed(() =>
    pairedParallelBranches.value?.id
    ?? null,
  )


interface ForkCorridorContext {
  sourceBranchId: string | null
  primaryVisible: boolean
  additionalLines: BranchAdditionalLine[]
  primaryLineGapEm: number
}

type ForkOutputBranchData = Branch['$branch'] & {
  passthroughLineIds?: string[]
}

const getForkCorridorContext =
  inject<
    (
      elementId: string,
    ) => ForkCorridorContext | null
  >(
    'forkCorridorContextForElement',
    () => null,
  )

const forkCorridorContext =
  computed(() =>
    getForkCorridorContext(
      meta.id,
    ),
  )

interface ForkOverlayPeerGeometry {
  id: string
  lineId: string
  originOffset: number
  linksOffset: [number, number]
  offsetMultiplier: number
}

const getForkOverlayPeer =
  inject<
    (
      elementId: string,
    ) => ForkOverlayPeerGeometry | null
  >(
    'forkOverlayPeerForElement',
    () => null,
  )

const forkOverlayPeer =
  computed(() =>
    getForkOverlayPeer(
      meta.id,
    ),
  )

/*
 * Ligne réellement bifurquée.
 *
 * "primary" reste la valeur par défaut pour les anciens projets.
 */
const targetLineId = computed(() =>
  meta.$fork.lineId || 'primary',
)


const hasNonTargetCorridorLine =
  computed(() => {
    const context =
      forkCorridorContext.value

    if (!context) {
      return false
    }

    const ids = [
      ...(context.primaryVisible
        ? ['primary']
        : []),

      ...context.additionalLines.map(
        line => line.id,
      ),
    ]

    return ids.some(
      lineId =>
        lineId !== targetLineId.value,
    )
  })

const targetAdditionalLine = computed(() => {
  if (targetLineId.value === 'primary') {
    return null
  }

  /*
   * Priorité au contexte LOGIQUE de la Section courante :
   * une ligne cochée sur Vigneux est disponible pour la Fork
   * même si elle n'est pas encore dessinée comme rail complet.
   */
  const localLine =
    forkCorridorContext.value
      ?.additionalLines
      .find(
        line =>
          line.id === targetLineId.value,
      )

  if (localLine) {
    return localLine
  }

  /*
   * Fallback pour anciens projets / anciennes structures.
   */
  let found: BranchAdditionalLine | null = null

  function scanSection(section: any) {
    const elements =
      section?.$lineSection?.elements
      ?? section?.elements
      ?? []

    for (const element of elements) {
      if (!element || typeof element !== 'object') {
        continue
      }

      if ('$branch' in element) {
        const match =
          element.$branch.additionalLines?.find(
            (branchLine: BranchAdditionalLine) =>
              branchLine.id === targetLineId.value,
          )

        if (match) {
          found = match
          return
        }
      }

      if ('$parallelBranches' in element) {
        for (
          const child
          of element.$parallelBranches.sections ?? []
        ) {
          scanSection(child)

          if (found) {
            return
          }
        }
      }

      if ('$fork' in element) {
        for (
          const child
          of element.$fork.sections ?? []
        ) {
          scanSection(child)

          if (found) {
            return
          }
        }
      }
    }
  }

  for (const section of project.line.topology ?? []) {
    scanSection(section)

    if (found) {
      break
    }
  }

  return found
})

const color = computed(() =>
  targetLineId.value === 'primary'
    ? (lineContext?.color.value ?? '#000000')
    : (
        targetAdditionalLine.value?.color
        || lineContext?.color.value
        || '#000000'
      ),
)

const lineWidth = computed(() => {
  const value = Number(lineContext.lineThickness.value)
  const safeValue =
    Number.isFinite(value) && value > 0
      ? value
      : 0.375

  /*
   * Branch.vue réduit déjà l'épaisseur visuelle du Tram à 55 %
   * de lineThickness afin que le rendu STRIPED garde les bonnes
   * proportions. La Fork doit utiliser exactement la même règle,
   * sinon elle apparaît plus épaisse que les branches droites.
   */
  if (project.line.mode === 'TRAM') {
    return Math.max(
      0.18,
      safeValue * 0.55,
    )
  }

  return safeValue
})

/*
 * Branch.vue exprime son corridor vertical avec :
 *
 *   sizeFactor * 16
 *
 * alors que le tracé de Fork.vue utilise le vrai em CSS du plan.
 *
 * Cette conversion est indispensable dès qu'on compare un déplacement
 * de Fork avec primaryLineGap de Branch.vue.
 */
const branchHistoricalEmPx =
  computed(() =>
    Math.max(
      0.001,
      sizeFactor.value * 16,
    ),
  )

const forkToBranchVerticalRatio =
  computed(() =>
    Math.max(
      0.001,
      emSize.value
      / branchHistoricalEmPx.value,
    ),
  )

const branchLineWidthEm =
  computed(() =>
    lineWidth.value,
  )

/*
 * L'épaisseur visuelle ne doit pas multiplier toute la géométrie de la fourche.
 * On ajoute seulement l'espace réellement nécessaire au trait plus épais.
 */
const strokeExtra = computed(() =>
  Math.max(0, lineWidth.value - 0.375) * size.value,
)

const effectiveClearance = computed(() =>
  CLEARANCE * sizeFactor.value
  + size.value
  + strokeExtra.value,
)

const forkStyle = computed<ForkStyle>(() =>
  meta.$fork.forkStyle ?? 'ORIGINAL',
)


/*
 * Écart automatique entre les deux sorties d'une Fork.
 *
 * La valeur est purement visuelle : elle ne modifie pas
 * meta.$fork.linksOffset dans les données du projet.
 */
const autoExtraOutputLevels = ref(0)

const effectiveLinksOffsets = computed<
  [number, number]
>(() => {
  const base: [number, number] = [
    meta.$fork.linksOffset[0],
    meta.$fork.linksOffset[1],
  ]

  /*
   * FOURCHE D'ORIGINE :
   *
   * Dans un corridor D + S, on ne compresse plus la forme,
   * on ne la transforme plus et on ne crée aucun effet tunnel.
   *
   * [1, -1] reste donc exactement une vraie fourche symétrique.
   *
   * L'espace nécessaire entre D et S est désormais fourni par
   * Branch.vue en abaissant la ligne secondaire entière.
   */
  if (hasNonTargetCorridorLine.value) {
    return base
  }

  /*
   * Hors corridor multi-lignes, on conserve le clearance
   * automatique historique.
   */
  const extra =
    Math.max(
      0,
      autoExtraOutputLevels.value,
    )

  if (extra <= 0) {
    return base
  }

  const origin =
    meta.$fork.originOffset

  const topIndex: 0 | 1 =
    base[0] >= base[1]
      ? 0
      : 1

  const bottomIndex: 0 | 1 =
    topIndex === 0
      ? 1
      : 0

  const result: [number, number] =
    [...base] as [number, number]

  if (
    base[bottomIndex] === origin
    && base[topIndex] !== origin
  ) {
    result[topIndex] += extra
    return result
  }

  if (
    base[topIndex] === origin
    && base[bottomIndex] !== origin
  ) {
    result[bottomIndex] -= extra
    return result
  }

  result[topIndex] += extra / 2
  result[bottomIndex] -= extra / 2

  return result
})

const forkIntrinsicClearance = computed(() => {
  const highest =
    Math.max(
      ...effectiveLinksOffsets.value,
    )

  const lowest =
    Math.min(
      ...effectiveLinksOffsets.value,
    )

  const multiplier =
    meta.$fork.offsetMultiplier ?? 1

  return {
    up:
      Math.max(
        0,
        highest - meta.$fork.originOffset,
      )
      * 2.75
      * multiplier,

    down:
      Math.max(
        0,
        meta.$fork.originOffset - lowest,
      )
      * 2.75
      * multiplier,
  }
})

watch(
  forkIntrinsicClearance,
  (clearance) => {
    emit(
      'clearanceChange',
      clearance.up,
      clearance.down,
    )
  },
  {
    immediate: true,
  },
)

const maxHeight = computed(() => {
  return (
    (meta.$fork.offsetMultiplier ?? 1)
    * Math.max(
      Math.abs(effectiveLinksOffsets.value[0]),
      Math.abs(effectiveLinksOffsets.value[1]),
    )
    * 2
    * 2.75
    * emSize.value
    + (size.value * lineWidth.value)
  )
})

const normalWidth = computed(() =>
  slopeWidth.value
  * (meta.$fork.offsetMultiplier ?? 1)
  + effectiveClearance.value * 2,
)

const orientation = computed(() => {
  switch (meta.$fork.toward) {
    case 'LEFT':
      return [
        normalWidth.value,
        0,
        -1,
      ]

    case 'RIGHT':
      return [
        0,
        normalWidth.value,
        1,
      ]

    default:
      return [
        0,
        0,
        0,
      ]
  }
})

/*
 * Le repère vertical de la fourche est toujours verrouillé
 * sur la ligne droite d'origine.
 *
 * Ainsi, changer la forme (symétrique / vers le haut /
 * vers le bas) ne déplace jamais la ligne principale :
 * seules les deux branches changent de niveau.
 */
const offset = computed(() =>
  meta.$fork.originOffset,
)

/*
 * =========================================================
 * ANCRAGE MULTI-LIGNES DE LA FORK
 * =========================================================
 *
 * Le placement persistant reste logique via $fork.lineId.
 *
 * Pour le RENDU seulement, on mesure le vrai rail exposé par
 * Branch.vue avec data-line-id. Cela évite de recalculer ici
 * l'espacement D/S (qui peut varier à cause des noms et des
 * correspondances).
 */
const targetRailOffsetPx = ref(0)

const forkOutputOffsetsPx = ref<[number, number]>([
  0,
  0,
])


/*
 * =========================================================
 * ESPACEMENT HORIZONTAL DES CONTENUS DES DEUX SORTIES
 * =========================================================
 *
 * IMPORTANT :
 * - ne change PAS la forme de la Fork ;
 * - ne change PAS linksOffset ;
 * - ne change PAS la hauteur des deux rails ;
 * - ne change PAS D/S ;
 * - ne persiste aucun pixel.
 *
 * Quand des arrêts placés sur les deux sorties tombent au même X,
 * leurs noms / correspondances peuvent se chevaucher dans l'espace
 * entre les deux branches.
 *
 * On décale alors uniquement le CONTENU de la sortie basse vers la
 * droite. Le rail de Branch s'allonge naturellement avec le contenu.
 */
const forkOutputContentOffsetPx =
  ref<[number, number]>([
    0,
    0,
  ])


interface PassThroughRail {
  id: string
  path: string
  color: string
}

const passThroughRails =
  ref<PassThroughRail[]>([])

/*
 * Gap interne de la Branch de sortie.
 *
 * Si D descend de F em pendant que S continue tout droit :
 *
 *   gap_sortie = gap_entree - F
 *
 * Ainsi :
 *
 *   Y(S avant Fork) === Y(S après Fork)
 *
 * C'est calculé uniquement depuis la topologie persistée.
 */
function outputCarriesPassThrough(
  outputIndex: 0 | 1,
) {
  const context =
    forkCorridorContext.value

  if (!context) {
    return false
  }

  const inputIds = [
    ...(context.primaryVisible
      ? ['primary']
      : []),

    ...context.additionalLines.map(
      line => line.id,
    ),
  ]

  const targetRank =
    inputIds.indexOf(
      targetLineId.value,
    )

  if (targetRank < 0) {
    return false
  }

  const topOutputIndex: 0 | 1 =
    meta.$fork.linksOffset[0]
      >= meta.$fork.linksOffset[1]
      ? 0
      : 1

  const bottomOutputIndex: 0 | 1 =
    topOutputIndex === 0
      ? 1
      : 0

  return inputIds.some(
    (lineId, lineIndex) => {
      if (
        lineId === targetLineId.value
      ) {
        return false
      }

      const destination =
        lineIndex < targetRank
          ? topOutputIndex
          : bottomOutputIndex

      return destination === outputIndex
    },
  )
}

/*
 * Écart D/S réellement rendu dans la Branch située AVANT cette Fork.
 *
 * Pourquoi ne pas utiliser uniquement context.primaryLineGapEm ?
 * Cette valeur vient de SectionEditor et décrit surtout l'emprise
 * structurelle de la Section. Elle n'est pas forcément égale à l'écart
 * final calculé par Branch.vue après minimumLineGap + déplacement Fork.
 *
 * Quand offsetMultiplier grandit, utiliser cette valeur théorique peut
 * donc faire remonter uniquement le tronçon S de la sortie.
 *
 * Branch.vue expose déjà chaque rail dans un <g data-line-id> dont le
 * translateY est exprimé dans les unités SVG historiques
 * (sizeFactor * 16 par em). On peut donc relire l'écart FINAL sans
 * dépendre du zoom de la preview ni persister le moindre pixel.
 */
const renderedSourcePrimaryLineGapEm =
  ref<number | null>(null)

/*
 * =========================================================
 * BRANCHES INTÉRIEURES D/S : ADAPTATION RÉELLE
 * =========================================================
 *
 * Important :
 * - le corridor D/S AVANT la Fork ne bouge jamais ;
 * - forkIntrinsicClearance reste basé sur linksOffset d'origine ;
 * - SectionEditor / Branch gardent donc exactement leur hauteur actuelle ;
 * - on adapte uniquement le rendu des deux branches qui se font face.
 *
 * Le calcul travaille dans l'unité de Branch.vue :
 * primaryLineGap est un espace LIBRE entre les deux traits.
 */
function inwardDelta(
  lineId: string,
  originOffset: number,
  linksOffset: [number, number],
) {
  const deltas =
    linksOffset.map(
      value =>
        value - originOffset,
    )

  const inward =
    lineId === 'primary'
      ? deltas.filter(
          delta => delta < 0,
        )
      : deltas.filter(
          delta => delta > 0,
        )

  if (inward.length === 0) {
    return 0
  }

  return Math.max(
    ...inward.map(
      delta =>
        Math.abs(delta),
    ),
  )
}

const adaptiveInnerScale =
  computed(() => {
    const context =
      forkCorridorContext.value

    const peer =
      forkOverlayPeer.value

    const sourceFreeGap =
      renderedSourcePrimaryLineGapEm.value

    if (
      !context
      || !peer
      || sourceFreeGap === null
      || !context.primaryVisible
      || context.additionalLines.length !== 1
    ) {
      return 1
    }

    const secondaryId =
      context.additionalLines[0]?.id

    if (!secondaryId) {
      return 1
    }

    const currentLineId =
      targetLineId.value

    const peerLineId =
      peer.lineId

    const isPrimarySecondaryPair =
      (
        currentLineId === 'primary'
        && peerLineId === secondaryId
      )
      || (
        currentLineId === secondaryId
        && peerLineId === 'primary'
      )

    if (!isPrimarySecondaryPair) {
      return 1
    }

    const currentDesired =
      inwardDelta(
        currentLineId,
        meta.$fork.originOffset,
        [
          effectiveLinksOffsets.value[0],
          effectiveLinksOffsets.value[1],
        ],
      )
      * 2.75
      * Math.max(
        0,
        meta.$fork.offsetMultiplier
        ?? 1,
      )
      * forkToBranchVerticalRatio.value

    const peerDesired =
      inwardDelta(
        peerLineId,
        peer.originOffset,
        peer.linksOffset,
      )
      * 2.75
      * Math.max(
        0,
        peer.offsetMultiplier,
      )
      * forkToBranchVerticalRatio.value

    const totalDesired =
      currentDesired
      + peerDesired

    if (totalDesired <= 0) {
      return 1
    }

    /*
     * On conserve la même respiration de 0.68em déjà utilisée dans
     * SectionEditor / Branch pour les Fork.
     *
     * primaryLineGap est déjà l'espace LIBRE entre les traits :
     * il n'y a donc pas à retrancher une deuxième fois leur épaisseur.
     */
    const availableMovement =
      Math.max(
        0,
        sourceFreeGap - 0.68,
      )

    return Math.min(
      1,
      Math.max(
        0,
        availableMovement
        / totalDesired,
      ),
    )
  })

const renderedLinksOffsets =
  computed<[number, number]>(() => {
    const result: [number, number] = [
      effectiveLinksOffsets.value[0],
      effectiveLinksOffsets.value[1],
    ]

    const scale =
      adaptiveInnerScale.value

    if (scale >= 0.9999) {
      return result
    }

    const origin =
      meta.$fork.originOffset

    for (
      const index
      of [0, 1] as const
    ) {
      const delta =
        result[index] - origin

      const isInward =
        targetLineId.value === 'primary'
          ? delta < 0
          : delta > 0

      if (!isInward) {
        continue
      }

      result[index] =
        origin
        + delta * scale
    }

    return result
  })

function railTranslateY(
  rail: SVGGElement,
): number | null {
  const consolidated =
    rail.transform
      ?.baseVal
      ?.consolidate()

  const matrixY =
    consolidated?.matrix?.f

  if (
    typeof matrixY === 'number'
    && Number.isFinite(matrixY)
  ) {
    return matrixY
  }

  /*
   * Fallback très simple pour les navigateurs où consolidate()
   * n'est pas disponible au moment exact de la mesure.
   *
   * Branch.vue écrit actuellement :
   *   translate(0 <y>)
   */
  const transform =
    rail.getAttribute('transform')
    ?? ''

  const match =
    transform.match(
      /translate\(\s*[-+.\deE]+\s*(?:,|\s)\s*([-+.\deE]+)/,
    )

  if (!match) {
    return null
  }

  const value =
    Number.parseFloat(match[1])

  return Number.isFinite(value)
    ? value
    : null
}

function measureRenderedSourcePrimaryLineGapEm():
  number | null {
  if (
    typeof document === 'undefined'
  ) {
    return null
  }

  const context =
    forkCorridorContext.value

  const sourceBranchId =
    context?.sourceBranchId

  const secondaryLineId =
    context?.additionalLines[0]?.id

  if (
    !sourceBranchId
    || !secondaryLineId
  ) {
    return null
  }

  const sourceBranch =
    document.querySelector<HTMLElement>(
      `.branch-wrapper[data-branch-id="${CSS.escape(sourceBranchId)}"]`,
    )

  if (!sourceBranch) {
    return null
  }

  const primaryRail =
    sourceBranch.querySelector<SVGGElement>(
      '.line > svg [data-line-id="primary"]',
    )

  const secondaryRail =
    sourceBranch.querySelector<SVGGElement>(
      `.line > svg [data-line-id="${CSS.escape(secondaryLineId)}"]`,
    )

  if (
    !primaryRail
    || !secondaryRail
  ) {
    return null
  }

  const primaryY =
    railTranslateY(primaryRail)

  const secondaryY =
    railTranslateY(secondaryRail)

  if (
    primaryY === null
    || secondaryY === null
  ) {
    return null
  }

  const unitsPerEm =
    Math.max(
      0.001,
      sizeFactor.value * 16,
    )

  const centerDistanceEm =
    Math.abs(
      secondaryY - primaryY,
    )
    / unitsPerEm

  /*
   * primaryLineGap représente l'espace LIBRE entre les deux traits,
   * tandis que les translateY donnent la distance entre leurs centres.
   *
   * Même règle que Branch.vue pour le Tram horizontal / classique.
   */
  return Math.max(
    0,
    centerDistanceEm
    - branchLineWidthEm.value,
  )
}

function updateRenderedSourcePrimaryLineGap() {
  const measured =
    measureRenderedSourcePrimaryLineGapEm()

  if (measured === null) {
    return
  }

  if (
    renderedSourcePrimaryLineGapEm.value
      === null
    || Math.abs(
      renderedSourcePrimaryLineGapEm.value
      - measured,
    ) > 0.02
  ) {
    renderedSourcePrimaryLineGapEm.value =
      measured
  }
}

function outputPrimaryLineGapForIndex(
  outputIndex: 0 | 1,
) {
  const context =
    forkCorridorContext.value

  if (
    !context
    || !outputCarriesPassThrough(
      outputIndex,
    )
  ) {
    return 0
  }

  const multiplier =
    Math.max(
      0,
      meta.$fork.offsetMultiplier
      ?? 1,
    )

  /*
   * La sortie doit partir de l'écart D/S RÉEL du corridor d'entrée.
   *
   * Exemple Fork D :
   * - D descend de F em dans la sortie basse ;
   * - S traverse tout droit ;
   * - le gap interne de la Branch enfant devient :
   *
   *     gap_source_réel - F
   *
   * Ainsi augmenter le multiplicateur agrandit la Fork sans faire
   * remonter seulement le petit tronçon S de la sortie.
   */
  const targetMovementEm =
    Math.abs(
      renderedLinksOffsets.value[
        outputIndex
      ]
      - meta.$fork.originOffset,
    )
    * 2.75
    * multiplier
    * forkToBranchVerticalRatio.value

  const sourcePrimaryLineGapEm =
    renderedSourcePrimaryLineGapEm.value
    ?? context.primaryLineGapEm

  return Math.max(
    0,
    sourcePrimaryLineGapEm
    - targetMovementEm,
  )
}

type ForkOutputGapProvider =
  (branchId: string) => number

const registerForkOutputGapProvider =
  inject<
    (
      forkId: string,
      provider: ForkOutputGapProvider,
    ) => void
  >(
    'registerForkOutputPrimaryLineGapProvider',
    () => {},
  )

const unregisterForkOutputGapProvider =
  inject<
    (
      forkId: string,
    ) => void
  >(
    'unregisterForkOutputPrimaryLineGapProvider',
    () => {},
  )

function forkOutputGapForBranch(
  branchId: string,
) {
  const sections =
    outputSections.value

  if (!sections) {
    return 0
  }

  for (
    let index = 0;
    index < sections.length;
    index++
  ) {
    const outputBranch =
      sections[index]
        .$lineSection
        .elements
        .find(
          element =>
            '$branch' in element,
        )

    if (
      outputBranch
      && '$branch' in outputBranch
      && outputBranch.id === branchId
    ) {
      return (
        outputPrimaryLineGapForIndex(
          index as 0 | 1,
        )
      )
    }
  }

  return 0
}

registerForkOutputGapProvider(
  meta.id,
  forkOutputGapForBranch,
)

let passThroughFrame:
  number | null = null

let switchingTargetLine = false

let railResizeObserver: ResizeObserver | null = null
let railMutationObserver: MutationObserver | null = null
let forkExtentObserver: ResizeObserver | null = null
let outputClearanceResizeObserver:
  ResizeObserver | null = null
let outputClearanceMutationObserver:
  MutationObserver | null = null

/*
 * Synchronisation LIVE du gap D/S de la Branch source.
 *
 * Le calcul est correct après F5 car la Branch source a déjà fini son layout.
 * En direct, offsetMultiplier peut changer avant que le transform des rails
 * source ait été réellement appliqué au DOM.
 *
 * On observe donc UNIQUEMENT la Branch source exacte connue par
 * sourceBranchId. Dès que ses rails bougent, on relit leur écart réel et
 * les Branch de sortie reçoivent immédiatement la nouvelle valeur.
 */
let sourceGapResizeObserver:
  ResizeObserver | null = null

let sourceGapMutationObserver:
  MutationObserver | null = null

/*
 * =========================================================
 * GARDE-FOU SORTABLE : AUCUN RECALCUL LOURD PENDANT UN DRAG
 * =========================================================
 *
 * Fork.vue observe une grande partie de la Section pour rester aligné
 * en live avec les rails D/S. Sortable ajoute / retire cependant des
 * classes et des nœuds temporaires pendant un drag :
 *
 *   sortable-chosen
 *   sortable-drag
 *   sortable-ghost
 *
 * Ces mutations ne sont PAS des changements réels du plan. On suspend
 * donc les recalculs DOM de Fork.vue pendant le drag, puis on effectue
 * un seul recalage complet après le relâchement.
 */
let sortableDragSettleFrame:
  number | null = null

let sortableDragReleaseListening =
  false

function sortableDragIsActive() {
  if (typeof document === 'undefined') {
    return false
  }

  return Boolean(
    document.querySelector(
      [
        '.sortable-drag',
        '.sortable-chosen',
        '.sortable-ghost',
      ].join(','),
    ),
  )
}

function runFullForkGeometryRefresh() {
  if (
    typeof window === 'undefined'
    || !el.value
  ) {
    return
  }

  if (sortableDragSettleFrame !== null) {
    cancelAnimationFrame(
      sortableDragSettleFrame,
    )
  }

  sortableDragSettleFrame =
    requestAnimationFrame(
      async () => {
        sortableDragSettleFrame = null

        await nextTick()

        updateRenderedSourcePrimaryLineGap()
        snapForkToTargetRail()
        alignForkOutputSections()
        scheduleOutputClearance()
        schedulePassThroughRails()
        emitForkExtent()
      },
    )
}

function removeSortableReleaseListeners() {
  if (
    typeof window === 'undefined'
    || !sortableDragReleaseListening
  ) {
    return
  }

  sortableDragReleaseListening =
    false

  window.removeEventListener(
    'pointerup',
    onSortableDragRelease,
    true,
  )

  window.removeEventListener(
    'pointercancel',
    onSortableDragRelease,
    true,
  )

  window.removeEventListener(
    'mouseup',
    onSortableDragRelease,
    true,
  )

  window.removeEventListener(
    'touchend',
    onSortableDragRelease,
    true,
  )
}

function onSortableDragRelease() {
  removeSortableReleaseListeners()

  requestAnimationFrame(() => {
    runFullForkGeometryRefresh()
  })
}

function ensureSortableReleaseRefresh() {
  if (
    typeof window === 'undefined'
    || sortableDragReleaseListening
  ) {
    return
  }

  sortableDragReleaseListening = true

  window.addEventListener(
    'pointerup',
    onSortableDragRelease,
    true,
  )

  window.addEventListener(
    'pointercancel',
    onSortableDragRelease,
    true,
  )

  window.addEventListener(
    'mouseup',
    onSortableDragRelease,
    true,
  )

  window.addEventListener(
    'touchend',
    onSortableDragRelease,
    true,
  )
}

function pauseForkObserverDuringSortableDrag() {
  if (!sortableDragIsActive()) {
    return false
  }

  ensureSortableReleaseRefresh()

  return true
}

let sourceGapFrame: number | null = null

let updateFrame: number | null = null
let initialAnchorFrame: number | null = null
let outputClearanceFrame: number | null = null

function sourceBranchElement():
  HTMLElement | null {
  if (
    typeof document === 'undefined'
  ) {
    return null
  }

  const sourceBranchId =
    forkCorridorContext.value
      ?.sourceBranchId

  if (!sourceBranchId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.branch-wrapper[data-branch-id="${CSS.escape(sourceBranchId)}"]`,
  )
}

function scheduleRenderedSourceGapSync() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (sourceGapFrame !== null) {
    cancelAnimationFrame(
      sourceGapFrame,
    )
  }

  sourceGapFrame =
    requestAnimationFrame(
      async () => {
        sourceGapFrame = null

        /*
         * À ce frame, Branch.vue a eu le temps d'appliquer le nouveau
         * transform de ses rails après le changement de multiplicateur.
         */
        await nextTick()

        updateRenderedSourcePrimaryLineGap()

        /*
         * Le provider forkOutputPrimaryLineGapForBranch dépend du ref
         * ci-dessus. On laisse donc la Branch enfant se recalculer avant
         * de recoller ses rails aux endpoints de la Fork.
         */
        await nextTick()

        snapForkToTargetRail()
        alignForkOutputSections()
        schedulePassThroughRails()
      },
    )
}

function bindRenderedSourceGapObservers() {
  sourceGapResizeObserver?.disconnect()
  sourceGapMutationObserver?.disconnect()

  sourceGapResizeObserver = null
  sourceGapMutationObserver = null

  const sourceBranch =
    sourceBranchElement()

  if (!sourceBranch) {
    return
  }

  sourceGapResizeObserver =
    new ResizeObserver(
      () => {
        if (
          pauseForkObserverDuringSortableDrag()
        ) {
          return
        }

        scheduleRenderedSourceGapSync()
      },
    )

  sourceGapResizeObserver.observe(
    sourceBranch,
  )

  sourceGapMutationObserver =
    new MutationObserver(
      () => {
        if (
          pauseForkObserverDuringSortableDrag()
        ) {
          return
        }

        scheduleRenderedSourceGapSync()
      },
    )

  /*
   * Le déplacement vertical des rails de Branch.vue est publié dans
   * l'attribut transform des <g data-line-id>. C'est l'événement exact
   * qui nous intéresse : pas de watcher global, pas de remount.
   */
  sourceGapMutationObserver.observe(
    sourceBranch,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'transform',
        'data-line-id',
      ],
    },
  )

  scheduleRenderedSourceGapSync()
}

function horizontalDistance(
  first: DOMRect,
  second: DOMRect,
) {
  if (first.right < second.left) {
    return second.left - first.right
  }

  if (second.right < first.left) {
    return first.left - second.right
  }

  return 0
}

function findNearestRail(
  lineId: string,
): SVGGElement | null {
  if (
    typeof document === 'undefined'
    || !el.value
  ) {
    return null
  }

  const forkGeometry =
    (el.value as HTMLElement)
      .querySelector<SVGSVGElement>(
        '.fork-svg',
      )

  const forkRect =
    (
      forkGeometry
      ?? (el.value as HTMLElement)
    )
      .getBoundingClientRect()

  const selector =
    `[data-line-id="${CSS.escape(lineId)}"]`

  /*
   * SOURCE DÉTERMINISTE :
   * SectionEditor nous donne l'id exact de la Branch située avant
   * cette Fork. On ne choisit donc plus "le rail le plus proche",
   * choix qui pouvait changer après F5.
   */
  const sourceBranchId =
    forkCorridorContext.value
      ?.sourceBranchId

  if (sourceBranchId) {
    const exactBranch =
      document.querySelector<HTMLElement>(
        `.branch-wrapper[data-branch-id="${CSS.escape(sourceBranchId)}"]`,
      )

    const exactRail =
      exactBranch
        ?.querySelector<SVGGElement>(
          `.line > svg ${selector}`,
        )

    if (exactRail) {
      return exactRail
    }
  }

  /*
   * Fallback uniquement pour les anciennes structures.
   */
  const sectionRoot =
    (el.value as HTMLElement)
      .closest<HTMLElement>('.section')
      ?? (el.value as HTMLElement).parentElement

  const localCandidates =
    sectionRoot
      ? Array.from(
          sectionRoot.querySelectorAll<SVGGElement>(
            selector,
          ),
        )
      : []

  const candidates =
    (
      localCandidates.length > 0
        ? localCandidates
        : Array.from(
            document.querySelectorAll<SVGGElement>(
              selector,
            ),
          )
    )
      .filter((candidate) => {
        const externalRoot =
          externalParallelBranchesRoot()

        return (
          !(
            el.value
            && (el.value as HTMLElement).contains(candidate)
          )
          && !(
            externalRoot
            && externalRoot.contains(candidate)
          )
        )
      })

  if (candidates.length === 0) {
    return null
  }

  return (
    candidates
      .map(candidate => ({
        candidate,
        rect:
          candidate.getBoundingClientRect(),
      }))
      .sort(
        (first, second) =>
          horizontalDistance(
            first.rect,
            forkRect,
          )
          - horizontalDistance(
            second.rect,
            forkRect,
          ),
      )[0]?.candidate
    ?? null
  )
}


function findInputRail(
  lineId: string,
): SVGGElement | null {
  if (
    typeof document === 'undefined'
    || !el.value
  ) {
    return null
  }

  const forkGeometry =
    el.value.querySelector<SVGSVGElement>(
      '.fork-svg',
    )

  if (!forkGeometry) {
    return null
  }

  const forkRect =
    forkGeometry.getBoundingClientRect()

  const selector =
    `[data-line-id="${CSS.escape(lineId)}"]`

  /*
   * Même règle que pour l'ancrage principal :
   * on prend d'abord la Branch topologique exacte qui précède
   * cette Fork. Ainsi, après F5, aucune Branch de sortie ne peut
   * devenir accidentellement la "source" de S.
   */
  const sourceBranchId =
    forkCorridorContext.value
      ?.sourceBranchId

  if (sourceBranchId) {
    const exactBranch =
      document.querySelector<HTMLElement>(
        `.branch-wrapper[data-branch-id="${CSS.escape(sourceBranchId)}"]`,
      )

    const exactRail =
      exactBranch
        ?.querySelector<SVGGElement>(
          `.line > svg ${selector}`,
        )

    if (exactRail) {
      return exactRail
    }
  }

  const sectionRoot =
    el.value.closest<HTMLElement>(
      '.section',
    )
    ?? el.value.parentElement

  if (!sectionRoot) {
    return null
  }

  const candidates =
    Array.from(
      sectionRoot.querySelectorAll<SVGGElement>(
        selector,
      ),
    )
      .filter(
        (candidate) => {
          const externalRoot =
            externalParallelBranchesRoot()

          return (
            !el.value!.contains(candidate)
            && !(
              externalRoot
              && externalRoot.contains(candidate)
            )
          )
        },
      )
      .map(candidate => ({
        candidate,
        rect:
          candidate.getBoundingClientRect(),
      }))

  /*
   * Pour une Fork RIGHT, l'entrée est à gauche.
   * Pour une Fork LEFT, l'entrée est à droite.
   *
   * On évite ainsi de mesurer par erreur une Branch de SORTIE
   * après F5, ce qui était la source de géométries différentes
   * entre le rendu immédiat et le rechargement.
   */
  const inputSide =
    candidates.filter(({ rect }) => {
      if (meta.$fork.toward === 'LEFT') {
        return (
          rect.left
          >= forkRect.left
        )
      }

      return (
        rect.right
        <= forkRect.right
      )
    })

  const pool =
    inputSide.length > 0
      ? inputSide
      : candidates

  return (
    pool
      .sort(
        (first, second) =>
          horizontalDistance(
            first.rect,
            forkRect,
          )
          - horizontalDistance(
              second.rect,
              forkRect,
            ),
      )[0]?.candidate
    ?? null
  )
}

function railCenterY(
  lineId: string,
): number | null {
  const rail =
    findNearestRail(lineId)

  if (rail) {
    const rect =
      rail.getBoundingClientRect()

    return (
      rect.top
      + rect.height / 2
    )
  }

  /*
   * Premier frame après changement D -> S :
   * l'ancre latente de Branch.vue peut être créée au frame suivant.
   *
   * Le contexte logique donne tout de même l'ordre de la ligne.
   * On utilise alors temporairement le rail primary comme référence,
   * puis snapForkToTargetRail recollera la Fork sur l'ancre réelle
   * dès qu'elle apparaît.
   */
  const context =
    forkCorridorContext.value

  const additionalIndex =
    context?.additionalLines
      .findIndex(
        line =>
          line.id === lineId,
      )
    ?? -1

  if (additionalIndex < 0) {
    return null
  }

  const primary =
    findNearestRail('primary')

  if (!primary) {
    return null
  }

  const primaryRect =
    primary.getBoundingClientRect()

  const pixelsPerEm =
    Math.max(
      1,
      emSize.value,
    )

  const approximateStep =
    Math.max(
      lineWidth.value
      + 0.18,
      lineWidth.value * 1.35,
    )
    * pixelsPerEm

  return (
    primaryRect.top
    + primaryRect.height / 2
    + (
      additionalIndex + 1
    ) * approximateStep
  )
}

function updateTargetRailOffset() {
  if (
    switchingTargetLine
    || typeof window === 'undefined'
    || !el.value
  ) {
    return
  }

  if (updateFrame !== null) {
    cancelAnimationFrame(updateFrame)
  }

  updateFrame =
    requestAnimationFrame(() => {
      updateFrame = null

      if (!el.value) {
        return
      }

      /*
       * IMPORTANT :
       * el contient maintenant aussi les deux LineSection de sortie.
       * Son getBoundingClientRect() englobe donc la Fork + les branches
       * enfants et ne représente plus l'axe de la fourche.
       *
       * L'ancrage D/S doit être calculé uniquement depuis la géométrie
       * SVG de la Fork. Les sections de sortie suivent ensuite le même
       * transform que leur Fork parente.
       */
      const forkGeometry =
        el.value.querySelector<SVGSVGElement>(
          '.fork-svg',
        )

      if (!forkGeometry) {
        return
      }

      const forkRect =
        forkGeometry.getBoundingClientRect()

      const naturalForkCenterY =
        forkRect.top
        + forkRect.height / 2
        - targetRailOffsetPx.value

      const sectionRoot =
        el.value.closest<HTMLElement>(
          '.section',
        )
        ?? el.value.parentElement

      if (!sectionRoot) {
        targetRailOffsetPx.value = 0
        return
      }

      const selector =
        `[data-line-id="${CSS.escape(targetLineId.value)}"]`

      const candidates =
        Array.from(
          sectionRoot.querySelectorAll<SVGGElement>(
            selector,
          ),
        )
          .filter((candidate) => {
            const externalRoot =
              externalParallelBranchesRoot()

            return (
              !(
                el.value
                && (el.value as HTMLElement).contains(candidate)
              )
              && !(
                externalRoot
                && externalRoot.contains(candidate)
              )
            )
          })

      if (candidates.length === 0) {
        targetRailOffsetPx.value = 0
        return
      }

      /*
       * Plusieurs Branch peuvent contenir le même lineId.
       * On prend le rail horizontalement le plus proche de la Fork :
       * c'est normalement la Branch immédiatement avant/après elle.
       */
      const target =
        candidates
          .map(candidate => ({
            candidate,
            rect:
              candidate.getBoundingClientRect(),
          }))
          .sort(
            (first, second) =>
              horizontalDistance(
                first.rect,
                forkRect,
              )
              - horizontalDistance(
                second.rect,
                forkRect,
              ),
          )[0]

      if (!target) {
        targetRailOffsetPx.value = 0
        return
      }

      const railCenterY =
        target.rect.top
        + target.rect.height / 2

      targetRailOffsetPx.value =
        railCenterY
        - naturalForkCenterY
    })
}

const wrapperOffset = computed(() => {
  const historicalOffsetEm =
    offset.value
    * (meta.$fork.offsetMultiplier ?? 1)
    * -2.75

  return `translateY(calc(${historicalOffsetEm}em + ${targetRailOffsetPx.value}px))`
})

/*
 * Changement de ligne en direct :
 *
 * la Fork est déjà correctement ancrée sur l'ancienne ligne.
 * On déplace donc son offset de la différence verticale réelle
 * entre l'ancien rail et le nouveau.
 */
watch(
  targetLineId,
  async (
    newLineId,
    oldLineId,
  ) => {
    switchingTargetLine = true

    await nextTick()

    const oldY =
      railCenterY(oldLineId || 'primary')

    const newY =
      railCenterY(newLineId || 'primary')

    if (
      oldY !== null
      && newY !== null
    ) {
      targetRailOffsetPx.value +=
        newY - oldY
    }

    /*
     * Le changement de ligne doit aussi remettre les deux sorties
     * sur cette même ligne, comme dans la version de bifurcation
     * qui fonctionnait avant les essais récents.
     */
    syncForkOutputBranches()

    await nextTick()

    requestAnimationFrame(() => {
      /*
       * Le delta D <-> S donne le déplacement immédiat.
       * On termine ensuite en collant le point d'origine réel
       * de la Fork exactement sur le centre du rail cible.
       */
      snapForkToTargetRail()
      alignForkOutputSections()

      requestAnimationFrame(() => {
        switchingTargetLine = false
        snapForkToTargetRail()
        alignForkOutputSections()
      })
    })
  },
  {
    flush: 'post',
  },
)

watch(
  () =>
    JSON.stringify({
      target:
        targetLineId.value,

      sourceBranchId:
        forkCorridorContext.value
          ?.sourceBranchId
        ?? null,

      primary:
        forkCorridorContext.value
          ?.primaryVisible
        ?? true,

      additional:
        (
          forkCorridorContext.value
            ?.additionalLines
          ?? []
        ).map(line => ({
          id: line.id,
          mode: line.mode,
          index: line.index,
          color: line.color,
        })),

      primaryLineGapEm:
        forkCorridorContext.value
          ?.primaryLineGapEm
        ?? 0,
    }),
  async () => {
    await nextTick()

    requestAnimationFrame(() => {
      snapForkToTargetRail()
      alignForkOutputSections()

      /*
       * Un second frame laisse Branch.vue publier son ancre latente.
       */
      requestAnimationFrame(() => {
        snapForkToTargetRail()
        alignForkOutputSections()
      })
    })
  },
  {
    flush: 'post',
  },
)

watch(
  [
    () => meta.$fork.originOffset,
    () => meta.$fork.offsetMultiplier,
  ],
  async () => {
    await nextTick()

    /*
     * Le changement de multiplicateur déclenche le recalcul de la Branch
     * source. On ne mesure plus son ancien gap au même tick : on attend
     * son vrai mouvement DOM, puis l'observer ci-dessus resynchronise la
     * sortie immédiatement.
     */
    scheduleRenderedSourceGapSync()

    requestAnimationFrame(() => {
      snapForkToTargetRail()
      alignForkOutputSections()
    })
  },
  {
    flush: 'post',
  },
)

watch(
  () =>
    forkCorridorContext.value
      ?.sourceBranchId
    ?? null,
  async () => {
    await nextTick()

    bindRenderedSourceGapObservers()
  },
  {
    flush: 'post',
  },
)



function snapForkToTargetRail() {
  if (
    typeof window === 'undefined'
    || !el.value
  ) {
    return false
  }

  /*
   * Fourche simple créée comme premier élément de sa Section :
   *
   * SectionEditor nous donne alors sourceBranchId = null.
   * Après conversion en :
   *
   *   Fork + vrai ParallelBranches
   *
   * les deux rails du ParallelBranches deviennent des siblings DOM.
   * Ils ne doivent JAMAIS servir d'ancre d'entrée à cette Fork.
   *
   * Pour la ligne principale, l'absence de source topologique signifie
   * simplement : rester sur l'axe naturel de la Section.
   *
   * On remet explicitement l'offset DOM à zéro afin qu'un ancien snap
   * calculé pendant un frame précédent ne survive pas à la conversion.
   */
  if (
    targetLineId.value === 'primary'
    && !forkCorridorContext.value?.sourceBranchId
  ) {
    targetRailOffsetPx.value = 0
    return true
  }

  /*
   * Le corridor source peut avoir changé de hauteur juste avant
   * cette mesure (notamment quand offsetMultiplier change).
   * On mémorise donc d'abord son écart D/S réellement rendu.
   */
  updateRenderedSourcePrimaryLineGap()

  const forkGeometry =
    el.value.querySelector<SVGSVGElement>(
      '.fork-svg',
    )

  if (!forkGeometry) {
    return false
  }

  const targetY =
    railCenterY(
      targetLineId.value,
    )

  if (targetY === null) {
    return false
  }

  /*
   * Au premier drop, on part simplement de la position
   * réellement affichée de la Fork et on la colle au rail cible.
   */
  const forkRect =
    forkGeometry.getBoundingClientRect()

  const currentForkCenterY =
    forkRect.top
    + forkRect.height / 2

  const delta =
    targetY
    - currentForkCenterY

  if (Math.abs(delta) < 0.25) {
    return true
  }

  targetRailOffsetPx.value += delta

  return true
}


function stabilizeInitialAnchor(
  attempt = 0,
) {
  if (
    typeof window === 'undefined'
    || !el.value
  ) {
    return
  }

  if (initialAnchorFrame !== null) {
    cancelAnimationFrame(
      initialAnchorFrame,
    )
  }

  initialAnchorFrame =
    requestAnimationFrame(() => {
      initialAnchorFrame = null

      /*
       * Lors d'un drop depuis VueDraggable, le composant peut être
       * monté avant que la Branch voisine ait fini son layout.
       *
       * On attend donc quelques frames de stabilisation et on
       * recalcule l'ancrage sur la ligne principale réelle.
       * Aucun état persistant n'est modifié ici.
       */
      snapForkToTargetRail()
      alignForkOutputSections()

      if (attempt < 5) {
        stabilizeInitialAnchor(
          attempt + 1,
        )
      }
    })
}




function isVisibleObstacle(
  element: Element,
) {
  const style =
    window.getComputedStyle(element)

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
    element.getBoundingClientRect()

  return (
    rect.width > 0
    && rect.height > 0
  )
}

function outputObstacleRects(
  slot: HTMLElement,
) {
  /*
   * On mesure uniquement les contenus qui peuvent réellement entrer
   * en collision entre les deux sorties.
   *
   * Stop.vue expose déjà les noms et les correspondances avec
   * .dynamic-part. Le point d'arrêt, le wrapper complet et le rail
   * ne doivent PAS participer à ce calcul : ils sont volontairement
   * autorisés à rester au même X sur deux sorties différentes.
   *
   * Cela évite surtout qu'un grand .stop-wrapper (min-height, hitbox
   * de drag/drop, etc.) déclenche un faux décalage alors que les
   * contenus visibles ne se touchent pas.
   */
  const candidates =
    slot.querySelectorAll<Element>(
      [
        '.stop-wrapper .dynamic-part',
        '.stop-wrapper .dynamic-part *',
        '.annotation-wrapper',
        '.annotation-wrapper *',
        '.out-of-fare-zone-label',
        '.out-of-fare-zone-label *',
        '.connection-bridges path',
      ].join(','),
    )

  return Array.from(candidates)
    .filter(isVisibleObstacle)
    .map(element =>
      element.getBoundingClientRect(),
    )
}

function horizontalOverlap(
  first: DOMRect,
  second: DOMRect,
) {
  return (
    first.right > second.left
    && second.right > first.left
  )
}


function verticalOverlap(
  first: DOMRect,
  second: DOMRect,
) {
  return (
    first.bottom > second.top
    && second.bottom > first.top
  )
}


function externalParallelBranchesRoot():
  HTMLElement | null {
  if (
    typeof document === 'undefined'
  ) {
    return null
  }

  const pair =
    pairedParallelBranches.value

  if (!pair) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `[data-parallel-branches-id="${CSS.escape(pair.id)}"]`,
  )
}

function forkOutputContainerElement():
  HTMLElement | null {
  if (hasExternalParallelBranches.value) {
    return externalParallelBranchesRoot()
  }

  return (
    el.value
      ?.querySelector<HTMLElement>(
        ':scope > .fork-sections',
      )
    ?? null
  )
}

function forkOutputSlots() {
  const container =
    forkOutputContainerElement()

  if (!container) {
    return [] as HTMLElement[]
  }

  const selector =
    hasExternalParallelBranches.value
      ? ':scope > .child-branch'
      : ':scope > .fork-section'

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      selector,
    ),
  )
}

function applyExternalOutputRenderOffsets() {
  if (!hasExternalParallelBranches.value) {
    return
  }

  const slots =
    forkOutputSlots()

  slots.forEach((slot, index) => {
    const outputIndex =
      index as 0 | 1

    slot.style.transform =
      `translateY(${forkOutputOffsetsPx.value[outputIndex] ?? 0}px)`

    slot.style.setProperty(
      '--fork-output-content-offset-x',
      `${forkOutputContentOffsetPx.value[outputIndex] ?? 0}px`,
    )
  })
}

/*
 * Calcule uniquement un décalage X du contenu de la sortie basse.
 *
 * On utilise les rectangles déjà disponibles dans Fork.vue :
 * stop-wrapper, noms, correspondances, annotations, etc.
 *
 * Le décalage courant est retiré des mesures de la sortie basse afin
 * de recalculer toujours depuis sa position naturelle. Ainsi le calcul
 * ne s'accumule jamais à chaque ResizeObserver.
 */
function updateOutputHorizontalClearance() {
  if (
    typeof window === 'undefined'
    || !el.value
    || !outputSections.value
  ) {
    return
  }

  const slots =
    forkOutputSlots()

  if (slots.length < 2) {
    forkOutputContentOffsetPx.value = [
      0,
      0,
    ]
    return
  }

  const railSelector =
    `[data-line-id="${CSS.escape(targetLineId.value)}"]`

  const railRects =
    slots.map(slot =>
      slot
        .querySelector<SVGGElement>(
          railSelector,
        )
        ?.getBoundingClientRect()
      ?? null,
    )

  if (
    !railRects[0]
    || !railRects[1]
  ) {
    forkOutputContentOffsetPx.value = [
      0,
      0,
    ]
    return
  }

  const firstCenter =
    railRects[0]!.top
    + railRects[0]!.height / 2

  const secondCenter =
    railRects[1]!.top
    + railRects[1]!.height / 2

  const topIndex: 0 | 1 =
    firstCenter <= secondCenter
      ? 0
      : 1

  const bottomIndex: 0 | 1 =
    topIndex === 0
      ? 1
      : 0

  const topRects =
    outputObstacleRects(
      slots[topIndex],
    )

  const bottomRects =
    outputObstacleRects(
      slots[bottomIndex],
    )

  const currentBottomOffset =
    forkOutputContentOffsetPx
      .value[bottomIndex]

  const safetyPx =
    Math.max(
      8,
      emSize.value * 0.5,
    )

  let requiredBottomOffset = 0

  for (const topRect of topRects) {
    for (const bottomRect of bottomRects) {
      /*
       * Si les contenus ne se rencontrent pas verticalement,
       * ils peuvent garder le même X sans aucun problème.
       */
      if (
        !verticalOverlap(
          topRect,
          bottomRect,
        )
      ) {
        continue
      }

      /*
       * Retrouve la position naturelle de la sortie basse,
       * avant le décalage déjà appliqué.
       */
      const naturalBottomLeft =
        bottomRect.left
        - currentBottomOffset

      const naturalBottomRight =
        bottomRect.right
        - currentBottomOffset

      /*
       * Pas de collision horizontale à la position naturelle.
       */
      if (
        topRect.right + safetyPx
          <= naturalBottomLeft
        || naturalBottomRight + safetyPx
          <= topRect.left
      ) {
        continue
      }

      requiredBottomOffset =
        Math.max(
          requiredBottomOffset,
          topRect.right
          + safetyPx
          - naturalBottomLeft,
        )
    }
  }

  /*
   * Garde-fou de rendu : un contenu anormalement gigantesque ne doit
   * pas repousser toute la carte de plusieurs écrans.
   */
  requiredBottomOffset =
    Math.min(
      Math.max(
        0,
        requiredBottomOffset,
      ),
      emSize.value * 18,
    )

  const next: [number, number] = [
    0,
    0,
  ]

  next[bottomIndex] =
    requiredBottomOffset

  const current =
    forkOutputContentOffsetPx.value

  if (
    Math.abs(
      current[0] - next[0],
    ) > 0.5
    || Math.abs(
      current[1] - next[1],
    ) > 0.5
  ) {
    forkOutputContentOffsetPx.value =
      next

    applyExternalOutputRenderOffsets()
  }
}

function updateOutputClearance() {
  if (
    typeof window === 'undefined'
    || !el.value
    || !outputSections.value
  ) {
    return
  }

  /*
   * Une ligne traversante doit rester droite.
   * Le clearance automatique des deux sorties ne peut donc pas
   * modifier la géométrie de cette Fork.
   */
  if (hasNonTargetCorridorLine.value) {
    if (autoExtraOutputLevels.value !== 0) {
      autoExtraOutputLevels.value = 0
    }

    return
  }

  const slots =
    forkOutputSlots()

  if (slots.length < 2) {
    autoExtraOutputLevels.value = 0
    return
  }

  const railSelector =
    `[data-line-id="${CSS.escape(targetLineId.value)}"]`

  const firstRail =
    slots[0].querySelector<SVGGElement>(
      railSelector,
    )

  const secondRail =
    slots[1].querySelector<SVGGElement>(
      railSelector,
    )

  if (
    !firstRail
    || !secondRail
  ) {
    return
  }

  const firstRailRect =
    firstRail.getBoundingClientRect()

  const secondRailRect =
    secondRail.getBoundingClientRect()

  const firstCenter =
    firstRailRect.top
    + firstRailRect.height / 2

  const secondCenter =
    secondRailRect.top
    + secondRailRect.height / 2

  const topIndex: 0 | 1 =
    firstCenter <= secondCenter
      ? 0
      : 1

  const bottomIndex: 0 | 1 =
    topIndex === 0
      ? 1
      : 0

  const railRects = [
    firstRailRect,
    secondRailRect,
  ] as const

  const railCenters = [
    firstCenter,
    secondCenter,
  ] as const

  const topRects = [
    railRects[topIndex],
    ...outputObstacleRects(
      slots[topIndex],
    ),
  ]

  const bottomRects = [
    railRects[bottomIndex],
    ...outputObstacleRects(
      slots[bottomIndex],
    ),
  ]

  const topRailCenter =
    railCenters[topIndex]

  const bottomRailCenter =
    railCenters[bottomIndex]

  const safetyPx =
    Math.max(
      10,
      emSize.value * 0.68,
    )

  let requiredCenterGapPx =
    railRects[topIndex].height / 2
    + railRects[bottomIndex].height / 2
    + safetyPx

  for (const topRect of topRects) {
    for (const bottomRect of bottomRects) {
      if (
        !horizontalOverlap(
          topRect,
          bottomRect,
        )
      ) {
        continue
      }

      const topDown =
        Math.max(
          railRects[topIndex].height / 2,
          topRect.bottom - topRailCenter,
        )

      const bottomUp =
        Math.max(
          railRects[bottomIndex].height / 2,
          bottomRailCenter - bottomRect.top,
        )

      requiredCenterGapPx =
        Math.max(
          requiredCenterGapPx,
          topDown
          + bottomUp
          + safetyPx,
        )
    }
  }

  const multiplier =
    Math.max(
      0.001,
      meta.$fork.offsetMultiplier ?? 1,
    )

  const requiredLevelGap =
    requiredCenterGapPx
    / (
      2.75
      * emSize.value
      * multiplier
    )

  const baseLevelGap =
    Math.abs(
      meta.$fork.linksOffset[0]
      - meta.$fork.linksOffset[1],
    )

  const extra =
    Math.max(
      0,
      requiredLevelGap
      - baseLevelGap,
    )

  if (
    Math.abs(
      autoExtraOutputLevels.value
      - extra,
    ) > 0.02
  ) {
    autoExtraOutputLevels.value =
      extra
  }
}

function scheduleOutputClearance() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (outputClearanceFrame !== null) {
    cancelAnimationFrame(
      outputClearanceFrame,
    )
  }

  outputClearanceFrame =
    requestAnimationFrame(
      async () => {
        outputClearanceFrame = null

        await nextTick()

        updateOutputClearance()

        await nextTick()

        alignForkOutputSections()

        /*
         * La géométrie verticale de la Fork est désormais terminée.
         * On espace seulement les contenus des deux sorties en X.
         */
        updateOutputHorizontalClearance()

        await nextTick()

        emitForkExtent()
      },
    )
}


function emitForkExtent() {
  if (!el.value) {
    return
  }

  const forkRoot =
    el.value as HTMLElement

  let width =
    forkRoot.offsetWidth

  /*
   * Quand les sorties sont un vrai ParallelBranches sibling, la largeur
   * logique de la paire doit rester celle que l'ancien modèle autonome
   * exposait à SectionEditor. C'est indispensable pour superposer deux
   * Fork de lignes différentes au même X.
   */
  const externalRoot =
    externalParallelBranchesRoot()

  if (externalRoot) {
    const forkRect =
      forkRoot.getBoundingClientRect()

    const parallelRect =
      externalRoot.getBoundingClientRect()

    width =
      Math.max(
        forkRect.right,
        parallelRect.right,
      )
      - Math.min(
          forkRect.left,
          parallelRect.left,
        )
  }

  if (width > 0) {
    emit(
      'extentChange',
      width,
    )
  }
}



function bindForkOutputObservers() {
  outputClearanceResizeObserver?.disconnect()
  outputClearanceMutationObserver?.disconnect()

  outputClearanceResizeObserver = null
  outputClearanceMutationObserver = null

  const forkSectionsElement =
    forkOutputContainerElement()

  if (forkSectionsElement) {
    outputClearanceResizeObserver =
      new ResizeObserver(
        () => {
          if (
            pauseForkObserverDuringSortableDrag()
          ) {
            return
          }

          scheduleOutputClearance()
        },
      )

    outputClearanceResizeObserver.observe(
      forkSectionsElement,
    )

    forkOutputSlots()
      .forEach((slot) => {
        outputClearanceResizeObserver?.observe(
          slot,
        )
      })

    outputClearanceMutationObserver =
      new MutationObserver(
        () => {
          if (
            pauseForkObserverDuringSortableDrag()
          ) {
            return
          }

          scheduleOutputClearance()
        },
      )

    outputClearanceMutationObserver.observe(
      forkSectionsElement,
      {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'class',
          'data-line-id',
          'data-line-ids',
          'transform',
        ],
      },
    )
  }
}

watch(
  () =>
    pairedParallelBranches.value?.id
    ?? null,
  async () => {
    await nextTick()

    bindForkOutputObservers()
    alignForkOutputSections()
    scheduleOutputClearance()
    schedulePassThroughRails()
  },
  {
    flush: 'post',
  },
)

onMounted(async () => {
  /*
   * Au drop, la Fork initialise immédiatement ses deux sorties
   * sur sa propre ligne. Cela rétablit la bifurcation visible.
   */
  syncForkOutputBranches()

  await nextTick()

  /*
   * Une nouvelle Fork cible "primary" dès sa création.
   * On la colle immédiatement au rail visible puis on laisse
   * VueDraggable finir son layout sur quelques frames.
   */
  snapForkToTargetRail()
  stabilizeInitialAnchor()

  if (!el.value) {
    return
  }

  emitForkExtent()

  /*
   * À partir de maintenant on suit précisément la Branch source.
   * C'est ce qui rend le comportement identique en direct et après F5.
   */
  bindRenderedSourceGapObservers()

  forkExtentObserver =
    new ResizeObserver(() => {
      if (
        pauseForkObserverDuringSortableDrag()
      ) {
        return
      }

      emitForkExtent()
    })

  forkExtentObserver.observe(
    el.value,
  )

  bindForkOutputObservers()

  scheduleOutputClearance()

  const sectionRoot =
    el.value.closest<HTMLElement>(
      '.section',
    )
    ?? el.value.parentElement

  if (!sectionRoot) {
    return
  }

  railResizeObserver =
    new ResizeObserver(() => {
      if (
        pauseForkObserverDuringSortableDrag()
      ) {
        return
      }

      requestAnimationFrame(() => {
        snapForkToTargetRail()
        alignForkOutputSections()
      })
    })

  railResizeObserver.observe(
    sectionRoot,
  )

  railMutationObserver =
    new MutationObserver(() => {
      if (
        pauseForkObserverDuringSortableDrag()
      ) {
        return
      }

      requestAnimationFrame(() => {
        snapForkToTargetRail()
        alignForkOutputSections()
      })
    })

  railMutationObserver.observe(
    sectionRoot,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'class',
        'data-line-id',
        'transform',
      ],
    },
  )

  window.addEventListener(
    'resize',
    snapForkToTargetRail,
  )
})

onBeforeUnmount(() => {
  unregisterForkOutputGapProvider(
    meta.id,
  )

  railResizeObserver?.disconnect()
  railMutationObserver?.disconnect()
  forkExtentObserver?.disconnect()
  outputClearanceResizeObserver?.disconnect()
  outputClearanceMutationObserver?.disconnect()
  sourceGapResizeObserver?.disconnect()
  sourceGapMutationObserver?.disconnect()

  removeSortableReleaseListeners()

  if (sortableDragSettleFrame !== null) {
    cancelAnimationFrame(
      sortableDragSettleFrame,
    )
  }

  window.removeEventListener(
    'resize',
    snapForkToTargetRail,
  )

  if (updateFrame !== null) {
    cancelAnimationFrame(updateFrame)
  }

  if (initialAnchorFrame !== null) {
    cancelAnimationFrame(
      initialAnchorFrame,
    )
  }

  if (outputClearanceFrame !== null) {
    cancelAnimationFrame(
      outputClearanceFrame,
    )
  }

  if (passThroughFrame !== null) {
    cancelAnimationFrame(
      passThroughFrame,
    )
  }

  if (sourceGapFrame !== null) {
    cancelAnimationFrame(
      sourceGapFrame,
    )
  }
})

function getY(value: number) {
  /*
   * Un niveau de fourche doit correspondre exactement
   * à un levelOffset de LineSection.
   *
   * LineSection utilise 2.75em par niveau.
   * On convertit donc ici avec la taille réelle du em du plan.
   */
  return (
    maxHeight.value / 2
    - (
      value - offset.value
    )
    * 2.75
    * emSize.value
    * (meta.$fork.offsetMultiplier ?? 1)
  )
}

/*
 * Tracé historique de BULB.
 * On le conserve tel quel.
 */
function getOriginalPath(
  fromOffset: number,
  toOffset: number,
) {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return `
    M ${fromX} ${fromY}
    L ${fromX + effectiveClearance.value * flip} ${fromY}
    L ${toX - effectiveClearance.value * flip} ${toY}
    L ${toX} ${toY}
  `
}

/*
 * Nouvelle variante :
 *
 * une branche qui reste au même niveau
 * reste parfaitement droite.
 *
 * Une branche qui change de niveau utilise
 * deux raccords arrondis avec une partie verticale.
 */
function getRoundedPath(
  fromOffset: number,
  toOffset: number,
) {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  if (fromOffset === toOffset) {
    return `
      M ${fromX} ${fromY}
      L ${toX} ${toY}
    `
  }

  const startInnerX
    = fromX
      + effectiveClearance.value * flip

  const endInnerX
    = toX
      - effectiveClearance.value * flip

  const bendX
    = (startInnerX + endInnerX) / 2

  const horizontalDirection
    = Math.sign(endInnerX - startInnerX) || 1

  const verticalDirection
    = Math.sign(toY - fromY) || 1

  const horizontalSpace
    = Math.abs(endInnerX - startInnerX)

  const verticalSpace
    = Math.abs(toY - fromY)

  const radius = Math.min(
    size.value
    * 0.9
    * (meta.$fork.offsetMultiplier ?? 1),
    horizontalSpace / 4,
    verticalSpace / 2,
  )

  const beforeBendX
    = bendX
      - horizontalDirection * radius

  const afterBendX
    = bendX
      + horizontalDirection * radius

  const firstVerticalY
    = fromY
      + verticalDirection * radius

  const lastVerticalY
    = toY
      - verticalDirection * radius

  return `
    M ${fromX} ${fromY}

    L ${beforeBendX} ${fromY}

    Q
      ${bendX} ${fromY}
      ${bendX} ${firstVerticalY}

    L
      ${bendX}
      ${lastVerticalY}

    Q
      ${bendX} ${toY}
      ${afterBendX} ${toY}

    L ${toX} ${toY}
  `
}

function getPath(
  fromOffset: number,
  toOffset: number,
) {
  if (forkStyle.value === 'ROUNDED') {
    return getRoundedPath(
      fromOffset,
      toOffset,
    )
  }

  return getOriginalPath(
    fromOffset,
    toOffset,
  )
}

const path = computed(() => {
  return (
    getPath(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[0],
    )
    + getPath(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[1],
    )
  )
})




function updatePassThroughRails() {
  if (
    typeof window === 'undefined'
    || !el.value
    || !outputSections.value
  ) {
    passThroughRails.value = []
    return
  }

  const context =
    forkCorridorContext.value

  if (!context) {
    passThroughRails.value = []
    return
  }

  const inputLines = [
    ...(context.primaryVisible
      ? [{
          id: 'primary',
          color:
            lineContext.color.value,
        }]
      : []),

    ...context.additionalLines.map(
      line => ({
        id: line.id,
        color:
          line.color
          || '#000000',
      }),
    ),
  ]

  const targetRank =
    inputLines.findIndex(
      line =>
        line.id === targetLineId.value,
    )

  if (targetRank < 0) {
    passThroughRails.value = []
    return
  }

  const svg =
    el.value.querySelector<SVGSVGElement>(
      '.fork-svg',
    )

  if (!svg) {
    passThroughRails.value = []
    return
  }

  const svgRect =
    svg.getBoundingClientRect()

  const slots =
    forkOutputSlots()

  const topOutputIndex: 0 | 1 =
    renderedLinksOffsets.value[0]
      >= renderedLinksOffsets.value[1]
      ? 0
      : 1

  const bottomOutputIndex: 0 | 1 =
    topOutputIndex === 0
      ? 1
      : 0

  const visuals:
    PassThroughRail[] = []

  inputLines.forEach(
    (line, lineIndex) => {
      if (
        line.id === targetLineId.value
      ) {
        return
      }

      const outputIndex: 0 | 1 =
        lineIndex < targetRank
          ? topOutputIndex
          : bottomOutputIndex

      const sourceRail =
        findInputRail(
          line.id,
        )

      const outputBranch =
        outputSections.value?.[
          outputIndex
        ]?.$lineSection.elements.find(
          element =>
            '$branch' in element,
        )

      /*
       * La ligne non ciblée ne devient visible que si un arrêt
       * de cette sortie l'utilise réellement.
       */
      const outputUsesLine =
        outputBranch
        && '$branch' in outputBranch
        && outputBranch.$branch.elements.some(
          element => {
            if (!('$stop' in element)) {
              return false
            }

            const ids =
              (
                element.$stop as Stop['$stop'] & {
                  lineIds?: string[]
                }
              ).lineIds

            return (
              ids?.includes(line.id)
              ?? false
            )
          },
        )

      if (
        !outputUsesLine
        || !sourceRail
      ) {
        return
      }

      const sourceRect =
        sourceRail.getBoundingClientRect()

      const sourceCenterY =
        sourceRect.top
        + sourceRect.height / 2


      const destinationRail =
        slots[outputIndex]
          ?.querySelector<SVGGElement>(
            `[data-line-id="${CSS.escape(line.id)}"]`,
          )

      if (!destinationRail) {
        return
      }

      const destinationRect =
        destinationRail.getBoundingClientRect()

      /*
       * On dessine S de la FIN RÉELLE de son rail d'entrée
       * jusqu'au DÉBUT RÉEL de son rail de sortie.
       *
       * Le Y ne change jamais : c'est une simple continuation.
       * overflow="visible" permet au path de couvrir aussi le
       * vide de layout situé avant/après le SVG de la Fork.
       */
      const joinOverlap =
        Math.max(
          2,
          lineWidth.value
          * sizeFactor.value
          * 16
          * 0.55,
        )

      const sourceY =
        sourceCenterY
        - svgRect.top

      let startX: number
      let endX: number

      if (meta.$fork.toward === 'LEFT') {
        startX =
          sourceRect.left
          - svgRect.left
          + joinOverlap

        endX =
          destinationRect.right
          - svgRect.left
          - joinOverlap
      }
      else {
        startX =
          sourceRect.right
          - svgRect.left
          - joinOverlap

        endX =
          destinationRect.left
          - svgRect.left
          + joinOverlap
      }

      visuals.push({
        id:
          line.id,

        path:
          `
            M ${startX} ${sourceY}
            H ${endX}
          `,

        color:
          line.color,
      })
    },
  )


  passThroughRails.value =
    visuals
}

function schedulePassThroughRails() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (
    passThroughFrame !== null
  ) {
    cancelAnimationFrame(
      passThroughFrame,
    )
  }

  passThroughFrame =
    requestAnimationFrame(
      async () => {
        passThroughFrame = null

        await nextTick()

        updatePassThroughRails()
      },
    )
}

function alignForkOutputSections() {
  if (
    typeof window === 'undefined'
    || !el.value
    || !outputSections.value
  ) {
    return
  }

  const forkGeometry =
    el.value.querySelector<SVGSVGElement>(
      '.fork-svg',
    )

  if (!forkGeometry) {
    return
  }

  const svgRect =
    forkGeometry.getBoundingClientRect()

  const slots =
    forkOutputSlots()

  const nextOffsets: [number, number] = [
    forkOutputOffsetsPx.value[0],
    forkOutputOffsetsPx.value[1],
  ]

  for (const index of [0, 1] as const) {
    const slot = slots[index]

    if (!slot) {
      continue
    }

    const selector =
      `[data-line-id="${CSS.escape(targetLineId.value)}"]`

    const rail =
      slot.querySelector<SVGGElement>(
        selector,
      )

    if (!rail) {
      continue
    }

    const railRect =
      rail.getBoundingClientRect()

    /*
     * On enlève le correctif précédent pour retrouver la position
     * naturelle du rail enfant.
     */
    const naturalRailCenterY =
      railRect.top
      + railRect.height / 2
      - forkOutputOffsetsPx.value[index]

    /*
     * getY() donne exactement le Y de l'extrémité du tracé SVG.
     * Aucun pixel de topologie n'est enregistré : ceci est seulement
     * un correctif de rendu calculé depuis le DOM réel.
     */
    const endpointY =
      svgRect.top
      + getY(
          renderedLinksOffsets.value[index],
        )

    nextOffsets[index] =
      endpointY
      - naturalRailCenterY
  }

  forkOutputOffsetsPx.value =
    nextOffsets

  applyExternalOutputRenderOffsets()

  /*
   * Les transforms des sections enfants viennent de changer.
   * On mesure le raccord S/D au frame suivant, une fois ces
   * transforms réellement appliqués.
   */
  schedulePassThroughRails()
}



function syncForkOutputBranches() {
  const sections = outputSections.value

  if (!sections) {
    return
  }

  const context =
    forkCorridorContext.value

  const inputLines = [
    ...(context?.primaryVisible !== false
      ? [{
          id: 'primary',
          primary: true as const,
          additional: null as BranchAdditionalLine | null,
        }]
      : []),

    ...(
      context?.additionalLines
      ?? []
    ).map(line => ({
      id: line.id,
      primary: false as const,
      additional: line,
    })),
  ]

  const targetRank =
    inputLines.findIndex(
      line =>
        line.id === targetLineId.value,
    )

  const topOutputIndex =
    meta.$fork.linksOffset[0]
      >= meta.$fork.linksOffset[1]
      ? 0
      : 1

  const bottomOutputIndex =
    topOutputIndex === 0
      ? 1
      : 0

  const outputLineIds: [
    Set<string>,
    Set<string>,
  ] = [
    new Set<string>(),
    new Set<string>(),
  ]

  /* La ligne ciblée bifurque dans les deux sorties. */
  outputLineIds[0].add(
    targetLineId.value,
  )

  outputLineIds[1].add(
    targetLineId.value,
  )

  /*
   * Les autres lignes continuent dans UNE seule sortie.
   *
   * D + S, Fork D :
   *   haut = D
   *   bas  = D + S
   *
   * D + S, Fork S :
   *   haut = D + S
   *   bas  = S
   */
  if (targetRank >= 0) {
    inputLines.forEach(
      (line, index) => {
        if (
          line.id === targetLineId.value
        ) {
          return
        }

        const outputIndex =
          index < targetRank
            ? topOutputIndex
            : bottomOutputIndex

        outputLineIds[
          outputIndex
        ].add(
          line.id,
        )
      },
    )
  }

  for (
    let sectionIndex = 0;
    sectionIndex < sections.length;
    sectionIndex++
  ) {
    const section =
      sections[sectionIndex]

    const branch =
      section.$lineSection.elements.find(
        element => '$branch' in element,
      )

    if (
      !branch
      || !('$branch' in branch)
    ) {
      continue
    }

    const ids =
      outputLineIds[
        sectionIndex as 0 | 1
      ]

    branch.$branch.primaryLineVisible =
      ids.has('primary')

    const additionalLines:
      BranchAdditionalLine[] = []

    for (
      const line
      of context?.additionalLines ?? []
    ) {
      if (ids.has(line.id)) {
        additionalLines.push({
          ...line,
        })
      }
    }

    if (
      targetLineId.value !== 'primary'
      && ids.has(targetLineId.value)
      && !additionalLines.some(
        line =>
          line.id === targetLineId.value,
      )
    ) {
      const target =
        targetAdditionalLine.value

      if (target) {
        additionalLines.push({
          ...target,
        })
      }
    }

    branch.$branch.additionalLines =
      additionalLines

    /*
     * Les lignes non ciblées restent disponibles pour les propriétés
     * des arrêts, mais Branch.vue les garde invisibles tant qu'aucun
     * arrêt de cette sortie ne les dessert.
     */
    const passthroughLineIds =
      Array.from(ids).filter(
        lineId =>
          lineId !== targetLineId.value,
      )

    const outputBranchData =
      branch.$branch as ForkOutputBranchData

    outputBranchData.passthroughLineIds =
      passthroughLineIds
  }

  schedulePassThroughRails()
}


watch(
  () => [
    meta.$fork.linksOffset[0],
    meta.$fork.linksOffset[1],
    meta.$fork.offsetMultiplier ?? 1,
  ],
  async () => {
    const sections = outputSections.value

    if (
      !sections
      || sections.length < 2
    ) {
      return
    }

    const multiplier =
      meta.$fork.offsetMultiplier
      ?? 1

    sections[0].$lineSection.levelOffset =
      meta.$fork.linksOffset[0]
      * multiplier

    sections[1].$lineSection.levelOffset =
      meta.$fork.linksOffset[1]
      * multiplier

    await nextTick()

    requestAnimationFrame(
      alignForkOutputSections,
    )
  },
  {
    immediate: true,
  },
)

const forkSections = computed(() =>
  hasExternalParallelBranches.value
    ? null
    : outputSections.value,
)

watch(
  renderedLinksOffsets,
  async () => {
    await nextTick()

    requestAnimationFrame(() => {
      alignForkOutputSections()
      emitForkExtent()
      schedulePassThroughRails()
    })
  },
)

const arrow = computed(() => {
  if (meta.$fork.directionalArrows === 'CW') {
    return rightArrow
  }

  if (meta.$fork.directionalArrows === 'CCW') {
    return leftArrow
  }

  return null
})

/*
 * Position historique des flèches.
 */
function getOriginalMiddlePoint(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return [
    (
      (
        fromX
        + effectiveClearance.value * flip
      )
      + (
        toX
        - effectiveClearance.value * flip
      )
    ) / 2,

    (fromY + toY) / 2,
  ]
}

/*
 * Position des flèches sur la variante arrondie.
 */
function getRoundedArrowPosition(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  if (fromOffset === toOffset) {
    return [
      (fromX + toX) / 2,
      fromY,
    ]
  }

  const startInnerX
    = fromX
      + effectiveClearance.value * flip

  const endInnerX
    = toX
      - effectiveClearance.value * flip

  const bendX
    = (startInnerX + endInnerX) / 2

  const horizontalDirection
    = Math.sign(endInnerX - startInnerX) || 1

  const horizontalSpace
    = Math.abs(endInnerX - startInnerX)

  const verticalSpace
    = Math.abs(toY - fromY)

  const radius = Math.min(
    size.value
    * 0.9
    * (meta.$fork.offsetMultiplier ?? 1),
    horizontalSpace / 4,
    verticalSpace / 2,
  )

  const afterBendX
    = bendX
      + horizontalDirection * radius

  return [
    (afterBendX + toX) / 2,
    toY,
  ]
}

function getArrowPosition(
  fromOffset: number,
  toOffset: number,
): [number, number] {
  if (forkStyle.value === 'ROUNDED') {
    return getRoundedArrowPosition(
      fromOffset,
      toOffset,
    )
  }

  return getOriginalMiddlePoint(
    fromOffset,
    toOffset,
  )
}

function getOriginalAngle(
  fromOffset: number,
  toOffset: number,
): number {
  const [
    fromX,
    toX,
    flip,
  ] = orientation.value

  const fromY = getY(fromOffset)
  const toY = getY(toOffset)

  return Math.round(
    Math.atan2(
      toY - fromY,
      (
        toX
        - effectiveClearance.value * flip
      )
      - (
        fromX
        + effectiveClearance.value * flip
      ),
    )
    * 180
    / Math.PI,
  )
}

function getArrowAngle(
  fromOffset: number,
  toOffset: number,
): number {
  if (forkStyle.value === 'ROUNDED') {
    return 0
  }

  return getOriginalAngle(
    fromOffset,
    toOffset,
  )
}

const linkOffsetsArrowPositions = computed(() => {
  return [
    getArrowPosition(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[0],
    ),

    getArrowPosition(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[1],
    ),
  ]
})

const linkOffsetsArrowRotations = computed(() => {
  return [
    getArrowAngle(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[0],
    ),

    getArrowAngle(
      meta.$fork.originOffset,
      renderedLinksOffsets.value[1],
    ),
  ]
})
</script>

<template>
  <div
    ref="el"
    class="fork flex-shrink-0"
    :data-fork-id="meta.id"
    :data-fork-line-id="targetLineId"
    :data-paired-parallel-branches-id="
      pairedParallelBranchesId
      ?? undefined
    "
    :class="{
      'toward-left': meta.$fork.toward === 'LEFT',
    }"
    :style="{
      marginLeft:
        overlayOffsetPx > 0
          ? `-${overlayOffsetPx}px`
          : undefined,
      marginRight:
        overlayCompensationPx > 0
          ? `${overlayCompensationPx}px`
          : undefined,
      transform: wrapperOffset,
    }"
  >
    <svg
      class="fork-svg"
      :width="`${normalWidth}px`"
      :height="`${maxHeight}px`"
      overflow="visible"
    >
      <SvgLine
        v-for="rail in passThroughRails"
        :key="`pass-through-${rail.id}`"
        :path="rail.path"
        :color="rail.color"
        :line-width="lineWidth"
        :striped="lineContext.lineStyle.value === 'STRIPED'"
      />

      <SvgLine
        :path="path"
        :color="color"
        :line-width="lineWidth"
        :striped="lineContext.lineStyle.value === 'STRIPED'"
      />

      <!--
        Flèche de la première branche.
      -->
      <g
        v-if="arrow !== null"
        :transform="`
          translate(
            ${linkOffsetsArrowPositions[0][0]}
            ${linkOffsetsArrowPositions[0][1]}
          )
        `"
      >
        <image
          :href="arrow"
          :transform="`
            rotate(
              ${
                linkOffsetsArrowRotations[0]
                + (
                  orientation[2] < 0
                    ? 180
                    : 0
                )
              }
            )
            translate(
              -29
              ${-22 - (lineWidth * 16)}
            )
            scale(.75)
          `"
        />
      </g>

      <!--
        Flèche de la seconde branche.
      -->
      <g
        v-if="arrow !== null"
        :transform="`
          translate(
            ${linkOffsetsArrowPositions[1][0]}
            ${linkOffsetsArrowPositions[1][1]}
          )
        `"
      >
        <image
          :href="arrow"
          :transform="`
            rotate(
              ${
                linkOffsetsArrowRotations[1]
                + (
                  orientation[2] > 0
                    ? 180
                    : 0
                )
              }
            )
            translate(
              -29
              ${-22 - (lineWidth * 16)}
            )
            scale(.75)
          `"
        />
      </g>
    </svg>

    <div
      v-if="forkSections"
      class="fork-sections"
      @click.stop
    >
      <div
        v-for="(_, i) in forkSections"
        :key="forkSections[i].id"
        class="fork-section"
        :style="{
          transform:
            `translateY(${forkOutputOffsetsPx[i]}px)`,

          '--fork-output-content-offset-x':
            `${forkOutputContentOffsetPx[i]}px`,
        }"
      >
        <SectionEditor
          v-model="forkSections[i]"
          :layout-level-offset="
            effectiveLinksOffsets[i]
          "
          inner
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fork {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  z-index: 1;

  &.toward-left {
    flex-direction: row-reverse;
  }
}

.fork-svg {
  display: block;
  flex: 0 0 auto;
}

.fork-sections {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-width: 1em;
}

.fork-section {
  height: 0;
  display: flex;
  flex-direction: row;
  align-items: center;

  /*
   * On décale seulement les arrêts / contenus.
   *
   * La .line de Branch.vue reste à sa hauteur et à son point
   * de raccord d'origine. Le margin-left participe au layout,
   * donc la Branch s'allonge pour continuer sous les arrêts décalés.
   */
  :deep(
    > .section
    > .elements
    > .section-element
    > .branch-wrapper
    > .branch-elements
  ) {
    margin-left:
      var(
        --fork-output-content-offset-x,
        0px
      );

    transition:
      margin-left .15s ease;
  }
}
</style>