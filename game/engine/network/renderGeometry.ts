import type { GameLine, GameLineBranch, GameStation } from '../../types/network'
import { getTransportModeDefinition } from '../../config/transportModes'
import { findLineStation, findLineStationLocation, getLineAllStations, getLineBranches } from './geometry'
import { getSegmentCoordinates } from './pathGeometry'

export type GameMapCoordinate = [number, number]

export interface GameRenderedLineSequence {
  id: string
  kind: 'MAIN' | 'BRANCH'
  branchId: string | null
  coordinates: GameMapCoordinate[]
}

export interface GameRenderedLineSegment {
  id: string
  lineId: string
  sequenceId: string
  sequenceIndex: number
  kind: 'MAIN' | 'BRANCH'
  branchId: string | null
  fromStationId: string
  toStationId: string
  fromSharedStationId: string | null
  toSharedStationId: string | null
  coordinates: GameMapCoordinate[]
}

export interface GameBundledLineRenderChunk {
  id: string
  sequenceId: string
  kind: 'MAIN' | 'BRANCH'
  branchId: string | null
  coordinates: GameMapCoordinate[]
  corridorOffset: number
  corridorCount: number
}

export interface GameBundledStationRenderHint {
  coordinate: GameMapCoordinate
  tangentStart: GameMapCoordinate
  tangentEnd: GameMapCoordinate
  corridorOffset: number
  corridorCount: number
}

export interface GameBundledPositionRenderHint {
  coordinate: GameMapCoordinate
  tangentStart: GameMapCoordinate
  tangentEnd: GameMapCoordinate
  corridorOffset: number
  corridorCount: number
}

export interface GameBundledPositionRenderRequest {
  key: string
  lineId: string
  target: GameMapCoordinate
  sequenceId?: string | null
  maxDistanceMeters?: number
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
const segmentRenderCache = new Map<string, GameRenderedLineSegment[]>()
let bundledRenderCacheSignature = ''
let bundledRenderCache = new Map<string, GameBundledLineRenderChunk[]>()
let bundledStationHintCacheSignature = ''
let bundledStationHintCache = new Map<string, GameBundledStationRenderHint>()
let bundledPositionIndexCacheSignature = ''
const BUNDLED_POSITION_GRID_DEGREES = .02
interface BundledPositionIndexSegment {
  sequenceId: string
  a: GameMapCoordinate
  b: GameMapCoordinate
  minLongitude: number
  maxLongitude: number
  minLatitude: number
  maxLatitude: number
  corridorOffset: number
  corridorCount: number
}
interface BundledPositionLineIndex {
  segments: BundledPositionIndexSegment[]
  grid: Map<string, number[]>
}
let bundledPositionIndexCache = new Map<string, BundledPositionLineIndex>()

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

function averageLatitude(points: readonly GameMapCoordinate[]) {
  if (!points.length) return 0
  return points.reduce((sum, point) => sum + point[1], 0) / points.length
}

function createProjection(points: readonly GameMapCoordinate[]) {
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


function buildPersistedSegmentCoordinates(
  line: Pick<GameLine, 'routeSegments'>,
  from: GameStation,
  to: GameStation,
): GameMapCoordinate[] {
  const routed = getSegmentCoordinates(line, from, to)
  return routed ?? [[from.longitude, from.latitude] as GameMapCoordinate, [to.longitude, to.latitude] as GameMapCoordinate]
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


function geographicDistanceMeters(a: GameMapCoordinate, b: GameMapCoordinate) {
  const latitude = (a[1] + b[1]) / 2
  const longitudeScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180)) * METERS_PER_LATITUDE_DEGREE
  return Math.hypot(
    (b[0] - a[0]) * longitudeScale,
    (b[1] - a[1]) * METERS_PER_LATITUDE_DEGREE,
  )
}

function polylineLengthMeters(coordinates: readonly GameMapCoordinate[]) {
  let total = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    total += geographicDistanceMeters(coordinates[index - 1]!, coordinates[index]!)
  }
  return total
}

function interpolateCoordinate(a: GameMapCoordinate, b: GameMapCoordinate, t: number): GameMapCoordinate {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ]
}

function pointAtPolylineDistance(
  coordinates: readonly GameMapCoordinate[],
  targetMeters: number,
): GameMapCoordinate {
  if (!coordinates.length) return [0, 0]
  if (coordinates.length === 1 || targetMeters <= 0) return coordinates[0]!

  let travelled = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1]!
    const to = coordinates[index]!
    const length = geographicDistanceMeters(from, to)
    if (length <= 1e-6) continue
    if (travelled + length >= targetMeters) {
      return interpolateCoordinate(from, to, clamp((targetMeters - travelled) / length, 0, 1))
    }
    travelled += length
  }
  return coordinates[coordinates.length - 1]!
}

function slicePolylineByDistance(
  coordinates: readonly GameMapCoordinate[],
  fromMeters: number,
  toMeters: number,
): GameMapCoordinate[] {
  if (coordinates.length < 2) return [...coordinates]
  const total = polylineLengthMeters(coordinates)
  const start = clamp(fromMeters, 0, total)
  const end = clamp(toMeters, start, total)
  if (end - start <= 1e-4) return [pointAtPolylineDistance(coordinates, start)]

  const result: GameMapCoordinate[] = [pointAtPolylineDistance(coordinates, start)]
  let travelled = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const a = coordinates[index - 1]!
    const b = coordinates[index]!
    const length = geographicDistanceMeters(a, b)
    const segmentStart = travelled
    const segmentEnd = travelled + length
    travelled = segmentEnd
    if (segmentEnd <= start + 1e-6) continue
    if (segmentStart >= end - 1e-6) break
    if (segmentEnd < end - 1e-6) {
      const previous = result[result.length - 1]
      if (!previous || geographicDistanceMeters(previous, b) > .01) result.push(b)
    }
    else {
      const endPoint = pointAtPolylineDistance(coordinates, end)
      const previous = result[result.length - 1]
      if (!previous || geographicDistanceMeters(previous, endPoint) > .01) result.push(endPoint)
      break
    }
  }
  return result.length >= 2 ? result : [result[0]!, pointAtPolylineDistance(coordinates, end)]
}

function reverseCoordinates(coordinates: readonly GameMapCoordinate[]) {
  return [...coordinates].reverse() as GameMapCoordinate[]
}


function rightNormalForDirection(direction: PlanarPoint): PlanarPoint {
  return { x: direction.y, y: -direction.x }
}

function normalizedDirectionBetweenCoordinates(a: GameMapCoordinate, b: GameMapCoordinate): PlanarPoint {
  const latitude = (a[1] + b[1]) / 2
  const longitudeScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180)) * METERS_PER_LATITUDE_DEGREE
  return normalize({
    x: (b[0] - a[0]) * longitudeScale,
    y: (b[1] - a[1]) * METERS_PER_LATITUDE_DEGREE,
  })
}

function signedRightDirectionScore(
  origin: GameMapCoordinate,
  target: GameMapCoordinate,
  referenceDirection: PlanarPoint,
) {
  const targetDirection = normalizedDirectionBetweenCoordinates(origin, target)
  if (Math.hypot(targetDirection.x, targetDirection.y) <= 1e-9) return 0
  return dot(targetDirection, rightNormalForDirection(referenceDirection))
}

function simplifyBundledCoordinates(
  coordinates: readonly GameMapCoordinate[],
  toleranceMeters = 14,
): GameMapCoordinate[] {
  if (coordinates.length <= 2) return [...coordinates]
  const projection = createProjection(coordinates)
  const points = coordinates.map(projection.toPlanar)
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[keep.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]

  const pointSegmentDistance = (point: PlanarPoint, start: PlanarPoint, end: PlanarPoint) => {
    const delta = subtract(end, start)
    const lengthSquared = delta.x * delta.x + delta.y * delta.y
    if (lengthSquared <= 1e-9) return distance(point, start)
    const t = clamp(dot(subtract(point, start), delta) / lengthSquared, 0, 1)
    return distance(point, add(start, scale(delta, t)))
  }

  while (stack.length) {
    const [startIndex, endIndex] = stack.pop()!
    let farthestIndex = -1
    let farthestDistance = toleranceMeters
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const currentDistance = pointSegmentDistance(points[index]!, points[startIndex]!, points[endIndex]!)
      if (currentDistance > farthestDistance) {
        farthestDistance = currentDistance
        farthestIndex = index
      }
    }
    if (farthestIndex < 0) continue
    keep[farthestIndex] = 1
    stack.push([startIndex, farthestIndex], [farthestIndex, endIndex])
  }

  return coordinates.filter((_, index) => keep[index] === 1)
}

export function getRenderedLineSegments(
  line: Pick<GameLine, 'id' | 'stations' | 'branches' | 'routeSegments'>,
): GameRenderedLineSegment[] {
  const cacheKey = lineRenderSignature(line)
  const cached = segmentRenderCache.get(cacheKey)
  if (cached) return cached
  const segments: GameRenderedLineSegment[] = []

  const pushSegments = (
    sequenceId: string,
    kind: 'MAIN' | 'BRANCH',
    branchId: string | null,
    stations: readonly GameStation[],
  ) => {
    for (let stationIndex = 1; stationIndex < stations.length; stationIndex += 1) {
      const from = stations[stationIndex - 1]!
      const to = stations[stationIndex]!
      const coordinates = buildPersistedSegmentCoordinates(line, from, to)
      if (coordinates.length < 2) continue
      segments.push({
        id: `${sequenceId}:station:${stationIndex - 1}`,
        lineId: line.id,
        sequenceId,
        sequenceIndex: stationIndex - 1,
        kind,
        branchId,
        fromStationId: from.id,
        toStationId: to.id,
        fromSharedStationId: from.sharedStationId ?? null,
        toSharedStationId: to.sharedStationId ?? null,
        coordinates,
      })
    }
  }

  if (line.stations.length >= 2) pushSegments(`${line.id}:main`, 'MAIN', null, line.stations)
  for (const branch of getLineBranches(line)) {
    const junction = findLineStation(line, branch.fromStationId)
    if (!junction || !branch.stations.length) continue
    pushSegments(`${line.id}:branch:${branch.id}`, 'BRANCH', branch.id, [junction, ...branch.stations])
  }

  segmentRenderCache.set(cacheKey, segments)
  if (segmentRenderCache.size > MAX_CACHE_ENTRIES) {
    const oldest = segmentRenderCache.keys().next().value
    if (typeof oldest === 'string') segmentRenderCache.delete(oldest)
  }
  return segments
}

interface BundleArmPiece {
  segment: GameRenderedLineSegment
  forward: boolean
  fromMeters: number
  toMeters: number
}

