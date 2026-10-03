import type { GameLine, GameLineMission, GameNetworkState, GameStation, GameStationFacilityLevel } from '../../types/network'
import type {
  GameDisruptionScope,
  GameDisruptionSeverity,
  GameDisruptionType,
  GameBusSubstitutionService,
  GameExtraTrip,
  GameManualDisruption,
  GameOperationalRun,
  GameOperationsDayImpact,
  GameOperationsHistoryEntry,
  GameOperationsState,
  GamePccControlLevel,
  GameStationUpgradeWork,
  GameTripOverride,
} from '../../types/operations'
import {
  departuresForMission,
  missionDurationMinutes,
  missionStationOffsets,
  scheduleDayType,
} from '../timetable'
import { getLineAllStations, getLineServiceRoutes } from '../network/geometry'

export const GAME_OPERATIONS_HISTORY_LIMIT = 240
const MAX_DISRUPTIONS = 160
const MAX_TRIP_OVERRIDES = 2_500
const MAX_EXTRA_TRIPS = 1_500
const MAX_STATION_WORKS = 320
const MAX_SUBSTITUTION_SERVICES = 240

export const GAME_DISRUPTION_PRESETS: Record<GameDisruptionSeverity, {
  delayMinutes: number
  cancellationRate: number
  capacityMultiplier: number
}> = {
  MINOR: { delayMinutes: 4, cancellationRate: 0, capacityMultiplier: 0.95 },
  MODERATE: { delayMinutes: 10, cancellationRate: 0.12, capacityMultiplier: 0.88 },
  MAJOR: { delayMinutes: 20, cancellationRate: 0.35, capacityMultiplier: 0.72 },
  CRITICAL: { delayMinutes: 35, cancellationRate: 0.65, capacityMultiplier: 0.50 },
}

const DISRUPTION_TYPES = new Set<GameDisruptionType>([
  'TECHNICAL', 'PASSENGER', 'SECURITY', 'STAFF', 'WEATHER', 'WORKS', 'CUSTOM',
])
const DISRUPTION_SEVERITIES = new Set<GameDisruptionSeverity>(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'])
const DISRUPTION_SCOPES = new Set<GameDisruptionScope>(['LINE', 'STATIONS', 'SEGMENT'])
const PCC_CONTROL_LEVELS = new Set<GamePccControlLevel>(['AUTO', 'SIMPLE', 'ADVANCED'])

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function normalizeIdList(values: unknown) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value)).slice(0, 120))]
}

export function absoluteGameMinute(day: number, minute: number) {
  return (Math.max(1, Math.floor(day)) - 1) * 1440 + Math.max(0, Math.round(minute))
}

export function gameDayAndMinuteFromAbsolute(absoluteMinute: number) {
  const normalized = Math.max(0, Math.floor(absoluteMinute))
  return {
    day: Math.floor(normalized / 1440) + 1,
    minute: normalized % 1440,
  }
}

export function createEmptyOperationsState(): GameOperationsState {
  return {
    disruptions: [],
    tripOverrides: [],
    extraTrips: [],
    substitutionServices: [],
    pccControlLevels: {},
    autoHandledDisruptionIds: [],
    stationWorks: [],
    history: [],
  }
}

function normalizeDisruption(raw: Partial<GameManualDisruption>, validLineIds?: Set<string>): GameManualDisruption | null {
  if (typeof raw.lineId !== 'string' || !raw.lineId || (validLineIds && !validLineIds.has(raw.lineId))) return null
  const starts = Math.max(0, Math.floor(Number(raw.startsAtAbsoluteMinute) || 0))
  const ends = Math.max(starts + 1, Math.floor(Number(raw.endsAtAbsoluteMinute) || starts + 60))
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 160) : createId('disruption'),
    lineId: raw.lineId,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 100) : 'Perturbation',
    passengerMessage: typeof raw.passengerMessage === 'string' ? raw.passengerMessage.trim().slice(0, 600) : '',
    type: DISRUPTION_TYPES.has(raw.type as GameDisruptionType) ? raw.type as GameDisruptionType : 'CUSTOM',
    severity: DISRUPTION_SEVERITIES.has(raw.severity as GameDisruptionSeverity) ? raw.severity as GameDisruptionSeverity : 'MODERATE',
    scope: DISRUPTION_SCOPES.has(raw.scope as GameDisruptionScope) ? raw.scope as GameDisruptionScope : 'LINE',
    stationIds: normalizeIdList(raw.stationIds),
    segmentFromStationId: typeof raw.segmentFromStationId === 'string' && raw.segmentFromStationId ? raw.segmentFromStationId : null,
    segmentToStationId: typeof raw.segmentToStationId === 'string' && raw.segmentToStationId ? raw.segmentToStationId : null,
    startsAtAbsoluteMinute: starts,
    endsAtAbsoluteMinute: ends,
    delayMinutes: clamp(raw.delayMinutes, 0, 180, 0),
    cancellationRate: clamp(raw.cancellationRate, 0, 1, 0),
    capacityMultiplier: clamp(raw.capacityMultiplier, 0, 1, 1),
    suspended: raw.suspended === true,
    source: raw.source === 'NATURAL' || raw.source === 'WORKS' ? raw.source : 'MANUAL',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    resolvedAt: typeof raw.resolvedAt === 'string' ? raw.resolvedAt : null,
  }
}

