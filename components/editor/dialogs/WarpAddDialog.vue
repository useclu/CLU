<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isMacOS } from '@basitcodeenv/vue3-device-detect'
import { useMagicKeys } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import {
  computed,
  nextTick,
  ref,
  watch,
} from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { cleanName } from '~/utils/text'

const { t } = useI18n()

const visible = defineModel<boolean>(
  'visible',
  { required: true },
)

const branch = defineModel<Branch>({
  required: true,
})

const addDirectionOptions = [
  {
    label:
      'ui.dialogs.warp_add.direction.left',
    value: true,
  },
  {
    label:
      'ui.dialogs.warp_add.direction.right',
    value: false,
  },
]

const addPositioningOptions = [
  {
    label:
      'ui.dialogs.warp_add.positioning.left',
    value: true,
  },
  {
    label:
      'ui.dialogs.warp_add.positioning.right',
    value: false,
  },
]

const {
  meta_enter,
  ctrl_enter,
} = useMagicKeys()

interface StopToAdd {
  id: string
  name: string
  placeName: string | null
  subtitle: string | null
  terminus: boolean
}

const stopName = ref('')
const placeName = ref('')
const subtitle = ref('')

const reverseOrder = ref(false)
const insertLeft = ref(false)

const stopsToAdd =
  ref<StopToAdd[]>([])

const stopsList =
  ref<HTMLDivElement | null>(null)

const nameInput =
  ref<any | null>(null)

const metakey = computed(() =>
  isMacOS
    ? '⌘'
    : 'Ctrl',
)

const stopCount = computed(
  () => stopsToAdd.value.length,
)

const stopCountLabel = computed(() => {
  if (stopCount.value === 0) {
    return t('ui.dialogs.warp_add.count_none')
  }

  if (stopCount.value === 1) {
    return t('ui.dialogs.warp_add.count_one')
  }

  return t('ui.dialogs.warp_add.count_many', { count: stopCount.value })
})

const addAllLabel = computed(() => {
  if (stopCount.value === 0) {
    return t('ui.dialogs.warp_add.add_all_default')
  }

  if (stopCount.value === 1) {
    return t('ui.dialogs.warp_add.add_all_one')
  }

  return t('ui.dialogs.warp_add.add_all_many', { count: stopCount.value })
})

const canSubmitCurrentStop =
  computed(
    () =>
      stopName.value.trim().length > 0,
  )

watch(
  stopName,
  val =>
    stopName.value = cleanName(val),
)

watch(
  placeName,
  val =>
    placeName.value = cleanName(val),
)

watch(
  subtitle,
  val =>
    subtitle.value = cleanName(val),
)

/*
 * Ctrl/Cmd + Entrée valide toute la liste.
 *
 * On agit uniquement lorsque la touche devient active.
 * Cela évite un second déclenchement au relâchement.
 */
watch(
  [
    meta_enter,
    ctrl_enter,
  ],
  ([
    metaEnter,
    ctrlEnter,
  ]) => {
    if (
      visible.value
      && (metaEnter || ctrlEnter)
    ) {
      addAllStops()
    }
  },
)

watch(
  visible,
  async (val) => {
    if (!val) {
      reset()
      return
    }

    await nextTick()

    nameInput.value?.$el?.focus?.()
  },
)

function submitStop() {
  if (!canSubmitCurrentStop.value) {
    return
  }

  stopsToAdd.value.push({
    id: uuidv4(),
    name: stopName.value,
    placeName:
      placeName.value.trim().length > 0
        ? placeName.value
        : null,
    subtitle:
      subtitle.value.trim().length > 0
        ? subtitle.value
        : null,
    terminus: false,
  })

  stopName.value = ''
  placeName.value = ''
  subtitle.value = ''

  nameInput.value?.$el?.focus?.()

  nextTick(() => {
    if (!stopsList.value) {
      return
    }

    stopsList.value.scrollTop =
      stopsList.value.scrollHeight
  })
}

function removeStop(
  index: number,
) {
  stopsToAdd.value.splice(
    index,
    1,
  )
}

function reset() {
  stopName.value = ''
  placeName.value = ''
  subtitle.value = ''

  reverseOrder.value = false
  insertLeft.value = false

  stopsToAdd.value = []

  nextTick(() => {
    nameInput.value?.$el?.focus?.()
  })
}

