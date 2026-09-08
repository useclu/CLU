<script setup lang="ts">
import { computed, inject } from 'vue'
import { useProject } from '~/stores/useProject'
import { LineContextKey } from '~/utils/symbols'

const {
  color,
  terminus = false,
  connection = false,
  closed = false,
  future = false,
  vertical = false,
  shared = false,
} = defineProps<{
  color: string
  terminus?: boolean
  connection?: boolean
  closed?: boolean
  future?: boolean
  vertical?: boolean
  shared?: boolean
}>()

const lineContext = inject<LineContext>(LineContextKey)!

const project = useProject()

/*
 * Rendu spécifique aux plans :
 *
 * - BUS
 * - BRT / BHNS
 * - NOCTILIEN
 * - CABLE
 * - VELO
 * - BOAT
 *
 * Tous ces modes utilisent le même langage
 * graphique pour les arrêts.
 *
 * Tous les autres modes conservent
 * exactement le rendu BULB classique.
 */
const isBusMode = computed(() =>
  project.line.mode === 'BUS'
  || project.line.mode === 'BRT'
  || project.line.mode === 'NOCTILIEN'
  || project.line.mode === 'CABLE'
  || project.line.mode === 'VELO'
  || project.line.mode === 'BOAT',
)

/*
 * Rendu spécifique au Tram.
 *
 * Il reste volontairement séparé du rendu Bus
 * afin de pouvoir reproduire son propre langage
 * graphique sans modifier les autres modes.
 */
const isTramMode = computed(() =>
  project.line.mode === 'TRAM',
)

const dotColor = computed(() => {
  if (lineContext.dotsColorPolicy.value === 'WHITE') {
    return 'white'
  }

  return color
})

/*
 * =========================================================
 * ARRÊT COMMUN MULTI-LIGNES
 * =========================================================
 *
 * Branch.vue expose sur le wrapper de l'arrêt :
 *
 * --shared-line-top
 * --shared-line-bottom
 * --shared-line-span
 *
 * Ces valeurs suivent l'écart réel entre les rails.
 *
 * StopDot ne duplique donc jamais le point :
 * un arrêt partagé devient UNE SEULE capsule verticale
 * qui traverse exactement toutes les lignes sélectionnées.
 *
 * L'option "Arrêt vertical" historique reste indépendante :
 * elle conserve son rendu BULB classique lorsqu'il ne
 * s'agit pas d'un arrêt partagé.
 */
const sharedMarkerExtra = '.9em'
</script>

<template>
  <div
    class="dot-wrapper flex items-center justify-center relative"
    :class="{
      vertical,
      shared,
      'bus-mode': isBusMode,
      'tram-mode': isTramMode,
    }"
  >
    <!--
      Arrêt partagé multi-lignes :
      un seul marqueur traverse les rails concernés.
    -->
    <div
      v-if="shared"
      class="absolute shared-stop dynamic-part"
      :class="{
        terminus,
        connection: connection || closed,
        future,
      }"
    >
      <div class="shared-stop-dot shared-stop-dot-top" />
      <div class="shared-stop-dot shared-stop-dot-bottom" />
    </div>

    <div
      v-else-if="!vertical"
      class="absolute dot dynamic-part"
      :class="{
        terminus,
        connection: connection || closed,
        future,
      }"
    />

    <div
      v-else
      class="absolute vertical-stop dynamic-part"
      :class="{
        terminus,
        connection: connection || closed,
        future,
      }"
    >
      <div class="vertical-stop-dot vertical-stop-dot-top" />
      <div class="vertical-stop-dot vertical-stop-dot-bottom" />
    </div>

    <img
      v-if="closed"
      class="absolute closed"
      src="~/assets/svg/closed.svg"
    >
  </div>
</template>

<style scoped lang="scss">
.dot-wrapper {
  width: 1em;
  height: 1em;

  &.vertical {
    overflow: visible;
  }
}

/*
 * =========================================================
 * RENDU BULB CLASSIQUE
 * =========================================================
 */

.dot {
  /*
   * ARRÊT CLASSIQUE
   *
   * Le marqueur est explicitement centré sur le point logique
   * de l'arrêt. Sa taille reste indépendante de l'épaisseur
   * du trait : le cercle dépasse donc proprement de la ligne,
   * tout en conservant exactement le même centre vertical.
   */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;

  background-color: v-bind(dotColor);
  border: calc(2em / 16) solid v-bind(color);

  transition:
    filter .2s ease,
    opacity .2s ease,
    width .2s ease,
    height .2s ease,
    background-color .2s ease,
    border-color .2s ease,
    border-width .2s ease,
    box-shadow .2s ease;

  &:hover {
    filter: brightness(.5);
  }

  &.connection {
    background-color: white;
    border: calc(2em / 16) solid black;
  }

  &.terminus {
    background-color: v-bind(color);
    border: calc(2em / 16) solid black;
    box-shadow: inset 0 0 0 calc(3em / 16) white;
  }

  &.future {
    background-color: white;
    border: calc(2em / 16) dashed v-bind(color);
    box-shadow: none;
    opacity: .65;
  }

  &.future.connection {
    background-color: white;
    border: calc(2em / 16) dashed black;
  }

  &.future.terminus {
    background-color: white;
    border: calc(2em / 16) dashed v-bind(color);
    box-shadow: none;
  }
}

