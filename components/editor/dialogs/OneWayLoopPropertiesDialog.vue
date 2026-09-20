<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, inject, ref } from 'vue'
import { LineContextKey } from '~/utils/symbols'

const {
  branch,
} = defineProps<{
  branch: Branch
}>()

const visible = defineModel<boolean>('visible', {
  required: true,
})

const loop = defineModel<OneWayLoop>({
  required: true,
})

const lineContext = inject<LineContext>(LineContextKey)

const directions = [
  {
    label: '←',
    value: 'LEFT',
  },
  {
    label: '→',
    value: 'RIGHT',
  },
]

const position = computed<'TOP' | 'BOTTOM'>({
  get: () => loop.value.$oneWayLoop.position ?? 'TOP',
  set: value => {
    loop.value.$oneWayLoop.position = value
  },
})

/*
 * Compatibilité avec le premier prototype de boucle à sens unique :
 * il ne savait enregistrer qu'un seul arrêt dans `$oneWayLoop.stop`.
 *
 * Dès que l'utilisateur ouvre les propriétés de cette boucle, on
 * normalise silencieusement vers le nouveau tableau `stops`.
 */
function ensureStops() {
  const data = loop.value.$oneWayLoop

  if (!Array.isArray(data.stops)) {
    data.stops = data.stop
      ? [data.stop]
      : []
  }

  data.stop = undefined

  return data.stops
}

const loopStops = computed(() =>
  ensureStops(),
)

function createStop(): Stop {
  return {
    id: uuidv4(),
    $stop: {
      name: '',
      subtitle: '',
      placeName: '',
      accessible: 'undefined',
      reverse: false,
      interestPoint: false,
      preventSubtitleOverlapping: true,
      terminus: false,
      closed: false,
      future: false,
      outOfFareZone: false,
      connections: [],
      nameStyle: {
        bold: true,
        italic: false,
        underline: false,
        color: null,
        image: null,
        imageSize: 1,
      },
    },
  }
}

function addStop() {
  const stops = ensureStops()
  stops.push(createStop())

  activeStopIndex.value = stops.length - 1
  showStopProperties.value = true
}

function deleteStop(index: number) {
  const stops = ensureStops()

  stops.splice(index, 1)

  if (activeStopIndex.value === index) {
    showStopProperties.value = false
    showConnectionsEditor.value = false
    activeStopIndex.value = null
  }
  else if (
    activeStopIndex.value !== null
    && activeStopIndex.value > index
  ) {
    activeStopIndex.value -= 1
  }
}

const activeStopIndex = ref<number | null>(null)
const showStopProperties = ref(false)
const showConnectionsEditor = ref(false)

const activeStop = computed<Stop | null>(() => {
  if (activeStopIndex.value === null) {
    return null
  }

  return loopStops.value[activeStopIndex.value] ?? null
})

const activeStopModel = computed<Stop>({
  get: () => activeStop.value!,
  set: (value) => {
    if (activeStopIndex.value === null) {
      return
    }

    ensureStops()[activeStopIndex.value] = value
  },
})

function editStop(index: number) {
  activeStopIndex.value = index
  showStopProperties.value = true
}

