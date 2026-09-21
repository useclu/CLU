import { currentGameLocaleTag } from '../../config/i18n'
import {
  GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT,
  GAME_INITIAL_BUDGET,
  GAME_MAX_BORROWS_PER_DAY,
  GAME_PUBLIC_DEVELOPMENT_FIRST_DAY,
  GAME_PUBLIC_DEVELOPMENT_MAX_GRANT,
  GAME_PUBLIC_DEVELOPMENT_MIN_GRANT,
  GAME_PUBLIC_DEVELOPMENT_PERIOD_DAYS,
  getModeEconomyDefinition,
} from '../../config/economy'
import { normalizeCustomFarePolicy } from '../../config/fares'
import {
  GAME_PROJECT_BASE_DAYS,
  GAME_PROJECT_DAYS_PER_10_KM,
  GAME_PROJECT_DAYS_PER_STATION,
  getInfrastructureDefinition,
} from '../../config/projects'

import type {
  GameEconomyState,
  GameEconomyTransaction,
  GamePublicFundingBreakdown,
  GameEconomyTransactionKind,
} from '../../types/economy'
import { getLineAllStations } from '../network/geometry'
import { getLinePathCoordinateSequences } from '../network/pathGeometry'

import type {
  GameLine,
  GameStation,
  GameStationFacilityLevel,
  GameTransportMode,
} from '../../types/network'

const EARTH_RADIUS_KM = 6371.0088
export const GAME_DAILY_DEBT_INTEREST_RATE = 0.00012
export const GAME_VEHICLE_SALE_VALUE_RATE = 0.55
export const GAME_DEBT_PAYMENT_PERIOD_DAYS = 30
export const GAME_DEBT_PENALTY_RATE = 0.08
export const GAME_MINIMUM_CREDIT_LIMIT = 250_000_000
export const GAME_MAXIMUM_CREDIT_LIMIT = 6_000_000_000

export function calculateCreditLimit(
  lineCount: number,
  totalOperatingRevenue = 0,
  totalInvestment = 0,
  creditScore = 100,
) {
  const networkValue = Math.max(0, Math.floor(lineCount)) * 180_000_000
  const assetValue = Math.max(0, totalInvestment) * 0.42
  const revenueValue = Math.min(2_000_000_000, Math.max(0, totalOperatingRevenue) * 2.5)
  const scoreMultiplier = 0.55 + Math.min(100, Math.max(0, creditScore)) / 100 * 0.45
  const raw = Math.min(
    GAME_MAXIMUM_CREDIT_LIMIT,
    GAME_MINIMUM_CREDIT_LIMIT + networkValue + assetValue + revenueValue,
  )
  return Math.max(GAME_MINIMUM_CREDIT_LIMIT, Math.round(raw * scoreMultiplier))
}

export interface GameBorrowRequestResult {
  ok: boolean
  code: 'OK' | 'CHEAT_MODE' | 'BANKRUPT' | 'DAILY_LIMIT' | 'NO_CREDIT' | 'INVALID_AMOUNT' | 'AMOUNT_TOO_HIGH'
  message: string
  transaction?: GameEconomyTransaction
  maximumAmount?: number
}

export interface GamePublicFundingResult {
  granted: boolean
  amount: number
  nextDay: number
  breakdown: GamePublicFundingBreakdown | null
}

function roundFunding(value: number) {
  return Math.round(value / 1_000_000) * 1_000_000
}

