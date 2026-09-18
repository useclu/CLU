<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import cdgExpressIcon from '~/assets/svg/services/cdg_express.svg'
import cdgvalIcon from '~/assets/svg/services/cdgval.svg'
import funicularIcon from '~/assets/svg/services/funicular.svg'
import longDistanceBusIcon from '~/assets/svg/services/long_distance_bus.svg'
import orlybusIcon from '~/assets/svg/services/orlybus.svg'
import orlyvalIcon from '~/assets/svg/services/orlyval.svg'
import roissybusIcon from '~/assets/svg/services/roissybus.svg'
import terIcon from '~/assets/svg/services/ter.svg'
import tgvIcon from '~/assets/svg/services/tgv.svg'

import { useProject } from '~/stores/useProject'
import {
  modeToDotsColorPolicy,
  modeToLineStyle,
  modeToLineThickness,
  modeToTerminusFramePolicy,
} from '~/utils/properties'


const { t } = useI18n()

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

type SignageStyle =
  | 'IDFM'
  | 'SNCF'

type TransportService =
  | 'TGV'
  | 'TER'
  | 'CAR'
  | 'FUNICULAIRE'
  | 'ROISSYBUS'
  | 'ORLYBUS'
  | 'CDGVAL'
  | 'ORLYVAL'
  | 'CDG_EXPRESS'
  | 'CUSTOM'

type ServiceSelection =
  | 'NONE'
  | TransportService

type CustomTransportService = {
  name: string
  icon: string | null
  renderMode: Mode
}

type LineWithTransportService = Line & {
  transportService?: TransportService | null

  customTransportService?:
    Partial<CustomTransportService>
}

interface TransportServiceOption {
  label: string
  value: ServiceSelection
  renderMode: Mode | null
  icon: string | null
  description: string
}

const transportServiceOptions = computed<TransportServiceOption[]>(() => [
  {
    label: t('ui.general_settings.service_none'),
    value: 'NONE',
    renderMode: null,
    icon: null,
    description: t('ui.general_settings.service_default_mode'),
  },
  {
    label: 'TGV',
    value: 'TGV',
    renderMode: 'TRAIN',
    icon: tgvIcon,
    description: t('ui.general_settings.service_train_render'),
  },
  {
    label: 'TER',
    value: 'TER',
    renderMode: 'TRAIN',
    icon: terIcon,
    description: t('ui.general_settings.service_train_render'),
  },
  {
    label: t('data.services.long_distance_bus'),
    value: 'CAR',
    renderMode: 'BUS',
    icon: longDistanceBusIcon,
    description: t('ui.general_settings.service_bus_render'),
  },
  {
    label: t('data.services.funicular'),
    value: 'FUNICULAIRE',
    renderMode: 'TRAM',
    icon: funicularIcon,
    description: t('ui.general_settings.service_tram_render'),
  },
  {
    label: 'RoissyBus',
    value: 'ROISSYBUS',
    renderMode: 'BUS',
    icon: roissybusIcon,
    description: t('ui.general_settings.service_bus_render'),
  },
  {
    label: 'OrlyBus',
    value: 'ORLYBUS',
    renderMode: 'BUS',
    icon: orlybusIcon,
    description: t('ui.general_settings.service_bus_render'),
  },
  {
    label: 'CDGVAL',
    value: 'CDGVAL',
    renderMode: 'METRO',
    icon: cdgvalIcon,
    description: t('ui.general_settings.service_metro_render'),
  },
  {
    label: 'Orlyval',
    value: 'ORLYVAL',
    renderMode: 'METRO',
    icon: orlyvalIcon,
    description: t('ui.general_settings.service_metro_render'),
  },
  {
    label: 'CDG Express',
    value: 'CDG_EXPRESS',
    renderMode: 'TRAIN',
    icon: cdgExpressIcon,
    description: t('ui.general_settings.service_train_render'),
  },
  {
    label: t('ui.general_settings.service_custom'),
    value: 'CUSTOM',
    renderMode: null,
    icon: null,
    description: t('ui.general_settings.service_custom_description'),
  },
])

