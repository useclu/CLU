<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  territoryName: string
  message: string
  progress: number
  error?: string | null
  reducedMotion?: boolean
}>()

const emit = defineEmits<{
  retry: []
  back: []
}>()

const normalizedProgress = computed(() => Math.max(0, Math.min(100, Math.round(props.progress))))
const phases = ['Territoire', 'Carte', 'Réseau', 'Simulation'] as const
const phaseIndex = computed(() => {
  if (normalizedProgress.value < 25) return 0
  if (normalizedProgress.value < 55) return 1
  if (normalizedProgress.value < 82) return 2
  return 3
})
const phaseLabel = computed(() => phases[phaseIndex.value])
const phaseCounter = computed(() => `${phaseIndex.value + 1} / ${phases.length}`)
const phaseHint = computed(() => {
  switch (phaseIndex.value) {
    case 0: return 'Préparation du territoire et des données locales.'
    case 1: return 'Assemblage de la carte et des communes.'
    case 2: return 'Initialisation des données du réseau.'
    default: return 'Finalisation de la simulation avant ouverture.'
  }
})
const ringStyle = computed(() => ({ '--loader-progress': `${normalizedProgress.value * 3.6}deg` }))
</script>

<template>
  <section
    class="game-loader"
    :class="{
      'game-loader--error': Boolean(error),
      'game-loader--reduced': reducedMotion,
    }"
    role="status"
    aria-live="polite"
  >
    <div class="game-loader__art" aria-hidden="true">
      <div class="game-loader__art-image" />
      <div class="game-loader__art-shade" />
      <div class="game-loader__art-grain" />
    </div>

    <aside v-if="!error" class="game-loader__panel">
      <header class="game-loader__brand">
        <b>CLU</b>
        <span>Métropole</span>
      </header>

      <div class="game-loader__content">
        <div class="game-loader__heading">
          <p class="game-loader__kicker">Préparation de la partie</p>
          <span>{{ phaseCounter }}</span>
        </div>
        <h1>{{ territoryName }}</h1>

        <div class="game-loader__status">
          <span class="game-loader__status-dot" aria-hidden="true" />
          <p>{{ message }}</p>
        </div>

        <div class="game-loader__progress-block">
          <div class="game-loader__ring" :style="ringStyle">
            <div class="game-loader__ring-core">
              <strong>{{ normalizedProgress }}</strong>
              <span>%</span>
            </div>
          </div>

          <div class="game-loader__phase-copy">
            <small>En cours</small>
            <strong>{{ phaseLabel }}</strong>
            <span>{{ phaseHint }}</span>
          </div>
        </div>

        <ol class="game-loader__phases" aria-label="Progression du chargement">
          <li
            v-for="(phase, index) in phases"
            :key="phase"
            :class="{
              done: index < phaseIndex,
              active: index === phaseIndex,
            }"
          >
            <span class="game-loader__phase-state" aria-hidden="true">
              <b v-if="index < phaseIndex">✓</b>
              <b v-else>{{ index + 1 }}</b>
            </span>
            <span class="game-loader__phase-name">{{ phase }}</span>
            <small v-if="index < phaseIndex">Prêt</small>
            <small v-else-if="index === phaseIndex">En cours</small>
          </li>
        </ol>
      </div>

      <footer class="game-loader__footer">
        <span class="game-loader__activity"><i /> Chargement local</span>
        <small>Aucune action nécessaire — la partie s’ouvre automatiquement.</small>
      </footer>
    </aside>

    <main v-else class="game-loader__error-panel">
      <div class="game-loader__brand game-loader__brand--error">
        <b>CLU</b>
        <span>Métropole</span>
      </div>
      <span class="game-loader__error-icon">!</span>
      <p class="game-loader__kicker">Chargement interrompu</p>
      <h1>Impossible de préparer la carte.</h1>
      <p class="game-loader__error-message">{{ error }}</p>
      <div class="game-loader__error-actions">
        <button type="button" class="primary" @click="emit('retry')">Réessayer</button>
        <button type="button" @click="emit('back')">Retour au menu</button>
      </div>
    </main>
  </section>
</template>

<style scoped>
.game-loader{
  position:absolute;inset:0;z-index:250;overflow:hidden;background:#071018;color:#f3f8fb;
  font-family:"Avenir Next",Montserrat,"Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif;isolation:isolate;
}

