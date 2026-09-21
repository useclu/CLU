import { useState } from '#app'
import { watch } from 'vue'
import { useGameSettings } from './useGameSettings'

type AudioScene = 'HOME' | 'GAME'
type UiSound = 'CLICK' | 'CONFIRM' | 'CONSTRUCTION' | 'PURCHASE' | 'EVENT' | 'OBJECTIVE' | 'ERROR'

const MENU_TRACK = new URL('../assets/audio/clu-metropole-menu.ogg', import.meta.url).href
const GAME_TRACKS = [
  new URL('../assets/audio/clu-metropole-cityflow.ogg', import.meta.url).href,
  new URL('../assets/audio/clu-metropole-nightlines.ogg', import.meta.url).href,
]

let musicAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null
let fadeTimer: number | null = null
let gestureInstalled = false
let settingsWatcherInstalled = false
let gameTrackIndex = 0

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function useGameAudio() {
  const preferences = useGameSettings()
  const scene = useState<AudioScene>('clu-metropole-audio-scene', () => 'HOME')
  const initialized = useState<boolean>('clu-metropole-audio-ready', () => false)
  const unlocked = useState<boolean>('clu-metropole-audio-unlocked', () => false)

  function effectiveMusicVolume() {
    const settings = preferences.settings.value
    if (settings.masterMuted || settings.musicMuted) return 0
    return clamp01(settings.masterVolume / 100) * clamp01(settings.musicVolume / 100)
  }

  function effectiveSfxVolume() {
    const settings = preferences.settings.value
    if (settings.masterMuted || settings.sfxMuted) return 0
    return clamp01(settings.masterVolume / 100) * clamp01(settings.sfxVolume / 100)
  }

  function ensureMusicAudio() {
    if (typeof window === 'undefined') return null
    if (musicAudio) return musicAudio
    const audio = new Audio()
    audio.preload = 'auto'
    audio.loop = scene.value === 'HOME'
    audio.volume = 0
    audio.addEventListener('ended', () => {
      if (scene.value !== 'GAME') return
      gameTrackIndex = (gameTrackIndex + 1) % GAME_TRACKS.length
      audio.src = GAME_TRACKS[gameTrackIndex]!
      audio.loop = false
      void audio.play().catch(() => undefined)
    })
    musicAudio = audio
    return audio
  }

  function ensureContext() {
    if (typeof window === 'undefined') return null
    if (!audioContext) {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) audioContext = new Ctx()
    }
    return audioContext
  }

  function fadeMusic(target: number, duration = 520) {
    const audio = ensureMusicAudio()
    if (!audio) return
    if (fadeTimer !== null) window.clearInterval(fadeTimer)
    const from = audio.volume
    const safeTarget = clamp01(target)
    const startedAt = performance.now()
    fadeTimer = window.setInterval(() => {
      if (!musicAudio) return
      const progress = Math.min(1, (performance.now() - startedAt) / duration)
      const eased = 1 - (1 - progress) * (1 - progress)
      musicAudio.volume = clamp01(from + (safeTarget - from) * eased)
      if (progress >= 1 && fadeTimer !== null) {
        window.clearInterval(fadeTimer)
        fadeTimer = null
      }
    }, 24)
  }

  async function startSceneTrack(nextScene: AudioScene, force = false) {
    scene.value = nextScene
    const audio = ensureMusicAudio()
    if (!audio) return
    const src = nextScene === 'HOME' ? MENU_TRACK : GAME_TRACKS[gameTrackIndex]!
    const absoluteCurrent = audio.src
    const wanted = new URL(src, window.location.href).href
    audio.loop = nextScene === 'HOME'
    if (force || !absoluteCurrent || absoluteCurrent !== wanted) {
      if (!audio.paused) {
        fadeMusic(0, 240)
        await new Promise(resolve => window.setTimeout(resolve, 260))
      }
      audio.src = src
      audio.currentTime = 0
    }
    if (!unlocked.value) return
    try {
      await audio.play()
      fadeMusic(effectiveMusicVolume(), 650)
    }
    catch {
      // Les navigateurs peuvent encore refuser l'autoplay ; le prochain geste utilisateur relance.
    }
  }

  async function unlock() {
    unlocked.value = true
    const context = ensureContext()
    if (context?.state === 'suspended') {
      try { await context.resume() } catch {}
    }
    await startSceneTrack(scene.value)
  }

  function installGestureUnlock() {
    if (gestureInstalled || typeof window === 'undefined') return
    gestureInstalled = true
    const onGesture = () => {
      void unlock()
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      window.removeEventListener('touchstart', onGesture, true)
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    window.addEventListener('touchstart', onGesture, true)
  }

  function playUi(sound: UiSound) {
    const volume = effectiveSfxVolume()
    if (volume <= 0 || typeof window === 'undefined') return
    const context = ensureContext()
    if (!context || context.state === 'closed') return
    if (context.state === 'suspended') void context.resume()

    const now = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    const profile: Record<UiSound, { f1: number; f2: number; duration: number; gain: number; type: OscillatorType }> = {
      CLICK: { f1: 460, f2: 520, duration: .065, gain: .055, type: 'sine' },
      CONFIRM: { f1: 520, f2: 760, duration: .16, gain: .075, type: 'sine' },
      CONSTRUCTION: { f1: 185, f2: 330, duration: .24, gain: .085, type: 'triangle' },
      PURCHASE: { f1: 610, f2: 840, duration: .13, gain: .065, type: 'triangle' },
      EVENT: { f1: 390, f2: 620, duration: .18, gain: .06, type: 'sine' },
      OBJECTIVE: { f1: 520, f2: 980, duration: .3, gain: .08, type: 'sine' },
      ERROR: { f1: 240, f2: 155, duration: .2, gain: .075, type: 'square' },
    }
    const p = profile[sound]
    const osc = context.createOscillator()
    osc.type = p.type
    osc.frequency.setValueAtTime(p.f1, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.f2), now + p.duration)
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, p.gain * volume), now + .012)
    gain.gain.exponentialRampToValueAtTime(.0001, now + p.duration)
    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(now)
    osc.stop(now + p.duration + .02)
  }

  function refreshVolumes() {
    if (musicAudio) fadeMusic(effectiveMusicVolume(), 180)
  }

  function initialize() {
    if (typeof window === 'undefined') return
    installGestureUnlock()
    ensureMusicAudio()
    if (!settingsWatcherInstalled) {
      settingsWatcherInstalled = true
      watch(
        () => preferences.settings.value,
        () => refreshVolumes(),
        { deep: true },
      )
    }
    initialized.value = true
    void startSceneTrack(scene.value)
  }

  function setScene(nextScene: AudioScene) {
    if (nextScene === scene.value && musicAudio?.src) {
      refreshVolumes()
      return
    }
    void startSceneTrack(nextScene)
  }

  function dispose() {
    if (fadeTimer !== null && typeof window !== 'undefined') window.clearInterval(fadeTimer)
    fadeTimer = null
    musicAudio?.pause()
  }

  return {
    scene,
    initialized,
    initialize,
    unlock,
    setScene,
    playUi,
    refreshVolumes,
    dispose,
  }
}
