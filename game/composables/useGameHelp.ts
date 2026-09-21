import { computed } from 'vue'
import { useState } from '#app'
import type { GameTutorialProgress } from '../types/help'

const TUTORIAL_STORAGE_KEY = 'clu-metropole-tutorial-v1'

function defaultProgress(): GameTutorialProgress {
  return {
    active: false,
    completed: false,
    stepIndex: 0,
    baselineDay: 1,
    baselineLineCount: 0,
    startedAt: null,
    updatedAt: null,
  }
}

export function useGameHelp() {
  const wikiOpen = useState<boolean>('clu-metropole-wiki-open', () => false)
  const wikiArticleId = useState<string | null>('clu-metropole-wiki-article', () => null)
  const tutorial = useState<GameTutorialProgress>('clu-metropole-tutorial-progress', defaultProgress)
  const initialized = useState<boolean>('clu-metropole-help-ready', () => false)

  const tutorialActive = computed(() => tutorial.value.active && !tutorial.value.completed)

  function persistTutorial() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorial.value))
  }

  function initialize() {
    if (initialized.value || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameTutorialProgress>
        tutorial.value = {
          active: parsed.active === true,
          completed: parsed.completed === true,
          stepIndex: Number.isFinite(parsed.stepIndex) ? Math.max(0, Math.floor(Number(parsed.stepIndex))) : 0,
          baselineDay: Number.isFinite(parsed.baselineDay) ? Math.max(1, Math.floor(Number(parsed.baselineDay))) : 1,
          baselineLineCount: Number.isFinite(parsed.baselineLineCount) ? Math.max(0, Math.floor(Number(parsed.baselineLineCount))) : 0,
          startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        }
      }
    }
    catch {
      tutorial.value = defaultProgress()
    }
    initialized.value = true
  }

  function openWiki(articleId?: string | null) {
    wikiArticleId.value = articleId ?? null
    wikiOpen.value = true
  }

  function closeWiki() {
    wikiOpen.value = false
  }

  function startTutorial(baselineDay: number, baselineLineCount: number, restart = false) {
    if (restart || tutorial.value.completed || !tutorial.value.startedAt) {
      tutorial.value = {
        active: true,
        completed: false,
        stepIndex: 0,
        baselineDay: Math.max(1, Math.floor(baselineDay)),
        baselineLineCount: Math.max(0, Math.floor(baselineLineCount)),
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }
    else {
      tutorial.value.active = true
      tutorial.value.updatedAt = new Date().toISOString()
    }
    persistTutorial()
  }

  function pauseTutorial() {
    tutorial.value.active = false
    tutorial.value.updatedAt = new Date().toISOString()
    persistTutorial()
  }

  function skipTutorial() {
    tutorial.value.active = false
    tutorial.value.completed = true
    tutorial.value.updatedAt = new Date().toISOString()
    persistTutorial()
  }

  function setTutorialStep(stepIndex: number) {
    tutorial.value.stepIndex = Math.max(0, Math.floor(stepIndex))
    tutorial.value.updatedAt = new Date().toISOString()
    persistTutorial()
  }

  function completeTutorial() {
    tutorial.value.active = false
    tutorial.value.completed = true
    tutorial.value.updatedAt = new Date().toISOString()
    persistTutorial()
  }

  function resetTutorial() {
    tutorial.value = defaultProgress()
    persistTutorial()
  }

  return {
    wikiOpen,
    wikiArticleId,
    tutorial,
    tutorialActive,
    initialize,
    openWiki,
    closeWiki,
    startTutorial,
    pauseTutorial,
    skipTutorial,
    setTutorialStep,
    completeTutorial,
    resetTutorial,
  }
}
