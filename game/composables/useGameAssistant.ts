import { computed } from 'vue'
import { currentGameLocale, translateGameText } from '../config/i18n'
import { createEmptyAssistantState } from '../engine/assistant'
import { useMetropoleGame } from './useMetropoleGame'

const HISTORY_LIMIT = 40

export function useGameAssistant() {
  const game = useMetropoleGame()

  function ensureState() {
    const save = game.state.value.save
    if (!save) return null
    if (!save.data.assistant) save.data.assistant = createEmptyAssistantState()
    return save.data.assistant
  }

  const state = computed(() => game.state.value.save?.data.assistant ?? null)
  const recentHistory = computed(() => [...(state.value?.history ?? [])].reverse().slice(0, 8))

  function push(
    title: string,
    messageTemplate: string,
    day: number,
    lineId?: string,
    lineName?: string,
    tokens: Record<string, string | number> = {},
  ) {
    const assistant = ensureState()
    if (!assistant) return null
    const locale = currentGameLocale()
    const translatedTemplate = translateGameText(messageTemplate, locale)
    const message = translatedTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key]) : match,
    )
    const entry = {
      id: `assistant-${day}-${Date.now().toString(36)}`,
      day,
      title: translateGameText(title, locale),
      message,
      lineId,
      lineName,
    }
    assistant.history.push(entry)
    if (assistant.history.length > HISTORY_LIMIT) assistant.history.splice(0, assistant.history.length - HISTORY_LIMIT)
    return entry
  }

  return { state, recentHistory, push }
}
