import type { GameWorldPlaceAnchor, GameWorldTerritorySettings } from '../../types/worldTerritory'
import { generateRegionalTerritory, type RegionalTerritoryRuntime } from './regionalCore'
import { WORLD_DEFAULT_RADIUS_KM, WORLD_MAX_RADIUS_KM, WORLD_MIN_RADIUS_KM } from '../../config/worldMap'

export interface GameWorldTerritoryRuntime extends RegionalTerritoryRuntime {
  settings: GameWorldTerritorySettings
}

const runtimeCache = new Map<string, GameWorldTerritoryRuntime>()

const COUNTRY_LOCALE: Record<string, string> = {
  FR: 'fr', BE: 'fr', CH: 'fr', LU: 'fr', MC: 'fr', MA: 'fr', DZ: 'fr', TN: 'fr',
  GB: 'en', IE: 'en', US: 'en', CA: 'en', AU: 'en', NZ: 'en', ZA: 'en', IN: 'en',
  DE: 'de', AT: 'de', LI: 'de',
  NL: 'nl',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', UY: 'es',
  IT: 'it', SM: 'it', VA: 'it',
  PT: 'pt', BR: 'pt',
  PL: 'pl',
  CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', BG: 'bg', HR: 'hr', SI: 'sl', RS: 'sr',
  DK: 'da', SE: 'sv', NO: 'no', FI: 'fi', IS: 'is',
  JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh', HK: 'zh',
  GR: 'el', TR: 'tr', RU: 'ru', UA: 'uk', AE: 'ar', SA: 'ar', EG: 'ar', QA: 'ar',
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function haversineKm(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

function normalizeWorldPlaceAnchors(value: unknown, center: { longitude: number; latitude: number }, radiusKm: number): GameWorldPlaceAnchor[] {
  if (!Array.isArray(value)) return []
  const dedupe = new Map<string, GameWorldPlaceAnchor>()
  for (const raw of value.slice(0, 120)) {
    if (!raw || typeof raw !== 'object') continue
    const input = raw as Partial<GameWorldPlaceAnchor>
    const name = typeof input.name === 'string' ? input.name.trim().slice(0, 120) : ''
    const longitude = finiteNumber(input.longitude, Number.NaN)
    const latitude = finiteNumber(input.latitude, Number.NaN)
    if (!name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    if (haversineKm(center, { longitude, latitude }) > radiusKm * 1.08 + 4) continue
    const kind = ['CITY', 'TOWN', 'VILLAGE', 'SUBURB', 'OTHER'].includes(String(input.kind))
      ? input.kind as GameWorldPlaceAnchor['kind']
      : 'OTHER'
    const population = Number.isFinite(Number(input.population)) ? Math.max(0, Math.round(Number(input.population))) : null
    const key = `${name.toLocaleLowerCase()}|${longitude.toFixed(4)}|${latitude.toFixed(4)}`
    if (!dedupe.has(key)) dedupe.set(key, { name, longitude, latitude, kind, population })
  }
  return [...dedupe.values()].slice(0, 56)
}


export function worldPlaceAnchorsSignature(anchors: GameWorldPlaceAnchor[] | undefined) {
  const items = (anchors ?? []).slice(0, 56)
  let hash = 2166136261
  const feed = (text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }
  for (const item of items) {
    feed(`${item.name}|${item.kind ?? 'OTHER'}|${item.population ?? ''}|${Number(item.longitude).toFixed(5)}|${Number(item.latitude).toFixed(5)};`)
  }
  return `${items.length}:${(hash >>> 0).toString(36)}`
}

export function worldPreferredLocale(countryCode: string | null | undefined) {
  const normalized = String(countryCode ?? '').trim().toUpperCase()
  return COUNTRY_LOCALE[normalized] ?? 'en'
}

export function normalizeWorldTerritorySettings(value: unknown): GameWorldTerritorySettings | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Partial<GameWorldTerritorySettings>
  const cityName = typeof input.cityName === 'string' ? input.cityName.trim().slice(0, 120) : ''
  const countryName = typeof input.countryName === 'string' ? input.countryName.trim().slice(0, 120) : ''
  const countryCode = typeof input.countryCode === 'string' ? input.countryCode.trim().toUpperCase().slice(0, 2) : ''
  const latitude = finiteNumber(input.latitude, Number.NaN)
  const longitude = finiteNumber(input.longitude, Number.NaN)
  if (!cityName || !countryName || countryCode.length !== 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -85 || latitude > 85 || longitude < -180 || longitude > 180) return null

  const radiusKm = clamp(Math.round(finiteNumber(input.radiusKm, WORLD_DEFAULT_RADIUS_KM)), WORLD_MIN_RADIUS_KM, WORLD_MAX_RADIUS_KM)
  const preferredLocale = typeof input.preferredLocale === 'string' && input.preferredLocale.trim()
    ? input.preferredLocale.trim().toLowerCase().slice(0, 12)
    : worldPreferredLocale(countryCode)
  const estimatedPopulation = Number.isFinite(Number(input.estimatedPopulation))
    ? Math.max(0, Math.round(Number(input.estimatedPopulation)))
    : null
  const adminName = typeof input.adminName === 'string' && input.adminName.trim()
    ? input.adminName.trim().slice(0, 160)
    : null
  const displayName = typeof input.displayName === 'string' && input.displayName.trim()
    ? input.displayName.trim().slice(0, 300)
    : [cityName, adminName, countryName].filter(Boolean).join(', ')

  return {
    version: 1,
    cityName,
    displayName,
    countryName,
    countryCode,
    adminName,
    longitude,
    latitude,
    radiusKm,
    preferredLocale,
    estimatedPopulation,
    osmType: typeof input.osmType === 'string' ? input.osmType.slice(0, 24) : null,
    osmId: Number.isFinite(Number(input.osmId)) ? Math.max(0, Math.floor(Number(input.osmId))) : null,
    placeAnchors: normalizeWorldPlaceAnchors(input.placeAnchors, { longitude, latitude }, radiusKm),
  }
}

function worldBounds(settings: GameWorldTerritorySettings) {
  const radius = clamp(settings.radiusKm, WORLD_MIN_RADIUS_KM, WORLD_MAX_RADIUS_KM)
  const latitudeRadians = settings.latitude * Math.PI / 180
  const latitudeDelta = radius / 111.32
  const longitudeScale = Math.max(.12, Math.cos(latitudeRadians))
  const longitudeDelta = radius / (111.32 * longitudeScale)
  return {
    west: clamp(settings.longitude - longitudeDelta, -180, 180),
    south: clamp(settings.latitude - latitudeDelta, -85, 85),
    east: clamp(settings.longitude + longitudeDelta, -180, 180),
    north: clamp(settings.latitude + latitudeDelta, -85, 85),
  }
}

function initialZoom(radiusKm: number) {
  return clamp(13.25 - Math.log2(Math.max(1, radiusKm)), 6.45, 11.6)
}

function estimatedPopulation(settings: GameWorldTerritorySettings) {
  const radius = settings.radiusKm
  const populatedAnchors = (settings.placeAnchors ?? []).filter(anchor => Number(anchor.population) > 0)
  const anchorPopulation = populatedAnchors.reduce((sum, anchor) => sum + Math.max(0, Number(anchor.population) || 0), 0)
  const centralPopulation = Math.max(0, Number(settings.estimatedPopulation) || 0)

  if (centralPopulation > 0 || anchorPopulation > 0) {
    // Les populations réelles disponibles deviennent la base du territoire. Les
    // localités sans population restent représentées géographiquement mais ne
    // gonflent pas artificiellement la demande. Le rayon ajoute seulement une
    // marge pour les secteurs résidentiels non renseignés par la source.
    const centralAreaEstimate = centralPopulation > 0
      ? centralPopulation * (1 + Math.min(2.45, radius / 38))
      : 0
    const anchorsEstimate = anchorPopulation * (1.12 + Math.min(.42, radius / 240))
    const sparseAreaFloor = 35_000 + radius * radius * 46
    return Math.round(clamp(Math.max(centralAreaEstimate, anchorsEstimate, sparseAreaFloor), 25_000, 45_000_000))
  }

  // Secours quand la recherche ne fournit aucune population : volontairement
  // plus prudent que l'ancien modèle afin qu'une petite ville ne devienne pas
  // automatiquement une mégalopole à cause du seul choix d'un grand rayon.
  return Math.round(clamp(120_000 + radius * radius * 650, 140_000, 12_000_000))
}

function departmentNames(settings: GameWorldTerritorySettings, count: number) {
  const names = [
    `${settings.cityName} Centre`, 'Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Couronne extérieure',
  ]
  return names.slice(0, count)
}

function profile(settings: GameWorldTerritorySettings) {
  const radius = settings.radiusKm
  const bounds = worldBounds(settings)
  const anchorCount = settings.placeAnchors?.length ?? 0
  const municipalityCount = clamp(Math.max(Math.round(24 + radius * 1.08 + anchorCount * .82), anchorCount + 8), 28, 190)
  const departmentCount = clamp(Math.round(3 + radius / 18), 3, 9)
  const urbanCenterCount = clamp(Math.max(anchorCount, Math.round(6 + radius / 5 + anchorCount * .6)), 6, Math.min(56, Math.max(6, municipalityCount - 4)))
  const areaKm2 = Math.PI * radius * radius

  return {
    id: 'WORLD' as const,
    label: `${settings.cityName} · ${settings.radiusKm} km`,
    seed: `WORLD|${settings.countryCode}|${settings.cityName}|${settings.latitude.toFixed(5)}|${settings.longitude.toFixed(5)}|${settings.radiusKm}`,
    preferredLocale: settings.preferredLocale,
    bounds,
    initialCenter: { longitude: settings.longitude, latitude: settings.latitude },
    initialZoom: initialZoom(radius),
    areaKm2,
    targetPopulation: estimatedPopulation(settings),
    municipalityCount,
    departmentCount,
    urbanCenterCount,
    structure: radius <= 18 ? 'MONOCENTRIC' as const : radius >= 70 ? 'SPRAWLED' as const : 'POLYCENTRIC' as const,
    density: 'STANDARD' as const,
    water: 'STANDARD' as const,
    departmentNames: departmentNames(settings, departmentCount),
    placeAnchors: (() => {
      const anchors = settings.placeAnchors ?? []
      const normalizedName = settings.cityName.toLocaleLowerCase(settings.preferredLocale || 'en')
      const realAnchors = anchors.map((place, index) => {
        const population = Math.max(0, Number(place.population) || 0)
        const kindWeight = place.kind === 'CITY' ? 1.28 : place.kind === 'TOWN' ? 1.04 : place.kind === 'VILLAGE' ? .78 : .64
        const populationBoost = population > 0 ? Math.min(.92, Math.max(0, Math.log10(Math.max(1_000, population)) - 3) * .24) : 0
        return {
          name: place.name,
          longitude: place.longitude,
          latitude: place.latitude,
          weight: kindWeight + populationBoost,
          population: place.population ?? undefined,
          index,
        }
      })
      const hasCenter = realAnchors.some(place => place.name.toLocaleLowerCase(settings.preferredLocale || 'en') === normalizedName && haversineKm(place, settings) < 4)
      return [
        ...(hasCenter ? [] : [{ name: settings.cityName, longitude: settings.longitude, latitude: settings.latitude, weight: 1.95, population: settings.estimatedPopulation ?? undefined }]),
        ...realAnchors.map(place => ({
          name: place.name,
          longitude: place.longitude,
          latitude: place.latitude,
          weight: Math.min(2.2, Math.max(.42, place.weight - Math.min(.16, place.index * .002))),
          population: place.population ?? undefined,
        })),
      ].slice(0, Math.max(1, urbanCenterCount))
    })(),
    attribution: 'OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors · simulation territoriale CLU Métropole',
  }
}

function cacheKey(settings: GameWorldTerritorySettings) {
  return [
    settings.version,
    settings.countryCode,
    settings.cityName,
    settings.latitude.toFixed(5),
    settings.longitude.toFixed(5),
    settings.radiusKm,
    worldPlaceAnchorsSignature(settings.placeAnchors),
  ].join('|')
}

export function generateWorldTerritory(input: GameWorldTerritorySettings): GameWorldTerritoryRuntime {
  const settings = normalizeWorldTerritorySettings(input)
  if (!settings) throw new Error('La zone mondiale sélectionnée est invalide.')
  const key = cacheKey(settings)
  const cached = runtimeCache.get(key)
  if (cached) return cached
  const runtime = generateRegionalTerritory(profile(settings))
  const result: GameWorldTerritoryRuntime = { ...runtime, settings }
  runtimeCache.set(key, result)
  while (runtimeCache.size > 5) {
    const oldest = runtimeCache.keys().next().value
    if (!oldest) break
    runtimeCache.delete(oldest)
  }
  return result
}
