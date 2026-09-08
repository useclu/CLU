<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { useDateFormat } from '@vueuse/shared'
import { storeToRefs } from 'pinia'
import {
  computed,
  ref,
} from 'vue'
import AnnotationPropertiesDialog from '~/components/editor/dialogs/AnnotationPropertiesDialog.vue'
import useVersion from '~/composables/useVersion'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useProject } from '~/stores/useProject'
import {
  isBranch,
  isBuiltin,
  isCustom,
  isLoop,
  isParallelBranches,
  isStop,
  isVerticalSegment,
} from '~/utils/types'

const { applicationVersion } = useVersion()

const {
  line,
  outdated,
  presetBased,
} = storeToRefs(useProject())

const {
  findIndexById,
} = useCustomLineIndices()

const now = useNow()

const date = useDateFormat(
  now.value,
  'DD.MM.YYYY',
)

const content =
  ref<HTMLElement | null>(null)

const annotationPropertiesVisible =
  ref(false)

const selectedAnnotation =
  ref<Annotation | null>(null)

const draggingAnnotationId =
  ref<string | null>(null)

let startPointerX = 0
let startPointerY = 0

let startOffsetX = 0
let startOffsetY = 0

let hasMoved = false

const annotations = computed(() =>
  line.value.annotations ?? [],
)

/*
 * =========================================================
 * PLAN BUS / BRT / NOCTILIEN / CABLE / VELO / BOAT
 * =========================================================
 */

const isBusMode = computed(() =>
  line.value.mode === 'BUS'
  || line.value.mode === 'BRT'
  || line.value.mode === 'NOCTILIEN'
  || line.value.mode === 'CABLE'
  || line.value.mode === 'VELO'
  || line.value.mode === 'BOAT',
)

/*
 * =========================================================
 * PLAN TRAMWAY
 * =========================================================
 *
 * Le Tram conserve la topologie et la ligne existantes.
 * Seul le panneau d'identité à gauche reçoit
 * une présentation spécifique.
 */
const isTramMode = computed(() =>
  line.value.mode === 'TRAM',
)

/*
 * Téléphérique, vélo et navette fluviale utilisent
 * le rendu de plan Bus, mais affichent aussi leur
 * pictogramme de mode juste avant l'indice de ligne
 * afin d'identifier immédiatement le moyen de transport.
 *
 * Le Bus reste volontairement sans pictogramme ajouté ici.
 */
const showTransportModePictogram = computed(() =>
  line.value.mode === 'BUS'
  || line.value.mode === 'BRT'
  || line.value.mode === 'NOCTILIEN'
  || line.value.mode === 'CABLE'
  || line.value.mode === 'VELO'
  || line.value.mode === 'BOAT',
)

/*
 * Certains projets utilisent encore l'ancien champ
 * "stop" des VerticalSegment.
 *
 * Les versions plus récentes peuvent contenir
 * plusieurs arrêts dans "stops".
 */
type VerticalSegmentWithStops =
  VerticalSegment & {
    $verticalSegment:
      VerticalSegment['$verticalSegment'] & {
        stops?: Stop[]
      }
  }

/*
 * Récupère récursivement les arrêts d'une section.
 */
function getStopsFromSection(
  section: LineSection,
): Stop[] {
  const stops: Stop[] = []

  for (
    const element
    of section.$lineSection.elements
  ) {
    /*
     * Branche classique.
     */
    if (isBranch(element)) {
      stops.push(
        ...element
          .$branch
          .elements
          .filter(isStop),
      )

      continue
    }

    /*
     * Branches parallèles.
     */
    if (isParallelBranches(element)) {
      for (
        const subSection
        of element
          .$parallelBranches
          .sections
      ) {
        stops.push(
          ...getStopsFromSection(
            subSection,
          ),
        )
      }

      continue
    }

    /*
     * Segment vertical.
     */
    function onAnnotationPointerDown(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    event.button !== 0
  ) {
    return
  }

  const target =
    event.target as HTMLElement

  if (
    target.closest(
      '.annotation-delete',
    )
  ) {
    return
  }

  event.preventDefault()

  const element =
    event.currentTarget as HTMLElement

  element.setPointerCapture(
    event.pointerId,
  )

  draggingAnnotationId.value =
    annotation.id

  startPointerX =
    event.clientX

  startPointerY =
    event.clientY

  startOffsetX =
    annotation
      .$annotation
      .offsetX

  startOffsetY =
    annotation
      .$annotation
      .offsetY

  hasMoved = false
  }

    /*
     * Boucle avec arrêt.
     */
    if (isLoop(element)) {
      const loopStop =
        element
          .$loop
          .stop

      if (
        loopStop !== undefined
      ) {
        stops.push(
          loopStop,
        )
      }
    }
  }

  return stops
}

