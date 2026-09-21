import { computed } from 'vue'
import { useState } from '#app'
import { useGameNetwork } from './useGameNetwork'
import { useGameSimulation } from './useGameSimulation'

import type {
  GameLineDailySimulation,
  GameSimulationDayReport,
} from '../types/simulation'

export type GameAnalyticsScope = 'ALL' | 'CUSTOM'

interface GameAnalyticsAggregate {
  lineCount: number
  passengers: number
  capacity: number
  demand: number
  waiting: number
  lost: number
  unmet: number
  revenue: number
  operatingCost: number
  netResult: number
  occupancyRate: number
  demandSatisfactionRate: number
  averageWaitMinutes: number
  pressureScore: number
  fraudPassengers: number
  detectedFraudPassengers: number
  finePayingPassengers: number
  fineRevenue: number
  fraudRevenueLoss: number
  controlCost: number
  morale: number
  quality: number
  regularity: number
}

function aggregateLines(lines: GameLineDailySimulation[]): GameAnalyticsAggregate {
  const passengers = lines.reduce((total, line) => total + line.passengers, 0)
  const capacity = lines.reduce((total, line) => total + line.dailyCapacity, 0)
  const demand = lines.reduce((total, line) => total + line.boardingDemandPassengers, 0)
  const waiting = lines.reduce((total, line) => total + line.waitingPassengersAfter, 0)
  const lost = lines.reduce((total, line) => total + line.lostPassengers, 0)
  const unmet = lines.reduce(
    (total, line) => total + (line.unmetDemandPassengers ?? line.waitingPassengersAfter + line.lostPassengers),
    0,
  )
  const revenue = lines.reduce((total, line) => total + line.revenue, 0)
  const operatingCost = lines.reduce((total, line) => total + line.operatingCost, 0)
  const fraudPassengers = lines.reduce((total, line) => total + (line.fraudPassengers ?? 0), 0)
  const detectedFraudPassengers = lines.reduce((total, line) => total + (line.detectedFraudPassengers ?? 0), 0)
  const finePayingPassengers = lines.reduce((total, line) => total + (line.finePayingPassengers ?? 0), 0)
  const fineRevenue = lines.reduce((total, line) => total + (line.fineRevenue ?? 0), 0)
  const fraudRevenueLoss = lines.reduce((total, line) => total + (line.fraudRevenueLoss ?? 0), 0)
  const controlCost = lines.reduce((total, line) => total + (line.controlCost ?? 0), 0)
  const passengerWeight = Math.max(1, passengers)
  const demandWeight = Math.max(1, demand)
  const morale = lines.length > 0
    ? lines.reduce((total, line) => total + line.moraleScoreAfter * Math.max(1, line.passengers), 0) / passengerWeight
    : 76
  const quality = lines.length > 0
    ? lines.reduce((total, line) => total + (line.serviceQualityScore ?? 0) * Math.max(1, line.passengers), 0) / passengerWeight
    : 0
  const averageWaitMinutes = lines.length > 0
    ? lines.reduce((total, line) => total + line.averageWaitMinutes * Math.max(1, line.boardingDemandPassengers), 0) / demandWeight
    : 0
  const pressureScore = lines.length > 0
    ? lines.reduce((total, line) => total + (line.passengerPressureScore ?? 0), 0) / lines.length
    : 0
  const regularity = lines.length > 0
    ? lines.reduce((total, line) => total + (line.regularityScore ?? 85), 0) / lines.length
    : 85

  return {
    lineCount: lines.length,
    passengers,
    capacity,
    demand,
    waiting,
    lost,
    unmet,
    revenue,
    operatingCost,
    netResult: revenue - operatingCost,
    occupancyRate: capacity > 0 ? passengers / capacity : 0,
    demandSatisfactionRate: demand > 0 ? Math.min(1, passengers / demand) : 1,
    averageWaitMinutes,
    pressureScore,
    fraudPassengers,
    detectedFraudPassengers,
    finePayingPassengers,
    fineRevenue,
    fraudRevenueLoss,
    controlCost,
    morale,
    quality,
    regularity,
  }
}

function percentageDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 1
  return (current - previous) / Math.abs(previous)
}

