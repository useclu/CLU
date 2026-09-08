<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'

const visible = defineModel<boolean>('visible')

const stop = defineModel<Stop>('stop', {
  required: true,
})

function addModeConnection() {
  stop.value.$stop.connections.push({
    id: uuidv4(),

    $modeConnection: {
      mode: null,

      elements: [],

      walk: false,

      transfer: null,

      customPictogram: null,

      customConnections: [],
    },
  })
}

function addServiceConnection() {
  stop.value.$stop.connections.push({
    id: uuidv4(),

    $serviceConnection: {
      elements: [],

      walk: false,

      transfer: null,
    },
  })
}

function deleteConnection(
  index: number,
) {
  stop.value.$stop.connections.splice(
    index,
    1,
  )
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="connections-editor-dialog"
    :pt="{
      root: {
        class: 'connections-dialog-root',
      },
      header: {
        class: 'connections-dialog-header',
      },
      content: {
        class: 'connections-dialog-content',
      },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-heading-icon">
          <i class="i-tabler-arrows-transfer-up-down" />
        </div>

        <div class="dialog-heading-content">
          <span
            class="p-dialog-title"
            data-pc-section="title"
          >
            {{
              $t(
                'ui.dialogs.connections_editor.header',
                {
                  stopName:
                    stop.$stop.name,
                },
              )
            }}
          </span>

          <span class="dialog-heading-description">
            Configure les lignes, services et modes de correspondance
          </span>
        </div>
      </div>
    </template>

    <div class="editor-content">
      <!--
        =========================================================
        CORRESPONDANCES EXISTANTES
        =========================================================
      -->
      <section
        v-if="stop.$stop.connections.length > 0"
        class="connections-section"
      >
        <div class="section-heading">
          <div class="section-heading-left">
            <div class="section-icon">
              <i class="i-tabler-route" />
            </div>

            <div>
              <div class="section-title">
                Correspondances
              </div>

              <div class="section-description">
                Lignes et services disponibles à cet arrêt
              </div>
            </div>
          </div>

          <div class="connections-count">
            {{ stop.$stop.connections.length }}
          </div>
        </div>

        <div class="connections">
          <ConnectionGroupEditor
            v-for="(
              _,
              index
            ) in stop.$stop.connections"
            :key="
              stop.$stop.connections[
                index
              ].id
            "
            v-model:connection="
              stop.$stop.connections[
                index
              ]
            "
            :index="index"
            @delete="deleteConnection"
          />
        </div>
      </section>

      <!--
        =========================================================
        ÉTAT VIDE
        =========================================================
      -->
      <section
        v-else
        class="empty-state"
      >
        <div class="empty-state-icon">
          <i class="i-tabler-arrows-transfer-up-down" />
        </div>

        <div class="empty-state-title">
          Aucune correspondance
        </div>

        <div class="empty-state-description">
          Ajoute un mode de transport ou un service à cet arrêt.
        </div>
      </section>

      <!--
        =========================================================
        AJOUT RAPIDE
        =========================================================
      -->
      <div class="quick-add">
        <span class="quick-add-label">
          Ajouter
        </span>

        <button
          type="button"
          class="quick-add-button"
          @click="addModeConnection()"
        >
          <i class="i-tabler-bus" />

          <span>
            {{
              $t(
                'ui.dialogs.connections_editor.mode',
              )
            }}
          </span>
        </button>

        <button
          type="button"
          class="quick-add-button"
          @click="addServiceConnection()"
        >
          <i class="i-tabler-building-community" />

          <span>
            {{
              $t(
                'ui.dialogs.connections_editor.service',
              )
            }}
          </span>
        </button>
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
/*
 * =========================================================
 * DIALOG
 * =========================================================
 */

:deep(.connections-dialog-root) {
  width: min(68rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);

  display: flex;
  flex-direction: column;
}

:deep(.connections-dialog-header) {
  flex-shrink: 0;
}

:deep(.connections-dialog-content) {
  min-height: 0;

  flex: 1;

  overflow-y: auto !important;
  overflow-x: hidden;

  padding-bottom: 1rem;
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

  color:
    var(--p-primary-color);

  font-size: 1.15rem;
}

.dialog-heading-content {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.dialog-heading-description {
  margin-top: .1rem;

  color:
    var(--p-text-muted-color);

  font-size: .72rem;
  font-weight: 400;
}

/*
 * =========================================================
 * CONTENU
 * =========================================================
 */

.editor-content {
  display: flex;
  flex-direction: column;
  gap: .7rem;

  width: 100%;

  padding: .1rem .1rem .35rem;
}

/*
 * =========================================================
 * CORRESPONDANCES
 * =========================================================
 */

.connections-section {
  overflow: hidden;

  flex-shrink: 0;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .9rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-background) 94%,
      transparent
    );
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

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
      var(--p-content-hover-background) 55%,
      transparent
    );
}

.section-heading-left {
  display: flex;
  align-items: center;
  gap: .65rem;

  min-width: 0;
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.9rem;
  height: 1.9rem;

  flex-shrink: 0;

  border-radius: .6rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1rem;
}

.section-title {
  font-size: .85rem;
  font-weight: 700;
}

.section-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .67rem;
}

.connections-count {
  display: flex;
  align-items: center;
  justify-content: center;

  min-width: 1.55rem;
  height: 1.55rem;

  padding: 0 .35rem;

  border-radius: 999px;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .65rem;
  font-weight: 700;
}

.connections {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  align-items: start;

  gap: .65rem;

  padding: .65rem;
}

/*
 * =========================================================
 * ÉTAT VIDE
 * =========================================================
 */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  min-height: 8rem;

  padding: 1.2rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .8rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 22%,
      transparent
    );

  text-align: center;
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.4rem;
  height: 2.4rem;

  margin-bottom: .45rem;

  border-radius: .65rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1.1rem;
}

.empty-state-title {
  font-size: .82rem;
  font-weight: 700;
}

.empty-state-description {
  margin-top: .15rem;

  color:
    var(--p-text-muted-color);

  font-size: .67rem;
}

/*
 * =========================================================
 * AJOUT RAPIDE
 * =========================================================
 */

.quick-add {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .4rem;

  flex-shrink: 0;

  padding: .15rem .1rem;
}

.quick-add-label {
  margin-right: .15rem;

  color:
    var(--p-text-muted-color);

  font-size: .68rem;
  font-weight: 600;
}

.quick-add-button {
  appearance: none;

  display: inline-flex;
  align-items: center;
  gap: .35rem;

  min-height: 2rem;

  padding: .35rem .55rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .55rem;

  background:
    var(--p-content-background);

  color:
    var(--p-text-color);

  font-family: inherit;
  font-size: .68rem;
  font-weight: 600;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    color .15s ease;
}

.quick-add-button i {
  color:
    var(--p-text-muted-color);

  font-size: .9rem;
}

.quick-add-button:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 45%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 5%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);
}

.quick-add-button:hover i {
  color:
    var(--p-primary-color);
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 1024px) {
  :deep(.connections-dialog-root) {
    width: min(42rem, calc(100vw - 2rem));
  }

  .connections {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  :deep(.connections-dialog-root) {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .section-description,
  .dialog-heading-description {
    display: none;
  }

  .quick-add {
    align-items: stretch;
  }

  .quick-add-label {
    width: 100%;

    margin-bottom: .05rem;
  }

  .quick-add-button {
    flex: 1;
    justify-content: center;
  }
}
</style>