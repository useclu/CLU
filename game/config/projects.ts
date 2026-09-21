import type {
  GameInfrastructureType,
  GameTransportMode,
} from '../types/network'

export interface GameInfrastructureDefinition {
  value: GameInfrastructureType
  label: string
  description: string
  constructionCostMultiplier: number
  constructionTimeMultiplier: number
  operatingCostMultiplier: number
  speedMultiplier: number
}

export const GAME_INFRASTRUCTURES: Record<
  Exclude<GameInfrastructureType, 'AUTO'>,
  GameInfrastructureDefinition
> = {
  SURFACE: {
    value: 'SURFACE',
    label: 'Surface',
    description: 'Infrastructure visible et moins coûteuse, mais plus contrainte par le territoire.',
    constructionCostMultiplier: 0.78,
    constructionTimeMultiplier: 0.8,
    operatingCostMultiplier: 0.94,
    speedMultiplier: 0.94,
  },
  TUNNEL: {
    value: 'TUNNEL',
    label: 'Tunnel',
    description: 'Très coûteux mais indépendant de la voirie et adapté aux zones denses.',
    constructionCostMultiplier: 2.35,
    constructionTimeMultiplier: 1.65,
    operatingCostMultiplier: 1.12,
    speedMultiplier: 1.05,
  },
  VIADUCT: {
    value: 'VIADUCT',
    label: 'Viaduc',
    description: 'Coût intermédiaire et bonne régularité, avec une emprise urbaine visible.',
    constructionCostMultiplier: 1.45,
    constructionTimeMultiplier: 1.15,
    operatingCostMultiplier: 1.05,
    speedMultiplier: 1.02,
  },
  DEDICATED: {
    value: 'DEDICATED',
    label: 'Site propre',
    description: 'Voie dédiée pour Tram/BRT, plus fiable que la circulation générale.',
    constructionCostMultiplier: 1.15,
    constructionTimeMultiplier: 0.95,
    operatingCostMultiplier: 1,
    speedMultiplier: 1.08,
  },
  ROAD: {
    value: 'ROAD',
    label: 'Voirie existante',
    description: 'Investissement léger pour Bus, mais vitesse plus sensible au réseau routier.',
    constructionCostMultiplier: 0.22,
    constructionTimeMultiplier: 0.45,
    operatingCostMultiplier: 0.92,
    speedMultiplier: 0.92,
  },
  RAIL: {
    value: 'RAIL',
    label: 'Ferroviaire',
    description: 'Infrastructure lourde adaptée au RER et au Train.',
    constructionCostMultiplier: 1.25,
    constructionTimeMultiplier: 1.25,
    operatingCostMultiplier: 1.02,
    speedMultiplier: 1.04,
  },
}

export const GAME_DEFAULT_INFRASTRUCTURE: Record<GameTransportMode, GameInfrastructureType> = {
  METRO: 'TUNNEL',
  TRAM: 'DEDICATED',
  RER: 'RAIL',
  TRAIN: 'RAIL',
  BUS: 'ROAD',
  BRT: 'DEDICATED',
}

export function resolveInfrastructureType(
  mode: GameTransportMode,
  requested: GameInfrastructureType,
): Exclude<GameInfrastructureType, 'AUTO'> {
  return requested === 'AUTO'
    ? GAME_DEFAULT_INFRASTRUCTURE[mode] as Exclude<GameInfrastructureType, 'AUTO'>
    : requested
}

export function getInfrastructureDefinition(
  mode: GameTransportMode,
  requested: GameInfrastructureType,
) {
  return GAME_INFRASTRUCTURES[resolveInfrastructureType(mode, requested)]
}

export const GAME_PROJECT_BASE_DAYS = 2
export const GAME_PROJECT_DAYS_PER_10_KM = 1
export const GAME_PROJECT_DAYS_PER_STATION = 0.15
