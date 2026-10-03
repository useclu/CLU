import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { modeToShape } from '~/data/modes'

function cloneProjectIndex(index: CustomLineIndexDescription): CustomLineIndexDescription {
  return {
    ...index,
    index: typeof index.index === 'string' ? index.index : String(index.index ?? ''),
    prefix: typeof index.prefix === 'string' ? index.prefix : '',
    suffix: typeof index.suffix === 'string' ? index.suffix : '',
    color: typeof index.color === 'string' && index.color ? index.color : '#000000',
    image: index.image ?? null,
  }
}

export const useCustomLineIndices = defineStore('customLineIndices', () => {
  /** Bibliothèque personnelle visible dans l'éditeur d'indices. */
  const indices = ref<CustomLineIndexDescription[]>([])

  /*
   * Identités embarquées dans le projet actuellement ouvert.
   *
   * Elles sont persistées avec l'état local de l'Editor afin de survivre à F5,
   * mais elles ne font PAS partie de la bibliothèque visible : getModeIndices()
   * ne retourne que `indices`. Elles servent uniquement à résoudre les IDs déjà
   * référencés par le plan.
   */
  const projectIndices = ref<CustomLineIndexDescription[]>([])

  function setProjectIndices(next: CustomLineIndexDescription[] | null | undefined) {
    projectIndices.value = Array.isArray(next)
      ? next
        .filter(index => index && typeof index.id === 'string' && typeof index.mode === 'string')
        .map(cloneProjectIndex)
      : []
  }

  function clearProjectIndices() {
    projectIndices.value = []
  }

  function getModeIndices(mode: Mode | null): CustomLineIndexDescription[] {
    /*
     * IMPORTANT : la liste/picker d'indices personnalisés représente uniquement
     * la bibliothèque personnelle. Les identités locales d'un plan Métropole ne
     * doivent donc jamais y apparaître automatiquement.
     */
    return indices.value.filter(index => index.mode === mode)
  }

  function findIndexById(id: string): CustomLineIndexDescription | null {
    return projectIndices.value.find(index => index.id === id)
      ?? indices.value.find(index => index.id === id)
      ?? null
  }

  function deleteById(id: string): void {
    /* Supprime uniquement la bibliothèque personnelle, jamais le snapshot du projet. */
    const index = indices.value.find(item => item.id === id)
    if (index) {
      indices.value.splice(indices.value.indexOf(index), 1)
    }
  }

  function createNewIndex(mode: Mode): CustomLineIndexDescription {
    const newIndex: CustomLineIndexDescription = {
      id: uuidv4(),
      shape: modeToShape(mode),
      mode,
      prefix: '',
      index: '',
      suffix: '',
      color: '#000000',
      image: null,
    }
    indices.value.push(newIndex)

    return newIndex
  }

  return {
    indices,
    projectIndices,
    getModeIndices,
    findIndexById,
    deleteById,
    createNewIndex,
    setProjectIndices,
    clearProjectIndices,
  }
}, {
  persist: {
    storage: localStorage,
  },
})
