<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CLU_COMMERCIAL } from '../../config/commercial'
import { useGameCommercial } from '../../composables/useGameCommercial'
import { useGameLegal } from '../../composables/useGameLegal'
import { useGameDialog } from '../../composables/useGameDialog'
import { useGameSettings } from '../../composables/useGameSettings'
import { translateGameText } from '../../config/i18n'

const commercial = useGameCommercial()
const legal = useGameLegal()
const dialogs = useGameDialog()
const preferences = useGameSettings()
const t = (input: string) => translateGameText(input, preferences.settings.value.locale)
const password = ref('')
const username = ref('')
const email = ref('')
const code = ref('')
const message = ref('')
const error = ref('')

onMounted(async () => {
  username.value = commercial.user.value?.username || ''
  email.value = commercial.user.value?.email || ''
  if (commercial.authenticated.value) {
    try { await commercial.listSessions() } catch { /* non bloquant */ }
  }
})

async function reveal() {
  error.value = ''; message.value = ''
  try { code.value = await commercial.revealRecoveryCode(password.value); password.value = '' } catch (e) { error.value = e instanceof Error ? e.message : 'Impossible d’afficher le code.' }
}
async function copyRecoveryCode() {
  if (!code.value) return
  try { await navigator.clipboard.writeText(code.value); message.value = 'Code de récupération copié.' } catch { error.value = 'Copie impossible. Sélectionnez le code manuellement.' }
}
async function rotate() {
  error.value = ''; message.value = ''
  const ok = await dialogs.confirm(t('L’ancien code de récupération deviendra immédiatement invalide. Continuer ?'), { title: t('Nouveau code de récupération'), confirmLabel: t('Générer'), cancelLabel: t('Annuler') })
  if (!ok) return
  try { code.value = await commercial.rotateRecoveryCode(password.value); password.value = ''; message.value = 'Nouveau code généré. Conservez-le dans un endroit sûr.' } catch (e) { error.value = e instanceof Error ? e.message : 'Impossible de générer le code.' }
}
async function saveUsername() {
  error.value = ''; message.value = ''
  try { await commercial.updateUsername(username.value.trim(), password.value); password.value = ''; message.value = 'Pseudo mis à jour.' } catch (e) { error.value = e instanceof Error ? e.message : 'Modification impossible.' }
}
async function saveEmail() {
  error.value = ''; message.value = ''
  if (!email.value.trim()) { error.value = 'Une adresse email valide est obligatoire.'; return }
  try { await commercial.updateEmail(email.value.trim(), password.value); password.value = ''; message.value = 'Email mis à jour.' } catch (e) { error.value = e instanceof Error ? e.message : 'Modification impossible.' }
}
async function logoutAll() {
  const ok = await dialogs.confirm(t('Toutes les sessions, y compris celle-ci, seront déconnectées. Continuer ?'), { title: t('Déconnecter tous les appareils'), confirmLabel: t('Déconnecter'), cancelLabel: t('Annuler'), tone: 'DANGER' })
  if (ok) await commercial.logoutAll()
}
async function deleteAccount() {
  const ok = await dialogs.confirm(t('Cette action supprime votre compte et révoque vos sessions. Certaines données de transaction peuvent être conservées lorsqu’une obligation légale l’impose. Cette action peut rendre votre achat inaccessible. Continuer ?'), { title: t('Supprimer mon compte'), confirmLabel: t('Supprimer définitivement'), cancelLabel: t('Annuler'), tone: 'DANGER' })
  if (!ok) return
  try { await commercial.deleteAccount(password.value) } catch (e) { error.value = e instanceof Error ? e.message : 'Suppression impossible.' }
}
</script>

