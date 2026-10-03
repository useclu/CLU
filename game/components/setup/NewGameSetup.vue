<script setup lang="ts">
import { currentGameLocaleTag } from '../../config/i18n'
import { computed, reactive, ref, watch } from 'vue'
import CountryFlag from '../common/CountryFlag.vue'
import { useMetropoleGame } from '../../composables/useMetropoleGame'
import { useGameAudio } from '../../composables/useGameAudio'
import { useCluOnline } from '../../composables/useCluOnline'
import { useGameI18n } from '../../composables/useGameI18n'
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
import type { CluOnlineBudgetMode, CluOnlineVisibility } from '../../types/online'
import type {
  GameCapitalPreset,
  GameEconomyProfile,
  GameEventFrequency,
  GameFreePlaySettings,
} from '../../types/freePlay'

const props = withDefaults(defineProps<{ onlineMode?: boolean }>(), { onlineMode: false })
const onlineMode = computed(() => props.onlineMode)

const game = useMetropoleGame()
const audio = useGameAudio()
const online = useCluOnline()
const i18n = useGameI18n()
const gameName = ref('Ma métropole')
const isStarting = ref(false)
const startError = ref<string | null>(null)
const selectedTerritory = ref<GameTerritory>('ILE_DE_FRANCE')
const territoryNotice = ref<string | null>(null)
const settings = reactive<GameFreePlaySettings>(createDefaultFreePlaySettings())
const generatedTerritory = reactive<GameGeneratedTerritorySettings>(createDefaultGeneratedTerritorySettings())
const includeGeneratedInRandom = ref(true)
const generatedNameEdited = ref(false)
const onlineVisibility = ref<CluOnlineVisibility>('privee')
const onlineBudgetMode = ref<CluOnlineBudgetMode>('global')
const onlineEditionByDefault = ref(false)

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
const economyLabel = computed(() => economyOptions.find(item => item.id === settings.economyProfile)?.title ?? 'Standard')
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

const CUSTOM_CAPITAL_UI_MAX = 500_000_000_000
const CUSTOM_CAPITAL_SLIDER_MAX = 1000
const customCapitalSlider = computed({
  get() {
    const min = GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL
    const max = CUSTOM_CAPITAL_UI_MAX
    const current = Math.min(max, Math.max(min, Number(settings.startingCapital) || min))
    const ratio = (current - min) / (max - min)
    return Math.round(Math.cbrt(Math.max(0, ratio)) * CUSTOM_CAPITAL_SLIDER_MAX)
  },
  set(raw: number) {
    const t = Math.min(1, Math.max(0, Number(raw) / CUSTOM_CAPITAL_SLIDER_MAX))
    const min = GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL
    const max = CUSTOM_CAPITAL_UI_MAX
    const unrounded = min + ((max - min) * (t ** 3))
    const step = unrounded < 1_000_000_000 ? 25_000_000
      : unrounded < 10_000_000_000 ? 100_000_000
        : unrounded < 50_000_000_000 ? 500_000_000
          : 1_000_000_000
    settings.startingCapital = Math.min(max, Math.max(min, Math.round(unrounded / step) * step))
    settings.capitalPreset = 'CUSTOM'
    settings.cheatUnlimitedMoney = false
  },
})
const customCapitalProgress = computed(() => `${customCapitalSlider.value / 10}%`)

const CITY_PREVIEW_FILES: Record<string, string> = {
  paris: 'Skyline of Paris.jpg',
  london: 'London Skyline.jpg',
  berlin: 'Berlin skyline.jpg',
  randstad: 'Amsterdam Skyline View.jpg',
  brussels: 'Brussels skyline gp.jpg',
  madrid: 'Madrid sky line.jpg',
  milan: 'Milan skyline.jpg',
  warsaw: 'Warsaw skyline.jpg',
  lisbon: 'LisbonSkyline.jpg',
  prague: 'Prague Skyline.jpg',
  bern: 'Bern panorama.jpg',
  'new-york': 'New York City skyline.jpg',
  ottawa: 'Ottawa Skyline.jpg',
  tokyo: 'Tokyo Skyline.jpg',
  vienna: 'Vienna Skyline.jpg',
  copenhagen: 'Copenhagen skyline.jpg',
  stockholm: 'Stockholm Skyline.jpg',
  oslo: 'Oslo skyline.jpg',
  helsinki: 'Helsinki Skyline (52432702085).jpg',
  athens: 'Athens Skyline.jpg',
  budapest: 'Budapest Skyline (35002350740).jpg',
  istanbul: 'Istanbul Skyline.jpg',
  'sao-paulo': 'São Paulo Skyline.jpg',
  sydney: 'Sydney city skyline.jpg',
}

const CITY_PREVIEW_QUERIES: Record<string, string> = {
  paris: 'paris,france,city,skyline', london: 'london,england,city,skyline', berlin: 'berlin,germany,city,skyline',
  randstad: 'amsterdam,netherlands,city,canal', brussels: 'brussels,belgium,city', madrid: 'madrid,spain,city,skyline',
  milan: 'milan,italy,city,skyline', warsaw: 'warsaw,poland,city,skyline', lisbon: 'lisbon,portugal,city,tram',
  prague: 'prague,czech,city,bridge', bern: 'bern,switzerland,city', 'new-york': 'newyork,usa,city,skyline',
  ottawa: 'ottawa,canada,city', tokyo: 'tokyo,japan,city,skyline', vienna: 'vienna,austria,city',
  copenhagen: 'copenhagen,denmark,city', stockholm: 'stockholm,sweden,city', oslo: 'oslo,norway,city',
  helsinki: 'helsinki,finland,city', athens: 'athens,greece,city', budapest: 'budapest,hungary,city,river',
  istanbul: 'istanbul,turkey,city,bosphorus', 'sao-paulo': 'saopaulo,brazil,city,skyline', sydney: 'sydney,australia,city,harbour',
}

