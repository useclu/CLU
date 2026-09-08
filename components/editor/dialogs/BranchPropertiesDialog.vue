<script setup lang="ts">
import { computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useProject } from '~/stores/useProject'

const visible = defineModel<boolean>('visible', {
  required: true,
})

const branch = defineModel<Branch>({
  required: true,
})

const project = useProject()

const additionalLines = computed(
  () => branch.value.$branch.additionalLines ?? [],
)

function addLine() {
  if (!branch.value.$branch.additionalLines) {
    branch.value.$branch.additionalLines = []
  }

  branch.value.$branch.additionalLines.push({
    id: uuidv4(),
    mode: project.line.mode ?? 'RER',
    index: null,
    color: project.line.color ?? '#000000',
  })
}

function deleteLine(id: string) {
  const lines =
    branch.value.$branch.additionalLines

  if (!lines) {
    return
  }

  const index =
    lines.findIndex(
      line => line.id === id,
    )

  if (index === -1) {
    return
  }

  lines.splice(index, 1)
}

function updateLineMode(
  line: BranchAdditionalLine,
  mode: Mode | null,
) {
  if (!mode) {
    return
  }

  if (line.mode === mode) {
    return
  }

  line.mode = mode
  line.index = null
  line.color = '#000000'
}

function updateLineColor(
  line: BranchAdditionalLine,
  color: string | null,
) {
  if (!color) {
    return
  }

  line.color = color
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="self"
    modal
    :draggable="false"
    :style="{ width: 'min(650px, 94vw)' }"
    :pt="{
      root: { class: 'branch-dialog' },
      header: { class: 'branch-dialog-header' },
      content: { class: 'branch-dialog-content' },
      footer: { class: 'branch-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-git-branch" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title">
            {{
              $t(
                'ui.dialogs.branch_properties.header',
              )
            }}
          </div>

          <div class="dialog-subtitle">
            Configurez les lignes, l'espacement et l'ordre de la branche.
          </div>
        </div>
      </div>
    </template>

    <div class="branch-properties">
      <section class="property-card lines-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-route" />
            </div>

            <div class="property-card-heading-text">
              <div class="property-card-title">
                Lignes de cette branche
              </div>

              <div class="property-card-description">
                Ajoutez plusieurs lignes sur le même tracé de branche.
              </div>
            </div>

            <div class="lines-count">
              {{
                1
                + additionalLines.length
              }}
              {{
                1 + additionalLines.length > 1
                  ? 'lignes'
                  : 'ligne'
              }}
            </div>
          </div>
        </div>

        <div class="property-card-body lines-body">
          <div class="branch-line main-line">
            <div class="branch-line-top">
              <div class="line-identity">
                <div
                  class="line-color"
                  :style="{
                    backgroundColor:
                      project.line.color
                      ?? '#000000',
                  }"
                />

                <div class="line-pictograms">
                  <Mode
                    v-if="project.line.mode"
                    class="line-mode-pictogram"
                    plain
                    :mode="project.line.mode"
                  />

                  <LineIndex
                    v-if="project.line.mode"
                    class="line-index-pictogram"
                    :mode="project.line.mode"
                    :index="project.line.index"
                  />
                </div>

                <div class="line-description">
                  <div class="line-title">
                    Ligne principale
                  </div>

                  <div class="line-subtitle">
                    Identité générale du plan
                  </div>
                </div>
              </div>

              <Tag
                severity="secondary"
                value="Principale"
                class="main-line-tag"
              />
            </div>

            <div class="main-line-notice">
              <i class="i-tabler-info-circle" />

              <span>
                Cette ligne est définie dans les paramètres généraux du plan.
              </span>
            </div>
          </div>

          <div
            v-for="(line, index) in additionalLines"
            :key="line.id"
            class="branch-line additional-line"
          >
            <div class="branch-line-top">
              <div class="line-identity">
                <div
                  class="line-color"
                  :style="{
                    backgroundColor:
                      line.color
                      || '#000000',
                  }"
                />

                <div class="line-pictograms">
                  <Mode
                    class="line-mode-pictogram"
                    plain
                    :mode="line.mode"
                  />

                  <LineIndex
                    class="line-index-pictogram"
                    :mode="line.mode"
                    :index="line.index"
                  />
                </div>

                <div class="line-description">
                  <div class="line-title">
                    Ligne supplémentaire {{ index + 1 }}
                  </div>

                  <div class="line-subtitle">
                    Fusionnée avec cette branche
                  </div>
                </div>
              </div>

              <Button
                icon="i-tabler-trash"
                severity="danger"
                text
                rounded
                aria-label="Supprimer la ligne"
                @click="deleteLine(line.id)"
              />
            </div>

            <div class="line-editor-grid">
              <div class="line-field">
                <label class="line-field-label">
                  Mode de transport
                </label>

                <ModeSelect
                  :model-value="line.mode"
                  @update:model-value="
                    value =>
                      updateLineMode(
                        line,
                        value,
                      )
                  "
                />
              </div>

              <div class="line-field">
                <label class="line-field-label">
                  Indice
                </label>

                <IndexSelect
                  v-model="line.index"
                  :mode="line.mode"
                  @update-color="
                    color =>
                      updateLineColor(
                        line,
                        color,
                      )
                  "
                />
              </div>
            </div>
          </div>

          <Button
            class="add-line-button"
            label="Ajouter une ligne"
            icon="i-tabler-plus"
            severity="secondary"
            outlined
            @click="addLine()"
          />

          <div class="multi-line-hint">
            <i class="i-tabler-route-alt-left" />

            <span>
              La couleur de chaque ligne est déterminée automatiquement par son indice.
            </span>
          </div>
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-header">
          <div class="property-card-heading">
            <div class="property-card-icon">
              <i class="i-tabler-arrows-horizontal" />
            </div>

            <div>
              <div class="property-card-title">
                {{
                  $t(
                    'ui.dialogs.branch_properties.element_spacing',
                  )
                }}
              </div>

              <div class="property-card-description">
                Ajustez l'espace entre les différents éléments de la branche.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <BInputNumber
            v-model="
              branch
                .$branch
                .elementSpacing
            "
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
                Ordre des éléments
              </div>

              <div class="property-card-description">
                Inversez l'ordre d'affichage des éléments de cette branche.
              </div>
            </div>
          </div>
        </div>

        <div class="property-card-body">
          <label
            class="checkbox-option"
            :for="`${branch.id}_invertedElements`"
          >
            <div class="checkbox-option-content">
              <div class="checkbox-option-icon">
                <i class="i-tabler-switch-2" />
              </div>

              <div class="checkbox-option-text">
                <div class="checkbox-option-title">
                  {{
                    $t(
                      'ui.dialogs.stop_properties.inverted_elements',
                    )
                  }}
                </div>

                <div class="checkbox-option-description">
                  Affiche les éléments de la branche dans l'ordre inverse.
                </div>
              </div>
            </div>

            <Checkbox
              v-model="
                branch
                  .$branch
                  .invertedElements
              "
              binary
              :input-id="`${branch.id}_invertedElements`"
            />
          </label>
        </div>
      </section>

      <div class="information-notice">
        <div class="information-notice-icon">
          <i class="i-tabler-info-circle" />
        </div>

        <div>
          <div class="information-notice-title">
            Branche
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
          <i class="i-tabler-git-branch" />

          <span>
            Configuration de la branche
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
:deep(.branch-dialog) {
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

:deep(.branch-dialog-header) {
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

:deep(.branch-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.branch-dialog-footer) {
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

.branch-properties {
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

  min-width: 0;
}

.property-card-heading-text {
  min-width: 0;

  flex: 1;
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

.property-card-body :deep(.p-inputnumber),
.property-card-body :deep(.p-inputtext) {
  width: 100%;
}

.lines-count {
  flex-shrink: 0;

  margin-left: auto;

  padding:
    .28rem
    .55rem;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: .68rem;
  font-weight: 700;
}

.lines-body {
  display: flex;

  flex-direction: column;

  gap: .75rem;
}

.branch-line {
  padding: .75rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 17%,
      transparent
    );

  border-radius: 14px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 3%,
      transparent
    );
}

.main-line {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-500) 22%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 4%,
      transparent
    );
}

