<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, inject, ref, watch } from 'vue'
import { STOP_PADDING } from '~/utils/dimensions'
import { StopContextKey } from '~/utils/symbols'
import { isMode, isService } from '~/utils/types'

const {
  connections,
  customConnections = [],
  reverse = false,
} = defineProps<{
  connections: Connection[]
  customConnections?: CustomConnection[]
  reverse?: boolean
}>()

const stopContext = inject<StopContext>(StopContextKey)

/*
 * Anciennes correspondances personnalisées
 * stockées directement sur l'arrêt.
 *
 * On continue de les accepter pour compatibilité
 * avec les anciens projets.
 */
const visibleCustomConnections = computed(() =>
  customConnections.filter(
    connection =>
      connection.image !== '',
  ),
)

/*
 * Liste des modes qui possèdent déjà
 * une correspondance native sur l'arrêt.
 */
const existingModeConnections = computed(() =>
  connections.filter(
    (connection): connection is ModeConnection =>
      isMode(connection),
  ),
)

const existingModes = computed(() =>
  new Set(
    existingModeConnections.value
      .map(
        connection =>
          connection.$modeConnection.mode,
      )
      .filter(
        (mode): mode is Mode =>
          mode !== null,
      ),
  ),
)

/*
 * Compatibilité avec l'ancien système :
 *
 * si une ancienne CustomConnection existe
 * sans ModeConnection native correspondante,
 * on crée uniquement pour l'affichage un groupe
 * temporaire.
 *
 * Ce groupe n'est jamais ajouté au projet.
 */
const customOnlyModeConnections =
  computed<ModeConnection[]>(() => {
    const modes = new Set<Mode>()

    visibleCustomConnections.value.forEach(
      (connection) => {
        if (
          !existingModes.value.has(
            connection.mode,
          )
        ) {
          modes.add(connection.mode)
        }
      },
    )

    return Array.from(modes).map(
      mode => ({
        id: `custom-${mode}`,
        $modeConnection: {
          mode,
          elements: [],
          walk: false,
        },
      }),
    )
  })

const hasConnections = computed(() =>
  connections.length > 0
  || visibleCustomConnections.value.length > 0,
)

const el = ref()

const { width } = useElementSize(el)

const namesWidth = computed(() =>
  stopContext?.namesWidth.value ?? '0px',
)

watch(
  [
    hasConnections,
    width,
    namesWidth,
  ],
  (
    [
      visible,
      _width,
      _namesWidth,
    ],
  ) => {
    if (stopContext) {
      if (visible) {
        stopContext.margins.rightMargin.connections =
          `calc(${_width}px - (${_namesWidth} + 1em) / 2 - ${STOP_PADDING})`
      }
      else {
        stopContext.margins.rightMargin.connections =
          `0px`
      }
    }
  },
  {
    immediate: true,
  },
)

function customConnectionsForMode(
  mode: Mode | null,
) {
  if (mode === null) {
    return []
  }

  return visibleCustomConnections.value.filter(
    connection =>
      connection.mode === mode,
  )
}

/*
 * Les identifiants internes sont volontairement
 * ignorés.
 *
 * Deux correspondances créées séparément peuvent
 * donc être reconnues comme identiques si leur
 * contenu réel est le même.
 *
 * En revanche, les éléments visuellement différents
 * doivent produire une signature différente.
 */
