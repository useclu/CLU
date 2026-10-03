import { useState } from '#app'
import {
  computed,
} from 'vue'

import {
  GAME_ROLLING_STOCK_UPGRADES,
  GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL,
  calculateDepotConstructionCost,
  calculateDepotExpansionCost,
  getRollingStockDefinition,
  getRollingStockModel,
  getRollingStockModels,
  normalizeRollingStockUpgrades,
} from '../config/rollingStock'

import {
  GAME_VEHICLE_SALE_VALUE_RATE,
  applyFleetUpgradeCost,
  applyNetworkInvestment,
  applyVehiclePurchaseCost,
  applyVehicleSale,
  canAffordInvestment,
} from '../engine/economy'

import { calculateTimetableStats } from '../engine/timetable'
import { calculateOperationsDayImpact } from '../engine/operations'

import {
  calculateDepotAccessMetrics,
  calculateDepotDistanceKm,
  calculateRequiredVehiclesForService,
  calculateReserveVehicles,
  calculateRollingStockUpgradeCost,
  calculateVehiclePurchaseCost,
  effectiveAverageSpeedKmH,
  effectiveVehicleCapacity,
  rollingStockPerformance,
} from '../engine/rollingStock'

import type {
  GameDepot,
  GameLine,
  GameRegulationMode,
  GameRollingStockUpgradeKey,
  GameRollingStockUpgrades,
  GameTransportMode,
} from '../types/network'

import {
  useMetropoleGame,
} from './useMetropoleGame'

import { registerVehiclePurchase, registerVehicleSale } from '../engine/statistics'