.branch-line-top {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: .75rem;
}

.line-identity {
  display: flex;

  align-items: center;

  gap: .7rem;

  min-width: 0;
}

.line-color {
  width: .38rem;
  height: 2.5rem;

  flex: 0 0 .38rem;

  border-radius: 999px;

  box-shadow:
    inset
    0
    0
    0
    1px
    rgb(0 0 0 / 10%);
}

.line-pictograms {
  display: flex;

  align-items: center;
  justify-content: center;

  gap: .35rem;

  min-width: 3.3rem;
  min-height: 2.3rem;

  padding:
    .3rem
    .4rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  border-radius: 10px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-0) 8%,
      var(--p-dialog-background)
    );

  font-size: 1.25rem;
}

.line-mode-pictogram,
.line-index-pictogram {
  display: flex;

  align-items: center;
  justify-content: center;
}

.line-description {
  min-width: 0;
}

.line-title {
  font-size: .8rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.line-subtitle {
  margin-top: .08rem;

  font-size: .67rem;

  color:
    var(--p-text-muted-color);
}

.main-line-tag {
  flex-shrink: 0;

  font-size: .65rem;
}

.main-line-notice {
  display: flex;

  align-items: center;

  gap: .4rem;

  margin-top: .65rem;

  padding-top: .6rem;

  border-top:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 12%,
      transparent
    );

  color:
    var(--p-text-muted-color);

  font-size: .67rem;
}

