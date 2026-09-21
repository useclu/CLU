import type { GameTerritory } from '../types/game'
import type { GameMunicipalityBounds } from '../types/territory'
import { getRealTerritoryMunicipalityFallback, hasRealTerritoryMunicipalityFallback } from '../engine/territory/realTerritories'
import { getRealMapSource } from './realMapSources'

const R2_PUBLIC_MAP_BASE_URL = 'https://pub-6ef94121c43244d0b29c016b647e66d0.r2.dev'

export interface GameTerritoryDepartmentStyle {
  code: string
  name: string
  color: string
}

export interface GameTerritoryCatalogEntry {
  id: GameTerritory
  label: string
  countryCode: string
  countryFlag: string
  shortCode: string
  status: 'AVAILABLE' | 'PLANNED'
  description: string
  traits: string[]
  previewKey: string
}

export interface GameTerritoryMapDefinition {
  id: GameTerritory
  kind: 'STATIC' | 'LOCAL' | 'GENERATED'
  label: string
  basemapPath: string | null
  municipalityGeoJsonPaths: string[]
  initialCenter: { longitude: number; latitude: number }
  initialZoom: number
  playBounds: GameMunicipalityBounds
  worldBounds: GameMunicipalityBounds
  departments: GameTerritoryDepartmentStyle[]
  attribution: string
  preferredLocale: string
}

