import {
  computed,
} from 'vue'

import {
  GAME_CONTROLLER_DAILY_COST,
  GAME_MAX_CONTROLLERS_PER_LINE,
  calculateAutomaticControllerCount,
  normalizeControllerCount,
} from '../config/inspection'

import type {
  GameInspectionMode,
} from '../types/network'

import {
  useMetropoleGame,
} from './useMetropoleGame'

export function useGameInspection() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  const dailyCostPerController = GAME_CONTROLLER_DAILY_COST
  const maxControllers = GAME_MAX_CONTROLLERS_PER_LINE

  const lines = computed(
    () => game.state.value.save?.data.network.lines ?? [],
  )

  function line(
    lineId: string,
  ) {
    return lines.value.find(
      item => item.id === lineId,
    ) ?? null
  }

  async function setMode(
    lineId: string,
    mode: GameInspectionMode,
  ) {
    assertWritable()
    const save = game.state.value.save
    const target = line(lineId)

    if (!save || !target) {
      return false
    }

    target.inspectionMode = mode
    target.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()

    return true
  }

  async function setControllerCount(
    lineId: string,
    count: number,
  ) {
    assertWritable()
    const save = game.state.value.save
    const target = line(lineId)

    if (!save || !target || !Number.isFinite(count)) {
      return false
    }

    target.controllerCount = normalizeControllerCount(count)
    target.inspectionMode = 'CUSTOM'
    target.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()

    return true
  }

  function automaticCount(
    passengers: number,
  ) {
    return calculateAutomaticControllerCount(passengers)
  }

  return {
    dailyCostPerController,
    maxControllers,
    setMode,
    setControllerCount,
    automaticCount,
  }
}
