import {
  GAME_STATION_BASE_DAILY_CAPACITY,
  getStationFacilityDefinition,
  stationDemandMultiplier,
} from '../../config/stations'

import {
  getModeEconomyDefinition,
} from '../../config/economy'

import {
  getModeSimulationDefinition,
} from '../../config/simulation'

import {
  isOperationalLine,
} from '../network'

import { getLineAllStations } from '../network/geometry'

import type {
  GameLine,
  GameNetworkState,
  GameStation,
  GameStationFacilityLevel,
} from '../../types/network'

export interface GameStationRuntimeResult {
  stationId: string
  stationName: string
  facilityLevel: GameStationFacilityLevel
  interchangeLineCount: number
  dailyCapacity: number
  estimatedFootfall: number
  utilizationRate: number
  score: number
}


export type GameStationInterchangeIndex = Map<string, number>

const STATION_PROXIMITY_EPSILON = 0.00001

function stationInterchangeKey(lineId: string, stationId: string) {
  return `${lineId}\u0000${stationId}`
}

/**
 * Pré-calcule les correspondances de tout le réseau une seule fois.
 * Le calcul historique reparcourait toutes les lignes et toutes leurs stations
 * pour chaque station simulée ; cet index conserve les mêmes règles tout en
 * évitant ce coût quadratique pendant la simulation quotidienne.
 */
export function buildStationInterchangeIndex(
  network: GameNetworkState,
): GameStationInterchangeIndex {
  const operationalLines = network.lines.filter(isOperationalLine)
  const operationalLineIds = new Set(operationalLines.map(line => line.id))
  const connections = new Map<string, Set<string>>()

  const connect = (lineId: string, stationId: string, otherLineId: string) => {
    if (lineId === otherLineId) return
    const key = stationInterchangeKey(lineId, stationId)
    let set = connections.get(key)
    if (!set) {
      set = new Set<string>()
      connections.set(key, set)
    }
    set.add(otherLineId)
  }

  // Les transferts piétons sont explicites : ils peuvent relier deux stations
  // sans proximité géographique. Comme l'ancien calcul, on ne compte que les
  // lignes actuellement opérationnelles.
  for (const transfer of network.walkingTransfers ?? []) {
    if (operationalLineIds.has(transfer.toLineId)) {
      connect(transfer.fromLineId, transfer.fromStationId, transfer.toLineId)
    }
    if (operationalLineIds.has(transfer.fromLineId)) {
      connect(transfer.toLineId, transfer.toStationId, transfer.fromLineId)
    }
  }

  const sharedGroups = new Map<string, Array<{ lineId: string; station: GameStation }>>()
  const spatialBuckets = new Map<string, Array<{ lineId: string; station: GameStation }>>()

  const bucketKey = (longitude: number, latitude: number) => {
    const x = Math.floor(longitude / STATION_PROXIMITY_EPSILON)
    const y = Math.floor(latitude / STATION_PROXIMITY_EPSILON)
    return `${x}:${y}`
  }

  for (const line of operationalLines) {
    for (const station of getLineAllStations(line)) {
      if (station.sharedStationId) {
        const group = sharedGroups.get(station.sharedStationId) ?? []
        group.push({ lineId: line.id, station })
        sharedGroups.set(station.sharedStationId, group)
      }

      if (!Number.isFinite(station.longitude) || !Number.isFinite(station.latitude)) continue
      const x = Math.floor(station.longitude / STATION_PROXIMITY_EPSILON)
      const y = Math.floor(station.latitude / STATION_PROXIMITY_EPSILON)

      // Comparer uniquement avec les stations déjà indexées dans les 9 cellules
      // voisines suffit pour reproduire le test de proximité ±0.00001°.
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const candidates = spatialBuckets.get(`${x + dx}:${y + dy}`)
          if (!candidates) continue
          for (const candidate of candidates) {
            if (candidate.lineId === line.id) continue
            // Règle historique : lorsque les deux stations ont un identifiant
            // partagé, seule l'égalité de cet identifiant décide du lien.
            if (station.sharedStationId && candidate.station.sharedStationId) continue
            if (
              Math.abs(station.longitude - candidate.station.longitude) <= STATION_PROXIMITY_EPSILON
              && Math.abs(station.latitude - candidate.station.latitude) <= STATION_PROXIMITY_EPSILON
            ) {
              connect(line.id, station.id, candidate.lineId)
              connect(candidate.lineId, candidate.station.id, line.id)
            }
          }
        }
      }

      const key = bucketKey(station.longitude, station.latitude)
      const bucket = spatialBuckets.get(key) ?? []
      bucket.push({ lineId: line.id, station })
      spatialBuckets.set(key, bucket)
    }
  }

  for (const group of sharedGroups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      const current = group[i]!
      for (let j = i + 1; j < group.length; j += 1) {
        const other = group[j]!
        if (current.lineId === other.lineId) continue
        connect(current.lineId, current.station.id, other.lineId)
        connect(other.lineId, other.station.id, current.lineId)
      }
    }
  }

  const result: GameStationInterchangeIndex = new Map()
  for (const [key, lineIds] of connections) result.set(key, lineIds.size)
  return result
}

