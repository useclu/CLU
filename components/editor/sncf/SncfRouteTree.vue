<script setup lang="ts">
import type { SncfRouteItem } from '~/utils/sncfRouteTree'

defineOptions({ name: 'SncfRouteTree' })

const {
  items,
  color,
  rootFirstStopId = null,
  connectionTransform,
  frameTerminusNames = false,
  depth = 0,
} = defineProps<{
  items: SncfRouteItem[]
  color: string
  rootFirstStopId?: string | null
  connectionTransform: (connections: Connection[]) => Connection[]
  frameTerminusNames?: boolean
  depth?: number
}>()

const emit = defineEmits<{
  openStop: [stop: Stop]
  deleteStop: [stop: Stop]
}>()
</script>

<template>
  <div
    class="sncf-route-tree"
    :class="{
      'sncf-route-root': depth === 0,
    }"
    :style="{ '--sncf-route-color': color }"
  >
    <template
      v-for="(item, itemIndex) in items"
      :key="item.key"
    >
      <div
        v-if="item.kind === 'STOP'"
        class="sncf-tree-stop"
        :class="{
          'is-terminus': item.stop.$stop.terminus,
          'is-root-first': item.stop.id === rootFirstStopId,
          'is-first-item': itemIndex === 0,
          'is-last-item': itemIndex === items.length - 1,
        }"
        @click="emit('openStop', item.stop)"
      >
        <div class="sncf-tree-rail-column">
          <span class="sncf-tree-rail-segment" />

          <div
            class="sncf-tree-dot"
            :class="{
              'is-terminus': item.stop.$stop.terminus,
              'is-root-first': item.stop.id === rootFirstStopId,
            }"
          />
        </div>

        <div class="sncf-tree-stop-main">
          <div
            class="sncf-tree-stop-content"
            :class="{
              'terminus-card':
                item.stop.id === rootFirstStopId
                || (
                  frameTerminusNames
                  && item.stop.$stop.terminus
                ),
            }"
          >
            <div class="sncf-tree-stop-text-line">
              <div
                class="sncf-tree-stop-name"
                :class="{ 'is-terminus': item.stop.$stop.terminus || item.stop.id === rootFirstStopId }"
              >
                {{
                  item.stop.$stop.name
                  || $t('ui.map_editor.toolbox.untitled_stop')
                }}
              </div>

              <div
                v-if="item.stop.$stop.subtitle || item.stop.$stop.placeName"
                class="sncf-tree-stop-subtitle"
              >
                {{ item.stop.$stop.subtitle || item.stop.$stop.placeName }}
              </div>
            </div>
          </div>

          <div
            class="sncf-tree-connections"
            @click.stop
          >
            <Connections
              :connections="connectionTransform(item.stop.$stop.connections)"
              :custom-connections="item.stop.$stop.customConnections ?? []"
              :reverse="false"
            />
          </div>

          <button
            type="button"
            class="sncf-tree-stop-delete export-hide"
            :title="$t('ui.map_editor.delete_stop')"
            @click.stop="emit('deleteStop', item.stop)"
          >
            <i class="i-tabler-trash" />
          </button>
        </div>
      </div>

      <div
        v-else
        class="sncf-tree-fork"
      >
        <!--
          La bifurcation SNCF est dessinée comme un vrai Y arrondi.
          Le rail parent reste au même x dans chaque niveau récursif ;
          le conteneur des deux sorties est simplement décalé autour
          de lui. Cela permet à une sous-fourche de reproduire le même
          langage graphique sans empiler des angles droits.
        -->
        <svg
          class="sncf-tree-fork-connectors"
          viewBox="0 0 56 4.4"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 15.55 0 C 15.55 1.45 1.55 1.65 1.55 4.4"
            :stroke="item.branches[0].color"
          />
          <path
            d="M 15.55 0 C 15.55 1.45 29.55 1.65 29.55 4.4"
            :stroke="item.branches[1].color"
          />
        </svg>

        <div class="sncf-tree-fork-branches">
          <div
            v-for="branch in item.branches"
            :key="branch.key"
            class="sncf-tree-fork-branch"
          >
            <SncfRouteTree
              :items="branch.items"
              :color="branch.color"
              :root-first-stop-id="rootFirstStopId"
              :connection-transform="connectionTransform"
              :frame-terminus-names="frameTerminusNames"
              :depth="depth + 1"
              @open-stop="stop => emit('openStop', stop)"
              @delete-stop="stop => emit('deleteStop', stop)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.sncf-route-tree {
  --sncf-rail-x: 1.55em;
  --sncf-column-width: 28em;
  --sncf-fork-shift: 14em;

  position: relative;
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: var(--sncf-column-width);
  overflow: visible;
}

.sncf-tree-stop {
  position: relative;
  z-index: 2;

  display: grid;
  grid-template-columns: 3.1em minmax(21em, max-content);
  align-items: center;

  min-height: 5.55em;
  padding: .25em 0;
}

