<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref } from 'vue'
import { GAME_TRANSPORT_MODES } from '../../config/transportModes'
import { GENERATED_TERRITORY_CATALOG_ENTRY, getAvailableGameTerritories, getGameTerritoryCatalogEntry } from '../../config/territories'
import {
  createCustomFriendChallengeDefinition,
  createRandomFriendChallengeDefinition,
  decodeChallengeDefinition,
  encodeChallengeDefinition,
} from '../../engine/challenges'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import type { GameTerritory } from '../../types/game'
import type { GameTransportMode } from '../../types/network'
import type { GameChallengeDefinition, GameChallengeDifficulty } from '../../types/challenges'
import type { GameEconomyProfile, GameEventFrequency } from '../../types/freePlay'

const game = useMetropoleGame()
const view = ref<'ROOT' | 'FRIEND'>('ROOT')
const section = ref<'RANDOM' | 'CUSTOM' | 'JOIN'>('RANDOM')
const generated = ref<GameChallengeDefinition | null>(null)
const generatedCode = ref('')
const joinCode = ref('')
const joinDefinition = ref<GameChallengeDefinition | null>(null)
const error = ref<string | null>(null)
const starting = ref(false)
const copyFeedback = ref('')

const territory = ref<GameTerritory>('ILE_DE_FRANCE')
const generatedSeed = ref('CLU-AMIS-2026')
const capital = ref(4_000_000_000)
const economy = ref<GameEconomyProfile>('HARD')
const events = ref<GameEventFrequency>('STANDARD')
const duration = ref(60)
const difficulty = ref<GameChallengeDifficulty>('HARD')
const allowedModes = ref<GameTransportMode[]>(['BUS', 'TRAM', 'METRO'])
const passengerTarget = ref(120_000)
const qualityTarget = ref(60)

const territoryOptions = computed(() => [...getAvailableGameTerritories(), GENERATED_TERRITORY_CATALOG_ENTRY])
const money = (value: number) => new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)

function toggleMode(mode: GameTransportMode) {
  if (allowedModes.value.includes(mode)) {
    if (allowedModes.value.length === 1) return
    allowedModes.value = allowedModes.value.filter(item => item !== mode)
  }
  else allowedModes.value = [...allowedModes.value, mode]
}

function makeRandom() {
  error.value = null
  const seed = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  generated.value = createRandomFriendChallengeDefinition(seed)
  generatedCode.value = encodeChallengeDefinition(generated.value)
}

function makeCustom() {
  error.value = null
  const definition = createCustomFriendChallengeDefinition({
    territory: territory.value,
    generatedTerritory: territory.value === 'GENERATED' ? {
      version: 3, seed: generatedSeed.value || 'CLU-AMIS-2026', name: 'Métropole défi', size: 'MEDIUM', density: 'STANDARD', structure: 'POLYCENTRIC', water: 'STANDARD',
    } : null,
    startingCapital: capital.value,
    economyProfile: economy.value,
    eventFrequency: events.value,
    durationMinutes: duration.value,
    difficulty: difficulty.value,
    allowedModes: allowedModes.value,
    objectives: [
      { id: 'passengers', metric: 'TOTAL_PASSENGERS', direction: 'AT_LEAST', title: `Transporter ${passengerTarget.value.toLocaleString(currentGameLocaleTag())} voyageurs`, description: 'Cumulez au moins ce nombre de voyageurs.', target: passengerTarget.value, weight: 1.2 },
      { id: 'quality', metric: 'SERVICE_QUALITY', direction: 'AT_LEAST', title: `Qualité ≥ ${qualityTarget.value}/100`, description: 'Terminez avec cette qualité de service minimale.', target: qualityTarget.value, weight: 1 },
    ],
  })
  generated.value = definition
  generatedCode.value = encodeChallengeDefinition(definition)
}

function readJoinCode() {
  error.value = null
  try { joinDefinition.value = decodeChallengeDefinition(joinCode.value) }
  catch (cause) { joinDefinition.value = null; error.value = cause instanceof Error ? cause.message : 'Code défi invalide.' }
}

async function start(definition: GameChallengeDefinition | null) {
  if (!definition || starting.value) return
  starting.value = true
  error.value = null
  try { await game.createChallengeGame(definition) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Impossible de lancer ce défi.' }
  finally { starting.value = false }
}

function selectText(event: FocusEvent) {
  const target = event.target
  if (target instanceof HTMLTextAreaElement) target.select()
}

async function copyCode() {
  if (!generatedCode.value) return
  copyFeedback.value = ''
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    copyFeedback.value = 'Code copié'
    window.setTimeout(() => { copyFeedback.value = '' }, 1800)
  }
  catch { copyFeedback.value = 'Copie impossible — sélectionnez le code' }
}
</script>

