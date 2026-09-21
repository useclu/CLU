<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import type {
  Map as MapLibreMap,
} from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import {
  getTransportModeDefinition,
} from '../../config/transportModes'

import type {
  GameInterchangeLink,
  GameLine,
  GameLineRoutingMode,
  GameTransportMode,
} from '../../types/network'
import type { GameTerritory } from '../../types/game'
import type { GameGeneratedTerritorySettings } from '../../types/generatedTerritory'
import type { GameVisualVehicle } from '../../engine/transitRuntime'
import {
  findLineStation,
  getLineAllStations,
  getLineTerminusStations,
} from '../../engine/network/geometry'
import {
  calculateLineCorridorOffsets,
  getLineJunctionStationIds,
  getRenderedLineSequences,
} from '../../engine/network/renderGeometry'
import { getGameTerritoryMapDefinition } from '../../config/territories'
import { generateGeneratedTerritory, normalizeGeneratedTerritorySettings } from '../../engine/territory/generator'
import { getRealTerritoryMunicipalityFallback } from '../../engine/territory/realTerritories'
import { buildSmartRoutingGraph, routeThroughWaypoints, type SmartRouteCoordinate, type SmartRoutingGraph } from '../../engine/network/smartRouting'

interface GameMapDraftAnchor {
  longitude: number
  latitude: number
  stationId?: string | null
  kind?: string
}

const props = defineProps<{
  lines: GameLine[]
  activeLineId: string | null
  selectedLineId?: string | null
  selectedStationId?: string | null
  territoryId?: GameTerritory
  generatedTerritory?: GameGeneratedTerritorySettings | null
  draftAnchor?: GameMapDraftAnchor | null
  draftGuidePoints?: Array<[number, number]>
  routingMode?: GameLineRoutingMode
  building: boolean
  interchanges?: GameInterchangeLink[]
  vehicles?: GameVisualVehicle[]
  showVehicleAnimations?: boolean
  showBuildings2D5?: boolean
  graphicsQuality?: 'ECO' | 'BALANCED' | 'HIGH'
}>()

const emit = defineEmits<{
  mapClick: [longitude: number, latitude: number, routeCoordinates?: SmartRouteCoordinate[]]
  draftPreview: [longitude: number | null, latitude: number | null, routeCoordinates?: SmartRouteCoordinate[]]
  lineClick: [lineId: string]
  stationClick: [lineId: string, stationId: string]
  vehicleClick: [vehicle: GameVisualVehicle]
  loadingProgress: [message: string, progress: number]
  ready: []
  loadError: [message: string]
}>()

interface GeoJsonFeature {
  type: 'Feature'
  properties: {
    nom?: string
    code?: string
    population?: number
    codeDepartement?: string
    [key: string]: unknown
  }
  geometry: {
    type: string
    coordinates: unknown
  }
}

interface GeoJsonCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

interface SelectedCommune {
  name: string
  code: string
  department: string
  population: number | null
}

interface MutableGeoJsonSource {
  setData: (data: unknown) => void
}

function localTerritoryRuntime() {
  const territory = props.territoryId ?? 'ILE_DE_FRANCE'
  if (territory !== 'GENERATED') return null
  const settings = normalizeGeneratedTerritorySettings(props.generatedTerritory)
  if (!settings) throw new Error('La carte fictive ne contient pas de seed exploitable.')
  return generateGeneratedTerritory(settings)
}

function realTerritoryMunicipalityFallback() {
  const territory = props.territoryId ?? 'ILE_DE_FRANCE'
  if (territory === 'GENERATED' || territory === 'ILE_DE_FRANCE') return null
  return getRealTerritoryMunicipalityFallback(territory)
}

function territoryDefinition() {
  const runtime = localTerritoryRuntime()
  return runtime?.definition ?? getGameTerritoryMapDefinition(props.territoryId ?? 'ILE_DE_FRANCE')
}


const mapContainer =
  ref<HTMLDivElement | null>(null)

const mapReady =
  ref(false)

const loadingMessage =
  ref('Chargement du fond de carte…')

const mapError =
  ref<string | null>(null)

const loadedCommunes =
  ref(0)

const selectedCommune =
  ref<SelectedCommune | null>(null)

let map:
  MapLibreMap | null =
  null

let hoveredCommuneCode:
  string | null =
  null

let removePmtilesProtocol:
  (() => void) | null =
  null

let maplibreApi: typeof import('maplibre-gl') | null = null
let resizeObserver: ResizeObserver | null = null
let startupTimeout: number | null = null
let lastMapRuntimeError: string | null = null

function setLoading(message: string, progress: number) {
  loadingMessage.value = message
  emit('loadingProgress', message, Math.max(0, Math.min(100, progress)))
}

function failMap(error: unknown, fallback = 'Impossible de charger la carte.') {
  if (startupTimeout !== null) {
    window.clearTimeout(startupTimeout)
    startupTimeout = null
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  mapError.value = message || fallback
  emit('loadError', mapError.value)
}

function waitForSourceLoaded(sourceId: string, timeoutMs = 6500) {
  return new Promise<void>((resolve, reject) => {
    if (!map) return reject(new Error('Le moteur cartographique n’est plus disponible.'))
    const startedAt = performance.now()
    let timer: number | null = null

    const cleanup = () => {
      try { map?.off('sourcedata', onSourceData) } catch {}
      if (timer !== null) window.clearInterval(timer)
      timer = null
    }
    const check = () => {
      if (!map) {
        cleanup()
        reject(new Error('Le moteur cartographique a été interrompu.'))
        return
      }
      try {
        if (map.isSourceLoaded(sourceId)) {
          cleanup()
          resolve()
          return
        }
      }
      catch {}
      if (performance.now() - startedAt > timeoutMs) {
        cleanup()
        reject(new Error(`Le fond de carte « ${territoryDefinition().label} » met anormalement longtemps à se préparer.`))
      }
    }
    const onSourceData = () => check()
    map.on('sourcedata', onSourceData)
    timer = window.setInterval(check, 120)
    check()
  })
}

let interchangeMarkers: Array<{ marker: { remove: () => void }; element: HTMLElement }> = []
let interchangeMarkerSignature = ''
let stationMarkers: Array<{ marker: { remove: () => void }; element: HTMLElement; lineId: string }> = []
let stationMarkerSignature = ''
let draftCursor: { longitude: number; latitude: number } | null = null
let draftPreviewCoordinates: SmartRouteCoordinate[] = []
let draftPreviewFrame: number | null = null
const routingGraphCache = new Map<string, SmartRoutingGraph | null>()
let staticRoutingRevision = 0
let lastStaticGraphRevision = -1

function detailZoom(kind: 'BUILDINGS' | 'BUILDINGS_3D' | 'VEHICLES') {
  const quality = props.graphicsQuality ?? 'BALANCED'
  if (kind === 'BUILDINGS') return quality === 'HIGH' ? 10.7 : quality === 'ECO' ? 12.4 : 11.5
  if (kind === 'BUILDINGS_3D') return quality === 'HIGH' ? 12.0 : quality === 'ECO' ? 14.2 : 13.2
  return quality === 'HIGH' ? 7.8 : quality === 'ECO' ? 10.2 : 8.4
}

function generatedDetailZoom(kind: 'BLOCKS' | 'STREETS' | 'BUILDINGS' | 'BUILDINGS_3D' | 'POI') {
  const quality = props.graphicsQuality ?? 'BALANCED'
  if (kind === 'BLOCKS') return quality === 'ECO' ? 7.1 : quality === 'HIGH' ? 5.95 : 6.15
  if (kind === 'STREETS') return quality === 'ECO' ? 9.5 : quality === 'HIGH' ? 7.65 : 8.15
  if (kind === 'BUILDINGS') return quality === 'ECO' ? 10.7 : quality === 'HIGH' ? 8.25 : 8.75
  if (kind === 'BUILDINGS_3D') return quality === 'ECO' ? 12.8 : quality === 'HIGH' ? 10.7 : 11.35
  return quality === 'ECO' ? 10.0 : quality === 'HIGH' ? 7.9 : 8.45
}

function territoryDepartmentColorExpression(): any {
  const values: unknown[] = ['match', ['get', 'codeDepartement']]
  for (const department of territoryDefinition().departments) {
    values.push(department.code, department.color)
  }
  values.push('#6f7b88')
  return values
}

function territoryNameExpression(): any {
  const locale = territoryDefinition().preferredLocale
  return [
    'coalesce',
    ['get', `name:${locale}`],
    ['get', 'name'],
  ]
}

function lineWidthExpression(extra = 0): any {
  return [
    '+',
    [
      '*',
      ['get', 'width'],
      ['interpolate', ['linear'], ['zoom'], 6, .62, 9, .84, 12, 1, 15, 1.14],
    ],
    extra,
  ]
}

function focusedLineOpacity(): any {
  return [
    'case',
    ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .22,
    ['==', ['get', 'status'], 'PROJECT'], .84,
    1,
  ]
}

function focusedStationOpacity(): any {
  return [
    'case',
    ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .58,
    1,
  ]
}

function hasSetData(
  source: unknown,
): source is MutableGeoJsonSource {
  if (
    typeof source !== 'object'
    || source === null
    || !('setData' in source)
  ) {
    return false
  }

  return typeof Reflect.get(
    source,
    'setData',
  ) === 'function'
}

async function resolveBasemapUrl() {
  const definition = territoryDefinition()
  if (definition.kind !== 'STATIC') return null

  if (definition.basemapPath) {
    try {
      const response = await fetch(definition.basemapPath, { method: 'HEAD', cache: 'no-cache' })
      if (response.ok) return new URL(definition.basemapPath, window.location.origin).href
    }
    catch {}
  }

  throw new Error(
    `Le fond de carte réel de ${definition.label} est absent. Installez l’extrait PMTiles local correspondant.`,
  )
}

async function loadCommunes():
Promise<GeoJsonCollection> {
  const allFeatures: GeoJsonFeature[] = []
  const definition = territoryDefinition()
  const runtime = localTerritoryRuntime()
  if (runtime) {
    loadedCommunes.value = runtime.municipalities.length
    return runtime.municipalityGeoJson as GeoJsonCollection
  }

  let localAdministrativeDataMissing = false
  for (const [index, path] of definition.municipalityGeoJsonPaths.entries()) {
    setLoading(`Chargement des communes ${index + 1}/${definition.municipalityGeoJsonPaths.length}…`, 18 + Math.round(((index + 1) / Math.max(1, definition.municipalityGeoJsonPaths.length)) * 12))

    try {
      const response = await fetch(path, { cache: 'no-cache' })
      if (!response.ok) {
        localAdministrativeDataMissing = true
        break
      }

      const data: GeoJsonCollection = await response.json()
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        localAdministrativeDataMissing = true
        break
      }

      allFeatures.push(...data.features)
      loadedCommunes.value = allFeatures.length
    }
    catch {
      localAdministrativeDataMissing = true
      break
    }
  }

  if ((localAdministrativeDataMissing || allFeatures.length === 0) && props.territoryId !== 'ILE_DE_FRANCE') {
    const fallback = realTerritoryMunicipalityFallback()
    if (fallback) {
      loadedCommunes.value = fallback.municipalities.length
      return fallback.municipalityGeoJson as GeoJsonCollection
    }
  }

  if (allFeatures.length === 0) {
    throw new Error(`Aucune limite communale exploitable n’a été trouvée pour ${definition.label}.`)
  }

  return { type: 'FeatureCollection', features: allFeatures }
}