function addAllStops() {
  if (stopsToAdd.value.length === 0) {
    return
  }

  const stops =
    stopsToAdd.value.map(
      stop => ({
        id: stop.id,

        $stop: {
          name: stop.name,
          placeName: stop.placeName,
          subtitle: stop.subtitle,

          accessible:
            'undefined',

          reverse: false,
          interestPoint: false,

          preventSubtitleOverlapping:
            true,

          closed: false,
          future: false,

          terminus:
            stop.terminus,

          outOfFareZone: false,

          connections: [],

          /*
           * On initialise le style moderne du nom.
           *
           * IMPORTANT :
           * on n'écrit volontairement PAS lineIds.
           * La Branch conserve ainsi sa logique naturelle,
           * notamment pour les sorties de Fork D / S.
           */
          nameStyle: {
            bold: true,
            italic: false,
            underline: false,
            color: null,
            image: null,
            imageSize: 1,
            images: [],
          },
        },
      } satisfies Stop),
    )

  if (reverseOrder.value) {
    stops.reverse()
  }

  if (insertLeft.value) {
    branch.value
      .$branch
      .elements
      .unshift(...stops)
  }
  else {
    branch.value
      .$branch
      .elements
      .push(...stops)
  }

  visible.value = false
}

function onSingleLineEnter(
  event: KeyboardEvent,
) {
  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  submitStop()
}

