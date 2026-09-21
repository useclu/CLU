<script setup lang="ts">
import { currentGameLocale, currentGameLocaleTag, translateGameText } from '../../config/i18n'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import NetworkPanel from './panels/NetworkPanel.vue'
import MunicipalitiesPanel from './panels/MunicipalitiesPanel.vue'
import FinancePanel from './panels/FinancePanel.vue'
import EventsInfoPanel from './panels/EventsInfoPanel.vue'
import ObjectivesPanel from './panels/ObjectivesPanel.vue'
import LineCreationPanel from './panels/LineCreationPanel.vue'
import StationInspector from './StationInspector.vue'
import VehicleInspector from './VehicleInspector.vue'
import GameSettingsPanel from '../settings/GameSettingsPanel.vue'
import BilanPanel from './BilanPanel.vue'
import GameLoadingScreen from './GameLoadingScreen.vue'
import RoastToast from './RoastToast.vue'
import ChallengeResultDialog from '../challenges/ChallengeResultDialog.vue'
import HelpCenter from '../help/HelpCenter.vue'
import TutorialCoach from '../help/TutorialCoach.vue'

import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameNetwork } from '../../composables/useGameNetwork'
import type { GameDraftPreviewMetrics } from '../../composables/useGameNetwork'
import { useGameEconomy } from '../../composables/useGameEconomy'
import { useGameSimulation } from '../../composables/useGameSimulation'
import { useGameClock } from '../../composables/useGameClock'
import { useGameTerritory } from '../../composables/useGameTerritory'
import { useGameMunicipalities } from '../../composables/useGameMunicipalities'
import { useGameObjectives } from '../../composables/useGameObjectives'
import { useGameInfoCenter } from '../../composables/useGameInfoCenter'
import { useGameSelection } from '../../composables/useGameSelection'
import {
  clearGameMapOverlay,
  focusGameMapBounds,
  focusGameMapPoint,
  installGameMapBridge,
  syncGameMapOverlay,
} from '../../utils/mapBridge'
import type { GameMunicipality } from '../../types/territory'
import { GAME_SERVICE_LEVELS } from '../../config/operations'
import { GAME_MAINTENANCE_LEVELS } from '../../config/maintenance'
import { calculateLineLengthKm } from '../../engine/economy'
import { getLineAllStations } from '../../engine/network/geometry'
import { findMunicipalityForStation } from '../../engine/territory'
import { useGameTransitRuntime } from '../../composables/useGameTransitRuntime'
import { useGameSettings } from '../../composables/useGameSettings'
import { useGameRoast } from '../../composables/useGameRoast'
import { useGameAudio } from '../../composables/useGameAudio'
import { useGameRollingStock } from '../../composables/useGameRollingStock'
import { useGameMaintenance } from '../../composables/useGameMaintenance'
import { useGameChallenge } from '../../composables/useGameChallenge'
import { useGameFares } from '../../composables/useGameFares'
import { useGameHelp } from '../../composables/useGameHelp'
import type { GameVisualVehicle } from '../../engine/transitRuntime'
import type { GameLine, GameMaintenanceLevel, GameRegulationMode, GameRollingStockUpgradeKey, GameRollingStockUpgrades, GameServiceLevel } from '../../types/network'
import type { GameRoastHistoryEntry } from '../../types/roast'
import type { GameEconomyTransaction } from '../../types/economy'
import { getGameTerritoryCatalogEntry } from '../../config/territories'
import { isoDateForGameDay } from '../../config/calendar'

const GameMap = defineAsyncComponent(async () => {
  await installGameMapBridge()
  return (await import('../map/GameMap.vue')).default
})

type GameTool = 'NETWORK' | 'MUNICIPALITIES' | 'FINANCES' | 'EVENTS' | 'OBJECTIVES'
type ActionDialog = { title: string; message: string; finance?: boolean; variant?: 'CONSTRUCTION_SIGNED'; lineId?: string }

interface GameLineLaunchConfiguration {
  serviceLevel: GameServiceLevel
  vehicleCount: number
  rollingStockUpgrades: GameRollingStockUpgrades
  regulationMode: GameRegulationMode
  maintenanceLevel: GameMaintenanceLevel
  specificFareEnabled: boolean
  specificTicketPrice: number
}

const game = useMetropoleGame()
const network = useGameNetwork()
const economy = useGameEconomy()
const simulation = useGameSimulation()
const clock = useGameClock()
const territory = useGameTerritory()
const municipalities = useGameMunicipalities()
const objectives = useGameObjectives()
const info = useGameInfoCenter()
const selection = useGameSelection()
const transitRuntime = useGameTransitRuntime()
const preferences = useGameSettings()
const roast = useGameRoast()
const audio = useGameAudio()
const rollingStock = useGameRollingStock()
const maintenance = useGameMaintenance()
const challenge = useGameChallenge()
const fares = useGameFares()
const help = useGameHelp()

const selectedTool = ref<GameTool>((game.state.value.save?.data.uiState?.selectedPanel as GameTool) ?? 'NETWORK')
const menuOpen = ref(false)
const panelOpen = ref(game.state.value.save?.data.uiState?.panelOpen === true)
const isSaving = ref(false)
const creationOpen = ref(false)
const settingsOpen = ref(false)
const bilanOpen = ref(false)
const searchOpen = ref(false)
const citySearch = ref('')
const citySearchFocused = ref(false)
const stationSearch = ref('')
const actionDialog = ref<ActionDialog | null>(null)
const selectedVehicle = ref<GameVisualVehicle | null>(null)
const stationNameDraft = ref('')
const currentRoast = ref<GameRoastHistoryEntry | null>(null)
const knownLineStatuses = ref<Record<string, string>>(Object.fromEntries(network.lines.value.map(line => [line.id, line.status])))
const knownCompletedMunicipalityRequests = ref(new Set(municipalities.recentResolvedRequests.value.filter(request => request.status === 'COMPLETED').map(request => request.id)))
const knownCompletedObjectives = ref(new Set(game.state.value.save?.data.objectives.completed.map(item => item.id) ?? []))
const draftPreviewMetrics = ref<GameDraftPreviewMetrics | null>(null)
const challengeResultOpen = ref(false)
const financialPulse = ref<{ amount: number; id: number; reason: string } | null>(null)
let financialPulseTimer: ReturnType<typeof setTimeout> | null = null
const knownFinancialTransactionIds = new Set(economy.transactions.value.map(transaction => transaction.id))
const knownFinancialEventIds = new Set(game.state.value.save?.data.events?.history.map(entry => entry.id) ?? [])
const launchConfigOpen = ref(false)
const launchConfig = ref<GameLineLaunchConfiguration | null>(null)
const launchConfigurationMode = ref<'RECOMMENDED' | 'MANUAL'>('RECOMMENDED')
const gameShellRef = ref<HTMLElement | null>(null)
let dialogReturnFocus: HTMLElement | null = null

// V33 : le jeu reste masqué derrière un vrai écran de chargement jusqu'à ce que
// la carte ET les systèmes de partie soient réellement prêts.
const mapInstanceKey = ref(0)
const mapReadyForPlay = ref(false)
const startupSystemsReady = ref(false)
const startupError = ref<string | null>(null)
const startupMessage = ref('Préparation de votre métropole…')
const startupProgress = ref(4)
let startupAttempt = 0

const startupTerritoryName = computed(() => {
  const save = game.state.value.save
  if (!save) return 'Métropole'
  if (save.territory === 'GENERATED') return save.data.generatedTerritory?.name || 'Carte fictive'
  return getGameTerritoryCatalogEntry(save.territory).label
})

const gameplayReady = computed(() => mapReadyForPlay.value && startupSystemsReady.value && !startupError.value)

const gameName = computed(() => game.state.value.save?.name ?? 'Métropole')
const freePlaySettings = computed(() => game.state.value.save?.data.freePlaySettings ?? null)
const gameModeLabel = computed(() => {
  const definition = challenge.definition.value
  if (!definition) return freePlaySettings.value?.cheatUnlimitedMoney ? 'Partie libre · Triche' : 'Partie libre'
  return definition.kind === 'DAILY' ? 'Défi du jour' : 'Défi entre amis'
})
const toolWikiArticle = computed(() => ({
  NETWORK: 'reseau',
  MUNICIPALITIES: 'communes',
  FINANCES: 'finances',
  EVENTS: 'evenements',
  OBJECTIVES: 'objectifs',
}[selectedTool.value] ?? 'prise-en-main'))
const userSettings = computed(() => preferences.settings.value)
const moraleUi = computed(() => {
  const score = Math.round(simulation.networkMoraleScore.value)
  if (score >= 85) return { label: 'Très heureux', emoji: '😄', tone: 'morale-very-happy' }
  if (score >= 70) return { label: 'Heureux', emoji: '🙂', tone: 'morale-happy' }
  if (score >= 55) return { label: 'Moyen', emoji: '😐', tone: 'morale-medium' }
  if (score >= 40) return { label: 'Tendu', emoji: '😕', tone: 'morale-tense' }
  if (score >= 25) return { label: 'Mécontent', emoji: '😠', tone: 'morale-unhappy' }
  return { label: 'Très mécontent', emoji: '😡', tone: 'morale-critical' }
})

const dayBlockedReason = computed(() => {
  if (challenge.readOnly.value) return 'Défi terminé : la partie est en lecture seule.'
  if (simulation.isAdvancing.value) return 'Calcul de la journée en cours…'
  if (economy.insolvencyStatus.value === 'BANKRUPT') return 'Impossible de continuer : le réseau est en insolvabilité.'
  if (!economy.unlimitedMoney.value && economy.balance.value < 0) return 'Impossible de passer au jour suivant : régularisez votre trésorerie ou obtenez un financement dans Finances.'
  if (network.isBuilding.value) return 'Terminez ou annulez la conception de la ligne en cours avant de passer au jour suivant.'
  if (network.isEditing.value) return 'Validez ou annulez la modification de tracé avant de passer au jour suivant.'
  return ''
})

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(currentGameLocaleTag()).trim()
}

const citySuggestions = computed(() => {
  const query = normalizeSearch(citySearch.value)
  if (!query || query.length < 2) return []
  return territory.municipalities.value
    .map(municipality => ({ municipality, normalized: normalizeSearch(municipality.name) }))
    .filter(item => item.normalized.startsWith(query) || item.normalized.includes(query))
    .sort((a, b) => {
      const aStarts = a.normalized.startsWith(query) ? 0 : 1
      const bStarts = b.normalized.startsWith(query) ? 0 : 1
      return aStarts - bStarts || a.municipality.name.localeCompare(b.municipality.name, currentGameLocaleTag())
    })
    .slice(0, 7)
    .map(item => item.municipality)
})

const stationSuggestions = computed(() => {
  const query = normalizeSearch(stationSearch.value)
  if (!query || query.length < 2) return []
  return network.lines.value
    .flatMap(line => getLineAllStations(line).map(station => ({ line, station, normalized: normalizeSearch(`${station.name} ${line.name} ${line.shortCode}`) })))
    .filter(item => item.normalized.includes(query))
    .sort((a, b) => {
      const aStarts = normalizeSearch(a.station.name).startsWith(query) ? 0 : 1
      const bStarts = normalizeSearch(b.station.name).startsWith(query) ? 0 : 1
      return aStarts - bStarts || a.station.name.localeCompare(b.station.name, currentGameLocaleTag())
    })
    .slice(0, 10)
})

const projectInstruction = computed(() => {
  if (network.routeGuideMode.value) return 'Point de passage : cliquez sur la carte. Ce point guidera le prochain segment sans créer de station.'
  if (network.activeLine.value) return 'Cliquez sur la carte pour ajouter des stations. La ligne n’est pas encore en service : validez la conception pour lancer les travaux, ou annulez-la.'
  if (!network.editDraft.value) return ''
  if (network.mapAction.value.kind === 'INSERT_ON_TRACE') return 'Insertion : cliquez précisément sur le tracé existant. CLU projette l’arrêt sur la ligne ; seul le coût de la station est facturé.'
  const selectedName = network.editSelectedStation.value?.name
  if (network.mapAction.value.kind === 'APPEND' || network.mapAction.value.kind === 'PREPEND') return `Point de reprise : ${selectedName ?? 'terminus'}. Cliquez sur la carte pour prolonger le tracé.`
  if (network.mapAction.value.kind === 'INSERT_AFTER') return `Point de reprise : ${selectedName ?? 'arrêt sélectionné'}. Cliquez sur la carte pour insérer un arrêt sur le tronc.`
  if (network.mapAction.value.kind === 'CREATE_BRANCH') return `Bifurcation : ${selectedName ?? 'arrêt sélectionné'}. Cliquez sur la carte pour créer le premier arrêt de la nouvelle branche.`
  if (network.mapAction.value.kind === 'APPEND_BRANCH') return `Branche : ${selectedName ?? 'terminus sélectionné'}. Cliquez sur la carte pour prolonger cette branche.`
  if (network.mapAction.value.kind === 'MOVE') return `Déplacement de ${selectedName ?? 'la station'} : cliquez sur sa nouvelle position.`
  return 'Cliquez directement sur n’importe quel arrêt de la ligne pour choisir le point de reprise, le déplacer ou le retirer.'
})

const projectValidation = computed(() => network.activeLine.value
  ? network.activeProjectValidation.value
  : network.editProjectValidation.value)
