import { computed, ref } from 'vue'
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '../config/legal'

const open = ref(false)
const currentId = ref<LegalDocumentId>('LEGAL')

export function useGameLegal() {
  const document = computed(() => LEGAL_DOCUMENTS[currentId.value])

  function show(id: LegalDocumentId) {
    currentId.value = id
    open.value = true
  }

  function close() {
    open.value = false
  }

  return {
    open,
    currentId,
    document,
    show,
    close,
    documents: LEGAL_DOCUMENTS,
  }
}
