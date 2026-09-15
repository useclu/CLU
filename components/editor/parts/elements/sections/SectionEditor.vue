<script setup lang="ts">
import type { SortableEvent } from 'vue-draggable-plus'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { v4 as uuidv4 } from 'uuid'
import { isBranch, isFork, isParallelBranches } from '~/utils/types'
import { useProject } from '~/stores/useProject'

const {
  inner = false,
  fluid = false,
  layoutLevelOffset,
} = defineProps<{
  inner?: boolean
  fluid?: boolean
  layoutLevelOffset?: number
}>()

const section = defineModel<LineSection>({ required: true })
const sectionRoot = ref<HTMLElement>()

const toast = useToast()
const project = useProject()

const elements = computed({
  get: () => section.value.$lineSection.elements,
  set: val => section.value.$lineSection.elements = val,
})

type ForkPairData =
  Fork['$fork'] & {
    parallelBranchesId?: string
  }

type ParallelBranchesPairData =
  ParallelBranches['$parallelBranches'] & {
    forkId?: string
  }

function pairedParallelBranchesForFork(
  fork: Fork,
): ParallelBranches | null {
  const pairId =
    (fork.$fork as ForkPairData)
      .parallelBranchesId

  if (!pairId) {
    return null
  }

  const pair =
    section.value.$lineSection.elements
      .find(
        element =>
          element.id === pairId,
      )

  return (
    pair
    && isParallelBranches(pair)
      ? pair
      : null
  )
}

function pairedForkForParallelBranches(
  parallelBranches: ParallelBranches,
): Fork | null {
  const forkId =
    (
      parallelBranches.$parallelBranches as ParallelBranchesPairData
    ).forkId

  if (!forkId) {
    return null
  }

  const fork =
    section.value.$lineSection.elements
      .find(
        element =>
          element.id === forkId,
      )

  return (
    fork
    && isFork(fork)
      ? fork
      : null
  )
}

/*
 * Fork.vue et le dialogue ParallelBranches ont besoin de retrouver
 * leur partenaire sans jamais se baser sur "le voisin le plus proche".
 * L'association est persistée par identifiants.
 */
provide(
  'parallelBranchesForFork',
  (
    forkId: string,
  ): ParallelBranches | null => {
    const fork =
      section.value.$lineSection.elements
        .find(
          element =>
            element.id === forkId,
        )

    return (
      fork
      && isFork(fork)
        ? pairedParallelBranchesForFork(fork)
        : null
    )
  },
)

provide(
  'forkForParallelBranches',
  (
    parallelBranchesId: string,
  ): Fork | null => {
    const pair =
      section.value.$lineSection.elements
        .find(
          element =>
            element.id
            === parallelBranchesId,
        )

    return (
      pair
      && isParallelBranches(pair)
        ? pairedForkForParallelBranches(pair)
        : null
    )
  },
)

/*
 * Les Branch de sortie d'un vrai ParallelBranches sont des siblings
 * de Fork.vue, donc elles ne peuvent plus hériter directement d'un
 * provide() placé dans Fork.vue.
 *
 * On garde un petit registre au niveau du SectionEditor commun :
 * Fork.vue y enregistre son calcul et toutes les SectionEditor enfants
 * peuvent le relire via la chaîne provide/inject.
 */
type ForkOutputGapProvider =
  (branchId: string) => number

const inheritedForkOutputGap =
  inject<ForkOutputGapProvider>(
    'forkOutputPrimaryLineGapForBranch',
    () => 0,
  )

const localForkOutputGapProviders =
  new Map<string, ForkOutputGapProvider>()

provide(
  'registerForkOutputPrimaryLineGapProvider',
  (
    forkId: string,
    provider: ForkOutputGapProvider,
  ) => {
    localForkOutputGapProviders.set(
      forkId,
      provider,
    )
  },
)

provide(
  'unregisterForkOutputPrimaryLineGapProvider',
  (
    forkId: string,
  ) => {
    localForkOutputGapProviders.delete(
      forkId,
    )
  },
)

provide(
  'forkOutputPrimaryLineGapForBranch',
  (
    branchId: string,
  ) => {
    for (
      const provider
      of localForkOutputGapProviders.values()
    ) {
      const value =
        provider(branchId)

      if (value > 0) {
        return value
      }
    }

    return inheritedForkOutputGap(
      branchId,
    )
  },
)

const offset = computed(() =>
  `calc(${
    layoutLevelOffset
    ?? section.value.$lineSection.levelOffset
    ?? 0
  } * -2.75em)`,
)

/*
 * Deux Fork de lignes différentes peuvent partager le même X.
 * Dès qu'une ligne déjà utilisée revient, un nouveau groupe commence.
 */
interface ForkGroupLayout {
  overlayOffsetPx: number
  overlayCompensationPx: number
}

const forkWidths =
  reactive<Record<string, number>>({})


interface ForkClearanceReport {
  up: number
  down: number
}

const forkClearances =
  reactive<Record<string, ForkClearanceReport>>({})

function setForkClearance(
  elementId: string,
  up: number,
  down: number,
) {
  if (
    !Number.isFinite(up)
    || !Number.isFinite(down)
  ) {
    return
  }

  const previous =
    forkClearances[elementId]

  if (
    previous
    && Math.abs(previous.up - up) < 0.02
    && Math.abs(previous.down - down) < 0.02
  ) {
    return
  }

  forkClearances[elementId] = {
    up: Math.max(0, up),
    down: Math.max(0, down),
  }
}

function setForkWidth(
  elementId: string,
  width: number,
) {
  if (
    !Number.isFinite(width)
    || width <= 0
  ) {
    return
  }

  if (
    Math.abs(
      (forkWidths[elementId] ?? 0)
      - width,
    ) < 0.5
  ) {
    return
  }

  forkWidths[elementId] = width
}

/*
 * VRAI GROUPE HORIZONTAL DE FORK
 *
 * Une Fork ne contient pas seulement son SVG :
 * elle contient aussi ses deux LineSection de sortie.
 *
 * L'ancien overlay retirait uniquement normalWidth, donc la
 * deuxième Fork restait repoussée par les sections de la première.
 *
 * Ici on utilise la largeur RÉELLE complète de chaque Fork.
 *
 * - première ligne du groupe : réserve sa largeur normalement ;
 * - ligne différente suivante : revient exactement au même X ;
 * - le groupe réserve ensuite max(largeur des Fork), pas leur somme ;
 * - une ligne déjà utilisée ouvre automatiquement un nouveau groupe.
 */
