<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'

const visible = defineModel<boolean>('visible')
const { t } = useI18n()

const customLineIndices = useCustomLineIndices()

const { indices } = storeToRefs(customLineIndices)

const {
  createNewIndex,
  deleteById,
} = customLineIndices

const editorVisible = ref(false)
const editedIndex = ref<CustomLineIndexDescription | null>(null)

const modes = computed(() => [
  { value: 'RER' as Mode, label: t('data.mode.rer') },
  { value: 'TRAIN' as Mode, label: t('data.mode.transilien') },
  { value: 'TRAM' as Mode, label: t('data.mode.tram') },
  { value: 'METRO' as Mode, label: t('data.mode.metro') },
  { value: 'CABLE' as Mode, label: t('data.mode.cable') },
  { value: 'BUS' as Mode, label: t('data.mode.bus') },
  { value: 'BRT' as Mode, label: t('data.mode.brt') },
  { value: 'NOCTILIEN' as Mode, label: t('data.mode.noctilien') },
  { value: 'BOAT' as Mode, label: t('data.mode.boat') },
  { value: 'VELO' as Mode, label: t('data.mode.bike') },
])

function formatModeCount(count: number) {
  if (count === 0) return t('ui.dialogs.custom_indices.none')
  if (count === 1) return t('ui.dialogs.custom_indices.one', { count })
  return t('ui.dialogs.custom_indices.many', { count })
}

function formatTotalCount(count: number) {
  if (count === 0) return t('ui.dialogs.custom_indices.total_none')
  if (count === 1) return t('ui.dialogs.custom_indices.total_one', { count })
  return t('ui.dialogs.custom_indices.total_many', { count })
}

const totalIndices = computed(() => indices.value.length)

function getIndicesForMode(mode: Mode) {
  return indices.value.filter(index => index.mode === mode)
}

function addIndex(mode: Mode) {
  const newIndex = createNewIndex(mode)

  editedIndex.value = newIndex
  editorVisible.value = true
}

function editIndex(index: CustomLineIndexDescription) {
  editedIndex.value = index
  editorVisible.value = true
}

function deleteIndex(id: string) {
  deleteById(id)

  editorVisible.value = false
  editedIndex.value = null
}

function closeEditor() {
  editorVisible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    class="custom-index-directory-dialog"
    :pt="{
      root: {
        class: 'custom-index-directory-dialog-root',
      },
      content: {
        class: 'custom-index-directory-dialog-content',
      },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-heading-icon">
          <i class="i-tabler-route" />
        </div>

        <div class="dialog-heading-content">
          <span
            class="p-dialog-title"
            data-pc-section="title"
          >
            {{ $t('ui.dialogs.custom_indices.header') }}
          </span>

          <span class="dialog-heading-description">
            {{ $t('ui.dialogs.custom_indices.summary') }}
          </span>
        </div>
      </div>
    </template>

    <div class="dialog-body">
      <div class="info-row">
        <i class="i-tabler-info-circle" />

        <span>
          {{ $t('ui.dialogs.custom_indices.info') }}
        </span>
      </div>

      <div class="directory">
        <section
          v-for="mode in modes"
          :key="mode.value"
          class="mode-section"
        >
          <div class="mode-header">
            <div class="mode-title">
              <div class="mode-icon">
                <Mode :mode="mode.value" />
              </div>

              <div class="mode-title-text">
                <span class="mode-name">
                  {{ mode.label }}
                </span>

                <span class="mode-count">
                  {{ formatModeCount(getIndicesForMode(mode.value).length) }}
                </span>
              </div>
            </div>

            <Button
              icon="i-tabler-plus"
              rounded
              size="small"
              severity="secondary"
              :aria-label="$t('ui.dialogs.custom_indices.add_aria', { mode: mode.label })"
              @click="addIndex(mode.value)"
            />
          </div>

          <div class="indices-row">
            <button
              v-for="index in getIndicesForMode(mode.value)"
              :key="index.id"
              type="button"
              class="index-card"
              :title="$t('ui.dialogs.custom_indices.edit_title')"
              @click="editIndex(index)"
            >
              <div
                class="index-preview"
                :class="{
                  half:
                    !index.image
                    && (
                      index.shape === 'RECTANGLE'
                      || index.shape === 'CUT_RECTANGLE'
                    ),
                }"
              >
                <CustomLineIndex
                  :shape="index.shape"
                  :index="index.index"
                  :prefix="index.prefix"
                  :suffix="index.suffix"
                  :color="index.color"
                  :image="index.image"
                  text-color="auto"
                />
              </div>
            </button>

          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-status">
          <i class="i-tabler-route" />

          <span>
            {{ formatTotalCount(totalIndices) }}
          </span>
        </div>

        <Button
          :label="$t('ui.dialogs.custom_indices.close')"
          @click="visible = false"
        />
      </div>
    </template>
  </Dialog>

  <LineIndexEditorDialog
    v-if="editedIndex"
    v-model="editedIndex"
    v-model:visible="editorVisible"
    @delete="deleteIndex"
    @hide="closeEditor"
  />
