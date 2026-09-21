import type { GameTerritory } from '../types/game'
import type { GameMunicipalityBounds } from '../types/territory'

const R2_PUBLIC_MAP_BASE_URL = 'https://pub-6ef94121c43244d0b29c016b647e66d0.r2.dev'

export interface GameRealMapSource {
  id: Exclude<GameTerritory, 'ILE_DE_FRANCE' | 'GENERATED'>
  label: string
  locale: string
  localBasemapPath: string
  localMunicipalityPaths: string[]
  bounds: GameMunicipalityBounds
  worldBounds: GameMunicipalityBounds
  initialCenter: { longitude: number; latitude: number }
  initialZoom: number
  sourceLabel: string
  sourceUrl: string
  adminSourceLabel: string
  adminSourceUrl: string
}

/**
 * V40 — vraies cartes.
 *
 * Le fond de carte est un extrait Protomaps/OSM au format PMTiles local.
 * Depuis V40.1, aucun fallback PMTiles distant n'est utilise : le jeu exige le
 * fichier local pour eviter les erreurs HTTP Byte Serving rencontrees en test.
 *
 * Les limites administratives locales peuvent etre installees separement. Tant
 * qu'elles ne sont pas publiees avec le site, la liste des chemins reste vide afin
 * d'eviter des requetes 404 ; le jeu utilise alors ses zones de simulation V32
 * comme filet de securite, sans remplacer le vrai fond cartographique PMTiles.
 */
