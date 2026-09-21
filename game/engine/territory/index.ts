import { isOperationalLine } from '../network'

import { getLineAllStations } from '../network/geometry'

import type {
  GameLine,
  GameNetworkState,
  GameStation,
} from '../../types/network'

import type {
  GameCoordinate,
  GameLineMunicipalityCoverage,
  GameMunicipality,
  GameMunicipalityBounds,
  GameMunicipalityCoverage,
  GameMunicipalityGeometry,
  GameNetworkTerritorySummary,
} from '../../types/territory'

interface GeoJsonFeatureCollection {
  type?: string
  features?: unknown[]
}

interface GeoJsonFeature {
  type?: string
  properties?: Record<string, unknown>
  geometry?: {
    type?: string
    coordinates?: unknown
  } | null
}

function isFiniteCoordinate(
  value: unknown,
): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
}

function normalizeRing(
  value: unknown,
): GameCoordinate[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const result: GameCoordinate[] = []

  for (const point of value) {
    if (
      !Array.isArray(point)
      || point.length < 2
      || !isFiniteCoordinate(point[0])
      || !isFiniteCoordinate(point[1])
    ) {
      return null
    }

    result.push([
      point[0],
      point[1],
    ])
  }

  return result.length >= 3
    ? result
    : null
}

function normalizePolygonCoordinates(
  value: unknown,
): GameCoordinate[][] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const rings: GameCoordinate[][] = []

  for (const ringValue of value) {
    const ring = normalizeRing(ringValue)

    if (!ring) {
      return null
    }

    rings.push(ring)
  }

  return rings.length > 0
    ? rings
    : null
}

function normalizeGeometry(
  value: GeoJsonFeature['geometry'],
): GameMunicipalityGeometry | null {
  if (!value) {
    return null
  }

  if (value.type === 'Polygon') {
    const coordinates = normalizePolygonCoordinates(
      value.coordinates,
    )

    return coordinates
      ? {
          type: 'Polygon',
          coordinates,
        }
      : null
  }

  if (value.type === 'MultiPolygon') {
    if (!Array.isArray(value.coordinates)) {
      return null
    }

    const polygons: GameCoordinate[][][] = []

    for (const polygonValue of value.coordinates) {
      const polygon = normalizePolygonCoordinates(
        polygonValue,
      )

      if (!polygon) {
        return null
      }

      polygons.push(polygon)
    }

    return polygons.length > 0
      ? {
          type: 'MultiPolygon',
          coordinates: polygons,
        }
      : null
  }

  return null
}

function calculateGeometryBounds(
  geometry: GameMunicipalityGeometry,
): GameMunicipalityBounds {
  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY

  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) {
        west = Math.min(west, point[0])
        south = Math.min(south, point[1])
        east = Math.max(east, point[0])
        north = Math.max(north, point[1])
      }
    }
  }

  return {
    west,
    south,
    east,
    north,
  }
}

function normalizeString(
  value: unknown,
): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function normalizePopulation(
  value: unknown,
): number {
  const numberValue = typeof value === 'number'
    ? value
    : Number(value)

  return Number.isFinite(numberValue)
    ? Math.max(0, Math.round(numberValue))
    : 0
}

export function parseMunicipalityFeatureCollection(
  input: unknown,
): GameMunicipality[] {
  if (
    !input
    || typeof input !== 'object'
  ) {
    return []
  }

  const collection = input as GeoJsonFeatureCollection

  if (!Array.isArray(collection.features)) {
    return []
  }

  const municipalities: GameMunicipality[] = []

  for (const rawFeature of collection.features) {
    if (
      !rawFeature
      || typeof rawFeature !== 'object'
    ) {
      continue
    }

    const feature = rawFeature as GeoJsonFeature
    const properties = feature.properties ?? {}
    const code = normalizeString(properties.code)
    const name = normalizeString(properties.nom)
    const departmentCode = normalizeString(
      properties.codeDepartement,
    )
    const geometry = normalizeGeometry(
      feature.geometry,
    )

    if (!code || !name || !geometry) {
      continue
    }

    municipalities.push({
      code,
      name,
      departmentCode,
      population: normalizePopulation(
        properties.population,
      ),
      geometry,
      bounds: calculateGeometryBounds(geometry),
    })
  }

  return municipalities
}

function pointInBounds(
  longitude: number,
  latitude: number,
  bounds: GameMunicipalityBounds,
) {
  return longitude >= bounds.west
    && longitude <= bounds.east
    && latitude >= bounds.south
    && latitude <= bounds.north
}

