import { gameDayWeekdayIndex } from '../../config/calendar'
import { getServiceLevelDefinition } from '../../config/operations'
import { getModeSimulationDefinition } from '../../config/simulation'
import type { GameLine, GameNetworkState, GameStation } from '../../types/network'
import type { GameOperationsState } from '../../types/operations'
import type {
  GamePassengerCohort,
  GamePassengerJourneyLeg,
  GamePassengerJourneyPlan,
  GamePassengerJourneySample,
  GamePassengerLineLoad,
  GamePassengerStationFlow,
  GamePassengerSegmentFlow,
  GamePassengerTripPurpose,
  GamePassengersDayReport,
  GamePassengersState,
} from '../../types/passengers'
import type { GameLineDailySimulation } from '../../types/simulation'
import { findLineStation, getLineAllStations, getLineServiceRoutes } from '../network/geometry'
import { buildOperationalRunsForLineDay, isDisruptionActiveAt, isSubstitutionActiveAt, substitutionTouchesDay } from '../operations'
import { missionStationOffsets } from '../timetable'
import { buildInterchanges, stationDistanceMeters } from '../transitRuntime'

const MAX_WAITING_COHORTS = 240
const MAX_REPORT_SAMPLES = 28
const MAX_GENERATED_PLACES = 64
const MAX_DIJKSTRA_STATES = 8_000
const MAX_SAME_DAY_CAPACITY_RETRIES = 4

type PlatformKey = string

interface RideEdge {
  kind: 'RIDE'
  from: PlatformKey
  to: PlatformKey
  lineId: string
  lineName: string
  lineCode: string
  rideMinutes: number
  departures: number[] | null
  headwayMinutes: number | null
  /** Identifie une desserte continue (branche / mission). Deux branches d'une même ligne exigent donc une nouvelle montée. */
  serviceKey?: string
  substitutionServiceId?: string
}

interface WalkEdge {
  kind: 'WALK'
  from: PlatformKey
  to: PlatformKey
  walkingMinutes: number
  transferId?: string
}

type PassengerGraphEdge = RideEdge | WalkEdge

interface PassengerGraph {
  adjacency: Map<PlatformKey, PassengerGraphEdge[]>
  platformStations: Map<PlatformKey, { line: GameLine; station: GameStation }>
}

interface JourneyPlanningContext {
  network: GameNetworkState
  day: number
  calendarStartDate: string
  operations?: GameOperationsState | null
  lineReports: GameLineDailySimulation[]
  linePenaltyMinutes?: Record<string, number>
  blockedLineIds?: Set<string>
  /** Graphe déjà construit pour cette journée. Évite de reconstruire tout le réseau à chaque cohorte. */
  graph?: PassengerGraph
  /** Index des rapports réutilisé pendant un lot de calculs (simulation ou aperçu UI). */
  lineReportsById?: Map<string, GameLineDailySimulation>
}

interface QueueEntry {
  stateKey: string
  platform: PlatformKey
  onboardLineId: string | null
  minutes: number
}

interface Predecessor {
  previousStateKey: string
  edge: PassengerGraphEdge
  waitMinutes: number
}

interface MutableStationFlow {
  boardings: number
  alightings: number
  transferBoardings: number
  leftBehindPassengers: number
}

interface MutableLineLoad {
  requestedBoardings: number
  transportedBoardings: number
  transferBoardings: number
  leftBehindPassengers: number
}

function platformKey(lineId: string, stationId: string): PlatformKey {
  return `${lineId}::${stationId}`
}

function stateKey(platform: PlatformKey, onboardLineId: string | null) {
  return `${platform}@@${onboardLineId ?? '-'}`
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function hashUnit(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xFFFFFFFF
}

function hashIndex(value: string, length: number) {
  if (length <= 0) return 0
  return Math.min(length - 1, Math.floor(hashUnit(value) * length))
}

function minuteOfDay(value: number) {
  const normalized = Math.max(0, value)
  return normalized % 1440
}

function dayOffset(value: number) {
  return Math.floor(Math.max(0, value) / 1440)
}

function addEdge(adjacency: Map<PlatformKey, PassengerGraphEdge[]>, edge: PassengerGraphEdge) {
  const bucket = adjacency.get(edge.from) ?? []
  bucket.push(edge)
  adjacency.set(edge.from, bucket)
}

function rideServiceKey(edge: RideEdge) {
  if (edge.substitutionServiceId) return `${edge.lineId}::substitution:${edge.substitutionServiceId}`
  return edge.serviceKey ?? edge.lineId
}

function reportMap(lineReports: GameLineDailySimulation[]) {
  return new Map(lineReports.map(report => [report.lineId, report] as const))
}

function averageSegmentMinutes(line: GameLine, from: GameStation, to: GameStation, report?: GameLineDailySimulation) {
  const distanceKm = stationDistanceMeters(from, to) / 1000
  const speed = Math.max(5, Number(report?.averageSpeedKmH ?? report?.effectiveAverageSpeedKmH ?? 25))
  return Math.max(0.6, distanceKm / speed * 60 + 0.3)
}

function addFrequencyEdges(
  graph: PassengerGraph,
  line: GameLine,
  report: GameLineDailySimulation | undefined,
) {
  const fallbackDepartures = getModeSimulationDefinition(line.mode).departuresPerHour
    * getServiceLevelDefinition(line.serviceLevel).departuresMultiplier
  const departuresPerHour = Math.max(0, Number(report?.departuresPerHour ?? fallbackDepartures))
  const headway = departuresPerHour > 0
    ? Math.max(1, Number(report?.headwayMinutes ?? 60 / departuresPerHour))
    : null
  if (!headway) return

  // Chaque route de service possède sa propre identité. Sur une ligne à branches,
  // cela évite qu'un voyageur reste virtuellement dans le même train en passant
  // d'une branche à l'autre au point de bifurcation.
  for (const [routeIndex, route] of getLineServiceRoutes(line).entries()) {
    const routeSignature = route.map(station => station.id).join('>')
    const serviceKey = `${line.id}::frequency:${routeIndex}:${routeSignature}`
    const seen = new Set<string>()
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1]!
      const b = route[index]!
      const rideMinutes = averageSegmentMinutes(line, a, b, report)
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const signature = `${from.id}>${to.id}`
        if (seen.has(signature)) continue
        seen.add(signature)
        addEdge(graph.adjacency, {
          kind: 'RIDE',
          from: platformKey(line.id, from.id),
          to: platformKey(line.id, to.id),
          lineId: line.id,
          lineName: line.name,
          lineCode: line.shortCode,
          rideMinutes,
          departures: null,
          headwayMinutes: headway,
          serviceKey,
        })
      }
    }
  }
}