interface BundleArm {
  key: string
  lineId: string
  lineOrder: number
  mode: GameLine['mode']
  segment: GameRenderedLineSegment
  endpoint: 'START' | 'END'
  sharedStationId: string
  coordinatesAway: GameMapCoordinate[]
  pieces: BundleArmPiece[]
  lengthMeters: number
  angle: number
}

interface BundleRunSpec {
  arm: BundleArm
  offset: number
  initialOffset: number
  count: number
  startMeters: number
  endMeters: number
  masterCoordinates: GameMapCoordinate[]
  continuesAfter: boolean
}

interface ExactSharedCorridorSpec {
  lineId: string
  segmentId: string
  offset: number
  count: number
  masterCoordinates: GameMapCoordinate[]
}

function exactSharedCorridorKey(segment: GameRenderedLineSegment) {
  const from = segment.fromSharedStationId
  const to = segment.toSharedStationId
  if (!from || !to || from === to) return null
  return from < to ? `${from}<>${to}` : `${to}<>${from}`
}

function canonicalCorridorCoordinates(segment: GameRenderedLineSegment) {
  const from = segment.fromSharedStationId
  const to = segment.toSharedStationId
  if (!from || !to || from <= to) return segment.coordinates
  return reverseCoordinates(segment.coordinates)
}


function continuationAwayFromExactCorridor(
  segment: GameRenderedLineSegment,
  sharedStationId: string,
  segments: readonly GameRenderedLineSegment[],
) {
  const candidates = segments.filter(candidate => {
    if (candidate.id === segment.id || candidate.sequenceId !== segment.sequenceId) return false
    return candidate.fromSharedStationId === sharedStationId || candidate.toSharedStationId === sharedStationId
  })
  if (candidates.length !== 1) return null
  const candidate = candidates[0]!
  return candidate.fromSharedStationId === sharedStationId
    ? candidate.coordinates
    : reverseCoordinates(candidate.coordinates)
}

function exactCorridorLaneOrder(
  lineIds: readonly string[],
  byLine: ReadonlyMap<string, GameRenderedLineSegment[]>,
  segmentsByLine: ReadonlyMap<string, readonly GameRenderedLineSegment[]>,
  masterCoordinates: readonly GameMapCoordinate[],
  lineOrder: ReadonlyMap<string, number>,
) {
  if (masterCoordinates.length < 2) return [...lineIds]
  const total = polylineLengthMeters(masterCoordinates)
  const start = masterCoordinates[0]!
  const end = masterCoordinates[masterCoordinates.length - 1]!
  const startDirection = normalizedDirectionBetweenCoordinates(
    start,
    pointAtPolylineDistance(masterCoordinates, Math.min(total, Math.max(80, Math.min(360, total * .18)))),
  )
  const endDirection = normalizedDirectionBetweenCoordinates(
    pointAtPolylineDistance(masterCoordinates, Math.max(0, total - Math.max(80, Math.min(360, total * .18)))),
    end,
  )

  const entries = lineIds.map((lineId) => {
    const segment = byLine.get(lineId)![0]!
    const segments = segmentsByLine.get(lineId) ?? []
    const canonicalStartsAtFrom = segment.fromSharedStationId != null
      && segment.toSharedStationId != null
      && segment.fromSharedStationId <= segment.toSharedStationId
    const canonicalStartSharedId = canonicalStartsAtFrom ? segment.fromSharedStationId : segment.toSharedStationId
    const canonicalEndSharedId = canonicalStartsAtFrom ? segment.toSharedStationId : segment.fromSharedStationId
    const startContinuation = canonicalStartSharedId
      ? continuationAwayFromExactCorridor(segment, canonicalStartSharedId, segments)
      : null
    const endContinuation = canonicalEndSharedId
      ? continuationAwayFromExactCorridor(segment, canonicalEndSharedId, segments)
      : null
    const scores: number[] = []
    if (startContinuation?.length) {
      const probe = pointAtPolylineDistance(startContinuation, Math.min(8_000, polylineLengthMeters(startContinuation)))
      scores.push(signedRightDirectionScore(start, probe, startDirection))
    }
    if (endContinuation?.length) {
      const probe = pointAtPolylineDistance(endContinuation, Math.min(8_000, polylineLengthMeters(endContinuation)))
      scores.push(signedRightDirectionScore(end, probe, endDirection))
    }
    const strongest = scores.length
      ? [...scores].sort((a, b) => Math.abs(b) - Math.abs(a))[0]!
      : 0
    const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0
    return {
      lineId,
      // La sortie la plus franche décide principalement du côté de la voie ;
      // l'autre extrémité sert seulement à départager les cas proches.
      score: strongest * .78 + average * .22,
      lineOrder: lineOrder.get(lineId) ?? 0,
    }
  })

  return entries
    .sort((a, b) => Math.abs(a.score - b.score) > .015 ? a.score - b.score : a.lineOrder - b.lineOrder)
    .map(entry => entry.lineId)
}

/**
 * Faisceau dur entre deux mêmes stations physiques.
 *
 * Règle visuelle volontaire : si plusieurs lignes relient exactement les mêmes
 * stations physiques, elles sont considérées comme utilisant le même corridor.
 * On abandonne alors les petites différences de géométrie entre lignes et on
 * dessine toutes les couleurs sur UN axe maître, chacune dans sa propre voie.
 * C'est le comportement "câbles électriques" attendu : aucune ligne ne peut
 * passer sous une autre ou disparaître au milieu du segment.
 */
interface ExactCorridorGroup {
  key: string
  stationA: string
  stationB: string
  byLine: Map<string, GameRenderedLineSegment[]>
  lineIds: string[]
  masterCoordinates: GameMapCoordinate[]
  suggestedOrder: string[]
}

function exactCorridorStations(key: string) {
  const separator = key.indexOf('<>')
  return separator < 0
    ? [key, key] as const
    : [key.slice(0, separator), key.slice(separator + 2)] as const
}

function exactCorridorDirectionAtStation(group: ExactCorridorGroup, sharedStationId: string) {
  const total = polylineLengthMeters(group.masterCoordinates)
  if (total <= 1) return { x: 0, y: 0 }
  const probe = Math.min(total, Math.max(90, Math.min(420, total * .16)))
  if (sharedStationId === group.stationA) {
    return normalizedDirectionBetweenCoordinates(
      group.masterCoordinates[0]!,
      pointAtPolylineDistance(group.masterCoordinates, probe),
    )
  }
  if (sharedStationId === group.stationB) {
    return normalizedDirectionBetweenCoordinates(
      pointAtPolylineDistance(group.masterCoordinates, Math.max(0, total - probe)),
      group.masterCoordinates[group.masterCoordinates.length - 1]!,
    )
  }
  return { x: 0, y: 0 }
}

function sharedExactCorridorStation(a: ExactCorridorGroup, b: ExactCorridorGroup) {
  if (a.stationA === b.stationA || a.stationA === b.stationB) return a.stationA
  if (a.stationB === b.stationA || a.stationB === b.stationB) return a.stationB
  return null
}

function exactCorridorSharedLineCount(a: ExactCorridorGroup, b: ExactCorridorGroup) {
  const bIds = new Set(b.lineIds)
  let count = 0
  for (const id of a.lineIds) if (bIds.has(id)) count += 1
  return count
}

function mergePhysicalLaneOrder(existing: string[], local: readonly string[]) {
  const result = [...existing]
  const present = new Set(result)
  for (let localIndex = 0; localIndex < local.length; localIndex += 1) {
    const id = local[localIndex]!
    if (present.has(id)) continue

    let previousExisting: string | null = null
    for (let index = localIndex - 1; index >= 0; index -= 1) {
      const candidate = local[index]!
      if (present.has(candidate)) {
        previousExisting = candidate
        break
      }
    }

    let nextExisting: string | null = null
    for (let index = localIndex + 1; index < local.length; index += 1) {
      const candidate = local[index]!
      if (present.has(candidate)) {
        nextExisting = candidate
        break
      }
    }

    if (previousExisting) {
      const previousIndex = result.indexOf(previousExisting)
      let insertIndex = previousIndex + 1
      if (nextExisting) {
        const nextIndex = result.indexOf(nextExisting)
        if (nextIndex > previousIndex) insertIndex = nextIndex
      }
      result.splice(insertIndex, 0, id)
    }
    else if (nextExisting) result.splice(result.indexOf(nextExisting), 0, id)
    else result.push(id)
    present.add(id)
  }
  return result
}

/**
 * Faisceau dur entre deux mêmes stations physiques.
 *
 * La difficulté n'est pas seulement de séparer les couleurs : l'ordre des
 * voies doit aussi rester invariant d'un segment partagé au suivant. Si deux
 * corridors adjacents choisissent chacun leur propre ordre, les câbles se
 * croisent au droit de la station. On construit donc des composantes de
 * corridors exacts et on leur attribue UN ordre physique commun. Une branche
 * peut enlever/ajouter un câble, mais les câbles déjà présents ne permutent
 * jamais entre eux.
 */
