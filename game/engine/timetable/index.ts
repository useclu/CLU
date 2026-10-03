import { gameDayWeekdayIndex } from '../../config/calendar'
import { getRollingStockDefinition } from '../../config/rollingStock'
import type {
  GameLine,
  GameLineMission,
  GameLineSchedule,
  GameMissionDepartures,
  GameServiceDayType,
  GameStation,
} from '../../types/network'
import { effectiveAverageSpeedKmH, rollingStockPerformance } from '../rollingStock'
import { findLineStation, getLineAllStations, getLineServiceRoutes, getLineTerminusStations } from '../network/geometry'
import { getSegmentCoordinates } from '../network/pathGeometry'

const EARTH_RADIUS_M = 6_371_000
const MAX_MISSIONS = 96
const MAX_DEPARTURES_PER_DAY = 1_500

export interface GameMissionRouteOption {
  id: string
  stationIds: string[]
  originName: string
  destinationName: string
  label: string
}

export interface GameTimetableStats {
  dayType: GameServiceDayType
  totalDepartures: number
  activeMissionCount: number
  serviceSpanMinutes: number
  equivalentDeparturesPerHour: number
  averageHeadwayMinutes: number
  requiredVehicleCount: number
  firstDepartureMinute: number | null
  lastDepartureMinute: number | null
  peakTripsPerHour: number
}