<template>
  <section class="friend-panel">
    <template v-if="view === 'ROOT'">
      <div class="online-intro">
        <strong>En ligne</strong>
        <p>Choisissez comment jouer avec quelqu’un. Les défis par code sont disponibles dès maintenant ; la partie partagée en direct arrivera plus tard.</p>
      </div>

      <div class="online-choices">
        <button class="online-choice online-choice--friend" type="button" @click="view = 'FRIEND'">
          <b>VS</b>
          <span>
            <strong>Défier un ami</strong>
            <small>Partie aléatoire, personnalisée ou code reçu. Chacun joue chez soi avec exactement les mêmes règles.</small>
          </span>
          <em>Disponible</em>
          <i>→</i>
        </button>

        <article class="online-choice online-choice--coop" aria-disabled="true">
          <b>2P</b>
          <span>
            <strong>Jouer ensemble sur la même partie</strong>
            <small>Construire et gérer simultanément le même réseau à deux. Ce mode coopératif en direct reste prévu pour un futur gros lot.</small>
          </span>
          <em>Plus tard</em>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="friend-head">
        <button class="back" type="button" @click="view = 'ROOT'">← En ligne</button>
        <div><strong>Défier un ami</strong><small>Même défi, mêmes règles, chacun joue sa partie.</small></div>
      </div>

      <div class="friend-tabs" role="tablist" aria-label="Type de défi entre amis"><button type="button" role="tab" :aria-selected="section==='RANDOM'" :class="{active:section==='RANDOM'}" @click="section='RANDOM'">Partie aléatoire</button><button type="button" role="tab" :aria-selected="section==='CUSTOM'" :class="{active:section==='CUSTOM'}" @click="section='CUSTOM'">Partie personnalisée</button><button type="button" role="tab" :aria-selected="section==='JOIN'" :class="{active:section==='JOIN'}" @click="section='JOIN'">Entrer un code</button></div>

      <template v-if="section === 'RANDOM'">
        <div class="intro"><b>VS</b><div><strong>Défi inconnu entre potes</strong><p>CLU tire une carte, un budget, des règles hardcore, une durée et des objectifs. Le code embarque toute la configuration : aucun serveur n’est nécessaire.</p></div></div>
        <button class="generate" type="button" @click="makeRandom">Générer un défi aléatoire</button>
      </template>

      <template v-else-if="section === 'CUSTOM'">
        <div class="form-grid">
          <label>Carte<select v-model="territory"><option v-for="item in territoryOptions" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
          <label v-if="territory === 'GENERATED'">Seed fictive<input v-model="generatedSeed" maxlength="60"></label>
          <label>Capital<input v-model.number="capital" type="number" min="100000000" max="50000000000" step="100000000"></label>
          <label>Économie<select v-model="economy"><option value="GENEROUS">Généreuse</option><option value="STANDARD">Standard</option><option value="HARD">Exigeante</option></select></label>
          <label>Événements<select v-model="events"><option value="CALM">Calmes</option><option value="STANDARD">Standard</option><option value="FREQUENT">Fréquents</option></select></label>
          <label>Durée<select v-model.number="duration"><option :value="30">30 min</option><option :value="45">45 min</option><option :value="60">60 min</option></select></label>
          <label>Difficulté<select v-model="difficulty"><option value="STANDARD">Standard</option><option value="HARD">Hardcore</option><option value="EXTREME">Extrême</option></select></label>
          <label>Voyageurs cible<input v-model.number="passengerTarget" type="number" min="10000" step="10000"></label>
          <label>Qualité minimale<input v-model.number="qualityTarget" type="number" min="0" max="100"></label>
        </div>
        <div class="modes"><span>Modes autorisés</span><button v-for="item in GAME_TRANSPORT_MODES" :key="item.value" type="button" :class="{active:allowedModes.includes(item.value)}" :aria-pressed="allowedModes.includes(item.value)" @click="toggleMode(item.value)">{{ item.shortLabel }}</button></div>
        <button class="generate" type="button" @click="makeCustom">Générer le code personnalisé</button>
      </template>

      <template v-else>
        <div class="join"><label>Code défi CLU1<textarea v-model.trim="joinCode" rows="5" placeholder="CLU1.…"></textarea></label><button type="button" @click="readJoinCode">Vérifier le code</button></div>
        <article v-if="joinDefinition" class="preview"><strong>{{ joinDefinition.title }}</strong><span>{{ getGameTerritoryCatalogEntry(joinDefinition.territory).label }} · {{ money(joinDefinition.startingCapital) }} · {{ joinDefinition.durationMinutes }} min</span><small>{{ joinDefinition.allowedModes.join(' · ') }}</small><button type="button" :disabled="starting" @click="start(joinDefinition)">Lancer exactement ce défi →</button></article>
      </template>

      <article v-if="generated" class="preview preview--code">
        <div><strong>{{ generated.title }}</strong><span>{{ getGameTerritoryCatalogEntry(generated.territory).label }} · {{ money(generated.startingCapital) }} · {{ generated.durationMinutes }} min</span><small>{{ generated.allowedModes.join(' · ') }} · {{ generated.objectives.length }} objectifs</small></div>
        <textarea :value="generatedCode" readonly rows="4" @focus="selectText" />
        <div class="preview-actions"><span v-if="copyFeedback" class="copy-feedback" role="status" aria-live="polite">{{ copyFeedback }}</span><button type="button" @click="copyCode">Copier le code</button><button class="primary" type="button" :disabled="starting" @click="start(generated)">Jouer ce défi →</button></div>
      </article>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.friend-panel{display:grid;gap:12px}
