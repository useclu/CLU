import { computed } from 'vue'
import { useState } from '#app'
import { useGameSimulation } from './useGameSimulation'
import { useMetropoleGame } from './useMetropoleGame'

export type GameClockSpeed = 0.5 | 1 | 2

const DAY_DURATION_MS: Record<GameClockSpeed, number> = {
  0.5: 180_000,
  1: 120_000,
  2: 60_000,
}

export function useGameClock() {
  const game = useMetropoleGame()
  const simulation = useGameSimulation()
  const playing = useState<boolean>('clu-metropole-clock-playing', () => false)
  const speed = useState<GameClockSpeed>('clu-metropole-clock-speed', () => 1)
  const elapsedMs = useState<number>('clu-metropole-clock-elapsed', () => 0)
  const entryNotice = useState<boolean>('clu-metropole-clock-entry-notice', () => true)
  const blockedMessage = useState<string | null>('clu-metropole-clock-blocked', () => null)
  let timer: ReturnType<typeof setInterval> | null = null
  let lastTick = 0
  let advancing = false

  const durationMs = computed(() => DAY_DURATION_MS[speed.value])
  const progress = computed(() => Math.min(1, Math.max(0, elapsedMs.value / durationMs.value)))
  const remainingMs = computed(() => Math.max(0, durationMs.value - elapsedMs.value))
  const gameMinutes = computed(() => Math.min(1439, Math.floor(progress.value * 24 * 60)))
  const timeLabel = computed(() => {
    const hours = Math.floor(gameMinutes.value / 60)
    const minutes = gameMinutes.value % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  })
  const remainingLabel = computed(() => {
    const seconds = Math.ceil(remainingMs.value / 1000)
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes}:${String(rest).padStart(2, '0')}`
  })

  function pause(message: string | null = null) {
    playing.value = false
    blockedMessage.value = message
    lastTick = Date.now()
  }

  function play() {
    if (game.isReadOnly.value) return false
    blockedMessage.value = null
    entryNotice.value = false
    playing.value = true
    lastTick = Date.now()
    return true
  }

  function toggle() {
    return playing.value ? (pause(), false) : play()
  }

  function setSpeed(value: GameClockSpeed) {
    if (![0.5, 1, 2].includes(value)) return
    // Conserve le pourcentage de journée déjà écoulé lorsque la vitesse change.
    const ratio = progress.value
    speed.value = value
    elapsedMs.value = Math.round(DAY_DURATION_MS[value] * ratio)
  }

  function resetCycle() {
    elapsedMs.value = 0
    lastTick = Date.now()
  }

  function resetForEntry() {
    playing.value = false
    elapsedMs.value = 0
    blockedMessage.value = null
    entryNotice.value = true
    lastTick = Date.now()
  }

  async function advanceFromClock() {
    if (advancing || game.isReadOnly.value) return
    advancing = true
    try {
      const report = await simulation.advanceDay()
      if (report) resetCycle()
      else pause('Le temps est en pause : une action en cours empêche de passer au jour suivant.')
    }
    finally { advancing = false }
  }

  function tick() {
    const now = Date.now()
    if (!lastTick) lastTick = now
    const delta = Math.min(1000, Math.max(0, now - lastTick))
    lastTick = now
    if (!playing.value || advancing || game.isReadOnly.value) return
    elapsedMs.value += delta
    if (elapsedMs.value >= durationMs.value) void advanceFromClock()
  }

  function start() {
    if (timer) return
    lastTick = Date.now()
    timer = setInterval(tick, 200)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    lastTick = 0
  }

  return {
    playing,
    speed,
    elapsedMs,
    durationMs,
    progress,
    remainingMs,
    timeLabel,
    remainingLabel,
    entryNotice,
    blockedMessage,
    pause,
    play,
    toggle,
    setSpeed,
    resetCycle,
    resetForEntry,
    start,
    stop,
  }
}
