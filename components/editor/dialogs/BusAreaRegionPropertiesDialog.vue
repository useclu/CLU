<script setup lang="ts">
import { computed } from 'vue'

const visible = defineModel<boolean>('visible', { required: true })

const {
  branch,
  cityRegionKey,
  zoneRegionKey,
  regionIndex = 0,
} = defineProps<{
  branch: Branch
  cityRegionKey: string | null
  zoneRegionKey: string | null
  regionIndex?: number
}>()

function ensureRegions() {
  if (!branch.$branch.busAreaRegions) {
    branch.$branch.busAreaRegions = {}
  }

  return branch.$branch.busAreaRegions
}

function ensureRegion(key: string | null) {
  if (!key) {
    return null
  }

  const regions = ensureRegions()

  if (!regions[key]) {
    regions[key] = {
      cityName: '',
      zoneName: null,
    }
  }

  return regions[key]
}

function removeRegionIfEmpty(key: string | null) {
  if (
    !key
    || !branch.$branch.busAreaRegions
  ) {
    return
  }

  const region =
    branch.$branch.busAreaRegions[key]

  if (!region) {
    return
  }

  if (
    region.cityName.trim().length === 0
    && !region.zoneName?.trim()
  ) {
    delete branch.$branch.busAreaRegions[key]
  }
}

const cityName = computed({
  get: () => {
    if (!cityRegionKey) {
      return ''
    }

    return branch.$branch.busAreaRegions?.[cityRegionKey]?.cityName ?? ''
  },
  set: (value: string) => {
    const region = ensureRegion(cityRegionKey)

    if (!region) {
      return
    }

    region.cityName = value
    removeRegionIfEmpty(cityRegionKey)
  },
})

const zoneName = computed({
  get: () => {
    if (!zoneRegionKey) {
      return ''
    }

    return branch.$branch.busAreaRegions?.[zoneRegionKey]?.zoneName ?? ''
  },
  set: (value: string) => {
    const region = ensureRegion(zoneRegionKey)

    if (!region) {
      return
    }

    const normalized = value.trim()

    region.zoneName = normalized.length > 0
      ? value
      : null

    removeRegionIfEmpty(zoneRegionKey)
  },
})

const hasValues = computed(() =>
  cityName.value.trim().length > 0
  || zoneName.value.trim().length > 0,
)

function clearRegion() {
  if (cityRegionKey) {
    const region =
      branch.$branch.busAreaRegions?.[cityRegionKey]

    if (region) {
      region.cityName = ''
      removeRegionIfEmpty(cityRegionKey)
    }
  }

  if (zoneRegionKey) {
    const region =
      branch.$branch.busAreaRegions?.[zoneRegionKey]

    if (region) {
      region.zoneName = null
      removeRegionIfEmpty(zoneRegionKey)
    }
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(560px, 94vw)' }"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon">
          <i class="i-tabler-map-pin" />
        </div>

        <div>
          <div class="dialog-title">
            {{ $t('ui.dialogs.bus_area_region_properties.header') }}
          </div>

          <div class="dialog-subtitle">
            {{
              $t(
                'ui.dialogs.bus_area_region_properties.summary',
                { number: regionIndex + 1 },
              )
            }}
          </div>
        </div>
      </div>
    </template>

    <div class="bus-area-region-properties">
      <div class="field">
        <label class="field-label" for="bus-area-region-city">
          <i class="i-tabler-building-community" />
          {{ $t('ui.dialogs.bus_area_region_properties.city') }}
        </label>

        <InputText
          id="bus-area-region-city"
          v-model="cityName"
          :placeholder="$t('ui.dialogs.bus_area_region_properties.city_placeholder')"
          fluid
        />
      </div>

      <div class="field">
        <label class="field-label" for="bus-area-region-zone">
          <i class="i-tabler-map" />
          {{ $t('ui.dialogs.bus_area_region_properties.zone') }}
        </label>

        <InputText
          id="bus-area-region-zone"
          v-model="zoneName"
          :placeholder="$t('ui.dialogs.bus_area_region_properties.zone_placeholder')"
          fluid
        />
      </div>

      <div class="information-notice">
        <i class="i-tabler-info-circle" />
        <span>
          {{ $t('ui.dialogs.bus_area_region_properties.help') }}
        </span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          v-if="hasValues"
          :label="$t('ui.dialogs.bus_area_region_properties.clear')"
          severity="secondary"
          icon="i-tabler-eraser"
          @click="clearRegion"
        />

        <div class="dialog-footer-spacer" />

        <Button
          :label="$t('ui.common.close')"
          icon="i-tabler-x"
          @click="visible = false"
        />
      </div>
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

.bus-area-region-properties {
  display: grid;
  gap: 1rem;

  padding-top: .25rem;
}

.field {
  display: grid;
  gap: .45rem;
}

.field-label {
  display: flex;
  align-items: center;
  gap: .42rem;

  font-weight: 650;
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

.dialog-footer {
  display: flex;
  align-items: center;
  gap: .6rem;

  width: 100%;
}

.dialog-footer-spacer {
  flex: 1;
}
</style>
