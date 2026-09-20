<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProject } from '~/stores/useProject'
import { cleanName } from '~/utils/text'
import {
  getStopSuggestionById,
  normalizeStopSuggestionText,
  searchStopSuggestions,
  type StopSuggestion,
  type StopSuggestionMode,
  type StopSuggestionService,
} from '~/utils/stopSuggestionsCatalog'

const {
  allowCity,
  branch,
} = defineProps<{
  allowCity: boolean
  branch: Branch
}>()

const emit = defineEmits<{
  openConnections: []
}>()

const visible = defineModel<boolean>('visible', { required: true })
const stop = defineModel<Stop>({ required: true })
const { t } = useI18n()

const accessibilityOptions = [
  {
    label: 'ui.dialogs.stop_properties.accessible.undefined',
    value: 'undefined',
  },
  {
    label: 'ui.dialogs.stop_properties.accessible.yes',
    value: true,
  },
  {
    label: 'ui.dialogs.stop_properties.accessible.no',
    value: false,
  },
]

const stopStateOptions = [
  {
    label: 'ui.dialogs.stop_properties.stop_state.open',
    value: false,
  },
  {
    label: 'ui.dialogs.stop_properties.stop_state.close',
    value: true,
  },
]

const stopTypeOptions = [
  {
    label: 'ui.dialogs.stop_properties.stop_type.regular',
    value: false,
  },
  {
    label: 'ui.dialogs.stop_properties.stop_type.terminus',
    value: true,
  },
]

const breakpoints = useBreakpoints(breakpointsTailwind)
const horizontal = breakpoints.greaterOrEqual('lg')

function ensureNameStyle() {
  if (!stop.value.$stop.nameStyle) {
    stop.value.$stop.nameStyle = {
      bold: true,
      italic: false,
      underline: false,
      color: null,
      image: null,
      imageSize: 1,
      images: [],
    }
  }

  const style = stop.value.$stop.nameStyle

  if (style.image === undefined) {
    style.image = null
  }

  if (style.imageSize === undefined) {
    style.imageSize = 1
  }

  /*
   * Migration transparente des anciens projets.
   *
   * Un ancien arrêt peut encore contenir :
   *   image + imageSize
   *
   * Lors de sa première ouverture, on transforme cette image
   * en premier élément du nouveau tableau multi-images.
   *
   * On conserve malgré tout les anciens champs afin de ne pas
   * casser les autres parties du projet qui pourraient encore
   * les lire.
   */
  if (style.images === undefined) {
    style.images =
      style.image
        ? [
            {
              id: uuidv4(),
              image: style.image,
              imageSize: style.imageSize ?? 1,
            },
          ]
        : []
  }
}

const nameStyle = computed(() => {
  ensureNameStyle()

  return stop.value.$stop.nameStyle!
})

watch(
  () => stop.value.id,
  () => ensureNameStyle(),
  { immediate: true },
)

watch(
  () => stop.value.$stop.name,
  val => stop.value.$stop.name = cleanName(val),
)

watch(
  () => stop.value.$stop.placeName,
  val => stop.value.$stop.placeName = cleanName(val),
)

watch(
  () => stop.value.$stop.subtitle,
  val => stop.value.$stop.subtitle = cleanName(val),
)

const customNameColor = computed({
  get: () => nameStyle.value.color ?? '#0055a4',

  set: (value: string) => {
    nameStyle.value.color = value
  },
})

const hasCustomNameColor = computed(
  () => nameStyle.value.color != null,
)

const customImages = computed(
  () => nameStyle.value.images ?? [],
)

/*
 * null = ajout d'une nouvelle image.
 * id   = remplacement d'une image existante.
 */
const imagePickerTargetId =
  ref<string | null>(null)

function syncLegacyImageFields() {
  const firstImage =
    nameStyle.value.images?.[0]

  nameStyle.value.image =
    firstImage?.image ?? null

  nameStyle.value.imageSize =
    firstImage?.imageSize ?? 1
}

function enableCustomNameColor() {
  if (!nameStyle.value.color) {
    nameStyle.value.color = '#0055a4'
  }
}

function resetNameColor() {
  nameStyle.value.color = null
}

function openImagePicker(
  imageId: string | null = null,
) {
  imagePickerTargetId.value = imageId

  const input = document.getElementById(
    `${stop.value.id}_nameImage`,
  ) as HTMLInputElement | null

  input?.click()
}

function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    imagePickerTargetId.value = null
    return
  }

  if (!file.type.startsWith('image/')) {
    input.value = ''
    imagePickerTargetId.value = null
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      imagePickerTargetId.value = null
      return
    }

    const targetId =
      imagePickerTargetId.value

    if (targetId) {
      const target =
        nameStyle.value.images?.find(
          image => image.id === targetId,
        )

      if (target) {
        target.image = reader.result
      }
    }
    else {
      nameStyle.value.images ??= []

      nameStyle.value.images.push({
        id: uuidv4(),
        image: reader.result,
        imageSize: 1,
      })
    }

    syncLegacyImageFields()
    imagePickerTargetId.value = null
  }

  reader.readAsDataURL(file)

  input.value = ''
}

function removeImage(
  imageId: string,
) {
  nameStyle.value.images =
    (nameStyle.value.images ?? [])
      .filter(
        image => image.id !== imageId,
      )

  syncLegacyImageFields()
}

function onImageSizeInput(
  imageId: string,
  event: Event,
) {
  const input =
    event.target as HTMLInputElement

  const value =
    Number.parseFloat(input.value)

  if (!Number.isFinite(value)) {
    return
  }

  const target =
    nameStyle.value.images?.find(
      image => image.id === imageId,
    )

  if (!target) {
    return
  }

  target.imageSize = value

  syncLegacyImageFields()
}

/*
 * =========================================================
 * LIGNES DESSERVIES PAR L'ARRÊT
 * =========================================================
 *
 * "primary" représente la ligne principale du projet.
 * Les autres identifiants viennent des lignes ajoutées
 * directement à la branche.
 *
 * Un arrêt sans lineIds explicites appartient à UNE seule ligne
 * naturelle par défaut. Les autres lignes sont toujours choisies
 * explicitement par l'utilisateur.
 */
type MultiLineStopData = Stop['$stop'] & {
  lineIds?: string[]

  /*
   * Identité de la suggestion CLU appliquée à cet arrêt.
   *
   * On conserve uniquement l'identifiant de référence :
   * les données restent entièrement éditables après insertion.
   */
  stopSuggestionId?: string | null
  stopSuggestionSource?: 'CLU' | 'PERSONAL' | null

  /*
   * Référence CLU d'origine éventuelle.
   *
   * Elle reste mémorisée même si l'utilisateur enregistre ensuite
   * une version personnelle de la station. Le bouton Réinitialiser
   * peut ainsi toujours restaurer la fiche CLU d'origine.
   */
  officialStopSuggestionId?: string | null

  /*
   * Affichage optionnel d'une indication de direction
   * à l'extrémité d'un terminus.
   *
   * Ces champs sont volontairement portés par l'arrêt :
   * le rendu sera branché ensuite dans le composant visuel
   * du terminus sans toucher à la géométrie multi-lignes.
   */
  terminusArrow?: boolean
  terminusArrowText?: string | null

  /*
   * Identité de ligne utilisée après cet arrêt.
   *
   * null / undefined = aucun changement.
   * "primary" = ligne principale du projet.
   * autre id = ligne supplémentaire de la branche.
   */
  lineAfterStopId?: string | null
}

type StopBranchLine = {
  id: string
  mode: Mode
  index: LineIndex | null
  color: string
  primary: boolean
}

const project = useProject()

const stopData = computed(() =>
  stop.value.$stop as MultiLineStopData,
)

/*
 * =========================================================
 * SUGGESTIONS D'ARRÊTS CLU + CATALOGUE PERSONNEL
 * =========================================================
 *
 * Le champ reste un champ libre :
 * - aucune suggestion n'est imposée ;
 * - continuer à écrire ne déclenche aucune modification ;
 * - seule une sélection explicite applique une fiche ;
 * - "Sauvegarder" crée ou met à jour une version personnelle ;
 * - "Réinitialiser" restaure la fiche CLU d'origine lorsqu'elle existe.
 */

type LineWithStopSuggestions = Line & {
  stopSuggestionsEnabled?: boolean
}

type PersonalStopPreset = {
  connections: Stop['$stop']['connections']
  nameStyle: Stop['$stop']['nameStyle'] | null
  subtitle: string
  placeName: string
  interestPoint: boolean
  preventSubtitleOverlapping: boolean
}

type PersonalStopSuggestion =
  Omit<StopSuggestion, 'source'> & {
    source: 'PERSONAL'
    officialSuggestionId?: string | null

    /*
     * Copie riche de la station personnelle.
     *
     * Contrairement à `services`, ce preset conserve les objets CLU
     * complets : TGV / TER / OrlyBus, ornements, pictogrammes
     * personnalisés, indices personnalisés et images du nom.
     */
    preset?: PersonalStopPreset
  }

type AnyStopSuggestion =
  | StopSuggestion
  | PersonalStopSuggestion

const PERSONAL_STOP_SUGGESTIONS_STORAGE_KEY =
  'clu.personalStopSuggestions.v1'

const stopNameFocused = ref(false)
const activeStopSuggestionIndex = ref(0)

const personalStopSuggestions =
  ref<PersonalStopSuggestion[]>([])

const stopSuggestionsEnabled = computed(() =>
  (
    project.line as LineWithStopSuggestions
  ).stopSuggestionsEnabled
  ?? true,
)

function isStopSuggestionMode(
  mode: Mode | null | undefined,
): mode is StopSuggestionMode {
  return (
    mode === 'METRO'
    || mode === 'RER'
    || mode === 'TRAIN'
    || mode === 'TRAM'
  )
}

function getBuiltinLineIndex(
  index: LineIndex | null | undefined,
) {
  if (
    !index
    || typeof index !== 'object'
    || !('$builtinLineIndex' in index)
  ) {
    return null
  }

  /*
   * Le catalogue utilise toujours des indices sous forme de texte.
   * On normalise donc ici aussi pour éviter par exemple qu'un indice
   * numérique côté projet soit comparé à "6" côté catalogue.
   */
  return String(
    index.$builtinLineIndex.index,
  )
}

function isValidPersonalStopSuggestion(
  value: unknown,
): value is PersonalStopSuggestion {
  if (
    !value
    || typeof value !== 'object'
  ) {
    return false
  }

  const candidate =
    value as Partial<PersonalStopSuggestion>

  return (
    candidate.source === 'PERSONAL'
    && typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && Array.isArray(candidate.aliases)
    && Array.isArray(candidate.services)
  )
}

