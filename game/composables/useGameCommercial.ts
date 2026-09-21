import { computed, ref } from 'vue'
import { CLU_COMMERCIAL } from '../config/commercial'

export type CommercialUser = {
  id: string
  username: string
  email: string | null
  ownsProduct: boolean
  reviewRequired: boolean
  createdAt?: string
}

export type CommercialSession = {
  id: string
  deviceLabel: string
  current: boolean
  createdAt: string
  lastSeenAt: string
}

export type AccessStatus = {
  serverNow: string
  authenticated: boolean
  canPlay: boolean
  accessReason: 'preview_guest' | 'preview_account' | 'owned' | 'locked'
  freePreview: {
    active: boolean
    startsAt: string
    endsAt: string
  }
  paymentsEnabled: boolean
  legalReady: boolean
  user: CommercialUser | null
}

const status = ref<AccessStatus | null>(null)
const loading = ref(false)
const error = ref('')
const authBusy = ref(false)
const checkoutBusy = ref(false)
const recoveryCode = ref('')
const sessions = ref<CommercialSession[]>([])
const heartbeatFailures = ref(0)
const developmentFallback = ref(false)
let heartbeatTimer: number | null = null


function isLocalDevelopment() {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
}

function localDevelopmentStatus(): AccessStatus {
  return {
    serverNow: new Date().toISOString(),
    authenticated: false,
    canPlay: true,
    accessReason: 'preview_guest',
    freePreview: {
      active: true,
      startsAt: CLU_COMMERCIAL.preview.startIso,
      endsAt: CLU_COMMERCIAL.preview.endIso,
    },
    paymentsEnabled: false,
    legalReady: false,
    user: null,
  }
}

