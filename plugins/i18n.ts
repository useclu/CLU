import { defineNuxtPlugin } from '#app'
import { createI18n } from 'vue-i18n'

import en from '~/locales/en.json'
import fr from '~/locales/fr.json'
import { frExtra } from '~/locales/extra'

type LocaleMessages = Record<string, unknown>

function mergeMessages(
  base: LocaleMessages,
  extra: LocaleMessages,
): LocaleMessages {
  const result: LocaleMessages = { ...base }

  for (const [key, value] of Object.entries(extra)) {
    const current = result[key]

    if (
      current
      && value
      && typeof current === 'object'
      && typeof value === 'object'
      && !Array.isArray(current)
      && !Array.isArray(value)
    ) {
      result[key] = mergeMessages(
        current as LocaleMessages,
        value as LocaleMessages,
      )
      continue
    }

    result[key] = value
  }

  return result
}

export default defineNuxtPlugin(({ vueApp }) => {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'fr',
    fallbackLocale: 'fr',
    messages: {
      fr: mergeMessages(
        fr as LocaleMessages,
        frExtra as LocaleMessages,
      ),
      en,
    },
  })

  vueApp.use(i18n)
})
