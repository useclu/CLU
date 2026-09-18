<template>
  <main class="privacy-page">
    <article class="privacy-content">
      <h1>{{ $t('ui.pages.privacy.title') }}</h1>

      <p class="updated">
        {{ $t('ui.pages.privacy.updated') }}
      </p>

      <p>{{ $t('ui.pages.privacy.intro') }}</p>

      <section>
        <h2>{{ $t('ui.pages.privacy.local_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.local_text') }}</p>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.analytics_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.analytics_text_1') }}</p>
        <p>{{ $t('ui.pages.privacy.analytics_text_2') }}</p>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.adsense_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.adsense_text_1') }}</p>
        <p>{{ $t('ui.pages.privacy.adsense_text_2') }}</p>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.consent_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.consent_text_1') }}</p>
        <p>{{ $t('ui.pages.privacy.consent_text_2') }}</p>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.google_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.google_text') }}</p>

        <a
          :href="$i18n.locale === 'en'
            ? 'https://policies.google.com/technologies/partner-sites?hl=en'
            : 'https://policies.google.com/technologies/partner-sites?hl=fr'"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('ui.pages.privacy.google_link') }}
        </a>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.manage_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.manage_text') }}</p>
      </section>

      <section>
        <h2>{{ $t('ui.pages.privacy.changes_title') }}</h2>
        <p>{{ $t('ui.pages.privacy.changes_text') }}</p>
      </section>

      <RouterLink class="back" to="/">
        {{ $t('ui.pages.privacy.back') }}
      </RouterLink>
    </article>
  </main>
</template>

<style scoped>
.privacy-page {
  min-height: 100vh;
  padding: 3rem 1.5rem;
  background: var(--p-surface-0);
  color: var(--p-surface-900);
}

.privacy-content {
  width: min(800px, 100%);
  margin: 0 auto;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  line-height: 1.2;
}

.updated {
  margin-bottom: 2rem;
  color: var(--p-surface-500);
  font-size: 0.9rem;
}

section {
  margin-top: 2rem;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
}

p {
  margin: 0.75rem 0;
  line-height: 1.7;
}

a {
  color: var(--p-primary-600);
  text-decoration: underline;
}

.back {
  display: inline-block;
  margin-top: 3rem;
  font-weight: 600;
}

:global(.dark-mode) .privacy-page {
  background: var(--p-surface-950);
  color: var(--p-surface-50);
}
</style>
