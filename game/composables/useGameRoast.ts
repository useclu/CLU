import { computed } from 'vue'
import { currentGameLocale, translateGameText } from '../config/i18n'
import { useMetropoleGame } from './useMetropoleGame'
import { useGameSettings } from './useGameSettings'
import { createEmptyRoastState, processGameRoastDay } from '../engine/roast'
import type { GameSimulationDayReport } from '../types/simulation'

export function useGameRoast() {
  const game = useMetropoleGame()
  const preferences = useGameSettings()

  function ensureState() {
    const save = game.state.value.save
    if (!save) return null
    if (!save.data.roast) save.data.roast = createEmptyRoastState()
    return save.data.roast
  }

  const state = computed(() => game.state.value.save?.data.roast ?? null)
  const recentHistory = computed(() => [...(state.value?.history ?? [])].reverse().slice(0, 8))

  function processDay(report: GameSimulationDayReport) {
    if (!preferences.settings.value.cluRoastEnabled) return null
    const save = game.state.value.save
    const roast = ensureState()
    if (!save || !roast) return null
    return processGameRoastDay(roast, save, report, preferences.settings.value.cluRoastFrequency)
  }

  function pushAssistant(
    title: string,
    messageTemplate: string,
    day: number,
    lineId?: string,
    lineName?: string,
    tokens: Record<string, string | number> = {},
  ) {
    const roast = ensureState()
    if (!roast) return null
    const locale = currentGameLocale()
    const translatedTemplate = translateGameText(messageTemplate, locale)
    const message = translatedTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key]) : match,
    )
    const entry = {
      id: `assistant-${day}-${Date.now().toString(36)}`,
      templateId: 'assistant',
      day,
      category: 'ASSISTANT' as const,
      intensity: 'LIGHT' as const,
      reference: 'CULTURE' as const,
      title: translateGameText(title, locale),
      message,
      lineId,
      lineName,
    }
    roast.history.push(entry)
    if (roast.history.length > 40) roast.history.splice(0, roast.history.length - 40)
    roast.totalTriggered += 1
    return entry
  }

  return { state, recentHistory, processDay, pushAssistant }
}
