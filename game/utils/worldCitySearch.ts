import type { GameWorldCitySearchResult } from '../types/worldTerritory'
import { worldPreferredLocale } from '../engine/territory/world'
import {
  WORLD_CITY_SEARCH_CACHE_MS,
  WORLD_CITY_SEARCH_STALE_MS,
  WORLD_CITY_SEARCH_FALLBACK_URL,
  WORLD_CITY_SEARCH_URL,
  WORLD_DEFAULT_RADIUS_KM,
} from '../config/worldMap'
import { readWorldPersistentCache, writeWorldPersistentCache } from './worldPersistentCache'

const cache = new Map<string, { expiresAt: number; results: GameWorldCitySearchResult[] }>()
let currentAbortController: AbortController | null = null
const PERSISTENT_CACHE_NAMESPACE = 'city-search-v4'

interface PhotonFeature {
  geometry?: {
    type?: string
    coordinates?: [number, number] | number[]
  }
  properties?: {
    name?: string
    city?: string
    locality?: string
    district?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    osm_key?: string
    osm_value?: string
    osm_type?: string
    osm_id?: number
    type?: string
    layer?: string
    importance?: number
    population?: number | string
    extra?: Record<string, unknown>
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

interface CluWorldCitySearchResponse {
  ok?: boolean
  results?: unknown[]
}

const ALLOWED_PLACE_VALUES = new Set([
  'city', 'town', 'village', 'municipality', 'borough', 'locality', 'hamlet',
])

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function numericPopulation(properties: PhotonFeature['properties']) {
  const raw = properties?.population ?? properties?.extra?.population
  const parsed = Number(String(raw ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function cityNameFrom(feature: PhotonFeature) {
  const p = feature.properties ?? {}
  return String(p.name || p.city || p.locality || '').trim()
}

function adminNameFrom(feature: PhotonFeature, cityName: string) {
  const p = feature.properties ?? {}
  const candidates = [p.state, p.county, p.district]
  return candidates
    .map(value => String(value ?? '').trim())
    .find(value => value && normalizeSearchText(value) !== normalizeSearchText(cityName)) ?? null
}

function placeValue(feature: PhotonFeature) {
  const p = feature.properties ?? {}
  return String(p.osm_value ?? p.type ?? p.layer ?? '').toLocaleLowerCase()
}

function matchScore(name: string, query: string) {
  const n = normalizeSearchText(name)
  const q = normalizeSearchText(query)
  if (!n || !q) return 0
  if (n === q) return 1_000
  if (n.startsWith(q)) return 760
  if (n.split(' ').some(part => part.startsWith(q))) return 560
  if (n.includes(q)) return 360
  return 0
}

function placeScore(value: string) {
  if (value === 'city') return 160
  if (value === 'town') return 130
  if (value === 'municipality') return 110
  if (value === 'village') return 90
  if (value === 'borough') return 75
  if (value === 'locality') return 60
  if (value === 'hamlet') return 35
  return 0
}

function populationScore(population: number | null) {
  if (!population || population <= 0) return 0
  return Math.min(160, Math.log10(Math.max(10, population)) * 25)
}

function toGameResult(feature: PhotonFeature, query: string): (GameWorldCitySearchResult & { _score: number }) | null {
  const coordinates = feature.geometry?.coordinates
  const longitude = Number(coordinates?.[0])
  const latitude = Number(coordinates?.[1])
  const p = feature.properties ?? {}
  const countryCode = String(p.countrycode ?? '').trim().toUpperCase()
  const countryName = String(p.country ?? '').trim()
  const cityName = cityNameFrom(feature)
  const value = placeValue(feature)
  const normalizedName = normalizeSearchText(cityName)
  const normalizedQuery = normalizeSearchText(query)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (!cityName || countryCode.length !== 2 || !countryName) return null
  if (p.osm_key && p.osm_key !== 'place') return null
  if (value && !ALLOWED_PLACE_VALUES.has(value)) return null
  if (!normalizedName.includes(normalizedQuery) && !normalizedQuery.includes(normalizedName)) return null

  const population = numericPopulation(p)
  const score = matchScore(cityName, query)
    + placeScore(value)
    + populationScore(population)
    + Math.max(0, Number(p.importance) || 0) * 100

  const adminName = adminNameFrom(feature, cityName)
  return {
    version: 1,
    cityName,
    displayName: [cityName, adminName, countryName].filter(Boolean).join(', ').slice(0, 300),
    countryName,
    countryCode,
    adminName,
    longitude,
    latitude,
    radiusKm: WORLD_DEFAULT_RADIUS_KM,
    preferredLocale: worldPreferredLocale(countryCode),
    estimatedPopulation: population,
    osmType: typeof p.osm_type === 'string' ? p.osm_type : null,
    osmId: Number.isFinite(Number(p.osm_id)) ? Math.max(0, Math.floor(Number(p.osm_id))) : null,
    importance: score,
    _score: score,
  }
}

function parseApiResult(value: unknown): GameWorldCitySearchResult | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<GameWorldCitySearchResult>
  const cityName = typeof item.cityName === 'string' ? item.cityName.trim().slice(0, 120) : ''
  const countryName = typeof item.countryName === 'string' ? item.countryName.trim().slice(0, 120) : ''
  const countryCode = typeof item.countryCode === 'string' ? item.countryCode.trim().toUpperCase().slice(0, 2) : ''
  const longitude = Number(item.longitude)
  const latitude = Number(item.latitude)
  if (!cityName || !countryName || !/^[A-Z]{2}$/.test(countryCode)) return null
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -85 || latitude > 85) return null
  const adminName = typeof item.adminName === 'string' && item.adminName.trim() ? item.adminName.trim().slice(0, 160) : null
  const estimatedPopulation = Number.isFinite(Number(item.estimatedPopulation)) && Number(item.estimatedPopulation) > 0
    ? Math.round(Number(item.estimatedPopulation))
    : null
  return {
    version: 1,
    cityName,
    displayName: typeof item.displayName === 'string' && item.displayName.trim()
      ? item.displayName.trim().slice(0, 300)
      : [cityName, adminName, countryName].filter(Boolean).join(', '),
    countryName,
    countryCode,
    adminName,
    longitude,
    latitude,
    radiusKm: WORLD_DEFAULT_RADIUS_KM,
    preferredLocale: typeof item.preferredLocale === 'string' && item.preferredLocale.trim()
      ? item.preferredLocale.trim().toLowerCase().slice(0, 12)
      : worldPreferredLocale(countryCode),
    estimatedPopulation,
    osmType: typeof item.osmType === 'string' ? item.osmType.slice(0, 24) : null,
    osmId: Number.isFinite(Number(item.osmId)) ? Math.max(0, Math.floor(Number(item.osmId))) : null,
    importance: Number.isFinite(Number(item.importance)) ? Number(item.importance) : 0,
  }
}

function distanceKm(a: GameWorldCitySearchResult, b: GameWorldCitySearchResult) {
  const rad = Math.PI / 180
  const lat1 = a.latitude * rad
  const lat2 = b.latitude * rad
  const dLat = (b.latitude - a.latitude) * rad
  const dLon = (b.longitude - a.longitude) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

function dedupeResults<T extends GameWorldCitySearchResult>(items: T[]) {
  const kept: T[] = []
  for (const item of items) {
    const duplicate = kept.some(existing => (
      existing.countryCode === item.countryCode
      && normalizeSearchText(existing.cityName) === normalizeSearchText(item.cityName)
      && distanceKm(existing, item) < 25
    ))
    if (!duplicate) kept.push(item)
  }
  return kept
}

function persistentCacheRead(key: string, allowStale = false) {
  const hit = readWorldPersistentCache<unknown[]>(PERSISTENT_CACHE_NAMESPACE, key, { allowStale })
  if (!hit || !Array.isArray(hit.value)) return null
  const results = hit.value.map(parseApiResult).filter((item): item is GameWorldCitySearchResult => Boolean(item))
  return results.length ? { results, stale: hit.stale } : null
}

function persistentCacheWrite(key: string, results: GameWorldCitySearchResult[]) {
  writeWorldPersistentCache(
    PERSISTENT_CACHE_NAMESPACE,
    key,
    results.slice(0, 8),
    WORLD_CITY_SEARCH_CACHE_MS,
    WORLD_CITY_SEARCH_STALE_MS,
    48,
  )
}

async function fetchCluResults(query: string, language: string, signal: AbortSignal) {
  const url = new URL(WORLD_CITY_SEARCH_URL, typeof window !== 'undefined' ? window.location.origin : 'https://useclu.pro')
  url.searchParams.set('q', query)
  url.searchParams.set('lang', language || 'fr')
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`WORLD_CITY_SEARCH_${response.status}`)
  const raw = await response.json() as CluWorldCitySearchResponse
  if (!raw?.ok || !Array.isArray(raw.results)) throw new Error('WORLD_CITY_SEARCH_INVALID_RESPONSE')
  return raw.results.map(parseApiResult).filter((item): item is GameWorldCitySearchResult => Boolean(item))
}

async function fetchPhotonResults(query: string, language: string, signal: AbortSignal) {
  const url = new URL(WORLD_CITY_SEARCH_FALLBACK_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '18')
  url.searchParams.set('lang', language || 'fr')
  url.searchParams.append('layer', 'city')
  url.searchParams.set('dedupe', '1')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/geo+json, application/json' },
    signal,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('WORLD_CITY_SEARCH_UNAVAILABLE')

  const raw = await response.json() as PhotonResponse
  const mapped = (raw.features ?? [])
    .map(feature => toGameResult(feature, query))
    .filter((item): item is GameWorldCitySearchResult & { _score: number } => Boolean(item))
    .sort((a, b) => b._score - a._score)

  const exactMatches = mapped.filter(item => normalizeSearchText(item.cityName) === normalizeSearchText(query))
  const candidates = exactMatches.length ? exactMatches : mapped
  return dedupeResults(candidates).slice(0, 8).map(({ _score: _discarded, ...item }) => item)
}

export async function searchWorldCities(queryInput: string, language = 'fr'): Promise<GameWorldCitySearchResult[]> {
  if (typeof window === 'undefined') return []
  const query = normalizeQuery(queryInput)
  if (query.length < 2) return []

  const key = `${language.toLowerCase()}|${normalizeSearchText(query)}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.results.map(item => ({ ...item }))
  const storedFresh = persistentCacheRead(key, false)
  if (storedFresh) {
    cache.set(key, { expiresAt: Date.now() + WORLD_CITY_SEARCH_CACHE_MS, results: storedFresh.results })
    return storedFresh.results.map(item => ({ ...item }))
  }
  const storedStale = persistentCacheRead(key, true)

  currentAbortController?.abort()
  currentAbortController = new AbortController()

  let results: GameWorldCitySearchResult[]
  let servedFromStale = false
  try {
    results = await fetchCluResults(query, language, currentAbortController.signal)
  }
  catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    // Le navigateur de production ne contacte pas directement le fournisseur :
    // cache, normalisation et changement futur de source restent centralisés
    // dans l'API CLU. En développement, Photon reste un secours direct.
    if (import.meta.dev) {
      try {
        results = await fetchPhotonResults(query, language, currentAbortController.signal)
      }
      catch (fallbackCause) {
        if (fallbackCause instanceof DOMException && fallbackCause.name === 'AbortError') throw fallbackCause
        if (storedStale) { results = storedStale.results; servedFromStale = true }
        else throw fallbackCause
      }
    }
    else if (storedStale) { results = storedStale.results; servedFromStale = true }
    else throw cause
  }

  const exactMatches = results.filter(item => normalizeSearchText(item.cityName) === normalizeSearchText(query))
  const candidates = exactMatches.length ? exactMatches : results.filter(item => {
    const name = normalizeSearchText(item.cityName)
    const q = normalizeSearchText(query)
    return name.startsWith(q) || name.includes(q) || q.includes(name)
  })
  const deduped = dedupeResults(candidates)
    .sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0))
    .slice(0, 8)

  cache.set(key, { expiresAt: Date.now() + WORLD_CITY_SEARCH_CACHE_MS, results: deduped })
  if (!servedFromStale) persistentCacheWrite(key, deduped)
  return deduped.map(item => ({ ...item }))
}
