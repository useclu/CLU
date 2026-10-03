<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { currentGameLocale, translateGameText, formatGameInteger, formatGameCurrencyCompact, formatGamePercent, gameNumericCollator } from '../../../config/i18n'
import { getTransportModeDefinition } from '../../../config/transportModes'
import { useGameNetwork } from '../../../composables/useGameNetwork'
import { useGameRollingStock } from '../../../composables/useGameRollingStock'
import { useGameDialog } from '../../../composables/useGameDialog'
import { useCluOnline } from '../../../composables/useCluOnline'
import { getLineAllStations } from '../../../engine/network/geometry'
import { focusGameMapPoint } from '../../../utils/mapBridge'
import type { GameLine, GameTransportMode } from '../../../types/network'

const network = useGameNetwork()
const rollingStock = useGameRollingStock()
const dialogs = useGameDialog()
const online = useCluOnline()

const onlineSession = computed(() => online.sessionConnectee.value)
const canManageFleet = computed(() => !onlineSession.value || online.peut('gerer_materiel_roulant'))
const canManageDepots = computed(() => !onlineSession.value || online.peut('gerer_depots'))
const fleetLockedReason = computed(() => canManageFleet.value ? '' : translateGameText('Permission requise : gérer le matériel roulant.', currentGameLocale()))
const depotsLockedReason = computed(() => canManageDepots.value ? '' : translateGameText('Permission requise : gérer les dépôts.', currentGameLocale()))

const MODE_ORDER: GameTransportMode[] = ['RER', 'TRAIN', 'METRO', 'TRAM', 'CABLE', 'FERRY', 'BRT', 'BUS']
const modelDrafts = reactive<Record<string, string>>({})
const transferTargets = reactive<Record<string, string>>({})
const transferCounts = reactive<Record<string, number>>({})
const fleetPending = reactive<Record<string, boolean>>({})

const depotName = ref('')
const depotMode = ref<GameTransportMode>('RER')
const depotAnchor = ref('')
const depotCapacity = ref(30)

function money(value: number) {
  return formatGameCurrencyCompact(value)
}
function integer(value: number) {
  return formatGameInteger(value)
}
function percent(value: number) {
  return formatGamePercent(value)
}

const sortedLines = computed(() => {
  const collator = gameNumericCollator()
  const rank = new Map(MODE_ORDER.map((mode, index) => [mode, index]))
  return network.lines.value.slice().sort((a, b) => {
    const byMode = (rank.get(a.mode) ?? 99) - (rank.get(b.mode) ?? 99)
    if (byMode) return byMode
    return collator.compare(a.shortCode || a.name, b.shortCode || b.name) || collator.compare(a.name, b.name)
  })
})

const totalRequired = computed(() => sortedLines.value.reduce((total, line) => total + rollingStock.requiredVehicles(line), 0))
const totalReserve = computed(() => sortedLines.value.reduce((total, line) => total + rollingStock.reserveVehicles(line), 0))
const linesWithoutDepot = computed(() => sortedLines.value.filter(line => !line.depotId && line.vehicleCount > 0).length)

const depotAnchorOptions = computed(() => {
  const options: Array<{ key: string; label: string; longitude: number; latitude: number }> = []
  for (const line of sortedLines.value.filter(line => line.mode === depotMode.value)) {
    for (const station of getLineAllStations(line)) {
      options.push({
        key: `${line.id}|${station.id}`,
        label: `${line.shortCode} · ${station.name}`,
        longitude: station.longitude,
        latitude: station.latitude,
      })
    }
  }
  return options
})

watch(depotAnchorOptions, options => {
  if (!options.some(option => option.key === depotAnchor.value)) depotAnchor.value = options[0]?.key ?? ''
}, { immediate: true })

const newDepotCost = computed(() => rollingStock.depotConstructionCost(depotMode.value, depotCapacity.value))

