<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatGameNumberCompact } from '../../config/i18n'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameOperations } from '../../composables/useGameOperations'
import { useGameSimulation } from '../../composables/useGameSimulation'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { gameDayAndMinuteFromAbsolute } from '../../engine/operations'
import { getLineAllStations, getLineServiceRoutes } from '../../engine/network/geometry'
import { gameTimeLabel } from '../../engine/timetable'
import type { GameLine } from '../../types/network'
import type { GameManualDisruption, GameTripOverride } from '../../types/operations'

const emit = defineEmits<{ close: [] }>()

const game = useMetropoleGame()
const operations = useGameOperations()
const simulation = useGameSimulation()
const i18n = useGameI18n()

const lines = computed<GameLine[]>(() => game.state.value.save?.data.network.lines ?? [])
const selectedLineId = ref('ALL')
const selectedLine = computed(() => selectedLineId.value === 'ALL'
  ? null
  : lines.value.find(line => line.id === selectedLineId.value) ?? null)

watch(lines, currentLines => {
  if (selectedLineId.value !== 'ALL' && !currentLines.some(line => line.id === selectedLineId.value)) selectedLineId.value = 'ALL'
})

function slugify(value: string) {
  const slug = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return slug || 'ligne_clu'
}

function lineHandle(line: GameLine) {
  return `@${slugify(line.name || line.shortCode || 'ligne_clu')}`
}

function reportForLine(lineId: string) {
  return simulation.lastDayReport.value?.lines.find(item => item.lineId === lineId) ?? null
}

