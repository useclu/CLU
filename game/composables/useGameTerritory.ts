import {
  computed,
} from 'vue'

import {
  useState,
} from '#app'

import {
  getGameTerritoryMapDefinition,
} from '../config/territories'

import {
  buildNetworkTerritorySummary,
  parseMunicipalityFeatureCollection,
} from '../engine/territory'
import {
  generateGeneratedTerritory,
  normalizeGeneratedTerritorySettings,
} from '../engine/territory/generator'
import { getRealTerritoryMunicipalityFallback } from '../engine/territory/realTerritories'

import type {
  GameMunicipality,
} from '../types/territory'

import type {
  GameTerritory,
} from '../types/game'

import {
  useGameNetwork,
} from './useGameNetwork'
import { useMetropoleGame } from './useMetropoleGame'

const municipalityCache = new Map<string, GameMunicipality[]>()
const municipalityLoadPromises = new Map<string, Promise<boolean>>()

function createGameTerritory() {
  const network = useGameNetwork()
  const game = useMetropoleGame()

  const revision = useState<number>(
    'clu-metropole-territory-revision',
    () => 0,
  )

  const isLoading = useState<boolean>(
    'clu-metropole-territory-loading',
    () => false,
  )

  const loadError = useState<string | null>(
    'clu-metropole-territory-error',
    () => null,
  )

  const territoryId = computed<GameTerritory>(
    () => game.state.value.save?.territory ?? 'ILE_DE_FRANCE',
  )

  const generatedSettings = computed(
    () => normalizeGeneratedTerritorySettings(game.state.value.save?.data.generatedTerritory),
  )

  const cacheKey = computed(() => territoryId.value === 'GENERATED'
    ? `GENERATED:${game.state.value.save?.id ?? 'none'}:${generatedSettings.value?.seed ?? 'missing'}:${generatedSettings.value?.size ?? ''}:${generatedSettings.value?.density ?? ''}:${generatedSettings.value?.structure ?? ''}:${generatedSettings.value?.water ?? ''}`
    : territoryId.value)

  const territoryDefinition = computed(
    () => {
      if (territoryId.value === 'GENERATED') {
        if (!generatedSettings.value) throw new Error('La carte fictive ne contient pas de seed exploitable.')
        return generateGeneratedTerritory(generatedSettings.value).definition
      }
      return getGameTerritoryMapDefinition(territoryId.value)
    },
  )

  const municipalities = computed(
    () => {
      void revision.value
      const base = municipalityCache.get(cacheKey.value) ?? []
      const save = game.state.value.save
      const development = save?.data.municipalities?.development ?? []
      const projects = save?.data.municipalities?.urbanProjects ?? []
      const events = save?.data.municipalities?.localEvents ?? []
      if (!development.length && !projects.length && !events.length) return base

      const populations = new Map(development.map(item => [item.code, item.population] as const))
      const projectBonus = new Map<string, number>()
      for (const project of projects) {
        const fullBonus = Math.max(0, Number(project.mobilityDemandBonus ?? 0))
        if (fullBonus <= 0) continue
        const day = save?.data.simulationDay ?? 1
        let progress = 0
        if (project.status === 'CONSTRUCTION') {
          const span = Math.max(1, project.openingDay - project.constructionStartDay)
          progress = 0.08 + Math.min(0.17, Math.max(0, day - project.constructionStartDay) / span * 0.17)
        }
        else if (project.status === 'OPENED') {
          const span = Math.max(1, project.maturityDay - project.openingDay)
          progress = 0.55 + Math.min(0.45, Math.max(0, day - project.openingDay) / span * 0.45)
        }
        else if (project.status === 'MATURE') progress = 1
        if (progress <= 0) continue
        projectBonus.set(project.municipalityCode, (projectBonus.get(project.municipalityCode) ?? 0) + fullBonus * progress)
      }
      const eventMultiplier = new Map<string, number>()
      const eventServiceBoosts = new Map<string, Record<string, number>>()
      for (const event of events) {
        const currentDay = save?.data.simulationDay ?? 1
        const active = event.status === 'ACTIVE'
        const eve = event.status === 'ANNOUNCED' && event.startsDay - currentDay === 1
        if (!active && !eve) continue
        const fullMultiplier = Math.max(1, Number(event.demandMultiplier ?? 1))
        const appliedMultiplier = active ? fullMultiplier : 1 + (fullMultiplier - 1) * (event.scale === 'MEGA' ? 0.22 : event.scale === 'MAJOR' ? 0.14 : 0.08)
        eventMultiplier.set(
          event.municipalityCode,
          (eventMultiplier.get(event.municipalityCode) ?? 1) * appliedMultiplier,
        )
        if (active && event.preparedLineId && event.preparationLevel) {
          const current = { ...(eventServiceBoosts.get(event.municipalityCode) ?? {}) }
          const serviceBoost = event.serviceKind === 'EVENT_SHUTTLE'
            ? (event.preparationLevel === 'STRONG' ? 1.55 : 1.30)
            : event.serviceKind === 'LATE_SERVICE'
              ? (event.preparationLevel === 'STRONG' ? 1.22 : 1.12)
              : (event.preparationLevel === 'STRONG' ? 1.40 : 1.20)
          current[event.preparedLineId] = Math.max(
            current[event.preparedLineId] ?? 1,
            serviceBoost,
          )
          eventServiceBoosts.set(event.municipalityCode, current)
        }
      }

      return base.map(municipality => {
        const population = populations.get(municipality.code)
        const openedProjectMultiplier = 1 + Math.min(0.65, projectBonus.get(municipality.code) ?? 0)
        const localEventMultiplier = Math.min(2.2, eventMultiplier.get(municipality.code) ?? 1)
        const mobilityDemandMultiplier = openedProjectMultiplier * localEventMultiplier
        return {
          ...municipality,
          population: Number.isFinite(population) ? Math.max(0, Math.round(Number(population))) : municipality.population,
          mobilityDemandMultiplier,
          lineServiceMultipliers: eventServiceBoosts.get(municipality.code),
        }
      })
    },
  )

  const isLoaded = computed(
    () => {
      void revision.value
      return municipalityCache.has(cacheKey.value)
    },
  )

  const summary = computed(
    () => buildNetworkTerritorySummary(
      {
        lines: network.lines.value,
      },
      municipalities.value,
      network.activeLineId.value,
    ),
  )

  async function loadMunicipalities(targetTerritory = territoryId.value) {
    if (targetTerritory === 'GENERATED') {
      const settings = generatedSettings.value
      if (!settings) throw new Error('La carte fictive ne contient pas de seed exploitable.')
      const runtime = generateGeneratedTerritory(settings)
      municipalityCache.set(cacheKey.value, runtime.municipalities)
      revision.value += 1
      return true
    }

    const definition = getGameTerritoryMapDefinition(targetTerritory)
    let results: GameMunicipality[][] = []
    let localAdministrativeDataMissing = false

    try {
      results = await Promise.all(
        definition.municipalityGeoJsonPaths.map(
          async path => {
            const response = await fetch(path)
            if (!response.ok) throw new Error(`Impossible de charger ${path} (${response.status}).`)
            const data = await response.json()
            return parseMunicipalityFeatureCollection(data)
          },
        ),
      )
    }
    catch {
      localAdministrativeDataMissing = true
    }

    if ((localAdministrativeDataMissing || results.length === 0) && targetTerritory !== 'ILE_DE_FRANCE') {
      const fallback = getRealTerritoryMunicipalityFallback(targetTerritory)
      if (fallback) {
        municipalityCache.set(cacheKey.value, fallback.municipalities)
        revision.value += 1
        return true
      }
    }

    const uniqueMunicipalities = new Map<
      string,
      GameMunicipality
    >()

    for (const municipalityList of results) {
      for (const municipality of municipalityList) {
        uniqueMunicipalities.set(
          municipality.code,
          municipality,
        )
      }
    }

    const loaded = Array.from(
      uniqueMunicipalities.values(),
    )

    if (loaded.length === 0) {
      throw new Error(
        `Aucune commune valide n’a été trouvée pour ${definition.label}.`,
      )
    }

    municipalityCache.set(cacheKey.value, loaded)
    revision.value += 1

    return true
  }

  async function ensureLoaded() {
    const targetTerritory = territoryId.value
    const key = cacheKey.value
    if (municipalityCache.has(key)) {
      return true
    }

    const pending = municipalityLoadPromises.get(key)
    if (pending) return await pending

    isLoading.value = true
    loadError.value = null

    const promise = loadMunicipalities(targetTerritory)
      .catch(
        error => {
          loadError.value = error instanceof Error
            ? error.message
            : 'Erreur inconnue lors du chargement des communes.'

          return false
        },
      )
      .finally(
        () => {
          isLoading.value = false
          municipalityLoadPromises.delete(key)
        },
      )

    municipalityLoadPromises.set(key, promise)
    return await promise
  }

  return {
    territoryId,
    territoryDefinition,
    generatedSettings,
    municipalities,
    isLoaded,
    isLoading,
    loadError,
    summary,
    ensureLoaded,
  }
}

type GameTerritoryRuntime = ReturnType<typeof createGameTerritory>
let sharedGameTerritory: GameTerritoryRuntime | null = null

export function useGameTerritory() {
  // Territoire unique pour toute la SPA : le calcul des communes enrichies et du résumé réseau
  // peut être coûteux sur les grandes cartes. Tous les consommateurs partagent donc le même
  // graphe de computed au lieu de le reconstruire plusieurs fois.
  if (!sharedGameTerritory) sharedGameTerritory = createGameTerritory()
  return sharedGameTerritory
}
