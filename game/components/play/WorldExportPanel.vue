<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameI18n } from '../../composables/useGameI18n'
import type { GameLocale } from '../../types/i18n'
import type { GameWorldExportLabelDensity, GameWorldExportLayout, GameWorldExportOptions } from '../../engine/sharing'

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
const layout = ref<GameWorldExportLayout>('READABLE')
const showBasemap = ref(false)

// Une carte réelle et un schéma réarrangé ne peuvent pas partager exactement
// la même géométrie : laisser le choix au joueur sans déformer les rues.
const { locale } = useGameI18n()
const layoutTexts: Record<GameLocale, {
  geographic: string
  schematic: string
  geographicDescription: string
  schematicDescription: string
  basemapHint: string
  noBasemapHint: string
}> = {
  fr: {
    geographic: 'Plan géographique · carte fidèle',
    schematic: 'Plan schématique · recommandé pour un vrai plan de transport',
    geographicDescription: 'Les distances et le fond de carte restent à la même échelle, sans routes ni quartiers étirés.',
    schematicDescription: 'Recommandé pour un rendu propre type plan de transport : modes mieux différenciés, stations plus lisibles et aucun fond déformé.',
    basemapHint: 'Routes, eau et villes à la bonne échelle derrière le réseau.',
    noBasemapHint: 'Désactivé en plan schématique pour privilégier un rendu clair, proche d’un plan de réseau.',
  },
  en: {
    geographic: 'Geographic map · accurate basemap',
    schematic: 'Schematic map · simplified lines',
    geographicDescription: 'Map details and distances keep their geographic proportions without stretched roads or neighbourhoods.',
    schematicDescription: 'The network is rearranged for clarity. The basemap is disabled to prevent geographic distortion.',
    basemapHint: 'Roads, water and cities at the correct scale behind the network.',
    noBasemapHint: 'Unavailable in schematic mode because the map would be distorted.',
  },
  de: {
    geographic: 'Geografischer Plan · maßstabsgetreue Karte',
    schematic: 'Schematischer Plan · vereinfachte Linien',
    geographicDescription: 'Karte und Entfernungen behalten ihre geografischen Proportionen, ohne verzerrte Straßen oder Stadtteile.',
    schematicDescription: 'Das Netz wird übersichtlich angeordnet. Der Kartenhintergrund wird deaktiviert, um Verzerrungen zu vermeiden.',
    basemapHint: 'Straßen, Wasserflächen und Städte im richtigen Maßstab hinter dem Netz.',
    noBasemapHint: 'Im schematischen Modus nicht verfügbar, da die Karte verzerrt würde.',
  },
  nl: {
    geographic: 'Geografische kaart · juiste verhoudingen',
    schematic: 'Schematische kaart · vereenvoudigde lijnen',
    geographicDescription: 'De kaart en afstanden behouden hun geografische verhoudingen, zonder uitgerekte wegen of wijken.',
    schematicDescription: 'Het netwerk wordt voor de leesbaarheid herschikt. De achtergrondkaart wordt uitgeschakeld om vervorming te voorkomen.',
    basemapHint: 'Wegen, water en steden op de juiste schaal achter het netwerk.',
    noBasemapHint: 'Niet beschikbaar in schematische modus: de kaart zou vervormen.',
  },
  es: {
    geographic: 'Plano geográfico · mapa fiel',
    schematic: 'Plano esquemático · líneas simplificadas',
    geographicDescription: 'El mapa y las distancias conservan sus proporciones sin carreteras ni barrios estirados.',
    schematicDescription: 'La red se reorganiza para facilitar la lectura. El mapa de fondo se desactiva para evitar deformaciones.',
    basemapHint: 'Carreteras, agua y ciudades a escala correcta detrás de la red.',
    noBasemapHint: 'No disponible en modo esquemático porque el mapa se deformaría.',
  },
  it: {
    geographic: 'Mappa geografica · sfondo fedele',
    schematic: 'Mappa schematica · linee semplificate',
    geographicDescription: 'Mappa e distanze mantengono le proporzioni geografiche, senza strade o quartieri allungati.',
    schematicDescription: 'La rete viene riorganizzata per essere leggibile. Lo sfondo viene disattivato per evitare distorsioni.',
    basemapHint: 'Strade, acqua e città in scala corretta dietro la rete.',
    noBasemapHint: 'Non disponibile in modalità schematica: la mappa risulterebbe deformata.',
  },
  pt: {
    geographic: 'Mapa geográfico · fundo fiel',
    schematic: 'Mapa esquemático · linhas simplificadas',
    geographicDescription: 'O mapa e as distâncias mantêm as proporções geográficas, sem estradas ou bairros esticados.',
    schematicDescription: 'A rede é reorganizada para facilitar a leitura. O mapa de fundo é desativado para evitar distorções.',
    basemapHint: 'Estradas, água e cidades à escala correta atrás da rede.',
    noBasemapHint: 'Indisponível no modo esquemático: o mapa ficaria distorcido.',
  },
  pl: {
    geographic: 'Mapa geograficzna · wierne tło',
    schematic: 'Mapa schematyczna · uproszczone linie',
    geographicDescription: 'Mapa i odległości zachowują proporcje geograficzne, bez rozciągniętych dróg ani dzielnic.',
    schematicDescription: 'Sieć jest układana dla lepszej czytelności. Tło mapy zostaje wyłączone, aby uniknąć zniekształceń.',
    basemapHint: 'Drogi, woda i miasta we właściwej skali za siecią.',
    noBasemapHint: 'Niedostępne w trybie schematycznym: mapa byłaby zniekształcona.',
  },
}
const layoutCopy = computed(() => layoutTexts[locale.value] ?? layoutTexts.fr)
watch(layout, current => { showBasemap.value = current === 'GEOGRAPHIC' })
const showLegend = ref(true)
const showStats = ref(true)
const showStationIndex = ref(true)

