<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', {
  required: true,
})

const segment = defineModel<VerticalSegment>({
  required: true,
})

/*
 * Migration temporaire des VerticalSegment
 * créés avec l'ancien système "direction".
 *
 * Une fois levelChange défini, tout le reste
 * du composant utilise uniquement cette propriété.
 */
if (
  segment.value.$verticalSegment.levelChange === undefined
) {
  switch (segment.value.$verticalSegment.direction) {
    case 'UP':
      segment.value.$verticalSegment.levelChange = -1
      break

    case 'DOWN':
      segment.value.$verticalSegment.levelChange = 1
      break

    case 'BOTH':
    default:
      segment.value.$verticalSegment.levelChange = 1
      break
  }
}

/*
 * Les anciens segments n'ont pas encore de côté.
 *
 * RIGHT est utilisé comme valeur par défaut
 * afin de conserver un comportement prévisible.
 */
if (
  segment.value.$verticalSegment.side === undefined
) {
  segment.value.$verticalSegment.side = 'RIGHT'
}

const levelChanges = [
  {
    label: 'Monte',
    value: -1,
  },
  {
    label: 'Descend',
    value: 1,
  },
]

const sides = [
  {
    label: 'Gauche',
    value: 'LEFT',
  },
  {
    label: 'Droite',
    value: 'RIGHT',
  },
]

const levelChange = computed<number>({
  get: () =>
    segment.value.$verticalSegment.levelChange ?? 1,

  set: (value) => {
    segment.value.$verticalSegment.levelChange = value
  },
})

const side = computed<VerticalSegmentSide>({
  get: () =>
    segment.value.$verticalSegment.side ?? 'RIGHT',

  set: (value) => {
    segment.value.$verticalSegment.side = value
  },
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    :style="{ width: 'min(650px, 94vw)' }"
    :pt="{
      root: { class: 'vertical-segment-dialog' },
      header: { class: 'vertical-segment-dialog-header' },
      content: { class: 'vertical-segment-dialog-content' },
      footer: { class: 'vertical-segment-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-arrows-vertical" />
        </div>

        <div class="dialog-heading-text">
          <div
            class="dialog-title"
            data-pc-section="title"
          >
            Segment vertical
          </div>

          <div class="dialog-subtitle">
            Configurez la direction et le côté du segment.
          </div>
        </div>
      </div>
    </template>

    <div class="vertical-segment-properties">
      <div class="properties-grid">
        <section class="property-card">
          <div class="property-card-header">
            <div class="property-card-heading">
              <div class="property-card-icon">
                <i class="i-tabler-arrows-up-down" />
              </div>

              <div>
                <div class="property-card-title">
                  Direction verticale
                </div>

                <div class="property-card-description">
                  Choisissez si le segment monte ou descend.
                </div>
              </div>
            </div>
          </div>

          <div class="property-card-body">
            <SelectButton
              v-model="levelChange"
              class="property-select"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="levelChanges"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </div>
        </section>

        <section class="property-card">
          <div class="property-card-header">
            <div class="property-card-heading">
              <div class="property-card-icon">
                <i class="i-tabler-layout-sidebar" />
              </div>

              <div>
                <div class="property-card-title">
                  Côté du segment
                </div>

                <div class="property-card-description">
                  Définissez le côté de la branche secondaire.
                </div>
              </div>
            </div>
          </div>

          <div class="property-card-body">
            <SelectButton
              v-model="side"
              class="property-select"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="sides"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </div>
        </section>
      </div>

      <div class="information-notice">
        <div class="information-notice-icon">
          <i class="i-tabler-info-circle" />
        </div>

        <div>
          <div class="information-notice-title">
            Segment vertical
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
          <i class="i-tabler-arrows-vertical" />

          <span>
            Configuration du segment vertical
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
:deep(.vertical-segment-dialog) {
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

:deep(.vertical-segment-dialog-header) {
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

:deep(.vertical-segment-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.vertical-segment-dialog-footer) {
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

.vertical-segment-properties {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  padding: 1rem;
}

.properties-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: .9rem;
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

  line-height: 1.4;

  color:
    var(--p-text-muted-color);
}

.property-card-body {
  padding: .9rem;
}

.property-select {
  width: 100%;
}

:deep(.property-select .p-togglebutton) {
  flex: 1 1 0;
}

.information-notice {
  display: flex;

  align-items: flex-start;

  gap: .65rem;

  padding: .75rem .8rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-primary-500) 18%,
      transparent
    );

  border-radius: 13px;

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
  font-size: .78rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.information-notice-text {
  margin-top: .08rem;

  font-size: .7rem;

  line-height: 1.4;

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

  font-size: .72rem;

  color:
    var(--p-text-muted-color);
}

.footer-hint i {
  font-size: .9rem;
}

@media (max-width: 620px) {
  .properties-grid {
    grid-template-columns: 1fr;
  }

  .dialog-subtitle,
  .property-card-description,
  .information-notice,
  .footer-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }
}
</style>