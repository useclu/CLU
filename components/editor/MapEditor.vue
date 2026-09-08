<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import useExportMap from '~/composables/useExportMap'
import { useProjectVersionCheck } from '~/composables/useProjectVersionCheck'
import useVersion from '~/composables/useVersion'
import { useProject } from '~/stores/useProject'
import { ExportSignal, LineContextKey } from '~/utils/symbols'

const { version, line } = storeToRefs(useProject())
const exportMap = useExportMap()
const exportSignal = useEventBus(ExportSignal)
const { projectMinimumVersion } = useVersion()
const checkVersion = useProjectVersionCheck()

const el = ref()
const error = ref(false)

/*
 * =========================================================
 * ÉCHELLE GLOBALE DU PLAN
 * =========================================================
 *
 * Jusqu'ici --base-size restait fixé à 2, quelle que soit
 * la taille du cadre. Résultat : mapSize agrandissait surtout
 * la surface blanche, mais les noms, arrêts, fourches et
 * pictogrammes gardaient quasiment la même échelle.
 *
 * On fait maintenant évoluer --base-size avec mapSize :
 *
 * 15em = rendu historique (base-size 2)
 * 20em = légèrement plus grand
 * 30em = nettement plus grand
 * 50em = agrandissement plafonné pour rester exploitable
 *
 * La progression est volontairement douce afin de ne pas
 * rendre les gros plans gigantesques.
 */
const mapBaseSize = computed(() => {
  const rawMapSize =
    Number.parseFloat(
      String(
        line.value.mapSize
        ?? 15,
      ),
    )

  const mapSize =
    Number.isFinite(rawMapSize)
      ? rawMapSize
      : 15

  const scale =
    Math.sqrt(
      Math.max(
        15,
        mapSize,
      ) / 15,
    )

  return Math.min(
    3.6,
    Math.max(
      2,
      2 * scale,
    ),
  )
})

provide<LineContext>(LineContextKey, {
  color: computed(() => line.value.color ?? '#000000'),
  lineThickness: computed(() => Number.parseFloat(line.value.lineThickness ?? '1') || 1),
  lineStyle: computed(() => line.value.lineStyle ?? 'PLAIN'),
  dotsColorPolicy: computed(() => line.value.dotsColorPolicy ?? 'INHERIT'),
  frameTerminusNames: computed(() => line.value.frameTerminusNames),
})

function doExport() {
  exportMap(el.value)
}

function onError(e: unknown) {
  console.error(e)
  error.value = true
}

function addAnnotation() {
  if (line.value.annotations === undefined) {
    line.value.annotations = []
  }

  line.value.annotations.push({
    id: uuidv4(),
    $annotation: {
      text: 'Annotation',
      bold: false,
      italic: false,
      underline: false,
      color: null,
      fontSize: 1,
      alignment: 'LEFT',
      offsetX: 12,
      offsetY: 2,
    },
  })
}

onMounted(() => {
  exportSignal.on(doExport)
  checkVersion(version.value, projectMinimumVersion)
})

onBeforeUnmount(() => exportSignal.off(doExport))
</script>

<template>
  <div
    class="map-editor"
    :style="{
      '--base-size':
        mapBaseSize,
    }"
  >
    <div class="editor-content">
      <div class="dead-zone">
        <NuxtErrorBoundary v-if="!error" @error="onError">
          <div ref="el">
            <LineCanvas />
          </div>
        </NuxtErrorBoundary>

        <LineCanvasError v-if="error" />
      </div>
    </div>

    <!--
      =========================================================
      DOCK D'OUTILS FLOTTANT
      =========================================================
    -->
    <div class="toolbox-area">
      <div class="editor-toolbox">
        <!--
          GROUPE 1
          Branche
          Fourche
          Segment vertical
          Branches parallèles
          Demi-tour
        -->
        <LineSectionToolbox />

        <!--
          Séparateur visuel |
        -->
        <div
          class="toolbox-group-separator"
          aria-hidden="true"
        >
          |
        </div>

        <!--
          GROUPE 2
          Arrêt
          Espacement
          Séparation Ville/Zone
        -->
        <BranchToolbox />

        <!--
          Annotation
        -->
        <button
          type="button"
          class="toolbox-item annotation-tool"
          @click="addAnnotation"
        >
          <div class="flex flex-col items-center">
            <i class="i-tabler-text-caption" />

            <span>
              Annotation
            </span>
          </div>
        </button>

        <!--
          Espace entre les outils et Supprimer
        -->
        <div class="flex-grow min-w-1em" />

        <Trash />
      </div>
    </div>
  </div>