/*
 * Tous les arrêts du plan.
 */
const mapStops = computed(() =>
  line.value.topology.flatMap(
    section =>
      getStopsFromSection(
        section,
      ),
  ),
)

/*
 * =========================================================
 * IDENTITÉS DE LIGNES PRÉSENTES SUR LE PLAN
 * =========================================================
 *
 * La ligne principale reste la première identité.
 *
 * Sont ensuite récupérées :
 * - les lignes supplémentaires ajoutées aux branches ;
 * - les identités utilisées seulement sur une portion via
 *   "Changer de ligne après cet arrêt".
 *
 * Toutes sont dédupliquées par mode + indice.
 *
 * Exemples :
 * - Métro 16 + Métro 17 :
 *   un seul pictogramme Métro puis 16 et 17 côte à côte ;
 * - RER C + Transilien V :
 *   une ligne RER C puis une ligne Transilien V dessous ;
 * - RER C + RER A :
 *   un seul pictogramme RER puis C et A côte à côte.
 */
type DisplayLineIdentity = {
  key: string
  mode: Mode
  index: LineIndex | null
}

type DisplayLineModeGroup = {
  mode: Mode
  identities: DisplayLineIdentity[]
}

/*
 * Une identité peut aussi apparaître uniquement sur une
 * portion du plan grâce à "Changer de ligne après cet arrêt".
 *
 * Elle n'a pas besoin d'être déclarée comme ligne
 * supplémentaire de la branche.
 */
type StopWithLineTransition = Stop['$stop'] & {
  lineAfterStopMode?: Mode | null
  lineAfterStopIndex?: LineIndex | null
}

function lineIdentityKey(
  mode: Mode,
  index: LineIndex | null,
) {
  if (index === null) {
    return `${mode}:none`
  }

  if (isBuiltin(index)) {
    return (
      `${mode}:builtin:`
      + index
        .$builtinLineIndex
        .index
    )
  }

  if (isCustom(index)) {
    return (
      `${mode}:custom:`
      + index
        .$customLineIndex
        .id
    )
  }

  return `${mode}:unknown`
}

function getAdditionalLinesFromSection(
  section: LineSection,
) {
  const identities:
    DisplayLineIdentity[] = []

  for (
    const element
    of section.$lineSection.elements
  ) {
    if (isBranch(element)) {
      for (
        const additionalLine
        of (
          element
            .$branch
            .additionalLines
          ?? []
        )
      ) {
        identities.push({
          key: lineIdentityKey(
            additionalLine.mode,
            additionalLine.index,
          ),
          mode: additionalLine.mode,
          index: additionalLine.index,
        })
      }

      continue
    }

    if (isParallelBranches(element)) {
      for (
        const subSection
        of element
          .$parallelBranches
          .sections
      ) {
        identities.push(
          ...getAdditionalLinesFromSection(
            subSection,
          ),
        )
      }
    }
  }

  return identities
}

const planLineIdentities =
  computed(
    (): DisplayLineIdentity[] => {
      const identities:
        DisplayLineIdentity[] = [
          {
            key: lineIdentityKey(
              line.value.mode,
              line.value.index,
            ),
            mode: line.value.mode,
            index: line.value.index,
          },
        ]

      for (
        const section
        of line.value.topology
      ) {
        identities.push(
          ...getAdditionalLinesFromSection(
            section,
          ),
        )
      }

      /*
       * Ajoute aussi toutes les identités utilisées seulement
       * sur une portion du tracé.
       *
       * Exemple :
       * - plan principal RER C ;
       * - de Versailles à Massy : Transilien V.
       *
       * Le panneau d'identité affichera alors :
       *
       * [RER] [C]
       * [Transilien] [V]
       *
       * Si la seconde identité était RER A :
       *
       * [RER] [C] [A]
       *
       * grâce au regroupement par mode déjà utilisé plus bas.
       */
      for (
        const stop
        of mapStops.value
      ) {
        const transition = stop.$stop as StopWithLineTransition

        if (!transition.lineAfterStopMode) {
          continue
        }

        identities.push({
          key: lineIdentityKey(
            transition.lineAfterStopMode,
            transition.lineAfterStopIndex
            ?? null,
          ),
          mode:
            transition.lineAfterStopMode,
          index:
            transition.lineAfterStopIndex
            ?? null,
        })
      }

      const seen =
        new Set<string>()

      return identities.filter(
        (identity) => {
          if (
            seen.has(identity.key)
          ) {
            return false
          }

          seen.add(identity.key)

          return true
        },
      )
    },
  )

