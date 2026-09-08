<script setup lang="ts">
import type { SelectChangeEvent } from 'primevue/select'
import { ref, watch } from 'vue'

interface SizeChoice {
  value: string | null
  label: string
}

const SIZES: SizeChoice[] = [
  { label: 'data.map_size.normal', value: '15' },
  { label: 'data.map_size.large', value: '20' },
  { label: 'data.map_size.big', value: '30' },
  { label: 'data.map_size.huge', value: '50' },
  { label: 'data.map_size.custom', value: '' },
]

const emit = defineEmits<{
  openCustom: []
}>()

function findMapSizeByValue(
  value: string | number | null,
): SizeChoice {
  const normalizedValue =
    value === null
      ? null
      : String(value)

  return (
    SIZES.find(
      size =>
        size.value === normalizedValue,
    )
    ?? {
      label: 'data.map_size.custom',
      value: '',
    }
  )
}

const size =
  defineModel<string | number | null>({
    required: true,
  })

const selectedSize =
  ref<SizeChoice | null>(
    findMapSizeByValue(
      size.value,
    ),
  )

/*
 * =========================================================
 * SYNCHRONISATION
 * =========================================================
 */

watch(
  size,
  (value) => {
    selectedSize.value =
      findMapSizeByValue(value)
  },
)

/*
 * =========================================================
 * SÉLECTION
 * =========================================================
 *
 * Les tailles normales sont appliquées directement.
 *
 * "Personnalisé" n'est pas une vraie valeur :
 * il sert uniquement à demander au composant parent
 * d'ouvrir la fenêtre d'édition personnalisée.
 *
 * Le Dialog n'est volontairement PLUS présent dans
 * MapSizeSelect.
 *
 * Cela permet au parent de placer le Dialog en dehors
 * du Popover Outils afin qu'il ne soit pas détruit
 * lorsque le Popover se ferme.
 */

function handleChange(
  event: SelectChangeEvent,
) {
  const choice =
    event.value as SizeChoice | null

  if (!choice) {
    return
  }

  if (choice.value === '') {
    /*
     * On restaure immédiatement l'affichage correspondant
     * à la vraie taille enregistrée.
     */
    selectedSize.value =
      findMapSizeByValue(
        size.value,
      )

    emit('openCustom')

    return
  }

  size.value =
    choice.value
}
</script>

<template>
  <Select
    v-model="selectedSize"
    :options="SIZES"
    :placeholder="$t('components.map_size_select.placeholder')"
    class="flex-auto"
    @change="handleChange"
  >
    <template #value="slotProps">
      <div
        v-if="slotProps.value"
        class="flex items-center gap-1"
      >
        <span>
          {{ $t(slotProps.value.label) }}
        </span>

        <span class="opacity-50">
          {{
            slotProps.value.value
            || size
          }}em
        </span>
      </div>
    </template>

    <template #option="slotProps">
      <div class="flex items-center gap-1">
        <span>
          {{ $t(slotProps.option.label) }}
        </span>

        <span
          v-if="slotProps.option.value"
          class="opacity-50"
        >
          {{ slotProps.option.value }}em
        </span>
      </div>
    </template>
  </Select>
</template>