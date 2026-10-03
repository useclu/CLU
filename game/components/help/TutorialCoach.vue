<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameHelp } from '../../composables/useGameHelp'
import type { GameManagementPanel } from '../../types/game'

const props = defineProps<{
  selectedTool: GameManagementPanel
  panelOpen: boolean
  lineCount: number
  hasLaunchedLine: boolean
  selectedLine: boolean
  selectedStation: boolean
  bilanOpen: boolean
  day: number
}>()

const emit = defineEmits<{ wiki: [articleId: string] }>()
const help = useGameHelp()

type TutorialStep = {
  chapter: string
  title: string
  instruction: string
  hint: string
  wiki?: string
  complete: () => boolean
}

const steps = computed<TutorialStep[]>(() => {
  const baselineLineCount = help.tutorial.value.baselineLineCount
  const baselineDay = help.tutorial.value.baselineDay
  return [
    { chapter: 'Bienvenue', title: 'Votre partie, vos règles', instruction: 'Le tutoriel utilise votre vraie sauvegarde. Rien n’est simulé et aucune action n’est imposée définitivement.', hint: 'Vous pouvez quitter le tutoriel à n’importe quel moment.', wiki: 'prise-en-main', complete: () => true },
    { chapter: 'Carte', title: 'La carte est votre espace de travail', instruction: 'Zoomez, déplacez-vous et observez les villes, les axes et les stations. La carte reste l’outil principal ; les panneaux servent à décider.', hint: 'Prenez quelques secondes pour lire le territoire.', wiki: 'interface', complete: () => true },
    { chapter: 'Réseau', title: 'Ouvrez le module Réseau', instruction: 'Cliquez sur Gérer puis Réseau. Vous y retrouvez vos lignes sans quitter la carte.', hint: 'Ouvrez Réseau pour continuer.', wiki: 'reseau', complete: () => props.panelOpen && props.selectedTool === 'NETWORK' },
    { chapter: 'Construction', title: baselineLineCount === 0 ? 'Créez une première ligne' : 'Choisissez une ligne', instruction: baselineLineCount === 0 ? 'Cliquez sur Créer, choisissez le mode, puis commencez le tracé. Le coût final n’est engagé qu’après validation du projet.' : 'Sélectionnez une ligne existante dans Réseau ou directement sur la carte.', hint: baselineLineCount === 0 ? 'La ligne doit être réellement mise en service.' : 'Sélectionnez une ligne pour continuer.', wiki: 'construction-ligne', complete: () => baselineLineCount === 0 ? props.hasLaunchedLine : props.selectedLine },
    { chapter: 'Construction', title: 'Comprendre le tracé', instruction: 'Assisté suit les corridors pertinents. Libre dessine directement. Vous pouvez réutiliser une station existante pour créer une vraie station partagée.', hint: 'Cette page est informative.', wiki: 'tracage', complete: () => true },
    { chapter: 'Stations', title: 'Inspectez une station', instruction: 'Cliquez sur un arrêt. Une station possède un nom, une fréquentation et peut devenir un point de correspondance.', hint: 'Sélectionnez une station.', wiki: 'stations-correspondances', complete: () => props.selectedStation },
    { chapter: 'Matériel', title: 'Le service dépend du matériel', instruction: 'Ouvrez Matériel. Une fréquence ambitieuse sans assez de véhicules ne peut pas être tenue.', hint: 'Ouvrez Matériel pour continuer.', wiki: 'materiel-roulant', complete: () => props.panelOpen && props.selectedTool === 'FLEET' },
    { chapter: 'Voyageurs', title: 'Regardez les voyageurs', instruction: 'Ouvrez Voyageurs pour voir la demande, l’attente, les correspondances et les lignes qui saturent.', hint: 'Ouvrez Voyageurs.', wiki: 'capacite-saturation', complete: () => props.panelOpen && props.selectedTool === 'PASSENGERS' },
    { chapter: 'Exploitation', title: 'Ouvrez Exploitation', instruction: 'Le PCC, les incidents et la régulation servent à maintenir le service lorsqu’un problème apparaît.', hint: 'Ouvrez Exploitation.', wiki: 'reserve-regulation', complete: () => props.panelOpen && props.selectedTool === 'OPERATIONS' },
    { chapter: 'Territoire', title: 'Les communes ne sont pas décoratives', instruction: 'Ouvrez Territoire. Les communes peuvent demander une desserte, négocier et participer à certains projets.', hint: 'Ouvrez Territoire.', wiki: 'communes', complete: () => props.panelOpen && props.selectedTool === 'MUNICIPALITIES' },
    { chapter: 'Finances', title: 'Regardez avant de construire', instruction: 'Ouvrez Finances. Trésorerie, recettes, coûts et dette doivent être lus ensemble. Emprunter finance un projet mais crée des remboursements futurs.', hint: 'Ouvrez Finances.', wiki: 'finances', complete: () => props.panelOpen && props.selectedTool === 'FINANCES' },
    { chapter: 'À suivre', title: 'Lisez seulement ce qui demande une décision', instruction: 'Ouvrez À suivre. Ce panneau regroupe les alertes importantes et évite de transformer le jeu en liste de notifications.', hint: 'Ouvrez À suivre.', wiki: 'evenements', complete: () => props.panelOpen && props.selectedTool === 'EVENTS' },
    { chapter: 'Progression', title: 'Les objectifs sont des repères', instruction: 'Ouvrez Progression. Les objectifs donnent des caps et des récompenses, mais vous gardez votre stratégie.', hint: 'Ouvrez Progression.', wiki: 'objectifs', complete: () => props.panelOpen && props.selectedTool === 'OBJECTIVES' },
    { chapter: 'Lecture du réseau', title: 'Utilisez Explorer le réseau', instruction: 'La loupe ouvre les recherches de ville, station, ligne, itinéraire et les prochains départs. Elle sert à lire le réseau sans modifier son fonctionnement.', hint: 'Cette page est informative.', wiki: 'explorer-reseau', complete: () => true },
    { chapter: 'Temps', title: 'Passez au jour suivant', instruction: 'Quand vous êtes prêt, faites avancer la journée. La demande, les finances, les incidents et le moral évoluent alors ensemble.', hint: `Passez au-delà du Jour ${baselineDay}.`, wiki: 'simulation-jour', complete: () => props.day > baselineDay },
    { chapter: 'Bilan', title: 'Prenez du recul', instruction: 'Ouvrez le Bilan pour comparer les jours et les semaines. Une mauvaise journée n’est pas forcément une mauvaise tendance.', hint: 'Ouvrez le Bilan.', wiki: 'bilan', complete: () => props.bilanOpen },
    { chapter: 'Aide', title: 'Le Wiki reste disponible', instruction: 'Le bouton ? dans les panneaux ouvre directement l’article lié au système affiché. Vous pouvez aussi rechercher un sujet dans le Wiki complet.', hint: 'Cette page est informative.', wiki: 'wiki-aide', complete: () => true },
    { chapter: 'Terminé', title: 'À vous de jouer', instruction: 'Vous connaissez la boucle principale : construire, exploiter, observer, corriger puis faire avancer la métropole.', hint: 'Vous pourrez relancer ce tutoriel depuis Paramètres.', wiki: 'prise-en-main', complete: () => true },
  ]
})

