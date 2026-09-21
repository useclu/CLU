import { computed } from 'vue'
import {
  GAME_INITIAL_BUDGET,
  GAME_MAX_BORROWS_PER_DAY,
  getModeEconomyDefinition,
} from '../config/economy'
import {
  borrowMoney,
  calculateCreditLimit,
  calculatePublicDevelopmentFunding,
  repayDebt,
} from '../engine/economy'
import type { GameTransportMode } from '../types/network'
import { GAME_ECONOMY_PROFILE_MULTIPLIERS } from '../config/freePlay'
import { useMetropoleGame } from './useMetropoleGame'
import { useGameNetwork } from './useGameNetwork'
import { useGameTerritory } from './useGameTerritory'

export function useGameEconomy() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }
  const network = useGameNetwork()
  const territory = useGameTerritory()
  const economy = computed(() => game.state.value.save?.data.economy ?? null)
  const currentDay = computed(() => game.state.value.save?.data.simulationDay ?? 1)
  const balance = computed(() => economy.value?.balance ?? GAME_INITIAL_BUDGET)
  const unlimitedMoney = computed(() => economy.value?.unlimitedMoney === true)
  const initialBudget = computed(() => economy.value?.initialBudget ?? GAME_INITIAL_BUDGET)
  const totalSpent = computed(() => economy.value?.totalSpent ?? 0)
  const totalInvestment = computed(() => economy.value?.totalInvestment ?? totalSpent.value)
  const totalRevenue = computed(() => economy.value?.totalRevenue ?? 0)
  const totalPassengerRevenue = computed(() => economy.value?.totalPassengerRevenue ?? 0)
  const totalFineRevenue = computed(() => economy.value?.totalFineRevenue ?? 0)
  const totalOperatingRevenue = computed(() => totalPassengerRevenue.value + totalFineRevenue.value)
  const totalOperatingCosts = computed(() => economy.value?.totalOperatingCosts ?? 0)
  const totalSubsidies = computed(() => economy.value?.totalSubsidies ?? 0)
  const totalPublicDevelopmentFunding = computed(() => economy.value?.totalPublicDevelopmentFunding ?? 0)
  const totalObjectiveRewards = computed(() => economy.value?.totalObjectiveRewards ?? 0)
  const publicFundingNextDay = computed(() => economy.value?.publicFundingNextDay ?? 7)
  const lastPublicFundingDay = computed(() => economy.value?.lastPublicFundingDay ?? 0)
  const lastPublicFundingAmount = computed(() => economy.value?.lastPublicFundingAmount ?? 0)
  const lastPublicFundingBreakdown = computed(() => economy.value?.lastPublicFundingBreakdown ?? null)
  const totalCompensationPaid = computed(() => economy.value?.totalCompensationPaid ?? 0)
  const debtPrincipal = computed(() => economy.value?.debtPrincipal ?? 0)
  const totalInterestPaid = computed(() => economy.value?.totalInterestPaid ?? 0)
  const debtNextPaymentDay = computed(() => economy.value?.debtNextPaymentDay ?? 0)
  const debtMinimumPayment = computed(() => economy.value?.debtMinimumPayment ?? 0)
  const debtPaidThisPeriod = computed(() => economy.value?.debtPaidThisPeriod ?? 0)
  const debtMissedPayments = computed(() => economy.value?.debtMissedPayments ?? 0)
  const totalDebtPenalties = computed(() => economy.value?.totalDebtPenalties ?? 0)
  const creditScore = computed(() => economy.value?.creditScore ?? 100)
  const insolvencyStatus = computed(() => economy.value?.insolvencyStatus ?? 'OK')
  const creditLimit = computed(() => {
    const profile = game.state.value.save?.data.freePlaySettings.economyProfile ?? 'STANDARD'
    return Math.round(
      calculateCreditLimit(
        network.lines.value.length,
        totalOperatingRevenue.value,
        totalInvestment.value,
        creditScore.value,
      ) * GAME_ECONOMY_PROFILE_MULTIPLIERS[profile].credit,
    )
  })
  const availableCredit = computed(() => Math.max(0, creditLimit.value - debtPrincipal.value))
  const operatingResult = computed(() => totalOperatingRevenue.value - totalOperatingCosts.value)
  const isInDebt = computed(() => balance.value < 0 || debtPrincipal.value > 0)
  const transactions = computed(() => economy.value?.transactions ?? [])
  const recentTransactions = computed(() => [...transactions.value].reverse().slice(0, 24))
  const borrowsToday = computed(() => economy.value?.lastBorrowDay === currentDay.value ? economy.value?.borrowCountOnLastDay ?? 0 : 0)
  const remainingBorrowsToday = computed(() => Math.max(0, GAME_MAX_BORROWS_PER_DAY - borrowsToday.value))
  const publicFundingPreview = computed(() => {
    const save = game.state.value.save
    if (!save) return { amount: 0, breakdown: null }
    const report = save.data.simulation.history.at(-1)
    return calculatePublicDevelopmentFunding({
      operationalLineCount: network.lines.value.filter(line => line.status === 'OPERATIONAL').length,
      municipalitiesServed: territory.summary.value.municipalitiesServed,
      dailyPassengers: report?.passengers ?? 0,
      serviceQualityScore: report?.serviceQualityScore ?? 70,
      dailyOperatingResult: report?.netResult ?? 0,
      debtPrincipal: debtPrincipal.value,
      creditLimit: creditLimit.value,
      profile: save.data.freePlaySettings.economyProfile,
    })
  })

  function modeCosts(mode: GameTransportMode) {
    return getModeEconomyDefinition(mode)
  }

  async function borrow(amount: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return { ok: false, code: 'INVALID_AMOUNT' as const, message: 'Aucune partie active.' }
    const creditMultiplier = GAME_ECONOMY_PROFILE_MULTIPLIERS[save.data.freePlaySettings.economyProfile].credit
    const result = borrowMoney(save.data.economy, amount, save.data.simulationDay, save.data.network.lines.length, creditMultiplier)
    if (result.ok) await game.persistCurrentGame()
    return result
  }

  async function repay(amount: number) {
    assertWritable()
    const save = game.state.value.save
    if (!save) return false
    const transaction = repayDebt(save.data.economy, amount)
    if (!transaction) return false
    await game.persistCurrentGame()
    return true
  }

  return {
    economy,
    currentDay,
    balance,
    unlimitedMoney,
    initialBudget,
    totalSpent,
    totalInvestment,
    totalRevenue,
    totalPassengerRevenue,
    totalFineRevenue,
    totalOperatingRevenue,
    totalOperatingCosts,
    totalSubsidies,
    totalPublicDevelopmentFunding,
    totalObjectiveRewards,
    publicFundingNextDay,
    lastPublicFundingDay,
    lastPublicFundingAmount,
    lastPublicFundingBreakdown,
    publicFundingPreview,
    totalCompensationPaid,
    debtPrincipal,
    totalInterestPaid,
    debtNextPaymentDay,
    debtMinimumPayment,
    debtPaidThisPeriod,
    debtMissedPayments,
    totalDebtPenalties,
    creditScore,
    insolvencyStatus,
    creditLimit,
    availableCredit,
    operatingResult,
    isInDebt,
    borrowsToday,
    remainingBorrowsToday,
    borrowLimitPerDay: GAME_MAX_BORROWS_PER_DAY,
    transactions,
    recentTransactions,
    modeCosts,
    borrow,
    repay,
  }
}
