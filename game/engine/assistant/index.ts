import type { GameAssistantHistoryEntry, GameAssistantState } from '../../types/assistant'

const HISTORY_LIMIT = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeEntry(value: unknown): GameAssistantHistoryEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.message !== 'string') return null
  const day = Number(value.day)
  if (!Number.isFinite(day)) return null
  return {
    id: value.id,
    day: Math.max(1, Math.floor(day)),
    title: value.title,
    message: value.message,
    lineId: typeof value.lineId === 'string' ? value.lineId : undefined,
    lineName: typeof value.lineName === 'string' ? value.lineName : undefined,
  }
}

export function createEmptyAssistantState(): GameAssistantState {
  return { history: [] }
}

export function normalizeAssistantState(value?: Partial<GameAssistantState> | null, legacyPersonalityState?: unknown): GameAssistantState {
  const entries: GameAssistantHistoryEntry[] = []
  const seen = new Set<string>()

  const addEntries = (rawEntries: unknown[], assistantOnly: boolean) => {
    for (const raw of rawEntries) {
      if (assistantOnly && (!isRecord(raw) || raw.category !== 'ASSISTANT')) continue
      const entry = normalizeEntry(raw)
      if (!entry || seen.has(entry.id)) continue
      seen.add(entry.id)
      entries.push(entry)
    }
  }

  if (Array.isArray(value?.history)) addEntries(value.history, false)
  if (isRecord(legacyPersonalityState) && Array.isArray(legacyPersonalityState.history)) {
    addEntries(legacyPersonalityState.history, true)
  }

  return { history: entries.slice(-HISTORY_LIMIT) }
}
