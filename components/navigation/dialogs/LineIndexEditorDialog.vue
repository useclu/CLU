<script setup lang="ts">
import { watch } from 'vue'
import { modeToShape } from '~/data/modes'

const emit = defineEmits<{
  delete: [id: string]
}>()

const index = defineModel<CustomLineIndexDescription>({
  required: true,
})

const visible = defineModel<boolean>('visible')

function filterShape(shape: ShapeChoice) {
  if (index.value.mode === 'BUS') {
    return shape.value !== 'RECTANGLE'
  } else if (index.value.mode === 'NOCTILIEN') {
    return shape.value !== 'CUT_RECTANGLE'
  } else {
    return (
      shape.value === 'RECTANGLE'
      || shape.value === 'CUT_RECTANGLE'
    )
  }
}

watch(
  () => index.value.mode,
  (mode) => {
    index.value.shape = modeToShape(mode)
  },
)

function closeEditor() {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="custom-index-editor-dialog"
    :pt="{
      root: {
        class: 'custom-index-editor-dialog-root',
      },
      content: {
        class: 'custom-index-editor-dialog-content',
      },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-heading-icon">
          <i class="i-tabler-badge" />
        </div>

        <div class="dialog-heading-content">
          <div class="dialog-title-row">
            <span class="p-dialog-title">
              {{ $t('ui.dialogs.custom_index_editor.header') }}
            </span>

            <Beta />
          </div>

          <span class="dialog-heading-description">
            Crée et personnalise l’indice de ta ligne
          </span>
        </div>
      </div>
    </template>

    <div class="editor-layout">
      <!-- =====================================================
           RÉGLAGES
           ===================================================== -->
      <div class="settings-column">
        <section class="editor-section">
          <div class="section-header">
            <div class="section-icon">
              <i class="i-tabler-route" />
            </div>

            <div>
              <div class="section-title">
                Identité
              </div>

              <div class="section-description">
                Mode de transport et forme
              </div>
            </div>
          </div>

          <div class="section-content two-columns">
            <div class="setting-field">
              <label class="setting-label">
                {{ $t('ui.dialogs.custom_index_editor.mode') }}
              </label>

              <ModeSelect
                v-model="index.mode"
                class="w-full"
              />
            </div>

            <div class="setting-field">
              <label class="setting-label">
                {{ $t('ui.dialogs.custom_index_editor.shape') }}
              </label>

              <ShapeSelect
                v-model="index.shape"
                :filter="filterShape"
                class="w-full"
              />
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-header">
            <div class="section-icon">
              <i class="i-tabler-letter-case" />
            </div>

            <div>
              <div class="section-title">
                Texte de l’indice
              </div>

              <div class="section-description">
                Préfixe, valeur principale et suffixe
              </div>
            </div>
          </div>

          <div class="section-content">
            <div class="setting-field">
              <label
                for="index_editor_index"
                class="setting-label"
              >
                {{ $t('ui.dialogs.custom_index_editor.index') }}
              </label>

              <InputGroup>
                <InputText
                  id="index_editor_prefix"
                  v-model="index.prefix"
                  :disabled="index.shape !== 'LINES'"
                  :placeholder="$t('ui.dialogs.custom_index_editor.prefix')"
                />

                <InputText
                  id="index_editor_index"
                  v-model="index.index"
                  :placeholder="$t('ui.dialogs.custom_index_editor.value')"
                />

                <InputText
                  id="index_editor_suffix"
                  v-model="index.suffix"
                  :placeholder="$t('ui.dialogs.custom_index_editor.suffix')"
                />
              </InputGroup>
            </div>
          </div>
        </section>

        <section class="editor-section">
          <div class="section-header">
            <div class="section-icon">
              <i class="i-tabler-palette" />
            </div>

            <div>
              <div class="section-title">
                Couleur
              </div>

              <div class="section-description">
                Couleur principale de l’indice
              </div>
            </div>
          </div>

          <div class="section-content">
            <div class="color-row">
              <div class="color-select">
                <ColorSelect v-model="index.color" />
              </div>

              <div class="color-picker">
                <BColorPicker v-model="index.color" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- =====================================================
           APERÇU
           ===================================================== -->
      <aside class="preview-column">
        <div class="preview-card">
          <div class="preview-header">
            <div class="preview-header-icon">
              <i class="i-tabler-eye" />
            </div>

            <div>
              <div class="preview-title">
                Prévisualisation
              </div>

              <div class="preview-description">
                Mise à jour en direct
              </div>
            </div>
          </div>

          <div class="preview-stage">
            <div
              class="preview"
              :class="{
                half:
                  index.shape === 'RECTANGLE'
                  || index.shape === 'CUT_RECTANGLE',
              }"
            >
              <CustomLineIndex
                :shape="index.shape"
                :index="index.index"
                :prefix="index.prefix"
                :suffix="index.suffix"
                :color="index.color"
                text-color="auto"
              />
            </div>
          </div>

          <div class="preview-details">
            <div class="detail-row">
              <span class="detail-label">
                Mode
              </span>

              <span class="detail-value">
                <Mode :mode="index.mode" />
              </span>
            </div>

            <div class="detail-row">
              <span class="detail-label">
                Indice
              </span>

              <strong class="detail-value">
                {{ index.index || '—' }}
              </strong>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          :label="$t('ui.dialogs.custom_index_editor.delete')"
          icon="i-tabler-trash"
          severity="danger"
          text
          @click="emit('delete', index.id)"
        />

        <Button
          label="Fermer"
          icon="i-tabler-check"
          @click="closeEditor"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.custom-index-editor-dialog-root) {
  width: min(56rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);

  display: flex;
  flex-direction: column;
}

