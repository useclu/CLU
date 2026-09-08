<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useI18n } from 'vue-i18n'
import OpenPresetButton from '~/components/navigation/menu/OpenPresetButton.vue'
import useLoadProject from '~/composables/useLoadProject'
import { useProject } from '~/stores/useProject'

const emit = defineEmits<{
  openCustomIndices: []
  openModePictograms: []
  openSave: []
}>()

const { reset } = useProject()

const importProject = useLoadProject()

const confirm = useConfirm()
const { t } = useI18n()

function newProject() {
  confirm.require({
    header: t('ui.dialogs.new_project.header'),
    message: t('ui.dialogs.new_project.message'),
    acceptProps: {
      label: t('ui.dialogs.new_project.accept'),
      severity: 'warn',
    },
    rejectProps: {
      label: t('ui.dialogs.new_project.reject'),
      severity: 'secondary',
      text: true,
    },
    accept: reset,
  })
}
</script>

<template>
  <div class="flex flex-col items-stretch flex-grow">
    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.custom_indices')"
      severity="secondary"
      icon="i-tabler-route"
      text
      @click="emit('openCustomIndices')"
    />

    <Button
      pt:root:class="important-justify-start"
      label="Changer les pictogrammes des modes de transport"
      severity="secondary"
      icon="i-tabler-photo-edit"
      text
      @click="emit('openModePictograms')"
    />

    <Divider />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.new_project')"
      severity="secondary"
      icon="i-tabler-file-spark"
      text
      @click="newProject()"
    />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.open')"
      severity="secondary"
      icon="i-tabler-folder-open"
      text
      @click="importProject()"
    />

    <OpenPresetButton />

    <Button
      pt:root:class="important-justify-start"
      :label="$t('ui.menu.save')"
      severity="secondary"
      icon="i-tabler-device-floppy"
      text
      @click="emit('openSave')"
    />

    <ExportPngButton />
    <ExportPdfButton />
  </div>
</template>