function loadPersonalStopSuggestions() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const raw =
      window.localStorage.getItem(
        PERSONAL_STOP_SUGGESTIONS_STORAGE_KEY,
      )

    if (!raw) {
      personalStopSuggestions.value = []
      return
    }

    const parsed =
      JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      personalStopSuggestions.value = []
      return
    }

    personalStopSuggestions.value =
      parsed.filter(
        isValidPersonalStopSuggestion,
      )
  }
  catch (error) {
    console.error(
      t('ui.dialogs.stop_properties.catalog_load_error'),
      error,
    )

    personalStopSuggestions.value = []
  }
}

function persistPersonalStopSuggestions() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      PERSONAL_STOP_SUGGESTIONS_STORAGE_KEY,
      JSON.stringify(
        personalStopSuggestions.value,
      ),
    )
  }
  catch (error) {
    console.error(
      t('ui.dialogs.stop_properties.catalog_save_error'),
      error,
    )
  }
}

onMounted(() => {
  loadPersonalStopSuggestions()
})

const currentStopSuggestionMode =
  computed<StopSuggestionMode | null>(() =>
    isStopSuggestionMode(project.line.mode)
      ? project.line.mode
      : null,
  )

const currentStopSuggestionIndex =
  computed(() =>
    getBuiltinLineIndex(project.line.index),
  )

function getPersonalSuggestionScore(
  suggestion: PersonalStopSuggestion,
  query: string,
) {
  const candidates = [
    suggestion.name,
    ...suggestion.aliases,
  ].map(
    normalizeStopSuggestionText,
  )

  let score = 0

  for (const candidate of candidates) {
    if (candidate === query) {
      score = Math.max(score, 1000)
      continue
    }

    if (candidate.startsWith(query)) {
      score = Math.max(score, 800)
      continue
    }

    const words =
      candidate.split(' ')

    if (
      words.some(
        word => word.startsWith(query),
      )
    ) {
      score = Math.max(score, 600)
      continue
    }

    if (candidate.includes(query)) {
      score = Math.max(score, 400)
    }
  }

  if (
    currentStopSuggestionMode.value
    && currentStopSuggestionIndex.value
    && suggestion.services.some(
      service =>
        service.served
        && service.mode
          === currentStopSuggestionMode.value
        && service.index
          === currentStopSuggestionIndex.value,
    )
  ) {
    score += 250
  }

  return score
}

function searchPersonalStopSuggestions(
  value: string,
  limit = 6,
) {
  const query =
    normalizeStopSuggestionText(value)

  if (query.length < 2) {
    return []
  }

  return personalStopSuggestions.value
    .map((suggestion) => {
      const score =
        getPersonalSuggestionScore(
          suggestion,
          query,
        )

      if (score <= 0) {
        return null
      }

      return {
        suggestion,
        score,
      }
    })
    .filter(
      (result): result is {
        suggestion: PersonalStopSuggestion
        score: number
      } => result !== null,
    )
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score
      }

      return a.suggestion.name.localeCompare(
        b.suggestion.name,
        'fr',
      )
    })
    .slice(0, limit)
    .map(result => result.suggestion)
}

const stopSuggestions =
  computed<AnyStopSuggestion[]>(() => {
    if (
      !stopSuggestionsEnabled.value
      || !stopNameFocused.value
    ) {
      return []
    }

    const value =
      stop.value.$stop.name ?? ''

    const personalSuggestions =
      searchPersonalStopSuggestions(
        value,
        6,
      )

    const officialSuggestions =
      searchStopSuggestions(
        value,
        {
          currentMode:
            currentStopSuggestionMode.value,
          currentIndex:
            currentStopSuggestionIndex.value,
          /*
           * On en demande un peu plus avant de fusionner avec
           * les fiches personnelles.
           */
          limit: 12,
        },
      )

    const merged: AnyStopSuggestion[] = []
    const seen = new Set<string>()

    /*
     * Les versions personnelles passent volontairement avant
     * les versions CLU lorsqu'elles correspondent à la saisie.
     * La fiche officielle reste néanmoins disponible juste après.
     */
    for (
      const suggestion
      of [
        ...personalSuggestions,
        ...officialSuggestions,
      ]
    ) {
      const key =
        [
          suggestion.source,
          suggestion.id,
          normalizeStopSuggestionText(
            suggestion.name,
          ),
        ].join(':')

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      merged.push(suggestion)

      if (merged.length >= 6) {
        break
      }
    }

    return merged
  })

const showStopSuggestions = computed(
  () => stopSuggestions.value.length > 0,
)

watch(
  stopSuggestions,
  (suggestions) => {
    if (suggestions.length === 0) {
      activeStopSuggestionIndex.value = 0
      return
    }

    if (
      activeStopSuggestionIndex.value
      >= suggestions.length
    ) {
      activeStopSuggestionIndex.value = 0
    }
  },
)

function onStopNameFocus() {
  stopNameFocused.value = true
  activeStopSuggestionIndex.value = 0
}

function onStopNameInput() {
  stopNameFocused.value = true
  activeStopSuggestionIndex.value = 0
}

function onStopNameBlur() {
  /*
   * Petit délai pour laisser un clic sur une suggestion
   * s'exécuter avant de masquer la liste.
   */
  window.setTimeout(() => {
    stopNameFocused.value = false
  }, 120)
}

function isCurrentSuggestionService(
  service: StopSuggestionService,
) {
  /*
   * 1. Cas normal : la ligne principale actuellement éditée.
   *
   * Exemple :
   * - projet RER A + suggestion Nation -> RER A est retiré ;
   * - projet Métro 6 + suggestion Nation -> Métro 6 est retiré.
   */
  if (
    service.mode
      === currentStopSuggestionMode.value
    && service.index
      === currentStopSuggestionIndex.value
  ) {
    return true
  }

  /*
   * 2. Cas multi-lignes :
   *
   * Un arrêt peut appartenir à plusieurs lignes dans CLU.
   * Toute ligne réellement portée par cet arrêt doit également
   * être considérée comme sa propre ligne et non comme une
   * correspondance.
   */
  return availableBranchLines.value.some(
    (branchLine) => {
      if (!isStopOnLine(branchLine.id)) {
        return false
      }

      const branchLineIndex =
        getBuiltinLineIndex(
          branchLine.index,
        )

      return (
        branchLine.mode === service.mode
        && branchLineIndex === service.index
      )
    },
  )
}

function stopSuggestionServiceLabel(
  service: StopSuggestionService,
) {
  const prefix = {
    METRO: t('data.mode.metro'),
    RER: t('data.mode.rer'),
    TRAIN: t('data.mode.transilien'),
    TRAM: t('data.mode.tram'),
  }[service.mode]

  return `${prefix} ${service.index}`
}

function stopSuggestionSourceLabel(
  suggestion: AnyStopSuggestion,
) {
  return suggestion.source === 'PERSONAL'
    ? t('ui.dialogs.stop_properties.personal_source')
    : 'CLU'
}

function cloneStopCatalogValue<T>(
  value: T,
): T {
  /*
   * Les données d'un arrêt CLU sont sérialisables en JSON.
   *
   * Cette copie profonde évite qu'une fiche personnelle stockée
   * en mémoire partage des références Vue avec l'arrêt actuellement
   * édité.
   */
  return JSON.parse(
    JSON.stringify(value),
  ) as T
}

function buildCurrentPersonalStopPreset():
  PersonalStopPreset {
  ensureNameStyle()

  return {
    connections:
      cloneStopCatalogValue(
        stop.value.$stop.connections ?? [],
      ) as Stop['$stop']['connections'],

    nameStyle:
      cloneStopCatalogValue(
        stop.value.$stop.nameStyle ?? null,
      ),

    subtitle:
      stop.value.$stop.subtitle ?? '',

    placeName:
      stop.value.$stop.placeName ?? '',

    interestPoint:
      stop.value.$stop.interestPoint === true,

    preventSubtitleOverlapping:
      stop.value.$stop
        .preventSubtitleOverlapping
      !== false,
  }
}

function preparePersonalConnections(
  connections:
    Stop['$stop']['connections'],
) {
  const clonedConnections =
    cloneStopCatalogValue(
      connections ?? [],
    )

  /*
   * Une fiche personnelle est réutilisable sur n'importe quelle
   * ligne. On retire donc, au moment de l'appliquer, les lignes qui
   * correspondent à la ligne actuellement portée par l'arrêt.
   *
   * Tous les autres champs de chaque correspondance restent intacts :
   * ornements, pictogrammes personnalisés, transfert, customConnections,
   * etc.
   */
  return clonedConnections
    .map((connection) => {
      if (!('$modeConnection' in connection)) {
        return connection
      }

      const modeConnection =
        connection.$modeConnection

      if (
        !isStopSuggestionMode(
          modeConnection.mode,
        )
      ) {
        return connection
      }

      const elements =
        (
          modeConnection.elements
          ?? []
        ).filter((element) => {
          if (
            !('$modeConnectionElement' in element)
          ) {
            return true
          }

          const modeElement =
            element.$modeConnectionElement

          const index =
            getBuiltinLineIndex(
              modeElement.lineIndex,
            )

          if (!index) {
            /*
             * Un indice personnalisé ne doit surtout pas être perdu.
             */
            return true
          }

          return !isCurrentSuggestionService({
            mode: modeConnection.mode,
            index,
            walk:
              modeConnection.walk === true
              || modeElement.walk === true,
            served: false,
          })
        })

      if (elements.length === 0) {
        return null
      }

      modeConnection.elements =
        elements

      return connection
    })
    .filter(
      (
        connection,
      ): connection is NonNullable<
        typeof connection
      > => connection !== null,
    ) as Stop['$stop']['connections']
}

function applyPersonalStopPreset(
  preset: PersonalStopPreset,
) {
  stop.value.$stop.connections =
    preparePersonalConnections(
      preset.connections,
    )

  stop.value.$stop.subtitle =
    cleanName(preset.subtitle ?? '')

  stop.value.$stop.placeName =
    cleanName(preset.placeName ?? '')

  stop.value.$stop.interestPoint =
    preset.interestPoint === true

  stop.value.$stop.preventSubtitleOverlapping =
    preset.preventSubtitleOverlapping
    !== false

  if (preset.nameStyle) {
    stop.value.$stop.nameStyle =
      cloneStopCatalogValue(
        preset.nameStyle,
      )

    ensureNameStyle()
  }
}

function buildSuggestedModeConnections(
  suggestion: AnyStopSuggestion,
) {
  /*
   * La ligne actuellement éditée n'est pas une correspondance
   * avec elle-même.
   */
  const services =
    suggestion.services.filter(
      service =>
        !isCurrentSuggestionService(service),
    )

  const byMode =
    new Map<
      StopSuggestionMode,
      StopSuggestionService[]
    >()

  for (const service of services) {
    const modeServices =
      byMode.get(service.mode) ?? []

    modeServices.push(service)
    byMode.set(service.mode, modeServices)
  }

  return Array.from(
    byMode.entries(),
  ).map(([mode, modeServices]) => {
    /*
     * Quand toutes les lignes du groupe sont à pied,
     * le mode complet porte l'information "walk".
     *
     * Dans un groupe mixte, chaque ligne conserve son propre
     * indicateur.
     */
    const groupWalk =
      modeServices.length > 0
      && modeServices.every(
        service => service.walk,
      )

    return {
      id: uuidv4(),
      $modeConnection: {
        mode,
        elements:
          modeServices.map(service => ({
            id: uuidv4(),
            $modeConnectionElement: {
              lineIndex: {
                mode,
                $builtinLineIndex: {
                  index: service.index,
                },
              },
              walk:
                groupWalk
                  ? false
                  : service.walk,
              ornament: null,
            },
          })),
        walk: groupWalk,
      },
    }
  })
}