export const GAME_TERRITORY_CATALOG: readonly GameTerritoryCatalogEntry[] = [
  {
    id: 'ILE_DE_FRANCE', label: 'Paris / Île-de-France', countryCode: 'FR', countryFlag: '🇫🇷', shortCode: 'PAR', status: 'AVAILABLE',
    description: 'Région dense, radiale et polycentrique. La carte de référence de CLU Métropole.',
    traits: ['Dense', 'Radiale', 'Polycentrique'], previewKey: 'paris',
  },
  {
    id: 'LONDON', label: 'Londres', countryCode: 'GB', countryFlag: '🇬🇧', shortCode: 'LDN', status: 'AVAILABLE',
    description: 'Grande région tentaculaire, centre très dense et longues liaisons suburbaines.',
    traits: ['Tentaculaire', 'Rail', 'Bus'], previewKey: 'london',
  },
  {
    id: 'BERLIN', label: 'Berlin', countryCode: 'DE', countryFlag: '🇩🇪', shortCode: 'BER', status: 'AVAILABLE',
    description: 'Territoire étalé et multimodal, favorable aux réseaux maillés et aux correspondances.',
    traits: ['Maillée', 'S-Bahn', 'Tram'], previewKey: 'berlin',
  },
  {
    id: 'RANDSTAD', label: 'Randstad', countryCode: 'NL', countryFlag: '🇳🇱', shortCode: 'RND', status: 'AVAILABLE',
    description: 'Plusieurs grands centres urbains à relier dans une même région métropolitaine.',
    traits: ['Multi-villes', 'Interurbain', 'Plate'], previewKey: 'randstad',
  },
  {
    id: 'BRUSSELS', label: 'Bruxelles', countryCode: 'BE', countryFlag: '🇧🇪', shortCode: 'BRU', status: 'AVAILABLE',
    description: 'Région compacte où les communes et les correspondances sont très proches.',
    traits: ['Compacte', 'Tram', 'Communes'], previewKey: 'brussels',
  },
  {
    id: 'MADRID', label: 'Madrid', countryCode: 'ES', countryFlag: '🇪🇸', shortCode: 'MAD', status: 'AVAILABLE',
    description: 'Grande aire urbaine avec de longs axes et une forte complémentarité métro / suburbain.',
    traits: ['Étendue', 'Métro', 'Suburbain'], previewKey: 'madrid',
  },
  {
    id: 'MILAN', label: 'Milan', countryCode: 'IT', countryFlag: '🇮🇹', shortCode: 'MIL', status: 'AVAILABLE',
    description: 'Métropole dense où tram, métro et ferroviaire suburbain peuvent se compléter.',
    traits: ['Dense', 'Tram', 'Métro'], previewKey: 'milan',
  },
  {
    id: 'WARSAW', label: 'Varsovie', countryCode: 'PL', countryFlag: '🇵🇱', shortCode: 'WAW', status: 'AVAILABLE',
    description: 'Région urbaine structurée autour de grands axes, avec une place forte pour tram et bus.',
    traits: ['Tram', 'Croissance', 'Axes forts'], previewKey: 'warsaw',
  },
  {
    id: 'LISBON', label: 'Lisbonne', countryCode: 'PT', countryFlag: '🇵🇹', shortCode: 'LIS', status: 'AVAILABLE',
    description: 'Relief, estuaire et traversées structurantes donnent une géographie très différente.',
    traits: ['Relief', 'Estuaire', 'Tram'], previewKey: 'lisbon',
  },
  {
    id: 'PRAGUE', label: 'Prague', countryCode: 'CZ', countryFlag: '🇨🇿', shortCode: 'PRG', status: 'AVAILABLE',
    description: 'Métropole compacte et vallonnée où métro et tram peuvent former un réseau très maillé.',
    traits: ['Compacte', 'Tram', 'Vallonnée'], previewKey: 'prague',
  },
  {
    id: 'BERN', label: 'Berne', countryCode: 'CH', countryFlag: '🇨🇭', shortCode: 'BRN', status: 'AVAILABLE',
    description: 'Région polycentrique plus compacte, entre relief, villes moyennes et dessertes régionales.',
    traits: ['Compacte', 'Relief', 'Régionale'], previewKey: 'bern',
  },
  {
    id: 'NEW_YORK', label: 'New York', countryCode: 'US', countryFlag: '🇺🇸', shortCode: 'NYC', status: 'AVAILABLE',
    description: 'Grande région métropolitaine multi-États, dense, ferroviaire et fortement polarisée par Manhattan.',
    traits: ['Très dense', 'Suburbain', 'Multi-États'], previewKey: 'new-york',
  },
  {
    id: 'OTTAWA', label: 'Ottawa', countryCode: 'CA', countryFlag: '🇨🇦', shortCode: 'OTT', status: 'AVAILABLE',
    description: 'Région capitale bilingue autour de l’Outaouais, entre Ottawa, Gatineau et leurs couronnes.',
    traits: ['Capitale', 'Bilingue', 'Rivière'], previewKey: 'ottawa',
  },
  {
    id: 'TOKYO', label: 'Tokyo', countryCode: 'JP', countryFlag: '🇯🇵', shortCode: 'TYO', status: 'AVAILABLE',
    description: 'Mégarégion ferroviaire à très forte densité et aux multiples centralités.',
    traits: ['Mégalopole', 'Rail', 'Très dense'], previewKey: 'tokyo',
  },
  {
    id: 'VIENNA', label: 'Vienne', countryCode: 'AT', countryFlag: '🇦🇹', shortCode: 'VIE', status: 'AVAILABLE',
    description: 'Capitale dense du Danube, structurée par métro, tramway et dessertes régionales.',
    traits: ['Tram', 'Métro', 'Danube'], previewKey: 'vienna',
  },
  {
    id: 'COPENHAGEN', label: 'Copenhague', countryCode: 'DK', countryFlag: '🇩🇰', shortCode: 'CPH', status: 'AVAILABLE',
    description: 'Métropole de l’Øresund, compacte, cyclable et organisée autour du rail et du métro.',
    traits: ['Métro', 'Rail', 'Øresund'], previewKey: 'copenhagen',
  },
  {
    id: 'STOCKHOLM', label: 'Stockholm', countryCode: 'SE', countryFlag: '🇸🇪', shortCode: 'STO', status: 'AVAILABLE',
    description: 'Capitale archipel où l’eau structure fortement les axes de transport.',
    traits: ['Archipel', 'Métro', 'Rail'], previewKey: 'stockholm',
  },
  {
    id: 'OSLO', label: 'Oslo', countryCode: 'NO', countryFlag: '🇳🇴', shortCode: 'OSL', status: 'AVAILABLE',
    description: 'Région capitale entre fjord et relief, avec un réseau radial et régional.',
    traits: ['Fjord', 'Relief', 'Rail'], previewKey: 'oslo',
  },
  {
    id: 'HELSINKI', label: 'Helsinki', countryCode: 'FI', countryFlag: '🇫🇮', shortCode: 'HEL', status: 'AVAILABLE',
    description: 'Région littorale polycentrique, combinant métro, tram et trains de banlieue.',
    traits: ['Littoral', 'Tram', 'Suburbain'], previewKey: 'helsinki',
  },
  {
    id: 'ATHENS', label: 'Athènes', countryCode: 'GR', countryFlag: '🇬🇷', shortCode: 'ATH', status: 'AVAILABLE',
    description: 'Grande aire urbaine dense encadrée par le relief et ouverte sur le Pirée.',
    traits: ['Dense', 'Relief', 'Métro'], previewKey: 'athens',
  },
  {
    id: 'BUDAPEST', label: 'Budapest', countryCode: 'HU', countryFlag: '🇭🇺', shortCode: 'BUD', status: 'AVAILABLE',
    description: 'Métropole coupée par le Danube, avec une forte culture tram et métro.',
    traits: ['Danube', 'Tram', 'Métro'], previewKey: 'budapest',
  },
  {
    id: 'ISTANBUL', label: 'Istanbul', countryCode: 'TR', countryFlag: '🇹🇷', shortCode: 'IST', status: 'AVAILABLE',
    description: 'Mégapole bicontinentale structurée par le Bosphore et de très longues liaisons.',
    traits: ['Bosphore', 'Très dense', 'Intercontinental'], previewKey: 'istanbul',
  },
  {
    id: 'SAO_PAULO', label: 'São Paulo', countryCode: 'BR', countryFlag: '🇧🇷', shortCode: 'SAO', status: 'AVAILABLE',
    description: 'Immense métropole dense, étendue et fortement dépendante des grands axes structurants.',
    traits: ['Mégapole', 'Dense', 'Étendue'], previewKey: 'sao-paulo',
  },
  {
    id: 'SYDNEY', label: 'Sydney', countryCode: 'AU', countryFlag: '🇦🇺', shortCode: 'SYD', status: 'AVAILABLE',
    description: 'Métropole portuaire très étendue où baies, relief et rail façonnent les déplacements.',
    traits: ['Port', 'Rail', 'Étendue'], previewKey: 'sydney',
  },
  {
    id: 'RABAT', label: 'Rabat', countryCode: 'MA', countryFlag: '🇲🇦', shortCode: 'RBA', status: 'PLANNED',
    description: 'Future région capitale marocaine autour de Rabat, Salé et Témara.',
    traits: ['Capitale', 'Littoral', 'Tram'], previewKey: 'rabat',
  },
  {
    id: 'DUBAI', label: 'Dubaï', countryCode: 'AE', countryFlag: '🇦🇪', shortCode: 'DXB', status: 'PLANNED',
    description: 'Future métropole linéaire du Golfe, très étendue et fortement structurée par ses grands axes.',
    traits: ['Golfe', 'Métro', 'Étendue'], previewKey: 'dubai',
  },
  {
    id: 'DUBLIN', label: 'Dublin', countryCode: 'IE', countryFlag: '🇮🇪', shortCode: 'DUB', status: 'PLANNED',
    description: 'Future région capitale irlandaise entre baie, rail suburbain et corridors bus.',
    traits: ['Baie', 'Rail', 'Bus'], previewKey: 'dublin',
  },
  {
    id: 'KYIV', label: 'Kiev', countryCode: 'UA', countryFlag: '🇺🇦', shortCode: 'KIV', status: 'PLANNED',
    description: 'Future grande capitale structurée par le Dniepr et un réseau lourd important.',
    traits: ['Dniepr', 'Métro', 'Dense'], previewKey: 'kyiv',
  },
  {
    id: 'MOSCOW', label: 'Moscou', countryCode: 'RU', countryFlag: '🇷🇺', shortCode: 'MOW', status: 'PLANNED',
    description: 'Future mégapole radiale à très forte capacité et aux distances considérables.',
    traits: ['Radiale', 'Métro', 'Mégapole'], previewKey: 'moscow',
  },
  {
    id: 'NEW_DELHI', label: 'New Delhi', countryCode: 'IN', countryFlag: '🇮🇳', shortCode: 'DEL', status: 'PLANNED',
    description: 'Future région capitale immense et polycentrique de Delhi NCR.',
    traits: ['NCR', 'Métro', 'Très dense'], previewKey: 'new-delhi',
  },
  {
    id: 'RIYADH', label: 'Riyad', countryCode: 'SA', countryFlag: '🇸🇦', shortCode: 'RUH', status: 'PLANNED',
    description: 'Future capitale très étendue, organisée autour de grands corridors métropolitains.',
    traits: ['Étendue', 'Métro', 'Axes forts'], previewKey: 'riyadh',
  },
  {
    id: 'SEOUL', label: 'Séoul', countryCode: 'KR', countryFlag: '🇰🇷', shortCode: 'SEL', status: 'PLANNED',
    description: 'Future mégarégion extrêmement dense et très ferroviaire.',
    traits: ['Mégalopole', 'Rail', 'Très dense'], previewKey: 'seoul',
  },
  {
    id: 'ZAGREB', label: 'Zagreb', countryCode: 'HR', countryFlag: '🇭🇷', shortCode: 'ZAG', status: 'PLANNED',
    description: 'Future capitale compacte entre tramway, rail et développement métropolitain.',
    traits: ['Compacte', 'Tram', 'Rail'], previewKey: 'zagreb',
  },
  {
    id: 'ALGIERS', label: 'Alger', countryCode: 'DZ', countryFlag: '🇩🇿', shortCode: 'ALG', status: 'PLANNED',
    description: 'Future métropole littorale dense, contrainte par le relief et la baie.',
    traits: ['Littoral', 'Relief', 'Métro'], previewKey: 'algiers',
  },
  {
    id: 'BEIJING', label: 'Pékin', countryCode: 'CN', countryFlag: '🇨🇳', shortCode: 'BJS', status: 'PLANNED',
    description: 'Future mégapole capitale aux réseaux lourds très développés et aux distances immenses.',
    traits: ['Mégapole', 'Métro', 'Radiale'], previewKey: 'beijing',
  },
  {
    id: 'MEXICO_CITY', label: 'Mexico', countryCode: 'MX', countryFlag: '🇲🇽', shortCode: 'MEX', status: 'PLANNED',
    description: 'Future mégarégion d’altitude, très dense et polycentrique.',
    traits: ['Altitude', 'Très dense', 'Métro'], previewKey: 'mexico-city',
  },
  {
    id: 'CAIRO', label: 'Le Caire', countryCode: 'EG', countryFlag: '🇪🇬', shortCode: 'CAI', status: 'PLANNED',
    description: 'Future mégapole du Nil, très dense et en forte extension.',
    traits: ['Nil', 'Très dense', 'Métro'], previewKey: 'cairo',
  },
  {
    id: 'BUENOS_AIRES', label: 'Buenos Aires', countryCode: 'AR', countryFlag: '🇦🇷', shortCode: 'BUE', status: 'PLANNED',
    description: 'Future grande région métropolitaine de la Plata, dense et très ferroviaire.',
    traits: ['Suburbain', 'Dense', 'Estuaire'], previewKey: 'buenos-aires',
  },
  {
    id: 'BOGOTA', label: 'Bogota', countryCode: 'CO', countryFlag: '🇨🇴', shortCode: 'BOG', status: 'PLANNED',
    description: 'Future capitale d’altitude, dense et structurée par de grands corridors de transport.',
    traits: ['Altitude', 'BRT', 'Dense'], previewKey: 'bogota',
  },
] as const