function addTimetableEdges(
  graph: PassengerGraph,
  line: GameLine,
  day: number,
  calendarStartDate: string,
  operations?: GameOperationsState | null,
) {
  if (line.schedule?.mode !== 'TIMETABLE') return
  const edgeMap = new Map<string, { edge: RideEdge; rideTotal: number; rideCount: number }>()

  for (const offsetDay of [0, 1]) {
    const targetDay = day + offsetDay
    for (const run of buildOperationalRunsForLineDay(line, targetDay, calendarStartDate, operations)) {
      if (run.cancelled) continue
      const mission = line.schedule.missions.find(item => item.id === run.missionId)
      if (!mission) continue
      const offsets = missionStationOffsets(line, mission)
      const served = run.routeStationIds.filter(id => run.stopStationIds.includes(id))
      const serviceKey = `${line.id}::timetable:${run.routeStationIds.join('>')}::stops:${served.join('>')}`
      for (let index = 1; index < served.length; index += 1) {
        const fromId = served[index - 1]!
        const toId = served[index]!
        const fromOffset = offsets.get(fromId)
        const toOffset = offsets.get(toId)
        if (fromOffset === undefined || toOffset === undefined || toOffset <= fromOffset) continue
        const signature = `${serviceKey}::${fromId}>${toId}`
        let entry = edgeMap.get(signature)
        if (!entry) {
          entry = {
            edge: {
              kind: 'RIDE',
              from: platformKey(line.id, fromId),
              to: platformKey(line.id, toId),
              lineId: line.id,
              lineName: line.name,
              lineCode: line.shortCode,
              rideMinutes: toOffset - fromOffset,
              departures: [],
              headwayMinutes: null,
              serviceKey,
            },
            rideTotal: 0,
            rideCount: 0,
          }
          edgeMap.set(signature, entry)
        }
        entry.rideTotal += toOffset - fromOffset
        entry.rideCount += 1
        entry.edge.departures!.push(offsetDay * 1440 + run.effectiveDepartureMinute + fromOffset)
      }
    }
  }

  for (const { edge, rideTotal, rideCount } of edgeMap.values()) {
    edge.rideMinutes = Math.max(0.3, rideTotal / Math.max(1, rideCount))
    edge.departures = [...new Set(edge.departures ?? [])].sort((a, b) => a - b)
    if (edge.departures.length > 0) addEdge(graph.adjacency, edge)
  }
}

function addSubstitutionEdges(graph: PassengerGraph, line: GameLine, context: JourneyPlanningContext) {
  const services = (context.operations?.substitutionServices ?? []).filter(service => service.lineId === line.id && substitutionTouchesDay(service, context.day))
  if (!services.length) return
  const stations = new Map(getLineAllStations(line).map(station => [station.id, station] as const))
  for (const service of services) {
    for (let index = 1; index < service.stationIds.length; index += 1) {
      const a = stations.get(service.stationIds[index - 1]!)
      const b = stations.get(service.stationIds[index]!)
      if (!a || !b) continue
      const rideMinutes = Math.max(2, stationDistanceMeters(a, b) / 1000 * 2.4 + 1.2)
      for (const [from, to] of [[a, b], [b, a]] as const) {
        addEdge(graph.adjacency, {
          kind: 'RIDE',
          from: platformKey(line.id, from.id),
          to: platformKey(line.id, to.id),
          lineId: line.id,
          lineName: `Bus de substitution · ${line.shortCode || line.name}`,
          lineCode: 'BUS',
          rideMinutes,
          departures: null,
          headwayMinutes: Math.max(3, service.headwayMinutes),
          serviceKey: `${line.id}::substitution:${service.id}`,
          substitutionServiceId: service.id,
        })
      }
    }
  }
}

function buildPassengerGraph(context: JourneyPlanningContext): PassengerGraph {
  const graph: PassengerGraph = {
    adjacency: new Map(),
    platformStations: new Map(),
  }
  const reports = reportMap(context.lineReports)
  const operationalLines = context.network.lines.filter(line => line.status === 'OPERATIONAL' && getLineAllStations(line).length >= 2)

  for (const line of operationalLines) {
    for (const station of getLineAllStations(line)) {
      graph.platformStations.set(platformKey(line.id, station.id), { line, station })
    }
    if (line.schedule?.mode === 'TIMETABLE') addTimetableEdges(graph, line, context.day, context.calendarStartDate, context.operations)
    else addFrequencyEdges(graph, line, reports.get(line.id))
    addSubstitutionEdges(graph, line, context)
  }

  for (const interchange of buildInterchanges({ lines: operationalLines, walkingTransfers: context.network.walkingTransfers ?? [] })) {
    const minutes = interchange.kind === 'PHYSICAL'
      ? Math.max(1.5, interchange.walkingMinutes)
      : Math.max(1, interchange.walkingMinutes)
    const transferId = interchange.kind === 'WALKING' ? interchange.manualLinkId : undefined
    const a = platformKey(interchange.fromLineId, interchange.fromStationId)
    const b = platformKey(interchange.toLineId, interchange.toStationId)
    if (!graph.platformStations.has(a) || !graph.platformStations.has(b)) continue
    addEdge(graph.adjacency, { kind: 'WALK', from: a, to: b, walkingMinutes: minutes, transferId })
    addEdge(graph.adjacency, { kind: 'WALK', from: b, to: a, walkingMinutes: minutes, transferId })
  }

  return graph
}

function disruptionBlocksFrequencyEdge(
  edge: RideEdge,
  currentMinute: number,
  day: number,
  operations?: GameOperationsState | null,
) {
  if (!operations) return false
  const actualDay = day + dayOffset(currentMinute)
  const absoluteMinute = (Math.max(1, actualDay) - 1) * 1440 + minuteOfDay(currentMinute)
  const fromStationId = edge.from.split('::')[1] ?? ''
  const toStationId = edge.to.split('::')[1] ?? ''
  return operations.disruptions.some(disruption => {
    if (disruption.lineId !== edge.lineId || !disruption.suspended || !isDisruptionActiveAt(disruption, absoluteMinute)) return false
    if (disruption.scope === 'LINE') return true
    if (disruption.scope === 'STATIONS') return disruption.stationIds.includes(fromStationId) || disruption.stationIds.includes(toStationId)
    const a = disruption.segmentFromStationId
    const b = disruption.segmentToStationId
    return Boolean(a && b && ((a === fromStationId && b === toStationId) || (a === toStationId && b === fromStationId)))
  })
}

