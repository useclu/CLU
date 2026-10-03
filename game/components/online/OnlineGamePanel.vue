<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCluOnline } from '../../composables/useCluOnline'
import { useGameI18n } from '../../composables/useGameI18n'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { isCluOnlineBetaActive } from '../../config/commercial'
import type { CluOnlineBudgetShare, CluOnlineMember, CluOnlinePermission, CluOnlinePermissionProfile, CluOnlinePermissions } from '../../types/online'

const online = useCluOnline()
const i18n = useGameI18n()
const game = useMetropoleGame()
const onlineBetaActive = isCluOnlineBetaActive()
const tab = computed({
  get: () => online.panneauOnglet.value,
  set: (value: 'MEMBERS' | 'CHAT' | 'ADMIN') => online.ouvrirPanneau(value),
})
const chatDraft = ref('')
const selectedMemberId = ref<string | null>(null)
const codeCopyFeedback = ref(false)
const diagnosticCopyFeedback = ref(false)
const budgetDraft = ref<Record<string, number>>({})

const acceptedMembers = computed(() => online.membres.value.filter(member => member.statut === 'accepte'))
const selectedMember = computed(() => acceptedMembers.value.find(member => member.id === selectedMemberId.value) ?? null)
const budgetShares = computed<CluOnlineBudgetShare[]>(() => online.budget.value?.repartition ?? [])
const budgetDivise = computed(() => online.partie.value?.config.budgetMode === 'divise')
const chatActif = computed(() => online.partie.value?.chatActif !== false)
const notificationCount = computed(() => Math.min(99, online.chatNonLus.value + (online.estAdmin.value ? online.demandesEnAttente.value.length : 0)))
const reconnecting = computed(() => online.connexion.value === 'RECONNECTING' || online.connexion.value === 'CONNECTING')
const syncStatusLabel = computed(() => {
  if (online.synchronisation.value === 'SENDING') return i18n.t('Synchronisation…')
  if (online.synchronisation.value === 'RESYNCING') return i18n.t('Resynchronisation…')
  if (online.synchronisation.value === 'ERROR') return i18n.t('Synchronisation en erreur')
  if (online.synchronisation.value === 'SYNCED') return i18n.t('Synchronisé')
  return i18n.t('Initialisation')
})
const latencyLabel = computed(() => online.latenceMs.value == null ? '—' : `${online.latenceMs.value} ms`)
const diagnosticText = computed(() => [
  'CLU Métropole Online — diagnostic bêta',
  `Protocole: ${online.protocoleOnline}`,
  `Connexion: ${online.connexion.value}`,
  `Latence: ${online.latenceMs.value == null ? 'n/a' : `${online.latenceMs.value} ms`}`,
  `Synchronisation: ${online.synchronisation.value}`,
  `Version état: ${online.jeuVersion.value}`,
  `Resynchronisations: ${online.resynchronisations.value}`,
  `Joueurs: ${online.joueursConnectes.value}/${online.partie.value?.placesMax || 5}`,
  `Visibilité: ${online.partie.value?.visibilite || 'n/a'}`,
  `Budget: ${online.partie.value?.config.budgetMode || 'n/a'}`,
].join('\n'))
const moneyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

watch(budgetShares, shares => {
  budgetDraft.value = Object.fromEntries(shares.map(share => [share.membreId, Number(share.montant) || 0]))
}, { immediate: true, deep: true })

const sessionPourPartieCourante = computed(() => Boolean(
  online.sessionActive.value
  && online.moi.value?.statut === 'accepte'
  && game.state.value.status === 'PLAYING'
  && game.state.value.save,
))

const permissionGroups: Array<{ title: string; permissions: CluOnlinePermission[] }> = [
  { title: 'Collaboration', permissions: ['chat'] },
  { title: 'Réseau', permissions: ['construire_lignes', 'modifier_lignes', 'supprimer_lignes', 'construire_stations', 'modifier_stations', 'supprimer_stations'] },
  { title: 'Exploitation', permissions: ['gerer_materiel_roulant', 'gerer_depots', 'gerer_exploitation', 'gerer_horaires', 'gerer_frequences'] },
  { title: 'Finances', permissions: ['gerer_tarification', 'effectuer_depenses', 'gerer_finances', 'gerer_budget', 'gerer_emprunts', 'gerer_subventions'] },
  { title: 'Métropole', permissions: ['gerer_urbanisme', 'gerer_projets'] },
  { title: 'Simulation', permissions: ['gerer_temps_simulation', 'gerer_incidents', 'gerer_pcc', 'gerer_evenements'] },
  { title: 'Paramètres avancés', permissions: ['modifier_parametres_jeu', 'importer_donnees'] },
]

