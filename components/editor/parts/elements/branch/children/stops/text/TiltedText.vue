<script setup lang="ts">
import { computed } from 'vue'
import { useProject } from '~/stores/useProject'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const props = withDefaults(
  defineProps<{
    angle?: number
    reverse?: boolean
  }>(),
  {
    reverse: false,
  },
)

const project = useProject()

/*
 * =========================================================
 * STYLE TRAMWAY
 * =========================================================
 *
 * ANGLED :
 * noms inclinés.
 *
 * HORIZONTAL :
 * noms horizontaux dont la largeur réelle participe
 * à la mise en page.
 *
 * Les anciens projets qui ne possèdent pas encore
 * tramStyle utilisent ANGLED par défaut.
 */
const tramStyle = computed<TramStyle>(() =>
  (
    project.line as Line & {
      tramStyle?: TramStyle
    }
  ).tramStyle
  ?? 'ANGLED',
)

const isTramMode = computed(() =>
  project.line.mode === 'TRAM',
)

const isHorizontalTram = computed(() =>
  isTramMode.value
  && tramStyle.value === 'HORIZONTAL',
)

const isAngledTram = computed(() =>
  isTramMode.value
  && tramStyle.value === 'ANGLED',
)

/*
 * Angle automatique des noms d'arrêts.
 *
 * TRAM + ANGLED :
 * noms inclinés.
 *
 * TRAM + HORIZONTAL :
 * noms horizontaux.
 *
 * BUS / BRT / NOCTILIEN / CABLE / VELO / BOAT :
 * noms inclinés comme sur le rendu Bus.
 *
 * Les autres modes conservent
 * le rendu BULB classique.
 *
 * Si un angle est fourni explicitement par
 * un autre composant, il reste prioritaire.
 */
const effectiveAngle = computed(() => {
  if (props.angle !== undefined) {
    return props.angle
  }

  /*
   * =======================================================
   * TRAMWAY
   * =======================================================
   */
  if (isTramMode.value) {
    if (tramStyle.value === 'HORIZONTAL') {
      return 0
    }

    return -30
  }

  /*
   * =======================================================
   * BUS ET MODES UTILISANT LE STYLE BUS
   * =======================================================
   */
  if (
    project.line.mode === 'BUS'
    || project.line.mode === 'BRT'
    || project.line.mode === 'NOCTILIEN'
    || project.line.mode === 'CABLE'
    || project.line.mode === 'VELO'
    || project.line.mode === 'BOAT'
  ) {
    return -38
  }

  /*
   * =======================================================
   * BULB CLASSIQUE
   * =======================================================
   */
  return -30
})

const angleInDeg = computed(() =>
  `${effectiveAngle.value}deg`,
)
</script>

<template>
  <div
    v-bind="$attrs"
    class="tilted-text"
    :class="{
      reverse: props.reverse,
      'tram-mode': isTramMode,
      'tram-horizontal': isHorizontalTram,
      'tram-angled': isAngledTram,
    }"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
/*
 * =========================================================
 * COMPORTEMENT HISTORIQUE
 * =========================================================
 *
 * Le contenu est normalement positionné en absolu.
 *
 * On conserve exactement ce comportement pour :
 *
 * - BULB classique ;
 * - Bus ;
 * - BRT ;
 * - Noctilien ;
 * - Cable ;
 * - Vélo ;
 * - Bateau ;
 * - Tram Incliné.
 */

.tilted-text {
  position: relative;

  display: block;

  min-width: 1em;
  height: 0;

  & > * {
    position: absolute;

    left: 50%;
    bottom: 0;

    transform:
      rotate(v-bind(angleInDeg));

    transform-origin:
      bottom left;
  }

  &.reverse > * {
    left: auto;
    bottom: auto;

    right: 50%;
    top: 0;

    transform-origin:
      top right;
  }
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL
 * =========================================================
 *
 * IMPORTANT :
 *
 * Contrairement aux autres rendus, le texte ne doit
 * surtout PAS rester en position absolue.
 *
 * En position absolue, sa largeur visuelle n'est pas
 * comptée par le navigateur dans la largeur du parent.
 *
 * Exemple :
 *
 * Domaine Chérioux
 *
 * pouvait mesurer 150 px visuellement alors que
 * TiltedText continuait à mesurer environ 1em.
 *
 * Stop.vue ne pouvait donc jamais savoir qu'il fallait
 * éloigner les arrêts voisins.
 *
 * Ici le contenu repasse dans le flux normal.
 */

.tilted-text.tram-horizontal {
  display: inline-block;

  width: max-content;
  min-width: max-content;

  height: 0;

  /*
   * Le wrapper prend maintenant réellement
   * la largeur de son contenu.
   */
  & > * {
    position: relative;

    left: auto;
    right: auto;

    top: auto;
    bottom: 0;

    width: max-content;

    transform: none;

    transform-origin:
      center bottom;
  }
}

/*
 * =========================================================
 * TRAMWAY HORIZONTAL INVERSÉ
 * =========================================================
 *
 * Même principe sous la ligne.
 *
 * Le texte reste dans le flux afin que sa largeur
 * soit mesurable, mais son ancrage vertical reste
 * adapté au mode reverse.
 */

.tilted-text.tram-horizontal.reverse {
  & > * {
    position: relative;

    left: auto;
    right: auto;

    top: 0;
    bottom: auto;

    width: max-content;

    transform: none;

    transform-origin:
      center top;
  }
}
</style>