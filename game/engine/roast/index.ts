import { currentGameLocale, currentGameLocaleTag, translateGameText } from '../../config/i18n'
import { GAME_ROAST_TEMPLATES_FR } from '../../data/roast/fr'
import type { GameSave } from '../../types/game'
import type { GameSimulationDayReport, GameLineDailySimulation } from '../../types/simulation'
import type {
  GameRoastCategory,
  GameRoastFrequency,
  GameRoastHistoryEntry,
  GameRoastIntensity,
  GameRoastState,
} from '../../types/roast'
import { getLineAllStations } from '../network/geometry'

const HISTORY_LIMIT = 40
const RECENT_TEMPLATE_LIMIT = 10
const CATEGORY_COOLDOWN_DAYS = 10

const FREQUENCY_MIN_INTERVAL: Record<GameRoastFrequency, number> = {
  RARE: 10,
  STANDARD: 6,
  FREQUENT: 3,
}

interface RoastCandidate {
  category: GameRoastCategory
  score: number
  intensity: GameRoastIntensity
  line?: GameLineDailySimulation
  tokens?: Record<string, string>
}

function stableHash(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function compactInteger(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, Math.round(value)))
}

function compactMoney(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function intensityForScore(score: number): GameRoastIntensity {
  if (score >= 92) return 'EPIC'
  if (score >= 72) return 'MEDIUM'
  return 'LIGHT'
}

function addCandidate(target: RoastCandidate[], category: GameRoastCategory, score: number, line?: GameLineDailySimulation, tokens?: Record<string, string>) {
  if (score < 50) return
  target.push({ category, score, intensity: intensityForScore(score), line, tokens })
}

function busiestLine(report: GameSimulationDayReport) {
  return [...report.lines].sort((a, b) => (b.projectedOccupancyRate ?? b.occupancyRate ?? 0) - (a.projectedOccupancyRate ?? a.occupancyRate ?? 0))[0]
}

function mostProfitableLine(report: GameSimulationDayReport) {
  return [...report.lines].sort((a, b) => b.netResult - a.netResult)[0]
}

function mostOverfleetedLine(report: GameSimulationDayReport) {
  return [...report.lines]
    .filter(line => (line.requiredVehicleCount ?? 0) > 0)
    .sort((a, b) => ((b.vehicleCount ?? 0) / Math.max(1, b.requiredVehicleCount ?? 1)) - ((a.vehicleCount ?? 0) / Math.max(1, a.requiredVehicleCount ?? 1)))[0]
}

function buildCandidates(save: GameSave, report: GameSimulationDayReport): RoastCandidate[] {
  const candidates: RoastCandidate[] = []
  const stationCount = save.data.network.lines.reduce((sum, line) => sum + getLineAllStations(line).length, 0)
  const operationalLines = save.data.network.lines.filter(line => line.status === 'OPERATIONAL').length
  const busiest = busiestLine(report)
  const occupancy = busiest ? Math.max(busiest.projectedOccupancyRate ?? 0, busiest.occupancyRate ?? 0) : 0
  const waiting = Math.max(0, report.waitingPassengers ?? 0)
  const quality = Math.max(0, report.serviceQualityScore ?? 70)
  const satisfaction = Math.max(0, Math.min(1, report.demandSatisfactionRate ?? 1))
  const debt = Math.max(0, save.data.economy.debtPrincipal)

  if (busiest && (occupancy >= 1.12 || (report.congestedStationCount ?? 0) >= 2)) {
    addCandidate(candidates, 'SATURATION', Math.min(100, 55 + Math.max(0, occupancy - 1) * 95 + (report.congestedStationCount ?? 0) * 5), busiest, {
      occupancy: String(Math.round(occupancy * 100)),
      waiting: compactInteger(waiting),
    })
  }

  if (report.netResult <= -2_500_000) {
    addCandidate(candidates, 'DEFICIT', Math.min(100, 55 + Math.abs(report.netResult) / 1_250_000), undefined, { result: compactMoney(report.netResult) })
  }

  if (debt >= 650_000_000) {
    addCandidate(candidates, 'DEBT', Math.min(100, 52 + debt / 65_000_000), undefined, { debt: compactMoney(debt) })
  }

  if (report.day >= 8 && operationalLines >= 2 && stationCount >= 12 && report.passengers / Math.max(1, stationCount) < 280) {
    addCandidate(candidates, 'EMPTY_NETWORK', Math.min(96, 58 + stationCount / 3 - report.passengers / Math.max(1, stationCount) / 20), undefined, {
      stations: String(stationCount),
      passengers: compactInteger(report.passengers),
    })
  }

  const overfleet = mostOverfleetedLine(report)
  if (overfleet && (overfleet.requiredVehicleCount ?? 0) >= 2) {
    const ratio = (overfleet.vehicleCount ?? 0) / Math.max(1, overfleet.requiredVehicleCount ?? 1)
    if (ratio >= 1.85) {
      addCandidate(candidates, 'OVERFLEET', Math.min(100, 52 + (ratio - 1.5) * 42), overfleet, {
        vehicles: String(overfleet.vehicleCount ?? 0),
        required: String(overfleet.requiredVehicleCount ?? 0),
      })
    }
  }

  if (quality <= 56 || satisfaction <= 0.72) {
    addCandidate(candidates, 'QUALITY_CRASH', Math.min(100, 55 + Math.max(0, 60 - quality) * 1.15 + Math.max(0, .78 - satisfaction) * 80), undefined, {
      quality: String(Math.round(quality)),
      satisfaction: String(Math.round(satisfaction * 100)),
    })
  }

  const profitLine = mostProfitableLine(report)
  if (profitLine && report.day >= 5 && profitLine.netResult >= 1_500_000 && (profitLine.demandSatisfactionRate ?? 0) >= .92) {
    addCandidate(candidates, 'PROFIT_STAR', Math.min(94, 50 + profitLine.netResult / 350_000), profitLine, {
      lineResult: compactMoney(profitLine.netResult),
      linePassengers: compactInteger(profitLine.passengers),
    })
  }

  if (report.day >= 6 && report.passengers >= 8_000 && quality >= 86 && satisfaction >= .96 && report.netResult > 0) {
    addCandidate(candidates, 'GREAT_DAY', Math.min(100, 58 + (quality - 86) * 2 + (satisfaction - .96) * 300 + Math.log10(Math.max(10, report.passengers)) * 3), undefined, {
      passengers: compactInteger(report.passengers),
      quality: String(Math.round(quality)),
      satisfaction: String(Math.round(satisfaction * 100)),
    })
  }

  const initial = Math.max(1, save.data.economy.initialBudget)
  if (report.day >= 20 && save.data.economy.balance >= Math.max(6_000_000_000, initial * 1.35) && save.data.economy.totalInvestment < save.data.economy.balance * .55) {
    addCandidate(candidates, 'CASH_HOARD', Math.min(92, 55 + save.data.economy.balance / 1_500_000_000), undefined, {
      balance: compactMoney(save.data.economy.balance),
    })
  }

  const megaProject = [...save.data.network.lines]
    .filter(line => line.status === 'CONSTRUCTION' && (line.constructionCost ?? 0) >= 1_200_000_000)
    .sort((a, b) => (b.constructionCost ?? 0) - (a.constructionCost ?? 0))[0]
  if (megaProject) {
    addCandidate(candidates, 'MEGA_PROJECT', Math.min(98, 54 + megaProject.constructionCost / 90_000_000), undefined, {
      project: megaProject.name,
      projectCost: compactMoney(megaProject.constructionCost),
    })
  }

  if ((report.averageWaitMinutes ?? 0) >= 10) {
    addCandidate(candidates, 'WAITING_ROOM', Math.min(100, 50 + (report.averageWaitMinutes ?? 0) * 3), undefined, {
      wait: String(Math.round(report.averageWaitMinutes ?? 0)),
      project: 'Le projet',
      projectCost: compactMoney(0),
    })
  }

  return candidates
}

function interpolate(text: string, tokens: Record<string, string>) {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => tokens[key] ?? '—')
}

