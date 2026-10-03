import type { GameTransportMode } from './network'

export type GameProjectForecastTone = 'LOCAL' | 'BALANCED' | 'STRUCTURING'

export interface GameProjectForecast {
  municipalityCodes: string[]
  municipalityCount: number
  populationServed: number
  uncoveredStationCount: number
  interchangeCount: number
  estimatedDailyDemand: number
  costPerKm: number
  tone: GameProjectForecastTone
  suggestedMode: GameTransportMode
  advice: string
}
