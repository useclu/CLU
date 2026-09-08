<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', { required: true })
const areaSeparator = defineModel<AreaSeparator>({ required: true })

const zoneName = computed({
  get: () => areaSeparator.value.$areaSeparator.zoneName ?? '',
  set: (value: string) => {
    areaSeparator.value.$areaSeparator.zoneName = value.trim() === ''
      ? null
      : value
  },
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(650px, 94vw)' }"
    :pt="{
      root: { class: 'area-separator-dialog' },
      header: { class: 'area-separator-dialog-header' },
      content: { class: 'area-separator-dialog-content' },
      footer: { class: 'area-separator-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-map-2" />
        </div>

        <div class="dialog-heading-text">
          <div
            class="dialog-title"
            data-pc-section="title"
          >
            Propriétés de la séparation ville / zone
          </div>

          <div class="dialog-subtitle">
            Configurez l'affichage de la ville, de la zone et de la séparation.
          </div>
        </div>
      </div>
    </template>

    <div class="area-separator-properties">
      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-icon">
            <i class="i-tabler-building-community" />
          </div>

          <div>
            <div class="property-card-title">
              Ville et zone
            </div>

            <div class="property-card-description">
              Informations affichées au-dessus de la séparation.
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="fields-grid">
            <div class="field">
              <label
                class="field-label"
                :for="`${areaSeparator.id}_cityName`"
              >
                <i class="i-tabler-building" />
                Nom de la ville
              </label>

              <InputText
                :id="`${areaSeparator.id}_cityName`"
                v-model="areaSeparator.$areaSeparator.cityName"
                placeholder="Ex. Esbly"
                fluid
              />
            </div>

            <div class="field">
              <label
                class="field-label"
                :for="`${areaSeparator.id}_zoneName`"
              >
                <i class="i-tabler-map-pin" />
                Zone
              </label>

              <InputText
                :id="`${areaSeparator.id}_zoneName`"
                v-model="zoneName"
                placeholder="Ex. Zone 5"
                fluid
              />

              <small class="field-help">
                Laissez ce champ vide pour ne pas afficher de zone.
              </small>
            </div>
          </div>
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-icon">
            <i class="i-tabler-arrows-left-right" />
          </div>

          <div>
            <div class="property-card-title">
              Espacement
            </div>

            <div class="property-card-description">
              Gérez la place réservée autour de la séparation.
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="setting-row">
            <div class="setting-information">
              <div class="setting-icon">
                <i class="i-tabler-wand" />
              </div>

              <div class="setting-text">
                <label
                  class="setting-title"
                  :for="`${areaSeparator.id}_autoSpacing`"
                >
                  Espacement automatique
                </label>

                <div class="setting-description">
                  Réserve automatiquement de la place autour de la séparation.
                </div>
              </div>
            </div>

            <ToggleSwitch
              :input-id="`${areaSeparator.id}_autoSpacing`"
              v-model="areaSeparator.$areaSeparator.autoSpacing"
            />
          </div>

          <div
            class="setting-row"
            :class="{
              'setting-row-disabled':
                !areaSeparator.$areaSeparator.autoSpacing,
            }"
          >
            <div class="setting-information">
              <div class="setting-icon">
                <i class="i-tabler-arrows-horizontal" />
              </div>

              <div class="setting-text">
                <label
                  class="setting-title"
                  :for="`${areaSeparator.id}_spacing`"
                >
                  Distance avec les éléments voisins
                </label>

                <div class="setting-description">
                  Plus la valeur est grande, plus les arrêts voisins sont éloignés.
                </div>
              </div>
            </div>

            <BInputNumber
              :id="`${areaSeparator.id}_spacing`"
              v-model="areaSeparator.$areaSeparator.spacing"
              :min="0"
              :max="20"
              :step="0.5"
              :disabled="!areaSeparator.$areaSeparator.autoSpacing"
            />
          </div>
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-icon">
            <i class="i-tabler-arrows-vertical" />
          </div>

          <div>
            <div class="property-card-title">
              Hauteur
            </div>

            <div class="property-card-description">
              Ajustez la longueur de la ligne verticale pointillée.
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="setting-row">
            <div class="setting-information">
              <div class="setting-icon">
                <i class="i-tabler-ruler-2" />
              </div>

              <div class="setting-text">
                <label
                  class="setting-title"
                  :for="`${areaSeparator.id}_height`"
                >
                  Hauteur de la séparation
                </label>

                <div class="setting-description">
                  Modifie la longueur de la séparation sur le plan.
                </div>
              </div>
            </div>

            <BInputNumber
              :id="`${areaSeparator.id}_height`"
              v-model="areaSeparator.$areaSeparator.height"
              :min="2"
              :max="30"
              :step="0.5"
            />
          </div>
        </div>
      </section>

      <div class="information-notice">
        <div class="information-notice-icon">
          <i class="i-tabler-info-circle" />
        </div>

        <div>
          <div class="information-notice-title">
            Séparation ville / zone
          </div>

          <div class="information-notice-text">
            Les modifications sont appliquées immédiatement sur le plan.
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <i class="i-tabler-map-2" />

          <span>
            Configuration de la séparation
          </span>
        </div>

        <Button
          label="Fermer"
          severity="secondary"
          icon="i-tabler-x"
          @click.stop="visible = false"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.area-separator-dialog) {
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

:deep(.area-separator-dialog-header) {
  padding: 1rem 1.15rem;

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

:deep(.area-separator-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.area-separator-dialog-footer) {
  padding: .8rem 1rem;

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

  gap: .8rem;

  min-width: 0;
}

.dialog-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.6rem;
  height: 2.6rem;

  flex: 0 0 2.6rem;

  border-radius: 13px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 14%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1.2rem;
}

.dialog-heading-text {
  min-width: 0;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;

  color:
    var(--p-text-color);
}

.dialog-subtitle {
  margin-top: .15rem;

  font-size: .72rem;

  color:
    var(--p-text-muted-color);
}

.area-separator-properties {
  display: flex;
  flex-direction: column;

  gap: .75rem;

  padding: .85rem;
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

  border-radius: 15px;
  overflow: hidden;

  background:
    color-mix(
      in srgb,
      var(--p-surface-0) 3%,
      var(--p-dialog-background)
    );
}

.property-card-header {
  display: flex;
  align-items: center;

  gap: .6rem;

  padding: .6rem .75rem;

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

.property-card-icon,
.setting-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);
}

.property-card-icon {
  width: 1.9rem;
  height: 1.9rem;

  border-radius: 9px;

  font-size: .95rem;
}

.setting-icon {
  width: 1.9rem;
  height: 1.9rem;

  border-radius: 9px;

  font-size: .9rem;
}

.property-card-title {
  font-size: .84rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.property-card-description {
  margin-top: .03rem;

  font-size: .66rem;
  line-height: 1.3;

  color:
    var(--p-text-muted-color);
}

.property-card-body {
  display: flex;
  flex-direction: column;

  gap: .6rem;

  padding: .7rem .75rem;
}

.fields-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: .7rem;
}

.field {
  display: flex;
  flex-direction: column;

  gap: .35rem;
}

.field-label {
  display: flex;
  align-items: center;

  gap: .3rem;

  font-size: .74rem;
  font-weight: 600;

  color:
    var(--p-text-color);
}

.field-label i {
  color:
    var(--p-primary-500);
}

.field-help {
  font-size: .65rem;
  line-height: 1.3;

  color:
    var(--p-text-muted-color);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: .8rem;

  padding: .6rem .65rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  border-radius: 12px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 3%,
      transparent
    );
}

