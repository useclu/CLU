import { toRaw } from 'vue'
import {
  GAME_STORAGE_PREFIX,
} from '../config/game'

import type {
  GameSave,
} from '../types/game'

const DATABASE_NAME =
  `${GAME_STORAGE_PREFIX}-database`

const DATABASE_VERSION = 3

const SAVES_STORE = 'saves'
const BACKUPS_STORE = 'save-backups'
const MAX_BACKUPS_PER_SAVE = 3

export const MAX_REGULAR_GAME_SAVES = 10
export const MAX_CHALLENGE_GAME_SAVES = 10
export const CHALLENGE_SAVE_RETENTION_DAYS = 30

export type GameSaveBucket = 'REGULAR' | 'CHALLENGE'

export function gameSaveBucket(save: Pick<GameSave, 'mode'>): GameSaveBucket {
  return save.mode === 'CHALLENGE_DAILY' || save.mode === 'CHALLENGE_FRIEND' ? 'CHALLENGE' : 'REGULAR'
}

export function gameSaveLimit(bucket: GameSaveBucket) {
  return bucket === 'REGULAR' ? MAX_REGULAR_GAME_SAVES : MAX_CHALLENGE_GAME_SAVES
}

export class GameSaveLimitError extends Error {
  readonly bucket: GameSaveBucket
  readonly limit: number

  constructor(bucket: GameSaveBucket) {
    const limit = gameSaveLimit(bucket)
    super(bucket === 'REGULAR'
      ? `La limite de ${limit} parties sauvegardées est atteinte. Supprimez une partie avant d’en créer, importer ou dupliquer une autre.`
      : `La limite de ${limit} sauvegardes Défi est atteinte. Supprimez un Défi avant d’en créer ou importer un autre.`)
    this.name = 'GameSaveLimitError'
    this.bucket = bucket
    this.limit = limit
  }
}

export type GameSaveBackupReason =
  | 'MIGRATION'
  | 'IMPORT'
  | 'MANUAL'

export interface GameSaveBackup {
  id: string
  saveId: string
  reason: GameSaveBackupReason
  createdAt: string
  sourceVersion: number
  save: GameSave
}

/**
 * Une sauvegarde active est portée par un Proxy Vue. IndexedDB peut sérialiser
 * directement l'objet brut : refaire JSON.stringify + JSON.parse avant CHAQUE
 * écriture doublait inutilement le parcours de toute la partie et pouvait
 * bloquer le thread principal plusieurs secondes sur les grosses sauvegardes.
 *
 * Les backups, beaucoup plus rares, gardent une copie JSON détachée afin de
 * rester de vrais snapshots immuables.
 */
function prepareActiveSaveForStorage(save: GameSave): GameSave {
  return toRaw(save) as GameSave
}

function prepareDetachedForStorage<T>(value: T): T {
  const serialized = JSON.stringify(value)
  return JSON.parse(serialized) as T
}

const knownSaveIds = new Set<string>()
let databasePromise: Promise<IDBDatabase> | null = null

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}

function ensureClient() {
  if (
    typeof window === 'undefined'
    || !('indexedDB' in window)
  ) {
    throw new Error(
      'IndexedDB est indisponible dans cet environnement.',
    )
  }
}

function openDatabase(): Promise<IDBDatabase> {
  ensureClient()

  // IndexedDB sait gérer plusieurs transactions concurrentes sur une même
  // connexion. Réouvrir puis refermer la base à chaque autosauvegarde ajoutait
  // inutilement un aller-retour asynchrone sur le chemin le plus fréquent du jeu.
  // On conserve donc une connexion partagée pendant la vie de l'application.
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(SAVES_STORE)) {
        const store = database.createObjectStore(
          SAVES_STORE,
          { keyPath: 'id' },
        )
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
        store.createIndex('mode', 'mode', { unique: false })
      }
      else {
        const store = request.transaction?.objectStore(SAVES_STORE)
        if (store && !store.indexNames.contains('mode')) store.createIndex('mode', 'mode', { unique: false })
      }

      if (!database.objectStoreNames.contains(BACKUPS_STORE)) {
        const backupStore = database.createObjectStore(
          BACKUPS_STORE,
          { keyPath: 'id' },
        )
        backupStore.createIndex('saveId', 'saveId', { unique: false })
        backupStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Impossible d’ouvrir la base de données de CLU Métropole.'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('La base de données CLU Métropole est actuellement bloquée.'))
    }
  })

  return databasePromise
}