export function calculatePublicDevelopmentFunding(input: {
  operationalLineCount: number
  municipalitiesServed: number
  dailyPassengers: number
  serviceQualityScore: number
  dailyOperatingResult: number
  debtPrincipal: number
  creditLimit: number
  profile: 'GENEROUS' | 'STANDARD' | 'HARD'
}) {
  const operationalLineCount = Math.max(0, Math.floor(input.operationalLineCount))
  if (operationalLineCount <= 0) {
    return { amount: 0, breakdown: null as GamePublicFundingBreakdown | null }
  }

  const base = 90_000_000
  const network = Math.min(210_000_000, operationalLineCount * 35_000_000)
  const territory = Math.min(180_000_000, Math.max(0, input.municipalitiesServed) * 12_000_000)
  const passengers = Math.min(
    140_000_000,
    Math.sqrt(Math.max(0, input.dailyPassengers) / 100_000) * 45_000_000,
  )
  const serviceQuality = Math.min(
    60_000_000,
    Math.max(-40_000_000, (Math.max(0, input.serviceQualityScore) - 60) * 2_000_000),
  )
  const financialHealth = Math.min(
    50_000_000,
    Math.max(-50_000_000, input.dailyOperatingResult * 80),
  )
  const debtRatio = input.creditLimit > 0
    ? Math.max(0, input.debtPrincipal) / input.creditLimit
    : 0
  const debtAdjustment = -Math.min(55_000_000, Math.max(0, debtRatio - 0.35) * 85_000_000)
  const profileMultiplier = input.profile === 'GENEROUS' ? 1.15 : input.profile === 'HARD' ? 0.85 : 1

  const breakdown: GamePublicFundingBreakdown = {
    base: roundFunding(base),
    network: roundFunding(network),
    territory: roundFunding(territory),
    passengers: roundFunding(passengers),
    serviceQuality: roundFunding(serviceQuality),
    financialHealth: roundFunding(financialHealth),
    debtAdjustment: roundFunding(debtAdjustment),
    profileMultiplier,
  }
  const beforeProfile = breakdown.base + breakdown.network + breakdown.territory + breakdown.passengers
    + breakdown.serviceQuality + breakdown.financialHealth + breakdown.debtAdjustment
  const amount = Math.min(
    GAME_PUBLIC_DEVELOPMENT_MAX_GRANT,
    Math.max(GAME_PUBLIC_DEVELOPMENT_MIN_GRANT, roundFunding(beforeProfile * profileMultiplier)),
  )
  return { amount, breakdown }
}

export function canAffordInvestment(economy: GameEconomyState, amount: number) {
  if (economy.unlimitedMoney) return true
  return economy.insolvencyStatus !== 'BANKRUPT' && economy.balance >= Math.max(0, Math.round(amount))
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

export function distanceBetweenStationsKm(
  first: Pick<GameStation, 'longitude' | 'latitude'>,
  second: Pick<GameStation, 'longitude' | 'latitude'>,
): number {
  const latitude1 = toRadians(first.latitude)
  const latitude2 = toRadians(second.latitude)
  const deltaLatitude = toRadians(second.latitude - first.latitude)
  const deltaLongitude = toRadians(second.longitude - first.longitude)
  const haversine = (
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2)
    * Math.sin(deltaLongitude / 2) ** 2
  )
  const angle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return EARTH_RADIUS_KM * angle
}

export function createEmptyEconomy(startingBudget = GAME_INITIAL_BUDGET, unlimitedMoney = false): GameEconomyState {
  const budget = Number.isFinite(startingBudget) ? Math.max(0, Math.round(startingBudget)) : GAME_INITIAL_BUDGET
  return {
    unlimitedMoney,
    fareLevel: 'STANDARD',
    fareManagementMode: 'GUIDED',
    customFarePolicy: normalizeCustomFarePolicy(),
    initialBudget: budget,
    balance: budget,
    totalSpent: 0,
    totalInvestment: 0,
    totalRevenue: 0,
    totalPassengerRevenue: 0,
    totalFineRevenue: 0,
    totalOperatingCosts: 0,
    totalSubsidies: 0,
    totalPublicDevelopmentFunding: 0,
    totalObjectiveRewards: 0,
    publicFundingNextDay: GAME_PUBLIC_DEVELOPMENT_FIRST_DAY,
    lastPublicFundingDay: 0,
    lastPublicFundingAmount: 0,
    lastPublicFundingBreakdown: null,

    totalCompensationPaid: 0,
    debtPrincipal: 0,
    lastBorrowDay: 0,
    borrowCountOnLastDay: 0,
    totalInterestPaid: 0,

    debtNextPaymentDay: 0,
    debtMinimumPayment: 0,
    debtPaidThisPeriod: 0,
    debtMissedPayments: 0,
    totalDebtPenalties: 0,
    creditScore: 100,
    insolvencyStatus: 'OK',
    transactions: [],
  }
}

