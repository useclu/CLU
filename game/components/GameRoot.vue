<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import GameHome from './home/GameHome.vue'
import NewGameSetup from './setup/NewGameSetup.vue'
import GamePlay from './play/GamePlay.vue'
import GameDialogHost from './common/GameDialogHost.vue'
import LegalCenterModal from './commercial/LegalCenterModal.vue'
import CookieConsent from './commercial/CookieConsent.vue'
import OnlineGamePanel from './online/OnlineGamePanel.vue'

import {
  useMetropoleGame,
} from '../composables/useMetropoleGame'
import { useGameSettings } from '../composables/useGameSettings'
import { useGameAudio } from '../composables/useGameAudio'
import { useGameHelp } from '../composables/useGameHelp'
import { useGameI18n } from '../composables/useGameI18n'
import { useCluOnline } from '../composables/useCluOnline'

const game =
  useMetropoleGame()
const preferences = useGameSettings()
const audio = useGameAudio()
const help = useGameHelp()
const i18n = useGameI18n()
const online = useCluOnline()

onMounted(() => {
  preferences.initialize()
  help.initialize()
  audio.initialize()
  audio.setScene(game.state.value.status === 'PLAYING' ? 'GAME' : 'HOME')
  if (typeof document !== 'undefined') document.documentElement.dataset.cluGameView = game.state.value.status.toLowerCase()
  i18n.startDomTranslation()
  if (typeof document !== 'undefined') document.title = 'CLU Métropole'
  void online.restaurerSessionApresActualisation()
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

let onlineApplyQueue = Promise.resolve()
let onlineApplyGeneration = 0

function queueOnlineApply(action: () => Promise<void>) {
  onlineApplyQueue = onlineApplyQueue
    .catch(() => undefined)
    .then(action)
    .catch(() => {
      online.demanderSnapshotJeu()
    })
}

function onlineTargetsCurrentGame() {
  const current = game.state.value.save
  if (!current || game.state.value.status !== 'PLAYING') return true
  const linkedId = online.sauvegardeLocaleId.value
  return Boolean(linkedId && current.id === linkedId)
}

watch(
  () => online.jeuSnapshot.value,
  payload => {
    if (!payload || online.moi.value?.statut !== 'accepte' || !onlineTargetsCurrentGame()) return
    // Un snapshot invalide toutes les mutations distantes déjà en file d'attente :
    // elles sont forcément incluses (ou volontairement écartées) dans cet état
    // autoritaire et ne doivent jamais être rejouées après lui.
    const generation = ++onlineApplyGeneration
    queueOnlineApply(async () => {
      if (generation !== onlineApplyGeneration) return
      const applied = await game.applyOnlineSnapshot(payload.save, online.sauvegardeLocaleId.value)
      online.lierSauvegardeLocale(applied.id)
    })
  },
  { immediate: true },
)

watch(
  () => online.partieFermeeSignal.value,
  signal => {
    if (!signal || game.state.value.status !== 'PLAYING') return
    // Quand l'hôte ferme la session, aucun participant ne reste dans une copie
    // locale de la métropole : on revient immédiatement à l'accueil.
    onlineApplyGeneration += 1
    void game.discardCurrentGame()
  },
)

watch(
  () => online.derniereMutation.value,
  mutation => {
    if (!mutation || online.moi.value?.statut !== 'accepte' || !onlineTargetsCurrentGame()) return
    if (mutation.auteurId === online.moi.value.id) return
    const generation = onlineApplyGeneration
    queueOnlineApply(async () => {
      if (generation !== onlineApplyGeneration) return
      await game.applyOnlineMutation(mutation.patches)
    })
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
      :online-mode="online.creationEnLigne.value"
    />

    <GamePlay
      v-else-if="game.state.value.status === 'PLAYING'"
      id="clu-main-content"
      key="play"
    />
  </Transition>
  <OnlineGamePanel v-if="game.state.value.status === 'PLAYING'" />
  <Teleport to="body">
    <div v-if="online.notificationFinPartie.value" class="online-end-overlay" role="presentation">
      <section
        class="online-end-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="i18n.t('Partie terminée')"
      >
        <div class="online-end-icon" aria-hidden="true">●</div>
        <h2>{{ i18n.t('Partie terminée') }}</h2>
        <p>{{ i18n.t('L’administrateur a quitté la partie. La session en ligne est terminée.') }}</p>
        <button type="button" @click="online.fermerNotificationFinPartie()">
          {{ i18n.t('Fermer') }}
        </button>
      </section>
    </div>
  </Teleport>
  <GameDialogHost />
  <LegalCenterModal />
  <CookieConsent />
</template>

<style>
html[data-clu-game-theme='dark']{color-scheme:dark}
html[data-clu-game-theme='light']{color-scheme:light}
html[data-clu-game-text-size='small']{--clu-text-scale:1}
html[data-clu-game-text-size='medium']{--clu-text-scale:1.15}
html[data-clu-game-text-size='large']{--clu-text-scale:1.3}
html[data-clu-game-view='home'] .metropole-editor-return,html[data-clu-game-view='setup'] .metropole-editor-return,html[data-clu-game-view='playing'] .metropole-editor-return{display:none!important}
.clu-view-enter-active,.clu-view-leave-active{transition:opacity .26s ease,filter .26s ease,transform .26s ease}
.clu-view-enter-from{opacity:0;filter:blur(5px);transform:scale(1.008)}
.clu-view-leave-to{opacity:0;filter:blur(4px);transform:scale(.994)}

html[data-clu-game-motion='reduced'] .home *,
html[data-clu-game-motion='reduced'] .setup *,
html[data-clu-game-motion='reduced'] .game-shell *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}

.clu-skip-link{position:fixed;z-index:10000;left:12px;top:10px;padding:10px 14px;border-radius:9px;background:#f6ffff;color:#071116;font:800 calc(13px * var(--clu-text-scale,1))/1.2 Inter,ui-sans-serif,system-ui,sans-serif;transform:translateY(-180%);transition:transform .14s ease;box-shadow:0 8px 28px rgba(0,0,0,.35)}
.clu-skip-link:focus{transform:translateY(0)}
.online-end-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(3,10,16,.76);backdrop-filter:blur(8px)}
.online-end-dialog{width:min(460px,100%);padding:28px;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:var(--clu-surface,#101b24);color:var(--clu-text,#f7fbff);box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.online-end-icon{width:44px;height:44px;margin:0 auto 14px;display:grid;place-items:center;border-radius:999px;background:rgba(255,255,255,.1);font-size:18px}
.online-end-dialog h2{margin:0 0 10px;font-size:24px;line-height:1.15}
.online-end-dialog p{margin:0;color:inherit;opacity:.82;line-height:1.55}
.online-end-dialog button{margin-top:22px;min-width:140px;padding:11px 18px;border:0;border-radius:11px;background:#eafcff;color:#071116;font:800 14px/1 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}
.online-end-dialog button:focus-visible{outline:3px solid #83f2f6;outline-offset:3px}
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
  --clu-play-panel-width:390px;
  --clu-play-tool-gap:8px;
  --clu-play-tool-height:52px;
  --clu-play-tool-pad:8px;
  --clu-play-panel-pad:14px;
  --clu-play-panel-head:42px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
  --clu-play-top-safe:102px;
  --clu-play-bottom-safe:90px;
  --clu-play-rail-left:16px;
  --clu-play-rail-width:76px;
  --clu-play-panel-left:114px;
  --clu-play-panel-width:410px;
  --clu-play-tool-gap:10px;
  --clu-play-tool-height:56px;
  --clu-play-tool-pad:9px;
  --clu-play-panel-pad:16px;
  --clu-play-panel-head:46px;
}
html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
  --clu-play-top-safe:110px;
  --clu-play-bottom-safe:98px;
  --clu-play-rail-left:16px;
  --clu-play-rail-width:82px;
  --clu-play-panel-left:124px;
  --clu-play-panel-width:440px;
  --clu-play-tool-gap:12px;
  --clu-play-tool-height:62px;
  --clu-play-tool-pad:10px;
  --clu-play-panel-pad:18px;
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
    --clu-play-panel-width:390px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='medium']{
    --clu-play-rail-left:10px;
    --clu-play-rail-width:70px;
    --clu-play-panel-left:98px;
    --clu-play-panel-width:410px;
  }
  html[data-clu-game-view='playing'][data-clu-game-text-size='large']{
    --clu-play-rail-left:10px;
    --clu-play-rail-width:76px;
    --clu-play-panel-left:106px;
    --clu-play-panel-width:430px;
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

/* Thème clair : l'interface change, la cartographie conserve son style propre. */
html[data-clu-game-theme='light'] :is(.setup,.game-shell){color:#111}
html[data-clu-game-theme='light'] .game-shell :is(.topbar-left,.topbar-right,.tool-dock,.side-panel,.management-hub,.pause-menu,.settings-dialog,.creation-modal,.action-dialog,.borrow-confirmation-dialog,.station-name-dialog,.tutorial-coach),
html[data-clu-game-theme='light'] .help-center{
  background:rgba(247,250,252,.96)!important;
  color:#18232c!important;
  border-color:rgba(24,35,44,.14)!important;
  box-shadow:0 14px 42px rgba(20,33,43,.16)!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.panel-top,.settings-dialog__header,.help-header){border-color:rgba(24,35,44,.10)!important}
html[data-clu-game-theme='light'] .game-shell :is(button,input,select,textarea),
html[data-clu-game-theme='light'] .help-center :is(button,input,select,textarea){color:#18232c}
html[data-clu-game-theme='light'] .game-shell :is(input,select,textarea){background:#fff!important;border-color:rgba(24,35,44,.16)!important;color:#18232c!important;color-scheme:light!important}
html[data-clu-game-theme='light'] .game-shell :is(.line-card,.sub-card,.network-overview,.fleet-card,.depot-card,.depot-builder,.panel-card,.intro-card,.daily-pulse,.objective-list article,.info-card,.decision-block){background:rgba(30,53,68,.035)!important;border-color:rgba(24,35,44,.10)!important}
html[data-clu-game-theme='light'] .game-shell :is(.tool-dock,.side-panel,.management-hub) small{color:rgba(24,35,44,.62)}
html[data-clu-game-theme='light'] .game-shell .tool-dock button.active,
html[data-clu-game-theme='light'] .game-shell :is(.active,.selected,[aria-pressed='true']){background:rgba(37,167,181,.10)}
html[data-clu-game-theme='light'] .game-shell .eyebrow,
html[data-clu-game-theme='light'] .game-shell .settings-kicker{color:#147d88!important;opacity:1!important}
html[data-clu-game-theme='light'] .game-shell :is(.menu-backdrop,.action-backdrop,.creation-backdrop,.station-name-backdrop){background:rgba(20,30,38,.24)!important}
html[data-clu-game-theme='light'] .help-nav{border-color:rgba(24,35,44,.10)!important}
html[data-clu-game-theme='light'] .help-search{background:#fff!important;border-color:rgba(24,35,44,.14)!important}
html[data-clu-game-theme='light'] .help-categories button.active{background:rgba(37,167,181,.10)!important;border-color:rgba(37,167,181,.22)!important}
html[data-clu-game-theme='light'] .help-article>p,
html[data-clu-game-theme='light'] .article-summary{color:rgba(24,35,44,.72)!important}
html[data-clu-game-theme='light'] .help-article ul{background:rgba(30,53,68,.035)!important;border-color:rgba(24,35,44,.10)!important}
html[data-clu-game-theme='light'] .help-article li{color:rgba(24,35,44,.72)!important}


html[data-clu-game-theme='light'] .settings-panel{color:#18232c!important}
html[data-clu-game-theme='light'] .settings-panel :is(.settings-section,.audio-row,.toggle-grid label,.option-grid button,.theme-switch button,.help-settings-row){background:rgba(30,53,68,.035)!important;border-color:rgba(24,35,44,.10)!important;color:#18232c!important}
html[data-clu-game-theme='light'] .settings-panel :is(.section-copy p,.option-grid small,.toggle-grid small,.audio-row small,.theme-switch small,.help-settings-row small,.settings-footer span){color:rgba(24,35,44,.58)!important}
html[data-clu-game-theme='light'] .settings-panel input[type=range]{accent-color:#2497a3}
html[data-clu-game-theme='light'] .settings-panel button.active{background:rgba(37,167,181,.10)!important;border-color:rgba(37,167,181,.24)!important}

/* Thème clair : mêmes écrans, surfaces claires sans remplacer les décors de carte/ville. */
html[data-clu-game-theme='light'] .setup :is(.map-rail,.config-panel,.launch-dock,.map-choice,.premium-field input,.premium-segments button,.management-grid button,.switch-row){
  background:rgba(247,250,252,.92)!important;
  border-color:rgba(25,47,60,.14)!important;
  color:#172630!important;
  box-shadow:0 12px 34px rgba(5,19,28,.12)!important;
}
html[data-clu-game-theme='light'] .setup :is(.setup-kicker,.map-rail__label,.map-choice small,.config-label,.config-panel p,.launch-dock__summary small,.switch-row small){
  color:rgba(23,38,48,.60)!important;
}
html[data-clu-game-theme='light'] .setup :is(.premium-field input,.seed-field input,select,textarea){background:#fff!important;color:#172630!important;color-scheme:light!important}
html[data-clu-game-theme='light'] .setup .map-choice.selected,
html[data-clu-game-theme='light'] .setup .premium-segments button.active{background:rgba(37,167,181,.12)!important;border-color:rgba(37,167,181,.28)!important}
html[data-clu-game-theme='light'] .setup .launch-start{color:#111!important}


/* Thème clair final : toutes les surfaces d'interface passent en clair.
   La carte MapLibre garde volontairement son style cartographique. */
html[data-clu-game-theme='light']{
  --clu-light-bg:#f3f6f8;
  --clu-light-surface:#ffffff;
  --clu-light-soft:#edf2f5;
  --clu-light-soft-2:#e6edf1;
  --clu-light-border:rgba(25,47,60,.14);
  --clu-light-border-strong:rgba(25,47,60,.22);
  --clu-light-text:#172630;
  --clu-light-muted:#5c6c76;
  --clu-light-accent:#167f8a;
}
html[data-clu-game-theme='light'] .game-shell{
  --game-muted:var(--clu-light-muted);
  --game-accent:var(--clu-light-accent);
}
html[data-clu-game-theme='light'] .game-shell :is(.side-panel,.management-hub,.topbar-left,.topbar-right,.tool-dock,.pause-menu,.creation-modal,.action-dialog,.borrow-confirmation-dialog,.station-name-dialog,.settings-dialog,.tutorial-coach),
html[data-clu-game-theme='light'] .help-center{
  background:rgba(250,252,253,.97)!important;
  color:var(--clu-light-text)!important;
  border-color:var(--clu-light-border)!important;
  box-shadow:0 12px 34px rgba(24,42,53,.16)!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel,
html[data-clu-game-theme='light'] .game-shell .management-hub{
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .network-overview,.line-card,.sub-card,.line-browser,.identity-editor,.station-row,.line-diagram,.diagram-branch,
  .fleet-card,.depot-card,.depot-builder,.panel-card,.intro-card,.daily-pulse,.info-card,.decision-block,
  .kpi-grid>div,.analysis-rows>div,.trend-row>span,.finance-amount-card,.funding-hero>div,.funding-breakdown>div,
  .transactions>div,.credit-status>div,.line-fare-row,.generated-preview-stats>span,.objective-list article,
  .event-card,.municipality-card,.operations-card,.operations-summary,.pcc-card,.route-result li,.load-list article,
  .help-settings-row,.settings-section,.audio-row,.toggle-grid label,.option-grid button,.theme-switch button
){
  background:var(--clu-light-surface)!important;
  color:var(--clu-light-text)!important;
  border-color:var(--clu-light-border)!important;
  box-shadow:none!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .metrics-grid>div,.summary-grid>div,.kpi-grid>div,.generated-preview-stats>span,.analysis-rows>div,
  .trend-row>span,.station-row,.upgrade-row,.line-fare-row,.funding-breakdown>div,.transactions>div,.credit-status>div,
  .scope-row button,.choice-row button,.mode-tabs button,.line-filter-row button,.pinned-lines button,.line-actions button,
  .counter button,.sub-card button,.file-button,.logo-upload-row>button,.finance-unit-tabs button,.finance-amount-controls button,
  .finance-amount-actions button,.guided-grid button,.mini-tabs button,.generator-segments button
){
  background:var(--clu-light-soft)!important;
  border-color:var(--clu-light-border)!important;
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .scope-row button.active,.choice-row button.active,.mode-tabs button.active,.line-filter-row button.active,.pinned-lines button.active,
  .mini-tabs button.active,.generator-segments button.active,.finance-unit-tabs button.active,.guided-grid button.active,
  .line-card.selected,.active,.selected,[aria-pressed='true']
){
  background:rgba(37,167,181,.11)!important;
  border-color:rgba(37,167,181,.30)!important;
  color:#0d5961!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(input,select,textarea,.line-search,.fleet-adjuster input),
html[data-clu-game-theme='light'] .help-center :is(input,select,textarea,.help-search){
  background:#fff!important;
  color:var(--clu-light-text)!important;
  border-color:var(--clu-light-border-strong)!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  small,.muted,.eyebrow,.section-label small,.line-title small,.line-kpis small,.diagram-copy small,.diagram-head small,
  .branch-label,.scope-large-network-hint,.passengers-head>small,.panel-fold>summary,.finance-panel .eyebrow,
  .sub-card p,.network-pulse small,.analysis-rows small,.trend-row small,.station-main small,.line-finance-card>small
){
  color:var(--clu-light-muted)!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(h1,h2,h3,h4,strong,b,summary,label,span,p,dt,dd){
  text-shadow:none;
}
html[data-clu-game-theme='light'] .game-shell .side-panel details{
  border-color:var(--clu-light-border)!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel .panel-fold>summary,
html[data-clu-game-theme='light'] .game-shell .side-panel summary{
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel .primary,
html[data-clu-game-theme='light'] .game-shell .side-panel .primary-money-action,
html[data-clu-game-theme='light'] .game-shell .creation-modal .actions .primary{
  background:#4fd3dd!important;
  border-color:#37b8c2!important;
  color:#071519!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.line-delete-button,.danger){
  color:#a52d38!important;
}
html[data-clu-game-theme='light'] .game-shell .line-delete-button{
  background:#fff2f3!important;
  border-color:#efb8bd!important;
}
html[data-clu-game-theme='light'] .game-shell .line-pin-button{
  color:#65737b!important;
}
html[data-clu-game-theme='light'] .game-shell .line-pin-button.active{
  color:#9b6d00!important;
}
html[data-clu-game-theme='light'] .game-shell .diagram-rail:before{
  background:rgba(23,38,48,.18)!important;
}
html[data-clu-game-theme='light'] .game-shell .diagram-rail i{
  box-shadow:0 0 0 2px #fff!important;
}
html[data-clu-game-theme='light'] .game-shell .bar,
html[data-clu-game-theme='light'] .game-shell .progress-track{
  background:rgba(23,38,48,.12)!important;
}
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.cost-chip,.logo-box,.mode-grid button){
  background:var(--clu-light-soft)!important;
  border-color:var(--clu-light-border)!important;
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.field input,.color-field input){
  background:#fff!important;
  color:var(--clu-light-text)!important;
  border-color:var(--clu-light-border-strong)!important;
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .constraint{
  background:#fff7e8!important;
  color:#6b4b13!important;
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .constraint b{color:#7a5413!important}
html[data-clu-game-theme='light'] .game-shell .creation-modal .actions{
  border-color:var(--clu-light-border)!important;
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .actions button:not(.primary){
  background:var(--clu-light-soft)!important;
  border-color:var(--clu-light-border)!important;
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .game-shell .management-hub :is(button,.hub-item){
  color:var(--clu-light-text)!important;
  border-color:var(--clu-light-border)!important;
}
html[data-clu-game-theme='light'] .game-shell .management-hub button:hover{
  background:var(--clu-light-soft)!important;
}
html[data-clu-game-theme='light'] .game-shell .tool-dock button{
  color:#2d3d46!important;
}
html[data-clu-game-theme='light'] .game-shell .tool-dock button.active{
  color:#0d6570!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.topbar-left,.topbar-right) small{
  color:#60717c!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.topbar-left,.topbar-right) strong,
html[data-clu-game-theme='light'] .game-shell :is(.topbar-left,.topbar-right) b{
  color:#172630!important;
}
html[data-clu-game-theme='light'] .help-center :is(.help-nav,.help-article,.help-categories button,.help-search){
  color:var(--clu-light-text)!important;
}
html[data-clu-game-theme='light'] .help-center .help-categories button{
  background:transparent!important;
  border-color:transparent!important;
}
html[data-clu-game-theme='light'] .help-center .help-categories button.active{
  background:rgba(37,167,181,.10)!important;
  color:#0d5961!important;
}


/* Thème clair — overlays téléportés et écrans secondaires.
   Ces éléments vivent sous <body> et échappaient aux règles limitées à .game-shell. */
html[data-clu-game-theme='light'] :is(.search-launcher,.search-hub,.bilan-shell,.borrow-confirmation-dialog,.legal-modal,.cookie-banner,.cookie-panel){
  background:rgba(250,252,253,.98)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 14px 38px rgba(24,42,53,.16)!important;
}
html[data-clu-game-theme='light'] :is(.search-overlay-layer,.borrow-confirmation-backdrop,.bilan-backdrop,.legal-overlay,.cookie-overlay){
  color:var(--clu-light-text,#172630)!important;
}
html[data-clu-game-theme='light'] .search-scrim,
html[data-clu-game-theme='light'] .borrow-confirmation-backdrop,
html[data-clu-game-theme='light'] .bilan-backdrop,
html[data-clu-game-theme='light'] .legal-overlay{
  background:rgba(19,30,38,.30)!important;
}
html[data-clu-game-theme='light'] .search-hub :is(
  .search-module,.line-board,.journey-board,.network-departures,.departure-board,.journey-alternatives,
  .module-results,.endpoint-results,.line-board-direction,.line-board-station select,.service-hero,.departure-tabs
){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}
html[data-clu-game-theme='light'] .search-hub :is(.module-input,.endpoint-input,input,select){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border-strong,rgba(25,47,60,.22))!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'] .search-hub :is(
  .module-results button,.endpoint-results button,.line-board-actions button,.departure-tabs button,
  .map-route-button,.swap-route,.line-board-footer span
){
  color:var(--clu-light-text,#172630)!important;
}
html[data-clu-game-theme='light'] .search-hub :is(.module-results button:hover,.endpoint-results button:hover,.departure-tabs button.active){
  background:var(--clu-light-soft,#edf2f5)!important;
}
html[data-clu-game-theme='light'] .search-hub :is(
  .search-hub-head small,.line-board-head small,.line-board-footer,.journey-clockline,.journey-summary-line span,
  .service-identity small,.departure-tabs small,.journey-foot,.journey-alternatives small,.walk-transfer small
){
  color:var(--clu-light-muted,#5c6c76)!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'] .search-hub :is(.departure-board-list article,.journey-clockline,.journey-summary-line,.journey-alternatives>header,.journey-alternatives article,.ride-service+*){
  border-color:rgba(25,47,60,.09)!important;
}
html[data-clu-game-theme='light'] .search-hub .stop-row .rail i{
  background:#fff!important;
  box-shadow:0 0 0 2px #fff!important;
}
html[data-clu-game-theme='light'] .search-hub .departure-board-title time,
html[data-clu-game-theme='light'] .search-hub .departure-board-list article>span>small{
  background:var(--clu-light-soft,#edf2f5)!important;
  color:var(--clu-light-text,#172630)!important;
}
html[data-clu-game-theme='light'] .search-hub :is(.journey-summary-line strong,.departure-board-list b,.alt-times b){color:#0d6570!important}
html[data-clu-game-theme='light'] .bilan-shell :is(
  .bilan-section,.hero-grid>div,.stat-grid>div,.records-grid>div,.week-strip button,.week-focus,.week-kpis>div,
  .detail-card,.closing-finance,.chart-card,.timeline-day
){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:none!important;
}
html[data-clu-game-theme='light'] .bilan-shell :is(.bilan-tabs button,.chart-switch button){color:var(--clu-light-text,#172630)!important}
html[data-clu-game-theme='light'] .bilan-shell :is(.bilan-tabs button.active,.chart-switch button.active,.week-strip button.active){
  background:rgba(37,167,181,.11)!important;
  border-color:rgba(37,167,181,.28)!important;
  color:#0d5961!important;
}
html[data-clu-game-theme='light'] .bilan-shell :is(small,.eyebrow,.empty,.reconstructed,.ongoing,.complete){color:var(--clu-light-muted,#5c6c76)!important}
html[data-clu-game-theme='light'] .borrow-confirmation-dialog :is(.borrow-confirmation-summary>span,.dialog-actions button),
html[data-clu-game-theme='light'] .legal-modal :is(button,.legal-nav button,.legal-content),
html[data-clu-game-theme='light'] :is(.cookie-banner,.cookie-panel) button{
  background:var(--clu-light-soft,#edf2f5)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}
html[data-clu-game-theme='light'] .borrow-confirmation-dialog .finance-action{
  background:#4fd3dd!important;
  border-color:#37b8c2!important;
  color:#071519!important;
}
html[data-clu-game-theme='light'] :is(.legal-modal,.cookie-banner,.cookie-panel) :is(p,small,li){color:var(--clu-light-muted,#5c6c76)!important}


/* Thème clair — inspecteurs, assistant, pulsations et exports. */
html[data-clu-game-theme='light'] .game-shell :is(.assistant-panel,.station-inspector,.vehicle-inspector),
html[data-clu-game-theme='light'] :is(.share-panel,.editor-export-panel){
  background:rgba(250,252,253,.98)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 14px 38px rgba(24,42,53,.16)!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.assistant-panel,.station-inspector,.vehicle-inspector) :is(
  article,.directions,.passages article,.facility,.grid>div,.grid>button,.line-badges button,.route-shortcuts button,.rename input,.rename button,.facility button
),
html[data-clu-game-theme='light'] :is(.share-panel,.editor-export-panel) :is(
  .preview-copy,.switches label,.line-list button,.identity-preview,.notice,select,footer button
){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}
html[data-clu-game-theme='light'] .game-shell :is(.assistant-panel,.station-inspector,.vehicle-inspector) :is(small,p,.eyebrow,.section-label,.hint,.direction,.grid span),
html[data-clu-game-theme='light'] :is(.share-panel,.editor-export-panel) :is(small,p,.intro,.empty,.options-grid span){
  color:var(--clu-light-muted,#5c6c76)!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'] .game-shell .world-pulse :is(.pulse-empty,.pulse-card){
  background:rgba(250,252,253,.98)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 10px 30px rgba(24,42,53,.13)!important;
}
html[data-clu-game-theme='light'] .game-shell .world-pulse .pulse-head{
  color:#eef7f8!important; /* reste sur la carte, donc contraste avec le fond cartographique */
}
html[data-clu-game-theme='light'] .game-shell .world-pulse :is(.pulse-main>b,.pulse-actions button){
  background:var(--clu-light-soft,#edf2f5)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}
html[data-clu-game-theme='light'] :is(.share-backdrop,.editor-export-backdrop){background:rgba(19,30,38,.30)!important}
html[data-clu-game-theme='light'] :is(.share-panel,.editor-export-panel) select{color-scheme:light!important}
html[data-clu-game-theme='light'] :is(.share-panel,.editor-export-panel) footer .primary{
  background:#4fd3dd!important;
  border-color:#37b8c2!important;
  color:#071519!important;
}


/* ==========================================================================\n   Thème clair V2 — cohérence complète de l'interface en partie.\n   La carte MapLibre conserve son fond cartographique ; tous les HUD, menus,\n   dialogues et panneaux passent réellement sur des surfaces claires.\n   ========================================================================== */
html[data-clu-game-theme='light'] .game-shell{
  color:var(--clu-light-text,#172630)!important;
  color-scheme:light!important;
}

html[data-clu-game-theme='light'] .game-shell :is(
  .topbar,.tool-dock,.side-panel,.management-hub,.pause-menu,.settings-dialog,
  .action-dialog,.borrow-confirmation-dialog,.station-name-dialog,.bankruptcy-card,
  .creation-modal,.launch-config-dialog,.event-preparation-dialog,.project-dock,
  .project-forecast-panel,.project-financing-card,.line-visibility-panel,
  .time-controls,.day-progress,.assistant-panel,.station-inspector,.vehicle-inspector,
  .tutorial-coach
){
  background:rgba(250,252,253,.97)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 10px 30px rgba(24,42,53,.14)!important;
}

/* Topbar actuelle : les anciennes classes topbar-left/right ne suffisaient plus. */
html[data-clu-game-theme='light'] .game-shell .topbar :is(b,strong,span){color:var(--clu-light-text,#172630)!important}
html[data-clu-game-theme='light'] .game-shell .topbar small{color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important}
html[data-clu-game-theme='light'] .game-shell .topbar .debt-kpi-button{
  background:#fff2f3!important;border-color:rgba(196,67,79,.20)!important;color:#8e2530!important
}
html[data-clu-game-theme='light'] .game-shell .topbar .debt-kpi-button strong{color:#c13c49!important}
html[data-clu-game-theme='light'] .game-shell .topbar .morale-kpi{border:1px solid rgba(25,47,60,.09)!important}
html[data-clu-game-theme='light'] .game-shell .topbar .menu-button,
html[data-clu-game-theme='light'] .game-shell .topbar .bilan-button,
html[data-clu-game-theme='light'] .game-shell .topbar .day-button{
  background:var(--clu-light-soft,#edf2f5)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  color:var(--clu-light-text,#172630)!important;
}
html[data-clu-game-theme='light'] .game-shell .topbar .day-button{
  background:rgba(37,167,181,.13)!important;border-color:rgba(37,167,181,.27)!important;color:#0d5961!important
}
html[data-clu-game-theme='light'] .game-shell :is(.day-tooltip,.city-suggestions,.city-search-empty){
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .city-search>input{background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border-strong,rgba(25,47,60,.22))!important}
html[data-clu-game-theme='light'] .game-shell .city-suggestions button:hover{background:var(--clu-light-soft,#edf2f5)!important}

/* Rail gauche et contrôles carte. */
html[data-clu-game-theme='light'] .game-shell .tool-dock button{
  background:transparent!important;color:#263942!important;border-color:transparent!important
}
html[data-clu-game-theme='light'] .game-shell .tool-dock button:hover{background:var(--clu-light-soft,#edf2f5)!important}
html[data-clu-game-theme='light'] .game-shell .tool-dock button.active{
  background:rgba(37,167,181,.12)!important;color:#0d6570!important
}
html[data-clu-game-theme='light'] .game-shell .create-line-button{border-top-color:var(--clu-light-border,rgba(25,47,60,.14))!important}
html[data-clu-game-theme='light'] .game-shell .map-context-dock button{
  background:rgba(250,252,253,.97)!important;
  color:#22363f!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 7px 22px rgba(24,42,53,.14)!important;
}
html[data-clu-game-theme='light'] .game-shell .map-context-dock button.active{
  background:rgba(37,167,181,.13)!important;border-color:rgba(37,167,181,.28)!important;color:#0d6570!important
}
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__head{border-bottom-color:var(--clu-light-border,rgba(25,47,60,.14))!important}
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__head small,
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__list small,
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__list em{
  color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important
}
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__head button,
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__list label{
  color:var(--clu-light-text,#172630)!important
}
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__head button{
  background:var(--clu-light-soft,#edf2f5)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__list label:hover,
html[data-clu-game-theme='light'] .game-shell .line-visibility-panel__list label.dimmed{background:var(--clu-light-soft,#edf2f5)!important}

/* Temps + date : plus de capsule noire illisible en mode clair. */
html[data-clu-game-theme='light'] .game-shell .time-controls :is(button,strong,small),
html[data-clu-game-theme='light'] .game-shell .day-progress :is(b,small){color:var(--clu-light-text,#172630)!important}
html[data-clu-game-theme='light'] .game-shell .time-controls small,
html[data-clu-game-theme='light'] .game-shell .day-progress small{color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important}
html[data-clu-game-theme='light'] .game-shell .time-controls button{
  background:var(--clu-light-soft,#edf2f5)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .time-controls .speed-tabs button.active,
html[data-clu-game-theme='light'] .game-shell .time-controls .day-next-inline{
  background:rgba(37,167,181,.13)!important;border-color:rgba(37,167,181,.27)!important;color:#0d5961!important
}
html[data-clu-game-theme='light'] .game-shell .day-progress>div{background:#dce5e9!important}
html[data-clu-game-theme='light'] .game-shell .pause-entry-notice{
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .pause-entry-notice--warning{color:#785314!important;border-color:rgba(181,126,29,.25)!important;background:#fff8ea!important}

/* Menu de pause et paramètres. */
html[data-clu-game-theme='light'] .game-shell :is(.pause-menu,.settings-dialog) :is(button,input,select,textarea){
  color:var(--clu-light-text,#172630)!important
}
html[data-clu-game-theme='light'] .game-shell .pause-menu button,
html[data-clu-game-theme='light'] .game-shell .settings-dialog__header button{
  background:var(--clu-light-soft,#edf2f5)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .pause-menu button.resume{
  background:rgba(37,167,181,.13)!important;border-color:rgba(37,167,181,.27)!important;color:#0d5961!important
}
html[data-clu-game-theme='light'] .game-shell .pause-rules span{background:var(--clu-light-soft,#edf2f5)!important;color:var(--clu-light-muted,#5c6c76)!important}

/* Création de ligne : toutes les surfaces/labels lisibles. */
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.creation-head,.actions){border-color:var(--clu-light-border,rgba(25,47,60,.14))!important}
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.creation-head h2,.section-label strong,.mode-grid strong,.cost-chip strong,.logo-box strong,.field){color:var(--clu-light-text,#172630)!important}
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.creation-head span,.section-label small,.mode-grid small,.cost-chip span,.logo-box p){color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important}
html[data-clu-game-theme='light'] .game-shell .creation-modal :is(.mode-grid button,.cost-chip,.logo-box,.logo-actions button,.file-button,.close){
  background:var(--clu-light-soft,#edf2f5)!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .mode-grid button.active{
  background:rgba(37,167,181,.10)!important;border-color:rgba(37,167,181,.32)!important
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .actions button:not(.primary){
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border-strong,rgba(25,47,60,.22))!important
}
html[data-clu-game-theme='light'] .game-shell .creation-modal .actions .primary{
  background:#4fd3dd!important;border-color:#37b8c2!important;color:#071519!important
}

/* Barre de conception et dialogues de mise en service / financement. */
html[data-clu-game-theme='light'] .game-shell .project-dock :is(.project-stats span,.project-routing-actions,.selected-edit-station,.project-financing-figure,.project-financing-meta span,.project-financing-unavailable span),
html[data-clu-game-theme='light'] .game-shell .launch-config-dialog :is(.launch-config-summary>div,.launch-config-grid>section,.launch-advanced,.launch-upgrade-row,.launch-cost-breakdown span,.launch-recommended-card),
html[data-clu-game-theme='light'] .game-shell .event-preparation-dialog :is(.event-preparation-facts span,.event-preparation-recommendation,.event-preparation-services>* ,.event-preparation-options>*){
  background:var(--clu-light-soft,#edf2f5)!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .project-dock :is(small,.project-financing-copy p),
html[data-clu-game-theme='light'] .game-shell .launch-config-dialog :is(small,p,.launch-config-intro),
html[data-clu-game-theme='light'] .game-shell .event-preparation-dialog :is(small,p){
  color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important
}
html[data-clu-game-theme='light'] .game-shell :is(.project-dock,.launch-config-dialog,.event-preparation-dialog) button:not(.project-primary):not(.primary):not(.finance-action){
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell :is(.project-dock,.launch-config-dialog,.event-preparation-dialog) button.active{
  background:rgba(37,167,181,.12)!important;border-color:rgba(37,167,181,.28)!important;color:#0d5961!important
}

/* Panneaux de gestion : correction des textes et des fonds résiduels sombres. */
html[data-clu-game-theme='light'] .game-shell .side-panel{
  background:rgba(250,252,253,.98)!important;color:var(--clu-light-text,#172630)!important
}
html[data-clu-game-theme='light'] .game-shell .panel-top{
  background:#f5f8fa!important;color:var(--clu-light-text,#172630)!important;border-bottom-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .panel-top-actions button{
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(.line-search,.identity-editor,.line-finance-card,.line-diagram,.diagram-branch,.network-analysis-details,.panel-fold,.agreement-card,.disruption-card,.run-card,.timetable-card,.tool-card){
  background:#fff!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(.line-summary,.my-lines-heading,.line-mode-heading,.diagnostic-title,.section-head,.sub-card__head){color:var(--clu-light-text,#172630)!important}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(.passenger-summary,.bottleneck-summary){background:var(--clu-light-soft,#edf2f5)!important}
html[data-clu-game-theme='light'] .game-shell .side-panel .passenger-summary::before{background:var(--clu-light-border,rgba(25,47,60,.14))!important}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(.metrics-grid>div,.overview-metrics>div,.summary-grid>div,.line-finance-card>div){
  background:var(--clu-light-soft,#edf2f5)!important;color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(.metrics-grid span,.overview-metrics span,.summary-grid span,.line-finance-card span){color:var(--clu-light-muted,#5c6c76)!important;opacity:1!important}

/* Dialogues secondaires qui restaient sombres. */
html[data-clu-game-theme='light'] .game-shell :is(.action-dialog,.station-name-dialog,.bankruptcy-card) :is(button,input,select,textarea),
html[data-clu-game-theme='light'] .game-shell :is(.borrow-confirmation-dialog,.launch-config-dialog,.event-preparation-dialog) :is(button,input,select,textarea){
  color:var(--clu-light-text,#172630)!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell :is(.action-dialog,.station-name-dialog,.bankruptcy-card,.borrow-confirmation-dialog,.launch-config-dialog,.event-preparation-dialog) input,
html[data-clu-game-theme='light'] .game-shell :is(.action-dialog,.station-name-dialog,.bankruptcy-card,.borrow-confirmation-dialog,.launch-config-dialog,.event-preparation-dialog) select{
  background:#fff!important;color:var(--clu-light-text,#172630)!important;color-scheme:light!important
}

/* MapLibre : seulement ses contrôles, jamais le fond de carte. */
html[data-clu-game-theme='light'] .game-shell .maplibregl-ctrl-group{
  background:#fff!important;box-shadow:0 6px 18px rgba(24,42,53,.16)!important
}
html[data-clu-game-theme='light'] .game-shell .maplibregl-ctrl-group button{
  background-color:#fff!important;border-color:var(--clu-light-border,rgba(25,47,60,.14))!important
}
html[data-clu-game-theme='light'] .game-shell .maplibregl-ctrl-group button:hover{background-color:var(--clu-light-soft,#edf2f5)!important}
html[data-clu-game-theme='light'] .game-shell .maplibregl-ctrl-attrib{
  background:rgba(255,255,255,.86)!important;color:#40535e!important
}
html[data-clu-game-theme='light'] .game-shell .maplibregl-ctrl-attrib a{color:#0d6570!important}


/* Couverture des cartes internes des panneaux de gestion. */
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .finance-card,.funding-card,.funding-hero,.tariff-card,.price-card,.summary-card,.territory-card,
  .metric-card,.pcc-card,.regulation-card,.incident-card,.pcc-section,.pcc-hero,.mission-editor,
  .transfer-box,.departure-list,.request-list article,.transfer-list article,.works-list article,
  .history>div,.totals div,.model-stats>div,.fleet-kpis>div,.pcc-kpis>div,.schedule-kpis>div,
  .pulse-grid>div,.objective-list article,.municipality-row,.department-list>div,.info-card,
  .choice-list button,.mission-list>button,.substitution-list article,.negotiation-response,
  .depot-builder,.depot-card,.fleet-card,.daily-pulse,.decision-block,.diagnostic-card,.timetable-card
){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:none!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .mode-button,.choice-row button,.button-row button,.counter button,.station-row>button,.sub-card button,
  .scope-row button,.mode-tabs button,.guided-grid button,.debt-row button,.schedule-mode-switch button,
  .day-tabs button,.single-departure-row button,.mission-toolbar button,.empty-schedule button,.mission-add,
  .segmented button,.severity-row button,.station-picker button,.run-actions button,.disruption-actions button,
  .boost-control button,.extra-form button,.generator-grid button,.generator-actions button,.request-list button,
  .departure-list button,.depot-assignment>button,.line-groups-actions button
){
  background:var(--clu-light-soft,#edf2f5)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .mode-button.active,.choice-row button.active,.scope-row button.active,.mode-tabs button.active,
  .guided-grid button.active,.schedule-mode-switch button.active,.day-tabs button.active,
  .segmented button.active,.severity-row button.active,.station-picker button.active,.mission-list>button.active
){
  background:rgba(37,167,181,.12)!important;
  border-color:rgba(37,167,181,.28)!important;
  color:#0d5961!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .form-grid input,.form-grid select,.transfer-box select,.transfer-box input,.fleet-adjuster input,
  .mission-fields input,.mission-fields select,.generator-grid input,.single-departure-row input,
  .price-grid input,.weekday-grid input,.offer-grid input,.field input,.line-price-list input,.debt-row input,
  .wide-select,.operations-panel select,.operations-panel input,.operations-panel textarea,.negotiation-row input
){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border-strong,rgba(25,47,60,.22))!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'] .game-shell .side-panel :is(
  .muted,.empty-state,.depot-note,.fleet-warning,.disabled-note,.response-box,.run-badge,.mode-pill,
  .line-chip,.operation-message,.network-pulse small,.request-list small,.transfer-list small,.works-list small
){
  color:var(--clu-light-muted,#5c6c76)!important;
  opacity:1!important;
}

/* Dialogues déclenchés depuis les panneaux. */
html[data-clu-game-theme='light'] .game-shell :is(.negotiation-dialog){
  background:rgba(250,252,253,.98)!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
  box-shadow:0 14px 38px rgba(24,42,53,.16)!important;
}
html[data-clu-game-theme='light'] .game-shell .negotiation-dialog :is(button,input,select,textarea,.negotiation-response){
  background:#fff!important;
  color:var(--clu-light-text,#172630)!important;
  border-color:var(--clu-light-border,rgba(25,47,60,.14))!important;
}


/* ==========================================================================
   Thème clair V3 — contraste strict, accueil exclu.
   Le menu principal conserve volontairement son identité sombre/colorée.
   En setup et en partie : surfaces blanches, texte/glyphes noirs, couleurs
   réservées aux fonds d'état et aux accents fonctionnels.
   ========================================================================== */
html[data-clu-game-theme='light']{
  --clu-light-bg:#ffffff;
  --clu-light-surface:#ffffff;
  --clu-light-soft:#f4f5f6;
  --clu-light-soft-2:#eceff1;
  --clu-light-border:rgba(0,0,0,.13);
  --clu-light-border-strong:rgba(0,0,0,.23);
  --clu-light-text:#111111;
  --clu-light-muted:#4d4d4d;
  --clu-light-accent:#19b9c8;
}

/* L'accueil n'est PAS thémé en clair. On laisse ses propres styles décider. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] .home{
  color:#f4fbff!important;
  color-scheme:dark!important;
}

/* Nouvelle partie : aucune surface bleu marine/noire dans l'interface. */
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup{
  color:#111!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(
  .setup-back,.map-rail,.setup-workspace,.config-panel,.generated-panel,.launch-dock,
  .map-choice,.capital-options button,.capital-slider-card,.switch-row,
  .premium-segments button,.management-grid>div,.management-objectives,
  .generator-grid button,.generated-stats span,.seed-field button
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.14)!important;
  box-shadow:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(
  .setup-back,.setup-topbar,.map-rail,.setup-workspace,.config-panel,.launch-dock,
  .map-choice,.capital-options button,.capital-slider-card,.switch-row,
  .premium-segments button,.management-grid>div,.management-objectives,
  .generator-grid button,.generated-stats span,.seed-field button
) :is(b,strong,span,em,label,small,p){
  color:#111!important;
  opacity:1!important;
  text-shadow:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(
  .map-rail__label,.config-label,.premium-field>span,.generator-grid>div>span,
  .setup-kicker,.config-panel__title small,.capital-options small,.premium-segments small,
  .management-grid small,.management-objectives small,.switch-row small,.generated-stats small,
  .capital-slider-card>small,.capital-slider-scale,.launch-dock__summary small,.launch-dock__summary span
){color:#444!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(
  input[type='text'],input[type='number'],input[type='range'],select,textarea,.premium-field input,.seed-field input
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.24)!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .map-choice:hover{background:#f5f5f5!important}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(.map-choice.selected,.capital-options button.active,.premium-segments button.active,.management-grid button.active,.generator-grid button.active){
  background:#e9fbfd!important;
  border-color:#3ccad6!important;
  color:#111!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .generated-panel{background:#fff!important}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .capital-slider{
  background:linear-gradient(90deg,#111 0 var(--capital-progress),#d9dde0 var(--capital-progress) 100%)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .capital-slider::-webkit-slider-thumb{
  background:#111!important;border-color:#fff!important;box-shadow:0 0 0 3px rgba(0,0,0,.12)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .capital-slider::-moz-range-thumb{
  background:#111!important;border-color:#fff!important;box-shadow:0 0 0 3px rgba(0,0,0,.12)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .launch-cancel{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.22)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .launch-start{
  background:#54dce8!important;color:#111!important
}

/* Partie : noir lisible partout dans les HUD/panneaux clairs. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell{
  color:#111!important;
  color-scheme:light!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .topbar,.tool-dock,.side-panel,.management-hub,.pause-menu,.settings-dialog,
  .creation-modal,.action-dialog,.borrow-confirmation-dialog,.station-name-dialog,
  .launch-config-dialog,.event-preparation-dialog,.project-dock,.project-forecast-panel,
  .project-financing-card,.line-visibility-panel,.time-controls,.day-progress,
  .assistant-panel,.station-inspector,.vehicle-inspector,.tutorial-coach
){background:#fff!important;border-color:rgba(0,0,0,.14)!important;color:#111!important}

/* Le texte et les glyphes UI sont noirs, y compris +, grilles, yeux, éclairs, bulles. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .topbar,.tool-dock,.management-hub,.side-panel,.time-controls,.day-progress,.map-context-dock,
  .line-visibility-panel,.pause-menu,.settings-dialog,.creation-modal,.action-dialog,
  .launch-config-dialog,.event-preparation-dialog,.project-dock,.assistant-panel,
  .station-inspector,.vehicle-inspector,.tutorial-coach
) :is(button,b,strong,span,label,small,p,em,i,summary,dt,dd,h1,h2,h3,h4){
  color:#111!important;
  text-shadow:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .tool-dock button b,.create-line-button b,.management-hub-button b,.divers-hub-button b,
  .map-context-dock button span,.map-context-dock button,.menu-button,.bilan-button
){color:#111!important;opacity:1!important}

/* Le cyan sert au fond d'action, pas à rendre les icônes pâles. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .tool-dock button.active,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .map-context-dock button.active,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(.active,.selected,[aria-pressed='true']){
  color:#111!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .tool-dock--simple .management-hub-button{
  background:#fff!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .tool-dock button:hover,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .map-context-dock button:hover{
  background:#f3f4f5!important
}

/* Jour suivant : progression sombre et lisible sur fond blanc. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .day-progress>div{
  background:#dce0e3!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .day-progress i{
  background:#111!important;
  box-shadow:none!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .time-controls .day-next-inline,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .topbar .day-button{
  background:#dff8fb!important;
  color:#111!important;
  border-color:#78dce5!important
}

/* Panneaux de gestion : suppression des poches bleu marine restantes. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .side-panel :is(
  section,article,details,fieldset,.sub-card,.panel-card,.network-overview,.line-card,
  .line-browser,.identity-editor,.line-diagram,.diagram-branch,.network-analysis-details,
  .finance-card,.funding-card,.tariff-card,.price-card,.territory-card,.metric-card,
  .pcc-card,.regulation-card,.incident-card,.pcc-section,.mission-editor,.transfer-box,
  .depot-builder,.depot-card,.fleet-card,.daily-pulse,.decision-block,.diagnostic-card,.timetable-card
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.13)!important;
  box-shadow:none!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .side-panel :is(
  button,input,select,textarea,.metrics-grid>div,.overview-metrics>div,.summary-grid>div,
  .analysis-rows>div,.trend-row>span,.station-row,.upgrade-row,.line-fare-row,
  .funding-breakdown>div,.transactions>div,.credit-status>div
){
  color:#111!important;
  border-color:rgba(0,0,0,.15)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .side-panel :is(
  input,select,textarea
){background:#fff!important;color:#111!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .side-panel :is(
  small,.muted,.eyebrow,.empty-state,.hint,.section-label small,.line-title small,
  .line-kpis small,.diagram-copy small,.scope-large-network-hint
){color:#444!important;opacity:1!important}

/* Garder les modules réellement colorés : leur fond reste sémantique, le texte reste noir. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .morale-kpi,.challenge-clock,.warning,.danger,.success,.attention,.active-disruption,
  .territory-notice,.setup-error,.cheat-badge,.event-badge,.status-badge
){color:#111!important}

/* Contrôles MapLibre : blancs + symboles noirs. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .maplibregl-ctrl-group,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .maplibregl-ctrl-group button{
  background:#fff!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .maplibregl-ctrl-group button span{
  filter:brightness(0)!important
}

/* Overlays hors .game-shell : mêmes règles de lisibilité. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .search-hub,.bilan-shell,.borrow-confirmation-dialog,.help-center,.share-panel,.editor-export-panel,
  .legal-modal,.cookie-banner,.cookie-panel
){background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.14)!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .search-hub,.bilan-shell,.borrow-confirmation-dialog,.help-center,.share-panel,.editor-export-panel,
  .legal-modal,.cookie-banner,.cookie-panel
) :is(button,b,strong,span,label,small,p,em,i,summary,dt,dd,h1,h2,h3,h4){color:#111!important;text-shadow:none!important}


/* Compléments setup : la copie à côté de l'image doit elle aussi être sombre sur blanc. */
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .setup-topbar{
  background:rgba(255,255,255,.96)!important;
  border:1px solid rgba(0,0,0,.12)!important;
  border-radius:18px!important;
  padding:0 12px!important;
  box-shadow:0 8px 24px rgba(0,0,0,.08)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup :is(
  .setup-brand b,.setup-brand span,.setup-heading span,.setup-heading strong,
  .territory-hero__copy h1,.territory-hero__copy p,.territory-traits span
){color:#111!important;opacity:1!important;text-shadow:none!important}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .territory-traits span{
  background:#f4f5f6!important;border-color:rgba(0,0,0,.10)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .territory-notice{
  background:#f5f0ff!important;border-color:#d7caef!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='setup'] .setup .setup-error{
  background:#ffecee!important;border-color:#efb9bf!important;color:#111!important
}

/* Couleurs fonctionnelles conservées en fonds légers, avec texte noir. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(.warning,.attention,.active-disruption){
  background:#fff3d6!important;border-color:#e4c47b!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(.danger,.error){
  background:#ffe8ea!important;border-color:#e9a7ae!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(.success,.positive){
  background:#e8f7ed!important;border-color:#abd9bb!important;color:#111!important
}


/* Menus clairs ouverts depuis l'accueil : eux restent clairs, avec texte noir. */
html[data-clu-game-theme='light'] :is(.settings-panel,.help-center,.legal-modal,.cookie-banner,.cookie-panel){
  color:#111!important;
}
html[data-clu-game-theme='light'] :is(.settings-panel,.help-center,.legal-modal,.cookie-banner,.cookie-panel) :is(
  button,b,strong,span,label,small,p,em,i,summary,dt,dd,h1,h2,h3,h4,li
){
  color:#111!important;
  text-shadow:none!important;
}


/* ==========================================================================
   Thème clair V4 — passe exhaustive des surfaces résiduelles.
   L'arrière-plan d'accueil et les trois gros boutons conservent leur identité.
   Tout composant secondaire / panneau / dialogue devient blanc + texte noir.
   ========================================================================== */

/* ACCUEIL : fond et grands lanceurs inchangés, contrôles secondaires blancs. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] :is(
  .legal-entry,.locale-picker__trigger,.home-utilities button,.home-utilities a,.latest-card
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.16)!important;
  box-shadow:0 10px 28px rgba(0,0,0,.14)!important;
  backdrop-filter:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] :is(
  .legal-entry,.home-utilities button,.home-utilities a,.latest-card
) :is(b,strong,span,small,em,i){
  color:#111!important;
  text-shadow:none!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .legal-entry>span,
html[data-clu-game-theme='light'][data-clu-game-view='home'] .utility-icon{
  background:#f1f3f4!important;
  color:#111!important;
  border-color:rgba(0,0,0,.10)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card::before{display:none!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card__header i{background:linear-gradient(90deg,#111,transparent)!important;box-shadow:none!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card__stats>div+div{border-left-color:rgba(0,0,0,.12)!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card__preview{
  border-color:rgba(0,0,0,.15)!important;
  /* La miniature de carte reste une vraie carte sombre. */
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card__continue{
  background:#54dce8!important;color:#111!important;border-color:#33c6d3!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .latest-card__continue :is(span,b){color:#111!important}

/* Langue : bouton blanc et menu blanc, le drapeau garde évidemment ses couleurs. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] .locale-picker__menu{
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.16)!important;
  box-shadow:0 16px 42px rgba(0,0,0,.18)!important;
  backdrop-filter:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .locale-picker__menu button{
  background:#fff!important;color:#111!important;border-color:transparent!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .locale-picker__menu button:hover{background:#f2f3f4!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .locale-picker__menu button.active{
  background:#e9fbfd!important;border-color:#7edce5!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .locale-picker__menu button b{color:#111!important}

/* Fenêtres ouvertes depuis l'accueil : Sauvegardes / Défi / Paramètres. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] :is(.dialog,.dialog--settings,.dialog--challenge,.dialog--saves),
html[data-clu-game-theme='light'][data-clu-game-view='home'] :is(.dialog__header,.dialog__body){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.13)!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .dialog :is(h1,h2,h3,h4,b,strong,span,small,p,em,i,label,li,dt,dd,button){
  color:#111!important;
  text-shadow:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .dialog__header button{
  background:#f3f4f5!important;color:#111!important;border-color:rgba(0,0,0,.14)!important
}

/* Défi du jour : conserver l'identité or, mais sur des surfaces claires. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel :is(.daily-facts article,.daily-grid>div){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.13)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel .daily-hero{
  background:#fff9e8!important;color:#111!important;border-color:#e3c46b!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel .daily-mark,
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel .daily-hero>b{
  background:#f8e8ad!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel :is(.daily-hero p,.daily-grid li b){color:#7a5b00!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel :is(.daily-hero small,.daily-facts span,.daily-facts small,.daily-grid h4,.daily-grid li span,.daily-actions>span){color:#444!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel .daily-actions button{
  background:#f6dc83!important;color:#111!important;border-color:#d1aa31!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .daily-panel .daily-actions button b{color:#111!important}

/* Sauvegardes : aucune carte bleu nuit. */
html[data-clu-game-theme='light'][data-clu-game-view='home'] .saves-panel :is(
  .saves-hero,.save-folders button,.save-search,.save-card,.saves-empty,.save-rename input
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.14)!important;
  box-shadow:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .saves-panel :is(
  .saves-hero,.save-folders button,.save-search,.save-card,.saves-empty
) :is(b,strong,span,small,p,em,i,label,button){color:#111!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-folders button.active{
  background:#e9fbfd!important;border-color:#55cbd6!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-card__side{
  background:#f0f6f7!important;color:#111!important;border:1px solid rgba(0,0,0,.08)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-card__chips span{
  background:#f1f2f3!important;color:#111!important;border-color:rgba(0,0,0,.08)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-card__load,
html[data-clu-game-theme='light'][data-clu-game-view='home'] .saves-import{
  background:#dff8fb!important;color:#111!important;border-color:#6ed7e0!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-card__secondary-actions button{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.16)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='home'] .save-card__delete{color:#a92e38!important}

/* Paramètres : tout le contenu devient réellement blanc. */
html[data-clu-game-theme='light'] .settings-panel{
  color:#111!important;
}
html[data-clu-game-theme='light'] .settings-panel :is(
  .settings-hero,.settings-section,.option-grid button,.toggle-grid label,.audio-row,
  .help-settings-row,.theme-switch button,.settings-footer button
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.14)!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
}
html[data-clu-game-theme='light'] .settings-panel :is(
  .settings-hero,.settings-section,.option-grid button,.toggle-grid label,.audio-row,
  .help-settings-row,.theme-switch button,.settings-footer
) :is(h1,h2,h3,h4,b,strong,span,small,p,em,i,label,button){
  color:#111!important;opacity:1!important;text-shadow:none!important
}
html[data-clu-game-theme='light'] .settings-panel :is(.option-grid button.active,.theme-switch button.active){
  background:#e9fbfd!important;border-color:#4ec9d5!important
}
html[data-clu-game-theme='light'] .settings-panel input[type='range']{
  accent-color:#111!important
}
html[data-clu-game-theme='light'] .settings-panel input[type='checkbox']{accent-color:#111!important}

/* PARTIE : surfaces qui échappaient encore au thème clair. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .divers-panel,.commune-card,.map-insight-legend,.world-pulse .pulse-empty,.world-pulse .pulse-card,
  .clu-dialog-card,.result-card
){
  background:#fff!important;
  color:#111!important;
  border-color:rgba(0,0,0,.15)!important;
  box-shadow:0 10px 28px rgba(0,0,0,.12)!important;
  backdrop-filter:none!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .divers-panel,.commune-card,.map-insight-legend,.world-pulse .pulse-empty,.world-pulse .pulse-card,
  .clu-dialog-card,.result-card
) :is(h1,h2,h3,h4,b,strong,span,small,p,em,i,label,button,dt,dd){
  color:#111!important;
  text-shadow:none!important;
  opacity:1!important;
}

/* Divers : cartes blanches, pictogrammes noirs. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .divers-panel header>button,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .divers-panel .tool-card{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.16)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .divers-panel .tool-card:hover{background:#f4f5f6!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .divers-panel .tool-card i{
  background:#f0f2f3!important;color:#111!important;border:1px solid rgba(0,0,0,.08)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .divers-panel .tool-card>b{
  background:#e7f7ed!important;color:#111!important
}

/* Fiche commune : blanc jusque dans les métriques. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card__header{
  background:#fff!important;border-bottom-color:rgba(0,0,0,.12)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card__header button{
  background:#f1f2f3!important;color:#111!important;border-color:rgba(0,0,0,.13)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card__content>div:not(.commune-live-item){
  background:#f3f4f5!important;color:#111!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card__content :is(span,strong,small){color:#111!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card .commune-build-action{
  background:#dff8fb!important;color:#111!important;border-color:#73d7df!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card .commune-live-item{
  background:#eaf8ef!important;color:#111!important;border-color:#acd9bb!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .commune-card .commune-live-item--event{
  background:#fff3df!important;border-color:#e3c184!important
}

/* Légende de lecture du territoire / flux : plus de cartouche noir illisible. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .map-insight-legend{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.16)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .map-insight-legend :is(strong,span){color:#111!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .reset-view{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.16)!important
}

/* Actions / gestion : blanc et glyphes noirs. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .management-hub{
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.15)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .management-hub :is(button,.hub-item){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.12)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .management-hub :is(button,.hub-item):hover{background:#f3f4f5!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .management-hub :is(i,b,em,span,strong,small){color:#111!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .management-hub i{background:#f0f2f3!important}

/* Recherche / Explorer : les sous-modules eux aussi passent en clair. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .search-hub,.search-module,.module-results,.endpoint-results,.mini-route,.journey-board,
  .service-hero,.departure-tabs,.journey-alternatives,.line-board-station
){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.14)!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .search-hub,.search-module,.module-results,.endpoint-results,.mini-route,.journey-board,
  .service-hero,.departure-tabs,.journey-alternatives,.line-board-station
) :is(h1,h2,h3,h4,b,strong,span,small,p,em,i,label,button){color:#111!important;opacity:1!important}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(.module-input,.endpoint-input,.line-board-station select){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.18)!important
}

/* Wiki, Bilan, exports et inspecteurs : cartes internes neutralisées. */
html[data-clu-game-theme='light'] :is(.help-center,.bilan-shell,.share-panel,.editor-export-panel,.assistant-panel,.station-inspector,.vehicle-inspector,.legal-modal,.cookie-panel) :is(
  article,section,details,fieldset,.help-nav,.help-article,.steps-block,.tips-block,.related button,
  .bilan-card,.summary-card,.info-card,.identity-preview,.preview-copy,.options-grid>*,.route-shortcuts button,.service-actions button
){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.13)!important
}
html[data-clu-game-theme='light'] :is(.help-center,.bilan-shell,.share-panel,.editor-export-panel,.assistant-panel,.station-inspector,.vehicle-inspector,.legal-modal,.cookie-panel) :is(
  h1,h2,h3,h4,b,strong,span,small,p,em,i,label,button,li,dt,dd,summary
){color:#111!important;text-shadow:none!important;opacity:1!important}

/* Fenêtres de défi / résultats / online hors accueil. */
html[data-clu-game-theme='light'] :is(.result-card,.online-panel,.clu-dialog-card){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.15)!important
}
html[data-clu-game-theme='light'] :is(.result-card,.online-panel,.clu-dialog-card) :is(input,select,textarea,button){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.16)!important
}

/* Inputs / selects sombres restants dans les panneaux en jeu. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] :is(
  .side-panel,.divers-panel,.management-hub,.search-hub,.bilan-shell,.assistant-panel,
  .station-inspector,.vehicle-inspector,.share-panel,.editor-export-panel,.help-center
) :is(input,select,textarea){
  background:#fff!important;color:#111!important;border-color:rgba(0,0,0,.20)!important;color-scheme:light!important
}

/* Le texte secondaire est gris foncé, jamais blanc/pâle sur blanc. */
html[data-clu-game-theme='light'] :is(
  .dialog,.settings-panel,.daily-panel,.saves-panel,.divers-panel,.commune-card,.map-insight-legend,
  .management-hub,.side-panel,.search-hub,.help-center,.bilan-shell,.assistant-panel,
  .station-inspector,.vehicle-inspector,.share-panel,.editor-export-panel,.legal-modal
) :is(.muted,.hint,[class*='subtitle'],[class*='description']){
  color:#444!important;opacity:1!important
}


/* ==========================================================================
   Thème clair V5 — conserver les couleurs fonctionnelles du jeu.
   Le thème clair change les surfaces, jamais le sens visuel des états.
   ========================================================================== */
html[data-clu-game-theme='light']{
  --clu-light-danger:#b4232e;
  --clu-light-danger-bg:#fff0f1;
  --clu-light-danger-border:#df8790;
  --clu-light-warning:#8a5a00;
  --clu-light-warning-bg:#fff6df;
  --clu-light-warning-border:#dfbd69;
  --clu-light-success:#157a46;
  --clu-light-success-bg:#eaf8ef;
  --clu-light-success-border:#8ccca6;
  --clu-light-info:#087985;
  --clu-light-info-bg:#e8f9fb;
  --clu-light-info-border:#70cbd3;
}

/* Dette / déficit / argent sortant : rouge explicite. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .debt,
  .negative,
  .money-out,
  .financial-pulse.negative,
  .debt-kpi-button strong,
  .project-preview-over b,
  .project-preview-over em,
  .danger-edit,
  .borrow-inline-error,
  .feedback-error,
  .debt-bankrupt
){
  color:var(--clu-light-danger)!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .debt-kpi-button{
  background:var(--clu-light-danger-bg)!important;
  border-color:var(--clu-light-danger-border)!important;
  box-shadow:inset 3px 0 0 var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .debt-kpi-button small{
  color:#6f2028!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-preview-over{
  background:var(--clu-light-danger-bg)!important;
  border-color:var(--clu-light-danger-border)!important;
  box-shadow:inset 0 0 0 1px var(--clu-light-danger-border)!important;
}

/* Projet trop cher : le manque d'argent reste impossible à rater en thème clair. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card{
  background:#fff8f8!important;
  border-color:#e3a2a8!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card .project-financing-kicker,
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card .project-financing-missing{
  color:var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card.blocked{
  background:#ffecee!important;
  border-color:#d96a74!important;
  box-shadow:inset 4px 0 0 var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card :is(.project-financing-figure,.project-financing-meta span,.project-financing-unavailable span){
  background:#fff!important;
  border-color:rgba(180,35,46,.20)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .project-financing-card .project-financing-figure strong{
  color:var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .launch-config-summary strong.debt{
  color:var(--clu-light-danger)!important;
  background:var(--clu-light-danger-bg)!important;
  border:1px solid var(--clu-light-danger-border)!important;
  border-radius:7px!important;
  padding:2px 6px!important;
}

/* Erreurs franches : fond rouge pâle, bordure et texte rouges. */
html[data-clu-game-theme='light'] :is(
  .build-warning,
  .debt-bankrupt,
  .borrow-inline-error,
  .feedback-error,
  .setup-error,
  .error
){
  background:var(--clu-light-danger-bg)!important;
  border-color:var(--clu-light-danger-border)!important;
  color:var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'] :is(.build-warning,.debt-bankrupt,.borrow-inline-error,.feedback-error,.setup-error,.error) :is(
  b,strong,span,small,p,em,i
){
  color:var(--clu-light-danger)!important;
}

/* Avertissements : ambre, pas noir uniforme. */
html[data-clu-game-theme='light'] :is(
  .warning,
  .attention,
  .active-disruption,
  .launch-warning,
  .project-warning,
  .debt-warning,
  .pause-entry-notice--warning,
  .line-finance-card.finance-warning
){
  background:var(--clu-light-warning-bg)!important;
  border-color:var(--clu-light-warning-border)!important;
}
html[data-clu-game-theme='light'] :is(
  .launch-warning,
  .project-warning,
  .debt-warning,
  .pause-entry-notice--warning,
  .line-finance-card.finance-warning
) :is(b,strong,span,small,p,em,i),
html[data-clu-game-theme='light'] :is(.launch-warning,.debt-warning,.pause-entry-notice--warning){
  color:var(--clu-light-warning)!important;
}

/* Recettes / amélioration / succès : vert visible. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell :is(
  .positive,
  .money-in,
  .financial-pulse.positive
){
  color:var(--clu-light-success)!important;
  opacity:1!important;
}
html[data-clu-game-theme='light'] :is(.success,.positive,.line-finance-card.finance-positive){
  border-color:var(--clu-light-success-border)!important;
}
html[data-clu-game-theme='light'] .line-finance-card.finance-positive{
  background:var(--clu-light-success-bg)!important;
}

/* Moral : conserver sa lecture couleur comme en sombre, avec contraste adapté au blanc. */
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-very-happy{
  background:#e2f6e9!important;border-color:#82c69c!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-happy{
  background:#edf7e8!important;border-color:#a7cb8d!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-medium{
  background:#fff7d9!important;border-color:#dfc65d!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-tense{
  background:#fff0df!important;border-color:#e2a765!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-unhappy{
  background:#ffe9e9!important;border-color:#dc8a8a!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-critical{
  background:#ffdfe1!important;border-color:#cd666f!important
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-kpi:is(.morale-unhappy,.morale-critical) :is(strong,span,b){
  color:#9d1f2b!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-kpi.morale-tense :is(strong,span,b){
  color:#8b4a00!important;
}
html[data-clu-game-theme='light'][data-clu-game-view='playing'] .game-shell .morale-kpi:is(.morale-happy,.morale-very-happy) :is(strong,span,b){
  color:#17653c!important;
}

/* Actions/sélections gardent le cyan : il indique une action, pas une surface sombre. */
html[data-clu-game-theme='light'] :is(
  .primary,
  .finance-action,
  .confirm,
  .recommended,
  .day-next-inline,
  .launch-start
){
  border-color:var(--clu-light-info-border)!important;
}

/* Les boutons destructifs restent rouges. */
html[data-clu-game-theme='light'] :is(.line-delete-button,.save-card__delete,.danger-edit){
  color:var(--clu-light-danger)!important;
}
html[data-clu-game-theme='light'] .line-delete-button{
  border-color:var(--clu-light-danger-border)!important;
  background:var(--clu-light-danger-bg)!important;
}

</style>
