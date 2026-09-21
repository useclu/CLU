<script setup lang="ts">
import { currentGameLocaleTag } from '../../../config/i18n'
import { computed, reactive, ref } from 'vue'
import { GAME_TRANSPORT_MODES } from '../../../config/transportModes'
import { GAME_FINE_AMOUNT } from '../../../config/inspection'
import type { GameFareManagementMode, GameSubscriptionPricing } from '../../../types/fares'
import type { GameTransportMode } from '../../../types/network'
import { useGameEconomy } from '../../../composables/useGameEconomy'
import { useGameFares } from '../../../composables/useGameFares'
import { useGameNetwork } from '../../../composables/useGameNetwork'
import { useGameSimulation } from '../../../composables/useGameSimulation'
import { useGameAnalytics } from '../../../composables/useGameAnalytics'

const economy = useGameEconomy()
const fares = useGameFares()
const network = useGameNetwork()
const simulation = useGameSimulation()
const analytics = useGameAnalytics()

const local = reactive({ borrow: 250_000_000, repay: 50_000_000 })
const borrowFeedback = ref<{ tone: 'ok' | 'error'; message: string } | null>(null)
const borrowExceedsCapacity = computed(() => local.borrow > economy.availableCredit.value)
const publicFundingDaysRemaining = computed(() => Math.max(0, economy.publicFundingNextDay.value - economy.currentDay.value))

const weekdays = [
  { index: 1, label: 'Lun' }, { index: 2, label: 'Mar' }, { index: 3, label: 'Mer' },
  { index: 4, label: 'Jeu' }, { index: 5, label: 'Ven' }, { index: 6, label: 'Sam' }, { index: 0, label: 'Dim' },
]

const recentFinancialSummary = computed(() => {
  const days = analytics.recentDays.value
  return {
    days: days.length,
    revenue: days.reduce((total, day) => total + day.revenue, 0),
    operatingCost: days.reduce((total, day) => total + day.operatingCost, 0),
    netResult: days.reduce((total, day) => total + day.netResult, 0),
    passengers: days.reduce((total, day) => total + day.passengers, 0),
  }
})

function money(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
function integer(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value) }
function percent(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'percent', maximumFractionDigits: 0 }).format(value) }
function n(event: Event) { return Number((event.target as HTMLInputElement).value) }
function checked(event: Event) { return Boolean((event.target as HTMLInputElement).checked) }
async function handleBorrow() {
  const result = await economy.borrow(local.borrow)
  borrowFeedback.value = { tone: result.ok ? 'ok' : 'error', message: result.message }
}
function useMaximumBorrow() {
  local.borrow = Math.max(0, Math.floor(economy.availableCredit.value))
  borrowFeedback.value = null
}

async function subscriptionEnabled(kind: keyof GameSubscriptionPricing, event: Event) { await fares.setSubscriptionEnabled(kind, checked(event)) }
async function discountEnabled(kind: 'student' | 'reduced' | 'weekend', event: Event) { await fares.setDiscount(kind, checked(event)) }
async function compensationEnabled(event: Event) { await fares.setCompensation(checked(event)) }
async function outsideTicketEnabled(event: Event) { await fares.setOutsideTerritoryTicketEnabled(checked(event)) }
async function mode(next: GameFareManagementMode) { await fares.setManagementMode(next) }
async function ticketMode(modeValue: GameTransportMode, event: Event) { await fares.setTicketPrice(modeValue, n(event)) }
async function lineTicket(lineId: string, event: Event) { await fares.setLineTicketPrice(lineId, n(event)) }
function lineFareEnabled(lineId: string) { return Number.isFinite(fares.customPolicy.value.lineTicketPrices[lineId]) }
function inheritedLineTicketPrice(line: { mode: GameTransportMode }) {
  if (fares.managementMode.value === 'UNIFIED') return fares.customPolicy.value.unifiedTicketPrice
  return fares.customPolicy.value.ticketPrices[line.mode]
}
async function toggleLineFare(line: { id: string; mode: GameTransportMode }, event: Event) {
  if (checked(event)) await fares.setLineTicketPrice(line.id, inheritedLineTicketPrice(line))
  else await fares.clearLineTicketPrice(line.id)
}
async function subscription(kind: keyof GameSubscriptionPricing, event: Event) { await fares.setSubscriptionPrice(kind, n(event)) }
function transactionLabel(kind: string) {
  const labels: Record<string, string> = {
    LINE_PROJECT: 'Construction de ligne', LINE_MODIFICATION: 'Modification de ligne', STATION_CONSTRUCTION: 'Station', SEGMENT_CONSTRUCTION: 'Infrastructure',
    VEHICLE_PURCHASE: 'Achat matériel', VEHICLE_SALE: 'Revente matériel', FLEET_OVERHAUL: 'Remise à neuf', FLEET_UPGRADE: 'Amélioration matériel', STATION_UPGRADE: 'Amélioration station',
    OBJECTIVE_REWARD: 'Objectif', MUNICIPALITY_SUBSIDY: 'Subvention commune', PUBLIC_DEVELOPMENT_GRANT: 'Dotation publique', PASSENGER_COMPENSATION: 'Compensation voyageurs', DEBT_BORROW: 'Emprunt', DEBT_REPAYMENT: 'Remboursement', DEBT_INTEREST: 'Intérêts', DEBT_PENALTY: 'Pénalité de dette',
  }
  return labels[kind] ?? kind
}
</script>

