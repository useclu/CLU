import { computed, onUnmounted, ref } from 'vue'
import { useMetropoleGame } from './useMetropoleGame'
import {
  decodeChallengeResult,
  encodeChallengeResult,
  evaluateChallengeObjectives,
  getChallengeDefinitionFingerprint,
} from '../engine/challenges'

export function useGameChallenge() {
  const game = useMetropoleGame()
  const nowMs = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  let finishing = false

  const runtime = computed(() => game.state.value.save?.data.challenge ?? null)
  const definition = computed(() => runtime.value?.definition ?? null)
  const isChallenge = computed(() => Boolean(runtime.value))
  const readOnly = computed(() => game.isReadOnly.value)
  const result = computed(() => runtime.value?.result ?? null)
  const remainingSeconds = computed(() => {
    const endsAt = runtime.value?.endsAt ? new Date(runtime.value.endsAt).getTime() : 0
    if (!endsAt || runtime.value?.status !== 'ACTIVE') return 0
    return Math.max(0, Math.ceil((endsAt - nowMs.value) / 1000))
  })
  const elapsedSeconds = computed(() => {
    if (!runtime.value) return 0
    const start = new Date(runtime.value.startedAt).getTime()
    const end = runtime.value.finishedAt ? new Date(runtime.value.finishedAt).getTime() : nowMs.value
    return Math.max(0, Math.round((end - start) / 1000))
  })
  const objectiveProgress = computed(() => {
    const save = game.state.value.save
    return save?.data.challenge ? evaluateChallengeObjectives(save) : []
  })
  const resultCode = computed(() => {
    const current = runtime.value
    if (!current?.result) return ''
    return encodeChallengeResult(current.definition, current.result)
  })

  function formatTime(seconds = remainingSeconds.value) {
    const safe = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(safe / 60)
    const secs = safe % 60
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  async function tick() {
    nowMs.value = Date.now()
    if (finishing || !runtime.value || runtime.value.status !== 'ACTIVE') return
    if (remainingSeconds.value > 0) return
    finishing = true
    try { await game.finishCurrentChallenge('TIME_LIMIT') }
    finally { finishing = false }
  }

  function startClock() {
    if (timer) return
    void tick()
    timer = setInterval(() => { void tick() }, 1000)
  }

  function stopClock() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  async function finishManually() {
    if (runtime.value?.status !== 'ACTIVE') return result.value
    return game.finishCurrentChallenge('MANUAL')
  }

  async function failHard() {
    if (runtime.value?.status !== 'ACTIVE') return result.value
    return game.finishCurrentChallenge('HARD_FAILURE')
  }

  function compareResultCode(code: string) {
    const current = runtime.value
    if (!current?.result) throw new Error('Terminez d’abord votre défi pour comparer les résultats.')
    const other = decodeChallengeResult(code)
    const fingerprint = getChallengeDefinitionFingerprint(current.definition)
    if (other.definitionFingerprint !== fingerprint) throw new Error('Ce résultat correspond à un autre défi ou à des règles différentes.')
    return {
      local: current.result,
      other: other.result,
      scoreDelta: current.result.score - other.result.score,
    }
  }

  onUnmounted(stopClock)

  return {
    runtime,
    definition,
    isChallenge,
    readOnly,
    result,
    remainingSeconds,
    elapsedSeconds,
    objectiveProgress,
    resultCode,
    formatTime,
    startClock,
    stopClock,
    finishManually,
    failHard,
    compareResultCode,
  }
}
