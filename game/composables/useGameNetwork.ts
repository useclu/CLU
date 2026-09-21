import { currentGameLocaleTag } from '../config/i18n'
import { computed } from 'vue'
import { useState } from '#app'

import {
  applyLineModificationCost,
  applyLineProjectCost,
  calculateLineLengthKm,
  calculateLineProjectCost,
  calculateStationConstructionCost,
} from '../engine/economy'
import {
  createGameLine,
  createGameStation,
  prepareLineConstruction,
  refreshProjectEstimate,
  suggestLineColor,
} from '../engine/network'
import { getModeEconomyDefinition } from '../config/economy'
import { getInfrastructureDefinition } from '../config/projects'
import {
  findLineStation,
  findLineStationLocation,
  getLineAllStations,
  getLineBranches,
} from '../engine/network/geometry'

import type {
  GameInfrastructureType,
  GameLine,
  GameLineBranch,
  GameLineBadgeStyle,
  GameLineEmblem,
  GameLineRoutingMode,
  GameServiceLevel,
  GameStation,
  GameTransportMode,
} from '../types/network'
import { useMetropoleGame } from './useMetropoleGame'
import { canUseModeInSave } from '../utils/challengeState'
import { registerLineDeleted, registerLineLaunched, registerLineModification } from '../engine/statistics'
import { getSegmentCoordinates, pruneOrphanRouteSegments, removeRouteSegmentsTouching, setRouteSegment, type GamePathCoordinate } from '../engine/network/pathGeometry'

export type GameNetworkMapAction =
  | { kind: 'NONE' }
  | { kind: 'APPEND' }
  | { kind: 'PREPEND' }
  | { kind: 'INSERT_AFTER'; stationId: string }
  | { kind: 'INSERT_ON_TRACE' }
  | { kind: 'CREATE_BRANCH'; stationId: string }
  | { kind: 'APPEND_BRANCH'; branchId: string }
  | { kind: 'MOVE'; stationId: string }

interface GameNetworkDraftHistorySnapshot {
  line: GameLine
  selectedStationId: string | null
}

function cloneLine(line: GameLine): GameLine {
  return JSON.parse(JSON.stringify(line)) as GameLine
}

function createBranchId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function removeStationFromDraft(line: GameLine, stationId: string) {
  const mainIndex = line.stations.findIndex(station => station.id === stationId)
  if (mainIndex >= 0) {
    if (line.stations.length <= 2) return false
    line.stations.splice(mainIndex, 1)
  }
  else {
    const branch = getLineBranches(line).find(item => item.stations.some(station => station.id === stationId))
    if (!branch) return false
    branch.stations = branch.stations.filter(station => station.id !== stationId)
    if (!branch.stations.length) line.branches = getLineBranches(line).filter(item => item.id !== branch.id)
  }
  // Une bifurcation attachée à une station supprimée ne doit jamais devenir orpheline.
  const removedAnchors = new Set([stationId])
  let changed = true
  while (changed) {
    changed = false
    const kept: GameLineBranch[] = []
    for (const branch of getLineBranches(line)) {
      if (removedAnchors.has(branch.fromStationId)) {
        for (const station of branch.stations) removedAnchors.add(station.id)
        changed = true
      }
      else kept.push(branch)
    }
    line.branches = kept
  }
  return true
}


interface TraceInsertionTarget {
  branchId: string | null
  insertIndex: number
  from: GameStation
  to: GameStation
  point: GamePathCoordinate
  firstPart: GamePathCoordinate[]
  secondPart: GamePathCoordinate[]
  source: 'ASSISTED' | 'FREE'
}

function projectOnSegment(point: GamePathCoordinate, a: GamePathCoordinate, b: GamePathCoordinate) {
  const xScale = Math.cos((point[1] * Math.PI) / 180)
  const ax = a[0] * xScale; const ay = a[1]
  const bx = b[0] * xScale; const by = b[1]
  const px = point[0] * xScale; const py = point[1]
  const dx = bx - ax; const dy = by - ay
  const length2 = dx * dx + dy * dy
  const t = length2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0
  const projected: GamePathCoordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const ddx = (point[0] - projected[0]) * xScale
  const ddy = point[1] - projected[1]
  return { point: projected, distance2: ddx * ddx + ddy * ddy, t }
}

function insertionTargetOnTrace(line: GameLine, longitude: number, latitude: number): TraceInsertionTarget | null {
  const clicked: GamePathCoordinate = [longitude, latitude]
  let best: TraceInsertionTarget | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  const inspect = (stations: GameStation[], branchId: string | null) => {
    for (let stationIndex = 0; stationIndex < stations.length - 1; stationIndex += 1) {
      const from = stations[stationIndex]!
      const to = stations[stationIndex + 1]!
      const coordinates = getSegmentCoordinates(line, from, to) ?? [[from.longitude, from.latitude], [to.longitude, to.latitude]]
      for (let i = 0; i < coordinates.length - 1; i += 1) {
        const projected = projectOnSegment(clicked, coordinates[i]!, coordinates[i + 1]!)
        if (projected.distance2 >= bestDistance) continue
        const firstPart = [...coordinates.slice(0, i + 1), projected.point]
        const secondPart = [projected.point, ...coordinates.slice(i + 1)]
        bestDistance = projected.distance2
        best = {
          branchId,
          insertIndex: stationIndex + 1,
          from,
          to,
          point: projected.point,
          firstPart,
          secondPart,
          source: line.routingMode === 'FREE' ? 'FREE' : 'ASSISTED',
        }
      }
    }
  }
  inspect(line.stations, null)
  for (const branch of getLineBranches(line)) {
    const anchor = findLineStation(line, branch.fromStationId)
    if (anchor) inspect([anchor, ...branch.stations], branch.id)
  }
  return best
}

