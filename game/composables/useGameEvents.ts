import {
  computed,
} from 'vue'

import {
  createEmptyEventsState,
  getEventSimulationModifiers,
  processGameEventsDay,
  resolveActiveGameEvent,
} from '../engine/events'

import {
  useMetropoleGame,
} from './useMetropoleGame'
import { GAME_EVENT_FREQUENCY_INTERVAL_MULTIPLIERS } from '../config/freePlay'
import type { GameSimulationDayReport } from '../types/simulation'

export function useGameEvents() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  function ensureEventsState() {
    const save = game.state.value.save

    if (!save) {
      return null
    }

    if (!save.data.events) {
      save.data.events = createEmptyEventsState()
    }

    return save.data.events
  }

  const state = computed(
    () => game.state.value.save?.data.events ?? null,
  )

  const activeEvent = computed(
    () => state.value?.active ?? null,
  )

  const activeModifiers = computed(
    () => {
      const save = game.state.value.save
      const events = ensureEventsState()

      if (!save || !events) {
        return []
      }

      const day = save.data.simulationDay

      return events.modifiers.filter(
        modifier => (
          day <= modifier.endsDay
          && day + 1 >= modifier.startsDay
        ),
      )
    },
  )

  const recentHistory = computed(
    () => [...(state.value?.history ?? [])]
      .reverse()
      .slice(0, 8),
  )

  const nextEligibleDay = computed(
    () => state.value?.nextEligibleDay ?? 2,
  )

  const totalResolved = computed(
    () => state.value?.totalResolved ?? 0,
  )

  const totalBalanceImpact = computed(
    () => state.value?.totalBalanceImpact ?? 0,
  )

  function modifiersForDay(
    day: number,
  ) {
    const events = ensureEventsState()

    if (!events) {
      return {
        demandMultiplier: 1,
        revenueMultiplier: 1,
        operatingCostMultiplier: 1,
      }
    }

    return getEventSimulationModifiers(
      events,
      day,
    )
  }

  async function choose(
    choiceId: string,
  ) {
    assertWritable()
    const save = game.state.value.save
    const eventState = ensureEventsState()

    if (!save || !eventState) {
      return null
    }

    const result = resolveActiveGameEvent(
      eventState,
      save.data.economy,
      choiceId,
      save.data.simulationDay,
      save.id,
      GAME_EVENT_FREQUENCY_INTERVAL_MULTIPLIERS[save.data.freePlaySettings.eventFrequency],
    )

    if (result) {
      await game.persistCurrentGame()
    }

    return result
  }

  function processDay(
    day: number,
    operationalLineCount: number,
    report: GameSimulationDayReport | null = null,
  ) {
    const save = game.state.value.save
    const eventState = ensureEventsState()

    if (!save || !eventState) {
      return null
    }

    const operationalDays = save.data.simulation.history.filter(report => (report.lines?.length ?? 0) > 0).length
    if (operationalDays <= 2) return null

    return processGameEventsDay(
      eventState,
      {
        saveId: save.id,
        day,
        operationalLineCount,
        balance: save.data.economy.balance,
        context: {
          passengers: Math.max(0, report?.passengers ?? 0),
          serviceQualityScore: Math.max(0, report?.serviceQualityScore ?? 70),
          demandSatisfactionRate: Math.min(1, Math.max(0, report?.demandSatisfactionRate ?? 1)),
          congestedStationCount: Math.max(0, report?.congestedStationCount ?? 0),
          dailyOperatingResult: report?.netResult ?? 0,
          debtPrincipal: Math.max(0, save.data.economy.debtPrincipal),
        },
        intervalMultiplier: GAME_EVENT_FREQUENCY_INTERVAL_MULTIPLIERS[save.data.freePlaySettings.eventFrequency],
      },
    )
  }

  return {
    state,
    activeEvent,
    activeModifiers,
    recentHistory,
    nextEligibleDay,
    totalResolved,
    totalBalanceImpact,
    modifiersForDay,
    choose,
    processDay,
  }
}
