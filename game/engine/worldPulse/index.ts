import { currentGameLocale, translateGameText } from '../../config/i18n'
import type { GameInfoItem } from '../../types/alerts'
import type { GameSave } from '../../types/game'
import type { GameMunicipality, GameNetworkTerritorySummary } from '../../types/territory'
import type { GameWorldPulseItem, GameWorldPulseTone } from '../../types/worldPulse'
import { disruptionTouchesDay } from '../operations'


function localizedUrbanProjectTitle(kind: string, municipalityName: string) {
  const key = kind === 'RESIDENTIAL_DISTRICT'
    ? 'Nouveau quartier'
    : kind === 'BUSINESS_DISTRICT'
      ? 'Nouveau pôle d’emplois'
      : kind === 'CAMPUS'
        ? 'Nouveau campus'
        : 'Nouveau pôle de loisirs'
  return `${translateGameText(key, currentGameLocale())} · ${municipalityName}`
}

function localizedLocalEventTitle(kind: string, municipalityName: string) {
  const key = kind === 'CONCERT'
    ? 'Grand concert'
    : kind === 'FOOTBALL'
      ? 'Match à forte affluence'
      : kind === 'FESTIVAL'
        ? 'Festival'
        : 'Salon majeur'
  return `${translateGameText(key, currentGameLocale())} · ${municipalityName}`
}

function localEventServiceLabel(kind: string | undefined) {
  if (kind === 'EVENT_SHUTTLE') return translateGameText('Navette événementielle', currentGameLocale())
  if (kind === 'LATE_SERVICE') return translateGameText('Service tardif', currentGameLocale())
  return translateGameText('Renfort de ligne', currentGameLocale())
}

function compactNumber(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1).replace('.0', '')} M`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(absolute >= 100_000 ? 0 : 1).replace('.0', '')} k`
  return Math.round(value).toString()
}

function infoTone(item: GameInfoItem): GameWorldPulseTone {
  if (item.severity === 'CRITICAL' || item.severity === 'WARNING') return 'ALERT'
  if (item.severity === 'OPPORTUNITY') return 'OPPORTUNITY'
  return 'INFO'
}

function infoPriority(item: GameInfoItem) {
  if (item.severity === 'CRITICAL') return 96
  if (item.severity === 'WARNING') return 84
  if (item.severity === 'OPPORTUNITY') return 70
  return 36
}

function infoPanel(item: GameInfoItem) {
  if (item.category === 'FINANCE') return 'FINANCES' as const
  if (item.category === 'MAINTENANCE') return 'FLEET' as const
  if (item.category === 'PASSENGERS') return 'PASSENGERS' as const
  if (item.category === 'MUNICIPALITY') return 'MUNICIPALITIES' as const
  if (item.category === 'OBJECTIVE') return 'OBJECTIVES' as const
  return 'NETWORK' as const
}

function fromInfo(item: GameInfoItem): GameWorldPulseItem {
  return {
    id: `info:${item.id}`,
    tone: infoTone(item),
    priority: infoPriority(item),
    title: item.title,
    summary: item.description,
    metric: item.metric,
    lineId: item.lineId,
    stationId: item.stationId,
    municipalityCode: item.municipalityCode,
    panel: infoPanel(item),
  }
}


function buildStarterOpportunity(save: GameSave): GameWorldPulseItem | null {
  if (save.data.network.lines.length > 0) return null
  return {
    id: 'world:first-line',
    tone: 'OPPORTUNITY',
    priority: 90,
    title: 'Votre métropole attend son premier axe',
    summary: 'Commencez simplement : choisissez un mode, tracez quelques stations et laissez CLU préparer le reste.',
    metric: '＋ Ligne',
    panel: 'NETWORK',
    intent: 'CREATE_LINE',
  }
}

function buildTerritoryOpportunity(
  save: GameSave,
  municipalities: GameMunicipality[],
  summary: GameNetworkTerritorySummary,
): GameWorldPulseItem | null {
  if (save.data.network.lines.filter(line => line.status === 'OPERATIONAL').length === 0) return null

  const coveredCodes = new Set(summary.municipalities.map(item => item.code))
  const candidate = municipalities
    .filter(municipality => municipality.population >= 12_000 && !coveredCodes.has(municipality.code))
    .sort((a, b) => b.population - a.population)[0]

  if (!candidate) return null

  return {
    id: `territory:unserved:${candidate.code}`,
    tone: 'OPPORTUNITY',
    priority: candidate.population >= 100_000 ? 74 : candidate.population >= 40_000 ? 66 : 58,
    title: `${candidate.name} reste à l'écart du réseau`,
    summary: 'Une zone importante du territoire ne possède encore aucune station de votre réseau.',
    metric: `${compactNumber(candidate.population)} hab.`,
    municipalityCode: candidate.code,
    panel: 'NETWORK',
  }
}


