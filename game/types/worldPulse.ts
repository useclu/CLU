import type { GameManagementPanel } from './game'

export type GameWorldPulseTone = 'EVENT' | 'ALERT' | 'OPPORTUNITY' | 'SUCCESS' | 'INFO'
export type GameWorldPulseIntent = 'CREATE_LINE' | 'OPEN_PANEL'

export interface GameWorldPulseItem {
  id: string
  tone: GameWorldPulseTone
  priority: number
  title: string
  summary: string
  metric?: string
  lineId?: string
  stationId?: string
  municipalityCode?: string
  localEventId?: string
  panel?: GameManagementPanel
  intent?: GameWorldPulseIntent
}
