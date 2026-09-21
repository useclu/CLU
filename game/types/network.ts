export type GameTransportMode =
  | 'METRO'
  | 'TRAM'
  | 'RER'
  | 'TRAIN'
  | 'BUS'
  | 'BRT'

export type GameServiceLevel =
  | 'REDUCED'
  | 'STANDARD'
  | 'FREQUENT'
  | 'INTENSIVE'

export type GameServicePeriod =
  | 'OFF_PEAK'
  | 'NORMAL'
  | 'PEAK'

export type GameServiceProfileMode =
  | 'SIMPLE'
  | 'ADVANCED'

export interface GameServiceProfile {
  offPeak: GameServiceLevel
  normal: GameServiceLevel
  peak: GameServiceLevel
}

export type GameMaintenanceLevel =
  | 'ECONOMY'
  | 'STANDARD'
  | 'PREVENTIVE'

export type GameRegulationMode =
  | 'AUTO'
  | 'MANUAL'

export type GameRollingStockUpgradeKey =
  | 'capacity'
  | 'speed'
  | 'reliability'
  | 'efficiency'
  | 'boarding'

export interface GameRollingStockUpgrades {
  capacity: number
  speed: number
  reliability: number
  efficiency: number
  boarding: number
}

export type GameInspectionMode =
  | 'AUTO'
  | 'CUSTOM'

export type GameStationFacilityLevel =
  | 'BASIC'
  | 'STANDARD'
  | 'HUB'

export type GameLineStatus =
  | 'PROJECT'
  | 'CONSTRUCTION'
  | 'OPERATIONAL'

export type GameLineBadgeStyle =
  | 'CIRCLE'
  | 'ROUNDED'
  | 'SQUARE'
  | 'DIAMOND'

export type GameLineEmblem =
  | 'NONE'
  | 'METRO'
  | 'TRAM'
  | 'RER'
  | 'TRAIN'
  | 'BUS'
  | 'EXPRESS'
  | 'STAR'

export type GameLineRoutingMode =
  | 'ASSISTED'
  | 'FREE'

export interface GameLineRouteSegment {
  fromStationId: string
  toStationId: string
  /** Géométrie visuelle persistée entre les deux stations, extrémités incluses. */
  coordinates: Array<[number, number]>
  source: 'ASSISTED' | 'FREE'
}

export type GameInfrastructureType =
  | 'AUTO'
  | 'SURFACE'
  | 'TUNNEL'
  | 'VIADUCT'
  | 'DEDICATED'
  | 'ROAD'
  | 'RAIL'

export interface GameStation {
  id: string
  name: string
  longitude: number
  latitude: number
  facilityLevel?: GameStationFacilityLevel
  /** Identifiant partagé quand plusieurs lignes utilisent physiquement la même station. */
  sharedStationId?: string
}

export interface GameLineBranch {
  id: string
  /** Station existante où la branche quitte le tracé principal ou une autre branche. */
  fromStationId: string
  /** Stations propres à la branche, sans dupliquer la station de bifurcation. */
  stations: GameStation[]
}

export interface GameInterchangeLink {
  fromLineId: string
  fromStationId: string
  toLineId: string
  toStationId: string
  distanceMeters: number
  quality: 'DIRECT' | 'GOOD' | 'LONG' | 'VERY_LONG'
}

export interface GameLine {
  id: string
  name: string
  /** Logo local compressé (data URL) choisi par le joueur. */
  customLogoDataUrl?: string
  /** Indice court affiché dans le badge de ligne : 1, A, T3, N... */
  shortCode: string
  badgeStyle: GameLineBadgeStyle
  emblem: GameLineEmblem
  mode: GameTransportMode
  status: GameLineStatus
  infrastructureType: GameInfrastructureType
  /** V35 : l'assistance de tracé reste désactivable à tout moment par le joueur. */
  routingMode?: GameLineRoutingMode
  /** Géométrie intermédiaire invisible : elle ne crée aucune station supplémentaire. */
  routeSegments?: GameLineRouteSegment[]
  serviceLevel: GameServiceLevel
  serviceProfileMode: GameServiceProfileMode
  serviceProfile: GameServiceProfile
  maintenanceLevel: GameMaintenanceLevel
  fleetCondition: number
  vehicleCount: number
  rollingStockUpgrades: GameRollingStockUpgrades
  regulationMode: GameRegulationMode
  /** Nombre de véhicules de réserve volontairement injectés en manuel. */
  manualBoostVehicles: number
  inspectionMode: GameInspectionMode
  controllerCount: number
  color: string
  createdAt: string
  updatedAt: string
  constructionCost: number
  estimatedConstructionCost: number
  constructionDaysRemaining: number
  stations: GameStation[]
  /** Branches persistées. Le tronc principal reste dans `stations`. */
  branches?: GameLineBranch[]
}

export interface GameNetworkState {
  lines: GameLine[]
}
