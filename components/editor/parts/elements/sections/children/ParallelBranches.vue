<script setup lang="ts">
const meta = defineModel<ParallelBranches>({ required: true })
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