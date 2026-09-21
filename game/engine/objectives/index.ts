import { currentGameLocaleTag } from '../../config/i18n'
import {
  DEFAULT_GAME_SCENARIO_ID,
  GAME_MAX_ACTIVE_OBJECTIVES,
  GAME_MIN_ACTIVE_OBJECTIVES,
  GAME_OBJECTIVE_HISTORY_LIMIT,
} from '../../config/objectives'
import { applyObjectiveReward } from '../economy'
import { isOperationalLine } from '../network'
import { getLineAllStations } from '../network/geometry'

import type { GameEconomyState } from '../../types/economy'
import type { GameSave } from '../../types/game'
import type {
  GameObjectiveDefinition,
  GameObjectiveProgress,
  GameObjectivesState,
} from '../../types/objectives'
import type { GameNetworkTerritorySummary } from '../../types/territory'

export function createEmptyObjectivesState(): GameObjectivesState {
  return {
    scenarioId: DEFAULT_GAME_SCENARIO_ID,
    completedObjectiveIds: [],
    completedDay: null,
    active: [],
    completed: [],
    totalCompleted: 0,
    totalRewards: 0,
    nextObjectiveSerial: 1,
  }
}

function operationalLines(save: GameSave) {
  return save.data.network.lines.filter(isOperationalLine)
}

export function objectiveValue(
  save: GameSave,
  territory: GameNetworkTerritorySummary,
  objective: GameObjectiveDefinition,
) {
  const lines = operationalLines(save)
  const latest = save.data.simulation.history.at(-1)
  const selectedLine = objective.lineId
    ? latest?.lines.find(line => line.lineId === objective.lineId)
    : null

  switch (objective.metric) {
    case 'OPERATIONAL_LINES': return lines.length
    case 'STATIONS': return lines.reduce((total, line) => total + getLineAllStations(line).length, 0)
    case 'MUNICIPALITIES_SERVED': return territory.municipalitiesServed
    case 'POPULATION_SERVED': return territory.populationServed
    case 'DAILY_PASSENGERS': return selectedLine?.passengers ?? latest?.passengers ?? 0
    case 'TOTAL_PASSENGERS': return save.data.simulation.totalPassengers
    case 'NETWORK_MORALE': return latest?.networkMoraleScore ?? 76
    case 'MAX_LINE_OCCUPANCY': {
      if (selectedLine) return selectedLine.occupancyRate
      return Math.max(0, ...(latest?.lines.map(line => line.occupancyRate) ?? [0]))
    }
    case 'MAX_LOST_PASSENGERS': return selectedLine?.lostPassengers ?? latest?.lostPassengers ?? 0
    case 'MIN_LINE_REGULARITY': {
      if (selectedLine) return selectedLine.regularityScore ?? 100
      return Math.min(100, ...(latest?.lines.map(line => line.regularityScore ?? 100) ?? [100]))
    }
    case 'MIN_FLEET_CONDITION': {
      if (objective.lineId) {
        return save.data.network.lines.find(line => line.id === objective.lineId)?.fleetCondition ?? 100
      }
      return Math.min(100, ...lines.map(line => line.fleetCondition ?? 100))
    }
    case 'DAILY_OPERATING_RESULT': return latest?.netResult ?? 0
    case 'NEW_MUNICIPALITIES': return Math.max(0, territory.municipalitiesServed - (objective.baseline ?? 0))
    default: return 0
  }
}

export function objectiveProgress(
  save: GameSave,
  territory: GameNetworkTerritorySummary,
  objective: GameObjectiveDefinition,
): GameObjectiveProgress {
  const value = objectiveValue(save, territory, objective)
  const target = objective.target
  const direction = objective.direction ?? 'AT_LEAST'
  const reached = direction === 'AT_MOST'
    ? value <= target
    : value >= target
  const ratio = direction === 'AT_MOST'
    ? (value <= target ? 1 : Math.max(0, target / Math.max(0.0001, value)))
    : Math.min(1, value / Math.max(0.0001, target))

  return {
    objectiveId: objective.id,
    value,
    target,
    ratio: Math.min(1, Math.max(0, ratio)),
    reached,
  }
}

