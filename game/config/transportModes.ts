import type { GameTransportMode } from '../types/network'

export interface GameTransportModeDefinition {
  value: GameTransportMode
  label: string
  shortLabel: string
  accent: string
  mapLineWidth: number
  stationRadius: number
}

export const GAME_TRANSPORT_MODES: GameTransportModeDefinition[] = [
  { value: 'METRO', label: 'Métro', shortLabel: 'M', accent: '#62b0ff', mapLineWidth: 6.2, stationRadius: 5.6 },
  { value: 'TRAM', label: 'Tram', shortLabel: 'T', accent: '#68d7ad', mapLineWidth: 5.2, stationRadius: 5.2 },
  { value: 'RER', label: 'RER', shortLabel: 'R', accent: '#f06b76', mapLineWidth: 7.4, stationRadius: 6.2 },
  { value: 'TRAIN', label: 'Train', shortLabel: 'N', accent: '#b69cff', mapLineWidth: 7.6, stationRadius: 6.3 },
  { value: 'BUS', label: 'Bus', shortLabel: 'B', accent: '#f2b85d', mapLineWidth: 4.2, stationRadius: 4.8 },
  { value: 'BRT', label: 'Bus express', shortLabel: 'X', accent: '#ff8f68', mapLineWidth: 5.6, stationRadius: 5.4 },
]

export function getTransportModeDefinition(mode: GameTransportMode) {
  return GAME_TRANSPORT_MODES.find(item => item.value === mode) ?? GAME_TRANSPORT_MODES[0]!
}

export function isGameTransportMode(value: unknown): value is GameTransportMode {
  return GAME_TRANSPORT_MODES.some(item => item.value === value)
}
