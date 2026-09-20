export const MAP_FONT_OPTIONS: ReadonlyArray<{
  value: MapFontFamily
  label: string
}> = [
  {
    value: 'PARISINE',
    label: 'Parisine',
  },
  {
    value: 'IDF_VOYAGEUR',
    label: 'IDF Voyageur (IDFM)',
  },
  {
    value: 'ACHEMINE',
    label: 'Achemine (Transilien)',
  },
]

const MAP_FONT_CSS_FAMILIES: Record<MapFontFamily, string> = {
  PARISINE: "'Parisine Ptf', sans-serif",
  IDF_VOYAGEUR: "'IDF Voyageur', 'Parisine Ptf', sans-serif",
  ACHEMINE: "'Achemine', 'Parisine Ptf', sans-serif",
}

export function normalizeMapFontFamily(
  value: MapFontFamily | string | null | undefined,
): MapFontFamily {
  if (
    value === 'IDF_VOYAGEUR'
    || value === 'ACHEMINE'
    || value === 'PARISINE'
  ) {
    return value
  }

  return 'PARISINE'
}

export function getMapFontCssFamily(
  value: MapFontFamily | string | null | undefined,
): string {
  return MAP_FONT_CSS_FAMILIES[
    normalizeMapFontFamily(value)
  ]
}
