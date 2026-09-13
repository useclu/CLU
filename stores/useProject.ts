import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import useVersion from '~/composables/useVersion'
import { compareVersions } from '~/utils/versions'

const PROJECT_STORAGE_KEY = 'project'

/*
 * Copie immuable créée une seule fois.
 *
 * Elle reste utile comme "dernier parachute" séparé
 * de l'historique de sécurité roulant.
 */
const RECOVERY_STORAGE_KEY =
  'clu-project-recovery-backup'

/*
 * Historique de sécurité PERSISTANT.
 *
 * Contrairement à past/future :
 * - il survit à F5 ;
 * - il survit à un redémarrage du navigateur ;
 * - il est stocké hors du store Pinia "project" ;
 * - un reset du projet ne le supprime pas.
 */
const SAFETY_HISTORY_STORAGE_KEY =
  'clu-project-safety-history-v1'

/*
 * 20 snapshots complets offrent déjà une bonne profondeur
 * tout en restant raisonnables pour la taille limitée de localStorage.
 *
 * Si le quota du navigateur est atteint, le code retire
 * automatiquement les snapshots les plus anciens.
 */
const SAFETY_HISTORY_LIMIT = 20

/*
 * Tant que le plan continue à changer, on crée au maximum
 * un snapshot persistant toutes les 30 secondes.
 */
const SAFETY_HISTORY_INTERVAL = 30_000

/*
 * En développement, HMR peut réévaluer ce module.
 *
 * Cette clé permet d'arrêter l'ancien interval/listeners
 * avant d'en recréer de nouveaux.
 */
const SAFETY_RUNTIME_KEY =
  '__cluProjectSafetyRuntimeV1'

type SafetySnapshotReason =
  | 'startup'
  | 'periodic'
  | 'manual'
  | 'before-reset'
  | 'before-recovery-restore'
  | 'before-safety-restore'
  | 'page-hide'

interface SafetySnapshot {
  id: string
  createdAt: number
  reason: SafetySnapshotReason
  project: string
}

export interface ProjectSafetySnapshotInfo {
  id: string
  createdAt: number
  reason: SafetySnapshotReason
  size: number
}

interface StoredProjectState {
  version?: string | null
  presetBased?: boolean
  line?: Line
}

/*
 * =========================================================
 * OUTILS LOCALSTORAGE
 * =========================================================
 */

function storageAvailable() {
  return (
    typeof localStorage
    !== 'undefined'
  )
}

function createSafetySnapshotId() {
  return (
    `${Date.now()}-`
    + Math.random()
      .toString(36)
      .slice(2, 10)
  )
}

function readSafetyHistory():
  SafetySnapshot[] {
  if (!storageAvailable()) {
    return []
  }

  const raw =
    localStorage.getItem(
      SAFETY_HISTORY_STORAGE_KEY,
    )

  if (!raw) {
    return []
  }

  try {
    const parsed =
      JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (
          entry,
        ): entry is SafetySnapshot =>
          !!entry
          && typeof entry === 'object'
          && typeof entry.id === 'string'
          && typeof entry.createdAt === 'number'
          && typeof entry.reason === 'string'
          && typeof entry.project === 'string',
      )
      .sort(
        (a, b) =>
          a.createdAt - b.createdAt,
      )
  }
  catch {
    /*
     * Une ancienne clé illisible ne doit jamais
     * empêcher CLU de démarrer.
     */
    return []
  }
}

function writeSafetyHistory(
  entries: SafetySnapshot[],
) {
  if (!storageAvailable()) {
    return false
  }

  let working =
    entries.slice(
      -SAFETY_HISTORY_LIMIT,
    )

  /*
   * localStorage possède un quota assez faible.
   *
   * Si le plan devient très gros, on retire les sauvegardes
   * les plus anciennes jusqu'à ce que l'écriture passe.
   *
   * On ne supprime JAMAIS le snapshot le plus récent
   * avant d'avoir tenté toutes les autres possibilités.
   */
  while (working.length > 0) {
    try {
      localStorage.setItem(
        SAFETY_HISTORY_STORAGE_KEY,
        JSON.stringify(working),
      )

      return true
    }
    catch {
      if (working.length <= 1) {
        return false
      }

      working = working.slice(1)
    }
  }

  try {
    localStorage.setItem(
      SAFETY_HISTORY_STORAGE_KEY,
      '[]',
    )

    return true
  }
  catch {
    return false
  }
}