function nextBoardingWait(
  edge: RideEdge,
  currentMinute: number,
  context: JourneyPlanningContext,
  reports: Map<string, GameLineDailySimulation>,
) {
  if (context.blockedLineIds?.has(edge.lineId) && !edge.substitutionServiceId) return Number.POSITIVE_INFINITY
  if (edge.substitutionServiceId) {
    const actualDay = context.day + dayOffset(currentMinute)
    const absoluteMinute = (Math.max(1, actualDay) - 1) * 1440 + minuteOfDay(currentMinute)
    const service = context.operations?.substitutionServices?.find(item => item.id === edge.substitutionServiceId)
    if (!service || !isSubstitutionActiveAt(service, absoluteMinute)) return Number.POSITIVE_INFINITY
    return Math.max(1, edge.headwayMinutes ?? service.headwayMinutes) / 2
      + Math.max(0, context.linePenaltyMinutes?.[edge.lineId] ?? 0)
  }
  if (edge.departures) {
    const next = edge.departures.find(departure => departure >= currentMinute - 0.01)
    if (next === undefined) return Number.POSITIVE_INFINITY
    const base = Math.max(0, next - currentMinute)
    return base + Math.max(0, context.linePenaltyMinutes?.[edge.lineId] ?? 0)
  }

  if (disruptionBlocksFrequencyEdge(edge, currentMinute, context.day, context.operations)) return Number.POSITIVE_INFINITY
  const report = reports.get(edge.lineId)
  const headway = Math.max(1, edge.headwayMinutes ?? report?.headwayMinutes ?? 15)
  const occupancy = Math.max(0, Number(report?.occupancyRate ?? 0))
  const queuePressure = Math.max(0, Number(report?.queuePressureRate ?? occupancy))
  const fulfillment = Math.min(1, Math.max(0.05, Number(report?.serviceFulfillmentRate ?? 1)))
  const regularity = Math.min(100, Math.max(0, Number(report?.regularityScore ?? 85)))
  const crowdingPenalty = headway * (
    Math.max(0, occupancy - 0.88) * 1.8
    + Math.max(0, queuePressure - 1) * 1.25
    + Math.max(0, 0.82 - fulfillment) * 0.8
  )
  const regularityPenalty = headway * Math.max(0, 78 - regularity) / 180
  return Math.min(120, headway / 2 + crowdingPenalty + regularityPenalty)
    + Math.max(0, context.linePenaltyMinutes?.[edge.lineId] ?? 0)
}

class PassengerMinQueue {
  private items: QueueEntry[] = []

  get size() { return this.items.length }

  push(entry: QueueEntry) {
    const items = this.items
    items.push(entry)
    let index = items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (items[parent]!.minutes <= entry.minutes) break
      items[index] = items[parent]!
      index = parent
    }
    items[index] = entry
  }

  pop(): QueueEntry | null {
    const items = this.items
    if (!items.length) return null
    const root = items[0]!
    const tail = items.pop()!
    if (items.length) {
      let index = 0
      while (true) {
        const left = index * 2 + 1
        if (left >= items.length) break
        const right = left + 1
        const child = right < items.length && items[right]!.minutes < items[left]!.minutes ? right : left
        if (items[child]!.minutes >= tail.minutes) break
        items[index] = items[child]!
        index = child
      }
      items[index] = tail
    }
    return root
  }
}

interface PassengerJourneyConstraints {
  directLineId?: string
  directServiceKey?: string
}

function emptyPlan(
  originLineId: string,
  originStationId: string,
  destinationLineId: string,
  destinationStationId: string,
  departureMinute: number,
): GamePassengerJourneyPlan {
  return {
    found: false,
    originLineId,
    originStationId,
    destinationLineId,
    destinationStationId,
    departureMinute,
    arrivalMinute: null,
    totalMinutes: null,
    waitingMinutes: 0,
    walkingMinutes: 0,
    rideMinutes: 0,
    transfers: 0,
    usedLineIds: [],
    usedWalkingTransferIds: [],
    legs: [],
  }
}

function reconstructPlan(
  graph: PassengerGraph,
  predecessors: Map<string, Predecessor>,
  endStateKey: string,
  startStateKey: string,
  basePlan: GamePassengerJourneyPlan,
  finalMinutes: number,
) {
  const steps: Array<{ edge: PassengerGraphEdge; waitMinutes: number }> = []
  let cursor = endStateKey
  while (cursor !== startStateKey) {
    const predecessor = predecessors.get(cursor)
    if (!predecessor) return basePlan
    steps.push({ edge: predecessor.edge, waitMinutes: predecessor.waitMinutes })
    cursor = predecessor.previousStateKey
  }
  steps.reverse()

  const legs: GamePassengerJourneyLeg[] = []
  let waitingMinutes = 0
  let walkingMinutes = 0
  let rideMinutes = 0
  const usedLineIds: string[] = []
  const usedWalkingTransferIds: string[] = []
  let previousRideServiceKey: string | null = null
  let rideBoardings = 0

  for (const step of steps) {
    const from = graph.platformStations.get(step.edge.from)
    const to = graph.platformStations.get(step.edge.to)
    if (!from || !to) continue
    if (step.edge.kind === 'WALK') {
      walkingMinutes += step.edge.walkingMinutes
      if (step.edge.transferId && !usedWalkingTransferIds.includes(step.edge.transferId)) usedWalkingTransferIds.push(step.edge.transferId)
      previousRideServiceKey = null
      legs.push({
        kind: 'WALK',
        fromLineId: from.line.id,
        fromStationId: from.station.id,
        fromStationName: from.station.name,
        toLineId: to.line.id,
        toStationId: to.station.id,
        toStationName: to.station.name,
        minutes: step.edge.walkingMinutes,
        waitingMinutes: 0,
        walkingTransferId: step.edge.transferId,
      })
      continue
    }

    waitingMinutes += step.waitMinutes
    rideMinutes += step.edge.rideMinutes
    if (!usedLineIds.includes(step.edge.lineId)) usedLineIds.push(step.edge.lineId)
    const previous = legs.at(-1)
    const currentRideServiceKey = rideServiceKey(step.edge)
    if (previous?.kind === 'RIDE' && previous.lineId === step.edge.lineId && previous.substitutionServiceId === step.edge.substitutionServiceId && previousRideServiceKey === currentRideServiceKey && previous.toStationId === from.station.id && step.waitMinutes <= 0.01) {
      previous.toLineId = to.line.id
      previous.toStationId = to.station.id
      previous.toStationName = to.station.name
      previous.minutes += step.edge.rideMinutes
    }
    else {
      rideBoardings += 1
      legs.push({
        kind: 'RIDE',
        lineId: step.edge.lineId,
        lineName: step.edge.lineName,
        lineCode: step.edge.lineCode,
        substitutionServiceId: step.edge.substitutionServiceId,
        fromLineId: from.line.id,
        fromStationId: from.station.id,
        fromStationName: from.station.name,
        toLineId: to.line.id,
        toStationId: to.station.id,
        toStationName: to.station.name,
        minutes: step.edge.rideMinutes,
        waitingMinutes: step.waitMinutes,
      })
    }
    previousRideServiceKey = currentRideServiceKey
  }

  return {
    ...basePlan,
    found: true,
    arrivalMinute: basePlan.departureMinute + finalMinutes,
    totalMinutes: finalMinutes,
    waitingMinutes,
    walkingMinutes,
    rideMinutes,
    transfers: Math.max(0, rideBoardings - 1),
    usedLineIds,
    usedWalkingTransferIds,
    legs,
  }
}