:deep(.custom-index-editor-dialog-content) {
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
  gap: .75rem;

  min-width: 0;
}

.dialog-heading-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.4rem;
  height: 2.4rem;

  flex-shrink: 0;

  border-radius: .75rem;

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
  min-width: 0;
}

.dialog-title-row {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.dialog-heading-description {
  display: block;

  margin-top: .08rem;

  color: var(--p-text-muted-color);

  font-size: .7rem;
}

/*
 * =========================================================
 * STRUCTURE
 * =========================================================
 */

.editor-layout {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    17rem;
  gap: .9rem;

  align-items: start;
}

.settings-column {
  display: flex;
  flex-direction: column;
  gap: .75rem;

  min-width: 0;
}

/*
 * =========================================================
 * CARTES
 * =========================================================
 */

.editor-section,
.preview-card {
  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .9rem;

  background:
    var(--p-content-background);
}

.section-header,
.preview-header {
  display: flex;
  align-items: center;
  gap: .6rem;

  padding: .65rem .75rem;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 45%,
      transparent
    );
}

.section-icon,
.preview-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.9rem;
  height: 1.9rem;

  flex-shrink: 0;

  border-radius: .55rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .95rem;
}

.section-title,
.preview-title {
  font-size: .82rem;
  font-weight: 700;
}

.section-description,
.preview-description {
  margin-top: .03rem;

  color:
    var(--p-text-muted-color);

  font-size: .64rem;
}

/*
 * =========================================================
 * CHAMPS
 * =========================================================
 */

.section-content {
  display: flex;
  flex-direction: column;
  gap: .75rem;

  padding: .75rem;
}

.section-content.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.setting-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;

  min-width: 0;
}

.setting-label {
  font-size: .76rem;
  font-weight: 600;
}

.setting-field :deep(.p-select),
.setting-field :deep(.p-inputtext),
.setting-field :deep(.p-inputgroup),
.color-select :deep(.p-select),
.color-select :deep(.p-inputtext) {
  width: 100%;
}

/*
 * =========================================================
 * COULEUR
 * =========================================================
 */

.color-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: .65rem;
}

.color-picker {
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * =========================================================
 * PRÉVISUALISATION
 * =========================================================
 */

.preview-column {
  position: sticky;
  top: 0;
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;

  min-height: 15rem;

  padding: 1.5rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 25%,
      transparent
    );
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;

  width: calc(1em + 1.5rem);
  height: calc(1em + 1.5rem);

  padding: .75rem;

  overflow: hidden;

  border-radius: 1rem;

  background: white;

  font-size: 8rem;
}

.preview.half > div {
  font-size: .5em;
}

.preview-details {
  padding: .35rem .75rem .5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  min-height: 2.2rem;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 60%,
      transparent
    );
}

.detail-row:last-child {
  border-bottom: 0;
}

.detail-label {
  color:
    var(--p-text-muted-color);

  font-size: .66rem;
}

.detail-value {
  display: flex;
  align-items: center;

  font-size: .75rem;
}

/*
 * =========================================================
 * PIED
 * =========================================================
 */

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  width: 100%;
}

/*
 * =========================================================
 * MOBILE
 * =========================================================
 */

@media (max-width: 700px) {
  :deep(.custom-index-editor-dialog-root) {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .editor-layout {
    display: flex;
    flex-direction: column-reverse;
  }

  .settings-column,
  .preview-column {
    width: 100%;
  }

  .preview-column {
    position: static;
  }

  .section-content.two-columns {
    grid-template-columns: 1fr;
  }

  .preview-stage {
    min-height: 10rem;
  }

  .preview {
    font-size: 6rem;
  }

  .dialog-heading-description {
    display: none;
  }
}
</style>