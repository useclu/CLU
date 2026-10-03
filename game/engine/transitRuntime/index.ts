import { getModeSimulationDefinition } from '../../config/simulation'
import { getServiceLevelDefinition } from '../../config/operations'
import { calculateAvailableVehicles } from '../maintenance'
import {
  calculateActiveBoostVehicles,
  calculateFleetSupportedDeparturesPerHour,
  calculateRequiredVehiclesForService,
  effectiveAverageSpeedKmH,
  effectiveVehicleCapacity,
  rollingStockPerformance,
} from '../rollingStock'
import type { GameInterchangeLink, GameLine, GameNetworkState, GameStation } from '../../types/network'
import type { GameOperationsState } from '../../types/operations'
import { findLineStation, getLineAllStations, getLineServiceRoutes } from '../network/geometry'
import { getSegmentCoordinates } from '../network/pathGeometry'
import { missionDurationMinutes, missionStationOffsets } from '../timetable'
import { absoluteGameMinute, activeSubstitutionServicesAt, buildOperationalRunsForLineDay, currentLineOperationalImpact } from '../operations'

const EARTH_RADIUS_M = 6_371_000

// Phase 21 : la carte peut demander des centaines de positions véhicule par
// seconde. Les géométries et longueurs de segment ne changent que lorsque la
// ligne est modifiée (`updatedAt`) : on les met donc en cache au lieu de refaire
// les calculs trigonométriques pour chaque rame/bus à chaque tick.
interface CachedSegmentGeometry {
  coordinates: Array<[number, number]>
  lengths: number[]
  total: number
}
const segmentGeometryCache = new Map<string, CachedSegmentGeometry>()
const routeTravelMinutesCache = new Map<string, number>()

function trimRuntimeCaches() {
  if (segmentGeometryCache.size > 4_000) segmentGeometryCache.clear()
  if (routeTravelMinutesCache.size > 1_500) routeTravelMinutesCache.clear()
}

export function stationDistanceMeters(a: GameStation, b: GameStation) {
  const toRad = (value: number) => value * Math.PI / 180
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLat = lat2 - lat1
  const dLon = toRad(b.longitude - a.longitude)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function interchangeQuality(distanceMeters: number): GameInterchangeLink['quality'] {
  if (distanceMeters <= 150) return 'DIRECT'
  if (distanceMeters <= 350) return 'GOOD'
  if (distanceMeters <= 600) return 'LONG'
  return 'VERY_LONG'
}

export function buildInterchanges(network: GameNetworkState): GameInterchangeLink[] {
  const links: GameInterchangeLink[] = []
  const seen = new Set<string>()
  const lines = network.lines.filter(line => line.status === 'OPERATIONAL' || line.status === 'CONSTRUCTION')
  const lineById = new Map(lines.map(line => [line.id, line] as const))

  const pairKey = (aLine: string, aStation: string, bLine: string, bStation: string) => {
    const a = `${aLine}:${aStation}`
    const b = `${bLine}:${bStation}`
    return a < b ? `${a}|${b}` : `${b}|${a}`
  }

  // Phase 21 : l'ancien algorithme comparait chaque station de chaque paire de
  // lignes (O(lignes² × stations²)). Sur 100+ lignes, c'était l'un des plus gros
  // coûts lors d'un clic ou d'un rafraîchissement Vue. On indexe maintenant les
  // identifiants physiques puis on ne compare que les stations réellement liées.
  const physicalGroups = new Map<string, Array<{ lineId: string; station: GameStation }>>()
  for (const line of lines) {
    for (const station of getLineAllStations(line)) {
      const keys = new Set<string>()
      if (station.sharedStationId) keys.add(`shared:${station.sharedStationId}`)
      // Compatibilité historique : certaines sauvegardes partagent directement
      // le même id d'arrêt sans `sharedStationId`.
      keys.add(`id:${station.id}`)
      for (const key of keys) {
        const group = physicalGroups.get(key) ?? []
        group.push({ lineId: line.id, station })
        physicalGroups.set(key, group)
      }
    }
  }

  for (const group of physicalGroups.values()) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i += 1) {
      const a = group[i]!
      for (let j = i + 1; j < group.length; j += 1) {
        const b = group[j]!
        if (a.lineId === b.lineId) continue
        const key = pairKey(a.lineId, a.station.id, b.lineId, b.station.id)
        if (seen.has(key)) continue
        seen.add(key)
        links.push({
          fromLineId: a.lineId,
          fromStationId: a.station.id,
          toLineId: b.lineId,
          toStationId: b.station.id,
          distanceMeters: 0,
          walkingMinutes: 2,
          kind: 'PHYSICAL',
          quality: 'DIRECT',
        })
      }
    }
  }

  // Les stations distinctes ne sont reliées que si le joueur a explicitement
  // créé une liaison piétonne. La liaison est bidirectionnelle dans le moteur.
  for (const transfer of network.walkingTransfers ?? []) {
    const fromLine = lineById.get(transfer.fromLineId)
    const toLine = lineById.get(transfer.toLineId)
    const from = fromLine ? findLineStation(fromLine, transfer.fromStationId) : null
    const to = toLine ? findLineStation(toLine, transfer.toStationId) : null
    if (!fromLine || !toLine || !from || !to) continue
    const key = pairKey(fromLine.id, from.id, toLine.id, to.id)
    if (seen.has(key)) continue
    seen.add(key)
    const distanceMeters = Number.isFinite(transfer.distanceMeters)
      ? Math.max(0, transfer.distanceMeters)
      : stationDistanceMeters(from, to)
    links.push({
      fromLineId: fromLine.id,
      fromStationId: from.id,
      toLineId: toLine.id,
      toStationId: to.id,
      distanceMeters,
      walkingMinutes: Math.min(60, Math.max(1, Number(transfer.walkingMinutes) || 1)),
      kind: 'WALKING',
      manualLinkId: transfer.id,
      quality: interchangeQuality(distanceMeters),
    })
  }

  return links
}