function normalizeTripOverride(raw: Partial<GameTripOverride>, validLineIds?: Set<string>): GameTripOverride | null {
  if (typeof raw.lineId !== 'string' || !raw.lineId || (validLineIds && !validLineIds.has(raw.lineId))) return null
  if (typeof raw.missionId !== 'string' || !raw.missionId) return null
  const day = Math.max(1, Math.floor(Number(raw.day) || 1))
  const scheduledDepartureMinute = Math.min(1439, Math.max(0, Math.round(Number(raw.scheduledDepartureMinute) || 0)))
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 180) : createId('trip-override'),
    lineId: raw.lineId,
    day,
    missionId: raw.missionId,
    scheduledDepartureMinute,
    delayMinutes: clamp(raw.delayMinutes, 0, 240, 0),
    cancelled: raw.cancelled === true,
    skippedStationIds: normalizeIdList(raw.skippedStationIds),
    shortTurnStationId: typeof raw.shortTurnStationId === 'string' && raw.shortTurnStationId ? raw.shortTurnStationId : null,
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 240) : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

function normalizeExtraTrip(raw: Partial<GameExtraTrip>, validLineIds?: Set<string>): GameExtraTrip | null {
  if (typeof raw.lineId !== 'string' || !raw.lineId || (validLineIds && !validLineIds.has(raw.lineId))) return null
  if (typeof raw.missionId !== 'string' || !raw.missionId) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 180) : createId('extra-trip'),
    lineId: raw.lineId,
    day: Math.max(1, Math.floor(Number(raw.day) || 1)),
    missionId: raw.missionId,
    departureMinute: Math.min(1439, Math.max(0, Math.round(Number(raw.departureMinute) || 0))),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  }
}

function normalizeSubstitutionService(raw: Partial<GameBusSubstitutionService>, validLineIds?: Set<string>): GameBusSubstitutionService | null {
  if (typeof raw.lineId !== 'string' || !raw.lineId || (validLineIds && !validLineIds.has(raw.lineId))) return null
  if (typeof raw.disruptionId !== 'string' || !raw.disruptionId) return null
  const stationIds = normalizeIdList(raw.stationIds)
  if (stationIds.length < 2) return null
  const starts = Math.max(0, Math.floor(Number(raw.startsAtAbsoluteMinute) || 0))
  const ends = Math.max(starts + 1, Math.floor(Number(raw.endsAtAbsoluteMinute) || starts + 60))
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 180) : createId('substitution'),
    disruptionId: raw.disruptionId,
    lineId: raw.lineId,
    fromStationId: typeof raw.fromStationId === 'string' && raw.fromStationId ? raw.fromStationId : stationIds[0]!,
    toStationId: typeof raw.toStationId === 'string' && raw.toStationId ? raw.toStationId : stationIds[stationIds.length - 1]!,
    stationIds,
    startsAtAbsoluteMinute: starts,
    endsAtAbsoluteMinute: ends,
    headwayMinutes: clamp(raw.headwayMinutes, 3, 60, 10),
    busCapacity: Math.max(20, Math.round(clamp(raw.busCapacity, 20, 220, 90))),
    buses: Math.max(1, Math.round(clamp(raw.buses, 1, 120, 4))),
    dailyCapacity: Math.max(1, Math.round(Number(raw.dailyCapacity) || 1_500)),
    cost: Math.max(0, Math.round(Number(raw.cost) || 0)),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    endedAt: typeof raw.endedAt === 'string' ? raw.endedAt : null,
  }
}

function normalizeStationWork(raw: Partial<GameStationUpgradeWork>, validLineIds?: Set<string>): GameStationUpgradeWork | null {
  if (typeof raw.lineId !== 'string' || !raw.lineId || (validLineIds && !validLineIds.has(raw.lineId))) return null
  if (typeof raw.stationId !== 'string' || !raw.stationId) return null
  const startDay = Math.max(1, Math.floor(Number(raw.startDay) || 1))
  const endDay = Math.max(startDay + 1, Math.floor(Number(raw.endDay) || startDay + 3))
  const target = raw.targetFacilityLevel === 'BASIC' || raw.targetFacilityLevel === 'STANDARD' || raw.targetFacilityLevel === 'HUB'
    ? raw.targetFacilityLevel as GameStationFacilityLevel
    : 'STANDARD'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 180) : createId('station-work'),
    lineId: raw.lineId,
    stationId: raw.stationId,
    stationName: typeof raw.stationName === 'string' && raw.stationName.trim() ? raw.stationName.trim().slice(0, 100) : 'Station',
    targetFacilityLevel: target,
    startDay,
    endDay,
    cost: Math.max(0, Math.round(Number(raw.cost) || 0)),
    disruptionId: typeof raw.disruptionId === 'string' ? raw.disruptionId : '',
    status: raw.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
  }
}