function currentModel(line: GameLine) {
  return rollingStock.model(line)
}
function modelDraft(line: GameLine) {
  if (!modelDrafts[line.id]) modelDrafts[line.id] = currentModel(line).id
  return modelDrafts[line.id]!
}
function modelOptions(line: GameLine) {
  return rollingStock.modelsForMode(line.mode)
}
function setModelDraft(lineId: string, event: Event) {
  modelDrafts[lineId] = (event.target as HTMLSelectElement).value
}
function compatibleTransferTargets(line: GameLine) {
  const modelId = currentModel(line).id
  return sortedLines.value.filter(other => other.id !== line.id && other.mode === line.mode && currentModel(other).id === modelId)
}
function depotOptions(line: GameLine) {
  return rollingStock.depots.value.filter(depot => depot.mode === line.mode)
}
function transferCount(line: GameLine) {
  if (!(line.id in transferCounts)) transferCounts[line.id] = 1
  return transferCounts[line.id]!
}
function setTransferCount(line: GameLine, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  transferCounts[line.id] = Math.min(Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1), Math.max(1, line.vehicleCount))
}

async function adjustFleet(line: GameLine, delta: number) {
  if (!canManageFleet.value) return
  if (fleetPending[line.id]) return
  fleetPending[line.id] = true
  try {
    const ok = await rollingStock.setFleetSize(line.id, Math.max(0, line.vehicleCount + delta))
    if (!ok) await dialogs.alert('Ajustement impossible : trésorerie insuffisante ou capacité du dépôt atteinte.', { title: 'Parc non modifié' })
  }
  finally { fleetPending[line.id] = false }
}

async function completeFleet(line: GameLine) {
  if (!canManageFleet.value) return
  const target = Math.max(line.vehicleCount, rollingStock.requiredVehicles(line))
  const ok = await rollingStock.setFleetSize(line.id, target)
  if (!ok) await dialogs.alert('Impossible de compléter le parc : vérifiez la trésorerie et la capacité du dépôt.', { title: 'Parc incomplet' })
}

async function applyModel(line: GameLine) {
  if (!canManageFleet.value) return
  const next = modelDrafts[line.id] ?? currentModel(line).id
  if (next === currentModel(line).id) return
  const ok = await rollingStock.replaceModel(line.id, next)
  if (!ok) {
    modelDrafts[line.id] = currentModel(line).id
    await dialogs.alert('Le remplacement complet du parc ne peut pas être financé actuellement.', { title: 'Remplacement impossible' })
  }
}

async function assignDepot(line: GameLine, event: Event) {
  if (!canManageDepots.value) return
  const value = (event.target as HTMLSelectElement).value
  const ok = await rollingStock.assignLineToDepot(line.id, value || null)
  if (!ok) {
    ;(event.target as HTMLSelectElement).value = line.depotId ?? ''
    await dialogs.alert('Ce dépôt n’a pas assez de places libres pour accueillir tout le parc de cette ligne.', { title: 'Dépôt saturé' })
  }
}

function depotDistanceLabel(line: GameLine) {
  const access = rollingStock.depotAccess(line)
  if (access.distanceKm === null) return 'Aucun dépôt affecté'
  return `${access.distanceKm.toFixed(1)} km de la ligne`
}

async function autoAssignDepot(line: GameLine) {
  if (!canManageDepots.value) return
  const candidate = rollingStock.suggestedDepot(line)
  if (!candidate) {
    await dialogs.alert('Aucun dépôt compatible ne dispose d’assez de places pour cette ligne.', { title: 'Aucun dépôt disponible' })
    return
  }
  const ok = await rollingStock.autoAssignNearestDepot(line.id)
  if (!ok) await dialogs.alert('L’affectation automatique n’a pas pu être appliquée.', { title: 'Affectation impossible' })
}

