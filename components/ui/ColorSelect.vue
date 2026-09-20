<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { COLORS } from '~/data/colors'
import { textContrast } from '~/utils/colors'

const color = defineModel<string | null>({ required: true })
const { t } = useI18n()

const colorTranslationKeys: Record<string, string> = {
  '#ed1c2a': 'data.colors.poppy_red',
  '#f78f4b': 'data.colors.orange',
  '#ffcd02': 'data.colors.bright_yellow',
  '#e0b03b': 'data.colors.ochre_yellow',
  '#8d6539': 'data.colors.brown',
  '#cec92a': 'data.colors.light_olive',
  '#9b993b': 'data.colors.dark_olive',
  '#008c5a': 'data.colors.dark_green',
  '#77c696': 'data.colors.light_green',
  '#00b397': 'data.colors.turquoise',
  '#87d3df': 'data.colors.light_blue',
  '#4c90cd': 'data.colors.ultramarine_blue',
  '#006db8': 'data.colors.dark_blue',
  '#662c91': 'data.colors.violet',
  '#bb4a9b': 'data.colors.magenta',
  '#c5a3cd': 'data.colors.lilac',
  '#f59fb3': 'data.colors.pink',
  '#b80b4b': 'data.colors.raspberry_red',
  '#c8c9c7': 'data.colors.metro_19_gray',
}

const colorOptions = computed<ColorChoice[]>(() =>
  COLORS.map(choice => ({
    ...choice,
    label: t(
      colorTranslationKeys[choice.value.toLowerCase()]
      ?? 'data.colors.custom',
    ),
  })),
)

const selectedColor = computed<ColorChoice | null>({
  get: () => {
    if (color.value === null) {
      return null
    }

    return colorOptions.value.find(
      choice => choice.value.toLowerCase() === color.value?.toLowerCase(),
    ) ?? {
      value: color.value,
      label: t('data.colors.custom'),
    }
  },

  set: value => color.value = value?.value ?? null,
})

function textColor(color: string) {
  return textContrast(color) ? 'white' : '#231f20'
}
</script>

<template>
  <Select
    v-model="selectedColor"
    :options="colorOptions"
    :placeholder="$t('components.color_select.placeholder')"
    option-label="label"
    class="flex-auto"
    filter
  >
    <template #value="slotProps">
      <div
        v-if="slotProps.value"
        :style="{
          backgroundColor: slotProps.value.value,
          color: textColor(slotProps.value.value),
          width: 'fit-content',
        }" class="rounded px-1.5 py-.5 text-sm"
      >
        {{ slotProps.value.label }}
      </div>
    </template>
    <template #option="slotProps">
      <div
        :style="{
          backgroundColor: slotProps.option.value,
          color: textColor(slotProps.option.value),
        }" class="rounded px-1.5 py-.5 text-sm"
      >
        {{ slotProps.option.label }}
      </div>
    </template>
  </Select>
</template>
