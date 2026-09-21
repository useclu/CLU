import type { GameTerritory } from '../../types/game'
import type { GameGeneratedTerritorySummary } from '../../types/generatedTerritory'
import type { GameMunicipality, GameMunicipalityBounds } from '../../types/territory'
import type { GameTerritoryDepartmentStyle, GameTerritoryMapDefinition } from '../../config/territories'

export interface RegionalAnchorPlace {
  name: string
  longitude: number
  latitude: number
  weight?: number
}

export interface RegionalGenerationProfile {
  id: GameTerritory
  label: string
  seed: string
  preferredLocale: string
  bounds: GameMunicipalityBounds
  worldBounds?: GameMunicipalityBounds
  initialCenter?: { longitude: number; latitude: number }
  initialZoom: number
  areaKm2: number
  targetPopulation: number
  municipalityCount: number
  departmentCount: number
  urbanCenterCount: number
  structure: 'MONOCENTRIC' | 'POLYCENTRIC' | 'SPRAWLED'
  density: 'LOW' | 'STANDARD' | 'HIGH'
  water: 'LOW' | 'STANDARD' | 'HIGH'
  departmentNames?: string[]
  placeAnchors?: RegionalAnchorPlace[]
  municipalityNamePrefix?: string
  attribution: string
}

interface GeneratedFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}

interface GeneratedFeatureCollection {
  type: 'FeatureCollection'
  features: GeneratedFeature[]
}

export interface RegionalTerritoryRuntime {
  definition: GameTerritoryMapDefinition
  municipalities: GameMunicipality[]
  municipalityGeoJson: GeneratedFeatureCollection
  basemapGeoJson: GeneratedFeatureCollection
  summary: GameGeneratedTerritorySummary
}

type Point = [number, number]

const DEFAULT_DEPARTMENT_COLORS = ['#557fd6', '#45a678', '#d89a3a', '#9a66d8', '#35a2b8', '#d65a4f', '#4f9d87', '#8f7cc1', '#a97b4f']
const GENERATED_PREFIXES = ['Bel', 'Mont', 'Val', 'Rive', 'Bois', 'Grand', 'Clair', 'Font', 'Saint', 'Roche', 'Vaux', 'Aube', 'Belle', 'Pont', 'Ville', 'Cour', 'Orme', 'Lys', 'Mar', 'Ver', 'Neuv', 'Haute', 'Basse']
const GENERATED_SUFFIXES = ['mont', 'ville', 'court', 'sur-Rive', 'les-Bois', 'pont', 'val', 'bourg', 'fontaine', 'pré', 'lac', 'chêne', 'rive', 'fort', 'champ', 'hauteurs', 'plaine', 'dôme', 'sur-Orme', 'sur-Lys']
const LOCALIZED_NAME_PARTS: Record<string, { prefixes: string[]; suffixes: string[] }> = {
  en: { prefixes: ['Ash', 'West', 'North', 'East', 'South', 'Green', 'River', 'High', 'Oak', 'King', 'New', 'Wood', 'Hill', 'Stone', 'Brook'], suffixes: ['ford', 'ton', 'ham', 'bury', 'field', 'wich', 'bridge', 'wood', 'hill', 'brook', 'stead', 'ley', 'gate'] },
  de: { prefixes: ['Neu', 'Alt', 'Groß', 'Klein', 'Falken', 'Lichten', 'Schön', 'Wald', 'Berg', 'Hohen', 'Nieder', 'Ober'], suffixes: ['dorf', 'berg', 'feld', 'hain', 'see', 'walde', 'stadt', 'brück', 'tal', 'rode'] },
  nl: { prefixes: ['Nieuw', 'Oud', 'Zuid', 'Noord', 'West', 'Oost', 'Hoge', 'Lage', 'Groen', 'Water', 'Veen'], suffixes: ['dam', 'dorp', 'veen', 'meer', 'wijk', 'hout', 'burg', 'waard', 'broek', 'haven'] },
  es: { prefixes: ['San ', 'Santa ', 'Valde', 'Al', 'Villa', 'Monte', 'Río ', 'Nuevo '], suffixes: ['campo', 'verde', 'loma', 'real', 'viejo', 'alto', 'bajo', 'mar', 'sierra'] },
  it: { prefixes: ['San ', 'Santa ', 'Monte', 'Val', 'Castel', 'Nova', 'Ponte', 'Borgo '], suffixes: ['verde', 'marino', 'vecchio', 'nuovo', 'alto', 'basso', 'lago', 'piano', 'fiorito'] },
  pl: { prefixes: ['Nowe ', 'Stare ', 'Wielkie ', 'Małe ', 'Zielone ', 'Białe ', 'Czarne '], suffixes: ['Pole', 'Las', 'Góra', 'Dwór', 'Miasto', 'Łąki', 'Brzeg', 'Wola'] },
  pt: { prefixes: ['São ', 'Santa ', 'Vale ', 'Monte ', 'Nova ', 'Vila ', 'Rio ', 'Ponte '], suffixes: ['Verde', 'Real', 'Novo', 'Alto', 'Baixo', 'Mar', 'Serra', 'Lago'] },
  cs: { prefixes: ['Nová ', 'Stará ', 'Velká ', 'Malá ', 'Zelená ', 'Horní ', 'Dolní '], suffixes: ['Lhota', 'Ves', 'Hora', 'Pole', 'Město', 'Údolí', 'Most'] },
}
const ROAD_NAMES = ['Avenue Centrale', 'Boulevard des Ateliers', 'Route des Rives', 'Axe Métropolitain', 'Boulevard du Parc', 'Avenue des Horizons', 'Route des Collines', 'Boulevard des Gares', 'Avenue de la République', 'Rocade Métropolitaine', 'Route des Vallées', 'Boulevard des Sciences']

