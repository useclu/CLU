<script setup lang="ts">
import { computed } from 'vue'
import { GAME_GRAPHICS_OPTIONS } from '../../config/settings'
import { GAME_LOCALE_OPTIONS } from '../../config/i18n'
import { useGameSettings } from '../../composables/useGameSettings'
import { useGameHelp } from '../../composables/useGameHelp'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameDialog } from '../../composables/useGameDialog'

const preferences = useGameSettings()
const help = useGameHelp()
const i18n = useGameI18n()
const dialogs = useGameDialog()
const settings = computed(() => preferences.settings.value)
const tutorialProgressLabel = computed(() => help.tutorial.value.completed
  ? 'Terminé'
  : help.tutorial.value.startedAt
    ? `Étape ${help.tutorial.value.stepIndex + 1}`
    : 'Pas encore commencé')
const textSizeOptions = [
  { id: 'SMALL' as const, label: 'Petit', description: 'Taille compacte, proche de l’interface actuelle.' },
  { id: 'MEDIUM' as const, label: 'Moyen', description: 'Lisibilité renforcée sans agrandir excessivement les panneaux.' },
  { id: 'LARGE' as const, label: 'Grand', description: 'Texte nettement agrandi pour un meilleur confort visuel.' },
]

const roastFrequencyOptions = [
  { id: 'RARE' as const, label: 'Rare', description: 'Une apparition ponctuelle, seulement sur les situations les plus marquantes.' },
  { id: 'STANDARD' as const, label: 'Standard', description: 'Le rythme recommandé : présent sans prendre le contrôle de l’interface.' },
  { id: 'FREQUENT' as const, label: 'Fréquent', description: 'Davantage de réactions, toujours avec anti-répétition et cooldown.' },
]


function eventChecked(event: Event) {
  return (event.target as HTMLInputElement).checked
}

