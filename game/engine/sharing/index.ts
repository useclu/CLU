import { getTransportModeDefinition } from '../../config/transportModes'
import { currentGameLocale, translateGameText } from '../../config/i18n'
import { calculateLineLengthKm } from '../economy'
import { getLineAllStations, getLineBranches, getLineTerminusStations } from '../network/geometry'
import { getBundledLineRenderChunks } from '../network/renderGeometry'
import type { GameLine, GameNetworkState, GameStation, GameTransportMode } from '../../types/network'
import type { GameMunicipality } from '../../types/territory'
import { captureGameMapBasemap } from '../../utils/mapBridge'

export type GameWorldExportLabelDensity = 'AUTO' | 'ALL' | 'NONE'
export type GameWorldExportLayout = 'READABLE' | 'GEOGRAPHIC'

export interface GameWorldExportStats {
  name: string
  day: number
  passengers: number
  balance: number
  territoryLabel: string
}

export interface GameWorldExportOptions {
  width: number
  height: number
  labels: GameWorldExportLabelDensity
  layout?: GameWorldExportLayout
  showBasemap: boolean
  showLegend: boolean
  showStats: boolean
  showStationIndex?: boolean
}

export interface GameWorldExportPoint {
  longitude: number
  latitude: number
}

export interface GameWorldExportSequence {
  id: string
  lineId: string
  color: string
  mode: GameTransportMode
  shortCode: string
  corridorOffset: number
  corridorCount: number
  points: GameWorldExportPoint[]
}

export interface GameWorldExportStation {
  id: string
  physicalId: string
  name: string
  longitude: number
  latitude: number
  color: string
  terminus: boolean
  interchange: boolean
}

export interface GameWorldExportModel {
  lines: GameLine[]
  sequences: GameWorldExportSequence[]
  stations: GameWorldExportStation[]
  municipalities: readonly GameMunicipality[]
  modeCounts: Array<{ mode: GameTransportMode; label: string; count: number; accent: string }>
  stats: GameWorldExportStats & { lineCount: number; stationCount: number; networkLengthKm: number }
  bounds: { west: number; south: number; east: number; north: number }
}

export type CluEditorIndexShape =
  | 'CIRCLE'
  | 'ROUNDED_SQUARE'
  | 'LINES'
  | 'RECTANGLE'
  | 'CUT_RECTANGLE'

export interface CluEditorCustomIndex {
  id: string
  index: string
  shape: CluEditorIndexShape
  mode: string
  color: string
}

export interface CluEditorLineIdentity {
  lineId: string
  customIndexId: string
  label: string
  mode: string
  color: string
  generated: boolean
  shape: CluEditorIndexShape
}

export interface CluEditorProject {
  version: string
  presetBased: boolean
  line: Record<string, unknown>
  customIndices: CluEditorCustomIndex[]
}

export interface CluEditorExportResult {
  project: CluEditorProject
  warnings: string[]
  stationCount: number
  branchCount: number
  interchangeCount: number
  primaryIdentity: CluEditorLineIdentity
  customIndexCount: number
}

function stableId(prefix: string, raw: string) {
  const safe = String(raw || 'item').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 72)
  return `${prefix}-${safe}`
}

function editorMode(mode: GameTransportMode) {
  return mode === 'FERRY' ? 'BOAT' : mode
}

const GENERATED_EDITOR_INDEX_PREFIX: Record<GameTransportMode, string> = {
  METRO: 'M',
  TRAM: 'T',
  RER: 'R',
  TRAIN: 'TR',
  BUS: 'B',
  BRT: 'BHNS',
  CABLE: 'C',
  FERRY: 'F',
}

function editorIndexShape(line: Pick<GameLine, 'badgeStyle'>): CluEditorIndexShape {
  if (line.badgeStyle === 'ROUNDED' || line.badgeStyle === 'SQUARE') return 'ROUNDED_SQUARE'
  return 'CIRCLE'
}

function generatedEditorIndexLabel(line: GameLine, network: Pick<GameNetworkState, 'lines'>) {
  const siblings = network.lines.filter(candidate => candidate.mode === line.mode && candidate.status !== 'PROJECT')
  const used = new Set(
    siblings
      .map(candidate => String(candidate.shortCode || '').trim().toLocaleUpperCase('fr-FR'))
      .filter(Boolean),
  )
  const prefix = GENERATED_EDITOR_INDEX_PREFIX[line.mode]
  let ordinal = 1

  for (const sibling of siblings) {
    const explicit = String(sibling.shortCode || '').trim()
    if (explicit) continue
    let candidate = `${prefix}${ordinal}`
    while (used.has(candidate.toLocaleUpperCase('fr-FR'))) {
      ordinal += 1
      candidate = `${prefix}${ordinal}`
    }
    if (sibling.id === line.id) return candidate
    used.add(candidate.toLocaleUpperCase('fr-FR'))
    ordinal += 1
  }

  let candidate = `${prefix}${ordinal}`
  while (used.has(candidate.toLocaleUpperCase('fr-FR'))) {
    ordinal += 1
    candidate = `${prefix}${ordinal}`
  }
  return candidate
}

export function getCluEditorLineIdentity(
  line: GameLine,
  network: Pick<GameNetworkState, 'lines'>,
): CluEditorLineIdentity {
  const raw = String(line.shortCode || '').trim()
  const label = raw || generatedEditorIndexLabel(line, network)
  const color = line.color || getTransportModeDefinition(line.mode).accent
  const mode = editorMode(line.mode)

  return {
    lineId: line.id,
    customIndexId: stableId('metropole-index', `${line.id}-${mode}-${label}-${color}`),
    label,
    mode,
    color,
    generated: !raw,
    shape: editorIndexShape(line),
  }
}

function buildEditorIdentityCatalog(network: Pick<GameNetworkState, 'lines'>) {
  return new Map(network.lines.map(line => [line.id, getCluEditorLineIdentity(line, network)]))
}

function editorLineIndex(
  line: GameLine,
  identities: Map<string, CluEditorLineIdentity>,
) {
  const identity = identities.get(line.id)
  if (!identity) throw new Error(`Identité CLU Editor introuvable pour la ligne ${line.id}.`)
  return {
    mode: identity.mode,
    $customLineIndex: { id: identity.customIndexId },
  }
}

function editorCustomIndex(identity: CluEditorLineIdentity): CluEditorCustomIndex {
  return {
    id: identity.customIndexId,
    index: identity.label,
    shape: identity.shape,
    mode: identity.mode,
    color: identity.color,
  }
}

function physicalStationId(station: GameStation) {
  return station.sharedStationId || station.id
}

function lineStationUsage(network: Pick<GameNetworkState, 'lines'>) {
  const usage = new Map<string, Set<string>>()
  for (const line of network.lines) {
    for (const station of getLineAllStations(line)) {
      const key = physicalStationId(station)
      const lines = usage.get(key) ?? new Set<string>()
      lines.add(line.id)
      usage.set(key, lines)
    }
  }
  return usage
}

export function buildWorldExportModel(
  network: Pick<GameNetworkState, 'lines'>,
  stats: GameWorldExportStats,
  municipalities: readonly GameMunicipality[] = [],
): GameWorldExportModel {
  const operational = network.lines.filter(line => line.status !== 'PROJECT' && getLineAllStations(line).length > 0)
  const usage = lineStationUsage({ lines: operational })
  const sequences: GameWorldExportSequence[] = []
  const stationsByPhysicalId = new Map<string, GameWorldExportStation>()
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  const bundledChunks = getBundledLineRenderChunks(operational)

  for (const line of operational) {
    for (const chunk of bundledChunks.get(line.id) ?? []) {
      const points = chunk.coordinates.map(([longitude, latitude]) => ({ longitude, latitude }))
      if (points.length < 2) continue
      // Le cadrage de l'export est fondé sur les STATIONS, pas sur les milliers
      // de points intermédiaires du routage. Sinon une courbe routière locale peut
      // étirer tout le plan et réintroduire les zigzags que le mode schématique
      // cherche précisément à supprimer.
      sequences.push({
        id: chunk.id,
        lineId: line.id,
        color: line.color || getTransportModeDefinition(line.mode).accent,
        mode: line.mode,
        shortCode: line.shortCode,
        corridorOffset: chunk.corridorOffset,
        corridorCount: chunk.corridorCount,
        points,
      })
    }

    const termini = new Set(getLineTerminusStations(line).map(station => station.id))
    for (const station of getLineAllStations(line)) {
      const physicalId = physicalStationId(station)
      west = Math.min(west, station.longitude)
      south = Math.min(south, station.latitude)
      east = Math.max(east, station.longitude)
      north = Math.max(north, station.latitude)
      const existing = stationsByPhysicalId.get(physicalId)
      if (existing) {
        existing.terminus ||= termini.has(station.id)
        existing.interchange ||= (usage.get(physicalId)?.size ?? 0) > 1
        // Un nom réel déjà choisi est conservé ; on évite ainsi de dessiner plusieurs
        // fois la même station physique lorsqu'elle appartient à plusieurs lignes.
        if (station.name.length > existing.name.length && existing.name.startsWith('Station ')) existing.name = station.name
        continue
      }
      stationsByPhysicalId.set(physicalId, {
        id: station.id,
        physicalId,
        name: station.name,
        longitude: station.longitude,
        latitude: station.latitude,
        color: line.color || getTransportModeDefinition(line.mode).accent,
        terminus: termini.has(station.id),
        interchange: (usage.get(physicalId)?.size ?? 0) > 1,
      })
    }
  }

  if (!Number.isFinite(west)) {
    west = -.1; south = -.1; east = .1; north = .1
  }
  if (Math.abs(east - west) < 1e-7) { west -= .005; east += .005 }
  if (Math.abs(north - south) < 1e-7) { south -= .005; north += .005 }

  const modeCounts = Array.from(new Set(operational.map(line => line.mode))).map(mode => {
    const definition = getTransportModeDefinition(mode)
    return {
      mode,
      label: definition.label,
      count: operational.filter(line => line.mode === mode).length,
      accent: definition.accent,
    }
  })

  const stations = [...stationsByPhysicalId.values()]
  const physicalStations = new Set(stations.map(station => station.physicalId))
  return {
    lines: operational,
    sequences,
    stations,
    municipalities,
    modeCounts,
    stats: {
      ...stats,
      lineCount: operational.length,
      stationCount: physicalStations.size,
      networkLengthKm: operational.reduce((sum, line) => sum + calculateLineLengthKm(line), 0),
    },
    bounds: { west, south, east, north },
  }
}

function connectionCandidates(
  selectedLine: GameLine,
  station: GameStation,
  network: GameNetworkState,
) {
  const result: Array<{ line: GameLine; walk: boolean; walkingMinutes: number | null }> = []
  const used = new Set<string>()
  const physicalId = physicalStationId(station)

  for (const line of network.lines) {
    if (line.id === selectedLine.id || line.status === 'PROJECT') continue
    if (!getLineAllStations(line).some(candidate => physicalStationId(candidate) === physicalId)) continue
    used.add(line.id)
    result.push({ line, walk: false, walkingMinutes: null })
  }

  for (const transfer of network.walkingTransfers ?? []) {
    let otherLineId: string | null = null
    if (transfer.fromLineId === selectedLine.id && transfer.fromStationId === station.id) otherLineId = transfer.toLineId
    else if (transfer.toLineId === selectedLine.id && transfer.toStationId === station.id) otherLineId = transfer.fromLineId
    if (!otherLineId || used.has(otherLineId)) continue
    const line = network.lines.find(candidate => candidate.id === otherLineId)
    if (!line) continue
    used.add(line.id)
    result.push({ line, walk: true, walkingMinutes: Math.max(1, Math.round(transfer.walkingMinutes)) })
  }
  return result
}

function editorConnections(
  selectedLine: GameLine,
  station: GameStation,
  network: GameNetworkState,
  identities: Map<string, CluEditorLineIdentity>,
) {
  const candidates = connectionCandidates(selectedLine, station, network)
  const groups = new Map<string, typeof candidates>()
  for (const candidate of candidates) {
    const mode = editorMode(candidate.line.mode)
    const group = groups.get(mode) ?? []
    group.push(candidate)
    groups.set(mode, group)
  }
  return [...groups.entries()].map(([mode, group], groupIndex) => {
    const hasWalking = group.some(item => item.walk)
    const minutes = group.filter(item => item.walkingMinutes != null).map(item => item.walkingMinutes as number)
    return {
      id: stableId('conn', `${station.id}-${mode}-${groupIndex}`),
      $modeConnection: {
        mode,
        elements: group.map((item, index) => ({
          id: stableId('conn-line', `${station.id}-${item.line.id}-${index}`),
          $modeConnectionElement: {
            lineIndex: editorLineIndex(item.line, identities),
            walk: item.walk,
            transfer: item.walk ? { mode: 'WALK', durationMinutes: item.walkingMinutes, label: undefined } : null,
            ornament: null,
            customPictogram: null,
          },
        })),
        walk: hasWalking,
        transfer: hasWalking ? { mode: 'WALK', durationMinutes: minutes.length ? Math.min(...minutes) : null } : null,
        customPictogram: null,
        customConnections: [],
      },
    }
  })
}

function editorStop(
  selectedLine: GameLine,
  station: GameStation,
  network: GameNetworkState,
  terminusIds: Set<string>,
  identities: Map<string, CluEditorLineIdentity>,
) {
  return {
    id: stableId('stop', station.id),
    $stop: {
      name: station.name || 'Station',
      subtitle: '',
      placeName: '',
      accessible: 'undefined',
      preventSubtitleOverlapping: true,
      interestPoint: false,
      terminus: terminusIds.has(station.id),
      closed: false,
      future: false,
      reverse: false,
      connections: editorConnections(selectedLine, station, network, identities),
      nameStyle: {
        bold: true,
        italic: false,
        underline: false,
        color: null,
        image: null,
        imageSize: 1,
        images: [],
      },
    },
  }
}

function editorBranchElement(
  selectedLine: GameLine,
  stations: GameStation[],
  network: GameNetworkState,
  terminusIds: Set<string>,
  idSuffix: string,
  identities: Map<string, CluEditorLineIdentity>,
) {
  return {
    id: stableId('branch', `${selectedLine.id}-${idSuffix}`),
    $branch: {
      elementSpacing: 0,
      marginLeft: 0,
      marginRight: 0,
      invertedElements: false,
      elements: stations.map(station => editorStop(selectedLine, station, network, terminusIds, identities)),
    },
  }
}

function findDirectChildBranches(line: GameLine, stationIds: Set<string>, consumed: Set<string>) {
  return getLineBranches(line).filter(branch => !consumed.has(branch.id) && stationIds.has(branch.fromStationId))
}

function buildEditorSectionForSequence(
  line: GameLine,
  sequence: GameStation[],
  network: GameNetworkState,
  terminusIds: Set<string>,
  consumed: Set<string>,
  depth: number,
  sectionKey: string,
  identities: Map<string, CluEditorLineIdentity>,
): Record<string, unknown> {
  const stationIds = new Set(sequence.map(station => station.id))
  const childBranches = findDirectChildBranches(line, stationIds, consumed)
    .sort((a, b) => sequence.findIndex(station => station.id === a.fromStationId) - sequence.findIndex(station => station.id === b.fromStationId))
  const child = childBranches[0]

  if (!child) {
    return {
      id: stableId('section', sectionKey),
      $lineSection: {
        levelOffset: depth,
        elements: sequence.length ? [editorBranchElement(line, sequence, network, terminusIds, `${sectionKey}-tail`, identities)] : [],
      },
    }
  }

  const junctionIndex = sequence.findIndex(station => station.id === child.fromStationId)
  if (junctionIndex < 0) {
    consumed.add(child.id)
    return buildEditorSectionForSequence(line, sequence, network, terminusIds, consumed, depth, `${sectionKey}-skip`, identities)
  }
  consumed.add(child.id)
  const beforeAndJunction = sequence.slice(0, junctionIndex + 1)
  const continuation = sequence.slice(junctionIndex + 1)
  const offshoot = child.stations
  const junctionStopId = stableId('stop', child.fromStationId)
  const elements: Record<string, unknown>[] = []
  if (beforeAndJunction.length) elements.push(editorBranchElement(line, beforeAndJunction, network, terminusIds, `${sectionKey}-prefix`, identities))

  const mainSection = buildEditorSectionForSequence(line, continuation, network, terminusIds, consumed, depth + 1, `${sectionKey}-main-${child.id}`, identities)
  const branchSection = buildEditorSectionForSequence(line, offshoot, network, terminusIds, consumed, depth - 1, `${sectionKey}-branch-${child.id}`, identities)
  elements.push({
    id: stableId('fork', child.id),
    $fork: {
      toward: 'RIGHT',
      originOffset: 0,
      linksOffset: [1, -1],
      offsetMultiplier: 1,
      lineId: 'primary',
      afterStopId: junctionStopId,
      forkStyle: 'ROUNDED',
      sections: [mainSection, branchSection],
    },
  })

  return {
    id: stableId('section', sectionKey),
    $lineSection: { levelOffset: depth, elements },
  }
}

