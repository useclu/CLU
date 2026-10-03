<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { GameLine, GameLineMission, GameServiceDayType } from '../../../types/network'
import { departureKey, gameTimeLabel, parseGameTime } from '../../../engine/timetable'
import { useGameTimetable } from '../../../composables/useGameTimetable'

const props = withDefaults(defineProps<{ line: GameLine; canEdit?: boolean; lockedReason?: string | null }>(), { canEdit: true, lockedReason: null })
const timetable = useGameTimetable()

const selectedMissionId = ref<string | null>(null)
const selectedDayType = ref<GameServiceDayType>('WEEKDAY')
const singleDeparture = ref('06:00')
const generator = reactive({ start: '05:00', end: '23:30', interval: 10, replace: false })

const missions = computed(() => props.line.schedule?.missions ?? [])
const selectedMission = computed(() => missions.value.find(mission => mission.id === selectedMissionId.value) ?? missions.value[0] ?? null)
const routeOptions = computed(() => timetable.routeOptions(props.line))
const stats = computed(() => timetable.stats(props.line))
const fleetDeficit = computed(() => Math.max(0, (stats.value?.requiredVehicleCount ?? 0) - Math.max(0, props.line.vehicleCount ?? 0)))
const selectedDepartureKey = computed(() => departureKey(selectedDayType.value))
const departures = computed(() => selectedMission.value?.departures[selectedDepartureKey.value] ?? [])

watch(
  () => [props.line.id, missions.value.map(mission => mission.id).join('|')],
  () => {
    if (!selectedMissionId.value || !missions.value.some(mission => mission.id === selectedMissionId.value)) selectedMissionId.value = missions.value[0]?.id ?? null
  },
  { immediate: true },
)

function dayLabel(type: GameServiceDayType) {
  if (type === 'SATURDAY') return 'Samedi'
  if (type === 'SUNDAY') return 'Dimanche'
  return 'Lun–Ven'
}

function routeKey(mission: GameLineMission) {
  return mission.routeStationIds.join('>')
}

function routeStationName(stationId: string) {
  return props.line.stations.find(station => station.id === stationId)?.name
    ?? props.line.branches?.flatMap(branch => branch.stations).find(station => station.id === stationId)?.name
    ?? stationId
}

function isTerminus(mission: GameLineMission, stationId: string) {
  return mission.routeStationIds[0] === stationId || mission.routeStationIds[mission.routeStationIds.length - 1] === stationId
}

async function addMission() {
  if (!props.canEdit) return
  const mission = await timetable.addMission(props.line.id)
  if (mission) selectedMissionId.value = mission.id
}

async function addAllRoutes() {
  if (!props.canEdit) return
  const added = await timetable.addAllRouteMissions(props.line.id)
  if (added[0]) selectedMissionId.value = added[0].id
}

async function addReturnPair() {
  if (!props.canEdit) return
  const options = routeOptions.value
  if (!options.length) return
  const first = await timetable.addMission(props.line.id, options[0]!.stationIds)
  const reverse = options.find(option => option.stationIds.join('>') === [...options[0]!.stationIds].reverse().join('>'))
  if (reverse) await timetable.addMission(props.line.id, reverse.stationIds)
  if (first) selectedMissionId.value = first.id
}

async function setRoute(event: Event) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (!mission) return
  const value = (event.target as HTMLSelectElement).value
  const option = routeOptions.value.find(item => item.id === value)
  if (option) await timetable.setMissionRoute(props.line.id, mission.id, option.stationIds)
}

async function updateCode(event: Event) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (mission) await timetable.updateMissionIdentity(props.line.id, mission.id, { code: (event.target as HTMLInputElement).value })
}

async function updateName(event: Event) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (mission) await timetable.updateMissionIdentity(props.line.id, mission.id, { name: (event.target as HTMLInputElement).value })
}

async function updateDwell(event: Event) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (mission) await timetable.setMissionDwell(props.line.id, mission.id, Number((event.target as HTMLInputElement).value))
}

async function toggleEnabled(event: Event) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (mission) await timetable.updateMissionIdentity(props.line.id, mission.id, { enabled: (event.target as HTMLInputElement).checked })
}

