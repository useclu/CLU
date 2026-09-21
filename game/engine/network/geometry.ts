import type { GameLine, GameLineBranch, GameStation } from '../../types/network'

export interface GameLineStationLocation {
  station: GameStation
  branchId: string | null
  index: number
  isMain: boolean
}

export function getLineBranches(line: Pick<GameLine, 'branches'>): GameLineBranch[] {
  return Array.isArray(line.branches) ? line.branches : []
}

export function getLineAllStations(line: Pick<GameLine, 'stations' | 'branches'>): GameStation[] {
  const result: GameStation[] = []
  const seen = new Set<string>()
  for (const station of line.stations ?? []) {
    if (!station || seen.has(station.id)) continue
    seen.add(station.id)
    result.push(station)
  }
  for (const branch of getLineBranches(line)) {
    for (const station of branch.stations ?? []) {
      if (!station || seen.has(station.id)) continue
      seen.add(station.id)
      result.push(station)
    }
  }
  return result
}

export function findLineStation(
  line: Pick<GameLine, 'stations' | 'branches'>,
  stationId: string,
): GameStation | null {
  return findLineStationLocation(line, stationId)?.station ?? null
}

export function findLineStationLocation(
  line: Pick<GameLine, 'stations' | 'branches'>,
  stationId: string,
): GameLineStationLocation | null {
  const mainIndex = line.stations.findIndex(station => station.id === stationId)
  if (mainIndex >= 0) {
    return { station: line.stations[mainIndex]!, branchId: null, index: mainIndex, isMain: true }
  }
  for (const branch of getLineBranches(line)) {
    const index = branch.stations.findIndex(station => station.id === stationId)
    if (index >= 0) return { station: branch.stations[index]!, branchId: branch.id, index, isMain: false }
  }
  return null
}

/**
 * Séquences géométriques indépendantes : le tronc principal puis chaque branche.
 * Une branche commence toujours par sa station de bifurcation afin qu'aucun
 * aller-retour artificiel ne soit dessiné entre le tronc et son nouveau terminus.
 */
export function getLineGeometrySequences(
  line: Pick<GameLine, 'stations' | 'branches'>,
): GameStation[][] {
  const sequences: GameStation[][] = []
  if (line.stations.length >= 2) sequences.push(line.stations)
  for (const branch of getLineBranches(line)) {
    const junction = findLineStation(line, branch.fromStationId)
    if (!junction || !branch.stations.length) continue
    sequences.push([junction, ...branch.stations])
  }
  return sequences
}

/**
 * Routes de service simplifiées : le tronc complet + une route vers chaque
 * terminus de branche depuis le premier terminus du tronc. Cela permet aux
 * véhicules/ETA de desservir immédiatement une branche sans aplatir la géométrie.
 */
export function getLineServiceRoutes(
  line: Pick<GameLine, 'stations' | 'branches'>,
): GameStation[][] {
  const routes: GameStation[][] = []
  if (line.stations.length >= 2) routes.push(line.stations)

  function pathFromMainStartTo(stationId: string, visited = new Set<string>()): GameStation[] | null {
    const mainIndex = line.stations.findIndex(station => station.id === stationId)
    if (mainIndex >= 0) return line.stations.slice(0, mainIndex + 1)
    for (const branch of getLineBranches(line)) {
      if (visited.has(branch.id)) continue
      const stationIndex = branch.stations.findIndex(station => station.id === stationId)
      if (stationIndex < 0) continue
      const nextVisited = new Set(visited)
      nextVisited.add(branch.id)
      const parentPath = pathFromMainStartTo(branch.fromStationId, nextVisited)
      if (!parentPath) return null
      return [...parentPath, ...branch.stations.slice(0, stationIndex + 1)]
    }
    return null
  }

  for (const branch of getLineBranches(line)) {
    if (!branch.stations.length) continue
    const parentPath = pathFromMainStartTo(branch.fromStationId, new Set([branch.id]))
    if (!parentPath) continue
    routes.push([...parentPath, ...branch.stations])
  }
  return routes
}

export function getLineTerminusStations(
  line: Pick<GameLine, 'stations' | 'branches'>,
): GameStation[] {
  const termini: GameStation[] = []
  const seen = new Set<string>()
  const add = (station?: GameStation) => {
    if (!station || seen.has(station.id)) return
    seen.add(station.id)
    termini.push(station)
  }
  add(line.stations[0])
  add(line.stations[line.stations.length - 1])
  for (const branch of getLineBranches(line)) add(branch.stations[branch.stations.length - 1])
  return termini
}

export function getLineStationCount(line: Pick<GameLine, 'stations' | 'branches'>): number {
  return getLineAllStations(line).length
}