const customServiceRenderOptions = computed(() => [
  {
    label: t('ui.general_settings.render_classic'),
    value: 'TRAIN' as Mode,
  },
  {
    label: t('ui.general_settings.render_bus'),
    value: 'BUS' as Mode,
  },
  {
    label: t('ui.general_settings.render_tram'),
    value: 'TRAM' as Mode,
  },
])

type LineWithStopSuggestions = Line & {
  stopSuggestionsEnabled?: boolean
}

const { line } =
  storeToRefs(useProject())

const transportService =
  computed<TransportService | null>({
    get: () =>
      (
        line.value as LineWithTransportService
      ).transportService
      ?? null,

    set: (service) => {
      (
        line.value as LineWithTransportService
      ).transportService = service
    },
  })

const serviceSelection =
  computed<ServiceSelection>(() =>
    transportService.value
    ?? 'NONE',
  )

function ensureCustomTransportService():
CustomTransportService {
  const target =
    line.value as LineWithTransportService

  if (!target.customTransportService) {
    target.customTransportService = {
      name: t('ui.general_settings.custom_service_default'),
      icon: null,
      renderMode: 'TRAIN',
    }
  }

  if (
    !target.customTransportService.name
  ) {
    target.customTransportService.name =
      t('ui.general_settings.custom_service_default')
  }

  if (
    target.customTransportService.icon
    === undefined
  ) {
    target.customTransportService.icon =
      null
  }

  if (
    !target.customTransportService
      .renderMode
  ) {
    target.customTransportService
      .renderMode = 'TRAIN'
  }

  return (
    target.customTransportService as CustomTransportService
  )
}

const customServiceName =
  computed<string>({
    get: () =>
      (
        line.value as LineWithTransportService
      )
        .customTransportService
        ?.name
      ?? t('ui.general_settings.custom_service_default'),

    set: (value) => {
      ensureCustomTransportService()
        .name = value
    },
  })

const customServiceIcon =
  computed<string | null>({
    get: () =>
      (
        line.value as LineWithTransportService
      )
        .customTransportService
        ?.icon
      ?? null,

    set: (value) => {
      ensureCustomTransportService()
        .icon = value
    },
  })

const customServiceRenderMode =
  computed<Mode>({
    get: () =>
      (
        line.value as LineWithTransportService
      )
        .customTransportService
        ?.renderMode
      ?? 'TRAIN',

    set: (value) => {
      ensureCustomTransportService()
        .renderMode = value

      if (
        transportService.value
        === 'CUSTOM'
      ) {
        line.value.mode = value
      }
    },
  })

const displayedTransportMode =
  computed<Mode | null>(() => {
    if (transportService.value) {
      return null
    }

    return line.value.mode
  })

function getTransportServiceOption(
  value:
    | ServiceSelection
    | null
    | undefined,
): TransportServiceOption {
  return (
    transportServiceOptions.value.find(
      option =>
        option.value === value,
    )
    ?? transportServiceOptions.value[0]
  )
}

function getTransportServiceLabel(
  value:
    | ServiceSelection
    | null
    | undefined,
) {
  if (value === 'CUSTOM') {
    const name =
      customServiceName.value.trim()

    return (
      name !== ''
        ? name
        : t('ui.general_settings.service_custom')
    )
  }

  return getTransportServiceOption(
    value,
  ).label
}

function getTransportServiceIcon(
  value:
    | ServiceSelection
    | null
    | undefined,
) {
  if (value === 'CUSTOM') {
    return customServiceIcon.value
  }

  return getTransportServiceOption(
    value,
  ).icon
}

const selectedServiceOption =
  computed<TransportServiceOption>(
    () =>
      getTransportServiceOption(
        serviceSelection.value,
      ),
  )

function setTransportMode(
  mode: Mode | null,
) {
  if (mode === null) {
    return
  }

  transportService.value = null

  line.value.mode = mode
}

function setTransportService(
  selection:
    | ServiceSelection
    | null,
) {
  const normalizedSelection =
    selection ?? 'NONE'

  if (
    normalizedSelection === 'NONE'
  ) {
    transportService.value = null
    return
  }

  if (
    normalizedSelection === 'CUSTOM'
  ) {
    const custom =
      ensureCustomTransportService()

    line.value.mode =
      custom.renderMode

    transportService.value =
      'CUSTOM'

    return
  }

  const option =
    getTransportServiceOption(
      normalizedSelection,
    )

  if (
    option.value === 'NONE'
    || option.renderMode === null
  ) {
    return
  }

  line.value.mode =
    option.renderMode

  transportService.value =
    normalizedSelection
}

