<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  computed,
  ref,
} from 'vue'

const { t } = useI18n()

const {
  index,
  mode,
  allowPedestrian = true,
} = defineProps<{
  index: number
  mode: Mode | null
  allowPedestrian?: boolean
}>()

const emit = defineEmits<{
  delete: [number]
}>()

const line = defineModel<ModeConnectionElement>(
  'line',
  {
    required: true,
  },
)

type ExtendedModeConnectionElement =
  ModeConnectionElement['$modeConnectionElement'] & {
    customPictogram?: {
      image: string
      imageSize: number
    } | null
  }

const modeElement =
  computed<ExtendedModeConnectionElement>(
    () => line.value.$modeConnectionElement,
  )

const showOrnamentEditor = ref(false)

const customPictogramInput =
  ref<HTMLInputElement | null>(null)

const customPictogram =
  computed(() => {
    return modeElement.value.customPictogram ?? null
  })

const hasCustomPictogram =
  computed(() => {
    const image =
      customPictogram.value?.image

    return (
      typeof image === 'string'
      && image.trim() !== ''
    )
  })

const customPictogramImage =
  computed(() => {
    return (
      customPictogram.value?.image
      ?? ''
    )
  })

const customPictogramSize =
  computed({
    get: () => {
      return (
        customPictogram.value?.imageSize
        ?? 1
      )
    },

    set: (
      imageSize: number,
    ) => {
      const pictogram =
        modeElement.value.customPictogram

      if (
        pictogram === undefined
        || pictogram === null
      ) {
        return
      }

      pictogram.imageSize = imageSize
    },
  })

const transferEnabled =
  computed({
    get: () => {
      return (
        line.value.$modeConnectionElement.transfer
        != null
        || line.value.$modeConnectionElement.walk
      )
    },

    set: (
      enabled: boolean,
    ) => {
      if (!enabled) {
        line.value
          .$modeConnectionElement
          .transfer = null

        line.value
          .$modeConnectionElement
          .walk = false

        return
      }

      const currentTransfer =
        line.value
          .$modeConnectionElement
          .transfer

      line.value
        .$modeConnectionElement
        .transfer = {
          mode:
            currentTransfer?.mode
            ?? 'WALK',

          durationMinutes:
            currentTransfer
              ?.durationMinutes
            ?? null,
        }

      line.value
        .$modeConnectionElement
        .walk =
        line.value
          .$modeConnectionElement
          .transfer
          .mode
        === 'WALK'
    },
  })

const transferMode =
  computed<TransferMode>({
    get: () => {
      return (
        line.value
          .$modeConnectionElement
          .transfer
          ?.mode
        ?? 'WALK'
      )
    },

    set: (
      mode,
    ) => {
      const currentTransfer =
        line.value
          .$modeConnectionElement
          .transfer

      line.value
        .$modeConnectionElement
        .transfer = {
          mode,

          durationMinutes:
            currentTransfer
              ?.durationMinutes
            ?? null,
        }

      line.value
        .$modeConnectionElement
        .walk =
        mode === 'WALK'
    },
  })

const durationMinutes =
  computed<number | null>({
    get: () => {
      return (
        line.value
          .$modeConnectionElement
          .transfer
          ?.durationMinutes
        ?? null
      )
    },

    set: (
      duration,
    ) => {
      const currentTransfer =
        line.value
          .$modeConnectionElement
          .transfer

      line.value
        .$modeConnectionElement
        .transfer = {
          mode:
            currentTransfer?.mode
            ?? 'WALK',

          durationMinutes:
            duration,
        }

      line.value
        .$modeConnectionElement
        .walk =
        line.value
          .$modeConnectionElement
          .transfer
          .mode
        === 'WALK'
    },
  })

const transferDisabled =
  computed(() => {
    return (
      !allowPedestrian
      && !transferEnabled.value
    )
  })

const transferModes = computed(() => [
  { label: t('ui.connections.walk'), value: 'WALK' as TransferMode },
  { label: t('ui.connections.bike'), value: 'BIKE' as TransferMode },
  { label: t('ui.connections.car'), value: 'CAR' as TransferMode },
  { label: t('ui.connections.bus'), value: 'BUS' as TransferMode },
  { label: t('ui.connections.other'), value: 'OTHER' as TransferMode },
])
function permittedTypes(
  mode: Mode | null,
):
  | OrnamentType[]
  | undefined {
  if (
    mode === 'BUS'
    || mode === 'NOCTILIEN'
  ) {
    return []
  }

  return undefined
}

function isAllowedImage(
  file: File,
) {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ]

  return allowedTypes.includes(
    file.type,
  )
}

function chooseCustomPictogram() {
  customPictogramInput.value?.click()
}

function onCustomPictogramSelected(
  event: Event,
) {
  const input = (
    event.target as HTMLInputElement
  )

  const file =
    input.files?.[0]

  if (
    file === undefined
  ) {
    return
  }

  if (
    !isAllowedImage(file)
  ) {
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

    const previousSize =
      modeElement.value
        .customPictogram
        ?.imageSize
      ?? 1

    modeElement.value
      .customPictogram = {
        image: reader.result,
        imageSize: previousSize,
      }
  }

  reader.readAsDataURL(file)

  input.value = ''
}

function removeCustomPictogram() {
  modeElement.value
    .customPictogram = null
}
</script>