const index = computed(() => Math.min(help.tutorial.value.stepIndex, steps.value.length - 1))
const step = computed(() => steps.value[index.value])
const completed = computed(() => step.value.complete())
const validated = ref(completed.value)
watch(index, () => { validated.value = step.value.complete() })
watch(completed, value => { if (value) validated.value = true })
const isLast = computed(() => index.value >= steps.value.length - 1)

function next() {
  if (!validated.value) return
  if (isLast.value) help.completeTutorial()
  else help.setTutorialStep(index.value + 1)
}
function previous() { if (index.value > 0) help.setTutorialStep(index.value - 1) }
function skip() { help.skipTutorial() }
</script>

<template>
  <aside class="tutorial-coach" aria-live="polite">
    <header>
      <div><span>{{ step.chapter }}</span><strong>{{ index + 1 }} / {{ steps.length }}</strong></div>
      <div class="header-actions"><button type="button" title="Masquer pour l’instant" @click="help.pauseTutorial()">–</button><button type="button" title="Quitter le tutoriel" @click="skip">×</button></div>
    </header>
    <div class="tutorial-progress"><i :style="{ width: `${((index + 1) / steps.length) * 100}%` }" /></div>
    <section>
      <h3>{{ step.title }}</h3>
      <p>{{ step.instruction }}</p>
      <small :class="{ done: validated }">{{ validated ? '✓ Prêt à continuer' : step.hint }}</small>
    </section>
    <footer>
      <button v-if="step.wiki" type="button" class="wiki" @click="emit('wiki', step.wiki)">En savoir plus</button>
      <span />
      <button type="button" :disabled="index === 0" @click="previous">←</button>
      <button type="button" class="next" :disabled="!validated" @click="next">{{ isLast ? 'Terminer' : 'Suivant' }}</button>
    </footer>
  </aside>
