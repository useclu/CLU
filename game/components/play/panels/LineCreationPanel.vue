<script setup lang="ts">
import { currentGameLocaleTag } from '../../../config/i18n'
import { computed, ref, watch } from 'vue'
import { GAME_TRANSPORT_MODES } from '../../../config/transportModes'
import { getModeEconomyDefinition } from '../../../config/economy'
import { getRollingStockDefinition } from '../../../config/rollingStock'
import { getModeSimulationDefinition } from '../../../config/simulation'
import { getInfrastructureDefinition } from '../../../config/projects'
import type { GameLineEmblem, GameTransportMode } from '../../../types/network'
import { useGameNetwork } from '../../../composables/useGameNetwork'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'
import { createLineLogoDataUrl } from '../../../utils/lineLogo'
import { suggestLineColor } from '../../../engine/network'

const emit = defineEmits<{ close: [] }>()
const network = useGameNetwork()
const game = useMetropoleGame()
const availableModes = computed(() => {
  const allowed = game.state.value.save?.data.challenge?.definition.allowedModes
  return allowed?.length ? GAME_TRANSPORT_MODES.filter(item => allowed.includes(item.value)) : GAME_TRANSPORT_MODES
})
const mode = ref<GameTransportMode>((availableModes.value[0]?.value ?? 'METRO') as GameTransportMode)
const name = ref('')
const shortCode = ref('')
const color = ref(suggestLineColor(network.lines.value.map(line => line.color)))
const emblem = ref<GameLineEmblem>('METRO')
const customLogoDataUrl = ref<string | undefined>(undefined)
const logoError = ref<string | null>(null)

const selectedMode = computed(() => availableModes.value.find(item => item.value === mode.value) ?? availableModes.value[0] ?? GAME_TRANSPORT_MODES[0]!)
const economyDefinition = computed(() => getModeEconomyDefinition(mode.value))
const rollingStockDefinition = computed(() => getRollingStockDefinition(mode.value))
const simulationDefinition = computed(() => getModeSimulationDefinition(mode.value))
const infrastructureDefinition = computed(() => getInfrastructureDefinition(mode.value, 'AUTO'))
const referenceKmCost = computed(() => economyDefinition.value.infrastructurePerKm * infrastructureDefinition.value.constructionCostMultiplier)

watch(mode, value => {
  const definition = GAME_TRANSPORT_MODES.find(item => item.value === value)
  color.value = suggestLineColor(network.lines.value.map(line => line.color), definition?.accent)
  emblem.value = value === 'BRT' ? 'EXPRESS' : value
})

function money(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

async function importLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  logoError.value = null
  try {
    customLogoDataUrl.value = await createLineLogoDataUrl(file)
  }
  catch (error) {
    logoError.value = error instanceof Error ? error.message : 'Impossible d’importer cette image.'
  }
}

async function createLine() {
  const line = await network.startLine(mode.value, name.value || undefined)
  if (!line) return
  await network.setLineIdentity(line.id, {
    shortCode: shortCode.value || line.shortCode,
    color: color.value,
    emblem: emblem.value,
  })
  if (customLogoDataUrl.value) await network.setLineCustomLogo(line.id, customLogoDataUrl.value)
  emit('close')
}
</script>

<template>
  <section class="creation-panel">
    <div class="section-head">
      <div><span class="eyebrow">Nouvelle ligne</span><h2>Créer une ligne</h2></div>
      <button class="close" type="button" @click="emit('close')">×</button>
    </div>

    <div class="creation-scroll">
      <p class="intro">Choisissez le transport et l’identité de la ligne. Ensuite, posez ses stations sur la carte : le coût précis de la construction sera recalculé en direct avant de lancer les travaux.</p>

      <div class="mode-grid">
        <button v-for="item in availableModes" :key="item.value" type="button" :class="{ active: mode === item.value }" @click="mode = item.value">
          <i :style="{ background: item.accent }" /><strong>{{ item.label }}</strong><small>{{ item.shortLabel }}</small>
        </button>
      </div>

      <div class="cost-box">
        <div class="cost-head"><div><span class="eyebrow">Repères de coût</span><strong>{{ selectedMode.label }} · avant de tracer</strong></div><span>{{ infrastructureDefinition.label }} par défaut</span></div>
        <div class="cost-grid">
          <div><span>Infrastructure / km</span><strong>{{ money(referenceKmCost) }}</strong></div>
          <div><span>Une station</span><strong>{{ money(economyDefinition.stationCost) }}</strong></div>
          <div><span>{{ rollingStockDefinition.vehicleLabel[0]?.toUpperCase() + rollingStockDefinition.vehicleLabel.slice(1) }}</span><strong>{{ money(rollingStockDefinition.purchaseCost) }}</strong></div>
          <div><span>Capacité / véhicule</span><strong>{{ simulationDefinition.vehicleCapacity.toLocaleString(currentGameLocaleTag()) }}</strong></div>
          <div><span>Exploitation fixe / jour</span><strong>{{ money(simulationDefinition.fixedOperatingCostPerDay) }}</strong></div>
          <div><span>Exploitation / km / jour</span><strong>{{ money(simulationDefinition.operatingCostPerKmPerDay * infrastructureDefinition.operatingCostMultiplier) }}</strong></div>
        </div>
        <p>Ces valeurs sont des repères. Le coût final dépendra de la longueur, du nombre de stations et de l’infrastructure réellement choisie.</p>
      </div>

      <div class="identity-grid">
        <label class="field wide">Nom de la ligne<input v-model="name" maxlength="60" placeholder="Ex. Ligne des Lacs"></label>
        <label class="field">Indice<input v-model="shortCode" maxlength="4" placeholder="A, 1, T3…"></label>
        <label class="field">Couleur<input v-model="color" type="color"><small>CLU propose une couleur encore peu ou pas utilisée.</small></label>
      </div>



    <div class="logo-box">
        <span class="logo-preview" :style="{ background: color }"><img v-if="customLogoDataUrl" :src="customLogoDataUrl" alt="Logo personnalisé"><b v-else>{{ shortCode || selectedMode.shortLabel }}</b></span>
        <div>
          <strong>Logo de ligne</strong>
          <small>Sans image, CLU utilise automatiquement le badge générique de la ligne.</small>
          <label class="file-button">Importer depuis l’appareil<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" @change="importLogo"></label>
          <button v-if="customLogoDataUrl" type="button" class="text-button" @click="customLogoDataUrl = undefined">Retirer l’image</button>
          <p v-if="logoError" class="error">{{ logoError }}</p>
        </div>
      </div>
    </div>

    <div class="actions"><button type="button" @click="emit('close')">Annuler</button><button class="primary" type="button" @click="createLine">Commencer le tracé</button></div>
  </section>
