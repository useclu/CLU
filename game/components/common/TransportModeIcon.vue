<script setup lang="ts">
import type { GameTransportMode } from '../../types/network'

defineProps<{ mode: GameTransportMode }>()
</script>

<template>
  <svg class="transport-mode-icon" viewBox="0 0 32 32" aria-hidden="true">
    <g v-if="mode === 'METRO'">
      <rect x="7" y="5" width="18" height="20" rx="5" />
      <path d="M10 21h12M11 10h10M12 26l-2 2M20 26l2 2" />
      <circle cx="12" cy="18" r="1.2" /><circle cx="20" cy="18" r="1.2" />
    </g>
    <g v-else-if="mode === 'TRAM'">
      <path d="M9 7h14l2 15H7L9 7Z" />
      <path d="M12 7l-2-3M20 7l2-3M9 13h14M10 22l-2 4M22 22l2 4" />
      <circle cx="12" cy="18" r="1.2" /><circle cx="20" cy="18" r="1.2" />
    </g>
    <g v-else-if="mode === 'RER' || mode === 'TRAIN'">
      <path d="M8 6c0-2 2-3 8-3s8 1 8 3v16c0 2-2 4-4 4h-8c-2 0-4-2-4-4V6Z" />
      <path d="M10 10h12M10 14h12M12 26l-3 3M20 26l3 3" />
      <circle cx="12" cy="20" r="1.2" /><circle cx="20" cy="20" r="1.2" />
    </g>
    <g v-else-if="mode === 'BUS' || mode === 'BRT'">
      <rect x="6" y="5" width="20" height="20" rx="4" />
      <path d="M9 10h14M9 16h14M8 25v3M24 25v3" />
      <circle cx="11" cy="21" r="1.2" /><circle cx="21" cy="21" r="1.2" />
    </g>
    <g v-else-if="mode === 'CABLE'">
      <path d="M5 6h22M16 6v5" />
      <rect x="9" y="11" width="14" height="12" rx="3" />
      <path d="M12 23l-2 4M20 23l2 4" />
      <circle cx="13" cy="17" r="1.2" /><circle cx="19" cy="17" r="1.2" />
    </g>
    <g v-else>
      <path d="M5 17h22l-3 7H9l-4-7Z" />
      <path d="M10 17V9h8l4 8M8 27c2 1 4 1 6 0 2-1 4-1 6 0 2 1 4 1 6 0" />
    </g>
  </svg>
</template>

<style scoped>
.transport-mode-icon{width:22px;height:22px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.transport-mode-icon circle{fill:currentColor;stroke:none}
</style>