function applyStopSuggestion(
  suggestion: AnyStopSuggestion,
) {
  stop.value.$stop.name =
    suggestion.name

  /*
   * Un arrêt ancien peut être implicitement desservi par plusieurs
   * lignes directes de la Branch (ex. Nation sur M1 + M2) sans avoir
   * encore de lineIds persistés.
   *
   * Lorsqu'une suggestion est explicitement appliquée, on peut
   * matérialiser ce choix sans aucun risque pour Sortable. Cela force
   * immédiatement le rendu multi-ligne et évite de devoir décocher /
   * recocher la ligne secondaire pour obtenir le marqueur partagé.
   */
  if (
    !stopData.value.lineIds
    || stopData.value.lineIds.length === 0
  ) {
    const implicitIds =
      implicitStopLineIds()

    stopData.value.lineIds =
      [...implicitIds]

    implicitIds.forEach(
      lineId =>
        syncPhysicalLineWithStopChoice(
          lineId,
          true,
        ),
    )
  }

  /*
   * Une suggestion personnelle récente possède un preset complet.
   *
   * C'est lui qui permet de restaurer fidèlement :
   * - TGV / TER / bus de service / gare ;
   * - ornements ;
   * - pictogrammes et indices personnalisés ;
   * - images et style du nom.
   *
   * Les anciennes fiches personnelles déjà présentes dans le
   * localStorage, qui ne possèdent pas encore de preset, gardent
   * l'ancien comportement simplifié pour rester compatibles.
   */
  if (
    suggestion.source === 'PERSONAL'
    && suggestion.preset
  ) {
    applyPersonalStopPreset(
      suggestion.preset,
    )
  }
  else {
    /*
     * Catalogue CLU intégré :
     * on remplace les correspondances de lignes connues tout en
     * conservant les correspondances de service déjà présentes
     * sur l'arrêt actuel.
     */
    const preservedConnections =
      (
        stop.value.$stop.connections
        ?? []
      ).filter(
        connection =>
          !('$modeConnection' in connection),
      )

    const suggestedConnections =
      buildSuggestedModeConnections(
        suggestion,
      )

    stop.value.$stop.connections = [
      ...preservedConnections,
      ...suggestedConnections,
    ] as Stop['$stop']['connections']
  }

  stopData.value.stopSuggestionId =
    suggestion.id

  stopData.value.stopSuggestionSource =
    suggestion.source

  if (suggestion.source === 'CLU') {
    stopData.value.officialStopSuggestionId =
      suggestion.id
  }
  else {
    stopData.value.officialStopSuggestionId =
      suggestion.officialSuggestionId
      ?? null
  }

  activeStopSuggestionIndex.value = 0
  stopNameFocused.value = false
}

function onStopNameKeydown(
  event: KeyboardEvent,
) {
  if (!showStopSuggestions.value) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()

    activeStopSuggestionIndex.value =
      (
        activeStopSuggestionIndex.value + 1
      )
      % stopSuggestions.value.length

    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()

    activeStopSuggestionIndex.value =
      (
        activeStopSuggestionIndex.value
        - 1
        + stopSuggestions.value.length
      )
      % stopSuggestions.value.length

    return
  }

  if (
    event.key === 'Enter'
    && !event.shiftKey
  ) {
    const suggestion =
      stopSuggestions.value[
        activeStopSuggestionIndex.value
      ]

    if (!suggestion) {
      return
    }

    event.preventDefault()
    applyStopSuggestion(suggestion)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    stopNameFocused.value = false
  }
}

function upsertSuggestionService(
  services:
    Map<string, StopSuggestionService>,
  service: StopSuggestionService,
) {
  const key =
    `${service.mode}:${service.index}`

  const current =
    services.get(key)

  if (!current) {
    services.set(
      key,
      {
        ...service,
      },
    )

    return
  }

  /*
   * Une desserte réelle l'emporte toujours sur une simple
   * correspondance portant le même indice.
   */
  if (
    service.served
    && !current.served
  ) {
    services.set(
      key,
      {
        ...service,
        walk: false,
      },
    )

    return
  }

  if (current.served) {
    current.walk = false
    return
  }

  /*
   * Si au moins une occurrence est directe, la correspondance
   * n'est pas considérée comme une marche obligatoire.
   */
  current.walk =
    current.walk && service.walk
}

function collectCurrentStopSuggestionServices() {
  const services =
    new Map<
      string,
      StopSuggestionService
    >()

  /*
   * Les lignes réellement desservies par l'arrêt font partie
   * de la fiche personnelle avec served = true.
   */
  for (
    const branchLine
    of availableBranchLines.value
  ) {
    if (!isStopOnLine(branchLine.id)) {
      continue
    }

    if (
      !isStopSuggestionMode(
        branchLine.mode,
      )
    ) {
      continue
    }

    const index =
      getBuiltinLineIndex(
        branchLine.index,
      )

    if (!index) {
      continue
    }

    upsertSuggestionService(
      services,
      {
        mode: branchLine.mode,
        index,
        walk: false,
        served: true,
      },
    )
  }

  /*
   * Puis on ajoute les correspondances actuellement configurées
   * dans l'arrêt.
   */
  for (
    const connection
    of stop.value.$stop.connections ?? []
  ) {
    if (!('$modeConnection' in connection)) {
      continue
    }

    const modeConnection =
      connection.$modeConnection

    if (
      !isStopSuggestionMode(
        modeConnection.mode,
      )
    ) {
      continue
    }

    const groupWalk =
      modeConnection.walk === true

    for (
      const element
      of modeConnection.elements ?? []
    ) {
      if (
        !('$modeConnectionElement' in element)
      ) {
        continue
      }

      const modeElement =
        element.$modeConnectionElement

      const index =
        getBuiltinLineIndex(
          modeElement.lineIndex,
        )

      if (!index) {
        continue
      }

      upsertSuggestionService(
        services,
        {
          mode: modeConnection.mode,
          index,
          walk:
            groupWalk
            || modeElement.walk === true,
          served: false,
        },
      )
    }
  }

  const modeOrder:
    Record<StopSuggestionMode, number> = {
      METRO: 0,
      RER: 1,
      TRAIN: 2,
      TRAM: 3,
    }

  return Array.from(
    services.values(),
  ).sort((a, b) => {
    const modeDifference =
      modeOrder[a.mode]
      - modeOrder[b.mode]

    if (modeDifference !== 0) {
      return modeDifference
    }

    return a.index.localeCompare(
      b.index,
      'fr',
      {
        numeric: true,
      },
    )
  })
}

const canSaveCurrentStopSuggestion =
  computed(
    () =>
      normalizeStopSuggestionText(
        stop.value.$stop.name ?? '',
      ).length > 0,
  )

function createPersonalStopSuggestionId(
  name: string,
) {
  const normalized =
    normalizeStopSuggestionText(name)

  const slug =
    normalized
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  return [
    'personal',
    slug || 'arret',
    uuidv4().slice(0, 8),
  ].join('-')
}

function saveCurrentStopToPersonalCatalog() {
  const name =
    cleanName(
      stop.value.$stop.name ?? '',
    ).trim()

  if (!name) {
    return
  }

  const normalizedName =
    normalizeStopSuggestionText(name)

  let existing:
    PersonalStopSuggestion
    | undefined

  if (
    stopData.value.stopSuggestionSource
      === 'PERSONAL'
    && stopData.value.stopSuggestionId
  ) {
    existing =
      personalStopSuggestions.value.find(
        suggestion =>
          suggestion.id
          === stopData.value.stopSuggestionId,
      )
  }

  if (!existing) {
    existing =
      personalStopSuggestions.value.find(
        suggestion =>
          normalizeStopSuggestionText(
            suggestion.name,
          )
          === normalizedName,
      )
  }

  const officialSuggestionId =
    stopData.value.officialStopSuggestionId
    ?? (
      stopData.value.stopSuggestionSource
        === 'CLU'
        ? stopData.value.stopSuggestionId
        : null
    )
    ?? existing?.officialSuggestionId
    ?? null

  const aliases =
    new Set<string>(
      existing?.aliases ?? [],
    )

  if (
    existing
    && normalizeStopSuggestionText(
      existing.name,
    ) !== normalizedName
  ) {
    aliases.add(existing.name)
  }

  const officialSuggestion =
    officialSuggestionId
      ? getStopSuggestionById(
          officialSuggestionId,
        )
      : null

  if (
    officialSuggestion
    && normalizeStopSuggestionText(
      officialSuggestion.name,
    ) !== normalizedName
  ) {
    aliases.add(
      officialSuggestion.name,
    )
  }

  aliases.delete(name)

  const personalSuggestion:
    PersonalStopSuggestion = {
      id:
        existing?.id
        ?? createPersonalStopSuggestionId(
          name,
        ),
      name,
      aliases:
        Array.from(aliases)
          .filter(
            alias =>
              normalizeStopSuggestionText(
                alias,
              ) !== normalizedName,
          )
          .sort(
            (a, b) =>
              a.localeCompare(
                b,
                'fr',
              ),
          ),
      services:
        collectCurrentStopSuggestionServices(),

      /*
       * Le preset complet est la source de vérité pour une station
       * personnelle. `services` reste utilisé pour classer et afficher
       * rapidement les suggestions.
       */
      preset:
        buildCurrentPersonalStopPreset(),

      source: 'PERSONAL',
      officialSuggestionId,
    }

  if (existing) {
    personalStopSuggestions.value =
      personalStopSuggestions.value.map(
        suggestion =>
          suggestion.id === existing!.id
            ? personalSuggestion
            : suggestion,
      )
  }
  else {
    personalStopSuggestions.value = [
      ...personalStopSuggestions.value,
      personalSuggestion,
    ]
  }

  personalStopSuggestions.value =
    [...personalStopSuggestions.value]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'fr',
          ),
      )

  persistPersonalStopSuggestions()

  stopData.value.stopSuggestionId =
    personalSuggestion.id

  stopData.value.stopSuggestionSource =
    'PERSONAL'

  stopData.value.officialStopSuggestionId =
    officialSuggestionId

  stopNameFocused.value = false
}

