<script setup lang="ts">
import { useHead } from '#app'
import { definePageMeta } from '#imports'
import { defineAsyncComponent } from 'vue'

definePageMeta({
  layout: 'default-fixed-size',
})

useHead({
  title: 'CLU Métropole',
})

const GameRoot = defineAsyncComponent(
  () => import('~/game/components/GameRoot.vue'),
)
</script>

<template>
  <div class="metropole-editor-return">
    <a
      href="/editor"
      class="metropole-editor-return__link"
      aria-label="CLU Editor"
    >
      <span aria-hidden="true">←</span>
      <span>CLU Editor</span>
    </a>
  </div>

  <ClientOnly>
    <div class="metropole-game-host">
      <GameRoot />
    </div>

    <template #fallback>
      <div class="metropole-game-fallback" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>

<style scoped lang="scss">
.metropole-editor-return {
  position: fixed;
  z-index: 10000;
  top: 1rem;
  left: 1rem;

  pointer-events: none;
}

.metropole-editor-return__link {
  display: inline-flex;
  align-items: center;
  gap: .5rem;

  min-height: 2.5rem;
  padding: 0 .85rem;

  border: 1px solid rgb(121 226 233 / 22%);
  border-radius: .8rem;

  background: rgb(5 15 21 / 82%);
  color: rgb(239 252 253 / 82%);

  font-size: .75rem;
  font-weight: 760;
  text-decoration: none;

  box-shadow: 0 .75rem 2rem rgb(0 0 0 / 22%);
  backdrop-filter: blur(.8rem);

  pointer-events: auto;
  transition: border-color .18s ease, background .18s ease, color .18s ease, transform .18s ease;
}

.metropole-editor-return__link:hover {
  border-color: rgb(121 226 233 / 48%);
  background: rgb(14 35 43 / 90%);
  color: #9cebf0;
}

.metropole-editor-return__link:active {
  transform: translateY(1px);
}

.metropole-game-host,
.metropole-game-fallback {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 100%;
}

.metropole-game-fallback {
  background: #061017;
}
</style>