async function addSingleDeparture() {
  if (!props.canEdit) return
  const mission = selectedMission.value
  const minute = parseGameTime(singleDeparture.value)
  if (!mission || minute === null) return
  await timetable.addDeparture(props.line.id, mission.id, selectedDayType.value, minute)
}

async function generate() {
  if (!props.canEdit) return
  const mission = selectedMission.value
  const start = parseGameTime(generator.start)
  const end = parseGameTime(generator.end)
  if (!mission || start === null || end === null) return
  await timetable.generateDepartures(props.line.id, mission.id, selectedDayType.value, start, end, generator.interval, generator.replace)
}

async function generateForAll() {
  if (!props.canEdit) return
  const start = parseGameTime(generator.start)
  const end = parseGameTime(generator.end)
  if (start === null || end === null) return
  await timetable.generateDeparturesForAll(props.line.id, selectedDayType.value, start, end, generator.interval, generator.replace)
}

async function copyTo(target: GameServiceDayType) {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (mission) await timetable.copyDepartures(props.line.id, mission.id, selectedDayType.value, target)
}

async function removeSelectedMission() {
  if (!props.canEdit) return
  const mission = selectedMission.value
  if (!mission) return
  const index = missions.value.findIndex(item => item.id === mission.id)
  await timetable.removeMission(props.line.id, mission.id)
  selectedMissionId.value = missions.value[Math.max(0, index - 1)]?.id ?? missions.value[0]?.id ?? null
}
</script>

