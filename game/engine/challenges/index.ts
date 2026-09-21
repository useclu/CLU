import { currentGameLocaleTag } from '../../config/i18n'
import { getAvailableGameTerritories } from '../../config/territories'
import { createDefaultFreePlaySettings } from '../../config/freePlay'
import { getLineAllStations } from '../network/geometry'
import type { GameSave, GameTerritory } from '../../types/game'
import type { GameGeneratedTerritorySettings } from '../../types/generatedTerritory'
import type { GameTransportMode } from '../../types/network'
import type {
  GameChallengeDefinition,
  GameChallengeDifficulty,
  GameChallengeFinishReason,
  GameChallengeObjective,
  GameChallengeObjectiveMetric,
  GameChallengeObjectiveResult,
  GameChallengeResult,
  GameChallengeResultEnvelope,
  GameChallengeRuntime,
} from '../../types/challenges'
import type { GameEconomyProfile, GameEventFrequency } from '../../types/freePlay'

const ALL_MODES: GameTransportMode[] = ['METRO', 'TRAM', 'RER', 'TRAIN', 'BUS', 'BRT']
const REAL_TERRITORIES = getAvailableGameTerritories().map(entry => entry.id).filter(id => id !== 'GENERATED') as GameTerritory[]

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function seeded(seed: string) {
  return mulberry32(fnv1a(seed))
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!
}

function compactNumber(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function normalizeDuration(value: unknown) {
  const duration = Number(value)
  return Number.isFinite(duration) ? Math.min(60, Math.max(15, Math.round(duration))) : 60
}

function normalizeModes(value: unknown): GameTransportMode[] {
  if (!Array.isArray(value)) return [...ALL_MODES]
  const filtered = value.filter((mode): mode is GameTransportMode => ALL_MODES.includes(mode as GameTransportMode))
  return filtered.length ? [...new Set(filtered)] : [...ALL_MODES]
}

function normalizeObjective(objective: Partial<GameChallengeObjective>, index: number): GameChallengeObjective {
  const metrics: GameChallengeObjectiveMetric[] = ['TOTAL_PASSENGERS', 'MUNICIPALITIES_SERVED', 'MAX_DEBT', 'SERVICE_QUALITY', 'OPERATIONAL_LINES', 'STATIONS', 'MIN_BALANCE']
  const metric = metrics.includes(objective.metric as GameChallengeObjectiveMetric)
    ? objective.metric as GameChallengeObjectiveMetric
    : 'TOTAL_PASSENGERS'
  const direction = objective.direction === 'AT_MOST' ? 'AT_MOST' : 'AT_LEAST'
  const target = Number.isFinite(Number(objective.target)) ? Math.max(0, Number(objective.target)) : 1
  return {
    id: typeof objective.id === 'string' && objective.id.trim() ? objective.id.slice(0, 80) : `objective-${index + 1}`,
    metric,
    direction,
    title: typeof objective.title === 'string' && objective.title.trim() ? objective.title.slice(0, 100) : 'Objectif',
    description: typeof objective.description === 'string' && objective.description.trim() ? objective.description.slice(0, 220) : 'Atteignez la cible avant la fin du défi.',
    target,
    weight: Number.isFinite(Number(objective.weight)) ? Math.max(.1, Math.min(5, Number(objective.weight))) : 1,
  }
}

function objective(metric: GameChallengeObjectiveMetric, target: number, title: string, description: string, direction: 'AT_LEAST' | 'AT_MOST' = 'AT_LEAST', weight = 1): GameChallengeObjective {
  return { id: `${metric.toLowerCase()}-${target}`, metric, target, title, description, direction, weight }
}

function normalizeGeneratedTerritory(value: GameGeneratedTerritorySettings | null | undefined): GameGeneratedTerritorySettings | null {
  if (!value || typeof value.seed !== 'string' || !value.seed.trim()) return null
  return {
    version: 3,
    seed: value.seed.trim().slice(0, 80),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 80) : 'Métropole défi',
    size: ['SMALL', 'MEDIUM', 'LARGE'].includes(value.size) ? value.size : 'MEDIUM',
    density: ['LOW', 'STANDARD', 'HIGH'].includes(value.density) ? value.density : 'STANDARD',
    structure: ['MONOCENTRIC', 'POLYCENTRIC', 'SPRAWLED'].includes(value.structure) ? value.structure : 'POLYCENTRIC',
    water: ['LOW', 'STANDARD', 'HIGH'].includes(value.water) ? value.water : 'STANDARD',
  }
}