const planLineModeGroups =
  computed<DisplayLineModeGroup[]>(
    () => {
      const groups:
        DisplayLineModeGroup[] = []

      for (
        const identity
        of planLineIdentities.value
      ) {
        let group =
          groups.find(
            item =>
              item.mode
              === identity.mode,
          )

        if (!group) {
          group = {
            mode: identity.mode,
            identities: [],
          }

          groups.push(group)
        }

        group.identities.push(
          identity,
        )
      }

      return groups
    },
  )

/*
 * Évite les doublons éventuels.
 */
function uniqueStops(
  stops: Stop[],
): Stop[] {
  const seen =
    new Set<string>()

  return stops.filter(
    (stop) => {
      if (
        seen.has(stop.id)
      ) {
        return false
      }

      seen.add(stop.id)

      return true
    },
  )
}

/*
 * =========================================================
 * DESTINATIONS BUS
 * =========================================================
 *
 * Priorité :
 *
 * 1. arrêts explicitement définis comme terminus ;
 * 2. sinon premier et dernier arrêt nommés.
 */

const busDestinations =
  computed(() => {
    const stops =
      uniqueStops(
        mapStops.value,
      )

    const terminusStops =
      stops.filter(
        stop =>
          stop.$stop.terminus
          && stop
            .$stop
            .name
            .trim()
            !== '',
      )

    if (
      terminusStops.length > 0
    ) {
      return terminusStops.map(
        stop =>
          stop
            .$stop
            .name
            .trim(),
      )
    }

    const namedStops =
      stops.filter(
        stop =>
          stop
            .$stop
            .name
            .trim()
            !== '',
      )

    if (
      namedStops.length
      === 0
    ) {
      return []
    }

    if (
      namedStops.length
      === 1
    ) {
      return [
        namedStops[0]
          .$stop
          .name
          .trim(),
      ]
    }

    return [
      namedStops[0]
        .$stop
        .name
        .trim(),

      namedStops[
        namedStops.length - 1
      ]
        .$stop
        .name
        .trim(),
    ]
  })

/*
 * =========================================================
 * INDICE BUS
 * =========================================================
 *
 * Contrairement au LineIndex classique, le bandeau Bus
 * affiche directement le texte de l'indice dans un
 * cartouche rectangulaire.
 */

const busIndexText =
  computed(() => {
    const index =
      line.value.index

    if (
      index === null
    ) {
      return '?'
    }

    /*
     * Indice BULB standard.
     */
    if (isBuiltin(index)) {
      return (
        index
          .$builtinLineIndex
          .index
        || '?'
      )
    }

    /*
     * Indice personnalisé.
     */
    if (isCustom(index)) {
      const customIndex =
        findIndexById(
          index
            .$customLineIndex
            .id,
        )

      if (
        customIndex
        === undefined
      ) {
        return '?'
      }

      return (
        `${customIndex.prefix ?? ''}`
        + `${customIndex.index}`
        + `${customIndex.suffix ?? ''}`
      )
    }

    return '?'
  })

/*
 * Couleur du cartouche.
 *
 * On utilise directement la couleur choisie
 * pour la ligne dans le projet.
 */
const busIndexBackground =
  computed(() =>
    line.value.color
    ?? '#f5c400',
  )

/*
 * Détermine automatiquement si le texte
 * du cartouche doit être blanc ou noir
 * selon la luminosité de la couleur.
 */
const busIndexForeground =
  computed(() => {
    const rawColor =
      busIndexBackground
        .value
        .trim()

    const match =
      rawColor.match(
        /^#?([0-9a-f]{6})$/i,
      )

    if (
      match === null
    ) {
      return '#111111'
    }

    const hex =
      match[1]

    const red =
      Number.parseInt(
        hex.slice(0, 2),
        16,
      )

    const green =
      Number.parseInt(
        hex.slice(2, 4),
        16,
      )

    const blue =
      Number.parseInt(
        hex.slice(4, 6),
        16,
      )

    const luminance =
      (
        red * 299
        + green * 587
        + blue * 114
      )
      / 1000

    return (
      luminance > 150
        ? '#111111'
        : '#ffffff'
    )
  })

const busIndexStyle =
  computed(() => ({
    backgroundColor:
      busIndexBackground.value,

    color:
      busIndexForeground.value,
  }))

/*
 * =========================================================
 * ANNOTATIONS
 * =========================================================
 */

