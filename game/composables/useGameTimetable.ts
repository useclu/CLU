import { computed } from 'vue'
import {
  calculateTimetableStats,
  createGameMission,
  departureKey,
  generateDepartureSeries,
  getMissionRouteOptions,
  normalizeLineSchedule,
  normalizeMinute,
} from '../engine/timetable'
import type {
  GameLine,
  GameLineMission,
  GameScheduleMode,
  GameServiceDayType,
} from '../types/network'
import { useMetropoleGame } from './useMetropoleGame'

function cloneMission(mission: GameLineMission): GameLineMission {
  return JSON.parse(JSON.stringify(mission)) as GameLineMission
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function useGameTimetable() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  const day = computed(() => Math.max(1, game.state.value.save?.data.simulationDay ?? 1))
  const calendarStartDate = computed(() => game.state.value.save?.data.calendarStartDate ?? '2026-01-05')

  function findLine(lineId: string) {
    return game.state.value.save?.data.network.lines.find(line => line.id === lineId) ?? null
  }

  function ensureSchedule(line: GameLine) {
    line.schedule = normalizeLineSchedule(line)
    return line.schedule
  }

  async function persistLine(line: GameLine) {
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
  }

  function stats(line: GameLine) {
    return calculateTimetableStats(line, day.value, calendarStartDate.value)
  }

  function routeOptions(line: GameLine) {
    return getMissionRouteOptions(line)
  }

  async function setMode(lineId: string, mode: GameScheduleMode) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const schedule = ensureSchedule(line)
    schedule.mode = mode
    await persistLine(line)
    return true
  }

  async function addMission(lineId: string, routeStationIds?: string[]) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return null
    const schedule = ensureSchedule(line)
    const mission = createGameMission(line, routeStationIds)
    if (!mission) return null
    schedule.missions.push(mission)
    await persistLine(line)
    return mission
  }

  async function addAllRouteMissions(lineId: string) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return [] as GameLineMission[]
    const schedule = ensureSchedule(line)
    const existingRoutes = new Set(schedule.missions.map(mission => mission.routeStationIds.join('>')))
    const added: GameLineMission[] = []
    for (const option of getMissionRouteOptions(line)) {
      if (schedule.missions.length >= 96 || existingRoutes.has(option.stationIds.join('>'))) continue
      const mission = createGameMission(line, option.stationIds)
      if (!mission) continue
      schedule.missions.push(mission)
      existingRoutes.add(option.stationIds.join('>'))
      added.push(mission)
    }
    if (added.length) await persistLine(line)
    return added
  }

  async function duplicateMission(lineId: string, missionId: string) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return null
    const schedule = ensureSchedule(line)
    const source = schedule.missions.find(mission => mission.id === missionId)
    if (!source) return null
    const mission = cloneMission(source)
    mission.id = createId()
    mission.code = `${source.code.slice(0, 6)}${Math.min(99, schedule.missions.length + 1)}`.slice(0, 8)
    mission.name = `${source.name} copie`.slice(0, 80)
    schedule.missions.push(mission)
    await persistLine(line)
    return mission
  }

  async function removeMission(lineId: string, missionId: string) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const schedule = ensureSchedule(line)
    const before = schedule.missions.length
    schedule.missions = schedule.missions.filter(mission => mission.id !== missionId)
    if (schedule.missions.length === before) return false
    await persistLine(line)
    return true
  }

  async function updateMissionIdentity(lineId: string, missionId: string, values: { code?: string; name?: string; enabled?: boolean }) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    if (typeof values.code === 'string') mission.code = values.code.trim().slice(0, 8).toUpperCase() || mission.code
    if (typeof values.name === 'string') mission.name = values.name.trim().slice(0, 80) || mission.name
    if (typeof values.enabled === 'boolean') mission.enabled = values.enabled
    await persistLine(line)
    return true
  }

  async function setMissionRoute(lineId: string, missionId: string, routeStationIds: string[]) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    const route = getMissionRouteOptions(line).find(option => option.stationIds.join('>') === routeStationIds.join('>'))
    if (!mission || !route) return false
    const previousStops = new Set(mission.stopStationIds)
    mission.routeStationIds = [...route.stationIds]
    mission.stopStationIds = route.stationIds.filter(id => previousStops.has(id))
    if (!mission.stopStationIds.includes(route.stationIds[0]!)) mission.stopStationIds.unshift(route.stationIds[0]!)
    if (!mission.stopStationIds.includes(route.stationIds[route.stationIds.length - 1]!)) mission.stopStationIds.push(route.stationIds[route.stationIds.length - 1]!)
    mission.name = route.label
    await persistLine(line)
    return true
  }

  async function toggleMissionStop(lineId: string, missionId: string, stationId: string) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    const index = mission.routeStationIds.indexOf(stationId)
    if (index <= 0 || index >= mission.routeStationIds.length - 1) return false
    const stops = new Set(mission.stopStationIds)
    if (stops.has(stationId)) stops.delete(stationId)
    else stops.add(stationId)
    mission.stopStationIds = mission.routeStationIds.filter(id => stops.has(id))
    await persistLine(line)
    return true
  }

  async function setMissionDwell(lineId: string, missionId: string, value: number) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    mission.dwellMinutes = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0.6))
    await persistLine(line)
    return true
  }

  async function addDeparture(lineId: string, missionId: string, dayType: GameServiceDayType, minuteValue: number) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    const minute = normalizeMinute(minuteValue)
    if (!mission || minute === null) return false
    const key = departureKey(dayType)
    mission.departures[key] = [...new Set([...mission.departures[key], minute])].sort((a, b) => a - b)
    await persistLine(line)
    return true
  }

  async function removeDeparture(lineId: string, missionId: string, dayType: GameServiceDayType, minuteValue: number) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    const key = departureKey(dayType)
    mission.departures[key] = mission.departures[key].filter(minute => minute !== minuteValue)
    await persistLine(line)
    return true
  }

  async function generateDepartures(lineId: string, missionId: string, dayType: GameServiceDayType, startMinute: number, endMinute: number, intervalMinutes: number, replace = false) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    const key = departureKey(dayType)
    const generated = generateDepartureSeries(startMinute, endMinute, intervalMinutes)
    mission.departures[key] = replace
      ? generated
      : [...new Set([...mission.departures[key], ...generated])].sort((a, b) => a - b)
    await persistLine(line)
    return true
  }

  async function generateDeparturesForAll(
    lineId: string,
    dayType: GameServiceDayType,
    startMinute: number,
    endMinute: number,
    intervalMinutes: number,
    replace = false,
  ) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const schedule = ensureSchedule(line)
    const generated = generateDepartureSeries(startMinute, endMinute, intervalMinutes)
    const key = departureKey(dayType)
    for (const mission of schedule.missions) {
      if (!mission.enabled) continue
      mission.departures[key] = replace
        ? [...generated]
        : [...new Set([...mission.departures[key], ...generated])].sort((a, b) => a - b)
    }
    await persistLine(line)
    return true
  }

  async function clearDepartures(lineId: string, missionId: string, dayType: GameServiceDayType) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    mission.departures[departureKey(dayType)] = []
    await persistLine(line)
    return true
  }

  async function copyDepartures(lineId: string, missionId: string, from: GameServiceDayType, to: GameServiceDayType) {
    assertWritable()
    const line = findLine(lineId)
    if (!line) return false
    const mission = ensureSchedule(line).missions.find(item => item.id === missionId)
    if (!mission) return false
    mission.departures[departureKey(to)] = [...mission.departures[departureKey(from)]]
    await persistLine(line)
    return true
  }

  return {
    day,
    calendarStartDate,
    stats,
    routeOptions,
    setMode,
    addMission,
    addAllRouteMissions,
    duplicateMission,
    removeMission,
    updateMissionIdentity,
    setMissionRoute,
    toggleMissionStop,
    setMissionDwell,
    addDeparture,
    removeDeparture,
    generateDepartures,
    generateDeparturesForAll,
    clearDepartures,
    copyDepartures,
  }
}
