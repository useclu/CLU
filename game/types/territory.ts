import type {
  GameTransportMode,
} from './network'

export type GameCoordinate = [number, number]

export interface GamePolygonGeometry {
  type: 'Polygon'
  coordinates: GameCoordinate[][]
}

export interface GameMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: GameCoordinate[][][]
}

export type GameMunicipalityGeometry =
  | GamePolygonGeometry
  | GameMultiPolygonGeometry

export interface GameMunicipalityBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface GameMunicipality {
  code: string
  name: string
  departmentCode: string
  population: number
  geometry: GameMunicipalityGeometry
  bounds: GameMunicipalityBounds
}

export interface GameMunicipalityCoverage {
  code: string
  name: string
  departmentCode: string
  population: number
  stationCount: number
  lineCount: number
}

export interface GameLineMunicipalityCoverage {
  lineId: string
  mode: GameTransportMode
  stationCount: number
  coveredStationCount: number
  uncoveredStationCount: number
  municipalities: GameMunicipalityCoverage[]
  populationServed: number
}

export interface GameNetworkTerritorySummary {
  municipalitiesServed: number
  populationServed: number
  coveredStationCount: number
  uncoveredStationCount: number
  municipalities: GameMunicipalityCoverage[]
  lines: GameLineMunicipalityCoverage[]
}