function buildTerritoryDevelopmentSignal(
  save: GameSave,
  municipalities: GameMunicipality[],
): GameWorldPulseItem | null {
  const development = save.data.municipalities?.development ?? []
  const recent = development
    .filter(item => item.lastMilestoneDay !== null && save.data.simulationDay - Number(item.lastMilestoneDay) <= 7 && item.milestoneLevel > 0)
    .sort((a, b) => Number(b.lastMilestoneDay ?? 0) - Number(a.lastMilestoneDay ?? 0) || b.accessibility - a.accessibility)[0]
  if (!recent) return null
  const municipality = municipalities.find(item => item.code === recent.code)
  if (!municipality) return null
  const gained = Math.max(0, recent.population - recent.basePopulation)
  return {
    id: `territory:development:${recent.code}:${recent.milestoneLevel}`,
    tone: 'SUCCESS',
    priority: 54,
    title: `${municipality.name} se développe autour du réseau`,
    summary: 'L’accessibilité créée par vos transports commence à modifier durablement ce secteur de la métropole.',
    metric: gained > 0 ? `+${compactNumber(gained)} hab.` : undefined,
    municipalityCode: recent.code,
    panel: 'NETWORK',
  }
}

function buildEmergingCentralitySignal(
  save: GameSave,
  municipalities: GameMunicipality[],
  summary: GameNetworkTerritorySummary,
): GameWorldPulseItem | null {
  if (save.data.simulationDay < 18 || save.data.network.lines.filter(line => line.status === 'OPERATIONAL').length < 3) return null
  const coverage = new Map(summary.municipalities.map(item => [item.code, item] as const))
  const municipalityByCode = new Map(municipalities.map(item => [item.code, item] as const))
  const candidate = [...(save.data.municipalities?.development ?? [])]
    .map(entry => {
      const municipality = municipalityByCode.get(entry.code)
      const served = coverage.get(entry.code)
      const growthRate = (entry.population - entry.basePopulation) / Math.max(1, entry.basePopulation)
      const score = entry.accessibility * .7 + Math.min(.16, Math.max(0, growthRate)) * 220 + (served?.lineCount ?? 0) * 4
      return { entry, municipality, served, growthRate, score }
    })
    .filter(item => item.municipality && item.served && item.entry.accessibility >= 58 && item.growthRate >= .025 && (item.served?.lineCount ?? 0) >= 2)
    .sort((a, b) => b.score - a.score)[0]
  if (!candidate?.municipality || !candidate.served) return null
  return {
    id: `territory:centrality:${candidate.entry.code}:${candidate.entry.milestoneLevel}`,
    tone: 'OPPORTUNITY',
    priority: candidate.growthRate >= .08 ? 73 : 61,
    title: `${candidate.municipality.name} devient une nouvelle centralité`,
    summary: `L’accessibilité créée par ${candidate.served.lineCount} lignes accompagne une croissance durable du secteur. Surveillez les flux : ce pôle peut générer de nouveaux besoins transversaux sans qu’aucune mission ne vous soit imposée.`,
    metric: `+${Math.max(1, Math.round(candidate.growthRate * 100))} %`,
    municipalityCode: candidate.entry.code,
    panel: 'NETWORK',
  }
}

function buildGrowthSignal(save: GameSave): GameWorldPulseItem | null {
  const history = save.data.simulation.history
  if (history.length < 2) return null
  const latest = history.at(-1)
  const previous = history.at(-2)
  if (!latest || !previous || previous.passengers < 10_000) return null
  const delta = latest.passengers - previous.passengers
  const growth = delta / Math.max(1, previous.passengers)
  if (delta < 5_000 || growth < 0.12) return null

  return {
    id: `growth:${latest.day}`,
    tone: 'SUCCESS',
    priority: 44,
    title: 'Le réseau attire davantage de voyageurs',
    summary: 'La fréquentation progresse nettement depuis la veille. Regardez quelles lignes portent cette croissance.',
    metric: `+${compactNumber(delta)}`,
    panel: 'PASSENGERS',
  }
}