function appendSafetySnapshot(
  project: string,
  reason: SafetySnapshotReason,
) {
  if (
    !storageAvailable()
    || !project
  ) {
    return false
  }

  /*
   * Vérifie que le snapshot contient bien un JSON valide.
   *
   * On ne veut jamais remplir l'historique avec
   * une chaîne corrompue.
   */
  try {
    JSON.parse(project)
  }
  catch {
    return false
  }

  const history =
    readSafetyHistory()

  const latest =
    history[
      history.length - 1
    ]

  /*
   * Pas de doublon :
   * si rien n'a changé, on ne consomme aucun espace.
   */
  if (
    latest?.project === project
  ) {
    return false
  }

  history.push({
    id: createSafetySnapshotId(),
    createdAt: Date.now(),
    reason,
    project,
  })

  return writeSafetyHistory(
    history,
  )
}

/*
 * =========================================================
 * BACKUP IMMUTABLE DE SECOURS
 * =========================================================
 */

function createRecoveryBackup() {
  if (!storageAvailable()) {
    return
  }

  /*
   * On ne remplace JAMAIS une sauvegarde de secours
   * déjà créée.
   *
   * Le but est précisément de conserver une copie du
   * projet tel qu'il était avant les prochains essais.
   */
  if (
    localStorage.getItem(
      RECOVERY_STORAGE_KEY,
    ) !== null
  ) {
    return
  }

  const persistedProject =
    localStorage.getItem(
      PROJECT_STORAGE_KEY,
    )

  if (!persistedProject) {
    return
  }

  localStorage.setItem(
    RECOVERY_STORAGE_KEY,
    persistedProject,
  )
}

/*
 * À chaque démarrage, on archive également la version
 * actuellement persistée du projet dans l'historique roulant.
 *
 * Cette opération utilise directement localStorage car elle
 * se produit AVANT que Pinia n'ait nécessairement terminé
 * son hydratation.
 */
function archivePersistedProjectAtStartup() {
  if (!storageAvailable()) {
    return
  }

  const persistedProject =
    localStorage.getItem(
      PROJECT_STORAGE_KEY,
    )

  if (!persistedProject) {
    return
  }

  appendSafetySnapshot(
    persistedProject,
    'startup',
  )
}

/*
 * =========================================================
 * STORE
 * =========================================================
 */

