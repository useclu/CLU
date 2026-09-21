import type { GameLocale } from './i18n'
import type { GameGraphicsQuality } from './freePlay'
import type { GameRoastFrequency } from './roast'

export type GameTextSize = 'SMALL' | 'MEDIUM' | 'LARGE'

export interface GameUserSettings {
  locale: GameLocale
  graphicsQuality: GameGraphicsQuality
  vehicleAnimations: boolean
  buildings2D5: boolean
  reducedMotion: boolean
  highContrast: boolean
  textSize: GameTextSize
  contextualTips: boolean
  tutorialEnabled: boolean
  wikiEnabled: boolean
  cluRoastEnabled: boolean
  cluRoastFrequency: GameRoastFrequency
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  masterMuted: boolean
  musicMuted: boolean
  sfxMuted: boolean
}