export function hashRegionalSeed(value: string) {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createRegionalRandom(seed: string) {
  let state = hashRegionalSeed(seed) >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function distanceSquared(a: Point, b: Point) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

function rectanglePolygon(bounds: GameMunicipalityBounds): Point[] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
    [bounds.east, bounds.north],
    [bounds.west, bounds.north],
    [bounds.west, bounds.south],
  ]
}

function ellipsePolygon(centerX: number, centerY: number, radiusX: number, radiusY: number, points = 30) {
  const coordinates: Point[] = []
  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2
    coordinates.push([round(centerX + Math.cos(angle) * radiusX), round(centerY + Math.sin(angle) * radiusY)])
  }
  return coordinates
}

/**
 * Découpe convexe d'un polygone par le demi-plan des points plus proches de A que de B.
 * C'est le cœur du Voronoï local sans dépendance externe.
 */
function clipPolygonCloserToSite(polygon: Point[], site: Point, other: Point): Point[] {
  if (polygon.length < 3) return []
  const nx = other[0] - site[0]
  const ny = other[1] - site[1]
  const midpointX = (other[0] + site[0]) / 2
  const midpointY = (other[1] + site[1]) / 2
  const signed = (point: Point) => (point[0] - midpointX) * nx + (point[1] - midpointY) * ny
  const result: Point[] = []

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!
    const next = polygon[(index + 1) % polygon.length]!
    const currentValue = signed(current)
    const nextValue = signed(next)
    const currentInside = currentValue <= 1e-12
    const nextInside = nextValue <= 1e-12

    if (currentInside) result.push(current)
    if (currentInside === nextInside) continue

    const denominator = currentValue - nextValue
    if (Math.abs(denominator) < 1e-12) continue
    const ratio = currentValue / denominator
    result.push([
      round(current[0] + (next[0] - current[0]) * ratio),
      round(current[1] + (next[1] - current[1]) * ratio),
    ])
  }
  return result
}

function voronoiCells(sites: Point[], bounds: GameMunicipalityBounds): Point[][] {
  const base = rectanglePolygon(bounds).slice(0, -1)
  return sites.map((site, siteIndex) => {
    let polygon = base.map(point => [...point] as Point)
    for (let otherIndex = 0; otherIndex < sites.length && polygon.length >= 3; otherIndex += 1) {
      if (otherIndex === siteIndex) continue
      const other = sites[otherIndex]!
      // Les sites très lointains ne peuvent pas couper la cellule après les premiers clips ;
      // garder ce test simple réduit fortement le coût pour les grandes cartes.
      polygon = clipPolygonCloserToSite(polygon, site, other)
    }
    if (polygon.length < 3) return []
    return [...polygon, polygon[0]!]
  })
}

function pointBounds(polygon: Point[]): GameMunicipalityBounds {
  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  for (const point of polygon) {
    west = Math.min(west, point[0])
    south = Math.min(south, point[1])
    east = Math.max(east, point[0])
    north = Math.max(north, point[1])
  }
  return { west, south, east, north }
}

function randomPoint(random: () => number, bounds: GameMunicipalityBounds, margin = .025): Point {
  const spanX = bounds.east - bounds.west
  const spanY = bounds.north - bounds.south
  return [
    bounds.west + spanX * (margin + random() * (1 - margin * 2)),
    bounds.south + spanY * (margin + random() * (1 - margin * 2)),
  ]
}

function normalizedPoint(point: Point, bounds: GameMunicipalityBounds): Point {
  return [
    (point[0] - bounds.west) / Math.max(1e-9, bounds.east - bounds.west),
    (point[1] - bounds.south) / Math.max(1e-9, bounds.north - bounds.south),
  ]
}

function denormalizePoint(point: Point, bounds: GameMunicipalityBounds): Point {
  return [
    bounds.west + point[0] * (bounds.east - bounds.west),
    bounds.south + point[1] * (bounds.north - bounds.south),
  ]
}

function generateUrbanCenters(profile: RegionalGenerationProfile, random: () => number): RegionalAnchorPlace[] {
  const anchors = (profile.placeAnchors ?? []).slice(0, profile.urbanCenterCount)
  if (anchors.length >= profile.urbanCenterCount) return anchors

  const center = profile.initialCenter ?? {
    longitude: (profile.bounds.west + profile.bounds.east) / 2,
    latitude: (profile.bounds.south + profile.bounds.north) / 2,
  }
  const generated = profile.id === 'GENERATED'
  const generatedPlaces: RegionalAnchorPlace[] = anchors.slice()
  const used: Point[] = generatedPlaces.map(place => [place.longitude, place.latitude])

  if (!used.length) {
    used.push([center.longitude, center.latitude])
    generatedPlaces.push({
      name: profile.label,
      longitude: center.longitude,
      latitude: center.latitude,
      weight: generated ? 1.85 : 1,
    })
  }

  let guard = 0
  while (used.length < profile.urbanCenterCount && guard < profile.urbanCenterCount * 120) {
    guard += 1
    const index = used.length
    let radius: number
    let weight: number

    if (generated) {
      const band = random()
      if (profile.structure === 'MONOCENTRIC') {
        radius = band < .50 ? .055 + random() * .13 : band < .84 ? .18 + random() * .11 : .30 + random() * .11
        weight = index < 5 ? .88 - index * .07 : .34 + random() * .26
      }
      else if (profile.structure === 'SPRAWLED') {
        radius = band < .28 ? .10 + random() * .16 : .22 + random() * .23
        weight = index < 6 ? .82 - index * .045 : .36 + random() * .28
      }
      else {
        // Polycentrique : quelques vrais pôles secondaires puis une constellation
        // de villes satellites, comme une grande région capitale.
        radius = index <= 5
          ? .15 + random() * .16
          : band < .54 ? .08 + random() * .19 : .25 + random() * .17
        weight = index <= 5 ? .98 - index * .065 : .35 + random() * .30
      }
    }
    else {
      radius = .10 + random() * .34
      weight = Math.max(.38, .82 - index * .025)
    }

    const angle = random() * Math.PI * 2
    const anisotropy = .80 + random() * .34
    const normalized: Point = [
      clamp(.5 + Math.cos(angle) * radius * anisotropy, .055, .945),
      clamp(.5 + Math.sin(angle) * radius / anisotropy, .055, .945),
    ]
    const point = denormalizePoint(normalized, profile.bounds)
    const minDistance = Math.min(profile.bounds.east - profile.bounds.west, profile.bounds.north - profile.bounds.south) * (generated ? .026 : .020)
    if (used.some(other => distanceSquared(other, point) < minDistance * minDistance)) continue

    used.push(point)
    generatedPlaces.push({
      name: '',
      longitude: point[0],
      latitude: point[1],
      weight,
    })
  }

  while (generatedPlaces.length < profile.urbanCenterCount) {
    const point = randomPoint(random, profile.bounds, .06)
    generatedPlaces.push({ name: '', longitude: point[0], latitude: point[1], weight: .4 + random() * .2 })
  }

  const usedNames = new Set(generatedPlaces.map(anchor => anchor.name).filter(Boolean))
  return generatedPlaces.map((place, index) => ({
    ...place,
    name: place.name || (profile.id === 'GENERATED' && index === 0
      ? profile.label
      : proceduralMunicipalityName(random, usedNames, '', profile.preferredLocale)),
  }))
}

