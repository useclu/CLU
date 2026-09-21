<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useGameLegal } from '../../composables/useGameLegal'
import { useGameSettings } from '../../composables/useGameSettings'
import { localizedLegalDocument } from '../../config/legalLocalized'
import { translateGameText } from '../../config/i18n'
import type { LegalDocumentId } from '../../config/legal'

const legal = useGameLegal()
const preferences = useGameSettings()
const t = (input: string) => translateGameText(input, preferences.settings.value.locale)

const tabs: LegalDocumentId[] = ['LEGAL', 'PRIVACY', 'COOKIES', 'CREDITS']
const doc = computed(() => localizedLegalDocument(legal.currentId.value, preferences.settings.value.locale))
const tabDocs = computed(() => tabs.map(id => localizedLegalDocument(id, preferences.settings.value.locale)))

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && legal.open.value) legal.close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="legal.open.value" class="legal-overlay" role="presentation" @mousedown.self="legal.close">
      <section class="legal-modal" role="dialog" aria-modal="true" :aria-labelledby="`legal-title-${legal.currentId.value}`">
        <aside class="legal-sidebar">
          <div class="legal-brand">
            <span>CLU</span>
            <strong>{{ t('Informations juridiques') }}</strong>
          </div>

          <nav class="legal-nav" :aria-label="t('Documents juridiques')">
            <button
              v-for="tab in tabDocs"
              :key="tab.id"
              type="button"
              :class="{ active: legal.currentId.value === tab.id }"
              @click="legal.show(tab.id)"
            >
              <span>{{ tab.title }}</span>
            </button>
          </nav>

          <div class="legal-reference">
            <strong>{{ t('Version française de référence') }}</strong>
            <p>{{ t('La traduction affichée suit la langue du jeu. La version française reste la version rédactionnelle de référence, sans réduire les droits impératifs applicables.') }}</p>
          </div>
        </aside>

        <div class="legal-main">
          <header class="legal-head">
            <div>
              <span>{{ t('Document') }}</span>
              <h2 :id="`legal-title-${legal.currentId.value}`">{{ doc.title }}</h2>
              <p>{{ doc.subtitle }}</p>
            </div>
            <button type="button" class="legal-close" :aria-label="t('Fermer')" @click="legal.close">×</button>
          </header>

          <article class="legal-content" tabindex="0">
            <section v-for="section in doc.sections" :key="section.title">
              <h3>{{ section.title }}</h3>
              <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
              <ul v-if="section.bullets?.length">
                <li v-for="item in section.bullets" :key="item">{{ item }}</li>
              </ul>
            </section>
          </article>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.legal-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow: auto;
  overscroll-behavior: contain;
  background: rgba(2, 8, 12, .78);
  backdrop-filter: blur(10px);
}

.legal-modal {
  width: min(1120px, 100%);
  height: min(86dvh, 860px);
  max-height: calc(100dvh - 48px);
  min-height: 0;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.10);
  background: #08131a;
  color: #edf8fa;
  box-shadow: 0 34px 90px rgba(0,0,0,.48);
}

.legal-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 16px 18px;
  border-right: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(180deg, rgba(109, 226, 233, .06), rgba(255,255,255,.015));
}

.legal-brand {
  display: grid;
  gap: 4px;
  padding: 0 8px;
}

.legal-brand span {
  color: #7de7eb;
  font-size:calc(10px * var(--clu-text-scale,1));
  font-weight: 900;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.legal-brand strong {
  font-size:calc(16px * var(--clu-text-scale,1));
  letter-spacing: -.02em;
}

.legal-nav {
  display: grid;
  gap: 6px;
}

.legal-nav button {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 9px 11px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: rgba(237,248,250,.68);
  text-align: left;
  font-size:calc(11px * var(--clu-text-scale,1));
  line-height: 1.25;
  cursor: pointer;
}

.legal-nav button:hover {
  background: rgba(255,255,255,.035);
  color: #fff;
}

.legal-nav button.active {
  border-color: rgba(103, 224, 231, .22);
  background: rgba(103, 224, 231, .10);
  color: #a9f9fb;
}

.legal-reference {
  margin-top: auto;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.06);
}

.legal-reference strong {
  display: block;
  color: #7de7eb;
  font-size:calc(9px * var(--clu-text-scale,1));
  text-transform: uppercase;
  letter-spacing: .1em;
}

.legal-reference p {
  margin: 6px 0 0;
  color: rgba(234,246,248,.52);
  font-size:calc(9px * var(--clu-text-scale,1));
  line-height: 1.5;
}

.legal-main {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.legal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px 18px;
  border-bottom: 1px solid rgba(255,255,255,.07);
}

.legal-head span {
  color: #7de7eb;
  font-size:calc(9px * var(--clu-text-scale,1));
  font-weight: 900;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.legal-head h2 {
  margin: 7px 0 5px;
  max-width: 720px;
  font-size:calc(25px * var(--clu-text-scale,1));
  line-height: 1.08;
  letter-spacing: -.03em;
}

.legal-head p {
  margin: 0;
  color: rgba(235,247,249,.48);
  font-size:calc(10px * var(--clu-text-scale,1));
}

.legal-close {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 11px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: #eef8fa;
  font-size:calc(21px * var(--clu-text-scale,1));
  cursor: pointer;
}

.legal-content {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 24px 30px 72px;
  scrollbar-width: thin;
  scroll-padding-bottom: 72px;
}

.legal-content section + section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,.06);
}

.legal-content h3 {
  margin: 0 0 10px;
  color: #ecfbfc;
  font-size:calc(15px * var(--clu-text-scale,1));
  letter-spacing: -.01em;
}

.legal-content p,
.legal-content li {
  color: rgba(232,246,248,.73);
  font-size:calc(11px * var(--clu-text-scale,1));
  line-height: 1.72;
}

.legal-content p { margin: 0 0 9px; }
.legal-content ul { margin: 10px 0 0; padding-left: 20px; }
.legal-content li + li { margin-top: 7px; }

@media (max-width: 760px) {
  .legal-overlay { padding: 8px; place-items: start center; }
  .legal-modal {
    height: min(94dvh, 900px);
    max-height: calc(100dvh - 16px);
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0,1fr);
    border-radius: 16px;
  }
  .legal-sidebar {
    gap: 10px;
    padding: 12px;
    border-right: 0;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .legal-brand,
  .legal-reference { display: none; }
  .legal-nav {
    display: flex;
    overflow-x: auto;
    gap: 6px;
  }
  .legal-nav button {
    min-width: max-content;
    min-height: 36px;
    white-space: nowrap;
  }
  .legal-head { padding: 18px 18px 14px; }
  .legal-head h2 { font-size:calc(20px * var(--clu-text-scale,1)); }
  .legal-main { min-height: 0; overflow: hidden; }
  .legal-content { min-height: 0; padding: 20px 18px 80px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
}
</style>
