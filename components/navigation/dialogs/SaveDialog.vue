<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import useSaveProject from '~/composables/useSaveProject'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useProject } from '~/stores/useProject'
import { isBuiltin } from '~/utils/types'

const visible = defineModel<boolean>('visible', { required: true })

const save = useSaveProject()
const { line } = storeToRefs(useProject())
const { findIndexById } = useCustomLineIndices()

const name = ref(`${line.value.mode}_${line.value.index}`.toLowerCase())
const lineIndex = computed(() => {
  if (line.value.index === null) return ''
  const index = line.value.index
  if (isBuiltin(index)) {
    return index.$builtinLineIndex.index
  } else {
    const customIndex = findIndexById(index.$customLineIndex.id)
    if (customIndex === null) return ''
    return (`${customIndex.prefix}${customIndex.index}${customIndex.suffix}`).toLowerCase()
  }
})

watch(visible, (val) => {
  if (val) {
    if (!line.value.mode || !line.value.index) {
      name.value = 'untitled'
      return
    }
    name.value = `${line.value.mode}_${lineIndex.value ?? 'unknown'}`.toLowerCase()
  }
})

function doExport() {
  save(name.value)
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(560px, 94vw)' }"
    :pt="{
      root: { class: 'save-dialog' },
      header: { class: 'save-dialog-header' },
      content: { class: 'save-dialog-content' },
      footer: { class: 'save-dialog-footer' },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-device-floppy" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title">
            {{ $t('ui.dialogs.save_project.header') }}
          </div>

          <div class="dialog-subtitle">
            Enregistrez votre projet CLU dans un fichier JSON.
          </div>
        </div>
      </div>
    </template>

    <div class="save-content">
      <section class="save-card">
        <div class="save-card-header">
          <div class="save-card-title">
            <div class="save-card-icon">
              <i class="i-tabler-file-text" />
            </div>

            <div>
              <div class="save-card-name">
                {{ $t('ui.dialogs.save_project.project_name') }}
              </div>

              <div class="save-card-description">
                Choisissez le nom du fichier qui sera enregistré.
              </div>
            </div>
          </div>
        </div>

        <div class="save-card-body">
          <InputGroup class="filename-group">
            <InputText
              v-model="name"
              class="filename-input"
              autocomplete="off"
            />

            <InputGroupAddon class="filename-extension">
              .json
            </InputGroupAddon>
          </InputGroup>
        </div>
      </section>

      <div class="save-notice">
        <div class="save-notice-icon">
          <i class="i-tabler-info-circle-filled" />
        </div>

        <div class="save-notice-text">
          {{ $t('ui.dialogs.save_project.custom_indices_notice') }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          :label="$t('ui.dialogs.save_project.cancel')"
          text
          severity="secondary"
          icon="i-tabler-x"
          @click="visible = false"
        />

        <Button
          :label="$t('ui.dialogs.save_project.save')"
          icon="i-tabler-device-floppy"
          @click="doExport()"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.save-dialog) {
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 22%, transparent);
  border-radius: 22px;
  overflow: hidden;
  box-shadow:
    0 24px 70px rgb(0 0 0 / 18%),
    0 4px 16px rgb(0 0 0 / 8%);
}

:deep(.save-dialog-header) {
  padding: 1.05rem 1.2rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-surface-400) 18%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--p-primary-500) 12%, var(--p-dialog-background)),
      var(--p-dialog-background)
    );
}

:deep(.save-dialog-content) {
  padding: 0 !important;
  background: var(--p-dialog-background);
}

:deep(.save-dialog-footer) {
  padding: .85rem 1rem;
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
  width: 2.7rem;
  height: 2.7rem;
  flex: 0 0 2.7rem;
  border-radius: 14px;
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

.save-content {
  display: flex;
  flex-direction: column;
  gap: .9rem;
  padding: 1rem;
}

.save-card {
  border: 1px solid color-mix(in srgb, var(--p-surface-400) 20%, transparent);
  border-radius: 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--p-surface-0) 3%, var(--p-dialog-background));
}

.save-card-header {
  padding: .8rem .9rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-surface-400) 16%, transparent);
  background: color-mix(in srgb, var(--p-surface-500) 5%, transparent);
}

.save-card-title {
  display: flex;
  align-items: center;
  gap: .7rem;
}

.save-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--p-primary-500) 10%, transparent);
  color: var(--p-primary-500);
  font-size: 1rem;
}

.save-card-name {
  font-size: .9rem;
  font-weight: 700;
  color: var(--p-text-color);
}

.save-card-description {
  margin-top: .08rem;
  font-size: .72rem;
  color: var(--p-text-muted-color);
}

.save-card-body {
  padding: .95rem;
}

.filename-group {
  width: 100%;
}

.filename-input {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.filename-extension {
  min-width: 4rem;
  justify-content: center;
  font-weight: 700;
  color: var(--p-text-muted-color);
}

.save-notice {
  display: flex;
  align-items: flex-start;
  gap: .7rem;
  padding: .85rem .9rem;
  border: 1px solid color-mix(in srgb, var(--p-blue-500) 22%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--p-blue-500) 7%, transparent);
}

.save-notice-icon {
  margin-top: .05rem;
  color: var(--p-blue-500);
  font-size: 1.05rem;
}

.save-notice-text {
  font-size: .8rem;
  line-height: 1.45;
  color: var(--p-text-color);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .65rem;
  width: 100%;
}

@media (max-width: 520px) {
  .dialog-subtitle,
  .save-card-description {
    display: none;
  }

  .save-content {
    padding: .75rem;
  }

  .dialog-footer {
    gap: .4rem;
  }
}
</style>