function getLineCollection() {
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  const focusContext = focusLineId ? 1 : 0
  const corridorOffsets = calculateLineCorridorOffsets(props.lines)
  return {
    type: 'FeatureCollection',
    features: props.lines.flatMap((line, lineIndex) => {
      const mode = getTransportModeDefinition(line.mode)
      return getRenderedLineSequences(line).map((sequence, sequenceIndex) => ({
        type: 'Feature',
        properties: {
          id: line.id,
          segmentId: sequence.id,
          sequenceIndex,
          lineIndex,
          branch: sequence.kind === 'BRANCH' ? 1 : 0,
          name: line.name,
          mode: line.mode,
          status: line.status,
          color: line.color,
          width: mode.mapLineWidth,
          stationRadius: mode.stationRadius,
          active: line.id === props.activeLineId ? 1 : 0,
          selected: line.id === props.selectedLineId ? 1 : 0,
          focused: line.id === focusLineId ? 1 : 0,
          focusContext,
          corridorOffset: corridorOffsets.get(line.id) ?? 0,
        },
        geometry: {
          type: 'LineString',
          coordinates: sequence.coordinates,
        },
      }))
    }),
  }
}

function getStationCollection() {
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  const focusContext = focusLineId ? 1 : 0
  const interchangeStationIds = new Set<string>()
  for (const link of props.interchanges ?? []) {
    interchangeStationIds.add(`${link.fromLineId}:${link.fromStationId}`)
    interchangeStationIds.add(`${link.toLineId}:${link.toStationId}`)
  }

  return {
    type: 'FeatureCollection',
    features: props.lines.flatMap(
      line => {
        const mode =
          getTransportModeDefinition(
            line.mode,
          )
        const terminusIds = new Set(getLineTerminusStations(line).map(station => station.id))
        const junctionIds = getLineJunctionStationIds(line)

        return getLineAllStations(line).map(
          (station, index) => ({
            type: 'Feature',
            properties: {
              id: station.id,
              lineId: line.id,
              lineName: line.name,
              mode: line.mode,
              name: station.name,
              color: line.color,
              stationRadius:
                mode.stationRadius,
              active:
                line.id === props.activeLineId
                  ? 1
                  : 0,
              selectedLine: line.id === props.selectedLineId ? 1 : 0,
              selectedStation: station.id === props.selectedStationId ? 1 : 0,
              draftAnchor: station.id === props.draftAnchor?.stationId ? 1 : 0,
              focused: line.id === focusLineId ? 1 : 0,
              focusContext,
              terminus: terminusIds.has(station.id) ? 1 : 0,
              junction: junctionIds.has(station.id) ? 1 : 0,
              interchange: interchangeStationIds.has(`${line.id}:${station.id}`) ? 1 : 0,
              index,
            },
            geometry: {
              type: 'Point',
              coordinates: [
                station.longitude,
                station.latitude,
              ],
            },
          }),
        )
      },
    ),
  }
}

function activeDraftLine() {
  const id = props.activeLineId
  return id ? props.lines.find(line => line.id === id) ?? null : null
}

function routingCorridorKinds(mode: GameTransportMode) {
  if (mode === 'TRAIN' || mode === 'RER') return ['rail', 'major_road']
  if (mode === 'TRAM') return ['rail', 'major_road', 'minor_road', 'street']
  if (mode === 'BUS' || mode === 'BRT') return ['highway', 'major_road', 'minor_road', 'street']
  return ['rail', 'major_road']
}

function routingCorridorFilter(local: boolean): any {
  const line = activeDraftLine()
  const mode = line?.mode ?? 'METRO'
  const kinds = routingCorridorKinds(mode)
  const kindFilter: any = ['in', ['get', 'kind'], ['literal', kinds]]
  return local
    ? ['all', ['==', ['get', 'layer'], 'road'], kindFilter]
    : kindFilter
}

function refreshRoutingCorridors() {
  if (!map || !mapReady.value) return
  const line = activeDraftLine()
  const assisted = props.building && Boolean(line) && (props.routingMode ?? line?.routingMode ?? 'ASSISTED') === 'ASSISTED'
  const layerId = localTerritoryRuntime() ? 'game-routing-corridors-local' : 'game-routing-corridors-static'
  try {
    if (!map.getLayer(layerId)) return
    map.setFilter(layerId, routingCorridorFilter(Boolean(localTerritoryRuntime())))
    map.setLayoutProperty(layerId, 'visibility', assisted ? 'visible' : 'none')
  }
  catch {}
}

function routingGraphKey(mode: GameTransportMode) {
  const definition = territoryDefinition()
  const generated = props.territoryId === 'GENERATED' ? normalizeGeneratedTerritorySettings(props.generatedTerritory) : null
  return `${definition.id}:${generated?.seed ?? ''}:${generated?.size ?? ''}:${mode}`
}

function staticRoadFeatureCollection() {
  if (!map || localTerritoryRuntime()) return null
  try {
    const features = map.querySourceFeatures('basemap', { sourceLayer: 'roads' } as any)
    if (!features?.length) return null
    return {
      type: 'FeatureCollection',
      features: features.map((feature: any) => ({
        type: 'Feature',
        properties: { ...(feature.properties ?? {}), layer: 'road' },
        geometry: feature.geometry,
      })),
    }
  }
  catch {
    return null
  }
}

function smartRoutingGraph(mode: GameTransportMode) {
  const runtime = localTerritoryRuntime()
  if (runtime) {
    const key = routingGraphKey(mode)
    if (!routingGraphCache.has(key)) routingGraphCache.set(key, buildSmartRoutingGraph(runtime.basemapGeoJson as any, mode))
    return routingGraphCache.get(key) ?? null
  }
  const key = `STATIC:${props.territoryId ?? 'ILE_DE_FRANCE'}:${mode}:${staticRoutingRevision}`
  if (lastStaticGraphRevision !== staticRoutingRevision) {
    for (const cacheKey of [...routingGraphCache.keys()]) if (cacheKey.startsWith('STATIC:')) routingGraphCache.delete(cacheKey)
    lastStaticGraphRevision = staticRoutingRevision
  }
  if (!routingGraphCache.has(key)) routingGraphCache.set(key, buildSmartRoutingGraph(staticRoadFeatureCollection() as any, mode))
  return routingGraphCache.get(key) ?? null
}

function buildDraftPreviewCoordinates(cursor?: { longitude: number; latitude: number } | null) {
  const anchor = props.draftAnchor
  if (!anchor || !cursor) return [] as SmartRouteCoordinate[]
  const line = activeDraftLine()
  const mode = line?.mode ?? 'METRO'
  const routingMode = props.routingMode ?? line?.routingMode ?? 'ASSISTED'
  const points: SmartRouteCoordinate[] = [
    [anchor.longitude, anchor.latitude],
    ...(props.draftGuidePoints ?? []).map(point => [point[0], point[1]] as SmartRouteCoordinate),
    [cursor.longitude, cursor.latitude],
  ]
  if (routingMode === 'FREE') return routeThroughWaypoints(null, points, false)
  return routeThroughWaypoints(smartRoutingGraph(mode), points, true)
}

function getDraftPreviewCollection(cursor?: { longitude: number; latitude: number } | null) {
  const anchor = props.draftAnchor
  const features: unknown[] = []
  draftPreviewCoordinates = buildDraftPreviewCoordinates(cursor)
  if (anchor && cursor && draftPreviewCoordinates.length >= 2) {
    const properties = { kind: props.draftAnchor?.kind ?? 'BUILD', routingMode: props.routingMode ?? activeDraftLine()?.routingMode ?? 'ASSISTED' }
    features.push({
      type: 'Feature',
      properties,
      geometry: {
        type: 'LineString',
        coordinates: draftPreviewCoordinates,
      },
    })
    for (const point of props.draftGuidePoints ?? []) {
      features.push({ type: 'Feature', properties: { kind: 'GUIDE' }, geometry: { type: 'Point', coordinates: point } })
    }
    features.push({
      type: 'Feature',
      properties: { ...properties, kind: 'CURSOR' },
      geometry: {
        type: 'Point',
        coordinates: [cursor.longitude, cursor.latitude],
      },
    })
  }
  return { type: 'FeatureCollection', features }
}