const currentPersonalStopSuggestion =
  computed(() => {
    if (
      stopData.value.stopSuggestionSource
        !== 'PERSONAL'
      || !stopData.value.stopSuggestionId
    ) {
      return null
    }

    return (
      personalStopSuggestions.value.find(
        suggestion =>
          suggestion.id
          === stopData.value.stopSuggestionId,
      )
      ?? null
    )
  })

const canDeleteCurrentPersonalStopSuggestion =
  computed(
    () =>
      currentPersonalStopSuggestion.value
      !== null,
  )

function deleteCurrentPersonalStopSuggestion() {
  const suggestion =
    currentPersonalStopSuggestion.value

  if (!suggestion) {
    return
  }

  const accepted =
    window.confirm(
      t(
        'ui.dialogs.stop_properties.delete_catalog_confirmation',
        { name: suggestion.name },
      ),
    )

  if (!accepted) {
    return
  }

  personalStopSuggestions.value =
    personalStopSuggestions.value.filter(
      personalSuggestion =>
        personalSuggestion.id
        !== suggestion.id,
    )

  persistPersonalStopSuggestions()

  /*
   * On ne modifie pas l'arrêt visible sur le plan :
   * seule sa fiche enregistrée est supprimée.
   *
   * Une éventuelle origine CLU est conservée afin que le bouton
   * Réinitialiser continue de fonctionner.
   */
  stopData.value.stopSuggestionId = null
  stopData.value.stopSuggestionSource = null

  if (
    !suggestion.officialSuggestionId
  ) {
    stopData.value.officialStopSuggestionId =
      null
  }

  stopNameFocused.value = false
}

const officialStopSuggestion =
  computed(() => {
    const officialId =
      stopData.value.officialStopSuggestionId
      ?? (
        stopData.value.stopSuggestionSource
          === 'CLU'
          ? stopData.value.stopSuggestionId
          : null
      )

    if (!officialId) {
      return null
    }

    return getStopSuggestionById(
      officialId,
    )
  })

const canResetOfficialStopSuggestion =
  computed(
    () =>
      officialStopSuggestion.value !== null,
  )

function resetOfficialStopSuggestion() {
  const suggestion =
    officialStopSuggestion.value

  if (!suggestion) {
    return
  }

  applyStopSuggestion(suggestion)
}

const currentStopSuggestionSourceLabel =
  computed(() => {
    if (
      stopData.value.stopSuggestionSource
      === 'PERSONAL'
    ) {
      return t('ui.dialogs.stop_properties.personal_source')
    }

    if (
      stopData.value.stopSuggestionSource
      === 'CLU'
    ) {
      return 'CLU'
    }

    return null
  })

const terminusArrowEnabled = computed({
  get: () =>
    stopData.value.terminusArrow === true,

  set: (enabled: boolean) => {
    stopData.value.terminusArrow = enabled

    if (
      enabled
      && (
        !stopData.value.terminusArrowText
        || stopData.value.terminusArrowText.trim().length === 0
      )
    ) {
      stopData.value.terminusArrowText = `${t('ui.map_editor.towards')} `
    }
  },
})

const terminusArrowText = computed({
  get: () =>
    stopData.value.terminusArrowText ?? '',

  set: (value: string) => {
    stopData.value.terminusArrowText =
      cleanName(value)
  },
})


type BranchWithPassthrough =
  Branch['$branch'] & {
    passthroughLineIds?: string[]
  }

interface ParentForkContext {
  fork: Fork
  sourceBranch: Branch
  outputIndex: 0 | 1
}

/*
 * Retrouve la Fork qui possède directement la Branch courante,
 * uniquement depuis project.line.topology.
 *
 * Aucun DOM, aucun nextTick, aucun F5.
 */
function findParentForkContext(
  targetBranchId: string,
): ParentForkContext | null {
  type LinkedForkData =
    Fork['$fork'] & {
      parallelBranchesId?: string
    }

  type LinkedParallelData =
    ParallelBranches['$parallelBranches'] & {
      forkId?: string
    }

  function sourceBranchForFork(
    elements: LineElement[],
    forkIndex: number,
    fork: Fork,
  ): Branch | null {
    const step =
      fork.$fork.toward === 'LEFT'
        ? 1
        : -1

    for (
      let index = forkIndex + step;
      index >= 0
      && index < elements.length;
      index += step
    ) {
      const candidate =
        elements[index]

      if ('$branch' in candidate) {
        return candidate
      }

      if ('$parallelBranches' in candidate) {
        continue
      }

      if ('$fork' in candidate) {
        break
      }
    }

    return null
  }

  function scanSection(
    currentSection: LineSection,
    ownerFork: Fork | null = null,
    ownerForkSourceBranch: Branch | null = null,
    ownerOutputIndex: 0 | 1 | null = null,
  ): ParentForkContext | null {
    const sectionElements =
      currentSection.$lineSection.elements
      ?? []

    for (
      let elementIndex = 0;
      elementIndex < sectionElements.length;
      elementIndex++
    ) {
      const element =
        sectionElements[elementIndex]

      if ('$branch' in element) {
        if (
          element.id === targetBranchId
          && ownerFork
          && ownerForkSourceBranch
          && ownerOutputIndex !== null
        ) {
          return {
            fork:
              ownerFork,

            sourceBranch:
              ownerForkSourceBranch,

            outputIndex:
              ownerOutputIndex,
          }
        }

        continue
      }

      if ('$parallelBranches' in element) {
        const linkedForkId =
          (
            element.$parallelBranches as LinkedParallelData
          ).forkId

        const linkedForkIndex =
          linkedForkId
            ? sectionElements.findIndex(
                candidate =>
                  '$fork' in candidate
                  && candidate.id
                    === linkedForkId,
              )
            : -1

        const linkedFork =
          linkedForkIndex >= 0
            ? sectionElements[
                linkedForkIndex
              ]
            : null

        const actualFork =
          linkedFork
          && '$fork' in linkedFork
            ? linkedFork
            : ownerFork

        const actualSourceBranch =
          actualFork
          && '$fork' in actualFork
          && linkedForkIndex >= 0
            ? sourceBranchForFork(
                sectionElements,
                linkedForkIndex,
                actualFork,
              )
            : ownerForkSourceBranch

        const childSections =
          element.$parallelBranches.sections
          ?? []

        for (
          let index = 0;
          index < childSections.length;
          index++
        ) {
          const found =
            scanSection(
              childSections[index],
              actualFork,
              actualSourceBranch,
              linkedForkIndex >= 0
                ? index as 0 | 1
                : ownerOutputIndex,
            )

          if (found) {
            return found
          }
        }

        continue
      }

      if ('$fork' in element) {
        const linkedPairId =
          (
            element.$fork as LinkedForkData
          ).parallelBranchesId

        /*
         * Une Fork appairée possède ses sorties dans le vrai
         * ParallelBranches sibling, qui sera parcouru séparément.
         */
        if (linkedPairId) {
          continue
        }

        /*
         * Compatibilité avec les anciens projets encore autonomes.
         */
        const sourceBranch =
          sourceBranchForFork(
            sectionElements,
            elementIndex,
            element,
          )

        if (!sourceBranch) {
          continue
        }

        const childSections =
          element.$fork.sections
          ?? []

        for (
          let index = 0;
          index < childSections.length;
          index++
        ) {
          const found =
            scanSection(
              childSections[index],
              element,
              sourceBranch,
              index as 0 | 1,
            )

          if (found) {
            return found
          }
        }
      }
    }

    return null
  }

  for (
    const rootSection
    of project.line.topology ?? []
  ) {
    const found =
      scanSection(
        rootSection,
      )

    if (found) {
      return found
    }
  }

  return null
}


/*
 * Ligne par défaut RÉELLE de la Branch courante.
 *
 * Priorité :
 * 1. si cette Branch est une sortie directe de Fork, la ligne ciblée
 *    par cette Fork est la ligne naturelle du Stop ;
 * 2. sinon, on reprend la règle passthrough de Branch ;
 * 3. fallback historique = primary.
 *
 * Cette logique ne modifie aucune Fork et ne crée aucun rail.
 */
const defaultStopLineId =
  computed(() => {
    const parentFork =
      findParentForkContext(
        branch.id,
      )

    if (parentFork) {
      const targetLineId =
        parentFork.fork.$fork.lineId
        || 'primary'

      return targetLineId
    }

    const branchData =
      branch.$branch as BranchWithPassthrough

    const passthroughIds =
      new Set(
        branchData.passthroughLineIds
        ?? [],
      )

    if (
      branch.$branch.primaryLineVisible
      !== false
      && !passthroughIds.has(
        'primary',
      )
    ) {
      return 'primary'
    }

    const directAdditional =
      (
        branch.$branch.additionalLines
        ?? []
      ).find(
        line =>
          !passthroughIds.has(
            line.id,
          ),
      )

    return (
      directAdditional?.id
      ?? 'primary'
    )
  })

/*
 * IMPORTANT :
 * on ne persiste pas automatiquement lineIds au montage du dialogue.
 *
 * Le dialogue existe déjà dans l'arbre de chaque Stop, même lorsqu'il
 * n'est pas ouvert. Un write synchrone ici peut donc arriver pendant
 * le drag d'un nouveau Stop et perturber Sortable.
 *
 * isStopOnLine() utilise defaultStopLineId comme fallback visuel/logique.
 * lineIds n'est écrit que lorsque l'utilisateur change réellement une
 * case D/S.
 */

function lineBelongsToThisForkOutput(
  context: ParentForkContext,
  lineId: string,
) {
  const targetLineId =
    context.fork.$fork.lineId
    || 'primary'

  /*
   * La ligne ciblée bifurque dans les deux sorties.
   */
  if (lineId === targetLineId) {
    return true
  }

  const inputIds = [
    ...(
      context.sourceBranch.$branch.primaryLineVisible
      !== false
        ? ['primary']
        : []
    ),

    ...(
      context.sourceBranch.$branch.additionalLines
      ?? []
    ).map(
      line => line.id,
    ),
  ]

  const targetRank =
    inputIds.indexOf(
      targetLineId,
    )

  const lineRank =
    inputIds.indexOf(
      lineId,
    )

  if (
    targetRank < 0
    || lineRank < 0
  ) {
    return false
  }

  const topOutputIndex: 0 | 1 =
    context.fork.$fork.linksOffset[0]
      >= context.fork.$fork.linksOffset[1]
      ? 0
      : 1

  const bottomOutputIndex: 0 | 1 =
    topOutputIndex === 0
      ? 1
      : 0

  const destination =
    lineRank < targetRank
      ? topOutputIndex
      : bottomOutputIndex

  return (
    destination
    === context.outputIndex
  )
}

function branchStillUsesLine(
  lineId: string,
) {
  return (
    branch.$branch.elements ?? []
  ).some((element) => {
    if (!('$stop' in element)) {
      return false
    }

    const data =
      element.$stop as MultiLineStopData

    const ids =
      data.lineIds

    if (
      !ids
      || ids.length === 0
    ) {
      return (
        lineId
        === defaultStopLineId.value
      )
    }

    return ids.includes(lineId)
  })
}

