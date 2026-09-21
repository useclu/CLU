import {
  getServiceLevelDefinition,
} from '../../config/operations'

import {
  GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL,
  getRollingStockDefinition,
  getRollingStockUpgradeDefinition,
  normalizeRollingStockUpgrades,
} from '../../config/rollingStock'

import {
  getModeSimulationDefinition,
} from '../../config/simulation'

import {
  distanceBetweenStationsKm,
} from '../economy'

import { getLineServiceRoutes } from '../network/geometry'

import type {
  GameLine,
  GameRollingStockUpgradeKey,
  GameServiceLevel,
  GameStation,
  GameTransportMode,
} from '../../types/network'

interface GameLineServiceShape {
  mode: GameTransportMode
  serviceLevel: GameServiceLevel
  stations: GameStation[]
  branches?: GameLine['branches']
  rollingStockUpgrades?: GameLine['rollingStockUpgrades']
}

export interface GameRollingStockPerformance {
  generation: string
  capacityMultiplier: number
  speedMultiplier: number
  reliabilityMultiplier: number
  maintenanceCostMultiplier: number
  operatingCostMultiplier: number
  dwellTimeMultiplier: number
  totalUpgradeLevels: number
}

function longestServiceRoute(line: Pick<GameLineServiceShape, 'stations' | 'branches'>) {
  let best = line.stations
  let bestLength = 0
  for (const route of getLineServiceRoutes(line)) {
    let length = 0
    for (let index = 1; index < route.length; index += 1) {
      const previous = route[index - 1]
      const current = route[index]
      if (previous && current) length += distanceBetweenStationsKm(previous, current)
    }
    if (length > bestLength) {
      best = route
      bestLength = length
    }
  }
  return { route: best, lengthKm: bestLength }
}

export function calculateRollingStockLineLengthKm(
  line: Pick<GameLineServiceShape, 'stations' | 'branches'>,
) {
  return longestServiceRoute(line).lengthKm
}

export function rollingStockPerformance(
  line: Pick<GameLineServiceShape, 'rollingStockUpgrades'>,
): GameRollingStockPerformance {
  const upgrades = normalizeRollingStockUpgrades(line.rollingStockUpgrades)
  const totalUpgradeLevels = Object.values(upgrades).reduce((total, value) => total + value, 0)

  let generation = 'Classique'
  if (totalUpgradeLevels >= 11) generation = 'Nouvelle génération'
  else if (totalUpgradeLevels >= 7) generation = 'Haute performance'
  else if (totalUpgradeLevels >= 3) generation = 'Modernisé'

  return {
    generation,
    capacityMultiplier: 1 + upgrades.capacity * 0.10,
    speedMultiplier: 1 + upgrades.speed * 0.06,
    reliabilityMultiplier: Math.max(0.45, 1 - upgrades.reliability * 0.16),
    maintenanceCostMultiplier: Math.max(0.68, 1 - upgrades.efficiency * 0.08),
    operatingCostMultiplier: Math.max(0.82, 1 - upgrades.efficiency * 0.04),
    dwellTimeMultiplier: Math.max(0.72, 1 - upgrades.boarding * 0.07),
    totalUpgradeLevels,
  }
}

export function effectiveVehicleCapacity(
  line: Pick<GameLineServiceShape, 'mode' | 'rollingStockUpgrades'>,
) {
  const base = getModeSimulationDefinition(line.mode).vehicleCapacity
  return Math.max(1, Math.round(base * rollingStockPerformance(line).capacityMultiplier))
}

export function effectiveAverageSpeedKmH(
  line: Pick<GameLineServiceShape, 'mode' | 'rollingStockUpgrades'>,
) {
  const base = getModeSimulationDefinition(line.mode).averageSpeedKmH
  return base * rollingStockPerformance(line).speedMultiplier
}

/**
 * Temps commercial aller simple : trajet pur + une petite composante d'arrêt.
 * L'amélioration "embarquement" ne transforme pas une ligne en TGV ; elle
 * réduit seulement la partie perdue aux stations.
 */
export function calculateOneWayTravelTimeMinutes(
  line: GameLineServiceShape,
) {
  const serviceRoute = longestServiceRoute(line)
  const lengthKm = serviceRoute.lengthKm
  const speed = effectiveAverageSpeedKmH(line)
  if (lengthKm <= 0 || speed <= 0) return 0

  const runningMinutes = lengthKm / speed * 60
  const intermediateStops = Math.max(0, serviceRoute.route.length - 2)
  const dwellMinutes = intermediateStops * 0.45 * rollingStockPerformance(line).dwellTimeMultiplier
  return runningMinutes + dwellMinutes
}

export function calculateRoundTripMinutes(
  line: GameLineServiceShape,
) {
  const rollingStock = getRollingStockDefinition(line.mode)
  const oneWay = calculateOneWayTravelTimeMinutes(line)
  return Math.max(
    rollingStock.turnaroundMinutes,
    oneWay * 2 + rollingStock.turnaroundMinutes,
  )
}

