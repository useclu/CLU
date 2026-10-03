<script setup lang="ts">
import { computed } from 'vue'
import { formatGameInteger, formatGamePercent, formatGameDecimal1 } from '../../../config/i18n'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'
import { useGamePassengers } from '../../../composables/useGamePassengers'

const game = useMetropoleGame()
const passengers = useGamePassengers()

const lines = computed(() => (game.state.value.save?.data.network.lines ?? []).filter(line => line.status === 'OPERATIONAL'))
const report = computed(() => passengers.lastReport.value)
function lineById(lineId: string) {
  return lines.value.find(item => item.id === lineId) ?? game.state.value.save?.data.network.lines.find(item => item.id === lineId) ?? null
}

function integer(value: number) {
  return formatGameInteger(Math.max(0, value || 0))
}

function percent(value: number) {
  return formatGamePercent(Math.max(0, value || 0))
}

function minutes(value: number) {
  return formatGameDecimal1(Math.max(0, value || 0))
}

const topLoads = computed(() => report.value?.lineLoads.slice(0, 8) ?? [])
</script>

<template>
  <div class="passengers-panel">
    <header class="passengers-head">
      <div><span class="eyebrow">Voyageurs</span><h3>Ce que vit votre réseau aujourd’hui</h3></div>
      <small>Les détails restent disponibles sans encombrer la lecture principale.</small>
    </header>

    <section v-if="report" class="kpi-grid kpi-grid--essential">
      <div><span>Transportés</span><strong>{{ integer(report.carriedJourneys) }}</strong><small>{{ percent(report.carriedJourneyRate) }} de la demande</small></div>
      <div><span>Temps moyen</span><strong>{{ minutes(report.averageJourneyMinutes) }} min</strong></div>
      <div><span>Attente</span><strong>{{ minutes(report.averageWaitingMinutes) }} min</strong></div>
      <div><span>Renoncements</span><strong>{{ integer(report.abandonedJourneys) }}</strong></div>
    </section>
    <p v-else class="empty-note">Passez au jour suivant pour produire le premier rapport voyageurs.</p>

    <details v-if="report" class="panel-fold">
      <summary>Détails des flux</summary>
      <section class="kpi-grid kpi-grid--secondary">
        <div><span>Trajets générés</span><strong>{{ integer(report.generatedJourneys) }}</strong></div>
        <div><span>Correspondances</span><strong>{{ integer(report.transferJourneys) }}</strong></div>
        <div><span>Réacheminés</span><strong>{{ integer(report.reroutedJourneys) }}</strong></div>
        <div><span>Laissés sur quai</span><strong>{{ integer(report.leftBehindJourneys) }}</strong></div>
      </section>
    </details>

    <details v-if="report" class="panel-fold">
      <summary>Lignes les plus chargées</summary>
      <div class="fold-content">
      <div class="load-list">
        <article v-for="load in topLoads" :key="load.lineId">
          <div><span><i :style="{ background: lineById(load.lineId)?.color ?? '#777' }" /><strong data-i18n-skip>{{ lineById(load.lineId)?.shortCode }}</strong><b data-i18n-skip>{{ load.lineName }}</b></span><em>{{ percent(load.loadRate) }}</em></div>
          <div class="bar"><i :style="{ width: `${Math.min(100, load.loadRate * 100)}%` }" /></div>
          <small><b>{{ integer(load.transportedBoardings) }}</b> <span>Embarquements</span> · <b>{{ integer(load.transferBoardings) }}</b> <span>Après correspondance</span> · <b>{{ integer(load.leftBehindPassengers) }}</b> <span>Laissés sur quai</span></small>
        </article>
      </div>
      </div>
    </details>

  </div>
</template>