async function readAllGameSaves(database: IDBDatabase): Promise<GameSave[]> {
  return await new Promise<GameSave[]>((resolve, reject) => {
    const transaction = database.transaction(SAVES_STORE, 'readonly')
    const request = transaction.objectStore(SAVES_STORE).getAll()
    request.onsuccess = () => {
      const saves = request.result as GameSave[]
      for (const save of saves) knownSaveIds.add(save.id)
      resolve(saves)
    }
    request.onerror = () => reject(request.error ?? new Error('Impossible de lire les sauvegardes.'))
  })
}

export async function getGameSaveCounts(): Promise<{ regular: number; challenge: number }> {
  const database = await openDatabase()
  const saves = await readAllGameSaves(database)
  let regular = 0
  let challenge = 0
  for (const save of saves) {
    if (gameSaveBucket(save) === 'REGULAR') regular += 1
    else challenge += 1
  }
  return { regular, challenge }
}

export async function assertCanCreateGameSave(mode: GameSave['mode']): Promise<void> {
  const bucket: GameSaveBucket = mode === 'CHALLENGE_DAILY' || mode === 'CHALLENGE_FRIEND' ? 'CHALLENGE' : 'REGULAR'
  const counts = await getGameSaveCounts()
  const count = bucket === 'REGULAR' ? counts.regular : counts.challenge
  if (count >= gameSaveLimit(bucket)) throw new GameSaveLimitError(bucket)
}

export async function saveGame(save: GameSave): Promise<void> {
  const database = await openDatabase()
  const cleanSave = prepareActiveSaveForStorage(save)

  // Une partie déjà chargée/créée existe forcément dans IndexedDB. Éviter le
  // get() préalable économise une seconde opération I/O à chaque autosave.
  // Le contrôle de quota reste complet pour un ID réellement nouveau.
  if (!knownSaveIds.has(cleanSave.id)) {
    const existing = await new Promise<GameSave | null>((resolve, reject) => {
      const transaction = database.transaction(SAVES_STORE, 'readonly')
      const request = transaction.objectStore(SAVES_STORE).get(cleanSave.id)
      request.onsuccess = () => resolve((request.result as GameSave | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Impossible de vérifier la sauvegarde.'))
    })
    if (existing) knownSaveIds.add(cleanSave.id)
    else {
      const saves = await readAllGameSaves(database)
      const bucket = gameSaveBucket(cleanSave)
      const count = saves.filter(item => gameSaveBucket(item) === bucket).length
      if (count >= gameSaveLimit(bucket)) throw new GameSaveLimitError(bucket)
    }
  }

  const write = (payload: GameSave) => new Promise<void>((resolve, reject) => {
    try {
      const transaction = database.transaction(SAVES_STORE, 'readwrite')
      transaction.objectStore(SAVES_STORE).put(payload)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(
        transaction.error ?? new Error('Impossible d’enregistrer la partie.'),
      )
      transaction.onabort = () => reject(
        transaction.error ?? new Error('L’enregistrement de la partie a été annulé.'),
      )
    }
    catch (error) { reject(error) }
  })

  try {
    await write(cleanSave)
  }
  catch (error) {
    // Défense exceptionnelle : si un futur système injecte un Proxy imbriqué
    // dans l'objet brut, on retombe sur l'ancienne copie JSON uniquement pour
    // cette écriture au lieu de casser la sauvegarde.
    if (!(error instanceof DOMException) || error.name !== 'DataCloneError') throw error
    await write(prepareDetachedForStorage(save))
  }
  knownSaveIds.add(cleanSave.id)
}

export async function getGameSave(id: string): Promise<GameSave | null> {
  const database = await openDatabase()
  return await new Promise<GameSave | null>((resolve, reject) => {
    const transaction = database.transaction(SAVES_STORE, 'readonly')
    const request = transaction.objectStore(SAVES_STORE).get(id)
    request.onsuccess = () => {
      const save = (request.result as GameSave | undefined) ?? null
      if (save) knownSaveIds.add(save.id)
      resolve(save)
    }
    request.onerror = () => reject(
      request.error ?? new Error('Impossible de charger la partie.'),
    )
  })
}

export async function listGameSaves(): Promise<GameSave[]> {
  const database = await openDatabase()
  const saves = await readAllGameSaves(database)
  return saves.sort((a, b) => (
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ))
}

export async function deleteGameSave(id: string): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([SAVES_STORE, BACKUPS_STORE], 'readwrite')
    transaction.objectStore(SAVES_STORE).delete(id)

    // Une suppression volontaire est définitive : les copies de secours internes
    // associées sont nettoyées afin de ne pas laisser d'orphelins dans IndexedDB.
    const backupIndex = transaction.objectStore(BACKUPS_STORE).index('saveId')
    const cursorRequest = backupIndex.openCursor(IDBKeyRange.only(id))
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(
      transaction.error ?? new Error('Impossible de supprimer la sauvegarde.'),
    )
    transaction.onabort = () => reject(
      transaction.error ?? new Error('La suppression de la sauvegarde a été annulée.'),
    )
  })
  knownSaveIds.delete(id)
}

