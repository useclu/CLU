<script setup lang="ts">
import {
  computed,
  inject,
  watch,
} from 'vue'
import { StopContextKey } from '~/utils/symbols'

const {
  connection,
} = defineProps<{
  connection: ModeConnection
  customConnections?: CustomConnection[]
}>()

const CONDENSED_MODES: Mode[] = [
  'BUS',
  'NOCTILIEN',
]

const MAX_COLUMNS = 4

const stopContext =
  inject<StopContext>(
    StopContextKey,
  )

/*
 * Extension temporaire du type
 * ModeConnectionElement.
 *
 * Le champ sera ensuite ajouté officiellement
 * dans types/index.d.ts.
 */
type ExtendedModeConnectionElement =
  ModeConnectionElement['$modeConnectionElement'] & {
    customPictogram?: {
      image: string
      imageSize: number
    } | null
  }

/*
 * Pictogramme personnalisé propre
 * à cette correspondance précise.
 *
 * Priorité :
 *
 * 1. pictogramme local de cette correspondance
 * 2. pictogramme global du projet
 * 3. pictogramme BULB d'origine
 *
 * Les niveaux 2 et 3 sont toujours
 * automatiquement gérés par Mode.
 */
const localModePictogram =
  computed(() => {
    const image =
      connection
        .$modeConnection
        .customPictogram
        ?.image

    if (
      typeof image !== 'string'
      || image.trim() === ''
    ) {
      return null
    }

    return image
  })

const transfer =
  computed<TransferDetails | null>(
    () => {
      if (
        connection
          .$modeConnection
          .transfer
      ) {
        return (
          connection
            .$modeConnection
            .transfer
        )
      }

      /*
       * Compatibilité avec les anciens
       * projets utilisant seulement walk.
       */
      if (
        connection
          .$modeConnection
          .walk
      ) {
        return {
          mode: 'WALK',

          durationMinutes:
            null,
        }
      }

      return null
    },
  )

const hasTransfer =
  computed(
    () =>
      transfer.value
      !== null,
  )

const transferMode =
  computed<TransferMode | null>(
    () => {
      return (
        transfer.value
          ?.mode
        ?? null
      )
    },
  )

const transferDuration =
  computed<number | null>(
    () => {
      return (
        transfer.value
          ?.durationMinutes
        ?? null
      )
    },
  )

const transferIcon =
  computed(() => {
    switch (
      transferMode.value
    ) {
      case 'BIKE':
        return 'i-tabler-bike'

      case 'CAR':
        return 'i-tabler-car'

      case 'BUS':
        return 'i-tabler-bus'

      case 'OTHER':
        return 'i-tabler-arrows-exchange'

      default:
        return null
    }
  })

const condensed =
  computed(() => {
    if (
      connection
        .$modeConnection
        .mode === null
    ) {
      return false
    }

    return (
      CONDENSED_MODES.includes(
        connection
          .$modeConnection
          .mode,
      )
    )
  })

/*
 * Il n'existe maintenant qu'un seul
 * type de ligne dans ce groupe :
 *
 * connection.$modeConnection.elements
 *
 * Une ligne peut afficher :
 *
 * - son indice BULB normal
 * - OU son logo personnalisé
 */
const totalElementsCount =
  computed(() => {
    return (
      connection
        .$modeConnection
        .elements
        .length
    )
  })

watch(
  hasTransfer,

  (visible) => {
    if (!stopContext) {
      return
    }

    stopContext
      .margins
      .leftMargin
      .connections =
      visible
        ? '.5em'
        : '0em'
  },

  {
    immediate: true,
  },
)

/*
 * Récupère la version étendue
 * d'une ligne.
 */
function extendedLine(
  line: ModeConnectionElement,
): ExtendedModeConnectionElement {
  return (
    line.$modeConnectionElement
  )
}

/*
 * Image personnalisée de cette
 * ligne précise.
 */
function lineCustomPictogram(
  line: ModeConnectionElement,
) {
  const image =
    extendedLine(line)
      .customPictogram
      ?.image

  if (
    typeof image !== 'string'
    || image.trim() === ''
  ) {
    return null
  }

  return image
}

/*
 * Taille du logo personnalisé
 * de cette ligne.
 */
function lineCustomPictogramSize(
  line: ModeConnectionElement,
) {
  const size =
    extendedLine(line)
      .customPictogram
      ?.imageSize

  if (
    typeof size !== 'number'
    || Number.isNaN(size)
  ) {
    return 1
  }

  return size
}

