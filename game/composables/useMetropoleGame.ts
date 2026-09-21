import { currentGameLocaleTag } from '../config/i18n'
import { useState } from '#app'
import { computed } from 'vue'
import {
  GAME_DEFAULT_START_DATE,
  GAME_SAVE_VERSION,
} from '../config/game'
import { isoDateForGameDay } from '../config/calendar'
import { isGameServiceLevel } from '../config/operations'
import { isGameStationFacilityLevel } from '../config/stations'
import { isGameMaintenanceLevel } from '../config/maintenance'
import {
  isGameFareLevel,
  isGameFareManagementMode,
  normalizeCustomFarePolicy,
} from '../config/fares'
import { isGameTransportMode } from '../config/transportModes'
import { createEmptyEconomy } from '../engine/economy'
import { GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT, GAME_PUBLIC_DEVELOPMENT_PERIOD_DAYS } from '../config/economy'
import { createEmptyEventsState } from '../engine/events'
import { GAME_EVENT_HISTORY_LIMIT } from '../config/events'
import { GAME_OBJECTIVE_HISTORY_LIMIT } from '../config/objectives'
import { createEmptyMunicipalitiesState, trimMunicipalityRequestHistory } from '../engine/municipalities'
import {
  createEmptyNetwork,
  normalizeBadgeStyle,
  normalizeInfrastructureType,
  normalizeLineEmblem,
  normalizeServiceProfileLevel,
} from '../engine/network'
import { normalizeFleetCondition } from '../engine/maintenance'
import { normalizeControllerCount } from '../config/inspection'
import { createEmptyObjectivesState } from '../engine/objectives'
import { calculateRequiredVehiclesForService } from '../engine/rollingStock'
import { normalizeRollingStockUpgrades } from '../config/rollingStock'
import { createDefaultFreePlaySettings, normalizeFreePlaySettings } from '../config/freePlay'
import { createEmptySimulation } from '../engine/simulation'
import { GAME_SIMULATION_HISTORY_LIMIT } from '../config/simulation'
import { getGameTerritoryCatalogEntry, isGameTerritory, isGameTerritoryAvailable } from '../config/territories'
import { createStatisticsState, normalizeStatisticsState } from '../engine/statistics'
import { createEmptyRoastState, normalizeRoastState } from '../engine/roast'
import { normalizeGeneratedTerritorySettings } from '../engine/territory/generator'
import {
  assertCanCreateGameSave,
  backupGameSave,
  deleteGameSave,
  getGameSave,
  listGameSaves,
  restoreGameSaveBackup,
  saveGame,
  pruneExpiredChallengeSaves,
} from '../storage'
import {
  assertGameSaveShape,
  parseGameSaveExport,
  serializeGameSave,
} from '../storage/transfer'

import {
  challengeArchiveExpiresAt,
  createChallengeFreePlaySettings,
  createChallengeRuntime,
  expireChallengeIfNeeded,
  finalizeChallenge,
  normalizeChallengeDefinition,
} from '../engine/challenges'
import { isSaveChallenge, isSaveReadOnly } from '../utils/challengeState'
import type { GameChallengeDefinition, GameChallengeFinishReason, GameChallengeRuntime } from '../types/challenges'

import type { GameEconomyState } from '../types/economy'
import type { GameEventsState } from '../types/events'
import type { GameSave, GameSaveData, GameState, GameTerritory } from '../types/game'
import type { GameFreePlaySettings } from '../types/freePlay'
import type { GameGeneratedTerritorySettings } from '../types/generatedTerritory'
import type { GameMunicipalitiesState } from '../types/municipalities'
import type { GameObjectivesState } from '../types/objectives'
import type {
  GameLine,
  GameLineBranch,
  GameLineRouteSegment,
  GameNetworkState,
  GameStation,
} from '../types/network'
import type {
  GameLineDailySimulation,
  GameSimulationDayReport,
  GameSimulationState,
} from '../types/simulation'

function createSaveId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}

function currentLocalIsoDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeStation(station: GameStation): GameStation {
  return {
    ...station,
    name: typeof station.name === 'string' && station.name.trim()
      ? station.name.trim().slice(0, 60)
      : 'Station',
    facilityLevel: isGameStationFacilityLevel(station.facilityLevel)
      ? station.facilityLevel
      : 'STANDARD',
    sharedStationId: typeof station.sharedStationId === 'string' && station.sharedStationId.trim()
      ? station.sharedStationId
      : station.id,
  }
}

function normalizeBranch(branch: GameLineBranch): GameLineBranch | null {
  if (!branch || typeof branch.fromStationId !== 'string' || !branch.fromStationId) return null
  return {
    id: typeof branch.id === 'string' && branch.id ? branch.id : `branch-${Math.random().toString(36).slice(2)}`,
    fromStationId: branch.fromStationId,
    stations: Array.isArray(branch.stations) ? branch.stations.map(normalizeStation) : [],
  }
}


function normalizeRouteSegment(segment: GameLineRouteSegment): GameLineRouteSegment | null {
  if (!segment || typeof segment.fromStationId !== 'string' || typeof segment.toStationId !== 'string') return null
  if (!Array.isArray(segment.coordinates)) return null
  const coordinates = segment.coordinates
    .filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
    .map(point => [Number(point[0]), Number(point[1])] as [number, number])
    .slice(0, 2400)
  if (coordinates.length < 2) return null
  return {
    fromStationId: segment.fromStationId,
    toStationId: segment.toStationId,
    coordinates,
    source: segment.source === 'FREE' ? 'FREE' : 'ASSISTED',
  }
}

