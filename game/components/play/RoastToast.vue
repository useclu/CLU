<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { GameRoastHistoryEntry } from '../../types/roast'

const props = defineProps<{
  entry: GameRoastHistoryEntry
  reducedMotion?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
let timer: number | null = null

onMounted(() => {
  timer = window.setTimeout(() => emit('close'), props.entry.intensity === 'EPIC' ? 10500 : 8500)
})
onBeforeUnmount(() => {
  if (timer !== null) window.clearTimeout(timer)
})
</script>

<template>
  <aside class="roast-toast" :class="[`intensity-${entry.intensity.toLowerCase()}`, { 'reduced-motion': reducedMotion }]" role="status" aria-live="polite">
    <div class="roast-top"><span>{{ entry.category === 'ASSISTANT' ? 'CLU ASSISTANT' : 'CLU ROAST' }}</span><small>{{ entry.reference === 'FOOTBALL' ? '⚽' : '✦' }}</small><button type="button" aria-label="Fermer" @click="emit('close')">×</button></div>
    <strong>{{ entry.title }}</strong>
    <p>{{ entry.message }}</p>
  </aside>
</template>

<style scoped>
.roast-toast{position:absolute;z-index:29;right:58px;bottom:16px;width:min(330px,calc(100vw - 92px));padding:12px 13px 13px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:rgba(8,14,19,.92);backdrop-filter:blur(18px);box-shadow:0 18px 55px rgba(0,0,0,.42);animation:roast-in .28s cubic-bezier(.2,.85,.2,1);pointer-events:auto}.roast-toast::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 4px 4px 0;background:#6ee7ec;opacity:.75}.roast-top{display:flex;align-items:center;gap:6px;margin-bottom:5px;padding-left:2px}.roast-top span{font-size:8px;font-weight:900;letter-spacing:.16em;color:#79e1e7}.roast-top small{font-size:10px;opacity:.72}.roast-top button{margin-left:auto;width:23px;height:23px;border:0;border-radius:7px;background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.roast-toast>strong{display:block;font-size:12px;padding-left:2px}.roast-toast p{margin:4px 0 0;padding-left:2px;font-size:10.5px;line-height:1.48;color:rgba(237,246,247,.7)}.intensity-epic{border-color:rgba(244,184,79,.32)}.intensity-epic::before{background:#f2bd68}.intensity-light{opacity:.94}.reduced-motion{animation:none}@keyframes roast-in{from{opacity:0;transform:translateX(18px) translateY(6px) scale(.98)}to{opacity:1;transform:none}}@media(max-width:700px){.roast-toast{right:52px;bottom:14px;width:min(290px,calc(100vw - 78px))}}
</style>
