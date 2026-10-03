<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getLineAllStations, getLineBranches } from '../../engine/network/geometry'
import { getTransportModeDefinition } from '../../config/transportModes'
import { getCluEditorLineIdentity } from '../../engine/sharing'
import type { GameLine } from '../../types/network'

const props = defineProps<{
  lines: GameLine[]
  busy?: boolean
}>()

const emit = defineEmits<{
  close: []
  export: [lineId: string]
}>()

const eligible = computed(() => props.lines.filter(line => line.status !== 'PROJECT' && getLineAllStations(line).length >= 2))
const selectedId = ref(eligible.value[0]?.id ?? '')
watch(eligible, lines => {
  if (!lines.some(line => line.id === selectedId.value)) selectedId.value = lines[0]?.id ?? ''
})
const selected = computed(() => eligible.value.find(line => line.id === selectedId.value) ?? null)
const selectedIdentity = computed(() => selected.value ? getCluEditorLineIdentity(selected.value, { lines: props.lines }) : null)
function identityFor(line: GameLine) { return getCluEditorLineIdentity(line, { lines: props.lines }) }
</script>

<template>
  <div class="editor-export-backdrop" @click.self="emit('close')">
    <section class="editor-export-panel" role="dialog" aria-modal="true" aria-labelledby="editor-export-title">
      <header><div><small>Divers · Passerelle</small><h2 id="editor-export-title">Vers CLU Editor</h2></div><button type="button" aria-label="Fermer" @click="emit('close')">×</button></header>
      <p class="intro">Choisissez une ligne. CLU crée directement un projet JSON ouvrable dans CLU Editor avec les arrêts, terminus, branches et correspondances traduisibles.</p>

      <div v-if="eligible.length" class="line-list">
        <button v-for="line in eligible" :key="line.id" type="button" :class="{ active: selectedId === line.id }" @click="selectedId = line.id">
          <i :style="{ background: line.color }" />
          <span><b>{{ identityFor(line).label }}</b><strong>{{ line.name }}</strong><small>{{ getTransportModeDefinition(line.mode).label }} · {{ getLineAllStations(line).length }} stations · {{ getLineBranches(line).length }} branche(s){{ identityFor(line).generated ? ' · indice Editor auto' : '' }}</small></span>
          <em>{{ selectedId === line.id ? '✓' : '›' }}</em>
        </button>
      </div>
      <div v-else class="empty">Créez au moins une ligne comportant deux stations pour l’exporter.</div>

      <div v-if="selected && selectedIdentity" class="identity-preview">
        <i :style="{ background: selectedIdentity.color }">{{ selectedIdentity.label }}</i>
        <span><strong>Indice CLU Editor personnalisé</strong><small>{{ selectedIdentity.generated ? `Aucun indice dans Métropole : « ${selectedIdentity.label} » sera généré automatiquement.` : `« ${selectedIdentity.label} » sera exporté comme indice personnalisé, pas comme une ligne officielle IDFM.` }}</small></span>
      </div>

      <div v-if="selected" class="notice"><strong>Plan schématique</strong><span>CLU Editor reconstruit sa propre géométrie graphique. Les coordonnées cartographiques exactes de Métropole ne sont pas injectées dans le canvas Editor. Les correspondances utilisent elles aussi les indices personnalisés de votre monde. À l’ouverture du JSON dans Editor, les identités restent embarquées dans le plan. Vous pouvez refuser leur ajout à votre bibliothèque personnelle : le plan et ses correspondances continueront de les afficher.</span></div>

      <footer><button type="button" @click="emit('close')">Annuler</button><button class="primary" type="button" :disabled="busy || !selectedId" @click="emit('export', selectedId)">{{ busy ? 'Conversion…' : 'Exporter le JSON Editor' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.editor-export-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.54);backdrop-filter:blur(5px)}.editor-export-panel{width:min(720px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#091117;color:#edf7f7;box-shadow:0 24px 80px rgba(0,0,0,.55);display:grid;gap:14px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}header small{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.48}h2{font-size:21px;margin:3px 0 0}header>button{border:0;background:rgba(255,255,255,.05);color:inherit;width:36px;height:36px;border-radius:10px;font-size:21px;cursor:pointer}.intro{font-size:10px;line-height:1.55;opacity:.62;margin:0}.line-list{display:grid;gap:6px;max-height:48vh;overflow:auto}.line-list button{display:grid;grid-template-columns:8px minmax(0,1fr) 24px;align-items:center;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.075);border-radius:11px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer}.line-list button.active{border-color:rgba(78,211,220,.45);background:rgba(78,211,220,.08)}.line-list i{width:7px;height:36px;border-radius:99px}.line-list span{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}.line-list b{font-size:12px}.line-list strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.line-list small{grid-column:1/-1;font-size:8px;opacity:.5}.line-list em{font-style:normal;text-align:center;opacity:.68}.identity-preview{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:11px;padding:10px 12px;border-radius:11px;background:rgba(79,211,220,.065);border:1px solid rgba(79,211,220,.16)}.identity-preview>i{min-width:34px;height:34px;padding:0 8px;border-radius:999px;display:grid;place-items:center;color:#fff;font-style:normal;font-size:11px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}.identity-preview>span{display:grid;gap:3px}.identity-preview strong{font-size:10px}.identity-preview small{font-size:9px;line-height:1.42;opacity:.62}.notice{display:grid;gap:3px;padding:10px 12px;border-radius:11px;background:rgba(255,194,82,.07);border:1px solid rgba(255,194,82,.13)}.notice strong{font-size:10px}.notice span,.empty{font-size:9px;line-height:1.45;opacity:.58}.empty{padding:20px;text-align:center;border:1px dashed rgba(255,255,255,.1);border-radius:12px}footer{display:flex;justify-content:flex-end;gap:8px}footer button{border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:inherit;padding:10px 14px;cursor:pointer}footer .primary{background:#42c9d1;color:#061014;border-color:transparent;font-weight:800}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:620px){.editor-export-backdrop{align-items:end;padding:8px}.editor-export-panel{border-radius:20px 20px 14px 14px;max-height:90vh}footer button{flex:1}}
</style>
