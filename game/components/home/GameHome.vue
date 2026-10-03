<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getGameSaveCompatibility,
  useMetropoleGame,
} from '../../composables/useMetropoleGame'
import { useGameAudio } from '../../composables/useGameAudio'
import { useGameSettings } from '../../composables/useGameSettings'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameLegal } from '../../composables/useGameLegal'
import { useGameDialog } from '../../composables/useGameDialog'
import { useCluAccount } from '../../composables/useCluAccount'
import { MAX_REGULAR_GAME_SAVES, MAX_CHALLENGE_GAME_SAVES } from '../../storage'
import { gameCalendarHeaderLabel } from '../../config/calendar'
import { GAME_LOCALE_OPTIONS } from '../../config/i18n'
import { isCluOnlineBetaActive } from '../../config/commercial'
import { GAME_SAVE_VERSION } from '../../config/game'
import { getLineAllStations } from '../../engine/network/geometry'
import { getGameTerritoryCatalogEntry } from '../../config/territories'
import type { GameSave } from '../../types/game'
import { getGameSaveThumbnail, removeGameSaveThumbnail } from '../../utils/mapBridge'
import GameSettingsPanel from '../settings/GameSettingsPanel.vue'
import DailyChallengePanel from '../challenges/DailyChallengePanel.vue'
import OnlineHub from '../online/OnlineHub.vue'
import CountryFlag from '../common/CountryFlag.vue'
import AccountPanel from '../account/AccountPanel.vue'

type HomePanel = null | 'ACCOUNT' | 'CHALLENGE' | 'ONLINE' | 'SAVES' | 'SETTINGS'

const game = useMetropoleGame()
const audio = useGameAudio()
const preferences = useGameSettings()
const i18n = useGameI18n()
const dialogs = useGameDialog()
const legal = useGameLegal()
const account = useCluAccount()
const activePanel = ref<HomePanel>(null)
const importInput = ref<HTMLInputElement | null>(null)
const saveActionMessage = ref<string | null>(null)
const saveActionError = ref<string | null>(null)
const renameSaveId = ref<string | null>(null)
const renameDraft = ref('')
const dialogRef = ref<HTMLElement | null>(null)
const saveFolder = ref<'REGULAR' | 'CHALLENGE'>('REGULAR')
const saveSearch = ref('')
const saveBusy = ref(false)
const saveBusyId = ref<string | null>(null)
const localeMenuOpen = ref(false)
const onlineBetaActive = isCluOnlineBetaActive()
let panelReturnFocus: HTMLElement | null = null

const compatibleSaves = computed(() => game.saves.value.filter(save => {
  const compatibility = getGameSaveCompatibility(save)
  return (compatibility === 'CURRENT' || compatibility === 'OLDER') && !save.data?.challenge?.readOnly
}))
const canContinue = computed(() => compatibleSaves.value.length > 0)
const latestSave = computed(() => compatibleSaves.value[0] ?? null)

const homeStageScale = ref(1)
const latestSaveThumbnail = ref<string | null>(null)

function updateHomeStageScale() {
  if (typeof window === 'undefined') return
  if (window.innerWidth <= 820) {
    homeStageScale.value = 1
    return
  }
  const horizontal = Math.max(0.1, window.innerWidth / 1600)
  const designHeight = window.innerHeight >= 720 ? 900 : 760
  const vertical = Math.max(0.1, window.innerHeight / designHeight)
  homeStageScale.value = Math.min(1, Math.max(0.44, Math.min(horizontal, vertical)))
}

function refreshLatestSaveThumbnail() {
  latestSaveThumbnail.value = latestSave.value?.id ? getGameSaveThumbnail(latestSave.value.id) : null
}

function handleSaveThumbnailUpdated(event: Event) {
  const detail = (event as CustomEvent<{ saveId?: string; url?: string | null }>).detail
  if (!detail?.saveId || detail.saveId !== latestSave.value?.id) return
  latestSaveThumbnail.value = detail.url ?? getGameSaveThumbnail(detail.saveId)
}

