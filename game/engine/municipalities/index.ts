import { currentGameLocaleTag } from '../../config/i18n'
import {
  GAME_MUNICIPALITY_COMPLETION_DAYS,
  GAME_MUNICIPALITY_DECISION_DAYS,
  GAME_MUNICIPALITY_INITIAL_RELATION,
  GAME_MUNICIPALITY_MAX_OPEN_REQUESTS,
  GAME_MUNICIPALITY_REQUEST_HISTORY_LIMIT,
  GAME_MUNICIPALITY_MODE_SUBSIDY_LIMITS,
  GAME_MUNICIPALITY_RELATION_COMPLETED_DELTA,
  GAME_MUNICIPALITY_RELATION_EXPIRED_DELTA,
  GAME_MUNICIPALITY_RELATION_FAILED_DELTA,
  GAME_MUNICIPALITY_RELATION_MAX,
  GAME_MUNICIPALITY_RELATION_MIN,
  GAME_MUNICIPALITY_RELATION_REFUSED_DELTA,
  GAME_MUNICIPALITY_REQUEST_COOLDOWN_DAYS,
  GAME_MUNICIPALITY_REFUSAL_COOLDOWN_DAYS,
  GAME_MUNICIPALITY_REPEAT_REFUSAL_KIND_DAYS,
  GAME_MUNICIPALITY_REQUEST_FUNDING_SHARE,
} from '../../config/municipalities'
import { getModeEconomyDefinition } from '../../config/economy'
import { getInfrastructureDefinition } from '../../config/projects'
import { getRollingStockDefinition } from '../../config/rollingStock'
import { applyMunicipalitySubsidy, applyTemporaryServiceCost } from '../economy'
import { departuresForMission, scheduleDayType } from '../timetable'

