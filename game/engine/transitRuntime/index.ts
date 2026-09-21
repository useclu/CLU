import { getModeSimulationDefinition } from '../../config/simulation'
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
import { findLineStation, getLineAllStations, getLineServiceRoutes } from '../network/geometry'
import { getSegmentCoordinates } from '../network/pathGeometry'

const EARTH_RADIUS_M = 6_371_000

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

export function buildInterchanges(network: GameNetworkState, maxDistanceMeters = 800): GameInterchangeLink[] {
  const links: GameInterchangeLink[] = []
  const lines = network.lines.filter(line => line.status === 'OPERATIONAL' || line.status === 'CONSTRUCTION')
  for (let i = 0; i < lines.length; i += 1) {
    const a = lines[i]!
    for (let j = i + 1; j < lines.length; j += 1) {
      const b = lines[j]!
      for (const sa of getLineAllStations(a)) {
        for (const sb of getLineAllStations(b)) {
          const shared = Boolean(sa.sharedStationId && sb.sharedStationId && sa.sharedStationId === sb.sharedStationId) || sa.id === sb.id
          const distanceMeters = shared ? 0 : stationDistanceMeters(sa, sb)
          if (distanceMeters <= maxDistanceMeters) {
            links.push({
              fromLineId: a.id,
              fromStationId: sa.id,
              toLineId: b.id,
              toStationId: sb.id,
              distanceMeters,
              quality: interchangeQuality(distanceMeters),
            })
          }
        }
      }
    }
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
}

function interpolate(a: GameStation, b: GameStation, t: number) {
  return {
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    latitude: a.latitude + (b.latitude - a.latitude) * t,
  }
}


function interpolateAlongSegment(line: GameLine, a: GameStation, b: GameStation, t: number) {
  const coordinates = getSegmentCoordinates(line, a, b)
  if (!coordinates || coordinates.length < 2) return interpolate(a, b, t)
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
  if (total <= 1) return interpolate(a, b, t)
  let remaining = Math.max(0, Math.min(1, t)) * total
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!
    if (remaining <= length || index === lengths.length - 1) {
      const from = coordinates[index]!
      const to = coordinates[index + 1]!
      const local = length > 0 ? remaining / length : 0
      return { longitude: from[0] + (to[0] - from[0]) * local, latitude: from[1] + (to[1] - from[1]) * local }
    }
    remaining -= length
  }
  return interpolate(a, b, t)
}

function calculateRollingRuntimeTravelMinutes(line: GameLine, route: GameStation[]) {
  let lengthKm = 0
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1]!
    const b = route[index]!
    const coordinates = getSegmentCoordinates(line, a, b)
    if (coordinates) {
      for (let pointIndex = 1; pointIndex < coordinates.length; pointIndex += 1) {
        const from = coordinates[pointIndex - 1]!
        const to = coordinates[pointIndex]!
        lengthKm += stationDistanceMeters(
          { id: '', name: '', longitude: from[0], latitude: from[1] },
          { id: '', name: '', longitude: to[0], latitude: to[1] },
        ) / 1000
      }
    }
    else lengthKm += stationDistanceMeters(a, b) / 1000
  }
  const speed = Math.max(1, effectiveAverageSpeedKmH(line))
  const dwell = Math.max(0, route.length - 2) * 0.45 * rollingStockPerformance(line).dwellTimeMultiplier
  return lengthKm / speed * 60 + dwell
}

export function buildVisualVehicles(lines: GameLine[], nowMs: number, lineReports: Record<string, any> = {}): GameVisualVehicle[] {
  const result: GameVisualVehicle[] = []
  for (const line of lines) {
    const routes = getLineServiceRoutes(line).filter(route => route.length >= 2)
    if (line.status !== 'OPERATIONAL' || routes.length === 0) continue
    const report = lineReports[line.id]
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
    const departures = Math.max(0.2, Math.min(
      calculateFleetSupportedDeparturesPerHour(line, availableVehicles),
      Math.max(baseDepartures, boostedDepartures),
    ))
    const count = Math.max(routes.length, Math.min(12, Math.round(departures / 2.6)))
    const baseCapacity = Math.max(1, Number(report?.effectiveVehicleCapacity ?? effectiveVehicleCapacity(line)))
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
      const calculatedTravel = calculateRollingRuntimeTravelMinutes(line, route)
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
        delayMinutes: Math.max(0, Number(report?.estimatedDelayMinutes ?? 0)),
        generation: String(report?.rollingStockGeneration ?? performance.generation),
        regularityScore: Math.max(0, Math.min(100, Number(report?.regularityScore ?? 85))),
        routeStationIds: route.map(station => station.id),
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

  if (vehicle.direction === 1) {
    if (stationIndex >= vehicle.routePosition) routeDistance = stationIndex - vehicle.routePosition
    else routeDistance = (segmentCount - vehicle.routePosition) + (segmentCount - stationIndex)
  }
  else {
    if (stationIndex <= vehicle.routePosition) routeDistance = vehicle.routePosition - stationIndex
    else routeDistance = vehicle.routePosition + stationIndex
  }

  const etaMinutes = Math.max(0, routeDistance * perSegment + vehicle.delayMinutes)
  const directionName = vehicle.direction === 1 ? route[route.length - 1]!.name : route[0]!.name

  return {
    vehicleId: vehicle.id,
    lineId: line.id,
    lineName: line.name,
    shortCode: line.shortCode,
    color: line.color,
    stationId,
    stationName: route[stationIndex]!.name,
    direction: vehicle.direction,
    directionName,
    etaMinutes: Math.round(etaMinutes * 10) / 10,
  }
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
    .map(vehicle => estimateVehicleArrivalAtStation(line, vehicle, stationId))
    .filter((item): item is GameStationPassage => Boolean(item))
    .sort((a, b) => a.etaMinutes - b.etaMinutes)
    .slice(0, Math.max(1, limit))
}
