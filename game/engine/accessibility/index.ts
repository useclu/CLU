import { getInfrastructureDefinition } from '../../config/projects'
import { calculateInfrastructureLineProfile } from '../infrastructure'
import { distanceBetweenStationsKm } from '../economy'
import { getLineServiceRoutes } from '../network/geometry'
import { buildInterchanges } from '../transitRuntime'
import { effectiveAverageSpeedKmH } from '../rollingStock'
import type { GameLine, GameNetworkState, GameStation } from '../../types/network'

interface Edge {
  to: string
  minutes: number
}

interface NodeMeta {
  lineId: string
  station: GameStation
}

export interface GameAccessibilityBand {
  minutes: 15 | 30 | 45
  stationCount: number
  lineCount: number
}

export interface GameAccessibilitySnapshot {
  originLineId: string
  originStationId: string
  originStationName: string
  bands: GameAccessibilityBand[]
  farthestReachableStationName: string | null
  farthestReachableMinutes: number
}

function nodeKey(lineId: string, stationId: string) {
  return `${lineId}::${stationId}`
}

function physicalStationKey(station: GameStation) {
  if (station.sharedStationId) return `shared:${station.sharedStationId}`
  return `coord:${station.longitude.toFixed(5)}:${station.latitude.toFixed(5)}`
}

function addEdge(graph: Map<string, Edge[]>, from: string, to: string, minutes: number) {
  const bucket = graph.get(from) ?? []
  bucket.push({ to, minutes: Math.max(.25, minutes) })
  graph.set(from, bucket)
}

function buildAccessibilityGraphUncached(network: GameNetworkState) {
  const graph = new Map<string, Edge[]>()
  const nodes = new Map<string, NodeMeta>()
  const lines = network.lines.filter(line => line.status === 'OPERATIONAL')

  for (const line of lines) {
    const speed = Math.max(4, effectiveAverageSpeedKmH(line)
      * getInfrastructureDefinition(line.mode, line.infrastructureType ?? 'AUTO').speedMultiplier
      * calculateInfrastructureLineProfile(line).speedMultiplier)
    for (const route of getLineServiceRoutes(line)) {
      for (const station of route) nodes.set(nodeKey(line.id, station.id), { lineId: line.id, station })
      for (let index = 1; index < route.length; index += 1) {
        const from = route[index - 1]
        const to = route[index]
        if (!from || !to) continue
        const minutes = distanceBetweenStationsKm(from, to) / speed * 60 + .45
        const a = nodeKey(line.id, from.id)
        const b = nodeKey(line.id, to.id)
        addEdge(graph, a, b, minutes)
        addEdge(graph, b, a, minutes)
      }
    }
  }

  for (const interchange of buildInterchanges({ ...network, lines })) {
    const a = nodeKey(interchange.fromLineId, interchange.fromStationId)
    const b = nodeKey(interchange.toLineId, interchange.toStationId)
    if (!nodes.has(a) || !nodes.has(b)) continue
    const minutes = Math.max(1, interchange.walkingMinutes)
    addEdge(graph, a, b, minutes)
    addEdge(graph, b, a, minutes)
  }

  return { graph, nodes }
}

let cachedGraphSignature = ''
let cachedGraph: ReturnType<typeof buildAccessibilityGraphUncached> | null = null

function accessibilityGraphSignature(network: GameNetworkState) {
  const lines = network.lines
    .filter(line => line.status === 'OPERATIONAL')
    .map(line => `${line.id}:${line.updatedAt}:${line.vehicleCount}:${line.serviceLevel}:${line.rollingStockModelId ?? ''}:${(line.infrastructureSegments ?? []).map(item => `${item.fromStationId}-${item.toStationId}-${item.speedLevel}`).join(',')}`)
    .join('|')
  const transfers = (network.walkingTransfers ?? []).map(item => `${item.id}:${item.updatedAt}:${item.walkingMinutes}`).join('|')
  return `${lines}#${transfers}`
}

function buildAccessibilityGraph(network: GameNetworkState) {
  const signature = accessibilityGraphSignature(network)
  if (cachedGraph && cachedGraphSignature === signature) return cachedGraph
  cachedGraphSignature = signature
  cachedGraph = buildAccessibilityGraphUncached(network)
  return cachedGraph
}

class MinuteHeap {
  private items: Array<{ key: string; minutes: number }> = []
  get length() { return this.items.length }
  push(item: { key: string; minutes: number }) {
    this.items.push(item)
    let index = this.items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.items[parent]!.minutes <= this.items[index]!.minutes) break
      ;[this.items[parent], this.items[index]] = [this.items[index]!, this.items[parent]!]
      index = parent
    }
  }
  pop() {
    if (!this.items.length) return null
    const first = this.items[0]!
    const last = this.items.pop()!
    if (this.items.length) {
      this.items[0] = last
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < this.items.length && this.items[left]!.minutes < this.items[smallest]!.minutes) smallest = left
        if (right < this.items.length && this.items[right]!.minutes < this.items[smallest]!.minutes) smallest = right
        if (smallest === index) break
        ;[this.items[index], this.items[smallest]] = [this.items[smallest]!, this.items[index]!]
        index = smallest
      }
    }
    return first
  }
}

export function calculateNetworkAccessibility(
  network: GameNetworkState,
  originLineId: string,
  originStationId: string,
): GameAccessibilitySnapshot | null {
  const { graph, nodes } = buildAccessibilityGraph(network)
  const start = nodeKey(originLineId, originStationId)
  const origin = nodes.get(start)
  if (!origin) return null

  const distances = new Map<string, number>([[start, 0]])
  const visited = new Set<string>()
  const queue = new MinuteHeap()
  queue.push({ key: start, minutes: 0 })

  while (queue.length) {
    const current = queue.pop()!
    if (visited.has(current.key)) continue
    visited.add(current.key)
    if (current.minutes > 45) continue
    for (const edge of graph.get(current.key) ?? []) {
      const nextMinutes = current.minutes + edge.minutes
      if (nextMinutes > 45) continue
      if (nextMinutes < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, nextMinutes)
        queue.push({ key: edge.to, minutes: nextMinutes })
      }
    }
  }

  const bands: Array<15 | 30 | 45> = [15, 30, 45]
  const resultBands = bands.map(minutes => {
    const physicalStations = new Set<string>()
    const lineIds = new Set<string>()
    for (const [key, distance] of distances) {
      if (distance > minutes) continue
      const meta = nodes.get(key)
      if (!meta) continue
      physicalStations.add(physicalStationKey(meta.station))
      lineIds.add(meta.lineId)
    }
    return { minutes, stationCount: physicalStations.size, lineCount: lineIds.size }
  })

  let farthestReachableStationName: string | null = null
  let farthestReachableMinutes = 0
  for (const [key, minutes] of distances) {
    if (minutes <= farthestReachableMinutes || minutes > 45) continue
    const meta = nodes.get(key)
    if (!meta) continue
    farthestReachableMinutes = minutes
    farthestReachableStationName = meta.station.name
  }

  return {
    originLineId,
    originStationId,
    originStationName: origin.station.name,
    bands: resultBands,
    farthestReachableStationName,
    farthestReachableMinutes,
  }
}