export interface GameTimetableStationPassage {
  missionId: string
  missionCode: string
  missionName: string
  stationId: string
  directionName: string
  etaMinutes: number
  scheduledMinute: number
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function uniqueStationIds(values: unknown, validIds: Set<string>) {
  const result: string[] = []
  const seen = new Set<string>()
  if (!Array.isArray(values)) return result
  for (const raw of values) {
    const value = typeof raw === 'string' ? raw : ''
    if (!value || !validIds.has(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

export function normalizeMinute(value: unknown) {
  const minute = Number(value)
  if (!Number.isFinite(minute)) return null
  return Math.min(1439, Math.max(0, Math.round(minute)))
}

export function normalizeMinuteList(values: unknown) {
  const result: number[] = []
  if (Array.isArray(values)) {
    for (const value of values) {
      const minute = normalizeMinute(value)
      if (minute !== null) result.push(minute)
    }
  }
  return [...new Set(result)].sort((a, b) => a - b).slice(0, MAX_DEPARTURES_PER_DAY)
}

export function emptyMissionDepartures(): GameMissionDepartures {
  return { weekday: [], saturday: [], sunday: [] }
}

export function normalizeMissionDepartures(value: Partial<GameMissionDepartures> | null | undefined): GameMissionDepartures {
  return {
    weekday: normalizeMinuteList(value?.weekday),
    saturday: normalizeMinuteList(value?.saturday),
    sunday: normalizeMinuteList(value?.sunday),
  }
}

export function normalizeLineSchedule(line: Pick<GameLine, 'stations' | 'branches'> & { schedule?: Partial<GameLineSchedule> | null }): GameLineSchedule {
  const validIds = new Set<string>()
  for (const route of getLineServiceRoutes(line as GameLine)) for (const station of route) validIds.add(station.id)
  const rawMissions = Array.isArray(line.schedule?.missions) ? line.schedule!.missions : []
  const missions: GameLineMission[] = []

  for (const raw of rawMissions.slice(0, MAX_MISSIONS)) {
    if (!raw || typeof raw !== 'object') continue
    const mission = raw as Partial<GameLineMission>
    const routeStationIds = uniqueStationIds(mission.routeStationIds, validIds)
    if (routeStationIds.length < 2) continue
    const routeIds = new Set(routeStationIds)
    const stopStationIds = uniqueStationIds(mission.stopStationIds, routeIds)
    const origin = routeStationIds[0]!
    const destination = routeStationIds[routeStationIds.length - 1]!
    if (!stopStationIds.includes(origin)) stopStationIds.unshift(origin)
    if (!stopStationIds.includes(destination)) stopStationIds.push(destination)

    missions.push({
      id: typeof mission.id === 'string' && mission.id ? mission.id.slice(0, 120) : createId('mission'),
      code: typeof mission.code === 'string' && mission.code.trim() ? mission.code.trim().slice(0, 8).toUpperCase() : `M${String(missions.length + 1).padStart(2, '0')}`,
      name: typeof mission.name === 'string' && mission.name.trim() ? mission.name.trim().slice(0, 80) : `Mission ${missions.length + 1}`,
      enabled: mission.enabled !== false,
      routeStationIds,
      stopStationIds,
      dwellMinutes: Number.isFinite(Number(mission.dwellMinutes)) ? Math.min(5, Math.max(0, Number(mission.dwellMinutes))) : 0.6,
      departures: normalizeMissionDepartures(mission.departures),
    })
  }

  return {
    mode: line.schedule?.mode === 'TIMETABLE' ? 'TIMETABLE' : 'FREQUENCY',
    missions,
  }
}

export function scheduleDayType(day: number, calendarStartDate: string): GameServiceDayType {
  const weekday = gameDayWeekdayIndex(day, calendarStartDate)
  if (weekday === 0) return 'SUNDAY'
  if (weekday === 6) return 'SATURDAY'
  return 'WEEKDAY'
}

export function departureKey(dayType: GameServiceDayType): keyof GameMissionDepartures {
  if (dayType === 'SATURDAY') return 'saturday'
  if (dayType === 'SUNDAY') return 'sunday'
  return 'weekday'
}

export function departuresForMission(mission: GameLineMission, dayType: GameServiceDayType) {
  return mission.departures[departureKey(dayType)] ?? []
}

export function gameTimeLabel(minute: number) {
  const normalized = ((Math.round(minute) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseGameTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function getMissionRouteOptions(line: GameLine): GameMissionRouteOption[] {
  /**
   * Les anciens service routes partent tous du premier terminus du tronc.
   * Pour un vrai horaire (RER à plusieurs branches notamment), on doit pouvoir
   * créer une mission entre n'importe quels deux terminus reliés physiquement.
   */
  const allStations = getLineAllStations(line)
  const stationById = new Map(allStations.map(station => [station.id, station] as const))
  const adjacency = new Map<string, Set<string>>()
  const connect = (a?: string, b?: string) => {
    if (!a || !b || a === b || !stationById.has(a) || !stationById.has(b)) return
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a)!.add(b)
    adjacency.get(b)!.add(a)
  }

  for (let index = 1; index < line.stations.length; index += 1) {
    connect(line.stations[index - 1]!.id, line.stations[index]!.id)
  }
  for (const branch of line.branches ?? []) {
    if (branch.stations.length) connect(branch.fromStationId, branch.stations[0]!.id)
    for (let index = 1; index < branch.stations.length; index += 1) {
      connect(branch.stations[index - 1]!.id, branch.stations[index]!.id)
    }
  }

  function shortestPath(fromId: string, toId: string) {
    if (fromId === toId) return [fromId]
    const queue = [fromId]
    const previous = new Map<string, string | null>([[fromId, null]])
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]!
      for (const next of adjacency.get(current) ?? []) {
        if (previous.has(next)) continue
        previous.set(next, current)
        if (next === toId) {
          const result: string[] = []
          let node: string | null = toId
          while (node) {
            result.push(node)
            node = previous.get(node) ?? null
          }
          return result.reverse()
        }
        queue.push(next)
      }
    }
    return []
  }

  const termini = getLineTerminusStations(line)
  const options: GameMissionRouteOption[] = []
  const seen = new Set<string>()
  for (let aIndex = 0; aIndex < termini.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < termini.length; bIndex += 1) {
      const a = termini[aIndex]!
      const b = termini[bIndex]!
      const forward = shortestPath(a.id, b.id)
      if (forward.length < 2) continue
      for (const stationIds of [forward, [...forward].reverse()]) {
        const key = stationIds.join('>')
        if (seen.has(key)) continue
        seen.add(key)
        const originName = stationById.get(stationIds[0]!)?.name ?? a.name
        const destinationName = stationById.get(stationIds[stationIds.length - 1]!)?.name ?? b.name
        options.push({
          id: key,
          stationIds,
          originName,
          destinationName,
          label: `${originName} → ${destinationName}`,
        })
      }
    }
  }

  // Filet de sécurité pour les anciennes lignes atypiques qui n'exposeraient
  // pas correctement leurs terminus : on garde les service routes historiques.
  if (!options.length) {
    for (const route of getLineServiceRoutes(line)) {
      if (route.length < 2) continue
      for (const stations of [route, [...route].reverse()]) {
        const stationIds = stations.map(station => station.id)
        const key = stationIds.join('>')
        if (seen.has(key)) continue
        seen.add(key)
        options.push({
          id: key,
          stationIds,
          originName: stations[0]!.name,
          destinationName: stations[stations.length - 1]!.name,
          label: `${stations[0]!.name} → ${stations[stations.length - 1]!.name}`,
        })
      }
    }
  }
  return options
}

export function createGameMission(line: GameLine, routeStationIds?: string[]): GameLineMission | null {
  const options = getMissionRouteOptions(line)
  const selected = routeStationIds?.length
    ? options.find(option => option.stationIds.join('>') === routeStationIds.join('>'))
    : options[0]
  if (!selected) return null
  const serial = (line.schedule?.missions?.length ?? 0) + 1
  return {
    id: createId('mission'),
    code: `M${String(serial).padStart(2, '0')}`,
    name: selected.label,
    enabled: true,
    routeStationIds: [...selected.stationIds],
    stopStationIds: [...selected.stationIds],
    dwellMinutes: 0.6,
    departures: emptyMissionDepartures(),
  }
}

function haversineMeters(a: [number, number], b: [number, number]) {
  const toRad = (value: number) => value * Math.PI / 180
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const dLat = lat2 - lat1
  const dLon = toRad(b[0] - a[0])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)))
}

function segmentDistanceKm(line: GameLine, a: GameStation, b: GameStation) {
  const coordinates = getSegmentCoordinates(line, a, b) ?? [[a.longitude, a.latitude], [b.longitude, b.latitude]]
  let meters = 0
  for (let index = 1; index < coordinates.length; index += 1) meters += haversineMeters(coordinates[index - 1]!, coordinates[index]!)
  return meters / 1000
}

export function missionStations(line: GameLine, mission: GameLineMission) {
  return mission.routeStationIds
    .map(id => findLineStation(line, id))
    .filter((station): station is GameStation => Boolean(station))
}

export function missionStationOffsets(line: GameLine, mission: GameLineMission) {
  const route = missionStations(line, mission)
  const result = new Map<string, number>()
  if (route.length < 2) return result
  const speed = Math.max(1, effectiveAverageSpeedKmH(line))
  const dwellMultiplier = rollingStockPerformance(line).dwellTimeMultiplier
  const stops = new Set(mission.stopStationIds)
  let offset = 0
  result.set(route[0]!.id, 0)
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!
    const station = route[index]!
    offset += segmentDistanceKm(line, previous, station) / speed * 60
    result.set(station.id, offset)
    if (index < route.length - 1 && stops.has(station.id)) offset += Math.max(0, mission.dwellMinutes) * dwellMultiplier
  }
  return result
}