function getInterchangeCollection() {
  const links = props.interchanges ?? []
  const lineById = new Map(props.lines.map(line => [line.id, line]))
  return {
    type: 'FeatureCollection',
    features: links
      .filter(link => link.distanceMeters > 1 && link.distanceMeters <= 800)
      .map(link => {
        const fromLine = lineById.get(link.fromLineId)
        const from = fromLine ? findLineStation(fromLine, link.fromStationId) : null
        const toLine = lineById.get(link.toLineId)
        const to = toLine ? findLineStation(toLine, link.toStationId) : null
        if (!from || !to) return null
        return {
          type: 'Feature',
          properties: { quality: link.quality, distance: Math.round(link.distanceMeters) },
          geometry: { type: 'LineString', coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] },
        }
      })
      .filter(Boolean),
  }
}

function getVehicleCollection() {
  return {
    type: 'FeatureCollection',
    features: (props.vehicles ?? []).map(vehicle => ({
      type: 'Feature',
      properties: {
        id: vehicle.id,
        lineId: vehicle.lineId,
        color: vehicle.color,
        shortCode: vehicle.shortCode,
      },
      geometry: { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
    })),
  }
}

function clearInterchangeMarkers(resetSignature = true) {
  for (const item of interchangeMarkers) {
    try { item.marker.remove() } catch {}
  }
  interchangeMarkers = []
  if (resetSignature) interchangeMarkerSignature = ''
}

function clearStationMarkers(resetSignature = true) {
  for (const item of stationMarkers) item.marker.remove()
  stationMarkers = []
  if (resetSignature) stationMarkerSignature = ''
}

function updateStationMarkerVisibility() {
  if (!map) return
  const zoom = map.getZoom()
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  for (const item of stationMarkers) {
    const hidden = zoom < 4.3
    item.element.style.display = hidden ? 'none' : 'block'
    item.element.style.opacity = focusLineId && item.lineId !== focusLineId ? '.46' : '1'
    const base = zoom < 7 ? 6 : zoom < 10 ? 7 : zoom < 13 ? 8 : 9
    item.element.style.width = `${base}px`
    item.element.style.height = `${base}px`
  }
}

async function rebuildStationMarkers() {
  if (!map || !mapReady.value || !maplibreApi) return
  const signature = JSON.stringify({
    focus: props.activeLineId ?? props.selectedLineId ?? null,
    selected: props.selectedStationId ?? null,
    lines: props.lines.map(line => [line.id, line.color, getLineAllStations(line).map(station => [station.id, station.longitude, station.latitude])]),
  })
  if (signature === stationMarkerSignature) { updateStationMarkerVisibility(); return }
  stationMarkerSignature = signature
  clearStationMarkers(false)

  for (const line of props.lines) {
    for (const station of getLineAllStations(line)) {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'clu-station-dot'
      element.dataset.i18nSkip = '1'
      element.title = `${station.name} · ${line.name}`
      element.setAttribute('aria-label', `${station.name}, ${line.name}`)
      const selected = station.id === props.selectedStationId
      element.style.cssText = [
        'display:block',
        'width:8px',
        'height:8px',
        'padding:0',
        'border:2px solid #ffffff',
        'border-radius:999px',
        `background:${line.color}`,
        `box-shadow:0 0 0 ${selected ? '2px' : '1px'} rgba(5,10,14,.82),0 1px 5px rgba(0,0,0,.55)`,
        'cursor:pointer',
        'pointer-events:auto',
        'transition:width .12s ease,height .12s ease,opacity .12s ease,transform .12s ease',
        `transform:${selected ? 'scale(1.35)' : 'scale(1)'}`,
      ].join(';')
      element.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        emit('stationClick', line.id, station.id)
      })
      const marker = new maplibreApi.Marker({ element, anchor: 'center' })
        .setLngLat([station.longitude, station.latitude])
        .addTo(map)
      stationMarkers.push({ marker, element, lineId: line.id })
    }
  }
  updateStationMarkerVisibility()
}

function updateInterchangeMarkerVisibility() {
  if (!map) return
  const zoom = map.getZoom()
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  for (const item of interchangeMarkers) {
    item.element.style.display = zoom >= 9.3 ? 'flex' : 'none'
    const lineIds = (item.element.dataset.lineIds ?? '').split(',').filter(Boolean)
    item.element.style.opacity = focusLineId && !lineIds.includes(focusLineId) ? '.32' : '1'
    const label = item.element.querySelector<HTMLElement>('[data-interchange-name]')
    if (label) label.style.display = zoom >= 11 ? 'block' : 'none'
  }
}

async function rebuildInterchangeMarkers() {
  if (!map || !mapReady.value || !maplibreApi) return
  const links = props.interchanges ?? []
  const markerSignature = JSON.stringify({
    links: links.map(link => [link.fromLineId, link.fromStationId, link.toLineId, link.toStationId, Math.round(link.distanceMeters)]),
    lines: props.lines.map(line => [line.id, line.name, line.shortCode, line.color, line.customLogoDataUrl?.length ?? 0, getLineAllStations(line).map(station => [station.id, station.name, station.longitude, station.latitude, station.sharedStationId ?? ''])]),
  })
  if (markerSignature === interchangeMarkerSignature) { updateInterchangeMarkerVisibility(); return }
  interchangeMarkerSignature = markerSignature
  clearInterchangeMarkers(false)
  const lineById = new Map(props.lines.map(line => [line.id, line]))
  const groups = new Map<string, { name: string; longitude: number; latitude: number; lineIds: Set<string>; lineId: string; stationId: string }>()

  function addStation(lineId: string, stationId: string, otherLineId: string) {
    const line = lineById.get(lineId)
    const station = line ? findLineStation(line, stationId) : null
    if (!line || !station) return
    const sharedKey = station.sharedStationId
      ? `shared:${station.sharedStationId}`
      : `coord:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}`
    const existing = groups.get(sharedKey) ?? {
      name: station.name,
      longitude: station.longitude,
      latitude: station.latitude,
      lineIds: new Set<string>(),
      lineId,
      stationId,
    }
    existing.lineIds.add(lineId)
    existing.lineIds.add(otherLineId)
    groups.set(sharedKey, existing)
  }

  for (const link of links) {
    addStation(link.fromLineId, link.fromStationId, link.toLineId)
    addStation(link.toLineId, link.toStationId, link.fromLineId)
  }

  for (const group of groups.values()) {
    if (group.lineIds.size < 2) continue
    const element = document.createElement('div')
    element.className = 'clu-interchange-marker'
    element.dataset.i18nSkip = '1'
    element.dataset.lineIds = [...group.lineIds].join(',')
    element.style.cssText = 'display:none;align-items:center;gap:5px;max-width:210px;padding:4px 6px;border:1px solid rgba(255,255,255,.82);border-radius:10px;background:rgba(8,14,19,.88);box-shadow:0 5px 15px rgba(0,0,0,.36);backdrop-filter:blur(8px);color:#eef7f8;font:700 10px/1.1 Inter,system-ui,sans-serif;pointer-events:auto;white-space:nowrap;transition:opacity .15s ease;'
    element.title = `${group.name} · ${group.lineIds.size} lignes`

    const name = document.createElement('span')
    name.dataset.interchangeName = '1'
    name.textContent = group.name
    name.style.cssText = 'display:none;max-width:100px;overflow:hidden;text-overflow:ellipsis;'
    element.appendChild(name)

    const badges = document.createElement('span')
    badges.style.cssText = 'display:flex;align-items:center;gap:3px;'
    for (const lineId of [...group.lineIds].slice(0, 5)) {
      const line = lineById.get(lineId)
      if (!line) continue
      const badge = document.createElement('span')
      badge.title = line.name
      badge.style.cssText = `width:20px;height:20px;border-radius:6px;display:grid;place-items:center;overflow:hidden;background:${line.color};color:#081014;font:900 8px/1 Inter,system-ui,sans-serif;`
      if (line.customLogoDataUrl) {
        const image = document.createElement('img')
        image.src = line.customLogoDataUrl
        image.alt = line.shortCode
        image.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff;'
        badge.appendChild(image)
      }
      else badge.textContent = line.shortCode
      badges.appendChild(badge)
    }
    element.appendChild(badges)
    element.addEventListener('click', event => {
      event.stopPropagation()
      emit('stationClick', group.lineId, group.stationId)
    })

    const marker = new maplibreApi.Marker({ element, anchor: 'bottom', offset: [0, -10] })
      .setLngLat([group.longitude, group.latitude])
      .addTo(map)
    interchangeMarkers.push({ marker, element })
  }
  updateInterchangeMarkerVisibility()
}

function raiseNetworkPointLayers() {
  if (!map) return
  // V36 : halo + cœur sont deux couches séparées. Le contour n'est donc plus
  // dépendant du rendu du stroke d'un cercle et les arrêts restent visibles
  // même sur un tracé épais. On les remonte aussi après chaque rafraîchissement.
  for (const layerId of [
    'game-network-station-halo',
    'game-network-station-core',
    'game-network-station-labels',
    'game-network-stations-hit',
  ]) {
    try { if (map.getLayer(layerId)) map.moveLayer(layerId) } catch {}
  }
}

function refreshNetworkLayers() {
  if (!map || !mapReady.value) return

  const lineSource = map.getSource('game-network-lines')
  const stationSource = map.getSource('game-network-stations')

  if (hasSetData(lineSource)) lineSource.setData(getLineCollection())
  if (hasSetData(stationSource)) stationSource.setData(getStationCollection())
  raiseNetworkPointLayers()
  void rebuildStationMarkers()
}