const permissionLabels: Record<CluOnlinePermission, string> = {
  chat: 'Écrire dans le chat',
  construire_lignes: 'Construire des lignes',
  modifier_lignes: 'Modifier les lignes',
  supprimer_lignes: 'Supprimer des lignes',
  construire_stations: 'Construire des stations',
  modifier_stations: 'Modifier les stations',
  supprimer_stations: 'Supprimer des stations',
  gerer_materiel_roulant: 'Gérer le matériel roulant',
  gerer_depots: 'Gérer les dépôts',
  gerer_exploitation: 'Gérer l’exploitation',
  gerer_horaires: 'Gérer les horaires',
  gerer_frequences: 'Gérer les fréquences',
  gerer_tarification: 'Gérer la tarification',
  effectuer_depenses: 'Effectuer des dépenses',
  gerer_finances: 'Gérer les finances',
  gerer_budget: 'Gérer le budget',
  gerer_emprunts: 'Gérer les emprunts',
  gerer_subventions: 'Gérer les subventions',
  gerer_urbanisme: 'Gérer l’urbanisme',
  gerer_projets: 'Gérer les projets',
  gerer_temps_simulation: 'Contrôler le temps et la simulation',
  gerer_incidents: 'Gérer les incidents',
  gerer_pcc: 'Gérer le PCC',
  gerer_evenements: 'Gérer les événements',
  modifier_parametres_jeu: 'Modifier les paramètres de partie',
  importer_donnees: 'Importer des données',
}

function inputChecked(event: Event) {
  return event.target instanceof HTMLInputElement ? event.target.checked : false
}

function selectValue(event: Event) {
  return event.target instanceof HTMLSelectElement ? event.target.value : ''
}

function memberLabel(member: CluOnlineMember) {
  if (member.role === 'administrateur') return i18n.t('Administrateur')
  if (member.estInvite) return i18n.t('Invité')
  if (member.typeCompte === 'premium') return 'Premium ★'
  return i18n.t('Gratuit')
}

async function copyInviteCode() {
  const code = online.partie.value?.code
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    codeCopyFeedback.value = true
    window.setTimeout(() => { codeCopyFeedback.value = false }, 1500)
  }
  catch { /* Le code reste visible et sélectionnable. */ }
}

async function copyDiagnostic() {
  try {
    await navigator.clipboard.writeText(diagnosticText.value)
    diagnosticCopyFeedback.value = true
    window.setTimeout(() => { diagnosticCopyFeedback.value = false }, 1500)
  }
  catch { /* Le diagnostic reste lisible à l'écran. */ }
}

function sendChat() {
  if (!online.envoyerChat(chatDraft.value)) return
  chatDraft.value = ''
}

function setProfile(member: CluOnlineMember, profile: CluOnlinePermissionProfile) {
  online.actionAdmin('definir_profil', { membreId: member.id, profil: profile })
}

function togglePermission(member: CluOnlineMember, permission: CluOnlinePermission, checked: boolean) {
  const permissions: CluOnlinePermissions = { ...(member.permissions || {}), [permission]: checked }
  online.definirPermissions(member.id, permissions)
}

function money(value: number | null | undefined) {
  return moneyFormatter.format(Number(value) || 0)
}

function budgetInput(event: Event, membreId: string) {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number(event.target.value)
  budgetDraft.value = { ...budgetDraft.value, [membreId]: Number.isFinite(value) ? Math.max(0, value) : 0 }
}

function saveBudgetDistribution() {
  online.actionAdmin('redistribuer_budget', { repartition: { ...budgetDraft.value } })
}

function equalBudgetDistribution() {
  online.actionAdmin('repartir_budget_egalement')
}

function expel(member: CluOnlineMember, block: boolean) {
  if (block && typeof window !== 'undefined') {
    const ok = window.confirm(`${i18n.t('Expulser et bloquer')} ${member.pseudo} ?\n\n${i18n.t('Vous pourrez le débloquer à tout moment dans la liste des utilisateurs bloqués.')}`)
    if (!ok) return
  }
  online.actionAdmin('expulser_membre', { membreId: member.id, bloquer: block })
  selectedMemberId.value = null
}