.main-line-notice i {
  flex-shrink: 0;

  color:
    var(--p-primary-500);

  font-size: .85rem;
}

.line-editor-grid {
  display: grid;

  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );

  gap: .7rem;

  margin-top: .75rem;

  padding-top: .75rem;

  border-top:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 13%,
      transparent
    );
}

.line-field {
  display: flex;

  flex-direction: column;

  gap: .35rem;

  min-width: 0;
}

.line-field-label {
  font-size: .7rem;
  font-weight: 600;

  color:
    var(--p-text-muted-color);
}

.add-line-button {
  width: 100%;
}

.multi-line-hint {
  display: flex;

  align-items: flex-start;

  gap: .5rem;

  padding:
    .65rem
    .7rem;

  border:
    1px
    dashed
    color-mix(
      in srgb,
      var(--p-primary-500) 24%,
      transparent
    );

  border-radius: 11px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 3%,
      transparent
    );

  color:
    var(--p-text-muted-color);

  font-size: .67rem;
  line-height: 1.4;
}

.multi-line-hint i {
  flex-shrink: 0;

  margin-top: .05rem;

  color:
    var(--p-primary-500);

  font-size: .9rem;
}

.checkbox-option {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 1rem;

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

  cursor: pointer;
}

.checkbox-option-content {
  display: flex;

  align-items: center;

  gap: .65rem;

  min-width: 0;
}

.checkbox-option-icon {
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

.checkbox-option-text {
  min-width: 0;
}

.checkbox-option-title {
  font-size: .8rem;
  font-weight: 600;

  color:
    var(--p-text-color);
}

.checkbox-option-description {
  margin-top: .08rem;

  font-size: .7rem;

  color:
    var(--p-text-muted-color);
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
  .line-editor-grid {
    grid-template-columns: 1fr;
  }

  .dialog-subtitle,
  .property-card-description,
  .checkbox-option-description,
  .information-notice,
  .footer-hint,
  .main-line-notice,
  .multi-line-hint {
    display: none;
  }

  .lines-count {
    display: none;
  }

  .branch-line-top {
    align-items: flex-start;
  }

  .line-pictograms {
    min-width: 2.8rem;

    font-size: 1.05rem;
  }

  .line-subtitle {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }
}
</style>