/*
 * C'est volontairement déclenché DIRECTEMENT par la case D/S
 * du dialogue.
 *
 * Quand l'utilisateur coche S sur TEST :
 * - on sait déjà quelle Branch est éditée ;
 * - on sait déjà quelle Fork la possède ;
 * - on ajoute immédiatement S à CETTE sortie si S doit y
 *   continuer tout droit.
 *
 * On ne dépend donc plus d'un watcher de Fork, d'un remount,
 * de VueDraggable ou d'un F5.
 */
function syncPhysicalLineWithStopChoice(
  lineId: string,
  enabled: boolean,
) {
  /*
   * =========================================================
   * MODÈLE SIMPLE
   * =========================================================
   *
   * Une Branch est un conteneur libre.
   *
   * Le Stop choisit ses lignes dans ses propriétés et CE choix
   * suffit à rendre la ligne disponible physiquement dans la
   * Branch courante.
   *
   * Aucune Fork n'a le droit de refuser ce choix.
   * Il n'y a donc plus de :
   *
   *   lineBelongsToThisForkOutput(...)
   *
   * Ici :
   * - cocher D rend D disponible ;
   * - cocher S rend S disponible ;
   * - décocher la dernière utilisation masque de nouveau seulement
   *   la ligne que ce mécanisme avait ajoutée automatiquement.
   */
  const branchData =
    branch.$branch as BranchWithPassthrough

  const passthroughIds =
    new Set(
      branchData.passthroughLineIds
      ?? [],
    )

  if (enabled) {
    if (lineId === 'primary') {
      const wasAlreadyAvailable =
        branch.$branch.primaryLineVisible
        !== false

      branch.$branch.primaryLineVisible =
        true

      /*
       * Si D n'était pas présent dans cette Branch, on le marque
       * comme ligne ajoutée à la demande du Stop.
       */
      if (!wasAlreadyAvailable) {
        passthroughIds.add('primary')
      }
    }
    else {
      const alreadyPresent =
        (
          branch.$branch.additionalLines
          ?? []
        ).some(
          line =>
            line.id === lineId,
        )

      if (!alreadyPresent) {
        /*
         * Le catalogue est global au projet : le Stop peut donc
         * choisir S même si la Branch a été créée initialement
         * comme une sortie D.
         */
        const selectedLine =
          availableBranchLines.value.find(
            line =>
              line.id === lineId,
          )

        if (!selectedLine) {
          return
        }

        branch.$branch.additionalLines = [
          ...(
            branch.$branch.additionalLines
            ?? []
          ),
          {
            id:
              selectedLine.id,
            mode:
              selectedLine.mode,
            index:
              selectedLine.index,
            color:
              selectedLine.color,
          },
        ]

        /*
         * Une ligne ajoutée automatiquement reste invisible
         * lorsque plus aucun Stop de cette Branch ne l'utilise.
         */
        passthroughIds.add(lineId)
      }
    }
  }
  else if (
    passthroughIds.has(lineId)
    && !branchStillUsesLine(lineId)
  ) {
    /*
     * Dernier Stop retiré de cette ligne :
     * on remet la Branch dans son état précédent.
     */
    passthroughIds.delete(lineId)

    if (lineId === 'primary') {
      branch.$branch.primaryLineVisible =
        false
    }
    else {
      branch.$branch.additionalLines =
        (
          branch.$branch.additionalLines
          ?? []
        ).filter(
          line =>
            line.id !== lineId,
        )
    }
  }

  branchData.passthroughLineIds =
    Array.from(
      passthroughIds,
    )
}


/*
 * Catalogue des lignes connues dans le projet.
 *
 * Le Stop est maintenant la commande simple :
 * cocher une ligne ici la rend immédiatement disponible dans
 * sa Branch courante.
 *
 * La Fork garde uniquement son rôle de bifurcation géométrique.
 */
const availableBranchLines =
  computed<StopBranchLine[]>(() => {
    const lines: StopBranchLine[] = []
    const seen = new Set<string>()

    if (project.line.mode) {
      lines.push({
        id: 'primary',
        mode: project.line.mode,
        index: project.line.index,
        color:
          project.line.color
          || '#000000',
        primary: true,
      })

      seen.add('primary')
    }

    function scanSection(
      section: LineSection,
    ) {
      for (
        const element
        of section.$lineSection.elements ?? []
      ) {
        if ('$branch' in element) {
          for (
            const line
            of element.$branch.additionalLines ?? []
          ) {
            if (seen.has(line.id)) {
              continue
            }

            seen.add(line.id)

            lines.push({
              id: line.id,
              mode: line.mode,
              index: line.index,
              color:
                line.color
                || '#000000',
              primary: false,
            })
          }
        }

        if ('$parallelBranches' in element) {
          for (
            const child
            of element.$parallelBranches.sections ?? []
          ) {
            scanSection(child)
          }
        }

        if ('$fork' in element) {
          for (
            const child
            of element.$fork.sections ?? []
          ) {
            scanSection(child)
          }
        }
      }
    }

    for (
      const section
      of project.line.topology ?? []
    ) {
      scanSection(section)
    }

    return lines
  })

function implicitStopLineIds() {
  /*
   * Un Stop sans lineIds explicites ne devient PLUS automatiquement
   * un arrêt commun à toutes les lignes du corridor.
   *
   * Règle :
   * - corridor M1 + M2 => une seule ligne naturelle par défaut ;
   * - sortie de Fork M2 => M2 reste la ligne naturelle ;
   * - l'utilisateur coche ensuite explicitement les autres lignes
   *   s'il veut un arrêt commun.
   *
   * Cela évite aussi le faux état "deux cases cochées" alors qu'aucun
   * lineIds n'est encore persisté, qui obligeait à décocher/recocher
   * pour déclencher le vrai rendu multi-ligne.
   */
  return [
    defaultStopLineId.value,
  ]
}

function isStopOnLine(
  lineId: string,
) {
  const stored =
    stopData.value.lineIds

  if (
    !stored
    || stored.length === 0
  ) {
    return implicitStopLineIds()
      .includes(lineId)
  }

  return stored.includes(lineId)
}

function setStopOnLine(
  lineId: string,
  enabled: boolean,
) {
  const current =
    availableBranchLines.value
      .filter(
        line =>
          isStopOnLine(line.id),
      )
      .map(line => line.id)

  if (enabled) {
    if (!current.includes(lineId)) {
      current.push(lineId)
    }
  }
  else {
    const index =
      current.indexOf(lineId)

    /*
     * Un arrêt doit toujours appartenir
     * à au moins une ligne.
     */
    if (
      index !== -1
      && current.length > 1
    ) {
      current.splice(index, 1)
    }
  }

  stopData.value.lineIds =
    current

  /*
   * Pas de watcher : la Branch physique est synchronisée au même
   * instant que la case du dialogue.
   */
  syncPhysicalLineWithStopChoice(
    lineId,
    enabled,
  )
}

function onLineMembershipChange(
  lineId: string,
  value: boolean | undefined,
) {
  setStopOnLine(
    lineId,
    value === true,
  )
}

const selectedLineCount =
  computed(() =>
    availableBranchLines.value.filter(
      line =>
        isStopOnLine(line.id),
    ).length,
  )

/*
 * =========================================================
 * CHANGER DE LIGNE SUR CET ARRÊT
 * =========================================================
 *
 * La nouvelle identité est locale à l'arrêt : elle recolore
 * uniquement la zone de tracé rattachée à cet arrêt.
 * L'arrêt suivant conserve sa propre identité tant qu'il n'est
 * pas configuré explicitement à son tour.
 */
type MultiLineStopDataWithTransition = MultiLineStopData & {
  lineAfterStopMode?: Mode | null
  lineAfterStopIndex?: LineIndex | null
  lineAfterStopColor?: string | null
}

const transitionStopData = computed(() =>
  stop.value.$stop as MultiLineStopDataWithTransition,
)

const changesLineAfterStop = computed({
  get: () =>
    transitionStopData.value.lineAfterStopMode != null,

  set: (enabled: boolean) => {
    if (!enabled) {
      transitionStopData.value.lineAfterStopId = null
      transitionStopData.value.lineAfterStopMode = null
      transitionStopData.value.lineAfterStopIndex = null
      transitionStopData.value.lineAfterStopColor = null
      return
    }

    transitionStopData.value.lineAfterStopId = null
    transitionStopData.value.lineAfterStopMode =
      project.line.mode ?? 'RER'
    transitionStopData.value.lineAfterStopIndex = null
    transitionStopData.value.lineAfterStopColor =
      project.line.color ?? '#000000'
  },
})

const lineAfterStopMode = computed<Mode | null>({
  get: () =>
    transitionStopData.value.lineAfterStopMode
    ?? null,

  set: (mode) => {
    if (!mode) {
      return
    }

    if (
      transitionStopData.value.lineAfterStopMode
      === mode
    ) {
      return
    }

    transitionStopData.value.lineAfterStopMode = mode
    transitionStopData.value.lineAfterStopIndex = null
    transitionStopData.value.lineAfterStopColor = '#000000'
    transitionStopData.value.lineAfterStopId = null
  },
})

const lineAfterStopIndex = computed<LineIndex | null>({
  get: () =>
    transitionStopData.value.lineAfterStopIndex
    ?? null,

  set: (index) => {
    transitionStopData.value.lineAfterStopIndex = index
    transitionStopData.value.lineAfterStopId = null
  },
})

function updateLineAfterStopMode(
  mode: Mode | null,
) {
  lineAfterStopMode.value = mode
}

function updateLineAfterStopColor(
  color: string | null,
) {
  if (!color) {
    return
  }

  transitionStopData.value.lineAfterStopColor = color
  transitionStopData.value.lineAfterStopId = null
}

