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
const phaseLabel = computed(() => {
  if (normalizedProgress.value < 25) return 'Territoire'
  if (normalizedProgress.value < 55) return 'Cartographie'
  if (normalizedProgress.value < 82) return 'Réseau'
  return 'Simulation'
})
</script>

<template>
  <section class="game-loader" :class="{ 'game-loader--error': Boolean(error), 'game-loader--reduced': reducedMotion }" role="status" aria-live="polite">
    <div class="game-loader__aurora game-loader__aurora--a" />
    <div class="game-loader__aurora game-loader__aurora--b" />
    <div class="game-loader__grid" />

    <div class="game-loader__route" aria-hidden="true">
      <svg viewBox="0 0 880 280" preserveAspectRatio="none">
        <path class="route route--ghost" d="M-50 205 C105 214 116 54 267 86 S439 246 565 163 S728 36 940 83" />
        <path class="route route--main" d="M-50 205 C105 214 116 54 267 86 S439 246 565 163 S728 36 940 83" />
        <path class="route route--secondary" d="M55 294 C177 201 207 207 316 154 S496 30 596 86 S738 226 904 174" />
        <g class="route-stations">
          <circle cx="105" cy="176" r="5"/><circle cx="267" cy="86" r="5"/><circle cx="434" cy="209" r="5"/><circle cx="565" cy="163" r="5"/><circle cx="722" cy="68" r="5"/>
        </g>
        <circle class="route-train" r="10" :cx="reducedMotion ? 565 : undefined" :cy="reducedMotion ? 163 : undefined">
          <animateMotion v-if="!reducedMotion" dur="5.2s" repeatCount="indefinite" path="M-50 205 C105 214 116 54 267 86 S439 246 565 163 S728 36 940 83" />
        </circle>
      </svg>
    </div>

    <div class="game-loader__content">
      <header class="game-loader__brand">
        <div class="game-loader__logo">CLU</div>
        <div>
          <span>CLU Métropole</span>
          <strong>{{ territoryName }}</strong>
        </div>
      </header>

      <div v-if="!error" class="game-loader__main">
        <div class="game-loader__pulse" aria-hidden="true">
          <span /><span /><span />
          <b>↗</b>
        </div>

        <p class="game-loader__eyebrow">{{ phaseLabel }} · préparation en cours</p>
        <h1>Votre réseau prend place.</h1>
        <p class="game-loader__message">{{ message }}</p>

        <div class="game-loader__progress-wrap">
          <div class="game-loader__progress-head">
            <span>{{ normalizedProgress }}%</span>
            <small>La partie s’ouvre uniquement quand la carte est prête.</small>
          </div>
          <div class="game-loader__progress"><i :style="{ width: `${normalizedProgress}%` }" /></div>
        </div>

        <div class="game-loader__steps" aria-hidden="true">
          <span :class="{ done: normalizedProgress >= 20 }">Territoire</span>
          <span :class="{ done: normalizedProgress >= 48 }">Carte</span>
          <span :class="{ done: normalizedProgress >= 76 }">Réseau</span>
          <span :class="{ done: normalizedProgress >= 96 }">Simulation</span>
        </div>
      </div>

      <div v-else class="game-loader__error">
        <span class="game-loader__error-icon">!</span>
        <p class="game-loader__eyebrow">Chargement interrompu</p>
        <h1>La carte n’a pas pu être préparée.</h1>
        <p>{{ error }}</p>
        <div class="game-loader__error-actions">
          <button type="button" class="primary" @click="emit('retry')">↻ Réessayer</button>
          <button type="button" @click="emit('back')">Retour au menu</button>
        </div>
      </div>
    </div>

    <footer v-if="!error" class="game-loader__footer">
      <span class="game-loader__live"><i /> Chargement local</span>
      <span>Territoire, données de simulation et rendu cartographique sont préparés avant l’ouverture.</span>
    </footer>
  </section>
</template>