function onNameEnter(
  event: KeyboardEvent,
) {
  if (
    event.key !== 'Enter'
    || event.shiftKey
  ) {
    return
  }

  event.preventDefault()
  submitStop()
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{
      width: 'min(920px, 96vw)',
    }"
    :pt="{
      root: {
        class: 'warp-dialog',
      },
      header: {
        class: 'warp-dialog-header',
      },
      content: {
        class: 'warp-dialog-content',
      },
      footer: {
        class: 'warp-dialog-footer',
      },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-bolt" />
        </div>

        <div class="dialog-heading-text">
          <div class="dialog-title">
            {{ $t('ui.dialogs.warp_add.header') }}
          </div>

          <div class="dialog-subtitle">
            {{ $t('ui.dialogs.warp_add.summary') }}
          </div>
        </div>

        <div class="stop-count-badge">
          {{ stopCountLabel }}
        </div>
      </div>
    </template>

    <div class="warp-content">
      <div class="shortcut-notice">
        <i class="i-tabler-keyboard" />

        <div class="shortcut-text">
          <span>
            <kbd>Entrée</kbd>
            {{ $t('ui.dialogs.warp_add.shortcut_add_stop') }}
          </span>

          <span>
            <kbd>Shift</kbd>
            +
            <kbd>Entrée</kbd>
            {{ $t('ui.dialogs.warp_add.shortcut_newline') }}
          </span>

          <span>
            <kbd>{{ metakey }}</kbd>
            +
            <kbd>Entrée</kbd>
            {{ $t('ui.dialogs.warp_add.shortcut_add_all') }}
          </span>
        </div>
      </div>

      <div class="warp-grid">
        <!--
          =====================================================
          COLONNE GAUCHE
          {{ $t('ui.dialogs.warp_add.new_stop') }} + options d'insertion
          =====================================================
        -->
        <div class="warp-column">
          <section class="warp-card">
            <div class="warp-card-header">
              <div class="warp-card-icon">
                <i class="i-tabler-map-pin-plus" />
              </div>

              <div>
                <div class="warp-card-title">
                  {{ $t('ui.dialogs.warp_add.new_stop') }}
                </div>

                <div class="warp-card-description">
                  {{ $t('ui.dialogs.warp_add.new_stop_hint') }}
                </div>
              </div>
            </div>

            <div class="warp-card-body form-fields">
              <div class="field">
                <label
                  class="field-label"
                  :for="`${branch.id}_warp_name`"
                >
                  {{ $t('ui.dialogs.warp_add.stop_name') }}
                </label>

                <Textarea
                  :id="`${branch.id}_warp_name`"
                  ref="nameInput"
                  v-model="stopName"
                  class="w-full"
                  pt:root:class="important-h-auto"
                  :spellcheck="false"
                  auto-resize
                  autofocus
                  @keydown.enter="onNameEnter"
                />

                <div class="field-help">
                  {{ $t('ui.dialogs.warp_add.multiline_hint') }}
                </div>
              </div>

              <div class="field">
                <label
                  class="field-label"
                  :for="`${branch.id}_warp_city`"
                >
                  {{ $t('ui.dialogs.warp_add.city_name') }}
                </label>

                <InputText
                  :id="`${branch.id}_warp_city`"
                  v-model="placeName"
                  class="w-full"
                  :spellcheck="false"
                  @keydown.enter="onSingleLineEnter"
                />
              </div>

              <div class="field">
                <label
                  class="field-label"
                  :for="`${branch.id}_warp_subtitle`"
                >
                  {{ $t('ui.dialogs.warp_add.subtitle') }}
                </label>

                <InputText
                  :id="`${branch.id}_warp_subtitle`"
                  v-model="subtitle"
                  class="w-full"
                  :spellcheck="false"
                  @keydown.enter="onSingleLineEnter"
                />
              </div>

              <Button
                class="add-current-stop"
                :label="$t('ui.dialogs.warp_add.add_to_list')"
                icon="i-tabler-plus"
                :disabled="!canSubmitCurrentStop"
                @click="submitStop()"
              />
            </div>
          </section>

          <section class="warp-card">
            <div class="warp-card-header">
              <div class="warp-card-icon">
                <i class="i-tabler-adjustments-horizontal" />
              </div>

              <div>
                <div class="warp-card-title">
                  {{ $t('ui.dialogs.warp_add.insertion') }}
                </div>

                <div class="warp-card-description">
                  {{ $t('ui.dialogs.warp_add.insertion_hint') }}
                </div>
              </div>
            </div>

            <div class="warp-card-body insertion-fields">
              <div class="field">
                <label class="field-label">
                  {{ $t('ui.dialogs.warp_add.direction.title') }}
                </label>

                <SelectButton
                  v-model="reverseOrder"
                  class="w-full"
                  pt:pc-toggle-button:root:class="flex-grow"
                  :options="addDirectionOptions"
                  :option-label="
                    option =>
                      $t(option.label)
                  "
                  option-value="value"
                  :allow-empty="false"
                />
              </div>

              <div class="field">
                <label class="field-label">
                  {{ $t('ui.dialogs.warp_add.positioning.title') }}
                </label>

                <SelectButton
                  v-model="insertLeft"
                  class="w-full"
                  pt:pc-toggle-button:root:class="flex-grow"
                  :options="addPositioningOptions"
                  :option-label="
                    option =>
                      $t(option.label)
                  "
                  option-value="value"
                  :allow-empty="false"
                />
              </div>
            </div>
          </section>
        </div>

        <!--
          =====================================================
          COLONNE DROITE
          Liste temporaire
          =====================================================
        -->
        <section class="warp-card stops-card">
          <div class="warp-card-header">
            <div class="warp-card-icon">
              <i class="i-tabler-list-details" />
            </div>

            <div class="warp-card-heading-text">
              <div class="warp-card-title">
                {{ $t('ui.dialogs.warp_add.stops_to_add') }}
              </div>

              <div class="warp-card-description">
                {{ $t('ui.dialogs.warp_add.drag_hint') }}
              </div>
            </div>

            <div
              v-if="stopCount > 0"
              class="mini-count"
            >
              {{ stopCount }}
            </div>
          </div>

          <div
            ref="stopsList"
            class="stops-list"
            :class="{
              empty: stopCount === 0,
            }"
          >
            <VueDraggable
              v-if="stopCount > 0"
              v-model="stopsToAdd"
              class="stops-draggable"
              :animation="150"
              handle=".stop-drag-handle"
            >
              <div
                v-for="(item, index) in stopsToAdd"
                :key="item.id"
                class="stop-card"
              >
                <button
                  type="button"
                  class="stop-drag-handle"
                  :title="$t('ui.dialogs.warp_add.reorder')"
                >
                  <i class="i-tabler-grip-vertical" />
                </button>

                <div class="stop-card-content">
                  <div class="stop-card-name">
                    {{ item.name }}
                  </div>

                  <div
                    v-if="item.placeName || item.subtitle"
                    class="stop-card-meta"
                  >
                    <span v-if="item.placeName">
                      {{ item.placeName }}
                    </span>

                    <span
                      v-if="
                        item.placeName
                        && item.subtitle
                      "
                      class="meta-separator"
                    >
                      •
                    </span>

                    <span v-if="item.subtitle">
                      {{ item.subtitle }}
                    </span>
                  </div>

                  <div
                    v-if="item.terminus"
                    class="terminus-status"
                  >
                    <i class="i-tabler-track" />
                    {{ $t('ui.dialogs.stop_properties.terminus') }}
                  </div>
                </div>

                <div class="stop-card-actions">
                  <Button
                    v-tooltip.left="
                      $t(
                        'ui.dialogs.stop_properties.terminus',
                      )
                    "
                    class="stop-action-button"
                    icon="i-tabler-track"
                    :severity="
                      item.terminus
                        ? 'primary'
                        : 'secondary'
                    "
                    :variant="
                      item.terminus
                        ? undefined
                        : 'text'
                    "
                    size="small"
                    rounded
                    @click="
                      stopsToAdd[index].terminus =
                        !stopsToAdd[index].terminus
                    "
                  />

                  <Button
                    class="stop-action-button"
                    icon="i-tabler-trash"
                    severity="danger"
                    size="small"
                    rounded
                    text
                    @click="removeStop(index)"
                  />
                </div>
              </div>
            </VueDraggable>

            <div
              v-else
              class="empty-state"
            >
              <div class="empty-state-icon">
                <i class="i-tabler-map-pin-plus" />
              </div>

              <div class="empty-state-title">
                {{ $t('ui.dialogs.warp_add.empty_title') }}
              </div>

              <div class="empty-state-description">
                {{ $t('ui.dialogs.warp_add.empty_hint') }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          :label="$t('ui.common.reset')"
          severity="secondary"
          icon="i-tabler-refresh"
          text
          :disabled="stopCount === 0"
          @click="reset()"
        />

        <div class="footer-spacer" />

        <div
          v-if="stopCount > 0"
          class="footer-count"
        >
          {{ stopCountLabel }} prêt{{ stopCount > 1 ? 's' : '' }}
        </div>

        <Button
          :label="addAllLabel"
          icon="i-tabler-check"
          :disabled="stopCount === 0"
          @click="addAllStops()"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
:deep(.warp-dialog) {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: 22px;

  overflow: hidden;

  box-shadow:
    0 28px 80px rgb(0 0 0 / 20%),
    0 5px 18px rgb(0 0 0 / 10%);
}

:deep(.warp-dialog-header) {
  padding: 1.05rem 1.2rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--p-primary-500) 13%,
        var(--p-dialog-background)
      ),
      var(--p-dialog-background)
    );
}