const QHD_SIZE = { width: 2560, height: 1975 } as const

function runExport() {
  emit('export', {
    ...QHD_SIZE,
    labels: labels.value,
    layout: layout.value,
    showBasemap: layout.value === 'GEOGRAPHIC' && showBasemap.value,
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
        <p data-i18n-skip>{{ layout === 'GEOGRAPHIC' ? layoutCopy.geographicDescription : layoutCopy.schematicDescription }}</p>
      </div>

      <div class="options-grid">
        <label><span>Résolution</span><div class="fixed-option">QHD · 2560×1975</div></label>
        <label><span>Noms de stations</span><select v-model="labels"><option value="AUTO">Automatique · sans collisions</option><option value="ALL">Détaillé · sans superposition</option><option value="NONE">Aucun</option></select></label>
        <label><span>Tracé</span><select v-model="layout" aria-label="Type de tracé"><option data-i18n-skip value="GEOGRAPHIC">{{ layoutCopy.geographic }}</option><option data-i18n-skip value="READABLE">{{ layoutCopy.schematic }}</option></select></label>
      </div>

      <div class="switches">
        <label :class="{ 'is-disabled': layout === 'READABLE' }"><input v-model="showBasemap" type="checkbox" :disabled="layout === 'READABLE'"><span><b>Fond cartographique</b><small data-i18n-skip>{{ layout === 'GEOGRAPHIC' ? layoutCopy.basemapHint : layoutCopy.noBasemapHint }}</small></span></label>
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
.share-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.54);backdrop-filter:blur(5px)}.share-panel{width:min(650px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#091117;color:#edf7f7;box-shadow:0 24px 80px rgba(0,0,0,.55);display:grid;gap:16px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}header small{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.48}h2{font-size:21px;margin:3px 0 0}header>button{border:0;background:rgba(255,255,255,.05);color:inherit;width:36px;height:36px;border-radius:10px;font-size:21px;cursor:pointer}.preview-copy{padding:13px 14px;border-radius:14px;background:rgba(75,208,218,.07);border:1px solid rgba(75,208,218,.13)}.preview-copy strong{font-size:13px}.preview-copy p{font-size:10px;opacity:.58;line-height:1.5;margin:5px 0 0}.options-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.options-grid label{display:grid;gap:6px}.options-grid span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.5}.fixed-option,select{width:100%;min-height:42px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#101a21;color:inherit;padding:0 11px;font:inherit}.fixed-option{display:flex;align-items:center;box-sizing:border-box;font-weight:700;color:#dff7f8}.switches{display:grid;gap:8px}.switches label{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:11px;border-radius:12px;background:rgba(255,255,255,.035);cursor:pointer}.switches input{width:17px;height:17px}.switches label.is-disabled{opacity:.6;cursor:not-allowed}.switches span{display:grid;gap:2px}.switches b{font-size:11px}.switches small{font-size:9px;opacity:.5}footer{display:flex;justify-content:flex-end;gap:8px}footer button{border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:inherit;padding:10px 14px;cursor:pointer}footer .primary{background:#42c9d1;color:#061014;border-color:transparent;font-weight:800}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:620px){.share-backdrop{align-items:end;padding:8px}.share-panel{border-radius:20px 20px 14px 14px;max-height:88vh}.options-grid{grid-template-columns:1fr}footer button{flex:1}}
</style>
