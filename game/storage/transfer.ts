import type { GameSave } from '../types/game'
import { isGameTerritory } from '../config/territories'

export const GAME_SAVE_EXPORT_FORMAT = 'CLU_METROPOLE_SAVE'
export const GAME_SAVE_EXPORT_FORMAT_VERSION = 1

export interface GameSaveExportEnvelope {
  format: typeof GAME_SAVE_EXPORT_FORMAT
  formatVersion: number
  exportedAt: string
  gameSaveVersion: number
  save: GameSave
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function assertGameSaveShape(value: unknown): asserts value is GameSave {
  if (!isRecord(value)) throw new Error('Le fichier ne contient pas une sauvegarde CLU Métropole valide.')
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error('Identifiant de sauvegarde manquant.')
  if (typeof value.name !== 'string' || !value.name.trim()) throw new Error('Nom de sauvegarde manquant.')
  if (typeof value.version !== 'number' || !Number.isFinite(value.version) || value.version < 1) throw new Error('Version de sauvegarde invalide.')
  if (!['FREE', 'CHALLENGE_DAILY', 'CHALLENGE_FRIEND'].includes(String(value.mode))) throw new Error('Mode de partie non reconnu.')
  if (!isGameTerritory(value.territory)) throw new Error('Territoire de sauvegarde non reconnu par cette version de CLU Métropole.')
  if (!isRecord(value.data)) throw new Error('Données de partie manquantes.')
  if (value.territory === 'GENERATED') {
    if (!isRecord(value.data.generatedTerritory) || typeof value.data.generatedTerritory.seed !== 'string' || !value.data.generatedTerritory.seed.trim()) {
      throw new Error('La sauvegarde de carte fictive ne contient pas de seed valide.')
    }
  }
  if (typeof value.data.simulationDay !== 'number' || !Number.isFinite(value.data.simulationDay)) throw new Error('Jour de simulation invalide.')
  if (!isRecord(value.data.network) || !Array.isArray(value.data.network.lines)) throw new Error('Réseau de la sauvegarde invalide.')
  if (!isRecord(value.data.economy)) throw new Error('Données financières manquantes.')
}

export function serializeGameSave(save: GameSave) {
  const envelope: GameSaveExportEnvelope = {
    format: GAME_SAVE_EXPORT_FORMAT,
    formatVersion: GAME_SAVE_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    gameSaveVersion: save.version,
    save,
  }
  return JSON.stringify(envelope, null, 2)
}

export function parseGameSaveExport(content: string): GameSave {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  }
  catch {
    throw new Error('Le fichier est illisible ou n’est pas un JSON valide.')
  }

  if (isRecord(parsed) && parsed.format === GAME_SAVE_EXPORT_FORMAT) {
    if (parsed.formatVersion !== GAME_SAVE_EXPORT_FORMAT_VERSION) {
      throw new Error('Cette version du format d’export CLU Métropole n’est pas prise en charge.')
    }
    assertGameSaveShape(parsed.save)
    return parsed.save
  }

  // Tolérance pour un éventuel export brut de développement antérieur.
  assertGameSaveShape(parsed)
  return parsed
}