function modeConnectionSignature(
  connection: ModeConnection,
) {
  /*
   * Ancien système de CustomConnection.
   *
   * Conservé dans la signature uniquement
   * pour les anciens projets qui l'utilisent encore.
   */
  const legacyCustomConnections =
    customConnectionsForMode(
      connection.$modeConnection.mode,
    )
      .map(customConnection => ({
        mode:
          customConnection.mode,

        label:
          customConnection.label,

        image:
          customConnection.image,

        imageSize:
          customConnection.imageSize,
      }))
      .sort(
        (a, b) =>
          JSON.stringify(a).localeCompare(
            JSON.stringify(b),
          ),
      )

  /*
   * Chaque vraie ligne BULB est comparée
   * sur son contenu fonctionnel ET visuel.
   *
   * Le customPictogram représente désormais
   * le logo/indice personnalisé propre
   * à cette ligne précise.
   */
  const elements =
    connection.$modeConnection.elements
      .map(element => ({
        lineIndex:
          element
            .$modeConnectionElement
            .lineIndex,

        ornament:
          element
            .$modeConnectionElement
            .ornament,

        walk:
          element
            .$modeConnectionElement
            .walk,

        transfer:
          element
            .$modeConnectionElement
            .transfer
          ?? null,

        customPictogram:
          element
            .$modeConnectionElement
            .customPictogram
          ?? null,
      }))
      .sort(
        (a, b) =>
          JSON.stringify(a).localeCompare(
            JSON.stringify(b),
          ),
      )

  return JSON.stringify({
    type: 'MODE',

    mode:
      connection.$modeConnection.mode,

    walk:
      connection.$modeConnection.walk,

    transfer:
      connection.$modeConnection.transfer
      ?? null,

    /*
     * Pictogramme local du MODE.
     *
     * Deux correspondances utilisant
     * deux pictogrammes locaux différents
     * ne doivent pas être regroupées.
     */
    customPictogram:
      connection
        .$modeConnection
        .customPictogram
      ?? null,

    elements,

    /*
     * Compatibilité ancien système.
     */
    custom:
      legacyCustomConnections,
  })
}

function serviceConnectionSignature(
  connection: ServiceConnection,
) {
  const elements =
    connection.$serviceConnection.elements
      .map(element => ({
        ...element,
        id: undefined,
      }))
      .sort(
        (a, b) =>
          JSON.stringify(a).localeCompare(
            JSON.stringify(b),
          ),
      )

  return JSON.stringify({
    type: 'SERVICE',

    walk:
      connection.$serviceConnection.walk,

    transfer:
      connection.$serviceConnection.transfer
      ?? null,

    elements,
  })
}

function connectionSignature(
  connection: Connection,
) {
  if (isMode(connection)) {
    return modeConnectionSignature(
      connection,
    )
  }

  if (isService(connection)) {
    return serviceConnectionSignature(
      connection,
    )
  }

  return ''
}
</script>

<template>
  <div
    v-if="hasConnections"
    ref="el"
    class="connections-box"
    :class="{ reverse }"
  >
    <div
      v-if="!reverse"
      class="flex flex-col items-center w-1em"
    >
      <VerticalLine large />
    </div>

    <div class="connection-groups">
      <div
        v-for="connection in connections"
        :key="connection.id"
        class="connection-group"
        :data-connection-signature="
          connectionSignature(connection)
        "
      >
        <ModeConnection
          v-if="isMode(connection)"
          :connection="connection"
          :custom-connections="
            customConnectionsForMode(
              connection.$modeConnection.mode,
            )
          "
        />

        <ServiceConnection
          v-else-if="isService(connection)"
          :connection="connection"
        />

        <span v-else>?</span>
      </div>

      <!--
        Compatibilité avec les anciennes
        CustomConnection sans groupe natif.
      -->
      <div
        v-for="connection in customOnlyModeConnections"
        :key="connection.id"
        class="connection-group"
        :data-connection-signature="
          modeConnectionSignature(connection)
        "
      >
        <ModeConnection
          :connection="connection"
          :custom-connections="
            customConnectionsForMode(
              connection.$modeConnection.mode,
            )
          "
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.connections-box {
  display: flex;
  flex-direction: column;

  &.reverse {
    flex-direction: column-reverse;
  }

  .debug & {
    outline: 1px solid red;
  }
}

.connection-groups {
  display: flex;
  flex-direction: column;
}

.connection-group {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: .125em;
  margin-top: .0625em;
  align-items: start;
}
</style>