function normalizeLine(line: GameLine, index: number): GameLine {
  const mode = isGameTransportMode(line.mode) ? line.mode : 'METRO'
  const serviceLevel = isGameServiceLevel(line.serviceLevel) ? line.serviceLevel : 'STANDARD'
  const maintenanceLevel = isGameMaintenanceLevel(line.maintenanceLevel) ? line.maintenanceLevel : 'STANDARD'
  const stations = Array.isArray(line.stations) ? line.stations.map(normalizeStation) : []
  const branches = Array.isArray(line.branches)
    ? line.branches.map(normalizeBranch).filter((branch): branch is GameLineBranch => Boolean(branch))
    : []
  const routeSegments = Array.isArray(line.routeSegments)
    ? line.routeSegments.map(normalizeRouteSegment).filter((segment): segment is GameLineRouteSegment => Boolean(segment))
    : []
  const legacyVehicleCount = calculateRequiredVehiclesForService(
    { mode, serviceLevel, stations },
    serviceLevel,
  )
  const status = ['PROJECT', 'CONSTRUCTION', 'OPERATIONAL'].includes(String(line.status))
    ? line.status
    : stations.length >= 2
      ? 'OPERATIONAL'
      : 'PROJECT'

  return {
    ...line,
    name: typeof line.name === 'string' && line.name.trim() ? line.name.trim().slice(0, 60) : `Ligne ${index + 1}`,
    customLogoDataUrl: typeof line.customLogoDataUrl === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(line.customLogoDataUrl) && line.customLogoDataUrl.length <= 350_000
      ? line.customLogoDataUrl
      : undefined,
    shortCode: typeof line.shortCode === 'string' && line.shortCode.trim()
      ? line.shortCode.trim().slice(0, 4)
      : String(index + 1),
    badgeStyle: normalizeBadgeStyle(line.badgeStyle),
    emblem: normalizeLineEmblem(line.emblem ?? (mode === 'BRT' ? 'EXPRESS' : mode)),
    mode,
    status,
    infrastructureType: normalizeInfrastructureType(line.infrastructureType),
    routingMode: line.routingMode === 'FREE' ? 'FREE' : 'ASSISTED',
    routeSegments,
    serviceLevel,
    serviceProfileMode: line.serviceProfileMode === 'ADVANCED' ? 'ADVANCED' : 'SIMPLE',
    serviceProfile: {
      offPeak: normalizeServiceProfileLevel(line.serviceProfile?.offPeak, 'REDUCED'),
      normal: normalizeServiceProfileLevel(line.serviceProfile?.normal, serviceLevel),
      peak: normalizeServiceProfileLevel(line.serviceProfile?.peak, 'FREQUENT'),
    },
    maintenanceLevel,
    fleetCondition: normalizeFleetCondition(line.fleetCondition),
    vehicleCount: Number.isFinite(line.vehicleCount)
      ? Math.max(0, Math.floor(line.vehicleCount))
      : legacyVehicleCount,
    rollingStockUpgrades: normalizeRollingStockUpgrades(line.rollingStockUpgrades),
    regulationMode: line.regulationMode === 'MANUAL' ? 'MANUAL' : 'AUTO',
    manualBoostVehicles: Number.isFinite(line.manualBoostVehicles)
      ? Math.max(0, Math.floor(line.manualBoostVehicles))
      : 0,
    inspectionMode: line.inspectionMode === 'CUSTOM' ? 'CUSTOM' : 'AUTO',
    controllerCount: normalizeControllerCount(line.controllerCount),
    color: typeof line.color === 'string' ? line.color : '#56b4ff',
    constructionCost: Number.isFinite(line.constructionCost) ? Math.max(0, line.constructionCost) : 0,
    estimatedConstructionCost: Number.isFinite(line.estimatedConstructionCost)
      ? Math.max(0, line.estimatedConstructionCost)
      : Math.max(0, line.constructionCost ?? 0),
    constructionDaysRemaining: status === 'CONSTRUCTION' && Number.isFinite(line.constructionDaysRemaining)
      ? Math.max(1, Math.floor(line.constructionDaysRemaining))
      : 0,
    stations,
    branches,
  }
}

function normalizeNetwork(network: GameNetworkState | undefined): GameNetworkState {
  if (!network || !Array.isArray(network.lines)) return createEmptyNetwork()
  return { lines: network.lines.map((line, index) => normalizeLine(line, index)) }
}