async function transfer(line: GameLine) {
  if (!canManageFleet.value) return
  const targetId = transferTargets[line.id]
  if (!targetId) return
  const ok = await rollingStock.transferVehicles(line.id, targetId, transferCount(line))
  if (!ok) await dialogs.alert('Transfert impossible : modèles incompatibles, parc insuffisant ou dépôt destinataire saturé.', { title: 'Transfert impossible' })
}

async function createDepot() {
  if (!canManageDepots.value) return
  const anchor = depotAnchorOptions.value.find(option => option.key === depotAnchor.value)
  if (!anchor) {
    await dialogs.alert('Choisissez une station existante du mode concerné pour implanter le dépôt.', { title: 'Emplacement requis' })
    return
  }
  const depot = await rollingStock.createDepot({
    name: depotName.value,
    mode: depotMode.value,
    longitude: anchor.longitude,
    latitude: anchor.latitude,
    capacity: depotCapacity.value,
  })
  if (!depot) {
    await dialogs.alert('Construction impossible : vérifiez la trésorerie.', { title: 'Dépôt non construit' })
    return
  }
  depotName.value = ''
  focusGameMapPoint(depot.longitude, depot.latitude, 13)
}

async function expandDepot(depotId: string, added: number) {
  if (!canManageDepots.value) return
  const ok = await rollingStock.expandDepot(depotId, added)
  if (!ok) await dialogs.alert('Extension impossible : capacité maximale atteinte ou trésorerie insuffisante.', { title: 'Extension impossible' })
}

async function removeDepot(depotId: string) {
  if (!canManageDepots.value) return
  const ok = await rollingStock.deleteDepot(depotId)
  if (!ok) await dialogs.alert('Retirez d’abord toutes les lignes affectées à ce dépôt.', { title: 'Dépôt encore utilisé' })
}
</script>

