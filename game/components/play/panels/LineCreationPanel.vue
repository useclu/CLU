<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GAME_TRANSPORT_MODES } from '../../../config/transportModes'
import { getModeEconomyDefinition } from '../../../config/economy'
import { formatGameCurrencyCompact } from '../../../config/i18n'
import type { GameLineEmblem, GameTransportMode } from '../../../types/network'
import { useGameNetwork } from '../../../composables/useGameNetwork'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'
import { createLineLogoDataUrl } from '../../../utils/lineLogo'
import TransportModeIcon from '../../common/TransportModeIcon.vue'
import { suggestLineColor } from '../../../engine/network'

const emit = defineEmits<{ close: []; created: [lineId: string] }>()
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
const selectedModeEconomy = computed(() => getModeEconomyDefinition(mode.value))

function money(value: number) {
  return formatGameCurrencyCompact(value)
}
const modeConstraintNote = computed(() => {
  if (mode.value === 'FERRY') return 'Navette fluviale : les haltes et chaque segment doivent rester sur l’eau. CLU refuse le placement dès que le tracé quitte une rivière, un canal ou un plan d’eau cartographié.'
  if (mode.value === 'CABLE') return 'Téléphérique : le tracé reste aérien, mais vous pourrez choisir Rail auto, Aide légère ou Libre pendant la conception. Les coûts incluent l’infrastructure câble et les stations.'
  return ''
})

watch(mode, value => {
  const definition = GAME_TRANSPORT_MODES.find(item => item.value === value)
  color.value = suggestLineColor(network.lines.value.map(line => line.color), definition?.accent)
  emblem.value = value === 'BRT' ? 'EXPRESS' : value
})


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
  emit('created', line.id)
  emit('close')
}
</script>

<template>
  <section class="creation-panel">
    <header class="creation-head">
      <div>
        <span>Nouvelle ligne</span>
        <h2>Choisir le mode et l’identité</h2>
      </div>
      <button class="close" type="button" aria-label="Fermer" @click="emit('close')">×</button>
    </header>

    <div class="creation-scroll">
      <section class="mode-section" aria-label="Mode de transport">
        <div class="section-label"><strong>Mode de transport</strong><small>Le tracé et les contraintes s’adaptent au mode choisi.</small></div>
        <div class="mode-grid">
          <button v-for="item in availableModes" :key="item.value" type="button" :class="{ active: mode === item.value }" @click="mode = item.value">
            <span class="mode-icon" :style="{ '--mode-accent': item.accent }"><TransportModeIcon :mode="item.value" /></span>
            <span><strong>{{ item.label }}</strong><small>{{ item.shortLabel }}</small></span>
            <i v-if="mode === item.value">✓</i>
          </button>
        </div>
      </section>

      <section class="cost-guide" aria-label="Coûts indicatifs du mode sélectionné">
        <div class="cost-chip"><span>Station</span><strong>{{ money(selectedModeEconomy.stationCost) }}</strong></div>
        <div class="cost-chip"><span>Infrastructure / km</span><strong>{{ money(selectedModeEconomy.infrastructurePerKm) }}</strong></div>
        <p v-if="modeConstraintNote" class="constraint"><b>{{ selectedMode.label }}</b>{{ modeConstraintNote }}</p>
        <p v-if="mode !== 'FERRY'" class="constraint">Après création, choisissez Rail auto, Aide légère ou Libre dans la barre Tracé.</p>
      </section>

      <section class="identity-section">
        <div class="section-label"><strong>Identité de la ligne</strong><small>Vous pourrez la modifier plus tard.</small></div>
        <div class="identity-grid">
          <label class="field wide">Nom<input v-model="name" maxlength="60" placeholder="Ex. Ligne des Lacs"></label>
          <label class="field">Indice<input v-model="shortCode" maxlength="4" placeholder="A, 1, T3…"></label>
          <label class="field color-field">Couleur<span><input v-model="color" type="color"><b :style="{ background: color }" /></span></label>
        </div>
      </section>

      <section class="logo-box">
        <span class="logo-preview" :style="{ background: color }"><img v-if="customLogoDataUrl" :src="customLogoDataUrl" alt="Logo personnalisé"><b v-else>{{ shortCode || selectedMode.shortLabel }}</b></span>
        <div>
          <strong>Logo personnalisé <small>facultatif</small></strong>
          <p>Sans image, CLU utilise automatiquement le badge de la ligne.</p>
          <div class="logo-actions"><label class="file-button">Importer<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" @change="importLogo"></label><button v-if="customLogoDataUrl" type="button" @click="customLogoDataUrl = undefined">Retirer</button></div>
          <p v-if="logoError" class="error">{{ logoError }}</p>
        </div>
      </section>
    </div>

    <footer class="actions"><button type="button" @click="emit('close')">Annuler</button><button class="primary" type="button" @click="createLine">Tracer la ligne →</button></footer>
  </section>
</template>