export function useGameRollingStock() {
  const game = useMetropoleGame()
  const upgradeLocks = useState<Record<string, boolean>>('clu-metropole-rolling-stock-upgrade-locks', () => ({}))

  function upgradeLockKey(lineId: string, key: GameRollingStockUpgradeKey) { return `${lineId}:${key}` }
  function isUpgradePending(lineId: string, key: GameRollingStockUpgradeKey) { return Boolean(upgradeLocks.value[upgradeLockKey(lineId, key)]) }

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  function createId(prefix: string) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }

  const depots = computed(() => game.state.value.save?.data.network.depots ?? [])

  const totalVehicles = computed(
    () => game.state.value.save?.data.network.lines.reduce(
      (total, line) => total + Math.max(0, line.vehicleCount ?? 0),
      0,
    ) ?? 0,
  )

  const totalDepotCapacity = computed(() => depots.value.reduce((total, depot) => total + depot.capacity, 0))
  const assignedDepotVehicles = computed(() => {
    const save = game.state.value.save
    if (!save) return 0
    const valid = new Set(depots.value.map(depot => depot.id))
    return save.data.network.lines.reduce((total, line) => total + (line.depotId && valid.has(line.depotId) ? Math.max(0, line.vehicleCount ?? 0) : 0), 0)
  })

  function definition(mode: GameTransportMode) {
    return getRollingStockDefinition(mode)
  }

  function model(line: GameLine) {
    return getRollingStockModel(line.rollingStockModelId, line.mode)
  }

  function modelsForMode(mode: GameTransportMode) {
    return getRollingStockModels(mode)
  }

  function depotForLine(line: GameLine) {
    return line.depotId ? depots.value.find(depot => depot.id === line.depotId) ?? null : null
  }

  function depotDistance(line: GameLine, depot: GameDepot) {
    return calculateDepotDistanceKm(line, depot)
  }

  function depotAccess(line: GameLine) {
    return calculateDepotAccessMetrics(line, { depots: depots.value })
  }

  function suggestedDepot(line: GameLine) {
    return depots.value
      .filter(depot => depot.mode === line.mode)
      .filter(depot => depotUsedCapacity(depot.id, line.id) + Math.max(0, Math.floor(line.vehicleCount ?? 0)) <= depot.capacity)
      .map(depot => ({ depot, distanceKm: depotDistance(line, depot) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null
  }

  function depotUsedCapacity(depotId: string, excludingLineId?: string) {
    const save = game.state.value.save
    if (!save) return 0
    return save.data.network.lines.reduce((total, line) => total + (line.depotId === depotId && line.id !== excludingLineId ? Math.max(0, Math.floor(line.vehicleCount ?? 0)) : 0), 0)
  }

  function depotRemainingCapacity(depotId: string, excludingLineId?: string) {
    const depot = depots.value.find(item => item.id === depotId)
    return depot ? Math.max(0, depot.capacity - depotUsedCapacity(depotId, excludingLineId)) : 0
  }

  function canFitFleetInDepot(line: GameLine, targetCount: number) {
    if (!line.depotId) return true
    const depot = depots.value.find(item => item.id === line.depotId)
    if (!depot || depot.mode !== line.mode) return false
    return depotUsedCapacity(depot.id, line.id) + Math.max(0, Math.floor(targetCount)) <= depot.capacity
  }

  function requiredVehicles(line: GameLine) {
    const save = game.state.value.save
    if (line.schedule?.mode === 'TIMETABLE' && save) {
      const timetable = calculateTimetableStats(line, save.data.simulationDay, save.data.calendarStartDate)
      if (timetable) {
        const operations = calculateOperationsDayImpact(line, save.data.simulationDay, save.data.calendarStartDate, save.data.operations)
        return Math.max(0, Math.ceil(timetable.requiredVehicleCount * Math.max(1, operations.serviceMultiplier)))
      }
    }
    const targetLevel = line.serviceProfileMode === 'ADVANCED'
      ? line.serviceProfile.peak
      : line.serviceLevel

    return calculateRequiredVehiclesForService(line, targetLevel)
  }

  function reserveVehicles(line: GameLine) {
    return Math.max(0, line.vehicleCount - requiredVehicles(line))
  }

  function purchaseCost(mode: GameTransportMode, count = 1, modelId?: string) {
    return calculateVehiclePurchaseCost(mode, count, modelId)
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
    if (!canFitFleetInDepot(line, Math.max(0, line.vehicleCount ?? 0) + normalizedCount)) return false
    const unitCost = model(line).purchaseCost
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

    const unitCost = model(line).purchaseCost
    if (target > current) {
      if (!canFitFleetInDepot(line, target)) return false
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

    const unitCost = model(line).purchaseCost
    applyVehicleSale(save.data.economy, line, normalizedCount, unitCost)
    line.vehicleCount = Math.max(0, Math.floor(line.vehicleCount ?? 0) - normalizedCount)
    registerVehicleSale(save, normalizedCount)
    line.manualBoostVehicles = Math.min(line.manualBoostVehicles ?? 0, reserveVehicles(line))
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function replaceModel(lineId: string, modelId: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    const currentModel = model(line)
    const nextModel = getRollingStockModel(modelId, line.mode)
    if (nextModel.id !== modelId) return false
    if (nextModel.id === currentModel.id) return true

    const count = Math.max(0, Math.floor(line.vehicleCount ?? 0))
    if (count > 0) {
      const resale = Math.round(count * currentModel.purchaseCost * GAME_VEHICLE_SALE_VALUE_RATE)
      const purchase = count * nextModel.purchaseCost
      if (!canAffordInvestment(save.data.economy, Math.max(0, purchase - resale))) return false
      applyVehicleSale(save.data.economy, line, count, currentModel.purchaseCost)
      const transaction = applyVehiclePurchaseCost(save.data.economy, line, count, nextModel.purchaseCost)
      if (!transaction) return false
      registerVehicleSale(save, count)
      registerVehiclePurchase(save, count)
      line.fleetCondition = 100
    }
    line.rollingStockModelId = nextModel.id
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function transferVehicles(fromLineId: string, toLineId: string, count: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || fromLineId === toLineId) return false
    const from = save.data.network.lines.find(line => line.id === fromLineId)
    const to = save.data.network.lines.find(line => line.id === toLineId)
    if (!from || !to || from.mode !== to.mode || model(from).id !== model(to).id) return false
    const amount = Math.min(Math.max(1, Math.floor(count)), Math.max(0, Math.floor(from.vehicleCount ?? 0)))
    if (amount <= 0 || !canFitFleetInDepot(to, Math.max(0, to.vehicleCount ?? 0) + amount)) return false
    from.vehicleCount = Math.max(0, Math.floor(from.vehicleCount ?? 0) - amount)
    to.vehicleCount = Math.max(0, Math.floor(to.vehicleCount ?? 0) + amount)
    from.manualBoostVehicles = Math.min(from.manualBoostVehicles ?? 0, reserveVehicles(from))
    to.manualBoostVehicles = Math.min(to.manualBoostVehicles ?? 0, reserveVehicles(to))
    const now = new Date().toISOString()
    from.updatedAt = now
    to.updatedAt = now
    await game.persistCurrentGame()
    return true
  }

  async function createDepot(input: { name: string; mode: GameTransportMode; longitude: number; latitude: number; capacity: number }) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(input.longitude) || !Number.isFinite(input.latitude)) return null
    const capacity = Math.min(500, Math.max(1, Math.floor(Number.isFinite(input.capacity) ? input.capacity : 1)))
    const cost = calculateDepotConstructionCost(input.mode, capacity)
    const transaction = applyNetworkInvestment(save.data.economy, cost, 'DEPOT_CONSTRUCTION', `Construction du dépôt ${input.name || input.mode} · ${capacity} places`)
    if (!transaction) return null
    const now = new Date().toISOString()
    const depot: GameDepot = {
      id: createId('depot'),
      name: input.name.trim().slice(0, 60) || `Dépôt ${input.mode}`,
      mode: input.mode,
      longitude: input.longitude,
      latitude: input.latitude,
      capacity,
      createdAt: now,
      updatedAt: now,
    }
    if (!save.data.network.depots) save.data.network.depots = []
    save.data.network.depots.push(depot)
    await game.persistCurrentGame()
    return depot
  }

  async function expandDepot(depotId: string, addedCapacity: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const depot = save.data.network.depots?.find(item => item.id === depotId)
    if (!depot) return false
    const added = Math.min(500 - depot.capacity, Math.max(1, Math.floor(addedCapacity)))
    if (added <= 0) return false
    const cost = calculateDepotExpansionCost(depot.mode, added)
    const transaction = applyNetworkInvestment(save.data.economy, cost, 'DEPOT_UPGRADE', `Extension du dépôt ${depot.name} · +${added} places`)
    if (!transaction) return false
    depot.capacity += added
    depot.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function assignLineToDepot(lineId: string, depotId?: string | null) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    if (!depotId) {
      line.depotId = undefined
      line.updatedAt = new Date().toISOString()
      await game.persistCurrentGame()
      return true
    }
    const depot = save.data.network.depots?.find(item => item.id === depotId)
    if (!depot || depot.mode !== line.mode) return false
    if (depotUsedCapacity(depot.id, line.id) + Math.max(0, line.vehicleCount ?? 0) > depot.capacity) return false
    line.depotId = depot.id
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function autoAssignNearestDepot(lineId: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return false
    const candidate = suggestedDepot(line)
    if (!candidate) return false
    if (line.depotId === candidate.depot.id) return true
    line.depotId = candidate.depot.id
    line.updatedAt = new Date().toISOString()
    await game.persistCurrentGame()
    return true
  }

  async function deleteDepot(depotId: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    if (save.data.network.lines.some(line => line.depotId === depotId)) return false
    const before = save.data.network.depots?.length ?? 0
    save.data.network.depots = (save.data.network.depots ?? []).filter(depot => depot.id !== depotId)
    if ((save.data.network.depots?.length ?? 0) === before) return false
    await game.persistCurrentGame()
    return true
  }

  function depotConstructionCost(mode: GameTransportMode, capacity: number) {
    return calculateDepotConstructionCost(mode, capacity)
  }

  function depotExpansionCost(mode: GameTransportMode, addedCapacity: number) {
    return calculateDepotExpansionCost(mode, addedCapacity)
  }

  async function upgrade(lineId: string, key: GameRollingStockUpgradeKey) {
    assertWritable()
    const lockKey = upgradeLockKey(lineId, key)
    if (upgradeLocks.value[lockKey]) return false
    upgradeLocks.value = { ...upgradeLocks.value, [lockKey]: true }

    try {
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
    finally {
      const next = { ...upgradeLocks.value }
      delete next[lockKey]
      upgradeLocks.value = next
    }
  }

  async function upgradeToLevels(
    lineId: string,
    targets: Partial<GameRollingStockUpgrades>,
  ): Promise<{ ok: true } | { ok: false; key?: GameRollingStockUpgradeKey }> {
    assertWritable()
    const save = game.state.value.save
    if (!save) return { ok: false }
    const line = save.data.network.lines.find(item => item.id === lineId)
    if (!line) return { ok: false }

    line.rollingStockUpgrades = normalizeRollingStockUpgrades(line.rollingStockUpgrades)
    const keys = GAME_ROLLING_STOCK_UPGRADES
      .map(item => item.key as GameRollingStockUpgradeKey)
      .filter(key => {
        const current = line.rollingStockUpgrades[key]
        const requested = Math.floor(Number(targets[key] ?? current))
        const target = Math.min(GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL, Math.max(current, requested))
        return target > current
      })

    if (!keys.length) return { ok: true }
    if (keys.some(key => upgradeLocks.value[upgradeLockKey(lineId, key)])) {
      return { ok: false, key: keys.find(key => upgradeLocks.value[upgradeLockKey(lineId, key)]) }
    }

    const locked = { ...upgradeLocks.value }
    for (const key of keys) locked[upgradeLockKey(lineId, key)] = true
    upgradeLocks.value = locked

    let changed = false
    let failedKey: GameRollingStockUpgradeKey | undefined
    try {
      // Important pour les grosses configurations de mise en service : on garde
      // exactement le coût et une transaction par niveau, mais SANS await entre
      // les niveaux. Vue ne peut donc pas relancer le rendu, la carte et les
      // computed lourds 10 à 15 fois pendant un simple passage en 3/3.
      for (const definition of GAME_ROLLING_STOCK_UPGRADES) {
        const key = definition.key as GameRollingStockUpgradeKey
        const current = line.rollingStockUpgrades[key]
        const requested = Math.floor(Number(targets[key] ?? current))
        const target = Math.min(GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL, Math.max(current, requested))

        while (line.rollingStockUpgrades[key] < target) {
          const level = line.rollingStockUpgrades[key]
          const cost = upgradeCost(line, key)
          const transaction = applyFleetUpgradeCost(
            save.data.economy,
            line,
            cost,
            `${definition.label ?? key} ${level + 1}/${GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL}`,
          )
          if (!transaction) {
            failedKey = key
            break
          }
          line.rollingStockUpgrades[key] = level + 1
          changed = true
        }
        if (failedKey) break
      }

      if (changed) {
        line.updatedAt = new Date().toISOString()
        await game.persistCurrentGame()
      }
      return failedKey ? { ok: false, key: failedKey } : { ok: true }
    }
    finally {
      const next = { ...upgradeLocks.value }
      for (const key of keys) delete next[upgradeLockKey(lineId, key)]
      upgradeLocks.value = next
    }
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
    depots,
    totalDepotCapacity,
    assignedDepotVehicles,
    upgradeDefinitions: GAME_ROLLING_STOCK_UPGRADES,
    maxUpgradeLevel: GAME_ROLLING_STOCK_UPGRADE_MAX_LEVEL,
    definition,
    model,
    modelsForMode,
    depotForLine,
    depotDistance,
    depotAccess,
    suggestedDepot,
    depotUsedCapacity,
    depotRemainingCapacity,
    depotConstructionCost,
    depotExpansionCost,
    requiredVehicles,
    reserveVehicles,
    purchaseCost,
    performance,
    effectiveCapacity,
    effectiveSpeed,
    upgradeLevel,
    upgradeCost,
    isUpgradePending,
    purchaseForLine,
    removeFromLine,
    setFleetSize,
    purchaseMissingForService,
    replaceModel,
    transferVehicles,
    createDepot,
    expandDepot,
    assignLineToDepot,
    autoAssignNearestDepot,
    deleteDepot,
    upgrade,
    upgradeToLevels,
    setRegulationMode,
    setManualBoost,
  }
}