function preserveRouteAcrossRemoval(line: GameLine, stationId: string) {
  const location = findLineStationLocation(line, stationId)
  if (!location) return null
  let sequence: GameStation[] = []
  if (location.isMain) sequence = line.stations
  else {
    const branch = getLineBranches(line).find(item => item.id === location.branchId)
    const anchor = branch ? findLineStation(line, branch.fromStationId) : null
    if (branch && anchor) sequence = [anchor, ...branch.stations]
  }
  const sequenceIndex = sequence.findIndex(item => item.id === stationId)
  if (sequenceIndex <= 0 || sequenceIndex >= sequence.length - 1) return null
  const previous = sequence[sequenceIndex - 1]!
  const current = sequence[sequenceIndex]!
  const next = sequence[sequenceIndex + 1]!
  const first = getSegmentCoordinates(line, previous, current) ?? [[previous.longitude, previous.latitude], [current.longitude, current.latitude]]
  const second = getSegmentCoordinates(line, current, next) ?? [[current.longitude, current.latitude], [next.longitude, next.latitude]]
  return { previous, next, coordinates: [...first, ...second.slice(1)], source: line.routingMode === 'FREE' ? 'FREE' as const : 'ASSISTED' as const }
}

export type GameProjectActionResult =
  | { ok: true }
  | { ok: false; code: 'NO_SAVE' | 'NOT_ENOUGH_STATIONS' | 'INSUFFICIENT_FUNDS' | 'INVALID_PROJECT'; message: string; shortfall?: number }

export interface GameDraftPreviewMetrics {
  lengthKm: number
  cost: number
  deltaLengthKm: number
  deltaCost: number
  affordable: boolean
  shortfall: number
}

function calculateModificationEstimate(original: GameLine, draft: GameLine) {
  const originalStations = getLineAllStations(original)
  const draftStations = getLineAllStations(draft)
  const originalIds = new Set(originalStations.map(station => station.id))
  const addedCount = draftStations.filter(station => !originalIds.has(station.id)).length
  let movedCount = 0
  for (const station of draftStations) {
    const old = originalStations.find(item => item.id === station.id)
    if (old && (Math.abs(old.longitude - station.longitude) > 1e-8 || Math.abs(old.latitude - station.latitude) > 1e-8)) movedCount += 1
  }
  const oldLength = calculateLineLengthKm(original)
  const newLength = calculateLineLengthKm(draft)
  const infrastructure = getInfrastructureDefinition(draft.mode, draft.infrastructureType)
  const modeEconomy = getModeEconomyDefinition(draft.mode)
  const lengthWorkKm = Math.abs(newLength - oldLength) + movedCount * 0.45
  return Math.max(
    0,
    Math.round(
      addedCount * calculateStationConstructionCost(draft.mode)
      + lengthWorkKm * modeEconomy.infrastructurePerKm * infrastructure.constructionCostMultiplier,
    ),
  )
}

