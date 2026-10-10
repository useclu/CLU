import {
  WORLD_LOCALITY_CACHE_MS,
  WORLD_LOCALITY_FETCH_TIMEOUT_MS,
  WORLD_LOCALITY_MAX_ANCHORS,
  WORLD_LOCALITY_STALE_MS,
  WORLD_LOCALITY_SEARCH_FALLBACK_URL,
  WORLD_LOCALITY_SEARCH_URL,
} from '../config/worldMap'
import { readWorldPersistentCache, writeWorldPersistentCache } from './worldPersistentCache'
import { normalizeWorldTerritorySettings } from '../engine/territory/world'
import type { GameWorldPlaceAnchor, GameWorldTerritorySettings } from '../types/worldTerritory'

interface OverpassElement {
  type?: 'node' | 'way' | 'relation' | string
  id?: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string | undefined>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

interface CluWorldLocalitiesResponse {
  ok?: boolean
  placeAnchors?: unknown[]
}

const localityCache = new Map<string, { expiresAt: number; places: GameWorldPlaceAnchor[] }>()
const localityPromises = new Map<string, Promise<GameWorldPlaceAnchor[]>>()
const PERSISTENT_CACHE_NAMESPACE = 'localities-v4'

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function finite(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parsePopulation(raw: unknown) {
  if (raw == null) return null
  const digits = String(raw).replace(/[^0-9]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function localityKind(value: unknown): GameWorldPlaceAnchor['kind'] | null {
  const kind = String(value ?? '').toLocaleLowerCase()
  if (kind === 'city') return 'CITY'
  if (kind === 'town') return 'TOWN'
  if (kind === 'village' || kind === 'hamlet') return 'VILLAGE'
  if (kind === 'suburb' || kind === 'quarter' || kind === 'neighbourhood') return 'SUBURB'
  return null
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180
  const lat1 = aLat * rad
  const lat2 = bLat * rad
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

function cacheKey(settings: GameWorldTerritorySettings) {
  return [
    settings.countryCode,
    normalizeText(settings.cityName),
    settings.latitude.toFixed(4),
    settings.longitude.toFixed(4),
    settings.radiusKm,
  ].join('|')
}

function kindWeight(kind?: GameWorldPlaceAnchor['kind']) {
  if (kind === 'CITY') return 150
  if (kind === 'TOWN') return 100
  if (kind === 'VILLAGE') return 55
  if (kind === 'SUBURB') return 38
  return 20
}

function localityScore(locality: GameWorldPlaceAnchor, settings: GameWorldTerritorySettings) {
  const distance = haversineKm(settings.latitude, settings.longitude, locality.latitude, locality.longitude)
  const distanceScore = Math.max(0, 90 - (distance / Math.max(1, settings.radiusKm)) * 78)
  const populationScore = locality.population
    ? Math.min(160, Math.log10(Math.max(10, locality.population)) * 25)
    : 0
  return kindWeight(locality.kind) + populationScore + distanceScore
}

function normalizeAnchor(value: unknown, settings: GameWorldTerritorySettings): GameWorldPlaceAnchor | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<GameWorldPlaceAnchor>
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : ''
  const latitude = Number(raw.latitude)
  const longitude = Number(raw.longitude)
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -85 || latitude > 85 || longitude < -180 || longitude > 180) return null
  if (haversineKm(settings.latitude, settings.longitude, latitude, longitude) > settings.radiusKm * 1.08 + 4) return null
  const kind = ['CITY', 'TOWN', 'VILLAGE', 'SUBURB', 'OTHER'].includes(String(raw.kind))
    ? raw.kind as GameWorldPlaceAnchor['kind']
    : 'OTHER'
  const population = Number.isFinite(Number(raw.population)) && Number(raw.population) > 0
    ? Math.round(Number(raw.population))
    : null
  return { name, latitude, longitude, kind, population }
}

function normalizeAnchors(items: unknown[], settings: GameWorldTerritorySettings) {
  const central: GameWorldPlaceAnchor = {
    name: settings.cityName,
    longitude: settings.longitude,
    latitude: settings.latitude,
    kind: 'CITY',
    population: settings.estimatedPopulation ?? null,
  }
  const deduped: GameWorldPlaceAnchor[] = [central]
  const candidates = items
    .map(item => normalizeAnchor(item, settings))
    .filter((item): item is GameWorldPlaceAnchor => Boolean(item))
    .filter(item => !(normalizeText(item.name) === normalizeText(central.name) && haversineKm(item.latitude, item.longitude, central.latitude, central.longitude) < 3))
    .sort((a, b) => localityScore(b, settings) - localityScore(a, settings))

  for (const item of candidates) {
    const duplicate = deduped.some(existing => (
      normalizeText(existing.name) === normalizeText(item.name)
      && haversineKm(existing.latitude, existing.longitude, item.latitude, item.longitude) < 3
    ))
    if (duplicate) continue
    deduped.push(item)
    if (deduped.length >= WORLD_LOCALITY_MAX_ANCHORS) break
  }
  return deduped
}

function parseLocalities(raw: OverpassResponse, settings: GameWorldTerritorySettings) {
  const candidates: GameWorldPlaceAnchor[] = []
  const seen = new Set<string>()

  for (const element of raw.elements ?? []) {
    const tags = element.tags ?? {}
    const name = String(tags.name ?? '').trim().slice(0, 120)
    const kind = localityKind(tags.place)
    const latitude = finite(element.lat ?? element.center?.lat)
    const longitude = finite(element.lon ?? element.center?.lon)
    if (!name || !kind || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    if (latitude < -85 || latitude > 85 || longitude < -180 || longitude > 180) continue
    if (haversineKm(settings.latitude, settings.longitude, latitude, longitude) > settings.radiusKm * 1.04) continue

    const osmType = typeof element.type === 'string' ? element.type : ''
    const osmId = Number.isFinite(Number(element.id)) ? Math.max(0, Math.floor(Number(element.id))) : 0
    const stableKey = osmType && osmId
      ? `${osmType}:${osmId}`
      : `${normalizeText(name)}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`
    if (seen.has(stableKey)) continue
    seen.add(stableKey)

    candidates.push({
      name,
      longitude,
      latitude,
      kind,
      population: parsePopulation(tags.population),
    })
  }
  return normalizeAnchors(candidates, settings)
}

function overpassQuery(settings: GameWorldTerritorySettings) {
  const latitude = settings.latitude.toFixed(6)
  const longitude = settings.longitude.toFixed(6)
  const around = (radius: number, pattern: string) =>
    `nwr(around:${Math.max(1_000, Math.round(radius * 1_000))},${latitude},${longitude})["place"~"^(${pattern})$"]["name"];`

  if (settings.radiusKm <= 20) {
    return `[out:json][timeout:18];\n(${around(settings.radiusKm, 'city|town|village|hamlet|suburb|quarter')}\n);\nout center tags qt;`
  }
  if (settings.radiusKm <= 40) {
    return `[out:json][timeout:18];\n(${around(settings.radiusKm, 'city|town|village|hamlet|suburb')}\n);\nout center tags qt;`
  }

  // Les grands rayons ne demandent pas tous les hameaux sur 100 km : on garde
  // les pôles structurants sur tout le périmètre puis on densifie près du centre.
  const queries = [
    around(settings.radiusKm, 'city|town'),
    around(Math.min(settings.radiusKm, 58), 'village'),
    around(Math.min(settings.radiusKm, 26), 'hamlet'),
  ]
  if (settings.radiusKm <= 65) queries.push(around(Math.min(settings.radiusKm, 20), 'suburb'))
  return `[out:json][timeout:18];\n(${queries.join('\n')}\n);\nout center tags qt;`
}

function persistentCacheRead(key: string, settings: GameWorldTerritorySettings, allowStale = false) {
  const hit = readWorldPersistentCache<unknown[]>(PERSISTENT_CACHE_NAMESPACE, key, { allowStale })
  if (!hit || !Array.isArray(hit.value)) return null
  const places = normalizeAnchors(hit.value, settings)
  return places.length ? { places, stale: hit.stale } : null
}

function persistentCacheWrite(key: string, places: GameWorldPlaceAnchor[]) {
  writeWorldPersistentCache(
    PERSISTENT_CACHE_NAMESPACE,
    key,
    places,
    WORLD_LOCALITY_CACHE_MS,
    WORLD_LOCALITY_STALE_MS,
    32,
  )
}

async function fetchFromCluApi(settings: GameWorldTerritorySettings, signal: AbortSignal) {
  const url = new URL(WORLD_LOCALITY_SEARCH_URL, typeof window !== 'undefined' ? window.location.origin : 'https://useclu.pro')
  url.searchParams.set('lat', settings.latitude.toFixed(6))
  url.searchParams.set('lon', settings.longitude.toFixed(6))
  url.searchParams.set('radius', String(settings.radiusKm))
  url.searchParams.set('city', settings.cityName)
  url.searchParams.set('country', settings.countryCode)
  if (settings.estimatedPopulation) url.searchParams.set('population', String(settings.estimatedPopulation))
  const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`WORLD_LOCALITY_SEARCH_${response.status}`)
  const raw = await response.json() as CluWorldLocalitiesResponse
  if (!raw?.ok || !Array.isArray(raw.placeAnchors)) throw new Error('WORLD_LOCALITY_SEARCH_INVALID_RESPONSE')
  return normalizeAnchors(raw.placeAnchors, settings)
}

async function fetchFromOverpass(settings: GameWorldTerritorySettings, signal: AbortSignal) {
  const body = new URLSearchParams({ data: overpassQuery(settings) })
  const response = await fetch(WORLD_LOCALITY_SEARCH_FALLBACK_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
    signal,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`WORLD_LOCALITY_SEARCH_${response.status}`)
  const raw = await response.json() as OverpassResponse
  return parseLocalities(raw, settings)
}

export async function fetchWorldLocalities(input: GameWorldTerritorySettings): Promise<GameWorldPlaceAnchor[]> {
  if (typeof window === 'undefined') return []
  const settings = normalizeWorldTerritorySettings(input)
  if (!settings) return []
  const key = cacheKey(settings)
  const cached = localityCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.places.map(item => ({ ...item }))
  const storedFresh = persistentCacheRead(key, settings, false)
  if (storedFresh) {
    localityCache.set(key, { expiresAt: Date.now() + WORLD_LOCALITY_CACHE_MS, places: storedFresh.places })
    return storedFresh.places.map(item => ({ ...item }))
  }
  const pending = localityPromises.get(key)
  if (pending) return (await pending).map(item => ({ ...item }))
  const storedStale = persistentCacheRead(key, settings, true)

  const request = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WORLD_LOCALITY_FETCH_TIMEOUT_MS)
    try {
      let places: GameWorldPlaceAnchor[]
      let servedFromStale = false
      try {
        places = await fetchFromCluApi(settings, controller.signal)
      }
      catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
        if (import.meta.dev) {
          try {
            places = await fetchFromOverpass(settings, controller.signal)
          }
          catch (fallbackCause) {
            if (fallbackCause instanceof DOMException && fallbackCause.name === 'AbortError') throw fallbackCause
            if (storedStale) { places = storedStale.places; servedFromStale = true }
            else throw fallbackCause
          }
        }
        else if (storedStale) { places = storedStale.places; servedFromStale = true }
        else throw cause
      }
      localityCache.set(key, { expiresAt: Date.now() + WORLD_LOCALITY_CACHE_MS, places })
      if (!servedFromStale) persistentCacheWrite(key, places)
      return places.map(item => ({ ...item }))
    }
    finally {
      clearTimeout(timeout)
      localityPromises.delete(key)
    }
  })()

  localityPromises.set(key, request)
  return (await request).map(item => ({ ...item }))
}

/**
 * Enrichissement ponctuel avant la création d'une partie WORLD. Les ancres sont
 * ensuite persistées dans la sauvegarde et donc dans le snapshot Online : tous
 * les joueurs reçoivent exactement la même géographie de simulation.
 */
export async function enrichWorldTerritoryWithLocalities(input: GameWorldTerritorySettings) {
  const settings = normalizeWorldTerritorySettings(input)
  if (!settings) return input
  if ((settings.placeAnchors?.length ?? 0) > 1) return settings
  try {
    const placeAnchors = await fetchWorldLocalities(settings)
    return normalizeWorldTerritorySettings({ ...settings, placeAnchors }) ?? settings
  }
  catch {
    return settings
  }
}