</template>

<style>
:root {
  /*
   * Valeur de secours.
   * .map-editor redéfinit --base-size dynamiquement selon mapSize.
   */
  --base-size: 2;
  --font-size: calc(var(--base-size) * 16px);
}
</style>

<style scoped lang="scss">
.map-editor {
  position: relative;

  border: 1px solid var(--p-content-border-color);

  color: var(--p-gray-700);

  height: 100%;
  max-height: 100%;

  display: grid;
  grid-template-rows: minmax(0, 1fr);

  overflow: hidden;
}

/*
 * =========================================================
 * ZONE DU PLAN
 * =========================================================
 */

.editor-content {
  overflow: auto;

  width: 100%;
  height: 100%;

  min-width: 0;
  min-height: 0;

  /*
   * La zone de défilement possède maintenant une vraie
   * hauteur limitée par l'éditeur.
   *
   * Si le plan dépasse horizontalement ou verticalement,
   * les deux directions deviennent accessibles.
   */
  box-sizing: border-box;
}

.dead-zone {
  display: flex;
  align-items: center;
  justify-content: center;

  /*
   * Espace libre autour du plan afin de pouvoir atteindre
   * confortablement ses quatre côtés.
   */
  padding:
    5em
    5em
    8em;

  box-sizing: border-box;

  /*
   * La zone occupe au minimum tout l'éditeur mais peut
   * grandir naturellement avec les dimensions du plan.
   */
  width: max-content;
  min-width: 100%;

  height: max-content;
  min-height: 100%;

  background:
    repeating-linear-gradient(
      45deg,
      var(--p-gray-50) 0,
      var(--p-gray-50) 1em,
      var(--p-gray-100) calc(1em + 1px),
      var(--p-gray-100) 2em
    );

  background-size: 100% 100%;
}

/*
 * =========================================================
 * POSITION DU DOCK
 * =========================================================
 */

.toolbox-area {
  position: absolute;

  left: 50%;
  bottom: .85rem;

  z-index: 30;

  width: calc(100% - 2rem);
  max-width: calc(100% - 2rem);

  transform: translateX(-50%);

  pointer-events: none;
}

/*
 * =========================================================
 * CAPSULE PRINCIPALE
 * =========================================================
 */

.editor-toolbox {
  position: relative;

  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .2rem;

  width: max-content;
  max-width: 100%;

  margin: 0 auto;

  padding: .45rem .55rem;

  overflow-x: auto;
  overflow-y: hidden;

  pointer-events: auto;

  background:
    linear-gradient(
      180deg,
      rgb(39 39 42 / 82%) 0%,
      rgb(22 22 25 / 78%) 100%
    );

  -webkit-backdrop-filter:
    blur(24px)
    saturate(180%);

  backdrop-filter:
    blur(24px)
    saturate(180%);

  border:
    1px solid
    rgb(255 255 255 / 18%);

  border-radius: 1.6rem;

  box-shadow:
    0 .75rem 2rem rgb(0 0 0 / 28%),
    0 .15rem .5rem rgb(0 0 0 / 18%),
    inset 0 1px 0 rgb(255 255 255 / 18%);

  color: rgb(245 245 247);

  scrollbar-width: thin;

  & > * {
    flex-shrink: 0;
  }
}

