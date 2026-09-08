<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', {
  required: true,
})

const annotation = defineModel<Annotation>({
  required: true,
})

const color = computed({
  get: () =>
    annotation.value.$annotation.color
    ?? '#000000',

  set: (value: string) => {
    annotation.value.$annotation.color = value
  },
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    class="annotation-properties-dialog"
    :style="{ width: 'min(620px, 94vw)' }"
    :pt="{
      root: { class: 'annotation-dialog' },
      header: { class: 'annotation-dialog-header' },
      content: { class: 'annotation-dialog-content' },
      footer: { class: 'annotation-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-text-caption" />
        </div>

        <div class="dialog-heading-text">
          <div
            class="dialog-title"
            data-pc-section="title"
          >
            Propriétés de l'annotation
          </div>

          <div class="dialog-subtitle">
            Personnalisez le texte affiché directement sur le plan.
          </div>
        </div>
      </div>
    </template>

    <div class="annotation-properties">
      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-align-left" />
            </div>

            <div>
              <div class="property-card-title">
                Texte
              </div>

              <div class="property-card-description">
                Modifiez le contenu de l'annotation.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <Textarea
            v-model="annotation.$annotation.text"
            rows="3"
            auto-resize
            class="annotation-textarea"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-typography" />
            </div>

            <div>
              <div class="property-card-title">
                Style du texte
              </div>

              <div class="property-card-description">
                Activez les styles typographiques souhaités.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="style-options">
            <label class="style-option">
              <Checkbox
                v-model="annotation.$annotation.bold"
                binary
                input-id="annotation-bold"
              />

              <span class="style-option-content">
                <i class="i-tabler-bold" />

                <span>
                  Gras
                </span>
              </span>
            </label>

            <label class="style-option">
              <Checkbox
                v-model="annotation.$annotation.italic"
                binary
                input-id="annotation-italic"
              />

              <span class="style-option-content">
                <i class="i-tabler-italic" />

                <span>
                  Italique
                </span>
              </span>
            </label>

            <label class="style-option">
              <Checkbox
                v-model="annotation.$annotation.underline"
                binary
                input-id="annotation-underline"
              />

              <span class="style-option-content">
                <i class="i-tabler-underline" />

                <span>
                  Souligné
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <div class="properties-grid">
        <section class="property-card">
          <div class="property-card-header">
            <div class="property-card-heading">
              <div class="property-card-icon">
                <i class="i-tabler-palette" />
              </div>

              <div>
                <div class="property-card-title">
                  Couleur
                </div>

                <div class="property-card-description">
                  Choisissez la couleur du texte.
                </div>
              </div>
            </div>
          </div>

          <div class="property-card-body">
            <div class="color-field">
              <div class="color-picker-wrapper">
                <ColorPicker
                  v-model="color"
                  format="hex"
                />
              </div>

              <InputText
                v-model="color"
                class="color-input"
              />
            </div>
          </div>
        </section>

        <section class="property-card">
          <div class="property-card-header">
            <div class="property-card-heading">
              <div class="property-card-icon">
                <i class="i-tabler-text-size" />
              </div>

              <div>
                <div class="property-card-title">
                  Taille du texte
                </div>

                <div class="property-card-description">
                  Ajustez la taille de l'annotation.
                </div>
              </div>
            </div>
          </div>

          <div class="property-card-body">
            <BInputNumber
              v-model="annotation.$annotation.fontSize"
              :min=".25"
              :max="5"
              :step=".1"
            />
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <i class="i-tabler-info-circle" />

          <span>
            Les modifications sont appliquées immédiatement sur le plan.
          </span>
        </div>

        <Button
          label="Fermer"
          severity="secondary"
          icon="i-tabler-x"
          @click="visible = false"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.annotation-dialog) {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: 22px;

  overflow: hidden;

  box-shadow:
    0 24px 70px rgb(0 0 0 / 18%),
    0 4px 16px rgb(0 0 0 / 8%);
}

:deep(.annotation-dialog-header) {
  padding: 1.05rem 1.2rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--p-primary-500) 12%,
        var(--p-dialog-background)
      ),
      var(--p-dialog-background)
    );
}

:deep(.annotation-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.annotation-dialog-footer) {
  padding: .85rem 1rem;

  border-top:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    var(--p-dialog-background);
}

.dialog-heading {
  display: flex;

  align-items: center;

  gap: .85rem;
}

.dialog-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2.7rem;
  height: 2.7rem;

  flex: 0 0 2.7rem;

  border-radius: 14px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 14%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1.3rem;
}

.dialog-heading-text {
  min-width: 0;
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;

  line-height: 1.2;

  color:
    var(--p-text-color);
}

.dialog-subtitle {
  margin-top: .18rem;

  font-size: .78rem;

  color:
    var(--p-text-muted-color);
}

.annotation-properties {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  padding: 1rem;

  font-size: 1rem;
  font-weight: normal;
}

.property-card {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 20%,
      transparent
    );

  border-radius: 16px;

  overflow: hidden;

  background:
    color-mix(
      in srgb,
      var(--p-surface-0) 3%,
      var(--p-dialog-background)
    );
}

.property-card-header {
  padding: .75rem .85rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 5%,
      transparent
    );
}

.property-card-heading {
  display: flex;

  align-items: center;

  gap: .65rem;
}

.property-card-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex: 0 0 2rem;

  border-radius: 10px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1rem;
}

.property-card-title {
  font-size: .88rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.property-card-description {
  margin-top: .05rem;

  font-size: .7rem;

  color:
    var(--p-text-muted-color);
}

.property-card-body {
  padding: .9rem;
}

.annotation-textarea {
  width: 100%;
}

.style-options {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: .55rem;
}

.style-option {
  display: flex;

  align-items: center;

  gap: .55rem;

  min-height: 3rem;

  padding: .65rem .7rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  border-radius: 12px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 4%,
      transparent
    );

  cursor: pointer;

  transition:
    background .15s ease,
    border-color .15s ease;
}

.style-option:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 30%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 6%,
      transparent
    );
}

.style-option-content {
  display: flex;

  align-items: center;

  gap: .4rem;

  font-size: .82rem;
  font-weight: 600;

  color:
    var(--p-text-color);

  i {
    font-size: 1rem;
  }
}

.properties-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: .9rem;
}

.color-field {
  display: flex;

  flex-direction: row;

  align-items: center;

  gap: .65rem;
}

.color-picker-wrapper {
  display: flex;

  align-items: center;
  justify-content: center;

  min-width: 2.7rem;
}

.color-input {
  width: 100%;

  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    "Liberation Mono",
    "Courier New",
    monospace;
}

.dialog-footer {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 1rem;

  width: 100%;
}

.footer-hint {
  display: flex;

  align-items: center;

  gap: .45rem;

  font-size: .72rem;

  color:
    var(--p-text-muted-color);

  i {
    font-size: .9rem;
  }
}

:deep(textarea),
:deep(input) {
  font-size: .9rem;
  font-weight: normal;
}

@media (max-width: 620px) {
  .properties-grid {
    grid-template-columns: 1fr;
  }

  .style-options {
    grid-template-columns: 1fr;
  }

  .dialog-subtitle,
  .property-card-description,
  .footer-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }
}
</style>