import type { GameEconomyState } from '../../types/economy'
import type { GameOperationsState } from '../../types/operations'
import type { GameSimulationDayReport } from '../../types/simulation'
import type {
  GameLocalEvent,
  GameLocalEventServiceKind,
  GameMunicipalitiesState,
  GameMunicipalityRelation,
  GameMunicipalityRequest,
  GameMunicipalityRequestKind,
  GameUrbanProject,
  GameUrbanProjectKind,
} from '../../types/municipalities'
import type {
  GameLine,
  GameNetworkState,
  GameServiceLevel,
  GameTransportMode,
} from '../../types/network'
import type {
  GameMunicipality,
  GameMunicipalityCoverage,
  GameNetworkTerritorySummary,
} from '../../types/territory'

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundMoney(value: number) {
  return Math.round(value / 100_000) * 100_000
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const SERVICE_LEVELS: GameServiceLevel[] = ['REDUCED', 'STANDARD', 'FREQUENT', 'INTENSIVE']
function serviceLevelRank(level: GameServiceLevel | undefined) {
  return Math.max(0, SERVICE_LEVELS.indexOf(level ?? 'STANDARD'))
}
function nextServiceLevel(level: GameServiceLevel | undefined): GameServiceLevel {
  const rank = serviceLevelRank(level)
  return SERVICE_LEVELS[Math.min(SERVICE_LEVELS.length - 1, rank + 1)] ?? 'FREQUENT'
}

export function createEmptyMunicipalitiesState(): GameMunicipalitiesState {
  return { relations: [], requests: [], totalSubsidiesReceived: 0, development: [], urbanProjects: [], localEvents: [], nextUrbanProjectDay: 9, nextLocalEventDay: 14 }
}

function ensureRelation(
  state: GameMunicipalitiesState,
  municipality: Pick<GameMunicipalityCoverage, 'code' | 'name' | 'departmentCode'>,
): GameMunicipalityRelation {
  const existing = state.relations.find(relation => relation.code === municipality.code)
  if (existing) {
    existing.name = municipality.name
    existing.departmentCode = municipality.departmentCode
    existing.acceptedRequests ??= 0
    existing.negotiatedRequests ??= 0
    existing.totalFundingGranted ??= 0
    return existing
  }

  const relation: GameMunicipalityRelation = {
    code: municipality.code,
    name: municipality.name,
    departmentCode: municipality.departmentCode,
    score: GAME_MUNICIPALITY_INITIAL_RELATION,
    completedRequests: 0,
    acceptedRequests: 0,
    negotiatedRequests: 0,
    refusedRequests: 0,
    failedRequests: 0,
    totalFundingGranted: 0,
    lastResolvedDay: null,
  }
  state.relations.push(relation)
  return relation
}

function requestMunicipality(request: GameMunicipalityRequest) {
  return { code: request.municipalityCode, name: request.municipalityName, departmentCode: request.departmentCode }
}

function adjustRelation(relation: GameMunicipalityRelation, delta: number) {
  relation.score = clamp(Math.round(relation.score + delta), GAME_MUNICIPALITY_RELATION_MIN, GAME_MUNICIPALITY_RELATION_MAX)
}

function typicalProjectCost(kind: GameMunicipalityRequestKind, mode: GameTransportMode) {
  if (kind === 'BOOST_SERVICE') {
    const rolling = getRollingStockDefinition(mode)
    return rolling.purchaseCost * (mode === 'BUS' || mode === 'BRT' ? 4 : 2)
  }
  const economy = getModeEconomyDefinition(mode)
  const infrastructure = getInfrastructureDefinition(mode, 'AUTO')
  if (kind === 'ADD_LINE') {
    return 8 * economy.infrastructurePerKm * infrastructure.constructionCostMultiplier + 8 * economy.stationCost
  }
  return economy.stationCost + 1.5 * economy.infrastructurePerKm * infrastructure.constructionCostMultiplier
}

function subsidyLimits(kind: GameMunicipalityRequestKind, mode: GameTransportMode) {
  const limits = GAME_MUNICIPALITY_MODE_SUBSIDY_LIMITS[mode]
  if (kind === 'ADD_LINE') return { min: limits.lineMin, max: limits.lineMax }
  if (kind === 'BOOST_SERVICE') return { min: limits.serviceMin, max: limits.serviceMax }
  return { min: limits.stationMin, max: limits.stationMax }
}

function calculateSubsidy(
  kind: GameMunicipalityRequestKind,
  population: number,
  relationScore: number,
  mode: GameTransportMode,
  eligibleProjectCost = typicalProjectCost(kind, mode),
  negotiationMultiplier = 1,
) {
  const populationBonus = Math.min(0.08, Math.max(0, population) / 500_000 * 0.08)
  const relationAdjustment = (clamp(relationScore, 0, 100) - 50) * 0.001
  const fundingShare = clamp(GAME_MUNICIPALITY_REQUEST_FUNDING_SHARE[kind] + populationBonus + relationAdjustment, 0.22, 0.52)
  const negotiatedShare = clamp(fundingShare * clamp(negotiationMultiplier, 0.6, 1.5), 0.18, 0.60)
  const { min, max } = subsidyLimits(kind, mode)
  const cost = Math.max(1_000_000, eligibleProjectCost)
  return roundMoney(Math.min(clamp(cost * negotiatedShare, min, max), cost * 0.62))
}

function fallbackReferenceMode(population: number): GameTransportMode {
  if (population >= 220_000) return 'RER'
  if (population >= 100_000) return 'TRAM'
  if (population >= 45_000) return 'BRT'
  return 'BUS'
}

function lineCoveragesForMunicipality(territory: GameNetworkTerritorySummary, municipalityCode: string) {
  return territory.lines.filter(line => line.municipalities.some(item => item.code === municipalityCode))
}

function candidateLinesForMunicipality(
  municipalityCode: string,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
) {
  return lineCoveragesForMunicipality(territory, municipalityCode)
    .map(coverage => network.lines.find(line => line.id === coverage.lineId))
    .filter((line): line is GameLine => Boolean(line))
}

function chooseRequestKind(
  municipality: GameMunicipalityCoverage,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
  avoidedKinds = new Set<GameMunicipalityRequestKind>(),
): GameMunicipalityRequestKind | null {
  // V50 : une demande « mettre une gare » n'a de sens que si la commune
  // n'est pas encore desservie. Une commune possédant déjà une station
  // demande ensuite une nouvelle desserte/ligne ou davantage de service.
  if (municipality.stationCount <= 0) {
    return avoidedKinds.has('ADD_STATION') ? null : 'ADD_STATION'
  }

  const lines = candidateLinesForMunicipality(municipality.code, territory, network)
  const hasUpgradeableService = lines.some(
    line => serviceLevelRank(line.serviceLevel) < serviceLevelRank('INTENSIVE'),
  )
  const candidates: GameMunicipalityRequestKind[] = []
  if (hasUpgradeableService && !avoidedKinds.has('BOOST_SERVICE')) candidates.push('BOOST_SERVICE')
  if (!avoidedKinds.has('ADD_LINE')) candidates.push('ADD_LINE')
  if (candidates.length === 0) return null

  const selector = hashString(
    `${municipality.code}:${day}:${municipality.stationCount}:${municipality.lineCount}`,
  ) % candidates.length
  return candidates[selector] ?? candidates[0] ?? null
}

function chooseTargetLine(
  municipalityCode: string,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
) {
  return candidateLinesForMunicipality(municipalityCode, territory, network)
    .slice()
    .sort((first, second) => serviceLevelRank(first.serviceLevel) - serviceLevelRank(second.serviceLevel) || first.vehicleCount - second.vehicleCount)[0]
}

function chooseReferenceMode(
  kind: GameMunicipalityRequestKind,
  municipality: GameMunicipalityCoverage,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
) {
  const target = chooseTargetLine(municipality.code, territory, network)
  if ((kind === 'ADD_STATION' || kind === 'BOOST_SERVICE') && target) return target.mode
  return fallbackReferenceMode(municipality.population)
}

function createRequest(
  municipality: GameMunicipalityCoverage,
  relation: GameMunicipalityRelation,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
  avoidedKinds = new Set<GameMunicipalityRequestKind>(),
): GameMunicipalityRequest | null {
  const kind = chooseRequestKind(municipality, territory, network, day, avoidedKinds)
  if (!kind) return null
  const targetLine = kind === 'BOOST_SERVICE' ? chooseTargetLine(municipality.code, territory, network) : undefined
  // Si aucun service existant n'est renforçable, on demande une nouvelle ligne,
  // jamais une « nouvelle gare » dans une commune déjà desservie.
  const safeKind: GameMunicipalityRequestKind = kind === 'BOOST_SERVICE' && !targetLine
    ? (municipality.stationCount > 0 ? 'ADD_LINE' : 'ADD_STATION')
    : kind
  const referenceMode = chooseReferenceMode(safeKind, municipality, territory, network)
  const initialCoverages = lineCoveragesForMunicipality(territory, municipality.code)
  const initialLineIds = initialCoverages.map(line => line.lineId)
  const initialLineStationCounts = Object.fromEntries(initialCoverages.map(line => [line.lineId, line.municipalities.find(item => item.code === municipality.code)?.stationCount ?? 0]))
  const initialLineConstructionCosts = Object.fromEntries(initialLineIds.map(lineId => [lineId, Math.max(0, network.lines.find(item => item.id === lineId)?.constructionCost ?? 0)]))
  const projectCost = safeKind === 'BOOST_SERVICE' && targetLine
    ? Math.max(typicalProjectCost('BOOST_SERVICE', targetLine.mode), getRollingStockDefinition(targetLine.mode).purchaseCost * 2)
    : typicalProjectCost(safeKind, referenceMode)
  const subsidyAmount = calculateSubsidy(safeKind, municipality.population, relation.score, referenceMode, projectCost)

  return {
    id: createId(), municipalityCode: municipality.code, municipalityName: municipality.name,
    departmentCode: municipality.departmentCode, population: municipality.population, kind: safeKind,
    status: 'PENDING', createdDay: day, decisionDeadlineDay: day + GAME_MUNICIPALITY_DECISION_DAYS,
    completionDeadlineDay: null, resolvedDay: null,
    initialStationCount: municipality.stationCount, initialLineCount: municipality.lineCount,
    targetStationCount: safeKind === 'ADD_STATION' ? municipality.stationCount + 1 : null,
    targetLineCount: safeKind === 'ADD_LINE' ? municipality.lineCount + 1 : null,
    targetLineId: targetLine?.id, targetLineName: targetLine?.name,
    initialServiceLevel: targetLine?.serviceLevel,
    targetServiceLevel: targetLine ? nextServiceLevel(targetLine.serviceLevel) : undefined,
    initialVehicleCount: targetLine?.vehicleCount,
    subsidyAmount, originalSubsidyAmount: subsidyAmount, referenceMode,
    negotiatedFundingMultiplier: 1, initialLineIds, initialLineStationCounts, initialLineConstructionCosts,
    negotiationCount: 0, negotiationStatus: 'NONE',
  }
}

function closePendingRequest(request: GameMunicipalityRequest, relation: GameMunicipalityRelation, day: number) {
  request.status = 'EXPIRED'
  request.resolvedDay = day
  relation.lastResolvedDay = day
  adjustRelation(relation, GAME_MUNICIPALITY_RELATION_EXPIRED_DELTA)
}

function isOpenRequest(request: GameMunicipalityRequest) {
  return request.status === 'PENDING' || request.status === 'ACCEPTED'
}

export function trimMunicipalityRequestHistory(state: GameMunicipalitiesState) {
  const resolvedToKeep = new Set(
    state.requests
      .filter(request => !isOpenRequest(request))
      .slice()
      .sort((first, second) =>
        (second.resolvedDay ?? second.createdDay) - (first.resolvedDay ?? first.createdDay),
      )
      .slice(0, GAME_MUNICIPALITY_REQUEST_HISTORY_LIMIT)
      .map(request => request.id),
  )
  const before = state.requests.length
  state.requests = state.requests.filter(request => isOpenRequest(request) || resolvedToKeep.has(request.id))
  return state.requests.length !== before
}

function latestResolvedRequestForMunicipality(
  state: GameMunicipalitiesState,
  municipalityCode: string,
) {
  return state.requests
    .filter(request => request.municipalityCode === municipalityCode && !isOpenRequest(request))
    .slice()
    .sort((a, b) => (b.resolvedDay ?? b.createdDay) - (a.resolvedDay ?? a.createdDay))[0] ?? null
}

function recentlyRefusedKinds(
  state: GameMunicipalitiesState,
  municipalityCode: string,
  day: number,
) {
  return new Set<GameMunicipalityRequestKind>(
    state.requests
      .filter(request => request.municipalityCode === municipalityCode)
      .filter(request => request.status === 'REFUSED')
      .filter(request => request.resolvedDay !== null && day - request.resolvedDay < GAME_MUNICIPALITY_REPEAT_REFUSAL_KIND_DAYS)
      .map(request => request.kind),
  )
}

function repairIncoherentPendingRequests(
  state: GameMunicipalitiesState,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
) {
  let changed = false
  for (let index = 0; index < state.requests.length; index += 1) {
    const request = state.requests[index]!
    if (request.status !== 'PENDING' || request.kind !== 'ADD_STATION') continue
    const municipality = territory.municipalities.find(item => item.code === request.municipalityCode)
    if (!municipality || municipality.stationCount <= 0) continue

    const relation = ensureRelation(state, municipality)
    const replacement = createRequest(
      municipality,
      relation,
      territory,
      network,
      day,
      new Set<GameMunicipalityRequestKind>(['ADD_STATION']),
    )
    if (replacement) state.requests[index] = replacement
    else {
      // Fermeture neutre : le joueur n'a rien raté, c'était la demande qui était incohérente.
      request.status = 'EXPIRED'
      request.resolvedDay = day
    }
    changed = true
  }
  return changed
}

export function syncMunicipalityRequests(
  state: GameMunicipalitiesState,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
) {
  let changed = false
  for (const municipality of territory.municipalities) ensureRelation(state, municipality)

  if (repairIncoherentPendingRequests(state, territory, network, day)) changed = true

  for (const request of state.requests) {
    if (request.status !== 'PENDING' || day <= request.decisionDeadlineDay) continue
    const relation = ensureRelation(state, requestMunicipality(request))
    closePendingRequest(request, relation, day)
    changed = true
  }

  if (trimMunicipalityRequestHistory(state)) changed = true

  let openCount = state.requests.filter(isOpenRequest).length
  if (openCount >= GAME_MUNICIPALITY_MAX_OPEN_REQUESTS) return changed

  const candidates = [...territory.municipalities].sort((first, second) => {
    const firstRelation = ensureRelation(state, first)
    const secondRelation = ensureRelation(state, second)
    const firstNeed = first.population / Math.max(1, first.stationCount) + (100 - firstRelation.score) * 120
    const secondNeed = second.population / Math.max(1, second.stationCount) + (100 - secondRelation.score) * 120
    return secondNeed - firstNeed || first.code.localeCompare(second.code)
  })

  for (const municipality of candidates) {
    if (openCount >= GAME_MUNICIPALITY_MAX_OPEN_REQUESTS) break
    const relation = ensureRelation(state, municipality)
    if (state.requests.some(request => request.municipalityCode === municipality.code && isOpenRequest(request))) continue

    const latestResolved = latestResolvedRequestForMunicipality(state, municipality.code)
    const latestResolvedDay = latestResolved?.resolvedDay ?? relation.lastResolvedDay
    const cooldownDays = latestResolved?.status === 'REFUSED'
      ? GAME_MUNICIPALITY_REFUSAL_COOLDOWN_DAYS
      : GAME_MUNICIPALITY_REQUEST_COOLDOWN_DAYS
    if (latestResolvedDay !== null && latestResolvedDay !== undefined && day - latestResolvedDay < cooldownDays) continue

    const request = createRequest(
      municipality,
      relation,
      territory,
      network,
      day,
      recentlyRefusedKinds(state, municipality.code, day),
    )
    if (!request) continue
    state.requests.push(request)
    openCount += 1
    changed = true
  }
  return changed
}


function developmentEntry(
  state: GameMunicipalitiesState,
  municipality: GameMunicipality,
  day: number,
) {
  state.development ??= []
  let entry = state.development.find(item => item.code === municipality.code)
  if (!entry) {
    const population = Math.max(0, Math.round(municipality.population))
    entry = {
      code: municipality.code,
      basePopulation: population,
      population,
      accessibility: 0,
      lastPopulationDelta: 0,
      lastMilestoneDay: null,
      milestoneLevel: 0,
      lastUpdatedDay: Math.max(1, day - 1),
    }
    state.development.push(entry)
  }
  return entry
}

function municipalityAccessibility(
  municipalityCode: string,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
) {
  const coverage = territory.municipalities.find(item => item.code === municipalityCode)
  if (!coverage) return 8

  const lineIds = territory.lines
    .filter(line => line.municipalities.some(item => item.code === municipalityCode))
    .map(line => line.lineId)
  const lines = lineIds
    .map(id => network.lines.find(line => line.id === id))
    .filter((line): line is GameLine => Boolean(line))

  const heavyModes = new Set<GameTransportMode>(['RER', 'TRAIN', 'METRO'])
  const heavyCount = lines.filter(line => heavyModes.has(line.mode)).length
  const frequentCount = lines.filter(line => serviceLevelRank(line.serviceLevel) >= serviceLevelRank('FREQUENT')).length

  return clamp(
    18
      + Math.min(34, coverage.stationCount * 8)
      + Math.min(28, coverage.lineCount * 10)
      + Math.min(12, heavyCount * 6)
      + Math.min(8, frequentCount * 4),
    0,
    100,
  )
}

/**
 * Métropole 2.0 : première couche de monde évolutif.
 * La population évolue lentement selon l'accessibilité réellement produite par
 * le réseau. Le but est de faire réagir le territoire sans transformer une
 * commune en mégapole en quelques semaines de jeu.
 */
export function advanceMunicipalityDevelopment(
  state: GameMunicipalitiesState,
  municipalities: GameMunicipality[],
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
) {
  state.development ??= []
  const validCodes = new Set(municipalities.map(item => item.code))
  state.development = state.development.filter(item => validCodes.has(item.code))

  let changed = false
  let totalPopulationDelta = 0
  const milestones: Array<{ municipalityCode: string; population: number; deltaSinceBase: number }> = []

  for (const municipality of municipalities) {
    const entry = developmentEntry(state, municipality, day)
    if (entry.lastUpdatedDay >= day) continue

    const accessibility = municipalityAccessibility(municipality.code, territory, network)
    const served = territory.municipalities.some(item => item.code === municipality.code)
    const sizeDamping = entry.population >= 500_000 ? 0.72 : entry.population >= 200_000 ? 0.82 : entry.population >= 80_000 ? 0.92 : 1
    const baseAnnualRate = served ? 0.006 : 0.0035
    const accessAnnualBonus = served ? Math.max(0, accessibility - 28) / 72 * 0.034 * sizeDamping : 0
    const annualRate = clamp(baseAnnualRate + accessAnnualBonus, 0.002, 0.045)
    const daysElapsed = Math.max(1, day - Math.max(0, entry.lastUpdatedDay))
    const exactDelta = entry.population * (Math.pow(1 + annualRate, daysElapsed / 365) - 1)
    const delta = Math.max(0, Math.round(exactDelta))

    entry.accessibility = Math.round(accessibility)
    entry.lastPopulationDelta = delta
    entry.lastUpdatedDay = day
    if (delta > 0) {
      entry.population += delta
      totalPopulationDelta += delta
      changed = true
    }

    const growthRatio = entry.basePopulation > 0
      ? Math.max(0, entry.population / entry.basePopulation - 1)
      : 0
    const reachedLevel = Math.floor(growthRatio / 0.02)
    if (reachedLevel > entry.milestoneLevel) {
      entry.milestoneLevel = reachedLevel
      entry.lastMilestoneDay = day
      milestones.push({
        municipalityCode: municipality.code,
        population: entry.population,
        deltaSinceBase: Math.max(0, entry.population - entry.basePopulation),
      })
      changed = true
    }
  }

  return { changed, totalPopulationDelta, milestones }
}


const URBAN_PROJECT_KINDS: GameUrbanProjectKind[] = ['RESIDENTIAL_DISTRICT', 'BUSINESS_DISTRICT', 'CAMPUS', 'LEISURE_HUB']

function deterministicUnit(seed: string) {
  return hashString(seed) / 0xFFFFFFFF
}

function deterministicRange(seed: string, min: number, max: number) {
  if (max <= min) return min
  return min + Math.floor(deterministicUnit(seed) * (max - min + 1))
}

function urbanProjectTitle(kind: GameUrbanProjectKind, municipalityName: string) {
  if (kind === 'RESIDENTIAL_DISTRICT') return `Nouveau quartier à ${municipalityName}`
  if (kind === 'BUSINESS_DISTRICT') return `Nouveau pôle d’emplois à ${municipalityName}`
  if (kind === 'CAMPUS') return `Nouveau campus à ${municipalityName}`
  return `Nouveau pôle de loisirs à ${municipalityName}`
}

function localEventTitle(kind: GameLocalEvent['kind'], municipalityName: string) {
  if (kind === 'CONCERT') return `Grand concert à ${municipalityName}`
  if (kind === 'FOOTBALL') return `Match à forte affluence à ${municipalityName}`
  if (kind === 'FESTIVAL') return `Festival à ${municipalityName}`
  return `Salon majeur à ${municipalityName}`
}

function localEventServiceLabel(kind: GameLocalEventServiceKind) {
  if (kind === 'EVENT_SHUTTLE') return 'Navette événementielle'
  if (kind === 'LATE_SERVICE') return 'Service tardif'
  return 'Renfort de ligne'
}

function roundEventServiceCost(value: number) {
  return Math.max(20_000, Math.round(value / 10_000) * 10_000)
}

export function estimateLocalEventServiceCost(
  event: Pick<GameLocalEvent, 'expectedVisitors'>,
  line: Pick<GameLine, 'mode'>,
  serviceKind: GameLocalEventServiceKind,
  level: 'LIGHT' | 'STRONG',
) {
  const intensity = level === 'STRONG' ? 1.65 : 1
  // Les services temporaires sont exclusivement routiers (BUS). Le paramètre
  // line reste utilisé pour garder une API cohérente avec les appels existants.
  const modeFactor = line.mode === 'BUS' ? 0.88 : 1
  const base = serviceKind === 'EVENT_SHUTTLE'
    ? 55_000
    : serviceKind === 'LATE_SERVICE'
      ? 35_000
      : 25_000
  const perVisitor = serviceKind === 'EVENT_SHUTTLE' ? 0.9 : serviceKind === 'LATE_SERVICE' ? 0.55 : 0.45
  return roundEventServiceCost((base + Math.max(0, event.expectedVisitors) * perVisitor) * intensity * modeFactor)
}

function localEventTripPlan(
  event: GameLocalEvent,
  serviceKind: GameLocalEventServiceKind,
  level: 'LIGHT' | 'STRONG',
) {
  if (serviceKind === 'EVENT_SHUTTLE') {
    return {
      targetCount: level === 'STRONG' ? 9 : 5,
      centerMinute: event.kind === 'FOOTBALL' || event.kind === 'CONCERT' ? 17 * 60 + 30 : 13 * 60 + 30,
      spacing: level === 'STRONG' ? 14 : 22,
    }
  }
  if (serviceKind === 'LATE_SERVICE') {
    return {
      targetCount: level === 'STRONG' ? 5 : 3,
      centerMinute: 22 * 60 + 30,
      spacing: level === 'STRONG' ? 18 : 28,
    }
  }
  return {
    targetCount: level === 'STRONG' ? 6 : 3,
    centerMinute: event.kind === 'FOOTBALL' || event.kind === 'CONCERT' ? 18 * 60 : 14 * 60,
    spacing: level === 'STRONG' ? 20 : 35,
  }
}

function ensureWorldLifeState(state: GameMunicipalitiesState) {
  state.urbanProjects ??= []
  state.localEvents ??= []
  state.nextUrbanProjectDay = Number.isFinite(state.nextUrbanProjectDay) ? Math.max(1, Math.floor(Number(state.nextUrbanProjectDay))) : 9
  state.nextLocalEventDay = Number.isFinite(state.nextLocalEventDay) ? Math.max(1, Math.floor(Number(state.nextLocalEventDay))) : 14
}

function chooseUrbanProjectMunicipality(
  state: GameMunicipalitiesState,
  municipalities: GameMunicipality[],
  day: number,
) {
  const development = new Map((state.development ?? []).map(item => [item.code, item] as const))
  const plannedCodes = new Set((state.urbanProjects ?? []).filter(item => item.status === 'PLANNED').map(item => item.municipalityCode))
  const candidates = municipalities
    .filter(item => item.population >= 5_000 && !plannedCodes.has(item.code))
    .map(item => {
      const entry = development.get(item.code)
      const accessibility = entry?.accessibility ?? 0
      // Un bon réseau attire des projets, mais les petites communes gardent une chance.
      const base = Math.log10(Math.max(10, item.population)) * 28 + accessibility * 0.58
      const variety = deterministicUnit(`urban-project-score:${day}:${item.code}`) * 26
      return { municipality: item, score: base + variety }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
  if (!candidates.length) return null
  return candidates[deterministicRange(`urban-project-pick:${day}`, 0, candidates.length - 1)]?.municipality ?? null
}

function createUrbanProject(state: GameMunicipalitiesState, municipalities: GameMunicipality[], day: number) {
  const municipality = chooseUrbanProjectMunicipality(state, municipalities, day)
  if (!municipality) return null
  const kind = URBAN_PROJECT_KINDS[deterministicRange(`urban-project-kind:${day}:${municipality.code}`, 0, URBAN_PROJECT_KINDS.length - 1)] ?? 'RESIDENTIAL_DISTRICT'
  const basePopulation = Math.max(1, municipality.population)
  const ratio = 0.012 + deterministicUnit(`urban-project-ratio:${day}:${municipality.code}`) * 0.035
  let populationGain = 0
  let mobilityDemandBonus = 0.04
  if (kind === 'RESIDENTIAL_DISTRICT') {
    populationGain = clamp(Math.round(basePopulation * ratio), 900, 18_000)
    mobilityDemandBonus = 0.05
  }
  else if (kind === 'BUSINESS_DISTRICT') {
    populationGain = clamp(Math.round(basePopulation * ratio * 0.12), 0, 2_000)
    mobilityDemandBonus = 0.13
  }
  else if (kind === 'CAMPUS') {
    populationGain = clamp(Math.round(basePopulation * ratio * 0.18), 0, 3_000)
    mobilityDemandBonus = 0.10
  }
  else {
    populationGain = 0
    mobilityDemandBonus = 0.08
  }
  const openingDay = day + deterministicRange(`urban-project-lead:${day}:${municipality.code}`, 24, 70)
  const leadDays = Math.max(1, openingDay - day)
  const constructionStartDay = day + Math.max(5, Math.round(leadDays * 0.42))
  const maturityDay = openingDay + deterministicRange(`urban-project-maturity:${day}:${municipality.code}`, 18, 42)
  const project: GameUrbanProject = {
    id: `urban-${day}-${municipality.code}-${hashString(`${kind}:${openingDay}`).toString(36)}`,
    municipalityCode: municipality.code,
    municipalityName: municipality.name,
    kind,
    title: urbanProjectTitle(kind, municipality.name),
    createdDay: day,
    openingDay,
    constructionStartDay,
    maturityDay,
    status: 'PLANNED',
    populationGain,
    mobilityDemandBonus,
    openedDay: null,
    maturedDay: null,
  }
  state.urbanProjects!.push(project)
  state.nextUrbanProjectDay = day + deterministicRange(`urban-project-next:${day}`, 16, 30)
  return project
}

function chooseLocalEventMunicipality(
  state: GameMunicipalitiesState,
  municipalities: GameMunicipality[],
  territory: GameNetworkTerritorySummary,
  day: number,
) {
  const served = new Map(territory.municipalities.map(item => [item.code, item] as const))
  const candidates = municipalities
    .filter(item => served.has(item.code) && item.population >= 12_000)
    .map(item => {
      const coverage = served.get(item.code)!
      return {
        municipality: item,
        score: Math.log10(Math.max(10, item.population)) * 24 + coverage.lineCount * 9 + coverage.stationCount * 4 + deterministicUnit(`local-event-score:${day}:${item.code}`) * 24,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
  if (!candidates.length) return null
  return candidates[deterministicRange(`local-event-pick:${day}`, 0, candidates.length - 1)]?.municipality ?? null
}

function createLocalEvent(
  state: GameMunicipalitiesState,
  municipalities: GameMunicipality[],
  territory: GameNetworkTerritorySummary,
  day: number,
) {
  const municipality = chooseLocalEventMunicipality(state, municipalities, territory, day)
  if (!municipality) return null
  const kinds: GameLocalEvent['kind'][] = ['CONCERT', 'FOOTBALL', 'FESTIVAL', 'EXHIBITION']
  const kind = kinds[deterministicRange(`local-event-kind:${day}:${municipality.code}`, 0, kinds.length - 1)] ?? 'CONCERT'
  const startsDay = day + deterministicRange(`local-event-start:${day}:${municipality.code}`, 3, 7)
  const duration = kind === 'FESTIVAL' || kind === 'EXHIBITION' ? 2 : 1
  const population = Math.max(1, municipality.population)
  const eventRoll = deterministicUnit(`local-event-scale:${day}:${municipality.code}`)
  const scale = eventRoll > 0.90 && population >= 80_000 ? 'MEGA' : eventRoll > 0.52 ? 'MAJOR' : 'LOCAL'
  const scaleFactor = scale === 'MEGA' ? 1.65 : scale === 'MAJOR' ? 1.15 : 0.72
  const expectedVisitors = clamp(
    Math.round(population * (0.035 + deterministicUnit(`local-event-visitors:${day}:${municipality.code}`) * 0.12) * scaleFactor),
    scale === 'MEGA' ? 28_000 : scale === 'MAJOR' ? 10_000 : 3_000,
    scale === 'MEGA' ? 140_000 : scale === 'MAJOR' ? 90_000 : 38_000,
  )
  const demandMultiplier = 1 + Math.min(scale === 'MEGA' ? 0.58 : 0.42, Math.max(0.07, expectedVisitors / Math.max(20_000, population) * 0.55))
  const event: GameLocalEvent = {
    id: `local-event-${day}-${municipality.code}-${hashString(`${kind}:${startsDay}`).toString(36)}`,
    municipalityCode: municipality.code,
    municipalityName: municipality.name,
    kind,
    title: localEventTitle(kind, municipality.name),
    createdDay: day,
    startsDay,
    endsDay: startsDay + duration - 1,
    expectedVisitors,
    scale,
    demandMultiplier,
    status: 'ANNOUNCED',
  }
  state.localEvents!.push(event)
  state.nextLocalEventDay = day + deterministicRange(`local-event-next:${day}`, 12, 22)
  return event
}

function resolveLocalEventOutcome(
  event: GameLocalEvent,
  territory: GameNetworkTerritorySummary,
  previousReport: GameSimulationDayReport | undefined,
  resolvedDay: number,
) {
  if (event.outcome) return event.outcome
  const coverage = territory.municipalities.find(item => item.code === event.municipalityCode)
  const impactedLineIds = new Set(
    territory.lines
      .filter(line => line.municipalities.some(municipality => municipality.code === event.municipalityCode))
      .map(line => line.lineId),
  )
  const lineReports = (previousReport?.lines ?? []).filter(line => impactedLineIds.has(line.lineId))
  const weightOf = (line: GameSimulationDayReport['lines'][number]) => Math.max(1, line.boardingDemandPassengers || line.passengers || 1)
  const weightTotal = lineReports.reduce((sum, line) => sum + weightOf(line), 0)
  const satisfaction = weightTotal > 0
    ? lineReports.reduce((sum, line) => sum + Math.max(0, Math.min(1, line.demandSatisfactionRate ?? 0)) * weightOf(line), 0) / weightTotal
    : 0.62
  const quality = weightTotal > 0
    ? lineReports.reduce((sum, line) => sum + Math.max(0, Math.min(100, line.serviceQualityScore ?? 70)) * weightOf(line), 0) / weightTotal / 100
    : 0.68
  const networkBase = clamp(
    0.38 + Math.min(0.20, (coverage?.lineCount ?? 0) * 0.055) + Math.min(0.14, (coverage?.stationCount ?? 0) * 0.025),
    0.38,
    0.72,
  )
  const preparedReport = event.preparedLineId
    ? lineReports.find(line => line.lineId === event.preparedLineId)
    : undefined
  const basePreparationBonus = event.preparationLevel === 'STRONG' ? 0.16 : event.preparationLevel === 'LIGHT' ? 0.09 : 0
  const serviceKindBonus = event.serviceKind === 'EVENT_SHUTTLE'
    ? (event.preparationLevel === 'STRONG' ? 0.07 : 0.04)
    : event.serviceKind === 'LATE_SERVICE'
      ? (event.preparationLevel === 'STRONG' ? 0.025 : 0.015)
      : 0
  const preparationBonus = basePreparationBonus + serviceKindBonus
  const realizedBoost = preparedReport
    ? Math.min(0.06, Math.max(0, (preparedReport.extraTrips ?? 0) / 12) * 0.06 + Math.max(0, (preparedReport.serviceFulfillmentRate ?? 1) - 0.9) * 0.06)
    : 0
  const servedShare = clamp(networkBase * 0.26 + satisfaction * 0.46 + quality * 0.28 + preparationBonus + realizedBoost, 0.30, 0.98)
  const transportedVisitors = Math.min(event.expectedVisitors, Math.round(event.expectedVisitors * servedShare))
  const leftBehindVisitors = Math.max(0, event.expectedVisitors - transportedVisitors)
  const revenuePerPassenger = weightTotal > 0
    ? lineReports.reduce((sum, line) => {
      const fallback = line.passengers > 0 ? line.revenue / Math.max(1, line.passengers) : 2.2
      return sum + Math.max(0.5, line.averageRevenuePerPassenger ?? fallback) * weightOf(line)
    }, 0) / weightTotal
    : 2.2
  const extraRevenue = Math.max(0, Math.round((transportedVisitors * revenuePerPassenger) / 1_000) * 1_000)
  const serviceScore = Math.round(servedShare * 100)
  const tone = serviceScore >= 86 ? 'SUCCESS' : serviceScore >= 66 ? 'BALANCED' : 'OVERLOADED'
  const serviceCost = Math.max(0, Math.round(event.serviceCost ?? 0))
  const netImpact = extraRevenue - serviceCost
  event.outcome = { resolvedDay, transportedVisitors, leftBehindVisitors, serviceScore, extraRevenue, serviceCost, netImpact, tone }
  return event.outcome
}

/**
 * Métropole 2.0 — monde vivant 2.0.
 * Les projets urbains apparaissent, ouvrent réellement et changent la population.
 * Les événements localisés génèrent un pic de demande uniquement autour de la commune concernée.
 */
export function advanceMunicipalityWorldLife(
  state: GameMunicipalitiesState,
  municipalities: GameMunicipality[],
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
  previousReport?: GameSimulationDayReport,
) {
  ensureWorldLifeState(state)
  let changed = false
  const constructionProjects: GameUrbanProject[] = []
  const openedProjects: GameUrbanProject[] = []
  const maturedProjects: GameUrbanProject[] = []
  const createdProjects: GameUrbanProject[] = []
  const announcedEvents: GameLocalEvent[] = []
  const startedEvents: GameLocalEvent[] = []
  const finishedEvents: GameLocalEvent[] = []

  for (const project of state.urbanProjects!) {
    if (project.status === 'PLANNED' && day >= project.constructionStartDay) {
      project.status = 'CONSTRUCTION'
      constructionProjects.push(project)
      changed = true
    }
    if ((project.status === 'PLANNED' || project.status === 'CONSTRUCTION') && day >= project.openingDay) {
      project.status = 'OPENED'
      project.openedDay ??= day
      const municipality = municipalities.find(item => item.code === project.municipalityCode)
      if (municipality) {
        const entry = developmentEntry(state, municipality, day)
        if (project.populationGain > 0) {
          entry.population += project.populationGain
          entry.lastPopulationDelta += project.populationGain
        }
        entry.lastMilestoneDay = day
      }
      openedProjects.push(project)
      changed = true
    }
    if (project.status === 'OPENED' && day >= project.maturityDay) {
      project.status = 'MATURE'
      project.maturedDay ??= day
      maturedProjects.push(project)
      changed = true
    }
  }

  for (const event of state.localEvents!) {
    const previous = event.status
    event.status = day > event.endsDay ? 'FINISHED' : day >= event.startsDay ? 'ACTIVE' : 'ANNOUNCED'
    if (event.status !== previous) {
      if (event.status === 'ACTIVE') startedEvents.push(event)
      if (event.status === 'FINISHED') {
        resolveLocalEventOutcome(event, territory, previousReport, day)
        finishedEvents.push(event)
      }
      changed = true
    }
  }

  const operationalLines = network.lines.filter(line => line.status === 'OPERATIONAL').length
  if (day >= Math.max(9, state.nextUrbanProjectDay ?? 9) && (state.urbanProjects?.filter(item => item.status === 'PLANNED' || item.status === 'CONSTRUCTION').length ?? 0) < 2) {
    const created = createUrbanProject(state, municipalities, day)
    if (created) { createdProjects.push(created); changed = true }
  }
  if (operationalLines > 0 && day >= Math.max(14, state.nextLocalEventDay ?? 14) && !(state.localEvents ?? []).some(item => item.status !== 'FINISHED')) {
    const created = createLocalEvent(state, municipalities, territory, day)
    if (created) { announcedEvents.push(created); changed = true }
  }

  state.urbanProjects = (state.urbanProjects ?? []).slice(-28)
  state.localEvents = (state.localEvents ?? []).slice(-36)

  return { changed, createdProjects, constructionProjects, openedProjects, maturedProjects, announcedEvents, startedEvents, finishedEvents }
}

export function prepareLocalEventService(
  state: GameMunicipalitiesState,
  network: GameNetworkState,
  operations: GameOperationsState,
  economy: GameEconomyState,
  territory: GameNetworkTerritorySummary,
  calendarStartDate: string,
  currentDay: number,
  eventId: string,
  lineId: string,
  serviceKind: GameLocalEventServiceKind,
  level: 'LIGHT' | 'STRONG',
) {
  ensureWorldLifeState(state)
  const event = (state.localEvents ?? []).find(item => item.id === eventId)
  if (!event || event.status === 'FINISHED') return { ok: false as const, reason: 'EVENT_UNAVAILABLE' as const, extraTrips: 0 }
  const line = network.lines.find(item => item.id === lineId && item.status === 'OPERATIONAL')
  if (!line) return { ok: false as const, reason: 'LINE_UNAVAILABLE' as const, extraTrips: 0 }
  // Phase 15.1 : un service temporaire est un service BUS uniquement.
  // Métro / RER / Train / Tramway pourront recevoir des renforts d'exploitation
  // sur infrastructure existante, mais via une mécanique distincte.
  if (line.mode !== 'BUS') return { ok: false as const, reason: 'BUS_ONLY' as const, extraTrips: 0 }
  const lineCoverage = territory.lines.find(item => item.lineId === lineId)
  if (!lineCoverage?.municipalities.some(item => item.code === event.municipalityCode)) {
    return { ok: false as const, reason: 'LINE_NOT_SERVING_EVENT' as const, extraTrips: 0 }
  }

  const targetCost = estimateLocalEventServiceCost(event, line, serviceKind, level)
  const alreadyCommitted = Math.max(0, Math.round(event.serviceCost ?? 0))
  const additionalCost = Math.max(0, targetCost - alreadyCommitted)
  if (additionalCost > 0) {
    const transaction = applyTemporaryServiceCost(
      economy,
      line,
      additionalCost,
      `${localEventServiceLabel(serviceKind)} · ${event.title}`,
    )
    if (!transaction) {
      return { ok: false as const, reason: 'INSUFFICIENT_FUNDS' as const, extraTrips: 0, serviceCost: targetCost, chargedCost: 0 }
    }
  }

  const eventPrefix = `event:${event.id}:`
  operations.extraTrips = operations.extraTrips.filter(item => !item.id.startsWith(eventPrefix))
  let extraTrips = 0
  if (line.schedule?.mode === 'TIMETABLE') {
    const enabledMissions = line.schedule.missions.filter(mission => mission.enabled && mission.routeStationIds.length >= 2)
    if (enabledMissions.length) {
      const { targetCount, centerMinute, spacing } = localEventTripPlan(event, serviceKind, level)
      for (let eventDay = Math.max(currentDay, event.startsDay); eventDay <= event.endsDay; eventDay += 1) {
        const dayType = scheduleDayType(eventDay, calendarStartDate)
        const missionPool = enabledMissions.filter(mission => departuresForMission(mission, dayType).length > 0)
        const missions = missionPool.length ? missionPool : enabledMissions
        for (let index = 0; index < targetCount; index += 1) {
          const mission = missions[index % missions.length]!
          const offset = (index - (targetCount - 1) / 2) * spacing
          const departureMinute = Math.max(0, Math.min(1439, Math.round(centerMinute + offset)))
          operations.extraTrips.push({
            id: `${eventPrefix}${eventDay}:${mission.id}:${departureMinute}:${index}`,
            lineId: line.id,
            day: eventDay,
            missionId: mission.id,
            departureMinute,
            createdAt: new Date().toISOString(),
          })
          extraTrips += 1
        }
      }
    }
  }

  event.preparedLineId = line.id
  event.preparationLevel = level
  event.serviceKind = serviceKind
  event.serviceCost = alreadyCommitted + additionalCost
  event.preparedAtDay = currentDay
  operations.history.push({
    id: `event-prep-${event.id}-${Date.now()}`,
    kind: 'REGULATION_CHANGED',
    day: currentDay,
    minute: 0,
    lineId: line.id,
    title: `${localEventServiceLabel(serviceKind)} · ${event.title}`,
    detail: line.schedule?.mode === 'TIMETABLE'
      ? `${line.name} · ${extraTrips} circulation${extraTrips > 1 ? 's' : ''} temporaire${extraTrips > 1 ? 's' : ''} · ${targetCost.toLocaleString(currentGameLocaleTag())} €`
      : `${line.name} · ${localEventServiceLabel(serviceKind)} · ${targetCost.toLocaleString(currentGameLocaleTag())} €`,
    createdAt: new Date().toISOString(),
  })
  if (operations.history.length > 240) operations.history.splice(0, operations.history.length - 240)
  return { ok: true as const, extraTrips, serviceCost: targetCost, chargedCost: additionalCost }
}

export function acceptMunicipalityRequest(state: GameMunicipalitiesState, requestId: string, day: number) {
  const request = state.requests.find(item => item.id === requestId)
  if (!request || request.status !== 'PENDING' || day > request.decisionDeadlineDay) return false
  request.status = 'ACCEPTED'
  request.completionDeadlineDay = day + GAME_MUNICIPALITY_COMPLETION_DAYS
  const relation = ensureRelation(state, requestMunicipality(request))
  relation.acceptedRequests += 1
  return true
}

export function negotiateMunicipalityRequest(state: GameMunicipalitiesState, requestId: string, requestedAmount: number, day: number) {
  const request = state.requests.find(item => item.id === requestId)
  if (!request || request.status !== 'PENDING' || day > request.decisionDeadlineDay) return { status: 'INVALID' as const }
  const relation = ensureRelation(state, requestMunicipality(request))
  request.negotiationCount = Math.max(0, request.negotiationCount ?? 0) + 1
  relation.negotiatedRequests += 1
  const original = Math.max(1, request.originalSubsidyAmount || request.subsidyAmount)
  const asked = roundMoney(Math.max(original, requestedAmount))
  const relationshipRoom = (relation.score - 50) / 600
  const historyRoom = Math.min(0.04, relation.completedRequests * 0.008)
  const maxAcceptable = original * (1.16 + relationshipRoom + historyRoom - Math.max(0, request.negotiationCount - 1) * 0.05)

  if (asked <= maxAcceptable) {
    request.subsidyAmount = asked
    request.negotiatedFundingMultiplier = clamp(asked / original, 0.6, 1.5)
    request.negotiationStatus = 'ACCEPTED'
    adjustRelation(relation, 1)
    return { status: 'ACCEPTED' as const, amount: asked }
  }
  if (request.negotiationCount >= 2 || asked > original * 1.45) {
    request.status = 'REFUSED'
    request.resolvedDay = day
    request.negotiationStatus = 'WITHDRAWN'
    relation.refusedRequests += 1
    relation.lastResolvedDay = day
    adjustRelation(relation, GAME_MUNICIPALITY_RELATION_REFUSED_DELTA - 1)
    return { status: 'WITHDRAWN' as const, amount: 0 }
  }

  const counter = roundMoney(original * clamp(1.04 + Math.max(0, relation.score - 50) / 800, 1.04, 1.10))
  request.subsidyAmount = counter
  request.negotiatedFundingMultiplier = clamp(counter / original, 0.6, 1.5)
  request.negotiationStatus = 'COUNTERED'
  adjustRelation(relation, -1)
  return { status: 'COUNTERED' as const, amount: counter }
}

export function refuseMunicipalityRequest(state: GameMunicipalitiesState, requestId: string, day: number) {
  const request = state.requests.find(item => item.id === requestId)
  if (!request || request.status !== 'PENDING') return false
  request.status = 'REFUSED'
  request.resolvedDay = day
  const relation = ensureRelation(state, requestMunicipality(request))
  relation.refusedRequests += 1
  relation.lastResolvedDay = day
  adjustRelation(relation, GAME_MUNICIPALITY_RELATION_REFUSED_DELTA)
  return true
}

function requestIsCompleted(request: GameMunicipalityRequest, municipality: GameMunicipalityCoverage | undefined, network: GameNetworkState) {
  if (!municipality) return false
  if (request.kind === 'ADD_STATION' && request.targetStationCount !== null) return municipality.stationCount >= request.targetStationCount
  if (request.kind === 'ADD_LINE' && request.targetLineCount !== null) return municipality.lineCount >= request.targetLineCount
  if (request.kind === 'BOOST_SERVICE' && request.targetLineId) {
    const line = network.lines.find(item => item.id === request.targetLineId)
    if (!line) return false
    const serviceImproved = serviceLevelRank(line.serviceLevel) >= serviceLevelRank(request.targetServiceLevel)
    const fleetImproved = line.vehicleCount >= Math.max(1, (request.initialVehicleCount ?? line.vehicleCount) + 1)
    return serviceImproved || fleetImproved
  }
  return false
}

function findFulfilledProject(request: GameMunicipalityRequest, territory: GameNetworkTerritorySummary, network: GameNetworkState) {
  const coverages = lineCoveragesForMunicipality(territory, request.municipalityCode)
  if (request.kind === 'ADD_LINE') {
    const candidates = coverages.filter(line => !request.initialLineIds.includes(line.lineId))
      .map(coverage => network.lines.find(item => item.id === coverage.lineId)).filter((line): line is GameLine => Boolean(line))
      .sort((a, b) => b.constructionCost - a.constructionCost)
    const selected = candidates[0]
    if (selected) return { mode: selected.mode, eligibleCost: Math.max(typicalProjectCost('ADD_LINE', selected.mode), selected.constructionCost || 0) }
  }
  if (request.kind === 'ADD_STATION') {
    const candidates = coverages.map(coverage => {
      const line = network.lines.find(item => item.id === coverage.lineId)
      const municipalityStationCount = coverage.municipalities.find(item => item.code === request.municipalityCode)?.stationCount ?? 0
      const initialCount = request.initialLineStationCounts[coverage.lineId] ?? 0
      const baselineCost = request.initialLineConstructionCosts[coverage.lineId] ?? 0
      return { line, municipalityStationCount, initialCount, deltaCost: Math.max(0, (line?.constructionCost ?? 0) - baselineCost) }
    }).filter(item => item.line && item.municipalityStationCount > item.initialCount).sort((a, b) => b.deltaCost - a.deltaCost)
    const selected = candidates[0]
    if (selected?.line) return { mode: selected.line.mode, eligibleCost: Math.max(typicalProjectCost('ADD_STATION', selected.line.mode), selected.deltaCost) }
  }
  if (request.kind === 'BOOST_SERVICE' && request.targetLineId) {
    const line = network.lines.find(item => item.id === request.targetLineId)
    if (line) {
      const addedVehicles = Math.max(1, line.vehicleCount - (request.initialVehicleCount ?? line.vehicleCount))
      const eligibleCost = Math.max(typicalProjectCost('BOOST_SERVICE', line.mode), getRollingStockDefinition(line.mode).purchaseCost * addedVehicles)
      return { mode: line.mode, eligibleCost }
    }
  }
  return { mode: request.referenceMode, eligibleCost: typicalProjectCost(request.kind, request.referenceMode) }
}

export function resolveMunicipalityRequestsForDay(
  state: GameMunicipalitiesState,
  economy: GameEconomyState,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
) {
  let changed = false
  let subsidyGranted = 0

  for (const request of state.requests) {
    if (request.status !== 'ACCEPTED') continue
    const municipality = territory.municipalities.find(item => item.code === request.municipalityCode)
    const relation = ensureRelation(state, requestMunicipality(request))

    if (requestIsCompleted(request, municipality, network)) {
      const fulfilled = findFulfilledProject(request, territory, network)
      const subsidy = calculateSubsidy(request.kind, request.population, relation.score, fulfilled.mode, fulfilled.eligibleCost, request.negotiatedFundingMultiplier ?? 1)
      request.fulfilledMode = fulfilled.mode
      request.eligibleProjectCost = fulfilled.eligibleCost
      request.subsidyAmount = subsidy
      request.status = 'COMPLETED'
      request.resolvedDay = day
      relation.completedRequests += 1
      relation.totalFundingGranted += subsidy
      relation.lastResolvedDay = day
      adjustRelation(relation, GAME_MUNICIPALITY_RELATION_COMPLETED_DELTA)

      const action = request.kind === 'BOOST_SERVICE' ? 'renforcement de service' : request.kind === 'ADD_LINE' ? 'nouvelle desserte' : 'extension de desserte'
      applyMunicipalitySubsidy(economy, subsidy, `${request.municipalityName} · ${action} ${fulfilled.mode} · projet éligible ${roundMoney(fulfilled.eligibleCost).toLocaleString(currentGameLocaleTag())} €`)
      state.totalSubsidiesReceived += subsidy
      subsidyGranted += subsidy
      changed = true
      continue
    }

    if (request.completionDeadlineDay !== null && day > request.completionDeadlineDay) {
      request.status = 'FAILED'
      request.resolvedDay = day
      relation.failedRequests += 1
      relation.lastResolvedDay = day
      adjustRelation(relation, GAME_MUNICIPALITY_RELATION_FAILED_DELTA)
      changed = true
    }
  }
  if (trimMunicipalityRequestHistory(state)) changed = true
  return { changed, subsidyGranted }
}
