import type {
  GameInfrastructureUpgradeKey,
  GameTransportMode,
} from '../types/network'

export const GAME_INFRASTRUCTURE_MAX_LEVEL = 3

export interface GameInfrastructureUpgradeDefinition {
  key: GameInfrastructureUpgradeKey
  label: string
  description: string
  shortEffect: string
  costShare: number
}

export const GAME_INFRASTRUCTURE_UPGRADES: GameInfrastructureUpgradeDefinition[] = [
  {
    key: 'capacity',
    label: 'Capacité',
    description: 'Renforce le débit admissible sur ce tronçon sans modifier le tracé.',
    shortEffect: '+15 % de capacité / niveau',
    costShare: 0.055,
  },
  {
    key: 'speed',
    label: 'Vitesse',
    description: 'Modernise la plateforme, la signalisation ou les priorités pour réduire le temps de parcours.',
    shortEffect: '+6 % de vitesse / niveau',
    costShare: 0.045,
  },
  {
    key: 'reliability',
    label: 'Fiabilité',
    description: 'Réduit la fragilité d’exploitation du tronçon et améliore la régularité.',
    shortEffect: '+8 points de robustesse / niveau',
    costShare: 0.035,
  },
]

/** Coefficient plancher pour éviter qu'un arrêt très proche rende une modernisation quasi gratuite. */
export const GAME_INFRASTRUCTURE_MIN_UPGRADE_COST: Record<GameTransportMode, number> = {
  METRO: 1_500_000,
  TRAM: 450_000,
  RER: 1_250_000,
  TRAIN: 1_000_000,
  BUS: 40_000,
  BRT: 180_000,
  CABLE: 280_000,
  FERRY: 80_000,
}

export function normalizeInfrastructureUpgradeLevel(value: unknown) {
  return Number.isFinite(value)
    ? Math.min(GAME_INFRASTRUCTURE_MAX_LEVEL, Math.max(0, Math.floor(Number(value))))
    : 0
}

export function getInfrastructureUpgradeDefinition(key: GameInfrastructureUpgradeKey) {
  return GAME_INFRASTRUCTURE_UPGRADES.find(item => item.key === key)!
}
