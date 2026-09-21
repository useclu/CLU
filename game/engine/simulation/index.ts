import { currentGameLocaleTag } from '../../config/i18n'
import {
  GAME_SIMULATION_HISTORY_LIMIT,
  getModeSimulationDefinition,
} from '../../config/simulation'

import {
  gameDayWeekdayIndex,
  isoDateForGameDay,
} from '../../config/calendar'

import {
  getInfrastructureDefinition,
} from '../../config/projects'

import {
  GAME_DEFAULT_CUSTOM_FARE_POLICY,
  calculateCustomFare,
  getFareLevelDefinition,
} from '../../config/fares'

import {
  calculateInspectionResult,
} from '../../config/inspection'

import {
  calculateServiceQuality,
} from '../serviceQuality'

import {
  calculateLineStationExperience,
} from '../stations'

import {
  isOperationalLine,
} from '../network'

import {
  getServiceLevelDefinition,
} from '../../config/operations'

import {
  getRollingStockDefinition,
} from '../../config/rollingStock'

import {
  getMaintenanceLevelDefinition,
} from '../../config/maintenance'

import {
  GAME_DEMAND_COMPETITION_EXPONENT,
  GAME_DEMAND_MULTI_MUNICIPALITY_BONUS,
  GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX,
  getModeDemandDefinition,
} from '../../config/demand'

import {
  distanceBetweenStationsKm,
} from '../economy'

import {
  calculateActiveBoostVehicles,
  calculateFleetSupportedDeparturesPerHour,
  calculateRegularityScore,
  calculateRequiredVehiclesForService,
  effectiveAverageSpeedKmH,
  effectiveVehicleCapacity,
  rollingStockPerformance,
} from '../rollingStock'

import {
  calculateAvailableVehicles,
  calculateUnavailableVehicles,
  normalizeFleetCondition,
} from '../maintenance'

import {
  buildNetworkTerritorySummary,
} from '../territory'

import { getLineAllStations, getLineGeometrySequences, getLineServiceRoutes } from '../network/geometry'
import { getLinePathCoordinateSequences, getSegmentCoordinates } from '../network/pathGeometry'

import type {
  GameCustomFarePolicy,
  GameFareLevel,
  GameFareManagementMode,
} from '../../types/fares'

import type {
  GameEconomyState,
} from '../../types/economy'

import type {
  GameLine,
  GameNetworkState,
} from '../../types/network'

import type {
  GameDemandModel,
  GameLineDailySimulation,
  GameLineDiagnostic,
  GameLineOperationalState,
  GameSimulationDayReport,
  GameSimulationModifiers,
  GameSimulationState,
} from '../../types/simulation'

import type {
  GameLineMunicipalityCoverage,
  GameMunicipality,
  GameNetworkTerritorySummary,
} from '../../types/territory'

export function createEmptySimulation(): GameSimulationState {
  return {
    totalPassengers: 0,
    totalLostPassengers: 0,
    totalRevenue: 0,
    totalOperatingCost: 0,
    totalFraudRevenueLoss: 0,
    totalFineRevenue: 0,
    totalControlCost: 0,
    lineStates: [],
    history: [],
  }
}

export function calculateLineLengthKm(
  line: GameLine,
): number {
  let total = 0
  for (const sequence of getLinePathCoordinateSequences(line)) {
    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1]!
      const current = sequence[index]!
      total += distanceBetweenStationsKm(
        { longitude: previous[0], latitude: previous[1] },
        { longitude: current[0], latitude: current[1] },
      )
    }
  }
  return total
}

function calculateLongestServiceRoute(line: GameLine) {
  let best = { lengthKm: 0, stationCount: line.stations.length }
  for (const route of getLineServiceRoutes(line)) {
    let lengthKm = 0
    for (let index = 1; index < route.length; index += 1) {
      const previous = route[index - 1]
      const current = route[index]
      if (previous && current) {
        const coordinates = getSegmentCoordinates(line, previous, current)
        if (coordinates) {
          for (let pointIndex = 1; pointIndex < coordinates.length; pointIndex += 1) {
            const a = coordinates[pointIndex - 1]!
            const b = coordinates[pointIndex]!
            lengthKm += distanceBetweenStationsKm({ longitude: a[0], latitude: a[1] }, { longitude: b[0], latitude: b[1] })
          }
        }
        else lengthKm += distanceBetweenStationsKm(previous, current)
      }
    }
    if (lengthKm > best.lengthKm) best = { lengthKm, stationCount: route.length }
  }
  return best
}

function calculateFallbackDemand(
  line: GameLine,
  lengthKm: number,
) {
  const definition = getModeSimulationDefinition(
    line.mode,
  )

  return Math.max(
    0,
    Math.round(
      getLineAllStations(line).length
      * definition.passengersPerStationPerDay
      + lengthKm
      * definition.passengersPerKmPerDay,
    ),
  )
}

function calculateStationCoverageMultiplier(
  stationCount: number,
  mode: GameLine['mode'],
) {
  const definition = getModeDemandDefinition(mode)

  return Math.min(
    definition.maxStationCoverageMultiplier,
    1
    + Math.max(0, stationCount - 1)
    * definition.additionalStationCoverage,
  )
}

function calculateTerritorialDemand(
  line: GameLine,
  coverage: GameLineMunicipalityCoverage,
  networkTerritory: GameNetworkTerritorySummary,
) {
  const definition = getModeDemandDefinition(
    line.mode,
  )

  let passengers = 0

  for (const municipality of coverage.municipalities) {
    const networkMunicipality =
      networkTerritory.municipalities.find(
        item => item.code === municipality.code,
      )

    const lineCount = Math.max(
      1,
      networkMunicipality?.lineCount ?? 1,
    )

    const competitionFactor =
      1 / Math.pow(
        lineCount,
        GAME_DEMAND_COMPETITION_EXPONENT,
      )

    const stationCoverage =
      calculateStationCoverageMultiplier(
        municipality.stationCount,
        line.mode,
      )

    passengers +=
      municipality.population
      * definition.dailyPopulationCaptureRate
      * stationCoverage
      * competitionFactor
  }

  const municipalityBonus = 1 + Math.min(
    GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX,
    Math.max(
      0,
      coverage.municipalities.length - 1,
    ) * GAME_DEMAND_MULTI_MUNICIPALITY_BONUS,
  )

  passengers *= municipalityBonus

  passengers +=
    coverage.uncoveredStationCount
    * definition.uncoveredStationFallbackPassengers

  return Math.max(
    0,
    Math.round(passengers),
  )
}

