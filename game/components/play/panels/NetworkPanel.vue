<script setup lang="ts">
import { currentGameLocale, currentGameLocaleTag, translateGameText, formatGameInteger, formatGameCurrencyCompact, formatGamePercent, formatGameSignedPercent, gameNumericCollator } from '../../../config/i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { getTransportModeDefinition } from '../../../config/transportModes'
import {
  GAME_SERVICE_LEVELS,
  getServiceLevelDefinition,
} from '../../../config/operations'
import {
  GAME_MAINTENANCE_LEVELS,
} from '../../../config/maintenance'
import {
  GAME_FINE_AMOUNT,
} from '../../../config/inspection'
import {
  calculateLineLengthKm,
} from '../../../engine/economy'
import type {
  GameLine,
  GameMaintenanceLevel,
  GameRollingStockUpgradeKey,
  GameServiceLevel,
} from '../../../types/network'
import { useGameNetwork } from '../../../composables/useGameNetwork'
import { useGameI18n } from '../../../composables/useGameI18n'
import { useGameSimulation } from '../../../composables/useGameSimulation'
import { useGameRollingStock } from '../../../composables/useGameRollingStock'
import { useMetropoleGame } from '../../../composables/useMetropoleGame'
import { useGameMaintenance } from '../../../composables/useGameMaintenance'
import { useGameInspection } from '../../../composables/useGameInspection'
import { useGameStations } from '../../../composables/useGameStations'
import { useGameSelection } from '../../../composables/useGameSelection'
import { useGameAnalytics } from '../../../composables/useGameAnalytics'
import { useGameOperations } from '../../../composables/useGameOperations'
import { createLineLogoDataUrl } from '../../../utils/lineLogo'
import { useGameTransitRuntime } from '../../../composables/useGameTransitRuntime'
import { useGameDialog } from '../../../composables/useGameDialog'
import { useCluOnline } from '../../../composables/useCluOnline'
import { focusGameMapLine, focusGameMapPoint } from '../../../utils/mapBridge'
import { findLineStation, getLineAllStations, getLineTerminusStations } from '../../../engine/network/geometry'
import TimetableEditor from './TimetableEditor.vue'

const network = useGameNetwork()
const i18n = useGameI18n()
const simulation = useGameSimulation()
const rollingStock = useGameRollingStock()
const game = useMetropoleGame()
const maintenance = useGameMaintenance()
const inspection = useGameInspection()
const stations = useGameStations()
const selection = useGameSelection()
const analytics = useGameAnalytics()
const operations = useGameOperations()
const transitRuntime = useGameTransitRuntime()
const dialogs = useGameDialog()
const online = useCluOnline()

const onlineSession = computed(() => online.sessionConnectee.value)
const canModifyLines = computed(() => !onlineSession.value || online.peut('modifier_lignes'))
const canDeleteLines = computed(() => !onlineSession.value || online.peut('supprimer_lignes'))
const canManageFleet = computed(() => !onlineSession.value || online.peut('gerer_materiel_roulant'))
const canManageOperations = computed(() => !onlineSession.value || online.peut('gerer_exploitation'))
const canManageFrequencies = computed(() => !onlineSession.value || online.peut('gerer_frequences'))
const canManageSchedules = computed(() => !onlineSession.value || online.peut('gerer_horaires'))
const canManageStations = computed(() => !onlineSession.value || online.peut('modifier_stations'))
const modifyLineLockedReason = computed(() => canModifyLines.value ? '' : translateGameText('Permission requise : modifier les lignes.', currentGameLocale()))
const deleteLineLockedReason = computed(() => canDeleteLines.value ? '' : translateGameText('Permission requise : supprimer les lignes.', currentGameLocale()))
const fleetLockedReason = computed(() => canManageFleet.value ? '' : translateGameText('Permission requise : gérer le matériel roulant.', currentGameLocale()))
const operationsLockedReason = computed(() => canManageOperations.value ? '' : translateGameText('Permission requise : gérer l’exploitation.', currentGameLocale()))
const frequencyLockedReason = computed(() => canManageFrequencies.value ? '' : translateGameText('Permission requise : gérer les fréquences.', currentGameLocale()))
const scheduleLockedReason = computed(() => canManageSchedules.value ? '' : translateGameText('Permission requise : gérer les horaires.', currentGameLocale()))
const stationLockedReason = computed(() => canManageStations.value ? '' : translateGameText('Permission requise : modifier les stations.', currentGameLocale()))

const expandedLineId = ref<string | null>(null)
const identityLineId = ref<string | null>(null)
const nameDrafts = reactive<Record<string, string>>({})
const codeDrafts = reactive<Record<string, string>>({})
const colorDrafts = reactive<Record<string, string>>({})
const logoDrafts = reactive<Record<string, string | undefined>>({})
const fleetDrafts = reactive<Record<string, number>>({})
const fleetPending = reactive<Record<string, boolean>>({})

// V51 : garder "Mes lignes" lisible même sur un grand réseau. Les familles sont
// regroupées dans un ordre stable, puis les indices sont triés naturellement
// (1, 2, 10 / A, B / T1, T2...) sans modifier l'ordre persistant du réseau.
const LINE_MODE_ORDER: GameLine['mode'][] = ['RER', 'TRAIN', 'METRO', 'TRAM', 'CABLE', 'FERRY', 'BRT', 'BUS']
const lineGroups = computed(() => {
  const collator = gameNumericCollator()
  return LINE_MODE_ORDER
    .map(mode => ({
      mode,
      label: getTransportModeDefinition(mode).label,
      lines: network.lines.value
        .filter(line => line.mode === mode)
        .slice()
        .sort((left, right) => {
          const byCode = collator.compare(left.shortCode || left.name, right.shortCode || right.name)
          return byCode || collator.compare(left.name, right.name) || left.createdAt.localeCompare(right.createdAt)
        }),
    }))
    .filter(group => group.lines.length > 0)
})

type LineBrowserFilter = 'ALL' | 'FAVORITES' | 'SATURATED' | 'DEFICIT' | 'DISRUPTED' | 'PROJECT'

const LINE_GROUPS_STORAGE_KEY = 'clu-metropole:network-collapsed-modes'
const LINE_FAVORITES_STORAGE_KEY = 'clu-metropole:network-favorite-lines'
const collapsedModes = ref<GameLine['mode'][]>([])
const favoriteLineIds = ref<string[]>([])
const lineSearch = ref('')
const lineFilter = ref<LineBrowserFilter>('ALL')

const favoriteLineIdSet = computed(() => new Set(favoriteLineIds.value))
const disruptedLineIdSet = computed(() => new Set(operations.activeDisruptions.value.map(item => item.lineId)))

function isFavoriteLine(lineId: string) { return favoriteLineIdSet.value.has(lineId) }
function toggleFavoriteLine(lineId: string) {
  const next = new Set(favoriteLineIds.value)
  if (next.has(lineId)) next.delete(lineId)
  else next.add(lineId)
  const liveIds = new Set(network.lines.value.map(line => line.id))
  favoriteLineIds.value = [...next].filter(id => liveIds.has(id))
}

function normalizedSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(currentGameLocaleTag()).trim()
}
function lineMatchesSearch(line: GameLine) {
  const query = normalizedSearch(lineSearch.value)
  if (!query) return true
  const haystack = [
    line.shortCode,
    line.name,
    getTransportModeDefinition(line.mode).label,
    ...getLineAllStations(line).map(station => station.name),
  ].map(value => normalizedSearch(String(value ?? ''))).join(' | ')
  return haystack.includes(query)
}
function lineIsSaturated(line: GameLine) {
  const report = lineReport(line)
  return Boolean(report && ((report.bottleneckSegmentLoadRate ?? 0) >= .9 || (report.demandSatisfactionRate ?? 1) < .86 || (report.networkLeftBehindPassengers ?? 0) >= 500))
}
function lineMatchesFilter(line: GameLine) {
  if (lineFilter.value === 'FAVORITES') return isFavoriteLine(line.id)
  if (lineFilter.value === 'SATURATED') return lineIsSaturated(line)
  if (lineFilter.value === 'DEFICIT') return (lineReport(line)?.netResult ?? 0) < 0
  if (lineFilter.value === 'DISRUPTED') return disruptedLineIdSet.value.has(line.id)
  if (lineFilter.value === 'PROJECT') return line.status === 'PROJECT'
  return true
}
const visibleLineGroups = computed(() => lineGroups.value
  .map(group => ({ ...group, lines: group.lines.filter(line => lineMatchesSearch(line) && lineMatchesFilter(line)) }))
  .filter(group => group.lines.length > 0))
const visibleLineCount = computed(() => visibleLineGroups.value.reduce((total, group) => total + group.lines.length, 0))
const favoriteLines = computed(() => favoriteLineIds.value
  .map(id => network.lines.value.find(line => line.id === id))
  .filter((line): line is GameLine => Boolean(line)))