export interface GameLineStationExperience {
  score: number
  demandMultiplier: number
  operatingCost: number
  congestedStationCount: number
  interchangeStationCount: number
  busiestStationUtilization: number
  busiestStationName: string | null
  stations: GameStationRuntimeResult[]
}

function clampScore(
  value: number,
) {
  return Math.min(100, Math.max(0, value))
}

function scoreCongestion(
  utilization: number,
) {
  if (utilization <= 0.65) return 95
  if (utilization <= 0.9) {
    return 95 - (utilization - 0.65) / 0.25 * 12
  }
  if (utilization <= 1.1) {
    return 83 - (utilization - 0.9) / 0.2 * 18
  }
  if (utilization <= 1.5) {
    return 65 - (utilization - 1.1) / 0.4 * 25
  }

  return Math.max(
    12,
    40 - (utilization - 1.5) * 25,
  )
}

function interchangeScore(
  level: GameStationFacilityLevel,
  interchangeLineCount: number,
) {
  if (interchangeLineCount <= 0) {
    return 82
  }

  if (level === 'HUB') {
    return 98
  }

  if (level === 'STANDARD') {
    return 88
  }

  return 58
}

export function countStationInterchangeLines(
  network: GameNetworkState,
  lineId: string,
  station: GameStation,
) {
  const connectedLineIds = new Set<string>()

  const walkingTargets = new Set(
    (network.walkingTransfers ?? [])
      .flatMap(transfer => {
        if (transfer.fromLineId === lineId && transfer.fromStationId === station.id) return [transfer.toLineId]
        if (transfer.toLineId === lineId && transfer.toStationId === station.id) return [transfer.fromLineId]
        return []
      }),
  )

  for (const otherLine of network.lines) {
    if (otherLine.id === lineId || !isOperationalLine(otherLine)) continue

    const physicallyShared = getLineAllStations(otherLine).some(otherStation => {
      if (station.sharedStationId && otherStation.sharedStationId) {
        return station.sharedStationId === otherStation.sharedStationId
      }
      return Math.abs(station.longitude - otherStation.longitude) <= 0.00001
        && Math.abs(station.latitude - otherStation.latitude) <= 0.00001
    })

    if (physicallyShared || walkingTargets.has(otherLine.id)) connectedLineIds.add(otherLine.id)
  }

  return connectedLineIds.size
}

export function calculateStationDailyCapacity(
  line: GameLine,
  station: GameStation,
) {
  const level = station.facilityLevel ?? 'STANDARD'
  const definition = getStationFacilityDefinition(level)

  return Math.round(
    GAME_STATION_BASE_DAILY_CAPACITY[line.mode]
    * definition.capacityMultiplier,
  )
}