function planPassengerJourneyInternal(
  context: JourneyPlanningContext,
  originLineId: string,
  originStationId: string,
  destinationLineId: string,
  destinationStationId: string,
  departureMinute: number,
  constraints: PassengerJourneyConstraints = {},
): GamePassengerJourneyPlan {
  const basePlan = emptyPlan(originLineId, originStationId, destinationLineId, destinationStationId, departureMinute)
  const graph = context.graph ?? buildPassengerGraph(context)
  const origin = platformKey(originLineId, originStationId)
  const destination = platformKey(destinationLineId, destinationStationId)
  if (!graph.platformStations.has(origin) || !graph.platformStations.has(destination)) return basePlan
  if (origin === destination) return { ...basePlan, found: true, arrivalMinute: departureMinute, totalMinutes: 0 }

  const reports = context.lineReportsById ?? reportMap(context.lineReports)
  const start = stateKey(origin, null)
  const distances = new Map<string, number>([[start, 0]])
  const predecessors = new Map<string, Predecessor>()
  const queue = new PassengerMinQueue()
  queue.push({ stateKey: start, platform: origin, onboardLineId: null, minutes: 0 })
  const visited = new Set<string>()
  let bestEndState: string | null = null
  let bestEndMinutes = Number.POSITIVE_INFINITY
  let expanded = 0

  while (queue.size > 0 && expanded < MAX_DIJKSTRA_STATES) {
    const current = queue.pop()
    if (!current) break
    if (visited.has(current.stateKey)) continue
    visited.add(current.stateKey)
    expanded += 1
    if (current.minutes > bestEndMinutes) continue
    if (current.platform === destination) {
      bestEndState = current.stateKey
      bestEndMinutes = current.minutes
      break
    }

    for (const edge of graph.adjacency.get(current.platform) ?? []) {
      if (constraints.directLineId) {
        if (edge.kind === 'WALK' || edge.lineId !== constraints.directLineId) continue
      }
      if (constraints.directServiceKey && (edge.kind !== 'RIDE' || rideServiceKey(edge) !== constraints.directServiceKey)) continue
      let waitMinutes = 0
      let edgeMinutes = 0
      let nextOnboard: string | null = current.onboardLineId
      if (edge.kind === 'WALK') {
        edgeMinutes = edge.walkingMinutes
        nextOnboard = null
      }
      else {
        // En horaire réel, chaque tronçon porte les heures de passage des
        // courses qui le desservent. Même si le voyageur est déjà sur la même
        // ligne, on vérifie donc qu'une course existe bien à cet instant :
        // cela empêche de prolonger virtuellement un train après un terminus
        // temporaire ou une course supprimée. Pour la fréquence historique,
        // l'attente n'est payée qu'à l'embarquement.
        const onboardKey = rideServiceKey(edge)
        if (edge.departures || current.onboardLineId !== onboardKey) {
          waitMinutes = nextBoardingWait(edge, departureMinute + current.minutes, context, reports)
          if (!Number.isFinite(waitMinutes)) continue
        }
        edgeMinutes = waitMinutes + edge.rideMinutes
        nextOnboard = onboardKey
      }
      const nextPlatform = edge.to
      const nextState = stateKey(nextPlatform, nextOnboard)
      const nextMinutes = current.minutes + edgeMinutes
      if (nextMinutes >= (distances.get(nextState) ?? Number.POSITIVE_INFINITY) - 0.001) continue
      distances.set(nextState, nextMinutes)
      predecessors.set(nextState, { previousStateKey: current.stateKey, edge, waitMinutes })
      queue.push({ stateKey: nextState, platform: nextPlatform, onboardLineId: nextOnboard, minutes: nextMinutes })
    }
  }

  if (!bestEndState || !Number.isFinite(bestEndMinutes)) return basePlan
  return reconstructPlan(graph, predecessors, bestEndState, start, basePlan, bestEndMinutes)
}

export function planPassengerJourney(
  context: JourneyPlanningContext,
  originLineId: string,
  originStationId: string,
  destinationLineId: string,
  destinationStationId: string,
  departureMinute: number,
): GamePassengerJourneyPlan {
  return planPassengerJourneyInternal(context, originLineId, originStationId, destinationLineId, destinationStationId, departureMinute)
}

export function createPassengerJourneyPlanner(context: JourneyPlanningContext) {
  const preparedContext: JourneyPlanningContext = {
    ...context,
    graph: context.graph ?? buildPassengerGraph(context),
    lineReportsById: context.lineReportsById ?? reportMap(context.lineReports),
  }
  return {
    plan(
      originLineId: string,
      originStationId: string,
      destinationLineId: string,
      destinationStationId: string,
      departureMinute: number,
    ) {
      return planPassengerJourneyInternal(preparedContext, originLineId, originStationId, destinationLineId, destinationStationId, departureMinute)
    },
    planDirect(
      lineId: string,
      originStationId: string,
      destinationStationId: string,
      departureMinute: number,
    ) {
      const origin = platformKey(lineId, originStationId)
      const serviceKeys = [...new Set((preparedContext.graph?.adjacency.get(origin) ?? [])
        .filter((edge): edge is RideEdge => edge.kind === 'RIDE' && edge.lineId === lineId)
        .map(edge => rideServiceKey(edge)))]
      let best = emptyPlan(lineId, originStationId, lineId, destinationStationId, departureMinute)
      for (const serviceKey of serviceKeys) {
        const candidate = planPassengerJourneyInternal(
          preparedContext,
          lineId,
          originStationId,
          lineId,
          destinationStationId,
          departureMinute,
          { directLineId: lineId, directServiceKey: serviceKey },
        )
        if (!candidate.found || candidate.totalMinutes === null || candidate.transfers > 0) continue
        if (!best.found || best.totalMinutes === null || candidate.totalMinutes < best.totalMinutes) best = candidate
      }
      return best
    },
  }
}

export function createEmptyPassengersState(): GamePassengersState {
  return {
    waitingCohorts: [],
    totalGeneratedJourneys: 0,
    totalCarriedJourneys: 0,
    totalAbandonedJourneys: 0,
    totalReroutedJourneys: 0,
    lastReport: null,
  }
}

function normalizePurpose(value: unknown): GamePassengerTripPurpose {
  return ['COMMUTE', 'EDUCATION', 'LEISURE', 'OTHER'].includes(String(value))
    ? value as GamePassengerTripPurpose
    : 'OTHER'
}

export function normalizePassengersState(value: Partial<GamePassengersState> | null | undefined, network?: GameNetworkState): GamePassengersState {
  const fallback = createEmptyPassengersState()
  const validPlatforms = network
    ? new Set(network.lines.flatMap(line => getLineAllStations(line).map(station => platformKey(line.id, station.id))))
    : null
  const waitingCohorts = (Array.isArray(value?.waitingCohorts) ? value!.waitingCohorts : [])
    .filter(item => item && typeof item.originLineId === 'string' && typeof item.originStationId === 'string'
      && typeof item.destinationLineId === 'string' && typeof item.destinationStationId === 'string')
    .filter(item => !validPlatforms || (
      validPlatforms.has(platformKey(item.originLineId, item.originStationId))
      && validPlatforms.has(platformKey(item.destinationLineId, item.destinationStationId))
    ))
    .map(item => ({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 180) : createId('passenger-cohort'),
      originLineId: item.originLineId,
      originStationId: item.originStationId,
      destinationLineId: item.destinationLineId,
      destinationStationId: item.destinationStationId,
      passengers: Math.max(1, Math.round(Number(item.passengers) || 1)),
      departureMinute: Math.min(1439, Math.max(0, Math.round(Number(item.departureMinute) || 480))),
      purpose: normalizePurpose(item.purpose),
      waitedDays: Math.min(7, Math.max(0, Math.floor(Number(item.waitedDays) || 0))),
    }))
    .slice(-MAX_WAITING_COHORTS)

  return {
    waitingCohorts,
    totalGeneratedJourneys: Math.max(0, Number(value?.totalGeneratedJourneys ?? fallback.totalGeneratedJourneys) || 0),
    totalCarriedJourneys: Math.max(0, Number(value?.totalCarriedJourneys ?? fallback.totalCarriedJourneys) || 0),
    totalAbandonedJourneys: Math.max(0, Number(value?.totalAbandonedJourneys ?? fallback.totalAbandonedJourneys) || 0),
    totalReroutedJourneys: Math.max(0, Number(value?.totalReroutedJourneys ?? fallback.totalReroutedJourneys) || 0),
    lastReport: value?.lastReport && typeof value.lastReport === 'object' ? value.lastReport as GamePassengersDayReport : null,
  }
}