function normalizeEconomy(economy: GameEconomyState | undefined): GameEconomyState {
  if (!economy) return createEmptyEconomy()
  const fallback = createEmptyEconomy()
  const rawMode = isGameFareManagementMode(economy.fareManagementMode)
    ? economy.fareManagementMode
    : 'GUIDED'
  const fareManagementMode = rawMode === 'CUSTOM' ? 'BY_MODE' : rawMode
  const totalSpent = Number.isFinite(economy.totalSpent) ? Math.max(0, economy.totalSpent) : 0
  const totalRevenue = Number.isFinite(economy.totalRevenue) ? Math.max(0, economy.totalRevenue) : 0
  const totalFineRevenue = Number.isFinite(economy.totalFineRevenue) ? Math.max(0, economy.totalFineRevenue) : 0

  return {
    unlimitedMoney: economy.unlimitedMoney === true,
    fareLevel: isGameFareLevel(economy.fareLevel) ? economy.fareLevel : 'STANDARD',
    fareManagementMode,
    customFarePolicy: normalizeCustomFarePolicy(economy.customFarePolicy),
    initialBudget: Number.isFinite(economy.initialBudget) ? economy.initialBudget : fallback.initialBudget,
    balance: Number.isFinite(economy.balance) ? economy.balance : fallback.balance,
    totalSpent,
    totalInvestment: Number.isFinite(economy.totalInvestment) ? Math.max(0, economy.totalInvestment) : totalSpent,
    totalRevenue,
    totalPassengerRevenue: Number.isFinite(economy.totalPassengerRevenue)
      ? Math.max(0, economy.totalPassengerRevenue)
      : Math.max(0, totalRevenue - totalFineRevenue),
    totalFineRevenue,
    totalOperatingCosts: Number.isFinite(economy.totalOperatingCosts) ? Math.max(0, economy.totalOperatingCosts) : 0,
    totalSubsidies: Number.isFinite(economy.totalSubsidies) ? Math.max(0, economy.totalSubsidies) : 0,
    totalPublicDevelopmentFunding: Number.isFinite(economy.totalPublicDevelopmentFunding) ? Math.max(0, economy.totalPublicDevelopmentFunding) : 0,
    totalObjectiveRewards: Number.isFinite(economy.totalObjectiveRewards) ? Math.max(0, economy.totalObjectiveRewards) : 0,
    publicFundingNextDay: Number.isFinite(economy.publicFundingNextDay) ? Math.max(7, Math.floor(economy.publicFundingNextDay)) : 7,
    lastPublicFundingDay: Number.isFinite(economy.lastPublicFundingDay) ? Math.max(0, Math.floor(economy.lastPublicFundingDay)) : 0,
    lastPublicFundingAmount: Number.isFinite(economy.lastPublicFundingAmount) ? Math.max(0, economy.lastPublicFundingAmount) : 0,
    lastPublicFundingBreakdown: economy.lastPublicFundingBreakdown && typeof economy.lastPublicFundingBreakdown === 'object'
      ? economy.lastPublicFundingBreakdown
      : null,
    totalCompensationPaid: Number.isFinite(economy.totalCompensationPaid) ? Math.max(0, economy.totalCompensationPaid) : 0,
    debtPrincipal: Number.isFinite(economy.debtPrincipal) ? Math.max(0, economy.debtPrincipal) : 0,
    lastBorrowDay: Number.isFinite(economy.lastBorrowDay) ? Math.max(0, Math.floor(economy.lastBorrowDay)) : 0,
    borrowCountOnLastDay: Number.isFinite(economy.borrowCountOnLastDay) ? Math.max(0, Math.min(3, Math.floor(economy.borrowCountOnLastDay))) : 0,
    totalInterestPaid: Number.isFinite(economy.totalInterestPaid) ? Math.max(0, economy.totalInterestPaid) : 0,
    debtNextPaymentDay: Number.isFinite(economy.debtNextPaymentDay) ? Math.max(0, Math.floor(economy.debtNextPaymentDay)) : 0,
    debtMinimumPayment: Number.isFinite(economy.debtMinimumPayment) ? Math.max(0, economy.debtMinimumPayment) : 0,
    debtPaidThisPeriod: Number.isFinite(economy.debtPaidThisPeriod) ? Math.max(0, economy.debtPaidThisPeriod) : 0,
    debtMissedPayments: Number.isFinite(economy.debtMissedPayments) ? Math.max(0, Math.floor(economy.debtMissedPayments)) : 0,
    totalDebtPenalties: Number.isFinite(economy.totalDebtPenalties) ? Math.max(0, economy.totalDebtPenalties) : 0,
    creditScore: Number.isFinite(economy.creditScore) ? Math.min(100, Math.max(0, economy.creditScore)) : 100,
    insolvencyStatus: ['OK','WARNING','BANKRUPT'].includes(String(economy.insolvencyStatus)) ? economy.insolvencyStatus : 'OK',
    transactions: Array.isArray(economy.transactions) ? economy.transactions.slice(-GAME_ECONOMY_TRANSACTION_HISTORY_LIMIT) : [],
  }
}

function normalizeLineReport(line: GameLineDailySimulation): GameLineDailySimulation {
  const demand = Math.max(0, Number(line.demandPassengers ?? line.passengers ?? 0))
  const passengers = Math.max(0, Number(line.passengers ?? 0))
  return {
    ...line,
    newDemandPassengers: Number.isFinite(line.newDemandPassengers) ? Math.max(0, line.newDemandPassengers) : demand,
    waitingPassengersBefore: Number.isFinite(line.waitingPassengersBefore) ? Math.max(0, line.waitingPassengersBefore) : 0,
    boardingDemandPassengers: Number.isFinite(line.boardingDemandPassengers) ? Math.max(0, line.boardingDemandPassengers) : demand,
    waitingPassengersAfter: Number.isFinite(line.waitingPassengersAfter) ? Math.max(0, line.waitingPassengersAfter) : 0,
    lostPassengers: Number.isFinite(line.lostPassengers) ? Math.max(0, line.lostPassengers) : Math.max(0, demand - passengers),
    retainedWaitingPassengers: Number.isFinite(line.retainedWaitingPassengers) ? Math.max(0, line.retainedWaitingPassengers ?? 0) : 0,
    abandonedWaitingPassengers: Number.isFinite(line.abandonedWaitingPassengers) ? Math.max(0, line.abandonedWaitingPassengers ?? 0) : 0,
    unmetDemandPassengers: Number.isFinite(line.unmetDemandPassengers)
      ? Math.max(0, line.unmetDemandPassengers ?? 0)
      : Math.max(0, (line.waitingPassengersAfter ?? 0) + (line.lostPassengers ?? 0)),
    passengerPressureScore: Number.isFinite(line.passengerPressureScore)
      ? Math.min(100, Math.max(0, line.passengerPressureScore ?? 0))
      : 0,
    diagnostics: Array.isArray(line.diagnostics) ? line.diagnostics : [],
    moraleScoreBefore: Number.isFinite(line.moraleScoreBefore) ? line.moraleScoreBefore : 76,
    moraleScoreAfter: Number.isFinite(line.moraleScoreAfter) ? line.moraleScoreAfter : line.serviceQualityScore ?? 76,
    demandSatisfactionRate: Number.isFinite(line.demandSatisfactionRate)
      ? Math.min(1, Math.max(0, line.demandSatisfactionRate))
      : (line.boardingDemandPassengers ?? demand) > 0
        ? Math.min(1, passengers / Math.max(1, line.boardingDemandPassengers ?? demand))
        : 1,
    averageWaitMinutes: Number.isFinite(line.averageWaitMinutes) ? Math.max(0, line.averageWaitMinutes) : 0,
    queuePressureRate: Number.isFinite(line.queuePressureRate) ? Math.max(0, line.queuePressureRate) : 0,
    moraleDemandMultiplier: Number.isFinite(line.moraleDemandMultiplier) ? Math.max(0, line.moraleDemandMultiplier) : 1,
    estimatedDelayMinutes: Number.isFinite(line.estimatedDelayMinutes) ? Math.max(0, line.estimatedDelayMinutes) : 0,
    effectiveTravelTimeMinutes: Number.isFinite(line.effectiveTravelTimeMinutes)
      ? Math.max(0, line.effectiveTravelTimeMinutes)
      : Math.max(0, line.estimatedTravelTimeMinutes ?? 0),
    moraleDelta: Number.isFinite(line.moraleDelta) ? line.moraleDelta : 0,
    topDemandConstraints: Array.isArray(line.topDemandConstraints) ? line.topDemandConstraints : [],
  }
}