function selectCustomServiceIcon(
  event: Event,
) {
  const input =
    event.target as HTMLInputElement

  const file =
    input.files?.[0]

  if (!file) {
    return
  }

  const allowed =
    file.type.startsWith('image/')
    || file.name
      .toLowerCase()
      .endsWith('.svg')

  if (!allowed) {
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

    customServiceIcon.value =
      reader.result

    input.value = ''
  }

  reader.readAsDataURL(file)
}

function removeCustomServiceIcon() {
  customServiceIcon.value = null
}

const stopSuggestionsEnabled =
  computed<boolean>({
    get: () =>
      (
        line.value as LineWithStopSuggestions
      ).stopSuggestionsEnabled
      ?? true,

    set: (enabled) => {
      (
        line.value as LineWithStopSuggestions
      ).stopSuggestionsEnabled =
        enabled
    },
  })

const emit = defineEmits<{
  openCustomMapSize: []
  openCustomLineThickness: []
}>()

const tramStyle =
  computed<TramStyle>({
    get: () =>
      (
        line.value as Line & {
          tramStyle?: TramStyle
        }
      ).tramStyle
      ?? 'ANGLED',

    set: (value) => {
      (
        line.value as Line & {
          tramStyle?: TramStyle
        }
      ).tramStyle = value
    },
  })

const signageStyle =
  computed<SignageStyle>({
    get: () =>
      (
        line.value as Line & {
          signageStyle?: SignageStyle
        }
      ).signageStyle
      ?? 'IDFM',

    set: (value) => {
      (
        line.value as Line & {
          signageStyle?: SignageStyle
        }
      ).signageStyle = value
    },
  })

watch(
  () => line.value.mode,
  (val) => {
    if (!val) {
      return
    }

    line.value.lineThickness =
      modeToLineThickness(val)

    line.value.lineStyle =
      modeToLineStyle(val)

    line.value.dotsColorPolicy =
      modeToDotsColorPolicy(val)

    line.value.frameTerminusNames =
      modeToTerminusFramePolicy(val)
  },
)

function updateColor(
  newColor: string | null,
) {
  if (newColor !== null) {
    line.value.color = newColor
  }
}

function setSignageStyle(
  style: SignageStyle,
) {
  signageStyle.value = style
}

function setFormatStyle(
  style: FormatStyle,
) {
  line.value.formatStyle = style
}

function setTramStyle(
  style: TramStyle,
) {
  tramStyle.value = style
}
</script>