export function interchangesForStation(network: GameNetworkState, lineId: string, stationId: string) {
  return buildInterchanges(network).filter(link =>
    (link.fromLineId === lineId && link.fromStationId === stationId)
    || (link.toLineId === lineId && link.toStationId === stationId),
  )
}

export interface GameVisualVehicle {
  id: string
  lineId: string
  lineName: string
  shortCode: string
  color: string
  mode: string
  longitude: number
  latitude: number
  direction: 1 | -1
  /** Position continue le long de la ligne : 0 = terminus A, N = terminus B. */
  routePosition: number
  lineTravelMinutes: number
  nextStationId: string
  nextStationName: string
  terminusName: string
  passengers: number
  capacity: number
  occupancyRate: number
  etaNextMinutes: number
  etaTerminusMinutes: number
  delayMinutes: number
  generation: string
  regularityScore: number
  /** Suite d'arrêts réellement suivie par ce véhicule, tronc ou branche. */
  routeStationIds: string[]
  /** Renseigné pour une circulation issue d'une grille horaire personnalisée. */
  missionCode?: string
  missionName?: string
  scheduledDepartureMinute?: number
  effectiveDepartureMinute?: number
  isExtraService?: boolean
  /** Phase 20 : orientation cartographique du véhicule. */
  bearing: number
  /** État visuel dérivé de la circulation, sans créer une seconde simulation. */
  motionState: 'STOPPED' | 'ACCELERATING' | 'CRUISING' | 'DECELERATING'
  currentStationId?: string
  currentStationName?: string
  /** Forme de rendu simplifiée selon le mode. */
  visualKind: 'BUS' | 'RAIL' | 'CABLE' | 'FERRY'
  /** Véhicule temporaire d'un service BUS de substitution Phase 19. */
  isSubstitution?: boolean
  sourceDisruptionId?: string
}

export interface GameStationPassage {
  vehicleId: string
  lineId: string
  lineName: string
  shortCode: string
  color: string
  stationId: string
  stationName: string
  direction: 1 | -1
  directionName: string
  etaMinutes: number
  /** Présent lorsque le passage vient d'une grille horaire manuelle. */
  missionCode?: string
  missionName?: string
  scheduledMinute?: number
  effectiveMinute?: number
  delayMinutes?: number
  isExtraService?: boolean
}

