<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, reactive, ref, watch } from 'vue'
import CountryFlag from '../common/CountryFlag.vue'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameAudio } from '../../composables/useGameAudio'
import {
  GAME_TERRITORY_CATALOG,
  getAvailableGameTerritories,
  getGameTerritoryCatalogEntry,
} from '../../config/territories'
import type { GameTerritory } from '../../types/game'
import type {
  GameGeneratedTerritoryDensity,
  GameGeneratedTerritorySettings,
  GameGeneratedTerritorySize,
  GameGeneratedTerritoryStructure,
  GameGeneratedTerritoryWater,
} from '../../types/generatedTerritory'
import {
  createDefaultGeneratedTerritorySettings,
  createRandomGeneratedTerritorySeed,
  generateGeneratedTerritory,
  generatedTerritoryAutomaticName,
  normalizeGeneratedTerritorySeed,
} from '../../engine/territory/generator'
import {
  GAME_FREE_PLAY_CAPITALS,
  GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL,
  GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL,
  createDefaultFreePlaySettings,
} from '../../config/freePlay'
import type {
  GameCapitalPreset,
  GameEconomyProfile,
  GameEventFrequency,
  GameFreePlaySettings,
} from '../../types/freePlay'

const game = useMetropoleGame()
const audio = useGameAudio()
const gameName = ref('Ma métropole')
const isStarting = ref(false)
const startError = ref<string | null>(null)
const selectedTerritory = ref<GameTerritory>('ILE_DE_FRANCE')
const territoryNotice = ref<string | null>(null)
const settings = reactive<GameFreePlaySettings>(createDefaultFreePlaySettings())
const generatedTerritory = reactive<GameGeneratedTerritorySettings>(createDefaultGeneratedTerritorySettings())
const includeGeneratedInRandom = ref(true)
const generatedNameEdited = ref(false)
const mapChooserOpen = ref(true)

const capitalOptions: Array<{ id: GameCapitalPreset; title: string; subtitle: string; amount?: number }> = [
  { id: 'STANDARD', title: 'Standard', subtitle: 'L’équilibre CLU prévu par défaut.', amount: GAME_FREE_PLAY_CAPITALS.STANDARD },
  { id: 'COMFORT', title: 'Confort', subtitle: 'Plus de marge pour construire sans supprimer les contraintes.', amount: GAME_FREE_PLAY_CAPITALS.COMFORT },
  { id: 'RICH', title: 'Riche', subtitle: 'Une métropole très financée dès le départ.', amount: GAME_FREE_PLAY_CAPITALS.RICH },
  { id: 'CUSTOM', title: 'Personnalisé', subtitle: 'Choisissez le capital et activez éventuellement la Triche.' },
]

const economyOptions: Array<{ id: GameEconomyProfile; title: string; subtitle: string }> = [
  { id: 'GENEROUS', title: 'Généreuse', subtitle: 'Recettes légèrement meilleures et exploitation moins coûteuse.' },
  { id: 'STANDARD', title: 'Standard', subtitle: 'Équilibre économique de référence.' },
  { id: 'HARD', title: 'Exigeante', subtitle: 'Marges plus faibles, coûts et financement plus stricts.' },
]

const eventOptions: Array<{ id: GameEventFrequency; title: string; subtitle: string }> = [
  { id: 'CALM', title: 'Calme', subtitle: 'Moins de sollicitations, davantage de temps entre les événements.' },
  { id: 'STANDARD', title: 'Standard', subtitle: 'Rythme recommandé.' },
  { id: 'FREQUENT', title: 'Fréquente', subtitle: 'Davantage d’opportunités et d’informations contextuelles.' },
]

const trimmedGameName = computed(() => gameName.value.trim())
const canStart = computed(() => trimmedGameName.value.length > 0 && !isStarting.value)
const capitalLabel = computed(() => settings.cheatUnlimitedMoney
  ? 'Triche · argent illimité'
  : money(settings.startingCapital))
const profileLabel = computed(() => capitalOptions.find(item => item.id === settings.capitalPreset)?.title ?? 'Standard')
const economyLabel = computed(() => economyOptions.find(item => item.id === settings.economyProfile)?.title ?? 'Standard')
const eventLabel = computed(() => eventOptions.find(item => item.id === settings.eventFrequency)?.title ?? 'Standard')
const selectedTerritoryEntry = computed(() => getGameTerritoryCatalogEntry(selectedTerritory.value))
const territoryCatalog = GAME_TERRITORY_CATALOG
const playableMapCount = computed(() => GAME_TERRITORY_CATALOG.filter(entry => entry.status === 'AVAILABLE').length + 1)
const plannedMapCount = computed(() => GAME_TERRITORY_CATALOG.filter(entry => entry.status === 'PLANNED').length)
const generatedRuntime = computed(() => generateGeneratedTerritory(generatedTerritory))
const generatedSummary = computed(() => generatedRuntime.value.summary)
const selectedTerritoryLabel = computed(() => selectedTerritory.value === 'GENERATED' ? generatedTerritory.name : selectedTerritoryEntry.value.label)
const selectedTerritoryDescription = computed(() => selectedTerritory.value === 'GENERATED'
  ? `Seed ${generatedTerritory.seed} · ${generatedSummary.value.departmentCount} départements · ${generatedSummary.value.municipalityCount} communes`
  : selectedTerritoryEntry.value.description)

