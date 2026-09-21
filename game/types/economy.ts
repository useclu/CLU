import type {
  GameCustomFarePolicy,
  GameFareLevel,
  GameFareManagementMode,
} from './fares'

import type {
  GameStationFacilityLevel,
  GameTransportMode,
} from './network'

export type GameEconomyTransactionKind =
  | 'STATION_CONSTRUCTION'
  | 'SEGMENT_CONSTRUCTION'
  | 'LINE_PROJECT'
  | 'LINE_MODIFICATION'
  | 'VEHICLE_PURCHASE'
  | 'VEHICLE_SALE'
  | 'FLEET_OVERHAUL'
  | 'FLEET_UPGRADE'
  | 'STATION_UPGRADE'
  | 'OBJECTIVE_REWARD'
  | 'MUNICIPALITY_SUBSIDY'
  | 'PUBLIC_DEVELOPMENT_GRANT'
  | 'PASSENGER_COMPENSATION'
  | 'DEBT_BORROW'
  | 'DEBT_REPAYMENT'
  | 'DEBT_INTEREST'
  | 'DEBT_PENALTY'

export interface GameEconomyTransaction {
  id: string
  kind: GameEconomyTransactionKind
  mode?: GameTransportMode
  lineId?: string
  lineName?: string
  amount: number
  createdAt: string
  stationId?: string
  segmentLengthKm?: number
  vehicleCount?: number
  vehicleUnitCost?: number
  fleetConditionBefore?: number
  stationFacilityBefore?: GameStationFacilityLevel
  stationFacilityAfter?: GameStationFacilityLevel
  note?: string
}

export interface GamePublicFundingBreakdown {
  base: number
  network: number
  territory: number
  passengers: number
  serviceQuality: number
  financialHealth: number
  debtAdjustment: number
  profileMultiplier: number
}

export interface GameEconomyState {
  /** Mode Triche : les coûts restent calculés mais ne diminuent pas la trésorerie. */
  unlimitedMoney: boolean
  fareLevel: GameFareLevel
  fareManagementMode: GameFareManagementMode
  customFarePolicy: GameCustomFarePolicy
  initialBudget: number
  balance: number
  /** Compatibilité V1-V15 : dépenses d'investissement cumulées. */
  totalSpent: number
  totalInvestment: number
  totalRevenue: number
  totalPassengerRevenue: number
  totalFineRevenue: number
  totalOperatingCosts: number
  totalSubsidies: number
  /** Dotations périodiques du secteur public, hors aides communales et objectifs. */
  totalPublicDevelopmentFunding: number
  totalObjectiveRewards: number
  publicFundingNextDay: number
  lastPublicFundingDay: number
  lastPublicFundingAmount: number
  lastPublicFundingBreakdown: GamePublicFundingBreakdown | null
  totalCompensationPaid: number
  debtPrincipal: number
  lastBorrowDay: number
  borrowCountOnLastDay: number
  totalInterestPaid: number
  debtNextPaymentDay: number
  debtMinimumPayment: number
  debtPaidThisPeriod: number
  debtMissedPayments: number
  totalDebtPenalties: number
  creditScore: number
  insolvencyStatus: 'OK' | 'WARNING' | 'BANKRUPT'
  transactions: GameEconomyTransaction[]
}