function normalizeHistory(raw: Partial<GameOperationsHistoryEntry>, validLineIds?: Set<string>): GameOperationsHistoryEntry | null {
  if (raw.lineId && validLineIds && !validLineIds.has(raw.lineId)) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 180) : createId('operation-log'),
    kind: (typeof raw.kind === 'string' ? raw.kind : 'DISRUPTION_UPDATED') as GameOperationsHistoryEntry['kind'],
    day: Math.max(1, Math.floor(Number(raw.day) || 1)),
    minute: Math.min(1439, Math.max(0, Math.round(Number(raw.minute) || 0))),
    lineId: typeof raw.lineId === 'string' && raw.lineId ? raw.lineId : null,
    title: typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : '',
    detail: typeof raw.detail === 'string' ? raw.detail.trim().slice(0, 500) : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  }
}

export function normalizeOperationsState(value: Partial<GameOperationsState> | null | undefined, validLineIds?: Set<string>): GameOperationsState {
  const disruptions = (Array.isArray(value?.disruptions) ? value!.disruptions : [])
    .map(item => normalizeDisruption(item, validLineIds))
    .filter((item): item is GameManualDisruption => Boolean(item))
    .slice(-MAX_DISRUPTIONS)
  const tripOverrides = (Array.isArray(value?.tripOverrides) ? value!.tripOverrides : [])
    .map(item => normalizeTripOverride(item, validLineIds))
    .filter((item): item is GameTripOverride => Boolean(item))
    .slice(-MAX_TRIP_OVERRIDES)
  const extraTrips = (Array.isArray(value?.extraTrips) ? value!.extraTrips : [])
    .map(item => normalizeExtraTrip(item, validLineIds))
    .filter((item): item is GameExtraTrip => Boolean(item))
    .slice(-MAX_EXTRA_TRIPS)
  const substitutionServices = (Array.isArray(value?.substitutionServices) ? value!.substitutionServices : [])
    .map(item => normalizeSubstitutionService(item, validLineIds))
    .filter((item): item is GameBusSubstitutionService => Boolean(item))
    .slice(-MAX_SUBSTITUTION_SERVICES)
  const pccControlLevels = Object.fromEntries(
    Object.entries(value?.pccControlLevels ?? {})
      .filter(([lineId, level]) => (!validLineIds || validLineIds.has(lineId)) && PCC_CONTROL_LEVELS.has(level as GamePccControlLevel))
      .map(([lineId, level]) => [lineId, level as GamePccControlLevel]),
  )
  const autoHandledDisruptionIds = normalizeIdList(value?.autoHandledDisruptionIds).slice(-MAX_DISRUPTIONS)
  const stationWorks = (Array.isArray(value?.stationWorks) ? value!.stationWorks : [])
    .map(item => normalizeStationWork(item, validLineIds))
    .filter((item): item is GameStationUpgradeWork => Boolean(item))
    .slice(-MAX_STATION_WORKS)
  const history = (Array.isArray(value?.history) ? value!.history : [])
    .map(item => normalizeHistory(item, validLineIds))
    .filter((item): item is GameOperationsHistoryEntry => Boolean(item))
    .slice(-GAME_OPERATIONS_HISTORY_LIMIT)
  return { disruptions, tripOverrides, extraTrips, substitutionServices, pccControlLevels, autoHandledDisruptionIds, stationWorks, history }
}

export function stationUpgradeDurationDays(line: GameLine, target: GameStationFacilityLevel) {
  const structural = ['METRO', 'RER', 'TRAIN', 'CABLE'].includes(line.mode)
  const base = target === 'HUB' ? 7 : 4
  return structural ? base + 2 : base
}