<template>
  <div class="settings">
    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-route" />
        </div>

        <div>
          <div class="section-title">
            {{ $t('ui.general_settings.identity') }}
          </div>

          <div class="section-description">
            {{ $t('ui.general_settings.identity_summary') }}
          </div>
        </div>
      </div>

      <div class="section-content">
        <div class="setting-field">
          <label class="setting-label">
            {{ $t('ui.properties.mode') }}
          </label>

          <ModeSelect
            :model-value="
              displayedTransportMode
            "
            @update:model-value="
              setTransportMode
            "
          />

          <span
            v-if="transportService"
            class="setting-description"
          >
            {{ $t('ui.general_settings.mode_managed_before') }}
            {{
              getTransportServiceLabel(
                serviceSelection,
              )
            }}.

            {{ $t('ui.general_settings.mode_managed_after') }}
          </span>
        </div>

        <div class="setting-field">
          <label class="setting-label">
            {{ $t('ui.properties.index') }}
          </label>

          <IndexSelect
            v-model="line.index"
            :mode="line.mode"
            @update-color="updateColor"
          />
        </div>

        <div
          v-if="!transportService"
          class="setting-field"
        >
          <label class="setting-label">
            {{ $t('ui.general_settings.color_code') }}
          </label>

          <ColorSelect
            v-model="line.color"
          />
        </div>

        <div class="identity-separator">
          <span>{{ $t('ui.general_settings.or') }}</span>
        </div>

        <div class="setting-field">
          <label class="setting-label">
            {{ $t('ui.general_settings.transport_service') }}
          </label>

          <Select
            :model-value="
              serviceSelection
            "
            :options="
              transportServiceOptions
            "
            option-label="label"
            option-value="value"
            class="
              w-full
              transport-service-select
            "
            @update:model-value="
              setTransportService
            "
          >
            <template #value="slotProps">
              <div
                class="
                  transport-service-option
                  transport-service-option-value
                "
              >
                <div
                  v-if="
                    getTransportServiceIcon(
                      slotProps.value,
                    )
                  "
                  class="
                    transport-service-icon-box
                  "
                >
                  <img
                    :src="
                      getTransportServiceIcon(
                        slotProps.value,
                      )
                      ?? undefined
                    "
                    class="
                      transport-service-icon
                    "
                    alt=""
                    aria-hidden="true"
                  >
                </div>

                <div
                  v-else-if="
                    slotProps.value
                    === 'CUSTOM'
                  "
                  class="
                    transport-service-icon-box
                  "
                >
                  <i
                    class="
                      i-tabler-sparkles
                      transport-service-fallback-icon
                    "
                  />
                </div>

                <span
                  class="
                    transport-service-label
                  "
                >
                  {{
                    getTransportServiceLabel(
                      slotProps.value,
                    )
                  }}
                </span>
              </div>
            </template>

            <template #option="slotProps">
              <div
                class="
                  transport-service-option
                "
              >
                <div
                  v-if="
                    getTransportServiceIcon(
                      slotProps.option.value,
                    )
                  "
                  class="
                    transport-service-icon-box
                  "
                >
                  <img
                    :src="
                      getTransportServiceIcon(
                        slotProps.option.value,
                      )
                      ?? undefined
                    "
                    class="
                      transport-service-icon
                    "
                    alt=""
                    aria-hidden="true"
                  >
                </div>

                <div
                  v-else-if="
                    slotProps.option.value
                    === 'CUSTOM'
                  "
                  class="
                    transport-service-icon-box
                  "
                >
                  <i
                    class="
                      i-tabler-sparkles
                      transport-service-fallback-icon
                    "
                  />
                </div>

                <div
                  v-else
                  class="
                    transport-service-icon-box
                    transport-service-icon-box-empty
                  "
                />

                <span
                  class="
                    transport-service-label
                  "
                >
                  {{
                    slotProps.option.value
                    === 'CUSTOM'
                      ? $t('ui.general_settings.service_custom')
                      : slotProps.option.label
                  }}
                </span>
              </div>
            </template>
          </Select>

          <span class="setting-description">
            {{ selectedServiceOption.description }}
          </span>
        </div>

        <div
          v-if="
            transportService === 'CUSTOM'
          "
          class="custom-service-card"
        >
          <div class="custom-service-title">
            <i
              class="
                i-tabler-adjustments-star
              "
            />

            <span>
              {{ $t('ui.general_settings.custom_service_title') }}
            </span>
          </div>

          <div class="setting-field">
            <label class="setting-label">
              {{ $t('ui.general_settings.custom_service_name') }}
            </label>

            <InputText
              v-model="customServiceName"
              :placeholder="$t('ui.general_settings.custom_service_placeholder')"
            />
          </div>

          <div class="setting-field">
            <label class="setting-label">
              {{ $t('ui.general_settings.custom_service_pictogram') }}
            </label>

            <div
              v-if="customServiceIcon"
              class="
                custom-service-icon-preview
              "
            >
              <img
                :src="customServiceIcon"
                alt=""
              >

              <Button
                type="button"
                icon="i-tabler-trash"
                severity="danger"
                text
                rounded
                :title="$t('ui.general_settings.remove_pictogram')"
                @click="
                  removeCustomServiceIcon()
                "
              />
            </div>

            <label
              class="
                custom-service-upload-button
              "
            >
              <i class="i-tabler-upload" />

              <span>
                {{
                  customServiceIcon
                    ? $t('ui.general_settings.change_pictogram')
                    : $t('ui.general_settings.add_pictogram')
                }}
              </span>

              <input
                type="file"
                accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
                @change="
                  selectCustomServiceIcon
                "
              >
            </label>

            <span class="setting-description">
              {{ $t('ui.general_settings.custom_service_image_hint') }}
            </span>
          </div>

          <div class="setting-field">
            <label class="setting-label">
              {{ $t('ui.general_settings.render_type') }}
            </label>

            <Select
              v-model="
                customServiceRenderMode
              "
              :options="
                customServiceRenderOptions
              "
              option-label="label"
              option-value="value"
              class="w-full"
            />

            <span class="setting-description">
              {{ $t('ui.general_settings.render_type_hint') }}
            </span>
          </div>
        </div>

        <div
          v-if="transportService"
          class="setting-field"
        >
          <label class="setting-label">
            {{ $t('ui.general_settings.color_code') }}
          </label>

          <ColorSelect
            v-model="line.color"
          />
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-brush" />
        </div>

        <div>
          <div class="section-title">
            {{ $t('ui.general_settings.style_title') }}
          </div>

          <div class="section-description">
            {{ $t('ui.general_settings.style_summary') }}
          </div>
        </div>
      </div>

      <div class="section-content">
        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.general_settings.signage') }}
          </span>

          <div class="segmented-control">
            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  signageStyle === 'IDFM',
              }"
              @click="
                setSignageStyle('IDFM')
              "
            >
              IDFM
            </button>

            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  signageStyle === 'SNCF',
              }"
              @click="
                setSignageStyle('SNCF')
              "
            >
              SNCF
            </button>
          </div>

          <span class="setting-description">
            <template
              v-if="
                signageStyle === 'IDFM'
              "
            >
              {{ $t('ui.general_settings.signage_idfm') }}
            </template>

            <template v-else>
              {{ $t('ui.general_settings.signage_sncf') }}
            </template>
          </span>
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.general_settings.format') }}
          </span>

          <div class="segmented-control">
            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  (
                    line.formatStyle
                    ?? 'RATP'
                  ) === 'RATP',
              }"
              @click="
                setFormatStyle('RATP')
              "
            >
              RATP
            </button>

            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  line.formatStyle
                  === 'SNCF',
              }"
              @click="
                setFormatStyle('SNCF')
              "
            >
              SNCF
            </button>
          </div>

          <span class="setting-description">
            <template
              v-if="
                (
                  line.formatStyle
                  ?? 'RATP'
                ) === 'RATP'
              "
            >
              {{ $t('ui.general_settings.format_ratp') }}
            </template>

            <template v-else>
              {{ $t('ui.general_settings.format_sncf') }}
            </template>
          </span>
        </div>

        <div
          v-if="
            line.mode === 'TRAM'
          "
          class="setting-field"
        >
          <span class="setting-label">
            {{ $t('ui.general_settings.tram_style') }}
          </span>

          <div class="segmented-control">
            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  tramStyle
                  === 'ANGLED',
              }"
              @click="
                setTramStyle('ANGLED')
              "
            >
              {{ $t('ui.general_settings.tram_angled') }}
            </button>

            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  tramStyle
                  === 'HORIZONTAL',
              }"
              @click="
                setTramStyle(
                  'HORIZONTAL',
                )
              "
            >
              {{ $t('ui.general_settings.tram_horizontal') }}
            </button>
          </div>

          <span class="setting-description">
            <template
              v-if="
                tramStyle
                === 'ANGLED'
              "
            >
              {{ $t('ui.general_settings.tram_angled_hint') }}
            </template>

            <template v-else>
              {{ $t('ui.general_settings.tram_horizontal_hint') }}
            </template>
          </span>
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{
              $t(
                'ui.properties.line_thickness',
              )
            }}
          </span>

          <LineThicknessSelect
            v-model="
              line.lineThickness
            "
            @open-custom="
              emit(
                'openCustomLineThickness',
              )
            "
          />
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{
              $t(
                'ui.properties.line_style',
              )
            }}
          </span>

          <LineStyleSelect
            v-model="
              line.lineStyle
            "
          />
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{
              $t(
                'ui.properties.dots_color',
              )
            }}
          </span>

          <DotsColorSelect
            v-model="
              line.dotsColorPolicy
            "
          />
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-adjustments" />
        </div>

        <div>
          <div class="section-title">
            {{ $t('ui.general_settings.options_title') }}
          </div>

          <div class="section-description">
            {{ $t('ui.general_settings.options_summary') }}
          </div>
        </div>
      </div>

      <div class="options-list">
        <label
          for="property-fully-accessible"
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i
                class="
                  i-tabler-accessible
                "
              />
            </div>

            <span>
              {{
                $t(
                  'ui.properties.fully_accessible',
                )
              }}
            </span>
          </div>

          <Checkbox
            v-model="
              line.fullyAccessible
            "
            input-id="
              property-fully-accessible
            "
            binary
          />
        </label>

        <label
          for="property-frame-terminus-names"
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i
                class="
                  i-tabler-square-rounded
                "
              />
            </div>

            <span>
              {{
                $t(
                  'ui.properties.frame_terminus_names',
                )
              }}
            </span>
          </div>

          <Checkbox
            v-model="
              line.frameTerminusNames
            "
            input-id="
              property-frame-terminus-names
            "
            binary
          />
        </label>

        <label
          for="
            property-out-of-fare-zone-background
          "
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i
                class="
                  i-tabler-map-pin-off
                "
              />
            </div>

            <span>
              {{ $t('ui.general_settings.out_of_fare_zone_background') }}
            </span>
          </div>

          <Checkbox
            :model-value="
              line
                .showOutOfFareZoneBackground
              ?? true
            "
            input-id="
              property-out-of-fare-zone-background
            "
            binary
            @update:model-value="
              line.showOutOfFareZoneBackground
                = $event
            "
          />
        </label>

        <label
          for="property-stop-suggestions"
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i
                class="
                  i-tabler-sparkles
                "
              />
            </div>

            <div class="option-text">
              <span>
                {{ $t('ui.general_settings.stop_suggestions') }}
              </span>

              <span
                class="
                  option-description
                "
              >
                {{ $t('ui.general_settings.stop_suggestions_hint') }}
              </span>
            </div>
          </div>

          <Checkbox
            v-model="
              stopSuggestionsEnabled
            "
            input-id="
              property-stop-suggestions
            "
            binary
          />
        </label>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i
            class="
              i-tabler-arrows-maximize
            "
          />
        </div>

        <div>
          <div class="section-title">
            {{ $t('ui.general_settings.dimensions_title') }}
          </div>

          <div class="section-description">
            {{ $t('ui.general_settings.dimensions_summary') }}
          </div>
        </div>
      </div>

      <div class="section-content">
        <div class="setting-field">
          <span class="setting-label">
            {{
              $t(
                'ui.properties.size',
              )
            }}
          </span>

          <MapSizeSelect
            v-model="
              line.mapSize
            "
            @open-custom="
              emit(
                'openCustomMapSize',
              )
            "
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.settings {
  display: flex;
  flex-direction: column;
  gap: .8rem;

  padding:
    .15rem
    0
    .35rem;
}

