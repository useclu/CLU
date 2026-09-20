import {
  isBranch,
  isFork,
  isLoop,
  isParallelBranches,
  isStop,
  isVerticalSegment,
} from '~/utils/types'

export interface SncfRouteStopItem {
  kind: 'STOP'
  key: string
  stop: Stop
}

export interface SncfRouteForkBranch {
  key: string
  color: string
  items: SncfRouteItem[]
}

export interface SncfRouteForkItem {
  kind: 'FORK'
  key: string
  color: string
  branches: [SncfRouteForkBranch, SncfRouteForkBranch]
}

export type SncfRouteItem =
  | SncfRouteStopItem
  | SncfRouteForkItem

type ForkPairData = Fork['$fork'] & {
  parallelBranchesId?: string
}

type ParallelPairData = ParallelBranches['$parallelBranches'] & {
  forkId?: string
}

function sectionDisplayColor(
  section: LineSection,
  fallback: string,
) {
  for (const element of section.$lineSection.elements) {
    if (!isBranch(element)) continue

    const additional = element.$branch.additionalLines ?? []
    const firstAdditional = additional[0]

    if (
      firstAdditional?.color
      && (
        element.$branch.primaryLineVisible === false
        || additional.length === 1
      )
    ) {
      return firstAdditional.color
    }
  }

  return fallback
}

function pairedParallelBranches(
  section: LineSection,
  fork: Fork,
  index: number,
): ParallelBranches | null {
  const pairId = (fork.$fork as ForkPairData).parallelBranchesId

  if (pairId) {
    const byId = section.$lineSection.elements.find(
      (element): element is ParallelBranches =>
        isParallelBranches(element) && element.id === pairId,
    )

    if (byId) return byId
  }

  const next = section.$lineSection.elements[index + 1]
  if (next && isParallelBranches(next)) {
    const pairData = next.$parallelBranches as ParallelPairData
    if (!pairData.forkId || pairData.forkId === fork.id) {
      return next
    }
  }

  return null
}

function sectionForkBranches(
  section: LineSection,
  fork: Fork,
  index: number,
) {
  if (fork.$fork.sections) {
    return {
      sections: fork.$fork.sections,
      consumedParallelId: null as string | null,
    }
  }

  const pair = pairedParallelBranches(section, fork, index)
  if (!pair) return null

  return {
    sections: pair.$parallelBranches.sections,
    consumedParallelId: pair.id,
  }
}

function forkItem(
  key: string,
  sections: [LineSection, LineSection],
  fallbackColor: string,
): SncfRouteForkItem {
  const firstColor = sectionDisplayColor(sections[0], fallbackColor)
  const secondColor = sectionDisplayColor(sections[1], fallbackColor)

  return {
    kind: 'FORK',
    key,
    color: fallbackColor,
    branches: [
      {
        key: `${key}-0`,
        color: firstColor,
        items: buildSncfRouteItemsFromSection(sections[0], firstColor),
      },
      {
        key: `${key}-1`,
        color: secondColor,
        items: buildSncfRouteItemsFromSection(sections[1], secondColor),
      },
    ],
  }
}

export function buildSncfRouteItemsFromSection(
  section: LineSection,
  fallbackColor: string,
): SncfRouteItem[] {
  const items: SncfRouteItem[] = []
  const consumedParallelIds = new Set<string>()
  const elements = section.$lineSection.elements

  elements.forEach((element, index) => {
    if (isBranch(element)) {
      for (const branchElement of element.$branch.elements) {
        if (!isStop(branchElement)) continue
        items.push({
          kind: 'STOP',
          key: `stop-${branchElement.id}`,
          stop: branchElement,
        })
      }
      return
    }

    if (isFork(element)) {
      const branchData = sectionForkBranches(section, element, index)
      if (!branchData) return

      if (branchData.consumedParallelId) {
        consumedParallelIds.add(branchData.consumedParallelId)
      }

      items.push(
        forkItem(
          `fork-${element.id}`,
          branchData.sections,
          fallbackColor,
        ),
      )
      return
    }

    if (isParallelBranches(element)) {
      if (consumedParallelIds.has(element.id)) return

      const pairData = element.$parallelBranches as ParallelPairData
      if (
        pairData.forkId
        && elements.some(
          candidate => isFork(candidate) && candidate.id === pairData.forkId,
        )
      ) {
        return
      }

      items.push(
        forkItem(
          `parallel-${element.id}`,
          element.$parallelBranches.sections,
          fallbackColor,
        ),
      )
      return
    }

    if (isLoop(element)) {
      const stops = element.$loop.stops?.length
        ? element.$loop.stops
        : element.$loop.stop
          ? [element.$loop.stop]
          : []

      for (const stop of stops) {
        items.push({
          kind: 'STOP',
          key: `loop-stop-${stop.id}`,
          stop,
        })
      }
      return
    }

    if (isVerticalSegment(element) && element.$verticalSegment.stop) {
      const stop = element.$verticalSegment.stop
      items.push({
        kind: 'STOP',
        key: `vertical-stop-${stop.id}`,
        stop,
      })
    }
  })

  return items
}

export function buildSncfRouteItems(
  line: Line,
  fallbackColor: string,
): SncfRouteItem[] {
  return line.topology.flatMap(section =>
    buildSncfRouteItemsFromSection(section, fallbackColor),
  )
}