function bearingDegrees(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180
  const toDeg = (value: number) => value * 180 / Math.PI
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function visualKindForMode(mode: string): GameVisualVehicle['visualKind'] {
  if (mode === 'BUS' || mode === 'BRT') return 'BUS'
  if (mode === 'CABLE') return 'CABLE'
  if (mode === 'FERRY') return 'FERRY'
  return 'RAIL'
}

function interpolate(a: GameStation, b: GameStation, t: number) {
  return {
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    latitude: a.latitude + (b.latitude - a.latitude) * t,
  }
}


function cachedSegmentGeometry(line: GameLine, a: GameStation, b: GameStation): CachedSegmentGeometry | null {
  const key = `${line.id}:${line.updatedAt}:${a.id}>${b.id}`
  const cached = segmentGeometryCache.get(key)
  if (cached) return cached
  const source = getSegmentCoordinates(line, a, b)
  const coordinates = source && source.length >= 2
    ? source.map(point => [point[0], point[1]] as [number, number])
    : [[a.longitude, a.latitude], [b.longitude, b.latitude]] as Array<[number, number]>
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1]!
    const to = coordinates[index]!
    const length = stationDistanceMeters(
      { id: '', name: '', longitude: from[0], latitude: from[1] },
      { id: '', name: '', longitude: to[0], latitude: to[1] },
    )
    lengths.push(length)
    total += length
  }
  const value = { coordinates, lengths, total }
  segmentGeometryCache.set(key, value)
  trimRuntimeCaches()
  return value
}

function interpolateAlongSegment(line: GameLine, a: GameStation, b: GameStation, t: number) {
  const geometry = cachedSegmentGeometry(line, a, b)
  if (!geometry || geometry.total <= 1 || geometry.coordinates.length < 2) return interpolate(a, b, t)
  let remaining = Math.max(0, Math.min(1, t)) * geometry.total
  for (let index = 0; index < geometry.lengths.length; index += 1) {
    const length = geometry.lengths[index]!
    if (remaining <= length || index === geometry.lengths.length - 1) {
      const from = geometry.coordinates[index]!
      const to = geometry.coordinates[index + 1]!
      const local = length > 0 ? remaining / length : 0
      return { longitude: from[0] + (to[0] - from[0]) * local, latitude: from[1] + (to[1] - from[1]) * local }
    }
    remaining -= length
  }
  return interpolate(a, b, t)
}

function calculateRollingRuntimeTravelMinutes(line: GameLine, route: GameStation[]) {
  const cacheKey = `${line.id}:${line.updatedAt}:${route.map(station => station.id).join('>')}`
  const cached = routeTravelMinutesCache.get(cacheKey)
  if (cached !== undefined) return cached
  let lengthKm = 0
  for (let index = 1; index < route.length; index += 1) {
    const geometry = cachedSegmentGeometry(line, route[index - 1]!, route[index]!)
    lengthKm += Math.max(0, geometry?.total ?? 0) / 1000
  }
  const speed = Math.max(1, effectiveAverageSpeedKmH(line))
  const dwell = Math.max(0, route.length - 2) * 0.45 * rollingStockPerformance(line).dwellTimeMultiplier
  const travelMinutes = lengthKm / speed * 60 + dwell
  routeTravelMinutesCache.set(cacheKey, travelMinutes)
  trimRuntimeCaches()
  return travelMinutes
}

export interface GameTransitClockContext {
  day: number
  calendarStartDate: string
  gameMinute: number
  operations?: GameOperationsState | null
}

