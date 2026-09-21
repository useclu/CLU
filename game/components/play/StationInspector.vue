<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, ref, watch } from 'vue'
import { GAME_FINE_AMOUNT } from '../../config/inspection'
import { useGameSelection } from '../../composables/useGameSelection'
import { useGameNetwork } from '../../composables/useGameNetwork'
import { useGameSimulation } from '../../composables/useGameSimulation'
import { useGameStations } from '../../composables/useGameStations'
import { useGameTransitRuntime } from '../../composables/useGameTransitRuntime'
import { useGameRollingStock } from '../../composables/useGameRollingStock'
import { focusGameMapPoint } from '../../utils/mapBridge'
import { getLineTerminusStations } from '../../engine/network/geometry'

const selection = useGameSelection()
const network = useGameNetwork()
const simulation = useGameSimulation()
const stations = useGameStations()
const transitRuntime = useGameTransitRuntime()
const rollingStock = useGameRollingStock()
const name = ref('')

watch(
  () => selection.selectedStation.value?.name,
  value => { name.value = value ?? '' },
  { immediate: true },
)

const report = computed(() => {
  const line = selection.selectedLine.value
  const station = selection.selectedStation.value
  return line && station ? simulation.stationReport(line.id, station.id) : null
})
const lineReport = computed(() => {
  const line = selection.selectedLine.value
  return line ? simulation.reportForLine(line.id) : null
})
const stationInterchanges = computed(() => {
  const line = selection.selectedLine.value
  const station = selection.selectedStation.value
  return line && station ? transitRuntime.stationInterchanges(line.id, station.id) : []
})
const passages = computed(() => {
  const line = selection.selectedLine.value
  const station = selection.selectedStation.value
  return line && station ? transitRuntime.stationPassages(line.id, station.id, 3) : []
})

const interchangeLines = computed(() => {
  const line = selection.selectedLine.value
  if (!line) return []
  const ids = new Set<string>()
  for (const link of stationInterchanges.value) ids.add(link.fromLineId === line.id ? link.toLineId : link.fromLineId)
  return network.lines.value.filter(item => ids.has(item.id))
})

const directions = computed(() => {
  const line = selection.selectedLine.value
  if (!line || line.stations.length < 2) return []
  return getLineTerminusStations(line).map(station => station.name)
})


const reserveVehicles = computed(() => {
  const line = selection.selectedLine.value
  return line ? rollingStock.reserveVehicles(line) : 0
})
async function sendReinforcement() {
  const line = selection.selectedLine.value
  if (!line || reserveVehicles.value <= 0) return
  const current = line.regulationMode === 'MANUAL' ? (line.manualBoostVehicles ?? 0) : 0
  await rollingStock.setManualBoost(line.id, Math.min(reserveVehicles.value, current + 1))
}

const platformStatus = computed(() => {
  const utilization = report.value?.utilizationRate ?? 0
  const waiting = report.value?.estimatedPlatformPassengers ?? 0
  if (utilization >= 1.15 || waiting >= 2500) return { label: 'Très chargée', tone: 'critical' }
  if (utilization >= 0.92 || waiting >= 1000) return { label: 'Chargée', tone: 'warning' }
  if (utilization >= 0.65 || waiting >= 300) return { label: 'Animée', tone: 'medium' }
  return { label: 'Fluide', tone: 'good' }
})

function integer(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value) }
function eta(value: number) {
  if (value < .6) return '< 1 min'
  return `${Math.max(1, Math.round(value))} min`
}
async function rename() {
  const line = selection.selectedLine.value
  const station = selection.selectedStation.value
  if (line && station && name.value.trim()) await network.renameStation(line.id, station.id, name.value)
}
function openInterchange(lineId: string) {
  selection.selectLine(lineId)
  window.dispatchEvent(new CustomEvent('clu-open-network-line', { detail: { lineId } }))
}
function locateStation() {
  const station = selection.selectedStation.value
  if (station) focusGameMapPoint(station.longitude, station.latitude, 14)
}
</script>

