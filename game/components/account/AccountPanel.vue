<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRuntimeConfig } from '#app'
import GoogleSignInButton from './GoogleSignInButton.vue'
import { useCluAccount } from '../../composables/useCluAccount'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameLegal } from '../../composables/useGameLegal'
import { currentGameLocaleTag } from '../../config/i18n'
import { isCluPremiumLaunchOfferActive } from '../../config/commercial'

const emit = defineEmits<{ close: [] }>()

type AccountMode = 'LOGIN' | 'REGISTER' | 'GOOGLE_REGISTER' | 'RECOVERY_CODE' | 'RECOVER' | 'CHANGE_PASSWORD' | 'CHANGE_PSEUDO' | 'DELETE_ACCOUNT'

const account = useCluAccount()
const i18n = useGameI18n()
const legal = useGameLegal()
const runtimeConfig = useRuntimeConfig()
const googleClientId = String(runtimeConfig.public.cluGoogleClientId || '').trim()

const mode = ref<AccountMode>(account.codeRecuperationNouveau.value ? 'RECOVERY_CODE' : 'LOGIN')
const pseudo = ref('')
const motDePasse = ref('')
const confirmationMotDePasse = ref('')
const codeRecuperation = ref('')
const motDePasseActuel = ref('')
const nouveauMotDePasse = ref('')
const confirmationNouveauMotDePasse = ref('')
const confirmationSuppression = ref('')
const nouveauPseudo = ref('')
const accepteCguInscription = ref(false)
const confirmeMajeurInscription = ref(false)
const conditionsCompteAcceptees = ref(false)
const conditionsCompteMajeur = ref(false)
const premiumConfirmationOuverte = ref(false)
const premiumAccepteCgu = ref(false)
const premiumAccepteConditions = ref(false)
const premiumConfirmeMajeur = ref(false)
const premiumActivationImmediate = ref(false)
const premiumRedirectionEnCours = ref(false)
const googleCredentialEnAttente = ref('')
const copieEffectuee = ref(false)
const erreurLocale = ref<string | null>(null)
const messageLocal = ref<string | null>(null)
const offreLancementPremium = computed(() => isCluPremiumLaunchOfferActive())
const confirmationsPremiumCompletes = computed(() =>
  premiumAccepteCgu.value &&
  premiumAccepteConditions.value &&
  premiumConfirmeMajeur.value &&
  premiumActivationImmediate.value,
)

const typeCompteLabel = computed(() => account.premiumActif.value
  ? `${i18n.t('Premium')} ★`
  : i18n.t('Gratuit'))

const premiumExpirationLabel = computed(() => {
  const expiration = Number(account.utilisateur.value?.premiumJusquA)
  if (!Number.isFinite(expiration) || expiration <= 0) return ''
  try {
    return new Intl.DateTimeFormat(currentGameLocaleTag(), { dateStyle: 'long' }).format(new Date(expiration))
  }
  catch {
    return new Date(expiration).toLocaleDateString()
  }
})


