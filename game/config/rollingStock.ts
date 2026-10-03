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

export interface GameRollingStockModelDefinition {
  id: string
  mode: GameTransportMode
  name: string
  generationLabel: string
  introducedYear: number
  composition: string
  lengthMeters: number
  capacity: number
  maxSpeedKmh: number
  /** Facteur appliqué à la vitesse commerciale historique du mode. */
  commercialSpeedMultiplier: number
  /** 0..1, affiché au joueur et converti en risque d'indisponibilité. */
  reliability: number
  /** Indice énergétique relatif : 1 conserve les coûts historiques du mode. */
  energyIndex: number
  purchaseCost: number
  maintenanceCostPerVehiclePerDay: number
}

export const GAME_ROLLING_STOCK:
Record<GameTransportMode, GameRollingStockDefinition> = {
  METRO: { mode: 'METRO', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 12_000_000, maintenanceCostPerVehiclePerDay: 4_500, turnaroundMinutes: 6 },
  TRAM: { mode: 'TRAM', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 4_000_000, maintenanceCostPerVehiclePerDay: 1_600, turnaroundMinutes: 6 },
  RER: { mode: 'RER', vehicleLabel: 'rame', vehicleLabelPlural: 'rames', purchaseCost: 18_000_000, maintenanceCostPerVehiclePerDay: 6_500, turnaroundMinutes: 10 },
  TRAIN: { mode: 'TRAIN', vehicleLabel: 'train', vehicleLabelPlural: 'trains', purchaseCost: 15_000_000, maintenanceCostPerVehiclePerDay: 5_500, turnaroundMinutes: 15 },
  BUS: { mode: 'BUS', vehicleLabel: 'bus', vehicleLabelPlural: 'bus', purchaseCost: 350_000, maintenanceCostPerVehiclePerDay: 180, turnaroundMinutes: 8 },
  BRT: { mode: 'BRT', vehicleLabel: 'véhicule', vehicleLabelPlural: 'véhicules', purchaseCost: 650_000, maintenanceCostPerVehiclePerDay: 300, turnaroundMinutes: 8 },
  CABLE: { mode: 'CABLE', vehicleLabel: 'cabine', vehicleLabelPlural: 'cabines', purchaseCost: 65_000, maintenanceCostPerVehiclePerDay: 22, turnaroundMinutes: 1 },
  FERRY: { mode: 'FERRY', vehicleLabel: 'bateau', vehicleLabelPlural: 'bateaux', purchaseCost: 4_200_000, maintenanceCostPerVehiclePerDay: 1_350, turnaroundMinutes: 12 },
}

/**
 * V51 — trois familles par mode. Le modèle « Standard » de chaque mode reprend
 * volontairement capacité, coût et vitesse V50 afin que les anciennes parties
 * ne changent pas de comportement lors de la migration.
 */