const folderSaves = computed(() => saveFolder.value === 'REGULAR' ? game.regularSaves.value : game.challengeSaves.value)
const displayedSaves = computed(() => {
  const query = saveSearch.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
  if (!query) return folderSaves.value
  return folderSaves.value.filter(save => {
    const haystack = `${save.name} ${saveTerritoryLabel(save)} ${saveModeLabel(save)}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    return haystack.includes(query)
  })
})
const regularSaveLimitReached = computed(() => game.regularSaves.value.length >= MAX_REGULAR_GAME_SAVES)
const challengeSaveLimitReached = computed(() => game.challengeSaves.value.length >= MAX_CHALLENGE_GAME_SAVES)

function beginSaveAction(id: string) {
  if (saveBusy.value) return false
  saveBusy.value = true
  saveBusyId.value = id
  return true
}

function endSaveAction() {
  saveBusy.value = false
  saveBusyId.value = null
}

function canDuplicateSave(save: GameSave) {
  if (!canLoadSave(save) || save.data?.challenge?.readOnly) return false
  return save.mode === 'FREE' ? !regularSaveLimitReached.value : !challengeSaveLimitReached.value
}

const localeCountryCodes: Record<string, string> = { fr: 'FR', en: 'GB', de: 'DE', nl: 'NL', es: 'ES', it: 'IT', pt: 'PT', pl: 'PL' }
const activeLocaleOption = computed(() => GAME_LOCALE_OPTIONS.find(option => option.id === preferences.settings.value.locale) ?? GAME_LOCALE_OPTIONS[0])
const activeLocaleCountryCode = computed(() => localeCountryCodes[activeLocaleOption.value.id] ?? 'FR')

function selectLocale(locale: (typeof GAME_LOCALE_OPTIONS)[number]['id']) {
  audio.playUi('CLICK')
  preferences.update({ locale })
  localeMenuOpen.value = false
}

onMounted(() => {
  audio.setScene('HOME')
  updateHomeStageScale()
  window.addEventListener('resize', updateHomeStageScale, { passive: true })
  window.addEventListener('clu-save-thumbnail-updated', handleSaveThumbnailUpdated as EventListener)
  void game.refreshSaves().finally(() => refreshLatestSaveThumbnail())
  void account.actualiserSession().then(() => {
    if (!account.retourPremium.value || activePanel.value) return
    panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    activePanel.value = 'ACCOUNT'
  })
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateHomeStageScale)
  window.removeEventListener('clu-save-thumbnail-updated', handleSaveThumbnailUpdated as EventListener)
})

watch(
  () => latestSave.value?.id ?? null,
  () => refreshLatestSaveThumbnail(),
)

function openPanel(panel: Exclude<HomePanel, null>) {
  audio.playUi('CLICK')
  localeMenuOpen.value = false
  panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activePanel.value = panel
}

function closePanel() {
  audio.playUi('CLICK')
  activePanel.value = null
  renameSaveId.value = null
  saveActionMessage.value = null
  saveActionError.value = null
  saveSearch.value = ''
  void nextTick(() => panelReturnFocus?.focus())
}

watch(activePanel, async (panel: HomePanel) => {
  if (!panel) return
  await nextTick()
  dialogRef.value?.focus()
})

function trapDialogFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialogRef.value) return
  const focusables = Array.from(dialogRef.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(element => element.offsetParent !== null)
  if (!focusables.length) { event.preventDefault(); dialogRef.value.focus(); return }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function openLegalInformation() {
  audio.playUi('CLICK')
  legal.show('LEGAL')
}

function startNewGame() {
  if (regularSaveLimitReached.value) {
    saveFolder.value = 'REGULAR'
    saveActionError.value = `Limite atteinte : ${MAX_REGULAR_GAME_SAVES}/${MAX_REGULAR_GAME_SAVES} parties sauvegardées. Supprimez une partie pour en créer une nouvelle.`
    openPanel('SAVES')
    audio.playUi('ERROR')
    return
  }
  audio.playUi('CONFIRM')
  game.openNewGameSetup()
}

async function continueGame() {
  audio.playUi('CONFIRM')
  const loaded = await game.continueLatestGame()
  if (!loaded) {
    audio.playUi('ERROR')
    if (game.storageError.value) saveActionError.value = game.storageError.value
  }
}

async function loadSave(id: string) {
  if (!beginSaveAction(id)) return
  saveActionError.value = null
  try {
    const loaded = await game.loadGame(id)
    if (loaded) {
      audio.playUi('CONFIRM')
      closePanel()
    }
    else {
      audio.playUi('ERROR')
      saveActionError.value = game.storageError.value ?? 'Impossible de charger cette sauvegarde.'
    }
  }
  finally {
    endSaveAction()
  }
}

async function removeSave(save: GameSave) {
  const day = Math.max(1, Number(save?.data?.simulationDay ?? 1))
  const confirmed = await dialogs.confirm(
    `${i18n.t('Supprimer définitivement')} « ${save.name} » — ${i18n.t('Jour')} ${day} ?\n\n${i18n.t('Cette action ne peut pas être annulée.')}`,
    {
      title: i18n.t('Supprimer la sauvegarde'),
      confirmLabel: i18n.t('Supprimer'),
      cancelLabel: i18n.t('Annuler'),
      tone: 'DANGER',
    },
  )
  if (!confirmed || !beginSaveAction(save.id)) return
  saveActionError.value = null
  try {
    await game.removeSave(save.id)
    removeGameSaveThumbnail(save.id)
    audio.playUi('CONFIRM')
    saveActionMessage.value = `« ${save.name} » ${i18n.t('a été supprimée.')}`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible de supprimer cette sauvegarde.'
  }
  finally {
    endSaveAction()
  }
}

function startRename(save: GameSave) {
  audio.playUi('CLICK')
  renameSaveId.value = save.id
  renameDraft.value = save.name
  saveActionMessage.value = null
  saveActionError.value = null
}

function cancelRename() {
  renameSaveId.value = null
  renameDraft.value = ''
}

async function confirmRename(save: GameSave) {
  if (!beginSaveAction(save.id)) return
  try {
    await game.renameSave(save.id, renameDraft.value)
    audio.playUi('CONFIRM')
    saveActionMessage.value = 'Sauvegarde renommée.'
    cancelRename()
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible de renommer la sauvegarde.'
  }
  finally {
    endSaveAction()
  }
}

async function duplicateSave(save: GameSave) {
  if (!canDuplicateSave(save) || !beginSaveAction(save.id)) return
  saveActionMessage.value = null
  saveActionError.value = null
  try {
    const copy = await game.duplicateSave(save.id)
    saveFolder.value = copy.mode === 'FREE' ? 'REGULAR' : 'CHALLENGE'
    saveSearch.value = ''
    audio.playUi('CONFIRM')
    saveActionMessage.value = `Copie créée : « ${copy.name} ».`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible de dupliquer la sauvegarde.'
  }
  finally {
    endSaveAction()
  }
}

async function exportSave(save: GameSave) {
  if (!beginSaveAction(save.id)) return
  saveActionMessage.value = null
  saveActionError.value = null
  try {
    const exported = await game.exportSave(save.id)
    const blob = new Blob([exported.content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = exported.filename
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    audio.playUi('CONFIRM')
    saveActionMessage.value = `« ${save.name} » a été exportée.`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible d’exporter la sauvegarde.'
  }
  finally {
    endSaveAction()
  }
}

function chooseImportFile() {
  audio.playUi('CLICK')
  importInput.value?.click()
}

async function importSaveFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !beginSaveAction('__IMPORT__')) return
  saveActionMessage.value = null
  saveActionError.value = null

  if (file.size > 32 * 1024 * 1024) {
    endSaveAction()
    audio.playUi('ERROR')
    saveActionError.value = 'Ce fichier dépasse 32 Mo et ne peut pas être importé.'
    return
  }

  try {
    const imported = await game.importSave(await file.text())
    saveFolder.value = imported.mode === 'FREE' ? 'REGULAR' : 'CHALLENGE'
    saveSearch.value = ''
    audio.playUi('CONFIRM')
    saveActionMessage.value = `Partie importée : « ${imported.name} ».`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible d’importer cette sauvegarde.'
  }
  finally {
    endSaveAction()
  }
}

function compatibilityLabel(save: GameSave) {
  const compatibility = getGameSaveCompatibility(save)
  if (compatibility === 'FUTURE') return `V${save.version} · jeu trop ancien`
  if (compatibility === 'OLDER') return `V${save.version} · migration automatique vers V${GAME_SAVE_VERSION}`
  if (compatibility === 'INVALID') return 'Version invalide'
  return `V${save.version}`
}

function canLoadSave(save: GameSave) {
  const compatibility = getGameSaveCompatibility(save)
  return compatibility === 'CURRENT' || compatibility === 'OLDER'
}

function saveStationCount(save: GameSave) {
  const lines = Array.isArray(save?.data?.network?.lines) ? save.data.network.lines : []
  const physicalStations = new Set<string>()
  for (const line of lines) {
    for (const station of getLineAllStations(line)) {
      const key = String(station.sharedStationId || station.id || '').trim()
      if (key) physicalStations.add(key)
    }
  }
  return physicalStations.size
}

function saveLineCount(save: GameSave) {
  return Array.isArray(save?.data?.network?.lines) ? save.data.network.lines.length : 0
}

function saveDayNumber(save: GameSave) {
  return Math.max(1, Number(save?.data?.simulationDay ?? 1))
}

function saveBudgetLabel(save: GameSave) {
  if (save?.data?.freePlaySettings?.cheatUnlimitedMoney) return '∞'
  return i18n.currency(Number(save?.data?.economy?.balance ?? 0), { notation: 'compact', maximumFractionDigits: 1 })
}

function saveGameDate(save: GameSave) {
  const startDate = typeof save?.data?.calendarStartDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(save.data.calendarStartDate)
    ? save.data.calendarStartDate
    : undefined
  return gameCalendarHeaderLabel(Math.max(1, Number(save?.data?.simulationDay ?? 1)), startDate)
}

function saveModeLabel(save: GameSave) {
  const challenge = save.data?.challenge
  if (challenge) {
    const prefix = challenge.definition.kind === 'DAILY' ? 'Défi du jour' : 'Ancien défi'
    return `${prefix} · ${challenge.readOnly ? 'Archive lecture seule' : 'En cours'}`
  }
  if (save?.data?.freePlaySettings?.cheatUnlimitedMoney) return 'Partie libre · Triche'
  const preset = save?.data?.freePlaySettings?.capitalPreset
  return `Partie libre · ${preset === 'COMFORT' ? 'Confort' : preset === 'RICH' ? 'Riche' : preset === 'CUSTOM' ? 'Personnalisée' : 'Standard'}`
}

function saveExpiryLabel(save: GameSave) {
  const expiresAt = save.data?.challenge?.expiresAt
  if (!expiresAt) return ''
  const remaining = new Date(expiresAt).getTime() - Date.now()
  if (remaining <= 0) return 'Archive expirée'
  const days = Math.max(1, Math.ceil(remaining / 86_400_000))
  return `Expire dans ${days} jour${days > 1 ? 's' : ''}`
}

function saveTerritoryLabel(save: GameSave) {
  if (save.territory === 'GENERATED') return save.data.generatedTerritory?.name || 'Carte fictive'
  return getGameTerritoryCatalogEntry(save.territory).label
}

function saveSummary(save: GameSave) {
  const day = Math.max(1, Number(save?.data?.simulationDay ?? 1))
  const lines = Array.isArray(save?.data?.network?.lines) ? save.data.network.lines.length : 0
  const stations = saveStationCount(save)
  const balance = save?.data?.freePlaySettings?.cheatUnlimitedMoney
    ? '∞'
    : i18n.currency(Number(save?.data?.economy?.balance ?? 0), { notation: 'compact', maximumFractionDigits: 1 })
  const debt = Math.max(0, Number(save?.data?.economy?.debtPrincipal ?? 0))
  const debtLabel = debt > 0
    ? ` · Dette ${i18n.currency(debt, { notation: 'compact', maximumFractionDigits: 1 })}`
    : ''
  return `Jour ${day} · ${lines} ligne${lines > 1 ? 's' : ''} · ${stations} station${stations > 1 ? 's' : ''} · ${balance}${debtLabel}`
}

function formatSaveDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'date inconnue'
  return i18n.date(date, { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <main class="home home--station">
    <div class="home__background" aria-hidden="true" />
    <div class="home__shade" aria-hidden="true" />

    <div class="home-stage" :style="{ '--home-stage-scale': homeStageScale }">
    <header class="home-topbar">
      <div class="home-logo" aria-label="CLU Métropole">
        <div class="home-logo__wordmark">
          <b>CLU</b>
          <span>Métropole</span>
        </div>
        <svg class="home-logo__mark" viewBox="0 0 168 88" aria-hidden="true">
          <path d="M9 70H47L68 49H108L131 25H158" fill="none" stroke="#29E8F4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M9 70H38L61 44H90L119 57H157" fill="none" stroke="#F4C94A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M56 78H88L113 54H157" fill="none" stroke="#FF5F8E" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="47" cy="70" r="8" fill="#29E8F4" />
          <circle cx="68" cy="49" r="8" fill="#29E8F4" />
          <circle cx="131" cy="25" r="8" fill="#29E8F4" />
          <circle cx="38" cy="70" r="8" fill="#F4C94A" />
          <circle cx="61" cy="44" r="8" fill="#F4C94A" />
          <circle cx="119" cy="57" r="8" fill="#F4C94A" />
          <circle cx="56" cy="78" r="8" fill="#FF5F8E" />
          <circle cx="113" cy="54" r="8" fill="#FF5F8E" />
        </svg>
      </div>
      <div class="home-topbar__actions">
        <button class="account-entry" type="button" @click="openPanel('ACCOUNT')">
          <span aria-hidden="true">◎</span>
          <strong v-if="account.utilisateur.value" data-i18n-skip>{{ account.utilisateur.value.pseudo }}</strong>
          <strong v-else>{{ i18n.t('Connexion') }}</strong>
        </button>
        <button class="legal-entry" type="button" @click="openLegalInformation">
          <span aria-hidden="true">§</span>
          {{ i18n.t('Informations juridiques') }}
        </button>
        <div class="locale-picker" @keydown.esc.stop.prevent="localeMenuOpen = false">
          <button
            class="locale-picker__trigger"
            type="button"
            data-i18n-skip
            :aria-expanded="localeMenuOpen"
            aria-haspopup="menu"
            :aria-label="`Langue : ${activeLocaleOption.label}`"
            @click="audio.playUi('CLICK'); localeMenuOpen = !localeMenuOpen"
          >
            <CountryFlag :code="activeLocaleCountryCode" />
          </button>
          <div v-if="localeMenuOpen" class="locale-picker__menu" role="menu" data-i18n-skip>
            <button
              v-for="option in GAME_LOCALE_OPTIONS"
              :key="option.id"
              type="button"
              role="menuitemradio"
              :aria-checked="preferences.settings.value.locale === option.id"
              :class="{ active: preferences.settings.value.locale === option.id }"
              @click="selectLocale(option.id)"
            >
              <CountryFlag :code="localeCountryCodes[option.id] || 'FR'" />
              <span>{{ option.label }}</span>
              <b v-if="preferences.settings.value.locale === option.id" aria-hidden="true">✓</b>
            </button>
          </div>
        </div>
      </div>
    </header>

    <section class="home-shell home-shell--launcher">
      <nav class="launcher-actions" aria-label="Menu principal">
        <button class="launcher-action launcher-action--primary" type="button" @click="startNewGame">
          <span class="launcher-action__icon" aria-hidden="true">＋</span>
          <span class="launcher-action__copy">
            <strong>{{ i18n.t('Nouvelle partie') }}</strong>
            <small>{{ i18n.t('Carte réelle ou métropole fictive') }}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button class="launcher-action launcher-action--challenge" type="button" @click="openPanel('CHALLENGE')">
          <span class="launcher-action__icon" aria-hidden="true">♜</span>
          <span class="launcher-action__copy">
            <strong>{{ i18n.t('Défi du jour') }}</strong>
            <small>{{ i18n.t('Une épreuve officielle, nouvelle chaque jour') }}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button class="launcher-action launcher-action--online" type="button" @click="openPanel('ONLINE')">
          <span class="launcher-action__icon launcher-action__icon--people" aria-hidden="true">◎</span>
          <span class="launcher-action__copy">
            <span class="launcher-action__title-row"><strong>{{ i18n.t('En ligne') }}</strong><em v-if="onlineBetaActive" class="launcher-beta">{{ i18n.t('BÊTA') }}</em></span>
            <small>{{ i18n.t('Créez ou rejoignez une métropole collaborative') }}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
      </nav>

      <article v-if="latestSave" class="latest-card">
        <header class="latest-card__header">
          <div>
            <span>{{ i18n.t('Dernière partie') }}</span>
            <small>{{ formatSaveDate(latestSave.updatedAt) }}</small>
          </div>
          <i aria-hidden="true" />
        </header>

        <div class="latest-card__preview" aria-label="Aperçu de la dernière sauvegarde">
          <img v-if="latestSaveThumbnail" :src="latestSaveThumbnail" alt="Aperçu de la carte au moment de la sauvegarde" class="latest-card__thumbnail">
          <div v-else class="latest-card__preview-empty">
            <span>▧</span>
            <strong>Aperçu de carte</strong>
            <small>Chargez cette partie une fois : la vignette se crée automatiquement.</small>
          </div>
        </div>

        <div class="latest-card__identity">
          <strong data-i18n-skip>{{ latestSave.name }}</strong>
          <span>{{ saveTerritoryLabel(latestSave) }}</span>
          <small>{{ saveGameDate(latestSave) }}</small>
        </div>

        <div class="latest-card__stats latest-card__stats--four" aria-label="Résumé de la dernière partie">
          <div>
            <span>{{ i18n.t('Jour') }}</span>
            <strong>{{ saveDayNumber(latestSave) }}</strong>
          </div>
          <div>
            <span>Lignes</span>
            <strong>{{ saveLineCount(latestSave) }}</strong>
          </div>
          <div>
            <span>Stations</span>
            <strong>{{ saveStationCount(latestSave) }}</strong>
          </div>
          <div>
            <span>{{ i18n.t('Budget') }}</span>
            <strong>{{ saveBudgetLabel(latestSave) }}</strong>
          </div>
        </div>

        <button class="latest-card__continue" type="button" @click="continueGame">
          <span>{{ i18n.t('Continuer') }}</span>
          <b aria-hidden="true">→</b>
        </button>
      </article>

      <article v-else class="latest-card latest-card--empty">
        <header class="latest-card__header">
          <div><span>{{ i18n.t('Dernière partie') }}</span><small>{{ i18n.t('Aucune sauvegarde') }}</small></div>
          <i aria-hidden="true" />
        </header>
        <div class="latest-card__preview latest-card__preview--empty" aria-hidden="true">
          <div class="latest-card__preview-empty">Aucune sauvegarde</div>
        </div>
        <div class="latest-card__identity">
          <strong>{{ i18n.t('Votre métropole commence ici.') }}</strong>
          <span>{{ i18n.t('Choisissez un territoire, vos règles et lancez votre premier réseau.') }}</span>
        </div>
        <button class="latest-card__continue" type="button" @click="startNewGame">
          <span>{{ i18n.t('Commencer') }}</span><b aria-hidden="true">→</b>
        </button>
      </article>
    </section>

    <nav class="home-utilities" aria-label="Outils du menu principal">
      <button type="button" @click="openPanel('SAVES')">
        <span class="utility-icon" aria-hidden="true">▣</span>
        <strong>{{ i18n.t('Sauvegardes') }}</strong>
        <b aria-hidden="true">→</b>
      </button>
      <button type="button" @click="openPanel('SETTINGS')">
        <span class="utility-icon" aria-hidden="true">⚙</span>
        <strong>{{ i18n.t('Paramètres') }}</strong>
        <b aria-hidden="true">→</b>
      </button>
      <NuxtLink to="/editor" @click="audio.playUi('CLICK')">
        <span class="utility-icon utility-icon--network" aria-hidden="true">◇</span>
        <strong>{{ i18n.t('Retour sur CLU Editor') }}</strong>
        <b aria-hidden="true">→</b>
      </NuxtLink>
    </nav>
    </div>

    <p v-if="game.storageError.value" class="storage-error" role="alert">{{ game.storageError.value }}</p>

    <div v-if="activePanel" class="overlay" @click.self="closePanel" @keydown.esc.stop.prevent="closePanel" @keydown.tab="trapDialogFocus">
      <section ref="dialogRef" class="dialog" role="dialog" aria-modal="true" aria-labelledby="home-dialog-title" tabindex="-1" :class="{ 'dialog--account': activePanel === 'ACCOUNT', 'dialog--settings': activePanel === 'SETTINGS', 'dialog--saves': activePanel === 'SAVES', 'dialog--challenge': activePanel === 'CHALLENGE', 'dialog--online': activePanel === 'ONLINE' }">
        <header class="dialog__header">
          <div><p>CLU Métropole</p><h2 id="home-dialog-title">{{ activePanel === 'ACCOUNT' ? i18n.t('Compte CLU') : activePanel === 'CHALLENGE' ? i18n.t('Défi du jour') : activePanel === 'ONLINE' ? i18n.t('En ligne') : activePanel === 'SAVES' ? i18n.t('Sauvegardes') : i18n.t('Paramètres') }}</h2></div>
          <button type="button" aria-label="Fermer" @click="closePanel">×</button>
        </header>

        <div class="dialog__body">
          <template v-if="activePanel === 'ACCOUNT'">
            <AccountPanel @close="closePanel" />
          </template>

          <template v-else-if="activePanel === 'CHALLENGE'">
            <DailyChallengePanel />
          </template>

          <template v-else-if="activePanel === 'ONLINE'">
            <OnlineHub @open-account="activePanel = 'ACCOUNT'" />
          </template>

          <template v-else-if="activePanel === 'SAVES'">
            <section class="saves-panel" :aria-busy="saveBusy">
              <div class="saves-hero">
                <div>
                  <p>Bibliothèque locale</p>
                  <h3>Vos métropoles</h3>
                  <span>Retrouvez vos parties, vos défis et vos exports sans quitter l’accueil.</span>
                </div>
                <button class="saves-import" type="button" :disabled="saveBusy" @click="chooseImportFile"><span>＋</span> Importer</button>
                <input ref="importInput" class="save-import-input" type="file" accept=".clumetro,application/json,.json" :disabled="saveBusy" @change="importSaveFile">
              </div>

              <div class="saves-controls">
                <div class="save-folders" role="tablist" aria-label="Dossiers de sauvegardes">
                  <button type="button" role="tab" :aria-selected="saveFolder === 'REGULAR'" :class="{ active: saveFolder === 'REGULAR' }" @click="saveFolder = 'REGULAR'">
                    <span class="save-folder-icon">▣</span>
                    <span><strong>Parties</strong><small>{{ game.regularSaves.value.length }}/{{ MAX_REGULAR_GAME_SAVES }}</small></span>
                  </button>
                  <button type="button" role="tab" :aria-selected="saveFolder === 'CHALLENGE'" :class="{ active: saveFolder === 'CHALLENGE' }" @click="saveFolder = 'CHALLENGE'">
                    <span class="save-folder-icon save-folder-icon--challenge">◆</span>
                    <span><strong>Défis</strong><small>{{ game.challengeSaves.value.length }}/{{ MAX_CHALLENGE_GAME_SAVES }} · 30 jours</small></span>
                  </button>
                </div>
                <label class="save-search">
                  <span>⌕</span>
                  <input v-model="saveSearch" type="search" autocomplete="off" placeholder="Rechercher une sauvegarde…">
                  <button v-if="saveSearch" type="button" aria-label="Effacer la recherche" @click="saveSearch = ''">×</button>
                </label>
              </div>

              <p v-if="saveFolder === 'CHALLENGE'" class="save-folder-note">Les défis sont rangés à part et expirent automatiquement après 30 jours.</p>
              <p v-if="saveFolder === 'REGULAR' && regularSaveLimitReached" class="save-message save-message--warning">Limite atteinte : supprimez une partie pour pouvoir en créer, importer ou dupliquer une autre.</p>
              <p v-if="saveFolder === 'CHALLENGE' && challengeSaveLimitReached" class="save-message save-message--warning">Limite atteinte : supprimez un Défi pour pouvoir en créer ou importer un autre.</p>
              <p v-if="saveActionMessage" class="save-message save-message--ok" role="status" aria-live="polite">{{ saveActionMessage }}</p>
              <p v-if="saveActionError" class="save-message save-message--error" role="alert">{{ saveActionError }}</p>

              <div v-if="displayedSaves.length === 0" class="saves-empty">
                <span aria-hidden="true">▧</span>
                <strong>{{ saveSearch ? 'Aucun résultat' : 'Aucune sauvegarde' }}</strong>
                <p>{{ saveSearch ? 'Essayez un autre nom, territoire ou type de partie.' : saveFolder === 'REGULAR' ? 'Vos futures parties apparaîtront ici.' : 'Vos futurs Défis sauvegardés apparaîtront ici.' }}</p>
              </div>

              <div v-else class="save-list">
                <article v-for="save in displayedSaves" :key="save.id" class="save-card" :aria-busy="saveBusyId === save.id">
                  <div class="save-card__side" :class="{ 'save-card__side--challenge': !!save.data?.challenge }">
                    <span aria-hidden="true">{{ save.data?.challenge ? '◆' : '▣' }}</span>
                    <small>J{{ saveDayNumber(save) }}</small>
                  </div>
                  <div class="save-card__content">
                    <template v-if="renameSaveId !== save.id">
                      <div class="save-card__title-row"><strong data-i18n-skip>{{ save.name }}</strong><em :class="{ warning: !canLoadSave(save) }">{{ compatibilityLabel(save) }}</em></div>
                      <div class="save-card__chips"><span>{{ saveTerritoryLabel(save) }}</span><span>{{ saveModeLabel(save) }}</span></div>
                      <div class="save-card__meta"><span>{{ saveGameDate(save) }}</span><span>{{ saveSummary(save) }}</span><span>Modifiée {{ formatSaveDate(save.updatedAt) }}<template v-if="saveExpiryLabel(save)"> · {{ saveExpiryLabel(save) }}</template></span></div>
                    </template>
                    <div v-else class="save-rename">
                      <label :for="`rename-${save.id}`">Nouveau nom</label>
                      <input :id="`rename-${save.id}`" v-model="renameDraft" maxlength="80" autofocus :disabled="saveBusy" @keyup.enter="confirmRename(save)" @keyup.esc="cancelRename">
                      <div><button type="button" :disabled="saveBusy" @click="cancelRename">Annuler</button><button type="button" :disabled="saveBusy" @click="confirmRename(save)">Enregistrer</button></div>
                    </div>
                  </div>
                  <div v-if="renameSaveId !== save.id" class="save-card__actions">
                    <button class="save-card__load" type="button" :disabled="saveBusy || !canLoadSave(save)" @click="loadSave(save.id)"><span>Charger</span><b>→</b></button>
                    <div class="save-card__secondary-actions">
                      <button type="button" title="Exporter" aria-label="Exporter" :disabled="saveBusy" @click="exportSave(save)">⇩</button>
                      <button type="button" title="Dupliquer" aria-label="Dupliquer" :disabled="saveBusy || !canDuplicateSave(save)" @click="duplicateSave(save)">⧉</button>
                      <button type="button" title="Renommer" aria-label="Renommer" :disabled="saveBusy" @click="startRename(save)">✎</button>
                      <button class="save-card__delete" type="button" title="Supprimer" aria-label="Supprimer" :disabled="saveBusy" @click="removeSave(save)">×</button>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </template>

          <template v-else><GameSettingsPanel /></template>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.home{position:relative;min-height:100vh;overflow:hidden;background:#061017;color:#f4fafb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.home__background{position:absolute;inset:-28px;background:radial-gradient(circle at 76% 24%,rgba(82,210,219,.16),transparent 22%),radial-gradient(circle at 64% 72%,rgba(224,82,91,.10),transparent 26%),radial-gradient(circle at 88% 88%,rgba(245,188,72,.055),transparent 22%),repeating-linear-gradient(24deg,transparent 0 92px,rgba(255,255,255,.018) 93px 94px),linear-gradient(135deg,#07151c,#081017 42%,#050b10);filter:saturate(.94) brightness(.93);transform:scale(1.025)}.home__shade{position:absolute;inset:0;background:radial-gradient(circle at 72% 44%,rgba(42,166,180,.13),transparent 28%),linear-gradient(90deg,rgba(4,10,15,.97) 0%,rgba(4,10,15,.9) 34%,rgba(4,10,15,.55) 68%,rgba(4,10,15,.35) 100%),linear-gradient(0deg,rgba(4,10,15,.7),transparent 46%)}.network-motion{position:absolute;inset:0;overflow:hidden;opacity:.88;pointer-events:none}.route{position:absolute;height:2px;width:58vw;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(81,211,219,.08),rgba(115,233,238,.6),rgba(81,211,219,.08),transparent);box-shadow:0 0 18px rgba(75,208,217,.15);transform-origin:left center}.route--a{left:42%;top:24%;transform:rotate(18deg);animation:routePulse 8s ease-in-out infinite}.route--b{left:49%;top:61%;transform:rotate(-11deg);animation:routePulse 10s ease-in-out -3s infinite}.route--c{left:61%;top:6%;height:1px;transform:rotate(72deg);animation:routePulse 12s ease-in-out -6s infinite}.route--d{left:53%;top:42%;width:42vw;transform:rotate(-31deg);background:linear-gradient(90deg,transparent,rgba(245,188,72,.09),rgba(245,188,72,.52),rgba(245,188,72,.08),transparent);animation:routePulse 9s ease-in-out -2s infinite}.route--e{left:69%;top:17%;width:38vw;transform:rotate(103deg);background:linear-gradient(90deg,transparent,rgba(220,80,92,.08),rgba(220,80,92,.46),rgba(220,80,92,.08),transparent);animation:routePulse 11s ease-in-out -5s infinite}.pulse{position:absolute;width:8px;height:8px;border:2px solid rgba(255,255,255,.9);border-radius:50%;background:#50d5dd;box-shadow:0 0 0 5px rgba(80,213,221,.12),0 0 22px rgba(80,213,221,.45);animation:nodePulse 2.8s ease-in-out infinite}.pulse--1{left:66%;top:29%}.pulse--2{left:79%;top:47%;animation-delay:-.8s}.pulse--3{left:58%;top:64%;animation-delay:-1.7s}.pulse--4{left:87%;top:73%;animation-delay:-2.2s}.pulse--5{left:73%;top:39%;animation-delay:-1.1s;background:#efbd59}.pulse--6{left:90%;top:29%;animation-delay:-2.5s;background:#de6471}.moving-unit{position:absolute;z-index:2;width:13px;height:5px;border-radius:99px;background:#edfafa;box-shadow:0 0 12px rgba(180,244,248,.65);opacity:.8}.moving-unit--1{animation:vehicleOne 10s linear infinite}.moving-unit--2{animation:vehicleTwo 13s linear -6s infinite;background:#f5cc72}.moving-unit--3{animation:vehicleThree 12s linear -3s infinite;background:#ee8a94}.moving-unit--4{animation:vehicleFour 15s linear -9s infinite}@keyframes vehicleOne{0%{left:49%;top:58%;transform:rotate(-11deg)}100%{left:96%;top:49%;transform:rotate(-11deg)}}@keyframes vehicleTwo{0%{left:55%;top:41%;transform:rotate(-31deg)}100%{left:90%;top:20%;transform:rotate(-31deg)}}@keyframes vehicleThree{0%{left:75%;top:16%;transform:rotate(103deg)}100%{left:70%;top:82%;transform:rotate(103deg)}}@keyframes vehicleFour{0%{left:43%;top:24%;transform:rotate(18deg)}100%{left:95%;top:43%;transform:rotate(18deg)}}@keyframes routePulse{0%,100%{opacity:.35;filter:brightness(.75)}50%{opacity:1;filter:brightness(1.2)}}@keyframes nodePulse{0%,100%{transform:scale(.84);opacity:.55}50%{transform:scale(1.16);opacity:1}}.home-topbar{position:absolute;z-index:4;left:34px;right:34px;top:27px;display:flex;align-items:center;justify-content:space-between}.home-logo{display:flex;align-items:center;gap:10px}.home-logo b{font-size:calc(18px * var(--clu-text-scale,1));letter-spacing:.12em}.home-logo span{font-size:calc(11px * var(--clu-text-scale,1));font-weight:750;opacity:.58}.home-meta{display:flex;align-items:center;gap:8px;font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;opacity:.62}.home-meta i,.home-footer i{width:3px;height:3px;border-radius:50%;background:#67dce3}.home-meta strong{color:#8ce9ee}.home-shell{position:relative;z-index:3;min-height:100vh;width:min(1420px,calc(100% - 70px));margin:0 auto;display:grid;grid-template-columns:minmax(420px,1.22fr) minmax(330px,.72fr);gap:clamp(45px,8vw,130px);align-items:center;padding:92px 0 76px}.hero{align-self:center;max-width:720px}.hero-kicker{margin:0 0 12px;color:#7ce1e7;font-size:calc(10px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.18em;font-weight:850}.hero h1{margin:0;font-size:clamp(56px,7.2vw,106px);line-height:.82;letter-spacing:-.065em;font-weight:780;text-shadow:0 12px 60px rgba(0,0,0,.38)}.hero h1 em{font-style:normal;color:rgba(202,246,248,.25);-webkit-text-stroke:0;text-shadow:0 0 0 rgba(202,246,248,.78),0 0 34px rgba(79,211,220,.12);letter-spacing:-.055em}.hero-copy{max-width:580px;margin:24px 0 28px;font-size:calc(14px * var(--clu-text-scale,1));line-height:1.7;color:rgba(235,248,249,.72)}.continue-card{width:min(670px,100%);padding:14px 15px 14px 17px;border:1px solid rgba(116,226,232,.26);border-radius:16px;background:linear-gradient(120deg,rgba(21,46,54,.84),rgba(8,18,24,.74));backdrop-filter:blur(20px);box-shadow:0 22px 60px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)}.continue-card__head{display:flex;justify-content:space-between;gap:10px;margin-bottom:9px}.continue-card__head span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;color:#78dce3;font-weight:850}.continue-card__head small{font-size:calc(8px * var(--clu-text-scale,1));opacity:.35}.continue-card__main{display:flex;align-items:center;justify-content:space-between;gap:18px}.continue-card__main>div,.continue-card--empty>div{display:grid;gap:3px;min-width:0}.continue-card strong{font-size:calc(16px * var(--clu-text-scale,1));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.continue-card span{font-size:calc(10px * var(--clu-text-scale,1));opacity:.66}.continue-card small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.44}.continue-card button{flex:none;min-width:132px;border:1px solid rgba(99,220,228,.42);border-radius:11px;background:linear-gradient(135deg,rgba(61,191,202,.22),rgba(47,145,158,.14));color:#eefdff;padding:11px 12px;display:flex;justify-content:space-between;gap:16px;cursor:pointer;font-weight:800}.continue-card button:hover{background:linear-gradient(135deg,rgba(73,218,228,.31),rgba(47,145,158,.2));transform:translateY(-1px)}.continue-card--empty{display:flex;justify-content:space-between;align-items:center;gap:18px}.premium-menu{display:grid;gap:8px;width:100%;max-width:430px;justify-self:end}.premium-action{position:relative;min-height:71px;width:100%;display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:linear-gradient(100deg,rgba(15,28,36,.90),rgba(11,20,27,.70));backdrop-filter:blur(18px);padding:10px 13px;color:inherit;text-decoration:none;text-align:left;cursor:pointer;box-shadow:0 9px 34px rgba(0,0,0,.14);transition:transform .15s ease,border-color .15s ease,background .15s ease}.premium-action:hover{transform:translateX(-5px);border-color:rgba(114,224,231,.34);background:linear-gradient(100deg,rgba(20,39,47,.92),rgba(11,23,30,.76))}.premium-action--primary{min-height:83px;border-color:rgba(91,216,224,.34);background:linear-gradient(105deg,rgba(40,141,153,.29),rgba(11,25,32,.7))}.premium-action--challenge{border-color:rgba(244,196,67,.34);background:linear-gradient(105deg,rgba(124,91,16,.3),rgba(27,23,13,.69));box-shadow:0 9px 34px rgba(0,0,0,.14),inset 0 0 32px rgba(255,202,62,.035);animation:challengeGlow 3.8s ease-in-out infinite}.premium-action--challenge .action-icon,.premium-action--challenge>b{color:#ffd35d}.premium-action--online{border-color:rgba(225,69,78,.3);background:linear-gradient(105deg,rgba(111,27,34,.26),rgba(25,15,20,.69))}.premium-action--online .action-icon,.premium-action--online>b{color:#ff7f87}@keyframes challengeGlow{0%,100%{box-shadow:0 9px 34px rgba(0,0,0,.14),inset 0 0 26px rgba(255,202,62,.025)}50%{box-shadow:0 9px 40px rgba(0,0,0,.18),0 0 24px rgba(255,203,66,.07),inset 0 0 36px rgba(255,202,62,.055)}}.action-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.10);font-weight:900;color:#83e4ea;font-size:calc(14px * var(--clu-text-scale,1))}.premium-action>span:nth-child(2){display:grid;gap:3px}.premium-action strong{font-size:calc(13px * var(--clu-text-scale,1))}.premium-action small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.43;line-height:1.3}.premium-action>b{font-size:calc(16px * var(--clu-text-scale,1));color:#7bdfe5}.premium-action em{font-style:normal;font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.1em;padding:5px 7px;border-radius:99px;background:rgba(255,194,82,.08);color:#e4c77e;border:1px solid rgba(255,194,82,.16)}.premium-action--link{opacity:.72}.home-footer{position:absolute;z-index:4;left:34px;bottom:24px;display:flex;align-items:center;gap:9px;font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.11em;opacity:.35}.storage-error{position:absolute;z-index:12;left:50%;bottom:30px;transform:translateX(-50%);margin:0;max-width:620px;padding:9px 12px;border:1px solid rgba(255,104,104,.25);border-radius:9px;background:rgba(90,22,22,.72);font-size:calc(10px * var(--clu-text-scale,1));color:#ffc1c1}.overlay{position:fixed;z-index:30;inset:0;display:grid;place-items:center;padding:30px;background:rgba(2,7,11,.72);backdrop-filter:blur(13px)}.dialog{width:min(620px,calc(100vw - 34px));max-height:min(760px,calc(100vh - 50px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:rgba(8,17,23,.96);box-shadow:0 35px 100px rgba(0,0,0,.55)}.dialog--settings{width:min(820px,calc(100vw - 34px))}.dialog--challenge{width:min(900px,calc(100vw - 34px))}.dialog--online{width:min(1180px,calc(100vw - 34px))}.dialog--saves{width:min(930px,calc(100vw - 34px))}.dialog__header{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.07)}.dialog__header p{margin:0 0 2px;font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;color:#72dce3}.dialog__header h2{margin:0;font-size:calc(20px * var(--clu-text-scale,1))}.dialog__header button{border:0;background:transparent;color:inherit;font-size:calc(24px * var(--clu-text-scale,1));cursor:pointer}.dialog__body{min-height:0;overflow:auto;padding:18px}.future-panel{min-height:230px;display:grid;place-items:center;align-content:center;text-align:center;gap:9px}.future-panel>span{font-size:calc(28px * var(--clu-text-scale,1));color:#83e3e9}.future-panel strong{font-size:calc(18px * var(--clu-text-scale,1))}.future-panel p{max-width:460px;margin:0;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;opacity:.58}.future-panel em,.online-grid em{font-style:normal;font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;color:#e7c980}.online-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.online-grid article{min-height:210px;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);display:grid;align-content:start;gap:8px}.online-grid article>span{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(85,211,220,.1);color:#83e3e9;font-size:calc(11px * var(--clu-text-scale,1));font-weight:900}.online-grid strong{font-size:calc(15px * var(--clu-text-scale,1))}.online-grid p{margin:0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.55;opacity:.54}.saves-toolbar{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:13px}.saves-toolbar>div{display:grid;gap:3px}.saves-toolbar strong{font-size:calc(13px * var(--clu-text-scale,1))}.saves-toolbar span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48}.saves-toolbar button,.save-card__actions button,.save-rename button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}.saves-import:disabled,.save-rename button:disabled{opacity:.4;cursor:not-allowed}.save-import-input{display:none}.save-message{padding:9px 10px;border-radius:9px;font-size:calc(10px * var(--clu-text-scale,1))}.save-message--ok{background:rgba(60,177,110,.1);color:#9be5b6}.save-message--error{background:rgba(200,65,65,.1);color:#ffaaaa}.save-message--warning{background:rgba(236,174,66,.1);color:#f4cf83}.save-folders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 10px}.save-folders button{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.03);color:inherit;cursor:pointer}.save-folders button.active{border-color:rgba(81,211,220,.48);background:rgba(81,211,220,.11)}.save-folders strong{font-size:calc(10px * var(--clu-text-scale,1))}.save-folders small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.55}.save-search{height:38px;margin:0 0 10px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:0 10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#0d171d}.save-search>span{opacity:.5}.save-search input{min-width:0;border:0;outline:0;background:transparent;color:inherit;font-size:calc(10px * var(--clu-text-scale,1))}.save-search button{border:0;background:transparent;color:inherit;opacity:.55;cursor:pointer;font-size:16px}.save-folder-note{margin:0 0 10px;padding:8px 10px;border-radius:9px;background:rgba(244,196,67,.065);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.75}.save-list{display:grid;gap:8px}.save-card{padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025);display:flex;justify-content:space-between;gap:15px;align-items:center}.save-card__content{display:grid;gap:3px;min-width:0}.save-card__content>span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.45}.save-card__title-row{display:flex;align-items:center;gap:8px}.save-card__title-row strong{font-size:calc(13px * var(--clu-text-scale,1))}.save-card__title-row em{font-style:normal;font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.08em;padding:3px 5px;border-radius:5px;background:rgba(79,210,220,.08);color:#7edce3}.save-card__title-row em.warning{color:#ffadad;background:rgba(210,75,75,.1)}.save-card__actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.save-card__load{border-color:rgba(80,211,220,.32)!important;background:rgba(80,211,220,.1)!important}.save-card__delete{color:#ff9f9f!important}.save-card__actions button:disabled{opacity:.32;cursor:not-allowed}.save-rename{display:grid;gap:7px;min-width:280px}.save-rename label{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.save-rename input{border:1px solid rgba(255,255,255,.12);background:#0d171d;color:inherit;border-radius:8px;padding:9px}.save-rename>div{display:flex;gap:5px}.saves-empty{text-align:center;padding:30px;opacity:.6}.saves-empty p{font-size:calc(10px * var(--clu-text-scale,1))}.saves-empty strong{font-size:calc(14px * var(--clu-text-scale,1))}@media(max-width:900px){.home-shell{grid-template-columns:1fr;width:min(100% - 36px,720px);align-content:center;gap:28px;padding-top:100px}.hero h1{font-size:clamp(52px,13vw,84px)}.premium-menu{max-width:none;justify-self:stretch}.home__shade{background:linear-gradient(0deg,rgba(4,10,15,.97),rgba(4,10,15,.68)),radial-gradient(circle at 60% 15%,rgba(42,166,180,.12),transparent 35%)}.network-motion{opacity:.4}}@media(max-width:620px){.home-topbar{left:18px;right:18px;top:17px}.home-meta span,.home-footer span:nth-of-type(n+2),.home-footer i{display:none}.home-shell{width:calc(100% - 24px);padding:80px 0 54px}.hero-copy{font-size:calc(12px * var(--clu-text-scale,1));margin:17px 0}.hero h1{font-size:clamp(48px,16vw,70px)}.continue-card__main,.continue-card--empty{align-items:stretch;flex-direction:column}.continue-card button{width:100%}.premium-action{min-height:62px}.home-footer{left:18px;bottom:14px}.overlay{padding:12px}.online-grid{grid-template-columns:1fr}.saves-toolbar,.save-card{align-items:stretch;flex-direction:column}.save-card__actions{justify-content:stretch}.save-card__actions button{flex:1}.dialog__body{padding:13px}}

.home-meta--actions{opacity:1;text-transform:none;letter-spacing:0;gap:6px;flex-wrap:wrap;justify-content:flex-end}.home-meta--actions button{border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.035);color:rgba(238,248,250,.72);padding:7px 9px;font-size:calc(8px * var(--clu-text-scale,1));font-weight:800;cursor:pointer}.home-meta--actions button:hover{border-color:rgba(116,226,232,.28);color:#eefbfc;background:rgba(116,226,232,.07)}.home-meta--actions .home-meta__logout{border-color:rgba(255,92,101,.28);background:rgba(180,47,54,.11);color:#ff9ca4}.home-meta--actions .home-meta__logout:hover{border-color:rgba(255,92,101,.5);background:rgba(180,47,54,.18);color:#ffc2c6}
@media(max-width:900px){.home-meta--actions{max-width:55%}}
@media(max-width:620px){.home-topbar{align-items:flex-start}.home-meta--actions{max-width:62%;gap:4px}.home-meta--actions button{padding:6px 7px;font-size:calc(7px * var(--clu-text-scale,1))}}




/* V28 — même composition, davantage de relief et de personnalité */
.home::after{content:"";position:absolute;z-index:1;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 48%,rgba(63,216,226,.055),transparent 28%),radial-gradient(circle at 84% 50%,rgba(232,181,66,.045),transparent 24%)}
.home__background{filter:saturate(1.08) brightness(.97) contrast(1.04)}
.home__shade{background:radial-gradient(circle at 72% 44%,rgba(42,166,180,.17),transparent 28%),radial-gradient(circle at 86% 65%,rgba(224,82,91,.055),transparent 24%),linear-gradient(90deg,rgba(4,10,15,.95) 0%,rgba(4,10,15,.86) 34%,rgba(4,10,15,.48) 68%,rgba(4,10,15,.30) 100%),linear-gradient(0deg,rgba(4,10,15,.66),transparent 46%)}
.network-motion{opacity:.97}.route{box-shadow:0 0 24px rgba(75,208,217,.22)}.route--d{box-shadow:0 0 20px rgba(245,188,72,.13)}.route--e{box-shadow:0 0 20px rgba(220,80,92,.12)}
.home-topbar{padding:8px 10px;border-radius:13px;background:linear-gradient(90deg,rgba(6,16,22,.48),rgba(7,16,22,.18));backdrop-filter:blur(9px)}
.home-logo b{color:#f8ffff;text-shadow:0 0 28px rgba(112,226,234,.16)}.home-logo span{opacity:.72}
.hero-kicker{color:#91eef2;text-shadow:0 0 20px rgba(83,218,227,.16)}
.hero h1{color:#fff;text-shadow:0 16px 68px rgba(0,0,0,.46)}
.hero h1 em{color:#bceff2;text-shadow:0 0 30px rgba(80,214,223,.16),0 12px 60px rgba(0,0,0,.25)}
.hero-copy{color:rgba(239,250,251,.78)}
.continue-card{position:relative;overflow:hidden;border-color:rgba(116,226,232,.34);background:linear-gradient(120deg,rgba(23,51,60,.89),rgba(8,18,24,.78));box-shadow:0 24px 66px rgba(0,0,0,.34),0 0 38px rgba(72,202,211,.045),inset 0 1px 0 rgba(255,255,255,.055)}
.continue-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#7eebf0,#3fbcc8);box-shadow:0 0 16px rgba(92,222,231,.36)}
.continue-card__head span{color:#91edf2}.continue-card strong{font-size:calc(17px * var(--clu-text-scale,1))}.continue-card span{opacity:.72}.continue-card small{opacity:.5}
.continue-card button{border-color:rgba(113,232,239,.52);background:linear-gradient(135deg,rgba(67,210,220,.32),rgba(47,145,158,.18));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.continue-card button:hover{background:linear-gradient(135deg,rgba(80,229,238,.42),rgba(47,155,168,.24));box-shadow:0 10px 26px rgba(41,176,188,.10)}
.premium-menu{gap:9px}
.premium-action{overflow:hidden;border-color:rgba(255,255,255,.13);background:linear-gradient(100deg,rgba(17,31,40,.94),rgba(10,20,27,.76));box-shadow:0 10px 36px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.03)}
.premium-action::before{content:"";position:absolute;left:0;top:13px;bottom:13px;width:2px;border-radius:99px;background:rgba(116,226,232,.38);opacity:.62;transition:opacity .15s ease,box-shadow .15s ease}
.premium-action:hover{transform:translateX(-5px) scale(1.008);border-color:rgba(114,224,231,.42);background:linear-gradient(100deg,rgba(22,43,52,.96),rgba(12,25,32,.82));box-shadow:0 14px 44px rgba(0,0,0,.24),0 0 28px rgba(74,211,220,.055)}
.premium-action:hover::before{opacity:1;box-shadow:0 0 13px rgba(108,230,237,.38)}
.premium-action--primary{border-color:rgba(94,225,233,.46);background:linear-gradient(105deg,rgba(39,158,171,.38),rgba(11,27,35,.77));box-shadow:0 12px 40px rgba(0,0,0,.19),0 0 32px rgba(54,201,212,.05)}
.premium-action--primary::before{background:#68e2e9;box-shadow:0 0 15px rgba(104,226,233,.28)}
.premium-action--challenge{border-color:rgba(244,196,67,.43);background:linear-gradient(105deg,rgba(142,104,18,.36),rgba(29,24,12,.74))}.premium-action--challenge::before{background:#ffd159}.premium-action--challenge:hover{border-color:rgba(255,210,80,.55);background:linear-gradient(105deg,rgba(158,116,20,.43),rgba(33,27,13,.78))}
.premium-action--online{border-color:rgba(225,69,78,.39);background:linear-gradient(105deg,rgba(127,31,39,.33),rgba(27,15,20,.74))}.premium-action--online::before{background:#ff7580}.premium-action--online:hover{border-color:rgba(240,88,98,.52);background:linear-gradient(105deg,rgba(143,36,44,.4),rgba(31,17,22,.78))}
.action-icon{background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.045));border-color:rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.premium-action strong{font-size:calc(13.5px * var(--clu-text-scale,1))}.premium-action small{opacity:.51}.premium-action>b{font-size:calc(18px * var(--clu-text-scale,1))}
.premium-action--link{opacity:.82}.premium-action--link:hover{opacity:1}
.home-meta--actions button{background:rgba(255,255,255,.045);border-color:rgba(255,255,255,.10);color:rgba(241,250,251,.78);backdrop-filter:blur(8px)}
.home-meta--actions button:hover{border-color:rgba(116,226,232,.38);background:rgba(116,226,232,.095);box-shadow:0 8px 22px rgba(0,0,0,.12)}
.home-footer{opacity:.46}
@media(max-width:900px){.home__shade{background:linear-gradient(0deg,rgba(4,10,15,.96),rgba(4,10,15,.63)),radial-gradient(circle at 60% 15%,rgba(42,166,180,.16),transparent 35%)}.network-motion{opacity:.48}}
@media(prefers-reduced-motion:reduce){.premium-action:hover{transform:none}.route,.pulse,.moving-unit,.premium-action--challenge{animation:none}}


/* Refonte accueil — alignement maquette + perspective premium */
.home--station{
  --home-cyan:#38e8fa;
  --home-gold:#ffc54f;
  --home-pink:#ed70c5;
  position:fixed!important;
  inset:0!important;
  width:100vw!important;
  height:100dvh!important;
  min-height:0!important;
  max-height:100dvh!important;
  overflow:hidden!important;
  overscroll-behavior:none;
  isolation:isolate;
  background:#04101c;
  font-family:"Avenir Next",Montserrat,"Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif;
}
.home--station .home__background{
  position:absolute;
  inset:0;
  transform:none;
  background:url('../../arriereplan.png') center center/cover no-repeat;
  filter:saturate(1.04) contrast(1.03) brightness(.91);
}
.home--station .home__shade{
  position:absolute;
  inset:0;
  background:
    linear-gradient(90deg,rgba(2,8,14,.60) 0%,rgba(2,8,14,.27) 43%,rgba(2,8,14,.16) 72%,rgba(2,8,14,.24) 100%),
    linear-gradient(180deg,rgba(2,8,14,.15),rgba(2,8,14,.03) 50%,rgba(2,8,14,.34));
  pointer-events:none;
}
.home--station .home__shade::after{
  content:"";
  position:absolute;
  inset:0;
  box-shadow:inset 0 0 150px rgba(0,0,0,.30);
}
.home-stage{
  --home-stage-scale:1;
  position:absolute;
  z-index:3;
  left:50%;
  top:50%;
  width:1600px;
  height:760px;
  overflow:visible;
  transform:translate(-50%,-50%) scale(var(--home-stage-scale));
  transform-origin:center center;
  perspective:1800px;
  perspective-origin:50% 48%;
}
.home-topbar{
  position:absolute!important;
  z-index:6;
  left:72px!important;
  right:48px!important;
  top:36px!important;
  padding:0!important;
  margin:0!important;
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  border:0!important;
  border-radius:0!important;
  background:none!important;
  backdrop-filter:none!important;
  box-shadow:none!important;
}
.home-logo{
  position:relative;
  display:flex;
  align-items:flex-end;
  gap:8px;
  min-width:0;
  padding:0;
  background:none;
}
.home-logo::before,.home-logo::after{display:none!important;content:none!important}
.home-logo__wordmark{
  position:relative;
  display:grid;
  gap:0;
  line-height:1;
  transform-origin:left center;
  animation:lampFlicker 8.8s linear infinite;
}
.home-logo__wordmark b{
  margin:0;
  font-size:78px;
  font-weight:850;
  line-height:.80;
  letter-spacing:-.085em;
  color:#fff;
  text-shadow:0 0 9px rgba(255,255,255,.18),0 0 24px rgba(93,226,255,.10);
}
.home-logo__wordmark span{
  margin-top:5px;
  font-size:29px;
  line-height:.92;
  font-weight:720;
  letter-spacing:-.060em;
  color:#e9f3ff;
  text-shadow:0 0 10px rgba(111,219,255,.08);
}
.home-logo__mark{
  position:relative;
  width:126px;
  height:auto;
  margin:0 0 1px 0;
  filter:drop-shadow(0 0 8px rgba(43,231,244,.22));
  animation:lampMarkFlicker 8.8s linear infinite;
}
@keyframes lampFlicker{
  0%,76.5%,78.15%,80%,100%{opacity:1;filter:brightness(1)}
  77.1%{opacity:.30;filter:brightness(.40)}
  77.55%{opacity:1;filter:brightness(1.55) drop-shadow(0 0 8px rgba(255,255,255,.50))}
  78.55%{opacity:.22;filter:brightness(.34)}
  79.10%{opacity:.72;filter:brightness(.84)}
  79.48%{opacity:.35;filter:brightness(.48)}
  79.82%{opacity:1;filter:brightness(1.72) drop-shadow(0 0 13px rgba(103,231,255,.56))}
}
@keyframes lampMarkFlicker{
  0%,76.6%,78.2%,80.1%,100%{opacity:1;filter:drop-shadow(0 0 8px rgba(43,231,244,.22)) brightness(1)}
  77.2%{opacity:.42;filter:brightness(.52)}
  77.65%{opacity:1;filter:drop-shadow(0 0 15px rgba(43,231,244,.52)) brightness(1.42)}
  78.60%{opacity:.25;filter:brightness(.38)}
  79.75%{opacity:1;filter:drop-shadow(0 0 18px rgba(43,231,244,.58)) brightness(1.55)}
}
.legal-entry{
  min-height:50px;
  display:inline-flex;
  align-items:center;
  gap:10px;
  padding:0 18px;
  border:1px solid rgba(171,221,255,.24);
  border-radius:17px;
  background:linear-gradient(180deg,rgba(9,27,44,.78),rgba(6,18,30,.66));
  color:#f2f8ff;
  font:700 13px/1 inherit;
  cursor:pointer;
  backdrop-filter:blur(16px) saturate(1.15);
  box-shadow:0 16px 40px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.07);
}
.legal-entry>span{width:23px;height:23px;border-radius:999px;display:grid;place-items:center;background:rgba(47,220,245,.14);color:#71ecfb}
.home-shell--launcher{position:absolute;inset:0;width:auto;min-height:0;margin:0;padding:0;display:block}
.launcher-actions{
  position:absolute;
  left:78px;
  top:242px;
  width:472px;
  max-width:none;
  display:grid;
  gap:15px;
  transform:rotateY(4deg) rotateX(.2deg) translateZ(4px);
  transform-origin:left center;
}
.launcher-action{
  position:relative;
  min-height:96px;
  display:grid;
  grid-template-columns:66px minmax(0,1fr) auto;
  align-items:center;
  gap:18px;
  padding:13px 22px 13px 18px;
  border:1px solid rgba(255,255,255,.14);
  border-radius:23px;
  color:#fff;
  text-align:left;
  cursor:pointer;
  background:linear-gradient(108deg,rgba(8,28,45,.71),rgba(7,20,34,.57));
  backdrop-filter:blur(19px) saturate(1.16);
  box-shadow:0 22px 48px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.09),-7px 0 26px rgba(0,0,0,.08);
  transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,filter .16s ease;
}
.launcher-action::before{
  content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(118deg,rgba(255,255,255,.075),transparent 27%,transparent 71%,rgba(255,255,255,.025));
}
.launcher-action:hover{transform:translateZ(14px) translateX(3px);filter:brightness(1.05);box-shadow:0 27px 56px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.11)}
.launcher-action--primary{border-color:rgba(52,236,255,.78);background:linear-gradient(108deg,rgba(3,101,145,.66),rgba(7,34,57,.69));box-shadow:0 22px 50px rgba(0,0,0,.23),0 0 28px rgba(30,221,255,.14),inset 0 1px 0 rgba(255,255,255,.10)}
.launcher-action--challenge{border-color:rgba(248,190,63,.72);background:linear-gradient(108deg,rgba(103,69,3,.60),rgba(35,27,14,.68));box-shadow:0 22px 50px rgba(0,0,0,.23),0 0 24px rgba(245,183,57,.09),inset 0 1px 0 rgba(255,255,255,.08)}
.launcher-action--online{border-color:rgba(248,104,199,.68);background:linear-gradient(108deg,rgba(92,25,79,.58),rgba(34,17,38,.68));box-shadow:0 22px 50px rgba(0,0,0,.23),0 0 24px rgba(239,105,192,.09),inset 0 1px 0 rgba(255,255,255,.08)}
.launcher-action__icon{width:64px;height:64px;display:grid;place-items:center;border-radius:999px;border:1px solid rgba(255,255,255,.20);background:linear-gradient(180deg,rgba(39,196,244,.55),rgba(13,118,167,.64));box-shadow:inset 0 1px 0 rgba(255,255,255,.20),0 0 24px rgba(64,220,255,.18);font-size:35px;font-weight:500}
.launcher-action--challenge .launcher-action__icon{background:linear-gradient(180deg,rgba(244,181,48,.72),rgba(152,95,7,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 22px rgba(245,183,57,.14)}
.launcher-action--online .launcher-action__icon{background:linear-gradient(180deg,rgba(213,79,178,.66),rgba(120,45,119,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 22px rgba(239,105,192,.13)}
.launcher-action__icon--people{font-size:12px;letter-spacing:2px}
.launcher-action__copy{display:grid;min-width:0}.launcher-action__title-row{display:flex;align-items:center;gap:9px;min-width:0}.launcher-action__copy strong{font-size:29px;line-height:1.04;font-weight:760;letter-spacing:-.045em}.launcher-beta{display:inline-grid;place-items:center;min-height:21px;padding:0 8px;border:1px solid rgba(255,211,92,.42);border-radius:999px;background:rgba(255,197,63,.10);color:#f6d57d;font-size:9px;font-style:normal;font-weight:900;letter-spacing:.12em;box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}.launcher-action__copy small{display:none}.launcher-action>b{font-size:34px;line-height:1;color:#fff;font-weight:450}
.latest-card{
  position:absolute;
  right:86px;
  top:246px;
  width:590px;
  max-width:none;
  min-height:0;
  display:grid;
  grid-template-rows:auto 150px auto auto 58px;
  gap:11px;
  padding:19px;
  border:1px solid rgba(108,211,255,.54);
  border-radius:25px;
  background:linear-gradient(145deg,rgba(8,30,51,.76),rgba(4,20,36,.81));
  backdrop-filter:blur(22px) saturate(1.18);
  box-shadow:0 28px 72px rgba(0,0,0,.31),0 0 32px rgba(44,202,255,.07),inset 0 1px 0 rgba(255,255,255,.10),9px 8px 32px rgba(0,0,0,.09);
  transform:rotateY(-2.25deg) rotateX(.30deg) translateZ(8px);
  transform-origin:right center;
}
.latest-card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(132deg,rgba(255,255,255,.060),transparent 22%,transparent 72%,rgba(36,224,255,.038))}
.latest-card__header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:24px}.latest-card__header>div{display:grid;gap:2px}.latest-card__header span{font-size:12px;font-weight:820;letter-spacing:.13em;text-transform:uppercase;color:#bbd8eb}.latest-card__header small{font-size:9px;color:rgba(225,239,249,.42)}.latest-card__header i{width:58px;height:2px;border-radius:999px;background:linear-gradient(90deg,#35eaff,transparent);box-shadow:0 0 14px rgba(53,234,255,.42)}
.latest-card__preview{position:relative;height:150px;overflow:hidden;border:1px solid rgba(181,222,249,.18);border-radius:18px;background:linear-gradient(145deg,rgba(9,28,45,.70),rgba(5,17,29,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 15px 34px rgba(0,0,0,.14)}
.latest-card__thumbnail{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.07) contrast(1.03) brightness(.98)}
.latest-card__preview::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 64%,rgba(3,11,18,.16))}
.latest-card__preview-empty{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:4px;text-align:center;color:rgba(220,237,249,.55)}.latest-card__preview-empty>span{font-size:23px;color:#61dceb}.latest-card__preview-empty strong{font-size:11px;color:#d9ebf5}.latest-card__preview-empty small{max-width:300px;font-size:9px;line-height:1.35;color:rgba(218,235,245,.48)}
.latest-card__identity{display:grid;gap:2px;min-width:0}.latest-card__identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:34px;line-height:.96;font-weight:780;letter-spacing:-.058em;color:#fff}.latest-card__identity span{font-size:13px;font-weight:700;color:#e2edf6}.latest-card__identity small{font-size:10px;color:rgba(215,230,241,.58);text-transform:capitalize}
.latest-card__stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:1px 0}.latest-card__stats>div{position:relative;min-width:0;padding:0 14px 0 0;background:none;border:0;border-radius:0}.latest-card__stats>div+div{padding-left:14px;border-left:1px solid rgba(180,216,239,.18)}.latest-card__stats span{display:block;margin-bottom:2px;font-size:8px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:rgba(205,225,239,.46)}.latest-card__stats strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:760;color:#f7fbff}
.latest-card__continue{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 21px;border:0;border-radius:15px;background:linear-gradient(90deg,#61eef8,#49d9ef);color:#04131f;cursor:pointer;box-shadow:0 15px 35px rgba(39,219,239,.19),inset 0 1px 0 rgba(255,255,255,.42);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}.latest-card__continue:hover{transform:translateZ(12px) translateY(-1px);filter:brightness(1.04);box-shadow:0 20px 40px rgba(39,219,239,.24),inset 0 1px 0 rgba(255,255,255,.45)}.latest-card__continue span{font-size:19px;font-weight:780;letter-spacing:-.03em}.latest-card__continue b{font-size:25px;font-weight:500}.latest-card--empty{grid-template-rows:auto 150px 1fr 58px}
.home-utilities{position:absolute;z-index:5;left:78px;bottom:58px;display:flex;align-items:center;gap:13px;transform:rotateY(1.15deg);transform-origin:left center}
.home-utilities button,.home-utilities a{min-width:0;min-height:57px;display:grid;grid-template-columns:38px auto 18px;align-items:center;gap:10px;padding:0 14px;border:1px solid rgba(161,211,250,.28);border-radius:16px;background:linear-gradient(180deg,rgba(8,28,46,.70),rgba(7,19,31,.60));color:#f3f8ff;text-decoration:none;cursor:pointer;backdrop-filter:blur(16px) saturate(1.12);box-shadow:0 15px 36px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.06)}
.home-utilities button:hover,.home-utilities a:hover{border-color:rgba(95,225,247,.55);background:linear-gradient(180deg,rgba(10,36,58,.78),rgba(7,23,38,.68))}.utility-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:rgba(108,172,255,.10);border:1px solid rgba(164,211,255,.13);color:#b9dfff}.home-utilities strong{font-size:12px;font-weight:720;white-space:nowrap}.home-utilities b{font-size:17px;color:#c4e8ff}.storage-error{position:fixed;z-index:7;left:50%;bottom:18px;transform:translateX(-50%)}
@media(min-width:821px) and (min-height:720px){
  .home-stage{height:900px}
  .home-topbar{top:50px!important}
  .launcher-actions{top:290px;width:510px;gap:17px}
  .launcher-action{min-height:110px}
  .latest-card{top:298px;right:70px;width:620px;grid-template-rows:auto 174px auto auto 64px;gap:13px;padding:21px}.latest-card__preview{height:174px}.latest-card__continue{min-height:64px}
  .home-utilities{bottom:66px}
}
@media(max-width:820px){
  .home--station{position:fixed!important;overflow:hidden!important}
  .home-stage{position:absolute;left:0;top:0;width:100%;height:100%;min-height:0;transform:none!important;padding:0 12px 76px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;perspective:none}
  .home-topbar{position:relative!important;left:auto!important;right:auto!important;top:auto!important;padding:16px 0 12px!important;align-items:flex-start!important}
  .home-logo{gap:6px}.home-logo__wordmark b{font-size:46px}.home-logo__wordmark span{font-size:18px}.home-logo__mark{width:72px}.legal-entry{min-height:38px;padding:0 9px;border-radius:12px;font-size:10px}.legal-entry>span{display:none}
  .home-shell--launcher{position:relative;inset:auto;display:grid;gap:14px}.launcher-actions{position:relative;left:auto;top:auto;width:100%;gap:9px;transform:none}.launcher-action{min-height:76px;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;padding:10px 14px;border-radius:17px}.launcher-action__icon{width:46px;height:46px;font-size:27px}.launcher-action__copy strong{font-size:20px}.launcher-action>b{font-size:26px}
  .latest-card{position:relative;right:auto;top:auto;width:auto;padding:14px;border-radius:19px;grid-template-rows:auto 126px auto auto 52px;gap:9px;transform:none}.latest-card__preview{height:126px;border-radius:14px}.latest-card__identity strong{font-size:27px}.latest-card__identity span{font-size:12px}.latest-card__stats strong{font-size:14px}.latest-card__continue{min-height:52px}
  .home-utilities{position:fixed;left:8px;right:8px;bottom:8px;justify-content:center;gap:6px;transform:none}.home-utilities button,.home-utilities a{min-height:48px;grid-template-columns:31px minmax(0,1fr);gap:6px;padding:0 7px;flex:1}.home-utilities b{display:none}.utility-icon{width:31px;height:31px}.home-utilities strong{font-size:9px;white-space:normal;line-height:1.08}
}
@media(max-width:460px){.home-logo__wordmark b{font-size:42px}.home-logo__wordmark span{font-size:17px}.home-logo__mark{width:66px}.legal-entry{max-width:116px;line-height:1.08;text-align:left}.latest-card__stats{grid-template-columns:1fr 1fr;row-gap:8px}.latest-card__stats>div:nth-child(3){grid-column:1/-1;border-left:0!important;padding-left:0!important}.home-utilities strong{display:none}.home-utilities button,.home-utilities a{flex:0 0 46px;display:grid;grid-template-columns:1fr;place-items:center}.utility-icon{border:0;background:transparent}}
@media(prefers-reduced-motion:reduce){.home-logo__wordmark,.home-logo__mark{animation:none}.launcher-actions,.latest-card,.home-utilities{transform:none}.launcher-action,.latest-card__continue{transition:none}}


.launcher-action--locked,
.launcher-action--locked:hover{
  cursor:not-allowed;
  opacity:.66;
  filter:saturate(.72);
  box-shadow:0 20px 42px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.05);
}
.launcher-action--locked .launcher-action__icon{font-size:19px}
.launcher-action--locked .launcher-action__copy small{display:block;margin-top:4px;font-size:11px;color:rgba(248,214,239,.70)}
.launcher-action--locked:hover{transform:none}
.latest-card__stats--four{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:760px){.latest-card__stats--four{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:460px){
  .latest-card__stats--four>div:nth-child(3){grid-column:auto!important;border-left:1px solid rgba(180,216,239,.18)!important;padding-left:14px!important}
}


/* Menus accueil premium — Défi / Sauvegardes / Paramètres + langue */
.home-topbar__actions{display:flex;align-items:center;gap:9px}
.locale-picker{position:relative;z-index:20}
.locale-picker__trigger{width:50px;height:50px;display:grid;place-items:center;padding:0;border:1px solid rgba(171,221,255,.24);border-radius:17px;background:linear-gradient(180deg,rgba(9,27,44,.78),rgba(6,18,30,.66));color:#fff;cursor:pointer;backdrop-filter:blur(16px) saturate(1.15);box-shadow:0 16px 40px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.07)}
.locale-picker__trigger :deep(.country-flag){width:27px;height:18px;border-radius:4px}
.locale-picker__menu{position:absolute;right:0;top:58px;width:188px;display:grid;gap:4px;padding:7px;border:1px solid rgba(156,211,247,.18);border-radius:15px;background:rgba(5,17,28,.96);backdrop-filter:blur(22px) saturate(1.14);box-shadow:0 24px 60px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.04)}
.locale-picker__menu button{min-height:38px;display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:9px;padding:0 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:#eef8ff;text-align:left;cursor:pointer;font:700 11px/1 inherit}
.locale-picker__menu button:hover{background:rgba(255,255,255,.05)}.locale-picker__menu button.active{border-color:rgba(82,214,225,.24);background:rgba(62,196,208,.10)}.locale-picker__menu button b{color:#71e4ec}.locale-picker__menu :deep(.country-flag){width:24px;height:16px}

.dialog{position:relative;border-radius:24px;border-color:rgba(155,210,245,.16);background:linear-gradient(150deg,rgba(7,20,32,.97),rgba(4,13,22,.98));box-shadow:0 40px 120px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.045)}
.dialog::before{content:"";position:absolute;left:28px;right:28px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(70,225,238,.58),transparent);pointer-events:none}
.dialog--settings{width:min(980px,calc(100vw - 38px))}.dialog--challenge{width:min(980px,calc(100vw - 38px))}.dialog--saves{width:min(1040px,calc(100vw - 38px))}
.dialog__header{padding:18px 22px 16px;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent);border-bottom-color:rgba(255,255,255,.055)}.dialog__header p{color:#76e0e8;font-weight:900}.dialog__header h2{font-size:calc(23px * var(--clu-text-scale,1));letter-spacing:-.035em}.dialog__header button{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);font-size:20px}.dialog__header button:hover{background:rgba(255,255,255,.06)}.dialog__body{padding:16px 18px 18px}

.saves-panel{display:grid;gap:11px}.saves-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:17px 18px;border:1px solid rgba(76,215,226,.18);border-radius:17px;background:linear-gradient(120deg,rgba(29,117,132,.16),rgba(9,21,30,.42))}.saves-hero>div{display:grid;gap:3px}.saves-hero p{margin:0;font-size:calc(7.5px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#71dce4}.saves-hero h3{margin:0;font-size:calc(20px * var(--clu-text-scale,1));letter-spacing:-.035em}.saves-hero>div>span{font-size:calc(9px * var(--clu-text-scale,1));color:rgba(230,242,250,.52)}.saves-import{min-height:42px;display:flex;align-items:center;gap:8px;padding:0 14px;border:1px solid rgba(85,218,228,.28);border-radius:11px;background:rgba(65,194,204,.10);color:#eafdff;cursor:pointer;font-weight:800}.saves-import span{font-size:18px;color:#74e2ea}.save-import-input{display:none}
.saves-controls{display:grid;grid-template-columns:minmax(320px,.78fr) minmax(260px,1fr);gap:10px;align-items:center}.save-folders{margin:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.save-folders button{min-height:46px;display:grid;grid-template-columns:auto minmax(0,1fr);justify-content:stretch;gap:9px;padding:7px 10px;border-radius:12px;background:rgba(5,14,21,.48)}.save-folders button>span:last-child{display:flex;align-items:center;justify-content:space-between;gap:7px}.save-folder-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(84,211,222,.10);color:#79e1e8}.save-folder-icon--challenge{background:rgba(244,193,62,.10);color:#f1cb62}.save-folders button.active{border-color:rgba(85,215,226,.45);background:linear-gradient(145deg,rgba(57,185,197,.12),rgba(8,21,29,.52))}.save-folders strong{font-size:calc(9.5px * var(--clu-text-scale,1))}.save-folders small{font-size:calc(8px * var(--clu-text-scale,1));color:rgba(232,242,248,.52)}
.save-search{height:46px;margin:0;border-radius:12px;background:rgba(5,14,21,.56);border-color:rgba(255,255,255,.08);padding:0 12px}.save-search input{font-size:calc(9.5px * var(--clu-text-scale,1))}
.save-folder-note{margin:0;padding:8px 10px;border:1px solid rgba(244,196,67,.09);border-radius:10px;background:rgba(244,196,67,.05);font-size:calc(8.5px * var(--clu-text-scale,1))}.save-message{margin:0;border:1px solid transparent}.save-message--warning{border-color:rgba(236,174,66,.12)}.save-message--ok{border-color:rgba(60,177,110,.12)}.save-message--error{border-color:rgba(200,65,65,.12)}
.save-list{display:grid;gap:8px}.save-card{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.028),rgba(255,255,255,.012));transition:border-color .15s ease,background .15s ease}.save-card:hover{border-color:rgba(111,215,229,.18);background:linear-gradient(145deg,rgba(61,190,201,.05),rgba(255,255,255,.015))}.save-card__side{align-self:stretch;min-height:72px;display:grid;place-items:center;align-content:center;gap:5px;border-radius:11px;background:linear-gradient(145deg,rgba(72,203,214,.11),rgba(10,28,38,.36));border:1px solid rgba(91,215,225,.10);color:#78dfe7}.save-card__side--challenge{background:linear-gradient(145deg,rgba(236,183,52,.12),rgba(40,31,10,.32));border-color:rgba(236,183,52,.12);color:#efc85e}.save-card__side>span{font-size:18px}.save-card__side small{font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;color:rgba(238,246,249,.5)}.save-card__content{gap:5px}.save-card__title-row strong{font-size:calc(13.5px * var(--clu-text-scale,1));letter-spacing:-.02em}.save-card__chips{display:flex;flex-wrap:wrap;gap:5px}.save-card__chips span{padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.035);font-size:calc(7.5px * var(--clu-text-scale,1));color:rgba(232,242,248,.58)}.save-card__meta{display:flex;flex-wrap:wrap;gap:4px 12px}.save-card__meta span{font-size:calc(8px * var(--clu-text-scale,1));color:rgba(229,240,247,.42)}.save-card__actions{display:grid;grid-template-columns:130px auto;gap:7px;align-items:center}.save-card__actions button,.save-rename button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;border-radius:9px;cursor:pointer}.save-card__load{min-height:40px!important;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 11px!important;border-color:rgba(71,214,225,.28)!important;background:linear-gradient(135deg,rgba(63,195,205,.16),rgba(31,105,119,.10))!important;font-weight:800}.save-card__load b{font-size:17px}.save-card__secondary-actions{display:grid;grid-template-columns:repeat(4,34px);gap:4px}.save-card__secondary-actions button{width:34px;height:34px;padding:0!important;display:grid;place-items:center}.save-card__delete{color:#ffaaa9!important}.save-card__actions button:disabled{opacity:.3;cursor:not-allowed}.save-rename{display:grid;gap:7px}.save-rename input{border:1px solid rgba(255,255,255,.1);background:rgba(5,14,21,.56);color:inherit;border-radius:9px;padding:9px}.save-rename>div{display:flex;gap:5px}.saves-empty{display:grid;place-items:center;align-content:center;min-height:220px;padding:26px;border:1px dashed rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.012);opacity:1}.saves-empty>span{font-size:28px;color:#5fd6df}.saves-empty strong{font-size:calc(14px * var(--clu-text-scale,1))}.saves-empty p{margin:0;max-width:380px;text-align:center;color:rgba(231,241,247,.46)}

@media(max-width:820px){.home-topbar__actions{gap:6px}.locale-picker__trigger{width:38px;height:38px;border-radius:12px}.locale-picker__trigger :deep(.country-flag){width:23px;height:15px}.locale-picker__menu{top:45px}.dialog--settings,.dialog--challenge,.dialog--saves{width:min(100%,calc(100vw - 24px))}.saves-controls{grid-template-columns:1fr}.save-card{grid-template-columns:46px minmax(0,1fr)}.save-card__actions{grid-column:1/-1;grid-template-columns:minmax(130px,1fr) auto}.save-card__side{min-height:64px}}
@media(max-width:560px){.legal-entry{max-width:none}.legal-entry{font-size:9px}.home-topbar__actions{align-items:flex-start}.locale-picker__menu{right:0;width:172px}.dialog__header{padding:14px}.dialog__body{padding:12px}.saves-hero{grid-template-columns:1fr}.saves-import{width:max-content}.save-folders{grid-template-columns:1fr 1fr}.save-card{grid-template-columns:1fr}.save-card__side{display:none}.save-card__actions{grid-column:auto;grid-template-columns:1fr}.save-card__secondary-actions{grid-template-columns:repeat(4,1fr)}.save-card__secondary-actions button{width:auto}.save-card__meta{display:grid;gap:3px}}


/* Harmonisation panneaux accueil — même langage visuel que le menu principal */
.overlay{
  padding:18px;
  background:rgba(2,8,14,.50);
  backdrop-filter:blur(5px) saturate(.92);
}
.dialog{
  width:min(1120px,calc(100vw - 36px));
  max-height:calc(100dvh - 32px);
  grid-template-rows:auto minmax(0,1fr);
  gap:12px;
  overflow:visible;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  outline:0;
  perspective:1600px;
}
.dialog--settings,.dialog--challenge{width:min(1160px,calc(100vw - 36px))}
.dialog--saves{width:min(1200px,calc(100vw - 36px))}
.dialog__header{
  position:relative;
  min-height:74px;
  padding:14px 18px 14px 22px;
  border:1px solid rgba(153,216,249,.17);
  border-radius:22px;
  background:linear-gradient(104deg,rgba(10,31,49,.80),rgba(6,18,30,.64));
  backdrop-filter:blur(20px) saturate(1.16);
  box-shadow:0 20px 55px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.06);
  transform:perspective(1600px) rotateY(-1.2deg);
  transform-origin:left center;
}
.dialog__header::before{
  content:"";
  position:absolute;
  left:22px;
  top:0;
  width:170px;
  height:1px;
  background:linear-gradient(90deg,rgba(57,232,250,.92),transparent);
  box-shadow:0 0 20px rgba(57,232,250,.36);
}
.dialog--challenge .dialog__header{border-color:rgba(255,203,79,.22);background:linear-gradient(104deg,rgba(71,48,11,.74),rgba(15,20,27,.68))}
.dialog--challenge .dialog__header::before{background:linear-gradient(90deg,rgba(255,199,68,.95),transparent);box-shadow:0 0 22px rgba(255,199,68,.32)}
.dialog__header p{margin:0 0 3px;color:#73e4ed;font-size:calc(8px * var(--clu-text-scale,1));font-weight:950;letter-spacing:.17em;text-transform:uppercase}
.dialog--challenge .dialog__header p{color:#f3ce67}
.dialog__header h2{margin:0;font-size:calc(27px * var(--clu-text-scale,1));line-height:1;letter-spacing:-.045em;font-weight:820}
.dialog__header button{
  width:43px;height:43px;
  display:grid;place-items:center;
  border:1px solid rgba(255,255,255,.10);
  border-radius:14px;
  background:rgba(255,255,255,.045);
  color:#eefaff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
  transition:transform .15s ease,background .15s ease,border-color .15s ease;
}
.dialog__header button:hover{transform:translateY(-1px);background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
.dialog__body{
  position:relative;
  min-height:0;
  overflow:auto;
  padding:20px;
  border:1px solid rgba(154,215,248,.14);
  border-radius:27px;
  background:linear-gradient(145deg,rgba(7,23,37,.86),rgba(4,14,24,.76));
  backdrop-filter:blur(24px) saturate(1.12);
  box-shadow:0 36px 100px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.045);
  scrollbar-width:thin;
  scrollbar-color:rgba(107,221,232,.32) transparent;
}
.dialog--challenge .dialog__body{border-color:rgba(247,198,71,.16);background:linear-gradient(145deg,rgba(36,29,14,.76),rgba(5,15,23,.82))}
.dialog__body::after{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius:inherit;
  background:radial-gradient(circle at 84% 8%,rgba(45,210,227,.08),transparent 24%);
}
.dialog--challenge .dialog__body::after{background:radial-gradient(circle at 84% 8%,rgba(255,194,56,.09),transparent 25%)}
.dialog__body>*{position:relative;z-index:1}

.saves-panel{gap:14px;perspective:1500px}
.saves-hero{
  min-height:108px;
  padding:20px 22px;
  border-color:rgba(69,225,239,.25);
  border-radius:21px;
  background:linear-gradient(105deg,rgba(29,137,153,.27),rgba(7,22,34,.56));
  backdrop-filter:blur(16px);
  box-shadow:0 18px 45px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.05);
  transform:perspective(1500px) rotateY(-1.5deg);
  transform-origin:left center;
}
.saves-hero p{font-size:calc(8px * var(--clu-text-scale,1));letter-spacing:.17em;color:#73e5ee}
.saves-hero h3{font-size:calc(29px * var(--clu-text-scale,1));line-height:1;letter-spacing:-.045em}
.saves-hero>div>span{margin-top:3px;font-size:calc(9.5px * var(--clu-text-scale,1));color:rgba(232,245,252,.60)}
.saves-import{min-height:48px;padding:0 17px;border-radius:14px;border-color:rgba(78,225,237,.33);background:linear-gradient(135deg,rgba(54,201,213,.17),rgba(29,104,116,.11));box-shadow:0 12px 28px rgba(0,0,0,.12)}
.saves-controls{grid-template-columns:minmax(300px,.68fr) minmax(280px,1fr);gap:12px}
.save-folders button,.save-search{min-height:50px;border-radius:14px;border-color:rgba(255,255,255,.08);background:rgba(5,17,27,.50);backdrop-filter:blur(12px)}
.save-folders button.active{border-color:rgba(74,221,233,.42);background:linear-gradient(145deg,rgba(55,191,203,.15),rgba(7,23,34,.52));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.save-list{gap:10px;perspective:1400px}
.save-card{
  min-height:92px;
  grid-template-columns:62px minmax(0,1fr) auto;
  gap:14px;
  padding:13px 14px;
  border-radius:17px;
  border-color:rgba(255,255,255,.08);
  background:linear-gradient(105deg,rgba(18,42,55,.64),rgba(7,19,29,.47));
  backdrop-filter:blur(14px);
  box-shadow:0 14px 34px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.025);
  transform:perspective(1400px) rotateY(-.65deg);
  transform-origin:left center;
  transition:transform .16s ease,border-color .16s ease,background .16s ease;
}
.save-card:hover{transform:perspective(1400px) rotateY(0deg) translateX(3px);border-color:rgba(86,221,233,.22);background:linear-gradient(105deg,rgba(24,55,69,.68),rgba(7,20,30,.50))}
.save-card__side{min-height:64px;border-radius:14px}
.save-card__title-row strong{font-size:calc(15px * var(--clu-text-scale,1));letter-spacing:-.025em}
.save-card__actions{grid-template-columns:138px auto;gap:8px}
.save-card__load{min-height:44px!important;border-radius:11px!important}
.save-card__secondary-actions button{border-radius:10px!important;background:rgba(255,255,255,.035)!important}
.saves-empty{min-height:240px;border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.022),rgba(255,255,255,.008))}

@media(max-width:820px){
  .overlay{padding:10px}
  .dialog,.dialog--settings,.dialog--challenge,.dialog--saves{width:100%;max-height:calc(100dvh - 20px);gap:8px}
  .dialog__header{min-height:62px;padding:11px 13px 11px 16px;border-radius:18px;transform:none}
  .dialog__header h2{font-size:calc(22px * var(--clu-text-scale,1))}
  .dialog__body{padding:13px;border-radius:20px}
  .saves-hero{transform:none;min-height:auto;padding:16px}
  .save-card{transform:none}
}


/* Refonte naturelle — panneaux du menu, plus compacts et plus "jeu" */
.overlay{
  padding:16px;
  background:rgba(2,7,12,.44);
  backdrop-filter:blur(3px);
}
.dialog,
.dialog--settings,
.dialog--challenge,
.dialog--saves{
  width:min(880px,calc(100vw - 32px));
  max-height:calc(100dvh - 32px);
  gap:0;
  overflow:hidden;
  border:1px solid rgba(171,210,235,.14);
  border-radius:16px;
  background:rgba(8,19,29,.97);
  box-shadow:0 24px 70px rgba(0,0,0,.46);
  perspective:none;
}
.dialog--saves{width:min(960px,calc(100vw - 32px))}
.dialog::before{display:none}
.dialog__header{
  min-height:58px;
  padding:11px 14px 10px 16px;
  border:0;
  border-bottom:1px solid rgba(255,255,255,.07);
  border-radius:0;
  background:rgba(255,255,255,.018);
  backdrop-filter:none;
  box-shadow:none;
  transform:none;
}
.dialog__header::before{display:none}
.dialog--challenge .dialog__header{background:rgba(197,147,28,.045);border-bottom-color:rgba(235,190,67,.11)}
.dialog__header p{margin:0 0 2px;font-size:calc(7px * var(--clu-text-scale,1));letter-spacing:.12em;color:rgba(116,220,229,.72)}
.dialog--challenge .dialog__header p{color:rgba(238,199,91,.78)}
.dialog__header h2{font-size:calc(18px * var(--clu-text-scale,1));line-height:1.1;letter-spacing:-.02em;font-weight:780}
.dialog__header button{
  width:34px;height:34px;
  border-radius:9px;
  background:rgba(255,255,255,.025);
  box-shadow:none;
  transform:none!important;
}
.dialog__body,
.dialog--challenge .dialog__body{
  padding:14px;
  border:0;
  border-radius:0;
  background:transparent;
  backdrop-filter:none;
  box-shadow:none;
}
.dialog__body::after{display:none}

/* Sauvegardes : bibliothèque fonctionnelle, sans gros hero */
.saves-panel{gap:9px;perspective:none}
.saves-hero{
  min-height:0;
  padding:8px 10px;
  border:0;
  border-radius:10px;
  background:rgba(255,255,255,.018);
  backdrop-filter:none;
  box-shadow:none;
  transform:none;
}
.saves-hero p,.saves-hero>div>span{display:none}
.saves-hero h3{font-size:calc(14px * var(--clu-text-scale,1));line-height:1.15;letter-spacing:-.015em}
.saves-import{min-height:34px;padding:0 10px;border-radius:8px;background:rgba(69,194,205,.075);box-shadow:none;font-size:calc(8.5px * var(--clu-text-scale,1))}
.saves-import span{font-size:15px}
.saves-controls{grid-template-columns:minmax(250px,.72fr) minmax(240px,1fr);gap:8px}
.save-folders button,.save-search{min-height:40px;border-radius:9px;background:rgba(4,13,20,.54);backdrop-filter:none}
.save-folder-icon{width:26px;height:26px;border-radius:7px}
.save-folders strong{font-size:calc(8.5px * var(--clu-text-scale,1))}
.save-folders small{font-size:calc(7.2px * var(--clu-text-scale,1))}
.save-search{height:40px}
.save-folder-note{padding:6px 8px;border-radius:8px;font-size:calc(7.8px * var(--clu-text-scale,1))}
.save-list{gap:6px;perspective:none}
.save-card{
  min-height:72px;
  grid-template-columns:46px minmax(0,1fr) auto;
  gap:10px;
  padding:8px 9px;
  border-radius:10px;
  background:rgba(255,255,255,.018);
  backdrop-filter:none;
  box-shadow:none;
  transform:none;
}
.save-card:hover{transform:none;border-color:rgba(83,210,222,.18);background:rgba(58,178,190,.04)}
.save-card__side{min-height:52px;border-radius:8px;background:rgba(58,177,190,.065)}
.save-card__side>span{font-size:15px}.save-card__side small{font-size:calc(7px * var(--clu-text-scale,1))}
.save-card__title-row strong{font-size:calc(11.5px * var(--clu-text-scale,1));letter-spacing:-.01em}
.save-card__chips span{font-size:calc(6.8px * var(--clu-text-scale,1));padding:2px 5px}
.save-card__meta span{font-size:calc(7.3px * var(--clu-text-scale,1))}
.save-card__actions{grid-template-columns:112px auto;gap:5px}
.save-card__load{min-height:34px!important;border-radius:8px!important;padding:0 9px!important;font-size:calc(8.5px * var(--clu-text-scale,1))}
.save-card__secondary-actions{grid-template-columns:repeat(4,30px);gap:3px}
.save-card__secondary-actions button{width:30px;height:30px;border-radius:7px!important}
.saves-empty{min-height:170px;padding:20px;border-radius:11px;background:rgba(255,255,255,.01)}
.saves-empty>span{font-size:22px}.saves-empty strong{font-size:calc(12px * var(--clu-text-scale,1))}

/* Sélecteur de langue : sobre, comme un contrôle système du jeu */
.locale-picker__trigger{width:42px;height:42px;border-radius:11px;background:rgba(7,20,31,.78);backdrop-filter:blur(8px);box-shadow:none}
.locale-picker__trigger :deep(.country-flag){width:24px;height:16px}
.locale-picker__menu{top:48px;width:176px;padding:5px;border-radius:11px;background:rgba(7,17,25,.98);backdrop-filter:blur(10px);box-shadow:0 16px 40px rgba(0,0,0,.38)}
.locale-picker__menu button{min-height:34px;border-radius:7px;font-size:10px}

@media(max-width:820px){
  .overlay{padding:8px}
  .dialog,.dialog--settings,.dialog--challenge,.dialog--saves{width:100%;max-height:calc(100dvh - 16px);border-radius:13px}
  .dialog__header{min-height:52px;padding:9px 11px 9px 13px}
  .dialog__body{padding:10px}
  .saves-controls{grid-template-columns:1fr}
  .save-card{grid-template-columns:40px minmax(0,1fr)}
  .save-card__actions{grid-column:1/-1;grid-template-columns:minmax(120px,1fr) auto}
}

</style>
<style scoped>
.account-entry{min-height:50px;display:inline-flex;align-items:center;gap:9px;padding:0 15px;border:1px solid rgba(93,224,235,.28);border-radius:17px;background:linear-gradient(180deg,rgba(11,39,50,.80),rgba(6,21,30,.70));color:#effcff;cursor:pointer;backdrop-filter:blur(16px) saturate(1.15);box-shadow:0 16px 40px rgba(0,0,0,.17),inset 0 1px 0 rgba(255,255,255,.07)}.account-entry>span{width:23px;height:23px;border-radius:999px;display:grid;place-items:center;background:rgba(47,220,245,.12);color:#71ecfb;font-size:13px}.account-entry strong{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 12px/1 inherit}.dialog--account{width:min(720px,calc(100vw - 36px))}@media(max-width:820px){.account-entry{min-height:38px;padding:0 9px;border-radius:12px}.account-entry>span{display:none}.account-entry strong{max-width:100px;font-size:10px}.dialog--account{width:min(100%,calc(100vw - 24px))}}@media(max-width:560px){.account-entry{padding:0 8px}.account-entry strong{max-width:82px;font-size:9px}}
</style>
