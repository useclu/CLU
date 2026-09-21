import type { GameServiceLevel, GameTransportMode } from './network'

export type GameMunicipalityRequestKind =
  | 'ADD_STATION'
  | 'ADD_LINE'
  | 'BOOST_SERVICE'

export type GameMunicipalityRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'REFUSED'
  | 'FAILED'
  | 'EXPIRED'

export interface GameMunicipalityRelation {
  code: string
  name: string
  departmentCode: string
  score: number
  completedRequests: number
  acceptedRequests: number
  negotiatedRequests: number
  refusedRequests: number
  failedRequests: number
  totalFundingGranted: number
  lastResolvedDay: number | null
}

export interface GameMunicipalityRequest {
  id: string
  municipalityCode: string
  municipalityName: string
  departmentCode: string
  population: number
  kind: GameMunicipalityRequestKind
  status: GameMunicipalityRequestStatus
  createdDay: number
  decisionDeadlineDay: number
  completionDeadlineDay: number | null
  resolvedDay: number | null
  initialStationCount: number
  initialLineCount: number
  targetStationCount: number | null
  targetLineCount: number | null
  targetLineId?: string
  targetLineName?: string
  initialServiceLevel?: GameServiceLevel
  targetServiceLevel?: GameServiceLevel
  initialVehicleCount?: number
  subsidyAmount: number
  originalSubsidyAmount: number
  /** Mode utilisé pour estimer l'offre initiale. Le versement final est recalculé selon le projet réellement livré. */
  referenceMode: GameTransportMode
  /** Multiplicateur issu de la négociation par rapport à l'offre de référence. */
  negotiatedFundingMultiplier: number
  /** Photo du réseau communal au moment de la proposition, utilisée pour identifier le projet livré. */
  initialLineIds: string[]
  initialLineStationCounts: Record<string, number>
  initialLineConstructionCosts: Record<string, number>
  fulfilledMode?: GameTransportMode
  eligibleProjectCost?: number
  negotiationCount: number
  negotiationStatus: 'NONE' | 'ACCEPTED' | 'COUNTERED' | 'WITHDRAWN'
}

export interface GameMunicipalitiesState {
  relations: GameMunicipalityRelation[]
  requests: GameMunicipalityRequest[]
  totalSubsidiesReceived: number
}