const projectLine = computed(() => network.activeLine.value ?? network.editDraft.value)

const displayedProjectLength = computed(() => draftPreviewMetrics.value?.lengthKm ?? (projectLine.value ? calculateLineLengthKm(projectLine.value) : 0))
const displayedProjectCost = computed(() => draftPreviewMetrics.value?.cost ?? (network.activeLine.value ? network.activeProjectEstimate.value : network.editProjectEstimate.value))
const previewBudgetExceeded = computed(() => Boolean(draftPreviewMetrics.value && !draftPreviewMetrics.value.affordable))

function lineWithLaunchConfiguration(line: GameLine, config: GameLineLaunchConfiguration) {
  return {
    ...line,
    serviceLevel: config.serviceLevel,
    serviceProfile: { ...line.serviceProfile, normal: config.serviceLevel },
    maintenanceLevel: config.maintenanceLevel,
    regulationMode: config.regulationMode,
    vehicleCount: Math.max(0, Math.floor(config.vehicleCount)),
    rollingStockUpgrades: { ...config.rollingStockUpgrades },
  } satisfies GameLine
}

const launchPreviewLine = computed(() => {
  const line = network.activeLine.value
  const config = launchConfig.value
  return line && config ? lineWithLaunchConfiguration(line, config) : null
})
const launchRequiredVehicles = computed(() => launchPreviewLine.value ? rollingStock.requiredVehicles(launchPreviewLine.value) : 0)
const launchRecommendedVehicles = computed(() => {
  const required = launchRequiredVehicles.value
  return required > 0 ? required + Math.max(1, Math.ceil(required * 0.10)) : 0
})
const launchFleetPurchaseCost = computed(() => {
  const line = network.activeLine.value
  const config = launchConfig.value
  if (!line || !config) return 0
  const extra = Math.max(0, Math.floor(config.vehicleCount) - Math.max(0, Math.floor(line.vehicleCount ?? 0)))
  return extra * rollingStock.definition(line.mode).purchaseCost
})
const launchUpgradeCost = computed(() => {
  const line = network.activeLine.value
  const config = launchConfig.value
  if (!line || !config) return 0
  const preview = lineWithLaunchConfiguration(line, config)
  preview.rollingStockUpgrades = { ...line.rollingStockUpgrades }
  let total = 0
  for (const upgrade of rollingStock.upgradeDefinitions) {
    const key = upgrade.key as GameRollingStockUpgradeKey
    const target = Math.max(preview.rollingStockUpgrades[key] ?? 0, Math.floor(config.rollingStockUpgrades[key] ?? 0))
    while (preview.rollingStockUpgrades[key] < target) {
      total += rollingStock.upgradeCost(preview, key)
      preview.rollingStockUpgrades[key] += 1
    }
  }
  return total
})
const launchProjectCost = computed(() => network.activeProjectEstimate.value)
const launchTotalCost = computed(() => launchProjectCost.value + launchFleetPurchaseCost.value + launchUpgradeCost.value)
const launchShortfall = computed(() => economy.unlimitedMoney.value ? 0 : Math.max(0, launchTotalCost.value - economy.balance.value))
const launchFleetWarning = computed(() => Boolean(launchConfig.value && launchConfig.value.vehicleCount < launchRequiredVehicles.value))

function setLaunchVehicleCount(value: number) {
  if (!launchConfig.value) return
  const minimum = Math.max(0, Math.floor(network.activeLine.value?.vehicleCount ?? 0))
  launchConfig.value.vehicleCount = Math.max(minimum, Math.floor(Number.isFinite(value) ? value : minimum))
}
function changeLaunchVehicleCount(delta: number) {
  setLaunchVehicleCount((launchConfig.value?.vehicleCount ?? 0) + delta)
}
function updateLaunchVehicleCount(event: Event) {
  setLaunchVehicleCount(Number((event.target as HTMLInputElement).value))
}
function setLaunchUpgrade(key: GameRollingStockUpgradeKey, delta: number) {
  const config = launchConfig.value
  const line = network.activeLine.value
  if (!config || !line) return
  const minimum = Math.max(0, Math.floor(line.rollingStockUpgrades[key] ?? 0))
  config.rollingStockUpgrades[key] = Math.min(rollingStock.maxUpgradeLevel, Math.max(minimum, config.rollingStockUpgrades[key] + delta))
}
function applyRecommendedLaunchConfiguration() {
  launchConfigurationMode.value = 'RECOMMENDED'
  const line = network.activeLine.value
  const config = launchConfig.value
  if (!line || !config) return
  config.serviceLevel = 'STANDARD'
  config.maintenanceLevel = 'STANDARD'
  config.regulationMode = 'AUTO'
  config.specificFareEnabled = false
  config.rollingStockUpgrades = {
    capacity: line.rollingStockUpgrades.capacity,
    speed: line.rollingStockUpgrades.speed,
    reliability: line.rollingStockUpgrades.reliability,
    efficiency: line.rollingStockUpgrades.efficiency,
    boarding: line.rollingStockUpgrades.boarding,
  }
  nextTick(() => {
    if (launchConfig.value) launchConfig.value.vehicleCount = Math.max(line.vehicleCount, launchRecommendedVehicles.value)
  })
}

function useManualLaunchConfiguration() {
  launchConfigurationMode.value = 'MANUAL'
}

