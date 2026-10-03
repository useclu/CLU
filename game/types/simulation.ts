import type { GamePassengersDayReport } from './passengers'

import type {
  GameFareLevel,
  GameFareManagementMode,
} from './fares'

import type {
  GameServiceQualityBreakdown,
} from './serviceQuality'

import type {
  GameInspectionMode,
  GameMaintenanceLevel,
  GameRegulationMode,
  GameRollingStockUpgrades,
  GameScheduleMode,
  GameServiceLevel,
  GameTransportMode,
} from './network'

export type GameDemandModel =
  | 'TERRITORIAL'
  | 'FALLBACK'

export type GameDiagnosticSeverity =
  | 'GOOD'
  | 'INFO'
  | 'WARNING'
  | 'CRITICAL'

export interface GameLineDiagnostic {
  code: string
  label: string
  description: string
  recommendation: string
  severity: GameDiagnosticSeverity
}

export interface GameSimulationModifiers {
  demandMultiplier: number
  revenueMultiplier: number
  operatingCostMultiplier: number
}

export interface GameLineOperationalState {
  lineId: string
  waitingPassengers: number
  moraleScore: number
  consecutiveGoodDays: number
  consecutiveBadDays: number
}

export type GameStationNetworkRole = 'LOCAL' | 'INTERCHANGE' | 'HUB' | 'SATURATED'

export interface GameSegmentDailySimulation {
  fromStationId: string
  toStationId: string
  fromStationName: string
  toStationName: string
  routedPassengers: number
  loadRate: number
  pressureScore: number
  infrastructureCapacityLevel?: number
  infrastructureSpeedLevel?: number
  infrastructureReliabilityLevel?: number
  effectiveCapacityMultiplier?: number
}

export interface GameStationDailySimulation {
  stationId: string
  stationName: string
  estimatedDailyFootfall: number
  estimatedPlatformPassengers: number
  estimatedPeakPlatformPassengers?: number
  /** Phase 17 : flux réellement routés par Voyageurs 2.0. */
  boardings?: number
  alightings?: number
  transferBoardings?: number
  leftBehindPassengers?: number
  hubScore?: number
  networkRole?: GameStationNetworkRole
  stationCapacity: number
  utilizationRate: number
  interchangeLineCount: number
  nextDepartureMinutes: number | null
  averageWaitingTimeMinutes?: number
  fraudPassengers: number
  detectedFraudPassengers: number
  qualityScore: number
}

export interface GameLineDailySimulation {
  lineId: string
  lineName: string
  mode: GameTransportMode
  stationCount: number
  lengthKm: number
  averageSpeedKmH: number
  estimatedTravelTimeMinutes: number
  estimatedDelayMinutes: number
  effectiveTravelTimeMinutes: number

  serviceLevel?: GameServiceLevel
  /** V46 : source de service utilisée pour cette journée. */
  scheduleMode?: GameScheduleMode
  scheduledTrips?: number
  activeMissionCount?: number
  peakScheduledTripsPerHour?: number
  /** V47 : impact PCC / perturbations sur la production réelle. */
  operationalDisruptionCount?: number
  operationalTrips?: number
  cancelledTrips?: number
  extraTrips?: number
  operationsDelayMinutes?: number
  operationsCapacityMultiplier?: number
  departuresPerHour?: number
  headwayMinutes?: number
  serviceDemandMultiplier?: number
  serviceOperatingCostMultiplier?: number

  vehicleCount?: number
  requiredVehicleCount?: number
  targetDeparturesPerHour?: number
  serviceFulfillmentRate?: number
  vehicleMaintenanceCost?: number
  rollingStockGeneration?: string
  rollingStockUpgrades?: GameRollingStockUpgrades
  effectiveVehicleCapacity?: number
  effectiveAverageSpeedKmH?: number
  regulationMode?: GameRegulationMode
  reserveVehicleCount?: number
  activeBoostVehicleCount?: number
  regularityScore?: number

  fareLevel?: GameFareLevel
  averageRevenuePerPassenger?: number
  fareDemandMultiplier?: number

  fareManagementMode?: GameFareManagementMode
  faceTicketPrice?: number
  effectiveTicketPrice?: number
  subscriptionPassengerShare?: number
  dayPassShare?: number
  monthlyPassShare?: number
  annualPassShare?: number
  discountPassengerShare?: number
  outsideTerritoryShare?: number
  calendarFareMultiplier?: number
  fareRevenueBeforeFraud?: number
  passengerRevenueAfterFraud?: number
  inspectionMode?: GameInspectionMode
  controllerCount?: number
  controlCost?: number
  fraudRate?: number
  fraudPassengers?: number
  inspectedPassengers?: number
  detectedFraudPassengers?: number
  finePayingPassengers?: number
  fraudRevenueLoss?: number
  fineRevenue?: number
  passengerCompensation?: number

