import type { GameEventDefinition } from '../types/events'

export const GAME_EVENT_DECISION_DAYS = 4
export const GAME_EVENT_MIN_INTERVAL_DAYS = 7
export const GAME_EVENT_MAX_INTERVAL_DAYS = 13
export const GAME_EVENT_HISTORY_LIMIT = 30
export const GAME_EVENT_RECENT_DEFINITION_COOLDOWN = 3

/**
 * Gros Lot 12 : les événements privilégient le contexte réel du réseau.
 * Un réseau sain reçoit surtout des opportunités ; les alertes d'exploitation
 * apparaissent quand les indicateurs correspondants existent réellement.
 */
export const GAME_EVENT_DEFINITIONS: GameEventDefinition[] = [
  {
    id: 'PEAK_DEMAND', eyebrow: 'Exploitation', title: 'Affluence exceptionnelle',
    description: 'Plusieurs pôles du réseau annoncent une hausse temporaire des déplacements. Vous pouvez renforcer l’offre ou conserver le service actuel.',
    minDay: 2, minOperationalLines: 1, minPassengers: 3_000,
    choices: [
      { id: 'BOOST_SERVICE', label: 'Renforcer le service', description: '+18 % de demande et +12 % de coûts d’exploitation pendant 3 jours.', effects: [
        { kind: 'DEMAND_MULTIPLIER', multiplier: 1.18, durationDays: 3, label: 'Affluence renforcée' },
        { kind: 'OPERATING_COST_MULTIPLIER', multiplier: 1.12, durationDays: 3, label: 'Service renforcé' },
      ] },
      { id: 'KEEP_SERVICE', label: 'Maintenir le service', description: 'Aucun surcoût, mais la demande captée baisse de 8 % pendant 3 jours.', effects: [
        { kind: 'DEMAND_MULTIPLIER', multiplier: 0.92, durationDays: 3, label: 'Capacité inchangée' },
      ] },
    ],
  },
  {
    id: 'ENERGY_PRESSURE', eyebrow: 'Conjoncture', title: 'Tension sur les coûts de l’énergie',
    description: 'Les coûts énergétiques augmentent temporairement. Un plan d’économie peut limiter l’impact mais demande un investissement immédiat.',
    minDay: 4, minOperationalLines: 1,
    choices: [
      { id: 'ABSORB', label: 'Absorber la hausse', description: '+12 % de coûts d’exploitation pendant 4 jours, sans dépense immédiate.', effects: [
        { kind: 'OPERATING_COST_MULTIPLIER', multiplier: 1.12, durationDays: 4, label: 'Énergie plus chère' },
      ] },
      { id: 'EFFICIENCY_PLAN', label: 'Lancer un plan d’économie', description: 'Coût immédiat de 8 M€, puis seulement +4 % de coûts d’exploitation pendant 4 jours.', effects: [
        { kind: 'BALANCE', amount: -8_000_000 },
        { kind: 'OPERATING_COST_MULTIPLIER', multiplier: 1.04, durationDays: 4, label: 'Plan d’économie énergétique' },
      ] },
    ],
  },
  {
    id: 'MOBILITY_FUND', eyebrow: 'Opportunité publique', title: 'Fonds exceptionnel pour la mobilité',
    description: 'Les résultats récents du réseau rendent votre dossier éligible à une enveloppe publique temporaire.',
    minDay: 5, minOperationalLines: 2, minServiceQualityScore: 72,
    choices: [
      { id: 'APPLY', label: 'Déposer un dossier', description: '4 M€ de frais d’étude puis 22 M€ d’aide immédiate, soit +18 M€ nets.', effects: [{ kind: 'BALANCE', amount: 18_000_000 }] },
      { id: 'DECLINE', label: 'Ne pas candidater', description: 'Aucun effet. Vous conservez votre trajectoire financière actuelle.', effects: [] },
    ],
  },
  {
    id: 'FARE_EXPERIMENT', eyebrow: 'Voyageurs', title: 'Expérimentation tarifaire',
    description: 'Une expérimentation temporaire peut augmenter l’usage du réseau au prix d’une recette moyenne plus faible.',
    minDay: 6, minOperationalLines: 1, minDemandSatisfactionRate: 0.72,
    choices: [
      { id: 'LOWER_FARES', label: 'Tester le tarif réduit', description: '+14 % de demande mais −12 % de recettes par voyageur pendant 4 jours.', effects: [
        { kind: 'DEMAND_MULTIPLIER', multiplier: 1.14, durationDays: 4, label: 'Tarif réduit' },
        { kind: 'REVENUE_MULTIPLIER', multiplier: 0.88, durationDays: 4, label: 'Recette moyenne réduite' },
      ] },
      { id: 'KEEP_FARES', label: 'Conserver les tarifs', description: 'Aucun changement temporaire de fréquentation ou de recettes.', effects: [] },
    ],
  },
  {
    id: 'DEBT_SUPPORT', eyebrow: 'Finances', title: 'Facilité de trésorerie',
    description: 'Votre budget est négatif. Une facilité exceptionnelle peut redonner de l’air au réseau.',
    minDay: 3, minOperationalLines: 1, maxBalance: -1,
    choices: [
      { id: 'ACCEPT_SUPPORT', label: 'Accepter le soutien', description: '+30 M€ immédiatement.', effects: [{ kind: 'BALANCE', amount: 30_000_000 }] },
      { id: 'STAY_INDEPENDENT', label: 'Continuer sans aide', description: 'Aucun effet immédiat. Le budget peut rester négatif.', effects: [] },
    ],
  },
  {
    id: 'CAPACITY_RECOVERY', eyebrow: 'Exploitation', title: 'Plan de désaturation proposé',
    description: 'La demande est mal absorbée et des stations sont sous pression. Une enveloppe d’urgence peut financer un renfort temporaire.',
    minDay: 5, minOperationalLines: 1, maxDemandSatisfactionRate: 0.78,
    choices: [
      { id: 'EMERGENCY_PLAN', label: 'Activer le plan de renfort', description: '+10 M€ d’aide, +8 % de coûts mais +10 % de demande captée pendant 3 jours.', effects: [
        { kind: 'BALANCE', amount: 10_000_000 },
        { kind: 'OPERATING_COST_MULTIPLIER', multiplier: 1.08, durationDays: 3, label: 'Plan de renfort' },
        { kind: 'DEMAND_MULTIPLIER', multiplier: 1.10, durationDays: 3, label: 'Capacité mieux valorisée' },
      ] },
      { id: 'HANDLE_LOCALLY', label: 'Gérer avec les moyens actuels', description: 'Pas d’aide ni de surcoût automatique. Vous gardez la main sur les lignes concernées.', effects: [] },
    ],
  },
  {
    id: 'STATION_CROWDING', eyebrow: 'Stations', title: 'Pôles sous forte pression',
    description: 'Plusieurs stations dépassent leur capacité de confort. Une campagne de gestion des flux est proposée.',
    minDay: 6, minOperationalLines: 1, minCongestedStations: 2,
    choices: [
      { id: 'FLOW_PLAN', label: 'Financer la gestion des flux', description: '6 M€ immédiatement et −5 % de demande pendant 2 jours, le temps d’absorber le pic.', effects: [
        { kind: 'BALANCE', amount: -6_000_000 },
        { kind: 'DEMAND_MULTIPLIER', multiplier: 0.95, durationDays: 2, label: 'Gestion temporaire des flux' },
      ] },
      { id: 'NO_PLAN', label: 'Ne rien centraliser', description: 'Aucun effet automatique. Les stations restent à traiter directement dans le réseau.', effects: [] },
    ],
  },
  {
    id: 'RELIABILITY_BONUS', eyebrow: 'Bonne nouvelle', title: 'Prime de qualité de service',
    description: 'La qualité de service et la demande transportée sont durablement solides. Une prime publique récompense la performance du réseau.',
    minDay: 8, minOperationalLines: 2, minServiceQualityScore: 84, minDemandSatisfactionRate: 0.94, requirePositiveOperatingResult: true,
    choices: [
      { id: 'REINVEST', label: 'Réinvestir dans le réseau', description: '+16 M€ immédiatement et +4 % de demande pendant 3 jours grâce à la campagne de confiance.', effects: [
        { kind: 'BALANCE', amount: 16_000_000 },
        { kind: 'DEMAND_MULTIPLIER', multiplier: 1.04, durationDays: 3, label: 'Confiance renforcée' },
      ] },
      { id: 'TAKE_GRANT', label: 'Encaisser la prime', description: '+12 M€ immédiatement, sans modifier la demande.', effects: [{ kind: 'BALANCE', amount: 12_000_000 }] },
    ],
  },
  {
    id: 'DEBT_RESTRUCTURE', eyebrow: 'Finances', title: 'Accompagnement de la dette',
    description: 'L’endettement devient significatif. Les financeurs proposent un soutien ponctuel en échange d’un effort d’exploitation.',
    minDay: 10, minOperationalLines: 2, minDebtPrincipal: 500_000_000,
    choices: [
      { id: 'SUPPORT', label: 'Accepter l’accompagnement', description: '+20 M€ immédiatement, mais +5 % de coûts d’exploitation pendant 4 jours.', effects: [
        { kind: 'BALANCE', amount: 20_000_000 },
        { kind: 'OPERATING_COST_MULTIPLIER', multiplier: 1.05, durationDays: 4, label: 'Plan d’accompagnement financier' },
      ] },
      { id: 'DECLINE_SUPPORT', label: 'Refuser', description: 'Aucun effet. Vous conservez votre trajectoire actuelle.', effects: [] },
    ],
  },
]
