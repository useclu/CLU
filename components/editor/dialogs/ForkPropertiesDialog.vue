<script setup lang="ts">
const visible = defineModel<boolean>('visible', { required: true })
const fork = defineModel<Fork>({ required: true })

const orientations = [
  { label: 'ui.dialogs.fork_properties.orientation.left', value: 'LEFT' },
  { label: 'ui.dialogs.fork_properties.orientation.right', value: 'RIGHT' },
]

const shapes = [
  { label: 'ui.dialogs.fork_properties.shape.upward', value: [1, 0] },
  { label: 'ui.dialogs.fork_properties.shape.symmetrical', value: [1, -1] },
  { label: 'ui.dialogs.fork_properties.shape.downward', value: [0, -1] },
]

const arrows = [
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.none',
    value: undefined,
  },
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.clockwise',
    value: 'CW',
  },
  {
    label: 'ui.dialogs.fork_properties.directional_arrows.counterclockwise',
    value: 'CCW',
  },
]

const forkStyles = [
  {
    label: 'Originale',
    value: 'ORIGINAL',
  },
  {
    label: 'Arrondie',
    value: 'ROUNDED',
  },
]
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    :style="{ width: 'min(650px, 94vw)' }"
    :pt="{
      root: { class: 'fork-dialog' },
      header: { class: 'fork-dialog-header' },
      content: { class: 'fork-dialog-content' },
      footer: { class: 'fork-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-git-fork" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title-row">
            <span
              class="dialog-title"
              data-pc-section="title"
            >
              {{ $t('ui.dialogs.fork_properties.header') }}
            </span>

            <Tag
              severity="warn"
              class="wip-tag"
            >
              <i class="i-tabler-traffic-cone" />
              WIP
            </Tag>
          </div>

          <div class="dialog-subtitle">
            Configurez la forme et le comportement de la bifurcation.
          </div>
        </div>
      </div>
    </template>

    <div class="fork-properties">
      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-left-right" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.orientation.title') }}
              </div>

              <div class="property-card-description">
                Choisissez le côté vers lequel la fourche se développe.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.toward"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="orientations"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-route-alt-left" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.shape.title') }}
              </div>

              <div class="property-card-description">
                Déterminez la disposition verticale des deux branches.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.linksOffset"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="shapes"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-vector-bezier-2" />
            </div>

            <div>
              <div class="property-card-title">
                Style de bifurcation
              </div>

              <div class="property-card-description">
                Choisissez l'apparence de la jonction entre les branches.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.forkStyle"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="forkStyles"
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
              <i class="i-tabler-arrows-exchange" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.directional_arrows.title') }}
              </div>

              <div class="property-card-description">
                Ajoutez une indication de sens de circulation sur la fourche.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="fork.$fork.directionalArrows"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="arrows"
            :option-label="option => $t(option.label)"
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-diagonal" />
            </div>

            <div>
              <div class="property-card-title">
                {{ $t('ui.dialogs.fork_properties.size_multiplier') }}
              </div>

              <div class="property-card-description">
                Ajustez l'écartement général de la bifurcation.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="number-field">
            <BInputNumber
              v-model="fork.$fork.offsetMultiplier"
            />

            <div class="number-hint">
              <i class="i-tabler-info-circle" />

              <span>
                Une valeur plus élevée augmente l'écartement des branches.
              </span>
            </div>
          </div>
        </div>
      </section>
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

    <pre v-if="false">
      {{ fork }}
    </pre>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.fork-dialog) {
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

:deep(.fork-dialog-header) {
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

:deep(.fork-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.fork-dialog-footer) {
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

  flex: 1;
}

.dialog-title-row {
  display: flex;

  align-items: center;

  flex-wrap: wrap;

  gap: .55rem;
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

.wip-tag {
  font-size: .65rem;
}

.fork-properties {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  padding: 1rem;
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

.property-select {
  width: 100%;
}

:deep(.property-select .p-togglebutton) {
  flex: 1 1 0;
}

.number-field {
  display: flex;

  flex-direction: column;

  gap: .65rem;
}

.number-hint {
  display: flex;

  align-items: center;

  gap: .4rem;

  font-size: .72rem;

  color:
    var(--p-text-muted-color);
}

.number-hint i {
  flex-shrink: 0;

  font-size: .9rem;
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
}

.footer-hint i {
  font-size: .9rem;
}

@media (max-width: 620px) {
  .dialog-subtitle,
  .property-card-description,
  .footer-hint,
  .number-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }

  :deep(.property-select) {
    display: flex;

    flex-direction: column;
  }
}
</style>S