export function buildCluEditorProject(line: GameLine, network: GameNetworkState): CluEditorExportResult {
  const warnings: string[] = []
  const identities = buildEditorIdentityCatalog(network)
  const primaryIdentity = identities.get(line.id) ?? getCluEditorLineIdentity(line, network)
  const involvedLineIds = new Set<string>([line.id])
  for (const station of getLineAllStations(line)) {
    for (const candidate of connectionCandidates(line, station, network)) involvedLineIds.add(candidate.line.id)
  }

  const customIndices = [...involvedLineIds]
    .map(lineId => identities.get(lineId))
    .filter((identity): identity is CluEditorLineIdentity => Boolean(identity))
    .map(editorCustomIndex)

  const termini = new Set(getLineTerminusStations(line).map(station => station.id))
  const consumedBranches = new Set<string>()
  const topology = [buildEditorSectionForSequence(line, line.stations, network, termini, consumedBranches, 0, `${line.id}-root`, identities)]
  const remaining = getLineBranches(line).filter(branch => !consumedBranches.has(branch.id))
  if (remaining.length) warnings.push(`${remaining.length} branche(s) complexe(s) n'ont pas pu être imbriquées automatiquement et ont été ajoutées comme sections séparées.`)
  for (const branch of remaining) {
    topology.push({
      id: stableId('section', `${line.id}-extra-${branch.id}`),
      $lineSection: {
        levelOffset: 0,
        elements: [editorBranchElement(line, branch.stations, network, termini, `extra-${branch.id}`, identities)],
      },
    })
  }

  const interchangeCount = getLineAllStations(line).reduce((sum, station) => sum + connectionCandidates(line, station, network).length, 0)
  if (primaryIdentity.generated) warnings.push(`Cette ligne n'avait pas d'indice : CLU Métropole lui a attribué « ${primaryIdentity.label} » pour l'export Editor.`)
  if (line.mode === 'FERRY') warnings.push('Navette fluviale est exportée en mode BOAT dans CLU Editor.')
  if (line.customLogoDataUrl) warnings.push('Le logo personnalisé de Métropole n’est pas transféré : CLU Editor utilise son propre système d’indices/pictogrammes.')
  if ((line.routeSegments?.length ?? 0) > 0) warnings.push('La géométrie cartographique exacte n’est pas transférée : CLU Editor recrée un plan schématique à partir de la topologie et des arrêts.')

  return {
    project: {
      version: '1.0.0',
      presetBased: false,
      line: {
        mode: primaryIdentity.mode,
        index: editorLineIndex(line, identities),
        color: primaryIdentity.color,
        lineThickness: line.mode === 'RER' || line.mode === 'TRAIN' ? '1.5' : line.mode === 'METRO' ? '0.375' : '0.5',
        lineStyle: 'PLAIN',
        dotsColorPolicy: line.mode === 'RER' || line.mode === 'TRAIN' ? 'WHITE' : 'INHERIT',
        fullyAccessible: false,
        frameTerminusNames: line.mode !== 'RER' && line.mode !== 'TRAIN',
        formatStyle: line.mode === 'RER' || line.mode === 'TRAIN' ? 'SNCF' : 'RATP',
        fontFamily: 'PARISINE',
        mapSize: Math.max(15, Math.min(48, 14 + Math.ceil(getLineAllStations(line).length * .45))),
        topology,
      },
      customIndices,
    },
    warnings,
    stationCount: getLineAllStations(line).length,
    branchCount: getLineBranches(line).length,
    interchangeCount,
    primaryIdentity,
    customIndexCount: customIndices.length,
  }
}

export function serializeCluEditorProject(line: GameLine, network: GameNetworkState) {
  return JSON.stringify(buildCluEditorProject(line, network).project, null, 2)
}

function mercatorY(latitude: number) {
  const lat = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180
  return Math.log(Math.tan(Math.PI / 4 + lat / 2))
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value))
}

function compactEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function yieldExportFrame() {
  return new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })
}

async function blobLooksRendered(blob: Blob) {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return true
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob)
    const probe = document.createElement('canvas')
    probe.width = 40
    probe.height = 31
    const probeContext = probe.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!probeContext) return true
    probeContext.drawImage(bitmap, 0, 0, probe.width, probe.height)
    const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data
    let minimum = 255
    let maximum = 0
    let total = 0
    let count = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const value = (pixels[index]! + pixels[index + 1]! + pixels[index + 2]!) / 3
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
      total += value
      count += 1
    }
    const average = count ? total / count : 0
    // Le plan CLU possède toujours un cadre bleu-gris, du texte clair et un fond
    // sombre : un PNG uniformément noir est donc forcément un échec de rasterisation.
    return maximum > 24 && average > 4 && maximum - minimum > 9
  }
  catch {
    // Ne jamais bloquer un export correct uniquement parce que le navigateur ne
    // sait pas relire un Blob PNG avec createImageBitmap.
    return true
  }
  finally {
    try { bitmap?.close() } catch {}
  }
}

async function encodeCanvasPng(canvas: HTMLCanvasElement) {
  await yieldExportFrame()
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossible de générer l’image PNG.')), 'image/png')
  })
}

async function canvasBlob(canvas: HTMLCanvasElement) {
  const first = await encodeCanvasPng(canvas)
  if (await blobLooksRendered(first)) return first

  // Certains pilotes accélèrent malgré tout un grand Canvas2D et peuvent rendre
  // son encodage noir après une réinitialisation du compositeur. On recopie alors
  // l'image dans un second canvas explicitement orienté lecture/CPU puis on encode
  // cette copie. Aucun contexte WebGL n'est créé ou consulté ici.
  const recovery = document.createElement('canvas')
  recovery.width = canvas.width
  recovery.height = canvas.height
  const recoveryContext = recovery.getContext('2d', { alpha: false, willReadFrequently: true })
  if (recoveryContext) {
    recoveryContext.fillStyle = '#435562'
    recoveryContext.fillRect(0, 0, recovery.width, recovery.height)
    recoveryContext.drawImage(canvas, 0, 0)
    await yieldExportFrame()
    const second = await encodeCanvasPng(recovery)
    recovery.width = 1
    recovery.height = 1
    if (await blobLooksRendered(second)) return second
  }

  throw new Error('Le navigateur a produit une image noire pendant l’export. Aucun fichier corrompu n’a été téléchargé.')
}

interface ExportCanvasPoint {
  x: number
  y: number
}

interface ExportStationTrackStop {
  point: ExportCanvasPoint
  lineId: string
  color: string
  terminus: boolean
}

interface ExportStationVisual {
  station: GameWorldExportStation
  point: ExportCanvasPoint
  points: ExportCanvasPoint[]
  trackStops: ExportStationTrackStop[]
  tangent: ExportCanvasPoint | null
  lineIds: string[]
  terminus: boolean
  interchange: boolean
}

function exportClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function exportDistance(a: ExportCanvasPoint, b: ExportCanvasPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalizedCanvasVector(x: number, y: number): ExportCanvasPoint {
  const length = Math.hypot(x, y)
  if (length <= 1e-9) return { x: 1, y: 0 }
  return { x: x / length, y: y / length }
}

function lineTextColor(background: string) {
  const raw = String(background || '').replace('#', '').trim()
  const normalized = raw.length === 3 ? raw.split('').map(char => char + char).join('') : raw.padEnd(6, '0').slice(0, 6)
  const red = Number.parseInt(normalized.slice(0, 2), 16) || 0
  const green = Number.parseInt(normalized.slice(2, 4), 16) || 0
  const blue = Number.parseInt(normalized.slice(4, 6), 16) || 0
  const luminance = (red * .299 + green * .587 + blue * .114) / 255
  return luminance >= .62 ? '#081014' : '#ffffff'
}

function canvasPointSegmentDistance(point: ExportCanvasPoint, start: ExportCanvasPoint, end: ExportCanvasPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) return exportDistance(point, start)
  const ratio = exportClamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio))
}

function simplifyCanvasPolyline(points: readonly ExportCanvasPoint[], tolerance: number) {
  if (points.length <= 2 || tolerance <= 0) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [startIndex, endIndex] = stack.pop()!
    let farthestIndex = -1
    let farthestDistance = tolerance
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = canvasPointSegmentDistance(points[index]!, points[startIndex]!, points[endIndex]!)
      if (distance > farthestDistance) {
        farthestDistance = distance
        farthestIndex = index
      }
    }
    if (farthestIndex < 0) continue
    keep[farthestIndex] = 1
    stack.push([startIndex, farthestIndex], [farthestIndex, endIndex])
  }
  return points.filter((_, index) => keep[index] === 1)
}

function macroCanvasPolyline(
  points: readonly ExportCanvasPoint[],
  baseTolerance: number,
  maximumPoints = 5,
) {
  if (points.length <= maximumPoints) return [...points]
  let tolerance = Math.max(1, baseTolerance)
  let result = simplifyCanvasPolyline(points, tolerance)
  for (let guard = 0; result.length > maximumPoints && guard < 8; guard += 1) {
    tolerance *= 1.32
    result = simplifyCanvasPolyline(points, tolerance)
  }
  if (result.length <= maximumPoints) return result

  // Dernier filet de sécurité : on garde les changements de direction les plus
  // structurants, jamais une série de micro-coudes géographiques.
  const selected = new Set<number>([0, points.length - 1])
  while (selected.size < maximumPoints) {
    const ordered = [...selected].sort((a, b) => a - b)
    let bestIndex = -1
    let bestDistance = -1
    for (let segmentIndex = 1; segmentIndex < ordered.length; segmentIndex += 1) {
      const startIndex = ordered[segmentIndex - 1]!
      const endIndex = ordered[segmentIndex]!
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const distance = canvasPointSegmentDistance(points[index]!, points[startIndex]!, points[endIndex]!)
        if (distance > bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      }
    }
    if (bestIndex < 0) break
    selected.add(bestIndex)
  }
  return [...selected].sort((a, b) => a - b).map(index => points[index]!)
}

function drawCanvasPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly ExportCanvasPoint[],
  width: number,
  color: string,
) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index]!.x, points[index]!.y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function translatedExportText(input: string) {
  return translateGameText(input, currentGameLocale())
}

function drawLineBadge(
  ctx: CanvasRenderingContext2D,
  line: Pick<GameLine, 'shortCode' | 'color' | 'badgeStyle'>,
  x: number,
  y: number,
  height: number,
) {
  const code = String(line.shortCode || '—').trim() || '—'
  ctx.font = `800 ${height * .53}px Arial, sans-serif`
  const width = Math.max(height, ctx.measureText(code).width + height * .55)
  ctx.fillStyle = line.color || '#7f8a90'
  if (line.badgeStyle === 'CIRCLE' && code.length <= 2) {
    ctx.beginPath()
    ctx.arc(x + width / 2, y + height / 2, height / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  else {
    roundRectPath(ctx, x, y, width, height, height * .34)
    ctx.fill()
  }
  ctx.fillStyle = lineTextColor(line.color)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(code, x + width / 2, y + height * .52)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  return width
}

/**
 * Regroupe uniquement les vrais arrêts physiques.
 *
 * Important : les noeuds de voie schématiques peuvent être rapprochés pour
 * construire un faisceau lisible, mais ils ne doivent jamais transformer deux
 * stations distinctes en une gare multi-lignes. L'identité voyageurs reste donc
 * strictement fondée sur `sharedStationId` (ou, à défaut, l'id propre de l'arrêt).
 */
function stationOccurrenceMap(lines: readonly GameLine[]) {
  const result = new Map<string, Array<{ line: GameLine; station: GameStation; terminus: boolean }>>()
  for (const line of lines) {
    const terminusIds = new Set(getLineTerminusStations(line).map(station => station.id))
    for (const station of getLineAllStations(line)) {
      const key = physicalStationId(station)
      const group = result.get(key) ?? []
      group.push({ line, station, terminus: terminusIds.has(station.id) })
      result.set(key, group)
    }
  }
  return result
}

function medianNumber(values: readonly number[]) {
  if (!values.length) return .5
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/**
 * Projection focus + contexte : le coeur dense reçoit davantage d'espace,
 * tandis que les longues branches périphériques restent entièrement visibles.
 * Les extrémités restent fixes (0 et 1) afin que le cadrage reste prévisible.
 */
function warpExportAxis(value: number, focus: number, exponent: number) {
  const current = exportClamp(value, 0, 1)
  const pivot = exportClamp(focus, .08, .92)
  if (current <= pivot) {
    const ratio = (pivot - current) / Math.max(1e-9, pivot)
    return pivot - pivot * Math.pow(ratio, exponent)
  }
  const span = Math.max(1e-9, 1 - pivot)
  const ratio = (current - pivot) / span
  return pivot + span * Math.pow(ratio, exponent)
}

function compactCanvasPolyline(points: readonly ExportCanvasPoint[], minimumDistance: number) {
  if (points.length <= 2 || minimumDistance <= 0) return [...points]
  const result: ExportCanvasPoint[] = [points[0]!]
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!
    if (exportDistance(result[result.length - 1]!, point) >= minimumDistance) result.push(point)
  }
  result.push(points[points.length - 1]!)
  return result
}

/**
 * Nettoie les hairpins et petits doglegs qu'un décalage/octilinéarisation peut
 * créer. Sur un plan éditorial, une ligne ne doit jamais faire demi-tour sur
 * quelques pixels ni dessiner une boucle autour d'une gare.
 */
function cleanEditorialPolyline(points: readonly ExportCanvasPoint[], minimumDistance = 1) {
  let result = compactCanvasPolyline(points, minimumDistance)
  for (let pass = 0; pass < 5 && result.length > 2; pass += 1) {
    let changed = false
    const next: ExportCanvasPoint[] = [result[0]!]
    for (let index = 1; index < result.length - 1; index += 1) {
      const previous = next[next.length - 1]!
      const current = result[index]!
      const following = result[index + 1]!
      const incoming = normalizedCanvasVector(current.x - previous.x, current.y - previous.y)
      const outgoing = normalizedCanvasVector(following.x - current.x, following.y - current.y)
      const dot = exportClamp(incoming.x * outgoing.x + incoming.y * outgoing.y, -1, 1)
      const firstLeg = exportDistance(previous, current)
      const secondLeg = exportDistance(current, following)
      const chord = exportDistance(previous, following)
      const deviation = canvasPointSegmentDistance(current, previous, following)

      const hairpin = dot < -.28 && chord < Math.max(firstLeg, secondLeg) * 1.28
      const tinyDogleg = deviation < Math.max(1.2, minimumDistance * 1.8)
        && Math.min(firstLeg, secondLeg) < Math.max(18, minimumDistance * 8)
      if (hairpin || tinyDogleg) {
        changed = true
        continue
      }
      next.push(current)
    }
    next.push(result[result.length - 1]!)
    result = compactCanvasPolyline(next, minimumDistance)
    if (!changed) break
  }
  return result
}

function drawRoundedCanvasPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly ExportCanvasPoint[],
  width: number,
  color: string,
  radius: number,
) {
  if (points.length < 2) return
  if (points.length === 2 || radius <= .1) {
    drawCanvasPolyline(ctx, points, width, color)
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]!
    const incomingLength = exportDistance(previous, current)
    const outgoingLength = exportDistance(current, next)
    if (incomingLength <= .01 || outgoingLength <= .01) continue
    const cornerRadius = Math.min(radius, incomingLength * .34, outgoingLength * .34)
    const incoming = normalizedCanvasVector(current.x - previous.x, current.y - previous.y)
    const outgoing = normalizedCanvasVector(next.x - current.x, next.y - current.y)
    const entry = { x: current.x - incoming.x * cornerRadius, y: current.y - incoming.y * cornerRadius }
    const exit = { x: current.x + outgoing.x * cornerRadius, y: current.y + outgoing.y * cornerRadius }
    ctx.lineTo(entry.x, entry.y)
    ctx.quadraticCurveTo(current.x, current.y, exit.x, exit.y)
  }
  const last = points[points.length - 1]!
  ctx.lineTo(last.x, last.y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

interface ExportSchematicAnchor {
  physicalId: string
  /** Arrêt réel de cette ligne. null = simple passage sur la voie, sans desserte. */
  station: GameStation | null
  longitude: number
  latitude: number
}

interface ExportSchematicChain {
  line: GameLine
  kind: 'MAIN' | 'BRANCH'
  branchId: string | null
  anchors: ExportSchematicAnchor[]
  /** Géométrie réelle guidant chaque intervalle anchors[i] -> anchors[i + 1]. */
  edgeGuides: ExportCanvasPoint[][]
}

interface ExportSchematicEdgeGeometry {
  fromPhysicalId: string
  toPhysicalId: string
  points: ExportCanvasPoint[]
}

interface ExportSchematicEdgeGuide extends ExportSchematicEdgeGeometry {
  lineId: string
}

interface ExportSchematicNetwork {
  chains: ExportSchematicChain[]
  nodePoints: Map<string, ExportCanvasPoint>
  edgeGeometry: Map<string, ExportSchematicEdgeGeometry>
  edgeLineIds: Map<string, Set<string>>
  /**
   * Noeud de VOIE utilisé pour aligner le tracé de chaque occurrence d'arrêt.
   * Ce mapping n'est jamais une preuve de correspondance voyageurs.
   */
  stationNodeIds: Map<string, string>
  /** Noeuds correspondant à de vrais arrêts (à l'inverse des passages invisibles). */
  realStopNodeIds: Set<string>
  /** Noeuds où une branche de ligne naît : ils doivent rester lisibles et nommés. */
  branchNodeIds: Set<string>
}

function schematicEdgeKey(first: string, second: string) {
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

function normalizedStationName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function geoMetersPerLongitude(latitude: number) {
  return 111_320 * Math.max(.2, Math.cos(latitude * Math.PI / 180))
}

function geoDistanceMeters(
  first: readonly [number, number],
  second: readonly [number, number],
) {
  const latitude = (first[1] + second[1]) / 2
  const dx = (second[0] - first[0]) * geoMetersPerLongitude(latitude)
  const dy = (second[1] - first[1]) * 111_320
  return Math.hypot(dx, dy)
}

function geoPolylineCumulative(points: readonly (readonly [number, number])[]) {
  const cumulative = new Array<number>(points.length).fill(0)
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1]! + geoDistanceMeters(points[index - 1]!, points[index]!)
  }
  return cumulative
}

function geoPointAtPolylineDistance(
  points: readonly (readonly [number, number])[],
  cumulative: readonly number[],
  targetDistance: number,
): [number, number] {
  if (!points.length) return [0, 0]
  if (points.length === 1) return [points[0]![0], points[0]![1]]
  const total = cumulative[cumulative.length - 1] ?? 0
  const target = exportClamp(targetDistance, 0, total)
  for (let index = 1; index < points.length; index += 1) {
    const endDistance = cumulative[index]!
    if (target > endDistance && index < points.length - 1) continue
    const startDistance = cumulative[index - 1]!
    const span = Math.max(1e-9, endDistance - startDistance)
    const ratio = exportClamp((target - startDistance) / span, 0, 1)
    const start = points[index - 1]!
    const end = points[index]!
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ]
  }
  const last = points[points.length - 1]!
  return [last[0], last[1]]
}

function geoPointSegmentDistanceMeters(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
) {
  const latitude = point[1]
  const longitudeScale = geoMetersPerLongitude(latitude)
  const px = point[0] * longitudeScale
  const py = point[1] * 111_320
  const ax = start[0] * longitudeScale
  const ay = start[1] * 111_320
  const bx = end[0] * longitudeScale
  const by = end[1] * 111_320
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-9) return Math.hypot(px - ax, py - ay)
  const ratio = exportClamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
  return Math.hypot(px - (ax + dx * ratio), py - (ay + dy * ratio))
}