export function createStationUpgradeWork(
  state: GameOperationsState,
  line: GameLine,
  station: GameStation,
  target: GameStationFacilityLevel,
  day: number,
  cost: number,
) {
  const existing = state.stationWorks.find(item => item.status === 'ACTIVE' && item.lineId === line.id && item.stationId === station.id)
  if (existing) return existing
  const duration = stationUpgradeDurationDays(line, target)
  const disruptionId = createId('station-work-disruption')
  const work: GameStationUpgradeWork = {
    id: createId('station-work'),
    lineId: line.id,
    stationId: station.id,
    stationName: station.name,
    targetFacilityLevel: target,
    startDay: Math.max(1, Math.floor(day)),
    endDay: Math.max(2, Math.floor(day) + duration),
    cost: Math.max(0, Math.round(cost)),
    disruptionId,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    completedAt: null,
  }
  state.stationWorks.push(work)
  state.disruptions.push({
    id: disruptionId,
    lineId: line.id,
    title: `Travaux · ${station.name}`,
    passengerMessage: `Travaux d’agrandissement à ${station.name} : capacité réduite et temps de parcours légèrement dégradés.`,
    type: 'WORKS',
    severity: target === 'HUB' ? 'MODERATE' : 'MINOR',
    scope: 'STATIONS',
    stationIds: [station.id],
    segmentFromStationId: null,
    segmentToStationId: null,
    startsAtAbsoluteMinute: absoluteGameMinute(work.startDay, 0),
    endsAtAbsoluteMinute: absoluteGameMinute(work.endDay, 0),
    delayMinutes: target === 'HUB' ? 4 : 2,
    cancellationRate: 0,
    capacityMultiplier: target === 'HUB' ? 0.78 : 0.88,
    suspended: false,
    source: 'WORKS',
    createdAt: work.createdAt,
    resolvedAt: null,
  })
  state.history.push({
    id: createId('operation-log'), kind: 'STATION_WORK_STARTED', day: work.startDay, minute: 0, lineId: line.id,
    title: `Travaux station · ${station.name}`, detail: `Agrandissement vers ${target} · fin prévue Jour ${work.endDay}.`, createdAt: work.createdAt,
  })
  if (state.history.length > GAME_OPERATIONS_HISTORY_LIMIT) state.history.splice(0, state.history.length - GAME_OPERATIONS_HISTORY_LIMIT)
  return work
}

export function processStationWorksDay(state: GameOperationsState, network: GameNetworkState, day: number) {
  let completed = 0
  for (const work of state.stationWorks) {
    if (work.status !== 'ACTIVE' || day < work.endDay) continue
    const line = network.lines.find(item => item.id === work.lineId)
    const station = line ? [...line.stations, ...(line.branches ?? []).flatMap(branch => branch.stations)].find(item => item.id === work.stationId) : null
    if (!line || !station) continue
    station.facilityLevel = work.targetFacilityLevel
    line.updatedAt = new Date().toISOString()
    work.status = 'COMPLETED'
    work.completedAt = new Date().toISOString()
    const disruption = state.disruptions.find(item => item.id === work.disruptionId)
    if (disruption && !disruption.resolvedAt) {
      disruption.resolvedAt = work.completedAt
      disruption.endsAtAbsoluteMinute = Math.min(disruption.endsAtAbsoluteMinute, absoluteGameMinute(day, 0))
    }
    state.history.push({
      id: createId('operation-log'), kind: 'STATION_WORK_COMPLETED', day, minute: 0, lineId: line.id,
      title: `Station agrandie · ${station.name}`, detail: `La nouvelle capacité ${work.targetFacilityLevel} est désormais en service.`, createdAt: work.completedAt,
    })
    completed += 1
  }
  if (state.history.length > GAME_OPERATIONS_HISTORY_LIMIT) state.history.splice(0, state.history.length - GAME_OPERATIONS_HISTORY_LIMIT)
  return completed
}

/** Phase 19 — corridor ordonné utilisé pour un bus de substitution. */
export function substitutionCorridorStationIds(line: GameLine, disruption: GameManualDisruption) {
  const routes = getLineServiceRoutes(line)
  if (disruption.scope === 'SEGMENT' && disruption.segmentFromStationId && disruption.segmentToStationId) {
    for (const route of routes) {
      const a = route.findIndex(station => station.id === disruption.segmentFromStationId)
      const b = route.findIndex(station => station.id === disruption.segmentToStationId)
      if (a >= 0 && b >= 0 && a !== b) {
        const slice = route.slice(Math.min(a, b), Math.max(a, b) + 1).map(station => station.id)
        return a <= b ? slice : slice.reverse()
      }
    }
  }
  if (disruption.scope === 'STATIONS' && disruption.stationIds.length >= 2) {
    for (const route of routes) {
      const positions = disruption.stationIds.map(id => route.findIndex(station => station.id === id)).filter(index => index >= 0)
      if (positions.length >= 2) {
        const min = Math.min(...positions)
        const max = Math.max(...positions)
        return route.slice(min, max + 1).map(station => station.id)
      }
    }
  }
  const longest = [...routes].sort((a, b) => b.length - a.length)[0] ?? getLineAllStations(line)
  return longest.map(station => station.id)
}

export function isSubstitutionActiveAt(service: GameBusSubstitutionService, absoluteMinute: number) {
  if (service.endedAt) return false
  return absoluteMinute >= service.startsAtAbsoluteMinute && absoluteMinute < service.endsAtAbsoluteMinute
}

export function substitutionTouchesDay(service: GameBusSubstitutionService, day: number) {
  if (service.endedAt) return false
  const start = absoluteGameMinute(day, 0)
  const end = start + 1440
  return service.startsAtAbsoluteMinute < end && service.endsAtAbsoluteMinute > start
}

