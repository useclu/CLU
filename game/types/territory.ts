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
  /** Métropole 2.0 : activité supplémentaire liée aux projets et événements locaux. */
  mobilityDemandMultiplier?: number
  /** Renforts temporaires de fréquence décidés pour un événement local. */
  lineServiceMultipliers?: Record<string, number>
  geometry: GameMunicipalityGeometry
  bounds: GameMunicipalityBounds
}

export interface GameMunicipalityCoverage {
  code: string
  name: string
  departmentCode: string
  population: number
  mobilityDemandMultiplier?: number
  lineServiceMultipliers?: Record<string, number>
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
