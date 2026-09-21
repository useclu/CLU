export type GameStatisticsMilestoneKind =
  | 'LINE_LAUNCHED'
  | 'LINE_DELETED'
  | 'OBJECTIVE_COMPLETED'
  | 'PASSENGER_RECORD'
  | 'OPERATING_RECORD'

export interface GameStatisticsMilestone {
  id: string
  kind: GameStatisticsMilestoneKind
  day: number
  title: string
  detail: string
  amount?: number
}

export interface GameStatisticsRecord {
  value: number
  day: number
}

export interface GameStatisticsRecords {
  dailyPassengers: GameStatisticsRecord
  dailyOperatingProfit: GameStatisticsRecord
  highestDebt: GameStatisticsRecord
  highestBalance: GameStatisticsRecord
  networkLengthKm: GameStatisticsRecord
  lineCount: GameStatisticsRecord
}

export interface GameStatisticsEconomyTotals {
  investment: number
  passengerRevenue: number
  fineRevenue: number
  operatingCosts: number
  subsidies: number
  publicDevelopmentFunding: number
  objectiveRewards: number
  interestPaid: number
  debtPenalties: number
  compensationPaid: number
}

export interface GameWeeklySnapshot {
  week: number
  startDay: number
  endDay: number
  capturedDay: number
  completed: boolean
  reconstructed?: boolean

  reportedDays: number
  passengers: number
  lostPassengers: number
  revenue: number
  operatingCost: number
  netResult: number
  averageServiceQuality: number | null
  averageDemandSatisfaction: number | null
  averageMorale: number | null
  averageWaitMinutes: number | null
  peakPassengers: number
  peakPassengersDay: number | null

  balance: number | null
  debt: number | null
  lineCount: number | null
  operationalLineCount: number | null
  constructionLineCount: number | null
  stationCount: number | null
  vehicleCount: number | null
  networkLengthKm: number | null
  municipalitiesServed: number | null

  economyTotals: GameStatisticsEconomyTotals | null
}

export interface GameStatisticsState {
  /** Jour à partir duquel la V28 peut garantir les snapshots structurels complets. */
  trackingStartedDay: number
  migratedFromOlderSave: boolean

  linesLaunched: number
  linesDeleted: number
  stationsBuilt: number
  stationsRemoved: number
  vehiclesPurchased: number
  vehiclesSold: number

  baselineEconomyTotals: GameStatisticsEconomyTotals
  weeks: GameWeeklySnapshot[]
  records: GameStatisticsRecords
  milestones: GameStatisticsMilestone[]
}
