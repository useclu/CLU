import type {
  GameTransportMode,
} from '../types/network'

export interface GameModeDemandDefinition {
  mode: GameTransportMode
  /** Part de la population desservie susceptible d'utiliser la ligne chaque jour. */
  dailyPopulationCaptureRate: number
  /** Bonus local lorsqu'une même commune possède plusieurs stations de la ligne. */
  additionalStationCoverage: number
  maxStationCoverageMultiplier: number
  /** Bonus de portée : une ligne qui relie plusieurs bassins crée des OD supplémentaires. */
  networkReachBonusPerMunicipality: number
  maxNetworkReachBonus: number
  /** Bonus de maillage propre à la ligne, borné pour éviter les effets exponentiels. */
  networkStationBonus: number
  maxNetworkStationBonus: number
  uncoveredStationFallbackPassengers: number
}

/**
 * V50 — Demande territoriale 2.1.
 *
 * Les premières valeurs territoriales sous-estimaient fortement les grandes lignes :
 * la population de chaque commune était captée localement, mais le moteur ne valorisait
 * presque pas le fait de RELIER plusieurs bassins entre eux. Une ligne de RER longue et
 * structurante pouvait donc rester autour de 100 000 voyageurs alors qu'elle traversait
 * plusieurs millions d'habitants.
 *
 * Ces paramètres restent des valeurs de gameplay, pas des statistiques officielles.
 * Ils sont centralisés ici pour pouvoir être rééquilibrés sans migration de sauvegarde.
 */
export const GAME_MODE_DEMAND:
Record<GameTransportMode, GameModeDemandDefinition> = {
  METRO: {
    mode: 'METRO',
    dailyPopulationCaptureRate: 0.055,
    additionalStationCoverage: 0.14,
    maxStationCoverageMultiplier: 1.8,
    networkReachBonusPerMunicipality: 0.025,
    maxNetworkReachBonus: 0.35,
    networkStationBonus: 0.012,
    maxNetworkStationBonus: 0.28,
    uncoveredStationFallbackPassengers: 7_500,
  },

  TRAM: {
    mode: 'TRAM',
    dailyPopulationCaptureRate: 0.024,
    additionalStationCoverage: 0.12,
    maxStationCoverageMultiplier: 1.65,
    networkReachBonusPerMunicipality: 0.03,
    maxNetworkReachBonus: 0.48,
    networkStationBonus: 0.010,
    maxNetworkStationBonus: 0.24,
    uncoveredStationFallbackPassengers: 3_500,
  },

  RER: {
    mode: 'RER',
    dailyPopulationCaptureRate: 0.050,
    additionalStationCoverage: 0.16,
    maxStationCoverageMultiplier: 1.75,
    networkReachBonusPerMunicipality: 0.045,
    maxNetworkReachBonus: 0.90,
    networkStationBonus: 0.018,
    maxNetworkStationBonus: 0.42,
    uncoveredStationFallbackPassengers: 12_000,
  },

  TRAIN: {
    mode: 'TRAIN',
    dailyPopulationCaptureRate: 0.026,
    additionalStationCoverage: 0.13,
    maxStationCoverageMultiplier: 1.6,
    networkReachBonusPerMunicipality: 0.040,
    maxNetworkReachBonus: 0.72,
    networkStationBonus: 0.014,
    maxNetworkStationBonus: 0.34,
    uncoveredStationFallbackPassengers: 7_000,
  },

  BUS: {
    mode: 'BUS',
    dailyPopulationCaptureRate: 0.009,
    additionalStationCoverage: 0.08,
    maxStationCoverageMultiplier: 1.45,
    networkReachBonusPerMunicipality: 0.018,
    maxNetworkReachBonus: 0.24,
    networkStationBonus: 0.006,
    maxNetworkStationBonus: 0.14,
    uncoveredStationFallbackPassengers: 1_000,
  },

  BRT: {
    mode: 'BRT',
    dailyPopulationCaptureRate: 0.016,
    additionalStationCoverage: 0.10,
    maxStationCoverageMultiplier: 1.55,
    networkReachBonusPerMunicipality: 0.025,
    maxNetworkReachBonus: 0.38,
    networkStationBonus: 0.008,
    maxNetworkStationBonus: 0.18,
    uncoveredStationFallbackPassengers: 2_000,
  },

  CABLE: {
    mode: 'CABLE',
    dailyPopulationCaptureRate: 0.018,
    additionalStationCoverage: 0.09,
    maxStationCoverageMultiplier: 1.5,
    networkReachBonusPerMunicipality: 0.028,
    maxNetworkReachBonus: 0.42,
    networkStationBonus: 0.008,
    maxNetworkStationBonus: 0.18,
    uncoveredStationFallbackPassengers: 2_200,
  },

  FERRY: {
    mode: 'FERRY',
    dailyPopulationCaptureRate: 0.011,
    additionalStationCoverage: 0.08,
    maxStationCoverageMultiplier: 1.45,
    networkReachBonusPerMunicipality: 0.022,
    maxNetworkReachBonus: 0.32,
    networkStationBonus: 0.006,
    maxNetworkStationBonus: 0.16,
    uncoveredStationFallbackPassengers: 1_400,
  },
}

export const GAME_DEMAND_MULTI_MUNICIPALITY_BONUS = 0.035
export const GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX = 0.28

/**
 * V50 : plusieurs lignes dans une même commune se partagent toujours une partie de la
 * demande, mais beaucoup moins brutalement qu'avant. Un grand pôle multimodal ne divise
 * pas mécaniquement sa fréquentation par racine carrée du nombre de lignes : le réseau
 * complet crée lui-même de nouveaux déplacements et des correspondances.
 */
export const GAME_DEMAND_COMPETITION_EXPONENT = 0.30

export function getModeDemandDefinition(
  mode: GameTransportMode,
): GameModeDemandDefinition {
  return GAME_MODE_DEMAND[mode]
}
