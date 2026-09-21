<script setup lang="ts">
import { currentGameLocaleTag } from '../../../config/i18n'
import { computed } from 'vue'
import { useGameTerritory } from '../../../composables/useGameTerritory'
import { useGameMunicipalities } from '../../../composables/useGameMunicipalities'

const territory = useGameTerritory()
const municipalities = useGameMunicipalities()

const departmentLabels: Record<string, string> = {
  '75': 'Paris', '77': 'Seine-et-Marne', '78': 'Yvelines', '91': 'Essonne',
  '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': 'Val-d’Oise',
}

const territorialUnitPlural = computed(() => 'Départements')
const territorialUnitServedLabel = computed(() => 'Départements desservis')

function departmentLabel(code: string) {
  return territory.territoryDefinition.value.departments.find(item => item.code === code)?.name ?? departmentLabels[code] ?? code
}

const departments = computed(() => {
  const map = new Map<string, { code: string; population: number; stations: number; municipalities: number }>()
  for (const municipality of territory.summary.value.municipalities) {
    const current = map.get(municipality.departmentCode) ?? { code: municipality.departmentCode, population: 0, stations: 0, municipalities: 0 }
    current.population += municipality.population
    current.stations += municipality.stationCount
    current.municipalities += 1
    map.set(municipality.departmentCode, current)
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
})
function integer(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { maximumFractionDigits: 0 }).format(value) }
function money(value: number) { return new Intl.NumberFormat(currentGameLocaleTag(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value) }
function relation(code: string) { return municipalities.state.value?.relations.find(item => item.code === code) ?? null }
function relationLabel(score: number) {
  if (score >= 75) return 'Très favorable'
  if (score >= 60) return 'Favorable'
  if (score >= 42) return 'Neutre'
  if (score >= 25) return 'Réticente'
  return 'Opposée'
}
</script>

<template>
  <section class="municipality-panel">
    <div class="section-head"><div><span class="eyebrow">Territoire</span><h2>Communes</h2></div><strong>{{ territory.summary.value.municipalitiesServed }}</strong></div>
    <p class="intro">Ici : qui vous desservez et quelle relation vous entretenez avec le territoire. Les demandes et propositions sont maintenant dans <b>Événements & Infos</b>.</p>

    <div class="totals">
      <div><span>Population desservie</span><strong>{{ integer(territory.summary.value.populationServed) }}</strong></div>
      <div><span>Stations couvertes</span><strong>{{ integer(territory.summary.value.coveredStationCount) }}</strong></div>
      <div><span>{{ territorialUnitPlural }}</span><strong>{{ departments.length }}</strong></div>
    </div>

    <details>
      <summary>{{ territorialUnitServedLabel }}</summary>
      <div class="department-list">
        <div v-for="department in departments" :key="department.code"><span><b>{{ department.code }}</b> {{ departmentLabel(department.code) }}</span><small>{{ department.municipalities }} commune(s) · {{ integer(department.population) }} hab. · {{ department.stations }} station(s)</small></div>
      </div>
    </details>

    <details>
      <summary>Communes du réseau</summary>
      <div class="municipality-list">
        <div v-for="municipality in territory.summary.value.municipalities" :key="municipality.code" class="municipality-row">
          <span><strong data-i18n-skip>{{ municipality.name }}</strong><small>{{ municipality.departmentCode }} · {{ integer(municipality.population) }} habitants</small><small v-if="relation(municipality.code)" class="history-facts">{{ relation(municipality.code)?.completedRequests }} accord(s) réalisé(s) · {{ relation(municipality.code)?.refusedRequests }} refus · {{ money(relation(municipality.code)?.totalFundingGranted ?? 0) }} cofinancés</small></span>
          <span class="relation"><b>{{ municipalities.relationScore(municipality.code) }}/100</b><small>{{ relationLabel(municipalities.relationScore(municipality.code)) }}</small></span>
          <span class="coverage"><b>{{ municipality.stationCount }}</b><small>station(s)</small><b>{{ municipality.lineCount }}</b><small>ligne(s)</small></span>
        </div>
      </div>
    </details>

    <div v-if="territory.summary.value.uncoveredStationCount > 0" class="note">{{ territory.summary.value.uncoveredStationCount }} station(s) sont actuellement hors des communes chargées. Elles restent exploitables mais ne participent pas au calcul territorial local.</div>
  </section>
</template>

<style scoped>
.municipality-panel{display:grid;gap:13px}.section-head{display:flex;align-items:center;justify-content:space-between}.eyebrow{font-size:calc(11px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.55}.section-head h2{margin:2px 0 0;font-size:calc(24px * var(--clu-text-scale,1))}.intro,.note{font-size:calc(12px * var(--clu-text-scale,1));opacity:.7}.totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.totals div{padding:9px;border-radius:10px;background:rgba(255,255,255,.045);display:grid;gap:3px}.totals span,.municipality-row small,.department-list small{font-size:calc(10px * var(--clu-text-scale,1));opacity:.55}.municipality-row .history-facts{margin-top:3px;opacity:.38}.department-list,.municipality-list{display:grid;gap:6px}.department-list>div,.municipality-row{padding:9px;border-radius:10px;background:rgba(255,255,255,.035)}.department-list>div{display:grid;gap:3px}.municipality-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px}.municipality-row>span{display:grid}.relation{text-align:right}.coverage{grid-template-columns:auto auto;gap:1px 5px;text-align:right}.note{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px}details{border-top:1px solid rgba(255,255,255,.07);padding-top:8px}summary{cursor:pointer;font-weight:700;margin-bottom:8px}
</style>
