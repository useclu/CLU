import type { GameSave } from '../types/game'

export type CluOnlinePatchOperation = 'add' | 'remove' | 'replace'

export interface CluOnlineGamePatch {
  op: CluOnlinePatchOperation
  path: string
  value?: unknown
}

const IGNORED_PATH_PREFIXES = [
  '/id',
  '/updatedAt',
  '/data/uiState',
  '/data/assistant',
]

let onlinePersistSink: ((save: GameSave) => void | Promise<void>) | null = null
let onlineLocalPersistencePolicy: ((save: GameSave) => boolean) | null = null

export function registerOnlinePersistSink(sink: ((save: GameSave) => void | Promise<void>) | null) {
  onlinePersistSink = sink
}

export function registerOnlineLocalPersistencePolicy(policy: ((save: GameSave) => boolean) | null) {
  onlineLocalPersistencePolicy = policy
}

export function shouldPersistOnlineSaveLocally(save: GameSave) {
  if (!onlineLocalPersistencePolicy) return true
  try { return onlineLocalPersistencePolicy(save) !== false }
  catch { return true }
}

export function notifyOnlinePersist(save: GameSave) {
  if (!onlinePersistSink) return
  try {
    const result = onlinePersistSink(save)
    if (result && typeof (result as Promise<void>).catch === 'function') {
      void (result as Promise<void>).catch(() => undefined)
    }
  }
  catch { /* La sauvegarde locale ne doit jamais dépendre du réseau. */ }
}

function cloneValue<T>(value: T): T {
  // Les sauvegardes de jeu vivent dans un état Vue réactif. structuredClone()
  // refuse les Proxy réactifs dans les navigateurs (DataCloneError), alors que
  // le format de sauvegarde CLU est volontairement JSON-sérialisable. Utiliser
  // le même clone JSON que le moteur garantit en plus que ce qui est comparé
  // est exactement ce qui pourra être envoyé au Worker.
  if (value === null || value === undefined || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value)) as T
}

export function cloneOnlineSave(save: GameSave, onlineId?: string | null): GameSave {
  const copy = cloneValue(save)
  if (onlineId) copy.id = `online:${onlineId}`
  return copy
}

function escapePointerSegment(segment: string) {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

function decodePointerSegment(segment: string) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

function isIgnoredPath(path: string) {
  return IGNORED_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function samePrimitive(a: unknown, b: unknown) {
  return Object.is(a, b)
}

function idsOf(values: unknown[]): string[] | null {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!isObjectRecord(value) || typeof value.id !== 'string' || !value.id || seen.has(value.id)) return null
    seen.add(value.id)
    ids.push(value.id)
  }
  return ids
}

function diffArrayById(before: unknown[], after: unknown[], path: string, output: CluOnlineGamePatch[]) {
  const beforeIds = idsOf(before)
  const afterIds = idsOf(after)
  if (!beforeIds || !afterIds) return false

  const afterSet = new Set(afterIds)
  const workingIds = beforeIds.slice()
  const workingValues = before.slice()

  for (let index = workingIds.length - 1; index >= 0; index -= 1) {
    if (afterSet.has(workingIds[index])) continue
    output.push({ op: 'remove', path: `${path}/${index}` })
    workingIds.splice(index, 1)
    workingValues.splice(index, 1)
  }

  for (let targetIndex = 0; targetIndex < afterIds.length; targetIndex += 1) {
    const targetId = afterIds[targetIndex]
    const currentIndex = workingIds.indexOf(targetId)
    if (currentIndex === -1) {
      output.push({ op: 'add', path: `${path}/${targetIndex}`, value: cloneValue(after[targetIndex]) })
      workingIds.splice(targetIndex, 0, targetId)
      workingValues.splice(targetIndex, 0, cloneValue(after[targetIndex]))
      continue
    }
    if (currentIndex !== targetIndex) return false
    diffValue(workingValues[targetIndex], after[targetIndex], `${path}/${targetIndex}`, output)
  }
  return true
}

