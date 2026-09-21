<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  getGameSaveCompatibility,
  useMetropoleGame,
} from '../../composables/useMetropoleGame'
import { useGameAudio } from '../../composables/useGameAudio'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameLegal } from '../../composables/useGameLegal'
import { useGameDialog } from '../../composables/useGameDialog'
import { MAX_REGULAR_GAME_SAVES, MAX_CHALLENGE_GAME_SAVES } from '../../storage'
import { gameCalendarHeaderLabel } from '../../config/calendar'
import { GAME_SAVE_VERSION } from '../../config/game'
import { getLineAllStations } from '../../engine/network/geometry'
import { getGameTerritoryCatalogEntry } from '../../config/territories'
import type { GameSave } from '../../types/game'
import GameSettingsPanel from '../settings/GameSettingsPanel.vue'
import DailyChallengePanel from '../challenges/DailyChallengePanel.vue'
import OnlineChallengePanel from '../challenges/OnlineChallengePanel.vue'

type HomePanel = null | 'CHALLENGE' | 'ONLINE' | 'SAVES' | 'SETTINGS'

const game = useMetropoleGame()
const audio = useGameAudio()
const i18n = useGameI18n()
const dialogs = useGameDialog()
const legal = useGameLegal()
const activePanel = ref<HomePanel>(null)
const importInput = ref<HTMLInputElement | null>(null)
const saveActionMessage = ref<string | null>(null)
const saveActionError = ref<string | null>(null)
const renameSaveId = ref<string | null>(null)
const renameDraft = ref('')
const dialogRef = ref<HTMLElement | null>(null)
const saveFolder = ref<'REGULAR' | 'CHALLENGE'>('REGULAR')
let panelReturnFocus: HTMLElement | null = null

const compatibleSaves = computed(() => game.saves.value.filter(save => {
  const compatibility = getGameSaveCompatibility(save)
  return (compatibility === 'CURRENT' || compatibility === 'OLDER') && !save.data?.challenge?.readOnly
}))
const canContinue = computed(() => compatibleSaves.value.length > 0)
const latestSave = computed(() => compatibleSaves.value[0] ?? null)
const displayedSaves = computed(() => saveFolder.value === 'REGULAR' ? game.regularSaves.value : game.challengeSaves.value)
const regularSaveLimitReached = computed(() => game.regularSaves.value.length >= MAX_REGULAR_GAME_SAVES)
const challengeSaveLimitReached = computed(() => game.challengeSaves.value.length >= MAX_CHALLENGE_GAME_SAVES)

onMounted(() => {
  audio.setScene('HOME')
  void game.refreshSaves()
})

function openPanel(panel: Exclude<HomePanel, null>) {
  audio.playUi('CLICK')
  panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activePanel.value = panel
}

function closePanel() {
  audio.playUi('CLICK')
  activePanel.value = null
  renameSaveId.value = null
  saveActionMessage.value = null
  saveActionError.value = null
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
  saveActionError.value = null
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
  if (!confirmed) return
  saveActionError.value = null
  await game.removeSave(save.id)
  audio.playUi('CONFIRM')
  saveActionMessage.value = `« ${save.name} » ${i18n.t('a été supprimée.')}`
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
}

async function duplicateSave(save: GameSave) {
  saveActionMessage.value = null
  saveActionError.value = null
  try {
    const copy = await game.duplicateSave(save.id)
    audio.playUi('CONFIRM')
    saveActionMessage.value = `Copie créée : « ${copy.name} ».`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible de dupliquer la sauvegarde.'
  }
}

async function exportSave(save: GameSave) {
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
}

function chooseImportFile() {
  audio.playUi('CLICK')
  importInput.value?.click()
}

