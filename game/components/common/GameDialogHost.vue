<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useGameDialog } from '../../composables/useGameDialog'

const dialogs = useGameDialog()
const primaryButton = ref<HTMLButtonElement | null>(null)

watch(
  () => dialogs.dialog.value?.id,
  async id => {
    if (!id) return
    await nextTick()
    primaryButton.value?.focus()
  },
)

function onKeydown(event: KeyboardEvent) {
  if (!dialogs.dialog.value || event.key !== 'Escape') return
  event.preventDefault()
  if (dialogs.dialog.value.kind === 'ALERT') dialogs.accept()
  else dialogs.cancel()
}

if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="clu-dialog-fade">
    <div v-if="dialogs.dialog.value" class="clu-dialog-backdrop">
      <section
        class="clu-dialog-card"
        :class="{ 'clu-dialog-card--danger': dialogs.dialog.value.tone === 'DANGER' }"
        :role="dialogs.dialog.value.kind === 'CONFIRM' ? 'alertdialog' : 'dialog'"
        aria-modal="true"
        aria-labelledby="clu-dialog-title"
        aria-describedby="clu-dialog-message"
      >
        <span class="clu-dialog-kicker">CLU Métropole</span>
        <h2 id="clu-dialog-title" data-i18n-skip>{{ dialogs.dialog.value.title }}</h2>
        <p id="clu-dialog-message" data-i18n-skip>{{ dialogs.dialog.value.message }}</p>
        <div class="clu-dialog-actions">
          <button
            v-if="dialogs.dialog.value.kind === 'CONFIRM'"
            type="button"
            class="clu-dialog-secondary"
            data-i18n-skip
            @click="dialogs.cancel()"
          >{{ dialogs.dialog.value.cancelLabel }}</button>
          <button
            ref="primaryButton"
            type="button"
            class="clu-dialog-primary"
            :class="{ danger: dialogs.dialog.value.tone === 'DANGER' }"
            data-i18n-skip
            @click="dialogs.accept()"
          >{{ dialogs.dialog.value.confirmLabel }}</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.clu-dialog-backdrop{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.58);backdrop-filter:blur(9px)}
.clu-dialog-card{width:min(430px,calc(100vw - 36px));padding:22px;border:1px solid rgba(255,255,255,.13);border-radius:19px;background:#10191f;color:#edf6f7;box-shadow:0 28px 90px rgba(0,0,0,.56);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.clu-dialog-card--danger{border-color:rgba(255,102,112,.28)}
.clu-dialog-kicker{display:block;margin-bottom:4px;color:#86e6eb;font-size:calc(9px * var(--clu-text-scale,1));font-weight:900;letter-spacing:.14em;text-transform:uppercase}
h2{margin:0;font-size:calc(20px * var(--clu-text-scale,1));line-height:1.2}
p{margin:10px 0 0;color:rgba(237,246,247,.72);font-size:calc(12px * var(--clu-text-scale,1));line-height:1.58;white-space:pre-line}
.clu-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
button{min-width:92px;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 12px;background:rgba(255,255,255,.055);color:inherit;font:750 calc(11px * var(--clu-text-scale,1))/1.2 inherit;cursor:pointer}
button:focus-visible{outline:3px solid #83f2f6;outline-offset:3px}
.clu-dialog-primary{border-color:rgba(79,211,220,.38);background:rgba(79,211,220,.16)}
.clu-dialog-primary.danger{border-color:rgba(255,93,105,.45);background:rgba(178,49,58,.2);color:#ff9aa2}
.clu-dialog-fade-enter-active,.clu-dialog-fade-leave-active{transition:opacity .16s ease}
.clu-dialog-fade-enter-from,.clu-dialog-fade-leave-to{opacity:0}
@media(max-width:520px){.clu-dialog-actions{flex-direction:column-reverse}.clu-dialog-actions button{width:100%}}
@media(prefers-reduced-motion:reduce){.clu-dialog-fade-enter-active,.clu-dialog-fade-leave-active{transition-duration:.001ms}}
</style>
