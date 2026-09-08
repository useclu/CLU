<script setup lang="ts">
import type Popover from 'primevue/popover'
import { ref } from 'vue'

const SOCIALS = [
  {
    label: 'X (fka Twitter)',
    value: 'https://x.com/REReboots',
    icon: 'i-tabler-brand-x',
  },
  {
    label: 'GitHub',
    value: 'https://github.com/useclu/CLU',
    icon: 'i-tabler-brand-github',
  },
]

const op = ref<InstanceType<typeof Popover> | null>(null)

function toggle(event: MouseEvent) {
  op.value?.toggle(event)
}
</script>

<template>
  <Button text rounded icon="i-tabler-share" @click="toggle" />

  <Popover ref="op">
    <div class="flex flex-row gap-1">
      <Button
        v-for="social in SOCIALS"
        :key="social.value"
        severity="secondary"
        :icon="social.icon"
        :href="social.value"
        target="_blank"
        as="a"
        rounded
        text
      />
    </div>
  </Popover>
</template>