function refreshInterchangeLayers() {
  if (!map || !mapReady.value) return
  const interchangeSource = map.getSource('game-network-interchanges')
  const stationSource = map.getSource('game-network-stations')
  if (hasSetData(interchangeSource)) interchangeSource.setData(getInterchangeCollection())
  // Les stations changent légèrement de rendu lorsqu'elles deviennent un pôle.
  if (hasSetData(stationSource)) stationSource.setData(getStationCollection())
  raiseNetworkPointLayers()
  void rebuildInterchangeMarkers()
}

function refreshVehicleLayer() {
  if (!map || !mapReady.value) return
  const vehicleSource = map.getSource('game-network-vehicles')
  if (hasSetData(vehicleSource)) vehicleSource.setData(getVehicleCollection())
}


function refreshDraftPreview() {
  if (!map || !mapReady.value) return
  const source = map.getSource('game-network-preview')
  if (hasSetData(source)) source.setData(getDraftPreviewCollection(draftCursor))
  emit(
    'draftPreview',
    draftCursor?.longitude ?? null,
    draftCursor?.latitude ?? null,
    draftCursor && draftPreviewCoordinates.length >= 2 ? [...draftPreviewCoordinates] : undefined,
  )
}

function scheduleDraftPreviewRefresh() {
  if (draftPreviewFrame !== null) return
  draftPreviewFrame = window.requestAnimationFrame(() => {
    draftPreviewFrame = null
    refreshDraftPreview()
  })
}

function refreshVisualPreferences() {
  if (!map || !mapReady.value) return
  try {
    const buildings3DVisible = props.showBuildings2D5 !== false && (props.graphicsQuality ?? 'BALANCED') !== 'ECO'
    const localRuntime = localTerritoryRuntime()
    const buildingLayer = localRuntime ? 'generated-buildings' : 'base-buildings'
    const building3DLayer = localRuntime ? 'generated-buildings-3d' : 'base-buildings-3d'
    if (map.getLayer(building3DLayer)) map.setLayoutProperty(building3DLayer, 'visibility', buildings3DVisible ? 'visible' : 'none')
    if (map.getLayer(buildingLayer)) map.setLayerZoomRange(buildingLayer, localRuntime ? generatedDetailZoom('BUILDINGS') : detailZoom('BUILDINGS'), 24)
    if (map.getLayer(building3DLayer)) map.setLayerZoomRange(building3DLayer, localRuntime ? generatedDetailZoom('BUILDINGS_3D') : detailZoom('BUILDINGS_3D'), 24)
    if (localRuntime) {
      if (map.getLayer('generated-urban-blocks')) map.setLayerZoomRange('generated-urban-blocks', generatedDetailZoom('BLOCKS'), 24)
      if (map.getLayer('generated-streets')) map.setLayerZoomRange('generated-streets', generatedDetailZoom('STREETS'), 24)
      if (map.getLayer('generated-poi-dots')) map.setLayerZoomRange('generated-poi-dots', generatedDetailZoom('POI'), 24)
      if (map.getLayer('generated-poi-symbols')) map.setLayerZoomRange('generated-poi-symbols', generatedDetailZoom('POI'), 24)
    }
    map.setLayerZoomRange('game-network-vehicles-halo', detailZoom('VEHICLES'), 24)
    map.setLayerZoomRange('game-network-vehicles', detailZoom('VEHICLES'), 24)
    map.setLayoutProperty('game-network-vehicles-halo', 'visibility', props.showVehicleAnimations === false ? 'none' : 'visible')
    map.setLayoutProperty('game-network-vehicles', 'visibility', props.showVehicleAnimations === false ? 'none' : 'visible')
    if (map.getLayer(building3DLayer)) map.setPaintProperty(building3DLayer, 'fill-extrusion-opacity', props.building ? .24 : .42)
  }
  catch {
    // Les préférences peuvent arriver pendant le chargement du style : le
    // prochain refresh / styledata les réappliquera.
  }
}

function clearCommuneHover() {
  if (
    !map
    || hoveredCommuneCode === null
  ) {
    return
  }

  map.setFeatureState(
    {
      source: 'territory-communes',
      id: hoveredCommuneCode,
    },
    {
      hover: false,
    },
  )

  hoveredCommuneCode =
    null
}

function updateCursor() {
  if (!map) {
    return
  }

  map.getCanvas().style.cursor =
    props.building
      ? 'crosshair'
      : ''

  if (props.building) {
    clearCommuneHover()
  }
}

function resetView() {
  if (!map) {
    return
  }

  const bounds = territoryDefinition().worldBounds
  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    {
      padding: 70,
      duration: 700,
    },
  )
}

function closeCommune() {
  selectedCommune.value =
    null
}

function formatPopulation(
  population: number | null,
) {
  if (population === null) {
    return 'Inconnue'
  }

  return new Intl.NumberFormat(
    currentGameLocaleTag(),
  ).format(population)
}

watch(
  () => props.lines,
  () => {
    refreshNetworkLayers()
    refreshInterchangeLayers()
  },
  {
    deep: true,
  },
)

watch(
  [
    () => props.activeLineId,
    () => props.selectedLineId,
    () => props.selectedStationId,
  ],
  () => {
    refreshNetworkLayers()
    updateStationMarkerVisibility()
    updateInterchangeMarkerVisibility()
  },
)

watch(
  [() => props.draftAnchor, () => props.draftGuidePoints, () => props.routingMode],
  () => {
    refreshNetworkLayers()
    refreshDraftPreview()
    refreshRoutingCorridors()
  },
  { deep: true },
)

watch(
  () => props.interchanges,
  () => refreshInterchangeLayers(),
  { deep: true },
)

watch(
  () => props.vehicles,
  () => refreshVehicleLayer(),
  { deep: true },
)

watch(
  [
    () => props.graphicsQuality,
    () => props.showVehicleAnimations,
    () => props.showBuildings2D5,
  ],
  () => refreshVisualPreferences(),
)

watch(
  () => props.building,
  building => {
    if (!building) draftCursor = null
    updateCursor()
    refreshDraftPreview()
    refreshVisualPreferences()
    refreshRoutingCorridors()
  },
)


