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
  if (typeof document !== 'undefined') document.documentElement.dataset.cluGameView = game.state.value.status.toLowerCase()
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
  status => {
    audio.setScene(status === 'PLAYING' ? 'GAME' : 'HOME')
    if (typeof document !== 'undefined') document.documentElement.dataset.cluGameView = status.toLowerCase()
  },
)

onUnmounted(() => {
  audio.dispose()
  i18n.stopDomTranslation()
  preferences.dispose()
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-clu-game-view')
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
html[data-clu-game-text-size='small']{--clu-text-scale:1}
html[data-clu-game-text-size='medium']{--clu-text-scale:1.15}
html[data-clu-game-text-size='large']{--clu-text-scale:1.3}
html[data-clu-game-view='setup'] .metropole-editor-return,html[data-clu-game-view='playing'] .metropole-editor-return{display:none!important}
.clu-view-enter-active,.clu-view-leave-active{transition:opacity .26s ease,filter .26s ease,transform .26s ease}
.clu-view-enter-from{opacity:0;filter:blur(5px);transform:scale(1.008)}
.clu-view-leave-to{opacity:0;filter:blur(4px);transform:scale(.994)}

html[data-clu-game-motion='reduced'] .home *,
html[data-clu-game-motion='reduced'] .setup *,
html[data-clu-game-motion='reduced'] .game-shell *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}

.clu-skip-link{position:fixed;z-index:10000;left:12px;top:10px;padding:10px 14px;border-radius:9px;background:#f6ffff;color:#071116;font:800 calc(13px * var(--clu-text-scale,1))/1.2 Inter,ui-sans-serif,system-ui,sans-serif;transform:translateY(-180%);transition:transform .14s ease;box-shadow:0 8px 28px rgba(0,0,0,.35)}
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



/* CLU Métropole — zones de jeu accessibles et réellement séparées.
   Ces règles sont globales car la taille du texte est portée par <html>. */
html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
  --clu-play-top-safe:96px;
  --clu-play-bottom-safe:84px;
  --clu-play-rail-left:16px;
  --clu-play-rail-width:70px;
  --clu-play-panel-left:104px;
  --clu-play-panel-width:470px;
  --clu-play-tool-gap:8px;
  --clu-play-tool-height:52px;
  --clu-play-tool-pad:8px;
  --clu-play-panel-pad:20px;
  --clu-play-panel-head:42px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
  --clu-play-top-safe:102px;
  --clu-play-bottom-safe:90px;
  --clu-play-rail-left:16px;
  --clu-play-rail-width:76px;
  --clu-play-panel-left:114px;
  --clu-play-panel-width:500px;
  --clu-play-tool-gap:10px;
  --clu-play-tool-height:56px;
  --clu-play-tool-pad:9px;
  --clu-play-panel-pad:23px;
  --clu-play-panel-head:46px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
  --clu-play-top-safe:110px;
  --clu-play-bottom-safe:98px;
  --clu-play-rail-left:16px;
  --clu-play-rail-width:82px;
  --clu-play-panel-left:124px;
  --clu-play-panel-width:540px;
  --clu-play-tool-gap:12px;
  --clu-play-tool-height:62px;
  --clu-play-tool-pad:10px;
  --clu-play-panel-pad:27px;
  --clu-play-panel-head:50px;
}

html[data-clu-game-view='playing'] .game-shell .tool-dock{
  left:var(--clu-play-rail-left);
  top:var(--clu-play-top-safe);
  bottom:auto;
  width:var(--clu-play-rail-width);
  max-height:calc(100vh - var(--clu-play-top-safe) - var(--clu-play-bottom-safe));
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:flex-start;
  gap:var(--clu-play-tool-gap);
  padding:var(--clu-play-tool-pad);
  overflow-y:auto;
  overflow-x:hidden;
  scrollbar-width:thin;
  scrollbar-gutter:stable;
}
html[data-clu-game-view='playing'] .game-shell .tool-dock button{
  flex:0 0 auto;
  width:100%;
  min-height:var(--clu-play-tool-height);
  box-sizing:border-box;
  padding:6px 4px;
  gap:4px;
  line-height:1.1;
}
html[data-clu-game-view='playing'] .game-shell .tool-dock b{line-height:1}
html[data-clu-game-view='playing'] .game-shell .tool-dock span{
  display:block;
  width:100%;
  line-height:1.25;
  text-align:center;
  white-space:normal;
  overflow-wrap:normal;
  word-break:normal;
}
html[data-clu-game-view='playing'] .game-shell .create-line-button,
html[data-clu-game-view='playing'] .game-shell .search-hub-button{
  margin-top:0;
}

html[data-clu-game-view='playing'] .game-shell .side-panel{
  left:var(--clu-play-panel-left);
  top:var(--clu-play-top-safe);
  bottom:var(--clu-play-bottom-safe);
  width:min(var(--clu-play-panel-width),calc(100vw - var(--clu-play-panel-left) - 18px));
  display:grid;
  grid-template-rows:auto minmax(0,1fr);
  overflow:hidden;
  box-sizing:border-box;
}
html[data-clu-game-view='playing'] .game-shell .panel-top{
  height:auto;
  min-height:var(--clu-play-panel-head);
  box-sizing:border-box;
  padding:10px 16px 10px 20px;
  gap:14px;
}
html[data-clu-game-view='playing'] .game-shell .panel-scroll{
  height:auto;
  min-height:0;
  overflow:auto;
  box-sizing:border-box;
  padding:var(--clu-play-panel-pad);
  scroll-padding-block:var(--clu-play-panel-pad);
  scrollbar-gutter:stable;
}

html[data-clu-game-view='playing'] .game-shell .search-hub{
  left:var(--clu-play-panel-left);
  top:var(--clu-play-top-safe);
  width:min(var(--clu-play-panel-width),calc(100vw - var(--clu-play-panel-left) - 18px));
  max-height:calc(100vh - var(--clu-play-top-safe) - var(--clu-play-bottom-safe));
  box-sizing:border-box;
}

/* Les messages de pause / temps restent hors du rail et hors du panneau. */
html[data-clu-game-view='playing'] .game-shell .time-notices{
  left:auto;
  right:18px;
  bottom:calc(var(--clu-play-bottom-safe) + 10px);
  width:min(390px,calc(100vw - 36px));
}

/* Le petit bouton Cookies n'a aucune utilité en pleine partie et masquait les contrôles carte. */
html[data-clu-game-view='playing'] .cookie-manage{display:none!important}

/* Hauteurs plus faibles : on garde les séparations, et on réduit seulement les boutons du rail. */
@media(max-height:700px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-play-top-safe:92px;
    --clu-play-bottom-safe:80px;
    --clu-play-tool-height:46px;
    --clu-play-tool-gap:6px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-top-safe:96px;
    --clu-play-bottom-safe:84px;
    --clu-play-tool-height:49px;
    --clu-play-tool-gap:7px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-top-safe:102px;
    --clu-play-bottom-safe:90px;
    --clu-play-tool-height:52px;
    --clu-play-tool-gap:8px;
  }
}

