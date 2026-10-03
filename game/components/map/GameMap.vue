<script setup lang="ts">
import { currentGameLocale, translateGameText, formatGameNumber } from '../../config/i18n'
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
  isRailAutoRouting,
} from '../../config/transportModes'

import type {
  GameDepot,
  GameInterchangeLink,
  GameLine,
  GameLineRoutingMode,
  GameTransportMode,
} from '../../types/network'
import type { GameTerritory } from '../../types/game'
import type { GameGeneratedTerritorySettings } from '../../types/generatedTerritory'
import type { GameVisualVehicle } from '../../engine/transitRuntime'
import type { GameMapInsightMode, GameMapMunicipalityInsight } from '../../types/mapInsights'
import type { GameLineDailySimulation } from '../../types/simulation'
import type { GameBusSubstitutionService, GameManualDisruption } from '../../types/operations'
import {
  findLineStation,
  findLineStationLocation,
  getLineAllStations,
  getLineTerminusStations,
} from '../../engine/network/geometry'
import {
  getBundledLineRenderChunks,
  getBundledLineRenderHintsAtCoordinates,
  getBundledStationRenderHints,
  getLineJunctionStationIds,
  getRenderedLineSequences,
} from '../../engine/network/renderGeometry'
import type { GameBundledLineRenderChunk, GameBundledPositionRenderHint, GameBundledStationRenderHint } from '../../engine/network/renderGeometry'
import { getGameTerritoryMapDefinition } from '../../config/territories'
import { gameMapAssetUrl } from '../../config/mapAssets'
import { generateGeneratedTerritory, normalizeGeneratedTerritorySettings } from '../../engine/territory/generator'
import { getRealTerritoryMunicipalityFallback } from '../../engine/territory/realTerritories'
import { buildSmartRoutingGraph, routeThroughWaypoints, snapPointToSmartGraph, type SmartRouteCoordinate, type SmartRoutingGraph } from '../../engine/network/smartRouting'
import { getSegmentCoordinates } from '../../engine/network/pathGeometry'
import { registerGameMapInstance } from '../../utils/mapBridge'

interface GameMapDraftAnchor {
  longitude: number
  latitude: number
  stationId?: string | null
  kind?: string
}

interface GameJourneyHighlight {
  key: string
  segments: Array<{ lineId: string; color: string; coordinates: Array<[number, number]> }>
  walks: Array<{ coordinates: Array<[number, number]> }>
  points: Array<{ longitude: number; latitude: number; kind: 'ORIGIN' | 'TRANSFER' | 'DESTINATION'; label: string; lineLabel?: string; lineColor?: string }>
}

const props = defineProps<{
  lines: GameLine[]
  dimmedLineIds?: string[]
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
  depots?: GameDepot[]
  vehicles?: GameVisualVehicle[]
  showVehicleAnimations?: boolean
  /** Phase 21 : la simulation peut avancer vite, le rendu véhicule reste volontairement indépendant. */
  simulationPlaying?: boolean
  showBuildings2D5?: boolean
  graphicsQuality?: 'AUTO' | 'ECO' | 'BALANCED' | 'HIGH'
  municipalityInsights?: GameMapMunicipalityInsight[]
  lineReports?: GameLineDailySimulation[]
  insightMode?: GameMapInsightMode
  projectMunicipalityCodes?: string[]
  operationsDisruptions?: GameManualDisruption[]
  substitutionServices?: GameBusSubstitutionService[]
  journeyHighlight?: GameJourneyHighlight | null
}>()

const emit = defineEmits<{
  mapClick: [longitude: number, latitude: number, routeCoordinates?: SmartRouteCoordinate[]]
  draftPreview: [longitude: number | null, latitude: number | null, routeCoordinates?: SmartRouteCoordinate[]]
  lineClick: [lineId: string]
  stationClick: [lineId: string, stationId: string, routeCoordinates?: SmartRouteCoordinate[]]
  vehicleClick: [vehicle: GameVisualVehicle]
  loadingProgress: [message: string, progress: number]
  ready: []
  loadError: [message: string]
  municipalityBuild: [code: string]
  overlayChange: [open: boolean]
  buildRejected: [message: string]
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
  accessibility?: number | null
  growthRate?: number | null
  lineCount?: number
  stationCount?: number
  potential?: number | null
  urbanProjectTitle?: string
  urbanProjectKind?: 'RESIDENTIAL_DISTRICT' | 'BUSINESS_DISTRICT' | 'CAMPUS' | 'LEISURE_HUB'
  urbanProjectOpeningDay?: number
  urbanProjectConstructionStartDay?: number
  urbanProjectMaturityDay?: number
  urbanProjectStatus?: 'PLANNED' | 'CONSTRUCTION' | 'OPENED' | 'MATURE'
  localEventTitle?: string
  localEventKind?: 'CONCERT' | 'FOOTBALL' | 'FESTIVAL' | 'EXHIBITION'
  localEventStartsDay?: number
  localEventVisitors?: number
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

watch(selectedCommune, value => emit('overlayChange', Boolean(value)))

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
let previousProjectMunicipalityCodes = new Set<string>()

interface RenderViewportBounds { west: number; south: number; east: number; north: number }

function activeRenderViewport(paddingRatio = .28): RenderViewportBounds | null {
  if (!map) return null
  try {
    const bounds = map.getBounds()
    const lonPad = Math.max(.01, (bounds.getEast() - bounds.getWest()) * paddingRatio)
    const latPad = Math.max(.008, (bounds.getNorth() - bounds.getSouth()) * paddingRatio)
    return { west: bounds.getWest() - lonPad, south: bounds.getSouth() - latPad, east: bounds.getEast() + lonPad, north: bounds.getNorth() + latPad }
  }
  catch { return null }
}

function pointInActiveViewport(longitude: number, latitude: number, viewport = activeRenderViewport()) {
  if (!viewport) return true
  return longitude >= viewport.west && longitude <= viewport.east && latitude >= viewport.south && latitude <= viewport.north
}

function coordinatesIntersectActiveViewport(coordinates: Array<[number, number]>, viewport = activeRenderViewport()) {
  if (!viewport || coordinates.length === 0) return true
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity
  for (const point of coordinates) {
    west = Math.min(west, point[0]); east = Math.max(east, point[0])
    south = Math.min(south, point[1]); north = Math.max(north, point[1])
  }
  return !(east < viewport.west || west > viewport.east || north < viewport.south || south > viewport.north)
}

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
let interchangeMarkerVisibilityState: { visible: boolean; focusLineId: string | null } | null = null
let interchangeMarkerFrame: number | null = null
let stationMarkers: Array<{ marker: { remove: () => void }; element: HTMLElement; lineId: string }> = []
let stationMarkerSignature = ''
let lastStationRenderDensityKey = ''
let draftCursor: { longitude: number; latitude: number } | null = null
let draftPreviewCoordinates: SmartRouteCoordinate[] = []
let draftPreviewFrame: number | null = null
let draftPreviewEmitTimer: number | null = null
let draftPreviewLastEmitAt = 0

const routingGraphCache = new Map<string, SmartRoutingGraph | null>()
let staticRoutingRevision = 0
let lastStaticGraphRevision = -1

// Les PMTiles ne gardent en mémoire que les tuiles actuellement chargées.
// Pendant un long tracé ferroviaire, un pan de carte peut donc décharger les
// rails proches de l'ancre : si l'on reconstruisait le graphe uniquement avec
// le viewport courant, Rail auto « oublierait » le début du chemin et
// l'aperçu disparaîtrait brutalement. On conserve donc, uniquement pendant la
// construction RER/Train en Rail auto, les fragments ferroviaires déjà vus.
const staticStrictRailFeatureCache = new Map<string, any>()

function resetStaticStrictRailFeatureCache() {
  staticStrictRailFeatureCache.clear()
}

interface CachedLineRenderData {
  revision: string
  stations: ReturnType<typeof getLineAllStations>
  sequences: ReturnType<typeof getRenderedLineSequences>
  terminusIds: Set<string>
  junctionIds: Set<string>
}
const lineRenderDataCache = new Map<string, CachedLineRenderData>()
let bundledLineRenderCacheSignature = ''
let bundledLineRenderCache = new Map<string, GameBundledLineRenderChunk[]>()
let bundledStationRenderHintCacheSignature = ''
let bundledStationRenderHintCache = new Map<string, GameBundledStationRenderHint>()

function lineRenderRevision(line: GameLine) {
  return `${line.updatedAt}:${line.status}:${line.stations.length}:${(line.branches ?? []).map(branch => `${branch.id}:${branch.stations.length}`).join(',')}`
}

function cachedLineRenderData(line: GameLine): CachedLineRenderData {
  const revision = lineRenderRevision(line)
  const cached = lineRenderDataCache.get(line.id)
  if (cached?.revision === revision) return cached
  const stations = getLineAllStations(line)
  const next: CachedLineRenderData = {
    revision,
    stations,
    sequences: getRenderedLineSequences(line),
    terminusIds: new Set(getLineTerminusStations(line).map(station => station.id)),
    junctionIds: getLineJunctionStationIds(line),
  }
  lineRenderDataCache.set(line.id, next)
  return next
}

function cachedBundledLineRenderChunks() {
  const signature = props.lines.map(line => `${line.id}:${lineRenderRevision(line)}`).join('|')
  if (signature !== bundledLineRenderCacheSignature) {
    bundledLineRenderCacheSignature = signature
    bundledLineRenderCache = getBundledLineRenderChunks(props.lines)
    const validIds = new Set(props.lines.map(line => line.id))
    for (const id of [...lineRenderDataCache.keys()]) if (!validIds.has(id)) lineRenderDataCache.delete(id)
  }
  return bundledLineRenderCache
}

function cachedBundledStationRenderHints() {
  const signature = props.lines.map(line => `${line.id}:${lineRenderRevision(line)}`).join('|')
  if (signature !== bundledStationRenderHintCacheSignature) {
    bundledStationRenderHintCacheSignature = signature
    bundledStationRenderHintCache = getBundledStationRenderHints(props.lines)
  }
  return bundledStationRenderHintCache
}

function resolvedGraphicsQuality(): 'ECO' | 'BALANCED' | 'HIGH' {
  const requested = props.graphicsQuality ?? 'AUTO'
  if (requested !== 'AUTO') return requested
  const lineCount = props.lines.length
  const stationCount = props.lines.reduce((total, line) => total + line.stations.length + (line.branches ?? []).reduce((sum, branch) => sum + branch.stations.length, 0), 0)
  const vehicleCount = props.vehicles?.length ?? 0
  const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  const deviceMemory = typeof navigator !== 'undefined' ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) : 8
  if (hardwareConcurrency <= 4 || deviceMemory <= 4 || lineCount >= 45 || stationCount >= 650 || vehicleCount >= 350) return 'ECO'
  if (hardwareConcurrency <= 8 || deviceMemory <= 8 || lineCount >= 14 || stationCount >= 180 || vehicleCount >= 140) return 'BALANCED'
  return 'HIGH'
}

function detailZoom(kind: 'BUILDINGS' | 'BUILDINGS_3D' | 'VEHICLES' | 'CROWDS') {
  const quality = resolvedGraphicsQuality()
  if (kind === 'BUILDINGS') return quality === 'HIGH' ? 10.7 : quality === 'ECO' ? 12.4 : 11.5
  if (kind === 'BUILDINGS_3D') return quality === 'HIGH' ? 12.0 : quality === 'ECO' ? 14.2 : 13.2
  if (kind === 'VEHICLES') return quality === 'HIGH' ? 7.8 : quality === 'ECO' ? 10.2 : 8.4
  return quality === 'HIGH' ? 11.1 : quality === 'ECO' ? 15.2 : 12.4
}

function generatedDetailZoom(kind: 'BLOCKS' | 'STREETS' | 'BUILDINGS' | 'BUILDINGS_3D' | 'POI') {
  const quality = resolvedGraphicsQuality()
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

function lineWidthAtZoom(scale: number, extra: any = 0): any {
  const scaledWidth: any = ['*', ['get', 'width'], scale]
  return extra === 0 ? scaledWidth : ['+', scaledWidth, extra]
}

function corridorOffsetExpression(): any {
  // LOD du faisceau : vu du ciel, les câbles restent lisibles sans occuper
  // des dizaines de pixels. Ils s'écartent progressivement en zoomant et
  // retrouvent leur espacement complet à partir d'environ z12.
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    5, ['*', ['get', 'corridorOffset'], .18],
    6, ['*', ['get', 'corridorOffset'], .24],
    8, ['*', ['get', 'corridorOffset'], .38],
    10, ['*', ['get', 'corridorOffset'], .62],
    12, ['get', 'corridorOffset'],
    15, ['*', ['get', 'corridorOffset'], 1.14],
  ]
}

function corridorOffsetScaleAtZoom(zoom: number) {
  const stops: Array<[number, number]> = [
    [5, .18],
    [6, .24],
    [8, .38],
    [10, .62],
    [12, 1],
    [15, 1.14],
  ]
  if (zoom <= stops[0]![0]) return stops[0]![1]
  for (let index = 1; index < stops.length; index += 1) {
    const [z1, scale1] = stops[index]!
    const [z0, scale0] = stops[index - 1]!
    if (zoom > z1) continue
    const ratio = (zoom - z0) / Math.max(.001, z1 - z0)
    return scale0 + (scale1 - scale0) * ratio
  }
  return stops[stops.length - 1]![1]
}