export function normalizeChallengeDefinition(value: GameChallengeDefinition): GameChallengeDefinition {
  const territory = value.territory === 'GENERATED' || REAL_TERRITORIES.includes(value.territory)
    ? value.territory
    : 'ILE_DE_FRANCE'
  const generatedTerritory = territory === 'GENERATED' ? normalizeGeneratedTerritory(value.generatedTerritory) : null
  const definition: GameChallengeDefinition = {
    version: 1,
    id: typeof value.id === 'string' && value.id.trim() ? value.id.slice(0, 120) : `challenge-${Date.now()}`,
    kind: ['DAILY', 'FRIEND_RANDOM', 'FRIEND_CUSTOM'].includes(value.kind) ? value.kind : 'FRIEND_CUSTOM',
    title: typeof value.title === 'string' && value.title.trim() ? value.title.slice(0, 120) : 'Défi CLU',
    dateKey: typeof value.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) ? value.dateKey : undefined,
    territory,
    generatedTerritory,
    startingCapital: Number.isFinite(Number(value.startingCapital)) ? Math.min(50_000_000_000, Math.max(100_000_000, Math.round(Number(value.startingCapital)))) : 4_000_000_000,
    economyProfile: ['GENEROUS', 'STANDARD', 'HARD'].includes(value.economyProfile) ? value.economyProfile : 'HARD',
    eventFrequency: ['CALM', 'STANDARD', 'FREQUENT'].includes(value.eventFrequency) ? value.eventFrequency : 'STANDARD',
    durationMinutes: normalizeDuration(value.durationMinutes),
    difficulty: ['STANDARD', 'HARD', 'EXTREME'].includes(value.difficulty) ? value.difficulty : 'HARD',
    allowedModes: normalizeModes(value.allowedModes),
    objectives: Array.isArray(value.objectives) && value.objectives.length
      ? value.objectives.slice(0, 6).map(normalizeObjective)
      : [objective('TOTAL_PASSENGERS', 120_000, 'Transporter 120 k voyageurs', 'Cumulez au moins 120 000 voyageurs pendant le défi.')],
    constraints: Array.isArray(value.constraints) ? value.constraints.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim().slice(0, 160)).slice(0, 10) : [],
  }
  if (definition.territory === 'GENERATED' && !definition.generatedTerritory) {
    definition.generatedTerritory = createGeneratedSettings(definition.id)
  }
  return definition
}

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function dailyAllowedModes(random: () => number) {
  const presets: GameTransportMode[][] = [
    ['BUS', 'TRAM'],
    ['BUS', 'BRT', 'TRAM'],
    ['TRAM', 'METRO'],
    ['RER', 'TRAIN', 'BUS'],
    ['METRO', 'RER', 'TRAM'],
    [...ALL_MODES],
  ]
  return [...pick(random, presets)]
}

export function createDailyChallengeDefinition(dateKey = utcDateKey()): GameChallengeDefinition {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Date de Défi du jour invalide.')
  const random = seeded(`CLU-DAILY-V1:${dateKey}`)
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000)
  const territory = REAL_TERRITORIES[Math.abs(dayNumber) % REAL_TERRITORIES.length] ?? 'ILE_DE_FRANCE'
  const capitalOptions = [2_500_000_000, 3_000_000_000, 4_000_000_000, 5_000_000_000]
  const allowedModes = dailyAllowedModes(random)
  const passengerTarget = Math.round((80_000 + random() * 140_000) / 5_000) * 5_000
  const municipalityTarget = Math.max(2, Math.round(2 + random() * 5))
  const qualityTarget = Math.round(58 + random() * 18)
  const debtCap = Math.round((1_200_000_000 + random() * 1_800_000_000) / 100_000_000) * 100_000_000
  const objectives: GameChallengeObjective[] = [
    objective('TOTAL_PASSENGERS', passengerTarget, `Transporter ${compactNumber(passengerTarget)} voyageurs`, `Cumulez au moins ${compactNumber(passengerTarget)} voyageurs avant la fin du défi.`, 'AT_LEAST', 1.25),
    objective('MUNICIPALITIES_SERVED', municipalityTarget, `Desservir ${municipalityTarget} communes`, `Atteignez au moins ${municipalityTarget} communes desservies.`, 'AT_LEAST', 1),
    objective('MAX_DEBT', debtCap, 'Garder la dette sous contrôle', `Terminez avec une dette inférieure ou égale à ${compactNumber(debtCap)} €.`, 'AT_MOST', 1),
  ]
  if (random() > .45) objectives.push(objective('SERVICE_QUALITY', qualityTarget, `Qualité ≥ ${qualityTarget}/100`, `Maintenez une qualité de service finale d'au moins ${qualityTarget}/100.`, 'AT_LEAST', .9))
  const constraints = [
    `Modes autorisés : ${allowedModes.join(', ')}`,
    'Triche désactivée',
    'Durée réelle maximale : 60 minutes',
    'Échec strict en cas de situation irrécupérable',
  ]
  return normalizeChallengeDefinition({
    version: 1,
    id: `daily-${dateKey}`,
    kind: 'DAILY',
    title: `Défi du jour · ${dateKey.split('-').reverse().join('/')}`,
    dateKey,
    territory,
    startingCapital: pick(random, capitalOptions),
    economyProfile: random() > .7 ? 'STANDARD' : 'HARD',
    eventFrequency: pick(random, ['CALM', 'STANDARD', 'FREQUENT'] as const),
    durationMinutes: 60,
    difficulty: random() > .82 ? 'EXTREME' : 'HARD',
    allowedModes,
    objectives,
    constraints,
  })
}

