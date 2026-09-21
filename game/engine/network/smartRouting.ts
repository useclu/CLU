import type { GameTransportMode } from '../../types/network'

export type SmartRouteCoordinate = [number, number]

interface GeoJsonFeatureLike {
  properties?: Record<string, unknown> | null
  geometry?: { type?: string; coordinates?: unknown } | null
}

interface GeoJsonCollectionLike {
  features?: GeoJsonFeatureLike[]
}

interface Node {
  longitude: number
  latitude: number
  x: number
  y: number
  edges: Array<{ to: number; weight: number }>
}

export interface SmartRoutingGraph {
  mode: GameTransportMode
  nodes: Node[]
  origin: SmartRouteCoordinate
  spatialCellMeters: number
  spatialIndex: Map<string, number[]>
}

const EARTH_M = 111_320

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function kindWeight(mode: GameTransportMode, kind: string) {
  if (mode === 'BUS') {
    if (kind === 'street') return .72
    if (kind === 'minor_road') return .66
    if (kind === 'major_road') return .58
    if (kind === 'highway') return .78
    return null
  }
  if (mode === 'BRT') {
    if (kind === 'major_road') return .48
    if (kind === 'highway') return .54
    if (kind === 'minor_road') return .72
    if (kind === 'street') return 1.05
    return null
  }
  if (mode === 'TRAM') {
    if (kind === 'rail') return .50
    if (kind === 'major_road') return .58
    if (kind === 'minor_road') return .68
    if (kind === 'street') return .90
    return null
  }
  if (mode === 'RER' || mode === 'TRAIN') {
    if (kind === 'rail') return .34
    if (kind === 'major_road') return 1.45
    if (kind === 'highway') return 1.62
    return null
  }
  // Le métro reste volontairement moins prisonnier de la voirie de surface.
  if (mode === 'METRO') {
    if (kind === 'rail') return .82
    if (kind === 'major_road') return .94
    return null
  }
  return null
}

function flattenLines(feature: GeoJsonFeatureLike): SmartRouteCoordinate[][] {
  const geometry = feature.geometry
  if (!geometry) return []
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates as SmartRouteCoordinate[]]
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates as SmartRouteCoordinate[][]
  }
  return []
}

function projectionOrigin(lines: SmartRouteCoordinate[][]) {
  for (const line of lines) {
    const point = line[0]
    if (point) return point
  }
  return [0, 0] as SmartRouteCoordinate
}

function project(point: SmartRouteCoordinate, origin: SmartRouteCoordinate) {
  const latScale = EARTH_M
  const lonScale = Math.max(.18, Math.cos(origin[1] * Math.PI / 180)) * EARTH_M
  return { x: (point[0] - origin[0]) * lonScale, y: (point[1] - origin[1]) * latScale }
}

function distanceMeters(a: SmartRouteCoordinate, b: SmartRouteCoordinate) {
  const meanLat = (a[1] + b[1]) / 2
  const lonScale = Math.max(.18, Math.cos(meanLat * Math.PI / 180)) * EARTH_M
  return Math.hypot((a[0] - b[0]) * lonScale, (a[1] - b[1]) * EARTH_M)
}

function interpolate(a: SmartRouteCoordinate, b: SmartRouteCoordinate, t: number): SmartRouteCoordinate {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function simplifyPath(points: SmartRouteCoordinate[]) {
  if (points.length <= 3) return points
  const result: SmartRouteCoordinate[] = [points[0]!]
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = result[result.length - 1]!
    const b = points[index]!
    const c = points[index + 1]!
    const abx = b[0] - a[0]
    const aby = b[1] - a[1]
    const bcx = c[0] - b[0]
    const bcy = c[1] - b[1]
    const cross = Math.abs(abx * bcy - aby * bcx)
    const span = Math.max(1e-9, Math.hypot(abx, aby) + Math.hypot(bcx, bcy))
    if (cross / span < 1.5e-5 && distanceMeters(a, b) < 420) continue
    result.push(b)
  }
  result.push(points[points.length - 1]!)
  return result
}