function shiftedBundledCoordinate(
  hint: GameBundledPositionRenderHint | GameBundledStationRenderHint,
  fallback: [number, number],
): [number, number] {
  if (!map || hint.corridorCount <= 1) return fallback

  const anchor = map.project(hint.coordinate)
  const tangentStart = map.project(hint.tangentStart)
  const tangentEnd = map.project(hint.tangentEnd)
  const dx = tangentEnd.x - tangentStart.x
  const dy = tangentEnd.y - tangentStart.y
  const tangentLength = Math.hypot(dx, dy)
  if (tangentLength <= .001) return hint.coordinate

  const pixelOffset = hint.corridorOffset * corridorOffsetScaleAtZoom(map.getZoom())
  // MapLibre `line-offset` positif = côté droit du sens de la géométrie.
  const rightX = -dy / tangentLength
  const rightY = dx / tangentLength
  const shifted = map.unproject([
    anchor.x + rightX * pixelOffset,
    anchor.y + rightY * pixelOffset,
  ])
  return [shifted.lng, shifted.lat]
}

function renderedStationCoordinate(lineId: string, station: { id: string; longitude: number; latitude: number }): [number, number] {
  const fallback: [number, number] = [station.longitude, station.latitude]
  const hint = cachedBundledStationRenderHints().get(`${lineId}:${station.id}`)
  return hint ? shiftedBundledCoordinate(hint, fallback) : fallback
}

function vehicleSequenceId(line: GameLine, vehicle: GameVisualVehicle) {
  if (vehicle.routeStationIds.length < 2) return null
  const maxSegment = vehicle.routeStationIds.length - 2
  const segmentIndex = Math.max(0, Math.min(maxSegment, Math.floor(vehicle.routePosition)))
  const fromId = vehicle.routeStationIds[segmentIndex]
  const toId = vehicle.routeStationIds[segmentIndex + 1]
  if (!fromId || !toId) return null

  const from = findLineStationLocation(line, fromId)
  const to = findLineStationLocation(line, toId)
  const branchId = !from?.isMain ? from?.branchId : !to?.isMain ? to?.branchId : null
  return branchId ? `${line.id}:branch:${branchId}` : `${line.id}:main`
}

function corridorWidthAtScale(
  isolatedScale: number,
  bundledScale: number,
  sharedExtra = 0,
  isolatedExtra = 0,
): any {
  const bundledExtra = sharedExtra === 0 ? 0 : sharedExtra * bundledScale
  return [
    'case',
    ['>', ['get', 'corridorCount'], 1], lineWidthAtZoom(bundledScale, bundledExtra),
    lineWidthAtZoom(isolatedScale, isolatedExtra),
  ]
}

function sharedCorridorExtra(sharedExtra: number, isolatedExtra: number): any {
  return [
    'case',
    ['>', ['get', 'corridorCount'], 1], sharedExtra,
    isolatedExtra,
  ]
}

function shadowLineWidthExpression(): any {
  return [
    'interpolate', ['linear'], ['zoom'],
    5, corridorWidthAtScale(.62, .18, .4, 4.2),
    6, corridorWidthAtScale(.62, .24, .4, 4.2),
    8, corridorWidthAtScale(.7667, .38, .4, 4.2),
    10, corridorWidthAtScale(.8933, .62, .4, 4.2),
    12, corridorWidthAtScale(1, 1, .4, 4.2),
    15, corridorWidthAtScale(1.14, 1.14, .4, 4.2),
  ]
}

function focusLineWidthExpression(): any {
  return [
    'interpolate', ['linear'], ['zoom'],
    5, corridorWidthAtScale(.62, .18, .4, 7.2),
    6, corridorWidthAtScale(.62, .24, .4, 7.2),
    8, corridorWidthAtScale(.7667, .38, .4, 7.2),
    10, corridorWidthAtScale(.8933, .62, .4, 7.2),
    12, corridorWidthAtScale(1, 1, .4, 7.2),
    15, corridorWidthAtScale(1.14, 1.14, .4, 7.2),
  ]
}

function selectedLineWidthExpression(): any {
  const widthFor = (isolatedScale: number, bundledScale: number): any => [
    'case',
    ['>', ['get', 'corridorCount'], 1], lineWidthAtZoom(bundledScale),
    ['==', ['get', 'active'], 1], lineWidthAtZoom(isolatedScale, 1.35),
    ['==', ['get', 'selected'], 1], lineWidthAtZoom(isolatedScale, .8),
    lineWidthAtZoom(isolatedScale),
  ]

  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    5, widthFor(.62, .18),
    6, widthFor(.62, .24),
    8, widthFor(.7667, .38),
    10, widthFor(.8933, .62),
    12, widthFor(1, 1),
    15, widthFor(1.14, 1.14),
  ]
}

function stableCoreLineWidthExpression(): any {
  const widthFor = (bundledScale: number, isolatedWidth: number): any => [
    'case',
    ['>', ['get', 'corridorCount'], 1], lineWidthAtZoom(bundledScale),
    isolatedWidth,
  ]
  return [
    'interpolate', ['linear'], ['zoom'],
    5, widthFor(.18, 1.6),
    6, widthFor(.24, 1.85),
    8, widthFor(.38, 2.3),
    10, widthFor(.62, 2.7),
    12, widthFor(1, 3.1),
    15, widthFor(1.14, 3.7),
    16, widthFor(1.14, 4),
  ]
}

function workLineWidthExpression(): any {
  const widthFor = (bundled: number, isolated: number): any => [
    'case',
    ['>', ['get', 'corridorCount'], 1], bundled,
    isolated,
  ]
  return [
    'interpolate', ['linear'], ['zoom'],
    5, widthFor(.35, .8),
    8, widthFor(.5, .95),
    10, widthFor(.75, 1.1),
    12, widthFor(1.25, 1.25),
    15, widthFor(1.6, 1.6),
  ]
}

function focusedLineOpacity(): any {
  return [
    'case',
    ['==', ['get', 'journeyContext'], 1], .075,
    ['==', ['get', 'dimmed'], 1], .055,
    ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .22,
    ['==', ['get', 'status'], 'PROJECT'], .84,
    1,
  ]
}

function focusedStationOpacity(): any {
  return [
    'case',
    ['==', ['get', 'journeyContext'], 1], .16,
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

  const basemapPath = definition.basemapPath?.trim()
  if (!basemapPath) {
    throw new Error(`Aucun fond PMTiles n'est configuré pour ${definition.label}.`)
  }

  // URLs déjà distantes (R2 / futur maps.useclu.pro) : PMTiles gère directement
  // ses requêtes HTTP Range. Aucun HEAD préalable, pour éviter les faux négatifs CORS.
  if (/^https?:\/\//i.test(basemapPath)) {
    return basemapPath
  }

  // Compatibilité avec les anciennes configs qui pointent encore vers
  // /game/map/... : on les redirige automatiquement vers le bucket R2.
  const localMapPrefix = '/game/map/'
  if (basemapPath.startsWith(localMapPrefix)) {
    const objectKey = basemapPath.slice(localMapPrefix.length).replace(/^\/+/, '')
    return gameMapAssetUrl(objectKey)
  }

  // Dernier filet de sécurité pour un chemin relatif inhabituel.
  return new URL(basemapPath, window.location.origin).href
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

function networkInsightColor(score: number, mode: GameMapInsightMode | undefined, fallback: string) {
  if (mode === 'FLOW') {
    if (score >= .78) return '#f3b65f'
    if (score >= .48) return '#72e5ea'
    if (score >= .20) return '#6fa7c9'
    return '#435866'
  }
  if (mode === 'SATURATION') {
    if (score >= 1.05) return '#ef7373'
    if (score >= .85) return '#efb75f'
    if (score >= .60) return '#d7d46f'
    return '#72d5a0'
  }
  return fallback
}

function getLineCollection() {
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  const focusContext = focusLineId ? 1 : 0
  const bundledChunks = cachedBundledLineRenderChunks()
  const viewport = activeRenderViewport()
  const reports = new Map((props.lineReports ?? []).map(report => [report.lineId, report] as const))
  const maxFlow = Math.max(1, ...(props.lineReports ?? []).map(report => Math.max(0, report.networkRoutedPassengers ?? report.passengers ?? 0)))
  return {
    type: 'FeatureCollection',
    features: props.lines.flatMap((line, lineIndex) => {
      const mode = getTransportModeDefinition(line.mode)
      const report = reports.get(line.id)
      const flowScore = Math.min(1, Math.max(0, Number(report?.networkRoutedPassengers ?? report?.passengers ?? 0) / maxFlow))
      const saturationScore = Math.max(0, Number(report?.networkLoadRate ?? 0), Number(report?.occupancyRate ?? 0), Number(report?.queuePressureRate ?? 0), Number(report?.bottleneckSegmentLoadRate ?? 0))
      const insightScore = props.insightMode === 'FLOW' ? flowScore : saturationScore
      const widthBoost = props.insightMode === 'FLOW' ? 1 + flowScore * .85 : props.insightMode === 'SATURATION' ? 1 + Math.min(1.25, saturationScore) * .55 : 1
      const displayColor = networkInsightColor(insightScore, props.insightMode, line.color)
      const chunks = (bundledChunks.get(line.id) ?? [])
        .filter(chunk => coordinatesIntersectActiveViewport(chunk.coordinates, viewport))

      return chunks.map((chunk, sequenceIndex) => ({
        type: 'Feature',
        properties: {
          id: line.id,
          segmentId: chunk.id,
          sequenceId: chunk.sequenceId,
          sequenceIndex,
          lineIndex,
          branch: chunk.kind === 'BRANCH' ? 1 : 0,
          name: line.name,
          mode: line.mode,
          status: line.status,
          color: displayColor,
          baseColor: line.color,
          // Dans un faisceau, l'épaisseur reste fixe : les overlays d'analyse
          // ne peuvent pas regonfler une ligne jusqu'à toucher sa voisine.
          width: chunk.corridorCount > 1 ? mode.mapLineWidth : mode.mapLineWidth * widthBoost,
          flowScore,
          saturationScore,
          stationRadius: mode.stationRadius,
          active: line.id === props.activeLineId ? 1 : 0,
          selected: line.id === props.selectedLineId ? 1 : 0,
          focused: line.id === focusLineId ? 1 : 0,
          focusContext,
          journeyContext: props.journeyHighlight ? 1 : 0,
          dimmed: (props.dimmedLineIds ?? []).includes(line.id) ? 1 : 0,
          corridorOffset: chunk.corridorOffset,
          corridorCount: chunk.corridorCount,
        },
        geometry: {
          type: 'LineString',
          coordinates: chunk.coordinates,
        },
      }))
    }),
  }
}

function getJourneyLineCollection() {
  const highlight = props.journeyHighlight
  if (!highlight) return { type: 'FeatureCollection', features: [] }
  const features: GeoJsonFeature[] = []
  for (const segment of highlight.segments) {
    if (!Array.isArray(segment.coordinates) || segment.coordinates.length < 2) continue
    features.push({
      type: 'Feature',
      properties: { kind: 'RIDE', lineId: segment.lineId, color: segment.color },
      geometry: { type: 'LineString', coordinates: segment.coordinates },
    })
  }
  for (const walk of highlight.walks) {
    if (!Array.isArray(walk.coordinates) || walk.coordinates.length < 2) continue
    features.push({
      type: 'Feature',
      properties: { kind: 'WALK', color: '#eafcff' },
      geometry: { type: 'LineString', coordinates: walk.coordinates },
    })
  }
  return { type: 'FeatureCollection', features }
}

function getJourneyPointCollection() {
  const highlight = props.journeyHighlight
  if (!highlight) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: highlight.points.map(point => ({
      type: 'Feature',
      properties: {
        kind: point.kind,
        label: point.label,
        lineLabel: point.lineLabel ?? '',
        lineColor: point.lineColor ?? '#ffffff',
      },
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    })),
  }
}

function getOperationsOverlayCollection() {
  const viewport = activeRenderViewport()
  const lineById = new Map(props.lines.map(line => [line.id, line] as const))
  const features: GeoJsonFeature[] = []
  for (const disruption of props.operationsDisruptions ?? []) {
    const line = lineById.get(disruption.lineId)
    if (!line) continue
    const renderData = cachedLineRenderData(line)
    const stations = new Map(renderData.stations.map(station => [station.id, station] as const))
    if (disruption.scope === 'LINE') {
      for (const sequence of renderData.sequences.filter(sequence => coordinatesIntersectActiveViewport(sequence.coordinates, viewport))) {
        features.push({ type: 'Feature', properties: { kind: 'DISRUPTION', severity: disruption.severity, lineId: line.id }, geometry: { type: 'LineString', coordinates: sequence.coordinates } })
      }
    }
    else if (disruption.scope === 'SEGMENT' && disruption.segmentFromStationId && disruption.segmentToStationId) {
      const from = stations.get(disruption.segmentFromStationId)
      const to = stations.get(disruption.segmentToStationId)
      if (from && to && coordinatesIntersectActiveViewport([[from.longitude, from.latitude], [to.longitude, to.latitude]], viewport)) features.push({ type: 'Feature', properties: { kind: 'DISRUPTION', severity: disruption.severity, lineId: line.id }, geometry: { type: 'LineString', coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] } })
    }
    for (const id of disruption.scope === 'STATIONS' ? disruption.stationIds : []) {
      const station = stations.get(id)
      if (!station || !pointInActiveViewport(station.longitude, station.latitude, viewport)) continue
      features.push({ type: 'Feature', properties: { kind: 'DISRUPTION_STATION', severity: disruption.severity, lineId: line.id }, geometry: { type: 'Point', coordinates: [station.longitude, station.latitude] } })
    }
  }
  for (const service of props.substitutionServices ?? []) {
    const line = lineById.get(service.lineId)
    if (!line) continue
    const stations = new Map(cachedLineRenderData(line).stations.map(station => [station.id, station] as const))
    const coordinates = service.stationIds.map(id => stations.get(id)).filter((station): station is NonNullable<typeof station> => Boolean(station)).map(station => [station.longitude, station.latitude])
    if (coordinates.length >= 2 && coordinatesIntersectActiveViewport(coordinates as [number, number][], viewport)) features.push({ type: 'Feature', properties: { kind: 'SUBSTITUTION', lineId: line.id }, geometry: { type: 'LineString', coordinates } })
  }
  return { type: 'FeatureCollection', features }
}

