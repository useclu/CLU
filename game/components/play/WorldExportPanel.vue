<script setup lang="ts">
import { ref } from 'vue'
import type { GameWorldExportLabelDensity, GameWorldExportOptions } from '../../engine/sharing'

const props = defineProps<{
  busy?: boolean
  lineCount: number
  stationCount: number
}>()

const emit = defineEmits<{
  close: []
  export: [options: GameWorldExportOptions]
}>()

const labels = ref<GameWorldExportLabelDensity>('AUTO')
const showBasemap = ref(true)
const showLegend = ref(true)
const showStats = ref(true)
const showStationIndex = ref(true)

const QHD_SIZE = { width: 2560, height: 1975 } as const

function runExport() {
  emit('export', {
    ...QHD_SIZE,
    labels: labels.value,
    layout: 'READABLE',
    showBasemap: showBasemap.value,
    showLegend: showLegend.value,
    showStats: showStats.value,
    showStationIndex: showStationIndex.value,
  })
}
</script>

<template>
  <div class="share-backdrop" @click.self="emit('close')">
    <section class="share-panel" role="dialog" aria-modal="true" aria-labelledby="world-export-title">
      <header>
        <div><small>Divers · Partage</small><h2 id="world-export-title">Image du monde</h2></div>
        <button type="button" aria-label="Fermer" @click="emit('close')">×</button>
      </header>

      <div class="preview-copy">
        <strong>{{ lineCount }} lignes · {{ stationCount }} stations</strong>
        <p>Export QHD schématique : axes rangés, faisceaux séparés, petites stations et fond cartographique du jeu réutilisé sans capture WebGL pendant l’export.</p>
      </div>

      <div class="options-grid">
        <label><span>Résolution</span><div class="fixed-option">QHD · 2560×1975</div></label>
        <label><span>Noms de stations</span><select v-model="labels"><option value="AUTO">Automatique · sans collisions</option><option value="ALL">Détaillé · sans superposition</option><option value="NONE">Aucun</option></select></label>
        <label><span>Tracé</span><div class="fixed-option">Plan schématique · angles propres</div></label>
      </div>

      <div class="switches">
        <label><input v-model="showBasemap" type="checkbox"><span><b>Fond cartographique</b><small>Routes, eau et repères du territoire derrière le schéma.</small></span></label>
        <label><input v-model="showLegend" type="checkbox"><span><b>Légende du réseau</b><small>Modes présents et nombre de lignes.</small></span></label>
        <label><input v-model="showStationIndex" type="checkbox"><span><b>Index des gares et stations</b><small>Liste alphabétique avec repère de grille, comme sur un grand plan imprimé.</small></span></label>
        <label><input v-model="showStats" type="checkbox"><span><b>Statistiques synthétiques</b><small>Lignes, stations, longueur, voyageurs et budget.</small></span></label>
      </div>

      <footer>
        <button type="button" @click="emit('close')">Annuler</button>
        <button class="primary" type="button" :disabled="busy || lineCount === 0" @click="runExport">{{ busy ? 'Génération…' : 'Exporter en PNG' }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.share-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.54);backdrop-filter:blur(5px)}.share-panel{width:min(650px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#091117;color:#edf7f7;box-shadow:0 24px 80px rgba(0,0,0,.55);display:grid;gap:16px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}header small{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.48}h2{font-size:21px;margin:3px 0 0}header>button{border:0;background:rgba(255,255,255,.05);color:inherit;width:36px;height:36px;border-radius:10px;font-size:21px;cursor:pointer}.preview-copy{padding:13px 14px;border-radius:14px;background:rgba(75,208,218,.07);border:1px solid rgba(75,208,218,.13)}.preview-copy strong{font-size:13px}.preview-copy p{font-size:10px;opacity:.58;line-height:1.5;margin:5px 0 0}.options-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.options-grid label{display:grid;gap:6px}.options-grid span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.5}.fixed-option,select{width:100%;min-height:42px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#101a21;color:inherit;padding:0 11px;font:inherit}.fixed-option{display:flex;align-items:center;box-sizing:border-box;font-weight:700;color:#dff7f8}.switches{display:grid;gap:8px}.switches label{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:11px;border-radius:12px;background:rgba(255,255,255,.035);cursor:pointer}.switches input{width:17px;height:17px}.switches span{display:grid;gap:2px}.switches b{font-size:11px}.switches small{font-size:9px;opacity:.5}footer{display:flex;justify-content:flex-end;gap:8px}footer button{border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:inherit;padding:10px 14px;cursor:pointer}footer .primary{background:#42c9d1;color:#061014;border-color:transparent;font-weight:800}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:620px){.share-backdrop{align-items:end;padding:8px}.share-panel{border-radius:20px 20px 14px 14px;max-height:88vh}.options-grid{grid-template-columns:1fr}footer button{flex:1}}
</style>
