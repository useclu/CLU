<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'

const connection = defineModel<ModeConnection>('connection', {
  required: true,
})

const showTransferOptions = ref(false)

const transferChild = computed(() =>
  connection.value.$modeConnection.elements.some(
    element =>
      element.$modeConnectionElement.transfer != null
      || element.$modeConnectionElement.walk,
  ),
)

const transferEnabled = computed({
  get: () =>
    connection.value.$modeConnection.transfer != null
    || connection.value.$modeConnection.walk,

  set: (enabled: boolean) => {
    if (!enabled) {
      connection.value.$modeConnection.transfer = null
      connection.value.$modeConnection.walk = false
      return
    }

    if (!connection.value.$modeConnection.transfer) {
      connection.value.$modeConnection.transfer = {
        mode: 'WALK',
        durationMinutes: null,
      }
    }

    connection.value.$modeConnection.walk
      = connection.value.$modeConnection.transfer.mode === 'WALK'
  },
})

const transferMode = computed<TransferMode>({
  get: () =>
    connection.value.$modeConnection.transfer?.mode ?? 'WALK',

  set: (mode) => {
    if (!connection.value.$modeConnection.transfer) {
      connection.value.$modeConnection.transfer = {
        mode,
        durationMinutes: null,
      }
    }
    else {
      connection.value.$modeConnection.transfer.mode = mode
    }

    connection.value.$modeConnection.walk = mode === 'WALK'
  },
})

const durationMinutes = computed<number | null>({
  get: () =>
    connection.value.$modeConnection.transfer?.durationMinutes ?? null,

  set: (duration) => {
    if (!connection.value.$modeConnection.transfer) {
      connection.value.$modeConnection.transfer = {
        mode: 'WALK',
        durationMinutes: duration,
      }

      return
    }

    connection.value.$modeConnection.transfer.durationMinutes = duration
  },
})

const transferModes: {
  label: string
  value: TransferMode
}[] = [
  {
    label: 'À pied',
    value: 'WALK',
  },
  {
    label: 'Vélo',
    value: 'BIKE',
  },
  {
    label: 'Voiture',
    value: 'CAR',
  },
  {
    label: 'Bus',
    value: 'BUS',
  },
  {
    label: 'Autre',
    value: 'OTHER',
  },
]

const localPictogram = computed(
  () =>
    connection.value
      .$modeConnection
      .customPictogram
      ?.image
    ?? '',
)

const hasLocalPictogram = computed(
  () =>
    localPictogram.value.trim() !== '',
)

function isAllowedImage(
  file: File,
) {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ]

  return allowedTypes.includes(file.type)
}

function addLine() {
  connection.value.$modeConnection.elements.push({
    id: uuidv4(),

    $modeConnectionElement: {
      lineIndex: null,
      walk: false,
      transfer: null,
      ornament: null,
      customPictogram: null,
    },
  })
}

function deleteLine(
  index: number,
) {
  connection.value.$modeConnection.elements.splice(
    index,
    1,
  )
}

function onLocalPictogramSelected(
  event: Event,
) {
  const input = (
    event.target as HTMLInputElement
  )

  const file =
    input.files?.[0]

  if (file === undefined) {
    return
  }

  if (!isAllowedImage(file)) {
    input.value = ''
    return
  }

  const reader =
    new FileReader()

  reader.onload = () => {
    if (
      typeof reader.result
      !== 'string'
    ) {
      return
    }

    connection.value
      .$modeConnection
      .customPictogram = {
        image: reader.result,
      }
  }

  reader.readAsDataURL(file)

  input.value = ''
}

function removeLocalPictogram() {
  connection.value
    .$modeConnection
    .customPictogram = null
}
</script>

