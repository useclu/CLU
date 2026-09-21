import type { GameLine, GameLineRouteSegment, GameStation } from '../../types/network'
import { getLineGeometrySequences } from './geometry'

export type GamePathCoordinate = [number, number]

function samePoint(a: GamePathCoordinate, b: GamePathCoordinate) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
}

export function normalizeRouteSegment(segment: GameLineRouteSegment): GameLineRouteSegment | null {
  if (!segment || typeof segment.fromStationId !== 'string' || typeof segment.toStationId !== 'string') return null
  if (!Array.isArray(segment.coordinates) || segment.coordinates.length < 2) return null
  const coordinates = segment.coordinates
    .filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
    .map(point => [Number(point[0]), Number(point[1])] as GamePathCoordinate)
  if (coordinates.length < 2) return null
  return {
    fromStationId: segment.fromStationId,
    toStationId: segment.toStationId,
    coordinates,
    source: segment.source === 'FREE' ? 'FREE' : 'ASSISTED',
  }
}

export function getRouteSegment(
  line: Pick<GameLine, 'routeSegments'>,
  fromStationId: string,
  toStationId: string,
): { segment: GameLineRouteSegment; reversed: boolean } | null {
  for (const raw of line.routeSegments ?? []) {
    const segment = normalizeRouteSegment(raw)
    if (!segment) continue
    if (segment.fromStationId === fromStationId && segment.toStationId === toStationId) return { segment, reversed: false }
    if (segment.fromStationId === toStationId && segment.toStationId === fromStationId) return { segment, reversed: true }
  }
  return null
}

export function setRouteSegment(
  line: GameLine,
  from: GameStation,
  to: GameStation,
  coordinates: GamePathCoordinate[],
  source: 'ASSISTED' | 'FREE',
) {
  const valid = coordinates
    .filter(point => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]))
    .map(point => [point[0], point[1]] as GamePathCoordinate)
  if (valid.length < 2) return false
  valid[0] = [from.longitude, from.latitude]
  valid[valid.length - 1] = [to.longitude, to.latitude]
  const next = (line.routeSegments ?? []).filter(segment => !(
    (segment.fromStationId === from.id && segment.toStationId === to.id)
    || (segment.fromStationId === to.id && segment.toStationId === from.id)
  ))
  next.push({ fromStationId: from.id, toStationId: to.id, coordinates: valid, source })
  line.routeSegments = next
  return true
}

export function removeRouteSegmentsTouching(line: GameLine, stationIds: Iterable<string>) {
  const ids = new Set(stationIds)
  line.routeSegments = (line.routeSegments ?? []).filter(segment => !ids.has(segment.fromStationId) && !ids.has(segment.toStationId))
}

export function pruneOrphanRouteSegments(line: GameLine) {
  const validPairs = new Set<string>()
  for (const sequence of getLineGeometrySequences(line)) {
    for (let index = 1; index < sequence.length; index += 1) {
      const a = sequence[index - 1]!
      const b = sequence[index]!
      validPairs.add(`${a.id}>${b.id}`)
      validPairs.add(`${b.id}>${a.id}`)
    }
  }
  line.routeSegments = (line.routeSegments ?? []).filter(segment => validPairs.has(`${segment.fromStationId}>${segment.toStationId}`))
}

export function getSegmentCoordinates(
  line: Pick<GameLine, 'routeSegments'>,
  from: GameStation,
  to: GameStation,
): GamePathCoordinate[] | null {
  const match = getRouteSegment(line, from.id, to.id)
  if (!match) return null
  const coords = match.reversed ? [...match.segment.coordinates].reverse() : [...match.segment.coordinates]
  if (!coords.length) return null
  coords[0] = [from.longitude, from.latitude]
  coords[coords.length - 1] = [to.longitude, to.latitude]
  return coords
}

export function getLinePathCoordinateSequences(
  line: Pick<GameLine, 'stations' | 'branches' | 'routeSegments'>,
): GamePathCoordinate[][] {
  const result: GamePathCoordinate[][] = []
  for (const stations of getLineGeometrySequences(line)) {
    if (stations.length < 2) continue
    const coordinates: GamePathCoordinate[] = []
    for (let index = 1; index < stations.length; index += 1) {
      const from = stations[index - 1]!
      const to = stations[index]!
      const routed = getSegmentCoordinates(line, from, to)
      const segment = routed ?? [[from.longitude, from.latitude], [to.longitude, to.latitude]]
      for (const point of segment) {
        if (!coordinates.length || !samePoint(coordinates[coordinates.length - 1]!, point)) coordinates.push(point)
      }
    }
    if (coordinates.length >= 2) result.push(coordinates)
  }
  return result
}
