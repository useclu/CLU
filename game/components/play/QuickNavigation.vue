<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { gameCalendarHeaderLabel } from '../../config/calendar'
import { currentGameLocaleTag, formatGameNumberCompact } from '../../config/i18n'
import { useGameClock } from '../../composables/useGameClock'
import { useGameNetwork } from '../../composables/useGameNetwork'
import { useGamePassengers } from '../../composables/useGamePassengers'
import { useGameSimulation } from '../../composables/useGameSimulation'
import { useGameTerritory } from '../../composables/useGameTerritory'
import { useGameTransitRuntime } from '../../composables/useGameTransitRuntime'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { findLineStation, getLineAllStations, getLineServiceRoutes, getLineTerminusStations } from '../../engine/network/geometry'
import { getSegmentCoordinates } from '../../engine/network/pathGeometry'
import { stationDistanceMeters } from '../../engine/transitRuntime'
import type { GamePassengerJourneyLeg, GamePassengerJourneyPlan } from '../../types/passengers'
import type { GameLine, GameStation, GameTransportMode } from '../../types/network'
import { focusGameMapBounds, focusGameMapPoint } from '../../utils/mapBridge'

interface StationPlatform {
  line: GameLine
  station: GameStation
}

interface StationPlace {
  key: string
  name: string
  platforms: StationPlatform[]
  longitude: number
  latitude: number
  searchText: string
}

interface JourneyChoice {
  plan: GamePassengerJourneyPlan
  originPlatform: StationPlatform
  destinationPlatform: StationPlatform
  requestedMinute: number
  boardingMinute: number
}

interface JourneyMapSegment {
  lineId: string
  color: string
  coordinates: Array<[number, number]>
}

interface JourneyMapWalk {
  coordinates: Array<[number, number]>
}

interface JourneyMapPoint {
  longitude: number
  latitude: number
  kind: 'ORIGIN' | 'TRANSFER' | 'DESTINATION'
  label: string
  lineLabel?: string
  lineColor?: string
}

interface JourneyMapHighlight {
  key: string
  segments: JourneyMapSegment[]
  walks: JourneyMapWalk[]
  points: JourneyMapPoint[]
}

interface DirectJourneyAlternative extends JourneyChoice {
  line: GameLine
}

interface JourneyRideStop {
  id: string
  name: string
  minute: number
  first: boolean
  last: boolean
}

interface JourneyRideSection {
  kind: 'RIDE'
  key: string
  line: GameLine | null
  lineCode: string
  fromName: string
  toName: string
  boardMinute: number
  arrivalMinute: number
  waitMinutes: number
  stops: JourneyRideStop[]
}

interface JourneyWalkSection {
  kind: 'WALK'
  key: string
  fromName: string
  toName: string
  minutes: number
  arrivalMinute: number
}

interface NetworkDepartureRow {
  key: string
  line: GameLine
  stationName: string
  directionName: string
  missionCode: string
  etaMinutes: number
  departureMinute: number
}

type JourneySection = JourneyRideSection | JourneyWalkSection
type EndpointKind = 'ORIGIN' | 'DESTINATION'

defineProps<{ compact?: boolean }>()
const emit = defineEmits<{
  plannerChange: [open: boolean]
  journeyChange: [highlight: JourneyMapHighlight | null]
  journeyFocusChange: [focused: boolean]
}>()

const network = useGameNetwork()
const territory = useGameTerritory()
const passengers = useGamePassengers()
const simulation = useGameSimulation()
const clock = useGameClock()
const transitRuntime = useGameTransitRuntime()
const game = useMetropoleGame()

const overlayOpen = ref(false)
const cityQuery = ref('')
const stationQuery = ref('')
const lineQuery = ref('')
const cityInput = ref<HTMLInputElement | null>(null)
const stationInput = ref<HTMLInputElement | null>(null)
const lineInput = ref<HTMLInputElement | null>(null)
const activeSearch = ref<'CITY' | 'STATION' | 'LINE' | null>(null)
const originQuery = ref('')
const destinationQuery = ref('')
const activeEndpoint = ref<EndpointKind | null>(null)
const origin = ref<StationPlace | null>(null)
const destination = ref<StationPlace | null>(null)
const departureMinute = ref(clock.gameMinutes.value)
const selectedJourneyIndex = ref(0)
const selectedDirectAlternativeKey = ref<string | null>(null)
const lineBoardLineId = ref<string | null>(null)
const lineBoardStationId = ref<string | null>(null)
const departureRows = ref<NetworkDepartureRow[]>([])
const departurePage = ref(0)
const departureUpdatedMinute = ref(0)
const departureBoardBusy = ref(false)
let departureBoardTimer: number | null = null
let departureBoardRefreshToken = 0

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(currentGameLocaleTag()).trim()
}

const lineById = computed(() => new Map(network.lines.value.map(line => [line.id, line] as const)))

const stationPlaces = computed<StationPlace[]>(() => {
  const groups = new Map<string, StationPlace>()
  for (const line of network.lines.value) {
    for (const station of getLineAllStations(line)) {
      // Une station physique partagée reste un seul lieu, même si son nom varie légèrement.
      const key = station.sharedStationId ? `shared:${station.sharedStationId}` : `name:${normalize(station.name)}`
      const existing = groups.get(key)
      if (existing) {
        if (!existing.platforms.some(item => item.line.id === line.id && item.station.id === station.id)) existing.platforms.push({ line, station })
        existing.searchText += ` ${normalize(`${line.shortCode} ${line.name}`)}`
        continue
      }
      groups.set(key, {
        key,
        name: station.name,
        platforms: [{ line, station }],
        longitude: station.longitude,
        latitude: station.latitude,
        searchText: `${normalize(station.name)} ${normalize(`${line.shortCode} ${line.name}`)}`,
      })
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, currentGameLocaleTag()))
})

const cityResults = computed(() => {
  const needle = normalize(cityQuery.value)
  if (needle.length < 2) return []
  return territory.municipalities.value
    .filter(item => normalize(item.name).includes(needle))
    .sort((a, b) => Number(!normalize(a.name).startsWith(needle)) - Number(!normalize(b.name).startsWith(needle)) || a.name.localeCompare(b.name, currentGameLocaleTag()))
    .slice(0, 6)
})

const stationResults = computed(() => {
  const needle = normalize(stationQuery.value)
  if (needle.length < 2) return []
  return stationPlaces.value
    .filter(item => item.searchText.includes(needle))
    .sort((a, b) => Number(!normalize(a.name).startsWith(needle)) - Number(!normalize(b.name).startsWith(needle)) || a.name.localeCompare(b.name, currentGameLocaleTag()))
    .slice(0, 6)
})

const lineResults = computed(() => {
  const needle = normalize(lineQuery.value)
  if (needle.length < 1) return []
  return network.lines.value
    .filter(line => normalize(`${line.shortCode} ${line.name}`).includes(needle))
    .sort((a, b) => {
      const aText = normalize(`${a.shortCode} ${a.name}`)
      const bText = normalize(`${b.shortCode} ${b.name}`)
      return Number(!aText.startsWith(needle)) - Number(!bText.startsWith(needle)) || a.shortCode.localeCompare(b.shortCode, currentGameLocaleTag(), { numeric: true })
    })
    .slice(0, 6)
})

function endpointSuggestions(value: string) {
  const needle = normalize(value)
  if (needle.length < 1) return []
  return stationPlaces.value
    .filter(item => item.searchText.includes(needle))
    .sort((a, b) => Number(!normalize(a.name).startsWith(needle)) - Number(!normalize(b.name).startsWith(needle)) || a.name.localeCompare(b.name, currentGameLocaleTag()))
    .slice(0, 5)
}

const originSuggestions = computed(() => endpointSuggestions(originQuery.value))
const destinationSuggestions = computed(() => endpointSuggestions(destinationQuery.value))
const lineBoardOpen = computed(() => Boolean(lineBoardLineId.value))
const journeyFocused = computed(() => Boolean(origin.value && destination.value))

function setOverlayOpen(open: boolean) {
  if (overlayOpen.value === open) return
  overlayOpen.value = open
  emit('plannerChange', open)
  if (open) {
    departureMinute.value = clock.gameMinutes.value
    // Le panneau doit apparaître immédiatement : le calcul des départs est
    // décalé au frame suivant puis découpé en petits lots pour ne pas figer l'UI.
    scheduleDepartureBoardRefresh()
    startDepartureBoardTimer()
  }
  else {
    activeSearch.value = null
    activeEndpoint.value = null
    lineBoardLineId.value = null
    selectedDirectAlternativeKey.value = null
    lineBoardStationId.value = null
    departureBoardRefreshToken += 1
    stopDepartureBoardTimer()
  }
}

async function openSearch() {
  setOverlayOpen(true)
  await nextTick()
  stationInput.value?.focus()
}

function closeSearch() {
  setOverlayOpen(false)
}

