<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useProject } from '~/stores/useProject'
import { useSnow } from '~/stores/useSnow'

const project = useProject()
const { canUndo, canRedo } = storeToRefs(project)
const { undo, redo } = project

const { snowEnabled, isWinter } = storeToRefs(useSnow())

const showMenu = ref(false)

const showLineIndexDirectory = ref(false)
const showModePictogramsDialog = ref(false)
const showSaveDialog = ref(false)
const showCustomMapSizeDialog = ref(false)
const customMapSize = ref<string | number | null>(null)
const showCustomLineThicknessDialog = ref(false)
const customLineThickness = ref<string | null>(null)

const filePopover = ref()
const toolsPopover = ref()

function toggleFileMenu(event: Event) {
  toolsPopover.value?.hide()
  filePopover.value?.toggle(event)
}

function toggleToolsMenu(event: Event) {
  filePopover.value?.hide()
  toolsPopover.value?.toggle(event)
}

function closeFilePopover() {
  filePopover.value?.hide()
}

function openCustomIndices() {
  closeFilePopover()
  showMenu.value = false
  showLineIndexDirectory.value = true
}

function openModePictograms() {
  closeFilePopover()
  showMenu.value = false
  showModePictogramsDialog.value = true
}

function openSave() {
  closeFilePopover()
  showMenu.value = false
  showSaveDialog.value = true
}