<style scoped>
.passengers-panel{display:grid;gap:14px;padding:14px}.intro-card,.panel-card{border:1px solid rgba(148,163,184,.22);border-radius:18px;background:rgba(15,23,42,.54);padding:16px}.intro-card h3,.panel-card h3{margin:3px 0 7px;font-size:1rem}.intro-card p,.panel-card>p{margin:0;color:var(--game-muted,#aeb8c8);font-size:.84rem;line-height:1.45}.eyebrow{font-size:.69rem;text-transform:uppercase;letter-spacing:.11em;color:var(--game-accent,#70c8ff);font-weight:800}.kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kpi-grid div{display:grid;gap:2px;padding:11px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.13)}.kpi-grid span,.kpi-grid small{font-size:.7rem;color:var(--game-muted,#aeb8c8)}.kpi-grid strong{font-size:1.02rem}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.section-head h3{margin:3px 0 0}.section-head>b{min-width:30px;text-align:center;padding:5px 8px;border-radius:999px;background:rgba(112,200,255,.12);color:var(--game-accent,#70c8ff)}.minutes-input{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px}.minutes-input em{font-size:.72rem;font-style:normal;color:var(--game-muted,#aeb8c8)}button{border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(148,163,184,.1);color:inherit;padding:9px 11px;font:inherit;font-weight:750;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}button.primary{border-color:rgba(112,200,255,.4);background:rgba(112,200,255,.14);color:#dff5ff}.transfer-list{display:grid;gap:9px;margin-top:13px}.transfer-list article{display:grid;gap:8px;padding:11px;border-radius:14px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.12)}.transfer-route{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:7px}.transfer-route>span{display:grid;grid-template-columns:10px auto 1fr;align-items:center;gap:5px;min-width:0}.transfer-route i,.load-list span i{width:9px;height:9px;border-radius:999px}.transfer-route b,.load-list span b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.transfer-route em{font-style:normal;color:var(--game-accent,#70c8ff)}.transfer-list article>small,.load-list article>small{font-size:.7rem;color:var(--game-muted,#aeb8c8)}.transfer-actions{display:grid;grid-template-columns:minmax(80px,1fr) auto auto;gap:6px}.danger{color:#ffb4b4;border-color:rgba(248,113,113,.28)}.load-list{display:grid;gap:10px;margin-top:10px}.load-list article{display:grid;gap:5px}.load-list article>div:first-child{display:flex;justify-content:space-between;gap:8px}.load-list span{display:flex;align-items:center;gap:6px;min-width:0}.load-list em{font-style:normal;font-weight:800}.bar{height:6px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:currentColor;opacity:.65}.usage-list{display:grid;gap:7px;margin-top:10px}.usage-list>div{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(148,163,184,.11);font-size:.75rem}.usage-list>div:last-child{border-bottom:0}.usage-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--game-muted,#aeb8c8)}@media(max-width:560px){.passengers-panel{padding:10px}.kpi-grid{grid-template-columns:1fr 1fr}.transfer-actions{grid-template-columns:1fr 1fr}.transfer-actions .minutes-input{grid-column:1/-1}.usage-list>div{display:grid}}

/* Voyageurs : lecture rapide, sans grands encarts. */
.passengers-panel{gap:9px;padding:0}.intro-card,.panel-card{padding:10px;border-radius:10px;background:rgba(255,255,255,.018);border-color:rgba(255,255,255,.07)}.intro-card h3,.panel-card h3{font-size:calc(12px * var(--clu-text-scale,1));margin:2px 0 4px}.intro-card p,.panel-card>p{font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.35}.kpi-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.kpi-grid div{padding:7px;border-radius:8px;background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.05)}.kpi-grid strong{font-size:calc(11px * var(--clu-text-scale,1))}.transfer-list,.load-list{gap:6px;margin-top:8px}.transfer-list article{padding:8px;border-radius:9px}.usage-list{gap:4px}.usage-list>div{padding:6px 0}@media(max-width:560px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* Simplification 2.0 : l'essentiel d'abord, diagnostic à la demande. */
.passengers-head{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:2px 1px 3px}.passengers-head>div{display:grid;gap:2px}.passengers-head h3{margin:0;font-size:calc(13px * var(--clu-text-scale,1));letter-spacing:-.01em}.passengers-head>small{max-width:180px;text-align:right;font-size:calc(7.5px * var(--clu-text-scale,1));line-height:1.3;opacity:.42}.kpi-grid--essential{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi-grid--essential>div:first-child{border-color:rgba(79,211,220,.16);background:rgba(79,211,220,.045)}.panel-fold{border-top:1px solid rgba(255,255,255,.065)}.panel-fold>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;min-height:34px;padding:0 3px;color:rgba(237,246,247,.78);font-size:calc(9px * var(--clu-text-scale,1));font-weight:750;cursor:pointer}.panel-fold>summary::-webkit-details-marker{display:none}.panel-fold>summary::after{content:'+';font-size:15px;font-weight:400;opacity:.38}.panel-fold[open]>summary::after{content:'−'}.fold-content{padding:2px 2px 8px}.fold-content>p{margin:0 0 8px;font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.4;opacity:.56}.kpi-grid--secondary{grid-template-columns:repeat(2,minmax(0,1fr));padding:2px 0 8px}.kpi-grid--secondary>div{background:transparent}.panel-fold .load-list{margin-top:2px}

</style>