<template>
  <section class="fleet-panel">
    <header class="section-head">
      <div><span class="eyebrow">Exploitation</span><h2>Matériel roulant & dépôts</h2></div>
      <span class="pill">V51</span>
    </header>

    <div class="fleet-kpis">
      <div><span>Parc total</span><strong>{{ integer(rollingStock.totalVehicles.value) }}</strong><small>véhicules</small></div>
      <div><span>Besoin actuel</span><strong>{{ integer(totalRequired) }}</strong><small>pour le service</small></div>
      <div><span>Réserve</span><strong>{{ integer(totalReserve) }}</strong><small>mobilisable</small></div>
      <div><span>Capacité dépôts</span><strong>{{ integer(rollingStock.assignedDepotVehicles.value) }} / {{ integer(rollingStock.totalDepotCapacity.value) }}</strong><small>{{ linesWithoutDepot }} ligne(s) hors dépôt</small></div>
    </div>

    <details class="fleet-fold">
      <summary><span><b>Dépôts</b><small>{{ rollingStock.depots.value.length }} dépôt(s) · {{ linesWithoutDepot }} ligne(s) hors dépôt</small></span><em>Gérer</em></summary>
      <div class="fleet-fold__content">
    <div v-if="!canManageDepots" class="permission-note">🔒 {{ depotsLockedReason }}</div>
    <section class="depot-builder" :class="{ 'permission-disabled': !canManageDepots }">
      <div class="sub-head"><div><span class="eyebrow">Infrastructure</span><strong>Construire un dépôt</strong></div><b>{{ money(newDepotCost) }}</b></div>
      <p>Le dépôt est implanté près d’une station existante. Une ligne affectée ne peut plus dépasser la capacité disponible de son dépôt.</p>
      <div class="form-grid">
        <label>Nom<input v-model="depotName" :disabled="!canManageDepots" maxlength="60" placeholder="Dépôt principal"></label>
        <label>Mode<select v-model="depotMode" :disabled="!canManageDepots"><option v-for="mode in MODE_ORDER" :key="mode" :value="mode">{{ getTransportModeDefinition(mode).label }}</option></select></label>
        <label class="wide">Emplacement<select v-model="depotAnchor" :disabled="!canManageDepots"><option v-if="!depotAnchorOptions.length" value="">Aucune station disponible</option><option v-for="option in depotAnchorOptions" :key="option.key" :value="option.key" data-i18n-skip>{{ option.label }}</option></select></label>
        <label>Capacité<input v-model.number="depotCapacity" :disabled="!canManageDepots" type="number" min="1" max="500"></label>
        <button class="primary" type="button" :disabled="!canManageDepots || !depotAnchorOptions.length" :title="depotsLockedReason || undefined" @click="createDepot">Construire · {{ money(newDepotCost) }}</button>
      </div>
    </section>

    <section v-if="rollingStock.depots.value.length" class="depot-list">
      <div class="sub-head"><div><span class="eyebrow">Remisage</span><strong>Mes dépôts</strong></div><span>{{ rollingStock.depots.value.length }}</span></div>
      <article v-for="depot in rollingStock.depots.value" :key="depot.id" class="depot-card">
        <button class="depot-main" type="button" @click="focusGameMapPoint(depot.longitude, depot.latitude, 13)">
          <i :style="{ background: getTransportModeDefinition(depot.mode).accent }"></i>
          <span><strong data-i18n-skip>{{ depot.name }}</strong><small>{{ getTransportModeDefinition(depot.mode).label }} · {{ rollingStock.depotUsedCapacity(depot.id) }}/{{ depot.capacity }} places utilisées</small></span>
        </button>
        <div class="capacity-bar"><i :style="{ width: `${Math.min(100, rollingStock.depotUsedCapacity(depot.id) / Math.max(1, depot.capacity) * 100)}%` }" /></div>
        <div class="depot-actions"><button type="button" :disabled="!canManageDepots" :title="depotsLockedReason || undefined" @click="expandDepot(depot.id, 10)">+10 · {{ money(rollingStock.depotExpansionCost(depot.mode, 10)) }}</button><button type="button" :disabled="!canManageDepots" :title="depotsLockedReason || undefined" @click="expandDepot(depot.id, 25)">+25 · {{ money(rollingStock.depotExpansionCost(depot.mode, 25)) }}</button><button class="danger" type="button" :disabled="!canManageDepots" :title="depotsLockedReason || undefined" @click="removeDepot(depot.id)">Supprimer</button></div>
      </article>
    </section>

      </div>
    </details>

    <section class="line-fleets">
      <div v-if="!canManageFleet" class="permission-note">🔒 {{ fleetLockedReason }}</div>
      <div class="sub-head"><div><span class="eyebrow">Affectations</span><strong>Parc par ligne</strong></div><span>{{ sortedLines.length }}</span></div>
      <p v-if="!sortedLines.length" class="empty">Créez d’abord une ligne pour gérer son matériel roulant.</p>

      <article v-for="line in sortedLines" :key="line.id" class="fleet-card">
        <header>
          <span class="line-badge" :style="{ background: line.color }"><img v-if="line.customLogoDataUrl" :src="line.customLogoDataUrl"><b v-else>{{ line.shortCode }}</b></span>
          <div><strong data-i18n-skip>{{ line.name }}</strong><small>{{ getTransportModeDefinition(line.mode).label }} · {{ currentModel(line).name }}</small></div>
          <span class="fleet-count"><b>{{ line.vehicleCount }}</b><small>/ {{ rollingStock.requiredVehicles(line) }} requis</small></span>
        </header>

        <div class="fleet-controls">
          <div class="counter"><button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="adjustFleet(line, -1)">−</button><strong>{{ line.vehicleCount }}</strong><button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="adjustFleet(line, 1)">+</button><button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="adjustFleet(line, 5)">+5</button><button type="button" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @click="completeFleet(line)">Compléter</button></div>
          <small>Réserve : {{ rollingStock.reserveVehicles(line) }} · état moyen : {{ Math.round(line.fleetCondition) }} % · achat unitaire : {{ money(currentModel(line).purchaseCost) }}</small>
        </div>

        <details class="fleet-line-details">
          <summary>Modèle, performances et dépôt</summary>
          <div class="model-stats">
            <div><span>Capacité</span><b>{{ integer(rollingStock.effectiveCapacity(line)) }}</b><small>places/véhicule</small></div>
            <div><span>Vitesse</span><b>{{ rollingStock.effectiveSpeed(line).toFixed(0) }}</b><small>km/h commercial</small></div>
            <div><span>Fiabilité</span><b>{{ percent(currentModel(line).reliability) }}</b><small>base modèle</small></div>
            <div><span>Énergie</span><b>{{ Math.round(currentModel(line).energyIndex * 100) }}</b><small>indice 100 = standard</small></div>
            <div><span>Composition</span><b>{{ currentModel(line).composition }}</b><small>{{ currentModel(line).lengthMeters }} m</small></div>
            <div><span>Mise en service</span><b>{{ currentModel(line).introducedYear }}</b><small>{{ currentModel(line).generationLabel }}</small></div>
          </div>

        <div class="form-grid compact">
          <label>Modèle
            <select :value="modelDraft(line)" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" @change="setModelDraft(line.id, $event)">
              <option v-for="candidate in modelOptions(line)" :key="candidate.id" :value="candidate.id">{{ candidate.name }} · {{ candidate.capacity }} places · {{ money(candidate.purchaseCost) }}</option>
            </select>
          </label>
          <button type="button" :disabled="!canManageFleet || modelDraft(line) === currentModel(line).id" :title="fleetLockedReason || undefined" @click="applyModel(line)">{{ line.vehicleCount ? 'Remplacer tout le parc' : 'Choisir ce modèle' }}</button>
          <label>Dépôt
            <select :value="line.depotId ?? ''" :disabled="!canManageDepots" :title="depotsLockedReason || undefined" @change="assignDepot(line, $event)"><option value="">Aucun / historique</option><option v-for="depot in depotOptions(line)" :key="depot.id" :value="depot.id">{{ depot.name }} · {{ rollingStock.depotUsedCapacity(depot.id) }}/{{ depot.capacity }}</option></select>
          </label>
          <div class="depot-assignment">
            <span class="depot-note" :class="{ warning: (!line.depotId && line.vehicleCount > 0) || (rollingStock.depotAccess(line).distanceKm ?? 0) > 15 }">
              {{ line.depotId ? `Remisé à ${rollingStock.depotForLine(line)?.name ?? 'dépôt'} · ${depotDistanceLabel(line)}` : 'Aucun dépôt affecté : une petite surcharge d’exploitation est appliquée.' }}
            </span>
            <button v-if="rollingStock.suggestedDepot(line) && rollingStock.suggestedDepot(line)?.depot.id !== line.depotId" type="button" :disabled="!canManageDepots" :title="depotsLockedReason || undefined" @click="autoAssignDepot(line)">
              Auto · {{ rollingStock.suggestedDepot(line)?.depot.name }} ({{ rollingStock.suggestedDepot(line)?.distanceKm.toFixed(1) }} km)
            </button>
          </div>
        </div>

        <div v-if="compatibleTransferTargets(line).length && line.vehicleCount" class="transfer-box">
          <strong>Transférer des véhicules</strong>
          <select v-model="transferTargets[line.id]" :disabled="!canManageFleet" :title="fleetLockedReason || undefined"><option value="">Ligne destinataire</option><option v-for="target in compatibleTransferTargets(line)" :key="target.id" :value="target.id" data-i18n-skip>{{ target.shortCode }} · {{ target.name }}</option></select>
          <input :value="transferCount(line)" :disabled="!canManageFleet" :title="fleetLockedReason || undefined" type="number" min="1" :max="line.vehicleCount" @input="setTransferCount(line, $event)">
          <button type="button" :disabled="!canManageFleet || !transferTargets[line.id]" :title="fleetLockedReason || undefined" @click="transfer(line)">Transférer</button>
          <small>Même mode et même modèle requis. Aucun achat/revente : le parc change seulement d’affectation.</small>
        </div>
        </details>
      </article>
    </section>
  </section>
