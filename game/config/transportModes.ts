import type { GameLineRoutingMode, GameTransportMode } from '../types/network'

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
  { value: 'CABLE', label: 'Téléphérique', shortLabel: 'C', accent: '#73d9e6', mapLineWidth: 4.8, stationRadius: 5.4 },
  { value: 'FERRY', label: 'Navette fluviale', shortLabel: 'F', accent: '#4aa8ff', mapLineWidth: 5.2, stationRadius: 5.6 },
]

export function getTransportModeDefinition(mode: GameTransportMode) {
  return GAME_TRANSPORT_MODES.find(item => item.value === mode) ?? GAME_TRANSPORT_MODES[0]!
}

export function isGameTransportMode(value: unknown): value is GameTransportMode {
  return GAME_TRANSPORT_MODES.some(item => item.value === value)
}


/**
 * Compatibilité sauvegardes : RER/Train utilisaient déjà ASSISTED pour le rail
 * strict et LIGHT pour l'aide légère. Les autres modes utilisaient ASSISTED
 * comme aide légère. On conserve ces valeurs historiques et on utilise LIGHT
 * comme Rail auto pour les modes non ferroviaires afin de ne casser aucune
 * ancienne sauvegarde.
 */
export function railAutoRoutingMode(mode: GameTransportMode): GameLineRoutingMode {
  return mode === 'RER' || mode === 'TRAIN' ? 'ASSISTED' : 'LIGHT'
}

export function lightAssistRoutingMode(mode: GameTransportMode): GameLineRoutingMode {
  return mode === 'RER' || mode === 'TRAIN' ? 'LIGHT' : 'ASSISTED'
}

export function isRailAutoRouting(mode: GameTransportMode, routingMode: GameLineRoutingMode | undefined) {
  return mode !== 'FERRY' && (routingMode ?? 'ASSISTED') === railAutoRoutingMode(mode)
}

export function isLightAssistRouting(mode: GameTransportMode, routingMode: GameLineRoutingMode | undefined) {
  return mode !== 'FERRY' && (routingMode ?? 'ASSISTED') === lightAssistRoutingMode(mode)
}
