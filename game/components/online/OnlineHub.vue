<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCluAccount } from '../../composables/useCluAccount'
import { useCluOnline } from '../../composables/useCluOnline'
import { useGameI18n } from '../../composables/useGameI18n'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { isCluOnlineBetaActive } from '../../config/commercial'
import type { CluOnlineVisibility } from '../../types/online'

const emit = defineEmits<{ openAccount: [] }>()
const account = useCluAccount()
const online = useCluOnline()
const i18n = useGameI18n()
const game = useMetropoleGame()
const onlineBetaActive = isCluOnlineBetaActive()

const view = ref<'CHOICE' | 'CREATE' | 'JOIN'>('CHOICE')
const joinCode = ref('')
const guestPseudo = ref('')
const copyFeedback = ref(false)
const openGamesLoading = ref(false)
const openGamesError = ref<string | null>(null)
const directorySearch = ref('')

function normaliserRecherche(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase()
}

const filteredOpenGames = computed(() => {
  const query = normaliserRecherche(directorySearch.value)
  if (!query) return online.partiesOuvertes.value
  return online.partiesOuvertes.value.filter(openGame => {
    const haystack = normaliserRecherche(`${openGame.nom} ${openGame.administrateurPseudo} ${openGame.carte.nom || ''}`)
    return haystack.includes(query)
  })
})
let openGamesRefreshTimer: ReturnType<typeof setInterval> | null = null
let directorySearchTimer: ReturnType<typeof setTimeout> | null = null
const onlineErrorMessage = computed(() => {
  if (online.codeErreur.value === 'PARTIE_EN_INITIALISATION') {
    return i18n.t('Cette partie est encore en cours de démarrage. Réessayez dans quelques instants.')
  }
  return online.erreur.value
})

function visibilityLabel(value: CluOnlineVisibility) {
  if (value === 'privee') return i18n.t('Privée')
  if (value === 'ouverte') return i18n.t('Ouverte à tous')
  return i18n.t('Publique par code')
}

async function enterCreate() {
  online.nettoyerErreur()
  await account.actualiserSession()
  if (account.premiumActif.value) {
    online.ouvrirConfigurationCreation()
    game.openNewGameSetup()
    return
  }
  view.value = 'CREATE'
}

async function enterJoin() {
  view.value = 'JOIN'
  openGamesError.value = null
  online.nettoyerErreur()
  await account.actualiserSession()
  await refreshOpenGames()
}

async function refreshOpenGames() {
  if (openGamesLoading.value) return
  openGamesLoading.value = true
  openGamesError.value = null
  try { await online.chargerPartiesOuvertes(directorySearch.value) }
  catch {
    openGamesError.value = i18n.t('L’annuaire des parties ouvertes est indisponible. Vous pouvez toujours rejoindre une partie avec son code.')
    // Une panne de l'annuaire public ne doit jamais bloquer le formulaire par code.
    online.nettoyerErreur()
  }
  finally { openGamesLoading.value = false }
}

async function joinGame(code = joinCode.value, source: 'code' | 'directory' = 'code') {
  if (source === 'code') joinCode.value = code
  try {
    await online.rejoindrePartie({
      code,
      pseudoInvite: account.connecte.value ? undefined : guestPseudo.value,
    })
  }
  catch { /* L'erreur est affichée. */ }
}

async function copyCode() {
  const code = online.partie.value?.code
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    copyFeedback.value = true
    window.setTimeout(() => { copyFeedback.value = false }, 1600)
  }
  catch { /* Le code reste sélectionnable. */ }
}

async function cancelPendingRequest() {
  try { await online.quitterPartie() }
  finally {
    view.value = 'CHOICE'
    joinCode.value = ''
  }
}

function stopOpenGamesRefresh() {
  if (!openGamesRefreshTimer) return
  clearInterval(openGamesRefreshTimer)
  openGamesRefreshTimer = null
}

function startOpenGamesRefresh() {
  stopOpenGamesRefresh()
  if (typeof window === 'undefined' || view.value !== 'JOIN') return
  openGamesRefreshTimer = window.setInterval(() => { void refreshOpenGames() }, 10_000)
}

watch(view, value => {
  if (value === 'JOIN') startOpenGamesRefresh()
  else stopOpenGamesRefresh()
})

watch(directorySearch, () => {
  if (view.value !== 'JOIN' || typeof window === 'undefined') return
  if (directorySearchTimer) window.clearTimeout(directorySearchTimer)
  directorySearchTimer = window.setTimeout(() => {
    directorySearchTimer = null
    void refreshOpenGames()
  }, 300)
})

