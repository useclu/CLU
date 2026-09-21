import type { GameMunicipalityRequestKind } from '../types/municipalities'
import type { GameTransportMode } from '../types/network'

export const GAME_MUNICIPALITY_INITIAL_RELATION = 50
export const GAME_MUNICIPALITY_RELATION_MIN = 0
export const GAME_MUNICIPALITY_RELATION_MAX = 100

export const GAME_MUNICIPALITY_RELATION_COMPLETED_DELTA = 8
export const GAME_MUNICIPALITY_RELATION_REFUSED_DELTA = -2
export const GAME_MUNICIPALITY_RELATION_FAILED_DELTA = -8
export const GAME_MUNICIPALITY_RELATION_EXPIRED_DELTA = -1

export const GAME_MUNICIPALITY_DECISION_DAYS = 5
export const GAME_MUNICIPALITY_COMPLETION_DAYS = 14
export const GAME_MUNICIPALITY_REQUEST_COOLDOWN_DAYS = 12
export const GAME_MUNICIPALITY_MAX_OPEN_REQUESTS = 4
/** V41 : conserve toutes les demandes ouvertes + les 240 dernières demandes résolues. */
export const GAME_MUNICIPALITY_REQUEST_HISTORY_LIMIT = 240

/**
 * Gros Lot 12 : chaque demande reste adossée au projet réellement livré.
 * Les parts sont volontairement différentes : renforcer un service existant
 * coûte moins qu'une infrastructure neuve, mais reste assez intéressant pour
 * être une vraie opportunité de développement.
 */
export const GAME_MUNICIPALITY_REQUEST_FUNDING_SHARE: Record<GameMunicipalityRequestKind, number> = {
  ADD_STATION: 0.42,
  ADD_LINE: 0.38,
  BOOST_SERVICE: 0.46,
}

export const GAME_MUNICIPALITY_MODE_SUBSIDY_LIMITS: Record<GameTransportMode, {
  stationMin: number
  stationMax: number
  lineMin: number
  lineMax: number
  serviceMin: number
  serviceMax: number
}> = {
  BUS: { stationMin: 2_000_000, stationMax: 20_000_000, lineMin: 5_000_000, lineMax: 80_000_000, serviceMin: 300_000, serviceMax: 8_000_000 },
  BRT: { stationMin: 12_000_000, stationMax: 90_000_000, lineMin: 45_000_000, lineMax: 320_000_000, serviceMin: 800_000, serviceMax: 18_000_000 },
  TRAM: { stationMin: 25_000_000, stationMax: 190_000_000, lineMin: 120_000_000, lineMax: 650_000_000, serviceMin: 3_000_000, serviceMax: 50_000_000 },
  TRAIN: { stationMin: 45_000_000, stationMax: 300_000_000, lineMin: 180_000_000, lineMax: 850_000_000, serviceMin: 8_000_000, serviceMax: 100_000_000 },
  RER: { stationMin: 60_000_000, stationMax: 380_000_000, lineMin: 250_000_000, lineMax: 1_050_000_000, serviceMin: 10_000_000, serviceMax: 140_000_000 },
  METRO: { stationMin: 80_000_000, stationMax: 480_000_000, lineMin: 320_000_000, lineMax: 1_450_000_000, serviceMin: 8_000_000, serviceMax: 120_000_000 },
}
