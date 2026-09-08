import { defineNuxtPlugin } from '#app'

import { createI18n } from 'vue-i18n'

import fr from '~/locales/fr.json'

export default defineNuxtPlugin(({ vueApp }) => {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'fr',
    fallbackLocale: 'fr',
    messages: {
      fr,
    },
  })

  vueApp.use(i18n)
})