function openConnectionsEditor() {
  emit('openConnections')
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('ui.dialogs.stop_properties.header')"
    modal
    class="stop-properties-dialog"
  >
    <div class="stop-properties">
      <!--
        =========================================================
        INFORMATIONS
        =========================================================
      -->
      <section class="properties-card information-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-map-pin" />
          </div>

          <div>
            <div class="card-title">
              {{ $t('ui.dialogs.stop_properties.information') }}
            </div>

            <div class="card-description">
              {{ $t('ui.dialogs.stop_properties.information_summary') }}
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_title`"
            >
              {{ $t('ui.dialogs.stop_properties.stop_name') }}
            </label>

            <div class="stop-name-suggestion-field">
              <Textarea
                :id="`${stop.id}_title`"
                v-model="stop.$stop.name"
                pt:root:class="important-h-auto"
                :spellcheck="false"
                auto-resize
                autofocus
                autocomplete="off"
                @focus="onStopNameFocus"
                @input="onStopNameInput"
                @blur="onStopNameBlur"
                @keydown="onStopNameKeydown"
              />

              <div
                v-if="showStopSuggestions"
                class="stop-suggestions"
                role="listbox"
                :aria-label="$t('ui.dialogs.stop_properties.suggestions_aria')"
              >
                <button
                  v-for="(suggestion, index) in stopSuggestions"
                  :key="suggestion.id"
                  type="button"
                  class="stop-suggestion"
                  :class="{
                    active:
                      index
                      === activeStopSuggestionIndex,
                  }"
                  role="option"
                  :aria-selected="
                    index
                    === activeStopSuggestionIndex
                  "
                  @mouseenter="
                    activeStopSuggestionIndex = index
                  "
                  @mousedown.prevent="
                    applyStopSuggestion(suggestion)
                  "
                >
                  <div class="stop-suggestion-heading">
                    <span class="stop-suggestion-name">
                      {{ suggestion.name }}
                    </span>

                    <span
                      class="stop-suggestion-source"
                      :class="{
                        personal:
                          suggestion.source
                          === 'PERSONAL',
                      }"
                    >
                      {{
                        stopSuggestionSourceLabel(
                          suggestion,
                        )
                      }}
                    </span>
                  </div>

                  <div class="stop-suggestion-services">
                    <span
                      v-for="service in suggestion.services"
                      :key="`${service.mode}-${service.index}`"
                      class="stop-suggestion-service"
                      :class="{
                        current:
                          isCurrentSuggestionService(
                            service,
                          ),
                      }"
                    >
                      {{
                        stopSuggestionServiceLabel(
                          service,
                        )
                      }}
                    </span>
                  </div>
                </button>

                <div class="stop-suggestions-hint">
                  <span>
                    {{ $t('ui.dialogs.stop_properties.shortcut_navigation') }}
                  </span>

                  <span>
                    {{ $t('ui.dialogs.stop_properties.shortcut_apply') }}
                  </span>

                  <span>
                    {{ $t('ui.dialogs.stop_properties.shortcut_close') }}
                  </span>
                </div>
              </div>
            </div>

            <div class="stop-catalog-actions">
              <div class="stop-catalog-status">
                <span
                  v-if="currentStopSuggestionSourceLabel"
                  class="stop-catalog-source"
                  :class="{
                    personal:
                      stopData.stopSuggestionSource
                      === 'PERSONAL',
                  }"
                >
                  {{
                    currentStopSuggestionSourceLabel
                  }}
                </span>

                <span class="field-description">
                  {{ $t('ui.dialogs.stop_properties.catalog_hint') }}
                </span>
              </div>

              <div class="stop-catalog-buttons">
                <Button
                  :label="$t('ui.dialogs.stop_properties.save')"
                  icon="i-tabler-bookmark-plus"
                  severity="secondary"
                  size="small"
                  :disabled="!canSaveCurrentStopSuggestion"
                  @click="saveCurrentStopToPersonalCatalog"
                />

                <Button
                  v-if="canDeleteCurrentPersonalStopSuggestion"
                  :label="$t('ui.common.delete')"
                  icon="i-tabler-trash"
                  severity="danger"
                  size="small"
                  text
                  @click="deleteCurrentPersonalStopSuggestion"
                />

                <Button
                  v-if="canResetOfficialStopSuggestion"
                  :label="$t('ui.common.reset')"
                  icon="i-tabler-restore"
                  severity="secondary"
                  size="small"
                  text
                  @click="resetOfficialStopSuggestion"
                />
              </div>
            </div>
          </div>

          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_placeName`"
            >
              {{ $t('ui.dialogs.stop_properties.city_name') }}
            </label>

            <InputText
              :id="`${stop.id}_placeName`"
              v-model="stop.$stop.placeName"
              :spellcheck="false"
              :disabled="!stop.$stop.terminus || !allowCity"
            />

            <span
              v-if="!stop.$stop.terminus || !allowCity"
              class="field-description"
            >
              {{ $t('ui.dialogs.stop_properties.terminus_hint') }}
            </span>
          </div>

          <div class="property-field">
            <label
              class="property-label"
              :for="`${stop.id}_subtitle`"
            >
              {{ $t('ui.dialogs.stop_properties.subtitle') }}
            </label>

            <InputText
              :id="`${stop.id}_subtitle`"
              v-model="stop.$stop.subtitle"
              :spellcheck="false"
            />
          </div>

          <label
            :for="`${stop.id}_preventOverlapping`"
            class="option-row compact-option"
          >
            <div class="option-content">
              <div class="option-icon">
                <i class="i-tabler-layers-subtract" />
              </div>

              <span>
                {{ $t('ui.dialogs.stop_properties.preventOverlapping') }}
              </span>
            </div>

            <Checkbox
              v-model="stop.$stop.preventSubtitleOverlapping"
              binary
              :input-id="`${stop.id}_preventOverlapping`"
            />
          </label>
        </div>
      </section>

      <!--
        =========================================================
        APPARENCE DU NOM
        =========================================================
      -->
      <section class="properties-card appearance-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-typography" />
          </div>

          <div>
            <div class="card-title">
              {{ $t('ui.dialogs.stop_properties.name_appearance') }}
            </div>

            <div class="card-description">
              {{ $t('ui.dialogs.stop_properties.name_appearance_summary') }}
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <span class="property-label">
              {{ $t('ui.dialogs.stop_properties.text_style') }}
            </span>

            <div class="text-style-controls">
              <label
                :for="`${stop.id}_nameBold`"
                class="text-style-button"
                :class="{ active: nameStyle.bold }"
                :title="$t('ui.dialogs.stop_properties.bold')"
              >
                <Checkbox
                  v-model="nameStyle.bold"
                  binary
                  :input-id="`${stop.id}_nameBold`"
                  class="hidden-control"
                />

                <strong>G</strong>

                <span>{{ $t('ui.dialogs.stop_properties.bold') }}</span>
              </label>

              <label
                :for="`${stop.id}_nameItalic`"
                class="text-style-button"
                :class="{ active: nameStyle.italic }"
                :title="$t('ui.dialogs.stop_properties.italic')"
              >
                <Checkbox
                  v-model="nameStyle.italic"
                  binary
                  :input-id="`${stop.id}_nameItalic`"
                  class="hidden-control"
                />

                <em>I</em>

                <span>{{ $t('ui.dialogs.stop_properties.italic') }}</span>
              </label>

              <label
                :for="`${stop.id}_nameUnderline`"
                class="text-style-button"
                :class="{ active: nameStyle.underline }"
                :title="$t('ui.dialogs.stop_properties.underline')"
              >
                <Checkbox
                  v-model="nameStyle.underline"
                  binary
                  :input-id="`${stop.id}_nameUnderline`"
                  class="hidden-control"
                />

                <u>S</u>

                <span>{{ $t('ui.dialogs.stop_properties.underline') }}</span>
              </label>
            </div>
          </div>

          <div class="property-field">
            <span class="property-label">
              {{ $t('ui.dialogs.stop_properties.name_color') }}
            </span>

            <div class="color-control">
              <div
                v-if="hasCustomNameColor"
                class="color-preview"
              >
                <input
                  v-model="customNameColor"
                  type="color"
                  class="name-color-picker"
                >

                <div class="color-information">
                  <span class="color-name">
                    {{ $t('ui.dialogs.stop_properties.custom_name_color') }}
                  </span>

                  <span class="color-value">
                    {{ customNameColor }}
                  </span>
                </div>
              </div>

              <Button
                v-if="!hasCustomNameColor"
                :label="$t('ui.dialogs.stop_properties.custom_color')"
                severity="secondary"
                size="small"
                icon="i-tabler-palette"
                @click="enableCustomNameColor"
              />

              <Button
                v-else
                :label="$t('ui.dialogs.stop_properties.default_color')"
                severity="secondary"
                size="small"
                text
                icon="i-tabler-restore"
                @click="resetNameColor"
              />
            </div>
          </div>

          <div class="property-divider" />

          <div class="property-field">
            <div class="field-heading">
              <div>
                <div class="property-label">
                  {{ $t('ui.dialogs.stop_properties.name_images') }}
                </div>

                <div class="field-description">
                  {{ $t('ui.dialogs.stop_properties.name_images_summary') }}
                </div>
              </div>

              <Button
                v-if="customImages.length > 0"
                :label="$t('ui.common.add')"
                severity="secondary"
                size="small"
                icon="i-tabler-photo-plus"
                @click="openImagePicker()"
              />
            </div>

            <input
              :id="`${stop.id}_nameImage`"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              class="hidden"
              @change="onImageSelected"
            >

            <div
              v-if="customImages.length > 0"
              class="name-images-list"
            >
              <div
                v-for="(image, index) in customImages"
                :key="image.id"
                class="image-preview-container"
              >
                <div class="image-preview">
                  <img
                    :src="image.image"
                    :alt="$t('ui.dialogs.stop_properties.image_preview_alt', { index: index + 1 })"
                  >
                </div>

                <div class="image-actions">
                  <div>
                    <div class="image-title">
                      {{ $t('ui.dialogs.stop_properties.image_label', { number: index + 1 }) }}
                    </div>

                    <div class="field-description">
                      {{ $t('ui.dialogs.stop_properties.stored_in_project') }}
                    </div>
                  </div>

                  <div class="image-buttons">
                    <Button
                      :label="$t('ui.common.change')"
                      severity="secondary"
                      size="small"
                      icon="i-tabler-photo"
                      @click="openImagePicker(image.id)"
                    />

                    <Button
                      :label="$t('ui.common.delete')"
                      severity="danger"
                      size="small"
                      text
                      icon="i-tabler-trash"
                      @click="removeImage(image.id)"
                    />
                  </div>

                  <div class="image-size-control">
                    <div class="slider-heading">
                      <label
                        class="property-label"
                        :for="`${stop.id}_nameImageSize_${image.id}`"
                      >
                        {{ $t('ui.dialogs.stop_properties.size') }}
                      </label>

                      <span class="slider-value">
                        {{ image.imageSize.toFixed(1) }}×
                      </span>
                    </div>

                    <input
                      :id="`${stop.id}_nameImageSize_${image.id}`"
                      :value="image.imageSize"
                      type="range"
                      min="0.4"
                      max="3"
                      step="0.1"
                      class="image-size-slider"
                      @input="onImageSizeInput(image.id, $event)"
                    >
                  </div>
                </div>
              </div>
            </div>

            <button
              v-else
              type="button"
              class="image-empty-state"
              @click="openImagePicker()"
            >
              <div class="image-empty-icon">
                <i class="i-tabler-photo-plus" />
              </div>

              <div>
                <div class="image-empty-title">
                  {{ $t('ui.dialogs.stop_properties.add_image') }}
                </div>

                <div class="field-description">
                  {{ $t('ui.dialogs.stop_properties.image_formats') }}
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      <div class="properties-right-column">
      <!--
        =========================================================
        CONFIGURATION
        =========================================================
      -->
      <section class="properties-card configuration-card">
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-adjustments-horizontal" />
          </div>

          <div>
            <div class="card-title">
              {{ $t('ui.dialogs.stop_properties.configuration') }}
            </div>

            <div class="card-description">
              {{ $t('ui.dialogs.stop_properties.configuration_summary') }}
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.accessible.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.accessible"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="accessibilityOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.stop_state.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.closed"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="stopStateOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div class="property-field">
            <label class="property-label">
              {{ $t('ui.dialogs.stop_properties.stop_type.title') }}
            </label>

            <SelectButton
              v-model="stop.$stop.terminus"
              pt:pc-toggle-button:root:class="flex-grow"
              :options="stopTypeOptions"
              :option-label="option => $t(option.label)"
              option-value="value"
              :allow-empty="false"
            />
          </div>

          <div
            v-if="stop.$stop.terminus"
            class="terminus-arrow-editor"
          >
            <label
              :for="`${stop.id}_terminusArrow`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-arrow-right" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.arrow_terminus') }}
                  </div>

                  <div class="option-description">
                    {{ $t('ui.dialogs.stop_properties.arrow_terminus_summary') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="terminusArrowEnabled"
                binary
                :input-id="`${stop.id}_terminusArrow`"
              />
            </label>

            <div
              v-if="terminusArrowEnabled"
              class="terminus-arrow-text-field"
            >
              <label
                class="property-label"
                :for="`${stop.id}_terminusArrowText`"
              >
                {{ $t('ui.dialogs.stop_properties.direction_text') }}
              </label>

              <InputText
                :id="`${stop.id}_terminusArrowText`"
                v-model="terminusArrowText"
                :spellcheck="false"
                :placeholder="$t('ui.dialogs.stop_properties.direction_placeholder')"
              />

              <div class="field-description">
                {{ $t('ui.dialogs.stop_properties.direction_example') }}
              </div>
            </div>
          </div>

          <div class="property-divider" />

          <div class="options-list">
            <label
              :for="`${stop.id}_reverse`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-arrows-exchange" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.reverse') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.reverse"
                binary
                :input-id="`${stop.id}_reverse`"
              />
            </label>

            <label
              :for="`${stop.id}_interestPoint`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-star" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.interest_point') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.interestPoint"
                binary
                :input-id="`${stop.id}_interestPoint`"
              />
            </label>

            <label
              :for="`${stop.id}_future`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-clock-plus" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.future_stop') }}
                  </div>

                  <div class="option-description">
                    {{ $t('ui.dialogs.stop_properties.future_stop_summary') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.future"
                binary
                :input-id="`${stop.id}_future`"
              />
            </label>

            <div class="line-change-option">
              <label
                :for="`${stop.id}_changeLineAfter`"
                class="option-row"
              >
                <div class="option-content">
                  <div class="option-icon">
                    <i class="i-tabler-arrows-right-left" />
                  </div>

                  <div>
                    <div class="option-title">
                      {{ $t('ui.dialogs.stop_properties.change_line_after') }}
                    </div>

                    <div class="option-description">
                      {{ $t('ui.dialogs.stop_properties.change_line_after_summary') }}
                    </div>
                  </div>
                </div>

                <Checkbox
                  v-model="changesLineAfterStop"
                  binary
                  :input-id="`${stop.id}_changeLineAfter`"
                />
              </label>

              <div
                v-if="changesLineAfterStop"
                class="line-change-inline-editor"
              >
                <div class="line-change-preview">
                  <Mode
                    v-if="lineAfterStopMode"
                    :mode="lineAfterStopMode"
                    plain
                    class="served-line-mode"
                  />

                  <LineIndex
                    v-if="lineAfterStopMode"
                    :mode="lineAfterStopMode"
                    :index="lineAfterStopIndex"
                    class="served-line-index"
                  />

                  <span>{{ $t('ui.dialogs.stop_properties.new_line_after') }}</span>
                </div>

                <div class="line-change-editor-grid">
                  <div class="property-field">
                    <label class="property-label">
                      {{ $t('ui.dialogs.stop_properties.transport_mode') }}
                    </label>

                    <ModeSelect
                      :model-value="lineAfterStopMode"
                      @update:model-value="updateLineAfterStopMode"
                    />
                  </div>

                  <div class="property-field">
                    <label class="property-label">
                      {{ $t('ui.dialogs.stop_properties.index') }}
                    </label>

                    <IndexSelect
                      v-model="lineAfterStopIndex"
                      :mode="lineAfterStopMode"
                      @update-color="updateLineAfterStopColor"
                    />
                  </div>
                </div>

                <div class="line-change-information">
                  <i class="i-tabler-info-circle" />

                  <span>
                    {{ $t('ui.dialogs.stop_properties.new_line_detail') }}
                  </span>
                </div>
              </div>
            </div>

            <label
              :for="`${stop.id}_outOfFareZone`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-map-pin-off" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.out_of_fare_zone') }}
                  </div>

                  <div class="option-description">
                    {{ $t('ui.dialogs.stop_properties.out_of_fare_zone_summary') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.outOfFareZone"
                binary
                :input-id="`${stop.id}_outOfFareZone`"
              />
            </label>

            <label
              :for="`${stop.id}_offLine`"
              class="option-row"
            >
              <div class="option-content">
                <div class="option-icon">
                  <i class="i-tabler-eye-off" />
                </div>

                <div>
                  <div class="option-title">
                    {{ $t('ui.dialogs.stop_properties.faded_stop') }}
                  </div>

                  <div class="option-description">
                    {{ $t('ui.dialogs.stop_properties.faded_stop_summary') }}
                  </div>
                </div>
              </div>

              <Checkbox
                v-model="stop.$stop.offLine"
                binary
                :input-id="`${stop.id}_offLine`"
              />
            </label>
          </div>
        </div>
      </section>

      <!--
        =========================================================
        LIGNES DESSERVIES
        =========================================================
      -->
      <section
        v-if="availableBranchLines.length > 1"
        class="properties-card lines-card"
      >
        <div class="card-header">
          <div class="card-icon">
            <i class="i-tabler-route" />
          </div>

          <div>
            <div class="card-title">
              {{ $t('ui.dialogs.stop_properties.served_lines') }}
            </div>

            <div class="card-description">
              {{ $t('ui.dialogs.stop_properties.served_lines_summary') }}
            </div>
          </div>
        </div>

        <div class="card-content">
          <div class="served-lines">
            <label
              v-for="branchLine in availableBranchLines"
              :key="branchLine.id"
              class="served-line"
              :class="{
                active:
                  isStopOnLine(
                    branchLine.id,
                  ),
              }"
            >
              <div class="served-line-identity">
                <Mode
                  :mode="branchLine.mode"
                  plain
                  class="served-line-mode"
                />

                <LineIndex
                  :mode="branchLine.mode"
                  :index="branchLine.index"
                  class="served-line-index"
                />

                <span
                  v-if="branchLine.primary"
                  class="served-line-primary"
                >
                  {{ $t('ui.dialogs.stop_properties.main_line') }}
                </span>
              </div>

              <Checkbox
                :model-value="
                  isStopOnLine(
                    branchLine.id,
                  )
                "
                binary
                :disabled="
                  isStopOnLine(
                    branchLine.id,
                  )
                  && selectedLineCount <= 1
                "
                @update:model-value="
                  value =>
                    onLineMembershipChange(
                      branchLine.id,
                      value,
                    )
                "
              />
            </label>
          </div>

          <div
            v-if="selectedLineCount > 1"
            class="shared-stop-information"
          >
            <i class="i-tabler-arrows-vertical" />

            <span>
              {{ $t('ui.dialogs.stop_properties.shared_stop_summary') }}
            </span>
          </div>
        </div>
      </section>

      </div>

    </div>

    <!--
      =========================================================
      CORRESPONDANCES
      =========================================================
    -->
    <div class="connections-section">
      <button
        type="button"
        class="connections-button"
        @click="openConnectionsEditor"
      >
        <div class="connections-button-icon">
          <i class="i-tabler-arrows-transfer-up-down" />
        </div>

        <div class="connections-button-content">
          <div class="connections-button-title">
            {{ $t('ui.dialogs.stop_properties.connections') }}
          </div>

          <div class="connections-button-description">
            {{ $t('ui.dialogs.stop_properties.connections_summary') }}
          </div>
        </div>

        <i class="i-tabler-chevron-right connections-chevron" />
      </button>
    </div>
  </Dialog>
</template>

<style scoped lang="scss">
.stop-properties {
  display: grid;
  grid-template-columns:
    minmax(19rem, 1fr)
    minmax(19rem, 1fr);

  align-items: start;
  gap: .8rem;

  width: min(58rem, calc(100vw - 4rem));
  max-height: calc(100vh - 13rem);

  overflow-y: auto;

  padding: .1rem .2rem .3rem .1rem;
}

/*
 * =========================================================
 * CARTES
 * =========================================================
 */

.properties-card {
  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .9rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-background) 94%,
      transparent
    );
}

.information-card {
  grid-column: 1;
}

.appearance-card {
  grid-column: 1;
}

.properties-right-column {
  grid-column: 2;
  grid-row: 1 / span 2;

  display: flex;
  flex-direction: column;
  gap: .8rem;

  min-width: 0;
}

.lines-card,
.line-change-card,
.configuration-card {
  width: 100%;
}

.card-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .65rem;

  padding: .7rem .75rem;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 70%,
      transparent
    );

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 55%,
      transparent
    );
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1.05rem;
}

.card-title {
  font-size: .9rem;
  font-weight: 700;
}

.card-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: .85rem;

  padding: .8rem;
}

