<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref, watch } from 'vue'
import { useGameStatistics } from '../../composables/useGameStatistics'
import type { GameWeeklySnapshot } from '../../types/statistics'

const emit = defineEmits<{ close: [] }>()
const statistics = useGameStatistics()

type BilanTab = 'OVERVIEW' | 'WEEKS' | 'HISTORY'
type ChartMetric = 'PASSENGERS' | 'RESULT' | 'BALANCE' | 'DEBT' | 'QUALITY'

const tab = ref<BilanTab>('OVERVIEW')
const selectedWeek = ref<number>(statistics.currentWeekNumber.value)
const chartMetric = ref<ChartMetric>('PASSENGERS')

watch(statistics.currentWeekNumber, week => {
  if (!statistics.weeks.value.some(item => item.week === selectedWeek.value)) selectedWeek.value = week
})

const current = computed(() => statistics.save.value)
const totals = computed(() => statistics.totals.value)
const network = computed(() => statistics.currentNetwork.value)
const state = computed(() => statistics.state.value)
const weeks = computed(() => statistics.weeks.value)
const selectedSnapshot = computed(() => weeks.value.find(item => item.week === selectedWeek.value) ?? weeks.value.at(-1) ?? null)
const previousSnapshot = computed(() => {
  const selected = selectedSnapshot.value
  if (!selected) return null
  return [...weeks.value].filter(item => item.week < selected.week).sort((a, b) => b.week - a.week)[0] ?? null
})
const selectedEconomyFlow = computed(() => selectedSnapshot.value ? statistics.economyFlowFor(selectedSnapshot.value) : null)