function buildTimetableVisualVehicles(line: GameLine, report: any, context: GameTransitClockContext): GameVisualVehicle[] {
  if (line.schedule?.mode !== 'TIMETABLE') return []
  const result: GameVisualVehicle[] = []
  const baseCapacity = Math.max(1, Number(report?.effectiveVehicleCapacity ?? effectiveVehicleCapacity(line)))
  const occupancy = report ? Math.max(0, Math.min(1.25, Number(report.occupancyRate ?? 0))) : 0
  const performance = rollingStockPerformance(line)

  for (const dayOffset of [-1, 0]) {
    const targetDay = context.day + dayOffset
    if (targetDay < 1) continue
    const runs = buildOperationalRunsForLineDay(line, targetDay, context.calendarStartDate, context.operations)
    for (const run of runs) {
      if (run.cancelled) continue
      const mission = line.schedule.missions.find(item => item.id === run.missionId)
      if (!mission) continue
      const route = run.routeStationIds
        .map(id => findLineStation(line, id))
        .filter((station): station is GameStation => Boolean(station))
      if (route.length < 2) continue
      const offsets = missionStationOffsets(line, mission)
      const terminusOffset = offsets.get(route[route.length - 1]!.id)
      const duration = Math.max(0.1, terminusOffset ?? missionDurationMinutes(line, mission))
      const startMinute = dayOffset * 1440 + run.effectiveDepartureMinute
      const elapsed = context.gameMinute - startMinute
      if (elapsed < 0 || elapsed > duration) continue

      let segmentIndex = route.length - 2
      for (let index = 0; index < route.length - 1; index += 1) {
        const nextOffset = offsets.get(route[index + 1]!.id) ?? duration
        if (elapsed <= nextOffset) { segmentIndex = index; break }
      }
      const a = route[segmentIndex]!
      const b = route[segmentIndex + 1]!
      const aOffset = offsets.get(a.id) ?? 0
      const bOffset = Math.max(aOffset + 0.01, offsets.get(b.id) ?? duration)
      const local = Math.max(0, Math.min(1, (elapsed - aOffset) / (bOffset - aOffset)))
      const position = interpolateAlongSegment(line, a, b, local)
      const direction: 1 | -1 = line.stations[0]?.id === route[0]?.id ? 1 : -1
      const terminus = route[route.length - 1]!
      const capacity = Math.max(1, Math.round(baseCapacity * run.capacityMultiplier))

      result.push({
        id: `${line.id}-schedule-${run.id}`,
        lineId: line.id,
        lineName: line.name,
        shortCode: line.shortCode,
        color: line.color,
        mode: line.mode,
        longitude: position.longitude,
        latitude: position.latitude,
        direction,
        routePosition: segmentIndex + local,
        lineTravelMinutes: duration,
        nextStationId: b.id,
        nextStationName: b.name,
        terminusName: terminus.name,
        passengers: Math.round(capacity * Math.min(1, occupancy)),
        capacity,
        occupancyRate: Math.min(1.25, occupancy),
        etaNextMinutes: Math.max(0, Math.round((bOffset - elapsed) * 10) / 10),
        etaTerminusMinutes: Math.max(0, Math.round((duration - elapsed) * 10) / 10),
        delayMinutes: run.delayMinutes,
        generation: String(report?.rollingStockGeneration ?? performance.generation),
        regularityScore: Math.max(0, Math.min(100, Number(report?.regularityScore ?? 85))),
        routeStationIds: route.map(station => station.id),
        missionCode: run.missionCode,
        missionName: run.missionName,
        scheduledDepartureMinute: run.scheduledDepartureMinute,
        effectiveDepartureMinute: run.effectiveDepartureMinute,
        isExtraService: run.extra,
        bearing: bearingDegrees(a, b),
        motionState: local <= .01 || local >= .99 ? 'STOPPED' : 'CRUISING',
        currentStationId: local <= .01 ? a.id : local >= .99 ? b.id : undefined,
        currentStationName: local <= .01 ? a.name : local >= .99 ? b.name : undefined,
        visualKind: visualKindForMode(line.mode),
      })
    }
  }
  return result
}

interface VisualLineRouteCacheEntry {
  revision: string
  routes: GameStation[][]
  routeStationIds: string[][]
  travelMinutes: number[]
}

const visualLineRouteCache = new Map<string, VisualLineRouteCacheEntry>()

function visualLineRouteData(line: GameLine): VisualLineRouteCacheEntry {
  const revision = `${line.updatedAt}:${line.stations.length}:${(line.branches ?? []).map(branch => `${branch.id}:${branch.stations.length}`).join(',')}`
  const cached = visualLineRouteCache.get(line.id)
  if (cached?.revision === revision) return cached
  const routes = getLineServiceRoutes(line).filter(route => route.length >= 2)
  const entry: VisualLineRouteCacheEntry = {
    revision,
    routes,
    routeStationIds: routes.map(route => route.map(station => station.id)),
    travelMinutes: routes.map(route => calculateRollingRuntimeTravelMinutes(line, route)),
  }
  visualLineRouteCache.set(line.id, entry)
  return entry
}

