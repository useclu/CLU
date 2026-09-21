import {
  GAME_STATION_BASE_DAILY_CAPACITY,
  GAME_STATION_INTERCHANGE_RADIUS_KM,
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
  distanceBetweenStationsKm,
} from '../economy'

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

  for (const otherLine of network.lines) {
    if (otherLine.id === lineId || !isOperationalLine(otherLine)) {
      continue
    }

    if (
      getLineAllStations(otherLine).some(
        otherStation => distanceBetweenStationsKm(
          station,
          otherStation,
        ) <= GAME_STATION_INTERCHANGE_RADIUS_KM,
      )
    ) {
      connectedLineIds.add(otherLine.id)
    }
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

  const stationResults = allStations.map(
    station => {
      const level = station.facilityLevel ?? 'STANDARD'
      const facility = getStationFacilityDefinition(level)
      const interchangeLineCount = countStationInterchangeLines(
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

      return {
        stationId: station.id,
        stationName: station.name,
        facilityLevel: level,
        interchangeLineCount,
        dailyCapacity,
        estimatedFootfall,
        utilizationRate,
        score,
      }
    },
  )

  const totalWeight = stationResults.reduce(
    (total, station) => total + Math.max(1, station.estimatedFootfall),
    0,
  )

  const score = totalWeight > 0
    ? stationResults.reduce(
        (total, station) => total
          + station.score * Math.max(1, station.estimatedFootfall),
        0,
      ) / totalWeight
    : 82

  const operatingCost = Math.round(
    allStations.reduce(
      (total, station) => {
        const facility = getStationFacilityDefinition(
          station.facilityLevel ?? 'STANDARD',
        )

        return total
          + baseStationOperatingCost
          * facility.operatingCostMultiplier
      },
      0,
    ),
  )

  const busiestStation = stationResults.reduce<
    GameStationRuntimeResult | null
  >(
    (busiest, station) => (
      !busiest
      || station.utilizationRate > busiest.utilizationRate
        ? station
        : busiest
    ),
    null,
  )

  return {
    score,
    demandMultiplier: stationDemandMultiplier(score),
    operatingCost,
    congestedStationCount: stationResults.filter(
      station => station.utilizationRate > 1,
    ).length,
    interchangeStationCount: stationResults.filter(
      station => station.interchangeLineCount > 0,
    ).length,
    busiestStationUtilization:
      busiestStation?.utilizationRate ?? 0,
    busiestStationName:
      busiestStation?.stationName ?? null,
    stations: stationResults,
  }
}