function buildFinishedLocalEventOutcome(save: GameSave): GameWorldPulseItem | null {
  const day = save.data.simulationDay
  const event = [...(save.data.municipalities?.localEvents ?? [])]
    .filter(item => item.status === 'FINISHED' && item.outcome && day - item.outcome.resolvedDay <= 3)
    .sort((a, b) => Number(b.outcome?.resolvedDay ?? 0) - Number(a.outcome?.resolvedDay ?? 0))[0]
  if (!event?.outcome) return null
  const outcome = event.outcome
  const eventName = localizedLocalEventTitle(event.kind, event.municipalityName)
  const tone: GameWorldPulseTone = outcome.tone === 'SUCCESS' ? 'SUCCESS' : outcome.tone === 'OVERLOADED' ? 'ALERT' : 'INFO'
  const summary = outcome.leftBehindVisitors > 0
    ? `${compactNumber(outcome.transportedVisitors)} ${translateGameText('visiteurs absorbés', currentGameLocale())} · ${compactNumber(outcome.leftBehindVisitors)} ${translateGameText('non absorbés', currentGameLocale())}. ${translateGameText('Impact net estimé', currentGameLocale())} ${outcome.netImpact >= 0 ? '+' : '−'}${compactNumber(Math.abs(outcome.netImpact))} €.`
    : `${compactNumber(outcome.transportedVisitors)} ${translateGameText('visiteurs absorbés', currentGameLocale())}. ${translateGameText('Impact net estimé', currentGameLocale())} ${outcome.netImpact >= 0 ? '+' : '−'}${compactNumber(Math.abs(outcome.netImpact))} €.`
  return {
    id: `local-event-outcome:${event.id}:${outcome.resolvedDay}`,
    tone,
    priority: outcome.tone === 'OVERLOADED' ? 88 : 58,
    title: `${eventName} · ${translateGameText('Bilan', currentGameLocale())}`,
    summary,
    metric: `${outcome.serviceScore} %`,
    municipalityCode: event.municipalityCode,
    lineId: event.preparedLineId,
    panel: 'OPERATIONS',
  }
}

function buildLocalMobilityEvent(
  save: GameSave,
  summary: GameNetworkTerritorySummary,
): GameWorldPulseItem | null {
  const day = save.data.simulationDay
  const event = [...(save.data.municipalities?.localEvents ?? [])]
    .filter(item => item.status !== 'FINISHED' && item.endsDay >= day)
    .sort((a, b) => (a.status === 'ACTIVE' ? -1 : 0) - (b.status === 'ACTIVE' ? -1 : 0) || a.startsDay - b.startsDay)[0]
  if (!event) return null

  const busLineIds = new Set(save.data.network.lines
    .filter(line => line.status === 'OPERATIONAL' && line.mode === 'BUS')
    .map(line => line.id))
  const impactedLine = summary.lines
    .filter(line => busLineIds.has(line.lineId) && line.municipalities.some(municipality => municipality.code === event.municipalityCode))
    .sort((a, b) => {
      const aCoverage = a.municipalities.find(municipality => municipality.code === event.municipalityCode)?.stationCount ?? 0
      const bCoverage = b.municipalities.find(municipality => municipality.code === event.municipalityCode)?.stationCount ?? 0
      return bCoverage - aCoverage
    })[0]
  const active = day >= event.startsDay && day <= event.endsDay
  const daysBefore = Math.max(0, event.startsDay - day)
  const preparation = event.preparedLineId
    ? ` ${localEventServiceLabel(event.serviceKind)} ${translateGameText('préparé', currentGameLocale()).toLowerCase()}${event.serviceCost ? ` · ${compactNumber(event.serviceCost)} €` : ''}.`
    : impactedLine
      ? ` ${translateGameText("Aucun service temporaire bus n'est encore préparé.", currentGameLocale())}`
      : ` ${translateGameText("Aucune ligne de bus ne dessert encore directement le secteur pour mettre en place un service temporaire.", currentGameLocale())}`
  return {
    id: `local-event:${event.id}`,
    tone: 'EVENT',
    priority: active ? 116 : daysBefore <= 2 ? 92 : 78,
    title: localizedLocalEventTitle(event.kind, event.municipalityName),
    summary: `${compactNumber(event.expectedVisitors)} ${translateGameText('visiteurs attendus', currentGameLocale())}. ${active ? translateGameText('Le pic de déplacements est en cours.', currentGameLocale()) : translateGameText('Préparez l’offre avant le début de l’événement.', currentGameLocale())}${preparation}`,
    metric: active ? 'Aujourd’hui' : `Dans ${daysBefore} j`,
    municipalityCode: event.municipalityCode,
    lineId: impactedLine?.lineId,
    localEventId: event.id,
    panel: 'OPERATIONS',
  }
}