function generatedBaseStyleLayers() {
  return [
    {
      id: 'generated-earth', type: 'fill', source: 'generated-basemap',
      filter: ['==', ['get', 'layer'], 'earth'],
      paint: { 'fill-color': '#141a1f', 'fill-opacity': 1 },
    },
    {
      id: 'generated-relief', type: 'fill', source: 'generated-basemap',
      filter: ['==', ['get', 'layer'], 'relief'],
      paint: {
        'fill-color': ['match', ['get', 'level'], 3, '#252921', 2, '#20261f', '#1b231d'],
        'fill-opacity': .52,
        'fill-outline-color': 'rgba(107,125,101,.16)',
      },
    },
    {
      id: 'generated-admin-fill', type: 'fill', source: 'generated-basemap',
      filter: ['==', ['get', 'layer'], 'admin'],
      paint: { 'fill-color': '#b8c5d2', 'fill-opacity': .012 },
    },
    {
      id: 'generated-admin-boundaries', type: 'line', source: 'generated-basemap',
      filter: ['==', ['get', 'layer'], 'admin'],
      paint: {
        'line-color': 'rgba(226,235,242,.46)',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5.5, .58, 9, .34, 12, .18],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.35, 9, 1.05, 12, .7],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'generated-landuse', type: 'fill', source: 'generated-basemap',
      filter: ['==', ['get', 'layer'], 'landuse'],
      paint: {
        'fill-color': ['match', ['get', 'kind'], 'park', '#173024', 'commercial', '#2e2631', 'industrial', '#2c2725', 'residential', '#1c252a', '#1b2026'],
        'fill-opacity': ['match', ['get', 'kind'], 'park', .82, 'commercial', .83, 'industrial', .80, .70],
      },
    },
    {
      id: 'generated-urban-blocks', type: 'fill', source: 'generated-basemap', minzoom: generatedDetailZoom('BLOCKS'),
      filter: ['==', ['get', 'layer'], 'urban_block'],
      paint: {
        'fill-color': ['match', ['get', 'kind'], 'commercial', '#35303a', 'industrial', '#34302d', '#272f35'],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7.2, .34, 9.5, .58, 12, .74],
        'fill-outline-color': 'rgba(135,151,164,.16)',
      },
    },
    {
      id: 'generated-water-polygons', type: 'fill', source: 'generated-basemap',
      filter: ['all', ['==', ['get', 'layer'], 'water'], ['==', ['geometry-type'], 'Polygon']],
      paint: { 'fill-color': '#153243', 'fill-opacity': .96 },
    },
    {
      id: 'generated-water-lines', type: 'line', source: 'generated-basemap',
      filter: ['all', ['==', ['get', 'layer'], 'water'], ['==', ['geometry-type'], 'LineString']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#24546d', 'line-opacity': .94, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.2, 10, 4.5, 14, 8] },
    },
    {
      id: 'generated-rail', type: 'line', source: 'generated-basemap',
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['==', ['get', 'kind'], 'rail']],
      paint: { 'line-color': '#8a9099', 'line-opacity': .68, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .55, 13, 1.6], 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'generated-minor-roads', type: 'line', source: 'generated-basemap', minzoom: 5.85,
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['==', ['get', 'kind'], 'minor_road']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#424c57', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5.85, .25, 7.4, .54, 10, .76, 12, .88], 'line-width': ['interpolate', ['linear'], ['zoom'], 5.85, .28, 8.5, .60, 12, 1.2, 15, 2.6] },
    },
    {
      id: 'generated-streets', type: 'line', source: 'generated-basemap', minzoom: generatedDetailZoom('STREETS'),
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['==', ['get', 'kind'], 'street']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#46515b',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, .32, 11, .60, 14, .80],
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, .28, 12, .62, 15, 1.25],
      },
    },
    {
      id: 'generated-major-roads-casing', type: 'line', source: 'generated-basemap',
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['any', ['==', ['get', 'kind'], 'highway'], ['==', ['get', 'kind'], 'major_road']]],
      paint: { 'line-color': '#10161c', 'line-opacity': .96, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 10, 3.5, 14, 6.5] },
    },
    {
      id: 'generated-major-roads', type: 'line', source: 'generated-basemap',
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['any', ['==', ['get', 'kind'], 'highway'], ['==', ['get', 'kind'], 'major_road']]],
      paint: { 'line-color': ['case', ['==', ['get', 'kind'], 'highway'], '#725d43', '#59616a'], 'line-opacity': .95, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, .7, 10, 1.8, 14, 4.3] },
    },
    {
      id: 'generated-infrastructure-fill', type: 'fill', source: 'generated-basemap', minzoom: 7.2,
      filter: ['all', ['==', ['get', 'layer'], 'infrastructure'], ['==', ['geometry-type'], 'Polygon']],
      paint: {
        'fill-color': ['match', ['get', 'kind'], 'airport', '#4b4a49', 'terminal', '#3d444b', '#353c43'],
        'fill-opacity': .88,
        'fill-outline-color': '#777f87',
      },
    },
    {
      id: 'generated-buildings', type: 'fill', source: 'generated-basemap', minzoom: generatedDetailZoom('BUILDINGS'),
      filter: ['==', ['get', 'layer'], 'building'],
      paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'height'], 7, '#30363c', 16, '#373c43', 34, '#42464d'],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, .58, 12, .82],
        'fill-outline-color': 'rgba(95,107,118,.58)',
      },
    },
    {
      id: 'generated-buildings-3d', type: 'fill-extrusion', source: 'generated-basemap', minzoom: generatedDetailZoom('BUILDINGS_3D'),
      filter: ['==', ['get', 'layer'], 'building'],
      layout: { visibility: props.showBuildings2D5 === false || (props.graphicsQuality ?? 'BALANCED') === 'ECO' ? 'none' : 'visible' },
      paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 7, '#363d43', 16, '#424850', 34, '#50555d'], 'fill-extrusion-height': ['coalesce', ['get', 'height'], 8], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .48 },
    },
    {
      id: 'generated-poi-dots', type: 'circle', source: 'generated-basemap', minzoom: generatedDetailZoom('POI'),
      filter: ['==', ['get', 'layer'], 'poi'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 13, 4.6],
        'circle-color': '#202a31',
        'circle-stroke-color': '#a9bbc7',
        'circle-stroke-width': 1.2,
        'circle-opacity': .92,
      },
    },
    {
      id: 'generated-poi-symbols', type: 'symbol', source: 'generated-basemap', minzoom: generatedDetailZoom('POI'),
      filter: ['==', ['get', 'layer'], 'poi'],
      layout: {
        'text-field': ['get', 'symbol'], 'text-font': ['Arial', 'Segoe UI'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 7.5, 13, 9],
        'text-allow-overlap': true, 'text-ignore-placement': true,
      },
      paint: { 'text-color': '#e7eff4', 'text-opacity': .92 },
    },
    {
      id: 'generated-poi-labels', type: 'symbol', source: 'generated-basemap', minzoom: 11.1,
      filter: ['==', ['get', 'layer'], 'poi'],
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Arial', 'Segoe UI'],
        'text-size': 9.4, 'text-offset': [0, 1.05], 'text-anchor': 'top', 'text-padding': 5, 'text-optional': true,
      },
      paint: { 'text-color': '#cbd6de', 'text-halo-color': 'rgba(7,12,18,.94)', 'text-halo-width': 1.25, 'text-opacity': .82 },
    },
    {
      id: 'generated-admin-labels', type: 'symbol', source: 'generated-basemap', minzoom: 5.6, maxzoom: 9.2,
      filter: ['==', ['get', 'layer'], 'admin_place'],
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Arial', 'Segoe UI'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5.6, 10, 8.5, 12],
        'text-letter-spacing': .08, 'text-transform': 'uppercase', 'text-padding': 18,
      },
      paint: { 'text-color': '#8e9ba8', 'text-halo-color': 'rgba(7,12,18,.92)', 'text-halo-width': 1.4, 'text-opacity': .58 },
    },
    {
      id: 'generated-place-labels', type: 'symbol', source: 'generated-basemap', minzoom: 5.7,
      filter: ['==', ['get', 'layer'], 'place'],
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Arial', 'Segoe UI'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          6, ['case', ['==', ['get', 'rank'], 0], 12.5, ['==', ['get', 'rank'], 1], 10.5, 8.5],
          10, ['case', ['<=', ['get', 'rank'], 1], 13.5, 11],
          14, 15,
        ],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': .25,
        'text-padding': ['case', ['==', ['get', 'rank'], 0], 10, ['==', ['get', 'rank'], 1], 7, 4],
        'text-optional': true,
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'rank'], 0], '#f0f5f8', '#d0d8df'],
        'text-halo-color': 'rgba(7,12,18,.94)', 'text-halo-width': 1.5,
        'text-opacity': ['case', ['>=', ['get', 'rank'], 3], ['interpolate', ['linear'], ['zoom'], 6, .15, 9, .62, 12, .86], .94],
      },
    },
    {
      id: 'generated-road-labels', type: 'symbol', source: 'generated-basemap', minzoom: 11,
      filter: ['all', ['==', ['get', 'layer'], 'road'], ['any', ['==', ['get', 'kind'], 'highway'], ['==', ['get', 'kind'], 'major_road']]],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Arial', 'Segoe UI'], 'text-size': 10, 'text-padding': 8 },
      paint: { 'text-color': '#aeb6c0', 'text-halo-color': 'rgba(10,15,21,.9)', 'text-halo-width': 1, 'text-opacity': .72 },
    },
  ] as any[]
}

