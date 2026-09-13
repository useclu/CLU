<script setup lang="ts">
import type { SortableEvent } from 'vue-draggable-plus'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
} from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { isBranch, isFork } from '~/utils/types'
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

        if (isFork(element)) {
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
  const contexts:
    ForkCorridorContext[] = []

  let current:
    ForkCorridorContext = {
      sourceBranchId: null,
      primaryVisible: true,
      additionalLines: [],
      primaryLineGapEm:
        structuralPrimaryLineGapEm.value,
    }

  for (
    const element
    of section.value.$lineSection.elements
  ) {
    if (isBranch(element)) {
      current =
        logicalLinesOfBranch(
          element,
        )
    }

    contexts.push({
      sourceBranchId:
        current.sourceBranchId,

      primaryVisible:
        current.primaryVisible,

      additionalLines:
        current.additionalLines.map(
          line => ({
            ...line,
          }),
        ),

      primaryLineGapEm:
        current.primaryLineGapEm,
    })
  }

  return contexts
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
  if (!isFork(element)) {
    return undefined
  }

  const alreadyOverlayed =
    (
      forkGroupLayouts.value[index]
        ?.overlayOffsetPx
      ?? 0
    ) > 0

  if (alreadyOverlayed) {
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
  let sourceBranch: Branch | null = null

  for (
    const element
    of section.value.$lineSection.elements
  ) {
    if (isBranch(element)) {
      sourceBranch = element
      continue
    }

    if (
      !isFork(element)
      || !sourceBranch
      || !element.$fork.sections
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
        element.$fork.sections[outputIndex]

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
    of fork.$fork.sections ?? []
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
          forkGroupLayouts[i]?.overlayOffsetPx ?? 0
        "
        :fork-overlay-compensation-px="
          forkGroupLayouts[i]?.overlayCompensationPx ?? 0
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