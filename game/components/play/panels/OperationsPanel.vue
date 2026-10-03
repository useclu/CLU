<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { currentGameLocale, translateGameText, formatGameInteger, formatGameCurrencyCompact } from '../../../config/i18n'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'
import { useGameClock } from '../../../composables/useGameClock'
import { useGameOperations } from '../../../composables/useGameOperations'
import { useGameTransitRuntime } from '../../../composables/useGameTransitRuntime'
import { useGameRollingStock } from '../../../composables/useGameRollingStock'
import { useCluOnline } from '../../../composables/useCluOnline'
import { getLineAllStations } from '../../../engine/network/geometry'
import { gameTimeLabel, parseGameTime } from '../../../engine/timetable'
import { gameDayAndMinuteFromAbsolute } from '../../../engine/operations'
import type { GameLine, GameStation } from '../../../types/network'
import type { GameDisruptionScope, GameDisruptionSeverity, GameDisruptionType, GameManualDisruption, GameOperationalRun, GamePccControlLevel } from '../../../types/operations'

const game = useMetropoleGame()
const clock = useGameClock()
const operations = useGameOperations()
const transit = useGameTransitRuntime()
const rollingStock = useGameRollingStock()
const online = useCluOnline()

const onlineSession = computed(() => online.sessionConnectee.value)
const canManagePcc = computed(() => !onlineSession.value || online.peut('gerer_pcc'))
const canManageIncidents = computed(() => !onlineSession.value || online.peut('gerer_incidents'))
const pccLockedReason = computed(() => canManagePcc.value ? '' : translateGameText('Permission requise : gérer le PCC.', currentGameLocale()))
const incidentsLockedReason = computed(() => canManageIncidents.value ? '' : translateGameText('Permission requise : gérer les incidents.', currentGameLocale()))

const operationalLines = computed(() => game.state.value.save?.data.network.lines.filter(line => line.status === 'OPERATIONAL') ?? [])
const selectedLineId = ref(operationalLines.value[0]?.id ?? '')
const selectedLine = computed<GameLine | null>(() => operationalLines.value.find(line => line.id === selectedLineId.value) ?? operationalLines.value[0] ?? null)

watch(operationalLines, (lines) => {
  if (!lines.some(line => line.id === selectedLineId.value)) selectedLineId.value = lines[0]?.id ?? ''
})

const upcomingRuns = computed(() => selectedLine.value ? operations.lineUpcomingRuns(selectedLine.value, 12) : [])
const lineVehicles = computed(() => transit.vehicles.value.filter(vehicle => vehicle.lineId === selectedLine.value?.id))
const lineActiveDisruptions = computed(() => operations.activeDisruptions.value.filter(item => item.lineId === selectedLine.value?.id))
const linePlannedDisruptions = computed(() => operations.plannedDisruptions.value.filter(item => item.lineId === selectedLine.value?.id))
const lineSubstitutions = computed(() => operations.activeSubstitutions.value.filter(item => item.lineId === selectedLine.value?.id))
const controlLevel = computed<GamePccControlLevel>(() => selectedLine.value ? operations.pccControlLevel(selectedLine.value.id) : 'SIMPLE')
const availableReserve = computed(() => selectedLine.value ? operations.availableReserveVehicles(selectedLine.value) : 0)
const activeStationWorks = computed(() => (operations.state.value.stationWorks ?? []).filter(item => item.status === 'ACTIVE' && (!selectedLine.value || item.lineId === selectedLine.value.id)))
const stations = computed(() => selectedLine.value ? getLineAllStations(selectedLine.value) : [])
const missionOptions = computed(() => selectedLine.value?.schedule?.missions.filter(item => item.enabled) ?? [])

const historyForLine = computed(() => operations.state.value.history
  .filter(item => !selectedLine.value || item.lineId === selectedLine.value.id)
  .slice(-18)
  .reverse())

const selectedMissionId = ref('')
const extraDeparture = ref('')
watch(selectedLine, (line) => {
  selectedMissionId.value = line?.schedule?.missions.find(item => item.enabled)?.id ?? ''
  extraDeparture.value = gameTimeLabel((operations.currentMinute.value + 5) % 1440)
}, { immediate: true })

const disruptionTitle = ref('')
const passengerMessage = ref('')
const disruptionType = ref<GameDisruptionType>('TECHNICAL')
const disruptionSeverity = ref<GameDisruptionSeverity>('MODERATE')
const disruptionScope = ref<GameDisruptionScope>('LINE')
const disruptionStationIds = ref<string[]>([])
const segmentFromStationId = ref('')
const segmentToStationId = ref('')
const disruptionStart = ref(gameTimeLabel(operations.currentMinute.value))
const disruptionDuration = ref(60)
const disruptionDelay = ref(10)
const disruptionCancellationPercent = ref(12)
const disruptionCapacityPercent = ref(88)
const disruptionSuspended = ref(false)
const operationMessage = ref('')

const SEVERITY_LABELS: Record<GameDisruptionSeverity, string> = {
  MINOR: 'Mineure',
  MODERATE: 'Modérée',
  MAJOR: 'Majeure',
  CRITICAL: 'Critique',
}
const TYPE_LABELS: Record<GameDisruptionType, string> = {
  TECHNICAL: 'Incident technique',
  PASSENGER: 'Incident voyageur',
  SECURITY: 'Sécurité',
  STAFF: 'Personnel',
  WEATHER: 'Météo',
  WORKS: 'Travaux',
  CUSTOM: 'Personnalisée',
}
const severityOptions: GameDisruptionSeverity[] = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']
const SCOPE_LABELS: Record<GameDisruptionScope, string> = {
  LINE: 'Toute la ligne',
  STATIONS: 'Stations',
  SEGMENT: 'Segment',
}

