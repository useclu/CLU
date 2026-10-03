import { useState } from '#app'
import {
  computed,
} from 'vue'

import {
  getNextStationFacilityLevel,
  getStationFacilityDefinition,
} from '../config/stations'

import {
  applyConstructionCost,
} from '../engine/economy'

import {
  calculateStationDailyCapacity,
  calculateStationUpgradeCost,
  countStationInterchangeLines,
} from '../engine/stations'
import { createStationUpgradeWork } from '../engine/operations'

import { findLineStation, getLineAllStations } from '../engine/network/geometry'

import type {
  GameLine,
  GameStation,
  GameStationFacilityLevel,
} from '../types/network'

import {
  useGameNetwork,
} from './useGameNetwork'

import {
  useMetropoleGame,
} from './useMetropoleGame'

export function useGameStations() {
  const game = useMetropoleGame()
  const upgradeLocks = useState<Record<string, boolean>>('clu-metropole-station-upgrade-locks', () => ({}))

  function upgradeKey(lineId: string, stationId: string) { return `${lineId}:${stationId}` }
  function isUpgradePending(lineId: string, stationId: string) { return Boolean(upgradeLocks.value[upgradeKey(lineId, stationId)]) }

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }
  const network = useGameNetwork()

  const stationCount = computed(
    () => network.lines.value.reduce(
      (total, line) => total + getLineAllStations(line).length,
      0,
    ),
  )

  function definitionForLevel(
    level: GameStationFacilityLevel,
  ) {
    return getStationFacilityDefinition(level)
  }

  function facilityDefinition(
    station: GameStation,
  ) {
    return getStationFacilityDefinition(
      station.facilityLevel ?? 'STANDARD',
    )
  }

  function interchangeLineCount(
    line: GameLine,
    station: GameStation,
  ) {
    const save = game.state.value.save

    if (!save) {
      return 0
    }

    return countStationInterchangeLines(
      save.data.network,
      line.id,
      station,
    )
  }

  function dailyCapacity(
    line: GameLine,
    station: GameStation,
  ) {
    return calculateStationDailyCapacity(
      line,
      station,
    )
  }

  function nextLevel(
    station: GameStation,
  ) {
    return getNextStationFacilityLevel(
      station.facilityLevel ?? 'STANDARD',
    )
  }

  function activeWork(lineId: string, stationId: string) {
    return game.state.value.save?.data.operations.stationWorks?.find(
      item => item.status === 'ACTIVE' && item.lineId === lineId && item.stationId === stationId,
    ) ?? null
  }

  function workDaysRemaining(lineId: string, stationId: string) {
    const work = activeWork(lineId, stationId)
    if (!work) return 0
    return Math.max(0, work.endDay - (game.state.value.save?.data.simulationDay ?? 1))
  }

  function upgradeCost(
    line: GameLine,
    station: GameStation,
  ) {
    const target = nextLevel(station)

    if (!target) {
      return 0
    }

    return calculateStationUpgradeCost(
      line,
      target,
    )
  }

  async function upgradeStation(
    lineId: string,
    stationId: string,
  ) {
    assertWritable()
    const key = upgradeKey(lineId, stationId)
    if (upgradeLocks.value[key]) return false
    upgradeLocks.value = { ...upgradeLocks.value, [key]: true }

    try {
      const save = game.state.value.save
      if (!save) return false

      const line = save.data.network.lines.find(item => item.id === lineId)
      const station = line ? findLineStation(line, stationId) : null
      if (!line || !station) return false

      if (activeWork(lineId, stationId)) return false
      const before = station.facilityLevel ?? 'STANDARD'
      const after = getNextStationFacilityLevel(before)
      if (!after) return false

      const cost = calculateStationUpgradeCost(line, after)
      const transaction = applyConstructionCost(
        save.data.economy,
        line,
        cost,
        'STATION_UPGRADE',
        {
          stationId: station.id,
          stationFacilityBefore: before,
          stationFacilityAfter: after,
        },
      )
      if (!transaction) return false

      const work = createStationUpgradeWork(
        save.data.operations,
        line,
        station,
        after,
        save.data.simulationDay,
        cost,
      )
      line.updatedAt = new Date().toISOString()
      await game.persistCurrentGame()
      return Boolean(work)
    }
    finally {
      const next = { ...upgradeLocks.value }
      delete next[key]
      upgradeLocks.value = next
    }
  }

  return {
    stationCount,
    definitionForLevel,
    facilityDefinition,
    interchangeLineCount,
    dailyCapacity,
    nextLevel,
    upgradeCost,
    activeWork,
    workDaysRemaining,
    isUpgradePending,
    upgradeStation,
  }
}
