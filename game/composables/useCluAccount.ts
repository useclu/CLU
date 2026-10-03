import { computed, readonly, ref } from 'vue'
import { useRuntimeConfig } from '#app'

export interface CluAccountUser {
  id: string
  pseudo: string
  typeCompte: 'gratuit' | 'premium'
  premiumJusquA: number | null
  aMotDePasse: boolean
  googleLie: boolean
  prochainChangementPseudoA: number | null
  conditionsCompteAJour: boolean
}

export interface CluAccountRegistrationResult {
  utilisateur: CluAccountUser
  codeRecuperation: string
}

export interface CluAccountRecoveryResult {
  utilisateur: {
    id: string
    pseudo: string
  }
  nouveauCodeRecuperation: string
}

export interface CluGoogleConnectionResult {
  lie: boolean
  utilisateur?: CluAccountUser
}

export interface CluPremiumConfirmations {
  accepteCgu: boolean
  confirmeMajeur: boolean
  accepteConditionsPremium: boolean
  demandeActivationImmediate: boolean
}

type RecoveryCodeContext = 'INSCRIPTION' | 'RECUPERATION' | null
export type CluPremiumReturnStatus = 'SUCCES' | 'ANNULE' | 'EN_ATTENTE' | null

interface ApiErrorPayload {
  ok?: boolean
  erreur?: string
}

interface ApiSessionPayload {
  ok: boolean
  connecte?: boolean
  utilisateur?: CluAccountUser
}

const utilisateur = ref<CluAccountUser | null>(null)
const initialise = ref(false)
const chargement = ref(false)
const erreur = ref<string | null>(null)
const codeRecuperationNouveau = ref<string | null>(null)
const contexteCodeRecuperation = ref<RecoveryCodeContext>(null)
const retourPremium = ref<CluPremiumReturnStatus>(null)
let initialisationEnCours: Promise<void> | null = null

function normaliserBaseUrl(value: unknown): string {
  const texte = String(value || 'https://api.useclu.pro').trim()
  return texte.replace(/\/+$/, '') || 'https://api.useclu.pro'
}

async function lireJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T
  }
  catch {
    return null
  }
}

function messageErreur(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Une erreur est survenue.'
}

function premiumActifPour(utilisateurCourant: CluAccountUser | null): boolean {
  const expiration = Number(utilisateurCourant?.premiumJusquA)
  return Number.isFinite(expiration) && expiration > Date.now()
}

function lireRetourPremiumUrl(): 'SUCCES' | 'ANNULE' | null {
  if (typeof window === 'undefined') return null
  const valeur = new URL(window.location.href).searchParams.get('premium')
  if (valeur === 'succes') return 'SUCCES'
  if (valeur === 'annule') return 'ANNULE'
  return null
}

function nettoyerRetourPremiumUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('premium') && !url.searchParams.has('session_id')) return
  url.searchParams.delete('premium')
  url.searchParams.delete('session_id')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function attendre(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

export function useCluAccount() {
  const runtimeConfig = useRuntimeConfig()
  const apiBaseUrl = import.meta.dev
    ? '/clu-api'
    : normaliserBaseUrl(runtimeConfig.public.cluApiBaseUrl)

  async function requeteJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      })
    }
    catch {
      throw new Error('Service de compte indisponible.')
    }

    const payload = await lireJson<T & ApiErrorPayload>(response)
    if (!response.ok) throw new Error(payload?.erreur || 'Une erreur est survenue.')
    if (!payload) throw new Error('Une erreur est survenue.')
    return payload
  }

  async function actualiserSession(force = false): Promise<void> {
    if (initialise.value && !force) return
    if (initialisationEnCours && !force) return initialisationEnCours

    const retourDepuisStripe = lireRetourPremiumUrl()

    initialisationEnCours = (async () => {
      chargement.value = true
      erreur.value = null

      const chargerSession = async (): Promise<boolean> => {
        let response: Response
        try {
          response = await fetch(`${apiBaseUrl}/api/moi`, {
            method: 'GET',
            credentials: 'include',
          })
        }
        catch {
          utilisateur.value = null
          erreur.value = 'Service de compte indisponible.'
          return false
        }

        const payload = await lireJson<ApiSessionPayload & ApiErrorPayload>(response)
        if (response.status === 401) {
          utilisateur.value = null
          return false
        }
        if (!response.ok) {
          utilisateur.value = null
          erreur.value = payload?.erreur || 'Une erreur est survenue.'
          return false
        }

        utilisateur.value = payload?.utilisateur ?? null
        return true
      }

      try {
        const sessionChargee = await chargerSession()

        if (retourDepuisStripe === 'SUCCES' && sessionChargee) {
          for (let tentative = 0; tentative < 5 && !premiumActifPour(utilisateur.value); tentative++) {
            await attendre(500 + (tentative * 400))
            const rechargee = await chargerSession()
            if (!rechargee) break
          }

          retourPremium.value = premiumActifPour(utilisateur.value)
            ? 'SUCCES'
            : 'EN_ATTENTE'
        }
        else if (retourDepuisStripe === 'ANNULE') {
          retourPremium.value = 'ANNULE'
        }
      }
      finally {
        if (retourDepuisStripe) nettoyerRetourPremiumUrl()
        initialise.value = true
        chargement.value = false
        initialisationEnCours = null
      }
    })()

    return initialisationEnCours
  }

  async function connexion(pseudo: string, motDePasse: string): Promise<CluAccountUser> {
    chargement.value = true
    erreur.value = null
    try {
      const payload = await requeteJson<{ ok: true; utilisateur: CluAccountUser }>('/api/connexion', {
        method: 'POST',
        body: JSON.stringify({ pseudo, motDePasse }),
      })
      utilisateur.value = payload.utilisateur
      initialise.value = true
      return payload.utilisateur
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function connexionGoogle(credential: string): Promise<CluGoogleConnectionResult> {
    chargement.value = true
    erreur.value = null
    try {
      const payload = await requeteJson<{ ok: true; lie: boolean; utilisateur?: CluAccountUser }>('/api/google/connexion', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })

      if (payload.lie && payload.utilisateur) {
        utilisateur.value = payload.utilisateur
        initialise.value = true
      }

      return {
        lie: payload.lie,
        utilisateur: payload.utilisateur,
      }
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function creerCompte(
    pseudo: string,
    motDePasse: string,
    accepteCgu: boolean,
    confirmeMajeur: boolean,
  ): Promise<CluAccountRegistrationResult> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<CluAccountRegistrationResult & { ok: true }>('/api/inscription', {
        method: 'POST',
        body: JSON.stringify({ pseudo, motDePasse, accepteCgu, confirmeMajeur }),
      })
      codeRecuperationNouveau.value = resultat.codeRecuperation
      contexteCodeRecuperation.value = 'INSCRIPTION'
      return resultat
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function creerCompteGoogle(
    pseudo: string,
    credential: string,
    accepteCgu: boolean,
    confirmeMajeur: boolean,
  ): Promise<CluAccountRegistrationResult> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<CluAccountRegistrationResult & { ok: true }>('/api/google/inscription', {
        method: 'POST',
        body: JSON.stringify({ pseudo, credential, accepteCgu, confirmeMajeur }),
      })
      utilisateur.value = resultat.utilisateur
      initialise.value = true
      codeRecuperationNouveau.value = resultat.codeRecuperation
      contexteCodeRecuperation.value = 'INSCRIPTION'
      return resultat
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function lierGoogle(credential: string): Promise<CluAccountUser> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<{ ok: true; googleLie: true; utilisateur: CluAccountUser }>('/api/google/lier', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      utilisateur.value = resultat.utilisateur
      initialise.value = true
      return resultat.utilisateur
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function accepterConditionsCompte(): Promise<CluAccountUser> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<{ ok: true; utilisateur: CluAccountUser }>('/api/conditions-compte', {
        method: 'POST',
        body: JSON.stringify({ accepteCgu: true, confirmeMajeur: true }),
      })
      utilisateur.value = resultat.utilisateur
      initialise.value = true
      return resultat.utilisateur
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function changerPseudo(pseudo: string): Promise<CluAccountUser> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<{ ok: true; utilisateur: CluAccountUser }>('/api/pseudo', {
        method: 'POST',
        body: JSON.stringify({ pseudo }),
      })
      utilisateur.value = resultat.utilisateur
      initialise.value = true
      return resultat.utilisateur
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function exporterDonneesPersonnelles(): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      let response: Response
      try {
        response = await fetch(`${apiBaseUrl}/api/donnees-personnelles`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
      }
      catch {
        throw new Error('Service de compte indisponible.')
      }

      if (!response.ok) {
        const payload = await lireJson<ApiErrorPayload>(response)
        throw new Error(payload?.erreur || 'Impossible d’exporter vos données.')
      }

      const blob = await response.blob()
      if (typeof document === 'undefined') return

      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `clu-donnees-${new Date().toISOString().slice(0, 10)}.json`
      lien.rel = 'noopener'
      document.body.appendChild(lien)
      lien.click()
      lien.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function recupererCompte(
    pseudo: string,
    codeRecuperation: string,
    nouveauMotDePasse: string,
  ): Promise<CluAccountRecoveryResult> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<CluAccountRecoveryResult & { ok: true; compteRecupere: true }>('/api/recuperation', {
        method: 'POST',
        body: JSON.stringify({ pseudo, codeRecuperation, nouveauMotDePasse }),
      })
      utilisateur.value = null
      initialise.value = true
      codeRecuperationNouveau.value = resultat.nouveauCodeRecuperation
      contexteCodeRecuperation.value = 'RECUPERATION'
      return resultat
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function changerMotDePasse(
    motDePasseActuel: string,
    nouveauMotDePasse: string,
  ): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      await requeteJson<{ ok: true; motDePasseModifie: true; deconnecte: true }>('/api/mot-de-passe', {
        method: 'POST',
        body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse }),
      })
      utilisateur.value = null
      initialise.value = true
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function supprimerCompte(motDePasse: string, confirmation: string): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      await requeteJson<{ ok: true; compteSupprime: true }>('/api/suppression-compte', {
        method: 'POST',
        body: JSON.stringify({ motDePasse, confirmation }),
      })
      utilisateur.value = null
      initialise.value = true
      codeRecuperationNouveau.value = null
      contexteCodeRecuperation.value = null
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function supprimerCompteGoogle(credentialGoogle: string, confirmation: string): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      await requeteJson<{ ok: true; compteSupprime: true }>('/api/suppression-compte', {
        method: 'POST',
        body: JSON.stringify({ credentialGoogle, confirmation }),
      })
      utilisateur.value = null
      initialise.value = true
      codeRecuperationNouveau.value = null
      contexteCodeRecuperation.value = null
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function ouvrirCheckoutPremium(confirmations: CluPremiumConfirmations): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      const resultat = await requeteJson<{ ok: true; sessionId: string; url: string }>('/api/premium/checkout', {
        method: 'POST',
        body: JSON.stringify(confirmations),
      })

      if (typeof window === 'undefined') throw new Error("Impossible d'ouvrir le paiement Premium.")

      let checkoutUrl: URL
      try {
        checkoutUrl = new URL(resultat.url)
      }
      catch {
        throw new Error("Impossible d'ouvrir le paiement Premium.")
      }

      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
        throw new Error("Impossible d'ouvrir le paiement Premium.")
      }

      retourPremium.value = null
      window.location.assign(checkoutUrl.toString())
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  async function deconnexion(): Promise<void> {
    chargement.value = true
    erreur.value = null
    try {
      await requeteJson<{ ok: true; deconnecte: true }>('/api/deconnexion', {
        method: 'POST',
      })
      utilisateur.value = null
      initialise.value = true
    }
    catch (cause) {
      erreur.value = messageErreur(cause)
      throw cause
    }
    finally {
      chargement.value = false
    }
  }

  function confirmerCodeRecuperation() {
    codeRecuperationNouveau.value = null
    contexteCodeRecuperation.value = null
  }

  function effacerErreur() {
    erreur.value = null
  }

  return {
    utilisateur: readonly(utilisateur),
    initialise: readonly(initialise),
    chargement: readonly(chargement),
    erreur: readonly(erreur),
    codeRecuperationNouveau: readonly(codeRecuperationNouveau),
    contexteCodeRecuperation: readonly(contexteCodeRecuperation),
    retourPremium: readonly(retourPremium),
    connecte: computed(() => utilisateur.value !== null),
    premiumActif: computed(() => premiumActifPour(utilisateur.value)),
    actualiserSession,
    connexion,
    connexionGoogle,
    creerCompte,
    creerCompteGoogle,
    lierGoogle,
    accepterConditionsCompte,
    changerPseudo,
    exporterDonneesPersonnelles,
    recupererCompte,
    changerMotDePasse,
    supprimerCompte,
    supprimerCompteGoogle,
    ouvrirCheckoutPremium,
    deconnexion,
    confirmerCodeRecuperation,
    effacerErreur,
  }
}