const forkGroupLayouts = computed(() => {
  const layouts: ForkGroupLayout[] = []

  let activeLines = new Set<string>()
  let groupWidth = 0

  for (
    const element
    of section.value.$lineSection.elements
  ) {
    if (!isFork(element)) {
      /*
       * Le vrai ParallelBranches appairé fait partie de la même unité
       * visuelle que sa Fork. Il ne doit donc pas casser un groupe de
       * Fork D/S superposées.
       */
      if (
        isParallelBranches(element)
        && pairedForkForParallelBranches(element)
      ) {
        layouts.push({
          overlayOffsetPx: 0,
          overlayCompensationPx: 0,
        })

        continue
      }

      activeLines = new Set()
      groupWidth = 0

      layouts.push({
        overlayOffsetPx: 0,
        overlayCompensationPx: 0,
      })

      continue
    }

    const lineId =
      element.$fork.lineId || 'primary'

    const width =
      forkWidths[element.id] ?? 0

    const startsNewGroup =
      activeLines.size === 0
      || activeLines.has(lineId)

    if (startsNewGroup) {
      activeLines =
        new Set([lineId])

      groupWidth = width

      layouts.push({
        overlayOffsetPx: 0,
        overlayCompensationPx: 0,
      })

      continue
    }

    /*
     * Le curseur flex se trouve à la FIN du groupe courant.
     * On revient donc de groupWidth pour remettre l'origine de
     * cette nouvelle Fork exactement sur l'origine du groupe.
     *
     * Si cette Fork est plus courte que le groupe courant,
     * compensation à droite pour conserver la largeur déjà réservée.
     */
    layouts.push({
      overlayOffsetPx:
        groupWidth,
      overlayCompensationPx:
        Math.max(
          0,
          groupWidth - width,
        ),
    })

    activeLines.add(lineId)

    groupWidth =
      Math.max(
        groupWidth,
        width,
      )
  }

  return layouts
})

/*
 * =========================================================
 * PAIRE DE FORK RÉELLEMENT SUPERPOSÉE
 * =========================================================
 *
 * Fork.vue ne doit pas chercher sa "voisine" dans tout le DOM ni dans
 * toute la topologie. SectionEditor connaît déjà la règle exacte qui
 * décide quelles Fork partagent le même X :
 *
 * - Fork consécutives ;
 * - lineId différents ;
 * - dès qu'un lineId revient, nouveau groupe.
 *
 * On expose donc uniquement la géométrie persistée de l'autre Fork du
 * même groupe. Aucun pixel et aucune donnée supplémentaire ne sont
 * enregistrés.
 */
interface ForkOverlayPeerGeometry {
  id: string
  lineId: string
  originOffset: number
  linksOffset: [number, number]
  offsetMultiplier: number
}

function forkOverlayPeerForElement(
  elementId: string,
): ForkOverlayPeerGeometry | null {
  const elements =
    section.value.$lineSection.elements

  const groups: Fork[][] = []

  let activeGroup: Fork[] = []
  let activeLines = new Set<string>()

  function flushGroup() {
    if (activeGroup.length > 0) {
      groups.push(activeGroup)
    }

    activeGroup = []
    activeLines = new Set()
  }

  for (const element of elements) {
    if (!isFork(element)) {
      if (
        isParallelBranches(element)
        && pairedForkForParallelBranches(element)
      ) {
        continue
      }

      flushGroup()
      continue
    }

    const lineId =
      element.$fork.lineId
      || 'primary'

    if (
      activeGroup.length === 0
      || activeLines.has(lineId)
    ) {
      flushGroup()

      activeGroup = [element]
      activeLines =
        new Set([lineId])

      continue
    }

    activeGroup.push(element)
    activeLines.add(lineId)
  }

  flushGroup()

  const group =
    groups.find(
      candidates =>
        candidates.some(
          candidate =>
            candidate.id === elementId,
        ),
    )

  if (
    !group
    || group.length < 2
  ) {
    return null
  }

  const current =
    group.find(
      candidate =>
        candidate.id === elementId,
    )

  if (!current) {
    return null
  }

  /*
   * Le cas travaillé aujourd'hui est D/S : une seule autre Fork.
   * Avec davantage de lignes on choisit la première Fork différente,
   * ce qui respecte déjà la règle de groupe de SectionEditor.
   */
  const peer =
    group.find(
      candidate =>
        candidate.id !== current.id
        && (
          candidate.$fork.lineId
          || 'primary'
        ) !== (
          current.$fork.lineId
          || 'primary'
        ),
    )

  if (!peer) {
    return null
  }

  return {
    id: peer.id,
    lineId:
      peer.$fork.lineId
      || 'primary',
    originOffset:
      peer.$fork.originOffset,
    linksOffset: [
      peer.$fork.linksOffset[0],
      peer.$fork.linksOffset[1],
    ],
    offsetMultiplier:
      peer.$fork.offsetMultiplier
      ?? 1,
  }
}

provide(
  'forkOverlayPeerForElement',
  forkOverlayPeerForElement,
)


/*
 * Clearance D/S déterministe.
 *
 * On ne mesure plus les Fork dans le DOM depuis Branch.vue :
 * leur encombrement vient directement de leur modèle.
 *
 * La principale est le rail haut du corridor.
 * Les lignes additionnelles sont sous la principale.
 */
const forkClearance = computed(() => {
  let primaryUp = 0
  let primaryDown = 0
  let secondaryUp = 0
  let secondaryDown = 0

  for (
    const element
    of section.value.$lineSection.elements
  ) {
    if (!isFork(element)) {
      continue
    }

    const liveClearance =
      forkClearances[element.id]

    const multiplier =
      element.$fork.offsetMultiplier ?? 1

    const origin =
      element.$fork.originOffset

    const highest =
      Math.max(
        ...element.$fork.linksOffset,
      )

    const lowest =
      Math.min(
        ...element.$fork.linksOffset,
      )

    const up =
      liveClearance?.up
      ?? (
        Math.max(
          0,
          highest - origin,
        )
        * 2.75
        * multiplier
      )

    const down =
      liveClearance?.down
      ?? (
        Math.max(
          0,
          origin - lowest,
        )
        * 2.75
        * multiplier
      )

    if (
      (element.$fork.lineId || 'primary')
      === 'primary'
    ) {
      primaryUp =
        Math.max(primaryUp, up)

      primaryDown =
        Math.max(primaryDown, down)
    }
    else {
      secondaryUp =
        Math.max(secondaryUp, up)

      secondaryDown =
        Math.max(secondaryDown, down)
    }
  }

  return {
    primaryUp,
    primaryDown,
    secondaryUp,
    secondaryDown,
  }
})

const sectionStyle = computed(() => ({
  '--fork-primary-up-em':
    `${forkClearance.value.primaryUp}`,
  '--fork-primary-down-em':
    `${forkClearance.value.primaryDown}`,
  '--fork-secondary-up-em':
    `${forkClearance.value.secondaryUp}`,
  '--fork-secondary-down-em':
    `${forkClearance.value.secondaryDown}`,
}))


interface ForkCorridorContext {
  sourceBranchId: string | null
  primaryVisible: boolean
  additionalLines: BranchAdditionalLine[]
  primaryLineGapEm: number
}


/*
 * =========================================================
 * ECART D/S STRUCTUREL, 100 % TOPOLOGIQUE
 * =========================================================
 *
 * Le bug avant/après F5 venait du fait que la hauteur de S
 * dépendait d'une mesure DOM effectuée à des moments différents.
 *
 * Ici on calcule le minimum imposé par les Fork directement
 * depuis leurs données persistées :
 *
 * - une Fork D qui descend réserve de la place sous D ;
 * - une Fork secondaire qui monte réserve de la place au-dessus ;
 * - 0.68em est la respiration déjà utilisée par Branch.vue.
 *
 * Aucun pixel n'est enregistré.
 */