export function missionDurationMinutes(line: GameLine, mission: GameLineMission) {
  const route = missionStations(line, mission)
  if (route.length < 2) return 0
  const offsets = missionStationOffsets(line, mission)
  return Math.max(1, offsets.get(route[route.length - 1]!.id) ?? 0)
}

function peakConcurrentTrips(line: GameLine, trips: Array<{ mission: GameLineMission; departure: number }>) {
  const turnaround = getRollingStockDefinition(line.mode).turnaroundMinutes
  const events: Array<{ minute: number; delta: number }> = []
  for (const trip of trips) {
    const duration = missionDurationMinutes(line, trip.mission)
    events.push({ minute: trip.departure, delta: 1 })
    events.push({ minute: trip.departure + duration + turnaround, delta: -1 })
  }
  events.sort((a, b) => a.minute - b.minute || a.delta - b.delta)
  let active = 0
  let peak = 0
  for (const event of events) {
    active += event.delta
    peak = Math.max(peak, active)
  }
  return peak
}

function peakTripsInHour(departures: number[]) {
  if (!departures.length) return 0
  let start = 0
  let peak = 0
  for (let end = 0; end < departures.length; end += 1) {
    while (departures[end]! - departures[start]! >= 60) start += 1
    peak = Math.max(peak, end - start + 1)
  }
  return peak
}