function geoPointPolylineDistanceMeters(
  point: readonly [number, number],
  points: readonly (readonly [number, number])[],
) {
  if (!points.length) return Number.POSITIVE_INFINITY
  if (points.length === 1) return geoDistanceMeters(point, points[0]!)
  let minimum = Number.POSITIVE_INFINITY
  for (let index = 1; index < points.length; index += 1) {
    minimum = Math.min(minimum, geoPointSegmentDistanceMeters(point, points[index - 1]!, points[index]!))
  }
  return minimum
}

function nearestGeoPolylinePosition(
  station: GameStation,
  points: readonly (readonly [number, number])[],
) {
  if (points.length < 2) return { distanceMeters: Number.POSITIVE_INFINITY, alongMeters: 0, totalMeters: 0 }
  const cumulative = geoPolylineCumulative(points)
  const totalMeters = cumulative[cumulative.length - 1] ?? 0
  const target: [number, number] = [station.longitude, station.latitude]
  const latitude = station.latitude
  const longitudeScale = geoMetersPerLongitude(latitude)
  const px = target[0] * longitudeScale
  const py = target[1] * 111_320
  let bestDistance = Number.POSITIVE_INFINITY
  let bestAlong = 0

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const ax = start[0] * longitudeScale
    const ay = start[1] * 111_320
    const bx = end[0] * longitudeScale
    const by = end[1] * 111_320
    const dx = bx - ax
    const dy = by - ay
    const lengthSquared = dx * dx + dy * dy
    const ratio = lengthSquared <= 1e-9
      ? 0
      : exportClamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
    const qx = ax + dx * ratio
    const qy = ay + dy * ratio
    const distance = Math.hypot(px - qx, py - qy)
    if (distance >= bestDistance) continue
    bestDistance = distance
    const segmentLength = Math.max(0, (cumulative[index] ?? 0) - (cumulative[index - 1] ?? 0))
    bestAlong = (cumulative[index - 1] ?? 0) + segmentLength * ratio
  }

  return { distanceMeters: bestDistance, alongMeters: bestAlong, totalMeters }
}

function sliceGeoPolylineByDistance(
  points: readonly (readonly [number, number])[],
  startDistance: number,
  endDistance: number,
) {
  if (points.length < 2) return points.map(point => [point[0], point[1]] as [number, number])
  const cumulative = geoPolylineCumulative(points)
  const total = cumulative[cumulative.length - 1] ?? 0
  const start = exportClamp(Math.min(startDistance, endDistance), 0, total)
  const end = exportClamp(Math.max(startDistance, endDistance), 0, total)
  const result: [number, number][] = [geoPointAtPolylineDistance(points, cumulative, start)]
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = cumulative[index]!
    if (distance > start + .05 && distance < end - .05) result.push([points[index]![0], points[index]![1]])
  }
  result.push(geoPointAtPolylineDistance(points, cumulative, end))
  return result
}

function orientedLineRouteSegment(
  line: GameLine,
  fromStation: GameStation,
  toStation: GameStation,
): Array<[number, number]> {
  const segment = (line.routeSegments ?? []).find(candidate =>
    (candidate.fromStationId === fromStation.id && candidate.toStationId === toStation.id)
    || (candidate.fromStationId === toStation.id && candidate.toStationId === fromStation.id))
  if (!segment?.coordinates?.length) {
    return [
      [fromStation.longitude, fromStation.latitude],
      [toStation.longitude, toStation.latitude],
    ]
  }
  const coordinates = segment.coordinates.map(point => [point[0], point[1]] as [number, number])
  if (segment.fromStationId === fromStation.id) return coordinates
  return coordinates.reverse()
}

function routeSegmentsTouchingStation(line: GameLine, station: GameStation) {
  return (line.routeSegments ?? [])
    .filter(segment => segment.fromStationId === station.id || segment.toStationId === station.id)
    .map(segment => segment.coordinates as Array<[number, number]>)
    .filter(points => points.length >= 2)
}

function schematicStationOccurrenceKey(lineId: string, stationId: string) {
  return `${lineId}:${stationId}`
}

/**
 * Construit les identifiants de NOEUDS DE VOIE du plan schématique.
 *
 * Une ancienne sauvegarde peut contenir deux objets station presque superposés
 * pour une même gare sans sharedStationId commun. On peut alors partager un ancrage
 * de voie pour garder des câbles parallèles, mais uniquement si les routeSegments
 * apportent aussi une preuve de corridor commun. La proximité + le nom seuls ne
 * suffisent jamais.
 *
 * Ce mapping est volontairement distinct de l'identité des arrêts voyageurs :
 * stationOccurrenceMap() continue à grouper uniquement par sharedStationId/id.
 */
function routeExitGeometries(line: GameLine, station: GameStation) {
  const result: Array<Array<[number, number]>> = []
  for (const segment of line.routeSegments ?? []) {
    if (segment.fromStationId !== station.id && segment.toStationId !== station.id) continue
    if (segment.coordinates.length < 2) continue
    const points = segment.coordinates.map(point => [point[0], point[1]] as [number, number])
    if (segment.toStationId === station.id) points.reverse()
    result.push(points)
  }
  return result
}

function stationsShareSchematicTrack(
  firstLine: GameLine,
  firstStation: GameStation,
  secondLine: GameLine,
  secondStation: GameStation,
) {
  const firstExits = routeExitGeometries(firstLine, firstStation)
  const secondExits = routeExitGeometries(secondLine, secondStation)
  if (!firstExits.length || !secondExits.length) return false

  for (const first of firstExits) {
    const firstCumulative = geoPolylineCumulative(first)
    const firstTotal = firstCumulative[firstCumulative.length - 1] ?? 0
    for (const second of secondExits) {
      const secondCumulative = geoPolylineCumulative(second)
      const secondTotal = secondCumulative[secondCumulative.length - 1] ?? 0
      const commonReach = Math.min(firstTotal, secondTotal)
      if (commonReach < 70) continue

      const farProbe = Math.min(220, commonReach * .56)
      const nearProbe = Math.min(70, farProbe * .45)
      const probes = [nearProbe, farProbe].filter(distance => distance >= 28)
      let maximumSeparation = 0
      for (const distance of probes) {
        const firstPoint = geoPointAtPolylineDistance(first, firstCumulative, distance)
        const secondPoint = geoPointAtPolylineDistance(second, secondCumulative, distance)
        maximumSeparation = Math.max(maximumSeparation, geoDistanceMeters(firstPoint, secondPoint))
      }
      if (maximumSeparation <= 92) return true
    }
  }
  return false
}

function buildSchematicStationNodeIds(lines: readonly GameLine[]) {
  type Entry = { line: GameLine; lineId: string; station: GameStation; physicalId: string; nameKey: string }
  const entries: Entry[] = []
  const stationNodeIds = new Map<string, string>()

  for (const line of lines) {
    for (const station of getLineAllStations(line)) {
      const physicalId = physicalStationId(station)
      const entry = { line, lineId: line.id, station, physicalId, nameKey: normalizedStationName(station.name) }
      entries.push(entry)
      stationNodeIds.set(schematicStationOccurrenceKey(line.id, station.id), physicalId)
    }
  }

  const byName = new Map<string, Entry[]>()
  for (const entry of entries) {
    if (!entry.nameKey) continue
    const group = byName.get(entry.nameKey) ?? []
    group.push(entry)
    byName.set(entry.nameKey, group)
  }

  for (const group of byName.values()) {
    if (new Set(group.map(entry => entry.lineId)).size < 2) continue
    const parent = group.map((_, index) => index)
    const find = (index: number): number => {
      let current = index
      while (parent[current] !== current) {
        parent[current] = parent[parent[current]!]!
        current = parent[current]!
      }
      return current
    }
    const unite = (first: number, second: number) => {
      const a = find(first)
      const b = find(second)
      if (a !== b) parent[b] = a
    }

    for (let first = 0; first < group.length; first += 1) {
      for (let second = first + 1; second < group.length; second += 1) {
        const a = group[first]!
        const b = group[second]!
        if (a.lineId === b.lineId) continue
        const stationDistance = geoDistanceMeters(
          [a.station.longitude, a.station.latitude],
          [b.station.longitude, b.station.latitude],
        )
        if (stationDistance > 180) continue
        if (!stationsShareSchematicTrack(a.line, a.station, b.line, b.station)) continue
        unite(first, second)
      }
    }

    const clusters = new Map<number, Entry[]>()
    group.forEach((entry, index) => {
      const root = find(index)
      const cluster = clusters.get(root) ?? []
      cluster.push(entry)
      clusters.set(root, cluster)
    })

    for (const cluster of clusters.values()) {
      if (new Set(cluster.map(entry => entry.lineId)).size < 2) continue
      const canonical = [...new Set(cluster.map(entry => entry.physicalId))].sort()[0]!
      for (const entry of cluster) {
        stationNodeIds.set(schematicStationOccurrenceKey(entry.lineId, entry.station.id), canonical)
      }
    }
  }

  return stationNodeIds
}

function exportLineSchematicChains(
  lines: readonly GameLine[],
  project: (longitude: number, latitude: number) => ExportCanvasPoint,
  stationNodeIds: ReadonlyMap<string, string>,
) {
  const nodeIdFor = (line: GameLine, station: GameStation) =>
    stationNodeIds.get(schematicStationOccurrenceKey(line.id, station.id)) ?? physicalStationId(station)
  const physicalStations = new Map<string, GameStation>()
  const occurrences = new Map<string, Array<{ line: GameLine; station: GameStation }>>()
  for (const line of lines) {
    for (const station of getLineAllStations(line)) {
      const id = nodeIdFor(line, station)
      if (!physicalStations.has(id)) physicalStations.set(id, station)
      const group = occurrences.get(id) ?? []
      group.push({ line, station })
      occurrences.set(id, group)
    }
  }
  const physicalEntries = [...physicalStations.entries()]

  const sharesTrackAtStation = (
    source: readonly (readonly [number, number])[],
    alongMeters: number,
    totalMeters: number,
    physicalId: string,
  ) => {
    const sampleDistances = [-340, 340]
      .map(delta => alongMeters + delta)
      .filter(distance => distance > 40 && distance < totalMeters - 40)
    if (!sampleDistances.length) return false
    const samples = sampleDistances.map(distance => geoPointAtPolylineDistance(source, geoPolylineCumulative(source), distance))
    for (const occurrence of occurrences.get(physicalId) ?? []) {
      const adjacent = routeSegmentsTouchingStation(occurrence.line, occurrence.station)
      if (!adjacent.length) continue
      let maximum = 0
      for (const sample of samples) {
        let minimum = Number.POSITIVE_INFINITY
        for (const geometry of adjacent) minimum = Math.min(minimum, geoPointPolylineDistanceMeters(sample, geometry))
        maximum = Math.max(maximum, minimum)
      }
      if (maximum <= 82) return true
    }
    return false
  }

  const rawChains: Array<{
    line: GameLine
    kind: 'MAIN' | 'BRANCH'
    branchId: string | null
    stations: GameStation[]
  }> = []
  for (const line of lines) {
    const allStations = getLineAllStations(line)
    const stationById = new Map(allStations.map(station => [station.id, station] as const))
    if (line.stations.length >= 2) rawChains.push({ line, kind: 'MAIN', branchId: null, stations: line.stations })
    for (const branch of getLineBranches(line)) {
      const anchor = stationById.get(branch.fromStationId)
      if (!anchor || !branch.stations.length) continue
      rawChains.push({ line, kind: 'BRANCH', branchId: branch.id, stations: [anchor, ...branch.stations] })
    }
  }

  const chains: ExportSchematicChain[] = []
  for (const rawChain of rawChains) {
    const line = rawChain.line
    // Les points de passage se raisonnent par CHAÎNE, pas par ligne entière.
    // Une station peut être desservie sur une autre branche de la même ligne tout
    // en étant seulement traversée ici (ex. N : Saint-Cyr sur le corridor
    // Versailles -> Montigny). L'exclure au niveau ligne empêchait de découper
    // l'arête au même endroit que la ligne voisine, donc impossible d'obtenir un
    // axe maître réellement commun.
    const chainStopPhysicalIds = new Set(rawChain.stations.map(station => nodeIdFor(line, station)))
    const anchors: ExportSchematicAnchor[] = []
    const edgeGuides: ExportCanvasPoint[][] = []

    const appendAnchor = (anchor: ExportSchematicAnchor, guideFromPrevious?: ExportCanvasPoint[]) => {
      const previous = anchors[anchors.length - 1]
      if (previous && previous.physicalId === anchor.physicalId) {
        // Un vrai arrêt gagne toujours sur un simple point de passage.
        if (!previous.station && anchor.station) previous.station = anchor.station
        return
      }
      if (previous && guideFromPrevious) edgeGuides.push(guideFromPrevious)
      anchors.push(anchor)
    }

    for (let index = 1; index < rawChain.stations.length; index += 1) {
      const fromStation = rawChain.stations[index - 1]!
      const toStation = rawChain.stations[index]!
      if (!anchors.length) {
        appendAnchor({
          physicalId: nodeIdFor(line, fromStation),
          station: fromStation,
          longitude: fromStation.longitude,
          latitude: fromStation.latitude,
        })
      }

      const route = orientedLineRouteSegment(line, fromStation, toStation)
      const cumulative = geoPolylineCumulative(route)
      const totalMeters = cumulative[cumulative.length - 1] ?? 0
      const minLongitude = Math.min(...route.map(point => point[0])) - .001
      const maxLongitude = Math.max(...route.map(point => point[0])) + .001
      const minLatitude = Math.min(...route.map(point => point[1])) - .0007
      const maxLatitude = Math.max(...route.map(point => point[1])) + .0007
      const endpointNames = new Set([normalizedStationName(fromStation.name), normalizedStationName(toStation.name)])
      const candidates: Array<{ physicalId: string; station: GameStation; alongMeters: number }> = []

      if (totalMeters >= 700) {
        for (const [physicalId, station] of physicalEntries) {
          if (chainStopPhysicalIds.has(physicalId)) continue
          if (station.longitude < minLongitude || station.longitude > maxLongitude || station.latitude < minLatitude || station.latitude > maxLatitude) continue
          if (endpointNames.has(normalizedStationName(station.name))) continue
          const nearest = nearestGeoPolylinePosition(station, route)
          if (nearest.distanceMeters > 36) continue
          if (nearest.alongMeters < 120 || nearest.totalMeters - nearest.alongMeters < 120) continue
          if (!sharesTrackAtStation(route, nearest.alongMeters, nearest.totalMeters, physicalId)) continue
          candidates.push({ physicalId, station, alongMeters: nearest.alongMeters })
        }
      }

      candidates.sort((first, second) => first.alongMeters - second.alongMeters)
      let previousDistance = 0
      for (const candidate of candidates) {
        const geometry = sliceGeoPolylineByDistance(route, previousDistance, candidate.alongMeters).map(point => project(point[0], point[1]))
        if (geometry.length) {
          geometry[0] = project(anchors[anchors.length - 1]!.longitude, anchors[anchors.length - 1]!.latitude)
          geometry[geometry.length - 1] = project(candidate.station.longitude, candidate.station.latitude)
        }
        appendAnchor({
          physicalId: candidate.physicalId,
          station: null,
          longitude: candidate.station.longitude,
          latitude: candidate.station.latitude,
        }, geometry)
        previousDistance = candidate.alongMeters
      }

      const finalGeometry = sliceGeoPolylineByDistance(route, previousDistance, totalMeters).map(point => project(point[0], point[1]))
      if (finalGeometry.length) {
        finalGeometry[0] = project(anchors[anchors.length - 1]!.longitude, anchors[anchors.length - 1]!.latitude)
        finalGeometry[finalGeometry.length - 1] = project(toStation.longitude, toStation.latitude)
      }
      appendAnchor({
        physicalId: nodeIdFor(line, toStation),
        station: toStation,
        longitude: toStation.longitude,
        latitude: toStation.latitude,
      }, finalGeometry)
    }

    if (anchors.length >= 2 && edgeGuides.length === anchors.length - 1) {
      chains.push({
        line,
        kind: rawChain.kind,
        branchId: rawChain.branchId,
        anchors,
        edgeGuides,
      })
    }
  }
  return chains
}

function polylineLengths(points: readonly ExportCanvasPoint[]) {
  const cumulative = new Array<number>(points.length).fill(0)
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1]! + exportDistance(points[index - 1]!, points[index]!)
  }
  return cumulative
}

function pointAtPolylineDistance(
  points: readonly ExportCanvasPoint[],
  cumulative: readonly number[],
  targetDistance: number,
) {
  if (!points.length) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0]! }
  const total = cumulative[cumulative.length - 1] ?? 0
  const target = exportClamp(targetDistance, 0, total)
  for (let index = 1; index < points.length; index += 1) {
    const endDistance = cumulative[index]!
    if (target > endDistance && index < points.length - 1) continue
    const startDistance = cumulative[index - 1]!
    const span = Math.max(1e-9, endDistance - startDistance)
    const ratio = exportClamp((target - startDistance) / span, 0, 1)
    const start = points[index - 1]!
    const end = points[index]!
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    }
  }
  return { ...points[points.length - 1]! }
}

function slicePolylineByDistance(
  points: readonly ExportCanvasPoint[],
  startDistance: number,
  endDistance: number,
) {
  if (points.length < 2) return [...points]
  const cumulative = polylineLengths(points)
  const total = cumulative[cumulative.length - 1] ?? 0
  const start = exportClamp(Math.min(startDistance, endDistance), 0, total)
  const end = exportClamp(Math.max(startDistance, endDistance), 0, total)
  const result: ExportCanvasPoint[] = [pointAtPolylineDistance(points, cumulative, start)]
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = cumulative[index]!
    if (distance > start + .01 && distance < end - .01) result.push(points[index]!)
  }
  result.push(pointAtPolylineDistance(points, cumulative, end))
  return result
}

