<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', { required: true })
const areaSeparator = defineModel<AreaSeparator>({ required: true })

const cityBoundary = computed({
  get: () =>
    areaSeparator.value.$areaSeparator.busCityBoundary
    !== false,
  set: (value: boolean) => {
    areaSeparator.value.$areaSeparator.busCityBoundary = value

    if (
      !value
      && areaSeparator.value.$areaSeparator.busZoneBoundary === false
    ) {
      areaSeparator.value.$areaSeparator.busZoneBoundary = true
    }
  },
})

const zoneBoundary = computed({
  get: () =>
    areaSeparator.value.$areaSeparator.busZoneBoundary
    !== false,
  set: (value: boolean) => {
    areaSeparator.value.$areaSeparator.busZoneBoundary = value

    if (
      !value
      && areaSeparator.value.$areaSeparator.busCityBoundary === false
    ) {
      areaSeparator.value.$areaSeparator.busCityBoundary = true
    }
  },
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(520px, 94vw)' }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-arrows-split" />
        </div>

        <div>
          <div class="dialog-title">
            {{ $t('ui.dialogs.bus_area_boundary_properties.header') }}
          </div>

          <div class="dialog-subtitle">
            {{ $t('ui.dialogs.bus_area_boundary_properties.summary') }}
          </div>
        </div>
      </div>
    </template>

    <div class="boundary-options">
      <label class="boundary-option">
        <div class="boundary-option-text">
          <strong>
            {{ $t('ui.dialogs.bus_area_boundary_properties.city') }}
          </strong>

          <span>
            {{ $t('ui.dialogs.bus_area_boundary_properties.city_hint') }}
          </span>
        </div>

        <ToggleSwitch v-model="cityBoundary" />
      </label>

      <label class="boundary-option">
        <div class="boundary-option-text">
          <strong>
            {{ $t('ui.dialogs.bus_area_boundary_properties.zone') }}
          </strong>

          <span>
            {{ $t('ui.dialogs.bus_area_boundary_properties.zone_hint') }}
          </span>
        </div>

        <ToggleSwitch v-model="zoneBoundary" />
      </label>

      <div class="information-notice">
        <i class="i-tabler-info-circle" />
        <span>
          {{ $t('ui.dialogs.bus_area_boundary_properties.help') }}
        </span>
      </div>
    </div>

    <template #footer>
      <Button
        :label="$t('ui.common.close')"
        icon="i-tabler-x"
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
.dialog-heading {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.dialog-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.6rem;
  height: 2.6rem;

  flex: 0 0 auto;

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 12%,
      transparent
    );

  font-size: 1.3rem;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 700;
}

.dialog-subtitle {
  margin-top: .12rem;

  color: var(--p-text-muted-color);
  font-size: .86rem;
}

.boundary-options {
  display: grid;
  gap: .75rem;
}

.boundary-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  padding: .85rem .9rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-surface-400) 22%,
      transparent
    );

  border-radius: .75rem;
}

.boundary-option-text {
  display: grid;
  gap: .18rem;
}

.boundary-option-text span {
  color: var(--p-text-muted-color);
  font-size: .83rem;
  line-height: 1.35;
}

.information-notice {
  display: flex;
  align-items: flex-start;
  gap: .55rem;

  padding: .8rem .9rem;

  border-radius: .7rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-500) 7%,
      transparent
    );

  color: var(--p-text-muted-color);
  font-size: .84rem;
  line-height: 1.4;
}
</style>