export const REAL_MAP_SOURCES: readonly GameRealMapSource[] = [
  {
    id: 'LONDON', label: 'Londres', locale: 'en',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/london.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -0.72, south: 51.20, east: 0.42, north: 51.82 },
    worldBounds: { west: -1.05, south: 51.00, east: 0.72, north: 52.02 },
    initialCenter: { longitude: -0.10, latitude: 51.50 }, initialZoom: 7.45,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/united-kingdom/england/greater-london.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'BERLIN', label: 'Berlin', locale: 'de',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/berlin.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 12.72, south: 52.12, east: 14.02, north: 52.82 },
    worldBounds: { west: 12.40, south: 51.90, east: 14.35, north: 53.02 },
    initialCenter: { longitude: 13.405, latitude: 52.52 }, initialZoom: 7.35,
    sourceLabel: 'OpenStreetMap / Geofabrik Berlin / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/germany/berlin.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'RANDSTAD', label: 'Randstad', locale: 'nl',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/randstad.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 3.85, south: 51.65, east: 5.72, north: 52.70 },
    worldBounds: { west: 3.55, south: 51.45, east: 6.02, north: 52.92 },
    initialCenter: { longitude: 4.80, latitude: 52.15 }, initialZoom: 6.95,
    sourceLabel: 'OpenStreetMap / Geofabrik Netherlands / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/netherlands.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'BRUSSELS', label: 'Bruxelles', locale: 'fr',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/brussels.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 3.88, south: 50.55, east: 4.92, north: 51.15 },
    worldBounds: { west: 3.58, south: 50.35, east: 5.20, north: 51.35 },
    initialCenter: { longitude: 4.3525, latitude: 50.8503 }, initialZoom: 7.55,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/belgium.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'MADRID', label: 'Madrid', locale: 'es',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/madrid.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -4.28, south: 39.90, east: -3.02, north: 41.08 },
    worldBounds: { west: -4.58, south: 39.65, east: -2.72, north: 41.33 },
    initialCenter: { longitude: -3.7038, latitude: 40.4168 }, initialZoom: 6.95,
    sourceLabel: 'OpenStreetMap / Geofabrik Madrid / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/spain/madrid.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'MILAN', label: 'Milan', locale: 'it',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/milan.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 8.40, south: 45.05, east: 9.88, north: 46.03 },
    worldBounds: { west: 8.10, south: 44.82, east: 10.18, north: 46.25 },
    initialCenter: { longitude: 9.19, latitude: 45.464 }, initialZoom: 7.05,
    sourceLabel: 'OpenStreetMap / Geofabrik Italy / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/italy.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'WARSAW', label: 'Varsovie', locale: 'pl',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/warsaw.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 20.30, south: 51.78, east: 21.72, north: 52.72 },
    worldBounds: { west: 20.00, south: 51.55, east: 22.02, north: 52.95 },
    initialCenter: { longitude: 21.0122, latitude: 52.2297 }, initialZoom: 7.05,
    sourceLabel: 'OpenStreetMap / Geofabrik Poland / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/poland.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'LISBON', label: 'Lisbonne', locale: 'pt',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/lisbon.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -9.78, south: 38.40, east: -8.62, north: 39.18 },
    worldBounds: { west: -10.05, south: 38.18, east: -8.35, north: 39.40 },
    initialCenter: { longitude: -9.1393, latitude: 38.7223 }, initialZoom: 7.25,
    sourceLabel: 'OpenStreetMap / Geofabrik Portugal / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/portugal.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'PRAGUE', label: 'Prague', locale: 'cs',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/prague.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 13.72, south: 49.72, east: 15.02, north: 50.48 },
    worldBounds: { west: 13.42, south: 49.50, east: 15.32, north: 50.70 },
    initialCenter: { longitude: 14.4378, latitude: 50.0755 }, initialZoom: 7.25,
    sourceLabel: 'OpenStreetMap / Geofabrik Czech Republic / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/czech-republic.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'BERN', label: 'Berne', locale: 'de',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/bern.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 6.62, south: 46.45, east: 8.28, north: 47.48 },
    worldBounds: { west: 6.32, south: 46.20, east: 8.58, north: 47.72 },
    initialCenter: { longitude: 7.4474, latitude: 46.9480 }, initialZoom: 7.0,
    sourceLabel: 'OpenStreetMap / Geofabrik Switzerland / Protomaps', sourceUrl: 'https://download.geofabrik.de/europe/switzerland.html',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'NEW_YORK', label: 'New York', locale: 'en',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/new-york.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -74.65, south: 40.25, east: -73.30, north: 41.15 },
    worldBounds: { west: -74.95, south: 40.05, east: -73.00, north: 41.35 },
    initialCenter: { longitude: -74.0060, latitude: 40.7128 }, initialZoom: 7.0,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'OTTAWA', label: 'Ottawa', locale: 'en',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/ottawa.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -76.35, south: 44.85, east: -74.95, north: 45.85 },
    worldBounds: { west: -76.65, south: 44.60, east: -74.65, north: 46.10 },
    initialCenter: { longitude: -75.6972, latitude: 45.4215 }, initialZoom: 7.0,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'TOKYO', label: 'Tokyo', locale: 'ja',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/tokyo.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 138.80, south: 35.25, east: 140.45, north: 36.20 },
    worldBounds: { west: 138.45, south: 35.00, east: 140.80, north: 36.45 },
    initialCenter: { longitude: 139.6917, latitude: 35.6895 }, initialZoom: 6.85,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'VIENNA', label: 'Vienne', locale: 'de',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/vienna.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 15.65, south: 47.75, east: 16.95, north: 48.65 },
    worldBounds: { west: 15.35, south: 47.50, east: 17.25, north: 48.90 },
    initialCenter: { longitude: 16.3738, latitude: 48.2082 }, initialZoom: 7.1,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'COPENHAGEN', label: 'Copenhague', locale: 'da',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/copenhagen.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 11.55, south: 55.35, east: 13.05, north: 56.15 },
    worldBounds: { west: 11.25, south: 55.10, east: 13.35, north: 56.40 },
    initialCenter: { longitude: 12.5683, latitude: 55.6761 }, initialZoom: 7.1,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'STOCKHOLM', label: 'Stockholm', locale: 'sv',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/stockholm.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 17.25, south: 59.00, east: 19.05, north: 59.75 },
    worldBounds: { west: 16.95, south: 58.78, east: 19.35, north: 59.98 },
    initialCenter: { longitude: 18.0686, latitude: 59.3293 }, initialZoom: 7.0,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'OSLO', label: 'Oslo', locale: 'no',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/oslo.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 10.05, south: 59.55, east: 11.35, north: 60.25 },
    worldBounds: { west: 9.75, south: 59.30, east: 11.65, north: 60.50 },
    initialCenter: { longitude: 10.7522, latitude: 59.9139 }, initialZoom: 7.1,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'HELSINKI', label: 'Helsinki', locale: 'fi',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/helsinki.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 24.20, south: 59.85, east: 25.65, north: 60.55 },
    worldBounds: { west: 23.90, south: 59.60, east: 25.95, north: 60.80 },
    initialCenter: { longitude: 24.9384, latitude: 60.1699 }, initialZoom: 7.05,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'ATHENS', label: 'Athènes', locale: 'el',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/athens.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 22.70, south: 37.55, east: 24.35, north: 38.45 },
    worldBounds: { west: 22.40, south: 37.30, east: 24.65, north: 38.70 },
    initialCenter: { longitude: 23.7275, latitude: 37.9838 }, initialZoom: 7.0,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'BUDAPEST', label: 'Budapest', locale: 'hu',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/budapest.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 18.20, south: 47.15, east: 19.80, north: 47.85 },
    worldBounds: { west: 17.90, south: 46.90, east: 20.10, north: 48.10 },
    initialCenter: { longitude: 19.0402, latitude: 47.4979 }, initialZoom: 7.1,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'ISTANBUL', label: 'Istanbul', locale: 'tr',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/istanbul.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 28.20, south: 40.60, east: 30.25, north: 41.55 },
    worldBounds: { west: 27.85, south: 40.35, east: 30.60, north: 41.80 },
    initialCenter: { longitude: 28.9784, latitude: 41.0082 }, initialZoom: 6.75,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'SAO_PAULO', label: 'São Paulo', locale: 'pt',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/sao-paulo.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: -47.35, south: -24.25, east: -45.75, north: -23.15 },
    worldBounds: { west: -47.65, south: -24.50, east: -45.45, north: -22.90 },
    initialCenter: { longitude: -46.6333, latitude: -23.5505 }, initialZoom: 6.75,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    id: 'SYDNEY', label: 'Sydney', locale: 'en',
    localBasemapPath: `${R2_PUBLIC_MAP_BASE_URL}/real/sydney.pmtiles`,
    localMunicipalityPaths: [],
    bounds: { west: 150.25, south: -34.25, east: 151.75, north: -33.45 },
    worldBounds: { west: 149.95, south: -34.50, east: 152.05, north: -33.20 },
    initialCenter: { longitude: 151.2093, latitude: -33.8688 }, initialZoom: 6.85,
    sourceLabel: 'OpenStreetMap / Protomaps', sourceUrl: 'https://www.openstreetmap.org/copyright',
    adminSourceLabel: 'OpenStreetMap administrative boundaries', adminSourceUrl: 'https://www.openstreetmap.org/copyright',
  },

] as const

const byId = new Map<GameTerritory, GameRealMapSource>(REAL_MAP_SOURCES.map(source => [source.id, source]))

export function getRealMapSource(territory: GameTerritory | null | undefined) {
  return territory ? byId.get(territory) ?? null : null
}

export function isRealOpenDataTerritory(territory: GameTerritory | null | undefined) {
  return Boolean(getRealMapSource(territory))
}