interface PassengerPlace {
  id: string
  platforms: Array<{ line: GameLine; station: GameStation }>
  weight: number
}

function buildPassengerPlaces(network: GameNetworkState, lineReports: GameLineDailySimulation[]) {
  const reports = reportMap(lineReports)
  const places = new Map<string, PassengerPlace>()
  for (const line of network.lines.filter(item => item.status === 'OPERATIONAL')) {
    const report = reports.get(line.id)
    const stationReports = new Map((report?.stations ?? []).map(station => [station.stationId, station] as const))
    const stations = getLineAllStations(line)
    for (const station of stations) {
      const placeId = station.sharedStationId ? `shared:${station.sharedStationId}` : `station:${line.id}:${station.id}`
      const place = places.get(placeId) ?? { id: placeId, platforms: [], weight: 0 }
      place.platforms.push({ line, station })
      const stationReport = stationReports.get(station.id)
      const fallbackWeight = Math.max(80, Number(report?.newDemandPassengers ?? 0) / Math.max(1, stations.length))
      place.weight = Math.max(place.weight, Math.max(20, Number(stationReport?.estimatedDailyFootfall ?? fallbackWeight)))
      places.set(placeId, place)
    }
  }
  return [...places.values()]
    .filter(place => place.platforms.length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_GENERATED_PLACES)
}

function bestPlatform(place: PassengerPlace, lineReports: GameLineDailySimulation[], seed: string) {
  const reports = reportMap(lineReports)
  const sorted = [...place.platforms].sort((a, b) => {
    const ar = reports.get(a.line.id)
    const br = reports.get(b.line.id)
    const aw = Number(ar?.averageWaitMinutes ?? ar?.headwayMinutes ?? 20)
    const bw = Number(br?.averageWaitMinutes ?? br?.headwayMinutes ?? 20)
    return aw - bw || a.line.id.localeCompare(b.line.id)
  })
  if (sorted.length <= 1) return sorted[0]!
  const preferred = Math.min(sorted.length - 1, Math.floor(hashUnit(seed) * Math.min(2, sorted.length)))
  return sorted[preferred]!
}

function purposeAndDeparture(day: number, calendarStartDate: string, seed: string): { purpose: GamePassengerTripPurpose; departureMinute: number } {
  const weekday = gameDayWeekdayIndex(day, calendarStartDate)
  const weekend = weekday === 0 || weekday === 6
  const r = hashUnit(`${seed}:purpose`)
  const t = hashUnit(`${seed}:time`)
  if (!weekend && r < 0.54) {
    const evening = hashUnit(`${seed}:direction`) > 0.52
    return { purpose: 'COMMUTE', departureMinute: Math.round((evening ? 16.5 * 60 : 6.75 * 60) + t * 150) }
  }
  if (!weekend && r < 0.68) return { purpose: 'EDUCATION', departureMinute: Math.round(7.2 * 60 + t * 110) }
  if (r < (weekend ? 0.78 : 0.88)) return { purpose: 'LEISURE', departureMinute: Math.round((weekend ? 10 : 11) * 60 + t * (weekend ? 660 : 600)) }
  return { purpose: 'OTHER', departureMinute: Math.round(5.5 * 60 + t * 1000) }
}

function generateDailyCohorts(
  network: GameNetworkState,
  lineReports: GameLineDailySimulation[],
  day: number,
  calendarStartDate: string,
) {
  const places = buildPassengerPlaces(network, lineReports)
  if (places.length < 2) return [] as GamePassengerCohort[]
  const baseDemand = lineReports.reduce((sum, line) => sum + Math.max(0, line.newDemandPassengers ?? line.passengers ?? 0), 0)
  const targetJourneys = Math.max(0, Math.round(baseDemand / 1.12))
  if (targetJourneys <= 0) return []
  const totalWeight = places.reduce((sum, place) => sum + place.weight, 0)
  const cohorts: GamePassengerCohort[] = []

  for (let originIndex = 0; originIndex < places.length; originIndex += 1) {
    const origin = places[originIndex]!
    const originJourneys = Math.max(1, Math.round(targetJourneys * origin.weight / Math.max(1, totalWeight)))
    const destinationCount = Math.min(3, places.length - 1)
    let remaining = originJourneys
    for (let slot = 0; slot < destinationCount; slot += 1) {
      let destinationIndex = hashIndex(`${day}:${origin.id}:${slot}`, places.length)
      if (destinationIndex === originIndex) destinationIndex = (destinationIndex + 1 + slot) % places.length
      const destination = places[destinationIndex]!
      if (destination.id === origin.id) continue
      const passengers = slot === destinationCount - 1
        ? remaining
        : Math.max(1, Math.round(originJourneys * (slot === 0 ? 0.48 : 0.31)))
      remaining = Math.max(0, remaining - passengers)
      if (passengers <= 0) continue
      const originPlatform = bestPlatform(origin, lineReports, `${day}:${origin.id}:origin:${slot}`)
      const destinationPlatform = bestPlatform(destination, lineReports, `${day}:${destination.id}:destination:${slot}`)
      const timing = purposeAndDeparture(day, calendarStartDate, `${origin.id}:${destination.id}:${slot}`)
      cohorts.push({
        id: `od:${day}:${originIndex}:${slot}`,
        originLineId: originPlatform.line.id,
        originStationId: originPlatform.station.id,
        destinationLineId: destinationPlatform.line.id,
        destinationStationId: destinationPlatform.station.id,
        passengers,
        departureMinute: timing.departureMinute,
        purpose: timing.purpose,
        waitedDays: 0,
      })
    }
  }
  return cohorts.filter(cohort => cohort.passengers > 0).sort((a, b) => a.departureMinute - b.departureMinute)
}

function planSignature(plan: GamePassengerJourneyPlan) {
  return plan.legs.map(leg => leg.kind === 'RIDE' ? `R:${leg.lineId}:${leg.fromStationId}>${leg.toStationId}` : `W:${leg.walkingTransferId ?? 'physical'}:${leg.fromStationId}>${leg.toStationId}`).join('|')
}