export function calculateStationConstructionCost(mode: GameTransportMode): number {
  return getModeEconomyDefinition(mode).stationCost
}

export function calculateSegmentConstructionCost(
  mode: GameTransportMode,
  lengthKm: number,
  infrastructureMultiplier = 1,
): number {
  const definition = getModeEconomyDefinition(mode)
  return Math.max(0, lengthKm * definition.infrastructurePerKm * infrastructureMultiplier)
}

export function calculateLineLengthKm(line: Pick<GameLine, 'stations' | 'branches' | 'routeSegments'>) {
  let total = 0
  for (const sequence of getLinePathCoordinateSequences(line)) {
    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1]!
      const current = sequence[index]!
      total += distanceBetweenStationsKm(
        { longitude: previous[0], latitude: previous[1] },
        { longitude: current[0], latitude: current[1] },
      )
    }
  }
  return total
}

export function calculateLineProjectCost(line: GameLine) {
  const infrastructure = getInfrastructureDefinition(line.mode, line.infrastructureType)
  const lengthKm = calculateLineLengthKm(line)
  const stationsCost = getLineAllStations(line).length * calculateStationConstructionCost(line.mode)
  const segmentsCost = calculateSegmentConstructionCost(
    line.mode,
    lengthKm,
    infrastructure.constructionCostMultiplier,
  )
  return Math.max(0, Math.round(stationsCost + segmentsCost))
}

export function calculateLineConstructionDays(line: GameLine) {
  const infrastructure = getInfrastructureDefinition(line.mode, line.infrastructureType)
  const lengthKm = calculateLineLengthKm(line)
  const raw = (
    GAME_PROJECT_BASE_DAYS
    + lengthKm / 10 * GAME_PROJECT_DAYS_PER_10_KM
    + getLineAllStations(line).length * GAME_PROJECT_DAYS_PER_STATION
  ) * infrastructure.constructionTimeMultiplier
  return Math.max(1, Math.ceil(raw))
}

function createTransaction(
  kind: GameEconomyTransactionKind,
  amount: number,
  line?: GameLine,
  options?: Partial<GameEconomyTransaction>,
): GameEconomyTransaction {
  return {
    id: createId(),
    kind,
    mode: line?.mode,
    lineId: line?.id,
    lineName: line?.name,
    amount,
    createdAt: new Date().toISOString(),
    ...options,
  }
}

function appendEconomyTransaction(
  economy: GameEconomyState,
  transaction: GameEconomyTransaction,
) {
  economy.transactions.push(transaction)
  if (economy.transactions.length > GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT) {
    economy.transactions.splice(
      0,
      economy.transactions.length - GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT,
    )
  }
  return transaction
}

function applyInvestment(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
  kind: GameEconomyTransactionKind,
  options?: Partial<GameEconomyTransaction>,
) {
  const normalizedAmount = Math.max(0, Math.round(amount))
  if (!canAffordInvestment(economy, normalizedAmount)) return null
  const transaction = createTransaction(kind, normalizedAmount, line, options)
  if (!economy.unlimitedMoney) economy.balance -= normalizedAmount
  economy.totalSpent += normalizedAmount
  economy.totalInvestment += normalizedAmount
  appendEconomyTransaction(economy, transaction)
  if (['STATION_CONSTRUCTION', 'SEGMENT_CONSTRUCTION', 'LINE_PROJECT', 'LINE_MODIFICATION'].includes(kind)) {
    line.constructionCost += normalizedAmount
  }
  return transaction
}

export function applyConstructionCost(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
  kind: GameEconomyTransactionKind,
  options?: Partial<GameEconomyTransaction>,
) {
  return applyInvestment(economy, line, amount, kind, options)
}

export function applyLineProjectCost(economy: GameEconomyState, line: GameLine) {
  const amount = calculateLineProjectCost(line)
  line.estimatedConstructionCost = amount
  return applyInvestment(economy, line, amount, 'LINE_PROJECT', {
    note: 'Lancement des travaux de la ligne',
  })
}

export function applyLineModificationCost(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
  note = 'Modification du tracé',
) {
  return applyInvestment(economy, line, amount, 'LINE_MODIFICATION', { note })
}

