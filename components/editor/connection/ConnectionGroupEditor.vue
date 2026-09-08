<script setup lang="ts">
import { isMode, isService } from '~/utils/types'

const {
  index,
} = defineProps<{
  index: number
}>()

const emit = defineEmits<{
  delete: [number]
}>()

const connection = defineModel<Connection>(
  'connection',
  {
    required: true,
  },
)
</script>

<template>
  <section class="connection-card">
    <!--
      =========================================================
      EN-TÊTE
      =========================================================
    -->
    <div class="connection-header">
      <div class="connection-header-left">
        <div
          class="connection-type-icon"
          :class="{
            mode: isMode(connection),
            service: isService(connection),
          }"
        >
          <i
            v-if="isMode(connection)"
            class="i-tabler-route"
          />

          <i
            v-else-if="isService(connection)"
            class="i-tabler-building-community"
          />

          <i
            v-else
            class="i-tabler-help"
          />
        </div>

        <div class="connection-heading">
          <div class="connection-title">
            {{
              $t(
                'ui.dialogs.connections_editor.group.header',
                {
                  index: index + 1,
                },
              )
            }}
          </div>

          <div class="connection-subtitle">
            <template v-if="isMode(connection)">
              {{
                $t(
                  'ui.dialogs.connections_editor.mode',
                )
              }}
            </template>

            <template v-else-if="isService(connection)">
              {{
                $t(
                  'ui.dialogs.connections_editor.service',
                )
              }}
            </template>

            <template v-else>
              Type inconnu
            </template>
          </div>
        </div>
      </div>

      <div
        class="connection-type-badge"
        :class="{
          mode: isMode(connection),
          service: isService(connection),
        }"
      >
        <i
          v-if="isMode(connection)"
          class="i-tabler-bus"
        />

        <i
          v-else-if="isService(connection)"
          class="i-tabler-building-community"
        />

        <span v-if="isMode(connection)">
          {{
            $t(
              'ui.dialogs.connections_editor.mode',
            )
          }}
        </span>

        <span v-else-if="isService(connection)">
          {{
            $t(
              'ui.dialogs.connections_editor.service',
            )
          }}
        </span>
      </div>
    </div>

    <!--
      =========================================================
      CONTENU
      =========================================================
    -->
    <div class="connection-content">
      <ModeConnectionGroupEditor
        v-if="isMode(connection)"
        v-model:connection="connection"
      />

      <ServiceConnectionGroupEditor
        v-else-if="isService(connection)"
        v-model:connection="connection"
      />

      <div
        v-else
        class="unknown-connection"
      >
        <div class="unknown-icon">
          <i class="i-tabler-alert-triangle" />
        </div>

        <div>
          <div class="unknown-title">
            Type de correspondance inconnu
          </div>

          <div class="unknown-description">
            Cette correspondance ne peut pas être modifiée
            avec l’éditeur actuel.
          </div>
        </div>
      </div>
    </div>

    <!--
      =========================================================
      ACTIONS
      =========================================================
    -->
    <div class="connection-footer">
      <div class="connection-footer-note">
        <i class="i-tabler-info-circle" />

        <span>
          Les modifications sont appliquées immédiatement.
        </span>
      </div>

      <Button
        :label="
          $t(
            'ui.dialogs.connections_editor.group.delete',
          )
        "
        size="small"
        icon="i-tabler-trash"
        severity="danger"
        text
        @click="emit('delete', index)"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.connection-card {
  display: flex;
  flex-direction: column;

  min-width: 0;

  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .85rem;

  background:
    var(--p-content-background);

  box-shadow:
    0 .1rem .45rem
    color-mix(
      in srgb,
      var(--p-text-color) 5%,
      transparent
    );
}

/*
 * =========================================================
 * EN-TÊTE
 * =========================================================
 */

.connection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  padding: .65rem .7rem;

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

.connection-header-left {
  display: flex;
  align-items: center;
  gap: .6rem;

  min-width: 0;
}

.connection-type-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex-shrink: 0;

  border-radius: .6rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1rem;
}

.connection-type-icon.mode {
  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 12%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);
}

.connection-type-icon.service {
  background:
    color-mix(
      in srgb,
      var(--p-text-muted-color) 10%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);
}

.connection-heading {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.connection-title {
  overflow: hidden;

  font-size: .82rem;
  font-weight: 700;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-subtitle {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .68rem;
}

.connection-type-badge {
  display: inline-flex;
  align-items: center;
  gap: .3rem;

  flex-shrink: 0;

  padding: .25rem .45rem;

  border-radius: 999px;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .65rem;
  font-weight: 600;
}

.connection-type-badge.mode {
  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 10%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);
}

.connection-type-badge.service {
  background:
    color-mix(
      in srgb,
      var(--p-text-muted-color) 9%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);
}

/*
 * =========================================================
 * CONTENU
 * =========================================================
 */

.connection-content {
  display: flex;
  flex-direction: column;
  gap: .65rem;

  padding: .75rem;

  flex: 1;
}

.unknown-connection {
  display: flex;
  align-items: flex-start;
  gap: .6rem;

  padding: .7rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 35%,
      transparent
    );
}

.unknown-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.8rem;
  height: 1.8rem;

  flex-shrink: 0;

  border-radius: .5rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);
}

.unknown-title {
  font-size: .76rem;
  font-weight: 600;
}

.unknown-description {
  margin-top: .1rem;

  color:
    var(--p-text-muted-color);

  font-size: .68rem;
  line-height: 1.35;
}

/*
 * =========================================================
 * PIED DE CARTE
 * =========================================================
 */

.connection-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .6rem;

  padding: .5rem .65rem;

  border-top:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 25%,
      transparent
    );
}

.connection-footer-note {
  display: flex;
  align-items: center;
  gap: .3rem;

  min-width: 0;

  color:
    var(--p-text-muted-color);

  font-size: .65rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 640px) {
  .connection-header {
    align-items: flex-start;
  }

  .connection-type-badge {
    padding: .25rem;
  }

  .connection-type-badge span {
    display: none;
  }

  .connection-footer-note {
    display: none;
  }
}
</style>