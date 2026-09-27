<script setup lang="ts">
import { useEventBus, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import useExportMap from '~/composables/useExportMap'
import useCluPreviewMode from '~/composables/useCluPreviewMode'
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
const exportNativeScale = ref(false)
const {
  previewMode,
  isPreviewing,
  exitPreview,
} = useCluPreviewMode()

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


/*
 * Sur mobile/tablette, on réduit la vraie unité interne du plan au lieu
 * d'utiliser CSS zoom. Les fourches et branches parallèles mesurent leur
 * géométrie via le DOM : une vraie --base-size numérique garantit que
 * getBoundingClientRect(), offsetWidth et les ResizeObserver restent dans
 * le même référentiel.
 *
 * IMPORTANT : --base-size reste toujours un NOMBRE (jamais calc(...)).
 */
const { width: viewportWidth, height: viewportHeight } =
  useWindowSize({
    initialWidth: 1280,
    initialHeight: 800,
  })

const editorDisplayScale = computed(() => {
  if (exportNativeScale.value || viewportWidth.value > 1100) {
    return 1
  }

  if (
    viewportHeight.value <= 560
    && viewportWidth.value <= 1000
  ) {
    return .5
  }

  if (viewportWidth.value <= 390) return .42
  if (viewportWidth.value <= 720) return .48

  return .62
})

const effectiveBaseSize = computed(() =>
  mapBaseSize.value * editorDisplayScale.value,
)

provide<LineContext>(LineContextKey, {
  color: computed(() => line.value.color ?? '#000000'),
  lineThickness: computed(() => Number.parseFloat(line.value.lineThickness ?? '1') || 1),
  lineStyle: computed(() => line.value.lineStyle ?? 'PLAIN'),
  dotsColorPolicy: computed(() => line.value.dotsColorPolicy ?? 'INHERIT'),
  frameTerminusNames: computed(() => line.value.frameTerminusNames),
})

async function doExport() {
  /*
   * Le dézoom téléphone/tablette est uniquement un confort d'édition.
   * Les exports restent calculés à l'échelle native du plan.
   */
  exportNativeScale.value = true
  await nextTick()

  try {
    await exportMap(el.value)
  }
  finally {
    exportNativeScale.value = false
  }
}

function onError(e: unknown) {
  console.error(e)
  error.value = true
}

onMounted(() => {
  exportSignal.on(doExport)
  checkVersion(version.value, projectMinimumVersion)

  /*
   * Comme l'ancien aperçu SNCF, une actualisation de /editor
   * revient volontairement au mode édition.
   */
  exitPreview()
})

onBeforeUnmount(() => exportSignal.off(doExport))
</script>

<template>
  <div
    class="map-editor"
    :style="{
      '--base-size':
        effectiveBaseSize,
      '--font-size':
        `calc(${effectiveBaseSize} * 16px)`,
    }"
  >
    <div class="editor-content">
      <div class="dead-zone">
        <NuxtErrorBoundary v-if="!error" @error="onError">
          <div
            ref="el"
            class="editor-map-surface"
            :class="{
              'is-export-native-scale': exportNativeScale,
            }"
          >
            <LineCanvas
              :key="previewMode ?? 'EDIT'"
              :preview-mode="previewMode"
            />
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
    <div
      v-if="!isPreviewing"
      class="toolbox-area"
    >
      <div class="editor-toolbox">
        <!--
          MODULE 1 — structure de ligne
          Les wrappers restent display: contents sur desktop afin de
          conserver exactement la topbar d'outils historique.
        -->
        <div class="toolbox-module toolbox-module-structure">
          <LineSectionToolbox />
        </div>

        <!--
          MODULE 2 — contenu de branche + suppression
        -->
        <div class="toolbox-module toolbox-module-content">
          <BranchToolbox />
          <Trash />
        </div>
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


/* Wrappers purement structurels sur desktop : aucun changement visuel. */
.toolbox-module {
  display: contents;
}


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


/* =========================================================
 * RESPONSIVE ÉDITEUR — TABLETTE / MOBILE
 *
 * Le plan conserve sa vraie échelle de données. On ne dézoome que
 * la surface de travail, afin que les exports restent identiques.
 * ========================================================= */
