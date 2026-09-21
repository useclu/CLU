export type GameEventEffect =
  | { kind: 'BALANCE'; amount: number }
  | { kind: 'DEMAND_MULTIPLIER'; multiplier: number; durationDays: number; label: string }
  | { kind: 'REVENUE_MULTIPLIER'; multiplier: number; durationDays: number; label: string }
  | { kind: 'OPERATING_COST_MULTIPLIER'; multiplier: number; durationDays: number; label: string }

export interface GameEventChoice {
  id: string
  label: string
  description: string
  effects: GameEventEffect[]
}

export interface GameEventDefinition {
  id: string
  eyebrow: string
  title: string
  description: string
  minDay: number
  minOperationalLines: number
  maxBalance?: number
  minBalance?: number
  minPassengers?: number
  minServiceQualityScore?: number
  maxServiceQualityScore?: number
  maxDemandSatisfactionRate?: number
  minDemandSatisfactionRate?: number
  minCongestedStations?: number
  minDebtPrincipal?: number
  maxDebtPrincipal?: number
  requirePositiveOperatingResult?: boolean
  choices: GameEventChoice[]
}

export interface GameEventContext {
  passengers: number
  serviceQualityScore: number
  demandSatisfactionRate: number
  congestedStationCount: number
  dailyOperatingResult: number
  debtPrincipal: number
}

export interface GameActiveEvent {
  id: string
  definitionId: string
  eyebrow: string
  title: string
  description: string
  createdDay: number
  decisionDeadlineDay: number
  choices: GameEventChoice[]
}

export type GameEventModifierKind = 'DEMAND_MULTIPLIER' | 'REVENUE_MULTIPLIER' | 'OPERATING_COST_MULTIPLIER'

export interface GameEventModifier {
  id: string
  sourceEventId: string
  sourceTitle: string
  kind: GameEventModifierKind
  multiplier: number
  label: string
  startsDay: number
  endsDay: number
}

export interface GameEventHistoryEntry {
  id: string
  definitionId: string
  eyebrow?: string
  title: string
  description?: string
  createdDay: number
  resolvedDay: number
  status: 'RESOLVED' | 'EXPIRED'
  choiceId: string | null
  choiceLabel: string | null
  choiceDescription?: string | null
  balanceImpact: number
}

export interface GameEventsState {
  active: GameActiveEvent | null
  history: GameEventHistoryEntry[]
  modifiers: GameEventModifier[]
  nextEligibleDay: number
  totalResolved: number
  totalBalanceImpact: number
}
