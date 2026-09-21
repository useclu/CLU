<script setup lang="ts">
import { currentGameLocaleTag } from '../../../config/i18n'
import { computed, onMounted } from 'vue'
import { useGameObjectives } from '../../../composables/useGameObjectives'
import type { GameObjectiveMetric } from '../../../types/objectives'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'

const objectives = useGameObjectives()
const game = useMetropoleGame()
const enabled = computed(() => game.state.value.save?.data.freePlaySettings.objectivesEnabled !== false)
onMounted(() => objectives.sync())

function money(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value) }
function value(metric: GameObjectiveMetric, current: number) {
  if (metric === 'MAX_LINE_OCCUPANCY') return `${Math.round(current * 100)} %`
  if (metric === 'NETWORK_MORALE' || metric === 'MIN_FLEET_CONDITION') return `${Math.round(current)}/100`
  if (metric === 'DAILY_OPERATING_RESULT') return money(current)
  return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(current)
}
</script>

<template>
  <section class="objectives-panel">
    <div class="section-head"><div><span class="eyebrow">Progression continue</span><h2>Objectifs</h2></div><strong>{{ money(objectives.totalRewards.value) }}</strong></div>
    <p v-if="!enabled" class="intro disabled-note"><strong>Objectifs désactivés pour cette partie.</strong><br>Ce choix a été défini avant le lancement de la partie libre.</p>
    <p v-else class="intro">Les objectifs non terminés restent présents. Quand vous en accomplissez un, sa récompense est versée et de nouveaux objectifs adaptés au réseau apparaissent.</p>
    <div v-if="enabled" class="objective-list">
      <article v-for="item in objectives.objectives.value" :key="item.definition.id">
        <span class="reward">+ {{ money(item.definition.reward) }}</span><strong>{{ item.definition.title }}</strong><p>{{ item.definition.description }}</p>
        <div class="progress"><i :style="{ width: `${Math.round(item.progress.ratio * 100)}%` }" /></div>
        <small>{{ value(item.definition.metric, item.progress.value) }} / {{ value(item.definition.metric, item.progress.target) }}</small>
      </article>
    </div>
    <details v-if="enabled && objectives.recentCompleted.value.length"><summary>Objectifs accomplis récemment</summary><div class="history"><div v-for="item in objectives.recentCompleted.value" :key="item.id"><span>{{ item.title }}</span><b>+{{ money(item.reward) }}</b><small>Jour {{ item.completedDay }}</small></div></div></details>
  </section>
</template>

<style scoped>
.objectives-panel{display:grid;gap:13px}.section-head{display:flex;align-items:center;justify-content:space-between}.eyebrow{font-size:calc(11px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(24px * var(--clu-text-scale,1))}.intro{font-size:calc(12px * var(--clu-text-scale,1));opacity:.7}.objective-list{display:grid;gap:8px}.objective-list article{position:relative;padding:11px;border-radius:12px;background:rgba(255,255,255,.04);display:grid;gap:5px}.objective-list p{margin:0;font-size:calc(12px * var(--clu-text-scale,1));opacity:.65;padding-right:65px}.reward{position:absolute;right:10px;top:10px;font-size:calc(10px * var(--clu-text-scale,1));color:#92e6b4}.progress{height:5px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}.progress i{display:block;height:100%;background:currentColor;opacity:.65}.objective-list small{opacity:.55}.history{display:grid;gap:5px}.history>div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:7px;border-radius:8px;background:rgba(255,255,255,.03)}.history small{opacity:.5}details{border-top:1px solid rgba(255,255,255,.07);padding-top:8px}summary{cursor:pointer;font-weight:700;margin-bottom:8px}.disabled-note{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035)}
</style>
