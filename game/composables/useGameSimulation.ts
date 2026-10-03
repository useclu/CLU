import { computed } from 'vue'
import { useState } from '#app'

import {
  applySimulationDay,
  simulateNetworkDay,
} from '../engine/simulation'
import { applyDailyFleetMaintenance } from '../engine/maintenance'
import { processNetworkConstructionDay, isOperationalLine } from '../engine/network'
import { absoluteGameMinute, closeExpiredSubstitutions, processNaturalOperationsDay, processStationWorksDay } from '../engine/operations'
import { applyDailyDebtInterest, calculateCreditLimit, processDebtDay, processPublicDevelopmentFunding } from '../engine/economy'
import { gameCalendarHeaderLabel, gameDayLabel, isoDateForGameDay } from '../config/calendar'
import { GAME_ECONOMY_PROFILE_MULTIPLIERS } from '../config/freePlay'
import type { GameSimulationDayReport } from '../types/simulation'
import { captureStatisticsForDay, registerObjectiveMilestone } from '../engine/statistics'
import { simulatePassengerJourneys } from '../engine/passengers'
import { infrastructureSegmentState } from '../engine/infrastructure'

import { useGameEvents } from './useGameEvents'
import { useGameMunicipalities } from './useGameMunicipalities'
import { useGameNetwork } from './useGameNetwork'
import { useGameObjectives } from './useGameObjectives'
import { useGameTerritory } from './useGameTerritory'
import { useMetropoleGame } from './useMetropoleGame'


async function yieldSimulationFrame() {
  // Phase 21 : une journée peut cumuler monde vivant + réseau + Voyageurs 2.0.
  // On rend brièvement la main au navigateur entre les gros blocs afin que les
  // clics, panneaux et indicateurs de chargement ne semblent plus figés.
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    return
  }
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

function applyFreePlayEconomyProfile(report: GameSimulationDayReport, profile: 'GENEROUS' | 'STANDARD' | 'HARD') {
  const definition = GAME_ECONOMY_PROFILE_MULTIPLIERS[profile]
  if (!definition || (definition.revenue === 1 && definition.operatingCost === 1)) return report

  for (const line of report.lines) {
    line.revenue = Math.round(line.revenue * definition.revenue)
    line.operatingCost = Math.round(line.operatingCost * definition.operatingCost)
    line.netResult = line.revenue - line.operatingCost
    if (Number.isFinite(line.fareRevenueBeforeFraud)) line.fareRevenueBeforeFraud = Math.round((line.fareRevenueBeforeFraud ?? 0) * definition.revenue)
    if (Number.isFinite(line.passengerRevenueAfterFraud)) line.passengerRevenueAfterFraud = Math.round((line.passengerRevenueAfterFraud ?? 0) * definition.revenue)
    if (Number.isFinite(line.fineRevenue)) line.fineRevenue = Math.round((line.fineRevenue ?? 0) * definition.revenue)
    if (Number.isFinite(line.fraudRevenueLoss)) line.fraudRevenueLoss = Math.round((line.fraudRevenueLoss ?? 0) * definition.revenue)
    if (Number.isFinite(line.controlCost)) line.controlCost = Math.round((line.controlCost ?? 0) * definition.operatingCost)
    if (Number.isFinite(line.passengerCompensation)) line.passengerCompensation = Math.round((line.passengerCompensation ?? 0) * definition.operatingCost)
  }

  report.revenue = report.lines.reduce((total, line) => total + line.revenue, 0)
  report.operatingCost = report.lines.reduce((total, line) => total + line.operatingCost, 0)
  report.netResult = report.revenue - report.operatingCost
  report.fareRevenueBeforeFraud = report.lines.reduce((total, line) => total + (line.fareRevenueBeforeFraud ?? 0), 0)
  report.passengerRevenueAfterFraud = report.lines.reduce((total, line) => total + (line.passengerRevenueAfterFraud ?? 0), 0)
  report.fineRevenue = report.lines.reduce((total, line) => total + (line.fineRevenue ?? 0), 0)
  report.fraudRevenueLoss = report.lines.reduce((total, line) => total + (line.fraudRevenueLoss ?? 0), 0)
  report.controlCost = report.lines.reduce((total, line) => total + (line.controlCost ?? 0), 0)
  report.passengerCompensation = report.lines.reduce((total, line) => total + (line.passengerCompensation ?? 0), 0)
  return report
}

