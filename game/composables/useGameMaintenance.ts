import {
  getMaintenanceLevelDefinition,
} from '../config/maintenance'

import {
  applyFleetOverhaulCost,
} from '../engine/economy'

import {
  calculateFleetOverhaulCost,
  calculateUnavailableVehicles,
  fleetConditionLabel,
} from '../engine/maintenance'

import type {
  GameLine,
  GameMaintenanceLevel,
} from '../types/network'

import {
  useMetropoleGame,
} from './useMetropoleGame'

export function useGameMaintenance() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  function definition(
    level: GameMaintenanceLevel,
  ) {
    return getMaintenanceLevelDefinition(level)
  }

  function unavailableVehicles(
    line: GameLine,
  ) {
    return calculateUnavailableVehicles(line)
  }

  function conditionLabel(
    condition: number,
  ) {
    return fleetConditionLabel(condition)
  }

  function overhaulCost(
    line: GameLine,
  ) {
    return calculateFleetOverhaulCost(line)
  }

  async function setLevel(
    lineId: string,
    level: GameMaintenanceLevel,
  ) {
    assertWritable()
    const save = game.state.value.save

    if (!save) {
      return false
    }

    const line = save.data.network.lines.find(
      item => item.id === lineId,
    )

    if (!line) {
      return false
    }

    line.maintenanceLevel = level
    line.updatedAt = new Date().toISOString()

    await game.persistCurrentGame()

    return true
  }

  async function overhaulLine(
    lineId: string,
  ) {
    assertWritable()
    const save = game.state.value.save

    if (!save) {
      return false
    }

    const line = save.data.network.lines.find(
      item => item.id === lineId,
    )

    if (!line) {
      return false
    }

    const amount = calculateFleetOverhaulCost(line)

    if (amount <= 0) {
      return false
    }

    const transaction = applyFleetOverhaulCost(
      save.data.economy,
      line,
      amount,
      line.fleetCondition,
    )
    if (!transaction) return false

    line.fleetCondition = 100
    line.updatedAt = new Date().toISOString()

    await game.persistCurrentGame()

    return true
  }

  return {
    definition,
    unavailableVehicles,
    conditionLabel,
    overhaulCost,
    setLevel,
    overhaulLine,
  }
}
