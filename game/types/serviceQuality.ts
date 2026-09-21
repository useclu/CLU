export interface GameServiceQualityBreakdown {
  frequency: number
  reliability: number
  crowding: number
  affordability: number
  travelTime: number
  inspectionComfort: number
  stations: number
}

export interface GameServiceQualityResult {
  score: number
  demandMultiplier: number
  projectedOccupancyRate: number
  breakdown: GameServiceQualityBreakdown
}
