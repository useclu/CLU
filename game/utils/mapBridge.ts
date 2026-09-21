import type { GameLine } from '../types/network'
import type { GameMunicipalityBounds } from '../types/territory'
import { getLineAllStations, getLineTerminusStations } from '../engine/network/geometry'

let mapInstance: any = null
let installPromise: Promise<void> | null = null
let pendingBounds: GameMunicipalityBounds | null = null
let pendingOverlay: { lines: GameLine[]; selectedLineId: string | null; activeLineId: string | null; editingLineId: string | null } | null = null
let terminusMarkers: any[] = []
let terminusMarkerSignature = ''

const SOURCE_ID = 'clu-polished-network'
const CASING_LAYER_ID = 'clu-polished-network-casing'
const LINE_LAYER_ID = 'clu-polished-network-lines'
const WORK_LAYER_ID = 'clu-polished-network-work'

function cloneLines(lines: GameLine[]) {
  return JSON.parse(JSON.stringify(lines)) as GameLine[]
}

/**
 * V29 : le rendu du réseau appartient directement à GameMap. Ce pont ne
 * dessine plus une seconde copie des lignes ; il conserve uniquement les
 * fonctions de focus et les badges de terminus HTML.
 */

function mapReady() {
  try { return Boolean(mapInstance?.getStyle?.()) }
  catch { return false }
}

function focusPendingBounds() {
  if (!mapInstance || !pendingBounds || !mapReady()) return
  const bounds = pendingBounds
  pendingBounds = null
  mapInstance.fitBounds(
    [[bounds.west, bounds.south], [bounds.east, bounds.north]],
    { padding: { top: 115, right: 80, bottom: 80, left: 120 }, maxZoom: 13.5, duration: 900 },
  )
}

function clearTerminusMarkers(resetSignature = true) {
  for (const marker of terminusMarkers) {
    try { marker.remove() } catch {}
  }
  terminusMarkers = []
  if (resetSignature) terminusMarkerSignature = ''
}

async function rebuildTerminusMarkers(lines: GameLine[]) {
  if (!mapInstance || !mapReady() || typeof window === 'undefined') return
  const maplibre: any = await import('maplibre-gl')
  const focusLineId = pendingOverlay?.activeLineId ?? pendingOverlay?.editingLineId ?? pendingOverlay?.selectedLineId ?? null
  const signature = JSON.stringify({
    focusLineId,
    lines: lines.map(line => [
      line.id,
      line.name,
      line.shortCode,
      line.color,
      line.emblem,
      line.customLogoDataUrl?.length ?? 0,
      getLineTerminusStations(line).map(station => [station.id, station.name, station.longitude, station.latitude]),
    ]),
  })
  if (signature === terminusMarkerSignature) return
  terminusMarkerSignature = signature
  clearTerminusMarkers(false)

  for (const line of lines) {
    if (line.stations.length < 2) continue
    const endpoints = getLineTerminusStations(line)
    for (const station of endpoints) {
      const element = document.createElement('div')
      element.className = 'clu-terminus-marker'
      element.title = `${line.name} · terminus ${station!.name}`
      const focused = !focusLineId || focusLineId === line.id
      const size = focusLineId === line.id ? 31 : 27
      element.style.cssText = `width:${size}px;height:${size}px;border-radius:10px;border:2px solid rgba(255,255,255,.92);box-shadow:0 4px 13px rgba(0,0,0,.5);display:grid;place-items:center;overflow:hidden;transform:translateY(-5px);font:800 11px/1 Inter,system-ui,sans-serif;color:#081014;pointer-events:auto;opacity:${focused ? 1 : .38};transition:opacity .15s ease,transform .15s ease;`
      element.style.background = line.color
      element.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation()
        window.dispatchEvent(new CustomEvent('clu-map-station-select', { detail: { lineId: line.id, stationId: station!.id } }))
      })

      if (line.customLogoDataUrl) {
        const image = document.createElement('img')
        image.src = line.customLogoDataUrl
        image.alt = line.shortCode
        image.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.9);'
        element.appendChild(image)
      }
      else {
        const text = document.createElement('span')
        text.textContent = line.shortCode
        element.appendChild(text)
      }

      const marker = new maplibre.Marker({ element, anchor: 'bottom' })
        .setLngLat([station!.longitude, station!.latitude])
        .addTo(mapInstance)
      terminusMarkers.push(marker)
    }
  }
}