onMounted(async () => {
  if (!mapContainer.value) {
    return
  }

  try {
    setLoading('Préparation du territoire…', 8)
    const resolvedBasemapUrl = await resolveBasemapUrl()

    setLoading('Chargement des limites communales…', 18)
    const communes =
      await loadCommunes()

    setLoading('Démarrage du moteur cartographique…', 34)

    const maplibre =
      await import(
        'maplibre-gl'
      )

    maplibreApi = maplibre

    const pmtiles =
      await import(
        'pmtiles'
      )

    maplibre.setWorkerUrl(
      workerUrl,
    )

    const protocol =
      new pmtiles.Protocol()

    maplibre.addProtocol(
      'pmtiles',
      protocol.tile,
    )

    removePmtilesProtocol = () => {
      maplibre.removeProtocol(
        'pmtiles',
      )
    }

    const definition = territoryDefinition()
    const generated = localTerritoryRuntime()
    const basemapUrl = resolvedBasemapUrl

    startupTimeout = window.setTimeout(() => {
      if (mapReady.value || mapError.value) return
      failMap(lastMapRuntimeError ?? `Le chargement de ${definition.label} a dépassé le délai normal. Réessayez sans actualiser la page.`)
    }, 18_000)

    map =
      new maplibre.Map({
        container:
          mapContainer.value,

        style: {
          version: 8,

          // Les territoires locaux/procéduraux démarrent avec un style minimal.
          // Leur GeoJSON est injecté après l'événement `load` : MapLibre n'attend
          // donc plus le parsing de toute la région avant d'afficher la carte.
          sources: generated
            ? {}
            : {
                basemap: {
                  type: 'vector',
                  url: `pmtiles://${basemapUrl}`,
                  attribution: definition.attribution,
                },
              },

          layers: [
            {
              id: 'background',
              type: 'background',
              paint: {
                'background-color':
                  '#0b1117',
              },
            },

            ...(generated ? [] : [
            {
              id: 'base-earth',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'earth',
              paint: {
                'fill-color':
                  '#141a1f',
              },
            },

            {
              id: 'base-landcover',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'landcover',
              paint: {
                'fill-color': [
                  'match',
                  ['get', 'kind'],
                  'forest', '#16271f',
                  'grassland', '#1a2820',
                  'scrub', '#1b2520',
                  'farmland', '#24261d',
                  'urban_area', '#171c22',
                  '#171c20',
                ],
                'fill-opacity': .9,
              },
            },

            {
              id: 'base-landuse',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'landuse',
              paint: {
                'fill-color': [
                  'match',
                  ['get', 'kind'],
                  'park', '#173024',
                  'garden', '#173024',
                  'forest', '#14291f',
                  'wood', '#14291f',
                  'cemetery', '#202a24',
                  'industrial', '#242027',
                  'commercial', '#252127',
                  'residential', '#1d2228',
                  'university', '#20252d',
                  'school', '#20252d',
                  'hospital', '#292126',
                  '#1b2026',
                ],
                'fill-opacity': .62,
              },
            },

            {
              id: 'base-water',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'water',
              filter: [
                '==',
                ['geometry-type'],
                'Polygon',
              ],
              paint: {
                'fill-color':
                  '#153243',
                'fill-opacity':
                  .95,
              },
            },

            {
              id: 'base-water-lines',
              type: 'line',
              source: 'basemap',
              'source-layer': 'water',
              filter: [
                '==',
                ['geometry-type'],
                'LineString',
              ],
              paint: {
                'line-color':
                  '#27556e',
                'line-opacity':
                  .85,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  7, .6,
                  13, 2.2,
                ],
              },
            },

            {
              id: 'base-rail',
              type: 'line',
              source: 'basemap',
              'source-layer': 'roads',
              filter: [
                '==',
                ['get', 'kind'],
                'rail',
              ],
              paint: {
                'line-color':
                  '#8a9099',
                'line-opacity':
                  .72,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  7, .45,
                  11, 1,
                  14, 1.7,
                ],
                'line-dasharray': [
                  2,
                  1.5,
                ],
              },
            },

            {
              id: 'base-minor-roads',
              type: 'line',
              source: 'basemap',
              'source-layer': 'roads',
              minzoom: 9,
              filter: [
                'any',
                [
                  '==',
                  ['get', 'kind'],
                  'minor_road',
                ],
                [
                  '==',
                  ['get', 'kind'],
                  'path',
                ],
              ],
              paint: {
                'line-color':
                  '#38404a',
                'line-opacity':
                  .75,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  9, .3,
                  12, .7,
                  15, 1.6,
                ],
              },
            },

            {
              id: 'base-major-roads-casing',
              type: 'line',
              source: 'basemap',
              'source-layer': 'roads',
              filter: [
                'any',
                [
                  '==',
                  ['get', 'kind'],
                  'highway',
                ],
                [
                  '==',
                  ['get', 'kind'],
                  'major_road',
                ],
              ],
              paint: {
                'line-color':
                  '#11171d',
                'line-opacity':
                  .95,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6, .9,
                  10, 2.6,
                  14, 6,
                ],
              },
            },

            {
              id: 'base-major-roads',
              type: 'line',
              source: 'basemap',
              'source-layer': 'roads',
              filter: [
                'any',
                [
                  '==',
                  ['get', 'kind'],
                  'highway',
                ],
                [
                  '==',
                  ['get', 'kind'],
                  'major_road',
                ],
              ],
              paint: {
                'line-color': [
                  'case',
                  [
                    '==',
                    ['get', 'kind'],
                    'highway',
                  ],
                  '#725d43',
                  '#59616a',
                ],
                'line-opacity':
                  .95,
                'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6, .45,
                  10, 1.5,
                  14, 4,
                ],
              },
            },

            {
              id: 'base-buildings',
              type: 'fill',
              source: 'basemap',
              'source-layer': 'buildings',
              minzoom: detailZoom('BUILDINGS'),
              paint: {
                'fill-color':
                  '#31363d',
                'fill-opacity':
                  .72,
                'fill-outline-color':
                  '#3b4149',
              },
            },

            {
              id: 'base-buildings-3d',
              type: 'fill-extrusion',
              source: 'basemap',
              'source-layer': 'buildings',
              minzoom: detailZoom('BUILDINGS_3D'),
              layout: { visibility: props.showBuildings2D5 === false || (props.graphicsQuality ?? 'BALANCED') === 'ECO' ? 'none' : 'visible' },
              paint: {
                'fill-extrusion-color': '#3b424a',
                'fill-extrusion-height': [
                  'interpolate', ['linear'], ['zoom'],
                  13.2, 2,
                  16, 12,
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': .42,
              },
            },

            {
              id: 'base-place-labels',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'places',
              minzoom: 6,
              layout: {
                'text-field': territoryNameExpression(),
                'text-font': [
                  'Arial',
                  'Segoe UI',
                ],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6, 11,
                  10, 13,
                  14, 15,
                ],
                'text-variable-anchor': [
                  'top',
                  'bottom',
                  'left',
                  'right',
                ],
                'text-radial-offset':
                  .25,
                'text-padding':
                  4,
              },
              paint: {
                'text-color':
                  '#d7dde5',
                'text-halo-color':
                  'rgba(7,12,18,.92)',
                'text-halo-width':
                  1.4,
                'text-opacity':
                  .9,
              },
            },

            {
              id: 'base-road-labels',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'roads',
              minzoom: 11,
              filter: [
                'any',
                [
                  '==',
                  ['get', 'kind'],
                  'highway',
                ],
                [
                  '==',
                  ['get', 'kind'],
                  'major_road',
                ],
              ],
              layout: {
                'symbol-placement':
                  'line',
                'text-field': [
                  'coalesce',
                  ['get', `name:${definition.preferredLocale}`],
                  ['get', 'name'],
                  ['get', 'ref'],
                ],
                'text-font': [
                  'Arial',
                  'Segoe UI',
                ],
                'text-size':
                  10,
                'text-padding':
                  8,
              },
              paint: {
                'text-color':
                  '#aeb6c0',
                'text-halo-color':
                  'rgba(10,15,21,.9)',
                'text-halo-width':
                  1,
                'text-opacity':
                  .72,
              },
            },
            ]),
          ],
        },

        center: [
          definition.initialCenter.longitude,
          definition.initialCenter.latitude,
        ],

        zoom: definition.initialZoom,
        minZoom: 5,
        maxZoom: 16,

        maxBounds: [
          [definition.worldBounds.west, definition.worldBounds.south],
          [definition.worldBounds.east, definition.worldBounds.north],
        ],

        attributionControl:
          false,
      })

    if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => { try { map?.resize() } catch {} })
      })
      resizeObserver.observe(mapContainer.value)
    }

    map.on(
      'error',
      (event) => {
        const error = event.error
        lastMapRuntimeError = error instanceof Error ? error.message : String(error ?? 'Erreur MapLibre')
        console.error('[CLU Métropole] MapLibre :', error)
      },
    )

    map.addControl(
      new maplibre.NavigationControl({
        showCompass: false,
        showZoom: true,
      }),
      'bottom-right',
    )

    map.on(
      'load',
      async () => {
        if (!map) return

        try {
          setLoading('Construction du fond de carte…', 48)

          if (generated) {
            map.addSource('generated-basemap', {
              type: 'geojson',
              data: generated.basemapGeoJson,
              attribution: definition.attribution,
            })

            const generatedLayers = generatedBaseStyleLayers()
            // D'abord les couches géométriques : elles sont peu coûteuses et rendent
            // le territoire immédiatement exploitable. Les labels arrivent ensuite.
            for (const layer of generatedLayers.filter(layer => layer.type !== 'symbol')) {
              map.addLayer(layer)
            }

            await waitForSourceLoaded('generated-basemap')
            setLoading('Placement des villes et des repères…', 63)

            for (const layer of generatedLayers.filter(layer => layer.type === 'symbol')) {
              try { map.addLayer(layer) }
              catch (error) { console.warn('[CLU Métropole] Label cartographique ignoré :', error) }
            }
          }
          else {
            setLoading('Lecture du fond de carte local…', 58)
          }

          setLoading('Préparation du réseau et des communes…', 72)

        /* ================================================
           COMMUNES : couche de gameplay légère
           ================================================ */

        map.addSource(
          'territory-communes',
          {
            type: 'geojson',
            data: communes,
            promoteId: 'code',
          },
        )

        map.addLayer({
          id: 'territory-communes-fill',
          type: 'fill',
          source: 'territory-communes',
          paint: {
            'fill-color': territoryDepartmentColorExpression(),
            'fill-opacity': [
              'case',
              [
                'boolean',
                ['feature-state', 'hover'],
                false,
              ],
              definition.kind === 'GENERATED' ? .12 : .16,
              definition.kind === 'GENERATED' ? .018 : .055,
            ],
          },
        })

        map.addLayer({
          id: 'territory-communes-border',
          type: 'line',
          source: 'territory-communes',
          paint: {
            'line-color':
              'rgba(225,232,240,.52)',
            'line-opacity': definition.kind === 'GENERATED'
              ? ['interpolate', ['linear'], ['zoom'], 6, .22, 9, .34, 13, .48]
              : .62,
            'line-width': definition.kind === 'GENERATED'
              ? ['interpolate', ['linear'], ['zoom'], 6, .18, 10, .38, 14, .70]
              : [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6, .25,
                  10, .55,
                  14, 1,
                ],
          },
        })

        map.addLayer({
          id: 'territory-communes-hover',
          type: 'line',
          source: 'territory-communes',
          paint: {
            'line-color':
              '#ffffff',
            'line-width':
              2,
            'line-opacity': [
              'case',
              [
                'boolean',
                ['feature-state', 'hover'],
                false,
              ],
              .9,
              0,
            ],
          },
        })

        map.addLayer({
          id: 'territory-communes-labels',
          type: 'symbol',
          source: 'territory-communes',
          minzoom: 9,
          layout: {
            'text-field': [
              'get',
              'nom',
            ],
            'text-font': [
              'Arial',
              'Segoe UI',
            ],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              9, 9,
              12, 11,
              15, 13,
            ],
            'text-padding':
              7,
          },
          paint: {
            'text-color':
              '#c8cfd8',
            'text-halo-color':
              'rgba(8,13,19,.9)',
            'text-halo-width':
              1.1,
            'text-opacity':
              .78,
          },
        })

        /* ================================================
           RÉSEAU DU JOUEUR
           ================================================ */

        // V35 : corridors conseillés visibles uniquement pendant un tracé assisté.
        // Ils expliquent le choix du routeur sans imposer le chemin au joueur.
        if (localTerritoryRuntime()) {
          map.addLayer({
            id: 'game-routing-corridors-local',
            type: 'line',
            source: 'generated-basemap',
            filter: routingCorridorFilter(true),
            layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
            paint: {
              'line-color': '#8deaf2',
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, .08, 10, .14, 14, .18],
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.0, 10, 2.0, 14, 3.4],
            },
          })
        }
        else {
          map.addLayer({
            id: 'game-routing-corridors-static',
            type: 'line',
            source: 'basemap',
            'source-layer': 'roads',
            filter: routingCorridorFilter(false),
            layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
            paint: {
              'line-color': '#8deaf2',
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, .07, 10, .13, 14, .17],
              'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.0, 10, 2.0, 14, 3.4],
            },
          })
        }

        map.addSource(
          'game-network-lines',
          {
            type: 'geojson',
            data: getLineCollection(),
          },
        )

        // Casing sombre : le réseau reste lisible au-dessus des routes, labels
        // et bâtiments, sans donner l'impression d'un trait posé au hasard.
        map.addLayer({
          id: 'game-network-lines-shadow',
          type: 'line',
          source: 'game-network-lines',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#071014',
            'line-width': lineWidthExpression(4.2),
            'line-opacity': [
              'case',
              ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .18,
              .86,
            ],
          },
        })

        // Halo uniquement sur la ligne manipulée / sélectionnée. Il remplace
        // l'ancien épaississement généralisé qui surchargeait les gros réseaux.
        map.addLayer({
          id: 'game-network-lines-focus',
          type: 'line',
          source: 'game-network-lines',
          filter: ['==', ['get', 'focused'], 1],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#eaffff',
            'line-width': lineWidthExpression(7.2),
            'line-opacity': .16,
            'line-blur': 3.2,
          },
        })

        map.addLayer({
          id: 'game-network-lines',
          type: 'line',
          source: 'game-network-lines',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['==', ['get', 'active'], 1], ['+', lineWidthExpression(), 1.35],
              ['==', ['get', 'selected'], 1], ['+', lineWidthExpression(), .8],
              lineWidthExpression(),
            ],
            'line-opacity': focusedLineOpacity(),
          },
        })

        // V30 : couche centrale volontairement simple et sans line-offset.
        // Elle sert de garde-fou de rendu : même si une expression visuelle plus
        // riche se comporte différemment selon la version MapLibre, le tracé
        // coloré du réseau reste toujours visible.
        map.addLayer({
          id: 'game-network-lines-stable-core',
          type: 'line',
          source: 'game-network-lines',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 7, 2.1, 10, 2.7, 13, 3.25, 16, 4],
            'line-opacity': focusedLineOpacity(),
          },
        })

        map.addLayer({
          id: 'game-network-lines-work',
          type: 'line',
          source: 'game-network-lines',
          filter: ['!=', ['get', 'status'], 'OPERATIONAL'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, .8, 12, 1.25, 15, 1.6],
            'line-opacity': [
              'case',
              ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .16,
              .62,
            ],
            'line-dasharray': [2, 2],
          },
        })

        // Couche de hit-test généreuse et invisible : sélectionner une ligne
        // reste facile même quand elle est fine à faible zoom.
        map.addLayer({
          id: 'game-network-lines-hit',
          type: 'line',
          source: 'game-network-lines',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 13, 14, 20],
            'line-opacity': .001,
          },
        })

        map.addSource(
          'game-network-stations',
          {
            type: 'geojson',
            data: getStationCollection(),
          },
        )

        // V36 : le contour blanc et le cœur coloré sont deux couches distinctes.
        // Cette approche est volontairement plus robuste que circle-stroke : le
        // halo reste visible même lorsqu'un tracé épais passe exactement sous l'arrêt.
        map.addLayer({
          id: 'game-network-station-halo',
          type: 'circle',
          source: 'game-network-stations',
          minzoom: 3.0,
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 1,
            'circle-color': '#ffffff',
            'circle-opacity': 0,
          },
        })
        map.addLayer({
          id: 'game-network-station-core',
          type: 'circle',
          source: 'game-network-stations',
          minzoom: 3.0,
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': 1,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0,
          },
        })

        // Couche de hit-test invisible : zone confortable au clic sans agrandir visuellement l'arrêt.
        map.addLayer({
          id: 'game-network-stations-hit',
          type: 'circle',
          source: 'game-network-stations',
          minzoom: 4.8,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 10, 10, 14, 14],
            'circle-color': '#ffffff',
            'circle-opacity': .001,
          },
        })

        // Les noms n'envahissent pas la carte : ils apparaissent sur la ligne
        // active/sélectionnée, ou sur le point de travail, à un zoom utile.
        map.addLayer({
          id: 'game-network-station-labels',
          type: 'symbol',
          source: 'game-network-stations',
          minzoom: 10.4,
          filter: [
            'any',
            ['==', ['get', 'focused'], 1],
            ['==', ['get', 'selectedStation'], 1],
            ['==', ['get', 'draftAnchor'], 1],
          ],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Arial', 'Segoe UI'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10.4, 9, 13, 10.5, 16, 12],
            'text-offset': [0, 1.25],
            'text-anchor': 'top',
            'text-padding': 5,
            'text-optional': true,
          },
          paint: {
            'text-color': '#eef7f8',
            'text-halo-color': 'rgba(6,12,17,.94)',
            'text-halo-width': 1.6,
            'text-opacity': .92,
          },
        })

        map.addSource('game-network-preview', { type: 'geojson', data: getDraftPreviewCollection() })
        map.addLayer({
          id: 'game-network-preview-shadow',
          type: 'line',
          source: 'game-network-preview',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#071014',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6, 14, 10],
            'line-opacity': .7,
          },
        })
        map.addLayer({
          id: 'game-network-preview',
          type: 'line',
          source: 'game-network-preview',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#9ff5ff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 14, 4.5],
            'line-opacity': .88,
            'line-dasharray': [1.4, 1.15],
          },
        })
        map.addLayer({
          id: 'game-network-preview-guides',
          type: 'circle',
          source: 'game-network-preview',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'kind'], 'GUIDE']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.2, 14, 5.2],
            'circle-color': '#0b1117',
            'circle-stroke-color': '#9ff5ff',
            'circle-stroke-width': 1.8,
            'circle-opacity': .88,
          },
        })
        map.addLayer({
          id: 'game-network-preview-cursor',
          type: 'circle',
          source: 'game-network-preview',
          filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'kind'], 'CURSOR']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4.5, 14, 7],
            'circle-color': '#9ff5ff',
            'circle-stroke-color': '#071014',
            'circle-stroke-width': 2.5,
            'circle-opacity': .92,
          },
        })

        map.addSource('game-network-interchanges', { type: 'geojson', data: getInterchangeCollection() })
        map.addLayer({
          id: 'game-network-interchanges',
          type: 'line',
          source: 'game-network-interchanges',
          minzoom: 8,
          paint: {
            'line-color': '#f2f6f7',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 14, 3.2],
            'line-opacity': .62,
            'line-dasharray': [1.2, 1.6],
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })

        map.addSource('game-network-vehicles', { type: 'geojson', data: getVehicleCollection() })
        map.addLayer({
          id: 'game-network-vehicles-halo',
          type: 'circle',
          source: 'game-network-vehicles',
          minzoom: detailZoom('VEHICLES'),
          layout: { visibility: props.showVehicleAnimations === false ? 'none' : 'visible' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4.7, 11, 5.9, 14, 7.2],
            'circle-color': '#000000',
            'circle-opacity': .24,
          },
        })
        map.addLayer({
          id: 'game-network-vehicles',
          type: 'circle',
          source: 'game-network-vehicles',
          minzoom: detailZoom('VEHICLES'),
          layout: { visibility: props.showVehicleAnimations === false ? 'none' : 'visible' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.4, 11, 4.25, 14, 5.25],
            'circle-color': '#000000',
            'circle-opacity': .58,
            'circle-stroke-color': '#000000',
            'circle-stroke-opacity': .78,
            'circle-stroke-width': 1.25,
          },
        })

        // Les stations passent explicitement au-dessus des correspondances et véhicules.
        // Le helper est aussi rappelé lors de chaque mise à jour des sources.
        raiseNetworkPointLayers()

        map.on('zoom', updateStationMarkerVisibility)
        map.on('click', 'game-network-lines-hit', event => {
          if (props.building) return
          event.originalEvent?.preventDefault?.()
          const lineId = event.features?.[0]?.properties?.id
          if (lineId) emit('lineClick', String(lineId))
        })
        map.on('mouseenter', 'game-network-lines-hit', () => {
          if (map && !props.building) map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'game-network-lines-hit', () => updateCursor())

        map.on('click', 'game-network-stations-hit', event => {
          event.originalEvent?.preventDefault?.()
          const feature = event.features?.[0]
          const lineId = feature?.properties?.lineId
          const stationId = feature?.properties?.id
          if (lineId && stationId) emit('stationClick', String(lineId), String(stationId))
        })
        map.on('mouseenter', 'game-network-stations-hit', () => { if (map) map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'game-network-stations-hit', () => updateCursor())

        map.on('click', 'game-network-vehicles', event => {
          const id = event.features?.[0]?.properties?.id
          const vehicle = (props.vehicles ?? []).find(item => item.id === id)
          if (vehicle) emit('vehicleClick', vehicle)
        })
        map.on('mouseenter', 'game-network-vehicles', () => { if (map) map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'game-network-vehicles', () => updateCursor())
        map.on('zoom', updateInterchangeMarkerVisibility)
        map.on('moveend', () => {
          if (!localTerritoryRuntime()) {
            staticRoutingRevision += 1
            routingGraphCache.clear()
            if (props.building && draftCursor) refreshDraftPreview()
          }
        })

        /* ================================================
           INTERACTIONS COMMUNES
           ================================================ */

        map.on(
          'mousemove',
          'territory-communes-fill',
          (event) => {
            if (!map) {
              return
            }

            if (props.building) {
              map.getCanvas().style.cursor =
                'crosshair'
              clearCommuneHover()
              return
            }

            map.getCanvas().style.cursor =
              'pointer'

            const feature =
              event.features?.[0]

            const code =
              feature?.properties?.code

            if (!code) {
              return
            }

            const normalizedCode =
              String(code)

            if (
              normalizedCode
              === hoveredCommuneCode
            ) {
              return
            }

            clearCommuneHover()

            hoveredCommuneCode =
              normalizedCode

            map.setFeatureState(
              {
                source: 'territory-communes',
                id: normalizedCode,
              },
              {
                hover: true,
              },
            )
          },
        )

        map.on(
          'mouseleave',
          'territory-communes-fill',
          () => {
            if (!map) {
              return
            }

            if (!props.building) {
              map.getCanvas().style.cursor =
                ''
            }

            clearCommuneHover()
          },
        )

        map.on(
          'click',
          'territory-communes-fill',
          (event) => {
            if (props.building) {
              return
            }

            const feature =
              event.features?.[0]

            if (!feature) {
              return
            }

            const properties =
              feature.properties

            const rawPopulation =
              Number(
                properties?.population,
              )

            selectedCommune.value = {
              name:
                String(
                  properties?.nom
                  ?? 'Commune',
                ),
              code:
                String(
                  properties?.code
                  ?? '',
                ),
              department:
                String(
                  properties?.codeDepartement
                  ?? '',
                ),
              population:
                Number.isFinite(
                  rawPopulation,
                )
                  ? rawPopulation
                  : null,
            }
          },
        )

        /* ================================================
           CONSTRUCTION
           ================================================ */

        map.on('mousemove', event => {
          if (!props.building || !props.draftAnchor) {
            if (draftCursor) {
              draftCursor = null
              scheduleDraftPreviewRefresh()
            }
            return
          }
          draftCursor = { longitude: event.lngLat.lng, latitude: event.lngLat.lat }
          scheduleDraftPreviewRefresh()
        })

        map.on('mouseout', () => {
          draftCursor = null
          scheduleDraftPreviewRefresh()
        })

        map.on(
          'click',
          (event) => {
            if (event.originalEvent?.defaultPrevented) return
            if (!props.building) {
              return
            }

            selectedCommune.value =
              null

            if (!draftPreviewCoordinates.length && props.draftAnchor) {
              draftPreviewCoordinates = buildDraftPreviewCoordinates({ longitude: event.lngLat.lng, latitude: event.lngLat.lat })
            }
            emit(
              'mapClick',
              event.lngLat.lng,
              event.lngLat.lat,
              draftPreviewCoordinates.length >= 2 ? [...draftPreviewCoordinates] : undefined,
            )
          },
        )

        /* ================================================
           INITIALISATION
           ================================================ */

        resetView()

        requestAnimationFrame(
          () => {
            if (!map) {
              return
            }

            map.resize()

            requestAnimationFrame(
              () => {
                if (!map) {
                  return
                }

                map.resize()

                setLoading('Finalisation de la simulation visuelle…', 94)
                mapReady.value = true
                mapError.value = null
                if (startupTimeout !== null) {
                  window.clearTimeout(startupTimeout)
                  startupTimeout = null
                }

                refreshNetworkLayers()
                refreshInterchangeLayers()
                refreshVehicleLayer()
                refreshDraftPreview()
                refreshVisualPreferences()
                refreshRoutingCorridors()
                updateCursor()
                setLoading('Carte prête', 100)
                emit('ready')
              },
            )
          },
        )
        }
        catch (error) {
          console.error('[CLU Métropole] Initialisation de la carte :', error)
          failMap(error)
        }
      },
    )
  }
  catch (error) {
    console.error(
      '[CLU Métropole] Carte :',
      error,
    )

    failMap(error)
  }
})

