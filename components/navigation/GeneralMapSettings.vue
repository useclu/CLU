<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useProject } from '~/stores/useProject'
import {
  modeToDotsColorPolicy,
  modeToLineStyle,
  modeToLineThickness,
  modeToTerminusFramePolicy,
} from '~/utils/properties'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const { line } = storeToRefs(useProject())

const emit = defineEmits<{
  openCustomMapSize: []
  openCustomLineThickness: []
}>()

const tramStyle = computed<TramStyle>({
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

watch(() => line.value.mode, (val) => {
  if (!val) return

  line.value.lineThickness = modeToLineThickness(val)
  line.value.lineStyle = modeToLineStyle(val)
  line.value.dotsColorPolicy = modeToDotsColorPolicy(val)
  line.value.frameTerminusNames = modeToTerminusFramePolicy(val)
})

function updateColor(newColor: string | null) {
  if (newColor !== null) line.value.color = newColor
}

function setFormatStyle(style: FormatStyle) {
  line.value.formatStyle = style
}

function setTramStyle(style: TramStyle) {
  tramStyle.value = style
}
</script>

<template>
  <div class="settings">
    <!--
      =========================================================
      IDENTITÉ DE LA LIGNE
      =========================================================
    -->
    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-route" />
        </div>

        <div>
          <div class="section-title">
            Identité de la ligne
          </div>

          <div class="section-description">
            Mode, indice et couleur principale
          </div>
        </div>
      </div>

      <div class="section-content">
        <div class="setting-field">
          <label class="setting-label">
            {{ $t('ui.properties.mode') }}
          </label>

          <ModeSelect v-model="line.mode" />
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

        <div class="setting-field">
          <label class="setting-label">
            {{ $t('ui.properties.color') }}
          </label>

          <ColorSelect v-model="line.color" />
        </div>
      </div>
    </section>

    <!--
      =========================================================
      STYLE DU PLAN
      =========================================================
    -->
    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-brush" />
        </div>

        <div>
          <div class="section-title">
            Style du plan
          </div>

          <div class="section-description">
            Apparence générale de la ligne
          </div>
        </div>
      </div>

      <div class="section-content">
        <!--
          =====================================================
          FORMAT RATP / SNCF
          =====================================================
        -->
        <div class="setting-field">
          <span class="setting-label">
            Format
          </span>

          <div class="segmented-control">
            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  (line.formatStyle ?? 'RATP') === 'RATP',
              }"
              @click="setFormatStyle('RATP')"
            >
              RATP
            </button>

            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  line.formatStyle === 'SNCF',
              }"
              @click="setFormatStyle('SNCF')"
            >
              SNCF
            </button>
          </div>

          <span class="setting-description">
            <template
              v-if="
                (line.formatStyle ?? 'RATP') === 'RATP'
              "
            >
              Noms bleus et gras
            </template>

            <template v-else>
              Noms noirs · terminus en gras
            </template>
          </span>
        </div>

        <!--
          =====================================================
          STYLE TRAMWAY
          =====================================================
        -->
        <div
          v-if="line.mode === 'TRAM'"
          class="setting-field"
        >
          <span class="setting-label">
            Style tramway
          </span>

          <div class="segmented-control">
            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  tramStyle === 'ANGLED',
              }"
              @click="setTramStyle('ANGLED')"
            >
              Incliné
            </button>

            <button
              type="button"
              class="segment-button"
              :class="{
                selected:
                  tramStyle === 'HORIZONTAL',
              }"
              @click="setTramStyle('HORIZONTAL')"
            >
              Horizontal
            </button>
          </div>

          <span class="setting-description">
            <template
              v-if="tramStyle === 'ANGLED'"
            >
              Noms inclinés · ligne fine · petits arrêts
            </template>

            <template v-else>
              Noms horizontaux · ligne épaisse · grands anneaux
            </template>
          </span>
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.properties.line_thickness') }}
          </span>

          <LineThicknessSelect
            v-model="line.lineThickness"
            @open-custom="emit('openCustomLineThickness')"
          />
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.properties.line_style') }}
          </span>

          <LineStyleSelect
            v-model="line.lineStyle"
          />
        </div>

        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.properties.dots_color') }}
          </span>

          <DotsColorSelect
            v-model="line.dotsColorPolicy"
          />
        </div>
      </div>
    </section>

    <!--
      =========================================================
      OPTIONS
      =========================================================
    -->
    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-adjustments" />
        </div>

        <div>
          <div class="section-title">
            Options
          </div>

          <div class="section-description">
            Affichage et accessibilité
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
              <i class="i-tabler-accessible" />
            </div>

            <span>
              {{ $t('ui.properties.fully_accessible') }}
            </span>
          </div>

          <Checkbox
            v-model="line.fullyAccessible"
            input-id="property-fully-accessible"
            binary
          />
        </label>

        <label
          for="property-frame-terminus-names"
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i class="i-tabler-square-rounded" />
            </div>

            <span>
              {{ $t('ui.properties.frame_terminus_names') }}
            </span>
          </div>

          <Checkbox
            v-model="line.frameTerminusNames"
            input-id="property-frame-terminus-names"
            binary
          />
        </label>

        <label
          for="property-out-of-fare-zone-background"
          class="option-row"
        >
          <div class="option-content">
            <div class="option-icon">
              <i class="i-tabler-map-pin-off" />
            </div>

            <span>
              Afficher le fond gris hors zone tarifaire
            </span>
          </div>

          <Checkbox
            :model-value="
              line.showOutOfFareZoneBackground ?? true
            "
            input-id="property-out-of-fare-zone-background"
            binary
            @update:model-value="
              line.showOutOfFareZoneBackground = $event
            "
          />
        </label>
      </div>
    </section>

    <!--
      =========================================================
      DIMENSIONS
      =========================================================
    -->
    <section class="settings-section">
      <div class="section-header">
        <div class="section-icon">
          <i class="i-tabler-arrows-maximize" />
        </div>

        <div>
          <div class="section-title">
            Dimensions
          </div>

          <div class="section-description">
            Taille générale du plan
          </div>
        </div>
      </div>

      <div class="section-content">
        <div class="setting-field">
          <span class="setting-label">
            {{ $t('ui.properties.size') }}
          </span>

          <MapSizeSelect
            v-model="line.mapSize"
            @open-custom="emit('openCustomMapSize')"
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

  padding: .15rem 0 .35rem;
}

/*
 * =========================================================
 * SECTIONS
 * =========================================================
 */

.settings-section {
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

.section-header {
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

/*
 * =========================================================
 * CHAMPS
 * =========================================================
 */

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
}

/*
 * =========================================================
 * CONTRÔLES SEGMENTÉS
 * =========================================================
 */

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

  padding: .45rem .7rem;

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
      var(--p-content-background) 60%,
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
    0 1px 3px rgb(0 0 0 / 12%),
    0 1px 1px rgb(0 0 0 / 7%);
}

/*
 * =========================================================
 * OPTIONS
 * =========================================================
 */

.options-list {
  display: flex;
  flex-direction: column;

  padding: .35rem .55rem;
}

.option-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  min-height: 3rem;

  padding: .45rem .25rem;

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

/*
 * =========================================================
 * COMPOSANTS INTERNES
 * =========================================================
 */

.setting-field :deep(.p-select),
.setting-field :deep(.p-inputtext),
.setting-field :deep(.p-inputnumber),
.setting-field :deep(.p-colorpicker) {
  width: 100%;
}
</style>