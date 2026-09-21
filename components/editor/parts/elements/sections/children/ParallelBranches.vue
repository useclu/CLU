<script setup lang="ts">
import { computed, inject, provide } from 'vue'

const meta = defineModel<ParallelBranches>({ required: true })

type NumericComputedRef = {
  readonly value: number
}

/*
 * Niveau absolu de la section qui contient ce ParallelBranches.
 * SectionEditor le fournit de manière récursive : on peut donc calculer
 * les vrais niveaux des deux sorties sans dépendre du DOM ni de l'ordre
 * dans lequel les éléments ont été déposés.
 */
const parentSectionAbsoluteLevel =
  inject<NumericComputedRef>(
    'sectionAbsoluteLevel',
    computed(() => 0),
  )

const absoluteOutputLevels =
  computed<[number, number]>(() => {
    const sections =
      meta.value.$parallelBranches.sections

    const base =
      parentSectionAbsoluteLevel.value

    return [
      base
      + (
        sections[0]?.$lineSection.levelOffset
        ?? 0
      ),
      base
      + (
        sections[1]?.$lineSection.levelOffset
        ?? 0
      ),
    ]
  })

/*
 * Les SectionEditor des deux sorties peuvent maintenant convertir ces
 * niveaux absolus en offsets locaux pour un Demi-tour déposé dedans.
 */
provide(
  'parallelBranchesAbsoluteLevels',
  absoluteOutputLevels,
)
</script>

<template>
  <div
    class="parallel-branches my-6em relative flex flex-col"
    :data-parallel-branches-id="meta.id"
    :class="{
      left: meta.$parallelBranches.alignement === 'LEFT',
      right: meta.$parallelBranches.alignement === 'RIGHT',
      fluid: meta.$parallelBranches.alignement === 'FLUID',
    }"
  >
    <div
      v-for="(section, i) in meta.$parallelBranches.sections"
      :key="section.id"
      class="child-branch"
      :data-output-index="i"
    >
      <SectionEditor v-model="meta.$parallelBranches.sections[i]" :fluid="meta.$parallelBranches.alignement === 'FLUID'" inner />
    </div>
  </div>
</template>

<style scoped lang="scss">
.child-branch {
  height: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}


/*
 * Fork.vue peut appliquer un décalage horizontal purement visuel aux
 * contenus d'une sortie pour éviter les collisions de noms. Lorsque
 * les sorties vivent dans un vrai ParallelBranches sibling, on reprend
 * ici exactement la même variable CSS que l'ancien rendu interne.
 */
.child-branch :deep(
  > .section
  > .elements
  > .section-element
  > .branch-wrapper
  > .branch-elements
) {
  margin-left:
    var(
      --fork-output-content-offset-x,
      0px
    );

  transition:
    margin-left .15s ease;
}

.left {
  align-items: start;
}

.right {
  align-items: end;
}

.fluid {
  align-items: stretch;
}
</style>