import type {
  GameTransportMode,
} from '../types/network'

export const GAME_AVERAGE_REVENUE_PER_PASSENGER = 1.15

export const GAME_SIMULATION_HISTORY_LIMIT = 60

export interface GameModeSimulationDefinition {
  mode: GameTransportMode
  averageSpeedKmH: number
  vehicleCapacity: number
  departuresPerHour: number
  serviceHoursPerDay: number
  passengersPerStationPerDay: number
  passengersPerKmPerDay: number
  fixedOperatingCostPerDay: number
  operatingCostPerKmPerDay: number
  operatingCostPerStationPerDay: number
}

/**
 * Valeurs de gameplay provisoires pour la première simulation.
 *
 * Elles ne représentent PAS encore la vraie demande territoriale.
 * Le futur moteur communes / densité / demande pourra remplacer
 * la partie fréquentation sans modifier l'UI ou les sauvegardes.
 */
export const GAME_MODE_SIMULATION:
Record<GameTransportMode, GameModeSimulationDefinition> = {
  METRO: {
    mode: 'METRO',
    averageSpeedKmH: 32,
    vehicleCapacity: 700,
    departuresPerHour: 18,
    serviceHoursPerDay: 18,
    passengersPerStationPerDay: 8_500,
    passengersPerKmPerDay: 2_200,
    fixedOperatingCostPerDay: 45_000,
    operatingCostPerKmPerDay: 6_000,
    operatingCostPerStationPerDay: 4_000,
  },

  TRAM: {
    mode: 'TRAM',
    averageSpeedKmH: 22,
    vehicleCapacity: 240,
    departuresPerHour: 12,
    serviceHoursPerDay: 18,
    passengersPerStationPerDay: 4_200,
    passengersPerKmPerDay: 1_300,
    fixedOperatingCostPerDay: 22_000,
    operatingCostPerKmPerDay: 2_500,
    operatingCostPerStationPerDay: 2_000,
  },

  RER: {
    mode: 'RER',
    averageSpeedKmH: 50,
    vehicleCapacity: 1_800,
    departuresPerHour: 8,
    serviceHoursPerDay: 19,
    passengersPerStationPerDay: 18_000,
    passengersPerKmPerDay: 3_800,
    fixedOperatingCostPerDay: 55_000,
    operatingCostPerKmPerDay: 4_500,
    operatingCostPerStationPerDay: 5_000,
  },

  TRAIN: {
    mode: 'TRAIN',
    averageSpeedKmH: 65,
    vehicleCapacity: 1_200,
    departuresPerHour: 4,
    serviceHoursPerDay: 18,
    passengersPerStationPerDay: 9_000,
    passengersPerKmPerDay: 2_400,
    fixedOperatingCostPerDay: 45_000,
    operatingCostPerKmPerDay: 3_500,
    operatingCostPerStationPerDay: 4_000,
  },

  BUS: {
    mode: 'BUS',
    averageSpeedKmH: 18,
    vehicleCapacity: 90,
    departuresPerHour: 10,
    serviceHoursPerDay: 18,
    passengersPerStationPerDay: 1_250,
    passengersPerKmPerDay: 450,
    fixedOperatingCostPerDay: 5_000,
    operatingCostPerKmPerDay: 500,
    operatingCostPerStationPerDay: 300,
  },

  BRT: {
    mode: 'BRT',
    averageSpeedKmH: 25,
    vehicleCapacity: 150,
    departuresPerHour: 14,
    serviceHoursPerDay: 18,
    passengersPerStationPerDay: 2_800,
    passengersPerKmPerDay: 800,
    fixedOperatingCostPerDay: 12_000,
    operatingCostPerKmPerDay: 1_200,
    operatingCostPerStationPerDay: 900,
  },
}

export function getModeSimulationDefinition(
  mode: GameTransportMode,
): GameModeSimulationDefinition {
  return GAME_MODE_SIMULATION[mode]
}
