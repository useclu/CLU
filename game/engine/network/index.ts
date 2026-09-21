import { getTransportModeDefinition } from '../../config/transportModes'
import {
  calculateLineConstructionDays,
  calculateLineProjectCost,
} from '../economy'
import type {
  GameInfrastructureType,
  GameLine,
  GameLineBadgeStyle,
  GameLineEmblem,
  GameNetworkState,
  GameServiceLevel,
  GameStation,
  GameTransportMode,
} from '../../types/network'

export const LINE_COLORS = [
  '#56b4ff', '#ffd166', '#ef6a6a', '#69d391',
  '#ba8cff', '#ff9f68', '#68d4d8', '#f28cc8',
  '#4fd1a5', '#ff7b9c', '#8ec5ff', '#f6c85f',
  '#9d8cff', '#ff8b5c', '#5ed7c6', '#e985d3',
]

export function suggestLineColor(existingColors: string[], preferred?: string) {
  const used = new Set(existingColors.map(color => color.toLowerCase()))
  const preferredNormalized = preferred?.toLowerCase()
  if (preferred && preferredNormalized && !used.has(preferredNormalized)) return preferred
  return LINE_COLORS.find(color => !used.has(color.toLowerCase()))
    ?? LINE_COLORS[existingColors.length % LINE_COLORS.length]
    ?? '#56b4ff'
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}

export function createEmptyNetwork(): GameNetworkState {
  return { lines: [] }
}

export function createGameLine(
  existingLineCount: number,
  mode: GameTransportMode,
  name?: string,
): GameLine {
  const now = new Date().toISOString()
  const modeDefinition = getTransportModeDefinition(mode)
  const index = existingLineCount + 1

  return {
    id: createId(),
    name: name?.trim() || `${modeDefinition.label} ${index}`,
    customLogoDataUrl: undefined,
    shortCode: String(index),
    badgeStyle: 'CIRCLE',
    emblem: mode === 'BRT' ? 'EXPRESS' : mode,
    mode,
    status: 'PROJECT',
    infrastructureType: 'AUTO',
    routingMode: 'ASSISTED',
    routeSegments: [],
    serviceLevel: 'STANDARD',
    serviceProfileMode: 'SIMPLE',
    serviceProfile: {
      offPeak: 'REDUCED',
      normal: 'STANDARD',
      peak: 'FREQUENT',
    },
    maintenanceLevel: 'STANDARD',
    fleetCondition: 100,
    vehicleCount: 0,
    rollingStockUpgrades: { capacity: 0, speed: 0, reliability: 0, efficiency: 0, boarding: 0 },
    regulationMode: 'AUTO',
    manualBoostVehicles: 0,
    inspectionMode: 'AUTO',
    controllerCount: 0,
    color: LINE_COLORS[existingLineCount % LINE_COLORS.length] ?? '#56b4ff',
    createdAt: now,
    updatedAt: now,
    constructionCost: 0,
    estimatedConstructionCost: 0,
    constructionDaysRemaining: 0,
    stations: [],
    branches: [],
  }
}

export function createGameStation(
  stationIndex: number,
  longitude: number,
  latitude: number,
): GameStation {
  return {
    id: createId(),
    name: `Station ${stationIndex + 1}`,
    longitude,
    latitude,
    facilityLevel: 'BASIC',
  }
}

export function refreshProjectEstimate(line: GameLine) {
  line.estimatedConstructionCost = calculateLineProjectCost(line)
  return line.estimatedConstructionCost
}

export function prepareLineConstruction(line: GameLine) {
  line.status = 'CONSTRUCTION'
  line.constructionDaysRemaining = calculateLineConstructionDays(line)
  line.updatedAt = new Date().toISOString()
}

export function processNetworkConstructionDay(network: GameNetworkState) {
  const commissionedLineIds: string[] = []

  for (const line of network.lines) {
    if (line.status !== 'CONSTRUCTION') continue

    line.constructionDaysRemaining = Math.max(
      0,
      Math.floor(line.constructionDaysRemaining ?? 0) - 1,
    )

    if (line.constructionDaysRemaining <= 0) {
      line.status = 'OPERATIONAL'
      line.constructionDaysRemaining = 0
      commissionedLineIds.push(line.id)
    }
    line.updatedAt = new Date().toISOString()
  }

  return commissionedLineIds
}

export function isOperationalLine(line: GameLine) {
  return line.status === 'OPERATIONAL' && line.stations.length >= 2
}

export function normalizeBadgeStyle(value: unknown): GameLineBadgeStyle {
  return ['CIRCLE', 'ROUNDED', 'SQUARE', 'DIAMOND'].includes(String(value))
    ? value as GameLineBadgeStyle
    : 'CIRCLE'
}

export function normalizeInfrastructureType(value: unknown): GameInfrastructureType {
  return ['AUTO', 'SURFACE', 'TUNNEL', 'VIADUCT', 'DEDICATED', 'ROAD', 'RAIL'].includes(String(value))
    ? value as GameInfrastructureType
    : 'AUTO'
}

export function normalizeServiceProfileLevel(
  value: unknown,
  fallback: GameServiceLevel,
): GameServiceLevel {
  return ['REDUCED', 'STANDARD', 'FREQUENT', 'INTENSIVE'].includes(String(value))
    ? value as GameServiceLevel
    : fallback
}

export function normalizeLineEmblem(value: unknown): GameLineEmblem {
  return ['NONE', 'METRO', 'TRAM', 'RER', 'TRAIN', 'BUS', 'EXPRESS', 'STAR'].includes(String(value))
    ? value as GameLineEmblem
    : 'NONE'
}
