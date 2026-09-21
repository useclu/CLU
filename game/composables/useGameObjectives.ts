import { computed } from 'vue'
import { getGameScenarioDefinition } from '../config/objectives'
import {
  createEmptyObjectivesState,
  ensureDynamicObjectives,
  evaluateGameObjectives,
  objectiveProgress,
} from '../engine/objectives'
import { useGameTerritory } from './useGameTerritory'
import { useMetropoleGame } from './useMetropoleGame'

export function useGameObjectives() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }
  const territory = useGameTerritory()

  function ensureState() {
    const save = game.state.value.save
    if (!save) return null
    if (!save.data.objectives) save.data.objectives = createEmptyObjectivesState()
    return save.data.objectives
  }

  const state = computed(() => game.state.value.save?.data.objectives ?? null)
  const scenario = computed(() => getGameScenarioDefinition(state.value?.scenarioId ?? ''))
  const objectives = computed(() => {
    const save = game.state.value.save
    if (!save) return []
    return (state.value?.active ?? []).map(definition => ({
      definition,
      progress: objectiveProgress(save, territory.summary.value, definition),
      completed: false,
    }))
  })
  const completedCount = computed(() => state.value?.totalCompleted ?? state.value?.completed.length ?? 0)
  const isCompleted = computed(() => false)
  const completedDay = computed(() => null)
  const recentCompleted = computed(() => [...(state.value?.completed ?? [])].reverse().slice(0, 8))
  const totalRewards = computed(() => state.value?.totalRewards ?? 0)

  function processDay(day: number) {
    const save = game.state.value.save
    const objectivesState = ensureState()
    if (!save || !objectivesState || !save.data.freePlaySettings.objectivesEnabled) return false
    return evaluateGameObjectives(
      objectivesState,
      save,
      save.data.economy,
      territory.summary.value,
      day,
    )
  }

  async function sync() {
    assertWritable()
    const save = game.state.value.save
    const objectivesState = ensureState()
    if (!save || !objectivesState || !save.data.freePlaySettings.objectivesEnabled) return false
    const changed = ensureDynamicObjectives(
      objectivesState,
      save,
      territory.summary.value,
      save.data.simulationDay,
    )
    if (changed) await game.persistCurrentGame()
    return changed
  }

  return {
    state,
    scenario,
    objectives,
    completedCount,
    isCompleted,
    completedDay,
    recentCompleted,
    totalRewards,
    processDay,
    sync,
  }
}