async function trimBackups(saveId: string) {
  const database = await openDatabase()
  const backups = await new Promise<GameSaveBackup[]>((resolve, reject) => {
    const transaction = database.transaction(BACKUPS_STORE, 'readonly')
    const index = transaction.objectStore(BACKUPS_STORE).index('saveId')
    const request = index.getAll(saveId)
    request.onsuccess = () => resolve(request.result as GameSaveBackup[])
    request.onerror = () => reject(request.error ?? new Error('Impossible de lire les sauvegardes de secours.'))
  })

  const obsolete = backups
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(MAX_BACKUPS_PER_SAVE)

  if (!obsolete.length) return

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BACKUPS_STORE, 'readwrite')
    const store = transaction.objectStore(BACKUPS_STORE)
    for (const backup of obsolete) store.delete(backup.id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Impossible de nettoyer les sauvegardes de secours.'))
  })
}

export async function backupGameSave(
  save: GameSave,
  reason: GameSaveBackupReason,
): Promise<GameSaveBackup> {
  const database = await openDatabase()
  const backup: GameSaveBackup = prepareDetachedForStorage({
    id: createId(),
    saveId: save.id,
    reason,
    createdAt: new Date().toISOString(),
    sourceVersion: Number(save.version) || 1,
    save,
  })

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BACKUPS_STORE, 'readwrite')
    transaction.objectStore(BACKUPS_STORE).put(backup)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(
      transaction.error ?? new Error('Impossible de créer la sauvegarde de secours.'),
    )
  })

  await trimBackups(save.id)
  return backup
}

export async function restoreGameSaveBackup(backup: GameSaveBackup): Promise<void> {
  await saveGame(backup.save)
}

/**
 * V44 — Les sauvegardes Défi vivent dans leur propre quota (10) et sont
 * automatiquement nettoyées après 30 jours. Une date d'expiration explicite
 * reste prioritaire ; sinon on utilise la fin du défi, puis sa création.
 * Les parties libres ne sont jamais concernées.
 */
export async function pruneExpiredChallengeSaves(now = new Date()): Promise<number> {
  const saves = await listGameSaves()
  const retentionMs = CHALLENGE_SAVE_RETENTION_DAYS * 86_400_000
  const expired = saves.filter(save => {
    if (gameSaveBucket(save) !== 'CHALLENGE') return false
    const challenge = save.data?.challenge
    const explicit = challenge?.expiresAt ? new Date(challenge.expiresAt).getTime() : Number.NaN
    if (Number.isFinite(explicit)) return explicit <= now.getTime()
    const anchorRaw = challenge?.finishedAt || save.createdAt || save.updatedAt
    const anchor = new Date(anchorRaw).getTime()
    return Number.isFinite(anchor) && anchor + retentionMs <= now.getTime()
  })
  for (const save of expired) await deleteGameSave(save.id)
  return expired.length
}
