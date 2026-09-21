import type {
  GameLine,
} from '../types/network'

export const GAME_CONTROLLER_DAILY_COST = 240
export const GAME_FINE_AMOUNT = 60
export const GAME_FINE_COLLECTION_RATE = 0.68
export const GAME_CONTROLLER_INSPECTIONS_PER_DAY = 420
export const GAME_BASE_FRAUD_RATE = 0.065
export const GAME_MIN_FRAUD_RATE = 0.012
export const GAME_MAX_FRAUD_RATE = 0.18
export const GAME_MAX_CONTROLLERS_PER_LINE = 100

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Le mode automatique donne une solution raisonnable aux joueurs qui ne
 * souhaitent pas microgérer le contrôle. Il n'est pas présenté comme un
 * optimum absolu : le mode personnalisé permet de reprendre la main.
 */
export function calculateAutomaticControllerCount(
  passengers: number,
) {
  if (passengers <= 0) {
    return 0
  }

  return Math.min(
    GAME_MAX_CONTROLLERS_PER_LINE,
    Math.max(
      1,
      Math.ceil(passengers / 12_000),
    ),
  )
}

export function normalizeControllerCount(
  value: number | undefined,
) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(
    GAME_MAX_CONTROLLERS_PER_LINE,
    Math.max(0, Math.floor(value ?? 0)),
  )
}

export interface GameInspectionResult {
  controllerCount: number
  controlCost: number
  fraudRate: number
  fraudPassengers: number
  inspectedPassengers: number
  detectedFraudPassengers: number
  finePayingPassengers: number
  fraudRevenueLoss: number
  fineRevenue: number
}

export function calculateInspectionResult(
  line: Pick<GameLine, 'inspectionMode' | 'controllerCount'>,
  passengers: number,
  revenuePerPassengerBeforeFraud: number,
  faceTicketPrice: number,
  moraleScore = 76,
): GameInspectionResult {
  const normalizedPassengers = Math.max(
    0,
    Math.round(passengers),
  )

  const controllerCount = line.inspectionMode === 'CUSTOM'
    ? normalizeControllerCount(line.controllerCount)
    : calculateAutomaticControllerCount(normalizedPassengers)

  const pricePressure = clamp(
    faceTicketPrice / 3,
    0.4,
    3,
  )

  const moralePressure = 1 + Math.max(0, 65 - clamp(moraleScore, 0, 100)) / 100 * 0.55

  const baseFraudRate = clamp(
    GAME_BASE_FRAUD_RATE * Math.pow(pricePressure, 0.28) * moralePressure,
    GAME_MIN_FRAUD_RATE,
    GAME_MAX_FRAUD_RATE,
  )

  const potentialInspectionCapacity =
    controllerCount * GAME_CONTROLLER_INSPECTIONS_PER_DAY

  const inspectionCoverage = normalizedPassengers > 0
    ? clamp(
        potentialInspectionCapacity / normalizedPassengers,
        0,
        1,
      )
    : 0

  const deterrence = 0.72 * Math.sqrt(
    inspectionCoverage,
  )

  const fraudRate = clamp(
    baseFraudRate * (1 - deterrence),
    GAME_MIN_FRAUD_RATE,
    GAME_MAX_FRAUD_RATE,
  )

  const fraudPassengers = Math.min(
    normalizedPassengers,
    Math.round(normalizedPassengers * fraudRate),
  )

  const inspectedPassengers = Math.min(
    normalizedPassengers,
    potentialInspectionCapacity,
  )

  const detectedFraudPassengers = Math.min(
    fraudPassengers,
    Math.round(
      inspectedPassengers
      * fraudRate
      * 0.72,
    ),
  )

  const fraudRevenueLoss = Math.max(
    0,
    Math.round(
      fraudPassengers
      * Math.max(0, revenuePerPassengerBeforeFraud),
    ),
  )

  const finePayingPassengers = Math.min(
    detectedFraudPassengers,
    Math.max(
      0,
      Math.round(
        detectedFraudPassengers
        * GAME_FINE_COLLECTION_RATE,
      ),
    ),
  )

  const fineRevenue = Math.max(
    0,
    finePayingPassengers * GAME_FINE_AMOUNT,
  )

  const controlCost = Math.max(
    0,
    Math.round(
      controllerCount * GAME_CONTROLLER_DAILY_COST,
    ),
  )

  return {
    controllerCount,
    controlCost,
    fraudRate,
    fraudPassengers,
    inspectedPassengers,
    detectedFraudPassengers,
    finePayingPassengers,
    fraudRevenueLoss,
    fineRevenue,
  }
}
