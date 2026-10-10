<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ code: string }>()
const failed = ref(false)
const normalizedCode = computed(() => String(props.code ?? '').trim().toUpperCase())
const validCode = computed(() => /^[A-Z]{2}$/.test(normalizedCode.value))
const flagUrl = computed(() => validCode.value ? `https://flagcdn.com/w40/${normalizedCode.value.toLowerCase()}.png` : '')

watch(normalizedCode, () => { failed.value = false })
</script>

<template>
  <span class="country-flag" role="img" :aria-label="validCode ? `Drapeau ${normalizedCode}` : 'Drapeau'">
    <img v-if="validCode && !failed" :src="flagUrl" alt="" loading="lazy" decoding="async" @error="failed = true">
    <span v-else class="country-flag__fallback">{{ validCode ? normalizedCode : '🌐' }}</span>
  </span>
</template>

<style scoped>
.country-flag{display:grid;place-items:center;width:22px;height:15px;border-radius:2.5px;overflow:hidden;background:#25333c;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 2px 7px rgba(0,0,0,.25)}.country-flag img{display:block;width:100%;height:100%;object-fit:cover}.country-flag__fallback{font-size:8px;line-height:1;font-weight:900;letter-spacing:.02em;color:#dcecf3}
</style>
