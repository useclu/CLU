<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, watch } from 'vue'
import { useProject } from '~/stores/useProject'
import { cleanName } from '~/utils/text'

const {
  allowCity,
  branch,
} = defineProps<{
  allowCity: boolean
  branch: Branch
}>()

const emit = defineEmits<{
  openConnections: []
}>()

const visible = defineModel<boolean>('visible', { required: true })
const stop = defineModel<Stop>({ required: true })

const accessibilityOptions = [
  {
    label: 'ui.dialogs.stop_properties.accessible.undefined',
    value: 'undefined',
  },
  {
    label: 'ui.dialogs.stop_properties.accessible.yes',
    value: true,
  },
  {
    label: 'ui.dialogs.stop_properties.accessible.no',
    value: false,
  },
]

const stopStateOptions = [
  {
    label: 'ui.dialogs.stop_properties.stop_state.open',
    value: false,
  },
  {
    label: 'ui.dialogs.stop_properties.stop_state.close',
    value: true,
  },
]

const stopTypeOptions = [
  {
    label: 'ui.dialogs.stop_properties.stop_type.regular',
    value: false,
  },
  {
    label: 'ui.dialogs.stop_properties.stop_type.terminus',
    value: true,
  },
]

const breakpoints = useBreakpoints(breakpointsTailwind)
const horizontal = breakpoints.greaterOrEqual('lg')

function ensureNameStyle() {
  if (!stop.value.$stop.nameStyle) {
    stop.value.$stop.nameStyle = {
      bold: true,
      italic: false,
      underline: false,
      color: null,
      image: null,
      imageSize: 1,
    }
  }

  if (stop.value.$stop.nameStyle.image === undefined) {
    stop.value.$stop.nameStyle.image = null
  }

  if (stop.value.$stop.nameStyle.imageSize === undefined) {
    stop.value.$stop.nameStyle.imageSize = 1
  }
}

const nameStyle = computed(() => {
  ensureNameStyle()

  return stop.value.$stop.nameStyle!
})

watch(
  () => stop.value.id,
  () => ensureNameStyle(),
  { immediate: true },
)

watch(
  () => stop.value.$stop.name,
  val => stop.value.$stop.name = cleanName(val),
)

watch(
  () => stop.value.$stop.placeName,
  val => stop.value.$stop.placeName = cleanName(val),
)

watch(
  () => stop.value.$stop.subtitle,
  val => stop.value.$stop.subtitle = cleanName(val),
)

const customNameColor = computed({
  get: () => nameStyle.value.color ?? '#0055a4',

  set: (value: string) => {
    nameStyle.value.color = value
  },
})

const hasCustomNameColor = computed(
  () => nameStyle.value.color != null,
)

const customImage = computed(
  () => nameStyle.value.image ?? null,
)

const imageSize = computed({
  get: () => nameStyle.value.imageSize ?? 1,

  set: (value: number) => {
    nameStyle.value.imageSize = value
  },
})

function enableCustomNameColor() {
  if (!nameStyle.value.color) {
    nameStyle.value.color = '#0055a4'
  }
}

function resetNameColor() {
  nameStyle.value.color = null
}

function openImagePicker() {
  const input = document.getElementById(
    `${stop.value.id}_nameImage`,
  ) as HTMLInputElement | null

  input?.click()
}

function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    input.value = ''
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      return
    }

    nameStyle.value.image = reader.result
  }

  reader.readAsDataURL(file)

  input.value = ''
}

function removeImage() {
  nameStyle.value.image = null
}

/*
 * =========================================================
 * LIGNES DESSERVIES PAR L'ARRÊT
 * =========================================================
 *
 * "primary" représente la ligne principale du projet.
 * Les autres identifiants viennent des lignes ajoutées
 * directement à la branche.
 *
 * Un ancien arrêt qui ne possède pas encore lineIds
 * reste automatiquement affecté à la ligne principale.
 */
