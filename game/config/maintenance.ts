import type {
  GameMaintenanceLevel,
  GameServiceLevel,
} from '../types/network'

export interface GameMaintenanceLevelDefinition {
  value: GameMaintenanceLevel
  label: string
  description: string
  costMultiplier: number
  dailyConditionRecovery: number
  reliabilityMultiplier: number
}

/**
 * Maintenance V1.
 *
 * Les valeurs sont volontairement centralisées et provisoires : elles servent
 * à créer un arbitrage lisible entre coût, usure et disponibilité du parc.
 */
export const GAME_MAINTENANCE_LEVELS:
GameMaintenanceLevelDefinition[] = [
  {
    value: 'ECONOMY',
    label: 'Éco',
    description: 'Maintenance réduite : moins chère, mais l’état du parc se dégrade plus vite.',
    costMultiplier: 0.65,
    dailyConditionRecovery: 0.10,
    reliabilityMultiplier: 1.25,
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Maintenance de référence, équilibrée entre coût et fiabilité.',
    costMultiplier: 1,
    dailyConditionRecovery: 0.42,
    reliabilityMultiplier: 1,
  },
  {
    value: 'PREVENTIVE',
    label: 'Préventive',
    description: 'Maintenance renforcée : plus chère, mais améliore la disponibilité et restaure progressivement le parc.',
    costMultiplier: 1.45,
    dailyConditionRecovery: 0.80,
    reliabilityMultiplier: 0.65,
  },
]

export const GAME_DAILY_WEAR_BY_SERVICE_LEVEL:
Record<GameServiceLevel, number> = {
  REDUCED: 0.24,
  STANDARD: 0.42,
  FREQUENT: 0.62,
  INTENSIVE: 0.88,
}

/** Part maximale de la valeur du parc facturée pour une remise à neuf complète. */
export const GAME_FLEET_OVERHAUL_MAX_VALUE_SHARE = 0.08

const GAME_MAINTENANCE_LEVEL_VALUES = new Set<GameMaintenanceLevel>(
  GAME_MAINTENANCE_LEVELS.map(
    definition => definition.value,
  ),
)

export function isGameMaintenanceLevel(
  value: unknown,
): value is GameMaintenanceLevel {
  return typeof value === 'string'
    && GAME_MAINTENANCE_LEVEL_VALUES.has(
      value as GameMaintenanceLevel,
    )
}

export function getMaintenanceLevelDefinition(
  level: GameMaintenanceLevel,
): GameMaintenanceLevelDefinition {
  return GAME_MAINTENANCE_LEVELS.find(
    definition => definition.value === level,
  ) ?? GAME_MAINTENANCE_LEVELS[1]!
}
