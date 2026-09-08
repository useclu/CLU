<script setup lang="ts">
import { computed } from 'vue'
import { isAirport, isAirportName, isText } from '~/utils/types'

const {
  ornament = null,
  walk = false,
  transfer = null,
  customPictogram = null,
  customPictogramSize = 1,
} = defineProps<{
  ornament?: Ornament | null
  walk?: boolean
  transfer?: TransferDetails | null
  customPictogram?: string | null
  customPictogramSize?: number
}>()

const effectiveTransfer = computed<TransferDetails | null>(() => {
  if (transfer) {
    return transfer
  }

  if (walk) {
    return {
      mode: 'WALK',
      durationMinutes: null,
    }
  }

  return null
})

const hasTransfer = computed(() => effectiveTransfer.value !== null)

const transferMode = computed<TransferMode | null>(() =>
  effectiveTransfer.value?.mode ?? null,
)

const transferDuration = computed<number | null>(() =>
  effectiveTransfer.value?.durationMinutes ?? null,
)

const transferIcon = computed(() => {
  switch (transferMode.value) {
    case 'BIKE':
      return 'i-tabler-bike'

    case 'CAR':
      return 'i-tabler-car'

    case 'BUS':
      return 'i-tabler-bus'

    case 'OTHER':
      return 'i-tabler-arrows-exchange'

    default:
      return null
  }
})

const hasCustomPictogram = computed(() => {
  return (
    typeof customPictogram === 'string'
    && customPictogram.trim() !== ''
  )
})

const effectiveCustomPictogramSize = computed(() => {
  if (
    typeof customPictogramSize !== 'number'
    || Number.isNaN(customPictogramSize)
  ) {
    return 1
  }

  return customPictogramSize
})
</script>

<template>
  <div
    class="container"
    :class="{
      'ornament-right': ornament?.position === 'RIGHT',
      'ornament-bottom': ornament?.position === 'BOTTOM',
      'with-transfer': hasTransfer,
    }"
  >
    <div class="flex flex-row items-center gap-1">
      <div
        v-if="hasTransfer"
        class="transfer-indicator"
      >
        <Pedestrian
          v-if="transferMode === 'WALK'"
          class="transfer-icon"
        />

        <i
          v-else-if="transferIcon"
          :class="transferIcon"
          class="transfer-icon"
        />

        <span
          v-if="transferDuration !== null"
          class="transfer-duration"
        >
          {{ transferDuration }} min
        </span>
      </div>

      <div
        v-if="hasCustomPictogram"
        class="custom-pictogram"
      >
        <img
          :src="customPictogram ?? ''"
          alt=""
          :style="{
            transform:
              `scale(${effectiveCustomPictogramSize})`,
          }"
        >
      </div>

      <slot v-else />
    </div>

    <div
      v-if="ornament && isAirport(ornament)"
      class="relative"
    >
      <div class="joint" />
      <Airport :airport="ornament.$airportOrnament.airport" />
    </div>

    <div
      v-if="ornament && isAirportName(ornament)"
      class="relative"
    >
      <AirportNameOrnament
        :name="ornament.$airportNameOrnament.name"
      />
    </div>

    <div
      v-if="ornament && isText(ornament)"
      class="text-ornament"
    >
      <span>{{ ornament.$textOrnament.text }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.container {
  display: flex;
  flex-direction: row;
  gap: .125em;
  width: max-content;

  &.ornament-bottom {
    flex-direction: column;
  }

  &.ornament-left {
    flex-direction: row-reverse;
  }
}

.with-transfer {
  min-height: 1em;
  grid-column: span 2;
}

.transfer-indicator {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .2em;

  white-space: nowrap;
}

.transfer-icon {
  flex-shrink: 0;
}

.transfer-duration {
  font-size: .55em;
  font-weight: 600;
  line-height: 1;

  white-space: nowrap;
}

.custom-pictogram {
  width: 1em;
  height: 1em;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  overflow: visible;
}

.custom-pictogram img {
  display: block;

  max-width: 1em;
  max-height: 1em;

  object-fit: contain;

  transform-origin: center;
}

.ornament-right {
  height: 1em;
  min-width: 2.125em;
  grid-column: span 2;

  &.with-transfer {
    grid-column: span 3;
  }
}

.ornament-bottom {
  min-height: 2.125em;
  grid-row: span 2;

  &.with-transfer {
    grid-column: span 2;
  }
}

.text-ornament {
  display: flex;
  align-items: center;

  line-height: 1;
  font-size: .375em;

  white-space-collapse: preserve-breaks;
  text-wrap: nowrap;

  color: var(--blue-ratp-paper);
}

.ornament-bottom .joint {
  position: absolute;
  left: 50%;

  min-width: .0625em;
  max-width: .0625em;
  width: .0625em;
  height: .25em;

  background-color: var(--gray);

  transform: translate(-50%, -50%);

  z-index: -1;
}

.ornament-right .joint {
  position: absolute;
  top: 50%;

  width: .25em;
  min-height: .0625em;
  max-height: .0625em;
  height: .0625em;

  background-color: var(--gray);

  transform: translate(-50%, -50%);

  z-index: -1;
}
</style>