import type {
  GameRollingStockUpgradeKey,
  GameRollingStockUpgrades,
  GameTransportMode,
} from '../types/network'

export interface GameRollingStockDefinition {
  mode: GameTransportMode
  vehicleLabel: string
  vehicleLabelPlural: string
  purchaseCost: number
  maintenanceCostPerVehiclePerDay: number
  turnaroundMinutes: number
}

export const GAME_ROLLING_STOCK:
Record<GameTransportMode, GameRollingStockDefinition> = {
  METRO: { mode: 'METRO', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 12_000_000, maintenanceCostPerVehiclePerDay: 4_500, turnaroundMinutes: 6 },
  TRAM: { mode: 'TRAM', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 4_000_000, maintenanceCostPerVehiclePerDay: 1_600, turnaroundMinutes: 6 },
  RER: { mode: 'RER', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 18_000_000, maintenanceCostPerVehiclePerDay: 6_500, turnaroundMinutes: 10 },
  TRAIN: { mode: 'TRAIN', vehicleLabel: 'train', vehicleLabelPlural: 'trains', purchaseCost: 15_000_000, maintenanceCostPerVehiclePerDay: 5_500, turnaroundMinutes: 15 },
  BUS: { mode: 'BUS', vehicleLabel: 'bus', vehicleLabelPlural: 'bus', purchaseCost: 350_000, maintenanceCostPerVehiclePerDay: 180, turnaroundMinutes: 8 },
  BRT: { mode: 'BRT', vehicleLabel: 'véhicule', vehicleLabelPlural: 'véhicules', purchaseCost: 650_000, maintenanceCostPerVehiclePerDay: 300, turnaroundMinutes: 8 },
}

export const GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL = 3

export interface GameRollingStockUpgradeDefinition {
  key: GameRollingStockUpgradeKey
  label: string
  description: string
  shortEffect: string
  costRate: number
}

/**
 * V22 : cinq améliorations volontairement simples. Elles s'appliquent au parc
 * d'une ligne dans son ensemble afin d'éviter une microgestion rame par rame.
 */
export const GAME_ROLLING_STOCK_UPGRADES: GameRollingStockUpgradeDefinition[] = [
  {
    key: 'capacity',
    label: 'Capacité',
    description: 'Plus de voyageurs par véhicule. Réduit la saturation sans ajouter de circulations.',
    shortEffect: '+10 % de places / niveau',
    costRate: 0.10,
  },
  {
    key: 'speed',
    label: 'Vitesse',
    description: 'Meilleure accélération et vitesse commerciale. Réduit le temps de trajet et le parc nécessaire.',
    shortEffect: '+6 % de vitesse / niveau',
    costRate: 0.12,
  },
  {
    key: 'reliability',
    label: 'Fiabilité',
    description: 'Réduit les indisponibilités liées à l’état du parc et stabilise le service.',
    shortEffect: '-16 % d’indisponibilité / niveau',
    costRate: 0.08,
  },
  {
    key: 'efficiency',
    label: 'Efficacité',
    description: 'Réduit les coûts de maintenance et une partie des coûts d’exploitation.',
    shortEffect: '-8 % maintenance / niveau',
    costRate: 0.09,
  },
  {
    key: 'boarding',
    label: 'Embarquement',
    description: 'Portes, circulation intérieure et procédures plus rapides : moins de temps perdu aux arrêts.',
    shortEffect: '-7 % de temps d’arrêt / niveau',
    costRate: 0.07,
  },
]

export function getRollingStockDefinition(mode: GameTransportMode): GameRollingStockDefinition {
  return GAME_ROLLING_STOCK[mode]
}

export function normalizeRollingStockUpgradeLevel(value: unknown) {
  return Number.isFinite(value)
    ? Math.min(GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL, Math.max(0, Math.floor(Number(value))))
    : 0
}

export function normalizeRollingStockUpgrades(value?: Partial<GameRollingStockUpgrades> | null): GameRollingStockUpgrades {
  return {
    capacity: normalizeRollingStockUpgradeLevel(value?.capacity),
    speed: normalizeRollingStockUpgradeLevel(value?.speed),
    reliability: normalizeRollingStockUpgradeLevel(value?.reliability),
    efficiency: normalizeRollingStockUpgradeLevel(value?.efficiency),
    boarding: normalizeRollingStockUpgradeLevel(value?.boarding),
  }
}

export function getRollingStockUpgradeDefinition(key: GameRollingStockUpgradeKey) {
  return GAME_ROLLING_STOCK_UPGRADES.find(item => item.key === key)!
}