export const GAME_TERRITORY_IDS = [...GAME_TERRITORY_CATALOG.map(entry => entry.id), 'GENERATED'] as readonly GameTerritory[]

export const GENERATED_TERRITORY_CATALOG_ENTRY: GameTerritoryCatalogEntry = {
  id: 'GENERATED', label: 'Carte fictive', countryCode: 'CLU', countryFlag: '◇', shortCode: 'SEED', status: 'AVAILABLE',
  description: 'Une région métropolitaine complète, générée localement à partir d’une seed reproductible.',
  traits: ['Région', 'Seed', 'Procédurale'], previewKey: 'generated',
}

const catalogById = new Map<GameTerritory, GameTerritoryCatalogEntry>(
  [...GAME_TERRITORY_CATALOG, GENERATED_TERRITORY_CATALOG_ENTRY].map(entry => [entry.id, entry]),
)

const ILE_DE_FRANCE: GameTerritoryMapDefinition = {
  id: 'ILE_DE_FRANCE', kind: 'STATIC', label: 'Paris / Île-de-France',
  basemapPath: `${R2_PUBLIC_MAP_BASE_URL}/idf-basemap.pmtiles`,
  municipalityGeoJsonPaths: [
    '/game/map/communes-75.geojson', '/game/map/communes-77.geojson', '/game/map/communes-78.geojson', '/game/map/communes-91.geojson',
    '/game/map/communes-92.geojson', '/game/map/communes-93.geojson', '/game/map/communes-94.geojson', '/game/map/communes-95.geojson',
  ],
  initialCenter: { longitude: 2.35, latitude: 48.85 }, initialZoom: 7.2,
  playBounds: { west: 1.43, south: 48.10, east: 3.58, north: 49.26 },
  worldBounds: { west: .55, south: 47.55, east: 4.55, north: 49.85 },
  departments: [
    { code: '75', name: 'Paris', color: '#e84d65' }, { code: '77', name: 'Seine-et-Marne', color: '#7657d6' },
    { code: '78', name: 'Yvelines', color: '#557fd6' }, { code: '91', name: 'Essonne', color: '#35a2b8' },
    { code: '92', name: 'Hauts-de-Seine', color: '#d89a3a' }, { code: '93', name: 'Seine-Saint-Denis', color: '#d65a4f' },
    { code: '94', name: 'Val-de-Marne', color: '#45a678' }, { code: '95', name: "Val-d'Oise", color: '#9a66d8' },
  ],
  attribution: '© OpenStreetMap contributors · Protomaps · limites geo.api.gouv.fr', preferredLocale: 'fr',
}