function signedDistance(value: number) {
  const rounded = Math.round(value * 10) / 10
  if (Math.abs(rounded) < .05) return ''
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)} km`
}

function signedMoney(value: number) {
  if (Math.abs(value) < 500_000) return ''
  return `${value > 0 ? '+' : '−'}${money(Math.abs(value))}`
}

function handleDraftPreview(longitude: number | null, latitude: number | null, routeCoordinates?: Array<[number, number]>) {
  if (longitude === null || latitude === null) {
    draftPreviewMetrics.value = null
    return
  }
  draftPreviewMetrics.value = network.previewDraftAt(longitude, latitude, routeCoordinates)
}

const mapDraftAnchor = computed(() => {
  const active = network.activeLine.value
  if (active) {
    const station = active.stations.at(-1)
    if (!station) return null
    return {
      longitude: station.longitude,
      latitude: station.latitude,
      stationId: station.id,
      kind: 'APPEND',
    }
  }

  if (!network.editDraft.value || network.mapAction.value.kind === 'NONE') return null
  const station = network.editSelectedStation.value
  if (!station) return null
  return {
    longitude: station.longitude,
    latitude: station.latitude,
    stationId: station.id,
    kind: network.mapAction.value.kind,
  }
})

function money(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function translatedFinancialText(value: string) {
  return translateGameText(value, currentGameLocale())
}

function transactionFinancialReason(transaction: GameEconomyTransaction) {
  const labels: Partial<Record<GameEconomyTransaction['kind'], string>> = {
    STATION_CONSTRUCTION: 'Construction de station',
    SEGMENT_CONSTRUCTION: 'Construction d’infrastructure',
    LINE_PROJECT: 'Construction de ligne',
    LINE_MODIFICATION: 'Modification de ligne',
    VEHICLE_PURCHASE: 'Achat de matériel roulant',
    VEHICLE_SALE: 'Revente de matériel roulant',
    FLEET_OVERHAUL: 'Remise à neuf du parc',
    FLEET_UPGRADE: 'Amélioration du matériel roulant',
    STATION_UPGRADE: 'Amélioration de station',
    OBJECTIVE_REWARD: 'Récompense d’objectif',
    MUNICIPALITY_SUBSIDY: 'Subvention communale',
    PUBLIC_DEVELOPMENT_GRANT: 'Dotation publique',
    PASSENGER_COMPENSATION: 'Compensation voyageurs',
    DEBT_BORROW: 'Emprunt',
    DEBT_REPAYMENT: 'Remboursement de dette',
    DEBT_INTEREST: 'Intérêts de dette',
    DEBT_PENALTY: 'Pénalité de dette',
  }
  const label = translatedFinancialText(labels[transaction.kind] ?? transaction.kind)
  const context = transaction.lineName || transaction.note
  return context ? `${label} · ${context}` : label
}

function uniqueFinancialReasons(reasons: string[]) {
  return [...new Set(reasons.map(reason => reason.trim()).filter(Boolean))]
}
function integer(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value)
}
function toolTitle(tool: GameTool) {
  return { NETWORK: 'Réseau', MUNICIPALITIES: 'Communes', FINANCES: 'Finances', EVENTS: 'Événements & Infos', OBJECTIVES: 'Objectifs' }[tool]
}
async function persistPanelState() {
  const save = game.state.value.save
  if (!save || network.isEditing.value) return
  save.data.uiState = { panelOpen: panelOpen.value, selectedPanel: selectedTool.value }
  await game.persistCurrentGame()
}
function selectTool(tool: GameTool) {
  selectedTool.value = tool
  panelOpen.value = true
  void persistPanelState()
}
function closePanel() {
  panelOpen.value = false
  void persistPanelState()
}
function openPauseMenu() { clock.pause(); menuOpen.value = true }
function openCreation() {
  if (challenge.readOnly.value) return
  audio.playUi('CLICK')
  panelOpen.value = false
  selectedVehicle.value = null
  selection.clear()
  searchOpen.value = false
  creationOpen.value = true
}
function openSettings() {
  audio.playUi('CLICK')
  clock.pause()
  menuOpen.value = false
  settingsOpen.value = true
}
function openFinances() {
  audio.playUi('CLICK')
  actionDialog.value = null
  selectTool('FINANCES')
}
async function handleMapClick(longitude: number, latitude: number, routeCoordinates?: Array<[number, number]>) {
  if (challenge.readOnly.value) return
  if (network.routeGuideMode.value) {
    network.addDraftGuidePoint(longitude, latitude)
    return
  }
  const municipality = findMunicipalityForStation(
    territory.municipalities.value,
    { id: 'preview', name: '', longitude, latitude },
  )
  const placed = await network.handleMapClick(longitude, latitude, municipality?.name ?? 'Nouvelle station', !municipality, routeCoordinates)
  if (placed) audio.playUi('CLICK')
  draftPreviewMetrics.value = null
  if (network.pendingStationNaming.value) stationNameDraft.value = network.pendingStationNaming.value.suggestedName
}
function handleLineClick(lineId: string) {
  if (network.isBuilding.value || network.isEditing.value) return
  selectedVehicle.value = null
  selection.selectLine(lineId)
  selectTool('NETWORK')
}

async function handleStationClick(lineId: string, stationId: string) {
  if (network.isEditing.value) {
    if (lineId === network.editingLineId.value) {
      network.requestContinueFromStation(stationId)
      return
    }
    const linked = await network.useExistingStation(lineId, stationId)
    if (linked) return
    return
  }
  if (network.isBuilding.value) {
    const linked = await network.useExistingStation(lineId, stationId)
    if (linked) return
  }
  selectedVehicle.value = null
  selection.selectStation(lineId, stationId)
}
function handleVehicleClick(vehicle: GameVisualVehicle) {
  selection.clear()
  selectedVehicle.value = vehicle
}
async function confirmStationName() {
  await network.finalizePendingStationName(stationNameDraft.value)
  audio.playUi('CONFIRM')
  stationNameDraft.value = ''
}
async function cancelStationName() {
  await network.cancelPendingStationName()
  stationNameDraft.value = ''
}
function handleBridgeLineSelect(event: Event) {
  const lineId = (event as CustomEvent<{ lineId?: string }>).detail?.lineId
  if (!lineId) return
  selectedVehicle.value = null
  selection.selectLine(lineId)
  selectTool('NETWORK')
}
function handleBridgeStationSelect(event: Event) {
  const detail = (event as CustomEvent<{ lineId?: string; stationId?: string }>).detail
  if (!detail?.lineId || !detail.stationId) return
  selectedVehicle.value = null
  selection.selectStation(detail.lineId, detail.stationId)
}
function handleOpenNetworkLine(event: Event) {
  const lineId = (event as CustomEvent<{ lineId?: string }>).detail?.lineId
  if (lineId) {
    selectedVehicle.value = null
    selection.selectLine(lineId)
  }
  selectedTool.value = 'NETWORK'
  panelOpen.value = true
}
async function advanceDay() {
  if (challenge.readOnly.value) return
  const report = await simulation.advanceDay()
  if (!report) { audio.playUi('ERROR'); return }
  clock.resetCycle()
  audio.playUi('EVENT')
}
async function saveGame() {
  if (isSaving.value) return
  isSaving.value = true
  try { await game.persistCurrentGame() }
  finally { isSaving.value = false }
}
async function finishChallengeNow() {
  await challenge.finishManually()
  menuOpen.value = false
  challengeResultOpen.value = true
}

async function saveAndQuit() {
  if (isSaving.value) return
  if (challenge.result.value && challenge.definition.value?.kind === 'DAILY' && !challenge.runtime.value?.archivedChallenge) {
    menuOpen.value = false
    challengeResultOpen.value = true
    return
  }
  isSaving.value = true
  try {
    await game.persistCurrentGame()
    menuOpen.value = false
    game.returnHome()
  }
  finally { isSaving.value = false }
}

function focusMunicipality(municipality: GameMunicipality) {
  citySearch.value = municipality.name
  citySearchFocused.value = false
  focusGameMapBounds(municipality.bounds)
  searchOpen.value = false
}
function searchFirstCity() {
  const first = citySuggestions.value[0]
  if (first) focusMunicipality(first)
}
function closeSearchSoon() {
  window.setTimeout(() => { citySearchFocused.value = false }, 140)
}
function toggleSearchHub() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    creationOpen.value = false
    selectedVehicle.value = null
  }
}
function focusStationSearchResult(result: { line: GameLine; station: GameLine['stations'][number] }) {
  stationSearch.value = result.station.name
  selection.selectStation(result.line.id, result.station.id)
  selectedTool.value = 'NETWORK'
  panelOpen.value = true
  void persistPanelState()
  focusGameMapPoint(result.station.longitude, result.station.latitude, 15)
  searchOpen.value = false
}

function handleDraftHistoryShortcut(event: KeyboardEvent) {
  if (!(network.isBuilding.value || network.isEditing.value) || bilanOpen.value || settingsOpen.value || menuOpen.value) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey && network.canUndoDraft.value) {
    event.preventDefault()
    void network.undoDraft()
  }
  else if ((key === 'y' || (key === 'z' && event.shiftKey)) && network.canRedoDraft.value) {
    event.preventDefault()
    void network.redoDraft()
  }
}

function openLaunchConfiguration() {
  const line = network.activeLine.value
  const validation = network.activeProjectValidation.value
  if (!line) return
  if (validation.ok === false) {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: validation.code === 'INSUFFICIENT_FUNDS' ? 'Financement insuffisant' : 'Conception impossible à valider',
      message: validation.message,
      finance: validation.code === 'INSUFFICIENT_FUNDS',
    }
    return
  }
  const currentSpecificFare = fares.customPolicy.value.lineTicketPrices[line.id]
  launchConfig.value = {
    serviceLevel: 'STANDARD',
    vehicleCount: Math.max(0, line.vehicleCount ?? 0),
    rollingStockUpgrades: { ...line.rollingStockUpgrades },
    regulationMode: 'AUTO',
    maintenanceLevel: 'STANDARD',
    specificFareEnabled: Number.isFinite(currentSpecificFare),
    specificTicketPrice: Number.isFinite(currentSpecificFare) ? Number(currentSpecificFare) : Number(fares.customPolicy.value.ticketPrices[line.mode] ?? 0),
  }
  launchConfigurationMode.value = 'RECOMMENDED'
  launchConfigOpen.value = true
  nextTick(() => {
    const currentLine = network.activeLine.value
    if (!currentLine || !launchConfig.value) return
    launchConfig.value.vehicleCount = Math.max(currentLine.vehicleCount, launchRecommendedVehicles.value)
  })
}

async function validateActiveProject() {
  openLaunchConfiguration()
}

async function confirmConfiguredProject() {
  const line = network.activeLine.value
  const config = launchConfig.value
  if (!line || !config) return
  if (launchShortfall.value > 0) {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: 'Financement insuffisant',
      message: `Il manque ${money(launchShortfall.value)} pour financer les travaux, le parc et les options choisies.`,
      finance: true,
    }
    return
  }
  if (config.specificFareEnabled && (!Number.isFinite(Number(config.specificTicketPrice)) || Number(config.specificTicketPrice) < 0)) {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: 'Tarification spécifique',
      message: 'Indiquez un prix de billet valide et positif ou désactivez la tarification spécifique pour cette ligne.',
      finance: true,
    }
    return
  }

  const projectBeforeValidation = line
  await network.setLineServiceLevel(line.id, config.serviceLevel)
  await maintenance.setLevel(line.id, config.maintenanceLevel)
  await rollingStock.setRegulationMode(line.id, config.regulationMode)

  const fleetOk = await rollingStock.setFleetSize(line.id, config.vehicleCount)
  if (!fleetOk) {
    audio.playUi('ERROR')
    actionDialog.value = { title: 'Matériel roulant', message: 'Le parc choisi n’a pas pu être financé. Vérifiez votre trésorerie.' }
    return
  }

  for (const upgrade of rollingStock.upgradeDefinitions) {
    const key = upgrade.key as GameRollingStockUpgradeKey
    const target = Math.max(line.rollingStockUpgrades[key] ?? 0, config.rollingStockUpgrades[key] ?? 0)
    while ((line.rollingStockUpgrades[key] ?? 0) < target) {
      const upgraded = await rollingStock.upgrade(line.id, key)
      if (!upgraded) {
        audio.playUi('ERROR')
        actionDialog.value = { title: 'Configuration du matériel', message: `Impossible d’appliquer l’amélioration « ${upgrade.label} ». Le projet reste en conception et les achats déjà effectués sont conservés.` }
        return
      }
    }
  }

  const result = await network.finishLineDetailed()
  if (result.ok === false) {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: result.code === 'INSUFFICIENT_FUNDS' ? 'Financement insuffisant' : 'Conception impossible à valider',
      message: result.message,
      finance: result.code === 'INSUFFICIENT_FUNDS',
    }
    return
  }

  if (config.specificFareEnabled) await fares.setLineTicketPrice(projectBeforeValidation.id, config.specificTicketPrice)
  else await fares.clearLineTicketPrice(projectBeforeValidation.id)

  launchConfigOpen.value = false
  launchConfig.value = null
  audio.playUi('CONSTRUCTION')
  draftPreviewMetrics.value = null
  const days = Math.max(1, projectBeforeValidation.constructionDaysRemaining ?? 1)
  const openingDay = simulation.day.value + days
  const openingDate = game.state.value.save ? isoDateForGameDay(openingDay, game.state.value.save.data.calendarStartDate) : ''
  const entry = roast.pushAssistant(
    'Travaux démarrés',
    '{line} est en travaux. Le parc est déjà préparé pour l’ouverture. Ouverture estimée dans {days} jour(s), au Jour {openingDay}{openingDate}. Laissez le temps en Play ou utilisez « Passer au jour suivant » pour avancer.',
    simulation.day.value,
    projectBeforeValidation.id,
    projectBeforeValidation.name,
    { line: projectBeforeValidation.name, days, openingDay, openingDate: openingDate ? ` (${openingDate})` : '' },
  )
  actionDialog.value = {
    title: 'Projet validé',
    message: `La construction de « ${projectBeforeValidation.name} » est officiellement lancée. Son exploitation est préparée et l’ouverture est prévue au Jour ${openingDay}${openingDate ? ` (${openingDate})` : ''}.`,
    variant: 'CONSTRUCTION_SIGNED',
    lineId: projectBeforeValidation.id,
  }
  if (entry) currentRoast.value = entry
}

async function advanceToOpening() {
  const lineId = actionDialog.value?.lineId
  if (!lineId || challenge.readOnly.value) return
  actionDialog.value = null
  for (let step = 0; step < 90; step += 1) {
    const line = network.lines.value.find(item => item.id === lineId)
    if (!line || line.status !== 'CONSTRUCTION') break
    const report = await simulation.advanceDay()
    if (!report) break
    clock.resetCycle()
  }
}

async function validateLineEdit() {
  const result = await network.commitLineEditDetailed()
  if (result.ok === false) {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: result.code === 'INSUFFICIENT_FUNDS' ? 'Financement insuffisant' : 'Modification impossible',
      message: result.message,
      finance: result.code === 'INSUFFICIENT_FUNDS',
    }
  }
  else {
    audio.playUi('CONFIRM')
    draftPreviewMetrics.value = null
  }
}


watch(
  () => simulation.lastDayReport.value?.day ?? 0,
  async (day, previousDay) => {
    if (!day || day === previousDay) return
    const report = simulation.lastDayReport.value
    if (!report) return
    const entry = roast.processDay(report)
    if (entry) currentRoast.value = entry
    await game.persistCurrentGame()
  },
)

watch(
  () => network.lines.value.map(line => `${line.id}:${line.status}:${line.constructionDaysRemaining ?? 0}`).join('|'),
  () => {
    const previous = knownLineStatuses.value
    const next: Record<string, string> = {}
    for (const line of network.lines.value) {
      next[line.id] = line.status
      if (previous[line.id] === 'CONSTRUCTION' && line.status === 'OPERATIONAL') {
        const entry = roast.pushAssistant(
          'Ligne ouverte',
          '{line} est prête : les travaux sont terminés et la ligne est désormais ouverte aux voyageurs.',
          simulation.day.value,
          line.id,
          line.name,
          { line: line.name },
        )
        if (entry) currentRoast.value = entry
      }
    }
    knownLineStatuses.value = next
  },
)

watch(
  () => municipalities.recentResolvedRequests.value.map(request => `${request.id}:${request.status}`).join('|'),
  () => {
    const known = knownCompletedMunicipalityRequests.value
    const next = new Set(known)
    for (const request of municipalities.recentResolvedRequests.value) {
      if (request.status !== 'COMPLETED' || known.has(request.id)) continue
      next.add(request.id)
      if ((request.subsidyAmount ?? 0) !== 0) continue
      const entry = roast.pushAssistant(
        'Demande communale satisfaite',
        '{municipality} confirme que la demande est satisfaite. Aide accordée : {amount}.',
        simulation.day.value,
        undefined,
        undefined,
        { municipality: request.municipalityName, amount: money(request.subsidyAmount) },
      )
      if (entry) currentRoast.value = entry
    }
    knownCompletedMunicipalityRequests.value = next
  },
)

watch(
  () => game.state.value.save?.data.objectives.completed.map(item => item.id).join('|') ?? '',
  () => {
    const completed = game.state.value.save?.data.objectives.completed ?? []
    const known = knownCompletedObjectives.value
    const next = new Set(known)
    for (const objective of completed) {
      if (known.has(objective.id)) continue
      next.add(objective.id)
      if ((objective.reward ?? 0) !== 0) continue
      const entry = roast.pushAssistant(
        'Objectif accompli',
        '{objective} est accompli. Récompense : {amount}.',
        simulation.day.value,
        undefined,
        undefined,
        { objective: objective.title, amount: money(objective.reward ?? 0) },
      )
      if (entry) currentRoast.value = entry
    }
    knownCompletedObjectives.value = next
  },
)

watch(
  () => economy.balance.value,
  (value, previous) => {
    if (previous === undefined || economy.unlimitedMoney.value) return
    const amount = Math.round(value - previous)
    if (amount === 0) return

    const reasons: string[] = []
    let explainedAmount = 0

    for (const transaction of economy.transactions.value) {
      if (knownFinancialTransactionIds.has(transaction.id)) continue
      knownFinancialTransactionIds.add(transaction.id)
      const signedAmount = -Math.round(transaction.amount)
      if (signedAmount === 0) continue
      explainedAmount += signedAmount
      reasons.push(transactionFinancialReason(transaction))
    }

    const eventHistory = game.state.value.save?.data.events?.history ?? []
    for (const entry of eventHistory) {
      if (knownFinancialEventIds.has(entry.id)) continue
      knownFinancialEventIds.add(entry.id)
      const impact = Math.round(entry.balanceImpact ?? 0)
      if (impact === 0) continue
      explainedAmount += impact
      reasons.push(`${translatedFinancialText('Événement')} · ${entry.title} · ${entry.choiceLabel}`)
    }

    const unexplainedAmount = amount - explainedAmount
    if (unexplainedAmount !== 0) {
      const report = simulation.lastDayReport.value
      if (report && Math.abs(Math.round(report.netResult) - unexplainedAmount) <= 2) {
        reasons.push(`${translatedFinancialText('Exploitation')} · ${translatedFinancialText('Jour')} ${report.day}`)
      }
      else {
        reasons.push(translatedFinancialText('Ajustement de trésorerie'))
      }
    }

    const reason = uniqueFinancialReasons(reasons).join(' + ') || translatedFinancialText('Ajustement de trésorerie')
    financialPulse.value = { amount, id: Date.now(), reason }
    if (financialPulseTimer) clearTimeout(financialPulseTimer)
    financialPulseTimer = setTimeout(() => { financialPulse.value = null }, 2000)

    const entry = roast.pushAssistant(
      amount > 0 ? 'Entrée d’argent' : 'Dépense enregistrée',
      '{reason} : {amount}. Trésorerie actuelle : {balance}.',
      simulation.day.value,
      undefined,
      undefined,
      {
        reason,
        amount: `${amount > 0 ? '+' : '−'}${money(Math.abs(amount))}`,
        balance: money(value),
      },
    )
    if (entry) currentRoast.value = entry
  },
)

watch(
  [menuOpen, settingsOpen, () => help.wikiOpen.value],
  values => { if (values.some(Boolean)) clock.pause() },
)

watch(
  () => preferences.settings.value.cluRoastEnabled,
  enabled => {
    if (!enabled) currentRoast.value = null
  },
)

watch(
  [() => network.isBuilding.value, () => network.isEditing.value, () => network.mapAction.value],
  () => { draftPreviewMetrics.value = null },
  { deep: true },
)

watch(
  () => network.isEditing.value,
  editing => {
    if (!editing) return
    panelOpen.value = false
    creationOpen.value = false
    selectedVehicle.value = null
    selection.clear()
  },
  { immediate: true },
)

watch(
  [
    () => network.displayLines.value,
    () => selection.selectedLineId.value,
    () => network.activeLineId.value,
    () => network.editingLineId.value,
  ],
  () => syncGameMapOverlay(network.displayLines.value, {
    selectedLineId: selection.selectedLineId.value,
    activeLineId: network.activeLineId.value,
    editingLineId: network.editingLineId.value,
  }),
  { deep: true, immediate: true },
)

function handleMapLoadingProgress(message: string, progress: number) {
  if (startupError.value) return
  startupMessage.value = message
  startupProgress.value = Math.max(startupProgress.value, Math.min(94, progress))
}

function handleMapReady() {
  mapReadyForPlay.value = true
  if (startupSystemsReady.value) {
    startupMessage.value = 'Métropole prête.'
    startupProgress.value = 100
  }
}

function handleMapLoadError(message: string) {
  startupError.value = message || 'La carte n’a pas pu être préparée.'
}

async function prepareStartupSystems(attempt: number) {
  startupSystemsReady.value = false
  try {
    startupMessage.value = 'Chargement des données territoriales…'
    startupProgress.value = Math.max(startupProgress.value, 12)
    const territoryLoaded = await territory.ensureLoaded()
    if (attempt != startupAttempt) return
    if (!territoryLoaded) throw new Error(territory.loadError.value || 'Impossible de préparer les communes de ce territoire.')

    startupMessage.value = 'Synchronisation des communes…'
    startupProgress.value = Math.max(startupProgress.value, 38)
    if (!challenge.readOnly.value) await municipalities.syncRequests(false)
    if (attempt != startupAttempt) return

    startupMessage.value = 'Préparation des objectifs…'
    startupProgress.value = Math.max(startupProgress.value, 56)
    if (!challenge.readOnly.value) await objectives.sync()
    if (attempt != startupAttempt) return

    startupSystemsReady.value = true
    if (mapReadyForPlay.value) {
      startupMessage.value = 'Métropole prête.'
      startupProgress.value = 100
    }
  }
  catch (error) {
    if (attempt != startupAttempt) return
    startupError.value = error instanceof Error ? error.message : 'Impossible de préparer la partie.'
  }
}

function retryStartup() {
  startupAttempt += 1
  mapInstanceKey.value += 1
  mapReadyForPlay.value = false
  startupSystemsReady.value = false
  startupError.value = null
  startupMessage.value = 'Nouvelle tentative de préparation…'
  startupProgress.value = 4
  void prepareStartupSystems(startupAttempt)
}

function abortStartup() {
  game.returnHome()
}

function openWiki(articleId?: string | null) {
  if (!userSettings.value.wikiEnabled) return
  clock.pause()
  menuOpen.value = false
  help.openWiki(articleId ?? null)
}

function startOrResumeTutorial() {
  clock.pause()
  const freshStart = !help.tutorial.value.startedAt || help.tutorial.value.completed
  menuOpen.value = false
  if (freshStart) {
    panelOpen.value = false
    bilanOpen.value = false
    selection.clear()
  }
  help.startTutorial(simulation.day.value, network.lines.value.length)
}


function activeDialogElement() {
  const dialogs = gameShellRef.value?.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? []
  return Array.from(dialogs).filter(dialog => dialog.offsetParent !== null).at(-1) ?? null
}

function focusableDialogElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(element => element.offsetParent !== null)
}

function handleAccessibilityKeydown(event: KeyboardEvent) {
  const dialog = activeDialogElement()
  if (event.key === 'Tab' && dialog) {
    const focusables = focusableDialogElements(dialog)
    if (!focusables.length) { event.preventDefault(); dialog.focus(); return }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    return
  }
  if (event.key !== 'Escape') return
  if (challengeResultOpen.value) { challengeResultOpen.value = false; event.preventDefault(); return }
  if (help.wikiOpen.value) { help.closeWiki(); event.preventDefault(); return }
  if (settingsOpen.value) { settingsOpen.value = false; event.preventDefault(); return }
  if (bilanOpen.value) { bilanOpen.value = false; event.preventDefault(); return }
  if (actionDialog.value) { actionDialog.value = null; event.preventDefault(); return }
  if (launchConfigOpen.value) { launchConfigOpen.value = false; event.preventDefault(); return }
  if (network.pendingStationNaming.value) { cancelStationName(); event.preventDefault(); return }
  if (creationOpen.value) { creationOpen.value = false; event.preventDefault(); return }
  if (menuOpen.value) { menuOpen.value = false; event.preventDefault() }
}

const modalSignals = computed(() => [
  creationOpen.value,
  Boolean(network.pendingStationNaming.value),
  Boolean(actionDialog.value),
  launchConfigOpen.value,
  economy.insolvencyStatus.value === 'BANKRUPT' && !challenge.isChallenge.value,
  bilanOpen.value,
  menuOpen.value,
  help.wikiOpen.value && userSettings.value.wikiEnabled,
  challengeResultOpen.value && Boolean(challenge.result.value),
  settingsOpen.value,
])

watch(modalSignals, async (current: boolean[], previous: boolean[] | undefined) => {
  const hasModal = current.some(Boolean)
  const hadModal = previous?.some(Boolean) ?? false
  if (hasModal && !hadModal) dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (hasModal) {
    await nextTick()
    const dialog = activeDialogElement()
    const target = dialog ? (focusableDialogElements(dialog)[0] ?? dialog) : null
    if (target instanceof HTMLElement) {
      if (!target.hasAttribute('tabindex') && target === dialog) target.tabIndex = -1
      target.focus()
    }
  }
  else if (hadModal) {
    await nextTick()
    dialogReturnFocus?.focus()
    dialogReturnFocus = null
  }
})

watch(
  () => challenge.result.value,
  value => { if (value) challengeResultOpen.value = true },
)

watch(
  () => economy.insolvencyStatus.value,
  status => {
    if (status === 'BANKRUPT' && challenge.runtime.value?.status === 'ACTIVE') void challenge.failHard()
  },
)

onMounted(async () => {
  help.initialize()
  clock.resetForEntry()
  clock.start()
  challenge.startClock()
  if (challenge.result.value) challengeResultOpen.value = true
  await installGameMapBridge()
  startupAttempt += 1
  void prepareStartupSystems(startupAttempt)
  syncGameMapOverlay(network.displayLines.value, {
    selectedLineId: selection.selectedLineId.value,
    activeLineId: network.activeLineId.value,
    editingLineId: network.editingLineId.value,
  })
  window.addEventListener('clu-map-line-select', handleBridgeLineSelect as EventListener)
  window.addEventListener('clu-map-station-select', handleBridgeStationSelect as EventListener)
  window.addEventListener('clu-open-network-line', handleOpenNetworkLine as EventListener)
  window.addEventListener('keydown', handleDraftHistoryShortcut)
  window.addEventListener('keydown', handleAccessibilityKeydown)
})

onUnmounted(() => {
  challenge.stopClock()
  clock.stop()
  if (financialPulseTimer) clearTimeout(financialPulseTimer)
  window.removeEventListener('clu-map-line-select', handleBridgeLineSelect as EventListener)
  window.removeEventListener('clu-map-station-select', handleBridgeStationSelect as EventListener)
  window.removeEventListener('clu-open-network-line', handleOpenNetworkLine as EventListener)
  window.removeEventListener('keydown', handleDraftHistoryShortcut)
  window.removeEventListener('keydown', handleAccessibilityKeydown)
  clearGameMapOverlay()
})
</script>

<template>
  <main ref="gameShellRef" class="game-shell">
    <GameMap
      :key="mapInstanceKey"
      :lines="network.displayLines.value"
      :active-line-id="network.activeLineId.value ?? network.editingLineId.value"
      :selected-line-id="selection.selectedLineId.value"
      :selected-station-id="network.editSelectedStationId.value ?? selection.selectedStationId.value"
      :territory-id="game.state.value.save?.territory ?? 'ILE_DE_FRANCE'"
      :generated-territory="game.state.value.save?.data.generatedTerritory ?? null"
      :draft-anchor="mapDraftAnchor"
      :draft-guide-points="network.draftGuidePoints.value"
      :routing-mode="projectLine?.routingMode ?? 'ASSISTED'"
      :building="!challenge.readOnly.value && (network.isBuilding.value || network.isEditing.value)"
      :interchanges="transitRuntime.interchanges.value"
      :vehicles="challenge.readOnly.value || !userSettings.vehicleAnimations || userSettings.reducedMotion ? [] : transitRuntime.vehicles.value"
      :show-vehicle-animations="!challenge.readOnly.value && userSettings.vehicleAnimations && !userSettings.reducedMotion"
      :show-buildings-2d5="userSettings.buildings2D5"
      :graphics-quality="userSettings.graphicsQuality"
      @map-click="handleMapClick"
      @draft-preview="handleDraftPreview"
      @line-click="handleLineClick"
      @station-click="handleStationClick"
      @vehicle-click="handleVehicleClick"
      @loading-progress="handleMapLoadingProgress"
      @ready="handleMapReady"
      @load-error="handleMapLoadError"
    />

    <GameLoadingScreen
      v-if="!gameplayReady || startupError"
      :territory-name="startupTerritoryName"
      :message="startupMessage"
      :progress="startupProgress"
      :error="startupError"
      :reduced-motion="userSettings.reducedMotion"
      @retry="retryStartup"
      @back="abortStartup"
    />

    <RoastToast
      v-if="gameplayReady && currentRoast && (userSettings.cluRoastEnabled || currentRoast.category === 'ASSISTANT')"
      :key="currentRoast.id"
      :entry="currentRoast"
      :reduced-motion="userSettings.reducedMotion"
      @close="currentRoast = null"
    />

    <header class="topbar">
      <div class="brand"><b>CLU</b><span><strong data-i18n-skip>{{ gameName }}</strong><small>{{ gameModeLabel }}</small></span></div>
      <div class="date"><strong>{{ simulation.currentCalendarLabel.value }}</strong><small>Jour {{ simulation.day.value }}</small></div>
      <div v-if="challenge.isChallenge.value" class="challenge-clock" :class="{ ended: challenge.readOnly.value }"><small>{{ challenge.readOnly.value ? 'Défi terminé' : 'Temps restant' }}</small><strong>{{ challenge.readOnly.value ? 'LECTURE SEULE' : challenge.formatTime() }}</strong></div>
      <div class="top-kpis">
        <span class="budget-kpi"><small>Budget</small><strong :class="{ debt: !economy.unlimitedMoney.value && economy.balance.value < 0, 'money-in': financialPulse?.amount > 0, 'money-out': financialPulse?.amount < 0 }">{{ economy.unlimitedMoney.value ? '∞' : money(economy.balance.value) }}</strong><em v-if="financialPulse" :key="financialPulse.id" class="financial-pulse" :class="{ positive: financialPulse.amount > 0, negative: financialPulse.amount < 0 }" role="status" aria-live="polite" :title="financialPulse.reason">{{ financialPulse.amount > 0 ? '+' : '−' }}{{ money(Math.abs(financialPulse.amount)) }}</em></span>
        <span><small>Voyageurs total</small><strong>{{ new Intl.NumberFormat(currentGameLocaleTag(),{notation:'compact',maximumFractionDigits:1}).format(simulation.lastDayReport.value?.passengers ?? 0) }}</strong></span>
        <span class="morale-kpi" :class="moraleUi.tone" :title="moraleUi.label"><small>Moral · {{ moraleUi.label }}</small><strong>{{ moraleUi.emoji }} {{ Math.round(simulation.networkMoraleScore.value) }}/100</strong></span>
      </div>

      <div class="day-action">
        <button class="day-button" type="button" :disabled="Boolean(dayBlockedReason)" :aria-describedby="dayBlockedReason ? 'day-blocked-help' : undefined" @click="advanceDay">Passer au jour suivant</button>
        <div v-if="dayBlockedReason" id="day-blocked-help" class="day-tooltip" role="tooltip">{{ dayBlockedReason }}</div>
      </div>
      <button class="bilan-button" type="button" title="Ouvrir le bilan complet de la partie" aria-haspopup="dialog" @click="bilanOpen = true"><b>▥</b><span>Bilan</span></button>
      <button class="menu-button" type="button" aria-label="Ouvrir le menu de pause" aria-haspopup="dialog" @click="openPauseMenu">☰</button>
    </header>

    <section v-if="!challenge.readOnly.value && (network.activeLine.value || network.editDraft.value)" class="project-dock" :class="{ warning: !projectValidation.ok || previewBudgetExceeded, 'with-panel': panelOpen && !network.isEditing.value, 'edit-focus': network.isEditing.value }">
      <div class="project-copy">
        <span class="project-kicker">{{ network.activeLine.value ? 'Conception de la ligne' : 'Modification du tracé' }}</span>
        <strong data-i18n-skip>{{ network.activeLine.value?.name ?? network.editDraft.value?.name }}</strong>
        <small>{{ projectInstruction }}</small>
      </div>
      <div class="project-stats">
        <span><small>Stations</small><b>{{ projectLine ? getLineAllStations(projectLine).length : 0 }}</b></span>
        <span v-if="draftPreviewMetrics" class="project-preview-stat"><small>Longueur</small><b>{{ Math.max(0, draftPreviewMetrics.deltaLengthKm).toFixed(1) }} km</b></span>
        <span :class="{ 'project-preview-stat': draftPreviewMetrics }"><small>Longueur totale</small><b>{{ displayedProjectLength.toFixed(1) }} km</b></span>
        <span v-if="draftPreviewMetrics" class="project-preview-stat" :class="{ 'project-preview-over': previewBudgetExceeded }"><small>Prix</small><b>{{ money(Math.max(0, draftPreviewMetrics.deltaCost)) }}</b></span>
        <span :class="{ 'project-preview-stat': draftPreviewMetrics, 'project-preview-over': previewBudgetExceeded }"><small>Prix total</small><b>{{ money(displayedProjectCost) }}</b><em v-if="previewBudgetExceeded">Manque {{ money(draftPreviewMetrics?.shortfall ?? 0) }}</em></span>
        <span v-if="!projectValidation.ok" class="project-warning"><small>État</small><b>Action requise</b></span>
      </div>
      <div v-if="network.editDraft.value && network.editSelectedStation.value" class="project-edit-actions">
        <span class="selected-edit-station"><small>Arrêt sélectionné</small><b data-i18n-skip>{{ network.editSelectedStation.value.name }}</b></span>
        <button type="button" @click="network.requestContinueFromStation(network.editSelectedStation.value.id)">Tracer depuis ici</button>
        <button type="button" @click="network.requestMoveStation(network.editSelectedStation.value.id)">Déplacer</button>
        <button type="button" class="danger-edit" :disabled="!network.canRemoveDraftStation(network.editSelectedStation.value.id)" @click="network.removeDraftStation(network.editSelectedStation.value.id)">Retirer</button>
      </div>
      <div v-if="network.editDraft.value" class="project-trace-actions"><button type="button" :class="{ active: network.mapAction.value.kind === 'INSERT_ON_TRACE' }" @click="network.requestInsertOnTrace()">＋ Ajouter un arrêt dans le tracé actuel</button></div>
      <div class="project-routing-actions">
        <span><small>Tracé</small><b>{{ (projectLine?.routingMode ?? 'ASSISTED') === 'ASSISTED' ? 'Libre avec aide légère' : 'Libre' }}</b></span>
        <button type="button" :class="{ active: (projectLine?.routingMode ?? 'ASSISTED') === 'ASSISTED' }" :aria-pressed="(projectLine?.routingMode ?? 'ASSISTED') === 'ASSISTED'" title="Suit les routes, voies et corridors quand c’est pertinent" @click="network.setDraftRoutingMode('ASSISTED')">Libre avec aide légère</button>
        <button type="button" :class="{ active: projectLine?.routingMode === 'FREE' }" :aria-pressed="projectLine?.routingMode === 'FREE'" title="Relie librement vos points sans aimantation aux infrastructures" @click="network.setDraftRoutingMode('FREE')">Libre</button>
      </div>
      <div class="project-buttons">
        <div class="project-history-actions" aria-label="Historique du tracé">
          <button type="button" :disabled="!network.canUndoDraft.value" title="Revenir à l’étape précédente · Ctrl+Z" @click="network.undoDraft()">← <span>Avant</span></button>
          <button type="button" :disabled="!network.canRedoDraft.value" title="Revenir à l’étape suivante · Ctrl+Y / Ctrl+Maj+Z" @click="network.redoDraft()"><span>Après</span> →</button>
        </div>
        <button v-if="network.activeLine.value" class="project-primary" type="button" @click="validateActiveProject">Lancer les travaux</button>
        <button v-else class="project-primary" type="button" @click="validateLineEdit">Valider les modifications</button>
        <button v-if="network.activeLine.value" class="project-cancel" type="button" @click="network.cancelActiveLine()">Abandonner le projet</button>
        <button v-else class="project-cancel" type="button" @click="network.cancelLineEdit()">Annuler les modifications</button>
      </div>
    </section>

    <nav v-if="!network.isEditing.value" class="tool-dock" aria-label="Modules de gestion">
      <button type="button" :class="{ active: selectedTool === 'NETWORK' && panelOpen }" :aria-pressed="selectedTool === 'NETWORK' && panelOpen" @click="selectTool('NETWORK')"><b>⌁</b><span>Réseau</span></button>
      <button type="button" :class="{ active: selectedTool === 'MUNICIPALITIES' && panelOpen }" :aria-pressed="selectedTool === 'MUNICIPALITIES' && panelOpen" @click="selectTool('MUNICIPALITIES')"><b>⌂</b><span>Communes</span></button>
      <button type="button" :class="{ active: selectedTool === 'FINANCES' && panelOpen }" :aria-pressed="selectedTool === 'FINANCES' && panelOpen" @click="selectTool('FINANCES')"><b>€</b><span>Finances</span></button>
      <button type="button" :class="{ active: selectedTool === 'EVENTS' && panelOpen }" :aria-pressed="selectedTool === 'EVENTS' && panelOpen" @click="selectTool('EVENTS')"><b>!</b><span>Événements</span><i v-if="info.attentionCount.value">{{ info.attentionCount.value }}</i></button>
      <button type="button" :class="{ active: selectedTool === 'OBJECTIVES' && panelOpen }" :aria-pressed="selectedTool === 'OBJECTIVES' && panelOpen" @click="selectTool('OBJECTIVES')"><b>✓</b><span>Objectifs</span></button>
      <button class="create-line-button" type="button" :disabled="challenge.readOnly.value" @click="openCreation"><b>＋</b><span>{{ challenge.readOnly.value ? 'Lecture seule' : 'Créer' }}</span></button>
      <button class="search-hub-button" type="button" :class="{ active: searchOpen }" :aria-pressed="searchOpen" @click="toggleSearchHub"><b>⌕</b><span>Rechercher</span></button>
    </nav>

    <aside v-if="searchOpen && !network.isEditing.value" class="search-hub" aria-label="Rechercher dans la métropole">
      <div class="search-hub-head"><div><span class="eyebrow">Navigation</span><strong>Rechercher</strong></div><button type="button" aria-label="Fermer" @click="searchOpen = false">×</button></div>
      <section class="search-module">
        <label for="city-search-input">Rechercher une ville</label>
        <div class="search-input-wrap"><span>⌕</span><input id="city-search-input" class="search-field-input" v-model="citySearch" type="search" placeholder="Nom d’une ville" @focus="citySearchFocused = true" @keydown.enter.prevent="searchFirstCity"></div>
        <div v-if="citySuggestions.length" class="search-results">
          <button v-for="municipality in citySuggestions" :key="municipality.code" type="button" @click="focusMunicipality(municipality)"><span><strong data-i18n-skip>{{ municipality.name }}</strong><small>{{ integer(municipality.population) }} hab.</small></span><b>→</b></button>
        </div>
        <small v-else-if="normalizeSearch(citySearch).length >= 2" class="search-empty">Ville non trouvée dans le territoire chargé.</small>
      </section>
      <section class="search-module">
        <label for="station-search-input">Rechercher une station</label>
        <div class="search-input-wrap"><span>⌕</span><input id="station-search-input" class="search-field-input" v-model="stationSearch" type="search" placeholder="Nom d’un arrêt créé"></div>
        <div v-if="stationSuggestions.length" class="search-results station-results">
          <button v-for="result in stationSuggestions" :key="`${result.line.id}-${result.station.id}`" type="button" @click="focusStationSearchResult(result)"><span><strong data-i18n-skip>{{ result.station.name }}</strong><small><i :style="{ background: result.line.color }" />{{ result.line.shortCode }} · <span data-i18n-skip>{{ result.line.name }}</span></small></span><b>◎</b></button>
        </div>
        <small v-else-if="normalizeSearch(stationSearch).length >= 2" class="search-empty">Aucune station créée ne correspond.</small>
      </section>
    </aside>

    <div v-if="clock.entryNotice.value || clock.blockedMessage.value" class="time-notices" aria-live="polite">
      <div v-if="clock.entryNotice.value" class="pause-entry-notice" role="status">Partie en pause — n’oubliez pas de réactiver le temps lorsque vous êtes prêt.</div>
      <div v-if="clock.blockedMessage.value" class="pause-entry-notice pause-entry-notice--warning" role="status">{{ clock.blockedMessage.value }}</div>
    </div>
    <section v-if="!challenge.readOnly.value" class="time-controls" aria-label="Contrôle du temps">
      <button type="button" class="time-toggle" :aria-pressed="clock.playing.value" @click="clock.toggle()">{{ clock.playing.value ? 'Ⅱ Pause' : '▶ Play' }}</button>
      <strong>{{ clock.timeLabel.value }}</strong>
      <div class="speed-tabs" role="group" aria-label="Vitesse du temps">
        <button v-for="value in ([0.5, 1, 2] as const)" :key="value" type="button" :class="{ active: clock.speed.value === value }" @click="clock.setSpeed(value)">{{ value }}×</button>
      </div>
    </section>
    <section v-if="!challenge.readOnly.value" class="day-progress" aria-label="Progression de la journée">
      <span>{{ clock.remainingLabel.value }} avant le prochain jour</span>
      <div><i :style="{ width: `${clock.progress.value * 100}%` }" /></div>
    </section>

    <aside v-if="panelOpen && !network.isEditing.value" class="side-panel" aria-labelledby="game-side-panel-title">
      <div class="panel-top"><span id="game-side-panel-title">{{ toolTitle(selectedTool) }}</span><div class="panel-top-actions"><button v-if="userSettings.wikiEnabled" type="button" title="Aide contextuelle" aria-label="Ouvrir l’aide contextuelle" @click="openWiki(toolWikiArticle)">?</button><button type="button" aria-label="Fermer le panneau" @click="closePanel">×</button></div></div>
      <div class="panel-scroll">
        <NetworkPanel v-if="selectedTool === 'NETWORK'" />
        <MunicipalitiesPanel v-else-if="selectedTool === 'MUNICIPALITIES'" />
        <FinancePanel v-else-if="selectedTool === 'FINANCES'" />
        <EventsInfoPanel v-else-if="selectedTool === 'EVENTS'" />
        <ObjectivesPanel v-else />
      </div>
    </aside>

    <div v-if="creationOpen" class="creation-backdrop" @click.self="creationOpen = false"><section class="creation-modal" role="dialog" aria-modal="true" aria-label="Créer une ligne"><LineCreationPanel @close="creationOpen = false" /></section></div>

    <div v-if="launchConfigOpen && launchConfig && network.activeLine.value" class="launch-config-backdrop">
      <section class="launch-config-dialog" role="dialog" aria-modal="true" aria-labelledby="launch-config-title">
        <div class="launch-config-head">
          <div><span class="eyebrow">Avant les travaux</span><h2 id="launch-config-title">Préparer l’exploitation</h2></div>
          <button type="button" aria-label="Fermer" @click="launchConfigOpen = false">×</button>
        </div>
        <p class="launch-config-intro">Choisissez une préparation recommandée pour démarrer simplement, ou passez en configuration manuelle si vous voulez régler précisément cette ligne avant sa construction.</p>

        <div class="launch-mode-choice">
          <button type="button" :class="{ active: launchConfigurationMode === 'RECOMMENDED' }" @click="applyRecommendedLaunchConfiguration"><strong>Configuration recommandée</strong><small>CLU prépare automatiquement une exploitation saine et équilibrée.</small></button>
          <button type="button" :class="{ active: launchConfigurationMode === 'MANUAL' }" @click="useManualLaunchConfiguration"><strong>Configuration manuelle</strong><small>Réglez vous-même le service, le matériel, la maintenance et le tarif de cette ligne.</small></button>
        </div>

        <div class="launch-config-summary">
          <div><span>Parc minimum conseillé</span><strong>{{ launchRequiredVehicles }} {{ rollingStock.definition(network.activeLine.value.mode).vehicleLabelPlural }}</strong></div>
          <div><span>Parc préparé</span><strong>{{ launchConfig.vehicleCount }}</strong></div>
          <div><span>Coût total du projet</span><strong>{{ money(launchTotalCost) }}</strong></div>
          <div><span>Budget après validation</span><strong :class="{ debt: launchShortfall > 0 }">{{ economy.unlimitedMoney.value ? '∞' : money(economy.balance.value - launchTotalCost) }}</strong></div>
        </div>

        <section v-if="launchConfigurationMode === 'RECOMMENDED'" class="launch-recommended-card">
          <div><span>Service</span><strong>Standard</strong></div>
          <div><span>Matériel roulant</span><strong>{{ launchRecommendedVehicles }} {{ rollingStock.definition(network.activeLine.value.mode).vehicleLabelPlural }}</strong></div>
          <div><span>Régulation</span><strong>Automatique</strong></div>
          <div><span>Maintenance</span><strong>Standard</strong></div>
          <p>Vous pouvez confirmer directement. Ces réglages sont conçus pour éviter qu’une ligne neuve ouvre sans parc ou avec un service immédiatement insuffisant.</p>
        </section>

        <div v-else class="launch-manual-sections">
          <section>
            <h3>Niveau de service</h3>
            <div class="launch-choice-row"><button v-for="level in GAME_SERVICE_LEVELS" :key="level.value" type="button" :class="{ active: launchConfig.serviceLevel === level.value }" :title="level.description" @click="launchConfig.serviceLevel = level.value">{{ level.label }}</button></div>
            <small>{{ GAME_SERVICE_LEVELS.find(item => item.value === launchConfig.serviceLevel)?.description }}</small>
          </section>

          <section>
            <h3>Matériel roulant</h3>
            <div class="launch-fleet-counter"><button type="button" @click="changeLaunchVehicleCount(-1)">−</button><input :value="launchConfig.vehicleCount" type="number" :min="network.activeLine.value.vehicleCount" step="1" inputmode="numeric" @input="updateLaunchVehicleCount"><button type="button" @click="changeLaunchVehicleCount(1)">+</button><button type="button" class="fit" @click="setLaunchVehicleCount(launchRecommendedVehicles)">Parc recommandé</button></div>
            <small>{{ money(rollingStock.definition(network.activeLine.value.mode).purchaseCost) }} par {{ rollingStock.definition(network.activeLine.value.mode).vehicleLabel }} · achat prévu {{ money(launchFleetPurchaseCost) }}</small>
            <p v-if="launchFleetWarning" class="launch-warning">Parc inférieur au minimum conseillé : le service risque d’être incomplet dès l’ouverture.</p>
          </section>

          <section class="launch-upgrades">
            <h3>Amélioration du matériel</h3>
            <div v-for="upgrade in rollingStock.upgradeDefinitions" :key="upgrade.key" class="launch-upgrade-row">
              <div><strong>{{ upgrade.label }}</strong><small>{{ upgrade.shortEffect }}</small></div>
              <div class="launch-level-counter"><button type="button" :disabled="launchConfig.rollingStockUpgrades[upgrade.key] <= network.activeLine.value.rollingStockUpgrades[upgrade.key]" @click="setLaunchUpgrade(upgrade.key, -1)">−</button><b>{{ launchConfig.rollingStockUpgrades[upgrade.key] }}/{{ rollingStock.maxUpgradeLevel }}</b><button type="button" :disabled="launchConfig.rollingStockUpgrades[upgrade.key] >= rollingStock.maxUpgradeLevel" @click="setLaunchUpgrade(upgrade.key, 1)">+</button></div>
            </div>
          </section>

          <section>
            <h3>Régulation</h3>
            <div class="launch-choice-row"><button type="button" :class="{ active: launchConfig.regulationMode === 'AUTO' }" @click="launchConfig.regulationMode = 'AUTO'">Automatique</button><button type="button" :class="{ active: launchConfig.regulationMode === 'MANUAL' }" @click="launchConfig.regulationMode = 'MANUAL'">Manuelle</button></div>
            <small>Automatique est recommandé pour laisser CLU absorber les variations du service sans microgestion.</small>
          </section>

          <section>
            <h3>Maintenance</h3>
            <div class="launch-choice-row"><button v-for="level in GAME_MAINTENANCE_LEVELS" :key="level.value" type="button" :class="{ active: launchConfig.maintenanceLevel === level.value }" :title="level.description" @click="launchConfig.maintenanceLevel = level.value">{{ level.label }}</button></div>
            <small>{{ GAME_MAINTENANCE_LEVELS.find(item => item.value === launchConfig.maintenanceLevel)?.description }}</small>
          </section>

          <section class="launch-line-fare">
            <h3>Tarification spécifique pour cette ligne</h3>
            <label class="launch-fare-toggle"><input v-model="launchConfig.specificFareEnabled" type="checkbox"><span><strong>Utiliser un prix propre à cette ligne</strong><small>Sinon la ligne suit automatiquement la tarification générale du réseau.</small></span></label>
            <label v-if="launchConfig.specificFareEnabled" class="launch-fare-price">Billet de cette ligne (€)<input v-model.number="launchConfig.specificTicketPrice" type="number" min="0" step="0.1"></label>
            <small v-if="launchConfig.specificFareEnabled">Cette exception ne modifie pas les prix des autres lignes, même si le réseau utilise un prix unifié.</small>
          </section>
        </div>

        <div class="launch-cost-breakdown"><span>Travaux <b>{{ money(launchProjectCost) }}</b></span><span>Matériel <b>{{ money(launchFleetPurchaseCost) }}</b></span><span>Améliorations <b>{{ money(launchUpgradeCost) }}</b></span><span class="total">Total <b>{{ money(launchTotalCost) }}</b></span></div>
        <p v-if="launchShortfall > 0" class="launch-warning">Financement insuffisant : il manque {{ money(launchShortfall) }}.</p>

        <div class="launch-config-footer"><button type="button" @click="launchConfigOpen = false">Retour au tracé</button><button class="primary" type="button" :disabled="launchShortfall > 0" @click="confirmConfiguredProject">{{ launchFleetWarning ? 'Lancer malgré le parc insuffisant' : 'Confirmer et lancer les travaux' }}</button></div>
      </section>
    </div>

    <StationInspector v-if="!network.isEditing.value" />
    <VehicleInspector v-if="!network.isEditing.value" :vehicle="selectedVehicle" @close="selectedVehicle = null" />

    <div v-if="network.pendingStationNaming.value" class="station-name-backdrop" @click.self="cancelStationName">
      <section class="station-name-dialog" role="dialog" aria-modal="true" aria-labelledby="station-name-title">
        <span class="eyebrow">Nouvelle station</span>
        <h3 id="station-name-title">Nom de l’arrêt</h3>
        <p v-if="network.pendingStationNaming.value.outsideLoadedTerritory" class="outside-territory"><strong>Hors territoire chargé.</strong> CLU ne dispose pas ici du nom communal local. Choisissez librement le nom de l’arrêt.</p>
        <p v-else>CLU propose le nom de la commune. Modifiez-le maintenant si vous préférez un nom de gare, de quartier ou de lieu.</p>
        <input v-model="stationNameDraft" maxlength="60" autofocus @keyup.enter="confirmStationName" @keyup.esc="cancelStationName">
        <div class="station-name-actions"><button class="cancel" type="button" @click="cancelStationName">Annuler</button><button class="confirm" type="button" @click="confirmStationName">Confirmer et continuer</button></div>
      </section>
    </div>

    <div v-if="actionDialog" class="action-backdrop" @click.self="actionDialog = null">
      <section class="action-dialog" :class="{ 'contract-dialog': actionDialog.variant === 'CONSTRUCTION_SIGNED' }" role="alertdialog" aria-modal="true" aria-labelledby="action-dialog-title">
        <template v-if="actionDialog.variant === 'CONSTRUCTION_SIGNED'">
          <span class="contract-kicker">Félicitations</span>
          <h3 id="action-dialog-title">Projet validé</h3>
          <p>{{ actionDialog.message }}</p>
          <div class="contract-line" />
          <div class="contract-signature"><small>CLU Métropole</small><strong>Projet approuvé</strong><i>✓</i></div>
          <div class="contract-actions"><button type="button" @click="actionDialog = null">Fermer</button><button class="finance-action" type="button" @click="advanceToOpening">Passer directement au jour de l’ouverture</button></div>
        </template>
        <template v-else>
          <span class="eyebrow">CLU Métropole</span>
          <h3 id="action-dialog-title">{{ actionDialog.title }}</h3>
          <p>{{ actionDialog.message }}</p>
          <div class="dialog-actions"><button v-if="actionDialog.finance" class="finance-action" type="button" @click="openFinances">Ouvrir Finances</button><button type="button" @click="actionDialog = null">Fermer</button></div>
        </template>
      </section>
    </div>

    <div v-if="economy.insolvencyStatus.value === 'BANKRUPT' && !challenge.isChallenge.value" class="bankruptcy-backdrop">
      <section class="bankruptcy-card" role="alertdialog" aria-modal="true" aria-labelledby="bankruptcy-title">
        <span class="eyebrow">Fin de partie</span><h2 id="bankruptcy-title">Réseau en faillite</h2>
        <p>Après plusieurs échéances non respectées, la dette dépasse désormais ce que le réseau peut raisonnablement financer. Les nouveaux investissements et le passage des jours sont bloqués.</p>
        <div><button type="button" @click="openPauseMenu">Ouvrir le menu</button><button type="button" @click="saveAndQuit">Sauvegarder et quitter</button></div>
      </section>
    </div>

    <div v-if="bilanOpen" class="bilan-backdrop" @click.self="bilanOpen = false">
      <BilanPanel @close="bilanOpen = false" />
    </div>

    <div v-if="menuOpen" class="menu-backdrop" @click.self="menuOpen = false">
      <section class="pause-menu" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="pause-hero"><span class="eyebrow" data-i18n-skip>{{ gameName }}</span><h2 id="pause-title">{{ challenge.readOnly.value ? 'Archive en lecture seule' : 'Partie en pause' }}</h2><p>{{ simulation.currentCalendarLabel.value }} · Jour {{ simulation.day.value }}</p><div class="pause-rules"><span>{{ freePlaySettings?.cheatUnlimitedMoney ? '⚡ Triche' : 'Économie ' + (freePlaySettings?.economyProfile === 'GENEROUS' ? 'généreuse' : freePlaySettings?.economyProfile === 'HARD' ? 'exigeante' : 'standard') }}</span><span>Événements {{ freePlaySettings?.eventFrequency === 'CALM' ? 'calmes' : freePlaySettings?.eventFrequency === 'FREQUENT' ? 'fréquents' : 'standard' }}</span><span>{{ freePlaySettings?.objectivesEnabled === false ? 'Objectifs désactivés' : 'Objectifs actifs' }}</span></div></div>
        <button class="resume" type="button" @click="menuOpen = false"><b>▶</b><span><strong>{{ challenge.readOnly.value ? 'Consulter' : 'Reprendre' }}</strong><small>Retourner immédiatement au réseau</small></span></button>
        <button v-if="challenge.runtime.value?.status === 'ACTIVE'" type="button" @click="finishChallengeNow"><b>■</b><span><strong>Terminer le défi</strong><small>Figer immédiatement le résultat et passer en lecture seule</small></span></button>
        <button v-if="challenge.result.value" type="button" @click="challengeResultOpen = true; menuOpen = false"><b>◆</b><span><strong>Résultat du défi</strong><small>Score, objectifs et code de comparaison</small></span></button>
        <button type="button" @click="startOrResumeTutorial"><b>◉</b><span><strong>{{ help.tutorial.value.completed ? 'Revoir le tutoriel' : 'Voir le tutoriel' }}</strong><small>Coach interactif basé sur vos vraies actions</small></span></button>
        <button v-if="userSettings.wikiEnabled" type="button" @click="openWiki(null)"><b>?</b><span><strong>Wiki</strong><small>Comprendre les systèmes sans quitter la partie</small></span></button>
        <button type="button" @click="openSettings"><b>⚙</b><span><strong>Paramètres</strong><small>Apparence, graphismes, aide et confort</small></span></button>
        <button type="button" :disabled="isSaving || challenge.readOnly.value" @click="saveGame"><b>◆</b><span><strong>{{ isSaving ? 'Sauvegarde…' : 'Sauvegarder' }}</strong><small>{{ challenge.readOnly.value ? 'L’état du défi est figé' : 'Conserver l’état actuel de la métropole' }}</small></span></button>
        <button type="button" :disabled="isSaving" @click="saveAndQuit"><b>↩</b><span><strong>Sauvegarder et quitter</strong><small>Retourner au menu principal CLU</small></span></button>
      </section>
    </div>


    <TutorialCoach
      v-if="gameplayReady && help.tutorialActive.value"
      :selected-tool="selectedTool"
      :panel-open="panelOpen"
      :line-count="network.lines.value.length"
      :has-launched-line="network.lines.value.some(line => line.status !== 'PROJECT')"
      :selected-line="Boolean(selection.selectedLineId.value)"
      :selected-station="Boolean(selection.selectedStationId.value)"
      :bilan-open="bilanOpen"
      :day="simulation.day.value"
      @wiki="openWiki"
    />

    <div v-if="help.wikiOpen.value && userSettings.wikiEnabled" class="help-backdrop" @click.self="help.closeWiki()">
      <HelpCenter :article-id="help.wikiArticleId.value" @close="help.closeWiki()" />
    </div>

    <div v-if="challengeResultOpen && challenge.result.value" class="challenge-result-backdrop" @click.self="challengeResultOpen = false">
      <ChallengeResultDialog @close="challengeResultOpen = false" />
    </div>

    <div v-if="settingsOpen" class="menu-backdrop" @click.self="settingsOpen = false">
      <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
        <header class="settings-dialog__header">
          <div><span class="eyebrow">CLU Métropole</span><h2 id="settings-dialog-title">Paramètres</h2></div>
          <button type="button" aria-label="Fermer" @click="settingsOpen = false">×</button>
        </header>
        <div class="settings-dialog__scroll"><GameSettingsPanel /></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.launch-config-backdrop{position:absolute;inset:0;z-index:59;background:rgba(0,0,0,.56);backdrop-filter:blur(9px);display:grid;place-items:center;padding:16px}.launch-config-dialog{width:min(900px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#0f181e;box-shadow:0 28px 90px rgba(0,0,0,.52);display:grid;gap:15px}.launch-config-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.launch-config-head h2{margin:2px 0 0;font-size:22px}.launch-config-head>button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.05);color:inherit;font-size:21px;cursor:pointer}.launch-config-intro{margin:0;font-size:11px;line-height:1.55;opacity:.68}.launch-config-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.launch-config-summary>div{padding:10px;border-radius:10px;background:rgba(255,255,255,.04);display:grid;gap:2px}.launch-config-summary span{font-size:9px;opacity:.52}.launch-config-summary strong{font-size:12px}.launch-config-actions-top{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(79,211,220,.15);border-radius:11px;background:rgba(79,211,220,.055)}.launch-config-actions-top .recommended{border:1px solid rgba(79,211,220,.38);background:rgba(79,211,220,.15);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}.launch-config-actions-top small{font-size:9px;line-height:1.4;opacity:.58}.launch-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.launch-config-grid>section{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);display:grid;gap:9px}.launch-config-grid h3{margin:0;font-size:12px}.launch-advanced{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.018)}.launch-advanced>summary{cursor:pointer;padding:12px 0;font-size:11px;font-weight:800}.launch-advanced[open]>summary{margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,.07)}.launch-config-grid--advanced{padding-bottom:12px}.launch-config-grid small{font-size:9px;line-height:1.45;opacity:.58}.launch-upgrades{grid-row:span 2}.launch-choice-row{display:flex;gap:6px;flex-wrap:wrap}.launch-choice-row button,.launch-fleet-counter button,.launch-level-counter button,.launch-config-footer button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:7px 9px;cursor:pointer}.launch-choice-row button.active{border-color:rgba(79,211,220,.45);background:rgba(79,211,220,.16)}.launch-fleet-counter{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.launch-fleet-counter input{width:76px;padding:7px;text-align:center;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#121c23;color:inherit}.launch-fleet-counter .fit{margin-left:4px}.launch-upgrade-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:8px;border-radius:9px;background:rgba(255,255,255,.03)}.launch-upgrade-row>div:first-child{display:grid;gap:2px}.launch-level-counter{display:flex;align-items:center;gap:6px}.launch-level-counter b{min-width:34px;text-align:center;font-size:10px}.launch-level-counter button:disabled{opacity:.35;cursor:not-allowed}.launch-warning{margin:0;padding:8px 10px;border:1px solid rgba(241,171,71,.22);border-radius:9px;background:rgba(190,116,31,.08);color:#f2c579;font-size:10px;line-height:1.45}.launch-cost-breakdown{display:flex;gap:8px;flex-wrap:wrap}.launch-cost-breakdown span{padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.04);font-size:9px;display:flex;gap:8px}.launch-cost-breakdown .total{margin-left:auto;border:1px solid rgba(79,211,220,.16);background:rgba(79,211,220,.055)}.launch-config-footer{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}.launch-config-footer .primary{background:rgba(79,211,220,.17);border-color:rgba(79,211,220,.42)}.launch-config-footer button:disabled{opacity:.4;cursor:not-allowed}@media(max-width:760px){.launch-config-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.launch-config-grid{grid-template-columns:1fr}.launch-upgrades{grid-row:auto}.launch-config-actions-top{align-items:flex-start;flex-direction:column}.launch-config-footer{flex-direction:column-reverse}.launch-config-footer button{width:100%}}
.budget-kpi{position:relative}.financial-pulse{position:absolute;z-index:6;left:50%;top:100%;transform:translate(-50%,5px);padding:3px 7px;border-radius:7px;font-style:normal;font-size:14px;line-height:1.15;font-weight:950;letter-spacing:.01em;white-space:nowrap;background:rgba(8,14,19,.92);border:1px solid currentColor;box-shadow:0 5px 18px rgba(0,0,0,.34);animation:money-pulse 2s ease forwards;pointer-events:none}.financial-pulse.positive{color:#62f09b}.financial-pulse.negative{color:#ff6f79}.time-controls{position:absolute;z-index:22;left:18px;bottom:18px;display:flex;align-items:center;gap:7px;padding:7px 8px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(8,14,19,.82);backdrop-filter:blur(16px)}.time-controls button{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.05);color:inherit;padding:6px 8px;cursor:pointer}.time-controls strong{min-width:40px;font-size:11px;font-variant-numeric:tabular-nums}.speed-tabs{display:flex;gap:3px}.speed-tabs button{padding:5px 6px;font-size:8px}.speed-tabs button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.16);color:#a8f5f8}.day-progress{position:absolute;z-index:21;left:50%;bottom:18px;transform:translateX(-50%);width:min(420px,42vw);display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(8,14,19,.72);backdrop-filter:blur(14px)}.day-progress span{font-size:8px;opacity:.65;white-space:nowrap}.day-progress>div{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.day-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4fd3dc,#9cecf0);transition:width .2s linear}.time-notices{position:absolute;z-index:40;left:18px;bottom:76px;width:min(390px,calc(100vw - 36px));display:grid;gap:6px;pointer-events:none}.pause-entry-notice{padding:8px 11px;border:1px solid rgba(79,211,220,.22);border-radius:10px;background:rgba(11,31,36,.94);font-size:10px;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.25)}.pause-entry-notice--warning{border-color:rgba(239,184,75,.3);color:#f2cf80}.project-trace-actions{display:flex;align-items:center}.project-trace-actions button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.16)}@keyframes money-pulse{0%{opacity:0;transform:translate(-50%,10px) scale(.88)}10%{opacity:1;transform:translate(-50%,4px) scale(1.08)}22%{transform:translate(-50%,2px) scale(1)}78%{opacity:1;transform:translate(-50%,-2px) scale(1)}100%{opacity:0;transform:translate(-50%,-18px) scale(1.03)}}
.help-backdrop{position:absolute;inset:0;z-index:78;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.game-shell{position:fixed;inset:0;z-index:9999;width:100%;height:100%;min-height:100vh;overflow:hidden;background:#091015;color:#edf6f7;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:dark}.challenge-result-backdrop{position:absolute;inset:0;z-index:75;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.challenge-clock{display:grid;gap:1px;min-width:92px;padding:5px 8px;border:1px solid rgba(242,193,64,.25);border-radius:9px;background:rgba(105,76,13,.13);color:#ffe18a}.challenge-clock small{font-size:7px;text-transform:uppercase;letter-spacing:.08em;opacity:.6}.challenge-clock strong{font-size:11px;font-variant-numeric:tabular-nums}.challenge-clock.ended{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#bfc9cc}.topbar{position:absolute;z-index:30;left:16px;right:16px;top:14px;min-height:64px;padding:9px 11px 9px 14px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(8,14,19,.82);backdrop-filter:blur(18px);display:flex;align-items:center;gap:14px;box-shadow:0 12px 40px rgba(0,0,0,.24)}.brand{display:flex;align-items:center;gap:10px;min-width:170px}.brand>b{font-size:18px;letter-spacing:.1em}.brand span,.date,.top-kpis span{display:grid}.brand small,.date small,.top-kpis small{font-size:9px;opacity:.48;margin-top:2px}.date{flex:1;min-width:175px}.date strong{font-size:13px}.top-kpis{display:flex;gap:13px}.top-kpis strong{font-size:12px}.debt{color:#ff9c9c}.day-action{position:relative;display:flex}.day-button,.bilan-button,.menu-button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:inherit;border-radius:11px;padding:9px 12px;cursor:pointer}.day-button{background:rgba(77,211,220,.16);border-color:rgba(77,211,220,.32);white-space:nowrap}.bilan-button{display:flex;align-items:center;gap:6px;white-space:nowrap}.bilan-button b{font-size:13px}.bilan-button span{font-size:10px;font-weight:700}.day-button:disabled{opacity:.4;cursor:not-allowed}.day-tooltip{position:absolute;right:0;top:46px;width:290px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#10191f;color:#edf6f7;font-size:10px;line-height:1.45;box-shadow:0 14px 34px rgba(0,0,0,.42);opacity:0;pointer-events:none;transform:translateY(-3px);transition:opacity .15s ease,transform .15s ease;z-index:80}.day-action:hover .day-tooltip,.day-action:focus-within .day-tooltip{opacity:1;transform:translateY(0)}.menu-button{font-size:17px}.city-search{position:relative;width:210px;flex:none}.city-search>input{width:100%;height:38px;padding:0 12px 0 32px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:#101a20;color:#edf6f7;outline:none}.city-search>input:focus{border-color:rgba(79,211,220,.52);box-shadow:0 0 0 3px rgba(79,211,220,.08)}.search-icon{position:absolute;left:11px;top:8px;font-size:16px;opacity:.55;z-index:2}.city-suggestions{position:absolute;left:0;right:0;top:44px;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0e171d;box-shadow:0 18px 50px rgba(0,0,0,.48);display:grid;gap:3px}.city-suggestions button{border:0;background:transparent;color:inherit;border-radius:8px;padding:8px 9px;text-align:left;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.city-suggestions button:hover{background:rgba(79,211,220,.1)}.city-suggestions span{display:grid}.city-suggestions small{font-size:9px;opacity:.48;margin-top:2px}.city-search-empty{position:absolute;left:0;right:0;top:44px;padding:10px 11px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:#0e171d;box-shadow:0 18px 50px rgba(0,0,0,.42);font-size:10px;line-height:1.4;color:#b7c1c7}.project-dock{position:absolute;z-index:26;top:91px;left:50%;transform:translateX(-50%);width:min(1180px,calc(100vw - 210px));min-height:96px;padding:10px 12px;border:1px solid rgba(79,211,220,.28);border-radius:15px;background:rgba(7,14,19,.91);backdrop-filter:blur(18px);box-shadow:0 16px 45px rgba(0,0,0,.34);display:grid;grid-template-columns:minmax(200px,1fr) auto;grid-template-areas:'copy stats' 'routing buttons';align-items:center;gap:8px 13px}.project-dock.with-panel{left:575px;right:18px;width:auto;transform:none}.project-dock.edit-focus{left:16px;right:16px;width:auto;transform:none;grid-template-columns:minmax(190px,1fr) minmax(360px,auto);grid-template-areas:'copy stats' 'edit edit' 'routing buttons'}.project-dock.edit-focus .project-stats{display:grid;grid-template-columns:repeat(5,minmax(76px,1fr));min-width:0}.project-dock.edit-focus .project-stats span{min-width:0}.project-dock.edit-focus .project-copy{min-width:0}.project-dock.warning{border-color:rgba(242,179,80,.46)}.project-copy{grid-area:copy;display:grid;gap:2px;min-width:190px}.project-copy strong{font-size:13px}.project-copy small{font-size:10px;opacity:.58;line-height:1.35}.project-kicker{font-size:8px;text-transform:uppercase;letter-spacing:.13em;color:#75dbe2}.project-stats{grid-area:stats;display:flex;gap:7px;min-width:0}.project-stats span{min-width:92px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.045);display:grid;gap:1px}.project-stats small{font-size:8px;opacity:.48}.project-stats b{font-size:11px}.project-stats em{font-size:8px;font-style:normal;color:#83dfe5;margin-top:1px}.project-preview-stat{box-shadow:inset 0 0 0 1px rgba(79,211,220,.16);background:rgba(79,211,220,.065)!important}.project-preview-over{box-shadow:inset 0 0 0 1px rgba(255,121,121,.32);background:rgba(176,55,55,.1)!important}.project-preview-over b,.project-preview-over em{color:#ff9d9d!important}.project-warning b{color:#f0bd68}.project-edit-actions,.project-routing-actions,.project-buttons{display:flex;gap:6px;align-items:center;min-width:0}.project-routing-actions{grid-area:routing}.project-buttons{grid-area:buttons;justify-content:flex-end;flex-wrap:wrap}.project-edit-actions{grid-area:edit}.project-routing-actions{padding:4px 6px;border-radius:10px;background:rgba(6,13,18,.38);border:1px solid rgba(255,255,255,.06)}.project-routing-actions>span{display:grid;min-width:54px}.project-routing-actions small{font-size:7px;opacity:.45}.project-routing-actions b{font-size:9px}.project-routing-actions button{padding:7px 8px!important;font-size:9px}.project-routing-actions button.active{background:rgba(79,211,220,.16)!important;border-color:rgba(79,211,220,.38)!important;color:#a9f7fb}.project-edit-actions{min-width:0}.selected-edit-station{display:grid;min-width:140px;max-width:220px;padding:6px 9px;border-radius:9px;background:rgba(79,211,220,.08);border:1px solid rgba(79,211,220,.14)}.selected-edit-station small{font-size:8px;opacity:.5}.selected-edit-station b{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.danger-edit{color:#ff9d9d!important}.project-dock button:disabled{opacity:.36;cursor:not-allowed}.project-dock button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}.project-primary{background:rgba(79,211,220,.17)!important;border-color:rgba(79,211,220,.42)!important}.project-cancel{color:#ff9d9d!important}.project-history-actions{display:flex;gap:4px;padding-right:3px;border-right:1px solid rgba(255,255,255,.08)}.project-history-actions button{padding:8px 9px}.project-history-actions span{display:none;font-size:9px}.bilan-backdrop{position:absolute;inset:0;z-index:64;background:rgba(0,0,0,.5);backdrop-filter:blur(9px);display:grid;place-items:center}.tool-dock{position:absolute;z-index:20;left:18px;top:94px;display:grid;gap:6px;padding:7px;border-radius:15px;border:1px solid rgba(255,255,255,.09);background:rgba(8,14,19,.76);backdrop-filter:blur(16px)}.tool-dock button{position:relative;width:56px;min-height:49px;border:0;border-radius:10px;background:transparent;color:inherit;display:grid;place-items:center;gap:1px;cursor:pointer}.tool-dock button.active{background:rgba(255,255,255,.10)}.tool-dock b{font-size:16px}.tool-dock span{font-size:8px;opacity:.6}.tool-dock i{position:absolute;right:3px;top:3px;min-width:15px;height:15px;padding:0 3px;border-radius:99px;background:#f5b45f;color:#111;font:700 9px/15px sans-serif}.side-panel{position:absolute;z-index:17;left:87px;top:94px;bottom:18px;width:min(470px,calc(100vw - 120px));border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(8,14,19,.86);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.28);overflow:hidden}.panel-top{height:38px;padding:0 12px 0 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.65}.panel-top-actions{display:flex;align-items:center;gap:8px;padding-left:6px}.panel-top button{width:28px;height:28px;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;display:grid;place-items:center}.panel-top-actions button:first-child{border:1px solid rgba(79,211,220,.14);border-radius:8px;color:#9cecf0;font-size:12px;font-weight:800}.panel-top-actions button:last-child{opacity:.78}.panel-scroll{height:calc(100% - 38px);overflow:auto;padding:18px;scrollbar-width:thin}.menu-backdrop,.action-backdrop{position:absolute;inset:0;z-index:60;background:rgba(0,0,0,.44);backdrop-filter:blur(8px);display:grid;place-items:center}.pause-menu{width:min(390px,calc(100vw - 40px));animation:pause-in .18s ease-out;padding:22px;border-radius:20px;background:#10181e;border:1px solid rgba(255,255,255,.12);display:grid;gap:9px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.pause-menu h2{margin:2px 0 0}.pause-hero p{margin:5px 0 8px;font-size:11px;opacity:.55}.pause-rules{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 10px}.pause-rules span{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.05);font-size:9px;color:rgba(255,255,255,.62)}.pause-menu button{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:11px;transition:transform .16s ease,background .16s ease,border-color .16s ease}.pause-menu button:hover{transform:translateY(-1px);background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.18)}.pause-menu button span{display:grid;gap:2px}.pause-menu button small{opacity:.5}.pause-menu button.resume{background:rgba(69,211,219,.14);border-color:rgba(69,211,219,.35)}.settings-dialog{width:min(820px,calc(100vw - 40px));max-height:min(760px,calc(100vh - 40px));display:grid;grid-template-rows:auto minmax(0,1fr);border-radius:20px;background:#10181e;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}.settings-dialog__header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.08)}.settings-dialog__header h2{margin:2px 0 0;font-size:20px}.settings-dialog__header button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.05);color:inherit;font-size:21px;cursor:pointer}.settings-dialog__scroll{min-height:0;overflow:auto;padding:18px;scrollbar-width:thin}.action-dialog{width:min(430px,calc(100vw - 38px));padding:22px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:#10191f;box-shadow:0 24px 80px rgba(0,0,0,.5)}.action-dialog h3{margin:5px 0 7px}.action-dialog p{margin:0;font-size:12px;line-height:1.6;opacity:.72}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.dialog-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer}.dialog-actions .finance-action{background:rgba(79,211,220,.16);border-color:rgba(79,211,220,.38)}.station-name-backdrop{position:absolute;inset:0;z-index:57;background:rgba(0,0,0,.38);backdrop-filter:blur(5px);display:grid;place-items:center}.station-name-dialog{width:min(420px,calc(100vw - 38px));padding:20px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:#0f181e;box-shadow:0 24px 70px rgba(0,0,0,.48)}.station-name-dialog h3{margin:6px 0}.station-name-dialog p{font-size:11px;line-height:1.55;opacity:.62}.station-name-dialog input{width:100%;box-sizing:border-box;margin:8px 0 10px;padding:10px 11px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#142027;color:inherit;outline:none}.station-name-actions{display:grid;grid-template-columns:auto 1fr;gap:8px}.station-name-dialog button{padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.station-name-dialog .confirm{border-color:rgba(79,211,220,.38);background:rgba(79,211,220,.16)}.station-name-dialog .cancel{color:#ffc0c0}.outside-territory{padding:9px 10px;border-radius:9px;background:rgba(238,172,70,.08);border:1px solid rgba(238,172,70,.16)}.outside-territory strong{color:#f1bd6e}.bankruptcy-backdrop{position:absolute;inset:0;z-index:58;background:rgba(20,4,7,.65);backdrop-filter:blur(9px);display:grid;place-items:center}.bankruptcy-card{width:min(470px,calc(100vw - 40px));padding:24px;border:1px solid rgba(255,105,105,.28);border-radius:20px;background:#171014;box-shadow:0 28px 90px rgba(0,0,0,.55)}.bankruptcy-card h2{margin:4px 0 8px;color:#ff9393}.bankruptcy-card p{font-size:12px;line-height:1.6;opacity:.72}.bankruptcy-card>div{display:flex;gap:8px;margin-top:16px}.bankruptcy-card button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}.creation-backdrop{position:absolute;inset:0;z-index:55;background:rgba(0,0,0,.36);backdrop-filter:blur(7px);display:grid;place-items:center}.creation-modal{width:min(540px,calc(100vw - 36px));max-height:calc(100vh - 30px);padding:18px;border-radius:20px;background:#0f181e;border:1px solid rgba(255,255,255,.12);box-shadow:0 28px 90px rgba(0,0,0,.5);overflow:hidden}.create-line-button{margin-top:3px;border-top:1px solid rgba(255,255,255,.07)!important}.create-line-button b{font-size:22px!important;color:#7ce6ec}.morale-kpi{padding:4px 7px;border-radius:8px}.morale-very-happy{background:rgba(26,112,69,.22);color:#6ce7a3}.morale-happy{background:rgba(66,129,75,.12);color:#9ee8b5}.morale-medium{background:rgba(173,143,46,.11);color:#f2d36d}.morale-tense{background:rgba(168,98,37,.13);color:#f3aa62}.morale-unhappy{background:rgba(163,58,58,.13);color:#ff8b8b}.morale-critical{background:rgba(128,27,27,.24);color:#ff6262}.eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;opacity:.5}@keyframes pause-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:1180px){.city-search{width:170px}.top-kpis span:nth-child(2){display:none}.project-dock,.project-dock.with-panel{left:96px;right:16px;width:auto;transform:none;grid-template-columns:minmax(190px,1fr) auto}.project-stats span:nth-child(-n+2){display:none}.project-dock.edit-focus .project-stats{grid-template-columns:repeat(3,minmax(72px,1fr))}.project-dock.edit-focus .project-stats span:nth-child(-n+2){display:none}.project-history-actions span{display:none}}@media(max-width:880px){.date{display:none}.top-kpis span:nth-child(n+2){display:none}.brand{min-width:0}.city-search{display:none}.side-panel{left:78px;width:calc(100vw - 92px)}.tool-dock{left:10px}.topbar{left:10px;right:10px}.day-button{margin-left:auto}.bilan-button span{display:none}.bilan-button{padding:9px 10px}.project-dock,.project-dock.with-panel,.project-dock.edit-focus{left:12px;right:12px;width:auto;transform:none;top:88px;grid-template-columns:1fr;grid-template-areas:'copy' 'routing' 'edit' 'buttons';gap:7px}.project-stats,.project-dock.edit-focus .project-stats{display:none}.project-edit-actions{flex-wrap:wrap;width:100%}.selected-edit-station{flex:1}.project-routing-actions{width:max-content;max-width:100%;flex-wrap:wrap}.project-buttons{justify-content:flex-start;width:100%}}

/* V45 polish final — recherche, lisibilité financière et préparation d'exploitation */
.budget-kpi strong.money-in{color:#66f3a0!important;font-weight:950;animation:budget-in 2s ease both}.budget-kpi strong.money-out{color:#ff6f79!important;font-weight:950;animation:budget-out 2s ease both}.financial-pulse{left:50%;top:calc(100% + 5px);padding:5px 10px;font-size:17px;font-weight:1000;border-width:2px;box-shadow:0 8px 26px rgba(0,0,0,.5)}@keyframes budget-in{0%,100%{transform:scale(1)}12%{transform:scale(1.16)}65%{transform:scale(1.04)}}@keyframes budget-out{0%,100%{transform:scale(1)}12%{transform:scale(1.16)}65%{transform:scale(1.04)}}
.search-hub-button{border-top:1px solid rgba(255,255,255,.07)!important}.search-hub-button b{font-size:20px!important;color:#9eeef2}.search-hub{position:absolute;z-index:24;left:87px;top:94px;width:min(420px,calc(100vw - 112px));max-height:calc(100vh - 112px);padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:rgba(8,14,19,.96);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.42);display:grid;align-content:start;gap:14px;overflow:auto;scrollbar-width:thin}.search-hub-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px 2px}.search-hub-head>div{display:grid;gap:2px}.search-hub-head>strong{font-size:13px}.search-hub-head>button{width:34px;height:34px;border:0;border-radius:9px;background:rgba(255,255,255,.045);color:inherit;font-size:20px;cursor:pointer}.search-module{display:grid;gap:10px;min-width:0;padding:14px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.search-module>label{font-size:11px;font-weight:850}.search-input-wrap{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:0 11px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#101a20}.search-input-wrap:focus-within{border-color:rgba(79,211,220,.52);box-shadow:0 0 0 3px rgba(79,211,220,.07)}.search-input-wrap>span{opacity:.55}.search-input-wrap input{min-width:0;width:100%;height:42px;border:0;outline:0;background:transparent;color:inherit;font-size:12px}.search-input-wrap input:focus,.search-input-wrap input:focus-visible{outline:0!important;box-shadow:none!important}.search-results{display:grid;gap:4px;max-height:220px;overflow:auto;scrollbar-width:thin;scrollbar-gutter:stable;padding-right:2px}.search-results button{min-height:44px;border:0;border-radius:9px;padding:8px 9px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}.search-results button:hover,.search-results button:focus-visible{background:rgba(79,211,220,.1)}.search-results button>span{display:grid;min-width:0;gap:2px}.search-results strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search-results small{font-size:9px;opacity:.55;display:flex;align-items:center;gap:4px}.station-results small i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}.search-empty{font-size:10px;line-height:1.45;opacity:.58;padding:2px 1px}
.day-progress{width:min(470px,46vw);gap:11px;padding:9px 12px;border-radius:12px}.day-progress span{font-size:9px;font-weight:700;opacity:.72}.day-progress>div{height:6px}.project-history-actions span{display:inline!important}.project-history-actions button{display:flex;align-items:center;gap:4px}.project-dock.edit-focus .project-stats{grid-template-columns:repeat(5,minmax(76px,1fr))}
.launch-mode-choice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.launch-mode-choice button{padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;text-align:left;display:grid;gap:4px;cursor:pointer}.launch-mode-choice button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.10)}.launch-mode-choice strong{font-size:12px}.launch-mode-choice small{font-size:9px;line-height:1.4;opacity:.58}.launch-recommended-card{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border:1px solid rgba(79,211,220,.16);border-radius:12px;background:rgba(79,211,220,.045)}.launch-recommended-card>div{display:grid;gap:2px}.launch-recommended-card span{font-size:9px;opacity:.5}.launch-recommended-card strong{font-size:12px}.launch-recommended-card p{grid-column:1/-1;margin:4px 0 0;font-size:10px;line-height:1.5;opacity:.62}.launch-manual-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.launch-manual-sections>section{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);display:grid;gap:9px}.launch-manual-sections h3{margin:0;font-size:12px}.launch-manual-sections small{font-size:9px;line-height:1.45;opacity:.58}.launch-line-fare{grid-column:1/-1}.launch-fare-toggle{display:flex;align-items:flex-start;gap:9px;padding:9px;border-radius:9px;background:rgba(255,255,255,.035)}.launch-fare-toggle>span{display:grid;gap:2px}.launch-fare-toggle input{margin-top:2px;accent-color:#50d2dc}.launch-fare-price{display:grid;grid-template-columns:1fr 120px;align-items:center;gap:10px;font-size:10px}.launch-fare-price input{background:#121c23;color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px}
.contract-dialog{width:min(560px,calc(100vw - 38px));padding:26px;position:relative;overflow:hidden;background:linear-gradient(145deg,#10191f,#0c1419);border-color:rgba(123,224,230,.28)}.contract-dialog:before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#78e0e6,transparent)}.contract-kicker{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.22em;color:#91e8ec;font-weight:900}.contract-dialog h3{font-size:24px;margin:7px 0 9px}.contract-dialog p{font-size:12px;line-height:1.65;opacity:.76}.contract-line{height:1px;background:rgba(255,255,255,.08);margin:18px 0 12px}.contract-signature{margin-left:auto;width:max-content;min-width:170px;padding:4px 28px 4px 0;position:relative;text-align:right;display:grid}.contract-signature small{font-size:8px;text-transform:uppercase;letter-spacing:.12em;opacity:.45}.contract-signature strong{font-family:Georgia,serif;font-size:18px;font-style:italic;font-weight:500;transform:rotate(-3deg);transform-origin:right center;animation:signature-in .55s ease-out both}.contract-signature i{position:absolute;right:0;bottom:2px;width:23px;height:23px;border:1px solid rgba(105,234,171,.6);border-radius:50%;display:grid;place-items:center;color:#70e6a2;font-style:normal;animation:stamp-in .35s .35s ease-out both}.contract-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:22px}.contract-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:9px 11px;cursor:pointer}.contract-actions .finance-action{margin-left:auto;background:rgba(79,211,220,.16);border-color:rgba(79,211,220,.38)}@keyframes signature-in{from{opacity:0;transform:translateX(18px) rotate(-8deg)}to{opacity:1;transform:translateX(0) rotate(-3deg)}}@keyframes stamp-in{from{opacity:0;transform:scale(1.55) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(0)}}
@media(max-width:760px){.launch-mode-choice,.launch-recommended-card,.launch-manual-sections{grid-template-columns:1fr}.launch-recommended-card p,.launch-line-fare{grid-column:auto}.search-hub{left:78px;top:94px;width:calc(100vw - 92px);max-height:calc(100vh - 112px)}.contract-actions{align-items:stretch;flex-direction:column-reverse}.contract-actions button{width:100%}.contract-actions .finance-action{margin-left:0}.day-progress{width:min(460px,62vw)}}

</style>
