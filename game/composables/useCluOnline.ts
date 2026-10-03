import { computed, readonly, ref } from 'vue'
import { useRuntimeConfig } from '#app'
import type {
  CluOnlineAdminAction,
  CluOnlineBlockedMember,
  CluOnlineBudgetState,
  CluOnlineChatMessage,
  CluOnlineClockState,
  CluOnlineCreateInput,
  CluOnlineGame,
  CluOnlineGameMutationPayload,
  CluOnlineGameSnapshotPayload,
  CluOnlineJoinInput,
  CluOnlineMember,
  CluOnlineOpenGame,
  CluOnlinePermission,
  CluOnlinePermissions,
  CluOnlineStatePayload,
} from '../types/online'
import type { GameSave } from '../types/game'
import {
  applyOnlineGamePatches,
  cloneOnlineSave,
  diffOnlineGameSave,
  registerOnlinePersistSink,
  registerOnlineLocalPersistencePolicy,
  type CluOnlineGamePatch,
} from '../utils/onlineSync'
import { clearLegacyOnlineRecovery, clearOnlineRecovery, readOnlineRecovery, writeOnlineRecovery } from '../utils/onlineSessionRecovery'

interface ApiErrorPayload {
  ok?: boolean
  erreur?: string
  codeErreur?: string
  versionCourante?: number
}

type OnlineConnectionState = 'IDLE' | 'CONNECTING' | 'WAITING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSED'

export const CLU_ONLINE_PROTOCOL_VERSION = 6
const MAX_LOCAL_CHAT_MESSAGES = 100

const partie = ref<CluOnlineGame | null>(null)
const moi = ref<CluOnlineMember | null>(null)
const membres = ref<CluOnlineMember[]>([])
const demandesEnAttente = ref<CluOnlineMember[]>([])
const bloques = ref<CluOnlineBlockedMember[]>([])
const permissionsDisponibles = ref<CluOnlinePermission[]>([])
const budget = ref<CluOnlineBudgetState | null>(null)
const chatNonLus = ref(0)
const partiesOuvertes = ref<CluOnlineOpenGame[]>([])
const messages = ref<CluOnlineChatMessage[]>([])
const jetonMembre = ref<string | null>(null)
const sauvegardeLocaleId = ref<string | null>(null)
const connexion = ref<OnlineConnectionState>('IDLE')
const chargement = ref(false)
const erreur = ref<string | null>(null)
const codeErreur = ref<string | null>(null)
const derniereActivite = ref<number | null>(null)
const creationEnLigne = ref(false)
const invitationCodeVisible = ref(false)
const invitationCodeEnAttente = ref(false)
const jeuVersion = ref(0)
const jeuPret = ref(false)
const horloge = ref<CluOnlineClockState | null>(null)
const jeuSnapshot = ref<CluOnlineGameSnapshotPayload | null>(null)
const derniereMutation = ref<CluOnlineGameMutationPayload | null>(null)
const commandeSimulation = ref<{ id: string; commande: 'jour_suivant' } | null>(null)
const panneauOuvertureId = ref(0)
const panneauOnglet = ref<'MEMBERS' | 'CHAT' | 'ADMIN'>('MEMBERS')
const panneauVisible = ref(false)
const partieFermeeSignal = ref(0)
const notificationFinPartie = ref(false)
const notificationSysteme = ref<string | null>(null)
const reconnexionExpireA = ref<number | null>(null)
const reconnexionRestanteSecondes = ref(0)
const synchronisation = ref<'IDLE' | 'SYNCED' | 'SENDING' | 'RESYNCING' | 'ERROR'>('IDLE')
const resynchronisations = ref(0)
const latenceMs = ref<number | null>(null)

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectCountdownTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let mutationAckTimer: ReturnType<typeof setTimeout> | null = null
let snapshotRetryTimer: ReturnType<typeof setTimeout> | null = null
let dernierHeartbeat = 0
let heartbeatEnvoyeA = 0
let reconnexionTentative = 0
let fermetureVolontaire = false
let onlineShadowSave: GameSave | null = null
let pendingInitialSave: GameSave | null = null
let syncMutationInFlight = false
let syncSnapshotInFlight = false
let syncMutationPendingSave: GameSave | null = null
let pendingMutation: { actionId: string; save: GameSave; expectedVersion: number; patches: CluOnlineGamePatch[]; retryCount: number } | null = null
let snapshotRetryCount = 0
let initialisationSnapshotEnCours = false
let wsTicketInFlight = false
let restaurationSessionEnCours = false

function normaliserBaseUrl(value: unknown): string {
  const texte = String(value || 'https://api.useclu.pro').trim()
  return texte.replace(/\/+$/, '') || 'https://api.useclu.pro'
}

