<script setup lang="ts">
import { currentGameLocale, currentGameLocaleTag, translateGameText, formatGameInteger, formatGameNumberCompact, formatGameCurrencyCompact } from '../../config/i18n'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import NetworkPanel from './panels/NetworkPanel.vue'
import PassengersPanel from './panels/PassengersPanel.vue'
import FleetPanel from './panels/FleetPanel.vue'
import OperationsPanel from './panels/OperationsPanel.vue'
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
import ChallengeResultDialog from '../challenges/ChallengeResultDialog.vue'
import HelpCenter from '../help/HelpCenter.vue'
import TutorialCoach from '../help/TutorialCoach.vue'
import WorldPulse from './WorldPulse.vue'
import ManagementHub from './ManagementHub.vue'
import DiversPanel from './DiversPanel.vue'
import WorldExportPanel from './WorldExportPanel.vue'
import EditorExportPanel from './EditorExportPanel.vue'
import QuickNavigation from './QuickNavigation.vue'
import AssistantPanel from './AssistantPanel.vue'

import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameNetwork } from '../../composables/useGameNetwork'
import type { GameDraftPreviewMetrics } from '../../composables/useGameNetwork'
import { useGameEconomy } from '../../composables/useGameEconomy'
import { useGameSimulation } from '../../composables/useGameSimulation'
import { useGameClock } from '../../composables/useGameClock'
import { useGameOperations } from '../../composables/useGameOperations'
import { useGameTerritory } from '../../composables/useGameTerritory'
import { useGameMunicipalities } from '../../composables/useGameMunicipalities'
import { useGameObjectives } from '../../composables/useGameObjectives'
import { useGameInfoCenter } from '../../composables/useGameInfoCenter'
import { useGameSelection } from '../../composables/useGameSelection'
import {
  captureGameMapThumbnail,
  clearGameMapOverlay,
  focusGameMapBounds,
  focusGameMapLine,
  focusGameMapPoint,
  installGameMapBridge,
  syncGameMapOverlay,
} from '../../utils/mapBridge'
import {
  getTransportModeDefinition,
  isLightAssistRouting,
  isRailAutoRouting,
  lightAssistRoutingMode,
  railAutoRoutingMode,
} from '../../config/transportModes'
import { GAME_SERVICE_LEVELS } from '../../config/operations'
import { GAME_MAINTENANCE_LEVELS } from '../../config/maintenance'
import { calculateLineLengthKm } from '../../engine/economy'
import { findLineStation, getLineAllStations, getLineTerminusStations } from '../../engine/network/geometry'
import { findMunicipalityForStation } from '../../engine/territory'
import { useGameTransitRuntime } from '../../composables/useGameTransitRuntime'
import { useGameSettings } from '../../composables/useGameSettings'
import { useGameAssistant } from '../../composables/useGameAssistant'
import { useGameAudio } from '../../composables/useGameAudio'
import { useGameRollingStock } from '../../composables/useGameRollingStock'
import { useGameMaintenance } from '../../composables/useGameMaintenance'
import { useGameChallenge } from '../../composables/useGameChallenge'
import { useGameFares } from '../../composables/useGameFares'
import { useGameHelp } from '../../composables/useGameHelp'
import { useGameDialog } from '../../composables/useGameDialog'
import { useCluOnline } from '../../composables/useCluOnline'
import type { GameVisualVehicle } from '../../engine/transitRuntime'
import type { GameLine, GameMaintenanceLevel, GameRegulationMode, GameRollingStockUpgradeKey, GameRollingStockUpgrades, GameServiceLevel } from '../../types/network'
import type { GameEconomyTransaction } from '../../types/economy'
import { getGameTerritoryCatalogEntry } from '../../config/territories'
import { isoDateForGameDay } from '../../config/calendar'
import { buildGameWorldPulse } from '../../engine/worldPulse'
import { buildProjectForecast } from '../../engine/projectForecast'
import { estimateLocalEventServiceCost } from '../../engine/municipalities'
import { buildCluEditorProject, buildWorldExportModel, renderWorldExportPng, serializeCluEditorProject } from '../../engine/sharing'
import type { GameWorldExportOptions } from '../../engine/sharing'
import type { GameWorldPulseItem } from '../../types/worldPulse'
import type { GameMapInsightMode, GameMapMunicipalityInsight } from '../../types/mapInsights'
import type { GameLocalEvent, GameLocalEventServiceKind, GameUrbanProject } from '../../types/municipalities'
import type { CluOnlineBudgetMode, CluOnlineVisibility } from '../../types/online'

const GameMap = defineAsyncComponent(async () => {
  await installGameMapBridge()
  return (await import('../map/GameMap.vue')).default
})

type GameTool = 'NETWORK' | 'FLEET' | 'PASSENGERS' | 'OPERATIONS' | 'MUNICIPALITIES' | 'FINANCES' | 'EVENTS' | 'OBJECTIVES'
type ActionDialog = { title: string; message: string; finance?: boolean; financeEdit?: boolean }
type BorrowConfirmation = { kind: 'PROJECT' | 'EDIT'; amount: number }

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
const operations = useGameOperations()
const territory = useGameTerritory()
const municipalities = useGameMunicipalities()
const objectives = useGameObjectives()
const info = useGameInfoCenter()
const selection = useGameSelection()
const transitRuntime = useGameTransitRuntime()
const preferences = useGameSettings()
const assistant = useGameAssistant()
const audio = useGameAudio()
const rollingStock = useGameRollingStock()
const maintenance = useGameMaintenance()
const challenge = useGameChallenge()
const fares = useGameFares()
const help = useGameHelp()
const gameDialogs = useGameDialog()
const online = useCluOnline()

const selectedTool = ref<GameTool>((game.state.value.save?.data.uiState?.selectedPanel as GameTool) ?? 'NETWORK')
const menuOpen = ref(false)
const panelOpen = ref(game.state.value.save?.data.uiState?.panelOpen === true)
const isSaving = ref(false)
const creationOpen = ref(false)
const pendingCreationMunicipalityCode = ref<string | null>(null)
const settingsOpen = ref(false)
const onlinePublishOpen = ref(false)
const onlinePublishBusy = ref(false)
const onlinePublishError = ref<string | null>(null)
const onlinePublishName = ref('')
const onlinePublishVisibility = ref<CluOnlineVisibility>('privee')
const onlinePublishBudgetMode = ref<CluOnlineBudgetMode>('global')
const onlinePublishEditionByDefault = ref(false)
const bilanOpen = ref(false)
const managementOpen = ref(false)
const financeDebtFocusToken = ref(0)
const diversOpen = ref(false)
const actionsOpen = ref(false)
const assistantOpen = ref(false)
const lineVisibilityOpen = ref(false)
const dimmedLineIds = ref<string[]>([])
const routePlannerOpen = ref(false)
const exportingWorldSave = ref(false)
const worldExportOpen = ref(false)
const editorExportOpen = ref(false)
const worldExportBusy = ref(false)
const editorExportBusy = ref(false)
const diversFeedback = ref<string | null>(null)
const diversError = ref<string | null>(null)
const dismissedWorldPulseUntilDay = ref<Record<string, number>>({})
const actionDialog = ref<ActionDialog | null>(null)
const borrowConfirmation = ref<BorrowConfirmation | null>(null)
const selectedVehicle = ref<GameVisualVehicle | null>(null)
const mapOverlayOpen = ref(false)
const stationNameDraft = ref('')
const knownLineStatuses = ref<Record<string, string>>(Object.fromEntries(network.lines.value.map(line => [line.id, line.status])))
const knownCompletedMunicipalityRequests = ref(new Set(municipalities.recentResolvedRequests.value.filter(request => request.status === 'COMPLETED').map(request => request.id)))
const knownCompletedObjectives = ref(new Set(game.state.value.save?.data.objectives.completed.map(item => item.id) ?? []))
const draftPreviewMetrics = ref<GameDraftPreviewMetrics | null>(null)
const challengeResultOpen = ref(false)
const financialPulse = ref<{ amount: number; id: number; reason: string } | null>(null)
let financialPulseTimer: ReturnType<typeof setTimeout> | null = null
let saveThumbnailWarmupTimers: Array<ReturnType<typeof setTimeout>> = []
const buildWarning = ref<string | null>(null)
let buildWarningTimer: ReturnType<typeof setTimeout> | null = null
const knownFinancialTransactionIds = new Set(economy.transactions.value.map(transaction => transaction.id))
const knownFinancialEventIds = new Set(game.state.value.save?.data.events?.history.map(entry => entry.id) ?? [])
const launchConfigOpen = ref(false)
const launchConfig = ref<GameLineLaunchConfiguration | null>(null)
const launchConfigurationMode = ref<'RECOMMENDED' | 'MANUAL'>('RECOMMENDED')
const projectBorrowFeedback = ref<string | null>(null)
const projectBorrowBusy = ref(false)
const launchCommitBusy = ref(false)
const editProjectFinanceBusy = ref(false)
const editProjectFinanceFeedback = ref<string | null>(null)
const projectForecastOpen = ref(false)
const mapInsightMode = ref<GameMapInsightMode>('NONE')
const eventPreparationEventId = ref<string | null>(null)
const eventPreparationLineId = ref<string | null>(null)
const eventPreparationServiceKind = ref<GameLocalEventServiceKind>('REINFORCEMENT')
const eventServiceKinds: GameLocalEventServiceKind[] = ['REINFORCEMENT', 'EVENT_SHUTTLE', 'LATE_SERVICE']
const eventPreparationBusy = ref(false)
const eventPreparationFeedback = ref<string | null>(null)
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
const onlineTargetsCurrentSave = computed(() => Boolean(
  game.state.value.save?.id
  && online.sauvegardeLocaleId.value
  && game.state.value.save.id === online.sauvegardeLocaleId.value,
))
const onlineAccepted = computed(() => online.sessionActive.value
  && online.moi.value?.statut === 'accepte'
  && onlineTargetsCurrentSave.value)
const onlineSimulationReplica = computed(() => onlineAccepted.value && !online.estAdmin.value)
const onlineClockReadOnly = computed(() => onlineAccepted.value && !online.peut('gerer_temps_simulation'))

function hasOnlinePermission(permission: Parameters<typeof online.peut>[0]) {
  return !onlineAccepted.value || online.estAdmin.value || online.peut(permission)
}

const onlineCanCreateLine = computed(() => hasOnlinePermission('construire_lignes'))
const onlineLockedManagementModules = computed<Partial<Record<GameTool, string>>>(() => {
  if (!onlineAccepted.value || online.estAdmin.value) return {}
  const locked: Partial<Record<GameTool, string>> = {}
  if (!online.peut('gerer_materiel_roulant')) locked.FLEET = translateGameText('Permission requise : gérer le matériel roulant.', currentGameLocale())
  if (!online.peut('gerer_exploitation')) locked.OPERATIONS = translateGameText('Permission requise : gérer l’exploitation.', currentGameLocale())
  if (!online.peut('gerer_urbanisme')) locked.MUNICIPALITIES = translateGameText('Permission requise : gérer l’urbanisme.', currentGameLocale())
  if (!online.peut('gerer_finances')) locked.FINANCES = translateGameText('Permission requise : gérer les finances.', currentGameLocale())
  return locked
})
const selectedToolLockedReason = computed(() => onlineLockedManagementModules.value[selectedTool.value] || null)

const gameName = computed(() => game.state.value.save?.name ?? 'Métropole')
const freePlaySettings = computed(() => game.state.value.save?.data.freePlaySettings ?? null)
const gameModeLabel = computed(() => {
  const definition = challenge.definition.value
  const base = !definition
    ? (freePlaySettings.value?.cheatUnlimitedMoney ? 'Partie libre · Triche' : 'Partie libre')
    : definition.kind === 'DAILY' ? 'Défi du jour' : 'Ancien défi'
  if (!onlineAccepted.value) return base
  return `${base} · ${online.joueursConnectes.value}/${online.partie.value?.placesMax || 5} ${translateGameText('joueurs connectés', currentGameLocale())}`
})
const toolWikiArticle = computed(() => ({
  NETWORK: 'reseau',
  FLEET: 'materiel-roulant',
  PASSENGERS: 'voyageurs-correspondances',
  OPERATIONS: 'pcc-incidents',
  MUNICIPALITIES: 'communes',
  FINANCES: 'finances',
  EVENTS: 'evenements',
  OBJECTIVES: 'objectifs',
}[selectedTool.value] ?? 'prise-en-main'))
const userSettings = computed(() => preferences.settings.value)
const resolvedMapGraphicsQuality = computed<'ECO' | 'BALANCED' | 'HIGH'>(() => {
  const requested = userSettings.value.graphicsQuality
  if (requested !== 'AUTO') return requested
  const lines = network.displayLines.value
  const lineCount = lines.length
  const stationCount = lines.reduce((total, line) => total + getLineAllStations(line).length, 0)
  const vehicleCount = transitRuntime.vehicles.value.length
  if (lineCount >= 100 || stationCount >= 1_200 || vehicleCount >= 700) return 'ECO'
  if (lineCount >= 40 || stationCount >= 520 || vehicleCount >= 280) return 'BALANCED'
  return 'HIGH'
})
const clockStatusLabel = computed(() => {
  if (!clock.playing.value) return 'Jeu en pause'
  if (clock.speed.value === 0.5) return 'Jeu ralenti'
  if (clock.speed.value === 2) return 'Jeu accéléré'
  return 'Jeu en cours'
})

const moraleUi = computed(() => {
  const score = Math.round(simulation.networkMoraleScore.value)
  if (score >= 85) return { label: 'Très heureux', emoji: '😄', tone: 'morale-very-happy' }
  if (score >= 70) return { label: 'Heureux', emoji: '🙂', tone: 'morale-happy' }
  if (score >= 55) return { label: 'Moyen', emoji: '😐', tone: 'morale-medium' }
  if (score >= 40) return { label: 'Tendu', emoji: '😕', tone: 'morale-tense' }
  if (score >= 25) return { label: 'Mécontent', emoji: '😠', tone: 'morale-unhappy' }
  return { label: 'Très mécontent', emoji: '😡', tone: 'morale-critical' }
})

const worldPulseDismissStorageKey = computed(() => `clu-metropole:world-pulse-dismissed:${game.state.value.save?.id ?? 'none'}`)

function worldPulseCooldownKey(item: GameWorldPulseItem) {
  // Les événements/incidents conservent leur propre identité. Les conseils
  // quotidiens portant sur une même ligne/commune partagent une clé stable afin
  // qu'un simple changement de jour ne recrée pas immédiatement le même spam.
  if (item.id.startsWith('operations:') || item.id.startsWith('event:') || item.id.startsWith('local-event:')) return item.id
  if (item.lineId) return `line:${item.lineId}:${item.panel ?? 'NONE'}:${item.tone}`
  if (item.municipalityCode) return `municipality:${item.municipalityCode}:${item.panel ?? 'NONE'}:${item.tone}`
  return item.id.replace(/:\d+$/, '')
}

function worldPulseDismissDuration(item: GameWorldPulseItem) {
  if (item.tone === 'ALERT') return 1
  if (item.tone === 'EVENT') return 4
  if (item.tone === 'OPPORTUNITY') return 7
  if (item.tone === 'SUCCESS') return 5
  return 3
}

function loadWorldPulseDismissals() {
  try {
    const raw = localStorage.getItem(worldPulseDismissStorageKey.value)
    const parsed = raw ? JSON.parse(raw) : {}
    dismissedWorldPulseUntilDay.value = parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch { dismissedWorldPulseUntilDay.value = {} }
}

function persistWorldPulseDismissals() {
  try { localStorage.setItem(worldPulseDismissStorageKey.value, JSON.stringify(dismissedWorldPulseUntilDay.value)) }
  catch { /* Préférence locale non critique. */ }
}

const worldPulseItems = computed(() => {
  const save = game.state.value.save
  if (!save) return []
  return buildGameWorldPulse(
    save,
    territory.municipalities.value,
    territory.summary.value,
    info.items.value,
    3,
  ).filter(item => {
    const until = dismissedWorldPulseUntilDay.value[worldPulseCooldownKey(item)] ?? 0
    return simulation.day.value > until
  })
})

const assistantMessageCount = computed(() => assistant.state.value?.history.length ?? 0)

const lineVisibilityChoices = computed(() => network.lines.value
  .filter(line => line.status !== 'PROJECT')
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name, currentGameLocaleTag(), { numeric: true, sensitivity: 'base' })))
const anyLineDimmed = computed(() => dimmedLineIds.value.length > 0)
const allLinesDimmed = computed(() => lineVisibilityChoices.value.length > 0 && dimmedLineIds.value.length >= lineVisibilityChoices.value.length)

const eventPreparationEvent = computed<GameLocalEvent | null>(() => {
  const id = eventPreparationEventId.value
  if (!id) return null
  return municipalities.localEvents.value.find(event => event.id === id) ?? null
})

const eventPreparationLines = computed(() => {
  const event = eventPreparationEvent.value
  if (!event) return []
  const lineIds = new Set(territory.summary.value.lines
    .filter(coverage => coverage.municipalities.some(municipality => municipality.code === event.municipalityCode))
    .map(coverage => coverage.lineId))
  return network.lines.value
    .filter(line => line.status === 'OPERATIONAL' && line.mode === 'BUS' && lineIds.has(line.id))
    .sort((a, b) => a.name.localeCompare(b.name, currentGameLocaleTag(), { numeric: true, sensitivity: 'base' }))
})

const eventPreparationLine = computed(() => eventPreparationLines.value.find(line => line.id === eventPreparationLineId.value) ?? eventPreparationLines.value[0] ?? null)

const eventPreparationAnalysis = computed(() => {
  const event = eventPreparationEvent.value
  const line = eventPreparationLine.value
  if (!event || !line) return null
  const report = simulation.reportForLine(line.id)
  const competingLines = Math.max(1, eventPreparationLines.value.length)
  const estimatedShare = Math.max(1, Math.round(event.expectedVisitors / competingLines))
  const capacity = Math.max(1, report?.dailyCapacity ?? line.vehicleCount * 1_000)
  const demand = Math.max(0, report?.boardingDemandPassengers ?? report?.passengers ?? 0)
  const spareCapacity = Math.max(0, capacity - demand)
  const occupancy = Math.max(0, report?.occupancyRate ?? report?.projectedOccupancyRate ?? 0)
  const pressure = estimatedShare / Math.max(1, spareCapacity + capacity * 0.12)
  const recommended: 'LIGHT' | 'STRONG' = pressure >= 0.72 || occupancy >= 0.88 ? 'STRONG' : 'LIGHT'
  const recommendedServiceKind: GameLocalEventServiceKind = pressure >= 1.05 || occupancy >= 0.94
    ? 'EVENT_SHUTTLE'
    : (event.kind === 'CONCERT' || event.kind === 'FOOTBALL') && pressure < 0.55
      ? 'LATE_SERVICE'
      : 'REINFORCEMENT'
  return { estimatedShare, capacity, spareCapacity, occupancy, recommended, recommendedServiceKind }
})

const eventPreparationCosts = computed(() => {
  const event = eventPreparationEvent.value
  const line = eventPreparationLine.value
  if (!event || !line) return null
  return {
    light: estimateLocalEventServiceCost(event, line, eventPreparationServiceKind.value, 'LIGHT'),
    strong: estimateLocalEventServiceCost(event, line, eventPreparationServiceKind.value, 'STRONG'),
  }
})

function localEventScaleLabel(scale: GameLocalEvent['scale']) {
  return translateGameText(scale === 'MEGA' ? 'Métropolitain' : scale === 'MAJOR' ? 'Majeur' : 'Local', currentGameLocale())
}

function localEventKindLabel(kind: GameLocalEvent['kind']) {
  const key = {
    CONCERT: 'Grand concert',
    FOOTBALL: 'Match à forte affluence',
    FESTIVAL: 'Festival',
    EXHIBITION: 'Salon majeur',
  }[kind]
  return translateGameText(key, currentGameLocale())
}

function localEventServiceLabel(kind: GameLocalEventServiceKind) {
  return translateGameText(kind === 'EVENT_SHUTTLE'
    ? 'Navette événementielle'
    : kind === 'LATE_SERVICE'
      ? 'Service tardif'
      : 'Renfort de ligne', currentGameLocale())
}

function localEventServiceDescription(kind: GameLocalEventServiceKind) {
  return translateGameText(kind === 'EVENT_SHUTTLE'
    ? 'Concentre des circulations supplémentaires autour du pic pour absorber une forte affluence.'
    : kind === 'LATE_SERVICE'
      ? 'Prolonge l’offre en soirée pour évacuer le public après le concert ou le match.'
      : 'Renforce simplement la ligne existante pendant l’événement.', currentGameLocale())
}

function localEventFrequencyBoost(kind: GameLocalEventServiceKind, level: 'LIGHT' | 'STRONG') {
  if (kind === 'EVENT_SHUTTLE') return level === 'STRONG' ? 55 : 30
  if (kind === 'LATE_SERVICE') return level === 'STRONG' ? 22 : 12
  return level === 'STRONG' ? 40 : 20
}

function closeEventPreparation() {
  eventPreparationEventId.value = null
  eventPreparationLineId.value = null
  eventPreparationServiceKind.value = 'REINFORCEMENT'
  eventPreparationFeedback.value = null
}

function focusEventPreparationSector() {
  const event = eventPreparationEvent.value
  if (!event) return
  const municipality = territory.municipalities.value.find(item => item.code === event.municipalityCode)
  if (municipality) focusGameMapBounds(municipality.bounds)
  closeEventPreparation()
}

function openEventPreparation(eventId: string, preferredLineId?: string) {
  eventPreparationEventId.value = eventId
  const event = municipalities.localEvents.value.find(item => item.id === eventId)
  if (!event) { closeEventPreparation(); return }
  const busLineIds = new Set(network.lines.value
    .filter(line => line.status === 'OPERATIONAL' && line.mode === 'BUS')
    .map(line => line.id))
  const candidates = territory.summary.value.lines
    .filter(coverage => busLineIds.has(coverage.lineId) && coverage.municipalities.some(municipality => municipality.code === event.municipalityCode))
    .map(coverage => coverage.lineId)
  eventPreparationLineId.value = preferredLineId && candidates.includes(preferredLineId)
    ? preferredLineId
    : candidates[0] ?? null
  eventPreparationServiceKind.value = event.serviceKind ?? 'REINFORCEMENT'
  eventPreparationFeedback.value = null
  actionsOpen.value = false
  assistantOpen.value = false
}

