export type GameGeneratedTerritorySize = 'SMALL' | 'MEDIUM' | 'LARGE'
export type GameGeneratedTerritoryDensity = 'LOW' | 'STANDARD' | 'HIGH'
export type GameGeneratedTerritoryStructure = 'MONOCENTRIC' | 'POLYCENTRIC' | 'SPRAWLED'
export type GameGeneratedTerritoryWater = 'LOW' | 'STANDARD' | 'HIGH'

export interface GameGeneratedTerritorySettings {
  version: 3
  seed: string
  name: string
  size: GameGeneratedTerritorySize
  density: GameGeneratedTerritoryDensity
  structure: GameGeneratedTerritoryStructure
  water: GameGeneratedTerritoryWater
}

export interface GameGeneratedTerritorySummary {
  population: number
  municipalityCount: number
  urbanCenterCount: number
  departmentCount: number
  areaKm2: number
  waterShareLabel: string
  structureLabel: string
  densityLabel: string
  sizeLabel: string
}