function lineCapacityForPlan(
  plan: GamePassengerJourneyPlan,
  lineId: string,
  remainingCapacity: Map<string, number>,
  vehicleCapacity: Map<string, number>,
  substitutionVehicleCapacity: Map<string, number>,
) {
  let capacity = Math.min(
    remainingCapacity.get(lineId) ?? 0,
    vehicleCapacity.get(lineId) ?? Number.POSITIVE_INFINITY,
  )
  const substitutionIds = plan.legs
    .filter(leg => leg.kind === 'RIDE' && leg.lineId === lineId && leg.substitutionServiceId)
    .map(leg => leg.substitutionServiceId!)
  if (substitutionIds.length > 0) {
    capacity = Math.min(capacity, ...substitutionIds.map(id => substitutionVehicleCapacity.get(id) ?? 0))
  }
  return capacity
}

function planCapacity(
  plan: GamePassengerJourneyPlan,
  remainingCapacity: Map<string, number>,
  vehicleCapacity: Map<string, number>,
  substitutionVehicleCapacity: Map<string, number>,
) {
  if (!plan.found || plan.usedLineIds.length === 0) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor(Math.min(...plan.usedLineIds.map(lineId => lineCapacityForPlan(
    plan, lineId, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity,
  )))))
}

function consumeCapacity(plan: GamePassengerJourneyPlan, passengers: number, remainingCapacity: Map<string, number>) {
  if (passengers <= 0) return
  for (const lineId of plan.usedLineIds) remainingCapacity.set(lineId, Math.max(0, (remainingCapacity.get(lineId) ?? 0) - passengers))
}

function capacityConstrainedLineIds(
  plan: GamePassengerJourneyPlan,
  passengers: number,
  remainingCapacity: Map<string, number>,
  vehicleCapacity: Map<string, number>,
  substitutionVehicleCapacity: Map<string, number>,
) {
  return plan.usedLineIds.filter(lineId => lineCapacityForPlan(
    plan, lineId, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity,
  ) < passengers)
}

function capacityRetryDelayMinutes(
  plan: GamePassengerJourneyPlan,
  reports: Map<string, GameLineDailySimulation>,
  constrainedLineIds: string[],
) {
  const lineIds = constrainedLineIds.length > 0 ? constrainedLineIds : plan.usedLineIds
  if (lineIds.length === 0) return 12
  const headways = lineIds
    .map(lineId => Number(reports.get(lineId)?.headwayMinutes ?? 0))
    .filter(value => Number.isFinite(value) && value > 0)
  if (headways.length === 0) return 12
  return Math.min(60, Math.max(2, Math.round(Math.max(...headways))))
}

function planWithAdditionalWait(plan: GamePassengerJourneyPlan, originalDepartureMinute: number) {
  const extraWait = Math.max(0, plan.departureMinute - originalDepartureMinute)
  if (extraWait <= 0 || !plan.found) return plan
  return {
    ...plan,
    departureMinute: originalDepartureMinute,
    totalMinutes: plan.totalMinutes === null ? null : plan.totalMinutes + extraWait,
    waitingMinutes: plan.waitingMinutes + extraWait,
  }
}

function firstBoardingMinute(plan: GamePassengerJourneyPlan) {
  let minute = plan.departureMinute
  for (const leg of plan.legs) {
    if (leg.kind === 'WALK') {
      minute += leg.minutes
      continue
    }
    return minute + Math.max(0, leg.waitingMinutes)
  }
  return null
}

function stationName(network: GameNetworkState, lineId: string, stationId: string) {
  const line = network.lines.find(item => item.id === lineId)
  return line ? findLineStation(line, stationId)?.name ?? 'Station' : 'Station'
}

function addLineUsage(
  plan: GamePassengerJourneyPlan,
  requestedPassengers: number,
  transportedPassengers: number,
  lineLoads: Map<string, MutableLineLoad>,
) {
  const rideLegs = plan.legs.filter(leg => leg.kind === 'RIDE' && leg.lineId)
  const boardings: string[] = []
  for (const leg of rideLegs) {
    if (boardings.at(-1) !== leg.lineId) boardings.push(leg.lineId!)
  }
  for (let index = 0; index < boardings.length; index += 1) {
    const lineId = boardings[index]!
    const load = lineLoads.get(lineId)
    if (!load) continue
    load.requestedBoardings += requestedPassengers
    load.transportedBoardings += transportedPassengers
    if (index > 0) load.transferBoardings += transportedPassengers
  }
}

function addStationFlow(
  flows: Map<string, MutableStationFlow>,
  lineId: string,
  stationId: string,
  field: keyof MutableStationFlow,
  passengers: number,
) {
  if (passengers <= 0) return
  const key = platformKey(lineId, stationId)
  const flow = flows.get(key) ?? { boardings: 0, alightings: 0, transferBoardings: 0, leftBehindPassengers: 0 }
  flow[field] += passengers
  flows.set(key, flow)
}

function recordStationUsage(
  plan: GamePassengerJourneyPlan,
  passengers: number,
  flows: Map<string, MutableStationFlow>,
  segmentFlows: Map<string, number>,
) {
  if (passengers <= 0) return
  const rideLegs = plan.legs.filter((leg): leg is GamePassengerJourneyLeg & { lineId: string } => leg.kind === 'RIDE' && Boolean(leg.lineId))
  let previousLineId: string | null = null
  for (let index = 0; index < rideLegs.length; index += 1) {
    const leg = rideLegs[index]!
    const lineId = leg.lineId
    const isNewBoarding = previousLineId !== lineId
    if (isNewBoarding) {
      addStationFlow(flows, lineId, leg.fromStationId, 'boardings', passengers)
      if (previousLineId) addStationFlow(flows, lineId, leg.fromStationId, 'transferBoardings', passengers)
    }
    const pair = [leg.fromStationId, leg.toStationId].sort()
    const segmentKey = `${lineId}::${pair[0]}::${pair[1]}`
    segmentFlows.set(segmentKey, (segmentFlows.get(segmentKey) ?? 0) + passengers)
    const next = rideLegs[index + 1]
    if (!next || next.lineId !== lineId) addStationFlow(flows, lineId, leg.toStationId, 'alightings', passengers)
    previousLineId = lineId
  }
}

function recordWalkingUsage(plan: GamePassengerJourneyPlan, passengers: number, usage: Map<string, number>) {
  if (passengers <= 0) return
  for (const transferId of plan.usedWalkingTransferIds) usage.set(transferId, (usage.get(transferId) ?? 0) + passengers)
}

function retentionRate(waitedDays: number, noRoute = false) {
  const base = waitedDays <= 0 ? 0.72 : waitedDays === 1 ? 0.48 : 0.24
  return noRoute ? Math.max(0.18, base - 0.18) : base
}