onBeforeUnmount(() => {
  if (startupTimeout !== null) { window.clearTimeout(startupTimeout); startupTimeout = null }
  if (draftPreviewFrame !== null) { window.cancelAnimationFrame(draftPreviewFrame); draftPreviewFrame = null }
  clearStationMarkers()
  clearInterchangeMarkers()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) {
    map.remove()
    map = null
  }

  if (removePmtilesProtocol) {
    removePmtilesProtocol()
    removePmtilesProtocol =
      null
  }
})
</script>

<template>
  <div class="map-shell">
    <div
      ref="mapContainer"
      class="map-container"
    />

    <div
      v-if="
        !mapReady
        && !mapError
      "
      class="map-loading"
    >
      <span class="map-loading__spinner" />

      <div>
        <strong>
          CLU Métropole
        </strong>

        <span>
          {{ loadingMessage }}
        </span>
      </div>
    </div>

    <div
      v-if="mapError"
      class="map-error"
    >
      <strong>
        Impossible de charger la carte
      </strong>

      <p>
        {{ mapError }}
      </p>
    </div>

    <button
      v-if="mapReady"
      class="reset-view"
      type="button"
      title="Recentrer le terrain de jeu"
      @click="resetView"
    >
      ◎
    </button>

    <Transition name="commune">
      <section
        v-if="
          selectedCommune
          && !building
        "
        class="commune-card"
      >
        <header class="commune-card__header">
          <div>
            <span>
              Commune
            </span>

            <h3>
              <span data-i18n-skip>{{ selectedCommune.name }}</span>
            </h3>
          </div>

          <button
            type="button"
            aria-label="Fermer"
            @click="closeCommune"
          >
            ×
          </button>
        </header>

        <div class="commune-card__content">
          <div>
            <span>
              {{ 'Département' }}
            </span>

            <strong>
              {{ selectedCommune.department }}
            </strong>
          </div>

          <div>
            <span>
              Code
            </span>

            <strong>
              {{ selectedCommune.code }}
            </strong>
          </div>

          <div>
            <span>
              Population
            </span>

            <strong>
              {{
                formatPopulation(
                  selectedCommune.population,
                )
              }}
            </strong>
          </div>
        </div>
      </section>
    </Transition>

    <div class="map-attribution">
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap
      </a>
      · {{ territoryDefinition().attribution }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.map-shell {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0b1117;
}

.map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-loading {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .8rem;
  background: #0b1117;
  color: rgb(255 255 255 / 60%);
}

.map-loading__spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid rgb(255 255 255 / 12%);
  border-top-color: rgb(255 255 255 / 80%);
  border-radius: 50%;
  animation: map-spin .7s linear infinite;
}

