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
  GAME_MUNICIPALITY_REQUEST_FUNDING_SHARE,
} from '../../config/municipalities'
import { getModeEconomyDefinition } from '../../config/economy'
import { getInfrastructureDefinition } from '../../config/projects'
import { getRollingStockDefinition } from '../../config/rollingStock'
import { applyMunicipalitySubsidy } from '../economy'

import type { GameEconomyState } from '../../types/economy'
import type {
  GameMunicipalitiesState,
  GameMunicipalityRelation,
  GameMunicipalityRequest,
  GameMunicipalityRequestKind,
} from '../../types/municipalities'
import type {
  GameLine,
  GameNetworkState,
  GameServiceLevel,
  GameTransportMode,
} from '../../types/network'
import type {
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
  return { relations: [], requests: [], totalSubsidiesReceived: 0 }
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
): GameMunicipalityRequestKind {
  if (municipality.stationCount <= 1) return 'ADD_STATION'
  if (municipality.lineCount <= 1) return 'ADD_LINE'
  const lines = candidateLinesForMunicipality(municipality.code, territory, network)
  const hasUpgradeableService = lines.some(line => serviceLevelRank(line.serviceLevel) < serviceLevelRank('INTENSIVE'))
  const selector = hashString(`${municipality.code}:${day}:${municipality.stationCount}:${municipality.lineCount}`) % 3
  if (hasUpgradeableService && selector === 0) return 'BOOST_SERVICE'
  return selector === 1 ? 'ADD_LINE' : 'ADD_STATION'
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
): GameMunicipalityRequest {
  const kind = chooseRequestKind(municipality, territory, network, day)
  const targetLine = kind === 'BOOST_SERVICE' ? chooseTargetLine(municipality.code, territory, network) : undefined
  const safeKind: GameMunicipalityRequestKind = kind === 'BOOST_SERVICE' && !targetLine ? 'ADD_STATION' : kind
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

export function syncMunicipalityRequests(
  state: GameMunicipalitiesState,
  territory: GameNetworkTerritorySummary,
  network: GameNetworkState,
  day: number,
) {
  let changed = false
  for (const municipality of territory.municipalities) ensureRelation(state, municipality)

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
    if (relation.lastResolvedDay !== null && day - relation.lastResolvedDay < GAME_MUNICIPALITY_REQUEST_COOLDOWN_DAYS) continue
    state.requests.push(createRequest(municipality, relation, territory, network, day))
    openCount += 1
    changed = true
  }
  return changed
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