const analyticsScopeLines = computed(() => {
  if (network.lines.value.length <= 32) return network.lines.value
  const priority = new Set([...favoriteLineIds.value, ...analytics.effectiveLineIds.value])
  return network.lines.value.filter(line => priority.has(line.id)).slice(0, 32)
})
function isModeCollapsed(mode: GameLine['mode']) { return collapsedModes.value.includes(mode) }
function setModeCollapsed(mode: GameLine['mode'], collapsed: boolean) {
  const next = new Set(collapsedModes.value)
  if (collapsed) next.add(mode)
  else next.delete(mode)
  collapsedModes.value = LINE_MODE_ORDER.filter(item => next.has(item))
}
function toggleMode(mode: GameLine['mode']) { setModeCollapsed(mode, !isModeCollapsed(mode)) }
function collapseAllModes() { collapsedModes.value = lineGroups.value.map(group => group.mode) }
function expandAllModes() { collapsedModes.value = [] }

onMounted(() => {
  try {
    const raw = localStorage.getItem(LINE_GROUPS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) collapsedModes.value = parsed.filter(mode => LINE_MODE_ORDER.includes(mode as GameLine['mode'])) as GameLine['mode'][]
    if (!raw && network.lines.value.length >= 80) collapsedModes.value = lineGroups.value.map(group => group.mode)
  }
  catch { collapsedModes.value = [] }

  try {
    const raw = localStorage.getItem(LINE_FAVORITES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const liveIds = new Set(network.lines.value.map(line => line.id))
    if (Array.isArray(parsed)) favoriteLineIds.value = parsed.filter(id => typeof id === 'string' && liveIds.has(id))
  }
  catch { favoriteLineIds.value = [] }
})
watch(collapsedModes, modes => {
  try { localStorage.setItem(LINE_GROUPS_STORAGE_KEY, JSON.stringify(modes)) }
  catch { /* Préférence purement locale. */ }
})
watch(favoriteLineIds, ids => {
  try { localStorage.setItem(LINE_FAVORITES_STORAGE_KEY, JSON.stringify(ids)) }
  catch { /* Préférence purement locale. */ }
})

watch(() => selection.selectedLineId.value, async lineId => {
  if (!lineId) return
  expandedLineId.value = lineId
  const selected = network.lines.value.find(line => line.id === lineId)
  if (selected && (!lineMatchesSearch(selected) || !lineMatchesFilter(selected))) {
    lineSearch.value = ''
    lineFilter.value = 'ALL'
  }
  if (selected) setModeCollapsed(selected.mode, false)
  await nextTick()
  document.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}, { flush: 'post' })

function money(value: number) {
  return formatGameCurrencyCompact(value)
}
function integer(value: number) {
  return formatGameInteger(value)
}
function percent(value: number) {
  return formatGamePercent(value)
}
function signedPercent(value: number) {
  const formatted = formatGameSignedPercent(value)
  return formatted.replace('+0 %', '0 %').replace('+0%', '0%')
}
function signedNumber(value: number, suffix = '') {
  const rounded = Math.round(value)
  if (rounded === 0) return `0${suffix}`
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}
function lineReport(line: GameLine) { return simulation.reportForLine(line.id) }
function lineFinancialTone(line: GameLine) {
  const report = lineReport(line)
  if (!report) return 'neutral'
  if (report.netResult >= 0) return 'positive'
  if (report.revenue > 0 && report.operatingCost > report.revenue * 1.7) return 'warning'
  return 'neutral'
}
function lineCostPerPassenger(line: GameLine) {
  const report = lineReport(line)
  if (!report || report.passengers <= 0) return null
  return report.operatingCost / report.passengers
}
function statusLabel(line: GameLine) {
  if (line.status === 'PROJECT') return 'En conception'
  if (line.status === 'CONSTRUCTION') return `En construction · ${line.constructionDaysRemaining} j`
  return 'En service'
}
function lineTerminiLabel(line: GameLine) {
  return getLineTerminusStations(line).map(station => station.name).join(' · ')
}
function allLineStations(line: GameLine) {
  return getLineAllStations(line)
}
function branchJunctionName(line: GameLine, stationId: string) {
  return findLineStation(line, stationId)?.name ?? 'Bifurcation'
}
function lineNameDraft(line: GameLine) {
  if (!(line.id in nameDrafts)) nameDrafts[line.id] = line.name
  return nameDrafts[line.id]!
}
function lineCodeDraft(line: GameLine) {
  if (!(line.id in codeDrafts)) codeDrafts[line.id] = line.shortCode
  return codeDrafts[line.id]!
}
function lineColorDraft(line: GameLine) {
  if (!(line.id in colorDrafts)) colorDrafts[line.id] = line.color
  return colorDrafts[line.id]!
}
function lineLogoDraft(line: GameLine) {
  if (!(line.id in logoDrafts)) logoDrafts[line.id] = line.customLogoDataUrl
  return logoDrafts[line.id]
}
function resetIdentityDraft(line: GameLine) {
  nameDrafts[line.id] = line.name
  codeDrafts[line.id] = line.shortCode
  colorDrafts[line.id] = line.color
  logoDrafts[line.id] = line.customLogoDataUrl
}
function openIdentity(line: GameLine) {
  resetIdentityDraft(line)
  identityLineId.value = identityLineId.value === line.id ? null : line.id
}
function cancelIdentity(line: GameLine) {
  resetIdentityDraft(line)
  identityLineId.value = null
}
async function applyIdentity(line: GameLine) {
  if (!canModifyLines.value) return
  await network.renameLine(line.id, nameDrafts[line.id] ?? line.name)
  await network.setLineIdentity(line.id, { shortCode: codeDrafts[line.id] ?? line.shortCode, color: colorDrafts[line.id] ?? line.color })
  if (logoDrafts[line.id] !== line.customLogoDataUrl) await network.setLineCustomLogo(line.id, logoDrafts[line.id])
  identityLineId.value = null
}
async function setService(line: GameLine, level: GameServiceLevel) {
  if (!canManageOperations.value) return
  await network.setLineServiceLevel(line.id, level)
}
async function setMaintenance(line: GameLine, level: GameMaintenanceLevel) {
  if (!canManageOperations.value) return
  await maintenance.setLevel(line.id, level)
}
async function improveRollingStock(line: GameLine, key: GameRollingStockUpgradeKey) {
  if (!canManageFleet.value) return
  if (rollingStock.isUpgradePending(line.id, key)) return
  const ok = await rollingStock.upgrade(line.id, key)
  if (!ok) await dialogs.alert(i18n.t('Amélioration impossible : niveau maximal atteint ou trésorerie insuffisante.'), { title: i18n.t('Amélioration impossible') })
}
async function setRegulation(line: GameLine, mode: 'AUTO' | 'MANUAL') {
  if (!canManageOperations.value) return
  await rollingStock.setRegulationMode(line.id, mode)
}
async function changeManualBoost(line: GameLine, delta: number) {
  if (!canManageOperations.value) return
  await rollingStock.setManualBoost(line.id, Math.max(0, (line.manualBoostVehicles ?? 0) + delta))
}
function fleetDraft(line: GameLine) {
  if (!(line.id in fleetDrafts)) fleetDrafts[line.id] = Math.max(0, Math.floor(line.vehicleCount ?? 0))
  return fleetDrafts[line.id]!
}
function changeFleetDraft(line: GameLine, delta: number) {
  fleetDrafts[line.id] = Math.max(0, fleetDraft(line) + delta)
}
function updateFleetDraft(line: GameLine, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  fleetDrafts[line.id] = Math.max(0, Number.isFinite(value) ? Math.floor(value) : line.vehicleCount)
}
async function applyFleetDraft(line: GameLine) {
  if (!canManageFleet.value) return
  if (fleetPending[line.id]) return
  fleetPending[line.id] = true
  try {
    const ok = await rollingStock.setFleetSize(line.id, fleetDraft(line))
    if (!ok) {
      fleetDrafts[line.id] = line.vehicleCount
      await dialogs.alert(i18n.t('Ajustement du parc impossible : vérifiez votre trésorerie.'), { title: i18n.t('Ajustement impossible') })
      return
    }
    fleetDrafts[line.id] = line.vehicleCount
  }
  finally {
    fleetPending[line.id] = false
  }
}
async function completeFleet(line: GameLine) {
  fleetDrafts[line.id] = Math.max(line.vehicleCount, rollingStock.requiredVehicles(line))
  await applyFleetDraft(line)
}
function rollingUpgradeSummary(line: GameLine, key: GameRollingStockUpgradeKey) {
  const level = rollingStock.upgradeLevel(line, key)
  if (level >= rollingStock.maxUpgradeLevel) return 'Niveau maximal atteint'
  const preview = {
    ...line,
    rollingStockUpgrades: { ...line.rollingStockUpgrades, [key]: level + 1 },
  }
  if (key === 'capacity') return `${integer(rollingStock.effectiveCapacity(line))} → ${integer(rollingStock.effectiveCapacity(preview))} places/véhicule`
  if (key === 'speed') return `${rollingStock.effectiveSpeed(line).toFixed(1)} → ${rollingStock.effectiveSpeed(preview).toFixed(1)} km/h`
  if (key === 'reliability') return `Fiabilité niveau ${level} → ${level + 1} · moins d’indisponibilités`
  if (key === 'efficiency') return `Efficacité niveau ${level} → ${level + 1} · coûts techniques réduits`
  return `Embarquement niveau ${level} → ${level + 1} · arrêts plus courts`
}
async function changeControllerCount(line: GameLine, delta: number) {
  if (!canManageOperations.value) return
  await inspection.setControllerCount(line.id, Math.max(0, (line.controllerCount ?? 0) + delta))
}
function inputValue(event: Event) { return (event.target as HTMLInputElement).value }
function selectValue(event: Event) { return (event.target as HTMLSelectElement).value }
function checkedValue(event: Event) { return (event.target as HTMLInputElement).checked }
function updateNameDraft(lineId: string, event: Event) { nameDrafts[lineId] = inputValue(event) }
function updateCodeDraft(lineId: string, event: Event) { codeDrafts[lineId] = inputValue(event) }
function updateColorDraft(lineId: string, event: Event) { colorDrafts[lineId] = inputValue(event) }
async function setAdvanced(line: GameLine, event: Event) {
  if (!canManageFrequencies.value) return
  await network.setServiceProfileMode(line.id, checkedValue(event) ? 'ADVANCED' : 'SIMPLE')
}
async function setProfile(line: GameLine, period: 'offPeak' | 'normal' | 'peak', event: Event) {
  if (!canManageFrequencies.value) return
  await network.setServiceProfileLevel(line.id, period, selectValue(event) as GameServiceLevel)
}
function nextStationLevelDescription(station: GameLine['stations'][number]) {
  const next = stations.nextLevel(station)
  return next ? stations.definitionForLevel(next).description : ''
}
async function importLineLogo(line: GameLine, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try { logoDrafts[line.id] = await createLineLogoDataUrl(file) }
  catch (error) { await dialogs.alert(i18n.t(error instanceof Error ? error.message : 'Impossible d’importer ce logo.'), { title: i18n.t('Import impossible') }) }
}
function removeLineLogo(line: GameLine) { logoDrafts[line.id] = undefined }
async function deleteLine(line: GameLine) {
  if (!canDeleteLines.value) return
  const confirmed = await dialogs.confirm(
    `${i18n.t('Supprimer la ligne')} « ${line.name} » ? ${i18n.t('Aucun investissement ne sera remboursé.')}`,
    {
      title: i18n.t('Supprimer la ligne'),
      confirmLabel: i18n.t('Supprimer'),
      cancelLabel: i18n.t('Annuler'),
      tone: 'DANGER',
    },
  )
  if (confirmed) await network.deleteLine(line.id)
}
async function removeDraftStation(stationId: string) {
  if (!canManageStations.value) return
  network.removeDraftStation(stationId)
}
function editLine(line: GameLine) {
  if (!canModifyLines.value) return
  expandedLineId.value = line.id
  network.beginEditLine(line.id)
}

function showLineOnMap(line: GameLine) {
  selection.selectLine(line.id)
  focusGameMapLine(line)
}
function showStationOnMap(line: GameLine, station: GameLine['stations'][number]) {
  selection.selectStation(line.id, station.id)
  focusGameMapPoint(station.longitude, station.latitude, 14)
}
function openConnection(lineId: string) {
  selection.selectLine(lineId)
}

function interchangeLinesForStation(line: GameLine, stationId: string) {
  const ids = new Set<string>()
  for (const link of transitRuntime.stationInterchanges(line.id, stationId)) ids.add(link.fromLineId === line.id ? link.toLineId : link.fromLineId)
  return network.lines.value.filter(item => ids.has(item.id))
}
function connectionDistanceLabel(line: GameLine, stationId: string, otherLineId: string) {
  const link = transitRuntime.stationInterchanges(line.id, stationId).find(item => item.fromLineId === otherLineId || item.toLineId === otherLineId)
  if (!link) return ''
  if (link.distanceMeters <= 1) return 'même station'
  return `${Math.round(link.distanceMeters)} m`
}
</script>

<template>
  <section class="network-panel">
    <div class="section-head">
      <div>
        <span class="eyebrow">Centre opérationnel</span>
        <h2>Réseau</h2>
      </div>
      <span class="pill">{{ network.lines.value.length }} ligne(s)</span>
    </div>

    <div v-if="network.lines.value.length" class="network-overview network-overview--simple">
      <div class="network-pulse compact" :class="`pulse-${analytics.networkPulse.value.level.toLowerCase()}`">
        <div><span>État du réseau</span><strong>{{ analytics.networkPulse.value.label }}</strong></div>
        <small>{{ analytics.networkPulse.value.explanation }}</small>
      </div>
      <div class="metrics-grid overview-metrics overview-metrics--essential">
        <div><span>Voyageurs</span><strong>{{ integer(analytics.aggregate.value.passengers) }}</strong></div>
        <div><span>Demande servie</span><strong>{{ percent(analytics.aggregate.value.demandSatisfactionRate) }}</strong></div>
        <div><span>Attente</span><strong>{{ Math.round(analytics.aggregate.value.averageWaitMinutes) }} min</strong></div>
        <div><span>Qualité</span><strong>{{ Math.round(analytics.aggregate.value.quality || 0) }}/100</strong></div>
      </div>
      <details class="network-analysis-details">
        <summary>Analyse détaillée</summary>
        <div class="scope-row compact-scope">
          <button type="button" :class="{ active: analytics.scope.value === 'ALL' }" @click="analytics.selectAll()">Tous</button>
          <button
            v-for="scopeLine in analyticsScopeLines"
            :key="scopeLine.id"
            type="button"
            :class="{ active: analytics.scope.value === 'CUSTOM' && analytics.effectiveLineIds.value.includes(scopeLine.id) }"
            @click="analytics.toggleLine(scopeLine.id)"
          ><i :style="{ background: scopeLine.color }" />{{ scopeLine.shortCode }}</button>
        </div>
        <div class="analysis-rows">
          <div><span>Demande / capacité</span><strong>{{ integer(analytics.aggregate.value.demand) }} / {{ integer(analytics.aggregate.value.capacity) }}</strong><small>Charge {{ percent(analytics.aggregate.value.occupancyRate) }}</small></div>
          <div><span>Attente</span><strong>{{ integer(analytics.aggregate.value.waiting) }}</strong><small>{{ integer(analytics.aggregate.value.lost) }} renoncements</small></div>
          <div><span>Régularité / qualité</span><strong>{{ Math.round(analytics.aggregate.value.regularity || 85) }} / {{ Math.round(analytics.aggregate.value.quality || 0) }}</strong><small>sur 100</small></div>
        </div>
        <div v-if="analytics.trend.value.days > 1" class="trend-row compact-trends">
          <span><small>Voyageurs</small><b>{{ signedPercent(analytics.trend.value.passengersPercent) }}</b></span>
          <span><small>Attente</small><b>{{ signedNumber(analytics.trend.value.waitingDelta) }}</b></span>
          <span><small>Qualité</small><b>{{ signedNumber(analytics.trend.value.qualityDelta, ' pts') }}</b></span>
        </div>
      </details>
    </div>

    <div v-if="network.lines.value.length === 0" class="empty">
      Utilisez le bouton + Créer à gauche pour démarrer votre première ligne.
    </div>

    <div v-if="network.lines.value.length" class="my-lines-heading">
      <span>Mes lignes</span><i />
      <b class="visible-count">{{ visibleLineCount }}/{{ network.lines.value.length }}</b>
      <div class="line-groups-actions"><button type="button" @click="collapseAllModes">Tout plier</button><button type="button" @click="expandAllModes">Tout déplier</button></div>
    </div>

    <section v-if="network.lines.value.length" class="line-browser">
      <label class="line-search">
        <span>⌕</span>
        <input v-model="lineSearch" type="search" autocomplete="off" placeholder="Rechercher une ligne ou une station…">
        <button v-if="lineSearch" type="button" aria-label="Effacer la recherche" @click="lineSearch = ''">×</button>
      </label>
      <div class="line-filter-row" role="group" aria-label="Filtrer les lignes">
        <button type="button" :class="{ active: lineFilter === 'ALL' }" @click="lineFilter = 'ALL'">Toutes</button>
        <button type="button" :class="{ active: lineFilter === 'FAVORITES' }" @click="lineFilter = 'FAVORITES'">★ Favoris</button>
        <button type="button" :class="{ active: lineFilter === 'SATURATED' }" @click="lineFilter = 'SATURATED'">Saturées</button>
        <button type="button" :class="{ active: lineFilter === 'DEFICIT' }" @click="lineFilter = 'DEFICIT'">Déficitaires</button>
        <button type="button" :class="{ active: lineFilter === 'DISRUPTED' }" @click="lineFilter = 'DISRUPTED'">Perturbées</button>
        <button type="button" :class="{ active: lineFilter === 'PROJECT' }" @click="lineFilter = 'PROJECT'">Projets</button>
      </div>
    </section>

    <div v-if="favoriteLines.length" class="pinned-lines" aria-label="Lignes épinglées">
      <span>Épinglées</span>
      <button v-for="line in favoriteLines" :key="line.id" type="button" :title="line.name" @click="selection.selectLine(line.id)">
        <i :style="{ background: line.color }" />
        <b>{{ line.shortCode || line.name }}</b>
      </button>
    </div>

    <div v-if="network.lines.value.length && visibleLineCount === 0" class="empty filtered-empty">
      Aucune ligne ne correspond à cette recherche ou à ce filtre.
      <button type="button" @click="lineSearch = ''; lineFilter = 'ALL'">Tout afficher</button>
    </div>

    <template v-for="group in visibleLineGroups" :key="group.mode">
      <button class="line-mode-heading" type="button" :aria-expanded="!isModeCollapsed(group.mode)" @click="toggleMode(group.mode)">
        <span class="line-mode-chevron">{{ isModeCollapsed(group.mode) ? '▸' : '▾' }}</span>
        <span class="line-mode-dot" :style="{ background: getTransportModeDefinition(group.mode).accent }"></span>
        <strong>{{ group.label }}</strong>
        <span>{{ group.lines.length }}</span>
        <i />
      </button>

      <article
      v-for="line in (isModeCollapsed(group.mode) ? [] : group.lines)"
      :key="line.id"
      class="line-card"
      :class="{ selected: selection.selectedLineId.value === line.id }"
      :data-line-id="line.id"
    >
      <div class="line-summary-row">
        <button class="line-summary" type="button" @click="expandedLineId = expandedLineId === line.id ? null : line.id; selection.selectLine(line.id)">
          <span class="line-badge badge-rounded" :style="{ background: line.color }"><img v-if="line.customLogoDataUrl" :src="line.customLogoDataUrl" :alt="line.name"><b v-else>{{ line.shortCode }}</b></span>
          <span class="line-title">
            <strong data-i18n-skip>{{ line.name }}</strong>
            <small>{{ getTransportModeDefinition(line.mode).label }} · {{ statusLabel(line) }}</small>
          </span>
          <span class="line-kpis" v-if="lineReport(line)">
            <b>{{ integer(lineReport(line)?.passengers ?? 0) }}</b>
            <small>voyageurs</small>
          </span>
          <span class="chevron">{{ expandedLineId === line.id ? '−' : '+' }}</span>
        </button>
        <button class="line-pin-button" type="button" :class="{ active: isFavoriteLine(line.id) }" :aria-pressed="isFavoriteLine(line.id)" :aria-label="`${isFavoriteLine(line.id) ? 'Retirer des favoris' : 'Épingler'} ${line.name}`" :title="isFavoriteLine(line.id) ? 'Retirer des favoris' : 'Épingler'" @click="toggleFavoriteLine(line.id)">{{ isFavoriteLine(line.id) ? '★' : '☆' }}</button>
        <button class="line-delete-button" type="button" :disabled="!canDeleteLines" :title="deleteLineLockedReason || i18n.t('Supprimer la ligne')" :aria-label="`${i18n.t('Supprimer la ligne')} ${line.name}`" @click="deleteLine(line)">🗑</button>
      </div>

      <div v-if="expandedLineId === line.id" class="line-actions">
        <button type="button" @click="showLineOnMap(line)">◎ Voir sur la carte</button>
        <button type="button" :disabled="!canModifyLines" :title="modifyLineLockedReason || undefined" @click="openIdentity(line)">Modifier l’identité</button>
        <button type="button" :disabled="!canModifyLines" :title="modifyLineLockedReason || undefined" @click="editLine(line)">Modifier le tracé</button>
      </div>

      <section v-if="expandedLineId === line.id && identityLineId === line.id" class="identity-editor">
        <div class="identity-editor__head"><div><span class="eyebrow">Ligne {{ line.shortCode }}</span><strong>Modifier l’identité</strong></div><small>Infrastructure automatique · {{ getTransportModeDefinition(line.mode).label }}</small></div>
        <div class="form-grid">
          <label>Nom de la ligne<input :value="lineNameDraft(line)" @input="updateNameDraft(line.id, $event)"></label>
          <label>Indice<input :value="lineCodeDraft(line)" maxlength="4" @input="updateCodeDraft(line.id, $event)"></label>
          <label>Couleur<input type="color" :value="lineColorDraft(line)" @input="updateColorDraft(line.id, $event)"></label>
          <div class="logo-upload wide-field">
            <span>Logo personnalisé</span>
            <div class="logo-upload-row">
              <span class="logo-preview" :style="{ background: lineColorDraft(line) }"><img v-if="lineLogoDraft(line)" :src="lineLogoDraft(line)" :alt="line.name"><b v-else>{{ lineCodeDraft(line) }}</b></span>
              <label class="file-button">Importer une image<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" @change="importLineLogo(line, $event)"></label>
              <button v-if="lineLogoDraft(line)" type="button" @click="removeLineLogo(line)">Retirer</button>
            </div>
            <small>Le logo personnalisé est facultatif. Sans image, CLU affiche simplement l’indice et la couleur de la ligne.</small>
          </div>
        </div>
        <div class="identity-editor__actions"><button type="button" @click="cancelIdentity(line)">Annuler</button><button class="primary" type="button" :disabled="!canModifyLines" :title="modifyLineLockedReason || undefined" @click="applyIdentity(line)">Appliquer</button></div>
      </section>

      <div v-if="expandedLineId === line.id" class="line-details">
        <div class="metrics-grid line-core-metrics">
          <div><span>Longueur</span><strong>{{ (lineReport(line)?.lengthKm ?? calculateLineLengthKm(line)).toFixed(1) }} km</strong></div>
          <div><span>Temps de trajet</span><strong>{{ Math.round(lineReport(line)?.effectiveTravelTimeMinutes ?? lineReport(line)?.estimatedTravelTimeMinutes ?? 0) }} min</strong><small v-if="(lineReport(line)?.estimatedDelayMinutes ?? 0) > 0">+{{ Math.round(lineReport(line)?.estimatedDelayMinutes ?? 0) }} min avec perturbations</small><small v-else>Sans retard notable</small></div>
          <div><span>Passages</span><strong>{{ (lineReport(line)?.departuresPerHour ?? 0).toFixed(1) }}/h</strong></div>
          <div><span>Régularité</span><strong>{{ Math.round(lineReport(line)?.regularityScore ?? 85) }}/100</strong></div>
          <div><span>Capacité / jour</span><strong>{{ integer(lineReport(line)?.dailyCapacity ?? 0) }}</strong></div>
          <div class="wide passenger-summary"><span>Voyageurs transportés</span><strong>{{ integer(lineReport(line)?.passengers ?? 0) }} / {{ integer(lineReport(line)?.boardingDemandPassengers ?? 0) }}</strong><small>{{ percent(lineReport(line)?.demandSatisfactionRate ?? 1) }} de la demande · attente {{ Math.round(lineReport(line)?.averageWaitMinutes ?? 0) }} min · {{ integer(lineReport(line)?.waitingPassengersAfter ?? 0) }} encore en attente · {{ integer(lineReport(line)?.lostPassengers ?? 0) }} renoncé(s)</small></div>
          <div class="wide bottleneck-summary"><span>Tronçon le plus chargé</span><strong data-i18n-skip>{{ lineReport(line)?.bottleneckSegmentName ?? '—' }}</strong><small>{{ Math.round((lineReport(line)?.bottleneckSegmentLoadRate ?? 0) * 100) }} % de la capacité journalière de référence</small></div>
        </div>

        <section v-if="lineReport(line)" class="line-finance-card" :class="`finance-${lineFinancialTone(line)}`">
          <div><span>Recettes / jour</span><strong>{{ money(lineReport(line)?.revenue ?? 0) }}</strong></div>
          <div><span>Coûts / jour</span><strong>{{ money(lineReport(line)?.operatingCost ?? 0) }}</strong></div>
          <div><span>Résultat / jour</span><strong>{{ (lineReport(line)?.netResult ?? 0) >= 0 ? '+' : '−' }}{{ money(Math.abs(lineReport(line)?.netResult ?? 0)) }}</strong></div>
          <div><span>Coût / voyageur</span><strong>{{ lineCostPerPassenger(line) === null ? '—' : `${lineCostPerPassenger(line)!.toFixed(2)} €` }}</strong></div>
          <small>Lecture simple : la construction reste libre, tandis que les conséquences économiques restent visibles.</small>
        </section>

        <section class="line-diagram">
          <div class="diagram-head"><strong>Schéma de ligne</strong><small>{{ lineTerminiLabel(line) }}</small></div>
          <div class="diagram-stations">
            <button v-for="(station, index) in line.stations" :key="station.id" class="diagram-stop" type="button" @click="showStationOnMap(line, station)">
              <span class="diagram-rail"><i :style="{ borderColor: line.color, background: index === 0 || index === line.stations.length - 1 ? line.color : '#eef7f8' }" /></span>
              <span class="diagram-copy"><strong data-i18n-skip>{{ station.name }}</strong><small v-if="index === 0 || index === line.stations.length - 1">Terminus</small></span>
              <span v-if="interchangeLinesForStation(line, station.id).length" class="diagram-connections">
                <span v-for="other in interchangeLinesForStation(line, station.id)" :key="other.id" role="button" tabindex="0" :title="`${other.name} · ${connectionDistanceLabel(line, station.id, other.id)}`" class="diagram-badge" @click.stop="openConnection(other.id)" @keydown.enter.stop="openConnection(other.id)">
                  <img v-if="other.customLogoDataUrl" :src="other.customLogoDataUrl"><b v-else :style="{ background: other.color }">{{ other.shortCode }}</b>
                </span>
              </span>
            </button>
          </div>
          <div v-for="branch in (line.branches ?? [])" :key="branch.id" class="diagram-branch">
            <small class="branch-label">↳ Branche depuis {{ branchJunctionName(line, branch.fromStationId) }}</small>
            <div class="diagram-stations">
              <button v-for="(station, index) in branch.stations" :key="station.id" class="diagram-stop" type="button" @click="showStationOnMap(line, station)">
                <span class="diagram-rail"><i :style="{ borderColor: line.color, background: index === branch.stations.length - 1 ? line.color : '#eef7f8' }" /></span>
                <span class="diagram-copy"><strong data-i18n-skip>{{ station.name }}</strong><small v-if="index === branch.stations.length - 1">Terminus de branche</small></span>
                <span v-if="interchangeLinesForStation(line, station.id).length" class="diagram-connections">
                  <span v-for="other in interchangeLinesForStation(line, station.id)" :key="other.id" role="button" tabindex="0" :title="`${other.name} · ${connectionDistanceLabel(line, station.id, other.id)}`" class="diagram-badge" @click.stop="openConnection(other.id)" @keydown.enter.stop="openConnection(other.id)">
                    <img v-if="other.customLogoDataUrl" :src="other.customLogoDataUrl"><b v-else :style="{ background: other.color }">{{ other.shortCode }}</b>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <details>
          <summary>Service & matériel</summary>
          <div class="choice-row">
            <button
              v-for="level in GAME_SERVICE_LEVELS"
              :key="level.value"
              type="button"
              :class="{ active: line.serviceLevel === level.value }"
              :disabled="!canManageOperations"
              :title="operationsLockedReason || level.description"
              @click="setService(line, level.value)"
            >{{ level.label }}</button>
          </div>
          <p class="muted">{{ getServiceLevelDefinition(line.serviceLevel).description }} · service réel {{ percent(lineReport(line)?.serviceFulfillmentRate ?? 0) }}</p>

          <label class="toggle-row">
            <input type="checkbox" :disabled="!canManageFrequencies" :title="frequencyLockedReason || undefined" :checked="line.serviceProfileMode === 'ADVANCED'" @change="setAdvanced(line, $event)">
            Gestion Creuse / Normale / Pointe
          </label>
          <div v-if="line.serviceProfileMode === 'ADVANCED'" class="form-grid service-profile">
            <label>Creuse<select :disabled="!canManageFrequencies" :title="frequencyLockedReason || undefined" :value="line.serviceProfile.offPeak" @change="setProfile(line, 'offPeak', $event)"><option v-for="level in GAME_SERVICE_LEVELS" :key="level.value" :value="level.value">{{ level.label }}</option></select></label>
            <label>Normale<select :disabled="!canManageFrequencies" :title="frequencyLockedReason || undefined" :value="line.serviceProfile.normal" @change="setProfile(line, 'normal', $event)"><option v-for="level in GAME_SERVICE_LEVELS" :key="level.value" :value="level.value">{{ level.label }}</option></select></label>
            <label>Pointe<select :disabled="!canManageFrequencies" :title="frequencyLockedReason || undefined" :value="line.serviceProfile.peak" @change="setProfile(line, 'peak', $event)"><option v-for="level in GAME_SERVICE_LEVELS" :key="level.value" :value="level.value">{{ level.label }}</option></select></label>
          </div>

          <TimetableEditor :line="line" :can-edit="canManageSchedules" :locked-reason="scheduleLockedReason" />

          <div class="sub-card">
            <div class="sub-card__head"><strong>Matériel roulant</strong><b>{{ line.vehicleCount }}/{{ rollingStock.requiredVehicles(line) }}</b></div>
            <p>
              {{ rollingStock.performance(line).generation }} ·
              {{ lineReport(line)?.availableVehicleCount ?? line.vehicleCount }} disponible(s) ·
              {{ lineReport(line)?.unavailableVehicleCount ?? 0 }} indisponible(s) ·
              réserve {{ rollingStock.reserveVehicles(line) }}
            </p>
            <div class="metrics-grid compact rolling-kpis">
              <div><span>Capacité / véhicule</span><strong>{{ integer(lineReport(line)?.effectiveVehicleCapacity ?? rollingStock.effectiveCapacity(line)) }}</strong></div>
              <div><span>Vitesse de base</span><strong>{{ Number(lineReport(line)?.effectiveAverageSpeedKmH ?? rollingStock.effectiveSpeed(line)).toFixed(1) }} km/h</strong></div>
              <div><span>Régularité</span><strong>{{ Math.round(lineReport(line)?.regularityScore ?? 85) }}/100</strong></div>
              <div><span>Renfort actif</span><strong>{{ lineReport(line)?.activeBoostVehicleCount ?? (line.regulationMode === 'MANUAL' ? line.manualBoostVehicles : 0) }} véhicule(s)</strong></div>
            </div>
            <div class="fleet-adjuster">
              <span>Parc cible</span>
              <div class="counter">
                <button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="changeFleetDraft(line, -1)">−</button>
                <input :value="fleetDraft(line)" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" type="number" min="0" step="1" inputmode="numeric" @input="updateFleetDraft(line, $event)">
                <button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="changeFleetDraft(line, 1)">+</button>
              </div>
              <button type="button" :disabled="!canManageFleet || fleetPending[line.id] || fleetDraft(line) === line.vehicleCount" :title="fleetLockedReason || undefined" @click="applyFleetDraft(line)">{{ fleetPending[line.id] ? 'Application…' : 'Appliquer' }}</button>
              <button v-if="line.vehicleCount < rollingStock.requiredVehicles(line)" type="button" :disabled="!canManageFleet || fleetPending[line.id]" :title="fleetLockedReason || undefined" @click="completeFleet(line)">Parc recommandé</button>
            </div>
            <small class="muted">Le nombre est préparé localement puis appliqué en une seule fois : pas de rafale de clics ni de compteur qui se désynchronise.</small>
          </div>

          <div class="sub-card upgrade-card">
            <div class="sub-card__head"><strong>Améliorations du matériel</strong><b>{{ rollingStock.performance(line).generation }}</b></div>
            <p>Choisissez ce que vous voulez améliorer. Aucun catalogue complexe : les améliorations s’appliquent au parc de cette ligne.</p>
            <div class="upgrade-list">
              <div v-for="upgrade in rollingStock.upgradeDefinitions" :key="upgrade.key" class="upgrade-row">
                <div>
                  <strong>{{ upgrade.label }} · {{ rollingStock.upgradeLevel(line, upgrade.key) }}/{{ rollingStock.maxUpgradeLevel }}</strong>
                  <small>{{ rollingUpgradeSummary(line, upgrade.key) }} · {{ upgrade.shortEffect }}</small>
                </div>
                <button
                  type="button"
                  :disabled="!canManageFleet || rollingStock.isUpgradePending(line.id, upgrade.key) || rollingStock.upgradeLevel(line, upgrade.key) >= rollingStock.maxUpgradeLevel"
                  :title="fleetLockedReason || upgrade.description"
                  @click="improveRollingStock(line, upgrade.key)"
                >
                  {{ rollingStock.isUpgradePending(line.id, upgrade.key) ? 'Amélioration…' : rollingStock.upgradeLevel(line, upgrade.key) >= rollingStock.maxUpgradeLevel ? 'Maximum' : `Améliorer · ${money(rollingStock.upgradeCost(line, upgrade.key))}` }}
                </button>
              </div>
            </div>
          </div>

          <div class="sub-card regulation-card">
            <div class="sub-card__head"><strong>Régulation</strong><b>{{ line.regulationMode === 'AUTO' ? 'Automatique' : 'Manuelle' }}</b></div>
            <p v-if="line.regulationMode === 'AUTO'">CLU garde la fréquence cible et injecte automatiquement une partie de la réserve lorsqu’une file d’attente apparaît. C’est le mode conseillé si vous ne voulez pas microgérer.</p>
            <p v-else>Choisissez combien de véhicules de réserve sont injectés au-delà du service normal. Plus de renfort = moins d’attente, mais davantage d’usure et de coûts.</p>
            <div class="choice-row">
              <button type="button" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" :class="{ active: line.regulationMode === 'AUTO' }" @click="setRegulation(line, 'AUTO')">Auto</button>
              <button type="button" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" :class="{ active: line.regulationMode === 'MANUAL' }" @click="setRegulation(line, 'MANUAL')">Manuel</button>
            </div>
            <div v-if="line.regulationMode === 'MANUAL'" class="counter regulation-counter">
              <button type="button" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" @click="changeManualBoost(line, -1)">−</button>
              <b>{{ line.manualBoostVehicles ?? 0 }}</b>
              <button type="button" :disabled="!canManageOperations || (line.manualBoostVehicles ?? 0) >= rollingStock.reserveVehicles(line)" :title="operationsLockedReason || undefined" @click="changeManualBoost(line, 1)">+</button>
              <span>véhicule(s) de renfort sur {{ rollingStock.reserveVehicles(line) }} en réserve</span>
            </div>
          </div>
        </details>

        <details>
          <summary>Maintenance & fiabilité</summary>
          <div class="choice-row">
            <button
              v-for="level in GAME_MAINTENANCE_LEVELS"
              :key="level.value"
              type="button"
              :class="{ active: line.maintenanceLevel === level.value }"
              :disabled="!canManageOperations"
              :title="operationsLockedReason || level.description"
              @click="setMaintenance(line, level.value)"
            >{{ level.label }}</button>
          </div>
          <div class="sub-card">
            <div class="sub-card__head"><strong>État du parc</strong><b>{{ Math.round(line.fleetCondition) }} % · {{ maintenance.conditionLabel(line.fleetCondition) }}</b></div>
            <p>{{ GAME_MAINTENANCE_LEVELS.find(item => item.value === line.maintenanceLevel)?.description }}</p>
            <button type="button" :disabled="!canManageOperations || maintenance.overhaulCost(line) <= 0" :title="operationsLockedReason || undefined" @click="canManageOperations && maintenance.overhaulLine(line.id)">Remise à neuf · {{ money(maintenance.overhaulCost(line)) }}</button>
          </div>
        </details>

        <details>
          <summary>Contrôle & fraude</summary>
          <div class="sub-card">
            <div class="sub-card__head"><strong>{{ line.inspectionMode === 'AUTO' ? 'Contrôle automatique' : 'Contrôle manuel' }}</strong><button type="button" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" @click="canManageOperations && inspection.setMode(line.id, line.inspectionMode === 'AUTO' ? 'CUSTOM' : 'AUTO')">Basculer</button></div>
            <div v-if="line.inspectionMode === 'CUSTOM'" class="counter"><button type="button" aria-label="Retirer un contrôleur" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" @click="changeControllerCount(line, -1)">−</button><b>{{ line.controllerCount }}</b><button type="button" aria-label="Ajouter un contrôleur" :disabled="!canManageOperations" :title="operationsLockedReason || undefined" @click="changeControllerCount(line, 1)">+</button><span>contrôleurs</span></div>
            <div class="metrics-grid compact">
              <div><span>Fraudeurs estimés</span><strong>{{ integer(lineReport(line)?.fraudPassengers ?? 0) }}</strong></div>
              <div><span>Contrôlés verbalisés</span><strong>{{ integer(lineReport(line)?.detectedFraudPassengers ?? 0) }}</strong></div>
              <div><span>Amende payée</span><strong>{{ integer(lineReport(line)?.finePayingPassengers ?? 0) }}</strong></div>
              <div><span>Montant amende</span><strong>{{ GAME_FINE_AMOUNT }} €</strong></div>
              <div><span>Amendes encaissées</span><strong>{{ money(lineReport(line)?.fineRevenue ?? 0) }}</strong></div>
              <div><span>Coût contrôle</span><strong>{{ money(lineReport(line)?.controlCost ?? 0) }}</strong></div>
              <div><span>Perte fraude</span><strong>{{ money(lineReport(line)?.fraudRevenueLoss ?? 0) }}</strong></div>
            </div>
          </div>
        </details>

        <details>
          <summary>Stations & pôles</summary>
          <p class="muted">Simple = économique mais peu capacitaire · Aménagée = équilibre standard · Pôle = forte capacité/accessibilité pour les correspondances, avec un coût supérieur.</p>
          <div class="station-list">
            <div v-for="station in (network.editDraft.value?.id === line.id ? allLineStations(network.editDraft.value) : allLineStations(line))" :key="station.id" class="station-row">
              <button class="station-main" type="button" @click="selection.selectStation(line.id, station.id)">
                <strong data-i18n-skip>{{ station.name }}</strong>
                <small>{{ stations.facilityDefinition(station).label }} · cap. {{ integer(stations.dailyCapacity(line, station)) }} · {{ stations.interchangeLineCount(line, station) }} correspondance(s)</small>
              </button>
              <button type="button" title="Localiser sur la carte" @click="showStationOnMap(line, station)">◎</button>
              <template v-if="network.editDraft.value?.id === line.id">
                <button type="button" @click="network.requestInsertAfter(station.id)">Dévier après</button>
                <button type="button" @click="network.requestMoveStation(station.id)">Déplacer</button>
                <button type="button" :disabled="!network.canRemoveDraftStation(station.id)" @click="removeDraftStation(station.id)">Retirer</button>
              </template>
              <template v-else>
                <button v-if="stations.nextLevel(station)" type="button" :disabled="!canManageStations || stations.isUpgradePending(line.id, station.id)" :title="stationLockedReason || nextStationLevelDescription(station)" @click="canManageStations && stations.upgradeStation(line.id, station.id)">{{ stations.isUpgradePending(line.id, station.id) ? 'Amélioration…' : `Améliorer · ${money(stations.upgradeCost(line, station))}` }}</button>
              </template>
            </div>
          </div>
        </details>

        <section class="line-auto-reading">
<div v-if="lineReport(line)?.diagnostics?.length" class="diagnostic-list">
          <strong class="diagnostic-title">Lecture automatique de la ligne</strong>
          <article
            v-for="diagnostic in lineReport(line)?.diagnostics"
            :key="diagnostic.code"
            class="diagnostic-card"
            :class="`diag-${diagnostic.severity.toLowerCase()}`"
          >
            <div><strong>{{ diagnostic.label }}</strong><span>{{ diagnostic.description }}</span></div>
            <small>{{ diagnostic.recommendation }}</small>
          </article>
        </div>
        <div v-else-if="lineReport(line)?.topDemandConstraints?.length" class="explain-box">
          <strong>Ce qui limite actuellement la ligne</strong>
          <span>{{ lineReport(line)?.topDemandConstraints?.join(' · ') ?? '' }}</span>
        </div>
        </section>
      </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.network-panel{display:grid;gap:24px}.section-head,.line-summary,.project-bar,.sub-card__head,.create-row,.button-row,.counter,.toggle-row,.scope-row{display:flex;align-items:center;gap:10px}.section-head,.line-summary,.project-bar,.sub-card__head{justify-content:space-between}.eyebrow{font-size:calc(11px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(24px * var(--clu-text-scale,1))}.pill{padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-size:calc(12px * var(--clu-text-scale,1))}.map-hint,.project-bar,.create-card,.line-card,.explain-box,.sub-card,.network-overview{border:1px solid rgba(255,255,255,.09);background:rgba(13,20,26,.78);border-radius:14px}.map-hint{padding:10px 12px;color:#9ee8ef}.network-overview{padding:16px;display:grid;gap:14px}.scope-row{flex-wrap:wrap;margin-bottom:0}.scope-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:inherit;border-radius:8px;padding:6px 9px;cursor:pointer}.scope-row button.active{border-color:rgba(80,210,220,.48);background:rgba(80,210,220,.15)}.scope-row i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px}.overview-metrics{margin-bottom:0}.project-bar,.create-card{padding:12px}.project-bar small{display:block;opacity:.6;margin-top:3px}.mode-grid,.choice-row{display:flex;gap:6px;flex-wrap:wrap}.mode-button,.choice-row button,.button-row button,.counter button,.station-row>button,.sub-card button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:7px 10px;cursor:pointer}.mode-button.active,.choice-row button.active,.primary{background:rgba(80,210,220,.18)!important;border-color:rgba(80,210,220,.5)!important}.mode-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px}.create-row{margin-top:10px}.create-row input{flex:1}.line-card{overflow:hidden}.line-card.selected{border-color:rgba(80,210,220,.35)}.line-summary-row{display:flex;align-items:stretch}.line-summary{flex:1;min-width:0;width:100%;border:0;background:transparent;color:inherit;padding:15px 8px 15px 14px;text-align:left;cursor:pointer}.line-delete-button{flex:none;align-self:center;width:34px;height:34px;margin-right:10px;border:1px solid rgba(255,105,105,.28);border-radius:9px;background:rgba(180,50,50,.08);color:#ff7e88;font-size:calc(14px * var(--clu-text-scale,1));display:grid;place-items:center;cursor:pointer;opacity:1}.line-delete-button:hover,.line-delete-button:focus-visible{color:#ffb0b6;border-color:rgba(255,105,105,.5);background:rgba(180,50,50,.16)}.line-badge{width:38px;height:38px;display:grid;grid-template-columns:auto auto;place-content:center;gap:2px;color:#081014;font-weight:800;flex:none}.line-badge b{font-size:calc(12px * var(--clu-text-scale,1))}.line-emblem{font-size:calc(9px * var(--clu-text-scale,1));line-height:1;opacity:.72}.badge-circle{border-radius:50%}.badge-rounded{border-radius:10px}.badge-square{border-radius:3px}.badge-diamond{transform:rotate(45deg);border-radius:4px}.badge-diamond>*{transform:rotate(-45deg)}.line-title{display:grid;flex:1}.line-title small{opacity:.6;margin-top:2px}.line-kpis{display:grid;text-align:right}.line-kpis small{opacity:.55}.chevron{font-size:calc(20px * var(--clu-text-scale,1));opacity:.6}.line-actions{display:flex;gap:8px;padding:0 12px 12px}.line-actions button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:7px 10px;cursor:pointer}.line-details{padding:10px 14px 30px;display:grid;gap:28px}.metrics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.metrics-grid.compact{grid-template-columns:repeat(2,minmax(0,1fr))}.metrics-grid>div{padding:12px;border-radius:9px;background:rgba(255,255,255,.04);display:grid;gap:3px}.metrics-grid span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.55}.metrics-grid strong{font-size:calc(13px * var(--clu-text-scale,1))}.metrics-grid .wide{grid-column:span 2}.explain-box{padding:10px;display:grid;gap:4px}.explain-box span,.muted{font-size:calc(12px * var(--clu-text-scale,1));opacity:.65}.line-diagram{padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.diagram-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:11px}.diagram-head small{font-size:calc(10px * var(--clu-text-scale,1));opacity:.5;text-align:right}.diagram-stations{display:grid}.diagram-branch{margin-top:10px;padding:9px 9px 5px;border-radius:9px;background:rgba(255,255,255,.025);border-left:2px solid rgba(255,255,255,.13)}.branch-label{display:block;margin:0 0 5px 4px;font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.diagram-stop{border:0;background:transparent;color:inherit;display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,140px);align-items:center;min-height:38px;text-align:left;cursor:pointer;padding:0}.diagram-rail{align-self:stretch;position:relative;display:grid;place-items:center}.diagram-rail:before{content:'';position:absolute;top:0;bottom:0;width:3px;background:rgba(255,255,255,.14)}.diagram-stop:first-child .diagram-rail:before{top:50%}.diagram-stop:last-child .diagram-rail:before{bottom:50%}.diagram-rail i{position:relative;z-index:1;width:10px;height:10px;border:3px solid;border-radius:50%;box-shadow:0 0 0 2px #0e171d}.diagram-copy{display:grid;gap:1px;min-width:0;padding:5px 0}.diagram-copy strong{font-size:calc(11px * var(--clu-text-scale,1));overflow-wrap:anywhere}.diagram-copy small{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;opacity:.45}.diagram-connections{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;align-content:center;max-width:140px}.diagram-badge,.diagram-badge img,.diagram-badge b{width:25px;height:25px;border-radius:7px;display:grid;place-items:center}.diagram-badge{border:0;padding:0;background:transparent;cursor:pointer}.diagram-badge img{object-fit:contain;background:#fff}.diagram-badge b{font-size:calc(8px * var(--clu-text-scale,1));color:#081014}.diagnostic-list{display:grid;gap:9px}.diagnostic-title{font-size:calc(12px * var(--clu-text-scale,1));margin-bottom:2px}.diagnostic-card{padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);display:grid;gap:7px}.diagnostic-card>div{display:grid;gap:3px}.diagnostic-card span,.diagnostic-card small{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;opacity:.62}.diagnostic-card small{padding-top:6px;border-top:1px solid rgba(255,255,255,.06);opacity:.78}.fleet-adjuster{display:grid;grid-template-columns:auto minmax(120px,1fr) auto auto;align-items:center;gap:7px;margin-top:10px}.fleet-adjuster>span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.62}.fleet-adjuster .counter{margin:0}.fleet-adjuster input{width:62px;min-width:0;text-align:center;background:#121c23;color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px}.fleet-adjuster>button{white-space:nowrap}.diag-critical{border-color:rgba(235,91,91,.32);background:rgba(180,50,50,.055)}.diag-warning{border-color:rgba(231,171,74,.24);background:rgba(177,118,40,.045)}.diag-good{border-color:rgba(77,208,138,.2);background:rgba(48,159,102,.045)}details{border-top:1px solid rgba(255,255,255,.07);padding-top:23px;margin-top:8px}details+details{margin-top:10px}summary{cursor:pointer;font-weight:700;margin-bottom:18px}.choice-row{margin-bottom:12px}.choice-row+.muted{margin:0 0 18px;line-height:1.55}.form-grid+.muted{margin:13px 0 0;line-height:1.55}.button-row{margin-top:14px}.toggle-row{margin:17px 0 14px}.service-profile{margin-bottom:17px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form-grid label{display:grid;gap:4px;font-size:calc(11px * var(--clu-text-scale,1));opacity:.75}.form-grid input,.form-grid select,.create-row input{background:#121c23;color:#edf6f7;color-scheme:dark;border:1px solid rgba(255,255,255,.12);color:inherit;border-radius:8px;padding:8px}.sub-card{padding:16px;margin-top:18px}.sub-card p{font-size:calc(12px * var(--clu-text-scale,1));opacity:.65;line-height:1.55;margin:10px 0 14px}.counter b{min-width:24px;text-align:center}.station-list{display:grid;gap:11px;margin-top:14px}.station-row{display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;background:rgba(255,255,255,.035)}.station-main{flex:1!important;text-align:left;display:grid}.station-main small{opacity:.55;margin-top:3px}.line-badge img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.9)}.wide-field{grid-column:1/-1}.logo-upload{display:grid;gap:7px;font-size:calc(11px * var(--clu-text-scale,1));color:#edf6f7}.logo-upload>span{opacity:.75}.logo-upload-row{display:flex;align-items:center;gap:8px}.logo-preview{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;overflow:hidden;color:#081014}.logo-preview img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.9)}.file-button,.logo-upload-row>button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer}.file-button input{display:none}.logo-upload small{opacity:.5;line-height:1.4}.danger{color:#ff9c9c!important}.empty{padding:18px;text-align:center;opacity:.6}.network-pulse{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.network-pulse>div{display:grid;gap:3px}.network-pulse span{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;opacity:.5}.network-pulse strong{font-size:calc(13px * var(--clu-text-scale,1))}.network-pulse small{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4;opacity:.58}.pulse-critical{border-color:rgba(236,91,91,.32);background:rgba(191,53,53,.08)}.pulse-warning{border-color:rgba(233,174,75,.25);background:rgba(192,130,40,.06)}.pulse-good{border-color:rgba(82,211,143,.22);background:rgba(44,160,103,.06)}.priority-line{border-left:1px solid rgba(255,255,255,.08);padding-left:12px}.trend-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.trend-row>span{display:grid;gap:2px;padding:9px;border-radius:9px;background:rgba(255,255,255,.035)}.trend-row small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.trend-row b{font-size:calc(12px * var(--clu-text-scale,1))}.rolling-kpis{margin:12px 0 2px}.upgrade-card,.regulation-card{margin-top:14px}.upgrade-list{display:grid;gap:9px}.upgrade-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.035)}.upgrade-row>div{display:grid;gap:4px}.upgrade-row strong{font-size:calc(11px * var(--clu-text-scale,1))}.upgrade-row small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.56}.upgrade-row button{white-space:nowrap}.upgrade-row button:disabled,.regulation-counter button:disabled{opacity:.38;cursor:not-allowed}.regulation-counter{margin-top:13px;flex-wrap:wrap}.regulation-counter span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.6}
.my-lines-heading{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:calc(10px * var(--clu-text-scale,1));font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.8}.my-lines-heading>i{height:1px;flex:1;background:rgba(255,255,255,.08)}.line-groups-actions{display:flex;gap:5px}.line-groups-actions button{border:1px solid rgba(255,255,255,.09);border-radius:7px;background:rgba(255,255,255,.035);color:inherit;padding:4px 7px;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer;text-transform:none;letter-spacing:0}.line-mode-heading{width:100%;display:flex;align-items:center;gap:8px;margin:6px 2px -10px;padding:7px 2px 2px;border:0;background:transparent;color:inherit;cursor:pointer;text-align:left;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.09em}.line-mode-heading:hover strong{color:#a8f5f8}.line-mode-heading strong{font-size:inherit}.line-mode-heading>span:not(.line-mode-dot):not(.line-mode-chevron){min-width:20px;padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.07);text-align:center;font-size:calc(9px * var(--clu-text-scale,1));opacity:.68}.line-mode-heading i{height:1px;flex:1;background:rgba(255,255,255,.07)}.line-mode-chevron{width:14px;flex:none;text-align:center;opacity:.6}.line-mode-dot{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.06)}.line-finance-card{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.025)}.line-finance-card>div{display:grid;gap:3px}.line-finance-card span{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.06em;opacity:.5}.line-finance-card strong{font-size:calc(12px * var(--clu-text-scale,1))}.line-finance-card>small{grid-column:1/-1;font-size:calc(9px * var(--clu-text-scale,1));opacity:.55;line-height:1.4}.line-finance-card.finance-positive{border-color:rgba(82,211,143,.2)}.line-finance-card.finance-warning{border-color:rgba(233,174,75,.28)}.line-actions{flex-wrap:wrap}.identity-editor{margin:0 12px 6px;padding:14px;border:1px solid rgba(79,211,220,.18);border-radius:12px;background:rgba(79,211,220,.04);display:grid;gap:13px}.identity-editor__head{display:flex;align-items:end;justify-content:space-between;gap:12px}.identity-editor__head>div{display:grid;gap:2px}.identity-editor__head small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.55}.identity-editor__actions{display:flex;justify-content:flex-end;gap:8px}.identity-editor__actions button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer}.identity-editor__actions .primary{background:rgba(80,210,220,.18)!important;border-color:rgba(80,210,220,.5)!important}
.scope-large-network-hint{display:block;margin:-3px 0 8px;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.46}.visible-count{font-size:calc(8px * var(--clu-text-scale,1));padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.06);letter-spacing:0}.line-browser{display:grid;gap:8px;margin:0 0 5px;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.022)}.line-search{height:36px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:0 9px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#111b22}.line-search>span{opacity:.5}.line-search input{min-width:0;border:0;outline:0;background:transparent;color:inherit;font-size:calc(10px * var(--clu-text-scale,1))}.line-search button{border:0;background:transparent;color:inherit;opacity:.5;cursor:pointer;font-size:16px}.line-filter-row{display:flex;gap:5px;flex-wrap:wrap}.line-filter-row button{border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.035);color:inherit;padding:6px 8px;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer}.line-filter-row button.active{border-color:rgba(79,211,220,.34);background:rgba(79,211,220,.12);color:#c7fbff}.pinned-lines{display:flex;align-items:center;gap:5px;min-width:0;padding:2px 2px 5px;overflow-x:auto;scrollbar-width:thin}.pinned-lines>span{flex:none;margin-right:2px;font-size:calc(8px * var(--clu-text-scale,1));font-weight:850;text-transform:uppercase;letter-spacing:.1em;opacity:.45}.pinned-lines button{flex:none;display:flex;align-items:center;gap:5px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.035);color:inherit;padding:5px 7px;cursor:pointer}.pinned-lines i{width:7px;height:7px;border-radius:50%}.pinned-lines b{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(9px * var(--clu-text-scale,1))}.filtered-empty{display:grid;gap:8px}.filtered-empty button{justify-self:center;border:1px solid rgba(79,211,220,.25);background:rgba(79,211,220,.08);color:inherit;border-radius:8px;padding:6px 9px;cursor:pointer}.line-pin-button{width:34px;flex:none;border:0!important;background:transparent!important;color:#d7e3e6!important;font-size:17px!important;opacity:.5;cursor:pointer}.line-pin-button.active{color:#ffd972!important;opacity:1}.line-actions button.active{border-color:rgba(79,211,220,.35)!important;background:rgba(79,211,220,.12)!important}.line-summary-row{align-items:stretch}

@media(max-width:640px){.line-finance-card{grid-template-columns:repeat(2,minmax(0,1fr))}.line-groups-actions{display:none}.fleet-adjuster{grid-template-columns:1fr 1fr}.fleet-adjuster>span{grid-column:1/-1}.upgrade-row{grid-template-columns:1fr}.upgrade-row button{width:100%}.metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid{grid-template-columns:1fr}.station-row{flex-wrap:wrap}}

/* Refonte compacte : essentiel d'abord, détails à la demande. */
.network-panel{gap:13px}.section-head h2{font-size:calc(19px * var(--clu-text-scale,1))}.section-head .eyebrow{font-size:calc(8px * var(--clu-text-scale,1))}.network-overview--simple{padding:10px;gap:9px;border-radius:10px;background:rgba(255,255,255,.018)}.network-pulse.compact{display:grid;grid-template-columns:minmax(0,1fr);gap:3px;padding:0;background:transparent;border:0}.network-pulse.compact>div{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.network-pulse.compact span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.45}.network-pulse.compact strong{font-size:calc(11px * var(--clu-text-scale,1))}.network-pulse.compact>small{font-size:calc(8px * var(--clu-text-scale,1));line-height:1.35;opacity:.45}.overview-metrics--essential{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.overview-metrics--essential>div{padding:7px 8px;background:rgba(255,255,255,.025)}.network-analysis-details{border-top:1px solid rgba(255,255,255,.055);padding-top:7px}.network-analysis-details>summary{margin:0;font-size:calc(8.5px * var(--clu-text-scale,1));opacity:.58}.network-analysis-details[open]>summary{margin-bottom:8px}.my-lines-heading{margin-top:0}.line-browser{gap:6px}.line-filter-row{gap:4px}.line-filter-row button{padding:5px 7px;font-size:calc(7.5px * var(--clu-text-scale,1))}.line-card{border-radius:10px}.line-summary{padding:9px 6px 9px 10px}.line-actions{padding:0 9px 9px;gap:5px}.line-actions button{padding:6px 8px;font-size:calc(8px * var(--clu-text-scale,1))}.line-details{padding:8px 10px 18px;gap:16px}.sub-card,.explain-box{border-radius:10px}.metrics-grid{gap:6px}.metrics-grid>div{padding:8px}.metrics-grid span{font-size:calc(8px * var(--clu-text-scale,1))}.metrics-grid strong{font-size:calc(10px * var(--clu-text-scale,1))}@media(max-width:520px){.overview-metrics--essential{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* Finalisation réseau : moins de cartes, informations regroupées. */
.analysis-rows{display:grid;border-top:1px solid rgba(255,255,255,.055)}.analysis-rows>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.045);background:transparent}.analysis-rows span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.58}.analysis-rows strong{font-size:calc(9.5px * var(--clu-text-scale,1));white-space:nowrap}.analysis-rows small{font-size:calc(7.5px * var(--clu-text-scale,1));opacity:.42;text-align:right}.compact-scope{gap:4px;margin-bottom:6px}.compact-scope button{padding:4px 6px;font-size:calc(7.5px * var(--clu-text-scale,1))}.compact-trends{display:flex;align-items:center;gap:12px;margin-top:6px;padding:0 2px}.compact-trends>span{display:flex;align-items:baseline;gap:4px;padding:0;background:transparent;border:0;border-radius:0}.compact-trends small{font-size:calc(7.5px * var(--clu-text-scale,1));opacity:.42}.compact-trends b{font-size:calc(8px * var(--clu-text-scale,1))}.line-core-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.line-core-metrics>div{min-height:44px}.line-core-metrics small{font-size:calc(7.5px * var(--clu-text-scale,1));line-height:1.3;opacity:.45}.line-core-metrics .passenger-summary,.line-core-metrics .bottleneck-summary{grid-column:1/-1;min-height:0}.passenger-summary{position:relative;margin-top:9px;border-left:2px solid rgba(79,211,220,.42)}.passenger-summary::before{content:'';position:absolute;left:-2px;right:0;top:-8px;height:1px;background:rgba(255,255,255,.07)}.bottleneck-summary{background:rgba(236,170,73,.035)!important;border-left:2px solid rgba(236,170,73,.35)}.line-auto-reading{padding-top:4px;border-top:1px solid rgba(255,255,255,.06)}.line-auto-reading .diagnostic-list{gap:6px}.line-auto-reading .diagnostic-title{font-size:calc(9px * var(--clu-text-scale,1));opacity:.62}.line-auto-reading .diagnostic-card{padding:8px;border-radius:8px}.line-auto-reading .diagnostic-card span,.line-auto-reading .diagnostic-card small{font-size:calc(8px * var(--clu-text-scale,1));line-height:1.35}
@media(max-width:560px){.line-core-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.line-core-metrics .passenger-summary,.line-core-metrics .bottleneck-summary{grid-column:1/-1}}


.network-panel :is(button,input,select):disabled{cursor:not-allowed;filter:saturate(.35);opacity:.48}
</style>
