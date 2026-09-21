import type {
  GameCustomFarePolicy,
  GameFareComputation,
  GameFareLevel,
  GameFareManagementMode,
  GameFareSettings,
  GameSubscriptionOffer,
} from '../types/fares'

import type {
  GameTransportMode,
} from '../types/network'

export interface GameFareLevelDefinition {
  value: GameFareLevel
  label: string
  description: string
  averageRevenuePerPassenger: number
  demandMultiplier: number
}

export const GAME_FARE_LEVELS: GameFareLevelDefinition[] = [
  {
    value: 'SOCIAL',
    label: 'Social',
    description: 'Prix bas, fréquentation favorisée et rendement unitaire réduit.',
    averageRevenuePerPassenger: 0.75,
    demandMultiplier: 1.15,
  },
  {
    value: 'ACCESSIBLE',
    label: 'Accessible',
    description: 'Tarification modérée qui favorise légèrement la fréquentation.',
    averageRevenuePerPassenger: 0.95,
    demandMultiplier: 1.07,
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Tarification de référence pour jouer sans microgérer les prix.',
    averageRevenuePerPassenger: 1.15,
    demandMultiplier: 1,
  },
  {
    value: 'HIGH',
    label: 'Élevé',
    description: 'Rendement unitaire supérieur, avec une demande plus sensible au prix.',
    averageRevenuePerPassenger: 1.55,
    demandMultiplier: 0.88,
  },
]

export const GAME_REFERENCE_TICKET_PRICE: Record<GameTransportMode, number> = {
  METRO: 2.5,
  TRAM: 2,
  RER: 3,
  TRAIN: 4,
  BUS: 2,
  BRT: 2.2,
}

export const GAME_DEFAULT_CUSTOM_FARE_POLICY: GameCustomFarePolicy = {
  unifiedTicketPrice: 2.5,
  ticketPrices: {
    METRO: 2.5,
    TRAM: 2,
    RER: 3,
    TRAIN: 4,
    BUS: 2,
    BRT: 2.2,
  },
  lineTicketPrices: {},
  subscriptions: {
    day: { enabled: true, price: 8 },
    week: { enabled: true, price: 28 },
    month: { enabled: true, price: 75 },
    year: { enabled: true, price: 780 },
  },
  outsideTerritoryTicketEnabled: false,
  outsideTerritoryTicketPrice: 6,
  discounts: {
    studentEnabled: false,
    studentDiscountRate: 0.5,
    reducedEnabled: false,
    reducedDiscountRate: 0.35,
    weekendDiscountEnabled: false,
    weekendDiscountRate: 0.5,
  },
  compensation: {
    enabled: false,
    defaultRefundRate: 0.25,
    disruptionQualityThreshold: 45,
  },
  weekdayMultipliers: {
    '0': 1,
    '1': 1,
    '2': 1,
    '3': 1,
    '4': 1,
    '5': 1,
    '6': 1,
  },
}

export const GAME_DEFAULT_FARE_SETTINGS: GameFareSettings = {
  managementMode: 'GUIDED',
  guidedLevel: 'STANDARD',
  custom: GAME_DEFAULT_CUSTOM_FARE_POLICY,
}

export const GAME_MIN_TICKET_PRICE = 0
export const GAME_MAX_TICKET_PRICE = 100_000
export const GAME_MIN_SUBSCRIPTION_PRICE = 0
export const GAME_MAX_DAY_PASS_PRICE = 100_000
export const GAME_MAX_WEEK_PASS_PRICE = 100_000
export const GAME_MAX_MONTH_PASS_PRICE = 500
export const GAME_MAX_YEAR_PASS_PRICE = 5_000

const GAME_FARE_LEVEL_VALUES = new Set<GameFareLevel>(
  GAME_FARE_LEVELS.map(definition => definition.value),
)

export function isGameFareLevel(value: unknown): value is GameFareLevel {
  return typeof value === 'string'
    && GAME_FARE_LEVEL_VALUES.has(value as GameFareLevel)
}

export function isGameFareManagementMode(
  value: unknown,
): value is GameFareManagementMode {
  return [
    'GUIDED',
    'UNIFIED',
    'BY_MODE',
    'BY_LINE',
    'CUSTOM',
  ].includes(String(value))
}