.settings-section {
  overflow: hidden;

  border:
    1px
    solid
    var(--p-content-border-color);

  border-radius: .9rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-background)
      94%,
      transparent
    );
}

.section-header {
  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .65rem;

  padding:
    .7rem
    .75rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-content-border-color)
      70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background)
      55%,
      transparent
    );
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1.05rem;
}

.section-title {
  font-size: .9rem;
  font-weight: 700;
}

.section-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
}

.section-content {
  display: flex;
  flex-direction: column;

  gap: .85rem;

  padding: .8rem;
}

.setting-field {
  display: flex;
  flex-direction: column;

  gap: .35rem;
}

.setting-label {
  color:
    var(--p-text-color);

  font-size: .82rem;
  font-weight: 600;
}

.setting-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.35;
}

.identity-separator {
  position: relative;

  display: flex;
  align-items: center;
  justify-content: center;

  min-height: 1.25rem;

  color:
    var(--p-text-muted-color);

  font-size: .68rem;
  font-weight: 600;

  text-transform: uppercase;
}

.identity-separator::before,
.identity-separator::after {
  content: '';

  flex: 1;

  height: 1px;

  background:
    color-mix(
      in srgb,
      var(--p-content-border-color)
      70%,
      transparent
    );
}

.identity-separator span {
  padding:
    0
    .55rem;
}

