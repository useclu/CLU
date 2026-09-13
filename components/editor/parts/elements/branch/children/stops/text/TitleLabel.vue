<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProject } from '~/stores/useProject'

const {
  value,
  nameStyle,
  terminus = false,
} = defineProps<{
  value: string
  nameStyle?: StopNameStyle
  terminus?: boolean
}>()

const { line } = storeToRefs(useProject())

const effectiveStyle = computed<StopNameStyle>(() =>
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

const effectiveImages =
  computed<StopNameImage[]>(() => {
    /*
     * Nouveau format multi-images.
     *
     * Si "images" existe, même vide, il est prioritaire.
     * Cela permet notamment de supprimer la dernière image
     * sans que l'ancien champ "image" réapparaisse.
     */
    if (effectiveStyle.value.images !== undefined) {
      return effectiveStyle.value.images
    }

    /*
     * Compatibilité avec les anciens projets qui ne
     * possèdent encore que image + imageSize.
     */
    if (effectiveStyle.value.image) {
      return [
        {
          id: 'legacy',
          image: effectiveStyle.value.image,
          imageSize:
            effectiveStyle.value.imageSize
            ?? 1,
        },
      ]
    }

    return []
  })

const formatStyle = computed<FormatStyle>(() =>
  line.value.formatStyle ?? 'RATP',
)

const isTramMode = computed(() =>
  line.value.mode === 'TRAM',
)

const formatColor = computed(() => {
  if (formatStyle.value === 'SNCF') {
    return '#000000'
  }

  return 'var(--blue-ratp-paper)'
})

const formatBold = computed(() => {
  if (formatStyle.value === 'SNCF') {
    return terminus
  }

  return true
})

const titleStyle = computed(() => ({
  color:
    effectiveStyle.value.color
    ?? formatColor.value,

  fontWeight:
    formatBold.value
      ? 'bold'
      : 'normal',

  fontStyle:
    effectiveStyle.value.italic
      ? 'italic'
      : 'normal',

  textDecoration:
    effectiveStyle.value.underline
      ? 'underline'
      : 'none',
}))

function getImageStyle(
  image: StopNameImage,
) {
  const size =
    image.imageSize ?? 1

  return {
    width: `${size}em`,
    height: `${size}em`,
  }
}
</script>

<template>
  <div
    class="title-wrapper"
    :class="{
      'tram-mode': isTramMode,
    }"
  >
    <Typography
      class="title"
      :style="titleStyle"
    >
      {{ value }}
    </Typography>

    <img
      v-for="image in effectiveImages"
      :key="image.id"
      :src="image.image"
      :style="getImageStyle(image)"
      class="custom-image"
      alt=""
    >
  </div>
</template>

<style scoped lang="scss">
.title-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .25em;

  height: 1em;
}

/*
 * =========================================================
 * TRAMWAY
 * =========================================================
 *
 * StopRegularLabel.vue gère déjà :
 *
 * - les retours à la ligne ;
 * - l'empilement ;
 * - l'espacement vertical ;
 * - l'inclinaison.
 *
 * TitleLabel ne doit donc afficher qu'une seule ligne.
 */
.title-wrapper.tram-mode {
  height: auto;

  align-items: center;
}

/*
 * =========================================================
 * IMAGES PERSONNALISÉES
 * =========================================================
 */

.custom-image {
  display: block;

  flex-shrink: 0;

  object-fit: contain;
}

/*
 * =========================================================
 * TITRE
 * =========================================================
 */

.title {
  color: var(--blue-ratp-paper);

  font-weight: bold;

  line-height: 1.08em;

  white-space: nowrap;

  height: fit-content;

  margin: 0;
}

/*
 * =========================================================
 * BULB CLASSIQUE
 * =========================================================
 *
 * Le léger décalage historique reste appliqué
 * uniquement aux autres modes.
 */
.title-wrapper:not(.tram-mode) {
  .title {
    line-height: .9375em;

    margin-top: -.1875em;
    margin-right: .0625em;

    text-wrap: nowrap;
  }
}
</style>