onBeforeUnmount(() => {
  stopOpenGamesRefresh()
  if (directorySearchTimer && typeof window !== 'undefined') window.clearTimeout(directorySearchTimer)
  directorySearchTimer = null
})

watch(
  () => account.premiumActif.value,
  actif => {
    if (!actif || view.value !== 'CREATE') return
    online.ouvrirConfigurationCreation()
    game.openNewGameSetup()
  },
)

onMounted(async () => {
  await account.actualiserSession()
  // Le menu En ligne repart toujours d'un état propre. Une session acceptée
  // n'est jamais reprise depuis ici : si le créateur a quitté, elle est fermée ;
  // si un participant a quitté, sa copie locale n'existe pas.
  if (online.sessionActive.value && !online.enAttente.value) online.oublierSessionLocale()
  if (view.value === 'JOIN') {
    await refreshOpenGames()
    startOpenGamesRefresh()
  }
})
</script>

<template>
  <section class="online-hub">
    <template v-if="!online.enAttente.value">
      <header class="online-intro">
        <div>
          <div class="online-brand"><span>CLU LIVE</span><b v-if="onlineBetaActive">{{ i18n.t('BÊTA') }}</b></div>
          <h3>{{ i18n.t('Jouer ensemble') }}</h3>
          <p>{{ i18n.t('Créez une métropole collaborative ou rejoignez une partie avec un code.') }}</p>
          <p v-if="onlineBetaActive" class="beta-note">{{ i18n.t('Le mode En ligne est actuellement en bêta. Des bugs, interruptions ou comportements inattendus peuvent encore survenir.') }}</p>
        </div>
        <button v-if="view !== 'CHOICE'" class="quiet-button" type="button" @click="view = 'CHOICE'; online.nettoyerErreur()">← {{ i18n.t('Retour') }}</button>
      </header>

      <div v-if="view === 'CHOICE'" class="choice-grid">
        <button class="choice-card choice-card--create" type="button" @click="enterCreate">
          <span class="choice-card__icon">＋</span>
          <strong>{{ i18n.t('Créer une partie en ligne') }}</strong>
          <small v-if="!account.premiumActif.value">{{ i18n.t('Connectez-vous avec un compte Premium ou passez à Premium pour héberger une partie jusqu’à 5 joueurs.') }}</small>
          <b>→</b>
        </button>
        <button class="choice-card choice-card--join" type="button" @click="enterJoin">
          <span class="choice-card__icon">↳</span>
          <strong>{{ i18n.t('Rejoindre une partie en ligne') }}</strong>
          <small>{{ i18n.t('Gratuit · par code ou via les parties ouvertes') }}</small>
          <b>→</b>
        </button>
      </div>

      <section v-else-if="view === 'CREATE'" class="online-form-shell">
        <div class="gate-card gate-card--premium gate-card--unified">
          <b>★</b>
          <div>
            <strong>{{ i18n.t('Connectez-vous avec un compte Premium ou passez à Premium pour héberger une partie jusqu’à 5 joueurs.') }}</strong>
            <p>{{ i18n.t('Rejoindre une partie reste gratuit, avec un compte CLU ou un pseudonyme invité.') }}</p>
          </div>
          <button type="button" @click="emit('openAccount')">{{ account.connecte.value ? i18n.t('Voir CLU Premium') : i18n.t('Se connecter') }}</button>
        </div>
      </section>

      <section v-else class="join-shell">
        <section class="join-identity">
          <div class="join-identity__copy">
            <span>CLU LIVE</span>
            <h4>{{ i18n.t('Votre identité dans la partie') }}</h4>
            <p v-if="!account.connecte.value">{{ i18n.t('Ce pseudonyme sera utilisé que vous rejoigniez avec un code ou une partie ouverte.') }}</p>
            <p v-else>{{ i18n.t('Votre compte CLU sera utilisé quelle que soit la méthode choisie ci-dessous.') }}</p>
          </div>
          <label v-if="!account.connecte.value"><span>{{ i18n.t('Pseudonyme invité') }}</span><input v-model.trim="guestPseudo" minlength="3" maxlength="24" autocomplete="nickname" :placeholder="i18n.t('Votre pseudonyme')"></label>
          <p v-else class="identity-line">{{ i18n.t('Vous rejoindrez avec') }} <strong data-i18n-skip>{{ account.utilisateur.value?.pseudo }}</strong>.</p>
        </section>

        <div class="join-methods">
          <div class="join-box">
            <h4>{{ i18n.t('Rejoindre avec un code') }}</h4>
            <p class="join-method-copy">{{ i18n.t('Utilisez le code partagé par l’administrateur de la partie.') }}</p>
            <label><span>{{ i18n.t('Code de la partie') }}</span><input v-model.trim="joinCode" maxlength="8" autocomplete="off" placeholder="ABC123" @input="joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '')"></label>
            <button class="primary-button" type="button" :disabled="online.chargement.value || joinCode.length < 4 || (!account.connecte.value && guestPseudo.length < 3)" @click="joinGame()">{{ i18n.t('Rejoindre') }} <b>→</b></button>
          </div>

          <div class="open-games">
            <header><div><h4>{{ i18n.t('Parties ouvertes à tous') }}</h4><p>{{ i18n.t('Entrez directement dans une métropole dont l’administrateur a autorisé l’accès public.') }}</p></div><button class="quiet-button" type="button" :disabled="openGamesLoading" @click="refreshOpenGames">↻</button></header>
            <label class="directory-search"><span>{{ i18n.t('Rechercher une partie ou un administrateur') }}</span><input v-model.trim="directorySearch" type="search" :placeholder="i18n.t('Nom de la partie ou pseudonyme')"></label>
            <div v-if="openGamesLoading" class="empty-state">{{ i18n.t('Chargement…') }}</div>
            <div v-else-if="openGamesError" class="directory-warning">{{ openGamesError }}</div>
            <div v-else-if="!online.partiesOuvertes.value.length" class="empty-state">{{ i18n.t('Aucune partie ouverte pour le moment.') }}</div>
            <div v-else-if="!filteredOpenGames.length" class="empty-state">{{ i18n.t('Aucune partie ne correspond à votre recherche.') }}</div>
            <div v-else class="server-list">
              <article v-for="openGame in filteredOpenGames" :key="openGame.code" class="server-card">
                <div><strong data-i18n-skip>{{ openGame.nom }}</strong><span>{{ openGame.carte.nom || i18n.t('Carte inconnue') }} · {{ openGame.joueursConnectes }}/{{ openGame.placesMax }}</span><small>{{ i18n.t('Administrateur') }} : <b data-i18n-skip>{{ openGame.administrateurPseudo }}</b> · {{ openGame.lectureSeuleParDefaut ? i18n.t('Lecture seule par défaut') : i18n.t('Édition autorisée par défaut') }}</small></div>
                <button type="button" :disabled="online.chargement.value || (!account.connecte.value && guestPseudo.length < 3)" @click="joinGame(openGame.code, 'directory')">{{ i18n.t('Rejoindre') }}</button>
              </article>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="online.enAttente.value">
      <header class="session-head">
        <div>
          <span>{{ i18n.t('Partie en cours') }}</span>
          <h3 data-i18n-skip>{{ online.partie.value?.nom }}</h3>
          <p>{{ online.partie.value?.config.carte.nom || i18n.t('Carte inconnue') }} · {{ visibilityLabel(online.partie.value!.visibilite) }}</p>
        </div>
        <div class="session-code"><small>{{ i18n.t('Code') }}</small><strong data-i18n-skip>{{ online.partie.value?.code }}</strong><button type="button" @click="copyCode">{{ copyFeedback ? i18n.t('Copié') : i18n.t('Copier') }}</button></div>
      </header>

      <div class="waiting-card">
        <span class="waiting-spinner" aria-hidden="true">◌</span>
        <div><strong>{{ i18n.t('En attente de l’administrateur') }}</strong><p>{{ i18n.t('Votre demande a été envoyée. Vous entrerez automatiquement dès qu’elle sera acceptée.') }}</p></div>
        <small>{{ i18n.t('Vous pouvez laisser cette fenêtre ouverte.') }}</small>
        <button class="waiting-cancel" type="button" @click="cancelPendingRequest">{{ i18n.t('Annuler la demande') }}</button>
      </div>
    </template>

    <p v-if="onlineErrorMessage" class="online-error">{{ onlineErrorMessage }}</p>
  </section>
