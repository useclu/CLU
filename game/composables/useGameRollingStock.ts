import {
  computed,
} from 'vue'

import {
  GAME_ROLLING_STOCK_UPGRADES,
  GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL,
  getRollingStockDefinition,
  normalizeRollingStockUpgrades,
} from '../config/rollingStock'

import {
  applyFleetUpgradeCost,
  applyVehiclePurchaseCost,
  applyVehicleSale,
} from '../engine/economy'

import {
  calculateRequiredVehiclesForService,
  calculateReserveVehicles,
  calculateRollingStockUpgradeCost,
  calculateVehiclePurchaseCost,
  effectiveAverageSpeedKmH,
  effectiveVehicleCapacity,
  rollingStockPerformance,
} from '../engine/rollingStock'

import type {
  GameLine,
  GameRegulationMode,
  GameRollingStockUpgradeKey,
  GameTransportMode,
} from '../types/network'

import {
  useMetropoleGame,
} from './useMetropoleGame'

import { registerVehiclePurchase, registerVehicleSale } from '../engine/statistics'

export function useGameRollingStock() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  const totalVehicles = computed(
    () => game.state.value.save?.data.network.lines.reduce(
      (total, line) => total + Math.max(0, line.vehicleCount ?? 0),
      0,
    ) ?? 0,
  )

  function definition(mode: GameTransportMode) {
    return getRollingStockDefinition(mode)
  }

  function requiredVehicles(line: GameLine) {
    const targetLevel = line.serviceProfileMode === 'ADVANCED'
      ? line.serviceProfile.peak
      : line.serviceLevel

    return calculateRequiredVehiclesForService(line, targetLevel)
  }

  function reserveVehicles(line: GameLine) {
    return Math.max(0, line.vehicleCount - requiredVehicles(line))
  }

  function purchaseCost(mode: GameTransportMode, count = 1) {
    return calculateVehiclePurchaseCost(mode, count)
  }

  function performance(line: GameLine) {
    return rollingStockPerformance(line)
  }

  function effectiveCapacity(line: GameLine) {
    return effectiveVehicleCapacity(line)
  }

  function effectiveSpeed(line: GameLine) {
    return effectiveAverageSpeedKmH(line)
  }

  function upgradeLevel(line: GameLine, key: GameRollingStockUpgradeKey) {
    return normalizeRollingStockUpgrades(line.rollingStockUpgrades)[key]
  }

  function upgradeCost(line: GameLine, key: GameRollingStockUpgradeKey) {
    return calculateRollingStockUpgradeCost(line, key)
  }

  async function purchaseForLine(lineId: string, count = 1) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false

    const normalizedCount = Math.max(1, Math.floor(count))
    const unitCost = definition(line.mode).purchaseCost
    const transaction = applyVehiclePurchaseCost(save.data.economy, line, normalizedCount, unitCost)
    if (!transaction) return false

    line.vehicleCount = Math.max(0, Math.floor(line.vehicleCount ?? 0)) + normalizedCount
    registerVehiclePurchase(save, normalizedCount)
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }


  async function setFleetSize(lineId: string, targetCount: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false

    const current = Math.max(0, Math.floor(line.vehicleCount ?? 0))
    const target = Math.max(0, Math.floor(Number.isFinite(targetCount) ? targetCount : current))
    if (target === current) return true

    const unitCost = definition(line.mode).purchaseCost
    if (target > current) {
      const count = target - current
      const transaction = applyVehiclePurchaseCost(save.data.economy, line, count, unitCost)
      if (!transaction) return false
      line.vehicleCount = target
      registerVehiclePurchase(save, count)
    }
    else {
      const count = current - target
      applyVehicleSale(save.data.economy, line, count, unitCost)
      line.vehicleCount = target
      registerVehicleSale(save, count)
      line.manualBoostVehicles = Math.min(line.manualBoostVehicles ?? 0, reserveVehicles(line))
    }

    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function purchaseMissingForService(lineId: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    const missing = Math.max(0, requiredVehicles(line) - Math.max(0, line.vehicleCount ?? 0))
    if (missing <= 0) return false
    return await purchaseForLine(lineId, missing)
  }

  async function removeFromLine(lineId: string, count = 1) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false

    const normalizedCount = Math.min(
      Math.max(1, Math.floor(count)),
      Math.max(0, Math.floor(line.vehicleCount ?? 0)),
    )
    if (normalizedCount <= 0) return false

    const unitCost = definition(line.mode).purchaseCost
    applyVehicleSale(save.data.economy, line, normalizedCount, unitCost)
    line.vehicleCount = Math.max(0, Math.floor(line.vehicleCount ?? 0) - normalizedCount)
    registerVehicleSale(save, normalizedCount)
    line.manualBoostVehicles = Math.min(line.manualBoostVehicles ?? 0, reserveVehicles(line))
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function upgrade(lineId: string, key: GameRollingStockUpgradeKey) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false

    line.rollingStockUpgrades = normalizeRollingStockUpgrades(line.rollingStockUpgrades)
    const current = line.rollingStockUpgrades[key]
    if (current >= GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL) return false
    const cost = upgradeCost(line, key)
    const definition = GAME_ROLLING_STOCK_UPGRADES.find(item => item.key === key)
    const transaction = applyFleetUpgradeCost(
      save.data.economy,
      line,
      cost,
      `${definition?.label ?? key} ${current + 1}/${GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL}`,
    )
    if (!transaction) return false

    line.rollingStockUpgrades[key] = current + 1
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setRegulationMode(lineId: string, mode: GameRegulationMode) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    line.regulationMode = mode
    if (mode === 'AUTO') line.manualBoostVehicles = 0
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function setManualBoost(lineId: string, count: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    line.regulationMode = 'MANUAL'
    line.manualBoostVehicles = Math.min(
      reserveVehicles(line),
      Math.max(0, Math.floor(count)),
    )
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  return {
    totalVehicles,
    upgradeDefinitions: GAME_ROLLING_STOCK_UPGRADES,
    maxUpgradeLevel: GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL,
    definition,
    requiredVehicles,
    reserveVehicles,
    purchaseCost,
    performance,
    effectiveCapacity,
    effectiveSpeed,
    upgradeLevel,
    upgradeCost,
    purchaseForLine,
    removeFromLine,
    setFleetSize,
    purchaseMissingForService,
    upgrade,
    setRegulationMode,
    setManualBoost,
  }
}