const sizeOptions: Array<{ id: GameGeneratedTerritorySize; label: string }> = [
  { id: 'SMALL', label: 'Petite' }, { id: 'MEDIUM', label: 'Moyenne' }, { id: 'LARGE', label: 'Grande' },
]
const densityOptions: Array<{ id: GameGeneratedTerritoryDensity; label: string }> = [
  { id: 'LOW', label: 'Faible' }, { id: 'STANDARD', label: 'Standard' }, { id: 'HIGH', label: 'Forte' },
]
const structureOptions: Array<{ id: GameGeneratedTerritoryStructure; label: string }> = [
  { id: 'MONOCENTRIC', label: 'Monocentrique' }, { id: 'POLYCENTRIC', label: 'Polycentrique' }, { id: 'SPRAWLED', label: 'Étendue' },
]
const waterOptions: Array<{ id: GameGeneratedTerritoryWater; label: string }> = [
  { id: 'LOW', label: 'Faible' }, { id: 'STANDARD', label: 'Standard' }, { id: 'HIGH', label: 'Importante' },
]

watch(() => settings.capitalPreset, preset => {
  if (preset !== 'CUSTOM') {
    settings.startingCapital = GAME_FREE_PLAY_CAPITALS[preset]
    settings.cheatUnlimitedMoney = false
  }
})

watch(() => settings.cheatUnlimitedMoney, enabled => {
  if (enabled) settings.capitalPreset = 'CUSTOM'
})

watch(() => generatedTerritory.seed, seed => {
  const normalized = normalizeGeneratedTerritorySeed(seed)
  if (normalized !== generatedTerritory.seed) generatedTerritory.seed = normalized
  if (!generatedNameEdited.value) generatedTerritory.name = generatedTerritoryAutomaticName(normalized)
})

function money(value: number) {
  return new Intl.NumberFormat(currentGameLocaleTag(), {
    style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
  }).format(value)
}

function selectCapital(preset: GameCapitalPreset) {
  audio.playUi('CLICK')
  settings.capitalPreset = preset
}

function selectTerritory(territory: GameTerritory) {
  audio.playUi('CLICK')
  const entry = getGameTerritoryCatalogEntry(territory)
  if (entry.status !== 'AVAILABLE') {
    territoryNotice.value = `« ${entry.label} » est déjà prévue dans le catalogue CLU Métropole. Elle reste affichée comme territoire futur et n'est pas encore jouable dans cette version.`
    return
  }
  selectedTerritory.value = territory
  territoryNotice.value = null
}

function selectRandomTerritory() {
  audio.playUi('CLICK')
  const available = getAvailableGameTerritories()
  const choices: Array<GameTerritory> = available.map(entry => entry.id)
  if (includeGeneratedInRandom.value) choices.push('GENERATED')
  const choice = choices[Math.floor(Math.random() * choices.length)] ?? 'ILE_DE_FRANCE'
  if (choice === 'GENERATED') {
    randomizeGeneratedTerritory()
    selectedTerritory.value = 'GENERATED'
    territoryNotice.value = `Random a généré ${generatedTerritory.name} · seed ${generatedTerritory.seed}.`
    return
  }
  selectedTerritory.value = choice
  territoryNotice.value = `Random a choisi ${getGameTerritoryCatalogEntry(choice).label}.`
}

function selectGeneratedTerritory() {
  audio.playUi('CLICK')
  selectedTerritory.value = 'GENERATED'
  territoryNotice.value = 'La carte fictive est générée entièrement dans votre navigateur. La même seed recrée exactement le même territoire.'
}

function randomizeGeneratedTerritory() {
  audio.playUi('CLICK')
  const seed = createRandomGeneratedTerritorySeed()
  generatedTerritory.seed = seed
  if (!generatedNameEdited.value) generatedTerritory.name = generatedTerritoryAutomaticName(seed)
}

function resetGeneratedName() {
  generatedNameEdited.value = false
  generatedTerritory.name = generatedTerritoryAutomaticName(generatedTerritory.seed)
}

async function startGame() {
  if (!canStart.value) return
  isStarting.value = true
  startError.value = null
  try {
    if (settings.capitalPreset === 'CUSTOM') {
      settings.startingCapital = Math.min(
        GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL,
        Math.max(GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL, Math.round(Number(settings.startingCapital) || GAME_FREE_PLAY_CAPITALS.STANDARD)),
      )
    }
    await game.createGame(
      trimmedGameName.value,
      JSON.parse(JSON.stringify(settings)),
      selectedTerritory.value,
      selectedTerritory.value === 'GENERATED' ? JSON.parse(JSON.stringify(generatedTerritory)) : null,
    )
    audio.playUi('CONFIRM')
  }
  catch (error) {
    audio.playUi('ERROR')
    startError.value = error instanceof Error ? error.message : 'Impossible de créer la partie.'
  }
  finally {
    isStarting.value = false
  }
}
</script>

