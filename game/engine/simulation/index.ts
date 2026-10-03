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

import { calculateTimetableStats } from '../timetable'
import { calculateOperationsDayImpact } from '../operations'

import {
  buildStationInterchangeIndex,
  calculateLineStationExperience,
  type GameStationInterchangeIndex,
} from '../stations'

import {
  calculateInfrastructureLineProfile,
} from '../infrastructure'

import {
  isOperationalLine,
} from '../network'

import {
  getServiceLevelDefinition,
} from '../../config/operations'

import {
  getRollingStockDefinition,
  getRollingStockModel,
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
  calculateDepotAccessMetrics,
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

import type { GameOperationsState } from '../../types/operations'

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
  municipalityByCode?: Map<string, GameNetworkTerritorySummary['municipalities'][number]>,
) {
  const definition = getModeDemandDefinition(
    line.mode,
  )

  let passengers = 0

  for (const municipality of coverage.municipalities) {
    const networkMunicipality = municipalityByCode?.get(municipality.code)
      ?? networkTerritory.municipalities.find(
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
      * Math.max(0.5, Math.min(2.5, municipality.mobilityDemandMultiplier ?? 1))
  }

  const municipalityBonus = 1 + Math.min(
    GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX,
    Math.max(
      0,
      coverage.municipalities.length - 1,
    ) * GAME_DEMAND_MULTI_MUNICIPALITY_BONUS,
  )

  // V50 : relier plusieurs bassins crée des déplacements que l'ancien modèle
  // purement local ne voyait pas. Le bonus reste volontairement borné : une
  // ligne longue devient structurante sans produire une croissance exponentielle.
  const networkReachMultiplier = 1 + Math.min(
    definition.maxNetworkReachBonus,
    Math.max(0, coverage.municipalities.length - 1)
      * definition.networkReachBonusPerMunicipality,
  )

  const networkStationMultiplier = 1 + Math.min(
    definition.maxNetworkStationBonus,
    Math.max(0, coverage.stationCount - 2)
      * definition.networkStationBonus,
  )

  passengers *= municipalityBonus
    * networkReachMultiplier
    * networkStationMultiplier

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
  lineCoverage?: GameLineMunicipalityCoverage | null
  networkMunicipalityByCode?: Map<string, GameNetworkTerritorySummary['municipalities'][number]>
  stationInterchangeIndex?: GameStationInterchangeIndex
  modifiers: GameSimulationModifiers
  fareLevel: GameFareLevel
  fareManagementMode: GameFareManagementMode
  customFarePolicy: GameCustomFarePolicy
  previousState?: GameLineOperationalState | null
  day: number
  calendarStartDate: string
  operations?: GameOperationsState | null
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
   * Le mode historique continue d'utiliser les profils Creuse / Normale / Pointe.
   * En V46, une grille TIMETABLE remplace réellement cette fréquence théorique :
   * chaque course saisie par le joueur compte dans la capacité et dans le parc requis.
   */
  const profileDeparturesMultiplier = line.serviceProfileMode === 'ADVANCED'
    ? (profileOffPeak.departuresMultiplier * 6
      + profileNormal.departuresMultiplier * 8
      + profilePeak.departuresMultiplier * 4) / 18
    : service.departuresMultiplier

  const timetableStats = calculateTimetableStats(
    line,
    options?.day ?? 1,
    options?.calendarStartDate ?? '2026-01-05',
  )
  const usesTimetable = line.schedule?.mode === 'TIMETABLE' && timetableStats !== null
  const operationsImpact = calculateOperationsDayImpact(
    line,
    options?.day ?? 1,
    options?.calendarStartDate ?? '2026-01-05',
    options?.operations,
  )
  const timetableIntensity = usesTimetable
    ? timetableStats.equivalentDeparturesPerHour / Math.max(0.1, definition.departuresPerHour)
    : profileDeparturesMultiplier

  const profileDemandMultiplier = usesTimetable
    ? Math.min(1.18, Math.max(0.78, 0.84 + Math.sqrt(Math.max(0, timetableIntensity)) * 0.16))
    : line.serviceProfileMode === 'ADVANCED'
      ? (profileOffPeak.demandMultiplier * 6
        + profileNormal.demandMultiplier * 8
        + profilePeak.demandMultiplier * 4) / 18
      : service.demandMultiplier

  const profileOperatingMultiplier = usesTimetable
    ? Math.min(3, Math.max(0.25, timetableIntensity))
    : line.serviceProfileMode === 'ADVANCED'
      ? (profileOffPeak.operatingCostMultiplier * 6
        + profileNormal.operatingCostMultiplier * 8
        + profilePeak.operatingCostMultiplier * 4) / 18
      : service.operatingCostMultiplier

  const lengthKm = calculateLineLengthKm(line)
  const longestServiceRoute = calculateLongestServiceRoute(line)
  const infrastructureProfile = calculateInfrastructureLineProfile(line)
  const depotAccess = calculateDepotAccessMetrics(line, options?.network)

  const lineCoverage = options?.lineCoverage !== undefined
    ? options.lineCoverage
    : options?.territorySummary?.lines.find(
        coverage => coverage.lineId === line.id,
      ) ?? null
  const localEventServiceMultiplier = lineCoverage?.municipalities.reduce(
    (maximum, municipality) => Math.max(maximum, municipality.lineServiceMultipliers?.[line.id] ?? 1),
    1,
  ) ?? 1
  // Les horaires personnalisés sont renforcés par de vraies courses supplémentaires
  // créées lors de la préparation de l'événement. En fréquence, on peut augmenter
  // directement l'offre pendant les jours concernés.
  const frequencyEventServiceMultiplier = usesTimetable ? 1 : Math.max(1, Math.min(1.6, localEventServiceMultiplier))
  const temporaryOperatingMultiplier = usesTimetable
    ? Math.max(1, operationsImpact.serviceMultiplier)
    : frequencyEventServiceMultiplier

  const targetDeparturesPerHour = usesTimetable
    ? Math.max(0, timetableStats.equivalentDeparturesPerHour)
    : Math.max(0, definition.departuresPerHour * profileDeparturesMultiplier * frequencyEventServiceMultiplier)

  const vehicleCount = Math.max(
    0,
    Math.floor(line.vehicleCount ?? 0),
  )

  const requiredVehicleCount = usesTimetable
    ? Math.max(0, Math.ceil(timetableStats.requiredVehicleCount * Math.max(1, operationsImpact.serviceMultiplier)))
    : calculateRequiredVehiclesForService(
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
  // Une grille manuelle est contractuelle : la régulation ne crée pas de départs
  // absents de l'horaire. Les véhicules disponibles servent d'abord à couvrir la grille.
  const activeBoostVehicleCount = usesTimetable
    ? 0
    : calculateActiveBoostVehicles(
        line,
        availableVehicleCount,
        previousWaitingForRegulation,
      )
  const boostedVehicleTarget = Math.min(
    availableVehicleCount,
    requiredVehicleCount + activeBoostVehicleCount,
  )
  const regulationTargetDepartures = !usesTimetable && activeBoostVehicleCount > 0
    ? Math.max(
        targetDeparturesPerHour,
        calculateFleetSupportedDeparturesPerHour(line, boostedVehicleTarget),
      )
    : targetDeparturesPerHour

  const fleetFulfillmentRate = usesTimetable
    ? requiredVehicleCount > 0
      ? Math.min(1, availableVehicleCount / requiredVehicleCount)
      : 0
    : targetDeparturesPerHour > 0
      ? Math.min(1, Math.min(regulationTargetDepartures, fleetSupportedDeparturesPerHour) / targetDeparturesPerHour)
      : 0

  const serviceFulfillmentRate = Math.max(0, Math.min(1,
    fleetFulfillmentRate * (usesTimetable ? Math.min(1, operationsImpact.serviceMultiplier) : operationsImpact.serviceMultiplier),
  ))

  const departuresPerHour = usesTimetable
    ? targetDeparturesPerHour * operationsImpact.serviceMultiplier * fleetFulfillmentRate
    : Math.min(regulationTargetDepartures, fleetSupportedDeparturesPerHour) * operationsImpact.serviceMultiplier

  const reserveVehicleCount = Math.max(
    0,
    availableVehicleCount - Math.min(requiredVehicleCount, availableVehicleCount),
  )
  const regularityScore = Math.max(0, Math.min(100,
    calculateRegularityScore({
      line,
      requiredVehicles: requiredVehicleCount,
      availableVehicles: availableVehicleCount,
      unavailableVehicles: unavailableVehicleCount,
      serviceFulfillmentRate,
      activeBoostVehicles: activeBoostVehicleCount,
    })
    - operationsImpact.regularityPenalty
    + Math.max(0, infrastructureProfile.reliabilityScore - 76) * 0.22
    - depotAccess.regularityPenalty,
  ))
  const rollingPerformance = rollingStockPerformance(line)
  const effectiveCapacityPerVehicle = effectiveVehicleCapacity(line)
  const effectiveSpeedKmH = effectiveAverageSpeedKmH(line)

  const headwayMinutes = departuresPerHour > 0
    ? 60 / departuresPerHour
    : 0

  const dailyCapacity = Math.max(
    0,
    Math.round(
      (usesTimetable
        ? effectiveCapacityPerVehicle * operationsImpact.effectiveTrips * fleetFulfillmentRate * operationsImpact.capacityMultiplier
        : effectiveCapacityPerVehicle * departuresPerHour * definition.serviceHoursPerDay * 2 * operationsImpact.capacityMultiplier)
      * infrastructureProfile.capacityMultiplier,
    ),
  )

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
          options.networkMunicipalityByCode,
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
    options?.stationInterchangeIndex,
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
    * infrastructureProfile.operatingCostMultiplier
    + stationExperience.operatingCost
  )

  // Phase 18 : un renfort de réserve en fréquence augmente réellement les coûts.
  // Les horaires supplémentaires sont déjà pris en compte par operationsImpact.
  const regulationOperatingMultiplier = usesTimetable
    ? 1
    : 1 + Math.min(0.8, activeBoostVehicleCount / Math.max(1, requiredVehicleCount) * 0.7)
  const achievedServiceCostMultiplier =
    0.35
    + Math.max(
      0,
      profileOperatingMultiplier * temporaryOperatingMultiplier * regulationOperatingMultiplier - 0.35,
    ) * serviceFulfillmentRate

  const rollingStockDefinition =
    getRollingStockDefinition(line.mode)
  const rollingStockModel =
    getRollingStockModel(line.rollingStockModelId, line.mode)

  const maintenanceDefinition =
    getMaintenanceLevelDefinition(
      line.maintenanceLevel,
    )

  const vehicleMaintenanceCost = Math.max(
    0,
    Math.round(
      vehicleCount
      * rollingStockModel.maintenanceCostPerVehiclePerDay
      * maintenanceDefinition.costMultiplier
      * rollingPerformance.maintenanceCostMultiplier
      * (line.depotId ? 0.94 : 1),
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
      * activeModifiers.operatingCostMultiplier
      * depotAccess.operatingCostMultiplier,
    ),
  )

  const estimatedTravelTimeMinutes = longestServiceRoute.lengthKm > 0
    ? (
        longestServiceRoute.lengthKm / (effectiveSpeedKmH * infrastructure.speedMultiplier * infrastructureProfile.speedMultiplier) * 60
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
  const estimatedDelayMinutes = Math.min(120, reliabilityDelay + regularityDelay + crowdingDelay + stationDelay + passengerFrictionDelay + operationsImpact.extraDelayMinutes)
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
  if (operationsImpact.disruptionCount > 0 || operationsImpact.cancelledTrips > 0) {
    pushDiagnostic({
      code: 'OPERATIONS',
      label: 'Exploitation perturbée',
      description: usesTimetable
        ? `${operationsImpact.disruptionCount} perturbation(s), ${operationsImpact.cancelledTrips} course(s) supprimée(s) et ${operationsImpact.extraTrips} renfort(s) sur la journée.`
        : `${operationsImpact.disruptionCount} perturbation(s) réduisent le service prévu aujourd’hui.`,
      recommendation: 'Ouvrez le PCC pour adapter les missions, injecter un renfort ou terminer une perturbation.',
      severity: operationsImpact.serviceMultiplier < 0.65 ? 'CRITICAL' : 'WARNING',
    })
  }

  if (depotAccess.distanceKm !== null && depotAccess.distanceKm > 15) {
    pushDiagnostic({
      code: 'DEPOT_DISTANCE',
      label: 'Dépôt trop éloigné',
      description: `Le dépôt principal est à environ ${depotAccess.distanceKm.toFixed(1)} km de la ligne : les mouvements à vide pèsent sur l'exploitation.`,
      recommendation: 'Affectez la ligne à un dépôt compatible plus proche ou construisez un nouveau site près du réseau.',
      severity: depotAccess.distanceKm > 30 ? 'WARNING' : 'INFO',
    })
  }
  if (infrastructureProfile.segmentCount > 0 && infrastructureProfile.capacityMultiplier < 1.08 && queuePressureRate >= 0.9) {
    pushDiagnostic({
      code: 'INFRASTRUCTURE_CAPACITY',
      label: 'Infrastructure à renforcer',
      description: 'La ligne est sous pression alors que son infrastructure reste proche du niveau de référence sur la majorité des tronçons.',
      recommendation: 'Modernisez en priorité le tronçon réellement chargé avant d’ajouter de la capacité partout.',
      severity: queuePressureRate >= 1.15 ? 'WARNING' : 'INFO',
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
    averageSpeedKmH: effectiveSpeedKmH * infrastructure.speedMultiplier * infrastructureProfile.speedMultiplier,
    estimatedTravelTimeMinutes,
    estimatedDelayMinutes,
    effectiveTravelTimeMinutes,
    serviceLevel: service.value,
    scheduleMode: usesTimetable ? 'TIMETABLE' : 'FREQUENCY',
    scheduledTrips: usesTimetable ? timetableStats.totalDepartures : undefined,
    activeMissionCount: usesTimetable ? timetableStats.activeMissionCount : undefined,
    peakScheduledTripsPerHour: usesTimetable ? timetableStats.peakTripsPerHour : undefined,
    operationalDisruptionCount: operationsImpact.disruptionCount,
    operationalTrips: usesTimetable ? operationsImpact.effectiveTrips : undefined,
    cancelledTrips: usesTimetable ? operationsImpact.cancelledTrips : undefined,
    extraTrips: usesTimetable ? operationsImpact.extraTrips : undefined,
    operationsDelayMinutes: operationsImpact.extraDelayMinutes,
    operationsCapacityMultiplier: operationsImpact.capacityMultiplier,
    departuresPerHour,
    headwayMinutes,
    serviceDemandMultiplier:
      profileDemandMultiplier,
    serviceOperatingCostMultiplier:
      profileOperatingMultiplier * temporaryOperatingMultiplier,
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
    infrastructureCapacityMultiplier: infrastructureProfile.capacityMultiplier,
    infrastructureSpeedMultiplier: infrastructureProfile.speedMultiplier,
    infrastructureReliabilityScore: infrastructureProfile.reliabilityScore,
    infrastructureModernizedSegmentCount: infrastructureProfile.modernizedSegmentCount,
    depotDistanceKm: depotAccess.distanceKm,
    depotOperatingOverhead: depotAccess.operatingCostMultiplier - 1,
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
  operations?: GameOperationsState | null,
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
    walkingTransfers: network.walkingTransfers ?? [],
    depots: network.depots ?? [],
  }

  // Indexer une fois les structures consultées pour chaque ligne évite des
  // recherches O(n) répétées dans lineStates et dans le résumé territorial.
  const previousStateByLineId = new Map(
    (simulationState?.lineStates ?? []).map(state => [state.lineId, state] as const),
  )
  const lineCoverageByLineId = new Map(
    (territorySummary?.lines ?? []).map(coverage => [coverage.lineId, coverage] as const),
  )
  const networkMunicipalityByCode = new Map(
    (territorySummary?.municipalities ?? []).map(municipality => [municipality.code, municipality] as const),
  )
  const stationInterchangeIndex = buildStationInterchangeIndex(operationalNetwork)

  const lines = operationalNetwork.lines
    .map(
      line => simulateLineDay(
        line,
        {
          network: operationalNetwork,
          territorialDataAvailable,
          territorySummary,
          lineCoverage: lineCoverageByLineId.get(line.id) ?? null,
          networkMunicipalityByCode,
          stationInterchangeIndex,
          modifiers: normalizedModifiers,
          fareLevel,
          fareManagementMode,
          customFarePolicy,
          previousState: previousStateByLineId.get(line.id) ?? null,
          day,
          calendarStartDate,
          operations,
        },
      ),
    )
    .filter(
      (
        report,
      ): report is GameLineDailySimulation => report !== null,
    )

  // Tous les indicateurs réseau proviennent de la même liste de rapports.
  // Les agréger en un passage évite une vingtaine de parcours complets du
  // tableau lorsque le réseau contient beaucoup de lignes.
  let passengers = 0
  let waitingPassengers = 0
  let lostPassengers = 0
  let revenue = 0
  let operatingCost = 0
  let qualityWeight = 0
  let weightedServiceQuality = 0
  let weightedServiceQualityDemandMultiplier = 0
  let weightedStationQuality = 0
  let congestedStationCount = 0
  let interchangeStationCount = 0
  let weightedMorale = 0
  let totalBoardingDemand = 0
  let weightedWaitMinutes = 0
  let criticalLineCount = 0
  let totalCapacity = 0
  let networkPressureTotal = 0
  let weightedRevenuePerPassenger = 0
  let weightedFareDemandMultiplier = 0
  let fareRevenueBeforeFraud = 0
  let passengerRevenueAfterFraud = 0
  let fraudRevenueLoss = 0
  let fineRevenue = 0
  let passengerCompensation = 0
  let controlCost = 0
  let fraudPassengers = 0
  let detectedFraudPassengers = 0
  let finePayingPassengers = 0

  for (const line of lines) {
    const passengerWeight = Math.max(1, line.passengers)
    passengers += line.passengers
    waitingPassengers += line.waitingPassengersAfter
    lostPassengers += line.lostPassengers
    revenue += line.revenue
    operatingCost += line.operatingCost
    qualityWeight += passengerWeight
    weightedServiceQuality += (line.serviceQualityScore ?? 0) * passengerWeight
    weightedServiceQualityDemandMultiplier += (line.serviceQualityDemandMultiplier ?? 1) * passengerWeight
    weightedStationQuality += (line.stationQualityScore ?? 82) * passengerWeight
    congestedStationCount += line.congestedStationCount ?? 0
    interchangeStationCount += line.interchangeStationCount ?? 0
    weightedMorale += line.moraleScoreAfter * passengerWeight
    totalBoardingDemand += line.boardingDemandPassengers
    weightedWaitMinutes += line.averageWaitMinutes * Math.max(1, line.boardingDemandPassengers)
    if (
      line.demandSatisfactionRate < 0.8
      || line.moraleScoreAfter < 45
      || (line.serviceFulfillmentRate ?? 1) < 0.7
      || line.averageWaitMinutes >= 18
    ) criticalLineCount += 1
    totalCapacity += line.dailyCapacity
    networkPressureTotal += line.passengerPressureScore ?? 0
    weightedRevenuePerPassenger += line.passengers * (line.averageRevenuePerPassenger ?? 0)
    weightedFareDemandMultiplier += line.passengers * (line.fareDemandMultiplier ?? 1)
    fareRevenueBeforeFraud += line.fareRevenueBeforeFraud ?? 0
    passengerRevenueAfterFraud += line.passengerRevenueAfterFraud ?? 0
    fraudRevenueLoss += line.fraudRevenueLoss ?? 0
    fineRevenue += line.fineRevenue ?? 0
    passengerCompensation += line.passengerCompensation ?? 0
    controlCost += line.controlCost ?? 0
    fraudPassengers += line.fraudPassengers ?? 0
    detectedFraudPassengers += line.detectedFraudPassengers ?? 0
    finePayingPassengers += line.finePayingPassengers ?? 0
  }

  const serviceQualityScore = qualityWeight > 0
    ? weightedServiceQuality / qualityWeight
    : 0
  const serviceQualityDemandMultiplier = qualityWeight > 0
    ? weightedServiceQualityDemandMultiplier / qualityWeight
    : 1
  const stationQualityScore = qualityWeight > 0
    ? weightedStationQuality / qualityWeight
    : 0
  const networkMoraleScore = qualityWeight > 0
    ? weightedMorale / qualityWeight
    : 76
  const demandSatisfactionRate = totalBoardingDemand > 0
    ? Math.min(1, passengers / totalBoardingDemand)
    : 1
  const averageWaitMinutes = totalBoardingDemand > 0
    ? weightedWaitMinutes / Math.max(1, totalBoardingDemand)
    : 0
  const averageOccupancyRate = totalCapacity > 0 ? passengers / totalCapacity : 0
  const networkPressureScore = lines.length > 0
    ? networkPressureTotal / lines.length
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
        ? weightedRevenuePerPassenger / passengers
        : getFareLevelDefinition(fareLevel).averageRevenuePerPassenger,
    fareDemandMultiplier:
      passengers > 0
        ? weightedFareDemandMultiplier / passengers
        : getFareLevelDefinition(fareLevel).demandMultiplier,
    fareRevenueBeforeFraud,
    passengerRevenueAfterFraud,
    fraudRevenueLoss,
    fineRevenue,
    passengerCompensation,
    controlCost,
    fraudPassengers,
    detectedFraudPassengers,
    finePayingPassengers,
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

  const lineStateById = new Map(
    simulation.lineStates.map(state => [state.lineId, state] as const),
  )

  for (const line of report.lines) {
    const current = lineStateById.get(line.lineId)
    const goodDay = line.moraleScoreAfter >= 72 && line.lostPassengers <= Math.max(10, line.newDemandPassengers * 0.02)
    if (current) {
      current.waitingPassengers = line.waitingPassengersAfter
      current.moraleScore = line.moraleScoreAfter
      current.consecutiveGoodDays = goodDay ? current.consecutiveGoodDays + 1 : 0
      current.consecutiveBadDays = goodDay ? 0 : current.consecutiveBadDays + 1
    }
    else {
      const createdState: GameLineOperationalState = {
        lineId: line.lineId,
        waitingPassengers: line.waitingPassengersAfter,
        moraleScore: line.moraleScoreAfter,
        consecutiveGoodDays: goodDay ? 1 : 0,
        consecutiveBadDays: goodDay ? 0 : 1,
      }
      simulation.lineStates.push(createdState)
      lineStateById.set(line.lineId, createdState)
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