const DEFAULT_CITY_PREVIEW_URL = new URL('../../arriereplan.png', import.meta.url).href
function cityPreviewFallbackUrl(previewKey: string) {
  const query = CITY_PREVIEW_QUERIES[previewKey]
  if (!query) return null
  let lock = 0
  for (const character of previewKey) lock = ((lock * 31) + character.charCodeAt(0)) % 10000
  return `https://loremflickr.com/1280/720/${query}?lock=${lock}`
}
function cityPreviewUrl(previewKey: string) {
  const file = CITY_PREVIEW_FILES[previewKey]
  if (!file) return null
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=1280`
}
const territoryCityPreviewStyle = computed(() => {
  if (selectedTerritory.value === 'GENERATED') return { backgroundImage: `url("${DEFAULT_CITY_PREVIEW_URL}")` }
  const previewKey = selectedTerritoryEntry.value.previewKey
  const primary = cityPreviewUrl(previewKey)
  const secondary = cityPreviewFallbackUrl(previewKey)
  const layers = [primary, secondary, DEFAULT_CITY_PREVIEW_URL].filter(Boolean).map(url => `url("${url}")`)
  return { backgroundImage: layers.join(', ') }
})

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
  const lancementOnline = onlineMode.value
  let sessionOnlineCreee = false
  isStarting.value = true
  startError.value = null
  try {
    if (settings.capitalPreset === 'CUSTOM') {
      settings.startingCapital = Math.min(
        Math.min(GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL, CUSTOM_CAPITAL_UI_MAX),
        Math.max(GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL, Math.round(Number(settings.startingCapital) || GAME_FREE_PLAY_CAPITALS.STANDARD)),
      )
    }

    // Figer la configuration au clic sur « Lancer ». La création Online contient
    // un aller-retour réseau : sans snapshot, une modification pendant cet appel
    // pouvait produire une session distante et une sauvegarde locale différentes.
    const launchName = trimmedGameName.value
    const launchSettings = JSON.parse(JSON.stringify(settings)) as GameFreePlaySettings
    const launchTerritory = selectedTerritory.value
    const launchGeneratedTerritory = launchTerritory === 'GENERATED'
      ? JSON.parse(JSON.stringify(generatedTerritory)) as GameGeneratedTerritorySettings
      : null
    const launchTerritoryLabel = launchTerritory === 'GENERATED'
      ? launchGeneratedTerritory?.name || generatedTerritoryAutomaticName(launchGeneratedTerritory?.seed || '')
      : getGameTerritoryCatalogEntry(launchTerritory).label
    const launchOnlineVisibility = onlineVisibility.value
    const launchOnlineBudgetMode = onlineBudgetMode.value
    const launchOnlineEditionByDefault = onlineEditionByDefault.value

    if (lancementOnline) {
      const mapId = launchTerritory === 'GENERATED'
        ? `GENERATED:${launchGeneratedTerritory?.seed || ''}`
        : launchTerritory
      await online.creerPartie({
        nom: launchName,
        visibilite: launchOnlineVisibility,
        carte: { id: mapId, nom: launchTerritoryLabel },
        budgetInitial: Math.max(0, Number(launchSettings.startingCapital) || 0),
        budgetMode: launchOnlineBudgetMode,
        lectureSeuleParDefaut: !launchOnlineEditionByDefault,
      }, { connecter: false })
      sessionOnlineCreee = true
    }

    const newSave = await game.createGame(
      launchName,
      launchSettings,
      launchTerritory,
      launchGeneratedTerritory,
    )
    if (lancementOnline) {
      // La sauvegarde doit être liée à la session avant l'ouverture du WebSocket.
      // Cela évite qu'un GamePlay fraîchement monté voie une session Online sans
      // cible locale et la traite momentanément comme une partie solo.
      online.lierSauvegardeLocale(newSave.id)
      online.connecterWebSocket()
      online.annulerConfigurationCreation()
    }
    audio.playUi('CONFIRM')
  }
  catch (error) {
    // Si la session distante a déjà été créée mais que la sauvegarde locale échoue
    // (quota, limite de sauvegardes, IndexedDB…), ne pas laisser une partie fantôme
    // dans l'annuaire ou le Durable Object.
    if (lancementOnline && sessionOnlineCreee) {
      try { await online.quitterPartie() }
      catch { /* quitterPartie nettoie déjà l'état local dans son finally. */ }
      online.annulerConfigurationCreation()
    }
    audio.playUi('ERROR')
    startError.value = error instanceof Error ? error.message : 'Impossible de créer la partie.'
  }
  finally {
    isStarting.value = false
  }
}

function cancelSetup() {
  audio.playUi('CLICK')
  if (props.onlineMode) online.annulerConfigurationCreation()
  game.returnHome()
}
</script>

<template>
  <main class="setup setup--premium">
    <div class="setup__background" aria-hidden="true" />
    <div class="setup__shade" aria-hidden="true" />

    <header class="setup-topbar">
      <button class="setup-back" type="button" :disabled="isStarting" @click="cancelSetup">
        <span aria-hidden="true">←</span>
        <strong>Menu principal</strong>
      </button>
      <div class="setup-brand" aria-label="CLU Métropole">
        <div><b>CLU</b><span>Métropole</span></div>
        <svg viewBox="0 0 168 88" aria-hidden="true">
          <path d="M9 70H47L68 49H108L131 25H158" fill="none" stroke="#29E8F4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M9 70H38L61 44H90L119 57H157" fill="none" stroke="#F4C94A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M56 78H88L113 54H157" fill="none" stroke="#FF5F8E" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="47" cy="70" r="8" fill="#29E8F4" /><circle cx="68" cy="49" r="8" fill="#29E8F4" /><circle cx="131" cy="25" r="8" fill="#29E8F4" />
          <circle cx="38" cy="70" r="8" fill="#F4C94A" /><circle cx="61" cy="44" r="8" fill="#F4C94A" /><circle cx="119" cy="57" r="8" fill="#F4C94A" />
          <circle cx="56" cy="78" r="8" fill="#FF5F8E" /><circle cx="113" cy="54" r="8" fill="#FF5F8E" />
        </svg>
      </div>
      <div class="setup-heading">
        <span>{{ onlineMode ? i18n.t('Partie en ligne') : i18n.t('Nouvelle partie') }}</span>
        <strong>{{ onlineMode ? 'Configurez puis jouez immédiatement' : 'Construisez votre métropole' }}</strong>
      </div>
    </header>

    <section class="setup-stage">
      <aside class="map-rail" aria-label="Choix de la carte">
        <header class="map-rail__header">
          <div><span>01</span><div><strong>Choisir une carte</strong><small>{{ playableMapCount }} jouables · {{ plannedMapCount }} à venir</small></div></div>
          <button type="button" title="Carte aléatoire" @click="selectRandomTerritory">↻</button>
        </header>

        <div class="map-rail__scroll">
          <button class="map-choice map-choice--random" type="button" @click="selectRandomTerritory">
            <span class="map-choice__visual">?</span>
            <span><strong>Aléatoire</strong><small>Choisir une carte jouable</small></span>
            <b aria-hidden="true">→</b>
          </button>

          <button class="map-choice map-choice--generated" type="button" :class="{ selected: selectedTerritory === 'GENERATED' }" :aria-pressed="selectedTerritory === 'GENERATED'" @click="selectGeneratedTerritory">
            <span class="map-choice__visual">◇</span>
            <span><strong>Carte fictive</strong><small>Région générée par seed</small></span>
            <b v-if="selectedTerritory === 'GENERATED'" aria-hidden="true">✓</b>
          </button>

          <p class="map-rail__label">Cartes réelles</p>
          <button
            v-for="territory in territoryCatalog"
            :key="territory.id"
            type="button"
            class="map-choice"
            :class="[{ selected: selectedTerritory === territory.id, planned: territory.status !== 'AVAILABLE' }, `map-choice--${territory.previewKey}`]"
            :aria-pressed="selectedTerritory === territory.id"
            @click="selectTerritory(territory.id)"
          >
            <span class="map-choice__visual"><CountryFlag :code="territory.countryCode" /></span>
            <span><strong>{{ territory.label }}</strong><small>{{ territory.traits.slice(0, 2).join(' · ') }}</small></span>
            <em v-if="territory.status !== 'AVAILABLE'">À venir</em>
            <b v-else-if="selectedTerritory === territory.id" aria-hidden="true">✓</b>
          </button>
        </div>

        <label class="map-rail__random-toggle">
          <input v-model="includeGeneratedInRandom" type="checkbox">
          <span>Inclure les cartes fictives dans Aléatoire</span>
        </label>
      </aside>

      <section class="setup-workspace">
        <div class="setup-workspace__scroll">
          <section v-if="onlineMode" class="config-panel online-config-panel">
            <div class="config-panel__title"><span>LIVE</span><div><strong>{{ i18n.t('Partie en ligne') }}</strong><small>{{ i18n.t('Les réglages multijoueur sont ajoutés au-dessus de la configuration solo habituelle.') }}</small></div></div>
            <div class="online-config-grid">
              <label class="premium-field online-name"><span>{{ i18n.t('Nom de la partie') }}</span><input v-model="gameName" type="text" maxlength="50" :placeholder="i18n.t('Ma métropole')" autocomplete="off"></label>
              <label class="premium-field"><span>{{ i18n.t('Accès') }}</span><select v-model="onlineVisibility"><option value="privee">{{ i18n.t('Privée') }}</option><option value="publique_code">{{ i18n.t('Publique par code') }}</option><option value="ouverte">{{ i18n.t('Ouverte à tous') }}</option></select></label>
              <label class="premium-field"><span>{{ i18n.t('Budget') }}</span><select v-model="onlineBudgetMode"><option value="global">{{ i18n.t('Budget global') }}</option><option value="divise">{{ i18n.t('Budget divisé') }}</option></select></label>
              <label class="switch-row online-edit-default"><input v-model="onlineEditionByDefault" type="checkbox"><span><strong>{{ i18n.t('Autoriser l’édition dès l’arrivée') }}</strong><small>{{ i18n.t('Sinon les nouveaux joueurs arrivent en lecture seule.') }}</small></span></label>
            </div>
          </section>

          <article class="territory-hero">
            <div class="territory-hero__visual" :class="{ 'territory-hero__visual--generated': selectedTerritory === 'GENERATED' }">
              <div class="territory-hero__photo" :style="territoryCityPreviewStyle" aria-hidden="true" />
              <div class="territory-hero__vignette" aria-hidden="true" />
            </div>
            <div class="territory-hero__copy">
              <span class="setup-kicker">Territoire sélectionné</span>
              <h1>{{ selectedTerritoryLabel }}</h1>
              <p>{{ selectedTerritoryDescription }}</p>
              <div v-if="selectedTerritory !== 'GENERATED'" class="territory-traits">
                <span v-for="trait in selectedTerritoryEntry.traits" :key="trait">{{ trait }}</span>
              </div>
            </div>
          </article>

          <p v-if="territoryNotice" class="territory-notice">{{ territoryNotice }}</p>

          <section v-if="!onlineMode" class="config-panel config-panel--identity">
            <div class="config-panel__title"><span>02</span><div><strong>Identité de la partie</strong><small>Le nom apparaîtra dans vos sauvegardes et sur l’accueil.</small></div></div>
            <label class="premium-field"><span>Nom de la partie</span><input v-model="gameName" type="text" maxlength="50" placeholder="Ma métropole" autocomplete="off"></label>
          </section>

          <section v-if="selectedTerritory === 'GENERATED'" class="config-panel generated-panel">
            <div class="config-panel__title"><span>03</span><div><strong>Générateur de région</strong><small>Même seed + mêmes paramètres = exactement le même territoire.</small></div></div>
            <div class="generated-fields">
              <label class="premium-field"><span>Seed</span><div class="seed-field"><input v-model="generatedTerritory.seed" type="text" maxlength="18" spellcheck="false" autocomplete="off"><button type="button" @click="randomizeGeneratedTerritory">🎲</button></div></label>
              <label class="premium-field"><span>Nom de la région</span><div class="seed-field"><input v-model="generatedTerritory.name" type="text" maxlength="60" autocomplete="off" @input="generatedNameEdited = true"><button type="button" @click="resetGeneratedName">↺</button></div></label>
            </div>
            <div class="generator-grid">
              <div><span>Taille</span><div><button v-for="option in sizeOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.size === option.id }" @click="generatedTerritory.size = option.id">{{ option.label }}</button></div></div>
              <div><span>Densité</span><div><button v-for="option in densityOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.density === option.id }" @click="generatedTerritory.density = option.id">{{ option.label }}</button></div></div>
              <div><span>Structure</span><div><button v-for="option in structureOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.structure === option.id }" @click="generatedTerritory.structure = option.id">{{ option.label }}</button></div></div>
              <div><span>Eau</span><div><button v-for="option in waterOptions" :key="option.id" type="button" :class="{ active: generatedTerritory.water === option.id }" @click="generatedTerritory.water = option.id">{{ option.label }}</button></div></div>
            </div>
            <div class="generated-stats">
              <span><small>Population</small><b>{{ new Intl.NumberFormat(currentGameLocaleTag(),{notation:'compact',maximumFractionDigits:1}).format(generatedSummary.population) }}</b></span>
              <span><small>Communes</small><b>{{ generatedSummary.municipalityCount }}</b></span>
              <span><small>Départements</small><b>{{ generatedSummary.departmentCount }}</b></span>
              <span><small>Pôles</small><b>{{ generatedSummary.urbanCenterCount }}</b></span>
              <span><small>Superficie</small><b>≈ {{ new Intl.NumberFormat(currentGameLocaleTag()).format(generatedSummary.areaKm2) }} km²</b></span>
            </div>
          </section>

          <div class="config-columns">
            <section class="config-panel">
              <div class="config-panel__title"><span>{{ selectedTerritory === 'GENERATED' ? '04' : '03' }}</span><div><strong>Capital de départ</strong><small>Choisissez votre marge de construction.</small></div></div>
              <div class="capital-options">
                <button v-for="option in capitalOptions" :key="option.id" type="button" :class="{ active: settings.capitalPreset === option.id }" @click="selectCapital(option.id)">
                  <span><strong>{{ option.title }}</strong><small>{{ option.subtitle }}</small></span><em v-if="option.amount">{{ money(option.amount) }}</em><b v-if="settings.capitalPreset === option.id">✓</b>
                </button>
              </div>
              <div v-if="settings.capitalPreset === 'CUSTOM'" class="custom-capital">
                <div class="capital-slider-card" :class="{ disabled: settings.cheatUnlimitedMoney }">
                  <div class="capital-slider-card__head"><span>Capital personnalisé</span><strong>{{ money(settings.startingCapital) }}</strong></div>
                  <input
                    v-model.number="customCapitalSlider"
                    class="capital-slider"
                    type="range"
                    min="0"
                    :max="CUSTOM_CAPITAL_SLIDER_MAX"
                    step="1"
                    :disabled="settings.cheatUnlimitedMoney"
                    :style="{ '--capital-progress': customCapitalProgress }"
                    aria-label="Capital personnalisé"
                  >
                  <div class="capital-slider-scale"><span>25 M€</span><span>1 Md€</span><span>10 Md€</span><span>100 Md€</span><span>500 Md€</span></div>
                  <small>La progression est accélérée : plus vous allez vers la droite, plus les montants augmentent vite.</small>
                </div>
                <label class="switch-row switch-row--unlimited"><input v-model="settings.cheatUnlimitedMoney" type="checkbox"><span><strong>Argent illimité</strong><small>Les coûts restent visibles mais ne bloquent pas les investissements.</small></span></label>
              </div>
            </section>

            <section class="config-panel">
              <div class="config-panel__title"><span>{{ selectedTerritory === 'GENERATED' ? '05' : '04' }}</span><div><strong>Rythme de la partie</strong><small>Économie et fréquence du monde vivant.</small></div></div>
              <p class="config-label">Économie</p>
              <div class="premium-segments">
                <button v-for="option in economyOptions" :key="option.id" type="button" :class="{ active: settings.economyProfile === option.id }" @click="settings.economyProfile = option.id"><strong>{{ option.title }}</strong><small>{{ option.subtitle }}</small></button>
              </div>
              <p class="config-label">Événements & infos</p>
              <div class="premium-segments">
                <button v-for="option in eventOptions" :key="option.id" type="button" :class="{ active: settings.eventFrequency === option.id }" @click="settings.eventFrequency = option.id"><strong>{{ option.title }}</strong><small>{{ option.subtitle }}</small></button>
              </div>
            </section>
          </div>

          <section class="config-panel">
            <div class="config-panel__title"><span>{{ selectedTerritory === 'GENERATED' ? '06' : '05' }}</span><div><strong>Profondeur de gestion</strong><small>Simple par défaut, profond à la demande.</small></div></div>
            <div class="management-grid">
              <div><span><strong>Tarification</strong><small>Guidée ou réglages détaillés.</small></span><div><button type="button" :class="{ active: settings.fareGuidance === 'GUIDED' }" @click="settings.fareGuidance = 'GUIDED'">Guidée</button><button type="button" :class="{ active: settings.fareGuidance === 'MANUAL' }" @click="settings.fareGuidance = 'MANUAL'">Libre</button></div></div>
              <div><span><strong>Contrôle & fraude</strong><small>Automatique ou personnalisé.</small></span><div><button type="button" :class="{ active: settings.inspectionGuidance === 'GUIDED' }" @click="settings.inspectionGuidance = 'GUIDED'">Auto</button><button type="button" :class="{ active: settings.inspectionGuidance === 'MANUAL' }" @click="settings.inspectionGuidance = 'MANUAL'">Manuel</button></div></div>
              <div><span><strong>Régulation</strong><small>Réserves automatiques ou contrôle manuel.</small></span><div><button type="button" :class="{ active: settings.regulationGuidance === 'GUIDED' }" @click="settings.regulationGuidance = 'GUIDED'">Auto</button><button type="button" :class="{ active: settings.regulationGuidance === 'MANUAL' }" @click="settings.regulationGuidance = 'MANUAL'">Manuel</button></div></div>
              <label class="management-objectives"><input v-model="settings.objectivesEnabled" type="checkbox"><span><strong>Objectifs dynamiques</strong><small>CLU adapte les objectifs à votre réseau.</small></span></label>
            </div>
          </section>

          <p v-if="startError" class="setup-error">{{ startError }}</p>
        </div>

        <footer class="launch-dock">
          <div class="launch-dock__summary">
            <div><small>Prêt à jouer</small><strong>{{ trimmedGameName || 'Ma métropole' }}</strong><span>{{ selectedTerritoryLabel }} · {{ capitalLabel }} · {{ economyLabel }}</span></div>
          </div>
          <div class="launch-dock__actions">
            <button class="launch-cancel" type="button" :disabled="isStarting" @click="cancelSetup">Annuler</button>
            <button class="launch-start" type="button" :disabled="!canStart" :aria-busy="isStarting" @click="startGame"><span>{{ isStarting ? i18n.t('Création…') : onlineMode ? i18n.t('Lancer la partie en ligne') : i18n.t('Lancer la partie') }}</span><b aria-hidden="true">→</b></button>
          </div>
        </footer>
      </section>
    </section>
  </main>
</template>

<style scoped>
.setup{position:fixed;inset:0;width:100%;height:100dvh;overflow:hidden;background:#050b14;color:#f6fbff;font-family:"Avenir Next",Montserrat,"Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif;isolation:isolate}.setup__background{position:absolute;inset:0;background:radial-gradient(circle at 78% 22%,rgba(81,210,255,.13),transparent 24%),linear-gradient(90deg,rgba(3,10,18,.22),rgba(3,10,18,.08)),url('../../arriereplan.png') center/cover no-repeat;filter:saturate(1.04) brightness(.74)}.setup__shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,8,15,.93) 0%,rgba(2,8,15,.75) 29%,rgba(2,8,15,.52) 64%,rgba(2,8,15,.72) 100%),linear-gradient(180deg,rgba(2,8,15,.62),rgba(2,8,15,.18) 30%,rgba(2,8,15,.74) 100%);backdrop-filter:blur(3px) saturate(1.06)}
.setup-topbar{position:absolute;z-index:5;left:28px;right:28px;top:18px;height:68px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:24px}.setup-back{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 14px;border:1px solid rgba(150,210,255,.16);border-radius:15px;background:rgba(5,21,35,.66);color:#edf8ff;backdrop-filter:blur(18px);cursor:pointer}.setup-back:disabled{opacity:.5;cursor:wait}.setup-back span{font-size:20px}.setup-back strong{font-size:12px}.setup-brand{justify-self:center;display:flex;align-items:flex-end;gap:9px}.setup-brand>div{display:grid;line-height:.85}.setup-brand b{font-size:38px;letter-spacing:-.08em}.setup-brand span{font-size:15px;font-weight:800;letter-spacing:-.05em;color:#dbe9f2}.setup-brand svg{width:72px;height:auto;margin-bottom:2px}.setup-heading{text-align:right;display:grid;gap:2px}.setup-heading span{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#77eafa}.setup-heading strong{font-size:14px}
.setup-stage{position:absolute;z-index:3;left:28px;right:28px;top:98px;bottom:24px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;min-height:0}.map-rail,.setup-workspace{border:1px solid rgba(139,205,245,.14);background:linear-gradient(180deg,rgba(5,21,36,.84),rgba(3,15,27,.76));backdrop-filter:blur(22px) saturate(1.12);box-shadow:0 26px 70px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.055)}.map-rail{min-height:0;border-radius:26px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;transform:perspective(1600px) rotateY(2.4deg);transform-origin:left center}.map-rail__header{padding:17px 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.065)}.map-rail__header>div{display:flex;align-items:center;gap:10px}.map-rail__header>div>span{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:rgba(67,220,235,.1);color:#8aedf4;font-size:10px;font-weight:900}.map-rail__header>div>div{display:grid;gap:2px}.map-rail__header strong{font-size:15px}.map-rail__header small{font-size:9px;color:rgba(225,239,248,.46)}.map-rail__header>button{width:34px;height:34px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#d9f8ff;cursor:pointer}.map-rail__scroll{min-height:0;overflow:auto;padding:10px;scrollbar-width:thin;scrollbar-color:rgba(96,215,229,.28) transparent}.map-rail__label{margin:14px 8px 7px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:rgba(220,238,248,.36)}.map-choice{position:relative;width:100%;min-height:58px;padding:7px 8px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid transparent;border-radius:15px;background:transparent;color:inherit;text-align:left;cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .14s ease}.map-choice:hover{background:rgba(255,255,255,.045);transform:translateX(2px)}.map-choice.selected{border-color:rgba(70,229,247,.38);background:linear-gradient(90deg,rgba(34,168,190,.18),rgba(30,84,113,.08));box-shadow:inset 3px 0 0 #4be6f2}.map-choice.planned{opacity:.5}.map-choice__visual{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(86,184,224,.16),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.075);font-size:19px;font-weight:900;overflow:hidden}.map-choice__visual :deep(.country-flag){width:27px;height:18px}.map-choice>span:nth-child(2){display:grid;gap:2px;min-width:0}.map-choice strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.map-choice small{font-size:8px;color:rgba(227,239,247,.46);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.map-choice em{font-style:normal;font-size:7px;text-transform:uppercase;letter-spacing:.07em;color:#72dfb0}.map-choice.planned em{color:#bfc7cf}.map-choice>b{font-size:15px}.map-choice--generated .map-choice__visual{background:linear-gradient(145deg,rgba(137,93,255,.24),rgba(54,161,205,.09));color:#baa6ff}.map-choice--random .map-choice__visual{color:#f8d46a}.map-rail__random-toggle{padding:12px 14px;display:flex;align-items:flex-start;gap:8px;border-top:1px solid rgba(255,255,255,.06);font-size:9px;color:rgba(228,241,249,.58)}.map-rail__random-toggle input{margin-top:1px}
.setup-workspace{min-height:0;border-radius:28px;display:grid;grid-template-rows:minmax(0,1fr) auto;overflow:hidden;transform:perspective(1800px) rotateY(-1.2deg);transform-origin:right center}.setup-workspace__scroll{min-height:0;overflow:auto;padding:18px 20px 22px;scrollbar-width:thin;scrollbar-color:rgba(96,215,229,.28) transparent;display:grid;align-content:start;gap:14px}.territory-hero{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(300px,1fr);gap:18px;align-items:stretch}.territory-hero__visual{position:relative;min-height:170px;border-radius:22px;overflow:hidden;border:1px solid rgba(141,213,247,.15);background:linear-gradient(145deg,#153448,#173d4c);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}.territory-hero__visual::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 24% 22%,rgba(117,231,246,.2),transparent 22%),linear-gradient(115deg,transparent 10%,rgba(255,255,255,.04) 11% 12%,transparent 13% 48%,rgba(255,255,255,.05) 49% 50%,transparent 51%);opacity:.85}.territory-hero__visual--generated{background:linear-gradient(145deg,#171a3c,#1f4960)}.territory-hero__visual--paris{background:linear-gradient(145deg,rgba(20,51,72,.92),rgba(31,74,91,.78)),url('/game/menu-idf.svg') center/cover no-repeat}.territory-hero__country{position:absolute;left:15px;top:15px;z-index:2;min-width:42px;height:30px;padding:0 8px;border-radius:10px;display:grid;place-items:center;background:rgba(3,12,20,.68);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(10px)}.territory-hero__country :deep(.country-flag){width:26px;height:18px}.territory-hero__status{position:absolute;right:15px;top:15px;z-index:2;padding:6px 8px;border-radius:999px;background:rgba(47,208,151,.14);color:#8cecc2;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.territory-hero__network{position:absolute;inset:20px;opacity:.74}.territory-hero__network i{position:absolute;height:4px;border-radius:99px;background:#43dfef;box-shadow:0 0 12px rgba(67,223,239,.2);transform-origin:left center}.territory-hero__network i:nth-child(1){width:68%;left:8%;top:62%;transform:rotate(-12deg)}.territory-hero__network i:nth-child(2){width:46%;left:34%;top:40%;transform:rotate(24deg);background:#f9c448}.territory-hero__network i:nth-child(3){width:38%;left:18%;top:32%;transform:rotate(56deg);background:#ef6fbc}.territory-hero__network i:nth-child(4){width:31%;left:51%;top:59%;transform:rotate(-54deg);background:#50d895}.territory-hero__network i:nth-child(5){width:25%;left:61%;top:28%;transform:rotate(9deg);background:#876cff}.territory-hero__copy{align-self:center}.setup-kicker{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#7debf4}.territory-hero__copy h1{margin:6px 0 7px;font-size:clamp(28px,3vw,46px);line-height:.95;letter-spacing:-.055em}.territory-hero__copy p{margin:0;max-width:620px;font-size:11px;line-height:1.5;color:rgba(228,240,248,.58)}.territory-traits{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.territory-traits span{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06);font-size:8px;color:rgba(231,243,250,.64)}
.config-panel{padding:15px;border:1px solid rgba(151,207,242,.1);border-radius:19px;background:linear-gradient(180deg,rgba(8,27,43,.58),rgba(5,18,30,.5));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}.config-panel__title{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}.config-panel__title>span{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(69,215,231,.1);color:#85edf4;font-size:9px;font-weight:900}.config-panel__title>div{display:grid;gap:2px}.config-panel__title strong{font-size:13px}.config-panel__title small{font-size:9px;color:rgba(226,240,248,.46)}.premium-field{display:grid;gap:6px}.premium-field>span,.config-label,.generator-grid>div>span{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:rgba(220,237,247,.45)}.premium-field input{width:100%;min-width:0;box-sizing:border-box;min-height:42px;padding:0 12px;border:1px solid rgba(162,214,245,.12);border-radius:12px;background:#071726;color:#f5fbff;outline:none}.premium-field input:focus{border-color:rgba(79,226,242,.5);box-shadow:0 0 0 3px rgba(72,219,233,.08)}.config-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.capital-options{display:grid;grid-template-columns:1fr 1fr;gap:7px}.capital-options button{position:relative;min-height:68px;padding:9px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer}.capital-options button.active{border-color:rgba(74,226,240,.38);background:rgba(54,183,198,.1)}.capital-options button>span{display:grid;gap:2px}.capital-options strong{font-size:10px}.capital-options small{font-size:8px;color:rgba(226,238,246,.43);line-height:1.3}.capital-options em{font-style:normal;font-size:10px;color:#a7f1f5}.capital-options button>b{position:absolute;right:7px;top:6px;font-size:9px;color:#70e4ee}.custom-capital{display:grid;gap:9px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}.switch-row{display:flex;align-items:flex-start;gap:8px}.switch-row span{display:grid;gap:2px}.switch-row strong{font-size:10px}.switch-row small{font-size:8px;color:rgba(226,238,246,.43)}.premium-segments{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.config-label{margin:8px 0 6px}.premium-segments button{min-height:61px;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;text-align:left;cursor:pointer;display:grid;align-content:center;gap:2px}.premium-segments button.active{border-color:rgba(74,226,240,.38);background:rgba(54,183,198,.1)}.premium-segments strong{font-size:9px}.premium-segments small{font-size:7.5px;color:rgba(226,238,246,.42);line-height:1.25}.management-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.management-grid>div,.management-objectives{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}.management-grid>div{display:grid;gap:9px}.management-grid>div>span,.management-objectives>span{display:grid;gap:2px}.management-grid strong,.management-objectives strong{font-size:10px}.management-grid small,.management-objectives small{font-size:8px;line-height:1.25;color:rgba(226,238,246,.42)}.management-grid>div>div{display:grid;grid-template-columns:1fr 1fr;gap:4px}.management-grid button{min-height:28px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.025);color:inherit;font-size:8px;cursor:pointer}.management-grid button.active{border-color:rgba(70,223,237,.34);background:rgba(50,180,194,.12);color:#c5fbff}.management-objectives{display:flex;align-items:flex-start;gap:8px}.management-objectives input{margin-top:2px}.generated-panel{border-color:rgba(156,125,255,.18);background:linear-gradient(145deg,rgba(77,49,145,.13),rgba(10,31,48,.5))}.generated-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.seed-field{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:5px}.seed-field button{border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.04);color:inherit;cursor:pointer}.generator-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:11px}.generator-grid>div{display:grid;gap:5px}.generator-grid>div>div{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}.generator-grid button{min-height:29px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.025);color:rgba(236,244,250,.66);font-size:8px;cursor:pointer}.generator-grid button.active{background:rgba(101,85,225,.18);border-color:rgba(154,137,255,.32);color:#eeeaff}.generated-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:10px}.generated-stats span{padding:8px;border-radius:10px;background:rgba(3,13,22,.3);display:grid;gap:2px}.generated-stats small{font-size:7px;color:rgba(225,239,247,.38)}.generated-stats b{font-size:9px}.territory-notice,.setup-error{margin:0;padding:9px 11px;border-radius:11px;font-size:9px}.territory-notice{background:rgba(130,115,255,.08);border:1px solid rgba(154,139,255,.14);color:#d7d1ff}.setup-error{background:rgba(225,73,73,.1);border:1px solid rgba(255,119,119,.15);color:#ffb1b1}
.launch-dock{padding:12px 16px;border-top:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(4,17,30,.75),rgba(4,16,28,.96));display:flex;align-items:center;justify-content:space-between;gap:16px}.launch-dock__summary{display:flex;align-items:center;gap:10px;min-width:0}.launch-dock__map{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(84,208,221,.09);border:1px solid rgba(255,255,255,.07)}.launch-dock__map :deep(.country-flag){width:27px;height:18px}.launch-dock__summary>div{display:grid;gap:1px;min-width:0}.launch-dock__summary small{font-size:7px;text-transform:uppercase;letter-spacing:.12em;color:#6ee6f1}.launch-dock__summary strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.launch-dock__summary span{font-size:8px;color:rgba(227,240,248,.46);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.launch-dock__actions{display:flex;gap:8px}.launch-cancel,.launch-start{min-height:44px;border-radius:13px;padding:0 15px;cursor:pointer}.launch-cancel{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);color:#dcecf6}.launch-cancel:disabled{opacity:.45;cursor:wait}.launch-start{min-width:190px;display:flex;align-items:center;justify-content:space-between;gap:18px;border:0;background:linear-gradient(90deg,#59eef8,#49d4ec);color:#04131f;font-weight:900}.launch-start:disabled{opacity:.42;cursor:not-allowed}
@media(max-width:1050px){.setup-stage{grid-template-columns:250px minmax(0,1fr)}.territory-hero{grid-template-columns:1fr}.territory-hero__visual{min-height:130px}.config-columns{grid-template-columns:1fr}.management-grid{grid-template-columns:1fr 1fr}.generator-grid{grid-template-columns:1fr 1fr}.generated-stats{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.setup{height:100dvh}.setup-topbar{left:12px;right:12px;top:10px;height:56px;grid-template-columns:auto 1fr}.setup-brand{justify-self:end}.setup-heading{display:none}.setup-brand>div{display:none}.setup-brand svg{width:68px}.setup-back strong{display:none}.setup-stage{left:10px;right:10px;top:74px;bottom:10px;grid-template-columns:1fr;grid-template-rows:132px minmax(0,1fr);gap:8px}.map-rail{border-radius:18px;display:grid;grid-template-rows:auto 1fr;transform:none}.map-rail__header{padding:8px 10px}.map-rail__random-toggle{display:none}.map-rail__scroll{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:6px}.map-rail__label{display:none}.map-choice{flex:0 0 170px;min-height:55px}.map-choice em{display:none}.setup-workspace{border-radius:18px;transform:none}.setup-workspace__scroll{padding:10px;gap:9px}.territory-hero{grid-template-columns:1fr;gap:9px}.territory-hero__visual{min-height:110px}.territory-hero__copy h1{font-size:26px}.territory-hero__copy p{font-size:9px}.config-panel{padding:11px;border-radius:15px}.capital-options{grid-template-columns:1fr}.premium-segments{grid-template-columns:1fr}.management-grid{grid-template-columns:1fr}.generated-fields,.generator-grid{grid-template-columns:1fr}.generated-stats{grid-template-columns:1fr 1fr}.launch-dock{padding:8px 10px}.launch-dock__summary span{display:none}.launch-start{min-width:145px}.launch-cancel{display:none}}
@media(prefers-reduced-motion:reduce){.map-choice{transition:none}}
/* Finition Nouvelle partie : visuel ville + capital progressif */
.territory-hero__visual{min-height:178px;background:#081724;isolation:isolate}
.territory-hero__photo{position:absolute;inset:-10px;background-position:center;background-size:cover;background-repeat:no-repeat;filter:blur(2.8px) saturate(.88) brightness(.72);transform:scale(1.075);z-index:0}
.territory-hero__visual--generated .territory-hero__photo{filter:blur(4px) saturate(.68) brightness(.55)}
.territory-hero__vignette{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(4,16,27,.12),rgba(4,16,27,.02) 45%,rgba(4,16,27,.18)),linear-gradient(180deg,rgba(5,16,27,.05),rgba(4,15,25,.38));box-shadow:inset 0 0 54px rgba(2,10,17,.24)}
.territory-hero__network,.territory-hero__country,.territory-hero__status{display:none!important}
.map-choice em{justify-self:end}.map-choice>b{justify-self:end;color:#7cebf4;font-size:12px}
.launch-dock__summary{gap:0}.launch-dock__map{display:none!important}
.capital-slider-card{display:grid;gap:10px;padding:12px;border:1px solid rgba(89,225,239,.14);border-radius:14px;background:linear-gradient(180deg,rgba(10,35,51,.50),rgba(5,20,33,.42));transition:opacity .15s ease}
.capital-slider-card.disabled{opacity:.42}
.capital-slider-card__head{display:flex;align-items:baseline;justify-content:space-between;gap:14px}
.capital-slider-card__head span{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:rgba(220,237,247,.5)}
.capital-slider-card__head strong{font-size:18px;color:#bffaff;letter-spacing:-.035em}
.capital-slider{--capital-progress:0%;width:100%;height:7px;margin:3px 0;appearance:none;-webkit-appearance:none;border-radius:999px;background:linear-gradient(90deg,#43e7f3 0 var(--capital-progress),rgba(255,255,255,.11) var(--capital-progress) 100%);outline:none;cursor:pointer}
.capital-slider:disabled{cursor:not-allowed}
.capital-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;border:3px solid #d9fdff;background:#36dbea;box-shadow:0 0 0 4px rgba(54,219,234,.13),0 3px 12px rgba(0,0,0,.34)}
.capital-slider::-moz-range-thumb{width:15px;height:15px;border-radius:50%;border:3px solid #d9fdff;background:#36dbea;box-shadow:0 0 0 4px rgba(54,219,234,.13),0 3px 12px rgba(0,0,0,.34)}
.capital-slider-scale{display:flex;justify-content:space-between;gap:6px;color:rgba(219,235,244,.40);font-size:7px;font-variant-numeric:tabular-nums}
.capital-slider-card>small{font-size:8px;line-height:1.35;color:rgba(226,238,246,.43)}
.switch-row--unlimited{padding:10px 11px;border:1px solid rgba(255,255,255,.065);border-radius:12px;background:rgba(255,255,255,.022)}
@media(max-width:760px){.territory-hero__visual{min-height:118px}.capital-slider-card__head strong{font-size:15px}.capital-slider-scale{font-size:6.5px}}


.online-config-panel{border-color:rgba(77,214,224,.22);background:linear-gradient(135deg,rgba(34,133,145,.12),rgba(7,25,38,.48))}
.online-config-panel .config-panel__title>span{min-width:34px;color:#77e6ed}
.online-config-grid{display:grid;grid-template-columns:minmax(220px,1.35fr) minmax(150px,.8fr) minmax(150px,.8fr) minmax(220px,1.15fr);gap:9px;align-items:end}
.online-config-grid select{width:100%;min-height:38px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#0a1822;color:inherit;padding:0 9px}
.online-edit-default{min-height:38px;align-items:center;padding:7px 9px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}
@media(max-width:1050px){.online-config-grid{grid-template-columns:1fr 1fr}.online-name{grid-column:1/-1}}
@media(max-width:760px){.online-config-grid{grid-template-columns:1fr}.online-name{grid-column:auto}}

</style>