/*
 * =========================================================
 * ARRÊT COMMUN MULTI-LIGNES
 * =========================================================
 *
 * Une seule capsule, dimensionnée avec l'écart réel calculé
 * dans Branch.vue. Elle traverse les rails sans créer deux
 * cercles superposés.
 */
.shared-stop {
  top: 50%;
  left: 50%;

  transform:
    translate(-50%, -50%);

  width: 1.125em;

  height:
    calc(
      var(--shared-line-span, 0px)
      + v-bind(sharedMarkerExtra)
    );

  min-height: 1.125em;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;

  padding:
    .22em
    0;

  box-sizing: border-box;

  background-color: white;

  border:
    calc(2em / 16)
    solid
    black;

  border-radius: .5625em;

  z-index: 2;

  transition:
    filter .2s ease,
    opacity .2s ease,
    height .2s ease,
    border-color .2s ease,
    border-width .2s ease,
    background-color .2s ease;

  &:hover {
    filter: brightness(.5);
  }

  &.future {
    border:
      calc(2em / 16)
      dashed
      v-bind(color);

    opacity: .65;
  }

  &.connection {
    border-color: black;
  }

  &.future.connection {
    border-color: black;
    border-style: dashed;
  }

  &.terminus {
    border-color: black;
  }

  &.future.terminus {
    border-color: v-bind(color);
    border-style: dashed;
  }
}

.shared-stop-dot {
  width: .3em;
  height: .3em;

  flex-shrink: 0;

  border-radius: 50%;

  background-color:
    v-bind(color);

  transition:
    opacity .2s ease,
    background-color .2s ease;
}

.shared-stop.future {
  .shared-stop-dot {
    opacity: .65;
  }
}

/*
 * =========================================================
 * ARRÊT VERTICAL BULB CLASSIQUE
 * =========================================================
 */

.vertical-stop {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  width: 1.125em;
  height: 1.75em;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;

  padding-top: .22em;
  padding-bottom: .22em;

  background-color: white;

  border:
    calc(2em / 16)
    solid
    black;

  border-radius: .5625em;

  box-sizing: border-box;

  transition:
    filter .2s ease,
    opacity .2s ease,
    width .2s ease,
    height .2s ease,
    border-color .2s ease,
    border-width .2s ease,
    background-color .2s ease;

  &:hover {
    filter: brightness(.5);
  }

  &.future {
    border:
      calc(2em / 16)
      dashed
      v-bind(color);

    opacity: .65;
  }
}

.vertical-stop-dot {
  width: .3em;
  height: .3em;

  flex-shrink: 0;

  border-radius: 50%;

  background-color: v-bind(color);

  transition:
    width .2s ease,
    height .2s ease,
    background-color .2s ease;
}

.vertical-stop.future {
  .vertical-stop-dot {
    opacity: .65;
  }
}

.vertical-stop.connection {
  border-color: black;
}

.vertical-stop.future.connection {
  border-color: black;
  border-style: dashed;
}

.vertical-stop.terminus {
  border-color: black;
}

.vertical-stop.future.terminus {
  border-color: v-bind(color);
  border-style: dashed;
}

/*
 * =========================================================
 * BUS / BRT / NOCTILIEN / CABLE / VELO / BOAT
 * =========================================================
 *
 * Petits points blancs cerclés de noir
 * directement posés sur la ligne.
 *
 * La couleur de la ligne reste l'élément
 * graphique principal.
 */

.dot-wrapper.bus-mode {
  .dot {
    width: .58em;
    height: .58em;

    background-color: white;

    border:
      .105em
      solid
      #222;

    box-shadow: none;

    opacity: 1;
  }

  .dot.connection {
    width: .68em;
    height: .68em;

    background-color: white;

    border:
      .11em
      solid
      #222;

    box-shadow: none;
  }

  .dot.terminus {
    width: .76em;
    height: .76em;

    background-color: white;

    border:
      .13em
      solid
      #222;

    box-shadow: none;
  }

  .dot.terminus.connection {
    width: .76em;
    height: .76em;

    background-color: white;

    border:
      .13em
      solid
      #222;

    box-shadow: none;
  }

  .dot.future {
    width: .58em;
    height: .58em;

    background-color: white;

    border:
      .105em
      dashed
      v-bind(color);

    box-shadow: none;

    opacity: .65;
  }

  .dot.future.connection {
    width: .68em;
    height: .68em;

    background-color: white;

    border:
      .11em
      dashed
      #222;

    box-shadow: none;

    opacity: .65;
  }

  .dot.future.terminus {
    width: .76em;
    height: .76em;

    background-color: white;

    border:
      .13em
      dashed
      v-bind(color);

    box-shadow: none;

    opacity: .65;
  }

  /*
   * Un arrêt commun multi-lignes reste un marqueur commun :
   * le langage Bus ne doit pas le réduire à un petit point.
   */
  .shared-stop {
    width: .8em;

    border-width: .105em;
    border-color: #222;

    border-radius: .4em;
  }

  .shared-stop-dot {
    width: .19em;
    height: .19em;

    background-color: #222;
  }

  /*
   * =======================================================
   * CAPSULE VERTICALE
   * =======================================================
   */

  .vertical-stop {
    width: .8em;
    height: 1.35em;

    padding-top: .17em;
    padding-bottom: .17em;

    background-color: white;

    border:
      .105em
      solid
      #222;

    border-radius: .4em;
  }

  .vertical-stop-dot {
    width: .19em;
    height: .19em;

    background-color: #222;
  }

  .vertical-stop.connection {
    width: .86em;

    border-color: #222;
    border-width: .11em;
  }

  .vertical-stop.terminus {
    width: .86em;

    border-color: #222;
    border-width: .12em;
  }

  .vertical-stop.future {
    border:
      .105em
      dashed
      v-bind(color);

    opacity: .65;
  }

  .vertical-stop.future.connection {
    border-color: #222;
    border-style: dashed;
  }

  .vertical-stop.future.terminus {
    border-color: v-bind(color);
    border-style: dashed;
  }
}