export function activeSubstitutionServicesAt(state: GameOperationsState | null | undefined, absoluteMinute: number) {
  return (state?.substitutionServices ?? []).filter(service => isSubstitutionActiveAt(service, absoluteMinute))
}

/**
 * Phase 19 — incidents vivants mais volontairement rares.
 * Le tirage est déterministe par jour/ligne afin de rester stable à sauvegarde identique.
 */
export function processNaturalOperationsDay(state: GameOperationsState, network: GameNetworkState, day: number) {
  if (day < 5) return [] as GameManualDisruption[]
  const operational = network.lines.filter(line => line.status === 'OPERATIONAL' && getLineAllStations(line).length >= 2)
  if (!operational.length) return [] as GameManualDisruption[]
  const existingNaturalToday = state.disruptions.some(item => item.source === 'NATURAL' && disruptionTouchesDay(item, day))
  if (existingNaturalToday) return [] as GameManualDisruption[]
  // Environ un jour sur quatre au maximum, puis sélection d'une ligne selon sa fiabilité/âge abstraits.
  if (hashUnit(`incident-day|${day}|${operational.length}`) > 0.26) return [] as GameManualDisruption[]
  const ranked = operational.map(line => {
    const condition = Math.max(0, Math.min(100, Number(line.fleetCondition ?? 80)))
    const risk = 0.08 + (100 - condition) / 140 + Math.min(0.12, Math.max(0, line.vehicleCount - 12) / 220)
    return { line, risk, roll: hashUnit(`incident-line|${day}|${line.id}`) }
  }).filter(item => item.roll < item.risk).sort((a, b) => a.roll - b.roll)
  const selected = ranked[0]
  if (!selected) return [] as GameManualDisruption[]
  const line = selected.line
  const allStations = getLineAllStations(line)
  const severityRoll = hashUnit(`incident-severity|${day}|${line.id}`)
  const severity: GameDisruptionSeverity = severityRoll > .96 ? 'CRITICAL' : severityRoll > .78 ? 'MAJOR' : severityRoll > .35 ? 'MODERATE' : 'MINOR'
  const typeRoll = hashUnit(`incident-type|${day}|${line.id}`)
  const type: GameDisruptionType = line.mode === 'FERRY'
    ? (typeRoll > .45 ? 'WEATHER' : 'TECHNICAL')
    : line.mode === 'CABLE'
      ? (typeRoll > .62 ? 'WEATHER' : 'TECHNICAL')
      : typeRoll > .78 ? 'PASSENGER' : typeRoll > .63 ? 'STAFF' : 'TECHNICAL'
  const index = Math.min(allStations.length - 2, Math.floor(hashUnit(`incident-segment|${day}|${line.id}`) * Math.max(1, allStations.length - 1)))
  const from = allStations[index]!
  const to = allStations[index + 1]!
  const preset = GAME_DISRUPTION_PRESETS[severity]
  const startMinute = 390 + Math.floor(hashUnit(`incident-time|${day}|${line.id}`) * 900)
  const duration = severity === 'CRITICAL' ? 300 : severity === 'MAJOR' ? 180 : severity === 'MODERATE' ? 105 : 55
  const suspended = severity === 'CRITICAL' || (severity === 'MAJOR' && hashUnit(`incident-stop|${day}|${line.id}`) > .72)
  const title = type === 'WEATHER' ? `Conditions météo · ${line.name}` : type === 'PASSENGER' ? `Incident voyageur · ${line.name}` : type === 'STAFF' ? `Indisponibilité d’exploitation · ${line.name}` : `Incident technique · ${line.name}`
  const disruption: GameManualDisruption = {
    id: createId('natural-disruption'), lineId: line.id, title,
    passengerMessage: suspended
      ? `Trafic interrompu entre ${from.name} et ${to.name}. Une solution de substitution peut être mise en place depuis le PCC.`
      : `Service perturbé entre ${from.name} et ${to.name}. Prévoyez un temps de parcours supplémentaire.`,
    type, severity, scope: 'SEGMENT', stationIds: [], segmentFromStationId: from.id, segmentToStationId: to.id,
    startsAtAbsoluteMinute: absoluteGameMinute(day, startMinute), endsAtAbsoluteMinute: absoluteGameMinute(day, startMinute + duration),
    delayMinutes: preset.delayMinutes, cancellationRate: suspended ? Math.max(.45, preset.cancellationRate) : preset.cancellationRate,
    capacityMultiplier: suspended ? Math.min(.45, preset.capacityMultiplier) : preset.capacityMultiplier, suspended, source: 'NATURAL',
    createdAt: new Date().toISOString(), resolvedAt: null,
  }
  state.disruptions.push(disruption)
  state.history.push({
    id: createId('operation-log'), kind: 'DISRUPTION_CREATED', day, minute: startMinute, lineId: line.id,
    title: `Incident détecté · ${line.name}`, detail: `${from.name} ↔ ${to.name} · ${severity.toLowerCase()}`, createdAt: disruption.createdAt,
  })
  if (state.disruptions.length > MAX_DISRUPTIONS) state.disruptions.splice(0, state.disruptions.length - MAX_DISRUPTIONS)
  if (state.history.length > GAME_OPERATIONS_HISTORY_LIMIT) state.history.splice(0, state.history.length - GAME_OPERATIONS_HISTORY_LIMIT)
  return [disruption]
}

