import type { GameLine, GameLineBranch, GameStation } from '../../types/network'
import { findLineStation, findLineStationLocation, getLineBranches, getLineGeometrySequences } from './geometry'
import { getSegmentCoordinates } from './pathGeometry'

export type GameMapCoordinate = [number, number]

export interface GameRenderedLineSequence {
  id: string
  kind: 'MAIN' | 'BRANCH'
  branchId: string | null
  coordinates: GameMapCoordinate[]
}

interface PlanarPoint {
  x: number
  y: number
}

interface RenderOptions {
  previousHint?: GameStation | null
  maxHandleMeters?: number
  samplesPerSegment?: number
}

const METERS_PER_LATITUDE_DEGREE = 111_320
const MAX_CACHE_ENTRIES = 320
const renderCache = new Map<string, GameRenderedLineSequence[]>()

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distance(a: PlanarPoint, b: PlanarPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalize(vector: PlanarPoint): PlanarPoint {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= 1e-9) return { x: 0, y: 0 }
  return { x: vector.x / length, y: vector.y / length }
}

function dot(a: PlanarPoint, b: PlanarPoint) {
  return a.x * b.x + a.y * b.y
}

function add(a: PlanarPoint, b: PlanarPoint): PlanarPoint {
  return { x: a.x + b.x, y: a.y + b.y }
}

function scale(a: PlanarPoint, value: number): PlanarPoint {
  return { x: a.x * value, y: a.y * value }
}

function subtract(a: PlanarPoint, b: PlanarPoint): PlanarPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

function averageLatitude(points: GameMapCoordinate[]) {
  if (!points.length) return 0
  return points.reduce((sum, point) => sum + point[1], 0) / points.length
}

function createProjection(points: GameMapCoordinate[]) {
  const origin = points[0] ?? [0, 0]
  const latitude = averageLatitude(points)
  const longitudeScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180)) * METERS_PER_LATITUDE_DEGREE
  return {
    toPlanar(point: GameMapCoordinate): PlanarPoint {
      return {
        x: (point[0] - origin[0]) * longitudeScale,
        y: (point[1] - origin[1]) * METERS_PER_LATITUDE_DEGREE,
      }
    },
    toGeographic(point: PlanarPoint): GameMapCoordinate {
      return [
        origin[0] + point.x / longitudeScale,
        origin[1] + point.y / METERS_PER_LATITUDE_DEGREE,
      ]
    },
  }
}