function annotationPositionStyle(
  annotation: Annotation,
) {
  return {
    left:
      `${annotation.$annotation.offsetX}em`,

    top:
      `${annotation.$annotation.offsetY}em`,
  }
}

function normalizeAnnotationColor(
  color: string | null,
) {
  if (
    color === null
    || color.trim() === ''
  ) {
    return (
      'var(--blue-ratp-paper)'
    )
  }

  const value =
    color.trim()

  if (
    /^[0-9a-f]{3,8}$/i
      .test(value)
  ) {
    return `#${value}`
  }

  return value
}

function annotationTextStyle(
  annotation: Annotation,
) {
  return {
    color:
      normalizeAnnotationColor(
        annotation
          .$annotation
          .color,
      ),

    fontSize:
      `${
        annotation
          .$annotation
          .fontSize
      }em`,

    fontWeight:
      annotation
        .$annotation
        .bold
        ? 'bold'
        : 'normal',

    fontStyle:
      annotation
        .$annotation
        .italic
        ? 'italic'
        : 'normal',

    textDecoration:
      annotation
        .$annotation
        .underline
        ? 'underline'
        : 'none',
  }
}

function getContentFontSize() {
  if (
    content.value === null
  ) {
    return 16
  }

  const fontSize =
    Number.parseFloat(
      window
        .getComputedStyle(
          content.value,
        )
        .fontSize,
    )

  if (
    Number.isNaN(
      fontSize,
    )
  ) {
    return 16
  }

  return fontSize
}

function onAnnotationPointerDown(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    event.button !== 0
  ) {
    return
  }

  const target =
  event.target as HTMLElement

  if (
    target.closest(
      '.annotation-delete',
    )
  ) {
    return
  }

  event.preventDefault()

  const element =
  event.currentTarget as HTMLElement

  element.setPointerCapture(
    event.pointerId,
  )

  draggingAnnotationId.value =
    annotation.id

  startPointerX =
    event.clientX

  startPointerY =
    event.clientY

  startOffsetX =
    annotation
      .$annotation
      .offsetX

  startOffsetY =
    annotation
      .$annotation
      .offsetY

  hasMoved = false
}

function onAnnotationPointerMove(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const deltaX =
    event.clientX
    - startPointerX

  const deltaY =
    event.clientY
    - startPointerY

  if (
    Math.abs(deltaX) > 3
    || Math.abs(deltaY) > 3
  ) {
    hasMoved = true
  }

  if (!hasMoved) {
    return
  }

  const fontSize =
    getContentFontSize()

  annotation
    .$annotation
    .offsetX =
      startOffsetX
      + deltaX
      / fontSize

  annotation
    .$annotation
    .offsetY =
      startOffsetY
      + deltaY
      / fontSize
}

function onAnnotationPointerCancel(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const element =
  event.currentTarget as HTMLElement

  if (
    element.hasPointerCapture(
      event.pointerId,
    )
  ) {
    element.releasePointerCapture(
      event.pointerId,
    )
  }

  draggingAnnotationId.value =
    null
}

function onAnnotationPointerUp(
  event: PointerEvent,
  annotation: Annotation,
) {
  if (
    draggingAnnotationId.value
    !== annotation.id
  ) {
    return
  }

  const element =
    event.currentTarget as HTMLElement

  if (
    element.hasPointerCapture(
      event.pointerId,
    )
  ) {
    element.releasePointerCapture(
      event.pointerId,
    )
  }

  draggingAnnotationId.value =
    null

  if (!hasMoved) {
    openAnnotationProperties(
      annotation,
    )
  }
}

function openAnnotationProperties(
  annotation: Annotation,
) {
  selectedAnnotation.value =
    annotation

  annotationPropertiesVisible.value =
    true
}

function deleteAnnotation(
  annotation: Annotation,
) {
  if (
    line.value.annotations
    === undefined
  ) {
    return
  }

  const index =
    line
      .value
      .annotations
      .findIndex(
        item =>
          item.id
          === annotation.id,
      )

  if (
    index === -1
  ) {
    return
  }

  line.value.annotations.splice(
    index,
    1,
  )

  if (
    selectedAnnotation
      .value
      ?.id
    === annotation.id
  ) {
    selectedAnnotation.value =
      null

    annotationPropertiesVisible.value =
      false
  }
}
</script>