export function closeExpiredSubstitutions(state: GameOperationsState, absoluteMinute: number) {
  let closed = 0
  for (const service of state.substitutionServices) {
    if (service.endedAt || service.endsAtAbsoluteMinute > absoluteMinute) continue
    service.endedAt = new Date().toISOString()
    closed += 1
  }
  return closed
}

export function isDisruptionActiveAt(disruption: GameManualDisruption, absoluteMinute: number) {
  if (disruption.resolvedAt) return false
  return absoluteMinute >= disruption.startsAtAbsoluteMinute && absoluteMinute < disruption.endsAtAbsoluteMinute
}

export function disruptionTouchesDay(disruption: GameManualDisruption, day: number) {
  const dayStart = absoluteGameMinute(day, 0)
  const dayEnd = dayStart + 1440
  return disruption.startsAtAbsoluteMinute < dayEnd && disruption.endsAtAbsoluteMinute > dayStart
}

function routeHasSegment(routeStationIds: string[], from: string | null, to: string | null) {
  if (!from || !to) return false
  for (let index = 1; index < routeStationIds.length; index += 1) {
    const a = routeStationIds[index - 1]!
    const b = routeStationIds[index]!
    if ((a === from && b === to) || (a === to && b === from)) return true
  }
  return false
}

export function disruptionAppliesToRoute(disruption: GameManualDisruption, routeStationIds: string[]) {
  if (disruption.scope === 'LINE') return true
  if (disruption.scope === 'STATIONS') return disruption.stationIds.some(id => routeStationIds.includes(id))
  return routeHasSegment(routeStationIds, disruption.segmentFromStationId, disruption.segmentToStationId)
}

function hashUnit(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xFFFFFFFF
}

function tripOverrideFor(state: GameOperationsState, lineId: string, day: number, missionId: string, departure: number) {
  return state.tripOverrides.find(item => item.lineId === lineId
    && item.day === day
    && item.missionId === missionId
    && item.scheduledDepartureMinute === departure) ?? null
}

function runDisruptions(state: GameOperationsState, line: GameLine, routeStationIds: string[], day: number, departure: number, duration: number) {
  const start = absoluteGameMinute(day, departure)
  const end = start + Math.max(1, duration)
  return state.disruptions.filter(disruption => disruption.lineId === line.id
    && disruption.startsAtAbsoluteMinute < end
    && disruption.endsAtAbsoluteMinute > start
    && disruptionAppliesToRoute(disruption, routeStationIds))
}

function buildRun(
  state: GameOperationsState,
  line: GameLine,
  mission: GameLineMission,
  day: number,
  departure: number,
  extra: boolean,
  extraId?: string,
): GameOperationalRun {
  const override = tripOverrideFor(state, line.id, day, mission.id, departure)
  let routeStationIds = [...mission.routeStationIds]
  let stopStationIds = [...mission.stopStationIds]
  const skipped = new Set(override?.skippedStationIds ?? [])
  const cancelledByOverride = override?.cancelled === true
  let cancelledByDisruption = false
  let cancelled = cancelledByOverride
  const manualDelay = Math.max(0, Number(override?.delayMinutes ?? 0))
  let disruptionDelay = 0
  let capacityMultiplier = 1
  const affected = runDisruptions(state, line, routeStationIds, day, departure, missionDurationMinutes(line, mission))

  for (const disruption of affected) {
    disruptionDelay += disruption.delayMinutes
    capacityMultiplier *= disruption.capacityMultiplier
    if (disruption.suspended) {
      if (disruption.scope === 'STATIONS') {
        const origin = routeStationIds[0]
        const destination = routeStationIds[routeStationIds.length - 1]
        if (disruption.stationIds.includes(origin!) || disruption.stationIds.includes(destination!)) { cancelled = true; cancelledByDisruption = true }
        else for (const stationId of disruption.stationIds) skipped.add(stationId)
      }
      else {
        cancelled = true
        cancelledByDisruption = true
      }
    }
    else if (disruption.cancellationRate > 0) {
      const roll = hashUnit(`${line.id}|${mission.id}|${day}|${departure}|${disruption.id}`)
      if (roll < disruption.cancellationRate) { cancelled = true; cancelledByDisruption = true }
    }
  }

  const shortTurnStationId = override?.shortTurnStationId && routeStationIds.includes(override.shortTurnStationId)
    ? override.shortTurnStationId
    : null
  if (shortTurnStationId) {
    const index = routeStationIds.indexOf(shortTurnStationId)
    if (index > 0) routeStationIds = routeStationIds.slice(0, index + 1)
  }

  stopStationIds = stopStationIds.filter(id => routeStationIds.includes(id) && !skipped.has(id))
  if (routeStationIds[0] && !stopStationIds.includes(routeStationIds[0])) stopStationIds.unshift(routeStationIds[0])
  const terminus = routeStationIds[routeStationIds.length - 1]
  if (terminus && !stopStationIds.includes(terminus)) stopStationIds.push(terminus)

  const delayMinutes = Math.min(240, manualDelay + disruptionDelay)
  return {
    id: extra ? `extra:${extraId ?? mission.id}:${day}:${departure}` : `base:${mission.id}:${day}:${departure}`,
    lineId: line.id,
    day,
    missionId: mission.id,
    missionCode: mission.code,
    missionName: mission.name,
    scheduledDepartureMinute: departure,
    effectiveDepartureMinute: departure + delayMinutes,
    delayMinutes,
    manualDelayMinutes: manualDelay,
    disruptionDelayMinutes: disruptionDelay,
    cancelled,
    cancelledByOverride,
    cancelledByDisruption,
    extra,
    sourceExtraTripId: extra ? extraId ?? null : null,
    routeStationIds,
    stopStationIds,
    shortTurnStationId,
    skippedStationIds: [...skipped],
    capacityMultiplier: Math.min(1, Math.max(0, capacityMultiplier)),
    affectedDisruptionIds: affected.map(item => item.id),
  }
}

