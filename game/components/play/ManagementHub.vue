<script setup lang="ts">
import type { GameManagementPanel } from '../../types/game'

defineProps<{ attentionCount: number; disruptionCount: number; lockedModules?: Partial<Record<GameManagementPanel, string>> }>()
const emit = defineEmits<{ select: [panel: GameManagementPanel]; close: [] }>()

const modules: Array<{ id: GameManagementPanel; icon: string; title: string; detail: string }> = [
  { id: 'NETWORK', icon: '⌁', title: 'Réseau', detail: 'Lignes, stations' },
  { id: 'FLEET', icon: '▣', title: 'Matériel', detail: 'Véhicules, dépôts' },
  { id: 'PASSENGERS', icon: '⇄', title: 'Voyageurs', detail: 'Flux, saturation' },
  { id: 'OPERATIONS', icon: '◉', title: 'Exploitation', detail: 'PCC, incidents' },
  { id: 'MUNICIPALITIES', icon: '⌂', title: 'Territoire', detail: 'Communes' },
  { id: 'FINANCES', icon: '€', title: 'Finances', detail: 'Budget, dette' },
  { id: 'EVENTS', icon: '!', title: 'À suivre', detail: 'Alertes, décisions' },
  { id: 'OBJECTIVES', icon: '✓', title: 'Progression', detail: 'Objectifs' },
]
</script>

<template>
  <aside class="management-hub" role="dialog" aria-modal="false" aria-label="Gestion">
    <header>
      <div><strong>Gestion</strong><small>Choisissez ce que vous voulez regarder.</small></div>
      <button type="button" aria-label="Fermer" @click="emit('close')">×</button>
    </header>
    <div class="management-grid">
      <button v-for="module in modules" :key="module.id" type="button" :disabled="Boolean(lockedModules?.[module.id])" :class="{ locked: Boolean(lockedModules?.[module.id]) }" :title="lockedModules?.[module.id] || ''" @click="emit('select', module.id)">
        <i>{{ module.icon }}</i>
        <span><strong>{{ module.title }}</strong><small>{{ lockedModules?.[module.id] || module.detail }}</small></span>
        <b v-if="module.id === 'EVENTS' && attentionCount">{{ attentionCount }}</b>
        <b v-else-if="module.id === 'OPERATIONS' && disruptionCount">{{ disruptionCount }}</b>
        <em v-else>{{ lockedModules?.[module.id] ? '🔒' : '›' }}</em>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.management-hub{position:absolute;z-index:25;left:98px;top:94px;width:min(430px,calc(100vw - 112px));padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(8,14,19,.96);box-shadow:0 14px 42px rgba(0,0,0,.34);max-height:calc(100vh - 112px);overflow:auto}.management-hub header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 2px 9px}.management-hub header>div{display:grid;gap:1px}.management-hub header strong{font-size:13px}.management-hub header small{font-size:8px;opacity:.45}.management-hub header>button{width:28px;height:28px;border:0;border-radius:8px;background:rgba(255,255,255,.04);color:inherit;font-size:18px;cursor:pointer}.management-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.management-grid>button{min-height:49px;display:grid;grid-template-columns:29px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 8px;border:1px solid rgba(255,255,255,.055);border-radius:9px;background:rgba(255,255,255,.018);color:inherit;text-align:left;cursor:pointer}.management-grid>button:hover,.management-grid>button:focus-visible{background:rgba(79,211,220,.055);border-color:rgba(79,211,220,.18)}.management-grid>button.locked,.management-grid>button:disabled{opacity:.42;filter:saturate(.35);cursor:not-allowed;background:rgba(255,255,255,.012);border-color:rgba(255,255,255,.045)}.management-grid>button.locked:hover,.management-grid>button:disabled:hover{transform:none;background:rgba(255,255,255,.012);border-color:rgba(255,255,255,.045)}.management-grid>button.locked i{background:rgba(255,255,255,.035);color:rgba(255,255,255,.45)}.management-grid>button.locked small{white-space:normal;color:#f0c98b;opacity:.75}.management-grid i{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;background:rgba(79,211,220,.07);color:#9de9ed;font-style:normal;font-size:14px;font-weight:900}.management-grid span{display:grid;gap:1px;min-width:0}.management-grid strong{font-size:10px}.management-grid small{font-size:7.5px;opacity:.42;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.management-grid b{min-width:18px;height:18px;padding:0 4px;border-radius:999px;display:grid;place-items:center;background:#d86a6a;color:#fff;font-size:8px}.management-grid em{font-style:normal;opacity:.25;font-size:15px}@media(max-width:760px){.management-hub{position:fixed;left:8px;right:8px;bottom:76px;top:auto;width:auto;padding:10px}.management-grid>button{min-height:46px}}
</style>
