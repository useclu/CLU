import type {
  GameTransportMode,
} from '../types/network'

export const GAME_INITIAL_BUDGET = 4_000_000_000

/** Économie 2.0 / V24 : rythme de développement et crédit. */
export const GAME_PUBLIC_DEVELOPMENT_FIRST_DAY = 7
export const GAME_PUBLIC_DEVELOPMENT_PERIOD_DAYS = 7
export const GAME_PUBLIC_DEVELOPMENT_MIN_GRANT = 120_000_000
export const GAME_PUBLIC_DEVELOPMENT_MAX_GRANT = 650_000_000
export const GAME_MAX_BORROWS_PER_DAY = 3
/** V41 : limite la taille des sauvegardes longue durée sans perdre les totaux cumulés. */
export const GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT = 1200

export interface GameModeEconomyDefinition {
  mode: GameTransportMode
  infrastructurePerKm: number
  stationCost: number
}

/**
 * Valeurs de gameplay provisoires.
 *
 * Elles sont volontairement centralisées ici afin de pouvoir
 * rééquilibrer CLU Métropole sans toucher au moteur du jeu.
 */
export const GAME_MODE_ECONOMY:
Record<GameTransportMode, GameModeEconomyDefinition> = {
  METRO: {
    mode: 'METRO',
    infrastructurePerKm: 120_000_000,
    stationCost: 45_000_000,
  },

  TRAM: {
    mode: 'TRAM',
    infrastructurePerKm: 35_000_000,
    stationCost: 15_000_000,
  },

  RER: {
    mode: 'RER',
    infrastructurePerKm: 90_000_000,
    stationCost: 40_000_000,
  },

  TRAIN: {
    mode: 'TRAIN',
    infrastructurePerKm: 70_000_000,
    stationCost: 25_000_000,
  },

  BUS: {
    mode: 'BUS',
    infrastructurePerKm: 1_200_000,
    stationCost: 350_000,
  },

  BRT: {
    mode: 'BRT',
    infrastructurePerKm: 12_000_000,
    stationCost: 3_000_000,
  },
}

export function getModeEconomyDefinition(
  mode: GameTransportMode,
): GameModeEconomyDefinition {
  return GAME_MODE_ECONOMY[mode]
}