const structuralPrimaryLineGapEm =
  computed(() => {
    let primaryDown = 0
    let secondaryUp = 0

    for (
      const element
      of section.value.$lineSection.elements
    ) {
      if (!isFork(element)) {
        continue
      }

      const multiplier =
        Math.max(
          0,
          element.$fork.offsetMultiplier
          ?? 1,
        )

      const origin =
        element.$fork.originOffset

      const highest =
        Math.max(
          ...element.$fork.linksOffset,
        )

      const lowest =
        Math.min(
          ...element.$fork.linksOffset,
        )

      if (
        (element.$fork.lineId || 'primary')
        === 'primary'
      ) {
        primaryDown =
          Math.max(
            primaryDown,
            Math.max(
              0,
              origin - lowest,
            )
            * 2.75
            * multiplier,
          )

        continue
      }

      secondaryUp =
        Math.max(
          secondaryUp,
          Math.max(
            0,
            highest - origin,
          )
          * 2.75
          * multiplier,
        )
    }

    if (
      primaryDown <= 0
      && secondaryUp <= 0
    ) {
      return 0
    }

    return (
      primaryDown
      + secondaryUp
      + 0.68
    )
  })

/*
 * Les Branch directes de cette Section utilisent ce minimum
 * immédiatement, y compris au premier rendu après F5.
 */
provide(
  'sectionStructuralPrimaryLineGapEm',
  () =>
    structuralPrimaryLineGapEm.value,
)

/*
 * Catalogue global d'identités secondaires.
 *
 * Sert uniquement à retrouver mode/index/couleur d'une ligne
 * citée par stop.$stop.lineIds. Cela ne dessine rien.
 */
const projectAdditionalLineCatalog =
  computed<BranchAdditionalLine[]>(() => {
    const result:
      BranchAdditionalLine[] = []

    const seen =
      new Set<string>()

    function scanSection(
      currentSection: LineSection,
    ) {
      for (
        const element
        of currentSection.$lineSection.elements ?? []
      ) {
        if (isBranch(element)) {
          for (
            const line
            of element.$branch.additionalLines ?? []
          ) {
            if (seen.has(line.id)) {
              continue
            }

            seen.add(line.id)

            result.push({
              ...line,
            })
          }
        }

        if ('$parallelBranches' in element) {
          for (
            const child
            of element.$parallelBranches.sections ?? []
          ) {
            scanSection(child)
          }
        }

        if (
          isFork(element)
          && !(
            element.$fork as ForkPairData
          ).parallelBranchesId
        ) {
          /*
           * Une Fork appairée est déjà parcourue via son vrai
           * ParallelBranches sibling. On évite de scanner deux fois
           * l'alias de compatibilité non sérialisé.
           */
          for (
            const child
            of element.$fork.sections ?? []
          ) {
            scanSection(child)
          }
        }
      }
    }

    for (
      const topSection
      of project.line.topology ?? []
    ) {
      scanSection(topSection)
    }

    return result
  })

function logicalLinesOfBranch(
  currentBranch: Branch,
): ForkCorridorContext {
  /*
   * Le corridor d'entrée d'une Fork vient uniquement
   * des rails réellement présents dans la Branch.
   *
   * Cocher S sur un arrêt ne crée pas S.
   * C'est la Fork précédente qui doit avoir fait continuer S.
   */
  return {
    sourceBranchId:
      currentBranch.id,

    primaryVisible:
      currentBranch.$branch.primaryLineVisible
      !== false,

    additionalLines:
      (
        currentBranch.$branch.additionalLines
        ?? []
      ).map(
        line => ({
          ...line,
        }),
      ),

    primaryLineGapEm:
      structuralPrimaryLineGapEm.value,
  }
}

function sourceBranchForForkAtIndex(
  index: number,
  fork: Fork,
): Branch | null {
  const currentElements =
    section.value.$lineSection.elements

  /*
   * IMPORTANT :
   * cette fonction est appelée PAR forkCorridorContexts.
   * Elle ne doit donc JAMAIS relire forkCorridorContexts.value,
   * sinon on crée une récursion de computed :
   *
   * forkCorridorContexts
   *   -> sourceBranchForForkAtIndex()
   *   -> forkCorridorContexts.value
   *   -> sourceBranchForForkAtIndex()
   *   -> ...
   *
   * Sur certains presets complexes (notamment la ligne 10),
   * cela finit en "Maximum call stack size exceeded" et déclenche
   * l'écran générique "Une erreur est survenue".
   *
   * On retrouve la Branch source directement dans la structure.
   *
   * RIGHT : la source est à gauche de la Fork.
   * LEFT  : la source est à droite de la Fork.
   *
   * Les Fork / ParallelBranches d'un même groupe D/S sont traversés :
   * ils ne constituent pas une frontière logique du corridor.
   */
  const step =
    fork.$fork.toward === 'LEFT'
      ? 1
      : -1

  for (
    let cursor = index + step;
    cursor >= 0
    && cursor < currentElements.length;
    cursor += step
  ) {
    const candidate =
      currentElements[cursor]

    if (isBranch(candidate)) {
      return candidate
    }

    if (
      isParallelBranches(candidate)
      || isFork(candidate)
    ) {
      continue
    }

    /*
     * Les autres éléments (Stop, Texte, etc.) ne cassent pas
     * la recherche de la Branch logique du corridor.
     */
  }

  return null
}

function forkOutputSections(
  fork: Fork,
): LineSection[] | null {
  const pair =
    pairedParallelBranchesForFork(fork)

  if (pair) {
    return pair.$parallelBranches.sections
  }

  return fork.$fork.sections ?? null
}



/*
 * Pour chaque élément de cette Section, contexte logique du dernier
 * Branch rencontré.
 *
 * Important :
 * dans une Section enfant issue d'une première Fork, c'est CET
 * SectionEditor enfant qui fournit son propre contexte à la Fork
 * imbriquée. Il n'y a donc aucune recherche ambiguë dans le DOM.
 */
const forkCorridorContexts = computed(() => {
  const currentElements =
    section.value.$lineSection.elements

  return currentElements.map(
    (element, index): ForkCorridorContext => {
      let sourceBranch: Branch | null = null

      if (isFork(element)) {
        sourceBranch =
          sourceBranchForForkAtIndex(
            index,
            element,
          )
      }
      else {
        for (
          let cursor = index;
          cursor >= 0;
          cursor--
        ) {
          const candidate =
            currentElements[cursor]

          if (isBranch(candidate)) {
            sourceBranch = candidate
            break
          }
        }
      }

      if (!sourceBranch) {
        return {
          sourceBranchId: null,
          primaryVisible: true,
          additionalLines: [],
          primaryLineGapEm:
            structuralPrimaryLineGapEm.value,
        }
      }

      return logicalLinesOfBranch(
        sourceBranch,
      )
    },
  )
})