<template>
  <main class="setup">
    <div class="setup__background" />
    <div class="setup__shade" />

    <section class="setup__shell">
      <header class="setup__header">
        <button class="back-button" type="button" @click="audio.playUi('CLICK'); game.returnHome()">← Retour</button>
        <div>
          <p class="eyebrow">CLU Métropole · Partie libre</p>
          <h1>Configurer la partie</h1>
          <p>Choisissez votre cadre de départ. Les règles structurantes sont enregistrées avec cette sauvegarde.</p>
        </div>
      </header>

      <div class="setup__layout">
        <div class="setup__content">
          <section class="setup-card">
            <div class="section-title"><b>01</b><div><h2>Identité & territoire</h2><p>Votre partie et la carte utilisée.</p></div></div>
            <label class="field">Nom de la partie<input v-model="gameName" type="text" maxlength="50" placeholder="Ma métropole" autocomplete="off"></label>

            <div class="map-picker-heading">
              <div>
                <strong>Choisir une carte</strong>
                <small>Choisissez une région réelle ou générez une métropole inédite. Les cartes fictives utilisent le même moteur de simulation que Paris.</small>
              </div>
              <div class="map-picker-actions"><span class="map-picker-count">{{ playableMapCount }} jouables · {{ plannedMapCount }} à venir</span><button type="button" class="map-picker-toggle" :aria-expanded="mapChooserOpen" @click="mapChooserOpen = !mapChooserOpen">{{ mapChooserOpen ? 'Replier' : 'Déplier' }}</button></div>
            </div>

            <div v-if="mapChooserOpen" class="stage-grid">
              <button type="button" class="stage-card stage-card--special" @click="selectRandomTerritory">
                <div class="stage-preview stage-preview--random"><span class="stage-random-mark">?</span><b>RANDOM</b></div>
                <div class="stage-meta"><strong>Random</strong><small>Choisit une carte jouable au hasard.</small></div>
              </button>

              <button type="button" class="stage-card stage-card--special" :class="{ selected: selectedTerritory === 'GENERATED' }" :aria-pressed="selectedTerritory === 'GENERATED'" @click="selectGeneratedTerritory">
                <div class="stage-preview stage-preview--generated"><span class="generated-grid">◇</span><b>SEED</b></div>
                <div class="stage-meta"><strong>Carte fictive</strong><small>Une région entière générée localement.</small></div>
                <span class="stage-status">Jouable</span>
                <span v-if="selectedTerritory === 'GENERATED'" class="stage-selected">✓</span>
              </button>

              <button
                v-for="territory in territoryCatalog"
                :key="territory.id"
                type="button"
                class="stage-card"
                :class="[{ selected: selectedTerritory === territory.id, planned: territory.status !== 'AVAILABLE' }, `stage-card--${territory.previewKey}`]"
                :aria-pressed="selectedTerritory === territory.id"
                @click="selectTerritory(territory.id)"
              >
                <div class="stage-preview" :class="`stage-preview--${territory.previewKey}`">
                  <span class="stage-country stage-country--flag" :title="territory.countryCode"><CountryFlag :code="territory.countryCode" /></span>
                  <b>{{ territory.shortCode }}</b>
                  <span class="stage-lines" aria-hidden="true" />
                </div>
                <div class="stage-meta">
                  <strong>{{ territory.label }}</strong>
                  <small>{{ territory.traits.join(' · ') }}</small>
                </div>
                <span v-if="territory.status === 'AVAILABLE'" class="stage-status">Jouable</span>
                <span v-else class="stage-status stage-status--planned">À venir</span>
                <span v-if="selectedTerritory === territory.id" class="stage-selected">✓</span>
              </button>
            </div>

            <div v-if="mapChooserOpen && selectedTerritory === 'GENERATED'" class="generated-config">
              <div class="generated-config__head">
                <div><strong>Générateur de région</strong><small>La seed reconstruit une vraie région de jeu : plusieurs départements, des centaines de communes, de nombreux pôles et un réseau de fond complet.</small></div>
                <button type="button" class="seed-reroll" @click="randomizeGeneratedTerritory">↻ Nouvelle seed</button>
              </div>

              <div class="generated-fields">
                <label class="field">Seed
                  <div class="seed-field"><input v-model="generatedTerritory.seed" type="text" maxlength="18" spellcheck="false" autocomplete="off"><button type="button" @click="randomizeGeneratedTerritory">🎲</button></div>
                </label>
                <label class="field">Nom de la région
                  <div class="seed-field"><input v-model="generatedTerritory.name" type="text" maxlength="60" autocomplete="off" @input="generatedNameEdited = true"><button type="button" title="Rétablir le nom automatique" @click="resetGeneratedName">↺</button></div>
                </label>
              </div>

              <div class="generator-options">
                <div><span>Taille</span><div class="generator-segments"><button v-for="option in sizeOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.size === option.id }" :aria-pressed="generatedTerritory.size === option.id" @click="generatedTerritory.size = option.id">{{ option.label }}</button></div></div>
                <div><span>Densité</span><div class="generator-segments"><button v-for="option in densityOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.density === option.id }" :aria-pressed="generatedTerritory.density === option.id" @click="generatedTerritory.density = option.id">{{ option.label }}</button></div></div>
                <div><span>Structure urbaine</span><div class="generator-segments"><button v-for="option in structureOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.structure === option.id }" :aria-pressed="generatedTerritory.structure === option.id" @click="generatedTerritory.structure = option.id">{{ option.label }}</button></div></div>
                <div><span>Eau</span><div class="generator-segments"><button v-for="option in waterOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.water === option.id }" :aria-pressed="generatedTerritory.water === option.id" @click="generatedTerritory.water = option.id">{{ option.label }}</button></div></div>
              </div>

              <div class="generated-preview-stats">
                <span><small>Population potentielle</small><b>{{ new Intl.NumberFormat(currentGameLocaleTag(),{notation:'compact',maximumFractionDigits:1}).format(generatedSummary.population) }}</b></span>
                <span><small>Communes</small><b>{{ generatedSummary.municipalityCount }}</b></span>
                <span><small>Départements</small><b>{{ generatedSummary.departmentCount }}</b></span>
                <span><small>Pôles urbains</small><b>{{ generatedSummary.urbanCenterCount }}</b></span>
                <span><small>Superficie</small><b>≈ {{ new Intl.NumberFormat(currentGameLocaleTag()).format(generatedSummary.areaKm2) }} km²</b></span>
              </div>
              <p class="generator-note">Même seed + mêmes paramètres = exactement la même géographie, les mêmes communes et les mêmes populations. Aucune donnée de carte n’est envoyée à un serveur.</p>
            </div>

            <label class="random-generated-toggle"><input v-model="includeGeneratedInRandom" type="checkbox"><span><strong>Random peut choisir une carte fictive</strong><small>Désactivez ceci pour limiter Random aux régions réelles installées.</small></span></label>

            <div class="selected-territory-card">
              <span class="territory-icon"><span v-if="selectedTerritory === 'GENERATED'">◇</span><CountryFlag v-else :code="selectedTerritoryEntry.countryCode" /></span>
              <div>
                <strong>{{ selectedTerritoryLabel }}</strong>
                <small>{{ selectedTerritoryDescription }}</small>
              </div>
              <span class="pill">Sélectionnée</span>
            </div>
            <p v-if="territoryNotice" class="territory-notice">{{ territoryNotice }}</p>
          </section>

          <section class="setup-card">
            <div class="section-title"><b>02</b><div><h2>Capital de départ</h2><p>Personnalisez les contraintes financières de votre partie libre.</p></div></div>
            <div class="choice-grid">
              <button v-for="option in capitalOptions" :key="option.id" type="button" class="choice" :class="{ selected: settings.capitalPreset === option.id }" :aria-pressed="settings.capitalPreset === option.id" @click="selectCapital(option.id)">
                <span class="choice-check">{{ settings.capitalPreset === option.id ? '✓' : '' }}</span>
                <strong>{{ option.title }}</strong>
                <small>{{ option.subtitle }}</small>
                <em v-if="option.amount">{{ money(option.amount) }}</em>
              </button>
            </div>

            <div v-if="settings.capitalPreset === 'CUSTOM'" class="custom-box">
              <label class="field">Capital personnalisé<input v-model.number="settings.startingCapital" type="number" :min="GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL" :max="GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL" step="10000000"></label>
              <label class="cheat-toggle"><input v-model="settings.cheatUnlimitedMoney" type="checkbox"><span><strong>Triche · argent illimité</strong><small>Les coûts restent calculés et visibles, mais ils ne bloquent plus vos investissements ni ne réduisent votre trésorerie.</small></span></label>
            </div>
          </section>

          <section class="setup-card">
            <div class="section-title"><b>03</b><div><h2>Économie & événements</h2><p>Choisissez le rythme sans modifier les mécaniques fondamentales.</p></div></div>
            <h3>Économie</h3>
            <div class="segmented three">
              <button v-for="option in economyOptions" :key="option.id" type="button" :class="{ active: settings.economyProfile === option.id }" :aria-pressed="settings.economyProfile === option.id" @click="settings.economyProfile = option.id"><strong>{{ option.title }}</strong><small>{{ option.subtitle }}</small></button>
            </div>
            <h3>Événements & Infos</h3>
            <div class="segmented three">
              <button v-for="option in eventOptions" :key="option.id" type="button" :class="{ active: settings.eventFrequency === option.id }" :aria-pressed="settings.eventFrequency === option.id" @click="settings.eventFrequency = option.id"><strong>{{ option.title }}</strong><small>{{ option.subtitle }}</small></button>
            </div>
          </section>

          <section class="setup-card">
            <div class="section-title"><b>04</b><div><h2>Profondeur de gestion</h2><p>CLU peut vous guider ou vous laisser davantage de contrôle dès le départ.</p></div></div>
            <div class="management-list">
              <div><span><strong>Tarification</strong><small>Guidée = profils simples · Libre = réglage détaillé dès le départ.</small></span><div class="mini-tabs"><button type="button" :class="{ active: settings.fareGuidance === 'GUIDED' }" :aria-pressed="settings.fareGuidance === 'GUIDED'" @click="settings.fareGuidance = 'GUIDED'">Guidée</button><button type="button" :class="{ active: settings.fareGuidance === 'MANUAL' }" :aria-pressed="settings.fareGuidance === 'MANUAL'" @click="settings.fareGuidance = 'MANUAL'">Libre</button></div></div>
              <div><span><strong>Contrôle & fraude</strong><small>Auto adapte les contrôleurs ; Manuel démarre les nouvelles lignes en contrôle personnalisé.</small></span><div class="mini-tabs"><button type="button" :class="{ active: settings.inspectionGuidance === 'GUIDED' }" :aria-pressed="settings.inspectionGuidance === 'GUIDED'" @click="settings.inspectionGuidance = 'GUIDED'">Auto</button><button type="button" :class="{ active: settings.inspectionGuidance === 'MANUAL' }" :aria-pressed="settings.inspectionGuidance === 'MANUAL'" @click="settings.inspectionGuidance = 'MANUAL'">Manuel</button></div></div>
              <div><span><strong>Régulation</strong><small>Auto gère les réserves ; Manuel vous laisse décider des renforts.</small></span><div class="mini-tabs"><button type="button" :class="{ active: settings.regulationGuidance === 'GUIDED' }" :aria-pressed="settings.regulationGuidance === 'GUIDED'" @click="settings.regulationGuidance = 'GUIDED'">Auto</button><button type="button" :class="{ active: settings.regulationGuidance === 'MANUAL' }" :aria-pressed="settings.regulationGuidance === 'MANUAL'" @click="settings.regulationGuidance = 'MANUAL'">Manuel</button></div></div>
            </div>
          </section>

          <section class="setup-card">
            <div class="section-title"><b>05</b><div><h2>Objectifs de partie</h2><p>Choisissez si CLU doit proposer des objectifs dynamiques pendant cette sauvegarde.</p></div></div>
            <div class="toggle-grid toggle-grid--single">
              <label><input v-model="settings.objectivesEnabled" type="checkbox"><span><strong>Objectifs dynamiques</strong><small>Génère des objectifs adaptés à votre réseau et à sa progression. Les réglages d’affichage et de performances sont désormais dans Paramètres.</small></span></label>
            </div>
          </section>

          <p v-if="startError" class="setup-error">{{ startError }}</p>
        </div>

        <aside class="summary-card">
          <span class="eyebrow">Résumé de la partie</span>
          <h2>{{ trimmedGameName || 'Ma métropole' }}</h2>
          <div class="summary-map"><span><span v-if="selectedTerritory === 'GENERATED'">◇</span><CountryFlag v-else :code="selectedTerritoryEntry.countryCode" /></span><div><strong>{{ selectedTerritoryLabel }}</strong><small>{{ selectedTerritory === 'GENERATED' ? `Carte fictive · seed ${generatedTerritory.seed}` : 'Partie libre · carte réelle' }}</small></div></div>
          <dl>
            <div><dt>Capital</dt><dd>{{ capitalLabel }}</dd></div>
            <div><dt>Profil</dt><dd>{{ profileLabel }}</dd></div>
            <div><dt>Économie</dt><dd>{{ economyLabel }}</dd></div>
            <div><dt>Événements</dt><dd>{{ eventLabel }}</dd></div>
            <div><dt>Objectifs</dt><dd>{{ settings.objectivesEnabled ? 'Actifs' : 'Désactivés' }}</dd></div>
          </dl>
          <div v-if="settings.cheatUnlimitedMoney" class="cheat-badge">⚡ Triche activée</div>
          <p>Les règles de partie sont enregistrées avec la sauvegarde. Apparence et graphismes sont des préférences globales réglables à tout moment dans Paramètres.</p>
          <button class="start-button" type="button" :disabled="!canStart" @click="startGame">{{ isStarting ? 'Création…' : 'Lancer la partie' }}</button>
          <button class="cancel-button" type="button" @click="audio.playUi('CLICK'); game.returnHome()">Annuler</button>
        </aside>
      </div>
    </section>
  </main>
