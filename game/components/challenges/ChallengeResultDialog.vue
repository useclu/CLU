<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref } from 'vue'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameChallenge } from '../../composables/useGameChallenge'
import { getGameTerritoryCatalogEntry } from '../../config/territories'

const emit = defineEmits<{ close: [] }>()
const game = useMetropoleGame()
const challenge = useGameChallenge()
const actionError = ref<string | null>(null)
const busy = ref(false)

const runtime = computed(() => challenge.runtime.value)
const result = computed(() => challenge.result.value)
const isDaily = computed(() => runtime.value?.definition.kind === 'DAILY')

function number(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value) }
function money(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value) }
function playedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes} min ${String(secs).padStart(2, '0')} s`
}

async function keepDailyAndHome() {
  if (busy.value) return
  busy.value = true
  actionError.value = null
  try {
    await game.archiveCurrentDailyChallenge()
    game.returnHome()
  }
  catch (cause) { actionError.value = cause instanceof Error ? cause.message : 'Impossible de conserver cette archive.' }
  finally { busy.value = false }
}

async function discardAndHome() {
  if (busy.value) return
  busy.value = true
  actionError.value = null
  try { await game.discardCurrentChallengeAndHome() }
  catch (cause) { actionError.value = cause instanceof Error ? cause.message : 'Impossible de quitter ce défi.' }
  finally { busy.value = false }
}

async function legacyHome() {
  if (busy.value) return
  busy.value = true
  try { await game.persistCurrentGame(); game.returnHome() }
  finally { busy.value = false }
}
</script>

<template>
  <section v-if="runtime && result" class="result-card" role="dialog" aria-modal="true" aria-labelledby="challenge-result-title">
    <header>
      <div><span>{{ result.status === 'SUCCESS' ? 'Défi réussi' : 'Défi terminé' }}</span><h2 id="challenge-result-title">{{ result.status === 'SUCCESS' ? 'Mission accomplie.' : 'Objectifs non atteints.' }}</h2><p>{{ runtime.definition.title }} · {{ getGameTerritoryCatalogEntry(runtime.definition.territory).label }}</p></div>
      <strong :class="result.status === 'SUCCESS' ? 'success' : 'failed'">{{ result.score }} pts</strong>
    </header>

    <div class="result-facts">
      <article><small>Temps joué</small><b>{{ playedTime(result.playedSeconds) }}</b></article>
      <article><small>Voyageurs</small><b>{{ number(result.stats.totalPassengers) }}</b></article>
      <article><small>Lignes en service</small><b>{{ result.stats.operationalLines }}</b></article>
      <article><small>Stations</small><b>{{ result.stats.stations }}</b></article>
      <article><small>Budget</small><b>{{ money(result.stats.balance) }}</b></article>
      <article><small>Dette</small><b>{{ money(result.stats.debt) }}</b></article>
    </div>

    <div class="objectives">
      <article v-for="objective in result.objectives" :key="objective.id" :class="{ met: objective.met }">
        <b>{{ objective.met ? '✓' : '×' }}</b><span><strong>{{ objective.title }}</strong><small>Valeur finale : {{ number(objective.value) }} · cible {{ objective.direction === 'AT_MOST' ? '≤' : '≥' }} {{ number(objective.target) }}</small></span>
      </article>
    </div>

    <p v-if="actionError" class="message error" role="alert">{{ actionError }}</p>

    <footer v-if="isDaily">
      <div><strong>Conserver cette partie ?</strong><small>Oui = archive en lecture seule supprimée automatiquement après 30 jours. Non = aucune sauvegarde durable.</small></div>
      <button type="button" :disabled="busy" @click="discardAndHome">Non, quitter</button>
      <button class="primary" type="button" :disabled="busy" @click="keepDailyAndHome">Oui, garder 30 jours</button>
      <button class="ghost" type="button" @click="emit('close')">Continuer à consulter</button>
    </footer>
    <footer v-else>
      <div><strong>Ancien défi</strong><small>Cette ancienne sauvegarde reste consultable, mais le système de défi par code a été retiré.</small></div>
      <button type="button" @click="emit('close')">Consulter le réseau</button>
      <button class="primary" type="button" :disabled="busy" @click="legacyHome">Sauvegarder et menu</button>
    </footer>
  </section>
</template>

<style scoped>
.result-card{width:min(760px,calc(100vw - 34px));max-height:calc(100vh - 38px);overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#0e171d;box-shadow:0 30px 100px rgba(0,0,0,.58);display:grid;gap:13px}.result-card header{display:flex;align-items:start;justify-content:space-between;gap:18px}.result-card header span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;color:#7de1e7}.result-card h2{margin:3px 0;font-size:calc(24px * var(--clu-text-scale,1))}.result-card header p{margin:0;font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.result-card header>strong{font-size:calc(22px * var(--clu-text-scale,1));padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05)}.result-card header>strong.success{color:#91e5ad}.result-card header>strong.failed{color:#ff9b9b}.result-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.result-facts article{padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025);display:grid;gap:2px}.result-facts small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.42}.result-facts b{font-size:calc(11px * var(--clu-text-scale,1))}.objectives{display:grid;gap:6px}.objectives article{display:flex;gap:8px;padding:9px;border:1px solid rgba(226,86,86,.12);border-radius:9px;background:rgba(180,50,50,.035)}.objectives article.met{border-color:rgba(78,202,119,.15);background:rgba(66,177,104,.04)}.objectives article>b{color:#ff8f8f}.objectives article.met>b{color:#82df9f}.objectives span{display:grid;gap:1px}.objectives strong{font-size:calc(10px * var(--clu-text-scale,1))}.objectives small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.45}.message{margin:0;padding:8px;border-radius:8px;font-size:calc(9px * var(--clu-text-scale,1))}.message.error{background:rgba(190,55,55,.1);color:#ffaaaa}footer{display:flex;align-items:center;justify-content:flex-end;gap:7px;padding-top:4px;border-top:1px solid rgba(255,255,255,.06);flex-wrap:wrap}footer>div{display:grid;gap:2px;margin-right:auto;max-width:390px}footer strong{font-size:calc(10px * var(--clu-text-scale,1))}footer small{font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;opacity:.48}footer button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}footer .primary{border-color:rgba(76,211,220,.35);background:rgba(76,211,220,.12)}footer .ghost{opacity:.65}@media(max-width:620px){.result-facts{grid-template-columns:1fr 1fr}footer{align-items:stretch;flex-direction:column}footer>div{margin-right:0}}
</style>