function normalizeDayReport(
  report: GameSimulationDayReport,
  startDate: string,
): GameSimulationDayReport {
  const lines = Array.isArray(report.lines) ? report.lines.map(normalizeLineReport) : []
  return {
    ...report,
    date: typeof report.date === 'string' && report.date
      ? report.date
      : isoDateForGameDay(Math.max(1, report.day ?? 1), startDate),
    waitingPassengers: Number.isFinite(report.waitingPassengers)
      ? Math.max(0, report.waitingPassengers)
      : lines.reduce((total, line) => total + line.waitingPassengersAfter, 0),
    lostPassengers: Number.isFinite(report.lostPassengers)
      ? Math.max(0, report.lostPassengers)
      : lines.reduce((total, line) => total + line.lostPassengers, 0),
    demandSatisfactionRate: Number.isFinite(report.demandSatisfactionRate)
      ? Math.min(1, Math.max(0, report.demandSatisfactionRate))
      : 1,
    averageWaitMinutes: Number.isFinite(report.averageWaitMinutes)
      ? Math.max(0, report.averageWaitMinutes)
      : 0,
    criticalLineCount: Number.isFinite(report.criticalLineCount)
      ? Math.max(0, Math.floor(report.criticalLineCount))
      : 0,
    boardingDemandPassengers: Number.isFinite(report.boardingDemandPassengers)
      ? Math.max(0, report.boardingDemandPassengers ?? 0)
      : lines.reduce((total, line) => total + line.boardingDemandPassengers, 0),
    averageOccupancyRate: Number.isFinite(report.averageOccupancyRate)
      ? Math.max(0, report.averageOccupancyRate ?? 0)
      : 0,
    networkPressureScore: Number.isFinite(report.networkPressureScore)
      ? Math.min(100, Math.max(0, report.networkPressureScore ?? 0))
      : 0,
    lines,
  }
}

function normalizeSimulation(
  simulation: GameSimulationState | undefined,
  startDate: string,
): GameSimulationState {
  if (!simulation) return createEmptySimulation()
  return {
    totalPassengers: Number.isFinite(simulation.totalPassengers) ? Math.max(0, simulation.totalPassengers) : 0,
    totalLostPassengers: Number.isFinite(simulation.totalLostPassengers) ? Math.max(0, simulation.totalLostPassengers) : 0,
    totalRevenue: Number.isFinite(simulation.totalRevenue) ? Math.max(0, simulation.totalRevenue) : 0,
    totalOperatingCost: Number.isFinite(simulation.totalOperatingCost) ? Math.max(0, simulation.totalOperatingCost) : 0,
    totalFraudRevenueLoss: Number.isFinite(simulation.totalFraudRevenueLoss) ? Math.max(0, simulation.totalFraudRevenueLoss) : 0,
    totalFineRevenue: Number.isFinite(simulation.totalFineRevenue) ? Math.max(0, simulation.totalFineRevenue) : 0,
    totalControlCost: Number.isFinite(simulation.totalControlCost) ? Math.max(0, simulation.totalControlCost) : 0,
    lineStates: Array.isArray(simulation.lineStates) ? simulation.lineStates : [],
    history: Array.isArray(simulation.history)
      ? simulation.history.slice(-GAME_SIMULATION_HISTORY_LIMIT).map(report => normalizeDayReport(report, startDate))
      : [],
  }
}

function normalizeMunicipalities(municipalities: GameMunicipalitiesState | undefined): GameMunicipalitiesState {
  if (!municipalities) return createEmptyMunicipalitiesState()
  const normalized: GameMunicipalitiesState = {
    relations: Array.isArray(municipalities.relations) ? municipalities.relations.map(relation => ({
      ...relation,
      completedRequests: Number.isFinite(relation.completedRequests) ? Math.max(0, Math.floor(relation.completedRequests)) : 0,
      acceptedRequests: Number.isFinite(relation.acceptedRequests) ? Math.max(0, Math.floor(relation.acceptedRequests)) : 0,
      negotiatedRequests: Number.isFinite(relation.negotiatedRequests) ? Math.max(0, Math.floor(relation.negotiatedRequests)) : 0,
      refusedRequests: Number.isFinite(relation.refusedRequests) ? Math.max(0, Math.floor(relation.refusedRequests)) : 0,
      failedRequests: Number.isFinite(relation.failedRequests) ? Math.max(0, Math.floor(relation.failedRequests)) : 0,
      totalFundingGranted: Number.isFinite(relation.totalFundingGranted) ? Math.max(0, relation.totalFundingGranted) : 0,
    })) : [],
    requests: Array.isArray(municipalities.requests) ? municipalities.requests.map(request => ({
      ...request,
      originalSubsidyAmount: Number.isFinite(request.originalSubsidyAmount) ? request.originalSubsidyAmount : request.subsidyAmount,
      referenceMode: isGameTransportMode(request.referenceMode) ? request.referenceMode : 'TRAM',
      negotiatedFundingMultiplier: Number.isFinite(request.negotiatedFundingMultiplier) ? Math.min(1.5, Math.max(0.6, request.negotiatedFundingMultiplier)) : 1,
      initialLineIds: Array.isArray(request.initialLineIds) ? request.initialLineIds.filter(id => typeof id === 'string') : [],
      initialLineStationCounts: request.initialLineStationCounts && typeof request.initialLineStationCounts === 'object' ? request.initialLineStationCounts : {},
      initialLineConstructionCosts: request.initialLineConstructionCosts && typeof request.initialLineConstructionCosts === 'object' ? request.initialLineConstructionCosts : {},
      targetLineId: typeof request.targetLineId === 'string' ? request.targetLineId : undefined,
      targetLineName: typeof request.targetLineName === 'string' ? request.targetLineName : undefined,
      initialServiceLevel: isGameServiceLevel(request.initialServiceLevel) ? request.initialServiceLevel : undefined,
      targetServiceLevel: isGameServiceLevel(request.targetServiceLevel) ? request.targetServiceLevel : undefined,
      initialVehicleCount: Number.isFinite(request.initialVehicleCount) ? Math.max(0, Math.floor(Number(request.initialVehicleCount))) : undefined,
      fulfilledMode: isGameTransportMode(request.fulfilledMode) ? request.fulfilledMode : undefined,
      eligibleProjectCost: Number.isFinite(request.eligibleProjectCost) ? Math.max(0, Number(request.eligibleProjectCost)) : undefined,
      negotiationCount: Number.isFinite(request.negotiationCount) ? Math.max(0, Math.floor(request.negotiationCount)) : 0,
      negotiationStatus: ['NONE','ACCEPTED','COUNTERED','WITHDRAWN'].includes(String(request.negotiationStatus)) ? request.negotiationStatus : 'NONE',
    })) : [],
    totalSubsidiesReceived: Number.isFinite(municipalities.totalSubsidiesReceived)
      ? Math.max(0, municipalities.totalSubsidiesReceived)
      : 0,
  }
  trimMunicipalityRequestHistory(normalized)
  return normalized
}

