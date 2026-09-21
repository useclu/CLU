export type GameRoastCategory =
  | 'SATURATION'
  | 'DEFICIT'
  | 'DEBT'
  | 'EMPTY_NETWORK'
  | 'OVERFLEET'
  | 'QUALITY_CRASH'
  | 'PROFIT_STAR'
  | 'GREAT_DAY'
  | 'CASH_HOARD'
  | 'MEGA_PROJECT'
  | 'WAITING_ROOM'
  | 'ASSISTANT'

export type GameRoastIntensity = 'LIGHT' | 'MEDIUM' | 'EPIC'
export type GameRoastReference = 'FOOTBALL' | 'CULTURE'

export interface GameRoastHistoryEntry {
  id: string
  templateId: string
  day: number
  category: GameRoastCategory
  intensity: GameRoastIntensity
  reference: GameRoastReference
  title: string
  message: string
  lineId?: string
  lineName?: string
}

export interface GameRoastState {
  history: GameRoastHistoryEntry[]
  recentTemplateIds: string[]
  lastTriggeredDay: number
  lastCategoryDays: Partial<Record<GameRoastCategory, number>>
  totalTriggered: number
}

export type GameRoastFrequency = 'RARE' | 'STANDARD' | 'FREQUENT'