  maintenanceLevel?: GameMaintenanceLevel
  fleetCondition?: number
  fleetConditionAfter?: number
  availableVehicleCount?: number
  unavailableVehicleCount?: number
  maintenanceCostMultiplier?: number

  stationQualityScore?: number
  stationDemandMultiplier?: number
  stationOperatingCost?: number
  congestedStationCount?: number
  interchangeStationCount?: number
  busiestStationUtilization?: number
  busiestStationName?: string | null
  stations?: GameStationDailySimulation[]
  /** Phase 17 : pression voyageurs par tronçon réellement emprunté. */
  segments?: GameSegmentDailySimulation[]
  bottleneckSegmentName?: string | null
  bottleneckSegmentLoadRate?: number
  infrastructureCapacityMultiplier?: number
  infrastructureSpeedMultiplier?: number
  infrastructureReliabilityScore?: number
  infrastructureModernizedSegmentCount?: number
  depotDistanceKm?: number | null
  depotOperatingOverhead?: number

  serviceQualityScore?: number
  serviceQualityDemandMultiplier?: number
  projectedOccupancyRate?: number
  serviceQualityBreakdown?: GameServiceQualityBreakdown

  /** Gros Lot 1 : demande non satisfaite et moral voyageurs. */
  newDemandPassengers: number
  waitingPassengersBefore: number
  boardingDemandPassengers: number
  dailyCapacity: number
  passengers: number
  waitingPassengersAfter: number
  lostPassengers: number
  occupancyRate: number
  demandSatisfactionRate: number
  averageWaitMinutes: number
  queuePressureRate: number
  unmetDemandPassengers?: number
  passengerPressureScore?: number
  retainedWaitingPassengers?: number
  abandonedWaitingPassengers?: number
  moraleDemandMultiplier: number
  moraleScoreBefore: number
  moraleScoreAfter: number
  moraleDelta: number
  topDemandConstraints: string[]
  diagnostics?: GameLineDiagnostic[]

  /** V49 : flux OD réellement affectés à cette ligne par Voyageurs 2.0. */
  networkRoutedPassengers?: number
  networkTransferBoardings?: number
  networkLeftBehindPassengers?: number
  networkLoadRate?: number

  revenue: number
  operatingCost: number
  netResult: number

  demandModel?: GameDemandModel
  demandPassengers?: number
  municipalitiesServed?: number
  populationServed?: number
  uncoveredStations?: number
}

export interface GameSimulationDayReport {
  day: number
  date: string
  createdAt: string
  passengers: number
  waitingPassengers: number
  lostPassengers: number
  revenue: number
  operatingCost: number
  netResult: number
  demandSatisfactionRate: number
  averageWaitMinutes: number
  criticalLineCount: number
  boardingDemandPassengers?: number
  averageOccupancyRate?: number
  networkPressureScore?: number
  /** V49 : simulation origine → destination, correspondances et saturation réseau. */
  passengersV2?: GamePassengersDayReport
  lines: GameLineDailySimulation[]

  demandModel?: GameDemandModel
  municipalitiesServed?: number
  populationServed?: number
  uncoveredStations?: number

  fareLevel?: GameFareLevel
  averageRevenuePerPassenger?: number
  fareDemandMultiplier?: number

  fareManagementMode?: GameFareManagementMode
  fareRevenueBeforeFraud?: number
  passengerRevenueAfterFraud?: number
  fraudRevenueLoss?: number
  fineRevenue?: number
  passengerCompensation?: number
  controlCost?: number
  fraudPassengers?: number
  detectedFraudPassengers?: number
  finePayingPassengers?: number

  serviceQualityScore?: number
  serviceQualityDemandMultiplier?: number
  networkMoraleScore?: number

  stationQualityScore?: number
  congestedStationCount?: number
  interchangeStationCount?: number

  modifiers?: GameSimulationModifiers
}

export interface GameSimulationState {
  totalPassengers: number
  totalLostPassengers: number
  totalRevenue: number
  totalOperatingCost: number
  totalFraudRevenueLoss: number
  totalFineRevenue: number
  totalControlCost: number
  lineStates: GameLineOperationalState[]
  history: GameSimulationDayReport[]
}
