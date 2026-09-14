<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useProject } from '~/stores/useProject'

type TramStyle =
  | 'ANGLED'
  | 'HORIZONTAL'

const {
  value,
  placeName = null,
  nameStyle,
} = defineProps<{
  value: string
  placeName?: string | null
  nameStyle?: StopNameStyle
}>()

const { line } = storeToRefs(useProject())

const valueParts = computed(() =>
  value
    .split('\n')
    .filter(part => part.trim() !== ''),
)

const placeNameParts = computed(() =>
  placeName
    ?.split('\n')
    .filter(part => part.trim() !== '') ?? [],
)

const effectiveNameStyle = computed<StopNameStyle>(() =>
  nameStyle ?? {
    bold: true,
    italic: false,
    underline: false,
    color: null,
    image: null,
    imageSize: 1,
    images: [],
  },
)

/*
 * =========================================================
 * LOGOS / IMAGES DU NOM
 * =========================================================
 *
 * Le système historique ne gérait qu'une seule image :
 *
 *   image
 *   imageSize
 *
 * CLU gère maintenant plusieurs images via :
 *
 *   images[]
 *
 * Chaque image possède :
 *
 *   id
 *   image
 *   imageSize
 *
 * Le rendu Terminus doit donc utiliser exactement la même
 * source que le rendu d'un arrêt normal.
 *
 * Pour les anciens projets qui ne possèdent pas encore
 * images[], on conserve une compatibilité avec image.
 */
const customImages = computed(() => {
  const images =
    effectiveNameStyle.value.images ?? []

  if (images.length > 0) {
    return images.filter(image => Boolean(image.image))
  }

  if (effectiveNameStyle.value.image) {
    return [
      {
        id: 'legacy-image',
        image: effectiveNameStyle.value.image,
        imageSize:
          effectiveNameStyle.value.imageSize ?? 1,
      },
    ]
  }

  return []
})

function imageStyle(
  imageSize: number | undefined,
) {
  const size = imageSize ?? 1

  return {
    width: `${size}em`,
    height: `${size}em`,
  }
}

const formatStyle = computed<FormatStyle>(() =>
  line.value.formatStyle ?? 'RATP',
)

const isSncfFormat = computed(() =>
  formatStyle.value === 'SNCF',
)

/*
 * =========================================================
 * TRAMWAY
 * =========================================================
 *
 * Les terminus Tram utilisent un cartouche sombre
 * avec texte blanc, indépendamment du format
 * général RATP / SNCF du projet.
 */
const isTramMode = computed(() =>
  line.value.mode === 'TRAM',
)

const tramStyle = computed<TramStyle>(() =>
  (
    line.value as Line & {
      tramStyle?: TramStyle
    }
  ).tramStyle
  ?? 'ANGLED',
)

const isTramHorizontal = computed(() =>
  isTramMode.value
  && tramStyle.value === 'HORIZONTAL',
)

const isTramAngled = computed(() =>
  isTramMode.value
  && tramStyle.value === 'ANGLED',
)

const frameStyle = computed(() => {
  /*
   * TRAM :
   * cartouche noir / très sombre.
   */
  if (isTramMode.value) {
    return {
      backgroundColor: '#111111',
      color: 'white',
      border: '1px solid #111111',
    }
  }

  /*
   * SNCF classique.
   */
  if (isSncfFormat.value) {
    return {
      backgroundColor: 'white',
      color: '#000000',
      border: '1px solid #000000',
    }
  }

  /*
   * RATP classique.
   */
  return {
    backgroundColor: 'var(--blue-ratp-paper)',
    color: 'white',
    border: '1px solid transparent',
  }
})

const terminusNameStyle = computed(() => ({
  /*
   * En Tram, le texte reste blanc afin de conserver
   * la lisibilité du cartouche noir.
   *
   * Pour les autres modes, la couleur personnalisée
   * d'un arrêt conserve son comportement historique.
   */
  color:
    isTramMode.value
      ? 'white'
      : (
          effectiveNameStyle.value.color
          ?? (isSncfFormat.value ? '#000000' : 'white')
        ),

  fontWeight: 'bold',

  fontStyle:
    effectiveNameStyle.value.italic
      ? 'italic'
      : 'normal',

  textDecoration:
    effectiveNameStyle.value.underline
      ? 'underline'
      : 'none',
}))

const placeNameStyle = computed(() => ({
  color:
    isTramMode.value
      ? 'white'
      : (
          isSncfFormat.value
            ? '#000000'
            : 'white'
        ),
}))
</script>