function integer(value: number) {
  return formatGameInteger(value)
}

function formatAbsoluteMinute(value: number) {
  const parsed = gameDayAndMinuteFromAbsolute(value)
  return `Jour ${parsed.day} · ${gameTimeLabel(parsed.minute)}`
}

function applySeverityPreset(severity: GameDisruptionSeverity) {
  disruptionSeverity.value = severity
  const preset = operations.presets[severity]
  disruptionDelay.value = preset.delayMinutes
  disruptionCancellationPercent.value = Math.round(preset.cancellationRate * 100)
  disruptionCapacityPercent.value = Math.round(preset.capacityMultiplier * 100)
}

function routeDestination(run: GameOperationalRun & { relativeMinute?: number }) {
  const id = run.routeStationIds[run.routeStationIds.length - 1]
  return stations.value.find(station => station.id === id)?.name ?? run.missionName
}

function runStatus(run: GameOperationalRun) {
  if (run.cancelled) return run.cancelledByDisruption ? 'Supprimé par perturbation' : 'Supprimé par le PCC'
  if (run.delayMinutes >= 15) return `Retard +${Math.round(run.delayMinutes)} min`
  if (run.delayMinutes > 0) return `+${Math.round(run.delayMinutes)} min`
  if (run.extra) return 'Renfort'
  return 'À l’heure'
}

function shortTurnOptions(run: GameOperationalRun) {
  const line = selectedLine.value
  const mission = line?.schedule?.missions.find(item => item.id === run.missionId)
  if (!mission) return []
  return mission.routeStationIds.slice(1, -1)
    .map(id => stations.value.find(station => station.id === id))
    .filter((station): station is GameStation => Boolean(station))
}

async function addDelay(run: GameOperationalRun, value: number) {
  if (!canManagePcc.value) return
  operationMessage.value = ''
  await operations.setTripDelay(run.lineId, run.day, run.missionId, run.scheduledDepartureMinute, Math.max(0, run.manualDelayMinutes + value))
}

async function cancelOrRestore(run: GameOperationalRun) {
  if (!canManagePcc.value) return
  operationMessage.value = ''
  if (run.cancelledByDisruption) {
    operationMessage.value = 'Cette course est supprimée par une perturbation active. Modifiez ou terminez la perturbation pour la rétablir.'
    return
  }
  await operations.setTripCancelled(run.lineId, run.day, run.missionId, run.scheduledDepartureMinute, !run.cancelled)
}

async function changeShortTurn(run: GameOperationalRun, event: Event) {
  if (!canManagePcc.value) return
  const stationId = (event.target as HTMLSelectElement).value || null
  await operations.setTripShortTurn(run.lineId, run.day, run.missionId, run.scheduledDepartureMinute, stationId)
}

async function resetRun(run: GameOperationalRun) {
  if (!canManagePcc.value) return
  await operations.resetTrip(run.lineId, run.day, run.missionId, run.scheduledDepartureMinute)
}

function money(value: number) {
  return formatGameCurrencyCompact(value)
}
const selectedReinforcementCost = computed(() => selectedLine.value ? operations.reinforcementCost(selectedLine.value.id) : 0)

async function addExtraTrip() {
  if (!canManagePcc.value) return
  operationMessage.value = ''
  if (!selectedLine.value || !selectedMissionId.value) return
  const minute = parseGameTime(extraDeparture.value)
  if (minute === null) {
    operationMessage.value = 'Heure de départ invalide.'
    return
  }
  const added = await operations.addExtraTrip(selectedLine.value.id, selectedMissionId.value, minute)
  operationMessage.value = added
    ? `Circulation de renfort ajoutée à ${gameTimeLabel(minute)} · ${money(selectedReinforcementCost.value)}.`
    : 'Renfort impossible : trésorerie insuffisante.'
}

async function changeControlLevel(level: GamePccControlLevel) {
  if (!canManagePcc.value) return
  if (!selectedLine.value) return
  operationMessage.value = ''
  await operations.setPccControlLevel(selectedLine.value.id, level)
}

async function changeReserveBoost(delta: number) {
  if (!canManagePcc.value) return
  if (!selectedLine.value) return
  await rollingStock.setManualBoost(selectedLine.value.id, Math.max(0, (selectedLine.value.manualBoostVehicles ?? 0) + delta))
}


function substitutionFor(disruptionId: string) {
  return lineSubstitutions.value.find(item => item.disruptionId === disruptionId) ?? null
}

function substitutionEstimate(item: GameManualDisruption) {
  return operations.substitutionEstimate(item.id)
}

async function startSubstitution(item: GameManualDisruption) {
  if (!canManageIncidents.value) return
  operationMessage.value = ''
  const result = await operations.startBusSubstitution(item.id)
  operationMessage.value = result.ok
    ? result.alreadyActive ? 'Le bus de substitution est déjà actif.' : 'Bus de substitution mis en service immédiatement.'
    : result.reason === 'BUDGET' ? `Trésorerie insuffisante : ${money(result.cost ?? 0)} nécessaires.` : 'Bus de substitution impossible sur cette perturbation.'
}