:deep(.warp-dialog-content) {
  padding: 0 !important;

  background:
    var(--p-dialog-background);
}

:deep(.warp-dialog-footer) {
  padding: .85rem 1rem;

  border-top:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  background:
    var(--p-dialog-background);
}

.dialog-heading {
  display: flex;

  align-items: center;

  gap: .85rem;

  width: 100%;
  min-width: 0;
}

.dialog-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2.7rem;
  height: 2.7rem;

  flex: 0 0 2.7rem;

  border-radius: 14px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 14%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1.3rem;
}

.dialog-heading-text {
  min-width: 0;

  flex: 1;
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;

  line-height: 1.2;

  color:
    var(--p-text-color);
}

.dialog-subtitle {
  margin-top: .18rem;

  font-size: .78rem;

  color:
    var(--p-text-muted-color);
}

.stop-count-badge,
.mini-count {
  flex-shrink: 0;

  padding:
    .28rem
    .55rem;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 11%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: .68rem;
  font-weight: 700;
}

.warp-content {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  padding: 1rem;
}

.shortcut-notice {
  display: flex;

  align-items: center;

  gap: .65rem;

  padding:
    .65rem
    .75rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-primary-500) 18%,
      transparent
    );

  border-radius: 13px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 4%,
      transparent
    );

  color:
    var(--p-text-muted-color);
}

.shortcut-notice > i {
  flex-shrink: 0;

  color:
    var(--p-primary-500);

  font-size: 1.1rem;
}

.shortcut-text {
  display: flex;

  flex-wrap: wrap;

  align-items: center;

  gap:
    .35rem
    .85rem;

  font-size: .68rem;
  line-height: 1.5;
}

kbd {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  min-width: 1.45rem;

  padding:
    .08rem
    .32rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 35%,
      transparent
    );

  border-radius: 6px;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 8%,
      var(--p-dialog-background)
    );

  color:
    var(--p-text-color);

  font-family: inherit;
  font-size: .65rem;
  font-weight: 700;

  box-shadow:
    inset
    0 -1px 0
    rgb(0 0 0 / 8%);
}

.warp-grid {
  display: grid;

  grid-template-columns:
    minmax(0, .9fr)
    minmax(0, 1.1fr);

  gap: .9rem;

  align-items: stretch;
}

.warp-column {
  display: flex;

  flex-direction: column;

  gap: .9rem;

  min-width: 0;
}

.warp-card {
  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 20%,
      transparent
    );

  border-radius: 16px;

  overflow: hidden;

  background:
    color-mix(
      in srgb,
      var(--p-surface-0) 3%,
      var(--p-dialog-background)
    );
}

.warp-card-header {
  display: flex;

  align-items: center;

  gap: .65rem;

  min-width: 0;

  padding:
    .75rem
    .85rem;

  border-bottom:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 16%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 5%,
      transparent
    );
}

.warp-card-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex: 0 0 2rem;

  border-radius: 10px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1rem;
}