<template>
  <section class="finance-panel">
    <div class="section-head"><div><span class="eyebrow">Argent uniquement</span><h2>Finances</h2></div><strong :class="{ negative: !economy.unlimitedMoney.value && economy.balance.value < 0 }">{{ economy.unlimitedMoney.value ? '∞ · Triche' : money(economy.balance.value) }}</strong></div>
    <div v-if="economy.unlimitedMoney.value" class="cheat-info"><strong>⚡ Triche activée</strong><span>Les coûts, recettes et investissements restent calculés pour information, mais les dépenses ne réduisent pas votre trésorerie et les emprunts sont inutiles.</span></div>

    <div class="summary-grid">
      <div><span>Recettes d’exploitation</span><strong>{{ money(economy.totalOperatingRevenue.value) }}</strong></div>
      <div><span>Exploitation cumulée</span><strong>{{ money(economy.totalOperatingCosts.value) }}</strong></div>
      <div><span>Investissements</span><strong>{{ money(economy.totalInvestment.value) }}</strong></div>
      <div><span>Dette</span><strong>{{ money(economy.debtPrincipal.value) }}</strong></div>
      <div><span>Dotations publiques</span><strong>{{ money(economy.totalPublicDevelopmentFunding.value) }}</strong></div>
      <div><span>Subventions communes</span><strong>{{ money(economy.totalSubsidies.value) }}</strong></div>
      <div><span>Récompenses objectifs</span><strong>{{ money(economy.totalObjectiveRewards.value) }}</strong></div>
    </div>

    <details>
      <summary>Résultat du jour · filtre réseau</summary>
      <div class="scope-row">
        <button type="button" :class="{ active: analytics.scope.value === 'ALL' }" @click="analytics.selectAll()">Tous</button>
        <button v-for="line in network.lines.value" :key="line.id" type="button" :class="{ active: analytics.effectiveLineIds.value.includes(line.id) && analytics.scope.value === 'CUSTOM' }" @click="analytics.toggleLine(line.id)"><i :style="{ background: line.color }" />{{ line.shortCode }}</button>
      </div>
      <div class="summary-grid">
        <div><span>Voyageurs</span><strong>{{ integer(analytics.aggregate.value.passengers) }}</strong></div>
        <div><span>Recettes</span><strong>{{ money(analytics.aggregate.value.revenue) }}</strong></div>
        <div><span>Charges</span><strong>{{ money(analytics.aggregate.value.operatingCost) }}</strong></div>
        <div><span>Résultat</span><strong :class="{ negative: analytics.aggregate.value.netResult < 0 }">{{ money(analytics.aggregate.value.netResult) }}</strong></div>
        <div><span>Fraude perdue</span><strong>{{ money(analytics.aggregate.value.fraudRevenueLoss) }}</strong></div>
        <div><span>Amendes</span><strong>{{ money(analytics.aggregate.value.fineRevenue) }}</strong></div>
      </div>
    </details>

    <details v-if="recentFinancialSummary.days > 1">
      <summary>Bilan des {{ recentFinancialSummary.days }} derniers jours</summary>
      <div class="summary-grid">
        <div><span>Voyageurs cumulés</span><strong>{{ integer(recentFinancialSummary.passengers) }}</strong></div>
        <div><span>Recettes</span><strong>{{ money(recentFinancialSummary.revenue) }}</strong></div>
        <div><span>Charges</span><strong>{{ money(recentFinancialSummary.operatingCost) }}</strong></div>
        <div><span>Résultat cumulé</span><strong :class="{ negative: recentFinancialSummary.netResult < 0 }">{{ money(recentFinancialSummary.netResult) }}</strong></div>
      </div>
      <p class="muted">Cette vue respecte le filtre réseau sélectionné ci-dessus et permet de distinguer une mauvaise journée d’une tendance durable.</p>
    </details>

    <details class="public-funding">
      <summary>Financement public du développement</summary>
      <p class="muted">Les billets et abonnements font vivre l’exploitation. Les grands investissements sont aussi soutenus par des dotations publiques, les communes, les objectifs et le crédit. La dotation publique est recalculée selon le réseau réel : elle n’est versée qu’après l’ouverture d’au moins une ligne.</p>
      <div class="funding-hero">
        <div><span>Prochaine dotation</span><strong>{{ publicFundingDaysRemaining === 0 ? 'Aujourd’hui' : `Dans ${publicFundingDaysRemaining} jour${publicFundingDaysRemaining > 1 ? 's' : ''}` }}</strong><small>Jour {{ economy.publicFundingNextDay.value }}</small></div>
        <div><span>Estimation actuelle</span><strong>{{ economy.publicFundingPreview.value.amount > 0 ? money(economy.publicFundingPreview.value.amount) : 'Après ouverture' }}</strong></div>
        <div><span>Dernière dotation</span><strong>{{ economy.lastPublicFundingDay.value ? money(economy.lastPublicFundingAmount.value) : 'Aucune' }}</strong><small v-if="economy.lastPublicFundingDay.value">Jour {{ economy.lastPublicFundingDay.value }}</small></div>
      </div>
      <div v-if="economy.publicFundingPreview.value.breakdown" class="funding-breakdown">
        <div><span>Socle public</span><b>+{{ money(economy.publicFundingPreview.value.breakdown.base) }}</b></div>
        <div><span>Taille du réseau</span><b>+{{ money(economy.publicFundingPreview.value.breakdown.network) }}</b></div>
        <div><span>Territoire desservi</span><b>+{{ money(economy.publicFundingPreview.value.breakdown.territory) }}</b></div>
        <div><span>Fréquentation</span><b>+{{ money(economy.publicFundingPreview.value.breakdown.passengers) }}</b></div>
        <div><span>Qualité du service</span><b :class="{ negative: economy.publicFundingPreview.value.breakdown.serviceQuality < 0 }">{{ economy.publicFundingPreview.value.breakdown.serviceQuality >= 0 ? '+' : '−' }}{{ money(Math.abs(economy.publicFundingPreview.value.breakdown.serviceQuality)) }}</b></div>
        <div><span>Santé d’exploitation</span><b :class="{ negative: economy.publicFundingPreview.value.breakdown.financialHealth < 0 }">{{ economy.publicFundingPreview.value.breakdown.financialHealth >= 0 ? '+' : '−' }}{{ money(Math.abs(economy.publicFundingPreview.value.breakdown.financialHealth)) }}</b></div>
        <div v-if="economy.publicFundingPreview.value.breakdown.debtAdjustment !== 0"><span>Dette élevée</span><b class="negative">−{{ money(Math.abs(economy.publicFundingPreview.value.breakdown.debtAdjustment)) }}</b></div>
      </div>
      <p class="muted">Le profil économique de la partie applique ensuite son multiplicateur. Les aides communales sont séparées : leur montant final dépend désormais du mode et du coût du projet réellement livré.</p>
    </details>

    <details>
      <summary>Tarification</summary>
      <p class="muted">Choisissez le niveau de contrôle. Le mode guidé reste disponible ; les autres modes donnent une autonomie totale.</p>
      <div class="mode-tabs">
        <button type="button" :aria-pressed="fares.managementMode.value === 'GUIDED'" :class="{ active: fares.managementMode.value === 'GUIDED' }" @click="mode('GUIDED')">Guidé</button>
        <button type="button" :aria-pressed="fares.managementMode.value === 'UNIFIED'" :class="{ active: fares.managementMode.value === 'UNIFIED' }" @click="mode('UNIFIED')">Prix unifié</button>
        <button type="button" :aria-pressed="fares.managementMode.value === 'BY_MODE' || fares.managementMode.value === 'BY_LINE'" :class="{ active: fares.managementMode.value === 'BY_MODE' || fares.managementMode.value === 'BY_LINE' }" @click="mode('BY_MODE')">Par mode</button>
      </div>

      <div v-if="fares.managementMode.value === 'GUIDED'" class="guided-grid">
        <button v-for="level in fares.levels" :key="level.value" type="button" :aria-pressed="fares.level.value === level.value" :class="{ active: fares.level.value === level.value }" @click="fares.setLevel(level.value)"><strong>{{ level.label }}</strong><small>{{ level.description }}</small></button>
      </div>

      <label v-else-if="fares.managementMode.value === 'UNIFIED'" class="field">Billet réseau (€)<input type="number" min="0" step="0.1" :value="fares.customPolicy.value.unifiedTicketPrice" @change="fares.setUnifiedTicketPrice(n($event))"></label>

      <div v-else-if="fares.managementMode.value === 'BY_MODE' || fares.managementMode.value === 'CUSTOM' || fares.managementMode.value === 'BY_LINE'" class="price-grid">
        <label v-for="transport in GAME_TRANSPORT_MODES" :key="transport.value">{{ transport.label }}<input type="number" min="0" step="0.1" :value="fares.customPolicy.value.ticketPrices[transport.value]" @change="ticketMode(transport.value, $event)"></label>
      </div>

      <template v-if="fares.managementMode.value !== 'GUIDED'">
      <h4>Prix selon le jour</h4>
      <div class="weekday-grid">
        <label v-for="weekday in weekdays" :key="weekday.index"><span>{{ weekday.label }}</span><input type="number" min="0" step="0.05" :value="fares.customPolicy.value.weekdayMultipliers[String(weekday.index)]" @change="fares.setWeekdayMultiplier(weekday.index, n($event))"><small>× tarif</small></label>
      </div>
      <p class="muted">Exemple : 0,60 le mercredi = 40 % moins cher ce jour-là. Le calendrier du jeu est réel : {{ simulation.currentDayLabel.value }}.</p>
      </template>
      <p v-else class="muted">En mode Guidé, CLU applique directement le profil tarifaire choisi. Les exceptions par ligne restent disponibles ci-dessous sans modifier le reste du réseau.</p>

      <div v-if="network.lines.value.length" class="line-fare-exceptions">
        <div class="line-fare-exceptions__head"><strong>Tarifs spécifiques par ligne</strong><small>Facultatif · une exception ne change jamais la politique tarifaire des autres lignes.</small></div>
        <label v-for="line in network.lines.value" :key="line.id" class="line-fare-row">
          <span class="line-fare-name"><i :style="{ background: line.color }" />{{ line.shortCode }} · <span data-i18n-skip>{{ line.name }}</span></span>
          <span class="line-fare-controls"><input type="checkbox" :checked="lineFareEnabled(line.id)" @change="toggleLineFare(line, $event)"><small>{{ lineFareEnabled(line.id) ? 'Tarif spécifique' : 'Tarif réseau' }}</small><input v-if="lineFareEnabled(line.id)" type="number" min="0" step="0.1" :value="fares.customPolicy.value.lineTicketPrices[line.id]" @change="lineTicket(line.id, $event)"></span>
        </label>
      </div>
    </details>

    <details v-if="fares.managementMode.value !== 'GUIDED'">
      <summary>Abonnements, réductions & remboursements</summary>
      <div class="offer-grid">
        <label>Pass journée<input type="number" min="0" step="0.5" :value="fares.customPolicy.value.subscriptions.day.price" @change="subscription('day', $event)"><input type="checkbox" :checked="fares.customPolicy.value.subscriptions.day.enabled" @change="subscriptionEnabled('day', $event)"></label>
        <label>Hebdomadaire<input type="number" min="0" step="0.5" :value="fares.customPolicy.value.subscriptions.week.price" @change="subscription('week', $event)"><input type="checkbox" :checked="fares.customPolicy.value.subscriptions.week.enabled" @change="subscriptionEnabled('week', $event)"></label>
        <label>Mensuel<input type="number" min="0" step="1" :value="fares.customPolicy.value.subscriptions.month.price" @change="subscription('month', $event)"><input type="checkbox" :checked="fares.customPolicy.value.subscriptions.month.enabled" @change="subscriptionEnabled('month', $event)"></label>
        <label>Annuel<input type="number" min="0" step="10" :value="fares.customPolicy.value.subscriptions.year.price" @change="subscription('year', $event)"><input type="checkbox" :checked="fares.customPolicy.value.subscriptions.year.enabled" @change="subscriptionEnabled('year', $event)"></label>
      </div>
      <div class="switch-list">
        <label><input type="checkbox" :checked="fares.customPolicy.value.discounts.studentEnabled" @change="discountEnabled('student', $event)"> Tarif étudiant · réduction {{ percent(fares.customPolicy.value.discounts.studentDiscountRate) }}</label>
        <label><input type="checkbox" :checked="fares.customPolicy.value.discounts.reducedEnabled" @change="discountEnabled('reduced', $event)"> Tarif réduit · {{ percent(fares.customPolicy.value.discounts.reducedDiscountRate) }}</label>
        <label><input type="checkbox" :checked="fares.customPolicy.value.discounts.weekendDiscountEnabled" @change="discountEnabled('weekend', $event)"> Réduction week-end · {{ percent(fares.customPolicy.value.discounts.weekendDiscountRate) }}</label>
        <label><input type="checkbox" :checked="fares.customPolicy.value.compensation.enabled" @change="compensationEnabled($event)"> Remboursement automatique si qualité &lt; {{ fares.customPolicy.value.compensation.disruptionQualityThreshold }}/100 · {{ percent(fares.customPolicy.value.compensation.defaultRefundRate) }}</label>
      </div>
      <label class="field">Billet hors territoire (€)<input type="number" min="0" step="0.1" :value="fares.customPolicy.value.outsideTerritoryTicketPrice" @change="fares.setOutsideTerritoryTicketPrice(n($event))"><input type="checkbox" :checked="fares.customPolicy.value.outsideTerritoryTicketEnabled" @change="outsideTicketEnabled($event)"></label>
    </details>

    <details v-if="!economy.unlimitedMoney.value">
      <summary>Financement & dette</summary>
      <p class="muted">Le crédit complète le financement public, mais ne doit pas être la seule façon de progresser. Le plafond dépend du réseau construit, de ses recettes d’exploitation, des investissements déjà réalisés et du score de crédit. Maximum : <b>{{ economy.borrowLimitPerDay }} emprunts par jour</b>.</p>
      <div class="credit-status" :class="`status-${economy.insolvencyStatus.value.toLowerCase()}`">
        <div><span>Capacité totale</span><strong>{{ money(economy.creditLimit.value) }}</strong></div>
        <div><span>Encore disponible</span><strong>{{ money(economy.availableCredit.value) }}</strong></div>
        <div><span>Emprunts aujourd’hui</span><strong>{{ economy.borrowsToday.value }}/{{ economy.borrowLimitPerDay }}</strong></div>
        <div><span>Score crédit</span><strong>{{ economy.creditScore.value }}/100</strong></div>
        <div><span>Échéance</span><strong>{{ economy.debtNextPaymentDay.value ? `Jour ${economy.debtNextPaymentDay.value}` : 'Aucune' }}</strong></div>
        <div><span>Remboursement minimum</span><strong>{{ money(economy.debtMinimumPayment.value) }}</strong></div>
      </div>
      <div class="debt-row debt-borrow-row"><input v-model.number="local.borrow" type="number" min="1000000" step="10000000"><button type="button" class="max-borrow" :disabled="economy.availableCredit.value <= 0" @click="useMaximumBorrow">Max</button><button type="button" :disabled="economy.availableCredit.value <= 0 || economy.remainingBorrowsToday.value <= 0 || economy.insolvencyStatus.value === 'BANKRUPT'" @click="handleBorrow">Emprunter</button></div>
      <p v-if="borrowExceedsCapacity && economy.availableCredit.value > 0" class="borrow-inline-error">Montant demandé trop élevé · maximum disponible : {{ money(economy.availableCredit.value) }}</p>
      <p v-if="economy.remainingBorrowsToday.value <= 0" class="borrow-inline-error">Vous avez utilisé les {{ economy.borrowLimitPerDay }} emprunts autorisés pour le Jour {{ economy.currentDay.value }}. Le compteur se réinitialise au jour suivant.</p>
      <p v-if="borrowFeedback" class="borrow-feedback" role="status" aria-live="polite" :class="`feedback-${borrowFeedback.tone}`">{{ borrowFeedback.message }}</p>
      <div class="debt-row"><input v-model.number="local.repay" type="number" min="1000000" step="10000000"><button type="button" :disabled="economy.debtPrincipal.value <= 0 || economy.balance.value <= 0" @click="economy.repay(local.repay)">Rembourser</button></div>
      <div class="summary-grid">
        <div><span>Capital restant</span><strong>{{ money(economy.debtPrincipal.value) }}</strong></div>
        <div><span>Minimum de la période</span><strong>{{ money(economy.debtMinimumPayment.value) }}</strong></div>
        <div><span>Déjà remboursé</span><strong>{{ money(economy.debtPaidThisPeriod.value) }}</strong></div>
        <div><span>Échéances manquées</span><strong>{{ economy.debtMissedPayments.value }}</strong></div>
        <div><span>Intérêts payés</span><strong>{{ money(economy.totalInterestPaid.value) }}</strong></div>
        <div><span>Pénalités</span><strong>{{ money(economy.totalDebtPenalties.value) }}</strong></div>
      </div>
      <p v-if="economy.insolvencyStatus.value === 'WARNING'" class="debt-warning">Attention : votre situation financière se dégrade. Respectez l’échéance ou réduisez la dette pour éviter une insolvabilité.</p>
      <p v-if="economy.insolvencyStatus.value === 'BANKRUPT'" class="debt-bankrupt">Insolvabilité : la dette est devenue irrécupérable après plusieurs échéances manquées. Les nouveaux investissements sont bloqués.</p>
    </details>

    <details>
      <summary>Billetterie, fraude & contrôle — tous filtres</summary>
      <div class="summary-grid">
        <div><span>Fraudeurs estimés</span><strong>{{ integer(analytics.aggregate.value.fraudPassengers) }}</strong></div>
        <div><span>Verbalisés</span><strong>{{ integer(analytics.aggregate.value.detectedFraudPassengers) }}</strong></div>
        <div><span>Amendes payées</span><strong>{{ integer(analytics.aggregate.value.finePayingPassengers) }}</strong></div>
        <div><span>Amende unitaire</span><strong>{{ GAME_FINE_AMOUNT }} €</strong></div>
        <div><span>Recettes amendes</span><strong>{{ money(analytics.aggregate.value.fineRevenue) }}</strong></div>
        <div><span>Coût contrôle</span><strong>{{ money(analytics.aggregate.value.controlCost) }}</strong></div>
      </div>
    </details>

    <details>
      <summary>Historique financier</summary>
      <div class="transactions">
        <div v-for="transaction in economy.recentTransactions.value" :key="transaction.id"><span><strong>{{ transactionLabel(transaction.kind) }}</strong><small>{{ transaction.lineName || transaction.note || 'Réseau' }}</small></span><b :class="{ income: transaction.amount < 0 }">{{ transaction.amount < 0 ? '+' : '−' }}{{ money(Math.abs(transaction.amount)) }}</b></div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.finance-panel{display:grid;gap:28px}.section-head,.debt-row,.scope-row,.mode-tabs{display:flex;align-items:center;gap:8px}.section-head{justify-content:space-between}.eyebrow{font-size:calc(11px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(24px * var(--clu-text-scale,1))}.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.summary-grid>div{padding:12px;border-radius:10px;background:rgba(255,255,255,.045);display:grid;gap:3px}.summary-grid span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.55}.summary-grid strong{font-size:calc(14px * var(--clu-text-scale,1))}.negative{color:#ff9a9a!important}.cheat-info{display:grid;gap:4px;padding:12px 14px;border:1px solid rgba(245,199,82,.25);border-radius:11px;background:rgba(245,199,82,.08);color:#f3d57e}.cheat-info span{font-size:calc(11px * var(--clu-text-scale,1));line-height:1.45;color:rgba(255,255,255,.62)}.scope-row,.mode-tabs{flex-wrap:wrap;margin:12px 0 16px}.scope-row button,.mode-tabs button,.guided-grid button,.debt-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:9px;padding:7px 10px;cursor:pointer}.scope-row button.active,.mode-tabs button.active,.guided-grid button.active{border-color:rgba(80,210,220,.5);background:rgba(80,210,220,.16)}.scope-row i,.line-price-list i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}.guided-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.guided-grid button{text-align:left;display:grid}.guided-grid small{opacity:.55;margin-top:3px}.price-grid,.weekday-grid,.offer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.price-grid label,.weekday-grid label,.offer-grid label,.field,.line-price-list label{font-size:calc(11px * var(--clu-text-scale,1));display:grid;gap:4px}.price-grid input,.weekday-grid input,.offer-grid input,.field input,.line-price-list input,.debt-row input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:inherit;border-radius:8px;padding:8px;min-width:0}.line-price-list{display:grid;gap:6px}.line-price-list label{grid-template-columns:1fr 100px;align-items:center}.switch-list{display:grid;gap:7px;margin:10px 0}.switch-list label{font-size:calc(12px * var(--clu-text-scale,1))}.muted{font-size:calc(12px * var(--clu-text-scale,1));opacity:.65;line-height:1.5}.credit-status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin:18px 0 20px}.credit-status>div{padding:12px;border-radius:10px;background:rgba(255,255,255,.04);display:grid;gap:2px}.credit-status span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.55}.status-warning{border-left:3px solid #e9a84f}.status-bankrupt{border-left:3px solid #d85c5c}.debt-warning,.debt-bankrupt{padding:10px;border-radius:9px;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.45}.debt-warning{background:rgba(229,158,58,.12);color:#f0c476}.debt-bankrupt{background:rgba(202,68,68,.14);color:#ff9c9c}.debt-row{margin:12px 0}.debt-row input{flex:1}.debt-borrow-row .max-borrow{flex:none}.borrow-inline-error,.borrow-feedback{margin:-5px 0 10px;padding:8px 10px;border-radius:8px;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4}.borrow-inline-error,.feedback-error{background:rgba(202,68,68,.12);color:#ffaaaa}.feedback-ok{background:rgba(61,177,111,.12);color:#9fe6bd}.funding-hero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.funding-hero>div{padding:11px;border-radius:10px;background:rgba(79,211,220,.06);border:1px solid rgba(79,211,220,.11);display:grid;gap:2px}.funding-hero span,.funding-hero small,.funding-breakdown span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.56}.funding-hero strong{font-size:calc(13px * var(--clu-text-scale,1))}.funding-breakdown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0 12px}.funding-breakdown>div{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border-radius:8px;background:rgba(255,255,255,.035);font-size:calc(10px * var(--clu-text-scale,1))}.funding-breakdown b{font-size:calc(10px * var(--clu-text-scale,1));color:#9fe6bd}.transactions{display:grid;gap:8px}.transactions>div{display:flex;justify-content:space-between;gap:12px;padding:11px;border-radius:9px;background:rgba(255,255,255,.035)}.transactions span{display:grid}.transactions small{opacity:.5}.income{color:#8de2b0}details{border-top:1px solid rgba(255,255,255,.07);padding-top:22px;margin-top:8px}details+details{margin-top:8px}summary{cursor:pointer;font-weight:700;margin-bottom:17px}h4{margin:18px 0 9px}.guided-grid,.price-grid,.weekday-grid,.offer-grid,.line-price-list,.switch-list{margin-bottom:16px}.line-fare-exceptions{display:grid;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}.line-fare-exceptions__head{display:grid;gap:3px}.line-fare-exceptions__head small{font-size:calc(10px * var(--clu-text-scale,1));opacity:.55}.line-fare-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border-radius:9px;background:rgba(255,255,255,.035)}.line-fare-name{display:flex;align-items:center;min-width:0;font-size:calc(11px * var(--clu-text-scale,1))}.line-fare-name i{width:8px;height:8px;border-radius:50%;margin-right:6px;flex:none}.line-fare-controls{display:flex;align-items:center;gap:7px}.line-fare-controls small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.58;white-space:nowrap}.line-fare-controls input[type=number]{width:86px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:inherit;border-radius:8px;padding:7px}.line-fare-controls input[type=checkbox]{accent-color:#50d2dc}
@media(max-width:640px){.price-grid,.weekday-grid,.offer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.funding-hero{grid-template-columns:1fr}.funding-breakdown{grid-template-columns:1fr}}
</style>
