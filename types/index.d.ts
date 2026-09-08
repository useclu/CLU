import type { ComputedRef, Ref } from 'vue'

declare global {

  type Mode =
    'BOAT'
    | 'BRT'
    | 'BUS'
    | 'CABLE'
    | 'METRO'
    | 'NOCTILIEN'
    | 'RER'
    | 'TRAIN'
    | 'TRAIN_RER'
    | 'TRAM'
    | 'VELO'

  type Service =
    'FUNICULAR'
    | 'MAIN_STATION'
    | 'BULLET_TRAIN'
    | 'SUBURBAN_TRAIN'
    | 'TGV'
    | 'TER'
    | 'LONG_DISTANCE_BUS'
    | 'AIRPORT'
    | 'ROISSY_BUS'
    | 'ORLY_BUS'
    | 'CDGVAL'
    | 'ORLYVAL'
    | 'ORLYVAL_LARGE'
    | 'ORLYVAL_LARGE_2'
    | 'CDG_EXPRESS'

  type BusLine =
    'tzen1'
    | 'tzen2'
    | 'tzen3'
    | 'tzen4'
    | 'tzen5'
    | 'tzen6'
    | 'tvm'
    | '393'
    | string

  type CableLine =
    '1'
    | string

  type MetroLine =
    '1'
    | '2'
    | '3'
    | '3bis'
    | '4'
    | '5'
    | '6'
    | '7'
    | '7bis'
    | '8'
    | '9'
    | '10'
    | '11'
    | '12'
    | '13'
    | '14'
    | '15'
    | '16'
    | '17'
    | '18'
    | string

  type RerLine =
    'A'
    | 'B'
    | 'C'
    | 'D'
    | 'E'
    | string

  type TrainLine =
    'H'
    | 'J'
    | 'K'
    | 'L'
    | 'N'
    | 'P'
    | 'R'
    | 'U'
    | 'V'
    | string

  type TramLine =
    '1'
    | '2'
    | '3a'
    | '3b'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '11'
    | '12'
    | '13'
    | '14'
    | string

  type IndexShape =
    'CIRCLE'
    | 'ROUNDED_SQUARE'
    | 'LINES'
    | 'RECTANGLE'
    | 'CUT_RECTANGLE'

  interface ColorChoice {
    value: string
    label: string
  }

  interface ModeChoice {
    value: Mode
    label: string
  }

  interface IndexChoice<I extends LineIndex> {
    value: I
    label: string
    color?: string
  }

  interface ServiceChoice {
    value: Service
    label: string
  }

  interface AirportChoice {
    value: Airport
    label: string
  }

  interface ShapeChoice {
    value: IndexShape
    label: string
  }

  interface CustomLineIndexDescription {
    id: string
    index: string
    prefix?: string
    suffix?: string
    shape: IndexShape
    mode: Mode
    color: string
  }

  interface Project {
    version: string
    presetBased: boolean
    line: Line
    customIndices: CustomLineIndexDescription[]
  }

  /* ///////////// LINE ///////////// */

  type OrnamentType =
    'AIRPORT'
    | 'AIRPORT_NAME'
    | 'TEXT'

  type OrnamentPosition =
    'RIGHT'
    | 'BOTTOM'

  type Airport =
    'CDG'
    | 'ORY'
    | 'BOTH'
    | 'GENERIC'

  interface AirportOrnament {
    id: string
    position: OrnamentPosition
    $airportOrnament: {
      airport: Airport | null
    }
  }

  interface AirportNameOrnament {
    id: string
    position: 'RIGHT'
    $airportNameOrnament: {
      name: string
    }
  }

  interface TextOrnament {
    id: string
    position: OrnamentPosition
    $textOrnament: {
      text: string
    }
  }

  type Ornament =
    | AirportOrnament
    | AirportNameOrnament
    | TextOrnament

  type TransferMode =
    'WALK'
    | 'BIKE'
    | 'CAR'
    | 'BUS'
    | 'OTHER'

  interface TransferDetails {
    mode: TransferMode
    durationMinutes: number | null
    label?: string
  }

  /*
   * Logo personnalisé remplaçant visuellement
   * l'indice BULB d'une ligne précise.
   *
   * "image" contient l'image sous forme de Data URL.
   *
   * "imageSize" permet de régler sa taille
   * indépendamment des autres lignes.
   *
   * Ce logo appartient à un seul
   * ModeConnectionElement.
   */
  interface ConnectionLinePictogram {
    image: string
    imageSize: number
  }

  interface ModeConnectionElement {
    id: string
    $modeConnectionElement: {
      lineIndex: LineIndex | null
      walk: boolean
      transfer?: TransferDetails | null
      ornament: Ornament | null

      /*
       * Surcharge visuelle de l'indice de cette ligne.
       *
       * Si elle existe, le logo personnalisé remplace
       * l'affichage du LineIndex sur le plan.
       *
       * Si elle est absente ou null, BULB affiche
       * normalement le LineIndex sélectionné.
       *
       * Optionnel pour préserver la compatibilité
       * avec les anciens projets.
       */
      customPictogram?: ConnectionLinePictogram | null
    }
  }

  interface ServiceConnectionElement {
    id: string
    $serviceConnectionElement: {
      service: Service | null
      ornament: Ornament | null
    }
  }

  /*
   * Ancien système de logo / ligne personnalisée.
   *
   * Conservé temporairement pour permettre
   * l'ouverture des projets qui en contiennent
   * encore pendant la migration vers les logos
   * directement rattachés aux ModeConnectionElement.
   *
   * "mode" correspond au mode de transport.
   *
   * "image" contient le logo sous forme de Data URL.
   *
   * "imageSize" permet de régler sa taille.
   */
  interface CustomConnection {
    id: string
    mode: Mode
    label: string | null
    image: string
    imageSize: number
  }

  /*
   * Pictogramme personnalisé propre à une
   * correspondance précise.
   *
   * Il s'agit du pictogramme DU MODE,
   * et non de l'indice d'une ligne.
   *
   * L'image est enregistrée sous forme de Data URL
   * directement dans le projet.
   *
   * Si ce pictogramme n'existe pas, BULB utilise
   * automatiquement le pictogramme global du mode,
   * puis son pictogramme d'origine.
   */
  interface ConnectionModePictogram {
    image: string
  }

  interface ModeConnection {
    id: string
    $modeConnection: {
      mode: Mode | null
      elements: ModeConnectionElement[]
      walk: boolean
      transfer?: TransferDetails | null

      /*
       * Surcharge locale du pictogramme de transport
       * uniquement pour cette correspondance.
       *
       * Optionnel afin de conserver la compatibilité
       * avec tous les anciens projets.
       */
      customPictogram?: ConnectionModePictogram | null

      /*
       * Ancien système intermédiaire de lignes
       * et logos personnalisés.
       *
       * Conservé temporairement pendant la migration.
       *
       * Les nouvelles lignes personnalisées doivent
       * maintenant être représentées par un véritable
       * ModeConnectionElement possédant éventuellement
       * son propre customPictogram.
       */
      customConnections?: CustomConnection[]
    }
  }

  interface ServiceConnection {
    id: string
    $serviceConnection: {
      elements: ServiceConnectionElement[]
      walk: boolean
      transfer?: TransferDetails | null
    }
  }

  type Connection =
    | ModeConnection
    | ServiceConnection

  /*
   * Style personnalisé du nom d'un arrêt.
   *
   * "image" contient le logo ou l'image personnalisée
   * sous forme de Data URL.
   *
   * "imageSize" permet de régler sa taille d'affichage.
   *
   * nameStyle reste optionnel dans Stop afin de conserver
   * la compatibilité avec les anciens projets.
   */
  interface StopNameStyle {
    bold: boolean
    italic: boolean
    underline: boolean
    color: string | null
    image: string | null
    imageSize: number
  }

  interface Stop {
    id: string
    $stop: {
      name: string
      subtitle: string | null
      placeName: string | null
      accessible: boolean | 'undefined'
      preventSubtitleOverlapping: boolean
      interestPoint: boolean
      terminus: boolean
      closed: boolean
      future: boolean
      reverse: boolean

      /*
       * Affichage vertical spécifique de l'arrêt.
       *
       * Lorsqu'il est activé, le symbole classique
       * est remplacé par une capsule verticale.
       *
       * Optionnel afin que les anciens projets
       * conservent automatiquement l'affichage normal.
       */
      vertical?: boolean

      connections: Connection[]

      /*
       * Ancien emplacement des correspondances
       * personnalisées.
       *
       * Conservé pour la compatibilité avec les
       * projets créés avant leur intégration directe
       * dans ModeConnection.
       */
      customConnections?: CustomConnection[]

      nameStyle?: StopNameStyle
    }
  }

  interface Spacer {
    id: string
    $spacer: {
      size: number
    }
  }

  /*
   * Séparation verticale de ville / zone.
   *
   * Cet élément est indépendant d'un arrêt afin de pouvoir être placé
   * librement entre deux stations dans une branche.
   *
   * Exemple visuel :
   *
   *     NOM DE LA VILLE
   *         ZONE 5
   *           ⋮
   *           ⋮
   *           ⋮
   */
  interface AreaSeparator {
    id: string
    $areaSeparator: {
      cityName: string
      zoneName: string | null
      autoSpacing: boolean
      spacing: number
      height: number
    }
  }

  type BranchElement =
    | Stop
    | Spacer
    | AreaSeparator

  /*
   * Ligne supplémentaire affichée sur une branche.
   *
   * La ligne principale du projet reste stockée
   * dans Project.line afin de conserver le
   * fonctionnement historique de CLU.
   *
   * Une branche peut ainsi accueillir plusieurs
   * identités de lignes sans transformer tout le
   * projet en plusieurs Line indépendantes.
   *
   * "mode" indique le moyen de transport.
   *
   * "index" accepte aussi bien un indice natif
   * qu'un indice personnalisé créé dans CLU.
   *
   * "color" permet à cette ligne de conserver
   * sa propre couleur sur le tracé.
   */
  interface BranchAdditionalLine {
    id: string
    mode: Mode
    index: LineIndex | null
    color: string
  }

  interface Branch {
    id: string
    $branch: {
      elementSpacing: number
      marginLeft?: number
      marginRight?: number
      invertedElements: boolean
      elements: BranchElement[]

      /*
       * Lignes supplémentaires fusionnées avec
       * la ligne principale sur cette branche.
       *
       * Cette propriété reste optionnelle :
       * un ancien projet ne possédant pas
       * additionalLines continue donc de
       * fonctionner exactement comme avant.
       */
      additionalLines?: BranchAdditionalLine[]
    }
  }

  type ForkStyle =
    | 'ORIGINAL'
    | 'ROUNDED'

  interface Fork {
    id: string
    $fork: {
      toward: 'LEFT' | 'RIGHT'
      originOffset: number
      linksOffset: [number, number]
      offsetMultiplier?: number
      directionalArrows?: 'CW' | 'CCW'

      /*
       * Style visuel de la bifurcation.
       *
       * ORIGINAL = géométrie historique de BULB.
       * ROUNDED = bifurcation avec raccords à angles arrondis.
       *
       * Optionnel afin que les anciens projets utilisent
       * automatiquement le style ORIGINAL.
       */
      forkStyle?: ForkStyle
    }
  }

  /*
   * Segment vertical de ligne.
   *
   * Cet élément permet de faire passer le tracé
   * d'un niveau horizontal à un autre.
   *
   * levelChange :
   * - valeur négative = déplacement vers le haut
   * - valeur positive = déplacement vers le bas
   *
   * Exemple :
   *
   *   levelChange: -1
   *
   *   ─────────╮
   *            │
   *            ╰─────────
   *
   * Les anciennes propriétés "height" et "direction"
   * restent temporairement optionnelles pendant la
   * migration du prototype existant.
   */
  type VerticalSegmentDirection =
    | 'UP'
    | 'DOWN'
    | 'BOTH'

  type VerticalSegmentSide =
    | 'LEFT'
    | 'RIGHT'

  interface VerticalSegment {
    id: string
    $verticalSegment: {
      levelChange?: number

      /*
       * Côté sur lequel se trouve la partie verticale.
       *
       * LEFT = partie verticale côté gauche.
       * RIGHT = partie verticale côté droit.
       *
       * Optionnel afin que les anciens projets utilisent
       * automatiquement RIGHT.
       */
      side?: VerticalSegmentSide

      /*
       * Anciennes propriétés du prototype.
       * Elles seront supprimées une fois les composants
       * migrés vers levelChange.
       */
      height?: number
      direction?: VerticalSegmentDirection

      stop?: Stop
    }
  }

  interface ParallelBranches {
    id: string
    $parallelBranches: {
      alignement: 'FLUID' | 'LEFT' | 'RIGHT'
      sections: [LineSection, LineSection]
    }
  }

  interface Loop {
    id: string
    $loop: {
      toward: 'LEFT' | 'RIGHT'
      linksOffsets: [number, number]
      stop?: Stop
    }
  }

  type LineElement =
    | Branch
    | Fork
    | VerticalSegment
    | ParallelBranches
    | Loop

  interface LineSection {
    id: string
    $lineSection: {
      title?: string
      subtitle?: string
      levelOffset?: number
      elements: LineElement[]
    }
  }

  interface BuiltinLineIndex {
    mode: Mode
    $builtinLineIndex: {
      index: string
    }
  }

  interface CustomLineIndex {
    mode: Mode
    $customLineIndex: {
      id: string
    }
  }

  type LineIndex =
    | BuiltinLineIndex
    | CustomLineIndex

  type LineStyle =
    'PLAIN'
    | 'STRIPED'

  type DotsColorPolicy =
    'INHERIT'
    | 'WHITE'

  /*
   * Format graphique des noms de stations.
   *
   * RATP :
   * - noms bleus et gras ;
   * - terminus bleus et gras.
   *
   * SNCF :
   * - noms noirs et de graisse normale ;
   * - terminus noirs et gras.
   *
   * La propriété reste optionnelle dans Line
   * afin de préserver la compatibilité avec
   * les anciens projets.
   */
  type FormatStyle =
    | 'RATP'
    | 'SNCF'

  interface Line {
    mode: Mode | null
    index: LineIndex | null
    color: string | null
    lineThickness: string | null
    lineStyle: LineStyle | null
    dotsColorPolicy: DotsColorPolicy | null
    mapSize: number | null
    fullyAccessible: boolean
    frameTerminusNames: boolean
    formatStyle?: FormatStyle
    topology: LineSection[]
  }

  export interface LineContext {
    color: Ref<string>
    lineThickness: Ref<number>
    lineStyle: Ref<LineStyle>
    dotsColorPolicy: Ref<DotsColorPolicy>
    frameTerminusNames: Ref<boolean>
  }

  export interface StopContext {
    margins: {
      leftMargin: {
        name: string
        connections: string
      }
      rightMargin: {
        name: string
        subtitle: string
        connections: string
      }
    }
    namesWidth: ComputedRef<string>
    inverted: ComputedRef<boolean>
  }

  type ChangelogEntryType =
    'ADDED'
    | 'CHANGED'
    | 'FIXED'
    | 'REMOVED'

  interface ChangelogVersion {
    version: string
    date: string
    entries: Partial<Record<ChangelogEntryType, ChangelogEntry[]>>
  }

  type ChangelogEntry = {
    value: string
    details?: string[]
  } | string

  type Changelog = ChangelogVersion[]
}

export {}