function openCustomMapSize() {
  toolsPopover.value?.hide()
  showMenu.value = false
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
  showMenu.value = false
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

function toggleSnow() {
  snowEnabled.value = !snowEnabled.value
}
</script>

<template>
  <Menubar class="bulb-topbar">
    <template #start>
      <div class="topbar-left">
        <!--
          =====================================================
          IDENTITÉ CLU
          =====================================================
        -->
        <div class="brand">
          <h1 class="brand-title">
            <strong class="text-nowrap hidden 2xl:block">
              Créateur de Lignes Urbaines
            </strong>

            <strong class="text-nowrap 2xl:hidden visible">
              CLU
            </strong>
          </h1>
        </div>

        <!--
          =====================================================
          FICHIER / OUTILS
          =====================================================
        -->
        <div class="hidden lg:flex topbar-actions">
          <Button
            label="Fichier"
            icon="i-tabler-file"
            severity="secondary"
            text
            @click="toggleFileMenu"
          />

          <Button
            label="Outils"
            icon="i-tabler-adjustments-horizontal"
            severity="secondary"
            text
            @click="toggleToolsMenu"
          />
        </div>
      </div>

      <!--
        =====================================================
        AVANT / APRÈS
        =====================================================
      -->
      <div class="hidden lg:flex history-actions">
        <Button
          label="Avant"
          icon="i-tabler-arrow-left"
          severity="secondary"
          text
          :disabled="!canUndo"
          @click="undo"
        />

        <Button
          label="Après"
          icon="i-tabler-arrow-right"
          icon-pos="right"
          severity="secondary"
          text
          :disabled="!canRedo"
          @click="redo"
        />
      </div>
    </template>

    <template #end>
      <!--
        =====================================================
        NAVIGATION À DROITE
        =====================================================
      -->
      <div class="hidden lg:flex topbar-right">
        <TopbarPageButton
          :label="$t('ui.topbar.editor')"
          icon="i-tabler-map"
          to="/editor"
        />

        <TopbarPageButton
          :label="$t('ui.topbar.changelog')"
          icon="i-tabler-checklist"
          to="/changelog"
        />

        <Divider
          layout="vertical"
          pt:root:class="important-mx-1"
        />

        <ThemeSwitcher />

        <template v-if="isWinter">
          <Divider
            layout="vertical"
            pt:root:class="important-mx-1"
          />

          <Button
            text
            rounded
            :icon="
              snowEnabled
                ? 'i-tabler-snowflake'
                : 'i-tabler-snowflake-off'
            "
            @click="toggleSnow()"
          />
        </template>
      </div>

      <!--
        =====================================================
        MENU MOBILE
        =====================================================
      -->
      <Button
        pt:root:class="lg:important-hidden"
        icon="i-tabler-menu-2"
        severity="secondary"
        text
        rounded
        @click="showMenu = true"
      />
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
            Fichier
          </div>

          <div class="popover-subtitle">
            Projet et exportation
          </div>
        </div>
      </div>

      <Divider />

      <div class="file-menu-wrapper">
        <MainMenu
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
            Outils
          </div>

          <div class="popover-subtitle">
            Réglages généraux du plan
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
    MENU MOBILE
    =========================================================
  -->
  <Dialog
    v-model:visible="showMenu"
    header="Menu"
    pt:root:class="w-full"
    modal
  >
    <div class="mobile-menu">
      <div class="mobile-section">
        <div class="mobile-section-title">
          Fichier
        </div>

        <MainMenu
          @open-custom-indices="openCustomIndices"
          @open-mode-pictograms="openModePictograms"
          @open-save="openSave"
        />
      </div>

      <Divider />

      <div class="mobile-section">
        <div class="mobile-section-title">
          Outils
        </div>

        <GeneralMapSettings
          @open-custom-map-size="openCustomMapSize"
          @open-custom-line-thickness="openCustomLineThickness"
        />
      </div>

      <Divider />

      <TopbarPageButton
        :label="$t('ui.topbar.editor')"
        icon="i-tabler-map"
        to="/editor"
        size="large"
        @click="showMenu = false"
      />

      <TopbarPageButton
        :label="$t('ui.topbar.changelog')"
        icon="i-tabler-checklist"
        to="/changelog"
        size="large"
        @click="showMenu = false"
      />

      <Divider />

      <div class="mobile-footer">
        <ThemeSwitcher />

        <Button
          v-if="isWinter"
          text
          rounded
          :icon="
            snowEnabled
              ? 'i-tabler-snowflake'
              : 'i-tabler-snowflake-off'
          "
          @click="toggleSnow()"
        />
      </div>
    </div>
  </Dialog>

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
        label="Annuler"
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
        label="Annuler"
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

<style scoped lang="scss">
/*
 * =========================================================
 * BARRE SUPÉRIEURE
 * =========================================================
 */

.bulb-topbar {
  position: relative;
  z-index: 100;
}

.topbar-left,
.topbar-right,
.topbar-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.topbar-left {
  min-width: 0;
}

.topbar-right {
  gap: .25rem;
}

.topbar-actions {
  gap: .15rem;
}

.brand {
  display: flex;
  flex-direction: row;
  align-items: center;

  margin-right: 1rem;
}

.brand-title {
  margin: 0;

  font-size: 1.875rem;
  line-height: 1.2;
}

/*
 * =========================================================
 * AVANT / APRÈS
 * =========================================================
 */

.history-actions {
  position: absolute;
  top: 50%;
  left: 50%;

  z-index: 5;

  flex-direction: row;
  align-items: center;
  gap: .15rem;

  transform: translate(-50%, -50%);
}

/*
 * =========================================================
 * POPOVERS
 * =========================================================
 */

.popover-content {
  display: flex;
  flex-direction: column;

  padding: .15rem;
}

.file-popover-content {
  width: 22rem;
}

.tools-popover-content {
  width: 24rem;
  max-height: min(44rem, calc(100vh - 7rem));
}

.popover-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .75rem;

  padding: .35rem .35rem 0;
}

.popover-heading-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.25rem;
  height: 2.25rem;

  flex-shrink: 0;

  border-radius: .75rem;

  background:
    var(--p-content-hover-background);

  font-size: 1.2rem;
}

.popover-title {
  font-size: 1rem;
  font-weight: 700;
}

.popover-subtitle {
  margin-top: .1rem;

  color: var(--p-text-muted-color);

  font-size: .75rem;
}

.tools-settings {
  overflow-y: auto;

  padding-right: .25rem;
}

/*
 * Les libellés du menu Fichier restent alignés à gauche
 * lorsqu'ils occupent plusieurs lignes.
 */
.file-menu-wrapper {
  :deep(.p-button) {
    justify-content: flex-start;
    text-align: left;
  }

  :deep(.p-button-label) {
    flex: initial;

    white-space: normal;
    text-align: left;
  }
}

/*
 * =========================================================
 * MOBILE
 * =========================================================
 */

.mobile-menu {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.mobile-section {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.mobile-section-title {
  font-size: 1rem;
  font-weight: 700;
}

.mobile-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;

  padding: 0 .5rem;
}

/*
 * =========================================================
 * PETITS ÉCRANS
 * =========================================================
 */

@media (max-width: 1280px) {
  .brand {
    margin-right: .5rem;
  }
}
</style>