async function stopSubstitution(id: string) {
  if (!canManageIncidents.value) return
  operationMessage.value = ''
  const ok = await operations.stopBusSubstitution(id)
  operationMessage.value = ok ? 'Bus de substitution terminé.' : 'Impossible de terminer ce service.'
}

async function automaticResponse(item: GameManualDisruption) {
  if (!canManageIncidents.value) return
  operationMessage.value = ''
  const result = await operations.applyAutomaticResponse(item.id)
  operationMessage.value = result.message
}

function toggleDisruptionStation(id: string) {
  const set = new Set(disruptionStationIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  disruptionStationIds.value = [...set]
}

async function createDisruption() {
  if (!canManageIncidents.value) return
  operationMessage.value = ''
  const line = selectedLine.value
  if (!line) return
  const startMinute = parseGameTime(disruptionStart.value)
  if (startMinute === null) {
    operationMessage.value = 'Heure de début invalide.'
    return
  }
  if (disruptionScope.value === 'STATIONS' && disruptionStationIds.value.length === 0) {
    operationMessage.value = 'Choisissez au moins une station concernée.'
    return
  }
  if (disruptionScope.value === 'SEGMENT' && (!segmentFromStationId.value || !segmentToStationId.value || segmentFromStationId.value === segmentToStationId.value)) {
    operationMessage.value = 'Choisissez deux stations différentes pour le segment.'
    return
  }
  await operations.createDisruption({
    lineId: line.id,
    title: disruptionTitle.value,
    passengerMessage: passengerMessage.value,
    type: disruptionType.value,
    severity: disruptionSeverity.value,
    scope: disruptionScope.value,
    stationIds: disruptionStationIds.value,
    segmentFromStationId: segmentFromStationId.value || null,
    segmentToStationId: segmentToStationId.value || null,
    startMinute,
    durationMinutes: disruptionDuration.value,
    delayMinutes: disruptionDelay.value,
    cancellationRate: disruptionCancellationPercent.value / 100,
    capacityMultiplier: disruptionCapacityPercent.value / 100,
    suspended: disruptionSuspended.value,
  })
  disruptionTitle.value = ''
  passengerMessage.value = ''
  disruptionSuspended.value = false
  operationMessage.value = 'Perturbation enregistrée dans le PCC.'
}


function editableMissionStops(run: GameOperationalRun) {
  const mission = selectedLine.value?.schedule?.missions.find(item => item.id === run.missionId)
  if (!mission) return []
  const first = mission.routeStationIds[0]
  const last = mission.routeStationIds[mission.routeStationIds.length - 1]
  return mission.stopStationIds
    .filter(id => id !== first && id !== last)
    .map(id => stations.value.find(station => station.id === id))
    .filter((station): station is GameStation => Boolean(station))
}

async function toggleRunStop(run: GameOperationalRun, stationId: string) {
  if (!canManagePcc.value) return
  if (run.cancelled) return
  await operations.toggleSkippedStation(run.lineId, run.day, run.missionId, run.scheduledDepartureMinute, stationId)
}

async function removeExtraRun(run: GameOperationalRun) {
  if (!canManagePcc.value) return
  if (!run.sourceExtraTripId) return
  await operations.removeExtraTrip(run.sourceExtraTripId)
}

function statusClass(run: GameOperationalRun) {
  if (run.cancelled) return 'danger'
  if (run.delayMinutes >= 10) return 'warning'
  if (run.extra) return 'extra'
  return 'ok'
}
</script>

<template>
  <div class="operations-panel">
    <section class="pcc-hero">
      <div>
        <span class="pcc-kicker">Exploitation</span>
        <h2>Régulation</h2>
        <p>Surveillez une ligne, renforcez-la ou gérez un incident. Les commandes avancées restent repliées tant qu’elles ne servent pas.</p>
      </div>
      <div class="pcc-clock"><strong>{{ clock.timeLabel.value }}</strong><small>Jour {{ operations.day.value }}</small></div>
    </section>

    <div class="pcc-kpis pcc-kpis--essential">
      <div><small>Incidents actifs</small><strong>{{ operations.activeDisruptions.value.length }}</strong></div>
      <div><small>Renforts aujourd’hui</small><strong>{{ operations.state.value.extraTrips.filter(item => item.day === operations.day.value).length }}</strong></div>
      <div><small>Bus de substitution</small><strong>{{ operations.activeSubstitutions.value.length }}</strong></div>
    </div>
    <details class="pcc-fold pcc-fold--metrics">
      <summary>Autres indicateurs</summary>
      <div class="pcc-kpis">
        <div><small>Véhicules visibles</small><strong>{{ transit.vehicles.value.length }}</strong></div>
        <div><small>Décisions PCC</small><strong>{{ operations.state.value.tripOverrides.length }}</strong></div>
        <div><small>Chantiers stations</small><strong>{{ (operations.state.value.stationWorks ?? []).filter(item => item.status === 'ACTIVE').length }}</strong></div>
      </div>
    </details>

    <section class="pcc-section line-control">
      <div class="section-heading"><div><span>Supervision</span><h3>Ligne contrôlée</h3></div><span v-if="selectedLine" class="line-chip" :style="{ '--line-color': selectedLine.color }">{{ selectedLine.shortCode }} · {{ selectedLine.name }}</span></div>
      <select v-model="selectedLineId" class="wide-select">
        <option v-for="line in operationalLines" :key="line.id" :value="line.id">{{ line.shortCode }} · {{ line.name }}</option>
      </select>
      <p v-if="!operationalLines.length" class="empty-state">Aucune ligne en exploitation. Ouvrez d’abord une ligne pour utiliser le PCC.</p>
      <div v-else-if="selectedLine" class="line-live-summary">
        <span><b>{{ lineVehicles.length }}</b> véhicule(s) actuellement visibles</span>
        <span><b>{{ lineActiveDisruptions.length }}</b> perturbation(s) active(s)</span>
        <span><b>{{ availableReserve }}</b> véhicule(s) réellement disponible(s) en réserve</span>
        <span><b>{{ lineSubstitutions.length }}</b> substitution(s) BUS active(s)</span>
      </div>
    </section>

    <template v-if="selectedLine">
      <section v-if="activeStationWorks.length" class="pcc-section station-works-section">
        <div class="section-heading"><div><span>Infrastructure</span><h3>Travaux de stations</h3></div></div>
        <div class="works-list">
          <article v-for="work in activeStationWorks" :key="work.id"><div><strong>🚧 {{ work.stationName }}</strong><small>Capacité cible {{ work.targetFacilityLevel }} · chantier Jour {{ work.startDay }} → {{ work.endDay }}</small></div><b>{{ Math.max(0, work.endDay - operations.day.value) }} j</b></article>
        </div>
      </section>

      <section class="pcc-section regulation-section">
        <p v-if="!canManagePcc" class="permission-note">🔒 {{ pccLockedReason }}</p>
        <div class="section-heading"><div><span>Régulation</span><h3>Réserve et renfort immédiat</h3></div></div>
        <div class="regulation-grid">
          <div class="segmented segmented-3">
            <button type="button" :class="{ active: controlLevel === 'AUTO' }" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" @click="changeControlLevel('AUTO')">Automatique</button>
            <button type="button" :class="{ active: controlLevel === 'SIMPLE' }" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" @click="changeControlLevel('SIMPLE')">Simple</button>
            <button type="button" :class="{ active: controlLevel === 'ADVANCED' }" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" @click="changeControlLevel('ADVANCED')">Avancé</button>
          </div>
          <p class="control-help">{{ controlLevel === 'AUTO' ? 'CLU privilégie une réponse raisonnable aux perturbations importantes.' : controlLevel === 'SIMPLE' ? 'Vous gardez les décisions utiles sans la régulation course par course.' : 'Toutes les commandes PCC, y compris chaque circulation, sont disponibles.' }}</p>
          <div class="boost-control">
            <span>Renfort depuis la réserve</span>
            <div><button type="button" :disabled="game.isReadOnly.value || !canManagePcc || (selectedLine.manualBoostVehicles ?? 0) <= 0" :title="pccLockedReason || undefined" @click="changeReserveBoost(-1)">−</button><strong>{{ selectedLine.manualBoostVehicles ?? 0 }}</strong><button type="button" :disabled="game.isReadOnly.value || !canManagePcc || (selectedLine.manualBoostVehicles ?? 0) >= rollingStock.reserveVehicles(selectedLine)" :title="pccLockedReason || undefined" @click="changeReserveBoost(1)">+</button></div>
          </div>
        </div>
      </section>

      <details class="pcc-fold">
        <summary><span><b>Circulations</b><small>Départs et renforts course par course</small></span></summary>
        <div class="pcc-fold__content">
      <section class="pcc-section">
        <div class="section-heading"><div><span>Circulations</span><h3>Prochains départs</h3></div><small v-if="selectedLine.schedule?.mode !== 'TIMETABLE'">Disponible avec Horaires personnalisés</small></div>

        <div v-if="selectedLine.schedule?.mode === 'TIMETABLE' && controlLevel === 'ADVANCED'" class="runs-list">
          <article v-for="run in upcomingRuns" :key="run.id" class="run-card" :class="statusClass(run)">
            <div class="run-main">
              <div class="run-time"><strong>{{ gameTimeLabel(run.scheduledDepartureMinute) }}</strong><small v-if="run.delayMinutes">→ {{ gameTimeLabel(run.effectiveDepartureMinute) }}</small></div>
              <div class="run-identity"><b>{{ run.missionCode }}</b><span>{{ routeDestination(run) }}</span><small>{{ runStatus(run) }}</small></div>
              <span v-if="run.extra" class="run-badge">RENFORT</span>
            </div>
            <div class="run-actions">
              <button type="button" :disabled="game.isReadOnly.value || !canManagePcc || run.cancelled" :title="pccLockedReason || undefined" @click="addDelay(run, 5)">+5 min</button>
              <button type="button" :disabled="game.isReadOnly.value || !canManagePcc || run.cancelled" :title="pccLockedReason || undefined" @click="addDelay(run, 10)">+10</button>
              <button type="button" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" :class="{ danger: !run.cancelled }" @click="cancelOrRestore(run)">{{ run.cancelled ? 'Rétablir' : 'Supprimer' }}</button>
              <select :value="run.shortTurnStationId ?? ''" :disabled="game.isReadOnly.value || !canManagePcc || run.cancelled" :title="pccLockedReason || undefined" aria-label="Terminus temporaire" @change="changeShortTurn(run, $event)">
                <option value="">Terminus normal</option>
                <option v-for="station in shortTurnOptions(run)" :key="station.id" :value="station.id">Terminus {{ station.name }}</option>
              </select>
              <button v-if="run.extra" type="button" class="danger" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" @click="removeExtraRun(run)">Retirer le renfort</button>
              <button v-else type="button" class="quiet" :disabled="game.isReadOnly.value || !canManagePcc" :title="pccLockedReason || undefined" @click="resetRun(run)">Réinitialiser</button>
            </div>
            <details v-if="editableMissionStops(run).length" class="run-stops">
              <summary>Desserte de cette course</summary>
              <div><button v-for="station in editableMissionStops(run)" :key="station.id" type="button" :class="{ active: run.stopStationIds.includes(station.id) }" :disabled="game.isReadOnly.value || !canManagePcc || run.cancelled" :title="pccLockedReason || undefined" @click="toggleRunStop(run, station.id)">{{ station.name }}</button></div>
              <small>Un arrêt désactivé reste traversé physiquement mais n'est plus desservi par cette course.</small>
            </details>
          </article>
          <p v-if="!upcomingRuns.length" class="empty-state">Aucune circulation à venir dans cette grille.</p>
        </div>
        <p v-else-if="selectedLine.schedule?.mode !== 'TIMETABLE'" class="empty-state">Cette ligne utilise encore la fréquence automatique. Passez-la sur « Horaires personnalisés » dans Réseau pour gérer course par course.</p>
        <p v-else class="empty-state">La régulation course par course est volontairement masquée en mode {{ controlLevel === 'AUTO' ? 'Automatique' : 'Simple' }}. Passez en « Avancé » si vous voulez agir sur chaque circulation.</p>
      </section>

      <section v-if="selectedLine.schedule?.mode === 'TIMETABLE'" class="pcc-section extra-service">
        <div class="section-heading"><div><span>Réserve</span><h3>Injecter une circulation de renfort</h3></div><small>Sur infrastructure existante uniquement</small></div>
        <div class="extra-form">
          <label>Mission<select v-model="selectedMissionId"><option v-for="mission in missionOptions" :key="mission.id" :value="mission.id">{{ mission.code }} · {{ mission.name }}</option></select></label>
          <label>Départ<input v-model="extraDeparture" type="time"></label>
          <button type="button" :disabled="game.isReadOnly.value || !canManagePcc || !selectedMissionId || availableReserve <= 0" :title="pccLockedReason || undefined" @click="addExtraTrip">{{ `Ajouter le renfort · ${money(selectedReinforcementCost)}` }}</button>
        </div>
      </section>

        </div>
      </details>

      <details class="pcc-fold" :open="lineActiveDisruptions.length > 0">
        <summary><span><b>Incidents & information voyageurs</b><small>{{ lineActiveDisruptions.length + linePlannedDisruptions.length }} perturbation(s) sur cette ligne</small></span></summary>
        <div class="pcc-fold__content">
      <section class="pcc-section disruption-creator">
        <p v-if="!canManageIncidents" class="permission-note">🔒 {{ incidentsLockedReason }}</p>
        <div class="section-heading"><div><span>Information voyageurs</span><h3>Créer une perturbation</h3></div></div>
        <div class="severity-row">
          <button v-for="severity in severityOptions" :key="severity" type="button" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" :class="{ active: disruptionSeverity === severity }" @click="applySeverityPreset(severity)">{{ SEVERITY_LABELS[severity] }}</button>
        </div>
        <div class="form-grid">
          <label class="span-2">Titre<input v-model="disruptionTitle" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="text" maxlength="100" placeholder="Ex. Incident d’exploitation"></label>
          <label>Type<select v-model="disruptionType" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined"><option v-for="(label, value) in TYPE_LABELS" :key="value" :value="value">{{ label }}</option></select></label>
          <label>Portée<select v-model="disruptionScope" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined"><option v-for="(label, value) in SCOPE_LABELS" :key="value" :value="value">{{ label }}</option></select></label>
          <label>Début<input v-model="disruptionStart" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="time"></label>
          <label>Durée (min)<input v-model.number="disruptionDuration" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="number" min="5" max="10080" step="5"></label>
          <label>Retard ajouté<input v-model.number="disruptionDelay" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="number" min="0" max="180" step="1"></label>
          <label>Courses supprimées (%)<input v-model.number="disruptionCancellationPercent" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="number" min="0" max="100" step="1"></label>
          <label>Capacité restante (%)<input v-model.number="disruptionCapacityPercent" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="number" min="0" max="100" step="1"></label>
          <label class="switch-label"><input v-model="disruptionSuspended" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" type="checkbox"><span><b>Interruption totale</b><small>La portée choisie est considérée comme interrompue pendant la période.</small></span></label>
          <label class="span-2">Message voyageurs<textarea v-model="passengerMessage" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" rows="3" maxlength="600" placeholder="Message affiché aux voyageurs…"></textarea></label>
        </div>

        <div v-if="disruptionScope === 'STATIONS'" class="station-picker">
          <small>Stations concernées</small>
          <div><button v-for="station in stations" :key="station.id" type="button" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined" :class="{ active: disruptionStationIds.includes(station.id) }" @click="toggleDisruptionStation(station.id)">{{ station.name }}</button></div>
        </div>
        <div v-else-if="disruptionScope === 'SEGMENT'" class="segment-picker">
          <label>De<select v-model="segmentFromStationId" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined"><option value="">Choisir…</option><option v-for="station in stations" :key="station.id" :value="station.id">{{ station.name }}</option></select></label>
          <label>À<select v-model="segmentToStationId" :disabled="!canManageIncidents" :title="incidentsLockedReason || undefined"><option value="">Choisir…</option><option v-for="station in stations" :key="station.id" :value="station.id">{{ station.name }}</option></select></label>
        </div>
        <button type="button" class="primary-action" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="createDisruption">Publier la perturbation</button>
      </section>

      <p v-if="operationMessage" class="operation-message">{{ operationMessage }}</p>

      <section class="pcc-section disruptions-list">
        <div class="section-heading"><div><span>État du réseau</span><h3>Perturbations actives et prévues</h3></div></div>
        <article v-for="item in [...lineActiveDisruptions, ...linePlannedDisruptions]" :key="item.id" class="disruption-card" :class="item.severity.toLowerCase()">
          <div><span>{{ SEVERITY_LABELS[item.severity] }} · {{ TYPE_LABELS[item.type] }}</span><h4>{{ item.title }}</h4><p v-if="item.passengerMessage" data-i18n-skip>{{ item.passengerMessage }}</p><small>{{ formatAbsoluteMinute(item.startsAtAbsoluteMinute) }} → {{ formatAbsoluteMinute(item.endsAtAbsoluteMinute) }} · +{{ item.delayMinutes }} min · {{ Math.round(item.cancellationRate * 100) }} % supprimées</small></div>
          <div v-if="item.startsAtAbsoluteMinute <= operations.currentAbsoluteMinute.value && !item.resolvedAt" class="response-box">
            <small v-if="substitutionEstimate(item)">Réponse possible · BUS de substitution {{ substitutionEstimate(item)?.stationIds.length }} arrêts · toutes les {{ substitutionEstimate(item)?.headwayMinutes }} min · {{ money(substitutionEstimate(item)?.cost ?? 0) }}</small>
            <div class="disruption-actions">
              <button v-if="controlLevel === 'AUTO'" type="button" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="automaticResponse(item)">Appliquer la réponse CLU</button>
              <button v-if="!substitutionFor(item.id) && (item.suspended || item.severity === 'CRITICAL' || item.severity === 'MAJOR')" type="button" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="startSubstitution(item)">🚌 Bus de substitution</button>
              <button v-if="substitutionFor(item.id)" type="button" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="stopSubstitution(substitutionFor(item.id)!.id)">Terminer la substitution</button>
              <button type="button" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="canManageIncidents && operations.resolveDisruption(item.id)">Terminer l’incident</button>
              <button type="button" class="danger" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="canManageIncidents && operations.deleteDisruption(item.id)">Supprimer</button>
            </div>
          </div>
          <div v-else class="disruption-actions"><button type="button" class="danger" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="canManageIncidents && operations.deleteDisruption(item.id)">Supprimer</button></div>
        </article>
        <p v-if="!lineActiveDisruptions.length && !linePlannedDisruptions.length" class="empty-state">Aucune perturbation active ou programmée sur cette ligne.</p>
      </section>

      <section v-if="lineSubstitutions.length" class="pcc-section substitutions-section">
        <div class="section-heading"><div><span>Substitution</span><h3>Bus temporaires en circulation</h3></div><small>BUS uniquement · fin automatique avec l’incident</small></div>
        <div class="substitution-list">
          <article v-for="service in lineSubstitutions" :key="service.id">
            <div><strong>🚌 {{ service.buses }} bus · toutes les {{ service.headwayMinutes }} min</strong><small>{{ service.stationIds.length }} arrêts · capacité {{ integer(service.dailyCapacity) }} voy. · coût {{ money(service.cost) }}</small></div>
            <button type="button" :disabled="game.isReadOnly.value || !canManageIncidents" :title="incidentsLockedReason || undefined" @click="stopSubstitution(service.id)">Terminer</button>
          </article>
        </div>
      </section>

        </div>
      </details>

      <details class="pcc-fold">
        <summary><span><b>Journal PCC</b><small>{{ historyForLine.length }} entrée(s)</small></span></summary>
        <div class="pcc-fold__content">
      <section class="pcc-section history-section">
        <div class="section-heading"><div><span>Journal PCC</span><h3>Dernières décisions</h3></div></div>
        <div class="history-list"><div v-for="entry in historyForLine" :key="entry.id"><span>{{ gameTimeLabel(entry.minute) }}</span><p><b>{{ entry.title }}</b><small v-if="entry.detail">{{ entry.detail }}</small></p></div></div>
        <p v-if="!historyForLine.length" class="empty-state">Le journal se remplira lorsque vous commencerez à réguler le réseau.</p>
      </section>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.operations-panel{display:grid;gap:14px;padding-bottom:18px}.pcc-hero{display:flex;justify-content:space-between;gap:14px;padding:17px;border:1px solid rgba(85,224,232,.19);border-radius:16px;background:linear-gradient(135deg,rgba(57,192,201,.13),rgba(255,255,255,.025))}.pcc-kicker,.section-heading span{display:block;font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#8fe8ed}.pcc-hero h2{margin:4px 0 5px;font-size:calc(21px * var(--clu-text-scale,1))}.pcc-hero p{margin:0;max-width:320px;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.55;opacity:.68}.pcc-clock{display:grid;align-content:center;text-align:right;white-space:nowrap}.pcc-clock strong{font-size:calc(24px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums}.pcc-clock small{opacity:.52}.pcc-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.pcc-kpis>div{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.035);display:grid;gap:3px}.pcc-kpis small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.52}.pcc-kpis strong{font-size:calc(18px * var(--clu-text-scale,1))}.pcc-section{padding:14px;border:1px solid rgba(255,255,255,.085);border-radius:14px;background:rgba(255,255,255,.025);display:grid;gap:11px}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.section-heading h3{margin:3px 0 0;font-size:calc(14px * var(--clu-text-scale,1))}.section-heading>small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48;text-align:right}.line-chip{--line-color:#55dfe7!important;padding:5px 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--line-color) 55%,transparent);background:color-mix(in srgb,var(--line-color) 14%,transparent);color:inherit!important;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wide-select,.operations-panel select,.operations-panel input,.operations-panel textarea{box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#111d23;color:inherit;padding:8px 9px;outline:none;font:inherit}.wide-select{width:100%}.line-live-summary{display:flex;flex-wrap:wrap;gap:6px}.line-live-summary span{padding:6px 7px;border-radius:8px;background:rgba(255,255,255,.045);font-size:calc(8px * var(--clu-text-scale,1));opacity:.75}.line-live-summary b{color:#a8eef1}.regulation-grid{display:grid;gap:9px}.segmented{display:grid;grid-template-columns:1fr 1fr;gap:5px}.segmented-3{grid-template-columns:repeat(3,1fr)}.segmented button,.severity-row button,.station-picker button,.run-actions button,.disruption-actions button,.boost-control button,.primary-action,.extra-form button{border:1px solid rgba(255,255,255,.11);border-radius:8px;background:rgba(255,255,255,.045);color:inherit;padding:7px 8px;cursor:pointer}.segmented button.active,.severity-row button.active,.station-picker button.active{background:rgba(77,211,220,.15);border-color:rgba(77,211,220,.38);color:#b3f4f6}.control-help{margin:0;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.45;opacity:.58}.boost-control{display:flex;align-items:center;justify-content:space-between;gap:8px}.boost-control>span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.62}.boost-control>div{display:flex;align-items:center;gap:5px}.boost-control button{width:30px;height:30px;padding:0}.boost-control strong{min-width:26px;text-align:center}.runs-list{display:grid;gap:7px}.run-card{border:1px solid rgba(255,255,255,.08);border-left:3px solid #6bdd9b;border-radius:10px;background:rgba(255,255,255,.025);overflow:hidden}.run-card.warning{border-left-color:#efb75f}.run-card.danger{border-left-color:#ef7373}.run-card.extra{border-left-color:#67dbe7}.run-main{display:grid;grid-template-columns:58px 1fr auto;align-items:center;gap:8px;padding:9px}.run-time{display:grid}.run-time strong{font-variant-numeric:tabular-nums}.run-time small{font-size:calc(8px * var(--clu-text-scale,1));color:#efb75f}.run-identity{display:grid;min-width:0}.run-identity b{font-size:calc(10px * var(--clu-text-scale,1))}.run-identity span,.run-identity small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.run-identity span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.72}.run-identity small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.run-badge{font-size:calc(7px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.08em;padding:4px 5px;border-radius:6px;background:rgba(72,211,221,.15);color:#9aebef}.run-actions{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 8px}.run-actions button,.run-actions select{font-size:calc(8px * var(--clu-text-scale,1));padding:6px}.run-actions .danger,.disruption-actions .danger{color:#ffabab;border-color:rgba(255,111,111,.22)}.run-actions .quiet{opacity:.7}.run-stops{border-top:1px solid rgba(255,255,255,.055);padding:7px 8px 8px}.run-stops summary{cursor:pointer;font-size:calc(8px * var(--clu-text-scale,1));opacity:.62}.run-stops>div{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}.run-stops button{border:1px solid rgba(255,255,255,.1);border-radius:7px;background:rgba(255,255,255,.035);color:inherit;padding:5px 6px;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer;opacity:.55}.run-stops button.active{opacity:1;border-color:rgba(78,211,220,.32);background:rgba(78,211,220,.1)}.run-stops small{display:block;margin-top:6px;font-size:calc(7px * var(--clu-text-scale,1));opacity:.42}.extra-form{display:grid;grid-template-columns:1fr 100px;gap:8px}.extra-form label,.form-grid label,.segment-picker label{display:grid;gap:4px;font-size:calc(8px * var(--clu-text-scale,1));opacity:.75}.extra-form button{grid-column:1/-1;background:rgba(76,211,220,.13);border-color:rgba(76,211,220,.32)}.severity-row{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.severity-row button{padding:7px 3px;font-size:calc(8px * var(--clu-text-scale,1))}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.form-grid .span-2{grid-column:1/-1}.form-grid input,.form-grid select,.form-grid textarea{width:100%;margin:0;min-width:0}.switch-label{grid-column:1/-1!important;display:flex!important;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:9px}.switch-label input{width:auto}.switch-label span{display:grid}.switch-label small{opacity:.55}.station-picker{display:grid;gap:6px}.station-picker>small{opacity:.5}.station-picker>div{display:flex;flex-wrap:wrap;gap:4px}.station-picker button{padding:5px 6px;font-size:calc(8px * var(--clu-text-scale,1))}.segment-picker{display:grid;grid-template-columns:1fr 1fr;gap:8px}.primary-action{background:rgba(74,211,220,.16);border-color:rgba(74,211,220,.38);font-weight:800}.operation-message{margin:0;padding:9px 11px;border-radius:9px;border:1px solid rgba(92,217,225,.18);background:rgba(92,217,225,.08);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45}.disruptions-list{gap:8px}.disruption-card{display:grid;gap:8px;padding:10px;border:1px solid rgba(255,255,255,.08);border-left:3px solid #e8ba66;border-radius:10px;background:rgba(255,255,255,.025)}.disruption-card.major,.disruption-card.critical{border-left-color:#ee7777}.disruption-card.minor{border-left-color:#72d5a0}.disruption-card span{font-size:calc(7px * var(--clu-text-scale,1));font-weight:900;text-transform:uppercase;letter-spacing:.08em;opacity:.56}.disruption-card h4{margin:3px 0;font-size:calc(11px * var(--clu-text-scale,1))}.disruption-card p{margin:4px 0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.7}.disruption-card small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.response-box{display:grid;gap:6px;padding:8px;border-radius:8px;background:rgba(92,217,225,.055);border:1px solid rgba(92,217,225,.12)}.disruption-actions{display:flex;gap:5px;flex-wrap:wrap}.disruption-actions button{font-size:calc(8px * var(--clu-text-scale,1));padding:6px 7px}.history-list{display:grid}.history-list>div{display:grid;grid-template-columns:44px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.055)}.history-list>div:last-child{border-bottom:0}.history-list>div>span{font-size:calc(8px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums;opacity:.45}.history-list p{margin:0;display:grid;gap:2px}.history-list b{font-size:calc(9px * var(--clu-text-scale,1))}.history-list small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.empty-state{margin:0;padding:10px;border-radius:9px;background:rgba(255,255,255,.025);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5;opacity:.55}button:disabled,input:disabled,select:disabled{opacity:.38;cursor:not-allowed}@media(max-width:520px){.pcc-hero{display:grid}.pcc-clock{text-align:left}.form-grid,.segment-picker,.extra-form{grid-template-columns:1fr}.extra-form button,.form-grid .span-2{grid-column:1}.severity-row{grid-template-columns:1fr 1fr}.run-main{grid-template-columns:54px 1fr}.run-badge{grid-column:2}.pcc-kpis{grid-template-columns:1fr 1fr}}
.substitution-list{display:grid;gap:7px}.substitution-list article{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px;border-radius:9px;background:rgba(80,201,214,.07);border:1px solid rgba(80,201,214,.16)}.substitution-list article>div{display:grid;gap:3px}.substitution-list small{opacity:.55;font-size:8px}.substitution-list button{border:1px solid rgba(255,255,255,.11);border-radius:8px;background:rgba(255,255,255,.045);color:inherit;padding:6px 8px;cursor:pointer}.works-list{display:grid;gap:8px}.works-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:10px;background:rgba(239,183,95,.07);border:1px solid rgba(239,183,95,.16)}.works-list article>div{display:grid;gap:3px}.works-list strong{font-size:11px}.works-list small{font-size:9px;opacity:.58}.works-list b{font-size:13px;color:#efc477}

/* Exploitation : PCC compact, détails à la demande. */
.operations-panel{gap:10px;padding-bottom:10px}.pcc-hero{padding:10px;border-radius:10px;background:rgba(79,211,220,.055);border-color:rgba(79,211,220,.14)}.pcc-hero h2{font-size:calc(16px * var(--clu-text-scale,1));margin:2px 0}.section-heading h3{font-size:calc(11px * var(--clu-text-scale,1))}.operations-panel :is(.metric-grid,.pcc-grid,.regulation-grid,.incident-grid){gap:5px}.operations-panel :is(.metric-card,.pcc-card,.regulation-card,.incident-card){padding:8px;border-radius:9px;background:rgba(255,255,255,.02)}.operations-panel p{line-height:1.35}.operations-panel details{border-radius:9px}.operations-panel summary{font-size:calc(9px * var(--clu-text-scale,1))}

/* Exploitation : les commandes lourdes restent à la demande. */
.pcc-kpis--essential{grid-template-columns:repeat(3,minmax(0,1fr))}.pcc-fold{border-top:1px solid rgba(255,255,255,.065)}.pcc-fold>summary{list-style:none;min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 3px;cursor:pointer}.pcc-fold>summary::-webkit-details-marker{display:none}.pcc-fold>summary>span{display:grid;gap:1px}.pcc-fold>summary b{font-size:calc(9.5px * var(--clu-text-scale,1))}.pcc-fold>summary small{font-size:calc(7.5px * var(--clu-text-scale,1));opacity:.42}.pcc-fold>summary::after{content:'+';font-size:15px;opacity:.4}.pcc-fold[open]>summary::after{content:'−'}.pcc-fold__content{display:grid;gap:7px;padding:2px 0 8px}.pcc-fold__content>.pcc-section{margin:0}.pcc-fold--metrics>summary{min-height:30px;font-size:calc(8px * var(--clu-text-scale,1));opacity:.58}.pcc-fold--metrics .pcc-kpis{grid-template-columns:repeat(3,minmax(0,1fr));padding-bottom:7px}.pcc-hero p{max-width:440px}.pcc-section{border-radius:9px!important}.pcc-section .section-heading h3{font-size:calc(10.5px * var(--clu-text-scale,1))!important}
@media(max-width:580px){.pcc-kpis--essential,.pcc-fold--metrics .pcc-kpis{grid-template-columns:1fr 1fr}.pcc-kpis--essential>div:last-child{grid-column:1/-1}}


.permission-note{padding:9px 11px;border:1px solid rgba(255,193,86,.2);border-radius:9px;background:rgba(255,193,86,.07);color:#ffd28a;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.35}.operations-panel :is(button,input,select,textarea):disabled{cursor:not-allowed;filter:saturate(.35);opacity:.48}
</style>