const prochainChangementPseudoLabel = computed(() => {
  const timestamp = Number(account.utilisateur.value?.prochainChangementPseudoA)
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return ''
  try {
    return new Intl.DateTimeFormat(currentGameLocaleTag(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(timestamp))
  }
  catch {
    return new Date(timestamp).toLocaleString()
  }
})

const peutChangerPseudo = computed(() => {
  const timestamp = Number(account.utilisateur.value?.prochainChangementPseudoA)
  return !Number.isFinite(timestamp) || timestamp <= Date.now()
})

const titreCodeRecuperation = computed(() => account.contexteCodeRecuperation.value === 'RECUPERATION'
  ? i18n.t('Compte récupéré')
  : i18n.t('Compte créé'))

function viderSaisieSensible() {
  motDePasse.value = ''
  confirmationMotDePasse.value = ''
  codeRecuperation.value = ''
  motDePasseActuel.value = ''
  nouveauMotDePasse.value = ''
  confirmationNouveauMotDePasse.value = ''
  confirmationSuppression.value = ''
  nouveauPseudo.value = ''
  googleCredentialEnAttente.value = ''
}

function changerMode(nouveauMode: AccountMode) {
  if (premiumRedirectionEnCours.value) return
  account.effacerErreur()
  erreurLocale.value = null
  messageLocal.value = null
  viderSaisieSensible()
  accepteCguInscription.value = false
  confirmeMajeurInscription.value = false
  premiumConfirmationOuverte.value = false
  mode.value = nouveauMode
}

function gererErreurGoogle(message: string) {
  account.effacerErreur()
  erreurLocale.value = message
}

async function connecter() {
  erreurLocale.value = null
  messageLocal.value = null
  try {
    await account.connexion(pseudo.value, motDePasse.value)
    motDePasse.value = ''
    emit('close')
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function connecterAvecGoogle(credential: string) {
  erreurLocale.value = null
  messageLocal.value = null
  try {
    const resultat = await account.connexionGoogle(credential)
    if (resultat.lie) {
      emit('close')
      return
    }

    googleCredentialEnAttente.value = credential
    pseudo.value = ''
    accepteCguInscription.value = false
    confirmeMajeurInscription.value = false
    mode.value = 'GOOGLE_REGISTER'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function inscrire() {
  erreurLocale.value = null
  messageLocal.value = null
  if (motDePasse.value !== confirmationMotDePasse.value) {
    erreurLocale.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  if (!accepteCguInscription.value || !confirmeMajeurInscription.value) {
    erreurLocale.value = 'Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans.'
    return
  }

  try {
    await account.creerCompte(pseudo.value, motDePasse.value, accepteCguInscription.value, confirmeMajeurInscription.value)
    motDePasse.value = ''
    confirmationMotDePasse.value = ''
    accepteCguInscription.value = false
    confirmeMajeurInscription.value = false
    copieEffectuee.value = false
    mode.value = 'RECOVERY_CODE'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function inscrireAvecGoogle() {
  erreurLocale.value = null
  messageLocal.value = null

  if (!googleCredentialEnAttente.value) {
    erreurLocale.value = 'La connexion Google a expiré. Réessayez.'
    return
  }

  if (!accepteCguInscription.value || !confirmeMajeurInscription.value) {
    erreurLocale.value = 'Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans.'
    return
  }

  try {
    await account.creerCompteGoogle(
      pseudo.value,
      googleCredentialEnAttente.value,
      accepteCguInscription.value,
      confirmeMajeurInscription.value,
    )
    googleCredentialEnAttente.value = ''
    accepteCguInscription.value = false
    confirmeMajeurInscription.value = false
    copieEffectuee.value = false
    mode.value = 'RECOVERY_CODE'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function lierGoogle(credential: string) {
  erreurLocale.value = null
  messageLocal.value = null
  try {
    await account.lierGoogle(credential)
    messageLocal.value = 'Compte Google lié.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function recuperer() {
  erreurLocale.value = null
  messageLocal.value = null
  if (nouveauMotDePasse.value !== confirmationNouveauMotDePasse.value) {
    erreurLocale.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  try {
    await account.recupererCompte(pseudo.value, codeRecuperation.value, nouveauMotDePasse.value)
    codeRecuperation.value = ''
    nouveauMotDePasse.value = ''
    confirmationNouveauMotDePasse.value = ''
    copieEffectuee.value = false
    mode.value = 'RECOVERY_CODE'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function modifierMotDePasse() {
  erreurLocale.value = null
  messageLocal.value = null
  if (nouveauMotDePasse.value !== confirmationNouveauMotDePasse.value) {
    erreurLocale.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  try {
    await account.changerMotDePasse(motDePasseActuel.value, nouveauMotDePasse.value)
    viderSaisieSensible()
    mode.value = 'LOGIN'
    messageLocal.value = 'Votre mot de passe a été modifié. Reconnectez-vous avec le nouveau mot de passe.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function supprimer() {
  erreurLocale.value = null
  messageLocal.value = null
  if (confirmationSuppression.value !== 'SUPPRIMER') {
    erreurLocale.value = 'Vous devez saisir SUPPRIMER pour confirmer.'
    return
  }

  try {
    await account.supprimerCompte(motDePasseActuel.value, confirmationSuppression.value)
    viderSaisieSensible()
    pseudo.value = ''
    mode.value = 'LOGIN'
    messageLocal.value = 'Votre compte CLU a été supprimé.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function supprimerAvecGoogle(credential: string) {
  erreurLocale.value = null
  messageLocal.value = null
  if (confirmationSuppression.value !== 'SUPPRIMER') {
    erreurLocale.value = 'Vous devez saisir SUPPRIMER pour confirmer.'
    return
  }

  try {
    await account.supprimerCompteGoogle(credential, confirmationSuppression.value)
    viderSaisieSensible()
    pseudo.value = ''
    mode.value = 'LOGIN'
    messageLocal.value = 'Votre compte CLU a été supprimé.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function copierCode() {
  if (!account.codeRecuperationNouveau.value) return
  try {
    await navigator.clipboard.writeText(account.codeRecuperationNouveau.value)
    copieEffectuee.value = true
  }
  catch {
    copieEffectuee.value = false
  }
}

function terminerCodeRecuperation() {
  const etaitConnecte = account.connecte.value
  account.confirmerCodeRecuperation()
  copieEffectuee.value = false
  mode.value = 'LOGIN'
  account.effacerErreur()
  if (etaitConnecte) emit('close')
}

function preparerPremium() {
  erreurLocale.value = null
  messageLocal.value = null
  premiumAccepteCgu.value = false
  premiumAccepteConditions.value = false
  premiumConfirmeMajeur.value = false
  premiumActivationImmediate.value = false
  premiumRedirectionEnCours.value = false
  premiumConfirmationOuverte.value = true
}

function annulerPremium() {
  if (premiumRedirectionEnCours.value) return
  premiumConfirmationOuverte.value = false
}

async function ouvrirPremium() {
  if (premiumRedirectionEnCours.value) return
  erreurLocale.value = null
  messageLocal.value = null

  if (!confirmationsPremiumCompletes.value) {
    erreurLocale.value = 'Vous devez accepter les conditions Premium, les CGU, confirmer avoir 18 ans et demander l’activation immédiate.'
    return
  }

  premiumRedirectionEnCours.value = true
  try {
    await account.ouvrirCheckoutPremium({
      accepteCgu: premiumAccepteCgu.value,
      confirmeMajeur: premiumConfirmeMajeur.value,
      accepteConditionsPremium: premiumAccepteConditions.value,
      demandeActivationImmediate: premiumActivationImmediate.value,
    })
    // ouvrirCheckoutPremium redirige le navigateur. On conserve le verrou jusqu'à
    // la navigation afin d'empêcher la création de plusieurs sessions Checkout.
  }
  catch {
    premiumRedirectionEnCours.value = false
    // Le message est porté par le composable.
  }
}

async function mettreAJourConditions() {
  erreurLocale.value = null
  messageLocal.value = null
  if (!conditionsCompteAcceptees.value || !conditionsCompteMajeur.value) {
    erreurLocale.value = 'Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans.'
    return
  }

  try {
    await account.accepterConditionsCompte()
    conditionsCompteAcceptees.value = false
    conditionsCompteMajeur.value = false
    messageLocal.value = 'Conditions du compte mises à jour.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function modifierPseudo() {
  erreurLocale.value = null
  messageLocal.value = null
  if (nouveauPseudo.value.trim() === account.utilisateur.value?.pseudo) {
    erreurLocale.value = 'Choisissez un pseudonyme différent du pseudonyme actuel.'
    return
  }

  try {
    await account.changerPseudo(nouveauPseudo.value)
    nouveauPseudo.value = ''
    mode.value = 'LOGIN'
    messageLocal.value = 'Votre pseudonyme a été modifié.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function exporterDonnees() {
  erreurLocale.value = null
  messageLocal.value = null
  try {
    await account.exporterDonneesPersonnelles()
    messageLocal.value = 'Vos données personnelles ont été exportées.'
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function rafraichirStatutPremium() {
  erreurLocale.value = null
  try {
    await account.actualiserSession(true)
  }
  catch {
    // Le message est porté par le composable.
  }
}

async function deconnecter() {
  try {
    await account.deconnexion()
    emit('close')
  }
  catch {
    // Le message est porté par le composable.
  }
}
</script>

<template>
  <section class="account-panel">
    <template v-if="account.codeRecuperationNouveau.value">
      <div class="account-recovery">
        <span class="account-kicker">{{ titreCodeRecuperation }}</span>
        <h3>{{ i18n.t('Code de récupération') }}</h3>
        <p>{{ i18n.t(account.contexteCodeRecuperation.value === 'RECUPERATION'
          ? 'Votre ancien code n’est plus valable. Conservez soigneusement ce nouveau code.'
          : 'Conservez ce code dans un endroit sûr. CLU ne pourra pas vous le réafficher.') }}</p>
        <code data-i18n-skip>{{ account.codeRecuperationNouveau.value }}</code>
        <div class="account-actions">
          <button class="account-button" type="button" @click="copierCode">
            {{ i18n.t(copieEffectuee ? 'Copié' : 'Copier le code') }}
          </button>
          <button class="account-button account-button--primary" type="button" @click="terminerCodeRecuperation">
            {{ i18n.t('J’ai sauvegardé mon code') }}
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="account.connecte.value">
      <form v-if="mode === 'CHANGE_PASSWORD'" class="account-form" @submit.prevent="modifierMotDePasse">
        <div class="account-intro">
          <span class="account-kicker">{{ i18n.t('Gestion du compte') }}</span>
          <h3>{{ i18n.t('Modifier le mot de passe') }}</h3>
          <p>{{ i18n.t('Toutes vos sessions seront fermées après la modification.') }}</p>
        </div>

        <label>
          <span>{{ i18n.t('Mot de passe actuel') }}</span>
          <input v-model="motDePasseActuel" type="password" minlength="10" maxlength="128" autocomplete="current-password" required>
        </label>

        <label>
          <span>{{ i18n.t('Nouveau mot de passe') }}</span>
          <input v-model="nouveauMotDePasse" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
        </label>

        <label>
          <span>{{ i18n.t('Confirmer le nouveau mot de passe') }}</span>
          <input v-model="confirmationNouveauMotDePasse" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
        </label>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div class="account-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Annuler') }}
          </button>
          <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value">
            {{ i18n.t('Changer le mot de passe') }}
          </button>
        </div>
      </form>

      <form v-else-if="mode === 'CHANGE_PSEUDO'" class="account-form" @submit.prevent="modifierPseudo">
        <div class="account-intro">
          <span class="account-kicker">{{ i18n.t('Gestion du compte') }}</span>
          <h3>{{ i18n.t('Modifier mon pseudonyme') }}</h3>
          <p>{{ i18n.t('Le pseudonyme peut être modifié une fois tous les 15 jours.') }}</p>
          <small v-if="!peutChangerPseudo && prochainChangementPseudoLabel">
            {{ i18n.t('Prochain changement possible le') }} <span data-i18n-skip>{{ prochainChangementPseudoLabel }}</span>
          </small>
        </div>

        <label>
          <span>{{ i18n.t('Nouveau pseudonyme') }}</span>
          <input v-model="nouveauPseudo" type="text" minlength="3" maxlength="24" autocomplete="username" :disabled="!peutChangerPseudo" required>
        </label>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div class="account-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Annuler') }}
          </button>
          <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value || !peutChangerPseudo">
            {{ i18n.t('Changer le pseudonyme') }}
          </button>
        </div>
      </form>

      <form v-else-if="mode === 'DELETE_ACCOUNT'" class="account-form" @submit.prevent="supprimer">
        <div class="account-intro">
          <span class="account-kicker account-kicker--danger">{{ i18n.t('Zone sensible') }}</span>
          <h3>{{ i18n.t('Supprimer mon compte') }}</h3>
          <p>{{ i18n.t('Cette action est irréversible. Votre compte sera désactivé, vos sessions seront fermées et votre pseudonyme sera libéré.') }}</p>
        </div>

        <label v-if="account.utilisateur.value?.aMotDePasse">
          <span>{{ i18n.t('Mot de passe actuel') }}</span>
          <input v-model="motDePasseActuel" type="password" minlength="10" maxlength="128" autocomplete="current-password" required>
        </label>

        <label>
          <span>{{ i18n.t('Pour confirmer, saisissez SUPPRIMER') }}</span>
          <input v-model="confirmationSuppression" type="text" autocomplete="off" spellcheck="false" placeholder="SUPPRIMER" required>
        </label>

        <p v-if="!account.utilisateur.value?.aMotDePasse" class="account-hint">
          {{ i18n.t('Pour supprimer ce compte, confirmez votre identité avec Google.') }}
        </p>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div v-if="account.utilisateur.value?.aMotDePasse" class="account-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Annuler') }}
          </button>
          <button class="account-button account-button--danger" type="submit" :disabled="account.chargement.value">
            {{ i18n.t('Supprimer définitivement mon compte') }}
          </button>
        </div>

        <div v-else class="account-google-confirm">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Annuler') }}
          </button>
          <GoogleSignInButton
            v-if="googleClientId"
            :client-id="googleClientId"
            :disabled="account.chargement.value"
            @credential="supprimerAvecGoogle"
            @error="gererErreurGoogle"
          />
        </div>
      </form>

      <div v-else class="account-connected">
        <div class="account-connected__badge" aria-hidden="true">◎</div>
        <div class="account-connected__identity">
          <span>{{ i18n.t('Connecté en tant que') }}</span>
          <strong data-i18n-skip>{{ account.utilisateur.value?.pseudo }}</strong>
          <small>{{ typeCompteLabel }}</small>
        </div>
        <p>{{ i18n.t('Votre session reste active pendant 30 jours sur cet appareil.') }}</p>

        <form v-if="!account.utilisateur.value?.conditionsCompteAJour" class="account-legal-update" @submit.prevent="mettreAJourConditions">
          <div>
            <strong>{{ i18n.t('Mettre à jour mes conditions') }}</strong>
            <p>{{ i18n.t('Votre compte utilise une ancienne version des conditions.') }}</p>
          </div>
          <label class="account-check">
            <input v-model="conditionsCompteAcceptees" type="checkbox" required>
            <span>
              {{ i18n.t('J’accepte les Conditions générales d’utilisation.') }}
              <button class="account-link account-link--inline" type="button" @click.stop="legal.show('TERMS')">{{ i18n.t('Lire les CGU') }}</button>
            </span>
          </label>
          <label class="account-check">
            <input v-model="conditionsCompteMajeur" type="checkbox" required>
            <span>{{ i18n.t('Je confirme avoir 18 ans ou plus.') }}</span>
          </label>
          <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value">
            {{ i18n.t('Mettre à jour mes conditions') }}
          </button>
        </form>

        <div class="account-premium-card" :class="{ 'account-premium-card--active': account.premiumActif.value }">
          <div class="account-premium-card__head">
            <div>
              <span>{{ i18n.t('CLU Premium') }}</span>
              <strong>{{ account.premiumActif.value ? `${i18n.t('Premium')} ★` : i18n.t('Gratuit') }}</strong>
            </div>
            <span v-if="account.premiumActif.value" class="account-premium-card__status">
              {{ i18n.t('Actif jusqu’au') }} <b data-i18n-skip>{{ premiumExpirationLabel }}</b>
            </span>
          </div>

          <p v-if="!account.premiumActif.value" class="account-premium-card__benefits">
            {{ i18n.t('Créer et héberger une partie en ligne') }} ·
            {{ i18n.t('Accéder à CLU Bureau avec un Premium actif') }} ·
            {{ i18n.t('Soutenir le développement de CLU') }}
          </p>
          <p v-else class="account-premium-card__benefits">
            {{ offreLancementPremium ? i18n.t('Offre de lancement : cet achat ajoute 2 mois de Premium.') : i18n.t('Chaque paiement ajoute un mois à votre Premium.') }}
          </p>

          <p v-if="offreLancementPremium" class="account-premium-card__launch-offer">
            <strong>{{ i18n.t('Offre de lancement BÊTA') }}</strong>
            <span>{{ i18n.t('Du 3 octobre au 2 novembre 2026 inclus : 1 mois Premium acheté = 1 mois supplémentaire offert.') }}</span>
          </p>
          <p class="account-premium-card__note">
            {{ offreLancementPremium ? i18n.t('3,99 € · 2 mois au total · paiement unique · aucun renouvellement automatique') : i18n.t('1 mois · paiement unique · aucun renouvellement automatique') }}
          </p>
          <p class="account-premium-card__beta-note">{{ i18n.t('Le mode En ligne est actuellement en bêta. Des bugs, interruptions ou comportements inattendus peuvent encore survenir.') }}</p>

          <button
            v-if="!premiumConfirmationOuverte"
            class="account-button account-button--premium"
            type="button"
            :disabled="account.chargement.value || premiumRedirectionEnCours"
            @click="preparerPremium"
          >
            {{ offreLancementPremium ? i18n.t('Obtenir 2 mois Premium — 3,99 €') : i18n.t('Obtenir 1 mois Premium — 3,99 €') }}
          </button>

          <form v-else class="account-premium-confirm" :aria-busy="premiumRedirectionEnCours" @submit.prevent="ouvrirPremium">
            <strong>{{ i18n.t('Confirmer l’achat Premium') }}</strong>
            <p>{{ offreLancementPremium ? i18n.t('3,99 € · 2 mois au total · paiement unique · aucun renouvellement automatique') : i18n.t('3,99 € · 1 mois · paiement unique · aucun renouvellement automatique') }}</p>
            <ul>
              <li>{{ i18n.t('Créer et héberger une partie en ligne') }}</li>
              <li>{{ i18n.t('Accéder à CLU Bureau avec un Premium actif') }}</li>
              <li>{{ i18n.t('Soutenir le développement de CLU') }}</li>
            </ul>
            <p class="account-premium-card__note">
              {{ i18n.t('Droit de rétractation : vous disposez en principe de 14 jours à compter de l’achat. Si la période achetée a commencé à votre demande avant la fin de ce délai, un montant proportionnel au service déjà fourni peut rester dû.') }}
            </p>
            <label class="account-check">
              <input v-model="premiumAccepteCgu" type="checkbox" :disabled="premiumRedirectionEnCours" required>
              <span>
                {{ i18n.t('J’accepte les Conditions générales d’utilisation.') }}
                <button class="account-link account-link--inline" type="button" @click.stop="legal.show('TERMS')">{{ i18n.t('Lire les CGU') }}</button>
              </span>
            </label>
            <label class="account-check">
              <input v-model="premiumAccepteConditions" type="checkbox" :disabled="premiumRedirectionEnCours" required>
              <span>
                {{ i18n.t('J’accepte les Conditions CLU Premium.') }}
                <button class="account-link account-link--inline" type="button" @click.stop="legal.show('PREMIUM')">{{ i18n.t('Lire les conditions Premium') }}</button>
              </span>
            </label>
            <label class="account-check">
              <input v-model="premiumConfirmeMajeur" type="checkbox" :disabled="premiumRedirectionEnCours" required>
              <span>{{ i18n.t('Je confirme avoir 18 ans ou plus.') }}</span>
            </label>
            <label class="account-check">
              <input v-model="premiumActivationImmediate" type="checkbox" :disabled="premiumRedirectionEnCours" required>
              <span>{{ i18n.t('Je demande l’activation immédiate de CLU Premium avant la fin du délai de rétractation et je reconnais qu’après exécution complète du service je ne disposerai plus du droit de rétractation.') }}</span>
            </label>
            <p class="account-premium-card__note">
              <button class="account-link account-link--inline" type="button" @click="legal.show('PRIVACY')">{{ i18n.t('Lire la politique de confidentialité') }}</button>
            </p>
            <div class="account-actions">
              <button class="account-button" type="button" :disabled="account.chargement.value || premiumRedirectionEnCours" @click="annulerPremium">
                {{ i18n.t('Annuler') }}
              </button>
              <button class="account-button account-button--premium premium-checkout-button" type="submit" :aria-busy="account.chargement.value || premiumRedirectionEnCours" :disabled="account.chargement.value || premiumRedirectionEnCours || !confirmationsPremiumCompletes">
                {{ i18n.t(premiumRedirectionEnCours ? 'Redirection vers Stripe…' : 'Continuer vers Stripe') }}
              </button>
            </div>
          </form>

          <p v-if="account.retourPremium.value === 'ANNULE'" class="account-hint">
            {{ i18n.t('Paiement annulé. Aucun débit n’a été effectué.') }}
          </p>
          <p v-else-if="account.retourPremium.value === 'EN_ATTENTE' && !account.premiumActif.value" class="account-premium-pending" role="status">
            {{ i18n.t('Paiement reçu. Activation Premium en cours.') }}
            <button class="account-link account-link--inline" type="button" :disabled="account.chargement.value" @click="rafraichirStatutPremium">
              {{ i18n.t('Rafraîchir le statut') }}
            </button>
          </p>
          <p v-else-if="account.retourPremium.value === 'SUCCES' && account.premiumActif.value" class="account-success" role="status">
            {{ i18n.t('Paiement Premium confirmé.') }}
          </p>
        </div>

        <div class="account-google-state">
          <div>
            <strong>{{ i18n.t('Compte Google') }}</strong>
            <span>{{ i18n.t(account.utilisateur.value?.googleLie ? 'Lié' : 'Non lié') }}</span>
          </div>
          <GoogleSignInButton
            v-if="googleClientId && !account.utilisateur.value?.googleLie"
            :client-id="googleClientId"
            :disabled="account.chargement.value"
            @credential="lierGoogle"
            @error="gererErreurGoogle"
          />
        </div>
        <p v-if="!account.utilisateur.value?.googleLie" class="account-hint">
          {{ i18n.t('Liez Google pour pouvoir vous connecter à CLU sans saisir votre mot de passe.') }}
        </p>
        <p v-if="account.utilisateur.value?.googleLie" class="account-hint">
          {{ i18n.t('Vous pouvez maintenant vous connecter à CLU avec Google.') }}
        </p>
        <p v-if="!account.utilisateur.value?.aMotDePasse" class="account-hint">
          {{ i18n.t('Ce compte a été créé avec Google. Votre code de récupération permet de définir un mot de passe si nécessaire.') }}
        </p>

        <p v-if="messageLocal" class="account-success" role="status">{{ i18n.t(messageLocal) }}</p>
        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div class="account-management-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('CHANGE_PSEUDO')">
            {{ i18n.t('Modifier mon pseudonyme') }}
          </button>
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="exporterDonnees">
            {{ i18n.t('Exporter mes données') }}
          </button>
          <button
            v-if="account.utilisateur.value?.aMotDePasse"
            class="account-button"
            type="button"
            :disabled="account.chargement.value"
            @click="changerMode('CHANGE_PASSWORD')"
          >
            {{ i18n.t('Modifier le mot de passe') }}
          </button>
          <button class="account-button account-button--danger-ghost" type="button" :disabled="account.chargement.value" @click="changerMode('DELETE_ACCOUNT')">
            {{ i18n.t('Supprimer mon compte') }}
          </button>
          <button class="account-button account-button--danger" type="button" :disabled="account.chargement.value" @click="deconnecter">
            {{ i18n.t('Déconnexion') }}
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="mode === 'RECOVER'">
      <div class="account-intro">
        <span class="account-kicker">{{ i18n.t('Récupération du compte') }}</span>
        <h3>{{ i18n.t('Récupérer mon compte') }}</h3>
        <p>{{ i18n.t('Utilisez votre pseudonyme et votre code de récupération pour définir un nouveau mot de passe.') }}</p>
      </div>

      <form class="account-form" @submit.prevent="recuperer">
        <label>
          <span>{{ i18n.t('Pseudonyme') }}</span>
          <input v-model="pseudo" type="text" minlength="3" maxlength="24" autocomplete="username" required>
        </label>

        <label>
          <span>{{ i18n.t('Code de récupération') }}</span>
          <input v-model="codeRecuperation" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
        </label>

        <label>
          <span>{{ i18n.t('Nouveau mot de passe') }}</span>
          <input v-model="nouveauMotDePasse" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
        </label>

        <label>
          <span>{{ i18n.t('Confirmer le nouveau mot de passe') }}</span>
          <input v-model="confirmationNouveauMotDePasse" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
        </label>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div class="account-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Retour à la connexion') }}
          </button>
          <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value">
            {{ i18n.t('Récupérer le compte') }}
          </button>
        </div>
      </form>
    </template>

    <template v-else-if="mode === 'GOOGLE_REGISTER'">
      <div class="account-intro">
        <span class="account-kicker">{{ i18n.t('Compte Google') }}</span>
        <h3>{{ i18n.t('Créer votre compte avec Google') }}</h3>
        <p>{{ i18n.t('Choisissez votre pseudonyme CLU. Votre compte Google servira ensuite à vous connecter.') }}</p>
      </div>

      <form class="account-form" @submit.prevent="inscrireAvecGoogle">
        <label>
          <span>{{ i18n.t('Pseudonyme') }}</span>
          <input v-model="pseudo" type="text" minlength="3" maxlength="24" autocomplete="username" required>
        </label>

        <div class="account-consents">
          <label class="account-check">
            <input v-model="accepteCguInscription" type="checkbox" required>
            <span>
              {{ i18n.t('J’accepte les Conditions générales d’utilisation.') }}
              <button class="account-link account-link--inline" type="button" @click.stop="legal.show('TERMS')">{{ i18n.t('Lire les CGU') }}</button>
            </span>
          </label>
          <label class="account-check">
            <input v-model="confirmeMajeurInscription" type="checkbox" required>
            <span>{{ i18n.t('Je confirme avoir 18 ans ou plus.') }}</span>
          </label>
          <button class="account-link account-link--inline" type="button" @click="legal.show('PRIVACY')">{{ i18n.t('Lire la politique de confidentialité') }}</button>
        </div>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <div class="account-actions">
          <button class="account-button" type="button" :disabled="account.chargement.value" @click="changerMode('LOGIN')">
            {{ i18n.t('Annuler') }}
          </button>
          <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value">
            {{ i18n.t('Créer avec Google') }}
          </button>
        </div>
      </form>
    </template>

    <template v-else>
      <div class="account-tabs" role="tablist" :aria-label="i18n.t('Compte CLU')">
        <button type="button" role="tab" :aria-selected="mode === 'LOGIN'" :class="{ active: mode === 'LOGIN' }" @click="changerMode('LOGIN')">
          {{ i18n.t('Connexion') }}
        </button>
        <button type="button" role="tab" :aria-selected="mode === 'REGISTER'" :class="{ active: mode === 'REGISTER' }" @click="changerMode('REGISTER')">
          {{ i18n.t('Créer un compte') }}
        </button>
      </div>

      <div class="account-intro">
        <span class="account-kicker">{{ i18n.t('Compte CLU') }}</span>
        <h3>{{ i18n.t(mode === 'LOGIN' ? 'Votre compte CLU' : 'Créer un compte') }}</h3>
        <p>{{ i18n.t(mode === 'LOGIN' ? 'Connectez-vous avec votre pseudonyme et votre mot de passe.' : 'Créez un compte avec un pseudonyme et un mot de passe.') }}</p>
        <small v-if="mode === 'REGISTER'">{{ i18n.t('Aucune adresse e-mail n’est requise.') }}</small>
      </div>

      <p v-if="messageLocal" class="account-success" role="status">{{ i18n.t(messageLocal) }}</p>

      <form class="account-form" @submit.prevent="mode === 'LOGIN' ? connecter() : inscrire()">
        <label>
          <span>{{ i18n.t('Pseudonyme') }}</span>
          <input v-model="pseudo" type="text" minlength="3" maxlength="24" autocomplete="username" required>
        </label>

        <label>
          <span>{{ i18n.t('Mot de passe') }}</span>
          <input v-model="motDePasse" type="password" minlength="10" maxlength="128" :autocomplete="mode === 'LOGIN' ? 'current-password' : 'new-password'" required>
        </label>

        <label v-if="mode === 'REGISTER'">
          <span>{{ i18n.t('Confirmer le mot de passe') }}</span>
          <input v-model="confirmationMotDePasse" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
        </label>

        <div v-if="mode === 'REGISTER'" class="account-consents">
          <label class="account-check">
            <input v-model="accepteCguInscription" type="checkbox" required>
            <span>
              {{ i18n.t('J’accepte les Conditions générales d’utilisation.') }}
              <button class="account-link account-link--inline" type="button" @click.stop="legal.show('TERMS')">{{ i18n.t('Lire les CGU') }}</button>
            </span>
          </label>
          <label class="account-check">
            <input v-model="confirmeMajeurInscription" type="checkbox" required>
            <span>{{ i18n.t('Je confirme avoir 18 ans ou plus.') }}</span>
          </label>
          <button class="account-link account-link--inline" type="button" @click="legal.show('PRIVACY')">{{ i18n.t('Lire la politique de confidentialité') }}</button>
        </div>

        <p v-if="erreurLocale || account.erreur.value" class="account-error" role="alert">
          {{ i18n.t(erreurLocale || account.erreur.value || 'Une erreur est survenue.') }}
        </p>

        <button class="account-button account-button--primary" type="submit" :disabled="account.chargement.value">
          {{ i18n.t(mode === 'LOGIN' ? 'Se connecter' : 'Créer un compte') }}
        </button>

        <button v-if="mode === 'LOGIN'" class="account-link" type="button" :disabled="account.chargement.value" @click="changerMode('RECOVER')">
          {{ i18n.t('Mot de passe oublié ?') }}
        </button>
      </form>

      <div v-if="googleClientId" class="account-google-option">
        <span>{{ i18n.t('Ou avec Google') }}</span>
        <GoogleSignInButton
          :client-id="googleClientId"
          :disabled="account.chargement.value"
          @credential="connecterAvecGoogle"
          @error="gererErreurGoogle"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.account-panel{display:grid;gap:18px;max-width:620px;margin:0 auto;padding:8px 4px 4px;color:#eef8ff}.account-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(5,14,21,.52)}.account-tabs button{min-height:42px;border:1px solid transparent;border-radius:10px;background:transparent;color:rgba(237,247,253,.58);font-weight:800;cursor:pointer}.account-tabs button.active{border-color:rgba(81,214,225,.34);background:rgba(69,195,206,.12);color:#effdff}.account-intro,.account-recovery{display:grid;gap:6px}.account-kicker{font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#70dce5}.account-kicker--danger{color:#ff9f9f}.account-intro h3,.account-recovery h3{margin:0;font-size:calc(24px * var(--clu-text-scale,1));letter-spacing:-.035em}.account-intro p,.account-recovery p,.account-connected p,.account-hint{margin:0;color:rgba(229,241,249,.62);font-size:calc(10px * var(--clu-text-scale,1));line-height:1.55}.account-intro small{color:rgba(229,241,249,.45);font-size:calc(9px * var(--clu-text-scale,1))}.account-form{display:grid;gap:11px}.account-form label{display:grid;gap:6px}.account-form label>span{font-size:calc(9px * var(--clu-text-scale,1));font-weight:800;color:rgba(236,247,253,.72)}.account-form input{min-height:44px;box-sizing:border-box;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(4,13,20,.68);color:#f2fbff;padding:0 12px;font:700 calc(11px * var(--clu-text-scale,1))/1 inherit;outline:0}.account-form input:focus{border-color:rgba(75,221,233,.52);box-shadow:0 0 0 3px rgba(75,221,233,.08)}.account-error,.account-success{margin:0;padding:9px 11px;border-radius:10px;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4}.account-error{border:1px solid rgba(235,92,92,.16);background:rgba(183,51,51,.10);color:#ffb2b2}.account-success{border:1px solid rgba(72,219,231,.20);background:rgba(51,191,204,.10);color:#a8f7fc}.account-button{min-height:42px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.045);color:#f0f9ff;padding:0 14px;font-weight:850;cursor:pointer}.account-button:hover{background:rgba(255,255,255,.075)}.account-button:disabled,.account-link:disabled{opacity:.48;cursor:wait}.account-button--primary{border-color:rgba(72,219,231,.38);background:linear-gradient(135deg,rgba(51,191,204,.22),rgba(18,95,112,.16));color:#effeff}.account-button--danger{border-color:rgba(235,92,92,.24);background:rgba(183,51,51,.10);color:#ffb3b3}.account-button--danger-ghost{border-color:rgba(235,92,92,.15);color:#ffb3b3}.account-recovery code{display:block;overflow-wrap:anywhere;padding:15px;border:1px solid rgba(77,221,233,.30);border-radius:12px;background:rgba(5,17,25,.72);color:#a8f7fc;font:850 calc(14px * var(--clu-text-scale,1))/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em}.account-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px}.account-connected{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center}.account-connected__badge{width:54px;height:54px;display:grid;place-items:center;border:1px solid rgba(72,219,231,.28);border-radius:999px;background:rgba(61,196,207,.11);color:#7ee8ef;font-size:25px}.account-connected__identity{display:grid;gap:2px}.account-connected__identity span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;color:rgba(228,241,249,.50)}.account-connected__identity strong{font-size:calc(21px * var(--clu-text-scale,1));letter-spacing:-.03em}.account-connected__identity small{color:#79e4eb;font-size:calc(9px * var(--clu-text-scale,1));font-weight:850}.account-connected>p,.account-connected>.account-error,.account-connected>.account-success,.account-connected>.account-management-actions,.account-connected>.account-google-state,.account-connected>.account-premium-card{grid-column:1/-1}.account-management-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.account-management-actions .account-button--danger{grid-column:1/-1}.account-link{justify-self:center;border:0;background:transparent;color:#7ee8ef;padding:6px 10px;font-weight:800;cursor:pointer}.account-link:hover{text-decoration:underline}.account-google-option{display:grid;gap:9px;justify-items:center;padding-top:4px;border-top:1px solid rgba(255,255,255,.08)}.account-google-option>span{font-size:calc(9px * var(--clu-text-scale,1));font-weight:800;color:rgba(229,241,249,.48)}.account-google-state{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(5,14,21,.42)}.account-google-state>div{display:grid;gap:3px}.account-google-state strong{font-size:calc(10px * var(--clu-text-scale,1))}.account-google-state span{font-size:calc(9px * var(--clu-text-scale,1));color:#79e4eb}.account-google-confirm{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,1.35fr);gap:8px;align-items:center}.account-premium-card{display:grid;gap:10px;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:linear-gradient(145deg,rgba(11,28,39,.72),rgba(7,18,27,.58))}.account-premium-card--active{border-color:rgba(232,195,91,.28);background:linear-gradient(145deg,rgba(76,60,19,.22),rgba(10,24,31,.68))}.account-premium-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.account-premium-card__head>div{display:grid;gap:2px}.account-premium-card__head>div>span{font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:rgba(237,247,253,.46)}.account-premium-card__head strong{font-size:calc(18px * var(--clu-text-scale,1));color:#f8fbff}.account-premium-card__status{font-size:calc(9px * var(--clu-text-scale,1));color:#f3d989;text-align:right}.account-premium-card__status b{font-weight:900}.account-premium-card__benefits,.account-premium-card__note{margin:0}.account-premium-card__benefits{color:rgba(237,247,253,.70);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5}.account-premium-card__note{color:rgba(237,247,253,.44);font-size:calc(8px * var(--clu-text-scale,1));line-height:1.45}.account-button--premium{border-color:rgba(232,195,91,.34);background:linear-gradient(135deg,rgba(194,147,31,.23),rgba(106,73,12,.15));color:#fff5d0}.account-button--premium:hover{background:linear-gradient(135deg,rgba(210,160,38,.29),rgba(118,81,13,.20))}.account-premium-pending{margin:0;padding:9px 11px;border:1px solid rgba(232,195,91,.20);border-radius:10px;background:rgba(152,112,23,.10);color:#f5dfa4;font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4}.account-link--inline{display:inline;padding:0 0 0 5px;font-size:inherit}.account-consents,.account-premium-confirm,.account-legal-update{display:grid;gap:9px}.account-consents{padding:10px 0 2px;border-top:1px solid rgba(255,255,255,.07)}.account-check{display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:9px!important}.account-check input{width:16px;height:16px;min-height:0;margin:2px 0 0;padding:0;accent-color:#62dbe4}.account-check>span{font-weight:650!important;line-height:1.45}.account-legal-update{grid-column:1/-1;padding:13px;border:1px solid rgba(72,219,231,.18);border-radius:13px;background:rgba(51,191,204,.07)}.account-legal-update>div{display:grid;gap:3px}.account-legal-update strong{font-size:calc(11px * var(--clu-text-scale,1))}.account-premium-confirm{padding-top:4px;border-top:1px solid rgba(255,255,255,.07)}.account-premium-confirm>strong{font-size:calc(11px * var(--clu-text-scale,1));color:#fff2c4}.account-premium-confirm>p{margin:0}.account-premium-confirm ul{margin:0;padding-left:20px;color:rgba(237,247,253,.68);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.5}
.premium-checkout-button:disabled[aria-busy="false"]{cursor:not-allowed}
@media(max-width:560px){.account-actions,.account-management-actions,.account-tabs,.account-google-confirm{grid-template-columns:1fr}.account-management-actions .account-button--danger{grid-column:auto}.account-connected{grid-template-columns:1fr}.account-connected__badge{display:none}.account-google-state{display:grid}}
.account-premium-card__launch-offer{display:grid;gap:3px;padding:9px 10px;border:1px solid rgba(235,188,72,.24);border-radius:9px;background:rgba(235,188,72,.07)}.account-premium-card__launch-offer strong{color:#f2d37d}.account-premium-card__launch-offer span,.account-premium-card__beta-note{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.45;opacity:.72}
</style>
