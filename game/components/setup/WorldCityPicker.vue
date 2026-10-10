<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CountryFlag from '../common/CountryFlag.vue'
import { useGameI18n } from '../../composables/useGameI18n'
import { currentGameLocale } from '../../config/i18n'
import { searchWorldCities } from '../../utils/worldCitySearch'
import { normalizeWorldTerritorySettings } from '../../engine/territory/world'
import { WORLD_DEFAULT_RADIUS_KM } from '../../config/worldMap'
import type { GameWorldCitySearchResult, GameWorldTerritorySettings } from '../../types/worldTerritory'

const props = defineProps<{ modelValue: GameWorldTerritorySettings | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: GameWorldTerritorySettings | null] }>()
const i18n = useGameI18n()

const query = ref('')
const results = ref<GameWorldCitySearchResult[]>([])
const busy = ref(false)
const error = ref<string | null>(null)
const searched = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestVersion = 0

const selected = computed(() => normalizeWorldTerritorySettings(props.modelValue))

function clearDebounce() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

async function runSearch(rawQuery = query.value) {
  const normalized = rawQuery.trim()
  if (normalized.length < 2) {
    requestVersion += 1
    results.value = []
    error.value = null
    searched.value = false
    busy.value = false
    return
  }

  const version = ++requestVersion
  busy.value = true
  error.value = null
  searched.value = true
  try {
    const next = await searchWorldCities(normalized, currentGameLocale())
    if (version !== requestVersion) return
    results.value = next
    if (!next.length) error.value = i18n.t('Aucune ville trouvée. Essayez avec le pays ou la région.')
  }
  catch (cause) {
    if (version !== requestVersion) return
    if (cause instanceof DOMException && cause.name === 'AbortError') return
    error.value = i18n.t('Recherche de ville indisponible.')
    results.value = []
  }
  finally {
    if (version === requestVersion) busy.value = false
  }
}


function selectCity(result: GameWorldCitySearchResult) {
  emit('update:modelValue', {
    version: 1,
    cityName: result.cityName,
    displayName: result.displayName,
    countryName: result.countryName,
    countryCode: result.countryCode,
    adminName: result.adminName,
    longitude: result.longitude,
    latitude: result.latitude,
    radiusKm: selected.value?.radiusKm ?? WORLD_DEFAULT_RADIUS_KM,
    preferredLocale: result.preferredLocale,
    estimatedPopulation: result.estimatedPopulation,
    osmType: result.osmType,
    osmId: result.osmId,
  })
}

watch(query, value => {
  clearDebounce()
  const normalized = value.trim()
  if (normalized.length < 2) {
    void runSearch('')
    return
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runSearch(normalized)
  }, 320)
})

onBeforeUnmount(clearDebounce)
</script>

<template>
  <section class="world-picker">
    <div class="world-picker__search">
      <label>
        <span>{{ i18n.t('Ville de départ') }}</span>
        <div class="world-picker__input-wrap">
          <input v-model="query" type="search" maxlength="120" :placeholder="i18n.t('Rechercher une ville')" autocomplete="off" spellcheck="false">
          <span v-if="busy" class="world-picker__busy" aria-hidden="true">…</span>
        </div>
      </label>
    </div>

    <div v-if="results.length" class="world-picker__results" role="listbox" :aria-label="i18n.t('Résultats de recherche')">
      <button
        v-for="result in results"
        :key="`${result.countryCode}:${result.cityName}:${result.adminName ?? ''}:${result.latitude.toFixed(4)}:${result.longitude.toFixed(4)}`"
        type="button"
        :class="{ selected: selected?.countryCode === result.countryCode && selected?.cityName === result.cityName && Math.abs((selected?.latitude ?? 999) - result.latitude) < .01 && Math.abs((selected?.longitude ?? 999) - result.longitude) < .01 }"
        @click="selectCity(result)"
      >
        <span class="world-picker__flag"><CountryFlag :code="result.countryCode" /></span>
        <span class="world-picker__result-copy">
          <strong>{{ result.cityName }}</strong>
          <small>{{ [result.adminName, result.countryName].filter(Boolean).join(' · ') }}</small>
        </span>
        <b v-if="selected?.countryCode === result.countryCode && selected?.cityName === result.cityName && Math.abs((selected?.latitude ?? 999) - result.latitude) < .01 && Math.abs((selected?.longitude ?? 999) - result.longitude) < .01">✓</b>
      </button>
    </div>

    <p v-else-if="error" class="world-picker__error">{{ error }}</p>
    <p v-else-if="searched && !busy" class="world-picker__empty">{{ i18n.t('Aucun résultat exploitable.') }}</p>

  </section>
</template>

<style scoped>
.world-picker{display:grid;gap:10px;min-height:0}.world-picker__search{display:grid;gap:6px;padding:4px}.world-picker__search label{display:grid;gap:5px}.world-picker__search label>span{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:rgba(225,239,248,.48)}.world-picker__input-wrap{position:relative}.world-picker__search input{width:100%;min-width:0;height:38px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(4,16,27,.72);color:#edfaff;padding:0 34px 0 10px;outline:none}.world-picker__search input:focus{border-color:rgba(78,228,241,.45);box-shadow:0 0 0 3px rgba(66,214,228,.08)}.world-picker__busy{position:absolute;right:11px;top:50%;transform:translateY(-56%);color:#92f3fa;font-size:18px;font-weight:900;pointer-events:none}.world-picker__results{display:grid;gap:4px;max-height:300px;overflow:auto;padding:1px 3px 1px 1px;scrollbar-width:thin}.world-picker__results>button{width:100%;min-height:54px;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 8px;border:1px solid transparent;border-radius:13px;background:rgba(255,255,255,.018);color:inherit;text-align:left;cursor:pointer}.world-picker__results>button:hover{background:rgba(255,255,255,.045)}.world-picker__results>button.selected{border-color:rgba(73,225,239,.34);background:rgba(48,178,192,.11)}.world-picker__flag{width:36px;height:32px;display:grid;place-items:center;border-radius:9px;background:rgba(255,255,255,.035)}.world-picker__flag :deep(.country-flag){width:25px;height:17px}.world-picker__result-copy{display:grid;gap:2px;min-width:0}.world-picker__result-copy strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.world-picker__result-copy small{font-size:7.5px;color:rgba(225,239,248,.44);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.world-picker__results b{color:#79edf5}.world-picker__error,.world-picker__empty{margin:0;padding:8px 9px;border-radius:10px;font-size:8px;line-height:1.35}.world-picker__error{background:rgba(219,75,75,.08);color:#ffb4b4}.world-picker__empty{color:rgba(225,239,248,.44)}</style>
