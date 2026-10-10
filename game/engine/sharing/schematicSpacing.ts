/**
 * CLU / Image du monde — détente topologique du plan schématique.
 *
 * Les arrêts réellement distincts ne doivent pas se superposer parce qu'ils sont
 * géographiquement voisins. Le calcul travaille UNIQUEMENT sur une copie des
 * coordonnées du plan PNG : ni les données de ligne ni les sauvegardes ne changent.
 *
 * Les arêtes définissent la connectivité autorisée. Les nœuds ne sont jamais
 * fusionnés. Les forces sont déterministes, bornées et spatialement indexées.
 */
export interface SchematicPoint { x: number; y: number }
export interface SchematicSpacingEdge { from: string; to: string }
export interface SchematicSpacingFrame { left: number; top: number; right: number; bottom: number }

function length(dx: number, dy: number) { return Math.hypot(dx, dy) }
function clamp(value: number, low: number, high: number) { return Math.max(low, Math.min(high, value)) }
function stringPhase(key: string) {
  let code = 2166136261
  for (let i = 0; i < key.length; i += 1) code = Math.imul(code ^ key.charCodeAt(i), 16777619)
  return (code >>> 0) / 4294967296 * Math.PI * 2
}

/**
 * Repousse les arrêts distincts / tronçons trop rapprochés, tout en ancrant le
 * schéma au territoire d'origine. Un barycentre de correspondance reste UN nœud.
 */
