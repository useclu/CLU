export interface GameAssistantHistoryEntry {
  id: string
  day: number
  title: string
  message: string
  lineId?: string
  lineName?: string
}

export interface GameAssistantState {
  history: GameAssistantHistoryEntry[]
}
