import { currentGameLocaleTag } from '../../config/i18n'
import { getAvailableGameTerritories } from '../../config/territories'
import { createDefaultFreePlaySettings } from '../../config/freePlay'
import { WORLD_DEFAULT_RADIUS_KM } from '../../config/worldMap'
import { getLineAllStations } from '../network/geometry'
import type { GameSave, GameTerritory } from '../../types/game'
import type { GameGeneratedTerritorySettings } from '../../types/generatedTerritory'
import type { GameWorldTerritorySettings } from '../../types/worldTerritory'
import type { GameTransportMode } from '../../types/network'
import { normalizeWorldTerritorySettings, worldPreferredLocale } from '../territory/world'
import type {
  GameChallengeDefinition,
  GameChallengeFinishReason,
  GameChallengeObjective,
  GameChallengeObjectiveMetric,
  GameChallengeObjectiveResult,
  GameChallengeResult,
  GameChallengeRuntime,
} from '../../types/challenges'

const ALL_MODES: GameTransportMode[] = ['METRO', 'TRAM', 'RER', 'TRAIN', 'TER', 'TGV', 'CAR', 'BUS', 'BRT', 'CABLE', 'FERRY']
const REAL_TERRITORIES = getAvailableGameTerritories().map(entry => entry.id).filter(id => id !== 'WORLD' && id !== 'GENERATED') as GameTerritory[]