export function buildVisualVehicles(lines: GameLine[], nowMs: number, lineReports: Record<string, any> = {}, clockContext?: GameTransitClockContext): GameVisualVehicle[] {
  const result: GameVisualVehicle[] = []
  const validLineIds = new Set(lines.map(line => line.id))
  for (const cachedId of [...visualLineRouteCache.keys()]) if (!validLineIds.has(cachedId)) visualLineRouteCache.delete(cachedId)
  for (const line of lines) {
    if (line.status !== 'OPERATIONAL') continue
    const report = lineReports[line.id]
    if (clockContext && line.schedule?.mode === 'TIMETABLE') {
      result.push(...buildTimetableVisualVehicles(line, report, clockContext))
      continue
    }
    const routeData = visualLineRouteData(line)
    const routes = routeData.routes
    if (routes.length === 0) continue
    const liveOperations = clockContext
      ? currentLineOperationalImpact(line, absoluteGameMinute(clockContext.day, clockContext.gameMinute), clockContext.operations)
      : null
    if (liveOperations?.suspended || (liveOperations && liveOperations.serviceMultiplier <= 0.02)) continue
    const availableVehicles = calculateAvailableVehicles(line)
    const requiredVehicles = calculateRequiredVehiclesForService(
      line,
      line.serviceProfileMode === 'ADVANCED' ? line.serviceProfile.peak : line.serviceLevel,
    )
    const boostVehicles = calculateActiveBoostVehicles(
      line,
      availableVehicles,
      Number(report?.waitingPassengersAfter ?? 0),
    )
    const baseDepartures = Math.max(0, Number(report?.departuresPerHour ?? getModeSimulationDefinition(line.mode).departuresPerHour))
    const boostedDepartures = boostVehicles > 0
      ? calculateFleetSupportedDeparturesPerHour(line, Math.min(availableVehicles, requiredVehicles + boostVehicles))
      : baseDepartures
    const departures = Math.max(0.05, Math.min(
      calculateFleetSupportedDeparturesPerHour(line, availableVehicles),
      Math.max(baseDepartures, boostedDepartures),
    ) * (liveOperations?.serviceMultiplier ?? 1))
    const count = Math.max(routes.length, Math.min(12, Math.round(departures / 2.6)))
    const baseCapacity = Math.max(1, Math.round(Number(report?.effectiveVehicleCapacity ?? effectiveVehicleCapacity(line)) * (liveOperations?.capacityMultiplier ?? 1)))
    // V45: never invent passenger load before the simulation has produced a real report.
    // Vehicles may still be rendered, but passengers/occupancy must stay aligned with Réseau.
    const occupancy = report
      ? Math.max(0, Math.min(1.25, Number(report.occupancyRate ?? 0)))
      : 0
    const performance = rollingStockPerformance(line)

    for (let index = 0; index < count; index += 1) {
      const routeIndex = index % routes.length
      const route = routes[routeIndex]!
      const segmentCount = route.length - 1
      const cycle = segmentCount * 2
      const calculatedTravel = routeData.travelMinutes[routeIndex] ?? calculateRollingRuntimeTravelMinutes(line, route)
      const reportTravel = Number(report?.effectiveTravelTimeMinutes ?? report?.estimatedTravelTimeMinutes ?? calculatedTravel)
      // Le rapport réseau décrit le tronc global. Pour une branche, on conserve
      // le temps calculé sur sa géométrie afin d'éviter des ETA incohérents.
      const travelMin = Math.max(4, routeIndex === 0 ? reportTravel : calculatedTravel)
      const cycleMs = travelMin * 2 * 60_000
      const phase = ((nowMs + cycleMs * index / count) % cycleMs) / cycleMs * cycle
      const forward = phase <= segmentCount
      const routePos = forward ? phase : cycle - phase
      const seg = Math.min(segmentCount - 1, Math.max(0, Math.floor(routePos)))
      let local = routePos - seg
      if (local < .06) local = 0
      else if (local > .94) local = 1
      else local = (local - .06) / .88

      const a = route[seg]!
      const b = route[seg + 1]!
      const position = interpolateAlongSegment(line, a, b, local)
      const direction: 1 | -1 = forward ? 1 : -1
      const nextIndex = forward ? Math.min(route.length - 1, seg + 1) : Math.max(0, seg)
      const terminus = forward ? route[route.length - 1]! : route[0]!
      const remainingSegments = forward ? (route.length - 1 - routePos) : routePos
      const perSegment = travelMin / segmentCount

      result.push({
        id: `${line.id}-r${routeIndex + 1}-v${index + 1}`,
        lineId: line.id,
        lineName: line.name,
        shortCode: line.shortCode,
        color: line.color,
        mode: line.mode,
        longitude: position.longitude,
        latitude: position.latitude,
        direction,
        routePosition: routePos,
        lineTravelMinutes: travelMin,
        nextStationId: route[nextIndex]!.id,
        nextStationName: route[nextIndex]!.name,
        terminusName: terminus.name,
        passengers: Math.round(baseCapacity * Math.min(1, occupancy)),
        capacity: baseCapacity,
        occupancyRate: Math.min(1.25, occupancy),
        etaNextMinutes: Math.max(0, Math.round((forward ? (nextIndex - routePos) : (routePos - nextIndex)) * perSegment * 10) / 10),
        etaTerminusMinutes: Math.max(0, Math.round(remainingSegments * perSegment * 10) / 10),
        delayMinutes: Math.max(0, Number(report?.estimatedDelayMinutes ?? 0)) + (liveOperations?.delayMinutes ?? 0),
        generation: String(report?.rollingStockGeneration ?? performance.generation),
        regularityScore: Math.max(0, Math.min(100, Number(report?.regularityScore ?? 85))),
        routeStationIds: routeData.routeStationIds[routeIndex] ?? route.map(station => station.id),
        bearing: bearingDegrees(a, b),
        motionState: local <= .01 || local >= .99 ? 'STOPPED' : 'CRUISING',
        currentStationId: local <= .01 ? a.id : local >= .99 ? b.id : undefined,
        currentStationName: local <= .01 ? a.name : local >= .99 ? b.name : undefined,
        visualKind: visualKindForMode(line.mode),
      })
    }
  }
  result.push(...buildSubstitutionVisualVehicles(lines, lineReports, clockContext, nowMs))
  return result
}

