<script setup lang="ts">
import { currentGameLocaleTag } from '../../../config/i18n'
import { computed, ref } from 'vue'
import { getTransportModeDefinition } from '../../../config/transportModes'
import { useGameInfoCenter } from '../../../composables/useGameInfoCenter'
import { useGameEvents } from '../../../composables/useGameEvents'
import { useGameMunicipalities } from '../../../composables/useGameMunicipalities'
import { useGameSelection } from '../../../composables/useGameSelection'
import { useGameAnalytics } from '../../../composables/useGameAnalytics'
import { useGameSettings } from '../../../composables/useGameSettings'
import { useGameRoast } from '../../../composables/useGameRoast'

const info = useGameInfoCenter()
const events = useGameEvents()
const municipalities = useGameMunicipalities()
const selection = useGameSelection()
const analytics = useGameAnalytics()
const preferences = useGameSettings()
const roast = useGameRoast()
const contextualTipsEnabled = computed(() => preferences.settings.value.contextualTips !== false)
const negotiationRequest = ref<any | null>(null)
const negotiationAmountValue = ref(0)
const negotiationResponse = ref<{ status: string; message: string } | null>(null)

const alerts = computed(() => info.items.value.filter(item => !(item.category === 'MUNICIPALITY' && item.severity === 'OPPORTUNITY')))
const urgentAlerts = computed(() => alerts.value.filter(item => ['CRITICAL', 'WARNING'].includes(item.severity)).slice(0, 3))
const otherAttentionAlerts = computed(() => alerts.value.filter(item => ['CRITICAL', 'WARNING'].includes(item.severity)).slice(3))
const informationItems = computed(() => alerts.value.filter(item => item.severity === 'INFO'))
const negotiationMax = computed(() => Math.max(1_000_000, Math.ceil(((negotiationRequest.value?.subsidyAmount ?? 0) * 1.65) / 1_000_000) * 1_000_000))

function openNegotiation(request: any) {
  negotiationRequest.value = request
  negotiationAmountValue.value = Math.round((request.subsidyAmount ?? 0) / 100_000) * 100_000
  negotiationResponse.value = null
}
function closeNegotiation() {
  negotiationRequest.value = null
  negotiationResponse.value = null
}
async function proposeNegotiation() {
  const request = negotiationRequest.value
  if (!request) return
  const result = await municipalities.negotiateRequest(request.id, negotiationAmountValue.value)
  if (result.status === 'ACCEPTED') {
    await municipalities.acceptRequest(request.id)
    negotiationResponse.value = { status: result.status, message: `La ville accepte votre proposition : ${money(negotiationAmountValue.value)}.` }
    return
  }
  if (result.status === 'COUNTERED') {
    negotiationAmountValue.value = request.subsidyAmount
    negotiationResponse.value = { status: result.status, message: `La ville refuse ce montant et propose ${money(request.subsidyAmount)}. Vous pouvez accepter ou tenter une dernière contre-proposition.` }
    return
  }
  negotiationResponse.value = { status: result.status, message: 'Je refuse de payer cette somme, je me retire.' }
}
async function acceptCounterOffer() {
  const request = negotiationRequest.value
  if (!request) return
  await municipalities.acceptRequest(request.id)
  negotiationResponse.value = { status: 'ACCEPTED', message: `Accord conclu à ${money(request.subsidyAmount)}.` }
}