function buildExactSharedCorridorSpecs(
  lines: readonly GameLine[],
  segmentsByLine: ReadonlyMap<string, readonly GameRenderedLineSegment[]>,
) {
  const lineOrder = new Map(lines.map((line, index) => [line.id, index]))
  const lineById = new Map(lines.map(line => [line.id, line] as const))
  const rawGroups = new Map<string, Array<{ lineId: string; segment: GameRenderedLineSegment }>>()

  for (const line of lines) {
    for (const segment of segmentsByLine.get(line.id) ?? []) {
      const key = exactSharedCorridorKey(segment)
      if (!key) continue
      const list = rawGroups.get(key) ?? []
      list.push({ lineId: line.id, segment })
      rawGroups.set(key, list)
    }
  }

  const groups: ExactCorridorGroup[] = []
  for (const [key, entries] of rawGroups.entries()) {
    const byLine = new Map<string, GameRenderedLineSegment[]>()
    for (const entry of entries) {
      const list = byLine.get(entry.lineId) ?? []
      list.push(entry.segment)
      byLine.set(entry.lineId, list)
    }

    // Une ambiguïté interne à une même ligne (boucle/branche utilisant deux fois
    // le même couple de pôles) ne doit pas créer un faisceau artificiel.
    if ([...byLine.values()].some(segments => segments.length !== 1)) continue
    const candidateLineIds = [...byLine.keys()].sort((a, b) => (lineOrder.get(a) ?? 0) - (lineOrder.get(b) ?? 0))
    if (candidateLineIds.length < 2) continue

    const masterLineId = candidateLineIds[0]!
    const masterSegment = byLine.get(masterLineId)![0]!
    const masterCoordinates = simplifyBundledCoordinates(canonicalCorridorCoordinates(masterSegment), 12)
    if (masterCoordinates.length < 2) continue
    const [stationA, stationB] = exactCorridorStations(key)
    groups.push({
      key,
      stationA,
      stationB,
      byLine,
      lineIds: candidateLineIds,
      masterCoordinates,
      suggestedOrder: exactCorridorLaneOrder(candidateLineIds, byLine, segmentsByLine, masterCoordinates, lineOrder),
    })
  }

  // Deux corridors appartiennent à la même nappe de câbles uniquement s'ils se
  // touchent physiquement ET conservent au moins deux mêmes lignes. Une simple
  // correspondance ou un croisement avec une seule ligne commune ne doit jamais
  // propager un ordre de voies dans un autre axe.
  const adjacency = new Map<number, Array<{ index: number; sign: number }>>()
  for (let aIndex = 0; aIndex < groups.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < groups.length; bIndex += 1) {
      const a = groups[aIndex]!
      const b = groups[bIndex]!
      const station = sharedExactCorridorStation(a, b)
      if (!station || exactCorridorSharedLineCount(a, b) < 2) continue
      const aDirection = exactCorridorDirectionAtStation(a, station)
      const bDirection = exactCorridorDirectionAtStation(b, station)
      const orientationSign = dot(aDirection, bDirection) < 0 ? -1 : 1
      const aList = adjacency.get(aIndex) ?? []
      const bList = adjacency.get(bIndex) ?? []
      aList.push({ index: bIndex, sign: orientationSign })
      bList.push({ index: aIndex, sign: orientationSign })
      adjacency.set(aIndex, aList)
      adjacency.set(bIndex, bList)
    }
  }

  const specs = new Map<string, ExactSharedCorridorSpec>()
  const visited = new Set<number>()

  for (let seedIndex = 0; seedIndex < groups.length; seedIndex += 1) {
    if (visited.has(seedIndex)) continue

    const component: number[] = []
    const orientation = new Map<number, number>([[seedIndex, 1]])
    const queue = [seedIndex]
    visited.add(seedIndex)
    while (queue.length) {
      const current = queue.shift()!
      component.push(current)
      for (const edge of adjacency.get(current) ?? []) {
        const expected = (orientation.get(current) ?? 1) * edge.sign
        if (!orientation.has(edge.index)) orientation.set(edge.index, expected)
        if (visited.has(edge.index)) continue
        visited.add(edge.index)
        queue.push(edge.index)
      }
    }

    // On ancre la composante sur le corridor qui transporte le plus de câbles.
    // Son ordre tient déjà compte des destinations futures. Les corridors
    // voisins n'ont ensuite plus le droit de permuter les câbles existants.
    const rootIndex = [...component].sort((aIndex, bIndex) => {
      const a = groups[aIndex]!
      const b = groups[bIndex]!
      if (a.lineIds.length !== b.lineIds.length) return b.lineIds.length - a.lineIds.length
      const aLength = polylineLengthMeters(a.masterCoordinates)
      const bLength = polylineLengthMeters(b.masterCoordinates)
      return bLength - aLength
    })[0]!

    // Réoriente toute la composante par rapport au vrai corridor racine choisi,
    // pas par rapport au premier index arbitraire rencontré pendant le BFS.
    const rootSeedSign = orientation.get(rootIndex) ?? 1
    for (const index of component) orientation.set(index, (orientation.get(index) ?? 1) * rootSeedSign)

    const root = groups[rootIndex]!
    let physicalOrder = (orientation.get(rootIndex) ?? 1) > 0
      ? [...root.suggestedOrder]
      : [...root.suggestedOrder].reverse()

    // Propagation depuis le corridor racine. Les nouvelles lignes s'insèrent à
    // l'endroit suggéré par leur branche, sans jamais réordonner celles qui sont
    // déjà dans le peigne.
    const propagated = new Set<number>()
    const propagationQueue = [rootIndex]
    propagated.add(rootIndex)
    while (propagationQueue.length) {
      const currentIndex = propagationQueue.shift()!
      const current = groups[currentIndex]!
      const localPhysicalOrder = (orientation.get(currentIndex) ?? 1) > 0
        ? current.suggestedOrder
        : [...current.suggestedOrder].reverse()
      physicalOrder = mergePhysicalLaneOrder(physicalOrder, localPhysicalOrder)

      const neighbours = (adjacency.get(currentIndex) ?? [])
        .filter(edge => component.includes(edge.index))
        .sort((a, b) => groups[b.index]!.lineIds.length - groups[a.index]!.lineIds.length)
      for (const edge of neighbours) {
        if (propagated.has(edge.index)) continue
        propagated.add(edge.index)
        propagationQueue.push(edge.index)
      }
    }
    // Composante isolée ou branche non atteinte par sécurité.
    for (const index of component) {
      if (propagated.has(index)) continue
      const group = groups[index]!
      const localPhysicalOrder = (orientation.get(index) ?? 1) > 0
        ? group.suggestedOrder
        : [...group.suggestedOrder].reverse()
      physicalOrder = mergePhysicalLaneOrder(physicalOrder, localPhysicalOrder)
    }

    // IMPORTANT : on réserve une position physique à chaque câble pour TOUTE
    // la composante. Quand une ligne quitte le faisceau, les autres ne se
    // recentrent pas. Le vide reste simplement libre, exactement comme sur un
    // peigne de câbles fixé. Cela supprime les petits déplacements latéraux aux
    // stations qui restaient visibles même sans permutation de couleurs.
    const componentMaxWidth = Math.max(...physicalOrder.map((lineId) => {
      const mode = lineById.get(lineId)?.mode ?? 'METRO'
      return Math.max(1.1, getTransportModeDefinition(mode).mapLineWidth)
    }))
    const componentLanePitch = componentMaxWidth + 5
    const componentCenter = (physicalOrder.length - 1) / 2
    const physicalOffsets = new Map(physicalOrder.map((lineId, laneIndex) => [
      lineId,
      (laneIndex - componentCenter) * componentLanePitch,
    ] as const))

    for (const index of component) {
      const group = groups[index]!
      const sign = (orientation.get(index) ?? 1) > 0 ? 1 : -1
      const lineIds = physicalOrder.filter(id => group.lineIds.includes(id))
      if (lineIds.length < 2) continue

      lineIds.forEach((lineId) => {
        const segment = group.byLine.get(lineId)![0]!
        specs.set(`${lineId}:${segment.id}`, {
          lineId,
          segmentId: segment.id,
          offset: (physicalOffsets.get(lineId) ?? 0) * sign,
          count: lineIds.length,
          masterCoordinates: group.masterCoordinates,
        })
      })
    }
  }

  return specs
}

function armPoint(arm: BundleArm, meters: number) {
  return pointAtPolylineDistance(arm.coordinatesAway, Math.min(meters, arm.lengthMeters))
}

function armDirectionAngle(coordinates: readonly GameMapCoordinate[]) {
  const length = polylineLengthMeters(coordinates)
  const startDistance = Math.min(35, length * .08)
  const endDistance = Math.min(260, Math.max(70, length * .45))
  const start = pointAtPolylineDistance(coordinates, startDistance)
  const end = pointAtPolylineDistance(coordinates, endDistance)
  const latitude = (start[1] + end[1]) / 2
  const longitudeScale = Math.max(0.15, Math.cos(latitude * Math.PI / 180)) * METERS_PER_LATITUDE_DEGREE
  return Math.atan2(
    (end[1] - start[1]) * METERS_PER_LATITUDE_DEGREE,
    (end[0] - start[0]) * longitudeScale,
  )
}

function angleDifference(a: number, b: number) {
  const full = Math.PI * 2
  const delta = Math.abs(a - b) % full
  return Math.min(delta, full - delta)
}

function bundleArmsCompatible(a: BundleArm, b: BundleArm) {
  if (a.lineId === b.lineId) return false
  const minimumLength = Math.min(a.lengthMeters, b.lengthMeters)
  if (minimumLength < 180) return false
  if (angleDifference(a.angle, b.angle) > 22 * Math.PI / 180) return false

  const nearDistance = Math.min(180, minimumLength * .40)
  const farDistance = Math.min(420, minimumLength * .72)
  if (geographicDistanceMeters(armPoint(a, nearDistance), armPoint(b, nearDistance)) > 95) return false
  if (geographicDistanceMeters(armPoint(a, farDistance), armPoint(b, farDistance)) > 155) return false
  return true
}

function bundleCommonEnd(arms: readonly BundleArm[], startMeters: number) {
  const maxLookAhead = Math.min(...arms.map(arm => arm.lengthMeters))
  if (maxLookAhead < startMeters + 320) return startMeters
  let lastGood = startMeters
  let badSamples = 0
  const firstSample = Math.max(startMeters + 120, 150)

  for (let meters = firstSample; meters <= maxLookAhead; meters += 120) {
    const points = arms.map(arm => armPoint(arm, meters))
    let diameter = 0
    for (let aIndex = 0; aIndex < points.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < points.length; bIndex += 1) {
        diameter = Math.max(diameter, geographicDistanceMeters(points[aIndex]!, points[bIndex]!))
      }
    }
    if (diameter <= 220) {
      lastGood = meters
      badSamples = 0
    }
    else {
      badSamples += 1
      if (badSamples >= 2) break
    }
  }
  return lastGood >= startMeters + 360 ? lastGood : startMeters
}

function bundleReferenceArmRange(
  arms: readonly BundleArm[],
  startMeters: number,
  endMeters: number,
  preferred?: BundleArm | null,
) {
  if (preferred && arms.includes(preferred)) return preferred
  const samples: number[] = []
  for (let meters = startMeters + 120; meters <= endMeters; meters += 260) samples.push(meters)
  if (!samples.length) samples.push(Math.min(endMeters, startMeters + 120))

  return [...arms]
    .map((arm) => {
      let score = 0
      for (const meters of samples) {
        const point = armPoint(arm, meters)
        for (const other of arms) score += geographicDistanceMeters(point, armPoint(other, meters))
      }
      return { arm, score }
    })
    .sort((a, b) => a.score - b.score || a.arm.lineOrder - b.arm.lineOrder)[0]!.arm
}