export function calculateStationUpgradeCost(
  line: GameLine,
  targetLevel: GameStationFacilityLevel,
) {
  const facility = getStationFacilityDefinition(targetLevel)
  const stationConstructionCost = getModeEconomyDefinition(
    line.mode,
  ).stationCost

  return Math.max(
    0,
    Math.round(
      stationConstructionCost
      * facility.upgradeCostMultiplier,
    ),
  )
}

export function calculateLineStationExperience(
  line: GameLine,
  network: GameNetworkState,
  demandPassengers: number,
  interchangeIndex?: GameStationInterchangeIndex,
): GameLineStationExperience {
  const allStations = getLineAllStations(line)
  if (allStations.length === 0) {
    return {
      score: 82,
      demandMultiplier: 1,
      operatingCost: 0,
      congestedStationCount: 0,
      interchangeStationCount: 0,
      busiestStationUtilization: 0,
      busiestStationName: null,
      stations: [],
    }
  }

  const baseStationOperatingCost =
    getModeSimulationDefinition(
      line.mode,
    ).operatingCostPerStationPerDay

  const baseFootfall = Math.max(
    0,
    demandPassengers,
  ) * 2 / allStations.length

  const stationResults: GameStationRuntimeResult[] = []
  let totalWeight = 0
  let weightedScore = 0
  let operatingCostBeforeRounding = 0
  let congestedStationCount = 0
  let interchangeStationCount = 0
  let busiestStation: GameStationRuntimeResult | null = null

  for (const station of allStations) {
    const level = station.facilityLevel ?? 'STANDARD'
    const facility = getStationFacilityDefinition(level)
    const interchangeLineCount = interchangeIndex?.get(
      stationInterchangeKey(line.id, station.id),
    ) ?? countStationInterchangeLines(
      network,
      line.id,
      station,
    )

    const transferFootfallMultiplier = 1 + Math.min(
      1,
      interchangeLineCount * 0.28,
    )

    const estimatedFootfall = Math.max(
      0,
      Math.round(
        baseFootfall * transferFootfallMultiplier,
      ),
    )

    const dailyCapacity = calculateStationDailyCapacity(
      line,
      station,
    )

    const utilizationRate = dailyCapacity > 0
      ? estimatedFootfall / dailyCapacity
      : estimatedFootfall > 0
        ? 3
        : 0

    const congestion = scoreCongestion(utilizationRate)
    const interchange = interchangeScore(
      level,
      interchangeLineCount,
    )

    const score = clampScore(
      facility.facilityScore * 0.30
      + facility.accessibilityScore * 0.24
      + congestion * 0.34
      + interchange * 0.12,
    )

    const result: GameStationRuntimeResult = {
      stationId: station.id,
      stationName: station.name,
      facilityLevel: level,
      interchangeLineCount,
      dailyCapacity,
      estimatedFootfall,
      utilizationRate,
      score,
    }
    stationResults.push(result)

    const weight = Math.max(1, estimatedFootfall)
    totalWeight += weight
    weightedScore += score * weight
    operatingCostBeforeRounding += baseStationOperatingCost * facility.operatingCostMultiplier
    if (utilizationRate > 1) congestedStationCount += 1
    if (interchangeLineCount > 0) interchangeStationCount += 1
    if (!busiestStation || utilizationRate > busiestStation.utilizationRate) busiestStation = result
  }

  const score = totalWeight > 0
    ? weightedScore / totalWeight
    : 82

  const operatingCost = Math.round(operatingCostBeforeRounding)

  return {
    score,
    demandMultiplier: stationDemandMultiplier(score),
    operatingCost,
    congestedStationCount,
    interchangeStationCount,
    busiestStationUtilization:
      busiestStation?.utilizationRate ?? 0,
    busiestStationName:
      busiestStation?.stationName ?? null,
    stations: stationResults,
  }
}