<template>
  <section class="timetable-card">
    <div class="timetable-head">
      <div>
        <span class="timetable-kicker">Exploitation</span>
        <strong>Horaires & missions</strong>
        <small>Choisissez entre la fréquence automatique historique et une grille créée train par train.</small>
      </div>
      <span class="mode-pill">{{ line.schedule?.mode === 'TIMETABLE' ? 'Grille manuelle' : 'Fréquence automatique' }}</span>
    </div>

    <p v-if="!canEdit" class="permission-note">🔒 {{ lockedReason }}</p>
    <div class="schedule-mode-switch">
      <button type="button" :class="{ active: line.schedule?.mode !== 'TIMETABLE' }" :disabled="!canEdit" :title="lockedReason || undefined" @click="canEdit && timetable.setMode(line.id, 'FREQUENCY')">Fréquence automatique</button>
      <button type="button" :class="{ active: line.schedule?.mode === 'TIMETABLE' }" :disabled="!canEdit" :title="lockedReason || undefined" @click="canEdit && timetable.setMode(line.id, 'TIMETABLE')">Horaires personnalisés</button>
    </div>

    <p v-if="line.schedule?.mode !== 'TIMETABLE'" class="timetable-help">
      Le fonctionnement actuel reste intact. Passez en horaires personnalisés pour décider vous-même de chaque mission et de chaque départ.
    </p>

    <template v-else>
      <div class="schedule-kpis">
        <div><span>Courses aujourd’hui</span><strong>{{ stats?.totalDepartures ?? 0 }}</strong></div>
        <div><span>Missions actives</span><strong>{{ stats?.activeMissionCount ?? 0 }}</strong></div>
        <div><span>Premier / dernier départ</span><strong>{{ stats?.firstDepartureMinute == null ? '—' : gameTimeLabel(stats.firstDepartureMinute) }} · {{ stats?.lastDepartureMinute == null ? '—' : gameTimeLabel(stats.lastDepartureMinute) }}</strong></div>
        <div><span>Parc minimal estimé</span><strong>{{ stats?.requiredVehicleCount ?? 0 }}</strong></div>
        <div><span>Intervalle moyen équivalent</span><strong>{{ stats?.averageHeadwayMinutes ? `${Math.round(stats.averageHeadwayMinutes)} min` : '—' }}</strong></div>
        <div><span>Pointe de départs</span><strong>{{ stats?.peakTripsPerHour ?? 0 }}/h</strong></div>
      </div>

      <p v-if="fleetDeficit > 0" class="fleet-warning">
        Parc insuffisant pour assurer toute la grille : il manque <strong>{{ fleetDeficit }}</strong> véhicule(s). Le moteur réduit la part de courses effectivement assurées tant que le parc n’est pas complété.
      </p>

      <div v-if="!missions.length" class="empty-schedule">
        <strong>Aucune mission</strong>
        <p>Créez directement un aller-retour, toutes les relations entre terminus, ou une mission seule.</p>
        <div>
          <button type="button" class="primary" :disabled="!canEdit" :title="lockedReason || undefined" @click="addReturnPair">Créer aller + retour</button>
          <button v-if="routeOptions.length > 2" type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="addAllRoutes">Créer toutes les relations</button>
          <button type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="addMission">Ajouter une mission</button>
        </div>
      </div>

      <div v-else class="mission-workspace">
        <nav class="mission-list" aria-label="Missions de la ligne">
          <button
            v-for="mission in missions"
            :key="mission.id"
            type="button"
            :class="{ active: selectedMission?.id === mission.id, disabled: !mission.enabled }"
            @click="selectedMissionId = mission.id"
          >
            <b>{{ mission.code }}</b>
            <span data-i18n-skip>{{ mission.name }}</span>
            <small>{{ mission.departures.weekday.length }} lun–ven · {{ mission.departures.saturday.length }} sam · {{ mission.departures.sunday.length }} dim</small>
          </button>
          <button type="button" class="mission-add" :disabled="!canEdit" :title="lockedReason || undefined" @click="addMission">+ Mission</button>
          <button v-if="routeOptions.length > 2" type="button" class="mission-add mission-add-all" :disabled="!canEdit" :title="lockedReason || undefined" @click="addAllRoutes">+ Relations manquantes</button>
        </nav>

        <div v-if="selectedMission" class="mission-editor">
          <div class="mission-toolbar">
            <label class="enabled-toggle"><input type="checkbox" :checked="selectedMission.enabled" :disabled="!canEdit" :title="lockedReason || undefined" @change="toggleEnabled"> Mission active</label>
            <div>
              <button type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="canEdit && timetable.duplicateMission(line.id, selectedMission.id)">Dupliquer</button>
              <button type="button" class="danger" :disabled="!canEdit" :title="lockedReason || undefined" @click="removeSelectedMission">Supprimer</button>
            </div>
          </div>

          <div class="mission-fields">
            <label>Code mission<input :value="selectedMission.code" maxlength="8" :disabled="!canEdit" :title="lockedReason || undefined" @change="updateCode"></label>
            <label>Nom<input :value="selectedMission.name" maxlength="80" :disabled="!canEdit" :title="lockedReason || undefined" @change="updateName"></label>
            <label class="wide">Parcours<select :value="routeKey(selectedMission)" :disabled="!canEdit" :title="lockedReason || undefined" @change="setRoute"><option v-for="option in routeOptions" :key="option.id" :value="option.id" data-i18n-skip>{{ option.label }}</option></select></label>
            <label>Temps d’arrêt moyen<input :value="selectedMission.dwellMinutes" type="number" min="0" max="5" step="0.1" :disabled="!canEdit" :title="lockedReason || undefined" @change="updateDwell"><small>minutes</small></label>
          </div>

          <div class="mission-stops">
            <div class="mission-section-title"><strong>Desserte</strong><small>Décochez un arrêt intermédiaire pour créer une mission semi-directe ou directe.</small></div>
            <div class="stop-grid">
              <label v-for="stationId in selectedMission.routeStationIds" :key="stationId" :class="{ terminus: isTerminus(selectedMission, stationId) }">
                <input
                  type="checkbox"
                  :checked="selectedMission.stopStationIds.includes(stationId)"
                  :disabled="!canEdit || isTerminus(selectedMission, stationId)"
                  :title="lockedReason || undefined"
                  @change="canEdit && timetable.toggleMissionStop(line.id, selectedMission.id, stationId)"
                >
                <span data-i18n-skip>{{ routeStationName(stationId) }}</span>
              </label>
            </div>
          </div>

          <div class="departure-editor">
            <div class="day-tabs">
              <button v-for="dayType in (['WEEKDAY','SATURDAY','SUNDAY'] as GameServiceDayType[])" :key="dayType" type="button" :class="{ active: selectedDayType === dayType }" @click="selectedDayType = dayType">{{ dayLabel(dayType) }}</button>
            </div>

            <div class="generator-grid">
              <label>De<input v-model="generator.start" :disabled="!canEdit" :title="lockedReason || undefined" type="time"></label>
              <label>À<input v-model="generator.end" :disabled="!canEdit" :title="lockedReason || undefined" type="time"></label>
              <label>Toutes les<input v-model.number="generator.interval" :disabled="!canEdit" :title="lockedReason || undefined" type="number" min="1" max="240" step="1"><small>min</small></label>
              <label class="replace-check"><input v-model="generator.replace" :disabled="!canEdit" :title="lockedReason || undefined" type="checkbox"> Remplacer les départs existants</label>
              <div class="generator-actions">
                <button type="button" class="primary" :disabled="!canEdit" :title="lockedReason || undefined" @click="generate">Générer cette mission</button>
                <button type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="generateForAll">Générer toutes les missions</button>
              </div>
            </div>

            <div class="single-departure-row">
              <label>Ajouter un départ<input v-model="singleDeparture" :disabled="!canEdit" :title="lockedReason || undefined" type="time"></label>
              <button type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="addSingleDeparture">Ajouter</button>
              <button type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="copyTo(selectedDayType === 'WEEKDAY' ? 'SATURDAY' : 'WEEKDAY')">Copier vers {{ selectedDayType === 'WEEKDAY' ? 'samedi' : 'lun–ven' }}</button>
              <button v-if="selectedDayType !== 'SUNDAY'" type="button" :disabled="!canEdit" :title="lockedReason || undefined" @click="copyTo('SUNDAY')">Copier vers dimanche</button>
              <button type="button" class="danger" :disabled="!canEdit" :title="lockedReason || undefined" @click="canEdit && timetable.clearDepartures(line.id, selectedMission.id, selectedDayType)">Vider</button>
            </div>

            <div v-if="departures.length" class="departure-list">
              <button v-for="minute in departures" :key="minute" type="button" :disabled="!canEdit" :title="lockedReason || `Supprimer le départ de ${gameTimeLabel(minute)}`" @click="canEdit && timetable.removeDeparture(line.id, selectedMission.id, selectedDayType, minute)">
                {{ gameTimeLabel(minute) }} <span>×</span>
              </button>
            </div>
            <p v-else class="no-departure">Aucun départ pour {{ dayLabel(selectedDayType) }}.</p>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.timetable-card{margin:18px 0;padding:16px;border:1px solid rgba(86,211,220,.18);border-radius:14px;background:linear-gradient(180deg,rgba(65,192,202,.055),rgba(255,255,255,.018));display:grid;gap:14px}.timetable-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.timetable-head>div{display:grid;gap:3px}.timetable-kicker{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#72d8df;font-weight:800}.timetable-head strong{font-size:calc(15px * var(--clu-text-scale,1))}.timetable-head small,.timetable-help{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.5;opacity:.58}.mode-pill{white-space:nowrap;padding:5px 8px;border-radius:999px;background:rgba(79,211,220,.11);border:1px solid rgba(79,211,220,.18);font-size:calc(9px * var(--clu-text-scale,1));color:#9be9ee}.schedule-mode-switch,.day-tabs,.single-departure-row,.mission-toolbar,.mission-toolbar>div,.empty-schedule>div{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.schedule-mode-switch button,.day-tabs button,.single-departure-row button,.mission-toolbar button,.empty-schedule button,.mission-add{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.045);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer}.schedule-mode-switch button.active,.day-tabs button.active,.primary{border-color:rgba(79,211,220,.5)!important;background:rgba(79,211,220,.16)!important}.schedule-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.schedule-kpis>div{padding:10px;border-radius:10px;background:rgba(255,255,255,.035);display:grid;gap:3px}.schedule-kpis span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.schedule-kpis strong{font-size:calc(12px * var(--clu-text-scale,1))}.fleet-warning{margin:0;padding:9px 11px;border:1px solid rgba(255,181,71,.2);border-radius:10px;background:rgba(255,181,71,.075);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;color:#ffd49b}.fleet-warning strong{color:#fff0d8}.empty-schedule{padding:18px;border:1px dashed rgba(255,255,255,.12);border-radius:12px;display:grid;gap:8px}.empty-schedule p{margin:0;font-size:calc(10px * var(--clu-text-scale,1));opacity:.6}.mission-workspace{display:grid;grid-template-columns:minmax(150px,.34fr) minmax(0,1fr);gap:12px;align-items:start}.mission-list{display:grid;gap:6px;max-height:560px;overflow:auto}.mission-list>button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:inherit;border-radius:10px;padding:9px;text-align:left;cursor:pointer;display:grid;gap:2px}.mission-list>button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.1)}.mission-list>button.disabled{opacity:.52}.mission-list b{font-size:calc(10px * var(--clu-text-scale,1));color:#8ee3e9}.mission-list span{font-size:calc(10px * var(--clu-text-scale,1));overflow-wrap:anywhere}.mission-list small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.46}.mission-add{justify-content:center!important;text-align:center!important}.mission-add-all{font-size:calc(8px * var(--clu-text-scale,1));opacity:.76}.mission-editor{min-width:0;display:grid;gap:15px;padding:13px;border-radius:12px;background:rgba(0,0,0,.11);border:1px solid rgba(255,255,255,.055)}.mission-toolbar{justify-content:space-between}.enabled-toggle{display:flex;align-items:center;gap:7px;font-size:calc(10px * var(--clu-text-scale,1))}.danger{color:#ff9b9b!important;border-color:rgba(255,105,105,.2)!important}.mission-fields{display:grid;grid-template-columns:120px minmax(0,1fr);gap:9px}.mission-fields label,.generator-grid label,.single-departure-row label{display:grid;gap:4px;font-size:calc(9px * var(--clu-text-scale,1));opacity:.72}.mission-fields label.wide{grid-column:1/-1}.mission-fields input,.mission-fields select,.generator-grid input,.single-departure-row input{min-width:0;background:#111b21;color:#edf6f7;color-scheme:dark;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px}.mission-fields label:not(.wide):last-child{grid-column:1/-1;max-width:220px;grid-template-columns:1fr auto;align-items:end}.mission-fields small,.generator-grid small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.mission-section-title{display:grid;gap:2px;margin-bottom:8px}.mission-section-title strong{font-size:calc(11px * var(--clu-text-scale,1))}.mission-section-title small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.stop-grid{display:flex;gap:6px;flex-wrap:wrap}.stop-grid label{display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.035);font-size:calc(9px * var(--clu-text-scale,1));cursor:pointer}.stop-grid label.terminus{border:1px solid rgba(79,211,220,.15);background:rgba(79,211,220,.055)}.departure-editor{display:grid;gap:11px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}.generator-grid{display:grid;grid-template-columns:110px 110px 120px minmax(180px,1fr);gap:7px;align-items:end}.generator-grid .replace-check{display:flex;align-items:center;gap:6px;padding-bottom:8px}.generator-grid button{height:35px;border:1px solid rgba(79,211,220,.4);background:rgba(79,211,220,.12);color:inherit;border-radius:9px;padding:0 10px;cursor:pointer}.single-departure-row label{grid-template-columns:auto 108px;align-items:center}.departure-list{display:flex;gap:5px;flex-wrap:wrap;max-height:180px;overflow:auto;padding:7px;border-radius:9px;background:rgba(255,255,255,.02)}.departure-list button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);color:inherit;border-radius:999px;padding:5px 8px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}.departure-list button span{opacity:.5;margin-left:3px}.no-departure{margin:0;font-size:calc(10px * var(--clu-text-scale,1));opacity:.5}
.generator-actions{grid-column:1/-1;display:flex;gap:6px;align-items:end}.generator-actions button{white-space:nowrap}.generator-actions button:not(.primary){border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.045)}
@media(max-width:760px){.schedule-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.mission-workspace{grid-template-columns:1fr}.mission-list{display:flex;overflow:auto;max-height:none}.mission-list>button{min-width:150px}.mission-editor{padding:10px}.generator-grid{grid-template-columns:1fr 1fr}.generator-grid .replace-check,.generator-actions{grid-column:1/-1}.generator-actions{display:grid;grid-template-columns:1fr 1fr}.generator-actions button{width:100%}.mission-fields{grid-template-columns:1fr}.mission-fields label.wide,.mission-fields label:not(.wide):last-child{grid-column:auto;max-width:none}.timetable-head{align-items:flex-start;flex-direction:column}.single-departure-row label{grid-template-columns:1fr}.single-departure-row button{flex:1 1 140px}}

.permission-note{margin:0;padding:9px 11px;border:1px solid rgba(255,193,86,.2);border-radius:9px;background:rgba(255,193,86,.07);color:#ffd28a;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.35}.timetable-card :is(button,input,select):disabled{cursor:not-allowed;filter:saturate(.35);opacity:.48}
</style>
