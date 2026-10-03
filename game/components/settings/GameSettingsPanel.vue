<script setup lang="ts">
import { computed } from 'vue'
import { GAME_GRAPHICS_OPTIONS } from '../../config/settings'
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
const themeOptions = [
  { id: 'DARK' as const, label: 'Sombre', description: 'Interface sombre, idéale sur la carte.' },
  { id: 'LIGHT' as const, label: 'Clair', description: 'Panneaux clairs et textes foncés.' },
]

const textSizeOptions = [
  { id: 'SMALL' as const, label: 'Petit', description: 'Taille compacte, proche de l’interface actuelle.' },
  { id: 'MEDIUM' as const, label: 'Moyen', description: 'Lisibilité renforcée sans agrandir excessivement les panneaux.' },
  { id: 'LARGE' as const, label: 'Grand', description: 'Texte nettement agrandi pour un meilleur confort visuel.' },
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
    <section class="settings-hero">
      <span class="settings-hero__icon" aria-hidden="true">⚙</span>
      <div>
        <p>Préférences globales</p>
        <h3>Votre expérience CLU</h3>
        <small>Graphismes, son, lisibilité et aide. Ces réglages s’appliquent à toutes vos parties sans modifier leurs règles.</small>
      </div>
    </section>
    <section class="settings-section">
      <div class="section-copy">
        <span class="settings-kicker">Graphismes</span>
        <h3>Qualité de rendu</h3>
        <p>Les graphismes sont maintenant une préférence globale et ne font plus partie des règles d’une nouvelle partie.</p>
      </div>
      <div class="option-grid option-grid--graphics">
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
      <div class="theme-setting">
        <span class="settings-kicker">Thème de l’interface</span>
        <div class="theme-switch" role="radiogroup" aria-label="Thème de l’interface">
          <button
            v-for="option in themeOptions"
            :key="option.id"
            type="button"
            role="radio"
            :aria-checked="settings.theme === option.id"
            :class="{ active: settings.theme === option.id }"
            @click="preferences.update({ theme: option.id })"
          >
            <span>{{ option.id === 'DARK' ? '◐' : '◑' }}</span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>
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
.settings-panel{display:grid;gap:12px;color:#f5fbff}
.settings-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;padding:18px;border:1px solid rgba(78,214,224,.2);border-radius:18px;background:linear-gradient(125deg,rgba(32,126,139,.18),rgba(10,20,28,.5));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.settings-hero__icon{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:linear-gradient(145deg,rgba(81,217,226,.2),rgba(37,89,103,.18));border:1px solid rgba(106,228,235,.18);font-size:22px;box-shadow:0 10px 28px rgba(0,0,0,.18)}
.settings-hero p{margin:0 0 3px;font-size:calc(8px * var(--clu-text-scale,1));font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#7ce0e6}.settings-hero h3{margin:0 0 4px;font-size:calc(20px * var(--clu-text-scale,1));letter-spacing:-.03em}.settings-hero small{display:block;max-width:700px;font-size:calc(9.5px * var(--clu-text-scale,1));line-height:1.5;color:rgba(229,243,250,.58)}
.settings-section{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
.section-copy{margin-bottom:12px}.settings-kicker{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.14em;color:#71dce3;font-weight:900}.section-copy h3{margin:3px 0 4px;font-size:calc(15px * var(--clu-text-scale,1));letter-spacing:-.02em}.section-copy p{margin:0;font-size:calc(9.5px * var(--clu-text-scale,1));line-height:1.45;color:rgba(230,242,250,.5)}
.option-grid{display:grid;gap:8px}.option-grid--three{grid-template-columns:repeat(3,minmax(0,1fr))}.option-grid--graphics{grid-template-columns:repeat(4,minmax(0,1fr))}.option-grid button{min-height:76px;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(7,16,23,.5);color:inherit;text-align:left;display:grid;align-content:start;gap:4px;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease}.option-grid button:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.045)}.option-grid button.active{border-color:rgba(83,218,227,.5);background:linear-gradient(145deg,rgba(59,188,199,.14),rgba(15,31,40,.52));box-shadow:inset 0 0 0 1px rgba(81,210,220,.06)}.option-grid strong{font-size:calc(10.5px * var(--clu-text-scale,1))}.option-grid small{font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.4;color:rgba(232,242,248,.48)}
.toggle-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.toggle-grid label{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid rgba(255,255,255,.045);border-radius:12px;background:rgba(7,16,23,.38);cursor:pointer}.toggle-grid input{margin-top:2px;accent-color:#58d4dc}.toggle-grid span{display:grid;gap:2px}.toggle-grid strong{font-size:calc(10px * var(--clu-text-scale,1))}.toggle-grid small{font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.4;color:rgba(230,242,248,.46)}
.audio-mixer{display:grid;gap:8px}.audio-row{display:grid;grid-template-columns:minmax(165px,1fr) auto minmax(150px,1.25fr) 44px;align-items:center;gap:10px;padding:11px 12px;border:1px solid rgba(255,255,255,.045);border-radius:12px;background:rgba(7,16,23,.38)}.audio-row>div{display:grid;gap:2px}.audio-row strong{font-size:calc(10px * var(--clu-text-scale,1))}.audio-row small{font-size:calc(8.5px * var(--clu-text-scale,1));line-height:1.35;color:rgba(230,242,248,.45)}.audio-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:9px;padding:7px 9px;cursor:pointer;font-size:calc(8.5px * var(--clu-text-scale,1))}.audio-row button.muted{border-color:rgba(255,174,91,.35);color:#f2c780;background:rgba(255,174,91,.08)}.audio-row input[type=range]{width:100%;accent-color:#58d2da}.audio-row>b{font-size:calc(8.5px * var(--clu-text-scale,1));text-align:right;color:rgba(240,249,252,.65)}
.text-size-setting{display:grid;gap:7px;margin-bottom:9px}.help-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid rgba(255,255,255,.045);border-radius:12px;background:rgba(7,16,23,.38)}.help-settings-row>div{display:grid;gap:2px}.help-settings-row strong{font-size:calc(10px * var(--clu-text-scale,1))}.help-settings-row small{font-size:calc(8.5px * var(--clu-text-scale,1));color:rgba(230,242,248,.46)}.help-settings-row button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:calc(8.5px * var(--clu-text-scale,1))}.settings-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 2px 0}.settings-footer span{font-size:calc(8.5px * var(--clu-text-scale,1));color:rgba(230,242,248,.42)}.settings-footer button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);color:inherit;border-radius:9px;padding:8px 10px;cursor:pointer;font-size:calc(9px * var(--clu-text-scale,1))}
@media(max-width:680px){.settings-hero{padding:14px}.option-grid--three,.option-grid--graphics,.toggle-grid{grid-template-columns:1fr}.audio-row{grid-template-columns:1fr auto}.audio-row input[type=range]{grid-column:1/-1}.audio-row>b{display:none}.settings-footer{align-items:flex-start;flex-direction:column}}