function pointInRing(
  longitude: number,
  latitude: number,
  ring: GameCoordinate[],
) {
  let inside = false

  for (
    let currentIndex = 0,
      previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex,
      currentIndex += 1
  ) {
    const current = ring[currentIndex]
    const previous = ring[previousIndex]

    if (!current || !previous) {
      continue
    }

    const currentX = current[0]
    const currentY = current[1]
    const previousX = previous[0]
    const previousY = previous[1]

    const crossesLatitude =
      (currentY > latitude) !== (previousY > latitude)

    if (!crossesLatitude) {
      continue
    }

    const denominator = previousY - currentY

    if (denominator === 0) {
      continue
    }

    const intersectionLongitude =
      (previousX - currentX)
      * (latitude - currentY)
      / denominator
      + currentX

    if (longitude < intersectionLongitude) {
      inside = !inside
    }
  }

  return inside
}

function pointInPolygon(
  longitude: number,
  latitude: number,
  polygon: GameCoordinate[][],
) {
  const outerRing = polygon[0]

  if (
    !outerRing
    || !pointInRing(
      longitude,
      latitude,
      outerRing,
    )
  ) {
    return false
  }

  for (
    let index = 1;
    index < polygon.length;
    index += 1
  ) {
    const hole = polygon[index]

    if (
      hole
      && pointInRing(
        longitude,
        latitude,
        hole,
      )
    ) {
      return false
    }
  }

  return true
}

export function municipalityContainsPoint(
  municipality: GameMunicipality,
  longitude: number,
  latitude: number,
) {
  if (
    !pointInBounds(
      longitude,
      latitude,
      municipality.bounds,
    )
  ) {
    return false
  }

  if (municipality.geometry.type === 'Polygon') {
    return pointInPolygon(
      longitude,
      latitude,
      municipality.geometry.coordinates,
    )
  }

  return municipality.geometry.coordinates.some(
    polygon => pointInPolygon(
      longitude,
      latitude,
      polygon,
    ),
  )
}

export function findMunicipalityForStation(
  municipalities: GameMunicipality[],
  station: GameStation,
): GameMunicipality | null {
  for (const municipality of municipalities) {
    if (
      municipalityContainsPoint(
        municipality,
        station.longitude,
        station.latitude,
      )
    ) {
      return municipality
    }
  }

  return null
}

function summarizeLineCoverage(
  line: GameLine,
  municipalities: GameMunicipality[],
): GameLineMunicipalityCoverage {
  const coverageByCode = new Map<
    string,
    GameMunicipalityCoverage
  >()

  let coveredStationCount = 0
  let uncoveredStationCount = 0

  const allStations = getLineAllStations(line)
  for (const station of allStations) {
    const municipality = findMunicipalityForStation(
      municipalities,
      station,
    )

    if (!municipality) {
      uncoveredStationCount += 1
      continue
    }

    coveredStationCount += 1

    const existing = coverageByCode.get(
      municipality.code,
    )

    if (existing) {
      existing.stationCount += 1
      continue
    }

    coverageByCode.set(
      municipality.code,
      {
        code: municipality.code,
        name: municipality.name,
        departmentCode: municipality.departmentCode,
        population: municipality.population,
        stationCount: 1,
        lineCount: 1,
      },
    )
  }

  const lineMunicipalities = Array.from(
    coverageByCode.values(),
  )

  return {
    lineId: line.id,
    mode: line.mode,
    stationCount: allStations.length,
    coveredStationCount,
    uncoveredStationCount,
    municipalities: lineMunicipalities,
    populationServed: lineMunicipalities.reduce(
      (total, municipality) => (
        total + municipality.population
      ),
      0,
    ),
  }
}

export function buildNetworkTerritorySummary(
  network: GameNetworkState,
  municipalities: GameMunicipality[],
  excludedLineId?: string | null,
): GameNetworkTerritorySummary {
  const lines = network.lines
    .filter(
      line => (
        line.id !== excludedLineId
        && isOperationalLine(line)
      ),
    )
    .map(
      line => summarizeLineCoverage(
        line,
        municipalities,
      ),
    )

  const networkMunicipalities = new Map<
    string,
    GameMunicipalityCoverage
  >()

  let coveredStationCount = 0
  let uncoveredStationCount = 0

  for (const line of lines) {
    coveredStationCount += line.coveredStationCount
    uncoveredStationCount += line.uncoveredStationCount

    for (const municipality of line.municipalities) {
      const existing = networkMunicipalities.get(
        municipality.code,
      )

      if (existing) {
        existing.stationCount += municipality.stationCount
        existing.lineCount += 1
        continue
      }

      networkMunicipalities.set(
        municipality.code,
        {
          ...municipality,
          lineCount: 1,
        },
      )
    }
  }

  const municipalityList = Array.from(
    networkMunicipalities.values(),
  ).sort(
    (left, right) => (
      right.population - left.population
    ),
  )

  return {
    municipalitiesServed: municipalityList.length,
    populationServed: municipalityList.reduce(
      (total, municipality) => (
        total + municipality.population
      ),
      0,
    ),
    coveredStationCount,
    uncoveredStationCount,
    municipalities: municipalityList,
    lines,
  }
}