function normaliserCode(code: unknown): string {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function purgerAncienneSessionStockee() {
  clearLegacyOnlineRecovery()
}

function construireWsUrl(apiBaseUrl: string, code: string, ticket: string): string {
  if (typeof window === 'undefined') return ''
  let url: URL
  if (apiBaseUrl.startsWith('/')) {
    url = new URL(`${apiBaseUrl}/api/en-ligne/ws`, window.location.origin)
  }
  else {
    url = new URL(`${apiBaseUrl}/api/en-ligne/ws`)
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('code', code)
  url.searchParams.set('ticket', ticket)
  url.searchParams.set('protocole', String(CLU_ONLINE_PROTOCOL_VERSION))
  return url.toString()
}

function appliquerEtat(payload: CluOnlineStatePayload) {
  partie.value = payload.partie
  moi.value = payload.moi
  membres.value = Array.isArray(payload.membres) ? payload.membres : []
  demandesEnAttente.value = Array.isArray(payload.demandesEnAttente) ? payload.demandesEnAttente : []
  bloques.value = Array.isArray(payload.bloques) ? payload.bloques : []
  permissionsDisponibles.value = Array.isArray(payload.permissionsDisponibles) ? payload.permissionsDisponibles : []
  budget.value = payload.budget ?? budget.value
  derniereActivite.value = Date.now()
  if (Number.isFinite(payload.jeuVersion)) jeuVersion.value = Math.max(0, Number(payload.jeuVersion) || 0)
  jeuPret.value = payload.jeuPret === true
  if (payload.horloge) horloge.value = payload.horloge
  if (moi.value?.statut === 'en_attente') connexion.value = 'WAITING'
  else if (moi.value?.statut === 'accepte') connexion.value = 'CONNECTED'
}

function viderEtatSession() {
  partie.value = null
  moi.value = null
  membres.value = []
  demandesEnAttente.value = []
  bloques.value = []
  permissionsDisponibles.value = []
  budget.value = null
  chatNonLus.value = 0
  messages.value = []
  jetonMembre.value = null
  sauvegardeLocaleId.value = null
  clearOnlineRecovery()
  connexion.value = 'IDLE'
  reconnexionTentative = 0
  invitationCodeVisible.value = false
  invitationCodeEnAttente.value = false
  jeuVersion.value = 0
  jeuPret.value = false
  horloge.value = null
  jeuSnapshot.value = null
  derniereMutation.value = null
  commandeSimulation.value = null
  panneauOuvertureId.value = 0
  panneauOnglet.value = 'MEMBERS'
  panneauVisible.value = false
  notificationSysteme.value = null
  reconnexionExpireA.value = null
  reconnexionRestanteSecondes.value = 0
  synchronisation.value = 'IDLE'
  resynchronisations.value = 0
  latenceMs.value = null
  arreterMutationAckTimer()
  arreterSnapshotRetryTimer()
  snapshotRetryCount = 0
  onlineShadowSave = null
  pendingInitialSave = null
  syncMutationInFlight = false
  syncSnapshotInFlight = false
  syncMutationPendingSave = null
  pendingMutation = null
  initialisationSnapshotEnCours = false
}

export function useCluOnline() {
  purgerAncienneSessionStockee()
  const runtimeConfig = useRuntimeConfig()
  const apiBaseUrl = import.meta.dev
    ? '/clu-api'
    : normaliserBaseUrl(runtimeConfig.public.cluApiBaseUrl)

  async function requeteJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

    let response: Response
    try {
      const separator = path.includes('?') ? '&' : '?'
      response = await fetch(`${apiBaseUrl}${path}${separator}protocole=${CLU_ONLINE_PROTOCOL_VERSION}`, {
        ...init,
        headers,
        credentials: 'include',
      })
    }
    catch {
      throw new Error('Service en ligne indisponible.')
    }

    let payload: (T & ApiErrorPayload) | null = null
    try { payload = await response.json() as T & ApiErrorPayload }
    catch { payload = null }

    if (!response.ok) {
      const cause = new Error(payload?.erreur || 'Le service en ligne a refusé la requête.') as Error & { codeErreur?: string; versionCourante?: number }
      cause.codeErreur = payload?.codeErreur
      if (Number.isFinite(payload?.versionCourante)) cause.versionCourante = Number(payload?.versionCourante)
      throw cause
    }
    if (!payload) throw new Error('Réponse du service en ligne invalide.')
    return payload
  }

  function nettoyerErreur() {
    erreur.value = null
    codeErreur.value = null
  }

  function ouvrirConfigurationCreation() {
    creationEnLigne.value = true
    nettoyerErreur()
  }

  function annulerConfigurationCreation() {
    creationEnLigne.value = false
  }

  function afficherInvitationCode() {
    if (partie.value?.code && moi.value?.role === 'administrateur') invitationCodeVisible.value = true
  }

  function fermerInvitationCode() {
    invitationCodeVisible.value = false
  }

  function memoriserSessionActive() {
    if (!partie.value?.code || !jetonMembre.value) return
    writeOnlineRecovery({
      code: partie.value.code,
      jetonMembre: jetonMembre.value,
      sauvegardeLocaleId: sauvegardeLocaleId.value,
    })
  }

  function lierSauvegardeLocale(saveId: string | null) {
    const id = typeof saveId === 'string' ? saveId.trim() : ''
    sauvegardeLocaleId.value = id || null
    memoriserSessionActive()
  }

  function memoriserErreur(cause: unknown) {
    const typed = cause as (Error & { codeErreur?: string }) | null
    erreur.value = typed instanceof Error ? typed.message : 'Une erreur est survenue.'
    codeErreur.value = typeof typed?.codeErreur === 'string' ? typed.codeErreur : null
  }

  function envoyerPaquet(payload: object): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      erreur.value = 'La connexion à la partie est interrompue.'
      return false
    }
    try {
      socket.send(JSON.stringify(payload))
      return true
    }
    catch {
      erreur.value = 'Impossible d’envoyer cette action.'
      return false
    }
  }


  function arreterMutationAckTimer() {
    if (mutationAckTimer) {
      clearTimeout(mutationAckTimer)
      mutationAckTimer = null
    }
  }

  function arreterSnapshotRetryTimer() {
    if (snapshotRetryTimer) {
      clearTimeout(snapshotRetryTimer)
      snapshotRetryTimer = null
    }
  }

  function programmerRetrySnapshot() {
    arreterSnapshotRetryTimer()
    if (typeof window === 'undefined') return
    snapshotRetryTimer = window.setTimeout(() => {
      snapshotRetryTimer = null
      if (synchronisation.value !== 'RESYNCING' || moi.value?.statut !== 'accepte') return
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        programmerRetrySnapshot()
        return
      }
      snapshotRetryCount += 1
      if (snapshotRetryCount > 3) {
        synchronisation.value = 'ERROR'
        erreur.value = 'La resynchronisation de la partie n’a pas abouti.'
        codeErreur.value = 'RESYNC_TIMEOUT'
        return
      }
      envoyerPaquet({ type: 'jeu_snapshot_demander' })
      programmerRetrySnapshot()
    }, 4500)
  }

  function envoyerMutationEnAttente() {
    if (!pendingMutation || !socket || socket.readyState !== WebSocket.OPEN) return false
    const sent = envoyerPaquet({
      type: 'jeu_mutation',
      actionId: pendingMutation.actionId,
      expectedVersion: pendingMutation.expectedVersion,
      patches: pendingMutation.patches,
    })
    if (!sent) return false
    arreterMutationAckTimer()
    if (typeof window !== 'undefined') {
      mutationAckTimer = window.setTimeout(() => {
        mutationAckTimer = null
        if (!pendingMutation) return
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          // Le même actionId sera rejoué à la reconnexion. Le Durable Object
          // déduplique l'action si elle avait déjà été acceptée.
          return
        }
        pendingMutation.retryCount += 1
        if (pendingMutation.retryCount <= 2) {
          envoyerMutationEnAttente()
          return
        }
        syncMutationInFlight = false
        pendingMutation = null
        syncMutationPendingSave = null
        synchronisation.value = 'RESYNCING'
        demanderSnapshotJeu()
      }, 4000)
    }
    return true
  }

  function abandonnerMutationLocalePourResync() {
    arreterMutationAckTimer()
    syncMutationInFlight = false
    pendingMutation = null
    // Ne jamais rejouer automatiquement un état local calculé sur une version
    // dépassée : le snapshot serveur écrase d'abord la copie locale.
    syncMutationPendingSave = null
  }

  function ouvrirPanneau(onglet: 'MEMBERS' | 'CHAT' | 'ADMIN') {
    panneauOnglet.value = onglet
    panneauVisible.value = true
    if (onglet === 'CHAT') chatNonLus.value = 0
    panneauOuvertureId.value += 1
  }

  function fermerPanneau() {
    panneauVisible.value = false
  }

  function peut(permission: CluOnlinePermission) {
    if (moi.value?.statut !== 'accepte') return false
    if (moi.value.role === 'administrateur') return true
    return moi.value.permissions?.[permission] === true
  }

  function envoyerHorloge(next: Pick<CluOnlineClockState, 'playing' | 'speed' | 'elapsedMs'>) {
    if (!partie.value || !peut('gerer_temps_simulation')) return false
    return envoyerPaquet({ type: 'jeu_horloge', horloge: next })
  }

  function demanderJourSuivant() {
    if (!partie.value || !peut('gerer_temps_simulation')) return false
    return envoyerPaquet({ type: 'jeu_commande_simulation', commande: 'jour_suivant', id: crypto.randomUUID() })
  }

  function demanderSnapshotJeu() {
    if (moi.value?.statut !== 'accepte') return false
    const dejaEnCours = synchronisation.value === 'RESYNCING'
    synchronisation.value = 'RESYNCING'
    if (!dejaEnCours) resynchronisations.value += 1
    snapshotRetryCount = 0
    arreterSnapshotRetryTimer()
    const sent = envoyerPaquet({ type: 'jeu_snapshot_demander' })
    if (sent) programmerRetrySnapshot()
    return sent
  }

  function afficherInvitationInitialeSiPrete() {
    if (moi.value?.role !== 'administrateur' || !jeuPret.value || !invitationCodeEnAttente.value || !partie.value?.code) return
    invitationCodeEnAttente.value = false
    invitationCodeVisible.value = true
  }

  function installerSnapshotLocal(payload: CluOnlineGameSnapshotPayload) {
    jeuVersion.value = Math.max(0, Number(payload.version) || 0)
    jeuPret.value = true
    onlineShadowSave = cloneOnlineSave(payload.save, partie.value?.id || partie.value?.code)
    pendingInitialSave = null
    pendingMutation = null
    syncMutationInFlight = false
    syncMutationPendingSave = null
    arreterMutationAckTimer()
    arreterSnapshotRetryTimer()
    snapshotRetryCount = 0
    synchronisation.value = 'SYNCED'
    erreur.value = null
    codeErreur.value = null
    jeuSnapshot.value = payload
    afficherInvitationInitialeSiPrete()
  }

  function traiterMutationLocaleEnAttente() {
    if (!syncMutationPendingSave || syncMutationInFlight || syncSnapshotInFlight) return
    const next = syncMutationPendingSave
    syncMutationPendingSave = null
    void synchroniserSauvegardeLocale(next)
  }

  async function publierSnapshotAutoritaire(save: GameSave, raison: 'simulation' | 'snapshot' = 'snapshot') {
    if (!partie.value || !jetonMembre.value || moi.value?.role !== 'administrateur' || !jeuPret.value || syncSnapshotInFlight) return false
    syncSnapshotInFlight = true
    synchronisation.value = 'SENDING'
    try {
      const prepared = cloneOnlineSave(save, partie.value.id || partie.value.code)
      const payload = await requeteJson<{ ok: true; version: number }>('/api/en-ligne/snapshot-jeu', {
        method: 'POST',
        body: JSON.stringify({
          code: partie.value.code,
          jetonMembre: jetonMembre.value,
          expectedVersion: jeuVersion.value,
          save: prepared,
          raison,
        }),
      })
      const version = Math.max(1, Number(payload.version) || 1)
      onlineShadowSave = cloneOnlineSave(prepared, partie.value.id || partie.value.code)
      jeuVersion.value = version
      pendingMutation = null
      syncMutationInFlight = false
      erreur.value = null
      codeErreur.value = null
      synchronisation.value = 'SYNCED'
      return true
    }
    catch (cause) {
      const typed = cause as Error & { codeErreur?: string }
      memoriserErreur(cause)
      // En cas de concurrence, le serveur garde son état comme autorité. On
      // abandonne l'état local non publié et on demande un snapshot propre :
      // cela évite qu'un passage de jour écrase une action acceptée entre-temps.
      if (typed?.codeErreur === 'VERSION_DIVERGENTE') demanderSnapshotJeu()
      else synchronisation.value = 'ERROR'
      return false
    }
    finally {
      syncSnapshotInFlight = false
      traiterMutationLocaleEnAttente()
    }
  }

  async function synchroniserSauvegardeLocale(save: GameSave) {
    if (!partie.value || !jetonMembre.value || moi.value?.statut !== 'accepte' || !jeuPret.value || !onlineShadowSave) return
    if (sauvegardeLocaleId.value && save.id !== sauvegardeLocaleId.value) return

    const prepared = cloneOnlineSave(save, partie.value.id || partie.value.code)
    if (syncMutationInFlight || syncSnapshotInFlight) {
      syncMutationPendingSave = prepared
      return
    }

    const patches = diffOnlineGameSave(onlineShadowSave, prepared)
    if (!patches.length) return
    const serializedSize = JSON.stringify(patches).length
    const simulationDayChanged = patches.some(patch => patch.path === '/data/simulationDay')
    const mutationTooLarge = patches.length > 420 || serializedSize > 450_000

    // Un jour simulé peut toucher voyageurs, statistiques, événements, dette,
    // objectifs et exploitation en une seule opération. L'admin publie alors
    // un snapshot atomique au lieu de fragmenter cet état en centaines de
    // patches fragiles. Les mutations ordinaires restent incrémentales.
    if (moi.value.role === 'administrateur' && (simulationDayChanged || mutationTooLarge)) {
      await publierSnapshotAutoritaire(prepared, simulationDayChanged ? 'simulation' : 'snapshot')
      return
    }

    if (patches.length > 600 || serializedSize > 600_000) {
      erreur.value = 'Une modification locale est trop volumineuse pour être synchronisée. Une resynchronisation est demandée.'
      demanderSnapshotJeu()
      return
    }

    const actionId = crypto.randomUUID()
    const expectedVersion = jeuVersion.value
    syncMutationInFlight = true
    synchronisation.value = 'SENDING'
    pendingMutation = { actionId, save: prepared, expectedVersion, patches: patches as CluOnlineGamePatch[], retryCount: 0 }
    const sent = envoyerMutationEnAttente()
    if (!sent) {
      // Conserver l'action exacte pour la rejouer avec le même actionId après
      // reconnexion. Si le serveur l'avait déjà reçue, il renverra simplement
      // la confirmation mémorisée.
      synchronisation.value = 'SENDING'
    }
  }

  async function initialiserSynchronisationJeu(save: GameSave): Promise<boolean> {
    if (!partie.value || !jetonMembre.value || moi.value?.statut !== 'accepte' || moi.value.role !== 'administrateur') return false
    if (jeuPret.value) {
      if (!onlineShadowSave) demanderSnapshotJeu()
      return true
    }
    if (initialisationSnapshotEnCours) return false
    initialisationSnapshotEnCours = true

    try {
      // game.state.value.save est réactif sous Nuxt/Vue. La préparation doit
      // donc rester dans le try/catch : si une sauvegarde n'est pas sérialisable,
      // l'erreur est visible au lieu de tuer silencieusement la Promise avant fetch().
      const prepared = cloneOnlineSave(save, partie.value.id || partie.value.code)
      pendingInitialSave = prepared
      const payload = await requeteJson<{ ok: true; version: number }>('/api/en-ligne/initialiser-jeu', {
        method: 'POST',
        body: JSON.stringify({
          code: partie.value.code,
          jetonMembre: jetonMembre.value,
          save: prepared,
        }),
      })
      const version = Math.max(1, Number(payload.version) || 1)
      onlineShadowSave = cloneOnlineSave(prepared, partie.value.id || partie.value.code)
      jeuVersion.value = version
      jeuPret.value = true
      synchronisation.value = 'SYNCED'
      pendingInitialSave = null
      erreur.value = null
      codeErreur.value = null
      afficherInvitationInitialeSiPrete()
      if (socket?.readyState === WebSocket.OPEN) envoyerPaquet({ type: 'etat_demander' })
      return true
    }
    catch (cause) {
      memoriserErreur(cause)
      return false
    }
    finally {
      initialisationSnapshotEnCours = false
    }
  }

  function signalerEntreeDansPartie(save: GameSave) {
    if (!partie.value || moi.value?.statut !== 'accepte') return
    if (moi.value.role === 'administrateur') {
      // Le créateur reçoit le code une fois la métropole réellement affichée.
      // L'affichage ne dépend plus d'un aller-retour réseau supplémentaire : le
      // code existe dès la création de la session et reste récupérable ensuite
      // dans Administration.
      invitationCodeEnAttente.value = false
      invitationCodeVisible.value = true
      void initialiserSynchronisationJeu(save)
    }
    else if (jeuPret.value && !onlineShadowSave) demanderSnapshotJeu()
  }

  function arreterHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    dernierHeartbeat = 0
    heartbeatEnvoyeA = 0
    latenceMs.value = null
  }

  function arreterCompteAReboursReconnexion() {
    if (reconnectCountdownTimer) {
      clearInterval(reconnectCountdownTimer)
      reconnectCountdownTimer = null
    }
    reconnexionRestanteSecondes.value = 0
  }

  function actualiserCompteAReboursReconnexion() {
    const expire = reconnexionExpireA.value
    if (!expire) {
      reconnexionRestanteSecondes.value = 0
      return
    }
    reconnexionRestanteSecondes.value = Math.max(0, Math.ceil((expire - Date.now()) / 1000))
  }

  function demarrerCompteAReboursReconnexion() {
    actualiserCompteAReboursReconnexion()
    if (reconnectCountdownTimer || typeof window === 'undefined') return
    reconnectCountdownTimer = window.setInterval(() => {
      actualiserCompteAReboursReconnexion()
      if (reconnexionRestanteSecondes.value <= 0) arreterCompteAReboursReconnexion()
    }, 1000)
  }

  function demarrerHeartbeat() {
    arreterHeartbeat()
    if (typeof window === 'undefined') return
    dernierHeartbeat = Date.now()
    heartbeatTimer = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const maintenant = Date.now()
      if (dernierHeartbeat > 0 && maintenant - dernierHeartbeat > 35_000) {
        try { socket.close(4100, 'Heartbeat expiré') } catch {}
        return
      }
      heartbeatEnvoyeA = maintenant
      try { socket.send('ping') } catch {}
    }, 15_000)
  }

  function planifierReconnexion() {
    if (fermetureVolontaire || !partie.value?.code || !jetonMembre.value || typeof window === 'undefined') return
    if (reconnectTimer) return

    if (!reconnexionExpireA.value) reconnexionExpireA.value = Date.now() + 60_000
    demarrerCompteAReboursReconnexion()
    if (Date.now() >= reconnexionExpireA.value) {
      connexion.value = 'CLOSED'
      reconnexionRestanteSecondes.value = 0
      erreur.value = 'La reconnexion a échoué. La période de reconnexion de 60 secondes est terminée.'
      codeErreur.value = 'RECONNEXION_EXPIREE'
      clearOnlineRecovery()
      return
    }

    reconnexionTentative += 1
    connexion.value = 'RECONNECTING'
    const delai = Math.min(5_000, 700 + reconnexionTentative * 650)
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      if (reconnexionExpireA.value && Date.now() < reconnexionExpireA.value) connecterWebSocket()
      else planifierReconnexion()
    }, delai)
  }

  function gererMessageSocket(event: MessageEvent) {
    if (typeof event.data !== 'string') return
    if (event.data === 'pong') {
      const maintenant = Date.now()
      dernierHeartbeat = maintenant
      derniereActivite.value = maintenant
      if (heartbeatEnvoyeA > 0) latenceMs.value = Math.max(0, maintenant - heartbeatEnvoyeA)
      heartbeatEnvoyeA = 0
      memoriserSessionActive()
      return
    }
    let paquet: Record<string, any>
    try { paquet = JSON.parse(event.data) as Record<string, any> }
    catch { return }

    derniereActivite.value = Date.now()

    if (paquet.type === 'etat' && paquet.partie) {
      appliquerEtat(paquet as unknown as CluOnlineStatePayload)
      if (!jeuPret.value && pendingInitialSave && moi.value?.role === 'administrateur') {
        void initialiserSynchronisationJeu(pendingInitialSave)
      }
      return
    }

    if (paquet.type === 'chat' && paquet.message) {
      const message = paquet.message as CluOnlineChatMessage
      if (!messages.value.some(item => item.id === message.id)) {
        messages.value = [...messages.value, message].slice(-MAX_LOCAL_CHAT_MESSAGES)
        if (!(panneauVisible.value && panneauOnglet.value === 'CHAT')) chatNonLus.value = Math.min(99, chatNonLus.value + 1)
      }
      return
    }

    if (paquet.type === 'jeu_horloge' && paquet.horloge) {
      horloge.value = paquet.horloge as CluOnlineClockState
      return
    }

    if (paquet.type === 'jeu_commande_simulation' && paquet.commande === 'jour_suivant' && moi.value?.role === 'administrateur') {
      commandeSimulation.value = {
        id: typeof paquet.id === 'string' ? paquet.id : crypto.randomUUID(),
        commande: 'jour_suivant',
      }
      return
    }

    if (paquet.type === 'jeu_snapshot_initialise') {
      const version = Math.max(0, Number(paquet.version) || 0)
      if (pendingInitialSave && version > 0) {
        onlineShadowSave = cloneOnlineSave(pendingInitialSave, partie.value?.id || partie.value?.code)
        jeuVersion.value = version
        jeuPret.value = true
        pendingInitialSave = null
        synchronisation.value = 'SYNCED'
        afficherInvitationInitialeSiPrete()
      }
      else demanderSnapshotJeu()
      return
    }

    if (paquet.type === 'jeu_snapshot' && paquet.save && Number(paquet.version) > 0) {
      installerSnapshotLocal({
        version: Number(paquet.version),
        save: paquet.save as GameSave,
        raison: paquet.raison as CluOnlineGameSnapshotPayload['raison'],
      })
      return
    }

    if (paquet.type === 'jeu_mutation' && Array.isArray(paquet.patches)) {
      const mutation = paquet as unknown as CluOnlineGameMutationPayload
      if (pendingMutation && mutation.auteurId !== moi.value?.id && mutation.version >= pendingMutation.expectedVersion + 1) {
        // Un autre joueur a remporté la course sur la même version. Le serveur
        // reste autoritaire : abandon de notre état spéculatif puis snapshot.
        abandonnerMutationLocalePourResync()
        demanderSnapshotJeu()
        return
      }
      if (!onlineShadowSave || mutation.version !== jeuVersion.value + 1) {
        abandonnerMutationLocalePourResync()
        demanderSnapshotJeu()
        return
      }
      try {
        applyOnlineGamePatches(onlineShadowSave, mutation.patches as CluOnlineGamePatch[])
        jeuVersion.value = mutation.version
        derniereMutation.value = mutation
        synchronisation.value = 'SYNCED'
      }
      catch {
        demanderSnapshotJeu()
      }
      return
    }

    if (paquet.type === 'jeu_mutation_confirmee') {
      const actionId = typeof paquet.actionId === 'string' ? paquet.actionId : ''
      const version = Math.max(0, Number(paquet.version) || 0)
      const versionCourante = Math.max(version, Number(paquet.versionCourante) || version)
      arreterMutationAckTimer()
      if (!pendingMutation || pendingMutation.actionId !== actionId || version !== pendingMutation.expectedVersion + 1 || versionCourante !== version) {
        abandonnerMutationLocalePourResync()
        demanderSnapshotJeu()
        return
      }
      onlineShadowSave = cloneOnlineSave(pendingMutation.save, partie.value?.id || partie.value?.code)
      jeuVersion.value = version
      syncMutationInFlight = false
      pendingMutation = null
      synchronisation.value = 'SYNCED'
      traiterMutationLocaleEnAttente()
      return
    }

    if (paquet.type === 'jeu_resync_requise') {
      abandonnerMutationLocalePourResync()
      demanderSnapshotJeu()
      return
    }

    if (paquet.type === 'acces_accepte') {
      connexion.value = 'CONNECTED'
      envoyerPaquet({ type: 'etat_demander' })
      return
    }

    if (paquet.type === 'acces_refuse') {
      erreur.value = 'L’administrateur a refusé votre demande.'
      codeErreur.value = 'ACCES_REFUSE'
      clearOnlineRecovery()
      connexion.value = 'CLOSED'
      return
    }

    if (paquet.type === 'expulse') {
      const message = paquet.bloque
        ? 'Vous avez été expulsé et bloqué pour cette partie.'
        : 'Vous avez été expulsé de cette partie.'
      const code = paquet.bloque ? 'BLOQUE' : 'EXPULSE'
      // Une expulsion termine réellement la copie de jeu du participant : elle
      // ne doit jamais retomber en solo ni devenir une sauvegarde locale.
      partieFermeeSignal.value += 1
      fermetureVolontaire = true
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      arreterHeartbeat()
      if (socket) { try { socket.close(1000, 'Accès retiré') } catch {}; socket = null }
      viderEtatSession()
      erreur.value = message
      codeErreur.value = code
      return
    }

    if (paquet.type === 'partie_fermee') {
      const etaitAdmin = moi.value?.role === 'administrateur'
      const message = etaitAdmin
        ? 'La partie en ligne est fermée.'
        : 'L’administrateur a quitté la partie. La session en ligne est terminée.'
      if (!etaitAdmin) notificationFinPartie.value = true
      partieFermeeSignal.value += 1
      fermetureVolontaire = true
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      arreterHeartbeat()
      reconnexionExpireA.value = null
      arreterCompteAReboursReconnexion()
      if (socket) { try { socket.close(1000, 'Partie fermée') } catch {}; socket = null }
      viderEtatSession()
      erreur.value = message
      codeErreur.value = 'PARTIE_FERMEE'
      return
    }

    if (paquet.type === 'partie_hors_ligne') {
      const etaitAdmin = moi.value?.role === 'administrateur'
      const message = paquet.raison === 'premium_expire'
        ? 'La partie est passée hors ligne car le Premium de l’administrateur a expiré.'
        : 'La partie en ligne est terminée.'
      // L'administrateur garde sa sauvegarde locale et peut continuer en solo.
      // Les participants, eux, doivent quitter complètement la copie partagée.
      if (!etaitAdmin) partieFermeeSignal.value += 1
      fermetureVolontaire = true
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      arreterHeartbeat()
      if (socket) { try { socket.close(1000, 'Partie hors ligne') } catch {}; socket = null }
      viderEtatSession()
      erreur.value = message
      codeErreur.value = 'PARTIE_HORS_LIGNE'
      return
    }

    if (paquet.type === 'hote_reconnexion') {
      notificationSysteme.value = 'Connexion de l’administrateur interrompue. La partie reste ouverte pendant sa période de reconnexion.'
      return
    }

    if (paquet.type === 'hote_reconnecte') {
      notificationSysteme.value = 'L’administrateur est reconnecté. La partie continue normalement.'
      return
    }

    if (paquet.type === 'permissions_mises_a_jour') {
      notificationSysteme.value = 'Vos permissions dans cette partie ont été mises à jour par l’administrateur.'
      return
    }

    if (paquet.type === 'moderation') {
      notificationSysteme.value = paquet.muet === true
        ? 'L’administrateur vous a rendu muet dans le chat.'
        : 'L’administrateur vous a rendu la parole dans le chat.'
      return
    }

    if (paquet.type === 'erreur') {
      erreur.value = typeof paquet.erreur === 'string' ? paquet.erreur : 'Action refusée.'
      codeErreur.value = typeof paquet.codeErreur === 'string' ? paquet.codeErreur : null
      if (codeErreur.value === 'MUTATIONS_TROP_RAPIDES') {
        abandonnerMutationLocalePourResync()
        demanderSnapshotJeu()
      }
      return
    }
  }

  async function connecterWebSocket() {
    if (typeof window === 'undefined' || !partie.value?.code || !jetonMembre.value) return
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return
    if (wsTicketInFlight) return

    nettoyerErreur()
    connexion.value = reconnexionTentative > 0 ? 'RECONNECTING' : 'CONNECTING'
    fermetureVolontaire = false
    wsTicketInFlight = true

    let ticket = ''
    try {
      const payload = await requeteJson<{ ok: true; ticket: string; expireA: number }>('/api/en-ligne/ws-ticket', {
        method: 'POST',
        body: JSON.stringify({ code: partie.value.code, jetonMembre: jetonMembre.value }),
      })
      ticket = String(payload.ticket || '')
      if (ticket.length < 20) throw new Error('Ticket de connexion temps réel invalide.')
    }
    catch (cause) {
      wsTicketInFlight = false
      memoriserErreur(cause)
      planifierReconnexion()
      return
    }
    wsTicketInFlight = false

    // En développement, le proxy HTTP Nuxt/Nitro utilisé par /clu-api ne
    // relaie pas de façon fiable les upgrades WebSocket. Le temps réel se
    // connecte donc directement au Worker Cloudflare ; les requêtes HTTP
    // continuent d'utiliser le proxy de développement existant. Le jeton
    // membre n'apparaît jamais dans l'URL : seul un ticket à usage unique y passe.
    const wsBaseUrl = import.meta.dev ? 'https://api.useclu.pro' : apiBaseUrl
    const wsUrl = construireWsUrl(wsBaseUrl, partie.value.code, ticket)
    try { socket = new WebSocket(wsUrl) }
    catch {
      socket = null
      planifierReconnexion()
      return
    }

    socket.addEventListener('open', () => {
      reconnexionTentative = 0
      reconnexionExpireA.value = null
      arreterCompteAReboursReconnexion()
      connexion.value = moi.value?.statut === 'en_attente' ? 'WAITING' : 'CONNECTED'
      nettoyerErreur()
      memoriserSessionActive()
      demarrerHeartbeat()
      envoyerPaquet({ type: 'etat_demander' })
      if (pendingMutation) envoyerMutationEnAttente()
      if (synchronisation.value === 'RESYNCING') {
        envoyerPaquet({ type: 'jeu_snapshot_demander' })
        programmerRetrySnapshot()
      }
      if (pendingInitialSave && moi.value?.role === 'administrateur' && !jeuPret.value) {
        void initialiserSynchronisationJeu(pendingInitialSave)
      }
    })
    socket.addEventListener('message', gererMessageSocket)
    socket.addEventListener('error', () => {
      if (!fermetureVolontaire) erreur.value = 'La connexion temps réel rencontre un problème.'
    })
    socket.addEventListener('close', event => {
      socket = null
      arreterHeartbeat()
      if (fermetureVolontaire) return
      if (event.code === 4003) {
        clearOnlineRecovery()
        connexion.value = 'CLOSED'
        if (!erreur.value) erreur.value = 'La connexion à cette partie a été refusée ou votre accès a été retiré.'
        return
      }
      planifierReconnexion()
    })
  }

  async function restaurerSessionApresActualisation() {
    if (restaurationSessionEnCours || partie.value || typeof window === 'undefined') return false
    const recovery = readOnlineRecovery()
    if (!recovery) return false
    restaurationSessionEnCours = true
    chargement.value = true
    nettoyerErreur()
    try {
      const payload = await requeteJson<{
        ok: true
        statut: 'en_attente' | 'accepte'
        partie: CluOnlineGame
        membre: CluOnlineMember
        jetonMembre: string
      }>('/api/en-ligne/rejoindre', {
        method: 'POST',
        body: JSON.stringify({ code: recovery.code, jetonMembre: recovery.jetonMembre }),
      })
      partie.value = payload.partie
      moi.value = payload.membre
      membres.value = payload.membre.statut === 'accepte' ? [payload.membre] : []
      demandesEnAttente.value = []
      bloques.value = []
      messages.value = []
      budget.value = null
      chatNonLus.value = 0
      jetonMembre.value = payload.jetonMembre
      sauvegardeLocaleId.value = recovery.sauvegardeLocaleId
      connexion.value = payload.statut === 'en_attente' ? 'WAITING' : 'CONNECTING'
      invitationCodeVisible.value = false
      invitationCodeEnAttente.value = false
      jeuVersion.value = 0
      jeuPret.value = false
      jeuSnapshot.value = null
      derniereMutation.value = null
      commandeSimulation.value = null
      horloge.value = null
      onlineShadowSave = null
      pendingInitialSave = null
      pendingMutation = null
      syncMutationInFlight = false
      syncSnapshotInFlight = false
      syncMutationPendingSave = null
      initialisationSnapshotEnCours = false
      synchronisation.value = 'RESYNCING'
      memoriserSessionActive()
      void connecterWebSocket()
      return true
    }
    catch {
      clearOnlineRecovery()
      viderEtatSession()
      nettoyerErreur()
      return false
    }
    finally {
      restaurationSessionEnCours = false
      chargement.value = false
    }
  }

  async function creerPartie(input: CluOnlineCreateInput, options: { connecter?: boolean } = {}) {
    chargement.value = true
    nettoyerErreur()
    try {
      const payload = await requeteJson<{
        ok: true
        partie: CluOnlineGame
        membre: CluOnlineMember
        jetonMembre: string
      }>('/api/en-ligne/creer', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      partie.value = payload.partie
      moi.value = payload.membre
      membres.value = [payload.membre]
      demandesEnAttente.value = []
      bloques.value = []
      messages.value = []
      budget.value = null
      chatNonLus.value = 0
      jetonMembre.value = payload.jetonMembre
      memoriserSessionActive()
      invitationCodeVisible.value = false
      invitationCodeEnAttente.value = true
      jeuVersion.value = 0
      jeuPret.value = false
      horloge.value = null
      jeuSnapshot.value = null
      derniereMutation.value = null
      commandeSimulation.value = null
      onlineShadowSave = null
      pendingInitialSave = null
      pendingMutation = null
      syncMutationInFlight = false
      syncSnapshotInFlight = false
      syncMutationPendingSave = null
      initialisationSnapshotEnCours = false
      synchronisation.value = 'IDLE'
      resynchronisations.value = 0
      if (options.connecter !== false) connecterWebSocket()
      else connexion.value = 'CLOSED'
      return payload.partie
    }
    catch (cause) {
      memoriserErreur(cause)
      throw cause
    }
    finally { chargement.value = false }
  }

  async function rejoindrePartie(input: CluOnlineJoinInput, options: { connecter?: boolean } = {}) {
    chargement.value = true
    nettoyerErreur()
    try {
      const code = normaliserCode(input.code)
      if (partie.value?.code !== code) sauvegardeLocaleId.value = null
      const payload = await requeteJson<{
        ok: true
        statut: 'en_attente' | 'accepte'
        partie: CluOnlineGame
        membre: CluOnlineMember
        jetonMembre: string
      }>('/api/en-ligne/rejoindre', {
        method: 'POST',
        body: JSON.stringify({
          code,
          pseudoInvite: input.pseudoInvite?.trim() || undefined,
        }),
      })
      partie.value = payload.partie
      moi.value = payload.membre
      membres.value = payload.membre.statut === 'accepte' ? [payload.membre] : []
      demandesEnAttente.value = []
      bloques.value = []
      messages.value = []
      budget.value = null
      chatNonLus.value = 0
      jetonMembre.value = payload.jetonMembre
      memoriserSessionActive()
      const doitConnecter = options.connecter !== false || payload.statut === 'en_attente'
      connexion.value = payload.statut === 'en_attente' ? 'WAITING' : doitConnecter ? 'CONNECTING' : 'CLOSED'
      invitationCodeVisible.value = false
      invitationCodeEnAttente.value = false
      jeuVersion.value = 0
      jeuPret.value = false
      jeuSnapshot.value = null
      derniereMutation.value = null
      commandeSimulation.value = null
      horloge.value = null
      onlineShadowSave = null
      pendingInitialSave = null
      pendingMutation = null
      syncMutationInFlight = false
      syncSnapshotInFlight = false
      syncMutationPendingSave = null
      initialisationSnapshotEnCours = false
      synchronisation.value = 'IDLE'
      resynchronisations.value = 0
      if (doitConnecter) connecterWebSocket()
      return payload
    }
    catch (cause) {
      memoriserErreur(cause)
      throw cause
    }
    finally { chargement.value = false }
  }

  async function chargerPartiesOuvertes(recherche = '') {
    nettoyeurReconnexionInactive()
    try {
      const terme = String(recherche || '').trim().slice(0, 60)
      const chemin = terme
        ? `/api/en-ligne/parties-ouvertes?recherche=${encodeURIComponent(terme)}`
        : '/api/en-ligne/parties-ouvertes'
      const payload = await requeteJson<{ ok: true; parties: CluOnlineOpenGame[] }>(chemin, {
        method: 'GET',
      })
      const uniques = new Map<string, CluOnlineOpenGame>()
      for (const openGame of payload.parties || []) {
        const code = normaliserCode(openGame?.code)
        if (!code || uniques.has(code)) continue
        uniques.set(code, { ...openGame, code })
      }
      partiesOuvertes.value = [...uniques.values()]
      return partiesOuvertes.value
    }
    catch (cause) {
      memoriserErreur(cause)
      throw cause
    }
  }

  function nettoyeurReconnexionInactive() {
    if (reconnectTimer && (!partie.value || connexion.value === 'IDLE')) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function envoyerChat(texte: string) {
    const message = texte.trim().slice(0, 500)
    if (!message) return false
    return envoyerPaquet({ type: 'chat', message })
  }

  function actionAdmin(action: CluOnlineAdminAction, payload: Record<string, unknown> = {}) {
    nettoyerErreur()
    return envoyerPaquet({ type: 'admin', action, ...payload })
  }

  function definirPermissions(membreId: string, permissions: CluOnlinePermissions) {
    return actionAdmin('definir_permissions', { membreId, permissions })
  }

  function demanderEtat() {
    return envoyerPaquet({ type: 'etat_demander' })
  }

  function fermerSocketSansQuitter(options: { retourMenu?: boolean } = {}) {
    fermetureVolontaire = true
    arreterMutationAckTimer()
    arreterSnapshotRetryTimer()
    arreterHeartbeat()
    reconnexionExpireA.value = null
    arreterCompteAReboursReconnexion()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (socket) {
      try {
        socket.close(options.retourMenu ? 4000 : 1000, options.retourMenu ? 'Retour au menu' : 'Interface fermée')
      }
      catch { /* Rien à faire. */ }
      socket = null
    }
    connexion.value = partie.value ? 'CLOSED' : 'IDLE'
  }

  async function quitterPartie() {
    const code = partie.value?.code
    const jeton = jetonMembre.value
    if (!code || !jeton) {
      oublierSessionLocale()
      return true
    }

    nettoyerErreur()
    try {
      await requeteJson<{ ok: true; partieFermee?: boolean }>('/api/en-ligne/quitter', {
        method: 'POST',
        body: JSON.stringify({ code, jetonMembre: jeton }),
      })
    }
    catch (cause) {
      // L'interface locale doit pouvoir sortir même si le réseau vient de tomber.
      // Le serveur masque de toute façon les sessions sans hôte connecté et
      // fermera l'ancienne session à l'expiration de la grâce administrateur.
      memoriserErreur(cause)
    }
    finally {
      fermerSocketSansQuitter({ retourMenu: true })
      viderEtatSession()
      nettoyerErreur()
    }
    return true
  }

  function oublierSessionLocale() {
    fermerSocketSansQuitter({ retourMenu: true })
    viderEtatSession()
  }

  function fermerNotificationFinPartie() {
    notificationFinPartie.value = false
  }

  function fermerNotificationSysteme() {
    notificationSysteme.value = null
  }

  registerOnlinePersistSink(synchroniserSauvegardeLocale)
  registerOnlineLocalPersistencePolicy(save => {
    if (!partie.value || moi.value?.statut !== 'accepte') return true
    if (sauvegardeLocaleId.value && save.id !== sauvegardeLocaleId.value) return true
    // Seul le créateur conserve la sauvegarde de la métropole Online. Les
    // participants travaillent sur l'état en mémoire + serveur, sans créer une
    // copie dans « Sauvegardes ».
    return moi.value.role === 'administrateur'
  })

  return {
    partie: readonly(partie),
    moi: readonly(moi),
    membres: readonly(membres),
    demandesEnAttente: readonly(demandesEnAttente),
    bloques: readonly(bloques),
    permissionsDisponibles: readonly(permissionsDisponibles),
    budget: readonly(budget),
    chatNonLus: readonly(chatNonLus),
    partiesOuvertes: readonly(partiesOuvertes),
    messages: readonly(messages),
    connexion: readonly(connexion),
    chargement: readonly(chargement),
    erreur: readonly(erreur),
    codeErreur: readonly(codeErreur),
    derniereActivite: readonly(derniereActivite),
    creationEnLigne: readonly(creationEnLigne),
    invitationCodeVisible: readonly(invitationCodeVisible),
    jeuVersion: readonly(jeuVersion),
    jeuPret: readonly(jeuPret),
    horloge: readonly(horloge),
    jeuSnapshot: readonly(jeuSnapshot),
    derniereMutation: readonly(derniereMutation),
    commandeSimulation: readonly(commandeSimulation),
    panneauOuvertureId: readonly(panneauOuvertureId),
    panneauOnglet: readonly(panneauOnglet),
    panneauVisible: readonly(panneauVisible),
    partieFermeeSignal: readonly(partieFermeeSignal),
    notificationFinPartie: readonly(notificationFinPartie),
    notificationSysteme: readonly(notificationSysteme),
    reconnexionRestanteSecondes: readonly(reconnexionRestanteSecondes),
    synchronisation: readonly(synchronisation),
    resynchronisations: readonly(resynchronisations),
    latenceMs: readonly(latenceMs),
    protocoleOnline: CLU_ONLINE_PROTOCOL_VERSION,
    sauvegardeLocaleId: readonly(sauvegardeLocaleId),
    sessionActive: computed(() => Boolean(partie.value && jetonMembre.value)),
    sessionConnectee: computed(() => Boolean(partie.value && jetonMembre.value && moi.value?.statut === 'accepte' && ['CONNECTED', 'RECONNECTING', 'CONNECTING'].includes(connexion.value))),
    estAdmin: computed(() => moi.value?.role === 'administrateur'),
    enAttente: computed(() => moi.value?.statut === 'en_attente'),
    peutChat: computed(() => moi.value?.statut === 'accepte' && partie.value?.chatActif !== false && !moi.value?.muet && moi.value?.permissions?.chat !== false),
    joueursConnectes: computed(() => partie.value?.joueursConnectes ?? membres.value.filter(item => item.connecte).length),
    peut,
    envoyerHorloge,
    demanderJourSuivant,
    ouvrirConfigurationCreation,
    annulerConfigurationCreation,
    afficherInvitationCode,
    fermerInvitationCode,
    ouvrirPanneau,
    fermerPanneau,
    signalerEntreeDansPartie,
    initialiserSynchronisationJeu,
    demanderSnapshotJeu,
    lierSauvegardeLocale,
    creerPartie,
    rejoindrePartie,
    chargerPartiesOuvertes,
    connecterWebSocket,
    restaurerSessionApresActualisation,
    envoyerChat,
    actionAdmin,
    definirPermissions,
    demanderEtat,
    fermerSocketSansQuitter,
    quitterPartie,
    oublierSessionLocale,
    fermerNotificationFinPartie,
    fermerNotificationSysteme,
    nettoyerErreur,
  }
}