export const GAME_ROLLING_STOCK_MODELS: GameRollingStockModelDefinition[] = [
  { id: 'metro-classic', mode: 'METRO', name: 'Métro M80', generationLabel: 'Classique', introducedYear: 1988, composition: '6 voitures', lengthMeters: 102, capacity: 610, maxSpeedKmh: 80, commercialSpeedMultiplier: .94, reliability: .87, energyIndex: 1.10, purchaseCost: 9_500_000, maintenanceCostPerVehiclePerDay: 5_200 },
  { id: 'metro-standard', mode: 'METRO', name: 'Métro M20', generationLabel: 'Standard', introducedYear: 2012, composition: '7 voitures', lengthMeters: 112, capacity: 700, maxSpeedKmh: 90, commercialSpeedMultiplier: 1, reliability: .93, energyIndex: 1, purchaseCost: 12_000_000, maintenanceCostPerVehiclePerDay: 4_500 },
  { id: 'metro-ng', mode: 'METRO', name: 'Métro M30 NG', generationLabel: 'Nouvelle génération', introducedYear: 2025, composition: '8 voitures', lengthMeters: 120, capacity: 820, maxSpeedKmh: 100, commercialSpeedMultiplier: 1.08, reliability: .98, energyIndex: .84, purchaseCost: 16_500_000, maintenanceCostPerVehiclePerDay: 4_050 },

  { id: 'tram-classic', mode: 'TRAM', name: 'Tram T90', generationLabel: 'Classique', introducedYear: 1996, composition: '5 caisses', lengthMeters: 29, capacity: 190, maxSpeedKmh: 70, commercialSpeedMultiplier: .93, reliability: .88, energyIndex: 1.08, purchaseCost: 3_000_000, maintenanceCostPerVehiclePerDay: 1_900 },
  { id: 'tram-standard', mode: 'TRAM', name: 'Tram T20', generationLabel: 'Standard', introducedYear: 2016, composition: '7 caisses', lengthMeters: 34, capacity: 240, maxSpeedKmh: 70, commercialSpeedMultiplier: 1, reliability: .94, energyIndex: 1, purchaseCost: 4_000_000, maintenanceCostPerVehiclePerDay: 1_600 },
  { id: 'tram-ng', mode: 'TRAM', name: 'Tram T30 XL', generationLabel: 'Grande capacité', introducedYear: 2026, composition: '9 caisses', lengthMeters: 44, capacity: 315, maxSpeedKmh: 80, commercialSpeedMultiplier: 1.05, reliability: .98, energyIndex: .86, purchaseCost: 5_800_000, maintenanceCostPerVehiclePerDay: 1_520 },

  { id: 'rer-classic', mode: 'RER', name: 'RER R90', generationLabel: 'Classique', introducedYear: 1992, composition: '8 voitures', lengthMeters: 205, capacity: 1_480, maxSpeedKmh: 120, commercialSpeedMultiplier: .92, reliability: .86, energyIndex: 1.13, purchaseCost: 14_500_000, maintenanceCostPerVehiclePerDay: 7_600 },
  { id: 'rer-standard', mode: 'RER', name: 'RER R20 Duplex', generationLabel: 'Standard', introducedYear: 2007, composition: '10 voitures', lengthMeters: 225, capacity: 1_800, maxSpeedKmh: 140, commercialSpeedMultiplier: 1, reliability: .93, energyIndex: 1, purchaseCost: 18_000_000, maintenanceCostPerVehiclePerDay: 6_500 },
  { id: 'rer-ng', mode: 'RER', name: 'RER R30 NG', generationLabel: 'Nouvelle génération', introducedYear: 2024, composition: '7 voitures articulées', lengthMeters: 224, capacity: 2_080, maxSpeedKmh: 140, commercialSpeedMultiplier: 1.08, reliability: .98, energyIndex: .82, purchaseCost: 23_000_000, maintenanceCostPerVehiclePerDay: 6_050 },

  { id: 'train-classic', mode: 'TRAIN', name: 'Train N90', generationLabel: 'Classique', introducedYear: 1990, composition: '7 voitures', lengthMeters: 180, capacity: 980, maxSpeedKmh: 140, commercialSpeedMultiplier: .93, reliability: .87, energyIndex: 1.12, purchaseCost: 12_000_000, maintenanceCostPerVehiclePerDay: 6_300 },
  { id: 'train-standard', mode: 'TRAIN', name: 'Train N20', generationLabel: 'Standard', introducedYear: 2011, composition: '8 voitures', lengthMeters: 205, capacity: 1_200, maxSpeedKmh: 160, commercialSpeedMultiplier: 1, reliability: .94, energyIndex: 1, purchaseCost: 15_000_000, maintenanceCostPerVehiclePerDay: 5_500 },
  { id: 'train-ng', mode: 'TRAIN', name: 'Train N30', generationLabel: 'Nouvelle génération', introducedYear: 2025, composition: '9 voitures', lengthMeters: 220, capacity: 1_380, maxSpeedKmh: 180, commercialSpeedMultiplier: 1.07, reliability: .98, energyIndex: .84, purchaseCost: 19_500_000, maintenanceCostPerVehiclePerDay: 5_100 },

  { id: 'bus-classic', mode: 'BUS', name: 'Bus B12', generationLabel: 'Diesel classique', introducedYear: 2004, composition: '12 m', lengthMeters: 12, capacity: 70, maxSpeedKmh: 90, commercialSpeedMultiplier: .95, reliability: .88, energyIndex: 1.18, purchaseCost: 240_000, maintenanceCostPerVehiclePerDay: 220 },
  { id: 'bus-standard', mode: 'BUS', name: 'Bus B18', generationLabel: 'Standard', introducedYear: 2018, composition: '18 m articulé', lengthMeters: 18, capacity: 90, maxSpeedKmh: 90, commercialSpeedMultiplier: 1, reliability: .94, energyIndex: 1, purchaseCost: 350_000, maintenanceCostPerVehiclePerDay: 180 },
  { id: 'bus-ng', mode: 'BUS', name: 'Bus E18', generationLabel: 'Électrique', introducedYear: 2025, composition: '18 m articulé', lengthMeters: 18, capacity: 112, maxSpeedKmh: 90, commercialSpeedMultiplier: 1.04, reliability: .97, energyIndex: .66, purchaseCost: 560_000, maintenanceCostPerVehiclePerDay: 155 },

  { id: 'brt-classic', mode: 'BRT', name: 'Express X18', generationLabel: 'Classique', introducedYear: 2010, composition: '18 m articulé', lengthMeters: 18, capacity: 120, maxSpeedKmh: 90, commercialSpeedMultiplier: .94, reliability: .89, energyIndex: 1.12, purchaseCost: 480_000, maintenanceCostPerVehiclePerDay: 350 },
  { id: 'brt-standard', mode: 'BRT', name: 'Express X24', generationLabel: 'Standard', introducedYear: 2020, composition: '24 m bi-articulé', lengthMeters: 24, capacity: 150, maxSpeedKmh: 90, commercialSpeedMultiplier: 1, reliability: .95, energyIndex: 1, purchaseCost: 650_000, maintenanceCostPerVehiclePerDay: 300 },
  { id: 'brt-ng', mode: 'BRT', name: 'Express EX24', generationLabel: 'Électrique grande capacité', introducedYear: 2026, composition: '24 m bi-articulé', lengthMeters: 24, capacity: 190, maxSpeedKmh: 100, commercialSpeedMultiplier: 1.07, reliability: .98, energyIndex: .70, purchaseCost: 890_000, maintenanceCostPerVehiclePerDay: 260 },

  { id: 'cable-classic', mode: 'CABLE', name: 'Cabine C8', generationLabel: 'Classique', introducedYear: 2008, composition: '8 places', lengthMeters: 3, capacity: 8, maxSpeedKmh: 22, commercialSpeedMultiplier: .92, reliability: .91, energyIndex: 1.10, purchaseCost: 52_000, maintenanceCostPerVehiclePerDay: 26 },
  { id: 'cable-standard', mode: 'CABLE', name: 'Cabine C10', generationLabel: 'Standard', introducedYear: 2025, composition: '10 places assises', lengthMeters: 3, capacity: 10, maxSpeedKmh: 24, commercialSpeedMultiplier: 1, reliability: .97, energyIndex: 1, purchaseCost: 65_000, maintenanceCostPerVehiclePerDay: 22 },
  { id: 'cable-ng', mode: 'CABLE', name: 'Cabine C12 NG', generationLabel: 'Grande capacité', introducedYear: 2026, composition: '12 places', lengthMeters: 3, capacity: 12, maxSpeedKmh: 26, commercialSpeedMultiplier: 1.06, reliability: .985, energyIndex: .82, purchaseCost: 82_000, maintenanceCostPerVehiclePerDay: 20 },

  { id: 'ferry-classic', mode: 'FERRY', name: 'Navette F70', generationLabel: 'Hybride', introducedYear: 2016, composition: '70 passagers', lengthMeters: 18, capacity: 70, maxSpeedKmh: 24, commercialSpeedMultiplier: .92, reliability: .90, energyIndex: 1.12, purchaseCost: 2_900_000, maintenanceCostPerVehiclePerDay: 1_500 },
  { id: 'ferry-standard', mode: 'FERRY', name: 'Navette E90', generationLabel: 'Électrique', introducedYear: 2025, composition: '90 passagers', lengthMeters: 20, capacity: 90, maxSpeedKmh: 26, commercialSpeedMultiplier: 1, reliability: .95, energyIndex: 1, purchaseCost: 4_200_000, maintenanceCostPerVehiclePerDay: 1_350 },
  { id: 'ferry-ng', mode: 'FERRY', name: 'Navette E120', generationLabel: 'Électrique grande capacité', introducedYear: 2026, composition: '120 passagers', lengthMeters: 24, capacity: 120, maxSpeedKmh: 30, commercialSpeedMultiplier: 1.08, reliability: .98, energyIndex: .82, purchaseCost: 5_400_000, maintenanceCostPerVehiclePerDay: 1_260 },
]