function buildSubstitutionVisualVehicles(
  lines: GameLine[],
  lineReports: Record<string, any>,
  context?: GameTransitClockContext,
  nowMs = Date.now(),
): GameVisualVehicle[] {
  if (!context?.operations) return []
  const absoluteMinute = absoluteGameMinute(context.day, context.gameMinute)
  const active = activeSubstitutionServicesAt(context.operations, absoluteMinute)
  const result: GameVisualVehicle[] = []
  for (const service of active) {
    const sourceLine = lines.find(line => line.id === service.lineId)
    if (!sourceLine) continue
    const route = service.stationIds
      .map(id => findLineStation(sourceLine, id))
      .filter((station): station is GameStation => Boolean(station))
    if (route.length < 2) continue
    let distanceKm = 0
    for (let i = 1; i < route.length; i += 1) distanceKm += stationDistanceMeters(route[i - 1]!, route[i]!) / 1000
    const oneWayMinutes = Math.max(4, distanceKm / 23 * 60 + Math.max(0, route.length - 2) * .45)
    const segmentCount = route.length - 1
    const cycle = segmentCount * 2
    const busCount = Math.max(1, Math.min(12, Math.floor(service.buses || Math.ceil(oneWayMinutes * 2 / Math.max(2, service.headwayMinutes)))))
    const visualMinute = nowMs / 60_000
    const report = lineReports[sourceLine.id]
    const occupancy = report ? Math.max(.15, Math.min(1.15, Number(report.networkLoadRate ?? report.occupancyRate ?? .45))) : .35
    for (let index = 0; index < busCount; index += 1) {
      const cycleMinutes = oneWayMinutes * 2
      const phase = ((visualMinute + cycleMinutes * index / busCount) % cycleMinutes) / cycleMinutes * cycle
      const forward = phase <= segmentCount
      const routePos = forward ? phase : cycle - phase
      const seg = Math.min(segmentCount - 1, Math.max(0, Math.floor(routePos)))
      let local = routePos - seg
      if (local < .06) local = 0
      else if (local > .94) local = 1
      else local = (local - .06) / .88
      const a = route[seg]!
      const b = route[seg + 1]!
      const position = interpolateAlongSegment(sourceLine, a, b, local)
      const nextIndex = forward ? Math.min(route.length - 1, seg + 1) : Math.max(0, seg)
      const terminus = forward ? route[route.length - 1]! : route[0]!
      const perSegment = oneWayMinutes / segmentCount
      const remainingSegments = forward ? (route.length - 1 - routePos) : routePos
      result.push({
        id: `substitution-${service.id}-v${index + 1}`,
        lineId: sourceLine.id,
        lineName: `Bus de substitution · ${sourceLine.name}`,
        shortCode: 'BUS',
        color: '#f0a84f',
        mode: 'BUS',
        longitude: position.longitude,
        latitude: position.latitude,
        direction: forward ? 1 : -1,
        routePosition: routePos,
        lineTravelMinutes: oneWayMinutes,
        nextStationId: route[nextIndex]!.id,
        nextStationName: route[nextIndex]!.name,
        terminusName: terminus.name,
        passengers: Math.round(service.busCapacity * Math.min(1, occupancy)),
        capacity: Math.max(1, service.busCapacity),
        occupancyRate: occupancy,
        etaNextMinutes: Math.max(0, Math.round((forward ? (nextIndex - routePos) : (routePos - nextIndex)) * perSegment * 10) / 10),
        etaTerminusMinutes: Math.max(0, Math.round(remainingSegments * perSegment * 10) / 10),
        delayMinutes: 0,
        generation: 'Bus de substitution',
        regularityScore: 82,
        routeStationIds: route.map(station => station.id),
        bearing: bearingDegrees(a, b),
        motionState: local <= .01 || local >= .99 ? 'STOPPED' : 'CRUISING',
        currentStationId: local <= .01 ? a.id : local >= .99 ? b.id : undefined,
        currentStationName: local <= .01 ? a.name : local >= .99 ? b.name : undefined,
        visualKind: 'BUS',
        isSubstitution: true,
        sourceDisruptionId: service.disruptionId,
      })
    }
  }
  return result
}