function stationRenderStrideForZoom(zoom: number) {
  const quality = resolvedGraphicsQuality()
  return zoom >= 10.2
    ? 1
    : zoom >= 8.4
      ? quality === 'ECO' ? 3 : quality === 'BALANCED' ? 2 : 1
      : quality === 'ECO' ? 6 : quality === 'BALANCED' ? 4 : 2
}

function stationRenderDensityKey() {
  if (!map) return ''
  return `${resolvedGraphicsQuality()}:${stationRenderStrideForZoom(map.getZoom())}`
}

function getStationCollection() {
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  const focusContext = focusLineId ? 1 : 0
  const reports = new Map((props.lineReports ?? []).map(report => [report.lineId, report] as const))
  const interchangeStationIds = new Set<string>()
  for (const link of props.interchanges ?? []) {
    interchangeStationIds.add(`${link.fromLineId}:${link.fromStationId}`)
    interchangeStationIds.add(`${link.toLineId}:${link.toStationId}`)
  }
  const viewport = activeRenderViewport()
  const stationStride = stationRenderStrideForZoom(map?.getZoom() ?? 12)

  return {
    type: 'FeatureCollection',
    features: props.lines.flatMap(
      line => {
        const mode =
          getTransportModeDefinition(
            line.mode,
          )
        const renderData = cachedLineRenderData(line)
        const terminusIds = renderData.terminusIds
        const junctionIds = renderData.junctionIds
        const lineReport = reports.get(line.id)
        const stationReports = new Map((lineReport?.stations ?? []).map(item => [item.stationId, item] as const))

        return renderData.stations.filter((station, index) => {
          if (!pointInActiveViewport(station.longitude, station.latitude, viewport)) return false
          if (stationStride <= 1 || line.id === focusLineId) return true
          const important = terminusIds.has(station.id)
            || junctionIds.has(station.id)
            || interchangeStationIds.has(`${line.id}:${station.id}`)
            || station.id === props.selectedStationId
            || station.id === props.draftAnchor?.stationId
          return important || index % stationStride === 0
        }).map(
          (station, index) => {
            const stationReport = stationReports.get(station.id)
            const stationFlow = Math.max(0, Number(stationReport?.boardings ?? 0) + Number(stationReport?.alightings ?? 0) + Number(stationReport?.transferBoardings ?? 0))
            const stationUtilization = Math.max(0, Number(stationReport?.utilizationRate ?? 0))
            return ({
            type: 'Feature',
            properties: {
              id: station.id,
              lineId: line.id,
              lineName: line.name,
              mode: line.mode,
              name: station.name,
              color: networkInsightColor(stationUtilization, props.insightMode === 'SATURATION' ? 'SATURATION' : undefined, line.color),
              baseColor: line.color,
              stationRadius:
                mode.stationRadius,
              stationFlow,
              stationUtilization,
              hubScore: stationReport?.hubScore ?? 0,
              networkRole: stationReport?.networkRole ?? 'LOCAL',
              active:
                line.id === props.activeLineId
                  ? 1
                  : 0,
              selectedLine: line.id === props.selectedLineId ? 1 : 0,
              selectedStation: station.id === props.selectedStationId ? 1 : 0,
              draftAnchor: station.id === props.draftAnchor?.stationId ? 1 : 0,
              focused: line.id === focusLineId ? 1 : 0,
              focusContext,
              journeyContext: props.journeyHighlight ? 1 : 0,
              terminus: terminusIds.has(station.id) ? 1 : 0,
              junction: junctionIds.has(station.id) ? 1 : 0,
              interchange: interchangeStationIds.has(`${line.id}:${station.id}`) ? 1 : 0,
              index,
            },
            geometry: {
              type: 'Point',
              coordinates: renderedStationCoordinate(line.id, station),
            },
          })},
        )
      },
    ),
  }
}

function activeDraftLine() {
  const id = props.activeLineId
  return id ? props.lines.find(line => line.id === id) ?? null : null
}

function routingCorridorKinds(mode: GameTransportMode, routingMode: GameLineRoutingMode) {
  if (isRailAutoRouting(mode, routingMode)) return ['rail']
  if (mode === 'TRAM') return ['rail', 'major_road', 'minor_road', 'street']
  if (mode === 'BUS' || mode === 'BRT') return ['highway', 'major_road', 'minor_road', 'street']
  return ['rail', 'major_road']
}

function routingCorridorFilter(local: boolean): any {
  const line = activeDraftLine()
  const mode = line?.mode ?? 'METRO'
  const routingMode = props.routingMode ?? line?.routingMode ?? 'ASSISTED'
  const kinds = routingCorridorKinds(mode, routingMode)
  const kindFilter: any = ['in', ['get', 'kind'], ['literal', kinds]]
  return local
    ? ['all', ['==', ['get', 'layer'], 'road'], kindFilter]
    : kindFilter
}

function refreshRoutingCorridors() {
  if (!map || !mapReady.value) return
  const line = activeDraftLine()
  const assisted = props.building && Boolean(line) && (props.routingMode ?? line?.routingMode ?? 'ASSISTED') !== 'FREE'
  const layerId = localTerritoryRuntime() ? 'game-routing-corridors-local' : 'game-routing-corridors-static'
  try {
    if (!map.getLayer(layerId)) return
    map.setFilter(layerId, routingCorridorFilter(Boolean(localTerritoryRuntime())))
    map.setLayoutProperty(layerId, 'visibility', assisted ? 'visible' : 'none')
  }
  catch {}
}

function routingGraphKey(mode: GameTransportMode, routingMode: GameLineRoutingMode = 'ASSISTED') {
  const definition = territoryDefinition()
  const generated = props.territoryId === 'GENERATED' ? normalizeGeneratedTerritorySettings(props.generatedTerritory) : null
  return `${definition.id}:${generated?.seed ?? ''}:${generated?.size ?? ''}:${mode}:${routingMode}`
}

function staticRoadFeatureCollection(
  mode?: GameTransportMode,
  routingMode: GameLineRoutingMode = 'ASSISTED',
) {
  if (!map || localTerritoryRuntime()) return null
  try {
    const features = map.querySourceFeatures('basemap', { sourceLayer: 'roads' } as any)
    if (!features?.length && staticStrictRailFeatureCache.size === 0) return null

    const strictRail = mode !== undefined && isRailAutoRouting(mode, routingMode)
    const normalized = (features ?? []).map((feature: any) => ({
      type: 'Feature',
      properties: { ...(feature.properties ?? {}), layer: 'road' },
      geometry: feature.geometry,
    }))

    if (!strictRail) {
      return {
        type: 'FeatureCollection',
        features: normalized,
      }
    }

    // `querySourceFeatures()` ne renvoie que les tuiles vectorielles chargées.
    // Pour Rail auto strict, on mémorise les fragments de voie déjà traversés
    // par la caméra afin qu'un long détour reste routable après un pan/zoom.
    for (const feature of normalized) {
      if (String(feature.properties?.kind ?? '') !== 'rail' || !feature.geometry) continue
      const key = `${String(feature.geometry.type ?? '')}:${JSON.stringify(feature.geometry.coordinates ?? null)}`
      if (!staticStrictRailFeatureCache.has(key)) staticStrictRailFeatureCache.set(key, feature)
    }

    if (!staticStrictRailFeatureCache.size) return null
    return {
      type: 'FeatureCollection',
      features: [...staticStrictRailFeatureCache.values()],
    }
  }
  catch {
    return staticStrictRailFeatureCache.size
      ? { type: 'FeatureCollection', features: [...staticStrictRailFeatureCache.values()] }
      : null
  }
}

function smartRoutingGraph(mode: GameTransportMode, routingMode: GameLineRoutingMode = 'ASSISTED') {
  const runtime = localTerritoryRuntime()
  if (runtime) {
    const key = routingGraphKey(mode, routingMode)
    const profile = isRailAutoRouting(mode, routingMode) ? 'RAIL' : mode === 'RER' || mode === 'TRAIN' ? 'LIGHT' : 'DEFAULT'
    if (!routingGraphCache.has(key)) routingGraphCache.set(key, buildSmartRoutingGraph(runtime.basemapGeoJson as any, mode, profile))
    return routingGraphCache.get(key) ?? null
  }
  const key = `STATIC:${props.territoryId ?? 'ILE_DE_FRANCE'}:${mode}:${routingMode}:${staticRoutingRevision}`
  if (lastStaticGraphRevision !== staticRoutingRevision) {
    for (const cacheKey of [...routingGraphCache.keys()]) if (cacheKey.startsWith('STATIC:')) routingGraphCache.delete(cacheKey)
    lastStaticGraphRevision = staticRoutingRevision
  }
  const profile = isRailAutoRouting(mode, routingMode) ? 'RAIL' : mode === 'RER' || mode === 'TRAIN' ? 'LIGHT' : 'DEFAULT'
  if (!routingGraphCache.has(key)) routingGraphCache.set(key, buildSmartRoutingGraph(staticRoadFeatureCollection(mode, routingMode) as any, mode, profile))
  return routingGraphCache.get(key) ?? null
}

const STRICT_RAIL_SNAP_METERS = 850
const STRICT_EXISTING_STATION_SNAP_METERS = 220

function strictRailAutoContext() {
  const line = activeDraftLine()
  const mode = line?.mode ?? 'METRO'
  const routingMode = props.routingMode ?? line?.routingMode ?? 'ASSISTED'
  const strict = isRailAutoRouting(mode, routingMode)
  return { line, mode, routingMode, strict }
}

function snapStrictRailPoint(
  longitude: number,
  latitude: number,
  maxDistanceMeters = STRICT_RAIL_SNAP_METERS,
) {
  const context = strictRailAutoContext()
  if (!context.strict) return [longitude, latitude] as SmartRouteCoordinate
  return snapPointToSmartGraph(
    smartRoutingGraph(context.mode, context.routingMode),
    [longitude, latitude],
    maxDistanceMeters,
  )
}

function buildDraftPreviewCoordinates(cursor?: { longitude: number; latitude: number } | null) {
  const anchor = props.draftAnchor
  if (!anchor || !cursor) return [] as SmartRouteCoordinate[]
  const line = activeDraftLine()
  const mode = line?.mode ?? 'METRO'
  const routingMode = props.routingMode ?? line?.routingMode ?? 'ASSISTED'
  const strictRail = isRailAutoRouting(mode, routingMode)
  const snappedCursor = strictRail
    ? snapPointToSmartGraph(smartRoutingGraph(mode, routingMode), [cursor.longitude, cursor.latitude], STRICT_RAIL_SNAP_METERS)
    : [cursor.longitude, cursor.latitude] as SmartRouteCoordinate
  if (!snappedCursor) return [] as SmartRouteCoordinate[]
  const points: SmartRouteCoordinate[] = [
    [anchor.longitude, anchor.latitude],
    ...(props.draftGuidePoints ?? []).map(point => [point[0], point[1]] as SmartRouteCoordinate),
    snappedCursor,
  ]
  if (mode === 'FERRY' || routingMode === 'FREE') return routeThroughWaypoints(null, points, false)
  return routeThroughWaypoints(smartRoutingGraph(mode, routingMode), points, true)
}


function waterValidationLayerIds() {
  if (!map) return [] as string[]
  return [
    'generated-water-polygons',
    'generated-water-lines',
    'base-water',
    'base-water-lines',
  ].filter(id => {
    try { return Boolean(map?.getLayer(id)) }
    catch { return false }
  })
}

function pointTouchesNavigableWater(longitude: number, latitude: number, tolerancePx = 5) {
  if (!map || !mapReady.value) return false
  const layers = waterValidationLayerIds()
  if (!layers.length) return false
  try {
    const point = map.project([longitude, latitude])
    const box: any = [
      [point.x - tolerancePx, point.y - tolerancePx],
      [point.x + tolerancePx, point.y + tolerancePx],
    ]
    return map.queryRenderedFeatures(box, { layers }).length > 0
  }
  catch {
    return false
  }
}

function routeStaysOnNavigableWater(coordinates: SmartRouteCoordinate[]) {
  if (!map || !mapReady.value || coordinates.length < 2) return false
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1]!
    const to = coordinates[index]!
    let pixelDistance = 80
    try {
      const a = map.project(from)
      const b = map.project(to)
      pixelDistance = Math.hypot(b.x - a.x, b.y - a.y)
    }
    catch {}
    const steps = Math.min(40, Math.max(2, Math.ceil(pixelDistance / 7)))
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const longitude = from[0] + (to[0] - from[0]) * t
      const latitude = from[1] + (to[1] - from[1]) * t
      if (!pointTouchesNavigableWater(longitude, latitude, 5)) return false
    }
  }
  return true
}