</template>

<style scoped lang="scss">
/*
 * =========================================================
 * DIALOG
 * =========================================================
 */

:deep(.custom-index-directory-dialog-root) {
  width: min(50rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);

  display: flex;
  flex-direction: column;
}

:deep(.custom-index-directory-dialog-content) {
  min-height: 0;

  overflow-y: auto;
}

/*
 * =========================================================
 * EN-TÊTE
 * =========================================================
 */

.dialog-heading {
  display: flex;
  align-items: center;
  gap: .7rem;

  min-width: 0;
}

.dialog-heading-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.35rem;
  height: 2.35rem;

  flex-shrink: 0;

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 12%,
      var(--p-content-background)
    );

  color: var(--p-primary-color);

  font-size: 1.1rem;
}

.dialog-heading-content {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.dialog-heading-description {
  margin-top: .08rem;

  color: var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 400;
}

/*
 * =========================================================
 * CONTENU
 * =========================================================
 */

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: .45rem;

  padding: .55rem .65rem;

  border: 1px solid var(--p-content-border-color);
  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 30%,
      transparent
    );

  color: var(--p-text-muted-color);

  font-size: .68rem;
  line-height: 1.4;
}

.info-row i {
  flex-shrink: 0;

  font-size: .9rem;
}

/*
 * =========================================================
 * RÉPERTOIRE
 * =========================================================
 */

.directory {
  display: flex;
  flex-direction: column;
  gap: .65rem;
}

.mode-section {
  overflow: hidden;

  border: 1px solid var(--p-content-border-color);
  border-radius: .85rem;

  background: var(--p-content-background);
}

.mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  padding: .55rem .65rem;

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
      var(--p-content-hover-background) 28%,
      transparent
    );
}

.mode-title {
  display: flex;
  align-items: center;
  gap: .55rem;

  min-width: 0;
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex-shrink: 0;

  font-size: 1.45rem;
}

.mode-title-text {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.mode-name {
  font-size: .78rem;
  font-weight: 700;
}

.mode-count {
  margin-top: .05rem;

  color: var(--p-text-muted-color);

  font-size: .62rem;
}

/*
 * =========================================================
 * INDICES
 * =========================================================
 */

.indices-row {
  display: grid;
  grid-template-columns: repeat(10, 4rem);
  align-items: center;
  gap: .5rem;

  min-height: 4.3rem;

  padding: .65rem;

  overflow-x: auto;
}

.index-card,
.add-index-card {
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  border: 1px solid var(--p-content-border-color);
  border-radius: .75rem;

  background: var(--p-content-background);

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    transform .15s ease;
}

.index-card {
  min-width: 4rem;
  min-height: 4rem;

  padding: .35rem;
}

.add-index-card {
  width: 3.5rem;
  height: 3.5rem;

  color: var(--p-text-muted-color);

  font-size: 1.2rem;

  border-style: dashed;
}

.index-card:hover,
.add-index-card:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 55%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 5%,
      var(--p-content-background)
    );

  transform: translateY(-1px);
}

.add-index-card:hover {
  color: var(--p-primary-color);
}

.index-preview {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 3.1rem;
  height: 3.1rem;

  overflow: hidden;

  font-size: 2.75rem;
}

.index-preview.half {
  font-size: 1.7rem;
}

/*
 * =========================================================
 * FOOTER
 * =========================================================
 */

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  width: 100%;
}

.footer-status {
  display: flex;
  align-items: center;
  gap: .35rem;

  color: var(--p-text-muted-color);

  font-size: .68rem;
}

.footer-status i {
  color: var(--p-primary-color);

  font-size: .85rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 640px) {
  :deep(.custom-index-directory-dialog-root) {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .dialog-heading-description {
    display: none;
  }

  .indices-row {
    min-height: 4rem;
  }

  .dialog-footer {
    flex-wrap: wrap;
  }
}
</style>