interface SimulateLineOptions {
  network?: GameNetworkState
  territorialDataAvailable: boolean
  territorySummary: GameNetworkTerritorySummary | null
  modifiers: GameSimulationModifiers
  fareLevel: GameFareLevel
  fareManagementMode: GameFareManagementMode
  customFarePolicy: GameCustomFarePolicy
  previousState?: GameLineOperationalState | null
  day: number
  calendarStartDate: string
}

const DEFAULT_SIMULATION_MODIFIERS: GameSimulationModifiers = {
  demandMultiplier: 1,
  revenueMultiplier: 1,
  operatingCostMultiplier: 1,
}

function normalizeMultiplier(
  value: number,
) {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : 1
}

function normalizeSimulationModifiers(
  modifiers?: Partial<GameSimulationModifiers>,
): GameSimulationModifiers {
  return {
    demandMultiplier: normalizeMultiplier(
      modifiers?.demandMultiplier
      ?? DEFAULT_SIMULATION_MODIFIERS.demandMultiplier,
    ),
    revenueMultiplier: normalizeMultiplier(
      modifiers?.revenueMultiplier
      ?? DEFAULT_SIMULATION_MODIFIERS.revenueMultiplier,
    ),
    operatingCostMultiplier: normalizeMultiplier(
      modifiers?.operatingCostMultiplier
      ?? DEFAULT_SIMULATION_MODIFIERS.operatingCostMultiplier,
    ),
  }
}

