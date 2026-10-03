import type {
  GameEconomyState,
} from './economy'

import type {
  GameEventsState,
} from './events'

import type {
  GameMunicipalitiesState,
} from './municipalities'

import type {
  GameObjectivesState,
} from './objectives'

import type {
  GameNetworkState,
} from './network'

import type {
  GameSimulationState,
} from './simulation'

import type {
  GameFreePlaySettings,
} from './freePlay'

import type {
  GameStatisticsState,
} from './statistics'

import type {
  GameAssistantState,
} from './assistant'

import type {
  GameGeneratedTerritorySettings,
} from './generatedTerritory'

import type { GameChallengeRuntime } from './challenges'

import type { GameOperationsState } from './operations'

import type { GamePassengersState } from './passengers'

export type GameStatus =
  | 'HOME'
  | 'SETUP'
  | 'PLAYING'
  | 'PAUSED'

export type GameMode =
  | 'FREE'
  | 'CHALLENGE_DAILY'
  // Compatibilité de lecture/import des anciennes sauvegardes uniquement.
  | 'CHALLENGE_FRIEND'

export type GameTerritory =
  | 'ILE_DE_FRANCE'
  | 'LONDON'
  | 'BERLIN'
  | 'RANDSTAD'
  | 'BRUSSELS'
  | 'MADRID'
  | 'MILAN'
  | 'WARSAW'
  | 'LISBON'
  | 'PRAGUE'
  | 'BERN'
  | 'NEW_YORK'
  | 'OTTAWA'
  | 'TOKYO'
  | 'VIENNA'
  | 'COPENHAGEN'
  | 'STOCKHOLM'
  | 'OSLO'
  | 'HELSINKI'
  | 'ATHENS'
  | 'BUDAPEST'
  | 'ISTANBUL'
  | 'SAO_PAULO'
  | 'SYDNEY'
  | 'RABAT'
  | 'DUBAI'
  | 'DUBLIN'
  | 'KYIV'
  | 'MOSCOW'
  | 'NEW_DELHI'
  | 'RIYADH'
  | 'SEOUL'
  | 'ZAGREB'
  | 'ALGIERS'
  | 'BEIJING'
  | 'MEXICO_CITY'
  | 'CAIRO'
  | 'BUENOS_AIRES'
  | 'BOGOTA'
  | 'GENERATED'


export type GameManagementPanel = 'NETWORK' | 'FLEET' | 'PASSENGERS' | 'OPERATIONS' | 'MUNICIPALITIES' | 'FINANCES' | 'EVENTS' | 'OBJECTIVES'

export interface GameUiState {
  /** V45 : état des grands panneaux mémorisé par sauvegarde. */
  panelOpen: boolean
  selectedPanel: GameManagementPanel
}

export interface GameSaveData {
  simulationDay: number
  freePlaySettings: GameFreePlaySettings
  /** Date ISO YYYY-MM-DD correspondant au Jour 1. */
  calendarStartDate: string
  network: GameNetworkState
  economy: GameEconomyState
  simulation: GameSimulationState
  /** V47 : PCC, perturbations et décisions d'exploitation persistées. */
  operations: GameOperationsState
  /** V49 : files d'attente OD et synthèse Voyageurs 2.0. */
  passengers: GamePassengersState
  municipalities: GameMunicipalitiesState
  events: GameEventsState
  objectives: GameObjectivesState
  statistics: GameStatisticsState
  assistant: GameAssistantState
  /** Présent uniquement pour une carte fictive. La carte complète est régénérée localement depuis cette seed. */
  generatedTerritory?: GameGeneratedTerritorySettings | null
  /** Présent uniquement pour les modes Défi. Persisté pour conserver timer, règles et résultat. */
  challenge?: GameChallengeRuntime | null
  /** Préférences d'interface propres à cette sauvegarde. */
  uiState: GameUiState
}

export interface GameSave {
  id: string
  name: string
  version: number
  createdAt: string
  updatedAt: string
  mode: GameMode
  territory: GameTerritory
  data: GameSaveData
}

export interface GameState {
  version: number
  status: GameStatus
  save: GameSave | null
}