export function applyVehiclePurchaseCost(
  economy: GameEconomyState,
  line: GameLine,
  vehicleCount: number,
  vehicleUnitCost: number,
): GameEconomyTransaction | null {
  const count = Math.max(0, Math.floor(vehicleCount))
  const unit = Math.max(0, Math.round(vehicleUnitCost))
  if (count <= 0) return null
  return applyInvestment(economy, line, count * unit, 'VEHICLE_PURCHASE', {
    vehicleCount: count,
    vehicleUnitCost: unit,
  })
}

export function applyVehicleSale(
  economy: GameEconomyState,
  line: GameLine,
  vehicleCount: number,
  vehicleUnitCost: number,
) {
  const count = Math.max(0, Math.floor(vehicleCount))
  if (count <= 0) return null
  const amount = Math.max(0, Math.round(count * vehicleUnitCost * GAME_VEHICLE_SALE_VALUE_RATE))
  const transaction = createTransaction('VEHICLE_SALE', -amount, line, {
    vehicleCount: count,
    vehicleUnitCost,
    note: `Revente à ${Math.round(GAME_VEHICLE_SALE_VALUE_RATE * 100)} % de la valeur neuve`,
  })
  economy.balance += amount
  appendEconomyTransaction(economy, transaction)
  return transaction
}


export function applyFleetUpgradeCost(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
  note: string,
) {
  const normalized = Math.max(0, Math.round(amount))
  if (normalized <= 0) return null
  return applyInvestment(economy, line, normalized, 'FLEET_UPGRADE', { note })
}

export function applyFleetOverhaulCost(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
  fleetConditionBefore: number,
) {
  const normalized = Math.max(0, Math.round(amount))
  if (normalized <= 0) return null
  return applyInvestment(economy, line, normalized, 'FLEET_OVERHAUL', {
    fleetConditionBefore,
  })
}

export function applyObjectiveReward(
  economy: GameEconomyState,
  amount: number,
  note: string,
) {
  const normalized = Math.max(0, Math.round(amount))
  if (normalized <= 0) return null
  const transaction = createTransaction('OBJECTIVE_REWARD', -normalized, undefined, { note })
  economy.balance += normalized
  economy.totalObjectiveRewards += normalized
  appendEconomyTransaction(economy, transaction)
  return transaction
}

export function applyMunicipalitySubsidy(
  economy: GameEconomyState,
  amount: number,
  note: string,
) {
  const normalized = Math.max(0, Math.round(amount))
  if (normalized <= 0) return null
  const transaction = createTransaction('MUNICIPALITY_SUBSIDY', -normalized, undefined, { note })
  economy.balance += normalized
  economy.totalSubsidies += normalized
  appendEconomyTransaction(economy, transaction)
  return transaction
}

export function processPublicDevelopmentFunding(
  economy: GameEconomyState,
  day: number,
  input: Parameters<typeof calculatePublicDevelopmentFunding>[0],
): GamePublicFundingResult {
  const nextDueDay = Math.max(
    GAME_PUBLIC_DEVELOPMENT_FIRST_DAY,
    Math.floor(economy.publicFundingNextDay || GAME_PUBLIC_DEVELOPMENT_FIRST_DAY),
  )
  if (day < nextDueDay) {
    return { granted: false, amount: 0, nextDay: nextDueDay, breakdown: null }
  }

  const calculated = calculatePublicDevelopmentFunding(input)
  if (!calculated.amount || !calculated.breakdown) {
    // Pas de réseau exploité : la dotation reste disponible dès qu'une première ligne ouvre.
    economy.publicFundingNextDay = nextDueDay
    return { granted: false, amount: 0, nextDay: nextDueDay, breakdown: null }
  }

  const amount = calculated.amount
  const note = `Dotation publique de développement · réseau ${input.operationalLineCount} ligne(s) · ${input.municipalitiesServed} commune(s)`
  economy.balance += amount
  economy.totalPublicDevelopmentFunding += amount
  economy.lastPublicFundingDay = day
  economy.lastPublicFundingAmount = amount
  economy.lastPublicFundingBreakdown = calculated.breakdown
  economy.publicFundingNextDay = day + GAME_PUBLIC_DEVELOPMENT_PERIOD_DAYS
  appendEconomyTransaction(economy, createTransaction('PUBLIC_DEVELOPMENT_GRANT', -amount, undefined, { note }))
  return {
    granted: true,
    amount,
    nextDay: economy.publicFundingNextDay,
    breakdown: calculated.breakdown,
  }
}