function normalizeEvents(events: GameEventsState | undefined): GameEventsState {
  if (!events) return createEmptyEventsState()
  return {
    active: events.active ?? null,
    history: Array.isArray(events.history) ? events.history.slice(-GAME_EVENT_HISTORY_LIMIT) : [],
    modifiers: Array.isArray(events.modifiers) ? events.modifiers : [],
    nextEligibleDay: Number.isFinite(events.nextEligibleDay) ? Math.max(2, Math.floor(events.nextEligibleDay)) : 2,
    totalResolved: Number.isFinite(events.totalResolved) ? Math.max(0, Math.floor(events.totalResolved)) : 0,
    totalBalanceImpact: Number.isFinite(events.totalBalanceImpact) ? events.totalBalanceImpact : 0,
  }
}

function normalizeObjectives(objectives: GameObjectivesState | undefined): GameObjectivesState {
  if (!objectives) return createEmptyObjectivesState()
  const fallback = createEmptyObjectivesState()
  const legacyIds = Array.isArray(objectives.completedObjectiveIds)
    ? objectives.completedObjectiveIds.filter(id => typeof id === 'string')
    : []
  const rawCompleted = Array.isArray(objectives.completed)
    ? objectives.completed.filter(item => item && typeof item.id === 'string').map(item => ({
      id: item.id.slice(0, 160),
      title: typeof item.title === 'string' ? item.title.slice(0, 180) : item.id.slice(0, 180),
      completedDay: Number.isFinite(Number(item.completedDay)) ? Math.max(0, Math.floor(Number(item.completedDay))) : 0,
      reward: Number.isFinite(Number(item.reward)) ? Math.max(0, Number(item.reward)) : 0,
    }))
    : legacyIds.map(id => ({ id, title: id, completedDay: 0, reward: 0 }))
  const totalCompleted = Number.isFinite(Number(objectives.totalCompleted))
    ? Math.max(rawCompleted.length, Math.floor(Number(objectives.totalCompleted)))
    : Math.max(rawCompleted.length, legacyIds.length)
  return {
    scenarioId: typeof objectives.scenarioId === 'string' && objectives.scenarioId.length > 0
      ? objectives.scenarioId
      : fallback.scenarioId,
    completedObjectiveIds: legacyIds.slice(-GAME_OBJECTIVE_HISTORY_LIMIT),
    completedDay: null,
    active: Array.isArray(objectives.active) ? objectives.active : [],
    completed: rawCompleted.slice(-GAME_OBJECTIVE_HISTORY_LIMIT),
    totalCompleted,
    totalRewards: Number.isFinite(objectives.totalRewards) ? Math.max(0, objectives.totalRewards) : 0,
    nextObjectiveSerial: Number.isFinite(objectives.nextObjectiveSerial)
      ? Math.max(1, Math.floor(objectives.nextObjectiveSerial))
      : 1,
  }
}

export type GameSaveCompatibility = 'CURRENT' | 'OLDER' | 'FUTURE' | 'INVALID'

export function getGameSaveCompatibility(save: Pick<GameSave, 'version'> | null | undefined): GameSaveCompatibility {
  const version = Number(save?.version)
  if (!Number.isFinite(version) || version < 1) return 'INVALID'
  if (version > GAME_SAVE_VERSION) return 'FUTURE'
  if (version < GAME_SAVE_VERSION) return 'OLDER'
  return 'CURRENT'
}

function cloneSave(save: GameSave): GameSave {
  return JSON.parse(JSON.stringify(save)) as GameSave
}

function safeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'partie'
}