<template>
  <aside v-if="selection.selectedLine.value && selection.selectedStation.value" class="station-inspector" aria-label="Inspecteur de station">
    <button class="close" type="button" aria-label="Fermer l’inspecteur de station" @click="selection.clear()">×</button>
    <div class="inspector-head">
      <div><span class="eyebrow">Station sélectionnée</span><div class="line-chip"><i :style="{ background: selection.selectedLine.value.color }" />{{ selection.selectedLine.value.shortCode }} · <span data-i18n-skip>{{ selection.selectedLine.value.name }}</span></div></div>
      <button class="map-link" type="button" @click="locateStation">◎ Carte</button>
    </div>

    <section class="identity-section">
      <span class="section-label">Identité</span>
      <div class="rename"><input v-model="name" maxlength="60" aria-label="Nom de la station" @keyup.enter="rename"><button type="button" @click="rename">Renommer</button></div>
      <div class="directions"><span>Directions</span><strong>{{ directions.join(' ↔ ') || '—' }}</strong></div>
    </section>

    <section class="service-section">
      <span class="section-label">Service en temps réel</span>
      <div v-if="passages.length" class="passages">
        <article v-for="passage in passages" :key="`${passage.vehicleId}-${passage.direction}`">
          <i :style="{ background: passage.color }" />
          <span><strong>{{ passage.shortCode }} · direction {{ passage.directionName }}</strong><small>{{ passage.lineName }}</small></span>
          <b>{{ eta(passage.etaMinutes) }}</b>
        </article>
      </div>
      <div v-else class="no-passage">Aucun passage calculable pour le moment.</div>
      <div class="service-actions">
        <button type="button" :disabled="reserveVehicles <= 0" @click="sendReinforcement">+1 renfort depuis la réserve</button>
        <small v-if="selection.selectedLine.value">{{ reserveVehicles }} véhicule(s) disponible(s) en réserve · régulation {{ selection.selectedLine.value.regulationMode === 'AUTO' ? 'auto' : 'manuelle' }}</small>
      </div>
    </section>

    <section class="connection-section">
      <span class="section-label">Correspondances</span>
      <strong v-if="!interchangeLines.length" class="empty-connection">Aucune</strong>
      <div v-else class="line-badges">
        <button v-for="item in interchangeLines" :key="item.id" type="button" :title="item.name" @click="openInterchange(item.id)">
          <img v-if="item.customLogoDataUrl" :src="item.customLogoDataUrl"><b v-else :style="{ background: item.color }">{{ item.shortCode }}</b><span data-i18n-skip>{{ item.name }}</span>
        </button>
      </div>
    </section>

    <div class="facility">
      <div class="facility-head"><strong>{{ stations.facilityDefinition(selection.selectedStation.value).label }}</strong><span class="platform-state" :class="`state-${platformStatus.tone}`">{{ platformStatus.label }}</span></div>
      <p>{{ stations.facilityDefinition(selection.selectedStation.value).description }}</p>
      <button v-if="stations.nextLevel(selection.selectedStation.value)" type="button" @click="stations.upgradeStation(selection.selectedLine.value.id, selection.selectedStation.value.id)">Améliorer la station</button>
    </div>

    <span class="section-label metrics-label">Flux & exploitation</span>
    <div class="grid">
      <div><span>Fréquentation/j</span><strong>{{ integer(report?.estimatedDailyFootfall ?? 0) }}</strong></div>
      <div><span>Sur le quai maintenant</span><strong>{{ integer(report?.estimatedPlatformPassengers ?? 0) }}</strong></div>
      <div><span>Pointe estimée sur quai</span><strong>{{ integer(report?.estimatedPeakPlatformPassengers ?? report?.estimatedPlatformPassengers ?? 0) }}</strong></div>
      <div><span>Capacité station</span><strong>{{ integer(report?.stationCapacity ?? stations.dailyCapacity(selection.selectedLine.value, selection.selectedStation.value)) }}</strong></div>
      <div><span>Saturation</span><strong>{{ Math.round((report?.utilizationRate ?? 0) * 100) }} %</strong></div>
      <div><span>Attente moyenne</span><strong>{{ Math.round(report?.averageWaitingTimeMinutes ?? lineReport?.averageWaitMinutes ?? 0) }} min</strong></div>
      <div><span>Demande servie</span><strong>{{ Math.round((lineReport?.demandSatisfactionRate ?? 1) * 100) }} %</strong></div>
      <div><span>Moral voyageurs</span><strong>{{ Math.round(lineReport?.moraleScoreAfter ?? 76) }}/100</strong></div>
      <div><span>Retard estimé</span><strong>+{{ Math.round(lineReport?.estimatedDelayMinutes ?? 0) }} min</strong></div>
      <div><span>Fraude estimée</span><strong>{{ integer(report?.fraudPassengers ?? 0) }}</strong></div>
      <div><span>Verbalisés</span><strong>{{ integer(report?.detectedFraudPassengers ?? 0) }}</strong></div>
      <div><span>Amende</span><strong>{{ GAME_FINE_AMOUNT }} €</strong></div>
      <div><span>Qualité station</span><strong>{{ Math.round(report?.qualityScore ?? 82) }}/100</strong></div>
    </div>

    <p class="hint">Les passages utilisent désormais la même circulation visuelle que les véhicules affichés sur la carte. Ils restent une simulation optimisée, pas un horaire ferroviaire réel à la seconde.</p>
  </aside>