/*
 * =========================================================
 * TRAMWAY
 * =========================================================
 *
 * Le Tram possède son propre rendu.
 *
 * - ligne plus fine gérée dans Branch.vue ;
 * - petits arrêts blancs cerclés de noir ;
 * - correspondances légèrement renforcées ;
 * - terminus plus grands avec double anneau.
 */

.dot-wrapper.tram-mode {
  /*
   * Arrêt Tram classique.
   */
  .dot {
    width: .52em;
    height: .52em;

    background-color: white;

    border:
      .095em
      solid
      #222;

    box-shadow: none;

    opacity: 1;
  }

  /*
   * Arrêt avec correspondance.
   */
  .dot.connection {
    width: .62em;
    height: .62em;

    background-color: white;

    border:
      .105em
      solid
      #222;

    box-shadow: none;
  }

  /*
   * Terminus Tram.
   *
   * Le cercle est plus important que celui
   * d'un arrêt classique et possède un
   * deuxième anneau intérieur.
   */
  .dot.terminus {
    width: .82em;
    height: .82em;

    background-color: white;

    border:
      .12em
      solid
      #222;

    box-shadow:
      inset 0 0 0 .10em white,
      inset 0 0 0 .19em #222;
  }

  .dot.terminus.connection {
    width: .82em;
    height: .82em;

    background-color: white;

    border:
      .12em
      solid
      #222;

    box-shadow:
      inset 0 0 0 .10em white,
      inset 0 0 0 .19em #222;
  }

  /*
   * Arrêt futur.
   */
  .dot.future {
    width: .52em;
    height: .52em;

    background-color: white;

    border:
      .095em
      dashed
      v-bind(color);

    box-shadow: none;

    opacity: .65;
  }

  /*
   * Arrêt futur avec correspondance.
   */
  .dot.future.connection {
    width: .62em;
    height: .62em;

    background-color: white;

    border:
      .105em
      dashed
      #222;

    box-shadow: none;

    opacity: .65;
  }

  /*
   * Terminus futur.
   */
  .dot.future.terminus {
    width: .82em;
    height: .82em;

    background-color: white;

    border:
      .12em
      dashed
      v-bind(color);

    box-shadow: none;

    opacity: .65;
  }

  /*
   * Un arrêt commun multi-lignes Tram reste une capsule
   * unique traversant les rails concernés.
   */
  .shared-stop {
    width: .72em;

    border-width: .095em;
    border-color: #222;

    border-radius: .36em;
  }

  .shared-stop-dot {
    width: .17em;
    height: .17em;

    background-color: #222;
  }

  /*
   * =======================================================
   * SEGMENT VERTICAL TRAM
   * =======================================================
   */

  .vertical-stop {
    width: .72em;
    height: 1.25em;

    padding-top: .16em;
    padding-bottom: .16em;

    background-color: white;

    border:
      .095em
      solid
      #222;

    border-radius: .36em;

    box-shadow: none;
  }

  .vertical-stop-dot {
    width: .17em;
    height: .17em;

    background-color: #222;
  }

  .vertical-stop.connection {
    width: .78em;

    border-color: #222;
    border-width: .105em;
  }

  .vertical-stop.terminus {
    width: .82em;

    border-color: #222;
    border-width: .12em;
  }

  .vertical-stop.future {
    border:
      .095em
      dashed
      v-bind(color);

    opacity: .65;
  }

  .vertical-stop.future.connection {
    border-color: #222;
    border-style: dashed;
  }

  .vertical-stop.future.terminus {
    border-color: v-bind(color);
    border-style: dashed;
  }
}

.closed {
  display: flex;
  width: 1em;
  height: 1em;
  scale: 1.375;
  object-fit: cover;
  pointer-events: none;
}
</style>