.online-intro{display:grid;gap:5px;padding:2px 1px 8px}.online-intro strong{font-size:15px}.online-intro p{margin:0;max-width:620px;font-size:9px;line-height:1.55;opacity:.55}
.online-choices{display:grid;grid-template-columns:1fr 1fr;gap:10px}.online-choice{position:relative;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;min-height:94px;padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.03);color:inherit;text-align:left}.online-choice--friend{cursor:pointer;border-color:rgba(234,78,86,.25);background:linear-gradient(135deg,rgba(179,37,47,.13),rgba(255,255,255,.025));transition:transform .16s ease,border-color .16s ease,background .16s ease}.online-choice--friend:hover{transform:translateY(-1px);border-color:rgba(244,87,95,.5);background:linear-gradient(135deg,rgba(199,44,54,.2),rgba(255,255,255,.035))}.online-choice>b{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:rgba(224,67,76,.13);color:#ff9097;font-size:11px}.online-choice>span{display:grid;gap:4px;min-width:0}.online-choice strong{font-size:12px}.online-choice small{font-size:8px;line-height:1.45;opacity:.5}.online-choice em{align-self:start;font-style:normal;font-size:7px;text-transform:uppercase;letter-spacing:.1em;color:#ff9aa0}.online-choice>i{position:absolute;right:14px;bottom:11px;font-style:normal;font-size:15px;opacity:.6}.online-choice--coop{opacity:.62}.online-choice--coop>b{background:rgba(217,188,116,.1);color:#d9bc74}.online-choice--coop em{color:#d9bc74}
.friend-head{display:flex;align-items:center;gap:12px;padding-bottom:4px}.friend-head .back{border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.035);color:inherit;padding:7px 9px;cursor:pointer;font-size:8px}.friend-head>div{display:grid;gap:2px}.friend-head strong{font-size:13px}.friend-head small{font-size:8px;opacity:.45}
.friend-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.friend-tabs button,.generate,.join button,.preview button{border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.04);color:inherit;padding:8px 9px;cursor:pointer;font-size:9px}.friend-tabs button.active{background:rgba(206,56,64,.15);border-color:rgba(244,87,95,.34);color:#ffb0b4}.intro{display:flex;gap:12px;padding:13px;border:1px solid rgba(236,72,80,.18);border-radius:12px;background:rgba(125,24,30,.08)}.intro>b{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:rgba(224,67,76,.13);color:#ff9097}.intro strong{font-size:13px}.intro p{margin:4px 0 0;font-size:9px;line-height:1.5;opacity:.55}.generate{justify-self:start;border-color:rgba(234,78,86,.34);background:rgba(200,50,59,.12);font-weight:750}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.form-grid label,.join label{display:grid;gap:4px;font-size:8px;opacity:.72}.form-grid input,.form-grid select,.join textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#10191f;color:#eef7f8;padding:8px;font:inherit;color-scheme:dark}.modes{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.modes>span{font-size:8px;opacity:.5;margin-right:4px}.modes button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:inherit;border-radius:7px;padding:6px 7px;font-size:8px;cursor:pointer}.modes button.active{border-color:rgba(81,210,218,.34);background:rgba(81,210,218,.11);color:#8de7eb}.preview{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);display:grid;gap:4px}.preview strong{font-size:12px}.preview span{font-size:9px;opacity:.58}.preview small{font-size:8px;opacity:.4}.preview>button{justify-self:start;margin-top:5px}.preview--code textarea{margin-top:7px;width:100%;box-sizing:border-box;resize:vertical;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:#091218;color:#aeeef1;padding:8px;font:8px/1.4 ui-monospace,monospace}.preview-actions{display:flex;justify-content:flex-end;align-items:center;gap:6px}.copy-feedback{font-size:8px;color:#8ee3bd;margin-right:auto}.preview-actions .primary{border-color:rgba(232,76,84,.35);background:rgba(202,52,60,.13)}.join{display:grid;grid-template-columns:1fr auto;align-items:end;gap:8px}.error{margin:0;padding:8px;border-radius:8px;background:rgba(190,55,55,.1);color:#ffabab;font-size:9px}
@media(max-width:700px){.online-choices{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr 1fr}.friend-tabs{grid-template-columns:1fr}.join{grid-template-columns:1fr}.preview-actions{justify-content:stretch}.preview-actions button{flex:1}}@media(max-width:480px){.form-grid{grid-template-columns:1fr}.friend-head{align-items:flex-start;flex-direction:column}}
</style>