function ferryPlacementIsValid(
  longitude: number,
  latitude: number,
  routeCoordinates?: SmartRouteCoordinate[],
) {
  const line = activeDraftLine()
  if (line?.mode !== 'FERRY') return true
  if (!pointTouchesNavigableWater(longitude, latitude, 6)) return false
  if (!props.draftAnchor) return true
  if (!routeCoordinates?.length || routeCoordinates.length < 2) return false
  return routeStaysOnNavigableWater(routeCoordinates)
}

function rejectInvalidFerryPlacement() {
  emit(
    'buildRejected',
    'Navette fluviale : placez la halte sur l’eau et gardez tout le tracé dans la voie d’eau. Ajoutez des points de guidage pour suivre une rivière ou un canal.',
  )
}

function rejectInvalidRailAutoPlacement(kind: 'SNAP' | 'PATH') {
  emit(
    'buildRejected',
    kind === 'SNAP'
      ? 'Rail auto : cliquez plus près d’une voie ferrée existante, ou passez sur Aide légère / Libre.'
      : 'Rail auto : aucune continuité ferroviaire n’a été trouvée entre ces points. Passez sur Aide légère / Libre pour créer une nouvelle emprise.',
  )
}

function projectCatchmentRadiusMeters(mode: GameTransportMode) {
  if (mode === 'RER' || mode === 'TRAIN') return 1400
  if (mode === 'METRO') return 900
  if (mode === 'TRAM') return 700
  if (mode === 'CABLE') return 850
  if (mode === 'FERRY') return 900
  if (mode === 'BRT') return 600
  return 480
}

function circlePolygon(longitude: number, latitude: number, radiusMeters: number, steps = 28) {
  const latRadius = radiusMeters / 111_320
  const lonRadius = radiusMeters / Math.max(1, 111_320 * Math.cos(latitude * Math.PI / 180))
  const coordinates: Array<[number, number]> = []
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2
    coordinates.push([
      longitude + Math.cos(angle) * lonRadius,
      latitude + Math.sin(angle) * latRadius,
    ])
  }
  return coordinates
}

function getProjectCatchmentCollection() {
  if (!props.building) return { type: 'FeatureCollection', features: [] }
  const line = activeDraftLine()
  if (!line) return { type: 'FeatureCollection', features: [] }
  const radiusMeters = projectCatchmentRadiusMeters(line.mode)
  return {
    type: 'FeatureCollection',
    features: cachedLineRenderData(line).stations.map(station => ({
      type: 'Feature',
      properties: { stationId: station.id, radiusMeters, mode: line.mode },
      geometry: {
        type: 'Polygon',
        coordinates: [circlePolygon(station.longitude, station.latitude, radiusMeters)],
      },
    })),
  }
}