function getDeviceId() {
  if (typeof localStorage === 'undefined') return 'unknown-device'
  const key = 'clu_device_id_v1'
  let value = localStorage.getItem(key)
  if (!value) {
    value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, value)
  }
  return value
}

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Navigateur'
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur'
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS|Macintosh/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Appareil'
  return `${browser} · ${os}`
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  headers.set('X-CLU-Device-Id', getDeviceId())
  headers.set('X-CLU-Device-Label', getDeviceLabel())
  const response = await fetch(`${CLU_COMMERCIAL.apiBase}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  let body: any = null
  try { body = await response.json() } catch { body = null }
  if (!response.ok) throw new Error(body?.message || body?.error || `Erreur ${response.status}`)
  return body as T
}

export function useGameCommercial() {
  const user = computed(() => status.value?.user || null)
  const authenticated = computed(() => Boolean(status.value?.authenticated))
  const canPlay = computed(() => Boolean(status.value?.canPlay))
  const previewActive = computed(() => Boolean(status.value?.freePreview.active))
  const ownsProduct = computed(() => Boolean(status.value?.user?.ownsProduct))
  const paymentsEnabled = computed(() => Boolean(status.value?.paymentsEnabled))

  async function refresh(silent = false) {
    if (!silent) loading.value = true
    error.value = ''
    try {
      status.value = await api<AccessStatus>('/v1/access/status')
      developmentFallback.value = false
      heartbeatFailures.value = 0
      return status.value
    } catch (e) {
      if (isLocalDevelopment()) {
        status.value = localDevelopmentStatus()
        developmentFallback.value = true
        heartbeatFailures.value = 0
        error.value = ''
        return status.value
      }

      developmentFallback.value = false
      heartbeatFailures.value += 1
      if (!silent || heartbeatFailures.value >= 3) {
        const message = e instanceof Error ? e.message : ''
        error.value = /failed to fetch|networkerror|load failed|network request failed/i.test(message)
          ? 'Connexion à CLU impossible.'
          : message || 'Connexion à CLU impossible.'
      }
      throw e
    } finally {
      if (!silent) loading.value = false
    }
  }

  async function ensureCommercialServer() {
    if (!developmentFallback.value) return
    await refresh(true)
    if (developmentFallback.value) {
      throw new Error('Le serveur de comptes CLU n’est pas lancé.')
    }
  }

  async function register(payload: { username: string; password: string; email: string; termsVersion: string; privacyVersion: string }) {
    authBusy.value = true
    error.value = ''
    try {
      await ensureCommercialServer()
      const result = await api<{ recoveryCode: string }>('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      recoveryCode.value = result.recoveryCode
      await refresh(true)
      return result
    } finally { authBusy.value = false }
  }

  async function login(username: string, password: string) {
    authBusy.value = true
    error.value = ''
    try {
      await ensureCommercialServer()
      await api('/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      await refresh(true)
    } finally { authBusy.value = false }
  }

  async function logout() {
    authBusy.value = true
    try {
      await ensureCommercialServer()
      await api('/v1/auth/logout', { method: 'POST' })
      recoveryCode.value = ''
      sessions.value = []
      await refresh(true)
    } finally { authBusy.value = false }
  }

  async function logoutAll() {
    await ensureCommercialServer()
    await api('/v1/account/sessions/logout-all', { method: 'POST' })
    recoveryCode.value = ''
    sessions.value = []
    await refresh(true)
  }

  async function recover(payload: { username: string; email: string; recoveryCode: string; newPassword: string }) {
    authBusy.value = true
    try {
      await ensureCommercialServer()
      const result = await api<{ recoveryCode: string }>('/v1/auth/recover', {
        method: 'POST', body: JSON.stringify(payload),
      })
      recoveryCode.value = result.recoveryCode
      await refresh(true)
      return result
    } finally { authBusy.value = false }
  }

  async function revealRecoveryCode(password: string) {
    await ensureCommercialServer()
    const result = await api<{ recoveryCode: string }>('/v1/account/recovery-code/reveal', {
      method: 'POST', body: JSON.stringify({ password }),
    })
    recoveryCode.value = result.recoveryCode
    return result.recoveryCode
  }

  async function rotateRecoveryCode(password: string) {
    await ensureCommercialServer()
    const result = await api<{ recoveryCode: string }>('/v1/account/recovery-code/rotate', {
      method: 'POST', body: JSON.stringify({ password }),
    })
    recoveryCode.value = result.recoveryCode
    return result.recoveryCode
  }

  async function updateUsername(username: string, password: string) {
    await ensureCommercialServer()
    await api('/v1/account/username', { method: 'POST', body: JSON.stringify({ username, password }) })
    await refresh(true)
  }

  async function updateEmail(email: string, password: string) {
    await ensureCommercialServer()
    await api('/v1/account/email', { method: 'POST', body: JSON.stringify({ email, password }) })
    await refresh(true)
  }

  async function listSessions() {
    await ensureCommercialServer()
    const result = await api<{ sessions: CommercialSession[] }>('/v1/account/sessions')
    sessions.value = result.sessions
    return result.sessions
  }

  async function revokeSession(id: string) {
    await ensureCommercialServer()
    await api(`/v1/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await listSessions()
  }

  async function deleteAccount(password: string) {
    await ensureCommercialServer()
    await api('/v1/account/delete', { method: 'POST', body: JSON.stringify({ password }) })
    recoveryCode.value = ''
    sessions.value = []
    await refresh(true)
  }

  async function checkout(payload: { cgvVersion: string; immediateAccess: boolean; legalCapacity: boolean }) {
    checkoutBusy.value = true
    try {
      await ensureCommercialServer()
      const result = await api<{ url: string }>('/v1/checkout', { method: 'POST', body: JSON.stringify(payload) })
      if (!result.url) throw new Error('Lien de paiement indisponible.')
      window.location.assign(result.url)
    } finally { checkoutBusy.value = false }
  }

  function startHeartbeat() {
    stopHeartbeat()
    if (typeof window === 'undefined') return
    heartbeatTimer = window.setInterval(async () => {
      try { await refresh(true) } catch { /* le prochain cycle réessaie */ }
    }, 5 * 60_000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null && typeof window !== 'undefined') window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  return {
    status, loading, error, authBusy, checkoutBusy, recoveryCode, sessions, heartbeatFailures, developmentFallback,
    user, authenticated, canPlay, previewActive, ownsProduct, paymentsEnabled,
    refresh, register, login, logout, logoutAll, recover, revealRecoveryCode, rotateRecoveryCode,
    updateUsername, updateEmail, listSessions, revokeSession, deleteAccount, checkout, startHeartbeat, stopHeartbeat,
  }
}