function createGameSimulation() {
  const game = useMetropoleGame()

  function assertWritable() {
    if (game.isReadOnly.value) throw new Error('Ce défi est terminé : la partie est en lecture seule.')
  }
  const events = useGameEvents()
  const network = useGameNetwork()
  const objectives = useGameObjectives()
  const territory = useGameTerritory()
  const municipalities = useGameMunicipalities()

  const isAdvancing = useState<boolean>('clu-metropole-simulation-advancing', () => false)
  const simulation = computed(() => game.state.value.save?.data.simulation ?? null)
  const day = computed(() => Math.max(1, game.state.value.save?.data.simulationDay ?? 1))
  const currentDate = computed(() => {
    const save = game.state.value.save
    return save
      ? isoDateForGameDay(day.value, save.data.calendarStartDate)
      : '2026-01-05'
  })
  const currentCalendarLabel = computed(() => {
    const save = game.state.value.save
    return save ? gameCalendarHeaderLabel(day.value, save.data.calendarStartDate) : `Jour ${day.value}`
  })
  const currentDayLabel = computed(() => {
    const save = game.state.value.save
    return save
      ? gameDayLabel(day.value, save.data.calendarStartDate)
      : `Jour ${day.value}`
  })

  const history = computed(() => simulation.value?.history ?? [])
  const lastDayReport = computed(() => history.value[history.value.length - 1] ?? null)
  // Phase 24 : les panneaux peuvent demander plusieurs dizaines de fois le même
  // rapport sur un réseau de plusieurs centaines de lignes. On indexe une fois
  // par changement de rapport au lieu de refaire Array.find() pour chaque KPI.
  const lineReportsById = computed(() => new Map(
    (lastDayReport.value?.lines ?? []).map(line => [line.lineId, line] as const),
  ))
  const stationReportsById = computed(() => {
    const result = new Map<string, NonNullable<GameSimulationDayReport['lines'][number]['stations']>[number]>()
    for (const line of lastDayReport.value?.lines ?? []) {
      for (const station of line.stations ?? []) result.set(`${line.lineId}::${station.stationId}`, station)
    }
    return result
  })
  const totalPassengers = computed(() => simulation.value?.totalPassengers ?? 0)
  const totalLostPassengers = computed(() => simulation.value?.totalLostPassengers ?? 0)
  const totalRevenue = computed(() => simulation.value?.totalRevenue ?? 0)
  const totalOperatingCost = computed(() => simulation.value?.totalOperatingCost ?? 0)
  const totalFraudRevenueLoss = computed(() => simulation.value?.totalFraudRevenueLoss ?? 0)
  const totalFineRevenue = computed(() => simulation.value?.totalFineRevenue ?? 0)
  const totalControlCost = computed(() => simulation.value?.totalControlCost ?? 0)
  const serviceQualityScore = computed(() => lastDayReport.value?.serviceQualityScore ?? null)
  const networkMoraleScore = computed(() => lastDayReport.value?.networkMoraleScore ?? 76)
  const serviceQualityDemandMultiplier = computed(() => lastDayReport.value?.serviceQualityDemandMultiplier ?? 1)
  const demandSatisfactionRate = computed(() => lastDayReport.value?.demandSatisfactionRate ?? 1)
  const averageWaitMinutes = computed(() => lastDayReport.value?.averageWaitMinutes ?? 0)
  const criticalLineCount = computed(() => lastDayReport.value?.criticalLineCount ?? 0)

  const operationalLineCount = computed(
    () => network.lines.value.filter(isOperationalLine).length,
  )
  const constructionLineCount = computed(
    () => network.lines.value.filter(line => line.status === 'CONSTRUCTION').length,
  )

  function reportForLine(lineId: string) {
    return lineReportsById.value.get(lineId) ?? null
  }

  function stationReport(lineId: string, stationId: string) {
    return stationReportsById.value.get(`${lineId}::${stationId}`) ?? null
  }

  async function advanceDay() {
    assertWritable()
    if (isAdvancing.value) return null
    const save = game.state.value.save
    if (!save || network.isBuilding.value || network.isEditing.value || (!save.data.economy.unlimitedMoney && save.data.economy.balance < 0) || save.data.economy.insolvencyStatus === 'BANKRUPT') return null
    if (save.data.challenge?.status === 'ACTIVE' && new Date(save.data.challenge.endsAt).getTime() <= Date.now()) {
      await game.finishCurrentChallenge('TIME_LIMIT')
      return null
    }

    isAdvancing.value = true
    try {
      await territory.ensureLoaded()
      if (save.data.challenge?.status === 'ACTIVE' && new Date(save.data.challenge.endsAt).getTime() <= Date.now()) {
        await game.finishCurrentChallenge('TIME_LIMIT')
        return null
      }

      const nextDay = Math.max(1, Math.floor(save.data.simulationDay || 1)) + 1

      /** Les travaux progressent au début de la journée. */
      processNetworkConstructionDay(save.data.network)
      // Phase 17 : une extension de station n'est plus instantanée. La capacité
      // devient disponible uniquement à la fin du chantier.
      processStationWorksDay(save.data.operations, save.data.network, nextDay)
      // Phase 19 : les substitutions expirées sont nettoyées et le monde peut
      // générer un incident rare avant la simulation afin que son impact soit réel.
      closeExpiredSubstitutions(save.data.operations, absoluteGameMinute(nextDay, 0))
      processNaturalOperationsDay(save.data.operations, save.data.network, nextDay)

      // Métropole 2.0 : les ouvertures de quartiers et événements locaux sont
      // résolus AVANT la simulation du jour afin que leur demande soit visible
      // immédiatement, sans décalage d'une journée.
      municipalities.processWorldLife(nextDay)
      await yieldSimulationFrame()

      const report = simulateNetworkDay(
        save.data.network,
        nextDay,
        network.activeLineId.value,
        territory.municipalities.value,
        territory.isLoaded.value,
        events.modifiersForDay(nextDay),
        save.data.economy.fareLevel,
        save.data.economy.fareManagementMode,
        save.data.economy.customFarePolicy,
        save.data.simulation,
        save.data.calendarStartDate,
        save.data.operations,
      )

      applyFreePlayEconomyProfile(report, save.data.freePlaySettings.economyProfile)
      await yieldSimulationFrame()

      // V49 : la couche OD s'appuie sur les circulations déjà calculées par V46/V47
      // sans remplacer les agrégats économiques historiques de la simulation.
      const passengersV2 = simulatePassengerJourneys(
        save.data.passengers,
        save.data.network,
        report.lines,
        nextDay,
        save.data.calendarStartDate,
        save.data.operations,
      )
      report.passengersV2 = passengersV2
      const passengerLoads = new Map(passengersV2.lineLoads.map(load => [load.lineId, load] as const))
      for (const lineReport of report.lines) {
        const load = passengerLoads.get(lineReport.lineId)
        if (!load) continue
        lineReport.networkRoutedPassengers = load.transportedBoardings
        lineReport.networkTransferBoardings = load.transferBoardings
        lineReport.networkLeftBehindPassengers = load.leftBehindPassengers
        lineReport.networkLoadRate = load.loadRate
      }

      const sourceLineById = new Map(save.data.network.lines.map(line => [line.id, line] as const))
      const stationFlows = new Map((passengersV2.stationFlows ?? []).map(flow => [`${flow.lineId}::${flow.stationId}`, flow] as const))
      const segmentFlowsByLine = new Map<string, typeof passengersV2.segmentFlows>()
      for (const flow of passengersV2.segmentFlows ?? []) {
        const bucket = segmentFlowsByLine.get(flow.lineId) ?? []
        bucket.push(flow)
        segmentFlowsByLine.set(flow.lineId, bucket)
      }
      for (const lineReport of report.lines) {
        for (const stationReport of lineReport.stations ?? []) {
          const flow = stationFlows.get(`${lineReport.lineId}::${stationReport.stationId}`)
          if (!flow) continue
          stationReport.boardings = flow.boardings
          stationReport.alightings = flow.alightings
          stationReport.transferBoardings = flow.transferBoardings
          stationReport.leftBehindPassengers = flow.leftBehindPassengers
          const routedFootfall = flow.boardings + flow.alightings + flow.transferBoardings
          stationReport.estimatedDailyFootfall = Math.max(stationReport.estimatedDailyFootfall, routedFootfall)
          stationReport.utilizationRate = stationReport.stationCapacity > 0
            ? stationReport.estimatedDailyFootfall / stationReport.stationCapacity
            : stationReport.estimatedDailyFootfall > 0 ? 3 : 0
          const transferShare = flow.boardings > 0 ? flow.transferBoardings / flow.boardings : 0
          stationReport.hubScore = Math.min(100, Math.round(
            Math.min(1, stationReport.interchangeLineCount / 4) * 34
            + Math.min(1, transferShare / 0.45) * 34
            + Math.min(1, stationReport.estimatedDailyFootfall / Math.max(1, stationReport.stationCapacity)) * 22
            + Math.min(1, flow.leftBehindPassengers / 1500) * 10
          ))
          stationReport.networkRole = stationReport.utilizationRate >= 1.05 || flow.leftBehindPassengers >= 500
            ? 'SATURATED'
            : stationReport.hubScore >= 68
              ? 'HUB'
              : stationReport.interchangeLineCount > 0 || flow.transferBoardings > 0
                ? 'INTERCHANGE'
                : 'LOCAL'
        }
        const stationById = new Map((lineReport.stations ?? []).map(station => [station.stationId, station] as const))
        const sourceLine = sourceLineById.get(lineReport.lineId)
        const lineInfrastructureCapacity = Math.max(1, Number(lineReport.infrastructureCapacityMultiplier ?? 1))
        const baseDailyCapacity = Math.max(1, Number(lineReport.dailyCapacity ?? 1) / lineInfrastructureCapacity)
        lineReport.segments = (segmentFlowsByLine.get(lineReport.lineId) ?? []).map(flow => {
          const from = stationById.get(flow.fromStationId)
          const to = stationById.get(flow.toStationId)
          const infrastructure = sourceLine
            ? infrastructureSegmentState(sourceLine, flow.fromStationId, flow.toStationId)
            : null
          const effectiveCapacityMultiplier = infrastructure?.capacityMultiplier ?? 1
          const segmentCapacity = Math.max(1, baseDailyCapacity * effectiveCapacityMultiplier)
          const loadRate = flow.passengers / segmentCapacity
          const endpointPressure = Math.max(Number(from?.utilizationRate ?? 0), Number(to?.utilizationRate ?? 0))
          return {
            fromStationId: flow.fromStationId,
            toStationId: flow.toStationId,
            fromStationName: from?.stationName ?? flow.fromStationId,
            toStationName: to?.stationName ?? flow.toStationId,
            routedPassengers: flow.passengers,
            loadRate,
            pressureScore: Math.max(loadRate, endpointPressure * .85),
            infrastructureCapacityLevel: infrastructure?.capacityLevel ?? 0,
            infrastructureSpeedLevel: infrastructure?.speedLevel ?? 0,
            infrastructureReliabilityLevel: infrastructure?.reliabilityLevel ?? 0,
            effectiveCapacityMultiplier,
          }
        }).sort((a, b) => b.pressureScore - a.pressureScore)
        const bottleneck = lineReport.segments[0]
        lineReport.bottleneckSegmentName = bottleneck ? `${bottleneck.fromStationName} ↔ ${bottleneck.toStationName}` : null
        lineReport.bottleneckSegmentLoadRate = bottleneck?.loadRate ?? 0
      }

      const simulationLineById = sourceLineById
      for (const lineReport of report.lines) {
        const line = simulationLineById.get(lineReport.lineId)
        if (!line || !isOperationalLine(line)) continue
        const required = Math.max(1, lineReport.requiredVehicleCount ?? 1)
        const boostWear = Math.min(0.35, (lineReport.activeBoostVehicleCount ?? 0) / required * 0.35)
        const maintenanceResult = applyDailyFleetMaintenance(
          line,
          Math.min(1.4, (lineReport.serviceFulfillmentRate ?? 0) + boostWear),
        )
        lineReport.fleetConditionAfter = maintenanceResult.after
      }

      applySimulationDay(save.data.simulation, save.data.economy, report)
      const creditMultiplier = GAME_ECONOMY_PROFILE_MULTIPLIERS[save.data.freePlaySettings.economyProfile].credit
      if (!save.data.economy.unlimitedMoney) {
        applyDailyDebtInterest(save.data.economy)
      }

      const operatingRevenue = save.data.economy.totalPassengerRevenue + save.data.economy.totalFineRevenue
      const fundingCreditLimit = Math.round(
        calculateCreditLimit(
          save.data.network.lines.length,
          operatingRevenue,
          save.data.economy.totalInvestment,
          save.data.economy.creditScore,
        ) * creditMultiplier,
      )
      processPublicDevelopmentFunding(save.data.economy, nextDay, {
        operationalLineCount: save.data.network.lines.filter(isOperationalLine).length,
        municipalitiesServed: territory.summary.value.municipalitiesServed,
        dailyPassengers: report.passengers,
        serviceQualityScore: report.serviceQualityScore ?? 70,
        dailyOperatingResult: report.netResult,
        debtPrincipal: save.data.economy.debtPrincipal,
        creditLimit: fundingCreditLimit,
        profile: save.data.freePlaySettings.economyProfile,
      })

      if (!save.data.economy.unlimitedMoney) {
        processDebtDay(save.data.economy, nextDay, save.data.network.lines.length, creditMultiplier)
      }
      save.data.simulationDay = nextDay

      municipalities.processDay(nextDay)
      events.processDay(nextDay, operationalLineCount.value, report)
      if (save.data.freePlaySettings.objectivesEnabled) {
        const completedBefore = new Set(save.data.objectives.completed.map(item => item.id))
        objectives.processDay(nextDay)
        for (const completed of save.data.objectives.completed.filter(item => !completedBefore.has(item.id))) {
          registerObjectiveMilestone(save, completed.title || completed.id, completed.reward ?? 0, nextDay)
        }
      }

      // V28 : records + snapshot hebdomadaire une fois toutes les conséquences du jour appliquées.
      captureStatisticsForDay(save, report)

      await game.persistCurrentGame()
      return report
    }
    finally {
      isAdvancing.value = false
    }
  }

  return {
    simulation,
    day,
    currentDate,
    currentCalendarLabel,
    currentDayLabel,
    history,
    lastDayReport,
    totalPassengers,
    totalLostPassengers,
    totalRevenue,
    totalOperatingCost,
    totalFraudRevenueLoss,
    totalFineRevenue,
    totalControlCost,
    serviceQualityScore,
    networkMoraleScore,
    serviceQualityDemandMultiplier,
    demandSatisfactionRate,
    averageWaitMinutes,
    criticalLineCount,
    operationalLineCount,
    constructionLineCount,
    isAdvancing,
    reportForLine,
    stationReport,
    advanceDay,
  }
}

type GameSimulationRuntime = ReturnType<typeof createGameSimulation>
let sharedGameSimulation: GameSimulationRuntime | null = null

export function useGameSimulation() {
  // Simulation unique pour toute la SPA : les panneaux, l’horloge et le runtime transport
  // consultent tous les mêmes rapports. Mutualiser évite de dupliquer les index de rapports,
  // compteurs réseau et autres computed dérivés.
  if (!sharedGameSimulation) sharedGameSimulation = createGameSimulation()
  return sharedGameSimulation
}