export function applyPassengerCompensation(
  economy: GameEconomyState,
  line: GameLine,
  amount: number,
) {
  const normalized = Math.max(0, Math.round(amount))
  if (normalized <= 0) return null
  const transaction = createTransaction('PASSENGER_COMPENSATION', normalized, line, {
    note: 'Compensation voyageurs liée à une qualité de service dégradée',
  })
  if (!economy.unlimitedMoney) economy.balance -= normalized
  economy.totalOperatingCosts += normalized
  economy.totalCompensationPaid += normalized
  appendEconomyTransaction(economy, transaction)
  return transaction
}

export function borrowMoney(
  economy: GameEconomyState,
  amount: number,
  day: number,
  lineCount: number,
  creditMultiplier = 1,
): GameBorrowRequestResult {
  if (economy.unlimitedMoney) {
    return { ok: false, code: 'CHEAT_MODE', message: 'Les emprunts sont inutiles quand l’argent illimité est activé.' }
  }
  if (economy.insolvencyStatus === 'BANKRUPT') {
    return { ok: false, code: 'BANKRUPT', message: 'Aucun nouvel emprunt n’est possible en situation d’insolvabilité.' }
  }

  const currentDay = Math.max(1, Math.floor(day))
  const usedToday = economy.lastBorrowDay === currentDay ? Math.max(0, economy.borrowCountOnLastDay) : 0
  if (usedToday >= GAME_MAX_BORROWS_PER_DAY) {
    return { ok: false, code: 'DAILY_LIMIT', message: `Limite atteinte : ${GAME_MAX_BORROWS_PER_DAY} emprunts maximum par jour.` }
  }

  const operatingRevenue = Math.max(0, economy.totalPassengerRevenue + economy.totalFineRevenue)
  const creditLimit = Math.round(
    calculateCreditLimit(lineCount, operatingRevenue, economy.totalInvestment, economy.creditScore)
    * Math.max(0.2, creditMultiplier),
  )
  const remainingCapacity = Math.max(0, creditLimit - economy.debtPrincipal)
  if (remainingCapacity <= 0) {
    return { ok: false, code: 'NO_CREDIT', message: 'Votre capacité d’emprunt est entièrement utilisée.', maximumAmount: 0 }
  }

  const normalized = Math.max(0, Math.round(amount))
  if (normalized < 1_000_000) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'Le montant minimum d’un emprunt est de 1 M€.', maximumAmount: remainingCapacity }
  }
  if (normalized > remainingCapacity) {
    return {
      ok: false,
      code: 'AMOUNT_TOO_HIGH',
      message: `Montant trop élevé : vous pouvez encore emprunter au maximum ${new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(remainingCapacity)}.`,
      maximumAmount: remainingCapacity,
    }
  }

  economy.balance += normalized
  economy.debtPrincipal += normalized
  economy.lastBorrowDay = currentDay
  economy.borrowCountOnLastDay = usedToday + 1
  if (economy.debtNextPaymentDay <= currentDay) economy.debtNextPaymentDay = currentDay + GAME_DEBT_PAYMENT_PERIOD_DAYS
  economy.debtMinimumPayment = Math.max(1_000_000, Math.round(economy.debtPrincipal * 0.05))
  const transaction = createTransaction('DEBT_BORROW', -normalized, undefined, { note: `Emprunt ${economy.borrowCountOnLastDay}/${GAME_MAX_BORROWS_PER_DAY} aujourd’hui · plafond ${creditLimit.toLocaleString(currentGameLocaleTag())} €` })
  appendEconomyTransaction(economy, transaction)
  return { ok: true, code: 'OK', message: `Emprunt de ${new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(normalized)} accordé.`, transaction, maximumAmount: remainingCapacity - normalized }
}