/*
 * SectionElement actuel ne transmet pas encore les props de corridor.
 * Plutôt que refaire son placement visuel validé, SectionEditor fournit
 * directement une fonction injectable à toutes ses Fork descendantes.
 *
 * Une SectionEditor imbriquée remplace naturellement le provider parent.
 */
provide(
  'forkCorridorContextForElement',
  (
    elementId: string,
  ): ForkCorridorContext | null => {
    const index =
      section.value.$lineSection.elements
        .findIndex(
          element =>
            element.id === elementId,
        )

    if (index < 0) {
      return null
    }

    return (
      forkCorridorContexts.value[index]
      ?? null
    )
  },
)


/*
 * =========================================================
 * "APRÈS QUEL ARRÊT ?" : CORRECTION DU FLUX HORIZONTAL
 * =========================================================
 *
 * Le point important découvert ici :
 *
 * la Fork n'est PAS positionnée directement après .branch-wrapper.
 * Le flux horizontal de SectionEditor aligne des .section-element.
 *
 * Donc mesurer le bord de Branch.vue puis déplacer seulement
 * l'intérieur de Fork.vue ne corrige pas réellement la position
 * du composant dans le flex.
 *
 * On agit ici sur la RACINE .section-element de la Fork :
 *
 *   [SectionElement Branch ........ Corbeil ●   ]
 *                                             [SectionElement Fork]
 *
 * devient :
 *
 *   [SectionElement Branch ........ Corbeil ●]
 *                                      [SectionElement Fork]
 *
 * afterStopId reste la seule donnée persistée.
 * La distance en pixels n'est qu'une mesure de rendu.
 */
type ForkPlacementData =
  Fork['$fork'] & {
    afterStopId?: string | null
  }

const forkAnchorPullbackPx =
  reactive<Record<string, number>>({})

let forkAnchorFrame:
  number | null = null

let forkAnchorResizeObserver:
  ResizeObserver | null = null

function forkAfterStopId(
  fork: Fork,
) {
  return (
    (fork.$fork as ForkPlacementData)
      .afterStopId
    ?? null
  )
}

function measureForkAnchorPullbacks() {
  if (
    typeof window === 'undefined'
    || !sectionRoot.value
  ) {
    return
  }

  const liveForkIds =
    new Set<string>()

  section.value.$lineSection.elements
    .forEach((element, index) => {
      if (!isFork(element)) {
        return
      }

      liveForkIds.add(element.id)

      const stopId =
        forkAfterStopId(element)

      if (!stopId) {
        forkAnchorPullbackPx[element.id] = 0
        return
      }

      const sourceBranchId =
        forkCorridorContexts
          .value[index]
          ?.sourceBranchId

      if (!sourceBranchId) {
        forkAnchorPullbackPx[element.id] = 0
        return
      }

      const sourceBranch =
        sectionRoot.value
          ?.querySelector<HTMLElement>(
            `.branch-wrapper[data-branch-id="${CSS.escape(sourceBranchId)}"]`,
          )

      if (!sourceBranch) {
        return
      }

      const sourceSectionElement =
        sourceBranch.closest<HTMLElement>(
          '.section-element',
        )

      const stopElement =
        sourceBranch
          .querySelector<HTMLElement>(
            `.stop-wrapper[data-id="${CSS.escape(stopId)}"]`,
          )

      if (
        !sourceSectionElement
        || !stopElement
      ) {
        return
      }

      const dot =
        stopElement
          .querySelector<HTMLElement>(
            '.dot',
          )

      const stopRect =
        (dot ?? stopElement)
          .getBoundingClientRect()

      const sourceElementRect =
        sourceSectionElement
          .getBoundingClientRect()

      const stopCenterX =
        stopRect.left
        + stopRect.width / 2

      /*
       * Une Fork RIGHT entre par son bord gauche.
       * C'est le cas du sens de construction normal du plan.
       *
       * Le vide à supprimer est donc exactement la distance entre
       * le centre de l'arrêt choisi et la FIN DU FLEX ITEM source.
       *
       * Contrairement à l'essai précédent, on ne mesure plus
       * .branch-wrapper : on mesure .section-element, qui est la
       * vraie frontière utilisée par le flex de SectionEditor.
       */
      const pullback =
        element.$fork.toward === 'RIGHT'
          ? Math.max(
              0,
              sourceElementRect.right
              - stopCenterX,
            )
          : 0

      if (
        Math.abs(
          (
            forkAnchorPullbackPx[
              element.id
            ] ?? 0
          )
          - pullback,
        ) > 0.25
      ) {
        forkAnchorPullbackPx[
          element.id
        ] = pullback
      }
    })

  Object.keys(
    forkAnchorPullbackPx,
  ).forEach((forkId) => {
    if (!liveForkIds.has(forkId)) {
      delete forkAnchorPullbackPx[forkId]
    }
  })
}

function scheduleForkAnchorPullback() {
  if (
    typeof window === 'undefined'
  ) {
    return
  }

  if (forkAnchorFrame !== null) {
    cancelAnimationFrame(
      forkAnchorFrame,
    )
  }

  forkAnchorFrame =
    requestAnimationFrame(
      async () => {
        forkAnchorFrame = null

        await nextTick()

        measureForkAnchorPullbacks()
      },
    )
}

const forkAnchorSignature =
  computed(() =>
    JSON.stringify(
      section.value.$lineSection.elements
        .map((element) => {
          if (isBranch(element)) {
            return {
              type: 'BRANCH',
              id: element.id,
              children:
                (
                  element.$branch.elements
                  ?? []
                ).map(
                  child =>
                    child.id,
                ),
            }
          }

          if (isFork(element)) {
            return {
              type: 'FORK',
              id: element.id,
              toward:
                element.$fork.toward,
              afterStopId:
                forkAfterStopId(
                  element,
                ),
            }
          }

          return {
            type: 'OTHER',
            id: element.id,
          }
        }),
    ),
  )

watch(
  forkAnchorSignature,
  scheduleForkAnchorPullback,
  {
    immediate: true,
    flush: 'post',
  },
)

/*
 * Ce style est appliqué au composant SectionElement lui-même.
 * Vue le fusionne avec le :style="{ zIndex }" de sa racine.
 *
 * Très important :
 * une seconde Fork superposée du même groupe D/S possède déjà
 * forkGroupLayouts[i].overlayOffsetPx > 0. Elle suit donc la
 * première Fork et ne reçoit PAS une deuxième correction.
 */
