import type { GameGeneratedTerritorySettings } from '../../types/generatedTerritory'
import { generateRegionalTerritory, type RegionalTerritoryRuntime } from './regionalCore'

export interface GameGeneratedTerritoryRuntime extends RegionalTerritoryRuntime {
  settings: GameGeneratedTerritorySettings
}

const runtimeCache = new Map<string, GameGeneratedTerritoryRuntime>()

const METRO_PREFIXES = ['Aster', 'Val', 'Nova', 'Grand', 'Belle', 'Mont', 'Rive', 'Clair', 'Aur', 'Lumi', 'Vera', 'Oria', 'Céleste', 'Sol']
const METRO_SUFFIXES = ['polis', 'mont', 'rive', 'bourg', 'vallée', 'cité', 'sur-Lac', 'métropole', 'nova', 'dôme']

function hashString(value: string) {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function normalizeGeneratedTerritorySeed(value: unknown) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 18)
  return normalized || 'CLU000001'
}

export function createRandomGeneratedTerritorySeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2)
    crypto.getRandomValues(values)
    return `CLU${values[0]?.toString(36).toUpperCase()}${values[1]?.toString(36).toUpperCase()}`.slice(0, 15)
  }
  return `CLU${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase().slice(0, 15)
}

export function generatedTerritoryAutomaticName(seed: string) {
  const random = mulberry32(hashString(normalizeGeneratedTerritorySeed(seed)))
  const prefix = METRO_PREFIXES[Math.floor(random() * METRO_PREFIXES.length)] ?? 'Nova'
  const suffix = METRO_SUFFIXES[Math.floor(random() * METRO_SUFFIXES.length)] ?? 'polis'
  if (suffix === 'métropole') return `${prefix} Métropole`
  if (suffix === 'sur-Lac') return `${prefix}-sur-Lac`
  return `${prefix}${suffix}`
}

export function createDefaultGeneratedTerritorySettings(seed = createRandomGeneratedTerritorySeed()): GameGeneratedTerritorySettings {
  const normalizedSeed = normalizeGeneratedTerritorySeed(seed)
  return {
    version: 3,
    seed: normalizedSeed,
    name: generatedTerritoryAutomaticName(normalizedSeed),
    size: 'LARGE',
    density: 'STANDARD',
    structure: 'POLYCENTRIC',
    water: 'STANDARD',
  }
}

export function normalizeGeneratedTerritorySettings(value: unknown): GameGeneratedTerritorySettings | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Partial<GameGeneratedTerritorySettings>
  const seed = normalizeGeneratedTerritorySeed(input.seed)
  const size = input.size === 'SMALL' || input.size === 'MEDIUM' || input.size === 'LARGE' ? input.size : 'LARGE'
  const density = input.density === 'LOW' || input.density === 'STANDARD' || input.density === 'HIGH' ? input.density : 'STANDARD'
  const structure = input.structure === 'MONOCENTRIC' || input.structure === 'POLYCENTRIC' || input.structure === 'SPRAWLED' ? input.structure : 'POLYCENTRIC'
  const water = input.water === 'LOW' || input.water === 'STANDARD' || input.water === 'HIGH' ? input.water : 'STANDARD'
  const name = typeof input.name === 'string' && input.name.trim()
    ? input.name.trim().slice(0, 60)
    : generatedTerritoryAutomaticName(seed)
  return { version: 3, seed, name, size, density, structure, water }
}

function cacheKey(settings: GameGeneratedTerritorySettings) {
  return [settings.version, settings.seed, settings.size, settings.density, settings.structure, settings.water, settings.name].join('|')
}

function generatedProfile(settings: GameGeneratedTerritorySettings) {
  const dimension = settings.size === 'SMALL'
    ? { spanX: 1.60, spanY: 1.02, area: 8_300, municipalityCount: 110, departments: 5, centers: 10, population: 3_000_000, zoom: 7.55 }
    : settings.size === 'MEDIUM'
      ? { spanX: 2.00, spanY: 1.28, area: 11_600, municipalityCount: 170, departments: 7, centers: 15, population: 5_500_000, zoom: 7.20 }
      : { spanX: 2.36, spanY: 1.50, area: 14_900, municipalityCount: 240, departments: 8, centers: 21, population: 8_200_000, zoom: 6.95 }

  const populationMultiplier = settings.density === 'LOW' ? .62 : settings.density === 'HIGH' ? 1.45 : 1
  const centerLongitude = 4.75
  const centerLatitude = 46.55
  const bounds = {
    west: centerLongitude - dimension.spanX / 2,
    south: centerLatitude - dimension.spanY / 2,
    east: centerLongitude + dimension.spanX / 2,
    north: centerLatitude + dimension.spanY / 2,
  }

  return {
    id: 'GENERATED' as const,
    label: settings.name,
    seed: `${settings.seed}|${settings.size}|${settings.density}|${settings.structure}|${settings.water}`,
    preferredLocale: 'fr',
    bounds,
    initialCenter: { longitude: centerLongitude, latitude: centerLatitude },
    initialZoom: dimension.zoom,
    areaKm2: dimension.area,
    targetPopulation: Math.round(dimension.population * populationMultiplier),
    municipalityCount: dimension.municipalityCount,
    departmentCount: dimension.departments,
    urbanCenterCount: dimension.centers,
    structure: settings.structure,
    density: settings.density,
    water: settings.water,
    departmentNames: ['Cœur Métropolitain', 'Vallée du Nord', 'Plateaux de l’Est', 'Rives du Sud-Est', 'Plaines du Sud', 'Pays de l’Ouest', 'Hauteurs du Nord-Ouest', 'Deux-Rives'],
    attribution: 'Carte régionale fictive générée localement · CLU Métropole',
  }
}

export function generateGeneratedTerritory(input: GameGeneratedTerritorySettings): GameGeneratedTerritoryRuntime {
  const settings = normalizeGeneratedTerritorySettings(input) ?? createDefaultGeneratedTerritorySettings()
  const key = cacheKey(settings)
  const existing = runtimeCache.get(key)
  if (existing) return existing
  const runtime = generateRegionalTerritory(generatedProfile(settings))
  const result: GameGeneratedTerritoryRuntime = { ...runtime, settings }
  runtimeCache.set(key, result)
  while (runtimeCache.size > 6) {
    const oldest = runtimeCache.keys().next().value
    if (!oldest) break
    runtimeCache.delete(oldest)
  }
  return result
}