.transport-service-option {
  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .55rem;

  width: 100%;
  min-width: 0;
}

.transport-service-option-value {
  min-height: 1.5rem;
}

.transport-service-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.65rem;
  height: 1.65rem;

  flex:
    0
    0
    1.65rem;
}

.transport-service-icon-box-empty {
  visibility: hidden;
}

.transport-service-icon {
  display: block;

  width: 100%;
  height: 100%;

  max-width: 1.65rem;
  max-height: 1.65rem;

  object-fit: contain;
  object-position: center;
}

.transport-service-fallback-icon {
  color:
    var(--p-text-muted-color);

  font-size: 1.25rem;
}

.transport-service-label {
  min-width: 0;

  overflow: hidden;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-service-card {
  display: flex;
  flex-direction: column;
  gap: .8rem;

  padding: .75rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .8rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background)
      35%,
      transparent
    );
}

.custom-service-title {
  display: flex;
  align-items: center;

  gap: .45rem;

  font-size: .78rem;
  font-weight: 700;
}

.custom-service-title i {
  color:
    var(--p-primary-color);

  font-size: 1rem;
}

.custom-service-icon-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: .6rem;

  min-height: 3.2rem;

  padding: .45rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .65rem;

  background:
    var(--p-content-background);
}

.custom-service-icon-preview img {
  display: block;

  max-width: 9rem;
  max-height: 2.5rem;

  object-fit: contain;
}

