import { computed } from 'vue'
import { useState } from '#app'
import { useGameNetwork } from './useGameNetwork'
import { findLineStation } from '../engine/network/geometry'

export function useGameSelection() {
  const network = useGameNetwork()
  const selectedLineId = useState<string | null>('clu-metropole-selected-line-id', () => null)
  const selectedStationId = useState<string | null>('clu-metropole-selected-station-id', () => null)

  const selectedLine = computed(() => network.lines.value.find(line => line.id === selectedLineId.value) ?? null)
  const selectedStation = computed(() => selectedLine.value && selectedStationId.value ? findLineStation(selectedLine.value, selectedStationId.value) : null)

  function selectLine(lineId: string | null) {
    const changed = selectedLineId.value !== lineId
    selectedLineId.value = lineId
    if (!lineId || changed) selectedStationId.value = null
  }

  function selectStation(lineId: string, stationId: string) {
    selectedLineId.value = lineId
    selectedStationId.value = stationId
  }

  function clear() {
    selectedLineId.value = null
    selectedStationId.value = null
  }

  return {
    selectedLineId,
    selectedStationId,
    selectedLine,
    selectedStation,
    selectLine,
    selectStation,
    clear,
  }
}
