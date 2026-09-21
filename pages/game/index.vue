<script setup lang="ts">
import { useHead } from '#app'
import { definePageMeta } from '#imports'
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'

definePageMeta({
  layout: 'default-fixed-size',
})

useHead({
  title: 'CLU Métropole',
})

/*
 * Ouverture publique :
 * 21 septembre 2026 à 12:00 en France métropolitaine (Europe/Paris).
 * À cette date Paris est encore en heure d'été, soit UTC+02:00.
 */
const LAUNCH_AT = Date.parse('2026-09-21T12:00:00+02:00')
const now = ref(Date.now())
const earlyAccessCode = ref('')
const earlyAccessError = ref(false)
const earlyAccessBusy = ref(false)
const hasEarlyAccess = ref(false)
const { locale } = useI18n()

const EARLY_ACCESS_SESSION_KEY = 'clu-metropole-early-access'
const EARLY_ACCESS_HASH = '2573172e897d5e0b51b01a6e48c3bb0944d03615b0bad1c85449140d051d3b47'

const GameRoot = defineAsyncComponent(
  () => import('~/game/components/GameRoot.vue'),
)

const isEnglish = computed(() =>
  String(locale.value).toLowerCase().startsWith('en'),
)

const copy = computed(() => isEnglish.value
  ? {
      eyebrow: 'CLU Métropole',
      title: 'The network opens soon.',
      launch: 'The game launches at 12:00 (France time) on 21 September 2026.',
      automatic: 'Access will unlock automatically at launch.',
      preparing: 'Preparing the network',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      earlyAccess: 'Early access',
      earlyAccessHint: 'Have a private access code?',
      codePlaceholder: 'Access code',
      unlock: 'Enter',
      invalidCode: 'Invalid access code.',
      returnEditor: 'Back to CLU Editor',
    }
  : {
      eyebrow: 'CLU Métropole',
      title: 'Le réseau ouvre bientôt.',
      launch: 'Le jeu arrive à 12h00 (heure française) le 21 septembre 2026.',
      automatic: 'L’accès se débloquera automatiquement dès l’ouverture.',
      preparing: 'Préparation du réseau',
      days: 'Jours',
      hours: 'Heures',
      minutes: 'Minutes',
      seconds: 'Secondes',
      earlyAccess: 'Accès anticipé',
      earlyAccessHint: 'Vous avez un code d’accès privé ?',
      codePlaceholder: 'Code d’accès',
      unlock: 'Entrer',
      invalidCode: 'Code d’accès incorrect.',
      returnEditor: 'Retourner sur CLU Editor',
    })

const remaining = computed(() => Math.max(0, LAUNCH_AT - now.value))
const isOpen = computed(() => remaining.value <= 0)
const canEnter = computed(() => isOpen.value || hasEarlyAccess.value)