.custom-service-upload-button {
  display: flex;
  align-items: center;
  justify-content: center;

  gap: .45rem;

  min-height: 2.4rem;

  padding:
    .45rem
    .65rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .65rem;

  background:
    var(--p-content-background);

  color:
    var(--p-text-color);

  font-size: .75rem;
  font-weight: 600;

  cursor: pointer;

  transition:
    border-color .15s ease,
    background-color .15s ease;
}

.custom-service-upload-button:hover {
  border-color:
    var(--p-primary-color);

  background:
    var(--p-content-hover-background);
}

.custom-service-upload-button input {
  display: none;
}

.segmented-control {
  display: flex;
  flex-direction: row;
  align-items: center;

  width: 100%;

  padding: .2rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .75rem;

  background:
    var(--p-content-hover-background);
}

.segment-button {
  appearance: none;

  flex: 1;

  min-width: 0;

  padding:
    .45rem
    .7rem;

  border: 0;

  border-radius: .58rem;

  background: transparent;

  color:
    var(--p-text-muted-color);

  font-family: inherit;

  font-size: .8rem;
  font-weight: 600;

  cursor: pointer;

  transition:
    background-color .15s ease,
    color .15s ease,
    box-shadow .15s ease;
}

.segment-button:hover:not(.selected) {
  background:
    color-mix(
      in srgb,
      var(--p-content-background)
      60%,
      transparent
    );

  color:
    var(--p-text-color);
}

.segment-button.selected {
  background:
    var(--p-content-background);

  color:
    var(--p-text-color);

  box-shadow:
    0 1px 3px
    rgb(0 0 0 / 12%),
    0 1px 1px
    rgb(0 0 0 / 7%);
}

.options-list {
  display: flex;
  flex-direction: column;

  padding:
    .35rem
    .55rem;
}

.option-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  gap: .75rem;

  min-height: 3rem;

  padding:
    .45rem
    .25rem;

  cursor: pointer;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color)
      65%,
      transparent
    );
}

.option-row:last-child {
  border-bottom: 0;
}

.option-content {
  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .55rem;

  min-width: 0;

  font-size: .8rem;
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.65rem;
  height: 1.65rem;

  flex-shrink: 0;

  border-radius: .5rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .9rem;
}

.option-text {
  display: flex;
  flex-direction: column;

  gap: .1rem;
}

.option-description {
  color:
    var(--p-text-muted-color);

  font-size: .68rem;

  line-height: 1.3;
}

.setting-field
:deep(.p-select),
.setting-field
:deep(.p-inputtext),
.setting-field
:deep(.p-inputnumber),
.setting-field
:deep(.p-colorpicker) {
  width: 100%;
}
</style>