function bundleChildGroups(arms: readonly BundleArm[], splitMeters: number) {
  const probeNear = splitMeters + 220
  const probeFar = splitMeters + 620
  const active = arms.filter(arm => arm.lengthMeters >= probeNear + 40)
  if (active.length < 2) return [] as BundleArm[][]
  const parent = active.map((_, index) => index)
  const find = (index: number): number => {
    let current = index
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!
      current = parent[current]!
    }
    return current
  }
  const unite = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let aIndex = 0; aIndex < active.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < active.length; bIndex += 1) {
      const a = active[aIndex]!
      const b = active[bIndex]!
      const near = geographicDistanceMeters(armPoint(a, probeNear), armPoint(b, probeNear))
      const farDistance = Math.min(probeFar, a.lengthMeters, b.lengthMeters)
      const far = geographicDistanceMeters(armPoint(a, farDistance), armPoint(b, farDistance))
      if (near <= 260 && far <= 420) unite(aIndex, bIndex)
    }
  }

  const groups = new Map<number, BundleArm[]>()
  active.forEach((arm, index) => {
    const root = find(index)
    const group = groups.get(root) ?? []
    group.push(arm)
    groups.set(root, group)
  })
  return [...groups.values()].filter(group => group.length >= 2)
}


function bundleLaneOrder(arms: readonly BundleArm[], master: BundleArm, spanMeters: number) {
  const masterOrigin = master.coordinatesAway[0]!
  const masterDirection = normalizedDirectionBetweenCoordinates(
    masterOrigin,
    pointAtPolylineDistance(master.coordinatesAway, Math.min(master.lengthMeters, Math.max(180, Math.min(520, spanMeters * .22)))),
  )

  const ranked = arms.map((arm) => {
    // On ne trie surtout plus les voies à partir des petits écarts présents
    // *dans* le faisceau. On regarde où la ligne va APRÈS le tronc commun.
    // Une ligne qui va sortir à gauche prend une voie de gauche avant la
    // bifurcation ; une ligne qui sort à droite prend une voie de droite.
    const futureDistance = Math.min(
      arm.lengthMeters,
      Math.max(spanMeters + 900, Math.min(arm.lengthMeters, spanMeters + 3_200)),
    )
    const futurePoint = armPoint(arm, futureDistance)
    const destinationPoint = arm.coordinatesAway[arm.coordinatesAway.length - 1]!
    const futureScore = signedRightDirectionScore(masterOrigin, futurePoint, masterDirection)
    const destinationScore = signedRightDirectionScore(masterOrigin, destinationPoint, masterDirection)
    const score = futureScore * .72 + destinationScore * .28
    return { lineId: arm.lineId, score, lineOrder: arm.lineOrder }
  })

  const byLine = new Map<string, { scoreTotal: number; samples: number; lineOrder: number }>()
  for (const entry of ranked) {
    const current = byLine.get(entry.lineId) ?? { scoreTotal: 0, samples: 0, lineOrder: entry.lineOrder }
    current.scoreTotal += entry.score
    current.samples += 1
    current.lineOrder = Math.min(current.lineOrder, entry.lineOrder)
    byLine.set(entry.lineId, current)
  }

  return [...byLine.entries()]
    .sort(([, a], [, b]) => {
      const aScore = a.scoreTotal / Math.max(1, a.samples)
      const bScore = b.scoreTotal / Math.max(1, b.samples)
      if (Math.abs(aScore - bScore) > .015) return aScore - bScore
      return a.lineOrder - b.lineOrder
    })
    .map(([lineId]) => lineId)
}

function appendCoordinatesDeduplicated(
  target: GameMapCoordinate[],
  coordinates: readonly GameMapCoordinate[],
) {
  for (const coordinate of coordinates) {
    const previous = target[target.length - 1]
    if (!previous || geographicDistanceMeters(previous, coordinate) > .05) target.push(coordinate)
  }
}

function buildExtendedBundleArm(
  line: GameLine,
  segment: GameRenderedLineSegment,
  endpoint: 'START' | 'END',
  sequenceSegments: readonly GameRenderedLineSegment[],
  exactSegmentKeys: ReadonlySet<string>,
) {
  const startIndex = sequenceSegments.findIndex(candidate => candidate.id === segment.id)
  if (startIndex < 0) return null
  const step = endpoint === 'START' ? 1 : -1
  const coordinatesAway: GameMapCoordinate[] = []
  const pieces: BundleArmPiece[] = []
  let total = 0
  // On suit toute la séquence : un corridor partagé peut rester commun sur
  // plusieurs dizaines de kilomètres. L'ancien plafond à 14 km cassait par
  // exemple le faisceau B/K vers Aulnay alors que les deux lignes continuaient
  // encore sur la même emprise. Le résultat est mis en cache au niveau réseau.
  const maxArmMeters = Number.POSITIVE_INFINITY

  for (let index = startIndex; index >= 0 && index < sequenceSegments.length; index += step) {
    const candidate = sequenceSegments[index]!
    // Un corridor exact possède déjà son propre peigne sur toute sa longueur ;
    // on ne laisse jamais un faisceau local le traverser ou le remplacer.
    if (candidate.id !== segment.id && exactSegmentKeys.has(`${line.id}:${candidate.id}`)) break
    const forward = step > 0
    const oriented = forward ? candidate.coordinates : reverseCoordinates(candidate.coordinates)
    const remaining = maxArmMeters - total
    const candidateLength = polylineLengthMeters(oriented)
    const used = candidateLength > remaining
      ? slicePolylineByDistance(oriented, 0, remaining)
      : oriented
    const usedLength = polylineLengthMeters(used)
    if (usedLength <= .05) continue
    const fromMeters = total
    appendCoordinatesDeduplicated(coordinatesAway, used)
    total += usedLength
    pieces.push({ segment: candidate, forward, fromMeters, toMeters: total })
    if (candidateLength > remaining) break
  }

  if (coordinatesAway.length < 2 || total < 180) return null
  return { coordinatesAway, pieces, lengthMeters: total }
}

interface StationBundleGroupInfo {
  arms: BundleArm[]
  rootEnd: number
  rootMaster: BundleArm
  fallbackOrder: string[]
}

interface StationLaneLayout {
  offsets: Map<string, number>
  referenceDirection: PlanarPoint
  pitch: number
}

function bundleArmInitialDirection(arm: BundleArm) {
  if (arm.coordinatesAway.length < 2) return { x: 0, y: 0 }
  const probeDistance = Math.min(420, Math.max(120, arm.lengthMeters * .12))
  return normalizedDirectionBetweenCoordinates(
    arm.coordinatesAway[0]!,
    pointAtPolylineDistance(arm.coordinatesAway, probeDistance),
  )
}

/**
 * Un même pôle peut avoir plusieurs faisceaux de part et d'autre de la station.
 * Ils ne doivent surtout pas choisir leur ordre de voies indépendamment : sinon
 * une ligne change de côté au droit de la station et coupe ses voisines.
 *
 * On prend le plus gros faisceau comme peigne de référence. Les faisceaux qui
 * n'en sont qu'un sous-ensemble héritent exactement de ses voies ; lorsqu'ils
 * repartent dans le sens opposé, le signe est inversé car `line-offset` est
 * relatif au sens de la géométrie. Physiquement, le câble reste donc du même
 * côté du corridor.
 */
function exactStationLaneAnchors(
  sharedStationId: string,
  referenceDirection: PlanarPoint,
  segmentsByLine: ReadonlyMap<string, readonly GameRenderedLineSegment[]>,
  exactCorridorSpecs: ReadonlyMap<string, ExactSharedCorridorSpec>,
) {
  const samples = new Map<string, number[]>()
  for (const [lineId, segments] of segmentsByLine.entries()) {
    for (const segment of segments) {
      if (segment.fromSharedStationId !== sharedStationId && segment.toSharedStationId !== sharedStationId) continue
      const spec = exactCorridorSpecs.get(`${lineId}:${segment.id}`)
      if (!spec || spec.masterCoordinates.length < 2) continue
      const total = polylineLengthMeters(spec.masterCoordinates)
      if (total <= 1) continue
      const probe = Math.min(total, Math.max(90, Math.min(420, total * .16)))
      const canonicalStartsAtFrom = segment.fromSharedStationId != null
        && segment.toSharedStationId != null
        && segment.fromSharedStationId <= segment.toSharedStationId
      const canonicalStartSharedId = canonicalStartsAtFrom ? segment.fromSharedStationId : segment.toSharedStationId
      const direction = canonicalStartSharedId === sharedStationId
        ? normalizedDirectionBetweenCoordinates(spec.masterCoordinates[0]!, pointAtPolylineDistance(spec.masterCoordinates, probe))
        : normalizedDirectionBetweenCoordinates(
            pointAtPolylineDistance(spec.masterCoordinates, Math.max(0, total - probe)),
            spec.masterCoordinates[spec.masterCoordinates.length - 1]!,
          )
      const sign = dot(direction, referenceDirection) < 0 ? -1 : 1
      const list = samples.get(lineId) ?? []
      list.push(spec.offset * sign)
      samples.set(lineId, list)
    }
  }

  const result = new Map<string, number>()
  for (const [lineId, values] of samples.entries()) {
    // Grâce à l'ordre de composante des corridors exacts, plusieurs valeurs au
    // même pôle doivent déjà être cohérentes. La moyenne absorbe uniquement les
    // minuscules différences numériques de pitch entre modes.
    result.set(lineId, values.reduce((sum, value) => sum + value, 0) / values.length)
  }
  return result
}

function buildStationLaneLayout(
  sharedStationId: string,
  groups: readonly StationBundleGroupInfo[],
  lineById: ReadonlyMap<string, GameLine>,
  segmentsByLine: ReadonlyMap<string, readonly GameRenderedLineSegment[]>,
  exactCorridorSpecs: ReadonlyMap<string, ExactSharedCorridorSpec>,
) {
  if (!groups.length) return null
  const dominant = [...groups].sort((a, b) => {
    const aLines = new Set(a.arms.map(arm => arm.lineId)).size
    const bLines = new Set(b.arms.map(arm => arm.lineId)).size
    if (aLines !== bLines) return bLines - aLines
    return b.rootEnd - a.rootEnd
  })[0]!

  const referenceDirection = bundleArmInitialDirection(dominant.rootMaster)
  let stationOrder = [...dominant.fallbackOrder]
  for (const group of groups) {
    const groupDirection = bundleArmInitialDirection(group.rootMaster)
    const localOrder = dot(groupDirection, referenceDirection) < -.20
      ? [...group.fallbackOrder].reverse()
      : group.fallbackOrder
    stationOrder = mergePhysicalLaneOrder(stationOrder, localOrder)
  }
  if (stationOrder.length < 2) return null

  const anchors = exactStationLaneAnchors(sharedStationId, referenceDirection, segmentsByLine, exactCorridorSpecs)
  const maxWidth = Math.max(...stationOrder.map((id) => {
    const mode = lineById.get(id)?.mode ?? 'METRO'
    return Math.max(1.1, getTransportModeDefinition(mode).mapLineWidth)
  }))
  const pitch = maxWidth + 5

  if (!anchors.size) {
    const center = (stationOrder.length - 1) / 2
    return {
      offsets: new Map(stationOrder.map((id, index) => [id, (index - center) * pitch] as const)),
      referenceDirection,
      pitch,
    } satisfies StationLaneLayout
  }

  // Le peigne logique de la station est désormais prioritaire. Les anciens
  // offsets de corridors exacts ne sont plus des positions verrouillées : ils
  // servent uniquement à translater le paquet sans en modifier l'ordre. C'est
  // essentiel aux bifurcations : une ligne qui part à droite doit déjà être à
  // droite AVANT le nœud, même si un corridor précédent l'avait placée ailleurs.
  // Aucun câble ne peut partager la même voie ni permuter localement.
  const center = (stationOrder.length - 1) / 2
  const baseOffsets = new Map(stationOrder.map((id, index) => [id, (index - center) * pitch] as const))

  let translation = 0
  const anchorTranslations = stationOrder
    .filter(id => anchors.has(id))
    .map(id => (anchors.get(id) ?? 0) - (baseOffsets.get(id) ?? 0))
  if (anchorTranslations.length) {
    // Médiane : un ancien corridor atypique ne peut pas tirer tout le faisceau
    // de son côté. L'ordre gauche→droite reste strictement celui de stationOrder.
    const sorted = [...anchorTranslations].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    translation = sorted.length % 2
      ? sorted[middle]!
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  }

  return {
    offsets: new Map(stationOrder.map(id => [id, (baseOffsets.get(id) ?? 0) + translation] as const)),
    referenceDirection,
    pitch,
  } satisfies StationLaneLayout
}

