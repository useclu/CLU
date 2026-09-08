<script setup lang="ts">
import AreaSeparator from './children/AreaSeparator.vue'
import { isAreaSeparator, isSpacer, isStop } from '~/utils/types'

const {
  reverse,
  branch,
} = defineProps<{
  reverse: boolean
  branch: Branch
}>()

const element = defineModel<BranchElement>({ required: true })
</script>

<template>
  <Stop
    v-if="isStop(element)"
    v-model="element"
    :reverse="reverse"
    :branch="branch"
  />

  <Spacer
    v-else-if="isSpacer(element)"
    v-model="element"
  />

  <AreaSeparator
    v-else-if="isAreaSeparator(element)"
    v-model="element"
  />
</template>