export const GAME_TERRITORIES: Partial<Record<GameTerritory, GameTerritoryMapDefinition>> = { ILE_DE_FRANCE }

export function isGameTerritory(value: unknown): value is GameTerritory {
  return typeof value === 'string' && catalogById.has(value as GameTerritory)
}

export function getGameTerritoryCatalogEntry(territory: GameTerritory | null | undefined) {
  return catalogById.get(territory ?? 'ILE_DE_FRANCE') ?? catalogById.get('ILE_DE_FRANCE')!
}

export function getAvailableGameTerritories() {
  return GAME_TERRITORY_CATALOG.filter(entry => entry.status === 'AVAILABLE')
}

export function isGameTerritoryAvailable(territory: GameTerritory | null | undefined) {
  if (!territory) return false
  if (territory === 'GENERATED' || territory === 'ILE_DE_FRANCE') return true
  return Boolean(getRealMapSource(territory)) || hasRealTerritoryMunicipalityFallback(territory)
}

export function getGameTerritoryMapDefinition(territory: GameTerritory | null | undefined) {
  const id = territory ?? 'ILE_DE_FRANCE'
  if (id === 'GENERATED') throw new Error('Une carte fictive nécessite sa seed et ses paramètres de génération.')
  if (id === 'ILE_DE_FRANCE') return ILE_DE_FRANCE
  const source = getRealMapSource(id)
  if (source) {
    const fallback = getRealTerritoryMunicipalityFallback(id)
    return {
      id,
      kind: 'STATIC',
      label: source.label,
      basemapPath: source.localBasemapPath,
      municipalityGeoJsonPaths: source.localMunicipalityPaths,
      initialCenter: source.initialCenter,
      initialZoom: source.initialZoom,
      playBounds: source.bounds,
      worldBounds: source.worldBounds,
      departments: fallback?.definition.departments ?? [],
      attribution: `© OpenStreetMap contributors · Protomaps · ${source.sourceLabel}`,
      preferredLocale: source.locale,
    } satisfies GameTerritoryMapDefinition
  }
  const label = getGameTerritoryCatalogEntry(id).label
  throw new Error(`La carte « ${label} » est annoncée mais n'est pas encore jouable dans cette version.`)
}