function generateSites(profile: RegionalGenerationProfile, centers: RegionalAnchorPlace[], random: () => number): Point[] {
  const bounds = profile.bounds
  const spanX = bounds.east - bounds.west
  const spanY = bounds.north - bounds.south
  const sites: Point[] = centers.map(center => [center.longitude, center.latitude])
  const minDistanceSquared = ((spanX + spanY) / Math.sqrt(profile.municipalityCount) * .12) ** 2

  let guard = 0
  while (sites.length < profile.municipalityCount && guard < profile.municipalityCount * 100) {
    guard += 1
    let candidate: Point
    if (random() < .76 && centers.length > 0) {
      const totalCenterWeight = centers.reduce((sum, center) => sum + Math.max(.12, center.weight ?? 1), 0)
      let pick = random() * totalCenterWeight
      let center = centers[0]!
      for (const item of centers) {
        pick -= Math.max(.12, item.weight ?? 1)
        if (pick <= 0) { center = item; break }
      }
      const normalizedCenter = normalizedPoint([center.longitude, center.latitude], bounds)
      const baseSpread = profile.structure === 'SPRAWLED' ? .16 : profile.structure === 'MONOCENTRIC' ? .11 : .125
      const spread = baseSpread * (.72 + .42 * Math.max(.30, center.weight ?? 1))
      const nx = clamp(normalizedCenter[0] + (random() + random() - 1) * spread, .02, .98)
      const ny = clamp(normalizedCenter[1] + (random() + random() - 1) * spread, .02, .98)
      candidate = denormalizePoint([nx, ny], bounds)
    }
    else candidate = randomPoint(random, bounds, .015)

    if (sites.every(site => distanceSquared(site, candidate) > minDistanceSquared)) sites.push(candidate)
  }

  while (sites.length < profile.municipalityCount) sites.push(randomPoint(random, bounds, .01))
  return sites
}

function proceduralMunicipalityName(random: () => number, used: Set<string>, prefix = '', locale = 'fr') {
  const localized = LOCALIZED_NAME_PARTS[locale]
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const first = localized
      ? (localized.prefixes[Math.floor(random() * localized.prefixes.length)] ?? localized.prefixes[0] ?? '')
      : (GENERATED_PREFIXES[Math.floor(random() * GENERATED_PREFIXES.length)] ?? 'Val')
    const second = localized
      ? (localized.suffixes[Math.floor(random() * localized.suffixes.length)] ?? localized.suffixes[0] ?? '')
      : (GENERATED_SUFFIXES[Math.floor(random() * GENERATED_SUFFIXES.length)] ?? 'mont')
    const value = `${prefix}${first}${second}`.replace(/tt/g, 't').trim()
    if (value && !used.has(value)) {
      used.add(value)
      return value
    }
  }
  const fallback = `${prefix}${locale === 'fr' ? 'Commune' : 'District'} ${used.size + 1}`
  used.add(fallback)
  return fallback
}

