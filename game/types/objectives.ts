export type GameObjectiveMetric =
  | 'OPERATIONAL_LINES'
  | 'STATIONS'
  | 'MUNICIPALITIES_SERVED'
  | 'POPULATION_SERVED'
  | 'DAILY_PASSENGERS'
  | 'TOTAL_PASSENGERS'
  | 'NETWORK_MORALE'
  | 'MAX_LINE_OCCUPANCY'
  | 'MAX_LOST_PASSENGERS'
  | 'MIN_FLEET_CONDITION'
  | 'MIN_LINE_REGULARITY'
  | 'DAILY_OPERATING_RESULT'
  | 'NEW_MUNICIPALITIES'

export type GameObjectiveDirection =
  | 'AT_LEAST'
  | 'AT_MOST'

export interface GameObjectiveDefinition {
  id: string
  metric: GameObjectiveMetric
  direction?: GameObjectiveDirection
  title: string
  description: string
  target: number
  reward: number
  generatedDay: number
  expiresDay: number | null
  lineId?: string
  baseline?: number
}

export interface GameScenarioDefinition {
  id: string
  label: string
  title: string
  description: string
  objectives: GameObjectiveDefinition[]
}

export interface GameObjectiveProgress {
  objectiveId: string
  value: number
  target: number
  ratio: number
  reached: boolean
}

export interface GameCompletedObjective {
  id: string
  title: string
  completedDay: number
  reward: number
}

export interface GameObjectivesState {
  scenarioId: string
  /** Compatibilité V8-V15. */
  completedObjectiveIds: string[]
  completedDay: number | null
  active: GameObjectiveDefinition[]
  completed: GameCompletedObjective[]
  /** Nombre cumule de reussites, independant de la fenetre d'historique. */
  totalCompleted: number
  totalRewards: number
  nextObjectiveSerial: number
}
