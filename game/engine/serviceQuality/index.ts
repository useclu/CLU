import {
  GAME_IDEAL_MIN_STATION_SPACING_KM,
  clampServiceQualityScore,
  serviceQualityDemandMultiplier,
} from '../../config/serviceQuality'

import type {
  GameTransportMode,
} from '../../types/network'

import type {
  GameServiceQualityResult,
} from '../../types/serviceQuality'

function clamp01(
  value: number,
) {
  return Math.min(1, Math.max(0, value))
}

function scoreFrequency(
  departuresPerHour: number,
  baseDeparturesPerHour: number,
) {
  if (baseDeparturesPerHour <= 0) {
    return 50
  }

  const ratio = Math.max(
    0,
    departuresPerHour / baseDeparturesPerHour,
  )

  const base = 35 + 45 * Math.min(1, ratio)
  const bonus = 15 * clamp01(
    (ratio - 1) / 0.7,
  )

  return clampServiceQualityScore(base + bonus)
}

function scoreReliability(
  fleetCondition: number,
  serviceFulfillmentRate: number,
) {
  const condition = clampServiceQualityScore(
    fleetCondition,
  )

  const fulfillment = clamp01(
    serviceFulfillmentRate,
  ) * 100

  return clampServiceQualityScore(
    condition * 0.62 + fulfillment * 0.38,
  )
}

function scoreCrowding(
  projectedOccupancyRate: number,
) {
  const occupancy = Math.max(
    0,
    projectedOccupancyRate,
  )

  if (occupancy <= 0.55) {
    return 92
  }

  if (occupancy <= 0.8) {
    return 92 - (occupancy - 0.55) / 0.25 * 10
  }

  if (occupancy <= 1) {
    return 82 - (occupancy - 0.8) / 0.2 * 14
  }

  if (occupancy <= 1.25) {
    return 68 - (occupancy - 1) / 0.25 * 18
  }

  if (occupancy <= 1.6) {
    return 50 - (occupancy - 1.25) / 0.35 * 20
  }

  return Math.max(
    15,
    30 - (occupancy - 1.6) * 18,
  )
}

function scoreAffordability(
  fareDemandMultiplier: number,
) {
  return clampServiceQualityScore(
    72 + (fareDemandMultiplier - 1) * 55,
  )
}

function scoreTravelTime(
  mode: GameTransportMode,
  lengthKm: number,
  stationCount: number,
) {
  if (stationCount < 2 || lengthKm <= 0) {
    return 70
  }

  const spacing = lengthKm / (stationCount - 1)
  const idealMinimum = GAME_IDEAL_MIN_STATION_SPACING_KM[mode]

  if (spacing >= idealMinimum) {
    return 90
  }

  const ratio = clamp01(
    spacing / Math.max(0.01, idealMinimum),
  )

  return 62 + ratio * 28
}

function scoreInspectionComfort(
  passengers: number,
  controllerCount: number,
  fraudRate: number,
) {
  const normalizedPassengers = Math.max(
    0,
    passengers,
  )

  const inspectionCoverage = normalizedPassengers > 0
    ? Math.min(
        1,
        controllerCount * 420 / normalizedPassengers,
      )
    : 0

  const fraudPenalty = Math.max(
    0,
    fraudRate,
  ) * 165

  const overControlPenalty = Math.max(
    0,
    inspectionCoverage - 0.12,
  ) * 75

  return clampServiceQualityScore(
    90 - fraudPenalty - overControlPenalty,
  )
}

export interface CalculateServiceQualityOptions {
  mode: GameTransportMode
  lengthKm: number
  stationCount: number
  departuresPerHour: number
  baseDeparturesPerHour: number
  serviceFulfillmentRate: number
  fleetCondition: number
  dailyCapacity: number
  demandBeforeQuality: number
  fareDemandMultiplier: number
  passengersForInspection: number
  controllerCount: number
  fraudRate: number
  stationQualityScore: number
}

export function calculateServiceQuality(
  options: CalculateServiceQualityOptions,
): GameServiceQualityResult {
  const projectedOccupancyRate = options.dailyCapacity > 0
    ? options.demandBeforeQuality / options.dailyCapacity
    : options.demandBeforeQuality > 0
      ? 2
      : 0

  const breakdown = {
    frequency: scoreFrequency(
      options.departuresPerHour,
      options.baseDeparturesPerHour,
    ),
    reliability: scoreReliability(
      options.fleetCondition,
      options.serviceFulfillmentRate,
    ),
    crowding: scoreCrowding(
      projectedOccupancyRate,
    ),
    affordability: scoreAffordability(
      options.fareDemandMultiplier,
    ),
    travelTime: scoreTravelTime(
      options.mode,
      options.lengthKm,
      options.stationCount,
    ),
    inspectionComfort: scoreInspectionComfort(
      options.passengersForInspection,
      options.controllerCount,
      options.fraudRate,
    ),
    stations: clampServiceQualityScore(
      options.stationQualityScore,
    ),
  }

  const score = clampServiceQualityScore(
    breakdown.frequency * 0.20
    + breakdown.reliability * 0.20
    + breakdown.crowding * 0.22
    + breakdown.affordability * 0.14
    + breakdown.travelTime * 0.08
    + breakdown.inspectionComfort * 0.06
    + breakdown.stations * 0.10,
  )

  return {
    score,
    demandMultiplier:
      serviceQualityDemandMultiplier(score),
    projectedOccupancyRate,
    breakdown,
  }
}