</template>

<style scoped>
.online-hub{display:grid;gap:14px;color:#edf8f9}.online-brand{display:flex;align-items:center;gap:7px}.online-brand>b{padding:2px 5px;border:1px solid rgba(236,193,88,.24);border-radius:999px;background:rgba(236,193,88,.08);color:#f0cf79;font-size:calc(6.5px * var(--clu-text-scale,1));letter-spacing:.08em}.online-intro,.session-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.online-intro>div,.session-head>div:first-child{display:grid;gap:4px}.online-intro span,.session-head>div:first-child>span{font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.16em;color:#71dce4}.online-intro h3,.session-head h3{margin:0;font-size:calc(21px * var(--clu-text-scale,1))}.online-intro p,.session-head p{margin:0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5;opacity:.55}.quiet-button{border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.035);color:inherit;padding:8px 10px;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}.choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.choice-card{position:relative;min-height:210px;display:grid;align-content:center;justify-items:start;gap:9px;padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer;transition:.16s ease}.choice-card:hover{transform:translateY(-2px);border-color:rgba(90,220,229,.34);background:rgba(90,220,229,.06)}.choice-card--create{background:linear-gradient(135deg,rgba(31,129,140,.11),rgba(255,255,255,.02))}.choice-card--join{background:linear-gradient(135deg,rgba(178,55,115,.10),rgba(255,255,255,.02))}.choice-card__icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(92,222,229,.1);color:#8ae7ec;font-size:calc(22px * var(--clu-text-scale,1))}.choice-card strong{font-size:calc(16px * var(--clu-text-scale,1))}.choice-card small{max-width:280px;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5;opacity:.5}.choice-card>b{position:absolute;right:20px;bottom:18px;color:#7ce4ea;font-size:18px}.online-form-shell,.join-shell{display:grid;gap:12px}.gate-card{min-height:180px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:19px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025)}.gate-card>b{width:45px;height:45px;display:grid;place-items:center;border-radius:13px;background:rgba(78,211,220,.1);color:#80e1e7;font-size:20px}.gate-card--premium>b{color:#f1ce6e;background:rgba(226,184,62,.1)}.gate-card strong{font-size:calc(13px * var(--clu-text-scale,1))}.gate-card p{margin:4px 0 0;font-size:calc(9px * var(--clu-text-scale,1));opacity:.55}.gate-card button,.primary-button,.server-card button,.pending-panel button,.moderation-row button,.blocked-panel button{border:1px solid rgba(88,216,225,.3);border-radius:9px;background:rgba(60,185,195,.1);color:inherit;padding:9px 11px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1));font-weight:800}.create-form{display:grid;gap:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.form-grid label,.join-box label,.join-identity label,.admin-settings>label{display:grid;gap:5px}.form-grid label>span,.join-box label>span,.join-identity label>span,.admin-settings>label>span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;opacity:.5}.form-grid .wide{grid-column:1/-1}.form-grid input,.form-grid select,.join-box input,.join-identity input,.admin-settings select{min-height:39px;box-sizing:border-box;border:1px solid rgba(255,255,255,.11);border-radius:9px;background:#0d171d;color:#edf8f9;padding:8px 9px;font:inherit;color-scheme:dark}.switch-line,.admin-toggle{display:flex!important;align-items:flex-start;gap:9px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.02)}.switch-line input,.admin-toggle input{margin-top:2px}.switch-line>span{display:grid;gap:2px}.switch-line strong{font-size:calc(9px * var(--clu-text-scale,1))}.switch-line small{font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;opacity:.45}.access-explain{display:flex;gap:8px;align-items:center;padding:9px 11px;border-radius:9px;background:rgba(100,210,220,.055);font-size:calc(8px * var(--clu-text-scale,1))}.access-explain b{color:#84e4e9}.access-explain span{opacity:.58}.primary-button{justify-self:end;min-width:180px}.primary-button:disabled,.server-card button:disabled{opacity:.35;cursor:not-allowed}.join-shell{grid-template-columns:1fr}.join-identity{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.62fr);gap:14px;align-items:end;padding:14px;border:1px solid rgba(90,220,229,.12);border-radius:13px;background:linear-gradient(110deg,rgba(34,142,153,.075),rgba(255,255,255,.018))}.join-identity__copy{display:grid;gap:3px}.join-identity__copy>span{font-size:calc(7px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.14em;color:#72dfe7}.join-identity h4{margin:0;font-size:calc(12px * var(--clu-text-scale,1))}.join-identity__copy p{margin:0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.45;opacity:.5}.join-methods{display:grid;grid-template-columns:minmax(230px,.78fr) minmax(0,1.22fr);gap:12px}.join-method-copy{margin:-2px 0 1px;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;opacity:.45}.join-box,.open-games{padding:14px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.02);display:grid;align-content:start;gap:10px}.join-box h4,.open-games h4,.members-panel h4,.admin-settings h4,.pending-panel h4{margin:0;font-size:calc(12px * var(--clu-text-scale,1))}.identity-line,.guest-hint{margin:0;font-size:calc(8px * var(--clu-text-scale,1));opacity:.55}.open-games>header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.open-games>header p{margin:3px 0 0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;opacity:.45}.server-list{display:grid;gap:7px;max-height:330px;overflow:auto}.server-card{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.server-card>div{display:grid;gap:2px;min-width:0}.server-card strong{font-size:calc(10px * var(--clu-text-scale,1))}.server-card span,.server-card small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.empty-state{padding:24px;text-align:center;font-size:calc(9px * var(--clu-text-scale,1));opacity:.45}.session-head{padding:12px 13px;border:1px solid rgba(76,211,220,.16);border-radius:13px;background:linear-gradient(110deg,rgba(31,117,128,.09),rgba(255,255,255,.015))}.session-code{display:grid;grid-template-columns:auto auto;gap:3px 8px;align-items:center;text-align:right}.session-code small{grid-column:1/-1;font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.42}.session-code strong{font:900 calc(18px * var(--clu-text-scale,1))/1 ui-monospace,monospace;letter-spacing:.1em;color:#9cecf0}.session-code button{border:0;background:transparent;color:#8de4e9;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}.waiting-card{min-height:230px;display:grid;place-items:center;align-content:center;text-align:center;gap:9px;padding:20px;border:1px solid rgba(229,188,78,.15);border-radius:14px;background:rgba(159,113,28,.055)}.waiting-spinner{font-size:34px;color:#f0cf76;animation:spin 1.1s linear infinite}.waiting-card div{display:grid;gap:4px}.waiting-card strong{font-size:calc(15px * var(--clu-text-scale,1))}.waiting-card p{max-width:460px;margin:0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5;opacity:.56}.waiting-card small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.38}.waiting-cancel{margin-top:5px;border:1px solid rgba(255,255,255,.10);border-radius:9px;background:rgba(255,255,255,.035);color:inherit;padding:8px 11px;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1));font-weight:800}@keyframes spin{to{transform:rotate(360deg)}}.session-toolbar{display:flex;align-items:center;gap:7px}.presence{display:flex;align-items:baseline;gap:6px;margin-right:auto}.presence b{font-size:calc(13px * var(--clu-text-scale,1));color:#8de5ea}.presence span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.session-toolbar>button{border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.035);color:inherit;padding:8px 10px;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}.session-toolbar>button.active{border-color:rgba(82,213,222,.35);background:rgba(82,213,222,.1)}.session-toolbar .launch-button{border-color:rgba(91,219,153,.31);background:rgba(58,178,119,.1);color:#b7f0cf}.session-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,.66fr);gap:10px;min-height:320px}.session-columns--chat{grid-template-columns:minmax(0,1fr) minmax(250px,.62fr) minmax(260px,.72fr)}.members-panel,.admin-settings,.chat-panel{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.018)}.members-panel>header,.blocked-panel>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.members-panel>header span,.blocked-panel>header small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.45}.member-list{display:grid;gap:6px}.member-card{border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(255,255,255,.02);overflow:hidden}.member-card.selected{border-color:rgba(83,213,222,.26)}.member-main{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:9px;border:0;background:transparent;color:inherit;text-align:left}.member-main:not(:disabled){cursor:pointer}.member-main i{width:7px;height:7px;border-radius:50%;background:#586268}.member-main i.online{background:#62d69a;box-shadow:0 0 9px rgba(98,214,154,.55)}.member-main span{display:grid;gap:1px}.member-main strong{font-size:calc(10px * var(--clu-text-scale,1))}.member-main small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.45}.member-admin{display:grid;gap:9px;padding:9px;border-top:1px solid rgba(255,255,255,.06)}.profile-row,.moderation-row{display:flex;flex-wrap:wrap;gap:5px}.profile-row button,.moderation-row button{border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(255,255,255,.035);color:inherit;padding:6px 7px;cursor:pointer;font-size:calc(7px * var(--clu-text-scale,1))}.moderation-row .danger{border-color:rgba(236,78,90,.25);color:#ffadb4}.permission-groups{display:grid;grid-template-columns:1fr 1fr;gap:6px}.permission-groups fieldset{margin:0;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:8px}.permission-groups legend{padding:0 4px;font-size:calc(7px * var(--clu-text-scale,1));font-weight:800;opacity:.58}.permission-groups label{display:flex;gap:6px;align-items:flex-start;padding:3px 0;font-size:calc(7px * var(--clu-text-scale,1));opacity:.72}.pending-panel{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);display:grid;gap:6px}.pending-panel article{display:grid;grid-template-columns:1fr auto auto;gap:5px;align-items:center;padding:7px;border-radius:8px;background:rgba(225,188,85,.04)}.pending-panel article>div{display:grid}.pending-panel strong{font-size:calc(9px * var(--clu-text-scale,1))}.pending-panel small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.4}.admin-settings{display:grid;align-content:start;gap:9px}.admin-toggle{font-size:calc(8px * var(--clu-text-scale,1));opacity:.74}.blocked-panel{margin-top:4px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07);display:grid;gap:6px}.blocked-panel p{margin:0;font-size:calc(8px * var(--clu-text-scale,1));opacity:.4}.blocked-panel article{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px;border-radius:8px;background:rgba(173,47,57,.05)}.blocked-panel article>div{display:grid}.blocked-panel article strong{font-size:calc(8px * var(--clu-text-scale,1))}.blocked-panel article small{font-size:calc(7px * var(--clu-text-scale,1));color:#f19aa1}.offline-button{margin-top:4px;border:1px solid rgba(231,91,99,.2);border-radius:9px;background:rgba(164,48,55,.08);color:#f5a7ad;padding:8px;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}.chat-panel{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;min-height:300px}.chat-panel>header{display:flex;justify-content:space-between;align-items:start}.chat-panel>header>div{display:grid}.chat-panel>header strong{font-size:calc(11px * var(--clu-text-scale,1))}.chat-panel>header small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.42}.chat-panel>header button{border:0;background:transparent;color:inherit;cursor:pointer}.chat-messages{min-height:0;max-height:330px;overflow:auto;display:grid;align-content:start;gap:7px}.chat-empty{margin:auto;padding:24px 10px;text-align:center;font-size:calc(8px * var(--clu-text-scale,1));opacity:.4}.chat-messages article{padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.03)}.chat-messages article>div{display:flex;justify-content:space-between;gap:8px}.chat-messages strong{font-size:calc(8px * var(--clu-text-scale,1));color:#8fe4e9}.chat-messages small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.35}.chat-messages p{margin:3px 0 0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;overflow-wrap:anywhere}.chat-compose{display:grid;grid-template-columns:1fr auto;gap:5px}.chat-compose input{min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#0c151a;color:inherit;padding:8px}.chat-compose button{width:34px;border:1px solid rgba(77,212,221,.25);border-radius:8px;background:rgba(77,212,221,.08);color:#88e5ea;cursor:pointer}.chat-compose :disabled{opacity:.35}.online-error{margin:0;padding:9px 10px;border:1px solid rgba(231,82,92,.18);border-radius:9px;background:rgba(177,46,54,.08);color:#ffb1b6;font-size:calc(9px * var(--clu-text-scale,1))}
@media(max-width:980px){.session-columns,.session-columns--chat{grid-template-columns:1fr}.chat-panel{min-height:260px}.join-methods{grid-template-columns:1fr}.permission-groups{grid-template-columns:1fr 1fr}}@media(max-width:680px){.choice-grid,.form-grid,.join-identity{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}.gate-card{grid-template-columns:auto 1fr}.gate-card button{grid-column:1/-1}.session-head{flex-direction:column}.session-code{text-align:left}.session-toolbar{flex-wrap:wrap}.presence{width:100%}.permission-groups{grid-template-columns:1fr}.open-games>header{flex-direction:column}.primary-button{justify-self:stretch}.pending-panel article{grid-template-columns:1fr 1fr}.pending-panel article>div{grid-column:1/-1}}
.directory-search{display:grid;gap:4px}.directory-search span{font-size:calc(7px * var(--clu-text-scale,1));opacity:.48}.directory-search input{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#0c151a;color:inherit;padding:8px 9px}.beta-note{max-width:650px;color:#efce78!important;opacity:.75!important}.directory-warning{padding:12px;border:1px solid rgba(235,181,75,.16);border-radius:9px;background:rgba(196,139,38,.055);color:#f1d28a;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.45}
</style>
