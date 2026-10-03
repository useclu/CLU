import { computed, ref } from 'vue'
import { buildFrequencyStationPassages, buildInterchanges, buildVisualVehicles } from '../engine/transitRuntime'
import { buildOperationalStationPassages } from '../engine/operations'
import { findLineStation } from '../engine/network/geometry'
import type { GameInterchangeLink } from '../types/network'
import { useGameNetwork } from './useGameNetwork'
import { useGameSimulation } from './useGameSimulation'
import { useGameClock } from './useGameClock'
import { useMetropoleGame } from './useMetropoleGame'

const sharedNow = ref(Date.now())
let sharedTimerStarted = false

function createGameTransitRuntime() {
  const network = useGameNetwork()
  const simulation = useGameSimulation()
  const clock = useGameClock()
  const game = useMetropoleGame()

  if (typeof window !== 'undefined' && !sharedTimerStarted) {
    sharedTimerStarted = true
    // Les véhicules sont volontairement de simples points (Phase 22), pas une
    // animation continue. Les recalculer chaque seconde invalidait GamePlay et
    // la carte en permanence, y compris lorsque l'onglet était masqué.
    window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      sharedNow.value = Date.now()
    }, 2500)
  }

  const interchanges = computed(() => buildInterchanges(
    game.state.value.save?.data.network ?? { lines: network.lines.value, walkingTransfers: [] },
  ))
  const interchangesByStation = computed(() => {
    const index = new Map<string, GameInterchangeLink[]>()
    for (const link of interchanges.value) {
      const fromKey = `${link.fromLineId}\u0000${link.fromStationId}`
      const toKey = `${link.toLineId}\u0000${link.toStationId}`
      const from = index.get(fromKey) ?? []
      from.push(link)
      index.set(fromKey, from)
      const to = index.get(toKey) ?? []
      to.push(link)
      index.set(toKey, to)
    }
    return index
  })
  const reportMap = computed(() => Object.fromEntries((simulation.lastDayReport.value?.lines ?? []).map(report => [report.lineId, report])))

  // Phase 22 : retour volontaire au comportement visuel historique.
  // Les points de lignes à fréquence avancent sur une horloge réelle lente,
  // indépendamment de l'accélération du temps de simulation. Les lignes à
  // horaires restent positionnées à partir de leurs circulations réelles.
  const vehicles = computed(() => buildVisualVehicles(
    network.lines.value,
    sharedNow.value,
    reportMap.value,
    game.state.value.save
      ? {
          day: simulation.day.value,
          calendarStartDate: game.state.value.save.data.calendarStartDate,
          gameMinute: clock.gameMinutes.value,
          operations: game.state.value.save.data.operations,
        }
      : undefined,
  ))

  function stationInterchanges(lineId: string, stationId: string) {
    return interchangesByStation.value.get(`${lineId}\u0000${stationId}`) ?? []
  }

  function stationPassages(lineId: string, stationId: string, limit = 3) {
    const line = network.lines.value.find(item => item.id === lineId)
    const save = game.state.value.save
    if (line?.schedule?.mode === 'TIMETABLE' && save) {
      return buildOperationalStationPassages(
        line,
        stationId,
        simulation.day.value,
        save.data.calendarStartDate,
        clock.gameMinutes.value,
        save.data.operations,
        limit,
      ).map(passage => ({
        vehicleId: `schedule-${passage.runId}`,
        lineId: line.id,
        lineName: line.name,
        shortCode: line.shortCode,
        color: line.color,
        stationId,
        stationName: findLineStation(line, stationId)?.name ?? '',
        direction: 1 as const,
        directionName: passage.directionName,
        etaMinutes: passage.etaMinutes,
        missionCode: passage.missionCode,
        missionName: passage.missionName,
        scheduledMinute: passage.scheduledMinute,
        effectiveMinute: passage.effectiveMinute,
        delayMinutes: passage.delayMinutes,
        isExtraService: passage.extra,
      }))
    }
    if (!line || !save) return []
    return buildFrequencyStationPassages(
      line,
      stationId,
      reportMap.value[lineId],
      {
        day: simulation.day.value,
        calendarStartDate: save.data.calendarStartDate,
        gameMinute: clock.gameMinutes.value,
        operations: save.data.operations,
      },
      limit,
    )
  }

  return { interchanges, vehicles, stationInterchanges, stationPassages }
}

type GameTransitRuntime = ReturnType<typeof createGameTransitRuntime>
let sharedRuntime: GameTransitRuntime | null = null

export function useGameTransitRuntime() {
  // CLU Métropole est une SPA (`ssr: false`) : tous les composants peuvent
  // partager le même runtime réactif. Avant ce cache, chaque appel recréait
  // les mêmes computed et pouvait recalculer plusieurs fois les véhicules
  // visuels et les correspondances à partir du même état.
  if (!sharedRuntime) sharedRuntime = createGameTransitRuntime()
  return sharedRuntime
}
