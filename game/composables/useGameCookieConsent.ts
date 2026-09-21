import { computed, ref } from 'vue'
import { CLU_COMMERCIAL } from '../config/commercial'

export type CookieConsentState = {
  necessary: true
  analytics: boolean
  ads: boolean
  decidedAt: string
  version: string
}

const STORAGE_KEY = 'clu_cookie_consent_v1'
const VERSION = '1.0'
const state = ref<CookieConsentState | null>(null)
const ready = ref(false)
const panelOpen = ref(false)
let analyticsLoaded = false

function readStored(): CookieConsentState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed || parsed.version !== VERSION) return null
    const decidedAt = Date.parse(String(parsed.decidedAt || ''))
    if (!Number.isFinite(decidedAt) || Date.now() - decidedAt > 183 * 24 * 60 * 60 * 1000) return null
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      ads: Boolean(parsed.ads),
      decidedAt: String(parsed.decidedAt || ''),
      version: VERSION,
    }
  } catch { return null }
}

function persist(next: CookieConsentState) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(args)
}

function applyGoogleConsent(consent: CookieConsentState | null) {
  if (typeof window === 'undefined') return
  gtag('consent', 'default', {
    analytics_storage: consent?.analytics ? 'granted' : 'denied',
    ad_storage: consent?.ads ? 'granted' : 'denied',
    ad_user_data: consent?.ads ? 'granted' : 'denied',
    ad_personalization: consent?.ads ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  })
  gtag('consent', 'update', {
    analytics_storage: consent?.analytics ? 'granted' : 'denied',
    ad_storage: consent?.ads ? 'granted' : 'denied',
    ad_user_data: consent?.ads ? 'granted' : 'denied',
    ad_personalization: consent?.ads ? 'granted' : 'denied',
  })
}

function loadAnalyticsIfAllowed(consent: CookieConsentState | null) {
  if (typeof document === 'undefined' || !consent?.analytics || analyticsLoaded) return
  const id = CLU_COMMERCIAL.analytics.measurementId
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return
  analyticsLoaded = true
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
  gtag('js', new Date())
  gtag('config', id, { anonymize_ip: true })
}

export function useGameCookieConsent() {
  const hasChoice = computed(() => Boolean(state.value))

  function initialize() {
    if (ready.value) return
    state.value = readStored()
    applyGoogleConsent(state.value)
    loadAnalyticsIfAllowed(state.value)
    ready.value = true
  }

  function save(analytics: boolean, ads = false) {
    const next: CookieConsentState = {
      necessary: true,
      analytics,
      ads,
      decidedAt: new Date().toISOString(),
      version: VERSION,
    }
    state.value = next
    persist(next)
    applyGoogleConsent(next)
    loadAnalyticsIfAllowed(next)
    panelOpen.value = false
  }

  function acceptAll() { save(true, false) }
  function rejectAll() { save(false, false) }
  function openPanel() { panelOpen.value = true }
  function closePanel() { panelOpen.value = false }

  return { state, ready, panelOpen, hasChoice, initialize, save, acceptAll, rejectAll, openPanel, closePanel }
}
