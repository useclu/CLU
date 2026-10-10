interface WorldPersistentEnvelope<T> {
  version: 1
  savedAt: number
  expiresAt: number
  staleUntil: number
  value: T
}

export interface WorldPersistentCacheHit<T> {
  value: T
  stale: boolean
}

const STORAGE_PREFIX = 'clu-world-cache-v1:'
const DEFAULT_MAX_ENTRIES = 36

function storageAvailable() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage }
  catch { return null }
}

function storageKey(namespace: string, key: string) {
  return `${STORAGE_PREFIX}${namespace}:${key}`
}

function parseEnvelope<T>(raw: string | null): WorldPersistentEnvelope<T> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<WorldPersistentEnvelope<T>>
    if (parsed.version !== 1 || !Number.isFinite(Number(parsed.savedAt)) || !Number.isFinite(Number(parsed.expiresAt)) || !Number.isFinite(Number(parsed.staleUntil))) return null
    if (!Object.prototype.hasOwnProperty.call(parsed, 'value')) return null
    return parsed as WorldPersistentEnvelope<T>
  }
  catch { return null }
}

function prune(namespace: string, maxEntries = DEFAULT_MAX_ENTRIES) {
  const storage = storageAvailable()
  if (!storage) return
  const prefix = `${STORAGE_PREFIX}${namespace}:`
  const now = Date.now()
  const entries: Array<{ key: string; savedAt: number; staleUntil: number }> = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(prefix)) continue
      const envelope = parseEnvelope<unknown>(storage.getItem(key))
      if (!envelope || envelope.staleUntil <= now) {
        storage.removeItem(key)
        index -= 1
        continue
      }
      entries.push({ key, savedAt: envelope.savedAt, staleUntil: envelope.staleUntil })
    }
    if (entries.length <= maxEntries) return
    entries
      .sort((a, b) => a.savedAt - b.savedAt)
      .slice(0, entries.length - maxEntries)
      .forEach(entry => storage.removeItem(entry.key))
  }
  catch { /* Le cache persistant reste une optimisation facultative. */ }
}

export function readWorldPersistentCache<T>(
  namespace: string,
  key: string,
  options: { allowStale?: boolean } = {},
): WorldPersistentCacheHit<T> | null {
  const storage = storageAvailable()
  if (!storage) return null
  try {
    const fullKey = storageKey(namespace, key)
    const envelope = parseEnvelope<T>(storage.getItem(fullKey))
    if (!envelope) {
      storage.removeItem(fullKey)
      return null
    }
    const now = Date.now()
    if (envelope.staleUntil <= now) {
      storage.removeItem(fullKey)
      return null
    }
    const stale = envelope.expiresAt <= now
    if (stale && !options.allowStale) return null
    return { value: envelope.value, stale }
  }
  catch { return null }
}

export function writeWorldPersistentCache<T>(
  namespace: string,
  key: string,
  value: T,
  ttlMs: number,
  staleTtlMs: number,
  maxEntries = DEFAULT_MAX_ENTRIES,
) {
  const storage = storageAvailable()
  if (!storage) return
  const now = Date.now()
  const safeTtl = Math.max(60_000, Math.round(Number(ttlMs) || 0))
  const safeStaleTtl = Math.max(safeTtl, Math.round(Number(staleTtlMs) || safeTtl))
  try {
    const envelope: WorldPersistentEnvelope<T> = {
      version: 1,
      savedAt: now,
      expiresAt: now + safeTtl,
      staleUntil: now + safeStaleTtl,
      value,
    }
    storage.setItem(storageKey(namespace, key), JSON.stringify(envelope))
    prune(namespace, maxEntries)
  }
  catch { /* Quota / navigation privée : le cache mémoire prend le relais. */ }
}