function applyPreviewAction(line: GameLine, action: GameNetworkMapAction, longitude: number, latitude: number, routeCoordinates?: GamePathCoordinate[]) {
  const source = line.routingMode === 'FREE' ? 'FREE' : 'ASSISTED'
  const createPreviewStation = (index: number) => {
    const station = createGameStation(index, longitude, latitude)
    station.id = `preview-${index}`
    station.name = 'Aperçu'
    station.sharedStationId = station.id
    return station
  }

  if (action.kind === 'APPEND') {
    const previous = line.stations.at(-1) ?? null
    const station = createPreviewStation(getLineAllStations(line).length)
    line.stations.push(station)
    if (previous && routeCoordinates?.length) setRouteSegment(line, previous, station, routeCoordinates, source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'PREPEND') {
    const previous = line.stations[0] ?? null
    const station = createPreviewStation(0)
    line.stations.unshift(station)
    if (previous && routeCoordinates?.length) setRouteSegment(line, station, previous, [...routeCoordinates].reverse(), source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'INSERT_ON_TRACE') {
    const target = insertionTargetOnTrace(line, longitude, latitude)
    if (!target) return false
    const station = createPreviewStation(getLineAllStations(line).length)
    station.longitude = target.point[0]
    station.latitude = target.point[1]
    if (target.branchId) {
      const branch = getLineBranches(line).find(item => item.id === target.branchId)
      if (!branch) return false
      // La séquence de branche inclut la bifurcation en index 0.
      branch.stations.splice(Math.max(0, target.insertIndex - 1), 0, station)
    }
    else line.stations.splice(target.insertIndex, 0, station)
    setRouteSegment(line, target.from, station, target.firstPart, target.source)
    setRouteSegment(line, station, target.to, target.secondPart, target.source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'INSERT_AFTER') {
    const index = line.stations.findIndex(item => item.id === action.stationId)
    if (index < 0) return false
    const previous = line.stations[index]!
    const station = createPreviewStation(index + 1)
    line.stations.splice(index + 1, 0, station)
    if (routeCoordinates?.length) setRouteSegment(line, previous, station, routeCoordinates, source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'CREATE_BRANCH') {
    const anchor = findLineStation(line, action.stationId)
    if (!anchor) return false
    const station = createPreviewStation(getLineAllStations(line).length)
    line.branches = getLineBranches(line)
    line.branches.push({ id: 'preview-branch', fromStationId: action.stationId, stations: [station] })
    if (routeCoordinates?.length) setRouteSegment(line, anchor, station, routeCoordinates, source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'APPEND_BRANCH') {
    const branch = getLineBranches(line).find(item => item.id === action.branchId)
    if (!branch) return false
    const anchor = branch.stations.at(-1) ?? findLineStation(line, branch.fromStationId)
    const station = createPreviewStation(getLineAllStations(line).length)
    branch.stations.push(station)
    if (anchor && routeCoordinates?.length) setRouteSegment(line, anchor, station, routeCoordinates, source)
    pruneOrphanRouteSegments(line)
    return true
  }
  if (action.kind === 'MOVE') {
    const station = findLineStation(line, action.stationId)
    if (!station) return false
    removeRouteSegmentsTouching(line, [station.id])
    station.longitude = longitude
    station.latitude = latitude
    pruneOrphanRouteSegments(line)
    return true
  }
  return false
}

export function useGameNetwork() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }
  const activeLineId = useState<string | null>('clu-metropole-active-line-id', () => null)
  const editingLineId = useState<string | null>('clu-metropole-editing-line-id', () => null)
  const editDraft = useState<GameLine | null>('clu-metropole-edit-draft', () => null)
  const editSelectedStationId = useState<string | null>('clu-metropole-edit-selected-station-id', () => null)
  const mapAction = useState<GameNetworkMapAction>('clu-metropole-map-action', () => ({ kind: 'NONE' }))
  const pendingStationNaming = useState<{ lineId: string; stationId: string; suggestedName: string; outsideLoadedTerritory: boolean } | null>('clu-metropole-pending-station-naming', () => null)
  const draftGuidePoints = useState<GamePathCoordinate[]>('clu-metropole-route-guide-points', () => [])
  const routeGuideMode = useState<boolean>('clu-metropole-route-guide-mode', () => false)

  // V28 : historique temporaire du brouillon. Il disparaît dès validation/annulation.
  const draftUndoStack = useState<GameNetworkDraftHistorySnapshot[]>('clu-metropole-draft-undo', () => [])
  const draftRedoStack = useState<GameNetworkDraftHistorySnapshot[]>('clu-metropole-draft-redo', () => [])

  const lines = computed(() => game.state.value.save?.data.network.lines ?? [])
  const activeLine = computed(() => lines.value.find(line => line.id === activeLineId.value) ?? null)
  const editingLine = computed(() => lines.value.find(line => line.id === editingLineId.value) ?? null)
  const isBuilding = computed(() => activeLine.value !== null)
  const isEditing = computed(() => editDraft.value !== null)
  const editSelectedStation = computed(() => editDraft.value && editSelectedStationId.value ? findLineStation(editDraft.value, editSelectedStationId.value) : null)
  const displayLines = computed(() => {
    if (!editDraft.value || !editingLineId.value) return lines.value
    return lines.value.map(line => line.id === editingLineId.value ? editDraft.value! : line)
  })


  const canUndoDraft = computed(() => Boolean((activeLine.value || editDraft.value) && draftUndoStack.value.length && !pendingStationNaming.value))
  const canRedoDraft = computed(() => Boolean((activeLine.value || editDraft.value) && draftRedoStack.value.length && !pendingStationNaming.value))

  function clearDraftHistory() {
    draftUndoStack.value = []
    draftRedoStack.value = []
    draftGuidePoints.value = []
    routeGuideMode.value = false
  }

  function currentDraftSnapshot(): GameNetworkDraftHistorySnapshot | null {
    const line = activeLine.value ?? editDraft.value
    if (!line) return null
    return { line: cloneLine(line), selectedStationId: editSelectedStationId.value }
  }

  function pushDraftHistory() {
    const snapshot = currentDraftSnapshot()
    if (!snapshot) return false
    draftUndoStack.value = [...draftUndoStack.value, snapshot]
    draftRedoStack.value = []
    return true
  }

  async function restoreDraftSnapshot(snapshot: GameNetworkDraftHistorySnapshot) {
    assertWritable()
    pendingStationNaming.value = null
    mapAction.value = { kind: 'NONE' }
    draftGuidePoints.value = []
    routeGuideMode.value = false
    editSelectedStationId.value = snapshot.selectedStationId && findLineStation(snapshot.line, snapshot.selectedStationId)
      ? snapshot.selectedStationId
      : null

    if (activeLineId.value) {
      const save = game.state.value.save
      if (!save) return false
      const index = save.data.network.lines.findIndex(line => line.id === activeLineId.value)
      if (index < 0) return false
      save.data.network.lines.splice(index, 1, cloneLine(snapshot.line))
      await game.persistCurrentGame()
      return true
    }
    if (editDraft.value) {
      editDraft.value = cloneLine(snapshot.line)
      return true
    }
    return false
  }

  async function undoDraft() {
    assertWritable()
    if (!canUndoDraft.value) return false
    const previous = draftUndoStack.value.at(-1)
    const current = currentDraftSnapshot()
    if (!previous || !current) return false
    draftUndoStack.value = draftUndoStack.value.slice(0, -1)
    draftRedoStack.value = [...draftRedoStack.value, current]
    return await restoreDraftSnapshot(previous)
  }

  async function redoDraft() {
    assertWritable()
    if (!canRedoDraft.value) return false
    const next = draftRedoStack.value.at(-1)
    const current = currentDraftSnapshot()
    if (!next || !current) return false
    draftRedoStack.value = draftRedoStack.value.slice(0, -1)
    draftUndoStack.value = [...draftUndoStack.value, current]
    return await restoreDraftSnapshot(next)
  }

  async function setDraftRoutingMode(mode: GameLineRoutingMode) {
    assertWritable()
    const line = activeLine.value ?? editDraft.value
    if (!line || (mode !== 'ASSISTED' && mode !== 'FREE')) return false
    if ((line.routingMode ?? 'ASSISTED') === mode) return true
    pushDraftHistory()
    line.routingMode = mode
    draftGuidePoints.value = []
    routeGuideMode.value = false
    line.updatedAt = new Date().toISOString()
    if (activeLine.value) await game.persistCurrentGame()
    return true
  }

  function toggleRouteGuideMode() {
    if (game.isReadOnly.value) return
    if (!(activeLine.value || editDraft.value)) return false
    routeGuideMode.value = !routeGuideMode.value
    return true
  }

  function addDraftGuidePoint(longitude: number, latitude: number) {
    if (game.isReadOnly.value) return
    if (!(activeLine.value || editDraft.value)) return false
    draftGuidePoints.value = [...draftGuidePoints.value, [longitude, latitude]]
    routeGuideMode.value = false
    return true
  }

  function removeLastDraftGuidePoint() {
    if (game.isReadOnly.value) return
    if (!draftGuidePoints.value.length) return false
    draftGuidePoints.value = draftGuidePoints.value.slice(0, -1)
    return true
  }

  function clearDraftGuidePoints() {
    if (game.isReadOnly.value) return
    draftGuidePoints.value = []
    routeGuideMode.value = false
  }

  const activeProjectEstimate = computed(() => activeLine.value ? calculateLineProjectCost(activeLine.value) : 0)
  const editProjectEstimate = computed(() => editingLine.value && editDraft.value
    ? calculateModificationEstimate(editingLine.value, editDraft.value)
    : 0)

  function previewDraftAt(longitude: number, latitude: number, routeCoordinates?: GamePathCoordinate[]): GameDraftPreviewMetrics | null {
    const save = game.state.value.save
    if (!save || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

    const currentLine = activeLine.value ?? editDraft.value
    if (!currentLine) return null
    const preview = cloneLine(currentLine)
    const currentLength = calculateLineLengthKm(currentLine)
    const currentCost = activeLine.value
      ? calculateLineProjectCost(currentLine)
      : (editingLine.value && editDraft.value ? calculateModificationEstimate(editingLine.value, editDraft.value) : 0)

    const action: GameNetworkMapAction = activeLine.value
      ? { kind: 'APPEND' }
      : mapAction.value
    if (action.kind === 'NONE') return null
    if (!applyPreviewAction(preview, action, longitude, latitude, routeCoordinates)) return null

    const lengthKm = calculateLineLengthKm(preview)
    const cost = activeLine.value
      ? calculateLineProjectCost(preview)
      : (editingLine.value ? calculateModificationEstimate(editingLine.value, preview) : 0)
    const shortfall = save.data.economy.unlimitedMoney ? 0 : Math.max(0, Math.round(cost - save.data.economy.balance))
    return {
      lengthKm,
      cost,
      deltaLengthKm: lengthKm - currentLength,
      deltaCost: cost - currentCost,
      affordable: save.data.economy.unlimitedMoney || shortfall <= 0,
      shortfall,
    }
  }

  const activeProjectValidation = computed<GameProjectActionResult>(() => {
    const save = game.state.value.save
    const line = activeLine.value
    if (!save || !line) return { ok: false, code: 'NO_SAVE', message: 'Aucun projet de ligne actif.' }
    if (line.stations.length < 2) return { ok: false, code: 'NOT_ENOUGH_STATIONS', message: 'Ajoutez au moins deux stations avant de valider le projet.' }
    const cost = activeProjectEstimate.value
    if (!Number.isFinite(cost) || cost < 0) return { ok: false, code: 'INVALID_PROJECT', message: 'Le coût du projet ne peut pas être calculé.' }
    if (!save.data.economy.unlimitedMoney && save.data.economy.balance < cost) {
      const shortfall = Math.max(0, Math.round(cost - save.data.economy.balance))
      return { ok: false, code: 'INSUFFICIENT_FUNDS', shortfall, message: `Trésorerie insuffisante : il manque ${new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(shortfall)}. Ouvrez Finances pour emprunter ou réduisez le projet.` }
    }
    return { ok: true }
  })

  const editProjectValidation = computed<GameProjectActionResult>(() => {
    const save = game.state.value.save
    const draft = editDraft.value
    if (!save || !draft) return { ok: false, code: 'NO_SAVE', message: 'Aucune modification de ligne active.' }
    if (draft.stations.length < 2) return { ok: false, code: 'NOT_ENOUGH_STATIONS', message: 'Une ligne doit conserver au moins deux stations.' }
    const cost = editProjectEstimate.value
    if (!save.data.economy.unlimitedMoney && save.data.economy.balance < cost) {
      const shortfall = Math.max(0, Math.round(cost - save.data.economy.balance))
      return { ok: false, code: 'INSUFFICIENT_FUNDS', shortfall, message: `Trésorerie insuffisante : il manque ${new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(shortfall)} pour valider ces travaux.` }
    }
    return { ok: true }
  })

  async function startLine(mode: GameTransportMode, name?: string) {
    assertWritable()
    if (!canUseModeInSave(game.state.value.save, mode)) throw new Error('Ce mode de transport est interdit par les règles de ce défi.')
    const save = game.state.value.save
    if (!save || activeLine.value || editDraft.value) return activeLine.value
    const line = createGameLine(save.data.network.lines.length, mode, name)
    line.color = suggestLineColor(save.data.network.lines.map(item => item.color), line.color)
    line.regulationMode = save.data.freePlaySettings.regulationGuidance === 'MANUAL' ? 'MANUAL' : 'AUTO'
    line.inspectionMode = save.data.freePlaySettings.inspectionGuidance === 'MANUAL' ? 'CUSTOM' : 'AUTO'
    save.data.network.lines.push(line)
    activeLineId.value = line.id
    clearDraftHistory()
    await game.persistCurrentGame()
    return line
  }

  async function addStation(longitude: number, latitude: number, suggestedName = '', outsideLoadedTerritory = false, routeCoordinates?: GamePathCoordinate[]) {
    assertWritable()
    const line = activeLine.value
    if (!line || pendingStationNaming.value) return null
    pushDraftHistory()
    const previousStation = line.stations.at(-1) ?? null
    const station = createGameStation(line.stations.length, longitude, latitude)
    station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
    station.sharedStationId = station.id
    line.stations.push(station)
    if (previousStation && routeCoordinates?.length) setRouteSegment(line, previousStation, station, routeCoordinates, line.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
    pruneOrphanRouteSegments(line)
    clearDraftGuidePoints()
    refreshProjectEstimate(line)
    line.updatedAt = new Date().toISOString()
    pendingStationNaming.value = { lineId: line.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
    await game.persistCurrentGame()
    return station
  }

  async function finalizePendingStationName(name: string) {
    assertWritable()
    const pending = pendingStationNaming.value
    if (!pending) return false
    const line = editDraft.value?.id === pending.lineId
      ? editDraft.value
      : lines.value.find(item => item.id === pending.lineId)
    const station = line ? findLineStation(line, pending.stationId) : null
    const normalized = name.trim().slice(0, 60) || pending.suggestedName || 'Nouvelle station'
    if (!station) { pendingStationNaming.value = null; return false }
    station.name = normalized
    if (line && 'updatedAt' in line) line.updatedAt = new Date().toISOString()
    pendingStationNaming.value = null
    await game.persistCurrentGame()
    return true
  }

  async function cancelPendingStationName() {
    assertWritable()
    const pending = pendingStationNaming.value
    if (!pending) return false
    const draft = editDraft.value?.id === pending.lineId ? editDraft.value : null
    const savedLine = draft ? null : lines.value.find(item => item.id === pending.lineId)

    if (draft) {
      // En édition, la station vient d'être ajoutée au brouillon : on l'annule
      // complètement, branche comprise si elle était son premier arrêt.
      removeStationFromDraft(draft, pending.stationId)
      draft.updatedAt = new Date().toISOString()
    }
    else if (savedLine) {
      // Pendant la création d'une nouvelle ligne, l'ancien helper refusait de
      // descendre sous 2 stations (garde-fou utile pour une ligne existante).
      // Résultat : « Annuler » sur la 1re/2e station fermait la boîte de nom mais
      // conservait quand même le point et son segment. Ici une station encore en
      // attente de confirmation est provisoire : elle doit pouvoir disparaître,
      // même s'il ne reste ensuite que 0 ou 1 station dans le projet.
      savedLine.stations = savedLine.stations.filter(station => station.id !== pending.stationId)
      savedLine.updatedAt = new Date().toISOString()
      refreshProjectEstimate(savedLine)
    }

    if (draft) pruneOrphanRouteSegments(draft)
    if (savedLine) pruneOrphanRouteSegments(savedLine)
    if (editSelectedStationId.value === pending.stationId) editSelectedStationId.value = null
    mapAction.value = { kind: 'NONE' }
    pendingStationNaming.value = null
    // L'ajout vient d'être annulé manuellement : on retire son point d'historique
    // pour que Ctrl+Z ne crée pas une étape vide suivie d'un Ctrl+Y surprenant.
    draftUndoStack.value = draftUndoStack.value.slice(0, -1)
    draftRedoStack.value = []
    if (savedLine) await game.persistCurrentGame()
    return true
  }

  async function useExistingStation(sourceLineId: string, stationId: string) {
    assertWritable()
    const target = activeLine.value ?? editDraft.value
    const sourceLine = lines.value.find(item => item.id === sourceLineId)
    const source = sourceLine ? findLineStation(sourceLine, stationId) : null
    const action = mapAction.value
    if (!target || !source || target.id === sourceLineId) return false
    if (editDraft.value && !['PREPEND', 'APPEND', 'INSERT_AFTER', 'CREATE_BRANCH', 'APPEND_BRANCH'].includes(action.kind)) return false
    const sharedId = source.sharedStationId || source.id
    if (getLineAllStations(target).some(item => item.sharedStationId === sharedId)) return false
    if (editDraft.value && action.kind === 'APPEND_BRANCH' && !getLineBranches(target).some(item => item.id === action.branchId)) return false
    pushDraftHistory()
    source.sharedStationId = sharedId
    const copy = { ...source, id: `${target.id}-shared-${sharedId}`, sharedStationId: sharedId }
    if (activeLine.value) target.stations.push(copy)
    else if (action.kind === 'PREPEND') target.stations.unshift(copy)
    else if (action.kind === 'INSERT_AFTER') {
      const index = target.stations.findIndex(item => item.id === action.stationId)
      target.stations.splice(Math.max(0, index + 1), 0, copy)
    }
    else if (action.kind === 'CREATE_BRANCH') {
      const branches = getLineBranches(target)
      target.branches = branches
      branches.push({ id: createBranchId(), fromStationId: action.stationId, stations: [copy] })
    }
    else if (action.kind === 'APPEND_BRANCH') {
      const branch = getLineBranches(target).find(item => item.id === action.branchId)
      if (!branch) return false
      branch.stations.push(copy)
    }
    else target.stations.push(copy)
    pruneOrphanRouteSegments(target)
    clearDraftGuidePoints()
    mapAction.value = { kind: 'NONE' }
    target.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function finishLine() {
    assertWritable()
    const save = game.state.value.save
    const line = activeLine.value
    if (!save || !line || line.stations.length < 2) return false
    refreshProjectEstimate(line)
    const transaction = applyLineProjectCost(save.data.economy, line)
    if (!transaction) return false
    prepareLineConstruction(line)
    registerLineLaunched(save, getLineAllStations(line).length, line.name, transaction.amount)
    activeLineId.value = null
    clearDraftHistory()
    await game.persistCurrentGame()
    return true
  }

  async function finishLineDetailed(): Promise<GameProjectActionResult> {
    assertWritable()
    const validation = activeProjectValidation.value
    if (!validation.ok) return validation
    const ok = await finishLine()
    return ok ? { ok: true } : { ok: false, code: 'INVALID_PROJECT', message: 'Le projet n’a pas pu être validé. Vérifiez son financement et son tracé.' }
  }

  async function cancelActiveLine() {
    assertWritable()
    const save = game.state.value.save
    const line = activeLine.value
    if (!save || !line) {
      activeLineId.value = null
      clearDraftHistory()
      return
    }
    save.data.network.lines = save.data.network.lines.filter(item => item.id !== line.id)
    activeLineId.value = null
    clearDraftHistory()
    await game.persistCurrentGame()
  }

  async function renameLine(lineId: string, name: string) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    const normalized = name.trim().slice(0, 60)
    if (!line || !normalized) return false
    line.name = normalized
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setLineIdentity(
    lineId: string,
    values: Partial<Pick<GameLine, 'shortCode' | 'color' | 'badgeStyle' | 'emblem'>>,
  ) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    if (!line) return false
    if (typeof values.shortCode === 'string') line.shortCode = values.shortCode.trim().slice(0, 4) || line.shortCode
    if (typeof values.color === 'string' && /^#[0-9a-f]{6}$/i.test(values.color)) line.color = values.color
    if (values.badgeStyle) line.badgeStyle = values.badgeStyle as GameLineBadgeStyle
    if (values.emblem) line.emblem = values.emblem as GameLineEmblem
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setLineCustomLogo(lineId: string, dataUrl?: string) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    if (!line) return false
    if (dataUrl && (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl) || dataUrl.length > 350_000)) return false
    line.customLogoDataUrl = dataUrl || undefined
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function renameStation(lineId: string, stationId: string, name: string) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    const station = line ? findLineStation(line, stationId) : null
    const normalized = name.trim().slice(0, 60)
    if (!line || !station || !normalized) return false
    station.name = normalized
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setInfrastructureType(lineId: string, value: GameInfrastructureType) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    if (!line) return false
    line.infrastructureType = value
    refreshProjectEstimate(line)
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setLineServiceLevel(id: string, level: GameServiceLevel) {
    assertWritable()
    const line = lines.value.find(item => item.id === id)
    if (!line) return false
    line.serviceLevel = level
    line.serviceProfile.normal = level
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setServiceProfileMode(lineId: string, mode: 'SIMPLE' | 'ADVANCED') {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    if (!line) return false
    line.serviceProfileMode = mode
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setServiceProfileLevel(
    lineId: string,
    period: 'offPeak' | 'normal' | 'peak',
    level: GameServiceLevel,
  ) {
    assertWritable()
    const line = lines.value.find(item => item.id === lineId)
    if (!line) return false
    line.serviceProfile[period] = level
    if (period === 'normal') line.serviceLevel = level
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  function beginEditLine(lineId: string) {
    if (game.isReadOnly.value) return
    const line = lines.value.find(item => item.id === lineId)
    if (!line || activeLine.value) return false
    editingLineId.value = lineId
    editDraft.value = cloneLine(line)
    editSelectedStationId.value = null
    mapAction.value = { kind: 'NONE' }
    clearDraftHistory()
    return true
  }

  function cancelLineEdit() {
    if (game.isReadOnly.value) return
    editingLineId.value = null
    editDraft.value = null
    editSelectedStationId.value = null
    mapAction.value = { kind: 'NONE' }
    clearDraftHistory()
  }

  function requestAppendStation() {
    if (game.isReadOnly.value) return
    if (!editDraft.value) return false
    editSelectedStationId.value = editDraft.value.stations.at(-1)?.id ?? null
    mapAction.value = { kind: 'APPEND' }
    return true
  }

  function requestPrependStation() {
    if (game.isReadOnly.value) return
    if (!editDraft.value) return false
    editSelectedStationId.value = editDraft.value.stations[0]?.id ?? null
    mapAction.value = { kind: 'PREPEND' }
    return true
  }

  function requestInsertOnTrace() {
    if (game.isReadOnly.value) return false
    if (!editDraft.value) return false
    editSelectedStationId.value = null
    mapAction.value = { kind: 'INSERT_ON_TRACE' }
    return true
  }

  function requestInsertAfter(stationId: string) {
    if (game.isReadOnly.value) return
    if (!editDraft.value || !editDraft.value.stations.some(station => station.id === stationId)) return false
    editSelectedStationId.value = stationId
    mapAction.value = { kind: 'INSERT_AFTER', stationId }
    return true
  }

  /**
   * Point d'entrée unique du mode modification.
   * - Un terminus prolonge le tronc : l'ancien terminus devient automatiquement un arrêt normal.
   * - Un arrêt intérieur crée une vraie branche indépendante ; le tronc existant n'est jamais
   *   réordonné, ce qui supprime le grand aller-retour observé en V24.
   * - Le terminus d'une branche prolonge cette branche.
   */
  function requestContinueFromStation(stationId: string) {
    if (game.isReadOnly.value) return
    const draft = editDraft.value
    if (!draft) return false
    const location = findLineStationLocation(draft, stationId)
    if (!location) return false
    editSelectedStationId.value = stationId

    if (location.isMain) {
      if (location.index === 0) mapAction.value = { kind: 'PREPEND' }
      else if (location.index === draft.stations.length - 1) mapAction.value = { kind: 'APPEND' }
      else mapAction.value = { kind: 'CREATE_BRANCH', stationId }
      return true
    }

    const branch = getLineBranches(draft).find(item => item.id === location.branchId)
    if (branch && location.index === branch.stations.length - 1) {
      mapAction.value = { kind: 'APPEND_BRANCH', branchId: branch.id }
    }
    else {
      mapAction.value = { kind: 'CREATE_BRANCH', stationId }
    }
    return true
  }

  function requestMoveStation(stationId: string) {
    if (game.isReadOnly.value) return
    if (!editDraft.value || !findLineStation(editDraft.value, stationId)) return false
    editSelectedStationId.value = stationId
    mapAction.value = { kind: 'MOVE', stationId }
    return true
  }

  function clearEditMapAction() {
    if (game.isReadOnly.value) return
    if (!editDraft.value) return false
    mapAction.value = { kind: 'NONE' }
    return true
  }

  function canRemoveDraftStation(stationId: string) {
    const draft = editDraft.value
    if (!draft) return false
    const location = findLineStationLocation(draft, stationId)
    if (!location) return false
    return !location.isMain || draft.stations.length > 2
  }

  function removeDraftStation(stationId: string) {
    if (game.isReadOnly.value) return
    if (!editDraft.value || !canRemoveDraftStation(stationId)) return false
    pushDraftHistory()
    const preserved = preserveRouteAcrossRemoval(editDraft.value, stationId)
    const removed = removeStationFromDraft(editDraft.value, stationId)
    if (!removed) return false
    removeRouteSegmentsTouching(editDraft.value, [stationId])
    if (preserved && findLineStation(editDraft.value, preserved.previous.id) && findLineStation(editDraft.value, preserved.next.id)) {
      setRouteSegment(editDraft.value, preserved.previous, preserved.next, preserved.coordinates, preserved.source)
    }
    pruneOrphanRouteSegments(editDraft.value)
    if (editSelectedStationId.value === stationId) editSelectedStationId.value = null
    mapAction.value = { kind: 'NONE' }
    return true
  }

  async function handleMapClick(longitude: number, latitude: number, suggestedName = '', outsideLoadedTerritory = false, routeCoordinates?: GamePathCoordinate[]) {
    assertWritable()
    if (pendingStationNaming.value) return null
    if (activeLine.value) return await addStation(longitude, latitude, suggestedName, outsideLoadedTerritory, routeCoordinates)
    const draft = editDraft.value
    const action = mapAction.value
    if (!draft || action.kind === 'NONE') return null
    if (action.kind === 'INSERT_AFTER' && !draft.stations.some(item => item.id === action.stationId)) return null
    if (action.kind === 'CREATE_BRANCH' && !findLineStation(draft, action.stationId)) return null
    if (action.kind === 'APPEND_BRANCH' && !getLineBranches(draft).some(item => item.id === action.branchId)) return null
    if (action.kind === 'MOVE' && !findLineStation(draft, action.stationId)) return null
    pushDraftHistory()

    if (action.kind === 'INSERT_ON_TRACE') {
      const target = insertionTargetOnTrace(draft, longitude, latitude)
      if (!target) return null
      const station = createGameStation(getLineAllStations(draft).length, target.point[0], target.point[1])
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      if (target.branchId) {
        const branch = getLineBranches(draft).find(item => item.id === target.branchId)
        if (!branch) return null
        branch.stations.splice(Math.max(0, target.insertIndex - 1), 0, station)
      }
      else draft.stations.splice(target.insertIndex, 0, station)
      setRouteSegment(draft, target.from, station, target.firstPart, target.source)
      setRouteSegment(draft, station, target.to, target.secondPart, target.source)
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      editSelectedStationId.value = station.id
      mapAction.value = { kind: 'NONE' }
      return station
    }

    if (action.kind === 'PREPEND') {
      const previousFirst = draft.stations[0] ?? null
      const station = createGameStation(0, longitude, latitude)
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      draft.stations.unshift(station)
      if (previousFirst && routeCoordinates?.length) setRouteSegment(draft, station, previousFirst, [...routeCoordinates].reverse(), draft.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      mapAction.value = { kind: 'NONE' }
      return station
    }

    if (action.kind === 'APPEND') {
      const previousLast = draft.stations.at(-1) ?? null
      const station = createGameStation(draft.stations.length, longitude, latitude)
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      draft.stations.push(station)
      if (previousLast && routeCoordinates?.length) setRouteSegment(draft, previousLast, station, routeCoordinates, draft.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      mapAction.value = { kind: 'NONE' }
      return station
    }

    if (action.kind === 'INSERT_AFTER') {
      const index = draft.stations.findIndex(item => item.id === action.stationId)
      if (index < 0) return null
      const previousStation = draft.stations[index]!
      const station = createGameStation(index + 1, longitude, latitude)
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      draft.stations.splice(index + 1, 0, station)
      if (routeCoordinates?.length) setRouteSegment(draft, previousStation, station, routeCoordinates, draft.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      mapAction.value = { kind: 'NONE' }
      return station
    }

    if (action.kind === 'CREATE_BRANCH') {
      const branchAnchor = findLineStation(draft, action.stationId)
      if (!branchAnchor) return null
      const station = createGameStation(getLineAllStations(draft).length, longitude, latitude)
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      const branches = getLineBranches(draft)
      draft.branches = branches
      branches.push({ id: createBranchId(), fromStationId: action.stationId, stations: [station] })
      if (routeCoordinates?.length) setRouteSegment(draft, branchAnchor, station, routeCoordinates, draft.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      editSelectedStationId.value = station.id
      mapAction.value = { kind: 'NONE' }
      return station
    }

    if (action.kind === 'APPEND_BRANCH') {
      const branch = getLineBranches(draft).find(item => item.id === action.branchId)
      if (!branch) return null
      const branchAnchor = branch.stations.at(-1) ?? findLineStation(draft, branch.fromStationId)
      const station = createGameStation(getLineAllStations(draft).length, longitude, latitude)
      station.name = suggestedName.trim().slice(0, 60) || 'Nouvelle station'
      station.sharedStationId = station.id
      branch.stations.push(station)
      if (branchAnchor && routeCoordinates?.length) setRouteSegment(draft, branchAnchor, station, routeCoordinates, draft.routingMode === 'FREE' ? 'FREE' : 'ASSISTED')
      pruneOrphanRouteSegments(draft)
      clearDraftGuidePoints()
      pendingStationNaming.value = { lineId: draft.id, stationId: station.id, suggestedName: station.name, outsideLoadedTerritory }
      editSelectedStationId.value = station.id
      mapAction.value = { kind: 'NONE' }
      return station
    }

    const station = findLineStation(draft, action.stationId)
    if (!station) return null
    removeRouteSegmentsTouching(draft, [station.id])
    station.longitude = longitude
    station.latitude = latitude
    pruneOrphanRouteSegments(draft)
    clearDraftGuidePoints()
    mapAction.value = { kind: 'NONE' }
    return station
  }

  async function commitLineEdit() {
    assertWritable()
    const save = game.state.value.save
    const original = editingLine.value
    const draft = editDraft.value
    if (!save || !original || !draft || draft.stations.length < 2) return false

    const amount = calculateModificationEstimate(original, draft)
    const originalStationIds = new Set(getLineAllStations(original).map(station => station.id))
    const draftStationIds = new Set(getLineAllStations(draft).map(station => station.id))
    const addedStations = [...draftStationIds].filter(id => !originalStationIds.has(id)).length
    const removedStations = [...originalStationIds].filter(id => !draftStationIds.has(id)).length

    const preservedCost = original.constructionCost
    if (amount > 0) {
      const transaction = applyLineModificationCost(save.data.economy, original, amount)
      if (!transaction) return false
    }

    Object.assign(original, cloneLine(draft))
    original.constructionCost = preservedCost + amount
    original.estimatedConstructionCost = original.constructionCost
    if (amount > 0) {
      original.status = 'CONSTRUCTION'
      original.constructionDaysRemaining = Math.max(1, Math.ceil(Math.min(6, amount / 150_000_000)))
    }
    original.updatedAt = new Date().toISOString()
    registerLineModification(save, addedStations, removedStations)
    cancelLineEdit()
    await game.persistCurrentGame()
    return true
  }

  async function commitLineEditDetailed(): Promise<GameProjectActionResult> {
    assertWritable()
    const validation = editProjectValidation.value
    if (!validation.ok) return validation
    const ok = await commitLineEdit()
    return ok ? { ok: true } : { ok: false, code: 'INVALID_PROJECT', message: 'Les modifications n’ont pas pu être validées.' }
  }

  async function deleteLine(id: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return
    const removedLine = save.data.network.lines.find(line => line.id === id)
    if (removedLine && removedLine.status !== 'PROJECT') registerLineDeleted(save, getLineAllStations(removedLine).length, removedLine.name)
    save.data.network.lines = save.data.network.lines.filter(line => line.id !== id)
    save.data.simulation.lineStates = save.data.simulation.lineStates.filter(state => state.lineId !== id)
    save.data.objectives.active = save.data.objectives.active.filter(objective => objective.lineId !== id)
    if (activeLineId.value === id) activeLineId.value = null
    if (editingLineId.value === id) cancelLineEdit()
    delete save.data.economy.customFarePolicy.lineTicketPrices[id]
    await game.persistCurrentGame()
  }

  return {
    lines,
    displayLines,
    activeProjectEstimate,
    editProjectEstimate,
    previewDraftAt,
    activeProjectValidation,
    editProjectValidation,
    activeLine,
    activeLineId,
    editingLine,
    editingLineId,
    editDraft,
    editSelectedStationId,
    editSelectedStation,
    mapAction,
    pendingStationNaming,
    draftGuidePoints,
    routeGuideMode,
    isBuilding,
    isEditing,
    canUndoDraft,
    canRedoDraft,
    undoDraft,
    redoDraft,
    setDraftRoutingMode,
    toggleRouteGuideMode,
    addDraftGuidePoint,
    removeLastDraftGuidePoint,
    clearDraftGuidePoints,
    startLine,
    addStation,
    finalizePendingStationName,
    cancelPendingStationName,
    useExistingStation,
    handleMapClick,
    finishLine,
    finishLineDetailed,
    cancelActiveLine,
    renameLine,
    setLineIdentity,
    setLineCustomLogo,
    renameStation,
    setInfrastructureType,
    setLineServiceLevel,
    setServiceProfileMode,
    setServiceProfileLevel,
    beginEditLine,
    cancelLineEdit,
    requestAppendStation,
    requestPrependStation,
    requestInsertOnTrace,
    requestInsertAfter,
    requestContinueFromStation,
    requestMoveStation,
    clearEditMapAction,
    canRemoveDraftStation,
    removeDraftStation,
    commitLineEdit,
    commitLineEditDetailed,
    deleteLine,
  }
}