export function repayDebt(economy: GameEconomyState, amount: number) {
  const normalized = Math.min(
    Math.max(0, Math.round(amount)),
    Math.max(0, Math.round(economy.debtPrincipal)),
    Math.max(0, Math.round(economy.balance)),
  )
  if (normalized <= 0) return null
  economy.balance -= normalized
  economy.debtPrincipal -= normalized
  economy.debtPaidThisPeriod += normalized
  economy.debtMinimumPayment = economy.debtPrincipal > 0
    ? Math.max(1_000_000, Math.round(economy.debtPrincipal * 0.05))
    : 0
  if (economy.debtPrincipal <= 0) {
    economy.debtNextPaymentDay = 0
    economy.debtPaidThisPeriod = 0
    economy.debtMissedPayments = 0
    economy.insolvencyStatus = 'OK'
  }
  const transaction = createTransaction('DEBT_REPAYMENT', normalized, undefined, { note: 'Remboursement du capital' })
  appendEconomyTransaction(economy, transaction)
  return transaction
}

export function applyDailyDebtInterest(economy: GameEconomyState) {
  if (economy.unlimitedMoney) return 0
  const interest = Math.max(0, Math.round(economy.debtPrincipal * GAME_DAILY_DEBT_INTEREST_RATE))
  if (interest <= 0) return 0
  economy.balance -= interest
  economy.totalOperatingCosts += interest
  economy.totalInterestPaid += interest
  appendEconomyTransaction(economy, createTransaction('DEBT_INTEREST', interest, undefined, { note: 'Intérêts quotidiens de la dette' }))
  return interest
}

export function processDebtDay(economy: GameEconomyState, day: number, lineCount: number, creditMultiplier = 1) {
  if (economy.unlimitedMoney) {
    economy.debtPrincipal = 0
    economy.debtMinimumPayment = 0
    economy.debtNextPaymentDay = 0
    economy.debtMissedPayments = 0
    economy.insolvencyStatus = 'OK'
    return { penalty: 0, bankrupt: false }
  }
  const creditLimit = Math.round(calculateCreditLimit(lineCount, economy.totalPassengerRevenue + economy.totalFineRevenue, economy.totalInvestment, economy.creditScore) * Math.max(0.2, creditMultiplier))
  if (economy.debtPrincipal <= 0) {
    economy.insolvencyStatus = 'OK'
    return { penalty: 0, bankrupt: false }
  }
  if (economy.debtNextPaymentDay <= 0) economy.debtNextPaymentDay = day + GAME_DEBT_PAYMENT_PERIOD_DAYS
  if (day < economy.debtNextPaymentDay) {
    economy.insolvencyStatus = economy.balance <= 0 && economy.debtPrincipal >= creditLimit * 0.9 ? 'WARNING' : 'OK'
    return { penalty: 0, bankrupt: false }
  }
  const shortfall = Math.max(0, economy.debtMinimumPayment - economy.debtPaidThisPeriod)
  let penalty = 0
  if (shortfall > 0) {
    penalty = Math.max(1_000_000, Math.round(shortfall * GAME_DEBT_PENALTY_RATE))
    economy.debtPrincipal += penalty
    economy.totalDebtPenalties += penalty
    economy.debtMissedPayments += 1
    economy.creditScore = Math.max(0, economy.creditScore - 15)
    appendEconomyTransaction(economy, createTransaction('DEBT_PENALTY', penalty, undefined, { note: `Échéance non respectée · pénalité de dette` }))
  } else {
    economy.creditScore = Math.min(100, economy.creditScore + 4)
    economy.debtMissedPayments = Math.max(0, economy.debtMissedPayments - 1)
  }
  economy.debtPaidThisPeriod = 0
  economy.debtNextPaymentDay = day + GAME_DEBT_PAYMENT_PERIOD_DAYS
  economy.debtMinimumPayment = Math.max(1_000_000, Math.round(economy.debtPrincipal * 0.05))
  const impossible = economy.debtMissedPayments >= 3 && economy.balance <= 0 && economy.debtPrincipal > creditLimit * 1.15
  economy.insolvencyStatus = impossible ? 'BANKRUPT' : (economy.debtMissedPayments > 0 || economy.balance <= 0 ? 'WARNING' : 'OK')
  return { penalty, bankrupt: impossible }
}