export function createEmptyRoastState(): GameRoastState {
  return {
    history: [],
    recentTemplateIds: [],
    lastTriggeredDay: -999,
    lastCategoryDays: {},
    totalTriggered: 0,
  }
}

export function normalizeRoastState(value?: Partial<GameRoastState> | null): GameRoastState {
  const fallback = createEmptyRoastState()
  return {
    history: Array.isArray(value?.history) ? value!.history!.slice(-HISTORY_LIMIT) : [],
    recentTemplateIds: Array.isArray(value?.recentTemplateIds) ? value!.recentTemplateIds!.filter(item => typeof item === 'string').slice(-RECENT_TEMPLATE_LIMIT) : [],
    lastTriggeredDay: Number.isFinite(value?.lastTriggeredDay) ? Math.floor(Number(value!.lastTriggeredDay)) : fallback.lastTriggeredDay,
    lastCategoryDays: value?.lastCategoryDays && typeof value.lastCategoryDays === 'object' ? { ...value.lastCategoryDays } : {},
    totalTriggered: Number.isFinite(value?.totalTriggered) ? Math.max(0, Math.floor(Number(value!.totalTriggered))) : 0,
  }
}

export function processGameRoastDay(
  state: GameRoastState,
  save: GameSave,
  report: GameSimulationDayReport,
  frequency: GameRoastFrequency = 'STANDARD',
): GameRoastHistoryEntry | null {
  const day = Math.max(1, Math.floor(report.day))
  if (day - state.lastTriggeredDay < FREQUENCY_MIN_INTERVAL[frequency]) return null

  const candidates = buildCandidates(save, report)
    .filter(candidate => day - (state.lastCategoryDays[candidate.category] ?? -999) >= CATEGORY_COOLDOWN_DAYS)
    .sort((a, b) => b.score - a.score)
  if (!candidates.length) return null

  // On choisit parmi les trois situations les plus saillantes pour éviter qu'un
  // même indicateur monopolise toute la personnalité du jeu.
  const pool = candidates.slice(0, Math.min(3, candidates.length))
  const candidate = pool[stableHash(`${save.id}:roast-category:${day}:${state.totalTriggered}`) % pool.length]!
  const templates = GAME_ROAST_TEMPLATES_FR.filter(template => template.category === candidate.category)
  const fresh = templates.filter(template => !state.recentTemplateIds.includes(template.id))
  const templatePool = fresh.length ? fresh : templates
  if (!templatePool.length) return null

  const template = templatePool[stableHash(`${save.id}:roast-template:${day}:${candidate.category}:${state.totalTriggered}`) % templatePool.length]!
  const locale = currentGameLocale()
  const commonTokens: Record<string, string> = {
    line: candidate.line?.lineName ?? translateGameText('Le réseau', locale),
    result: compactMoney(report.netResult),
    debt: compactMoney(save.data.economy.debtPrincipal),
    balance: compactMoney(save.data.economy.balance),
    passengers: compactInteger(report.passengers),
    waiting: compactInteger(report.waitingPassengers),
    quality: String(Math.round(report.serviceQualityScore ?? 70)),
    satisfaction: String(Math.round((report.demandSatisfactionRate ?? 1) * 100)),
    occupancy: String(Math.round((candidate.line?.projectedOccupancyRate ?? candidate.line?.occupancyRate ?? 0) * 100)),
    stations: String(save.data.network.lines.reduce((sum, line) => sum + getLineAllStations(line).length, 0)),
    vehicles: String(candidate.line?.vehicleCount ?? 0),
    required: String(candidate.line?.requiredVehicleCount ?? 0),
    lineResult: compactMoney(candidate.line?.netResult ?? 0),
    linePassengers: compactInteger(candidate.line?.passengers ?? 0),
    wait: String(Math.round(report.averageWaitMinutes ?? 0)),
    project: translateGameText('Le projet', locale),
    projectCost: compactMoney(0),
    ...(candidate.tokens ?? {}),
  }

  const entry: GameRoastHistoryEntry = {
    id: `roast-${save.id}-${day}-${state.totalTriggered + 1}`,
    templateId: template.id,
    day,
    category: candidate.category,
    intensity: candidate.intensity,
    reference: template.reference,
    title: interpolate(translateGameText(template.title, locale), commonTokens),
    message: interpolate(translateGameText(template.message, locale), commonTokens),
    lineId: candidate.line?.lineId,
    lineName: candidate.line?.lineName,
  }

  state.history.push(entry)
  state.history = state.history.slice(-HISTORY_LIMIT)
  state.recentTemplateIds.push(template.id)
  state.recentTemplateIds = state.recentTemplateIds.slice(-RECENT_TEMPLATE_LIMIT)
  state.lastTriggeredDay = day
  state.lastCategoryDays[candidate.category] = day
  state.totalTriggered += 1
  return entry
}
