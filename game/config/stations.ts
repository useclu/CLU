import type {
  GameStationFacilityLevel,
  GameTransportMode,
} from '../types/network'

export interface GameStationFacilityDefinition {
  value: GameStationFacilityLevel
  label: string
  description: string
  capacityMultiplier: number
  operatingCostMultiplier: number
  accessibilityScore: number
  facilityScore: number
  upgradeCostMultiplier: number
}

export const GAME_STATION_INTERCHANGE_RADIUS_KM = 0.8
export const GAME_STATION_NEUTRAL_SCORE = 82
export const GAME_STATION_MIN_DEMAND_MULTIPLIER = 0.94
export const GAME_STATION_MAX_DEMAND_MULTIPLIER = 1.05

export const GAME_STATION_FACILITY_LEVELS:
GameStationFacilityDefinition[] = [
  {
    value: 'BASIC',
    label: 'Simple',
    description: 'Équipement minimal : économique, mais capacité et accessibilité limitées.',
    capacityMultiplier: 0.65,
    operatingCostMultiplier: 0.8,
    accessibilityScore: 58,
    facilityScore: 64,
    upgradeCostMultiplier: 0,
  },
  {
    value: 'STANDARD',
    label: 'Aménagée',
    description: 'Station équilibrée pour un usage quotidien normal.',
    capacityMultiplier: 1,
    operatingCostMultiplier: 1,
    accessibilityScore: 82,
    facilityScore: 82,
    upgradeCostMultiplier: 0.22,
  },
  {
    value: 'HUB',
    label: 'Pôle',
    description: 'Grand pôle d’échanges : forte capacité, accessibilité et correspondances améliorées.',
    capacityMultiplier: 1.8,
    operatingCostMultiplier: 1.45,
    accessibilityScore: 98,
    facilityScore: 96,
    upgradeCostMultiplier: 0.48,
  },
]

/**
 * Capacité journalière de référence d'une station aménagée.
 * Valeurs de gameplay provisoires, destinées au balancing final.
 */
export const GAME_STATION_BASE_DAILY_CAPACITY:
Record<GameTransportMode, number> = {
  METRO: 55_000,
  TRAM: 28_000,
  RER: 80_000,
  TRAIN: 65_000,
  BUS: 15_000,
  BRT: 28_000,
}

export function isGameStationFacilityLevel(
  value: unknown,
): value is GameStationFacilityLevel {
  return GAME_STATION_FACILITY_LEVELS.some(
    item => item.value === value,
  )
}

export function getStationFacilityDefinition(
  level: GameStationFacilityLevel,
) {
  return GAME_STATION_FACILITY_LEVELS.find(
    item => item.value === level,
  ) ?? GAME_STATION_FACILITY_LEVELS[1]!
}

export function getNextStationFacilityLevel(
  level: GameStationFacilityLevel,
): GameStationFacilityLevel | null {
  if (level === 'BASIC') {
    return 'STANDARD'
  }

  if (level === 'STANDARD') {
    return 'HUB'
  }

  return null
}

export function stationDemandMultiplier(
  score: number,
) {
  const normalized = Number.isFinite(score)
    ? Math.min(100, Math.max(0, score))
    : GAME_STATION_NEUTRAL_SCORE

  return Math.min(
    GAME_STATION_MAX_DEMAND_MULTIPLIER,
    Math.max(
      GAME_STATION_MIN_DEMAND_MULTIPLIER,
      1 + (normalized - GAME_STATION_NEUTRAL_SCORE) * 0.0022,
    ),
  )
}