function normalizeSave(save: GameSave): GameSave {
  const territory: GameTerritory = isGameTerritory(save.territory) ? save.territory : 'ILE_DE_FRANCE'
  if (!isGameTerritoryAvailable(territory)) {
    throw new Error(`La carte « ${getGameTerritoryCatalogEntry(territory).label} » n'est pas encore installée dans cette version de CLU Métropole.`)
  }
  const generatedTerritory = territory === 'GENERATED'
    ? normalizeGeneratedTerritorySettings(save.data?.generatedTerritory)
    : null
  if (territory === 'GENERATED' && !generatedTerritory) {
    throw new Error('Cette sauvegarde de carte fictive ne contient pas de seed exploitable.')
  }

  const simulationDay = Number.isFinite(save.data?.simulationDay)
    ? Math.max(1, Math.floor(save.data.simulationDay))
    : 1
  const calendarStartDate = typeof save.data?.calendarStartDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(save.data.calendarStartDate)
    ? save.data.calendarStartDate
    : GAME_DEFAULT_START_DATE
  const freePlaySettings = normalizeFreePlaySettings(save.data?.freePlaySettings)
  const economy = normalizeEconomy(save.data?.economy)
  economy.unlimitedMoney = freePlaySettings.cheatUnlimitedMoney
  // Une ancienne sauvegarde peut arriver en V24 avec le jour initial `7` alors
  // qu'elle est déjà bien plus avancée. On programme alors la prochaine vraie
  // échéance à un cycle complet après le jour courant au lieu d'afficher un jour passé.
  if (economy.publicFundingNextDay <= simulationDay) {
    economy.publicFundingNextDay = simulationDay + GAME_PUBLIC_DEVELOPMENT_PERIOD_DAYS
  }

  const rawChallenge = save.data?.challenge
  let challenge: GameChallengeRuntime | null = null
  if (rawChallenge?.definition) {
    const definition = normalizeChallengeDefinition(rawChallenge.definition)
    const startedAt = typeof rawChallenge.startedAt === 'string' && !Number.isNaN(new Date(rawChallenge.startedAt).getTime())
      ? rawChallenge.startedAt
      : new Date().toISOString()
    const endsAt = typeof rawChallenge.endsAt === 'string' && !Number.isNaN(new Date(rawChallenge.endsAt).getTime())
      ? rawChallenge.endsAt
      : new Date(new Date(startedAt).getTime() + definition.durationMinutes * 60_000).toISOString()
    challenge = {
      ...rawChallenge,
      definition,
      startedAt,
      endsAt,
      status: ['ACTIVE', 'SUCCESS', 'FAILED'].includes(String(rawChallenge.status)) ? rawChallenge.status : 'ACTIVE',
      readOnly: rawChallenge.readOnly === true || rawChallenge.status === 'SUCCESS' || rawChallenge.status === 'FAILED',
      archivedChallenge: rawChallenge.archivedChallenge === true,
      expiresAt: typeof rawChallenge.expiresAt === 'string' ? rawChallenge.expiresAt : null,
    }
  }

  const normalizedData: GameSaveData = {
    simulationDay,
    freePlaySettings,
    calendarStartDate,
    network: normalizeNetwork(save.data?.network),
    economy,
    simulation: normalizeSimulation(save.data?.simulation, calendarStartDate),
    municipalities: normalizeMunicipalities(save.data?.municipalities),
    events: normalizeEvents(save.data?.events),
    objectives: normalizeObjectives(save.data?.objectives),
    roast: normalizeRoastState(save.data?.roast),
    // Initialisé juste après : le moteur statistique a besoin du reste des données normalisées.
    statistics: undefined as never,
    generatedTerritory,
    challenge,
    uiState: {
      panelOpen: save.data?.uiState?.panelOpen === true,
      selectedPanel: ['NETWORK', 'MUNICIPALITIES', 'FINANCES', 'EVENTS', 'OBJECTIVES'].includes(String(save.data?.uiState?.selectedPanel))
        ? save.data.uiState.selectedPanel
        : 'NETWORK',
    },
  }
  // V41 : nettoie les références orphelines laissées par d'anciennes suppressions de lignes.
  const validLineIds = new Set(normalizedData.network.lines.map(line => line.id))
  normalizedData.simulation.lineStates = normalizedData.simulation.lineStates.filter(state => validLineIds.has(state.lineId))
  normalizedData.objectives.active = normalizedData.objectives.active.filter(objective => !objective.lineId || validLineIds.has(objective.lineId))
  for (const lineId of Object.keys(normalizedData.economy.customFarePolicy.lineTicketPrices)) {
    if (!validLineIds.has(lineId)) delete normalizedData.economy.customFarePolicy.lineTicketPrices[lineId]
  }

  const statisticsContext = { ...save, data: normalizedData } as GameSave
  normalizedData.statistics = normalizeStatisticsState(
    save.data?.statistics,
    statisticsContext,
    Number(save.version) < 28,
  )

  return {
    ...save,
    version: GAME_SAVE_VERSION,
    mode: ['FREE', 'CHALLENGE_DAILY', 'CHALLENGE_FRIEND'].includes(String(save.mode)) ? save.mode : 'FREE',
    territory,
    data: normalizedData,
  }
}