export function buildOperationalRunsForLineDay(
  line: GameLine,
  day: number,
  calendarStartDate: string,
  state: GameOperationsState | null | undefined,
): GameOperationalRun[] {
  if (line.schedule?.mode !== 'TIMETABLE') return []
  const normalizedState = state ?? createEmptyOperationsState()
  const dayType = scheduleDayType(day, calendarStartDate)
  const missions = line.schedule.missions.filter(mission => mission.enabled)
  const missionMap = new Map(missions.map(mission => [mission.id, mission] as const))
  const runs: GameOperationalRun[] = []
  for (const mission of missions) {
    for (const departure of departuresForMission(mission, dayType)) {
      runs.push(buildRun(normalizedState, line, mission, day, departure, false))
    }
  }
  for (const extra of normalizedState.extraTrips) {
    if (extra.lineId !== line.id || extra.day !== day) continue
    const mission = missionMap.get(extra.missionId)
    if (!mission) continue
    runs.push(buildRun(normalizedState, line, mission, day, extra.departureMinute, true, extra.id))
  }
  return runs.sort((a, b) => a.effectiveDepartureMinute - b.effectiveDepartureMinute || a.scheduledDepartureMinute - b.scheduledDepartureMinute)
}

export interface GameOperationalStationPassage {
  runId: string
  missionId: string
  missionCode: string
  missionName: string
  stationId: string
  directionName: string
  etaMinutes: number
  scheduledMinute: number
  effectiveMinute: number
  delayMinutes: number
  extra: boolean
}

export function buildOperationalStationPassages(
  line: GameLine,
  stationId: string,
  day: number,
  calendarStartDate: string,
  currentMinute: number,
  state: GameOperationsState | null | undefined,
  limit = 3,
): GameOperationalStationPassage[] {
  const result: GameOperationalStationPassage[] = []
  for (const dayOffset of [0, 1]) {
    const targetDay = day + dayOffset
    const runs = buildOperationalRunsForLineDay(line, targetDay, calendarStartDate, state)
    for (const run of runs) {
      if (run.cancelled || !run.stopStationIds.includes(stationId) || !run.routeStationIds.includes(stationId)) continue
      // Ici on construit un tableau de départs. Une mission qui se termine à la
      // station sélectionnée est une arrivée et ne doit jamais apparaître comme
      // « direction [station actuelle] ». Le trajet retour, s'il existe, est une
      // autre mission et apparaîtra avec son vrai terminus (ou terminus temporaire).
      if (run.routeStationIds[run.routeStationIds.length - 1] === stationId) continue
      const mission = line.schedule?.missions.find(item => item.id === run.missionId)
      if (!mission) continue
      const offsets = missionStationOffsets(line, mission)
      const offset = offsets.get(stationId)
      if (offset === undefined) continue
      const effectiveMinute = dayOffset * 1440 + run.effectiveDepartureMinute + offset
      const eta = effectiveMinute - currentMinute
      if (eta < -0.25) continue
      const terminusId = run.routeStationIds[run.routeStationIds.length - 1]
      const terminus = line.stations.find(station => station.id === terminusId)
        ?? (line.branches ?? []).flatMap(branch => branch.stations).find(station => station.id === terminusId)
      result.push({
        runId: run.id,
        missionId: run.missionId,
        missionCode: run.missionCode,
        missionName: run.missionName,
        stationId,
        directionName: terminus?.name ?? run.missionName,
        etaMinutes: Math.max(0, eta),
        scheduledMinute: dayOffset * 1440 + run.scheduledDepartureMinute + offset,
        effectiveMinute,
        delayMinutes: run.delayMinutes,
        extra: run.extra,
      })
    }
  }
  return result.sort((a, b) => a.effectiveMinute - b.effectiveMinute).slice(0, Math.max(1, limit))
}

