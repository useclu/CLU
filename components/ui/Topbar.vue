<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from '#app'
import useCluPreviewMode, { type PreviewMode } from '~/composables/useCluPreviewMode'
import { useProject } from '~/stores/useProject'
import { useSnow } from '~/stores/useSnow'

const project = useProject()
const { canUndo, canRedo } = storeToRefs(project)
const { undo, redo } = project

const { snowEnabled, isWinter } = storeToRefs(useSnow())

const route = useRoute()
const normalizedRoutePath = computed(() => route.path.replace(/\/+$/, '') || '/')
const isEditorRoute = computed(() => normalizedRoutePath.value === '/editor')
const isGameRoute = computed(() => normalizedRoutePath.value === '/game')
const {
  previewMode,
  isPreviewing,
  setPreviewMode,
  exitPreview,
} = useCluPreviewMode()
const isEditorPreview = computed(
  () => isEditorRoute.value && isPreviewing.value,
)
const isRatpEditorPreview = computed(
  () =>
    isEditorRoute.value
    && previewMode.value === 'RATP',
)
const { t } = useI18n()

const showLineIndexDirectory = ref(false)
const showModePictogramsDialog = ref(false)
const showSaveDialog = ref(false)
const showCustomMapSizeDialog = ref(false)
const customMapSize = ref<string | number | null>(null)
const showCustomLineThicknessDialog = ref(false)
const customLineThickness = ref<string | null>(null)

const filePopover = ref()
const toolsPopover = ref()
const previewPopover = ref()
const utilityPopover = ref()

const previewOptions: Array<{
  mode: PreviewMode
  labelKey: string
  icon: string
}> = [
  {
    mode: 'SNCF',
    labelKey: 'ui.map_editor.preview_mode_sncf',
    icon: 'i-tabler-train',
  },
  {
    mode: 'RATP',
    labelKey: 'ui.map_editor.preview_ratp',
    icon: 'i-tabler-route',
  },
]

function previewModeLabelKey(
  mode: PreviewMode,
) {
  return previewOptions.find(
    option => option.mode === mode,
  )?.labelKey
  ?? 'ui.map_editor.preview'
}

const previewButtonLabel = computed(() => {
  if (!previewMode.value) {
    return t('ui.map_editor.preview')
  }

  return t(
    'ui.map_editor.preview_current',
    {
      mode: t(
        previewModeLabelKey(
          previewMode.value,
        ),
      ),
    },
  )
})

function toggleFileMenu(event: Event) {
  toolsPopover.value?.hide()
  previewPopover.value?.hide()
  utilityPopover.value?.hide()
  filePopover.value?.toggle(event)
}

function toggleToolsMenu(event: Event) {
  filePopover.value?.hide()
  previewPopover.value?.hide()
  utilityPopover.value?.hide()
  toolsPopover.value?.toggle(event)
}

function closeFilePopover() {
  filePopover.value?.hide()
}

function openCustomIndices() {
  closeFilePopover()
  showLineIndexDirectory.value = true
}

function openModePictograms() {
  closeFilePopover()
  showModePictogramsDialog.value = true
}

function openSave() {
  closeFilePopover()
  showSaveDialog.value = true
}

function openCustomMapSize() {
  toolsPopover.value?.hide()
  customMapSize.value = project.line.mapSize
  showCustomMapSizeDialog.value = true
}

function cancelCustomMapSize() {
  showCustomMapSizeDialog.value = false
  customMapSize.value = project.line.mapSize
}

function applyCustomMapSize() {
  if (
    customMapSize.value === null
    || customMapSize.value === ''
  ) {
    cancelCustomMapSize()
    return
  }

  project.line.mapSize = customMapSize.value
  showCustomMapSizeDialog.value = false
}

function openCustomLineThickness() {
  toolsPopover.value?.hide()
  customLineThickness.value = project.line.lineThickness
  showCustomLineThicknessDialog.value = true
}

function cancelCustomLineThickness() {
  showCustomLineThicknessDialog.value = false
  customLineThickness.value = project.line.lineThickness
}

function applyCustomLineThickness() {
  if (
    customLineThickness.value === null
    || customLineThickness.value === ''
  ) {
    cancelCustomLineThickness()
    return
  }

  project.line.lineThickness = customLineThickness.value
  showCustomLineThicknessDialog.value = false
}

function togglePreviewMenu(event: Event) {
  filePopover.value?.hide()
  toolsPopover.value?.hide()
  utilityPopover.value?.hide()
  previewPopover.value?.toggle(event)
}

