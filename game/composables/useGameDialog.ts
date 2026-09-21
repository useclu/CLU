import { ref } from 'vue'

export type GameDialogTone = 'DEFAULT' | 'DANGER'
export type GameDialogKind = 'CONFIRM' | 'ALERT'

export interface GameDialogRequest {
  id: number
  kind: GameDialogKind
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  tone: GameDialogTone
}

interface PendingDialog {
  request: GameDialogRequest
  resolve: (accepted: boolean) => void
}

const current = ref<GameDialogRequest | null>(null)
const queue: PendingDialog[] = []
let activeResolver: ((accepted: boolean) => void) | null = null
let nextId = 1

function presentNext() {
  if (current.value || queue.length === 0) return
  const next = queue.shift()!
  current.value = next.request
  activeResolver = next.resolve
}

function enqueue(request: Omit<GameDialogRequest, 'id'>) {
  return new Promise<boolean>(resolve => {
    queue.push({ request: { ...request, id: nextId++ }, resolve })
    presentNext()
  })
}

function settle(accepted: boolean) {
  const resolver = activeResolver
  activeResolver = null
  current.value = null
  resolver?.(accepted)
  queueMicrotask(presentNext)
}

export function useGameDialog() {
  async function confirm(message: string, options: Partial<Omit<GameDialogRequest, 'id' | 'kind' | 'message'>> = {}) {
    return enqueue({
      kind: 'CONFIRM',
      title: options.title ?? 'Confirmation',
      message,
      confirmLabel: options.confirmLabel ?? 'Confirmer',
      cancelLabel: options.cancelLabel ?? 'Annuler',
      tone: options.tone ?? 'DEFAULT',
    })
  }

  async function alert(message: string, options: Partial<Omit<GameDialogRequest, 'id' | 'kind' | 'message'>> = {}) {
    await enqueue({
      kind: 'ALERT',
      title: options.title ?? 'Information',
      message,
      confirmLabel: options.confirmLabel ?? 'Fermer',
      tone: options.tone ?? 'DEFAULT',
    })
  }

  return {
    dialog: current,
    confirm,
    alert,
    accept: () => settle(true),
    cancel: () => settle(false),
  }
}