</template>

<style scoped>
.station-inspector{position:absolute;right:18px;bottom:18px;z-index:18;width:min(390px,calc(100vw - 36px));max-height:calc(100vh - 112px);overflow:auto;scrollbar-width:thin;padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:rgba(9,15,20,.92);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.35);color:#eef7f8}.close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:inherit;font-size:calc(24px * var(--clu-text-scale,1));cursor:pointer}.inspector-head{display:flex;align-items:end;justify-content:space-between;gap:10px;padding-right:24px}.eyebrow,.section-label{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;opacity:.5}.line-chip{margin-top:6px;font-size:calc(12px * var(--clu-text-scale,1))}.line-chip i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}.map-link{border:1px solid rgba(91,214,223,.25);background:rgba(75,194,204,.09);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}.identity-section,.service-section,.connection-section{display:grid;gap:8px;margin-top:14px}.rename{display:flex;gap:7px}.rename input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:inherit;border-radius:8px;padding:8px}.rename button,.facility button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:inherit;border-radius:8px;padding:7px 9px}.directions{display:grid;padding:9px;border-radius:9px;background:rgba(255,255,255,.035)}.directions span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.directions strong{font-size:calc(12px * var(--clu-text-scale,1));margin-top:2px}.passages{display:grid;gap:6px}.passages article{display:grid;grid-template-columns:9px 1fr auto;align-items:center;gap:8px;padding:9px;border-radius:9px;background:rgba(255,255,255,.04)}.passages i{width:8px;height:8px;border-radius:50%}.passages span{display:grid}.passages strong{font-size:calc(11px * var(--clu-text-scale,1))}.passages small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.45;margin-top:2px}.passages b{font-size:calc(11px * var(--clu-text-scale,1))}.no-passage,.empty-connection{font-size:calc(11px * var(--clu-text-scale,1));opacity:.55}.service-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.service-actions button{border:1px solid rgba(91,214,223,.22);background:rgba(75,194,204,.09);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}.service-actions button:disabled{opacity:.35;cursor:not-allowed}.service-actions small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48}.line-badges{display:flex;flex-wrap:wrap;gap:6px}.line-badges button{display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;border-radius:9px;padding:5px 8px 5px 5px;cursor:pointer}.line-badges img,.line-badges b{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;object-fit:contain;color:#081014;font-size:calc(9px * var(--clu-text-scale,1))}.line-badges span{font-size:calc(10px * var(--clu-text-scale,1))}.facility{margin-top:14px;padding:11px;border-radius:10px;background:rgba(255,255,255,.04)}.facility-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.platform-state{font-size:calc(9px * var(--clu-text-scale,1));padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.06)}.state-good{color:#91e2ae;background:rgba(58,166,99,.12)}.state-medium{color:#e4d47b;background:rgba(174,147,54,.12)}.state-warning{color:#efb66c;background:rgba(180,107,45,.14)}.state-critical{color:#ff8f8f;background:rgba(181,58,58,.14)}.facility p,.hint{font-size:calc(11px * var(--clu-text-scale,1));opacity:.6}.metrics-label{display:block;margin-top:15px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.grid>div{display:grid;padding:8px;border-radius:8px;background:rgba(255,255,255,.035)}.grid span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.grid strong{font-size:calc(13px * var(--clu-text-scale,1));margin-top:2px}.hint{margin:10px 0 0;line-height:1.5}@media(max-height:700px){.station-inspector{top:92px;bottom:12px;max-height:none}}@media(max-width:650px){.station-inspector{left:78px;right:10px;width:auto;bottom:10px}.grid{grid-template-columns:1fr 1fr}}
</style>