const allowCity = computed(() =>
  lineContext?.frameTerminusNames.value ?? false,
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="body"
    modal
    :draggable="false"
    :style="{ width: 'min(640px, 94vw)', maxHeight: 'calc(100vh - 2rem)' }"
    :pt="{
      root: { style: { display: 'flex', flexDirection: 'column' } },
      content: { style: { overflowY: 'auto', minHeight: '0' } },
      footer: { style: { flex: '0 0 auto' } },
    }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-route-square-2" />
        </div>

        <div>
          <div class="dialog-title">
            {{ $t('ui.dialogs.one_way_loop_properties.header') }}
          </div>
          <div class="dialog-subtitle">
            {{ $t('ui.dialogs.one_way_loop_properties.summary') }}
          </div>
        </div>
      </div>
    </template>

    <div class="loop-properties">
      <section class="property-card">
        <div class="property-card-heading">
          <div class="property-card-icon">
            <i class="i-tabler-arrows-left-right" />
          </div>

          <div>
            <div class="property-card-title">
              {{ $t('ui.dialogs.one_way_loop_properties.direction') }}
            </div>
            <div class="property-card-description">
              {{ $t('ui.dialogs.one_way_loop_properties.direction_hint') }}
            </div>
          </div>
        </div>

        <SelectButton
          v-model="loop.$oneWayLoop.direction"
          :options="directions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          class="direction-select"
          pt:pc-toggle-button:root:class="flex-grow"
        />
      </section>

      <section class="property-card">
        <div class="property-card-heading">
          <div class="property-card-icon">
            <i class="i-tabler-arrows-vertical" />
          </div>

          <div>
            <div class="property-card-title">
              {{ $t('ui.dialogs.one_way_loop_properties.position') }}
            </div>
            <div class="property-card-description">
              {{ $t('ui.dialogs.one_way_loop_properties.position_hint') }}
            </div>
          </div>
        </div>

        <div class="position-select">
          <Button
            class="position-button"
            icon="i-tabler-arrow-up"
            :severity="position === 'TOP' ? 'primary' : 'secondary'"
            :outlined="position !== 'TOP'"
            :label="$t('ui.dialogs.one_way_loop_properties.position_top')"
            @click="position = 'TOP'"
          />

          <Button
            class="position-button"
            icon="i-tabler-arrow-down"
            :severity="position === 'BOTTOM' ? 'primary' : 'secondary'"
            :outlined="position !== 'BOTTOM'"
            :label="$t('ui.dialogs.one_way_loop_properties.position_bottom')"
            @click="position = 'BOTTOM'"
          />
        </div>
      </section>

      <section class="property-card">
        <div class="property-card-heading">
          <div class="property-card-icon">
            <i class="i-tabler-arrows-horizontal" />
          </div>

          <div>
            <div class="property-card-title">
              {{ $t('ui.dialogs.one_way_loop_properties.width') }}
            </div>
            <div class="property-card-description">
              {{ $t('ui.dialogs.one_way_loop_properties.width_hint') }}
            </div>
          </div>
        </div>

        <BInputNumber
          v-model="loop.$oneWayLoop.size"
          :min="4"
          :max="18"
          :step="1"
        />
      </section>

      <section class="property-card loop-stops-card">
        <div class="property-card-heading">
          <div class="property-card-icon">
            <i class="i-tabler-map-pin" />
          </div>

          <div>
            <div class="property-card-title">
              {{ $t('ui.dialogs.one_way_loop_properties.stops_title') }}
            </div>
            <div class="property-card-description">
              {{ $t('ui.dialogs.one_way_loop_properties.stops_hint') }}
            </div>
          </div>
        </div>

        <div
          v-if="loopStops.length > 0"
          class="loop-stops-list"
        >
          <div
            v-for="(stop, index) in loopStops"
            :key="stop.id"
            class="loop-stop-row"
          >
            <InputText
              v-model="stop.$stop.name"
              class="loop-stop-name"
              :placeholder="$t('ui.dialogs.one_way_loop_properties.stop_name_placeholder')"
              @click.stop
            />

            <Button
              icon="i-tabler-settings"
              severity="secondary"
              outlined
              :aria-label="$t('ui.dialogs.one_way_loop_properties.edit_stop')"
              :title="$t('ui.dialogs.one_way_loop_properties.edit_stop')"
              @click.stop="editStop(index)"
            />

            <Button
              icon="i-tabler-trash"
              severity="danger"
              text
              :aria-label="$t('ui.dialogs.one_way_loop_properties.delete_stop')"
              :title="$t('ui.dialogs.one_way_loop_properties.delete_stop')"
              @click.stop="deleteStop(index)"
            />
          </div>
        </div>

        <div
          v-else
          class="loop-stops-empty"
        >
          {{ $t('ui.dialogs.one_way_loop_properties.empty_stops') }}
        </div>

        <Button
          icon="i-tabler-plus"
          :label="$t('ui.dialogs.one_way_loop_properties.add_stop')"
          @click="addStop"
        />
      </section>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        icon="i-tabler-x"
        :label="$t('ui.dialogs.one_way_loop_properties.close')"
        @click="visible = false"
      />
    </template>
  </Dialog>

  <StopPropertiesDialog
    v-if="activeStop"
    v-model:visible="showStopProperties"
    v-model="activeStopModel"
    :allow-city="allowCity"
    :branch="branch"
    @open-connections="showConnectionsEditor = true"
  />

  <ConnectionsEditor
    v-if="activeStop"
    v-model:visible="showConnectionsEditor"
    v-model:stop="activeStopModel"
  />
</template>

<style scoped lang="scss">
.dialog-heading {
  display: flex;
  align-items: center;
  gap: .8rem;
}

.dialog-icon,
.property-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.35rem;
  height: 2.35rem;

  flex: 0 0 auto;

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 12%,
      transparent
    );

  color: var(--p-primary-600);
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;
}

.dialog-subtitle {
  margin-top: .15rem;
  color: var(--p-text-muted-color);
  font-size: .86rem;
}

.loop-properties {
  display: grid;
  gap: .85rem;
}

.property-card {
  display: grid;
  gap: .8rem;

  padding: .9rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: .75rem;
}

.property-card-heading {
  display: flex;
  align-items: flex-start;
  gap: .7rem;
}

.property-card-title {
  font-weight: 700;
}

.property-card-description {
  margin-top: .18rem;
  color: var(--p-text-muted-color);
  font-size: .82rem;
  line-height: 1.35;
}

.direction-select,
.position-select {
  width: 100%;
}

.position-select {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .55rem;
}

.position-button {
  width: 100%;
  justify-content: center;
}

.loop-stops-list {
  display: grid;
  gap: .5rem;
}

.loop-stop-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: .45rem;
  align-items: center;
}

.loop-stop-name {
  width: 100%;
  min-width: 0;
}

.loop-stops-empty {
  padding: .65rem .75rem;

  border: 1px dashed var(--p-content-border-color);
  border-radius: .55rem;

  color: var(--p-text-muted-color);
  font-size: .82rem;
  text-align: center;
}

@media (max-width: 480px) {
  .position-select {
    grid-template-columns: 1fr;
  }

  .loop-stop-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
}
</style>