function sectionElementAnchorStyle(
  element:
    LineSection['$lineSection']['elements'][number],
  index: number,
) {
  /*
   * Avec un vrai ParallelBranches sibling, une Fork + son PB forment
   * une SEULE unité horizontale.
   *
   * Pour une seconde Fork D/S superposée, déplacer seulement le contenu
   * interne de Fork.vue laissait son PB dans le flux normal :
   *
   *   Fork 2 déplacée à gauche  +  PB 2 resté à droite
   *                            => grand trou entre les deux.
   *
   * On déplace donc maintenant le PREMIER SectionElement de la paire.
   * Le second suit naturellement dans le flex.
   */
  if (isParallelBranches(element)) {
    const fork =
      pairedForkForParallelBranches(
        element,
      )

    if (!fork) {
      return undefined
    }

    const forkIndex =
      section.value.$lineSection.elements
        .findIndex(
          candidate =>
            candidate.id === fork.id,
        )

    if (forkIndex < 0) {
      return undefined
    }

    const layout =
      forkGroupLayouts.value[forkIndex]

    const overlayOffset =
      layout?.overlayOffsetPx
      ?? 0

    const compensation =
      layout?.overlayCompensationPx
      ?? 0

    const style:
      Record<string, string> = {}

    /*
     * LEFT => ordre DOM : PB puis Fork.
     * Le PB est donc le premier élément de l'unité et porte le recul.
     */
    if (
      fork.$fork.toward === 'LEFT'
      && overlayOffset > 0
    ) {
      style.marginLeft =
        `-${overlayOffset}px`
    }

    /*
     * RIGHT => ordre DOM : Fork puis PB.
     * Le PB est le dernier élément : c'est lui qui réserve la
     * compensation de largeur du groupe.
     */
    if (
      fork.$fork.toward === 'RIGHT'
      && compensation > 0
    ) {
      style.marginRight =
        `${compensation}px`
    }

    return (
      Object.keys(style).length > 0
        ? style
        : undefined
    )
  }

  if (!isFork(element)) {
    return undefined
  }

  const pair =
    pairedParallelBranchesForFork(
      element,
    )

  const layout =
    forkGroupLayouts.value[index]

  const overlayOffset =
    layout?.overlayOffsetPx
    ?? 0

  const compensation =
    layout?.overlayCompensationPx
    ?? 0

  if (pair) {
    const style:
      Record<string, string> = {}

    /*
     * RIGHT => ordre DOM : Fork puis PB.
     * La Fork est le premier élément de l'unité :
     * le recul est appliqué à son SectionElement complet, ce qui
     * entraîne aussi le PB qui vient juste derrière.
     */
    if (
      element.$fork.toward === 'RIGHT'
      && overlayOffset > 0
    ) {
      style.marginLeft =
        `-${overlayOffset}px`
    }

    /*
     * LEFT => ordre DOM : PB puis Fork.
     * La Fork est le dernier élément de l'unité :
     * elle réserve la compensation éventuelle à droite.
     */
    if (
      element.$fork.toward === 'LEFT'
      && compensation > 0
    ) {
      style.marginRight =
        `${compensation}px`
    }

    if (Object.keys(style).length > 0) {
      return style
    }

    /*
     * Une Fork appairée non superposée garde le comportement d'ancrage
     * "après quel arrêt ?" déjà validé.
     */
    const pullback =
      forkAnchorPullbackPx[
        element.id
      ] ?? 0

    if (pullback > 0) {
      return {
        marginLeft:
          `-${pullback}px`,
      }
    }

    return undefined
  }

  /*
   * Ancien modèle / compatibilité :
   * comportement historique inchangé.
   */
  if (overlayOffset > 0) {
    return undefined
  }

  const pullback =
    forkAnchorPullbackPx[
      element.id
    ] ?? 0

  if (pullback <= 0) {
    return undefined
  }

  return {
    marginLeft:
      `-${pullback}px`,
  }
}

function forkOverlayOffsetForElement(
  element:
    LineSection['$lineSection']['elements'][number],
  index: number,
) {
  if (!isFork(element)) {
    return 0
  }

  /*
   * Si la Fork possède un vrai PB sibling, le recul est désormais
   * appliqué au SectionElement de la paire par sectionElementAnchorStyle().
   * Il ne faut surtout pas le réappliquer à l'intérieur de Fork.vue.
   */
  if (pairedParallelBranchesForFork(element)) {
    return 0
  }

  return (
    forkGroupLayouts.value[index]
      ?.overlayOffsetPx
    ?? 0
  )
}

function forkOverlayCompensationForElement(
  element:
    LineSection['$lineSection']['elements'][number],
  index: number,
) {
  if (!isFork(element)) {
    return 0
  }

  /*
   * Avec des sorties externes, la compensation doit être réservée
   * APRÈS le vrai ParallelBranches, pas entre le SVG de Fork et ses
   * sorties. sectionElementAnchorStyle() l'applique donc au partenaire.
   */
  if (pairedParallelBranchesForFork(element)) {
    return 0
  }

  return (
    forkGroupLayouts.value[index]
      ?.overlayCompensationPx
    ?? 0
  )
}

onMounted(async () => {
  await nextTick()

  scheduleForkAnchorPullback()

  if (
    typeof ResizeObserver
    === 'undefined'
    || !sectionRoot.value
  ) {
    return
  }

  forkAnchorResizeObserver =
    new ResizeObserver(
      scheduleForkAnchorPullback,
    )

  forkAnchorResizeObserver.observe(
    sectionRoot.value,
  )
})

onBeforeUnmount(() => {
  forkAnchorResizeObserver
    ?.disconnect()

  forkAnchorResizeObserver = null

  if (
    forkAnchorFrame !== null
  ) {
    cancelAnimationFrame(
      forkAnchorFrame,
    )

    forkAnchorFrame = null
  }
})


type ForkOutputBranchData =
  Branch['$branch'] & {
    passthroughLineIds?: string[]
  }

/*
 * =========================================================
 * SYNCHRO REACTIVE DES SORTIES DE FORK
 * =========================================================
 *
 * Cette synchronisation ne dépend ni de @add, ni de onMounted,
 * ni du DOM. Elle observe directement le modèle de la Section.
 * Dès que VueDraggable a réellement inséré une Fork après une
 * Branch, les deux sorties sont mises dans le même état logique
 * que celui obtenu après F5.
 */