function inheritedStationLaneOffsets(
  group: StationBundleGroupInfo,
  stationLayout: StationLaneLayout | null,
  lineById: ReadonlyMap<string, GameLine>,
) {
  const ids = [...new Set(group.arms.map(arm => arm.lineId))]
  if (ids.length < 2) return new Map<string, number>()

  if (stationLayout && ids.every(id => stationLayout.offsets.has(id))) {
    const groupDirection = bundleArmInitialDirection(group.rootMaster)
    const directionDot = dot(groupDirection, stationLayout.referenceDirection)
    const sign = directionDot < -.20 ? -1 : 1
    return new Map(ids.map(id => [id, (stationLayout.offsets.get(id) ?? 0) * sign] as const))
  }

  const orderedLineIds = group.fallbackOrder
  const maxWidth = Math.max(...orderedLineIds.map((id) => {
    const mode = lineById.get(id)?.mode ?? 'METRO'
    return Math.max(1.1, getTransportModeDefinition(mode).mapLineWidth)
  }))
  const lanePitch = maxWidth + 5
  const center = (orderedLineIds.length - 1) / 2
  return new Map(orderedLineIds.map((id, index) => [id, (index - center) * lanePitch] as const))
}

function dedupeStationBundleArms(arms: readonly BundleArm[]) {
  const result: BundleArm[] = []
  // Les mêmes séquences physiques peuvent apparaître à la fois dans le tronc et
  // dans une branche/service. Si deux bras d'une même ligne sont pratiquement
  // identiques, ce n'est pas une vraie ambiguïté : on garde simplement le plus
  // long. Sans cette déduplication, tout le groupe était rejeté à Corbeil.
  const ordered = [...arms].sort((a, b) => b.lengthMeters - a.lengthMeters)
  for (const arm of ordered) {
    const duplicate = result.some((candidate) => {
      if (candidate.lineId !== arm.lineId) return false
      if (angleDifference(candidate.angle, arm.angle) > 3 * Math.PI / 180) return false
      const near = Math.min(120, candidate.lengthMeters, arm.lengthMeters)
      const far = Math.min(420, candidate.lengthMeters, arm.lengthMeters)
      return geographicDistanceMeters(armPoint(candidate, near), armPoint(arm, near)) <= 18
        && geographicDistanceMeters(armPoint(candidate, far), armPoint(arm, far)) <= 35
    })
    if (!duplicate) result.push(arm)
  }
  return result.sort((a, b) => a.lineOrder - b.lineOrder || a.key.localeCompare(b.key))
}

function buildBundleRuns(
  lines: readonly GameLine[],
  segmentsByLine: ReadonlyMap<string, readonly GameRenderedLineSegment[]>,
  exactCorridorSpecs: ReadonlyMap<string, ExactSharedCorridorSpec>,
) {
  const exactSegmentKeys = new Set(exactCorridorSpecs.keys())
  const armsByStation = new Map<string, BundleArm[]>()
  const lineOrder = new Map(lines.map((line, index) => [line.id, index]))
  const lineById = new Map(lines.map(line => [line.id, line] as const))

  for (const line of lines) {
    const allSegments = segmentsByLine.get(line.id) ?? []
    const bySequence = new Map<string, GameRenderedLineSegment[]>()
    for (const segment of allSegments) {
      const list = bySequence.get(segment.sequenceId) ?? []
      list.push(segment)
      bySequence.set(segment.sequenceId, list)
    }
    for (const list of bySequence.values()) list.sort((a, b) => a.sequenceIndex - b.sequenceIndex)

    for (const segment of allSegments) {
      // Les corridors exacts sont déjà traités intégralement et restent la
      // source de vérité prioritaire.
      if (exactSegmentKeys.has(`${line.id}:${segment.id}`)) continue
      const sequenceSegments = bySequence.get(segment.sequenceId) ?? []
      const addArm = (sharedStationId: string, endpoint: 'START' | 'END') => {
        const extended = buildExtendedBundleArm(line, segment, endpoint, sequenceSegments, exactSegmentKeys)
        if (!extended) return
        const arm: BundleArm = {
          key: `${line.id}:${segment.id}:${endpoint}`,
          lineId: line.id,
          lineOrder: lineOrder.get(line.id) ?? 0,
          mode: line.mode,
          segment,
          endpoint,
          sharedStationId,
          coordinatesAway: extended.coordinatesAway,
          pieces: extended.pieces,
          lengthMeters: extended.lengthMeters,
          angle: armDirectionAngle(extended.coordinatesAway),
        }
        const list = armsByStation.get(sharedStationId) ?? []
        list.push(arm)
        armsByStation.set(sharedStationId, list)
      }

      if (segment.fromSharedStationId) addArm(segment.fromSharedStationId, 'START')
      if (segment.toSharedStationId) addArm(segment.toSharedStationId, 'END')
    }
  }

  const runs: BundleRunSpec[] = []
  for (const [sharedStationId, rawArms] of armsByStation.entries()) {
    const arms = dedupeStationBundleArms(rawArms)
    if (arms.length < 2) continue
    const parent = arms.map((_, index) => index)
    const find = (index: number): number => {
      let current = index
      while (parent[current] !== current) {
        parent[current] = parent[parent[current]!]!
        current = parent[current]!
      }
      return current
    }
    const unite = (a: number, b: number) => {
      const rootA = find(a)
      const rootB = find(b)
      if (rootA !== rootB) parent[rootB] = rootA
    }

    for (let aIndex = 0; aIndex < arms.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < arms.length; bIndex += 1) {
        if (bundleArmsCompatible(arms[aIndex]!, arms[bIndex]!)) unite(aIndex, bIndex)
      }
    }

    const groups = new Map<number, BundleArm[]>()
    arms.forEach((arm, index) => {
      const root = find(index)
      const group = groups.get(root) ?? []
      group.push(arm)
      groups.set(root, group)
    })

    const groupInfos: StationBundleGroupInfo[] = []
    for (const group of groups.values()) {
      const armCountByLine = new Map<string, number>()
      for (const arm of group) armCountByLine.set(arm.lineId, (armCountByLine.get(arm.lineId) ?? 0) + 1)
      if ([...armCountByLine.values()].some(count => count > 1)) continue
      const uniqueLineIds = new Set(group.map(arm => arm.lineId))
      if (uniqueLineIds.size < 2) continue
      const rootEnd = bundleCommonEnd(group, 0)
      if (rootEnd <= 0) continue
      const rootMaster = bundleReferenceArmRange(group, 0, rootEnd)
      const fallbackOrder = bundleLaneOrder(group, rootMaster, rootEnd)
      if (fallbackOrder.length < 2) continue
      groupInfos.push({ arms: group, rootEnd, rootMaster, fallbackOrder })
    }

    // Toutes les directions d'un même pôle partagent désormais le même peigne.
    // Un sous-faisceau situé de l'autre côté de la station hérite donc des
    // positions du faisceau principal au lieu de recomposer ses voies et de
    // faire croiser les couleurs au droit du pôle.
    const stationLayout = buildStationLaneLayout(
      sharedStationId,
      groupInfos,
      lineById,
      segmentsByLine,
      exactCorridorSpecs,
    )
    const exactAnchors = stationLayout
      ? exactStationLaneAnchors(sharedStationId, stationLayout.referenceDirection, segmentsByLine, exactCorridorSpecs)
      : new Map<string, number>()

    for (const groupInfo of groupInfos) {
      const group = groupInfo.arms
      const rootMaster = groupInfo.rootMaster
      const laneByLine = inheritedStationLaneOffsets(groupInfo, stationLayout, lineById)
      const groupDirection = bundleArmInitialDirection(groupInfo.rootMaster)
      const stationDirectionSign = stationLayout && dot(groupDirection, stationLayout.referenceDirection) < -.20 ? -1 : 1
      const initialLaneByLine = new Map<string, number>()
      for (const [lineId, offset] of laneByLine.entries()) {
        const anchored = exactAnchors.get(lineId)
        initialLaneByLine.set(lineId, anchored == null ? offset : anchored * stationDirectionSign)
      }

      // Une transition d'espacement est autorisée, une permutation ne l'est
      // jamais. Si un ancien corridor donne un ordre physique différent du
      // nouveau peigne logique, on prend directement le nouvel ordre au pôle :
      // la pastille masque ce petit raccord, tandis qu'un ramp croisé créerait
      // deux câbles qui se traversent en pleine voie.
      const laneIds = [...laneByLine.keys()]
      const targetOrder = [...laneIds].sort((a, b) => (laneByLine.get(a) ?? 0) - (laneByLine.get(b) ?? 0))
      const initialOrder = [...laneIds].sort((a, b) => (initialLaneByLine.get(a) ?? 0) - (initialLaneByLine.get(b) ?? 0))
      if (targetOrder.some((id, index) => initialOrder[index] !== id)) {
        for (const [lineId, offset] of laneByLine.entries()) initialLaneByLine.set(lineId, offset)
      }

      const emitGroup = (
        currentGroup: BundleArm[],
        startMeters: number,
        preferredMaster: BundleArm | null,
        parentMasterEnd: GameMapCoordinate | null,
        depth: number,
      ) => {
        if (depth > 16 || currentGroup.length < 2) return
        const endMeters = bundleCommonEnd(currentGroup, startMeters)
        if (endMeters <= startMeters + 300) return
        const master = bundleReferenceArmRange(currentGroup, startMeters, endMeters, preferredMaster)
        let masterCoordinates = simplifyBundledCoordinates(
          slicePolylineByDistance(master.coordinatesAway, startMeters, endMeters),
          12,
        )
        if (masterCoordinates.length < 2) return
        if (parentMasterEnd) {
          masterCoordinates = [...masterCoordinates]
          masterCoordinates[0] = parentMasterEnd
        }
        const masterEnd = masterCoordinates[masterCoordinates.length - 1]!
        const childGroups = bundleChildGroups(currentGroup, endMeters)
        const childByLine = new Map<string, BundleArm[]>()
        for (const child of childGroups) for (const arm of child) childByLine.set(arm.lineId, child)

        for (const arm of currentGroup) {
          const offset = laneByLine.get(arm.lineId)
          if (offset == null) continue
          runs.push({
            arm,
            offset,
            initialOffset: startMeters <= .5 ? (initialLaneByLine.get(arm.lineId) ?? offset) : offset,
            count: currentGroup.length,
            startMeters,
            endMeters,
            masterCoordinates,
            continuesAfter: childByLine.has(arm.lineId),
          })
        }

        for (const child of childGroups) {
          const childPreferred = child.includes(master) ? master : null
          emitGroup(child, endMeters, childPreferred, masterEnd, depth + 1)
        }
      }

      emitGroup(group, 0, rootMaster, null, 0)
    }
  }
  return runs
}