type MultiLineStopData = Stop['$stop'] & {
  lineIds?: string[]

  /*
   * Identité de ligne utilisée après cet arrêt.
   *
   * null / undefined = aucun changement.
   * "primary" = ligne principale du projet.
   * autre id = ligne supplémentaire de la branche.
   */
  lineAfterStopId?: string | null
}

type StopBranchLine = {
  id: string
  mode: Mode
  index: LineIndex | null
  color: string
  primary: boolean
}

const project = useProject()

const stopData = computed(() =>
  stop.value.$stop as MultiLineStopData,
)

const availableBranchLines =
  computed<StopBranchLine[]>(() => [
    ...(
      branch.$branch.additionalLines
      ?? []
    ).map(branchLine => ({
      id: branchLine.id,
      mode: branchLine.mode,
      index: branchLine.index,
      color:
        branchLine.color
        || '#000000',
      primary: false,
    })),
    {
      id: 'primary',
      mode: project.line.mode,
      index: project.line.index,
      color: project.line.color,
      primary: true,
    },
  ])

function isStopOnLine(
  lineId: string,
) {
  const stored =
    stopData.value.lineIds

  if (
    !stored
    || stored.length === 0
  ) {
    return lineId === 'primary'
  }

  return stored.includes(lineId)
}

function setStopOnLine(
  lineId: string,
  enabled: boolean,
) {
  const current =
    availableBranchLines.value
      .filter(
        line =>
          isStopOnLine(line.id),
      )
      .map(line => line.id)

  if (enabled) {
    if (!current.includes(lineId)) {
      current.push(lineId)
    }
  }
  else {
    const index =
      current.indexOf(lineId)

    /*
     * Un arrêt doit toujours appartenir
     * à au moins une ligne.
     */
    if (
      index !== -1
      && current.length > 1
    ) {
      current.splice(index, 1)
    }
  }

  stopData.value.lineIds =
    current
}

function onLineMembershipChange(
  lineId: string,
  value: boolean | undefined,
) {
  setStopOnLine(
    lineId,
    value === true,
  )
}

const selectedLineCount =
  computed(() =>
    availableBranchLines.value.filter(
      line =>
        isStopOnLine(line.id),
    ).length,
  )

/*
 * =========================================================
 * CHANGER DE LIGNE APRÈS CET ARRÊT
 * =========================================================
 *
 * La nouvelle identité est indépendante des lignes déjà
 * présentes sur la branche. Elle peut donc représenter par
 * exemple un passage RER C -> Ligne V sur le même tracé.
 */
type MultiLineStopDataWithTransition = MultiLineStopData & {
  lineAfterStopMode?: Mode | null
  lineAfterStopIndex?: LineIndex | null
  lineAfterStopColor?: string | null
}

const transitionStopData = computed(() =>
  stop.value.$stop as MultiLineStopDataWithTransition,
)

const changesLineAfterStop = computed({
  get: () =>
    transitionStopData.value.lineAfterStopMode != null,

  set: (enabled: boolean) => {
    if (!enabled) {
      transitionStopData.value.lineAfterStopId = null
      transitionStopData.value.lineAfterStopMode = null
      transitionStopData.value.lineAfterStopIndex = null
      transitionStopData.value.lineAfterStopColor = null
      return
    }

    transitionStopData.value.lineAfterStopId = null
    transitionStopData.value.lineAfterStopMode =
      project.line.mode ?? 'RER'
    transitionStopData.value.lineAfterStopIndex = null
    transitionStopData.value.lineAfterStopColor =
      project.line.color ?? '#000000'
  },
})

const lineAfterStopMode = computed<Mode | null>({
  get: () =>
    transitionStopData.value.lineAfterStopMode
    ?? null,

  set: (mode) => {
    if (!mode) {
      return
    }

    if (
      transitionStopData.value.lineAfterStopMode
      === mode
    ) {
      return
    }

    transitionStopData.value.lineAfterStopMode = mode
    transitionStopData.value.lineAfterStopIndex = null
    transitionStopData.value.lineAfterStopColor = '#000000'
    transitionStopData.value.lineAfterStopId = null
  },
})