export function estimateVehicleArrivalAtStation(
  line: GameLine,
  vehicle: GameVisualVehicle,
  stationId: string,
): GameStationPassage | null {
  if (vehicle.lineId !== line.id) return null
  const route = vehicle.routeStationIds
    .map(id => findLineStation(line, id))
    .filter((station): station is GameStation => Boolean(station))
  if (route.length < 2) return null
  const stationIndex = route.findIndex(station => station.id === stationId)
  if (stationIndex < 0) return null
  const segmentCount = route.length - 1
  const perSegment = Math.max(.1, vehicle.lineTravelMinutes / segmentCount)
  let routeDistance = 0
  let passageDirection: 1 | -1

  if (vehicle.direction === 1) {
    if (stationIndex >= vehicle.routePosition) {
      routeDistance = stationIndex - vehicle.routePosition
      passageDirection = 1
    }
    else {
      routeDistance = (segmentCount - vehicle.routePosition) + (segmentCount - stationIndex)
      passageDirection = -1
    }
  }
  else if (stationIndex <= vehicle.routePosition) {
    routeDistance = vehicle.routePosition - stationIndex
    passageDirection = -1
  }
  else {
    routeDistance = vehicle.routePosition + stationIndex
    passageDirection = 1
  }

  // Un tableau de départs doit indiquer où le véhicule repart depuis la station,
  // pas le terminus qu'il vient d'atteindre. Aux deux terminus, la circulation
  // repart donc dans l'autre sens au lieu d'afficher « direction [station actuelle] ».
  let departureDirection = passageDirection
  if (stationIndex === segmentCount && passageDirection === 1) departureDirection = -1
  else if (stationIndex === 0 && passageDirection === -1) departureDirection = 1

  const etaMinutes = Math.max(0, routeDistance * perSegment + vehicle.delayMinutes)
  const directionName = departureDirection === 1 ? route[route.length - 1]!.name : route[0]!.name

  return {
    vehicleId: vehicle.id,
    lineId: line.id,
    lineName: line.name,
    shortCode: line.shortCode,
    color: line.color,
    stationId,
    stationName: route[stationIndex]!.name,
    direction: departureDirection,
    directionName,
    etaMinutes: Math.round(etaMinutes * 10) / 10,
  }
}

/**
 * Tableau voyageurs pour les lignes en fréquence.
 *
 * Important : les `GameVisualVehicle` sont volontairement peu nombreux pour la
 * carte et ne représentent pas la grille commerciale complète. Les utiliser ici
 * créait des trous artificiels (par ex. 5 min puis 125 min sur une branche).
 * Les passages sont donc générés directement depuis la fréquence réellement
 * obtenue par la ligne, route par route, sans augmenter le nombre de véhicules
 * rendus visuellement.
 */
