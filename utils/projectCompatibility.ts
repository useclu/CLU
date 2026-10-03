const MODES = new Set([
  'BOAT',
  'BRT',
  'BUS',
  'CABLE',
  'METRO',
  'NOCTILIEN',
  'RER',
  'TRAIN',
  'TRAIN_RER',
  'TRAM',
  'VELO',
])

const INDEX_SHAPES = new Set([
  'CIRCLE',
  'ROUNDED_SQUARE',
  'LINES',
  'RECTANGLE',
  'CUT_RECTANGLE',
])

const LINE_STYLES = new Set([
  'PLAIN',
  'STRIPED',
])

const DOTS_POLICIES = new Set([
  'INHERIT',
  'WHITE',
])

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
}

function legacyShapeForMode(
  mode: Mode,
): IndexShape {
  switch (mode) {
    case 'BUS':
    case 'BRT':
    case 'NOCTILIEN':
      return 'RECTANGLE'

    case 'TRAM':
    case 'CABLE':
    case 'BOAT':
    case 'VELO':
      return 'ROUNDED_SQUARE'

    default:
      return 'CIRCLE'
  }
}

function normalizeCustomIndex(
  value: unknown,
): CustomLineIndexDescription | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    typeof value.id === 'string'
      ? value.id.trim()
      : ''

  const mode =
    typeof value.mode === 'string'
      && MODES.has(value.mode)
      ? value.mode as Mode
      : null

  if (!id || !mode) {
    return null
  }

  const shape =
    typeof value.shape === 'string'
      && INDEX_SHAPES.has(value.shape)
      ? value.shape as IndexShape
      : legacyShapeForMode(mode)

  return {
    id,
    index:
      typeof value.index === 'string'
        || typeof value.index === 'number'
        ? String(value.index)
        : '',
    prefix:
      typeof value.prefix === 'string'
        ? value.prefix
        : '',
    suffix:
      typeof value.suffix === 'string'
        ? value.suffix
        : '',
    shape,
    mode,
    color:
      typeof value.color === 'string'
        && value.color.trim()
        ? value.color
        : '#000000',
    image:
      typeof value.image === 'string'
        ? value.image
        : null,
  }
}

function normalizeLine(
  value: unknown,
): Line {
  if (!isRecord(value)) {
    throw new Error(
      'Le projet ne contient pas de ligne CLU exploitable.',
    )
  }

  if (!Array.isArray(value.topology)) {
    throw new Error(
      'La topologie de cette ancienne sauvegarde est absente ou illisible.',
    )
  }

  const mode =
    typeof value.mode === 'string'
      && MODES.has(value.mode)
      ? value.mode as Mode
      : null

  const lineStyle =
    typeof value.lineStyle === 'string'
      && LINE_STYLES.has(value.lineStyle)
      ? value.lineStyle as LineStyle
      : 'PLAIN'

  const dotsColorPolicy =
    typeof value.dotsColorPolicy === 'string'
      && DOTS_POLICIES.has(value.dotsColorPolicy)
      ? value.dotsColorPolicy as DotsColorPolicy
      : 'INHERIT'

  const normalized = {
    ...value,
    mode,
    index:
      isRecord(value.index)
        ? value.index as LineIndex
        : null,
    color:
      typeof value.color === 'string'
        ? value.color
        : null,
    lineThickness:
      typeof value.lineThickness === 'string'
        || typeof value.lineThickness === 'number'
        ? String(value.lineThickness)
        : '0.375',
    lineStyle,
    dotsColorPolicy,
    mapSize:
      Number.isFinite(Number(value.mapSize))
        ? Number(value.mapSize)
        : 15,
    fullyAccessible:
      value.fullyAccessible === true,
    frameTerminusNames:
      typeof value.frameTerminusNames === 'boolean'
        ? value.frameTerminusNames
        : true,
    topology:
      value.topology as LineSection[],
  } as unknown as Line

  /*
   * Champs ajoutés après les premiers projets 1.0.0.
   * Ils restent facultatifs dans les anciens JSON : on les initialise ici sans
   * toucher à la topologie, aux IDs, aux branches ni aux correspondances.
   */
  const record =
    normalized as unknown as
    Record<string, unknown>

  if (!Array.isArray(record.annotations)) {
    record.annotations = []
  }

  if (!isRecord(record.customModePictograms)) {
    record.customModePictograms = {}
  }

  return normalized
}

export interface NormalizedProjectLoad {
  project: Project
  migratedLegacyProject: boolean
}

/**
 * Rend lisibles les projets CLU Editor historiques sans imposer une migration
 * destructive du fichier source.
 *
 * Les anciens exports 1.0.0 n'avaient pas forcément tous les champs apparus
 * ensuite (presetBased, préfixe/suffixe d'indice, image, annotations, etc.).
 * Le chargeur complète uniquement ces valeurs optionnelles et conserve toute
 * la topologie telle quelle.
 */
export function normalizeProjectForLoad(
  value: unknown,
): NormalizedProjectLoad {
  if (!isRecord(value)) {
    throw new Error(
      'Le fichier ne contient pas un projet CLU Editor valide.',
    )
  }

  const rawLine = value.line
  const line = normalizeLine(rawLine)

  const legacyIndices =
    Array.isArray(value.customIndices)
      ? value.customIndices
      : Array.isArray(value.customLineIndices)
        ? value.customLineIndices
        : []

  const customIndices = legacyIndices
    .map(normalizeCustomIndex)
    .filter(
      (
        index,
      ): index is CustomLineIndexDescription =>
        index !== null,
    )

  const version =
    typeof value.version === 'string'
      && value.version.trim()
      ? value.version.trim()
      : '1.0.0'

  const presetBased =
    typeof value.presetBased === 'boolean'
      ? value.presetBased
      : false

  const migratedLegacyProject =
    !(typeof value.version === 'string' && value.version.trim())
    || !Array.isArray(value.customIndices)
    || typeof value.presetBased !== 'boolean'
    || customIndices.some((index, position) => {
      const source = legacyIndices[position]
      if (!isRecord(source)) return true
      return typeof source.prefix !== 'string'
        || typeof source.suffix !== 'string'
        || !('image' in source)
    })
    || (isRecord(rawLine)
      && (
        !Array.isArray(rawLine.annotations)
        || !isRecord(rawLine.customModePictograms)
      ))

  return {
    project: {
      version,
      presetBased,
      line,
      customIndices,
    },
    migratedLegacyProject,
  }
}