</template>

<style scoped>
.fleet-panel{display:grid;gap:22px}.section-head,.sub-head,.fleet-card>header,.depot-main,.depot-actions,.counter,.transfer-box{display:flex;align-items:center;gap:10px}.section-head,.sub-head,.fleet-card>header{justify-content:space-between}.eyebrow{font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(22px * var(--clu-text-scale,1))}.pill{padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-size:calc(11px * var(--clu-text-scale,1))}.fleet-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.fleet-kpis>div,.depot-builder,.depot-card,.fleet-card{border:1px solid rgba(255,255,255,.09);background:rgba(13,20,26,.78);border-radius:13px}.fleet-kpis>div{padding:11px;display:grid;gap:2px}.fleet-kpis span,.model-stats span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.52;text-transform:uppercase;letter-spacing:.06em}.fleet-kpis strong{font-size:calc(17px * var(--clu-text-scale,1))}.fleet-kpis small,.model-stats small,.fleet-controls small,.transfer-box small,.depot-note{font-size:calc(9px * var(--clu-text-scale,1));opacity:.56}.depot-builder,.depot-card,.fleet-card{padding:14px}.depot-builder p{font-size:calc(11px * var(--clu-text-scale,1));line-height:1.45;opacity:.62}.sub-head>div{display:grid}.sub-head>span{opacity:.6}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.form-grid.compact{margin-top:12px}.form-grid label{display:grid;gap:4px;font-size:calc(10px * var(--clu-text-scale,1));opacity:.78}.form-grid input,.form-grid select,.transfer-box select,.transfer-box input{min-width:0;background:#121c23;color:#edf6f7;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px}.form-grid button,.depot-actions button,.counter button,.transfer-box button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:inherit;border-radius:8px;padding:8px 10px;cursor:pointer}.form-grid button:disabled,.transfer-box button:disabled{opacity:.35;cursor:not-allowed}.primary{background:rgba(80,210,220,.18)!important;border-color:rgba(80,210,220,.5)!important}.wide{grid-column:1/-1}.depot-list,.line-fleets{display:grid;gap:10px}.depot-main{width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer}.depot-main i{width:12px;height:12px;border-radius:4px;flex:none}.depot-main span{display:grid;gap:2px;flex:1}.depot-main small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.58}.capacity-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin:10px 0}.capacity-bar i{display:block;height:100%;background:rgba(80,210,220,.72)}.depot-actions{flex-wrap:wrap}.danger{color:#ff9c9c!important}.fleet-card{display:grid;gap:12px}.line-badge{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:#071014;font-weight:900;overflow:hidden;flex:none}.line-badge img{width:100%;height:100%;object-fit:contain;background:#fff}.fleet-card>header>div{display:grid;gap:2px;flex:1}.fleet-card>header small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.56}.fleet-count{display:grid;text-align:right}.fleet-count b{font-size:calc(18px * var(--clu-text-scale,1))}.fleet-count small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.5}.model-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.model-stats>div{padding:8px;border-radius:8px;background:rgba(255,255,255,.035);display:grid;gap:2px}.model-stats b{font-size:calc(11px * var(--clu-text-scale,1));overflow-wrap:anywhere}.fleet-controls{display:grid;gap:6px}.counter{flex-wrap:wrap}.counter strong{min-width:34px;text-align:center}.depot-assignment{display:grid;gap:6px}.depot-assignment>button{border:1px solid rgba(80,210,220,.22);background:rgba(80,210,220,.08);color:inherit;border-radius:8px;padding:7px 9px;cursor:pointer}.depot-note{align-self:end;padding:8px;border-radius:8px;background:rgba(255,255,255,.035)}.depot-note.warning{color:#ffd28a;background:rgba(220,150,50,.08);opacity:.9}.transfer-box{flex-wrap:wrap;padding:10px;border-radius:9px;background:rgba(80,210,220,.045);border:1px solid rgba(80,210,220,.12)}.transfer-box strong{font-size:calc(10px * var(--clu-text-scale,1));width:100%}.transfer-box select{flex:1;min-width:130px}.transfer-box input{width:60px}.transfer-box small{width:100%}.empty{padding:14px;text-align:center;opacity:.6;font-size:calc(11px * var(--clu-text-scale,1))}
@media(max-width:640px){.fleet-kpis,.form-grid,.model-stats{grid-template-columns:1fr 1fr}.wide{grid-column:1/-1}.form-grid.compact{grid-template-columns:1fr}.model-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* Lecture compacte : parc d'abord, détails ensuite. */
.fleet-panel{gap:12px}.section-head h2{font-size:calc(18px * var(--clu-text-scale,1))}.section-head .eyebrow{font-size:calc(8px * var(--clu-text-scale,1))}.fleet-kpis{gap:5px}.fleet-kpis>div{padding:8px;border-radius:9px;background:rgba(255,255,255,.025)}.fleet-kpis strong{font-size:calc(13px * var(--clu-text-scale,1))}.depot-builder,.depot-card,.fleet-card{padding:10px;border-radius:10px;background:rgba(255,255,255,.018)}.depot-builder p{font-size:calc(9px * var(--clu-text-scale,1));margin:4px 0}.depot-list,.line-fleets{gap:6px}.fleet-card{gap:8px}.line-badge{width:34px;height:34px;border-radius:8px}.fleet-count b{font-size:calc(14px * var(--clu-text-scale,1))}.model-stats{gap:5px}.model-stats>div{padding:6px}.fleet-controls{gap:4px}.transfer-box{padding:8px}.form-grid{gap:6px}

/* Dépôts et réglages techniques sont disponibles sans occuper l'écran en permanence. */
.fleet-fold,.fleet-line-details{border-top:1px solid rgba(255,255,255,.065)}.fleet-fold>summary,.fleet-line-details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:36px;padding:0 3px}.fleet-fold>summary::-webkit-details-marker,.fleet-line-details>summary::-webkit-details-marker{display:none}.fleet-fold>summary>span{display:grid;gap:1px}.fleet-fold>summary b{font-size:calc(10px * var(--clu-text-scale,1))}.fleet-fold>summary small{font-size:calc(7.5px * var(--clu-text-scale,1));opacity:.42}.fleet-fold>summary em{font-size:calc(8px * var(--clu-text-scale,1));font-style:normal;opacity:.48}.fleet-fold__content{display:grid;gap:7px;padding:3px 0 8px}.fleet-fold__content>.depot-builder{margin:0}.fleet-line-details>summary{min-height:30px;font-size:calc(8.5px * var(--clu-text-scale,1));opacity:.62}.fleet-line-details>summary::after{content:'+';font-size:14px}.fleet-line-details[open]>summary::after{content:'−'}.fleet-line-details>.model-stats{margin-top:4px}.fleet-line-details>.form-grid{margin-top:7px}.fleet-line-details>.transfer-box{margin-top:7px}.fleet-card>header{min-width:0}.fleet-card>header>div{min-width:0}.fleet-card>header>div>strong,.fleet-card>header>div>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}


.permission-note{padding:9px 11px;border:1px solid rgba(255,193,86,.2);border-radius:9px;background:rgba(255,193,86,.07);color:#ffd28a;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.35}.permission-disabled{opacity:.56}.fleet-panel :is(button,input,select):disabled{cursor:not-allowed;filter:saturate(.35)}

</style>
