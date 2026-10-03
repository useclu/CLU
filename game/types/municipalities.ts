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


export interface GameMunicipalityDevelopment {
  code: string
  /** Population du territoire au premier chargement de la partie. */
  basePopulation: number
  /** Population dynamique utilisée par la simulation à partir de Métropole 2.0. */
  population: number
  /** Accessibilité TC synthétique, 0 à 100. Sert au développement, pas à l'affichage d'un score obligatoire. */
  accessibility: number
  /** Variation appliquée lors du dernier jour simulé. */
  lastPopulationDelta: number
  /** Dernier jour où la commune a franchi un palier de croissance visible. */
  lastMilestoneDay: number | null
  /** Palier de croissance de 2 % atteint depuis la population de référence. */
  milestoneLevel: number
  lastUpdatedDay: number
}


export type GameUrbanProjectKind =
  | 'RESIDENTIAL_DISTRICT'
  | 'BUSINESS_DISTRICT'
  | 'CAMPUS'
  | 'LEISURE_HUB'

export type GameUrbanProjectStatus = 'PLANNED' | 'CONSTRUCTION' | 'OPENED' | 'MATURE'

export interface GameUrbanProject {
  id: string
  municipalityCode: string
  municipalityName: string
  kind: GameUrbanProjectKind
  title: string
  createdDay: number
  openingDay: number
  /** Début de chantier : la demande commence à monter avant l'ouverture. */
  constructionStartDay: number
  /** Fin de montée en puissance après l'ouverture. */
  maturityDay: number
  status: GameUrbanProjectStatus
  /** Habitants réellement ajoutés à l'ouverture du projet. */
  populationGain: number
  /** Surcroît de déplacements local généré une fois le projet ouvert. 0.10 = +10 %. */
  mobilityDemandBonus: number
  openedDay: number | null
  maturedDay: number | null
}

export type GameLocalEventKind = 'CONCERT' | 'FOOTBALL' | 'FESTIVAL' | 'EXHIBITION'
export type GameLocalEventScale = 'LOCAL' | 'MAJOR' | 'MEGA'
export type GameLocalEventStatus = 'ANNOUNCED' | 'ACTIVE' | 'FINISHED'
export type GameLocalEventServiceKind = 'REINFORCEMENT' | 'EVENT_SHUTTLE' | 'LATE_SERVICE'

export type GameLocalEventOutcomeTone = 'SUCCESS' | 'BALANCED' | 'OVERLOADED'

export interface GameLocalEventOutcome {
  resolvedDay: number
  transportedVisitors: number
  leftBehindVisitors: number
  serviceScore: number
  extraRevenue: number
  /** Coût réellement engagé par le joueur pour le service temporaire. */
  serviceCost: number
  /** Recettes événementielles estimées moins coût du service temporaire. */
  netImpact: number
  tone: GameLocalEventOutcomeTone
}

export interface GameLocalEvent {
  id: string
  municipalityCode: string
  municipalityName: string
  kind: GameLocalEventKind
  title: string
  createdDay: number
  startsDay: number
  endsDay: number
  expectedVisitors: number
  /** Envergure de l’événement, utilisée pour la pression voyageurs et le conseiller. */
  scale: GameLocalEventScale
  /** Multiplicateur de demande uniquement pour les lignes desservant cette commune. */
  demandMultiplier: number
  status: GameLocalEventStatus
  /** Préparation choisie par le joueur depuis Actions. */
  preparedLineId?: string
  preparationLevel?: 'LIGHT' | 'STRONG'
  /** Phase 15 : type de service temporaire préparé pour l'événement. */
  serviceKind?: GameLocalEventServiceKind
  /** Coût cumulé réellement engagé pour la préparation de cet événement. */
  serviceCost?: number
  preparedAtDay?: number
  /** Bilan calculé à la fin de l'événement pour donner un retour de gameplay concret. */
  outcome?: GameLocalEventOutcome
}

export interface GameMunicipalitiesState {
  relations: GameMunicipalityRelation[]
  requests: GameMunicipalityRequest[]
  totalSubsidiesReceived: number
  /** Métropole 2.0 : évolution territoriale persistée, ajoutée sans rendre les anciennes sauvegardes incompatibles. */
  development: GameMunicipalityDevelopment[]
  /** Métropole 2.0 Phase 14 : projets urbains qui rendent le territoire réellement évolutif. */
  urbanProjects?: GameUrbanProject[]
  /** Événements localisés : concert, match, festival… Ils modifient la demande du secteur. */
  localEvents?: GameLocalEvent[]
  nextUrbanProjectDay?: number
  nextLocalEventDay?: number
}