const countdown = computed(() => {
  const totalSeconds = Math.floor(remaining.value / 1000)

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  }
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

let timer: ReturnType<typeof setInterval> | null = null

function refreshClock() {
  now.value = Date.now()
}

function stopClock() {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

async function hashAccessCode(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function unlockEarlyAccess() {
  if (earlyAccessBusy.value) return

  earlyAccessBusy.value = true
  earlyAccessError.value = false

  try {
    const hash = await hashAccessCode(earlyAccessCode.value.trim())

    if (hash !== EARLY_ACCESS_HASH) {
      earlyAccessError.value = true
      return
    }

    hasEarlyAccess.value = true
    sessionStorage.setItem(EARLY_ACCESS_SESSION_KEY, 'granted')
    earlyAccessCode.value = ''
    stopClock()
  } catch {
    earlyAccessError.value = true
  } finally {
    earlyAccessBusy.value = false
  }
}

onMounted(() => {
  refreshClock()
  hasEarlyAccess.value = sessionStorage.getItem(EARLY_ACCESS_SESSION_KEY) === 'granted'

  if (!canEnter.value) {
    timer = setInterval(refreshClock, 250)
  }
})

watch(canEnter, (open) => {
  if (open) stopClock()
})

onUnmounted(stopClock)
</script>

<template>
  <div class="metropole-editor-return">
    <a href="/editor" class="metropole-editor-return__link">
      <span aria-hidden="true">←</span>
      <span>{{ copy.returnEditor }}</span>
    </a>
  </div>

  <Transition
    name="metropole-reveal"
    mode="out-in"
  >
    <ClientOnly v-if="canEnter" key="game">
      <div class="metropole-game-host">
        <GameRoot />
      </div>

      <template #fallback>
        <div class="launch-gate launch-gate--fallback" />
      </template>
    </ClientOnly>

    <main
      v-else
      key="countdown"
      class="launch-gate"
    >
      <div class="launch-gate__ambient" aria-hidden="true">
        <span class="launch-route launch-route--1" />
        <span class="launch-route launch-route--2" />
        <span class="launch-route launch-route--3" />
        <span class="launch-route launch-route--4" />

        <i class="launch-node launch-node--1" />
        <i class="launch-node launch-node--2" />
        <i class="launch-node launch-node--3" />
        <i class="launch-node launch-node--4" />
        <i class="launch-node launch-node--5" />
      </div>

      <section class="launch-card">
        <div class="launch-brand">
          <strong>CLU</strong>
          <span>Métropole</span>
        </div>

        <p class="launch-eyebrow">
          {{ copy.eyebrow }}
        </p>

        <h1>{{ copy.title }}</h1>

        <p class="launch-date">
          {{ copy.launch }}
        </p>

        <div
          class="countdown"
          role="timer"
          aria-live="polite"
          aria-atomic="true"
        >
          <div class="countdown-unit">
            <strong>{{ pad(countdown.days) }}</strong>
            <span>{{ copy.days }}</span>
          </div>

          <div class="countdown-separator" aria-hidden="true">
            :
          </div>

          <div class="countdown-unit">
            <strong>{{ pad(countdown.hours) }}</strong>
            <span>{{ copy.hours }}</span>
          </div>

          <div class="countdown-separator" aria-hidden="true">
            :
          </div>

          <div class="countdown-unit">
            <strong>{{ pad(countdown.minutes) }}</strong>
            <span>{{ copy.minutes }}</span>
          </div>

          <div class="countdown-separator" aria-hidden="true">
            :
          </div>

          <div class="countdown-unit countdown-unit--seconds">
            <strong :key="countdown.seconds">
              {{ pad(countdown.seconds) }}
            </strong>
            <span>{{ copy.seconds }}</span>
          </div>
        </div>

        <div class="launch-status">
          <span class="launch-status__pulse" aria-hidden="true" />

          <div>
            <strong>{{ copy.preparing }}</strong>
            <span>{{ copy.automatic }}</span>
          </div>
        </div>

        <form
          class="early-access"
          @submit.prevent="unlockEarlyAccess"
        >
          <div class="early-access__copy">
            <strong>{{ copy.earlyAccess }}</strong>
            <span>{{ copy.earlyAccessHint }}</span>
          </div>

          <div class="early-access__controls">
            <input
              v-model="earlyAccessCode"
              type="password"
              name="metropole-access-code"
              autocomplete="off"
              :placeholder="copy.codePlaceholder"
              :aria-invalid="earlyAccessError ? 'true' : 'false'"
              @input="earlyAccessError = false"
            >

            <button
              type="submit"
              :disabled="earlyAccessBusy || !earlyAccessCode.trim()"
            >
              {{ copy.unlock }}
            </button>
          </div>

          <p
            v-if="earlyAccessError"
            class="early-access__error"
            role="alert"
          >
            {{ copy.invalidCode }}
          </p>
        </form>
      </section>
    </main>
  </Transition>
</template>

<style scoped lang="scss">
.metropole-editor-return {
  position: fixed;
  z-index: 10000;
  top: 1rem;
  left: 1rem;

  pointer-events: none;
}

.metropole-editor-return__link {
  display: inline-flex;
  align-items: center;
  gap: .5rem;

  min-height: 2.5rem;
  padding: 0 .85rem;

  border: 1px solid rgb(121 226 233 / 22%);
  border-radius: .8rem;

  background: rgb(5 15 21 / 82%);
  color: rgb(239 252 253 / 82%);

  font-size: .75rem;
  font-weight: 760;
  text-decoration: none;

  box-shadow: 0 .75rem 2rem rgb(0 0 0 / 22%);
  backdrop-filter: blur(.8rem);

  pointer-events: auto;
  transition: border-color .18s ease, background .18s ease, color .18s ease, transform .18s ease;
}

.metropole-editor-return__link:hover {
  border-color: rgb(121 226 233 / 48%);
  background: rgb(14 35 43 / 90%);
  color: #9cebf0;
}

.metropole-editor-return__link:active {
  transform: translateY(1px);
}

.launch-gate,
.metropole-game-host {
  width: 100%;
  min-width: 0;
}

.launch-gate {
  position: relative;
  isolation: isolate;

  display: grid;
  place-items: center;

  min-height: 100%;
  height: 100%;
  overflow: hidden;
  padding: clamp(1.5rem, 4vw, 4rem);

  background:
    radial-gradient(
      circle at 78% 24%,
      rgb(61 211 222 / 15%),
      transparent 26%
    ),
    radial-gradient(
      circle at 24% 78%,
      rgb(244 193 76 / 8%),
      transparent 25%
    ),
    linear-gradient(135deg, #061017 0%, #08141b 45%, #04090d 100%);

  color: #f4fbfc;
}

.launch-gate::before {
  position: absolute;
  z-index: -2;
  inset: 0;

  background:
    repeating-linear-gradient(
      24deg,
      transparent 0 7.5rem,
      rgb(255 255 255 / 1.5%) 7.55rem 7.6rem
    );

  content: '';
  opacity: .75;
}

.launch-gate::after {
  position: absolute;
  z-index: -1;
  inset: 0;

  background:
    radial-gradient(
      circle at center,
      transparent 0 30%,
      rgb(2 7 11 / 28%) 72%,
      rgb(2 7 11 / 72%) 100%
    );

  content: '';
  pointer-events: none;
}

.launch-gate--fallback {
  min-height: 100%;
}

.launch-gate__ambient {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.launch-route {
  position: absolute;
  left: 50%;

  width: min(65rem, 80vw);
  height: 2px;

  border-radius: 999px;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgb(88 218 226 / 12%),
      rgb(105 232 239 / 66%),
      rgb(88 218 226 / 12%),
      transparent
    );

  box-shadow: 0 0 1.6rem rgb(79 214 223 / 14%);
  transform-origin: left center;

  animation: route-breathe 5.5s ease-in-out infinite;
}

.launch-route--1 {
  top: 22%;
  transform: rotate(17deg);
}

.launch-route--2 {
  top: 58%;
  transform: rotate(-13deg);
  animation-delay: -1.8s;
}

.launch-route--3 {
  top: 40%;
  background:
    linear-gradient(
      90deg,
      transparent,
      rgb(244 193 76 / 8%),
      rgb(244 193 76 / 46%),
      rgb(244 193 76 / 8%),
      transparent
    );
  transform: rotate(-35deg);
  animation-delay: -3.4s;
}

.launch-route--4 {
  top: 8%;
  left: 72%;
  width: min(42rem, 50vw);
  transform: rotate(82deg);
  animation-delay: -4.5s;
}

.launch-node {
  position: absolute;

  width: .65rem;
  height: .65rem;

  border: 2px solid rgb(240 254 255 / 92%);
  border-radius: 50%;

  background: #50d5dd;
  box-shadow:
    0 0 0 .35rem rgb(80 213 221 / 11%),
    0 0 1.4rem rgb(80 213 221 / 42%);

  animation: node-pulse 2.8s ease-in-out infinite;
}

.launch-node--1 {
  top: 27%;
  left: 68%;
}

.launch-node--2 {
  top: 63%;
  left: 76%;
  animation-delay: -.8s;
}

.launch-node--3 {
  top: 76%;
  left: 58%;
  animation-delay: -1.6s;
}

.launch-node--4 {
  top: 36%;
  left: 88%;
  background: #efbd59;
  animation-delay: -2.1s;
}

.launch-node--5 {
  top: 18%;
  left: 53%;
  animation-delay: -2.5s;
}

.launch-card {
  position: relative;
  z-index: 2;

  width: min(58rem, 100%);
  padding: clamp(1.6rem, 4vw, 3.5rem);

  border: 1px solid rgb(116 226 232 / 22%);
  border-radius: 1.5rem;

  background:
    linear-gradient(
      135deg,
      rgb(13 31 39 / 88%),
      rgb(6 16 22 / 78%)
    );

  box-shadow:
    0 2.2rem 6rem rgb(0 0 0 / 36%),
    inset 0 1px 0 rgb(255 255 255 / 5%);

  text-align: center;
  backdrop-filter: blur(1.25rem);
}

.launch-brand {
  display: inline-flex;
  align-items: baseline;
  gap: .55rem;

  margin-bottom: 2rem;
}

.launch-brand strong {
  font-size: 1.35rem;
  letter-spacing: .12em;
}

.launch-brand span {
  color: rgb(235 248 249 / 58%);
  font-size: .72rem;
  font-weight: 750;
}

.launch-eyebrow {
  margin: 0 0 .7rem;

  color: #7ce1e7;

  font-size: .72rem;
  font-weight: 850;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.launch-card h1 {
  margin: 0;

  font-size: clamp(2.5rem, 6vw, 5.5rem);
  font-weight: 780;
  letter-spacing: -.055em;
  line-height: .95;
}

.launch-date {
  max-width: 45rem;
  margin: 1.3rem auto 0;

  color: rgb(235 248 249 / 72%);

  font-size: clamp(.95rem, 2vw, 1.15rem);
  line-height: 1.6;
}

.countdown {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr) auto
    minmax(0, 1fr) auto
    minmax(0, 1fr) auto
    minmax(0, 1fr);
  align-items: center;
  gap: clamp(.3rem, 1.2vw, .85rem);

  margin: clamp(2rem, 5vw, 3.5rem) auto;
}

.countdown-unit {
  display: grid;
  gap: .55rem;

  min-width: 0;
  padding: clamp(.9rem, 2vw, 1.35rem) .6rem;

  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 1rem;

  background: rgb(255 255 255 / 3.5%);
}

.countdown-unit strong {
  display: block;

  font-variant-numeric: tabular-nums;
  font-size: clamp(2rem, 5vw, 4.1rem);
  font-weight: 760;
  letter-spacing: -.055em;
  line-height: .95;
}

.countdown-unit--seconds strong {
  color: #8be9ee;
  animation: second-tick .24s ease-out;
}

.countdown-unit span {
  overflow: hidden;

  color: rgb(236 248 249 / 46%);

  font-size: clamp(.55rem, 1vw, .7rem);
  font-weight: 800;
  letter-spacing: .12em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.countdown-separator {
  color: rgb(125 229 235 / 52%);
  font-size: clamp(1.7rem, 4vw, 3.2rem);
  font-weight: 350;
  transform: translateY(-.65rem);
}

.launch-status {
  display: inline-flex;
  align-items: center;
  gap: .8rem;

  max-width: 100%;
  padding: .75rem 1rem;

  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 999px;

  background: rgb(255 255 255 / 2.5%);

  text-align: left;
}

.launch-status__pulse {
  width: .55rem;
  height: .55rem;
  flex: none;

  border-radius: 50%;

  background: #6fe0e6;
  box-shadow: 0 0 0 .35rem rgb(92 220 228 / 9%);

  animation: status-pulse 1.8s ease-in-out infinite;
}

.launch-status div {
  display: grid;
  gap: .12rem;
  min-width: 0;
}

.launch-status strong {
  font-size: .78rem;
}

.launch-status span {
  color: rgb(235 248 249 / 48%);
  font-size: .7rem;
}

.early-access {
  display: grid;
  gap: .7rem;

  width: min(30rem, 100%);
  margin: 1.25rem auto 0;
  padding-top: 1.15rem;

  border-top: 1px solid rgb(255 255 255 / 7%);
}

.early-access__copy {
  display: grid;
  gap: .15rem;
}

.early-access__copy strong {
  color: rgb(239 252 253 / 82%);
  font-size: .72rem;
}

.early-access__copy span {
  color: rgb(235 248 249 / 42%);
  font-size: .68rem;
}

.early-access__controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: .55rem;
}

.early-access input {
  min-width: 0;
  height: 2.75rem;
  padding: 0 .9rem;

  border: 1px solid rgb(123 225 231 / 18%);
  border-radius: .8rem;
  outline: none;

  background: rgb(0 0 0 / 18%);
  color: #f4fbfc;

  font: inherit;
  font-size: .8rem;

  transition: border-color .18s ease, box-shadow .18s ease;
}

.early-access input::placeholder {
  color: rgb(235 248 249 / 30%);
}

.early-access input:focus {
  border-color: rgb(111 224 230 / 62%);
  box-shadow: 0 0 0 .2rem rgb(91 218 225 / 9%);
}

.early-access input[aria-invalid='true'] {
  border-color: rgb(255 116 126 / 60%);
}

.early-access button {
  min-width: 5.4rem;
  height: 2.75rem;
  padding: 0 1rem;

  border: 1px solid rgb(111 224 230 / 34%);
  border-radius: .8rem;

  background: rgb(75 202 211 / 13%);
  color: #9cebf0;

  font: inherit;
  font-size: .76rem;
  font-weight: 800;

  cursor: pointer;
  transition: background .18s ease, border-color .18s ease, transform .18s ease;
}

.early-access button:hover:not(:disabled) {
  border-color: rgb(111 224 230 / 56%);
  background: rgb(75 202 211 / 20%);
}

.early-access button:active:not(:disabled) {
  transform: translateY(1px);
}

.early-access button:disabled {
  cursor: default;
  opacity: .42;
}

.early-access__error {
  margin: 0;
  color: #ff8c95;
  font-size: .68rem;
}

.metropole-game-host {
  min-height: 100%;
  overflow: auto;
  background: #061017;
}

.metropole-reveal-enter-active,
.metropole-reveal-leave-active {
  transition:
    opacity .5s ease,
    filter .5s ease,
    transform .5s ease;
}

.metropole-reveal-enter-from {
  opacity: 0;
  filter: blur(.5rem);
  transform: scale(1.008);
}

.metropole-reveal-leave-to {
  opacity: 0;
  filter: blur(.4rem);
  transform: scale(.994);
}

@keyframes route-breathe {
  0%, 100% {
    opacity: .3;
    filter: brightness(.75);
  }

  50% {
    opacity: 1;
    filter: brightness(1.2);
  }
}

@keyframes node-pulse {
  0%, 100% {
    opacity: .55;
    transform: scale(.84);
  }

  50% {
    opacity: 1;
    transform: scale(1.16);
  }
}

@keyframes status-pulse {
  0%, 100% {
    opacity: .55;
    transform: scale(.82);
  }

  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@keyframes second-tick {
  from {
    opacity: .45;
    transform: translateY(.2rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 700px) {
  .metropole-editor-return {
    top: .65rem;
    left: .65rem;
  }

  .metropole-editor-return__link {
    min-height: 2.35rem;
    padding: 0 .7rem;
    font-size: .7rem;
  }

  .launch-gate {
    padding: 1rem;
  }

  .launch-card {
    padding: 1.5rem 1rem;
    border-radius: 1.25rem;
  }

  .launch-brand {
    margin-bottom: 1.25rem;
  }

  .countdown {
    gap: .35rem;
  }

  .countdown-unit {
    gap: .35rem;
    padding: .8rem .25rem;
    border-radius: .75rem;
  }

  .countdown-separator {
    font-size: 1.35rem;
    transform: translateY(-.55rem);
  }

  .launch-status {
    border-radius: 1rem;
  }

  .early-access__controls {
    grid-template-columns: 1fr;
  }

  .early-access button {
    width: 100%;
  }
}

@media (max-width: 430px) {
  .countdown {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: .55rem;
  }

  .countdown-separator {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .launch-route,
  .launch-node,
  .launch-status__pulse,
  .countdown-unit strong {
    animation: none !important;
  }

  .metropole-reveal-enter-active,
  .metropole-reveal-leave-active {
    transition-duration: .001ms !important;
  }
}
</style>