export function getFareLevelDefinition(level: GameFareLevel) {
  return GAME_FARE_LEVELS.find(definition => definition.value === level)
    ?? GAME_FARE_LEVELS[2]!
}

export function clampFareAmount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100))
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function enabledOfferAttractiveness(
  offer: GameSubscriptionOffer,
  referenceTripBudget: number,
  maxShare: number,
) {
  if (!offer.enabled || referenceTripBudget <= 0) return 0
  const ratio = offer.price / referenceTripBudget
  return clamp01(1.35 - ratio) * maxShare
}

export interface GameFareCalculationOptions {
  managementMode?: GameFareManagementMode
  lineId?: string
  outsideTerritoryShare?: number
  weekdayIndex?: number
}

/**
 * Calcul agrégé : les pass et réductions sont ramenés à une recette moyenne
 * par voyageur. Cela donne une vraie profondeur de gestion sans simuler chaque
 * abonnement individuel.
 */
export function calculateCustomFare(
  mode: GameTransportMode,
  policy: GameCustomFarePolicy,
  outsideTerritoryShareOrOptions: number | GameFareCalculationOptions = 0,
): GameFareComputation {
  const options: GameFareCalculationOptions =
    typeof outsideTerritoryShareOrOptions === 'number'
      ? { outsideTerritoryShare: outsideTerritoryShareOrOptions }
      : outsideTerritoryShareOrOptions

  const managementMode = options.managementMode === 'CUSTOM'
    ? 'BY_MODE'
    : options.managementMode ?? 'BY_MODE'

  const modePrice = policy.ticketPrices[mode]
  const linePrice = options.lineId
    ? policy.lineTicketPrices[options.lineId]
    : undefined

  // Une ligne peut avoir une exception tarifaire sans changer la politique
  // globale du réseau. Cela permet par exemple un prix unifié partout, avec
  // un tarif propre sur une seule ligne. BY_LINE reste accepté pour les
  // anciennes sauvegardes, mais l’override est désormais indépendant du mode.
  const rawBasePrice = Number.isFinite(linePrice)
    ? Number(linePrice)
    : managementMode === 'UNIFIED'
      ? policy.unifiedTicketPrice
      : modePrice

  const baseTicketPrice = clampFareAmount(
    rawBasePrice,
    GAME_MIN_TICKET_PRICE,
    GAME_MAX_TICKET_PRICE,
  )

  const outsideTerritoryShare = clamp01(
    options.outsideTerritoryShare ?? 0,
  )

  const outsideTicketPrice = clampFareAmount(
    policy.outsideTerritoryTicketPrice,
    GAME_MIN_TICKET_PRICE,
    GAME_MAX_TICKET_PRICE,
  )

  const weekday = Math.min(6, Math.max(0, Math.floor(options.weekdayIndex ?? 1)))
  const calendarMultiplier = Math.min(
    100,
    Math.max(0, Number(policy.weekdayMultipliers[String(weekday)] ?? 1)),
  )

  let effectiveTicketPrice = (
    policy.outsideTerritoryTicketEnabled
      ? baseTicketPrice * (1 - outsideTerritoryShare)
        + outsideTicketPrice * outsideTerritoryShare
      : baseTicketPrice
  ) * calendarMultiplier

  const discounts = policy.discounts
  const studentShare = discounts.studentEnabled ? 0.12 : 0
  const reducedShare = discounts.reducedEnabled ? 0.10 : 0
  const weekend = weekday === 0 || weekday === 6
  const weekendShare = discounts.weekendDiscountEnabled && weekend ? 0.38 : 0

  const studentDiscount = clamp01(discounts.studentDiscountRate)
  const reducedDiscount = clamp01(discounts.reducedDiscountRate)
  const weekendDiscount = clamp01(discounts.weekendDiscountRate)

  const discountPassengerShare = Math.min(
    0.72,
    studentShare + reducedShare + weekendShare,
  )

  const discountRevenueFactor = Math.max(
    0.08,
    1
      - studentShare * studentDiscount
      - reducedShare * reducedDiscount
      - weekendShare * weekendDiscount,
  )

  effectiveTicketPrice *= discountRevenueFactor

  const subscriptions = policy.subscriptions
  const dayShare = enabledOfferAttractiveness(
    subscriptions.day,
    Math.max(0.01, effectiveTicketPrice * 2.6),
    0.12,
  )
  const weekShare = enabledOfferAttractiveness(
    subscriptions.week,
    Math.max(0.01, effectiveTicketPrice * 11),
    0.18,
  )
  const monthShare = enabledOfferAttractiveness(
    subscriptions.month,
    Math.max(0.01, effectiveTicketPrice * 44),
    0.28,
  )
  const annualShare = enabledOfferAttractiveness(
    subscriptions.year,
    Math.max(0.01, effectiveTicketPrice * 480),
    0.28,
  )

  const rawSubscriptionShare = dayShare + weekShare + monthShare + annualShare
  const subscriptionPassengerShare = Math.min(0.68, rawSubscriptionShare)
  const subscriptionScale = rawSubscriptionShare > 0
    ? subscriptionPassengerShare / rawSubscriptionShare
    : 0

  const normalizedDayShare = dayShare * subscriptionScale
  const normalizedWeekShare = weekShare * subscriptionScale
  const normalizedMonthShare = monthShare * subscriptionScale
  const normalizedAnnualShare = annualShare * subscriptionScale
  const singleShare = Math.max(0, 1 - subscriptionPassengerShare)

  const dayRevenuePerTrip = subscriptions.day.enabled
    ? subscriptions.day.price / 2.6
    : effectiveTicketPrice
  const weekRevenuePerTrip = subscriptions.week.enabled
    ? subscriptions.week.price / 11
    : effectiveTicketPrice
  const monthRevenuePerTrip = subscriptions.month.enabled
    ? subscriptions.month.price / 44
    : effectiveTicketPrice
  const annualRevenuePerTrip = subscriptions.year.enabled
    ? subscriptions.year.price / 480
    : effectiveTicketPrice

  const averageRevenuePerPassengerBeforeFraud = Math.max(
    0,
    effectiveTicketPrice * singleShare
      + dayRevenuePerTrip * normalizedDayShare
      + weekRevenuePerTrip * normalizedWeekShare
      + monthRevenuePerTrip * normalizedMonthShare
      + annualRevenuePerTrip * normalizedAnnualShare,
  )

  const referencePrice = GAME_REFERENCE_TICKET_PRICE[mode]
  const perceivedPriceRatio = referencePrice > 0
    ? effectiveTicketPrice / referencePrice
    : 1

  const priceEffect = Math.pow(
    Math.max(0.15, perceivedPriceRatio),
    -0.42,
  )
  const subscriptionAccessibilityBonus = 1 + subscriptionPassengerShare * 0.12
  const discountAccessibilityBonus = 1 + discountPassengerShare * 0.10

  const demandMultiplier = Math.min(
    1.65,
    Math.max(
      0.35,
      priceEffect
        * subscriptionAccessibilityBonus
        * discountAccessibilityBonus,
    ),
  )

  return {
    faceTicketPrice: baseTicketPrice,
    effectiveTicketPrice,
    averageRevenuePerPassengerBeforeFraud,
    demandMultiplier,
    subscriptionPassengerShare,
    dayPassShare: normalizedDayShare,
    weeklyPassShare: normalizedWeekShare,
    monthlyPassShare: normalizedMonthShare,
    annualPassShare: normalizedAnnualShare,
    outsideTerritoryShare,
    discountPassengerShare,
    calendarMultiplier,
  }
}