/* Sur une fenêtre étroite, on conserve toujours un vrai espace entre rail et panneau. */
@media(max-width:900px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-play-rail-left:10px;
    --clu-play-rail-width:66px;
    --clu-play-panel-left:92px;
    --clu-play-panel-width:470px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-rail-left:10px;
    --clu-play-rail-width:70px;
    --clu-play-panel-left:98px;
    --clu-play-panel-width:490px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-rail-left:10px;
    --clu-play-rail-width:76px;
    --clu-play-panel-left:106px;
    --clu-play-panel-width:510px;
  }
}


/* Petit / Moyen / Grand — même axe vertical, mêmes règles d'alignement. */
html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
  --clu-play-rail-width:74px;
  --clu-play-panel-left:108px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
  --clu-play-rail-width:80px;
  --clu-play-panel-left:118px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
  --clu-play-rail-width:88px;
  --clu-play-panel-left:130px;
}

html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock{
  align-items:stretch;
  justify-items:stretch;
  padding-inline:8px;
  padding-bottom:8px;
  scrollbar-gutter:auto;
  scrollbar-width:thin;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock::-webkit-scrollbar,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock::-webkit-scrollbar,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock::-webkit-scrollbar{
  width:4px;
  height:4px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock::-webkit-scrollbar-thumb,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock::-webkit-scrollbar-thumb,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock::-webkit-scrollbar-thumb{
  background:rgba(126,239,244,.28);
  border-radius:999px;
}

html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  width:100%;
  min-width:0;
  min-height:var(--clu-play-tool-height);
  height:var(--clu-play-tool-height);
  margin:0;
  padding:4px 3px;
  gap:3px;
  text-align:center;
}

html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button > b,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button > b,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button > b{
  display:grid;
  place-items:center;
  width:22px;
  height:22px;
  flex:0 0 22px;
  margin:0;
  padding:0;
  line-height:1;
  text-align:center;
}

html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button > span,
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button > span,
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button > span{
  display:flex;
  align-items:center;
  justify-content:center;
  width:100%;
  min-width:0;
  min-height:16px;
  margin:0;
  padding:0;
  line-height:1.15;
  text-align:center;
  white-space:normal;
  overflow-wrap:normal;
  word-break:normal;
}

/* Même axe pour les deux boutons spéciaux du bas du rail, quelle que soit la taille. */
html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell :is(.create-line-button,.search-hub-button),
html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell :is(.create-line-button,.search-hub-button),
html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell :is(.create-line-button,.search-hub-button){
  margin-left:0!important;
  margin-right:0!important;
  transform:none!important;
}

@media(max-width:900px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-play-rail-width:70px;
    --clu-play-panel-left:96px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-rail-width:76px;
    --clu-play-panel-left:104px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-rail-width:82px;
    --clu-play-panel-left:112px;
  }
}