export function useMetropoleGame() {
  const state = useState<GameState>('clu-metropole-game', () => ({
    version: GAME_SAVE_VERSION,
    status: 'HOME',
    save: null,
  }))

  const saves = useState<GameSave[]>('clu-metropole-saves', () => [])
  const storageReady = useState<boolean>('clu-metropole-storage-ready', () => false)
  const storageError = useState<string | null>('clu-metropole-storage-error', () => null)

  const regularSaves = computed(() => saves.value.filter(save => save.mode === 'FREE'))
  const challengeSaves = computed(() => saves.value.filter(save => save.mode !== 'FREE'))
  const isChallenge = computed(() => isSaveChallenge(state.value.save))
  const isReadOnly = computed(() => isSaveReadOnly(state.value.save))


  function openNewGameSetup() { state.value.status = 'SETUP' }
  function returnHome() { state.value.status = 'HOME' }

  async function refreshSaves() {
    storageError.value = null
    try {
      // V26 ne migre plus silencieusement au simple affichage de la liste.
      // La sauvegarde brute reste intacte jusqu'au chargement/import explicite.
      await pruneExpiredChallengeSaves()
      saves.value = await listGameSaves()
      storageReady.value = true
    }
    catch (error) {
      storageReady.value = false
      storageError.value = error instanceof Error ? error.message : 'Erreur de stockage inconnue.'
    }
  }

  async function createGame(
    name: string,
    freePlaySettings?: GameFreePlaySettings,
    territory: GameTerritory = 'ILE_DE_FRANCE',
    generatedTerritoryInput?: GameGeneratedTerritorySettings | null,
  ) {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Le nom de la partie est vide.')
    await assertCanCreateGameSave('FREE')
    if (!isGameTerritory(territory) || !isGameTerritoryAvailable(territory)) {
      throw new Error('Ce territoire n’est pas encore disponible dans cette version de CLU Métropole.')
    }
    const generatedTerritory = territory === 'GENERATED'
      ? normalizeGeneratedTerritorySettings(generatedTerritoryInput)
      : null
    if (territory === 'GENERATED' && !generatedTerritory) {
      throw new Error('Configurez la seed de la carte fictive avant de lancer la partie.')
    }
    const settings = normalizeFreePlaySettings(freePlaySettings ?? createDefaultFreePlaySettings())
    const now = new Date().toISOString()
    const newSave: GameSave = {
      id: createSaveId(),
      name: normalizedName,
      version: GAME_SAVE_VERSION,
      createdAt: now,
      updatedAt: now,
      mode: 'FREE',
      territory,
      data: {
        simulationDay: 1,
        freePlaySettings: settings,
        calendarStartDate: currentLocalIsoDate(),
        network: createEmptyNetwork(),
        economy: createEmptyEconomy(settings.startingCapital, settings.cheatUnlimitedMoney),
        simulation: createEmptySimulation(),
        municipalities: createEmptyMunicipalitiesState(),
        events: createEmptyEventsState(),
        objectives: createEmptyObjectivesState(),
        roast: createEmptyRoastState(),
        statistics: undefined as never,
        generatedTerritory,
        challenge: null,
        uiState: { panelOpen: false, selectedPanel: 'NETWORK' },
      },
    }
    newSave.data.economy.fareManagementMode = settings.fareGuidance === 'MANUAL' ? 'BY_MODE' : 'GUIDED'
    newSave.data.events.nextEligibleDay = settings.eventFrequency === 'CALM' ? 5 : settings.eventFrequency === 'FREQUENT' ? 2 : 3
    newSave.data.statistics = createStatisticsState(newSave, false)
    await saveGame(newSave)
    state.value = { version: GAME_SAVE_VERSION, status: 'PLAYING', save: newSave }
    await refreshSaves()
    return newSave
  }

  async function createChallengeGame(definitionInput: GameChallengeDefinition) {
    const definition = normalizeChallengeDefinition(definitionInput)
    await pruneExpiredChallengeSaves()
    await assertCanCreateGameSave(definition.kind === 'DAILY' ? 'CHALLENGE_DAILY' : 'CHALLENGE_FRIEND')
    if (!isGameTerritoryAvailable(definition.territory)) throw new Error('La carte de ce défi n’est pas disponible.')
    const generatedTerritory = definition.territory === 'GENERATED'
      ? normalizeGeneratedTerritorySettings(definition.generatedTerritory)
      : null
    if (definition.territory === 'GENERATED' && !generatedTerritory) throw new Error('La carte fictive du défi est invalide.')

    const settings = createChallengeFreePlaySettings(definition)
    const now = new Date()
    const iso = now.toISOString()
    const newSave: GameSave = {
      id: createSaveId(),
      name: definition.title,
      version: GAME_SAVE_VERSION,
      createdAt: iso,
      updatedAt: iso,
      mode: definition.kind === 'DAILY' ? 'CHALLENGE_DAILY' : 'CHALLENGE_FRIEND',
      territory: definition.territory,
      data: {
        simulationDay: 1,
        freePlaySettings: settings,
        calendarStartDate: currentLocalIsoDate(now),
        network: createEmptyNetwork(),
        economy: createEmptyEconomy(settings.startingCapital, false),
        simulation: createEmptySimulation(),
        municipalities: createEmptyMunicipalitiesState(),
        events: createEmptyEventsState(),
        objectives: createEmptyObjectivesState(),
        roast: createEmptyRoastState(),
        statistics: undefined as never,
        generatedTerritory,
        challenge: createChallengeRuntime(definition, now),
        uiState: { panelOpen: false, selectedPanel: 'NETWORK' },
      },
    }
    newSave.data.economy.fareManagementMode = settings.fareGuidance === 'MANUAL' ? 'BY_MODE' : 'GUIDED'
    newSave.data.events.nextEligibleDay = settings.eventFrequency === 'CALM' ? 5 : settings.eventFrequency === 'FREQUENT' ? 2 : 3
    newSave.data.statistics = createStatisticsState(newSave, false)
    await saveGame(newSave)
    state.value = { version: GAME_SAVE_VERSION, status: 'PLAYING', save: newSave }
    await refreshSaves()
    return newSave
  }

  async function finishCurrentChallenge(reason: GameChallengeFinishReason) {
    const current = state.value.save
    if (!current?.data.challenge) return null
    const result = finalizeChallenge(current, reason, new Date())
    if (result && current.data.challenge) current.data.challenge.expiresAt = challengeArchiveExpiresAt(result.finishedAt)
    current.updatedAt = new Date().toISOString()
    await saveGame(current)
    await refreshSaves()
    return result
  }

  async function archiveCurrentDailyChallenge() {
    const current = state.value.save
    const challenge = current?.data.challenge
    if (!current || !challenge?.result) throw new Error('Aucun défi terminé à archiver.')
    if (challenge.definition.kind !== 'DAILY') return current
    challenge.readOnly = true
    challenge.archivedChallenge = true
    challenge.expiresAt = challengeArchiveExpiresAt(challenge.result.finishedAt)
    current.updatedAt = new Date().toISOString()
    await saveGame(current)
    await refreshSaves()
    return current
  }

  async function discardCurrentChallengeAndHome() {
    const current = state.value.save
    if (current?.data.challenge) await deleteGameSave(current.id)
    state.value = { version: GAME_SAVE_VERSION, status: 'HOME', save: null }
    await refreshSaves()
  }

  async function loadGame(id: string) {
    storageError.value = null
    const storedSave = await getGameSave(id)
    if (!storedSave) {
      await refreshSaves()
      return false
    }

    try { assertGameSaveShape(storedSave) }
    catch (error) {
      storageError.value = error instanceof Error ? error.message : 'Cette sauvegarde locale est corrompue.'
      return false
    }

    const compatibility = getGameSaveCompatibility(storedSave)
    if (compatibility === 'FUTURE') {
      storageError.value = `Cette sauvegarde est en V${storedSave.version}, mais ce jeu ne prend en charge que jusqu'à la V${GAME_SAVE_VERSION}. Mettez CLU Métropole à jour avant de la charger.`
      return false
    }
    if (compatibility === 'INVALID') {
      storageError.value = 'Cette sauvegarde a une version invalide et ne peut pas être chargée.'
      return false
    }

    let migrationBackup: Awaited<ReturnType<typeof backupGameSave>> | null = null
    try {
      if (compatibility === 'OLDER') {
        migrationBackup = await backupGameSave(storedSave, 'MIGRATION')
      }
      const save = normalizeSave(storedSave)
      expireChallengeIfNeeded(save, new Date())
      await saveGame(save)
      state.value = { version: save.version, status: 'PLAYING', save }
      await refreshSaves()
      return true
    }
    catch (error) {
      if (migrationBackup) {
        try { await restoreGameSaveBackup(migrationBackup) }
        catch { /* La copie de secours reste conservée dans IndexedDB. */ }
      }
      storageError.value = error instanceof Error ? error.message : 'Impossible de charger cette sauvegarde.'
      await refreshSaves()
      return false
    }
  }

  async function continueLatestGame() {
    if (saves.value.length === 0) await refreshSaves()
    for (const candidate of saves.value) {
      const compatibility = getGameSaveCompatibility(candidate)
      if (compatibility !== 'CURRENT' && compatibility !== 'OLDER') continue
      if (isSaveReadOnly(candidate)) continue
      if (await loadGame(candidate.id)) return true
    }
    return false
  }

  async function removeSave(id: string) {
    await deleteGameSave(id)
    if (state.value.save?.id === id) state.value.save = null
    await refreshSaves()
  }

  async function renameSave(id: string, name: string) {
    const normalizedName = name.trim().slice(0, 80)
    if (!normalizedName) throw new Error('Le nom de la sauvegarde est vide.')
    const stored = await getGameSave(id)
    if (!stored) throw new Error('Sauvegarde introuvable.')
    stored.name = normalizedName
    stored.updatedAt = new Date().toISOString()
    await saveGame(stored)
    if (state.value.save?.id === id) state.value.save.name = normalizedName
    await refreshSaves()
    return stored
  }

  async function duplicateSave(id: string) {
    const stored = await getGameSave(id)
    if (!stored) throw new Error('Sauvegarde introuvable.')
    assertGameSaveShape(stored)
    const compatibility = getGameSaveCompatibility(stored)
    if (compatibility === 'FUTURE') throw new Error(`Impossible de dupliquer une sauvegarde V${stored.version} avec CLU Métropole V${GAME_SAVE_VERSION}.`)
    if (compatibility === 'INVALID') throw new Error('Cette sauvegarde est invalide.')
    if (isSaveReadOnly(stored)) throw new Error('Une archive de défi en lecture seule ne peut pas être dupliquée.')
    await assertCanCreateGameSave(stored.mode)

    const now = new Date().toISOString()
    const copy = normalizeSave(cloneSave(stored))
    copy.id = createSaveId()
    copy.name = `${stored.name} — copie`.slice(0, 80)
    copy.createdAt = now
    copy.updatedAt = now
    await saveGame(copy)
    await refreshSaves()
    return copy
  }

  async function exportSave(id: string) {
    const stored = await getGameSave(id)
    if (!stored) throw new Error('Sauvegarde introuvable.')
    const day = Math.max(1, Math.floor(Number(stored.data?.simulationDay) || 1))
    return {
      filename: `CLU-Metropole_${safeFilePart(stored.name)}_Jour-${day}.clumetro`,
      content: serializeGameSave(stored),
    }
  }

  async function importSave(content: string) {
    const incoming = parseGameSaveExport(content)
    const compatibility = getGameSaveCompatibility(incoming)
    if (compatibility === 'FUTURE') {
      throw new Error(`Cette sauvegarde est en V${incoming.version}. Votre jeu est en V${GAME_SAVE_VERSION} : mettez CLU Métropole à jour avant de l'importer.`)
    }
    if (compatibility === 'INVALID') throw new Error('La version de cette sauvegarde est invalide.')
    if (incoming.mode !== 'FREE') await pruneExpiredChallengeSaves()
    await assertCanCreateGameSave(incoming.mode)

    // Copie de secours du fichier entrant avant toute normalisation/migration.
    // On lui attribue déjà l'identifiant local final afin que sa suppression
    // future nettoie également les secours associés.
    const localId = createSaveId()
    const rawImportBackup = cloneSave(incoming)
    rawImportBackup.id = localId
    await backupGameSave(rawImportBackup, 'IMPORT')

    const imported = normalizeSave(cloneSave(incoming))
    const existingNames = new Set((await listGameSaves()).map(save => save.name.trim().toLocaleLowerCase(currentGameLocaleTag())))
    let candidate = imported.name.trim().slice(0, 80) || 'Partie importée'
    if (existingNames.has(candidate.toLocaleLowerCase(currentGameLocaleTag()))) {
      const base = `${candidate} — importée`.slice(0, 72)
      candidate = base
      let serial = 2
      while (existingNames.has(candidate.toLocaleLowerCase(currentGameLocaleTag()))) {
        candidate = `${base} ${serial}`.slice(0, 80)
        serial += 1
      }
    }

    imported.id = localId
    imported.name = candidate
    imported.updatedAt = new Date().toISOString()
    await saveGame(imported)
    await refreshSaves()
    return imported
  }

  async function persistCurrentGame() {
    const currentSave = state.value.save
    if (!currentSave) return

    let migrationBackup: Awaited<ReturnType<typeof backupGameSave>> | null = null
    try {
      if (getGameSaveCompatibility(currentSave) === 'OLDER') {
        migrationBackup = await backupGameSave(currentSave, 'MIGRATION')
      }
      const updatedSave = normalizeSave({ ...currentSave, updatedAt: new Date().toISOString() })
      expireChallengeIfNeeded(updatedSave, new Date())
      await saveGame(updatedSave)
      state.value = { ...state.value, version: GAME_SAVE_VERSION, save: updatedSave }
      await refreshSaves()
    }
    catch (error) {
      if (migrationBackup) {
        try { await restoreGameSaveBackup(migrationBackup) }
        catch { /* La copie de secours reste conservée. */ }
      }
      throw error
    }
  }

  function resetGame() {
    state.value = { version: GAME_SAVE_VERSION, status: 'HOME', save: null }
  }

  return {
    state,
    saves,
    regularSaves,
    challengeSaves,
    storageReady,
    storageError,
    isChallenge,
    isReadOnly,
    openNewGameSetup,
    returnHome,
    refreshSaves,
    createGame,
    createChallengeGame,
    finishCurrentChallenge,
    archiveCurrentDailyChallenge,
    discardCurrentChallengeAndHome,
    loadGame,
    continueLatestGame,
    removeSave,
    renameSave,
    duplicateSave,
    exportSave,
    importSave,
    persistCurrentGame,
    resetGame,
  }
}