export const useProject = defineStore(
  'project',
  () => {
    /*
     * =========================================================
     * SAUVEGARDES AVANT HYDRATATION
     * =========================================================
     */

    createRecoveryBackup()
    archivePersistedProjectAtStartup()

    const {
      applicationVersion,
      projectMinimumVersion,
    } = useVersion()

    const version =
      ref<string | null>(
        applicationVersion,
      )

    const presetBased = ref(false)

    const outdated = computed(
      () =>
        compareVersions(
          version.value,
          projectMinimumVersion,
        ) === -1,
    )

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

      topology: [
        {
          id: '1',

          $lineSection: {
            elements: [],
          },
        },
      ],

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

    const past =
      ref<string[]>([])

    const future =
      ref<string[]>([])

    /*
     * État actuellement considéré comme validé
     * dans l'historique.
     */
    const currentSnapshot =
      ref(
        JSON.stringify(line),
      )

    /*
     * Une modification récente attend quelques millisecondes
     * avant d'être définitivement ajoutée à l'historique.
     *
     * Cela permet par exemple de ne pas créer énormément
     * d'étapes lors d'une seule manipulation.
     */
    const pendingSnapshot =
      ref<string | null>(null)

    let historyTimer:
      ReturnType<typeof setTimeout>
      | null =
        null

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
          pendingSnapshot.value
            !== null
          && pendingSnapshot.value
            !== currentSnapshot.value
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

    function pushSnapshot(
      snapshot: string,
    ) {
      if (
        snapshot
        === currentSnapshot.value
      ) {
        pendingSnapshot.value =
          null

        return
      }

      past.value.push(
        currentSnapshot.value,
      )

      if (
        past.value.length
        > HISTORY_LIMIT
      ) {
        past.value.shift()
      }

      currentSnapshot.value =
        snapshot

      /*
       * Dès qu'une nouvelle modification est faite après
       * une annulation, l'historique "Après" disparaît.
       */
      future.value = []

      pendingSnapshot.value =
        null
    }

    function flushPendingSnapshot() {
      clearHistoryTimer()

      if (
        pendingSnapshot.value
        === null
      ) {
        return
      }

      const snapshot =
        pendingSnapshot.value

      pendingSnapshot.value =
        null

      pushSnapshot(
        snapshot,
      )
    }

    function scheduleHistorySnapshot() {
      if (restoringHistory) {
        return
      }

      const snapshot =
        createSnapshot()

      if (
        snapshot
        === currentSnapshot.value
      ) {
        pendingSnapshot.value =
          null

        clearHistoryTimer()

        return
      }

      pendingSnapshot.value =
        snapshot

      clearHistoryTimer()

      historyTimer =
        setTimeout(
          () => {
            flushPendingSnapshot()
          },
          HISTORY_DELAY,
        )
    }

    /*
     * Remplace entièrement le contenu réactif de `line`
     * par celui contenu dans le snapshot.
     *
     * On supprime également les propriétés qui pourraient
     * exister dans l'état actuel mais plus dans l'état restauré.
     */
    function restoreSnapshot(
      snapshot: string,
    ) {
      const restored =
        JSON.parse(
          snapshot,
        ) as Line

      restoringHistory = true

      const target =
        line as unknown as
        Record<string, unknown>

      const source =
        restored as unknown as
        Record<string, unknown>

      for (
        const key
        of Object.keys(target)
      ) {
        if (!(key in source)) {
          delete target[key]
        }
      }

      for (
        const [key, value]
        of Object.entries(source)
      ) {
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

      const previousSnapshot =
        past.value.pop()

      if (
        previousSnapshot
        === undefined
      ) {
        return
      }

      future.value.push(
        currentSnapshot.value,
      )

      if (
        future.value.length
        > HISTORY_LIMIT
      ) {
        future.value.shift()
      }

      currentSnapshot.value =
        previousSnapshot

      restoreSnapshot(
        previousSnapshot,
      )
    }

    function redo() {
      flushPendingSnapshot()

      const nextSnapshot =
        future.value.pop()

      if (
        nextSnapshot
        === undefined
      ) {
        return
      }

      past.value.push(
        currentSnapshot.value,
      )

      if (
        past.value.length
        > HISTORY_LIMIT
      ) {
        past.value.shift()
      }

      currentSnapshot.value =
        nextSnapshot

      restoreSnapshot(
        nextSnapshot,
      )
    }

    function clearHistory() {
      clearHistoryTimer()

      past.value = []
      future.value = []

      pendingSnapshot.value =
        null

      currentSnapshot.value =
        createSnapshot()
    }

    /*
     * =========================================================
     * HISTORIQUE DE SÉCURITÉ PERSISTANT
     * =========================================================
     */

    let safetyDirty = false

    let safetyInterval:
      ReturnType<typeof setInterval>
      | null =
        null

    function serializeCurrentProjectState() {
      return JSON.stringify({
        version:
          version.value,

        presetBased:
          presetBased.value,

        line,
      })
    }

    function markSafetyDirty() {
      if (restoringHistory) {
        return
      }

      safetyDirty = true
    }

    function createSafetySnapshot(
      reason:
        SafetySnapshotReason =
          'manual',
    ) {
      const saved =
        appendSafetySnapshot(
          serializeCurrentProjectState(),
          reason,
        )

      /*
       * Même si le snapshot était identique au précédent,
       * l'état courant est considéré comme couvert.
       */
      safetyDirty = false

      return saved
    }

    function flushSafetySnapshot(
      reason:
        SafetySnapshotReason =
          'periodic',
    ) {
      if (!safetyDirty) {
        return false
      }

      return createSafetySnapshot(
        reason,
      )
    }

    function getSafetySnapshots():
      ProjectSafetySnapshotInfo[] {
      return readSafetyHistory()
        .slice()
        .reverse()
        .map(entry => ({
          id: entry.id,
          createdAt:
            entry.createdAt,
          reason:
            entry.reason,
          size:
            entry.project.length,
        }))
    }

    function applyStoredProjectState(
      parsed:
        StoredProjectState,
    ) {
      if (
        !parsed.line
        || typeof parsed.line
          !== 'object'
      ) {
        return false
      }

      restoringHistory = true

      const target =
        line as unknown as
        Record<string, unknown>

      const source =
        parsed.line as unknown as
        Record<string, unknown>

      for (
        const key
        of Object.keys(target)
      ) {
        if (!(key in source)) {
          delete target[key]
        }
      }

      for (
        const [key, value]
        of Object.entries(source)
      ) {
        target[key] = value
      }

      if (
        typeof parsed.version
        === 'string'
        || parsed.version === null
      ) {
        version.value =
          parsed.version
      }

      if (
        typeof parsed.presetBased
        === 'boolean'
      ) {
        presetBased.value =
          parsed.presetBased
      }

      restoringHistory = false

      clearHistory()

      /*
       * Le snapshot restauré est déjà protégé.
       * On repart donc d'un état propre.
       */
      safetyDirty = false

      return true
    }

    function restoreSafetySnapshot(
      snapshotId: string,
    ) {
      const history =
        readSafetyHistory()

      const snapshot =
        history.find(
          entry =>
            entry.id === snapshotId,
        )

      if (!snapshot) {
        return false
      }

      let parsed:
        StoredProjectState

      try {
        parsed =
          JSON.parse(
            snapshot.project,
          ) as StoredProjectState
      }
      catch {
        return false
      }

      /*
       * Avant de revenir dans le passé,
       * on protège toujours l'état actuel.
       */
      appendSafetySnapshot(
        serializeCurrentProjectState(),
        'before-safety-restore',
      )

      return applyStoredProjectState(
        parsed,
      )
    }

    function clearSafetyHistory() {
      if (!storageAvailable()) {
        return
      }

      localStorage.removeItem(
        SAFETY_HISTORY_STORAGE_KEY,
      )

      safetyDirty = false
    }

    /*
     * =========================================================
     * RESTAURATION DE LA SAUVEGARDE IMMUTABLE
     * =========================================================
     */

    function restoreRecoveryBackup() {
      if (!storageAvailable()) {
        return false
      }

      const backup =
        localStorage.getItem(
          RECOVERY_STORAGE_KEY,
        )

      if (!backup) {
        return false
      }

      let parsed:
        StoredProjectState

      try {
        parsed =
          JSON.parse(
            backup,
          ) as StoredProjectState
      }
      catch {
        return false
      }

      /*
       * On protège l'état courant avant toute restauration.
       */
      appendSafetySnapshot(
        serializeCurrentProjectState(),
        'before-recovery-restore',
      )

      return applyStoredProjectState(
        parsed,
      )
    }

    /*
     * Supprime uniquement la copie immuable.
     *
     * Cela ne touche JAMAIS :
     * - au projet courant ;
     * - à l'historique de sécurité roulant.
     */
    function clearRecoveryBackup() {
      if (!storageAvailable()) {
        return
      }

      localStorage.removeItem(
        RECOVERY_STORAGE_KEY,
      )
    }

    /*
     * =========================================================
     * WATCHERS DU PLAN
     * =========================================================
     */

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
     *
     * Le même changement :
     * - alimente l'historique rapide Avant/Après ;
     * - marque l'historique de sécurité comme "à sauvegarder".
     */
    watch(
      line,
      () => {
        scheduleHistorySnapshot()
        markSafetyDirty()
      },
      {
        deep: true,
        flush: 'sync',
      },
    )

    /*
     * version / presetBased ne font pas partie de "line"
     * mais doivent eux aussi être couverts par le backup complet.
     */
    watch(
      [
        version,
        presetBased,
      ],
      () => {
        markSafetyDirty()
      },
      {
        flush: 'sync',
      },
    )

    /*
     * =========================================================
     * TIMER DE SÉCURITÉ
     * =========================================================
     */

    if (
      typeof window
      !== 'undefined'
    ) {
      type SafetyRuntime = {
        stop: () => void
      }

      const runtimeWindow =
        window as typeof window & {
          [SAFETY_RUNTIME_KEY]?:
            SafetyRuntime
        }

      /*
       * HMR :
       * on coupe l'ancienne instance avant d'en créer une nouvelle.
       */
      runtimeWindow[
        SAFETY_RUNTIME_KEY
      ]?.stop()

      const onPageHide =
        () => {
          flushSafetySnapshot(
            'page-hide',
          )
        }

      safetyInterval =
        setInterval(
          () => {
            flushSafetySnapshot(
              'periodic',
            )
          },
          SAFETY_HISTORY_INTERVAL,
        )

      window.addEventListener(
        'pagehide',
        onPageHide,
      )

      runtimeWindow[
        SAFETY_RUNTIME_KEY
      ] = {
        stop: () => {
          if (
            safetyInterval
            !== null
          ) {
            clearInterval(
              safetyInterval,
            )

            safetyInterval = null
          }

          window.removeEventListener(
            'pagehide',
            onPageHide,
          )
        },
      }
    }

    /*
     * =========================================================
     * NOUVEAU PROJET
     * =========================================================
     */

    function reset() {
      /*
       * IMPORTANT :
       * Nouveau projet ne détruit jamais la version précédente.
       *
       * On force ici un snapshot persistant juste AVANT le reset,
       * même si les 30 secondes ne sont pas encore écoulées.
       */
      createSafetySnapshot(
        'before-reset',
      )

      /*
       * On conserve également le parachute immuable
       * si aucun n'existe encore.
       */
      createRecoveryBackup()

      presetBased.value = false
      version.value =
        applicationVersion

      line.mode = null
      line.index = null
      line.color = null

      line.lineThickness =
        '0.375'

      line.lineStyle =
        'PLAIN'

      line.dotsColorPolicy =
        'INHERIT'

      line.fullyAccessible =
        false

      line.frameTerminusNames =
        true

      line.mapSize = 15

      line.topology = [
        {
          id: '1',

          $lineSection: {
            elements: [],
          },
        },
      ]

      line.annotations = []

      line.customModePictograms =
        {}

      /*
       * Le nouveau projet est maintenant différent
       * du snapshot pré-reset.
       *
       * Il sera archivé automatiquement après modification
       * ou au prochain passage du timer.
       */
      markSafetyDirty()
    }

    return {
      version,
      presetBased,
      outdated,
      line,
      reset,

      /*
       * Historique rapide
       */
      canUndo,
      canRedo,
      undo,
      redo,
      clearHistory,

      /*
       * Parachute immuable
       */
      restoreRecoveryBackup,
      clearRecoveryBackup,

      /*
       * Historique de sécurité persistant
       */
      createSafetySnapshot,
      getSafetySnapshots,
      restoreSafetySnapshot,
      clearSafetyHistory,
    }
  },
  {
    persist: {
      storage: localStorage,

      serializer: {
        serialize(
          value:
            Record<string, any>,
        ) {
          return JSON.stringify(
            value,
          )
        },

        deserialize(
          value: string,
        ) {
          const object =
            JSON.parse(value)

          if (
            object.version
            === undefined
          ) {
            object.version = null
          }

          return object as
            Record<string, any>
        },
      },
    },
  },
)