import { currentGameLocaleTag } from '../../config/i18n'
import type { GameSave } from '../../types/game'
import type { GameSimulationDayReport } from '../../types/simulation'
import type {
  GameStatisticsEconomyTotals,
  GameStatisticsMilestone,
  GameStatisticsMilestoneKind,
  GameStatisticsRecord,
  GameStatisticsRecords,
  GameStatisticsState,
  GameWeeklySnapshot,
} from '../../types/statistics'
import { calculateLineLengthKm } from '../economy'
import { getLineAllStations } from '../network/geometry'

const MAX_MILESTONES = 220
/** V43: conserve vingt ans de bilans hebdomadaires, puis garde les plus recents. */
export const MAX_WEEKLY_SNAPSHOTS = 1040
const EPSILON = 1e-8

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function numberOr(value: unknown, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function record(value = 0, day = 1, allowNegative = false): GameStatisticsRecord {
  const normalized = numberOr(value)
  return { value: allowNegative ? normalized : Math.max(0, normalized), day: Math.max(1, Math.floor(numberOr(day, 1))) }
}

export function economyTotalsFromSave(save: Pick<GameSave, 'data'>): GameStatisticsEconomyTotals {
  const economy = save.data.economy
  return {
    investment: Math.max(0, economy.totalInvestment ?? economy.totalSpent ?? 0),
    passengerRevenue: Math.max(0, economy.totalPassengerRevenue ?? 0),
    fineRevenue: Math.max(0, economy.totalFineRevenue ?? 0),
    operatingCosts: Math.max(0, economy.totalOperatingCosts ?? 0),
    subsidies: Math.max(0, economy.totalSubsidies ?? 0),
    publicDevelopmentFunding: Math.max(0, economy.totalPublicDevelopmentFunding ?? 0),
    objectiveRewards: Math.max(0, economy.totalObjectiveRewards ?? 0),
    interestPaid: Math.max(0, economy.totalInterestPaid ?? 0),
    debtPenalties: Math.max(0, economy.totalDebtPenalties ?? 0),
    compensationPaid: Math.max(0, economy.totalCompensationPaid ?? 0),
  }
}

export function countUniqueNetworkStations(save: Pick<GameSave, 'data'>) {
  const ids = new Set<string>()
  for (const line of save.data.network.lines) {
    for (const station of getLineAllStations(line)) ids.add(station.sharedStationId || station.id)
  }
  return ids.size
}

export function networkLengthKm(save: Pick<GameSave, 'data'>) {
  return save.data.network.lines.reduce((total, line) => total + calculateLineLengthKm(line), 0)
}

export function totalVehicleCount(save: Pick<GameSave, 'data'>) {
  return save.data.network.lines.reduce((total, line) => total + Math.max(0, Math.floor(line.vehicleCount ?? 0)), 0)
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function weightedNetworkMorale(report: GameSimulationDayReport) {
  if (Number.isFinite(report.networkMoraleScore)) return Number(report.networkMoraleScore)
  const total = report.lines.reduce((sum, line) => sum + Math.max(0, line.passengers), 0)
  if (total <= 0) return null
  return report.lines.reduce((sum, line) => sum + (line.moraleScoreAfter ?? 76) * Math.max(0, line.passengers), 0) / total
}

export function buildWeeklySnapshot(
  save: Pick<GameSave, 'data'>,
  week: number,
  completed: boolean,
  options: { reconstructed?: boolean; structuralData?: boolean } = {},
): GameWeeklySnapshot {
  const startDay = (week - 1) * 7 + 1
  const theoreticalEnd = week * 7
  const currentDay = Math.max(1, Math.floor(save.data.simulationDay || 1))
  const endDay = completed ? theoreticalEnd : Math.min(theoreticalEnd, currentDay)
  const reports = (save.data.simulation.history ?? []).filter(report => report.day >= startDay && report.day <= endDay)
  const structuralData = options.structuralData !== false
  const peak = reports.reduce<GameSimulationDayReport | null>((best, report) => !best || report.passengers > best.passengers ? report : best, null)
  const quality = reports.map(report => report.serviceQualityScore).filter((value): value is number => Number.isFinite(value))
  const satisfaction = reports.map(report => report.demandSatisfactionRate).filter((value): value is number => Number.isFinite(value))
  const morale = reports.map(weightedNetworkMorale).filter((value): value is number => Number.isFinite(value))
  const wait = reports.map(report => report.averageWaitMinutes).filter((value): value is number => Number.isFinite(value))
  const lines = save.data.network.lines

  return {
    week,
    startDay,
    endDay,
    capturedDay: currentDay,
    completed,
    reconstructed: options.reconstructed === true || undefined,
    reportedDays: reports.length,
    passengers: reports.reduce((sum, report) => sum + Math.max(0, report.passengers), 0),
    lostPassengers: reports.reduce((sum, report) => sum + Math.max(0, report.lostPassengers), 0),
    revenue: reports.reduce((sum, report) => sum + report.revenue, 0),
    operatingCost: reports.reduce((sum, report) => sum + report.operatingCost, 0),
    netResult: reports.reduce((sum, report) => sum + report.netResult, 0),
    averageServiceQuality: average(quality),
    averageDemandSatisfaction: average(satisfaction),
    averageMorale: average(morale),
    averageWaitMinutes: average(wait),
    peakPassengers: peak?.passengers ?? 0,
    peakPassengersDay: peak?.day ?? null,
    balance: structuralData ? save.data.economy.balance : null,
    debt: structuralData ? save.data.economy.debtPrincipal : null,
    lineCount: structuralData ? lines.length : null,
    operationalLineCount: structuralData ? lines.filter(line => line.status === 'OPERATIONAL').length : null,
    constructionLineCount: structuralData ? lines.filter(line => line.status === 'CONSTRUCTION').length : null,
    stationCount: structuralData ? countUniqueNetworkStations(save) : null,
    vehicleCount: structuralData ? totalVehicleCount(save) : null,
    networkLengthKm: structuralData ? networkLengthKm(save) : null,
    municipalitiesServed: structuralData ? (reports.at(-1)?.municipalitiesServed ?? null) : (reports.at(-1)?.municipalitiesServed ?? null),
    economyTotals: structuralData ? economyTotalsFromSave(save) : null,
  }
}

function emptyRecords(save: Pick<GameSave, 'data'>): GameStatisticsRecords {
  const day = Math.max(1, Math.floor(save.data.simulationDay || 1))
  const currentLength = networkLengthKm(save)
  const currentLines = save.data.network.lines.length
  return {
    dailyPassengers: record(0, day),
    dailyOperatingProfit: record(0, day, true),
    highestDebt: record(save.data.economy.debtPrincipal, day),
    highestBalance: record(Math.max(0, save.data.economy.balance), day),
    networkLengthKm: record(currentLength, day),
    lineCount: record(currentLines, day),
  }
}

function sanitizeRecord(raw: Partial<GameStatisticsRecord> | undefined, fallback: GameStatisticsRecord) {
  return {
    value: Math.max(0, numberOr(raw?.value, fallback.value)),
    day: Math.max(1, Math.floor(numberOr(raw?.day, fallback.day))),
  }
}

function sanitizeSignedRecord(raw: Partial<GameStatisticsRecord> | undefined, fallback: GameStatisticsRecord) {
  return {
    value: numberOr(raw?.value, fallback.value),
    day: Math.max(1, Math.floor(numberOr(raw?.day, fallback.day))),
  }
}

function trimWeeklySnapshots(weeks: GameWeeklySnapshot[]) {
  if (weeks.length <= MAX_WEEKLY_SNAPSHOTS) return weeks
  return weeks.slice(-MAX_WEEKLY_SNAPSHOTS)
}

function normalizeWeeklySnapshots(rawWeeks: GameWeeklySnapshot[]) {
  const byWeek = new Map<number, GameWeeklySnapshot>()
  for (const raw of rawWeeks) {
    const snapshot = sanitizeWeeklySnapshot(raw)
    if (!snapshot) continue
    const previous = byWeek.get(snapshot.week)
    if (!previous || snapshot.capturedDay >= previous.capturedDay) byWeek.set(snapshot.week, snapshot)
  }
  return trimWeeklySnapshots([...byWeek.values()].sort((a, b) => a.week - b.week))
}

function reconstructOperationalWeeks(save: Pick<GameSave, 'data'>) {
  const currentDay = Math.max(1, Math.floor(save.data.simulationDay || 1))
  const completedWeekCount = Math.floor(currentDay / 7)
  const weeks: GameWeeklySnapshot[] = []
  for (let week = 1; week <= completedWeekCount; week += 1) {
    const start = (week - 1) * 7 + 1
    const end = week * 7
    const hasReports = (save.data.simulation.history ?? []).some(report => report.day >= start && report.day <= end)
    if (!hasReports) continue
    weeks.push(buildWeeklySnapshot(save, week, true, { reconstructed: true, structuralData: false }))
  }
  return trimWeeklySnapshots(weeks)
}

export function createStatisticsState(save: Pick<GameSave, 'data'>, migratedFromOlderSave = false): GameStatisticsState {
  const day = Math.max(1, Math.floor(save.data.simulationDay || 1))
  const currentLines = save.data.network.lines.filter(line => line.status !== 'PROJECT')
  const currentStations = countUniqueNetworkStations(save)
  const currentVehicles = totalVehicleCount(save)
  const records = emptyRecords(save)
  for (const report of save.data.simulation.history ?? []) {
    if (report.passengers > records.dailyPassengers.value) records.dailyPassengers = record(report.passengers, report.day)
    if (records.dailyOperatingProfit.value === 0 && records.dailyOperatingProfit.day === day) records.dailyOperatingProfit = record(report.netResult, report.day, true)
    else if (report.netResult > records.dailyOperatingProfit.value) records.dailyOperatingProfit = record(report.netResult, report.day, true)
  }

  return {
    trackingStartedDay: migratedFromOlderSave ? day : 1,
    migratedFromOlderSave,
    linesLaunched: currentLines.length,
    linesDeleted: 0,
    stationsBuilt: currentStations,
    stationsRemoved: 0,
    vehiclesPurchased: currentVehicles,
    vehiclesSold: 0,
    baselineEconomyTotals: economyTotalsFromSave(save),
    weeks: migratedFromOlderSave ? reconstructOperationalWeeks(save) : [],
    records,
    milestones: [],
  }
}

function sanitizeEconomyTotals(raw: Partial<GameStatisticsEconomyTotals> | undefined, fallback: GameStatisticsEconomyTotals): GameStatisticsEconomyTotals {
  return {
    investment: Math.max(0, numberOr(raw?.investment, fallback.investment)),
    passengerRevenue: Math.max(0, numberOr(raw?.passengerRevenue, fallback.passengerRevenue)),
    fineRevenue: Math.max(0, numberOr(raw?.fineRevenue, fallback.fineRevenue)),
    operatingCosts: Math.max(0, numberOr(raw?.operatingCosts, fallback.operatingCosts)),
    subsidies: Math.max(0, numberOr(raw?.subsidies, fallback.subsidies)),
    publicDevelopmentFunding: Math.max(0, numberOr(raw?.publicDevelopmentFunding, fallback.publicDevelopmentFunding)),
    objectiveRewards: Math.max(0, numberOr(raw?.objectiveRewards, fallback.objectiveRewards)),
    interestPaid: Math.max(0, numberOr(raw?.interestPaid, fallback.interestPaid)),
    debtPenalties: Math.max(0, numberOr(raw?.debtPenalties, fallback.debtPenalties)),
    compensationPaid: Math.max(0, numberOr(raw?.compensationPaid, fallback.compensationPaid)),
  }
}

function sanitizeWeeklySnapshot(raw: GameWeeklySnapshot): GameWeeklySnapshot | null {
  const week = Math.floor(numberOr(raw?.week, 0))
  if (week < 1) return null
  const startDay = (week - 1) * 7 + 1
  const endDay = Math.max(startDay, Math.floor(numberOr(raw.endDay, week * 7)))
  return {
    week,
    startDay,
    endDay,
    capturedDay: Math.max(endDay, Math.floor(numberOr(raw.capturedDay, endDay))),
    completed: raw.completed !== false,
    reconstructed: raw.reconstructed === true || undefined,
    reportedDays: Math.max(0, Math.floor(numberOr(raw.reportedDays, 0))),
    passengers: Math.max(0, numberOr(raw.passengers)),
    lostPassengers: Math.max(0, numberOr(raw.lostPassengers)),
    revenue: numberOr(raw.revenue),
    operatingCost: Math.max(0, numberOr(raw.operatingCost)),
    netResult: numberOr(raw.netResult),
    averageServiceQuality: raw.averageServiceQuality != null && Number.isFinite(Number(raw.averageServiceQuality)) ? Number(raw.averageServiceQuality) : null,
    averageDemandSatisfaction: raw.averageDemandSatisfaction != null && Number.isFinite(Number(raw.averageDemandSatisfaction)) ? Number(raw.averageDemandSatisfaction) : null,
    averageMorale: raw.averageMorale != null && Number.isFinite(Number(raw.averageMorale)) ? Number(raw.averageMorale) : null,
    averageWaitMinutes: raw.averageWaitMinutes != null && Number.isFinite(Number(raw.averageWaitMinutes)) ? Math.max(0, Number(raw.averageWaitMinutes)) : null,
    peakPassengers: Math.max(0, numberOr(raw.peakPassengers)),
    peakPassengersDay: raw.peakPassengersDay != null && Number.isFinite(Number(raw.peakPassengersDay)) ? Math.max(1, Math.floor(Number(raw.peakPassengersDay))) : null,
    balance: raw.balance != null && Number.isFinite(Number(raw.balance)) ? Number(raw.balance) : null,
    debt: raw.debt != null && Number.isFinite(Number(raw.debt)) ? Math.max(0, Number(raw.debt)) : null,
    lineCount: raw.lineCount != null && Number.isFinite(Number(raw.lineCount)) ? Math.max(0, Math.floor(Number(raw.lineCount))) : null,
    operationalLineCount: raw.operationalLineCount != null && Number.isFinite(Number(raw.operationalLineCount)) ? Math.max(0, Math.floor(Number(raw.operationalLineCount))) : null,
    constructionLineCount: raw.constructionLineCount != null && Number.isFinite(Number(raw.constructionLineCount)) ? Math.max(0, Math.floor(Number(raw.constructionLineCount))) : null,
    stationCount: raw.stationCount != null && Number.isFinite(Number(raw.stationCount)) ? Math.max(0, Math.floor(Number(raw.stationCount))) : null,
    vehicleCount: raw.vehicleCount != null && Number.isFinite(Number(raw.vehicleCount)) ? Math.max(0, Math.floor(Number(raw.vehicleCount))) : null,
    networkLengthKm: raw.networkLengthKm != null && Number.isFinite(Number(raw.networkLengthKm)) ? Math.max(0, Number(raw.networkLengthKm)) : null,
    municipalitiesServed: raw.municipalitiesServed != null && Number.isFinite(Number(raw.municipalitiesServed)) ? Math.max(0, Math.floor(Number(raw.municipalitiesServed))) : null,
    economyTotals: raw.economyTotals ? sanitizeEconomyTotals(raw.economyTotals, raw.economyTotals) : null,
  }
}

export function normalizeStatisticsState(
  raw: GameStatisticsState | undefined,
  save: Pick<GameSave, 'data'>,
  migratedFromOlderSave: boolean,
): GameStatisticsState {
  if (!raw || typeof raw !== 'object') return createStatisticsState(save, migratedFromOlderSave)
  const fallback = createStatisticsState(save, migratedFromOlderSave)
  const rawRecords = raw.records ?? fallback.records
  const milestones: GameStatisticsMilestone[] = Array.isArray(raw.milestones)
    ? raw.milestones.filter(item => item && Number.isFinite(Number(item.day)) && typeof item.title === 'string').slice(-MAX_MILESTONES).map(item => ({
      id: typeof item.id === 'string' && item.id ? item.id : createId('milestone'),
      kind: ['LINE_LAUNCHED','LINE_DELETED','OBJECTIVE_COMPLETED','PASSENGER_RECORD','OPERATING_RECORD'].includes(String(item.kind)) ? item.kind : 'LINE_LAUNCHED',
      day: Math.max(1, Math.floor(Number(item.day))),
      title: item.title.slice(0, 100),
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 240) : '',
      amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : undefined,
    })) : []

  return {
    trackingStartedDay: Math.max(1, Math.floor(numberOr(raw.trackingStartedDay, fallback.trackingStartedDay))),
    migratedFromOlderSave: raw.migratedFromOlderSave === true || migratedFromOlderSave,
    linesLaunched: Math.max(0, Math.floor(numberOr(raw.linesLaunched, fallback.linesLaunched))),
    linesDeleted: Math.max(0, Math.floor(numberOr(raw.linesDeleted, fallback.linesDeleted))),
    stationsBuilt: Math.max(0, Math.floor(numberOr(raw.stationsBuilt, fallback.stationsBuilt))),
    stationsRemoved: Math.max(0, Math.floor(numberOr(raw.stationsRemoved, fallback.stationsRemoved))),
    vehiclesPurchased: Math.max(0, Math.floor(numberOr(raw.vehiclesPurchased, fallback.vehiclesPurchased))),
    vehiclesSold: Math.max(0, Math.floor(numberOr(raw.vehiclesSold, fallback.vehiclesSold))),
    baselineEconomyTotals: sanitizeEconomyTotals(raw.baselineEconomyTotals, fallback.baselineEconomyTotals),
    weeks: Array.isArray(raw.weeks)
      ? normalizeWeeklySnapshots(raw.weeks)
      : trimWeeklySnapshots(fallback.weeks),
    records: {
      dailyPassengers: sanitizeRecord(rawRecords.dailyPassengers, fallback.records.dailyPassengers),
      dailyOperatingProfit: sanitizeSignedRecord(rawRecords.dailyOperatingProfit, fallback.records.dailyOperatingProfit),
      highestDebt: sanitizeRecord(rawRecords.highestDebt, fallback.records.highestDebt),
      highestBalance: sanitizeRecord(rawRecords.highestBalance, fallback.records.highestBalance),
      networkLengthKm: sanitizeRecord(rawRecords.networkLengthKm, fallback.records.networkLengthKm),
      lineCount: sanitizeRecord(rawRecords.lineCount, fallback.records.lineCount),
    },
    milestones,
  }
}

export function addStatisticsMilestone(
  statistics: GameStatisticsState,
  kind: GameStatisticsMilestoneKind,
  day: number,
  title: string,
  detail: string,
  amount?: number,
) {
  const milestone: GameStatisticsMilestone = {
    id: createId('milestone'),
    kind,
    day: Math.max(1, Math.floor(day)),
    title: title.slice(0, 100),
    detail: detail.slice(0, 240),
    amount: Number.isFinite(Number(amount)) ? Number(amount) : undefined,
  }
  statistics.milestones.push(milestone)
  if (statistics.milestones.length > MAX_MILESTONES) statistics.milestones.splice(0, statistics.milestones.length - MAX_MILESTONES)
  return milestone
}

export function registerLineLaunched(save: GameSave, stationCount: number, lineName: string, cost: number) {
  const statistics = save.data.statistics
  if (!statistics) return
  statistics.linesLaunched += 1
  statistics.stationsBuilt += Math.max(0, Math.floor(stationCount))
  addStatisticsMilestone(statistics, 'LINE_LAUNCHED', save.data.simulationDay, `Ligne ${lineName} lancée`, `${Math.max(0, Math.floor(stationCount))} arrêt(s) · travaux lancés`, cost)
}

export function registerLineModification(save: GameSave, addedStations: number, removedStations: number) {
  const statistics = save.data.statistics
  if (!statistics) return
  statistics.stationsBuilt += Math.max(0, Math.floor(addedStations))
  statistics.stationsRemoved += Math.max(0, Math.floor(removedStations))
}

export function registerLineDeleted(save: GameSave, stationCount: number, lineName: string) {
  const statistics = save.data.statistics
  if (!statistics) return
  statistics.linesDeleted += 1
  statistics.stationsRemoved += Math.max(0, Math.floor(stationCount))
  addStatisticsMilestone(statistics, 'LINE_DELETED', save.data.simulationDay, `Ligne ${lineName} supprimée`, `${Math.max(0, Math.floor(stationCount))} arrêt(s) retirés du réseau`)
}

export function registerVehiclePurchase(save: GameSave, count: number) {
  if (save.data.statistics) save.data.statistics.vehiclesPurchased += Math.max(0, Math.floor(count))
}

export function registerVehicleSale(save: GameSave, count: number) {
  if (save.data.statistics) save.data.statistics.vehiclesSold += Math.max(0, Math.floor(count))
}

export function registerObjectiveMilestone(save: GameSave, title: string, reward: number, day: number) {
  if (!save.data.statistics) return
  addStatisticsMilestone(save.data.statistics, 'OBJECTIVE_COMPLETED', day, `Objectif atteint · ${title}`, reward > 0 ? `Récompense obtenue` : `Objectif complété`, reward)
}

export function captureStatisticsForDay(save: GameSave, report: GameSimulationDayReport) {
  const statistics = save.data.statistics
  if (!statistics) return
  const day = Math.max(1, Math.floor(report.day))
  const previousPassengerRecord = statistics.records.dailyPassengers.value
  if (report.passengers > previousPassengerRecord) {
    statistics.records.dailyPassengers = record(report.passengers, day)
    if (previousPassengerRecord > 0 && report.passengers >= previousPassengerRecord * 1.08) {
      addStatisticsMilestone(statistics, 'PASSENGER_RECORD', day, 'Nouveau record de fréquentation', `${Math.round(report.passengers).toLocaleString(currentGameLocaleTag())} voyageurs transportés`)
    }
  }
  const operatingRecord = statistics.records.dailyOperatingProfit
  const firstTrackedReport = save.data.simulation.history.length <= 1 && operatingRecord.value === 0
  if (firstTrackedReport || report.netResult > operatingRecord.value) {
    const previous = operatingRecord.value
    statistics.records.dailyOperatingProfit = record(report.netResult, day, true)
    if (previous > 0 && report.netResult >= previous * 1.12) {
      addStatisticsMilestone(statistics, 'OPERATING_RECORD', day, 'Nouveau record d’exploitation', `Meilleur résultat d’exploitation quotidien`, report.netResult)
    }
  }
  if (save.data.economy.debtPrincipal > statistics.records.highestDebt.value + EPSILON) statistics.records.highestDebt = record(save.data.economy.debtPrincipal, day)
  if (save.data.economy.balance > statistics.records.highestBalance.value + EPSILON) statistics.records.highestBalance = record(save.data.economy.balance, day)
  const length = networkLengthKm(save)
  if (length > statistics.records.networkLengthKm.value + EPSILON) statistics.records.networkLengthKm = record(length, day)
  const lineCount = save.data.network.lines.length
  if (lineCount > statistics.records.lineCount.value) statistics.records.lineCount = record(lineCount, day)

  if (day % 7 === 0) {
    const week = Math.max(1, Math.ceil(day / 7))
    const snapshot = buildWeeklySnapshot(save, week, true)
    const existing = statistics.weeks.findIndex(item => item.week === week)
    if (existing >= 0) statistics.weeks.splice(existing, 1, snapshot)
    else statistics.weeks.push(snapshot)
    statistics.weeks.sort((a, b) => a.week - b.week)
    if (statistics.weeks.length > MAX_WEEKLY_SNAPSHOTS) {
      statistics.weeks.splice(0, statistics.weeks.length - MAX_WEEKLY_SNAPSHOTS)
    }
  }
}