function appendChunk(
  target: GameBundledLineRenderChunk[],
  baseId: string,
  sequenceId: string,
  kind: 'MAIN' | 'BRANCH',
  branchId: string | null,
  coordinates: GameMapCoordinate[],
  corridorOffset: number,
  corridorCount: number,
) {
  if (coordinates.length < 2 || polylineLengthMeters(coordinates) < .05) return
  const previous = target[target.length - 1]
  const first = coordinates[0]!
  const previousLast = previous?.coordinates[previous.coordinates.length - 1]
  const merge = Boolean(
    previous
    && previous.sequenceId === sequenceId
    && previous.kind === kind
    && previous.branchId === branchId
    && Math.abs(previous.corridorOffset - corridorOffset) < .01
    && (previous.corridorCount === corridorCount || (previous.corridorCount > 1 && corridorCount > 1))
    && previousLast
    && geographicDistanceMeters(previousLast, first) < .08
  )
  if (merge && previous) {
    previous.coordinates.push(...coordinates.slice(1))
    previous.corridorCount = Math.max(previous.corridorCount, corridorCount)
    return
  }
  target.push({
    id: `${baseId}:chunk:${target.length}`,
    sequenceId,
    kind,
    branchId,
    coordinates,
    corridorOffset,
    corridorCount,
  })
}

function renderedCoordinateKey(coordinate: GameMapCoordinate) {
  return `${coordinate[0].toFixed(7)}:${coordinate[1].toFixed(7)}`
}

/**
 * Les faisceaux sont découverts depuis plusieurs pôles. Deux morceaux d'une
 * même ligne peuvent donc être produits à des moments différents alors qu'ils
 * se touchent exactement. Les laisser comme deux Features MapLibre crée deux
 * `round-cap` au lieu d'un vrai `line-join`, visible comme un petit crochet.
 * On recolle ici ces morceaux quand leur voie physique est identique.
 */
function mergeCompatibleLineChunks(chunks: readonly GameBundledLineRenderChunk[]) {
  const buckets = new Map<string, GameBundledLineRenderChunk[]>()
  for (const chunk of chunks) {
    const sharedClass = chunk.corridorCount > 1 ? 'shared' : 'single'
    const offsetKey = Math.round(chunk.corridorOffset * 100) / 100
    const key = `${chunk.sequenceId}|${chunk.kind}|${chunk.branchId ?? ''}|${offsetKey}|${sharedClass}`
    const bucket = buckets.get(key) ?? []
    bucket.push({ ...chunk, coordinates: [...chunk.coordinates] })
    buckets.set(key, bucket)
  }

  const merged: GameBundledLineRenderChunk[] = []
  for (const bucket of buckets.values()) {
    if (bucket.length <= 1) {
      merged.push(...bucket)
      continue
    }
    const byStart = new Map<string, GameBundledLineRenderChunk[]>()
    const endKeys = new Set<string>()
    for (const chunk of bucket) {
      const first = chunk.coordinates[0]
      const last = chunk.coordinates[chunk.coordinates.length - 1]
      if (!first || !last) continue
      const list = byStart.get(renderedCoordinateKey(first)) ?? []
      list.push(chunk)
      byStart.set(renderedCoordinateKey(first), list)
      endKeys.add(renderedCoordinateKey(last))
    }

    const consumed = new Set<GameBundledLineRenderChunk>()
    const starts = bucket.filter((chunk) => {
      const first = chunk.coordinates[0]
      return Boolean(first && !endKeys.has(renderedCoordinateKey(first)))
    })
    const seeds = starts.length ? starts : bucket

    const consumeChain = (seed: GameBundledLineRenderChunk) => {
      if (consumed.has(seed)) return
      consumed.add(seed)
      const combined: GameBundledLineRenderChunk = { ...seed, coordinates: [...seed.coordinates] }
      while (true) {
        const last = combined.coordinates[combined.coordinates.length - 1]
        if (!last) break
        const candidates = byStart.get(renderedCoordinateKey(last)) ?? []
        const next = candidates.find(candidate => !consumed.has(candidate))
        if (!next) break
        consumed.add(next)
        combined.coordinates.push(...next.coordinates.slice(1))
        combined.corridorCount = Math.max(combined.corridorCount, next.corridorCount)
      }
      merged.push(combined)
    }

    for (const seed of seeds) consumeChain(seed)
    for (const chunk of bucket) consumeChain(chunk)
  }
  return merged
}

function appendOffsetRamp(
  target: GameBundledLineRenderChunk[],
  baseId: string,
  segment: GameRenderedLineSegment,
  coordinates: readonly GameMapCoordinate[],
  fromMeters: number,
  toMeters: number,
  fromOffset: number,
  toOffset: number,
  corridorCount: number,
  steps = 7,
) {
  const length = toMeters - fromMeters
  if (length <= .1) return
  for (let index = 0; index < steps; index += 1) {
    const start = fromMeters + length * index / steps
    const end = fromMeters + length * (index + 1) / steps
    const progress = (index + .5) / steps
    appendChunk(
      target,
      baseId,
      segment.sequenceId,
      segment.kind,
      segment.branchId,
      slicePolylineByDistance(coordinates, start, end),
      fromOffset + (toOffset - fromOffset) * progress,
      corridorCount,
    )
  }
}

function bundleRejoinTargetMeters(arm: BundleArm, endMeters: number) {
  // On réintègre la géométrie individuelle au prochain vrai nœud/station de la
  // ligne, pas quelques centaines de mètres après le faisceau. Une transition
  // répartie sur tout un inter-arrêt est visuellement beaucoup plus propre et
  // évite le petit "S" local visible quand l'offset change trop vite.
  const nextPiece = arm.pieces.find(piece => piece.toMeters > endMeters + .5)
  if (!nextPiece) return arm.lengthMeters
  let target = nextPiece.toMeters
  if (target - endMeters < 420) {
    const index = arm.pieces.indexOf(nextPiece)
    const following = arm.pieces[index + 1]
    if (following) target = following.toMeters
  }
  return Math.min(arm.lengthMeters, target)
}

function progressiveRejoinCoordinates(
  masterEnd: GameMapCoordinate,
  originalCoordinates: readonly GameMapCoordinate[],
  fromMeters: number,
  toMeters: number,
) {
  const slice = slicePolylineByDistance(originalCoordinates, fromMeters, toMeters)
  if (slice.length < 2) return slice
  const projection = createProjection([masterEnd, ...slice])
  const masterPlanar = projection.toPlanar(masterEnd)
  const originalStartPlanar = projection.toPlanar(slice[0]!)
  const delta = subtract(masterPlanar, originalStartPlanar)
  const total = Math.max(.001, polylineLengthMeters(slice))
  let travelled = 0
  const result: GameMapCoordinate[] = []

  for (let index = 0; index < slice.length; index += 1) {
    if (index > 0) travelled += geographicDistanceMeters(slice[index - 1]!, slice[index]!)
    const progress = clamp(travelled / total, 0, 1)
    // Smoothstep : tangence douce au départ et à l'arrivée. On conserve la
    // forme générale du tracé individuel mais on la translate progressivement
    // depuis l'axe maître vers sa position réelle.
    const eased = progress * progress * (3 - 2 * progress)
    const point = projection.toPlanar(slice[index]!)
    result.push(projection.toGeographic(add(point, scale(delta, 1 - eased))))
  }

  result[0] = masterEnd
  result[result.length - 1] = slice[slice.length - 1]!
  return result
}


interface SegmentCoverageInterval {
  fromMeters: number
  toMeters: number
}

function addCoverageInterval(
  target: Map<string, SegmentCoverageInterval[]>,
  lineId: string,
  piece: BundleArmPiece,
  armFromMeters: number,
  armToMeters: number,
) {
  const overlapFrom = Math.max(piece.fromMeters, armFromMeters)
  const overlapTo = Math.min(piece.toMeters, armToMeters)
  if (overlapTo <= overlapFrom + .05) return
  const segmentLength = polylineLengthMeters(piece.segment.coordinates)
  const localFromAway = overlapFrom - piece.fromMeters
  const localToAway = overlapTo - piece.fromMeters
  const fromMeters = piece.forward ? localFromAway : segmentLength - localToAway
  const toMeters = piece.forward ? localToAway : segmentLength - localFromAway
  const key = `${lineId}:${piece.segment.id}`
  const list = target.get(key) ?? []
  list.push({ fromMeters: Math.max(0, fromMeters), toMeters: Math.min(segmentLength, toMeters) })
  target.set(key, list)
}

function mergeCoverageIntervals(intervals: readonly SegmentCoverageInterval[]) {
  const sorted = [...intervals]
    .filter(interval => interval.toMeters > interval.fromMeters + .05)
    .sort((a, b) => a.fromMeters - b.fromMeters)
  const result: SegmentCoverageInterval[] = []
  for (const interval of sorted) {
    const previous = result[result.length - 1]
    if (previous && interval.fromMeters <= previous.toMeters + .25) {
      previous.toMeters = Math.max(previous.toMeters, interval.toMeters)
    }
    else result.push({ ...interval })
  }
  return result
}