function toggleUtilityMenu(event: Event) {
  filePopover.value?.hide()
  toolsPopover.value?.hide()
  previewPopover.value?.hide()
  utilityPopover.value?.toggle(event)
}

function closeUtilityMenu() {
  utilityPopover.value?.hide()
}

function selectPreviewMode(
  mode: PreviewMode,
) {
  setPreviewMode(mode)

  filePopover.value?.hide()
  toolsPopover.value?.hide()
  previewPopover.value?.hide()
  utilityPopover.value?.hide()
}


function returnToEditing() {
  exitPreview()
  previewPopover.value?.hide()
}


function toggleSnow() {
  snowEnabled.value = !snowEnabled.value
}
</script>

<template>
  <template v-if="!isGameRoute">
    <Menubar class="bulb-topbar">
      <template #start>
        <div class="topbar-shell">
          <div class="topbar-primary">
            <div class="brand">
              <h1 class="brand-title">
                <strong class="brand-full">
                  {{ $t('ui.topbar.brand') }}
                </strong>
                <strong class="brand-short">CLU</strong>
              </h1>
            </div>

            <div class="topbar-actions">
              <Button
                :label="$t('ui.topbar.file')"
                icon="i-tabler-file"
                severity="secondary"
                text
                size="small"
                @click="toggleFileMenu"
              />

              <Button
                v-if="!isEditorPreview"
                :label="$t('ui.topbar.tools')"
                icon="i-tabler-adjustments-horizontal"
                severity="secondary"
                text
                size="small"
                @click="toggleToolsMenu"
              />

              <Button
                v-if="isEditorRoute"
                :label="previewButtonLabel"
                icon="i-tabler-eye"
                :severity="isEditorPreview ? 'primary' : 'secondary'"
                text
                size="small"
                @click="togglePreviewMenu"
              />
            </div>
          </div>

          <div
            v-if="!isEditorPreview"
            class="history-actions"
          >
            <Button
              :label="$t('ui.topbar.undo')"
              icon="i-tabler-arrow-left"
              severity="secondary"
              text
              size="small"
              :disabled="!canUndo"
              @click="undo"
            />

            <Button
              :label="$t('ui.topbar.redo')"
              icon="i-tabler-arrow-right"
              icon-pos="right"
              severity="secondary"
              text
              size="small"
              :disabled="!canRedo"
              @click="redo"
            />
          </div>

          <div class="topbar-right">
            <!--
              Desktop : on conserve les accès directs historiques.
              Ils ne sont rangés dans le menu = que sur tablette/mobile.
            -->
            <div class="desktop-page-actions">
              <TopbarPageButton
                :label="$t('ui.topbar.editor')"
                icon="i-tabler-map"
                to="/editor"
              />

              <TopbarPageButton
                v-if="isEditorRoute"
                :label="$t('ui.topbar.metropole')"
                icon="i-tabler-train"
                to="/game"
              />
            </div>

            <div
              v-if="!isEditorPreview"
              class="compact-history-actions"
            >
              <Button
                :label="$t('ui.topbar.undo')"
                icon="i-tabler-arrow-left"
                severity="secondary"
                text
                size="small"
                :disabled="!canUndo"
                :title="$t('ui.topbar.undo')"
                @click="undo"
              />

              <Button
                :label="$t('ui.topbar.redo')"
                icon="i-tabler-arrow-right"
                icon-pos="right"
                severity="secondary"
                text
                size="small"
                :disabled="!canRedo"
                :title="$t('ui.topbar.redo')"
                @click="redo"
              />
            </div>

            <Button
              class="unified-menu-button"
              label="="
              severity="secondary"
              text
              rounded
              :aria-label="$t('ui.topbar.utility_menu')"
              :title="$t('ui.topbar.utility_menu')"
              @click="toggleUtilityMenu"
            />

            <Button
              v-if="isWinter"
              class="winter-action"
              text
              rounded
              :icon="snowEnabled ? 'i-tabler-snowflake' : 'i-tabler-snowflake-off'"
              @click="toggleSnow()"
            />
          </div>
        </div>
      </template>
    </Menubar>

  <!--
    =========================================================
    MENU FICHIER
    =========================================================
  -->
  <Popover
    ref="filePopover"
    class="topbar-popover"
  >
    <div class="popover-content file-popover-content">
      <div class="popover-heading">
        <div class="popover-heading-icon">
          <i class="i-tabler-file" />
        </div>

        <div>
          <div class="popover-title">
            {{ $t('ui.topbar.file') }}
          </div>

          <div class="popover-subtitle">
            {{ $t('ui.topbar.file_subtitle') }}
          </div>
        </div>
      </div>

      <Divider />

      <div class="file-menu-wrapper">
        <MainMenu
          :preview-limited="isRatpEditorPreview"
          @open-custom-indices="openCustomIndices"
          @open-mode-pictograms="openModePictograms"
          @open-save="openSave"
        />
      </div>
    </div>
  </Popover>

  <!--
    =========================================================
    MENU OUTILS
    =========================================================
  -->
  <Popover
    ref="toolsPopover"
    class="topbar-popover"
  >
    <div class="popover-content tools-popover-content">
      <div class="popover-heading">
        <div class="popover-heading-icon">
          <i class="i-tabler-adjustments-horizontal" />
        </div>

        <div>
          <div class="popover-title">
            {{ $t('ui.topbar.tools') }}
          </div>

          <div class="popover-subtitle">
            {{ $t('ui.topbar.tools_subtitle') }}
          </div>
        </div>
      </div>

      <Divider />

      <div class="tools-settings">
        <GeneralMapSettings
          @open-custom-map-size="openCustomMapSize"
          @open-custom-line-thickness="openCustomLineThickness"
        />
      </div>
    </div>
  </Popover>

  <!--
    =========================================================
    CHOIX DE PRÉVISUALISATION
    =========================================================
  -->
  <Popover
    ref="previewPopover"
    class="topbar-popover"
  >
    <div class="popover-content preview-popover-content">
      <div class="popover-heading">
        <div class="popover-heading-icon">
          <i class="i-tabler-eye" />
        </div>

        <div>
          <div class="popover-title">
            {{ $t('ui.map_editor.preview_title') }}
          </div>

          <div class="popover-subtitle">
            {{ $t('ui.map_editor.preview_subtitle') }}
          </div>
        </div>
      </div>

      <Divider />

      <div class="preview-options">
        <Button
          v-for="option in previewOptions"
          :key="option.mode"
          :label="$t(option.labelKey)"
          :icon="option.icon"
          :severity="
            previewMode === option.mode
              ? 'primary'
              : 'secondary'
          "
          text
          @click="selectPreviewMode(option.mode)"
        />
      </div>

      <template v-if="isEditorPreview">
        <Divider />

        <Button
          :label="$t('ui.map_editor.back_to_editing')"
          icon="i-tabler-edit"
          severity="secondary"
          text
          @click="returnToEditing"
        />
      </template>
    </div>
  </Popover>

  <!--
    =========================================================
    RÉSEAUX / THÈME / TRADUCTION
    =========================================================
  -->
  <Popover
    ref="utilityPopover"
    class="topbar-popover"
  >
    <div class="popover-content utility-popover-content">
      <NuxtLink
        class="utility-menu-link"
        to="/editor"
        @click="closeUtilityMenu"
      >
        <i class="i-tabler-map" />
        <span>{{ $t('ui.topbar.editor') }}</span>
      </NuxtLink>

      <NuxtLink
        class="utility-menu-link"
        to="/game"
        @click="closeUtilityMenu"
      >
        <i class="i-tabler-train" />
        <span>{{ $t('ui.topbar.metropole') }}</span>
      </NuxtLink>

      <Divider />

      <a
        class="utility-menu-link"
        href="https://x.com/Bot_CLU"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X (Twitter)"
        @click="closeUtilityMenu"
      >
        <i class="i-tabler-brand-x" />
        <span>{{ $t('ui.topbar.twitter') }}</span>
      </a>

      <a
        class="utility-menu-link"
        href="https://discord.gg/EPt3scCQH8"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="$t('ui.topbar.discord_join')"
        @click="closeUtilityMenu"
      >
        <i class="i-tabler-brand-discord" />
        <span>{{ $t('ui.topbar.discord') }}</span>
      </a>

      <Divider />

      <div class="utility-setting-row">
        <div class="utility-setting-label">
          <i class="i-tabler-palette" />
          <span>{{ $t('ui.topbar.theme') }}</span>
        </div>

        <ThemeSwitcher />
      </div>

      <div class="utility-setting-row">
        <div class="utility-setting-label">
          <i class="i-tabler-language" />
          <span>{{ $t('ui.topbar.language') }}</span>
        </div>

        <LocaleSwitcher />
      </div>
    </div>
  </Popover>

  <!--
    =========================================================
    FENÊTRES DU MENU FICHIER

    Elles sont volontairement placées EN DEHORS du Popover.
    Ainsi, fermer le menu Fichier ne détruit plus la fenêtre
    actuellement ouverte.
    =========================================================
  -->
  <CustomLineIndexDirectoryDialog
    v-model:visible="showLineIndexDirectory"
  />

  <CustomModePictogramsDialog
    v-model:visible="showModePictogramsDialog"
  />

  <SaveDialog
    v-model:visible="showSaveDialog"
  />

  <!--
    =========================================================
    FENÊTRE DE TAILLE PERSONNALISÉE

    Cette fenêtre reste volontairement en dehors du Popover
    Outils. Elle n'est donc pas détruite lorsque le Popover
    se ferme.
    =========================================================
  -->
  <Dialog
    v-model:visible="showCustomMapSizeDialog"
    :header="$t('ui.dialogs.custom_map_size.header')"
    modal
    append-to="body"
    :dismissable-mask="false"
    @hide="customMapSize = project.line.mapSize"
  >
    <InputGroup>
      <BInputNumber
        v-model="customMapSize"
        class="w-full"
      />

      <InputGroupAddon>
        <span>em</span>
      </InputGroupAddon>
    </InputGroup>

    <template #footer>
      <Button
        :label="$t('ui.common.cancel')"
        severity="secondary"
        @click="cancelCustomMapSize"
      />

      <Button
        :label="$t('ui.dialogs.custom_map_size.accept')"
        @click="applyCustomMapSize"
      />
    </template>
  </Dialog>

  <!--
    =========================================================
    FENÊTRE D'ÉPAISSEUR PERSONNALISÉE

    Comme la fenêtre de taille personnalisée, elle reste
    volontairement en dehors du Popover Outils.
    =========================================================
  -->
  <Dialog
    v-model:visible="showCustomLineThicknessDialog"
    :header="$t('ui.dialogs.custom_line_thickness.header')"
    modal
    append-to="body"
    :dismissable-mask="false"
    @hide="customLineThickness = project.line.lineThickness"
  >
    <InputGroup>
      <BInputNumber
        v-model="customLineThickness"
        class="w-full"
      />

      <InputGroupAddon>
        <span>em</span>
      </InputGroupAddon>
    </InputGroup>

    <template #footer>
      <Button
        :label="$t('ui.common.cancel')"
        severity="secondary"
        @click="cancelCustomLineThickness"
      />

      <Button
        :label="$t('ui.dialogs.custom_line_thickness.accept')"
        @click="applyCustomLineThickness"
      />
    </template>
  </Dialog>
  </template>