<template>
  <div class="mode-connection-editor">
    <!--
      =========================================================
      PICTOGRAMME
      =========================================================
    -->
    <div class="pictogram-block">
      <div class="pictogram-preview">
        <img
          v-if="hasLocalPictogram"
          :src="localPictogram"
          alt=""
        >

        <Mode
          v-else
          :mode="
            connection.$modeConnection.mode
          "
        />
      </div>

      <div class="pictogram-content">
        <div class="pictogram-heading">
          <div>
            <div class="pictogram-title">
              Pictogramme
            </div>

            <div class="pictogram-description">
              {{
                hasLocalPictogram
                  ? 'Image personnalisée pour cette correspondance'
                  : 'Pictogramme par défaut du mode de transport'
              }}
            </div>
          </div>
        </div>

        <div class="pictogram-actions">
          <label class="file-button">
            <i class="i-tabler-upload" />

            <span>
              {{
                hasLocalPictogram
                  ? 'Changer'
                  : 'Importer'
              }}
            </span>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="file-input"
              @change="
                onLocalPictogramSelected
              "
            >
          </label>

          <Button
            v-if="hasLocalPictogram"
            label="Rétablir"
            icon="i-tabler-restore"
            severity="secondary"
            text
            size="small"
            @click="
              removeLocalPictogram()
            "
          />
        </div>
      </div>
    </div>

    <!--
      =========================================================
      MODE
      =========================================================
    -->
    <div class="main-field">
      <label class="field-label">
        {{
          $t(
            'ui.dialogs.connections_editor.group.mode.mode',
          )
        }}
      </label>

      <ModeSelect
        v-model="connection.$modeConnection.mode"
      />
    </div>

    <!--
      =========================================================
      LIGNES
      =========================================================
    -->
    <div class="lines-block">
      <div class="lines-heading">
        <div>
          <div class="lines-title">
            {{
              $t(
                'ui.dialogs.connections_editor.group.mode.lines.header',
              )
            }}
          </div>

          <div class="lines-description">
            Lignes affichées pour cette correspondance
          </div>
        </div>

        <span class="lines-count">
          {{ connection.$modeConnection.elements.length }}
        </span>
      </div>

      <HorizontalScrollContainer>
        <div class="lines-list">
          <ConnectionLineEditor
            v-for="(
              _,
              i
            ) in connection.$modeConnection.elements"
            :key="
              connection.$modeConnection.elements[i].id
            "
            v-model:line="
              connection.$modeConnection.elements[i]
            "
            :index="i"
            :mode="
              connection.$modeConnection.mode
            "
            :allow-pedestrian="
              !transferChild
                && !transferEnabled
                && i > 0
            "
            @delete="deleteLine"
          />

          <button
            type="button"
            class="add-line-button"
            @click="addLine()"
          >
            <i class="i-tabler-plus" />

            <span>
              {{
                $t(
                  'ui.dialogs.connections_editor.group.mode.lines.add',
                )
              }}
            </span>
          </button>
        </div>
      </HorizontalScrollContainer>
    </div>

    <!--
      =========================================================
      DÉPLACEMENT
      =========================================================
    -->
    <div class="transfer-block">
      <button
        type="button"
        class="transfer-toggle"
        @click="
          showTransferOptions
            = !showTransferOptions
        "
      >
        <div class="transfer-toggle-left">
          <div class="transfer-icon">
            <i class="i-tabler-walk" />
          </div>

          <div>
            <div class="transfer-toggle-title">
              Déplacement
            </div>

            <div class="transfer-toggle-description">
              Moyen de déplacement et durée de correspondance
            </div>
          </div>
        </div>

        <div class="transfer-toggle-right">
          <span
            v-if="transferEnabled || transferChild"
            class="configured-dot"
          />

          <i
            :class="
              showTransferOptions
                ? 'i-tabler-chevron-up'
                : 'i-tabler-chevron-down'
            "
          />
        </div>
      </button>

      <div
        v-if="showTransferOptions"
        class="transfer-content"
      >
        <label
          :for="
            `${connection.id}_transferEnabled`
          "
          class="transfer-enable-row"
          :class="{
            disabled: transferChild,
          }"
        >
          <div>
            <div class="transfer-enable-title">
              Activer un déplacement
            </div>

            <div class="transfer-enable-description">
              Indique qu’un trajet est nécessaire pour effectuer cette correspondance.
            </div>
          </div>

          <Checkbox
            v-model="transferEnabled"
            :input-id="
              `${connection.id}_transferEnabled`
            "
            :disabled="transferChild"
            binary
          />
        </label>

        <div
          v-if="transferChild"
          class="info-message"
        >
          <i class="i-tabler-info-circle" />

          <span>
            Un déplacement est déjà défini directement sur une ligne.
          </span>
        </div>

        <div
          v-if="transferEnabled"
          class="transfer-settings"
        >
          <div class="compact-field">
            <label
              :for="
                `${connection.id}_transferMode`
              "
              class="field-label"
            >
              Moyen de déplacement
            </label>

            <Select
              :id="
                `${connection.id}_transferMode`
              "
              v-model="transferMode"
              :options="transferModes"
              option-label="label"
              option-value="value"
              fluid
            />
          </div>

          <div class="compact-field">
            <label
              :for="
                `${connection.id}_durationMinutes`
              "
              class="field-label"
            >
              Durée
            </label>

            <BInputNumber
              :id="
                `${connection.id}_durationMinutes`
              "
              v-model="durationMinutes"
              :min="1"
              :max="999"
              suffix=" min"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mode-connection-editor {
  display: flex;
  flex-direction: column;
  gap: .8rem;
}

/*
 * =========================================================
 * PICTOGRAMME
 * =========================================================
 */

.pictogram-block {
  display: flex;
  align-items: center;
  gap: .65rem;

  padding: .6rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 20%,
      transparent
    );
}