async function importSaveFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  saveActionMessage.value = null
  saveActionError.value = null

  if (file.size > 32 * 1024 * 1024) {
    audio.playUi('ERROR')
    saveActionError.value = 'Ce fichier dépasse 32 Mo et ne peut pas être importé.'
    return
  }

  try {
    const imported = await game.importSave(await file.text())
    audio.playUi('CONFIRM')
    saveActionMessage.value = `Partie importée : « ${imported.name} ».`
  }
  catch (error) {
    audio.playUi('ERROR')
    saveActionError.value = error instanceof Error ? error.message : 'Impossible d’importer cette sauvegarde.'
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
  return lines.reduce((total, line) => total + getLineAllStations(line).length, 0)
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
    const prefix = challenge.definition.kind === 'DAILY' ? 'Défi du jour' : 'Défi entre amis'
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
  <main class="home">
    <div class="home__background" />
    <div class="home__shade" />
    <div class="network-motion" aria-hidden="true">
      <i class="route route--a" /><i class="route route--b" /><i class="route route--c" /><i class="route route--d" /><i class="route route--e" />
      <b class="pulse pulse--1" /><b class="pulse pulse--2" /><b class="pulse pulse--3" /><b class="pulse pulse--4" /><b class="pulse pulse--5" /><b class="pulse pulse--6" />
      <span class="moving-unit moving-unit--1" /><span class="moving-unit moving-unit--2" /><span class="moving-unit moving-unit--3" /><span class="moving-unit moving-unit--4" />
    </div>

    <header class="home-topbar">
      <div class="home-logo"><b>CLU</b><span>Métropole</span></div>
      <div class="home-meta home-meta--actions">
        <button type="button" @click="legal.show('LEGAL')">{{ i18n.t('Informations juridiques') }}</button>
        <button type="button" @click="legal.show('COOKIES')">{{ i18n.t('Cookies') }}</button>
        <button type="button" @click="legal.show('CREDITS')">{{ i18n.t('Licences & crédits') }}</button>
      </div>
    </header>

    <section class="home-shell">
      <div class="hero">
        <p class="hero-kicker">{{ i18n.t('Votre réseau. Vos décisions.') }}</p>
        <h1>{{ i18n.t('Faites bouger') }}<br><em>{{ i18n.t('la métropole.') }}</em></h1>
        <p class="hero-copy">{{ i18n.t('Construisez, financez et exploitez un réseau de transport vivant. Chaque ligne transforme le territoire.') }}</p>

        <article v-if="latestSave" class="continue-card">
          <div class="continue-card__head">
            <span>{{ i18n.t('Dernière partie') }}</span>
            <small>{{ formatSaveDate(latestSave.updatedAt) }}</small>
          </div>
          <div class="continue-card__main">
            <div>
              <strong data-i18n-skip>{{ latestSave.name }}</strong>
              <span>{{ saveTerritoryLabel(latestSave) }} · {{ saveGameDate(latestSave) }}</span>
              <small>{{ saveSummary(latestSave) }}</small>
            </div>
            <button type="button" @click="continueGame"><span>{{ i18n.t('Continuer') }}</span><b>→</b></button>
          </div>
        </article>
        <article v-else class="continue-card continue-card--empty">
          <div><span>{{ i18n.t('Première partie') }}</span><strong>{{ i18n.t('Votre métropole commence ici.') }}</strong><small>{{ i18n.t('Choisissez un territoire, vos règles et lancez votre premier réseau.') }}</small></div>
          <button type="button" @click="startNewGame"><span>{{ i18n.t('Commencer') }}</span><b>→</b></button>
        </article>
      </div>

      <nav class="premium-menu" aria-label="Menu principal">
        <button class="premium-action premium-action--primary" type="button" @click="startNewGame">
          <span class="action-icon">＋</span><span><strong>{{ i18n.t('Nouvelle partie') }}</strong><small>{{ i18n.t('Carte réelle ou métropole fictive') }}</small></span><b>→</b>
        </button>
        <button class="premium-action premium-action--challenge" type="button" @click="openPanel('CHALLENGE')">
          <span class="action-icon">◆</span><span><strong>{{ i18n.t('Défi du jour') }}</strong><small>{{ i18n.t('Une épreuve officielle, nouvelle chaque jour') }}</small></span><b>→</b>
        </button>
        <button class="premium-action premium-action--online" type="button" @click="openPanel('ONLINE')">
          <span class="action-icon">VS</span><span><strong>{{ i18n.t('En ligne') }}</strong><small>{{ i18n.t('Défier un ami par code · coop live plus tard') }}</small></span><b>→</b>
        </button>
        <button class="premium-action" type="button" @click="openPanel('SAVES')">
          <span class="action-icon">▤</span><span><strong>{{ i18n.t('Sauvegardes') }}</strong><small>{{ game.regularSaves.value.length }}/{{ MAX_REGULAR_GAME_SAVES }} · {{ game.challengeSaves.value.length }}/{{ MAX_CHALLENGE_GAME_SAVES }}</small></span><b>→</b>
        </button>
        <button class="premium-action" type="button" @click="openPanel('SETTINGS')">
          <span class="action-icon">⚙</span><span><strong>{{ i18n.t('Paramètres') }}</strong><small>{{ i18n.t('Audio, graphismes et confort') }}</small></span><b>→</b>
        </button>
        <NuxtLink class="premium-action premium-action--link" to="/" @click="audio.playUi('CLICK')">
          <span class="action-icon">CLU</span><span><strong>{{ i18n.t('Retour à CLU') }}</strong><small>{{ i18n.t('Quitter Métropole') }}</small></span><b>↗</b>
        </NuxtLink>
      </nav>
    </section>

    <p v-if="game.storageError.value" class="storage-error" role="alert">{{ game.storageError.value }}</p>

    <footer class="home-footer">
      <span>CLU Métropole</span><i /> <span>{{ i18n.t('Sauvegardes locales') }}</span><i /> <span>{{ i18n.t('Soundtrack original hors ligne') }}</span>
    </footer>

    <div v-if="activePanel" class="overlay" @click.self="closePanel" @keydown.esc.stop.prevent="closePanel" @keydown.tab="trapDialogFocus">
      <section ref="dialogRef" class="dialog" role="dialog" aria-modal="true" aria-labelledby="home-dialog-title" tabindex="-1" :class="{ 'dialog--settings': activePanel === 'SETTINGS', 'dialog--saves': activePanel === 'SAVES', 'dialog--challenge': activePanel === 'CHALLENGE' || activePanel === 'ONLINE' }">
        <header class="dialog__header">
          <div><p>CLU Métropole</p><h2 id="home-dialog-title">{{ activePanel === 'CHALLENGE' ? 'Défi du jour' : activePanel === 'ONLINE' ? 'En ligne' : activePanel === 'SAVES' ? 'Sauvegardes' : 'Paramètres' }}</h2></div>
          <button type="button" aria-label="Fermer" @click="closePanel">×</button>
        </header>

        <div class="dialog__body">
          <template v-if="activePanel === 'CHALLENGE'">
            <DailyChallengePanel />
          </template>

          <template v-else-if="activePanel === 'ONLINE'">
            <OnlineChallengePanel />
          </template>

          <template v-else-if="activePanel === 'SAVES'">
            <div class="saves-toolbar">
              <div><strong>Sauvegardes locales</strong><span>10 parties normales + 10 Défis maximum. Les Défis expirent automatiquement après 30 jours.</span></div>
              <button type="button" @click="chooseImportFile">Importer une partie</button>
              <input ref="importInput" class="save-import-input" type="file" accept=".clumetro,application/json,.json" @change="importSaveFile">
            </div>
            <div class="save-folders" role="tablist" aria-label="Dossiers de sauvegardes">
              <button type="button" role="tab" :aria-selected="saveFolder === 'REGULAR'" :class="{ active: saveFolder === 'REGULAR' }" @click="saveFolder = 'REGULAR'">
                <strong>Parties</strong><small>{{ game.regularSaves.value.length }}/{{ MAX_REGULAR_GAME_SAVES }}</small>
              </button>
              <button type="button" role="tab" :aria-selected="saveFolder === 'CHALLENGE'" :class="{ active: saveFolder === 'CHALLENGE' }" @click="saveFolder = 'CHALLENGE'">
                <strong>Défis</strong><small>{{ game.challengeSaves.value.length }}/{{ MAX_CHALLENGE_GAME_SAVES }} · 30 jours</small>
              </button>
            </div>
            <p v-if="saveFolder === 'CHALLENGE'" class="save-folder-note">Les défis sont séparés des parties normales et sont supprimés automatiquement après 30 jours.</p>
            <p v-if="saveFolder === 'REGULAR' && regularSaveLimitReached" class="save-message save-message--warning">Limite atteinte : supprimez une partie pour pouvoir en créer, importer ou dupliquer une autre.</p>
            <p v-if="saveFolder === 'CHALLENGE' && challengeSaveLimitReached" class="save-message save-message--warning">Limite atteinte : supprimez un Défi pour pouvoir en créer ou importer un autre.</p>
            <p v-if="saveActionMessage" class="save-message save-message--ok" role="status" aria-live="polite">{{ saveActionMessage }}</p>
            <p v-if="saveActionError" class="save-message save-message--error" role="alert">{{ saveActionError }}</p>
            <div v-if="displayedSaves.length === 0" class="saves-empty"><strong>Aucune sauvegarde</strong><p>{{ saveFolder === 'REGULAR' ? 'Vos futures parties apparaîtront ici.' : 'Vos futurs Défis sauvegardés apparaîtront ici.' }}</p></div>
            <div v-else class="save-list">
              <article v-for="save in displayedSaves" :key="save.id" class="save-card">
                <div class="save-card__content">
                  <template v-if="renameSaveId !== save.id">
                    <div class="save-card__title-row"><strong data-i18n-skip>{{ save.name }}</strong><em :class="{ warning: !canLoadSave(save) }">{{ compatibilityLabel(save) }}</em></div>
                    <span>{{ saveModeLabel(save) }} · {{ saveTerritoryLabel(save) }}</span>
                    <span>{{ saveGameDate(save) }}</span>
                    <span>{{ saveSummary(save) }}</span>
                    <span>Modifiée {{ formatSaveDate(save.updatedAt) }}<template v-if="saveExpiryLabel(save)"> · {{ saveExpiryLabel(save) }}</template></span>
                  </template>
                  <div v-else class="save-rename">
                    <label :for="`rename-${save.id}`">Nouveau nom</label>
                    <input :id="`rename-${save.id}`" v-model="renameDraft" maxlength="80" autofocus @keyup.enter="confirmRename(save)" @keyup.esc="cancelRename">
                    <div><button type="button" @click="cancelRename">Annuler</button><button type="button" @click="confirmRename(save)">Enregistrer</button></div>
                  </div>
                </div>
                <div v-if="renameSaveId !== save.id" class="save-card__actions">
                  <button class="save-card__load" type="button" :disabled="!canLoadSave(save)" @click="loadSave(save.id)">Charger</button>
                  <button type="button" @click="exportSave(save)">Exporter</button>
                  <button type="button" :disabled="!canLoadSave(save)" @click="duplicateSave(save)">Dupliquer</button>
                  <button type="button" @click="startRename(save)">Renommer</button>
                  <button class="save-card__delete" type="button" @click="removeSave(save)">Supprimer</button>
                </div>
              </article>
            </div>
          </template>

          <template v-else><GameSettingsPanel /></template>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.home{position:relative;min-height:100vh;overflow:hidden;background:#061017;color:#f4fafb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.home__background{position:absolute;inset:-28px;background:radial-gradient(circle at 76% 24%,rgba(82,210,219,.16),transparent 22%),radial-gradient(circle at 64% 72%,rgba(224,82,91,.10),transparent 26%),radial-gradient(circle at 88% 88%,rgba(245,188,72,.055),transparent 22%),repeating-linear-gradient(24deg,transparent 0 92px,rgba(255,255,255,.018) 93px 94px),linear-gradient(135deg,#07151c,#081017 42%,#050b10);filter:saturate(.94) brightness(.93);transform:scale(1.025)}.home__shade{position:absolute;inset:0;background:radial-gradient(circle at 72% 44%,rgba(42,166,180,.13),transparent 28%),linear-gradient(90deg,rgba(4,10,15,.97) 0%,rgba(4,10,15,.9) 34%,rgba(4,10,15,.55) 68%,rgba(4,10,15,.35) 100%),linear-gradient(0deg,rgba(4,10,15,.7),transparent 46%)}.network-motion{position:absolute;inset:0;overflow:hidden;opacity:.88;pointer-events:none}.route{position:absolute;height:2px;width:58vw;border-radius:99px;background:linear-gradient(90deg,transparent,rgba(81,211,219,.08),rgba(115,233,238,.6),rgba(81,211,219,.08),transparent);box-shadow:0 0 18px rgba(75,208,217,.15);transform-origin:left center}.route--a{left:42%;top:24%;transform:rotate(18deg);animation:routePulse 8s ease-in-out infinite}.route--b{left:49%;top:61%;transform:rotate(-11deg);animation:routePulse 10s ease-in-out -3s infinite}.route--c{left:61%;top:6%;height:1px;transform:rotate(72deg);animation:routePulse 12s ease-in-out -6s infinite}.route--d{left:53%;top:42%;width:42vw;transform:rotate(-31deg);background:linear-gradient(90deg,transparent,rgba(245,188,72,.09),rgba(245,188,72,.52),rgba(245,188,72,.08),transparent);animation:routePulse 9s ease-in-out -2s infinite}.route--e{left:69%;top:17%;width:38vw;transform:rotate(103deg);background:linear-gradient(90deg,transparent,rgba(220,80,92,.08),rgba(220,80,92,.46),rgba(220,80,92,.08),transparent);animation:routePulse 11s ease-in-out -5s infinite}.pulse{position:absolute;width:8px;height:8px;border:2px solid rgba(255,255,255,.9);border-radius:50%;background:#50d5dd;box-shadow:0 0 0 5px rgba(80,213,221,.12),0 0 22px rgba(80,213,221,.45);animation:nodePulse 2.8s ease-in-out infinite}.pulse--1{left:66%;top:29%}.pulse--2{left:79%;top:47%;animation-delay:-.8s}.pulse--3{left:58%;top:64%;animation-delay:-1.7s}.pulse--4{left:87%;top:73%;animation-delay:-2.2s}.pulse--5{left:73%;top:39%;animation-delay:-1.1s;background:#efbd59}.pulse--6{left:90%;top:29%;animation-delay:-2.5s;background:#de6471}.moving-unit{position:absolute;z-index:2;width:13px;height:5px;border-radius:99px;background:#edfafa;box-shadow:0 0 12px rgba(180,244,248,.65);opacity:.8}.moving-unit--1{animation:vehicleOne 10s linear infinite}.moving-unit--2{animation:vehicleTwo 13s linear -6s infinite;background:#f5cc72}.moving-unit--3{animation:vehicleThree 12s linear -3s infinite;background:#ee8a94}.moving-unit--4{animation:vehicleFour 15s linear -9s infinite}@keyframes vehicleOne{0%{left:49%;top:58%;transform:rotate(-11deg)}100%{left:96%;top:49%;transform:rotate(-11deg)}}@keyframes vehicleTwo{0%{left:55%;top:41%;transform:rotate(-31deg)}100%{left:90%;top:20%;transform:rotate(-31deg)}}@keyframes vehicleThree{0%{left:75%;top:16%;transform:rotate(103deg)}100%{left:70%;top:82%;transform:rotate(103deg)}}@keyframes vehicleFour{0%{left:43%;top:24%;transform:rotate(18deg)}100%{left:95%;top:43%;transform:rotate(18deg)}}@keyframes routePulse{0%,100%{opacity:.35;filter:brightness(.75)}50%{opacity:1;filter:brightness(1.2)}}@keyframes nodePulse{0%,100%{transform:scale(.84);opacity:.55}50%{transform:scale(1.16);opacity:1}}.home-topbar{position:absolute;z-index:4;left:34px;right:34px;top:27px;display:flex;align-items:center;justify-content:space-between}.home-logo{display:flex;align-items:center;gap:10px}.home-logo b{font-size:18px;letter-spacing:.12em}.home-logo span{font-size:11px;font-weight:750;opacity:.58}.home-meta{display:flex;align-items:center;gap:8px;font-size:9px;text-transform:uppercase;letter-spacing:.12em;opacity:.62}.home-meta i,.home-footer i{width:3px;height:3px;border-radius:50%;background:#67dce3}.home-meta strong{color:#8ce9ee}.home-shell{position:relative;z-index:3;min-height:100vh;width:min(1420px,calc(100% - 70px));margin:0 auto;display:grid;grid-template-columns:minmax(420px,1.22fr) minmax(330px,.72fr);gap:clamp(45px,8vw,130px);align-items:center;padding:92px 0 76px}.hero{align-self:center;max-width:720px}.hero-kicker{margin:0 0 12px;color:#7ce1e7;font-size:10px;text-transform:uppercase;letter-spacing:.18em;font-weight:850}.hero h1{margin:0;font-size:clamp(56px,7.2vw,106px);line-height:.82;letter-spacing:-.065em;font-weight:780;text-shadow:0 12px 60px rgba(0,0,0,.38)}.hero h1 em{font-style:normal;color:rgba(202,246,248,.25);-webkit-text-stroke:0;text-shadow:0 0 0 rgba(202,246,248,.78),0 0 34px rgba(79,211,220,.12);letter-spacing:-.055em}.hero-copy{max-width:580px;margin:24px 0 28px;font-size:14px;line-height:1.7;color:rgba(235,248,249,.72)}.continue-card{width:min(670px,100%);padding:14px 15px 14px 17px;border:1px solid rgba(116,226,232,.26);border-radius:16px;background:linear-gradient(120deg,rgba(21,46,54,.84),rgba(8,18,24,.74));backdrop-filter:blur(20px);box-shadow:0 22px 60px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)}.continue-card__head{display:flex;justify-content:space-between;gap:10px;margin-bottom:9px}.continue-card__head span{font-size:8px;text-transform:uppercase;letter-spacing:.14em;color:#78dce3;font-weight:850}.continue-card__head small{font-size:8px;opacity:.35}.continue-card__main{display:flex;align-items:center;justify-content:space-between;gap:18px}.continue-card__main>div,.continue-card--empty>div{display:grid;gap:3px;min-width:0}.continue-card strong{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.continue-card span{font-size:10px;opacity:.66}.continue-card small{font-size:9px;opacity:.44}.continue-card button{flex:none;min-width:132px;border:1px solid rgba(99,220,228,.42);border-radius:11px;background:linear-gradient(135deg,rgba(61,191,202,.22),rgba(47,145,158,.14));color:#eefdff;padding:11px 12px;display:flex;justify-content:space-between;gap:16px;cursor:pointer;font-weight:800}.continue-card button:hover{background:linear-gradient(135deg,rgba(73,218,228,.31),rgba(47,145,158,.2));transform:translateY(-1px)}.continue-card--empty{display:flex;justify-content:space-between;align-items:center;gap:18px}.premium-menu{display:grid;gap:8px;width:100%;max-width:430px;justify-self:end}.premium-action{position:relative;min-height:71px;width:100%;display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:linear-gradient(100deg,rgba(15,28,36,.90),rgba(11,20,27,.70));backdrop-filter:blur(18px);padding:10px 13px;color:inherit;text-decoration:none;text-align:left;cursor:pointer;box-shadow:0 9px 34px rgba(0,0,0,.14);transition:transform .15s ease,border-color .15s ease,background .15s ease}.premium-action:hover{transform:translateX(-5px);border-color:rgba(114,224,231,.34);background:linear-gradient(100deg,rgba(20,39,47,.92),rgba(11,23,30,.76))}.premium-action--primary{min-height:83px;border-color:rgba(91,216,224,.34);background:linear-gradient(105deg,rgba(40,141,153,.29),rgba(11,25,32,.7))}.premium-action--challenge{border-color:rgba(244,196,67,.34);background:linear-gradient(105deg,rgba(124,91,16,.3),rgba(27,23,13,.69));box-shadow:0 9px 34px rgba(0,0,0,.14),inset 0 0 32px rgba(255,202,62,.035);animation:challengeGlow 3.8s ease-in-out infinite}.premium-action--challenge .action-icon,.premium-action--challenge>b{color:#ffd35d}.premium-action--online{border-color:rgba(225,69,78,.3);background:linear-gradient(105deg,rgba(111,27,34,.26),rgba(25,15,20,.69))}.premium-action--online .action-icon,.premium-action--online>b{color:#ff7f87}@keyframes challengeGlow{0%,100%{box-shadow:0 9px 34px rgba(0,0,0,.14),inset 0 0 26px rgba(255,202,62,.025)}50%{box-shadow:0 9px 40px rgba(0,0,0,.18),0 0 24px rgba(255,203,66,.07),inset 0 0 36px rgba(255,202,62,.055)}}.action-icon{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.10);font-weight:900;color:#83e4ea;font-size:14px}.premium-action>span:nth-child(2){display:grid;gap:3px}.premium-action strong{font-size:13px}.premium-action small{font-size:9px;opacity:.43;line-height:1.3}.premium-action>b{font-size:16px;color:#7bdfe5}.premium-action em{font-style:normal;font-size:8px;text-transform:uppercase;letter-spacing:.1em;padding:5px 7px;border-radius:99px;background:rgba(255,194,82,.08);color:#e4c77e;border:1px solid rgba(255,194,82,.16)}.premium-action--link{opacity:.72}.home-footer{position:absolute;z-index:4;left:34px;bottom:24px;display:flex;align-items:center;gap:9px;font-size:8px;text-transform:uppercase;letter-spacing:.11em;opacity:.35}.storage-error{position:absolute;z-index:12;left:50%;bottom:30px;transform:translateX(-50%);margin:0;max-width:620px;padding:9px 12px;border:1px solid rgba(255,104,104,.25);border-radius:9px;background:rgba(90,22,22,.72);font-size:10px;color:#ffc1c1}.overlay{position:fixed;z-index:30;inset:0;display:grid;place-items:center;padding:30px;background:rgba(2,7,11,.72);backdrop-filter:blur(13px)}.dialog{width:min(620px,calc(100vw - 34px));max-height:min(760px,calc(100vh - 50px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:rgba(8,17,23,.96);box-shadow:0 35px 100px rgba(0,0,0,.55)}.dialog--settings{width:min(820px,calc(100vw - 34px))}.dialog--challenge{width:min(900px,calc(100vw - 34px))}.dialog--saves{width:min(930px,calc(100vw - 34px))}.dialog__header{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.07)}.dialog__header p{margin:0 0 2px;font-size:8px;text-transform:uppercase;letter-spacing:.14em;color:#72dce3}.dialog__header h2{margin:0;font-size:20px}.dialog__header button{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}.dialog__body{min-height:0;overflow:auto;padding:18px}.future-panel{min-height:230px;display:grid;place-items:center;align-content:center;text-align:center;gap:9px}.future-panel>span{font-size:28px;color:#83e3e9}.future-panel strong{font-size:18px}.future-panel p{max-width:460px;margin:0;font-size:11px;line-height:1.55;opacity:.58}.future-panel em,.online-grid em{font-style:normal;font-size:8px;text-transform:uppercase;letter-spacing:.12em;color:#e7c980}.online-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.online-grid article{min-height:210px;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);display:grid;align-content:start;gap:8px}.online-grid article>span{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(85,211,220,.1);color:#83e3e9;font-size:11px;font-weight:900}.online-grid strong{font-size:15px}.online-grid p{margin:0;font-size:10px;line-height:1.55;opacity:.54}.saves-toolbar{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:13px}.saves-toolbar>div{display:grid;gap:3px}.saves-toolbar strong{font-size:13px}.saves-toolbar span{font-size:9px;opacity:.48}.saves-toolbar button,.save-card__actions button,.save-rename button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:9px}.save-import-input{display:none}.save-message{padding:9px 10px;border-radius:9px;font-size:10px}.save-message--ok{background:rgba(60,177,110,.1);color:#9be5b6}.save-message--error{background:rgba(200,65,65,.1);color:#ffaaaa}.save-message--warning{background:rgba(236,174,66,.1);color:#f4cf83}.save-folders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 10px}.save-folders button{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.03);color:inherit;cursor:pointer}.save-folders button.active{border-color:rgba(81,211,220,.48);background:rgba(81,211,220,.11)}.save-folders strong{font-size:10px}.save-folders small{font-size:9px;opacity:.55}.save-folder-note{margin:0 0 10px;padding:8px 10px;border-radius:9px;background:rgba(244,196,67,.065);font-size:9px;line-height:1.45;opacity:.75}.save-list{display:grid;gap:8px}.save-card{padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025);display:flex;justify-content:space-between;gap:15px;align-items:center}.save-card__content{display:grid;gap:3px;min-width:0}.save-card__content>span{font-size:9px;opacity:.45}.save-card__title-row{display:flex;align-items:center;gap:8px}.save-card__title-row strong{font-size:13px}.save-card__title-row em{font-style:normal;font-size:7px;text-transform:uppercase;letter-spacing:.08em;padding:3px 5px;border-radius:5px;background:rgba(79,210,220,.08);color:#7edce3}.save-card__title-row em.warning{color:#ffadad;background:rgba(210,75,75,.1)}.save-card__actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.save-card__load{border-color:rgba(80,211,220,.32)!important;background:rgba(80,211,220,.1)!important}.save-card__delete{color:#ff9f9f!important}.save-card__actions button:disabled{opacity:.32;cursor:not-allowed}.save-rename{display:grid;gap:7px;min-width:280px}.save-rename label{font-size:9px;opacity:.5}.save-rename input{border:1px solid rgba(255,255,255,.12);background:#0d171d;color:inherit;border-radius:8px;padding:9px}.save-rename>div{display:flex;gap:5px}.saves-empty{text-align:center;padding:30px;opacity:.6}.saves-empty p{font-size:10px}.saves-empty strong{font-size:14px}@media(max-width:900px){.home-shell{grid-template-columns:1fr;width:min(100% - 36px,720px);align-content:center;gap:28px;padding-top:100px}.hero h1{font-size:clamp(52px,13vw,84px)}.premium-menu{max-width:none;justify-self:stretch}.home__shade{background:linear-gradient(0deg,rgba(4,10,15,.97),rgba(4,10,15,.68)),radial-gradient(circle at 60% 15%,rgba(42,166,180,.12),transparent 35%)}.network-motion{opacity:.4}}@media(max-width:620px){.home-topbar{left:18px;right:18px;top:17px}.home-meta span,.home-footer span:nth-of-type(n+2),.home-footer i{display:none}.home-shell{width:calc(100% - 24px);padding:80px 0 54px}.hero-copy{font-size:12px;margin:17px 0}.hero h1{font-size:clamp(48px,16vw,70px)}.continue-card__main,.continue-card--empty{align-items:stretch;flex-direction:column}.continue-card button{width:100%}.premium-action{min-height:62px}.home-footer{left:18px;bottom:14px}.overlay{padding:12px}.online-grid{grid-template-columns:1fr}.saves-toolbar,.save-card{align-items:stretch;flex-direction:column}.save-card__actions{justify-content:stretch}.save-card__actions button{flex:1}.dialog__body{padding:13px}}

.home-meta--actions{opacity:1;text-transform:none;letter-spacing:0;gap:6px;flex-wrap:wrap;justify-content:flex-end}.home-meta--actions button{border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.035);color:rgba(238,248,250,.72);padding:7px 9px;font-size:8px;font-weight:800;cursor:pointer}.home-meta--actions button:hover{border-color:rgba(116,226,232,.28);color:#eefbfc;background:rgba(116,226,232,.07)}.home-meta--actions .home-meta__logout{border-color:rgba(255,92,101,.28);background:rgba(180,47,54,.11);color:#ff9ca4}.home-meta--actions .home-meta__logout:hover{border-color:rgba(255,92,101,.5);background:rgba(180,47,54,.18);color:#ffc2c6}
@media(max-width:900px){.home-meta--actions{max-width:55%}}
@media(max-width:620px){.home-topbar{align-items:flex-start}.home-meta--actions{max-width:62%;gap:4px}.home-meta--actions button{padding:6px 7px;font-size:7px}}




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
.continue-card__head span{color:#91edf2}.continue-card strong{font-size:17px}.continue-card span{opacity:.72}.continue-card small{opacity:.5}
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
.premium-action strong{font-size:13.5px}.premium-action small{opacity:.51}.premium-action>b{font-size:18px}
.premium-action--link{opacity:.82}.premium-action--link:hover{opacity:1}
.home-meta--actions button{background:rgba(255,255,255,.045);border-color:rgba(255,255,255,.10);color:rgba(241,250,251,.78);backdrop-filter:blur(8px)}
.home-meta--actions button:hover{border-color:rgba(116,226,232,.38);background:rgba(116,226,232,.095);box-shadow:0 8px 22px rgba(0,0,0,.12)}
.home-footer{opacity:.46}
@media(max-width:900px){.home__shade{background:linear-gradient(0deg,rgba(4,10,15,.96),rgba(4,10,15,.63)),radial-gradient(circle at 60% 15%,rgba(42,166,180,.16),transparent 35%)}.network-motion{opacity:.48}}
@media(prefers-reduced-motion:reduce){.premium-action:hover{transform:none}.route,.pulse,.moving-unit,.premium-action--challenge{animation:none}}
</style>
