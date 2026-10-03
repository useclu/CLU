import { computed, watch } from 'vue'
import { useState } from '#app'
import { useGameSimulation } from './useGameSimulation'
import { useMetropoleGame } from './useMetropoleGame'
import { useCluOnline } from './useCluOnline'

export type GameClockSpeed = 0.5 | 1 | 2

const DAY_DURATION_MS: Record<GameClockSpeed, number> = {
  0.5: 180_000,
  1: 120_000,
  2: 60_000,
}

function createGameClock() {
  const game = useMetropoleGame()
  const simulation = useGameSimulation()
  const online = useCluOnline()
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

  function onlineAccepted() {
    const currentSaveId = game.state.value.save?.id
    return Boolean(
      online.sessionActive.value
      && online.moi.value?.statut === 'accepte'
      && currentSaveId
      && online.sauvegardeLocaleId.value === currentSaveId,
    )
  }

  function onlineReplica() {
    return onlineAccepted() && !online.estAdmin.value
  }

  function onlineClockReadOnly() {
    return onlineAccepted() && !online.peut('gerer_temps_simulation')
  }

  function envoyerHorlogeOnline() {
    if (!onlineAccepted() || !online.peut('gerer_temps_simulation')) return
    online.envoyerHorloge({ playing: playing.value, speed: speed.value, elapsedMs: elapsedMs.value })
  }

  function appliquerHorlogeOnline() {
    const remote = online.horloge.value
    if (!onlineAccepted() || !remote) return false
    const remoteSpeed = [0.5, 1, 2].includes(remote.speed) ? remote.speed : 1
    speed.value = remoteSpeed as GameClockSpeed
    const duration = DAY_DURATION_MS[speed.value]
    const elapsedSinceUpdate = remote.playing ? Math.max(0, Date.now() - Number(remote.updatedAt || Date.now())) : 0
    elapsedMs.value = Math.min(duration, Math.max(0, Number(remote.elapsedMs) || 0) + elapsedSinceUpdate)
    playing.value = remote.playing === true
    blockedMessage.value = null
    lastTick = Date.now()
    return true
  }

  watch(
    () => online.horloge.value,
    () => { appliquerHorlogeOnline() },
    { immediate: true },
  )

  function pause(message: string | null = null) {
    if (onlineClockReadOnly()) return
    playing.value = false
    blockedMessage.value = message
    lastTick = Date.now()
    envoyerHorlogeOnline()
  }

  function play() {
    if (game.isReadOnly.value || onlineClockReadOnly()) return false
    blockedMessage.value = null
    entryNotice.value = false
    playing.value = true
    lastTick = Date.now()
    envoyerHorlogeOnline()
    return true
  }

  function toggle() {
    return playing.value ? (pause(), false) : play()
  }

  function setSpeed(value: GameClockSpeed) {
    if (onlineClockReadOnly() || ![0.5, 1, 2].includes(value)) return
    // Conserve le pourcentage de journée déjà écoulé lorsque la vitesse change.
    const ratio = progress.value
    speed.value = value
    elapsedMs.value = Math.round(DAY_DURATION_MS[value] * ratio)
    envoyerHorlogeOnline()
  }

  function resetCycle() {
    elapsedMs.value = 0
    lastTick = Date.now()
    envoyerHorlogeOnline()
  }

  function resetForEntry() {
    if (appliquerHorlogeOnline()) return
    playing.value = false
    elapsedMs.value = 0
    blockedMessage.value = null
    entryNotice.value = true
    lastTick = Date.now()
  }

  async function advanceFromClock() {
    if (advancing || simulation.isAdvancing.value || game.isReadOnly.value) return
    advancing = true
    try {
      const report = await simulation.advanceDay()
      if (report) resetCycle()
      else if (!simulation.isAdvancing.value) pause('Le temps est en pause : une action en cours empêche de passer au jour suivant.')
    }
    finally { advancing = false }
  }

  function tick() {
    const now = Date.now()
    if (!lastTick) lastTick = now
    const delta = Math.min(1000, Math.max(0, now - lastTick))
    lastTick = now
    if (!playing.value || advancing || simulation.isAdvancing.value || game.isReadOnly.value) return
    elapsedMs.value += delta
    if (onlineReplica()) {
      elapsedMs.value = Math.min(durationMs.value, elapsedMs.value)
      return
    }
    if (elapsedMs.value >= durationMs.value) void advanceFromClock()
  }

  function start() {
    if (timer) return
    lastTick = Date.now()
    // Phase 21 : 2 mises à jour réactives/s suffisent pour l'horloge. L'ancien
    // tick 200 ms invalidait une grande partie de l'UI cinq fois par seconde,
    // même quand aucun calcul de gameplay n'en avait besoin.
    timer = setInterval(tick, 500)
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
    gameMinutes,
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

type GameClockRuntime = ReturnType<typeof createGameClock>
let sharedClockRuntime: GameClockRuntime | null = null

export function useGameClock() {
  // Horloge unique pour toute la SPA : évite de recréer les mêmes computed et
  // le watcher Online dans chaque composant qui consulte simplement l'heure.
  if (!sharedClockRuntime) sharedClockRuntime = createGameClock()
  return sharedClockRuntime
}