function chooseCity(item: (typeof cityResults.value)[number]) {
  focusGameMapBounds(item.bounds)
  cityQuery.value = item.name
  closeSearch()
}

function focusPlace(place: StationPlace) {
  focusGameMapPoint(place.longitude, place.latitude, 14.5)
  stationQuery.value = place.name
  closeSearch()
}

function chooseLine(line: GameLine) {
  const stations = getLineAllStations(line)
  lineBoardLineId.value = line.id
  lineBoardStationId.value = stations[0]?.id ?? null
  activeSearch.value = null
  lineQuery.value = `${line.shortCode} · ${line.name}`
}

const lineBoardLine = computed(() => lineById.value.get(lineBoardLineId.value ?? '') ?? null)
const lineBoardStations = computed(() => lineBoardLine.value ? getLineAllStations(lineBoardLine.value) : [])
const lineBoardStation = computed(() => lineBoardStations.value.find(station => station.id === lineBoardStationId.value) ?? lineBoardStations.value[0] ?? null)
const lineBoardDirections = computed(() => {
  const line = lineBoardLine.value
  const station = lineBoardStation.value
  if (!line || !station) return []
  const directions: string[] = []
  const seen = new Set<string>()
  for (const route of getLineServiceRoutes(line)) {
    const index = route.findIndex(item => item.id === station.id)
    if (index < 0) continue
    const candidates = [index > 0 ? route[0] : null, index < route.length - 1 ? route[route.length - 1] : null]
    for (const candidate of candidates) {
      if (!candidate || candidate.id === station.id || seen.has(candidate.id)) continue
      seen.add(candidate.id)
      directions.push(candidate.name)
    }
  }
  return directions
})
const lineBoardPassages = computed(() => {
  if (!lineBoardLine.value || !lineBoardStation.value) return []
  const stationName = normalize(lineBoardStation.value.name)
  return transitRuntime.stationPassages(lineBoardLine.value.id, lineBoardStation.value.id, 12)
    .filter(passage => normalize(passage.directionName) !== stationName)
    .slice(0, 6)
})

function closeLineBoard() {
  lineBoardLineId.value = null
  lineBoardStationId.value = null
}

function focusLineBoard() {
  const stations = lineBoardStations.value
  if (!stations.length) return
  const longitudes = stations.map(station => station.longitude)
  const latitudes = stations.map(station => station.latitude)
  const west = Math.min(...longitudes); const east = Math.max(...longitudes)
  const south = Math.min(...latitudes); const north = Math.max(...latitudes)
  const epsilon = .01
  focusGameMapBounds({ west: west === east ? west - epsilon : west, east: west === east ? east + epsilon : east, south: south === north ? south - epsilon : south, north: south === north ? north + epsilon : north })
}

function selectEndpoint(kind: EndpointKind, place: StationPlace) {
  departureMinute.value = clock.gameMinutes.value
  selectedJourneyIndex.value = 0
  selectedDirectAlternativeKey.value = null
  if (kind === 'ORIGIN') {
    origin.value = place
    originQuery.value = place.name
  }
  else {
    destination.value = place
    destinationQuery.value = place.name
  }
  activeEndpoint.value = null
}

function swapEndpoints() {
  const previousOrigin = origin.value
  const previousDestination = destination.value
  const previousOriginQuery = originQuery.value
  const previousDestinationQuery = destinationQuery.value
  origin.value = previousDestination
  destination.value = previousOrigin
  originQuery.value = previousDestinationQuery
  destinationQuery.value = previousOriginQuery
  activeEndpoint.value = null
  selectedJourneyIndex.value = 0
  selectedDirectAlternativeKey.value = null
  departureMinute.value = clock.gameMinutes.value
}

function clearEndpoint(kind: EndpointKind) {
  selectedJourneyIndex.value = 0
  selectedDirectAlternativeKey.value = null
  if (kind === 'ORIGIN') {
    origin.value = null
    originQuery.value = ''
  }
  else {
    destination.value = null
    destinationQuery.value = ''
  }
}

function openPlannerForStation(kind: EndpointKind, lineId: string, stationId: string) {
  const place = stationPlaces.value.find(item => item.platforms.some(platform => platform.line.id === lineId && platform.station.id === stationId))
  if (!place) return
  setOverlayOpen(true)
  departureMinute.value = clock.gameMinutes.value
  selectedJourneyIndex.value = 0
  selectedDirectAlternativeKey.value = null
  if (kind === 'ORIGIN') {
    origin.value = place
    originQuery.value = place.name
  }
  else {
    destination.value = place
    destinationQuery.value = place.name
  }
  activeEndpoint.value = kind === 'ORIGIN' ? 'DESTINATION' : 'ORIGIN'
}

function handleRouteStationEvent(event: Event) {
  const detail = (event as CustomEvent<{ kind?: EndpointKind; lineId?: string; stationId?: string }>).detail
  if (!detail?.lineId || !detail.stationId) return
  openPlannerForStation(detail.kind === 'DESTINATION' ? 'DESTINATION' : 'ORIGIN', detail.lineId, detail.stationId)
}

function handleGlobalEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && overlayOpen.value) closeSearch()
}

onMounted(() => {
  window.addEventListener('clu-route-station', handleRouteStationEvent as EventListener)
  window.addEventListener('keydown', handleGlobalEscape)
})
onUnmounted(() => {
  window.removeEventListener('clu-route-station', handleRouteStationEvent as EventListener)
  window.removeEventListener('keydown', handleGlobalEscape)
  stopDepartureBoardTimer()
})

function firstBoardingMinute(plan: GamePassengerJourneyPlan) {
  let minute = plan.departureMinute
  for (const leg of plan.legs) {
    if (leg.kind === 'RIDE') return minute + Math.max(0, leg.waitingMinutes)
    minute += Math.max(0, leg.minutes)
  }
  return minute
}

const journeyBundle = computed(() => {
  if (!origin.value || !destination.value) return { choices: [] as JourneyChoice[], directAlternatives: [] as DirectJourneyAlternative[] }
  const planner = passengers.createJourneyPreview()
  if (!planner) return { choices: [] as JourneyChoice[], directAlternatives: [] as DirectJourneyAlternative[] }

  function bestJourneyAt(minute: number): JourneyChoice | null {
    let best: JourneyChoice | null = null
    const requestedMinute = Math.max(0, Math.round(minute))
    for (const from of origin.value!.platforms) {
      for (const to of destination.value!.platforms) {
        const plan = planner!.plan(from.line.id, from.station.id, to.line.id, to.station.id, requestedMinute)
        if (!plan?.found || plan.totalMinutes === null) continue
        const boardingMinute = firstBoardingMinute(plan)
        if (!best || plan.totalMinutes < (best.plan.totalMinutes ?? Number.POSITIVE_INFINITY)) {
          best = { plan, originPlatform: from, destinationPlatform: to, requestedMinute, boardingMinute }
        }
      }
    }
    return best
  }

  // Cinq fenêtres proches donnent les prochains départs sans relancer un graphe complet :
  // le planner partagé ci-dessus réutilise le même réseau, horaires et PCC.
  const offsets = [0, 15, 30, 45, 60]
  const choices: JourneyChoice[] = []
  const seen = new Set<string>()
  for (const offset of offsets) {
    const choice = bestJourneyAt(departureMinute.value + offset)
    if (!choice) continue
    const signature = `${Math.round(choice.boardingMinute)}:${choice.plan.usedLineIds.join('>')}:${Math.round(choice.plan.arrivalMinute ?? -1)}`
    if (seen.has(signature)) continue
    seen.add(signature)
    choices.push(choice)
  }

  // Un trajet direct reste intéressant même lorsqu'un itinéraire avec correspondance
  // arrive plus tôt. On force ici chaque ligne commune aux deux stations, sans marche
  // ni changement de ligne, et on conserve son vrai prochain départ (même lointain).
  const originByLine = new Map<string, StationPlatform[]>()
  const destinationByLine = new Map<string, StationPlatform[]>()
  for (const platform of origin.value.platforms) originByLine.set(platform.line.id, [...(originByLine.get(platform.line.id) ?? []), platform])
  for (const platform of destination.value.platforms) destinationByLine.set(platform.line.id, [...(destinationByLine.get(platform.line.id) ?? []), platform])
  const directAlternatives: DirectJourneyAlternative[] = []
  for (const [lineId, fromPlatforms] of originByLine) {
    const toPlatforms = destinationByLine.get(lineId)
    const line = lineById.value.get(lineId)
    if (!line || !toPlatforms?.length || line.status !== 'OPERATIONAL') continue
    let bestDirect: DirectJourneyAlternative | null = null
    for (const from of fromPlatforms) {
      for (const to of toPlatforms) {
        if (from.station.id === to.station.id) continue
        const plan = planner.planDirect(lineId, from.station.id, to.station.id, Math.max(0, Math.round(departureMinute.value)))
        if (!plan.found || plan.totalMinutes === null) continue
        const choice: DirectJourneyAlternative = {
          line,
          plan,
          originPlatform: from,
          destinationPlatform: to,
          requestedMinute: departureMinute.value,
          boardingMinute: firstBoardingMinute(plan),
        }
        if (!bestDirect || (choice.plan.totalMinutes ?? Infinity) < (bestDirect.plan.totalMinutes ?? Infinity)) bestDirect = choice
      }
    }
    if (bestDirect) directAlternatives.push(bestDirect)
  }

  const primary = choices[0]
  return {
    choices: choices.slice(0, 5),
    directAlternatives: directAlternatives
      .filter(item => !(primary?.plan.transfers === 0 && primary.plan.walkingMinutes <= 0.01 && primary.plan.usedLineIds.length === 1 && primary.plan.usedLineIds[0] === item.line.id))
      .sort((a, b) => (a.plan.totalMinutes ?? Infinity) - (b.plan.totalMinutes ?? Infinity))
      .slice(0, 3),
  }
})

