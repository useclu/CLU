<script setup lang="ts">
import AreaSeparator from './children/AreaSeparator.vue'
import { isAreaSeparator, isOneWayLoop, isSpacer, isStop } from '~/utils/types'

defineOptions({
  inheritAttrs: false,
})

const {
  reverse,
  branch,
} = defineProps<{
  reverse: boolean
  branch: Branch
}>()

const emit = defineEmits<{
  lineMembershipChange: [
    lineId: string,
    enabled: boolean,
  ]
}>()

const element = defineModel<BranchElement>({ required: true })
</script>

<template>
  <Stop
    v-if="isStop(element)"
    v-bind="$attrs"
    v-model="element"
    :reverse="reverse"
    :branch="branch"
    @line-membership-change="
      (lineId, enabled) =>
        emit(
          'lineMembershipChange',
          lineId,
          enabled,
        )
    "
  />

  <Spacer
    v-else-if="isSpacer(element)"
    v-bind="$attrs"
    v-model="element"
  />

  <AreaSeparator
    v-else-if="isAreaSeparator(element)"
    v-bind="$attrs"
    v-model="element"
  />

  <OneWayLoop
    v-else-if="isOneWayLoop(element)"
    v-bind="$attrs"
    v-model="element"
    :branch="branch"
    :reverse="reverse"
  />
</template>