</template>

<style scoped>
.tutorial-coach{position:absolute;z-index:52;right:16px;bottom:16px;width:min(350px,calc(100vw - 32px));border:1px solid rgba(83,216,224,.2);border-radius:13px;background:rgba(9,17,22,.96);box-shadow:0 14px 44px rgba(0,0,0,.34);color:#edf6f7;overflow:hidden}.tutorial-coach header{padding:9px 9px 8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.tutorial-coach header>div:first-child{display:flex;align-items:center;gap:8px}.tutorial-coach header span{font-size:calc(7px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.12em;color:#75dce3;font-weight:800}.tutorial-coach header strong{font-size:calc(8px * var(--clu-text-scale,1));opacity:.42}.header-actions{display:flex;gap:4px}.tutorial-coach header button{width:25px;height:25px;border:1px solid rgba(255,255,255,.07);border-radius:7px;background:rgba(255,255,255,.025);color:inherit;cursor:pointer}.tutorial-progress{height:2px;background:rgba(255,255,255,.04)}.tutorial-progress i{display:block;height:100%;background:#58d3db;transition:width .2s ease}.tutorial-coach section{padding:12px 13px}.tutorial-coach h3{margin:0 0 6px;font-size:calc(13px * var(--clu-text-scale,1));letter-spacing:-.01em}.tutorial-coach p{margin:0;font-size:calc(9.5px * var(--clu-text-scale,1));line-height:1.45;color:rgba(237,246,247,.7)}.tutorial-coach small{display:block;margin-top:9px;padding:6px 7px;border-radius:7px;background:rgba(255,255,255,.025);font-size:calc(8px * var(--clu-text-scale,1));line-height:1.35;opacity:.56}.tutorial-coach small.done{background:rgba(64,188,123,.08);color:#8fe2b0;opacity:1}.tutorial-coach footer{display:flex;align-items:center;gap:5px;padding:8px 9px;border-top:1px solid rgba(255,255,255,.05)}.tutorial-coach footer span{flex:1}.tutorial-coach footer button{border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:6px 8px;background:rgba(255,255,255,.025);color:inherit;font-size:calc(8px * var(--clu-text-scale,1));cursor:pointer}.tutorial-coach footer button:disabled{opacity:.3;cursor:not-allowed}.tutorial-coach footer .next{background:rgba(79,211,220,.11);border-color:rgba(79,211,220,.26);color:#b4f5f8}.tutorial-coach footer .wiki{background:transparent;color:#8fe7ec;border-color:transparent;padding-left:4px}@media(max-width:640px){.tutorial-coach{right:8px;bottom:8px;width:calc(100vw - 16px)}}
</style>