function getDraftPreviewCollection(cursor?: { longitude: number; latitude: number } | null) {
  const anchor = props.draftAnchor
  const features: unknown[] = []
  draftPreviewCoordinates = buildDraftPreviewCoordinates(cursor)
  if (anchor && cursor && draftPreviewCoordinates.length >= 2) {
    const waterValid = ferryPlacementIsValid(cursor.longitude, cursor.latitude, draftPreviewCoordinates)
    const properties = {
      kind: props.draftAnchor?.kind ?? 'BUILD',
      routingMode: props.routingMode ?? activeDraftLine()?.routingMode ?? 'ASSISTED',
      waterValid: waterValid ? 1 : 0,
    }
    features.push({
      type: 'Feature',
      properties,
      geometry: {
        type: 'LineString',
        coordinates: draftPreviewCoordinates,
      },
    })
    for (const point of props.draftGuidePoints ?? []) {
      features.push({
        type: 'Feature',
        properties: { kind: 'GUIDE', waterValid: pointTouchesNavigableWater(point[0], point[1], 6) ? 1 : 0 },
        geometry: { type: 'Point', coordinates: point },
      })
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
  const viewport = activeRenderViewport()
  const links = props.interchanges ?? []
  const lineById = new Map(props.lines.map(line => [line.id, line]))
  return {
    type: 'FeatureCollection',
    features: links
      .filter(link => link.distanceMeters > 1 && (link.kind === 'WALKING' || link.distanceMeters <= 800))
      .map(link => {
        const fromLine = lineById.get(link.fromLineId)
        const from = fromLine ? findLineStation(fromLine, link.fromStationId) : null
        const toLine = lineById.get(link.toLineId)
        const to = toLine ? findLineStation(toLine, link.toStationId) : null
        if (!from || !to || !coordinatesIntersectActiveViewport([[from.longitude, from.latitude], [to.longitude, to.latitude]], viewport)) return null
        return {
          type: 'Feature',
          properties: {
            quality: link.quality,
            distance: Math.round(link.distanceMeters),
            walkingMinutes: link.walkingMinutes,
            kind: link.kind,
          },
          geometry: { type: 'LineString', coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] },
        }
      })
      .filter(Boolean),
  }
}

function getDepotCollection() {
  return {
    type: 'FeatureCollection',
    features: (props.depots ?? []).filter(depot => pointInActiveViewport(depot.longitude, depot.latitude)).map(depot => ({
      type: 'Feature',
      properties: {
        id: depot.id,
        name: depot.name,
        mode: depot.mode,
        capacity: depot.capacity,
        accent: getTransportModeDefinition(depot.mode).accent,
      },
      geometry: { type: 'Point', coordinates: [depot.longitude, depot.latitude] },
    })),
  }
}

function getVehicleCollection() {
  const lineById = new Map(props.lines.map(line => [line.id, line] as const))
  const vehicles = (props.vehicles ?? []).filter(vehicle => pointInActiveViewport(vehicle.longitude, vehicle.latitude))
  const renderHints = getBundledLineRenderHintsAtCoordinates(
    props.lines,
    vehicles.flatMap(vehicle => {
      const line = lineById.get(vehicle.lineId)
      if (!line) return []
      return [{
        key: vehicle.id,
        lineId: line.id,
        target: [vehicle.longitude, vehicle.latitude] as [number, number],
        sequenceId: vehicleSequenceId(line, vehicle),
        maxDistanceMeters: 2_500,
      }]
    }),
  )
  return {
    type: 'FeatureCollection',
    features: vehicles.map(vehicle => {
      const fallback: [number, number] = [vehicle.longitude, vehicle.latitude]
      const hint = renderHints.get(vehicle.id)
      const coordinates = hint ? shiftedBundledCoordinate(hint, fallback) : fallback
      return {
        type: 'Feature',
        properties: {
          id: vehicle.id,
          lineId: vehicle.lineId,
          color: vehicle.color,
          shortCode: vehicle.shortCode,
        },
        geometry: { type: 'Point', coordinates },
      }
    }),
  }
}

function getPassengerFlowCollection() {
  const viewport = activeRenderViewport()
  const reports = props.lineReports ?? []
  const maxPassengers = Math.max(1, ...reports.flatMap(report => (report.segments ?? []).map(segment => Math.max(0, segment.routedPassengers))))
  const lineById = new Map(props.lines.map(line => [line.id, line] as const))
  const features: GeoJsonFeature[] = []
  for (const report of reports) {
    const line = lineById.get(report.lineId)
    if (!line) continue
    const stationById = new Map(cachedLineRenderData(line).stations.map(station => [station.id, station] as const))
    for (const segment of report.segments ?? []) {
      const from = stationById.get(segment.fromStationId)
      const to = stationById.get(segment.toStationId)
      if (!from || !to) continue
      const coordinates = getSegmentCoordinates(line, from, to) ?? [[from.longitude, from.latitude], [to.longitude, to.latitude]]
      if (!coordinatesIntersectActiveViewport(coordinates as [number, number][], viewport)) continue
      const score = Math.max(0, Math.min(1, Math.log1p(Math.max(0, segment.routedPassengers)) / Math.log1p(maxPassengers)))
      features.push({
        type: 'Feature',
        properties: {
          lineId: line.id,
          color: line.color,
          passengers: Math.max(0, Math.round(segment.routedPassengers)),
          flowScore: score,
          loadRate: Math.max(0, segment.loadRate),
        },
        geometry: { type: 'LineString', coordinates },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

function getStationCrowdCollection() {
  const viewport = activeRenderViewport()
  const groups = new Map<string, { name: string; longitude: number; latitude: number; waiting: number; peak: number; leftBehind: number; utilization: number }>()
  const reports = new Map((props.lineReports ?? []).map(report => [report.lineId, report] as const))
  for (const line of props.lines) {
    const lineReport = reports.get(line.id)
    const stationReports = new Map((lineReport?.stations ?? []).map(item => [item.stationId, item] as const))
    for (const station of cachedLineRenderData(line).stations) {
      if (!pointInActiveViewport(station.longitude, station.latitude, viewport)) continue
      const report = stationReports.get(station.id)
      if (!report) continue
      const key = station.sharedStationId ? `shared:${station.sharedStationId}` : `point:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}`
      const existing = groups.get(key) ?? { name: station.name, longitude: station.longitude, latitude: station.latitude, waiting: 0, peak: 0, leftBehind: 0, utilization: 0 }
      existing.waiting += Math.max(0, Number(report.estimatedPlatformPassengers ?? 0))
      existing.peak += Math.max(0, Number(report.estimatedPeakPlatformPassengers ?? report.estimatedPlatformPassengers ?? 0))
      existing.leftBehind += Math.max(0, Number(report.leftBehindPassengers ?? 0))
      existing.utilization = Math.max(existing.utilization, Math.max(0, Number(report.utilizationRate ?? 0)))
      groups.set(key, existing)
    }
  }
  const maxCrowd = Math.max(1, ...[...groups.values()].map(item => Math.max(item.waiting, item.peak * .55) + item.leftBehind * .35))
  const features: GeoJsonFeature[] = []
  for (const item of groups.values()) {
    const crowd = Math.max(item.waiting, item.peak * .55) + item.leftBehind * .35
    if (crowd < 40 && item.utilization < .55) continue
    const normalized = Math.max(0, Math.min(1, Math.log1p(crowd) / Math.log1p(maxCrowd)))
    const level = item.utilization >= 1.05 || item.leftBehind >= 500 || crowd >= 2200 ? 4 : crowd >= 1100 ? 3 : crowd >= 420 ? 2 : 1
    features.push({
      type: 'Feature',
      properties: {
        name: item.name,
        waiting: Math.round(item.waiting),
        peak: Math.round(item.peak),
        leftBehind: Math.round(item.leftBehind),
        utilization: item.utilization,
        crowdScore: normalized,
        crowdLevel: level,
        color: item.utilization >= 1.05 || item.leftBehind >= 500 ? '#ef7373' : item.utilization >= .85 ? '#efb75f' : '#72d5a0',
      },
      geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
    })
  }
  return { type: 'FeatureCollection', features }
}

function clearInterchangeMarkers(resetSignature = true) {
  for (const item of interchangeMarkers) {
    try { item.marker.remove() } catch {}
  }
  interchangeMarkers = []
  interchangeMarkerVisibilityState = null
  if (resetSignature) interchangeMarkerSignature = ''
}

function clearStationMarkers(resetSignature = true) {
  // Phase 21 : les stations sont rendues nativement par MapLibre. Les anciens
  // Marker DOM étaient très coûteux sur les réseaux de plusieurs centaines
  // d'arrêts et faisaient laguer aussi bien les clics que le déplacement carte.
  for (const item of stationMarkers) {
    try { item.marker.remove() } catch {}
  }
  stationMarkers = []
  if (resetSignature) stationMarkerSignature = ''
}

function updateStationMarkerVisibility() {
  // Les minzoom/filtres sont désormais gérés directement par les couches
  // `game-network-station-*`, sans parcourir des centaines de nœuds DOM.
}

async function rebuildStationMarkers() {
  if (stationMarkers.length) clearStationMarkers(false)
  stationMarkerSignature = 'MAPLIBRE_NATIVE_V21'
}

function interchangeDetailZoom() {
  const quality = resolvedGraphicsQuality()
  // Les badges DOM de correspondance sont coûteux (layout + events). En AUTO/ECO
  // on privilégie donc la carte et les lignes jusqu'à un zoom réellement utile.
  return quality === 'ECO' ? 11.2 : quality === 'BALANCED' ? 10.1 : 9.2
}

function updateInterchangeMarkerVisibility(force = false) {
  if (!map) return
  const visible = map.getZoom() >= interchangeDetailZoom()
  const focusLineId = props.activeLineId ?? props.selectedLineId ?? null
  if (
    !force
    && interchangeMarkerVisibilityState?.visible === visible
    && interchangeMarkerVisibilityState.focusLineId === focusLineId
  ) return
  interchangeMarkerVisibilityState = { visible, focusLineId }
  for (const item of interchangeMarkers) {
    item.element.style.display = visible ? 'flex' : 'none'
    const lineIds = (item.element.dataset.lineIds ?? '').split(',').filter(Boolean)
    item.element.style.opacity = focusLineId && !lineIds.includes(focusLineId) ? '.32' : '1'
    const label = item.element.querySelector<HTMLElement>('[data-interchange-name]')
    if (label) label.style.display = 'block'
  }
}

function scheduleInterchangeMarkerRebuild() {
  if (interchangeMarkerFrame !== null) return
  interchangeMarkerFrame = window.requestAnimationFrame(() => {
    interchangeMarkerFrame = null
    void rebuildInterchangeMarkers()
  })
}

async function rebuildInterchangeMarkers() {
  if (!map || !mapReady.value || !maplibreApi) return
  const zoom = map.getZoom()
  if (zoom < interchangeDetailZoom() - .15) {
    if (interchangeMarkers.length) clearInterchangeMarkers(false)
    interchangeMarkerSignature = 'hidden'
    return
  }
  const bounds = map.getBounds()
  const links = props.interchanges ?? []
  const viewportKey = [
    Math.floor(zoom * 2) / 2,
    bounds.getWest().toFixed(2), bounds.getSouth().toFixed(2),
    bounds.getEast().toFixed(2), bounds.getNorth().toFixed(2),
  ].join(':')
  const markerSignature = JSON.stringify({
    viewportKey,
    links: links.map(link => [link.fromLineId, link.fromStationId, link.toLineId, link.toStationId, Math.round(link.distanceMeters)]),
    lines: props.lines.map(line => [line.id, line.updatedAt, line.name, line.shortCode, line.color, line.customLogoDataUrl?.length ?? 0]),
  })
  if (markerSignature === interchangeMarkerSignature) { updateInterchangeMarkerVisibility(); return }
  interchangeMarkerSignature = markerSignature
  clearInterchangeMarkers(false)
  const lineById = new Map(props.lines.map(line => [line.id, line]))
  const groups = new Map<string, { name: string; longitude: number; latitude: number; lineIds: Set<string>; lineId: string; stationId: string; stationIds: Map<string, string> }>()

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
      stationIds: new Map<string, string>(),
    }
    existing.lineIds.add(lineId)
    existing.lineIds.add(otherLineId)
    existing.stationIds.set(lineId, stationId)
    groups.set(sharedKey, existing)
  }

  for (const link of links) {
    addStation(link.fromLineId, link.fromStationId, link.toLineId)
    addStation(link.toLineId, link.toStationId, link.fromLineId)
  }

  for (const group of groups.values()) {
    if (group.lineIds.size < 2) continue
    if (!bounds.contains([group.longitude, group.latitude])) continue
    const element = document.createElement('div')
    element.className = 'clu-interchange-marker'
    element.dataset.i18nSkip = '1'
    element.dataset.lineIds = [...group.lineIds].join(',')
    element.style.cssText = 'display:none;align-items:center;gap:5px;max-width:250px;padding:4px 7px;border:1px solid rgba(255,255,255,.72);border-radius:9px;background:rgba(8,14,19,.91);box-shadow:0 5px 15px rgba(0,0,0,.32);color:#eef7f8;font:750 calc(10px * var(--clu-text-scale,1))/1.1 Inter,system-ui,sans-serif;pointer-events:auto;white-space:nowrap;transition:opacity .15s ease;'
    element.title = `${group.name} · ${group.lineIds.size} lignes`

    const name = document.createElement('span')
    name.dataset.interchangeName = '1'
    name.textContent = group.name
    name.style.cssText = 'display:block;max-width:135px;overflow:hidden;text-overflow:ellipsis;'
    element.appendChild(name)

    const badges = document.createElement('span')
    badges.style.cssText = 'display:flex;align-items:center;gap:2px;flex:none;'
    for (const lineId of [...group.lineIds]) {
      const line = lineById.get(lineId)
      if (!line) continue
      const badge = document.createElement('span')
      badge.title = line.name
      badge.style.cssText = `min-width:17px;height:17px;padding:0 3px;border-radius:5px;display:grid;place-items:center;overflow:hidden;background:${line.color};color:#081014;font:900 calc(7px * var(--clu-text-scale,1))/1 Inter,system-ui,sans-serif;`
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
      const preferredLineId = props.activeLineId && group.stationIds.has(props.activeLineId) ? props.activeLineId : group.lineId
      if (strictRailAutoContext().strict && !snapStrictRailPoint(group.longitude, group.latitude, STRICT_EXISTING_STATION_SNAP_METERS)) { rejectInvalidRailAutoPlacement('SNAP'); return }
      const routeCoordinates = props.draftAnchor
        ? buildDraftPreviewCoordinates({ longitude: group.longitude, latitude: group.latitude })
        : undefined
      if (strictRailAutoContext().strict && props.draftAnchor && (!routeCoordinates || routeCoordinates.length < 2)) { rejectInvalidRailAutoPlacement('PATH'); return }
      if (
        props.building
        && activeDraftLine()?.mode === 'FERRY'
        && !ferryPlacementIsValid(group.longitude, group.latitude, routeCoordinates)
      ) {
        rejectInvalidFerryPlacement()
        return
      }
      emit('stationClick', preferredLineId, group.stationIds.get(preferredLineId) ?? group.stationId, routeCoordinates?.length >= 2 ? routeCoordinates : undefined)
    })

    const marker = new maplibreApi.Marker({ element, anchor: 'bottom-left', offset: [5, -9] })
      .setLngLat([group.longitude, group.latitude])
      .addTo(map)
    interchangeMarkers.push({ marker, element })
  }
  updateInterchangeMarkerVisibility(true)
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
    'game-journey-points-halo',
    'game-journey-points-core',
    'game-journey-transfer-line-labels',
    'game-journey-point-labels',
  ]) {
    try { if (map.getLayer(layerId)) map.moveLayer(layerId) } catch {}
  }
}

function refreshLineStationLayers() {
  if (!map || !mapReady.value) return
  const lineSource = map.getSource('game-network-lines')
  const stationSource = map.getSource('game-network-stations')
  if (hasSetData(lineSource)) lineSource.setData(getLineCollection())
  if (hasSetData(stationSource)) stationSource.setData(getStationCollection())
  raiseNetworkPointLayers()
}

function refreshStationLayer() {
  if (!map || !mapReady.value) return
  const stationSource = map.getSource('game-network-stations')
  if (hasSetData(stationSource)) stationSource.setData(getStationCollection())
  raiseNetworkPointLayers()
}

function refreshOperationsLayer() {
  if (!map || !mapReady.value) return
  const operationsSource = map.getSource('game-operations-overlay')
  if (hasSetData(operationsSource)) operationsSource.setData(getOperationsOverlayCollection())
}

function refreshJourneyLayers() {
  if (!map || !mapReady.value) return
  const lineSource = map.getSource('game-journey-lines')
  const pointSource = map.getSource('game-journey-points')
  if (hasSetData(lineSource)) lineSource.setData(getJourneyLineCollection())
  if (hasSetData(pointSource)) pointSource.setData(getJourneyPointCollection())
  // Le trajet doit rester la lecture principale, même si une couche d'analyse
  // (flux, perturbation...) était active avant l'ouverture du planificateur.
  for (const layerId of [
    'game-journey-lines-casing',
    'game-journey-lines',
    'game-journey-walks',
    'game-journey-points-halo',
    'game-journey-points-core',
    'game-journey-transfer-line-labels',
    'game-journey-point-labels',
  ]) {
    try { if (map.getLayer(layerId)) map.moveLayer(layerId) } catch {}
  }
}

function refreshPassengerMetricLayers() {
  if (!map || !mapReady.value) return
  const empty = { type: 'FeatureCollection', features: [] }
  const flowSource = map.getSource('game-passenger-flows')
  const crowdSource = map.getSource('game-station-crowds')
  const flowVisible = props.insightMode === 'FLOW'
  const crowdVisible = resolvedGraphicsQuality() !== 'ECO' && map.getZoom() >= detailZoom('CROWDS') - .35
  // Les GeoJSON de flux/foules sont parmi les plus coûteux du rendu. Ne pas les
  // reconstruire lorsque leurs couches sont invisibles économise du CPU sans
  // retirer aucune donnée : elles sont recalculées dès que l'utilisateur zoome
  // ou active la lecture des flux.
  if (hasSetData(flowSource)) flowSource.setData(flowVisible ? getPassengerFlowCollection() : empty)
  if (hasSetData(crowdSource)) crowdSource.setData(crowdVisible ? getStationCrowdCollection() : empty)
  try {
    if (map.getLayer('game-passenger-flows')) map.setLayoutProperty('game-passenger-flows', 'visibility', flowVisible ? 'visible' : 'none')
  }
  catch {}
}

function refreshNetworkLayers() {
  if (!map || !mapReady.value) return
  refreshLineStationLayers()
  refreshOperationsLayer()
  refreshJourneyLayers()
  refreshPassengerMetricLayers()
  void rebuildStationMarkers()
  refreshProjectCatchment()
}

function refreshProjectCatchment() {
  if (!map || !mapReady.value) return
  const source = map.getSource('game-project-catchment')
  if (hasSetData(source)) source.setData(getProjectCatchmentCollection())
}

function refreshInterchangeLayers(refreshStations = true) {
  if (!map || !mapReady.value) return
  const interchangeSource = map.getSource('game-network-interchanges')
  if (hasSetData(interchangeSource)) interchangeSource.setData(getInterchangeCollection())
  // Les stations changent légèrement de rendu lorsqu'elles deviennent un pôle.
  // Si LINE_STATION est déjà traité dans la même frame, ne reconstruisons pas
  // deux fois le même GeoJSON de stations.
  if (refreshStations) {
    const stationSource = map.getSource('game-network-stations')
    if (hasSetData(stationSource)) stationSource.setData(getStationCollection())
    raiseNetworkPointLayers()
  }
  scheduleInterchangeMarkerRebuild()
}

function refreshDepotLayer() {
  if (!map || !mapReady.value) return
  const source = map.getSource('game-network-depots')
  if (hasSetData(source)) source.setData(getDepotCollection())
}

function refreshVehicleLayer() {
  if (!map || !mapReady.value) return
  const vehicleSource = map.getSource('game-network-vehicles')
  const visible = props.showVehicleAnimations !== false && map.getZoom() >= detailZoom('VEHICLES') - .35
  if (hasSetData(vehicleSource)) vehicleSource.setData(visible ? getVehicleCollection() : { type: 'FeatureCollection', features: [] })
}


function emitDraftPreviewMetrics() {
  draftPreviewLastEmitAt = performance.now()
  const strictRail = strictRailAutoContext().strict
  if (strictRail && props.draftAnchor && draftPreviewCoordinates.length < 2) {
    emit('draftPreview', null, null, undefined)
    return
  }
  const snappedPreviewEnd = strictRail && draftPreviewCoordinates.length >= 2
    ? draftPreviewCoordinates[draftPreviewCoordinates.length - 1]
    : null
  emit(
    'draftPreview',
    snappedPreviewEnd?.[0] ?? draftCursor?.longitude ?? null,
    snappedPreviewEnd?.[1] ?? draftCursor?.latitude ?? null,
    draftCursor && draftPreviewCoordinates.length >= 2 ? [...draftPreviewCoordinates] : undefined,
  )
}

function scheduleDraftPreviewMetrics() {
  // Le trait visuel reste rafraîchi à chaque frame, mais le calcul parent de coût,
  // distance et faisabilité clone le projet complet. Sur une grande ligne, l'émettre
  // 60 fois/s rendait le tracé nettement moins fluide. ~12–14 calculs/s suffisent
  // largement pour l'aperçu chiffré sans ralentir le curseur.
  if (!draftCursor) {
    if (draftPreviewEmitTimer !== null) {
      window.clearTimeout(draftPreviewEmitTimer)
      draftPreviewEmitTimer = null
    }
    emitDraftPreviewMetrics()
    return
  }
  const elapsed = performance.now() - draftPreviewLastEmitAt
  const delay = 75
  if (elapsed >= delay) {
    if (draftPreviewEmitTimer !== null) {
      window.clearTimeout(draftPreviewEmitTimer)
      draftPreviewEmitTimer = null
    }
    emitDraftPreviewMetrics()
    return
  }
  if (draftPreviewEmitTimer !== null) return
  draftPreviewEmitTimer = window.setTimeout(() => {
    draftPreviewEmitTimer = null
    emitDraftPreviewMetrics()
  }, Math.max(1, delay - elapsed))
}

function refreshDraftPreview() {
  if (!map || !mapReady.value) return
  const source = map.getSource('game-network-preview')
  if (hasSetData(source)) source.setData(getDraftPreviewCollection(draftCursor))
  scheduleDraftPreviewMetrics()
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
    const buildings3DVisible = props.showBuildings2D5 !== false && resolvedGraphicsQuality() !== 'ECO'
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
    for (const layerId of ['game-network-vehicles-halo', 'game-network-vehicles']) {
      if (map.getLayer(layerId)) {
        map.setLayerZoomRange(layerId, detailZoom('VEHICLES'), 24)
        map.setLayoutProperty(layerId, 'visibility', props.showVehicleAnimations === false ? 'none' : 'visible')
      }
    }
    for (const layerId of ['game-station-crowds-halo', 'game-station-crowds-symbol']) {
      if (map.getLayer(layerId)) {
        map.setLayerZoomRange(layerId, detailZoom('CROWDS'), 24)
        map.setLayoutProperty(layerId, 'visibility', resolvedGraphicsQuality() === 'ECO' ? 'none' : 'visible')
      }
    }
    if (map.getLayer(building3DLayer)) map.setPaintProperty(building3DLayer, 'fill-extrusion-opacity', props.building ? .24 : .42)
  }
  catch {
    // Les préférences peuvent arriver pendant le chargement du style : le
    // prochain refresh / styledata les réappliquera.
  }
}