function createId(state: GameObjectivesState, day: number, suffix: string) {
  const id = `daily-${day}-${state.nextObjectiveSerial}-${suffix}`
  state.nextObjectiveSerial += 1
  return id
}

function objectiveReward(base: number, save: GameSave, lineId?: string) {
  const investmentScale = 1 + Math.min(1, Math.max(0, save.data.economy.totalInvestment) / 8_000_000_000)
  const line = lineId ? save.data.network.lines.find(item => item.id === lineId) : null
  const modeMultiplier = line
    ? ({ BUS: 0.72, BRT: 0.88, TRAM: 1, TRAIN: 1.12, RER: 1.22, METRO: 1.32 } as const)[line.mode]
    : 1
  return Math.round(base * investmentScale * modeMultiplier / 5_000_000) * 5_000_000
}

function generateCandidates(
  state: GameObjectivesState,
  save: GameSave,
  territory: GameNetworkTerritorySummary,
  day: number,
): GameObjectiveDefinition[] {
  const latest = save.data.simulation.history.at(-1)
  const operational = operationalLines(save)
  const weakestMorale = latest?.lines
    .slice()
    .sort((a, b) => a.moraleScoreAfter - b.moraleScoreAfter)[0]
  const mostSaturated = latest?.lines
    .slice()
    .sort((a, b) => b.occupancyRate - a.occupancyRate)[0]
  const weakestFleet = operational
    .slice()
    .sort((a, b) => (a.fleetCondition ?? 100) - (b.fleetCondition ?? 100))[0]
  const weakestRegularity = latest?.lines
    .slice()
    .sort((a, b) => (a.regularityScore ?? 100) - (b.regularityScore ?? 100))[0]

  const candidates: GameObjectiveDefinition[] = []

  if (operational.length === 0) {
    candidates.push({
      id: createId(state, day, 'first-line'),
      metric: 'OPERATIONAL_LINES',
      title: 'Mettre une première ligne en service',
      description: 'Construire puis ouvrir votre première ligne. Les travaux prennent plusieurs jours : laissez le temps avancer ou utilisez « Passer au jour suivant ».',
      target: 1,
      reward: objectiveReward(65_000_000, save),
      generatedDay: day,
      expiresDay: null,
    })
    candidates.push({
      id: createId(state, day, 'first-stations'),
      metric: 'STATIONS',
      title: 'Créer une desserte utile',
      description: 'Mettre en service au moins 4 stations sur le réseau.',
      target: 4,
      reward: objectiveReward(45_000_000, save),
      generatedDay: day,
      expiresDay: null,
    })
    return candidates
  }

  candidates.push({
    id: createId(state, day, 'traffic'),
    metric: 'DAILY_PASSENGERS',
    title: 'Faire progresser la fréquentation',
    description: `Transporter au moins ${Math.max(10_000, Math.round((latest?.passengers ?? 8_000) * 1.08)).toLocaleString(currentGameLocaleTag())} voyageurs sur une journée.`,
    target: Math.max(10_000, Math.round((latest?.passengers ?? 8_000) * 1.08)),
    reward: objectiveReward(45_000_000, save),
    generatedDay: day,
    expiresDay: null,
  })

  if (mostSaturated && mostSaturated.occupancyRate > 0.88) {
    candidates.push({
      id: createId(state, day, 'saturation'),
      metric: 'MAX_LINE_OCCUPANCY',
      direction: 'AT_MOST',
      title: `Désaturer ${mostSaturated.lineName}`,
      description: 'Ramener le taux de charge de cette ligne à 88 % ou moins.',
      target: 0.88,
      reward: objectiveReward(70_000_000, save, mostSaturated.lineId),
      generatedDay: day,
      expiresDay: null,
      lineId: mostSaturated.lineId,
    })
  }

  if (weakestMorale && weakestMorale.moraleScoreAfter < 74) {
    candidates.push({
      id: createId(state, day, 'morale'),
      metric: 'NETWORK_MORALE',
      title: 'Rétablir la confiance voyageurs',
      description: 'Remonter le moral moyen du réseau à 74/100.',
      target: 74,
      reward: objectiveReward(55_000_000, save),
      generatedDay: day,
      expiresDay: null,
    })
  }

  if (weakestFleet && (weakestFleet.fleetCondition ?? 100) < 92) {
    candidates.push({
      id: createId(state, day, 'fleet'),
      metric: 'MIN_FLEET_CONDITION',
      title: `Fiabiliser ${weakestFleet.name}`,
      description: 'Ramener l’état du parc de cette ligne à au moins 92 %.',
      target: 92,
      reward: objectiveReward(45_000_000, save, weakestFleet.id),
      generatedDay: day,
      expiresDay: null,
      lineId: weakestFleet.id,
    })
  }

  if (weakestRegularity && (weakestRegularity.regularityScore ?? 100) < 85) {
    candidates.push({
      id: createId(state, day, 'regularity'),
      metric: 'MIN_LINE_REGULARITY',
      title: `Régulariser ${weakestRegularity.lineName}`,
      description: 'Atteindre au moins 85/100 de régularité sur cette ligne.',
      target: 85,
      reward: objectiveReward(55_000_000, save, weakestRegularity.lineId),
      generatedDay: day,
      expiresDay: null,
      lineId: weakestRegularity.lineId,
    })
  }

  candidates.push({
    id: createId(state, day, 'territory'),
    metric: 'NEW_MUNICIPALITIES',
    title: 'Étendre le territoire desservi',
    description: 'Desservir une commune supplémentaire par rapport au moment où cet objectif a été proposé.',
    target: 1,
    reward: objectiveReward(120_000_000, save),
    generatedDay: day,
    expiresDay: null,
    baseline: territory.municipalitiesServed,
  })

  if ((latest?.lostPassengers ?? 0) > 500) {
    candidates.push({
      id: createId(state, day, 'lost'),
      metric: 'MAX_LOST_PASSENGERS',
      direction: 'AT_MOST',
      title: 'Réduire les voyageurs perdus',
      description: 'Ramener le nombre de voyageurs abandonnant le réseau sous 500 par jour.',
      target: 500,
      reward: objectiveReward(60_000_000, save),
      generatedDay: day,
      expiresDay: null,
    })
  }

  return candidates
}

