<script setup lang="ts">
import { computed } from 'vue'
import { useProject } from '~/stores/useProject'

const visible = defineModel<boolean>('visible', { required: true })
const fork = defineModel<Fork>({ required: true })

const project = useProject()

interface ForkLineOption {
  value: string
  mode: Mode | null
  index: LineIndex | null
  color: string
  primary: boolean
}

const availableLines = computed<ForkLineOption[]>(() => {
  const result: ForkLineOption[] = [{
    value: 'primary',
    mode: project.line.mode,
    index: project.line.index,
    color: project.line.color || '#000000',
    primary: true,
  }]

  const seen =
    new Set<string>(['primary'])

  function addBranchLines(
    branch: Branch,
  ) {
    for (
      const branchLine
      of branch.$branch.additionalLines ?? []
    ) {
      if (seen.has(branchLine.id)) {
        continue
      }

      seen.add(branchLine.id)

      result.push({
        value: branchLine.id,
        mode: branchLine.mode,
        index: branchLine.index,
        color: branchLine.color || '#000000',
        primary: false,
      })
    }
  }

  function scanElement(
    element: any,
  ) {
    if (!element || typeof element !== 'object') {
      return
    }

    if ('$branch' in element) {
      addBranchLines(element as Branch)
    }

    if ('$parallelBranches' in element) {
      for (
        const section
        of element.$parallelBranches.sections ?? []
      ) {
        scanSection(section)
      }
    }

    if ('$fork' in element) {
      for (
        const section
        of element.$fork.sections ?? []
      ) {
        scanSection(section)
      }
    }
  }

  function scanSection(
    section: any,
  ) {
    const elements =
      section?.$lineSection?.elements
      ?? section?.elements
      ?? []

    for (const element of elements) {
      scanElement(element)
    }
  }

  for (const section of project.line.topology ?? []) {
    scanSection(section)
  }

  return result
})

const selectedLineId = computed({
  get: () => fork.value.$fork.lineId || 'primary',
  set: (lineId: string) => {
    fork.value.$fork.lineId = lineId
  },
})

/*
 * =========================================================
 * POSITIONNER LA BIFURCATION APRÈS UN ARRÊT
 * =========================================================
 *
 * La Fork reste un vrai élément structurel de SectionEditor.
 * On ne la décale donc pas artificiellement en pixels.
 *
 * Quand l'utilisateur choisit "Après Corbeil-Essonnes" :
 * - la Branch source est coupée juste après cet arrêt ;
 * - les éléments qui venaient après sont déplacés dans
 *   la sortie de continuité de la Fork ;
 * - la Fork se retrouve donc naturellement exactement
 *   après l'arrêt sélectionné.
 *
 * Aucun X/Y n'est enregistré dans le projet.
 */
type ForkPlacementData =
  Fork['$fork'] & {
    afterStopId?: string | null
    anchorMovedElementIds?: string[]
    anchorContinuationOutputIndex?: 0 | 1
    anchorSourceBranchId?: string | null
  }

interface ForkPlacementContext {
  section: LineSection
  forkIndex: number
  sourceBranch: Branch
  sourceBranchIndex: number
}

interface StopPlacementContext {
  section: LineSection
  branch: Branch
  branchIndex: number
  stopIndex: number
}

/*
 * Retrouve la position ACTUELLE de la Fork, sans supposer qu'elle
 * se trouve encore dans la même Section que lors de sa création.
 */