function createGeneratedSettings(seed: string): GameGeneratedTerritorySettings {
  return {
    version: 3,
    seed: seed.replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'CLU-CHALLENGE',
    name: 'Métropole défi',
    size: 'MEDIUM',
    density: 'STANDARD',
    structure: 'POLYCENTRIC',
    water: 'STANDARD',
  }
}

export function createRandomFriendChallengeDefinition(seed = `${Date.now()}-${Math.random()}`): GameChallengeDefinition {
  const random = seeded(`CLU-FRIEND-RANDOM-V1:${seed}`)
  const useGenerated = random() < .3
  const territory: GameTerritory = useGenerated ? 'GENERATED' : pick(random, REAL_TERRITORIES)
  const durationMinutes = pick(random, [30, 45, 60] as const)
  const allowedModes = dailyAllowedModes(random)
  const passengerTarget = Math.round((60_000 + random() * 180_000) / 5_000) * 5_000
  return normalizeChallengeDefinition({
    version: 1,
    id: `friend-random-${fnv1a(seed).toString(36)}`,
    kind: 'FRIEND_RANDOM',
    title: 'Défi entre amis · Aléatoire',
    territory,
    generatedTerritory: territory === 'GENERATED' ? createGeneratedSettings(`CLU-${fnv1a(seed).toString(36).toUpperCase()}`) : null,
    startingCapital: pick(random, [2_000_000_000, 3_000_000_000, 4_000_000_000, 6_000_000_000] as const),
    economyProfile: pick(random, ['STANDARD', 'HARD'] as const),
    eventFrequency: pick(random, ['CALM', 'STANDARD', 'FREQUENT'] as const),
    durationMinutes,
    difficulty: pick(random, ['STANDARD', 'HARD', 'EXTREME'] as const),
    allowedModes,
    objectives: [
      objective('TOTAL_PASSENGERS', passengerTarget, `Transporter ${compactNumber(passengerTarget)} voyageurs`, 'Cumulez le nombre de voyageurs demandé.', 'AT_LEAST', 1.25),
      objective('OPERATIONAL_LINES', Math.max(1, Math.round(1 + random() * 2)), 'Mettre des lignes en service', 'Terminez avec le nombre demandé de lignes réellement en service.', 'AT_LEAST', 1),
      objective('SERVICE_QUALITY', Math.round(55 + random() * 22), 'Préserver la qualité', 'Maintenez une qualité de service suffisante.', 'AT_LEAST', .9),
    ],
    constraints: [`Modes autorisés : ${allowedModes.join(', ')}`, 'Même configuration pour les deux joueurs', `Durée : ${durationMinutes} min`, 'Triche désactivée'],
  })
}

export interface CustomFriendChallengeInput {
  territory: GameTerritory
  generatedTerritory?: GameGeneratedTerritorySettings | null
  startingCapital: number
  economyProfile: GameEconomyProfile
  eventFrequency: GameEventFrequency
  durationMinutes: number
  difficulty: GameChallengeDifficulty
  allowedModes: GameTransportMode[]
  objectives: GameChallengeObjective[]
}