async function applyEventPreparation(level: 'LIGHT' | 'STRONG', serviceKind = eventPreparationServiceKind.value) {
  const event = eventPreparationEvent.value
  const line = eventPreparationLine.value
  if (!event || !line || eventPreparationBusy.value) return
  eventPreparationBusy.value = true
  eventPreparationFeedback.value = null
  try {
    const result = await municipalities.prepareLocalEvent(event.id, line.id, serviceKind, level)
    if (!result.ok) {
      eventPreparationFeedback.value = result.reason === 'INSUFFICIENT_FUNDS'
        ? `${translateGameText('Budget insuffisant pour ce service temporaire.', currentGameLocale())} ${translateGameText('Coût', currentGameLocale())} : ${money(result.serviceCost ?? 0)}.`
        : result.reason === 'BUS_ONLY'
          ? translateGameText('Les services temporaires sont réservés aux bus.', currentGameLocale())
          : translateGameText('Impossible de préparer cet événement avec cette ligne.', currentGameLocale())
      audio.playUi('ERROR')
      return
    }
    const reinforcement = line.schedule?.mode === 'TIMETABLE'
      ? `${result.extraTrips} ${translateGameText('circulations de renfort', currentGameLocale())}`
      : `+${localEventFrequencyBoost(serviceKind, level)} % ${translateGameText("d'offre temporaire", currentGameLocale())}`
    eventPreparationServiceKind.value = serviceKind
    eventPreparationFeedback.value = `${localEventServiceLabel(serviceKind)} · ${line.name} · ${reinforcement} · ${money(result.serviceCost)}`
    audio.playUi('CONFIRM')
  }
  finally { eventPreparationBusy.value = false }
}

const quickNavigationCompact = computed(() => managementOpen.value || diversOpen.value || worldExportOpen.value || editorExportOpen.value || panelOpen.value || actionsOpen.value || assistantOpen.value)

const majorPanelOpen = computed(() => (
  creationOpen.value
  || routePlannerOpen.value
  || managementOpen.value
  || diversOpen.value
  || worldExportOpen.value
  || editorExportOpen.value
  || panelOpen.value
  || Boolean(selection.selectedStationId.value)
  || mapOverlayOpen.value
  || Boolean(selectedVehicle.value)
  || menuOpen.value
  || settingsOpen.value
  || bilanOpen.value
  || launchConfigOpen.value
  || Boolean(eventPreparationEventId.value)
  || network.isBuilding.value
  || network.isEditing.value
))

const contextDockVisible = computed(() => (
  gameplayReady.value
  && !majorPanelOpen.value
  && !actionsOpen.value
  && !assistantOpen.value
  && !network.pendingStationNaming.value
))

watch(majorPanelOpen, open => {
  if (open) closeContextPanels()
})

const dayBlockedReason = computed(() => {
  if (onlineClockReadOnly.value) return translateGameText('Le temps est piloté par l’administrateur de la partie en ligne.', currentGameLocale())
  if (challenge.readOnly.value) return 'Défi terminé : la partie est en lecture seule.'
  if (simulation.isAdvancing.value) return 'Calcul de la journée en cours…'
  if (economy.insolvencyStatus.value === 'BANKRUPT') return 'Impossible de continuer : le réseau est en insolvabilité.'
  if (!economy.unlimitedMoney.value && economy.balance.value < 0) return 'Impossible de passer au jour suivant : régularisez votre trésorerie ou obtenez un financement dans Finances.'
  if (network.isBuilding.value) return 'Terminez ou annulez la conception de la ligne en cours avant de passer au jour suivant.'
  if (network.isEditing.value) return 'Validez ou annulez la modification de tracé avant de passer au jour suivant.'
  return ''
})

const projectInstruction = computed(() => {
  if (network.routeGuideMode.value) return 'Point de passage : cliquez sur la carte. Ce point guidera le prochain segment sans créer de station.'
  if (network.activeLine.value?.mode === 'FERRY') return 'Navette fluviale : posez les haltes sur l’eau. Le tracé est refusé dès qu’un segment quitte la voie d’eau ; utilisez Point guide pour suivre les méandres.'
  if (network.activeLine.value?.mode === 'CABLE') return 'Téléphérique : tracez librement entre les stations. Le câble ne suit ni route ni voie ferrée.'
  if (network.activeLine.value) return 'Cliquez sur la carte pour ajouter des stations.'
  if (!network.editDraft.value) return ''
  if (network.mapAction.value.kind === 'INSERT_ON_TRACE') return 'Insertion : cliquez précisément sur le tracé existant. CLU projette l’arrêt sur la ligne ; seul le coût de la station est facturé.'
  const selectedName = network.editSelectedStation.value?.name
  if (network.mapAction.value.kind === 'APPEND' || network.mapAction.value.kind === 'PREPEND') return `Point de reprise : ${selectedName ?? 'terminus'}. Ajoutez autant d’arrêts que nécessaire, ou cliquez un autre arrêt pour changer de point de reprise.`
  if (network.mapAction.value.kind === 'INSERT_AFTER') return `Point de reprise : ${selectedName ?? 'arrêt sélectionné'}. Cliquez sur la carte pour insérer un arrêt sur le tronc.`
  if (network.mapAction.value.kind === 'CREATE_BRANCH') return `Bifurcation : ${selectedName ?? 'arrêt sélectionné'}. Le tracé reste actif après le premier arrêt pour dessiner toute la branche d’un geste.`
  if (network.mapAction.value.kind === 'APPEND_BRANCH') return `Branche : ${selectedName ?? 'terminus sélectionné'}. Continuez à poser les arrêts ; cliquez un autre arrêt pour changer de point de reprise.`
  if (network.mapAction.value.kind === 'CONNECT_EXISTING') return `Raccordement : cliquez une gare existante pour y faire rejoindre cette branche, même si cette gare appartient déjà à la ligne.`
  if (network.mapAction.value.kind === 'MOVE') return `Déplacement de ${selectedName ?? 'la station'} : cliquez sur sa nouvelle position.`
  return 'Cliquez directement sur n’importe quel arrêt de la ligne pour choisir le point de reprise, le déplacer ou le retirer.'
})

const projectValidation = computed(() => network.activeLine.value
  ? network.activeProjectValidation.value
  : network.editProjectValidation.value)
const projectLine = computed(() => network.activeLine.value ?? network.editDraft.value)
const projectModeActive = computed(() => !challenge.readOnly.value && Boolean(network.activeLine.value || network.editDraft.value))
const projectRoutingLocked = computed(() => projectLine.value?.mode === 'FERRY')
const projectRailAutoMode = computed(() => projectLine.value ? railAutoRoutingMode(projectLine.value.mode) : 'ASSISTED')
const projectLightAssistMode = computed(() => projectLine.value ? lightAssistRoutingMode(projectLine.value.mode) : 'LIGHT')
const projectRailAutoActive = computed(() => Boolean(projectLine.value && isRailAutoRouting(projectLine.value.mode, projectLine.value.routingMode)))
const projectLightAssistActive = computed(() => Boolean(projectLine.value && isLightAssistRouting(projectLine.value.mode, projectLine.value.routingMode)))
const projectRoutingLabel = computed(() => {
  const line = projectLine.value
  if (!line) return 'Tracé'
  if (line.mode === 'FERRY') return 'Voie d’eau uniquement'
  if (isRailAutoRouting(line.mode, line.routingMode)) return 'Voies ferrées auto'
  if (isLightAssistRouting(line.mode, line.routingMode)) return 'Libre avec aide légère'
  if (line.mode === 'CABLE') return 'Libre aérien'
  return 'Libre'
})
const projectRoutingLockLabel = computed(() => 'Eau obligatoire')
const projectGuideLabel = computed(() => projectLine.value?.mode === 'CABLE' ? '＋ Pylône' : projectLine.value?.mode === 'FERRY' ? '＋ Point eau' : '＋ Point guide')

const displayedProjectLength = computed(() => draftPreviewMetrics.value?.lengthKm ?? (projectLine.value ? calculateLineLengthKm(projectLine.value) : 0))
const displayedProjectCost = computed(() => draftPreviewMetrics.value?.cost ?? (network.activeLine.value ? network.activeProjectEstimate.value : network.editProjectEstimate.value))
const previewBudgetExceeded = computed(() => Boolean(draftPreviewMetrics.value && !draftPreviewMetrics.value.affordable))
const editProjectShortfall = computed(() => {
  if (!network.editDraft.value || economy.unlimitedMoney.value) return 0
  return Math.max(0, Math.round(network.editProjectEstimate.value - economy.balance.value))
})
const borrowConfirmationDebtAfter = computed(() => economy.debtPrincipal.value + (borrowConfirmation.value?.amount ?? 0))
const borrowConfirmationBalanceAfter = computed(() => economy.balance.value + (borrowConfirmation.value?.amount ?? 0))
function financeEditProject() {
  if (editProjectFinanceBusy.value || editProjectShortfall.value <= 0) return
  borrowConfirmation.value = { kind: 'EDIT', amount: editProjectShortfall.value }
}

async function applyEditProjectFinance(amount: number) {
  if (editProjectFinanceBusy.value || amount <= 0) return
  editProjectFinanceBusy.value = true
  editProjectFinanceFeedback.value = null
  try {
    const result = await economy.borrowProject(amount)
    if (!result.ok) {
      editProjectFinanceFeedback.value = result.message
      audio.playUi('ERROR')
      return
    }
    editProjectFinanceFeedback.value = 'Financement ajouté : la modification peut être validée immédiatement.'
    actionDialog.value = null
    audio.playUi('CONFIRM')
  }
  finally { editProjectFinanceBusy.value = false }
}

const editTraceActionLabel = computed(() => {
  const line = projectLine.value
  const station = network.editSelectedStation.value
  if (!line || !station) return '↗ Tracer'
  const terminus = new Set(getLineTerminusStations(line).map(item => item.id))
  return terminus.has(station.id) ? '↗ Prolonger' : '↗ Nouvelle branche'
})

const projectForecast = computed(() => {
  const line = projectLine.value
  const save = game.state.value.save
  if (!line || !save) return null
  return buildProjectForecast(
    line,
    save.data.network,
    territory.municipalities.value,
    displayedProjectCost.value,
    displayedProjectLength.value,
  )
})

const municipalityInsights = computed<GameMapMunicipalityInsight[]>(() => {
  const save = game.state.value.save
  const developments = new Map((save?.data.municipalities?.development ?? []).map(item => [item.code, item] as const))
  const coverage = new Map(territory.summary.value.municipalities.map(item => [item.code, item] as const))
  const day = save?.data.simulationDay ?? 1
  const activeProjects = new Map<string, GameUrbanProject>()
  for (const project of save?.data.municipalities?.urbanProjects ?? []) {
    if (project.status === 'MATURE') continue
    const existing = activeProjects.get(project.municipalityCode)
    if (!existing || project.openingDay < existing.openingDay) activeProjects.set(project.municipalityCode, project)
  }
  const localEvents = new Map<string, GameLocalEvent>()
  for (const event of save?.data.municipalities?.localEvents ?? []) {
    if (event.status === 'FINISHED' || event.endsDay < day) continue
    const existing = localEvents.get(event.municipalityCode)
    if (!existing || event.startsDay < existing.startsDay) localEvents.set(event.municipalityCode, event)
  }
  return territory.municipalities.value.map(municipality => {
    const development = developments.get(municipality.code)
    const served = coverage.get(municipality.code)
    const basePopulation = Math.max(1, development?.basePopulation ?? municipality.population)
    const population = Math.max(0, development?.population ?? municipality.population)
    const fallbackAccessibility = Math.min(100, (served?.stationCount ?? 0) * 18 + (served?.lineCount ?? 0) * 12)
    const accessibility = Math.max(0, Math.min(100, development?.accessibility ?? fallbackAccessibility))
    const populationWeight = Math.max(0, Math.min(1, (Math.log10(Math.max(1, population)) - 3.2) / 2.5))
    const networkGap = Math.max(0, Math.min(1, 1 - accessibility / 100))
    const noRailBonus = (served?.lineCount ?? 0) === 0 ? 0.16 : (served?.stationCount ?? 0) === 0 ? 0.08 : 0
    const potential = Math.round(Math.max(0, Math.min(100, (populationWeight * 0.64 + networkGap * 0.36 + noRailBonus) * 100)))
    const project = activeProjects.get(municipality.code)
    const localEvent = localEvents.get(municipality.code)
    return {
      code: municipality.code,
      name: municipality.name,
      departmentCode: municipality.departmentCode,
      population,
      basePopulation,
      accessibility,
      growthRate: (population - basePopulation) / basePopulation,
      lineCount: served?.lineCount ?? 0,
      stationCount: served?.stationCount ?? 0,
      potential,
      urbanProjectTitle: project?.title,
      urbanProjectKind: project?.kind,
      urbanProjectOpeningDay: project?.openingDay,
      urbanProjectConstructionStartDay: project?.constructionStartDay,
      urbanProjectMaturityDay: project?.maturityDay,
      urbanProjectStatus: project?.status,
      localEventTitle: localEvent?.title,
      localEventKind: localEvent?.kind,
      localEventStartsDay: localEvent?.startsDay,
      localEventVisitors: localEvent?.expectedVisitors,
      localEventStatus: localEvent?.status,
      centerLongitude: (municipality.bounds.west + municipality.bounds.east) / 2,
      centerLatitude: (municipality.bounds.south + municipality.bounds.north) / 2,
    }
  })
})

const mapInsightLabel = computed(() => translateGameText(({
  NONE: 'Carte normale',
  POPULATION: 'Population',
  ACCESSIBILITY: 'Accessibilité',
  GROWTH: 'Croissance',
  POTENTIAL: 'Besoin de desserte',
  FLOW: 'Flux voyageurs',
  SATURATION: 'Saturation réseau',
}[mapInsightMode.value]), currentGameLocale()))

function cycleMapInsightMode() {
  const modes: GameMapInsightMode[] = ['NONE', 'POPULATION', 'ACCESSIBILITY', 'GROWTH', 'POTENTIAL', 'FLOW', 'SATURATION']
  const index = modes.indexOf(mapInsightMode.value)
  mapInsightMode.value = modes[(index + 1) % modes.length] ?? 'NONE'
}

function compactMetric(value: number) {
  return formatGameNumberCompact(Math.max(0, value))
}

watch(projectModeActive, active => { if (!active) projectForecastOpen.value = false })

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
const projectBorrowMaximum = computed(() => Math.max(0, economy.projectAvailableCredit.value))
const projectSuggestedBorrow = computed(() => launchShortfall.value > 0 ? Math.max(1_000_000, Math.ceil(launchShortfall.value)) : 0)
const projectFundingCanCover = computed(() => (
  projectSuggestedBorrow.value > 0
  && projectBorrowMaximum.value >= projectSuggestedBorrow.value
  && economy.insolvencyStatus.value !== 'BANKRUPT'
))
const projectProposedDebtAfter = computed(() => economy.debtPrincipal.value + projectSuggestedBorrow.value)
const projectProposedBalanceAfter = computed(() => economy.balance.value + projectSuggestedBorrow.value - launchTotalCost.value)

function borrowForActiveProject() {
  if (projectBorrowBusy.value || !projectFundingCanCover.value) return
  borrowConfirmation.value = { kind: 'PROJECT', amount: projectSuggestedBorrow.value }
}

async function applyActiveProjectBorrow(amount: number) {
  if (projectBorrowBusy.value || amount <= 0) return
  projectBorrowBusy.value = true
  projectBorrowFeedback.value = null
  try {
    const result = await economy.borrowProject(amount)
    if (!result.ok) {
      projectBorrowFeedback.value = result.message
      audio.playUi('ERROR')
      return
    }
    audio.playUi('CONFIRM')
    if (launchShortfall.value > 0) {
      projectBorrowFeedback.value = `Emprunt ajouté. Il manque encore ${money(launchShortfall.value)} pour ce projet.`
    }
    else {
      projectBorrowFeedback.value = 'Financement prêt. Vous pouvez mettre la ligne en service.'
    }
  }
  finally {
    projectBorrowBusy.value = false
  }
}

async function confirmBorrow() {
  const request = borrowConfirmation.value
  if (!request) return
  borrowConfirmation.value = null
  if (request.kind === 'EDIT') await applyEditProjectFinance(request.amount)
  else await applyActiveProjectBorrow(request.amount)
}

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
  return formatGameCurrencyCompact(value)
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
    DEPOT_CONSTRUCTION: 'Construction d’un dépôt',
    DEPOT_UPGRADE: 'Extension d’un dépôt',
    INFRASTRUCTURE_UPGRADE: 'Modernisation de l’infrastructure',
    STATION_UPGRADE: 'Amélioration de station',
    TEMPORARY_SERVICE: 'Service temporaire',
    SERVICE_REINFORCEMENT: 'Circulation de renfort',
    SERVICE_SUBSTITUTION: 'Bus de substitution',
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
  return formatGameInteger(value)
}
function toolTitle(tool: GameTool) {
  return { NETWORK: 'Réseau', FLEET: 'Matériel & dépôts', PASSENGERS: 'Voyageurs', OPERATIONS: 'PCC · Régulation', MUNICIPALITIES: 'Communes', FINANCES: 'Finances', EVENTS: 'Événements & Infos', OBJECTIVES: 'Objectifs' }[tool]
}
function persistPanelState() {
  const save = game.state.value.save
  if (!save || network.isEditing.value) return
  // État purement visuel : ne jamais sérialiser toute la métropole juste parce
  // que le joueur ouvre/ferme un panneau. Il sera inclus naturellement dans la
  // prochaine vraie sauvegarde gameplay ou dans « Sauvegarder et quitter ».
  save.data.uiState = { panelOpen: panelOpen.value, selectedPanel: selectedTool.value }
}
function selectTool(tool: GameTool) {
  selectedTool.value = tool
  panelOpen.value = true
  managementOpen.value = false
  diversOpen.value = false
  closeContextPanels()
  persistPanelState()
}
function closePanel() {
  panelOpen.value = false
  persistPanelState()
}
function openPauseMenu() { clock.pause(); menuOpen.value = true }
function openCreation(municipalityCode?: string) {
  if (challenge.readOnly.value || !onlineCanCreateLine.value) return
  audio.playUi('CLICK')
  panelOpen.value = false
  selectedVehicle.value = null
  selection.clear()
  managementOpen.value = false
  diversOpen.value = false
  closeContextPanels()
  pendingCreationMunicipalityCode.value = municipalityCode ?? null
  creationOpen.value = true
}

function handleMunicipalityBuild(code: string) {
  const municipality = territory.municipalities.value.find(item => item.code === code)
  if (!municipality) return
  openCreation(code)
}

function handleCreatedLine() {
  const code = pendingCreationMunicipalityCode.value
  pendingCreationMunicipalityCode.value = null
  if (!code) return
  const municipality = territory.municipalities.value.find(item => item.code === code)
  if (!municipality) return
  focusGameMapBounds(municipality.bounds)
}
function openOnlinePublishConfiguration() {
  if (onlineAccepted.value) {
    if (online.estAdmin.value) openOnlineAdministration()
    return
  }
  const save = game.state.value.save
  if (!save || challenge.readOnly.value) return
  onlinePublishName.value = save.name || gameName.value
  onlinePublishVisibility.value = 'privee'
  onlinePublishBudgetMode.value = 'global'
  onlinePublishEditionByDefault.value = false
  onlinePublishError.value = null
  onlinePublishOpen.value = true
}

