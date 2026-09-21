import { computed } from 'vue'
import { buildGameInfoItems } from '../engine/alerts'
import { useMetropoleGame } from './useMetropoleGame'
import type { GameInfoItem } from '../types/alerts'

function compactInfoItems(source: GameInfoItem[]) {
  const result: GameInfoItem[] = []
  const attentionByLine = new Map<string, number>()
  const infoByLine = new Map<string, number>()

  for (const item of source) {
    if (!item.lineId) {
      result.push(item)
      continue
    }

    if (item.severity === 'CRITICAL' || item.severity === 'WARNING') {
      const count = attentionByLine.get(item.lineId) ?? 0
      if (count >= 2) continue
      attentionByLine.set(item.lineId, count + 1)
      result.push(item)
      continue
    }

    const infoCount = infoByLine.get(item.lineId) ?? 0
    if (infoCount >= 1) continue
    infoByLine.set(item.lineId, infoCount + 1)
    result.push(item)
  }

  return result
}

export function useGameInfoCenter() {
  const game = useMetropoleGame()
  const items = computed(() => {
    const save = game.state.value.save
    return save ? compactInfoItems(buildGameInfoItems(save)) : []
  })
  const criticalCount = computed(() => items.value.filter(item => item.severity === 'CRITICAL').length)
  const attentionCount = computed(() => items.value.filter(item => ['CRITICAL', 'WARNING'].includes(item.severity)).length)
  return { items, criticalCount, attentionCount }
}
