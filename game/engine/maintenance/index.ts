import {
  GAME_DAILY_WEAR_BY_SERVICE_LEVEL,
  GAME_FLEET_OVERHAUL_MAX_VALUE_SHARE,
  getMaintenanceLevelDefinition,
} from '../../config/maintenance'

import {
  getRollingStockDefinition,
} from '../../config/rollingStock'

import {
  rollingStockPerformance,
} from '../rollingStock'

import type {
  GameLine,
} from '../../types/network'

export function normalizeFleetCondition(
  value: number,
) {
  if (!Number.isFinite(value)) {
    return 100
  }

  return Math.max(
    0,
    Math.min(100, value),
  )
}

export function calculateUnavailableVehicleRate(
  line: Pick<
    GameLine,
    'fleetCondition' | 'maintenanceLevel' | 'rollingStockUpgrades'
  >,
) {
  const condition = normalizeFleetCondition(
    line.fleetCondition,
  )

  let baseRate = 0

  if (condition < 25) {
    baseRate = 0.45
  }
  else if (condition < 45) {
    baseRate = 0.28
  }
  else if (condition < 65) {
    baseRate = 0.16
  }
  else if (condition < 80) {
    baseRate = 0.08
  }
  else if (condition < 90) {
    baseRate = 0.03
  }

  return Math.min(
    0.9,
    baseRate
    * getMaintenanceLevelDefinition(
      line.maintenanceLevel,
    ).reliabilityMultiplier
    * rollingStockPerformance(line).reliabilityMultiplier,
  )
}

export function calculateUnavailableVehicles(
  line: Pick<
    GameLine,
    'vehicleCount' | 'fleetCondition' | 'maintenanceLevel' | 'rollingStockUpgrades'
  >,
) {
  const vehicleCount = Math.max(
    0,
    Math.floor(line.vehicleCount ?? 0),
  )

  if (vehicleCount <= 0) {
    return 0
  }

  const rate = calculateUnavailableVehicleRate(line)

  let unavailable = Math.round(
    vehicleCount * rate,
  )

  if (
    normalizeFleetCondition(line.fleetCondition) < 45
    && rate > 0
  ) {
    unavailable = Math.max(1, unavailable)
  }

  return Math.min(
    vehicleCount,
    Math.max(0, unavailable),
  )
}

export function calculateAvailableVehicles(
  line: Pick<
    GameLine,
    'vehicleCount' | 'fleetCondition' | 'maintenanceLevel' | 'rollingStockUpgrades'
  >,
) {
  const vehicleCount = Math.max(
    0,
    Math.floor(line.vehicleCount ?? 0),
  )

  return Math.max(
    0,
    vehicleCount - calculateUnavailableVehicles(line),
  )
}

export function calculateDailyFleetConditionDelta(
  line: Pick<
    GameLine,
    'vehicleCount' | 'serviceLevel' | 'maintenanceLevel'
  >,
  serviceFulfillmentRate = 1,
) {
  if (Math.max(0, line.vehicleCount ?? 0) <= 0) {
    return 0
  }

  const maintenance = getMaintenanceLevelDefinition(
    line.maintenanceLevel,
  )

  const wear = GAME_DAILY_WEAR_BY_SERVICE_LEVEL[
    line.serviceLevel
  ] * Math.max(
    0,
    Math.min(1.4, serviceFulfillmentRate),
  )

  return maintenance.dailyConditionRecovery - wear
}

export function applyDailyFleetMaintenance(
  line: GameLine,
  serviceFulfillmentRate = 1,
) {
  const before = normalizeFleetCondition(
    line.fleetCondition,
  )

  const delta = calculateDailyFleetConditionDelta(
    line,
    serviceFulfillmentRate,
  )

  const after = normalizeFleetCondition(
    before + delta,
  )

  line.fleetCondition = after
  line.updatedAt = new Date().toISOString()

  return {
    before,
    after,
    delta: after - before,
  }
}

export function calculateFleetOverhaulCost(
  line: Pick<
    GameLine,
    'mode' | 'vehicleCount' | 'fleetCondition'
  >,
) {
  const vehicleCount = Math.max(
    0,
    Math.floor(line.vehicleCount ?? 0),
  )

  if (vehicleCount <= 0) {
    return 0
  }

  const missingCondition = Math.max(
    0,
    100 - normalizeFleetCondition(line.fleetCondition),
  ) / 100

  if (missingCondition <= 0.001) {
    return 0
  }

  const fleetValue =
    vehicleCount
    * getRollingStockDefinition(line.mode).purchaseCost

  return Math.max(
    0,
    Math.round(
      fleetValue
      * GAME_FLEET_OVERHAUL_MAX_VALUE_SHARE
      * missingCondition,
    ),
  )
}

export function fleetConditionLabel(
  conditionValue: number,
) {
  const condition = normalizeFleetCondition(conditionValue)

  if (condition >= 90) {
    return 'Excellent'
  }

  if (condition >= 80) {
    return 'Bon'
  }

  if (condition >= 65) {
    return 'À surveiller'
  }

  if (condition >= 45) {
    return 'Dégradé'
  }

  if (condition >= 25) {
    return 'Mauvais'
  }

  return 'Critique'
}