function findForkLocation():
  {
    section: LineSection
    forkIndex: number
  } | null {
  function scanSection(
    section: LineSection,
  ): {
    section: LineSection
    forkIndex: number
  } | null {
    for (
      let index = 0;
      index < section.$lineSection.elements.length;
      index++
    ) {
      const element =
        section.$lineSection.elements[index]

      if (
        '$fork' in element
        && element.id === fork.value.id
      ) {
        return {
          section,
          forkIndex: index,
        }
      }

      /*
       * Ne jamais descendre dans les propres sorties de la Fork
       * recherchée : cela créerait une boucle topologique.
       */
      if (
        '$fork' in element
        && element.id !== fork.value.id
      ) {
        for (
          const childSection
          of element.$fork.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }

      if ('$parallelBranches' in element) {
        for (
          const childSection
          of element.$parallelBranches.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const section
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(section)

    if (found) {
      return found
    }
  }

  return null
}

/*
 * Retrouve la vraie Branch qui contient l'arrêt choisi.
 *
 * C'est la différence essentielle avec l'ancienne logique :
 * on ne part plus de "la Branch juste avant la Fork".
 *
 * Après Viry-Châtillon, D et S vivent dans des LineSection
 * imbriquées différentes. Corbeil doit donc décider lui-même
 * dans quelle Section la nouvelle Fork doit être insérée.
 */
function findStopPlacementContext(
  stopId: string,
): StopPlacementContext | null {
  function scanSection(
    section: LineSection,
  ): StopPlacementContext | null {
    for (
      let branchIndex = 0;
      branchIndex < section.$lineSection.elements.length;
      branchIndex++
    ) {
      const element =
        section.$lineSection.elements[
          branchIndex
        ]

      if ('$branch' in element) {
        const stopIndex =
          (
            element.$branch.elements
            ?? []
          ).findIndex(
            child =>
              '$stop' in child
              && child.id === stopId,
          )

        if (stopIndex >= 0) {
          return {
            section,
            branch: element,
            branchIndex,
            stopIndex,
          }
        }
      }

      /*
       * Les arrêts déjà déplacés dans les propres sorties de
       * cette Fork sont restaurés AVANT cet appel.
       * On évite donc de descendre dans ses propres enfants.
       */
      if (
        '$fork' in element
        && element.id !== fork.value.id
      ) {
        for (
          const childSection
          of element.$fork.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }

      if ('$parallelBranches' in element) {
        for (
          const childSection
          of element.$parallelBranches.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const section
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(section)

    if (found) {
      return found
    }
  }

  return null
}

function findBranchById(
  branchId: string,
): Branch | null {
  function scanSection(
    section: LineSection,
  ): Branch | null {
    for (
      const element
      of section.$lineSection.elements ?? []
    ) {
      if (
        '$branch' in element
        && element.id === branchId
      ) {
        return element
      }

      if ('$fork' in element) {
        for (
          const childSection
          of element.$fork.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }

      if ('$parallelBranches' in element) {
        for (
          const childSection
          of element.$parallelBranches.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const section
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(section)

    if (found) {
      return found
    }
  }

  return null
}

interface AnchorStopOption {
  id: string
  name: string
}

const forkPlacementData =
  computed(() =>
    fork.value.$fork as ForkPlacementData,
  )

function findForkPlacementContext():
  ForkPlacementContext | null {
  function scanSection(
    section: LineSection,
  ): ForkPlacementContext | null {
    let previousBranch:
      Branch | null = null

    let previousBranchIndex = -1

    for (
      let index = 0;
      index < section.$lineSection.elements.length;
      index++
    ) {
      const element =
        section.$lineSection.elements[index]

      if ('$branch' in element) {
        previousBranch =
          element

        previousBranchIndex =
          index

        continue
      }

      if ('$fork' in element) {
        if (
          element.id === fork.value.id
          && previousBranch
        ) {
          return {
            section,
            forkIndex: index,
            sourceBranch:
              previousBranch,
            sourceBranchIndex:
              previousBranchIndex,
          }
        }

        for (
          const childSection
          of element.$fork.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }

      if ('$parallelBranches' in element) {
        for (
          const childSection
          of element.$parallelBranches.sections ?? []
        ) {
          const found =
            scanSection(childSection)

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const section
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(section)

    if (found) {
      return found
    }
  }

  return null
}

function stopUsesSelectedLine(
  stop: Stop,
) {
  const ids =
    (
      stop.$stop as Stop['$stop'] & {
        lineIds?: string[]
      }
    ).lineIds

  if (
    !ids
    || ids.length === 0
  ) {
    return (
      selectedLineId.value
      === 'primary'
    )
  }

  return ids.includes(
    selectedLineId.value,
  )
}

/*
 * Détermine la sortie qui représente la continuité du corridor.
 *
 * S'il existe une autre ligne dans la Branch source,
 * on choisit la sortie dans laquelle cette ligne non ciblée
 * doit continuer. Sinon on choisit la sortie la plus proche
 * de originOffset.
 */
function continuationOutputIndex(
  sourceBranch: Branch,
): 0 | 1 {
  const targetLineId =
    selectedLineId.value

  const inputIds = [
    ...(
      sourceBranch.$branch.primaryLineVisible
      !== false
        ? ['primary']
        : []
    ),

    ...(
      sourceBranch.$branch.additionalLines
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

  const topOutputIndex: 0 | 1 =
    fork.value.$fork.linksOffset[0]
      >= fork.value.$fork.linksOffset[1]
      ? 0
      : 1

  const bottomOutputIndex: 0 | 1 =
    topOutputIndex === 0
      ? 1
      : 0

  if (targetRank >= 0) {
    for (
      let lineIndex = 0;
      lineIndex < inputIds.length;
      lineIndex++
    ) {
      if (
        inputIds[lineIndex]
        === targetLineId
      ) {
        continue
      }

      return (
        lineIndex < targetRank
          ? topOutputIndex
          : bottomOutputIndex
      )
    }
  }

  const origin =
    fork.value.$fork.originOffset

  const firstDistance =
    Math.abs(
      fork.value.$fork.linksOffset[0]
      - origin,
    )

  const secondDistance =
    Math.abs(
      fork.value.$fork.linksOffset[1]
      - origin,
    )

  return (
    firstDistance <= secondDistance
      ? 0
      : 1
  )
}

function outputBranchAt(
  outputIndex: 0 | 1,
): Branch | null {
  const section =
    fork.value.$fork.sections?.[
      outputIndex
    ]

  if (!section) {
    return null
  }

  const branch =
    section.$lineSection.elements.find(
      element =>
        '$branch' in element,
    )

  return (
    branch
    && '$branch' in branch
      ? branch
      : null
  )
}

/*
 * Si l'ancrage est modifié avant d'avoir rempli les deux nouvelles
 * branches, on remet d'abord les éléments déplacés dans la Branch
 * source. Ainsi on peut changer "après Juvisy" en "après Corbeil"
 * sans perdre les arrêts.
 */
function restorePreviouslyMovedElements() {
  const movedIds =
    forkPlacementData.value
      .anchorMovedElementIds
    ?? []

  const outputIndex =
    forkPlacementData.value
      .anchorContinuationOutputIndex

  if (
    movedIds.length === 0
    || outputIndex === undefined
  ) {
    return
  }

  const outputBranch =
    outputBranchAt(
      outputIndex,
    )

  if (!outputBranch) {
    return
  }

  /*
   * La source précédente peut maintenant être imbriquée dans
   * une Fork plus ancienne. On la retrouve donc par son id
   * logique, pas par la position actuelle de cette Fork.
   */
  let sourceBranch: Branch | null =
    forkPlacementData.value
      .anchorSourceBranchId
      ? findBranchById(
          forkPlacementData.value
            .anchorSourceBranchId!,
        )
      : null

  /*
   * Compatibilité avec les projets créés avant anchorSourceBranchId :
   * l'arrêt d'ancrage précédent se trouve encore dans la source.
   */
  if (
    !sourceBranch
    && forkPlacementData.value.afterStopId
  ) {
    sourceBranch =
      findStopPlacementContext(
        forkPlacementData.value
          .afterStopId,
      )?.branch
      ?? null
  }

  if (!sourceBranch) {
    return
  }

  const movedById =
    new Map(
      outputBranch.$branch.elements
        .filter(
          element =>
            movedIds.includes(
              element.id,
            ),
        )
        .map(
          element => [
            element.id,
            element,
          ] as const,
        ),
    )

  if (movedById.size === 0) {
    forkPlacementData.value
      .anchorMovedElementIds = []

    return
  }

  outputBranch.$branch.elements =
    outputBranch.$branch.elements
      .filter(
        element =>
          !movedIds.includes(
            element.id,
          ),
      )

  for (
    const movedId
    of movedIds
  ) {
    const element =
      movedById.get(movedId)

    if (element) {
      sourceBranch.$branch.elements.push(
        element,
      )
    }
  }

  forkPlacementData.value
    .anchorMovedElementIds = []
}


function applyForkAfterStop(
  stopId: string,
) {
  /*
   * 1. Si l'utilisateur change d'ancrage, on remet d'abord
   *    les anciens arrêts déplacés dans leur Branch d'origine.
   */
  restorePreviouslyMovedElements()

  /*
   * 2. On trouve l'arrêt LÀ OÙ IL VIT RÉELLEMENT dans la topologie.
   *
   *    Après une première bifurcation :
   *    - D peut être dans une Section haute ;
   *    - S peut être dans une Section basse.
   *
   *    C'est cette Section qui doit accueillir la nouvelle Fork.
   */
  const target =
    findStopPlacementContext(
      stopId,
    )

  if (!target) {
    return
  }

  const oldLocation =
    findForkLocation()

  if (!oldLocation) {
    return
  }

  /*
   * 3. On mémorise uniquement des identifiants logiques.
   *    Aucun X/Y n'est persisté.
   */
  forkPlacementData.value
    .afterStopId = stopId

  forkPlacementData.value
    .anchorSourceBranchId =
      target.branch.id

  /*
   * 4. La Branch cible est coupée juste après l'arrêt.
   */
  const trailing =
    target.branch
      .$branch
      .elements
      .splice(
        target.stopIndex + 1,
      )

  const outputIndex =
    continuationOutputIndex(
      target.branch,
    )

  const outputBranch =
    outputBranchAt(
      outputIndex,
    )

  if (!outputBranch) {
    /*
     * Sécurité absolue : si les sorties de la Fork ne sont pas
     * disponibles, on annule la coupe.
     */
    target.branch
      .$branch
      .elements
      .push(...trailing)

    return
  }

  /*
   * 5. Les éléments qui étaient après l'arrêt suivent la sortie
   *    de continuité exactement comme avant.
   */
  if (trailing.length > 0) {
    outputBranch.$branch.elements = [
      ...trailing,
      ...outputBranch.$branch.elements,
    ]
  }

  forkPlacementData.value
    .anchorMovedElementIds =
      trailing.map(
        element =>
          element.id,
      )

  forkPlacementData.value
    .anchorContinuationOutputIndex =
      outputIndex

  /*
   * 6. POINT QUI MANQUAIT :
   *
   *    on déplace l'OBJET FORK LUI-MÊME dans la LineSection qui
   *    contient la Branch de Corbeil, immédiatement après elle.
   *
   *    Elle hérite donc naturellement du niveau vertical réel :
   *    - Branch D haute  -> Fork D haute ;
   *    - Branch S basse  -> Fork S basse.
   *
   *    Plus aucune correction verticale basée sur Viry n'est
   *    nécessaire pour déterminer son niveau structurel.
   */
  const currentForkIndex =
    oldLocation.section
      .$lineSection
      .elements
      .findIndex(
        element =>
          element.id === fork.value.id,
      )

  if (currentForkIndex >= 0) {
    oldLocation.section
      .$lineSection
      .elements
      .splice(
        currentForkIndex,
        1,
      )
  }

  /*
   * Si la Fork venait déjà de cette même Section et se trouvait
   * avant la Branch cible, la suppression ci-dessus a décalé
   * l'index de la Branch d'une place. On retrouve donc son index
   * APRÈS suppression plutôt que de réutiliser l'ancien index.
   */
  const targetBranchIndex =
    target.section
      .$lineSection
      .elements
      .findIndex(
        element =>
          element.id === target.branch.id,
      )

  if (targetBranchIndex < 0) {
    /*
     * Cas théoriquement impossible : on remet la Fork dans
     * son ancienne Section plutôt que de perdre l'élément.
     */
    oldLocation.section
      .$lineSection
      .elements
      .splice(
        Math.min(
          oldLocation.forkIndex,
          oldLocation.section
            .$lineSection
            .elements
            .length,
        ),
        0,
        fork.value,
      )

    return
  }

  target.section
    .$lineSection
    .elements
    .splice(
      targetBranchIndex + 1,
      0,
      fork.value,
    )
}


const anchorStopOptions =
  computed<AnchorStopOption[]>(() => {
    const result:
      AnchorStopOption[] = []

    const seen =
      new Set<string>()

    function scanSection(
      section: LineSection,
    ) {
      for (
        const element
        of section.$lineSection.elements ?? []
      ) {
        if ('$branch' in element) {
          for (
            const branchElement
            of element.$branch.elements ?? []
          ) {
            if (
              !('$stop' in branchElement)
              || seen.has(branchElement.id)
              || !stopUsesSelectedLine(
                branchElement,
              )
            ) {
              continue
            }

            seen.add(
              branchElement.id,
            )

            result.push({
              id:
                branchElement.id,
              name:
                branchElement.$stop.name
                || 'Arrêt sans nom',
            })
          }
        }

        /*
         * Les propres sorties de cette Fork ne sont pas des points
         * d'ancrage valides pour ELLE-MÊME : cela créerait une boucle.
         *
         * Les arrêts déplacés par un ancien ancrage sont restaurés
         * dans leur source au moment du clic.
         */
        if (
          '$fork' in element
          && element.id !== fork.value.id
        ) {
          for (
            const childSection
            of element.$fork.sections ?? []
          ) {
            scanSection(childSection)
          }
        }

        if ('$parallelBranches' in element) {
          for (
            const childSection
            of element.$parallelBranches.sections ?? []
          ) {
            scanSection(childSection)
          }
        }
      }
    }

    for (
      const section
      of project.line.topology ?? []
    ) {
      scanSection(section)
    }

    /*
     * On conserve explicitement les arrêts que CETTE Fork avait
     * déplacés dans sa sortie afin de pouvoir changer ensuite
     * "après Juvisy" en "après Corbeil" sans perdre l'option.
     */
    const movedIds =
      forkPlacementData.value
        .anchorMovedElementIds
      ?? []

    const outputIndex =
      forkPlacementData.value
        .anchorContinuationOutputIndex

    if (
      movedIds.length > 0
      && outputIndex !== undefined
    ) {
      const outputBranch =
        outputBranchAt(
          outputIndex,
        )

      if (outputBranch) {
        for (
          const movedId
          of movedIds
        ) {
          const element =
            outputBranch
              .$branch
              .elements
              .find(
                candidate =>
                  candidate.id
                  === movedId
                  && '$stop' in candidate,
              )

          if (
            element
            && '$stop' in element
            && !seen.has(element.id)
            && stopUsesSelectedLine(
              element,
            )
          ) {
            seen.add(element.id)

            result.push({
              id: element.id,
              name:
                element.$stop.name
                || 'Arrêt sans nom',
            })
          }
        }
      }
    }

    return result
  })


const selectedAnchorStopId =
  computed({
    get: () =>
      forkPlacementData.value
        .afterStopId
      ?? null,

    set: (stopId: string | null) => {
      if (!stopId) {
        return
      }

      applyForkAfterStop(
        stopId,
      )
    },
  })

const orientations = [
  { label: 'ui.dialogs.fork_properties.orientation.left', value: 'LEFT' },
  { label: 'ui.dialogs.fork_properties.orientation.right', value: 'RIGHT' },
]

const shapes = [
  { label: 'ui.dialogs.fork_properties.shape.upward', value: [1, 0] },
  { label: 'ui.dialogs.fork_properties.shape.symmetrical', value: [1, -1] },
  { label: 'ui.dialogs.fork_properties.shape.downward', value: [0, -1] },
]

const arrows = [
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.none',
    value: undefined,
  },
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.clockwise',
    value: 'CW',
  },
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.counterclockwise',
    value: 'CCW',
  },
]

const forkStyles = [
  {
    label: 'Originale',
    value: 'ORIGINAL',
  },
  {
    label: 'Arrondie',
    value: 'ROUNDED',
  },
]
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    :style="{ width: 'min(650px, 94vw)' }"
    :pt="{
      root: { class: 'fork-dialog' },
      header: { class: 'fork-dialog-header' },
      content: { class: 'fork-dialog-content' },
      footer: { class: 'fork-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-git-fork" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title-row">
            <span
              class="dialog-title"
              data-pc-section="title"
            >
              {{ $t('ui.dialogs.fork_properties.header') }}
            </span>

            <Tag
              severity="warn"
              class="wip-tag"
            >
              <i class="i-tabler-traffic-cone" />
              WIP
            </Tag>
          </div>

          <div class="dialog-subtitle">
            Configurez la forme et le comportement de la bifurcation.
          </div>
        </div>
      </div>
    </template>

    <div class="fork-properties">
      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-route" />
            </div>

            <div>
              <div class="property-card-title">
                Ligne concernée
              </div>

              <div class="property-card-description">
                Choisissez la ligne qui doit réellement bifurquer.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="line-choice-grid">
            <button
              v-for="line in availableLines"
              :key="line.value"
              type="button"
              class="line-choice"
              :class="{
                'line-choice-selected':
                  selectedLineId === line.value,
              }"
              @click="selectedLineId = line.value"
            >
              <span
                class="line-choice-swatch"
                :style="{ backgroundColor: line.color }"
              />

              <span class="line-choice-pictograms">
                <Mode
                  v-if="line.mode"
                  class="line-choice-mode"
                  plain
                  :mode="line.mode"
                />

                <LineIndex
                  v-if="line.mode && line.index"
                  class="line-choice-index"
                  :mode="line.mode"
                  :index="line.index"
                />

                <span
                  v-if="!line.mode && !line.index"
                  class="line-choice-fallback"
                >
                  Ligne
                </span>
              </span>

              <span
                v-if="line.primary"
                class="line-choice-role"
              >
                principale
              </span>

              <i
                v-if="selectedLineId === line.value"
                class="i-tabler-check"
              />
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="anchorStopOptions.length > 0"
        class="property-card"
      >
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-map-pin" />
            </div>

            <div>
              <div class="property-card-title">
                Après quel arrêt ?
              </div>

              <div class="property-card-description">
                La bifurcation sera placée structurellement juste après cet arrêt.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="stop-choice-grid">
            <button
              v-for="stopOption in anchorStopOptions"
              :key="stopOption.id"
              type="button"
              class="stop-choice"
              :class="{
                'stop-choice-selected':
                  selectedAnchorStopId === stopOption.id,
              }"
              @click="
                selectedAnchorStopId =
                  stopOption.id
              "
            >
              <i class="i-tabler-map-pin" />

              <span class="stop-choice-name">
                {{ stopOption.name }}
              </span>

              <i
                v-if="
                  selectedAnchorStopId
                  === stopOption.id
                "
                class="i-tabler-check"
              />
            </button>
          </div>

          <div class="number-hint anchor-hint">
            <i class="i-tabler-info-circle" />

            <span>
              Les arrêts situés après le point choisi suivent automatiquement la sortie de continuité.
            </span>
          </div>
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-left-right" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.orientation.title') }}
              </div>

              <div class="property-card-description">
                Choisissez le côté vers lequel la fourche se développe.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.toward"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="orientations"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-route-alt-left" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.shape.title') }}
              </div>

              <div class="property-card-description">
                Déterminez la disposition verticale des deux branches.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.linksOffset"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="shapes"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-vector-bezier-2" />
            </div>

            <div>
              <div class="property-card-title">
                Style de bifurcation
              </div>

              <div class="property-card-description">
                Choisissez l'apparence de la jonction entre les branches.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.forkStyle"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="forkStyles"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-exchange" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.directional_arrows.title') }}
              </div>

              <div class="property-card-description">
                Ajoutez une indication de sens de circulation sur la fourche.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.directionalArrows"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="arrows"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-diagonal" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.size_multiplier') }}
              </div>

              <div class="property-card-description">
                Ajustez l'écartement général de la bifurcation.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="number-field">
            <BInputNumber
              v-model="fork.$fork.offsetMultiplier"
            />

            <div class="number-hint">
              <i class="i-tabler-info-circle" />

              <span>
                Une valeur plus élevée augmente l'écartement des branches.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <i class="i-tabler-info-circle" />

          <span>
            Les modifications sont appliquées immédiatement sur le plan.
          </span>
        </div>

        <Button
          label="Fermer"
          severity="secondary"
          icon="i-tabler-x"
          @click="visible = false"
        />
      </div>
    </template>

    <pre v-if="false">
      {{ fork }}
    </pre>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.fork-dialog) {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: 22px;

  overflow: hidden;

  box-shadow:
    0 24px 70px rgb(0 0 0 / 18%),
    0 4px 16px rgb(0 0 0 / 8%);
}

:deep(.fork-dialog-header) {
  padding: 1.05rem 1.2rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--p-primary-500) 12%,
        var(--p-dialog-background)
      ),
      var(--p-dialog-background)
    );
}

:deep(.fork-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.fork-dialog-footer) {
  padding: .85rem 1rem;

  border-top:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    var(--p-dialog-background);
}

.dialog-heading {
  display: flex;

  align-items: center;

  gap: .85rem;
}

.dialog-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2.7rem;
  height: 2.7rem;

  flex: 0 0 2.7rem;

  border-radius: 14px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 14%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1.3rem;
}

.dialog-heading-text {
  min-width: 0;

  flex: 1;
}

.dialog-title-row {
  display: flex;

  align-items: center;

  flex-wrap: wrap;

  gap: .55rem;
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;

  line-height: 1.2;

  color:
    var(--p-text-color);
}

.dialog-subtitle {
  margin-top: .18rem;

  font-size: .78rem;

  color:
    var(--p-text-muted-color);
}

.wip-tag {
  font-size: .65rem;
}

.fork-properties {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  padding: 1rem;
}

.property-card {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 20%,
      transparent
    );

  border-radius: 16px;

  overflow: hidden;

  background:
    color-mix(
      in srgb,
      var(--p-surface-0) 3%,
      var(--p-dialog-background)
    );
}

.property-card-header {
  padding: .75rem .85rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 5%,
      transparent
    );
}

.property-card-heading {
  display: flex;

  align-items: center;

  gap: .65rem;
}

.property-card-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex: 0 0 2rem;

  border-radius: 10px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1rem;
}

.property-card-title {
  font-size: .88rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.property-card-description {
  margin-top: .05rem;

  font-size: .7rem;

  color:
    var(--p-text-muted-color);
}

.property-card-body {
  padding: .9rem;
}

.property-select {
  width: 100%;
}

:deep(.property-select .p-togglebutton) {
  flex: 1 1 0;
}

.line-choice-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: .55rem;
}

.line-choice {
  display: flex;
  align-items: center;
  gap: .55rem;

  min-width: 0;

  padding: .62rem .7rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: 11px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 7%,
      var(--p-dialog-background)
    );

  color: var(--p-text-color);

  cursor: pointer;

  transition:
    border-color .14s ease,
    background .14s ease,
    transform .14s ease;
}

.line-choice:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 42%,
      var(--p-surface-400)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 8%,
      var(--p-dialog-background)
    );
}

