import { usePrimeVue } from '#build/imports'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { en } from '~/assets/locales/en.json'
import { fr } from '~/assets/locales/fr.json'

const STORAGE_KEY = 'clu-locale'
const SUPPORTED_LOCALES = ['fr', 'en'] as const

type SupportedLocale = typeof SUPPORTED_LOCALES[number]

function normalizeLocale(value: string | null | undefined): SupportedLocale {
  return value === 'en' ? 'en' : 'fr'
}

export default function useLocale() {
  const { config } = usePrimeVue()
  const { locale: selectedLocale } = useI18n()

  if (import.meta.client) {
    const savedLocale = localStorage.getItem(STORAGE_KEY)

    if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as SupportedLocale)) {
      selectedLocale.value = savedLocale
    }
    else {
      selectedLocale.value = normalizeLocale(selectedLocale.value)
    }
  }
  else {
    selectedLocale.value = normalizeLocale(selectedLocale.value)
  }

  watch(
    selectedLocale,
    (locale) => {
      const normalized = normalizeLocale(locale)

      if (selectedLocale.value !== normalized) {
        selectedLocale.value = normalized
        return
      }

      config.locale = normalized === 'en' ? en : fr

      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY, normalized)
        document.documentElement.lang = normalized
      }
    },
    { immediate: true },
  )
}