<template>
  <div
    ref="content"
    v-bind="$attrs"
    class="relative content bg-white flex gap-10 flex-row"
    :class="{
      'bus-map': isBusMode,
    }"
    :style="{
      minHeight:
        `${line.mapSize}em`,
      paddingInline:
        `${Math.max(0, Number(line.mapSize) - 15) / 2}em`,
    }"
  >
    <!--
      ======================================================
      BANDEAU BUS / BRT / NOCTILIEN
      ======================================================
    -->
    <div
      v-if="isBusMode"
      class="bus-header"
    >
      <!--
        Pictogramme du moyen de transport.

        Affiché uniquement pour :
        - Téléphérique
        - Vélo
        - Navette fluviale

        Le Bus conserve son bandeau sans ce bloc.
      -->
      <div
        v-if="showTransportModePictogram"
        class="bus-mode-box"
      >
        <Mode :mode="line.mode" />
      </div>

      <!--
        Indice de ligne.
      -->
      <div
        class="bus-index-box"
        :style="busIndexStyle"
      >
        {{ busIndexText }}
      </div>

      <!--
        Accessibilité.

        Le bloc reste présent uniquement
        lorsque la ligne est accessible.
      -->
      <div
        v-if="line.fullyAccessible"
        class="bus-accessibility-box"
      >
        <Wheelchair />
      </div>

      <!--
        Destinations.
      -->
      <div
        class="bus-destinations-box"
      >
        <template
          v-if="
            busDestinations.length > 0
          "
        >
          <template
            v-for="(
              destination,
              index
            ) in busDestinations"
            :key="
              `${destination}-${index}`
            "
          >
            <span
              v-if="index > 0"
              class="bus-destination-arrow"
            >
              ↔
            </span>

            <span
              class="bus-destination-name"
            >
              {{ destination }}
            </span>
          </template>
        </template>

        <span
          v-else
          class="
            bus-destination-placeholder
            export-hide
          "
        >
          Destinations
        </span>
      </div>
    </div>

    <!--
      ======================================================
      IDENTITÉ TRAMWAY
      ======================================================

      Le Tram conserve exactement la ligne et la topologie
      existantes.

      Seul le panneau d'identité situé à gauche est adapté
      au style des plans Tramway Île-de-France.
    -->
    <div
      v-if="isTramMode"
      class="tram-identity-panel"
    >
      <!--
        ====================================================
        EN-TÊTE ÎLE-DE-FRANCE MOBILITÉS
        ====================================================

        Ce bloc reproduit uniquement l'identité visuelle
        du panneau de référence.

        Il ne touche absolument pas à la ligne du plan.
      -->
      <div class="tram-idfm-header">
        <div class="tram-idfm-wordmark">
          <span class="tram-idfm-main">
            Île-de-France
          </span>

          <span class="tram-idfm-sub">
            mobilités
          </span>
        </div>

        <div class="tram-idfm-logo-mark">
          <i class="i-tabler-accessible" />
        </div>
      </div>

      <!--
        ====================================================
        IDENTITÉ DE LA LIGNE
        ====================================================

        IMPORTANT :
        on affiche UNIQUEMENT le LineIndex Tram natif.

        Le SVG tram_T*.svg contient déjà l'identité
        graphique Tram + l'indice de la ligne.

        On ne rajoute donc plus <Mode> à côté :
        c'était lui qui provoquait le Tram en double.

        L'indice reste totalement dynamique :
        T1, T3a, T7, T14, etc.
      -->
        <div class="tram-identity-body">
          <div class="tram-mode-index">
            <div class="tram-mode">
              <Mode :mode="line.mode" />
            </div>

            <div class="tram-native-index">
              <LineIndex
                :mode="line.mode"
                :index="line.index"
              />
            </div>
          </div>
        </div>

        <div class="flex-grow" />

        <div
          class="
            tram-project-info
            text-[var(--blue-ratp-paper)]
          "
        >
          <div class="flex flex-row gap-.5">
            <span>CLU •</span>

          <span v-if="presetBased">
            PBP •
          </span>

          <span>
            {{ outdated ? 'PVU' : 'PVS' }} •
          </span>

          <span>{{ date }} •</span>

          <span>V{{ applicationVersion }}</span>
        </div>
      </div>
    </div>

    <!--
      ======================================================
      IDENTITÉ CLASSIQUE BULB
      ======================================================

      Conservée pour tous les modes qui n'utilisent
      ni le bandeau Bus, ni le panneau Tramway.
    -->
    <div
      v-if="!isBusMode && !isTramMode"
      class="
        line-identity-panel
        ml-3
        flex
        flex-col
        min-w-fit
        gap-3
      "
    >
      <div
        class="
          w-full
          h-8
          bg-[var(--blue-ratp-paper)]
        "
      />

      <div
        class="
          classic-line-identities
          w-full
          flex
          flex-col
          gap-3
          justify-center
          items-center
          text-4em
        "
      >
        <div
          v-for="
            group
            in planLineModeGroups
          "
          :key="group.mode"
          class="classic-line-mode-group"
        >
          <Mode
            :mode="group.mode"
          />

          <div
            class="classic-line-indices"
          >
            <LineIndex
              v-for="
                identity
                in group.identities
              "
              :key="identity.key"
              :mode="identity.mode"
              :index="identity.index"
            />
          </div>
        </div>
      </div>

      <div
        v-if="line.fullyAccessible"
        class="
          w-full
          flex
          flex-row
          gap-3
          justify-center
          items-center
          bg-[var(--blue-ratp-paper-secondary)]/50
          mt-.5em
          py-3
          text-1.75em
        "
      >
        <Wheelchair />
      </div>

      <div class="flex-grow" />

