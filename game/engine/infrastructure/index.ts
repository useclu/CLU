import {
  GAME_INFRASTRUCTURE_MAX_LEVEL,
  GAME_INFRASTRUCTURE_MIN_UPGRADE_COST,
  getInfrastructureUpgradeDefinition,
  normalizeInfrastructureUpgradeLevel,
} from '../../config/infrastructure'
import { getModeEconomyDefinition } from '../../config/economy'
import { distanceBetweenStationsKm } from '../economy'
import { getLineServiceRoutes } from '../network/geometry'
import type {
  GameInfrastructureSegmentState,
  GameInfrastructureUpgradeKey,
  GameLine,
  GameStation,
} from '../../types/network'

export interface GameInfrastructureSegmentRuntime extends GameInfrastructureSegmentState {
  fromStationName: string
  toStationName: string
  lengthKm: number
  capacityMultiplier: number
  speedMultiplier: number
  reliabilityScore: number
  totalLevel: number
}

export interface GameInfrastructureLineProfile {
  segmentCount: number
  modernizedSegmentCount: number
  capacityMultiplier: number
  speedMultiplier: number
  reliabilityScore: number
  operatingCostMultiplier: number
  segments: GameInfrastructureSegmentRuntime[]
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

function normalizedState(raw?: Partial<GameInfrastructureSegmentState> | null): GameInfrastructureSegmentState {
  return {
    fromStationId: String(raw?.fromStationId ?? ''),
    toStationId: String(raw?.toStationId ?? ''),
    capacityLevel: normalizeInfrastructureUpgradeLevel(raw?.capacityLevel),
    speedLevel: normalizeInfrastructureUpgradeLevel(raw?.speedLevel),
    reliabilityLevel: normalizeInfrastructureUpgradeLevel(raw?.reliabilityLevel),
  }
}

export function listInfrastructureSegments(line: Pick<GameLine, 'stations' | 'branches' | 'infrastructureSegments'>): GameInfrastructureSegmentRuntime[] {
  const saved = new Map<string, GameInfrastructureSegmentState>()
  for (const raw of line.infrastructureSegments ?? []) {
    if (!raw?.fromStationId || !raw?.toStationId || raw.fromStationId === raw.toStationId) continue
    saved.set(pairKey(raw.fromStationId, raw.toStationId), normalizedState(raw))
  }

  const byPair = new Map<string, { from: GameStation; to: GameStation }>()
  for (const route of getLineServiceRoutes(line)) {
    for (let index = 1; index < route.length; index += 1) {
      const from = route[index - 1]
      const to = route[index]
      if (!from || !to || from.id === to.id) continue
      const key = pairKey(from.id, to.id)
      if (!byPair.has(key)) byPair.set(key, { from, to })
    }
  }

  return [...byPair.entries()].map(([key, pair]) => {
    const state = saved.get(key) ?? {
      fromStationId: pair.from.id,
      toStationId: pair.to.id,
      capacityLevel: 0,
      speedLevel: 0,
      reliabilityLevel: 0,
    }
    const capacityLevel = normalizeInfrastructureUpgradeLevel(state.capacityLevel)
    const speedLevel = normalizeInfrastructureUpgradeLevel(state.speedLevel)
    const reliabilityLevel = normalizeInfrastructureUpgradeLevel(state.reliabilityLevel)
    return {
      fromStationId: pair.from.id,
      toStationId: pair.to.id,
      fromStationName: pair.from.name,
      toStationName: pair.to.name,
      lengthKm: distanceBetweenStationsKm(pair.from, pair.to),
      capacityLevel,
      speedLevel,
      reliabilityLevel,
      capacityMultiplier: 1 + capacityLevel * 0.15,
      speedMultiplier: 1 + speedLevel * 0.06,
      reliabilityScore: Math.min(100, 76 + reliabilityLevel * 8),
      totalLevel: capacityLevel + speedLevel + reliabilityLevel,
    }
  })
}

export function calculateInfrastructureLineProfile(line: Pick<GameLine, 'stations' | 'branches' | 'infrastructureSegments'>): GameInfrastructureLineProfile {
  const segments = listInfrastructureSegments(line)
  if (!segments.length) {
    return {
      segmentCount: 0,
      modernizedSegmentCount: 0,
      capacityMultiplier: 1,
      speedMultiplier: 1,
      reliabilityScore: 76,
      operatingCostMultiplier: 1,
      segments: [],
    }
  }
  const totalLength = Math.max(0.001, segments.reduce((sum, segment) => sum + Math.max(0.001, segment.lengthKm), 0))
  const speedMultiplier = segments.reduce((sum, segment) => sum + segment.speedMultiplier * Math.max(0.001, segment.lengthKm), 0) / totalLength
  const reliabilityScore = segments.reduce((sum, segment) => sum + segment.reliabilityScore * Math.max(0.001, segment.lengthKm), 0) / totalLength
  const capacityMultiplier = segments.reduce((sum, segment) => sum + segment.capacityMultiplier * Math.max(0.001, segment.lengthKm), 0) / totalLength
  const averageLevel = segments.reduce((sum, segment) => sum + segment.totalLevel, 0) / segments.length
  return {
    segmentCount: segments.length,
    modernizedSegmentCount: segments.filter(segment => segment.totalLevel > 0).length,
    capacityMultiplier,
    speedMultiplier,
    reliabilityScore,
    operatingCostMultiplier: 1 + Math.min(0.12, averageLevel * 0.012),
    segments,
  }
}

export function infrastructureSegmentState(
  line: Pick<GameLine, 'stations' | 'branches' | 'infrastructureSegments'>,
  fromStationId: string,
  toStationId: string,
) {
  const key = pairKey(fromStationId, toStationId)
  return listInfrastructureSegments(line).find(segment => pairKey(segment.fromStationId, segment.toStationId) === key) ?? null
}

export function calculateInfrastructureUpgradeCost(
  line: Pick<GameLine, 'mode' | 'stations' | 'branches' | 'infrastructureSegments'>,
  fromStationId: string,
  toStationId: string,
  key: GameInfrastructureUpgradeKey,
) {
  const segment = infrastructureSegmentState(line, fromStationId, toStationId)
  if (!segment) return 0
  const current = key === 'capacity' ? segment.capacityLevel : key === 'speed' ? segment.speedLevel : segment.reliabilityLevel
  if (current >= GAME_INFRASTRUCTURE_MAX_LEVEL) return 0
  const definition = getInfrastructureUpgradeDefinition(key)
  const economy = getModeEconomyDefinition(line.mode)
  const replacementValue = economy.infrastructurePerKm * Math.max(0.12, segment.lengthKm)
  const progression = 1 + current * 0.45
  return Math.max(
    GAME_INFRASTRUCTURE_MIN_UPGRADE_COST[line.mode],
    Math.round(replacementValue * definition.costShare * progression),
  )
}

export function applyInfrastructureLevel(
  line: GameLine,
  fromStationId: string,
  toStationId: string,
  key: GameInfrastructureUpgradeKey,
) {
  const segment = infrastructureSegmentState(line, fromStationId, toStationId)
  if (!segment) return false
  const current = key === 'capacity' ? segment.capacityLevel : key === 'speed' ? segment.speedLevel : segment.reliabilityLevel
  if (current >= GAME_INFRASTRUCTURE_MAX_LEVEL) return false
  const pair = pairKey(fromStationId, toStationId)
  const existing = (line.infrastructureSegments ?? []).find(item => pairKey(item.fromStationId, item.toStationId) === pair)
  if (existing) {
    if (key === 'capacity') existing.capacityLevel = current + 1
    else if (key === 'speed') existing.speedLevel = current + 1
    else existing.reliabilityLevel = current + 1
  }
  else {
    line.infrastructureSegments = [
      ...(line.infrastructureSegments ?? []),
      {
        fromStationId: segment.fromStationId,
        toStationId: segment.toStationId,
        capacityLevel: key === 'capacity' ? 1 : 0,
        speedLevel: key === 'speed' ? 1 : 0,
        reliabilityLevel: key === 'reliability' ? 1 : 0,
      },
    ]
  }
  return true
}