function nearestIndex(point: Point, candidates: Point[]) {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  candidates.forEach((candidate, index) => {
    const distance = distanceSquared(point, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

function generatedDepartmentName(index: number) {
  const names = ['Cœur', 'Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Rives']
  return names[index] ?? `Territoire ${index + 1}`
}

function createRoadCurve(from: Point, to: Point, random: () => number, spanX: number, spanY: number): Point[] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const distance = Math.sqrt(dx * dx + dy * dy) || 1
  const normalX = -dy / distance
  const normalY = dx / distance
  const amplitude = Math.min(distance * .18, Math.min(spanX, spanY) * .045)
  const phase = (random() - .5) * Math.PI
  const bendA = (random() - .5) * amplitude
  const bendB = (random() - .5) * amplitude * .72
  const points: Point[] = []
  const steps = distance > Math.min(spanX, spanY) * .22 ? 8 : 6
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps
    const envelope = Math.sin(Math.PI * t)
    const lateral = envelope * (bendA * Math.sin(Math.PI * t + phase) + bendB * Math.sin(Math.PI * 2 * t - phase * .35))
    points.push([
      round(from[0] + dx * t + normalX * lateral),
      round(from[1] + dy * t + normalY * lateral),
    ])
  }
  return points
}

function connectNearestPlaces(points: Point[], maxLinks: number) {
  const links = new Set<string>()
  const pairs: Array<[number, number]> = []
  points.forEach((point, index) => {
    const nearest = points
      .map((candidate, candidateIndex) => ({ candidateIndex, distance: candidateIndex === index ? Number.POSITIVE_INFINITY : distanceSquared(point, candidate) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxLinks)
    for (const item of nearest) {
      const a = Math.min(index, item.candidateIndex)
      const b = Math.max(index, item.candidateIndex)
      const key = `${a}:${b}`
      if (!links.has(key)) {
        links.add(key)
        pairs.push([a, b])
      }
    }
  })
  return pairs
}


function rotateOffset(x: number, y: number, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [x * cos - y * sin, x * sin + y * cos]
}

function localToWorld(center: Point, x: number, y: number, angle: number): Point {
  const offset = rotateOffset(x, y, angle)
  return [round(center[0] + offset[0]), round(center[1] + offset[1])]
}

function rotatedRectangle(center: Point, width: number, height: number, angle: number): Point[] {
  const halfW = Math.max(1e-7, width / 2)
  const halfH = Math.max(1e-7, height / 2)
  const corners: Array<[number, number]> = [
    [-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH], [-halfW, -halfH],
  ]
  return corners.map(([x, y]) => localToWorld(center, x, y, angle))
}

function rotatedEllipseLine(center: Point, radiusX: number, radiusY: number, angle: number, points = 30): Point[] {
  const coordinates: Point[] = []
  for (let index = 0; index <= points; index += 1) {
    const theta = (index / points) * Math.PI * 2
    coordinates.push(localToWorld(center, Math.cos(theta) * radiusX, Math.sin(theta) * radiusY, angle))
  }
  return coordinates
}

function irregularBlobPolygon(
  center: Point,
  radiusX: number,
  radiusY: number,
  random: () => number,
  points = 24,
  roughness = .16,
  angle = 0,
): Point[] {
  const phaseA = random() * Math.PI * 2
  const phaseB = random() * Math.PI * 2
  const coordinates: Point[] = []
  for (let index = 0; index <= points; index += 1) {
    const theta = (index / points) * Math.PI * 2
    const wave = Math.sin(theta * 3 + phaseA) * roughness * .46 + Math.sin(theta * 5 + phaseB) * roughness * .28 + (random() - .5) * roughness * .22
    const scale = 1 + wave
    coordinates.push(localToWorld(center, Math.cos(theta) * radiusX * scale, Math.sin(theta) * radiusY * scale, angle))
  }
  if (coordinates.length) coordinates[coordinates.length - 1] = coordinates[0]!
  return coordinates
}

function pushMultiPolygonChunks(
  features: GeneratedFeature[],
  polygons: Point[][][],
  properties: Record<string, unknown>,
  chunkSize: number,
) {
  for (let index = 0; index < polygons.length; index += chunkSize) {
    const chunk = polygons.slice(index, index + chunkSize)
    if (!chunk.length) continue
    features.push({
      type: 'Feature',
      properties,
      geometry: { type: 'MultiPolygon', coordinates: chunk },
    })
  }
}

function pushMultiLineChunks(
  features: GeneratedFeature[],
  lines: Point[][],
  properties: Record<string, unknown>,
  chunkSize: number,
) {
  for (let index = 0; index < lines.length; index += chunkSize) {
    const chunk = lines.slice(index, index + chunkSize)
    if (!chunk.length) continue
    features.push({
      type: 'Feature',
      properties,
      geometry: { type: 'MultiLineString', coordinates: chunk },
    })
  }
}

export function generateRegionalTerritory(profile: RegionalGenerationProfile): RegionalTerritoryRuntime {
  const random = createRegionalRandom(profile.seed)
  const reliefRandom = createRegionalRandom(`${profile.seed}|relief-v34`)
  const waterRandom = createRegionalRandom(`${profile.seed}|water-v34`)
  const networkRandom = createRegionalRandom(`${profile.seed}|network-v34`)
  const fabricRandom = createRegionalRandom(`${profile.seed}|fabric-v34`)
  const poiRandom = createRegionalRandom(`${profile.seed}|poi-v34`)
  const bounds = profile.bounds
  const spanX = bounds.east - bounds.west
  const spanY = bounds.north - bounds.south
  const centers = generateUrbanCenters(profile, random)
  const centerPoints = centers.map(center => [center.longitude, center.latitude] as Point)

  const departmentSeeds: Point[] = []
  const departmentNames = profile.departmentNames ?? []
  for (let index = 0; index < profile.departmentCount; index += 1) {
    const base = centerPoints[index % centerPoints.length] ?? randomPoint(random, bounds)
    const normalized = normalizedPoint(base, bounds)
    departmentSeeds.push(denormalizePoint([
      clamp(normalized[0] + (random() - .5) * .16, .06, .94),
      clamp(normalized[1] + (random() - .5) * .16, .06, .94),
    ], bounds))
  }
  const departmentCells = voronoiCells(departmentSeeds, bounds)
  const departmentStyles: GameTerritoryDepartmentStyle[] = departmentSeeds.map((_, index) => ({
    code: `D${String(index + 1).padStart(2, '0')}`,
    name: departmentNames[index] ?? generatedDepartmentName(index),
    color: DEFAULT_DEPARTMENT_COLORS[index % DEFAULT_DEPARTMENT_COLORS.length] ?? '#557fd6',
  }))

  const sites = generateSites(profile, centers, random)
  const cells = voronoiCells(sites, bounds)
  const usedNames = new Set<string>()
  const anchorNames = new Map<number, string>()
  centers.forEach((center) => {
    const siteIndex = nearestIndex([center.longitude, center.latitude], sites)
    if (!anchorNames.has(siteIndex)) anchorNames.set(siteIndex, center.name)
  })

  const sigma = profile.structure === 'MONOCENTRIC' ? .16 : profile.structure === 'POLYCENTRIC' ? .12 : .18
  const rawWeights = sites.map(site => {
    const normalized = normalizedPoint(site, bounds)
    let weight = profile.structure === 'SPRAWLED' ? .22 : .055
    for (const center of centers) {
      const nc = normalizedPoint([center.longitude, center.latitude], bounds)
      const strength = center.weight ?? 1
      weight += strength * Math.exp(-distanceSquared(normalized, nc) / (2 * sigma * sigma))
    }
    return Math.max(.02, weight * (.68 + random() * .72))
  })
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0)

  const municipalities: GameMunicipality[] = []
  const municipalityFeatures: GeneratedFeature[] = []
  const placeFeatures: GeneratedFeature[] = []
  const siteByMunicipalityCode = new Map<string, Point>()

  cells.forEach((polygon, index) => {
    if (polygon.length < 4) return
    const site = sites[index]!
    const departmentIndex = nearestIndex(site, departmentSeeds)
    const department = departmentStyles[departmentIndex]!
    const code = `${profile.id.slice(0, 3)}-${String(index + 1).padStart(3, '0')}`
    const anchorName = anchorNames.get(index)
    const name = anchorName && !usedNames.has(anchorName)
      ? (usedNames.add(anchorName), anchorName)
      : proceduralMunicipalityName(random, usedNames, profile.municipalityNamePrefix ?? '', profile.preferredLocale)
    const population = Math.max(900, Math.round(profile.targetPopulation * rawWeights[index]! / totalWeight))
    const geometry = { type: 'Polygon' as const, coordinates: [polygon] }
    const municipality: GameMunicipality = {
      code,
      name,
      departmentCode: department.code,
      population,
      geometry,
      bounds: pointBounds(polygon),
    }
    municipalities.push(municipality)
    siteByMunicipalityCode.set(code, site)
    municipalityFeatures.push({
      type: 'Feature',
      properties: { code, nom: name, population, codeDepartement: department.code },
      geometry,
    })
    placeFeatures.push({
      type: 'Feature',
      properties: {
        layer: 'place',
        name,
        population,
        rank: anchorName ? 0 : population > profile.targetPopulation * .02 ? 1 : population > profile.targetPopulation * .007 ? 2 : 3,
      },
      geometry: { type: 'Point', coordinates: site },
    })
  })

  const basemapFeatures: GeneratedFeature[] = [{
    type: 'Feature', properties: { layer: 'earth' }, geometry: { type: 'Polygon', coordinates: [rectanglePolygon(bounds)] },
  }]

  // Départements / grandes zones. Ils structurent la région à faible zoom sans remplacer les communes.
  departmentCells.forEach((polygon, index) => {
    if (polygon.length < 4) return
    basemapFeatures.push({
      type: 'Feature',
      properties: { layer: 'admin', code: departmentStyles[index]?.code, name: departmentStyles[index]?.name, level: 1 },
      geometry: { type: 'Polygon', coordinates: [polygon] },
    })
    const seed = departmentSeeds[index]!
    basemapFeatures.push({
      type: 'Feature',
      properties: { layer: 'admin_place', name: departmentStyles[index]?.name, rank: index },
      geometry: { type: 'Point', coordinates: seed },
    })
  })

  // Relief / forêts / ruralité : masses irrégulières plutôt que grosses ellipses uniformes.
  const reliefCount = Math.max(18, Math.round(profile.departmentCount * 5.5))
  for (let index = 0; index < reliefCount; index += 1) {
    const point = randomPoint(reliefRandom, bounds, .025)
    const radiusX = spanX * (.008 + reliefRandom() * .032)
    const radiusY = spanY * (.009 + reliefRandom() * .036)
    basemapFeatures.push({
      type: 'Feature',
      properties: { layer: 'relief', level: 1 + Math.floor(reliefRandom() * 3) },
      geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(point, radiusX, radiusY, reliefRandom, 18, .22)] },
    })
  }

  const municipalitiesByPopulation = municipalities.slice().sort((a, b) => b.population - a.population)
  const maxMunicipalityPopulation = Math.max(1, municipalitiesByPopulation[0]?.population ?? 1)
  const generatedDetail = profile.id === 'GENERATED'
  const densityScale = profile.density === 'LOW' ? .82 : profile.density === 'HIGH' ? 1.22 : 1
  const fabricCityCount = Math.min(municipalitiesByPopulation.length, generatedDetail ? 104 : 58)

  const urbanDescriptors = municipalitiesByPopulation.slice(0, fabricCityCount).map((municipality, index) => {
    const site = siteByMunicipalityCode.get(municipality.code)
      ?? [(municipality.bounds.west + municipality.bounds.east) / 2, (municipality.bounds.south + municipality.bounds.north) / 2] as Point
    const relative = Math.sqrt(municipality.population / maxMunicipalityPopulation)
    const largeCityBoost = index < Math.max(4, Math.round(profile.urbanCenterCount * .65)) ? 1.16 : 1
    const radiusX = spanX * (.0042 + .020 * relative) * densityScale * largeCityBoost
    const radiusY = spanY * (.0048 + .022 * relative) * densityScale * largeCityBoost
    const angle = (fabricRandom() - .5) * Math.PI * .72
    return { municipality, center: site, relative, radiusX, radiusY, angle, index }
  })

  // --- Eau : vrais axes structurants, confluences et plans d'eau secondaires. ---
  const riverCount = profile.water === 'LOW' ? 1 : profile.water === 'HIGH' ? 4 : 2
  for (let river = 0; river < riverCount; river += 1) {
    const horizontal = (river + hashRegionalSeed(profile.seed)) % 2 === 0
    const points: Point[] = []
    const steps = 54
    const phase = waterRandom() * Math.PI * 2
    const offset = (waterRandom() - .5) * .55
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps
      if (horizontal) {
        const x = bounds.west - spanX * .02 + t * spanX * 1.04
        const y = bounds.south + spanY * (.5 + offset * .43 + Math.sin(t * Math.PI * (1.45 + river * .16) + phase) * (.055 + river * .010) + Math.sin(t * Math.PI * 5 + phase * .4) * .012)
        points.push([round(x), round(y)])
      }
      else {
        const y = bounds.south - spanY * .02 + t * spanY * 1.04
        const x = bounds.west + spanX * (.5 + offset * .43 + Math.sin(t * Math.PI * (1.55 + river * .14) + phase) * (.052 + river * .010) + Math.sin(t * Math.PI * 5.4 + phase * .3) * .011)
        points.push([round(x), round(y)])
      }
    }
    basemapFeatures.push({ type: 'Feature', properties: { layer: 'water', kind: 'river', order: river }, geometry: { type: 'LineString', coordinates: points } })
  }
  const lakeCount = profile.water === 'HIGH' ? 7 : profile.water === 'STANDARD' ? 3 : 1
  for (let index = 0; index < lakeCount; index += 1) {
    const point = randomPoint(waterRandom, bounds, .065)
    basemapFeatures.push({
      type: 'Feature', properties: { layer: 'water', kind: 'lake' },
      geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(point, spanX * (.010 + waterRandom() * .024), spanY * (.012 + waterRandom() * .028), waterRandom, 24, .18)] },
    })
  }

  // --- Tissu urbain : centres, banlieues, zones commerciales et industrielles. ---
  const blockPools: Record<string, Point[][][]> = { residential: [], commercial: [], industrial: [] }
  const buildingPools: Record<string, Point[][][]> = { low: [], mid: [], high: [] }
  const streetSegments: Point[][] = []
  const avenueSegments: Point[][] = []

  for (const city of urbanDescriptors) {
    const { municipality, center, relative, radiusX, radiusY, angle, index } = city
    const mainKind = index < Math.max(3, Math.round(profile.urbanCenterCount * .45)) ? 'commercial' : 'residential'

    basemapFeatures.push({
      type: 'Feature',
      properties: { layer: 'landuse', kind: 'residential', population: municipality.population, urbanRank: index },
      geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(center, radiusX * 1.10, radiusY * 1.10, fabricRandom, 24, .13, angle)] },
    })

    // Cœur de ville / quartier d'affaires : visible dès le zoom régional.
    if (index < Math.min(28, profile.urbanCenterCount * 2 + 8)) {
      basemapFeatures.push({
        type: 'Feature',
        properties: { layer: 'landuse', kind: mainKind, population: municipality.population, urbanRank: index },
        geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(center, radiusX * (.32 + relative * .14), radiusY * (.34 + relative * .14), fabricRandom, 18, .10, angle)] },
      })
    }

    // Parcs et bois de proximité.
    if (index < 48 && index % 3 === 0) {
      const parkOffset = rotateOffset(radiusX * (.45 + fabricRandom() * .22), radiusY * (fabricRandom() - .5) * .55, angle)
      const parkCenter: Point = [center[0] + parkOffset[0], center[1] + parkOffset[1]]
      basemapFeatures.push({
        type: 'Feature', properties: { layer: 'landuse', kind: 'park' },
        geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(parkCenter, radiusX * .16, radiusY * .18, fabricRandom, 16, .18, angle)] },
      })
    }

    // Zones d'activités / logistique en lisière des grands pôles.
    if (index < 34 && index % 2 === 0) {
      const side = fabricRandom() > .5 ? 1 : -1
      const industrialOffset = rotateOffset(radiusX * (.68 + fabricRandom() * .18) * side, radiusY * (.34 + fabricRandom() * .15), angle)
      const industrialCenter: Point = [center[0] + industrialOffset[0], center[1] + industrialOffset[1]]
      basemapFeatures.push({
        type: 'Feature', properties: { layer: 'landuse', kind: 'industrial' },
        geometry: { type: 'Polygon', coordinates: [irregularBlobPolygon(industrialCenter, radiusX * .24, radiusY * .22, fabricRandom, 16, .10, angle)] },
      })
    }

    const gridX = clamp(Math.round(3 + relative * 5.2), 3, 8)
    const gridY = clamp(Math.round(3 + relative * 5.5), 3, 9)

    // Grille de rues locale : chaque ville a sa propre orientation et sa propre densité.
    for (let gx = -gridX; gx <= gridX; gx += 1) {
      const normalizedX = gx / (gridX + .65)
      if (Math.abs(normalizedX) >= 1) continue
      const extentY = Math.sqrt(Math.max(.04, 1 - normalizedX * normalizedX)) * radiusY * .94
      const localX = normalizedX * radiusX
      const a = localToWorld(center, localX, -extentY, angle)
      const b = localToWorld(center, localX, extentY, angle)
      streetSegments.push([a, b])
    }
    for (let gy = -gridY; gy <= gridY; gy += 1) {
      const normalizedY = gy / (gridY + .65)
      if (Math.abs(normalizedY) >= 1) continue
      const extentX = Math.sqrt(Math.max(.04, 1 - normalizedY * normalizedY)) * radiusX * .94
      const localY = normalizedY * radiusY
      const a = localToWorld(center, -extentX, localY, angle)
      const b = localToWorld(center, extentX, localY, angle)
      streetSegments.push([a, b])
    }

    // Avenues radiales + rocade pour les principaux pôles : la carte ne ressemble plus à des lignes droites isolées.
    if (index < Math.min(30, profile.urbanCenterCount * 2)) {
      const radialCount = index < 8 ? 6 : 4
      for (let radial = 0; radial < radialCount; radial += 1) {
        const theta = (radial / radialCount) * Math.PI * 2 + angle * .35
        const edge = localToWorld(center, Math.cos(theta) * radiusX * .96, Math.sin(theta) * radiusY * .96, angle)
        avenueSegments.push(createRoadCurve(center, edge, networkRandom, spanX * .22, spanY * .22))
      }
      if (index < 14) {
        const ring = rotatedEllipseLine(center, radiusX * .76, radiusY * .76, angle, 34)
        basemapFeatures.push({ type: 'Feature', properties: { layer: 'road', kind: index < 5 ? 'major_road' : 'minor_road', name: index < 5 ? `Rocade de ${municipality.name}` : `Boulevard circulaire de ${municipality.name}` }, geometry: { type: 'LineString', coordinates: ring } })
      }
    }

    // Îlots urbains. Ils donnent une vraie texture de ville dès le zoom intermédiaire.
    const blockCols = clamp(Math.round(3 + relative * 4.3), 3, 7)
    const blockRows = clamp(Math.round(3 + relative * 4.5), 3, 8)
    const cellW = radiusX * 1.72 / blockCols
    const cellH = radiusY * 1.72 / blockRows
    for (let bx = 0; bx < blockCols; bx += 1) {
      for (let by = 0; by < blockRows; by += 1) {
        const nx = (bx + .5) / blockCols * 2 - 1
        const ny = (by + .5) / blockRows * 2 - 1
        const ellipticalDistance = nx * nx + ny * ny
        if (ellipticalDistance > .90 || fabricRandom() < .06) continue

        const localX = nx * radiusX * .80 + (fabricRandom() - .5) * cellW * .10
        const localY = ny * radiusY * .80 + (fabricRandom() - .5) * cellH * .10
        const blockCenter = localToWorld(center, localX, localY, angle)
        const blockW = cellW * (.64 + fabricRandom() * .16)
        const blockH = cellH * (.62 + fabricRandom() * .18)
        const centrality = Math.sqrt(ellipticalDistance)
        let blockKind = 'residential'
        if (centrality < .38 && index < 30) blockKind = 'commercial'
        else if (centrality > .62 && index < 42 && (bx + by + index) % 6 === 0) blockKind = 'industrial'

        const block = rotatedRectangle(blockCenter, blockW, blockH, angle)
        blockPools[blockKind]!.push([block])

        // Bâtiments : une empreinte par îlot en périphérie, deux à quatre dans les cœurs urbains.
        // Ils sont regroupés en MultiPolygon par hauteur pour garder un GeoJSON compact.
        const buildingProbability = generatedDetail ? (index < 35 ? .92 : .58) : (index < 24 ? .72 : .38)
        if (fabricRandom() > buildingProbability) continue
        const buildingCopies = centrality < .42 && index < 18 ? (fabricRandom() < .55 ? 2 : 3) : 1
        for (let copy = 0; copy < buildingCopies; copy += 1) {
          const jitterX = (fabricRandom() - .5) * blockW * .26
          const jitterY = (fabricRandom() - .5) * blockH * .26
          const buildingCenter = localToWorld(blockCenter, jitterX, jitterY, angle)
          const buildingW = blockW * (.30 + fabricRandom() * .30) / Math.sqrt(buildingCopies)
          const buildingH = blockH * (.28 + fabricRandom() * .34) / Math.sqrt(buildingCopies)
          const footprint = rotatedRectangle(buildingCenter, buildingW, buildingH, angle + (fabricRandom() - .5) * .10)
          const heightClass = blockKind === 'commercial' && centrality < .35 && index < 12
            ? 'high'
            : blockKind === 'commercial' || (index < 24 && centrality < .55)
              ? 'mid'
              : 'low'
          buildingPools[heightClass]!.push([footprint])
        }
      }
    }
  }

  pushMultiPolygonChunks(basemapFeatures, blockPools.residential!, { layer: 'urban_block', kind: 'residential' }, 360)
  pushMultiPolygonChunks(basemapFeatures, blockPools.commercial!, { layer: 'urban_block', kind: 'commercial' }, 280)
  pushMultiPolygonChunks(basemapFeatures, blockPools.industrial!, { layer: 'urban_block', kind: 'industrial' }, 240)
  pushMultiPolygonChunks(basemapFeatures, buildingPools.low!, { layer: 'building', height: 7 }, 420)
  pushMultiPolygonChunks(basemapFeatures, buildingPools.mid!, { layer: 'building', height: 16 }, 360)
  pushMultiPolygonChunks(basemapFeatures, buildingPools.high!, { layer: 'building', height: 34 }, 260)
  pushMultiLineChunks(basemapFeatures, streetSegments, { layer: 'road', kind: 'street' }, 420)
  pushMultiLineChunks(basemapFeatures, avenueSegments, { layer: 'road', kind: 'minor_road' }, 260)

  // --- Réseau régional routier : autoroutes, nationales et départementales entre pôles. ---
  const placePoints = municipalitiesByPopulation.slice(0, Math.min(generatedDetail ? 96 : 72, municipalitiesByPopulation.length)).map(municipality => (
    siteByMunicipalityCode.get(municipality.code)
      ?? [(municipality.bounds.west + municipality.bounds.east) / 2, (municipality.bounds.south + municipality.bounds.north) / 2]
  ) as Point)

  const mainPlaceCount = Math.min(generatedDetail ? 32 : 26, placePoints.length)
  const mainLinks = connectNearestPlaces(placePoints.slice(0, mainPlaceCount), 2)
  mainLinks.forEach(([a, b], index) => {
    const from = placePoints[a]
    const to = placePoints[b]
    if (!from || !to) return
    basemapFeatures.push({
      type: 'Feature',
      properties: { layer: 'road', kind: index < 8 ? 'highway' : 'major_road', name: ROAD_NAMES[index % ROAD_NAMES.length] },
      geometry: { type: 'LineString', coordinates: createRoadCurve(from, to, networkRandom, spanX, spanY) },
    })
  })

  connectNearestPlaces(placePoints, generatedDetail ? 3 : 2).forEach(([a, b], index) => {
    if (index % 4 === 0) return
    const from = placePoints[a]
    const to = placePoints[b]
    if (!from || !to) return
    basemapFeatures.push({
      type: 'Feature', properties: { layer: 'road', kind: 'minor_road', name: ROAD_NAMES[(index + 4) % ROAD_NAMES.length] },
      geometry: { type: 'LineString', coordinates: createRoadCurve(from, to, networkRandom, spanX, spanY) },
    })
  })

  // Rail de fond : plusieurs radiales + liaisons tangentielles entre pôles importants.
  const railPoints = placePoints.slice(0, Math.min(28, placePoints.length))
  connectNearestPlaces(railPoints, generatedDetail ? 3 : 2).forEach(([a, b], index) => {
    if (index % 3 === 2 && railPoints.length > 18) return
    const from = railPoints[a]
    const to = railPoints[b]
    if (!from || !to) return
    basemapFeatures.push({ type: 'Feature', properties: { layer: 'road', kind: 'rail' }, geometry: { type: 'LineString', coordinates: createRoadCurve(from, to, networkRandom, spanX * .78, spanY * .78) } })
  })

  // --- Grandes infrastructures régionales : aéroports, hôpitaux, universités, centres commerciaux, stades. ---
  const airportCount = profile.municipalityCount > 180 ? 2 : 1
  for (let index = 0; index < airportCount; index += 1) {
    const city = urbanDescriptors[Math.min(urbanDescriptors.length - 1, 1 + index * 5)]
    if (!city) continue
    const side = index % 2 === 0 ? 1 : -1
    const offset = rotateOffset(city.radiusX * (1.55 + poiRandom() * .25) * side, city.radiusY * (.75 + poiRandom() * .25), city.angle)
    const airportCenter: Point = [clamp(city.center[0] + offset[0], bounds.west + spanX * .035, bounds.east - spanX * .035), clamp(city.center[1] + offset[1], bounds.south + spanY * .035, bounds.north - spanY * .035)]
    const runwayAngle = city.angle + (poiRandom() - .5) * .35
    const runway = rotatedRectangle(airportCenter, spanX * .033, spanY * .0026, runwayAngle)
    const terminalCenter = localToWorld(airportCenter, 0, spanY * .0042, runwayAngle)
    const terminal = rotatedRectangle(terminalCenter, spanX * .008, spanY * .0048, runwayAngle)
    basemapFeatures.push({ type: 'Feature', properties: { layer: 'infrastructure', kind: 'airport', name: `Aéroport de ${city.municipality.name}` }, geometry: { type: 'Polygon', coordinates: [runway] } })
    basemapFeatures.push({ type: 'Feature', properties: { layer: 'infrastructure', kind: 'terminal' }, geometry: { type: 'Polygon', coordinates: [terminal] } })
    basemapFeatures.push({ type: 'Feature', properties: { layer: 'poi', kind: 'airport', symbol: 'A', name: `Aéroport de ${city.municipality.name}`, rank: 0 }, geometry: { type: 'Point', coordinates: airportCenter } })
  }

  const poiKinds = [
    { kind: 'hospital', symbol: 'H', prefix: 'Hôpital' },
    { kind: 'university', symbol: 'U', prefix: 'Université' },
    { kind: 'shopping', symbol: 'C', prefix: 'Centre commercial' },
    { kind: 'stadium', symbol: 'S', prefix: 'Stade' },
    { kind: 'business', symbol: 'B', prefix: 'Quartier d’affaires' },
  ]
  urbanDescriptors.slice(0, Math.min(46, urbanDescriptors.length)).forEach((city, index) => {
    const count = index < 10 ? 3 : index < 24 ? 2 : 1
    for (let n = 0; n < count; n += 1) {
      const poi = poiKinds[(index + n + Math.floor(poiRandom() * poiKinds.length)) % poiKinds.length]!
      const theta = poiRandom() * Math.PI * 2
      const radius = .18 + poiRandom() * .48
      const point = localToWorld(city.center, Math.cos(theta) * city.radiusX * radius, Math.sin(theta) * city.radiusY * radius, city.angle)
      basemapFeatures.push({
        type: 'Feature',
        properties: { layer: 'poi', kind: poi.kind, symbol: poi.symbol, name: `${poi.prefix} ${city.municipality.name}`, rank: index },
        geometry: { type: 'Point', coordinates: point },
      })
    }
  })

  // Les communes restent toutes recherchables, mais les labels de fond privilégient les plus importantes.
  const basemapPlaceFeatures = placeFeatures
    .slice()
    .sort((a, b) => Number(b.properties.population ?? 0) - Number(a.properties.population ?? 0))
    .slice(0, Math.min(generatedDetail ? 170 : 120, placeFeatures.length))
  basemapFeatures.push(...basemapPlaceFeatures)

  const paddingX = spanX * .08
  const paddingY = spanY * .08
  const worldBounds = profile.worldBounds ?? {
    west: bounds.west - paddingX,
    south: bounds.south - paddingY,
    east: bounds.east + paddingX,
    north: bounds.north + paddingY,
  }
  const definition: GameTerritoryMapDefinition = {
    id: profile.id,
    kind: profile.id === 'GENERATED' ? 'GENERATED' : 'LOCAL',
    label: profile.label,
    basemapPath: null,
    municipalityGeoJsonPaths: [],
    initialCenter: profile.initialCenter ?? { longitude: (bounds.west + bounds.east) / 2, latitude: (bounds.south + bounds.north) / 2 },
    initialZoom: profile.initialZoom,
    playBounds: bounds,
    worldBounds,
    departments: departmentStyles,
    attribution: profile.attribution,
    preferredLocale: profile.preferredLocale,
  }

  const summary: GameGeneratedTerritorySummary = {
    population: municipalities.reduce((sum, municipality) => sum + municipality.population, 0),
    municipalityCount: municipalities.length,
    urbanCenterCount: centers.length,
    departmentCount: departmentStyles.length,
    areaKm2: profile.areaKm2,
    waterShareLabel: profile.water === 'LOW' ? 'Faible' : profile.water === 'HIGH' ? 'Importante' : 'Standard',
    structureLabel: profile.structure === 'MONOCENTRIC' ? 'Monocentrique' : profile.structure === 'SPRAWLED' ? 'Étendue' : 'Polycentrique',
    densityLabel: profile.density === 'LOW' ? 'Faible' : profile.density === 'HIGH' ? 'Forte' : 'Standard',
    sizeLabel: profile.municipalityCount > 180 ? 'Grande région' : profile.municipalityCount > 110 ? 'Région moyenne' : 'Région compacte',
  }

  return {
    definition,
    municipalities,
    municipalityGeoJson: { type: 'FeatureCollection', features: municipalityFeatures },
    basemapGeoJson: { type: 'FeatureCollection', features: basemapFeatures },
    summary,
  }
}