function integer(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(Number(value))
}
function compact(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(currentGameLocaleTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
}
function money(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
}
function percent(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Math.round(Number(value) * 100)} %`
}
function score(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Math.round(Number(value))}/100`
}
function km(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 1 }).format(Number(value))} km`
}
function delta(currentValue: number | null | undefined, previousValue: number | null | undefined, format: 'number' | 'money' | 'points' = 'number') {
  if (!Number.isFinite(Number(currentValue)) || !Number.isFinite(Number(previousValue))) return null
  const diff = Number(currentValue) - Number(previousValue)
  if (Math.abs(diff) < 1e-9) return 'stable'
  const sign = diff > 0 ? '+' : '−'
  const magnitude = Math.abs(diff)
  if (format === 'money') return `${sign}${money(magnitude)}`
  if (format === 'points') return `${sign}${magnitude.toFixed(1)} pt${magnitude >= 2 ? 's' : ''}`
  return `${sign}${compact(magnitude)}`
}
function deltaTone(currentValue: number | null | undefined, previousValue: number | null | undefined, inverse = false) {
  if (!Number.isFinite(Number(currentValue)) || !Number.isFinite(Number(previousValue))) return ''
  const diff = Number(currentValue) - Number(previousValue)
  if (Math.abs(diff) < 1e-9) return 'neutral'
  const positive = inverse ? diff < 0 : diff > 0
  return positive ? 'positive' : 'negative'
}
function weekLabel(snapshot: GameWeeklySnapshot) {
  return snapshot.completed ? `Semaine ${snapshot.week}` : `Semaine ${snapshot.week} · en cours`
}

const chartOptions: { key: ChartMetric; label: string }[] = [
  { key: 'PASSENGERS', label: 'Voyageurs' },
  { key: 'RESULT', label: 'Résultat' },
  { key: 'BALANCE', label: 'Trésorerie' },
  { key: 'DEBT', label: 'Dette' },
  { key: 'QUALITY', label: 'Qualité' },
]

function chartValue(snapshot: GameWeeklySnapshot) {
  if (chartMetric.value === 'PASSENGERS') return snapshot.passengers
  if (chartMetric.value === 'RESULT') return snapshot.netResult
  if (chartMetric.value === 'BALANCE') return snapshot.balance
  if (chartMetric.value === 'DEBT') return snapshot.debt
  return snapshot.averageServiceQuality
}

const chartData = computed(() => weeks.value
  .map(snapshot => ({ snapshot, value: chartValue(snapshot) }))
  .filter((item): item is { snapshot: GameWeeklySnapshot; value: number } => Number.isFinite(Number(item.value))))

const chartGeometry = computed(() => {
  const data = chartData.value
  if (!data.length) return { points: '', dots: [] as { x: number; y: number; label: string; value: number }[], min: 0, max: 0 }
  const values = data.map(item => item.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const spread = Math.max(1, maxValue - minValue)
  const left = 18
  const right = 622
  const top = 18
  const bottom = 162
  const dots = data.map((item, index) => {
    const x = data.length === 1 ? (left + right) / 2 : left + (right - left) * index / (data.length - 1)
    const y = bottom - ((item.value - minValue) / spread) * (bottom - top)
    return { x, y, label: `S${item.snapshot.week}`, value: item.value }
  })
  return { points: dots.map(point => `${point.x},${point.y}`).join(' '), dots, min: minValue, max: maxValue }
})

function chartFormat(value: number) {
  if (chartMetric.value === 'BALANCE' || chartMetric.value === 'DEBT' || chartMetric.value === 'RESULT') return money(value)
  if (chartMetric.value === 'QUALITY') return `${Math.round(value)}/100`
  return compact(value)
}

const migrationNotice = computed(() => state.value?.migratedFromOlderSave && (state.value.trackingStartedDay ?? 1) > 1)
</script>

<template>
  <section class="bilan-shell" role="dialog" aria-modal="true" aria-labelledby="bilan-title">
    <header class="bilan-head">
      <div>
        <span class="eyebrow">Historique permanent</span>
        <h2 id="bilan-title">Bilan de la partie</h2>
        <p>Jour {{ statistics.day.value }} · Semaine {{ statistics.currentWeekNumber.value }} · chiffres conservés dans la sauvegarde.</p>
      </div>
      <button class="close" type="button" aria-label="Fermer le bilan" @click="emit('close')">×</button>
    </header>

    <nav class="bilan-tabs" role="tablist" aria-label="Sections du bilan">
      <button type="button" role="tab" :aria-selected="tab === 'OVERVIEW'" :class="{ active: tab === 'OVERVIEW' }" @click="tab = 'OVERVIEW'">Vue d’ensemble</button>
      <button type="button" role="tab" :aria-selected="tab === 'WEEKS'" :class="{ active: tab === 'WEEKS' }" @click="tab = 'WEEKS'">Semaines</button>
      <button type="button" role="tab" :aria-selected="tab === 'HISTORY'" :class="{ active: tab === 'HISTORY' }" @click="tab = 'HISTORY'">Histoire</button>
    </nav>

    <div class="bilan-scroll">
      <div v-if="migrationNotice" class="migration-note">
        <strong>Partie commencée avant la V28.</strong>
        <span>Les cumuls historiques (voyageurs, finances…) sont conservés. Les anciens détails hebdomadaires sont reconstruits quand les rapports existent ; la taille exacte du réseau semaine par semaine est suivie intégralement à partir du Jour {{ state?.trackingStartedDay }}.</span>
      </div>

      <template v-if="tab === 'OVERVIEW' && totals">
        <section class="hero-grid">
          <article><span>Voyageurs depuis le début</span><strong>{{ integer(totals.passengers) }}</strong><small>Somme de tous les voyageurs réellement transportés.</small></article>
          <article><span>Argent dépensé</span><strong>{{ money(totals.totalOutflow) }}</strong><small>Investissements + exploitation + intérêts + pénalités. Les remboursements de capital ne sont pas comptés deux fois.</small></article>
          <article><span>Réseau actuel</span><strong>{{ network.lineCount }} lignes · {{ network.stationCount }} stations</strong><small>{{ km(network.networkLengthKm) }} de tracés · {{ network.vehicleCount }} véhicules.</small></article>
          <article><span>Trésorerie / dette</span><strong>{{ money(totals.balance) }}</strong><small>Dette actuelle : {{ money(totals.debt) }}.</small></article>
        </section>

        <section class="bilan-section">
          <div class="section-title"><div><span class="eyebrow">Depuis le Jour 1</span><h3>Exploitation</h3></div><small>Les cumuls ne disparaissent pas quand l’historique quotidien court est nettoyé.</small></div>
          <div class="stat-grid">
            <article><span>Voyageurs transportés</span><b>{{ integer(totals.passengers) }}</b><small>Passagers montés à bord depuis le début.</small></article>
            <article><span>Voyageurs perdus</span><b>{{ integer(totals.lostPassengers) }}</b><small>Demande abandonnée faute de service/capacité.</small></article>
            <article><span>Recettes d’exploitation</span><b>{{ money(totals.operatingRevenue) }}</b><small>Billets, abonnements et recettes d’exploitation simulées.</small></article>
            <article><span>Coûts d’exploitation</span><b>{{ money(totals.operatingCosts) }}</b><small>Coût cumulé du fonctionnement quotidien du réseau.</small></article>
            <article><span>Amendes encaissées</span><b>{{ money(totals.fineRevenue) }}</b><small>Recettes issues du contrôle de fraude.</small></article>
            <article><span>Événements résolus</span><b>{{ integer(totals.eventsResolved) }}</b><small>Nombre de décisions d’événements prises depuis le début.</small></article>
          </div>
        </section>

        <section class="bilan-section">
          <div class="section-title"><div><span class="eyebrow">Patrimoine</span><h3>Construction du réseau</h3></div><small>Créé = projet réellement validé et lancé en travaux.</small></div>
          <div class="stat-grid">
            <article><span>Lignes créées</span><b>{{ integer(totals.linesLaunched) }}</b><small>Lignes dont les travaux ont été lancés.</small></article>
            <article><span>Lignes supprimées</span><b>{{ integer(totals.linesDeleted) }}</b><small>Lignes retirées au cours de la partie.</small></article>
            <article><span>Stations posées</span><b>{{ integer(totals.stationsBuilt) }}</b><small>Stations ajoutées lors des créations et modifications.</small></article>
            <article><span>Stations retirées</span><b>{{ integer(totals.stationsRemoved) }}</b><small>Stations supprimées lors des modifications/suppressions.</small></article>
            <article><span>Véhicules achetés</span><b>{{ integer(totals.vehiclesPurchased) }}</b><small>Matériel roulant acquis depuis le début.</small></article>
            <article><span>Véhicules vendus</span><b>{{ integer(totals.vehiclesSold) }}</b><small>Matériel retiré avec revente.</small></article>
          </div>
        </section>

        <section class="bilan-section">
          <div class="section-title"><div><span class="eyebrow">Flux financiers</span><h3>Argent de la partie</h3></div><small>Chaque chiffre correspond à une catégorie distincte afin d’éviter les doubles comptes.</small></div>
          <div class="stat-grid">
            <article><span>Investissements</span><b>{{ money(totals.investment) }}</b><small>Construction, modifications, matériel et améliorations.</small></article>
            <article><span>Aides communales</span><b>{{ money(totals.municipalityFunding) }}</b><small>Cofinancements versés par les communes.</small></article>
            <article><span>Dotations publiques</span><b>{{ money(totals.publicFunding) }}</b><small>Financement public périodique de développement.</small></article>
            <article><span>Récompenses d’objectifs</span><b>{{ money(totals.objectiveRewards) }}</b><small>Financement gagné en remplissant les objectifs.</small></article>
            <article><span>Intérêts payés</span><b>{{ money(totals.interestPaid) }}</b><small>Coût cumulé des intérêts de dette.</small></article>
            <article><span>Objectifs accomplis</span><b>{{ integer(totals.objectivesCompleted) }}</b><small>Objectifs dynamiques terminés avec succès.</small></article>
          </div>
        </section>

        <section v-if="state" class="bilan-section">
          <div class="section-title"><div><span class="eyebrow">Records</span><h3>Meilleures marques</h3></div><small>Le jour du record reste mémorisé.</small></div>
          <div class="records-grid">
            <article><span>Fréquentation quotidienne</span><b>{{ integer(state.records.dailyPassengers.value) }}</b><small>Jour {{ state.records.dailyPassengers.day }}</small></article>
            <article><span>Meilleur résultat quotidien</span><b>{{ money(state.records.dailyOperatingProfit.value) }}</b><small>Jour {{ state.records.dailyOperatingProfit.day }}</small></article>
            <article><span>Dette maximale</span><b>{{ money(state.records.highestDebt.value) }}</b><small>Jour {{ state.records.highestDebt.day }}</small></article>
            <article><span>Trésorerie maximale</span><b>{{ money(state.records.highestBalance.value) }}</b><small>Jour {{ state.records.highestBalance.day }}</small></article>
            <article><span>Longueur maximale</span><b>{{ km(state.records.networkLengthKm.value) }}</b><small>Jour {{ state.records.networkLengthKm.day }}</small></article>
            <article><span>Nombre maximal de lignes</span><b>{{ integer(state.records.lineCount.value) }}</b><small>Jour {{ state.records.lineCount.day }}</small></article>
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'WEEKS'">
        <section class="week-strip" aria-label="Historique par semaine">
          <button
            v-for="week in weeks"
            :key="week.week"
            :class="{ active: selectedWeek === week.week }"
            :aria-pressed="selectedWeek === week.week"
            type="button"
            @click="selectedWeek = week.week"
          >
            <strong>{{ weekLabel(week) }}</strong>
            <small>J{{ week.startDay }}–{{ week.endDay }}<template v-if="week.reconstructed"> · reconstituée</template></small>
          </button>
        </section>

        <section v-if="selectedSnapshot" class="week-focus">
          <div class="week-heading">
            <div><span class="eyebrow">Jours {{ selectedSnapshot.startDay }} à {{ selectedSnapshot.endDay }}</span><h3>{{ weekLabel(selectedSnapshot) }}</h3></div>
            <span v-if="selectedSnapshot.reconstructed" class="reconstructed">Historique partiel reconstitué</span>
            <span v-else-if="!selectedSnapshot.completed" class="ongoing">Semaine en cours</span>
            <span v-else class="complete">Semaine clôturée</span>
          </div>

          <div class="week-kpis">
            <article><span>Voyageurs</span><b>{{ integer(selectedSnapshot.passengers) }}</b><small v-if="previousSnapshot" :class="deltaTone(selectedSnapshot.passengers, previousSnapshot.passengers)">{{ delta(selectedSnapshot.passengers, previousSnapshot.passengers) }} vs S{{ previousSnapshot.week }}</small><small v-else>{{ selectedSnapshot.reportedDays }} jour(s) simulé(s)</small></article>
            <article><span>Résultat d’exploitation</span><b>{{ money(selectedSnapshot.netResult) }}</b><small v-if="previousSnapshot" :class="deltaTone(selectedSnapshot.netResult, previousSnapshot.netResult)">{{ delta(selectedSnapshot.netResult, previousSnapshot.netResult, 'money') }} vs S{{ previousSnapshot.week }}</small></article>
            <article><span>Qualité moyenne</span><b>{{ score(selectedSnapshot.averageServiceQuality) }}</b><small v-if="previousSnapshot" :class="deltaTone(selectedSnapshot.averageServiceQuality, previousSnapshot.averageServiceQuality)">{{ delta(selectedSnapshot.averageServiceQuality, previousSnapshot.averageServiceQuality, 'points') }}</small></article>
            <article><span>Demande satisfaite</span><b>{{ percent(selectedSnapshot.averageDemandSatisfaction) }}</b><small v-if="previousSnapshot" :class="deltaTone(selectedSnapshot.averageDemandSatisfaction, previousSnapshot.averageDemandSatisfaction)">{{ delta((selectedSnapshot.averageDemandSatisfaction ?? 0) * 100, (previousSnapshot.averageDemandSatisfaction ?? 0) * 100, 'points') }}</small></article>
            <article><span>Attente moyenne</span><b>{{ selectedSnapshot.averageWaitMinutes == null ? '—' : selectedSnapshot.averageWaitMinutes.toFixed(1) + ' min' }}</b><small v-if="previousSnapshot" :class="deltaTone(selectedSnapshot.averageWaitMinutes, previousSnapshot.averageWaitMinutes, true)">{{ delta(selectedSnapshot.averageWaitMinutes, previousSnapshot.averageWaitMinutes, 'points') }}</small></article>
            <article><span>Pic journalier</span><b>{{ integer(selectedSnapshot.peakPassengers) }}</b><small>{{ selectedSnapshot.peakPassengersDay ? 'Jour ' + selectedSnapshot.peakPassengersDay : 'Aucune circulation' }}</small></article>
          </div>

          <div class="week-two-columns">
            <article class="detail-card">
              <h4>Réseau à la fin de la période</h4>
              <dl>
                <div><dt>Lignes</dt><dd>{{ integer(selectedSnapshot.lineCount) }}</dd></div>
                <div><dt>En service</dt><dd>{{ integer(selectedSnapshot.operationalLineCount) }}</dd></div>
                <div><dt>Stations</dt><dd>{{ integer(selectedSnapshot.stationCount) }}</dd></div>
                <div><dt>Véhicules</dt><dd>{{ integer(selectedSnapshot.vehicleCount) }}</dd></div>
                <div><dt>Longueur</dt><dd>{{ km(selectedSnapshot.networkLengthKm) }}</dd></div>
                <div><dt>Communes desservies</dt><dd>{{ integer(selectedSnapshot.municipalitiesServed) }}</dd></div>
              </dl>
              <p v-if="selectedSnapshot.reconstructed">Les rapports d’exploitation ont pu être reconstruits, mais la composition exacte du réseau à cette ancienne date n’était pas stockée avant V28.</p>
            </article>

            <article class="detail-card">
              <h4>Finances de la semaine</h4>
              <dl v-if="selectedEconomyFlow">
                <div><dt>Investissements</dt><dd>{{ money(selectedEconomyFlow.investment) }}</dd></div>
                <div><dt>Recettes voyageurs</dt><dd>{{ money(selectedEconomyFlow.passengerRevenue) }}</dd></div>
                <div><dt>Coûts d’exploitation</dt><dd>{{ money(selectedEconomyFlow.operatingCosts) }}</dd></div>
                <div><dt>Aides communales</dt><dd>{{ money(selectedEconomyFlow.subsidies) }}</dd></div>
                <div><dt>Dotations publiques</dt><dd>{{ money(selectedEconomyFlow.publicDevelopmentFunding) }}</dd></div>
                <div><dt>Intérêts</dt><dd>{{ money(selectedEconomyFlow.interestPaid) }}</dd></div>
              </dl>
              <p v-else>Le détail financier de cette ancienne semaine n’était pas stocké. Les cumuls depuis le début restent disponibles dans Vue d’ensemble.</p>
              <div class="closing-finance"><span>Trésorerie de fin</span><b>{{ money(selectedSnapshot.balance) }}</b><span>Dette</span><b>{{ money(selectedSnapshot.debt) }}</b></div>
            </article>
          </div>
        </section>

        <section class="chart-card">
          <div class="chart-head">
            <div><span class="eyebrow">Évolution</span><h3>Historique hebdomadaire</h3></div>
            <div class="chart-switch">
              <button v-for="option in chartOptions" :key="option.key" type="button" :aria-pressed="chartMetric === option.key" :class="{ active: chartMetric === option.key }" @click="chartMetric = option.key">{{ option.label }}</button>
            </div>
          </div>
          <div v-if="chartGeometry.dots.length" class="chart-wrap">
            <div class="chart-scale"><span>{{ chartFormat(chartGeometry.max) }}</span><span>{{ chartFormat(chartGeometry.min) }}</span></div>
            <svg viewBox="0 0 640 180" role="img" aria-label="Courbe d’évolution hebdomadaire">
              <line x1="18" y1="18" x2="622" y2="18" />
              <line x1="18" y1="90" x2="622" y2="90" />
              <line x1="18" y1="162" x2="622" y2="162" />
              <polyline v-if="chartGeometry.dots.length > 1" :points="chartGeometry.points" />
              <g v-for="point in chartGeometry.dots" :key="point.label">
                <circle :cx="point.x" :cy="point.y" r="4" />
                <text :x="point.x" y="177" text-anchor="middle">{{ point.label }}</text>
              </g>
            </svg>
          </div>
          <p v-else class="empty">Pas encore assez de données pour cette courbe.</p>
        </section>
      </template>

      <template v-else>
        <section class="bilan-section history-section">
          <div class="section-title"><div><span class="eyebrow">Timeline</span><h3>Histoire de ta métropole</h3></div><small>Créations, suppressions, objectifs et grands records sont conservés.</small></div>
          <div v-if="statistics.milestones.value.length" class="timeline">
            <article v-for="item in statistics.milestones.value" :key="item.id">
              <span class="timeline-day">Jour {{ item.day }}</span>
              <div><strong>{{ item.title }}</strong><small>{{ item.detail }}<template v-if="item.amount != null"> · {{ money(item.amount) }}</template></small></div>
            </article>
          </div>
          <div v-else class="empty-history"><strong>L’histoire commence maintenant.</strong><span>Les grandes étapes de la partie apparaîtront ici à mesure que le réseau évolue.</span></div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.bilan-shell{width:min(1120px,calc(100vw - 42px));height:min(820px,calc(100vh - 42px));display:grid;grid-template-rows:auto auto minmax(0,1fr);border-radius:22px;background:#0d171d;border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 100px rgba(0,0,0,.55);overflow:hidden;color:#edf6f7}.bilan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px 15px;border-bottom:1px solid rgba(255,255,255,.06)}.eyebrow{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;opacity:.5}.bilan-head h2{margin:3px 0 3px;font-size:calc(24px * var(--clu-text-scale,1))}.bilan-head p{margin:0;font-size:calc(11px * var(--clu-text-scale,1));opacity:.52}.close{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;font-size:calc(22px * var(--clu-text-scale,1));cursor:pointer}.bilan-tabs{display:flex;gap:6px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018)}.bilan-tabs button,.chart-switch button{border:1px solid transparent;background:transparent;color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1));opacity:.58}.bilan-tabs button.active,.chart-switch button.active{opacity:1;background:rgba(78,211,220,.12);border-color:rgba(78,211,220,.28)}.bilan-scroll{min-height:0;overflow:auto;padding:18px 20px 26px;scrollbar-width:thin}.migration-note{margin-bottom:14px;padding:10px 12px;border-radius:11px;border:1px solid rgba(241,183,91,.25);background:rgba(241,183,91,.07);display:grid;gap:3px}.migration-note strong{font-size:calc(11px * var(--clu-text-scale,1));color:#f4c476}.migration-note span{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;opacity:.65}.hero-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.hero-grid article,.stat-grid article,.records-grid article,.week-kpis article{padding:12px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);display:grid;gap:4px}.hero-grid span,.stat-grid span,.records-grid span,.week-kpis span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5;text-transform:uppercase;letter-spacing:.05em}.hero-grid strong{font-size:calc(18px * var(--clu-text-scale,1))}.hero-grid small,.stat-grid small,.records-grid small,.week-kpis small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.46}.bilan-section{margin-top:17px}.section-title,.chart-head,.week-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:9px}.section-title h3,.chart-head h3,.week-heading h3{margin:2px 0 0;font-size:calc(15px * var(--clu-text-scale,1))}.section-title>small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.42;max-width:390px;text-align:right}.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.stat-grid b,.records-grid b{font-size:calc(14px * var(--clu-text-scale,1))}.records-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.week-strip{display:flex;gap:7px;overflow:auto;padding:1px 1px 9px;scrollbar-width:thin}.week-strip button{flex:0 0 auto;min-width:128px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:inherit;text-align:left;display:grid;gap:2px;cursor:pointer}.week-strip button.active{border-color:rgba(76,213,220,.42);background:rgba(76,213,220,.11)}.week-strip strong{font-size:calc(10px * var(--clu-text-scale,1))}.week-strip small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.46}.week-focus{margin-top:8px}.week-heading{align-items:center}.week-heading>span{font-size:calc(9px * var(--clu-text-scale,1));padding:5px 8px;border-radius:999px}.complete{background:rgba(65,173,111,.1);color:#8ce3ad}.ongoing{background:rgba(78,211,220,.1);color:#8de9ee}.reconstructed{background:rgba(232,171,76,.1);color:#efc174}.week-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.week-kpis b{font-size:calc(13px * var(--clu-text-scale,1))}.week-kpis small.positive{color:#88e0ab;opacity:.9}.week-kpis small.negative{color:#ff9b9b;opacity:.9}.week-kpis small.neutral{opacity:.42}.week-two-columns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.detail-card,.chart-card{padding:13px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.027)}.detail-card h4{margin:0 0 8px;font-size:calc(11px * var(--clu-text-scale,1))}.detail-card dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px}.detail-card dl div{padding:7px 8px;border-radius:8px;background:rgba(255,255,255,.035);display:flex;justify-content:space-between;gap:8px}.detail-card dt{font-size:calc(9px * var(--clu-text-scale,1));opacity:.46}.detail-card dd{margin:0;font-size:calc(10px * var(--clu-text-scale,1));font-weight:700}.detail-card p{margin:9px 0 0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.48}.closing-finance{display:grid;grid-template-columns:1fr auto;gap:5px 10px;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}.closing-finance span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.46}.closing-finance b{font-size:calc(10px * var(--clu-text-scale,1))}.chart-card{margin-top:10px}.chart-head{align-items:center}.chart-switch{display:flex;gap:3px;flex-wrap:wrap;justify-content:flex-end}.chart-switch button{padding:5px 7px;font-size:calc(9px * var(--clu-text-scale,1))}.chart-wrap{position:relative;height:210px;padding:6px 0 0 70px}.chart-scale{position:absolute;left:0;top:15px;bottom:29px;width:64px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end}.chart-scale span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.4}.chart-wrap svg{width:100%;height:190px;overflow:visible}.chart-wrap line{stroke:rgba(255,255,255,.08);stroke-width:1}.chart-wrap polyline{fill:none;stroke:#73dce2;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.chart-wrap circle{fill:#0d171d;stroke:#8de9ee;stroke-width:3}.chart-wrap text{fill:rgba(255,255,255,.42);font-size:calc(9px * var(--clu-text-scale,1))}.history-section{margin-top:0}.timeline{display:grid;gap:7px}.timeline article{display:grid;grid-template-columns:78px 1fr;gap:11px;padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.timeline-day{font-size:calc(9px * var(--clu-text-scale,1));color:#83dfe5}.timeline article div{display:grid;gap:2px}.timeline strong{font-size:calc(11px * var(--clu-text-scale,1))}.timeline small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48}.empty,.empty-history{padding:30px;text-align:center;opacity:.52}.empty-history{display:grid;gap:5px}.empty-history strong{font-size:calc(13px * var(--clu-text-scale,1))}.empty-history span{font-size:calc(10px * var(--clu-text-scale,1))}@media(max-width:980px){.hero-grid{grid-template-columns:repeat(2,1fr)}.week-kpis{grid-template-columns:repeat(3,1fr)}.stat-grid,.records-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.bilan-shell{width:calc(100vw - 20px);height:calc(100vh - 20px)}.bilan-head{padding:15px}.bilan-scroll{padding:13px}.hero-grid,.stat-grid,.records-grid,.week-kpis,.week-two-columns{grid-template-columns:1fr 1fr}.section-title{align-items:flex-start}.section-title>small{display:none}.chart-head{align-items:flex-start;flex-direction:column}.chart-switch{justify-content:flex-start}}@media(max-width:480px){.hero-grid,.stat-grid,.records-grid,.week-kpis,.week-two-columns{grid-template-columns:1fr}.bilan-tabs{overflow:auto}.chart-wrap{padding-left:52px}}
</style>
