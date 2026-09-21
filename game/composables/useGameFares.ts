import { computed } from 'vue'

import {
  GAME_DEFAULT_CUSTOM_FARE_POLICY,
  GAME_FARE_LEVELS,
  GAME_MAX_DAY_PASS_PRICE,
  GAME_MAX_MONTH_PASS_PRICE,
  GAME_MAX_WEEK_PASS_PRICE,
  GAME_MAX_TICKET_PRICE,
  GAME_MAX_YEAR_PASS_PRICE,
  GAME_MIN_SUBSCRIPTION_PRICE,
  GAME_MIN_TICKET_PRICE,
  calculateCustomFare,
  clampFareAmount,
  getFareLevelDefinition,
} from '../config/fares'

import type {
  GameFareLevel,
  GameFareManagementMode,
  GameSubscriptionPricing,
} from '../types/fares'

import type { GameTransportMode } from '../types/network'
import { useMetropoleGame } from './useMetropoleGame'

export function useGameFares() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }

  const level = computed<GameFareLevel>(
    () => game.state.value.save?.data.economy.fareLevel ?? 'STANDARD',
  )

  const managementMode = computed<GameFareManagementMode>(
    () => game.state.value.save?.data.economy.fareManagementMode ?? 'GUIDED',
  )

  const customPolicy = computed(
    () => game.state.value.save?.data.economy.customFarePolicy
      ?? GAME_DEFAULT_CUSTOM_FARE_POLICY,
  )

  const definition = computed(() => getFareLevelDefinition(level.value))

  async function persist() {
    await game.persistCurrentGame()
    return true
  }

  async function setManagementMode(nextMode: GameFareManagementMode) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    save.data.economy.fareManagementMode = nextMode === 'CUSTOM'
      ? 'BY_MODE'
      : nextMode
    return await persist()
  }

  async function setLevel(nextLevel: GameFareLevel) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    save.data.economy.fareLevel = nextLevel
    save.data.economy.fareManagementMode = 'GUIDED'
    return await persist()
  }

  async function setUnifiedTicketPrice(price: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(price)) return false
    save.data.economy.customFarePolicy.unifiedTicketPrice = clampFareAmount(
      price,
      GAME_MIN_TICKET_PRICE,
      GAME_MAX_TICKET_PRICE,
    )
    save.data.economy.fareManagementMode = 'UNIFIED'
    return await persist()
  }

  async function setTicketPrice(mode: GameTransportMode, price: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(price)) return false
    save.data.economy.customFarePolicy.ticketPrices[mode] = clampFareAmount(
      price,
      GAME_MIN_TICKET_PRICE,
      GAME_MAX_TICKET_PRICE,
    )
    save.data.economy.fareManagementMode = 'BY_MODE'
    return await persist()
  }

  async function setLineTicketPrice(lineId: string, price: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(price)) return false
    save.data.economy.customFarePolicy.lineTicketPrices[lineId] = clampFareAmount(
      price,
      GAME_MIN_TICKET_PRICE,
      GAME_MAX_TICKET_PRICE,
    )
    return await persist()
  }

  async function clearLineTicketPrice(lineId: string) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    delete save.data.economy.customFarePolicy.lineTicketPrices[lineId]
    return await persist()
  }

  async function setWeekdayMultiplier(weekday: number, multiplier: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(multiplier)) return false
    const index = Math.min(6, Math.max(0, Math.floor(weekday)))
    save.data.economy.customFarePolicy.weekdayMultipliers[String(index)] =
      Math.min(2, Math.max(0, Math.round(multiplier * 100) / 100))
    if (save.data.economy.fareManagementMode === 'GUIDED') {
      save.data.economy.fareManagementMode = 'UNIFIED'
    }
    return await persist()
  }

  async function setDiscount(
    kind: 'student' | 'reduced' | 'weekend',
    enabled: boolean,
    rate?: number,
  ) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const discounts = save.data.economy.customFarePolicy.discounts
    const normalizedRate = Number.isFinite(rate)
      ? Math.min(1, Math.max(0, Number(rate)))
      : undefined

    if (kind === 'student') {
      discounts.studentEnabled = enabled
      if (normalizedRate !== undefined) discounts.studentDiscountRate = normalizedRate
    }
    else if (kind === 'reduced') {
      discounts.reducedEnabled = enabled
      if (normalizedRate !== undefined) discounts.reducedDiscountRate = normalizedRate
    }
    else {
      discounts.weekendDiscountEnabled = enabled
      if (normalizedRate !== undefined) discounts.weekendDiscountRate = normalizedRate
    }
    return await persist()
  }

  async function setCompensation(
    enabled: boolean,
    refundRate?: number,
    threshold?: number,
  ) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const settings = save.data.economy.customFarePolicy.compensation
    settings.enabled = enabled
    if (Number.isFinite(refundRate)) {
      settings.defaultRefundRate = Math.min(1, Math.max(0, Number(refundRate)))
    }
    if (Number.isFinite(threshold)) {
      settings.disruptionQualityThreshold = Math.min(100, Math.max(0, Number(threshold)))
    }
    return await persist()
  }

  async function setSubscriptionEnabled(
    kind: keyof GameSubscriptionPricing,
    enabled: boolean,
  ) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    save.data.economy.customFarePolicy.subscriptions[kind].enabled = enabled
    return await persist()
  }

  async function setSubscriptionPrice(
    kind: keyof GameSubscriptionPricing,
    price: number,
  ) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(price)) return false
    const max = kind === 'day'
      ? GAME_MAX_DAY_PASS_PRICE
      : kind === 'week'
        ? GAME_MAX_WEEK_PASS_PRICE
        : kind === 'month'
        ? GAME_MAX_MONTH_PASS_PRICE
        : GAME_MAX_YEAR_PASS_PRICE
    save.data.economy.customFarePolicy.subscriptions[kind].price = clampFareAmount(
      price,
      GAME_MIN_SUBSCRIPTION_PRICE,
      max,
    )
    return await persist()
  }

  async function setOutsideTerritoryTicketEnabled(enabled: boolean) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    save.data.economy.customFarePolicy.outsideTerritoryTicketEnabled = enabled
    return await persist()
  }

  async function setOutsideTerritoryTicketPrice(price: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save || !Number.isFinite(price)) return false
    save.data.economy.customFarePolicy.outsideTerritoryTicketPrice = clampFareAmount(
      price,
      GAME_MIN_TICKET_PRICE,
      GAME_MAX_TICKET_PRICE,
    )
    return await persist()
  }

  function customComputation(
    mode: GameTransportMode,
    outsideTerritoryShare = 0,
    lineId?: string,
    weekdayIndex = 1,
  ) {
    return calculateCustomFare(mode, customPolicy.value, {
      outsideTerritoryShare,
      lineId,
      weekdayIndex,
      managementMode: managementMode.value,
    })
  }

  return {
    levels: GAME_FARE_LEVELS,
    level,
    managementMode,
    customPolicy,
    definition,
    setManagementMode,
    setLevel,
    setUnifiedTicketPrice,
    setTicketPrice,
    setLineTicketPrice,
    clearLineTicketPrice,
    setWeekdayMultiplier,
    setDiscount,
    setCompensation,
    setSubscriptionEnabled,
    setSubscriptionPrice,
    setOutsideTerritoryTicketEnabled,
    setOutsideTerritoryTicketPrice,
    customComputation,
  }
}
