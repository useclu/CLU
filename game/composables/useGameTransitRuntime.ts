import { computed, ref } from 'vue'
import { buildInterchanges, buildStationPassages, buildVisualVehicles, interchangesForStation } from '../engine/transitRuntime'
import { useGameNetwork } from './useGameNetwork'
import { useGameSimulation } from './useGameSimulation'

const sharedNow = ref(Date.now())
let sharedTimerStarted = false

export function useGameTransitRuntime() {
  const network = useGameNetwork()
  const simulation = useGameSimulation()

  if (typeof window !== 'undefined' && !sharedTimerStarted) {
    sharedTimerStarted = true
    window.setInterval(() => { sharedNow.value = Date.now() }, 1000)
  }

  const interchanges = computed(() => buildInterchanges({ lines: network.lines.value }))
  const reportMap = computed(() => Object.fromEntries((simulation.lastDayReport.value?.lines ?? []).map(report => [report.lineId, report])))
  const vehicles = computed(() => buildVisualVehicles(network.lines.value, sharedNow.value, reportMap.value))

  function stationInterchanges(lineId: string, stationId: string) {
    return interchangesForStation({ lines: network.lines.value }, lineId, stationId)
  }

  function stationPassages(lineId: string, stationId: string, limit = 3) {
    return buildStationPassages(network.lines.value, vehicles.value, lineId, stationId, limit)
  }

  return { interchanges, vehicles, stationInterchanges, stationPassages }
}