/* Toutes tailles — le dernier bouton reste toujours entièrement accessible.
   On compacte uniquement le rail lorsque la hauteur manque; le panneau et le mode Grand ne changent pas. */
@media(max-height:700px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-play-top-safe:84px;
    --clu-play-bottom-safe:68px;
    --clu-play-tool-height:42px;
    --clu-play-tool-gap:4px;
    --clu-play-tool-pad:6px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-top-safe:88px;
    --clu-play-bottom-safe:72px;
    --clu-play-tool-height:44px;
    --clu-play-tool-gap:5px;
    --clu-play-tool-pad:6px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-top-safe:92px;
    --clu-play-bottom-safe:76px;
    --clu-play-tool-height:46px;
    --clu-play-tool-gap:6px;
    --clu-play-tool-pad:7px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button > b{
    width:20px;height:20px;flex-basis:20px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button > b{
    width:21px;height:21px;flex-basis:21px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button > b{
    width:22px;height:22px;flex-basis:22px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button,
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button,
  html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button{
    padding-block:3px;
    gap:2px;
  }
}

@media(max-height:560px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-play-top-safe:78px;
    --clu-play-bottom-safe:60px;
    --clu-play-tool-height:36px;
    --clu-play-tool-gap:2px;
    --clu-play-tool-pad:5px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-top-safe:80px;
    --clu-play-bottom-safe:64px;
    --clu-play-tool-height:38px;
    --clu-play-tool-gap:3px;
    --clu-play-tool-pad:5px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-top-safe:82px;
    --clu-play-bottom-safe:66px;
    --clu-play-tool-height:40px;
    --clu-play-tool-gap:3px;
    --clu-play-tool-pad:5px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button > b,
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button > b,
  html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button > b{
    width:18px;height:18px;flex-basis:18px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='small'] .game-shell .tool-dock button,
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium'] .game-shell .tool-dock button,
  html[data-clu-game-view='playing'][data-clu-game-text-size='large'] .game-shell .tool-dock button{
    padding-block:2px;
    gap:1px;
  }
}



/* Menu pause — même logique propre pour Petit / Moyen / Grand.
   Le dialogue garde toujours une marge avec les bords et scrolle en interne
   si la hauteur de l'écran ne permet pas d'afficher toutes les actions. */
html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
  --clu-pause-edge:20px;
  --clu-pause-width:390px;
  --clu-pause-pad:20px;
  --clu-pause-gap:9px;
  --clu-pause-button-y:11px;
  --clu-pause-button-gap:10px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
  --clu-pause-edge:22px;
  --clu-pause-width:420px;
  --clu-pause-pad:22px;
  --clu-pause-gap:10px;
  --clu-pause-button-y:12px;
  --clu-pause-button-gap:11px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
  --clu-pause-edge:24px;
  --clu-pause-width:450px;
  --clu-pause-pad:24px;
  --clu-pause-gap:11px;
  --clu-pause-button-y:13px;
  --clu-pause-button-gap:12px;
}

html[data-clu-game-view='playing'] .game-shell .menu-backdrop{
  box-sizing:border-box;
  padding:var(--clu-pause-edge);
  overflow:hidden;
  align-items:center;
  justify-items:center;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu{
  width:min(var(--clu-pause-width),calc(100vw - (var(--clu-pause-edge) * 2)));
  max-height:calc(100vh - (var(--clu-pause-edge) * 2));
  box-sizing:border-box;
  padding:var(--clu-pause-pad);
  gap:var(--clu-pause-gap);
  overflow-y:auto;
  overflow-x:hidden;
  overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-gutter:stable;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu::-webkit-scrollbar{width:6px}
html[data-clu-game-view='playing'] .game-shell .pause-menu::-webkit-scrollbar-thumb{
  background:rgba(126,239,244,.24);
  border-radius:999px;
}
html[data-clu-game-view='playing'] .game-shell .pause-hero{
  min-width:0;
  padding-bottom:2px;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu h2{
  line-height:1.18;
  overflow-wrap:anywhere;
}
html[data-clu-game-view='playing'] .game-shell .pause-hero p{
  line-height:1.4;
}
html[data-clu-game-view='playing'] .game-shell .pause-rules{
  gap:6px;
  margin-block:9px 11px;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu > button{
  min-width:0;
  box-sizing:border-box;
  padding:var(--clu-pause-button-y) 12px;
  gap:var(--clu-pause-button-gap);
  flex:0 0 auto;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu > button > b{
  width:22px;
  min-width:22px;
  display:grid;
  place-items:center;
  line-height:1;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu > button > span{
  min-width:0;
  gap:3px;
}
html[data-clu-game-view='playing'] .game-shell .pause-menu > button strong,
html[data-clu-game-view='playing'] .game-shell .pause-menu > button small{
  display:block;
  min-width:0;
  white-space:normal;
  overflow-wrap:anywhere;
  line-height:1.3;
}

/* Écrans peu hauts : on garde les marges et l'accès à toutes les actions,
   sans réduire la taille de texte choisie par l'utilisateur. */
@media(max-height:700px){
  html[data-clu-game-view='playing'][data-clu-game-text-size='small']{
    --clu-pause-edge:14px;
    --clu-pause-pad:17px;
    --clu-pause-gap:7px;
    --clu-pause-button-y:9px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-pause-edge:16px;
    --clu-pause-pad:18px;
    --clu-pause-gap:8px;
    --clu-pause-button-y:10px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-pause-edge:18px;
    --clu-pause-pad:19px;
    --clu-pause-gap:8px;
    --clu-pause-button-y:10px;
  }
}

@media(max-height:560px){
  html[data-clu-game-view='playing'] .game-shell .menu-backdrop{
    align-items:stretch;
  }
  html[data-clu-game-view='playing'] .game-shell .pause-menu{
    margin:auto;
  }
}
</style>