export function spaceSchematicNodes(
  input: ReadonlyMap<string, SchematicPoint>,
  edges: readonly SchematicSpacingEdge[],
  stops: ReadonlySet<string>,
  frame: SchematicSpacingFrame,
  scale = 1,
  structuralNodes: ReadonlySet<string> = new Set(),
): Map<string, SchematicPoint> {
  if (input.size < 2 || !edges.length) return new Map([...input].map(([key, point]) => [key, { ...point }]))

  const ids = [...input.keys()].sort()
  const indexById = new Map(ids.map((id, index) => [id, index] as const))
  const n = ids.length
  // Périphérie préservée ; la marge centrale est distribuée aux arrêts urbains.
  const homeX = new Float64Array(n)
  const homeY = new Float64Array(n)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const stop = new Uint8Array(n)
  const degree = new Uint16Array(n)
  const neighborIndices: Array<Set<number>> = Array.from({ length: n }, () => new Set())
  for (let i = 0; i < n; i += 1) {
    const point = input.get(ids[i]!)!
    x[i] = homeX[i] = point.x
    y[i] = homeY[i] = point.y
    stop[i] = stops.has(ids[i]!) ? 1 : 0
  }
  const links: Array<[number, number]> = []
  const seenLinks = new Set<string>()
  for (const edge of edges) {
    const a = indexById.get(edge.from)
    const b = indexById.get(edge.to)
    if (a === undefined || b === undefined || a === b) continue
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`
    if (seenLinks.has(key)) continue
    seenLinks.add(key)
    links.push([a, b])
    degree[a]++
    degree[b]++
    neighborIndices[a]!.add(b)
    neighborIndices[b]!.add(a)
  }
  if (!links.length) return new Map(ids.map((id, index) => [id, { x: x[index]!, y: y[index]! }]))

  const minGap = 25 * scale
  const stationGap = 23 * scale
  const edgeGap = 11.5 * scale
  const cellSize = 32 * scale
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)
  const cellKey = (column: number, row: number) => `${column}:${row}`
  const numberOfPasses = n > 1100 ? 28 : n > 550 ? 46 : 86
  const centerX = (frame.left + frame.right) / 2
  const centerY = (frame.top + frame.bottom) / 2
  const frameWidth = Math.max(1, frame.right - frame.left)
  const frameHeight = Math.max(1, frame.bottom - frame.top)

  for (let iteration = 0; iteration < numberOfPasses; iteration += 1) {
    fx.fill(0)
    fy.fill(0)
    const buckets = new Map<string, number[]>()
    const columns = new Int32Array(n)
    const rows = new Int32Array(n)
    for (let i = 0; i < n; i += 1) {
      const column = Math.floor(x[i]! / cellSize)
      const row = Math.floor(y[i]! / cellSize)
      columns[i] = column
      rows[i] = row
      const key = cellKey(column, row)
      const bucket = buckets.get(key) ?? []
      bucket.push(i)
      buckets.set(key, bucket)
    }

    // 1. Chaque station non commune doit posséder son propre espace de lecture.
    for (let i = 0; i < n; i += 1) {
      if (!stop[i]) continue
      for (let cx = -1; cx <= 1; cx += 1) {
        for (let cy = -1; cy <= 1; cy += 1) {
          const bucket = buckets.get(cellKey(columns[i]! + cx, rows[i]! + cy))
          if (!bucket) continue
          for (const j of bucket) {
            if (j <= i || !stop[j]) continue
            let dx = x[j]! - x[i]!
            let dy = y[j]! - y[i]!
            let distance = length(dx, dy)
            const target = neighborIndices[i]!.has(j) ? minGap : stationGap
            if (distance >= target) continue
            if (distance < .001) {
              const phase = stringPhase(`${ids[i]}|${ids[j]}`)
              dx = Math.cos(phase)
              dy = Math.sin(phase)
              distance = 1
            }
            const force = (target - distance) * .62 / distance
            fx[i] -= dx * force
            fy[i] -= dy * force
            fx[j] += dx * force
            fy[j] += dy * force
          }
        }
      }
    }

    // 2. Les segments consécutifs doivent être assez longs pour matérialiser les
    // stations. Aucune connexion nouvelle n'est créée par la détente.
    for (const [a, b] of links) {
      let dx = x[b]! - x[a]!
      let dy = y[b]! - y[a]!
      let distance = length(dx, dy)
      const target = stop[a] && stop[b] ? minGap : stop[a] || stop[b] ? minGap * .72 : minGap * .45
      if (distance >= target) continue
      if (distance < .001) {
        const phase = stringPhase(`${ids[a]}:${ids[b]}`)
        dx = Math.cos(phase)
        dy = Math.sin(phase)
        distance = 1
      }
      const force = (target - distance) * .33 / distance
      fx[a] -= dx * force
      fy[a] -= dy * force
      fx[b] += dx * force
      fy[b] += dy * force
    }

    // 2b. Un câble est un alignement, pas une succession de zigzags.
    // Un arrêt de degré 2 presque aligné à l'origine est rappelé vers l'axe
    // de ses deux voisins. Les vraies bifurcations et virages sont préservés.
    for (let i = 0; i < n; i += 1) {
      if (degree[i] !== 2 || !stop[i] || structuralNodes.has(ids[i]!)) continue
      const pair = [...neighborIndices[i]!]
      const first = pair[0]!
      const second = pair[1]!
      const hx = homeX[second]! - homeX[first]!
      const hy = homeY[second]! - homeY[first]!
      const homeSquared = hx * hx + hy * hy
      if (homeSquared < (12 * scale) ** 2) continue
      const originalFraction = ((homeX[i]! - homeX[first]!) * hx + (homeY[i]! - homeY[first]!) * hy) / homeSquared
      if (originalFraction < .07 || originalFraction > .93) continue
      const homeNormalDistance = Math.abs((homeX[i]! - homeX[first]!) * hy - (homeY[i]! - homeY[first]!) * hx) / Math.sqrt(homeSquared)
      if (homeNormalDistance > 16 * scale) continue
      const dx = x[second]! - x[first]!
      const dy = y[second]! - y[first]!
      const span = dx * dx + dy * dy
      if (span < (15 * scale) ** 2) continue
      const fraction = clamp(((x[i]! - x[first]!) * dx + (y[i]! - y[first]!) * dy) / span, .12, .88)
      const targetX = x[first]! + dx * fraction
      const targetY = y[first]! + dy * fraction
      fx[i] += (targetX - x[i]!) * .20
      fy[i] += (targetY - y[i]!) * .20
    }

    // 3. Une gare ne doit pas se trouver au milieu du tronçon d'une ligne qui
    // ne la dessert pas. Ce test est limité aux cellules traversées par chaque
    // arête ; il évite les coûts quadratiques sur les très grands réseaux.
    for (const [a, b] of links) {
      const dx = x[b]! - x[a]!
      const dy = y[b]! - y[a]!
      const squared = dx * dx + dy * dy
      if (squared < 1) continue
      const minCol = Math.floor((Math.min(x[a]!, x[b]!) - edgeGap) / cellSize)
      const maxCol = Math.floor((Math.max(x[a]!, x[b]!) + edgeGap) / cellSize)
      const minRow = Math.floor((Math.min(y[a]!, y[b]!) - edgeGap) / cellSize)
      const maxRow = Math.floor((Math.max(y[a]!, y[b]!) + edgeGap) / cellSize)
      // Une diagonale exceptionnellement longue ne doit pas faire exploser le
      // nombre de cellules inspectées.
      if ((maxCol - minCol + 1) * (maxRow - minRow + 1) > 170) continue
      for (let col = minCol; col <= maxCol; col += 1) {
        for (let row = minRow; row <= maxRow; row += 1) {
          for (const j of buckets.get(cellKey(col, row)) ?? []) {
            if (!stop[j] || j === a || j === b || neighborIndices[j]!.has(a) || neighborIndices[j]!.has(b)) continue
            const ratio = clamp(((x[j]! - x[a]!) * dx + (y[j]! - y[a]!) * dy) / squared, .05, .95)
            if (ratio <= .052 || ratio >= .948) continue
            const projX = x[a]! + dx * ratio
            const projY = y[a]! + dy * ratio
            let sepX = x[j]! - projX
            let sepY = y[j]! - projY
            let distance = length(sepX, sepY)
            if (distance >= edgeGap) continue
            if (distance < .001) {
              sepX = -dy / Math.sqrt(squared)
              sepY = dx / Math.sqrt(squared)
              distance = 1
            }
            const force = (edgeGap - distance) * .19 / distance
            fx[j] += sepX * force
            fy[j] += sepY * force
            fx[a] -= sepX * force * (1 - ratio) * .32
            fy[a] -= sepY * force * (1 - ratio) * .32
            fx[b] -= sepX * force * ratio * .32
            fy[b] -= sepY * force * ratio * .32
          }
        }
      }
    }

    // 4. Ancrage géographique souple : les terminus et stations isolées bougent
    // moins que les nœuds centraux. L'optimisation ne sort jamais de la feuille.
    const fade = 1 - iteration / Math.max(1, numberOfPasses - 1)
    for (let i = 0; i < n; i += 1) {
      const centrality = 1 - clamp(length((homeX[i]! - centerX) / (frameWidth * .6), (homeY[i]! - centerY) / (frameHeight * .6)), 0, 1)
      const maxShift = (23 + centrality * 138) * scale
      const homeWeight = (degree[i] <= 1 ? .031 : .009) * (0.65 + 0.7 * iteration / numberOfPasses)
      fx[i] += (homeX[i]! - x[i]!) * homeWeight
      fy[i] += (homeY[i]! - y[i]!) * homeWeight
      const maxStep = (2.45 + fade * .95) * scale
      const magnitude = length(fx[i]!, fy[i]!)
      const step = magnitude > maxStep ? maxStep / magnitude : 1
      const nextX = x[i]! + fx[i]! * step
      const nextY = y[i]! + fy[i]! * step
      const homeDx = nextX - homeX[i]!
      const homeDy = nextY - homeY[i]!
      const shift = length(homeDx, homeDy)
      const shiftRatio = shift > maxShift ? maxShift / shift : 1
      x[i] = clamp(homeX[i]! + homeDx * shiftRatio, frame.left + 10 * scale, frame.right - 10 * scale)
      y[i] = clamp(homeY[i]! + homeDy * shiftRatio, frame.top + 10 * scale, frame.bottom - 10 * scale)
    }
  }
  return new Map(ids.map((id, index) => [id, { x: x[index]!, y: y[index]! }]))
}