</template>

<style scoped>
.creation-panel{height:min(700px,calc(100vh - 68px));max-height:calc(100vh - 68px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:14px}.creation-scroll{min-height:0;overflow:auto;padding:1px 6px 4px 1px;display:grid;gap:16px;scrollbar-width:thin}.section-head,.actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.eyebrow{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(22px * var(--clu-text-scale,1))}.close{border:0;background:transparent;color:inherit;font-size:calc(24px * var(--clu-text-scale,1));cursor:pointer}.intro{font-size:calc(11px * var(--clu-text-scale,1));line-height:1.5;opacity:.68;margin:0}.mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.mode-grid button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:inherit;border-radius:11px;padding:9px 10px;text-align:left;display:grid;grid-template-columns:11px 1fr;gap:1px 7px;cursor:pointer}.mode-grid button.active{border-color:rgba(79,211,220,.55);background:rgba(79,211,220,.14)}.mode-grid i{width:9px;height:9px;border-radius:50%;margin-top:4px;grid-row:1/3}.mode-grid small{opacity:.5;font-size:calc(10px * var(--clu-text-scale,1))}.identity-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.field{display:grid;gap:5px;font-size:calc(11px * var(--clu-text-scale,1))}.field.wide{grid-column:1/-1}.field input{background:#121c23;border:1px solid rgba(255,255,255,.12);color:inherit;color-scheme:dark;border-radius:9px;padding:9px}.field input[type=color]{padding:4px;min-height:38px;width:100%}.field small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.45;line-height:1.35}.cost-box{padding:12px;border:1px solid rgba(103,195,219,.18);border-radius:13px;background:rgba(78,177,202,.055);display:grid;gap:9px}.cost-head{display:flex;align-items:end;justify-content:space-between;gap:10px}.cost-head>div{display:grid}.cost-head>span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.cost-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.cost-grid>div{padding:8px 9px;border-radius:9px;background:rgba(255,255,255,.04);display:grid;gap:2px}.cost-grid span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.cost-grid strong{font-size:calc(12px * var(--clu-text-scale,1))}.cost-grid small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.42}.cost-box p{margin:0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;opacity:.58}.logo-box{display:flex;align-items:center;gap:12px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035)}.logo-preview{width:52px;height:52px;border-radius:13px;display:grid;place-items:center;overflow:hidden;color:#081014;font-weight:900;flex:none}.logo-preview img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.92)}.logo-box>div{display:grid;gap:4px;flex:1}.logo-box small{opacity:.55;line-height:1.35;font-size:calc(10px * var(--clu-text-scale,1))}.file-button,.text-button{width:max-content;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}.file-button input{display:none}.text-button{background:transparent}.error{margin:2px 0 0;color:#ff9797;font-size:calc(10px * var(--clu-text-scale,1))}.actions{justify-content:flex-end;position:sticky;bottom:-1px;margin:0 -2px -2px;padding:10px 2px 2px;background:linear-gradient(180deg,rgba(15,24,30,0),#0f181e 28%)}.actions button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer}.actions .primary{background:rgba(79,211,220,.18);border-color:rgba(79,211,220,.45)}@media(max-width:520px){.identity-grid,.cost-grid{grid-template-columns:1fr}.field.wide{grid-column:auto}}@media(max-height:720px){.creation-panel{height:calc(100vh - 36px);max-height:calc(100vh - 36px)}}
</style>