function buildUrbanProjectSignal(save: GameSave): GameWorldPulseItem | null {
  const day = save.data.simulationDay
  const projects = save.data.municipalities?.urbanProjects ?? []

  const matured = [...projects]
    .filter(item => item.status === 'MATURE' && item.maturedDay !== null && day - Number(item.maturedDay) <= 4)
    .sort((a, b) => Number(b.maturedDay ?? 0) - Number(a.maturedDay ?? 0))[0]
  if (matured) {
    return {
      id: `urban-mature:${matured.id}`,
      tone: 'SUCCESS',
      priority: 64,
      title: `${localizedUrbanProjectTitle(matured.kind, matured.municipalityName)} · ${translateGameText('Plein régime', currentGameLocale())}`,
      summary: translateGameText('Le nouveau pôle a terminé sa montée en puissance : sa demande de mobilité est désormais pleinement installée.', currentGameLocale()),
      metric: `+${Math.round(matured.mobilityDemandBonus * 100)} % demande`,
      municipalityCode: matured.municipalityCode,
      panel: 'NETWORK',
    }
  }

  const opened = [...projects]
    .filter(item => item.status === 'OPENED' && item.openedDay !== null && day - Number(item.openedDay) <= 5)
    .sort((a, b) => Number(b.openedDay ?? 0) - Number(a.openedDay ?? 0))[0]
  if (opened) {
    return {
      id: `urban-opened:${opened.id}`,
      tone: 'SUCCESS',
      priority: 66,
      title: `${localizedUrbanProjectTitle(opened.kind, opened.municipalityName)} · ${translateGameText('Ouvert', currentGameLocale())}`,
      summary: opened.populationGain > 0
        ? `${compactNumber(opened.populationGain)} habitants supplémentaires arrivent et la demande continuera de monter jusqu’au plein régime.`
        : 'Le pôle est ouvert : les déplacements augmentent progressivement jusqu’au plein régime.',
      metric: opened.populationGain > 0 ? `+${compactNumber(opened.populationGain)} hab.` : 'Montée en charge',
      municipalityCode: opened.municipalityCode,
      panel: 'NETWORK',
    }
  }

  const construction = [...projects]
    .filter(item => item.status === 'CONSTRUCTION' && item.openingDay >= day)
    .sort((a, b) => a.openingDay - b.openingDay)[0]
  if (construction) {
    const remaining = Math.max(0, construction.openingDay - day)
    return {
      id: `urban-construction:${construction.id}`,
      tone: 'OPPORTUNITY',
      priority: remaining <= 9 ? 74 : 61,
      title: `${localizedUrbanProjectTitle(construction.kind, construction.municipalityName)} · ${translateGameText('En chantier', currentGameLocale())}`,
      summary: translateGameText('Le chantier commence déjà à attirer des déplacements. Anticipez la desserte avant l’ouverture et la montée en puissance.', currentGameLocale()),
      metric: `Ouverture dans ${remaining} j`,
      municipalityCode: construction.municipalityCode,
      panel: 'NETWORK',
    }
  }

  const planned = [...projects]
    .filter(item => item.status === 'PLANNED' && item.openingDay >= day)
    .sort((a, b) => a.constructionStartDay - b.constructionStartDay || a.openingDay - b.openingDay)[0]
  if (!planned) return null
  const remaining = Math.max(0, planned.constructionStartDay - day)
  if (remaining > 20 && day - planned.createdDay > 3) return null
  return {
    id: `urban-planned:${planned.id}`,
    tone: 'OPPORTUNITY',
    priority: remaining <= 8 ? 68 : 52,
    title: localizedUrbanProjectTitle(planned.kind, planned.municipalityName),
    summary: planned.populationGain > 0
      ? `${compactNumber(planned.populationGain)} habitants supplémentaires sont prévus. Le chantier démarre bientôt : vous pouvez préparer la desserte avant la montée de la demande.`
      : 'Ce nouveau pôle augmentera durablement les déplacements. Le chantier démarre bientôt : vous pouvez anticiper sa desserte.',
    metric: `Chantier J${planned.constructionStartDay}`,
    municipalityCode: planned.municipalityCode,
    panel: 'NETWORK',
  }
}

