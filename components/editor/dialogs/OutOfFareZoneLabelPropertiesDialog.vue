<script setup lang="ts">
import { computed } from 'vue'
import { useProject } from '~/stores/useProject'

const visible = defineModel<boolean>('visible', {
  required: true,
})

const {
  zoneKey,
} = defineProps<{
  zoneKey: string | null
}>()

const project = useProject()

const defaultText =
  'HORS TARIFICATION ÎLE-DE-FRANCE'

function ensureRootLabel() {
  if (!project.line.outOfFareZoneLabel) {
    project.line.outOfFareZoneLabel = {
      text: defaultText,
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
      fontSize: 0.7,
      zones: {},
      positions: {},
      offsetX: 0,
      offsetY: 0,
    }
  }

  const rootLabel =
    project.line.outOfFareZoneLabel

  /*
   * L'ancien système pouvait conserver un texte global
   * quelconque, par exemple "test".
   *
   * On garde ce champ pour la compatibilité avec les
   * anciens projets, mais il ne sert plus de texte par
   * défaut aux nouvelles zones.
   */
  if (
    !rootLabel.text
    || rootLabel.text.trim().length === 0
  ) {
    rootLabel.text =
      defaultText
  }

  if (!rootLabel.zones) {
    rootLabel.zones = {}
  }

  if (!rootLabel.positions) {
    rootLabel.positions = {}
  }

  return rootLabel
}

function ensureZoneLabel() {
  const rootLabel =
    ensureRootLabel()

  if (!zoneKey) {
    return {
      text: defaultText,
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
      fontSize: 0.7,
      offsetX: 0,
      offsetY: 0,
    }
  }

  if (!rootLabel.zones![zoneKey]) {
    const legacyPosition =
      rootLabel.positions?.[zoneKey]

    /*
     * Une nouvelle zone utilise TOUJOURS la mention
     * officielle par défaut.
     *
     * On ne récupère plus rootLabel.text afin d'éviter
     * qu'un ancien texte global comme "test" soit copié.
     */
    rootLabel.zones![zoneKey] = {
      text: defaultText,

      bold:
        rootLabel.bold
        ?? true,

      italic:
        rootLabel.italic
        ?? false,

      underline:
        rootLabel.underline
        ?? false,

      color:
        rootLabel.color
        ?? '#000000',

      fontSize:
        rootLabel.fontSize
        ?? 0.7,

      offsetX:
        legacyPosition?.offsetX
        ?? rootLabel.offsetX
        ?? 0,

      offsetY:
        legacyPosition?.offsetY
        ?? rootLabel.offsetY
        ?? 0,
    }
  }

  const zoneLabel =
    rootLabel.zones![zoneKey]

  if (
    !zoneLabel.text
    || zoneLabel.text.trim().length === 0
  ) {
    zoneLabel.text =
      defaultText
  }

  return zoneLabel
}

const label = computed(
  () => ensureZoneLabel(),
)

const color = computed({
  get: () =>
    (
      label.value.color
      ?? '#000000'
    ).replace('#', ''),

  set: (value: string | undefined | null) => {
    if (!value) {
      return
    }

    label.value.color =
      value.startsWith('#')
        ? value
        : `#${value}`
  },
})

function resetText() {
  label.value.text =
    defaultText
}

function resetPosition() {
  label.value.offsetX = 0
  label.value.offsetY = 0
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="body"
    :modal="false"
    :draggable="true"
    class="out-of-fare-zone-label-properties-dialog"
  >
    <template #header>
      <span
        class="dialog-title"
        data-pc-section="title"
      >
        Mention hors zone tarifaire
      </span>
    </template>

    <div class="label-properties">
      <div class="field">
        <label class="field-label">
          Texte
        </label>

        <Textarea
          v-model="label.text"
          rows="3"
          auto-resize
        />
      </div>

      <div class="field">
        <label class="field-label">
          Style du texte
        </label>

        <div class="style-options">
          <div class="style-option">
            <Checkbox
              v-model="label.bold"
              binary
              input-id="out-of-fare-zone-label-bold"
            />

            <label for="out-of-fare-zone-label-bold">
              Gras
            </label>
          </div>

          <div class="style-option">
            <Checkbox
              v-model="label.italic"
              binary
              input-id="out-of-fare-zone-label-italic"
            />

            <label for="out-of-fare-zone-label-italic">
              Italique
            </label>
          </div>

          <div class="style-option">
            <Checkbox
              v-model="label.underline"
              binary
              input-id="out-of-fare-zone-label-underline"
            />

            <label for="out-of-fare-zone-label-underline">
              Souligné
            </label>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="field-label">
          Couleur
        </label>

        <div class="color-field">
          <ColorPicker
            v-model="color"
            format="hex"
          />

          <InputText
            v-model="color"
            class="flex-grow"
          />
        </div>
      </div>

      <div class="field">
        <label class="field-label">
          Taille du texte
        </label>

        <BInputNumber
          v-model="label.fontSize"
          :min=".25"
          :max="5"
          :step=".1"
        />
      </div>

      <div class="field">
        <div class="flex flex-wrap gap-2">
          <Button
            label="Réinitialiser le texte"
            severity="secondary"
            icon="i-tabler-refresh"
            @click="resetText"
          />

          <Button
            label="Réinitialiser la position"
            severity="secondary"
            icon="i-tabler-location"
            @click="resetPosition"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.label-properties {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  font-size: 1rem;
  font-weight: normal;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.field-label {
  font-size: .95rem;
  font-weight: 600;
}

.style-options {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1rem;
}

.style-option {
  display: flex;
  align-items: center;
  gap: .4rem;

  label {
    font-size: .9rem;
    font-weight: normal;
  }
}

.color-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;
}

:deep(textarea),
:deep(input) {
  font-size: .9rem;
  font-weight: normal;
}
</style>