.warp-card-heading-text {
  min-width: 0;

  flex: 1;
}

.warp-card-title {
  font-size: .88rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.warp-card-description {
  margin-top: .05rem;

  font-size: .7rem;
  line-height: 1.4;

  color:
    var(--p-text-muted-color);
}

.warp-card-body {
  padding: .9rem;
}

.form-fields,
.insertion-fields {
  display: flex;

  flex-direction: column;

  gap: .75rem;
}

.field {
  display: flex;

  flex-direction: column;

  gap: .35rem;

  min-width: 0;
}

.field-label {
  font-size: .72rem;
  font-weight: 650;

  color:
    var(--p-text-color);
}

.field-help {
  font-size: .64rem;

  color:
    var(--p-text-muted-color);
}

.add-current-stop {
  width: 100%;

  margin-top: .1rem;
}

.stops-card {
  display: flex;

  flex-direction: column;

  min-width: 0;
  min-height: 31rem;
}

.stops-list {
  position: relative;

  min-height: 0;

  flex: 1;

  overflow-y: auto;

  max-height: 35rem;

  padding: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-surface-500) 2%,
      transparent
    );
}

.stops-list.empty {
  display: flex;

  align-items: center;
  justify-content: center;
}

.stops-draggable {
  display: flex;

  flex-direction: column;

  gap: .5rem;

  min-height: 100%;
}

.stop-card {
  display: flex;

  align-items: center;

  gap: .55rem;

  padding:
    .58rem
    .6rem;

  border:
    1px
    solid
    color-mix(
      in srgb,
      var(--p-surface-400) 18%,
      transparent
    );

  border-radius: 12px;

  background:
    var(--p-dialog-background);

  box-shadow:
    0 1px 3px
    rgb(0 0 0 / 4%);
}

.stop-drag-handle {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 1.8rem;
  height: 2.1rem;

  flex: 0 0 1.8rem;

  padding: 0;

  border: 0;

  background: transparent;

  color:
    var(--p-text-muted-color);

  cursor: grab;
}

.stop-drag-handle:active {
  cursor: grabbing;
}

.stop-card-content {
  min-width: 0;

  flex: 1;
}

.stop-card-name {
  overflow: hidden;

  color:
    var(--p-text-color);

  font-size: .78rem;
  font-weight: 650;

  line-height: 1.3;

  white-space: pre-line;

  text-overflow: ellipsis;
}

.stop-card-meta {
  display: flex;

  align-items: center;

  gap: .3rem;

  margin-top: .12rem;

  overflow: hidden;

  color:
    var(--p-text-muted-color);

  font-size: .66rem;

  white-space: nowrap;

  text-overflow: ellipsis;
}

.meta-separator {
  opacity: .55;
}

.terminus-status {
  display: inline-flex;

  align-items: center;

  gap: .25rem;

  margin-top: .3rem;

  padding:
    .14rem
    .38rem;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 10%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: .61rem;
  font-weight: 700;
}

.stop-card-actions {
  display: flex;

  align-items: center;

  gap: .1rem;

  flex-shrink: 0;
}

.stop-action-button {
  width: 2rem !important;
  height: 2rem !important;
}

.empty-state {
  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  max-width: 17rem;

  padding: 2rem 1rem;

  text-align: center;
}

.empty-state-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 3rem;
  height: 3rem;

  border-radius: 15px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 9%,
      transparent
    );

  color:
    var(--p-primary-500);

  font-size: 1.35rem;
}

.empty-state-title {
  margin-top: .7rem;

  font-size: .82rem;
  font-weight: 700;

  color:
    var(--p-text-color);
}

.empty-state-description {
  margin-top: .25rem;

  font-size: .68rem;
  line-height: 1.45;

  color:
    var(--p-text-muted-color);
}

.dialog-footer {
  display: flex;

  align-items: center;

  gap: .6rem;

  width: 100%;
}

.footer-spacer {
  flex: 1;
}

.footer-count {
  font-size: .7rem;

  color:
    var(--p-text-muted-color);
}

@media (max-width: 760px) {
  .warp-grid {
    grid-template-columns: 1fr;
  }

  .stops-card {
    min-height: 20rem;
  }

  .stops-list {
    max-height: 24rem;
  }

  .dialog-subtitle,
  .shortcut-notice,
  .warp-card-description,
  .footer-count {
    display: none;
  }
}

@media (max-width: 520px) {
  .stop-count-badge {
    display: none;
  }

  .warp-content {
    padding: .75rem;
  }

  .dialog-footer {
    flex-wrap: wrap;
  }

  .dialog-footer :deep(.p-button) {
    flex: 1;
  }
}
</style>