function buildStationNetworkSignal(save: GameSave): GameWorldPulseItem | null {
  const latest = save.data.simulation.history.at(-1)
  if (!latest) return null
  const activeWork = (save.data.operations.stationWorks ?? [])
    .filter(work => work.status === 'ACTIVE')
    .sort((a, b) => a.endDay - b.endDay)[0]
  const candidates = latest.lines.flatMap(line => (line.stations ?? []).map(station => ({ line, station })))
  const saturated = candidates
    .filter(item => item.station.networkRole === 'SATURATED' || (item.station.utilizationRate ?? 0) >= 1.05 || (item.station.leftBehindPassengers ?? 0) >= 500)
    .sort((a, b) => Math.max(b.station.utilizationRate ?? 0, (b.station.leftBehindPassengers ?? 0) / 1200) - Math.max(a.station.utilizationRate ?? 0, (a.station.leftBehindPassengers ?? 0) / 1200))[0]
  if (saturated) {
    const work = activeWork && activeWork.lineId === saturated.line.lineId && activeWork.stationId === saturated.station.stationId ? activeWork : null
    return {
      id: `station:pressure:${saturated.line.lineId}:${saturated.station.stationId}:${latest.day}`,
      tone: work ? 'INFO' : 'ALERT',
      priority: work ? 72 : 94,
      title: work ? `${saturated.station.stationName} · agrandissement en cours` : `${saturated.station.stationName} devient un goulot d’étranglement`,
      summary: work
        ? `Les travaux réduisent temporairement la capacité. La nouvelle installation ouvre au Jour ${work.endDay}.`
        : 'Les flux Voyageurs 2.0 dépassent la capacité confortable de cette station. Renforcer uniquement les véhicules risque de déplacer le problème sans le résoudre.',
      metric: `${Math.round((saturated.station.utilizationRate ?? 0) * 100)} %`,
      lineId: saturated.line.lineId,
      stationId: saturated.station.stationId,
      panel: 'NETWORK',
    }
  }
  const segment = latest.lines
    .filter(line => (line.bottleneckSegmentLoadRate ?? 0) >= .86 && Boolean(line.bottleneckSegmentName))
    .sort((a, b) => (b.bottleneckSegmentLoadRate ?? 0) - (a.bottleneckSegmentLoadRate ?? 0))[0]
  if (segment) {
    return {
      id: `segment:bottleneck:${segment.lineId}:${latest.day}`,
      tone: (segment.bottleneckSegmentLoadRate ?? 0) >= 1 ? 'ALERT' : 'OPPORTUNITY',
      priority: (segment.bottleneckSegmentLoadRate ?? 0) >= 1 ? 89 : 69,
      title: `${segment.bottleneckSegmentName} concentre les flux`,
      summary: (() => {
        const bottleneck = (segment.segments ?? [])[0]
        if ((bottleneck?.infrastructureCapacityLevel ?? 0) < 3) {
          return `Voyageurs 2.0 identifie ce tronçon comme le principal goulot. Son infrastructure est au niveau capacité ${bottleneck?.infrastructureCapacityLevel ?? 0}/3 : une modernisation ciblée peut être plus utile qu’un renfort généralisé.`
        }
        return 'Voyageurs 2.0 identifie ce tronçon comme le principal goulot. L’infrastructure est déjà fortement modernisée : vérifiez plutôt matériel, fréquence, terminus ou stations.'
      })(),
      metric: `${Math.round((segment.bottleneckSegmentLoadRate ?? 0) * 100)} %`,
      lineId: segment.lineId,
      panel: 'NETWORK',
    }
  }

  const hub = candidates
    .filter(item => item.station.networkRole === 'HUB' && (item.station.hubScore ?? 0) >= 72)
    .sort((a, b) => (b.station.hubScore ?? 0) - (a.station.hubScore ?? 0))[0]
  if (!hub) return null
  return {
    id: `station:hub:${hub.line.lineId}:${hub.station.stationId}:${latest.day}`,
    tone: 'OPPORTUNITY',
    priority: 63,
    title: `${hub.station.stationName} s’impose comme un hub`,
    summary: 'Les correspondances et les flux réels font émerger ce pôle naturellement. Surveillez sa capacité avant que sa croissance ne devienne une contrainte.',
    metric: `Hub ${Math.round(hub.station.hubScore ?? 0)}/100`,
    lineId: hub.line.lineId,
    stationId: hub.station.stationId,
    panel: 'NETWORK',
  }
}

