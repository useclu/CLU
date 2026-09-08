import { usePrimeVue } from '#build/imports'

import { watch } from 'vue'

import { useI18n } from 'vue-i18n'

import { fr } from '~/assets/locales/fr.json'

export default function useLocale() {
  const { config } = usePrimeVue()

  const { locale: selectedLocale } = useI18n()

  watch(
    selectedLocale,
    () => {
      config.locale = fr
    },
    { immediate: true },
  )

  selectedLocale.value = 'fr'
}