function money(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
function integer(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value)
}
function percent(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'percent', maximumFractionDigits: 0 }).format(value)
}
function focusInfo(item: any) {
  if (item.lineId && item.stationId) {
    selection.selectStation(item.lineId, item.stationId)
    window.dispatchEvent(new CustomEvent('clu-open-network-line', { detail: { lineId: item.lineId } }))
    return
  }
  if (item.lineId) {
    selection.selectLine(item.lineId)
    window.dispatchEvent(new CustomEvent('clu-open-network-line', { detail: { lineId: item.lineId } }))
  }
}
function requestTitle(kind: string) {
  if (kind === 'ADD_LINE') return 'Créer une nouvelle desserte'
  if (kind === 'BOOST_SERVICE') return 'Renforcer le service existant'
  return 'Ajouter une station'
}
function requestDescription(request: any) {
  const referenceMode = getTransportModeDefinition(request.referenceMode ?? 'TRAM').label
  if (request.kind === 'ADD_LINE') return `La commune souhaite être desservie par davantage de lignes (objectif : ${request.targetLineCount ?? '—'}). L’offre est estimée sur une desserte ${referenceMode}, puis recalculée selon le projet réellement livré.`
  if (request.kind === 'BOOST_SERVICE') return `La commune souhaite renforcer ${request.targetLineName ?? 'une ligne existante'} : passer au niveau ${serviceLabel(request.targetServiceLevel)} ou ajouter au moins un véhicule au parc. Le cofinancement dépend du mode et de l’effort réellement réalisé.`
  return `La commune souhaite davantage de stations (objectif : ${request.targetStationCount ?? '—'}). L’aide est estimée sur le mode ${referenceMode}, puis recalculée selon les travaux réellement réalisés.`
}
function serviceLabel(level?: string) {
  const labels: Record<string, string> = { REDUCED: 'Réduit', STANDARD: 'Standard', FREQUENT: 'Fréquent', INTENSIVE: 'Intensif' }
  return labels[level ?? ''] ?? 'supérieur'
}
function relationFor(code: string) {
  return municipalities.state.value?.relations.find(relation => relation.code === code) ?? null
}
function requestStatusLabel(status: string) {
  const labels: Record<string, string> = { COMPLETED: 'Accord réalisé', REFUSED: 'Refusé', FAILED: 'Engagement non tenu', EXPIRED: 'Offre expirée' }
  return labels[status] ?? status
}
function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    NETWORK: 'Réseau', PASSENGERS: 'Voyageurs', FINANCE: 'Finances', MAINTENANCE: 'Maintenance', STATION: 'Station', OBJECTIVE: 'Objectif', MUNICIPALITY: 'Commune',
  }
  return labels[category] ?? category
}
</script>