.game-loader__art{position:absolute;inset:0;z-index:-2;overflow:hidden}
.game-loader__art-image{
  position:absolute;inset:-2%;background:url('../../arriereplan.png') 62% 50%/cover no-repeat;
  filter:saturate(.92) brightness(.78) contrast(1.03);transform:scale(1.025);animation:art-breathe 18s ease-in-out infinite alternate;
}
.game-loader__art-shade{
  position:absolute;inset:0;
  background:linear-gradient(90deg,#071018 0%,rgba(7,16,24,.985) 27%,rgba(7,16,24,.86) 38%,rgba(7,16,24,.36) 58%,rgba(7,16,24,.08) 100%),
             linear-gradient(180deg,rgba(5,10,15,.16),rgba(5,10,15,.04) 62%,rgba(5,10,15,.38));
}
.game-loader__art-grain{
  position:absolute;inset:0;opacity:.1;background-image:radial-gradient(rgba(255,255,255,.13) .65px,transparent .75px);
  background-size:6px 6px;mask-image:linear-gradient(90deg,#000,transparent 55%);
}

.game-loader__panel{
  position:relative;width:min(535px,44vw);height:100%;min-height:0;box-sizing:border-box;
  padding:clamp(24px,4.5vh,46px) clamp(34px,4vw,54px) clamp(22px,3.5vh,34px);
  display:flex;flex-direction:column;
}
.game-loader__panel::after{
  content:'';position:absolute;top:11%;bottom:11%;right:0;width:1px;
  background:linear-gradient(180deg,transparent,rgba(142,220,226,.16) 34%,rgba(142,220,226,.06) 72%,transparent);
}

.game-loader__brand{display:flex;align-items:baseline;gap:9px;width:max-content}
.game-loader__brand b{font-size:clamp(29px,3vw,42px);line-height:.86;letter-spacing:-.07em;font-weight:950}
.game-loader__brand span{font-size:clamp(11px,.95vw,14px);font-weight:720;color:rgba(232,245,250,.58)}

.game-loader__content{margin:auto 0;padding:20px 0 18px;max-width:430px}
.game-loader__heading{display:flex;align-items:center;gap:10px;margin-bottom:7px}
.game-loader__heading>span{color:rgba(221,240,246,.34);font-size:9px;font-weight:800;letter-spacing:.12em}
.game-loader__kicker{margin:0;color:#72dfe5;font-size:9px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
.game-loader h1{
  margin:0;max-width:430px;font-size:clamp(30px,3vw,42px);line-height:1.02;letter-spacing:-.045em;font-weight:780;
  text-wrap:balance;
}
.game-loader__status{display:flex;align-items:flex-start;gap:9px;margin-top:14px;min-height:22px}
.game-loader__status-dot{flex:0 0 auto;width:6px;height:6px;margin-top:6px;border-radius:50%;background:#72dfe5;box-shadow:0 0 9px rgba(114,223,229,.42);animation:activity-pulse 1.35s ease-in-out infinite}
.game-loader__status p{margin:0;color:rgba(235,247,251,.66);font-size:11px;line-height:1.55}

.game-loader__progress-block{
  display:grid;grid-template-columns:78px minmax(0,1fr);gap:16px;align-items:center;margin-top:24px;padding-bottom:20px;
  border-bottom:1px solid rgba(255,255,255,.065);
}
.game-loader__ring{
  --loader-progress:0deg;position:relative;width:72px;height:72px;border-radius:50%;display:grid;place-items:center;
  background:conic-gradient(#68dfe5 var(--loader-progress),rgba(255,255,255,.08) 0);transition:background .3s ease;
}
.game-loader__ring::before{content:'';position:absolute;inset:6px;border-radius:50%;background:#0a151e;border:1px solid rgba(255,255,255,.055)}
.game-loader__ring-core{position:relative;z-index:1;display:flex;align-items:baseline;gap:2px}
.game-loader__ring-core strong{font-size:24px;line-height:1;letter-spacing:-.06em}
.game-loader__ring-core span{font-size:9px;color:rgba(240,250,252,.5)}
.game-loader__phase-copy{display:grid;gap:3px;min-width:0}
.game-loader__phase-copy small{color:rgba(235,247,250,.38);font-size:8px;font-weight:850;letter-spacing:.11em;text-transform:uppercase}
.game-loader__phase-copy strong{font-size:16px;letter-spacing:-.02em}
.game-loader__phase-copy span{margin-top:1px;color:rgba(235,247,250,.46);font-size:9.5px;line-height:1.45}

.game-loader__phases{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:0}
.game-loader__phases li{
  position:relative;min-height:34px;display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;
  color:rgba(235,247,250,.27);
}
.game-loader__phases li:not(:last-child)::after{
  content:'';position:absolute;left:13px;top:25px;width:1px;height:18px;background:rgba(255,255,255,.07);
}
.game-loader__phases li.done{color:rgba(235,247,250,.58)}
.game-loader__phases li.active{color:#f5fcff}
.game-loader__phase-state{
  display:grid;place-items:center;width:27px;height:27px;border-radius:50%;border:1px solid rgba(255,255,255,.08);
  background:#0b1720;color:rgba(235,247,250,.35);box-sizing:border-box;
}
.game-loader__phase-state b{font-size:8px;letter-spacing:.02em}
.game-loader__phases li.done .game-loader__phase-state{color:#77dce1;border-color:rgba(95,213,220,.24);background:rgba(74,197,205,.07)}
.game-loader__phases li.active .game-loader__phase-state{color:#071018;border-color:#70dfe4;background:#70dfe4;box-shadow:0 0 0 4px rgba(112,223,228,.07)}
.game-loader__phase-name{font-size:10.5px;font-weight:730}
.game-loader__phases li>small{font-size:8px;color:rgba(235,247,250,.3)}
.game-loader__phases li.done>small{color:rgba(117,221,226,.5)}
.game-loader__phases li.active>small{color:#79dfe4}

.game-loader__footer{display:grid;gap:7px;padding-top:15px;border-top:1px solid rgba(255,255,255,.06)}
.game-loader__activity{display:flex;align-items:center;gap:7px;color:rgba(237,249,252,.62);font-size:8.5px;font-weight:820;letter-spacing:.08em;text-transform:uppercase}
.game-loader__activity i{width:5px;height:5px;border-radius:50%;background:#71dfe4;animation:activity-pulse 1.35s ease-in-out infinite}
.game-loader__footer small{max-width:350px;color:rgba(235,247,250,.31);font-size:8.5px;line-height:1.45}

.game-loader__error-panel{
  position:absolute;left:clamp(24px,5vw,70px);top:50%;width:min(420px,calc(100vw - 48px));transform:translateY(-50%);
  padding:26px;border-radius:16px;background:rgba(8,17,25,.94);border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 55px rgba(0,0,0,.32);
}
.game-loader__brand--error{margin-bottom:30px}
.game-loader__error-icon{display:grid;place-items:center;width:32px;height:32px;margin-bottom:14px;border-radius:9px;color:#ffb4b4;background:rgba(225,75,75,.11);border:1px solid rgba(225,75,75,.2);font-weight:900}
.game-loader__error-panel h1{font-size:clamp(27px,3vw,38px)}
.game-loader__error-message{margin:13px 0 0;color:rgba(238,248,251,.58);font-size:11px;line-height:1.55}
.game-loader__error-actions{display:flex;gap:8px;margin-top:20px}
.game-loader__error-actions button{min-height:38px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);color:inherit;font:inherit;font-size:10.5px;font-weight:750;cursor:pointer}
.game-loader__error-actions .primary{color:#071018;border-color:#70dfe4;background:#70dfe4}

@keyframes art-breathe{from{transform:scale(1.025) translate3d(0,0,0)}to{transform:scale(1.045) translate3d(-.3%,.15%,0)}}
@keyframes activity-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.72)}}
.game-loader--reduced *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
.game-loader--error .game-loader__art-image{filter:saturate(.55) brightness(.42) contrast(1.08)}

@media(max-height:650px) and (min-width:721px){
  .game-loader__panel{width:min(520px,44vw);padding-top:22px;padding-bottom:18px}
  .game-loader__content{padding:12px 0 10px}
  .game-loader__brand b{font-size:36px}
  .game-loader h1{font-size:clamp(28px,2.7vw,37px)}
  .game-loader__status{margin-top:10px}
  .game-loader__progress-block{margin-top:17px;padding-bottom:14px}
  .game-loader__phases{margin-top:12px}
  .game-loader__phases li{min-height:31px}
  .game-loader__phases li:not(:last-child)::after{height:15px}
  .game-loader__footer{padding-top:11px}
}

@media(max-width:820px){
  .game-loader__art-image{background-position:67% 50%}
  .game-loader__art-shade{background:linear-gradient(180deg,rgba(7,16,24,.28),rgba(7,16,24,.5) 44%,rgba(7,16,24,.94) 73%,#071018 100%)}
  .game-loader__art-grain{mask-image:linear-gradient(180deg,transparent 24%,#000 100%)}
  .game-loader__panel{width:100%;padding:22px 22px 18px;justify-content:flex-end}
  .game-loader__panel::after{display:none}
  .game-loader__brand{position:absolute;top:20px;left:22px}
  .game-loader__content{width:min(540px,100%);max-width:none;margin:0;padding:0 0 14px}
  .game-loader h1{max-width:none;font-size:clamp(28px,7.5vw,40px)}
  .game-loader__phases{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
  .game-loader__phases li{min-height:56px;grid-template-columns:1fr;justify-items:start;align-content:center;gap:3px;padding:7px;border:1px solid rgba(255,255,255,.05);border-radius:9px;background:rgba(5,12,18,.18)}
  .game-loader__phases li:not(:last-child)::after{display:none}
  .game-loader__phases li>small{display:none}
  .game-loader__phase-name{font-size:8.5px}
  .game-loader__phase-state{width:23px;height:23px}
  .game-loader__footer{padding-top:12px}
}

@media(max-width:480px){
  .game-loader__panel{padding-left:16px;padding-right:16px}
  .game-loader__brand{left:16px}
  .game-loader__progress-block{grid-template-columns:68px minmax(0,1fr);gap:11px}
  .game-loader__ring{width:64px;height:64px}
  .game-loader__ring-core strong{font-size:21px}
  .game-loader__phase-copy span{display:none}
  .game-loader__footer small{display:none}
}
</style>