const DEFAULT_MODEL_BY_MODE: Record<GameTransportMode, string> = {
  METRO: 'metro-standard',
  TRAM: 'tram-standard',
  RER: 'rer-standard',
  TRAIN: 'train-standard',
  BUS: 'bus-standard',
  BRT: 'brt-standard',
  CABLE: 'cable-standard',
  FERRY: 'ferry-standard',
}

export function getRollingStockModels(mode: GameTransportMode) {
  return GAME_ROLLING_STOCK_MODELS.filter(model => model.mode === mode)
}

export function getDefaultRollingStockModel(mode: GameTransportMode) {
  return GAME_ROLLING_STOCK_MODELS.find(model => model.id === DEFAULT_MODEL_BY_MODE[mode])!
}

export function getRollingStockModel(modelId: unknown, mode: GameTransportMode) {
  return GAME_ROLLING_STOCK_MODELS.find(model => model.id === modelId && model.mode === mode)
    ?? getDefaultRollingStockModel(mode)
}

export function isRollingStockModelForMode(modelId: unknown, mode: GameTransportMode) {
  return GAME_ROLLING_STOCK_MODELS.some(model => model.id === modelId && model.mode === mode)
}


const GAME_DEPOT_SLOT_COST: Record<GameTransportMode, number> = {
  METRO: 900_000,
  TRAM: 380_000,
  RER: 1_100_000,
  TRAIN: 1_000_000,
  BUS: 85_000,
  BRT: 140_000,
  CABLE: 32_000,
  FERRY: 950_000,
}