.setting-information {
  display: flex;
  align-items: center;

  gap: .55rem;

  min-width: 0;

  flex: 1;
}

.setting-text {
  min-width: 0;
}

.setting-title {
  display: block;

  font-size: .74rem;
  font-weight: 600;

  color:
    var(--p-text-color);
}

.setting-description {
  margin-top: .05rem;

  font-size: .65rem;
  line-height: 1.3;

  color:
    var(--p-text-muted-color);
}

.setting-row-disabled {
  opacity: .55;
}

.setting-row :deep(.p-inputnumber) {
  width: 8rem;

  flex-shrink: 0;
}

.information-notice {
  display: flex;
  align-items: center;

  gap: .6rem;

  padding: .65rem .75rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-primary-500) 18%,
      transparent
    );

  border-radius: 12px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 5%,
      transparent
    );
}

.information-notice-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.8rem;
  height: 1.8rem;

  flex: 0 0 1.8rem;

  color:
    var(--p-primary-500);

  font-size: 1rem;
}

.information-notice-title {
  font-size: .74rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.information-notice-text {
  margin-top: .04rem;

  font-size: .65rem;

  color:
    var(--p-text-muted-color);
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

  gap: .4rem;

  font-size: .7rem;

  color:
    var(--p-text-muted-color);
}

.footer-hint i {
  color:
    var(--p-primary-500);
}

@media (max-width: 620px) {
  .fields-grid {
    grid-template-columns: 1fr;
  }

  .dialog-subtitle,
  .property-card-description,
  .setting-description,
  .information-notice,
  .footer-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }
}

@media (max-width: 460px) {
  .setting-row {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-row :deep(.p-inputnumber) {
    width: 100%;
  }
}
</style>