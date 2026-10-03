<script setup lang="ts">
defineProps<{
  exporting?: boolean
  feedback?: string | null
  error?: string | null
  canExportSave?: boolean
  exportLockedReason?: string | null
}>()
const emit = defineEmits<{
  close: []
  openBilan: []
  exportSave: []
  exportWorld: []
  exportEditor: []
}>()
</script>

<template>
  <aside class="divers-panel" role="dialog" aria-modal="false" aria-label="Divers">
    <header><div><small>Outils du monde</small><strong>Divers</strong></div><button type="button" aria-label="Fermer" @click="emit('close')">×</button></header>
    <button class="tool-card" type="button" @click="emit('openBilan')"><i>▥</i><span><strong>Bilan</strong><small>Résumé de la partie et évolution du réseau.</small></span><b>Ouvrir</b></button>
    <button class="tool-card" type="button" :disabled="exporting || canExportSave === false" :class="{ locked: canExportSave === false }" :title="canExportSave === false ? (exportLockedReason || '') : ''" @click="emit('exportSave')"><i>{{ canExportSave === false ? '🔒' : '⇩' }}</i><span><strong>{{ exporting ? 'Préparation…' : 'Exporter la sauvegarde' }}</strong><small>{{ canExportSave === false ? (exportLockedReason || 'Réservé à l’administrateur.') : 'Conserver une copie locale complète de votre monde.' }}</small></span><b>.clumetro</b></button>
    <button class="tool-card" type="button" @click="emit('exportWorld')"><i>▧</i><span><strong>Image du monde</strong><small>Carte PNG propre, cadrage automatique, légende et statistiques.</small></span><b>PNG</b></button>
    <button class="tool-card" type="button" @click="emit('exportEditor')"><i>↗</i><span><strong>Vers CLU Editor</strong><small>Convertir une ligne avec ses propres indices personnalisés et correspondances.</small></span><b>JSON</b></button>
    <div v-if="feedback || error" class="feedback" :class="{ error: Boolean(error) }" role="status">{{ error || feedback }}</div>
  </aside>
</template>

<style scoped>
.divers-panel{position:absolute;z-index:25;left:98px;top:94px;bottom:auto;width:min(440px,calc(100vw - 112px));padding:14px;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:rgba(8,14,19,.96);backdrop-filter:blur(20px);box-shadow:0 18px 55px rgba(0,0,0,.42);max-height:calc(100vh - 112px);overflow:auto;display:grid;gap:8px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:2px}header>div{display:grid;gap:2px}header small{font-size:9px;opacity:.48;text-transform:uppercase;letter-spacing:.1em}header strong{font-size:15px}header>button{width:34px;height:34px;border:0;border-radius:9px;background:rgba(255,255,255,.045);color:inherit;font-size:20px;cursor:pointer}.tool-card{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);color:inherit;text-align:left;cursor:pointer}.tool-card:hover:not(:disabled){background:rgba(255,255,255,.055);border-color:rgba(82,211,220,.18)}.tool-card i{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:rgba(79,211,220,.10);font-style:normal;color:#b2f5f7}.tool-card span{display:grid;gap:3px}.tool-card strong{font-size:11px}.tool-card small{font-size:9px;line-height:1.35;opacity:.52}.tool-card>b{font-size:8px;padding:5px 7px;border-radius:999px;background:rgba(83,218,161,.10);color:#a9efce}.tool-card:disabled{opacity:.55;cursor:wait}.tool-card.locked:disabled{opacity:.4;filter:saturate(.35);cursor:not-allowed}.tool-card.locked i{background:rgba(255,255,255,.04);color:rgba(255,255,255,.55)}.feedback{padding:9px 10px;border-radius:10px;background:rgba(83,218,161,.08);border:1px solid rgba(83,218,161,.14);font-size:9px;line-height:1.4;color:#b9f1d4}.feedback.error{background:rgba(239,98,98,.08);border-color:rgba(239,98,98,.16);color:#ffc5c5}@media(max-width:760px){.divers-panel{position:fixed;left:8px;right:8px;bottom:76px;top:auto;width:auto;border-radius:18px;padding:12px;max-height:calc(100vh - 96px)}}
</style>
