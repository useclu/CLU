import {
  computed,
  watch,
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
import { generateWorldTerritory, normalizeWorldTerritorySettings, worldPlaceAnchorsSignature } from '../engine/territory/world'
import type { GameWorldPlaceAnchor } from '../types/worldTerritory'
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
const MUNICIPALITY_CACHE_MAX_ENTRIES = 24

function setMunicipalityCache(key: string, municipalities: GameMunicipality[]) {
  municipalityCache.delete(key)
  municipalityCache.set(key, municipalities)
  while (municipalityCache.size > MUNICIPALITY_CACHE_MAX_ENTRIES) {
    const oldest = municipalityCache.keys().next().value as string | undefined
    if (!oldest) break
    municipalityCache.delete(oldest)
  }
}

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

  const worldSettings = computed(
    () => normalizeWorldTerritorySettings(game.state.value.save?.data.worldTerritory),
  )

  const cacheKey = computed(() => {
    if (territoryId.value === 'GENERATED') {
      return `GENERATED:${game.state.value.save?.id ?? 'none'}:${generatedSettings.value?.seed ?? 'missing'}:${generatedSettings.value?.size ?? ''}:${generatedSettings.value?.density ?? ''}:${generatedSettings.value?.structure ?? ''}:${generatedSettings.value?.water ?? ''}`
    }
    if (territoryId.value === 'WORLD') {
      const world = worldSettings.value
      return world
        ? `WORLD:${world.countryCode}:${world.cityName}:${world.latitude.toFixed(5)}:${world.longitude.toFixed(5)}:${world.radiusKm}:${worldPlaceAnchorsSignature(world.placeAnchors)}`
        : 'WORLD:missing'
    }
    return territoryId.value
  })

  // WORLD est généré localement à partir de la sauvegarde. Lorsqu'un snapshot
  // Online apporte de nouvelles ancres territoriales, le cache doit être prêt
  // immédiatement : sinon les communes deviennent momentanément vides jusqu'à
  // un nouvel appel explicite à ensureLoaded().
  watch(cacheKey, key => {
    if (territoryId.value !== 'WORLD') return
    const settings = worldSettings.value
    if (!settings || municipalityCache.has(key)) return
    setMunicipalityCache(key, generateWorldTerritory(settings).municipalities)
    revision.value += 1
  }, { immediate: true })

  const territoryDefinition = computed(
    () => {
      if (territoryId.value === 'GENERATED') {
        if (!generatedSettings.value) throw new Error('La carte fictive ne contient pas de seed exploitable.')
        return generateGeneratedTerritory(generatedSettings.value).definition
      }
      if (territoryId.value === 'WORLD') {
        if (!worldSettings.value) throw new Error('La zone mondiale ne contient pas de ville exploitable.')
        return generateWorldTerritory(worldSettings.value).definition
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
      setMunicipalityCache(cacheKey.value, runtime.municipalities)
      revision.value += 1
      return true
    }
    if (targetTerritory === 'WORLD') {
      const settings = worldSettings.value
      if (!settings) throw new Error('La zone mondiale ne contient pas de ville exploitable.')
      const runtime = generateWorldTerritory(settings)
      setMunicipalityCache(cacheKey.value, runtime.municipalities)
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
        setMunicipalityCache(cacheKey.value, fallback.municipalities)
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

    setMunicipalityCache(cacheKey.value, loaded)
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


  async function updateWorldPlaceAnchors(anchors: GameWorldPlaceAnchor[]) {
    const save = game.state.value.save
    if (!save || save.territory !== 'WORLD') return false
    const current = normalizeWorldTerritorySettings(save.data.worldTerritory)
    if (!current) return false

    // Les localités servent à initialiser la géographie de simulation. Une fois
    // le réseau commencé, on ne déplace jamais les zones parce que de nouvelles
    // tuiles OSM viennent d'être chargées pendant un déplacement de la carte.
    if ((save.data.network.lines ?? []).length > 0 && (current.placeAnchors?.length ?? 0) > 0) return false

    const merged = new Map<string, GameWorldPlaceAnchor>()
    for (const place of [...(current.placeAnchors ?? []), ...anchors]) {
      const name = String(place?.name ?? '').trim()
      const longitude = Number(place?.longitude)
      const latitude = Number(place?.latitude)
      if (!name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
      const key = `${name.toLocaleLowerCase()}|${longitude.toFixed(3)}|${latitude.toFixed(3)}`
      if (!merged.has(key)) merged.set(key, { ...place, name, longitude, latitude })
    }
    const rank = (kind?: GameWorldPlaceAnchor['kind']) => kind === 'CITY' ? 0 : kind === 'TOWN' ? 1 : kind === 'VILLAGE' ? 2 : kind === 'SUBURB' ? 3 : 4
    const mergedAnchors = [...merged.values()]
      .sort((a, b) => rank(a.kind) - rank(b.kind) || Number(b.population ?? 0) - Number(a.population ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 56)

    const next = normalizeWorldTerritorySettings({ ...current, placeAnchors: mergedAnchors })
    if (!next) return false
    if (worldPlaceAnchorsSignature(current.placeAnchors) === worldPlaceAnchorsSignature(next.placeAnchors)) return false

    save.data.worldTerritory = next
    const runtime = generateWorldTerritory(next)
    setMunicipalityCache(cacheKey.value, runtime.municipalities)
    revision.value += 1
    await game.persistCurrentGame()
    return true
  }

  return {
    territoryId,
    territoryDefinition,
    generatedSettings,
    worldSettings,
    municipalities,
    isLoaded,
    isLoading,
    loadError,
    summary,
    ensureLoaded,
    updateWorldPlaceAnchors,
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