function octilinearConnector(
  start: ExportCanvasPoint,
  end: ExportCanvasPoint,
  preferredMidpoint?: ExportCanvasPoint,
) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  if (distance <= .01) return [start, end]

  const step = Math.PI / 4
  let angle = Math.atan2(dy, dx)
  if (angle < 0) angle += Math.PI * 2
  const nearest = Math.round(angle / step) * step
  const angleDelta = Math.abs(Math.atan2(Math.sin(angle - nearest), Math.cos(angle - nearest)))
  // Un plan de transport assume volontairement sa géométrie : seuls les axes déjà
  // pratiquement octilinéaires restent directs. Les longues diagonales « presque »
  // droites sont converties en un vrai coude 0/45/90°, comme sur un plan imprimé.
  if (angleDelta <= Math.PI / 72) return [start, end]

  const lowerAngle = Math.floor(angle / step) * step
  const upperAngle = lowerAngle + step
  const lower = { x: Math.cos(lowerAngle), y: Math.sin(lowerAngle) }
  const upper = { x: Math.cos(upperAngle), y: Math.sin(upperAngle) }
  const determinant = lower.x * upper.y - lower.y * upper.x
  if (Math.abs(determinant) <= 1e-7) return [start, end]

  const lowerLength = (dx * upper.y - dy * upper.x) / determinant
  const upperLength = (lower.x * dy - lower.y * dx) / determinant
  if (lowerLength <= 1 || upperLength <= 1) return [start, end]

  const bendFromLower = {
    x: start.x + lower.x * lowerLength,
    y: start.y + lower.y * lowerLength,
  }
  const bendFromUpper = {
    x: start.x + upper.x * upperLength,
    y: start.y + upper.y * upperLength,
  }
  const preferred = preferredMidpoint ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const firstScore = exportDistance(bendFromLower, preferred)
  const secondScore = exportDistance(bendFromUpper, preferred)
  const bend = firstScore <= secondScore ? bendFromLower : bendFromUpper

  // Un coude minuscule est visuellement pire qu'une diagonale légèrement libre.
  const minimumLeg = Math.min(26, distance * .18)
  if (exportDistance(start, bend) < minimumLeg || exportDistance(bend, end) < minimumLeg) return [start, end]
  return [start, bend, end]
}

function buildSchematicNetwork(
  lines: readonly GameLine[],
  project: (longitude: number, latitude: number) => ExportCanvasPoint,
  scale: number,
  layout: GameWorldExportLayout,
): ExportSchematicNetwork {
  const stationNodeIds = buildSchematicStationNodeIds(lines)
  const nodeIdFor = (line: GameLine, station: GameStation) =>
    stationNodeIds.get(schematicStationOccurrenceKey(line.id, station.id)) ?? physicalStationId(station)
  const stationByPhysicalId = new Map<string, GameStation>()
  const realStopNodeIds = new Set<string>()
  const branchNodeIds = new Set<string>()
  for (const line of lines) {
    const stations = getLineAllStations(line)
    const byId = new Map(stations.map(station => [station.id, station] as const))
    for (const station of stations) {
      const id = nodeIdFor(line, station)
      realStopNodeIds.add(id)
      if (!stationByPhysicalId.has(id)) stationByPhysicalId.set(id, station)
    }
    for (const branch of getLineBranches(line)) {
      const anchor = byId.get(branch.fromStationId)
      if (anchor) branchNodeIds.add(nodeIdFor(line, anchor))
    }
  }

  const chains = exportLineSchematicChains(lines, project, stationNodeIds)
  const adjacency = new Map<string, Set<string>>()
  const edgeLineIds = new Map<string, Set<string>>()
  const edgeGuides = new Map<string, ExportSchematicEdgeGuide[]>()

  const ensureNode = (id: string) => {
    if (!adjacency.has(id)) adjacency.set(id, new Set())
    return id
  }

  for (const chain of chains) {
    for (const anchor of chain.anchors) ensureNode(anchor.physicalId)
    for (let index = 1; index < chain.anchors.length; index += 1) {
      const firstId = ensureNode(chain.anchors[index - 1]!.physicalId)
      const secondId = ensureNode(chain.anchors[index]!.physicalId)
      if (firstId === secondId) continue
      adjacency.get(firstId)!.add(secondId)
      adjacency.get(secondId)!.add(firstId)
      const key = schematicEdgeKey(firstId, secondId)
      const lineIds = edgeLineIds.get(key) ?? new Set<string>()
      lineIds.add(chain.line.id)
      edgeLineIds.set(key, lineIds)
      const guide = chain.edgeGuides[index - 1]
      if (guide?.length >= 2) {
        const candidates = edgeGuides.get(key) ?? []
        candidates.push({
          lineId: chain.line.id,
          fromPhysicalId: firstId,
          toPhysicalId: secondId,
          points: guide,
        })
        edgeGuides.set(key, candidates)
      }
    }
  }

  const initialPoints = new Map<string, ExportCanvasPoint>()
  for (const [id, station] of stationByPhysicalId) initialPoints.set(id, project(station.longitude, station.latitude))

  const representativeEdgeGuide = (firstId: string, secondId: string) => {
    const key = schematicEdgeKey(firstId, secondId)
    const candidates = edgeGuides.get(key) ?? []
    if (!candidates.length) return [initialPoints.get(firstId)!, initialPoints.get(secondId)!]
    const chosen = [...candidates].sort((first, second) => {
      const firstLength = polylineLengths(first.points)[first.points.length - 1] ?? 0
      const secondLength = polylineLengths(second.points)[second.points.length - 1] ?? 0
      return secondLength - firstLength || second.points.length - first.points.length
    })[0]!
    if (chosen.fromPhysicalId === firstId && chosen.toPhysicalId === secondId) return chosen.points
    return [...chosen.points].reverse()
  }

  if (layout === 'GEOGRAPHIC') {
    const edgeGeometry = new Map<string, ExportSchematicEdgeGeometry>()
    for (const [firstId, neighbors] of adjacency) {
      for (const secondId of neighbors) {
        const key = schematicEdgeKey(firstId, secondId)
        if (edgeGeometry.has(key)) continue
        edgeGeometry.set(key, {
          fromPhysicalId: firstId,
          toPhysicalId: secondId,
          points: representativeEdgeGuide(firstId, secondId),
        })
      }
    }
    return { chains, nodePoints: initialPoints, edgeGeometry, edgeLineIds, stationNodeIds, realStopNodeIds, branchNodeIds }
  }

  // V31 — construction "ligne d'abord".
  //
  // L'ancien moteur regroupait d'abord le réseau en macro-corridors globaux.
  // C'était séduisant visuellement mais trop dangereux topologiquement : une
  // branche pouvait finir par sembler continuer vers une autre ligne (Meaux /
  // Villers-Côtterets), et deux lignes voisines pouvaient se battre autour d'un
  // noeud simplement parce que leurs corridors avaient les mêmes extrémités.
  //
  // Ici, aucune géométrie n'est inventée entre deux noeuds qui ne sont pas
  // réellement consécutifs dans une chaîne de ligne. Chaque chaîne (tronc ou
  // branche) est schématisée séparément, puis les seules arêtes réellement
  // partagées reçoivent un axe maître commun et des voies parallèles.
  const nodeRealLineIds = new Map<string, Set<string>>()
  const chainEndpointIds = new Set<string>()
  for (const chain of chains) {
    if (chain.anchors.length) {
      chainEndpointIds.add(chain.anchors[0]!.physicalId)
      chainEndpointIds.add(chain.anchors[chain.anchors.length - 1]!.physicalId)
    }
    for (const anchor of chain.anchors) {
      if (!anchor.station) continue
      const lineIds = nodeRealLineIds.get(anchor.physicalId) ?? new Set<string>()
      lineIds.add(chain.line.id)
      nodeRealLineIds.set(anchor.physicalId, lineIds)
    }
  }

  const structuralNodeIds = new Set<string>()
  for (const [id, neighbors] of adjacency) {
    if (neighbors.size !== 2) structuralNodeIds.add(id)
  }
  for (const id of branchNodeIds) structuralNodeIds.add(id)
  for (const id of chainEndpointIds) structuralNodeIds.add(id)
  for (const [id, lineIds] of nodeRealLineIds) {
    if (lineIds.size > 1) structuralNodeIds.add(id)
  }

  const edgeSignature = (firstId: string, secondId: string) =>
    [...(edgeLineIds.get(schematicEdgeKey(firstId, secondId)) ?? [])].sort().join('|')

  const guideForChainRange = (
    chain: ExportSchematicChain,
    fromIndex: number,
    toIndex: number,
  ) => {
    const points: ExportCanvasPoint[] = []
    for (let edgeIndex = fromIndex; edgeIndex < toIndex; edgeIndex += 1) {
      const guide = chain.edgeGuides[edgeIndex] ?? []
      for (const point of guide) {
        const previous = points[points.length - 1]
        if (!previous || exportDistance(previous, point) > .25) points.push(point)
      }
    }
    const startId = chain.anchors[fromIndex]!.physicalId
    const endId = chain.anchors[toIndex]!.physicalId
    const startPoint = initialPoints.get(startId)
    const endPoint = initialPoints.get(endId)
    if (startPoint) {
      if (!points.length) points.push(startPoint)
      else points[0] = startPoint
    }
    if (endPoint) {
      if (!points.length) points.push(endPoint)
      else if (points.length === 1) points.push(endPoint)
      else points[points.length - 1] = endPoint
    }
    return points.length >= 2 ? points : [startPoint!, endPoint!]
  }

  const sectionTurnAngle = (chain: ExportSchematicChain, index: number) => {
    if (index <= 0 || index >= chain.anchors.length - 1) return 0
    const previousGuide = chain.edgeGuides[index - 1]
    const nextGuide = chain.edgeGuides[index]
    if (!previousGuide?.length || !nextGuide?.length) return 0
    const center = initialPoints.get(chain.anchors[index]!.physicalId)
    if (!center) return 0
    const previousProbe = previousGuide[Math.max(0, previousGuide.length - 2)] ?? previousGuide[0]!
    const nextProbe = nextGuide[Math.min(1, nextGuide.length - 1)] ?? nextGuide[nextGuide.length - 1]!
    const incoming = normalizedCanvasVector(center.x - previousProbe.x, center.y - previousProbe.y)
    const outgoing = normalizedCanvasVector(nextProbe.x - center.x, nextProbe.y - center.y)
    const dot = exportClamp(incoming.x * outgoing.x + incoming.y * outgoing.y, -1, 1)
    return Math.acos(dot)
  }

  const editorialSectionPath = (
    guide: readonly ExportCanvasPoint[],
    startPoint: ExportCanvasPoint,
    endPoint: ExportCanvasPoint,
  ) => {
    if (guide.length < 2) return [startPoint, endPoint]
    const chord = Math.max(1, exportDistance(startPoint, endPoint))
    const tolerance = Math.max(13 * scale, Math.min(34 * scale, chord * .055))
    const macro = macroCanvasPolyline(guide, tolerance, 5)
    const guideLengths = polylineLengths(guide)
    const guideTotal = Math.max(1, guideLengths[guideLengths.length - 1] ?? chord)

    let farthest: ExportCanvasPoint | null = null
    let farthestDistance = -1
    for (const point of macro.slice(1, -1)) {
      const distance = canvasPointSegmentDistance(point, startPoint, endPoint)
      if (distance > farthestDistance) {
        farthestDistance = distance
        farthest = point
      }
    }

    // Un seul grand geste suffit dans la majorité des cas. Quand la vraie voie
    // fait un détour réellement structurant, on conserve UN point de guidage
    // supplémentaire. On ne copie jamais ses micro-zigzags.
    if (!farthest || farthestDistance < Math.max(34 * scale, chord * .12)) {
      const preferred = pointAtPolylineDistance(guide, guideLengths, guideTotal / 2)
      return cleanEditorialPolyline(
        octilinearConnector(startPoint, endPoint, preferred),
        2.8 * scale,
      )
    }

    const firstGuide = pointAtPolylineDistance(guide, guideLengths, guideTotal * .34)
    const secondGuide = pointAtPolylineDistance(guide, guideLengths, guideTotal * .66)
    const pivot = farthestDistance > Math.max(96 * scale, chord * .28)
      ? {
          x: (farthest.x * 1.25 + (firstGuide.x + secondGuide.x) * .375) / 2,
          y: (farthest.y * 1.25 + (firstGuide.y + secondGuide.y) * .375) / 2,
        }
      : farthest
    const first = octilinearConnector(startPoint, pivot, firstGuide)
    const second = octilinearConnector(pivot, endPoint, secondGuide)
    return cleanEditorialPolyline(
      [...first, ...second.slice(1)],
      2.8 * scale,
    )
  }

  type EdgeProposal = {
    lineId: string
    points: ExportCanvasPoint[]
    guideLength: number
  }
  const nodeProposals = new Map<string, ExportCanvasPoint[]>()
  const edgeProposals = new Map<string, EdgeProposal[]>()

  const addNodeProposal = (id: string, point: ExportCanvasPoint) => {
    const values = nodeProposals.get(id) ?? []
    values.push(point)
    nodeProposals.set(id, values)
  }

  const addEdgeProposal = (
    lineId: string,
    firstId: string,
    secondId: string,
    points: ExportCanvasPoint[],
    guideLength: number,
  ) => {
    const key = schematicEdgeKey(firstId, secondId)
    const values = edgeProposals.get(key) ?? []
    values.push({ lineId, points, guideLength })
    edgeProposals.set(key, values)
  }

  for (const chain of chains) {
    if (chain.anchors.length < 2) continue
    const cuts = new Set<number>([0, chain.anchors.length - 1])

    for (let index = 1; index < chain.anchors.length - 1; index += 1) {
      const id = chain.anchors[index]!.physicalId
      const previousId = chain.anchors[index - 1]!.physicalId
      const nextId = chain.anchors[index + 1]!.physicalId
      const previousSignature = edgeSignature(previousId, id)
      const nextSignature = edgeSignature(id, nextId)
      if (structuralNodeIds.has(id)
        || previousSignature !== nextSignature
        || sectionTurnAngle(chain, index) >= Math.PI / 5.6) {
        cuts.add(index)
      }
    }

    // Même une très longue section rectiligne est découpée tous les 5 intervalles.
    // Le découpage se fait de préférence sur un vrai arrêt. Cela conserve les
    // gares intermédiaires comme points de lecture (Beynes, Brétigny, Malesherbes…)
    // sans réintroduire les petits zigzags géographiques.
    let orderedCuts = [...cuts].sort((a, b) => a - b)
    for (let sectionIndex = 1; sectionIndex < orderedCuts.length; sectionIndex += 1) {
      let fromIndex = orderedCuts[sectionIndex - 1]!
      const toIndex = orderedCuts[sectionIndex]!
      while (toIndex - fromIndex > 5) {
        const ideal = Math.min(toIndex - 1, fromIndex + 5)
        let chosen = ideal
        for (let radius = 0; radius <= 2; radius += 1) {
          const candidates = [ideal - radius, ideal + radius]
          const real = candidates.find(candidate =>
            candidate > fromIndex
            && candidate < toIndex
            && Boolean(chain.anchors[candidate]?.station))
          if (real !== undefined) {
            chosen = real
            break
          }
        }
        cuts.add(chosen)
        fromIndex = chosen
      }
      orderedCuts = [...cuts].sort((a, b) => a - b)
    }

    orderedCuts = [...cuts].sort((a, b) => a - b)
    for (let sectionIndex = 1; sectionIndex < orderedCuts.length; sectionIndex += 1) {
      const fromIndex = orderedCuts[sectionIndex - 1]!
      const toIndex = orderedCuts[sectionIndex]!
      if (toIndex <= fromIndex) continue

      const startId = chain.anchors[fromIndex]!.physicalId
      const endId = chain.anchors[toIndex]!.physicalId
      const startPoint = initialPoints.get(startId)
      const endPoint = initialPoints.get(endId)
      if (!startPoint || !endPoint) continue

      const guide = guideForChainRange(chain, fromIndex, toIndex)
      const clean = editorialSectionPath(guide, startPoint, endPoint)
      const cleanLengths = polylineLengths(clean)
      const cleanTotal = Math.max(1e-6, cleanLengths[cleanLengths.length - 1] ?? 0)

      const rawCumulative = new Array<number>(toIndex - fromIndex + 1).fill(0)
      let rawTotal = 0
      for (let localIndex = 1; localIndex < rawCumulative.length; localIndex += 1) {
        const edgeGuide = chain.edgeGuides[fromIndex + localIndex - 1] ?? []
        const edgeLength = edgeGuide.length >= 2
          ? polylineLengths(edgeGuide)[edgeGuide.length - 1] ?? 0
          : exportDistance(
              initialPoints.get(chain.anchors[fromIndex + localIndex - 1]!.physicalId)!,
              initialPoints.get(chain.anchors[fromIndex + localIndex]!.physicalId)!,
            )
        rawTotal += Math.max(1, edgeLength)
        rawCumulative[localIndex] = rawTotal
      }

      const intervalCount = Math.max(1, rawCumulative.length - 1)
      const fractions = rawCumulative.map((distance, localIndex) => {
        const equal = localIndex / intervalCount
        const geographic = rawTotal > .01 ? distance / rawTotal : equal
        return equal * .34 + geographic * .66
      })
      fractions[0] = 0
      fractions[fractions.length - 1] = 1
      const minimumGap = Math.min(.092, .80 / intervalCount)
      for (let localIndex = 1; localIndex < fractions.length - 1; localIndex += 1) {
        fractions[localIndex] = Math.max(fractions[localIndex]!, fractions[localIndex - 1]! + minimumGap)
      }
      for (let localIndex = fractions.length - 2; localIndex > 0; localIndex -= 1) {
        fractions[localIndex] = Math.min(fractions[localIndex]!, fractions[localIndex + 1]! - minimumGap)
      }

      const distances = fractions.map(fraction => exportClamp(fraction, 0, 1) * cleanTotal)
      for (let localIndex = 0; localIndex < distances.length; localIndex += 1) {
        const anchorIndex = fromIndex + localIndex
        const id = chain.anchors[anchorIndex]!.physicalId
        addNodeProposal(id, pointAtPolylineDistance(clean, cleanLengths, distances[localIndex]!))
      }

      for (let localIndex = 1; localIndex < distances.length; localIndex += 1) {
        const firstIndex = fromIndex + localIndex - 1
        const secondIndex = fromIndex + localIndex
        const firstId = chain.anchors[firstIndex]!.physicalId
        const secondId = chain.anchors[secondIndex]!.physicalId
        const guideForEdge = chain.edgeGuides[firstIndex] ?? []
        const guideLength = guideForEdge.length >= 2
          ? polylineLengths(guideForEdge)[guideForEdge.length - 1] ?? 0
          : 0
        addEdgeProposal(
          chain.line.id,
          firstId,
          secondId,
          slicePolylineByDistance(clean, distances[localIndex - 1]!, distances[localIndex]!),
          guideLength,
        )
      }
    }
  }

  const nodePoints = new Map(initialPoints)
  for (const [id, proposals] of nodeProposals) {
    if (!proposals.length || structuralNodeIds.has(id)) continue
    nodePoints.set(id, {
      x: proposals.reduce((sum, point) => sum + point.x, 0) / proposals.length,
      y: proposals.reduce((sum, point) => sum + point.y, 0) / proposals.length,
    })
  }

  const reanchorPolyline = (
    points: readonly ExportCanvasPoint[],
    startPoint: ExportCanvasPoint,
    endPoint: ExportCanvasPoint,
  ) => {
    if (points.length < 2) return [startPoint, endPoint]
    const cumulative = polylineLengths(points)
    const total = Math.max(1e-6, cumulative[cumulative.length - 1] ?? 0)
    const first = points[0]!
    const last = points[points.length - 1]!
    const startDx = startPoint.x - first.x
    const startDy = startPoint.y - first.y
    const endDx = endPoint.x - last.x
    const endDy = endPoint.y - last.y
    const adjusted = points.map((point, index) => {
      const fraction = (cumulative[index] ?? 0) / total
      return {
        x: point.x + startDx * (1 - fraction) + endDx * fraction,
        y: point.y + startDy * (1 - fraction) + endDy * fraction,
      }
    })
    adjusted[0] = startPoint
    adjusted[adjusted.length - 1] = endPoint
    return cleanEditorialPolyline(adjusted, 1.3 * scale)
  }

  const edgeGeometry = new Map<string, ExportSchematicEdgeGeometry>()
  for (const [firstId, neighbors] of adjacency) {
    for (const secondId of neighbors) {
      const key = schematicEdgeKey(firstId, secondId)
      if (edgeGeometry.has(key)) continue
      const startPoint = nodePoints.get(firstId) ?? initialPoints.get(firstId)
      const endPoint = nodePoints.get(secondId) ?? initialPoints.get(secondId)
      if (!startPoint || !endPoint) continue

      const proposals = edgeProposals.get(key) ?? []
      let chosen: EdgeProposal | null = null
      if (proposals.length) {
        const allowedLineIds = edgeLineIds.get(key) ?? new Set<string>()
        chosen = [...proposals]
          .filter(proposal => allowedLineIds.has(proposal.lineId))
          .sort((first, second) =>
            second.guideLength - first.guideLength
            || second.points.length - first.points.length)[0] ?? null
      }

      let points: ExportCanvasPoint[]
      if (chosen?.points.length) {
        const direct = chosen.points
        // Les propositions sont orientées selon la chaîne ; on choisit le sens
        // dont le premier point est le plus proche de `firstId`.
        const oriented = exportDistance(direct[0]!, startPoint) <= exportDistance(direct[direct.length - 1]!, startPoint)
          ? direct
          : [...direct].reverse()
        points = reanchorPolyline(oriented, startPoint, endPoint)
      }
      else {
        const guide = representativeEdgeGuide(firstId, secondId)
        const guideLengths = polylineLengths(guide)
        const guideMiddle = pointAtPolylineDistance(guide, guideLengths, (guideLengths[guideLengths.length - 1] ?? 0) / 2)
        points = cleanEditorialPolyline(
          octilinearConnector(startPoint, endPoint, guideMiddle),
          1.3 * scale,
        )
      }

      edgeGeometry.set(key, {
        fromPhysicalId: firstId,
        toPhysicalId: secondId,
        points,
      })
    }
  }

  // Bifurcations d'une même ligne : la branche doit être identifiable comme un
  // vrai Y. Si son premier tronçon repart presque dans l'axe du tronc, on crée
  // une petite épaule éditoriale du côté réel de la branche. Le noeud lui-même
  // reste commun, donc aucune fausse connexion n'est créée.
  for (const chain of chains) {
    if (chain.kind !== 'BRANCH' || chain.anchors.length < 2) continue
    const anchorId = chain.anchors[0]!.physicalId
    const nextId = chain.anchors[1]!.physicalId
    const branchKey = schematicEdgeKey(anchorId, nextId)
    const branchEdge = edgeGeometry.get(branchKey)
    const anchorPoint = nodePoints.get(anchorId)
    if (!branchEdge || !anchorPoint) continue
    // Une première arête déjà partagée avec une autre ligne appartient à un
    // faisceau réel : son axe maître ne doit jamais être tordu par l'effet Y.
    if ((edgeLineIds.get(branchKey)?.size ?? 1) > 1) continue

    const branchPoints = orientedSchematicEdge(branchEdge, anchorId, nextId)
    if (branchPoints.length < 2) continue
    const branchDirection = normalizedCanvasVector(
      branchPoints[Math.min(1, branchPoints.length - 1)]!.x - anchorPoint.x,
      branchPoints[Math.min(1, branchPoints.length - 1)]!.y - anchorPoint.y,
    )

    const trunkDirections: ExportCanvasPoint[] = []
    for (const otherChain of chains) {
      if (otherChain.line.id !== chain.line.id || otherChain.kind !== 'MAIN') continue
      for (let index = 1; index < otherChain.anchors.length; index += 1) {
        const firstId = otherChain.anchors[index - 1]!.physicalId
        const secondId = otherChain.anchors[index]!.physicalId
        if (firstId !== anchorId && secondId !== anchorId) continue
        const edge = edgeGeometry.get(schematicEdgeKey(firstId, secondId))
        if (!edge) continue
        const otherId = firstId === anchorId ? secondId : firstId
        const oriented = orientedSchematicEdge(edge, anchorId, otherId)
        if (oriented.length < 2) continue
        trunkDirections.push(normalizedCanvasVector(
          oriented[Math.min(1, oriented.length - 1)]!.x - anchorPoint.x,
          oriented[Math.min(1, oriented.length - 1)]!.y - anchorPoint.y,
        ))
      }
    }
    if (!trunkDirections.length) continue

    let closest = trunkDirections[0]!
    let closestDot = Math.abs(branchDirection.x * closest.x + branchDirection.y * closest.y)
    for (const direction of trunkDirections.slice(1)) {
      const dot = Math.abs(branchDirection.x * direction.x + branchDirection.y * direction.y)
      if (dot > closestDot) {
        closest = direction
        closestDot = dot
      }
    }
    if (closestDot < .86) continue

    const normal = { x: closest.y, y: -closest.x }
    const nextPoint = nodePoints.get(nextId) ?? branchPoints[branchPoints.length - 1]!
    const side = (nextPoint.x - anchorPoint.x) * normal.x + (nextPoint.y - anchorPoint.y) * normal.y
    const sign = Math.abs(side) > 1 ? Math.sign(side) : 1
    const shoulderDistance = Math.min(
      30 * scale,
      Math.max(16 * scale, exportDistance(anchorPoint, nextPoint) * .22),
    )
    const lateral = 13.5 * scale * sign
    const shoulder = {
      x: anchorPoint.x + branchDirection.x * shoulderDistance + normal.x * lateral,
      y: anchorPoint.y + branchDirection.y * shoulderDistance + normal.y * lateral,
    }

    const oriented = cleanEditorialPolyline(
      [anchorPoint, shoulder, ...branchPoints.slice(1)],
      1.2 * scale,
    )
    edgeGeometry.set(branchKey, branchEdge.fromPhysicalId === anchorId
      ? { ...branchEdge, points: oriented }
      : { ...branchEdge, points: [...oriented].reverse() })
  }

  return { chains, nodePoints, edgeGeometry, edgeLineIds, stationNodeIds, realStopNodeIds, branchNodeIds }
}

