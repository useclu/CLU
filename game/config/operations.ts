import type {
  GameServiceLevel,
} from '../types/network'

export interface GameServiceLevelDefinition {
  value: GameServiceLevel
  label: string
  description: string
  departuresMultiplier: number
  demandMultiplier: number
  operatingCostMultiplier: number
}

/**
 * Première couche d'exploitation des lignes.
 *
 * Ces valeurs sont du balancing provisoire. Elles doivent rester
 * centralisées ici pour pouvoir être retravaillées sans toucher
 * au moteur ou aux composants.
 */
export const GAME_SERVICE_LEVELS:
GameServiceLevelDefinition[] = [
  {
    value: 'REDUCED',
    label: 'Réduit',
    description: 'Moins de passages, coût d’exploitation allégé.',
    departuresMultiplier: 0.6,
    demandMultiplier: 0.88,
    operatingCostMultiplier: 0.72,
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Niveau de service de référence.',
    departuresMultiplier: 1,
    demandMultiplier: 1,
    operatingCostMultiplier: 1,
  },
  {
    value: 'FREQUENT',
    label: 'Renforcé',
    description: 'Plus de passages et davantage de capacité.',
    departuresMultiplier: 1.35,
    demandMultiplier: 1.07,
    operatingCostMultiplier: 1.28,
  },
  {
    value: 'INTENSIVE',
    label: 'Intensif',
    description: 'Service très fréquent, performant mais coûteux.',
    departuresMultiplier: 1.7,
    demandMultiplier: 1.12,
    operatingCostMultiplier: 1.55,
  },
]

const GAME_SERVICE_LEVEL_VALUES = new Set<GameServiceLevel>(
  GAME_SERVICE_LEVELS.map(
    definition => definition.value,
  ),
)

export function isGameServiceLevel(
  value: unknown,
): value is GameServiceLevel {
  return typeof value === 'string'
    && GAME_SERVICE_LEVEL_VALUES.has(
      value as GameServiceLevel,
    )
}

export function getServiceLevelDefinition(
  level: GameServiceLevel,
): GameServiceLevelDefinition {
  return GAME_SERVICE_LEVELS.find(
    definition => definition.value === level,
  ) ?? GAME_SERVICE_LEVELS[1]!
}
