export type GameInfoSeverity =
  | 'INFO'
  | 'OPPORTUNITY'
  | 'WARNING'
  | 'CRITICAL'

export type GameInfoCategory =
  | 'NETWORK'
  | 'PASSENGERS'
  | 'FINANCE'
  | 'MAINTENANCE'
  | 'STATION'
  | 'MUNICIPALITY'
  | 'OBJECTIVE'

export interface GameInfoItem {
  id: string
  day: number
  severity: GameInfoSeverity
  category: GameInfoCategory
  title: string
  description: string
  lineId?: string
  stationId?: string
  municipalityCode?: string
  metric?: string
}