function orientedSchematicEdge(
  edge: ExportSchematicEdgeGeometry,
  fromPhysicalId: string,
  toPhysicalId: string,
) {
  if (edge.fromPhysicalId === fromPhysicalId && edge.toPhysicalId === toPhysicalId) return edge.points
  return [...edge.points].reverse()
}

function canvasLineIntersection(
  firstA: ExportCanvasPoint,
  firstB: ExportCanvasPoint,
  secondA: ExportCanvasPoint,
  secondB: ExportCanvasPoint,
) {
  const firstDx = firstB.x - firstA.x
  const firstDy = firstB.y - firstA.y
  const secondDx = secondB.x - secondA.x
  const secondDy = secondB.y - secondA.y
  const determinant = firstDx * secondDy - firstDy * secondDx
  if (Math.abs(determinant) <= 1e-7) return null
  const deltaX = secondA.x - firstA.x
  const deltaY = secondA.y - firstA.y
  const ratio = (deltaX * secondDy - deltaY * secondDx) / determinant
  return {
    x: firstA.x + firstDx * ratio,
    y: firstA.y + firstDy * ratio,
  }
}

/**
 * Décale une polyligne avec de vrais raccords en onglet.
 *
 * L'ancienne version décalait chaque sommet avec la normale moyenne locale. Sur
 * un coude de 45/90°, deux lignes d'un même faisceau pouvaient donc se rapprocher,
 * s'écarter ou même sembler se croiser. Ici chaque segment est d'abord parallèle
 * à l'axe maître puis les segments voisins sont intersectés : toutes les voies
 * gardent exactement le même dessin et le même écart dans les virages.
 */
function variableOffsetCanvasPolyline(
  points: readonly ExportCanvasPoint[],
  startOffset: number,
  endOffset: number,
) {
  if (points.length < 2 || (Math.abs(startOffset) < .001 && Math.abs(endOffset) < .001)) return [...points]
  const cumulative = polylineLengths(points)
  const total = Math.max(1e-6, cumulative[cumulative.length - 1] ?? 0)
  const offsets = points.map((_, index) => {
    const fraction = (cumulative[index] ?? 0) / total
    return startOffset + (endOffset - startOffset) * fraction
  })

  type OffsetSegment = { start: ExportCanvasPoint; end: ExportCanvasPoint }
  const segments: OffsetSegment[] = []
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const direction = normalizedCanvasVector(end.x - start.x, end.y - start.y)
    const normal = { x: direction.y, y: -direction.x }
    segments.push({
      start: {
        x: start.x + normal.x * offsets[index - 1]!,
        y: start.y + normal.y * offsets[index - 1]!,
      },
      end: {
        x: end.x + normal.x * offsets[index]!,
        y: end.y + normal.y * offsets[index]!,
      },
    })
  }
  if (!segments.length) return [...points]

  const result: ExportCanvasPoint[] = [segments[0]!.start]
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = segments[index - 1]!
    const next = segments[index]!
    const intersection = canvasLineIntersection(previous.start, previous.end, next.start, next.end)
    if (!intersection) {
      result.push({
        x: (previous.end.x + next.start.x) / 2,
        y: (previous.end.y + next.start.y) / 2,
      })
      continue
    }

    // Un angle très aigu peut théoriquement créer un onglet gigantesque. Les
    // plans CLU sont octilinéaires, mais on garde un plafond défensif propre.
    const vertex = points[index]!
    const magnitude = Math.max(Math.abs(offsets[index]!), 1)
    const miterLimit = Math.max(24, magnitude * 4.25)
    if (exportDistance(vertex, intersection) > miterLimit) {
      result.push({
        x: (previous.end.x + next.start.x) / 2,
        y: (previous.end.y + next.start.y) / 2,
      })
    }
    else result.push(intersection)
  }
  result.push(segments[segments.length - 1]!.end)
  return cleanEditorialPolyline(result, .35)
}


interface ExportSchematicLanePlan {
  edgeOffsets: Map<string, Map<string, number>>
  edgeOrientation: Map<string, { fromPhysicalId: string; toPhysicalId: string }>
}

function setsShareValue(first: ReadonlySet<string>, second: ReadonlySet<string>) {
  for (const value of first) if (second.has(value)) return true
  return false
}

/**
 * Attribue des voies fixes à toute une nappe de corridors partagés.
 *
 * Contrairement à l'ancien export, une voie n'est jamais recentrée à chaque
 * station. Si une ligne quitte le faisceau, son emplacement reste vide sur les
 * tronçons suivants : aucun câble ne traverse donc ses voisins pour "récupérer"
 * le centre. L'ordre tient aussi compte du côté vers lequel chaque ligne repart.
 */
function buildSchematicLanePlan(
  schematic: ExportSchematicNetwork,
  lines: readonly GameLine[],
  scale: number,
): ExportSchematicLanePlan {
  const edgeOffsets = new Map<string, Map<string, number>>()
  const edgeOrientation = new Map<string, { fromPhysicalId: string; toPhysicalId: string }>()
  const sharedEdgeKeys = [...schematic.edgeLineIds.entries()]
    .filter(([, lineIds]) => lineIds.size > 1)
    .map(([key]) => key)
  if (!sharedEdgeKeys.length) return { edgeOffsets, edgeOrientation }

  const sharedIndex = new Map(sharedEdgeKeys.map((key, index) => [key, index] as const))
  const parent = sharedEdgeKeys.map((_, index) => index)
  const find = (index: number): number => {
    let current = index
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!
      current = parent[current]!
    }
    return current
  }
  const unite = (first: number, second: number) => {
    const a = find(first)
    const b = find(second)
    if (a !== b) parent[b] = a
  }

  const keysByNode = new Map<string, string[]>()
  for (const key of sharedEdgeKeys) {
    const edge = schematic.edgeGeometry.get(key)
    if (!edge) continue
    for (const nodeId of [edge.fromPhysicalId, edge.toPhysicalId]) {
      const list = keysByNode.get(nodeId) ?? []
      list.push(key)
      keysByNode.set(nodeId, list)
    }
  }

  // Deux corridors appartiennent à la même nappe s'ils se touchent à une gare
  // ET transportent au moins une même ligne. Un simple croisement géométrique ne
  // les fusionne jamais.
  for (const keys of keysByNode.values()) {
    for (let firstIndex = 0; firstIndex < keys.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < keys.length; secondIndex += 1) {
        const firstKey = keys[firstIndex]!
        const secondKey = keys[secondIndex]!
        const firstLines = schematic.edgeLineIds.get(firstKey) ?? new Set<string>()
        const secondLines = schematic.edgeLineIds.get(secondKey) ?? new Set<string>()
        if (!setsShareValue(firstLines, secondLines)) continue
        unite(sharedIndex.get(firstKey)!, sharedIndex.get(secondKey)!)
      }
    }
  }

  const components = new Map<number, string[]>()
  sharedEdgeKeys.forEach((key, index) => {
    const root = find(index)
    const list = components.get(root) ?? []
    list.push(key)
    components.set(root, list)
  })

  const lineById = new Map(lines.map(line => [line.id, line] as const))
  const lineSortKey = (lineId: string) => {
    const line = lineById.get(lineId)
    return `${String(line?.shortCode ?? '').padStart(4, '0')}|${lineId}`
  }

  for (const componentKeys of components.values()) {
    const componentSet = new Set(componentKeys)
    const componentLineIds = new Set<string>()
    const componentNodes = new Set<string>()
    for (const key of componentKeys) {
      for (const lineId of schematic.edgeLineIds.get(key) ?? []) componentLineIds.add(lineId)
      const edge = schematic.edgeGeometry.get(key)
      if (edge) {
        componentNodes.add(edge.fromPhysicalId)
        componentNodes.add(edge.toPhysicalId)
      }
    }
    if (componentLineIds.size < 2) continue

    const rootKey = [...componentKeys].sort((firstKey, secondKey) => {
      const firstCount = schematic.edgeLineIds.get(firstKey)?.size ?? 0
      const secondCount = schematic.edgeLineIds.get(secondKey)?.size ?? 0
      if (firstCount !== secondCount) return secondCount - firstCount
      const firstEdge = schematic.edgeGeometry.get(firstKey)
      const secondEdge = schematic.edgeGeometry.get(secondKey)
      const firstLength = firstEdge ? polylineLengths(firstEdge.points)[firstEdge.points.length - 1] ?? 0 : 0
      const secondLength = secondEdge ? polylineLengths(secondEdge.points)[secondEdge.points.length - 1] ?? 0 : 0
      return secondLength - firstLength
    })[0]!
    const rootEdge = schematic.edgeGeometry.get(rootKey)
    if (!rootEdge) continue

    const rootA = schematic.nodePoints.get(rootEdge.fromPhysicalId) ?? rootEdge.points[0]!
    const rootB = schematic.nodePoints.get(rootEdge.toPhysicalId) ?? rootEdge.points[rootEdge.points.length - 1]!
    const rootDx = rootB.x - rootA.x
    const rootDy = rootB.y - rootA.y
    const rootForward = Math.abs(rootDx) >= Math.abs(rootDy) ? rootDx >= 0 : rootDy >= 0
    edgeOrientation.set(rootKey, rootForward
      ? { fromPhysicalId: rootEdge.fromPhysicalId, toPhysicalId: rootEdge.toPhysicalId }
      : { fromPhysicalId: rootEdge.toPhysicalId, toPhysicalId: rootEdge.fromPhysicalId })

    // Propage une orientation continue dans toute la nappe. Le signe de l'offset
    // reste ainsi cohérent lorsque le faisceau tourne de 45° ou 90°.
    const queue = [rootKey]
    while (queue.length) {
      const currentKey = queue.shift()!
      const current = edgeOrientation.get(currentKey)!
      for (const sharedNode of [current.fromPhysicalId, current.toPhysicalId]) {
        for (const neighborKey of keysByNode.get(sharedNode) ?? []) {
          if (!componentSet.has(neighborKey) || edgeOrientation.has(neighborKey)) continue
          const neighbor = schematic.edgeGeometry.get(neighborKey)
          if (!neighbor) continue
          const otherNode = neighbor.fromPhysicalId === sharedNode
            ? neighbor.toPhysicalId
            : neighbor.toPhysicalId === sharedNode
              ? neighbor.fromPhysicalId
              : null
          if (!otherNode) continue
          edgeOrientation.set(neighborKey, sharedNode === current.toPhysicalId
            ? { fromPhysicalId: sharedNode, toPhysicalId: otherNode }
            : { fromPhysicalId: otherNode, toPhysicalId: sharedNode })
          queue.push(neighborKey)
        }
      }
    }

    for (const key of componentKeys) {
      if (edgeOrientation.has(key)) continue
      const edge = schematic.edgeGeometry.get(key)
      if (!edge) continue
      const first = schematic.nodePoints.get(edge.fromPhysicalId) ?? edge.points[0]!
      const second = schematic.nodePoints.get(edge.toPhysicalId) ?? edge.points[edge.points.length - 1]!
      const dx = second.x - first.x
      const dy = second.y - first.y
      const forward = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 : dy >= 0
      edgeOrientation.set(key, forward
        ? { fromPhysicalId: edge.fromPhysicalId, toPhysicalId: edge.toPhysicalId }
        : { fromPhysicalId: edge.toPhysicalId, toPhysicalId: edge.fromPhysicalId })
    }

    const rootOrientation = edgeOrientation.get(rootKey)!
    const rootStart = schematic.nodePoints.get(rootOrientation.fromPhysicalId) ?? rootA
    const rootEnd = schematic.nodePoints.get(rootOrientation.toPhysicalId) ?? rootB
    const rootDirection = normalizedCanvasVector(rootEnd.x - rootStart.x, rootEnd.y - rootStart.y)
    const rootNormal = { x: rootDirection.y, y: -rootDirection.x }
    const rootMiddle = { x: (rootStart.x + rootEnd.x) / 2, y: (rootStart.y + rootEnd.y) / 2 }

    const sideScore = (lineId: string) => {
      const exitScores: number[] = []
      const fallbackScores: number[] = []
      for (const chain of schematic.chains) {
        if (chain.line.id !== lineId) continue
        for (const anchor of chain.anchors) {
          const point = schematic.nodePoints.get(anchor.physicalId)
          if (point) fallbackScores.push((point.x - rootMiddle.x) * rootNormal.x + (point.y - rootMiddle.y) * rootNormal.y)
        }
        for (let index = 1; index < chain.anchors.length; index += 1) {
          const firstId = chain.anchors[index - 1]!.physicalId
          const secondId = chain.anchors[index]!.physicalId
          const key = schematicEdgeKey(firstId, secondId)
          if (componentSet.has(key)) continue
          const firstInside = componentNodes.has(firstId)
          const secondInside = componentNodes.has(secondId)
          if (firstInside === secondInside) continue
          const boundaryId = firstInside ? firstId : secondId
          const outsideId = firstInside ? secondId : firstId
          const boundary = schematic.nodePoints.get(boundaryId)
          const outside = schematic.nodePoints.get(outsideId)
          if (!boundary || !outside) continue
          const direction = normalizedCanvasVector(outside.x - boundary.x, outside.y - boundary.y)
          exitScores.push(direction.x * rootNormal.x + direction.y * rootNormal.y)
        }
      }
      if (exitScores.length) return exitScores.reduce((sum, value) => sum + value, 0) / exitScores.length * 1000
      return fallbackScores.length ? medianNumber(fallbackScores) : 0
    }

    const orderedLineIds = [...componentLineIds].sort((firstId, secondId) => {
      const delta = sideScore(firstId) - sideScore(secondId)
      return Math.abs(delta) > .001 ? delta : lineSortKey(firstId).localeCompare(lineSortKey(secondId), 'fr-FR', { numeric: true })
    })
    const maxLineWidth = Math.max(...orderedLineIds.map((lineId) => {
      const line = lineById.get(lineId)
      if (!line) return 2.05 * scale
      return Math.max(2.05 * scale, getTransportModeDefinition(line.mode).mapLineWidth * .52 * scale)
    }))
    const lanePitch = Math.max(14.2 * scale, maxLineWidth + 7.4 * scale)
    const center = (orderedLineIds.length - 1) / 2
    const componentOffsets = new Map(orderedLineIds.map((lineId, index) => [lineId, (index - center) * lanePitch] as const))

    for (const key of componentKeys) {
      const offsets = new Map<string, number>()
      for (const lineId of schematic.edgeLineIds.get(key) ?? []) {
        offsets.set(lineId, componentOffsets.get(lineId) ?? 0)
      }
      edgeOffsets.set(key, offsets)
    }
  }

  return { edgeOffsets, edgeOrientation }
}