<template>
  <section class="settings-section account-section">
    <div class="section-copy">
      <span class="settings-kicker">{{ t('Compte CLU') }}</span>
      <h3>{{ t('Compte, récupération & sécurité') }}</h3>
      <p v-if="commercial.authenticated.value">
        {{ t('Connecté en tant que') }} <b>{{ commercial.user.value?.username }}</b> ·
        {{ commercial.ownsProduct.value ? t('CLU Métropole acheté') : commercial.previewActive.value ? t('Accès découverte') : t('Aucun achat actif') }}.
      </p>
      <p v-else>{{ t('Aucun compte connecté. Les sauvegardes de partie restent locales à cet appareil.') }}</p>
    </div>

    <template v-if="commercial.authenticated.value">
      <div class="account-grid">
        <label><span>{{ t('Pseudo') }}</span><input v-model="username" maxlength="24"></label>
        <label><span>{{ t('Email') }}</span><input v-model="email" type="email" required></label>
        <label class="full"><span>{{ t('Mot de passe actuel pour les actions sensibles') }}</span><input v-model="password" type="password" autocomplete="current-password"></label>
      </div>
      <div class="account-actions"><button type="button" @click="saveUsername">{{ t('Appliquer le pseudo') }}</button><button type="button" @click="saveEmail">{{ t('Appliquer l’email') }}</button></div>

      <div class="security-block">
        <div><strong>{{ t('Code de récupération') }}</strong><small>{{ t('Protégé par votre mot de passe. Un nouveau code invalide immédiatement l’ancien.') }}</small></div>
        <div class="security-actions"><button type="button" @click="reveal">{{ t('Afficher / copier le code actuel') }}</button><button type="button" @click="rotate">{{ t('Générer un nouveau code') }}</button></div>
        <template v-if="code"><code>{{ code }}</code><button type="button" class="copy-code" @click="copyRecoveryCode">{{ t('Copier le code') }}</button></template>
      </div>

      <div class="security-block">
        <div><strong>{{ t('Sessions & appareils') }}</strong><small>{{ t('Un volume anormal de nouveaux appareils peut entraîner une déconnexion générale, jamais un bannissement automatique.') }}</small></div>
        <div v-if="commercial.sessions.value.length" class="session-list">
          <div v-for="session in commercial.sessions.value" :key="session.id" class="session-row">
            <span><b>{{ session.deviceLabel }}</b><small>{{ session.current ? t('Cet appareil') : `${t('Dernière activité')} : ${new Date(session.lastSeenAt).toLocaleString()}` }}</small></span>
            <button v-if="!session.current" type="button" @click="commercial.revokeSession(session.id)">{{ t('Déconnecter') }}</button>
          </div>
        </div>
        <div class="security-actions"><button type="button" @click="commercial.listSessions">{{ t('Actualiser') }}</button><button type="button" class="danger" @click="logoutAll">{{ t('Déconnecter tous les appareils') }}</button></div>
      </div>

      <div class="security-block">
        <div><strong>{{ t('Documents juridiques') }}</strong><small>{{ t('Version') }} {{ CLU_COMMERCIAL.legal.version }} · {{ t('les choix cookies restent modifiables à tout moment.') }}</small></div>
        <div class="legal-actions"><button @click="legal.show('CGV')">{{ t('CGV') }}</button><button @click="legal.show('CGU')">{{ t('CGU') }}</button><button @click="legal.show('PRIVACY')">{{ t('Confidentialité') }}</button><button @click="legal.show('COOKIES')">{{ t('Cookies') }}</button><button @click="legal.show('PREVIEW')">{{ t('Semaine gratuite') }}</button><button @click="legal.show('LEGAL')">{{ t('Mentions légales') }}</button><button @click="legal.show('CREDITS')">{{ t('Licences & crédits') }}</button></div>
      </div>

      <div class="security-block danger-zone">
        <div><strong>{{ t('Zone sensible') }}</strong><small>{{ t('La suppression d’un compte n’efface pas nécessairement les données que CLU doit légalement conserver pour une transaction.') }}</small></div>
        <button type="button" class="danger" @click="deleteAccount">{{ t('Supprimer mon compte') }}</button>
      </div>
    </template>
    <template v-else>
      <div class="security-block"><strong>{{ t('Connexion requise') }}</strong><small>{{ t('Revenez à la page d’accès CLU Métropole pour créer un compte ou vous connecter.') }}</small></div>
    </template>

    <p v-if="message" class="success">{{ t(message) }}</p><p v-if="error" class="error">{{ t(error) }}</p>
  </section>
</template>

<style scoped>
.account-section{display:grid;gap:10px;padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.03)}.section-copy{margin-bottom:2px}.settings-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:#72d8df;font-weight:800}.section-copy h3{margin:3px 0 4px;font-size:15px}.section-copy p{margin:0;font-size:10px;line-height:1.5;opacity:.58}.account-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.account-grid label{display:grid;gap:4px}.account-grid label.full{grid-column:1/-1}.account-grid span{font-size:9px;font-weight:800}.account-grid input{border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(0,0,0,.16);color:inherit;padding:9px 10px;font-size:12px}.account-actions,.security-actions,.legal-actions{display:flex;gap:7px;flex-wrap:wrap}.account-actions button,.security-actions button,.legal-actions button,.danger-zone>button{border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.04);color:inherit;padding:8px 10px;font-size:9px;cursor:pointer}.security-block{display:grid;gap:9px;padding:11px;border-radius:11px;background:rgba(255,255,255,.032);border:1px solid rgba(255,255,255,.07)}.security-block>div:first-child{display:grid;gap:2px}.security-block strong{font-size:10px}.security-block small{font-size:8px;line-height:1.45;opacity:.52}.security-block code{padding:10px;border-radius:8px;background:rgba(0,0,0,.3);color:#8df1f3;font-size:11px;overflow:auto}.copy-code{justify-self:start;border:1px solid rgba(111,227,233,.26);border-radius:8px;background:rgba(111,227,233,.07);color:#8df1f3;padding:7px 10px;font-size:8px;font-weight:800;cursor:pointer}.session-list{display:grid;gap:6px}.session-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:8px;background:rgba(0,0,0,.12)}.session-row span{display:grid;gap:2px}.session-row b{font-size:9px}.session-row button{border:0;background:none;color:#74dfe4;font-size:8px;cursor:pointer}.danger{color:#ff9b9b!important;border-color:rgba(255,84,84,.25)!important}.success,.error{margin:0;padding:8px 10px;border-radius:8px;font-size:9px}.success{background:rgba(68,205,149,.08);color:#a3f1cd}.error{background:rgba(255,70,70,.08);color:#ffb2b2}@media(max-width:680px){.account-grid{grid-template-columns:1fr}.account-grid label.full{grid-column:auto}}
</style>
