import { computed, watch } from 'vue'

import type { GameLine } from '../types/network'
import type {
  GameDisruptionScope,
  GameDisruptionSeverity,
  GameDisruptionType,
  GameBusSubstitutionService,
  GameManualDisruption,
  GameOperationsHistoryEntry,
  GamePccControlLevel,
  GameTripOverride,
} from '../types/operations'
import {
  GAME_DISRUPTION_PRESETS,
  GAME_OPERATIONS_HISTORY_LIMIT,
  absoluteGameMinute,
  calculateOperationsDayImpact,
  buildOperationalRunsForLineDay,
  activeSubstitutionServicesAt,
  createEmptyOperationsState,
  isDisruptionActiveAt,
  substitutionCorridorStationIds,
} from '../engine/operations'
import { gameTimeLabel, calculateTimetableStats } from '../engine/timetable'
import { applyBusSubstitutionCost, applyServiceReinforcementCost, calculateBusSubstitutionCost, calculateReinforcementTripCost } from '../engine/economy'
import { calculateRequiredVehiclesForService } from '../engine/rollingStock'
import { useMetropoleGame } from './useMetropoleGame'
import { useGameClock } from './useGameClock'

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export interface CreateManualDisruptionInput {
  lineId: string
  title: string
  passengerMessage?: string
  type: GameDisruptionType
  severity: GameDisruptionSeverity
  scope: GameDisruptionScope
  stationIds?: string[]
  segmentFromStationId?: string | null
  segmentToStationId?: string | null
  startMinute: number
  durationMinutes: number
  delayMinutes?: number
  cancellationRate?: number
  capacityMultiplier?: number
  suspended?: boolean
}