<template>
  <div
    class="
      p-3
      p-panel
      flex
      flex-col
      gap-3
      flex-shrink-0
      connection-line-editor
    "
  >
    <div class="flex flex-col gap-3">
      <div
        class="
          flex
          flex-row
          items-center
          gap-3
        "
      >
        <IndexSelect
          v-model="
            line
              .$modeConnectionElement
              .lineIndex
          "
          :mode="mode"
        />
      </div>

      <div
        class="
          flex
          flex-col
          gap-3
        "
      >
        <div
          class="
            flex
            flex-row
            items-center
            gap-2
          "
        >
          <Checkbox
            v-model="
              transferEnabled
            "
            :input-id="
              `${line.id}_transferEnabled`
            "
            :disabled="
              transferDisabled
            "
            binary
          />

          <label
            :for="
              `${line.id}_transferEnabled`
            "
            class="text-nowrap"
          >
            {{ $t('ui.connections.transfer') }}
          </label>
        </div>

        <div
          v-if="
            transferEnabled
          "
          class="
            flex
            flex-col
            gap-3
          "
        >
          <div
            class="
              flex
              flex-col
              gap-1
            "
          >
            <label
              :for="
                `${line.id}_transferMode`
              "
            >
              {{ $t('ui.connections.transfer_mode') }}
            </label>

            <Select
              :id="
                `${line.id}_transferMode`
              "
              v-model="
                transferMode
              "
              :options="
                transferModes
              "
              option-label="label"
              option-value="value"
              fluid
            />
          </div>

          <div
            class="
              flex
              flex-col
              gap-1
            "
          >
            <label
              :for="
                `${line.id}_durationMinutes`
              "
            >
              {{ $t('ui.connections.duration') }}
            </label>

            <BInputNumber
              :id="
                `${line.id}_durationMinutes`
              "
              v-model="
                durationMinutes
              "
              :min="1"
              :max="999"
              suffix=" min"
            />

            <small class="opacity-50">
              {{ $t('ui.connections.duration_optional') }}
            </small>
          </div>
        </div>
      </div>

      <div
        class="
          flex
          flex-row
          gap-2
          items-center
        "
      >
        <Button
          class="flex-grow"
          size="small"
          :label="
            $t(
              'ui.dialogs.connections_editor.group.ornament',
            )
          "
          :severity="
            line
              .$modeConnectionElement
              .ornament
              ? 'primary'
              : 'secondary'
          "
          :disabled="
            mode === 'BUS'
          "
          @click="
            showOrnamentEditor = true
          "
        />

        <Button
          size="small"
          severity="danger"
          icon="i-tabler-trash"
          @click="
            emit(
              'delete',
              index,
            )
          "
        />
      </div>

      <div
        class="
          custom-index-section
        "
      >
        <input
          ref="customPictogramInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          class="
            custom-index-file-input
          "
          @change="
            onCustomPictogramSelected
          "
        >

        <Button
          class="
            custom-index-button
          "
          size="small"
          :label="
            hasCustomPictogram
              ? $t('ui.connections.custom_logo_change')
              : $t('ui.connections.custom_logo_add')
          "
          :icon="
            hasCustomPictogram
              ? 'i-tabler-photo-edit'
              : 'i-tabler-photo-plus'
          "
          severity="secondary"
          outlined
          @click="
            chooseCustomPictogram()
          "
        />

        <div
          v-if="
            hasCustomPictogram
          "
          class="
            custom-index-preview
          "
        >
          <div
            class="
              custom-index-preview-image
            "
          >
            <img
              :src="
                customPictogramImage
              "
              alt=""
              :style="{
                transform:
                  `scale(${customPictogramSize})`,
              }"
            >
          </div>

          <div
            class="
              custom-index-size
            "
          >
            <div
              class="
                custom-index-size-header
              "
            >
              <span>
                {{ $t('ui.connections.size') }}
              </span>

              <span>
                {{
                  Number(
                    customPictogramSize,
                  ).toFixed(1)
                }}×
              </span>
            </div>

            <input
              v-model.number="
                customPictogramSize
              "
              type="range"
              min="0.4"
              max="3"
              step="0.1"
            >
          </div>

          <Button
            :label="$t('ui.connections.custom_logo_remove')"
            icon="i-tabler-x"
            size="small"
            severity="danger"
            text
            @click="
              removeCustomPictogram()
            "
          />
        </div>
      </div>
    </div>
  </div>

  <OrnamentEditor
    v-model="
      line
        .$modeConnectionElement
        .ornament
    "
    v-model:visible="
      showOrnamentEditor
    "
    :permitted-types="
      permittedTypes(mode)
    "
  />
</template>

<style scoped>
.connection-line-editor {
  min-width: 15em;
}

.custom-index-section {
  display: flex;
  flex-direction: column;
  gap: .6em;
}

.custom-index-file-input {
  display: none;
}

.custom-index-button {
  width: 100%;
  white-space: nowrap;
}

.custom-index-preview {
  padding: .65em;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: .65em;

  border: 1px dashed
    var(--p-content-border-color);

  border-radius:
    var(--p-border-radius-md);
}

.custom-index-preview-image {
  min-height: 3.5em;
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: hidden;
}

.custom-index-preview-image img {
  display: block;

  max-width: 7em;
  max-height: 3.5em;

  object-fit: contain;

  transform-origin: center;
}

.custom-index-size {
  display: flex;
  flex-direction: column;
  gap: .35em;
}

.custom-index-size-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1em;

  font-size: .85rem;
}

.custom-index-size input {
  width: 100%;
}
</style>