function syncForkOutputsFromSectionModel() {
  const currentElements =
    section.value.$lineSection.elements

  for (
    let elementIndex = 0;
    elementIndex < currentElements.length;
    elementIndex++
  ) {
    const element =
      currentElements[elementIndex]

    if (!isFork(element)) {
      continue
    }

    const sourceBranch =
      sourceBranchForForkAtIndex(
        elementIndex,
        element,
      )

    const sections =
      forkOutputSections(element)

    if (
      !sourceBranch
      || !sections
      || sections.length < 2
    ) {
      continue
    }

    const targetLineId =
      element.$fork.lineId
      || 'primary'

    const inputLines: Array<{
      id: string
      additional: BranchAdditionalLine | null
    }> = [
      ...(
        sourceBranch.$branch.primaryLineVisible
        !== false
          ? [{
              id: 'primary',
              additional: null,
            }]
          : []
      ),

      ...(
        sourceBranch.$branch.additionalLines
        ?? []
      ).map(line => ({
        id: line.id,
        additional: line,
      })),
    ]

    const targetRank =
      inputLines.findIndex(
        line =>
          line.id === targetLineId,
      )

    if (targetRank < 0) {
      continue
    }

    const topOutputIndex: 0 | 1 =
      element.$fork.linksOffset[0]
        >= element.$fork.linksOffset[1]
        ? 0
        : 1

    const bottomOutputIndex: 0 | 1 =
      topOutputIndex === 0
        ? 1
        : 0

    const outputIds: [Set<string>, Set<string>] = [
      new Set([targetLineId]),
      new Set([targetLineId]),
    ]

    inputLines.forEach(
      (line, lineIndex) => {
        if (line.id === targetLineId) {
          return
        }

        const destination =
          lineIndex < targetRank
            ? topOutputIndex
            : bottomOutputIndex

        outputIds[destination].add(
          line.id,
        )
      },
    )

    for (
      let outputIndex = 0;
      outputIndex < 2;
      outputIndex++
    ) {
      const outputSection =
        sections[outputIndex]

      if (!outputSection) {
        continue
      }

      const outputBranch =
        outputSection.$lineSection.elements.find(
          child => isBranch(child),
        )

      if (
        !outputBranch
        || !isBranch(outputBranch)
      ) {
        continue
      }

      const ids =
        outputIds[outputIndex as 0 | 1]

      const nextPrimaryVisible =
        ids.has('primary')

      if (
        outputBranch.$branch.primaryLineVisible
        !== nextPrimaryVisible
      ) {
        outputBranch.$branch.primaryLineVisible =
          nextPrimaryVisible
      }

      const nextAdditionalLines =
        inputLines
          .filter(
            line =>
              line.additional !== null
              && ids.has(line.id),
          )
          .map(
            line => ({
              ...line.additional!,
            }),
          )

      if (
        JSON.stringify(
          outputBranch.$branch.additionalLines
          ?? [],
        )
        !== JSON.stringify(
          nextAdditionalLines,
        )
      ) {
        outputBranch.$branch.additionalLines =
          nextAdditionalLines
      }

      const outputData =
        outputBranch.$branch as ForkOutputBranchData

      const nextPassthroughLineIds =
        Array.from(ids).filter(
          lineId =>
            lineId !== targetLineId,
        )

      if (
        JSON.stringify(
          outputData.passthroughLineIds
          ?? [],
        )
        !== JSON.stringify(
          nextPassthroughLineIds,
        )
      ) {
        outputData.passthroughLineIds =
          nextPassthroughLineIds
      }
    }
  }
}

/*
 * On observe seulement le corridor d'entrée et la configuration
 * directe des Fork. Les Branch de sortie ne sont pas dans cette
 * signature, donc la synchronisation ci-dessus ne boucle pas.
 */
const forkInputTopologySignature =
  computed(() =>
    JSON.stringify(
      section.value.$lineSection.elements.map(
        element => {
          if (isBranch(element)) {
            return {
              type: 'BRANCH',
              id: element.id,
              primaryLineVisible:
                element.$branch.primaryLineVisible
                !== false,
              additionalLines:
                (
                  element.$branch.additionalLines
                  ?? []
                ).map(line => ({
                  id: line.id,
                  mode: line.mode,
                  index: line.index,
                  color: line.color,
                })),
            }
          }

          if (isFork(element)) {
            return {
              type: 'FORK',
              id: element.id,
              lineId:
                element.$fork.lineId
                || 'primary',
              linksOffset: [
                element.$fork.linksOffset[0],
                element.$fork.linksOffset[1],
              ],
            }
          }

          return {
            type: 'OTHER',
            id: element.id,
          }
        },
      ),
    ),
  )

watch(
  forkInputTopologySignature,
  () => {
    syncForkOutputsFromSectionModel()
  },
  {
    immediate: true,
    flush: 'post',
  },
)



/*
 * =========================================================
 * F5 LOCAL DE LA FORK QUAND D/S CHANGE SUR UN ARRÊT
 * =========================================================
 *
 * Le F5 complet fonctionne parce que Fork.vue est RECRÉÉ avec
 * stop.$stop.lineIds déjà dans son état final.
 *
 * Les essais précédents ont relancé des fonctions internes ou
 * remonté seulement les SectionEditor enfants. Ce n'est pas la
 * même chose : passThroughRails et toute l'initialisation vivent
 * dans Fork.vue lui-même.
 *
 * Ici on change uniquement la key de SectionElement pour UNE Fork
 * lorsque l'appartenance D/S d'un arrêt de ses sorties change.
 *
 * Vue détruit/recrée donc cette Fork uniquement :
 * même onMounted que le F5, sans recharger la page.
 */
function forkOutputLineMembershipSignature(
  fork: Fork,
) {
  const parts: string[] = []

  for (
    const outputSection
    of forkOutputSections(fork) ?? []
  ) {
    for (
      const outputElement
      of outputSection.$lineSection.elements ?? []
    ) {
      if (!isBranch(outputElement)) {
        continue
      }

      for (
        const branchElement
        of outputElement.$branch.elements ?? []
      ) {
        if (!('$stop' in branchElement)) {
          continue
        }

        const lineIds =
          (
            branchElement.$stop as Stop['$stop'] & {
              lineIds?: string[]
            }
          ).lineIds
          ?? []

        parts.push(
          `${branchElement.id}:${
            [...lineIds]
              .sort()
              .join(',')
          }`,
        )
      }
    }
  }

  return parts.join('|')
}

/*
 * Signature STRICTEMENT structurelle des Fork directes de cette Section.
 *
 * Pourquoi :
 * un F5 complet recrée toutes les Fork avec le corridor D/S déjà dans
 * son état final. En live, ajouter / retirer une Fork change la géométrie
 * structurelle de la Section mais les Fork déjà montées gardent leur
 * instance et donc certains états de rendu internes.
 *
 * Cette signature sert uniquement à la key Vue des Fork :
 * - ajout d'une Fork   => recréation locale des Fork de cette Section ;
 * - retrait d'une Fork => recréation locale des Fork de cette Section ;
 * - changement de géométrie d'une Fork => même recalage local.
 *
 * Elle ne touche ni Branch.vue, ni les données persistées, ni le gap D/S.
 */
const sectionForkLayoutSignature =
  computed(() =>
    JSON.stringify(
      section.value.$lineSection.elements
        .filter(
          element => isFork(element),
        )
        .map(element => ({
          id: element.id,
          lineId:
            element.$fork.lineId
            || 'primary',
          originOffset:
            element.$fork.originOffset,
          linksOffset: [
            element.$fork.linksOffset[0],
            element.$fork.linksOffset[1],
          ],
          offsetMultiplier:
            element.$fork.offsetMultiplier
            ?? 1,
        })),
    ),
  )

function sectionElementRenderKey(
  element: LineSection['$lineSection']['elements'][number],
) {
  if (!isFork(element)) {
    return element.id
  }

  return (
    `${element.id}::layout=`
    + sectionForkLayoutSignature.value
    + '::membership='
    + forkOutputLineMembershipSignature(
      element,
    )
  )
}