.line-choice:active {
  transform: scale(.985);
}

.line-choice-selected {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 12%,
      var(--p-dialog-background)
    );
}

.line-choice-swatch {
  width: .72rem;
  height: .72rem;

  flex: 0 0 .72rem;

  border-radius: 999px;

  box-shadow:
    0 0 0 1px rgb(0 0 0 / 18%);
}

.line-choice-pictograms {
  display: flex;
  align-items: center;
  gap: .35rem;

  min-width: 0;
  flex: 1;
}

.line-choice-mode {
  flex: 0 0 auto;
}

.line-choice-index {
  flex: 0 0 auto;
}

.line-choice-fallback {
  font-size: .8rem;
  font-weight: 700;
}

.line-choice-role {
  flex: 0 0 auto;

  font-size: .62rem;
  font-weight: 600;

  color: var(--p-text-muted-color);
}

.line-choice i {
  flex: 0 0 auto;

  font-size: .9rem;

  color: var(--p-primary-500);
}

.stop-choice-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(10rem, 1fr));
  gap: .55rem;
}

.stop-choice {
  display: flex;
  align-items: center;
  gap: .5rem;

  min-width: 0;

  padding: .62rem .7rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: 11px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 7%,
      var(--p-dialog-background)
    );

  color:
    var(--p-text-color);

  cursor: pointer;

  text-align: left;

  transition:
    border-color .14s ease,
    background .14s ease,
    transform .14s ease;
}