export function useGameAnalytics() {
  const network = useGameNetwork()
  const simulation = useGameSimulation()
  const scope = useState<GameAnalyticsScope>('clu-metropole-analytics-scope', () => 'ALL')
  const selectedLineIds = useState<string[]>('clu-metropole-analytics-lines', () => [])

  const effectiveLineIds = computed(() => {
    if (scope.value === 'ALL' || selectedLineIds.value.length === 0) {
      return network.lines.value.map(line => line.id)
    }
    const existing = new Set(network.lines.value.map(line => line.id))
    return selectedLineIds.value.filter(id => existing.has(id))
  })

  function reportsForDay(report: GameSimulationDayReport | null | undefined) {
    if (!report) return []
    const ids = new Set(effectiveLineIds.value)
    return report.lines.filter(line => ids.has(line.lineId))
  }

  const reports = computed(() => reportsForDay(simulation.lastDayReport.value))

  const selectedLines = computed(() => {
    const ids = new Set(effectiveLineIds.value)
    return network.lines.value.filter(line => ids.has(line.id))
  })

  const aggregate = computed(() => aggregateLines(reports.value))

  const dailySeries = computed(() => simulation.history.value
    .slice(-14)
    .map(report => {
      const aggregated = aggregateLines(reportsForDay(report))
      return {
        day: report.day,
        date: report.date,
        ...aggregated,
      }
    }))

  /** Fenêtre courte volontairement lisible dans Réseau et Finances. */
  const recentDays = computed(() => dailySeries.value.slice(-7))

  const trend = computed(() => {
    const points = recentDays.value
    const current = points.at(-1)
    const previous = points.at(-2)
    const first = points[0]
    if (!current || !previous || !first) {
      return {
        hasPrevious: false,
        days: points.length,
        passengers: 0,
        waiting: 0,
        lost: 0,
        morale: 0,
        quality: 0,
        netResult: 0,
        satisfaction: 0,
        averageWait: 0,
        passengersPercent: 0,
        waitingDelta: 0,
        moraleDelta: 0,
        qualityDelta: 0,
      }
    }

    return {
      hasPrevious: true,
      days: points.length,
      passengers: percentageDelta(current.passengers, previous.passengers),
      waiting: percentageDelta(current.waiting, previous.waiting),
      lost: percentageDelta(current.lost, previous.lost),
      morale: current.morale - previous.morale,
      quality: current.quality - previous.quality,
      netResult: current.netResult - previous.netResult,
      satisfaction: current.demandSatisfactionRate - previous.demandSatisfactionRate,
      averageWait: current.averageWaitMinutes - previous.averageWaitMinutes,
      /** Compatibilité UI : tendance sur toute la fenêtre récente. */
      passengersPercent: percentageDelta(current.passengers, first.passengers),
      waitingDelta: current.waiting - first.waiting,
      moraleDelta: current.morale - first.morale,
      qualityDelta: current.quality - first.quality,
    }
  })

  const constraintSummary = computed(() => {
    const counts = new Map<string, { label: string; count: number; severity: string }>()
    for (const line of reports.value) {
      for (const diagnostic of line.diagnostics ?? []) {
        if (diagnostic.severity === 'GOOD') continue
        const current = counts.get(diagnostic.code)
        if (current) current.count += 1
        else counts.set(diagnostic.code, { label: diagnostic.label, count: 1, severity: diagnostic.severity })
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  })

  const mostPressuredLine = computed(() => [...reports.value]
    .sort((a, b) => (b.passengerPressureScore ?? 0) - (a.passengerPressureScore ?? 0))[0] ?? null)

  const networkHealth = computed(() => {
    const value = aggregate.value
    if (value.lineCount === 0) {
      return {
        label: 'Aucune donnée',
        tone: 'neutral',
        summary: 'Faites circuler au moins une ligne pour obtenir un diagnostic.',
      }
    }
    const operationalDays = dailySeries.value.filter(point => point.lineCount > 0).length
    if (operationalDays <= 2) {
      return {
        label: 'Mise en route',
        tone: 'info',
        summary: 'CLU laisse passer les deux premières journées d’exploitation avant de conclure qu’un problème est structurel.',
      }
    }
    if (value.demandSatisfactionRate < 0.72 || value.morale < 40 || value.pressureScore >= 72 || value.regularity < 45) {
      return {
        label: 'Sous forte pression',
        tone: 'critical',
        summary: 'La priorité est de rétablir la capacité, la régularité et les files d’attente.',
      }
    }
    if (value.demandSatisfactionRate < 0.9 || value.morale < 58 || value.averageWaitMinutes >= 12 || value.regularity < 70) {
      return {
        label: 'À surveiller',
        tone: 'warning',
        summary: 'Le réseau fonctionne mais certaines tensions peuvent devenir structurelles.',
      }
    }
    if (value.quality >= 78 && value.morale >= 70 && value.demandSatisfactionRate >= 0.96) {
      return {
        label: 'Maîtrisé',
        tone: 'good',
        summary: 'La demande est bien absorbée et les voyageurs bénéficient d’un service solide.',
      }
    }
    return {
      label: 'Stable',
      tone: 'info',
      summary: 'Le réseau fonctionne correctement, avec encore quelques marges d’amélioration.',
    }
  })

  /** Alias utilisés par la vue Réseau V19. */
  const networkPulse = computed(() => ({
    level: networkHealth.value.tone.toUpperCase(),
    label: networkHealth.value.label,
    explanation: networkHealth.value.summary,
  }))

  const priorityLine = computed(() => mostPressuredLine.value)

  function selectAll() {
    scope.value = 'ALL'
    selectedLineIds.value = []
  }

  function toggleLine(lineId: string) {
    scope.value = 'CUSTOM'
    const set = new Set(selectedLineIds.value)
    if (set.has(lineId)) set.delete(lineId)
    else set.add(lineId)
    selectedLineIds.value = [...set]
    if (selectedLineIds.value.length === 0) scope.value = 'ALL'
  }

  function onlyLine(lineId: string) {
    scope.value = 'CUSTOM'
    selectedLineIds.value = [lineId]
  }

  return {
    scope,
    selectedLineIds,
    effectiveLineIds,
    selectedLines,
    reports,
    aggregate,
    dailySeries,
    recentDays,
    trend,
    constraintSummary,
    mostPressuredLine,
    networkHealth,
    networkPulse,
    priorityLine,
    selectAll,
    toggleLine,
    onlyLine,
  }
}