const journeyOptions = computed(() => journeyBundle.value.choices)
const directAlternatives = computed(() => journeyBundle.value.directAlternatives)
const recommendedJourney = computed(() => journeyOptions.value[selectedJourneyIndex.value] ?? journeyOptions.value[0] ?? null)

function directAlternativeKey(alternative: DirectJourneyAlternative) {
  return `${alternative.line.id}:${Math.round(alternative.boardingMinute)}:${Math.round(alternative.plan.arrivalMinute ?? -1)}`
}

const selectedDirectAlternative = computed(() => selectedDirectAlternativeKey.value
  ? directAlternatives.value.find(alternative => directAlternativeKey(alternative) === selectedDirectAlternativeKey.value) ?? null
  : null)

const journey = computed(() => selectedDirectAlternative.value ?? recommendedJourney.value)

function selectJourneyDeparture(index: number) {
  selectedJourneyIndex.value = index
  selectedDirectAlternativeKey.value = null
}

function selectRecommendedRoute() {
  selectedDirectAlternativeKey.value = null
}

function selectDirectAlternative(alternative: DirectJourneyAlternative) {
  selectedDirectAlternativeKey.value = directAlternativeKey(alternative)
}

watch([() => origin.value?.key, () => destination.value?.key], () => {
  selectedJourneyIndex.value = 0
  selectedDirectAlternativeKey.value = null
})
watch(journeyOptions, options => {
  if (selectedJourneyIndex.value >= options.length) selectedJourneyIndex.value = 0
})
watch(directAlternatives, alternatives => {
  if (selectedDirectAlternativeKey.value && !alternatives.some(alternative => directAlternativeKey(alternative) === selectedDirectAlternativeKey.value)) {
    selectedDirectAlternativeKey.value = null
  }
})

function stationsForRideLeg(leg: GamePassengerJourneyLeg) {
  if (leg.kind !== 'RIDE' || !leg.lineId) return [] as GameStation[]
  const line = lineById.value.get(leg.lineId)
  if (!line) return []
  let best: GameStation[] = []
  for (const route of getLineServiceRoutes(line)) {
    const from = route.findIndex(station => station.id === leg.fromStationId)
    const to = route.findIndex(station => station.id === leg.toStationId)
    if (from < 0 || to < 0) continue
    const segment = from <= to ? route.slice(from, to + 1) : route.slice(to, from + 1).reverse()
    if (!best.length || segment.length < best.length) best = segment
  }
  return best
}

function rideStopCount(plan: GamePassengerJourneyPlan) {
  return plan.legs.reduce((total, leg) => total + (leg.kind === 'RIDE' ? Math.max(0, stationsForRideLeg(leg).length - 1) : 0), 0)
}

const journeyStopCount = computed(() => journey.value ? rideStopCount(journey.value.plan) : 0)

function lineForLeg(leg: GamePassengerJourneyLeg) {
  return leg.lineId ? lineById.value.get(leg.lineId) ?? null : null
}

function modeIcon(line: GameLine | null) {
  if (!line) return '●'
  if (line.mode === 'METRO') return '🚇'
  if (line.mode === 'TRAM') return '🚊'
  if (line.mode === 'CABLE') return '🚡'
  if (line.mode === 'FERRY') return '⛴️'
  if (line.mode === 'BUS' || line.mode === 'BRT') return '🚌'
  return '🚆'
}

function modeLabel(mode: GameTransportMode) {
  if (mode === 'RER') return 'RER'
  if (mode === 'TRAIN') return 'Train'
  if (mode === 'METRO') return 'Métro'
  if (mode === 'TRAM') return 'Tram'
  if (mode === 'CABLE') return 'Téléphérique'
  if (mode === 'FERRY') return 'Navette fluviale'
  if (mode === 'BRT') return 'BRT'
  return 'Bus'
}

function roundedMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function timeLabel(minute: number | null | undefined) {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) return '—'
  const value = ((Math.round(minute) % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function calendarMomentLabel(minute: number | null | undefined, compact = false) {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) return '—'
  const normalized = Math.max(0, Math.round(minute))
  const offset = Math.floor(normalized / 1440)
  const save = game.state.value.save
  const dateLabel = save ? gameCalendarHeaderLabel(simulation.day.value + offset, save.data.calendarStartDate) : `Jour ${simulation.day.value + offset}`
  if (compact && offset === 0) return timeLabel(normalized)
  if (compact && offset === 1) return `Demain ${timeLabel(normalized)}`
  return `${dateLabel} · ${timeLabel(normalized)}`
}

const currentGameMoment = computed(() => `${simulation.currentCalendarLabel.value} · ${timeLabel(clock.gameMinutes.value)}`)

function waitLabel(minutes: number) {
  const rounded = roundedMinutes(minutes)
  if (rounded < 60) return `dans ${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return `dans ${hours} h${rest ? ` ${rest} min` : ''}`
}

function stopTimeline(stations: GameStation[], startMinute: number, rideMinutes: number) {
  if (!stations.length) return [] as JourneyRideStop[]
  if (stations.length === 1) return [{ id: stations[0]!.id, name: stations[0]!.name, minute: startMinute, first: true, last: true }]
  const segmentDistances = stations.slice(1).map((station, index) => Math.max(1, stationDistanceMeters(stations[index]!, station)))
  const totalDistance = segmentDistances.reduce((sum, value) => sum + value, 0)
  let travelled = 0
  return stations.map((station, index) => {
    if (index > 0) travelled += segmentDistances[index - 1] ?? 0
    const ratio = totalDistance > 0 ? travelled / totalDistance : index / Math.max(1, stations.length - 1)
    return {
      id: station.id,
      name: station.name,
      minute: startMinute + rideMinutes * ratio,
      first: index === 0,
      last: index === stations.length - 1,
    }
  })
}

const journeySections = computed<JourneySection[]>(() => {
  const plan = journey.value?.plan
  if (!plan) return []
  const sections: JourneySection[] = []
  let minute = plan.departureMinute
  plan.legs.forEach((leg, index) => {
    if (leg.kind === 'WALK') {
      minute += Math.max(0, leg.minutes)
      sections.push({
        kind: 'WALK',
        key: `walk-${index}-${leg.fromStationId}-${leg.toStationId}`,
        fromName: leg.fromStationName,
        toName: leg.toStationName,
        minutes: roundedMinutes(leg.minutes),
        arrivalMinute: minute,
      })
      return
    }
    const line = lineForLeg(leg)
    const boardMinute = minute + Math.max(0, leg.waitingMinutes)
    const stations = stationsForRideLeg(leg)
    const rideMinutes = Math.max(0, leg.minutes)
    sections.push({
      kind: 'RIDE',
      key: `ride-${index}-${leg.lineId}-${leg.fromStationId}-${leg.toStationId}`,
      line,
      lineCode: leg.lineCode || line?.shortCode || '?',
      fromName: leg.fromStationName,
      toName: leg.toStationName,
      boardMinute,
      arrivalMinute: boardMinute + rideMinutes,
      waitMinutes: roundedMinutes(leg.waitingMinutes),
      stops: stopTimeline(stations, boardMinute, rideMinutes),
    })
    minute = boardMinute + rideMinutes
  })
  return sections
})

const firstRideSection = computed(() => journeySections.value.find((section): section is JourneyRideSection => section.kind === 'RIDE') ?? null)

function stationForLegEnd(lineId: string, stationId: string) {
  const line = lineById.value.get(lineId)
  if (!line) return null
  return findLineStation(line, stationId)
}

function appendPathCoordinates(target: Array<[number, number]>, segment: Array<[number, number]>) {
  for (const coordinate of segment) {
    const previous = target[target.length - 1]
    if (!previous || Math.abs(previous[0] - coordinate[0]) > 1e-9 || Math.abs(previous[1] - coordinate[1]) > 1e-9) {
      target.push(coordinate)
    }
  }
}

const journeyMapHighlight = computed<JourneyMapHighlight | null>(() => {
  const choice = journey.value
  if (!overlayOpen.value || !choice?.plan?.found) return null
  const segments: JourneyMapSegment[] = []
  const walks: JourneyMapWalk[] = []
  const points: JourneyMapPoint[] = []
  const pointByKey = new Map<string, JourneyMapPoint>()

  function addPoint(station: GameStation | null, kind: JourneyMapPoint['kind'], label: string, line: GameLine | null = null) {
    if (!station) return
    const key = `${kind}:${station.longitude.toFixed(7)}:${station.latitude.toFixed(7)}`
    const code = line?.shortCode?.trim() || ''
    const existing = pointByKey.get(key)
    if (existing) {
      if (code) {
        const codes = existing.lineLabel ? existing.lineLabel.split(' › ').filter(Boolean) : []
        if (!codes.includes(code)) existing.lineLabel = [...codes, code].join(' › ')
        existing.lineColor = line?.color || existing.lineColor
      }
      return
    }
    const point: JourneyMapPoint = {
      longitude: station.longitude,
      latitude: station.latitude,
      kind,
      label,
      lineLabel: code || undefined,
      lineColor: line?.color,
    }
    pointByKey.set(key, point)
    points.push(point)
  }

  choice.plan.legs.forEach((leg, index) => {
    const lastLeg = index === choice.plan.legs.length - 1
    if (leg.kind === 'RIDE' && leg.lineId) {
      const line = lineById.value.get(leg.lineId)
      const stations = stationsForRideLeg(leg)
      if (line && stations.length >= 2) {
        const coordinates: Array<[number, number]> = []
        for (let stationIndex = 1; stationIndex < stations.length; stationIndex += 1) {
          const from = stations[stationIndex - 1]!
          const to = stations[stationIndex]!
          appendPathCoordinates(coordinates, getSegmentCoordinates(line, from, to) ?? [[from.longitude, from.latitude], [to.longitude, to.latitude]])
        }
        if (coordinates.length >= 2) segments.push({ lineId: line.id, color: line.color, coordinates })
        addPoint(stations[0] ?? null, index === 0 ? 'ORIGIN' : 'TRANSFER', leg.fromStationName, line)
        addPoint(stations[stations.length - 1] ?? null, lastLeg ? 'DESTINATION' : 'TRANSFER', leg.toStationName, line)
      }
      return
    }

    if (leg.kind === 'WALK') {
      const from = stationForLegEnd(leg.fromLineId, leg.fromStationId)
      const to = stationForLegEnd(leg.toLineId, leg.toStationId)
      if (from && to) {
        walks.push({ coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] })
        addPoint(from, index === 0 ? 'ORIGIN' : 'TRANSFER', leg.fromStationName, lineById.value.get(leg.fromLineId) ?? null)
        addPoint(to, lastLeg ? 'DESTINATION' : 'TRANSFER', leg.toStationName, lineById.value.get(leg.toLineId) ?? null)
      }
    }
  })

  const signature = choice.plan.legs.map(leg => `${leg.kind}:${leg.lineId ?? ''}:${leg.fromLineId}:${leg.fromStationId}>${leg.toLineId}:${leg.toStationId}`).join('|')
  return {
    key: `${selectedDirectAlternativeKey.value ?? `recommended:${selectedJourneyIndex.value}`}:${Math.round(choice.boardingMinute)}:${signature}`,
    segments,
    walks,
    points,
  }
})

watch(journeyMapHighlight, highlight => emit('journeyChange', highlight), { immediate: true })
watch([overlayOpen, journeyFocused], ([open, focused]) => emit('journeyFocusChange', Boolean(open && focused)), { immediate: true })

function focusJourney() {
  const stations: GameStation[] = []
  for (const section of journeySections.value) {
    if (section.kind !== 'RIDE' || !section.line) continue
    for (const stop of section.stops) {
      const station = findLineStation(section.line, stop.id)
      if (station) stations.push(station)
    }
  }
  if (!stations.length && origin.value && destination.value) stations.push(origin.value.platforms[0]!.station, destination.value.platforms[0]!.station)
  if (!stations.length) return
  const longitudes = stations.map(station => station.longitude)
  const latitudes = stations.map(station => station.latitude)
  const west = Math.min(...longitudes); const east = Math.max(...longitudes)
  const south = Math.min(...latitudes); const north = Math.max(...latitudes)
  const epsilon = 0.01
  const desktopJourneyPanel = typeof window !== 'undefined' && window.innerWidth > 760
  focusGameMapBounds({
    west: west === east ? west - epsilon : west,
    east: west === east ? east + epsilon : east,
    south: south === north ? south - epsilon : south,
    north: south === north ? north + epsilon : north,
  }, {
    padding: desktopJourneyPanel
      ? { top: 96, right: Math.min(470, Math.max(390, Math.round(window.innerWidth * .31))), bottom: 92, left: 88 }
      : { top: 92, right: 48, bottom: 250, left: 48 },
    maxZoom: 14.2,
    duration: 820,
  })
}

watch(() => journeyMapHighlight.value?.key ?? '', key => {
  if (!key) return
  nextTick(() => focusJourney())
})

const BOARD_MODES = new Set<GameTransportMode>(['RER', 'TRAIN', 'METRO', 'TRAM', 'CABLE', 'FERRY'])
const BOARD_PAGE_SIZE = 5

function nextAnimationFrame() {
  return new Promise<void>(resolve => {
    if (typeof window === 'undefined') resolve()
    else window.requestAnimationFrame(() => resolve())
  })
}

function scheduleDepartureBoardRefresh() {
  if (!overlayOpen.value || journeyFocused.value || lineBoardOpen.value || typeof window === 'undefined') return
  const token = ++departureBoardRefreshToken
  window.requestAnimationFrame(() => { void refreshDepartureBoard(token) })
}

async function refreshDepartureBoard(token = ++departureBoardRefreshToken) {
  if (!overlayOpen.value || journeyFocused.value || lineBoardOpen.value || departureBoardBusy.value) return
  departureBoardBusy.value = true
  try {
    const rows: NetworkDepartureRow[] = []
    let processed = 0
    for (const line of network.lines.value) {
      if (token !== departureBoardRefreshToken || !overlayOpen.value || journeyFocused.value || lineBoardOpen.value) return
      if (line.status !== 'OPERATIONAL' || !BOARD_MODES.has(line.mode)) continue
      const termini = getLineTerminusStations(line)
      let best: NetworkDepartureRow | null = null
      for (const terminal of termini) {
        const stationName = normalize(terminal.name)
        const passage = transitRuntime.stationPassages(line.id, terminal.id, 4)
          .find(item => normalize(item.directionName) !== stationName)
        if (!passage) continue
        const candidate: NetworkDepartureRow = {
          key: `${line.id}:${terminal.id}:${passage.vehicleId}:${passage.directionName}`,
          line,
          stationName: terminal.name,
          directionName: passage.directionName,
          missionCode: passage.missionCode || line.shortCode,
          etaMinutes: Math.max(0, passage.etaMinutes),
          departureMinute: clock.gameMinutes.value + Math.max(0, passage.etaMinutes),
        }
        if (!best || candidate.etaMinutes < best.etaMinutes) best = candidate
      }
      if (best) rows.push(best)
      processed += 1
      // Les grands réseaux ne monopolisent jamais un long frame au seul clic sur
      // la loupe. Trois lignes puis on rend la main au navigateur.
      if (processed % 3 === 0) await nextAnimationFrame()
    }
    if (token !== departureBoardRefreshToken || !overlayOpen.value || journeyFocused.value || lineBoardOpen.value) return
    departureRows.value = rows.sort((a, b) => a.etaMinutes - b.etaMinutes || a.line.shortCode.localeCompare(b.line.shortCode, currentGameLocaleTag(), { numeric: true }))
    departureUpdatedMinute.value = clock.gameMinutes.value
    const pageCount = Math.max(1, Math.ceil(departureRows.value.length / BOARD_PAGE_SIZE))
    departurePage.value %= pageCount
  }
  finally {
    departureBoardBusy.value = false
    // Si une nouvelle demande est arrivée pendant le calcul (changement de vue,
    // rotation de page), relancer le dernier snapshot après avoir rendu la main.
    if (token !== departureBoardRefreshToken && overlayOpen.value && !journeyFocused.value && !lineBoardOpen.value && typeof window !== 'undefined') {
      const latestToken = departureBoardRefreshToken
      window.requestAnimationFrame(() => { void refreshDepartureBoard(latestToken) })
    }
  }
}

function departureEta(row: NetworkDepartureRow) {
  return Math.max(0, row.departureMinute - clock.gameMinutes.value)
}

const departurePageCount = computed(() => Math.max(1, Math.ceil(departureRows.value.length / BOARD_PAGE_SIZE)))
const visibleDepartureRows = computed(() => {
  const start = departurePage.value * BOARD_PAGE_SIZE
  return departureRows.value.slice(start, start + BOARD_PAGE_SIZE)
})

function advanceDeparturePage() {
  if (!overlayOpen.value || journeyFocused.value || lineBoardOpen.value) return
  if (departurePageCount.value > 1) departurePage.value = (departurePage.value + 1) % departurePageCount.value
  // La page tourne toutes les 10 s ; le contenu se rafraîchit en arrière-plan,
  // sans bloquer la rotation ni provoquer de clignotement.
  scheduleDepartureBoardRefresh()
}

function startDepartureBoardTimer() {
  stopDepartureBoardTimer()
  if (typeof window === 'undefined') return
  // Rotation volontairement lente : proche d'un écran de gare, pas d'un carrousel publicitaire.
  departureBoardTimer = window.setInterval(advanceDeparturePage, 10_000)
}

function stopDepartureBoardTimer() {
  if (departureBoardTimer !== null) window.clearInterval(departureBoardTimer)
  departureBoardTimer = null
}

watch([journeyFocused, lineBoardOpen], () => {
  if (overlayOpen.value && !journeyFocused.value && !lineBoardOpen.value) scheduleDepartureBoardRefresh()
})

function sameLineBranchTransfer(index: number) {
  if (index <= 0) return null
  const previous = journeySections.value[index - 1]
  const current = journeySections.value[index]
  if (!previous || !current || previous.kind !== 'RIDE' || current.kind !== 'RIDE') return null
  if (!previous.line || !current.line || previous.line.id !== current.line.id) return null
  if (previous.toName !== current.fromName) return null
  return { stationName: current.fromName, lineCode: current.lineCode }
}
</script>

<template>
  <section class="quick-navigation" :class="{ 'overlay-open': overlayOpen }" aria-label="Recherche et itinéraires">
    <button v-if="!overlayOpen" type="button" class="search-launcher" title="Rechercher" aria-label="Ouvrir la recherche" @click="openSearch">⌕</button>

    <Teleport to="body">
      <div v-if="overlayOpen" class="search-overlay-layer" :class="{ 'journey-mode': journeyFocused }">
        <button v-if="!journeyFocused" type="button" class="search-scrim" aria-label="Fermer la recherche" @click="closeSearch" />
        <div class="search-hub" :class="{ 'journey-hub': journeyFocused }" @click.stop>
        <header class="search-hub-head">
          <div><small>CLU · Explorer le réseau</small><strong>{{ journeyFocused ? 'Votre itinéraire' : lineBoardOpen ? 'Horaires de la ligne' : 'Où souhaitez-vous aller ?' }}</strong><span>{{ currentGameMoment }}</span></div>
          <button type="button" aria-label="Fermer" title="Fermer" @click="closeSearch">×</button>
        </header>

        <div v-if="lineBoardOpen && lineBoardLine" class="line-board">
          <header class="line-board-head">
            <div class="line-board-identity"><span class="line-board-badge" :style="{ background: lineBoardLine.color }">{{ lineBoardLine.shortCode }}</span><span><small>Ligne recherchée</small><strong data-i18n-skip>{{ lineBoardLine.name }}</strong></span></div>
            <div class="line-board-actions"><button type="button" @click="focusLineBoard">◎ Carte</button><button type="button" aria-label="Retour" @click="closeLineBoard">←</button></div>
          </header>
          <div class="line-board-direction"><span>Directions depuis cet arrêt</span><strong data-i18n-skip>{{ lineBoardDirections.join(' · ') || '—' }}</strong></div>
          <label class="line-board-station">Arrêt affiché<select v-model="lineBoardStationId"><option v-for="station in lineBoardStations" :key="station.id" :value="station.id" data-i18n-skip>{{ station.name }}</option></select></label>
          <section class="departure-board" :style="{ '--board-accent': lineBoardLine.color }">
            <div class="departure-board-title"><span>{{ lineBoardLine.shortCode }}</span><strong data-i18n-skip>{{ lineBoardStation?.name }}</strong><time>{{ timeLabel(clock.gameMinutes.value) }}</time></div>
            <div v-if="lineBoardPassages.length" class="departure-board-list">
              <article v-for="passage in lineBoardPassages" :key="`${passage.vehicleId}-${passage.direction}-${passage.etaMinutes}`"><span><small>{{ passage.missionCode || lineBoardLine.shortCode }}</small><strong data-i18n-skip>{{ passage.directionName }}</strong></span><b>{{ passage.etaMinutes < .6 ? '<1' : Math.max(1, Math.round(passage.etaMinutes)) }}<small>min</small></b></article>
            </div>
            <p v-else>Aucun prochain départ calculable à cet arrêt pour le moment.</p>
          </section>
          <div class="line-board-footer"><span>{{ lineBoardStations.length }} arrêts</span><span>{{ lineBoardLine.schedule?.mode === 'TIMETABLE' ? 'Horaires personnalisés' : 'Fréquence automatique' }}</span></div>
        </div>

        <template v-else>
          <div v-if="!journeyFocused" class="discovery-grid">
            <section class="search-module">
              <header><span>⌖</span><div><strong>Rechercher une ville</strong><small>Cadrer rapidement une commune</small></div></header>
              <div class="module-input"><input ref="cityInput" v-model="cityQuery" type="search" placeholder="Ex. Meaux" @focus="activeSearch = 'CITY'"><button v-if="cityQuery" type="button" @click="cityQuery = ''">×</button></div>
              <div v-if="activeSearch === 'CITY' && cityResults.length" class="module-results">
                <button v-for="item in cityResults" :key="item.code" type="button" @mousedown.prevent="chooseCity(item)"><span><strong data-i18n-skip>{{ item.name }}</strong><small>{{ formatGameNumberCompact(item.population) }} hab.</small></span><b>⌖</b></button>
              </div>
            </section>

            <section class="search-module">
              <header><span>◎</span><div><strong>Rechercher une station</strong><small>Gare, station ou arrêt du réseau</small></div></header>
              <div class="module-input"><input ref="stationInput" v-model="stationQuery" type="search" placeholder="Ex. Gare de Meaux" @focus="activeSearch = 'STATION'"><button v-if="stationQuery" type="button" @click="stationQuery = ''">×</button></div>
              <div v-if="activeSearch === 'STATION' && stationResults.length" class="module-results">
                <button v-for="place in stationResults" :key="place.key" type="button" @mousedown.prevent="focusPlace(place)"><span><strong data-i18n-skip>{{ place.name }}</strong><small>{{ place.platforms.map(item => item.line.shortCode).join(' · ') }}</small></span><b>◎</b></button>
              </div>
            </section>

            <section class="search-module">
              <header><span>▣</span><div><strong>Rechercher une ligne</strong><small>Indice ou nom de ligne</small></div></header>
              <div class="module-input"><input ref="lineInput" v-model="lineQuery" type="search" placeholder="Ex. RER A" @focus="activeSearch = 'LINE'"><button v-if="lineQuery" type="button" @click="lineQuery = ''">×</button></div>
              <div v-if="activeSearch === 'LINE' && lineResults.length" class="module-results">
                <button v-for="line in lineResults" :key="line.id" type="button" @mousedown.prevent="chooseLine(line)"><span><strong data-i18n-skip>{{ line.shortCode }} · {{ line.name }}</strong><small>{{ modeLabel(line.mode) }} · {{ getLineAllStations(line).length }} arrêts</small></span><i class="mini-line-badge" :style="{ background: line.color }">{{ line.shortCode }}</i></button>
              </div>
            </section>
          </div>

          <section class="mini-route" :class="{ focused: journeyFocused }">
            <header v-if="!journeyFocused"><div><span>⇄</span><strong>Rechercher un itinéraire</strong></div><small>Horaires, PCC et correspondances réelles</small></header>
            <div class="journey-fields">
              <label>
                <span>Départ</span>
                <div class="endpoint-input"><input v-model="originQuery" type="search" placeholder="Station de départ" @focus="activeEndpoint = 'ORIGIN'; activeSearch = null" @input="origin = null"><button v-if="origin" type="button" @click="clearEndpoint('ORIGIN')">×</button></div>
                <div v-if="activeEndpoint === 'ORIGIN' && !origin && originSuggestions.length" class="endpoint-results">
                  <button v-for="place in originSuggestions" :key="place.key" type="button" @mousedown.prevent="selectEndpoint('ORIGIN', place)"><strong data-i18n-skip>{{ place.name }}</strong><small>{{ place.platforms.map(item => item.line.shortCode).join(' · ') }}</small></button>
                </div>
              </label>
              <button type="button" class="swap-route" :disabled="!origin && !destination" title="Inverser le trajet" @click="swapEndpoints">⇅</button>
              <label>
                <span>Arrivée</span>
                <div class="endpoint-input"><input v-model="destinationQuery" type="search" placeholder="Station d’arrivée" @focus="activeEndpoint = 'DESTINATION'; activeSearch = null" @input="destination = null"><button v-if="destination" type="button" @click="clearEndpoint('DESTINATION')">×</button></div>
                <div v-if="activeEndpoint === 'DESTINATION' && !destination && destinationSuggestions.length" class="endpoint-results">
                  <button v-for="place in destinationSuggestions" :key="place.key" type="button" @mousedown.prevent="selectEndpoint('DESTINATION', place)"><strong data-i18n-skip>{{ place.name }}</strong><small>{{ place.platforms.map(item => item.line.shortCode).join(' · ') }}</small></button>
                </div>
              </label>
            </div>
          </section>

          <div v-if="origin && destination && journey" class="journey-board">
            <div class="service-hero">
              <div class="service-identity">
                <span v-if="firstRideSection" class="mode-symbol">{{ modeIcon(firstRideSection.line) }}</span>
                <span v-if="firstRideSection" class="hero-line-badge" :style="{ background: firstRideSection.line?.color ?? '#8ddde2' }">{{ firstRideSection.lineCode }}</span>
                <div><strong data-i18n-skip>{{ origin.name }}</strong><small>Vers <span data-i18n-skip>{{ destination.name }}</span></small></div>
              </div>
              <button type="button" class="map-route-button" @click="focusJourney">◎ Carte</button>
            </div>

            <div class="journey-clockline"><span>Maintenant <b>{{ currentGameMoment }}</b></span><span>Départ recherché <b>{{ calendarMomentLabel(departureMinute) }}</b></span></div>

            <div v-if="directAlternatives.length" class="route-choice-tabs" aria-label="Itinéraires proposés">
              <button type="button" :class="{ active: !selectedDirectAlternativeKey }" @click="selectRecommendedRoute">
                <strong>Recommandé</strong><small v-if="recommendedJourney">{{ roundedMinutes(recommendedJourney.plan.totalMinutes) }} min · {{ recommendedJourney.plan.transfers }} corr.</small>
              </button>
              <button v-for="alternative in directAlternatives" :key="directAlternativeKey(alternative)" type="button" :class="{ active: selectedDirectAlternativeKey === directAlternativeKey(alternative) }" @click="selectDirectAlternative(alternative)">
                <strong>Direct · <span data-i18n-skip>{{ alternative.line.shortCode }}</span></strong><small>{{ roundedMinutes(alternative.plan.totalMinutes) }} min · 0 corr.</small>
              </button>
            </div>

            <div v-if="journeyOptions.length > 1 && !selectedDirectAlternativeKey" class="departure-tabs" aria-label="Départs proches">
              <button v-for="(option, index) in journeyOptions" :key="`${option.requestedMinute}-${option.boardingMinute}-${index}`" type="button" :class="{ active: selectedJourneyIndex === index }" @click="selectJourneyDeparture(index)">
                <strong>{{ calendarMomentLabel(option.boardingMinute, true) }}</strong><small>{{ roundedMinutes(option.plan.totalMinutes) }} min</small>
              </button>
            </div>

            <div class="journey-summary-line">
              <strong>{{ roundedMinutes(journey.plan.totalMinutes) }} min</strong>
              <span>{{ journeyStopCount }} arrêt{{ journeyStopCount > 1 ? 's' : '' }}</span>
              <span>{{ journey.plan.transfers }} correspondance{{ journey.plan.transfers > 1 ? 's' : '' }}</span>
              <b>Arrivée {{ calendarMomentLabel(journey.plan.arrivalMinute, true) }}</b>
            </div>

            <div class="journey-service-list">
              <template v-for="(section, sectionIndex) in journeySections" :key="section.key">
                <div v-if="sameLineBranchTransfer(sectionIndex)" class="same-line-transfer">
                  <span>↪</span>
                  <div><strong>Correspondance sur la même ligne</strong><small><span data-i18n-skip>{{ sameLineBranchTransfer(sectionIndex)?.stationName }}</span> · <span>Changement de branche</span> · <span>Reprenez la ligne</span> <b data-i18n-skip>{{ sameLineBranchTransfer(sectionIndex)?.lineCode }}</b></small></div>
                </div>
                <section v-if="section.kind === 'RIDE'" class="ride-service" :style="{ '--service-color': section.line?.color ?? '#8ddde2' }">
                  <header>
                    <div><span class="mode-symbol small">{{ modeIcon(section.line) }}</span><span class="line-badge" :style="{ background: section.line?.color ?? '#8ddde2' }">{{ section.lineCode }}</span><strong data-i18n-skip>{{ section.line?.name ?? section.lineCode }}</strong></div>
                    <time>{{ calendarMomentLabel(section.boardMinute, true) }}</time>
                  </header>
                  <p v-if="section.waitMinutes" class="boarding-wait">Départ {{ waitLabel(section.waitMinutes) }} · {{ calendarMomentLabel(section.boardMinute, true) }}</p>
                  <p v-else class="boarding-wait good">Départ immédiat</p>
                  <div class="stop-list">
                    <div v-for="stop in section.stops" :key="`${section.key}-${stop.id}`" class="stop-row" :class="{ first: stop.first, last: stop.last }">
                      <div class="rail"><i /></div>
                      <strong data-i18n-skip>{{ stop.name }}</strong>
                      <time>{{ timeLabel(stop.minute) }}</time>
                    </div>
                  </div>
                </section>
                <section v-else class="walk-transfer">
                  <span>🚶</span><div><strong>Correspondance à pied</strong><small><span data-i18n-skip>{{ section.fromName }}</span> → <span data-i18n-skip>{{ section.toName }}</span></small></div><time>{{ section.minutes }} min</time>
                </section>
              </template>
            </div>

            <footer class="journey-foot"><span v-if="roundedMinutes(journey.plan.waitingMinutes)">Attente {{ roundedMinutes(journey.plan.waitingMinutes) }} min</span><span v-if="roundedMinutes(journey.plan.walkingMinutes)">Marche {{ roundedMinutes(journey.plan.walkingMinutes) }} min</span><strong>Arrivée {{ calendarMomentLabel(journey.plan.arrivalMinute) }}</strong></footer>

          </div>
          <div v-else-if="origin && destination" class="journey-empty">Aucun itinéraire disponible à cette heure avec le réseau actuel.</div>

          <section v-if="!journeyFocused" class="network-departures">
            <header><div><span class="board-clock">{{ timeLabel(clock.gameMinutes.value) }}</span><div><strong>Prochains départs du réseau</strong><small>RER · Train · Métro · Tram · Téléphérique · Fluvial</small></div></div><span v-if="departureRows.length">{{ departurePage + 1 }}/{{ departurePageCount }}</span></header>
            <Transition name="board-page" mode="out-in">
              <div :key="departurePage" class="network-departure-list">
                <article v-for="row in visibleDepartureRows" :key="row.key">
                  <span class="board-line-badge" :style="{ background: row.line.color }">{{ row.line.shortCode }}</span>
                  <div><small>{{ modeLabel(row.line.mode) }} · depuis <span data-i18n-skip>{{ row.stationName }}</span></small><strong data-i18n-skip>{{ row.directionName }}</strong></div>
                  <span class="board-mission">{{ row.missionCode }}</span>
                  <b>{{ departureEta(row) < .6 ? 'à quai' : `${Math.max(1, Math.round(departureEta(row)))} min` }}</b>
                </article>
                <p v-if="departureBoardBusy && !visibleDepartureRows.length">Calcul des prochains départs…</p><p v-else-if="!visibleDepartureRows.length">Aucun prochain départ calculable pour le moment.</p>
              </div>
            </Transition>
            <footer><span>Actualisé à {{ timeLabel(departureUpdatedMinute) }}</span><div v-if="departurePageCount > 1"><button v-for="page in departurePageCount" :key="page" type="button" :class="{ active: departurePage === page - 1 }" :aria-label="`Page ${page}`" @click="departurePage = page - 1" /></div><small>Rotation toutes les 10 s</small></footer>
          </section>
        </template>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.quick-navigation{position:absolute;z-index:44;left:18px;bottom:72px;color:#edf6f7}.search-launcher{width:46px;height:46px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(8,14,19,.91);backdrop-filter:blur(16px);box-shadow:0 12px 34px rgba(0,0,0,.32);color:inherit;font-size:22px;cursor:pointer;display:grid;place-items:center}.search-launcher:hover{background:rgba(17,27,34,.96);transform:translateY(-1px)}.search-overlay-layer{position:fixed;z-index:10000;inset:0;width:100vw;height:100dvh;display:grid;place-items:center;padding:27px 17px;box-sizing:border-box;color:#edf6f7;pointer-events:none}.search-scrim{position:absolute;z-index:0;inset:0;border:0;background:rgba(2,7,10,.38);backdrop-filter:blur(6px);cursor:default;pointer-events:auto}.search-hub{position:relative;z-index:1;width:min(860px,100%);max-height:min(820px,100%);overflow:auto;padding:18px;box-sizing:border-box;pointer-events:auto;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(7,13,18,.965);box-shadow:0 30px 100px rgba(0,0,0,.58);display:grid;gap:14px;scrollbar-width:thin}.search-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:2px 2px 4px}.search-hub-head>div{display:grid;gap:2px}.search-hub-head small{font-size:calc(8px * var(--clu-text-scale,1));letter-spacing:.08em;text-transform:uppercase;color:#70dce4}.search-hub-head strong{font-size:calc(21px * var(--clu-text-scale,1))}.search-hub-head span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.search-hub-head>button{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.06);color:inherit;font-size:22px;cursor:pointer}.discovery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.search-module{position:relative;min-width:0;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025);display:grid;gap:9px}.search-module>header{display:flex;align-items:center;gap:8px}.search-module>header>span{width:30px;height:30px;border-radius:9px;background:rgba(79,211,220,.09);display:grid;place-items:center;color:#89e8ed}.search-module>header>div{display:grid;gap:1px;min-width:0}.search-module>header strong{font-size:calc(10px * var(--clu-text-scale,1))}.search-module>header small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.48}.module-input,.endpoint-input{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#101a20;padding:0 4px 0 9px}.module-input:focus-within,.endpoint-input:focus-within{border-color:rgba(106,228,235,.42)}.module-input input,.endpoint-input input{min-width:0;height:38px;border:0;background:transparent;color:inherit;outline:0!important;box-shadow:none!important;font-size:calc(10px * var(--clu-text-scale,1))}.module-input button,.endpoint-input button{width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:inherit;cursor:pointer}.module-results,.endpoint-results{position:absolute;z-index:30;left:8px;right:8px;top:calc(100% - 4px);max-height:220px;overflow:auto;padding:5px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(7,13,18,.995);box-shadow:0 18px 44px rgba(0,0,0,.48);display:grid;gap:2px}.module-results button,.endpoint-results button{border:0;border-radius:8px;background:transparent;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px;text-align:left;cursor:pointer}.module-results button:hover,.endpoint-results button:hover{background:rgba(79,211,220,.08)}.module-results button>span{min-width:0}.module-results strong,.endpoint-results strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(9px * var(--clu-text-scale,1))}.module-results small,.endpoint-results small{display:block;margin-top:2px;font-size:calc(7px * var(--clu-text-scale,1));opacity:.5}.mini-line-badge{min-width:28px;height:24px;padding:0 5px;border-radius:7px;display:grid;place-items:center;color:#071014;font-size:8px;font-style:normal;font-weight:900}.mini-route{position:relative;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025);display:grid;gap:10px}.mini-route.focused{padding:0;border:0;background:transparent}.mini-route>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.mini-route>header>div{display:flex;align-items:center;gap:7px}.mini-route>header>div>span{width:28px;height:28px;border-radius:8px;background:rgba(79,211,220,.09);display:grid;place-items:center;color:#89e8ed}.mini-route>header strong{font-size:calc(10px * var(--clu-text-scale,1))}.mini-route>header small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.48}.journey-fields{display:grid;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);align-items:end;gap:7px}.journey-fields label{position:relative;display:grid;gap:4px}.journey-fields label>span{font-size:calc(8px * var(--clu-text-scale,1));opacity:.55}.endpoint-results{left:0;right:0;top:calc(100% + 5px)}.swap-route,.map-route-button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:inherit;border-radius:8px;cursor:pointer}.swap-route{height:39px}.swap-route:disabled{opacity:.35;cursor:default}.map-route-button{padding:7px 9px;white-space:nowrap}.network-departures{overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:transparent;color:inherit}.network-departures>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.07);background:transparent}.network-departures>header>div{display:flex;align-items:center;gap:10px}.network-departures>header>span{font:800 9px ui-monospace,monospace;opacity:.45}.board-clock{padding:4px 6px;border-radius:6px;background:rgba(255,255,255,.055);color:#b8f2f5;font:850 12px ui-monospace,monospace}.network-departures header strong{display:block;font-size:13px}.network-departures header small{display:block;margin-top:1px;font-size:8px;opacity:.42}.network-departure-list{min-height:245px;display:grid;align-content:start;padding:2px 0;background:transparent}.network-departure-list article{display:grid;grid-template-columns:44px minmax(0,1fr) 55px 68px;align-items:center;gap:9px;min-height:47px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:inherit}.network-departure-list article:last-child{border-bottom:0}.board-line-badge{min-width:40px;height:29px;padding:0 5px;border-radius:7px;display:grid;place-items:center;color:#081014;font-weight:950;font-size:11px}.network-departure-list article>div{min-width:0}.network-departure-list article>div small{display:block;font-size:8px;opacity:.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.network-departure-list article>div strong{display:block;margin-top:1px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.board-mission{padding:3px 5px;border-radius:5px;background:rgba(255,255,255,.055);color:inherit;text-align:center;font:800 9px ui-monospace,monospace}.network-departure-list article>b{justify-self:end;color:#9debf0;font:900 12px ui-monospace,monospace;white-space:nowrap}.network-departure-list>p{margin:0;padding:34px;text-align:center;opacity:.48}.network-departures>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-top:1px solid rgba(255,255,255,.055);background:transparent;font-size:8px;opacity:.46}.network-departures>footer>div{display:flex;gap:5px}.network-departures>footer button{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.18);cursor:pointer}.network-departures>footer button.active{background:#75dce3;transform:scale(1.3)}.board-page-enter-active,.board-page-leave-active{transition:opacity .22s ease,transform .22s ease}.board-page-enter-from{opacity:0;transform:translateY(5px)}.board-page-leave-to{opacity:0;transform:translateY(-5px)}.line-board{display:grid;gap:12px}.line-board-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.line-board-identity{display:flex;align-items:center;gap:10px;min-width:0}.line-board-identity>span:last-child{display:grid;gap:2px;min-width:0}.line-board-identity small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5;text-transform:uppercase;letter-spacing:.08em}.line-board-identity strong{font-size:calc(18px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.line-board-badge{min-width:48px;height:38px;padding:0 10px;border-radius:9px;display:grid;place-items:center;color:#081014;font-weight:950;font-size:calc(15px * var(--clu-text-scale,1))}.line-board-actions{display:flex;gap:6px}.line-board-actions button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:inherit;border-radius:8px;padding:7px 9px;cursor:pointer}.line-board-direction{display:grid;gap:3px;padding:10px;border-radius:10px;background:rgba(255,255,255,.035)}.line-board-direction span,.line-board-station{font-size:calc(9px * var(--clu-text-scale,1));opacity:.62}.line-board-direction strong{font-size:calc(12px * var(--clu-text-scale,1))}.line-board-station{display:grid;gap:5px}.line-board-station select{min-height:38px;border:1px solid rgba(255,255,255,.11);border-radius:9px;background:#101a20;color:inherit;padding:0 9px}.departure-board{border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;background:transparent;color:inherit}.departure-board-title{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border-bottom:1px solid color-mix(in srgb,var(--board-accent,#76c987) 36%,transparent);background:transparent}.departure-board-title>span{padding:4px 7px;border-radius:6px;background:#2d6f43;color:#fff;font-weight:900}.departure-board-title strong{font-size:14px}.departure-board-title time{font:700 14px ui-monospace,monospace;background:rgba(255,255,255,.05);color:#a8edf1;padding:4px 6px;border-radius:5px}.departure-board-list{display:grid}.departure-board-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.055)}.departure-board-list article:last-child{border-bottom:0}.departure-board-list article>span{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:8px}.departure-board-list small{font-size:10px}.departure-board-list article>span>small{padding:3px 5px;background:rgba(255,255,255,.055);color:inherit;text-align:center;font-weight:800;border-radius:4px}.departure-board-list strong{font-size:16px}.departure-board-list b{display:flex;align-items:baseline;gap:3px;font-size:18px;background:transparent;color:#9debf0;padding:4px 7px;min-width:52px;justify-content:center}.departure-board-list b small{font-size:8px;color:inherit;opacity:.5}.departure-board>p{margin:0;padding:18px;text-align:center;opacity:.45}.line-board-footer{display:flex;gap:8px;flex-wrap:wrap}.line-board-footer span{padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.05);font-size:calc(8px * var(--clu-text-scale,1));opacity:.66}.journey-board{min-height:0;overflow:auto;scrollbar-width:thin;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#0d151a}.service-hero{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px 9px;background:linear-gradient(180deg,#0d151a 78%,rgba(13,21,26,.92))}.service-identity{display:flex;align-items:center;gap:9px;min-width:0}.service-identity>div{display:grid;gap:1px;min-width:0}.service-identity strong{font-size:calc(19px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.service-identity small{font-size:calc(10px * var(--clu-text-scale,1));opacity:.62}.mode-symbol{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.07);display:grid;place-items:center;font-size:15px;flex:none}.mode-symbol.small{width:24px;height:24px;font-size:13px}.hero-line-badge,.line-badge{display:grid;place-items:center;color:#081014;font-weight:950;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);flex:none}.hero-line-badge{min-width:42px;height:31px;padding:0 9px;border-radius:8px;font-size:calc(12px * var(--clu-text-scale,1))}.line-badge{min-width:30px;height:25px;padding:0 7px;border-radius:7px;font-size:calc(9px * var(--clu-text-scale,1))}.journey-clockline{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:7px 14px;border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.07);font-size:calc(8px * var(--clu-text-scale,1));opacity:.62}.journey-clockline b{color:#e9fcfd}.departure-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(100px,1fr);overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.1);background:#0d151a;scrollbar-width:none}.departure-tabs::-webkit-scrollbar{display:none}.departure-tabs button{position:relative;border:0;background:transparent;color:inherit;padding:9px 8px;display:grid;gap:2px;cursor:pointer}.departure-tabs button:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:#8de9ee;transform:scaleX(0);transition:transform .15s ease}.departure-tabs button.active:after{transform:scaleX(1)}.departure-tabs strong{font-size:calc(12px * var(--clu-text-scale,1));font-variant-numeric:tabular-nums}.departure-tabs small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.48}.journey-summary-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08)}.journey-summary-line strong{font-size:calc(19px * var(--clu-text-scale,1));color:#a6f2f6}.journey-summary-line span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.56}.journey-summary-line b{margin-left:auto;font-size:calc(9px * var(--clu-text-scale,1));font-weight:800}.journey-service-list{display:grid;padding:0 14px}.ride-service{--service-color:#8ddde2;padding:13px 0 4px}.ride-service+*{border-top:1px solid rgba(255,255,255,.07)}.ride-service header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px}.ride-service header>div{display:flex;align-items:center;gap:7px;min-width:0}.ride-service header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ride-service header time,.stop-row time,.walk-transfer time{font-variant-numeric:tabular-nums;white-space:nowrap}.boarding-wait{margin:5px 0 8px 31px;color:#f2cb73;font-size:calc(9px * var(--clu-text-scale,1));font-weight:700}.boarding-wait.good{color:#78dfa0}.stop-list{display:grid}.stop-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;min-height:42px;gap:7px}.stop-row .rail{align-self:stretch;position:relative;display:grid;place-items:center}.stop-row .rail:before{content:"";position:absolute;top:0;bottom:0;width:5px;border-radius:6px;background:color-mix(in srgb,var(--service-color) 78%,#ffffff 4%)}.stop-row.first .rail:before{top:50%}.stop-row.last .rail:before{bottom:50%}.stop-row .rail i{position:relative;z-index:1;width:10px;height:10px;border-radius:50%;background:#11191f;border:3px solid var(--service-color);box-shadow:0 0 0 2px #0d151a}.stop-row.first .rail i,.stop-row.last .rail i{width:14px;height:14px;background:var(--service-color);border-color:#0d151a;box-shadow:0 0 0 3px var(--service-color)}.stop-row strong{font-size:calc(11px * var(--clu-text-scale,1));font-weight:620}.stop-row time{font-size:calc(11px * var(--clu-text-scale,1));color:#86e3a4}.same-line-transfer{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;margin:4px 0;padding:9px 6px;border-top:1px dashed rgba(141,233,238,.2);border-bottom:1px dashed rgba(141,233,238,.2);color:#c9f6f8}.same-line-transfer>span{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(141,233,238,.1);font-size:13px}.same-line-transfer>div{display:grid;gap:1px}.same-line-transfer strong{font-size:calc(9px * var(--clu-text-scale,1))}.same-line-transfer small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.58}
.walk-transfer{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px 4px;border-top:1px dashed rgba(255,255,255,.14);border-bottom:1px dashed rgba(255,255,255,.14)}.walk-transfer>span{font-size:16px}.walk-transfer>div{display:grid;gap:2px}.walk-transfer strong{font-size:calc(10px * var(--clu-text-scale,1))}.walk-transfer small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.52}.walk-transfer time{font-size:calc(10px * var(--clu-text-scale,1));font-weight:800}.journey-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 14px 10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);font-size:calc(8px * var(--clu-text-scale,1));opacity:.68}.journey-foot strong{margin-left:auto;color:#dffcff}.journey-alternatives{margin:0 14px 14px;border:1px solid rgba(136,225,231,.15);border-radius:12px;overflow:hidden;background:rgba(76,174,181,.04)}.journey-alternatives>header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.07)}.journey-alternatives>header>div{display:grid;gap:1px}.journey-alternatives>header strong{font-size:calc(9px * var(--clu-text-scale,1))}.journey-alternatives>header small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.5}.journey-alternatives>header>span{min-width:22px;height:22px;border-radius:999px;background:rgba(141,233,238,.12);display:grid;place-items:center;font-size:8px}.journey-alternatives article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06)}.journey-alternatives article:last-child{border-bottom:0}.alt-line-badge{min-width:34px;height:27px;padding:0 6px;border-radius:7px;display:grid;place-items:center;color:#081014;font-weight:950;font-size:9px}.journey-alternatives article>div{display:grid;gap:1px;min-width:0}.journey-alternatives article>div strong{font-size:calc(9px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.journey-alternatives article>div small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.52}.alt-times{display:grid;justify-items:end;gap:1px;white-space:nowrap}.alt-times b{font-size:calc(10px * var(--clu-text-scale,1));color:#a6f2f6}.alt-times small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.5}.journey-empty{padding:10px;border-radius:9px;background:rgba(207,87,87,.09);font-size:calc(9px * var(--clu-text-scale,1));color:#ffb1b1}
@media(max-width:850px){.discovery-grid{grid-template-columns:1fr}.search-module{padding:9px}.module-results{position:relative;left:auto;right:auto;top:auto;max-height:150px}.search-hub{width:min(680px,100%);max-height:100%}}
@media(max-width:620px){.quick-navigation{position:fixed;left:10px;bottom:139px}.search-launcher{width:44px;height:44px}.search-overlay-layer{padding:62px 8px 8px;align-items:stretch}.search-hub{width:100%;max-height:100%;border-radius:18px;padding:12px}.search-hub-head strong{font-size:calc(17px * var(--clu-text-scale,1))}.journey-fields{grid-template-columns:1fr}.swap-route{width:100%;height:28px}.journey-summary-line b{margin-left:0;width:100%}.network-departure-list article{grid-template-columns:38px minmax(0,1fr) 58px}.board-mission{display:none}.network-departures>footer>small{display:none}.journey-clockline{display:grid}.journey-alternatives article{grid-template-columns:auto minmax(0,1fr)}.alt-times{grid-column:2;justify-items:start}.map-route-button{font-size:0}.map-route-button:after{content:'◎';font-size:14px}}


/* Navigation cartographique : une fois le trajet calculé, la carte redevient
   l'élément principal et le planificateur adopte un format compact à droite. */
.search-overlay-layer.journey-mode{place-items:stretch end;padding:82px 16px 18px;pointer-events:none}
.search-overlay-layer.journey-mode .search-hub{width:min(410px,calc(100vw - 32px));max-height:calc(100dvh - 100px);padding:12px;border-radius:18px;background:rgba(7,13,18,.94);box-shadow:0 22px 72px rgba(0,0,0,.48);backdrop-filter:blur(18px)}
.search-overlay-layer.journey-mode .search-hub-head strong{font-size:calc(17px * var(--clu-text-scale,1))}
.search-overlay-layer.journey-mode .journey-fields{grid-template-columns:minmax(0,1fr) 30px minmax(0,1fr)}
.search-overlay-layer.journey-mode .endpoint-input input{height:34px}
.search-overlay-layer.journey-mode .swap-route{height:35px}
.search-overlay-layer.journey-mode .journey-board{max-height:none}
.route-choice-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(118px,1fr);gap:6px;overflow-x:auto;padding:8px;border-bottom:1px solid rgba(255,255,255,.08);scrollbar-width:none}
.route-choice-tabs::-webkit-scrollbar{display:none}
.route-choice-tabs button{min-width:0;padding:8px 9px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.035);color:inherit;text-align:left;display:grid;gap:2px;cursor:pointer}
.route-choice-tabs button:hover{background:rgba(116,224,231,.08)}
.route-choice-tabs button.active{border-color:rgba(116,224,231,.42);background:rgba(77,198,207,.13);box-shadow:inset 0 0 0 1px rgba(116,224,231,.08)}
.route-choice-tabs strong{font-size:calc(9px * var(--clu-text-scale,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.route-choice-tabs small{font-size:calc(7px * var(--clu-text-scale,1));opacity:.55;white-space:nowrap}
@media(max-width:760px){.search-overlay-layer.journey-mode{padding:62px 8px 8px;place-items:stretch}.search-overlay-layer.journey-mode .search-hub{width:100%;max-height:100%;border-radius:18px}.search-overlay-layer.journey-mode .journey-fields{grid-template-columns:1fr}.route-choice-tabs{grid-auto-columns:minmax(112px,72vw)}}

</style>
