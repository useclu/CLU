<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameHelp } from '../../composables/useGameHelp'
import { useGameI18n } from '../../composables/useGameI18n'
import { useGameDialog } from '../../composables/useGameDialog'

const props = defineProps<{
  selectedTool: 'NETWORK' | 'MUNICIPALITIES' | 'FINANCES' | 'EVENTS' | 'OBJECTIVES'
  panelOpen: boolean
  lineCount: number
  hasLaunchedLine: boolean
  selectedLine: boolean
  selectedStation: boolean
  bilanOpen: boolean
  day: number
}>()

const emit = defineEmits<{
  wiki: [articleId: string]
}>()

const help = useGameHelp()
const i18n = useGameI18n()
const dialogs = useGameDialog()

type TutorialStep = {
  title: string
  instruction: string
  hint: string
  wiki?: string
  complete: () => boolean
}

const steps = computed<TutorialStep[]>(() => {
  const baselineLineCount = help.tutorial.value.baselineLineCount
  return [
    {
      title: 'Bienvenue dans CLU Métropole',
      instruction: 'Ce tutoriel se déroule dans votre vraie partie. Rien n’est simulé : chaque étape vous fait utiliser les vrais outils du réseau.',
      hint: 'Cliquez sur Suivant pour commencer. Vous pourrez l’ignorer ou le reprendre plus tard.',
      wiki: 'prise-en-main',
      complete: () => true,
    },
    {
      title: 'Ouvrez Réseau',
      instruction: 'Cliquez sur Réseau dans la barre d’outils à gauche. C’est le centre opérationnel de vos lignes.',
      hint: 'L’étape est validée lorsque le panneau Réseau est réellement ouvert.',
      wiki: 'reseau',
      complete: () => props.panelOpen && props.selectedTool === 'NETWORK',
    },
    {
      title: baselineLineCount === 0 ? 'Construisez votre première ligne' : 'Sélectionnez une ligne',
      instruction: baselineLineCount === 0
        ? 'Utilisez Créer, choisissez un mode, placez au moins deux stations et lancez les travaux. Surveillez Prix total avant de valider.'
        : 'Dans Réseau ou directement sur la carte, sélectionnez une ligne existante pour afficher ses détails opérationnels.',
      hint: baselineLineCount === 0
        ? 'Cette étape est validée dès qu’une vraie ligne a été créée dans la sauvegarde.'
        : 'Cette étape est validée lorsque CLU possède une ligne sélectionnée.',
      wiki: 'construction-ligne',
      complete: () => baselineLineCount === 0 ? props.hasLaunchedLine : props.selectedLine,
    },
    {
      title: 'Inspectez une station',
      instruction: 'Cliquez sur une station de la ligne depuis la carte ou le schéma. Les stations sont de vrais objets éditables et exploitables.',
      hint: 'Sélectionnez une station pour continuer.',
      wiki: 'stations-correspondances',
      complete: () => props.selectedStation,
    },
    {
      title: 'Consultez Finances',
      instruction: 'Ouvrez Finances. Vérifiez la trésorerie, les recettes, les dépenses, la dette et les possibilités de financement.',
      hint: 'Le tutoriel détecte l’ouverture réelle du module.',
      wiki: 'finances',
      complete: () => props.panelOpen && props.selectedTool === 'FINANCES',
    },
    {
      title: 'Regardez les Communes',
      instruction: 'Ouvrez Communes pour voir la relation territoriale, les demandes et les possibilités de négociation ou de cofinancement.',
      hint: 'Le module Communes doit être ouvert.',
      wiki: 'communes',
      complete: () => props.panelOpen && props.selectedTool === 'MUNICIPALITIES',
    },
    {
      title: 'Lisez Événements & Infos',
      instruction: 'Ouvrez Événements. Ce module sert de centre d’attention et met en avant les problèmes ou opportunités réellement importants.',
      hint: 'Le module Événements doit être ouvert.',
      wiki: 'evenements',
      complete: () => props.panelOpen && props.selectedTool === 'EVENTS',
    },
    {
      title: 'Consultez vos Objectifs',
      instruction: 'Ouvrez Objectifs pour voir vos jalons de progression et leurs récompenses sans perdre de vue votre propre stratégie.',
      hint: 'Le module Objectifs doit être ouvert.',
      wiki: 'objectifs',
      complete: () => props.panelOpen && props.selectedTool === 'OBJECTIVES',
    },
    {
      title: 'Ouvrez le Bilan',
      instruction: 'Cliquez sur Bilan dans la barre supérieure. C’est ici que vous relirez la partie depuis le Jour 1 et comparerez les semaines.',
      hint: 'L’étape est validée lorsque le Bilan est vraiment ouvert.',
      wiki: 'bilan',
      complete: () => props.bilanOpen,
    },
    {
      title: 'Faites avancer la métropole',
      instruction: 'Fermez le Bilan puis cliquez sur Jour suivant. La simulation, l’économie, les voyageurs et les événements vont évoluer.',
      hint: `Le tutoriel attend un jour supérieur au Jour ${help.tutorial.value.baselineDay}.`,
      wiki: 'capacite-saturation',
      complete: () => props.day > help.tutorial.value.baselineDay,
    },
    {
      title: 'Tutoriel terminé',
      instruction: 'Vous connaissez maintenant la boucle principale. Continuez librement et utilisez le Wiki lorsque vous voulez comprendre un système en détail.',
      hint: 'Aucune mécanique n’est verrouillée : CLU conseille, explique et vous laisse décider.',
      wiki: 'prise-en-main',
      complete: () => true,
    },
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

function previous() {
  if (index.value > 0) help.setTutorialStep(index.value - 1)
}

async function skip() {
  const confirmed = await dialogs.confirm(
    i18n.t('Ignorer le tutoriel ? Vous pourrez le recommencer depuis le menu ou les Paramètres.'),
    {
      title: i18n.t('Tutoriel'),
      confirmLabel: i18n.t('Ignorer'),
      cancelLabel: i18n.t('Annuler'),
    },
  )
  if (confirmed) help.skipTutorial()
}
</script>

<template>
  <aside class="tutorial-coach" aria-live="polite">
    <header>
      <div><span>Tutoriel</span><strong>Étape {{ index + 1 }} / {{ steps.length }}</strong></div>
      <button type="button" title="Mettre le tutoriel en pause" @click="help.pauseTutorial()">–</button>
    </header>
    <div class="tutorial-progress"><i :style="{ width: `${((index + 1) / steps.length) * 100}%` }" /></div>
    <section>
      <h3>{{ step.title }}</h3>
      <p>{{ step.instruction }}</p>
      <small :class="{ done: validated }">{{ validated ? '✓ Action validée' : step.hint }}</small>
    </section>
    <footer>
      <button type="button" class="ghost" @click="skip">Ignorer</button>
      <button v-if="step.wiki" type="button" class="ghost" @click="emit('wiki', step.wiki)">Wiki</button>
      <span />
      <button type="button" class="ghost" :disabled="index === 0" @click="previous">←</button>
      <button type="button" class="next" :disabled="!validated" @click="next">{{ isLast ? 'Terminer' : 'Suivant' }}</button>
    </footer>
  </aside>
</template>

<style scoped>
.tutorial-coach{position:absolute;z-index:52;right:18px;bottom:18px;width:min(390px,calc(100vw - 36px));border:1px solid rgba(83,216,224,.28);border-radius:16px;background:rgba(9,17,22,.94);backdrop-filter:blur(18px);box-shadow:0 18px 60px rgba(0,0,0,.42);color:#edf6f7;overflow:hidden}.tutorial-coach header{padding:11px 12px 9px 14px;display:flex;align-items:center;justify-content:space-between}.tutorial-coach header>div{display:grid;gap:1px}.tutorial-coach header span{font-size:calc(8px * var(--clu-text-scale,1));text-transform:uppercase;letter-spacing:.13em;color:#75dce3}.tutorial-coach header strong{font-size:calc(10px * var(--clu-text-scale,1));opacity:.58}.tutorial-coach header button{width:27px;height:27px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.04);color:inherit;cursor:pointer}.tutorial-progress{height:2px;background:rgba(255,255,255,.05)}.tutorial-progress i{display:block;height:100%;background:#58d3db;transition:width .2s ease}.tutorial-coach section{padding:15px 16px 14px}.tutorial-coach h3{margin:0 0 7px;font-size:calc(16px * var(--clu-text-scale,1))}.tutorial-coach p{margin:0;font-size:calc(11px * var(--clu-text-scale,1));line-height:1.55;color:rgba(237,246,247,.72)}.tutorial-coach small{display:block;margin-top:11px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.035);font-size:calc(9px * var(--clu-text-scale,1));line-height:1.4;opacity:.62}.tutorial-coach small.done{background:rgba(64,188,123,.1);color:#8fe2b0;opacity:1}.tutorial-coach footer{display:flex;align-items:center;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.06)}.tutorial-coach footer span{flex:1}.tutorial-coach footer button{border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:7px 9px;background:rgba(255,255,255,.045);color:inherit;font-size:calc(9px * var(--clu-text-scale,1));cursor:pointer}.tutorial-coach footer button:disabled{opacity:.35;cursor:not-allowed}.tutorial-coach footer .next{background:rgba(79,211,220,.14);border-color:rgba(79,211,220,.34);color:#b4f5f8}.tutorial-coach footer .ghost{background:transparent}@media(max-width:640px){.tutorial-coach{right:10px;bottom:10px;width:calc(100vw - 20px)}}
</style>