<style scoped>
.creation-panel{height:min(600px,calc(100dvh - 76px));max-height:calc(100dvh - 76px);min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;color:inherit}.creation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 2px 13px;border-bottom:1px solid rgba(255,255,255,.07)}.creation-head>div{display:grid;gap:2px}.creation-head span,.section-label small{font-size:calc(8.5px * var(--clu-text-scale,1));color:rgba(235,246,250,.46)}.creation-head>div>span{text-transform:uppercase;letter-spacing:.13em;color:#76dce3;font-weight:800}.creation-head h2{margin:0;font-size:calc(18px * var(--clu-text-scale,1));letter-spacing:-.025em}.close{width:30px;height:30px;border:0;border-radius:8px;background:rgba(255,255,255,.045);color:inherit;font-size:20px;cursor:pointer}.creation-scroll{min-height:0;overflow:auto;padding:13px 3px 10px 0;display:grid;gap:16px;scrollbar-width:thin}.section-label{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}.section-label strong{font-size:calc(11px * var(--clu-text-scale,1))}.mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.mode-grid button{position:relative;min-height:54px;display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 9px;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer}.mode-grid button:hover{background:rgba(255,255,255,.045)}.mode-grid button.active{border-color:color-mix(in srgb,var(--mode-accent,#5ed6df) 45%,transparent);background:rgba(82,205,215,.075)}.mode-grid button>span:nth-child(2){display:grid;gap:1px}.mode-grid strong{font-size:calc(10px * var(--clu-text-scale,1))}.mode-grid small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.45}.mode-grid i{font-style:normal;color:#8fe9ee;font-size:11px}.mode-icon{--mode-accent:#6fdde5;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:var(--mode-accent);background:color-mix(in srgb,var(--mode-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--mode-accent) 18%,transparent)}.cost-guide{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.cost-chip{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px;padding:0 10px;border:1px solid rgba(255,255,255,.065);border-radius:9px;background:rgba(255,255,255,.018)}.cost-chip span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.cost-chip strong{font-size:calc(10px * var(--clu-text-scale,1));white-space:nowrap}.constraint{grid-column:1/-1;margin:1px 0 0;padding:8px 9px;border-radius:8px;background:rgba(239,180,77,.07);font-size:calc(8px * var(--clu-text-scale,1));line-height:1.4;color:rgba(255,236,198,.72)}.constraint b{display:block;margin-bottom:2px;color:#f0c772}.identity-grid{display:grid;grid-template-columns:minmax(0,1fr) 96px 92px;gap:7px}.field{display:grid;gap:5px;font-size:calc(8.5px * var(--clu-text-scale,1));color:rgba(237,246,248,.62)}.field input{min-width:0;height:36px;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#111b21;color:inherit;padding:0 9px;outline:none}.field input:focus{border-color:rgba(83,216,224,.45)}.color-field>span{position:relative;height:36px}.color-field input{width:100%;padding:3px}.color-field b{display:none}.logo-box{display:grid;grid-template-columns:48px minmax(0,1fr);gap:11px;align-items:center;padding:9px 10px;border:1px solid rgba(255,255,255,.065);border-radius:10px;background:rgba(255,255,255,.018)}.logo-preview{width:46px;height:46px;border-radius:10px;display:grid;place-items:center;overflow:hidden;color:#081014;font-weight:900}.logo-preview img{width:100%;height:100%;object-fit:contain;background:#fff}.logo-box>div{display:grid;gap:3px}.logo-box strong{font-size:calc(9.5px * var(--clu-text-scale,1))}.logo-box strong small{font-weight:500;opacity:.42}.logo-box p{margin:0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.3;opacity:.47}.logo-actions{display:flex;gap:5px}.logo-actions button,.file-button{width:max-content;border:1px solid rgba(255,255,255,.09);border-radius:7px;background:rgba(255,255,255,.035);color:inherit;padding:5px 7px;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer}.file-button input{display:none}.logo-box .error{color:#ff9b9b;opacity:1}.actions{display:grid;grid-template-columns:minmax(110px,.7fr) minmax(170px,1.3fr);gap:8px;padding:12px 2px max(11px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);background:inherit;position:relative;z-index:2}.actions button{min-height:40px;border:1px solid rgba(255,255,255,.11);border-radius:9px;background:rgba(255,255,255,.045);color:inherit;padding:8px 12px;cursor:pointer;font-weight:750}.actions .primary{border-color:#54d6df;background:#54d6df;color:#071316;font-weight:900;box-shadow:0 5px 18px rgba(62,205,216,.16)}.actions .primary:hover{background:#6de1e8;filter:brightness(1.02)}
@media(max-width:560px){.mode-grid{grid-template-columns:1fr}.cost-guide{grid-template-columns:1fr}.identity-grid{grid-template-columns:1fr 1fr}.field.wide{grid-column:1/-1}.section-label{align-items:flex-start;flex-direction:column;gap:2px}}@media(max-height:700px){.creation-panel{height:calc(100dvh - 76px);max-height:calc(100dvh - 76px)}.creation-scroll{padding-bottom:14px}.actions button{min-height:42px}}
</style>
