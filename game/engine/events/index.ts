import {
  GAME_EVENT_DECISION_DAYS,
  GAME_EVENT_DEFINITIONS,
  GAME_EVENT_HISTORY_LIMIT,
  GAME_EVENT_RECENT_DEFINITION_COOLDOWN,
  GAME_EVENT_MAX_INTERVAL_DAYS,
  GAME_EVENT_MIN_INTERVAL_DAYS,
} from '../../config/events'

import type {
  GameEconomyState,
} from '../../types/economy'

import type {
  GameActiveEvent,
  GameEventChoice,
  GameEventDefinition,
  GameEventContext,
  GameEventHistoryEntry,
  GameEventModifier,
  GameEventsState,
} from '../../types/events'

import type {
  GameSimulationModifiers,
} from '../../types/simulation'

function createId() {
  if (
    typeof crypto !== 'undefined'
    && typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-')
}

function hashString(
  value: string,
) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function deterministicIndex(
  seed: string,
  length: number,
) {
  if (length <= 0) {
    return 0
  }

  return hashString(seed) % length
}

function copyChoice(
  choice: GameEventChoice,
): GameEventChoice {
  return {
    ...choice,
    effects: choice.effects.map(
      effect => ({ ...effect }),
    ),
  }
}

function createActiveEvent(
  definition: GameEventDefinition,
  day: number,
): GameActiveEvent {
  return {
    id: createId(),
    definitionId: definition.id,
    eyebrow: definition.eyebrow,
    title: definition.title,
    description: definition.description,
    createdDay: day,
    decisionDeadlineDay:
      day + GAME_EVENT_DECISION_DAYS,
    choices: definition.choices.map(copyChoice),
  }
}

function trimHistory(
  state: GameEventsState,
) {
  if (state.history.length <= GAME_EVENT_HISTORY_LIMIT) {
    return
  }

  state.history.splice(
    0,
    state.history.length - GAME_EVENT_HISTORY_LIMIT,
  )
}

function nextInterval(
  saveId: string,
  day: number,
  totalResolved: number,
  intervalMultiplier = 1,
) {
  const range = Math.max(
    1,
    GAME_EVENT_MAX_INTERVAL_DAYS
    - GAME_EVENT_MIN_INTERVAL_DAYS
    + 1,
  )

  const base = GAME_EVENT_MIN_INTERVAL_DAYS
    + deterministicIndex(
      `${saveId}:interval:${day}:${totalResolved}`,
      range,
    )
  return Math.max(3, Math.round(base * Math.max(0.35, intervalMultiplier)))
}

export function createEmptyEventsState(): GameEventsState {
  return {
    active: null,
    history: [],
    modifiers: [],
    nextEligibleDay: 2,
    totalResolved: 0,
    totalBalanceImpact: 0,
  }
}

export function pruneExpiredEventModifiers(
  state: GameEventsState,
  day: number,
) {
  state.modifiers = state.modifiers.filter(
    modifier => modifier.endsDay >= day,
  )
}

export function getEventSimulationModifiers(
  state: GameEventsState,
  day: number,
): GameSimulationModifiers {
  let demandMultiplier = 1
  let revenueMultiplier = 1
  let operatingCostMultiplier = 1

  for (const modifier of state.modifiers) {
    if (
      day < modifier.startsDay
      || day > modifier.endsDay
    ) {
      continue
    }

    if (modifier.kind === 'DEMAND_MULTIPLIER') {
      demandMultiplier *= modifier.multiplier
    }
    else if (modifier.kind === 'REVENUE_MULTIPLIER') {
      revenueMultiplier *= modifier.multiplier
    }
    else if (modifier.kind === 'OPERATING_COST_MULTIPLIER') {
      operatingCostMultiplier *= modifier.multiplier
    }
  }

  return {
    demandMultiplier,
    revenueMultiplier,
    operatingCostMultiplier,
  }
}

function eligibleDefinitions(
  state: GameEventsState,
  day: number,
  operationalLineCount: number,
  balance: number,
  context: GameEventContext,
) {
  const recentDefinitions = new Set(
    state.history
      .slice(-GAME_EVENT_RECENT_DEFINITION_COOLDOWN)
      .map(entry => entry.definitionId),
  )

  return GAME_EVENT_DEFINITIONS.filter(definition => {
    if (recentDefinitions.has(definition.id)) return false
    if (day < definition.minDay || operationalLineCount < definition.minOperationalLines) return false
    if (definition.maxBalance !== undefined && balance > definition.maxBalance) return false
    if (definition.minBalance !== undefined && balance < definition.minBalance) return false
    if (definition.minPassengers !== undefined && context.passengers < definition.minPassengers) return false
    if (definition.minServiceQualityScore !== undefined && context.serviceQualityScore < definition.minServiceQualityScore) return false
    if (definition.maxServiceQualityScore !== undefined && context.serviceQualityScore > definition.maxServiceQualityScore) return false
    if (definition.maxDemandSatisfactionRate !== undefined && context.demandSatisfactionRate > definition.maxDemandSatisfactionRate) return false
    if (definition.minDemandSatisfactionRate !== undefined && context.demandSatisfactionRate < definition.minDemandSatisfactionRate) return false
    if (definition.minCongestedStations !== undefined && context.congestedStationCount < definition.minCongestedStations) return false
    if (definition.minDebtPrincipal !== undefined && context.debtPrincipal < definition.minDebtPrincipal) return false
    if (definition.maxDebtPrincipal !== undefined && context.debtPrincipal > definition.maxDebtPrincipal) return false
    if (definition.requirePositiveOperatingResult && context.dailyOperatingResult <= 0) return false
    return true
  })
}

export function maybeCreateGameEvent(
  state: GameEventsState,
  options: {
    saveId: string
    day: number
    operationalLineCount: number
    balance: number
    context: GameEventContext
    intervalMultiplier?: number
  },
) {
  if (
    state.active
    || options.day < state.nextEligibleDay
  ) {
    return null
  }

  const eligible = eligibleDefinitions(
    state,
    options.day,
    options.operationalLineCount,
    options.balance,
    options.context,
  )

  if (eligible.length === 0) {
    state.nextEligibleDay = options.day + 1
    return null
  }

  const index = deterministicIndex(
    `${options.saveId}:event:${options.day}:${state.totalResolved}`,
    eligible.length,
  )

  const definition = eligible[index]

  if (!definition) {
    return null
  }

  const active = createActiveEvent(
    definition,
    options.day,
  )

  state.active = active

  return active
}

function addModifier(
  state: GameEventsState,
  active: GameActiveEvent,
  effect: Extract<
    GameEventChoice['effects'][number],
    { kind: 'DEMAND_MULTIPLIER' | 'REVENUE_MULTIPLIER' | 'OPERATING_COST_MULTIPLIER' }
  >,
  day: number,
) {
  const durationDays = Math.max(
    1,
    Math.floor(effect.durationDays),
  )

  const modifier: GameEventModifier = {
    id: createId(),
    sourceEventId: active.id,
    sourceTitle: active.title,
    kind: effect.kind,
    multiplier: Math.max(0, effect.multiplier),
    label: effect.label,
    startsDay: day + 1,
    endsDay: day + durationDays,
  }

  state.modifiers.push(modifier)
}

export function resolveActiveGameEvent(
  state: GameEventsState,
  economy: GameEconomyState,
  choiceId: string,
  day: number,
  saveId: string,
  intervalMultiplier = 1,
) {
  const active = state.active

  if (!active) {
    return null
  }

  const choice = active.choices.find(
    item => item.id === choiceId,
  )

  if (!choice) {
    return null
  }

  let balanceImpact = 0

  for (const effect of choice.effects) {
    if (effect.kind === 'BALANCE') {
      const amount = Math.round(effect.amount)
      if (!(economy.unlimitedMoney && amount < 0)) economy.balance += amount
      balanceImpact += economy.unlimitedMoney && amount < 0 ? 0 : amount

      if (amount > 0) {
        economy.totalSubsidies += amount
      }
    }
    else {
      addModifier(
        state,
        active,
        effect,
        day,
      )
    }
  }

  const entry: GameEventHistoryEntry = {
    id: active.id,
    definitionId: active.definitionId,
    eyebrow: active.eyebrow,
    title: active.title,
    description: active.description,
    createdDay: active.createdDay,
    resolvedDay: day,
    status: 'RESOLVED',
    choiceId: choice.id,
    choiceLabel: choice.label,
    choiceDescription: choice.description,
    balanceImpact,
  }

  state.history.push(entry)
  trimHistory(state)
  state.active = null
  state.totalResolved += 1
  state.totalBalanceImpact += balanceImpact
  state.nextEligibleDay = day + nextInterval(
    saveId,
    day,
    state.totalResolved,
    intervalMultiplier,
  )

  return entry
}

export function processGameEventsDay(
  state: GameEventsState,
  options: {
    saveId: string
    day: number
    operationalLineCount: number
    balance: number
    context: GameEventContext
    intervalMultiplier?: number
  },
) {
  pruneExpiredEventModifiers(
    state,
    options.day,
  )

  if (
    state.active
    && options.day > state.active.decisionDeadlineDay
  ) {
    const active = state.active

    state.history.push({
      id: active.id,
      definitionId: active.definitionId,
      eyebrow: active.eyebrow,
      title: active.title,
      description: active.description,
      createdDay: active.createdDay,
      resolvedDay: options.day,
      status: 'EXPIRED',
      choiceId: null,
      choiceLabel: null,
      choiceDescription: null,
      balanceImpact: 0,
    })

    trimHistory(state)
    state.active = null
    state.totalResolved += 1
    state.nextEligibleDay = options.day + Math.max(2, Math.round(2 * Math.max(0.35, options.intervalMultiplier ?? 1)))
  }

  return maybeCreateGameEvent(
    state,
    options,
  )
}
