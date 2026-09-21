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
    const save = game.state.value.save

    if (!save) {
      return false
    }

    const line = save.data.network.lines.find(
      item => item.id === lineId,
    )

    const station = line ? findLineStation(line, stationId) : null

    if (!line || !station) {
      return false
    }

    const before = station.facilityLevel ?? 'STANDARD'
    const after = getNextStationFacilityLevel(before)

    if (!after) {
      return false
    }

    const cost = calculateStationUpgradeCost(
      line,
      after,
    )

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

    station.facilityLevel = after
    line.updatedAt = new Date().toISOString()

    await game.persistCurrentGame()

    return true
  }

  return {
    stationCount,
    definitionForLevel,
    facilityDefinition,
    interchangeLineCount,
    dailyCapacity,
    nextLevel,
    upgradeCost,
    upgradeStation,
  }
}