<template>
  <section class="events-panel">
    <div class="section-head">
      <div><span class="eyebrow">Centre de commandement</span><h2>Événements & Infos</h2></div>
      <span class="counter" :class="{ danger: info.criticalCount.value > 0 }">{{ info.attentionCount.value }} à surveiller</span>
    </div>

    <div class="daily-pulse" :class="`tone-${analytics.networkHealth.value.tone}`">
      <div class="pulse-head"><span>État du réseau</span><strong>{{ analytics.networkHealth.value.label }}</strong></div>
      <p>{{ analytics.networkHealth.value.summary }}</p>
      <div class="pulse-grid">
        <div><span>Demande transportée</span><strong>{{ percent(analytics.aggregate.value.demandSatisfactionRate) }}</strong></div>
        <div><span>Attente moyenne</span><strong>{{ Math.round(analytics.aggregate.value.averageWaitMinutes) }} min</strong></div>
        <div><span>En attente</span><strong>{{ integer(analytics.aggregate.value.waiting) }}</strong></div>
        <div><span>Ont renoncé</span><strong>{{ integer(analytics.aggregate.value.lost) }}</strong></div>
      </div>
    </div>

    <details class="event-group event-group--priority">
      <summary>À traiter · {{ urgentAlerts.length + municipalities.pendingRequests.value.length + (events.activeEvent.value ? 1 : 0) }}</summary>
      <div class="group-content">
        <section v-if="events.activeEvent.value" class="decision-block">
          <div class="sub-head"><strong>{{ events.activeEvent.value.title }}</strong><small>Une décision est attendue maintenant.</small></div>
          <p class="decision-description">{{ events.activeEvent.value.description }}</p>
          <div class="choice-list">
            <button v-for="choice in events.activeEvent.value.choices" :key="choice.id" type="button" @click="events.choose(choice.id)"><strong>{{ choice.label }}</strong><small>{{ choice.description }}</small></button>
          </div>
        </section>

        <div v-if="urgentAlerts.length" class="info-list">
          <button v-for="item in urgentAlerts" :key="item.id" type="button" class="info-card" :class="`sev-${item.severity.toLowerCase()}`" @click="focusInfo(item)">
            <div class="info-meta"><span>{{ item.severity === 'CRITICAL' ? 'Urgent' : 'À surveiller' }}</span><span>{{ categoryLabel(item.category) }}</span></div>
            <strong>{{ item.title }}</strong><p>{{ item.description }}</p>
            <small v-if="item.lineId && contextualTipsEnabled" class="open-hint">Ouvrir la ligne →</small>
          </button>
        </div>

        <div v-if="municipalities.pendingRequests.value.length" class="request-list">
          <article v-for="request in municipalities.pendingRequests.value" :key="request.id">
            <div class="request-top"><span class="request-city">{{ request.municipalityName }}</span><small v-if="relationFor(request.municipalityCode)">Relation {{ relationFor(request.municipalityCode)?.score }}/100 · {{ relationFor(request.municipalityCode)?.completedRequests }} accord(s) réalisé(s)</small></div>
            <strong>{{ requestTitle(request.kind) }}</strong>
            <p>{{ requestDescription(request) }}</p>
            <small>Subvention estimée : {{ money(request.subsidyAmount) }} · référence {{ getTransportModeDefinition(request.referenceMode ?? 'TRAM').label }}</small>
            <small class="funding-note">Cofinancement proportionnel : le montant final dépend du projet réellement livré.</small>
            <div class="decision-row"><button class="accept" type="button" @click="municipalities.acceptRequest(request.id)">Accepter</button><button class="negotiate" type="button" @click="openNegotiation(request)">Négocier</button><button class="refuse" type="button" @click="municipalities.refuseRequest(request.id)">Refuser</button></div>
          </article>
        </div>

        <div v-if="!events.activeEvent.value && !urgentAlerts.length && !municipalities.pendingRequests.value.length" class="quiet">Rien ne réclame votre attention immédiate.</div>
      </div>
    </details>

    <details class="event-group">
      <summary>En cours · {{ municipalities.acceptedRequests.value.length + otherAttentionAlerts.length + informationItems.length }}</summary>
      <div class="group-content">
        <div v-if="municipalities.acceptedRequests.value.length" class="request-list">
          <article v-for="request in municipalities.acceptedRequests.value" :key="request.id" class="agreement-card">
            <div class="request-top"><span class="request-city">{{ request.municipalityName }}</span><small v-if="relationFor(request.municipalityCode)">Relation {{ relationFor(request.municipalityCode)?.score }}/100</small></div>
            <strong>{{ requestTitle(request.kind) }}</strong>
            <p>{{ requestDescription(request) }}</p>
            <small>À réaliser avant le Jour {{ request.completionDeadlineDay ?? '—' }} · aide estimée {{ money(request.subsidyAmount) }}</small>
          </article>
        </div>
        <div v-if="otherAttentionAlerts.length || informationItems.length" class="info-list compact-list">
          <button v-for="item in [...otherAttentionAlerts, ...informationItems]" :key="item.id" type="button" class="info-card" :class="item.severity === 'INFO' ? 'sev-info' : `sev-${item.severity.toLowerCase()}`" @click="focusInfo(item)">
            <div class="info-meta"><span>{{ item.severity === 'INFO' ? 'Info' : 'Suivi' }}</span><span>{{ categoryLabel(item.category) }}</span></div>
            <strong>{{ item.title }}</strong><p>{{ item.description }}</p>
          </button>
        </div>
        <div v-if="!municipalities.acceptedRequests.value.length && !otherAttentionAlerts.length && !informationItems.length" class="quiet">Aucun dossier en cours.</div>
      </div>
    </details>

    <details class="event-group">
      <summary>Historique</summary>
      <div class="group-content history">
        <div v-for="request in municipalities.recentResolvedRequests.value" :key="`municipality-${request.id}`"><strong>{{ request.municipalityName }} · {{ requestTitle(request.kind) }}</strong><small>Jour {{ request.resolvedDay ?? '—' }} · {{ requestStatusLabel(request.status) }}<template v-if="request.status === 'COMPLETED'"> · {{ money(request.subsidyAmount) }}</template></small></div>
        <div v-for="entry in events.recentHistory.value" :key="entry.id"><strong>{{ entry.eyebrow ? `${entry.eyebrow} · ` : '' }}{{ entry.title }}</strong><small>Jour {{ entry.resolvedDay }} · {{ entry.status === 'RESOLVED' ? entry.choiceLabel : 'Expiré sans décision' }}<template v-if="entry.balanceImpact"> · {{ entry.balanceImpact > 0 ? '+' : '' }}{{ money(entry.balanceImpact) }}</template></small></div>
        <div v-for="entry in roast.recentHistory.value" :key="`roast-${entry.id}`"><strong>{{ entry.category === 'ASSISTANT' ? 'CLU Assistant' : 'CLU Roast' }} · {{ entry.title }}</strong><small>Jour {{ entry.day }} · {{ entry.message }}</small></div>
        <div v-if="!municipalities.recentResolvedRequests.value.length && !events.recentHistory.value.length && !roast.recentHistory.value.length" class="quiet">Aucun historique pour le moment.</div>
      </div>
    </details>

    <div v-if="negotiationRequest" class="negotiation-backdrop" role="presentation" @click.self="closeNegotiation">
      <section class="negotiation-dialog" role="dialog" aria-modal="true" aria-labelledby="negotiation-title" tabindex="-1" @keydown.esc.prevent="closeNegotiation">
        <div class="negotiation-dialog-head"><div><span class="eyebrow">Négociation</span><h3 id="negotiation-title">{{ negotiationRequest.municipalityName }}</h3></div><button type="button" aria-label="Fermer" @click="closeNegotiation">×</button></div>
        <p>Budget initial proposé par la ville : <strong>{{ money(negotiationRequest.subsidyAmount) }}</strong></p>
        <label class="negotiation-slider">Votre proposition <strong>{{ money(negotiationAmountValue) }}</strong><input v-model.number="negotiationAmountValue" type="range" min="0" :max="negotiationMax" step="100000"></label>
        <div v-if="negotiationResponse" class="negotiation-response" :class="`status-${negotiationResponse.status.toLowerCase()}`">{{ negotiationResponse.message }}</div>
        <div class="dialog-actions">
          <button v-if="negotiationResponse?.status === 'COUNTERED'" class="accept" type="button" @click="acceptCounterOffer">Accepter {{ money(negotiationRequest.subsidyAmount) }}</button>
          <button v-if="!negotiationResponse || negotiationResponse.status === 'COUNTERED'" class="negotiate" type="button" @click="proposeNegotiation">{{ negotiationResponse?.status === 'COUNTERED' ? 'Dernière contre-proposition' : 'Proposer' }}</button>
          <button type="button" @click="closeNegotiation">{{ negotiationResponse ? 'Fermer' : 'Annuler' }}</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.events-panel{display:grid;gap:24px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:3px 0 0;font-size:24px}.counter{font-size:11px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.07)}.counter.danger{background:rgba(205,73,73,.16);color:#ff9b9b}.daily-pulse{padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.035);display:grid;gap:10px}.pulse-head{display:flex;justify-content:space-between;align-items:center}.pulse-head span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.5}.pulse-head strong{font-size:13px}.daily-pulse p{margin:0;font-size:12px;line-height:1.5;opacity:.7}.pulse-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pulse-grid>div{padding:9px;border-radius:9px;background:rgba(255,255,255,.035);display:grid;gap:2px}.pulse-grid span{font-size:9px;opacity:.5}.pulse-grid strong{font-size:13px}.tone-critical{border-left:3px solid #e35f5f}.tone-warning{border-left:3px solid #e5aa55}.tone-good{border-left:3px solid #55ca87}.tone-info{border-left:3px solid #65c9dc}.command-section{display:grid;gap:10px}.sub-head{display:grid;gap:2px}.sub-head small,.decision-description{font-size:11px;opacity:.58}.quiet{font-size:12px;opacity:.7;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:11px}.info-list,.choice-list,.request-list,.history{display:grid;gap:9px}.info-card,.choice-list button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;border-radius:12px;padding:12px;text-align:left;display:grid;gap:5px;cursor:pointer}.info-card:hover{background:rgba(255,255,255,.06)}.info-card p,.request-list p{margin:0;font-size:12px;line-height:1.45;opacity:.66}.info-meta{display:flex;justify-content:space-between;gap:8px;font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.52}.open-hint{font-size:10px;color:#87dfe6;margin-top:2px}.sev-critical{border-color:rgba(255,105,105,.43);background:rgba(174,54,54,.07)}.sev-warning{border-color:rgba(255,190,90,.3)}.sev-info{border-color:rgba(92,190,216,.2)}.compact-list{gap:6px}.choice-list small{opacity:.6;margin-top:3px}.request-list article{padding:13px;border-radius:12px;background:rgba(255,255,255,.035);display:grid;gap:6px}.request-city{font-size:9px;text-transform:uppercase;letter-spacing:.12em;opacity:.55}.request-list article>div{display:flex;gap:8px;margin-top:7px}.request-list button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer}.decision-row .accept{background:rgba(48,170,102,.18);border-color:rgba(77,220,132,.4);color:#9aefb9}.decision-row .negotiate{background:rgba(218,164,57,.16);border-color:rgba(239,190,80,.4);color:#f1cf79}.decision-row .refuse{background:rgba(191,67,67,.14);border-color:rgba(238,96,96,.38);color:#ff9a9a}.negotiation-row label{width:100%;display:grid;gap:6px;font-size:10px;opacity:.72}.negotiation-row input{background:#121c23;color:#edf6f7;color-scheme:dark;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:9px}.negotiation-note{font-size:10px;color:#f0c36d}.negotiation-note.success{color:#8ee1ad}.history>div{display:grid;padding:9px;border-radius:8px;background:rgba(255,255,255,.03)}.roast-history>div{border-left:2px solid rgba(114,216,223,.55)}.history small{opacity:.5;margin-top:2px}details{border-top:1px solid rgba(255,255,255,.07);padding-top:14px}summary{cursor:pointer;font-weight:700;margin-bottom:12px}@media(max-width:520px){.pulse-grid{grid-template-columns:1fr}}
.negotiation-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(4,10,14,.72);display:grid;place-items:center;padding:20px}.negotiation-dialog{width:min(520px,100%);border:1px solid rgba(255,255,255,.14);border-radius:18px;background:#101920;padding:20px;display:grid;gap:16px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.negotiation-dialog-head{display:flex;justify-content:space-between;align-items:flex-start}.negotiation-dialog-head h3{margin:3px 0 0}.negotiation-dialog-head button{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}.negotiation-slider{display:grid;gap:10px;font-size:12px}.negotiation-slider input{width:100%}.negotiation-response{padding:12px;border-radius:10px;background:rgba(255,255,255,.06);font-size:12px}.status-accepted{border-left:3px solid #55ca87}.status-countered{border-left:3px solid #e5aa55}.status-withdrawn,.status-refused{border-left:3px solid #e35f5f}.dialog-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.dialog-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:9px 12px;cursor:pointer}.dialog-actions .accept{background:rgba(48,170,102,.18)}.dialog-actions .negotiate{background:rgba(218,164,57,.16)}.event-group{border-top:1px solid rgba(255,255,255,.07);padding-top:14px}.event-group--priority{border-color:rgba(229,170,85,.22)}.group-content{display:grid;gap:12px}.decision-block{display:grid;gap:9px;padding:12px;border-radius:12px;background:rgba(229,170,85,.06);border:1px solid rgba(229,170,85,.18)}.funding-note{display:block;margin-top:3px;font-size:9px;line-height:1.45;opacity:.5}
</style>