function applyOverlay() {
  if (!mapInstance || !pendingOverlay || !mapReady()) return
  const { lines } = pendingOverlay

  // Nettoyage défensif d'anciennes couches V28 lors d'un hot reload. En V29,
  // GameMap est l'unique renderer des lignes afin d'éviter double épaisseur,
  // double calcul GeoJSON et conflits de sélection.
  try {
    if (mapInstance.getLayer?.(WORK_LAYER_ID)) mapInstance.removeLayer(WORK_LAYER_ID)
    if (mapInstance.getLayer?.(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID)
    if (mapInstance.getLayer?.(CASING_LAYER_ID)) mapInstance.removeLayer(CASING_LAYER_ID)
    if (mapInstance.getSource?.(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID)
  }
  catch {}

  void rebuildTerminusMarkers(lines)
}


function captureMap(map: any) {
  if (!map || mapInstance === map) return
  mapInstance = map
  const refresh = () => {
    focusPendingBounds()
    applyOverlay()
  }
  try {
    map.on('load', refresh)
    map.on('styledata', () => setTimeout(refresh, 0))
  }
  catch {}
  setTimeout(refresh, 0)
}

export function installGameMapBridge() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (installPromise) return installPromise
  installPromise = (async () => {
    try {
      const maplibre: any = await import('maplibre-gl')
      const proto = maplibre.Map?.prototype as any
      if (!proto || proto.__cluBridgePatched) return
      proto.__cluBridgePatched = true
      const methodNames = ['_setupContainer', 'resize', 'setStyle', 'jumpTo']
      for (const methodName of methodNames) {
        const original = proto[methodName]
        if (typeof original !== 'function' || original.__cluWrapped) continue
        const wrapped = function(this: any, ...args: any[]) {
          captureMap(this)
          return original.apply(this, args)
        }
        wrapped.__cluWrapped = true
        proto[methodName] = wrapped
      }
    }
    catch (error) {
      console.warn('[CLU] Pont cartographique indisponible', error)
    }
  })()
  return installPromise
}

export function focusGameMapBounds(bounds: GameMunicipalityBounds) {
  pendingBounds = { ...bounds }
  focusPendingBounds()
}


export function focusGameMapPoint(longitude: number, latitude: number, zoom = 13.5) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
  try {
    mapInstance?.easeTo?.({ center: [longitude, latitude], zoom, duration: 700 })
  }
  catch {}
}

export function focusGameMapLine(line: GameLine) {
  const allStations = getLineAllStations(line)
  if (!allStations.length) return
  const longitudes = allStations.map(station => station.longitude)
  const latitudes = allStations.map(station => station.latitude)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const epsilon = 0.01
  focusGameMapBounds({
    west: west === east ? west - epsilon : west,
    east: west === east ? east + epsilon : east,
    south: south === north ? south - epsilon : south,
    north: south === north ? north + epsilon : north,
  })
}

export function syncGameMapOverlay(
  lines: GameLine[],
  options: { selectedLineId?: string | null; activeLineId?: string | null; editingLineId?: string | null } = {},
) {
  pendingOverlay = {
    lines: cloneLines(lines),
    selectedLineId: options.selectedLineId ?? null,
    activeLineId: options.activeLineId ?? null,
    editingLineId: options.editingLineId ?? null,
  }
  applyOverlay()
}

export function clearGameMapOverlay() {
  clearTerminusMarkers()
  pendingOverlay = null
  try {
    if (mapInstance?.getLayer?.(WORK_LAYER_ID)) mapInstance.removeLayer(WORK_LAYER_ID)
    if (mapInstance?.getLayer?.(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID)
    if (mapInstance?.getLayer?.(CASING_LAYER_ID)) mapInstance.removeLayer(CASING_LAYER_ID)
    if (mapInstance?.getSource?.(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID)
  }
  catch {}
  mapInstance = null
}
