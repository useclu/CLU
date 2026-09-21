import { useState } from '#app'
import {
  GAME_USER_SETTINGS_STORAGE_KEY,
  createDefaultGameUserSettings,
  normalizeGameUserSettings,
} from '../config/settings'
import type { GameUserSettings } from '../types/settings'

export function useGameSettings() {
  const settings = useState<GameUserSettings>('clu-metropole-user-settings', createDefaultGameUserSettings)
  const initialized = useState<boolean>('clu-metropole-user-settings-ready', () => false)

  function applyToDocument() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    // CLU Métropole reste volontairement sombre : le thème clair n'est pas adapté
    // au langage visuel actuel du jeu et n'est plus exposé dans les paramètres.
    root.lang = settings.value.locale
    root.dataset.cluGameLocale = settings.value.locale
    root.dataset.cluGameTheme = 'dark'
    root.dataset.cluGameMotion = settings.value.reducedMotion ? 'reduced' : 'full'
    root.dataset.cluGameContrast = settings.value.highContrast ? 'high' : 'standard'
    root.dataset.cluGameTextSize = settings.value.textSize.toLowerCase()
  }

  function persist() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(GAME_USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings.value))
  }

  function initialize() {
    if (typeof window === 'undefined') return

    if (!initialized.value) {
      try {
        const raw = window.localStorage.getItem(GAME_USER_SETTINGS_STORAGE_KEY)
        settings.value = raw
          ? normalizeGameUserSettings(JSON.parse(raw) as Partial<GameUserSettings>)
          : createDefaultGameUserSettings()
      }
      catch {
        settings.value = createDefaultGameUserSettings()
      }
      initialized.value = true
    }

    applyToDocument()
  }

  function dispose() {
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-clu-game-locale')
      document.documentElement.removeAttribute('data-clu-game-theme')
      document.documentElement.removeAttribute('data-clu-game-motion')
      document.documentElement.removeAttribute('data-clu-game-contrast')
      document.documentElement.removeAttribute('data-clu-game-text-size')
    }
  }

  function update(patch: Partial<GameUserSettings>) {
    settings.value = normalizeGameUserSettings({ ...settings.value, ...patch })
    persist()
    applyToDocument()
  }

  function reset() {
    settings.value = createDefaultGameUserSettings()
    persist()
    applyToDocument()
  }

  return {
    settings,
    initialized,
    initialize,
    update,
    reset,
    applyToDocument,
    dispose,
  }
}
