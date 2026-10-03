<script setup lang="ts">
import { computed } from 'vue'
import { useGameAssistant } from '../../composables/useGameAssistant'

const emit = defineEmits<{ close: [] }>()
const assistant = useGameAssistant()

const messages = computed(() => [...(assistant.state.value?.history ?? [])]
  .reverse()
  .slice(0, 12))
</script>

<template>
  <aside class="assistant-panel" role="dialog" aria-modal="false" aria-label="CLU Assistant">
    <header><div><small>Conseils contextuels</small><strong>CLU Assistant</strong></div><button type="button" aria-label="Fermer" @click="emit('close')">×</button></header>
    <div v-if="messages.length" class="assistant-feed">
      <article v-for="entry in messages" :key="entry.id">
        <div><strong>{{ entry.title }}</strong><small>Jour {{ entry.day }}</small></div>
        <p>{{ entry.message }}</p>
      </article>
    </div>
    <div v-else class="assistant-empty"><b>💬</b><strong>Rien à signaler pour le moment</strong><p>CLU garde ici ses conseils et retours utiles. Ils ne recouvrent plus votre carte.</p></div>
  </aside>
</template>

<style scoped>
.assistant-panel{position:absolute;z-index:32;right:60px;top:auto;bottom:154px;width:min(360px,calc(100vw - 118px));max-height:min(520px,calc(100vh - 250px));padding:13px;border:1px solid rgba(255,255,255,.11);border-radius:17px;background:rgba(8,14,19,.97);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.42);display:grid;gap:10px;overflow:hidden}header{display:flex;align-items:center;justify-content:space-between;gap:12px}header>div{display:grid;gap:1px}header small{font-size:8px;opacity:.45;text-transform:uppercase;letter-spacing:.11em}header strong{font-size:14px}header>button{width:30px;height:30px;border:0;border-radius:9px;background:rgba(255,255,255,.05);color:inherit;font-size:18px;cursor:pointer}.assistant-feed{display:grid;gap:7px;overflow:auto;padding-right:2px;scrollbar-width:thin}.assistant-feed article{padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.assistant-feed article>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.assistant-feed strong{font-size:10.5px}.assistant-feed small{font-size:8px;opacity:.42;white-space:nowrap}.assistant-feed p{margin:4px 0 0;font-size:9.5px;line-height:1.45;opacity:.66}.assistant-empty{padding:18px 10px 15px;text-align:center;display:grid;place-items:center;gap:5px}.assistant-empty b{font-size:22px}.assistant-empty strong{font-size:11px}.assistant-empty p{max-width:270px;margin:0;font-size:9px;line-height:1.45;opacity:.5}@media(max-width:760px){.assistant-panel{position:fixed;left:8px;right:58px;top:auto;bottom:145px;width:auto;max-height:min(58vh,500px)}}
</style>

<style scoped>
/* Phase 12 : panneau toujours entièrement accessible, sans être rogné par le conteneur de jeu. */
.assistant-panel{position:fixed!important;right:60px!important;bottom:154px!important;top:auto!important;max-height:calc(100vh - 176px)!important;grid-template-rows:auto minmax(0,1fr)!important;overflow:hidden!important;scrollbar-gutter:stable}
.assistant-feed{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}
@media(max-width:760px){.assistant-panel{left:8px!important;right:58px!important;bottom:145px!important;max-height:calc(100vh - 165px)!important}}
</style>

<style scoped>
/* Phase 13 : l’assistant appartient visuellement à la topbar. Il s’ouvre juste
   dessous, garde son propre scroll et ne flotte plus au niveau de l’horloge. */
.assistant-panel{
  position:fixed!important;
  top:88px!important;
  right:18px!important;
  bottom:auto!important;
  width:min(360px,calc(100vw - 36px))!important;
  max-height:calc(100vh - 106px)!important;
  grid-template-rows:auto minmax(0,1fr)!important;
  overflow:hidden!important;
}
.assistant-feed{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}
@media(max-width:760px){
  .assistant-panel{top:82px!important;left:8px!important;right:8px!important;width:auto!important;max-height:calc(100vh - 94px)!important}
}
</style>