function buildBusUpgradeOpportunity(save: GameSave): GameWorldPulseItem | null {
  const latest = save.data.simulation.history.at(-1)
  if (!latest) return null
  const busIds = new Set(save.data.network.lines
    .filter(line => line.status === 'OPERATIONAL' && line.mode === 'BUS')
    .map(line => line.id))
  const candidate = latest.lines
    .filter(line => busIds.has(line.lineId))
    .filter(line => (line.boardingDemandPassengers ?? 0) >= 8_000)
    .map(line => {
      const satisfaction = Math.max(0, Math.min(1, line.demandSatisfactionRate ?? 1))
      const occupancy = Math.max(0, line.occupancyRate ?? 0)
      const pressure = Math.max(0, line.queuePressureRate ?? 0)
      const score = (1 - satisfaction) * 0.55 + Math.min(1.5, occupancy) * 0.25 + Math.min(1.5, pressure) * 0.20
      return { line, score }
    })
    .filter(item => item.score >= 0.52)
    .sort((a, b) => b.score - a.score)[0]
  if (!candidate) return null
  const line = save.data.network.lines.find(item => item.id === candidate.line.lineId)
  if (!line) return null
  return {
    id: `advisor:bus-capacity:${line.id}:${latest.day}`,
    tone: 'OPPORTUNITY',
    priority: 76,
    title: `${line.name} approche de ses limites`,
    summary: 'La demande dépasse durablement le confort d’une ligne de bus classique. Renforcer l’offre reste possible ; à plus long terme, un mode plus capacitaire peut devenir pertinent.',
    metric: `${Math.round((candidate.line.demandSatisfactionRate ?? 1) * 100)} % servis`,
    lineId: line.id,
    panel: 'NETWORK',
  }
}

function buildDepotNetworkSignal(save: GameSave): GameWorldPulseItem | null {
  const latest = save.data.simulation.history.at(-1)
  if (!latest) return null
  const candidate = latest.lines
    .filter(line => (line.depotDistanceKm ?? 0) > 15)
    .sort((a, b) => (b.depotDistanceKm ?? 0) - (a.depotDistanceKm ?? 0))[0]
  if (!candidate) return null
  const source = save.data.network.lines.find(line => line.id === candidate.lineId)
  if (!source) return null
  return {
    id: `advisor:depot-distance:${source.id}:${latest.day}`,
    tone: 'OPPORTUNITY',
    priority: (candidate.depotDistanceKm ?? 0) > 30 ? 72 : 60,
    title: `${source.name} est loin de son dépôt`,
    summary: `Le parc parcourt environ ${(candidate.depotDistanceKm ?? 0).toFixed(1)} km pour rejoindre la ligne. Un dépôt compatible plus proche peut réduire les mouvements à vide et stabiliser l’exploitation.`,
    metric: `${(candidate.depotDistanceKm ?? 0).toFixed(1)} km`,
    lineId: source.id,
    panel: 'FLEET',
  }
}

function buildExpressMissionOpportunity(save: GameSave): GameWorldPulseItem | null {
  const latest = save.data.simulation.history.at(-1)
  const passengerReport = save.data.passengers.lastReport
  if (!latest || !passengerReport?.samples?.length) return null
  const candidates = latest.lines
    .filter(line => line.stationCount >= 12 && (line.networkRoutedPassengers ?? line.passengers) >= 18_000)
    .map(line => {
      const relevant = passengerReport.samples.filter(sample => sample.usedLineIds.includes(line.lineId) && (sample.totalMinutes ?? 0) >= 24)
      const longPassengers = relevant.reduce((sum, sample) => sum + Math.max(0, sample.transportedPassengers), 0)
      return { line, longPassengers }
    })
    .filter(item => item.longPassengers >= 1_500)
    .sort((a, b) => b.longPassengers - a.longPassengers)[0]
  if (!candidates) return null
  const source = save.data.network.lines.find(line => line.id === candidates.line.lineId)
  if (!source) return null
  return {
    id: `advisor:express:${source.id}:${latest.day}`,
    tone: 'OPPORTUNITY',
    priority: 64,
    title: `${source.name} porte beaucoup de trajets longs`,
    summary: 'Les échantillons Voyageurs 2.0 montrent un volume important de trajets longs sur cette ligne. Une mission semi-directe ou directe peut être pertinente sans modifier le tracé.',
    metric: `${compactNumber(candidates.longPassengers)} trajets longs`,
    lineId: source.id,
    panel: 'NETWORK',
  }
}

