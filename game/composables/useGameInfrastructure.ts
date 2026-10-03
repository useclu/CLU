import { computed } from 'vue'
import { useMetropoleGame } from './useMetropoleGame'
import {
  GAME_INFRASTRUCTURE_MAX_LEVEL,
  GAME_INFRASTRUCTURE_UPGRADES,
} from '../config/infrastructure'
import {
  applyInfrastructureLevel,
  calculateInfrastructureLineProfile,
  calculateInfrastructureUpgradeCost,
  infrastructureSegmentState,
  listInfrastructureSegments,
} from '../engine/infrastructure'
import { applyInfrastructureUpgradeCost as chargeInfrastructureUpgrade } from '../engine/economy'
import type {
  GameInfrastructureUpgradeKey,
  GameLine,
} from '../types/network'

export function useGameInfrastructure() {
  const game = useMetropoleGame()

  const lines = computed(() => game.state.value.save?.data.network.lines ?? [])

  function profile(line: GameLine) {
    return calculateInfrastructureLineProfile(line)
  }

  function segments(line: GameLine) {
    return listInfrastructureSegments(line)
  }

  function segment(line: GameLine, fromStationId: string, toStationId: string) {
    return infrastructureSegmentState(line, fromStationId, toStationId)
  }

  function upgradeCost(
    line: GameLine,
    fromStationId: string,
    toStationId: string,
    key: GameInfrastructureUpgradeKey,
  ) {
    return calculateInfrastructureUpgradeCost(line, fromStationId, toStationId, key)
  }

  async function upgradeSegment(
    lineId: string,
    fromStationId: string,
    toStationId: string,
    key: GameInfrastructureUpgradeKey,
  ) {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    const current = infrastructureSegmentState(line, fromStationId, toStationId)
    if (!current) return false
    const currentLevel = key === 'capacity'
      ? current.capacityLevel
      : key === 'speed'
        ? current.speedLevel
        : current.reliabilityLevel
    if (currentLevel >= GAME_INFRASTRUCTURE_MAX_LEVEL) return false
    const cost = calculateInfrastructureUpgradeCost(line, fromStationId, toStationId, key)
    const definition = GAME_INFRASTRUCTURE_UPGRADES.find(item => item.key === key)
    const transaction = chargeInfrastructureUpgrade(
      save.data.economy,
      line,
      cost,
      `${definition?.label ?? key} · ${current.fromStationName} ↔ ${current.toStationName} · niveau ${currentLevel + 1}/${GAME_INFRASTRUCTURE_MAX_LEVEL}`,
    )
    if (!transaction) return false
    if (!applyInfrastructureLevel(line, fromStationId, toStationId, key)) return false
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  return {
    lines,
    upgrades: GAME_INFRASTRUCTURE_UPGRADES,
    maxLevel: GAME_INFRASTRUCTURE_MAX_LEVEL,
    profile,
    segments,
    segment,
    upgradeCost,
    upgradeSegment,
  }
}