function followerCount(line: GameLine) {
  const passengers = Math.max(0, Number(reportForLine(line.id)?.passengers ?? 0))
  return Math.max(180, Math.round(passengers * .28 + getLineAllStations(line).length * 95))
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function stationIdsForDisruption(line: GameLine, item: GameManualDisruption) {
  const stations = getLineAllStations(line)
  const stationById = new Map(stations.map(station => [station.id, station] as const))
  if (item.scope === 'LINE') return stations.map(station => station.id)
  if (item.scope === 'STATIONS') return item.stationIds.filter(id => stationById.has(id))
  if (!item.segmentFromStationId || !item.segmentToStationId) return []
  for (const route of getLineServiceRoutes(line)) {
    const from = route.findIndex(station => station.id === item.segmentFromStationId)
    const to = route.findIndex(station => station.id === item.segmentToStationId)
    if (from < 0 || to < 0) continue
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    return route.slice(low, high + 1).map(station => station.id)
  }
  return [item.segmentFromStationId, item.segmentToStationId].filter(id => stationById.has(id))
}

function audienceShare(line: GameLine, stationIds: string[], wholeLine = false) {
  if (wholeLine) return 1
  const stations = getLineAllStations(line)
  if (!stationIds.length || !stations.length) return .16
  const reportStationById = new Map((reportForLine(line.id)?.stations ?? []).map(station => [station.stationId, station] as const))
  const allFootfall = stations.reduce((sum, station) => sum + Math.max(0, reportStationById.get(station.id)?.estimatedDailyFootfall ?? 0), 0)
  if (allFootfall > 0) {
    const affected = stationIds.reduce((sum, id) => sum + Math.max(0, reportStationById.get(id)?.estimatedDailyFootfall ?? 0), 0)
    return Math.max(.08, Math.min(1, affected / allFootfall))
  }
  return Math.max(.08, Math.min(1, stationIds.length / stations.length))
}

function disruptionReplyCount(line: GameLine, item: GameManualDisruption) {
  const severity = { MINOR: .55, MODERATE: 1, MAJOR: 1.85, CRITICAL: 3.2 }[item.severity]
  const affectedIds = stationIdsForDisruption(line, item)
  const scopeShare = audienceShare(line, affectedIds, item.scope === 'LINE')
  const scopeBoost = item.scope === 'LINE' ? 1.75 : .62 + scopeShare * 1.9
  const suspensionBoost = item.suspended ? 1.65 : 1
  const followerBase = Math.max(120, followerCount(line))
  const jitter = .86 + (hashString(item.id) % 31) / 100
  return Math.max(2, Math.round((3 + Math.sqrt(followerBase) * 1.45) * severity * scopeBoost * suspensionBoost * jitter))
}

function overrideReplyCount(line: GameLine, item: GameTripOverride) {
  const intensity = item.cancelled ? 1.5 : item.shortTurnStationId || item.skippedStationIds.length ? 1.2 : Math.min(1.35, .55 + item.delayMinutes / 24)
  const jitter = .82 + (hashString(item.id) % 37) / 100
  return Math.max(1, Math.round((2 + Math.sqrt(Math.max(120, followerCount(line))) * .55) * intensity * jitter))
}

function disruptionScopeLabel(line: GameLine, item: GameManualDisruption) {
  const stations = getLineAllStations(line)
  const stationById = new Map(stations.map(station => [station.id, station] as const))
  if (item.scope === 'LINE') return i18n.t('Toute la ligne')
  if (item.scope === 'SEGMENT') {
    const from = stationById.get(item.segmentFromStationId ?? '')?.name
    const to = stationById.get(item.segmentToStationId ?? '')?.name
    if (from && to) return `${from} ↔ ${to}`
  }
  const names = stationIdsForDisruption(line, item).map(id => stationById.get(id)?.name).filter(Boolean) as string[]
  if (names.length <= 2) return names.join(' · ') || i18n.t('Secteur local')
  return `${names[0]} · ${names[1]} +${names.length - 2}`
}

function disruptionStatus(item: GameManualDisruption) {
  if (item.suspended) return i18n.t('Trafic interrompu')
  if (item.type === 'WORKS') return i18n.t('Travaux')
  if (item.type === 'STAFF') return i18n.t('Mouvement social')
  if (item.severity === 'CRITICAL') return i18n.t('Trafic très perturbé')
  if (item.severity === 'MAJOR') return i18n.t('Trafic perturbé')
  if (item.delayMinutes >= 8) return i18n.t('Retards')
  return i18n.t('Information trafic')
}

function disruptionAutoMessage(item: GameManualDisruption) {
  if (item.suspended) return i18n.t('Le trafic est interrompu sur la zone concernée. Nos équipes suivent la situation.')
  if (item.type === 'WORKS') return i18n.t('Des travaux modifient la circulation sur la zone concernée.')
  if (item.type === 'STAFF') return i18n.t('Un mouvement social perturbe la circulation sur la ligne.')
  if (item.severity === 'CRITICAL' || item.severity === 'MAJOR') return i18n.t('Le trafic est fortement perturbé. Prévoyez un temps de trajet supplémentaire.')
  if (item.delayMinutes > 0) return i18n.t('Des retards sont à prévoir sur la zone concernée.')
  return i18n.t('Une perturbation est en cours sur la ligne.')
}

function absoluteMomentLabel(absoluteMinute: number) {
  const parsed = gameDayAndMinuteFromAbsolute(absoluteMinute)
  return `${i18n.t('Jour')} ${parsed.day} · ${gameTimeLabel(parsed.minute)}`
}

interface SocialPost {
  id: string
  line: GameLine
  sortMinute: number
  status: string
  scope: string
  message: string
  replies: number
  reactions: number
  moment: string
  tone: 'INFO' | 'WARNING' | 'DANGER'
}

function disruptionPost(line: GameLine, item: GameManualDisruption): SocialPost {
  const replies = disruptionReplyCount(line, item)
  return {
    id: `disruption:${item.id}`,
    line,
    sortMinute: item.startsAtAbsoluteMinute,
    status: disruptionStatus(item),
    scope: disruptionScopeLabel(line, item),
    message: item.passengerMessage || disruptionAutoMessage(item),
    replies,
    reactions: Math.max(replies + 2, Math.round(replies * (1.8 + (hashString(`${item.id}:likes`) % 80) / 100))),
    moment: absoluteMomentLabel(item.startsAtAbsoluteMinute),
    tone: item.suspended || item.severity === 'CRITICAL' ? 'DANGER' : item.severity === 'MAJOR' || item.type === 'STAFF' || item.type === 'WORKS' ? 'WARNING' : 'INFO',
  }
}

function overrideMessage(line: GameLine, item: GameTripOverride) {
  const mission = line.schedule?.missions.find(mission => mission.id === item.missionId)
  const stationById = new Map(getLineAllStations(line).map(station => [station.id, station] as const))
  const missionLabel = mission?.code || line.shortCode || ''
  if (item.cancelled) return `${i18n.t('Une circulation est supprimée par le PCC.')} ${missionLabel}`.trim()
  if (item.shortTurnStationId) {
    const station = stationById.get(item.shortTurnStationId)?.name
    return station ? `${i18n.t('Une circulation est limitée avant son terminus habituel.')} ${station}` : i18n.t('Une circulation est limitée avant son terminus habituel.')
  }
  if (item.skippedStationIds.length) return i18n.t('Une circulation est déviée et ne dessert pas tous les arrêts habituels.')
  return `${i18n.t('Un retard ponctuel affecte une circulation.')} +${Math.max(1, Math.round(item.delayMinutes))} min`
}

function overrideStatus(item: GameTripOverride) {
  if (item.cancelled) return i18n.t('Circulation supprimée')
  if (item.shortTurnStationId || item.skippedStationIds.length) return i18n.t('Desserte modifiée')
  return i18n.t('Retard ponctuel')
}

function overridePost(line: GameLine, item: GameTripOverride): SocialPost {
  const replies = overrideReplyCount(line, item)
  const absolute = (Math.max(1, item.day) - 1) * 1440 + item.scheduledDepartureMinute
  return {
    id: `override:${item.id}`,
    line,
    sortMinute: absolute,
    status: overrideStatus(item),
    scope: i18n.t('Une circulation'),
    message: overrideMessage(line, item),
    replies,
    reactions: Math.max(1, Math.round(replies * 1.45)),
    moment: absoluteMomentLabel(absolute),
    tone: item.cancelled ? 'DANGER' : item.shortTurnStationId || item.skippedStationIds.length || item.delayMinutes >= 15 ? 'WARNING' : 'INFO',
  }
}

const posts = computed<SocialPost[]>(() => {
  const current = operations.currentAbsoluteMinute.value
  const lowerBound = Math.max(0, current - 2 * 1440)
  const currentDay = operations.day.value
  const sourceLines = selectedLine.value ? [selectedLine.value] : lines.value
  const lineIds = new Set(sourceLines.map(line => line.id))
  const lineById = new Map(sourceLines.map(line => [line.id, line] as const))

  const disruptions = operations.state.value.disruptions
    .filter(item => lineIds.has(item.lineId) && item.endsAtAbsoluteMinute >= lowerBound)
    .map(item => disruptionPost(lineById.get(item.lineId)!, item))

  const overrides = operations.state.value.tripOverrides
    .filter(item => lineIds.has(item.lineId) && item.day >= currentDay - 1 && (item.cancelled || item.delayMinutes > 0 || item.shortTurnStationId || item.skippedStationIds.length))
    .slice(-160)
    .map(item => overridePost(lineById.get(item.lineId)!, item))

  return [...disruptions, ...overrides]
    .sort((left, right) => right.sortMinute - left.sortMinute)
    .slice(0, selectedLine.value ? 12 : 30)
})

type ReplyMood = 'UNDERSTAND' | 'CONFIRM' | 'HELP' | 'QUESTION' | 'COMPLAIN' | 'TROLL' | 'CLASH' | 'HABIT' | 'CAPACITY' | 'POSITIVE'

interface SocialReply {
  id: string
  name: string
  handle: string
  text: string
  initials: string
  mood: ReplyMood
  badge: string
  hue: number
}

interface LineSocialContext {
  waitMinutes: number
  occupancyRate: number
  demandSatisfactionRate: number
  serviceFulfillmentRate: number
  regularityScore: number
  cancelledTrips: number
  leftBehindPassengers: number
  badDays: number
  moraleScore: number
  vehicleShortage: number
}

const firstNames = [
  'Nora', 'Samir', 'Élodie', 'Thomas', 'Maya', 'Lucas', 'Inès', 'Hugo', 'Lina', 'Amine', 'Chloé', 'Mehdi', 'Sarah', 'Nicolas', 'Léa', 'Yanis',
  'Camille', 'Noah', 'Jade', 'Rayan', 'Zoé', 'Arthur', 'Imane', 'Maxime', 'Lou', 'Sofiane', 'Emma', 'Mathis', 'Manon', 'Adel', 'Clara', 'Ilyes',
  'Julie', 'Nassim', 'Anaïs', 'Gabriel', 'Myriam', 'Théo', 'Yasmine', 'Victor', 'Nina', 'Kylian', 'Pauline', 'Adam', 'Mélissa', 'Enzo', 'Aya', 'Alexis',
] as const
const lastInitials = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const handleSuffixes = ['en_route', 'sur_la_ligne', 'metro', 'transports', 'correspondance', 'trajets', 'mobilite', 'du_quai', 'voyage', 'commute', 'idf', 'reseau'] as const

const replyMessagePools: Record<ReplyMood, readonly string[]> = {
  UNDERSTAND: [
    'Merci pour l’info, courage aux équipes et aux voyageurs.',
    'Au moins l’information est claire, je vais m’organiser autrement.',
    'Ça arrive, merci de prévenir assez tôt.',
    'Bon courage aux équipes sur place.',
  ],
  CONFIRM: [
    'Je confirme, ça bloque bien dans ce secteur.',
    'Sur place c’est très chargé, prévoyez large.',
    'Je suis dedans, ça avance au ralenti.',
    'Je confirme que le secteur est très chargé en ce moment.',
  ],
  HELP: [
    'Si vous pouvez, passez par une autre correspondance pour éviter la zone.',
    'Pour ceux qui vont vers le centre, regardez un itinéraire alternatif avant de partir.',
    'J’ai changé de ligne et gagné pas mal de temps.',
    'Je vais prendre une autre correspondance pour éviter la zone.',
  ],
  QUESTION: [
    'Vous avez une estimation du retour à la normale ?',
    'La perturbation touche aussi les correspondances suivantes ?',
    'Les prochains trains circulent normalement ou pas ?',
    'On sait si la situation va durer jusqu’à l’heure de pointe ?',
  ],
  COMPLAIN: [
    'Encore une perturbation… ça devient compliqué au quotidien.',
    'On peut avoir une journée normale sur cette ligne ?',
    'L’information c’est bien, le service régulier ce serait encore mieux.',
    'À force, prévoir de la marge ne suffit même plus.',
  ],
  TROLL: [
    'autant de perturbations que de trains aujourd’hui…',
    'le vrai terminus de cette ligne c’est « incident en cours ».',
    'application ouverte, perturbation trouvée : le bingo est complet.',
    'à ce rythme le quai va demander un abonnement lui aussi.',
  ],
  CLASH: [
    'Vous pouvez ajouter des trains au lieu d’ajouter des excuses ?',
    'Les voyageurs paient pour voyager, pas pour collectionner les alertes.',
    'Quand la fréquence baisse encore, il faut arrêter d’appeler ça une fréquence.',
    'Ça fait beaucoup de communication pour pas beaucoup de trains.',
  ],
  HABIT: [
    'Bah, on est habitués sur cette ligne maintenant.',
    'Je suis parti plus tôt juste parce que je savais que ça finirait comme ça.',
    'J’avais prévu vingt minutes de marge. Bonne intuition.',
    'Même sans notification, on commence à deviner les journées compliquées.',
  ],
  CAPACITY: [
    'Il faut vraiment ajouter des trains, les rames sont pleines.',
    'La fréquence ne suit plus la demande sur cette ligne.',
    'Encore des voyageurs laissés sur le quai, ça devient urgent.',
    'Le problème ce n’est plus l’information, c’est la capacité.',
  ],
  POSITIVE: [
    'Franchement, d’habitude cette ligne tourne bien. Pas de chance aujourd’hui.',
    'Ça reste gérable, merci pour l’info rapide.',
    'Bonne communication, j’ai pu changer mon trajet à temps.',
    'Vu la situation, ça se régule plutôt correctement.',
  ],
}

const replyOpeners = [
  'Franchement,',
  'Perso,',
  'Là,',
  'De mon côté,',
  'Ce matin,',
  'Encore aujourd’hui,',
] as const
const replyClosers = [
  'Bon courage à ceux qui arrivent derrière.',
  'Je garde un œil sur le fil.',
  'On va encore improviser.',
  'J’espère que ça se stabilise vite.',
  'Ça se voit tout de suite sur le quai.',
  'On verra à la prochaine mise à jour.',
] as const

const expandedRepliesByPost = ref<Record<string, number>>({})

const lineSocialContextById = computed(() => {
  const result = new Map<string, LineSocialContext>()
  const recentReports = simulation.history.value.slice(-7)
  for (const line of lines.value) {
    const report = reportForLine(line.id)
    let badDays = 0
    for (const day of recentReports) {
      const item = day.lines.find(candidate => candidate.lineId === line.id)
      if (!item) continue
      const bad = (item.demandSatisfactionRate ?? 1) < .82
        || (item.averageWaitMinutes ?? 0) >= 8
        || Math.max(item.networkLoadRate ?? 0, item.occupancyRate ?? 0) >= 1
        || (item.serviceFulfillmentRate ?? 1) < .88
        || (item.regularityScore ?? 100) < 65
      if (bad) badDays += 1
    }
    result.set(line.id, {
      waitMinutes: Math.max(0, report?.averageWaitMinutes ?? 0),
      occupancyRate: Math.max(0, report?.networkLoadRate ?? report?.occupancyRate ?? 0),
      demandSatisfactionRate: Math.max(0, Math.min(1, report?.demandSatisfactionRate ?? 1)),
      serviceFulfillmentRate: Math.max(0, Math.min(1, report?.serviceFulfillmentRate ?? 1)),
      regularityScore: Math.max(0, Math.min(100, report?.regularityScore ?? 100)),
      cancelledTrips: Math.max(0, Math.round(report?.cancelledTrips ?? 0)),
      leftBehindPassengers: Math.max(0, Math.round(report?.networkLeftBehindPassengers ?? report?.lostPassengers ?? 0)),
      badDays,
      moraleScore: Math.max(0, Math.min(100, report?.moraleScoreAfter ?? simulation.networkMoraleScore.value ?? 76)),
      vehicleShortage: Math.max(0, Math.round((report?.requiredVehicleCount ?? 0) - (report?.availableVehicleCount ?? report?.vehicleCount ?? 0))),
    })
  }
  return result
})

function randomIndex(seed: string, index: number, salt: string, length: number) {
  if (length <= 1) return 0
  return hashString(`${seed}:${index}:${salt}`) % length
}

function profileForReply(post: SocialPost, index: number) {
  const firstName = firstNames[randomIndex(post.id, index, 'first', firstNames.length)]!
  const initial = lastInitials[randomIndex(post.id, index, 'last', lastInitials.length)]!
  const suffix = handleSuffixes[randomIndex(post.id, index, 'suffix', handleSuffixes.length)]!
  const number = 10 + randomIndex(post.id, index, 'number', 989)
  const handleStem = slugify(firstName)
  return {
    name: `${firstName} ${initial}.`,
    handle: `@${handleStem}_${suffix}${number}`,
    initials: `${firstName[0]}${initial}`.toUpperCase(),
    hue: randomIndex(post.id, index, 'hue', 360),
  }
}

function replyMood(post: SocialPost, index: number, context: LineSocialContext): ReplyMood {
  const pool: ReplyMood[] = ['UNDERSTAND', 'CONFIRM', 'HELP', 'QUESTION', 'COMPLAIN', 'POSITIVE']
  if (post.tone !== 'INFO') pool.push('COMPLAIN', 'CONFIRM', 'QUESTION')
  if (post.tone === 'DANGER') pool.push('CLASH', 'COMPLAIN', 'HELP', 'TROLL')
  if (context.badDays >= 2) pool.push('HABIT', 'COMPLAIN')
  if (context.badDays >= 4) pool.push('HABIT', 'CLASH', 'TROLL')
  if (context.occupancyRate >= .9 || context.leftBehindPassengers > 0 || context.vehicleShortage > 0) pool.push('CAPACITY', 'CAPACITY', 'CLASH')
  if (context.waitMinutes >= 8 || context.serviceFulfillmentRate < .85 || context.regularityScore < 65) pool.push('COMPLAIN', 'HABIT', 'CLASH')
  if (context.moraleScore >= 78 && context.badDays <= 1) pool.push('UNDERSTAND', 'POSITIVE', 'POSITIVE')
  return pool[randomIndex(post.id, index, 'mood', pool.length)]!
}

function replyBadge(mood: ReplyMood) {
  if (mood === 'TROLL') return `(${i18n.t('troll')})`
  if (mood === 'HELP') return i18n.t('itinéraire')
  if (mood === 'CONFIRM') return i18n.t('sur place')
  if (mood === 'UNDERSTAND' || mood === 'POSITIVE') return i18n.t('compréhensif')
  if (mood === 'CAPACITY') return i18n.t('capacité')
  if (mood === 'HABIT') return i18n.t('habitué')
  if (mood === 'CLASH') return i18n.t('coup de gueule')
  if (mood === 'COMPLAIN') return i18n.t('mécontent')
  return i18n.t('question')
}

function contextualReplySuffix(context: LineSocialContext, mood: ReplyMood, post: SocialPost, index: number) {
  const options: string[] = []
  if (context.waitMinutes >= 6 && ['COMPLAIN', 'HABIT', 'CAPACITY', 'CLASH'].includes(mood)) {
    options.push(`${i18n.number(context.waitMinutes, { maximumFractionDigits: 0 })} ${i18n.t('min d’attente moyenne aujourd’hui, ça se ressent.')}`)
  }
  if (context.cancelledTrips >= 2 && ['COMPLAIN', 'HABIT', 'CLASH'].includes(mood)) {
    options.push(`${i18n.number(context.cancelledTrips)} ${i18n.t('circulations supprimées aujourd’hui, ça commence à faire.')}`)
  }
  if (context.badDays >= 3 && ['HABIT', 'COMPLAIN', 'CLASH', 'TROLL'].includes(mood)) {
    options.push(i18n.t('Ça fait plusieurs jours que les indicateurs sont dans le rouge.'))
  }
  if ((context.occupancyRate >= .95 || context.leftBehindPassengers > 0) && ['CAPACITY', 'COMPLAIN', 'CLASH'].includes(mood)) {
    options.push(i18n.t('On voit bien que la demande dépasse la capacité disponible.'))
  }
  if (context.vehicleShortage > 0 && ['CAPACITY', 'COMPLAIN', 'CLASH'].includes(mood)) {
    options.push(`${i18n.number(context.vehicleShortage)} ${i18n.t('rame(s) manquante(s) par rapport au besoin, forcément ça se voit.')}`)
  }
  if (post.scope !== i18n.t('Toute la ligne') && ['CONFIRM', 'HELP'].includes(mood)) {
    options.push(`${i18n.t('Le secteur concerné :')} ${post.scope}.`)
  }
  if (!options.length) return ''
  return options[randomIndex(post.id, index, 'suffix-text', options.length)]!
}

function replyText(post: SocialPost, index: number, mood: ReplyMood, context: LineSocialContext) {
  const pool = replyMessagePools[mood]
  let base = i18n.t(pool[randomIndex(post.id, index, 'message', pool.length)]!)
  const openerRoll = randomIndex(post.id, index, 'opener-roll', 5)
  if (openerRoll > 1) {
    const opener = i18n.t(replyOpeners[randomIndex(post.id, index, 'opener', replyOpeners.length)]!)
    base = `${opener} ${base.charAt(0).toLocaleLowerCase(i18n.localeTag.value)}${base.slice(1)}`
  }
  if (mood === 'TROLL') base = `${post.line.shortCode || post.line.name}, ${base}`
  const suffix = contextualReplySuffix(context, mood, post, index)
  if (suffix) base = `${base} ${suffix}`
  const closerRoll = randomIndex(post.id, index, 'closer-roll', 7)
  if (closerRoll >= 4 && !['TROLL', 'CLASH'].includes(mood)) {
    base = `${base} ${i18n.t(replyClosers[randomIndex(post.id, index, 'closer', replyClosers.length)]!)}`
  }
  return base
}

function initialVisibleReplyCount(post: SocialPost) {
  return Math.max(2, Math.min(5, Math.ceil(Math.log2(post.replies + 1)) - 1))
}

function displayedReplyCount(post: SocialPost) {
  return Math.min(post.replies, expandedRepliesByPost.value[post.id] ?? initialVisibleReplyCount(post))
}

function remainingReplyCount(post: SocialPost) {
  return Math.max(0, post.replies - displayedReplyCount(post))
}

function loadMoreReplies(post: SocialPost) {
  expandedRepliesByPost.value = {
    ...expandedRepliesByPost.value,
    [post.id]: Math.min(post.replies, displayedReplyCount(post) + 7),
  }
}

function visibleReplies(post: SocialPost): SocialReply[] {
  const count = displayedReplyCount(post)
  const context = lineSocialContextById.value.get(post.line.id) ?? {
    waitMinutes: 0,
    occupancyRate: 0,
    demandSatisfactionRate: 1,
    serviceFulfillmentRate: 1,
    regularityScore: 100,
    cancelledTrips: 0,
    leftBehindPassengers: 0,
    badDays: 0,
    moraleScore: 76,
    vehicleShortage: 0,
  }
  return Array.from({ length: count }, (_, index) => {
    const profile = profileForReply(post, index)
    const mood = replyMood(post, index, context)
    return {
      id: `${post.id}:reply:${index}`,
      ...profile,
      mood,
      badge: replyBadge(mood),
      text: replyText(post, index, mood, context),
    }
  })
}

function postReposts(post: SocialPost) {
  return Math.max(0, Math.round(post.replies * (.12 + (hashString(`${post.id}:reposts`) % 18) / 100)))
}

function postViews(post: SocialPost) {
  const followers = followerCount(post.line)
  const multiplier = 1.8 + (hashString(`${post.id}:views`) % 240) / 100
  return Math.max(post.reactions + post.replies, Math.round(Math.max(80, followers) * multiplier))
}

</script>

<template>
  <section class="line-social" :style="{ '--line-social-color': selectedLine?.color ?? '#57d7df' }">
    <header class="social-panel-head">
      <div><span>{{ i18n.t('Réseau') }}</span><strong>{{ i18n.t('Fil voyageurs') }}</strong></div>
      <button type="button" :aria-label="i18n.t('Fermer')" @click="emit('close')">×</button>
    </header>

    <label class="feed-filter">
      <span>{{ i18n.t('Filtrer par ligne') }}</span>
      <select v-model="selectedLineId">
        <option value="ALL">{{ i18n.t('Toutes les lignes') }}</option>
        <option v-for="item in lines" :key="item.id" :value="item.id" data-i18n-skip>{{ item.shortCode }} · {{ item.name }}</option>
      </select>
    </label>

    <header v-if="selectedLine" class="account-card">
      <span class="account-avatar" :style="{ background: selectedLine.color }">
        <img v-if="selectedLine.customLogoDataUrl" :src="selectedLine.customLogoDataUrl" :alt="selectedLine.name">
        <b v-else>{{ selectedLine.shortCode }}</b>
      </span>
      <div class="account-identity">
        <strong data-i18n-skip>{{ selectedLine.name }} <i class="verified-badge" :title="i18n.t('Compte certifié')" :aria-label="i18n.t('Compte certifié')">✓</i></strong>
        <span data-i18n-skip>{{ lineHandle(selectedLine) }}</span>
      </div>
      <div class="account-followers"><strong>{{ formatGameNumberCompact(followerCount(selectedLine)) }}</strong><small>{{ i18n.t('abonnés') }}</small></div>
    </header>

    <div v-if="posts.length" class="post-list">
      <article v-for="post in posts" :key="post.id" class="social-post" :class="post.tone.toLowerCase()" :style="{ '--line-social-color': post.line.color }">
        <div class="post-head">
          <span class="mini-avatar" :style="{ background: post.line.color }"><img v-if="post.line.customLogoDataUrl" :src="post.line.customLogoDataUrl"><b v-else>{{ post.line.shortCode }}</b></span>
          <div><strong data-i18n-skip>{{ post.line.name }} <i class="verified-badge" :title="i18n.t('Compte certifié')" :aria-label="i18n.t('Compte certifié')">✓</i></strong><span data-i18n-skip>{{ lineHandle(post.line) }} · {{ post.moment }}</span></div>
          <em data-i18n-skip>{{ post.status }}</em>
        </div>
        <p data-i18n-skip>{{ post.message }}</p>
        <div class="post-scope"><span>⌖</span><strong data-i18n-skip>{{ post.scope }}</strong></div>
        <div class="post-metrics">
          <span data-i18n-skip>↩ {{ formatGameNumberCompact(post.replies) }} {{ i18n.t('réponses') }}</span>
          <span data-i18n-skip>↻ {{ formatGameNumberCompact(postReposts(post)) }} {{ i18n.t('partages') }}</span>
          <span data-i18n-skip>♡ {{ formatGameNumberCompact(post.reactions) }} {{ i18n.t('réactions') }}</span>
          <span data-i18n-skip>◉ {{ formatGameNumberCompact(postViews(post)) }} {{ i18n.t('vues') }}</span>
        </div>
        <div class="reply-list">
          <div v-for="reply in visibleReplies(post)" :key="reply.id" class="reply-row" :class="`reply-${reply.mood.toLowerCase()}`">
            <span class="reply-avatar" :style="{ '--reply-hue': reply.hue }">{{ reply.initials }}</span>
            <p>
              <strong data-i18n-skip>{{ reply.name }}</strong>
              <small data-i18n-skip>{{ reply.handle }}</small>
              <em v-if="reply.badge" :class="{ troll: reply.mood === 'TROLL' }" data-i18n-skip>{{ reply.badge }}</em>
              <b data-i18n-skip>{{ reply.text }}</b>
            </p>
          </div>
          <button v-if="remainingReplyCount(post) > 0" class="more-replies" type="button" @click="loadMoreReplies(post)">
            <span>↳</span>
            <strong>{{ i18n.t('Afficher plus de réponses') }}</strong>
            <small>+{{ formatGameNumberCompact(Math.min(7, remainingReplyCount(post))) }}</small>
          </button>
        </div>
      </article>
    </div>
    <div v-else class="social-empty">
      <strong>{{ i18n.t('Aucune publication trafic pour le moment.') }}</strong>
      <span>{{ i18n.t(selectedLine ? 'Le compte publiera automatiquement les perturbations, travaux, mouvements sociaux, retards, interruptions et dessertes modifiées.' : 'Les comptes de ligne publieront ici les perturbations, travaux, mouvements sociaux, retards, interruptions et dessertes modifiées.') }}</span>
    </div>
  </section>
</template>

<style scoped>
.line-social{display:grid;gap:9px;padding:0;min-width:0}
.social-panel-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(8,14,19,.98);backdrop-filter:blur(16px)}
.social-panel-head>div{display:grid;gap:2px}.social-panel-head span{font-size:7px;text-transform:uppercase;letter-spacing:.12em;opacity:.45}.social-panel-head strong{font-size:13px}.social-panel-head button{width:29px;height:29px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.045);color:inherit;font-size:18px;cursor:pointer}
.feed-filter{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:9px;margin:2px 10px 0;padding:8px 9px;border:1px solid rgba(255,255,255,.065);border-radius:9px;background:rgba(255,255,255,.022)}.feed-filter>span{font-size:7.5px;font-weight:800;opacity:.55}.feed-filter select{min-width:0;width:100%;height:31px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:#111c22;color:inherit;padding:0 9px;font-size:8px}
.account-card{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:9px;margin:0 10px;padding:10px;border:1px solid color-mix(in srgb,var(--line-social-color) 28%,rgba(255,255,255,.07));border-radius:12px;background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(255,255,255,.012))}.account-avatar,.mini-avatar{display:grid;place-items:center;overflow:hidden;color:#081014;font-weight:900;background:var(--line-social-color)}.account-avatar{width:46px;height:46px;border-radius:14px}.account-avatar img,.mini-avatar img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.94)}.account-identity{display:grid;min-width:0}.account-identity strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-identity span{font-size:8px;opacity:.48}.account-followers{display:grid;text-align:right}.account-followers strong{font-size:12px}.account-followers small{font-size:7px;opacity:.45}
.verified-badge{display:inline-grid;place-items:center;width:13px;height:13px;margin-left:2px;border-radius:50%;background:#55d5df;color:#071217;font-size:8px;font-style:normal;font-weight:950;vertical-align:-1px;box-shadow:0 0 0 1px rgba(85,213,223,.18)}
.post-list{display:grid;gap:8px;padding:0 10px 10px}.social-post{display:grid;gap:8px;padding:10px;border:1px solid rgba(255,255,255,.075);border-left:3px solid var(--line-social-color);border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.022),rgba(255,255,255,.012))}.social-post.warning{border-left-color:#e9b45c}.social-post.danger{border-left-color:#ec7474}
.post-head{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:8px}.mini-avatar{width:34px;height:34px;border-radius:50%;font-size:8px}.post-head>div{display:grid;min-width:0}.post-head strong{font-size:9px;display:flex;align-items:center;min-width:0}.post-head span{font-size:7px;opacity:.42}.post-head>em{max-width:120px;padding:4px 6px;border-radius:999px;background:rgba(255,255,255,.05);font-size:6.8px;font-style:normal;font-weight:900;text-transform:uppercase;letter-spacing:.06em;text-align:center}.social-post>p{margin:0;font-size:9px;line-height:1.48;opacity:.84}.post-scope{display:flex;align-items:center;gap:5px;font-size:7.5px;opacity:.58}.post-scope strong{font-size:7.8px}
.post-metrics{display:flex;align-items:center;flex-wrap:wrap;gap:7px 14px;padding:7px 1px 1px;border-top:1px solid rgba(255,255,255,.055);font-size:7px;opacity:.5}.post-metrics span{white-space:nowrap}
.reply-list{display:grid;gap:5px;margin-top:1px;padding-left:8px;border-left:1px solid rgba(255,255,255,.06)}.reply-row{display:grid;grid-template-columns:27px minmax(0,1fr);gap:7px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid transparent}.reply-row:hover{background:rgba(255,255,255,.036);border-color:rgba(255,255,255,.04)}.reply-avatar{width:27px!important;height:27px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:hsl(var(--reply-hue) 34% 25%)!important;color:rgba(255,255,255,.88);font-size:7px!important;font-weight:900}.reply-row p{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;column-gap:5px;min-width:0}.reply-row strong{font-size:7.7px;white-space:nowrap}.reply-row small{font-size:6.8px;opacity:.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reply-row em{justify-self:end;padding:2px 5px;border-radius:999px;background:rgba(255,255,255,.045);font-size:6px;font-style:normal;font-weight:800;opacity:.55;white-space:nowrap}.reply-row em.troll{opacity:.78;background:rgba(232,178,89,.09);color:#f0c97d}.reply-row b{grid-column:1/-1;margin-top:2px;font-size:7.7px;font-weight:500;line-height:1.42;opacity:.76}.reply-clash b,.reply-complain b{opacity:.84}.reply-help b,.reply-understand b,.reply-positive b{opacity:.74}
.more-replies{min-height:30px;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:2px;border:1px solid rgba(85,213,223,.13);border-radius:9px;background:rgba(85,213,223,.045);color:inherit;cursor:pointer}.more-replies:hover{background:rgba(85,213,223,.08);border-color:rgba(85,213,223,.24)}.more-replies span{font-size:12px;color:#75dbe2}.more-replies strong{font-size:7.5px}.more-replies small{font-size:6.8px;opacity:.45}
.social-empty{display:grid;gap:3px;margin:0 10px 10px;padding:13px;border-radius:10px;border:1px dashed rgba(255,255,255,.09);text-align:center}.social-empty strong{font-size:9px}.social-empty span{font-size:7.5px;line-height:1.4;opacity:.48}
@media(max-width:560px){.feed-filter{grid-template-columns:1fr}.account-card{grid-template-columns:42px 1fr}.account-followers{grid-column:2;text-align:left;display:flex;gap:5px;align-items:baseline}.post-head{grid-template-columns:34px 1fr}.post-head>em{grid-column:2;justify-self:start}.reply-row p{grid-template-columns:auto 1fr}.reply-row em{grid-column:1/-1;justify-self:start}.post-metrics{gap:6px 10px}}
</style>