function offsetCanvasPolylineEndpoint(
  points: readonly ExportCanvasPoint[],
  atStart: boolean,
  offset: number,
) {
  if (!points.length || Math.abs(offset) < .001) return points[atStart ? 0 : points.length - 1] ?? { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  const point = points[atStart ? 0 : points.length - 1]!
  const other = points[atStart ? 1 : points.length - 2]!
  const direction = atStart
    ? normalizedCanvasVector(other.x - point.x, other.y - point.y)
    : normalizedCanvasVector(point.x - other.x, point.y - other.y)
  const normal = { x: direction.y, y: -direction.x }
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset }
}

function closestSignedOffset(
  points: readonly ExportCanvasPoint[],
  atStart: boolean,
  magnitude: number,
  target: ExportCanvasPoint,
) {
  if (magnitude < .01) return 0
  const positive = offsetCanvasPolylineEndpoint(points, atStart, magnitude)
  const negative = offsetCanvasPolylineEndpoint(points, atStart, -magnitude)
  return exportDistance(positive, target) <= exportDistance(negative, target) ? magnitude : -magnitude
}


function drawWarpedBasemap(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  warpX: (value: number) => number,
  warpY: (value: number) => number,
  sourceWindow: { u0: number; v0: number; u1: number; v1: number } = { u0: 0, v0: 0, u1: 1, v1: 1 },
) {
  // Maillage volontairement léger : 896 drawImage filtrés sur un grand canvas
  // pouvaient saturer le compositeur de certains navigateurs. 12×10 suffit pour
  // un fond discret derrière un plan schématique.
  const columns = 12
  const rows = 10
  for (let row = 0; row < rows; row += 1) {
    const sourceV0 = row / rows
    const sourceV1 = (row + 1) / rows
    const worldV0 = sourceWindow.v0 + sourceV0 * (sourceWindow.v1 - sourceWindow.v0)
    const worldV1 = sourceWindow.v0 + sourceV1 * (sourceWindow.v1 - sourceWindow.v0)
    const destinationV0 = warpY(worldV0)
    const destinationV1 = warpY(worldV1)
    for (let column = 0; column < columns; column += 1) {
      const sourceU0 = column / columns
      const sourceU1 = (column + 1) / columns
      const worldU0 = sourceWindow.u0 + sourceU0 * (sourceWindow.u1 - sourceWindow.u0)
      const worldU1 = sourceWindow.u0 + sourceU1 * (sourceWindow.u1 - sourceWindow.u0)
      const destinationU0 = warpX(worldU0)
      const destinationU1 = warpX(worldU1)
      const sourceX = sourceU0 * image.width
      const sourceY = sourceV0 * image.height
      const sourceWidth = (sourceU1 - sourceU0) * image.width
      const sourceHeight = (sourceV1 - sourceV0) * image.height
      const destinationX = x + destinationU0 * width
      const destinationY = y + destinationV0 * height
      const destinationWidth = (destinationU1 - destinationU0) * width
      const destinationHeight = (destinationV1 - destinationV0) * height
      if (destinationWidth <= .1 || destinationHeight <= .1) continue
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth + .5,
        sourceHeight + .5,
        destinationX,
        destinationY,
        destinationWidth + 1,
        destinationHeight + 1,
      )
    }
  }
}

function municipalityPolygonRings(municipality: GameMunicipality) {
  if (municipality.geometry.type === 'Polygon') return [municipality.geometry.coordinates]
  return municipality.geometry.coordinates
}

function municipalityShade(departmentCode: string) {
  let hash = 0
  for (let index = 0; index < departmentCode.length; index += 1) hash = (hash * 31 + departmentCode.charCodeAt(index)) >>> 0
  const alpha = .11 + (hash % 5) * .012
  return `rgba(106,129,139,${alpha.toFixed(3)})`
}

function drawMunicipalityBackground(
  ctx: CanvasRenderingContext2D,
  municipalities: readonly GameMunicipality[],
  project: (longitude: number, latitude: number) => ExportCanvasPoint,
  scale: number,
) {
  if (!municipalities.length) return
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const municipality of municipalities) {
    const polygons = municipalityPolygonRings(municipality)
    ctx.beginPath()
    let hasPath = false
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (ring.length < 3) continue
        const openRing = ring.length > 3
          && ring[0]![0] === ring[ring.length - 1]![0]
          && ring[0]![1] === ring[ring.length - 1]![1]
          ? ring.slice(0, -1)
          : ring
        const projected = simplifyCanvasPolyline(
          openRing.map(([longitude, latitude]) => project(longitude, latitude)),
          1.25 * scale,
        )
        if (projected.length < 3) continue
        ctx.moveTo(projected[0]!.x, projected[0]!.y)
        for (let index = 1; index < projected.length; index += 1) ctx.lineTo(projected[index]!.x, projected[index]!.y)
        ctx.closePath()
        hasPath = true
      }
    }
    if (!hasPath) continue
    ctx.fillStyle = municipalityShade(municipality.departmentCode)
    try { ctx.fill('evenodd') } catch { ctx.fill() }
    ctx.strokeStyle = 'rgba(185,204,210,.105)'
    ctx.lineWidth = Math.max(.55, .7 * scale)
    ctx.stroke()
  }
  ctx.restore()
}

function gridReferenceForPoint(
  point: ExportCanvasPoint,
  frameLeft: number,
  frameTop: number,
  frameWidth: number,
  frameHeight: number,
  columns: number,
  rows: number,
) {
  const column = exportClamp(Math.floor((point.x - frameLeft) / Math.max(1, frameWidth) * columns), 0, columns - 1)
  const row = exportClamp(Math.floor((point.y - frameTop) / Math.max(1, frameHeight) * rows), 0, rows - 1)
  return `${String.fromCharCode(65 + row)}${column + 1}`
}