<div
  class="
    text-.25em
    flex
    flex-col
    line-height-1.75
    text-[var(--blue-ratp-paper)]
    mb-3
  "
>
  <div
    class="
      flex
      flex-row
      gap-.5
    "
  >
    <span>
      CLU ° Créateur de lignes urbaines ° {{ date }}
    </span>
  </div>
</div>
    </div>

    <!--
      ======================================================
      TOPOLOGIE
      ======================================================
    -->
    <SectionsGroup
      v-model="line.topology"
      class="
        sections-group
        w-max-content
        min-h-15em
        p-1em
        pt-20
        pr-10em
      "
    />

    <!--
      ======================================================
      ANNOTATIONS LIBRES
      ======================================================
    -->
    <div
      class="annotations-layer"
    >
      <div
        v-for="
          annotation in annotations
        "
        :key="annotation.id"
        class="free-annotation"
        :class="{
          dragging:
            draggingAnnotationId
            === annotation.id,
        }"
        :style="
          annotationPositionStyle(
            annotation,
          )
        "
        @pointerdown="
          event =>
            onAnnotationPointerDown(
              event,
              annotation,
            )
        "
        @pointermove="
          event =>
            onAnnotationPointerMove(
              event,
              annotation,
            )
        "
        @pointerup="
          event =>
            onAnnotationPointerUp(
              event,
              annotation,
            )
        "
        @pointercancel="
          event =>
            onAnnotationPointerCancel(
              event,
              annotation,
            )
        "
      >
        <span
          class="annotation-text"
          :style="
            annotationTextStyle(
              annotation,
            )
          "
        >
          {{
            annotation
              .$annotation
              .text
          }}
        </span>

        <button
          type="button"
          class="annotation-delete"
          title="Supprimer l'annotation"
          @pointerdown.stop
          @click.stop="
            deleteAnnotation(
              annotation,
            )
          "
        >
          <i
            class="i-tabler-trash"
          />
        </button>
      </div>
    </div>

    <!--
      ======================================================
      MENTIONS LÉGALES
      ======================================================
    -->
    <div
      v-if="!isBusMode"
      class="
        mr-3
        my-3
        rotate-180
        text-[var(--blue-ratp-paper)]
        text-.125em
        opacity-50
      "
    >
      <div
        class="
          legal-notice
          flex
          flex-col
          line-height-1
        "
      >
        <span>
          Non affilié à la RATP, à Île-de-France Mobilités ou à toute autre société. Les pictogrammes ainsi que les polices utilisés demeurent la propriété intellectuelle exclusive des entités susmentionnées.
        </span>

        <span
          class="italic text-.75em"
        >
          Not affiliated with RATP, Île-de-France Mobilités or any other company. The pictograms and fonts used remain the exclusive intellectual property of the aforementioned entities.
        </span>
      </div>
    </div>

    <AnnotationPropertiesDialog
      v-if="selectedAnnotation"
      v-model:visible="
        annotationPropertiesVisible
      "
      v-model="
        selectedAnnotation
      "
    />
  </div>
</template>

<style scoped lang="scss">
.content {
  position: relative;

  font-size: var(--font-size);
  font-family:
    'Parisine Ptf',
    sans-serif;

  outline:
    1px
    solid
    var(--p-gray-200);

  box-sizing: content-box;

  overflow: hidden;

  min-width: max-content;
}

/*
 * =========================================================
 * PLAN BUS
 * =========================================================
 */

.content.bus-map {
  /*
   * Espace réservé au bandeau.
   *
   * Beaucoup plus compact que la
   * première version.
   */
  padding-top: 3.35em;

  /*
   * Le plan Bus n'a plus le panneau
   * vertical historique à gauche.
   */
  gap: 0;
}