/* Paramètres — grands modules horizontaux comme le menu principal */
.settings-panel{gap:14px;perspective:1500px}
.settings-hero{
  min-height:116px;
  gap:18px;
  padding:21px 22px;
  border-radius:22px;
  border-color:rgba(74,222,234,.26);
  background:linear-gradient(105deg,rgba(31,140,155,.24),rgba(8,23,35,.53));
  backdrop-filter:blur(16px);
  box-shadow:0 20px 50px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.055);
  transform:perspective(1500px) rotateY(-1.35deg);
  transform-origin:left center;
}
.settings-hero__icon{width:62px;height:62px;border-radius:19px;font-size:27px;background:linear-gradient(145deg,rgba(76,221,232,.23),rgba(30,84,99,.16));box-shadow:0 15px 34px rgba(0,0,0,.18),0 0 24px rgba(73,220,232,.06)}
.settings-hero p{font-size:calc(8px * var(--clu-text-scale,1));letter-spacing:.18em}
.settings-hero h3{margin-bottom:5px;font-size:calc(28px * var(--clu-text-scale,1));line-height:1;letter-spacing:-.05em}
.settings-hero small{font-size:calc(9.5px * var(--clu-text-scale,1));color:rgba(232,246,252,.62)}
.settings-section{
  position:relative;
  display:grid;
  grid-template-columns:minmax(185px,220px) minmax(0,1fr);
  gap:12px 20px;
  padding:17px 19px;
  border-radius:19px;
  border-color:rgba(255,255,255,.075);
  background:linear-gradient(105deg,rgba(17,39,52,.58),rgba(7,19,29,.42));
  backdrop-filter:blur(13px);
  box-shadow:0 14px 36px rgba(0,0,0,.11),inset 0 1px 0 rgba(255,255,255,.028);
  transform:perspective(1500px) rotateY(-.55deg);
  transform-origin:left center;
}
.settings-section::before{content:"";position:absolute;left:0;top:15px;bottom:15px;width:2px;border-radius:9px;background:linear-gradient(180deg,transparent,rgba(69,220,233,.58),transparent);opacity:.78}
.settings-section:nth-of-type(even){transform:perspective(1500px) rotateY(.4deg);transform-origin:right center}
.section-copy{grid-column:1;grid-row:1/-1;margin:0;padding-right:4px;align-self:start}
.section-copy h3{margin-top:5px;font-size:calc(17px * var(--clu-text-scale,1));letter-spacing:-.035em}
.section-copy p{font-size:calc(9px * var(--clu-text-scale,1));line-height:1.52;color:rgba(231,244,250,.50)}
.settings-section>.option-grid,.settings-section>.toggle-grid,.settings-section>.audio-mixer,.settings-section>.text-size-setting,.settings-section>.help-settings-row{grid-column:2}
.option-grid button{min-height:72px;border-radius:13px;background:rgba(4,14,22,.46);backdrop-filter:blur(8px)}
.option-grid button.active{border-color:rgba(77,221,232,.49);background:linear-gradient(145deg,rgba(56,194,205,.15),rgba(9,27,38,.52));box-shadow:0 10px 24px rgba(0,0,0,.09),inset 0 1px 0 rgba(255,255,255,.03)}
.toggle-grid{margin-top:0}.toggle-grid label{min-height:64px;border-radius:13px;background:rgba(4,14,22,.38);border-color:rgba(255,255,255,.05)}
.audio-mixer{gap:7px}.audio-row{min-height:62px;border-radius:13px;background:rgba(4,14,22,.40);border-color:rgba(255,255,255,.05)}
.help-settings-row{min-height:66px;border-radius:13px;background:rgba(4,14,22,.38)}
.settings-footer{padding:4px 5px 0 12px}.settings-footer button{min-height:38px;padding:0 12px;border-radius:11px}
@media(max-width:760px){.settings-hero{transform:none;padding:16px}.settings-hero h3{font-size:calc(23px * var(--clu-text-scale,1))}.settings-section,.settings-section:nth-of-type(even){grid-template-columns:1fr;transform:none;padding:15px}.section-copy{grid-column:1;grid-row:auto}.settings-section>.option-grid,.settings-section>.toggle-grid,.settings-section>.audio-mixer,.settings-section>.text-size-setting,.settings-section>.help-settings-row{grid-column:1}}