const lineAfterStopIndex = computed<LineIndex | null>({
  get: () =>
    transitionStopData.value.lineAfterStopIndex
    ?? null,

  set: (index) => {
    transitionStopData.value.lineAfterStopIndex = index
    transitionStopData.value.lineAfterStopId = null
  },
})

function updateLineAfterStopMode(
  mode: Mode | null,
) {
  lineAfterStopMode.value = mode
}

function updateLineAfterStopColor(
  color: string | null,
) {
  if (!color) {
    return
  }

  transitionStopData.value.lineAfterStopColor = color
  transitionStopData.value.lineAfterStopId = null
}

function openConnectionsEditor() {
  emit('openConnections')
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('ui.dialogs.stop_properties.header')"
    modal
    class="stop-properties-dialog"
  >
    <div class="stop-properties">
      <!--
        =========================================================
        INFORMATIONS
        =========================================================
      -->
      <section class="properties-card information-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-map-pin" />
          </div>

          <div>
            <div class="card-title">
              Informations
            </div>

            <div class="card-description">
              Nom et informations affichées sur le plan
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_title`"
            >
              {{ $t('ui.dialogs.stop_properties.stop_name') }}
            </label>

            <Textarea
              :id="`${stop.id}_title`"
              v-model="stop.$stop.name"
              pt:root:class="important-h-auto"
              :spellcheck="false"
              auto-resize
              autofocus
            />
          </div>

          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_placeName`"
            >
              {{ $t('ui.dialogs.stop_properties.city_name') }}
            </label>

            <InputText
              :id="`${stop.id}_placeName`"
              v-model="stop.$stop.placeName"
              :spellcheck="false"
              :disabled="!stop.$stop.terminus || !allowCity"
            />

            <span
              v-if="!stop.$stop.terminus || !allowCity"
              class="field-description"
            >
              Disponible lorsque l’arrêt est un terminus compatible.
            </span>
          </div>

          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_subtitle`"
            >
              {{ $t('ui.dialogs.stop_properties.subtitle') }}
            </label>

            <InputText
              :id="`${stop.id}_subtitle`"
              v-model="stop.$stop.subtitle"
              :spellcheck="false"
            />
          </div>

          <label
            :for="`${stop.id}_preventOverlapping`"
            class="option-row compact-option"
          >
            <div class="option-content">
              <div class="option-icon">
                <i class="i-tabler-layers-subtract" />
              </div>

              <span>
                {{ $t('ui.dialogs.stop_properties.preventOverlapping') }}
              </span>
            </div>

            <Checkbox
              v-model="stop.$stop.preventSubtitleOverlapping"
              binary
              :input-id="`${stop.id}_preventOverlapping`"
            />
          </label>
        </div>
      </section>

      <!--
        =========================================================
        APPARENCE DU NOM
        =========================================================
      -->
      <section class="properties-card appearance-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-typography" />
          </div>

          <div>
            <div class="card-title">
              Apparence du nom
            </div>

            <div class="card-description">
              Typographie, couleur et logo de l’arrêt
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <span class="property-label">
              Style du texte
            </span>

            <div class="text-style-controls">
              <label
                :for="`${stop.id}_nameBold`"
                class="text-style-button"
                :class="{ active: nameStyle.bold }"
                title="Gras"
              >
                <Checkbox
                  v-model="nameStyle.bold"
                  binary
                  :input-id="`${stop.id}_nameBold`"
                  class="hidden-control"
                />

                <strong>G</strong>

                <span>Gras</span>
              </label>

              <label
                :for="`${stop.id}_nameItalic`"
                class="text-style-button"
                :class="{ active: nameStyle.italic }"
                title="Italique"
              >
                <Checkbox
                  v-model="nameStyle.italic"
                  binary
                  :input-id="`${stop.id}_nameItalic`"
                  class="hidden-control"
                />

                <em>I</em>

                <span>Italique</span>
              </label>

              <label
                :for="`${stop.id}_nameUnderline`"
                class="text-style-button"
                :class="{ active: nameStyle.underline }"
                title="Souligné"
              >
                <Checkbox
                  v-model="nameStyle.underline"
                  binary
                  :input-id="`${stop.id}_nameUnderline`"
                  class="hidden-control"
                />

                <u>S</u>

                <span>Souligné</span>
              </label>
            </div>
          </div>

          <div class="property-field">
            <span class="property-label">
              Couleur du nom
            </span>

            <div class="color-control">
              <div
                v-if="hasCustomNameColor"
                class="color-preview"
              >
                <input
                  v-model="customNameColor"
                  type="color"
                  class="name-color-picker"
                >

                <div class="color-information">
                  <span class="color-name">
                    Couleur personnalisée
                  </span>

                  <span class="color-value">
                    {{ customNameColor }}
                  </span>
                </div>
              </div>

              <Button
                v-if="!hasCustomNameColor"
                label="Personnaliser la couleur"
                severity="secondary"
                size="small"
                icon="i-tabler-palette"
                @click="enableCustomNameColor"
              />

              <Button
                v-else
                label="Couleur par défaut"
                severity="secondary"
                size="small"
                text
                icon="i-tabler-restore"
                @click="resetNameColor"
              />
            </div>
          </div>

          <div class="property-divider" />

          <div class="property-field">
            <div class="field-heading">
              <div>
                <div class="property-label">
                  Logo / image du nom
                </div>

                <div class="field-description">
                  Ajoute une image directement après le nom de l’arrêt.
                </div>
              </div>
            </div>

            <input
              :id="`${stop.id}_nameImage`"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="hidden"
              @change="onImageSelected"
            >

            <div
              v-if="customImage"
              class="image-preview-container"
            >
              <div class="image-preview">
                <img
                  :src="customImage"
                  alt="Aperçu du logo"
                >
              </div>

              <div class="image-actions">
                <div>
                  <div class="image-title">
                    Image personnalisée
                  </div>

                  <div class="field-description">
                    Enregistrée dans le projet
                  </div>
                </div>

                <div class="image-buttons">
                  <Button
                    label="Changer"
                    severity="secondary"
                    size="small"
                    icon="i-tabler-photo"
                    @click="openImagePicker"
                  />

                  <Button
                    label="Supprimer"
                    severity="danger"
                    size="small"
                    text
                    icon="i-tabler-trash"
                    @click="removeImage"
                  />
                </div>
              </div>
            </div>

            <button
              v-else
              type="button"
              class="image-empty-state"
              @click="openImagePicker"
            >
              <div class="image-empty-icon">
                <i class="i-tabler-photo-plus" />
              </div>

              <div>
                <div class="image-empty-title">
                  Choisir une image
                </div>

                <div class="field-description">
                  PNG, JPG, WEBP ou SVG
                </div>
              </div>
            </button>
          </div>

          <div
            v-if="customImage"
            class="property-field"
          >
            <div class="slider-heading">
              <label
                class="property-label"
                :for="`${stop.id}_nameImageSize`"
              >
                Taille du logo
              </label>

              <span class="slider-value">
                {{ imageSize.toFixed(1) }}×
              </span>
            </div>

            <input
              :id="`${stop.id}_nameImageSize`"
              v-model.number="imageSize"
              type="range"
              min="0.4"
              max="3"
              step="0.1"
              class="image-size-slider"
            >
          </div>
        </div>
      </section>

      <div class="properties-right-column">
      <!--
        =========================================================
        CONFIGURATION
        =========================================================
      -->
      <section class="properties-card configuration-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-adjustments-horizontal" />
          </div>

          <div>
            <div class="card-title">
              Configuration de l’arrêt
            </div>

            <div class="card-description">
              Type, état et comportement sur le plan
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.accessible.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.accessible"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="accessibilityOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.stop_state.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.closed"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="stopStateOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.stop_type.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.terminus"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="stopTypeOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="property-divider" />

          <div class="options-list">
            <label
              :for="`${stop.id}_reverse`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-arrows-exchange" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.reverse') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.reverse"
                binary
                :input-id="`${stop.id}_reverse`"
              />
            </label>

            <label
              :for="`${stop.id}_interestPoint`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-star" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.interest_point') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.interestPoint"
                binary
                :input-id="`${stop.id}_interestPoint`"
              />
            </label>

            <label
              :for="`${stop.id}_future`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-clock-plus" />
                </div>

                <div>
                  <div class="option-title">
                    Arrêt futur / en projet
                  </div>

                  <div class="option-description">
                    Affiche l’arrêt comme une extension future.
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.future"
                binary
                :input-id="`${stop.id}_future`"
              />
            </label>

            <label
              :for="`${stop.id}_vertical`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-arrows-vertical" />
                </div>

                <div>
                  <div class="option-title">
                    Arrêt vertical
                  </div>

                  <div class="option-description">
                    Utilise une forme verticale sur la ligne.
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.vertical"
                binary
                :input-id="`${stop.id}_vertical`"
              />
            </label>

            <div class="line-change-option">
              <label
                :for="`${stop.id}_changeLineAfter`"
                class="option-row"
              >
                <div class="option-content">
                  <div class="option-icon">
                    <i class="i-tabler-arrows-right-left" />
                  </div>

                  <div>
                    <div class="option-title">
                      Changer de ligne après cet arrêt
                    </div>

                    <div class="option-description">
                      Continue le même tracé avec une autre identité de ligne.
                    </div>
                  </div>
                </div>

                <Checkbox
                  v-model="changesLineAfterStop"
                  binary
                  :input-id="`${stop.id}_changeLineAfter`"
                />
              </label>

              <div
                v-if="changesLineAfterStop"
                class="line-change-inline-editor"
              >
                <div class="line-change-preview">
                  <Mode
                    v-if="lineAfterStopMode"
                    :mode="lineAfterStopMode"
                    plain
                    class="served-line-mode"
                  />

                  <LineIndex
                    v-if="lineAfterStopMode"
                    :mode="lineAfterStopMode"
                    :index="lineAfterStopIndex"
                    class="served-line-index"
                  />

                  <span>Nouvelle ligne après l’arrêt</span>
                </div>

                <div class="line-change-editor-grid">
                  <div class="property-field">
                    <label class="property-label">
                      Mode de transport
                    </label>

                    <ModeSelect
                      :model-value="lineAfterStopMode"
                      @update:model-value="updateLineAfterStopMode"
                    />
                  </div>

                  <div class="property-field">
                    <label class="property-label">
                      Indice
                    </label>

                    <IndexSelect
                      v-model="lineAfterStopIndex"
                      :mode="lineAfterStopMode"
                      @update-color="updateLineAfterStopColor"
                    />
                  </div>
                </div>

                <div class="line-change-information">
                  <i class="i-tabler-info-circle" />

                  <span>
                    Cette ligne peut être différente des lignes déjà présentes sur la branche. Sa couleur et son pictogramme sont déterminés automatiquement par le mode et l’indice choisis, y compris pour un indice personnalisé.
                  </span>
                </div>
              </div>
            </div>

            <label
              :for="`${stop.id}_outOfFareZone`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-map-pin-off" />
                </div>

                <div>
                  <div class="option-title">
                    Hors de la zone tarifaire
                  </div>

                  <div class="option-description">
                    Intègre l’arrêt à une zone hors tarification.
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.outOfFareZone"
                binary
                :input-id="`${stop.id}_outOfFareZone`"
              />
            </label>

            <label
              :for="`${stop.id}_offLine`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-eye-off" />
                </div>

                <div>
                  <div class="option-title">
                    Arrêt hors plan / atténué
                  </div>

                  <div class="option-description">
                    Atténue visuellement cette partie du tracé.
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.offLine"
                binary
                :input-id="`${stop.id}_offLine`"
              />
            </label>
          </div>
        </div>
      </section>

      <!--
        =========================================================
        LIGNES DESSERVIES
        =========================================================
      -->
      <section
        v-if="availableBranchLines.length > 1"
        class="properties-card lines-card"
      >
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-route" />
          </div>

          <div>
            <div class="card-title">
              Lignes desservies par l’arrêt
            </div>

            <div class="card-description">
              Choisis la ou les lignes sur lesquelles cet arrêt est présent
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="served-lines">
            <label
              v-for="branchLine in availableBranchLines"
              :key="branchLine.id"
              class="served-line"
              :class="{
                active:
                  isStopOnLine(
                    branchLine.id,
                  ),
              }"
            >
              <div class="served-line-identity">
                <Mode
                  :mode="branchLine.mode"
                  plain
                  class="served-line-mode"
                />

                <LineIndex
                  :mode="branchLine.mode"
                  :index="branchLine.index"
                  class="served-line-index"
                />

                <span
                  v-if="branchLine.primary"
                  class="served-line-primary"
                >
                  Ligne principale
                </span>
              </div>

              <Checkbox
                :model-value="
                  isStopOnLine(
                    branchLine.id,
                  )
                "
                binary
                :disabled="
                  isStopOnLine(
                    branchLine.id,
                  )
                  && selectedLineCount <= 1
                "
                @update:model-value="
                  value =>
                    onLineMembershipChange(
                      branchLine.id,
                      value,
                    )
                "
              />
            </label>
          </div>

          <div
            v-if="selectedLineCount > 1"
            class="shared-stop-information"
          >
            <i class="i-tabler-arrows-vertical" />

            <span>
              Arrêt commun : un seul marqueur pourra traverser les lignes sélectionnées.
            </span>
          </div>
        </div>
      </section>

      </div>

    </div>

    <!--
      =========================================================
      CORRESPONDANCES
      =========================================================
    -->
    <div class="connections-section">
      <button
        type="button"
        class="connections-button"
        @click="openConnectionsEditor"
      >
        <div class="connections-button-icon">
          <i class="i-tabler-arrows-transfer-up-down" />
        </div>

        <div class="connections-button-content">
          <div class="connections-button-title">
            Correspondances
          </div>

          <div class="connections-button-description">
            Lignes, modes de transport et temps de correspondance
          </div>
        </div>

        <i class="i-tabler-chevron-right connections-chevron" />
      </button>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.stop-properties {
  display: grid;
  grid-template-columns:
    minmax(19rem, 1fr)
    minmax(19rem, 1fr);

  align-items: start;
  gap: .8rem;

  width: min(58rem, calc(100vw - 4rem));
  max-height: calc(100vh - 13rem);

  overflow-y: auto;

  padding: .1rem .2rem .3rem .1rem;
}

/*
 * =========================================================
 * CARTES
 * =========================================================
 */

.properties-card {
  overflow: hidden;

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

.information-card {
  grid-column: 1;
}

.appearance-card {
  grid-column: 1;
}

.properties-right-column {
  grid-column: 2;
  grid-row: 1 / span 2;

  display: flex;
  flex-direction: column;
  gap: .8rem;

  min-width: 0;
}

.lines-card,
.line-change-card,
.configuration-card {
  width: 100%;
}

.card-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .65rem;

  padding: .7rem .75rem;

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

.card-icon {
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

.card-title {
  font-size: .9rem;
  font-weight: 700;
}

.card-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: .85rem;

  padding: .8rem;
}

/*
 * =========================================================
 * CHAMPS
 * =========================================================
 */

.property-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.property-label {
  color:
    var(--p-text-color);

  font-size: .82rem;
  font-weight: 600;
}

.field-description,
.option-description {
  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.3;
}

.property-field :deep(.p-inputtext),
.property-field :deep(.p-textarea),
.property-field :deep(.p-select),
.property-field :deep(.p-selectbutton) {
  width: 100%;
}

.property-divider {
  width: 100%;
  height: 1px;

  margin: .15rem 0;

  background:
    color-mix(
      in srgb,
      var(--p-content-border-color) 70%,
      transparent
    );
}

/*
 * =========================================================
 * STYLE DU TEXTE
 * =========================================================
 */

.text-style-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .35rem;
}

.text-style-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;

  min-height: 2.35rem;

  padding: .4rem .5rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .65rem;

  background:
    var(--p-content-background);

  color:
    var(--p-text-muted-color);

  font-size: .75rem;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    color .15s ease,
    box-shadow .15s ease;
}

.text-style-button:hover {
  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-color);
}

.text-style-button.active {
  border-color:
    var(--p-primary-color);

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 10%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);

  box-shadow:
    inset 0 0 0 1px
    color-mix(
      in srgb,
      var(--p-primary-color) 25%,
      transparent
    );
}

.hidden-control {
  position: absolute;

  width: 1px;
  height: 1px;

  overflow: hidden;

  opacity: 0;

  pointer-events: none;
}

/*
 * =========================================================
 * COULEUR
 * =========================================================
 */

.color-control {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;

  min-height: 2.5rem;
}

.color-preview {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .55rem;

  flex: 1;
}

.name-color-picker {
  width: 2.4rem;
  height: 2.4rem;

  flex-shrink: 0;

  padding: .15rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .6rem;

  background:
    var(--p-content-background);

  cursor: pointer;
}

.color-information {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.color-name {
  font-size: .75rem;
  font-weight: 600;
}

.color-value {
  color:
    var(--p-text-muted-color);

  font-family: monospace;
  font-size: .68rem;

  text-transform: uppercase;
}

/*
 * =========================================================
 * IMAGE
 * =========================================================
 */

.field-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}

.image-preview-container {
  display: flex;
  align-items: center;
  gap: .75rem;

  padding: .65rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 45%,
      transparent
    );
}

.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 3.8rem;
  height: 3.8rem;

  flex-shrink: 0;

  padding: .25rem;

  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .6rem;

  background:
    var(--p-content-background);

  img {
    display: block;

    max-width: 100%;
    max-height: 100%;

    object-fit: contain;
  }
}

.image-actions {
  display: flex;
  flex-direction: column;
  gap: .45rem;

  min-width: 0;

  flex: 1;
}

.image-title {
  font-size: .78rem;
  font-weight: 600;
}

.image-buttons {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: .35rem;
}

.image-empty-state {
  appearance: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .65rem;

  width: 100%;

  padding: .7rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .75rem;

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

  transition:
    background-color .15s ease,
    border-color .15s ease;
}

.image-empty-state:hover {
  border-color:
    var(--p-primary-color);

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 6%,
      var(--p-content-background)
    );
}

.image-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.2rem;
  height: 2.2rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1.1rem;
}

.image-empty-title {
  font-size: .78rem;
  font-weight: 600;
}

.slider-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.slider-value {
  padding: .15rem .4rem;

  border-radius: .4rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 600;
}

.image-size-slider {
  width: 100%;

  cursor: pointer;
}

/*
 * =========================================================
 * LIGNES DESSERVIES
 * =========================================================
 */

.served-lines {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.served-line {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;

  min-height: 3.2rem;

  padding: .45rem .55rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .7rem;

  background:
    var(--p-content-background);

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    box-shadow .15s ease;
}

.served-line:hover {
  background:
    var(--p-content-hover-background);
}

.served-line.active {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 55%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 6%,
      var(--p-content-background)
    );
}

.served-line-identity {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .45rem;

  min-width: 0;
}

.served-line-mode {
  flex-shrink: 0;
  font-size: 1.6rem;
}

.served-line-index {
  flex-shrink: 0;
  font-size: 1.9rem;
}

.served-line-primary {
  padding: .15rem .4rem;

  border-radius: .4rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .65rem;
  font-weight: 600;
}

.shared-stop-information {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .45rem;

  padding: .5rem .6rem;

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.35;
}

.shared-stop-information i {
  flex-shrink: 0;

  color:
    var(--p-primary-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * CHANGER DE LIGNE APRÈS CET ARRÊT
 * =========================================================
 */

.line-change-option {
  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    );
}

.line-change-option > .option-row {
  border-bottom: 0;
}

.line-change-inline-editor {
  display: flex;
  flex-direction: column;
  gap: .65rem;

  margin: 0 .15rem .7rem 2.3rem;
  padding: .7rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 25%,
      var(--p-content-border-color)
    );

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 4%,
      var(--p-content-background)
    );
}

.line-change-preview {
  display: flex;
  align-items: center;
  gap: .45rem;

  min-height: 2.4rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 600;
}

.line-change-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .6rem;
}

.line-change-information {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: .45rem;

  padding: .55rem .6rem;

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.35;
}

.line-change-information i {
  flex-shrink: 0;

  margin-top: .05rem;

  color:
    var(--p-primary-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * OPTIONS
 * =========================================================
 */

.options-list {
  display: flex;
  flex-direction: column;
}

.option-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  min-height: 3rem;

  padding: .5rem .15rem;

  cursor: pointer;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    );
}

.option-row:last-child {
  border-bottom: 0;
}

.compact-option {
  margin-top: .1rem;
}

.option-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .55rem;

  min-width: 0;
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.75rem;
  height: 1.75rem;

  flex-shrink: 0;

  border-radius: .5rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .9rem;
}

.option-title {
  font-size: .78rem;
  font-weight: 500;
}

/*
 * =========================================================
 * CORRESPONDANCES
 * =========================================================
 */

.connections-section {
  margin-top: .8rem;
}

.connections-button {
  appearance: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .7rem;

  width: 100%;

  padding: .7rem .8rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 35%,
      var(--p-content-border-color)
    );

  border-radius: .9rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-color);

  font-family: inherit;
  text-align: left;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    transform .15s ease;
}

.connections-button:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 60%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 11%,
      var(--p-content-background)
    );
}

.connections-button:active {
  transform: scale(.995);
}

.connections-button-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.25rem;
  height: 2.25rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-primary-color);

  color:
    var(--p-primary-contrast-color);

  font-size: 1.05rem;
}

.connections-button-content {
  display: flex;
  flex-direction: column;

  min-width: 0;

  flex: 1;
}

.connections-button-title {
  font-size: .85rem;
  font-weight: 700;
}

.connections-button-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
}

.connections-chevron {
  flex-shrink: 0;

  color:
    var(--p-text-muted-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 1024px) {
  .stop-properties {
    grid-template-columns: 1fr;

    width: min(32rem, calc(100vw - 3rem));
  }

  .information-card,
  .appearance-card,
  .properties-right-column {
    grid-column: 1;
    grid-row: auto;
  }

  .properties-right-column {
    display: flex;
    flex-direction: column;
    gap: .8rem;
  }
}

@media (max-width: 640px) {
  .stop-properties {
    width: calc(100vw - 2rem);
  }

  .text-style-controls {
    grid-template-columns: 1fr;
  }

  .line-change-editor-grid {
    grid-template-columns: 1fr;
  }

  .line-change-inline-editor {
    margin-left: .15rem;
  }

  .image-preview-container {
    align-items: flex-start;
  }
}
</style>