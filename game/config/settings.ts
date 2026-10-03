import type { GameGraphicsQuality } from '../types/freePlay'
import type { GameUserSettings } from '../types/settings'
import { GAME_DEFAULT_LOCALE, isGameLocale } from './i18n'

export const GAME_USER_SETTINGS_STORAGE_KEY = 'clu-metropole-user-settings-v1'

export const GAME_GRAPHICS_OPTIONS: Array<{ id: GameGraphicsQuality; label: string; description: string }> = [
  { id: 'AUTO', label: 'Auto', description: 'Adapte automatiquement le niveau de détail à la taille du réseau.' },
  { id: 'ECO', label: 'Éco', description: 'Priorité à la fluidité sur les gros réseaux.' },
  { id: 'BALANCED', label: 'Équilibrée', description: 'Compromis recommandé entre détails et performances.' },
  { id: 'HIGH', label: 'Élevée', description: 'Plus de détails lorsque le zoom et la machine le permettent.' },
]

export function createDefaultGameUserSettings(): GameUserSettings {
  return {
    locale: GAME_DEFAULT_LOCALE,
    theme: 'DARK',
    graphicsQuality: 'AUTO',
    vehicleAnimations: true,
    buildings2D5: true,
    reducedMotion: false,
    highContrast: false,
    textSize: 'MEDIUM',
    contextualTips: true,
    tutorialEnabled: true,
    wikiEnabled: true,
    masterVolume: 82,
    musicVolume: 62,
    sfxVolume: 72,
    masterMuted: false,
    musicMuted: false,
    sfxMuted: false,
  }
}

export function normalizeGameUserSettings(value?: Partial<GameUserSettings> | null): GameUserSettings {
  const fallback = createDefaultGameUserSettings()
  const graphicsQuality = ['AUTO', 'ECO', 'BALANCED', 'HIGH'].includes(String(value?.graphicsQuality))
    ? value?.graphicsQuality as GameGraphicsQuality
    : fallback.graphicsQuality

  const textSize = ['SMALL', 'MEDIUM', 'LARGE'].includes(String(value?.textSize))
    ? value?.textSize as GameUserSettings['textSize']
    : fallback.textSize

  const theme = value?.theme === 'LIGHT' ? 'LIGHT' : 'DARK'

  const volume = (raw: unknown, fallbackValue: number) => {
    const numeric = Number(raw)
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallbackValue
  }

  return {
    locale: isGameLocale(value?.locale) ? value.locale : fallback.locale,
    theme,
    graphicsQuality,
    vehicleAnimations: value?.vehicleAnimations !== false,
    buildings2D5: value?.buildings2D5 !== false,
    reducedMotion: value?.reducedMotion === true,
    highContrast: value?.highContrast === true,
    textSize,
    contextualTips: value?.contextualTips !== false,
    tutorialEnabled: value?.tutorialEnabled !== false,
    wikiEnabled: value?.wikiEnabled !== false,
    masterVolume: volume(value?.masterVolume, fallback.masterVolume),
    musicVolume: volume(value?.musicVolume, fallback.musicVolume),
    sfxVolume: volume(value?.sfxVolume, fallback.sfxVolume),
    masterMuted: value?.masterMuted === true,
    musicMuted: value?.musicMuted === true,
    sfxMuted: value?.sfxMuted === true,
  }
}