function cubicBezier(
  p0: PlanarPoint,
  p1: PlanarPoint,
  p2: PlanarPoint,
  p3: PlanarPoint,
  t: number,
): PlanarPoint {
  const oneMinus = 1 - t
  const a = oneMinus * oneMinus * oneMinus
  const b = 3 * oneMinus * oneMinus * t
  const c = 3 * oneMinus * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

function directionBetween(a: PlanarPoint, b: PlanarPoint) {
  return normalize(subtract(b, a))
}

/**
 * Construit une polyligne localement adoucie sans jamais modifier les stations.
 *
 * Contrairement à l'ancienne spline Catmull-Rom globale, chaque courbe est
 * bornée au segment courant : ses poignées sont limitées à 22 % du segment et
 * à quelques centaines de mètres. Une station reste donc exactement sur le
 * tracé et aucun virage ne peut produire une grande boucle hors du corridor.
 */
export function buildAdaptiveRenderedCoordinates(
  stations: readonly GameStation[],
  options: RenderOptions = {},
): GameMapCoordinate[] {
  if (stations.length < 2) {
    return stations.map(station => [station.longitude, station.latitude] as GameMapCoordinate)
  }

  const points = stations.map(station => [station.longitude, station.latitude] as GameMapCoordinate)
  const projectionPoints = options.previousHint
    ? [[options.previousHint.longitude, options.previousHint.latitude] as GameMapCoordinate, ...points]
    : points
  const projection = createProjection(projectionPoints)
  const planar = points.map(projection.toPlanar)
  const previousHint = options.previousHint
    ? projection.toPlanar([options.previousHint.longitude, options.previousHint.latitude])
    : null
  const maxHandleMeters = options.maxHandleMeters ?? 360
  const baseSamples = options.samplesPerSegment ?? 5
  const result: GameMapCoordinate[] = [points[0]!]

  function tangentAt(index: number): PlanarPoint {
    const current = planar[index]!
    const previous = index > 0 ? planar[index - 1]! : previousHint
    const next = index < planar.length - 1 ? planar[index + 1]! : null

    if (!previous && next) return directionBetween(current, next)
    if (previous && !next) return directionBetween(previous, current)
    if (!previous || !next) return { x: 0, y: 0 }

    const incoming = directionBetween(previous, current)
    const outgoing = directionBetween(current, next)
    const sum = add(incoming, outgoing)
    const bisector = normalize(sum)

    // Quasi demi-tour : on évite volontairement une interpolation qui pourrait
    // dessiner une boucle. La jointure MapLibre arrondie fera le travail visuel.
    if (Math.hypot(sum.x, sum.y) < 0.32) return outgoing
    return bisector
  }

  for (let index = 0; index < planar.length - 1; index += 1) {
    const start = planar[index]!
    const end = planar[index + 1]!
    const segmentLength = distance(start, end)
    if (segmentLength <= 1) {
      result.push(points[index + 1]!)
      continue
    }

    const segmentDirection = directionBetween(start, end)
    const startTangent = tangentAt(index)
    const endTangent = tangentAt(index + 1)
    const startDeviation = Math.acos(clamp(dot(segmentDirection, startTangent), -1, 1))
    const endDeviation = Math.acos(clamp(dot(segmentDirection, endTangent), -1, 1))

    // Les longues portions réellement droites restent exactement droites : on
    // ne densifie pas inutilement le GeoJSON et le rendu conserve sa netteté.
    const almostStraight = startDeviation < 0.055 && endDeviation < 0.055
    if (almostStraight || segmentLength < 45) {
      result.push(points[index + 1]!)
      continue
    }

    const handle = Math.min(maxHandleMeters, segmentLength * 0.22)
    const startControl = add(start, scale(startTangent, handle))
    const endControl = subtract(end, scale(endTangent, handle))
    const severity = clamp((startDeviation + endDeviation) / (Math.PI / 2), 0.5, 1.8)
    const sampleCount = clamp(Math.round(baseSamples * severity), 4, 10)

    for (let sample = 1; sample <= sampleCount; sample += 1) {
      const t = sample / sampleCount
      const point = cubicBezier(start, startControl, endControl, end, t)
      result.push(projection.toGeographic(point))
    }

    // Garantie explicite : le dernier échantillon d'un segment est toujours la
    // vraie station, jamais une approximation flottante.
    result[result.length - 1] = points[index + 1]!
  }

  return result
}

function getParentSequence(line: Pick<GameLine, 'stations' | 'branches'>, stationId: string): GameStation[] | null {
  if (line.stations.some(station => station.id === stationId)) return line.stations
  for (const branch of getLineBranches(line)) {
    if (branch.stations.some(station => station.id === stationId)) {
      const junction = findLineStation(line, branch.fromStationId)
      return junction ? [junction, ...branch.stations] : branch.stations
    }
  }
  return null
}

function chooseBranchPreviousHint(
  line: Pick<GameLine, 'stations' | 'branches'>,
  branch: GameLineBranch,
): GameStation | null {
  const junction = findLineStation(line, branch.fromStationId)
  const first = branch.stations[0]
  if (!junction || !first) return null
  const parent = getParentSequence(line, junction.id)
  if (!parent) return null
  const junctionIndex = parent.findIndex(station => station.id === junction.id)
  if (junctionIndex < 0) return null

  const candidates = [parent[junctionIndex - 1], parent[junctionIndex + 1]].filter(Boolean) as GameStation[]
  if (!candidates.length) return null

  // On choisit le côté du tronc dont la direction d'arrivée ressemble le plus
  // à la direction de départ de la branche. Visuellement la bifurcation quitte
  // ainsi le tronc comme une vraie fourche au lieu de casser à angle sec.
  const projection = createProjection([
    [junction.longitude, junction.latitude],
    [first.longitude, first.latitude],
    ...candidates.map(candidate => [candidate.longitude, candidate.latitude] as GameMapCoordinate),
  ])
  const j = projection.toPlanar([junction.longitude, junction.latitude])
  const branchDirection = directionBetween(j, projection.toPlanar([first.longitude, first.latitude]))

  return candidates
    .map(candidate => {
      const c = projection.toPlanar([candidate.longitude, candidate.latitude])
      const arrivalDirection = directionBetween(c, j)
      return { candidate, score: dot(arrivalDirection, branchDirection) }
    })
    .sort((a, b) => b.score - a.score)[0]?.candidate ?? candidates[0] ?? null
}

function lineRenderSignature(line: Pick<GameLine, 'id' | 'stations' | 'branches' | 'routeSegments'>) {
  const stationPart = (stations: readonly GameStation[]) => stations
    .map(station => `${station.id}:${station.longitude.toFixed(6)}:${station.latitude.toFixed(6)}`)
    .join('|')
  return [
    line.id,
    stationPart(line.stations),
    ...getLineBranches(line).map(branch => `${branch.id}@${branch.fromStationId}:${stationPart(branch.stations)}`),
    ...(line.routeSegments ?? []).map(segment => `${segment.fromStationId}>${segment.toStationId}:${segment.source}:${segment.coordinates.map(point => `${Number(point[0]).toFixed(5)},${Number(point[1]).toFixed(5)}`).join(';')}`),
  ].join('::')
}

function remember(key: string, value: GameRenderedLineSequence[]) {
  renderCache.set(key, value)
  if (renderCache.size <= MAX_CACHE_ENTRIES) return
  const oldest = renderCache.keys().next().value
  if (typeof oldest === 'string') renderCache.delete(oldest)
}


function buildPersistedOrAdaptiveSequence(
  line: Pick<GameLine, 'routeSegments'>,
  stations: readonly GameStation[],
  options: RenderOptions = {},
): GameMapCoordinate[] {
  if (stations.length < 2) return stations.map(station => [station.longitude, station.latitude])
  if (!(line.routeSegments?.length)) return buildAdaptiveRenderedCoordinates(stations, options)
  const result: GameMapCoordinate[] = []
  for (let index = 1; index < stations.length; index += 1) {
    const from = stations[index - 1]!
    const to = stations[index]!
    const routed = getSegmentCoordinates(line, from, to)
    const segment = routed ?? [[from.longitude, from.latitude] as GameMapCoordinate, [to.longitude, to.latitude] as GameMapCoordinate]
    for (const point of segment) {
      const previous = result[result.length - 1]
      if (!previous || Math.abs(previous[0] - point[0]) > 1e-9 || Math.abs(previous[1] - point[1]) > 1e-9) result.push(point)
    }
  }
  return result
}

/**
 * Géométrie purement visuelle d'une ligne. La simulation continue d'utiliser
 * les stations originales et les distances exactes du moteur.
 */
export function getRenderedLineSequences(
  line: Pick<GameLine, 'id' | 'stations' | 'branches' | 'routeSegments'>,
): GameRenderedLineSequence[] {
  const key = lineRenderSignature(line)
  const cached = renderCache.get(key)
  if (cached) return cached

  const sequences: GameRenderedLineSequence[] = []
  if (line.stations.length >= 2) {
    sequences.push({
      id: `${line.id}:main`,
      kind: 'MAIN',
      branchId: null,
      coordinates: buildPersistedOrAdaptiveSequence(line, line.stations),
    })
  }

  for (const branch of getLineBranches(line)) {
    const junction = findLineStation(line, branch.fromStationId)
    if (!junction || !branch.stations.length) continue
    const stations = [junction, ...branch.stations]
    sequences.push({
      id: `${line.id}:branch:${branch.id}`,
      kind: 'BRANCH',
      branchId: branch.id,
      coordinates: buildPersistedOrAdaptiveSequence(line, stations, {
        previousHint: chooseBranchPreviousHint(line, branch),
        maxHandleMeters: 280,
      }),
    })
  }

  remember(key, sequences)
  return sequences
}

export function clearRenderedLineGeometryCache(lineId?: string) {
  if (!lineId) {
    renderCache.clear()
    return
  }
  for (const key of [...renderCache.keys()]) {
    if (key.startsWith(`${lineId}::`)) renderCache.delete(key)
  }
}

/** Nombre de bifurcations réelles d'une ligne, utile au renderer. */
export function getLineJunctionStationIds(line: Pick<GameLine, 'branches'>) {
  return new Set(getLineBranches(line).map(branch => branch.fromStationId))
}

export function isLineBranchStation(
  line: Pick<GameLine, 'stations' | 'branches'>,
  stationId: string,
) {
  const location = findLineStationLocation(line, stationId)
  return Boolean(location && !location.isMain)
}


function physicalStationKey(station: GameStation) {
  return station.sharedStationId
    ? `shared:${station.sharedStationId}`
    : `coord:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}`
}

/**
 * Petit décalage écran pour les lignes partageant exactement un corridor.
 * Il ne touche jamais à la géométrie/simulation et reste volontairement
 * inférieur à quelques pixels : on distingue les couleurs sans créer de faux
 * itinéraires parallèles à grande distance.
 */
export function calculateLineCorridorOffsets(lines: readonly GameLine[]) {
  const lineOrder = new Map(lines.map((line, index) => [line.id, index]))
  const segmentLines = new Map<string, Set<string>>()

  for (const line of lines) {
    for (const sequence of getLineGeometrySequences(line)) {
      for (let index = 0; index < sequence.length - 1; index += 1) {
        const a = physicalStationKey(sequence[index]!)
        const b = physicalStationKey(sequence[index + 1]!)
        const key = a < b ? `${a}<>${b}` : `${b}<>${a}`
        const group = segmentLines.get(key) ?? new Set<string>()
        group.add(line.id)
        segmentLines.set(key, group)
      }
    }
  }

  const samples = new Map<string, number[]>()
  for (const group of segmentLines.values()) {
    if (group.size < 2) continue
    const ids = [...group].sort((a, b) => (lineOrder.get(a) ?? 0) - (lineOrder.get(b) ?? 0))
    const center = (ids.length - 1) / 2
    ids.forEach((id, index) => {
      const values = samples.get(id) ?? []
      values.push((index - center) * 1.35)
      samples.set(id, values)
    })
  }

  const result = new Map<string, number>()
  for (const line of lines) {
    const values = samples.get(line.id)
    if (!values?.length) {
      result.set(line.id, 0)
      continue
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    result.set(line.id, clamp(average, -4.2, 4.2))
  }
  return result
}
