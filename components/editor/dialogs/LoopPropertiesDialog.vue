<script setup lang="ts">
const visible = defineModel<boolean>('visible', {
  required: true,
})

const loop = defineModel<Loop>({
  required: true,
})

const orientations = [
  {
    label: 'ui.dialogs.loop_properties.orientation.left',
    value: 'LEFT',
  },
  {
    label: 'ui.dialogs.loop_properties.orientation.right',
    value: 'RIGHT',
  },
]
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    :style="{ width: 'min(620px, 94vw)' }"
    :pt="{
      root: { class: 'loop-dialog' },
      header: { class: 'loop-dialog-header' },
      content: { class: 'loop-dialog-content' },
      footer: { class: 'loop-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-arrow-back-up" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title-row">
            <div
              class="dialog-title"
              data-pc-section="title"
            >
              {{
                $t(
                  'ui.dialogs.loop_properties.header',
                )
              }}
            </div>

            <Tag
              severity="warn"
              class="wip-tag"
            >
              <i class="i-tabler-traffic-cone" />
              WIP
            </Tag>
          </div>

          <div class="dialog-subtitle">
            Configurez l'orientation et les niveaux du demi-tour.
          </div>
        </div>
      </div>
    </template>

    <div class="loop-properties">
      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-switch-horizontal" />
            </div>

            <div>
              <div class="property-card-title">
                {{
                  $t(
                    'ui.dialogs.loop_properties.orientation.title',
                  )
                }}
              </div>

              <div class="property-card-description">
                Choisissez le côté vers lequel s'effectue le demi-tour.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <SelectButton
            v-model="loop.$loop.toward"
            class="property-select"
            pt:pc-toggle-button:root:class="flex-grow"
            :options="orientations"
            :option-label="
              option => $t(option.label)
            "
            option-value="value"
            :allow-empty="false"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-layers-subtract" />
            </div>

            <div>
              <div class="property-card-title">
                Niveaux du demi-tour
              </div>

              <div class="property-card-description">
                Ajustez indépendamment le niveau de chaque liaison.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <div class="levels-grid">
            <div class="level-field">
              <div class="level-field-heading">
                <div class="level-number">
                  1
                </div>

                <label class="level-label">
                  {{
                    $t(
                      'ui.dialogs.parallel_branches_properties.section_1_level',
                    )
                  }}
                </label>
              </div>

              <BInputNumber
                v-model="
                  loop
                    .$loop
                    .linksOffsets[0]
                "
              />
            </div>

            <div class="level-field">
              <div class="level-field-heading">
                <div class="level-number">
                  2
                </div>

                <label class="level-label">
                  {{
                    $t(
                      'ui.dialogs.parallel_branches_properties.section_2_level',
                    )
                  }}
                </label>
              </div>

              <BInputNumber
                v-model="
                  loop
                    .$loop
                    .linksOffsets[1]
                "
              />
            </div>
          </div>
        </div>
      </section>

      <div class="information-notice">
        <div class="information-notice-icon">
          <i class="i-tabler-info-circle" />
        </div>

        <div>
          <div class="information-notice-title">
            Demi-tour
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
          <i class="i-tabler-arrow-back-up" />

          <span>
            Configuration du demi-tour
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
      {{ loop }}
    </pre>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.loop-dialog) {
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

:deep(.loop-dialog-header) {
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

:deep(.loop-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.loop-dialog-footer) {
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

  min-width: 0;
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

  gap: .55rem;

  flex-wrap: wrap;
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
  display: inline-flex;

  align-items: center;

  gap: .25rem;

  font-size: .65rem;
}

.loop-properties {
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

.levels-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: .8rem;
}

.level-field {
  display: flex;

  flex-direction: column;

  gap: .55rem;

  padding: .75rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  border-radius: 13px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 3%,
      transparent
    );
}

.level-field-heading {
  display: flex;

  align-items: center;

  gap: .5rem;
}

.level-number {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 1.65rem;
  height: 1.65rem;

  flex: 0 0 1.65rem;

  border-radius: 8px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 11%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: .7rem;
  font-weight: 700;
}

.level-label {
  font-size: .78rem;
  font-weight: 600;

  color:
    var(--p-text-color);
}

.level-field :deep(.p-inputnumber) {
  width: 100%;
}

.level-field :deep(.p-inputtext) {
  width: 100%;
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
  .levels-grid {
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