async function publishCurrentSaveOnline() {
  const save = game.state.value.save
  if (!save || onlinePublishBusy.value || onlineAccepted.value) return
  onlinePublishBusy.value = true
  onlinePublishError.value = null
  let sessionCreated = false
  try {
    await game.persistCurrentGame()
    const currentSave = game.state.value.save
    if (!currentSave) throw new Error(translateGameText('La sauvegarde actuelle est indisponible.', currentGameLocale()))
    const mapId = currentSave.territory === 'GENERATED'
      ? `GENERATED:${currentSave.data.generatedTerritory?.seed || 'CURRENT'}`
      : currentSave.territory
    await online.creerPartie({
      nom: onlinePublishName.value.trim() || currentSave.name || 'Ma métropole',
      visibilite: onlinePublishVisibility.value,
      carte: { id: mapId, nom: startupTerritoryName.value },
      budgetInitial: Math.max(0, Number(economy.balance.value) || 0),
      budgetMode: onlinePublishBudgetMode.value,
      lectureSeuleParDefaut: !onlinePublishEditionByDefault.value,
    }, { connecter: false })
    sessionCreated = true
    online.lierSauvegardeLocale(currentSave.id)
    const initialized = await online.initialiserSynchronisationJeu(currentSave)
    if (!initialized) throw new Error(online.erreur.value || translateGameText('Impossible de préparer l’état synchronisé de la partie.', currentGameLocale()))
    online.connecterWebSocket()
    online.signalerEntreeDansPartie(currentSave)
    onlinePublishOpen.value = false
    settingsOpen.value = false
    audio.playUi('CONFIRM')
  }
  catch (cause) {
    if (sessionCreated) await online.quitterPartie()
    onlinePublishError.value = cause instanceof Error ? cause.message : translateGameText('Impossible de rendre cette partie en ligne.', currentGameLocale())
    audio.playUi('ERROR')
  }
  finally {
    onlinePublishBusy.value = false
  }
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
function openDebtFinancing() {
  if (economy.debtPrincipal.value <= 0) return
  audio.playUi('CLICK')
  actionDialog.value = null
  financeDebtFocusToken.value += 1
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

async function handleStationClick(lineId: string, stationId: string, routeCoordinates?: Array<[number, number]>) {
  if (network.isEditing.value) {
    // Mode explicite de raccordement : le clic désigne la destination et non un
    // nouveau point de reprise. Il accepte aussi une gare déjà présente sur la
    // même ligne, indispensable aux branches RER/Transilien qui se rejoignent.
    if (network.mapAction.value.kind === 'CONNECT_EXISTING') {
      const connected = network.connectExistingStation(lineId, stationId, routeCoordinates)
      if (connected) { audio.playUi('CONFIRM'); draftPreviewMetrics.value = null }
      return
    }
    if (lineId === network.editingLineId.value) {
      network.requestContinueFromStation(stationId)
      return
    }
    // Sur un pôle partagé, le marqueur peut provenir d'une autre ligne. Si la
    // station existe déjà physiquement dans la ligne en cours d'édition, on
    // sélectionne sa copie locale au lieu de tenter de recréer la correspondance.
    const sourceLine = network.lines.value.find(item => item.id === lineId)
    const sourceStation = sourceLine ? findLineStation(sourceLine, stationId) : null
    const sharedId = sourceStation?.sharedStationId ?? sourceStation?.id
    const localSharedStation = sharedId && network.editDraft.value
      ? getLineAllStations(network.editDraft.value).find(item => (item.sharedStationId ?? item.id) === sharedId)
      : null
    if (localSharedStation) {
      network.requestContinueFromStation(localSharedStation.id)
      return
    }
    const linked = await network.useExistingStation(lineId, stationId, routeCoordinates)
    if (linked) return
    return
  }
  if (network.isBuilding.value) {
    const linked = await network.useExistingStation(lineId, stationId, routeCoordinates)
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

function handleStationNameKeydown(event: KeyboardEvent) {
  // Le champ de nommage est un vrai contexte de saisie : aucun raccourci du jeu
  // ne doit intercepter Ctrl/Cmd+A, Ctrl/Cmd+Z, etc. On ne bloque pas l'action
  // native du navigateur afin que Ctrl+A sélectionne bien tout le texte.
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    void confirmStationName()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    void cancelStationName()
  }
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
  if (challenge.readOnly.value || simulation.isAdvancing.value) return
  if (onlineSimulationReplica.value) {
    if (online.peut('gerer_temps_simulation')) online.demanderJourSuivant()
    return
  }
  const report = await simulation.advanceDay()
  if (!report) { audio.playUi('ERROR'); return }
  clock.resetCycle()
  audio.playUi('EVENT')
}
function openOnlineChat() {
  online.ouvrirPanneau('CHAT')
}

function openOnlineAdministration() {
  menuOpen.value = false
  online.ouvrirPanneau('ADMIN')
}

async function saveGame() {
  if (isSaving.value || (onlineAccepted.value && !online.estAdmin.value)) return
  isSaving.value = true
  try {
    const saveId = game.state.value.save?.id
    const thumbnail = saveId ? captureGameMapThumbnail(saveId) : Promise.resolve(null)
    await game.persistCurrentGame()
    await thumbnail
  }
  finally { isSaving.value = false }
}
async function abandonActiveProject() {
  const locale = currentGameLocale()
  const confirmed = await gameDialogs.confirm(
    translateGameText('Le tracé, les stations et les réglages de ce nouveau projet seront supprimés.', locale),
    {
      title: translateGameText('Abandonner ce projet ?', locale),
      confirmLabel: translateGameText('Abandonner le projet', locale),
      cancelLabel: translateGameText('Continuer le tracé', locale),
      tone: 'DANGER',
    },
  )
  if (confirmed) network.cancelActiveLine()
}

async function cancelCurrentLineEdit() {
  if (!network.canUndoDraft.value) {
    network.cancelLineEdit()
    return
  }
  const locale = currentGameLocale()
  const confirmed = await gameDialogs.confirm(
    translateGameText('Les modifications de tracé non validées seront abandonnées. La ligne actuellement en service restera inchangée.', locale),
    {
      title: translateGameText('Annuler les modifications ?', locale),
      confirmLabel: translateGameText('Annuler les modifications', locale),
      cancelLabel: translateGameText('Continuer la modification', locale),
      tone: 'DANGER',
    },
  )
  if (confirmed) network.cancelLineEdit()
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

  if (onlineAccepted.value) {
    const locale = currentGameLocale()
    const confirmed = online.estAdmin.value
      ? await gameDialogs.confirm(
          translateGameText('Votre métropole sera sauvegardée localement, mais la session en ligne sera terminée immédiatement pour tous les joueurs.', locale),
          {
            title: translateGameText('Fermer la partie en ligne', locale),
            confirmLabel: translateGameText('Sauvegarder et fermer', locale),
            cancelLabel: translateGameText('Annuler', locale),
            tone: 'DANGER',
          },
        )
      : await gameDialogs.confirm(
          translateGameText('Vous quitterez la session et cette métropole ne sera pas conservée dans vos sauvegardes. Vous pourrez la rejoindre de nouveau si la partie est toujours ouverte.', locale),
          {
            title: translateGameText('Quitter cette partie en ligne ?', locale),
            confirmLabel: translateGameText('Quitter', locale),
            cancelLabel: translateGameText('Annuler', locale),
            tone: 'DANGER',
          },
        )
    if (!confirmed) return
  }

  isSaving.value = true
  try {
    if (onlineAccepted.value) {
      if (online.estAdmin.value) {
        // Le créateur conserve la vraie sauvegarde locale, puis ferme la session
        // serveur. Revenir Online plus tard créera une nouvelle session/code.
        const saveId = game.state.value.save?.id
        const thumbnail = saveId ? captureGameMapThumbnail(saveId) : Promise.resolve(null)
        await game.persistCurrentGame()
        await thumbnail
        await online.quitterPartie()
        menuOpen.value = false
        game.returnHome()
      }
      else {
        // Un participant ne garde jamais la métropole de l'hôte en Solo. On
        // détruit d'abord l'état/copie locale éventuelle, puis on ferme sa
        // présence serveur. Ainsi le nettoyage de la session Online ne peut
        // jamais rendre cette sauvegarde éligible à une persistance tardive.
        menuOpen.value = false
        await game.discardCurrentGame()
        await online.quitterPartie()
      }
      return
    }

    const saveId = game.state.value.save?.id
    const thumbnail = saveId ? captureGameMapThumbnail(saveId) : Promise.resolve(null)
    await game.persistCurrentGame()
    await thumbnail
    menuOpen.value = false
    game.returnHome()
  }
  finally { isSaving.value = false }
}

function closeContextPanels() {
  actionsOpen.value = false
  assistantOpen.value = false
  lineVisibilityOpen.value = false
}

function toggleLineVisibilityPanel() {
  lineVisibilityOpen.value = !lineVisibilityOpen.value
  if (lineVisibilityOpen.value) {
    actionsOpen.value = false
    assistantOpen.value = false
    managementOpen.value = false
    diversOpen.value = false
    panelOpen.value = false
    persistPanelState()
  }
}

function toggleLineDimmed(lineId: string) {
  dimmedLineIds.value = dimmedLineIds.value.includes(lineId)
    ? dimmedLineIds.value.filter(id => id !== lineId)
    : [...dimmedLineIds.value, lineId]
}

function restoreAllLineVisibility() {
  dimmedLineIds.value = []
}

function dimAllLines() {
  dimmedLineIds.value = lineVisibilityChoices.value.map(line => line.id)
}

function toggleManagementHub() {
  managementOpen.value = !managementOpen.value
  if (managementOpen.value) {
    diversOpen.value = false
    closeContextPanels()
    creationOpen.value = false
    panelOpen.value = false
    persistPanelState()
  }
}

function toggleDiversHub() {
  diversOpen.value = !diversOpen.value
  if (diversOpen.value) {
    managementOpen.value = false
    closeContextPanels()
    creationOpen.value = false
    panelOpen.value = false
    persistPanelState()
  }
}

function toggleActionsPanel() {
  actionsOpen.value = !actionsOpen.value
  if (actionsOpen.value) {
    assistantOpen.value = false
    managementOpen.value = false
    diversOpen.value = false
    panelOpen.value = false
    persistPanelState()
  }
}

function toggleAssistantPanel() {
  assistantOpen.value = !assistantOpen.value
  if (assistantOpen.value) {
    actionsOpen.value = false
    managementOpen.value = false
    diversOpen.value = false
    panelOpen.value = false
    persistPanelState()
  }
}

function handleGameShellPointerDown(event: PointerEvent) {
  if (!actionsOpen.value && !assistantOpen.value && !lineVisibilityOpen.value) return
  const target = event.target instanceof HTMLElement ? event.target : null
  if (!target) return
  if (target.closest('.map-context-dock, .assistant-panel, .world-pulse, .line-visibility-panel')) return
  closeContextPanels()
}

function handlePlannerChange(open: boolean) {
  routePlannerOpen.value = open
  if (!open) return
  managementOpen.value = false
  diversOpen.value = false
  closeContextPanels()
  creationOpen.value = false
  panelOpen.value = false
  persistPanelState()
}

function dismissWorldPulse(item: GameWorldPulseItem) {
  const key = worldPulseCooldownKey(item)
  const until = simulation.day.value + worldPulseDismissDuration(item) - 1
  dismissedWorldPulseUntilDay.value = { ...dismissedWorldPulseUntilDay.value, [key]: until }
  persistWorldPulseDismissals()
}

function focusWorldPulse(item: GameWorldPulseItem) {
  audio.playUi('CLICK')
  if (item.stationId && item.lineId) {
    const line = network.lines.value.find(candidate => candidate.id === item.lineId)
    const station = line ? getLineAllStations(line).find(candidate => candidate.id === item.stationId) : null
    if (station) {
      selection.selectStation(line!.id, station.id)
      actionsOpen.value = false
      focusGameMapPoint(station.longitude, station.latitude, 15)
      return
    }
  }
  if (item.lineId) {
    const line = network.lines.value.find(candidate => candidate.id === item.lineId)
    if (line) {
      selection.selectLine(line.id)
      actionsOpen.value = false
      focusGameMapLine(line)
      return
    }
  }
  if (item.municipalityCode) {
    const municipality = territory.municipalities.value.find(candidate => candidate.code === item.municipalityCode)
    if (municipality) {
      actionsOpen.value = false
      focusGameMapBounds(municipality.bounds)
      return
    }
  }
  // Certaines actions (énergie, finances, objectifs…) n'ont pas de point précis
  // sur la carte. « Voir » doit quand même produire un résultat visible.
  if (item.panel) {
    actionsOpen.value = false
    selectTool(item.panel)
  }
}

function manageWorldPulse(item: GameWorldPulseItem) {
  if (item.intent === 'CREATE_LINE') { openCreation(); return }
  if (item.localEventId) {
    openEventPreparation(item.localEventId, item.lineId)
    return
  }
  focusWorldPulse(item)
  if (item.panel) selectTool(item.panel)
}

function safeDownloadPart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'Metropole'
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function currentTerritoryExportLabel() {
  const save = game.state.value.save
  if (!save) return 'Métropole'
  if (save.territory === 'GENERATED') return save.data.generatedTerritory?.name || 'Carte fictive'
  return getGameTerritoryCatalogEntry(save.territory).label
}

const sharePhysicalStationCount = computed(() => {
  const ids = new Set<string>()
  for (const line of network.lines.value) {
    if (line.status === 'PROJECT') continue
    for (const station of getLineAllStations(line)) ids.add(station.sharedStationId || station.id)
  }
  return ids.size
})

const shareLineCount = computed(() => network.lines.value.filter(line => line.status !== 'PROJECT' && getLineAllStations(line).length > 0).length)

async function exportCurrentWorldSave() {
  const save = game.state.value.save
  if (!save || exportingWorldSave.value || typeof document === 'undefined') return
  if (onlineAccepted.value && !online.estAdmin.value) {
    diversError.value = translateGameText('L’export complet de la sauvegarde est réservé à l’administrateur de la partie en ligne.', currentGameLocale())
    audio.playUi('ERROR')
    return
  }
  exportingWorldSave.value = true
  diversFeedback.value = null
  diversError.value = null
  try {
    await game.persistCurrentGame()
    const exported = await game.exportSave(save.id)
    downloadBlob(new Blob([exported.content], { type: 'application/json;charset=utf-8' }), exported.filename)
    diversFeedback.value = 'Sauvegarde exportée avec ses métadonnées de monde.'
    audio.playUi('CONFIRM')
  }
  catch (error) {
    diversError.value = error instanceof Error ? error.message : 'Impossible d’exporter la sauvegarde.'
    audio.playUi('ERROR')
  }
  finally { exportingWorldSave.value = false }
}

function openWorldImageExport() {
  diversOpen.value = false
  worldExportOpen.value = true
}

async function exportWorldImage(options: GameWorldExportOptions) {
  const save = game.state.value.save
  if (!save || worldExportBusy.value) return
  worldExportBusy.value = true
  try {
    const model = buildWorldExportModel(
      { ...save.data.network, lines: network.lines.value },
      {
        name: save.name,
        day: simulation.day.value,
        passengers: simulation.lastDayReport.value?.passengers ?? 0,
        balance: economy.balance.value,
        territoryLabel: currentTerritoryExportLabel(),
      },
      territory.municipalities.value,
    )
    const blob = await renderWorldExportPng(model, options)
    downloadBlob(blob, `CLU-Metropole_${safeDownloadPart(save.name)}_Jour-${simulation.day.value}.png`)
    worldExportOpen.value = false
    diversFeedback.value = 'Image du monde exportée en PNG.'
    audio.playUi('CONFIRM')
  }
  catch (error) {
    diversError.value = error instanceof Error ? error.message : 'Impossible de générer l’image du monde.'
    audio.playUi('ERROR')
  }
  finally { worldExportBusy.value = false }
}

function openEditorExport() {
  diversOpen.value = false
  editorExportOpen.value = true
}

async function exportLineToEditor(lineId: string) {
  const save = game.state.value.save
  const line = network.lines.value.find(candidate => candidate.id === lineId)
  if (!save || !line || editorExportBusy.value) return
  editorExportBusy.value = true
  try {
    const currentNetwork = { ...save.data.network, lines: network.lines.value }
    const result = buildCluEditorProject(line, currentNetwork)
    const content = serializeCluEditorProject(line, currentNetwork)
    downloadBlob(new Blob([content], { type: 'application/json;charset=utf-8' }), `CLU-Editor_${safeDownloadPart(line.shortCode || line.name)}_${safeDownloadPart(line.name)}.json`)
    editorExportOpen.value = false
    diversFeedback.value = result.warnings.length
      ? `Projet Editor exporté · ${result.stationCount} stations · ${result.branchCount} branche(s). ${result.warnings.join(' ')}`
      : `Projet Editor exporté · ${result.stationCount} stations · ${result.interchangeCount} correspondance(s).`
    audio.playUi('CONFIRM')
  }
  catch (error) {
    diversError.value = error instanceof Error ? error.message : 'Impossible de convertir cette ligne vers CLU Editor.'
    audio.playUi('ERROR')
  }
  finally { editorExportBusy.value = false }
}

function handleDraftHistoryShortcut(event: KeyboardEvent) {
  if (!(network.isBuilding.value || network.isEditing.value) || bilanOpen.value || settingsOpen.value || menuOpen.value || network.pendingStationNaming.value) return
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
  if (validation.ok === false && validation.code !== 'INSUFFICIENT_FUNDS') {
    audio.playUi('ERROR')
    actionDialog.value = {
      title: 'Conception impossible à valider',
      message: validation.message,
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
  projectBorrowFeedback.value = null
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
  if (!line || !config || launchCommitBusy.value) return
  if (launchShortfall.value > 0) {
    audio.playUi('ERROR')
    projectBorrowFeedback.value = `Il manque ${money(launchShortfall.value)}. Validez ou refusez l’emprunt proposé ci-dessous.`
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
  let committed = false
  launchCommitBusy.value = true

  try {
    await game.batchCurrentGamePersistence(async () => {
      // Tous ces réglages mutent immédiatement l’état en mémoire. Le batch évite
      // cependant une écriture IndexedDB complète après chaque clic/niveau :
      // 5 améliorations en 3/3 pouvaient auparavant déclencher 15 sauvegardes,
      // auxquelles s’ajoutaient service, maintenance, parc, régulation et lancement.
      // Les quatre mutations ci-dessous sont déclenchées dans le même tour de
      // boucle puis attendues ensemble. En mode batch, persistCurrentGame() ne
      // fait aucune I/O ici : cela laisse Vue regrouper service, maintenance,
      // régulation et parc dans un seul cycle réactif au lieu de quatre.
      const serviceUpdate = network.setLineServiceLevel(line.id, config.serviceLevel)
      const maintenanceUpdate = maintenance.setLevel(line.id, config.maintenanceLevel)
      const regulationUpdate = rollingStock.setRegulationMode(line.id, config.regulationMode)
      const fleetUpdate = rollingStock.setFleetSize(line.id, config.vehicleCount)
      const [, , , fleetOk] = await Promise.all([
        serviceUpdate,
        maintenanceUpdate,
        regulationUpdate,
        fleetUpdate,
      ])
      if (!fleetOk) {
        audio.playUi('ERROR')
        actionDialog.value = { title: 'Matériel roulant', message: 'Le parc choisi n’a pas pu être financé. Vérifiez votre trésorerie.' }
        return
      }

      const upgradeResult = await rollingStock.upgradeToLevels(line.id, config.rollingStockUpgrades)
      if (!upgradeResult.ok) {
        const failedUpgrade = rollingStock.upgradeDefinitions.find(item => item.key === upgradeResult.key)
        audio.playUi('ERROR')
        actionDialog.value = {
          title: 'Configuration du matériel',
          message: `Impossible d’appliquer l’amélioration « ${failedUpgrade?.label ?? upgradeResult.key ?? 'Matériel roulant'} ». Le projet reste en conception et les achats déjà effectués sont conservés.`,
        }
        return
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

      // Fermer la préparation AVANT l’unique écriture IndexedDB finale.
      // persistCurrentGameNow() laisse ensuite une frame à Vue : la ligne apparaît
      // donc mise en service immédiatement au lieu de garder cette modale figée.
      launchConfigOpen.value = false
      launchConfig.value = null
      committed = true
    })

    if (!committed) return

    audio.playUi('CONFIRM')
    draftPreviewMetrics.value = null
    assistant.push(
      'Ligne mise en service',
      '{line} est financée, équipée et ouverte immédiatement aux voyageurs. Les coûts restent réels, mais CLU ne vous impose aucune attente artificielle avant de continuer à construire.',
      simulation.day.value,
      projectBeforeValidation.id,
      projectBeforeValidation.name,
      { line: projectBeforeValidation.name },
    )
    actionDialog.value = {
      title: 'Ligne mise en service',
      message: `« ${projectBeforeValidation.name} » est ouverte immédiatement avec le niveau de service, le parc et les améliorations choisis.`,
    }
  }
  finally {
    launchCommitBusy.value = false
  }
}

async function validateLineEdit() {
  const result = await network.commitLineEditDetailed()
  if (result.ok === false) {
    audio.playUi('ERROR')
    if (result.code === 'INSUFFICIENT_FUNDS') editProjectFinanceFeedback.value = result.message
    actionDialog.value = {
      title: result.code === 'INSUFFICIENT_FUNDS' ? 'Financement de la modification' : 'Modification impossible',
      message: result.code === 'INSUFFICIENT_FUNDS'
        ? `${result.message} Vous pouvez financer directement cette modification sans quitter le tracé.`
        : result.message,
      financeEdit: result.code === 'INSUFFICIENT_FUNDS',
    }
  }
  else {
    audio.playUi('CONFIRM')
    editProjectFinanceFeedback.value = null
    draftPreviewMetrics.value = null
  }
}


watch(
  () => network.lines.value.map(line => `${line.id}:${line.status}:${line.constructionDaysRemaining ?? 0}`).join('|'),
  () => {
    const previous = knownLineStatuses.value
    const next: Record<string, string> = {}
    for (const line of network.lines.value) {
      next[line.id] = line.status
      if (previous[line.id] === 'CONSTRUCTION' && line.status === 'OPERATIONAL') {
        assistant.push(
          'Ligne ouverte',
          '{line} est prête : les travaux sont terminés et la ligne est désormais ouverte aux voyageurs.',
          simulation.day.value,
          line.id,
          line.name,
          { line: line.name },
        )
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
      assistant.push(
        'Demande communale satisfaite',
        '{municipality} confirme que la demande est satisfaite. Aide accordée : {amount}.',
        simulation.day.value,
        undefined,
        undefined,
        { municipality: request.municipalityName, amount: money(request.subsidyAmount) },
      )
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
      assistant.push(
        'Objectif accompli',
        '{objective} est accompli. Récompense : {amount}.',
        simulation.day.value,
        undefined,
        undefined,
        { objective: objective.title, amount: money(objective.reward ?? 0) },
      )
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

    assistant.push(
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
  },
)

watch(
  [menuOpen, settingsOpen, () => help.wikiOpen.value],
  values => { if (values.some(Boolean)) clock.pause() },
)

watch(
  [() => network.isBuilding.value, () => network.isEditing.value, () => network.mapAction.value],
  () => { draftPreviewMetrics.value = null },
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

const mapOverlayNetworkRevision = computed(() => network.displayLines.value
  .map(line => `${line.id}:${line.updatedAt}:${line.status}`)
  .join('|'))

watch(
  [
    mapOverlayNetworkRevision,
    () => selection.selectedLineId.value,
    () => network.activeLineId.value,
    () => network.editingLineId.value,
    () => dimmedLineIds.value.join('|'),
  ],
  () => syncGameMapOverlay(network.displayLines.value, {
    selectedLineId: selection.selectedLineId.value,
    activeLineId: network.activeLineId.value,
    editingLineId: network.editingLineId.value,
    dimmedLineIds: dimmedLineIds.value,
  }),
  { immediate: true },
)

watch(
  () => network.lines.value.map(line => line.id).join('|'),
  () => {
    const currentIds = new Set(network.lines.value.map(line => line.id))
    dimmedLineIds.value = dimmedLineIds.value.filter(id => currentIds.has(id))
  },
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

function handleBuildRejected(message: string) {
  buildWarning.value = message
  if (buildWarningTimer) clearTimeout(buildWarningTimer)
  buildWarningTimer = setTimeout(() => { buildWarning.value = null }, 4200)
  audio.playUi('ERROR')
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
  if (onlineAccepted.value) {
    const admin = online.estAdmin.value
    if (!admin) {
      void game.discardCurrentGame().finally(() => { void online.quitterPartie() })
    } else {
      void online.quitterPartie().finally(() => game.returnHome())
    }
    return
  }
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
  if (eventPreparationEventId.value) { closeEventPreparation(); event.preventDefault(); return }
  if (launchConfigOpen.value) { launchConfigOpen.value = false; event.preventDefault(); return }
  if (network.pendingStationNaming.value) { cancelStationName(); event.preventDefault(); return }
  if (network.isEditing.value && network.mapAction.value.kind !== 'NONE') { network.clearEditMapAction(); event.preventDefault(); return }
  if (creationOpen.value) { creationOpen.value = false; event.preventDefault(); return }
  if (actionsOpen.value) { actionsOpen.value = false; event.preventDefault(); return }
  if (assistantOpen.value) { assistantOpen.value = false; event.preventDefault(); return }
  if (managementOpen.value) { managementOpen.value = false; event.preventDefault(); return }
  if (diversOpen.value) { diversOpen.value = false; event.preventDefault(); return }
  if (menuOpen.value) { menuOpen.value = false; event.preventDefault() }
}

const modalSignals = computed(() => [
  creationOpen.value,
  Boolean(network.pendingStationNaming.value),
  Boolean(actionDialog.value),
  Boolean(eventPreparationEventId.value),
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

function scheduleSaveThumbnailWarmup() {
  if (onlineAccepted.value && !online.estAdmin.value) return
  const saveId = game.state.value.save?.id
  if (!saveId) return
  for (const timer of saveThumbnailWarmupTimers) clearTimeout(timer)
  saveThumbnailWarmupTimers = [
    setTimeout(() => { void captureGameMapThumbnail(saveId) }, 1600),
    setTimeout(() => { void captureGameMapThumbnail(saveId) }, 4200),
  ]
}

watch(
  [gameplayReady, onlineAccepted, () => game.state.value.save?.id],
  ([ready, accepted]) => {
    const save = game.state.value.save
    if (ready && accepted && save) online.signalerEntreeDansPartie(save)
  },
  { immediate: true },
)

watch(
  () => online.commandeSimulation.value,
  commande => {
    if (!commande || !online.estAdmin.value || commande.commande !== 'jour_suivant') return
    void advanceDay()
  },
)

onMounted(async () => {
  // Une session Online n'est plus restaurée depuis une sauvegarde locale.
  // Elle existe uniquement pendant l'hébergement courant du créateur.
  loadWorldPulseDismissals()
  help.initialize()
  if (
    userSettings.value.tutorialEnabled
    && !challenge.isChallenge.value
    && !help.tutorial.value.startedAt
    && !help.tutorial.value.completed
    && simulation.day.value <= 1
    && network.lines.value.length === 0
  ) {
    help.startTutorial(simulation.day.value, network.lines.value.length)
  }
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
    dimmedLineIds: dimmedLineIds.value,
  })
  window.addEventListener('clu-map-line-select', handleBridgeLineSelect as EventListener)
  window.addEventListener('clu-map-station-select', handleBridgeStationSelect as EventListener)
  window.addEventListener('clu-open-network-line', handleOpenNetworkLine as EventListener)
  window.addEventListener('keydown', handleDraftHistoryShortcut)
  window.addEventListener('keydown', handleAccessibilityKeydown)
  scheduleSaveThumbnailWarmup()
})

onUnmounted(() => {
  for (const timer of saveThumbnailWarmupTimers) clearTimeout(timer)
  saveThumbnailWarmupTimers = []
  challenge.stopClock()
  clock.stop()
  if (financialPulseTimer) clearTimeout(financialPulseTimer)
  if (buildWarningTimer) clearTimeout(buildWarningTimer)
  window.removeEventListener('clu-map-line-select', handleBridgeLineSelect as EventListener)
  window.removeEventListener('clu-map-station-select', handleBridgeStationSelect as EventListener)
  window.removeEventListener('clu-open-network-line', handleOpenNetworkLine as EventListener)
  window.removeEventListener('keydown', handleDraftHistoryShortcut)
  window.removeEventListener('keydown', handleAccessibilityKeydown)
  clearGameMapOverlay()
})
</script>

<template>
  <main ref="gameShellRef" class="game-shell" @pointerdown="handleGameShellPointerDown">
    <GameMap
      :key="mapInstanceKey"
      :lines="network.displayLines.value"
      :dimmed-line-ids="dimmedLineIds"
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
      :depots="game.state.value.save?.data.network.depots ?? []"
      :vehicles="challenge.readOnly.value || !userSettings.vehicleAnimations || userSettings.reducedMotion ? [] : transitRuntime.vehicles.value"
      :show-vehicle-animations="!challenge.readOnly.value && userSettings.vehicleAnimations && !userSettings.reducedMotion"
      :simulation-playing="clock.playing.value"
      :show-buildings-2d5="userSettings.buildings2D5"
      :graphics-quality="userSettings.graphicsQuality"
      :municipality-insights="municipalityInsights"
      :line-reports="simulation.lastDayReport.value?.lines ?? []"
      :insight-mode="mapInsightMode"
      :operations-disruptions="operations.activeDisruptions.value"
      :substitution-services="operations.activeSubstitutions.value"
      :project-municipality-codes="projectForecast?.municipalityCodes ?? []"
      @map-click="handleMapClick"
      @draft-preview="handleDraftPreview"
      @line-click="handleLineClick"
      @station-click="handleStationClick"
      @vehicle-click="handleVehicleClick"
      @loading-progress="handleMapLoadingProgress"
      @ready="handleMapReady"
      @load-error="handleMapLoadError"
      @build-rejected="handleBuildRejected"
      @municipality-build="handleMunicipalityBuild"
      @overlay-change="mapOverlayOpen = $event"
    />

    <div v-if="buildWarning" class="build-warning" role="status" aria-live="polite">
      <strong>Tracé refusé</strong><span>{{ buildWarning }}</span>
    </div>

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


    <header v-if="!projectModeActive" class="topbar topbar--brand">
      <div class="brand"><b>CLU</b><span><strong data-i18n-skip>{{ gameName }}</strong><small>{{ gameModeLabel }}</small></span></div>
    </header>

    <header v-if="!projectModeActive" class="topbar topbar--stats">
      <div v-if="challenge.isChallenge.value" class="challenge-clock" :class="{ ended: challenge.readOnly.value }"><small>{{ challenge.readOnly.value ? 'Défi terminé' : 'Temps restant' }}</small><strong>{{ challenge.readOnly.value ? 'LECTURE SEULE' : challenge.formatTime() }}</strong></div>
      <div class="top-kpis">
        <span class="budget-kpi"><small>Budget</small><strong :class="{ debt: !economy.unlimitedMoney.value && economy.balance.value < 0, 'money-in': financialPulse?.amount > 0, 'money-out': financialPulse?.amount < 0 }">{{ economy.unlimitedMoney.value ? '∞' : money(economy.balance.value) }}</strong><em v-if="financialPulse" :key="financialPulse.id" class="financial-pulse" :class="{ positive: financialPulse.amount > 0, negative: financialPulse.amount < 0 }" role="status" aria-live="polite" :title="financialPulse.reason">{{ financialPulse.amount > 0 ? '+' : '−' }}{{ money(Math.abs(financialPulse.amount)) }}</em></span>
        <button v-if="!economy.unlimitedMoney.value && economy.debtPrincipal.value > 0" class="debt-kpi-button" type="button" title="Ouvrir Finances · Financement & dette" aria-label="Ouvrir le financement et la dette" @click="openDebtFinancing"><small>Dette</small><strong>−{{ money(economy.debtPrincipal.value) }}</strong></button>
        <span class="passengers-kpi"><small>Voyageurs total</small><strong>{{ formatGameNumberCompact(simulation.lastDayReport.value?.passengers ?? 0) }}</strong></span>
        <span class="morale-kpi" :class="moraleUi.tone" :title="moraleUi.label"><small>Moral · {{ moraleUi.label }}</small><strong>{{ moraleUi.emoji }} {{ Math.round(simulation.networkMoraleScore.value) }}/100</strong></span>
      </div>
      <button class="menu-button" type="button" aria-label="Ouvrir le menu de pause" aria-haspopup="dialog" @click="openPauseMenu">☰</button>
    </header>

    <section v-if="!challenge.readOnly.value && (network.activeLine.value || network.editDraft.value)" class="project-dock project-dock--topbar project-dock--compact" :class="{ warning: !projectValidation.ok || previewBudgetExceeded, 'edit-focus': network.isEditing.value, 'edit-selected': Boolean(network.editSelectedStation.value) }">
      <div class="project-summary-row">
        <div class="project-copy" :title="projectInstruction">
          <span class="project-kicker">{{ network.activeLine.value ? 'Conception de la ligne' : 'Modification du tracé' }}</span>
          <strong data-i18n-skip>{{ network.activeLine.value?.name ?? network.editDraft.value?.name }}</strong>
          <small>{{ projectInstruction }}</small>
        </div>

        <div class="project-stats project-stats--inline" aria-label="Résumé du projet">
          <span><small>Stations</small><b>{{ projectLine ? getLineAllStations(projectLine).length : 0 }}</b></span>
          <span><small>Longueur</small><b>{{ displayedProjectLength.toFixed(1) }} km</b></span>
          <span :class="{ 'project-preview-over': previewBudgetExceeded }"><small>Prix</small><b>{{ money(displayedProjectCost) }}</b></span>
          <span v-if="projectLine"><small>Repère</small><b>{{ money(economy.modeCosts(projectLine.mode).infrastructurePerKm) }}/km</b></span>
          <span v-if="!projectValidation.ok" class="project-warning"><small>État</small><b>Action requise</b></span>
        </div>

        <template v-if="network.activeLine.value">
          <div class="project-routing-actions project-routing-actions--inline project-routing-actions--creation">
            <span><small>Tracé</small><b>{{ projectRoutingLabel }}</b></span>
            <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectRailAutoActive }" :aria-pressed="projectRailAutoActive" title="Voies ferrées uniquement : suit le réseau ferré même si le détour est important" @click="network.setDraftRoutingMode(projectRailAutoMode)">Rail auto</button>
            <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectLightAssistActive }" :aria-pressed="projectLightAssistActive" title="Suit les corridors adaptés au mode tout en autorisant un nouveau tracé hors des infrastructures existantes" @click="network.setDraftRoutingMode(projectLightAssistMode)">Aide légère</button>
            <span v-if="projectRoutingLocked" class="project-routing-lock">{{ projectRoutingLockLabel }}</span>
            <button v-else type="button" :class="{ active: projectLine?.routingMode === 'FREE' }" :aria-pressed="projectLine?.routingMode === 'FREE'" title="Relie librement les points" @click="network.setDraftRoutingMode('FREE')">Libre</button>
            <button type="button" :class="{ active: network.routeGuideMode.value }" :aria-pressed="network.routeGuideMode.value" title="Ajouter un point de passage sans créer de station" @click="network.toggleRouteGuideMode()">{{ projectGuideLabel }}</button>
          </div>
          <div class="project-buttons project-buttons--inline project-buttons--creation">
            <button class="project-forecast-trigger" type="button" :class="{ active: projectForecastOpen }" title="Voir la population, la demande et les correspondances estimées" @click="projectForecastOpen = !projectForecastOpen">◎ Prévision</button>
            <div class="project-history-actions" aria-label="Historique du tracé">
              <button type="button" :disabled="!network.canUndoDraft.value" title="Avant · Ctrl+Z" @click="network.undoDraft()">←</button>
              <button type="button" :disabled="!network.canRedoDraft.value" title="Après · Ctrl+Y" @click="network.redoDraft()">→</button>
            </div>
            <button class="project-primary" type="button" @click="validateActiveProject">Mettre en service</button>
            <button class="project-cancel" type="button" @click="abandonActiveProject">Abandonner</button>
          </div>
        </template>

        <template v-else-if="!network.editSelectedStation.value">
          <div class="project-edit-secondary-tools project-edit-secondary-tools--summary">
            <button type="button" class="project-insert-action" :class="{ active: network.mapAction.value.kind === 'INSERT_ON_TRACE' }" title="Ajouter un arrêt directement sur le tracé existant" @click="network.requestInsertOnTrace()">＋ Sur le tracé</button>
            <div class="project-routing-actions project-routing-actions--inline">
              <span><small>Tracé</small><b>{{ projectRoutingLabel }}</b></span>
              <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectRailAutoActive }" :aria-pressed="projectRailAutoActive" title="Voies ferrées uniquement : suit le réseau ferré même si le détour est important" @click="network.setDraftRoutingMode(projectRailAutoMode)">Rail auto</button>
              <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectLightAssistActive }" :aria-pressed="projectLightAssistActive" title="Suit les corridors adaptés au mode tout en autorisant un nouveau tracé hors des infrastructures existantes" @click="network.setDraftRoutingMode(projectLightAssistMode)">Aide légère</button>
              <span v-if="projectRoutingLocked" class="project-routing-lock">{{ projectRoutingLockLabel }}</span>
            <button v-else type="button" :class="{ active: projectLine?.routingMode === 'FREE' }" :aria-pressed="projectLine?.routingMode === 'FREE'" title="Relie librement les points" @click="network.setDraftRoutingMode('FREE')">Libre</button>
            <button type="button" :class="{ active: network.routeGuideMode.value }" :aria-pressed="network.routeGuideMode.value" title="Ajouter un point de passage sans créer de station" @click="network.toggleRouteGuideMode()">{{ projectGuideLabel }}</button>
            </div>
          </div>
          <div class="project-buttons project-buttons--inline project-buttons--edit">
            <button class="project-forecast-trigger" type="button" :class="{ active: projectForecastOpen }" title="Voir la population, la demande et les correspondances estimées" @click="projectForecastOpen = !projectForecastOpen">◎ Prévision</button>
            <div class="project-history-actions" aria-label="Historique du tracé">
              <button type="button" :disabled="!network.canUndoDraft.value" title="Avant · Ctrl+Z" @click="network.undoDraft()">←</button>
              <button type="button" :disabled="!network.canRedoDraft.value" title="Après · Ctrl+Y" @click="network.redoDraft()">→</button>
            </div>
            <button v-if="editProjectShortfall > 0" class="project-finance-inline" type="button" :disabled="editProjectFinanceBusy || economy.insolvencyStatus.value === 'BANKRUPT'" @click="financeEditProject">{{ editProjectFinanceBusy ? 'Financement…' : `Financer ${money(editProjectShortfall)}` }}</button><button class="project-primary" type="button" @click="validateLineEdit">Valider</button>
            <button class="project-cancel" type="button" @click="cancelCurrentLineEdit">Annuler</button>
          </div>
        </template>

        <div class="project-global-kpis project-global-kpis--inline" aria-label="État de la métropole">
          <span class="budget-kpi" title="Budget"><small>Budget</small><strong :class="{ debt: !economy.unlimitedMoney.value && economy.balance.value < 0 }">{{ economy.unlimitedMoney.value ? '∞' : money(economy.balance.value) }}</strong></span>
          <span title="Voyageurs"><small>Voyageurs</small><strong>{{ formatGameNumberCompact(simulation.lastDayReport.value?.passengers ?? 0) }}</strong></span>
          <span class="morale-kpi" :class="moraleUi.tone" :title="`Moral · ${moraleUi.label}`"><small>Moral</small><strong>{{ moraleUi.emoji }} {{ Math.round(simulation.networkMoraleScore.value) }}</strong></span>
        </div>
      </div>

      <div v-if="!network.activeLine.value && network.editSelectedStation.value" class="project-tools-row">
        <div class="project-edit-actions project-edit-actions--inline">
          <span class="selected-edit-station"><small>Arrêt</small><b data-i18n-skip>{{ network.editSelectedStation.value.name }}</b></span>
          <button type="button" :class="{ active: ['APPEND','PREPEND','CREATE_BRANCH','APPEND_BRANCH'].includes(network.mapAction.value.kind) }" title="Continuer le tracé depuis cet arrêt" @click="network.requestContinueFromStation(network.editSelectedStation.value.id)">{{ editTraceActionLabel }}</button>
          <button type="button" :class="{ active: network.mapAction.value.kind === 'CONNECT_EXISTING' }" title="Raccorder ce point à une gare existante, y compris une gare déjà utilisée par cette ligne" @click="network.mapAction.value.kind === 'CONNECT_EXISTING' ? network.clearEditMapAction() : network.requestConnectExistingStation(network.editSelectedStation.value.id)">⇢ Raccorder</button>
          <button type="button" :class="{ active: network.mapAction.value.kind === 'MOVE' }" title="Déplacer cet arrêt" @click="network.requestMoveStation(network.editSelectedStation.value.id)">✥ Déplacer</button>
          <button type="button" class="danger-edit" :disabled="!network.canRemoveDraftStation(network.editSelectedStation.value.id)" title="Retirer cet arrêt de cette ligne" @click="network.removeDraftStation(network.editSelectedStation.value.id)">× Retirer</button>
        </div>
        <div class="project-edit-secondary-tools">
          <button type="button" class="project-insert-action" :class="{ active: network.mapAction.value.kind === 'INSERT_ON_TRACE' }" title="Ajouter un arrêt directement sur le tracé existant" @click="network.requestInsertOnTrace()">＋ Sur le tracé</button>
          <div class="project-routing-actions project-routing-actions--inline">
            <span><small>Tracé</small><b>{{ projectRoutingLabel }}</b></span>
            <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectRailAutoActive }" :aria-pressed="projectRailAutoActive" title="Voies ferrées uniquement : suit le réseau ferré même si le détour est important" @click="network.setDraftRoutingMode(projectRailAutoMode)">Rail auto</button>
            <button v-if="!projectRoutingLocked" type="button" :class="{ active: projectLightAssistActive }" :aria-pressed="projectLightAssistActive" title="Suit les corridors adaptés au mode tout en autorisant un nouveau tracé hors des infrastructures existantes" @click="network.setDraftRoutingMode(projectLightAssistMode)">Aide légère</button>
            <span v-if="projectRoutingLocked" class="project-routing-lock">{{ projectRoutingLockLabel }}</span>
            <button v-else type="button" :class="{ active: projectLine?.routingMode === 'FREE' }" :aria-pressed="projectLine?.routingMode === 'FREE'" title="Relie librement les points" @click="network.setDraftRoutingMode('FREE')">Libre</button>
            <button type="button" :class="{ active: network.routeGuideMode.value }" :aria-pressed="network.routeGuideMode.value" title="Ajouter un point de passage sans créer de station" @click="network.toggleRouteGuideMode()">{{ projectGuideLabel }}</button>
          </div>
        </div>
        <div class="project-buttons project-buttons--inline project-buttons--edit">
          <button class="project-forecast-trigger" type="button" :class="{ active: projectForecastOpen }" title="Voir la population, la demande et les correspondances estimées" @click="projectForecastOpen = !projectForecastOpen">◎ Prévision</button>
          <div class="project-history-actions" aria-label="Historique du tracé">
            <button type="button" :disabled="!network.canUndoDraft.value" title="Avant · Ctrl+Z" @click="network.undoDraft()">←</button>
            <button type="button" :disabled="!network.canRedoDraft.value" title="Après · Ctrl+Y" @click="network.redoDraft()">→</button>
          </div>
          <button v-if="editProjectShortfall > 0" class="project-finance-inline" type="button" :disabled="editProjectFinanceBusy || economy.insolvencyStatus.value === 'BANKRUPT'" @click="financeEditProject">{{ editProjectFinanceBusy ? 'Financement…' : `Financer ${money(editProjectShortfall)}` }}</button><button class="project-primary" type="button" @click="validateLineEdit">Valider</button>
          <button class="project-cancel" type="button" @click="cancelCurrentLineEdit">Annuler</button>
        </div>
      </div>
      <small v-if="!network.activeLine.value && editProjectFinanceFeedback" class="project-edit-finance-feedback" role="status">{{ editProjectFinanceFeedback }}</small>
    </section>

    <aside v-if="projectForecastOpen && projectForecast && projectModeActive" class="project-forecast-panel" :class="{ 'for-edit': network.isEditing.value, 'for-selected-edit': Boolean(network.editSelectedStation.value) }" aria-label="Prévision du projet">
      <div class="project-forecast-head"><div><span>PRÉVISION DU PROJET</span><strong>{{ translateGameText(projectForecast.tone === 'STRUCTURING' ? 'Axe structurant' : projectForecast.tone === 'BALANCED' ? 'Projet équilibré' : 'Desserte locale', currentGameLocale()) }}</strong></div><button type="button" aria-label="Fermer" @click="projectForecastOpen = false">×</button></div>
      <div class="project-forecast-metrics">
        <span><small>Population desservie</small><b>{{ compactMetric(projectForecast.populationServed) }}</b></span>
        <span><small>Communes</small><b>{{ projectForecast.municipalityCount }}</b></span>
        <span><small>Potentiel voyageurs</small><b>~{{ compactMetric(projectForecast.estimatedDailyDemand) }}/j</b></span>
        <span><small>Correspondances</small><b>{{ projectForecast.interchangeCount }}</b></span>
        <span><small>Coût / km</small><b>{{ money(projectForecast.costPerKm) }}</b></span>
      </div>
      <div class="project-forecast-advice"><p>{{ translateGameText(projectForecast.advice, currentGameLocale()) }}</p><span v-if="projectLine && projectForecast.suggestedMode !== projectLine.mode">{{ translateGameText('Mode à étudier', currentGameLocale()) }} : <b>{{ getTransportModeDefinition(projectForecast.suggestedMode).label }}</b></span><span v-else>{{ translateGameText('Le mode choisi est cohérent avec cette première estimation.', currentGameLocale()) }}</span></div>
      <small class="project-forecast-note">{{ translateGameText('Estimation de conception : la fréquentation réelle dépendra ensuite des horaires, du matériel, des correspondances et de l’évolution du territoire.', currentGameLocale()) }}</small>
    </aside>

    <nav v-if="!projectModeActive && !routePlannerOpen" class="tool-dock tool-dock--simple" aria-label="Actions principales">
      <button class="create-line-button" type="button" :disabled="challenge.readOnly.value || !onlineCanCreateLine" :title="!onlineCanCreateLine ? translateGameText('Vous n’avez pas la permission de créer des lignes.', currentGameLocale()) : ''" @click="openCreation()"><b>＋</b><span>{{ challenge.readOnly.value ? 'Lecture seule' : !onlineCanCreateLine ? translateGameText('Non autorisé', currentGameLocale()) : 'Créer' }}</span></button>
      <button class="management-hub-button" type="button" :class="{ active: managementOpen || panelOpen }" :aria-pressed="managementOpen" @click="toggleManagementHub"><b>▦</b><span>Gérer</span><i v-if="info.attentionCount.value || operations.activeDisruptions.value.length">{{ info.attentionCount.value + operations.activeDisruptions.value.length }}</i></button>
      <button class="divers-hub-button" type="button" :class="{ active: diversOpen }" :aria-pressed="diversOpen" @click="toggleDiversHub"><b>•••</b><span>Divers</span></button>
    </nav>

    <ManagementHub v-if="managementOpen && !network.isEditing.value && !routePlannerOpen" :attention-count="info.attentionCount.value" :disruption-count="operations.activeDisruptions.value.length" :locked-modules="onlineLockedManagementModules" @select="selectTool" @close="managementOpen = false" />
    <DiversPanel
      v-if="diversOpen && !network.isEditing.value && !routePlannerOpen"
      :exporting="exportingWorldSave"
      :feedback="diversFeedback"
      :error="diversError"
      :can-export-save="!onlineAccepted || online.estAdmin.value"
      :export-locked-reason="translateGameText('L’export complet de la sauvegarde est réservé à l’administrateur de la partie en ligne.', currentGameLocale())"
      @open-bilan="bilanOpen = true; diversOpen = false"
      @export-save="exportCurrentWorldSave"
      @export-world="openWorldImageExport"
      @export-editor="openEditorExport"
      @close="diversOpen = false"
    />

    <WorldExportPanel
      v-if="worldExportOpen"
      :busy="worldExportBusy"
      :line-count="shareLineCount"
      :station-count="sharePhysicalStationCount"
      @export="exportWorldImage"
      @close="worldExportOpen = false"
    />
    <EditorExportPanel
      v-if="editorExportOpen"
      :lines="network.lines.value"
      :busy="editorExportBusy"
      @export="exportLineToEditor"
      @close="editorExportOpen = false"
    />

    <div v-if="routePlannerOpen" class="planner-focus-backdrop" aria-hidden="true" />
    <QuickNavigation v-if="gameplayReady && !network.isBuilding.value && !network.isEditing.value && !creationOpen" :compact="quickNavigationCompact" @planner-change="handlePlannerChange" />

    <nav v-if="contextDockVisible" class="map-context-dock" aria-label="Informations contextuelles">
      <button type="button" :class="{ active: mapInsightMode !== 'NONE' }" :title="`${translateGameText('Lecture du territoire', currentGameLocale())} · ${mapInsightLabel}`" :aria-label="`${translateGameText('Lecture du territoire', currentGameLocale())} · ${mapInsightLabel}`" @click="cycleMapInsightMode"><span>◉</span><i v-if="mapInsightMode !== 'NONE'" class="insight-badge">{{ mapInsightMode === 'POPULATION' ? 'P' : mapInsightMode === 'ACCESSIBILITY' ? 'A' : mapInsightMode === 'GROWTH' ? '↗' : mapInsightMode === 'FLOW' ? '⇄' : mapInsightMode === 'SATURATION' ? '▲' : '!'  }}</i></button>
      <button type="button" :class="{ active: lineVisibilityOpen || anyLineDimmed }" :title="anyLineDimmed ? 'Certaines lignes sont atténuées' : 'Visibilité des lignes'" aria-label="Visibilité des lignes" @click="toggleLineVisibilityPanel"><span>{{ anyLineDimmed ? '🙈' : '👁️' }}</span><i v-if="anyLineDimmed">{{ dimmedLineIds.length }}</i></button>
      <button type="button" :class="{ active: actionsOpen }" title="Actions et opportunités" aria-label="Actions et opportunités" @click="toggleActionsPanel"><span>⚡</span><i v-if="worldPulseItems.length">{{ worldPulseItems.length }}</i></button>
      <button v-if="onlineAccepted" type="button" :title="translateGameText('Chat de la partie', currentGameLocale())" :aria-label="translateGameText('Chat de la partie', currentGameLocale())" @click="openOnlineChat"><span>💬</span><i v-if="online.chatNonLus.value || (online.estAdmin.value && online.demandesEnAttente.value.length)">{{ Math.min(9, online.chatNonLus.value + (online.estAdmin.value ? online.demandesEnAttente.value.length : 0)) }}</i></button>
      <button type="button" :class="{ active: assistantOpen }" title="CLU Assistant" aria-label="CLU Assistant" @click="toggleAssistantPanel"><span>✦</span><i v-if="assistantMessageCount">{{ Math.min(9, assistantMessageCount) }}</i></button>
    </nav>
    <aside v-if="lineVisibilityOpen && !routePlannerOpen" class="line-visibility-panel" aria-label="Visibilité des lignes">
      <div class="line-visibility-panel__head"><div><strong>Visibilité des lignes</strong><small>Atténuer une ligne ne change jamais son exploitation.</small></div><div class="line-visibility-panel__bulk"><button type="button" :disabled="!anyLineDimmed" @click="restoreAllLineVisibility">Tout afficher</button><button type="button" :disabled="allLinesDimmed || lineVisibilityChoices.length === 0" @click="dimAllLines">Tout cacher</button></div></div>
      <div class="line-visibility-panel__list">
        <label v-for="line in lineVisibilityChoices" :key="line.id" :class="{ dimmed: dimmedLineIds.includes(line.id) }">
          <input type="checkbox" :checked="dimmedLineIds.includes(line.id)" @change="toggleLineDimmed(line.id)">
          <span class="line-visibility-swatch" :style="{ background: line.color }" />
          <span class="line-visibility-name"><b>{{ line.shortCode }}</b><small>{{ line.name }}</small></span>
          <em>{{ dimmedLineIds.includes(line.id) ? 'Atténuée' : 'Visible' }}</em>
        </label>
        <p v-if="lineVisibilityChoices.length === 0">Aucune ligne à afficher.</p>
      </div>
    </aside>
    <WorldPulse v-if="actionsOpen && !routePlannerOpen" :items="worldPulseItems" @focus="focusWorldPulse" @manage="manageWorldPulse" @dismiss="dismissWorldPulse" />
    <AssistantPanel v-if="assistantOpen && !routePlannerOpen" @close="assistantOpen = false" />

    <div v-if="clock.blockedMessage.value" class="time-notices" aria-live="polite">
      <div class="pause-entry-notice pause-entry-notice--warning" role="status">{{ clock.blockedMessage.value }}</div>
    </div>
    <section v-if="!challenge.readOnly.value && !routePlannerOpen" class="time-controls" aria-label="Contrôle du temps">
      <button type="button" class="time-toggle" :disabled="onlineClockReadOnly" :title="onlineClockReadOnly ? translateGameText('Le temps est piloté par l’administrateur de la partie en ligne.', currentGameLocale()) : ''" :aria-pressed="clock.playing.value" @click="clock.toggle()">{{ clock.playing.value ? 'Ⅱ Pause' : '▶ Jouer' }}</button>
      <div class="time-readout"><strong>{{ clock.timeLabel.value }}</strong><small>{{ clockStatusLabel }}</small></div>
      <div class="speed-tabs" role="group" aria-label="Vitesse du temps">
        <button v-for="value in ([0.5, 1, 2] as const)" :key="value" type="button" :disabled="onlineClockReadOnly" :class="{ active: clock.speed.value === value }" @click="clock.setSpeed(value)">{{ value }}×</button>
      </div>
      <button type="button" class="day-next-inline" :disabled="Boolean(dayBlockedReason) || simulation.isAdvancing.value" :title="dayBlockedReason || 'Passer directement au jour suivant'" @click="advanceDay">Jour suivant</button>
    </section>
    <section v-if="!challenge.readOnly.value && !routePlannerOpen" class="day-progress" aria-label="Progression de la journée">
      <span><b>{{ simulation.currentCalendarLabel.value }}</b><small>Jour {{ simulation.day.value }}</small></span>
      <div><i :style="{ width: `${clock.progress.value * 100}%` }" /></div>
    </section>

    <aside v-if="panelOpen && !network.isEditing.value && !routePlannerOpen" class="side-panel" aria-labelledby="game-side-panel-title">
      <div class="panel-top"><span id="game-side-panel-title">{{ toolTitle(selectedTool) }}</span><div class="panel-top-actions"><button v-if="userSettings.wikiEnabled" type="button" title="Aide contextuelle" aria-label="Ouvrir l’aide contextuelle" @click="openWiki(toolWikiArticle)">?</button><button type="button" aria-label="Fermer le panneau" @click="closePanel">×</button></div></div>
      <div class="panel-scroll">
        <div v-if="selectedToolLockedReason" class="online-permission-lock" role="status">
          <span aria-hidden="true">🔒</span>
          <strong>{{ translateGameText('Accès non autorisé', currentGameLocale()) }}</strong>
          <p>{{ selectedToolLockedReason }}</p>
          <small>{{ translateGameText('L’administrateur peut modifier vos permissions depuis Administration.', currentGameLocale()) }}</small>
        </div>
        <template v-else>
          <NetworkPanel v-if="selectedTool === 'NETWORK'" />
          <FleetPanel v-else-if="selectedTool === 'FLEET'" />
          <PassengersPanel v-else-if="selectedTool === 'PASSENGERS'" />
          <OperationsPanel v-else-if="selectedTool === 'OPERATIONS'" />
          <MunicipalitiesPanel v-else-if="selectedTool === 'MUNICIPALITIES'" />
          <FinancePanel v-else-if="selectedTool === 'FINANCES'" :focus-debt-token="financeDebtFocusToken" />
          <EventsInfoPanel v-else-if="selectedTool === 'EVENTS'" />
          <ObjectivesPanel v-else />
        </template>
      </div>
    </aside>

    <div v-if="creationOpen" class="creation-backdrop" @click.self="creationOpen = false"><section class="creation-modal" role="dialog" aria-modal="true" aria-label="Créer une ligne"><LineCreationPanel @created="handleCreatedLine" @close="creationOpen = false" /></section></div>

    <div v-if="launchConfigOpen && launchConfig && network.activeLine.value" class="launch-config-backdrop">
      <section class="launch-config-dialog" role="dialog" aria-modal="true" aria-labelledby="launch-config-title">
        <div class="launch-config-head">
          <div><span class="eyebrow">Avant mise en service</span><h2 id="launch-config-title">Préparer l’exploitation</h2></div>
          <button type="button" aria-label="Fermer" :disabled="launchCommitBusy" @click="launchConfigOpen = false">×</button>
        </div>
        <p class="launch-config-intro">Choisissez une préparation recommandée pour démarrer simplement, ou passez en configuration manuelle si vous voulez régler précisément cette ligne avant sa mise en service.</p>

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

        <div class="launch-cost-breakdown"><span>Infrastructure <b>{{ money(launchProjectCost) }}</b></span><span>Matériel <b>{{ money(launchFleetPurchaseCost) }}</b></span><span>Améliorations <b>{{ money(launchUpgradeCost) }}</b></span><span class="total">Total <b>{{ money(launchTotalCost) }}</b></span></div>

        <section v-if="launchShortfall > 0 && !economy.unlimitedMoney.value" class="project-financing-card" :class="{ blocked: !projectFundingCanCover }">
          <div class="project-financing-copy">
            <span class="project-financing-kicker">Financement nécessaire</span>
            <strong class="project-financing-missing">Il manque {{ money(launchShortfall) }}</strong>
            <p v-if="projectFundingCanCover">CLU peut couvrir exactement ce manque par un financement de projet. Rien n’est emprunté tant que vous n’avez pas validé l’étape de confirmation.</p>
            <p v-else>La capacité de financement disponible ne suffit pas à couvrir entièrement ce projet. Réduisez le projet ou libérez de la capacité financière avant la mise en service.</p>
          </div>
          <div v-if="projectFundingCanCover" class="project-financing-proposal">
            <div class="project-financing-figure"><small>Emprunt proposé</small><strong>{{ money(projectSuggestedBorrow) }}</strong></div>
            <div class="project-financing-meta">
              <span><small>Dette après emprunt</small><b>{{ money(projectProposedDebtAfter) }}</b></span>
              <span><small>Reste après mise en service</small><b>{{ money(projectProposedBalanceAfter) }}</b></span>
            </div>
            <div class="project-financing-actions">
              <button type="button" class="secondary" @click="launchConfigOpen = false">Refuser et retourner au tracé</button>
              <button type="button" class="primary" :disabled="projectBorrowBusy" @click="borrowForActiveProject">{{ projectBorrowBusy ? 'Préparation…' : 'Voir et valider l’emprunt' }}</button>
            </div>
          </div>
          <div v-else class="project-financing-unavailable">
            <span>Capacité disponible <strong>{{ money(projectBorrowMaximum) }}</strong></span>
            <span>Besoin <strong>{{ money(projectSuggestedBorrow) }}</strong></span>
          </div>
          <small v-if="projectBorrowFeedback" class="project-financing-feedback" role="status">{{ projectBorrowFeedback }}</small>
        </section>

        <div class="launch-config-footer"><button type="button" :disabled="launchCommitBusy" @click="launchConfigOpen = false">Retour au tracé</button><button class="primary" type="button" :disabled="launchShortfall > 0 || launchCommitBusy" @click="confirmConfiguredProject">{{ launchCommitBusy ? 'Mise en service…' : launchShortfall > 0 ? 'Financement requis avant mise en service' : launchFleetWarning ? 'Mettre en service malgré le parc insuffisant' : 'Confirmer et mettre en service' }}</button></div>
      </section>
    </div>

    <StationInspector v-if="!network.isEditing.value" />
    <VehicleInspector v-if="!network.isEditing.value" :vehicle="selectedVehicle" @close="selectedVehicle = null" />

    <div v-if="network.pendingStationNaming.value" class="station-name-backdrop">
      <section class="station-name-dialog" role="dialog" aria-modal="true" aria-labelledby="station-name-title">
        <span class="eyebrow">Nouvelle station</span>
        <h3 id="station-name-title">Nom de l’arrêt</h3>
        <p v-if="network.pendingStationNaming.value.outsideLoadedTerritory" class="outside-territory"><strong>Hors territoire chargé.</strong> CLU ne dispose pas ici du nom communal local. Choisissez librement le nom de l’arrêt.</p>
        <p v-else>CLU propose le nom de la commune. Modifiez-le maintenant si vous préférez un nom de gare, de quartier ou de lieu.</p>
        <input v-model="stationNameDraft" maxlength="60" autofocus @keydown="handleStationNameKeydown" @keyup.stop>
        <div class="station-name-actions"><button class="cancel" type="button" @click="cancelStationName">Annuler</button><button class="confirm" type="button" @click="confirmStationName">Confirmer et continuer</button></div>
      </section>
    </div>

    <div v-if="eventPreparationEvent" class="action-backdrop event-preparation-backdrop" @click.self="closeEventPreparation">
      <section class="event-preparation-dialog" role="dialog" aria-modal="true" aria-labelledby="event-preparation-title">
        <div class="event-preparation-head">
          <div>
            <span class="eyebrow">{{ translateGameText('Événement local', currentGameLocale()) }}</span>
            <h3 id="event-preparation-title">{{ localEventKindLabel(eventPreparationEvent.kind) }} · {{ eventPreparationEvent.municipalityName }}</h3>
          </div>
          <button type="button" class="event-preparation-close" :aria-label="translateGameText('Fermer', currentGameLocale())" @click="closeEventPreparation">×</button>
        </div>
        <div class="event-preparation-facts">
          <span><small>{{ translateGameText('Affluence attendue', currentGameLocale()) }}</small><strong>{{ formatGameNumberCompact(eventPreparationEvent.expectedVisitors) }}</strong></span>
          <span><small>{{ translateGameText('Envergure', currentGameLocale()) }}</small><strong>{{ localEventScaleLabel(eventPreparationEvent.scale) }}</strong></span>
          <span><small>{{ translateGameText('Début', currentGameLocale()) }}</small><strong>J{{ eventPreparationEvent.startsDay }}</strong></span>
          <span><small>{{ translateGameText('Durée', currentGameLocale()) }}</small><strong>{{ eventPreparationEvent.endsDay - eventPreparationEvent.startsDay + 1 }} j</strong></span>
        </div>
        <p>{{ translateGameText('Les services temporaires sont assurés uniquement en bus. Choisissez une ligne de bus desservant le secteur : le service n’existe que pour cet événement et son coût est engagé immédiatement.', currentGameLocale()) }}</p>
        <div v-if="eventPreparationLines.length" class="event-preparation-lines">
          <button v-for="line in eventPreparationLines" :key="line.id" type="button" :class="{ active: eventPreparationLine?.id === line.id }" @click="eventPreparationLineId = line.id">
            <i :style="{ background: line.color }" />
            <span><b>{{ line.shortCode || line.name }}</b><small>{{ line.name }}</small></span>
          </button>
        </div>
        <div v-else class="event-preparation-empty">{{ translateGameText("Aucune ligne de bus opérationnelle ne dessert encore directement ce secteur. Les lignes ferrées ne peuvent pas devenir des services temporaires.", currentGameLocale()) }}</div>
        <div v-if="eventPreparationAnalysis && eventPreparationLine" class="event-preparation-recommendation">
          <div><span>{{ translateGameText('Plan recommandé', currentGameLocale()) }}</span><strong>{{ localEventServiceLabel(eventPreparationAnalysis.recommendedServiceKind) }} · {{ translateGameText(eventPreparationAnalysis.recommended === 'STRONG' ? 'Fort' : 'Léger', currentGameLocale()) }}</strong></div>
          <div><span>{{ translateGameText('Capacité disponible estimée', currentGameLocale()) }}</span><strong>{{ formatGameNumberCompact(eventPreparationAnalysis.spareCapacity) }}</strong></div>
          <button type="button" :disabled="eventPreparationBusy" @click="applyEventPreparation(eventPreparationAnalysis.recommended, eventPreparationAnalysis.recommendedServiceKind)">{{ translateGameText('Appliquer le recommandé', currentGameLocale()) }}</button>
        </div>
        <div v-if="eventPreparationLine" class="event-preparation-services" role="group" :aria-label="translateGameText('Type de service temporaire', currentGameLocale())">
          <button v-for="kind in eventServiceKinds" :key="kind" type="button" :class="{ active: eventPreparationServiceKind === kind }" @click="eventPreparationServiceKind = kind">
            <strong>{{ localEventServiceLabel(kind) }}</strong>
            <small>{{ localEventServiceDescription(kind) }}</small>
          </button>
        </div>
        <div v-if="eventPreparationLine" class="event-preparation-options">
          <button type="button" :disabled="eventPreparationBusy" @click="applyEventPreparation('LIGHT')">
            <strong>{{ translateGameText('Léger', currentGameLocale()) }} · {{ eventPreparationCosts ? money(eventPreparationCosts.light) : '—' }}</strong>
            <small>{{ eventPreparationLine.schedule?.mode === 'TIMETABLE' ? translateGameText('Quelques circulations temporaires', currentGameLocale()) : translateGameText('Hausse ciblée de capacité', currentGameLocale()) }}</small>
          </button>
          <button type="button" class="strong" :disabled="eventPreparationBusy" @click="applyEventPreparation('STRONG')">
            <strong>{{ translateGameText('Fort', currentGameLocale()) }} · {{ eventPreparationCosts ? money(eventPreparationCosts.strong) : '—' }}</strong>
            <small>{{ eventPreparationLine.schedule?.mode === 'TIMETABLE' ? translateGameText('Circulations rapprochées autour du pic', currentGameLocale()) : translateGameText('Capacité temporaire maximale', currentGameLocale()) }}</small>
          </button>
        </div>
        <div v-if="eventPreparationEvent.preparedLineId" class="event-preparation-current">
          ✓ {{ translateGameText('Service temporaire actif', currentGameLocale()) }} · {{ localEventServiceLabel(eventPreparationEvent.serviceKind ?? 'REINFORCEMENT') }} · {{ network.lines.value.find(line => line.id === eventPreparationEvent?.preparedLineId)?.name ?? translateGameText('Ligne', currentGameLocale()) }}<template v-if="eventPreparationEvent.serviceCost"> · {{ money(eventPreparationEvent.serviceCost) }}</template>
        </div>
        <div v-if="eventPreparationFeedback" class="event-preparation-feedback" role="status">{{ eventPreparationFeedback }}</div>
        <div class="event-preparation-footer">
          <button type="button" @click="focusEventPreparationSector">{{ translateGameText('Voir le secteur', currentGameLocale()) }}</button>
          <button type="button" class="primary" @click="closeEventPreparation">{{ translateGameText('Terminer', currentGameLocale()) }}</button>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="borrowConfirmation" class="borrow-confirmation-backdrop" @click.self="borrowConfirmation = null">
        <section class="borrow-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="borrow-confirmation-title">
          <span class="eyebrow">Financement du projet</span>
          <h3 id="borrow-confirmation-title">Valider cet emprunt ?</h3>
          <p>Cette validation crée réellement la dette. Si vous refusez, aucun euro n’est emprunté et votre projet reste inchangé.</p>
          <div class="borrow-confirmation-summary">
            <span><small>Montant emprunté</small><strong>{{ money(borrowConfirmation.amount) }}</strong></span>
            <span><small>Dette après validation</small><strong>{{ money(borrowConfirmationDebtAfter) }}</strong></span>
            <span><small>Trésorerie après validation</small><strong>{{ money(borrowConfirmationBalanceAfter) }}</strong></span>
          </div>
          <div class="dialog-actions"><button type="button" @click="borrowConfirmation = null">Refuser l’emprunt</button><button class="finance-action" type="button" :disabled="projectBorrowBusy || editProjectFinanceBusy" @click="confirmBorrow">{{ projectBorrowBusy || editProjectFinanceBusy ? 'Validation…' : `Valider l’emprunt de ${money(borrowConfirmation.amount)}` }}</button></div>
        </section>
      </div>
    </Teleport>

    <div v-if="actionDialog" class="action-backdrop" @click.self="actionDialog = null">
      <section class="action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="action-dialog-title">
        <span class="eyebrow">CLU Métropole</span>
        <h3 id="action-dialog-title">{{ actionDialog.title }}</h3>
        <p>{{ actionDialog.message }}</p>
        <div class="dialog-actions"><button v-if="actionDialog.financeEdit && editProjectShortfall > 0" class="finance-action" type="button" :disabled="editProjectFinanceBusy || economy.insolvencyStatus.value === 'BANKRUPT'" @click="financeEditProject">{{ editProjectFinanceBusy ? 'Financement…' : `Emprunter ${money(editProjectShortfall)}` }}</button><button v-else-if="actionDialog.finance" class="finance-action" type="button" @click="openFinances">Ouvrir Finances</button><button type="button" @click="actionDialog = null">Fermer</button></div>
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
        <button v-if="onlineAccepted && online.estAdmin.value" type="button" @click="openOnlineAdministration"><b>⌘</b><span><strong>{{ translateGameText('Administration', currentGameLocale()) }}</strong><small>{{ translateGameText('Code, membres, permissions et paramètres en ligne', currentGameLocale()) }}</small></span></button>
        <button v-if="challenge.runtime.value?.status === 'ACTIVE'" type="button" @click="finishChallengeNow"><b>■</b><span><strong>Terminer le défi</strong><small>Figer immédiatement le résultat et passer en lecture seule</small></span></button>
        <button v-if="challenge.result.value" type="button" @click="challengeResultOpen = true; menuOpen = false"><b>◆</b><span><strong>Résultat du défi</strong><small>Score et objectifs</small></span></button>
        <button type="button" @click="startOrResumeTutorial"><b>◉</b><span><strong>{{ help.tutorial.value.completed ? 'Revoir le tutoriel' : 'Voir le tutoriel' }}</strong><small>Coach interactif basé sur vos vraies actions</small></span></button>
        <button v-if="userSettings.wikiEnabled" type="button" @click="openWiki(null)"><b>?</b><span><strong>Wiki</strong><small>Comprendre les systèmes sans quitter la partie</small></span></button>
        <button type="button" @click="openSettings"><b>⚙</b><span><strong>Paramètres</strong><small>Apparence, graphismes, aide et confort</small></span></button>
        <button v-if="!onlineAccepted || online.estAdmin.value" type="button" :disabled="isSaving || challenge.readOnly.value" @click="saveGame"><b>◆</b><span><strong>{{ isSaving ? 'Sauvegarde…' : 'Sauvegarder' }}</strong><small>{{ challenge.readOnly.value ? 'L’état du défi est figé' : 'Conserver l’état actuel de la métropole' }}</small></span></button>
        <button type="button" :disabled="isSaving" @click="saveAndQuit"><b>↩</b><span><strong>{{ onlineAccepted ? (online.estAdmin.value ? translateGameText('Sauvegarder et fermer la partie en ligne', currentGameLocale()) : translateGameText('Quitter la partie en ligne', currentGameLocale())) : 'Sauvegarder et quitter' }}</strong><small>{{ onlineAccepted ? (online.estAdmin.value ? translateGameText('Tous les autres joueurs seront déconnectés.', currentGameLocale()) : translateGameText('Cette partie ne sera pas ajoutée à vos sauvegardes.', currentGameLocale())) : 'Retourner au menu principal CLU' }}</small></span></button>
      </section>
    </div>

    <div v-if="onlinePublishOpen" class="online-publish-backdrop" @click.self="!onlinePublishBusy && (onlinePublishOpen = false)">
      <section class="online-publish-dialog" role="dialog" aria-modal="true" :aria-label="translateGameText('Rendre la partie en ligne', currentGameLocale())">
        <header><div><span class="eyebrow">{{ translateGameText('En ligne', currentGameLocale()) }}</span><h2>{{ translateGameText('Rendre la partie en ligne', currentGameLocale()) }}</h2></div><button type="button" :disabled="onlinePublishBusy" aria-label="Fermer" @click="onlinePublishOpen = false">×</button></header>
        <p>{{ translateGameText('L’état actuel de cette sauvegarde devient la métropole partagée. Lorsque vous quittez, la session se termine mais votre sauvegarde reste locale.', currentGameLocale()) }}</p>
        <div class="online-publish-grid">
          <label><span>{{ translateGameText('Nom de la partie', currentGameLocale()) }}</span><input v-model="onlinePublishName" maxlength="50" autocomplete="off"></label>
          <label><span>{{ translateGameText('Accès', currentGameLocale()) }}</span><select v-model="onlinePublishVisibility"><option value="privee">{{ translateGameText('Privée', currentGameLocale()) }}</option><option value="publique_code">{{ translateGameText('Publique par code', currentGameLocale()) }}</option><option value="ouverte">{{ translateGameText('Ouverte à tous', currentGameLocale()) }}</option></select></label>
          <label><span>{{ translateGameText('Budget', currentGameLocale()) }}</span><select v-model="onlinePublishBudgetMode"><option value="global">{{ translateGameText('Budget global', currentGameLocale()) }}</option><option value="divise">{{ translateGameText('Budget divisé', currentGameLocale()) }}</option></select></label>
          <label class="online-publish-switch"><input v-model="onlinePublishEditionByDefault" type="checkbox"><span><strong>{{ translateGameText('Autoriser l’édition dès l’arrivée', currentGameLocale()) }}</strong><small>{{ translateGameText('Sinon les nouveaux joueurs arrivent en lecture seule.', currentGameLocale()) }}</small></span></label>
        </div>
        <p v-if="onlinePublishError" class="online-publish-error" role="alert">{{ onlinePublishError }}</p>
        <footer><button type="button" :disabled="onlinePublishBusy" @click="onlinePublishOpen = false">{{ translateGameText('Annuler', currentGameLocale()) }}</button><button type="button" class="primary" :disabled="onlinePublishBusy || !onlinePublishName.trim()" @click="publishCurrentSaveOnline">{{ onlinePublishBusy ? translateGameText('Mise en ligne…', currentGameLocale()) : translateGameText('Rendre la partie en ligne', currentGameLocale()) }}</button></footer>
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
        <div class="settings-dialog__scroll">
          <GameSettingsPanel />
          <section v-if="!challenge.readOnly.value" class="settings-online-section">
            <div>
              <span class="eyebrow">{{ translateGameText('En ligne', currentGameLocale()) }}</span>
              <strong>{{ onlineAccepted ? translateGameText('Cette métropole est actuellement en ligne', currentGameLocale()) : translateGameText('Partager cette sauvegarde en ligne', currentGameLocale()) }}</strong>
              <small v-if="onlineAccepted">{{ translateGameText('La session existe uniquement tant que son créateur reste dans la partie.', currentGameLocale()) }}</small>
              <small v-else>{{ translateGameText('Créez une nouvelle session autour de l’état actuel de cette sauvegarde. Un nouveau code sera généré.', currentGameLocale()) }}</small>
            </div>
            <button v-if="onlineAccepted && online.estAdmin.value" type="button" @click="settingsOpen = false; openOnlineAdministration()">{{ translateGameText('Administration', currentGameLocale()) }}</button>
            <button v-else-if="!onlineAccepted" type="button" class="primary" @click="openOnlinePublishConfiguration">{{ translateGameText('Rendre la partie en ligne', currentGameLocale()) }}</button>
            <span v-else class="settings-online-member">{{ translateGameText('Session gérée par l’administrateur', currentGameLocale()) }}</span>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.launch-config-backdrop{position:absolute;inset:0;z-index:59;background:rgba(0,0,0,.56);backdrop-filter:blur(9px);display:grid;place-items:center;padding:16px}.launch-config-dialog{width:min(900px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#0f181e;box-shadow:0 28px 90px rgba(0,0,0,.52);display:grid;gap:15px}.launch-config-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.launch-config-head h2{margin:2px 0 0;font-size:calc(22px * var(--clu-text-scale,1))}.launch-config-head>button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.05);color:inherit;font-size:calc(21px * var(--clu-text-scale,1));cursor:pointer}.launch-config-intro{margin:0;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;opacity:.68}.launch-config-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.launch-config-summary>div{padding:10px;border-radius:10px;background:rgba(255,255,255,.04);display:grid;gap:2px}.launch-config-summary span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.52}.launch-config-summary strong{font-size:calc(12px * var(--clu-text-scale,1))}.launch-config-actions-top{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(79,211,220,.15);border-radius:11px;background:rgba(79,211,220,.055)}.launch-config-actions-top .recommended{border:1px solid rgba(79,211,220,.38);background:rgba(79,211,220,.15);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}.launch-config-actions-top small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.58}.launch-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.launch-config-grid>section{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);display:grid;gap:9px}.launch-config-grid h3{margin:0;font-size:calc(12px * var(--clu-text-scale,1))}.launch-advanced{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.018)}.launch-advanced>summary{cursor:pointer;padding:12px 0;font-size:calc(11px * var(--clu-text-scale,1));font-weight:800}.launch-advanced[open]>summary{margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,.07)}.launch-config-grid--advanced{padding-bottom:12px}.launch-config-grid small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.58}.launch-upgrades{grid-row:span 2}.launch-choice-row{display:flex;gap:6px;flex-wrap:wrap}.launch-choice-row button,.launch-fleet-counter button,.launch-level-counter button,.launch-config-footer button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:7px 9px;cursor:pointer}.launch-choice-row button.active{border-color:rgba(79,211,220,.45);background:rgba(79,211,220,.16)}.launch-fleet-counter{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.launch-fleet-counter input{width:76px;padding:7px;text-align:center;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#121c23;color:inherit}.launch-fleet-counter .fit{margin-left:4px}.launch-upgrade-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:8px;border-radius:9px;background:rgba(255,255,255,.03)}.launch-upgrade-row>div:first-child{display:grid;gap:2px}.launch-level-counter{display:flex;align-items:center;gap:6px}.launch-level-counter b{min-width:34px;text-align:center;font-size:calc(10px * var(--clu-text-scale,1))}.launch-level-counter button:disabled{opacity:.35;cursor:not-allowed}.launch-warning{margin:0;padding:8px 10px;border:1px solid rgba(241,171,71,.22);border-radius:9px;background:rgba(190,116,31,.08);color:#f2c579;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45}.launch-cost-breakdown{display:flex;gap:8px;flex-wrap:wrap}.launch-cost-breakdown span{padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.04);font-size:calc(9px * var(--clu-text-scale,1));display:flex;gap:8px}.launch-cost-breakdown .total{margin-left:auto;border:1px solid rgba(79,211,220,.16);background:rgba(79,211,220,.055)}.project-financing-card{display:grid;gap:12px;padding:14px;border:1px solid rgba(79,211,220,.26);border-radius:14px;background:linear-gradient(135deg,rgba(79,211,220,.09),rgba(79,211,220,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.project-financing-card.blocked{border-color:rgba(241,171,71,.28);background:linear-gradient(135deg,rgba(190,116,31,.09),rgba(190,116,31,.025))}.project-financing-copy{display:grid;gap:4px}.project-financing-kicker{font-size:calc(9px * var(--clu-text-scale,1));font-weight:850;text-transform:uppercase;letter-spacing:.11em;color:#7ce6ec}.project-financing-card.blocked .project-financing-kicker{color:#f2c579}.project-financing-missing{font-size:calc(18px * var(--clu-text-scale,1));line-height:1.15}.project-financing-copy p{max-width:680px;margin:1px 0 0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.48;color:rgba(255,255,255,.62)}.project-financing-proposal{display:grid;grid-template-columns:minmax(155px,.72fr) minmax(260px,1.28fr);grid-template-areas:'figure meta' 'actions actions';gap:8px}.project-financing-figure{grid-area:figure;display:grid;gap:3px;padding:11px 12px;border-radius:11px;background:rgba(7,14,18,.44);border:1px solid rgba(255,255,255,.07)}.project-financing-figure small,.project-financing-meta small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.project-financing-figure strong{font-size:calc(16px * var(--clu-text-scale,1));color:#a4f1f3}.project-financing-meta{grid-area:meta;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.project-financing-meta span{display:grid;gap:3px;padding:10px 11px;border-radius:11px;background:rgba(7,14,18,.32);border:1px solid rgba(255,255,255,.055)}.project-financing-meta b{font-size:calc(11px * var(--clu-text-scale,1));overflow-wrap:anywhere}.project-financing-actions{grid-area:actions;display:flex;justify-content:flex-end;gap:8px;padding-top:2px}.project-financing-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:9px 11px;cursor:pointer;font-weight:750}.project-financing-actions .primary{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.17)}.project-financing-actions .secondary{color:rgba(255,255,255,.72)}.project-financing-actions button:disabled{opacity:.42;cursor:not-allowed}.project-financing-unavailable{display:flex;flex-wrap:wrap;gap:7px}.project-financing-unavailable span{padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.04);font-size:calc(9px * var(--clu-text-scale,1))}.project-financing-feedback{padding:8px 10px;border-radius:9px;background:rgba(79,211,220,.07);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;color:#a4f1f3}.borrow-confirmation-backdrop{position:fixed!important;inset:0!important;z-index:10050!important;background:rgba(0,0,0,.62)!important;backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.borrow-confirmation-dialog{width:min(500px,calc(100vw - 36px));padding:22px;border-radius:18px;border:1px solid rgba(79,211,220,.28);background:#10191f;box-shadow:0 28px 90px rgba(0,0,0,.62)}.borrow-confirmation-dialog h3{margin:5px 0 7px;font-size:calc(20px * var(--clu-text-scale,1))}.borrow-confirmation-dialog>p{margin:0;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;color:rgba(255,255,255,.66)}.borrow-confirmation-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:15px}.borrow-confirmation-summary span{display:grid;gap:3px;padding:10px;border-radius:10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.045)}.borrow-confirmation-summary small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.borrow-confirmation-summary strong{font-size:calc(11px * var(--clu-text-scale,1));overflow-wrap:anywhere}.borrow-confirmation-dialog .dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.borrow-confirmation-dialog .dialog-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:9px 11px;cursor:pointer}.borrow-confirmation-dialog .dialog-actions .finance-action{background:rgba(79,211,220,.17);border-color:rgba(79,211,220,.42)}.borrow-confirmation-dialog .dialog-actions button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.project-financing-proposal{grid-template-columns:1fr;grid-template-areas:'figure' 'meta' 'actions'}.project-financing-meta{grid-template-columns:1fr}.project-financing-actions{flex-direction:column-reverse}.project-financing-actions button{width:100%}.borrow-confirmation-summary{grid-template-columns:1fr}.borrow-confirmation-dialog .dialog-actions{flex-direction:column-reverse}.borrow-confirmation-dialog .dialog-actions button{width:100%}}.launch-config-footer{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}.launch-config-footer .primary{background:rgba(79,211,220,.17);border-color:rgba(79,211,220,.42)}.launch-config-footer button:disabled{opacity:.4;cursor:not-allowed}@media(max-width:760px){.launch-config-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.launch-config-grid{grid-template-columns:1fr}.launch-upgrades{grid-row:auto}.launch-config-actions-top{align-items:flex-start;flex-direction:column}.launch-config-footer{flex-direction:column-reverse}.launch-config-footer button{width:100%}}
.budget-kpi{position:relative}.financial-pulse{position:absolute;z-index:6;left:50%;top:100%;transform:translate(-50%,5px);padding:3px 7px;border-radius:7px;font-style:normal;font-size:calc(14px * var(--clu-text-scale,1));line-height:1.15;font-weight:950;letter-spacing:.01em;white-space:nowrap;background:rgba(8,14,19,.92);border:1px solid currentColor;box-shadow:0 5px 18px rgba(0,0,0,.34);animation:money-pulse 2s ease forwards;pointer-events:none}.financial-pulse.positive{color:#62f09b}.financial-pulse.negative{color:#ff6f79}.time-controls{position:absolute;z-index:22;left:18px;bottom:18px;display:flex;align-items:center;gap:7px;padding:7px 8px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(8,14,19,.82);backdrop-filter:blur(16px)}.time-controls button{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.05);color:inherit;padding:6px 8px;cursor:pointer}.time-controls strong{min-width:40px;font-size:calc(11px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums}.speed-tabs{display:flex;gap:3px}.speed-tabs button{padding:5px 6px;font-size:calc(8px * var(--clu-text-scale,1))}.speed-tabs button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.16);color:#a8f5f8}.day-progress{position:absolute;z-index:21;left:50%;bottom:18px;transform:translateX(-50%);width:min(420px,42vw);display:grid;grid-template-columns:auto 1fr;align-items:center;gap:11px;padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(8,14,19,.72);backdrop-filter:blur(14px)}.day-progress span{display:grid;gap:1px;min-width:150px;white-space:nowrap}.day-progress span b{font-size:calc(9px * var(--clu-text-scale,1));font-weight:800}.day-progress span small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.5}.day-progress>div{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}.day-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4fd3dc,#9cecf0);transition:width .2s linear}.time-notices{position:absolute;z-index:40;left:18px;bottom:76px;width:min(390px,calc(100vw - 36px));display:grid;gap:6px;pointer-events:none}.pause-entry-notice{padding:8px 11px;border:1px solid rgba(79,211,220,.22);border-radius:10px;background:rgba(11,31,36,.94);font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.25)}.pause-entry-notice--warning{border-color:rgba(239,184,75,.3);color:#f2cf80}.project-trace-actions{display:flex;align-items:center}.project-trace-actions button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.16)}@keyframes money-pulse{0%{opacity:0;transform:translate(-50%,10px) scale(.88)}10%{opacity:1;transform:translate(-50%,4px) scale(1.08)}22%{transform:translate(-50%,2px) scale(1)}78%{opacity:1;transform:translate(-50%,-2px) scale(1)}100%{opacity:0;transform:translate(-50%,-18px) scale(1.03)}}
.help-backdrop{position:absolute;inset:0;z-index:78;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.game-shell{position:fixed;inset:0;z-index:9999;width:100%;height:100%;min-height:100vh;overflow:hidden;background:#091015;color:#edf6f7;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:dark}.challenge-result-backdrop{position:absolute;inset:0;z-index:75;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.challenge-clock{display:grid;gap:1px;min-width:92px;padding:5px 8px;border:1px solid rgba(242,193,64,.25);border-radius:9px;background:rgba(105,76,13,.13);color:#ffe18a}.challenge-clock small{font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;opacity:.6}.challenge-clock strong{font-size:calc(11px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums}.challenge-clock.ended{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#bfc9cc}.topbar{position:absolute;z-index:30;top:14px;min-height:58px;padding:8px 11px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(8,14,19,.84);backdrop-filter:blur(16px);display:flex;align-items:center;gap:12px;box-shadow:0 10px 34px rgba(0,0,0,.22)}.topbar--brand{left:16px;right:auto;width:max-content;max-width:min(390px,42vw);padding-left:14px}.topbar--stats{right:16px;left:auto;width:max-content;max-width:calc(100vw - 470px)}.brand{display:flex;align-items:center;gap:10px;min-width:0}.brand>b{font-size:calc(20px * var(--clu-text-scale,1));letter-spacing:.08em}.brand span,.top-kpis span{display:grid;min-width:0}.brand strong{max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.brand small,.top-kpis small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48;margin-top:2px}.top-kpis{display:flex;gap:11px;align-items:center}.top-kpis strong{font-size:calc(12px * var(--clu-text-scale,1));white-space:nowrap}.debt-kpi-button{display:grid;gap:2px;min-width:92px;padding:5px 9px;border:1px solid rgba(255,104,112,.24);border-radius:10px;background:rgba(175,44,54,.10);color:inherit;text-align:left;cursor:pointer}.debt-kpi-button:hover,.debt-kpi-button:focus-visible{border-color:rgba(255,104,112,.5);background:rgba(175,44,54,.17);outline:none}.debt-kpi-button small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.66;margin:0}.debt-kpi-button strong{color:#ff6f79;font-size:calc(12px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums}.debt{color:#ff9c9c}.day-action{position:relative;display:flex}.day-button,.bilan-button,.menu-button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:inherit;border-radius:11px;padding:9px 12px;cursor:pointer}.day-button{background:rgba(77,211,220,.16);border-color:rgba(77,211,220,.32);white-space:nowrap}.bilan-button{display:flex;align-items:center;gap:6px;white-space:nowrap}.bilan-button b{font-size:calc(13px * var(--clu-text-scale,1))}.bilan-button span{font-size:calc(10px * var(--clu-text-scale,1));font-weight:700}.day-button:disabled{opacity:.4;cursor:not-allowed}.day-tooltip{position:absolute;right:0;top:46px;width:290px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#10191f;color:#edf6f7;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;box-shadow:0 14px 34px rgba(0,0,0,.42);opacity:0;pointer-events:none;transform:translateY(-3px);transition:opacity .15s ease,transform .15s ease;z-index:80}.day-action:hover .day-tooltip,.day-action:focus-within .day-tooltip{opacity:1;transform:translateY(0)}.menu-button{font-size:calc(17px * var(--clu-text-scale,1))}.city-search{position:relative;width:210px;flex:none}.city-search>input{width:100%;height:38px;padding:0 12px 0 32px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:#101a20;color:#edf6f7;outline:none}.city-search>input:focus{border-color:rgba(79,211,220,.52);box-shadow:0 0 0 3px rgba(79,211,220,.08)}.search-icon{position:absolute;left:11px;top:8px;font-size:calc(16px * var(--clu-text-scale,1));opacity:.55;z-index:2}.city-suggestions{position:absolute;left:0;right:0;top:44px;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0e171d;box-shadow:0 18px 50px rgba(0,0,0,.48);display:grid;gap:3px}.city-suggestions button{border:0;background:transparent;color:inherit;border-radius:8px;padding:8px 9px;text-align:left;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.city-suggestions button:hover{background:rgba(79,211,220,.1)}.city-suggestions span{display:grid}.city-suggestions small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48;margin-top:2px}.city-search-empty{position:absolute;left:0;right:0;top:44px;padding:10px 11px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:#0e171d;box-shadow:0 18px 50px rgba(0,0,0,.42);font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4;color:#b7c1c7}.project-dock{position:absolute;z-index:26;top:91px;left:50%;transform:translateX(-50%);width:min(1180px,calc(100vw - 210px));min-height:96px;padding:10px 12px;border:1px solid rgba(79,211,220,.28);border-radius:15px;background:rgba(7,14,19,.91);backdrop-filter:blur(18px);box-shadow:0 16px 45px rgba(0,0,0,.34);display:grid;grid-template-columns:minmax(200px,1fr) auto;grid-template-areas:'copy stats' 'routing buttons';align-items:center;gap:8px 13px}.project-dock.with-panel{left:575px;right:18px;width:auto;transform:none}.project-dock.edit-focus{left:16px;right:16px;width:auto;transform:none;grid-template-columns:minmax(190px,1fr) minmax(360px,auto);grid-template-areas:'copy stats' 'edit edit' 'routing buttons'}.project-dock.edit-focus .project-stats{display:grid;grid-template-columns:repeat(5,minmax(76px,1fr));min-width:0}.project-dock.edit-focus .project-stats span{min-width:0}.project-dock.edit-focus .project-copy{min-width:0}.project-dock.warning{border-color:rgba(242,179,80,.46)}.project-copy{grid-area:copy;display:grid;gap:2px;min-width:190px}.project-copy strong{font-size:calc(13px * var(--clu-text-scale,1))}.project-copy small{font-size:calc(10px * var(--clu-text-scale,1));opacity:.58;line-height:1.35}.project-kicker{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#75dbe2}.project-stats{grid-area:stats;display:flex;gap:7px;min-width:0}.project-stats span{min-width:92px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.045);display:grid;gap:1px}.project-stats small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.project-stats b{font-size:calc(11px * var(--clu-text-scale,1))}.project-stats em{font-size:calc(8px * var(--clu-text-scale,1));font-style:normal;color:#83dfe5;margin-top:1px}.project-preview-stat{box-shadow:inset 0 0 0 1px rgba(79,211,220,.16);background:rgba(79,211,220,.065)!important}.project-preview-over{box-shadow:inset 0 0 0 1px rgba(255,121,121,.32);background:rgba(176,55,55,.1)!important}.project-preview-over b,.project-preview-over em{color:#ff9d9d!important}.project-warning b{color:#f0bd68}.project-edit-actions,.project-routing-actions,.project-buttons{display:flex;gap:6px;align-items:center;min-width:0}.project-routing-actions{grid-area:routing}.project-buttons{grid-area:buttons;justify-content:flex-end;flex-wrap:wrap}.project-edit-actions{grid-area:edit}.project-routing-actions{padding:4px 6px;border-radius:10px;background:rgba(6,13,18,.38);border:1px solid rgba(255,255,255,.06)}.project-routing-actions>span{display:grid;min-width:54px}.project-routing-actions small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.45}.project-routing-actions b{font-size:calc(9px * var(--clu-text-scale,1))}.project-routing-actions button{padding:7px 8px!important;font-size:calc(9px * var(--clu-text-scale,1))}.project-routing-actions button.active{background:rgba(79,211,220,.16)!important;border-color:rgba(79,211,220,.38)!important;color:#a9f7fb}.project-edit-actions{min-width:0}.selected-edit-station{display:grid;min-width:140px;max-width:220px;padding:6px 9px;border-radius:9px;background:rgba(79,211,220,.08);border:1px solid rgba(79,211,220,.14)}.selected-edit-station small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.selected-edit-station b{font-size:calc(10px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.danger-edit{color:#ff9d9d!important}.project-dock button:disabled{opacity:.36;cursor:not-allowed}.project-dock button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}.project-primary{background:rgba(79,211,220,.17)!important;border-color:rgba(79,211,220,.42)!important}.project-cancel{color:#ff9d9d!important}.project-history-actions{display:flex;gap:4px;padding-right:3px;border-right:1px solid rgba(255,255,255,.08)}.project-history-actions button{padding:8px 9px}.project-history-actions span{display:none;font-size:calc(9px * var(--clu-text-scale,1))}.bilan-backdrop{position:absolute;inset:0;z-index:64;background:rgba(0,0,0,.5);backdrop-filter:blur(9px);display:grid;place-items:center}.tool-dock{position:absolute;z-index:20;left:18px;top:94px;display:grid;gap:6px;padding:7px;border-radius:15px;border:1px solid rgba(255,255,255,.09);background:rgba(8,14,19,.76);backdrop-filter:blur(16px)}.tool-dock button{position:relative;width:56px;min-height:49px;border:0;border-radius:10px;background:transparent;color:inherit;display:grid;place-items:center;gap:1px;cursor:pointer}.tool-dock button.active{background:rgba(255,255,255,.10)}.tool-dock b{font-size:calc(16px * var(--clu-text-scale,1))}.tool-dock span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.6}.tool-dock i{position:absolute;right:3px;top:3px;min-width:15px;height:15px;padding:0 3px;border-radius:99px;background:#f5b45f;color:#111;font:700 calc(9px * var(--clu-text-scale,1))/15px sans-serif}.side-panel{position:absolute;z-index:17;left:87px;top:94px;bottom:18px;width:min(410px,calc(100vw - 120px));border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(8,14,19,.86);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.28);overflow:hidden}.panel-top{height:38px;padding:0 12px 0 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.65}.panel-top-actions{display:flex;align-items:center;gap:8px;padding-left:6px}.panel-top button{width:28px;height:28px;border:0;background:transparent;color:inherit;font-size:calc(20px * var(--clu-text-scale,1));cursor:pointer;display:grid;place-items:center}.panel-top-actions button:first-child{border:1px solid rgba(79,211,220,.14);border-radius:8px;color:#9cecf0;font-size:calc(12px * var(--clu-text-scale,1));font-weight:800}.panel-top-actions button:last-child{opacity:.78}.panel-scroll{height:calc(100% - 38px);overflow:auto;padding:18px;scrollbar-width:thin}.menu-backdrop,.action-backdrop,.borrow-confirmation-backdrop{position:absolute;inset:0;z-index:60;background:rgba(0,0,0,.44);backdrop-filter:blur(8px);display:grid;place-items:center}.borrow-confirmation-backdrop{z-index:66;background:rgba(0,0,0,.56)}.pause-menu{width:min(390px,calc(100vw - 40px));animation:pause-in .18s ease-out;padding:22px;border-radius:20px;background:#10181e;border:1px solid rgba(255,255,255,.12);display:grid;gap:9px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.pause-menu h2{margin:2px 0 0}.pause-hero p{margin:5px 0 8px;font-size:calc(11px * var(--clu-text-scale,1));opacity:.55}.pause-rules{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 10px}.pause-rules span{padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.05);font-size:calc(9px * var(--clu-text-scale,1));color:rgba(255,255,255,.62)}.pause-menu button{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:11px;transition:transform .16s ease,background .16s ease,border-color .16s ease}.pause-menu button:hover{transform:translateY(-1px);background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.18)}.pause-menu button span{display:grid;gap:2px}.pause-menu button small{opacity:.5}.pause-menu button.resume{background:rgba(69,211,219,.14);border-color:rgba(69,211,219,.35)}.settings-dialog{width:min(820px,calc(100vw - 40px));max-height:min(760px,calc(100vh - 40px));display:grid;grid-template-rows:auto minmax(0,1fr);border-radius:20px;background:#10181e;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}.settings-dialog__header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.08)}.settings-dialog__header h2{margin:2px 0 0;font-size:calc(20px * var(--clu-text-scale,1))}.settings-dialog__header button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.05);color:inherit;font-size:calc(21px * var(--clu-text-scale,1));cursor:pointer}.settings-dialog__scroll{min-height:0;overflow:auto;padding:18px;scrollbar-width:thin}.action-dialog{width:min(430px,calc(100vw - 38px));padding:22px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:#10191f;box-shadow:0 24px 80px rgba(0,0,0,.5)}.action-dialog h3{margin:5px 0 7px}.action-dialog p{margin:0;font-size:calc(12px * var(--clu-text-scale,1));line-height:1.6;opacity:.72}.borrow-confirmation-dialog{width:min(470px,calc(100vw - 38px));padding:22px;border-radius:18px;border:1px solid rgba(79,211,220,.22);background:#10191f;box-shadow:0 24px 80px rgba(0,0,0,.55)}.borrow-confirmation-dialog h3{margin:5px 0 7px}.borrow-confirmation-dialog>p{margin:0;font-size:calc(12px * var(--clu-text-scale,1));line-height:1.55;opacity:.72}.borrow-confirmation-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:15px}.borrow-confirmation-summary span{display:grid;gap:3px;padding:10px;border-radius:10px;background:rgba(255,255,255,.045)}.borrow-confirmation-summary small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.borrow-confirmation-summary strong{font-size:calc(11px * var(--clu-text-scale,1));overflow-wrap:anywhere}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.dialog-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:8px 11px;cursor:pointer}.dialog-actions .finance-action{background:rgba(79,211,220,.16);border-color:rgba(79,211,220,.38)}.station-name-backdrop{position:absolute;inset:0;z-index:57;background:rgba(0,0,0,.38);backdrop-filter:blur(5px);display:grid;place-items:center}.station-name-dialog{width:min(420px,calc(100vw - 38px));padding:20px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:#0f181e;box-shadow:0 24px 70px rgba(0,0,0,.48)}.station-name-dialog h3{margin:6px 0}.station-name-dialog p{font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;opacity:.62}.station-name-dialog input{width:100%;box-sizing:border-box;margin:8px 0 10px;padding:10px 11px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#142027;color:inherit;outline:none}.station-name-actions{display:grid;grid-template-columns:auto 1fr;gap:8px}.station-name-dialog button{padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.station-name-dialog .confirm{border-color:rgba(79,211,220,.38);background:rgba(79,211,220,.16)}.station-name-dialog .cancel{color:#ffc0c0}.outside-territory{padding:9px 10px;border-radius:9px;background:rgba(238,172,70,.08);border:1px solid rgba(238,172,70,.16)}.outside-territory strong{color:#f1bd6e}.bankruptcy-backdrop{position:absolute;inset:0;z-index:58;background:rgba(20,4,7,.65);backdrop-filter:blur(9px);display:grid;place-items:center}.bankruptcy-card{width:min(470px,calc(100vw - 40px));padding:24px;border:1px solid rgba(255,105,105,.28);border-radius:20px;background:#171014;box-shadow:0 28px 90px rgba(0,0,0,.55)}.bankruptcy-card h2{margin:4px 0 8px;color:#ff9393}.bankruptcy-card p{font-size:calc(12px * var(--clu-text-scale,1));line-height:1.6;opacity:.72}.bankruptcy-card>div{display:flex;gap:8px;margin-top:16px}.bankruptcy-card button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}.creation-backdrop{position:absolute;inset:0;z-index:55;background:rgba(0,0,0,.36);backdrop-filter:blur(7px);display:grid;place-items:center;padding:12px;box-sizing:border-box}.creation-modal{width:min(500px,calc(100vw - 24px));max-height:calc(100dvh - 24px);box-sizing:border-box;padding:18px 18px 10px;border-radius:20px;background:#0f181e;border:1px solid rgba(255,255,255,.12);box-shadow:0 28px 90px rgba(0,0,0,.5);overflow:hidden}.create-line-button{margin-top:3px;border-top:1px solid rgba(255,255,255,.07)!important}.create-line-button b{font-size:calc(22px * var(--clu-text-scale,1))!important;color:#7ce6ec}.morale-kpi{padding:4px 7px;border-radius:8px}.morale-very-happy{background:rgba(26,112,69,.22);color:#6ce7a3}.morale-happy{background:rgba(66,129,75,.12);color:#9ee8b5}.morale-medium{background:rgba(173,143,46,.11);color:#f2d36d}.morale-tense{background:rgba(168,98,37,.13);color:#f3aa62}.morale-unhappy{background:rgba(163,58,58,.13);color:#ff8b8b}.morale-critical{background:rgba(128,27,27,.24);color:#ff6262}.eyebrow{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;opacity:.5}@keyframes pause-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:1180px){.city-search{width:170px}.top-kpis .passengers-kpi{display:none}.project-dock,.project-dock.with-panel{left:96px;right:16px;width:auto;transform:none;grid-template-columns:minmax(190px,1fr) auto}.project-stats span:nth-child(-n+2){display:none}.project-dock.edit-focus .project-stats{grid-template-columns:repeat(3,minmax(72px,1fr))}.project-dock.edit-focus .project-stats span:nth-child(-n+2){display:none}.project-history-actions span{display:none}}@media(max-width:880px){.borrow-confirmation-summary{grid-template-columns:1fr} .date{display:none}.top-kpis .passengers-kpi,.top-kpis .morale-kpi{display:none}.brand{min-width:0}.city-search{display:none}.side-panel{left:78px;width:calc(100vw - 92px)}.tool-dock{left:10px}.topbar{left:10px;right:10px}.day-button{margin-left:auto}.bilan-button span{display:none}.bilan-button{padding:9px 10px}.project-dock,.project-dock.with-panel,.project-dock.edit-focus{left:12px;right:12px;width:auto;transform:none;top:88px;grid-template-columns:1fr;grid-template-areas:'copy' 'routing' 'edit' 'buttons';gap:7px}.project-stats,.project-dock.edit-focus .project-stats{display:none}.project-edit-actions{flex-wrap:wrap;width:100%}.selected-edit-station{flex:1}.project-routing-actions{width:max-content;max-width:100%;flex-wrap:wrap}.project-buttons{justify-content:flex-start;width:100%}}

/* V45 polish final — recherche, lisibilité financière et préparation d'exploitation */
.budget-kpi strong.money-in{color:#66f3a0!important;font-weight:950;animation:budget-in 2s ease both}.budget-kpi strong.money-out{color:#ff6f79!important;font-weight:950;animation:budget-out 2s ease both}.financial-pulse{left:50%;top:calc(100% + 5px);padding:5px 10px;font-size:calc(17px * var(--clu-text-scale,1));font-weight:1000;border-width:2px;box-shadow:0 8px 26px rgba(0,0,0,.5)}@keyframes budget-in{0%,100%{transform:scale(1)}12%{transform:scale(1.16)}65%{transform:scale(1.04)}}@keyframes budget-out{0%,100%{transform:scale(1)}12%{transform:scale(1.16)}65%{transform:scale(1.04)}}
.search-hub-button{border-top:1px solid rgba(255,255,255,.07)!important}.search-hub-button b{font-size:calc(20px * var(--clu-text-scale,1))!important;color:#9eeef2}.search-hub{position:absolute;z-index:24;left:87px;top:94px;width:min(420px,calc(100vw - 112px));max-height:calc(100vh - 112px);padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:rgba(8,14,19,.96);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.42);display:grid;align-content:start;gap:14px;overflow:auto;scrollbar-width:thin}.search-hub-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px 2px}.search-hub-head>div{display:grid;gap:2px}.search-hub-head>strong{font-size:calc(13px * var(--clu-text-scale,1))}.search-hub-head>button{width:34px;height:34px;border:0;border-radius:9px;background:rgba(255,255,255,.045);color:inherit;font-size:calc(20px * var(--clu-text-scale,1));cursor:pointer}.search-module{display:grid;gap:10px;min-width:0;padding:14px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.search-module>label{font-size:calc(11px * var(--clu-text-scale,1));font-weight:850}.search-input-wrap{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:0 11px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#101a20}.search-input-wrap:focus-within{border-color:rgba(79,211,220,.52);box-shadow:0 0 0 3px rgba(79,211,220,.07)}.search-input-wrap>span{opacity:.55}.search-input-wrap input{min-width:0;width:100%;height:42px;border:0;outline:0;background:transparent;color:inherit;font-size:calc(12px * var(--clu-text-scale,1))}.search-input-wrap input:focus,.search-input-wrap input:focus-visible{outline:0!important;box-shadow:none!important}.search-results{display:grid;gap:4px;max-height:220px;overflow:auto;scrollbar-width:thin;scrollbar-gutter:stable;padding-right:2px}.search-results button{min-height:44px;border:0;border-radius:9px;padding:8px 9px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}.search-results button:hover,.search-results button:focus-visible{background:rgba(79,211,220,.1)}.search-results button>span{display:grid;min-width:0;gap:2px}.search-results strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search-results small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.55;display:flex;align-items:center;gap:4px}.station-results small i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}.search-empty{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;opacity:.58;padding:2px 1px}
.day-progress{width:min(470px,46vw);gap:11px;padding:9px 12px;border-radius:12px}.day-progress span{font-size:calc(9px * var(--clu-text-scale,1));font-weight:700;opacity:.72}.day-progress>div{height:6px}.project-history-actions span{display:inline!important}.project-history-actions button{display:flex;align-items:center;gap:4px}.project-dock.edit-focus .project-stats{grid-template-columns:repeat(5,minmax(76px,1fr))}
.launch-mode-choice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.launch-mode-choice button{padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;text-align:left;display:grid;gap:4px;cursor:pointer}.launch-mode-choice button.active{border-color:rgba(79,211,220,.42);background:rgba(79,211,220,.10)}.launch-mode-choice strong{font-size:calc(12px * var(--clu-text-scale,1))}.launch-mode-choice small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.58}.launch-recommended-card{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;border:1px solid rgba(79,211,220,.16);border-radius:12px;background:rgba(79,211,220,.045)}.launch-recommended-card>div{display:grid;gap:2px}.launch-recommended-card span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.launch-recommended-card strong{font-size:calc(12px * var(--clu-text-scale,1))}.launch-recommended-card p{grid-column:1/-1;margin:4px 0 0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.5;opacity:.62}.launch-manual-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.launch-manual-sections>section{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);display:grid;gap:9px}.launch-manual-sections h3{margin:0;font-size:calc(12px * var(--clu-text-scale,1))}.launch-manual-sections small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.58}.launch-line-fare{grid-column:1/-1}.launch-fare-toggle{display:flex;align-items:flex-start;gap:9px;padding:9px;border-radius:9px;background:rgba(255,255,255,.035)}.launch-fare-toggle>span{display:grid;gap:2px}.launch-fare-toggle input{margin-top:2px;accent-color:#50d2dc}.launch-fare-price{display:grid;grid-template-columns:1fr 120px;align-items:center;gap:10px;font-size:calc(10px * var(--clu-text-scale,1))}.launch-fare-price input{background:#121c23;color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px}
.contract-dialog{width:min(560px,calc(100vw - 38px));padding:26px;position:relative;overflow:hidden;background:linear-gradient(145deg,#10191f,#0c1419);border-color:rgba(123,224,230,.28)}.contract-dialog:before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,#78e0e6,transparent)}.contract-kicker{display:block;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.22em;color:#91e8ec;font-weight:900}.contract-dialog h3{font-size:calc(24px * var(--clu-text-scale,1));margin:7px 0 9px}.contract-dialog p{font-size:calc(12px * var(--clu-text-scale,1));line-height:1.65;opacity:.76}.contract-line{height:1px;background:rgba(255,255,255,.08);margin:18px 0 12px}.contract-signature{margin-left:auto;width:max-content;min-width:170px;padding:4px 28px 4px 0;position:relative;text-align:right;display:grid}.contract-signature small{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.45}.contract-signature strong{font-family:Georgia,serif;font-size:calc(18px * var(--clu-text-scale,1));font-style:italic;font-weight:500;transform:rotate(-3deg);transform-origin:right center;animation:signature-in .55s ease-out both}.contract-signature i{position:absolute;right:0;bottom:2px;width:23px;height:23px;border:1px solid rgba(105,234,171,.6);border-radius:50%;display:grid;place-items:center;color:#70e6a2;font-style:normal;animation:stamp-in .35s .35s ease-out both}.contract-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:22px}.contract-actions button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;border-radius:9px;padding:9px 11px;cursor:pointer}.contract-actions .finance-action{margin-left:auto;background:rgba(79,211,220,.16);border-color:rgba(79,211,220,.38)}@keyframes signature-in{from{opacity:0;transform:translateX(18px) rotate(-8deg)}to{opacity:1;transform:translateX(0) rotate(-3deg)}}@keyframes stamp-in{from{opacity:0;transform:scale(1.55) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(0)}}
@media(max-width:760px){.launch-mode-choice,.launch-recommended-card,.launch-manual-sections{grid-template-columns:1fr}.launch-recommended-card p,.launch-line-fare{grid-column:auto}.search-hub{left:78px;top:94px;width:calc(100vw - 92px);max-height:calc(100vh - 112px)}.contract-actions{align-items:stretch;flex-direction:column-reverse}.contract-actions button{width:100%}.contract-actions .finance-action{margin-left:0}.day-progress{width:min(460px,62vw)}}

/* V49 : le module Voyageurs ajoute une entrée au dock ; le dock reste accessible sur les écrans peu hauts. */
.tool-dock{max-height:calc(100vh - 188px);overflow-y:auto;scrollbar-width:none}.tool-dock::-webkit-scrollbar{display:none}



/* Métropole 2.0 — phase 1 : la carte redevient l'interface principale. */
.tool-dock--simple{max-height:none!important;overflow:visible!important;gap:4px;padding:5px;border-radius:16px;background:rgba(7,13,18,.90);border:1px solid rgba(255,255,255,.09);box-shadow:0 14px 40px rgba(0,0,0,.28);backdrop-filter:blur(16px)}
.tool-dock--simple>button{min-height:54px;border-radius:11px!important;border-top:0!important}
.tool-dock--simple>button b{font-size:calc(18px * var(--clu-text-scale,1));line-height:1}
.tool-dock--simple .divers-hub-button b{font-size:calc(13px * var(--clu-text-scale,1));letter-spacing:.05em}
.tool-dock--simple .management-hub-button{background:rgba(79,211,220,.035)!important}
.tool-dock--simple .management-hub-button i{position:absolute;right:5px;top:5px;min-width:17px;height:17px;border-radius:999px;background:#e57575;color:white;display:grid;place-items:center;font-size:8px;font-style:normal;font-weight:900;padding:0 3px}
@media(max-width:760px){
  .tool-dock.tool-dock--simple{position:fixed;z-index:28;left:8px;right:8px;bottom:8px;top:auto;width:auto;height:60px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:5px;gap:4px;border-radius:17px;overflow:visible!important}
  .tool-dock--simple>button{min-width:0!important;min-height:50px!important;height:50px!important;padding:5px 3px!important;display:grid!important;place-items:center!important;align-content:center!important;gap:2px!important}
  .tool-dock--simple>button b{font-size:18px!important}.tool-dock--simple>button span{font-size:9px!important;line-height:1!important}
  .tool-dock--simple .management-hub-button{margin-top:0;border-top:0!important}
  .side-panel{position:fixed!important;left:8px!important;right:8px!important;bottom:76px!important;top:82px!important;width:auto!important;max-width:none!important;border-radius:18px!important}
  .search-hub{position:fixed!important;left:8px!important;right:8px!important;bottom:76px!important;top:auto!important;width:auto!important;max-height:min(62vh,520px)!important;border-radius:18px!important}
  .time-controls{bottom:80px!important;left:10px!important}
  .day-progress{bottom:80px!important}
}

/* Métropole 2.0 — focus visuel discret : jamais de carré bleu navigateur. */
.game-shell{--p-focus-ring-width:0px;--p-focus-ring-color:transparent;--p-focus-ring-shadow:none}
.game-shell :deep(input:focus),.game-shell :deep(input:focus-visible),.game-shell :deep(textarea:focus),.game-shell :deep(textarea:focus-visible),.game-shell :deep(select:focus),.game-shell :deep(select:focus-visible),.game-shell :deep(button:focus),.game-shell :deep(button:focus-visible),.game-shell :deep([tabindex]:focus),.game-shell :deep([tabindex]:focus-visible){outline:none!important;box-shadow:none!important}
.game-shell :deep(input:focus),.game-shell :deep(input:focus-visible),.game-shell :deep(textarea:focus),.game-shell :deep(textarea:focus-visible),.game-shell :deep(select:focus),.game-shell :deep(select:focus-visible),.game-shell :deep(.search-input-wrap:focus-within),.game-shell :deep(.endpoint-input:focus-within){border-color:rgba(255,255,255,.16)!important;box-shadow:none!important}
.time-readout{display:grid;gap:1px;min-width:72px}.time-readout strong{min-width:0!important;font-size:calc(12px * var(--clu-text-scale,1))}.time-readout small{font-size:calc(7px * var(--clu-text-scale,1));line-height:1.1;opacity:.52;white-space:nowrap}.time-toggle{white-space:nowrap}

/* Métropole 2.0 — phase 4 : les alertes et l'assistant vivent près des contrôles carte. */
.map-context-dock{position:absolute;z-index:30;right:10px;bottom:154px;display:grid;gap:7px}.map-context-dock button{position:relative;width:38px;height:38px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(8,14,19,.88);backdrop-filter:blur(14px);box-shadow:0 9px 28px rgba(0,0,0,.24);color:inherit;display:grid;place-items:center;cursor:pointer}.map-context-dock button.active{border-color:rgba(79,211,220,.38);background:rgba(79,211,220,.13)}.map-context-dock span{font-size:17px;line-height:1}.map-context-dock i{position:absolute;right:-4px;top:-4px;min-width:17px;height:17px;padding:0 3px;border-radius:99px;background:#57d7df;color:#071216;display:grid;place-items:center;font-size:8px;font-style:normal;font-weight:950}.planner-focus-backdrop{position:absolute;z-index:29;inset:72px 0 0;background:rgba(3,9,13,.48);backdrop-filter:blur(1.5px)}
@media(max-width:760px){.map-context-dock{position:fixed;right:8px;bottom:145px}.map-context-dock button{width:40px;height:40px}.planner-focus-backdrop{position:fixed;inset:68px 0 0}}

/* CLU Métropole 2.0 — Phase 15 : barre projet reconstruite.
   Une seule structure : une rangée de résumé, puis une rangée d'outils uniquement
   lorsqu'un arrêt est sélectionné. Aucun CSS historique ne décide de la géométrie. */
.time-controls .day-next-inline{margin-left:2px;background:rgba(79,211,220,.13);border-color:rgba(79,211,220,.28);font-weight:800;white-space:nowrap}.time-controls .day-next-inline:disabled{opacity:.38;cursor:not-allowed}
.side-panel{left:98px}
.project-dock.project-dock--topbar.project-dock--compact{
  position:absolute!important;z-index:36!important;top:8px!important;left:8px!important;right:auto!important;
  width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;min-width:0!important;
  min-height:0!important;height:auto!important;max-height:none!important;
  padding:7px 9px!important;box-sizing:border-box!important;transform:none!important;
  display:block!important;overflow:visible!important;border-radius:14px!important;
}
.project-dock--compact.edit-selected{width:calc(100vw - 16px)!important}
.project-summary-row{display:flex;align-items:center;justify-content:flex-start;gap:8px 11px;min-width:0;width:100%;box-sizing:border-box;white-space:normal;flex-wrap:wrap}
.project-dock--compact.edit-selected .project-summary-row{flex-wrap:wrap!important;white-space:normal!important}
.project-dock--compact:not(.edit-selected) .project-summary-row{width:100%!important;max-width:none!important}
.project-copy{flex:0 1 220px!important;width:auto!important;min-width:175px!important;max-width:235px!important;display:grid!important;gap:1px!important}
.project-copy strong{font-size:calc(12px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-copy small{max-width:230px!important;font-size:calc(8px * var(--clu-text-scale,1));line-height:1.25;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;opacity:.52}.project-kicker{font-size:calc(7px * var(--clu-text-scale,1))}
.project-stats--inline,.project-routing-actions--inline,.project-buttons--inline,.project-global-kpis--inline,.project-edit-actions--inline,.project-edit-secondary-tools{flex:none!important;width:auto!important;margin:0!important;align-self:center!important}
.project-stats--inline{display:flex!important;gap:5px!important;padding-left:10px;border-left:1px solid rgba(255,255,255,.08)}
.project-stats--inline span{min-width:60px!important;min-height:40px!important;padding:5px 7px!important;box-sizing:border-box;display:grid;align-content:center}.project-stats--inline small{font-size:calc(7px * var(--clu-text-scale,1))}.project-stats--inline b{font-size:calc(9px * var(--clu-text-scale,1))}
.project-routing-actions--inline{display:flex!important;align-items:center!important;gap:5px!important;padding:3px 4px 3px 10px!important;border-left:1px solid rgba(255,255,255,.08)!important;border-radius:0 10px 10px 0!important}
.project-routing-actions--inline>span{min-width:54px!important;display:grid;align-content:center}.project-routing-actions--inline small{font-size:calc(6px * var(--clu-text-scale,1))}.project-routing-actions--inline b{font-size:calc(8px * var(--clu-text-scale,1))}.project-routing-actions--inline button{min-height:34px!important;padding:6px 8px!important;font-size:calc(8px * var(--clu-text-scale,1))}
.project-buttons--inline{display:flex!important;align-items:center!important;gap:5px!important;padding-left:10px!important;border-left:1px solid rgba(255,255,255,.08)!important;justify-content:flex-start!important}.project-buttons--inline button{min-height:34px!important;padding:6px 8px!important;font-size:calc(8px * var(--clu-text-scale,1));align-self:center!important}.project-history-actions{display:flex!important;align-items:center!important;gap:4px!important;padding-right:7px!important;margin-right:1px;border-right:1px solid rgba(255,255,255,.08)}.project-history-actions button{min-height:34px!important;padding:6px 7px!important}
.project-global-kpis--inline{display:flex!important;align-items:center!important;gap:5px!important;padding-left:10px!important;border-left:1px solid rgba(255,255,255,.08)!important}.project-global-kpis--inline>span{min-width:66px!important;min-height:40px!important;padding:5px 7px!important;border-radius:8px;box-sizing:border-box;display:grid;align-content:center}.project-global-kpis--inline small{font-size:calc(6px * var(--clu-text-scale,1))}.project-global-kpis--inline strong{font-size:calc(9px * var(--clu-text-scale,1))}
.project-edit-secondary-tools--summary{display:flex!important;align-items:center!important;gap:7px!important;padding-left:10px!important;border-left:1px solid rgba(255,255,255,.08)!important}
.project-insert-action,.project-edit-actions--inline button{min-height:34px!important;padding:6px 8px!important;font-size:calc(8px * var(--clu-text-scale,1));white-space:nowrap}
.project-tools-row{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px 9px!important;flex-wrap:wrap!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;margin-top:7px!important;padding-top:7px!important;border-top:1px solid rgba(255,255,255,.08)!important;overflow:visible!important}
.project-tools-row>.project-edit-actions--inline,.project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:nowrap!important;width:auto!important;margin:0!important}
.project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{padding-left:10px!important;border-left:1px solid rgba(255,255,255,.08)!important}
.project-tools-row .selected-edit-station{min-width:112px!important;max-width:180px!important;padding:5px 7px!important}
.project-tools-row .project-edit-secondary-tools{gap:7px!important}
.project-tools-row .project-edit-secondary-tools .project-routing-actions--inline{padding-left:7px!important}
.project-dock--compact .project-forecast-trigger.active{border-color:rgba(79,211,220,.42)!important;background:rgba(79,211,220,.15)!important;color:#a9f7fb!important}
@media(max-width:1180px){
  .project-dock.project-dock--topbar.project-dock--compact{width:calc(100vw - 16px)!important;right:auto!important;overflow:visible!important;max-height:none!important}
  .project-summary-row{flex-wrap:wrap!important;white-space:normal}.project-dock--compact.edit-selected .project-summary-row{flex-wrap:wrap!important;white-space:normal!important}.project-dock--compact:not(.edit-selected) .project-summary-row{width:100%!important;max-width:none!important}
  .project-copy{flex:1 1 220px!important;max-width:none!important}.project-copy small{max-width:none!important}
  .project-global-kpis--inline{margin-left:0!important}
  .project-tools-row>.project-edit-actions--inline,.project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{gap:4px!important}
  .project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{padding-left:7px!important}
}
@media(max-width:980px){
  .project-dock--compact.edit-selected .project-summary-row{flex-wrap:wrap!important;white-space:normal!important}
  .project-tools-row{align-items:flex-start!important}
  .project-tools-row>.project-edit-actions--inline,.project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{flex-wrap:wrap!important}
}
@media(max-width:760px){
  .project-dock.project-dock--topbar.project-dock--compact{left:6px!important;top:6px!important;width:calc(100vw - 12px)!important;max-width:none!important}
  .project-summary-row{gap:6px 8px}.project-stats--inline,.project-global-kpis--inline{flex-wrap:wrap!important}.project-tools-row{align-items:flex-start!important}
  .project-tools-row>.project-edit-actions--inline,.project-tools-row>.project-edit-secondary-tools,.project-tools-row>.project-buttons--edit{flex-wrap:wrap!important}
}

/* Phase 15 — services temporaires : choix simple, impact réel, coût visible. */
.event-preparation-backdrop{z-index:78}
.event-preparation-dialog{width:min(620px,calc(100vw - 34px));max-height:calc(100vh - 42px);overflow:auto;box-sizing:border-box;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#0d171d;box-shadow:0 28px 90px rgba(0,0,0,.52);scrollbar-width:thin}
.event-preparation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.event-preparation-head h3{margin:4px 0 0;font-size:calc(20px * var(--clu-text-scale,1))}.event-preparation-close{width:34px;height:34px;flex:none;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.055);color:inherit;font-size:20px;cursor:pointer}
.event-preparation-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0}.event-preparation-facts span{display:grid;gap:3px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}.event-preparation-facts small{font-size:9px;opacity:.5}.event-preparation-facts strong{font-size:15px}.event-preparation-dialog>p{margin:4px 0 13px;opacity:.67;line-height:1.5;font-size:12px}
.event-preparation-lines{display:flex;gap:7px;overflow:auto;padding-bottom:3px;scrollbar-width:thin}.event-preparation-lines button{min-width:130px;display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.04);color:inherit;text-align:left;cursor:pointer}.event-preparation-lines button.active{border-color:rgba(79,211,220,.48);background:rgba(79,211,220,.12)}.event-preparation-lines i{width:10px;height:34px;border-radius:999px;flex:none}.event-preparation-lines span{display:grid;min-width:0}.event-preparation-lines b,.event-preparation-lines small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.event-preparation-lines small{opacity:.5;font-size:9px}.event-preparation-empty{padding:12px;border-radius:10px;background:rgba(255,255,255,.035);opacity:.65}
.event-preparation-recommendation{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:8px;margin-top:12px;padding:10px 11px;border-radius:11px;border:1px solid rgba(79,211,220,.18);background:rgba(79,211,220,.055)}.event-preparation-recommendation>div{display:grid;gap:2px}.event-preparation-recommendation span{font-size:9px;opacity:.52}.event-preparation-recommendation strong{font-size:12px}.event-preparation-recommendation button{min-height:36px;padding:7px 10px;border:1px solid rgba(79,211,220,.36);border-radius:9px;background:rgba(79,211,220,.14);color:inherit;cursor:pointer;font-weight:800}.event-preparation-recommendation button:disabled{opacity:.4;cursor:not-allowed}
.event-preparation-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.event-preparation-services button{min-width:0;display:grid;gap:4px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.035);color:inherit;text-align:left;cursor:pointer}.event-preparation-services button.active{border-color:rgba(79,211,220,.5);background:rgba(79,211,220,.12);box-shadow:inset 0 0 0 1px rgba(79,211,220,.08)}.event-preparation-services strong{font-size:11px}.event-preparation-services small{font-size:9px;line-height:1.35;opacity:.55}
.event-preparation-options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.event-preparation-options button{display:grid;gap:3px;padding:13px;border:1px solid rgba(79,211,220,.24);border-radius:12px;background:rgba(79,211,220,.08);color:inherit;text-align:left;cursor:pointer}.event-preparation-options button.strong{border-color:rgba(79,211,220,.46);background:rgba(79,211,220,.14)}.event-preparation-options button:disabled{opacity:.45;cursor:not-allowed}.event-preparation-options small{opacity:.6}.event-preparation-current,.event-preparation-feedback{margin-top:10px;padding:9px 11px;border-radius:10px;background:rgba(72,214,145,.09);border:1px solid rgba(72,214,145,.2);font-size:11px}.event-preparation-feedback{background:rgba(79,211,220,.08);border-color:rgba(79,211,220,.18)}
.event-preparation-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.event-preparation-footer button{padding:9px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.event-preparation-footer button.primary{border-color:rgba(79,211,220,.38);background:rgba(79,211,220,.14)}
@media(max-width:640px){.event-preparation-facts{grid-template-columns:1fr}.event-preparation-recommendation{grid-template-columns:1fr}.event-preparation-services{grid-template-columns:1fr}.event-preparation-options{grid-template-columns:1fr}.event-preparation-dialog{width:calc(100vw - 16px);max-height:calc(100vh - 20px);padding:14px}}
/* V53 · topbar scindée + visibilité de lignes */
.line-visibility-panel{position:absolute;z-index:31;right:58px;bottom:154px;width:min(330px,calc(100vw - 92px));max-height:min(430px,calc(100vh - 210px));display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(8,14,19,.94);box-shadow:0 16px 42px rgba(0,0,0,.35);overflow:hidden}
.line-visibility-panel__head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px;border-bottom:1px solid rgba(255,255,255,.07)}
.line-visibility-panel__head>div{display:grid;gap:2px}.line-visibility-panel__head strong{font-size:12px}.line-visibility-panel__head small{font-size:9px;line-height:1.35;opacity:.52}
.line-visibility-panel__bulk{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.line-visibility-panel__head button{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.05);color:inherit;padding:6px 8px;font-size:9px;cursor:pointer;white-space:nowrap}.line-visibility-panel__head button:disabled{opacity:.35;cursor:default}
.line-visibility-panel__list{overflow:auto;padding:7px;display:grid;gap:4px;scrollbar-width:thin}.line-visibility-panel__list label{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border-radius:9px;cursor:pointer}.line-visibility-panel__list label:hover{background:rgba(255,255,255,.045)}.line-visibility-panel__list label.dimmed{background:rgba(255,255,255,.025);opacity:.72}
.line-visibility-panel__list input{accent-color:#63dce4}.line-visibility-swatch{width:8px;height:24px;border-radius:999px}.line-visibility-name{display:grid;gap:1px;min-width:0}.line-visibility-name b{font-size:10px}.line-visibility-name small{font-size:9px;opacity:.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.line-visibility-panel__list em{font-size:8px;font-style:normal;opacity:.48}.line-visibility-panel__list p{margin:8px;font-size:10px;opacity:.5}
@media(max-width:1080px){.topbar--brand{max-width:34vw}.topbar--stats{max-width:62vw}.top-kpis{gap:8px}}
@media(min-width:821px){.topbar--stats .passengers-kpi,.topbar--stats .morale-kpi{display:grid!important}}
@media(min-width:761px) and (max-width:880px){.topbar--brand{left:10px;right:auto}.topbar--stats{right:10px;left:auto}}
@media(max-width:760px){.topbar--brand{left:8px;right:auto;top:8px;max-width:46vw;min-height:50px}.topbar--stats{right:8px;left:auto;top:8px;max-width:50vw;min-height:50px}.topbar--stats .morale-kpi,.topbar--stats .passengers-kpi,.topbar--stats .challenge-clock{display:none}.top-kpis{gap:5px}.debt-kpi-button{min-width:0}.brand small{display:none}.line-visibility-panel{position:fixed;right:56px;bottom:145px;width:min(320px,calc(100vw - 76px));max-height:calc(100vh - 180px)}}

</style>

<style scoped>
.build-warning{position:absolute;z-index:80;left:50%;top:86px;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));display:flex;align-items:flex-start;gap:9px;padding:9px 12px;border:1px solid rgba(255,107,107,.46);border-radius:11px;background:rgba(30,12,16,.94);box-shadow:0 10px 30px rgba(0,0,0,.34);backdrop-filter:blur(14px);color:#ffe5e5;pointer-events:none}
.build-warning strong{flex:none;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.07em;color:#ff999f}
.build-warning span{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4}
@media(max-width:720px){.build-warning{top:72px;align-items:stretch;flex-direction:column;gap:3px}}
</style>

<style scoped>
.project-routing-lock{display:inline-flex;align-items:center;min-height:28px;padding:0 8px;border-radius:8px;background:rgba(111,212,220,.10);border:1px solid rgba(111,212,220,.18);font-size:calc(9px * var(--clu-text-scale,1));font-weight:800;white-space:nowrap;opacity:.78}

.project-finance-inline{border-color:rgba(110,190,255,.42)!important;background:rgba(80,145,220,.14)!important;color:#cfeaff!important;white-space:nowrap}.project-edit-finance-feedback{display:block;margin:2px 12px 7px;font-size:calc(9px * var(--clu-text-scale,1));color:#b9dcff}



/* Online Phase 2.9 — permissions lisibles + publication d'une sauvegarde existante. */
.online-permission-lock{min-height:220px;display:grid;place-items:center;align-content:center;gap:7px;padding:24px;text-align:center;border:1px dashed rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.025);color:rgba(238,248,252,.78)}
.online-permission-lock>span{width:44px;height:44px;display:grid;place-items:center;border-radius:999px;background:rgba(255,255,255,.06);font-size:20px;filter:grayscale(1)}.online-permission-lock strong{font-size:14px}.online-permission-lock p{margin:0;max-width:310px;font-size:11px;line-height:1.45}.online-permission-lock small{max-width:330px;font-size:9px;line-height:1.45;opacity:.5}
.settings-online-section{margin:14px 0 2px;padding:14px 15px;border:1px solid rgba(86,220,229,.22);border-radius:14px;background:linear-gradient(135deg,rgba(58,186,197,.09),rgba(255,255,255,.018));display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}.settings-online-section>div{display:grid;gap:3px}.settings-online-section strong{font-size:12px}.settings-online-section small{font-size:9px;line-height:1.45;opacity:.58}.settings-online-section>button{border:1px solid rgba(255,255,255,.11);border-radius:9px;background:rgba(255,255,255,.055);color:inherit;padding:9px 12px;cursor:pointer;font-weight:800}.settings-online-section>button.primary{border-color:rgba(83,218,227,.42);background:rgba(83,218,227,.14)}.settings-online-member{font-size:9px;opacity:.58}
.online-publish-backdrop{position:fixed;inset:0;z-index:10080;display:grid;place-items:center;padding:18px;background:rgba(3,10,15,.72);backdrop-filter:blur(10px)}.online-publish-dialog{width:min(720px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:auto;padding:20px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:#0e181f;color:#f2f8fa;box-shadow:0 28px 90px rgba(0,0,0,.58);display:grid;gap:14px}.online-publish-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.online-publish-dialog h2{margin:3px 0 0;font-size:21px}.online-publish-dialog>header>button{width:34px;height:34px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.045);color:inherit;font-size:19px;cursor:pointer}.online-publish-dialog>p{margin:0;font-size:10px;line-height:1.55;opacity:.65}.online-publish-grid{display:grid;grid-template-columns:1.3fr .85fr .85fr;gap:9px}.online-publish-grid>label{display:grid;gap:5px}.online-publish-grid>label>span{font-size:9px;font-weight:800;opacity:.72}.online-publish-grid input,.online-publish-grid select{min-height:39px;box-sizing:border-box;border:1px solid rgba(255,255,255,.11);border-radius:9px;background:#111d25;color:inherit;padding:8px 9px}.online-publish-switch{grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:9px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.online-publish-switch input{min-height:auto;width:auto;accent-color:#5bd7de}.online-publish-switch>span{display:grid;gap:2px}.online-publish-switch small{font-size:8px;opacity:.5}.online-publish-error{padding:9px 11px;border:1px solid rgba(255,106,106,.28);border-radius:9px;background:rgba(180,50,50,.08);color:#ffb0b0!important;opacity:1!important}.online-publish-dialog>footer{display:flex;justify-content:flex-end;gap:8px}.online-publish-dialog>footer button{padding:9px 12px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.05);color:inherit;cursor:pointer}.online-publish-dialog>footer button.primary{border-color:rgba(83,218,227,.4);background:rgba(83,218,227,.15);font-weight:850}.online-publish-dialog button:disabled{opacity:.42;cursor:not-allowed}
@media(max-width:720px){.settings-online-section{grid-template-columns:1fr}.online-publish-grid{grid-template-columns:1fr}.online-publish-switch{grid-column:auto!important}.online-publish-dialog{width:calc(100vw - 18px);padding:15px}}
</style>