export function simulateLineDay(
  line: GameLine,
  options?: SimulateLineOptions,
): GameLineDailySimulation | null {
  if (line.stations.length < 2) {
    return null
  }

  const allStations = getLineAllStations(line)
  const allStationCount = allStations.length

  const definition = getModeSimulationDefinition(
    line.mode,
  )

  const service = getServiceLevelDefinition(
    line.serviceLevel,
  )

  const profileOffPeak = getServiceLevelDefinition(
    line.serviceProfile?.offPeak ?? 'REDUCED',
  )
  const profileNormal = getServiceLevelDefinition(
    line.serviceProfile?.normal ?? line.serviceLevel,
  )
  const profilePeak = getServiceLevelDefinition(
    line.serviceProfile?.peak ?? 'FREQUENT',
  )

  /**
   * Le mode avancé reste volontairement simple : on simule une journée
   * pondérée (6 h creuses, 8 h normales, 4 h de pointe) au lieu de créer
   * un horaire rame par rame.
   */
  const profileDeparturesMultiplier = line.serviceProfileMode === 'ADVANCED'
    ? (profileOffPeak.departuresMultiplier * 6
      + profileNormal.departuresMultiplier * 8
      + profilePeak.departuresMultiplier * 4) / 18
    : service.departuresMultiplier

  const profileDemandMultiplier = line.serviceProfileMode === 'ADVANCED'
    ? (profileOffPeak.demandMultiplier * 6
      + profileNormal.demandMultiplier * 8
      + profilePeak.demandMultiplier * 4) / 18
    : service.demandMultiplier

  const profileOperatingMultiplier = line.serviceProfileMode === 'ADVANCED'
    ? (profileOffPeak.operatingCostMultiplier * 6
      + profileNormal.operatingCostMultiplier * 8
      + profilePeak.operatingCostMultiplier * 4) / 18
    : service.operatingCostMultiplier

  const lengthKm = calculateLineLengthKm(line)
  const longestServiceRoute = calculateLongestServiceRoute(line)

  const targetDeparturesPerHour = Math.max(
    0,
    definition.departuresPerHour
    * profileDeparturesMultiplier,
  )

  const vehicleCount = Math.max(
    0,
    Math.floor(line.vehicleCount ?? 0),
  )

  const requiredVehicleCount =
    calculateRequiredVehiclesForService(
      line,
      line.serviceProfileMode === 'ADVANCED'
        ? line.serviceProfile.peak
        : line.serviceLevel,
    )

  const unavailableVehicleCount =
    calculateUnavailableVehicles(line)

  const availableVehicleCount =
    calculateAvailableVehicles(line)

  const fleetSupportedDeparturesPerHour =
    calculateFleetSupportedDeparturesPerHour(
      line,
      availableVehicleCount,
    )

  const previousWaitingForRegulation = Math.max(
    0,
    Math.round(options?.previousState?.waitingPassengers ?? 0),
  )
  const activeBoostVehicleCount = calculateActiveBoostVehicles(
    line,
    availableVehicleCount,
    previousWaitingForRegulation,
  )
  const boostedVehicleTarget = Math.min(
    availableVehicleCount,
    requiredVehicleCount + activeBoostVehicleCount,
  )
  const regulationTargetDepartures = activeBoostVehicleCount > 0
    ? Math.max(
        targetDeparturesPerHour,
        calculateFleetSupportedDeparturesPerHour(line, boostedVehicleTarget),
      )
    : targetDeparturesPerHour

  const departuresPerHour = Math.min(
    regulationTargetDepartures,
    fleetSupportedDeparturesPerHour,
  )

  const serviceFulfillmentRate =
    targetDeparturesPerHour > 0
      ? Math.min(
          1,
          departuresPerHour / targetDeparturesPerHour,
        )
      : 0

  const reserveVehicleCount = Math.max(
    0,
    availableVehicleCount - Math.min(requiredVehicleCount, availableVehicleCount),
  )
  const regularityScore = calculateRegularityScore({
    line,
    requiredVehicles: requiredVehicleCount,
    availableVehicles: availableVehicleCount,
    unavailableVehicles: unavailableVehicleCount,
    serviceFulfillmentRate,
    activeBoostVehicles: activeBoostVehicleCount,
  })
  const rollingPerformance = rollingStockPerformance(line)
  const effectiveCapacityPerVehicle = effectiveVehicleCapacity(line)
  const effectiveSpeedKmH = effectiveAverageSpeedKmH(line)

  const headwayMinutes = departuresPerHour > 0
    ? 60 / departuresPerHour
    : 0

  const dailyCapacity = Math.max(
    0,
    Math.round(
      effectiveCapacityPerVehicle
      * departuresPerHour
      * definition.serviceHoursPerDay
      * 2,
    ),
  )

  const lineCoverage =
    options?.territorySummary?.lines.find(
      coverage => coverage.lineId === line.id,
    ) ?? null

  const canUseTerritorialDemand = Boolean(
    options?.territorialDataAvailable
    && options.territorySummary
    && lineCoverage,
  )

  const demandModel: GameDemandModel =
    canUseTerritorialDemand
      ? 'TERRITORIAL'
      : 'FALLBACK'

  const demandPassengers =
    canUseTerritorialDemand
    && lineCoverage
    && options?.territorySummary
      ? calculateTerritorialDemand(
          line,
          lineCoverage,
          options.territorySummary,
        )
      : calculateFallbackDemand(
          line,
          lengthKm,
        )

  const activeModifiers = options?.modifiers
    ?? DEFAULT_SIMULATION_MODIFIERS

  const fare = getFareLevelDefinition(
    options?.fareLevel ?? 'STANDARD',
  )

  const fareManagementMode =
    options?.fareManagementMode ?? 'GUIDED'

  const uncoveredStationCount =
    lineCoverage?.uncoveredStationCount
    ?? allStationCount

  const outsideFareStationCount =
    canUseTerritorialDemand
      ? lineCoverage?.uncoveredStationCount ?? 0
      : 0

  const outsideTerritoryShare = allStationCount > 0
    ? Math.min(
        1,
        Math.max(
          0,
          outsideFareStationCount / allStationCount,
        ),
      )
    : 0

  const customFare = calculateCustomFare(
    line.mode,
    options?.customFarePolicy
      ?? GAME_DEFAULT_CUSTOM_FARE_POLICY,
    {
      outsideTerritoryShare,
      lineId: line.id,
      weekdayIndex: gameDayWeekdayIndex(
        options?.day ?? 1,
        options?.calendarStartDate,
      ),
      managementMode: fareManagementMode,
    },
  )

  const fareDemandMultiplier = fareManagementMode !== 'GUIDED'
    ? customFare.demandMultiplier
    : fare.demandMultiplier

  const averageRevenuePerPassengerBeforeFraud =
    fareManagementMode !== 'GUIDED'
      ? customFare.averageRevenuePerPassengerBeforeFraud
      : fare.averageRevenuePerPassenger

  const faceTicketPrice = fareManagementMode !== 'GUIDED'
    ? customFare.faceTicketPrice
    : fare.averageRevenuePerPassenger

  const moraleScoreBefore = Math.min(
    100,
    Math.max(0, options?.previousState?.moraleScore ?? 76),
  )

  /**
   * La confiance voyageurs agit désormais sur la demande de façon mesurée :
   * elle ne remplace jamais le territoire, le prix ou la fréquence, mais un
   * réseau durablement mal vécu finit réellement par perdre de l'attractivité.
   */
  const moraleDemandMultiplier = Math.min(
    1.04,
    Math.max(0.88, 0.88 + moraleScoreBefore * 0.0016),
  )

  const demandBeforeStationExperience = Math.max(
    0,
    Math.round(
      demandPassengers
      * profileDemandMultiplier
      * fareDemandMultiplier
      * activeModifiers.demandMultiplier,
    ),
  )

  const stationExperience = calculateLineStationExperience(
    line,
    options?.network ?? { lines: [line] },
    demandBeforeStationExperience,
  )

  const demandBeforeQuality = Math.max(
    0,
    Math.round(
      demandBeforeStationExperience
      * stationExperience.demandMultiplier,
    ),
  )

  const passengersBeforeQuality = Math.min(
    demandBeforeQuality,
    dailyCapacity,
  )

  const inspectionBeforeQuality = calculateInspectionResult(
    line,
    passengersBeforeQuality,
    averageRevenuePerPassengerBeforeFraud
      * activeModifiers.revenueMultiplier,
    faceTicketPrice,
    options?.previousState?.moraleScore ?? 76,
  )

  const serviceQuality = calculateServiceQuality({
    mode: line.mode,
    lengthKm,
    stationCount: allStationCount,
    departuresPerHour,
    baseDeparturesPerHour: definition.departuresPerHour,
    serviceFulfillmentRate,
    fleetCondition: normalizeFleetCondition(
      line.fleetCondition,
    ),
    dailyCapacity,
    demandBeforeQuality,
    fareDemandMultiplier,
    passengersForInspection: passengersBeforeQuality,
    controllerCount: inspectionBeforeQuality.controllerCount,
    fraudRate: inspectionBeforeQuality.fraudRate,
    stationQualityScore: stationExperience.score,
  })

  const modifiedDemandPassengers = Math.max(
    0,
    Math.round(
      demandBeforeQuality
      * serviceQuality.demandMultiplier
      * moraleDemandMultiplier,
    ),
  )

  const passengers = Math.min(
    modifiedDemandPassengers,
    dailyCapacity,
  )

  const inspection = calculateInspectionResult(
    line,
    passengers,
    averageRevenuePerPassengerBeforeFraud
      * activeModifiers.revenueMultiplier,
    faceTicketPrice,
    options?.previousState?.moraleScore ?? 76,
  )

  const fareRevenueBeforeFraud = Math.max(
    0,
    Math.round(
      passengers
      * averageRevenuePerPassengerBeforeFraud
      * activeModifiers.revenueMultiplier,
    ),
  )

  const passengerRevenueAfterFraud = Math.max(
    0,
    fareRevenueBeforeFraud - inspection.fraudRevenueLoss,
  )

  const revenue = Math.max(
    0,
    passengerRevenueAfterFraud + inspection.fineRevenue,
  )

  const infrastructure = getInfrastructureDefinition(
    line.mode,
    line.infrastructureType ?? 'AUTO',
  )

  const infrastructureOperatingBase = (
    definition.fixedOperatingCostPerDay
    + lengthKm
    * definition.operatingCostPerKmPerDay
    * infrastructure.operatingCostMultiplier
    + stationExperience.operatingCost
  )

  const achievedServiceCostMultiplier =
    0.35
    + Math.max(
      0,
      profileOperatingMultiplier - 0.35,
    ) * serviceFulfillmentRate

  const rollingStockDefinition =
    getRollingStockDefinition(line.mode)

  const maintenanceDefinition =
    getMaintenanceLevelDefinition(
      line.maintenanceLevel,
    )

  const vehicleMaintenanceCost = Math.max(
    0,
    Math.round(
      vehicleCount
      * rollingStockDefinition.maintenanceCostPerVehiclePerDay
      * maintenanceDefinition.costMultiplier
      * rollingPerformance.maintenanceCostMultiplier,
    ),
  )

  const operatingCost = Math.max(
    0,
    Math.round(
      (
        infrastructureOperatingBase
        * achievedServiceCostMultiplier
        * rollingPerformance.operatingCostMultiplier
        + vehicleMaintenanceCost
        + inspection.controlCost
      )
      * activeModifiers.operatingCostMultiplier,
    ),
  )

  const estimatedTravelTimeMinutes = longestServiceRoute.lengthKm > 0
    ? (
        longestServiceRoute.lengthKm / (effectiveSpeedKmH * infrastructure.speedMultiplier) * 60
        + Math.max(0, longestServiceRoute.stationCount - 2) * 0.45 * rollingPerformance.dwellTimeMultiplier
      )
    : 0

  const previousState = options?.previousState ?? null
  const waitingPassengersBefore = Math.max(
    0,
    Math.round(previousState?.waitingPassengers ?? 0),
  )
  const waitingRetention = Math.min(
    0.92,
    Math.max(
      0.32,
      0.46 + moraleScoreBefore / 250 - Math.min(0.18, headwayMinutes / 140),
    ),
  )
  const retainedWaiting = Math.round(
    waitingPassengersBefore * waitingRetention,
  )
  const abandonedFromPreviousQueue = Math.max(
    0,
    waitingPassengersBefore - retainedWaiting,
  )
  const newDemandPassengers = modifiedDemandPassengers
  const boardingDemandPassengers = Math.max(
    0,
    newDemandPassengers + retainedWaiting,
  )
  const transportedPassengers = Math.min(
    boardingDemandPassengers,
    dailyCapacity,
  )
  const overflow = Math.max(
    0,
    boardingDemandPassengers - transportedPassengers,
  )
  const queueKeepRate = Math.min(
    0.9,
    Math.max(
      0.28,
      0.7 - Math.min(0.28, headwayMinutes / 80) + moraleScoreBefore / 600,
    ),
  )
  const waitingPassengersAfter = Math.round(overflow * queueKeepRate)
  const lostPassengers = Math.max(
    0,
    abandonedFromPreviousQueue + overflow - waitingPassengersAfter,
  )

  /** Le premier calcul de recettes utilisait la demande sans file d'attente. */
  const finalPassengers = transportedPassengers
  const finalInspection = calculateInspectionResult(
    line,
    finalPassengers,
    averageRevenuePerPassengerBeforeFraud
      * activeModifiers.revenueMultiplier,
    faceTicketPrice,
    options?.previousState?.moraleScore ?? 76,
  )
  const finalFareRevenueBeforeFraud = Math.max(
    0,
    Math.round(
      finalPassengers
      * averageRevenuePerPassengerBeforeFraud
      * activeModifiers.revenueMultiplier,
    ),
  )
  const finalPassengerRevenueAfterFraud = Math.max(
    0,
    finalFareRevenueBeforeFraud - finalInspection.fraudRevenueLoss,
  )
  const finalRevenueBeforeCompensation = Math.max(
    0,
    finalPassengerRevenueAfterFraud + finalInspection.fineRevenue,
  )

  const finalOperatingCostBeforeCompensation = Math.max(
    0,
    Math.round(
      (
        infrastructureOperatingBase
        * achievedServiceCostMultiplier
        * rollingPerformance.operatingCostMultiplier
        + vehicleMaintenanceCost
        + finalInspection.controlCost
      )
      * activeModifiers.operatingCostMultiplier,
    ),
  )

  const compensationSettings = options?.customFarePolicy?.compensation
    ?? GAME_DEFAULT_CUSTOM_FARE_POLICY.compensation
  const passengerCompensation = compensationSettings.enabled
    && serviceQuality.score < compensationSettings.disruptionQualityThreshold
    ? Math.round(
        finalPassengerRevenueAfterFraud
        * compensationSettings.defaultRefundRate
        * Math.max(0.18, customFare.subscriptionPassengerShare),
      )
    : 0

  const occupancyRate = dailyCapacity > 0
    ? finalPassengers / dailyCapacity
    : 0

  const demandSatisfactionRate = boardingDemandPassengers > 0
    ? Math.min(1, finalPassengers / boardingDemandPassengers)
    : 1

  const queuePressureRate = dailyCapacity > 0
    ? boardingDemandPassengers / dailyCapacity
    : boardingDemandPassengers > 0 ? 2 : 0

  const baseWaitMinutes = departuresPerHour > 0
    ? headwayMinutes / 2 * (1 + Math.max(0, 88 - regularityScore) / 140)
    : 60
  const extraQueueCycles = dailyCapacity > 0
    ? Math.max(0, queuePressureRate - 1)
    : boardingDemandPassengers > 0 ? 2 : 0
  const carryOverPenalty = boardingDemandPassengers > 0
    ? Math.min(18, waitingPassengersBefore / boardingDemandPassengers * Math.max(4, headwayMinutes))
    : 0
  const averageWaitMinutes = Math.min(
    90,
    Math.max(0, baseWaitMinutes + extraQueueCycles * Math.max(2, headwayMinutes) * 0.7 + carryOverPenalty),
  )

  const baseTravelTimeMinutes = estimatedTravelTimeMinutes
  const reliabilityDelay = Math.max(0, 1 - serviceFulfillmentRate) * Math.min(24, baseTravelTimeMinutes * 0.35)
  const regularityDelay = Math.max(0, 88 - regularityScore) / 88 * Math.min(8, Math.max(1, headwayMinutes * 0.45))
  const crowdingDelay = Math.max(0, queuePressureRate - 0.82) * Math.min(14, Math.max(3, headwayMinutes))
  const stationDelay = Math.min(10, (stationExperience.congestedStationCount ?? 0) * 0.65)
  // Moral très faible : davantage de friction en station, jamais une panne mécanique magique.
  const passengerFrictionDelay = Math.max(0, 55 - moraleScoreBefore) / 55 * Math.min(6, Math.max(2, headwayMinutes * 0.4))
  const estimatedDelayMinutes = Math.min(45, reliabilityDelay + regularityDelay + crowdingDelay + stationDelay + passengerFrictionDelay)
  const effectiveTravelTimeMinutes = baseTravelTimeMinutes + estimatedDelayMinutes

  const targetMorale = Math.min(
    100,
    Math.max(
      0,
      serviceQuality.score * 0.58
      + stationExperience.score * 0.16
      + Math.max(0, 100 - Math.min(100, occupancyRate * 100)) * 0.10
      + Math.max(0, 100 - finalInspection.fraudRate * 350) * 0.06
      + (passengerCompensation > 0 ? 8 : 0)
      + Math.max(0, 10 - headwayMinutes) * 0.6
      + demandSatisfactionRate * 8
      + Math.max(0, regularityScore - 70) * 0.12
      - Math.max(0, 65 - regularityScore) * 0.12
      - Math.min(12, averageWaitMinutes * 0.35),
    ),
  )
  const moraleScoreAfter = Math.min(
    100,
    Math.max(
      0,
      moraleScoreBefore * 0.64 + targetMorale * 0.36
      - Math.min(12, lostPassengers / Math.max(1, newDemandPassengers) * 30),
    ),
  )

  const unmetDemandPassengers = Math.max(0, waitingPassengersAfter + lostPassengers)
  const passengerPressureScore = Math.min(
    100,
    Math.max(
      0,
      Math.max(0, queuePressureRate - 0.62) * 54
      + Math.min(1, waitingPassengersAfter / Math.max(1, boardingDemandPassengers)) * 48
      + Math.min(1, lostPassengers / Math.max(1, boardingDemandPassengers)) * 68
      + Math.max(0, 1 - serviceFulfillmentRate) * 34,
    ),
  )

  const diagnostics: GameLineDiagnostic[] = []
  const pushDiagnostic = (diagnostic: GameLineDiagnostic) => diagnostics.push(diagnostic)

  if (departuresPerHour <= 0 && boardingDemandPassengers > 0) {
    pushDiagnostic({
      code: 'NO_SERVICE',
      label: 'Aucun passage assuré',
      description: `${boardingDemandPassengers.toLocaleString(currentGameLocaleTag())} voyageurs souhaitent utiliser la ligne, mais aucun passage n’est produit.`,
      recommendation: 'Ajoutez du matériel roulant ou réduisez le niveau de service demandé.',
      severity: 'CRITICAL',
    })
  }
  if (demandSatisfactionRate < 0.92) {
    pushDiagnostic({
      code: 'UNSERVED_DEMAND',
      label: 'Demande non satisfaite',
      description: `${Math.round(demandSatisfactionRate * 100)} % de la demande est transportée ; ${unmetDemandPassengers.toLocaleString(currentGameLocaleTag())} voyageurs restent en attente ou renoncent.`,
      recommendation: 'Augmentez la capacité ou réduisez la pression sur cet axe.',
      severity: demandSatisfactionRate < 0.72 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (averageWaitMinutes >= 12) {
    pushDiagnostic({
      code: 'WAIT',
      label: 'Attente élevée',
      description: `L’attente moyenne estimée atteint ${Math.round(averageWaitMinutes)} minutes.`,
      recommendation: 'Renforcez les passages, ajoutez du matériel ou diminuez la saturation.',
      severity: averageWaitMinutes >= 24 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (serviceFulfillmentRate < 0.88) {
    pushDiagnostic({
      code: 'SERVICE',
      label: 'Service cible non assuré',
      description: `Seulement ${Math.round(serviceFulfillmentRate * 100)} % du service demandé est réellement produit.`,
      recommendation: 'Vérifiez le parc disponible, la réserve et l’état du matériel.',
      severity: serviceFulfillmentRate < 0.65 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (fareDemandMultiplier < 0.9) {
    pushDiagnostic({
      code: 'FARE',
      label: 'Tarification dissuasive',
      description: 'Le niveau de prix réduit sensiblement l’attractivité de cette ligne.',
      recommendation: 'Ajustez le tarif ou appliquez une réduction ciblée sur les jours concernés.',
      severity: 'INFO',
    })
  }
  if (stationExperience.score < 65) {
    pushDiagnostic({
      code: 'STATIONS',
      label: 'Stations sous pression',
      description: `${stationExperience.congestedStationCount} station(s) dépassent leur niveau de confort ; ${stationExperience.busiestStationName ?? 'le point principal'} concentre la pression maximale.`,
      recommendation: 'Améliorez les stations les plus chargées ou les principaux pôles de correspondance.',
      severity: stationExperience.score < 48 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (regularityScore < 72) {
    pushDiagnostic({
      code: 'REGULARITY',
      label: 'Régularité insuffisante',
      description: `Régularité estimée : ${Math.round(regularityScore)}/100. Des véhicules se regroupent ou les intervalles deviennent irréguliers.`,
      recommendation: line.regulationMode === 'AUTO'
        ? 'Conservez davantage de véhicules en réserve ou améliorez la fiabilité du parc.'
        : 'Ajoutez un renfort depuis la réserve ou repassez la régulation en automatique.',
      severity: regularityScore < 52 ? 'CRITICAL' : 'WARNING',
    })
  }

  const diagnosticFleetCondition = normalizeFleetCondition(line.fleetCondition)
  if (diagnosticFleetCondition < 72) {
    pushDiagnostic({
      code: 'FLEET',
      label: 'Fiabilité du parc en baisse',
      description: `État moyen du parc : ${Math.round(diagnosticFleetCondition)} %.`,
      recommendation: 'Renforcez la maintenance ou remettez le parc à neuf avant que la disponibilité ne chute davantage.',
      severity: diagnosticFleetCondition < 55 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (moraleScoreAfter < 55) {
    pushDiagnostic({
      code: 'MORALE',
      label: 'Confiance voyageurs faible',
      description: `Le moral est à ${Math.round(moraleScoreAfter)}/100 : l’attractivité baisse et les flux voyageurs deviennent moins fluides en station.`,
      recommendation: 'Traitez en priorité l’attente, la saturation et la régularité ; compensez les voyageurs après une forte perturbation si nécessaire.',
      severity: moraleScoreAfter < 35 ? 'CRITICAL' : 'WARNING',
    })
  }
  if (diagnostics.length === 0) {
    pushDiagnostic({
      code: 'HEALTHY',
      label: 'Service maîtrisé',
      description: 'Aucun frein majeur n’est détecté sur la ligne aujourd’hui.',
      recommendation: 'Conservez une petite réserve de capacité et surveillez l’évolution de la demande.',
      severity: 'GOOD',
    })
  }

  const topDemandConstraints = diagnostics
    .filter(item => item.severity !== 'GOOD')
    .slice(0, 3)
    .map(item => item.label)
  if (topDemandConstraints.length === 0) topDemandConstraints.push('Aucun frein majeur détecté')

  const stationRuntime = stationExperience.stations.map((station, index) => {
    const weight = stationExperience.stations.length > 1
      ? (index === 0 || index === stationExperience.stations.length - 1 ? 1.2 : 1)
      : 1
    const weightTotal = stationExperience.stations.reduce(
      (total, _item, itemIndex) => total + (itemIndex === 0 || itemIndex === stationExperience.stations.length - 1 ? 1.2 : 1),
      0,
    )
    const queueShare = weightTotal > 0 ? weight / weightTotal : 0
    return {
      stationId: station.stationId,
      stationName: station.stationName,
      estimatedDailyFootfall: station.estimatedFootfall,
      estimatedPlatformPassengers: Math.round(waitingPassengersAfter * queueShare),
      estimatedPeakPlatformPassengers: Math.round(
        Math.max(
          waitingPassengersAfter * queueShare,
          boardingDemandPassengers * queueShare
          * Math.min(0.20, Math.max(0.03, (headwayMinutes || 60) / (definition.serviceHoursPerDay * 60)))
          * 1.9,
        ),
      ),
      stationCapacity: station.dailyCapacity,
      utilizationRate: station.utilizationRate,
      interchangeLineCount: station.interchangeLineCount,
      nextDepartureMinutes: departuresPerHour > 0
        ? Math.max(1, Math.round(headwayMinutes / 2))
        : null,
      averageWaitingTimeMinutes: averageWaitMinutes,
      fraudPassengers: Math.round(finalInspection.fraudPassengers * queueShare),
      detectedFraudPassengers: Math.round(finalInspection.detectedFraudPassengers * queueShare),
      qualityScore: station.score,
    }
  })

  return {
    lineId: line.id,
    lineName: line.name,
    mode: line.mode,
    stationCount: allStationCount,
    lengthKm,
    averageSpeedKmH: effectiveSpeedKmH * infrastructure.speedMultiplier,
    estimatedTravelTimeMinutes,
    estimatedDelayMinutes,
    effectiveTravelTimeMinutes,
    serviceLevel: service.value,
    departuresPerHour,
    headwayMinutes,
    serviceDemandMultiplier:
      profileDemandMultiplier,
    serviceOperatingCostMultiplier:
      profileOperatingMultiplier,
    vehicleCount,
    requiredVehicleCount,
    targetDeparturesPerHour,
    serviceFulfillmentRate,
    vehicleMaintenanceCost,
    rollingStockGeneration: rollingPerformance.generation,
    rollingStockUpgrades: { ...line.rollingStockUpgrades },
    effectiveVehicleCapacity: effectiveCapacityPerVehicle,
    effectiveAverageSpeedKmH: effectiveSpeedKmH,
    regulationMode: line.regulationMode,
    reserveVehicleCount,
    activeBoostVehicleCount,
    regularityScore,
    fareLevel: fare.value,
    fareManagementMode,
    faceTicketPrice,
    effectiveTicketPrice:
      fareManagementMode !== 'GUIDED'
        ? customFare.effectiveTicketPrice
        : faceTicketPrice,
    averageRevenuePerPassenger:
      averageRevenuePerPassengerBeforeFraud,
    fareDemandMultiplier,
    subscriptionPassengerShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.subscriptionPassengerShare
        : 0,
    dayPassShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.dayPassShare
        : 0,
    monthlyPassShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.monthlyPassShare
        : 0,
    annualPassShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.annualPassShare
        : 0,
    discountPassengerShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.discountPassengerShare
        : 0,
    calendarFareMultiplier:
      fareManagementMode !== 'GUIDED'
        ? customFare.calendarMultiplier
        : 1,
    outsideTerritoryShare:
      fareManagementMode !== 'GUIDED'
        ? customFare.outsideTerritoryShare
        : 0,
    fareRevenueBeforeFraud: finalFareRevenueBeforeFraud,
    passengerRevenueAfterFraud: finalPassengerRevenueAfterFraud,
    inspectionMode: line.inspectionMode,
    controllerCount: finalInspection.controllerCount,
    controlCost: finalInspection.controlCost,
    fraudRate: finalInspection.fraudRate,
    fraudPassengers: finalInspection.fraudPassengers,
    inspectedPassengers: finalInspection.inspectedPassengers,
    detectedFraudPassengers:
      finalInspection.detectedFraudPassengers,
    finePayingPassengers: finalInspection.finePayingPassengers,
    fraudRevenueLoss: finalInspection.fraudRevenueLoss,
    fineRevenue: finalInspection.fineRevenue,
    passengerCompensation,
    maintenanceLevel: line.maintenanceLevel,
    fleetCondition: normalizeFleetCondition(
      line.fleetCondition,
    ),
    availableVehicleCount,
    unavailableVehicleCount,
    maintenanceCostMultiplier:
      maintenanceDefinition.costMultiplier,
    stationQualityScore: stationExperience.score,
    stationDemandMultiplier: stationExperience.demandMultiplier,
    stationOperatingCost: stationExperience.operatingCost,
    congestedStationCount: stationExperience.congestedStationCount,
    interchangeStationCount: stationExperience.interchangeStationCount,
    busiestStationUtilization: stationExperience.busiestStationUtilization,
    busiestStationName: stationExperience.busiestStationName,
    stations: stationRuntime,
    serviceQualityScore: serviceQuality.score,
    serviceQualityDemandMultiplier:
      serviceQuality.demandMultiplier,
    projectedOccupancyRate:
      serviceQuality.projectedOccupancyRate,
    serviceQualityBreakdown:
      serviceQuality.breakdown,
    newDemandPassengers,
    waitingPassengersBefore,
    retainedWaitingPassengers: retainedWaiting,
    abandonedWaitingPassengers: abandonedFromPreviousQueue,
    boardingDemandPassengers,
    dailyCapacity,
    passengers: finalPassengers,
    waitingPassengersAfter,
    lostPassengers,
    occupancyRate,
    demandSatisfactionRate,
    averageWaitMinutes,
    queuePressureRate,
    unmetDemandPassengers,
    passengerPressureScore,
    moraleDemandMultiplier,
    moraleScoreBefore,
    moraleScoreAfter,
    moraleDelta: moraleScoreAfter - moraleScoreBefore,
    topDemandConstraints,
    diagnostics,
    revenue: finalRevenueBeforeCompensation,
    operatingCost: finalOperatingCostBeforeCompensation + passengerCompensation,
    netResult: finalRevenueBeforeCompensation - finalOperatingCostBeforeCompensation - passengerCompensation,
    demandModel,
    demandPassengers,
    municipalitiesServed:
      lineCoverage?.municipalities.length ?? 0,
    populationServed:
      lineCoverage?.populationServed ?? 0,
    uncoveredStations: uncoveredStationCount,
  }
}

export function simulateNetworkDay(
  network: GameNetworkState,
  day: number,
  excludedLineId?: string | null,
  municipalities: GameMunicipality[] = [],
  territorialDataAvailable = false,
  modifiers?: Partial<GameSimulationModifiers>,
  fareLevel: GameFareLevel = 'STANDARD',
  fareManagementMode: GameFareManagementMode = 'GUIDED',
  customFarePolicy: GameCustomFarePolicy = GAME_DEFAULT_CUSTOM_FARE_POLICY,
  simulationState?: GameSimulationState | null,
  calendarStartDate = '2026-01-05',
): GameSimulationDayReport {
  const normalizedModifiers = normalizeSimulationModifiers(
    modifiers,
  )
  const territorySummary = territorialDataAvailable
    ? buildNetworkTerritorySummary(
        network,
        municipalities,
        excludedLineId,
      )
    : null

  const operationalNetwork: GameNetworkState = {
    lines: network.lines.filter(
      line => line.id !== excludedLineId && isOperationalLine(line),
    ),
  }

  const lines = operationalNetwork.lines
    .map(
      line => simulateLineDay(
        line,
        {
          network: operationalNetwork,
          territorialDataAvailable,
          territorySummary,
          modifiers: normalizedModifiers,
          fareLevel,
          fareManagementMode,
          customFarePolicy,
          previousState: simulationState?.lineStates.find(
            state => state.lineId === line.id,
          ) ?? null,
          day,
          calendarStartDate,
        },
      ),
    )
    .filter(
      (
        report,
      ): report is GameLineDailySimulation => report !== null,
    )

  const passengers = lines.reduce(
    (total, line) => total + line.passengers,
    0,
  )

  const waitingPassengers = lines.reduce(
    (total, line) => total + line.waitingPassengersAfter,
    0,
  )

  const lostPassengers = lines.reduce(
    (total, line) => total + line.lostPassengers,
    0,
  )

  const revenue = lines.reduce(
    (total, line) => total + line.revenue,
    0,
  )

  const operatingCost = lines.reduce(
    (total, line) => total + line.operatingCost,
    0,
  )

  const qualityWeight = lines.reduce(
    (total, line) => total + Math.max(1, line.passengers),
    0,
  )

  const serviceQualityScore = qualityWeight > 0
    ? lines.reduce(
        (total, line) => total
          + (line.serviceQualityScore ?? 0)
          * Math.max(1, line.passengers),
        0,
      ) / qualityWeight
    : 0

  const serviceQualityDemandMultiplier = qualityWeight > 0
    ? lines.reduce(
        (total, line) => total
          + (line.serviceQualityDemandMultiplier ?? 1)
          * Math.max(1, line.passengers),
        0,
      ) / qualityWeight
    : 1


  const stationQualityScore = qualityWeight > 0
    ? lines.reduce(
        (total, line) => total
          + (line.stationQualityScore ?? 82)
          * Math.max(1, line.passengers),
        0,
      ) / qualityWeight
    : 0

  const congestedStationCount = lines.reduce(
    (total, line) => total + (line.congestedStationCount ?? 0),
    0,
  )

  const interchangeStationCount = lines.reduce(
    (total, line) => total + (line.interchangeStationCount ?? 0),
    0,
  )

  const networkMoraleScore = qualityWeight > 0
    ? lines.reduce(
        (total, line) => total + line.moraleScoreAfter * Math.max(1, line.passengers),
        0,
      ) / qualityWeight
    : 76

  const totalBoardingDemand = lines.reduce((total, line) => total + line.boardingDemandPassengers, 0)
  const demandSatisfactionRate = totalBoardingDemand > 0
    ? Math.min(1, passengers / totalBoardingDemand)
    : 1
  const averageWaitMinutes = totalBoardingDemand > 0
    ? lines.reduce((total, line) => total + line.averageWaitMinutes * Math.max(1, line.boardingDemandPassengers), 0) / Math.max(1, totalBoardingDemand)
    : 0
  const criticalLineCount = lines.filter(line =>
    line.demandSatisfactionRate < 0.8
    || line.moraleScoreAfter < 45
    || (line.serviceFulfillmentRate ?? 1) < 0.7
    || line.averageWaitMinutes >= 18
  ).length
  const totalCapacity = lines.reduce((total, line) => total + line.dailyCapacity, 0)
  const averageOccupancyRate = totalCapacity > 0 ? passengers / totalCapacity : 0
  const networkPressureScore = lines.length > 0
    ? lines.reduce((total, line) => total + (line.passengerPressureScore ?? 0), 0) / lines.length
    : 0

  return {
    day,
    date: isoDateForGameDay(day, calendarStartDate),
    createdAt: new Date().toISOString(),
    passengers,
    waitingPassengers,
    lostPassengers,
    revenue,
    operatingCost,
    netResult: revenue - operatingCost,
    demandSatisfactionRate,
    averageWaitMinutes,
    criticalLineCount,
    boardingDemandPassengers: totalBoardingDemand,
    averageOccupancyRate,
    networkPressureScore,
    lines,
    demandModel:
      territorialDataAvailable
        ? 'TERRITORIAL'
        : 'FALLBACK',
    municipalitiesServed:
      territorySummary?.municipalitiesServed ?? 0,
    populationServed:
      territorySummary?.populationServed ?? 0,
    uncoveredStations:
      territorySummary?.uncoveredStationCount ?? 0,
    fareLevel,
    fareManagementMode,
    averageRevenuePerPassenger:
      passengers > 0
        ? lines.reduce(
            (total, line) => total
              + line.passengers
              * (line.averageRevenuePerPassenger ?? 0),
            0,
          ) / passengers
        : getFareLevelDefinition(fareLevel).averageRevenuePerPassenger,
    fareDemandMultiplier:
      passengers > 0
        ? lines.reduce(
            (total, line) => total
              + line.passengers
              * (line.fareDemandMultiplier ?? 1),
            0,
          ) / passengers
        : getFareLevelDefinition(fareLevel).demandMultiplier,
    fareRevenueBeforeFraud: lines.reduce(
      (total, line) => total + (line.fareRevenueBeforeFraud ?? 0),
      0,
    ),
    passengerRevenueAfterFraud: lines.reduce(
      (total, line) => total + (line.passengerRevenueAfterFraud ?? 0),
      0,
    ),
    fraudRevenueLoss: lines.reduce(
      (total, line) => total + (line.fraudRevenueLoss ?? 0),
      0,
    ),
    fineRevenue: lines.reduce(
      (total, line) => total + (line.fineRevenue ?? 0),
      0,
    ),
    passengerCompensation: lines.reduce(
      (total, line) => total + (line.passengerCompensation ?? 0),
      0,
    ),
    controlCost: lines.reduce(
      (total, line) => total + (line.controlCost ?? 0),
      0,
    ),
    fraudPassengers: lines.reduce(
      (total, line) => total + (line.fraudPassengers ?? 0),
      0,
    ),
    detectedFraudPassengers: lines.reduce(
      (total, line) => total + (line.detectedFraudPassengers ?? 0),
      0,
    ),
    finePayingPassengers: lines.reduce(
      (total, line) => total + (line.finePayingPassengers ?? 0),
      0,
    ),
    serviceQualityScore,
    serviceQualityDemandMultiplier,
    networkMoraleScore,
    stationQualityScore,
    congestedStationCount,
    interchangeStationCount,
    modifiers: normalizedModifiers,
  }
}

export function applySimulationDay(
  simulation: GameSimulationState,
  economy: GameEconomyState,
  report: GameSimulationDayReport,
) {
  simulation.totalPassengers += report.passengers
  simulation.totalLostPassengers += report.lostPassengers
  simulation.totalRevenue += report.revenue
  simulation.totalOperatingCost += report.operatingCost
  simulation.totalFraudRevenueLoss += report.fraudRevenueLoss ?? 0
  simulation.totalFineRevenue += report.fineRevenue ?? 0
  simulation.totalControlCost += report.controlCost ?? 0

  for (const line of report.lines) {
    const current = simulation.lineStates.find(
      state => state.lineId === line.lineId,
    )
    const goodDay = line.moraleScoreAfter >= 72 && line.lostPassengers <= Math.max(10, line.newDemandPassengers * 0.02)
    if (current) {
      current.waitingPassengers = line.waitingPassengersAfter
      current.moraleScore = line.moraleScoreAfter
      current.consecutiveGoodDays = goodDay ? current.consecutiveGoodDays + 1 : 0
      current.consecutiveBadDays = goodDay ? 0 : current.consecutiveBadDays + 1
    }
    else {
      simulation.lineStates.push({
        lineId: line.lineId,
        waitingPassengers: line.waitingPassengersAfter,
        moraleScore: line.moraleScoreAfter,
        consecutiveGoodDays: goodDay ? 1 : 0,
        consecutiveBadDays: goodDay ? 0 : 1,
      })
    }
  }

  simulation.history.push(report)

  if (
    simulation.history.length
    > GAME_SIMULATION_HISTORY_LIMIT
  ) {
    simulation.history.splice(
      0,
      simulation.history.length
      - GAME_SIMULATION_HISTORY_LIMIT,
    )
  }

  if (!economy.unlimitedMoney) economy.balance += report.netResult
  economy.totalRevenue += report.revenue
  economy.totalPassengerRevenue += Math.max(0, report.passengerRevenueAfterFraud ?? 0)
  economy.totalFineRevenue += Math.max(0, report.fineRevenue ?? 0)
  economy.totalOperatingCosts += report.operatingCost
  economy.totalCompensationPaid += Math.max(0, report.passengerCompensation ?? 0)
}
