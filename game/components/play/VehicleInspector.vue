<script setup lang="ts">
import { formatGameInteger } from '../../config/i18n'
import type { GameVisualVehicle } from '../../engine/transitRuntime'
import { useGameNetwork } from '../../composables/useGameNetwork'
import { useGameSelection } from '../../composables/useGameSelection'
import { focusGameMapPoint } from '../../utils/mapBridge'
import { findLineStation } from '../../engine/network/geometry'
import { gameTimeLabel } from '../../engine/timetable'
import { getTransportModeDefinition } from '../../config/transportModes'
import { computed } from 'vue'

const props = defineProps<{ vehicle: GameVisualVehicle | null }>()
const emit = defineEmits<{ close: [] }>()
const network = useGameNetwork()
const selection = useGameSelection()

const modeLabel = computed(() => props.vehicle ? getTransportModeDefinition(props.vehicle.mode as any).label : '')
const motionLabel = computed(() => {
  const vehicle = props.vehicle
  if (!vehicle) return ''
  if (vehicle.isSubstitution) return vehicle.motionState === 'STOPPED' ? 'Bus de substitution à l’arrêt' : 'Bus de substitution en circulation'
  if (vehicle.motionState === 'STOPPED') return vehicle.currentStationName ? `À l’arrêt · ${vehicle.currentStationName}` : 'À l’arrêt'
  if (vehicle.motionState === 'ACCELERATING') return 'Départ / accélération'
  if (vehicle.motionState === 'DECELERATING') return 'Approche station'
  return 'En circulation'
})

function integer(value: number) { return formatGameInteger(value) }
function openNextStation() {
  const vehicle = props.vehicle
  if (!vehicle) return
  const line = network.lines.value.find(item => item.id === vehicle.lineId)
  const station = line ? findLineStation(line, vehicle.nextStationId) : null
  if (!line || !station) return
  selection.selectStation(line.id, station.id)
  focusGameMapPoint(station.longitude, station.latitude, 14)
  emit('close')
}
function openLine() {
  const vehicle = props.vehicle
  if (!vehicle) return
  selection.selectLine(vehicle.lineId)
  window.dispatchEvent(new CustomEvent('clu-open-network-line', { detail: { lineId: vehicle.lineId } }))
  emit('close')
}
</script>

<template>
  <aside v-if="props.vehicle" class="vehicle-inspector">
    <button class="close" type="button" @click="emit('close')">×</button>
    <span class="eyebrow">{{ props.vehicle.isSubstitution ? 'Service temporaire BUS' : 'Véhicule en circulation' }}</span>
    <button class="vehicle-title" type="button" @click="openLine"><i :style="{ background: props.vehicle.color }" /><strong>{{ props.vehicle.shortCode }} · {{ props.vehicle.lineName }}</strong><span>Voir la ligne →</span></button>
    <div class="direction">Direction <strong>{{ props.vehicle.terminusName }}</strong><template v-if="props.vehicle.missionCode"> · mission <strong>{{ props.vehicle.missionCode }}</strong></template><br><span class="motion-state">{{ motionLabel }}</span></div>
    <div class="grid">
      <div v-if="props.vehicle.missionCode"><span>Mission</span><strong>{{ props.vehicle.missionCode }}</strong></div>
      <div v-if="props.vehicle.scheduledDepartureMinute !== undefined"><span>Départ prévu</span><strong>{{ gameTimeLabel(props.vehicle.scheduledDepartureMinute) }}</strong></div><div v-if="props.vehicle.effectiveDepartureMinute !== undefined && props.vehicle.effectiveDepartureMinute !== props.vehicle.scheduledDepartureMinute"><span>Départ réel PCC</span><strong>{{ gameTimeLabel(props.vehicle.effectiveDepartureMinute) }}</strong></div><div v-if="props.vehicle.isExtraService"><span>Service</span><strong>Circulation de renfort</strong></div><div v-if="props.vehicle.isSubstitution"><span>Service</span><strong>Bus de substitution</strong></div>
      <div><span>Type</span><strong>{{ modeLabel }}</strong></div>
      <div><span>Génération</span><strong>{{ props.vehicle.generation }}</strong></div>
      <div><span>Régularité ligne</span><strong>{{ Math.round(props.vehicle.regularityScore) }}/100</strong></div>
      <div><span>Circulation</span><strong>{{ props.vehicle.id.split('-').slice(-1)[0]?.toUpperCase() }}</strong></div>
      <div><span>Voyageurs à bord</span><strong>{{ integer(props.vehicle.passengers) }}</strong></div>
      <div><span>Capacité</span><strong>{{ integer(props.vehicle.capacity) }}</strong></div>
      <div><span>Occupation</span><strong>{{ Math.round(props.vehicle.occupancyRate * 100) }} %</strong></div>
      <div><span>Retard estimé</span><strong>+{{ Math.round(props.vehicle.delayMinutes) }} min</strong></div>
      <button class="wide next-stop" type="button" @click="openNextStation"><span>Prochain arrêt</span><strong>{{ props.vehicle.nextStationName }} · ~{{ props.vehicle.etaNextMinutes }} min</strong><small>Ouvrir la station →</small></button>
      <div class="wide"><span>Terminus</span><strong>{{ props.vehicle.terminusName }} · ~{{ props.vehicle.etaTerminusMinutes }} min</strong></div>
    </div>
    <p v-if="props.vehicle.missionCode">Cette circulation suit la grille horaire et les décisions du PCC en temps réel : retard, renfort ou terminus temporaire sont appliqués directement à sa position et à son parcours.</p>
    <p v-else>La circulation visuelle, la fiche véhicule et les prochains passages des stations utilisent désormais la même source de simulation.</p>
  </aside>
</template>

<style scoped>
.vehicle-inspector{position:absolute;right:18px;top:96px;z-index:24;width:min(340px,calc(100vw - 36px));max-height:calc(100vh - 116px);overflow:auto;padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:rgba(8,14,19,.93);backdrop-filter:blur(18px);box-shadow:0 20px 55px rgba(0,0,0,.42);color:#eef7f8}.close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:inherit;font-size:calc(22px * var(--clu-text-scale,1));cursor:pointer}.eyebrow{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;opacity:.5}.vehicle-title{width:100%;border:0;background:transparent;color:inherit;display:grid;grid-template-columns:11px 1fr auto;align-items:center;gap:8px;margin:7px 0 4px;padding:0;text-align:left;cursor:pointer}.vehicle-title i{width:11px;height:11px;border-radius:50%}.vehicle-title span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.direction{font-size:calc(12px * var(--clu-text-scale,1));opacity:.72;margin-bottom:12px}.motion-state{font-size:calc(9px * var(--clu-text-scale,1));opacity:.72;color:#8ee5ea}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.grid>div,.grid>button{padding:9px;border-radius:9px;background:rgba(255,255,255,.045);display:grid;gap:3px;border:0;color:inherit;text-align:left}.grid .wide{grid-column:1/-1}.grid span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.grid strong{font-size:calc(13px * var(--clu-text-scale,1))}.next-stop{cursor:pointer;border:1px solid rgba(78,208,218,.16)!important}.next-stop small{font-size:calc(9px * var(--clu-text-scale,1));color:#83dfe5;margin-top:3px}.vehicle-inspector p{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.5;opacity:.5;margin:12px 0 0}
</style>
