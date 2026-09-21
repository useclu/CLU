export type GameHelpCategory =
  | 'PRISE_EN_MAIN'
  | 'RESEAU'
  | 'EXPLOITATION'
  | 'FINANCES'
  | 'TERRITOIRE'
  | 'PROGRESSION'
  | 'DEFIS'
  | 'SAUVEGARDES'

export interface GameWikiArticle {
  id: string
  category: GameHelpCategory
  title: string
  summary: string
  keywords: string[]
  paragraphs: string[]
  bullets?: string[]
  related?: string[]
}

export interface GameTutorialProgress {
  active: boolean
  completed: boolean
  stepIndex: number
  baselineDay: number
  baselineLineCount: number
  startedAt: string | null
  updatedAt: string | null
}
