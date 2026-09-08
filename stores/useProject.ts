import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import useVersion from '~/composables/useVersion'
import { compareVersions } from '~/utils/versions'

export const useProject = defineStore('project', () => {
  const { applicationVersion, projectMinimumVersion } = useVersion()

  const version = ref<string | null>(applicationVersion)
  const presetBased = ref(false)
  const outdated = computed(() => compareVersions(version.value, projectMinimumVersion) === -1)

  const line = reactive<Line>({
    mode: null,
    index: null,
    color: null,
    lineThickness: '0.375',
    lineStyle: 'PLAIN',
    dotsColorPolicy: 'INHERIT',
    fullyAccessible: false,
    frameTerminusNames: true,
    mapSize: 15,
    topology: [{
      id: '1',
      $lineSection: {
        elements: [],
      },
    }],
    annotations: [],
    customModePictograms: {},
  })

  /*
   * =========================================================
   * HISTORIQUE AVANT / APRÈS
   * =========================================================
   */

  const HISTORY_LIMIT = 100
  const HISTORY_DELAY = 120

  const past = ref<string[]>([])
  const future = ref<string[]>([])

  /*
   * État actuellement considéré comme validé
   * dans l'historique.
   */
  const currentSnapshot = ref(JSON.stringify(line))

  /*
   * Une modification récente attend quelques millisecondes
   * avant d'être définitivement ajoutée à l'historique.
   *
   * Cela permet par exemple de ne pas créer énormément
   * d'étapes lors d'une seule manipulation.
   */
  const pendingSnapshot = ref<string | null>(null)

  let historyTimer: ReturnType<typeof setTimeout> | null = null

  /*
   * Empêche le watcher de créer une nouvelle étape
   * lorsque nous sommes nous-mêmes en train de restaurer
   * un ancien état.
   */
  let restoringHistory = false

  const canUndo = computed(() => {
    return (
      past.value.length > 0
      || (
        pendingSnapshot.value !== null
        && pendingSnapshot.value !== currentSnapshot.value
      )
    )
  })

  const canRedo = computed(() => {
    return future.value.length > 0
  })

  function createSnapshot() {
    return JSON.stringify(line)
  }

  function clearHistoryTimer() {
    if (historyTimer !== null) {
      clearTimeout(historyTimer)
      historyTimer = null
    }
  }

  function pushSnapshot(snapshot: string) {
    if (snapshot === currentSnapshot.value) {
      pendingSnapshot.value = null
      return
    }

    past.value.push(currentSnapshot.value)

    if (past.value.length > HISTORY_LIMIT) {
      past.value.shift()
    }

    currentSnapshot.value = snapshot

    /*
     * Dès qu'une nouvelle modification est faite après
     * une annulation, l'historique "Après" disparaît.
     */
    future.value = []

    pendingSnapshot.value = null
  }

  function flushPendingSnapshot() {
    clearHistoryTimer()

    if (pendingSnapshot.value === null) {
      return
    }

    const snapshot = pendingSnapshot.value

    pendingSnapshot.value = null

    pushSnapshot(snapshot)
  }

  function scheduleHistorySnapshot() {
    if (restoringHistory) {
      return
    }

    const snapshot = createSnapshot()

    if (snapshot === currentSnapshot.value) {
      pendingSnapshot.value = null
      clearHistoryTimer()
      return
    }

    pendingSnapshot.value = snapshot

    clearHistoryTimer()

    historyTimer = setTimeout(() => {
      flushPendingSnapshot()
    }, HISTORY_DELAY)
  }

  /*
   * Remplace entièrement le contenu réactif de `line`
   * par celui contenu dans le snapshot.
   *
   * On supprime également les propriétés qui pourraient
   * exister dans l'état actuel mais plus dans l'état restauré.
   */
  function restoreSnapshot(snapshot: string) {
    const restored = JSON.parse(snapshot) as Line

    restoringHistory = true

    const target = line as unknown as Record<string, unknown>
    const source = restored as unknown as Record<string, unknown>

    for (const key of Object.keys(target)) {
      if (!(key in source)) {
        delete target[key]
      }
    }

    for (const [key, value] of Object.entries(source)) {
      target[key] = value
    }

    restoringHistory = false
  }

  function undo() {
    /*
     * Si l'utilisateur modifie quelque chose puis clique
     * immédiatement sur Avant, on valide d'abord cette
     * modification dans l'historique.
     */
    flushPendingSnapshot()

    const previousSnapshot = past.value.pop()

    if (previousSnapshot === undefined) {
      return
    }

    future.value.push(currentSnapshot.value)

    if (future.value.length > HISTORY_LIMIT) {
      future.value.shift()
    }

    currentSnapshot.value = previousSnapshot

    restoreSnapshot(previousSnapshot)
  }

  function redo() {
    flushPendingSnapshot()

    const nextSnapshot = future.value.pop()

    if (nextSnapshot === undefined) {
      return
    }

    past.value.push(currentSnapshot.value)

    if (past.value.length > HISTORY_LIMIT) {
      past.value.shift()
    }

    currentSnapshot.value = nextSnapshot

    restoreSnapshot(nextSnapshot)
  }

  function clearHistory() {
    clearHistoryTimer()

    past.value = []
    future.value = []

    pendingSnapshot.value = null
    currentSnapshot.value = createSnapshot()
  }

  /*
   * On surveille toutes les modifications du plan :
   *
   * - propriétés générales
   * - arrêts
   * - correspondances
   * - branches
   * - annotations
   * - séparateurs
   * - pictogrammes
   * - etc.
   */
  watch(
    line,
    () => {
      scheduleHistorySnapshot()
    },
    {
      deep: true,
      flush: 'sync',
    },
  )

  /*
   * =========================================================
   * NOUVEAU PROJET
   * =========================================================
   */

  function reset() {
    presetBased.value = false
    version.value = applicationVersion

    line.mode = null
    line.index = null
    line.color = null
    line.lineThickness = '0.375'
    line.lineStyle = 'PLAIN'
    line.dotsColorPolicy = 'INHERIT'
    line.fullyAccessible = false
    line.frameTerminusNames = true
    line.mapSize = 15
    line.topology = [{
      id: '1',
      $lineSection: {
        elements: [],
      },
    }]
    line.annotations = []
    line.customModePictograms = {}
  }

  return {
    version,
    presetBased,
    outdated,
    line,
    reset,

    /*
     * Historique
     */
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
  }
}, {
  persist: {
    storage: localStorage,
    serializer: {
      serialize(value: Record<string, any>) {
        return JSON.stringify(value)
      },
      deserialize(value: string) {
        const object = JSON.parse(value)

        if (object.version === undefined) {
          object.version = null
        }

        return object as Record<string, any>
      },
    },
  },
})