/* Paramètres — interface de jeu simple, compacte, sans effet vitrine */
.settings-panel{gap:8px;perspective:none}
.settings-hero{display:none}
.settings-section,
.settings-section:nth-of-type(even){
  position:relative;
  display:grid;
  grid-template-columns:145px minmax(0,1fr);
  gap:10px 14px;
  padding:11px 12px;
  border-radius:10px;
  border-color:rgba(255,255,255,.065);
  background:rgba(255,255,255,.015);
  backdrop-filter:none;
  box-shadow:none;
  transform:none;
}
.settings-section::before{display:none}
.section-copy{grid-column:1;grid-row:1/-1;margin:0;padding:1px 8px 0 0;align-self:start}
.settings-kicker{font-size:calc(6.8px * var(--clu-text-scale,1));letter-spacing:.1em;color:rgba(104,213,222,.72)}
.section-copy h3{margin:3px 0 3px;font-size:calc(11.5px * var(--clu-text-scale,1));letter-spacing:-.01em}
.section-copy p{font-size:calc(7.8px * var(--clu-text-scale,1));line-height:1.35;color:rgba(230,242,248,.38)}
.settings-section>.option-grid,.settings-section>.toggle-grid,.settings-section>.audio-mixer,.settings-section>.text-size-setting,.settings-section>.help-settings-row{grid-column:2}
.option-grid{gap:5px}.option-grid button{min-height:58px;padding:8px 9px;border-radius:8px;background:rgba(4,13,20,.44);backdrop-filter:none}
.option-grid button:hover{transform:none}.option-grid button.active{background:rgba(55,185,196,.08);box-shadow:none}
.option-grid strong{font-size:calc(9px * var(--clu-text-scale,1))}.option-grid small{font-size:calc(7.3px * var(--clu-text-scale,1));line-height:1.3}
.toggle-grid{gap:5px;margin-top:0}.toggle-grid label{min-height:0;padding:8px 9px;border-radius:8px;background:rgba(4,13,20,.34)}
.toggle-grid strong{font-size:calc(8.7px * var(--clu-text-scale,1))}.toggle-grid small{font-size:calc(7.2px * var(--clu-text-scale,1));line-height:1.3}
.audio-mixer{gap:5px}.audio-row{min-height:48px;grid-template-columns:minmax(145px,1fr) auto minmax(120px,1.2fr) 38px;gap:8px;padding:7px 9px;border-radius:8px;background:rgba(4,13,20,.34)}
.audio-row strong{font-size:calc(8.7px * var(--clu-text-scale,1))}.audio-row small{font-size:calc(7px * var(--clu-text-scale,1));line-height:1.25}.audio-row button{padding:5px 7px;border-radius:7px;font-size:calc(7.5px * var(--clu-text-scale,1))}.audio-row>b{font-size:calc(7.5px * var(--clu-text-scale,1))}
.text-size-setting{gap:5px;margin-bottom:6px}.help-settings-row{min-height:0;padding:8px 9px;border-radius:8px;background:rgba(4,13,20,.34)}.help-settings-row strong{font-size:calc(8.7px * var(--clu-text-scale,1))}.help-settings-row small{font-size:calc(7.2px * var(--clu-text-scale,1))}.help-settings-row button{padding:6px 8px;border-radius:7px;font-size:calc(7.5px * var(--clu-text-scale,1))}
.settings-footer{padding:3px 2px 0}.settings-footer span{font-size:calc(7.4px * var(--clu-text-scale,1))}.settings-footer button{min-height:32px;padding:0 9px;border-radius:8px;font-size:calc(8px * var(--clu-text-scale,1))}
@media(max-width:760px){.settings-section,.settings-section:nth-of-type(even){grid-template-columns:1fr;padding:10px}.section-copy{grid-column:1;grid-row:auto;padding:0}.settings-section>.option-grid,.settings-section>.toggle-grid,.settings-section>.audio-mixer,.settings-section>.text-size-setting,.settings-section>.help-settings-row{grid-column:1}.option-grid--graphics,.option-grid--three{grid-template-columns:1fr 1fr}.audio-row{grid-template-columns:1fr auto}.audio-row input[type=range]{grid-column:1/-1}.audio-row>b{display:none}}
@media(max-width:520px){.option-grid--graphics,.option-grid--three,.toggle-grid{grid-template-columns:1fr}}


.theme-setting{display:grid;gap:5px;margin-bottom:7px}.theme-switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.theme-switch button{min-height:46px;display:grid;grid-template-columns:24px minmax(0,1fr);grid-template-areas:'icon title' 'icon copy';align-items:center;column-gap:7px;padding:7px 8px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(4,13,20,.34);color:inherit;text-align:left;cursor:pointer}.theme-switch button>span{grid-area:icon;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.05)}.theme-switch strong{grid-area:title;font-size:calc(8.7px * var(--clu-text-scale,1))}.theme-switch small{grid-area:copy;font-size:calc(7.1px * var(--clu-text-scale,1));line-height:1.25;opacity:.45}.theme-switch button.active{border-color:rgba(79,211,220,.34);background:rgba(79,211,220,.08)}

</style>