export function normalizeCustomFarePolicy(
  policy?: Partial<GameCustomFarePolicy> | null,
): GameCustomFarePolicy {
  const fallback = GAME_DEFAULT_CUSTOM_FARE_POLICY
  const ticketPrices = policy?.ticketPrices
  const subscriptions = policy?.subscriptions

  const normalizeSubscription = (
    value: Partial<GameSubscriptionOffer> | undefined,
    fallbackOffer: GameSubscriptionOffer,
    maxPrice: number,
  ): GameSubscriptionOffer => ({
    enabled: typeof value?.enabled === 'boolean'
      ? value.enabled
      : fallbackOffer.enabled,
    price: clampFareAmount(
      Number(value?.price ?? fallbackOffer.price),
      GAME_MIN_SUBSCRIPTION_PRICE,
      maxPrice,
    ),
  })

  const normalizeRate = (value: unknown, fallbackValue: number) => {
    const number = Number(value)
    return Number.isFinite(number)
      ? Math.min(1, Math.max(0, number))
      : fallbackValue
  }

  const discounts = policy?.discounts
  const compensation = policy?.compensation
  const weekdayMultipliers: Record<string, number> = {}
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const value = Number(policy?.weekdayMultipliers?.[String(weekday)] ?? 1)
    weekdayMultipliers[String(weekday)] = Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : 1
  }

  return {
    unifiedTicketPrice: clampFareAmount(
      Number(policy?.unifiedTicketPrice ?? fallback.unifiedTicketPrice),
      GAME_MIN_TICKET_PRICE,
      GAME_MAX_TICKET_PRICE,
    ),
    ticketPrices: {
      METRO: clampFareAmount(Number(ticketPrices?.METRO ?? fallback.ticketPrices.METRO), 0, GAME_MAX_TICKET_PRICE),
      TRAM: clampFareAmount(Number(ticketPrices?.TRAM ?? fallback.ticketPrices.TRAM), 0, GAME_MAX_TICKET_PRICE),
      RER: clampFareAmount(Number(ticketPrices?.RER ?? fallback.ticketPrices.RER), 0, GAME_MAX_TICKET_PRICE),
      TRAIN: clampFareAmount(Number(ticketPrices?.TRAIN ?? fallback.ticketPrices.TRAIN), 0, GAME_MAX_TICKET_PRICE),
      BUS: clampFareAmount(Number(ticketPrices?.BUS ?? fallback.ticketPrices.BUS), 0, GAME_MAX_TICKET_PRICE),
      BRT: clampFareAmount(Number(ticketPrices?.BRT ?? fallback.ticketPrices.BRT), 0, GAME_MAX_TICKET_PRICE),
    },
    lineTicketPrices: Object.fromEntries(
      Object.entries(policy?.lineTicketPrices ?? {})
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([key, value]) => [key, clampFareAmount(Number(value), 0, GAME_MAX_TICKET_PRICE)]),
    ),
    subscriptions: {
      day: normalizeSubscription(subscriptions?.day, fallback.subscriptions.day, GAME_MAX_DAY_PASS_PRICE),
      week: normalizeSubscription(subscriptions?.week, fallback.subscriptions.week, GAME_MAX_WEEK_PASS_PRICE),
      month: normalizeSubscription(subscriptions?.month, fallback.subscriptions.month, GAME_MAX_MONTH_PASS_PRICE),
      year: normalizeSubscription(subscriptions?.year, fallback.subscriptions.year, GAME_MAX_YEAR_PASS_PRICE),
    },
    outsideTerritoryTicketEnabled:
      typeof policy?.outsideTerritoryTicketEnabled === 'boolean'
        ? policy.outsideTerritoryTicketEnabled
        : fallback.outsideTerritoryTicketEnabled,
    outsideTerritoryTicketPrice: clampFareAmount(
      Number(policy?.outsideTerritoryTicketPrice ?? fallback.outsideTerritoryTicketPrice),
      0,
      GAME_MAX_TICKET_PRICE,
    ),
    discounts: {
      studentEnabled: Boolean(discounts?.studentEnabled ?? fallback.discounts.studentEnabled),
      studentDiscountRate: normalizeRate(discounts?.studentDiscountRate, fallback.discounts.studentDiscountRate),
      reducedEnabled: Boolean(discounts?.reducedEnabled ?? fallback.discounts.reducedEnabled),
      reducedDiscountRate: normalizeRate(discounts?.reducedDiscountRate, fallback.discounts.reducedDiscountRate),
      weekendDiscountEnabled: Boolean(discounts?.weekendDiscountEnabled ?? fallback.discounts.weekendDiscountEnabled),
      weekendDiscountRate: normalizeRate(discounts?.weekendDiscountRate, fallback.discounts.weekendDiscountRate),
    },
    compensation: {
      enabled: Boolean(compensation?.enabled ?? fallback.compensation.enabled),
      defaultRefundRate: normalizeRate(compensation?.defaultRefundRate, fallback.compensation.defaultRefundRate),
      disruptionQualityThreshold: Math.min(
        100,
        Math.max(0, Number(compensation?.disruptionQualityThreshold ?? fallback.compensation.disruptionQualityThreshold)),
      ),
    },
    weekdayMultipliers,
  }
}