export function calculateTargetDeparturesPerHour(
  line: GameLineServiceShape,
  serviceLevel: GameServiceLevel = line.serviceLevel,
) {
  const simulation = getModeSimulationDefinition(line.mode)
  const service = getServiceLevelDefinition(serviceLevel)
  return Math.max(0, simulation.departuresPerHour * service.departuresMultiplier)
}

export function calculateRequiredVehiclesForService(
  line: GameLineServiceShape,
  serviceLevel: GameServiceLevel = line.serviceLevel,
) {
  if (line.stations.length < 2) return 0
  const targetDepartures = calculateTargetDeparturesPerHour(line, serviceLevel)
  const roundTripMinutes = calculateRoundTripMinutes(line)
  if (targetDepartures <= 0 || roundTripMinutes <= 0) return 0
  return Math.max(1, Math.ceil(targetDepartures * roundTripMinutes / 60))
}

export function calculateFleetSupportedDeparturesPerHour(
  line: GameLineServiceShape,
  vehicleCount: number,
) {
  const normalizedVehicles = Math.max(0, Math.floor(vehicleCount))
  if (normalizedVehicles <= 0 || line.stations.length < 2) return 0
  const roundTripMinutes = calculateRoundTripMinutes(line)
  if (roundTripMinutes <= 0) return 0
  return normalizedVehicles * 60 / roundTripMinutes
}

export function calculateVehiclePurchaseCost(mode: GameTransportMode, vehicleCount: number) {
  const count = Math.max(0, Math.floor(vehicleCount))
  return getRollingStockDefinition(mode).purchaseCost * count
}

export function calculateRollingStockUpgradeCost(
  line: Pick<GameLine, 'mode' | 'vehicleCount' | 'rollingStockUpgrades' | 'serviceLevel' | 'stations' | 'branches'>,
  key: GameRollingStockUpgradeKey,
) {
  const levels = normalizeRollingStockUpgrades(line.rollingStockUpgrades)
  const currentLevel = levels[key]
  if (currentLevel >= GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL) return 0

  const definition = getRollingStockUpgradeDefinition(key)
  const unitCost = getRollingStockDefinition(line.mode).purchaseCost
  const referenceFleet = Math.max(
    1,
    Math.max(
      Math.floor(line.vehicleCount ?? 0),
      calculateRequiredVehiclesForService(line, line.serviceLevel),
    ),
  )
  const progression = 1 + currentLevel * 0.38
  return Math.max(100_000, Math.round(unitCost * referenceFleet * definition.costRate * progression))
}

export function calculateReserveVehicles(
  line: Pick<GameLine, 'vehicleCount' | 'serviceLevel' | 'stations' | 'branches' | 'mode' | 'rollingStockUpgrades'>,
) {
  const required = calculateRequiredVehiclesForService(line, line.serviceLevel)
  return Math.max(0, Math.floor(line.vehicleCount ?? 0) - required)
}

export function calculateActiveBoostVehicles(
  line: Pick<GameLine, 'vehicleCount' | 'serviceLevel' | 'stations' | 'branches' | 'mode' | 'rollingStockUpgrades' | 'regulationMode' | 'manualBoostVehicles'>,
  availableVehicles: number,
  waitingPassengersBefore = 0,
) {
  const required = calculateRequiredVehiclesForService(line, line.serviceLevel)
  const reserve = Math.max(0, Math.min(
    Math.floor(line.vehicleCount ?? 0) - required,
    Math.floor(availableVehicles) - Math.min(required, Math.floor(availableVehicles)),
  ))
  if (reserve <= 0) return 0

  if (line.regulationMode === 'MANUAL') {
    return Math.min(reserve, Math.max(0, Math.floor(line.manualBoostVehicles ?? 0)))
  }

  // Auto : n'utilise la réserve que si la veille a réellement laissé une file.
  if (waitingPassengersBefore <= 0) return 0
  if (waitingPassengersBefore >= 4_000) return Math.min(reserve, Math.max(1, Math.ceil(reserve * 0.75)))
  if (waitingPassengersBefore >= 800) return Math.min(reserve, Math.max(1, Math.ceil(reserve * 0.5)))
  return Math.min(reserve, 1)
}

export function calculateRegularityScore(options: {
  line: Pick<GameLine, 'regulationMode' | 'rollingStockUpgrades'>
  requiredVehicles: number
  availableVehicles: number
  unavailableVehicles: number
  serviceFulfillmentRate: number
  activeBoostVehicles: number
}) {
  const performance = rollingStockPerformance(options.line)
  const required = Math.max(1, options.requiredVehicles)
  const reserveRate = Math.max(0, options.availableVehicles - required) / required
  const unavailableRate = options.unavailableVehicles / Math.max(1, options.availableVehicles + options.unavailableVehicles)

  return Math.min(100, Math.max(0,
    78
    + (options.line.regulationMode === 'AUTO' ? 8 : 2)
    + Math.min(7, reserveRate * 35)
    + (1 - performance.reliabilityMultiplier) * 22
    + Math.min(4, options.activeBoostVehicles * 1.5)
    - unavailableRate * 70
    - Math.max(0, 1 - options.serviceFulfillmentRate) * 55,
  ))
}