</template>

<style scoped>
.setup{position:relative;min-height:100vh;background:#071018;color:#f4f7fb;overflow:auto}.setup__background{position:fixed;inset:-30px;background:linear-gradient(90deg,rgba(5,11,18,.3),rgba(5,11,18,.05)),url('/game/menu-idf.svg') center/cover no-repeat;filter:blur(5px) saturate(.7) brightness(.7);transform:scale(1.03)}.setup__shade{position:fixed;inset:0;background:linear-gradient(90deg,rgba(4,10,16,.96),rgba(4,10,16,.82) 55%,rgba(4,10,16,.62))}.setup__shell{position:relative;z-index:2;width:min(1280px,calc(100% - 36px));margin:0 auto;padding:36px 0 64px}.setup__header{display:flex;align-items:flex-start;gap:24px;margin-bottom:26px}.setup__header h1{margin:3px 0 6px;font-size:clamp(28px,4vw,46px);letter-spacing:-.04em}.setup__header p{margin:0;color:rgba(255,255,255,.62);max-width:720px;line-height:1.55}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:calc(10px * var(--clu-text-scale,1));font-weight:800;color:#78d8df!important}.back-button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}.setup__layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;align-items:start}.setup__content{display:grid;gap:16px}.setup-card,.summary-card{border:1px solid rgba(255,255,255,.09);background:rgba(12,23,34,.87);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.2)}.setup-card{border-radius:16px;padding:20px}.summary-card{position:sticky;top:22px;border-radius:16px;padding:20px}.section-title{display:flex;gap:13px;align-items:flex-start;margin-bottom:17px}.section-title>b{display:grid;place-items:center;min-width:30px;height:30px;border-radius:9px;background:rgba(90,210,220,.12);color:#86e2e8;font-size:calc(11px * var(--clu-text-scale,1))}.section-title h2{margin:0;font-size:calc(18px * var(--clu-text-scale,1))}.section-title p{margin:3px 0 0;font-size:calc(12px * var(--clu-text-scale,1));color:rgba(255,255,255,.52)}.field{display:grid;gap:6px;font-size:calc(11px * var(--clu-text-scale,1));font-weight:700;color:rgba(255,255,255,.7)}input[type=text],input[type=number]{border:1px solid rgba(255,255,255,.12);background:#0b1722;color:#fff;border-radius:10px;padding:11px 12px;outline:none}.territory-card{margin-top:12px;padding:13px;border:1px solid rgba(100,210,220,.32);border-radius:12px;background:rgba(70,195,205,.075);display:flex;justify-content:space-between;gap:12px;align-items:center}.territory-card>div,.summary-map{display:flex;align-items:center;gap:11px}.territory-card small,.summary-map small{display:block;margin-top:2px;color:rgba(255,255,255,.5)}.territory-icon,.summary-map>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#172c39;font-size:calc(11px * var(--clu-text-scale,1));font-weight:900}.pill{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;padding:5px 7px;border-radius:999px;background:rgba(90,215,180,.12);color:#97e5bd}.choice-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.choice,.segmented button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;border-radius:12px;padding:12px;text-align:left;cursor:pointer;display:grid;gap:5px;position:relative}.choice:hover,.segmented button:hover{background:rgba(255,255,255,.06)}.choice.selected,.segmented button.active{border-color:rgba(85,210,220,.55);background:rgba(70,195,205,.12)}.choice strong,.segmented strong{font-size:calc(12px * var(--clu-text-scale,1))}.choice small,.segmented small{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.35;color:rgba(255,255,255,.5)}.choice em{font-style:normal;color:#93e2e7;font-size:calc(11px * var(--clu-text-scale,1));font-weight:800}.choice-check{position:absolute;right:8px;top:8px;color:#8de0e6}.custom-box{margin-top:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,.03);display:grid;gap:12px}.cheat-toggle,.toggle-grid label{display:flex;align-items:flex-start;gap:9px}.cheat-toggle small,.toggle-grid small{display:block;margin-top:3px;color:rgba(255,255,255,.5);line-height:1.35}.cheat-toggle input,.toggle-grid input{margin-top:3px}.setup-card h3{font-size:calc(11px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.55);margin:18px 0 8px}.segmented{display:grid;gap:8px}.segmented.three{grid-template-columns:repeat(3,minmax(0,1fr))}.management-list{display:grid;gap:10px}.management-list>div{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:12px;border-radius:12px;background:rgba(255,255,255,.03)}.management-list small{display:block;margin-top:3px;color:rgba(255,255,255,.48);font-size:calc(10px * var(--clu-text-scale,1))}.mini-tabs{display:flex;gap:4px;flex:0 0 auto}.mini-tabs button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:inherit;border-radius:8px;padding:7px 9px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}.mini-tabs button.active{background:rgba(65,195,205,.15);border-color:rgba(65,195,205,.5)}.toggle-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.toggle-grid label{padding:11px;border-radius:11px;background:rgba(255,255,255,.03);font-size:calc(11px * var(--clu-text-scale,1))}.inline-toggles{display:flex;gap:18px;margin-top:10px;font-size:calc(11px * var(--clu-text-scale,1))}.summary-card h2{margin:5px 0 15px;font-size:calc(22px * var(--clu-text-scale,1))}.summary-map{padding:11px;border-radius:12px;background:rgba(255,255,255,.04);margin-bottom:14px}.summary-card dl{margin:0;display:grid}.summary-card dl>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}.summary-card dt{font-size:calc(10px * var(--clu-text-scale,1));color:rgba(255,255,255,.48)}.summary-card dd{margin:0;text-align:right;font-size:calc(11px * var(--clu-text-scale,1));font-weight:750}.summary-card>p{font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;color:rgba(255,255,255,.45);margin:14px 0}.cheat-badge{margin-top:12px;padding:8px 10px;border-radius:9px;background:rgba(238,190,64,.12);color:#f6d67b;font-size:calc(11px * var(--clu-text-scale,1));font-weight:800}.start-button,.cancel-button{width:100%;border-radius:10px;padding:11px 13px;font:inherit;font-weight:800;cursor:pointer}.start-button{border:1px solid rgba(80,215,205,.55);background:linear-gradient(135deg,#36aeb4,#267985);color:#fff}.start-button:disabled{opacity:.35;cursor:default}.cancel-button{margin-top:7px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.7)}.setup-error{padding:12px;border-radius:10px;background:rgba(220,70,70,.12);color:#ff9e9e}.toggle-grid--single{grid-template-columns:1fr}@media(max-width:980px){.setup__layout{grid-template-columns:1fr}.summary-card{position:static}.choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stage-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.setup__shell{width:min(100% - 20px,1280px);padding-top:16px}.setup__header{display:grid;gap:12px}.choice-grid,.segmented.three,.toggle-grid{grid-template-columns:1fr}.management-list>div{align-items:flex-start;flex-direction:column}.inline-toggles{display:grid;gap:7px}.stage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.map-picker-actions{display:flex;align-items:center;gap:8px}.map-picker-toggle{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer}.map-picker-heading{align-items:flex-start;flex-direction:column}.selected-territory-card{grid-template-columns:auto 1fr}.selected-territory-card .pill{display:none}}

.map-picker-actions{display:flex;align-items:center;gap:8px}.map-picker-toggle{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer}.map-picker-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin:18px 0 10px}.map-picker-heading>div{display:grid;gap:3px}.map-picker-heading strong{font-size:calc(13px * var(--clu-text-scale,1))}.map-picker-heading small{color:rgba(255,255,255,.48);font-size:calc(10px * var(--clu-text-scale,1));line-height:1.4}.map-picker-count{flex:0 0 auto;font-size:calc(9px * var(--clu-text-scale,1));font-weight:850;letter-spacing:.07em;text-transform:uppercase;color:#8ce2e7;background:rgba(67,194,204,.09);border:1px solid rgba(78,207,216,.22);padding:6px 8px;border-radius:999px}.stage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stage-card{position:relative;border:1px solid rgba(255,255,255,.095);border-radius:13px;background:rgba(255,255,255,.025);padding:7px;color:inherit;text-align:left;cursor:pointer;overflow:hidden;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}.stage-card:hover{transform:translateY(-2px);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.18)}.stage-card.selected{border-color:rgba(91,224,230,.82);background:rgba(65,196,205,.09);box-shadow:0 0 0 1px rgba(83,215,222,.2),0 10px 28px rgba(0,0,0,.2)}.stage-card.planned{opacity:.72}.stage-card.planned:hover{opacity:.94}.stage-preview{position:relative;height:78px;border-radius:9px;overflow:hidden;display:flex;align-items:flex-end;justify-content:flex-end;padding:8px;background:linear-gradient(145deg,#182632,#0f1720);isolation:isolate}.stage-preview::before,.stage-preview::after{content:'';position:absolute;inset:0;pointer-events:none}.stage-preview::before{background:radial-gradient(circle at 22% 26%,rgba(255,255,255,.22) 0 1px,transparent 2px),radial-gradient(circle at 58% 68%,rgba(255,255,255,.15) 0 1px,transparent 2px);background-size:28px 28px,33px 33px;opacity:.45}.stage-preview::after{inset:-30% -10%;background:linear-gradient(118deg,transparent 22%,rgba(255,255,255,.11) 23% 25%,transparent 26% 52%,rgba(255,255,255,.08) 53% 55%,transparent 56%);transform:rotate(-7deg);opacity:.55}.stage-preview>b{position:relative;z-index:2;font-size:calc(20px * var(--clu-text-scale,1));letter-spacing:.06em;text-shadow:0 2px 8px rgba(0,0,0,.5)}.stage-country{position:absolute;z-index:3;left:7px;top:7px;padding:4px 5px;border-radius:6px;background:rgba(4,10,16,.74);border:1px solid rgba(255,255,255,.14);font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.08em}.stage-country--flag{display:grid;place-items:center;line-height:1;letter-spacing:0;padding:4px 5px}.stage-lines{position:absolute;z-index:1;width:78%;height:58%;left:-8%;bottom:9%;border:3px solid rgba(255,255,255,.25);border-left:0;border-radius:0 90px 90px 0;transform:rotate(-8deg)}.stage-meta{display:grid;gap:2px;padding:8px 3px 3px}.stage-meta strong{font-size:calc(11px * var(--clu-text-scale,1));line-height:1.2}.stage-meta small{font-size:calc(8.5px * var(--clu-text-scale,1));color:rgba(255,255,255,.44);line-height:1.3}.stage-status{position:absolute;left:12px;top:61px;z-index:4;padding:3px 5px;border-radius:6px;background:rgba(30,184,136,.9);color:#06120f;font-size:calc(7px * var(--clu-text-scale,1));font-weight:950;text-transform:uppercase;letter-spacing:.05em}.stage-status--planned{background:rgba(7,12,17,.82);color:rgba(255,255,255,.64);border:1px solid rgba(255,255,255,.12)}.stage-selected{position:absolute;right:9px;top:9px;z-index:5;display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#76e3e7;color:#071216;font-size:calc(12px * var(--clu-text-scale,1));font-weight:1000;box-shadow:0 5px 12px rgba(0,0,0,.25)}.stage-card--special .stage-preview{align-items:center;justify-content:center;gap:8px}.stage-card--special .stage-preview>b{font-size:calc(11px * var(--clu-text-scale,1))}.stage-random-mark,.generated-grid{position:relative;z-index:2;font-size:calc(34px * var(--clu-text-scale,1));font-weight:950;line-height:1}.stage-preview--random{background:radial-gradient(circle at 72% 30%,rgba(119,234,221,.55),transparent 20%),linear-gradient(135deg,#121920,#283140)}.stage-preview--generated{background:radial-gradient(circle at 36% 30%,rgba(139,104,255,.48),transparent 22%),linear-gradient(145deg,#111722,#1b2535)}.stage-preview--paris{background:linear-gradient(135deg,rgba(66,116,153,.78),rgba(54,62,91,.78)),url('/game/menu-idf.svg') center/cover no-repeat}.stage-preview--london{background:linear-gradient(145deg,#253347,#5f4144)}.stage-preview--berlin{background:linear-gradient(145deg,#273328,#4b4541)}.stage-preview--randstad{background:linear-gradient(145deg,#183a47,#215c64)}.stage-preview--brussels{background:linear-gradient(145deg,#3d2f47,#594934)}.stage-preview--madrid{background:linear-gradient(145deg,#49322c,#6b5137)}.stage-preview--milan{background:linear-gradient(145deg,#273c37,#455b52)}.stage-preview--warsaw{background:linear-gradient(145deg,#283848,#4a5864)}.stage-preview--lisbon{background:linear-gradient(145deg,#1f4852,#66543f)}.stage-preview--prague{background:linear-gradient(145deg,#3f3547,#594a50)}.stage-preview--bern{background:linear-gradient(145deg,#33412f,#61563b)}.stage-preview--new-york{background:linear-gradient(145deg,#27364a,#654340)}.stage-preview--montreal{background:linear-gradient(145deg,#293c49,#4b5d68)}.stage-preview--tokyo{background:linear-gradient(145deg,#3f334b,#65455e)}.stage-preview--ottawa{background:linear-gradient(145deg,#263d46,#46685d)}.stage-preview--vienna{background:linear-gradient(145deg,#43353f,#695652)}.stage-preview--copenhagen{background:linear-gradient(145deg,#1f4652,#365f6c)}.stage-preview--stockholm{background:linear-gradient(145deg,#243d5d,#3f6681)}.stage-preview--oslo{background:linear-gradient(145deg,#293f4f,#536272)}.stage-preview--helsinki{background:linear-gradient(145deg,#284452,#4f6674)}.stage-preview--athens{background:linear-gradient(145deg,#3f4d65,#726849)}.stage-preview--budapest{background:linear-gradient(145deg,#3d404b,#67574b)}.stage-preview--istanbul{background:linear-gradient(145deg,#214a55,#665142)}.stage-preview--sao-paulo{background:linear-gradient(145deg,#294739,#4f6250)}.stage-preview--sydney{background:linear-gradient(145deg,#234a63,#4f7080)}.stage-preview--rabat{background:linear-gradient(145deg,#473b31,#6a5944)}.stage-preview--dubai{background:linear-gradient(145deg,#5a4530,#7b6745)}.stage-preview--dublin{background:linear-gradient(145deg,#264334,#45614c)}.stage-preview--kyiv{background:linear-gradient(145deg,#334a64,#6d6742)}.stage-preview--moscow{background:linear-gradient(145deg,#45333c,#66525b)}.stage-preview--new-delhi{background:linear-gradient(145deg,#654b31,#6a6a4f)}.stage-preview--riyadh{background:linear-gradient(145deg,#3c4a36,#746747)}.stage-preview--seoul{background:linear-gradient(145deg,#334052,#5a5365)}.stage-preview--zagreb{background:linear-gradient(145deg,#34495a,#5e5c52)}.stage-preview--algiers{background:linear-gradient(145deg,#31544d,#6a664f)}.stage-preview--beijing{background:linear-gradient(145deg,#57383b,#745446)}.stage-preview--mexico-city{background:linear-gradient(145deg,#354f42,#625e48)}.stage-preview--cairo{background:linear-gradient(145deg,#65523a,#786a50)}.stage-preview--buenos-aires{background:linear-gradient(145deg,#375c72,#637484)}.stage-preview--bogota{background:linear-gradient(145deg,#43503a,#6b6541)}.selected-territory-card{margin-top:12px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;padding:12px;border-radius:12px;border:1px solid rgba(92,215,222,.25);background:rgba(58,183,194,.07)}.territory-icon{display:grid;place-items:center;min-width:30px;font-size:calc(22px * var(--clu-text-scale,1))}.territory-icon :deep(.country-flag){width:28px;height:19px}.summary-map>span{display:grid;place-items:center;min-width:34px}.summary-map>span :deep(.country-flag){width:28px;height:19px}.selected-territory-card>div{display:grid;gap:2px}.selected-territory-card strong{font-size:calc(11px * var(--clu-text-scale,1))}.selected-territory-card small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.35;color:rgba(255,255,255,.46)}.territory-notice{margin:9px 0 0;padding:9px 10px;border-radius:10px;background:rgba(111,126,255,.08);border:1px solid rgba(130,142,255,.16);color:rgba(231,234,255,.7);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4}

.generated-config{margin-top:13px;padding:14px;border:1px solid rgba(145,116,255,.26);border-radius:14px;background:linear-gradient(145deg,rgba(120,89,225,.09),rgba(57,186,196,.045));display:grid;gap:13px}.generated-config__head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.generated-config__head>div{display:grid;gap:3px}.generated-config__head strong{font-size:calc(12px * var(--clu-text-scale,1))}.generated-config__head small,.generator-note{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;color:rgba(255,255,255,.48)}.seed-reroll,.seed-field button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.05);color:inherit;border-radius:9px;cursor:pointer}.seed-reroll{padding:8px 10px;font-size:calc(9px * var(--clu-text-scale,1));white-space:nowrap}.generated-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.seed-field{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:6px}.seed-field input{min-width:0}.seed-field button{font-size:calc(13px * var(--clu-text-scale,1))}.generator-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.generator-options>div{display:grid;gap:5px}.generator-options>div>span{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.48);font-weight:800}.generator-segments{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.generator-segments button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:rgba(255,255,255,.72);border-radius:8px;padding:7px 5px;font-size:calc(8.5px * var(--clu-text-scale,1));cursor:pointer}.generator-segments button.active{border-color:rgba(110,223,228,.48);background:rgba(65,196,205,.14);color:#dffcff}.generated-preview-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.generated-preview-stats span{padding:9px;border-radius:9px;background:rgba(5,12,18,.34);display:grid;gap:2px}.generated-preview-stats small{font-size:calc(8px * var(--clu-text-scale,1));color:rgba(255,255,255,.43)}.generated-preview-stats b{font-size:calc(10px * var(--clu-text-scale,1))}.generator-note{margin:0}.random-generated-toggle{margin-top:11px;padding:10px 11px;border-radius:11px;background:rgba(255,255,255,.025);display:flex;align-items:flex-start;gap:8px}.random-generated-toggle input{margin-top:2px}.random-generated-toggle span{display:grid;gap:2px}.random-generated-toggle strong{font-size:calc(10px * var(--clu-text-scale,1))}.random-generated-toggle small{font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.35;color:rgba(255,255,255,.42)}

@media(max-width:980px){.stage-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.stage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.generated-fields,.generator-options,.generated-preview-stats{grid-template-columns:1fr}.generated-config__head{display:grid}.map-picker-actions{display:flex;align-items:center;gap:8px}.map-picker-toggle{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:8px;padding:6px 8px;cursor:pointer}.map-picker-heading{align-items:flex-start;flex-direction:column}.selected-territory-card{grid-template-columns:auto 1fr}.selected-territory-card .pill{display:none}}

</style>