/*
 * =========================================================
 * BANDEAU BUS
 * =========================================================
 */

.bus-header {
  position: absolute;

  top: 0;
  left: 0;
  right: 0;

  z-index: 15;

  display: flex;
  flex-direction: row;
  align-items: stretch;

  /*
   * Petit espace blanc entre les blocs,
   * comme sur la référence.
   */
  gap: .2em;

  height: 2.65em;

  padding:
    .2em
    .25em;

  box-sizing: border-box;

  /*
   * La référence possède un fond clair
   * derrière les trois blocs.
   */
  background-color: white;

  overflow: hidden;
}

/*
 * =========================================================
 * PICTOGRAMME DU MODE
 * =========================================================
 */

.bus-mode-box {
  width: 2.4em;
  height: 100%;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  padding: .35em;

  background-color: white;

  border:
    1px
    solid
    rgb(0 0 0 / 12%);

  border-radius: .32em;

  font-size: 1.15em;

  overflow: hidden;
}

.bus-mode-box :deep(svg),
.bus-mode-box :deep(img) {
  max-width: 100%;
  max-height: 100%;
}

/*
 * =========================================================
 * CARTOUCHE INDICE
 * =========================================================
 */

.bus-index-box {
  /*
   * Dimensions proches du cartouche
   * carré / rectangulaire des plans Bus.
   */
  min-width: 4em;
  height: 100%;

  padding:
    0
    .75em;

  display: flex;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  border-radius: .32em;

  flex-shrink: 0;

  white-space: nowrap;

  /*
   * Le texte est volontairement plus
   * lourd que les destinations.
   */
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 1.25em;
  font-weight: 800;

  line-height: 1;

  letter-spacing: -.02em;
}

/*
 * =========================================================
 * ACCESSIBILITÉ
 * =========================================================
 */

.bus-accessibility-box {
  width: 2.4em;
  height: 100%;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  /*
   * Bleu accessibilité séparé du bandeau
   * destinations.
   */
  background-color: #1475b8;

  color: white;

  border-radius: .05em;

  font-size: 1.2em;

  line-height: 1;
}

/*
 * =========================================================
 * DESTINATIONS
 * =========================================================
 */

.bus-destinations-box {
  /*
   * Occupe tout l'espace restant.
   */
  flex: 1 1 auto;

  min-width: 20em;
  height: 100%;

  display: flex;
  flex-direction: row;
  align-items: center;

  gap: .18em;

  padding:
    0
    1em;

  box-sizing: border-box;

  /*
   * Bleu nuit très sombre,
   * proche du bandeau de référence.
   */
  background-color: #1d3142;

  color: white;

  /*
   * Le bord est quasiment droit
   * sur le plan de référence.
   */
  border-radius: .03em;

  overflow: hidden;

  white-space: nowrap;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 1.02em;

  line-height: 1;
}

.bus-destination-name {
  display: block;

  flex-shrink: 0;

  font-weight: 600;

  /*
   * Le texte du vrai bandeau est
   * moins massif que notre première version.
   */
  letter-spacing: -.01em;
}

.bus-destination-arrow {
  display: block;

  flex-shrink: 0;

  margin:
    0
    .15em;

  font-size: 1.25em;
  font-weight: 400;

  /*
   * Gris légèrement plus clair que
   * le texte des destinations.
   */
  color: rgb(255 255 255 / 78%);
}

.bus-destination-placeholder {
  font-weight: 400;

  opacity: .45;
}

/*
 * =========================================================
 * TOPOLOGIE EN MODE BUS
 * =========================================================
 */

.bus-map .sections-group {
  /*
   * Comme le panneau latéral BULB
   * disparaît, on remet simplement
   * une petite marge à gauche.
   */
  margin-left: 1em;

  /*
   * Le padding supérieur natif du
   * SectionsGroup reste conservé pour
   * laisser la place aux noms inclinés.
   */
}

/*
 * =========================================================
 * ANNOTATIONS
 * =========================================================
 */

.annotations-layer {
  position: absolute;

  inset: 0;

  z-index: 20;

  pointer-events: none;
}

.free-annotation {
  position: absolute;

  width: max-content;

  line-height: 1.1;

  white-space: pre-wrap;

  pointer-events: auto;

  user-select: none;

  cursor: grab;

  touch-action: none;

  padding: .15em;

  border-radius: .15em;

  outline:
    1px
    dashed
    transparent;

  transition:
    outline-color
    .15s
    ease,

    background-color
    .15s
    ease;

  &:hover {
    outline-color:
      rgb(
        0
        0
        0
        / 20%
      );

    background-color:
      rgb(
        255
        255
        255
        / 70%
      );

    .annotation-delete {
      opacity: 1;

      pointer-events: auto;
    }
  }

  &.dragging {
    cursor: grabbing;

    outline-color:
      rgb(
        0
        0
        0
        / 35%
      );

    .annotation-delete {
      opacity: 0;

      pointer-events: none;
    }
  }
}