.map-loading div {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.map-loading strong {
  font-size: .7rem;
}

.map-loading span {
  font-size: .58rem;
  color: rgb(255 255 255 / 38%);
}

@keyframes map-spin {
  to {
    transform: rotate(360deg);
  }
}

.map-error {
  position: absolute;
  z-index: 30;
  top: 50%;
  left: 50%;
  width: min(460px, calc(100% - 2rem));
  padding: 1rem;
  border: 1px solid rgb(255 110 110 / 20%);
  border-radius: 10px;
  background: rgb(65 18 25 / 90%);
  transform: translate(-50%, -50%);
  backdrop-filter: blur(20px);
  text-align: center;
}

.map-error strong {
  display: block;
  margin-bottom: .4rem;
  font-size: .8rem;
}

.map-error p {
  margin: 0;
  font-size: .65rem;
  line-height: 1.5;
  color: rgb(255 210 210 / 72%);
}

.reset-view {
  position: absolute;
  z-index: 5;
  right: 1rem;
  bottom: 7.4rem;
  width: 2.2rem;
  height: 2.2rem;
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 7px;
  background: rgb(7 15 24 / 78%);
  backdrop-filter: blur(14px);
  color: rgb(255 255 255 / 75%);
  cursor: pointer;
}

.reset-view:hover {
  background: rgb(25 37 51 / 90%);
}

.commune-card {
  position: absolute;
  z-index: 8;
  right: 1rem;
  bottom: 1rem;
  width: min(320px, calc(100% - 2rem));
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 11%);
  border-radius: 12px;
  background: rgb(7 15 24 / 86%);
  box-shadow: 0 20px 60px rgb(0 0 0 / 25%);
  backdrop-filter: blur(22px);
}

.commune-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: .85rem .9rem;
  border-bottom: 1px solid rgb(255 255 255 / 7%);
}

.commune-card__header span {
  display: block;
  margin-bottom: .15rem;
  font-size: .52rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 35%);
}

.commune-card__header h3 {
  margin: 0;
  font-size: 1rem;
}

.commune-card__header button {
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 6px;
  background: rgb(255 255 255 / 5%);
  color: white;
  cursor: pointer;
}

.commune-card__content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .4rem;
  padding: .8rem;
}

.commune-card__content div {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  padding: .55rem;
  border-radius: 6px;
  background: rgb(255 255 255 / 4%);
}

.commune-card__content span {
  font-size: .5rem;
  color: rgb(255 255 255 / 35%);
}

.commune-card__content strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: .63rem;
}

.map-attribution {
  position: absolute;
  z-index: 4;
  right: 3.7rem;
  bottom: .25rem;
  font-size: .47rem;
  color: rgb(255 255 255 / 30%);
}

.map-attribution a {
  color: inherit;
  text-decoration: none;
}

.map-attribution a:hover {
  color: rgb(255 255 255 / 55%);
}

:deep(.maplibregl-map),
:deep(.maplibregl-canvas-container) {
  width: 100%;
  height: 100%;
}

:deep(.maplibregl-canvas) {
  display: block;
}

:deep(.maplibregl-ctrl-group) {
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 7px;
  background: rgb(7 15 24 / 78%);
  box-shadow: none;
}

:deep(.maplibregl-ctrl-group button) {
  background-color: transparent;
}

:deep(.maplibregl-ctrl-group button + button) {
  border-top-color: rgb(255 255 255 / 8%);
}

:deep(.maplibregl-ctrl-icon) {
  filter: invert(1);
  opacity: .65;
}

.commune-enter-active,
.commune-leave-active {
  transition: opacity .15s ease, transform .15s ease;
}

.commune-enter-from,
.commune-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 750px) {
  .commune-card {
    left: 1rem;
    right: 1rem;
    bottom: 6rem;
    width: auto;
  }

  .reset-view {
    bottom: 11rem;
  }
}
</style>