export function simulatePassengerJourneys(
  state: GamePassengersState,
  network: GameNetworkState,
  lineReports: GameLineDailySimulation[],
  day: number,
  calendarStartDate: string,
  operations?: GameOperationsState | null,
): GamePassengersDayReport {
  const generated = generateDailyCohorts(network, lineReports, day, calendarStartDate)
  const newlyGeneratedJourneys = generated.reduce((sum, cohort) => sum + Math.max(0, Math.round(cohort.passengers)), 0)
  const cohorts = [
    ...state.waitingCohorts.map(cohort => ({ ...cohort, departureMinute: Math.min(1439, Math.max(300, cohort.departureMinute)) })),
    ...generated,
  ].sort((a, b) => a.departureMinute - b.departureMinute)

  const remainingCapacity = new Map(lineReports.map(report => [report.lineId, Math.max(0, Math.floor(report.dailyCapacity ?? 0))] as const))
  const vehicleCapacity = new Map(lineReports.map(report => [
    report.lineId,
    Math.max(1, Math.floor(
      Math.max(1, Number(report.effectiveVehicleCapacity ?? report.dailyCapacity ?? 1))
      * Math.max(0.05, Number(report.operationsCapacityMultiplier ?? 1)),
    )),
  ] as const))
  const substitutionVehicleCapacity = new Map<string, number>()
  // Phase 19 : un bus de substitution apporte une capacité réelle au corridor interrompu.
  for (const service of operations?.substitutionServices ?? []) {
    if (!substitutionTouchesDay(service, day)) continue
    remainingCapacity.set(service.lineId, (remainingCapacity.get(service.lineId) ?? 0) + Math.max(0, Math.floor(service.dailyCapacity)))
    substitutionVehicleCapacity.set(service.id, Math.max(1, Math.floor(service.busCapacity)))
  }
  const reports = reportMap(lineReports)
  const lineLoads = new Map<string, MutableLineLoad>(lineReports.map(report => [report.lineId, {
    requestedBoardings: 0,
    transportedBoardings: 0,
    transferBoardings: 0,
    leftBehindPassengers: 0,
  }]))
  const walkingUsage = new Map<string, number>()
  const stationFlows = new Map<string, MutableStationFlow>()
  const segmentFlows = new Map<string, number>()
  const nextWaiting: GamePassengerCohort[] = []
  const samples: GamePassengerJourneySample[] = []

  let journeyDemandToday = 0
  let carriedJourneys = 0
  let leftBehindJourneys = 0
  let abandonedJourneys = 0
  let noRouteJourneys = 0
  let reroutedJourneys = 0
  let transferJourneys = 0
  let walkingTransferJourneys = 0
  let weightedJourneyMinutes = 0
  let weightedWaitMinutes = 0
  let weightedWalkMinutes = 0
  let weightedTransfers = 0
  let reachableJourneys = 0

  // V50/performance : le graphe de routage est immuable pendant toute la simulation
  // d'une journée. Le reconstruire pour chaque cohorte (et chaque tentative) faisait
  // exploser le temps CPU sur les grands réseaux.
  const baseContext: JourneyPlanningContext = { network, day, calendarStartDate, operations, lineReports }
  baseContext.lineReportsById = reportMap(lineReports)
  baseContext.graph = buildPassengerGraph(baseContext)

  for (const cohort of cohorts) {
    const count = Math.max(1, Math.round(cohort.passengers))
    journeyDemandToday += count
    const primary = planPassengerJourney(
      baseContext,
      cohort.originLineId,
      cohort.originStationId,
      cohort.destinationLineId,
      cohort.destinationStationId,
      cohort.departureMinute,
    )

    let transported = 0
    let rerouted = 0
    let waiting = 0
    let abandoned = 0
    let initialLeftBehind = 0
    let finalPlan = primary
    const transportedPlans: Array<{ plan: GamePassengerJourneyPlan; passengers: number }> = []

    const recordTransport = (
      plan: GamePassengerJourneyPlan,
      requestedPassengers: number,
      transportedPassengers: number,
    ) => {
      if (transportedPassengers <= 0) return
      transported += transportedPassengers
      transportedPlans.push({ plan, passengers: transportedPassengers })
      consumeCapacity(plan, transportedPassengers, remainingCapacity)
      addLineUsage(plan, requestedPassengers, transportedPassengers, lineLoads)
      recordStationUsage(plan, transportedPassengers, stationFlows, segmentFlows)
      recordWalkingUsage(plan, transportedPassengers, walkingUsage)
      finalPlan = plan
    }

    if (!primary.found || primary.usedLineIds.length === 0) {
      noRouteJourneys += count
      const retained = Math.round(count * retentionRate(cohort.waitedDays, true))
      waiting = Math.min(count, retained)
      abandoned = count - waiting
      if (waiting > 0) nextWaiting.push({ ...cohort, passengers: waiting, waitedDays: cohort.waitedDays + 1 })
    }
    else {
      reachableJourneys += count
      const constrainedAtFirstBoarding = capacityConstrainedLineIds(primary, count, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
      const baseCapacity = planCapacity(primary, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
      const onPrimary = Math.min(count, Number.isFinite(baseCapacity) ? baseCapacity : count)
      recordTransport(primary, count, onPrimary)

      let overflow = count - onPrimary
      initialLeftBehind = overflow
      if (initialLeftBehind > 0) {
        for (const lineId of constrainedAtFirstBoarding) {
          const load = lineLoads.get(lineId)
          if (load) load.leftBehindPassengers += initialLeftBehind
          const originStationId = primary.legs.find(leg => leg.kind === 'RIDE' && leg.lineId === lineId)?.fromStationId
          if (originStationId) addStationFlow(stationFlows, lineId, originStationId, 'leftBehindPassengers', initialLeftBehind)
        }
      }

      if (overflow > 0) {
        const constrained = capacityConstrainedLineIds(primary, overflow, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
        const penalties = Object.fromEntries(primary.usedLineIds.map(lineId => [lineId, constrained.includes(lineId) ? 95 : 28]))
        const blocked = new Set(constrained)
        const alternative = planPassengerJourney(
          { ...baseContext, linePenaltyMinutes: penalties, blockedLineIds: blocked },
          cohort.originLineId,
          cohort.originStationId,
          cohort.destinationLineId,
          cohort.destinationStationId,
          cohort.departureMinute,
        )
        if (alternative.found && alternative.usedLineIds.length > 0 && planSignature(alternative) !== planSignature(primary)) {
          const altCapacity = planCapacity(alternative, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
          const onAlternative = Math.min(overflow, Number.isFinite(altCapacity) ? altCapacity : overflow)
          if (onAlternative > 0) {
            rerouted = onAlternative
            const requestedAlternative = overflow
            overflow -= onAlternative
            recordTransport(alternative, requestedAlternative, onAlternative)
          }
        }
      }

      // Un véhicule saturé ne reporte pas automatiquement les voyageurs au
      // lendemain : ils retentent d'abord sur les circulations suivantes.
      // La capacité par rame limite chaque tentative, tandis que
      // remainingCapacity conserve la borne journalière de V46/V47.
      if (overflow > 0) {
        const constrained = capacityConstrainedLineIds(primary, overflow, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
        const retryDelay = capacityRetryDelayMinutes(primary, reports, constrained)
        for (let retryIndex = 1; retryIndex <= MAX_SAME_DAY_CAPACITY_RETRIES && overflow > 0; retryIndex += 1) {
          const retryDeparture = cohort.departureMinute + retryDelay * retryIndex
          if (retryDeparture > 1439) break
          const retryPlanRaw = planPassengerJourney(
            baseContext,
            cohort.originLineId,
            cohort.originStationId,
            cohort.destinationLineId,
            cohort.destinationStationId,
            retryDeparture,
          )
          const boardingMinute = firstBoardingMinute(retryPlanRaw)
          if (!retryPlanRaw.found || retryPlanRaw.usedLineIds.length === 0 || boardingMinute === null || boardingMinute >= 1440) break
          const retryPlan = planWithAdditionalWait(retryPlanRaw, cohort.departureMinute)
          const retryCapacity = planCapacity(retryPlan, remainingCapacity, vehicleCapacity, substitutionVehicleCapacity)
          const onRetry = Math.min(overflow, Number.isFinite(retryCapacity) ? retryCapacity : overflow)
          if (onRetry <= 0) continue
          const requestedRetry = overflow
          overflow -= onRetry
          recordTransport(retryPlan, requestedRetry, onRetry)
        }
      }

      if (overflow > 0) {
        const retained = Math.round(overflow * retentionRate(cohort.waitedDays, false))
        waiting = Math.min(overflow, retained)
        abandoned = overflow - waiting
        if (waiting > 0) nextWaiting.push({ ...cohort, passengers: waiting, waitedDays: cohort.waitedDays + 1 })
      }
    }

    carriedJourneys += transported
    leftBehindJourneys += initialLeftBehind
    abandonedJourneys += abandoned
    reroutedJourneys += rerouted
    for (const item of transportedPlans) {
      if (item.plan.transfers > 0) transferJourneys += item.passengers
      if (item.plan.usedWalkingTransferIds.length > 0) walkingTransferJourneys += item.passengers
      weightedJourneyMinutes += (item.plan.totalMinutes ?? 0) * item.passengers
      weightedWaitMinutes += item.plan.waitingMinutes * item.passengers
      weightedWalkMinutes += item.plan.walkingMinutes * item.passengers
      weightedTransfers += item.plan.transfers * item.passengers
    }

    if (samples.length < MAX_REPORT_SAMPLES && (cohort.passengers >= 8 || rerouted > 0 || abandoned > 0 || initialLeftBehind > 0)) {
      samples.push({
        id: cohort.id,
        originStationName: stationName(network, cohort.originLineId, cohort.originStationId),
        destinationStationName: stationName(network, cohort.destinationLineId, cohort.destinationStationId),
        passengers: count,
        transportedPassengers: transported,
        leftBehindPassengers: initialLeftBehind,
        abandonedPassengers: abandoned,
        reroutedPassengers: rerouted,
        departureMinute: cohort.departureMinute,
        purpose: cohort.purpose,
        totalMinutes: finalPlan.totalMinutes,
        waitingMinutes: finalPlan.waitingMinutes,
        walkingMinutes: finalPlan.walkingMinutes,
        transfers: finalPlan.transfers,
        usedLineIds: finalPlan.usedLineIds,
        usedWalkingTransferIds: finalPlan.usedWalkingTransferIds,
      })
    }
  }

  state.waitingCohorts = nextWaiting
    .filter(cohort => cohort.passengers > 0 && cohort.waitedDays <= 3)
    .sort((a, b) => b.passengers - a.passengers)
    .slice(0, MAX_WAITING_COHORTS)

  const linesById = new Map(network.lines.map(line => [line.id, line] as const))
  const reportByLine = reportMap(lineReports)
  const normalizedLineLoads: GamePassengerLineLoad[] = [...lineLoads.entries()].map(([lineId, load]) => {
    const line = linesById.get(lineId)
    const capacity = Math.max(0, Math.floor(reportByLine.get(lineId)?.dailyCapacity ?? 0))
    return {
      lineId,
      lineName: line?.name ?? lineId,
      requestedBoardings: load.requestedBoardings,
      transportedBoardings: load.transportedBoardings,
      transferBoardings: load.transferBoardings,
      leftBehindPassengers: load.leftBehindPassengers,
      capacity,
      loadRate: capacity > 0 ? load.requestedBoardings / capacity : load.requestedBoardings > 0 ? 2 : 0,
    }
  }).sort((a, b) => b.requestedBoardings - a.requestedBoardings)

  const normalizedSegmentFlows: GamePassengerSegmentFlow[] = [...segmentFlows.entries()]
    .map(([key, passengers]) => {
      const [lineId, fromStationId, toStationId] = key.split('::')
      return { lineId: lineId ?? '', fromStationId: fromStationId ?? '', toStationId: toStationId ?? '', passengers }
    })
    .filter(flow => Boolean(flow.lineId && flow.fromStationId && flow.toStationId))
    .sort((a, b) => b.passengers - a.passengers)

  const normalizedStationFlows: GamePassengerStationFlow[] = [...stationFlows.entries()]
    .map(([key, flow]) => {
      const [lineId, stationId] = key.split('::')
      return {
        lineId: lineId ?? '',
        stationId: stationId ?? '',
        stationName: stationName(network, lineId ?? '', stationId ?? ''),
        ...flow,
      }
    })
    .filter(flow => Boolean(flow.lineId && flow.stationId))
    .sort((a, b) => (b.boardings + b.alightings + b.transferBoardings) - (a.boardings + a.alightings + a.transferBoardings))

  const report: GamePassengersDayReport = {
    day,
    generatedJourneys: newlyGeneratedJourneys,
    carriedJourneys,
    leftBehindJourneys,
    abandonedJourneys,
    noRouteJourneys,
    reroutedJourneys,
    transferJourneys,
    walkingTransferJourneys,
    averageJourneyMinutes: carriedJourneys > 0 ? weightedJourneyMinutes / carriedJourneys : 0,
    averageWaitingMinutes: carriedJourneys > 0 ? weightedWaitMinutes / carriedJourneys : 0,
    averageWalkingMinutes: carriedJourneys > 0 ? weightedWalkMinutes / carriedJourneys : 0,
    averageTransfers: carriedJourneys > 0 ? weightedTransfers / carriedJourneys : 0,
    reachableJourneyRate: journeyDemandToday > 0 ? reachableJourneys / journeyDemandToday : 1,
    carriedJourneyRate: journeyDemandToday > 0 ? carriedJourneys / journeyDemandToday : 1,
    lineLoads: normalizedLineLoads,
    stationFlows: normalizedStationFlows,
    segmentFlows: normalizedSegmentFlows,
    walkingTransferUsage: [...walkingUsage.entries()]
      .map(([transferId, passengers]) => ({ transferId, passengers }))
      .sort((a, b) => b.passengers - a.passengers),
    samples,
  }

  state.totalGeneratedJourneys += newlyGeneratedJourneys
  state.totalCarriedJourneys += carriedJourneys
  state.totalAbandonedJourneys += abandonedJourneys
  state.totalReroutedJourneys += reroutedJourneys
  state.lastReport = report

  return report
}
