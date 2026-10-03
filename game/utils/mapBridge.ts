import type { GameLine } from '../types/network'
import type { GameMunicipalityBounds } from '../types/territory'
import { getLineAllStations, getLineTerminusStations } from '../engine/network/geometry'

let mapInstance: any = null
interface GameMapFocusOptions {
  padding?: number | { top: number; right: number; bottom: number; left: number }
  maxZoom?: number
  duration?: number
}

let pendingBounds: { bounds: GameMunicipalityBounds; options?: GameMapFocusOptions } | null = null
let pendingOverlay: { lines: GameLine[]; selectedLineId: string | null; activeLineId: string | null; editingLineId: string | null; dimmedLineIds: string[] } | null = null
let terminusMarkers: Array<{ marker: any; element: HTMLElement; lineId: string }> = []
let terminusMarkerSignature = ''

const SOURCE_ID = 'clu-polished-network'
const CASING_LAYER_ID = 'clu-polished-network-casing'
const LINE_LAYER_ID = 'clu-polished-network-lines'
const WORK_LAYER_ID = 'clu-polished-network-work'

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
  const pending = pendingBounds
  pendingBounds = null
  const bounds = pending.bounds
  mapInstance.fitBounds(
    [[bounds.west, bounds.south], [bounds.east, bounds.north]],
    {
      padding: pending.options?.padding ?? { top: 115, right: 80, bottom: 80, left: 120 },
      maxZoom: pending.options?.maxZoom ?? 13.5,
      duration: pending.options?.duration ?? 900,
    },
  )
}

function clearTerminusMarkers(resetSignature = true) {
  for (const item of terminusMarkers) {
    try { item.marker.remove() } catch {}
  }
  terminusMarkers = []
  if (resetSignature) terminusMarkerSignature = ''
}

function updateTerminusMarkerFocus() {
  const focusLineId = pendingOverlay?.activeLineId ?? pendingOverlay?.editingLineId ?? pendingOverlay?.selectedLineId ?? null
  const dimmed = new Set(pendingOverlay?.dimmedLineIds ?? [])
  for (const item of terminusMarkers) {
    const focused = !focusLineId || focusLineId === item.lineId
    item.element.style.opacity = dimmed.has(item.lineId) ? '.14' : focused ? '1' : '.38'
    // Important : MapLibre positionne ses Marker via `transform`. Ne jamais
    // réécrire cette propriété ici, sinon le badge retombe en haut à gauche.
  }
}