.annotation-text {
  display: block;

  width: max-content;

  max-width: 30em;

  line-height: 1.1;

  white-space: pre-wrap;

  pointer-events: none;
}

.annotation-delete {
  position: absolute;

  top: -.8rem;
  right: -.8rem;

  width: 1.35rem;
  height: 1.35rem;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border:
    1px
    solid
    var(--p-slate-300);

  border-radius: 50%;

  background-color: white;

  color:
    var(--p-red-500);

  font-size: .8rem;

  cursor: pointer;

  opacity: 0;

  pointer-events: none;

  transition:
    opacity
    .15s
    ease,

    transform
    .15s
    ease;

  &:hover {
    transform:
      scale(1.1);
  }
}

/*
 * =========================================================
 * PANNEAU D'IDENTITÉ TRAMWAY
 * =========================================================
 *
 * Ce panneau n'agit ni sur SectionsGroup, ni sur Branch,
 * ni sur les arrêts, ni sur la ligne du plan.
 */

.tram-identity-panel {
  width: 8.5em;
  min-width: 8.5em;
  min-height: inherit;

  flex-shrink: 0;

  display: flex;
  flex-direction: column;

  background-color: white;

  border-right:
    1px
    solid
    rgb(0 0 0 / 18%);

  box-sizing: border-box;
}

/*
 * =========================================================
 * EN-TÊTE ÎLE-DE-FRANCE MOBILITÉS
 * =========================================================
 */

.tram-idfm-header {
  width: 100%;
  height: 3.15em;

  flex-shrink: 0;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: .28em;

  box-sizing: border-box;

  padding:
    .48em
    .48em;

  background-color: #1d3142;

  color: white;
}

.tram-idfm-wordmark {
  display: flex;
  flex-direction: column;

  align-items: flex-end;
  justify-content: center;

  line-height: .82;

  white-space: nowrap;
}

.tram-idfm-main {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: .83em;
  font-weight: 800;

  letter-spacing: -.055em;

  color: #59b9e8;
}

.tram-idfm-sub {
  margin-top: .14em;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: .43em;
  font-weight: 700;

  letter-spacing: -.02em;

  color: white;
}

.tram-idfm-logo-mark {
  width: 1.45em;
  height: 1.45em;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: .25em;

  background-color: #59b9e8;

  color: white;

  font-size: .82em;
}

.tram-idfm-logo-mark > i {
  display: block;

  width: 1.05em;
  height: 1.05em;
}

/*
 * =========================================================
 * IDENTITÉ DE LA LIGNE TRAM
 * =========================================================
 *
 * Le LineIndex Tram natif contient déjà le dessin complet
 * de l'identité de ligne.
 *
 * On ne fabrique donc plus un deuxième Tram autour.
 */

.tram-identity-body {
  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  width: 100%;

  flex: 1 1 auto;

  padding:
    1em
    .72em;

  box-sizing: border-box;
}

.tram-mode-index {
  width: 100%;

  display: flex;
  flex-direction: row;

  align-items: center;
  justify-content: center;

  gap: .7em;
}

.tram-mode {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 2.2em;

  line-height: 1;

  flex-shrink: 0;
}

.tram-mode :deep(svg),
.tram-mode :deep(img) {
  display: block;

  max-width: 1em;
  max-height: 1em;
}

.tram-native-index {
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 1em;

  line-height: 1;

  margin-left: -2.45em;
}

.tram-native-index :deep(> div) {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 100%;
}

.tram-native-index :deep(img),
.tram-native-index :deep(svg) {
  display: block;

  width: 2.2em;
  height: 2.2em;

  max-width: none;
  max-height: none;

  object-fit: contain;
}

.tram-project-info {
  margin: 0 .65em .65em;
  font-size: .25em;
  line-height: 1.75;
}

.classic-line-identities {
  flex-wrap: nowrap;
}

.classic-line-mode-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: .3em;

  flex-shrink: 0;
}

.classic-line-indices {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  gap: .18em;

  flex-wrap: wrap;
}

.classic-line-mode-group :deep(svg),
.classic-line-mode-group :deep(img) {
  display: block;
}

.legal-notice {
  writing-mode: vertical-rl;
}
</style>