export function createCustomFriendChallengeDefinition(input: CustomFriendChallengeInput): GameChallengeDefinition {
  const normalized = normalizeChallengeDefinition({
    version: 1,
    id: `friend-custom-${fnv1a(JSON.stringify(input)).toString(36)}`,
    kind: 'FRIEND_CUSTOM',
    title: 'Défi entre amis · Personnalisé',
    territory: input.territory,
    generatedTerritory: input.generatedTerritory,
    startingCapital: input.startingCapital,
    economyProfile: input.economyProfile,
    eventFrequency: input.eventFrequency,
    durationMinutes: input.durationMinutes,
    difficulty: input.difficulty,
    allowedModes: input.allowedModes,
    objectives: input.objectives,
    constraints: [`Modes autorisés : ${normalizeModes(input.allowedModes).join(', ')}`, 'Configuration personnalisée et versionnée', 'Triche désactivée'],
  })
  normalized.id = `friend-custom-${getChallengeDefinitionFingerprint(normalized).slice(0, 10)}`
  return normalized
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function canonicalDefinition(definition: GameChallengeDefinition) {
  return stableStringify(normalizeChallengeDefinition(definition))
}

export function getChallengeDefinitionFingerprint(definition: GameChallengeDefinition) {
  return fnv1a(canonicalDefinition(definition)).toString(36).padStart(7, '0')
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeEnvelope(prefix: string, value: unknown) {
  const body = JSON.stringify(value)
  const payload = toBase64Url(body)
  const checksum = fnv1a(`${prefix}:${payload}`).toString(36)
  return `${prefix}.${payload}.${checksum}`
}

function decodeEnvelope<T>(prefix: string, code: string): T {
  const [actualPrefix, payload, checksum, ...extra] = code.trim().split('.')
  if (actualPrefix !== prefix || !payload || !checksum || extra.length) throw new Error('Code CLU invalide ou incomplet.')
  const expected = fnv1a(`${prefix}:${payload}`).toString(36)
  if (checksum !== expected) throw new Error('Code CLU altéré : contrôle d’intégrité invalide.')
  try { return JSON.parse(fromBase64Url(payload)) as T }
  catch { throw new Error('Le contenu du code CLU est illisible.') }
}

export function encodeChallengeDefinition(definition: GameChallengeDefinition) {
  return encodeEnvelope('CLU1', { version: 1, definition: normalizeChallengeDefinition(definition) })
}

export function decodeChallengeDefinition(code: string) {
  const envelope = decodeEnvelope<{ version?: number; definition?: GameChallengeDefinition }>('CLU1', code)
  if (envelope.version !== 1 || !envelope.definition) throw new Error('Version de code défi non prise en charge.')
  return normalizeChallengeDefinition(envelope.definition)
}

export function encodeChallengeResult(definition: GameChallengeDefinition, result: GameChallengeResult) {
  const envelope: GameChallengeResultEnvelope = {
    version: 1,
    definitionFingerprint: getChallengeDefinitionFingerprint(definition),
    definitionId: definition.id,
    result,
  }
  return encodeEnvelope('CLUR1', envelope)
}

export function decodeChallengeResult(code: string) {
  const envelope = decodeEnvelope<GameChallengeResultEnvelope>('CLUR1', code)
  if (envelope.version !== 1 || !envelope.result || typeof envelope.definitionFingerprint !== 'string') throw new Error('Version de résultat défi non prise en charge.')
  return envelope
}

export function createChallengeRuntime(definition: GameChallengeDefinition, start = new Date()): GameChallengeRuntime {
  const normalized = normalizeChallengeDefinition(definition)
  const startedAt = start.toISOString()
  return {
    definition: normalized,
    startedAt,
    endsAt: new Date(start.getTime() + normalized.durationMinutes * 60_000).toISOString(),
    status: 'ACTIVE',
    readOnly: false,
    finishReason: null,
    finishedAt: null,
    result: null,
    archivedChallenge: false,
    expiresAt: null,
  }
}

export function isChallengeReadOnly(runtime: GameChallengeRuntime | null | undefined) {
  return Boolean(runtime?.readOnly || (runtime && runtime.status !== 'ACTIVE'))
}

export function challengeArchiveExpiresAt(finishedAt: string) {
  const date = new Date(finishedAt)
  if (Number.isNaN(date.getTime())) throw new Error('Date de fin de défi invalide.')
  date.setUTCDate(date.getUTCDate() + 30)
  return date.toISOString()
}

function municipalityCount(save: GameSave) {
  const latest = save.data.simulation.history.at(-1)
  return Math.max(0, Number(latest?.municipalitiesServed ?? 0))
}

function serviceQuality(save: GameSave) {
  const latest = save.data.simulation.history.at(-1)
  return Math.max(0, Math.min(100, Number(latest?.serviceQualityScore ?? 0)))
}

function resultStats(save: GameSave) {
  const lines = save.data.network.lines ?? []
  return {
    simulationDay: Math.max(1, Number(save.data.simulationDay) || 1),
    totalPassengers: Math.max(0, Number(save.data.simulation.totalPassengers) || 0),
    operationalLines: lines.filter(line => line.status === 'OPERATIONAL').length,
    stations: lines.reduce((sum, line) => sum + getLineAllStations(line).length, 0),
    municipalitiesServed: municipalityCount(save),
    balance: Number(save.data.economy.balance) || 0,
    debt: Math.max(0, Number(save.data.economy.debtPrincipal) || 0),
    serviceQuality: serviceQuality(save),
  }
}

function metricValue(metric: GameChallengeObjectiveMetric, stats: ReturnType<typeof resultStats>) {
  switch (metric) {
    case 'TOTAL_PASSENGERS': return stats.totalPassengers
    case 'MUNICIPALITIES_SERVED': return stats.municipalitiesServed
    case 'MAX_DEBT': return stats.debt
    case 'SERVICE_QUALITY': return stats.serviceQuality
    case 'OPERATIONAL_LINES': return stats.operationalLines
    case 'STATIONS': return stats.stations
    case 'MIN_BALANCE': return stats.balance
  }
}

export function evaluateChallengeObjectives(save: GameSave, definition = save.data.challenge?.definition): GameChallengeObjectiveResult[] {
  if (!definition) return []
  const stats = resultStats(save)
  return definition.objectives.map(item => {
    const value = metricValue(item.metric, stats)
    return { ...item, value, met: item.direction === 'AT_MOST' ? value <= item.target : value >= item.target }
  })
}

export function buildChallengeResult(save: GameSave, finishReason: GameChallengeFinishReason, now = new Date()): GameChallengeResult {
  const runtime = save.data.challenge
  if (!runtime) throw new Error('Cette partie n’est pas un défi.')
  const finishedAt = now.toISOString()
  const objectiveResults = evaluateChallengeObjectives(save, runtime.definition)
  const allMet = objectiveResults.length > 0 && objectiveResults.every(item => item.met)
  const forcedFailure = finishReason === 'HARD_FAILURE'
  const status: 'SUCCESS' | 'FAILED' = allMet && !forcedFailure ? 'SUCCESS' : 'FAILED'
  const stats = resultStats(save)
  const elapsed = Math.max(0, Math.min(runtime.definition.durationMinutes * 60, Math.round((now.getTime() - new Date(runtime.startedAt).getTime()) / 1000)))
  const totalWeight = objectiveResults.reduce((sum, item) => sum + item.weight, 0) || 1
  const objectiveScore = objectiveResults.reduce((sum, item) => {
    let progress = item.met ? 1 : 0
    if (!item.met && item.target > 0) {
      progress = item.direction === 'AT_MOST'
        ? Math.max(0, Math.min(1, item.target / Math.max(item.value, 1)))
        : Math.max(0, Math.min(1, item.value / item.target))
    }
    return sum + progress * item.weight
  }, 0) / totalWeight
  const efficiencyBonus = status === 'SUCCESS' ? Math.max(0, 150 - Math.round(elapsed / 24)) : 0
  const score = Math.max(0, Math.round(objectiveScore * 850 + efficiencyBonus))
  return { status, finishReason, score, playedSeconds: elapsed, finishedAt, objectives: objectiveResults, stats }
}

export function finalizeChallenge(save: GameSave, finishReason: GameChallengeFinishReason, now = new Date()) {
  const runtime = save.data.challenge
  if (!runtime || runtime.status !== 'ACTIVE') return runtime?.result ?? null
  const result = buildChallengeResult(save, finishReason, now)
  runtime.status = result.status
  runtime.readOnly = true
  runtime.finishReason = finishReason
  runtime.finishedAt = result.finishedAt
  runtime.result = result
  return result
}

export function expireChallengeIfNeeded(save: GameSave, now = new Date()) {
  const runtime = save.data.challenge
  if (!runtime || runtime.status !== 'ACTIVE') return false
  const endsAt = new Date(runtime.endsAt).getTime()
  if (!Number.isFinite(endsAt) || endsAt > now.getTime()) return false
  finalizeChallenge(save, 'TIME_LIMIT', now)
  return true
}

export function createChallengeFreePlaySettings(definition: GameChallengeDefinition) {
  const settings = createDefaultFreePlaySettings()
  settings.capitalPreset = 'CUSTOM'
  settings.startingCapital = definition.startingCapital
  settings.cheatUnlimitedMoney = false
  settings.economyProfile = definition.economyProfile
  settings.eventFrequency = definition.eventFrequency
  settings.objectivesEnabled = true
  settings.tutorialEnabled = false
  return settings
}