export function ensureDynamicObjectives(
  state: GameObjectivesState,
  save: GameSave,
  territory: GameNetworkTerritorySummary,
  day: number,
) {
  if (state.active.length >= GAME_MIN_ACTIVE_OBJECTIVES) return false
  const candidates = generateCandidates(state, save, territory, day)
  const needed = GAME_MAX_ACTIVE_OBJECTIVES - state.active.length
  const existingSignatures = new Set(state.active.map(item => `${item.metric}:${item.lineId ?? ''}`))
  const additions = candidates
    .filter(item => !existingSignatures.has(`${item.metric}:${item.lineId ?? ''}`))
    .slice(0, needed)
  state.active.push(...additions)
  return additions.length > 0
}

export function evaluateGameObjectives(
  state: GameObjectivesState,
  save: GameSave,
  economy: GameEconomyState,
  territory: GameNetworkTerritorySummary,
  day: number,
) {
  let changed = false
  const remaining: GameObjectiveDefinition[] = []

  for (const objective of state.active) {
    const progress = objectiveProgress(save, territory, objective)
    if (progress.reached) {
      applyObjectiveReward(economy, objective.reward, objective.title)
      state.completed.push({
        id: objective.id,
        title: objective.title,
        completedDay: day,
        reward: objective.reward,
      })
      state.completedObjectiveIds.push(objective.id)
      state.totalCompleted += 1
      state.totalRewards += objective.reward
      changed = true
    }
    else {
      remaining.push(objective)
    }
  }

  state.active = remaining
  if (state.completed.length > GAME_OBJECTIVE_HISTORY_LIMIT) {
    state.completed.splice(0, state.completed.length - GAME_OBJECTIVE_HISTORY_LIMIT)
  }
  if (state.completedObjectiveIds.length > GAME_OBJECTIVE_HISTORY_LIMIT) {
    state.completedObjectiveIds.splice(0, state.completedObjectiveIds.length - GAME_OBJECTIVE_HISTORY_LIMIT)
  }
  return ensureDynamicObjectives(state, save, territory, day) || changed
}