/*
 * =========================================================
 * CHAMPS
 * =========================================================
 */

.property-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.property-label {
  color:
    var(--p-text-color);

  font-size: .82rem;
  font-weight: 600;
}

.field-description,
.option-description {
  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.3;
}

.property-field :deep(.p-inputtext),
.property-field :deep(.p-textarea),
.property-field :deep(.p-select),
.property-field :deep(.p-selectbutton) {
  width: 100%;
}

/*
 * =========================================================
 * SUGGESTIONS D'ARRÊTS CLU
 * =========================================================
 */

.stop-name-suggestion-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.stop-suggestions {
  overflow: hidden;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 22%,
      var(--p-content-border-color)
    );

  border-radius: .75rem;

  background:
    var(--p-content-background);

  box-shadow:
    0 8px 24px rgb(0 0 0 / 10%);
}

.stop-suggestion {
  appearance: none;

  display: flex;
  flex-direction: column;
  gap: .35rem;

  width: 100%;

  padding: .62rem .7rem;

  border: 0;
  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    );

  background: transparent;

  color:
    var(--p-text-color);

  font: inherit;
  text-align: left;

  cursor: pointer;

  transition:
    background-color .12s ease;
}

.stop-suggestion:hover,
.stop-suggestion.active {
  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 8%,
      var(--p-content-background)
    );
}

.stop-suggestion:last-of-type {
  border-bottom: 0;
}