function buildEconomicNetworkSignal(save: GameSave): GameWorldPulseItem | null {
  const latest = save.data.simulation.history.at(-1)
  if (!latest || latest.lines.length === 0) return null
  const candidate = latest.lines
    .filter(line => line.passengers >= 800)
    .map(line => ({
      line,
      effort: Math.max(0, line.operatingCost - line.revenue),
      ratio: line.revenue > 0 ? line.operatingCost / line.revenue : Number.POSITIVE_INFINITY,
    }))
    .filter(item => item.effort >= 20_000 && item.ratio >= 1.45)
    .sort((a, b) => b.effort - a.effort)[0]
  if (!candidate) return null
  const source = save.data.network.lines.find(line => line.id === candidate.line.lineId)
  if (!source) return null
  return {
    id: `advisor:economy:${source.id}:${latest.day}`,
    tone: 'INFO',
    priority: 57,
    title: `${source.name} demande un effort d’exploitation`,
    summary: `Cette ligne coûte environ ${compactNumber(candidate.line.operatingCost)} € par jour pour ${compactNumber(candidate.line.revenue)} € de recettes. CLU ne bloque pas vos constructions : ce signal sert seulement à voir où fréquence, matériel ou maintenance pèsent le plus.`,
    metric: `${compactNumber(candidate.effort)} €/j`,
    lineId: source.id,
    panel: 'FINANCES',
  }
}

function buildOperationsIncidentSignal(save: GameSave): GameWorldPulseItem | null {
  const day = save.data.simulationDay
  const incident = [...(save.data.operations?.disruptions ?? [])]
    .filter(item => !item.resolvedAt && disruptionTouchesDay(item, day))
    .sort((a, b) => {
      const rank = { CRITICAL: 4, MAJOR: 3, MODERATE: 2, MINOR: 1 }
      return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0) || b.startsAtAbsoluteMinute - a.startsAtAbsoluteMinute
    })[0]
  if (!incident) return null
  const line = save.data.network.lines.find(item => item.id === incident.lineId)
  if (!line) return null
  const substitution = (save.data.operations?.substitutionServices ?? []).find(item => item.disruptionId === incident.id && !item.endedAt)
  const tone: GameWorldPulseTone = incident.severity === 'CRITICAL' || incident.severity === 'MAJOR' ? 'ALERT' : 'INFO'
  const metric = incident.suspended ? 'Interruption' : incident.delayMinutes > 0 ? `+${incident.delayMinutes} min` : 'Perturbé'
  return {
    id: `operations:${incident.id}`,
    tone,
    priority: incident.severity === 'CRITICAL' ? 122 : incident.severity === 'MAJOR' ? 108 : incident.severity === 'MODERATE' ? 88 : 64,
    title: incident.title,
    summary: `${incident.passengerMessage}${substitution ? ` Bus de substitution actif toutes les ${substitution.headwayMinutes} min.` : incident.suspended ? ' Le PCC peut mettre en place un bus de substitution.' : ''}`,
    metric,
    lineId: line.id,
    panel: 'OPERATIONS',
  }
}

function buildActiveEvent(save: GameSave): GameWorldPulseItem | null {
  const event = save.data.events?.active
  if (!event) return null
  const remaining = Math.max(0, event.decisionDeadlineDay - save.data.simulationDay)
  return {
    id: `event:${event.id}`,
    tone: 'EVENT',
    priority: 110,
    title: event.title,
    summary: event.description,
    metric: remaining <= 0 ? 'Aujourd’hui' : `${remaining} j`,
    panel: 'EVENTS',
  }
}

