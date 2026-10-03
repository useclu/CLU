import type { GameLocale } from './i18n'
import type { GameGraphicsQuality } from './freePlay'

export type GameTextSize = 'SMALL' | 'MEDIUM' | 'LARGE'
export type GameTheme = 'DARK' | 'LIGHT'

export interface GameUserSettings {
  locale: GameLocale
  theme: GameTheme
  graphicsQuality: GameGraphicsQuality
  vehicleAnimations: boolean
  buildings2D5: boolean
  reducedMotion: boolean
  highContrast: boolean
  textSize: GameTextSize
  contextualTips: boolean
  tutorialEnabled: boolean
  wikiEnabled: boolean
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  masterMuted: boolean
  musicMuted: boolean
  sfxMuted: boolean
}