export async function renderWorldExportPng(model: GameWorldExportModel, options: GameWorldExportOptions) {
  if (typeof document === 'undefined') throw new Error('L’export PNG nécessite un navigateur.')
  // Export volontairement fixé au QHD : qualité suffisante pour un grand plan,
  // sans le pic mémoire/GPU des anciens exports 4K.
  // QHD au ratio du plan imprimé (2048×1580), moins coûteux que l’ancien
  // pseudo-QHD 3072×2370 tout en restant nettement supérieur au Full HD.
  const width = 2560
  const height = 1975
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  // `willReadFrequently` pousse Chromium vers un raster 2D logiciel sur les
  // grandes surfaces. C'est volontaire : l'export ne doit plus concurrencer le
  // contexte WebGL de la carte du jeu.
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D indisponible.')

  const scale = Math.min(width / 2048, height / 1580)
  const outer = Math.max(22 * scale, 16)
  const showStationIndex = options.showStationIndex !== false
  const needsSidebar = options.showLegend || showStationIndex
  const sidebarWidth = needsSidebar ? Math.min(width * .29, 570 * scale) : 0
  const sidebarGap = needsSidebar ? 22 * scale : 0
  const frameLeft = outer + sidebarWidth + sidebarGap
  const frameTop = 50 * scale
  const frameRight = width - outer
  const frameBottom = height - 50 * scale
  const frameWidth = Math.max(420, frameRight - frameLeft)
  const frameHeight = Math.max(520, frameBottom - frameTop)
  const frameRadius = Math.min(72 * scale, frameWidth * .075, frameHeight * .075)

  ctx.fillStyle = '#435562'
  ctx.fillRect(0, 0, width, height)
  await yieldExportFrame()
  const vignette = ctx.createLinearGradient(0, 0, width, height)
  vignette.addColorStop(0, 'rgba(7,16,23,.20)')
  vignette.addColorStop(.55, 'rgba(255,255,255,.015)')
  vignette.addColorStop(1, 'rgba(4,10,15,.23)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  roundRectPath(ctx, frameLeft, frameTop, frameWidth, frameHeight, frameRadius)
  ctx.fillStyle = '#0a1116'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.32)'
  ctx.lineWidth = Math.max(1, 1.2 * scale)
  ctx.stroke()

  const mapPaddingX = 27 * scale
  const mapPaddingY = 29 * scale
  const availableMapLeft = frameLeft + mapPaddingX
  const availableMapTop = frameTop + mapPaddingY
  const availableMapWidth = frameWidth - mapPaddingX * 2
  const availableMapHeight = frameHeight - mapPaddingY * 2

  const westX = model.bounds.west * Math.PI / 180
  const eastX = model.bounds.east * Math.PI / 180
  const southY = mercatorY(model.bounds.south)
  const northY = mercatorY(model.bounds.north)
  const lonSpan = Math.max(1e-7, eastX - westX)
  const mercSpan = Math.max(1e-7, northY - southY)

  const normalizedGeographic = (longitude: number, latitude: number) => ({
    u: exportClamp((longitude * Math.PI / 180 - westX) / lonSpan, 0, 1),
    v: exportClamp((northY - mercatorY(latitude)) / mercSpan, 0, 1),
  })

  // Le centre de densité est calculé depuis les stations du réseau, jamais
  // codé en dur sur Paris : la même logique fonctionne sur les autres territoires.
  const stationNormalized = model.stations.map(station => normalizedGeographic(station.longitude, station.latitude))
  const focusU = medianNumber(stationNormalized.map(point => point.u))
  const focusV = medianNumber(stationNormalized.map(point => point.v))
  const densityExponent = model.stations.length >= 300 ? .44 : model.stations.length >= 180 ? .50 : .58
  const warpX = (value: number) => options.layout === 'READABLE' ? warpExportAxis(value, focusU, densityExponent) : value
  const warpY = (value: number) => options.layout === 'READABLE' ? warpExportAxis(value, focusV, densityExponent) : value

  let contentLeft = availableMapLeft
  let contentTop = availableMapTop
  let contentWidth = availableMapWidth
  let contentHeight = availableMapHeight
  if (options.layout === 'GEOGRAPHIC') {
    const geographicAspect = mercSpan / lonSpan
    const targetAspect = availableMapHeight / availableMapWidth
    if (geographicAspect > targetAspect) {
      contentHeight = availableMapHeight
      contentWidth = contentHeight / geographicAspect
      contentLeft += (availableMapWidth - contentWidth) / 2
    }
    else {
      contentWidth = availableMapWidth
      contentHeight = contentWidth * geographicAspect
      contentTop += (availableMapHeight - contentHeight) / 2
    }
  }

  const project = (longitude: number, latitude: number): ExportCanvasPoint => {
    const normalized = normalizedGeographic(longitude, latitude)
    return {
      x: contentLeft + warpX(normalized.u) * contentWidth,
      y: contentTop + warpY(normalized.v) * contentHeight,
    }
  }

  ctx.save()
  roundRectPath(ctx, frameLeft, frameTop, frameWidth, frameHeight, frameRadius)
  ctx.clip()

  if (options.showBasemap) {
    drawMunicipalityBackground(ctx, model.municipalities, project, scale)
    await yieldExportFrame()

    const basemapCapture = await captureGameMapBasemap(model.bounds, {
      width: Math.round(contentWidth),
      height: Math.round(contentHeight),
    })
    if (basemapCapture?.dataUrl) {
      const background = await new Promise<HTMLImageElement | null>(resolve => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => resolve(null)
        image.src = basemapCapture.dataUrl
      })
      if (background) {
        const captureWestX = basemapCapture.bounds.west * Math.PI / 180
        const captureEastX = basemapCapture.bounds.east * Math.PI / 180
        const captureNorthY = mercatorY(basemapCapture.bounds.north)
        const captureSouthY = mercatorY(basemapCapture.bounds.south)
        const sourceWindow = {
          u0: (captureWestX - westX) / lonSpan,
          u1: (captureEastX - westX) / lonSpan,
          v0: (northY - captureNorthY) / mercSpan,
          v1: (northY - captureSouthY) / mercSpan,
        }
        ctx.save()
        // Pas de `ctx.filter` ici : sur certains pilotes ce filtre basculait le
        // grand Canvas2D vers une surface accélérée et provoquait le flash blanc /
        // l'encodage noir. L'assombrissement est obtenu uniquement par alpha + voile.
        ctx.globalAlpha = .24
        drawWarpedBasemap(
          ctx,
          background,
          contentLeft,
          contentTop,
          contentWidth,
          contentHeight,
          warpX,
          warpY,
          sourceWindow,
        )
        ctx.globalAlpha = 1
        ctx.restore()
      }
    }
  }

  // Voile léger : le fond cartographique reste visible mais ne concurrence jamais
  // le réseau, exactement comme sur un plan imprimé professionnel.
  ctx.fillStyle = options.showBasemap ? 'rgba(3,8,12,.16)' : '#0d171c'
  ctx.fillRect(frameLeft, frameTop, frameWidth, frameHeight)

  // Même grille 1–11 / A–K que les grands plans régionaux : elle sert également
  // de référence à l'index alphabétique des stations.
  const gridColumns = 11
  const gridRows = 11
  ctx.strokeStyle = 'rgba(224,237,240,.075)'
  ctx.lineWidth = Math.max(.7, scale * .72)
  for (let column = 1; column < gridColumns; column += 1) {
    const x = frameLeft + frameWidth * column / gridColumns
    ctx.beginPath(); ctx.moveTo(x, frameTop); ctx.lineTo(x, frameBottom); ctx.stroke()
  }
  for (let row = 1; row < gridRows; row += 1) {
    const y = frameTop + frameHeight * row / gridRows
    ctx.beginPath(); ctx.moveTo(frameLeft, y); ctx.lineTo(frameRight, y); ctx.stroke()
  }

  await yieldExportFrame()

  const effectiveLayout: GameWorldExportLayout = options.layout ?? 'READABLE'
  const schematic = buildSchematicNetwork(model.lines, project, scale, effectiveLayout)
  const occurrences = stationOccurrenceMap(model.lines)
  const lanePlan = buildSchematicLanePlan(schematic, model.lines, scale)

  type ChainEdgeRender = {
    fromStop: GameStation | null
    toStop: GameStation | null
    fromPhysicalId: string
    toPhysicalId: string
    edgeKey: string
    centerPoints: ExportCanvasPoint[]
    corridorCount: number
    shared: boolean
    startOffset: number
    endOffset: number
  }

  type RenderedSchematicPath = {
    line: GameLine
    points: ExportCanvasPoint[]
    width: number
    corridorCount: number
  }

  const stationPointBuckets = new Map<string, ExportCanvasPoint[]>()
  const addStationPoint = (lineId: string, stationId: string, point: ExportCanvasPoint) => {
    const key = `${lineId}:${stationId}`
    const bucket = stationPointBuckets.get(key) ?? []
    bucket.push(point)
    stationPointBuckets.set(key, bucket)
  }

  const edgeOffsetForTraversal = (
    lineId: string,
    edgeKey: string,
    fromPhysicalId: string,
  ) => {
    const offsets = lanePlan.edgeOffsets.get(edgeKey)
    const orientation = lanePlan.edgeOrientation.get(edgeKey)
    if (!offsets || !orientation) return 0
    const offset = offsets.get(lineId) ?? 0
    return orientation.fromPhysicalId === fromPhysicalId ? offset : -offset
  }

  const renderedPaths: RenderedSchematicPath[] = []
  // Tous les morceaux d'une même ligne qui arrivent au même noeud utilisent le
  // même point de jonction. Cela soude proprement les branches et empêche les
  // mini-triangles / croisements qui apparaissaient aux changements de normale.
  const lineNodeJoinPoints = new Map<string, ExportCanvasPoint>()
  const lineNodeKey = (lineId: string, nodeId: string) => `${lineId}:${nodeId}`

  // Une correspondance n'est PAS une fusion graphique des voies. Si plusieurs
  // lignes se rencontrent dans une même gare mais ne partagent aucune emprise à
  // cet endroit (Villers-Côtterets K/P, Meaux E/P...), on leur réserve de petits
  // quais parallèles distincts. Cela évite qu'une couleur semble continuer dans
  // l'autre ligne alors qu'il ne s'agit que d'une gare commune.
  const realLinesByNode = new Map<string, Set<string>>()
  for (const chain of schematic.chains) {
    for (const anchor of chain.anchors) {
      if (!anchor.station) continue
      const set = realLinesByNode.get(anchor.physicalId) ?? new Set<string>()
      set.add(chain.line.id)
      realLinesByNode.set(anchor.physicalId, set)
    }
  }
  const nodeHasSharedTrack = new Set<string>()
  for (const [edgeKey, lineIds] of schematic.edgeLineIds) {
    if (lineIds.size <= 1) continue
    const edge = schematic.edgeGeometry.get(edgeKey)
    if (!edge) continue
    nodeHasSharedTrack.add(edge.fromPhysicalId)
    nodeHasSharedTrack.add(edge.toPhysicalId)
  }
  const interchangeNudges = new Map<string, ExportCanvasPoint>()
  for (const [nodeId, lineIdsSet] of realLinesByNode) {
    const lineIds = [...lineIdsSet].sort()
    if (lineIds.length <= 1 || nodeHasSharedTrack.has(nodeId)) continue
    const center = schematic.nodePoints.get(nodeId)
    if (!center) continue
    const incidentVectors: ExportCanvasPoint[] = []
    for (const edge of schematic.edgeGeometry.values()) {
      if (edge.fromPhysicalId !== nodeId && edge.toPhysicalId !== nodeId) continue
      const otherId = edge.fromPhysicalId === nodeId ? edge.toPhysicalId : edge.fromPhysicalId
      const other = schematic.nodePoints.get(otherId)
      if (!other) continue
      let direction = normalizedCanvasVector(other.x - center.x, other.y - center.y)
      // Les directions opposées décrivent le même axe : on les met dans le même
      // hémisphère avant de calculer l'axe dominant.
      if (direction.x < -.001 || (Math.abs(direction.x) <= .001 && direction.y < 0)) {
        direction = { x: -direction.x, y: -direction.y }
      }
      incidentVectors.push(direction)
    }
    const sum = incidentVectors.reduce((acc, direction) => ({ x: acc.x + direction.x, y: acc.y + direction.y }), { x: 0, y: 0 })
    const axis = normalizedCanvasVector(sum.x, sum.y)
    const normal = { x: axis.y, y: -axis.x }
    const pitch = 9.2 * scale
    const middle = (lineIds.length - 1) / 2
    lineIds.forEach((lineId, index) => {
      const offset = (index - middle) * pitch
      interchangeNudges.set(lineNodeKey(lineId, nodeId), { x: normal.x * offset, y: normal.y * offset })
    })
  }

  for (const chain of schematic.chains) {
    const line = chain.line
    const edges: ChainEdgeRender[] = []

    for (let stationIndex = 1; stationIndex < chain.anchors.length; stationIndex += 1) {
      const fromAnchor = chain.anchors[stationIndex - 1]!
      const toAnchor = chain.anchors[stationIndex]!
      const fromPhysicalId = fromAnchor.physicalId
      const toPhysicalId = toAnchor.physicalId
      if (fromPhysicalId === toPhysicalId) continue
      const edgeKey = schematicEdgeKey(fromPhysicalId, toPhysicalId)
      const centerEdge = schematic.edgeGeometry.get(edgeKey)
      if (!centerEdge) continue
      const edgeLineIds = schematic.edgeLineIds.get(edgeKey) ?? new Set([line.id])
      const shared = edgeLineIds.size > 1
      const laneOffset = shared ? edgeOffsetForTraversal(line.id, edgeKey, fromPhysicalId) : 0
      edges.push({
        fromStop: fromAnchor.station,
        toStop: toAnchor.station,
        fromPhysicalId,
        toPhysicalId,
        edgeKey,
        centerPoints: orientedSchematicEdge(centerEdge, fromPhysicalId, toPhysicalId),
        corridorCount: edgeLineIds.size,
        shared,
        startOffset: laneOffset,
        endOffset: laneOffset,
      })
    }

    // Une bifurcation n'est jamais ramenée au centre sur le premier arrêt qui suit.
    // On prolonge la voie sur plusieurs tronçons puis on la rapproche doucement de
    // son axe individuel. C'est ce long éventail qui donne l'aspect « peigne » des
    // vrais plans : les lignes se séparent sans se couper ni former une pince.
    const transitionLength = 160 * scale

    for (let index = 0; index < edges.length - 1; index += 1) {
      const current = edges[index]!
      const next = edges[index + 1]!
      if (current.toPhysicalId !== next.fromPhysicalId || !current.shared || next.shared) continue

      const baseMagnitude = Math.abs(current.endOffset)
      if (baseMagnitude < .01) continue
      let remaining = transitionLength
      let target = offsetCanvasPolylineEndpoint(current.centerPoints, false, current.endOffset)

      for (let cursor = index + 1; cursor < edges.length && remaining > .01; cursor += 1) {
        const edge = edges[cursor]!
        if (edge.shared) break
        const lengths = polylineLengths(edge.centerPoints)
        const edgeLength = Math.max(1, lengths[lengths.length - 1] ?? 1)
        const startMagnitude = baseMagnitude * exportClamp(remaining / transitionLength, 0, 1)
        const startOffset = closestSignedOffset(edge.centerPoints, true, startMagnitude, target)
        const after = Math.max(0, remaining - edgeLength)
        const endMagnitude = baseMagnitude * exportClamp(after / transitionLength, 0, 1)
        const endOffset = Math.sign(startOffset || 1) * endMagnitude

        if (Math.abs(startOffset) > Math.abs(edge.startOffset)) edge.startOffset = startOffset
        if (Math.abs(endOffset) > Math.abs(edge.endOffset)) edge.endOffset = endOffset
        target = offsetCanvasPolylineEndpoint(edge.centerPoints, false, edge.endOffset)
        remaining = after
      }
    }

    // Même anticipation dans l'autre sens : une ligne rejoint le faisceau plusieurs
    // arrêts avant la gare commune, elle ne saute jamais latéralement au dernier mètre.
    for (let index = edges.length - 1; index > 0; index -= 1) {
      const current = edges[index]!
      const previous = edges[index - 1]!
      if (previous.toPhysicalId !== current.fromPhysicalId || previous.shared || !current.shared) continue

      const baseMagnitude = Math.abs(current.startOffset)
      if (baseMagnitude < .01) continue
      let remaining = transitionLength
      let target = offsetCanvasPolylineEndpoint(current.centerPoints, true, current.startOffset)

      for (let cursor = index - 1; cursor >= 0 && remaining > .01; cursor -= 1) {
        const edge = edges[cursor]!
        if (edge.shared) break
        const lengths = polylineLengths(edge.centerPoints)
        const edgeLength = Math.max(1, lengths[lengths.length - 1] ?? 1)
        const endMagnitude = baseMagnitude * exportClamp(remaining / transitionLength, 0, 1)
        const endOffset = closestSignedOffset(edge.centerPoints, false, endMagnitude, target)
        const after = Math.max(0, remaining - edgeLength)
        const startMagnitude = baseMagnitude * exportClamp(after / transitionLength, 0, 1)
        const startOffset = Math.sign(endOffset || 1) * startMagnitude

        if (Math.abs(endOffset) > Math.abs(edge.endOffset)) edge.endOffset = endOffset
        if (Math.abs(startOffset) > Math.abs(edge.startOffset)) edge.startOffset = startOffset
        target = offsetCanvasPolylineEndpoint(edge.centerPoints, true, edge.startOffset)
        remaining = after
      }
    }

    const shiftedEdges = edges.map(edge => ({
      edge,
      points: variableOffsetCanvasPolyline(edge.centerPoints, edge.startOffset, edge.endOffset),
    })).filter(item => item.points.length >= 2)

    // Au même noeud, le morceau qui appartient au faisceau le plus riche décide
    // du point exact de jonction. Ainsi une ligne express reste dans sa voie et
    // l'arête individuelle vient la rejoindre progressivement, jamais l'inverse.
    const localTargets = new Map<string, { point: ExportCanvasPoint; score: number }>()
    const proposeTarget = (nodeId: string, point: ExportCanvasPoint, edge: ChainEdgeRender) => {
      const score = edge.corridorCount * 100 + (edge.shared ? 50 : 0) + Math.max(Math.abs(edge.startOffset), Math.abs(edge.endOffset))
      const current = localTargets.get(nodeId)
      if (!current || score > current.score) localTargets.set(nodeId, { point: { ...point }, score })
    }
    for (const item of shiftedEdges) {
      proposeTarget(item.edge.fromPhysicalId, item.points[0]!, item.edge)
      proposeTarget(item.edge.toPhysicalId, item.points[item.points.length - 1]!, item.edge)
    }

    const pathPoints: ExportCanvasPoint[] = []
    let maxCorridorCount = 1
    for (const item of shiftedEdges) {
      const edge = item.edge
      const shifted = item.points
      maxCorridorCount = Math.max(maxCorridorCount, edge.corridorCount)

      const startKey = lineNodeKey(line.id, edge.fromPhysicalId)
      const endKey = lineNodeKey(line.id, edge.toPhysicalId)
      const globalStart = lineNodeJoinPoints.get(startKey)
      const globalEnd = lineNodeJoinPoints.get(endKey)
      const startBase = localTargets.get(edge.fromPhysicalId)?.point ?? shifted[0]!
      const endBase = localTargets.get(edge.toPhysicalId)?.point ?? shifted[shifted.length - 1]!
      const startNudge = interchangeNudges.get(startKey)
      const endNudge = interchangeNudges.get(endKey)
      shifted[0] = globalStart ?? (startNudge ? { x: startBase.x + startNudge.x, y: startBase.y + startNudge.y } : startBase)
      shifted[shifted.length - 1] = globalEnd ?? (endNudge ? { x: endBase.x + endNudge.x, y: endBase.y + endNudge.y } : endBase)
      if (!globalStart) lineNodeJoinPoints.set(startKey, { ...shifted[0]! })
      if (!globalEnd) lineNodeJoinPoints.set(endKey, { ...shifted[shifted.length - 1]! })

      // À l'intérieur d'une même chaîne, aucune micro-liaison diagonale n'est
      // autorisée entre deux arêtes successives : elles partagent exactement le
      // même sommet rendu.
      if (pathPoints.length) shifted[0] = pathPoints[pathPoints.length - 1]!

      if (shifted[0] && edge.fromStop) addStationPoint(line.id, edge.fromStop.id, shifted[0])
      if (shifted[shifted.length - 1] && edge.toStop) addStationPoint(line.id, edge.toStop.id, shifted[shifted.length - 1]!)

      for (const point of shifted) {
        const previous = pathPoints[pathPoints.length - 1]
        if (!previous || exportDistance(previous, point) > .35) pathPoints.push(point)
      }
    }

    if (pathPoints.length < 2) continue
    const modeWidth = getTransportModeDefinition(line.mode).mapLineWidth
    renderedPaths.push({
      line,
      points: pathPoints,
      width: Math.max(2.05 * scale, modeWidth * .52 * scale),
      corridorCount: maxCorridorCount,
    })
  }

  // Un chemin complet est peint d'un seul tenant : plus aucun capuchon blanc à
  // chaque station. On groupe également les branches d'une même ligne pour que
  // leur jonction soit réellement soudée. Entre deux lignes différentes, la
  // gouttière claire reste intacte et crée une séparation nette au croisement.
  const pathsByLine = new Map<string, RenderedSchematicPath[]>()
  for (const path of renderedPaths) {
    const list = pathsByLine.get(path.line.id) ?? []
    list.push(path)
    pathsByLine.set(path.line.id, list)
  }

  const lineRenderOrder = [...pathsByLine.entries()].sort((first, second) => {
    const firstCount = Math.max(...first[1].map(path => path.corridorCount))
    const secondCount = Math.max(...second[1].map(path => path.corridorCount))
    return secondCount - firstCount || first[0].localeCompare(second[0])
  })
  const cornerRadius = effectiveLayout === 'READABLE' ? 12.5 * scale : 4 * scale
  for (const [, paths] of lineRenderOrder) {
    for (const item of paths) drawRoundedCanvasPolyline(ctx, item.points, item.width + 4.4 * scale, 'rgba(2,7,10,.98)', cornerRadius)
    for (const item of paths) drawRoundedCanvasPolyline(ctx, item.points, item.width + 2.0 * scale, 'rgba(248,251,251,.97)', cornerRadius)
    for (const item of paths) drawRoundedCanvasPolyline(ctx, item.points, item.width, item.line.color || getTransportModeDefinition(item.line.mode).accent, cornerRadius)
  }

  await yieldExportFrame()

  const stationVisuals: ExportStationVisual[] = []
  for (const [nodeId, rawCandidates] of occurrences) {
    if (!rawCandidates.length) continue

    // Une gare n'est multi-lignes que si les arrêts partagent réellement le même
    // sharedStationId. Les rapprochements de NOEUDS DE VOIE utilisés pour garder
    // des corridors parallèles ne fusionnent jamais les pastilles voyageurs.
    const candidates = [...rawCandidates].sort((first, second) =>
      first.station.name.localeCompare(second.station.name, 'fr-FR')
      || String(first.line.shortCode).localeCompare(String(second.line.shortCode), 'fr-FR', { numeric: true }))
    const representative = candidates[0]!
    const positions: ExportCanvasPoint[] = []
    const trackStops: ExportStationTrackStop[] = []
    const lineIds: string[] = []
    let terminus = false

    for (const candidate of candidates) {
      const bucket = stationPointBuckets.get(`${candidate.line.id}:${candidate.station.id}`) ?? []
      let point: ExportCanvasPoint | null = null
      if (bucket.length) {
        point = {
          x: bucket.reduce((sum, current) => sum + current.x, 0) / bucket.length,
          y: bucket.reduce((sum, current) => sum + current.y, 0) / bucket.length,
        }
      }
      if (!point) {
        point = schematic.nodePoints.get(nodeId) ?? project(candidate.station.longitude, candidate.station.latitude)
      }
      positions.push(point)
      trackStops.push({
        point,
        lineId: candidate.line.id,
        color: candidate.line.color || getTransportModeDefinition(candidate.line.mode).accent,
        terminus: candidate.terminus,
      })
      lineIds.push(candidate.line.id)
      terminus ||= candidate.terminus
    }

    const uniqueLineIds = [...new Set(lineIds)]
    const point = {
      x: positions.reduce((sum, current) => sum + current.x, 0) / positions.length,
      y: positions.reduce((sum, current) => sum + current.y, 0) / positions.length,
    }
    const station: GameWorldExportStation = {
      id: representative.station.id,
      physicalId: nodeId,
      name: representative.station.name,
      longitude: representative.station.longitude,
      latitude: representative.station.latitude,
      color: representative.line.color || getTransportModeDefinition(representative.line.mode).accent,
      terminus,
      interchange: uniqueLineIds.length > 1,
    }
    stationVisuals.push({
      station,
      point,
      points: positions,
      trackStops,
      tangent: null,
      lineIds: uniqueLineIds,
      terminus,
      interchange: uniqueLineIds.length > 1,
    })
  }


  // Gares desservies par plusieurs lignes : un petit « quai » blanc relie les
  // points de voie. Il ne crée aucune correspondance fictive : il n'apparaît que
  // lorsque la sauvegarde contient réellement plusieurs lignes à cette gare.
  // C'est le symbole qui manquait notamment à Chantilly / Creil : on comprend
  // immédiatement que les deux câbles desservent le même arrêt, même s'ils sont
  // volontairement séparés dans le faisceau.
  for (const visual of stationVisuals) {
    const stops = visual.trackStops
      .filter((stop, index, list) => list.findIndex(candidate => candidate.lineId === stop.lineId) === index)
    if (stops.length < 2) continue

    let first = stops[0]!
    let second = stops[1]!
    let farthest = exportDistance(first.point, second.point)
    for (let firstIndex = 0; firstIndex < stops.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < stops.length; secondIndex += 1) {
        const distance = exportDistance(stops[firstIndex]!.point, stops[secondIndex]!.point)
        if (distance <= farthest) continue
        farthest = distance
        first = stops[firstIndex]!
        second = stops[secondIndex]!
      }
    }
    if (farthest < 2.2 * scale || farthest > 46 * scale) continue

    ctx.beginPath()
    ctx.moveTo(first.point.x, first.point.y)
    ctx.lineTo(second.point.x, second.point.y)
    ctx.strokeStyle = 'rgba(2,7,10,.98)'
    ctx.lineWidth = 8.2 * scale
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(first.point.x, first.point.y)
    ctx.lineTo(second.point.x, second.point.y)
    ctx.strokeStyle = '#f8fbfb'
    ctx.lineWidth = 5.2 * scale
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Les arrêts sont des anneaux posés SUR le câble, pas des trous découpés dans
  // la ligne. Le centre reprend donc la couleur de la voie concernée : le ruban
  // reste visuellement continu même avec beaucoup de stations rapprochées.
  for (const visual of stationVisuals) {
    for (const stop of visual.trackStops) {
      const outerRadius = (stop.terminus ? 2.65 : 1.52) * scale
      const innerRadius = (stop.terminus ? 1.82 : 1.02) * scale
      ctx.beginPath()
      ctx.arc(stop.point.x, stop.point.y, outerRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#f8fbfb'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(stop.point.x, stop.point.y, innerRadius, 0, Math.PI * 2)
      ctx.fillStyle = stop.color
      ctx.fill()
    }
  }


  type LabelRect = { left: number; top: number; right: number; bottom: number }

  // Un libellé ne doit jamais faire croire qu'une station appartient à la ligne
  // voisine. C'était particulièrement trompeur à Villers-Saint-Paul (H vs D) et
  // La Borne Blanche (D vs B) : le point d'arrêt était juste, mais le texte se
  // posait sur le câble étranger. On pénalise donc les placements dont le rectangle
  // coupe une voie qui ne dessert pas la station.
  const segmentIntersectsLabelRect = (
    start: ExportCanvasPoint,
    end: ExportCanvasPoint,
    rect: LabelRect,
    padding: number,
  ) => {
    const left = rect.left - padding
    const right = rect.right + padding
    const top = rect.top - padding
    const bottom = rect.bottom + padding
    const dx = end.x - start.x
    const dy = end.y - start.y
    let minimum = 0
    let maximum = 1
    const clips: Array<[number, number]> = [
      [-dx, start.x - left],
      [dx, right - start.x],
      [-dy, start.y - top],
      [dy, bottom - start.y],
    ]
    for (const [direction, distance] of clips) {
      if (Math.abs(direction) <= 1e-9) {
        if (distance < 0) return false
        continue
      }
      const ratio = distance / direction
      if (direction < 0) minimum = Math.max(minimum, ratio)
      else maximum = Math.min(maximum, ratio)
      if (minimum > maximum) return false
    }
    return true
  }

  const foreignLineCrossingCount = (rect: LabelRect, servedLineIds: ReadonlySet<string>) => {
    let crossings = 0
    const padding = 1.8 * scale
    for (const path of renderedPaths) {
      if (servedLineIds.has(path.line.id)) continue
      for (let index = 1; index < path.points.length; index += 1) {
        const start = path.points[index - 1]!
        const end = path.points[index]!
        const segmentLeft = Math.min(start.x, end.x)
        const segmentRight = Math.max(start.x, end.x)
        const segmentTop = Math.min(start.y, end.y)
        const segmentBottom = Math.max(start.y, end.y)
        if (segmentRight < rect.left - padding || segmentLeft > rect.right + padding
          || segmentBottom < rect.top - padding || segmentTop > rect.bottom + padding) continue
        if (segmentIntersectsLabelRect(start, end, rect, padding)) crossings += 1
      }
    }
    return crossings
  }

  const occupied: LabelRect[] = []
  const branchLabelNodeIds = new Set<string>()
  for (const line of model.lines) {
    const byId = new Map(getLineAllStations(line).map(station => [station.id, station] as const))
    for (const branch of getLineBranches(line)) {
      const anchor = byId.get(branch.fromStationId)
      if (anchor) {
        branchLabelNodeIds.add(physicalStationId(anchor))
      }
      for (const station of branch.stations) {
        branchLabelNodeIds.add(physicalStationId(station))
      }
    }
  }
  const sparseLabelRadius = 54 * scale
  const sparseLabelRadiusSq = sparseLabelRadius * sparseLabelRadius
  const localStationDensity = (visual: ExportStationVisual) => {
    let count = 0
    for (const other of stationVisuals) {
      if (other === visual) continue
      const dx = other.point.x - visual.point.x
      const dy = other.point.y - visual.point.y
      if (dx * dx + dy * dy <= sparseLabelRadiusSq) count += 1
      if (count > 5) break
    }
    return count
  }
  const labelCandidates = stationVisuals
    .map((visual, index) => ({
      visual,
      index,
      // Terminus, bifurcations, gares multi-lignes ET arrêts périphériques peu
      // denses sont garantis. Cela évite de perdre Malesherbes, Beynes,
      // Aulnay-sur-Mauldre, Chantilly, etc. simplement à cause du moteur anti-collision.
      priority: visual.terminus
        || branchLabelNodeIds.has(visual.station.physicalId)
        || visual.lineIds.length > 1
        || localStationDensity(visual) <= 5
        ? 0
        : 1,
    }))
    .filter(() => options.labels !== 'NONE')
    .sort((a, b) => a.priority - b.priority || a.visual.station.name.localeCompare(b.visual.station.name, 'fr-FR'))

  ctx.textBaseline = 'middle'
  for (const { visual, priority } of labelCandidates) {
    // drawLineBadge rétablit textBaseline à top ; chaque libellé repart donc
    // explicitement sur une baseline centrale pour rester parfaitement aligné.
    ctx.textBaseline = 'middle'
    const rawText = visual.station.name
    const text = rawText.length > 38 ? `${rawText.slice(0, 36)}…` : rawText
    const labelFontPx = (priority === 0 ? 7.85 : options.labels === 'ALL' ? 6.35 : 6.55) * scale
    ctx.font = `${priority === 0 ? 700 : 600} ${labelFontPx}px Arial, sans-serif`
    const textWidth = ctx.measureText(text).width
    const boxWidth = textWidth
    const boxHeight = labelFontPx * 1.24
    const baseGap = (priority === 0 ? 8.2 : 5.8) * scale
    const servedLineIds = new Set(visual.lineIds)
    const placements: Array<{ x: number; y: number; anchor: CanvasTextAlign }> = []
    for (const factor of [1, 1.55, 2.2]) {
      const gap = baseGap * factor
      placements.push(
        { x: visual.point.x + gap, y: visual.point.y - gap * .55, anchor: 'left' },
        { x: visual.point.x + gap, y: visual.point.y + gap * .55, anchor: 'left' },
        { x: visual.point.x - gap, y: visual.point.y - gap * .55, anchor: 'right' },
        { x: visual.point.x - gap, y: visual.point.y + gap * .55, anchor: 'right' },
        { x: visual.point.x, y: visual.point.y - gap * 1.18, anchor: 'center' },
        { x: visual.point.x, y: visual.point.y + gap * 1.18, anchor: 'center' },
      )
    }
    type LabelPlacement = {
      x: number
      y: number
      anchor: CanvasTextAlign
      rect: LabelRect
      left: number
      overlap: number
      foreignCrossings: number
      score: number
    }
    let placed: LabelPlacement | null = null
    let bestFallback: LabelPlacement | null = null
    for (const candidate of placements) {
      const left = candidate.anchor === 'left' ? candidate.x : candidate.anchor === 'right' ? candidate.x - boxWidth : candidate.x - boxWidth / 2
      const rect = {
        left: left - 2.5 * scale,
        top: candidate.y - boxHeight / 2 - 2 * scale,
        right: left + boxWidth + 2.5 * scale,
        bottom: candidate.y + boxHeight / 2 + 2 * scale,
      }
      const inside = rect.left >= frameLeft + 5 * scale && rect.right <= frameRight - 5 * scale && rect.top >= frameTop + 5 * scale && rect.bottom <= frameBottom - 5 * scale
      if (!inside) continue
      let overlap = 0
      for (const other of occupied) {
        const overlapWidth = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left))
        const overlapHeight = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top))
        overlap += overlapWidth * overlapHeight
      }
      const foreignCrossings = foreignLineCrossingCount(rect, servedLineIds)
      const area = Math.max(1, boxWidth * boxHeight)
      // Traverser une ligne étrangère coûte volontairement bien plus cher qu'un
      // petit chevauchement de textes : l'association station -> ligne prime.
      const score = overlap + foreignCrossings * area * 1.8
      const candidatePlaced = { ...candidate, rect, left, overlap, foreignCrossings, score }
      if (overlap <= .01 && foreignCrossings === 0) { placed = candidatePlaced; break }
      if (!bestFallback || score < bestFallback.score) bestFallback = candidatePlaced
    }
    // Les gares structurantes sont garanties. Pour les autres, on accepte un très
    // léger chevauchement plutôt que de supprimer arbitrairement un nom rural
    // (Beynes, Malesherbes, etc.).
    if (!placed && bestFallback) {
      const area = Math.max(1, boxWidth * boxHeight)
      const acceptableTextOverlap = priority === 0 || bestFallback.overlap / area <= .16
      // Une gare prioritaire reste nommée même dans une zone très dense, mais on
      // ne choisit une traversée de câble étranger qu'en dernier recours.
      if (acceptableTextOverlap && (bestFallback.foreignCrossings === 0 || priority === 0)) placed = bestFallback
    }
    if (!placed) continue
    occupied.push(placed.rect)

    ctx.textAlign = placed.anchor
    ctx.font = `${priority === 0 ? 700 : 600} ${labelFontPx}px Arial, sans-serif`
    ctx.lineWidth = Math.max(2.45 * scale, 1.6)
    ctx.strokeStyle = 'rgba(1,6,9,.99)'
    ctx.strokeText(text, placed.x, placed.y)
    ctx.fillStyle = '#f9fbfb'
    ctx.fillText(text, placed.x, placed.y)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.restore()

  // Repères de grille, utilisés aussi par l'index.
  ctx.fillStyle = 'rgba(246,250,250,.94)'
  ctx.font = `700 ${9.6 * scale}px Arial, sans-serif`
  ctx.textAlign = 'center'
  for (let column = 0; column < gridColumns; column += 1) {
    const x = frameLeft + frameWidth * (column + .5) / gridColumns
    ctx.fillText(String(column + 1), x, frameTop - 23 * scale)
    ctx.fillText(String(column + 1), x, frameBottom + 11 * scale)
  }
  ctx.textBaseline = 'middle'
  for (let row = 0; row < gridRows; row += 1) {
    const y = frameTop + frameHeight * (row + .5) / gridRows
    const letter = String.fromCharCode(65 + row)
    ctx.textAlign = 'right'; ctx.fillText(letter, frameLeft - 9 * scale, y)
    ctx.textAlign = 'left'; ctx.fillText(letter, frameRight + 9 * scale, y)
  }
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  if (needsSidebar) {
    const sidebarX = outer
    const sidebarY = 27 * scale
    const sidebarRight = frameLeft - sidebarGap
    const contentWidth = sidebarRight - sidebarX
    const logoSize = 54 * scale

    roundRectPath(ctx, sidebarX, sidebarY, logoSize, logoSize, 12 * scale)
    ctx.fillStyle = '#f6fbfb'
    ctx.fill()
    ctx.fillStyle = '#0b151b'
    ctx.font = `900 ${22 * scale}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CLU', sidebarX + logoSize / 2, sidebarY + logoSize * .52)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    ctx.fillStyle = '#f5fbfb'
    ctx.font = `800 ${17 * scale}px Arial, sans-serif`
    ctx.fillText(translatedExportText('Réseau').toUpperCase(), sidebarX, sidebarY + logoSize + 17 * scale)
    ctx.font = `800 ${25 * scale}px Arial, sans-serif`
    ctx.fillText('CLU Métropole', sidebarX, sidebarY + logoSize + 38 * scale)
    ctx.fillStyle = 'rgba(244,250,250,.70)'
    ctx.font = `600 ${9.6 * scale}px Arial, sans-serif`
    ctx.fillText(model.stats.territoryLabel, sidebarX, sidebarY + logoSize + 73 * scale)
    ctx.fillStyle = 'rgba(244,250,250,.56)'
    ctx.font = `600 ${8.8 * scale}px Arial, sans-serif`
    ctx.fillText(`${model.stats.name} · ${translatedExportText(`Jour ${model.stats.day}`)}`, sidebarX, sidebarY + logoSize + 90 * scale)

    const dividerY = sidebarY + logoSize + 116 * scale
    ctx.fillStyle = 'rgba(255,255,255,.32)'
    ctx.fillRect(sidebarX, dividerY, contentWidth, Math.max(1, scale))

    let y = dividerY + 17 * scale
    if (options.showLegend) {
      ctx.fillStyle = '#f4f9f9'
      ctx.font = `800 ${9.4 * scale}px Arial, sans-serif`
      ctx.fillText(translatedExportText('Lignes').toUpperCase(), sidebarX, y)
      y += 18 * scale

      const modeOrder: GameTransportMode[] = ['RER', 'TRAIN', 'METRO', 'TRAM', 'BRT', 'BUS', 'CABLE', 'FERRY']
      const order = new Map(modeOrder.map((mode, index) => [mode, index]))
      const legendLines = [...model.lines].sort((a, b) => (order.get(a.mode) ?? 99) - (order.get(b.mode) ?? 99) || String(a.shortCode).localeCompare(String(b.shortCode), 'fr-FR'))
      const legendColumns = contentWidth >= 440 * scale ? 2 : 1
      const legendRows = Math.ceil(legendLines.length / legendColumns)
      const legendColumnWidth = contentWidth / legendColumns
      const rowHeight = 23 * scale
      for (let index = 0; index < legendLines.length; index += 1) {
        const line = legendLines[index]!
        const column = Math.floor(index / legendRows)
        const row = index % legendRows
        const x = sidebarX + column * legendColumnWidth
        const rowY = y + row * rowHeight
        const badgeHeight = 17 * scale
        const badgeWidth = drawLineBadge(ctx, line, x, rowY, badgeHeight)
        ctx.fillStyle = '#f4f9f9'
        ctx.font = `600 ${7.7 * scale}px Arial, sans-serif`
        const available = Math.max(18, legendColumnWidth - badgeWidth - 9 * scale)
        let name = line.name
        while (name.length > 4 && ctx.measureText(name).width > available) name = `${name.slice(0, -2).trimEnd()}…`
        ctx.fillText(name, x + badgeWidth + 6 * scale, rowY + 4.2 * scale)
      }
      y += legendRows * rowHeight + 12 * scale
    }

    const statsReserve = options.showStats ? 79 * scale : 18 * scale
    if (showStationIndex) {
      ctx.fillStyle = 'rgba(255,255,255,.32)'
      ctx.fillRect(sidebarX, y, contentWidth, Math.max(1, scale))
      y += 11 * scale
      ctx.fillStyle = '#f4f9f9'
      ctx.font = `800 ${8.7 * scale}px Arial, sans-serif`
      ctx.fillText(translatedExportText('Index des gares et stations').toUpperCase(), sidebarX, y)
      y += 15 * scale

      const indexBottom = height - outer - statsReserve
      const indexHeight = Math.max(80 * scale, indexBottom - y)
      const alphabetical = [...stationVisuals].sort((a, b) => a.station.name.localeCompare(b.station.name, 'fr-FR', { sensitivity: 'base' }))
      let columns = contentWidth >= 500 * scale ? 3 : 2
      let rowsPerColumn = Math.ceil(alphabetical.length / columns)
      let rowHeight = indexHeight / Math.max(1, rowsPerColumn)
      if (rowHeight < 6.8 * scale && columns < 4 && contentWidth >= 520 * scale) {
        columns = 4
        rowsPerColumn = Math.ceil(alphabetical.length / columns)
        rowHeight = indexHeight / Math.max(1, rowsPerColumn)
      }
      rowHeight = Math.min(9.2 * scale, rowHeight)
      const fontSize = exportClamp(rowHeight * .68, 5.15 * scale, 6.75 * scale)
      const columnWidth = contentWidth / columns
      for (let index = 0; index < alphabetical.length; index += 1) {
        const visual = alphabetical[index]!
        const column = Math.floor(index / rowsPerColumn)
        const row = index % rowsPerColumn
        const rowY = y + row * rowHeight
        if (rowY + rowHeight > indexBottom + .5) continue
        const x = sidebarX + column * columnWidth
        const reference = gridReferenceForPoint(visual.point, frameLeft, frameTop, frameWidth, frameHeight, gridColumns, gridRows)
        ctx.font = `500 ${fontSize}px Arial, sans-serif`
        ctx.fillStyle = 'rgba(244,249,249,.82)'
        const referenceWidth = ctx.measureText(reference).width
        const availableNameWidth = Math.max(20, columnWidth - referenceWidth - 9 * scale)
        let name = visual.station.name
        while (name.length > 4 && ctx.measureText(name).width > availableNameWidth) name = `${name.slice(0, -2).trimEnd()}…`
        ctx.fillText(name, x, rowY)
        ctx.textAlign = 'right'
        ctx.font = `700 ${fontSize}px Arial, sans-serif`
        ctx.fillStyle = 'rgba(220,232,235,.76)'
        ctx.fillText(reference, x + columnWidth - 4 * scale, rowY)
        ctx.textAlign = 'left'
      }
    }

    if (options.showStats) {
      const statsY = height - outer - 63 * scale
      ctx.fillStyle = 'rgba(255,255,255,.32)'
      ctx.fillRect(sidebarX, statsY, contentWidth, Math.max(1, scale))
      const stats = [
        [translatedExportText('Lignes'), String(model.stats.lineCount)],
        [translatedExportText('Stations'), String(model.stats.stationCount)],
        [translatedExportText('Réseau'), `${model.stats.networkLengthKm.toFixed(model.stats.networkLengthKm >= 100 ? 0 : 1)} km`],
        [translatedExportText('Voyageurs'), compactNumber(model.stats.passengers)],
        [translatedExportText('Budget'), compactEuro(model.stats.balance)],
      ]
      const statWidth = contentWidth / stats.length
      for (let index = 0; index < stats.length; index += 1) {
        const [label, value] = stats[index]!
        const x = sidebarX + index * statWidth
        ctx.fillStyle = 'rgba(243,249,249,.55)'
        ctx.font = `600 ${6.5 * scale}px Arial, sans-serif`
        ctx.fillText(label.toUpperCase(), x, statsY + 12 * scale)
        ctx.fillStyle = '#ffffff'
        ctx.font = `800 ${8.7 * scale}px Arial, sans-serif`
        ctx.fillText(value, x, statsY + 28 * scale)
      }
    }
  }
  else {
    ctx.fillStyle = '#f5fbfb'
    ctx.font = `800 ${22 * scale}px Arial, sans-serif`
    ctx.fillText(`${model.stats.name} · CLU Métropole`, outer, 18 * scale)
  }

  await yieldExportFrame()

  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(245,250,250,.66)'
  ctx.font = `700 ${11 * scale}px Arial, sans-serif`
  ctx.fillText('CLU Métropole', width - outer, height - 11 * scale)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  await yieldExportFrame()
  const blob = await canvasBlob(canvas)
  // Libère immédiatement ~29 Mo de surface QHD après l'encodage.
  canvas.width = 1
  canvas.height = 1
  return blob
}
