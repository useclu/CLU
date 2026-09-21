import type {
  GameScenarioDefinition,
} from '../types/objectives'

export const DEFAULT_GAME_SCENARIO_ID = 'FREE_NETWORK'
export const GAME_MAX_ACTIVE_OBJECTIVES = 3
export const GAME_MIN_ACTIVE_OBJECTIVES = 2
/** V43 : historique recent conserve dans la sauvegarde ; le total cumule reste separe. */
export const GAME_OBJECTIVE_HISTORY_LIMIT = 500

/**
 * Le scénario libre ne se termine jamais. Les objectifs actifs sont générés
 * à partir du réseau et servent de fil conducteur quotidien.
 */
export const GAME_SCENARIOS: GameScenarioDefinition[] = [
  {
    id: DEFAULT_GAME_SCENARIO_ID,
    label: 'Partie libre',
    title: 'Exploitation continue',
    description: 'Objectifs facultatifs et renouvelables. Les objectifs inachevés restent disponibles et les réussites financent le développement du réseau.',
    objectives: [],
  },
]

export function getGameScenarioDefinition(scenarioId: string) {
  return GAME_SCENARIOS.find(scenario => scenario.id === scenarioId)
    ?? GAME_SCENARIOS[0]
}