<style scoped>
.game-loader{position:absolute;inset:0;z-index:250;overflow:hidden;background:radial-gradient(circle at 50% 16%,#132830 0,#0a141b 38%,#060b10 78%);color:#eef8fa;display:grid;grid-template-rows:1fr auto;isolation:isolate;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.game-loader__aurora{position:absolute;width:54vw;height:54vw;border-radius:999px;filter:blur(80px);opacity:.2;pointer-events:none}.game-loader__aurora--a{left:-18vw;top:-28vw;background:#3ce0e4;animation:aurora-a 8s ease-in-out infinite alternate}.game-loader__aurora--b{right:-22vw;bottom:-32vw;background:#725cf2;animation:aurora-b 10s ease-in-out infinite alternate}.game-loader__grid{position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(154,223,229,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(154,223,229,.045) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.8),transparent 86%);transform:perspective(580px) rotateX(58deg) scale(1.5) translateY(18%);transform-origin:center bottom}.game-loader__route{position:absolute;left:0;right:0;top:8%;height:48%;opacity:.8;pointer-events:none}.game-loader__route svg{width:100%;height:100%;overflow:visible}.route{fill:none;stroke-linecap:round;stroke-linejoin:round}.route--ghost{stroke:#02070a;stroke-width:14;opacity:.7}.route--main{stroke:#5ce4ea;stroke-width:4;stroke-dasharray:13 12;animation:route-flow 2.6s linear infinite}.route--secondary{stroke:#8678fa;stroke-width:2.4;opacity:.28;stroke-dasharray:5 14;animation:route-flow 5s linear infinite reverse}.route-stations circle{fill:#132128;stroke:#eaffff;stroke-width:2.5}.route-train{fill:#05080b;stroke:#80f2f3;stroke-width:3;filter:drop-shadow(0 0 12px rgba(92,228,234,.85))}.game-loader__content{position:relative;z-index:3;width:min(760px,calc(100vw - 42px));margin:auto;padding:42px 0 76px}.game-loader__brand{display:flex;align-items:center;gap:13px;margin-bottom:72px}.game-loader__logo{display:grid;place-items:center;width:56px;height:56px;border-radius:17px;border:1px solid rgba(137,238,242,.35);background:rgba(9,22,28,.82);box-shadow:inset 0 0 24px rgba(85,219,226,.06),0 14px 40px rgba(0,0,0,.25);font-weight:950;letter-spacing:.07em}.game-loader__brand>div:last-child{display:grid;gap:2px}.game-loader__brand span{font-size:10px;text-transform:uppercase;letter-spacing:.17em;color:rgba(225,248,249,.5);font-weight:800}.game-loader__brand strong{font-size:16px}.game-loader__main{max-width:610px}.game-loader__pulse{position:relative;width:58px;height:58px;margin-bottom:18px;display:grid;place-items:center}.game-loader__pulse span{position:absolute;inset:8px;border:1px solid rgba(95,229,234,.7);border-radius:999px;animation:pulse 2.1s ease-out infinite}.game-loader__pulse span:nth-child(2){animation-delay:.7s}.game-loader__pulse span:nth-child(3){animation-delay:1.4s}.game-loader__pulse b{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:#6be5e9;color:#061216;font-size:15px;box-shadow:0 0 26px rgba(107,229,233,.35)}.game-loader__eyebrow{margin:0 0 7px;text-transform:uppercase;letter-spacing:.16em;font-size:9px;font-weight:900;color:#70dfe4}.game-loader h1{margin:0;font-size:clamp(28px,4vw,46px);letter-spacing:-.045em;line-height:1.02}.game-loader__message{margin:12px 0 27px;color:rgba(235,249,250,.63);font-size:13px;line-height:1.55}.game-loader__progress-wrap{padding:15px 17px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(8,18,24,.62);backdrop-filter:blur(15px);box-shadow:0 16px 50px rgba(0,0,0,.22)}.game-loader__progress-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:10px}.game-loader__progress-head span{font-size:15px;font-weight:900}.game-loader__progress-head small{font-size:9px;color:rgba(255,255,255,.4);text-align:right}.game-loader__progress{height:6px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.game-loader__progress i{display:block;height:100%;min-width:2%;border-radius:inherit;background:linear-gradient(90deg,#4fd5dc,#93f1e8);box-shadow:0 0 18px rgba(92,228,234,.55);transition:width .32s cubic-bezier(.2,.8,.2,1);position:relative}.game-loader__progress i::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.8) 50%,transparent 80%);transform:translateX(-100%);animation:shine 1.35s linear infinite}.game-loader__steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.game-loader__steps span{font-size:8px;text-align:center;padding:5px;border-radius:7px;color:rgba(255,255,255,.27);background:rgba(255,255,255,.02);transition:.25s ease}.game-loader__steps span.done{color:#a7f1eb;background:rgba(73,207,210,.08)}.game-loader__footer{position:relative;z-index:4;display:flex;justify-content:space-between;gap:20px;padding:18px 28px;border-top:1px solid rgba(255,255,255,.06);background:rgba(3,8,12,.48);font-size:9px;color:rgba(255,255,255,.36)}.game-loader__live{display:flex;align-items:center;gap:7px;color:rgba(191,241,238,.68)}.game-loader__live i{width:6px;height:6px;border-radius:50%;background:#66e4d8;box-shadow:0 0 12px rgba(102,228,216,.8);animation:blink 1.4s ease-in-out infinite}.game-loader__error{max-width:600px;padding:30px;border:1px solid rgba(255,136,136,.18);border-radius:22px;background:rgba(20,11,14,.8);box-shadow:0 30px 90px rgba(0,0,0,.38)}.game-loader__error-icon{display:grid;place-items:center;width:42px;height:42px;margin-bottom:17px;border-radius:12px;background:rgba(247,91,91,.14);border:1px solid rgba(247,91,91,.25);color:#ff9e9e;font-size:20px;font-weight:950}.game-loader__error p:not(.game-loader__eyebrow){font-size:12px;line-height:1.6;color:rgba(255,255,255,.62)}.game-loader__error-actions{display:flex;gap:8px;margin-top:20px}.game-loader__error-actions button{padding:10px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;cursor:pointer}.game-loader__error-actions .primary{border-color:rgba(93,222,226,.35);background:rgba(93,222,226,.13)}
@keyframes route-flow{to{stroke-dashoffset:-50}}@keyframes pulse{0%{transform:scale(.55);opacity:0}25%{opacity:.8}100%{transform:scale(1.65);opacity:0}}@keyframes shine{to{transform:translateX(100%)}}@keyframes blink{50%{opacity:.25}}@keyframes aurora-a{to{transform:translate(8vw,6vw) scale(1.12)}}@keyframes aurora-b{to{transform:translate(-7vw,-5vw) scale(.92)}}
.game-loader--reduced *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.game-loader--error .game-loader__route{opacity:.18}.game-loader--error .game-loader__aurora{opacity:.08}
@media(max-width:720px){.game-loader__content{padding-bottom:35px}.game-loader__brand{margin-bottom:46px}.game-loader__footer{display:none}.game-loader__progress-head small{display:none}.game-loader__route{top:7%;height:40%}}
</style>