function diffValue(before: unknown, after: unknown, path: string, output: CluOnlineGamePatch[]) {
  if (isIgnoredPath(path)) return
  if (samePrimitive(before, after)) return

  if (Array.isArray(before) && Array.isArray(after)) {
    const start = output.length
    if (diffArrayById(before, after, path, output)) return
    output.splice(start)
    output.push({ op: 'replace', path, value: cloneValue(after) })
    return
  }

  if (isObjectRecord(before) && isObjectRecord(after)) {
    const beforeKeys = Object.keys(before)
    const afterKeys = Object.keys(after)
    const afterSet = new Set(afterKeys)
    for (const key of beforeKeys) {
      const childPath = `${path}/${escapePointerSegment(key)}`
      if (isIgnoredPath(childPath) || afterSet.has(key)) continue
      output.push({ op: 'remove', path: childPath })
    }
    for (const key of afterKeys) {
      const childPath = `${path}/${escapePointerSegment(key)}`
      if (isIgnoredPath(childPath)) continue
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        output.push({ op: 'add', path: childPath, value: cloneValue(after[key]) })
      }
      else diffValue(before[key], after[key], childPath, output)
    }
    return
  }

  output.push({ op: path ? 'replace' : 'replace', path, value: cloneValue(after) })
}

export function diffOnlineGameSave(before: GameSave, after: GameSave): CluOnlineGamePatch[] {
  const output: CluOnlineGamePatch[] = []
  diffValue(before, after, '', output)
  return output.filter(patch => patch.path && !isIgnoredPath(patch.path))
}

function pointerSegments(path: string) {
  if (!path.startsWith('/')) throw new Error('Chemin de mutation invalide.')
  const raw = path.slice(1)
  if (!raw) return []
  return raw.split('/').map(decodePointerSegment)
}

function assertSafeSegment(segment: string) {
  if (segment === '__proto__' || segment === 'prototype' || segment === 'constructor') {
    throw new Error('Chemin de mutation interdit.')
  }
}

function arrayIndex(segment: string, length: number, allowEnd: boolean) {
  if (segment === '-' && allowEnd) return length
  if (!/^(0|[1-9]\d*)$/.test(segment)) throw new Error('Indice de mutation invalide.')
  const value = Number(segment)
  const max = allowEnd ? length : length - 1
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('Indice de mutation hors limites.')
  return value
}

export function applyOnlineGamePatches(target: unknown, patches: CluOnlineGamePatch[]) {
  for (const patch of patches) {
    const segments = pointerSegments(patch.path)
    if (!segments.length) throw new Error('La racine complète ne peut pas être remplacée par mutation.')
    let parent: any = target
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]
      assertSafeSegment(segment)
      if (Array.isArray(parent)) parent = parent[arrayIndex(segment, parent.length, false)]
      else {
        if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, segment)) throw new Error('Chemin de mutation introuvable.')
        parent = parent[segment]
      }
    }

    const leaf = segments.at(-1)!
    assertSafeSegment(leaf)
    if (Array.isArray(parent)) {
      const index = arrayIndex(leaf, parent.length, patch.op === 'add')
      if (patch.op === 'add') parent.splice(index, 0, cloneValue(patch.value))
      else if (patch.op === 'remove') parent.splice(index, 1)
      else parent[index] = cloneValue(patch.value)
      continue
    }

    if (!parent || typeof parent !== 'object') throw new Error('Parent de mutation invalide.')
    if (patch.op === 'remove') {
      if (!Object.prototype.hasOwnProperty.call(parent, leaf)) throw new Error('Clé de mutation introuvable.')
      delete parent[leaf]
    }
    else {
      if (patch.op === 'replace' && !Object.prototype.hasOwnProperty.call(parent, leaf)) throw new Error('Clé de mutation introuvable.')
      parent[leaf] = cloneValue(patch.value)
    }
  }
  return target
}
