export type GamePassengerTripPurpose =
  | 'COMMUTE'
  | 'EDUCATION'
  | 'LEISURE'
  | 'OTHER'

export interface GamePassengerCohort {
  id: string
  originLineId: string
  originStationId: string
  destinationLineId: string
  destinationStationId: string
  passengers: number
  departureMinute: number
  purpose: GamePassengerTripPurpose
  waitedDays: number
}

export type GamePassengerJourneyLegKind = 'RIDE' | 'WALK'

export interface GamePassengerJourneyLeg {
  kind: GamePassengerJourneyLegKind
  lineId?: string
  lineName?: string
  lineCode?: string
  /** Phase 19 : trajet effectué en bus de substitution tout en restant rattaché à la ligne interrompue. */
  substitutionServiceId?: string
  fromLineId: string
  fromStationId: string
  fromStationName: string
  toLineId: string
  toStationId: string
  toStationName: string
  minutes: number
  waitingMinutes: number
  walkingTransferId?: string
}

export interface GamePassengerJourneyPlan {
  found: boolean
  originLineId: string
  originStationId: string
  destinationLineId: string
  destinationStationId: string
  departureMinute: number
  arrivalMinute: number | null
  totalMinutes: number | null
  waitingMinutes: number
  walkingMinutes: number
  rideMinutes: number
  transfers: number
  usedLineIds: string[]
  usedWalkingTransferIds: string[]
  legs: GamePassengerJourneyLeg[]
}

export interface GamePassengerLineLoad {
  lineId: string
  lineName: string
  requestedBoardings: number
  transportedBoardings: number
  transferBoardings: number
  leftBehindPassengers: number
  capacity: number
  loadRate: number
}



export interface GamePassengerSegmentFlow {
  lineId: string
  fromStationId: string
  toStationId: string
  passengers: number
}

export interface GamePassengerStationFlow {
  lineId: string
  stationId: string
  stationName: string
  boardings: number
  alightings: number
  transferBoardings: number
  leftBehindPassengers: number
}

export interface GamePassengerWalkingTransferUsage {
  transferId: string
  passengers: number
}

export interface GamePassengerJourneySample {
  id: string
  originStationName: string
  destinationStationName: string
  passengers: number
  transportedPassengers: number
  leftBehindPassengers: number
  abandonedPassengers: number
  reroutedPassengers: number
  departureMinute: number
  purpose: GamePassengerTripPurpose
  totalMinutes: number | null
  waitingMinutes: number
  walkingMinutes: number
  transfers: number
  usedLineIds: string[]
  usedWalkingTransferIds: string[]
}

export interface GamePassengersDayReport {
  day: number
  generatedJourneys: number
  carriedJourneys: number
  leftBehindJourneys: number
  abandonedJourneys: number
  noRouteJourneys: number
  reroutedJourneys: number
  transferJourneys: number
  walkingTransferJourneys: number
  averageJourneyMinutes: number
  averageWaitingMinutes: number
  averageWalkingMinutes: number
  averageTransfers: number
  reachableJourneyRate: number
  carriedJourneyRate: number
  lineLoads: GamePassengerLineLoad[]
  /** Phase 17 : flux OD agrégés par quai/station pour rendre le réseau lisible. */
  stationFlows: GamePassengerStationFlow[]
  segmentFlows: GamePassengerSegmentFlow[]
  walkingTransferUsage: GamePassengerWalkingTransferUsage[]
  samples: GamePassengerJourneySample[]
}

export interface GamePassengersState {
  waitingCohorts: GamePassengerCohort[]
  totalGeneratedJourneys: number
  totalCarriedJourneys: number
  totalAbandonedJourneys: number
  totalReroutedJourneys: number
  lastReport: GamePassengersDayReport | null
}