function position(
  index: number,
) {
  if (
    !condensed.value
  ) {
    return null
  }

  if (
    totalElementsCount.value
    <= MAX_COLUMNS * 2
  ) {
    return {
      gridRow:
        1 + index % 2,
    }
  }

  return {
    gridColumn:
      1 + index
      % MAX_COLUMNS,
  }
}
</script>

<template>
  <div class="connection-group-mode">
    <div
      class="
        mode-wrapper
        flex
        flex-row
        gap-.125em
        items-start
      "
      :class="{
        transfer:
          hasTransfer,
      }"
    >
      <div
        v-if="hasTransfer"
        class="transfer-indicator"
      >
        <Pedestrian
          v-if="
            transferMode === 'WALK'
          "
          class="transfer-icon"
        />

        <i
          v-else-if="
            transferIcon
          "
          :class="
            transferIcon
          "
          class="transfer-icon"
        />

        <span
          v-if="
            transferDuration
            !== null
          "
          class="
            transfer-duration
          "
        >
          {{ transferDuration }} min
        </span>
      </div>

      <!--
        Pictogramme personnalisé
        propre à cette correspondance.

        Sans pictogramme local,
        Mode utilise automatiquement
        le pictogramme global du projet
        puis celui de BULB.
      -->
      <div
        v-if="
          localModePictogram
        "
        class="
          local-mode-pictogram
        "
      >
        <img
          :src="
            localModePictogram
          "
          alt=""
        >
      </div>

      <Mode
        v-else
        :mode="
          connection
            .$modeConnection
            .mode
        "
      />
    </div>

    <VerticalLine inner />
  </div>

  <!--
    Une seule liste de lignes.

    Chaque ligne décide désormais
    elle-même si elle affiche :

    - son indice BULB
    - ou son logo personnalisé.
  -->
  <div
    class="
      connection-group-lines
    "
    :class="{
      condensed,

      single:
        totalElementsCount
        <= 1,
    }"
  >
    <IconOrnament
      v-for="(
        line,
        index
      ) in connection
        .$modeConnection
        .elements"
      :key="
        line.id
      "
      :ornament="
        line
          .$modeConnectionElement
          .ornament
      "
      :walk="
        line
          .$modeConnectionElement
          .walk
      "
      :transfer="
        line
          .$modeConnectionElement
          .transfer
      "
      :custom-pictogram="
        lineCustomPictogram(
          line,
        )
      "
      :custom-pictogram-size="
        lineCustomPictogramSize(
          line,
        )
      "
      :style="
        position(index)
      "
    >
      <LineIndex
        :mode="
          connection
            .$modeConnection
            .mode
        "
        :index="
          line
            .$modeConnectionElement
            .lineIndex
        "
      />
    </IconOrnament>
  </div>
</template>

<style scoped lang="scss">
.connection-group-mode {
  display: grid;

  grid-template-rows:
    auto 1fr;

  gap: .0625em;

  justify-items: center;

  height: 100%;
}

.connection-group-lines {
  display: grid;

  grid-template-columns:
    repeat(
      v-bind(MAX_COLUMNS),
      min-content
    );

  grid-auto-flow: row;

  column-gap: .125em;
  row-gap: .125em;

  align-items: center;

  margin-bottom: .3125em;

  > * {
    min-width: 1em;
  }

  .reverse
    > .connection-groups
    .connection-group:last-child & {
    margin-bottom: .4375em;
  }
}

/*
 * Pictogramme propre
 * à la ModeConnection.
 *
 * Il garde la taille standard
 * du pictogramme BULB.
 */
.local-mode-pictogram {
  width: 1em;
  height: 1em;

  display: flex;

  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  line-height: 1;

  img {
    display: block;

    width: 100%;
    height: 100%;

    object-fit: contain;
  }
}

/*
 * Les modes condensés conservent
 * le fonctionnement original BULB.
 *
 * IconOrnament reste le conteneur
 * de chaque ligne, qu'elle affiche
 * un indice normal ou une image.
 */
.condensed {
  row-gap: .125em;

  & > div {
    font-size: .5em;

    margin-right: .25em;
  }

  &.single {
    height: 1em;

    & > div {
      grid-row:
        1 / 3
        !important;

      justify-content: center;
    }
  }
}

.mode-wrapper.transfer {
  margin-left: -1.125em;
}

.transfer-indicator {
  display: flex;

  flex-direction: row;

  align-items: center;

  gap: .2em;

  white-space: nowrap;
}

.transfer-icon {
  flex-shrink: 0;
}

.transfer-duration {
  font-size: .55em;

  font-weight: 600;

  line-height: 1;

  white-space: nowrap;
}
</style>