.stop-choice:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 42%,
      var(--p-surface-400)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 8%,
      var(--p-dialog-background)
    );
}

.stop-choice:active {
  transform: scale(.985);
}

.stop-choice-selected {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 12%,
      var(--p-dialog-background)
    );
}

.stop-choice > i:first-child {
  flex: 0 0 auto;

  color:
    var(--p-primary-500);
}

.stop-choice-name {
  min-width: 0;

  flex: 1;

  overflow: hidden;

  text-overflow: ellipsis;
  white-space: nowrap;

  font-size: .78rem;
  font-weight: 650;
}

.stop-choice > i:last-child {
  flex: 0 0 auto;

  color:
    var(--p-primary-500);
}

.anchor-hint {
  margin-top: .65rem;
}

.number-field {
  display: flex;

  flex-direction: column;

  gap: .65rem;
}

.number-hint {
  display: flex;

  align-items: center;

  gap: .4rem;

  font-size: .72rem;

  color:
    var(--p-text-muted-color);
}

.number-hint i {
  flex-shrink: 0;

  font-size: .9rem;
}

.dialog-footer {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 1rem;

  width: 100%;
}

.footer-hint {
  display: flex;

  align-items: center;

  gap: .45rem;

  font-size: .72rem;

  color:
    var(--p-text-muted-color);
}

.footer-hint i {
  font-size: .9rem;
}

@media (max-width: 620px) {
  .dialog-subtitle,
  .property-card-description,
  .footer-hint,
  .number-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }

  :deep(.property-select) {
    display: flex;

    flex-direction: column;
  }
}
</style>