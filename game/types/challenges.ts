import type { GameEconomyProfile, GameEventFrequency } from './freePlay'
import type { GameGeneratedTerritorySettings } from './generatedTerritory'
import type { GameTransportMode } from './network'
import type { GameTerritory } from './game'

export type GameChallengeKind = 'DAILY' | 'FRIEND_RANDOM' | 'FRIEND_CUSTOM'
export type GameChallengeDifficulty = 'STANDARD' | 'HARD' | 'EXTREME'
export type GameChallengeStatus = 'ACTIVE' | 'SUCCESS' | 'FAILED'
export type GameChallengeFinishReason = 'MANUAL' | 'TIME_LIMIT' | 'HARD_FAILURE'
export type GameChallengeObjectiveDirection = 'AT_LEAST' | 'AT_MOST'
export type GameChallengeObjectiveMetric =
  | 'TOTAL_PASSENGERS'
  | 'MUNICIPALITIES_SERVED'
  | 'MAX_DEBT'
  | 'SERVICE_QUALITY'
  | 'OPERATIONAL_LINES'
  | 'STATIONS'
  | 'MIN_BALANCE'

export interface GameChallengeObjective {
  id: string
  metric: GameChallengeObjectiveMetric
  direction: GameChallengeObjectiveDirection
  title: string
  description: string
  target: number
  weight: number
}

export interface GameChallengeDefinition {
  version: 1
  id: string
  kind: GameChallengeKind
  title: string
  dateKey?: string
  territory: GameTerritory
  generatedTerritory?: GameGeneratedTerritorySettings | null
  startingCapital: number
  economyProfile: GameEconomyProfile
  eventFrequency: GameEventFrequency
  durationMinutes: number
  difficulty: GameChallengeDifficulty
  allowedModes: GameTransportMode[]
  objectives: GameChallengeObjective[]
  constraints: string[]
}

export interface GameChallengeObjectiveResult extends GameChallengeObjective {
  value: number
  met: boolean
}

export interface GameChallengeResultStats {
  simulationDay: number
  totalPassengers: number
  operationalLines: number
  stations: number
  municipalitiesServed: number
  balance: number
  debt: number
  serviceQuality: number
}

export interface GameChallengeResult {
  status: Exclude<GameChallengeStatus, 'ACTIVE'>
  finishReason: GameChallengeFinishReason
  score: number
  playedSeconds: number
  finishedAt: string
  objectives: GameChallengeObjectiveResult[]
  stats: GameChallengeResultStats
}

export interface GameChallengeRuntime {
  definition: GameChallengeDefinition
  startedAt: string
  endsAt: string
  status: GameChallengeStatus
  readOnly: boolean
  finishReason?: GameChallengeFinishReason | null
  finishedAt?: string | null
  result?: GameChallengeResult | null
  /** Uniquement pour les archives du Défi du jour que le joueur a choisi de conserver. */
  archivedChallenge?: boolean
  expiresAt?: string | null
}

export interface GameChallengeResultEnvelope {
  version: 1
  definitionFingerprint: string
  definitionId: string
  result: GameChallengeResult
}