const DAILY_WORLD_CITIES: ReadonlyArray<Omit<GameWorldTerritorySettings, 'version' | 'radiusKm' | 'preferredLocale' | 'displayName'> & { adminName?: string | null }> = [
  { cityName: 'Paris', countryName: 'France', countryCode: 'FR', adminName: 'Île-de-France', longitude: 2.3522, latitude: 48.8566, estimatedPopulation: 2_100_000, osmType: 'R', osmId: null },
  { cityName: 'Rennes', countryName: 'France', countryCode: 'FR', adminName: 'Bretagne', longitude: -1.6778, latitude: 48.1173, estimatedPopulation: 225_000, osmType: 'R', osmId: null },
  { cityName: 'Lyon', countryName: 'France', countryCode: 'FR', adminName: 'Auvergne-Rhône-Alpes', longitude: 4.8357, latitude: 45.7640, estimatedPopulation: 530_000, osmType: 'R', osmId: null },
  { cityName: 'Rabat', countryName: 'Maroc', countryCode: 'MA', adminName: 'Rabat-Salé-Kénitra', longitude: -6.8498, latitude: 34.0209, estimatedPopulation: 580_000, osmType: 'R', osmId: null },
  { cityName: 'Marrakech', countryName: 'Maroc', countryCode: 'MA', adminName: 'Marrakech-Safi', longitude: -7.9811, latitude: 31.6295, estimatedPopulation: 930_000, osmType: 'R', osmId: null },
  { cityName: 'Lausanne', countryName: 'Suisse', countryCode: 'CH', adminName: 'Vaud', longitude: 6.6323, latitude: 46.5197, estimatedPopulation: 145_000, osmType: 'R', osmId: null },
  { cityName: 'Zürich', countryName: 'Suisse', countryCode: 'CH', adminName: 'Zürich', longitude: 8.5417, latitude: 47.3769, estimatedPopulation: 440_000, osmType: 'R', osmId: null },
  { cityName: 'London', countryName: 'United Kingdom', countryCode: 'GB', adminName: 'England', longitude: -0.1276, latitude: 51.5072, estimatedPopulation: 8_900_000, osmType: 'R', osmId: null },
  { cityName: 'Manchester', countryName: 'United Kingdom', countryCode: 'GB', adminName: 'England', longitude: -2.2426, latitude: 53.4808, estimatedPopulation: 570_000, osmType: 'R', osmId: null },
  { cityName: 'Budapest', countryName: 'Hongrie', countryCode: 'HU', adminName: null, longitude: 19.0402, latitude: 47.4979, estimatedPopulation: 1_680_000, osmType: 'R', osmId: null },
  { cityName: 'Berlin', countryName: 'Allemagne', countryCode: 'DE', adminName: 'Berlin', longitude: 13.4050, latitude: 52.5200, estimatedPopulation: 3_800_000, osmType: 'R', osmId: null },
  { cityName: 'Madrid', countryName: 'Espagne', countryCode: 'ES', adminName: 'Comunidad de Madrid', longitude: -3.7038, latitude: 40.4168, estimatedPopulation: 3_300_000, osmType: 'R', osmId: null },
  { cityName: 'Lisboa', countryName: 'Portugal', countryCode: 'PT', adminName: 'Lisboa', longitude: -9.1393, latitude: 38.7223, estimatedPopulation: 550_000, osmType: 'R', osmId: null },
  { cityName: 'Warszawa', countryName: 'Polska', countryCode: 'PL', adminName: 'Mazowieckie', longitude: 21.0122, latitude: 52.2297, estimatedPopulation: 1_860_000, osmType: 'R', osmId: null },
  { cityName: 'New York', countryName: 'United States', countryCode: 'US', adminName: 'New York', longitude: -74.0060, latitude: 40.7128, estimatedPopulation: 8_300_000, osmType: 'R', osmId: null },
  { cityName: 'Montréal', countryName: 'Canada', countryCode: 'CA', adminName: 'Québec', longitude: -73.5673, latitude: 45.5017, estimatedPopulation: 1_800_000, osmType: 'R', osmId: null },
  { cityName: 'São Paulo', countryName: 'Brasil', countryCode: 'BR', adminName: 'São Paulo', longitude: -46.6333, latitude: -23.5505, estimatedPopulation: 11_500_000, osmType: 'R', osmId: null },
  { cityName: 'Tokyo', countryName: '日本', countryCode: 'JP', adminName: 'Tokyo', longitude: 139.6917, latitude: 35.6895, estimatedPopulation: 14_000_000, osmType: 'R', osmId: null },
  { cityName: 'Sydney', countryName: 'Australia', countryCode: 'AU', adminName: 'New South Wales', longitude: 151.2093, latitude: -33.8688, estimatedPopulation: 5_300_000, osmType: 'R', osmId: null },
  { cityName: 'Auckland', countryName: 'New Zealand', countryCode: 'NZ', adminName: 'Auckland', longitude: 174.7633, latitude: -36.8485, estimatedPopulation: 1_700_000, osmType: 'R', osmId: null },
]

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
  let territory = value.territory === 'WORLD' || value.territory === 'GENERATED' || REAL_TERRITORIES.includes(value.territory)
    ? value.territory
    : 'ILE_DE_FRANCE'
  const generatedTerritory = territory === 'GENERATED' ? normalizeGeneratedTerritory(value.generatedTerritory) : null
  const worldTerritory = territory === 'WORLD' ? normalizeWorldTerritorySettings(value.worldTerritory) : null
  if (territory === 'WORLD' && !worldTerritory) territory = 'ILE_DE_FRANCE'
  const definition: GameChallengeDefinition = {
    version: 1,
    id: typeof value.id === 'string' && value.id.trim() ? value.id.slice(0, 120) : `challenge-${Date.now()}`,
    kind: ['DAILY', 'FRIEND_RANDOM', 'FRIEND_CUSTOM'].includes(value.kind) ? value.kind : 'DAILY',
    title: typeof value.title === 'string' && value.title.trim() ? value.title.slice(0, 120) : 'Défi CLU',
    dateKey: typeof value.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) ? value.dateKey : undefined,
    territory,
    generatedTerritory,
    worldTerritory: territory === 'WORLD' ? worldTerritory : null,
    startingCapital: Number.isFinite(Number(value.startingCapital)) ? Math.min(50_000_000_000, Math.max(100_000_000, Math.round(Number(value.startingCapital)))) : 4_000_000_000,
    economyProfile: ['GENEROUS', 'STANDARD', 'HARD'].includes(value.economyProfile) ? value.economyProfile : 'HARD',
    eventFrequency: ['CALM', 'STANDARD', 'FREQUENT'].includes(value.eventFrequency) ? value.eventFrequency : 'STANDARD',
    durationMinutes: normalizeDuration(value.durationMinutes),
    difficulty: ['STANDARD', 'HARD', 'EXTREME'].includes(value.difficulty) ? value.difficulty : 'HARD',
    allowedModes: normalizeModes(value.allowedModes),
    objectives: Array.isArray(value.objectives) && value.objectives.length
      ? value.objectives.slice(0, 6).map(normalizeObjective)
      : [objective('TOTAL_PASSENGERS', 8_000_000, 'Transporter 8 M voyageurs', 'Cumulez au moins 8 millions de voyageurs pendant le défi.')],
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