export function buildSmartRoutingGraph(collection: GeoJsonCollectionLike | null | undefined, mode: GameTransportMode): SmartRoutingGraph | null {
  if (!collection?.features?.length) return null
  const corridors: Array<{ line: SmartRouteCoordinate[]; weight: number }> = []
  for (const feature of collection.features) {
    if (String(feature.properties?.layer ?? '') !== 'road') continue
    const kind = String(feature.properties?.kind ?? '')
    const weight = kindWeight(mode, kind)
    if (weight === null) continue
    for (const rawLine of flattenLines(feature)) {
      const line = rawLine.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      if (line.length >= 2) corridors.push({ line, weight })
    }
  }
  if (!corridors.length) return null

  const origin = projectionOrigin(corridors.map(item => item.line))
  const nodes: Node[] = []
  const bucket = new Map<string, number[]>()
  const mergeMeters = mode === 'TRAIN' || mode === 'RER' ? 150 : mode === 'METRO' ? 135 : 118
  const spacingMeters = mode === 'TRAIN' || mode === 'RER' ? 300 : mode === 'METRO' ? 250 : 180

  function nodeFor(point: SmartRouteCoordinate) {
    const p = project(point, origin)
    const gx = Math.round(p.x / mergeMeters)
    const gy = Math.round(p.y / mergeMeters)
    let best = -1
    let bestDistance = mergeMeters * .92
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const index of bucket.get(`${gx + dx}:${gy + dy}`) ?? []) {
          const candidate = nodes[index]!
          const d = Math.hypot(candidate.x - p.x, candidate.y - p.y)
          if (d < bestDistance) { best = index; bestDistance = d }
        }
      }
    }
    if (best >= 0) return best
    const index = nodes.length
    nodes.push({ longitude: point[0], latitude: point[1], x: p.x, y: p.y, edges: [] })
    const key = `${gx}:${gy}`
    bucket.set(key, [...(bucket.get(key) ?? []), index])
    return index
  }

  function connect(a: number, b: number, weight: number) {
    if (a === b) return
    const first = nodes[a]!
    const second = nodes[b]!
    const length = Math.hypot(first.x - second.x, first.y - second.y)
    if (length < 1) return
    const edgeWeight = length * weight
    const currentA = first.edges.find(edge => edge.to === b)
    if (!currentA || edgeWeight < currentA.weight) {
      if (currentA) currentA.weight = edgeWeight
      else first.edges.push({ to: b, weight: edgeWeight })
    }
    const currentB = second.edges.find(edge => edge.to === a)
    if (!currentB || edgeWeight < currentB.weight) {
      if (currentB) currentB.weight = edgeWeight
      else second.edges.push({ to: a, weight: edgeWeight })
    }
  }

  for (const corridor of corridors) {
    const sampled: SmartRouteCoordinate[] = [corridor.line[0]!]
    for (let index = 1; index < corridor.line.length; index += 1) {
      const a = corridor.line[index - 1]!
      const b = corridor.line[index]!
      const length = distanceMeters(a, b)
      const steps = Math.max(1, Math.ceil(length / spacingMeters))
      for (let step = 1; step <= steps; step += 1) sampled.push(interpolate(a, b, step / steps))
    }
    let previous = nodeFor(sampled[0]!)
    for (let index = 1; index < sampled.length; index += 1) {
      const next = nodeFor(sampled[index]!)
      connect(previous, next, corridor.weight)
      previous = next
    }
  }

  if (nodes.length < 2) return null

  // Index spatial réutilisé à chaque déplacement de souris. Sans lui, chercher
  // le nœud le plus proche dans une grande métropole procédurale imposerait un
  // tri de dizaines de milliers de nœuds à chaque frame de prévisualisation.
  const spatialCellMeters = mode === 'TRAIN' || mode === 'RER' ? 900 : 650
  const spatialIndex = new Map<string, number[]>()
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!
    const key = `${Math.floor(node.x / spatialCellMeters)}:${Math.floor(node.y / spatialCellMeters)}`
    const items = spatialIndex.get(key)
    if (items) items.push(index)
    else spatialIndex.set(key, [index])
  }

  return { mode, nodes, origin, spatialCellMeters, spatialIndex }
}

function nearestNodes(graph: SmartRoutingGraph, point: SmartRouteCoordinate, count = 8) {
  const projected = project(point, graph.origin)
  const cell = graph.spatialCellMeters
  const cx = Math.floor(projected.x / cell)
  const cy = Math.floor(projected.y / cell)
  const candidates = new Set<number>()

  // 8 anneaux couvrent largement le snap maximal (2,2 à 3,5 km) et
  // évitent de parcourir tout le graphe à chaque mouvement de souris.
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        for (const index of graph.spatialIndex.get(`${cx + dx}:${cy + dy}`) ?? []) candidates.add(index)
      }
    }
    if (candidates.size >= Math.max(count * 4, 24) && radius >= 1) break
  }

  // Cas de sécurité pour une position réellement isolée hors du maillage chargé.
  const indices = candidates.size ? [...candidates] : graph.nodes.map((_, index) => index)
  const scored = indices.map(index => {
    const node = graph.nodes[index]!
    return { index, distance: Math.hypot(node.x - projected.x, node.y - projected.y) }
  })
  scored.sort((a, b) => a.distance - b.distance)
  return scored.slice(0, count)
}