.sncf-tree-rail-column {
  position: relative;
  display: grid;
  place-items: center;
  align-self: stretch;
  min-height: 5.05em;
}

.sncf-tree-rail-segment {
  position: absolute;
  z-index: 0;
  top: 0;
  bottom: 0;
  left: 50%;
  width: .42em;
  transform: translateX(-50%);
  border-radius: .22em;
  background: var(--sncf-route-color);
}

/* La première station de la racine ne dessine rien au-dessus du point. */
.sncf-route-root
> .sncf-tree-stop.is-first-item
> .sncf-tree-rail-column
> .sncf-tree-rail-segment {
  top: 50%;
}

/* Un terminus final arrête proprement le rail au centre du point. */
.sncf-tree-stop.is-last-item
> .sncf-tree-rail-column
> .sncf-tree-rail-segment {
  bottom: 50%;
}

.sncf-tree-dot {
  position: relative;
  z-index: 2;

  /*
   * Signalétique SNCF : les stations intermédiaires sont de petits
   * points sombres posés SUR le rail coloré, comme sur la référence.
   */
  width: .72em;
  height: .72em;
  box-sizing: border-box;

  border: 0;
  border-radius: 999px;
  background: #1f2f3d;
}

.sncf-tree-dot.is-terminus {
  width: 1.55em;
  height: 1.55em;
  border: .3em solid var(--sncf-route-color);
  background: #1f2f3d;
}

.sncf-tree-dot.is-root-first {
  width: 1.78em;
  height: 1.78em;
  border: .3em solid #fff;
  background: var(--sncf-route-color);
  box-shadow: 0 0 0 .22em rgb(255 255 255 / 38%);
}

.sncf-tree-stop-main {
  position: relative;
  display: flex;
  align-items: center;
  gap: .82em;
  width: max-content;
  min-width: 21em;
  padding: .15em 3em .15em .58em;
}

.sncf-tree-stop-content {
  flex: 0 0 auto;
  width: max-content;
  min-width: 7.5em;
  padding: .3em .55em;
  border-radius: .08em;
}

/* Le réglage "Encadrer les terminus" fonctionne aussi en format SNCF. */
.sncf-tree-stop-content.terminus-card {
  margin-right: .2em;
  padding: .38em .72em .34em;
  background: #fff;
  color: #1f2f3d;
  box-shadow: 0 0 0 .05em rgb(0 0 0 / 8%);
}

.sncf-tree-stop-text-line {
  display: flex;
  flex-direction: column;
  gap: .14em;
}

.sncf-tree-stop-name {
  font-size: 1.08em;
  font-weight: 500;
  line-height: 1.02;
  white-space: nowrap;
}

.sncf-tree-stop-name.is-terminus {
  font-weight: 700;
}

.sncf-tree-stop-subtitle {
  font-size: .66em;
  font-style: italic;
  line-height: 1.04;
  opacity: .78;
  white-space: nowrap;
}

.sncf-tree-connections {
  display: flex;
  align-items: center;
  width: max-content;
  min-width: max-content;
}

.sncf-tree-stop-delete {
  position: absolute;
  right: .1em;
  top: 50%;
  transform: translateY(-50%);

  display: grid;
  place-items: center;
  width: 2.15em;
  height: 2.15em;

  border: 0;
  border-radius: .35em;
  background: rgb(255 255 255 / 10%);
  color: white;
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s ease, background-color .12s ease;
}

.sncf-tree-stop:hover .sncf-tree-stop-delete {
  opacity: 1;
}

.sncf-tree-stop-delete:hover {
  background: rgb(220 38 38 / 78%);
}

/*
 * =========================================================
 * FOURCHE SNCF ARRONDIE
 * =========================================================
 *
 * Deux colonnes de 28em sont centrées autour du rail parent.
 * Chaque sous-arbre conserve son propre rail à 1.55em ; une
 * sous-fourche réutilise exactement la même construction.
 */
.sncf-tree-fork {
  position: relative;
  z-index: 1;
  width: calc(var(--sncf-column-width) * 2);
  min-height: 4.4em;
  padding-top: 4.4em;
  transform: translateX(calc(var(--sncf-fork-shift) * -1));
  overflow: visible;
}

.sncf-tree-fork-connectors {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;

  width: calc(var(--sncf-column-width) * 2);
  height: 4.4em;

  overflow: visible;
  pointer-events: none;
}

.sncf-tree-fork-connectors path {
  fill: none;
  stroke-width: .42em;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.sncf-tree-fork-branches {
  position: relative;
  left: 0;

  display: grid;
  grid-template-columns:
    var(--sncf-column-width)
    var(--sncf-column-width);
  align-items: start;

  width: calc(var(--sncf-column-width) * 2);
  min-width: calc(var(--sncf-column-width) * 2);
  overflow: visible;
}

.sncf-tree-fork-branch {
  position: relative;
  width: var(--sncf-column-width);
  min-width: var(--sncf-column-width);
  overflow: visible;
}

</style>
