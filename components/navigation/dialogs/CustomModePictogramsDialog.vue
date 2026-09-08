<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useProject } from '~/stores/useProject'

const visible = defineModel<boolean>('visible')

const { line } = storeToRefs(useProject())

const modes: {
  value: CustomizableModePictogramMode
  label: string
}[] = [
  { value: 'RER', label: 'RER' },
  { value: 'TRAIN', label: 'Transilien' },
  { value: 'TRAM', label: 'Tramway' },
  { value: 'METRO', label: 'Métro' },
  { value: 'CABLE', label: 'Téléphérique' },
  { value: 'BUS', label: 'Bus' },
  { value: 'BRT', label: 'Busilien (BHNS)' },
  { value: 'NOCTILIEN', label: 'Noctilien' },
  { value: 'BOAT', label: 'Navette fluviale' },
  { value: 'VELO', label: 'Vélo' },
]

const customPictogramCount = computed(() =>
  modes.filter(mode => hasCustomPictogram(mode.value)).length,
)

const hasAnyCustomPictogram = computed(() =>
  customPictogramCount.value > 0,
)

function hasCustomPictogram(mode: CustomizableModePictogramMode) {
  return Boolean(
    line.value.customModePictograms?.[mode]?.image,
  )
}

function selectPictogram(mode: CustomizableModePictogramMode) {
  const input = document.createElement('input')

  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'

  input.onchange = () => {
    const file = input.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return
      }

      if (!line.value.customModePictograms) {
        line.value.customModePictograms = {}
      }

      line.value.customModePictograms[mode] = {
        image: reader.result,
      }
    }

    reader.readAsDataURL(file)
  }

  input.click()
}

function restorePictogram(mode: CustomizableModePictogramMode) {
  if (!line.value.customModePictograms) {
    return
  }

  delete line.value.customModePictograms[mode]
}

function restoreAllPictograms() {
  line.value.customModePictograms = {}
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="mode-pictograms-dialog"
    :pt="{
      root: {
        class: 'mode-pictograms-dialog-root',
      },
      content: {
        class: 'mode-pictograms-dialog-content',
      },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-heading-icon">
          <i class="i-tabler-photo-edit" />
        </div>

        <div class="dialog-heading-content">
          <span
            class="p-dialog-title"
            data-pc-section="title"
          >
            Pictogrammes des modes
          </span>

          <span class="dialog-heading-description">
            Personnalise l’identité visuelle des modes de transport
          </span>
        </div>
      </div>
    </template>

    <div class="dialog-body">
      <div class="info-row">
        <i class="i-tabler-info-circle" />

        <span>
          Remplace les pictogrammes par tes propres images.
          Les modifications sont appliquées directement au plan.
        </span>
      </div>

      <div class="pictograms-list">
        <section
          v-for="mode in modes"
          :key="mode.value"
          class="pictogram-card"
        >
          <div class="mode-information">
            <div class="pictogram-box">
              <Mode
                class="pictogram-preview"
                :mode="mode.value"
              />
            </div>

            <div class="mode-details">
              <span class="mode-name">
                {{ mode.label }}
              </span>

              <div
                class="mode-status"
                :class="{ custom: hasCustomPictogram(mode.value) }"
              >
                <span class="status-dot" />

                <span>
                  {{
                    hasCustomPictogram(mode.value)
                      ? 'Pictogramme personnalisé'
                      : 'Pictogramme par défaut'
                  }}
                </span>
              </div>
            </div>
          </div>

          <div class="mode-actions">
            <Button
              :label="
                hasCustomPictogram(mode.value)
                  ? 'Changer'
                  : 'Modifier'
              "
              :icon="
                hasCustomPictogram(mode.value)
                  ? 'i-tabler-refresh'
                  : 'i-tabler-upload'
              "
              severity="secondary"
              size="small"
              @click="selectPictogram(mode.value)"
            />

            <Button
              v-if="hasCustomPictogram(mode.value)"
              label="Rétablir"
              icon="i-tabler-restore"
              severity="secondary"
              size="small"
              text
              @click="restorePictogram(mode.value)"
            />
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <Button
            v-if="hasAnyCustomPictogram"
            label="Tout rétablir"
            icon="i-tabler-restore"
            severity="secondary"
            text
            @click="restoreAllPictograms"
          />

          <div
            v-else
            class="footer-status"
          >
            <i class="i-tabler-circle-check" />

            <span>
              Pictogrammes par défaut
            </span>
          </div>
        </div>

        <Button
          label="Fermer"
          @click="visible = false"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
/*
 * =========================================================
 * DIALOG
 * =========================================================
 */

:deep(.mode-pictograms-dialog-root) {
  width: min(48rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);

  display: flex;
  flex-direction: column;
}

:deep(.mode-pictograms-dialog-content) {
  min-height: 0;

  overflow-y: auto;
}

/*
 * =========================================================
 * EN-TÊTE
 * =========================================================
 */

.dialog-heading {
  display: flex;
  align-items: center;
  gap: .7rem;

  min-width: 0;
}

.dialog-heading-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.35rem;
  height: 2.35rem;

  flex-shrink: 0;

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 12%,
      var(--p-content-background)
    );

  color: var(--p-primary-color);

  font-size: 1.1rem;
}