function refreshMunicipalityInsights() {
  if (!map || !mapReady.value || !map.getSource('territory-communes')) return
  const insights = props.municipalityInsights ?? []
  if (!insights.length && !previousProjectMunicipalityCodes.size) return

  const populations = insights.map(item => Math.max(1, item.population))
  const minLog = populations.length ? Math.log(Math.min(...populations)) : 0
  const maxLog = populations.length ? Math.log(Math.max(...populations)) : 1
  const spread = Math.max(0.0001, maxLog - minLog)
  const currentProjectCodes = new Set(props.projectMunicipalityCodes ?? [])
  const codes = new Set<string>([
    ...insights.map(item => item.code),
    ...previousProjectMunicipalityCodes,
    ...currentProjectCodes,
  ])

  for (const code of codes) {
    const insight = insights.find(item => item.code === code)
    const populationScore = insight
      ? Math.max(0, Math.min(1, (Math.log(Math.max(1, insight.population)) - minLog) / spread))
      : 0
    const accessibilityScore = insight ? Math.max(0, Math.min(1, insight.accessibility / 100)) : 0
    const growthScore = insight ? Math.max(0, Math.min(1, (insight.growthRate + 0.04) / 0.12)) : 0.5
    const potentialScore = insight ? Math.max(0, Math.min(1, insight.potential / 100)) : 0
    try {
      map.setFeatureState({ source: 'territory-communes', id: code }, {
        populationScore,
        accessibilityScore,
        growthScore,
        potentialScore,
        projectCovered: currentProjectCodes.has(code),
      })
    }
    catch {}
  }
  previousProjectMunicipalityCodes = currentProjectCodes
  refreshMunicipalityInsightStyle()
}

