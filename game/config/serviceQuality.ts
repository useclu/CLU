import type {
  GameTransportMode,
} from '../types/network'

export const GAME_SERVICE_QUALITY_NEUTRAL_SCORE = 78
export const GAME_SERVICE_QUALITY_MIN_DEMAND_MULTIPLIER = 0.8
export const GAME_SERVICE_QUALITY_MAX_DEMAND_MULTIPLIER = 1.08

/**
 * Espacement à partir duquel le temps de parcours n'est plus pénalisé par
 * des arrêts excessivement rapprochés. Valeurs de gameplay provisoires.
 */
export const GAME_IDEAL_MIN_STATION_SPACING_KM:
Record<GameTransportMode, number> = {
  METRO: 0.8,
  TRAM: 0.5,
  RER: 2.2,
  TRAIN: 3.2,
  BUS: 0.3,
  BRT: 0.55,
}

export function clampServiceQualityScore(
  value: number,
) {
  if (!Number.isFinite(value)) {
    return GAME_SERVICE_QUALITY_NEUTRAL_SCORE
  }

  return Math.min(100, Math.max(0, value))
}

export function serviceQualityDemandMultiplier(
  score: number,
) {
  const normalized = clampServiceQualityScore(score)

  return Math.min(
    GAME_SERVICE_QUALITY_MAX_DEMAND_MULTIPLIER,
    Math.max(
      GAME_SERVICE_QUALITY_MIN_DEMAND_MULTIPLIER,
      1 + (normalized - GAME_SERVICE_QUALITY_NEUTRAL_SCORE) * 0.0035,
    ),
  )
}

export function serviceQualityLabel(
  score: number,
) {
  const normalized = clampServiceQualityScore(score)

  if (normalized >= 88) {
    return 'Excellente'
  }

  if (normalized >= 76) {
    return 'Bonne'
  }

  if (normalized >= 62) {
    return 'Correcte'
  }

  if (normalized >= 48) {
    return 'Dégradée'
  }

  return 'Mauvaise'
}
