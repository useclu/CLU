import type {
  GameTransportMode,
} from '../types/network'
export interface GameModeDemandDefinition {
  mode: GameTransportMode
  dailyPopulationCaptureRate: number
  additionalStationCoverage: number
  maxStationCoverageMultiplier: number
  uncoveredStationFallbackPassengers: number
}

/**
 * Équilibrage V1 de la demande territoriale.
 *
 * Ce sont des paramètres de gameplay, pas des statistiques réelles.
 * Ils sont volontairement centralisés pour pouvoir être rééquilibrés
 * sans modifier le moteur, les sauvegardes ou l'interface.
 */
export const GAME_MODE_DEMAND:
Record<GameTransportMode, GameModeDemandDefinition> = {
  METRO: {
    mode: 'METRO',
    dailyPopulationCaptureRate: 0.018,
    additionalStationCoverage: 0.14,
    maxStationCoverageMultiplier: 1.8,
    uncoveredStationFallbackPassengers: 4_000,
  },

  TRAM: {
    mode: 'TRAM',
    dailyPopulationCaptureRate: 0.010,
    additionalStationCoverage: 0.12,
    maxStationCoverageMultiplier: 1.65,
    uncoveredStationFallbackPassengers: 2_000,
  },

  RER: {
    mode: 'RER',
    dailyPopulationCaptureRate: 0.016,
    additionalStationCoverage: 0.16,
    maxStationCoverageMultiplier: 1.75,
    uncoveredStationFallbackPassengers: 7_000,
  },

  TRAIN: {
    mode: 'TRAIN',
    dailyPopulationCaptureRate: 0.009,
    additionalStationCoverage: 0.13,
    maxStationCoverageMultiplier: 1.6,
    uncoveredStationFallbackPassengers: 4_000,
  },

  BUS: {
    mode: 'BUS',
    dailyPopulationCaptureRate: 0.0045,
    additionalStationCoverage: 0.08,
    maxStationCoverageMultiplier: 1.45,
    uncoveredStationFallbackPassengers: 650,
  },

  BRT: {
    mode: 'BRT',
    dailyPopulationCaptureRate: 0.0075,
    additionalStationCoverage: 0.10,
    maxStationCoverageMultiplier: 1.55,
    uncoveredStationFallbackPassengers: 1_300,
  },
}

export const GAME_DEMAND_MULTI_MUNICIPALITY_BONUS = 0.035
export const GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX = 0.28
export const GAME_DEMAND_COMPETITION_EXPONENT = 0.5

export function getModeDemandDefinition(
  mode: GameTransportMode,
): GameModeDemandDefinition {
  return GAME_MODE_DEMAND[mode]
}