.dialog-heading-content {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.dialog-heading-description {
  margin-top: .08rem;

  color: var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 400;
}

/*
 * =========================================================
 * CONTENU
 * =========================================================
 */

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: .45rem;

  padding: .55rem .65rem;

  border: 1px solid var(--p-content-border-color);
  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 30%,
      transparent
    );

  color: var(--p-text-muted-color);

  font-size: .68rem;
  line-height: 1.4;
}

.info-row i {
  flex-shrink: 0;

  font-size: .9rem;
}

/*
 * =========================================================
 * LISTE DES MODES
 * =========================================================
 */

.pictograms-list {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.pictogram-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  min-height: 4.7rem;

  padding: .55rem .65rem;

  border: 1px solid var(--p-content-border-color);
  border-radius: .85rem;

  background: var(--p-content-background);

  transition:
    border-color .15s ease,
    background-color .15s ease;
}

.pictogram-card:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 25%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 20%,
      var(--p-content-background)
    );
}

/*
 * =========================================================
 * MODE
 * =========================================================
 */

.mode-information {
  display: flex;
  align-items: center;
  gap: .7rem;

  min-width: 0;
}

.pictogram-box {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 3.2rem;
  height: 3.2rem;

  flex-shrink: 0;

  border: 1px solid var(--p-content-border-color);
  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 28%,
      transparent
    );
}

.pictogram-preview {
  font-size: 2.25rem;
}

.mode-details {
  display: flex;
  flex-direction: column;
  gap: .2rem;

  min-width: 0;
}

.mode-name {
  font-size: .78rem;
  font-weight: 700;
}

.mode-status {
  display: flex;
  align-items: center;
  gap: .3rem;

  color: var(--p-text-muted-color);

  font-size: .62rem;
}

.status-dot {
  width: .38rem;
  height: .38rem;

  flex-shrink: 0;

  border-radius: 50%;

  background: var(--p-text-muted-color);

  opacity: .55;
}

.mode-status.custom {
  color: var(--p-primary-color);
}

.mode-status.custom .status-dot {
  background: var(--p-primary-color);

  opacity: 1;
}

/*
 * =========================================================
 * ACTIONS
 * =========================================================
 */

.mode-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .2rem;

  flex-shrink: 0;
}

/*
 * =========================================================
 * FOOTER
 * =========================================================
 */

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  width: 100%;
}

.footer-left {
  display: flex;
  align-items: center;

  min-height: 2.5rem;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: .35rem;

  color: var(--p-text-muted-color);

  font-size: .68rem;
}

.footer-status i {
  color: var(--p-primary-color);

  font-size: .9rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 640px) {
  :deep(.mode-pictograms-dialog-root) {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .dialog-heading-description {
    display: none;
  }

  .pictogram-card {
    align-items: flex-start;
    flex-direction: column;

    gap: .55rem;
  }

  .mode-actions {
    justify-content: flex-end;

    width: 100%;
  }

  .dialog-footer {
    flex-wrap: wrap;
  }
}
</style>