.stop-suggestion-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.stop-suggestion-name {
  min-width: 0;

  overflow: hidden;

  font-size: .82rem;
  font-weight: 700;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-suggestion-source {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  padding: .12rem .38rem;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 12%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);

  font-size: .62rem;
  font-weight: 800;
  letter-spacing: .04em;
}

.stop-suggestion-source.personal,
.stop-catalog-source.personal {
  background:
    color-mix(
      in srgb,
      var(--p-green-500, #22c55e) 12%,
      var(--p-content-background)
    );

  color:
    var(--p-green-600, #16a34a);
}

.stop-catalog-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  padding-top: .05rem;
}

.stop-catalog-status {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .45rem;

  min-width: 0;
}

.stop-catalog-source {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  padding: .13rem .42rem;

  border-radius: 999px;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 12%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);

  font-size: .62rem;
  font-weight: 800;
  letter-spacing: .04em;
}

.stop-catalog-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: .25rem;

  flex-shrink: 0;
}

@media (max-width: 640px) {
  .stop-catalog-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .stop-catalog-buttons {
    justify-content: flex-start;
  }
}

.stop-suggestion-services {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: .25rem;
}

.stop-suggestion-service {
  display: inline-flex;
  align-items: center;

  padding: .1rem .3rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .4rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .62rem;
  line-height: 1.25;
}

.stop-suggestion-service.current {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 45%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 9%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);

  font-weight: 700;
}

.stop-suggestions-hint {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .55rem;

  padding: .38rem .55rem;

  border-top:
    1px solid
    var(--p-content-border-color);

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 65%,
      transparent
    );

  color:
    var(--p-text-muted-color);

  font-size: .6rem;
}

.terminus-arrow-editor {
  display: flex;
  flex-direction: column;
  gap: .65rem;

  padding: .65rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 18%,
      var(--p-content-border-color)
    );

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 4%,
      var(--p-content-background)
    );
}

.terminus-arrow-text-field {
  display: flex;
  flex-direction: column;
  gap: .35rem;

  padding-top: .1rem;
}

.terminus-arrow-text-field :deep(.p-inputtext) {
  width: 100%;
}

.property-divider {
  width: 100%;
  height: 1px;

  margin: .15rem 0;

  background:
    color-mix(
      in srgb,
      var(--p-content-border-color) 70%,
      transparent
    );
}

/*
 * =========================================================
 * STYLE DU TEXTE
 * =========================================================
 */

.text-style-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .35rem;
}

.text-style-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;

  min-height: 2.35rem;

  padding: .4rem .5rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .65rem;

  background:
    var(--p-content-background);

  color:
    var(--p-text-muted-color);

  font-size: .75rem;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    color .15s ease,
    box-shadow .15s ease;
}

.text-style-button:hover {
  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-color);
}

.text-style-button.active {
  border-color:
    var(--p-primary-color);

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 10%,
      var(--p-content-background)
    );

  color:
    var(--p-primary-color);

  box-shadow:
    inset 0 0 0 1px
    color-mix(
      in srgb,
      var(--p-primary-color) 25%,
      transparent
    );
}

.hidden-control {
  position: absolute;

  width: 1px;
  height: 1px;

  overflow: hidden;

  opacity: 0;

  pointer-events: none;
}

/*
 * =========================================================
 * COULEUR
 * =========================================================
 */

.color-control {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .5rem;

  min-height: 2.5rem;
}

.color-preview {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .55rem;

  flex: 1;
}

.name-color-picker {
  width: 2.4rem;
  height: 2.4rem;

  flex-shrink: 0;

  padding: .15rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .6rem;

  background:
    var(--p-content-background);

  cursor: pointer;
}

.color-information {
  display: flex;
  flex-direction: column;

  min-width: 0;
}

.color-name {
  font-size: .75rem;
  font-weight: 600;
}

.color-value {
  color:
    var(--p-text-muted-color);

  font-family: monospace;
  font-size: .68rem;

  text-transform: uppercase;
}

/*
 * =========================================================
 * IMAGE
 * =========================================================
 */

.field-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}

.name-images-list {
  display: flex;
  flex-direction: column;
  gap: .55rem;
}

.image-preview-container {
  display: flex;
  align-items: flex-start;
  gap: .75rem;

  padding: .65rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 45%,
      transparent
    );
}

.image-preview {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 3.8rem;
  height: 3.8rem;

  flex-shrink: 0;

  padding: .25rem;

  overflow: hidden;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .6rem;

  background:
    var(--p-content-background);

  img {
    display: block;

    max-width: 100%;
    max-height: 100%;

    object-fit: contain;
  }
}

.image-actions {
  display: flex;
  flex-direction: column;
  gap: .45rem;

  min-width: 0;

  flex: 1;
}

.image-size-control {
  display: flex;
  flex-direction: column;
  gap: .3rem;

  width: 100%;
}

.image-title {
  font-size: .78rem;
  font-weight: 600;
}

.image-buttons {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: .35rem;
}

.image-empty-state {
  appearance: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .65rem;

  width: 100%;

  padding: .7rem;

  border:
    1px dashed
    var(--p-content-border-color);

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-content-hover-background) 35%,
      transparent
    );

  color:
    var(--p-text-color);

  font-family: inherit;
  text-align: left;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease;
}

.image-empty-state:hover {
  border-color:
    var(--p-primary-color);

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 6%,
      var(--p-content-background)
    );
}

.image-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.2rem;
  height: 2.2rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: 1.1rem;
}

.image-empty-title {
  font-size: .78rem;
  font-weight: 600;
}

.slider-heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.slider-value {
  padding: .15rem .4rem;

  border-radius: .4rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 600;
}

.image-size-slider {
  width: 100%;

  cursor: pointer;
}

/*
 * =========================================================
 * LIGNES DESSERVIES
 * =========================================================
 */

.served-lines {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.served-line {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;

  min-height: 3.2rem;

  padding: .45rem .55rem;

  border:
    1px solid
    var(--p-content-border-color);

  border-radius: .7rem;

  background:
    var(--p-content-background);

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    box-shadow .15s ease;
}

.served-line:hover {
  background:
    var(--p-content-hover-background);
}

.served-line.active {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 55%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 6%,
      var(--p-content-background)
    );
}

.served-line-identity {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .45rem;

  min-width: 0;
}

.served-line-mode {
  flex-shrink: 0;
  font-size: 1.6rem;
}

.served-line-index {
  flex-shrink: 0;
  font-size: 1.9rem;
}

.served-line-primary {
  padding: .15rem .4rem;

  border-radius: .4rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .65rem;
  font-weight: 600;
}

.shared-stop-information {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .45rem;

  padding: .5rem .6rem;

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.35;
}

.shared-stop-information i {
  flex-shrink: 0;

  color:
    var(--p-primary-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * CHANGER DE LIGNE SUR CET ARRÊT
 * =========================================================
 */

.line-change-option {
  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    );
}

.line-change-option > .option-row {
  border-bottom: 0;
}

.line-change-inline-editor {
  display: flex;
  flex-direction: column;
  gap: .65rem;

  margin: 0 .15rem .7rem 2.3rem;
  padding: .7rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 25%,
      var(--p-content-border-color)
    );

  border-radius: .75rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 4%,
      var(--p-content-background)
    );
}

.line-change-preview {
  display: flex;
  align-items: center;
  gap: .45rem;

  min-height: 2.4rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  font-weight: 600;
}

.line-change-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .6rem;
}

.line-change-information {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: .45rem;

  padding: .55rem .6rem;

  border-radius: .65rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
  line-height: 1.35;
}

.line-change-information i {
  flex-shrink: 0;

  margin-top: .05rem;

  color:
    var(--p-primary-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * OPTIONS
 * =========================================================
 */

.options-list {
  display: flex;
  flex-direction: column;
}

.option-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;

  min-height: 3rem;

  padding: .5rem .15rem;

  cursor: pointer;

  border-bottom:
    1px solid
    color-mix(
      in srgb,
      var(--p-content-border-color) 65%,
      transparent
    );
}

.option-row:last-child {
  border-bottom: 0;
}

.compact-option {
  margin-top: .1rem;
}

.option-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .55rem;

  min-width: 0;
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 1.75rem;
  height: 1.75rem;

  flex-shrink: 0;

  border-radius: .5rem;

  background:
    var(--p-content-hover-background);

  color:
    var(--p-text-muted-color);

  font-size: .9rem;
}

.option-title {
  font-size: .78rem;
  font-weight: 500;
}

/*
 * =========================================================
 * CORRESPONDANCES
 * =========================================================
 */

.connections-section {
  margin-top: .8rem;
}

.connections-button {
  appearance: none;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: .7rem;

  width: 100%;

  padding: .7rem .8rem;

  border:
    1px solid
    color-mix(
      in srgb,
      var(--p-primary-color) 35%,
      var(--p-content-border-color)
    );

  border-radius: .9rem;

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 7%,
      var(--p-content-background)
    );

  color:
    var(--p-text-color);

  font-family: inherit;
  text-align: left;

  cursor: pointer;

  transition:
    background-color .15s ease,
    border-color .15s ease,
    transform .15s ease;
}

.connections-button:hover {
  border-color:
    color-mix(
      in srgb,
      var(--p-primary-color) 60%,
      var(--p-content-border-color)
    );

  background:
    color-mix(
      in srgb,
      var(--p-primary-color) 11%,
      var(--p-content-background)
    );
}

.connections-button:active {
  transform: scale(.995);
}

.connections-button-icon {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.25rem;
  height: 2.25rem;

  flex-shrink: 0;

  border-radius: .65rem;

  background:
    var(--p-primary-color);

  color:
    var(--p-primary-contrast-color);

  font-size: 1.05rem;
}

.connections-button-content {
  display: flex;
  flex-direction: column;

  min-width: 0;

  flex: 1;
}

.connections-button-title {
  font-size: .85rem;
  font-weight: 700;
}

.connections-button-description {
  margin-top: .05rem;

  color:
    var(--p-text-muted-color);

  font-size: .7rem;
}

.connections-chevron {
  flex-shrink: 0;

  color:
    var(--p-text-muted-color);

  font-size: 1rem;
}

/*
 * =========================================================
 * RESPONSIVE
 * =========================================================
 */

@media (max-width: 1024px) {
  .stop-properties {
    grid-template-columns: 1fr;

    width: min(32rem, calc(100vw - 3rem));
  }

  .information-card,
  .appearance-card,
  .properties-right-column {
    grid-column: 1;
    grid-row: auto;
  }

  .properties-right-column {
    display: flex;
    flex-direction: column;
    gap: .8rem;
  }
}

@media (max-width: 640px) {
  .stop-properties {
    width: calc(100vw - 2rem);
  }

  .text-style-controls {
    grid-template-columns: 1fr;
  }

  .line-change-editor-grid {
    grid-template-columns: 1fr;
  }

  .line-change-inline-editor {
    margin-left: .15rem;
  }

  .image-preview-container {
    align-items: flex-start;
  }
}
</style>