export function calculateTimetableStats(line: GameLine, day: number, calendarStartDate: string): GameTimetableStats | null {
  if (line.schedule?.mode !== 'TIMETABLE') return null
  const dayType = scheduleDayType(day, calendarStartDate)
  const trips: Array<{ mission: GameLineMission; departure: number }> = []
  for (const mission of line.schedule.missions ?? []) {
    if (!mission.enabled || mission.routeStationIds.length < 2) continue
    for (const departure of departuresForMission(mission, dayType)) trips.push({ mission, departure })
  }
  trips.sort((a, b) => a.departure - b.departure)
  const totalDepartures = trips.length
  const firstDepartureMinute = trips[0]?.departure ?? null
  const lastDepartureMinute = trips[trips.length - 1]?.departure ?? null
  const latestEnd = trips.reduce((max, trip) => Math.max(max, trip.departure + missionDurationMinutes(line, trip.mission)), lastDepartureMinute ?? 0)
  const serviceSpanMinutes = firstDepartureMinute === null ? 0 : Math.max(60, latestEnd - firstDepartureMinute)
  const serviceHours = Math.max(1, serviceSpanMinutes / 60)
  // Le moteur historique exprime la fréquence par sens et multiplie ensuite la capacité par 2.
  // Une grille manuelle contient déjà chaque course : on la convertit donc en fréquence équivalente par sens.
  const equivalentDeparturesPerHour = totalDepartures > 0 ? totalDepartures / serviceHours / 2 : 0
  const allDepartures = trips.map(trip => trip.departure)
  const activeMissionCount = new Set(trips.map(trip => trip.mission.id)).size
  return {
    dayType,
    totalDepartures,
    activeMissionCount,
    serviceSpanMinutes,
    equivalentDeparturesPerHour,
    averageHeadwayMinutes: equivalentDeparturesPerHour > 0 ? 60 / equivalentDeparturesPerHour : 0,
    requiredVehicleCount: totalDepartures > 0 ? Math.max(1, peakConcurrentTrips(line, trips)) : 0,
    firstDepartureMinute,
    lastDepartureMinute,
    peakTripsPerHour: peakTripsInHour(allDepartures),
  }
}

export function generateDepartureSeries(startMinute: number, endMinute: number, intervalMinutes: number) {
  const start = normalizeMinute(startMinute)
  const end = normalizeMinute(endMinute)
  const interval = Math.max(1, Math.min(240, Math.round(intervalMinutes)))
  if (start === null || end === null) return []
  const result: number[] = []
  if (end >= start) {
    for (let minute = start; minute <= end && result.length < MAX_DEPARTURES_PER_DAY; minute += interval) result.push(minute)
  }
  else {
    for (let minute = start; minute <= 1439 && result.length < MAX_DEPARTURES_PER_DAY; minute += interval) result.push(minute)
    for (let minute = 0; minute <= end && result.length < MAX_DEPARTURES_PER_DAY; minute += interval) result.push(minute)
  }
  return normalizeMinuteList(result)
}

export function buildTimetableStationPassages(
  line: GameLine,
  stationId: string,
  day: number,
  calendarStartDate: string,
  currentMinute: number,
  limit = 3,
  delayMinutes = 0,
): GameTimetableStationPassage[] {
  if (line.schedule?.mode !== 'TIMETABLE') return []
  const result: GameTimetableStationPassage[] = []
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    const dayType = scheduleDayType(day + dayOffset, calendarStartDate)
    for (const mission of line.schedule.missions ?? []) {
      if (!mission.enabled || !mission.stopStationIds.includes(stationId)) continue
      const route = missionStations(line, mission)
      const stationIndex = route.findIndex(station => station.id === stationId)
      if (stationIndex < 0) continue
      const offsets = missionStationOffsets(line, mission)
      const offset = offsets.get(stationId)
      if (offset === undefined) continue
      const directionName = route[route.length - 1]?.name ?? mission.name
      for (const departure of departuresForMission(mission, dayType)) {
        const scheduledMinute = dayOffset * 1440 + departure + offset
        const etaMinutes = scheduledMinute + Math.max(0, delayMinutes) - currentMinute
        if (etaMinutes < -0.5) continue
        result.push({
          missionId: mission.id,
          missionCode: mission.code,
          missionName: mission.name,
          stationId,
          directionName,
          etaMinutes,
          scheduledMinute,
        })
      }
    }
  }
  return result.sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, Math.max(1, limit))
}