/*
 * Reflet supérieur très léger.
 */
.editor-toolbox::before {
  content: '';

  position: absolute;

  top: 0;
  left: 1.2rem;
  right: 1.2rem;

  height: 1px;

  pointer-events: none;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgb(255 255 255 / 34%),
      transparent
    );
}

/*
 * =========================================================
 * SÉPARATEUR |
 * =========================================================
 */

.toolbox-group-separator {
  display: flex;
  align-items: center;
  justify-content: center;

  align-self: stretch;

  padding: 0 .35rem;

  color: rgb(255 255 255 / 42%);

  font-size: 1.25rem;
  font-weight: 300;
  line-height: 1;

  user-select: none;
}

/*
 * =========================================================
 * TOUS LES OUTILS ENFANTS
 * =========================================================
 */

.editor-toolbox :deep(.toolbox-item),
.editor-toolbox > .toolbox-item {
  min-width: 5rem;

  padding: .5rem .65rem;

  background: transparent !important;

  border-color: transparent !important;
  border-style: solid !important;
  border-width: 1px !important;

  border-radius: 1rem !important;

  color: inherit !important;

  box-shadow: none !important;

  transform: none !important;

  transition:
    background-color .16s ease,
    color .16s ease,
    border-color .16s ease !important;
}

/*
 * Survol léger dans le verre.
 */

.editor-toolbox :deep(.toolbox-item:hover),
.editor-toolbox > .toolbox-item:hover {
  background:
    rgb(255 255 255 / 12%) !important;

  border-color:
    rgb(255 255 255 / 7%) !important;

  box-shadow: none !important;

  transform: none !important;
}

/*
 * Taille du texte conservée.
 */

.editor-toolbox :deep(.toolbox-item span),
.editor-toolbox > .toolbox-item span {
  font-size: 1rem !important;

  line-height: 1.2;

  white-space: nowrap;

  color: inherit;

  user-select: none;
}

.editor-toolbox :deep(.toolbox-item i),
.editor-toolbox > .toolbox-item i {
  color: inherit;
}

/*
 * =========================================================
 * ANNOTATION
 * =========================================================
 */

.annotation-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  font-family: inherit;

  cursor: pointer;

  i {
    font-size: 1.5rem;
  }

  &:active {
    cursor: pointer;
  }
}

/*
 * =========================================================
 * GROUPES INTERNES
 * =========================================================
 */

.editor-toolbox :deep(.toolbox-section),
.editor-toolbox :deep(.draggable-elements) {
  gap: .15rem;
}

/*
 * =========================================================
 * BOUTON SUPPRIMER
 * =========================================================
 */

.editor-toolbox :deep(.toolbox-item:has(.i-tabler-trash)) {
  color: rgb(255 105 105) !important;

  background:
    rgb(255 70 70 / 8%) !important;

  border-color:
    rgb(255 100 100 / 18%) !important;
}

.editor-toolbox :deep(.toolbox-item:has(.i-tabler-trash):hover) {
  color: rgb(255 135 135) !important;

  background:
    rgb(255 70 70 / 16%) !important;

  border-color:
    rgb(255 110 110 / 28%) !important;
}

.editor-toolbox :deep(.toolbox-item:has(.i-tabler-trash).active) {
  color: white !important;

  background:
    rgb(220 38 38 / 90%) !important;

  border-color:
    rgb(248 113 113 / 75%) !important;
}

/*
 * =========================================================
 * PETITS ÉCRANS
 * =========================================================
 */

@media (max-width: 1024px) {
  .toolbox-area {
    bottom: .6rem;

    width: calc(100% - 1rem);
    max-width: calc(100% - 1rem);
  }

  .editor-toolbox {
    padding: .4rem .45rem;

    border-radius: 1.4rem;
  }
}
</style>