function eventVolume(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

async function resetTutorial() {
  const confirmed = await dialogs.confirm(
    i18n.t('Recommencer le tutoriel depuis le début ?'),
    {
      title: i18n.t('Tutoriel'),
      confirmLabel: i18n.t('Recommencer'),
      cancelLabel: i18n.t('Annuler'),
    },
  )
  if (confirmed) help.resetTutorial()
}

async function resetSettings() {
  const confirmed = await dialogs.confirm(
    i18n.t('Réinitialiser les paramètres de CLU Métropole ?'),
    {
      title: i18n.t('Réinitialiser les paramètres'),
      confirmLabel: i18n.t('Réinitialiser'),
      cancelLabel: i18n.t('Annuler'),
      tone: 'DANGER',
    },
  )
  if (confirmed) preferences.reset()
}
</script>

<template>
  <div class="settings-panel">
    <section class="settings-section settings-section--language">
      <div class="section-copy">
        <span class="settings-kicker">Langue</span>
        <h3>Langue de l’interface</h3>
        <p>La langue est enregistrée localement et peut être changée à tout moment.</p>
      </div>
      <div class="language-grid" role="radiogroup" aria-label="Langue de l’interface">
        <button
          v-for="option in GAME_LOCALE_OPTIONS"
          :key="option.id"
          type="button"
          data-i18n-skip
          role="radio"
          :aria-checked="settings.locale === option.id"
          :class="{ active: settings.locale === option.id }"
          @click="preferences.update({ locale: option.id })"
        >
          {{ option.label }}
        </button>
      </div>
    </section>
    <section class="settings-section">
      <div class="section-copy">
        <span class="settings-kicker">Graphismes</span>
        <h3>Qualité de rendu</h3>
        <p>Les graphismes sont maintenant une préférence globale et ne font plus partie des règles d’une nouvelle partie.</p>
      </div>
      <div class="option-grid option-grid--three">
        <button
          v-for="option in GAME_GRAPHICS_OPTIONS"
          :key="option.id"
          type="button"
          :class="{ active: settings.graphicsQuality === option.id }"
          :aria-pressed="settings.graphicsQuality === option.id"
          @click="preferences.update({ graphicsQuality: option.id })"
        >
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </button>
      </div>
      <div class="toggle-grid">
        <label>
          <input
            type="checkbox"
            :checked="settings.vehicleAnimations"
            @change="preferences.update({ vehicleAnimations: eventChecked($event) })"
          >
          <span><strong>Véhicules animés</strong><small>Affiche les circulations mobiles sur la carte.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="settings.buildings2D5"
            @change="preferences.update({ buildings2D5: eventChecked($event) })"
          >
          <span><strong>Bâtiments 2.5D</strong><small>Active le relief des bâtiments aux niveaux de zoom adaptés.</small></span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-copy">
        <span class="settings-kicker">Audio</span>
        <h3>Musique & effets</h3>
        <p>Réglez la musique et les effets sonores de CLU Métropole.</p>
      </div>
      <div class="audio-mixer">
        <div class="audio-row">
          <div><strong>Volume général</strong><small>Contrôle tout l’audio du jeu.</small></div>
          <button type="button" :class="{ muted: settings.masterMuted }" @click="preferences.update({ masterMuted: !settings.masterMuted })">{{ settings.masterMuted ? 'Réactiver' : 'Muet' }}</button>
          <input type="range" min="0" max="100" step="1" :value="settings.masterVolume" aria-label="Volume général" @input="preferences.update({ masterVolume: eventVolume($event) })">
          <b>{{ settings.masterVolume }}%</b>
        </div>
        <div class="audio-row">
          <div><strong>Musique</strong><small>Menu principal et ambiance musicale en partie.</small></div>
          <button type="button" :class="{ muted: settings.musicMuted }" @click="preferences.update({ musicMuted: !settings.musicMuted })">{{ settings.musicMuted ? 'Réactiver' : 'Muet' }}</button>
          <input type="range" min="0" max="100" step="1" :value="settings.musicVolume" aria-label="Volume de la musique" @input="preferences.update({ musicVolume: eventVolume($event) })">
          <b>{{ settings.musicVolume }}%</b>
        </div>
        <div class="audio-row">
          <div><strong>Effets sonores</strong><small>Validation, alertes, construction et actions importantes.</small></div>
          <button type="button" :class="{ muted: settings.sfxMuted }" @click="preferences.update({ sfxMuted: !settings.sfxMuted })">{{ settings.sfxMuted ? 'Réactiver' : 'Muet' }}</button>
          <input type="range" min="0" max="100" step="1" :value="settings.sfxVolume" aria-label="Volume des effets sonores" @input="preferences.update({ sfxVolume: eventVolume($event) })">
          <b>{{ settings.sfxVolume }}%</b>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-copy">
        <span class="settings-kicker">Confort</span>
        <h3>Interface & mouvement</h3>
        <p>Ces choix ne modifient jamais l’économie ni les règles d’une sauvegarde.</p>
      </div>
      <div class="text-size-setting">
        <span class="settings-kicker">Taille des textes</span>
        <div class="option-grid option-grid--three" role="radiogroup" aria-label="Taille des textes">
          <button
            v-for="option in textSizeOptions"
            :key="option.id"
            type="button"
            role="radio"
            :aria-checked="settings.textSize === option.id"
            :class="{ active: settings.textSize === option.id }"
            @click="preferences.update({ textSize: option.id })"
          >
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
      </div>
      <div class="toggle-grid">
        <label>
          <input
            type="checkbox"
            :checked="settings.reducedMotion"
            @change="preferences.update({ reducedMotion: eventChecked($event) })"
          >
          <span><strong>Réduire les animations</strong><small>Limite les transitions et coupe les véhicules animés pour réduire les mouvements.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="settings.highContrast"
            @change="preferences.update({ highContrast: eventChecked($event) })"
          >
          <span><strong>Contraste renforcé</strong><small>Renforce les textes secondaires, bordures et états sélectionnés sans changer les règles du jeu.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="settings.contextualTips"
            @change="preferences.update({ contextualTips: eventChecked($event) })"
          >
          <span><strong>Conseils contextuels</strong><small>Affiche les petites indications utiles dans les modules existants.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="settings.wikiEnabled"
            @change="preferences.update({ wikiEnabled: eventChecked($event) })"
          >
          <span><strong>Wiki contextuel</strong><small>Affiche l’aide complète et les raccourcis ? depuis les modules de jeu.</small></span>
        </label>
        <label>
          <input
            type="checkbox"
            :checked="settings.cluRoastEnabled"
            @change="preferences.update({ cluRoastEnabled: eventChecked($event) })"
          >
          <span><strong>CLU Roast</strong><small>Active les commentaires de personnalité liés à votre vraie gestion. Désactivez-le pour une expérience entièrement neutre.</small></span>
        </label>
      </div>
      <div v-if="settings.cluRoastEnabled" class="roast-frequency">
        <span class="settings-kicker">Fréquence du Roast</span>
        <div class="option-grid option-grid--three">
          <button
            v-for="option in roastFrequencyOptions"
            :key="option.id"
            type="button"
            :class="{ active: settings.cluRoastFrequency === option.id }"
            :aria-pressed="settings.cluRoastFrequency === option.id"
            @click="preferences.update({ cluRoastFrequency: option.id })"
          >
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-copy">
        <span class="settings-kicker">Aide</span>
        <h3>Tutoriel & Wiki</h3>
        <p>Le tutoriel reste toujours disponible depuis le menu pause, y compris pendant les défis. Le Wiki reste consultable à tout moment sans modifier la partie.</p>
      </div>
      <div class="help-settings-row">
        <div><strong>Progression du tutoriel</strong><small>{{ tutorialProgressLabel }}</small></div>
        <button type="button" @click="resetTutorial">Recommencer</button>
      </div>
    </section>


    <div class="settings-footer">
      <span>Les paramètres sont enregistrés localement pour toutes les parties.</span>
      <button type="button" @click="resetSettings">Réinitialiser</button>
    </div>
  </div>
</template>

<style scoped>
.settings-panel{display:grid;gap:14px}.language-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.language-grid button{padding:10px 8px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.035);color:inherit;cursor:pointer;font-weight:750;font-size:calc(10px * var(--clu-text-scale,1))}.language-grid button.active{border-color:rgba(79,211,220,.55);background:rgba(79,211,220,.13);box-shadow:inset 0 0 0 1px rgba(79,211,220,.12)}.settings-section{padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.03)}.section-copy{margin-bottom:12px}.settings-kicker{font-size:calc(9px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#72d8df;font-weight:800}.section-copy h3{margin:3px 0 4px;font-size:calc(15px * var(--clu-text-scale,1))}.section-copy p{margin:0;font-size:calc(10px * var(--clu-text-scale,1));line-height:1.5;opacity:.58}.option-grid{display:grid;gap:7px}.option-grid--three{grid-template-columns:repeat(3,minmax(0,1fr))}.option-grid button{min-height:78px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.035);color:inherit;text-align:left;display:grid;align-content:start;gap:4px;cursor:pointer}.option-grid button:hover{background:rgba(255,255,255,.065)}.option-grid button.active{border-color:rgba(79,211,220,.52);background:rgba(79,211,220,.12)}.option-grid strong{font-size:calc(11px * var(--clu-text-scale,1))}.option-grid small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.52}.toggle-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}.toggle-grid label{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:11px;background:rgba(255,255,255,.035);cursor:pointer}.toggle-grid input{margin-top:2px}.toggle-grid span{display:grid;gap:2px}.toggle-grid strong{font-size:calc(10px * var(--clu-text-scale,1))}.toggle-grid small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.5}.audio-mixer{display:grid;gap:8px}.audio-row{display:grid;grid-template-columns:minmax(170px,1fr) auto minmax(130px,1.25fr) 44px;align-items:center;gap:10px;padding:10px;border-radius:11px;background:rgba(255,255,255,.035)}.audio-row>div{display:grid;gap:2px}.audio-row strong{font-size:calc(10px * var(--clu-text-scale,1))}.audio-row small{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.35;opacity:.5}.audio-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:8px;padding:7px 8px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}.audio-row button.muted{border-color:rgba(255,174,91,.35);color:#f2c780;background:rgba(255,174,91,.08)}.audio-row input[type=range]{width:100%;accent-color:#58d2da}.audio-row>b{font-size:calc(9px * var(--clu-text-scale,1));text-align:right;opacity:.68}.text-size-setting{display:grid;gap:7px;margin-bottom:9px}.roast-frequency{display:grid;gap:7px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}.help-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:11px;background:rgba(255,255,255,.035)}.help-settings-row>div{display:grid;gap:2px}.help-settings-row strong{font-size:calc(10px * var(--clu-text-scale,1))}.help-settings-row small{font-size:calc(9px * var(--clu-text-scale,1));opacity:.5}.help-settings-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:8px;padding:8px 10px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}.settings-section--future{border-style:dashed;opacity:.75}.settings-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:2px}.settings-footer span{font-size:calc(9px * var(--clu-text-scale,1));opacity:.48}.settings-footer button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:calc(10px * var(--clu-text-scale,1))}@media(max-width:680px){.language-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.option-grid--three,.toggle-grid{grid-template-columns:1fr}.audio-row{grid-template-columns:1fr auto}.audio-row input[type=range]{grid-column:1/-1}.audio-row>b{display:none}.settings-footer{align-items:flex-start;flex-direction:column}}
</style>
