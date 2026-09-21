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

export function useGameTerritory() {
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
      return municipalityCache.get(cacheKey.value) ?? []
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
