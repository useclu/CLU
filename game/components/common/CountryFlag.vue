<script setup lang="ts">
defineProps<{ code: string }>()
</script>

<template>
  <svg class="country-flag" viewBox="0 0 30 20" role="img" :aria-label="`Drapeau ${code}`" xmlns="http://www.w3.org/2000/svg">
    <template v-if="code === 'FR'"><rect width="10" height="20" fill="#1b3f8b"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#e33a45"/></template>
    <template v-else-if="code === 'GB'"><rect width="30" height="20" fill="#183c78"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="5"/><path d="M0 0L30 20M30 0L0 20" stroke="#c93245" stroke-width="2.2"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#c93245" stroke-width="3.2"/></template>
    <template v-else-if="code === 'DE'"><rect width="30" height="6.67" fill="#151515"/><rect y="6.67" width="30" height="6.67" fill="#d72f3f"/><rect y="13.34" width="30" height="6.66" fill="#f0c645"/></template>
    <template v-else-if="code === 'NL'"><rect width="30" height="6.67" fill="#b83844"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#294d88"/></template>
    <template v-else-if="code === 'BE'"><rect width="10" height="20" fill="#171717"/><rect x="10" width="10" height="20" fill="#f0ce48"/><rect x="20" width="10" height="20" fill="#d93c45"/></template>
    <template v-else-if="code === 'ES'"><rect width="30" height="5" fill="#bb3340"/><rect y="5" width="30" height="10" fill="#e8c14b"/><rect y="15" width="30" height="5" fill="#bb3340"/><circle cx="10" cy="10" r="2" fill="#aa3340"/></template>
    <template v-else-if="code === 'IT'"><rect width="10" height="20" fill="#25845f"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#d8444d"/></template>
    <template v-else-if="code === 'PL'"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d84358"/></template>
    <template v-else-if="code === 'PT'"><rect width="12" height="20" fill="#1f7654"/><rect x="12" width="18" height="20" fill="#c83b47"/><circle cx="12" cy="10" r="3.4" fill="#e1bd50"/><circle cx="12" cy="10" r="2" fill="#fff"/></template>
    <template v-else-if="code === 'CZ'"><rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#c53a48"/><path d="M0 0L13 10L0 20Z" fill="#36588d"/></template>
    <template v-else-if="code === 'CH'"><rect width="30" height="20" fill="#d63d45"/><rect x="12" y="4" width="6" height="12" fill="#fff"/><rect x="9" y="7" width="12" height="6" fill="#fff"/></template>
    <template v-else-if="code === 'US'"><rect width="30" height="20" fill="#fff"/><path d="M0 1.5H30M0 4.6H30M0 7.7H30M0 10.8H30M0 13.9H30M0 17H30M0 19.8H30" stroke="#bd3c49" stroke-width="1.55"/><rect width="13" height="10.8" fill="#315081"/><g fill="#fff"><circle cx="2.2" cy="2" r=".6"/><circle cx="5" cy="2" r=".6"/><circle cx="7.8" cy="2" r=".6"/><circle cx="10.6" cy="2" r=".6"/><circle cx="3.6" cy="4.7" r=".6"/><circle cx="6.4" cy="4.7" r=".6"/><circle cx="9.2" cy="4.7" r=".6"/><circle cx="2.2" cy="7.4" r=".6"/><circle cx="5" cy="7.4" r=".6"/><circle cx="7.8" cy="7.4" r=".6"/><circle cx="10.6" cy="7.4" r=".6"/></g></template>
    <template v-else-if="code === 'CA'"><rect width="7" height="20" fill="#d43e49"/><rect x="23" width="7" height="20" fill="#d43e49"/><rect x="7" width="16" height="20" fill="#fff"/><path d="M15 4l1.1 3 2.4-1.1-1 2.6 2.5.5-3 2.1.5 3.6-2.5-1.5-2.5 1.5.5-3.6-3-2.1 2.5-.5-1-2.6L13.9 7z" fill="#d43e49"/></template>
    <template v-else-if="code === 'JP'"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#c93b4d"/></template>
    <template v-else-if="code === 'AT'"><rect width="30" height="20" fill="#d43e49"/><rect y="6.67" width="30" height="6.66" fill="#fff"/></template>
    <template v-else-if="code === 'DK'"><rect width="30" height="20" fill="#c83845"/><rect x="9" width="3" height="20" fill="#fff"/><rect y="8.5" width="30" height="3" fill="#fff"/></template>
    <template v-else-if="code === 'SE'"><rect width="30" height="20" fill="#2f5f9a"/><rect x="9" width="3" height="20" fill="#f0c94c"/><rect y="8.5" width="30" height="3" fill="#f0c94c"/></template>
    <template v-else-if="code === 'NO'"><rect width="30" height="20" fill="#c83b47"/><rect x="8" width="5" height="20" fill="#fff"/><rect y="7.5" width="30" height="5" fill="#fff"/><rect x="9.5" width="2" height="20" fill="#244b80"/><rect y="9" width="30" height="2" fill="#244b80"/></template>
    <template v-else-if="code === 'FI'"><rect width="30" height="20" fill="#fff"/><rect x="9" width="4" height="20" fill="#315d93"/><rect y="8" width="30" height="4" fill="#315d93"/></template>
    <template v-else-if="code === 'GR'"><rect width="30" height="20" fill="#315f9d"/><path d="M0 2.2H30M0 6.7H30M0 11.1H30M0 15.6H30" stroke="#fff" stroke-width="2.2"/><rect width="12" height="11" fill="#315f9d"/><rect x="5" width="2" height="11" fill="#fff"/><rect y="4.5" width="12" height="2" fill="#fff"/></template>
    <template v-else-if="code === 'HU'"><rect width="30" height="6.67" fill="#ce3e49"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#3f8b61"/></template>
    <template v-else-if="code === 'TR'"><rect width="30" height="20" fill="#d23d49"/><circle cx="12" cy="10" r="5" fill="#fff"/><circle cx="14" cy="10" r="4" fill="#d23d49"/><circle cx="19" cy="10" r="1.2" fill="#fff"/></template>
    <template v-else-if="code === 'BR'"><rect width="30" height="20" fill="#2f8a58"/><path d="M15 3L26 10L15 17L4 10Z" fill="#e7c64e"/><circle cx="15" cy="10" r="4" fill="#31538a"/></template>
    <template v-else-if="code === 'AU'"><rect width="30" height="20" fill="#24467c"/><path d="M0 0L13 9M13 0L0 9" stroke="#fff" stroke-width="2.2"/><path d="M6.5 0V9M0 4.5H13" stroke="#d43d49" stroke-width="1.2"/><g fill="#fff"><circle cx="21" cy="5" r="1"/><circle cx="25" cy="10" r="1"/><circle cx="20" cy="14" r="1"/><circle cx="26" cy="16" r=".8"/></g></template>
    <template v-else-if="code === 'MA'"><rect width="30" height="20" fill="#c63b45"/><path d="M15 5l1.5 3.2 3.5.3-2.7 2.3.8 3.5-3.1-1.8-3.1 1.8.8-3.5-2.7-2.3 3.5-.3z" fill="none" stroke="#26724f" stroke-width="1.1"/></template>
    <template v-else-if="code === 'AE'"><rect width="30" height="20" fill="#fff"/><rect width="8" height="20" fill="#d43e49"/><rect x="8" width="22" height="6.67" fill="#26805a"/><rect x="8" y="13.34" width="22" height="6.66" fill="#151515"/></template>
    <template v-else-if="code === 'IE'"><rect width="10" height="20" fill="#2e865f"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#e58a4d"/></template>
    <template v-else-if="code === 'UA'"><rect width="30" height="10" fill="#3975b8"/><rect y="10" width="30" height="10" fill="#f0c94c"/></template>
    <template v-else-if="code === 'RU'"><rect width="30" height="6.67" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#355994"/><rect y="13.34" width="30" height="6.66" fill="#c93d48"/></template>
    <template v-else-if="code === 'IN'"><rect width="30" height="6.67" fill="#e48a4e"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#2f8657"/><circle cx="15" cy="10" r="2" fill="none" stroke="#31558b" stroke-width=".8"/></template>
    <template v-else-if="code === 'SA'"><rect width="30" height="20" fill="#2b8058"/><rect x="8" y="13.5" width="14" height="1.2" fill="#fff"/><rect x="7" y="7" width="16" height="2" fill="#fff" opacity=".9"/></template>
    <template v-else-if="code === 'KR'"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4" fill="#d5454d"/><path d="M11 10a4 4 0 0 0 8 0a2 2 0 0 1-4 0a2 2 0 0 0-4 0" fill="#315b95"/></template>
    <template v-else-if="code === 'HR'"><rect width="30" height="6.67" fill="#d43e49"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#315b94"/><rect x="12" y="7" width="6" height="6" fill="#d43e49"/></template>
    <template v-else-if="code === 'DZ'"><rect width="15" height="20" fill="#2a7d58"/><rect x="15" width="15" height="20" fill="#fff"/><circle cx="16" cy="10" r="4" fill="#d13e49"/><circle cx="17.5" cy="10" r="3.2" fill="#fff"/></template>
    <template v-else-if="code === 'CN'"><rect width="30" height="20" fill="#d33f48"/><circle cx="7" cy="6" r="2.2" fill="#f0c94c"/><g fill="#f0c94c"><circle cx="12" cy="3" r=".7"/><circle cx="14" cy="6" r=".7"/><circle cx="13" cy="9" r=".7"/><circle cx="10.5" cy="11" r=".7"/></g></template>
    <template v-else-if="code === 'MX'"><rect width="10" height="20" fill="#2f8059"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#cf3f49"/><circle cx="15" cy="10" r="1.6" fill="#876b3b"/></template>
    <template v-else-if="code === 'EG'"><rect width="30" height="6.67" fill="#cf3e48"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#151515"/><circle cx="15" cy="10" r="1.4" fill="#d0a83e"/></template>
    <template v-else-if="code === 'AR'"><rect width="30" height="6.67" fill="#70b6d8"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.34" width="30" height="6.66" fill="#70b6d8"/><circle cx="15" cy="10" r="1.4" fill="#d9aa3c"/></template>
    <template v-else-if="code === 'CO'"><rect width="30" height="10" fill="#e7c54b"/><rect y="10" width="30" height="5" fill="#31558e"/><rect y="15" width="30" height="5" fill="#ca3d48"/></template>
    <template v-else><rect width="30" height="20" fill="#25333c"/><text x="15" y="13" fill="#fff" font-size="7" text-anchor="middle" font-family="sans-serif">{{ code }}</text></template>
  </svg>
</template>

<style scoped>
.country-flag{display:block;width:22px;height:15px;border-radius:2.5px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 2px 7px rgba(0,0,0,.25)}
</style>
