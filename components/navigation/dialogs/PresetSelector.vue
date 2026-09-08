<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useConfirm } from 'primevue/useconfirm'
import { useI18n } from 'vue-i18n'
import useVersion from '~/composables/useVersion'
import { METRO_LINES, RER_LINES, TRAM_LINES, TRANSILIEN_LINES } from '~/data/lines'
import { getPreset } from '~/data/presets'
import { useProject } from '~/stores/useProject'
import {
  modeToDotsColorPolicy,
  modeToLineStyle,
  modeToLineThickness,
  modeToTerminusFramePolicy,
} from '~/utils/properties'

const FULL_TEMPLATE = {
  METRO: ['1', '2', '3', '3bis', '4', '5', '6', '7', '7bis', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'],
  RER: ['A', 'B', 'C', 'E'],
  TRAM: ['1', '2', '3a', '3b', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
  TRAIN: ['K', 'L', 'N', 'P', 'U', 'V'],
}


const visible = defineModel<boolean>('visible')

const { line, version, presetBased } = storeToRefs(useProject())
const { applicationVersion } = useVersion()
const confirm = useConfirm()
const { t } = useI18n()

function loadFullPreset(preset: Project) {
  confirm.require({
    header: t('ui.dialogs.use_full_preset.header'),
    message: t('ui.dialogs.use_full_preset.message'),
    acceptProps: {
      label: t('ui.dialogs.use_full_preset.accept'),
      severity: 'warn',
    },
    rejectProps: {
      label: t('ui.dialogs.use_full_preset.reject'),
      severity: 'secondary',
      text: true,
    },
    accept: () => {
      presetBased.value = true
      version.value = applicationVersion
      line.value.mode = preset.line.mode
      line.value.index = preset.line.index
      line.value.color = preset.line.color
      line.value.lineThickness = preset.line.lineThickness
      line.value.lineStyle = preset.line.lineStyle
      line.value.dotsColorPolicy = preset.line.dotsColorPolicy
      line.value.fullyAccessible = preset.line.fullyAccessible
      line.value.mapSize = preset.line.mapSize
      line.value.topology = preset.line.topology
      visible.value = false
    },
  })
}

function loadPreset(_mode: Mode, _index: LineIndex, _color?: string) {
  const preset = getPreset(_mode, _index)

  if (preset !== null) {
    loadFullPreset(preset)
  } else {
    line.value.mode = _mode
    line.value.index = _index
    if (_color) line.value.color = _color
    line.value.lineThickness = modeToLineThickness(_mode)
    line.value.lineStyle = modeToLineStyle(_mode)
    line.value.dotsColorPolicy = modeToDotsColorPolicy(_mode)
    line.value.frameTerminusNames = modeToTerminusFramePolicy(_mode)
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(1050px, 96vw)' }"
    :pt="{
      root: { class: 'preset-dialog' },
      header: { class: 'preset-dialog-header' },
      content: { class: 'preset-dialog-content' },
      footer: { class: 'preset-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-blocks" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title">
            {{ $t('ui.dialogs.use_preset.header') }}
          </div>

          <div class="dialog-subtitle">
            Choisissez une ligne pour configurer rapidement votre plan.
          </div>
        </div>
      </div>
    </template>

    <div class="preset-scroll">
      <div class="preset-notice">
        <div class="preset-notice-icon">
          <i class="i-tabler-info-circle" />
        </div>

        <div class="preset-notice-text">
          {{ $t('ui.dialogs.use_preset.full_presets_notice') }}
        </div>
      </div>

      <section class="mode-card">
        <div class="mode-card-header">
          <div class="mode-card-heading">
            <div class="mode-icon">
              <i class="i-tabler-train" />
            </div>

            <div>
              <div class="mode-name">
                {{ $t('data.mode.metro') }}
              </div>

              <div class="mode-description">
                Sélectionnez une ligne de métro.
              </div>
            </div>
          </div>

          <div class="mode-count">
            {{ METRO_LINES.length }}
          </div>
        </div>

        <div class="btn-group">
          <Button
            v-for="metro in METRO_LINES"
            :key="metro.label"
            text
            severity="secondary"
            class="preset-button"
            @click="loadPreset('METRO', metro.value, metro.color)"
          >
            <div class="preset-index">
              <LineIndex
                mode="METRO"
                :index="metro.value"
              />

              <span
                v-if="FULL_TEMPLATE.METRO.includes(metro.value.$builtinLineIndex.index)"
                class="preset-badge"
                title="Préréglage complet disponible"
              />
            </div>
          </Button>
        </div>
      </section>

      <section class="mode-card">
        <div class="mode-card-header">
          <div class="mode-card-heading">
            <div class="mode-icon">
              <i class="i-tabler-letter-r" />
            </div>

            <div>
              <div class="mode-name">
                {{ $t('data.mode.rer') }}
              </div>

              <div class="mode-description">
                Sélectionnez une ligne de RER.
              </div>
            </div>
          </div>

          <div class="mode-count">
            {{ RER_LINES.length }}
          </div>
        </div>

        <div class="btn-group">
          <Button
            v-for="rer in RER_LINES"
            :key="rer.label"
            text
            severity="secondary"
            class="preset-button"
            @click="loadPreset('RER', rer.value, rer.color)"
          >
            <div class="preset-index">
              <LineIndex
                mode="RER"
                :index="rer.value"
              />

              <span
                v-if="FULL_TEMPLATE.RER.includes(rer.value.$builtinLineIndex.index)"
                class="preset-badge"
                title="Préréglage complet disponible"
              />
            </div>
          </Button>
        </div>
      </section>

      <section class="mode-card">
        <div class="mode-card-header">
          <div class="mode-card-heading">
            <div class="mode-icon">
              <i class="i-tabler-train" />
            </div>

            <div>
              <div class="mode-name">
                {{ $t('data.mode.transilien') }}
              </div>

              <div class="mode-description">
                Sélectionnez une ligne Transilien.
              </div>
            </div>
          </div>

          <div class="mode-count">
            {{ TRANSILIEN_LINES.length }}
          </div>
        </div>

        <div class="btn-group">
          <Button
            v-for="transilien in TRANSILIEN_LINES"
            :key="transilien.label"
            text
            severity="secondary"
            class="preset-button"
            @click="loadPreset('TRAIN', transilien.value, transilien.color)"
          >
            <div class="preset-index">
              <LineIndex
                mode="TRAIN"
                :index="transilien.value"
              />

              <span
                v-if="FULL_TEMPLATE.TRAIN.includes(transilien.value.$builtinLineIndex.index)"
                class="preset-badge"
                title="Préréglage complet disponible"
              />
            </div>
          </Button>
        </div>
      </section>

      <section class="mode-card">
        <div class="mode-card-header">
          <div class="mode-card-heading">
            <div class="mode-icon">
              <i class="i-tabler-tram" />
            </div>

            <div>
              <div class="mode-name">
                {{ $t('data.mode.tram') }}
              </div>

              <div class="mode-description">
                Sélectionnez une ligne de tramway.
              </div>
            </div>
          </div>

          <div class="mode-count">
            {{ TRAM_LINES.length }}
          </div>
        </div>

        <div class="btn-group">
          <Button
            v-for="tram in TRAM_LINES"
            :key="tram.label"
            text
            severity="secondary"
            class="preset-button"
            @click="loadPreset('TRAM', tram.value, tram.color)"
          >
            <div class="preset-index">
              <LineIndex
                mode="TRAM"
                :index="tram.value"
              />

              <span
                v-if="FULL_TEMPLATE.TRAM.includes(tram.value.$builtinLineIndex.index)"
                class="preset-badge"
                title="Préréglage complet disponible"
              />
            </div>
          </Button>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <i class="i-tabler-circle-filled footer-dot" />
          Les lignes avec une pastille disposent d’un préréglage complet.
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
:deep(.preset-dialog) {
  display: flex;
  flex-direction: column;
  width: min(1050px, 96vw);
  max-height: 92vh;
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 22%, transparent);
  border-radius: 22px;
  overflow: hidden;
  box-shadow:
    0 24px 70px rgb(0 0 0 / 18%),
    0 4px 16px rgb(0 0 0 / 8%);
}

:deep(.preset-dialog-header) {
  flex: 0 0 auto;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-surface-400) 18%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--p-primary-500) 12%, var(--p-dialog-background)),
      var(--p-dialog-background)
    );
}

