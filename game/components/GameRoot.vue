<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import GameHome from './home/GameHome.vue'
import NewGameSetup from './setup/NewGameSetup.vue'
import GamePlay from './play/GamePlay.vue'
import GameDialogHost from './common/GameDialogHost.vue'
import LegalCenterModal from './commercial/LegalCenterModal.vue'
import CookieConsent from './commercial/CookieConsent.vue'

import {
  useMetropoleGame,
} from '../composables/useMetropoleGame'
import { useGameSettings } from '../composables/useGameSettings'
import { useGameAudio } from '../composables/useGameAudio'
import { useGameHelp } from '../composables/useGameHelp'
import { useGameI18n } from '../composables/useGameI18n'

const game =
  useMetropoleGame()
const preferences = useGameSettings()
const audio = useGameAudio()
const help = useGameHelp()
const i18n = useGameI18n()

onMounted(() => {
  preferences.initialize()
  help.initialize()
  audio.initialize()
  audio.setScene(game.state.value.status === 'PLAYING' ? 'GAME' : 'HOME')
  i18n.startDomTranslation()
  if (typeof document !== 'undefined') document.title = 'CLU Métropole'
})

watch(
  () => i18n.locale.value,
  () => i18n.refreshDom(),
  { flush: 'post' },
)

watch(
  () => game.state.value.status,
  status => audio.setScene(status === 'PLAYING' ? 'GAME' : 'HOME'),
)

onUnmounted(() => {
  audio.dispose()
  i18n.stopDomTranslation()
  preferences.dispose()
})
</script>

<template>
  <a class="clu-skip-link" href="#clu-main-content">Aller au contenu principal</a>
  <Transition name="clu-view" mode="out-in">
    <GameHome
      v-if="game.state.value.status === 'HOME'"
      id="clu-main-content"
      key="home"
    />

    <NewGameSetup
      v-else-if="game.state.value.status === 'SETUP'"
      id="clu-main-content"
      key="setup"
    />

    <GamePlay
      v-else-if="game.state.value.status === 'PLAYING'"
      id="clu-main-content"
      key="play"
    />
  </Transition>
  <GameDialogHost />
  <LegalCenterModal />
  <CookieConsent />
</template>

<style>
html[data-clu-game-theme='dark']{color-scheme:dark}
.clu-view-enter-active,.clu-view-leave-active{transition:opacity .26s ease,filter .26s ease,transform .26s ease}
.clu-view-enter-from{opacity:0;filter:blur(5px);transform:scale(1.008)}
.clu-view-leave-to{opacity:0;filter:blur(4px);transform:scale(.994)}

html[data-clu-game-motion='reduced'] .home *,
html[data-clu-game-motion='reduced'] .setup *,
html[data-clu-game-motion='reduced'] .game-shell *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}

.clu-skip-link{position:fixed;z-index:10000;left:12px;top:10px;padding:10px 14px;border-radius:9px;background:#f6ffff;color:#071116;font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;transform:translateY(-180%);transition:transform .14s ease;box-shadow:0 8px 28px rgba(0,0,0,.35)}
.clu-skip-link:focus{transform:translateY(0)}
.commercial-home :is(button,a,input,select,textarea,[tabindex]):focus-visible,
.home :is(button,a,input,select,textarea,[tabindex]):focus-visible,
.setup :is(button,a,input,select,textarea,[tabindex]):focus-visible,
.game-shell :is(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #83f2f6!important;outline-offset:3px!important;box-shadow:0 0 0 2px #061017!important}
.game-shell .search-field-input:focus-visible{outline:none!important;outline-offset:0!important;box-shadow:none!important}
html[data-clu-game-contrast='high'] :is(.home,.setup,.game-shell){filter:contrast(1.08)}
html[data-clu-game-contrast='high'] :is(.home,.setup,.game-shell) :is(small,p,span){opacity:1!important}
html[data-clu-game-contrast='high'] :is(.home,.setup,.game-shell) :is(button,input,select,textarea){border-color:rgba(255,255,255,.42)!important}
html[data-clu-game-contrast='high'] :is(.home,.setup,.game-shell) :is(.active,.selected,[aria-pressed='true'],[aria-selected='true']){outline:2px solid #a5fbff!important;outline-offset:-2px!important}
@media (prefers-reduced-motion: reduce){.clu-view-enter-active,.clu-view-leave-active{transition-duration:.001ms!important}.home *,.setup *,.game-shell *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}

</style>