function dailyWorldTerritory(random: () => number): GameWorldTerritorySettings {
  const base = pick(random, DAILY_WORLD_CITIES)
  const radiusOptions = [20, 30, 40, 50, 60, 80, 100] as const
  const radiusKm = pick(random, radiusOptions)
  return normalizeWorldTerritorySettings({
    ...base,
    version: 1,
    displayName: [base.cityName, base.adminName, base.countryName].filter(Boolean).join(', '),
    radiusKm: radiusKm || WORLD_DEFAULT_RADIUS_KM,
    preferredLocale: worldPreferredLocale(base.countryCode),
    placeAnchors: [{
      name: base.cityName, longitude: base.longitude, latitude: base.latitude, kind: 'CITY', population: base.estimatedPopulation ?? null,
    }],
  })!
}

function dailyAllowedModes(random: () => number) {
  const presets: GameTransportMode[][] = [
    ['BUS', 'TRAM'],
    ['BUS', 'BRT', 'TRAM'],
    ['TRAM', 'METRO'],
    ['RER', 'TRAIN', 'TER', 'CAR'],
    ['METRO', 'RER', 'TRAM'],
    [...ALL_MODES],
  ]
  return [...pick(random, presets)]
}

function dailyPassengerTarget(random: () => number, allowedModes: GameTransportMode[], radiusKm: number) {
  // Voyageurs 2.0 produit désormais plusieurs centaines de milliers de voyages/jour
  // sur une ligne structurante. La cible dépend aussi de l'étendue réellement
  // jouable : un défi de 20 km ne doit pas demander le même cumul qu'un WORLD 100 km.
  const hasHighCapacityMode = allowedModes.some(mode => mode === 'METRO' || mode === 'RER' || mode === 'TRAIN' || mode === 'TER' || mode === 'TGV')
  const minimum = hasHighCapacityMode ? 9_000_000 : 6_000_000
  const maximum = hasHighCapacityMode ? 22_000_000 : 14_000_000
  const radiusFactor = Math.min(1.28, Math.max(0.7, 0.62 + radiusKm / 150))
  const target = (minimum + random() * (maximum - minimum)) * radiusFactor
  return Math.max(4_000_000, Math.round(target / 250_000) * 250_000)
}

export function createDailyChallengeDefinition(dateKey = utcDateKey()): GameChallengeDefinition {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Date de Défi du jour invalide.')
  const random = seeded(`CLU-DAILY-WORLD-V2:${dateKey}`)
  const worldTerritory = dailyWorldTerritory(random)
  const territory: GameTerritory = 'WORLD'
  const capitalOptions = [2_500_000_000, 3_000_000_000, 4_000_000_000, 5_000_000_000]
  const allowedModes = dailyAllowedModes(random).filter(mode => {
    if (mode === 'TGV') return worldTerritory.radiusKm >= 60
    if (mode === 'TER') return worldTerritory.radiusKm >= 30
    if (mode === 'CAR') return worldTerritory.radiusKm >= 20
    return true
  })
  const passengerTarget = dailyPassengerTarget(random, allowedModes, worldTerritory.radiusKm)
  const municipalityTarget = Math.max(2, Math.min(10, Math.round(2 + worldTerritory.radiusKm / 18 + random() * 3)))
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
    worldTerritory,
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
