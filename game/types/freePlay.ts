export type GameCapitalPreset =
  | 'STANDARD'
  | 'COMFORT'
  | 'RICH'
  | 'CUSTOM'

export type GameEconomyProfile =
  | 'GENEROUS'
  | 'STANDARD'
  | 'HARD'

export type GameEventFrequency =
  | 'CALM'
  | 'STANDARD'
  | 'FREQUENT'

export type GameGraphicsQuality =
  | 'ECO'
  | 'BALANCED'
  | 'HIGH'

export type GameGuidanceMode =
  | 'GUIDED'
  | 'MANUAL'

export interface GameFreePlayGraphicsSettings {
  quality: GameGraphicsQuality
  vehicleAnimations: boolean
  buildings2D5: boolean
}

export interface GameFreePlaySettings {
  capitalPreset: GameCapitalPreset
  startingCapital: number
  /** Triche est volontairement intégrée au mode Personnalisé. */
  cheatUnlimitedMoney: boolean
  economyProfile: GameEconomyProfile
  eventFrequency: GameEventFrequency
  objectivesEnabled: boolean
  contextualTipsEnabled: boolean
  wikiEnabled: boolean
  tutorialEnabled: boolean
  fareGuidance: GameGuidanceMode
  inspectionGuidance: GameGuidanceMode
  regulationGuidance: GameGuidanceMode
  graphics: GameFreePlayGraphicsSettings
}