export function routeOnSmartGraph(
  graph: SmartRoutingGraph | null,
  start: SmartRouteCoordinate,
  end: SmartRouteCoordinate,
): SmartRouteCoordinate[] | null {
  if (!graph || graph.nodes.length < 2) return null
  const startCandidates = nearestNodes(graph, start)
  const endCandidates = nearestNodes(graph, end)
  if (!startCandidates.length || !endCandidates.length) return null
  const direct = Math.max(1, distanceMeters(start, end))
  const snapLimit = clamp(direct * .34, 650, graph.mode === 'TRAIN' || graph.mode === 'RER' ? 3500 : 2200)
  const starts = startCandidates.filter(item => item.distance <= snapLimit)
  const ends = endCandidates.filter(item => item.distance <= snapLimit)
  if (!starts.length || !ends.length) return null
  const endSet = new Map(ends.map(item => [item.index, item.distance]))

  const distances = new Float64Array(graph.nodes.length)
  distances.fill(Number.POSITIVE_INFINITY)
  const previous = new Int32Array(graph.nodes.length)
  previous.fill(-1)
  const heap: Array<{ index: number; score: number }> = []
  const pushHeap = (item: { index: number; score: number }) => {
    heap.push(item)
    let child = heap.length - 1
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2)
      if (heap[parent]!.score <= heap[child]!.score) break
      ;[heap[parent], heap[child]] = [heap[child]!, heap[parent]!]
      child = parent
    }
  }
  const popHeap = () => {
    const first = heap[0]
    const last = heap.pop()
    if (!first) return null
    if (heap.length && last) {
      heap[0] = last
      let parent = 0
      while (true) {
        const left = parent * 2 + 1
        const right = left + 1
        let best = parent
        if (left < heap.length && heap[left]!.score < heap[best]!.score) best = left
        if (right < heap.length && heap[right]!.score < heap[best]!.score) best = right
        if (best === parent) break
        ;[heap[parent], heap[best]] = [heap[best]!, heap[parent]!]
        parent = best
      }
    }
    return first
  }
  for (const candidate of starts) {
    distances[candidate.index] = candidate.distance * 1.12
    pushHeap({ index: candidate.index, score: distances[candidate.index]! })
  }

  let target = -1
  let targetScore = Number.POSITIVE_INFINITY
  let guard = 0
  while (heap.length && guard < graph.nodes.length * 14) {
    guard += 1
    const current = popHeap()!
    const currentDistance = distances[current.index]!
    if (current.score > currentDistance + 1e-6) continue
    const endSnap = endSet.get(current.index)
    if (endSnap !== undefined && currentDistance + endSnap < targetScore) {
      target = current.index
      targetScore = currentDistance + endSnap
      if ((heap[0]?.score ?? Number.POSITIVE_INFINITY) >= targetScore) break
    }
    for (const edge of graph.nodes[current.index]!.edges) {
      const nextDistance = currentDistance + edge.weight
      if (nextDistance + 1e-6 >= distances[edge.to]!) continue
      distances[edge.to] = nextDistance
      previous[edge.to] = current.index
      pushHeap({ index: edge.to, score: nextDistance })
    }
  }
  if (target < 0) return null

  const indices: number[] = []
  let cursor = target
  while (cursor >= 0) {
    indices.push(cursor)
    cursor = previous[cursor]!
  }
  indices.reverse()
  const points: SmartRouteCoordinate[] = [start]
  for (const index of indices) {
    const node = graph.nodes[index]!
    points.push([node.longitude, node.latitude])
  }
  points.push(end)
  const simplified = simplifyPath(points)
  const length = simplified.slice(1).reduce((sum, point, index) => sum + distanceMeters(simplified[index]!, point), 0)
  // V45 : l'assistance n'a le droit que de nettoyer/recaler légèrement le tracé.
  // Un détour notable revient immédiatement au segment manuel choisi par le joueur.
  const maxDetour = graph.mode === 'BUS' || graph.mode === 'BRT' ? 1.24 : graph.mode === 'TRAM' ? 1.2 : 1.16
  if (length > direct * maxDetour + 260) return null
  return simplified
}

export function routeThroughWaypoints(
  graph: SmartRoutingGraph | null,
  points: SmartRouteCoordinate[],
  assisted = true,
) {
  if (points.length < 2) return points
  const result: SmartRouteCoordinate[] = []
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!
    const to = points[index]!
    const leg = assisted ? routeOnSmartGraph(graph, from, to) : null
    const coordinates = leg ?? [from, to]
    for (const point of coordinates) {
      const previous = result[result.length - 1]
      if (!previous || distanceMeters(previous, point) > .5) result.push(point)
    }
  }
  return simplifyPath(result)
}
