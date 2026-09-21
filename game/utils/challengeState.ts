import type { GameSave } from '../types/game'
import type { GameTransportMode } from '../types/network'

export function isSaveChallenge(save: GameSave | null | undefined) {
  return Boolean(save?.data?.challenge)
}

export function isSaveReadOnly(save: GameSave | null | undefined) {
  return Boolean(save?.data?.challenge?.readOnly || (save?.data?.challenge && save.data.challenge.status !== 'ACTIVE'))
}

export function canUseModeInSave(save: GameSave | null | undefined, mode: GameTransportMode) {
  const allowed = save?.data?.challenge?.definition.allowedModes
  return !allowed?.length || allowed.includes(mode)
}

export function assertSaveWritable(save: GameSave | null | undefined) {
  if (isSaveReadOnly(save)) throw new Error('Ce défi est terminé : la partie est désormais en lecture seule.')
}