.pictogram-preview {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.8rem;
  height: 2.8rem;

  flex-shrink: 0;

  padding: .25rem;

  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .6rem;

  background:
    var(--p-content-background);

  font-size: 1.4rem;
}

.pictogram-preview img {
  display: block;

  max-width: 100%;
  max-height: 100%;

  object-fit: contain;
}

.pictogram-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;

  min-width: 0;

  flex: 1;
}

.pictogram-heading {
  min-width: 0;
}

.pictogram-title {
  font-size: .75rem;
  font-weight: 700;
}

.pictogram-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .63rem;
}

.pictogram-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .3rem;

  flex-shrink: 0;
}

.file-button {
  display: inline-flex;
  align-items: center;
  gap: .3rem;

  padding: .35rem .5rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .5rem;

  background:
    var(--p-content-background);

  color:
    var(--p-text-color);

  font-size: .68rem;
  font-weight: 500;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease;
}

.file-button:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 45%,
      var(--p-content-border-color)
    );

  background:
    var(--p-content-hover-background);
}

.file-input {
  display: none;
}

/*
 * =========================================================
 * MODE
 * =========================================================
 */

.main-field,
.compact-field {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}

.field-label {
  font-size: .75rem;
  font-weight: 600;
}

.main-field :deep(.p-select),
.compact-field :deep(.p-select),
.compact-field :deep(.p-inputnumber),
.compact-field :deep(.p-inputtext) {
  width: 100%;
}

/*
 * =========================================================
 * LIGNES
 * =========================================================
 */

.lines-block {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.lines-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}

.lines-title {
  font-size: .78rem;
  font-weight: 700;
}

.lines-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .63rem;
}

.lines-count {
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

.lines-list {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: .5rem;

  overflow-x: auto;
  overflow-y: hidden;

  padding-bottom: .1rem;
}

.add-line-button {
  appearance: none;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;

  min-width: 9rem;
  min-height: 3rem;

  padding: .55rem .7rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 30%,
      transparent
    );

  color:
    var(--p-text-muted-color);

  font-family: inherit;
  font-size: .7rem;
  font-weight: 600;

  cursor: pointer;

  transition:
    border-color .15s ease,
    background-color .15s ease,
    color .15s ease;
}

.add-line-button:hover {
  border-color:
    var(--p-primary-color);

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 5%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);
}

/*
 * =========================================================
 * DÉPLACEMENT
 * =========================================================
 */

.transfer-block {
  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .7rem;
}

.transfer-toggle {
  appearance: none;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;

  width: 100%;

  padding: .55rem .65rem;

  border: 0;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 35%,
      transparent
    );

  color:
    var(--p-text-color);

  font-family: inherit;
  text-align: left;

  cursor: pointer;
}

.transfer-toggle:hover {
  background:
    var(--p-content-hover-background);
}

.transfer-toggle-left {
  display: flex;
  align-items: center;
  gap: .5rem;

  min-width: 0;
}

.transfer-icon {
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

  font-size: .9rem;
}

.transfer-toggle-title {
  font-size: .72rem;
  font-weight: 600;
}

.transfer-toggle-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .62rem;
}

.transfer-toggle-right {
  display: flex;
  align-items: center;
  gap: .45rem;

  flex-shrink: 0;

  color:
    var(--p-text-muted-color);
}

.configured-dot {
  width: .45rem;
  height: .45rem;

  border-radius: 999px;

  background:
    var(--p-primary-color);
}

.transfer-content {
  display: flex;
  flex-direction: column;
  gap: .6rem;

  padding: .65rem;

  border-top:
    1px solid
    var(--p-content-border-color);
}

.transfer-enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;

  padding: .45rem .1rem;

  cursor: pointer;
}

.transfer-enable-row.disabled {
  cursor: default;
  opacity: .65;
}

.transfer-enable-title {
  font-size: .72rem;
  font-weight: 600;
}

.transfer-enable-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .62rem;
}

.transfer-settings {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    minmax(8rem, .6fr);

  gap: .5rem;

  padding-top: .1rem;
}

.info-message {
  display: flex;
  align-items: center;
  gap: .35rem;

  color:
    var(--p-text-muted-color);

  font-size: .62rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 768px) {
  .pictogram-content {
    align-items: flex-start;
    flex-direction: column;
    gap: .4rem;
  }

  .transfer-settings {
    grid-template-columns: 1fr;
  }

  .lines-list {
    flex-direction: column;

    overflow-x: hidden;
  }

  .add-line-button {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .pictogram-description,
  .lines-description,
  .transfer-toggle-description,
  .transfer-enable-description {
    display: none;
  }

  .pictogram-block {
    align-items: flex-start;
  }
}
</style>