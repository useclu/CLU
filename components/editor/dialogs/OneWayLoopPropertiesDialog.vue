<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', {
  required: true,
})

const loop = defineModel<OneWayLoop>({
  required: true,
})

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
</script>

<template>
  <Dialog
    v-model:visible="visible"
    append-to="body"
    modal
    :draggable="false"
    :style="{ width: 'min(600px, 94vw)', maxHeight: 'calc(100vh - 2rem)' }"
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

@media (max-width: 480px) {
  .position-select {
    grid-template-columns: 1fr;
  }
}
</style>