:deep(.preset-dialog-content) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 !important;
  overflow: hidden !important;
  background: var(--p-dialog-background);
}

:deep(.preset-dialog-footer) {
  flex: 0 0 auto;
  padding: .8rem 1rem;
  border-top: 1px solid color-mix(in srgb, var(--p-surface-400) 18%, transparent);
  background: var(--p-dialog-background);
}

.dialog-heading {
  display: flex;
  align-items: center;
  gap: .85rem;
}

.dialog-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.65rem;
  height: 2.65rem;
  flex: 0 0 2.65rem;
  border-radius: 13px;
  background: color-mix(in srgb, var(--p-primary-500) 14%, transparent);
  color: var(--p-primary-500);
  font-size: 1.3rem;
}

.dialog-heading-text {
  min-width: 0;
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--p-text-color);
}

.dialog-subtitle {
  margin-top: .18rem;
  font-size: .78rem;
  color: var(--p-text-muted-color);
}

.preset-scroll {
  display: flex;
  flex-direction: column;
  gap: .85rem;
  height: 100%;
  max-height: calc(92vh - 150px);
  padding: 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.preset-notice {
  display: flex;
  align-items: flex-start;
  gap: .7rem;
  flex: 0 0 auto;
  padding: .8rem .9rem;
  border: 1px solid color-mix(in srgb, var(--p-blue-500) 24%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--p-blue-500) 7%, transparent);
}

