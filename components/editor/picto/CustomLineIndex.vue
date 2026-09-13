<script setup lang="ts">
import { computed } from 'vue'
import { textContrast } from '~/utils/colors'

const {
  index,
  prefix = '',
  suffix = '',
  shape,
  color,
  image = null,
} = defineProps<{
  index: string
  prefix?: string
  suffix?: string
  shape: IndexShape
  color: string
  image?: string | null
}>()

const NARROW_CHARS: string[] = []

const textColor = computed(() =>
  textContrast(color)
    ? 'var(--light-text)'
    : 'var(--dark-text)',
)

const hasImage = computed(() =>
  Boolean(image),
)
</script>

<template>
  <div
    class="wrapper"
    :class="{
      'circle':
        !hasImage
        && shape === 'CIRCLE',

      'rounded-square':
        !hasImage
        && shape === 'ROUNDED_SQUARE',

      'lines':
        !hasImage
        && shape === 'LINES',

      'rectangle':
        !hasImage
        && shape === 'RECTANGLE',

      'cut-rectangle':
        !hasImage
        && shape === 'CUT_RECTANGLE',

      'has-image':
        hasImage,
    }"
  >
    <!--
      =========================================================
      IMAGE PERSONNALISÉE
      =========================================================

      Lorsqu'une image existe :
      - aucune Shape n'est rendue ;
      - aucun texte n'est rendu ;
      - aucune classe de forme n'est appliquée ;
      - l'image devient l'unique contenu visuel.
    -->
    <img
      v-if="hasImage && image"
      :src="image"
      class="custom-index-image"
      alt=""
    >

    <!--
      =========================================================
      INDICE CLASSIQUE
      =========================================================
    -->
    <template v-else>
      <Shape
        :shape="shape"
        :color="color"
      />

      <span class="index">
        <span
          v-if="
            prefix
            && shape === 'LINES'
          "
          class="prefix"
        >
          {{ prefix }}
        </span>

        <span
          v-for="(c, i) in index"
          :key="i"
          :class="{
            narrow:
              NARROW_CHARS.includes(c),
          }"
        >
          {{ c }}
        </span>

        <span
          v-if="suffix"
          class="suffix"
        >
          {{ suffix }}
        </span>
      </span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.wrapper {
  position: relative;

  display: block;

  min-width: 1em;
  width: 1em;

  min-height: 1em;
  height: 1em;

  overflow: hidden;

  --light-text: white;
  --dark-text: #231f20;

  &.lines::before {
    content: '';

    position: absolute;

    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    background-color: white;

    border-radius: .0625em;
  }
}

/*
 * =========================================================
 * IMAGE PERSONNALISÉE
 * =========================================================
 *
 * Ce mode est volontairement totalement indépendant
 * du rendu historique des indices.
 *
 * Aucun fond, aucune forme et aucun pseudo-élément
 * ne doit pouvoir apparaître derrière l'image.
 */
.wrapper.has-image {
  position: relative;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-width: 1em;
  width: auto;
  max-width: 2em;

  min-height: 1em;
  height: 1em;

  overflow: visible;

  background: transparent !important;
  background-color: transparent !important;

  border: 0 !important;
  border-radius: 0 !important;

  box-shadow: none !important;
}

/*
 * Neutralise aussi tout éventuel pseudo-élément
 * provenant du style historique de l'indice.
 */
.wrapper.has-image::before,
.wrapper.has-image::after {
  content: none !important;

  display: none !important;

  background: transparent !important;
}

/*
 * L'image conserve son ratio d'origine.
 *
 * Hauteur :
 * 1em = hauteur normale d'un indice.
 *
 * Largeur :
 * jusqu'à 2em afin d'autoriser les logos
 * horizontaux de type Bus / rectangle.
 */
.custom-index-image {
  position: relative;

  z-index: 10;

  display: block;

  flex: 0 0 auto;

  width: auto;
  max-width: 2em;

  height: 1em;
  max-height: 1em;

  object-fit: contain;
  object-position: center;

  background: transparent !important;

  border: 0;
  border-radius: 0;

  box-shadow: none;

  filter: none !important;

  opacity: 1;
}

/*
 * =========================================================
 * TEXTE DE L'INDICE CLASSIQUE
 * =========================================================
 */
.index {
  position: absolute;

  top: 50%;
  left: 50%;

  transform:
    translate(
      -50%,
      -50%
    );

  display: flex;
  flex-direction: row;
  align-items: start;

  font-family:
    "Parisine Ptf",
    sans-serif;

  font-weight: 600;
  font-size: .75em;

  color:
    v-bind(textColor);

  & span {
    text-box:
      trim-both
      cap
      alphabetic;
  }

  .narrow {
    letter-spacing: -.1em;
  }

  :first-child.narrow {
    margin-left: -.0625em;
  }

  :first-child.narrow:has(+ .narrow) {
    margin-left: -.125em;
  }

  .prefix {
    margin-right: .125em;
  }

  .suffix {
    margin-top:
      calc(
        .125em
        + .0625em
      );

    font-size: .75em;
  }
}

/*
 * =========================================================
 * CERCLE
 * =========================================================
 */
.circle {
  .index .suffix {
    margin-top:
      calc(
        1.5em
        - .125em
      );

    margin-right: -.25em;

    font-size: .375em;
  }
}

/*
 * =========================================================
 * LIGNES
 * =========================================================
 */
.lines {
  .index {
    font-size: .5375em;

    color: #231f20;
  }
}

/*
 * =========================================================
 * RECTANGLES
 * =========================================================
 */
.cut-rectangle,
.rectangle {
  &.wrapper {
    min-width: 2em;
    width: 2em;

    min-height: .9em;
    height: .9em;

    --dark-text: #24303B;
  }

  & .index {
    font-size: .5em;
    font-weight: 600;
    line-height: 1;
  }
}

.cut-rectangle .index {
  color:
    var(--light-text);
}
</style>