export function buildFrequencyStationPassages(
  line: GameLine,
  stationId: string,
  report: any,
  context: GameTransitClockContext,
  limit = 3,
): GameStationPassage[] {
  if (line.status !== 'OPERATIONAL' || line.schedule?.mode === 'TIMETABLE') return []
  const station = findLineStation(line, stationId)
  if (!station) return []

  const liveOperations = currentLineOperationalImpact(
    line,
    absoluteGameMinute(context.day, context.gameMinute),
    context.operations,
  )
  if (liveOperations.suspended || liveOperations.serviceMultiplier <= 0.001) return []

  const fallbackDepartures = getModeSimulationDefinition(line.mode).departuresPerHour
    * getServiceLevelDefinition(line.serviceLevel).departuresMultiplier
  const reportedDepartures = Math.max(0, Number(report?.departuresPerHour ?? fallbackDepartures))
  const availableVehicles = calculateAvailableVehicles(line)
  const fleetSupportedDepartures = calculateFleetSupportedDeparturesPerHour(line, availableVehicles)
  const departuresPerHour = Math.max(
    0,
    Math.min(reportedDepartures, fleetSupportedDepartures) * liveOperations.serviceMultiplier,
  )
  if (departuresPerHour <= 0.001) return []

  const headwayMinutes = 60 / departuresPerHour
  // Le rapport journalier contient le retard structurel de la ligne ; les
  // perturbations actives ajoutent leur retard instantané.
  const delayMinutes = Math.max(0, Number(report?.estimatedDelayMinutes ?? 0)) + liveOperations.delayMinutes
  const allRoutes = getLineServiceRoutes(line).filter(route => route.length >= 2)
  const routes = allRoutes
    .map((route, routeIndex) => ({ route, routeIndex }))
    .filter(item => item.route.some(stationItem => stationItem.id === stationId))
  if (!routes.length) return []

  const positiveModulo = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo
  const currentMinute = Math.max(0, context.day - 1) * 1440 + Math.max(0, context.gameMinute)
  const passages: GameStationPassage[] = []
  const wanted = Math.max(1, limit)

  for (const { route, routeIndex } of routes) {
    const stationIndex = route.findIndex(item => item.id === stationId)
    if (stationIndex < 0) continue
    const segmentCount = route.length - 1
    const travelMinutes = Math.max(0.1, calculateRollingRuntimeTravelMinutes(line, route))
    const perSegment = travelMinutes / segmentCount

    // Les différentes destinations d'une ligne branchée sont décalées dans le
    // même headway. Chaque branche conserve donc sa propre succession régulière
    // (ex. Pontoise : 5, 17, 29...) sans trains virtuels superposés sur le tronc.
    const routePhase = headwayMinutes * routeIndex / Math.max(1, allRoutes.length)

    const addDirection = (direction: 1 | -1) => {
      if (direction === 1 && stationIndex >= segmentCount) return
      if (direction === -1 && stationIndex <= 0) return

      const stationOffset = direction === 1
        ? stationIndex * perSegment
        : (segmentCount - stationIndex) * perSegment
      const directionPhase = direction === 1 ? 0 : headwayMinutes / 2
      // Un retard décale la grille entière : on l'intègre dans la phase avant
      // le modulo afin qu'un train retardé du cycle précédent puisse rester le
      // prochain passage, même si le retard dépasse un headway.
      const passagePhase = routePhase + directionPhase + stationOffset + delayMinutes
      const elapsedInHeadway = positiveModulo(currentMinute - passagePhase, headwayMinutes)
      const baseEta = elapsedInHeadway < 0.0001 ? 0 : headwayMinutes - elapsedInHeadway
      const directionName = direction === 1 ? route[segmentCount]!.name : route[0]!.name
      const cycleIndex = Math.floor((currentMinute - passagePhase) / headwayMinutes) + 1

      // On génère quelques occurrences de chaque desserte puis on trie globalement.
      // Cela garantit que demander 3 passages peut retourner plusieurs trains de
      // la même branche au lieu de dépendre du nombre de points dessinés sur la carte.
      for (let sequence = 0; sequence < wanted + 1; sequence += 1) {
        const etaMinutes = Math.max(0, baseEta + sequence * headwayMinutes)
        passages.push({
          vehicleId: `${line.id}-frequency-r${routeIndex + 1}-${direction === 1 ? 'f' : 'r'}-${cycleIndex + sequence}`,
          lineId: line.id,
          lineName: line.name,
          shortCode: line.shortCode,
          color: line.color,
          stationId,
          stationName: station.name,
          direction,
          directionName,
          etaMinutes: Math.round(etaMinutes * 10) / 10,
          delayMinutes: delayMinutes > 0 ? Math.round(delayMinutes * 10) / 10 : undefined,
        })
      }
    }

    addDirection(1)
    addDirection(-1)
  }

  return passages
    .sort((a, b) => a.etaMinutes - b.etaMinutes || a.directionName.localeCompare(b.directionName))
    .slice(0, wanted)
}

export function buildStationPassages(
  lines: GameLine[],
  vehicles: GameVisualVehicle[],
  lineId: string,
  stationId: string,
  limit = 3,
): GameStationPassage[] {
  const line = lines.find(item => item.id === lineId)
  if (!line) return []
  return vehicles
    .filter(vehicle => vehicle.lineId === lineId)
    .map(vehicle => estimateVehicleArrivalAtStation(line, vehicle, stationId))
    .filter((item): item is GameStationPassage => Boolean(item))
    .sort((a, b) => a.etaMinutes - b.etaMinutes)
    .slice(0, Math.max(1, limit))
}