export function calculateDepotConstructionCost(mode: GameTransportMode, capacity: number) {
  const requested = Number.isFinite(capacity) ? capacity : 1
  const slots = Math.min(500, Math.max(1, Math.floor(requested)))
  const fixed = mode === 'RER' || mode === 'TRAIN' ? 12_000_000
    : mode === 'METRO' ? 10_000_000
      : mode === 'TRAM' ? 5_000_000
        : mode === 'CABLE' ? 3_500_000
          : mode === 'FERRY' ? 4_500_000
            : 1_500_000
  return Math.round(fixed + slots * GAME_DEPOT_SLOT_COST[mode])
}

export function calculateDepotExpansionCost(mode: GameTransportMode, addedCapacity: number) {
  const requested = Number.isFinite(addedCapacity) ? addedCapacity : 1
  const slots = Math.max(1, Math.floor(requested))
  return Math.round(slots * GAME_DEPOT_SLOT_COST[mode] * 0.78)
}

export const GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL = 3

export interface GameRollingStockUpgradeDefinition {
  key: GameRollingStockUpgradeKey
  label: string
  description: string
  shortEffect: string
  costRate: number
}

export const GAME_ROLLING_STOCK_UPGRADES: GameRollingStockUpgradeDefinition[] = [
  { key: 'capacity', label: 'Capacité', description: 'Plus de voyageurs par véhicule. Réduit la saturation sans ajouter de circulations.', shortEffect: '+10 % de places / niveau', costRate: 0.10 },
  { key: 'speed', label: 'Vitesse', description: 'Meilleure accélération et vitesse commerciale. Réduit le temps de trajet et le parc nécessaire.', shortEffect: '+6 % de vitesse / niveau', costRate: 0.12 },
  { key: 'reliability', label: 'Fiabilité', description: 'Réduit les indisponibilités liées à l’état du parc et stabilise le service.', shortEffect: '-16 % d’indisponibilité / niveau', costRate: 0.08 },
  { key: 'efficiency', label: 'Efficacité', description: 'Réduit les coûts de maintenance et une partie des coûts d’exploitation.', shortEffect: '-8 % maintenance / niveau', costRate: 0.09 },
  { key: 'boarding', label: 'Embarquement', description: 'Portes, circulation intérieure et procédures plus rapides : moins de temps perdu aux arrêts.', shortEffect: '-7 % de temps d’arrêt / niveau', costRate: 0.07 },
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