function memberPresenceLabel(member: CluOnlineMember) {
  if (member.connecte) return i18n.t('Connecté')
  if (Number(member.graceJusquA) > Date.now()) return i18n.t('Reconnexion en cours…')
  return i18n.t('Absent')
}

</script>

<template>
  <Teleport to="body">
  <div v-if="sessionPourPartieCourante && online.invitationCodeVisible.value && online.estAdmin.value && online.partie.value?.code" class="invite-code-layer" role="dialog" aria-modal="true" :aria-label="i18n.t('Code de la partie en ligne')">
    <section class="invite-code-card">
      <span class="invite-code-kicker">CLU LIVE</span>
      <h3>{{ i18n.t('Voici le code pour rejoindre la partie') }}</h3>
      <p>{{ i18n.t('Vous pouvez déjà jouer. Les autres joueurs pourront vous rejoindre avec ce code.') }}</p>
      <strong class="invite-code-value" data-i18n-skip>{{ online.partie.value.code }}</strong>
      <div class="invite-code-actions">
        <button class="invite-copy" type="button" @click="copyInviteCode">{{ codeCopyFeedback ? i18n.t('Copié') : i18n.t('Copier') }}</button>
        <button class="invite-close" type="button" @click="online.fermerInvitationCode()">{{ i18n.t('Fermer') }}</button>
      </div>
    </section>
  </div>

  <div v-if="sessionPourPartieCourante" class="online-game-dock">
    <button class="online-game-trigger" type="button" :aria-expanded="online.panneauVisible.value" @click="online.panneauVisible.value ? online.fermerPanneau() : online.ouvrirPanneau('MEMBERS')">
      <span class="live-dot" :class="{ reconnecting }" />
      <strong>{{ online.joueursConnectes.value }}/{{ online.partie.value?.placesMax || 5 }}</strong>
      <span>{{ i18n.t('En ligne') }}<template v-if="onlineBetaActive"> · {{ i18n.t('BÊTA') }}</template></span>
      <b v-if="notificationCount">{{ notificationCount }}</b>
    </button>

    <section v-if="online.panneauVisible.value" class="online-game-panel" :aria-label="i18n.t('CLU En ligne')">
      <header class="panel-head">
        <div><small>{{ online.partie.value?.code }} · V{{ online.jeuVersion.value }} · {{ syncStatusLabel }}</small><strong data-i18n-skip>{{ online.partie.value?.nom }}</strong></div>
        <button type="button" @click="online.fermerPanneau()">×</button>
      </header>

      <p v-if="online.synchronisation.value === 'RESYNCING'" class="sync-banner">{{ i18n.t('Resynchronisation de la métropole en cours…') }}</p>
      <p v-if="reconnecting" class="connection-banner">{{ i18n.t('Reconnexion en cours…') }}<template v-if="online.reconnexionRestanteSecondes.value"> · {{ online.reconnexionRestanteSecondes.value }} s</template></p>
      <div v-if="online.notificationSysteme.value" class="system-notice"><span>{{ i18n.t(online.notificationSysteme.value) }}</span><button type="button" :aria-label="i18n.t('Fermer')" @click="online.fermerNotificationSysteme()">×</button></div>
      <nav class="tabs">
        <button type="button" :class="{ active: tab === 'MEMBERS' }" @click="tab = 'MEMBERS'">{{ i18n.t('Membres') }}</button>
        <button type="button" :class="{ active: tab === 'CHAT' }" @click="tab = 'CHAT'">{{ i18n.t('Chat') }}</button>
        <button v-if="online.estAdmin.value" type="button" :class="{ active: tab === 'ADMIN' }" @click="tab = 'ADMIN'">{{ i18n.t('Administration') }}</button>
      </nav>

      <div v-if="tab === 'MEMBERS'" class="panel-scroll member-list">
        <article v-for="member in acceptedMembers" :key="member.id">
          <i :class="{ on: member.connecte }" />
          <div><strong data-i18n-skip>{{ member.pseudo }}</strong><small>{{ memberLabel(member) }} · {{ memberPresenceLabel(member) }}<template v-if="member.muet"> · {{ i18n.t('Muet') }}</template><template v-if="budgetDivise && member.id === online.moi.value?.id && online.budget.value?.soldePersonnel != null"> · {{ i18n.t('Budget personnel') }} {{ money(online.budget.value?.soldePersonnel) }}</template></small></div>
          <b v-if="member.role === 'administrateur'">★</b>
        </article>
        <div v-if="online.estAdmin.value && online.demandesEnAttente.value.length" class="pending-mini">
          <strong>{{ i18n.t('Demandes en attente') }}</strong>
          <article v-for="member in online.demandesEnAttente.value" :key="member.id"><span data-i18n-skip>{{ member.pseudo }}</span><button type="button" @click="online.actionAdmin('accepter_membre', { membreId: member.id })">✓</button><button type="button" @click="online.actionAdmin('refuser_membre', { membreId: member.id })">×</button></article>
        </div>
      </div>

      <div v-else-if="tab === 'CHAT'" class="chat-tab">
        <div class="panel-scroll chat-list"><p v-if="!chatActif" class="chat-disabled">{{ i18n.t('Le chat a été désactivé par l’administrateur.') }}</p><p v-else-if="!online.messages.value.length">{{ i18n.t('Aucun message. Écrivez pour commencer à collaborer.') }}</p><article v-for="message in online.messages.value" :key="message.id"><header><strong data-i18n-skip>{{ message.auteurPseudo }}</strong><small>{{ new Date(message.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</small></header><p data-i18n-skip>{{ message.texte }}</p></article></div>
        <form @submit.prevent="sendChat"><input v-model="chatDraft" maxlength="500" :disabled="!online.peutChat.value" :placeholder="!chatActif ? i18n.t('Chat désactivé') : online.peutChat.value ? i18n.t('Écrire un message…') : i18n.t('Vous ne pouvez pas écrire dans le chat.')"><button type="submit" :disabled="!online.peutChat.value || !chatDraft.trim()">↑</button></form>
      </div>

      <div v-else class="panel-scroll admin-tab">
        <section class="admin-code">
          <div><small>{{ i18n.t('Code de la partie') }}</small><strong data-i18n-skip>{{ online.partie.value?.code }}</strong></div>
          <button type="button" @click="copyInviteCode">{{ codeCopyFeedback ? i18n.t('Copié') : i18n.t('Copier') }}</button>
        </section>
        <div v-if="online.demandesEnAttente.value.length" class="admin-pending">
          <strong>{{ i18n.t('Demandes en attente') }}</strong>
          <article v-for="member in online.demandesEnAttente.value" :key="member.id"><span><b data-i18n-skip>{{ member.pseudo }}</b><small>{{ memberPresenceLabel(member) }}</small></span><div><button type="button" @click="online.actionAdmin('accepter_membre', { membreId: member.id })">{{ i18n.t('Accepter') }}</button><button type="button" @click="online.actionAdmin('refuser_membre', { membreId: member.id })">{{ i18n.t('Refuser') }}</button></div></article>
        </div>
        <label><span>{{ i18n.t('Visibilité') }}</span><select :value="online.partie.value?.visibilite" @change="online.actionAdmin('definir_visibilite', { visibilite: selectValue($event) })"><option value="privee">{{ i18n.t('Privée') }}</option><option value="publique_code">{{ i18n.t('Publique par code') }}</option><option value="ouverte">{{ i18n.t('Ouverte à tous') }}</option></select></label>
        <label><span>{{ i18n.t('Budget') }}</span><select :value="online.partie.value?.config.budgetMode" @change="online.actionAdmin('definir_budget_mode', { budgetMode: selectValue($event) })"><option value="global">{{ i18n.t('Budget global') }}</option><option value="divise">{{ i18n.t('Budget divisé') }}</option></select></label>
        <section v-if="online.budget.value" class="budget-admin">
          <header><div><small>{{ i18n.t('Trésorerie synchronisée') }}</small><strong>{{ money(online.budget.value.totalDisponible) }}</strong></div><div v-if="budgetDivise"><small>{{ i18n.t('Réserve commune') }}</small><strong>{{ money(online.budget.value.reserveCommune) }}</strong></div></header>
          <template v-if="budgetDivise">
            <p>{{ i18n.t('Chaque dépense est débitée de l’enveloppe du joueur qui effectue l’action. Les effets automatiques de la simulation utilisent la réserve commune.') }}</p>
            <div class="budget-share" v-for="share in budgetShares" :key="share.membreId"><span data-i18n-skip>{{ share.pseudo }}</span><input type="number" min="0" step="1000" :value="budgetDraft[share.membreId] ?? share.montant" @input="budgetInput($event, share.membreId)"></div>
            <div class="budget-actions"><button type="button" @click="equalBudgetDistribution">{{ i18n.t('Répartir également') }}</button><button type="button" class="primary" @click="saveBudgetDistribution">{{ i18n.t('Appliquer la répartition') }}</button></div>
          </template>
        </section>
        <label class="check"><input type="checkbox" :checked="online.partie.value?.entreesOuvertes" @change="online.actionAdmin('definir_entrees_ouvertes', { ouvertes: inputChecked($event) })"><span>{{ i18n.t('Autoriser de nouvelles entrées') }}</span></label>
        <label class="check"><input type="checkbox" :checked="chatActif" @change="online.actionAdmin('definir_chat_actif', { actif: inputChecked($event) })"><span>{{ i18n.t('Chat activé') }}</span></label>
        <label class="check"><input type="checkbox" :checked="!online.partie.value?.config.lectureSeuleParDefaut" @change="online.actionAdmin('definir_defaut_edition', { editionParDefaut: inputChecked($event) })"><span>{{ i18n.t('Édition autorisée par défaut') }}</span></label>

        <div class="admin-members">
          <strong>{{ i18n.t('Permissions des membres') }}</strong>
          <button v-for="member in acceptedMembers.filter(item => item.role !== 'administrateur')" :key="member.id" type="button" :class="{ active: selectedMemberId === member.id }" @click="selectedMemberId = selectedMemberId === member.id ? null : member.id"><span data-i18n-skip>{{ member.pseudo }}</span><b>⌄</b></button>
        </div>

        <template v-if="selectedMember">
          <div class="profiles"><button type="button" @click="setProfile(selectedMember, 'observateur')">{{ i18n.t('Observateur') }}</button><button type="button" @click="setProfile(selectedMember, 'constructeur')">{{ i18n.t('Constructeur') }}</button><button type="button" @click="setProfile(selectedMember, 'exploitant')">{{ i18n.t('Exploitant') }}</button><button type="button" @click="setProfile(selectedMember, 'financier')">{{ i18n.t('Financier') }}</button><button type="button" @click="setProfile(selectedMember, 'gestionnaire')">{{ i18n.t('Gestionnaire') }}</button><button type="button" @click="setProfile(selectedMember, 'edition')">{{ i18n.t('Édition') }}</button><button type="button" @click="setProfile(selectedMember, 'complet')">{{ i18n.t('Complet') }}</button></div>
          <fieldset v-for="group in permissionGroups" :key="group.title"><legend>{{ i18n.t(group.title) }}</legend><label v-for="permission in group.permissions" :key="permission" class="check"><input type="checkbox" :checked="selectedMember.permissions?.[permission] === true" @change="togglePermission(selectedMember, permission, inputChecked($event))"><span>{{ i18n.t(permissionLabels[permission]) }}</span></label></fieldset>
          <div class="moderation"><button type="button" @click="online.actionAdmin('definir_muet', { membreId: selectedMember.id, muet: !selectedMember.muet })">{{ selectedMember.muet ? i18n.t('Rendre la parole') : i18n.t('Rendre muet') }}</button><button type="button" @click="expel(selectedMember, false)">{{ i18n.t('Expulser') }}</button><button class="danger" type="button" @click="expel(selectedMember, true)">{{ i18n.t('Expulser et bloquer') }}</button></div>
        </template>

        <section class="beta-diagnostic">
          <header><strong>{{ i18n.t(onlineBetaActive ? 'Diagnostic bêta' : 'Diagnostic Online') }}</strong><button type="button" @click="copyDiagnostic">{{ diagnosticCopyFeedback ? i18n.t('Copié') : i18n.t('Copier le diagnostic') }}</button></header>
          <div><span>{{ i18n.t('Protocole Online') }}</span><b>v{{ online.protocoleOnline }}</b></div>
          <div><span>{{ i18n.t('Connexion temps réel') }}</span><b data-i18n-skip>{{ online.connexion.value }}</b></div>
          <div><span>{{ i18n.t('Latence') }}</span><b data-i18n-skip>{{ latencyLabel }}</b></div>
          <div><span>{{ i18n.t('État de synchronisation') }}</span><b>{{ syncStatusLabel }}</b></div>
          <div><span>{{ i18n.t('Version de la métropole') }}</span><b>V{{ online.jeuVersion.value }}</b></div>
          <div><span>{{ i18n.t('Resynchronisations') }}</span><b>{{ online.resynchronisations.value }}</b></div>
          <small>{{ i18n.t('Ce diagnostic ne contient ni jeton de connexion ni secret.') }}</small>
        </section>

        <div class="blocked"><strong>{{ i18n.t('Utilisateurs bloqués') }}</strong><p v-if="!online.bloques.value.length">{{ i18n.t('Aucun utilisateur bloqué.') }}</p><article v-for="blocked in online.bloques.value" :key="blocked.cle"><div><span data-i18n-skip>{{ blocked.pseudo }}</span><small>{{ i18n.t('Bloqué définitivement pour cette partie') }}</small></div><button type="button" @click="online.actionAdmin('debloquer', { cle: blocked.cle })">{{ i18n.t('Débloquer') }}</button></article></div>
      </div>

      <p v-if="online.erreur.value" class="dock-error">{{ i18n.t(online.erreur.value) }}</p>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.invite-code-layer{position:fixed;z-index:10030;inset:0;display:grid;place-items:center;padding:20px;background:rgba(3,10,15,.64);backdrop-filter:blur(7px)}.invite-code-card{width:min(430px,calc(100vw - 32px));display:grid;justify-items:center;gap:10px;padding:24px;border:1px solid rgba(84,220,229,.24);border-radius:18px;background:linear-gradient(145deg,rgba(12,35,45,.98),rgba(6,18,25,.99));box-shadow:0 34px 100px rgba(0,0,0,.55);text-align:center}.invite-code-kicker{font-size:8px;font-weight:900;letter-spacing:.18em;color:#75e2e9}.invite-code-card h3{margin:0;font-size:18px}.invite-code-card p{max-width:340px;margin:0;font-size:9px;line-height:1.55;opacity:.58}.invite-code-value{margin:5px 0;padding:13px 18px;border:1px solid rgba(104,229,236,.22);border-radius:12px;background:rgba(73,204,214,.07);font:900 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:#b9f9fc;user-select:all}.invite-code-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;margin-top:3px}.invite-code-actions button{min-height:40px;border-radius:10px;cursor:pointer;font-weight:800}.invite-copy{border:1px solid rgba(85,220,229,.34);background:rgba(61,188,198,.12);color:#e9feff}.invite-close{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:#edf8f9}
.online-game-dock{position:fixed;z-index:10020;right:18px;bottom:18px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#edf8f9}.online-game-trigger{height:42px;display:flex;align-items:center;gap:7px;padding:0 11px;border:1px solid rgba(80,216,225,.28);border-radius:12px;background:rgba(7,19,25,.91);color:inherit;box-shadow:0 12px 38px rgba(0,0,0,.33);cursor:pointer;backdrop-filter:blur(14px)}.online-game-trigger span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.62}.online-game-trigger strong{font-size:calc(9px * var(--clu-text-scale,1))}.online-game-trigger>b{min-width:17px;height:17px;display:grid;place-items:center;border-radius:99px;background:#d35377;font-size:7px}.live-dot{width:7px;height:7px;border-radius:50%;background:#55d695;box-shadow:0 0 10px rgba(85,214,149,.65);opacity:1!important}.live-dot.reconnecting{background:#e7bd58;box-shadow:0 0 10px rgba(231,189,88,.55)}.online-game-panel{position:absolute;right:0;bottom:50px;width:min(420px,calc(100vw - 28px));max-height:min(680px,calc(100vh - 110px));display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:rgba(7,17,23,.97);box-shadow:0 28px 85px rgba(0,0,0,.5);backdrop-filter:blur(18px)}.panel-head{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.07)}.panel-head>div{display:grid}.panel-head small{font:800 8px/1.2 ui-monospace,monospace;letter-spacing:.1em;color:#73dce3}.panel-head strong{font-size:calc(11px * var(--clu-text-scale,1))}.panel-head button{border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer}.sync-banner{margin:0;padding:6px 10px;border-bottom:1px solid rgba(83,216,225,.12);background:rgba(83,216,225,.05);color:#9cebf0;font-size:calc(7px * var(--clu-text-scale,1));text-align:center}.connection-banner{margin:0;padding:6px 10px;border-bottom:1px solid rgba(231,189,88,.12);background:rgba(231,189,88,.055);color:#efd486;font-size:calc(7px * var(--clu-text-scale,1));text-align:center}.system-notice{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:7px 10px;border-bottom:1px solid rgba(83,216,225,.12);background:rgba(83,216,225,.055);color:#a7edf1;font-size:calc(7px * var(--clu-text-scale,1))}.system-notice button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1}.admin-pending article>span{display:grid;gap:1px}.admin-pending article>span>b{font-size:calc(8px * var(--clu-text-scale,1))}.admin-pending article>span>small{font-size:calc(6px * var(--clu-text-scale,1));opacity:.45}.tabs{display:grid;grid-template-columns:repeat(3,1fr);padding:6px;gap:4px;border-bottom:1px solid rgba(255,255,255,.05)}.tabs button{border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;padding:7px;font-size:calc(7px * var(--clu-text-scale,1));cursor:pointer;opacity:.55}.tabs button.active{border-color:rgba(78,211,221,.22);background:rgba(78,211,221,.075);opacity:1}.panel-scroll{min-height:0;overflow:auto;padding:10px}.member-list{display:grid;align-content:start;gap:5px}.member-list>article{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px;border-radius:8px;background:rgba(255,255,255,.025)}.member-list i{width:7px;height:7px;border-radius:50%;background:#536168}.member-list i.on{background:#55d695}.member-list article>div{display:grid}.member-list strong{font-size:calc(8px * var(--clu-text-scale,1))}.member-list small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.42}.pending-mini{display:grid;gap:5px;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)}.pending-mini>strong{font-size:calc(8px * var(--clu-text-scale,1))}.pending-mini article{display:grid;grid-template-columns:1fr auto auto!important}.pending-mini button{border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(255,255,255,.03);color:inherit;cursor:pointer}.chat-tab{min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto}.chat-list{display:grid;align-content:start;gap:6px}.chat-list>p{margin:auto;padding:30px 10px;text-align:center;font-size:calc(8px * var(--clu-text-scale,1));opacity:.38}.chat-list article{padding:7px;border-radius:8px;background:rgba(255,255,255,.025)}.chat-list article header{display:flex;justify-content:space-between;gap:8px}.chat-list strong{font-size:calc(8px * var(--clu-text-scale,1));color:#82e0e6}.chat-list small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.35}.chat-list article p{margin:3px 0 0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;overflow-wrap:anywhere}.chat-tab form{display:grid;grid-template-columns:1fr auto;gap:5px;padding:8px;border-top:1px solid rgba(255,255,255,.06)}.chat-tab input,.admin-tab select{min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:#0b151a;color:inherit;padding:8px}.chat-tab form button{width:34px;border:1px solid rgba(77,212,221,.24);border-radius:7px;background:rgba(77,212,221,.08);color:#83e4e9}.admin-tab{display:grid;align-content:start;gap:8px}.admin-code{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px;border:1px solid rgba(80,216,225,.16);border-radius:9px;background:rgba(80,216,225,.045)}.admin-code>div{display:grid;gap:3px}.admin-code small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.48}.admin-code strong{font:900 calc(16px * var(--clu-text-scale,1))/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#b9f9fc;user-select:all}.admin-code button,.admin-pending button{border:1px solid rgba(80,216,225,.2);border-radius:7px;background:rgba(80,216,225,.07);color:inherit;padding:6px 8px;cursor:pointer;font-size:calc(7px * var(--clu-text-scale,1))}.admin-pending{display:grid;gap:5px;padding:8px;border:1px solid rgba(242,181,89,.14);border-radius:9px;background:rgba(242,181,89,.035)}.admin-pending>strong{font-size:calc(8px * var(--clu-text-scale,1))}.admin-pending article{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:calc(8px * var(--clu-text-scale,1))}.admin-pending article>div{display:flex;gap:4px}.admin-tab>label{display:grid;gap:4px;font-size:calc(7px * var(--clu-text-scale,1));opacity:.72}.check{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:6px!important}.admin-members{display:grid;gap:4px;padding-top:7px;border-top:1px solid rgba(255,255,255,.06)}.admin-members>strong,.blocked>strong{font-size:calc(8px * var(--clu-text-scale,1))}.admin-members>button{display:flex;justify-content:space-between;border:1px solid rgba(255,255,255,.07);border-radius:7px;background:rgba(255,255,255,.025);color:inherit;padding:7px;cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1))}.admin-members>button.active{border-color:rgba(76,211,221,.24)}.profiles,.moderation{display:flex;flex-wrap:wrap;gap:4px}.profiles button,.moderation button,.blocked button{border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(255,255,255,.03);color:inherit;padding:6px;cursor:pointer;font-size:calc(7px * var(--clu-text-scale,1))}.moderation .danger{color:#ffadb4;border-color:rgba(231,79,89,.22)}.admin-tab fieldset{margin:0;padding:7px;border:1px solid rgba(255,255,255,.06);border-radius:7px}.admin-tab legend{padding:0 4px;font-size:calc(7px * var(--clu-text-scale,1));font-weight:800;opacity:.55}.admin-tab fieldset label{font-size:calc(7px * var(--clu-text-scale,1));padding:2px 0;opacity:.72}.blocked{display:grid;gap:5px;padding-top:7px;border-top:1px solid rgba(255,255,255,.06)}.blocked>p{margin:0;font-size:calc(7px * var(--clu-text-scale,1));opacity:.4}.blocked article{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:6px;border-radius:7px;background:rgba(177,47,57,.05)}.blocked article>div{display:grid}.blocked span{font-size:calc(8px * var(--clu-text-scale,1))}.blocked small{font-size:calc(6px * var(--clu-text-scale,1));color:#ee9ca3}.budget-admin{display:grid;gap:7px;padding:9px;border:1px solid rgba(85,216,225,.14);border-radius:9px;background:rgba(85,216,225,.035)}.budget-admin header{display:grid;grid-template-columns:1fr 1fr;gap:6px}.budget-admin header>div{display:grid;gap:2px;padding:7px;border-radius:7px;background:rgba(255,255,255,.03)}.budget-admin small{font-size:calc(6.5px * var(--clu-text-scale,1));opacity:.5}.budget-admin strong{font-size:calc(10px * var(--clu-text-scale,1));color:#a8f5f8}.budget-admin p{margin:0;font-size:calc(6.5px * var(--clu-text-scale,1));line-height:1.4;opacity:.55}.budget-share{display:grid;grid-template-columns:minmax(0,1fr) 120px;align-items:center;gap:7px}.budget-share span{font-size:calc(7px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis}.budget-share input{min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:#0b151a;color:inherit;padding:7px}.budget-actions{display:flex;justify-content:flex-end;gap:5px;flex-wrap:wrap}.budget-actions button{border:1px solid rgba(255,255,255,.09);border-radius:7px;background:rgba(255,255,255,.04);color:inherit;padding:6px 8px;cursor:pointer;font-size:calc(7px * var(--clu-text-scale,1))}.budget-actions .primary{border-color:rgba(80,216,225,.25);background:rgba(80,216,225,.09)}.beta-diagnostic{display:grid;gap:5px;padding:9px;border:1px solid rgba(142,110,255,.16);border-radius:9px;background:rgba(142,110,255,.045)}.beta-diagnostic header{display:flex;align-items:center;justify-content:space-between;gap:8px}.beta-diagnostic header strong{font-size:calc(8px * var(--clu-text-scale,1));color:#d8caff}.beta-diagnostic header button{border:1px solid rgba(181,157,255,.2);border-radius:7px;background:rgba(181,157,255,.07);color:inherit;padding:5px 7px;cursor:pointer;font-size:calc(6.5px * var(--clu-text-scale,1))}.beta-diagnostic>div{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:calc(7px * var(--clu-text-scale,1))}.beta-diagnostic>div span{opacity:.55}.beta-diagnostic>div b{font:800 calc(7px * var(--clu-text-scale,1))/1.2 ui-monospace,monospace;color:#eee9ff}.beta-diagnostic>small{font-size:calc(6px * var(--clu-text-scale,1));line-height:1.35;opacity:.38}.chat-disabled{color:#efc879!important;opacity:.8!important}.dock-error{margin:0;padding:7px 9px;border-top:1px solid rgba(235,81,92,.14);background:rgba(176,45,54,.08);color:#ffafb5;font-size:calc(7px * var(--clu-text-scale,1))}@media(max-width:620px){.online-game-dock{right:10px;bottom:10px}.online-game-panel{width:calc(100vw - 20px);max-height:calc(100vh - 86px)}}
</style>
