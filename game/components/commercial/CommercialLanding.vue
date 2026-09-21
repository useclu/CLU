<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CLU_COMMERCIAL } from '../../config/commercial'
import { useGameCommercial } from '../../composables/useGameCommercial'
import { useGameLegal } from '../../composables/useGameLegal'
import { useGameSettings } from '../../composables/useGameSettings'
import { GAME_LOCALE_OPTIONS, gameLocaleTag, translateGameText } from '../../config/i18n'

const emit = defineEmits<{ enter: [] }>()
const commercial = useGameCommercial()
const legal = useGameLegal()
const preferences = useGameSettings()

if (typeof document !== 'undefined') document.title = 'CLU Métropole'

const mode = ref<'HOME' | 'LOGIN' | 'REGISTER' | 'RECOVER' | 'BUY'>('HOME')
const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const email = ref('')
const recoveryInput = ref('')
const newPassword = ref('')
const termsAccepted = ref(false)
const privacyRead = ref(false)
const immediateAccess = ref(false)
const legalCapacity = ref(false)
const guestTerms = ref(false)
const localError = ref('')
const localeOpen = ref(false)

const t = (input: string) => translateGameText(input, preferences.settings.value.locale)
const currentLocaleLabel = computed(() => GAME_LOCALE_OPTIONS.find(item => item.id === preferences.settings.value.locale)?.label ?? 'Français')
const priceLabel = computed(() => `${CLU_COMMERCIAL.priceEuro.toFixed(2).replace('.', ',')} €`)
const showGuest = computed(() => commercial.previewActive.value)
const owned = computed(() => commercial.ownsProduct.value)
const accountNeedsPurchase = computed(() => commercial.authenticated.value && !owned.value)
const translatedError = computed(() => t(localError.value || commercial.error.value || ''))
const previewUpcoming = computed(() => {
  if (commercial.developmentFallback.value) return false
  const now = Date.parse(commercial.status.value?.serverNow || '')
  const start = Date.parse(commercial.status.value?.freePreview.startsAt || CLU_COMMERCIAL.preview.startIso)
  return Number.isFinite(now) && Number.isFinite(start) && now < start
})
const previewStartLabel = computed(() => {
  const start = commercial.status.value?.freePreview.startsAt || CLU_COMMERCIAL.preview.startIso
  const date = new Date(start)
  return Number.isNaN(date.getTime())
    ? '21 septembre 2026 à 12h'
    : new Intl.DateTimeFormat(gameLocaleTag(preferences.settings.value.locale), { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(date)
})
const previewEndLabel = computed(() => {
  const end = commercial.status.value?.freePreview.endsAt || CLU_COMMERCIAL.preview.endIso
  const date = new Date(end)
  return Number.isNaN(date.getTime())
    ? '28 septembre 2026 à 12h'
    : new Intl.DateTimeFormat(gameLocaleTag(preferences.settings.value.locale), { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(date)
})

onMounted(async () => {
  try {
    await commercial.refresh()
    const url = new URL(window.location.href)
    const payment = url.searchParams.get('payment')
    if (payment === 'success' && commercial.authenticated.value && !commercial.ownsProduct.value) {
      localError.value = 'Paiement confirmé par Stripe. Synchronisation de votre accès…'
      for (let i = 0; i < 10 && !commercial.ownsProduct.value; i++) {
        await new Promise(resolve => window.setTimeout(resolve, 1000))
        try {
          await commercial.refresh(true)
        }
        catch {
          // retry silently
        }
      }
      localError.value = commercial.ownsProduct.value
        ? ''
        : 'Le paiement est en cours de confirmation. Réessayez dans quelques instants si l’accès n’apparaît pas encore.'
    }
    else if (payment === 'cancel') {
      localError.value = 'Paiement annulé. Aucun accès payant n’a été ajouté.'
    }
    if (payment) {
      url.searchParams.delete('payment')
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }
  catch {
    // handled visually
  }
})

function changeLocale(value: (typeof GAME_LOCALE_OPTIONS)[number]['id']) {
  preferences.update({ locale: value })
  localeOpen.value = false
}

function setMode(next: typeof mode.value) {
  mode.value = next
  localError.value = ''
}

function enterGame() {
  if (!commercial.canPlay.value) return
  emit('enter')
}

function playGuest() {
  localError.value = ''
  if (!guestTerms.value) {
    localError.value = 'Vous devez accepter les CGU et les règles de la semaine découverte avant de continuer.'
    return
  }
  localStorage.setItem('clu_guest_legal_v1', JSON.stringify({
    version: CLU_COMMERCIAL.legal.version,
    acceptedAt: new Date().toISOString(),
  }))
  enterGame()
}

async function doLogin() {
  localError.value = ''
  try {
    await commercial.login(username.value.trim(), password.value)
    password.value = ''
    mode.value = commercial.ownsProduct.value ? 'HOME' : commercial.previewActive.value ? 'HOME' : 'BUY'
  }
  catch (e) {
    localError.value = e instanceof Error ? e.message : 'Connexion impossible.'
  }
}

async function doRegister() {
  localError.value = ''
  if (username.value.trim().length < 2 || username.value.trim().length > 24) {
    localError.value = 'Le pseudo doit contenir entre 2 et 24 caractères.'
    return
  }
  if (!email.value.trim()) {
    localError.value = 'Une adresse email est obligatoire pour créer un compte.'
    return
  }
  if (password.value.length < 8) {
    localError.value = 'Le mot de passe doit contenir au moins 8 caractères.'
    return
  }
  if (password.value !== passwordConfirm.value) {
    localError.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  if (!termsAccepted.value || !privacyRead.value) {
    localError.value = 'Vous devez accepter les CGU et confirmer avoir lu la politique de confidentialité.'
    return
  }
  try {
    await commercial.register({
      username: username.value.trim(),
      password: password.value,
      email: email.value.trim(),
      termsVersion: CLU_COMMERCIAL.legal.version,
      privacyVersion: CLU_COMMERCIAL.legal.version,
    })
    password.value = ''
    passwordConfirm.value = ''
  }
  catch (e) {
    localError.value = e instanceof Error ? e.message : 'Création de compte impossible.'
  }
}

async function doRecover() {
  localError.value = ''
  if (!email.value.trim()) {
    localError.value = 'L’adresse email du compte est obligatoire pour la récupération.'
    return
  }
  if (newPassword.value.length < 8) {
    localError.value = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
    return
  }
  try {
    await commercial.recover({
      username: username.value.trim(),
      email: email.value.trim(),
      recoveryCode: recoveryInput.value.trim(),
      newPassword: newPassword.value,
    })
    recoveryInput.value = ''
    newPassword.value = ''
  }
  catch (e) {
    localError.value = e instanceof Error ? e.message : 'Récupération impossible.'
  }
}

async function doCheckout() {
  localError.value = ''
  if (!commercial.authenticated.value) {
    setMode('LOGIN')
    return
  }
  if (!termsAccepted.value || !immediateAccess.value || !legalCapacity.value) {
    localError.value = 'Confirmez les informations contractuelles avant de passer au paiement.'
    return
  }
  try {
    await commercial.checkout({
      cgvVersion: CLU_COMMERCIAL.legal.version,
      immediateAccess: immediateAccess.value,
      legalCapacity: legalCapacity.value,
    })
  }
  catch (e) {
    localError.value = e instanceof Error ? e.message : 'Paiement indisponible.'
  }
}
</script>

<template>
  <main id="clu-main-content" class="landing">
    <div class="landing__decor" aria-hidden="true">
      <span class="orbit orbit--one" />
      <span class="orbit orbit--two" />
      <span class="orbit orbit--three" />
      <span class="node node--one" />
      <span class="node node--two" />
      <span class="node node--three" />
    </div>

    <div class="landing__shell">
      <section class="hero">
        <div class="hero__mark">CLU</div>
        <h1>CLU Métropole</h1>
        <p>{{ t('Construisez. Faites circuler.') }}</p>

        <div class="hero__status">
          <span class="status-dot" />
          <template v-if="showGuest">
            <strong>{{ t('Semaine gratuite') }}</strong>
            <small>{{ t('jusqu’au') }} {{ previewEndLabel }}</small>
          </template>
          <template v-else-if="previewUpcoming">
            <strong>{{ t('Ouverture prochaine') }}</strong>
            <small>{{ previewStartLabel }}</small>
          </template>
          <template v-else>
            <strong>{{ t('Accès payant') }}</strong>
            <small>{{ t('Connexion Internet requise') }}</small>
          </template>
        </div>
      </section>

      <section class="access-dock">
        <header class="dock-head">
          <div>
            <span>{{ t('Accès CLU') }}</span>
            <h2 v-if="mode === 'HOME' && owned">{{ t('Votre accès est prêt') }}</h2>
            <h2 v-else-if="mode === 'HOME'">CLU Métropole</h2>
            <h2 v-else-if="mode === 'LOGIN'">{{ t('Se connecter') }}</h2>
            <h2 v-else-if="mode === 'REGISTER'">{{ t('Créer un compte') }}</h2>
            <h2 v-else-if="mode === 'RECOVER'">{{ t('Récupérer le compte') }}</h2>
            <h2 v-else>{{ t('Acheter le jeu') }}</h2>
          </div>

          <div class="locale-box">
            <button type="button" class="locale-trigger" :aria-expanded="localeOpen" @click="localeOpen = !localeOpen">
              <span>{{ currentLocaleLabel }}</span><i>▾</i>
            </button>
            <div v-if="localeOpen" class="locale-menu" role="listbox">
              <button
                v-for="item in GAME_LOCALE_OPTIONS"
                :key="item.id"
                type="button"
                class="locale-item"
                :class="{ active: item.id === preferences.settings.value.locale }"
                @click="changeLocale(item.id)"
              >
                <span>{{ item.label }}</span><span v-if="item.id === preferences.settings.value.locale">✓</span>
              </button>
            </div>
          </div>
        </header>

        <template v-if="commercial.loading.value">
          <div class="dock-state"><div class="spinner" /><span>{{ t('Connexion…') }}</span></div>
        </template>

        <template v-else-if="commercial.recoveryCode.value">
          <button type="button" class="back-link" @click="commercial.recoveryCode.value = ''; setMode('HOME')">{{ t('← Retour') }}</button>
          <p class="dock-copy">{{ t('Conservez ce code dans un endroit sûr.') }}</p>
          <code class="recovery-code">{{ commercial.recoveryCode.value }}</code>
          <button type="button" class="action action--primary" @click="navigator.clipboard?.writeText(commercial.recoveryCode.value)">{{ t('Copier le code') }}</button>
          <button type="button" class="action action--quiet" @click="commercial.recoveryCode.value = ''; setMode('HOME')">{{ t('J’ai sauvegardé mon code') }}</button>
        </template>

        <template v-else-if="mode === 'LOGIN'">
          <button type="button" class="back-link" @click="setMode('HOME')">{{ t('← Retour') }}</button>
          <form class="compact-form" @submit.prevent="doLogin">
            <label><span>{{ t('Pseudo') }}</span><input v-model="username" maxlength="24" autocomplete="username" required></label>
            <label><span>{{ t('Mot de passe') }}</span><input v-model="password" type="password" minlength="8" autocomplete="current-password" required></label>
            <button type="submit" class="action action--primary">{{ commercial.authBusy.value ? t('Connexion…') : t('Se connecter') }}</button>
          </form>
          <div class="text-row"><button type="button" @click="setMode('RECOVER')">{{ t('Mot de passe oublié ?') }}</button><button type="button" @click="setMode('REGISTER')">{{ t('Créer un compte') }}</button></div>
        </template>

        <template v-else-if="mode === 'REGISTER'">
          <button type="button" class="back-link" @click="setMode('HOME')">{{ t('← Retour') }}</button>
          <form class="compact-form" @submit.prevent="doRegister">
            <div class="field-pair">
              <label><span>{{ t('Pseudo') }}</span><input v-model="username" maxlength="24" autocomplete="username" required></label>
              <label><span>{{ t('Email') }}</span><input v-model="email" type="email" autocomplete="email" required></label>
            </div>
            <div class="field-pair">
              <label><span>{{ t('Mot de passe') }}</span><input v-model="password" type="password" minlength="8" autocomplete="new-password" required></label>
              <label><span>{{ t('Confirmer') }}</span><input v-model="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required></label>
            </div>
            <div class="checks">
              <label class="check-row"><input v-model="termsAccepted" type="checkbox"><span>{{ t('J’accepte les') }} <button type="button" @click="legal.show('CGU')">{{ t('CGU') }}</button>.</span></label>
              <label class="check-row"><input v-model="privacyRead" type="checkbox"><span>{{ t('J’ai lu la') }} <button type="button" @click="legal.show('PRIVACY')">{{ t('Confidentialité') }}</button>.</span></label>
            </div>
            <button type="submit" class="action action--primary action--small">{{ commercial.authBusy.value ? t('Création…') : t('Créer mon compte') }}</button>
          </form>
        </template>

        <template v-else-if="mode === 'RECOVER'">
          <button type="button" class="back-link" @click="setMode('LOGIN')">{{ t('← Retour') }}</button>
          <form class="compact-form" @submit.prevent="doRecover">
            <div class="field-pair">
              <label><span>{{ t('Pseudo') }}</span><input v-model="username" maxlength="24" required></label>
              <label><span>{{ t('Email du compte') }}</span><input v-model="email" type="email" required></label>
            </div>
            <label><span>{{ t('Code de récupération') }}</span><input v-model="recoveryInput" autocomplete="off" required></label>
            <label><span>{{ t('Nouveau mot de passe') }}</span><input v-model="newPassword" type="password" minlength="8" autocomplete="new-password" required></label>
            <button type="submit" class="action action--primary action--small">{{ t('Récupérer') }}</button>
          </form>
        </template>

        <template v-else-if="mode === 'BUY' || (accountNeedsPurchase && !showGuest)">
          <button v-if="showGuest" type="button" class="back-link" @click="setMode('HOME')">{{ t('← Retour') }}</button>
          <div class="purchase-summary"><span>{{ t('Paiement unique') }}</span><strong>{{ priceLabel }}</strong></div>
          <form class="compact-form" @submit.prevent="doCheckout">
            <div class="checks">
              <label class="check-row"><input v-model="termsAccepted" type="checkbox"><span>{{ t('J’accepte les') }} <button type="button" @click="legal.show('CGV')">{{ t('CGV') }}</button> {{ t('et les') }} <button type="button" @click="legal.show('CGU')">{{ t('CGU') }}</button>.</span></label>
              <label class="check-row"><input v-model="immediateAccess" type="checkbox"><span>{{ t('Je demande l’accès immédiat.') }}</span></label>
              <label class="check-row"><input v-model="legalCapacity" type="checkbox"><span>{{ t('Je confirme pouvoir effectuer cet achat.') }}</span></label>
            </div>
            <button type="submit" class="action action--gold">{{ commercial.checkoutBusy.value ? t('Redirection…') : t('Continuer vers le paiement') }}</button>
          </form>
        </template>

        <template v-else>
          <template v-if="owned">
            <button type="button" class="action action--primary action--hero" @click="enterGame">{{ t('Entrer dans le jeu') }}</button>
          </template>

          <template v-else-if="showGuest">
            <button type="button" class="action action--primary action--hero" @click="playGuest">
              <span>{{ t('Jouer gratuitement') }}</span><small>{{ t('jusqu’au') }} {{ previewEndLabel }}</small>
            </button>
            <label class="check-row check-row--standalone"><input v-model="guestTerms" type="checkbox"><span>{{ t('J’accepte les CGU et les règles.') }}</span></label>

            <button type="button" class="buy-line" @click="setMode('BUY')">
              <span><small>{{ t('Paiement unique') }}</small><strong>{{ t('Acheter le jeu') }}</strong></span>
              <b>{{ priceLabel }}</b>
            </button>
          </template>

          <template v-else-if="previewUpcoming">
            <div class="dock-state dock-state--left"><strong>{{ t('Ouverture prochaine') }}</strong><span>{{ previewStartLabel }}</span></div>
          </template>

          <template v-else>
            <button type="button" class="buy-line buy-line--main" @click="setMode('BUY')">
              <span><small>{{ t('Paiement unique') }}</small><strong>{{ t('Acheter le jeu') }}</strong></span>
              <b>{{ priceLabel }}</b>
            </button>
          </template>

          <div v-if="!owned" class="account-links"><button type="button" @click="setMode('REGISTER')">{{ t('Créer un compte') }}</button><span>·</span><button type="button" @click="setMode('LOGIN')">{{ t('J’ai déjà un compte') }}</button></div>
        </template>

        <div v-if="translatedError" class="error-box">{{ translatedError }}</div>

        <footer class="dock-footer">
          <button type="button" @click="legal.show('CGV')">{{ t('Informations juridiques') }}</button>
          <button type="button" @click="legal.show('COOKIES')">{{ t('Cookies') }}</button>
          <button type="button" @click="legal.show('CREDITS')">{{ t('Licences & crédits') }}</button>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
:root { color-scheme: dark; }

.landing {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: #edf8fa;
  background:
    radial-gradient(circle at 14% 18%, rgba(92, 222, 228, .10), transparent 26%),
    radial-gradient(circle at 82% 72%, rgba(205, 159, 77, .08), transparent 24%),
    linear-gradient(135deg, #061018 0%, #09141b 48%, #071018 100%);
}

.landing::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .055;
  background-image: radial-gradient(rgba(255,255,255,.85) .6px, transparent .8px);
  background-size: 5px 5px;
}

.landing__decor { position: absolute; inset: 0; pointer-events: none; opacity: .55; }
.orbit { position: absolute; height: 2px; border-radius: 999px; filter: drop-shadow(0 0 12px currentColor); }
.orbit--one { width: 52vw; left: -8vw; top: 30%; transform: rotate(11deg); color: #5bdbe3; background: currentColor; }
.orbit--two { width: 42vw; right: -9vw; top: 50%; transform: rotate(-9deg); color: #c59d58; background: currentColor; }
.orbit--three { width: 28vw; left: 34%; bottom: 13%; transform: rotate(28deg); color: #7c6fe2; background: currentColor; }
.node { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #edfdfd; box-shadow: 0 0 0 6px rgba(255,255,255,.07), 0 0 26px rgba(95,225,232,.35); }
.node--one { left: 27%; top: 34%; }
.node--two { right: 22%; top: 48%; }
.node--three { left: 48%; bottom: 19%; }

.landing__shell {
  position: relative;
  z-index: 2;
  width: min(1120px, calc(100% - 36px));
  min-height: 100vh;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: clamp(40px, 8vw, 110px);
  align-items: center;
}

.hero { max-width: 520px; }
.hero__mark {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(105, 226, 232, .18);
  color: #81eaee;
  font-size:calc(11px * var(--clu-text-scale,1));
  font-weight: 900;
  letter-spacing: .18em;
}
.hero h1 {
  margin: 18px 0 12px;
  font-size: clamp(48px, 6.8vw, 82px);
  line-height: .92;
  letter-spacing: -.06em;
  font-weight: 950;
}
.hero p {
  margin: 0;
  color: rgba(237,248,250,.68);
  font-size:calc(18px * var(--clu-text-scale,1));
  letter-spacing: .05em;
}
.hero__status {
  width: max-content;
  max-width: 100%;
  margin-top: 30px;
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 10px;
  align-items: center;
}
.status-dot {
  grid-row: 1 / 3;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #66e2e8;
  box-shadow: 0 0 0 5px rgba(102,226,232,.10);
}
.hero__status strong { font-size:calc(13px * var(--clu-text-scale,1)); }
.hero__status small { color: rgba(235,246,248,.48); font-size:calc(11px * var(--clu-text-scale,1)); }

.access-dock {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-left: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(90deg, rgba(4,10,15,.55), rgba(4,10,15,.18));
}
.dock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}
.dock-head > div:first-child > span {
  color: #7ee8ec;
  font-size:calc(10px * var(--clu-text-scale,1));
  font-weight: 900;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.dock-head h2 {
  margin: 7px 0 0;
  font-size:calc(24px * var(--clu-text-scale,1));
  line-height: 1.05;
  letter-spacing: -.04em;
}

.locale-box { position: relative; flex: 0 0 auto; }
.locale-trigger {
  min-height: 38px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 11px;
  background: rgba(255,255,255,.03);
  color: #edf8fa;
  cursor: pointer;
  font-size:calc(12px * var(--clu-text-scale,1));
}
.locale-trigger i { font-style: normal; opacity: .55; }
.locale-menu {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  z-index: 20;
  width: 176px;
  padding: 7px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 12px;
  background: #071218;
  box-shadow: 0 20px 40px rgba(0,0,0,.32);
}
.locale-item {
  width: 100%;
  height: 36px;
  padding: 0 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgba(237,248,250,.78);
  cursor: pointer;
}
.locale-item:hover, .locale-item.active { background: rgba(103,224,231,.10); color: #fff; }

.action {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.10);
  padding: 0 15px;
  font-size:calc(14px * var(--clu-text-scale,1));
  font-weight: 900;
  cursor: pointer;
  transition: transform .15s ease, filter .15s ease, background .15s ease;
}
.action:hover, .buy-line:hover, .locale-trigger:hover { transform: translateY(-1px); }
.action--primary { background: #68d9e1; color: #041115; border-color: transparent; }
.action--quiet { background: rgba(255,255,255,.035); color: #edf8fa; }
.action--gold { background: #cfa95f; color: #071014; border-color: transparent; }
.action--hero { min-height: 62px; display: grid; place-items: center; gap: 2px; font-size:calc(17px * var(--clu-text-scale,1)); }
.action--hero small { font-size:calc(10px * var(--clu-text-scale,1)); font-weight: 800; color: rgba(4,17,21,.65); }
.action--small { min-height: 43px; }

.buy-line {
  width: 100%;
  min-height: 62px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(207,169,95,.26);
  border-radius: 12px;
  background: rgba(207,169,95,.07);
  color: #f9f3e7;
  text-align: left;
  cursor: pointer;
}
.buy-line span { display: grid; gap: 4px; }
.buy-line small { color: rgba(240,210,151,.58); font-size:calc(9px * var(--clu-text-scale,1)); letter-spacing: .12em; text-transform: uppercase; }
.buy-line strong { font-size:calc(14px * var(--clu-text-scale,1)); }
.buy-line b { color: #edc16c; font-size:calc(24px * var(--clu-text-scale,1)); white-space: nowrap; }
.buy-line--main { min-height: 74px; }
.buy-line--main strong { font-size:calc(16px * var(--clu-text-scale,1)); }
.buy-line--main b { font-size:calc(28px * var(--clu-text-scale,1)); }

.account-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(238,248,250,.40);
  font-size:calc(11px * var(--clu-text-scale,1));
}
.account-links button, .text-row button, .back-link, .check-row button, .dock-footer button {
  border: 0;
  background: none;
  padding: 0;
  color: #7ee8ec;
  cursor: pointer;
  font: inherit;
}
.account-links button { color: rgba(238,248,250,.72); font-weight: 700; }
.back-link { justify-self: start; font-size:calc(12px * var(--clu-text-scale,1)); font-weight: 800; }
.text-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; font-size:calc(11px * var(--clu-text-scale,1)); }

.compact-form { display: grid; gap: 10px; }
.compact-form label:not(.check-row) { display: grid; gap: 5px; }
.compact-form label > span { font-size:calc(10px * var(--clu-text-scale,1)); font-weight: 800; color: rgba(236,247,249,.62); }
.compact-form input {
  width: 100%;
  box-sizing: border-box;
  height: 41px;
  padding: 0 11px;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 10px;
  background: rgba(255,255,255,.025);
  color: #edf8fa;
  outline: none;
}
.compact-form input:focus { border-color: rgba(104,220,227,.36); box-shadow: 0 0 0 3px rgba(104,220,227,.06); }
.field-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.checks { display: grid; gap: 7px; }
.check-row {
  display: flex !important;
  align-items: flex-start;
  gap: 8px;
  color: rgba(235,246,248,.63);
  font-size:calc(10px * var(--clu-text-scale,1));
  line-height: 1.45;
}
.check-row input { width: 14px; height: 14px; flex: 0 0 auto; margin: 1px 0 0; accent-color: #62dbe2; }
.check-row--standalone { margin-top: -4px; }

.purchase-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 14px;
  border: 1px solid rgba(207,169,95,.22);
  border-radius: 12px;
  background: rgba(207,169,95,.06);
}
.purchase-summary span { color: rgba(240,210,151,.62); font-size:calc(10px * var(--clu-text-scale,1)); text-transform: uppercase; letter-spacing: .12em; }
.purchase-summary strong { color: #edc16c; font-size:calc(26px * var(--clu-text-scale,1)); }

.dock-state {
  min-height: 150px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
  color: rgba(237,248,250,.70);
}
.dock-state--left { justify-items: start; text-align: left; }
.spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,.10); border-top-color: #6ce0e6; border-radius: 50%; animation: spin .8s linear infinite; }
.dock-copy { margin: 0; color: rgba(236,247,249,.62); font-size:calc(11px * var(--clu-text-scale,1)); }
.recovery-code { display: block; padding: 13px; border-radius: 11px; background: rgba(0,0,0,.20); color: #82edf0; text-align: center; overflow: auto; border: 1px solid rgba(103,224,231,.12); }
.error-box { padding: 11px 12px; border-radius: 10px; border: 1px solid rgba(224,110,110,.20); background: rgba(224,110,110,.07); color: #ffd8d8; font-size:calc(10px * var(--clu-text-scale,1)); line-height: 1.45; }

.dock-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding-top: 3px;
  color: rgba(236,247,249,.42);
  font-size:calc(9px * var(--clu-text-scale,1));
}
.dock-footer button { color: rgba(236,247,249,.48); }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .landing__shell { grid-template-columns: 1fr; align-items: start; padding: 28px 0; gap: 32px; }
  .hero { max-width: none; }
  .access-dock { border-left: 0; border-top: 1px solid rgba(255,255,255,.08); padding: 20px 0 0; background: transparent; }
}

@media (max-width: 580px) {
  .landing__shell { width: calc(100% - 24px); }
  .hero h1 { font-size:calc(48px * var(--clu-text-scale,1)); }
  .field-pair { grid-template-columns: 1fr; }
  .dock-head { align-items: center; }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
</style>
