<script setup lang="ts">
import useLocale from '~/composables/useLocale'
import useVersionTracking from '~/composables/useVersionTracking'

useVersionTracking()
useLocale()
</script>

<template>
  <NuxtLayout>
    <Snow />
    <NuxtPage />
  </NuxtLayout>

  <BToast />

  <ConfirmDialog
    class="cblu-confirm-dialog"
    :pt="{
      root: {
        class: 'cblu-confirm-dialog-root',
      },
      content: {
        class: 'cblu-confirm-dialog-content',
      },
      icon: {
        class: 'cblu-confirm-dialog-icon',
      },
      message: {
        class: 'cblu-confirm-dialog-message',
      },
      footer: {
        class: 'cblu-confirm-dialog-footer',
      },
    }"
  >
    <template #message="slotProps">
      <div class="confirm-content">
        <div class="confirm-icon">
          <i class="i-tabler-file-spark" />
        </div>

        <div class="confirm-text">
          <span class="confirm-label">
            Nouveau projet
          </span>

          <p class="confirm-message">
            {{ slotProps.message.message }}
          </p>

          <div class="confirm-warning">
            <i class="i-tabler-alert-triangle" />

            <span>
              Les modifications non sauvegardées du projet actuel seront perdues.
            </span>
          </div>
        </div>
      </div>
    </template>
  </ConfirmDialog>
</template>

<style lang="scss">
:root {
  --blue-ratp: #0a0082;
  --blue-ratp-paper: #1F3C90;
  --blue-ratp-paper-secondary: rgba(31, 59, 143, 0.125);
  --yellow-ratp: #ffbe00;
  --place-brown: #80551A;
  --gray: #414241;
  --background-color: #eaeaea;

  /*
   * =========================================================
   * ÉCHELLE DU PLAN CLU
   * =========================================================
   *
   * IMPORTANT :
   *
   * Le moteur du plan a été conçu autour d'une unité visuelle
   * de 32 px.
   *
   * La valeur viewport-responsive utilisée auparavant
   * (vw / vh / clamp) modifiait cette unité selon la taille
   * de la fenêtre. Cela déformait les rapports entre :
   *
   * - épaisseur des lignes ;
   * - taille / centrage des arrêts ;
   * - fourches ;
   * - espacements ;
   * - pictogrammes ;
   * - noms et correspondances.
   *
   * Le plan retrouve donc ici son unité stable historique.
   *
   * L'interface générale reste, elle, compacte grâce au
   * font-size responsive défini sur <html> plus bas.
   */
  --font-size: 32px !important;
}

/*
 * =========================================================
 * ÉCHELLE GLOBALE DE L'INTERFACE
 * =========================================================
 *
 * Cette règle concerne l'interface CLU :
 * barres, menus, outils, dialogues, panneaux, etc.
 *
 * Elle peut rester responsive sans modifier l'unité interne
 * du plan, puisque le plan utilise --font-size ci-dessus.
 *
 * Grand écran :
 * 16 px.
 *
 * PC portable :
 * environ 13 à 15 px.
 *
 * Téléphone / petit écran :
 * minimum 12 px.
 */

html {
  font-size:
    clamp(
      12px,
      min(0.95vw, 1.9vh),
      16px
    );
}

body {
  font-size: 1rem;
}

html,
body,
#__nuxt {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}

/*
 * Évite qu'un élément trop large agrandisse artificiellement
 * l'ensemble de la page.
 */
html,
body {
  max-width: 100%;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

kbd {
  background-color: var(--p-gray-100);
  border-radius: 0.25em;
  padding: 0.1em 0.25em;
  box-shadow: 0 0 0 1px var(--p-gray-300);
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1;
  color: var(--p-gray-700);
  margin: 0 0.125em;
  border: 1px solid var(--p-gray-300);

  .dark-mode & {
    background-color: var(--p-gray-800);
    box-shadow: 0 0 0 1px var(--p-gray-600);
    color: var(--p-gray-100);
    border: 1px solid var(--p-gray-600);
  }
}

/*
 * =========================================================
 * CBLU — FENÊTRE DE CONFIRMATION
 * =========================================================
 */

.cblu-confirm-dialog-root {
  width: min(31rem, calc(100vw - 2rem)) !important;
  max-width: none !important;

  overflow: hidden;

  border: 1px solid var(--p-content-border-color) !important;
  border-radius: 1rem !important;
}

.cblu-confirm-dialog-root .p-dialog-header {
  padding: 1rem 1rem .65rem;
}

.cblu-confirm-dialog-root .p-dialog-title {
  font-size: .95rem;
  font-weight: 700;
}

.cblu-confirm-dialog-content {
  padding: .55rem 1rem 1rem !important;
}

.cblu-confirm-dialog-icon {
  display: none !important;
}

.cblu-confirm-dialog-message {
  margin: 0 !important;
}

.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: .8rem;

  width: 100%;
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.8rem;
  height: 2.8rem;

  flex-shrink: 0;

  border-radius: .8rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 11%,
      var(--p-content-background)
    );

  color: var(--p-primary-color);

  font-size: 1.25rem;
}

.confirm-text {
  display: flex;
  flex: 1;
  flex-direction: column;

  min-width: 0;
}

.confirm-label {
  margin-bottom: .18rem;

  font-size: .78rem;
  font-weight: 700;
}

.confirm-message {
  margin: 0;

  color: var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.5;
}

.confirm-warning {
  display: flex;
  align-items: flex-start;
  gap: .4rem;

  margin-top: .7rem;
  padding: .55rem .65rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-orange-500) 25%,
      var(--p-content-border-color)
    );

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-orange-500) 6%,
      var(--p-content-background)
    );

  color: var(--p-text-muted-color);

  font-size: .66rem;
  line-height: 1.4;
}

.confirm-warning i {
  margin-top: .05rem;

  flex-shrink: 0;

  color: var(--p-orange-500);

  font-size: .82rem;
}

.cblu-confirm-dialog-footer {
  display: flex !important;
  justify-content: flex-end !important;
  gap: .35rem !important;

  padding: .7rem 1rem 1rem !important;

  border-top:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    ) !important;
}

/*
 * =========================================================
 * PC PORTABLE / PETITS ÉCRANS
 * =========================================================
 *
 * L'échelle du PLAN n'est plus modifiée ici.
 * L'interface continue de s'adapter via html { font-size }.
 */

@media (max-height: 800px) {
  /* Réservé aux adaptations d'interface si nécessaire. */
}

/*
 * =========================================================
 * TABLETTES
 * =========================================================
 */

@media (max-width: 900px) {
  /* Le plan conserve toujours son unité stable de 32 px. */
}

/*
 * =========================================================
 * TÉLÉPHONES
 * =========================================================
 */

@media (max-width: 640px) {
  .cblu-confirm-dialog-root {
    width: calc(100vw - 1rem) !important;
  }

  .confirm-content {
    gap: .6rem;
  }

  .confirm-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
