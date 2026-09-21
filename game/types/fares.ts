import type {
  GameTransportMode,
} from './network'

export type GameFareLevel =
  | 'SOCIAL'
  | 'ACCESSIBLE'
  | 'STANDARD'
  | 'HIGH'

/**
 * CUSTOM reste accepté uniquement pour migrer les sauvegardes V13-V15.
 * BY_MODE est son équivalent explicite dans le Gros Lot 1.
 */
export type GameFareManagementMode =
  | 'GUIDED'
  | 'UNIFIED'
  | 'BY_MODE'
  | 'BY_LINE'
  | 'CUSTOM'

export interface GameSubscriptionOffer {
  enabled: boolean
  price: number
}

export interface GameSubscriptionPricing {
  day: GameSubscriptionOffer
  week: GameSubscriptionOffer
  month: GameSubscriptionOffer
  year: GameSubscriptionOffer
}

export type GameCustomTicketPrices = Record<
  GameTransportMode,
  number
>

export interface GameFareDiscountSettings {
  studentEnabled: boolean
  studentDiscountRate: number
  reducedEnabled: boolean
  reducedDiscountRate: number
  weekendDiscountEnabled: boolean
  weekendDiscountRate: number
}

export interface GameFareCompensationSettings {
  enabled: boolean
  defaultRefundRate: number
  disruptionQualityThreshold: number
}

export interface GameCustomFarePolicy {
  /** Prix réseau utilisé en mode UNIFIED. */
  unifiedTicketPrice: number
  /** Prix par mode utilisé en BY_MODE / ancien CUSTOM. */
  ticketPrices: GameCustomTicketPrices
  /** Surcharges/remplacements par ligne utilisés en BY_LINE. */
  lineTicketPrices: Record<string, number>
  subscriptions: GameSubscriptionPricing
  outsideTerritoryTicketEnabled: boolean
  outsideTerritoryTicketPrice: number
  discounts: GameFareDiscountSettings
  compensation: GameFareCompensationSettings
  /** Multiplicateur par jour JS : 0=dimanche ... 6=samedi. */
  weekdayMultipliers: Record<string, number>
}

export interface GameFareSettings {
  managementMode: GameFareManagementMode
  guidedLevel: GameFareLevel
  custom: GameCustomFarePolicy
}

export interface GameFareComputation {
  faceTicketPrice: number
  effectiveTicketPrice: number
  averageRevenuePerPassengerBeforeFraud: number
  demandMultiplier: number
  subscriptionPassengerShare: number
  dayPassShare: number
  weeklyPassShare: number
  monthlyPassShare: number
  annualPassShare: number
  outsideTerritoryShare: number
  discountPassengerShare: number
  calendarMultiplier: number
}
