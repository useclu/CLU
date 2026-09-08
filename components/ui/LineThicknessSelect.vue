<script setup lang="ts">
import type { SelectChangeEvent } from 'primevue/select'
import { ref, watch } from 'vue'

interface LineThicknessChoice {
  value: string
  label: string
}

const THICKNESSES: LineThicknessChoice[] = [
  { label: 'data.line_thickness.normal', value: '0.375' },
  { label: 'data.line_thickness.medium', value: '0.625' },
  { label: 'data.line_thickness.thick', value: '1.5' },
  { label: 'data.line_thickness.custom', value: '' },
]

const emit = defineEmits<{
  openCustom: []
}>()

function findThicknessByValue(
  value: string | null,
): LineThicknessChoice {
  return (
    THICKNESSES.find(
      thickness =>
        thickness.value === value,
    )
    ?? {
      label: 'data.line_thickness.custom',
      value: '',
    }
  )
}

const thickness =
  defineModel<string | null>({
    required: true,
  })

const selectedThickness =
  ref<LineThicknessChoice | null>(
    findThicknessByValue(
      thickness.value,
    ),
  )

/*
 * =========================================================
 * SYNCHRONISATION
 * =========================================================
 */

watch(
  thickness,
  (value) => {
    selectedThickness.value =
      findThicknessByValue(value)
  },
)

/*
 * =========================================================
 * SÉLECTION
 * =========================================================
 *
 * Les épaisseurs prédéfinies sont appliquées directement.
 *
 * "Personnalisé" n'est pas une vraie valeur :
 * il sert uniquement à demander au composant parent
 * d'ouvrir la fenêtre d'édition personnalisée.
 *
 * Le Dialog n'est volontairement PLUS présent dans
 * LineThicknessSelect.
 *
 * Cela permet au parent de placer le Dialog en dehors
 * du Popover Outils afin qu'il ne soit pas détruit
 * lorsque le Popover se ferme.
 */

function handleChange(
  event: SelectChangeEvent,
) {
  const choice =
    event.value as LineThicknessChoice | null

  if (!choice) {
    return
  }

  if (choice.value === '') {
    /*
     * On restaure immédiatement l'affichage correspondant
     * à la vraie épaisseur enregistrée.
     */
    selectedThickness.value =
      findThicknessByValue(
        thickness.value,
      )

    emit('openCustom')

    return
  }

  thickness.value =
    choice.value
}
</script>

<template>
  <Select
    v-model="selectedThickness"
    :options="THICKNESSES"
    :placeholder="$t('components.line_thickness_select.placeholder')"
    class="flex-auto"
    @change="handleChange"
  >
    <template #value="slotProps">
      <div
        v-if="slotProps.value"
        class="flex items-center gap-1"
      >
        <span>
          {{
            $t(
              slotProps.value.label.toLowerCase(),
            )
          }}
        </span>

        <span class="opacity-50">
          {{
            slotProps.value.value
            || thickness
            || '1'
          }}
        </span>
      </div>
    </template>

    <template #option="slotProps">
      <div class="flex items-center gap-1">
        <span>
          {{
            $t(
              slotProps.option.label.toLowerCase(),
            )
          }}
        </span>

        <span
          v-if="slotProps.option.value"
          class="opacity-50"
        >
          {{ slotProps.option.value }}
        </span>
      </div>
    </template>
  </Select>
</template>