function appendOriginalUncoveredParts(
  target: GameBundledLineRenderChunk[],
  segment: GameRenderedLineSegment,
  intervals: readonly SegmentCoverageInterval[],
) {
  const total = polylineLengthMeters(segment.coordinates)
  if (total <= .05) return
  const merged = mergeCoverageIntervals(intervals)
  let cursor = 0
  for (const interval of merged) {
    if (interval.fromMeters > cursor + .05) {
      appendChunk(
        target,
        `${segment.id}:original`,
        segment.sequenceId,
        segment.kind,
        segment.branchId,
        slicePolylineByDistance(segment.coordinates, cursor, interval.fromMeters),
        0,
        1,
      )
    }
    cursor = Math.max(cursor, interval.toMeters)
  }
  if (cursor < total - .05) {
    appendChunk(
      target,
      `${segment.id}:original`,
      segment.sequenceId,
      segment.kind,
      segment.branchId,
      slicePolylineByDistance(segment.coordinates, cursor, total),
      0,
      1,
    )
  }
}

function appendBundleRun(
  target: GameBundledLineRenderChunk[],
  run: BundleRunSpec,
  coverage: Map<string, SegmentCoverageInterval[]>,
) {
  const startMeters = Math.max(0, run.startMeters)
  const endMeters = Math.min(run.endMeters, run.arm.lengthMeters)
  const intervalLength = endMeters - startMeters
  if (intervalLength < 220) return
  const baseId = `${run.arm.key}:multisegment:${Math.round(startMeters)}-${Math.round(endMeters)}`
  const localChunks: GameBundledLineRenderChunk[] = []
  let coverageEndMeters = endMeters

  const appendSharedMaster = () => {
    const masterLength = polylineLengthMeters(run.masterCoordinates)
    const offsetDelta = run.offset - run.initialOffset
    if (startMeters <= .5 && Math.abs(offsetDelta) > .05 && masterLength >= 320) {
      // Un corridor précédent peut arriver avec le bon ordre mais un paquet plus
      // serré. On élargit alors les voies progressivement APRÈS la station,
      // jamais par un saut de quelques pixels au droit de la pastille.
      const rampLength = Math.min(masterLength * .42, 1_600)
      const steps = clamp(Math.round(rampLength / 110), 10, 20)
      appendOffsetRamp(
        localChunks,
        `${baseId}:entry-lane-ramp`,
        run.arm.segment,
        run.masterCoordinates,
        0,
        rampLength,
        run.initialOffset,
        run.offset,
        run.count,
        steps,
      )
      if (rampLength < masterLength - .05) {
        appendChunk(
          localChunks,
          `${baseId}:parallel-after-entry-ramp`,
          run.arm.segment.sequenceId,
          run.arm.segment.kind,
          run.arm.segment.branchId,
          slicePolylineByDistance(run.masterCoordinates, rampLength, masterLength),
          run.offset,
          run.count,
        )
      }
      return
    }
    appendChunk(
      localChunks,
      `${baseId}:parallel`,
      run.arm.segment.sequenceId,
      run.arm.segment.kind,
      run.arm.segment.branchId,
      [...run.masterCoordinates],
      run.offset,
      run.count,
    )
  }

  if (run.continuesAfter) {
    // Le sous-faisceau continue après cette bifurcation : on ne recentre rien,
    // on garde exactement la même voie jusqu'au point où le groupe suivant
    // reprend. Cela élimine les permutations/accordéons entre bifurcations.
    appendSharedMaster()
  }
  else {
    // Règle "câbles" : tant que la ligne appartient au corridor commun, elle
    // conserve STRICTEMENT sa voie. L'ancienne logique commençait à réduire
    // l'offset 300 à 720 m AVANT la fin du faisceau ; sur un tronc presque
    // rectiligne cela créait précisément les petits crochets/zigzags visibles
    // entre deux lignes pourtant encore parallèles.
    appendSharedMaster()

    // On ne rejoint le tracé individuel qu'APRÈS le point de séparation. La
    // transition se fait donc sur la branche qui s'éloigne déjà du paquet et
    // ne peut plus couper une ligne voisine. On accepte volontairement de
    // remodeler cette portion : le rendu est schématique, la simulation reste
    // sur sa géométrie métier d'origine.
    const availableAfter = Math.max(0, run.arm.lengthMeters - endMeters)
    if (availableAfter >= 120) {
      const targetMeters = bundleRejoinTargetMeters(run.arm, endMeters)
      if (targetMeters > endMeters + 120) {
        coverageEndMeters = targetMeters
        const transition = progressiveRejoinCoordinates(
          run.masterCoordinates[run.masterCoordinates.length - 1]!,
          run.arm.coordinatesAway,
          endMeters,
          targetMeters,
        )
        const transitionLength = polylineLengthMeters(transition)
        const steps = clamp(Math.round(transitionLength / 320), 18, 72)
        appendOffsetRamp(
          localChunks,
          `${baseId}:fanout-after`,
          run.arm.segment,
          transition,
          0,
          transitionLength,
          run.offset,
          0,
          Math.max(2, run.count),
          steps,
        )
      }
    }
  }

  // Les bras sont calculés "en s'éloignant" de la station pour faciliter le
  // clustering. Pour le rendu final, on les remet dans le sens réel de la
  // séquence. C'est essentiel : deux morceaux d'une même ligne de part et
  // d'autre d'un pôle ont alors la même orientation, le même côté physique et
  // peuvent former un vrai trait continu au lieu de deux caps qui se croisent.
  const orientedChunks = run.arm.endpoint === 'END'
    ? [...localChunks].reverse().map(chunk => ({
        ...chunk,
        coordinates: reverseCoordinates(chunk.coordinates),
        corridorOffset: -chunk.corridorOffset,
      }))
    : localChunks

  for (const chunk of orientedChunks) {
    appendChunk(
      target,
      `${chunk.id}:sequence-oriented`,
      chunk.sequenceId,
      chunk.kind,
      chunk.branchId,
      [...chunk.coordinates],
      chunk.corridorOffset,
      chunk.corridorCount,
    )
  }

  for (const piece of run.arm.pieces) addCoverageInterval(coverage, run.arm.lineId, piece, startMeters, coverageEndMeters)
}

function networkBundleSignature(lines: readonly GameLine[]) {
  return lines.map(line => lineRenderSignature(line)).join('@@')
}

/**
 * Rendu "peigne" conservatif : un faisceau n'est créé qu'autour d'une vraie
 * station physique partagée (`sharedStationId`) et seulement lorsque plusieurs
 * lignes quittent cette station dans la même direction pendant plusieurs
 * centaines de mètres. Les lignes utilisent alors UNE géométrie maître commune
 * avant de se séparer progressivement vers leur tracé réel.
 */
export function getBundledLineRenderChunks(lines: readonly GameLine[]) {
  const signature = networkBundleSignature(lines)
  if (signature === bundledRenderCacheSignature) return bundledRenderCache

  const segmentsByLine = new Map<string, readonly GameRenderedLineSegment[]>()
  for (const line of lines) segmentsByLine.set(line.id, getRenderedLineSegments(line))
  const exactCorridorSpecs = buildExactSharedCorridorSpecs(lines, segmentsByLine)
  const runs = buildBundleRuns(lines, segmentsByLine, exactCorridorSpecs)
  const result = new Map<string, GameBundledLineRenderChunk[]>()
  const coverage = new Map<string, SegmentCoverageInterval[]>()

  // 1. Les corridors exacts sont dessinés en premier et couvrent l'intégralité
  //    de leur segment. Ils ne pourront jamais être redessinés dessous.
  for (const line of lines) {
    const chunks: GameBundledLineRenderChunk[] = []
    for (const segment of segmentsByLine.get(line.id) ?? []) {
      const exactSpec = exactCorridorSpecs.get(`${line.id}:${segment.id}`)
      if (!exactSpec) continue
      appendChunk(
        chunks,
        `${segment.id}:exact-shared-corridor`,
        segment.sequenceId,
        segment.kind,
        segment.branchId,
        [...exactSpec.masterCoordinates],
        exactSpec.offset,
        exactSpec.count,
      )
      const total = polylineLengthMeters(segment.coordinates)
      coverage.set(`${line.id}:${segment.id}`, [{ fromMeters: 0, toMeters: total }])
    }
    result.set(line.id, chunks)
  }

  // 2. Faisceaux multi-segments : un arrêt intermédiaire d'une seule ligne ne
  //    casse plus le câble tant que les géométries restent dans le même corridor.
  for (const run of runs) {
    const chunks = result.get(run.arm.lineId) ?? []
    appendBundleRun(chunks, run, coverage)
    result.set(run.arm.lineId, chunks)
  }

  // 3. On ne redessine que les morceaux réellement laissés libres. Cela évite
  //    les anciens pics/zigzags où la géométrie d'origine réapparaissait sous un
  //    faisceau entre deux morceaux parallèles.
  for (const line of lines) {
    const chunks = result.get(line.id) ?? []
    for (const segment of segmentsByLine.get(line.id) ?? []) {
      appendOriginalUncoveredParts(chunks, segment, coverage.get(`${line.id}:${segment.id}`) ?? [])
    }
    result.set(line.id, chunks)
  }

  for (const line of lines) {
    result.set(line.id, mergeCompatibleLineChunks(result.get(line.id) ?? []))
  }

  bundledRenderCacheSignature = signature
  bundledRenderCache = result
  return result
}

function nearestPointOnChunk(
  target: GameMapCoordinate,
  chunk: GameBundledLineRenderChunk,
) {
  if (chunk.coordinates.length < 2) return null
  const projection = createProjection([target, ...chunk.coordinates])
  const targetPlanar = projection.toPlanar(target)
  const points = chunk.coordinates.map(projection.toPlanar)
  let bestDistance = Number.POSITIVE_INFINITY
  let bestPoint: PlanarPoint | null = null
  let bestIndex = -1

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!
    const b = points[index]!
    const delta = subtract(b, a)
    const lengthSquared = delta.x * delta.x + delta.y * delta.y
    if (lengthSquared <= 1e-9) continue
    const fromA = subtract(targetPlanar, a)
    const ratio = clamp(dot(fromA, delta) / lengthSquared, 0, 1)
    const projected = add(a, scale(delta, ratio))
    const candidateDistance = distance(targetPlanar, projected)
    if (candidateDistance >= bestDistance) continue
    bestDistance = candidateDistance
    bestPoint = projected
    bestIndex = index
  }

  if (!bestPoint || bestIndex < 1) return null
  return {
    distanceMeters: bestDistance,
    coordinate: projection.toGeographic(bestPoint),
    tangentStart: chunk.coordinates[bestIndex - 1]!,
    tangentEnd: chunk.coordinates[bestIndex]!,
  }
}

