import type { GameLocalEventKind, GameUrbanProjectKind, GameUrbanProjectStatus } from './municipalities'

export type GameMapInsightMode = 'NONE' | 'POPULATION' | 'ACCESSIBILITY' | 'GROWTH' | 'POTENTIAL' | 'FLOW' | 'SATURATION'

export interface GameMapMunicipalityInsight {
  code: string
  name?: string
  departmentCode?: string
  population: number
  basePopulation: number
  accessibility: number
  growthRate: number
  lineCount: number
  stationCount: number
  /** Métropole 2.0 : besoin/opportunité de desserte synthétique, 0 à 100. */
  potential: number
  /** Projet urbain le plus proche dans cette commune. */
  urbanProjectTitle?: string
  urbanProjectKind?: GameUrbanProjectKind
  urbanProjectOpeningDay?: number
  urbanProjectConstructionStartDay?: number
  urbanProjectMaturityDay?: number
  urbanProjectStatus?: GameUrbanProjectStatus
  /** Événement local annoncé ou actif. */
  localEventTitle?: string
  localEventKind?: GameLocalEventKind
  localEventStartsDay?: number
  localEventVisitors?: number
  localEventStatus?: 'ANNOUNCED' | 'ACTIVE' | 'FINISHED'
  /** Centre cartographique du territoire, utilisé pour afficher les signaux du monde vivant. */
  centerLongitude?: number
  centerLatitude?: number
}