.editor-content {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

@media (max-width: 1100px) {
  .editor-content {
    touch-action: pan-x pan-y;
  }

  .dead-zone {
    align-items: flex-start;
    justify-content: flex-start;

    padding: 1rem 1rem 8.5rem;
  }

  /*
   * Le dock appartient au viewport, pas au contenu scrollable du plan :
   * il reste donc disponible après un pan horizontal ou vertical.
   */
  .toolbox-area {
    position: fixed;

    left: 50%;
    right: auto;
    bottom: calc(2.9rem + env(safe-area-inset-bottom));

    width: fit-content;
    max-width: calc(100vw - 1rem);

    transform: translateX(-50%);

    z-index: 90;
    overscroll-behavior: none;
  }

  .editor-toolbox {
    width: fit-content;
    max-width: calc(100vw - .75rem);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .2rem;

    margin-inline: auto;
    padding: .3rem .34rem;

    overflow: visible;

    /*
     * Mobile / tablette : un seul dock continu en deux rangées.
     * Les modules ne portent plus chacun leur propre carte visuelle.
     */
    background:
      linear-gradient(
        180deg,
        rgb(39 39 42 / 88%) 0%,
        rgb(22 22 25 / 84%) 100%
      );

    -webkit-backdrop-filter: blur(22px) saturate(170%);
    backdrop-filter: blur(22px) saturate(170%);

    border: 1px solid rgb(255 255 255 / 17%);
    border-radius: 1rem;

    box-shadow:
      0 .5rem 1.3rem rgb(0 0 0 / 26%),
      inset 0 1px 0 rgb(255 255 255 / 14%);
  }

  .editor-toolbox::before {
    display: none;
  }

  /*
   * Deux modules horizontaux indépendants. Les vrais conteneurs Sortable
   * restent les .toolbox-section internes, donc le drag tactile reste intact.
   */
  .toolbox-module {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    justify-content: center;

    width: fit-content;
    max-width: 100%;
    padding: 0;

    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .toolbox-module-content {
    gap: .18rem;
  }

  .editor-toolbox :deep(.toolbox-section),
  .editor-toolbox :deep(.draggable-elements) {
    display: flex !important;
    flex-flow: row nowrap;
    align-items: stretch;
    justify-content: center;
    gap: .16rem !important;

    width: fit-content;
    max-width: 100%;
  }

  .editor-toolbox,
  .editor-toolbox :deep(.toolbox-item) {
    touch-action: none;
  }

  /* Les éléments déjà présents dans le plan restent eux aussi déplaçables. */
  .editor-content :deep(.branch-element-handle) {
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .toolbox-group-separator,
  .editor-toolbox > .flex-grow {
    display: none !important;
  }

  .editor-toolbox :deep(.toolbox-item),
  .editor-toolbox > .toolbox-item {
    min-width: 4.55rem !important;
    min-height: 3.35rem;

    padding: .38rem .28rem !important;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: .75rem !important;

    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .editor-toolbox :deep(.toolbox-item span),
  .editor-toolbox > .toolbox-item span {
    max-width: 4.8rem;

    font-size: .67rem !important;
    line-height: 1.08;

    white-space: normal;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .editor-toolbox :deep(.toolbox-item i),
  .editor-toolbox > .toolbox-item i {
    font-size: 1rem;
  }
}

@media (max-width: 720px) {
  .map-editor {
    border-radius: 0;
  }

  .dead-zone {
    padding: .55rem .55rem 9.5rem;
  }

  .toolbox-area {
    left: 50%;
    right: auto;
    bottom: calc(3.15rem + env(safe-area-inset-bottom));

    width: fit-content;
    max-width: calc(100vw - 1rem);

    transform: translateX(-50%);
  }

  .editor-toolbox {
    width: fit-content;
    max-width: calc(100vw - .55rem);
    gap: .18rem;
    padding: .26rem .26rem .3rem;
    border-radius: .9rem;
  }

  .toolbox-module {
    max-width: 100%;
    padding: 0;
  }

  .toolbox-module-content {
    gap: .14rem;
  }

  .editor-toolbox :deep(.toolbox-section),
  .editor-toolbox :deep(.draggable-elements) {
    gap: .1rem !important;
  }

  .editor-toolbox :deep(.toolbox-item),
  .editor-toolbox > .toolbox-item {
    min-width: 3.72rem !important;
    min-height: 3.05rem;
    padding: .3rem .16rem !important;
  }

  .editor-toolbox :deep(.toolbox-item span),
  .editor-toolbox > .toolbox-item span {
    max-width: 3.95rem;
    font-size: .64rem !important;
    line-height: 1.1;
  }
}

@media (max-width: 390px) {
  .editor-toolbox :deep(.toolbox-item),
  .editor-toolbox > .toolbox-item {
    min-width: 3.48rem !important;
  }

  .editor-toolbox :deep(.toolbox-item span),
  .editor-toolbox > .toolbox-item span {
    max-width: 3.62rem;
    font-size: .6rem !important;
  }
}

/* Téléphone paysage : plan encore plus compact, dock sur deux lignes courtes. */
@media (max-height: 560px) and (orientation: landscape) and (max-width: 1000px) {
  .dead-zone {
    padding-bottom: 6.5rem;
  }

  .editor-toolbox :deep(.toolbox-item),
  .editor-toolbox > .toolbox-item {
    min-height: 2.45rem;
  }
}


</style>