/**
 * Projection d'un point métier (véhicule, signal visuel...) sur le câble
 * réellement affiché d'une ligne. Le calcul reste purement visuel : la
 * simulation conserve toujours ses coordonnées originales.
 */
function bundledPositionGridCell(value: number) {
  return Math.floor(value / BUNDLED_POSITION_GRID_DEGREES)
}

function bundledPositionGridKey(sequenceId: string, longitudeCell: number, latitudeCell: number) {
  return `${sequenceId}|${longitudeCell}|${latitudeCell}`
}

function bundledPositionIndex(lines: readonly GameLine[]) {
  const signature = networkBundleSignature(lines)
  if (signature === bundledPositionIndexCacheSignature) return bundledPositionIndexCache

  const index = new Map<string, BundledPositionLineIndex>()
  const chunksByLine = getBundledLineRenderChunks(lines)
  for (const line of lines) {
    const segments: BundledPositionIndexSegment[] = []
    const grid = new Map<string, number[]>()
    for (const chunk of chunksByLine.get(line.id) ?? []) {
      if (chunk.corridorCount <= 1) continue
      for (let pointIndex = 1; pointIndex < chunk.coordinates.length; pointIndex += 1) {
        const a = chunk.coordinates[pointIndex - 1]!
        const b = chunk.coordinates[pointIndex]!
        const segment: BundledPositionIndexSegment = {
          sequenceId: chunk.sequenceId,
          a,
          b,
          minLongitude: Math.min(a[0], b[0]),
          maxLongitude: Math.max(a[0], b[0]),
          minLatitude: Math.min(a[1], b[1]),
          maxLatitude: Math.max(a[1], b[1]),
          corridorOffset: chunk.corridorOffset,
          corridorCount: chunk.corridorCount,
        }
        const segmentIndex = segments.push(segment) - 1
        const minX = bundledPositionGridCell(segment.minLongitude)
        const maxX = bundledPositionGridCell(segment.maxLongitude)
        const minY = bundledPositionGridCell(segment.minLatitude)
        const maxY = bundledPositionGridCell(segment.maxLatitude)
        for (let x = minX; x <= maxX; x += 1) {
          for (let y = minY; y <= maxY; y += 1) {
            for (const keySequence of [chunk.sequenceId, '*']) {
              const key = bundledPositionGridKey(keySequence, x, y)
              const values = grid.get(key) ?? []
              values.push(segmentIndex)
              grid.set(key, values)
            }
          }
        }
      }
    }
    index.set(line.id, { segments, grid })
  }

  bundledPositionIndexCacheSignature = signature
  bundledPositionIndexCache = index
  return index
}

/**
 * Projection rapide d'un point métier (véhicule, signal visuel...) sur le
 * câble réellement affiché. L'index est reconstruit uniquement quand la
 * géométrie réseau change ; les mises à jour véhicules restent donc légères.
 */
function findBundledLineRenderHintInIndex(
  positionIndex: Map<string, BundledPositionLineIndex>,
  lineId: string,
  target: GameMapCoordinate,
  sequenceId?: string | null,
  maxDistanceMeters = 2_000,
): GameBundledPositionRenderHint | null {
  const lineIndex = positionIndex.get(lineId)
  if (!lineIndex?.segments.length) return null

  const metersPerLongitudeDegree = Math.max(.15, Math.cos(target[1] * Math.PI / 180)) * METERS_PER_LATITUDE_DEGREE
  const longitudeMargin = maxDistanceMeters / metersPerLongitudeDegree
  const latitudeMargin = maxDistanceMeters / METERS_PER_LATITUDE_DEGREE
  const sequenceKey = sequenceId ?? '*'
  const minX = bundledPositionGridCell(target[0] - longitudeMargin)
  const maxX = bundledPositionGridCell(target[0] + longitudeMargin)
  const minY = bundledPositionGridCell(target[1] - latitudeMargin)
  const maxY = bundledPositionGridCell(target[1] + latitudeMargin)
  const candidateIndexes = new Set<number>()
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (const index of lineIndex.grid.get(bundledPositionGridKey(sequenceKey, x, y)) ?? []) candidateIndexes.add(index)
    }
  }

  let bestDistance = Number.POSITIVE_INFINITY
  let best: { segment: BundledPositionIndexSegment; ratio: number } | null = null

  for (const segmentIndex of candidateIndexes) {
    const segment = lineIndex.segments[segmentIndex]
    if (!segment) continue
    if (target[0] < segment.minLongitude - longitudeMargin || target[0] > segment.maxLongitude + longitudeMargin) continue
    if (target[1] < segment.minLatitude - latitudeMargin || target[1] > segment.maxLatitude + latitudeMargin) continue

    const ax = (segment.a[0] - target[0]) * metersPerLongitudeDegree
    const ay = (segment.a[1] - target[1]) * METERS_PER_LATITUDE_DEGREE
    const bx = (segment.b[0] - target[0]) * metersPerLongitudeDegree
    const by = (segment.b[1] - target[1]) * METERS_PER_LATITUDE_DEGREE
    const dx = bx - ax
    const dy = by - ay
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared <= 1e-9) continue
    const ratio = clamp(-(ax * dx + ay * dy) / lengthSquared, 0, 1)
    const px = ax + dx * ratio
    const py = ay + dy * ratio
    const candidateDistance = Math.hypot(px, py)
    if (candidateDistance > maxDistanceMeters) continue
    if (
      candidateDistance < bestDistance - 8
      || (Math.abs(candidateDistance - bestDistance) <= 8 && segment.corridorCount > (best?.segment.corridorCount ?? 0))
    ) {
      bestDistance = candidateDistance
      best = { segment, ratio }
    }
  }

  if (!best) return null
  const { segment, ratio } = best
  return {
    coordinate: [
      segment.a[0] + (segment.b[0] - segment.a[0]) * ratio,
      segment.a[1] + (segment.b[1] - segment.a[1]) * ratio,
    ],
    tangentStart: segment.a,
    tangentEnd: segment.b,
    corridorOffset: segment.corridorOffset,
    corridorCount: segment.corridorCount,
  }
}

export function getBundledLineRenderHintsAtCoordinates(
  lines: readonly GameLine[],
  requests: readonly GameBundledPositionRenderRequest[],
) {
  const positionIndex = bundledPositionIndex(lines)
  const result = new Map<string, GameBundledPositionRenderHint>()
  for (const request of requests) {
    const hint = findBundledLineRenderHintInIndex(
      positionIndex,
      request.lineId,
      request.target,
      request.sequenceId,
      request.maxDistanceMeters ?? 2_000,
    )
    if (hint) result.set(request.key, hint)
  }
  return result
}

export function getBundledLineRenderHintAtCoordinate(
  lines: readonly GameLine[],
  lineId: string,
  target: GameMapCoordinate,
  sequenceId?: string | null,
  maxDistanceMeters = 2_000,
): GameBundledPositionRenderHint | null {
  const positionIndex = bundledPositionIndex(lines)
  return findBundledLineRenderHintInIndex(positionIndex, lineId, target, sequenceId, maxDistanceMeters)
}

/**
 * Position purement visuelle des arrêts sur les faisceaux. La station métier
 * reste à ses vraies coordonnées ; seul le renderer reçoit l'axe maître et la
 * voie écran afin que la pastille suive exactement le câble affiché.
 */
export function getBundledStationRenderHints(lines: readonly GameLine[]) {
  const signature = networkBundleSignature(lines)
  if (signature === bundledStationHintCacheSignature) return bundledStationHintCache

  const chunksByLine = getBundledLineRenderChunks(lines)
  const hints = new Map<string, GameBundledStationRenderHint>()

  for (const line of lines) {
    const chunks = chunksByLine.get(line.id) ?? []
    if (!chunks.length) continue
    for (const station of getLineAllStations(line)) {
      const location = findLineStationLocation(line, station.id)
      const sequenceId = location?.isMain
        ? `${line.id}:main`
        : location?.branchId
          ? `${line.id}:branch:${location.branchId}`
          : null
      const candidates = chunks.filter(chunk => (!sequenceId || chunk.sequenceId === sequenceId) && chunk.corridorCount > 1)
      if (!candidates.length) continue

      const target: GameMapCoordinate = [station.longitude, station.latitude]
      let best: (ReturnType<typeof nearestPointOnChunk> & { chunk: GameBundledLineRenderChunk }) | null = null
      for (const chunk of candidates) {
        const nearest = nearestPointOnChunk(target, chunk)
        if (!nearest) continue
        // On autorise volontairement un remodelage visuel notable : si le câble
        // maître a été déplacé pour nettoyer le schéma, l'arrêt doit le suivre.
        if (nearest.distanceMeters > 1_500) continue
        const candidate = { ...nearest, chunk }
        if (
          !best
          || candidate.distanceMeters < best.distanceMeters - 12
          || (Math.abs(candidate.distanceMeters - best.distanceMeters) <= 12 && candidate.chunk.corridorCount > best.chunk.corridorCount)
        ) best = candidate
      }
      if (!best) continue
      hints.set(`${line.id}:${station.id}`, {
        coordinate: best.coordinate,
        tangentStart: best.tangentStart,
        tangentEnd: best.tangentEnd,
        corridorOffset: best.chunk.corridorOffset,
        corridorCount: best.chunk.corridorCount,
      })
    }
  }

  bundledStationHintCacheSignature = signature
  bundledStationHintCache = hints
  return hints
}

/** Compatibilité : l'ancien moteur d'offset n'est plus utilisé par la carte. */
export function calculateLineSegmentCorridorOffsets(_lines: readonly GameLine[]) {
  return new Map<string, { offset: number; count: number }>()
}

export function clearRenderedLineGeometryCache(lineId?: string) {
  bundledRenderCacheSignature = ''
  bundledRenderCache = new Map<string, GameBundledLineRenderChunk[]>()
  bundledStationHintCacheSignature = ''
  bundledStationHintCache = new Map<string, GameBundledStationRenderHint>()
  bundledPositionIndexCacheSignature = ''
  bundledPositionIndexCache = new Map<string, BundledPositionLineIndex>()
  if (!lineId) {
    renderCache.clear()
    segmentRenderCache.clear()
    return
  }
  for (const key of [...renderCache.keys()]) {
    if (key.startsWith(`${lineId}::`)) renderCache.delete(key)
  }
  for (const key of [...segmentRenderCache.keys()]) {
    if (key.startsWith(`${lineId}::`)) segmentRenderCache.delete(key)
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


/**
 * Compatibilité avec les appels qui attendent encore un offset moyen par ligne.
 * Le rendu de carte utilise désormais les voies géométriques segment par segment.
 */
export function calculateLineCorridorOffsets(lines: readonly GameLine[]) {
  return new Map(lines.map(line => [line.id, 0] as const))
}
