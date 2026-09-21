import { computed } from 'vue'
import { useMetropoleGame } from './useMetropoleGame'
import {
  buildWeeklySnapshot,
  countUniqueNetworkStations,
  economyTotalsFromSave,
  networkLengthKm,
  totalVehicleCount,
} from '../engine/statistics'
import type { GameStatisticsEconomyTotals, GameWeeklySnapshot } from '../types/statistics'

function economyDelta(current: GameStatisticsEconomyTotals | null, previous: GameStatisticsEconomyTotals | null) {
  if (!current || !previous) return null
  return {
    investment: Math.max(0, current.investment - previous.investment),
    passengerRevenue: Math.max(0, current.passengerRevenue - previous.passengerRevenue),
    fineRevenue: Math.max(0, current.fineRevenue - previous.fineRevenue),
    operatingCosts: Math.max(0, current.operatingCosts - previous.operatingCosts),
    subsidies: Math.max(0, current.subsidies - previous.subsidies),
    publicDevelopmentFunding: Math.max(0, current.publicDevelopmentFunding - previous.publicDevelopmentFunding),
    objectiveRewards: Math.max(0, current.objectiveRewards - previous.objectiveRewards),
    interestPaid: Math.max(0, current.interestPaid - previous.interestPaid),
    debtPenalties: Math.max(0, current.debtPenalties - previous.debtPenalties),
    compensationPaid: Math.max(0, current.compensationPaid - previous.compensationPaid),
  }
}

export function useGameStatistics() {
  const game = useMetropoleGame()
  const save = computed(() => game.state.value.save)
  const state = computed(() => save.value?.data.statistics ?? null)
  const day = computed(() => Math.max(1, Math.floor(save.value?.data.simulationDay ?? 1)))
  const currentWeekNumber = computed(() => Math.max(1, Math.ceil(day.value / 7)))

  const currentWeek = computed<GameWeeklySnapshot | null>(() => {
    if (!save.value) return null
    return buildWeeklySnapshot(save.value, currentWeekNumber.value, day.value % 7 === 0)
  })

  const weeks = computed<GameWeeklySnapshot[]>(() => {
    const stored = [...(state.value?.weeks ?? [])]
    const current = currentWeek.value
    if (!current) return stored.sort((a, b) => a.week - b.week)
    const index = stored.findIndex(item => item.week === current.week)
    if (index >= 0) stored.splice(index, 1, current)
    else stored.push(current)
    return stored.sort((a, b) => a.week - b.week)
  })

  const currentNetwork = computed(() => {
    if (!save.value) return { lineCount: 0, operationalLineCount: 0, constructionLineCount: 0, stationCount: 0, vehicleCount: 0, networkLengthKm: 0 }
    const lines = save.value.data.network.lines
    return {
      lineCount: lines.length,
      operationalLineCount: lines.filter(line => line.status === 'OPERATIONAL').length,
      constructionLineCount: lines.filter(line => line.status === 'CONSTRUCTION').length,
      stationCount: countUniqueNetworkStations(save.value),
      vehicleCount: totalVehicleCount(save.value),
      networkLengthKm: networkLengthKm(save.value),
    }
  })

  const totals = computed(() => {
    const current = save.value
    const stats = state.value
    if (!current || !stats) return null
    const economy = current.data.economy
    const simulation = current.data.simulation
    const currentEconomy = economyTotalsFromSave(current)
    return {
      passengers: Math.max(0, simulation.totalPassengers),
      lostPassengers: Math.max(0, simulation.totalLostPassengers),
      operatingRevenue: Math.max(0, economy.totalRevenue),
      passengerRevenue: currentEconomy.passengerRevenue,
      fineRevenue: currentEconomy.fineRevenue,
      investment: currentEconomy.investment,
      operatingCosts: currentEconomy.operatingCosts,
      interestPaid: currentEconomy.interestPaid,
      debtPenalties: currentEconomy.debtPenalties,
      subsidies: currentEconomy.subsidies,
      publicFunding: currentEconomy.publicDevelopmentFunding,
      objectiveRewards: currentEconomy.objectiveRewards,
      totalOutflow: currentEconomy.investment + currentEconomy.operatingCosts + currentEconomy.interestPaid + currentEconomy.debtPenalties,
      totalSupport: currentEconomy.subsidies + currentEconomy.publicDevelopmentFunding + currentEconomy.objectiveRewards,
      balance: economy.balance,
      debt: economy.debtPrincipal,
      linesLaunched: stats.linesLaunched,
      linesDeleted: stats.linesDeleted,
      stationsBuilt: stats.stationsBuilt,
      stationsRemoved: stats.stationsRemoved,
      vehiclesPurchased: stats.vehiclesPurchased,
      vehiclesSold: stats.vehiclesSold,
      objectivesCompleted: current.data.objectives.totalCompleted ?? current.data.objectives.completed.length,
      municipalityFunding: current.data.municipalities.totalSubsidiesReceived,
      eventsResolved: current.data.events.totalResolved,
    }
  })

  function economyFlowFor(snapshot: GameWeeklySnapshot) {
    if (!state.value || !snapshot.economyTotals) return null
    const previousExact = [...weeks.value]
      .filter(item => item.week < snapshot.week && item.economyTotals)
      .sort((a, b) => b.week - a.week)[0]
    const baseline = previousExact?.economyTotals
      ?? (snapshot.startDay <= state.value.trackingStartedDay + 6 ? state.value.baselineEconomyTotals : null)
    return economyDelta(snapshot.economyTotals, baseline)
  }

  const milestones = computed(() => [...(state.value?.milestones ?? [])].sort((a, b) => b.day - a.day))

  return {
    save,
    state,
    day,
    currentWeekNumber,
    currentWeek,
    weeks,
    currentNetwork,
    totals,
    milestones,
    economyFlowFor,
  }
}
