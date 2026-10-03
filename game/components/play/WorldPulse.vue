<script setup lang="ts">
import type { GameWorldPulseItem } from '../../types/worldPulse'

defineProps<{ items: GameWorldPulseItem[] }>()
const emit = defineEmits<{
  focus: [item: GameWorldPulseItem]
  manage: [item: GameWorldPulseItem]
  dismiss: [item: GameWorldPulseItem]
}>()

function icon(item: GameWorldPulseItem) {
  if (item.tone === 'EVENT') return '◆'
  if (item.tone === 'ALERT') return '!'
  if (item.tone === 'SUCCESS') return '↗'
  if (item.tone === 'OPPORTUNITY') return '＋'
  return '•'
}
</script>

<template>
  <section class="world-pulse" aria-label="À regarder dans votre métropole">
    <div class="pulse-head"><span>Actions</span><small :aria-label="`${items.length} sujets`">{{ items.length }}</small></div>
    <div v-if="!items.length" class="pulse-empty"><b>⚡</b><strong>Rien d’urgent</strong><small>Profitez de votre réseau. CLU vous signalera ici les prochaines opportunités utiles.</small></div>
    <article v-for="item in items" :key="item.id" class="pulse-card" :class="`tone-${item.tone.toLowerCase()}`">
      <button class="pulse-main" type="button" @click="emit('focus', item)">
        <i>{{ icon(item) }}</i>
        <span><strong>{{ item.title }}</strong><small>{{ item.summary }}</small></span>
        <b v-if="item.metric">{{ item.metric }}</b>
      </button>
      <div class="pulse-actions">
        <button type="button" @click="emit('focus', item)">Voir</button>
        <button v-if="item.panel" type="button" class="primary" @click="emit('manage', item)">Agir</button>
        <button type="button" class="dismiss" aria-label="Masquer" title="Masquer pour cette session" @click="emit('dismiss', item)">×</button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.world-pulse{position:absolute;z-index:32;right:60px;top:auto;bottom:154px;width:min(360px,calc(100vw - 118px));max-height:min(540px,calc(100vh - 250px));overflow:auto;display:grid;gap:8px;pointer-events:none;scrollbar-width:thin}.pulse-head{display:flex;align-items:center;justify-content:space-between;padding:0 4px;color:#eef7f8;text-shadow:0 1px 12px #000}.pulse-head span{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.11em}.pulse-head small{font-size:10px;opacity:.58}.pulse-empty{pointer-events:auto;padding:18px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(8,15,20,.94);display:grid;place-items:center;text-align:center;gap:4px}.pulse-empty b{font-size:21px}.pulse-empty strong{font-size:11px}.pulse-empty small{max-width:280px;font-size:9px;line-height:1.45;opacity:.5}.pulse-card{pointer-events:auto;border:1px solid rgba(255,255,255,.10);border-radius:15px;background:rgba(8,15,20,.91);box-shadow:0 12px 34px rgba(0,0,0,.28);backdrop-filter:blur(15px);overflow:hidden}.pulse-main{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 12px 8px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.pulse-main>i{width:27px;height:27px;border-radius:9px;display:grid;place-items:center;background:rgba(112,200,255,.11);font-style:normal;font-weight:950;color:#aeefff}.pulse-main>span{display:grid;gap:3px;min-width:0}.pulse-main strong{font-size:12px;line-height:1.2}.pulse-main small{font-size:10px;line-height:1.35;opacity:.59;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.pulse-main>b{font-size:10px;white-space:nowrap;padding:5px 7px;border-radius:8px;background:rgba(255,255,255,.055)}.pulse-actions{display:flex;align-items:center;gap:5px;padding:0 8px 8px 50px}.pulse-actions button{border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.045);color:inherit;padding:5px 8px;font-size:9px;font-weight:850;cursor:pointer}.pulse-actions .primary{background:rgba(79,211,220,.12);border-color:rgba(79,211,220,.27);color:#c7fbff}.pulse-actions .dismiss{margin-left:auto;border:0;background:transparent;font-size:14px;opacity:.45;padding:2px 5px}.tone-alert{border-color:rgba(255,125,125,.20)}.tone-alert .pulse-main>i{background:rgba(255,103,103,.12);color:#ffb0b0}.tone-event{border-color:rgba(197,155,255,.22)}.tone-event .pulse-main>i{background:rgba(178,126,255,.12);color:#dac0ff}.tone-opportunity{border-color:rgba(93,222,163,.20)}.tone-opportunity .pulse-main>i,.tone-success .pulse-main>i{background:rgba(82,215,155,.11);color:#a5f3cb}@media(max-width:760px){.world-pulse{position:fixed;left:8px;right:58px;top:auto;bottom:145px;width:auto;max-height:min(58vh,500px);display:grid;overflow:auto;gap:7px;padding-bottom:4px;scrollbar-width:thin}.pulse-head{display:flex}.pulse-card{min-width:0}.pulse-main{padding:9px 10px 6px}.pulse-actions{padding:0 7px 7px 47px}}
</style>

<style scoped>
/* Phase 12 : Actions reste dans le viewport et possède son propre défilement. */
.world-pulse{position:fixed!important;right:60px!important;bottom:154px!important;top:auto!important;max-height:calc(100vh - 176px)!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable;padding-right:2px}
@media(max-width:760px){.world-pulse{left:8px!important;right:58px!important;bottom:145px!important;max-height:calc(100vh - 165px)!important}}
</style>