<template>
  <div
    class="frame"
    :class="{
      'sncf-format': isSncfFormat && !isTramMode,
      'ratp-format': !isSncfFormat && !isTramMode,
      'tram-format': isTramMode,
      'tram-horizontal': isTramHorizontal,
      'tram-angled': isTramAngled,
    }"
    :style="frameStyle"
  >
    <div
      v-if="placeNameParts.length > 0"
      class="place-name-container"
    >
      <Typography
        v-for="(part, index) in placeNameParts"
        :key="`${part}-${index}`"
        class="place-name"
        :style="placeNameStyle"
      >
        {{ part }}
      </Typography>
    </div>

    <div class="name-container">
      <div
        v-for="(part, index) in valueParts"
        :key="`${part}-${index}`"
        class="name-line"
      >
        <Typography :style="terminusNameStyle">
          {{ part }}
        </Typography>

        <!--
          Les images sont placées uniquement après
          la dernière ligne du nom, comme auparavant.

          La différence est que l'on affiche maintenant
          TOUT le tableau images[] au lieu du seul
          ancien champ image.
        -->
        <div
          v-if="
            customImages.length > 0
              && index === valueParts.length - 1
          "
          class="custom-images"
        >
          <img
            v-for="(image, imageIndex) in customImages"
            :key="
              image.id
                || `terminus-image-${imageIndex}`
            "
            :src="image.image"
            :style="imageStyle(image.imageSize)"
            class="custom-image"
            alt=""
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.frame {
  display: flex;
  flex-direction: column;

  width: fit-content;

  font-weight: bold;

  /*
   * =======================================================
   * RATP
   * =======================================================
   */
  &.ratp-format {
    background-color: var(--blue-ratp-paper);
    color: white;
  }

  /*
   * =======================================================
   * SNCF
   * =======================================================
   */
  &.sncf-format {
    background-color: white;
    color: #000000;
  }

  /*
   * =======================================================
   * TRAMWAY
   * =======================================================
   *
   * Cartouche compact noir avec texte blanc.
   */
  &.tram-format {
    background-color: #111111;
    color: white;

    border-radius: .08em;

    box-shadow:
      0 .04em .08em
      rgb(0 0 0 / 18%);
  }

  /*
   * =======================================================
   * TRAMWAY HORIZONTAL
   * =======================================================
   *
   * Un cartouche est naturellement beaucoup plus haut
   * qu'un simple nom de station.
   *
   * Il doit donc être remonté davantage afin que son bas
   * reste nettement au-dessus du point et de la ligne.
   *
   * On ne touche pas au style Incliné.
   */
  &.tram-format.tram-horizontal {
    transform: translateY(-.72em);
  }

  .place-name {
    font-size: .5em;
    font-style: italic;
  }

  .debug & {
    outline: 1px solid magenta;
  }
}

.place-name-container {
  display: flex;
  flex-direction: column;

  gap: .1875em;

  padding: .25em .375em;

  .ratp-format & {
    border-bottom: 1px solid white;
  }

  .sncf-format & {
    border-bottom: 1px solid #000000;
  }

  /*
   * Séparation discrète à l'intérieur
   * du cartouche Tram.
   */
  .tram-format & {
    border-bottom:
      1px
      solid
      rgb(255 255 255 / 55%);
  }

  & span {
    transform: translateY(.0625em);
  }
}

.name-container {
  display: flex;
  flex-direction: column;

  gap: .3125em;

  padding: .375em;

  /*
   * Le cartouche Tram est légèrement plus large
   * autour du texte que le cartouche classique.
   */
  .tram-format & {
    padding:
      .38em
      .55em;
  }
}

.name-line {
  display: flex;
  flex-direction: row;

  align-items: center;

  gap: .25em;

  width: fit-content;
}

/*
 * =========================================================
 * PLUSIEURS LOGOS / IMAGES
 * =========================================================
 *
 * Les images restent alignées horizontalement directement
 * après le nom du terminus.
 *
 * Aucune limite artificielle :
 * 1, 3, 5, 10, 20 images peuvent être rendues.
 */
.custom-images {
  display: flex;
  flex-direction: row;

  align-items: center;

  gap: .18em;

  width: max-content;

  flex-shrink: 0;
}

.custom-image {
  display: block;

  flex-shrink: 0;

  object-fit: contain;
}

span {
  line-height: .9375em;

  margin-top: -.1875em;
  margin-right: .0625em;

  text-wrap: nowrap;

  height: fit-content;
}
</style>