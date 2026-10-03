import {
  GAME_DEMAND_COMPETITION_EXPONENT,
  GAME_DEMAND_MULTI_MUNICIPALITY_BONUS,
  GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX,
  getModeDemandDefinition,
} from '../../config/demand'
import type { GameLine, GameNetworkState, GameTransportMode } from '../../types/network'
import type { GameProjectForecast } from '../../types/projectForecast'
import type { GameMunicipality } from '../../types/territory'
import { buildNetworkTerritorySummary } from '../territory'
import { getLineAllStations } from '../network/geometry'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function stationCoverageMultiplier(stationCount: number, mode: GameTransportMode) {
  const definition = getModeDemandDefinition(mode)
  return Math.min(
    definition.maxStationCoverageMultiplier,
    1 + Math.max(0, stationCount - 1) * definition.additionalStationCoverage,
  )
}

function suggestedModeForDemand(demand: number, population: number, lengthKm: number, municipalityCount: number): GameTransportMode {
  if ((lengthKm >= 24 && population >= 320_000 && municipalityCount >= 2) || demand >= 220_000) return 'RER'
  if ((lengthKm < 28 && population >= 520_000) || demand >= 120_000) return 'METRO'
  if (population >= 220_000 || demand >= 48_000) return 'TRAM'
  if (population >= 80_000 || demand >= 18_000) return 'BRT'
  return 'BUS'
}

function forecastAdvice(
  demand: number,
  municipalityCount: number,
  interchangeCount: number,
  uncoveredStationCount: number,
) {
  if (uncoveredStationCount > 0) return 'Certaines stations sont hors des limites communales chargées : la prévision restera prudente tant que leur territoire n’est pas identifié.'
  if (municipalityCount >= 6 && demand >= 180_000) return 'Projet structurant : il relie plusieurs bassins et peut devenir un axe majeur du réseau.'
  if (interchangeCount === 0 && demand >= 45_000) return 'Le potentiel est bon, mais une correspondance avec le réseau existant pourrait nettement renforcer cette ligne.'
  if (demand >= 80_000) return 'Potentiel solide : surveillez surtout la capacité et la fréquence au moment de l’ouverture.'
  if (demand >= 25_000) return 'Projet équilibré : une desserte régulière devrait suffire au démarrage.'
  return 'Desserte locale : privilégiez une offre simple et économique, quitte à renforcer plus tard si le secteur se développe.'
}

function physicalKey(station: { id: string; sharedStationId?: string }) {
  return station.sharedStationId || station.id
}

export function buildProjectForecast(
  line: GameLine,
  network: GameNetworkState,
  municipalities: GameMunicipality[],
  estimatedCost: number,
  lengthKm: number,
): GameProjectForecast {
  const previewLine: GameLine = { ...line, status: 'OPERATIONAL' }
  const previewNetwork: GameNetworkState = {
    ...network,
    lines: [...network.lines.filter(item => item.id !== line.id), previewLine],
  }
  const lineOnlySummary = buildNetworkTerritorySummary({ ...network, lines: [previewLine] }, municipalities)
  const fullSummary = buildNetworkTerritorySummary(previewNetwork, municipalities)
  const coverage = lineOnlySummary.lines.find(item => item.lineId === line.id)
  const definition = getModeDemandDefinition(line.mode)

  let estimatedDailyDemand = 0
  if (coverage) {
    for (const municipality of coverage.municipalities) {
      const networkMunicipality = fullSummary.municipalities.find(item => item.code === municipality.code)
      const lineCount = Math.max(1, networkMunicipality?.lineCount ?? 1)
      const competitionFactor = 1 / Math.pow(lineCount, GAME_DEMAND_COMPETITION_EXPONENT)
      estimatedDailyDemand += municipality.population
        * definition.dailyPopulationCaptureRate
        * stationCoverageMultiplier(municipality.stationCount, line.mode)
        * competitionFactor
    }

    const municipalityBonus = 1 + Math.min(
      GAME_DEMAND_MULTI_MUNICIPALITY_BONUS_MAX,
      Math.max(0, coverage.municipalities.length - 1) * GAME_DEMAND_MULTI_MUNICIPALITY_BONUS,
    )
    const reachBonus = 1 + Math.min(
      definition.maxNetworkReachBonus,
      Math.max(0, coverage.municipalities.length - 1) * definition.networkReachBonusPerMunicipality,
    )
    const stationBonus = 1 + Math.min(
      definition.maxNetworkStationBonus,
      Math.max(0, getLineAllStations(line).length - 2) * definition.networkStationBonus,
    )

    estimatedDailyDemand *= municipalityBonus * reachBonus * stationBonus
    estimatedDailyDemand += coverage.uncoveredStationCount * definition.uncoveredStationFallbackPassengers
  }

  const currentPhysicalIds = new Set(getLineAllStations(line).map(physicalKey))
  const interchangePhysicalIds = new Set<string>()
  for (const other of network.lines) {
    if (other.id === line.id || other.status === 'PROJECT') continue
    for (const station of getLineAllStations(other)) {
      const key = physicalKey(station)
      if (currentPhysicalIds.has(key)) interchangePhysicalIds.add(key)
    }
  }

  const populationServed = Math.max(0, Math.round(coverage?.populationServed ?? 0))
  const municipalityCount = Math.max(0, coverage?.municipalities.length ?? 0)
  const demand = Math.max(0, Math.round(estimatedDailyDemand))
  const tone = demand >= 160_000 || municipalityCount >= 6
    ? 'STRUCTURING'
    : demand >= 30_000
      ? 'BALANCED'
      : 'LOCAL'

  return {
    municipalityCodes: coverage?.municipalities.map(item => item.code) ?? [],
    municipalityCount,
    populationServed,
    uncoveredStationCount: Math.max(0, coverage?.uncoveredStationCount ?? 0),
    interchangeCount: interchangePhysicalIds.size,
    estimatedDailyDemand: demand,
    costPerKm: lengthKm > 0 ? Math.max(0, estimatedCost / lengthKm) : 0,
    tone,
    suggestedMode: suggestedModeForDemand(demand, populationServed, lengthKm, municipalityCount),
    advice: forecastAdvice(demand, municipalityCount, interchangePhysicalIds.size, Math.max(0, coverage?.uncoveredStationCount ?? 0)),
  }
}