function createGameOperations() {
  const game = useMetropoleGame()
  const clock = useGameClock()

  const state = computed(() => game.state.value.save?.data.operations ?? createEmptyOperationsState())
  const day = computed(() => Math.max(1, game.state.value.save?.data.simulationDay ?? 1))
  const currentMinute = computed(() => Math.max(0, Math.min(1439, Math.round(clock.gameMinutes.value))))
  const currentAbsoluteMinute = computed(() => absoluteGameMinute(day.value, currentMinute.value))
  const activeDisruptions = computed(() => state.value.disruptions.filter(item => isDisruptionActiveAt(item, currentAbsoluteMinute.value)))
  const plannedDisruptions = computed(() => state.value.disruptions
    .filter(item => !item.resolvedAt && item.startsAtAbsoluteMinute > currentAbsoluteMinute.value)
    .sort((a, b) => a.startsAtAbsoluteMinute - b.startsAtAbsoluteMinute))
  const activeSubstitutions = computed(() => activeSubstitutionServicesAt(state.value, currentAbsoluteMinute.value))

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  function currentState() {
    const save = game.state.value.save
    if (!save) return null
    if (!save.data.operations) save.data.operations = createEmptyOperationsState()
    return save.data.operations
  }

  function lineName(lineId: string) {
    return game.state.value.save?.data.network.lines.find(line => line.id === lineId)?.name ?? 'Ligne'
  }

  function reinforcementCost(lineId: string) {
    const line = game.state.value.save?.data.network.lines.find(item => item.id === lineId)
    return line ? calculateReinforcementTripCost(line) : 0
  }

  function pccControlLevel(lineId: string): GamePccControlLevel {
    return state.value.pccControlLevels?.[lineId] ?? 'SIMPLE'
  }

  function availableReserveVehicles(line: GameLine) {
    const save = game.state.value.save
    if (!save) return 0
    if (line.schedule?.mode === 'TIMETABLE') {
      const timetable = calculateTimetableStats(line, day.value, save.data.calendarStartDate)
      if (!timetable) return Math.max(0, line.vehicleCount - 1)
      const impact = calculateOperationsDayImpact(line, day.value, save.data.calendarStartDate, save.data.operations)
      const required = Math.max(0, Math.ceil(timetable.requiredVehicleCount * Math.max(1, impact.serviceMultiplier)))
      return Math.max(0, line.vehicleCount - required)
    }
    const target = line.serviceProfileMode === 'ADVANCED' ? line.serviceProfile.peak : line.serviceLevel
    return Math.max(0, line.vehicleCount - calculateRequiredVehiclesForService(line, target))
  }

  async function setPccControlLevel(lineId: string, level: GamePccControlLevel) {
    assertWritable()
    const save = game.state.value.save
    const operations = currentState()
    if (!save || !operations) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    operations.pccControlLevels[lineId] = level
    line.regulationMode = level === 'AUTO' ? 'AUTO' : 'MANUAL'
    if (level === 'AUTO') line.manualBoostVehicles = 0
    addHistory('PCC_CONTROL_LEVEL_CHANGED', lineId, `PCC ${level === 'AUTO' ? 'automatique' : level === 'SIMPLE' ? 'simple' : 'avancé'} · ${line.name}`)
    await persist()
    return true
  }

  function substitutionEstimate(disruptionId: string) {
    const save = game.state.value.save
    if (!save) return null
    const disruption = save.data.operations.disruptions.find(item => item.id === disruptionId)
    const line = disruption ? save.data.network.lines.find(item => item.id === disruption.lineId) : null
    if (!disruption || !line) return null
    const stationIds = substitutionCorridorStationIds(line, disruption)
    if (stationIds.length < 2) return null
    const remainingMinutes = Math.max(30, disruption.endsAtAbsoluteMinute - Math.max(currentAbsoluteMinute.value, disruption.startsAtAbsoluteMinute))
    const headwayMinutes = disruption.severity === 'CRITICAL' ? 6 : disruption.severity === 'MAJOR' ? 8 : disruption.severity === 'MODERATE' ? 12 : 15
    const busCapacity = 90
    const buses = Math.max(2, Math.min(36, Math.ceil(stationIds.length * (15 / headwayMinutes) * .9)))
    const dailyCapacity = Math.max(busCapacity, Math.round(busCapacity * Math.max(1, remainingMinutes / headwayMinutes) * .82))
    const cost = calculateBusSubstitutionCost(line, stationIds, remainingMinutes, headwayMinutes)
    return { disruption, line, stationIds, remainingMinutes, headwayMinutes, busCapacity, buses, dailyCapacity, cost }
  }

  async function startBusSubstitution(disruptionId: string) {
    assertWritable()
    const save = game.state.value.save
    const operations = currentState()
    const estimate = substitutionEstimate(disruptionId)
    if (!save || !operations || !estimate) return { ok: false as const, reason: 'INVALID' as const }
    const existing = operations.substitutionServices.find(item => item.disruptionId === disruptionId && !item.endedAt && item.endsAtAbsoluteMinute > currentAbsoluteMinute.value)
    if (existing) return { ok: true as const, service: existing, alreadyActive: true as const }
    const transaction = applyBusSubstitutionCost(save.data.economy, estimate.line, estimate.cost, `Bus de substitution · ${estimate.disruption.title}`)
    if (!transaction) return { ok: false as const, reason: 'BUDGET' as const, cost: estimate.cost }
    const service: GameBusSubstitutionService = {
      id: createId('bus-substitution'), disruptionId, lineId: estimate.line.id,
      fromStationId: estimate.stationIds[0]!, toStationId: estimate.stationIds[estimate.stationIds.length - 1]!, stationIds: estimate.stationIds,
      startsAtAbsoluteMinute: Math.max(currentAbsoluteMinute.value, estimate.disruption.startsAtAbsoluteMinute),
      endsAtAbsoluteMinute: estimate.disruption.endsAtAbsoluteMinute, headwayMinutes: estimate.headwayMinutes, busCapacity: estimate.busCapacity,
      buses: estimate.buses, dailyCapacity: estimate.dailyCapacity, cost: estimate.cost, createdAt: new Date().toISOString(), endedAt: null,
    }
    operations.substitutionServices.push(service)
    if (operations.substitutionServices.length > 240) operations.substitutionServices.splice(0, operations.substitutionServices.length - 240)
    addHistory('SUBSTITUTION_STARTED', estimate.line.id, `Bus de substitution · ${estimate.line.name}`, `${estimate.stationIds.length} arrêts · ${estimate.headwayMinutes} min · ${estimate.cost.toLocaleString('fr-FR')} €`)
    await persist()
    return { ok: true as const, service, alreadyActive: false as const }
  }

  async function stopBusSubstitution(id: string) {
    assertWritable()
    const operations = currentState()
    if (!operations) return false
    const service = operations.substitutionServices.find(item => item.id === id)
    if (!service || service.endedAt) return false
    service.endedAt = new Date().toISOString()
    service.endsAtAbsoluteMinute = Math.min(service.endsAtAbsoluteMinute, currentAbsoluteMinute.value)
    addHistory('SUBSTITUTION_ENDED', service.lineId, `Bus de substitution terminé · ${lineName(service.lineId)}`)
    await persist()
    return true
  }

  async function applyAutomaticResponse(disruptionId: string) {
    const estimate = substitutionEstimate(disruptionId)
    if (!estimate) return { ok: false as const, message: 'Perturbation introuvable.' }
    if (estimate.disruption.suspended || estimate.disruption.severity === 'CRITICAL') {
      const result = await startBusSubstitution(disruptionId)
      if (!result.ok) return { ok: false as const, message: result.reason === 'BUDGET' ? `Budget insuffisant pour la substitution (${result.cost?.toLocaleString('fr-FR')} €).` : 'Substitution impossible.' }
      addHistory('AUTO_RESPONSE_APPLIED', estimate.line.id, `Réponse automatique · ${estimate.line.name}`, 'Bus de substitution activé.')
      return { ok: true as const, message: result.alreadyActive ? 'Le bus de substitution était déjà actif.' : 'Bus de substitution activé automatiquement.' }
    }
    if (estimate.line.schedule?.mode === 'TIMETABLE') {
      const mission = estimate.line.schedule.missions.find(item => item.enabled)
      if (mission && availableReserveVehicles(estimate.line) > 0) {
        const trip = await addExtraTrip(estimate.line.id, mission.id, Math.min(1439, currentMinute.value + 8))
        if (trip) {
          addHistory('AUTO_RESPONSE_APPLIED', estimate.line.id, `Réponse automatique · ${estimate.line.name}`, 'Circulation de renfort injectée.')
          return { ok: true as const, message: 'Une circulation de renfort a été injectée depuis la réserve.' }
        }
      }
    }
    return { ok: true as const, message: 'Surveillance automatique maintenue : aucune action lourde n’est nécessaire pour l’instant.' }
  }

  function addHistory(kind: GameOperationsHistoryEntry['kind'], lineId: string | null, title: string, detail = '') {
    const operations = currentState()
    if (!operations) return
    operations.history.push({
      id: createId('operation-log'),
      kind,
      day: day.value,
      minute: currentMinute.value,
      lineId,
      title: title.slice(0, 120),
      detail: detail.slice(0, 500),
      createdAt: new Date().toISOString(),
    })
    if (operations.history.length > GAME_OPERATIONS_HISTORY_LIMIT) {
      operations.history.splice(0, operations.history.length - GAME_OPERATIONS_HISTORY_LIMIT)
    }
  }

  async function persist() {
    await game.persistCurrentGame()
  }

  async function createDisruption(input: CreateManualDisruptionInput) {
    assertWritable()
    const operations = currentState()
    const save = game.state.value.save
    if (!operations || !save) return null
    const line = save.data.network.lines.find(item => item.id === input.lineId)
    if (!line) return null
    const preset = GAME_DISRUPTION_PRESETS[input.severity]
    const startMinute = Math.max(0, Math.min(1439, Math.round(Number(input.startMinute) || 0)))
    const durationMinutes = Math.max(5, Math.min(7 * 1440, Math.round(Number(input.durationMinutes) || 60)))
    const start = absoluteGameMinute(day.value, startMinute)
    const disruption: GameManualDisruption = {
      id: createId('disruption'),
      lineId: line.id,
      title: input.title.trim().slice(0, 100) || 'Perturbation',
      passengerMessage: input.passengerMessage?.trim().slice(0, 600) ?? '',
      type: input.type,
      severity: input.severity,
      scope: input.scope,
      stationIds: [...new Set(input.stationIds ?? [])],
      segmentFromStationId: input.segmentFromStationId ?? null,
      segmentToStationId: input.segmentToStationId ?? null,
      startsAtAbsoluteMinute: start,
      endsAtAbsoluteMinute: start + durationMinutes,
      delayMinutes: Math.max(0, Math.min(180, Number(input.delayMinutes ?? preset.delayMinutes))),
      cancellationRate: Math.max(0, Math.min(1, Number(input.cancellationRate ?? preset.cancellationRate))),
      capacityMultiplier: Math.max(0, Math.min(1, Number(input.capacityMultiplier ?? preset.capacityMultiplier))),
      suspended: input.suspended === true,
      source: 'MANUAL',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    }
    operations.disruptions.push(disruption)
    if (operations.disruptions.length > 160) operations.disruptions.splice(0, operations.disruptions.length - 160)
    addHistory('DISRUPTION_CREATED', line.id, `Perturbation créée · ${line.name}`, disruption.title)
    await persist()
    return disruption
  }

  async function resolveDisruption(id: string) {
    assertWritable()
    const operations = currentState()
    if (!operations) return false
    const disruption = operations.disruptions.find(item => item.id === id)
    if (!disruption || disruption.resolvedAt) return false
    disruption.resolvedAt = new Date().toISOString()
    disruption.endsAtAbsoluteMinute = Math.min(disruption.endsAtAbsoluteMinute, currentAbsoluteMinute.value)
    for (const service of operations.substitutionServices.filter(item => item.disruptionId === disruption.id && !item.endedAt)) {
      service.endedAt = new Date().toISOString()
      service.endsAtAbsoluteMinute = Math.min(service.endsAtAbsoluteMinute, currentAbsoluteMinute.value)
      addHistory('SUBSTITUTION_ENDED', service.lineId, `Bus de substitution terminé · ${lineName(service.lineId)}`, 'Fin de la perturbation associée.')
    }
    addHistory('DISRUPTION_RESOLVED', disruption.lineId, `Perturbation terminée · ${lineName(disruption.lineId)}`, disruption.title)
    await persist()
    return true
  }

  async function deleteDisruption(id: string) {
    assertWritable()
    const operations = currentState()
    if (!operations) return false
    const index = operations.disruptions.findIndex(item => item.id === id)
    if (index < 0) return false
    const [removed] = operations.disruptions.splice(index, 1)
    addHistory('DISRUPTION_DELETED', removed!.lineId, `Perturbation supprimée · ${lineName(removed!.lineId)}`, removed!.title)
    await persist()
    return true
  }

  function overrideFor(lineId: string, targetDay: number, missionId: string, departure: number) {
    return currentState()?.tripOverrides.find(item => item.lineId === lineId
      && item.day === targetDay
      && item.missionId === missionId
      && item.scheduledDepartureMinute === departure) ?? null
  }

  function ensureOverride(lineId: string, targetDay: number, missionId: string, departure: number) {
    const operations = currentState()
    if (!operations) return null
    let override = overrideFor(lineId, targetDay, missionId, departure)
    if (override) return override
    override = {
      id: createId('trip-override'),
      lineId,
      day: Math.max(1, Math.floor(targetDay)),
      missionId,
      scheduledDepartureMinute: Math.max(0, Math.min(1439, Math.round(departure))),
      delayMinutes: 0,
      cancelled: false,
      skippedStationIds: [],
      shortTurnStationId: null,
      note: '',
      updatedAt: new Date().toISOString(),
    }
    operations.tripOverrides.push(override)
    return override
  }

  function cleanupOverride(override: GameTripOverride) {
    const operations = currentState()
    if (!operations) return
    if (override.delayMinutes > 0 || override.cancelled || override.shortTurnStationId || override.skippedStationIds.length || override.note) return
    const index = operations.tripOverrides.findIndex(item => item.id === override.id)
    if (index >= 0) operations.tripOverrides.splice(index, 1)
  }

  async function setTripDelay(lineId: string, targetDay: number, missionId: string, departure: number, delayMinutes: number) {
    assertWritable()
    const override = ensureOverride(lineId, targetDay, missionId, departure)
    if (!override) return false
    override.delayMinutes = Math.max(0, Math.min(240, Math.round(delayMinutes)))
    override.updatedAt = new Date().toISOString()
    cleanupOverride(override)
    addHistory('TRIP_DELAYED', lineId, `Retard mission · ${lineName(lineId)}`, `${gameTimeLabel(departure)} · +${override.delayMinutes} min`)
    await persist()
    return true
  }

  async function setTripCancelled(lineId: string, targetDay: number, missionId: string, departure: number, cancelled: boolean) {
    assertWritable()
    const override = ensureOverride(lineId, targetDay, missionId, departure)
    if (!override) return false
    override.cancelled = cancelled
    override.updatedAt = new Date().toISOString()
    cleanupOverride(override)
    addHistory(cancelled ? 'TRIP_CANCELLED' : 'TRIP_RESTORED', lineId, cancelled ? `Mission supprimée · ${lineName(lineId)}` : `Mission rétablie · ${lineName(lineId)}`, gameTimeLabel(departure))
    await persist()
    return true
  }

  async function setTripShortTurn(lineId: string, targetDay: number, missionId: string, departure: number, stationId: string | null) {
    assertWritable()
    const override = ensureOverride(lineId, targetDay, missionId, departure)
    if (!override) return false
    override.shortTurnStationId = stationId || null
    override.updatedAt = new Date().toISOString()
    cleanupOverride(override)
    addHistory('TRIP_SHORT_TURNED', lineId, stationId ? `Terminus temporaire · ${lineName(lineId)}` : `Terminus normal rétabli · ${lineName(lineId)}`, gameTimeLabel(departure))
    await persist()
    return true
  }

  async function toggleSkippedStation(lineId: string, targetDay: number, missionId: string, departure: number, stationId: string) {
    assertWritable()
    const override = ensureOverride(lineId, targetDay, missionId, departure)
    if (!override) return false
    const skipped = new Set(override.skippedStationIds)
    if (skipped.has(stationId)) skipped.delete(stationId)
    else skipped.add(stationId)
    override.skippedStationIds = [...skipped]
    override.updatedAt = new Date().toISOString()
    cleanupOverride(override)
    addHistory('TRIP_STOPS_CHANGED', lineId, `Desserte modifiée · ${lineName(lineId)}`, gameTimeLabel(departure))
    await persist()
    return true
  }

  async function resetTrip(lineId: string, targetDay: number, missionId: string, departure: number) {
    assertWritable()
    const operations = currentState()
    if (!operations) return false
    const before = operations.tripOverrides.length
    operations.tripOverrides = operations.tripOverrides.filter(item => !(item.lineId === lineId && item.day === targetDay && item.missionId === missionId && item.scheduledDepartureMinute === departure))
    if (operations.tripOverrides.length === before) return false
    addHistory('TRIP_RESET', lineId, `Mission réinitialisée · ${lineName(lineId)}`, gameTimeLabel(departure))
    await persist()
    return true
  }

  async function addExtraTrip(lineId: string, missionId: string, departureMinute: number, targetDay = day.value) {
    assertWritable()
    const operations = currentState()
    const save = game.state.value.save
    if (!operations || !save) return null
    const line = save.data.network.lines.find(item => item.id === lineId)
    const mission = line?.schedule?.missions.find(item => item.id === missionId)
    if (!line || !mission) return null
    const departure = Math.max(0, Math.min(1439, Math.round(departureMinute)))
    if (availableReserveVehicles(line) <= 0) return null
    const reinforcementCost = calculateReinforcementTripCost(line)
    const transaction = applyServiceReinforcementCost(
      save.data.economy,
      line,
      reinforcementCost,
      `Circulation de renfort · ${mission.code} · ${gameTimeLabel(departure)}`,
    )
    if (!transaction) return null
    const extra = {
      id: createId('extra-trip'),
      lineId,
      day: Math.max(1, Math.floor(targetDay)),
      missionId,
      departureMinute: departure,
      createdAt: new Date().toISOString(),
    }
    operations.extraTrips.push(extra)
    addHistory('EXTRA_TRIP_ADDED', lineId, `Circulation de renfort · ${line.name}`, `${mission.code} · ${gameTimeLabel(departure)} · ${reinforcementCost.toLocaleString('fr-FR')} €`)
    await persist()
    return extra
  }

  async function removeExtraTrip(id: string) {
    assertWritable()
    const operations = currentState()
    if (!operations) return false
    const index = operations.extraTrips.findIndex(item => item.id === id)
    if (index < 0) return false
    const [removed] = operations.extraTrips.splice(index, 1)
    addHistory('EXTRA_TRIP_REMOVED', removed!.lineId, `Renfort retiré · ${lineName(removed!.lineId)}`, gameTimeLabel(removed!.departureMinute))
    await persist()
    return true
  }

  function lineUpcomingRuns(line: GameLine, limit = 16) {
    const save = game.state.value.save
    if (!save || line.schedule?.mode !== 'TIMETABLE') return []
    const result = [0, 1].flatMap(offset => buildOperationalRunsForLineDay(
      line,
      day.value + offset,
      save.data.calendarStartDate,
      save.data.operations,
    ).map(run => ({ ...run, relativeMinute: offset * 1440 + run.effectiveDepartureMinute })))
    return result
      .filter(run => run.relativeMinute >= currentMinute.value - 1)
      .sort((a, b) => a.relativeMinute - b.relativeMinute)
      .slice(0, Math.max(1, limit))
  }

  // Phase 19 : en mode Automatique, une perturbation naturelle active est
  // prise en charge une seule fois. On marque l'incident avant l'action afin
  // que plusieurs composants utilisant ce composable ne déclenchent pas deux réponses.
  watch(activeDisruptions, disruptions => {
    const operations = currentState()
    if (!operations || game.isReadOnly.value) return
    for (const disruption of disruptions) {
      if (disruption.source !== 'NATURAL' || pccControlLevel(disruption.lineId) !== 'AUTO') continue
      if (operations.autoHandledDisruptionIds.includes(disruption.id)) continue
      operations.autoHandledDisruptionIds.push(disruption.id)
      if (operations.autoHandledDisruptionIds.length > 160) operations.autoHandledDisruptionIds.splice(0, operations.autoHandledDisruptionIds.length - 160)
      void applyAutomaticResponse(disruption.id)
    }
  })

  return {
    state,
    day,
    currentMinute,
    currentAbsoluteMinute,
    activeDisruptions,
    plannedDisruptions,
    activeSubstitutions,
    presets: GAME_DISRUPTION_PRESETS,
    createDisruption,
    pccControlLevel,
    setPccControlLevel,
    availableReserveVehicles,
    substitutionEstimate,
    startBusSubstitution,
    stopBusSubstitution,
    applyAutomaticResponse,
    resolveDisruption,
    deleteDisruption,
    setTripDelay,
    setTripCancelled,
    setTripShortTurn,
    toggleSkippedStation,
    resetTrip,
    reinforcementCost,
    addExtraTrip,
    removeExtraTrip,
    lineUpcomingRuns,
  }
}

type GameOperationsRuntime = ReturnType<typeof createGameOperations>
let sharedOperationsRuntime: GameOperationsRuntime | null = null

export function useGameOperations() {
  // Les opérations appartiennent à l'état global de la partie. Les partager
  // évite plusieurs filtres de perturbations et plusieurs watchers identiques
  // quand GamePlay, StationInspector et les panneaux sont montés ensemble.
  if (!sharedOperationsRuntime) sharedOperationsRuntime = createGameOperations()
  return sharedOperationsRuntime
}
