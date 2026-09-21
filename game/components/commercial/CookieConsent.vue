<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGameCookieConsent } from '../../composables/useGameCookieConsent'
import { useGameLegal } from '../../composables/useGameLegal'

const cookies = useGameCookieConsent()
const legal = useGameLegal()
const customAnalytics = ref(false)
const customAds = ref(false)
const bannerVisible = computed(() => cookies.ready.value && !cookies.hasChoice.value && !cookies.panelOpen.value)

onMounted(() => {
  cookies.initialize()
  customAnalytics.value = Boolean(cookies.state.value?.analytics)
  customAds.value = Boolean(cookies.state.value?.ads)
})

function openCustom() {
  customAnalytics.value = Boolean(cookies.state.value?.analytics)
  customAds.value = Boolean(cookies.state.value?.ads)
  cookies.openPanel()
}
</script>

<template>
  <Teleport to="body">
    <section v-if="bannerVisible" class="cookie-banner" role="dialog" aria-label="Choix des cookies" aria-live="polite">
      <div class="cookie-copy">
        <strong>Votre choix de confidentialité</strong>
        <p>CLU utilise des stockages nécessaires au jeu. Google Analytics n’est chargé que si vous l’acceptez.</p>
        <button type="button" class="cookie-link" @click="legal.show('COOKIES')">Lire la politique Cookies</button>
      </div>
      <div class="cookie-actions">
        <button type="button" class="consent-equal" @click="cookies.rejectAll">Tout refuser</button>
        <button type="button" class="secondary" @click="openCustom">Personnaliser</button>
        <button type="button" class="consent-equal" @click="cookies.acceptAll">Tout accepter</button>
      </div>
    </section>

    <div v-if="cookies.panelOpen.value" class="cookie-overlay" @mousedown.self="cookies.closePanel">
      <section class="cookie-panel" role="dialog" aria-modal="true" aria-labelledby="cookie-panel-title">
        <header>
          <div>
            <span>Confidentialité</span>
            <h2 id="cookie-panel-title">Gérer mes cookies</h2>
          </div>
          <button type="button" aria-label="Fermer" @click="cookies.closePanel">×</button>
        </header>
        <div class="cookie-choice required">
          <div><strong>Nécessaires</strong><p>Authentification, sécurité, préférences et stockage local du jeu.</p></div>
          <b>Toujours actifs</b>
        </div>
        <label class="cookie-choice">
          <div><strong>Mesure d’audience</strong><p>Autorise Google Analytics afin de comprendre l’utilisation du site.</p></div>
          <input v-model="customAnalytics" type="checkbox">
        </label>
        <div class="cookie-choice disabled">
          <div><strong>Publicité</strong><p>CLU Métropole n’utilise pas la publicité dans le jeu. Les traceurs publicitaires restent désactivés dans cette couche.</p></div>
          <b>Inactif</b>
        </div>
        <div class="cookie-panel-actions">
          <button type="button" class="secondary" @click="cookies.rejectAll">Tout refuser</button>
          <button type="button" class="primary" @click="cookies.save(customAnalytics, false)">Enregistrer mes choix</button>
        </div>
        <button type="button" class="cookie-policy" @click="legal.show('COOKIES')">Politique Cookies complète</button>
      </section>
    </div>

    <button
      v-if="cookies.ready.value && cookies.hasChoice.value && !cookies.panelOpen.value"
      type="button"
      class="cookie-manage"
      @click="openCustom"
    >Cookies</button>
  </Teleport>
</template>

<style scoped>
.cookie-banner{position:fixed;z-index:11500;left:18px;right:18px;bottom:18px;max-width:1000px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:22px;padding:17px 18px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:rgba(8,20,26,.97);color:#eefbfc;box-shadow:0 24px 70px rgba(0,0,0,.45);backdrop-filter:blur(14px)}.cookie-copy{min-width:0}.cookie-copy strong{font-size:calc(13px * var(--clu-text-scale,1))}.cookie-copy p{margin:4px 0 5px;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.45;opacity:.68}.cookie-link,.cookie-policy{border:0;background:none;padding:0;color:#72e1e7;text-decoration:underline;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}.cookie-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.cookie-actions button,.cookie-panel-actions button{border-radius:10px;padding:10px 13px;font-size:calc(10px * var(--clu-text-scale,1));font-weight:850;cursor:pointer}.consent-equal{border:1px solid rgba(105,221,228,.45);background:rgba(105,221,228,.09);color:#dffbfc}.primary{border:1px solid rgba(82,220,228,.7);background:#53d7df;color:#061116}.secondary{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);color:#eefbfc}.cookie-overlay{position:fixed;z-index:11600;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,7,11,.78);backdrop-filter:blur(9px)}.cookie-panel{width:min(570px,100%);border:1px solid rgba(255,255,255,.13);border-radius:20px;background:#0a171d;color:#eefbfc;padding:20px;box-shadow:0 30px 90px rgba(0,0,0,.5)}.cookie-panel header{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:15px}.cookie-panel header span{color:#72e1e7;font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;font-weight:900}.cookie-panel h2{margin:4px 0 0;font-size:calc(20px * var(--clu-text-scale,1))}.cookie-panel header>button{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font-size:calc(20px * var(--clu-text-scale,1));cursor:pointer}.cookie-choice{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);margin-top:8px}.cookie-choice div{min-width:0}.cookie-choice strong{font-size:calc(11px * var(--clu-text-scale,1))}.cookie-choice p{margin:3px 0 0;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.55}.cookie-choice b{font-size:calc(9px * var(--clu-text-scale,1));color:#77e6e9}.cookie-choice input{width:20px;height:20px;accent-color:#55d7df}.cookie-choice.disabled{opacity:.68}.cookie-panel-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.cookie-policy{display:block;margin:14px auto 0}.cookie-manage{position:fixed;z-index:10900;right:10px;bottom:10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(6,16,21,.84);color:rgba(235,251,252,.72);padding:6px 9px;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer;backdrop-filter:blur(8px)}@media(max-width:700px){.cookie-banner{align-items:stretch;flex-direction:column;gap:11px;left:8px;right:8px;bottom:8px}.cookie-actions{justify-content:stretch}.cookie-actions button{flex:1}.cookie-panel-actions{flex-direction:column}.cookie-panel-actions button{width:100%}}
</style>
