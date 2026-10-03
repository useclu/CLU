export interface CluOnlineRecoveryRecord {
  version: 2
  code: string
  jetonMembre: string
  sauvegardeLocaleId: string | null
  updatedAt: number
}

const STORAGE_KEY = 'clu-metropole-online-active-v2'
const LEGACY_STORAGE_KEY = 'clu-metropole-online-session-v1'
const MAX_AGE_MS = 10 * 60 * 1000

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function clearLegacyOnlineRecovery(): void {
  if (!storageAvailable()) return
  try { window.sessionStorage.removeItem(LEGACY_STORAGE_KEY) }
  catch { /* Nettoyage non critique. */ }
}

export function readOnlineRecovery(): CluOnlineRecoveryRecord | null {
  if (!storageAvailable()) return null
  try {
    clearLegacyOnlineRecovery()
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CluOnlineRecoveryRecord>
    const code = String(parsed.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    const jetonMembre = String(parsed.jetonMembre || '')
    const updatedAt = Number(parsed.updatedAt)
    if (parsed.version !== 2 || code.length < 4 || jetonMembre.length < 20 || !Number.isFinite(updatedAt) || Date.now() - updatedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return {
      version: 2,
      code,
      jetonMembre,
      sauvegardeLocaleId: typeof parsed.sauvegardeLocaleId === 'string' && parsed.sauvegardeLocaleId.trim() ? parsed.sauvegardeLocaleId.trim() : null,
      updatedAt,
    }
  }
  catch {
    try { window.sessionStorage.removeItem(STORAGE_KEY) } catch {}
    return null
  }
}

export function writeOnlineRecovery(record: Omit<CluOnlineRecoveryRecord, 'version' | 'updatedAt'>): void {
  if (!storageAvailable()) return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      code: record.code,
      jetonMembre: record.jetonMembre,
      sauvegardeLocaleId: record.sauvegardeLocaleId || null,
      updatedAt: Date.now(),
    } satisfies CluOnlineRecoveryRecord))
  }
  catch { /* La reconnexion F5 reste une amélioration, pas une dépendance. */ }
}

export function clearOnlineRecovery(): void {
  if (!storageAvailable()) return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY)
  }
  catch { /* Nettoyage non critique. */ }
}