function disruptionOverlapMinutes(disruption: GameManualDisruption, day: number) {
  if (!disruptionTouchesDay(disruption, day)) return 0
  const start = absoluteGameMinute(day, 0)
  const end = start + 1440
  return Math.max(0, Math.min(end, disruption.endsAtAbsoluteMinute) - Math.max(start, disruption.startsAtAbsoluteMinute))
}

export function calculateOperationsDayImpact(
  line: GameLine,
  day: number,
  calendarStartDate: string,
  state: GameOperationsState | null | undefined,
): GameOperationsDayImpact {
  const normalizedState = state ?? createEmptyOperationsState()
  const disruptions = normalizedState.disruptions.filter(item => item.lineId === line.id && disruptionTouchesDay(item, day))
  if (line.schedule?.mode === 'TIMETABLE') {
    const runs = buildOperationalRunsForLineDay(line, day, calendarStartDate, normalizedState)
    const baseTrips = runs.filter(run => !run.extra).length
    const extraTrips = runs.filter(run => run.extra).length
    const cancelledTrips = runs.filter(run => run.cancelled).length
    const effectiveRuns = runs.filter(run => !run.cancelled)
    const effectiveTrips = effectiveRuns.length
    const referenceTrips = Math.max(1, baseTrips)
    const capacityMultiplier = effectiveRuns.length
      ? effectiveRuns.reduce((sum, run) => sum + run.capacityMultiplier, 0) / effectiveRuns.length
      : 0
    const averageDelay = effectiveRuns.length
      ? effectiveRuns.reduce((sum, run) => sum + run.delayMinutes, 0) / effectiveRuns.length
      : 0
    return {
      disruptionCount: disruptions.length,
      baseTrips,
      effectiveTrips,
      cancelledTrips,
      extraTrips,
      serviceMultiplier: Math.min(1.5, effectiveTrips / referenceTrips),
      capacityMultiplier,
      extraDelayMinutes: Math.min(60, averageDelay),
      regularityPenalty: Math.min(48, averageDelay * 0.9 + cancelledTrips / referenceTrips * 36 + disruptions.length * 2),
    }
  }

  let serviceLoss = 0
  let capacityLoss = 0
  let delay = 0
  for (const disruption of disruptions) {
    const overlap = disruptionOverlapMinutes(disruption, day) / 1440
    const suspensionLoss = disruption.suspended && disruption.scope !== 'STATIONS' ? 1 : disruption.cancellationRate
    serviceLoss += overlap * suspensionLoss
    capacityLoss += overlap * (1 - disruption.capacityMultiplier)
    delay += overlap * disruption.delayMinutes
  }
  const serviceMultiplier = Math.max(0, Math.min(1, 1 - serviceLoss))
  const capacityMultiplier = Math.max(0.05, Math.min(1, 1 - capacityLoss))
  return {
    disruptionCount: disruptions.length,
    baseTrips: 0,
    effectiveTrips: 0,
    cancelledTrips: 0,
    extraTrips: 0,
    serviceMultiplier,
    capacityMultiplier,
    extraDelayMinutes: Math.min(60, delay),
    regularityPenalty: Math.min(48, serviceLoss * 55 + delay * 0.8 + disruptions.length * 2),
  }
}

export function currentLineOperationalImpact(line: GameLine, absoluteMinute: number, state: GameOperationsState | null | undefined) {
  const disruptions = (state?.disruptions ?? []).filter(item => item.lineId === line.id && isDisruptionActiveAt(item, absoluteMinute))
  let serviceMultiplier = 1
  let capacityMultiplier = 1
  let delayMinutes = 0
  let suspended = false
  for (const disruption of disruptions) {
    delayMinutes += disruption.delayMinutes
    capacityMultiplier *= disruption.capacityMultiplier
    if (disruption.suspended && disruption.scope !== 'STATIONS') suspended = true
    else serviceMultiplier *= Math.max(0, 1 - disruption.cancellationRate)
  }
  return {
    disruptions,
    serviceMultiplier: suspended ? 0 : Math.max(0, Math.min(1, serviceMultiplier)),
    capacityMultiplier: Math.max(0, Math.min(1, capacityMultiplier)),
    delayMinutes: Math.min(180, delayMinutes),
    suspended,
  }
}