function getWorldSignalCollection(): GeoJsonCollection {
  const features: GeoJsonFeature[] = []
  for (const insight of props.municipalityInsights ?? []) {
    const longitude = Number(insight.centerLongitude)
    const latitude = Number(insight.centerLatitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    const hasEvent = Boolean(insight.localEventTitle && insight.localEventStatus !== 'FINISHED')
    const hasProject = Boolean(insight.urbanProjectTitle)
    if (hasEvent) {
      features.push({
        type: 'Feature',
        properties: {
          code: insight.code,
          nom: insight.name ?? '',
          kind: 'EVENT',
          symbol: insight.localEventStatus === 'ACTIVE' ? '!' : '•',
          color: insight.localEventStatus === 'ACTIVE' ? '#ffb65c' : '#dca85e',
          label: insight.localEventTitle ?? '',
          population: insight.population,
        },
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
      })
    }
    if (hasProject) {
      const offset = hasEvent ? 0.008 : 0
      features.push({
        type: 'Feature',
        properties: {
          code: insight.code,
          nom: insight.name ?? '',
          kind: 'PROJECT',
          symbol: '◇',
          color: '#6fd4dc',
          label: insight.urbanProjectTitle ?? '',
          population: insight.population,
        },
        geometry: { type: 'Point', coordinates: [longitude + offset, latitude] },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

function refreshWorldSignals() {
  if (!map || !mapReady.value) return
  const source = map.getSource('game-world-signals')
  if (hasSetData(source)) source.setData(getWorldSignalCollection())
}

function selectWorldSignal(code: string) {
  const insight = (props.municipalityInsights ?? []).find(item => item.code === code)
  if (!insight) return
  selectedCommune.value = {
    name: insight.name ?? 'Commune',
    code: insight.code,
    department: insight.departmentCode ?? '',
    population: insight.population,
    accessibility: insight.accessibility,
    growthRate: insight.growthRate,
    lineCount: insight.lineCount,
    stationCount: insight.stationCount,
    potential: insight.potential,
    urbanProjectTitle: insight.urbanProjectTitle,
    urbanProjectKind: insight.urbanProjectKind,
    urbanProjectOpeningDay: insight.urbanProjectOpeningDay,
    urbanProjectConstructionStartDay: insight.urbanProjectConstructionStartDay,
    urbanProjectMaturityDay: insight.urbanProjectMaturityDay,
    urbanProjectStatus: insight.urbanProjectStatus,
    localEventTitle: insight.localEventTitle,
    localEventKind: insight.localEventKind,
    localEventStartsDay: insight.localEventStartsDay,
    localEventVisitors: insight.localEventVisitors,
  }
}

function refreshMunicipalityInsightStyle() {
  if (!map || !mapReady.value || !map.getLayer('territory-communes-fill')) return
  const mode = props.insightMode ?? 'NONE'
  try {
    if (mode === 'POPULATION') {
      map.setPaintProperty('territory-communes-fill', 'fill-color', [
        'interpolate', ['linear'], ['coalesce', ['feature-state', 'populationScore'], 0],
        0, '#172129', .35, '#275a63', .7, '#3c9ca5', 1, '#72e5ea',
      ])
      map.setPaintProperty('territory-communes-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false], .62,
        ['interpolate', ['linear'], ['coalesce', ['feature-state', 'populationScore'], 0], 0, .13, 1, .48],
      ])
    }
    else if (mode === 'ACCESSIBILITY') {
      map.setPaintProperty('territory-communes-fill', 'fill-color', [
        'interpolate', ['linear'], ['coalesce', ['feature-state', 'accessibilityScore'], 0],
        0, '#8c4a51', .45, '#b6934a', .7, '#75a95e', 1, '#4ac889',
      ])
      map.setPaintProperty('territory-communes-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false], .62,
        ['interpolate', ['linear'], ['coalesce', ['feature-state', 'accessibilityScore'], 0], 0, .22, 1, .50],
      ])
    }
    else if (mode === 'GROWTH') {
      map.setPaintProperty('territory-communes-fill', 'fill-color', [
        'interpolate', ['linear'], ['coalesce', ['feature-state', 'growthScore'], .5],
        0, '#8d5260', .48, '#35434a', .62, '#477a62', 1, '#61ce8c',
      ])
      map.setPaintProperty('territory-communes-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false], .62,
        ['interpolate', ['linear'], ['abs', ['-', ['coalesce', ['feature-state', 'growthScore'], .5], .5]], 0, .12, .5, .50],
      ])
    }
    else if (mode === 'POTENTIAL') {
      map.setPaintProperty('territory-communes-fill', 'fill-color', [
        'interpolate', ['linear'], ['coalesce', ['feature-state', 'potentialScore'], 0],
        0, '#1f2a30', .35, '#55513c', .65, '#a8733e', 1, '#f3b65f',
      ])
      map.setPaintProperty('territory-communes-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false], .66,
        ['interpolate', ['linear'], ['coalesce', ['feature-state', 'potentialScore'], 0], 0, .10, 1, .56],
      ])
    }
    else {
      const definition = territoryDefinition()
      map.setPaintProperty('territory-communes-fill', 'fill-color', territoryDepartmentColorExpression())
      map.setPaintProperty('territory-communes-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false],
        definition.kind === 'GENERATED' ? .12 : .16,
        definition.kind === 'GENERATED' ? .018 : .055,
      ])
    }
  }
  catch {}
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

  return formatGameNumber(population)
}

type DeferredMapRefresh = 'LINE_STATION' | 'STATIONS' | 'OPERATIONS' | 'JOURNEY' | 'METRICS' | 'INTERCHANGES' | 'DEPOTS' | 'VEHICLES' | 'VISUAL'
const deferredMapRefreshes = new Set<DeferredMapRefresh>()
let deferredMapRefreshFrame: number | null = null

function scheduleMapRefresh(...kinds: DeferredMapRefresh[]) {
  for (const kind of kinds) deferredMapRefreshes.add(kind)
  if (deferredMapRefreshFrame !== null) return
  deferredMapRefreshFrame = window.requestAnimationFrame(() => {
    deferredMapRefreshFrame = null
    const pending = new Set(deferredMapRefreshes)
    deferredMapRefreshes.clear()
    if (pending.has('LINE_STATION')) refreshLineStationLayers()
    else if (pending.has('STATIONS')) refreshStationLayer()
    if (pending.has('OPERATIONS')) refreshOperationsLayer()
    if (pending.has('JOURNEY')) refreshJourneyLayers()
    if (pending.has('METRICS')) refreshPassengerMetricLayers()
    if (pending.has('INTERCHANGES')) refreshInterchangeLayers(!pending.has('LINE_STATION') && !pending.has('STATIONS'))
    if (pending.has('DEPOTS')) refreshDepotLayer()
    if (pending.has('VEHICLES')) refreshVehicleLayer()
    if (pending.has('VISUAL')) refreshVisualPreferences()
  })
}

function lineRevisionSignature() {
  return props.lines.map(line => `${line.id}:${line.updatedAt}:${line.status}:${line.color}:${line.mode}`).join('|')
}

function disruptionRevisionSignature() {
  return (props.operationsDisruptions ?? []).map(item => `${item.id}:${item.severity}:${item.resolvedAt ?? ''}:${item.endsAtAbsoluteMinute}`).join('|')
}

function substitutionRevisionSignature() {
  return (props.substitutionServices ?? []).map(item => `${item.id}:${item.endedAt ?? ''}:${item.endsAtAbsoluteMinute}:${item.buses}`).join('|')
}

function interchangeRevisionSignature() {
  return (props.interchanges ?? []).map(item => `${item.fromLineId}:${item.fromStationId}>${item.toLineId}:${item.toStationId}:${Math.round(item.distanceMeters)}`).join('|')
}

function depotRevisionSignature() {
  return (props.depots ?? []).map(item => `${item.id}:${item.updatedAt}:${item.capacity}`).join('|')
}

watch(
  lineRevisionSignature,
  () => scheduleMapRefresh('LINE_STATION', 'OPERATIONS', 'METRICS', 'INTERCHANGES', 'VISUAL'),
)

watch(
  () => props.lineReports,
  () => scheduleMapRefresh('LINE_STATION', 'METRICS'),
)

watch(
  () => props.insightMode,
  () => scheduleMapRefresh('LINE_STATION', 'METRICS', 'VISUAL'),
)

watch(
  [disruptionRevisionSignature, substitutionRevisionSignature],
  () => scheduleMapRefresh('OPERATIONS'),
)

watch(
  [() => props.activeLineId, () => props.selectedLineId],
  () => {
    scheduleMapRefresh('LINE_STATION')
    updateInterchangeMarkerVisibility()
  },
)

watch(
  () => (props.dimmedLineIds ?? []).join('|'),
  () => scheduleMapRefresh('LINE_STATION'),
)

watch(
  () => props.journeyHighlight?.key ?? '',
  () => scheduleMapRefresh('LINE_STATION', 'JOURNEY'),
)

watch(
  () => props.selectedStationId,
  () => scheduleMapRefresh('STATIONS'),
)

watch(
  [
    () => props.draftAnchor?.longitude ?? null,
    () => props.draftAnchor?.latitude ?? null,
    () => props.draftAnchor?.stationId ?? null,
    () => JSON.stringify(props.draftGuidePoints ?? []),
    () => props.routingMode,
  ],
  () => {
    scheduleMapRefresh('LINE_STATION')
    refreshDraftPreview()
    refreshRoutingCorridors()
    refreshProjectCatchment()
  },
)

watch(
  interchangeRevisionSignature,
  () => scheduleMapRefresh('INTERCHANGES', 'LINE_STATION'),
)

watch(
  depotRevisionSignature,
  () => scheduleMapRefresh('DEPOTS'),
)

watch(
  () => props.vehicles,
  () => scheduleMapRefresh('VEHICLES'),
)

watch(
  [() => props.graphicsQuality, () => props.showVehicleAnimations, () => props.showBuildings2D5],
  () => {
    lastStationRenderDensityKey = stationRenderDensityKey()
    scheduleMapRefresh('VISUAL', 'VEHICLES', 'STATIONS')
    updateInterchangeMarkerVisibility()
  },
)

watch(
  [() => props.municipalityInsights, () => props.projectMunicipalityCodes],
  () => {
    refreshMunicipalityInsights()
    refreshWorldSignals()
  },
)

watch(
  () => props.building,
  building => {
    if (!building) {
      draftCursor = null
      resetStaticStrictRailFeatureCache()
      staticRoutingRevision += 1
      for (const key of [...routingGraphCache.keys()]) if (key.startsWith('STATIC:')) routingGraphCache.delete(key)
    }
    updateCursor()
    refreshDraftPreview()
    refreshProjectCatchment()
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
      layout: { visibility: props.showBuildings2D5 === false || resolvedGraphicsQuality() === 'ECO' ? 'none' : 'visible' },
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
              minzoom: resolvedGraphicsQuality() === 'ECO' ? 12 : resolvedGraphicsQuality() === 'BALANCED' ? 10.5 : 9,
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
              layout: { visibility: props.showBuildings2D5 === false || resolvedGraphicsQuality() === 'ECO' ? 'none' : 'visible' },
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
              minzoom: resolvedGraphicsQuality() === 'ECO' ? 13.5 : resolvedGraphicsQuality() === 'BALANCED' ? 12 : 11,
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
        renderWorldCopies: false,
        fadeDuration: 0,
      })

    registerGameMapInstance(map)

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
          id: 'territory-project-coverage',
          type: 'fill',
          source: 'territory-communes',
          paint: {
            'fill-color': '#4fd3dc',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'projectCovered'], false], .13, 0],
          },
        })

        map.addLayer({
          id: 'territory-project-coverage-border',
          type: 'line',
          source: 'territory-communes',
          paint: {
            'line-color': '#7be7ed',
            'line-opacity': ['case', ['boolean', ['feature-state', 'projectCovered'], false], .72, 0],
            'line-width': ['case', ['boolean', ['feature-state', 'projectCovered'], false], 1.4, 0],
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
           SIGNAUX DU MONDE VIVANT
           ================================================ */

        map.addSource('game-world-signals', {
          type: 'geojson',
          data: getWorldSignalCollection(),
        })

        map.addLayer({
          id: 'game-world-signals-halo',
          type: 'circle',
          source: 'game-world-signals',
          minzoom: 6,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 10, 10, 14, 13],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['case', ['==', ['get', 'kind'], 'EVENT'], .24, .15],
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': 1.2,
            'circle-stroke-opacity': .72,
          },
        })

        map.addLayer({
          id: 'game-world-signals-symbol',
          type: 'symbol',
          source: 'game-world-signals',
          minzoom: 6,
          layout: {
            'text-field': ['get', 'symbol'],
            'text-font': ['Arial', 'Segoe UI'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 10, 13, 14, 15],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(6,12,16,.95)',
            'text-halo-width': 1.2,
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
            'line-width': shadowLineWidthExpression(),
            'line-offset': corridorOffsetExpression(),
            'line-opacity': [
              'case',
              ['==', ['get', 'journeyContext'], 1], .035,
              ['==', ['get', 'dimmed'], 1], .025,
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
            'line-width': focusLineWidthExpression(),
            'line-offset': corridorOffsetExpression(),
            'line-opacity': ['case', ['==', ['get', 'journeyContext'], 1], .012, ['==', ['get', 'dimmed'], 1], .02, .16],
            'line-blur': sharedCorridorExtra(.6, 3.2),
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
            'line-width': selectedLineWidthExpression(),
            'line-offset': corridorOffsetExpression(),
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
            'line-width': stableCoreLineWidthExpression(),
            'line-offset': corridorOffsetExpression(),
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
            'line-width': workLineWidthExpression(),
            'line-offset': corridorOffsetExpression(),
            'line-opacity': [
              'case',
              ['==', ['get', 'journeyContext'], 1], .045,
              ['==', ['get', 'dimmed'], 1], .04,
              ['all', ['==', ['get', 'focusContext'], 1], ['!=', ['get', 'focused'], 1]], .16,
              .62,
            ],
            'line-dasharray': [2, 2],
          },
        })

        // Itinéraire actif : le réseau complet reste en contexte très léger,
        // tandis que seuls les tronçons réellement empruntés sont redessinés ici.
        map.addSource('game-journey-lines', { type: 'geojson', data: getJourneyLineCollection() })
        map.addLayer({
          id: 'game-journey-lines-casing',
          type: 'line',
          source: 'game-journey-lines',
          filter: ['==', ['get', 'kind'], 'RIDE'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#071014',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 7, 10, 10.5, 15, 16],
            'line-opacity': .88,
          },
        })
        map.addLayer({
          id: 'game-journey-lines',
          type: 'line',
          source: 'game-journey-lines',
          filter: ['==', ['get', 'kind'], 'RIDE'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4.2, 10, 7, 15, 11.5],
            'line-opacity': .98,
          },
        })
        map.addLayer({
          id: 'game-journey-walks',
          type: 'line',
          source: 'game-journey-lines',
          filter: ['==', ['get', 'kind'], 'WALK'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#eafcff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.4, 12, 3.5, 16, 4.5],
            'line-opacity': .92,
            'line-dasharray': [1.2, 1.2],
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
            'line-offset': corridorOffsetExpression(),
            'line-opacity': .001,
          },
        })

        // Phase 20 : flux réellement routés par Voyageurs 2.0, tronçon par tronçon.
        map.addSource('game-passenger-flows', { type: 'geojson', data: getPassengerFlowCollection() })
        map.addLayer({
          id: 'game-passenger-flows',
          type: 'line',
          source: 'game-passenger-flows',
          minzoom: 5.4,
          layout: { 'line-cap': 'round', 'line-join': 'round', visibility: props.insightMode === 'FLOW' ? 'visible' : 'none' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['get', 'flowScore'], 0, 1.2, .35, 3.2, .7, 6.2, 1, 9.5],
            'line-opacity': ['interpolate', ['linear'], ['get', 'flowScore'], 0, .18, 1, .86],
            'line-blur': ['interpolate', ['linear'], ['get', 'flowScore'], 0, .2, 1, 1.1],
          },
        })

        map.addSource('game-operations-overlay', { type: 'geojson', data: getOperationsOverlayCollection() })
        map.addLayer({
          id: 'game-operations-disruptions',
          type: 'line',
          source: 'game-operations-overlay',
          filter: ['==', ['get', 'kind'], 'DISRUPTION'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['case', ['==', ['get', 'severity'], 'CRITICAL'], '#ff555f', ['==', ['get', 'severity'], 'MAJOR'], '#ff765e', '#f0b657'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 7, 16, 10],
            'line-opacity': .92,
            'line-dasharray': [1.1, 1.1],
          },
        })
        map.addLayer({
          id: 'game-operations-substitutions',
          type: 'line',
          source: 'game-operations-overlay',
          filter: ['==', ['get', 'kind'], 'SUBSTITUTION'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#59dce6', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 12, 5.5, 16, 8], 'line-opacity': .9, 'line-dasharray': [2, 1.4] },
        })
        map.addLayer({
          id: 'game-operations-disruption-stations',
          type: 'circle',
          source: 'game-operations-overlay',
          filter: ['==', ['get', 'kind'], 'DISRUPTION_STATION'],
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 13, 11], 'circle-color': '#ff665f', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': .9 },
        })

        map.addSource(
          'game-network-stations',
          {
            type: 'geojson',
            data: getStationCollection(),
          },
        )

        // Phase 20 : foule agrégée. Une représentation visuelle symbolise des
        // centaines/milliers de voyageurs ; aucun humain individuel n'est simulé.
        map.addSource('game-station-crowds', { type: 'geojson', data: getStationCrowdCollection() })
        map.addLayer({
          id: 'game-station-crowds-halo',
          type: 'circle',
          source: 'game-station-crowds',
          minzoom: detailZoom('CROWDS'),
          layout: { visibility: resolvedGraphicsQuality() === 'ECO' ? 'none' : 'visible' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'crowdScore'], 0, 5, 1, 18],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['interpolate', ['linear'], ['get', 'crowdScore'], 0, .05, 1, .18],
            'circle-blur': .4,
          },
        })
        map.addLayer({
          id: 'game-station-crowds-symbol',
          type: 'symbol',
          source: 'game-station-crowds',
          minzoom: detailZoom('CROWDS'),
          layout: {
            visibility: resolvedGraphicsQuality() === 'ECO' ? 'none' : 'visible',
            'text-field': ['step', ['get', 'crowdLevel'], '', 1, '•', 2, '••', 3, '•••', 4, '••••'],
            'text-font': ['Arial', 'Segoe UI'],
            'text-size': ['interpolate', ['linear'], ['get', 'crowdScore'], 0, 9, 1, 13],
            'text-offset': [0, 1.25],
            'text-anchor': 'top',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#071014', 'text-halo-width': 1.2, 'text-opacity': .88 },
        })

        // V36 : le contour blanc et le cœur coloré sont deux couches distinctes.
        // Cette approche est volontairement plus robuste que circle-stroke : le
        // halo reste visible même lorsqu'un tracé épais passe exactement sous l'arrêt.
        map.addLayer({
          id: 'game-network-station-halo',
          type: 'circle',
          source: 'game-network-stations',
          minzoom: 4.3,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              5, ['+', ['*', ['get', 'stationRadius'], .62], 1.4],
              11, ['+', ['*', ['get', 'stationRadius'], .86], 1.7],
              15, ['+', ['*', ['get', 'stationRadius'], 1.05], 2.1],
            ],
            'circle-color': '#ffffff',
            'circle-opacity': [
              'case',
              ['==', ['get', 'journeyContext'], 1], .16,
              ['==', ['get', 'focusContext'], 1], ['case', ['==', ['get', 'focused'], 1], .96, .46],
              .92,
            ],
          },
        })
        map.addLayer({
          id: 'game-network-station-core',
          type: 'circle',
          source: 'game-network-stations',
          minzoom: 4.3,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              5, ['*', ['get', 'stationRadius'], .62],
              11, ['*', ['get', 'stationRadius'], .86],
              15, ['*', ['get', 'stationRadius'], 1.05],
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': [
              'case',
              ['==', ['get', 'journeyContext'], 1], .18,
              ['==', ['get', 'focusContext'], 1], ['case', ['==', ['get', 'focused'], 1], 1, .48],
              1,
            ],
            'circle-stroke-color': ['case', ['==', ['get', 'selectedStation'], 1], '#071014', 'rgba(7,16,20,.72)'],
            'circle-stroke-width': ['case', ['==', ['get', 'selectedStation'], 1], 2.4, ['>=', ['get', 'hubScore'], 68], 1.6, .8],
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
            'all',
            ['==', ['get', 'journeyContext'], 0],
            ['==', ['get', 'interchange'], 0],
            [
              'any',
              ['==', ['get', 'focused'], 1],
              ['==', ['get', 'selectedStation'], 1],
              ['==', ['get', 'draftAnchor'], 1],
            ],
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

        map.addSource('game-journey-points', { type: 'geojson', data: getJourneyPointCollection() })
        map.addLayer({
          id: 'game-journey-points-halo',
          type: 'circle',
          source: 'game-journey-points',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6.5, 11, 9.5, 15, 12],
            'circle-color': '#ffffff',
            'circle-opacity': .98,
            'circle-stroke-color': '#071014',
            'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'TRANSFER'], 2.4, 3.2],
          },
        })
        map.addLayer({
          id: 'game-journey-points-core',
          type: 'circle',
          source: 'game-journey-points',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2.8, 11, 4, 15, 5.2],
            'circle-color': ['case', ['==', ['get', 'kind'], 'ORIGIN'], '#69e0e7', ['==', ['get', 'kind'], 'DESTINATION'], '#f2c95d', '#ffffff'],
            'circle-opacity': 1,
          },
        })
        map.addLayer({
          id: 'game-journey-transfer-line-labels',
          type: 'symbol',
          source: 'game-journey-points',
          minzoom: 7.6,
          filter: ['all', ['==', ['get', 'kind'], 'TRANSFER'], ['!=', ['get', 'lineLabel'], '']],
          layout: {
            'text-field': ['get', 'lineLabel'],
            'text-font': ['Arial', 'Segoe UI'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 14],
            'text-offset': [0, -1.35],
            'text-anchor': 'bottom',
            'text-padding': 2,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': ['get', 'lineColor'],
            'text-halo-color': 'rgba(5,10,14,.98)',
            'text-halo-width': 3.2,
            'text-halo-blur': .35,
            'text-opacity': 1,
          },
        })
        map.addLayer({
          id: 'game-journey-point-labels',
          type: 'symbol',
          source: 'game-journey-points',
          minzoom: 8.8,
          filter: ['!=', ['get', 'kind'], 'TRANSFER'],
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Arial', 'Segoe UI'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 12, 16, 13],
            'text-offset': [0, 1.45],
            'text-anchor': 'top',
            'text-padding': 5,
            'text-optional': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(5,10,14,.96)',
            'text-halo-width': 1.8,
            'text-opacity': .96,
          },
        })

        map.addSource('game-project-catchment', { type: 'geojson', data: getProjectCatchmentCollection() })
        map.addLayer({
          id: 'game-project-catchment',
          type: 'fill',
          source: 'game-project-catchment',
          paint: {
            'fill-color': '#4fd3dc',
            'fill-opacity': .055,
            'fill-outline-color': 'rgba(79,211,220,.22)',
          },
        }, 'game-network-lines')

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
            'line-color': ['case', ['==', ['get', 'waterValid'], 0], '#ff6b6b', '#9ff5ff'],
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
            'circle-stroke-color': ['case', ['==', ['get', 'waterValid'], 0], '#ff6b6b', '#9ff5ff'],
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
            'circle-color': ['case', ['==', ['get', 'waterValid'], 0], '#ff6b6b', '#9ff5ff'],
            'circle-stroke-color': '#071014',
            'circle-stroke-width': 2.5,
            'circle-opacity': .92,
          },
        })

        map.addSource('game-network-depots', { type: 'geojson', data: getDepotCollection() })
        map.addLayer({
          id: 'game-network-depots-halo',
          type: 'circle',
          source: 'game-network-depots',
          minzoom: 6,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 8],
            'circle-color': '#071014',
            'circle-opacity': .88,
          },
        })
        map.addLayer({
          id: 'game-network-depots',
          type: 'circle',
          source: 'game-network-depots',
          minzoom: 6,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3.4, 12, 5.6],
            'circle-color': ['get', 'accent'],
            'circle-stroke-color': '#f5fbfc',
            'circle-stroke-width': 1.2,
          },
        })
        map.addLayer({
          id: 'game-network-depot-labels',
          type: 'symbol',
          source: 'game-network-depots',
          minzoom: 10,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.25],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#eaf7f8',
            'text-halo-color': '#071014',
            'text-halo-width': 1.4,
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

        lastStationRenderDensityKey = stationRenderDensityKey()
        map.on('zoom', () => {
          updateStationMarkerVisibility()
          const densityKey = stationRenderDensityKey()
          if (densityKey !== lastStationRenderDensityKey) {
            lastStationRenderDensityKey = densityKey
            scheduleMapRefresh('STATIONS')
          }
        })
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
          if (!lineId || !stationId) return
          const sourceLine = props.lines.find(item => item.id === String(lineId))
          const station = sourceLine ? findLineStation(sourceLine, String(stationId)) : null
          if (station && strictRailAutoContext().strict && !snapStrictRailPoint(station.longitude, station.latitude, STRICT_EXISTING_STATION_SNAP_METERS)) { rejectInvalidRailAutoPlacement('SNAP'); return }
          const routeCoordinates = station && props.draftAnchor
            ? buildDraftPreviewCoordinates({ longitude: station.longitude, latitude: station.latitude })
            : undefined
          if (strictRailAutoContext().strict && props.draftAnchor && (!routeCoordinates || routeCoordinates.length < 2)) { rejectInvalidRailAutoPlacement('PATH'); return }
          if (
            props.building
            && activeDraftLine()?.mode === 'FERRY'
            && station
            && !ferryPlacementIsValid(station.longitude, station.latitude, routeCoordinates)
          ) {
            rejectInvalidFerryPlacement()
            return
          }
          emit('stationClick', String(lineId), String(stationId), routeCoordinates?.length >= 2 ? routeCoordinates : undefined)
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
        map.on('zoom', () => updateInterchangeMarkerVisibility())
        map.on('zoomend', scheduleInterchangeMarkerRebuild)
        map.on('moveend', () => {
          const refreshKinds: DeferredMapRefresh[] = ['LINE_STATION', 'OPERATIONS', 'INTERCHANGES', 'DEPOTS', 'VEHICLES']
          if (props.insightMode === 'FLOW' || (resolvedGraphicsQuality() !== 'ECO' && (map?.getZoom() ?? 0) >= detailZoom('CROWDS') - .35)) refreshKinds.push('METRICS')
          scheduleMapRefresh(...refreshKinds)
          if (!localTerritoryRuntime() && props.building) {
            staticRoutingRevision += 1
            for (const key of [...routingGraphCache.keys()]) if (key.startsWith('STATIC:')) routingGraphCache.delete(key)
            // Le graphe de routage statique est reconstruit au prochain mouvement
            // du curseur, pas immédiatement à la fin de chaque pan/zoom.
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

            const communeCode = String(properties?.code ?? '')
            const liveInsight = (props.municipalityInsights ?? []).find(item => item.code === communeCode)
            selectedCommune.value = {
              name: String(properties?.nom ?? 'Commune'),
              code: communeCode,
              department: String(properties?.codeDepartement ?? ''),
              population: liveInsight?.population ?? (Number.isFinite(rawPopulation) ? rawPopulation : null),
              accessibility: liveInsight?.accessibility ?? null,
              growthRate: liveInsight?.growthRate ?? null,
              lineCount: liveInsight?.lineCount ?? 0,
              stationCount: liveInsight?.stationCount ?? 0,
              potential: liveInsight?.potential ?? null,
              urbanProjectTitle: liveInsight?.urbanProjectTitle,
              urbanProjectKind: liveInsight?.urbanProjectKind,
              urbanProjectOpeningDay: liveInsight?.urbanProjectOpeningDay,
              urbanProjectConstructionStartDay: liveInsight?.urbanProjectConstructionStartDay,
              urbanProjectMaturityDay: liveInsight?.urbanProjectMaturityDay,
              urbanProjectStatus: liveInsight?.urbanProjectStatus,
              localEventTitle: liveInsight?.localEventTitle,
              localEventKind: liveInsight?.localEventKind,
              localEventStartsDay: liveInsight?.localEventStartsDay,
              localEventVisitors: liveInsight?.localEventVisitors,
            }
          },
        )

        map.on('mouseenter', 'game-world-signals-symbol', () => {
          if (map) map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'game-world-signals-symbol', () => {
          if (map && !props.building) map.getCanvas().style.cursor = ''
        })
        map.on('click', 'game-world-signals-symbol', event => {
          const code = String(event.features?.[0]?.properties?.code ?? '')
          if (code) selectWorldSignal(code)
        })
        map.on('click', 'game-world-signals-halo', event => {
          const code = String(event.features?.[0]?.properties?.code ?? '')
          if (code) selectWorldSignal(code)
        })

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

            const strictRail = strictRailAutoContext().strict
            const snapped = snapStrictRailPoint(event.lngLat.lng, event.lngLat.lat)
            if (strictRail && !snapped) { rejectInvalidRailAutoPlacement('SNAP'); return }
            const targetLongitude = snapped?.[0] ?? event.lngLat.lng
            const targetLatitude = snapped?.[1] ?? event.lngLat.lat
            if (props.draftAnchor) {
              draftPreviewCoordinates = buildDraftPreviewCoordinates({ longitude: targetLongitude, latitude: targetLatitude })
            }
            else {
              draftPreviewCoordinates = []
            }
            const routeCoordinates = draftPreviewCoordinates.length >= 2 ? [...draftPreviewCoordinates] : undefined
            // Rail auto est désormais strict : sans chemin ferré connecté, on ne
            // transforme jamais silencieusement le clic en segment libre.
            if (strictRail && props.draftAnchor && !routeCoordinates) { rejectInvalidRailAutoPlacement('PATH'); return }
            if (
              activeDraftLine()?.mode === 'FERRY'
              && !ferryPlacementIsValid(targetLongitude, targetLatitude, routeCoordinates)
            ) {
              rejectInvalidFerryPlacement()
              return
            }
            emit(
              'mapClick',
              targetLongitude,
              targetLatitude,
              routeCoordinates,
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
                refreshInterchangeLayers(false)
                refreshVehicleLayer()
                refreshDraftPreview()
                refreshVisualPreferences()
                refreshMunicipalityInsights()
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
  if (deferredMapRefreshFrame !== null) { window.cancelAnimationFrame(deferredMapRefreshFrame); deferredMapRefreshFrame = null }
  if (interchangeMarkerFrame !== null) { window.cancelAnimationFrame(interchangeMarkerFrame); interchangeMarkerFrame = null }
  if (draftPreviewEmitTimer !== null) { window.clearTimeout(draftPreviewEmitTimer); draftPreviewEmitTimer = null }
  clearStationMarkers()
  clearInterchangeMarkers()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (map) {
    registerGameMapInstance(null)
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
  <div class="map-shell" :class="{ 'journey-map-active': Boolean(props.journeyHighlight) }">
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

          <div v-if="selectedCommune.accessibility !== null && selectedCommune.accessibility !== undefined">
            <span>Accessibilité TC</span>
            <strong>{{ Math.round(selectedCommune.accessibility) }}/100</strong>
          </div>

          <div v-if="selectedCommune.growthRate !== null && selectedCommune.growthRate !== undefined">
            <span>Évolution</span>
            <strong>{{ selectedCommune.growthRate >= 0 ? '+' : '' }}{{ (selectedCommune.growthRate * 100).toFixed(1) }} %</strong>
          </div>

          <div v-if="selectedCommune.potential !== null && selectedCommune.potential !== undefined">
            <span>{{ translateGameText('Besoin de desserte', currentGameLocale()) }}</span>
            <strong>{{ selectedCommune.potential >= 72 ? translateGameText('Fort', currentGameLocale()) : selectedCommune.potential >= 45 ? translateGameText('Moyen', currentGameLocale()) : translateGameText('Faible', currentGameLocale()) }}</strong>
          </div>

          <div>
            <span>{{ translateGameText('Réseau', currentGameLocale()) }}</span>
            <strong>{{ selectedCommune.lineCount ?? 0 }} {{ translateGameText('ligne(s)', currentGameLocale()) }} · {{ selectedCommune.stationCount ?? 0 }} {{ translateGameText('station(s)', currentGameLocale()) }}</strong>
          </div>

          <div v-if="selectedCommune.urbanProjectTitle" class="commune-live-item">
            <span>{{ translateGameText('Projet urbain', currentGameLocale()) }}</span>
            <strong>{{ translateGameText(selectedCommune.urbanProjectKind === 'RESIDENTIAL_DISTRICT' ? 'Nouveau quartier' : selectedCommune.urbanProjectKind === 'BUSINESS_DISTRICT' ? 'Nouveau pôle d’emplois' : selectedCommune.urbanProjectKind === 'CAMPUS' ? 'Nouveau campus' : selectedCommune.urbanProjectKind === 'LEISURE_HUB' ? 'Nouveau pôle de loisirs' : selectedCommune.urbanProjectTitle, currentGameLocale()) }} · {{ selectedCommune.name }}</strong>
            <small v-if="selectedCommune.urbanProjectStatus === 'PLANNED' && selectedCommune.urbanProjectConstructionStartDay">Chantier · Jour {{ selectedCommune.urbanProjectConstructionStartDay }} · Ouverture J{{ selectedCommune.urbanProjectOpeningDay }}</small>
            <small v-else-if="selectedCommune.urbanProjectStatus === 'CONSTRUCTION'">En chantier · Ouverture J{{ selectedCommune.urbanProjectOpeningDay }}</small>
            <small v-else-if="selectedCommune.urbanProjectStatus === 'OPENED' && selectedCommune.urbanProjectMaturityDay">Ouvert · montée en puissance jusqu’au jour {{ selectedCommune.urbanProjectMaturityDay }}</small>
            <small v-else-if="selectedCommune.urbanProjectOpeningDay">{{ translateGameText('Ouverture', currentGameLocale()) }} · Jour {{ selectedCommune.urbanProjectOpeningDay }}</small>
          </div>

          <div v-if="selectedCommune.localEventTitle" class="commune-live-item commune-live-item--event">
            <span>{{ translateGameText('Événement', currentGameLocale()) }}</span>
            <strong>{{ translateGameText(selectedCommune.localEventKind === 'CONCERT' ? 'Grand concert' : selectedCommune.localEventKind === 'FOOTBALL' ? 'Match à forte affluence' : selectedCommune.localEventKind === 'FESTIVAL' ? 'Festival' : selectedCommune.localEventKind === 'EXHIBITION' ? 'Salon majeur' : selectedCommune.localEventTitle, currentGameLocale()) }} · {{ selectedCommune.name }}</strong>
            <small>{{ selectedCommune.localEventVisitors ? formatPopulation(selectedCommune.localEventVisitors) + ' ' + translateGameText('visiteurs attendus', currentGameLocale()) : '' }}<template v-if="selectedCommune.localEventStartsDay"> · Jour {{ selectedCommune.localEventStartsDay }}</template></small>
          </div>

          <button class="commune-build-action" type="button" @click="emit('municipalityBuild', selectedCommune.code)">＋ {{ translateGameText('Desservir ce secteur', currentGameLocale()) }}</button>
        </div>
      </section>
    </Transition>

    <div v-if="insightMode && insightMode !== 'NONE'" class="map-insight-legend">
      <strong>{{ translateGameText(insightMode === 'POPULATION' ? 'Population' : insightMode === 'ACCESSIBILITY' ? 'Accessibilité TC' : insightMode === 'GROWTH' ? 'Croissance' : insightMode === 'FLOW' ? 'Flux voyageurs' : insightMode === 'SATURATION' ? 'Saturation réseau' : 'Besoin de desserte', currentGameLocale()) }}</strong>
      <span>{{ translateGameText(insightMode === 'POPULATION' ? 'Clair = bassin plus peuplé' : insightMode === 'ACCESSIBILITY' ? 'Rouge = peu desservi · vert = bien relié' : insightMode === 'GROWTH' ? 'Vert = progression · rouge = recul' : insightMode === 'FLOW' ? 'Épaisseur et taille = volume réellement routé par Voyageurs 2.0' : insightMode === 'SATURATION' ? 'Vert = fluide · orange = chargé · rouge = capacité dépassée' : 'Plus la zone est vive, plus le potentiel de nouvelle desserte est important', currentGameLocale()) }}</span>
    </div>

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

.map-insight-legend {
  position: absolute;
  left: 18px;
  bottom: 84px;
  z-index: 8;
  max-width: min(310px, calc(100vw - 100px));
  padding: 8px 10px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  background: rgba(7,13,18,.88);
  box-shadow: 0 8px 24px rgba(0,0,0,.24);
  backdrop-filter: blur(10px);
  display: grid;
  gap: 2px;
  pointer-events: none;
}
.map-insight-legend strong { font-size: 11px; color: #dff9fa; }
.map-insight-legend span { font-size: 9px; opacity: .62; }
@media (max-width: 760px) {
  .map-insight-legend { left: 10px; bottom: 142px; max-width: calc(100vw - 90px); }
}

/* Phase 12 : la légende territoriale ne se place plus derrière recherche/horloge. */
.map-insight-legend{left:auto!important;right:12px!important;top:86px!important;bottom:auto!important;max-width:min(320px,calc(100vw - 24px))!important;z-index:24!important;padding:9px 11px!important}
@media(max-width:760px){.map-insight-legend{top:76px!important;right:8px!important;left:8px!important;max-width:none!important}}

.commune-build-action{width:100%;margin-top:4px;padding:9px 10px;border:1px solid rgba(79,211,220,.28);border-radius:10px;background:rgba(79,211,220,.11);color:#d8fbfd;font-weight:850;cursor:pointer;text-align:center}.commune-build-action:hover{background:rgba(79,211,220,.17)}

.commune-live-item{grid-column:1/-1!important;padding:9px 10px!important;border:1px solid rgba(85,205,135,.18)!important;border-radius:10px!important;background:rgba(85,205,135,.06)!important;display:grid!important;gap:2px!important}.commune-live-item--event{border-color:rgba(229,170,85,.25)!important;background:rgba(229,170,85,.07)!important}.commune-live-item small{font-size:9px;opacity:.55}.commune-live-item strong{white-space:normal!important;line-height:1.25!important}


/* Mode itinéraire : les badges du réseau complet passent au second plan ; les
   points de départ/arrivée du trajet sont rendus par les couches dédiées. */
.journey-map-active :deep(.clu-terminus-marker),
.journey-map-active :deep(.clu-interchange-marker){opacity:.12!important;filter:saturate(.35);transition:opacity .15s ease}

</style>