/*
 * =========================================================
 * FOURCHE <-> VRAI PARALLELBRANCHES : APPARIEMENT MANUEL
 * =========================================================
 *
 * Nouveau comportement :
 *
 *   1. déposer une Fork        => la Fork reste SEULE ;
 *   2. déposer manuellement un ParallelBranches juste à côté ;
 *   3. SectionEditor associe alors la paire par IDs.
 *
 * Aucun ParallelBranches n'est donc créé automatiquement.
 *
 * Une fois la paire créée, on conserve exactement le moteur validé :
 *
 *   fork.$fork.parallelBranchesId
 *   parallel.$parallelBranches.forkId
 *
 * et fork.$fork.sections devient un alias runtime NON sérialisé vers
 * les sections du vrai ParallelBranches. Toute la logique D/S existante
 * peut ainsi continuer à fonctionner sans dupliquer la topologie.
 */
function linkForkAndParallelBranches(
  fork: Fork,
  parallelBranches: ParallelBranches,
) {
  const forkData =
    fork.$fork as ForkPairData

  const parallelData =
    (
      parallelBranches.$parallelBranches as ParallelBranchesPairData
    )

  forkData.parallelBranchesId =
    parallelBranches.id

  parallelData.forkId =
    fork.id

  delete fork.$fork.sections

  Object.defineProperty(
    fork.$fork,
    'sections',
    {
      value:
        parallelBranches
          .$parallelBranches
          .sections,
      writable: true,
      configurable: true,
      enumerable: false,
    },
  )
}

function clearRuntimeForkPairAlias(
  fork: Fork,
) {
  const descriptor =
    Object.getOwnPropertyDescriptor(
      fork.$fork,
      'sections',
    )

  /*
   * On supprime uniquement l'alias runtime créé par
   * linkForkAndParallelBranches().
   *
   * Une ancienne Fork de projet qui possède encore de vraies
   * $fork.sections énumérables reste intacte.
   */
  if (
    descriptor
    && descriptor.enumerable === false
  ) {
    delete fork.$fork.sections
  }
}

function preferredManualParallelNeighbor(
  forkIndex: number,
  fork: Fork,
): ParallelBranches | null {
  const currentElements =
    section.value.$lineSection.elements

  /*
   * L'utilisateur peut déposer le PB "après" une Fork RIGHT.
   * Pour une Fork LEFT on accepte aussi ce geste : une fois appairé,
   * movePairedParallelBranches() le replace automatiquement avant.
   *
   * On regarde donc les deux voisins, avec priorité au côté attendu.
   */
  const preferredIndex =
    fork.$fork.toward === 'LEFT'
      ? forkIndex - 1
      : forkIndex + 1

  const fallbackIndex =
    fork.$fork.toward === 'LEFT'
      ? forkIndex + 1
      : forkIndex - 1

  for (
    const candidateIndex
    of [preferredIndex, fallbackIndex]
  ) {
    const candidate =
      currentElements[candidateIndex]

    if (
      !candidate
      || !isParallelBranches(candidate)
    ) {
      continue
    }

    const pairData =
      (
        candidate.$parallelBranches as ParallelBranchesPairData
      )

    /*
     * Un PB déjà lié à une autre Fork ne peut jamais être volé.
     */
    if (
      pairData.forkId
      && pairData.forkId !== fork.id
    ) {
      continue
    }

    return candidate
  }

  return null
}

function movePairedParallelBranches(
  forkId: string,
) {
  const currentElements =
    section.value.$lineSection.elements

  let forkIndex =
    currentElements.findIndex(
      element =>
        element.id === forkId,
    )

  if (forkIndex < 0) {
    return
  }

  const fork =
    currentElements[forkIndex]

  if (!isFork(fork)) {
    return
  }

  const pair =
    pairedParallelBranchesForFork(fork)

  if (!pair) {
    return
  }

  const pairIndex =
    currentElements.findIndex(
      element =>
        element.id === pair.id,
    )

  if (pairIndex < 0) {
    return
  }

  const wantsBefore =
    fork.$fork.toward === 'LEFT'

  const alreadyCorrect =
    wantsBefore
      ? pairIndex === forkIndex - 1
      : pairIndex === forkIndex + 1

  if (alreadyCorrect) {
    return
  }

  currentElements.splice(
    pairIndex,
    1,
  )

  forkIndex =
    currentElements.findIndex(
      element =>
        element.id === forkId,
    )

  if (forkIndex < 0) {
    return
  }

  currentElements.splice(
    wantsBefore
      ? forkIndex
      : forkIndex + 1,
    0,
    pair,
  )

  pair.$parallelBranches.alignement =
    wantsBefore
      ? 'RIGHT'
      : 'LEFT'
}

function restorePersistedForkParallelPairs() {
  const currentElements =
    section.value.$lineSection.elements

  /*
   * 1. Les IDs persistés sont la source de vérité après F5.
   * On recrée seulement l'alias runtime $fork.sections.
   */
  for (const element of currentElements) {
    if (!isParallelBranches(element)) {
      continue
    }

    const forkId =
      (
        element.$parallelBranches as ParallelBranchesPairData
      ).forkId

    if (!forkId) {
      continue
    }

    const fork =
      currentElements.find(
        candidate =>
          candidate.id === forkId,
      )

    if (
      fork
      && isFork(fork)
    ) {
      linkForkAndParallelBranches(
        fork,
        element,
      )

      movePairedParallelBranches(
        fork.id,
      )
    }
  }

  /*
   * 2. Si le PB lié a été supprimé manuellement, la Fork redevient
   * immédiatement une Fork seule.
   */
  for (const element of currentElements) {
    if (!isFork(element)) {
      continue
    }

    const forkData =
      element.$fork as ForkPairData

    if (!forkData.parallelBranchesId) {
      continue
    }

    const pair =
      currentElements.find(
        candidate =>
          candidate.id
          === forkData.parallelBranchesId,
      )

    if (
      pair
      && isParallelBranches(pair)
    ) {
      continue
    }

    delete forkData.parallelBranchesId

    clearRuntimeForkPairAlias(
      element,
    )
  }

  syncForkOutputsFromSectionModel()
}

function initializeManualPairLevels(
  fork: Fork,
  parallelBranches: ParallelBranches,
) {
  const multiplier =
    fork.$fork.offsetMultiplier
    ?? 1

  const sections =
    parallelBranches
      .$parallelBranches
      .sections

  if (sections[0]) {
    sections[0].$lineSection.levelOffset =
      fork.$fork.linksOffset[0]
      * multiplier
  }

  if (sections[1]) {
    sections[1].$lineSection.levelOffset =
      fork.$fork.linksOffset[1]
      * multiplier
  }

  parallelBranches
    .$parallelBranches
    .alignement =
      fork.$fork.toward === 'LEFT'
        ? 'RIGHT'
        : 'LEFT'
}

/*
 * Appelé UNIQUEMENT lors d'un @add.
 *
 * Une Fork ajoutée depuis la toolbox ne crée rien.
 * Un ParallelBranches ajouté manuellement peut, lui, s'appairer à
 * une Fork adjacente encore libre.
 */