</template>

<style scoped lang="scss">
.bulb-topbar {
  position: relative;
  z-index: 100;

  padding: .3rem .45rem;
}

.bulb-topbar :deep(.p-menubar-start) {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.bulb-topbar :deep(.p-menubar-root-list),
.bulb-topbar :deep(.p-menubar-button) {
  display: none !important;
}

.topbar-shell {
  width: 100%;
  min-width: 0;

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-areas: 'primary history right';
  align-items: center;
  gap: .5rem;
}

.topbar-primary {
  grid-area: primary;

  min-width: 0;

  display: flex;
  align-items: center;
  gap: .55rem;
}

.brand {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.brand-title {
  margin: 0;
  line-height: 1;
}

.brand-full,
.brand-short {
  white-space: nowrap;
}

.brand-full {
  display: none;
  font-size: 1.25rem;
}

.brand-short {
  display: inline;
  font-size: 1.45rem;
}

.topbar-actions,
.topbar-right,
.history-actions,
.compact-history-actions,
.desktop-page-actions {
  display: flex;
  align-items: center;
}

.compact-history-actions {
  display: none;
  gap: .05rem;
}

.desktop-page-actions {
  gap: .12rem;
}

.topbar-actions {
  min-width: 0;
  gap: .05rem;
}

.topbar-actions :deep(.p-button) {
  min-height: 2.25rem;
  padding-inline: .55rem;
}

.topbar-actions :deep(.p-button-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-actions {
  grid-area: history;
  gap: .05rem;
}

.topbar-right {
  grid-area: right;
  justify-content: flex-end;
  gap: .15rem;
  min-width: 0;
}

.unified-menu-button,
.winter-action {
  width: 2.35rem;
  min-width: 2.35rem;
  height: 2.35rem;
}

.unified-menu-button {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
}

/* Popovers */
.popover-content {
  display: flex;
  flex-direction: column;
  padding: .15rem;
}

.file-popover-content,
.preview-popover-content {
  width: min(22rem, calc(100vw - 1rem));
}

.tools-popover-content {
  width: min(24rem, calc(100vw - 1rem));
  max-height: min(44rem, calc(100dvh - 5rem));
}

.utility-popover-content {
  width: min(15.5rem, calc(100vw - 1rem));
  gap: .15rem;
}

.preview-options {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.preview-options :deep(.p-button) {
  justify-content: flex-start;
}

.popover-heading {
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: .25rem .25rem 0;
}

.popover-heading-icon {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: .65rem;
  background: var(--p-content-hover-background);
  font-size: 1.05rem;
}

.popover-title {
  font-size: .95rem;
  font-weight: 700;
}

.popover-subtitle {
  margin-top: .05rem;
  color: var(--p-text-muted-color);
  font-size: .72rem;
}

.tools-settings {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: .2rem;
}

.file-menu-wrapper :deep(.p-button) {
  justify-content: flex-start;
  text-align: left;
}

.file-menu-wrapper :deep(.p-button-label) {
  flex: initial;
  white-space: normal;
  text-align: left;
}

.utility-menu-link,
.utility-setting-row {
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  border-radius: .5rem;
  color: var(--p-text-color);
  text-decoration: none;
}

.utility-menu-link {
  gap: .7rem;
  padding: .5rem .7rem;
  transition: background-color .15s ease;
}

.utility-menu-link:hover {
  background: var(--p-content-hover-background);
}

.utility-menu-link:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.utility-menu-link > i,
.utility-setting-label > i {
  width: 1.2rem;
  flex-shrink: 0;
  font-size: 1.1rem;
  text-align: center;
}

.utility-setting-row {
  justify-content: space-between;
  gap: .65rem;
  padding: .25rem .3rem .25rem .7rem;
}

.utility-setting-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: .7rem;
}

/* Ordinateurs larges */
@media (min-width: 1536px) {
  .brand-full { display: inline; }
  .brand-short { display: none; }
}

/* Tablettes / petits portables : aucun Avant/Après au milieu. */
@media (max-width: 1280px) {
  .topbar-shell {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'primary right';
  }

  .history-actions {
    display: none;
  }

  .compact-history-actions {
    display: flex;
  }

  .compact-history-actions :deep(.p-button) {
    min-height: 2.35rem;
    padding-inline: .5rem;
  }
}

@media (max-width: 1100px) {
  .desktop-page-actions {
    display: none;
  }
}

/* Téléphones : 1re ligne navigation, 2e ligne Fichier/Outils/Prévisualiser. */
@media (max-width: 720px) {
  .bulb-topbar {
    padding: .25rem .35rem;
  }

  .topbar-shell {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'brand right'
      'actions actions';
    row-gap: .2rem;
  }

  .topbar-primary {
    display: contents;
  }

  .brand {
    grid-area: brand;
    min-width: 0;
  }

  .brand-short {
    font-size: 1.35rem;
  }

  .topbar-actions {
    grid-area: actions;
    width: 100%;

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: .15rem;
  }

  .topbar-actions :deep(.p-button) {
    width: 100%;
    min-width: 0;
    min-height: 2.15rem;
    padding: .35rem .35rem;
    justify-content: center;
  }

  .topbar-actions :deep(.p-button-label) {
    min-width: 0;
    font-size: .74rem;
  }

  .topbar-actions :deep(.p-button-icon) {
    font-size: .95rem;
  }

  .topbar-right {
    gap: .05rem;
  }

  .unified-menu-button,
  .winter-action {
    width: 2.15rem;
    min-width: 2.15rem;
    height: 2.15rem;
  }

  .compact-history-actions :deep(.p-button) {
    width: 2.15rem;
    min-width: 2.15rem;
    height: 2.15rem;
    padding: 0;
    justify-content: center;
  }

  .compact-history-actions :deep(.p-button-label) {
    display: none;
  }

  .unified-menu-button {
    font-size: 1.1rem;
  }

  .popover-heading {
    gap: .5rem;
  }

  .popover-subtitle {
    display: none;
  }
}

@media (max-width: 390px) {
  .topbar-actions :deep(.p-button-label) {
    font-size: .68rem;
  }

  .topbar-actions :deep(.p-button) {
    gap: .25rem;
    padding-inline: .2rem;
  }
}
</style>