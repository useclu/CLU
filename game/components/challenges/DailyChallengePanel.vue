<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref } from 'vue'
import { createDailyChallengeDefinition, utcDateKey } from '../../engine/challenges'
import { getGameTerritoryCatalogEntry } from '../../config/territories'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameAudio } from '../../composables/useGameAudio'

const game = useMetropoleGame()
const audio = useGameAudio()
const definition = computed(() => createDailyChallengeDefinition(utcDateKey()))
const error = ref<string | null>(null)
const launching = ref(false)

const money = (value: number) => new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)

async function launch() {
  if (launching.value) return
  launching.value = true
  error.value = null
  try {
    audio.playUi('CONFIRM')
    await game.createChallengeGame(definition.value)
  }
  catch (cause) {
    audio.playUi('ERROR')
    error.value = cause instanceof Error ? cause.message : 'Impossible de lancer le Défi du jour.'
  }
  finally { launching.value = false }
}
</script>

<template>
  <section class="daily-panel">
    <div class="daily-hero">
      <span class="daily-mark">◆</span>
      <div><p>Défi officiel · {{ definition.dateKey }} UTC</p><h3>{{ definition.title }}</h3><small>Même défi pour tout le monde. La configuration est déterministe et ne change pas après actualisation.</small></div>
      <b>60:00 max</b>
    </div>
    <div class="daily-facts">
      <article><span>Carte</span><strong>{{ getGameTerritoryCatalogEntry(definition.territory).label }}</strong><small>Carte réelle uniquement</small></article>
      <article><span>Capital</span><strong>{{ money(definition.startingCapital) }}</strong><small>Imposé</small></article>
      <article><span>Difficulté</span><strong>{{ definition.difficulty === 'EXTREME' ? 'Extrême' : 'Hardcore' }}</strong><small>Aucune triche</small></article>
      <article><span>Modes</span><strong>{{ definition.allowedModes.join(' · ') }}</strong><small>Les autres sont bloqués</small></article>
    </div>
    <div class="daily-grid">
      <div><h4>Objectifs</h4><ul><li v-for="objective in definition.objectives" :key="objective.id"><b>{{ objective.title }}</b><span>{{ objective.description }}</span></li></ul></div>
      <div><h4>Règles</h4><ul><li v-for="constraint in definition.constraints" :key="constraint"><b>•</b><span>{{ constraint }}</span></li></ul></div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="daily-actions"><span>À 00:00 UTC, une nouvelle épreuve remplace celle-ci.</span><button type="button" :disabled="launching" @click="launch">{{ launching ? 'Préparation…' : 'Lancer le Défi du jour' }} <b>→</b></button></div>
  </section>
</template>

<style scoped>
.daily-panel{display:grid;gap:14px}.daily-hero{display:grid;grid-template-columns:auto 1fr auto;gap:13px;align-items:center;padding:15px;border:1px solid rgba(245,196,67,.28);border-radius:15px;background:linear-gradient(120deg,rgba(92,65,10,.23),rgba(255,193,46,.05))}.daily-mark{width:45px;height:45px;display:grid;place-items:center;border-radius:13px;background:rgba(255,198,55,.13);color:#ffd35d;font-size:calc(20px * var(--clu-text-scale,1))}.daily-hero p{margin:0 0 3px;font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#e9c65c}.daily-hero h3{margin:0;font-size:calc(18px * var(--clu-text-scale,1))}.daily-hero small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.55}.daily-hero>b{padding:7px 9px;border-radius:9px;background:rgba(255,204,72,.11);color:#ffe28b;font-size:calc(11px * var(--clu-text-scale,1))}.daily-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.daily-facts article{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025);display:grid;gap:2px}.daily-facts span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;opacity:.42}.daily-facts strong{font-size:calc(11px * var(--clu-text-scale,1))}.daily-facts small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.38}.daily-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.daily-grid>div{padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.02)}h4{margin:0 0 9px;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}li{display:grid;grid-template-columns:auto 1fr;gap:7px;align-items:start}li b{font-size:calc(10px * var(--clu-text-scale,1));color:#f3d16b}li span{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.6}.error{padding:8px 10px;margin:0;border-radius:9px;background:rgba(190,55,55,.12);color:#ffaaaa;font-size:calc(10px * var(--clu-text-scale,1))}.daily-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.daily-actions>span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.38}.daily-actions button{border:1px solid rgba(245,199,72,.4);background:linear-gradient(135deg,rgba(218,166,38,.22),rgba(105,74,9,.18));color:#fff4cd;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1));font-weight:800}.daily-actions button b{margin-left:12px}@media(max-width:720px){.daily-facts{grid-template-columns:1fr 1fr}.daily-grid{grid-template-columns:1fr}.daily-hero{grid-template-columns:auto 1fr}.daily-hero>b{grid-column:1/-1;width:max-content}.daily-actions{align-items:stretch;flex-direction:column}}
</style>