async function pairNewManualParallelBranches(
  event: SortableEvent,
) {
  if (event.pullMode !== 'clone') {
    return
  }

  const hintedIndex =
    event.newIndex

  if (hintedIndex === undefined) {
    return
  }

  await nextTick()

  const currentElements =
    section.value.$lineSection.elements

  const inserted =
    currentElements[hintedIndex]

  if (
    !inserted
    || !isParallelBranches(inserted)
  ) {
    return
  }

  const insertedPairData =
    (
      inserted.$parallelBranches as ParallelBranchesPairData
    )

  /*
   * Déplacement / ancien élément déjà appairé :
   * on ne crée jamais une nouvelle association.
   */
  if (insertedPairData.forkId) {
    return
  }

  const candidateIndexes = [
    hintedIndex - 1,
    hintedIndex + 1,
  ]

  for (const candidateIndex of candidateIndexes) {
    const candidate =
      currentElements[candidateIndex]

    if (
      !candidate
      || !isFork(candidate)
    ) {
      continue
    }

    const forkData =
      candidate.$fork as ForkPairData

    const existingPair =
      forkData.parallelBranchesId
        ? currentElements.find(
            element =>
              element.id
              === forkData.parallelBranchesId,
          )
        : null

    /*
     * Cette Fork possède déjà son propre PB.
     */
    if (
      existingPair
      && isParallelBranches(existingPair)
    ) {
      continue
    }

    /*
     * Si un ancien ID est devenu orphelin, on le nettoie avant
     * d'établir la nouvelle paire manuelle.
     */
    if (forkData.parallelBranchesId) {
      delete forkData.parallelBranchesId
      clearRuntimeForkPairAlias(candidate)
    }

    initializeManualPairLevels(
      candidate,
      inserted,
    )

    linkForkAndParallelBranches(
      candidate,
      inserted,
    )

    movePairedParallelBranches(
      candidate.id,
    )

    syncForkOutputsFromSectionModel()

    return
  }
}

const forkParallelPairSignature =
  computed(() =>
    JSON.stringify(
      section.value.$lineSection.elements.map(
        element => {
          if (isFork(element)) {
            return {
              type: 'FORK',
              id: element.id,
              toward:
                element.$fork.toward,
              pairId:
                (
                  element.$fork as ForkPairData
                ).parallelBranchesId
                ?? null,
              hasSections:
                Boolean(
                  element.$fork.sections,
                ),
            }
          }

          if (isParallelBranches(element)) {
            return {
              type: 'PARALLEL_BRANCHES',
              id: element.id,
              forkId:
                (
                  element.$parallelBranches as ParallelBranchesPairData
                ).forkId
                ?? null,
            }
          }

          return {
            type: 'OTHER',
            id: element.id,
          }
        },
      ),
    ),
  )

watch(
  forkParallelPairSignature,
  async () => {
    await nextTick()

    restorePersistedForkParallelPairs()
  },
  {
    immediate: true,
    flush: 'post',
  },
)

type Action =
  | 'ADD'
  | 'REMOVE'
  | 'UPDATE'

function mergeAdjacentBranches() {
  const elements = section.value.$lineSection.elements
  let hasMerged = false

  for (let i = 0; i < elements.length - 1; i++) {
    const a = elements[i]
    const b = elements[i + 1]

    if (isBranch(a) && isBranch(b)) {
      hasMerged = true

      a.$branch.elements.push(
        ...b.$branch.elements,
      )

      elements.splice(i + 1, 1)

      i--
    }
  }

  return hasMerged
}

function onAction(
  action: Action,
  event: SortableEvent,
) {
  if (mergeAdjacentBranches()) {
    if (
      action === 'ADD'
      && event.pullMode === 'clone'
    ) {
      toast.add({
        summary:
          'ui.toasts.adjacent_branches.title',
        detail:
          'ui.toasts.adjacent_branches.detail',
        severity: 'warn',
        life: 10000,
      })
    } else {
      toast.add({
        summary:
          'ui.toasts.branch_merge.title',
        detail:
          'ui.toasts.branch_merge.detail',
        severity: 'info',
        life: 5000,
      })
    }
  }

  if (action === 'ADD') {
    /*
     * Une Fork reste volontairement seule.
     *
     * La seule association créée automatiquement ici est celle demandée
     * explicitement par l'utilisateur lorsqu'il dépose MANUELLEMENT un
     * vrai ParallelBranches juste à côté d'une Fork libre.
     */
    void pairNewManualParallelBranches(
      event,
    )

    void nextTick().then(() => {
      restorePersistedForkParallelPairs()
    })
  }
}
</script>

<template>
  <div
    ref="sectionRoot"
    class="section"
    :class="{
      inner,
      fluid,
      empty: elements.length === 0,
    }"
    :style="sectionStyle"
  >
    <VueDraggable
      v-model="elements"
      :animation="150"
      class="elements open"
      group="sectionElements"
      ghost-class="section-ghost"
      :swap-threshold="inner ? .5 : .25"
      @update="e => onAction('UPDATE', e)"
      @add="e => onAction('ADD', e)"
      @remove="e => onAction('REMOVE', e)"
    >
      <SectionElement
        v-for="(element, i) in elements"
        :key="sectionElementRenderKey(element)"
        v-model="elements[i]"
        :fluid="fluid"
        :style="
          sectionElementAnchorStyle(
            element,
            i,
          )
        "
        :fork-overlay-offset-px="
          forkOverlayOffsetForElement(
            element,
            i,
          )
        "
        :fork-overlay-compensation-px="
          forkOverlayCompensationForElement(
            element,
            i,
          )
        "
        :fork-corridor-primary-visible="
          forkCorridorContexts[i]?.primaryVisible ?? true
        "
        :fork-corridor-additional-lines="
          forkCorridorContexts[i]?.additionalLines ?? []
        "
        @fork-extent-change="setForkWidth"
        @fork-clearance-change="setForkClearance"
      />
    </VueDraggable>
  </div>
</template>

<style lang="scss">
.section-ghost {
  opacity: .5;
}
</style>

<style scoped lang="scss">
.section {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: .5em;
  transform: translateY(v-bind(offset));
  min-width: 1em;
  outline: 1px dashed transparent;
  border-radius: .25em;
  transition: outline-color .3s ease;

  &.fluid {
    width: 100%;
  }

  .section:hover > &,
  &:hover,
  &.empty {
    outline-color: var(--p-slate-300);
  }

  &.inner.empty {
    outline-color: var(--p-orange-500);
    background-color: var(--p-orange-100);
  }

  .section-handle {
    position: absolute;
    top: .125em;
    left: .125em;
    cursor: grab;

    i {
      display: block;
      color: var(--p-slate-400);
      font-size: .375em;
    }
  }
}

.elements {
  display: flex;
  flex-direction: row;
  align-items: stretch;

  .inner > & {
    min-height: 2em;
  }

  :not(.inner) > & {
    min-height: 5em;
  }

  :not(.inner) > & > :not(.placeholder) {
    &:first-child {
      padding-left: 1em;
    }

    &:last-child {
      padding-right: 1em;
    }
  }

  .placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.open {
  padding: 0 2em;
  margin: 0 -2em;

  .debug & {
    outline: 1px dashed lime;
  }

  .elements .element:not(:last-child) & {
    padding-right: 0;
    margin-right: 0;
  }
  .elements .element:not(:first-child) & {
    padding-left: 0;
    margin-left: 0;
  }
}
</style>