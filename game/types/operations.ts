export type GameDisruptionType =
  | 'TECHNICAL'
  | 'PASSENGER'
  | 'SECURITY'
  | 'STAFF'
  | 'WEATHER'
  | 'WORKS'
  | 'CUSTOM'

export type GameDisruptionSeverity =
  | 'MINOR'
  | 'MODERATE'
  | 'MAJOR'
  | 'CRITICAL'

export type GameDisruptionScope =
  | 'LINE'
  | 'STATIONS'
  | 'SEGMENT'

export type GameDisruptionSource = 'MANUAL' | 'NATURAL' | 'WORKS'
export type GamePccControlLevel = 'AUTO' | 'SIMPLE' | 'ADVANCED'

export interface GameManualDisruption {
  id: string
  lineId: string
  title: string
  passengerMessage: string
  type: GameDisruptionType
  severity: GameDisruptionSeverity
  scope: GameDisruptionScope
  stationIds: string[]
  segmentFromStationId: string | null
  segmentToStationId: string | null
  /** Minute absolue depuis le début du Jour 1. */
  startsAtAbsoluteMinute: number
  /** Fin exclusive. */
  endsAtAbsoluteMinute: number
  delayMinutes: number
  /** 0..1 : part des circulations supprimées pendant la perturbation. */
  cancellationRate: number
  /** 0..1 : capacité restante pendant la perturbation. */
  capacityMultiplier: number
  /** Interruption totale de la portée sélectionnée. */
  suspended: boolean
  /** Phase 19 : origine de la perturbation, utile pour distinguer un incident vivant d'une saisie PCC. */
  source?: GameDisruptionSource
  createdAt: string
  resolvedAt: string | null
}

export type GameStationWorkStatus = 'ACTIVE' | 'COMPLETED'

export interface GameStationUpgradeWork {
  id: string
  lineId: string
  stationId: string
  stationName: string
  targetFacilityLevel: import('./network').GameStationFacilityLevel
  startDay: number
  endDay: number
  cost: number
  disruptionId: string
  status: GameStationWorkStatus
  createdAt: string
  completedAt: string | null
}


export interface GameBusSubstitutionService {
  id: string
  disruptionId: string
  /** Ligne interrompue que le service remplace. Le véhicule temporaire reste toujours un BUS. */
  lineId: string
  fromStationId: string
  toStationId: string
  /** Stations du corridor, dans l'ordre. Elles servent au routage Voyageurs 2.0 et à la carte. */
  stationIds: string[]
  startsAtAbsoluteMinute: number
  endsAtAbsoluteMinute: number
  headwayMinutes: number
  busCapacity: number
  buses: number
  dailyCapacity: number
  cost: number
  createdAt: string
  endedAt: string | null
}

export interface GameTripOverride {
  id: string
  lineId: string
  day: number
  missionId: string
  scheduledDepartureMinute: number
  delayMinutes: number
  cancelled: boolean
  skippedStationIds: string[]
  shortTurnStationId: string | null
  note: string
  updatedAt: string
}

export interface GameExtraTrip {
  id: string
  lineId: string
  day: number
  missionId: string
  departureMinute: number
  createdAt: string
}

export type GameOperationsHistoryKind =
  | 'DISRUPTION_CREATED'
  | 'DISRUPTION_UPDATED'
  | 'DISRUPTION_RESOLVED'
  | 'DISRUPTION_DELETED'
  | 'TRIP_DELAYED'
  | 'TRIP_CANCELLED'
  | 'TRIP_RESTORED'
  | 'TRIP_SHORT_TURNED'
  | 'TRIP_STOPS_CHANGED'
  | 'TRIP_RESET'
  | 'EXTRA_TRIP_ADDED'
  | 'EXTRA_TRIP_REMOVED'
  | 'REGULATION_CHANGED'
  | 'PCC_CONTROL_LEVEL_CHANGED'
  | 'SUBSTITUTION_STARTED'
  | 'SUBSTITUTION_ENDED'
  | 'AUTO_RESPONSE_APPLIED'
  | 'STATION_WORK_STARTED'
  | 'STATION_WORK_COMPLETED'

export interface GameOperationsHistoryEntry {
  id: string
  kind: GameOperationsHistoryKind
  day: number
  minute: number
  lineId: string | null
  title: string
  detail: string
  createdAt: string
}

export interface GameOperationsState {
  disruptions: GameManualDisruption[]
  tripOverrides: GameTripOverride[]
  extraTrips: GameExtraTrip[]
  /** Phase 19 : services de bus de substitution liés à une perturbation. */
  substitutionServices: GameBusSubstitutionService[]
  /** Niveau d'assistance PCC par ligne : Auto / Simple / Avancé. */
  pccControlLevels: Record<string, GamePccControlLevel>
  /** Perturbations déjà prises en charge automatiquement, pour éviter les réponses répétées. */
  autoHandledDisruptionIds: string[]
  /** Phase 17 : chantiers de stations persistés et repris au chargement. */
  stationWorks: GameStationUpgradeWork[]
  history: GameOperationsHistoryEntry[]
}

export interface GameOperationalRun {
  id: string
  lineId: string
  day: number
  missionId: string
  missionCode: string
  missionName: string
  scheduledDepartureMinute: number
  effectiveDepartureMinute: number
  delayMinutes: number
  manualDelayMinutes: number
  disruptionDelayMinutes: number
  cancelled: boolean
  cancelledByOverride: boolean
  cancelledByDisruption: boolean
  extra: boolean
  sourceExtraTripId: string | null
  routeStationIds: string[]
  stopStationIds: string[]
  shortTurnStationId: string | null
  skippedStationIds: string[]
  capacityMultiplier: number
  affectedDisruptionIds: string[]
}

export interface GameOperationsDayImpact {
  disruptionCount: number
  baseTrips: number
  effectiveTrips: number
  cancelledTrips: number
  extraTrips: number
  serviceMultiplier: number
  capacityMultiplier: number
  extraDelayMinutes: number
  regularityPenalty: number
}
