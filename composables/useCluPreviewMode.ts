import { computed } from 'vue'
import { useState } from '#app'

export const PREVIEW_MODES = [
  'SNCF',
  'RATP',
] as const

export type PreviewMode =
  typeof PREVIEW_MODES[number]

export const PREVIEW_MODE_STORAGE_KEY =
  'clu-preview-mode'

const LEGACY_SNCF_PREVIEW_STORAGE_KEY =
  'clu-sncf-preview'

function isPreviewMode(
  value: string | null,
): value is PreviewMode {
  return PREVIEW_MODES.includes(
    value as PreviewMode,
  )
}

export default function useCluPreviewMode() {
  const previewMode =
    useState<PreviewMode | null>(
      'clu-preview-mode',
      () => null,
    )

  const isPreviewing =
    computed(
      () => previewMode.value !== null,
    )

  function persistPreviewMode(
    mode: PreviewMode | null,
  ) {
    if (typeof window === 'undefined') {
      return
    }

    if (mode) {
      window.localStorage.setItem(
        PREVIEW_MODE_STORAGE_KEY,
        mode,
      )
    }
    else {
      window.localStorage.removeItem(
        PREVIEW_MODE_STORAGE_KEY,
      )
    }

    window.localStorage.setItem(
      LEGACY_SNCF_PREVIEW_STORAGE_KEY,
      mode === 'SNCF' ? '1' : '0',
    )
  }

  function setPreviewMode(
    mode: PreviewMode,
  ) {
    previewMode.value = mode
    persistPreviewMode(mode)
  }

  function exitPreview() {
    previewMode.value = null
    persistPreviewMode(null)
  }

  function restorePreviewMode() {
    if (typeof window === 'undefined') {
      return previewMode.value
    }

    const storedMode =
      window.localStorage.getItem(
        PREVIEW_MODE_STORAGE_KEY,
      )

    if (isPreviewMode(storedMode)) {
      previewMode.value = storedMode
      return storedMode
    }

    // Nettoie les anciens modes supprimés (IDFM / CARTOGRAPHIC).
    if (
      storedMode === 'IDFM'
      || storedMode === 'CARTOGRAPHIC'
    ) {
      previewMode.value = null
      persistPreviewMode(null)
      return null
    }

    if (
      window.localStorage.getItem(
        LEGACY_SNCF_PREVIEW_STORAGE_KEY,
      ) === '1'
    ) {
      previewMode.value = 'SNCF'
      persistPreviewMode('SNCF')
      return 'SNCF'
    }

    previewMode.value = null
    return null
  }

  return {
    previewMode,
    isPreviewing,
    setPreviewMode,
    exitPreview,
    restorePreviewMode,
  }
}