function dedupe(items: GameWorldPulseItem[]) {
  const result: GameWorldPulseItem[] = []
  const seenTargets = new Set<string>()
  for (const item of items.sort((a, b) => b.priority - a.priority)) {
    const target = item.lineId
      ? `line:${item.lineId}`
      : item.municipalityCode
        ? `municipality:${item.municipalityCode}`
        : item.panel
          ? `panel:${item.panel}:${item.tone}`
          : item.id
    if (seenTargets.has(target)) continue
    seenTargets.add(target)
    result.push(item)
  }
  return result
}

export function buildGameWorldPulse(
  save: GameSave,
  municipalities: GameMunicipality[],
  summary: GameNetworkTerritorySummary,
  infoItems: GameInfoItem[],
  limit = 3,
): GameWorldPulseItem[] {
  const candidates: GameWorldPulseItem[] = []
  const operationalLines = save.data.network.lines.filter(line => line.status === 'OPERATIONAL').length
  // Métropole 2.0 : les premiers jours servent à découvrir et construire.
  // CLU ne harcèle pas le joueur avec Paris, Saint-Denis, Créteil, etc. juste
  // après l'ouverture de sa première ligne. Les alertes graves et événements
  // restent visibles, mais les opportunités territoriales attendent un peu.
  const discoveryGrace = save.data.simulationDay <= 7 && operationalLines <= 1
  const starter = buildStarterOpportunity(save)
  const operationsIncident = buildOperationsIncidentSignal(save)
  const event = buildActiveEvent(save)
  const localEvent = buildLocalMobilityEvent(save, summary)
  const localEventOutcome = buildFinishedLocalEventOutcome(save)
  const urbanProject = buildUrbanProjectSignal(save)
  const busUpgrade = discoveryGrace ? null : buildBusUpgradeOpportunity(save)
  const stationNetwork = discoveryGrace ? null : buildStationNetworkSignal(save)
  const territory = discoveryGrace ? null : buildTerritoryOpportunity(save, municipalities, summary)
  const development = buildTerritoryDevelopmentSignal(save, municipalities)
  const centrality = discoveryGrace ? null : buildEmergingCentralitySignal(save, municipalities, summary)
  const growth = buildGrowthSignal(save)
  const economic = discoveryGrace ? null : buildEconomicNetworkSignal(save)
  const depot = discoveryGrace ? null : buildDepotNetworkSignal(save)
  const express = discoveryGrace ? null : buildExpressMissionOpportunity(save)
  if (starter) candidates.push(starter)
  if (operationsIncident) candidates.push(operationsIncident)
  if (event) candidates.push(event)
  if (localEvent) candidates.push(localEvent)
  if (localEventOutcome) candidates.push(localEventOutcome)
  if (urbanProject) candidates.push(urbanProject)
  if (busUpgrade) candidates.push(busUpgrade)
  if (stationNetwork) candidates.push(stationNetwork)
  let municipalityOpportunityAdded = false
  for (const item of infoItems) {
    if (item.category === 'MUNICIPALITY' && item.severity === 'OPPORTUNITY') {
      if (discoveryGrace || municipalityOpportunityAdded) continue
      municipalityOpportunityAdded = true
    }
    candidates.push(fromInfo(item))
  }
  if (territory) candidates.push(territory)
  if (development) candidates.push(development)
  if (centrality) candidates.push(centrality)
  if (growth) candidates.push(growth)
  if (economic) candidates.push(economic)
  if (depot) candidates.push(depot)
  if (express) candidates.push(express)

  let territorialOpportunityCount = 0
  let passiveCount = 0
  const deduped = dedupe(candidates)
  const hasUrgent = deduped.some(item => item.priority >= 100 || item.tone === 'ALERT' || item.tone === 'EVENT')

  return deduped.filter(item => {
    if (item.tone === 'OPPORTUNITY' && item.municipalityCode) {
      if (territorialOpportunityCount >= 1) return false
      territorialOpportunityCount += 1
    }

    // Phase 24 : Actions doit être une file de priorités, pas un fil de
    // notifications. En présence d'un incident/événement majeur, on retire les
    // informations faibles. Et même en temps calme, une seule carte passive
    // INFO/SUCCESS est affichée à la fois.
    if (hasUrgent && item.priority < 55 && (item.tone === 'INFO' || item.tone === 'SUCCESS')) return false
    if (item.tone === 'INFO' || item.tone === 'SUCCESS') {
      if (passiveCount >= 1) return false
      passiveCount += 1
    }
    return true
  }).slice(0, Math.max(1, limit))
}