.preset-notice-icon {
  margin-top: .05rem;
  color: var(--p-blue-500);
  font-size: 1.05rem;
}

.preset-notice-text {
  font-size: .8rem;
  line-height: 1.45;
  color: var(--p-text-color);
}

.mode-card {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 20%, transparent);
  border-radius: 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--p-surface-0) 3%, var(--p-dialog-background));
}

.mode-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .72rem .85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-surface-400) 16%, transparent);
  background: color-mix(in srgb, var(--p-surface-500) 5%, transparent);
}

.mode-card-heading {
  display: flex;
  align-items: center;
  gap: .65rem;
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--p-primary-500) 11%, transparent);
  color: var(--p-primary-500);
  font-size: 1rem;
}

.mode-name {
  font-size: .9rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.mode-description {
  margin-top: .05rem;
  font-size: .7rem;
  color: var(--p-text-muted-color);
}

.mode-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 1.6rem;
  padding: 0 .45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--p-surface-500) 11%, transparent);
  font-size: .72rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
}

.btn-group {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: .35rem;
  padding: .65rem;
}

.preset-button {
  min-width: 0;
  min-height: 4.5rem;
  padding: .35rem !important;
  border-radius: 12px !important;
  transition:
    background .15s ease,
    transform .15s ease,
    box-shadow .15s ease;
}

.preset-button:hover {
  background: color-mix(in srgb, var(--p-primary-500) 8%, transparent) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 7%);
}

.preset-index {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: 2.8rem;
}

.preset-badge {
  position: absolute;
  right: .05rem;
  bottom: .05rem;
  width: .45rem;
  height: .45rem;
  border-radius: 50%;
  background: var(--p-text-color);
  box-shadow: 0 0 0 3px var(--p-dialog-background);
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
  gap: .45rem;
  font-size: .72rem;
  color: var(--p-text-muted-color);
}

.footer-dot {
  font-size: .45rem;
  color: var(--p-text-color);
}

@media (max-width: 1024px) {
  .btn-group {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .btn-group {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .dialog-subtitle,
  .mode-description,
  .footer-hint {
    display: none;
  }

  .dialog-footer {
    justify-content: flex-end;
  }
}

@media (max-width: 520px) {
  :deep(.preset-dialog) {
    width: 96vw;
    max-height: 94vh;
  }

  .preset-scroll {
    max-height: calc(94vh - 140px);
    padding: .75rem;
  }

  .btn-group {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .preset-index {
    font-size: 2.5rem;
  }
}
</style>