async function rebuildTerminusMarkers(lines: GameLine[]) {
  if (!mapInstance || !mapReady() || typeof window === 'undefined') return
  const maplibre: any = await import('maplibre-gl')
  const focusLineId = pendingOverlay?.activeLineId ?? pendingOverlay?.editingLineId ?? pendingOverlay?.selectedLineId ?? null
  const signature = lines.map(line => {
    const endpoints = getLineTerminusStations(line)
      .map(station => `${station.id}:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}:${station.sharedStationId ?? ''}`)
      .join(',')
    return [
      line.id,
      line.name,
      line.shortCode,
      line.color,
      line.emblem,
      line.customLogoDataUrl?.length ?? 0,
      endpoints,
    ].join(':')
  }).join('|')
  if (signature === terminusMarkerSignature) {
    updateTerminusMarkerFocus()
    return
  }
  terminusMarkerSignature = signature
  clearTerminusMarkers(false)

  // Lorsqu'un terminus est aussi un vrai pôle de correspondance, le gros badge
  // de terminus ferait doublon avec l'étiquette compacte « Nom · 1 · 2 » de
  // GameMap et finirait par masquer le nom. On laisse donc le pôle partagé
  // porter l'information des lignes et on réserve le gros badge aux terminus seuls.
  const physicalStationUse = new Map<string, number>()
  for (const line of lines) {
    for (const station of getLineAllStations(line)) {
      const key = station.sharedStationId ? `shared:${station.sharedStationId}` : `coord:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}`
      physicalStationUse.set(key, (physicalStationUse.get(key) ?? 0) + 1)
    }
  }

  for (const line of lines) {
    if (line.stations.length < 2) continue
    const endpoints = getLineTerminusStations(line)
    for (const station of endpoints) {
      const physicalKey = station!.sharedStationId ? `shared:${station!.sharedStationId}` : `coord:${station!.longitude.toFixed(5)}:${station!.latitude.toFixed(5)}`
      if ((physicalStationUse.get(physicalKey) ?? 0) > 1) continue
      const element = document.createElement('div')
      element.className = 'clu-terminus-marker'
      element.title = `${line.name} · terminus ${station!.name}`
      const focused = !focusLineId || focusLineId === line.id
      const dimmed = new Set(pendingOverlay?.dimmedLineIds ?? []).has(line.id)
      const size = focusLineId === line.id ? 31 : 27
      element.style.cssText = `width:${size}px;height:${size}px;border-radius:10px;border:2px solid rgba(255,255,255,.92);box-shadow:0 4px 13px rgba(0,0,0,.5);display:grid;place-items:center;overflow:hidden;font:800 11px/1 Inter,system-ui,sans-serif;color:#081014;pointer-events:auto;opacity:${dimmed ? .14 : focused ? 1 : .38};transition:opacity .15s ease;`
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

      const marker = new maplibre.Marker({ element, anchor: 'bottom', offset: [0, -5] })
        .setLngLat([station!.longitude, station!.latitude])
        .addTo(mapInstance)
      terminusMarkers.push({ marker, element, lineId: line.id })
    }
  }
  updateTerminusMarkerFocus()
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


export function registerGameMapInstance(map: any | null) {
  if (mapInstance === map) return
  if (!map) {
    clearTerminusMarkers()
    mapInstance = null
    return
  }

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

/**
 * Le pont ne monkey-patche plus MapLibre. GameMap enregistre explicitement
 * l'instance une fois le constructeur terminé. Ainsi aucun code CLU ne touche
 * au prototype MapLibre ni au contexte WebGL avant la création de la carte.
 */
export function installGameMapBridge() {
  return Promise.resolve()
}

/**
 * L'export image ne doit jamais manipuler ni lire le contexte WebGL principal.
 *
 * Sur certaines configurations Chromium/GPU, déplacer la caméra, masquer les
 * couches puis lire le canvas MapLibre pendant un export 4K peut provoquer une
 * perte du contexte WebGL, un rafraîchissement de l'onglet et un PNG noir.
 *
 * Le renderer d'export possède déjà un fond Canvas 2D autonome. Tant qu'un
 * fond cartographique hors-WebGL n'est pas disponible, on retourne donc null
 * volontairement : l'export reste entièrement 2D et ne peut plus perturber la
 * carte du jeu.
 */
export interface GameMapBasemapCapture {
  dataUrl: string
  width: number
  height: number
  bounds: GameMunicipalityBounds
}

let lastBasemapSnapshot: GameMapBasemapCapture | null = null

/**
 * L'export ne déclenche JAMAIS de nouveau rendu WebGL. Il réutilise uniquement
 * la dernière miniature cartographique déjà capturée par le jeu en fonctionnement
 * normal. Cela remet un vrai fond de carte dans le plan sans déplacer la caméra,
 * sans resize et sans lecture GPU au moment de l'export.
 */
export async function captureGameMapBasemap(
  _bounds: GameMunicipalityBounds,
  _preferredSize?: { width: number; height: number },
): Promise<GameMapBasemapCapture | null> {
  return lastBasemapSnapshot
}

export function focusGameMapBounds(bounds: GameMunicipalityBounds, options?: GameMapFocusOptions) {
  pendingBounds = { bounds: { ...bounds }, options }
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
  options: { selectedLineId?: string | null; activeLineId?: string | null; editingLineId?: string | null; dimmedLineIds?: string[] } = {},
) {
  pendingOverlay = {
    lines,
    selectedLineId: options.selectedLineId ?? null,
    activeLineId: options.activeLineId ?? null,
    editingLineId: options.editingLineId ?? null,
    dimmedLineIds: options.dimmedLineIds ?? [],
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

const SAVE_THUMBNAIL_PREFIX = 'clu-metropole-save-thumbnail:'

function saveThumbnailStorageKey(saveId: string) {
  return `${SAVE_THUMBNAIL_PREFIX}${saveId}`
}

/**
 * Miniature légère du dernier état cartographique. Elle vit hors de la
 * sauvegarde principale afin de ne pas alourdir les autosaves ni les migrations.
 */
export function getGameSaveThumbnail(saveId: string): string | null {
  if (typeof window === 'undefined' || !saveId) return null
  try { return window.localStorage.getItem(saveThumbnailStorageKey(saveId)) }
  catch { return null }
}

export function removeGameSaveThumbnail(saveId: string) {
  if (typeof window === 'undefined' || !saveId) return
  try { window.localStorage.removeItem(saveThumbnailStorageKey(saveId)) }
  catch {}
}

/**
 * Copie le canvas MapLibre déjà rendu dans une petite image JPEG. La vignette
 * reste hors de la sauvegarde principale : elle n'alourdit donc ni les autosaves
 * ni les migrations.
 */
function storeCurrentMapThumbnail(saveId: string): string | null {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !saveId || !mapInstance || !mapReady()) return null
  try {
    const source = mapInstance.getCanvas?.() as HTMLCanvasElement | undefined
    if (!source || source.width <= 0 || source.height <= 0) return null

    const width = 600
    const height = 338
    const target = document.createElement('canvas')
    target.width = width
    target.height = height
    const context = target.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!context) return null

    const targetRatio = width / height
    const sourceRatio = source.width / source.height
    let sx = 0
    let sy = 0
    let sw = source.width
    let sh = source.height
    if (sourceRatio > targetRatio) {
      sw = source.height * targetRatio
      sx = (source.width - sw) / 2
    }
    else if (sourceRatio < targetRatio) {
      sh = source.width / targetRatio
      sy = (source.height - sh) / 2
    }

    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)

    // Si le buffer WebGL a déjà été effacé, le canvas peut être presque noir.
    // On ne stocke jamais cette fausse vignette : l'appelant demandera une
    // nouvelle frame MapLibre puis réessaiera.
    const pixels = context.getImageData(0, 0, width, height).data
    let min = 255
    let max = 0
    let total = 0
    let samples = 0
    for (let index = 0; index < pixels.length; index += 4 * 89) {
      const value = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3
      min = Math.min(min, value)
      max = Math.max(max, value)
      total += value
      samples += 1
    }
    const average = samples ? total / samples : 0
    if (max - min < 7 && average < 20) return null

    const url = target.toDataURL('image/jpeg', .82)
    if (!url || url.length < 1800) return null

    try {
      const bounds = mapInstance.getBounds?.()
      const west = Number(bounds?.getWest?.())
      const south = Number(bounds?.getSouth?.())
      const east = Number(bounds?.getEast?.())
      const north = Number(bounds?.getNorth?.())
      if ([west, south, east, north].every(Number.isFinite)) {
        // Mémoire uniquement : une copie un peu plus détaillée du canvas déjà
        // rendu. Aucun repaint, resize ou changement de caméra n'est déclenché.
        const basemapWidth = Math.max(480, Math.min(1100, source.width))
        const basemapHeight = Math.max(260, Math.round(basemapWidth * source.height / Math.max(1, source.width)))
        const basemapCanvas = document.createElement('canvas')
        basemapCanvas.width = basemapWidth
        basemapCanvas.height = basemapHeight
        const basemapContext = basemapCanvas.getContext('2d', { alpha: false })
        if (basemapContext) {
          basemapContext.drawImage(source, 0, 0, source.width, source.height, 0, 0, basemapWidth, basemapHeight)
          const dataUrl = basemapCanvas.toDataURL('image/jpeg', .84)
          if (dataUrl && dataUrl.length >= 1800) {
            lastBasemapSnapshot = {
              dataUrl,
              width: basemapWidth,
              height: basemapHeight,
              bounds: { west, south, east, north },
            }
          }
        }
      }
    }
    catch {}

    window.localStorage.setItem(saveThumbnailStorageKey(saveId), url)
    window.dispatchEvent(new CustomEvent('clu-save-thumbnail-updated', { detail: { saveId, url } }))
    return url
  }
  catch (error) {
    console.warn('[CLU] Vignette de sauvegarde indisponible', error)
    return null
  }
}

/**
 * Capture fiable de la carte : on demande explicitement une frame MapLibre et
 * on lit le canvas pendant l'événement `render`, avant que le navigateur puisse
 * libérer son back-buffer WebGL. Trois frames maximum, puis un dernier essai.
 */
export async function captureGameMapThumbnail(saveId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !saveId || !mapInstance || !mapReady()) return null

  const immediate = storeCurrentMapThumbnail(saveId)
  if (immediate) return immediate

  return await new Promise<string | null>((resolve) => {
    let settled = false
    let attempts = 0
    let timeoutId: number | null = null

    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      resolve(value)
    }

    const requestFrame = () => {
      if (settled || !mapInstance || !mapReady()) return finish(null)
      attempts += 1
      const onRender = () => {
        const captured = storeCurrentMapThumbnail(saveId)
        if (captured || attempts >= 3) finish(captured)
        else requestFrame()
      }
      try {
        mapInstance.once?.('render', onRender)
        mapInstance.triggerRepaint?.()
      }
      catch {
        finish(storeCurrentMapThumbnail(saveId))
      }
    }

    timeoutId = window.setTimeout(() => finish(storeCurrentMapThumbnail(saveId)), 1400)
    requestFrame()
  })
}
