import type { GameRoastCategory, GameRoastIntensity, GameRoastReference } from '../../types/roast'

export interface GameRoastTemplate {
  id: string
  category: GameRoastCategory
  intensity: GameRoastIntensity
  reference: GameRoastReference
  title: string
  message: string
}

/**
 * Banque FR séparée du moteur : l'internationalisation pourra remplacer ce
 * dictionnaire sans toucher aux règles qui déclenchent un Roast.
 * Environ 60 % des variantes sont football, le reste culture générale/pop.
 */
export const GAME_ROAST_TEMPLATES_FR: GameRoastTemplate[] = [
  { id: 'sat-foot-1', category: 'SATURATION', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Tribunes complètes', message: '{line} affiche {occupancy}% de charge. À ce niveau-là, même un stade un soir de finale demande un plan de circulation.' },
  { id: 'sat-foot-2', category: 'SATURATION', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Guichets fermés', message: '{waiting} voyageurs attendent encore. On voulait une ligne de transport, pas une file pour une finale européenne.' },
  { id: 'sat-foot-3', category: 'SATURATION', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Le banc est plein', message: '{line} joue à onze dans une surface prévue pour six. Un petit renfort avant la prolongation ?' },
  { id: 'sat-pop-1', category: 'SATURATION', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Mode Tetris', message: '{line} est à {occupancy}% de charge. Encore deux voyageurs et le jeu commence à supprimer des rangées.' },
  { id: 'sat-pop-2', category: 'SATURATION', intensity: 'LIGHT', reference: 'CULTURE', title: 'Compression maximale', message: 'La foule sur {line} vient de découvrir qu’un mètre carré pouvait avoir plusieurs propriétaires.' },

  { id: 'def-foot-1', category: 'DEFICIT', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Fair-play financier', message: 'Résultat du jour : {result}. Le comptable vient de demander le règlement du fair-play financier.' },
  { id: 'def-foot-2', category: 'DEFICIT', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Mercato compliqué', message: '{result} sur la journée. Beaucoup de dépenses, peu de buts : le mercato a laissé des traces.' },
  { id: 'def-foot-3', category: 'DEFICIT', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Score à l’extérieur', message: 'Le réseau termine la journée à {result}. Même le tableau d’affichage hésite à le montrer.' },
  { id: 'def-pop-1', category: 'DEFICIT', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Mission presque impossible', message: '{result} aujourd’hui. La trésorerie vient de demander une doublure cascade.' },
  { id: 'def-pop-2', category: 'DEFICIT', intensity: 'LIGHT', reference: 'CULTURE', title: 'Calculatrice en sueur', message: 'Le résultat du jour est {result}. La calculatrice a demandé une pause syndicale.' },

  { id: 'debt-foot-1', category: 'DEBT', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Prolongation bancaire', message: '{debt} de dette. Le banquier vient d’ajouter quatre minutes de temps additionnel.' },
  { id: 'debt-foot-2', category: 'DEBT', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Mercato XXL', message: '{debt} de dette : le réseau a clairement signé tout le mercato sans regarder la masse salariale.' },
  { id: 'debt-foot-3', category: 'DEBT', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Carton jaune du banquier', message: 'Dette : {debt}. Rien d’irrécupérable, mais l’arbitre financier a déjà la main dans la poche.' },
  { id: 'debt-pop-1', category: 'DEBT', intensity: 'MEDIUM', reference: 'CULTURE', title: 'La montagne de chiffres', message: '{debt} de dette. Même un film catastrophe mettrait un panneau “à suivre”.' },
  { id: 'debt-pop-2', category: 'DEBT', intensity: 'LIGHT', reference: 'CULTURE', title: 'Mode difficile activé', message: 'Avec {debt} de dette, le tutoriel financier vient discrètement de quitter la pièce.' },

  { id: 'empty-foot-1', category: 'EMPTY_NETWORK', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Stade vide', message: '{stations} stations pour {passengers} voyageurs aujourd’hui. Belle enceinte, dommage pour l’affluence.' },
  { id: 'empty-foot-2', category: 'EMPTY_NETWORK', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Match à huis clos', message: 'Le réseau est superbe. Les voyageurs ont simplement oublié qu’ils étaient invités.' },
  { id: 'empty-foot-3', category: 'EMPTY_NETWORK', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Infrastructure de finale', message: '{stations} stations et seulement {passengers} voyageurs : tu as construit le stade avant de trouver l’équipe.' },
  { id: 'empty-pop-1', category: 'EMPTY_NETWORK', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Décor de cinéma', message: 'Le réseau ressemble à un blockbuster. Pour l’instant, les figurants n’ont pas reçu l’adresse.' },
  { id: 'empty-pop-2', category: 'EMPTY_NETWORK', intensity: 'LIGHT', reference: 'CULTURE', title: 'Très belle maquette', message: '{stations} stations, {passengers} voyageurs. On est à deux doigts d’un musée des transports.' },

  { id: 'fleet-foot-1', category: 'OVERFLEET', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Banc XXL', message: '{line} dispose de {vehicles} véhicules pour environ {required} nécessaires. Même un club avec cinq compétitions ne prend pas autant de remplaçants.' },
  { id: 'fleet-foot-2', category: 'OVERFLEET', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Effectif pléthorique', message: '{line} a tellement de réserve qu’on peut bientôt aligner deux équipes et un staff complet.' },
  { id: 'fleet-foot-3', category: 'OVERFLEET', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Mercato sans limite', message: '{vehicles} véhicules pour {required} utiles sur {line}. Le recruteur a visiblement eu carte blanche.' },
  { id: 'fleet-pop-1', category: 'OVERFLEET', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Collection complète', message: '{line} a {vehicles} véhicules pour {required} utiles. À ce stade ce n’est plus un parc, c’est une collection.' },
  { id: 'fleet-pop-2', category: 'OVERFLEET', intensity: 'LIGHT', reference: 'CULTURE', title: 'Parking premium', message: 'Le dépôt de {line} commence à ressembler à un salon automobile.' },

  { id: 'quality-foot-1', category: 'QUALITY_CRASH', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Vestiaire sous tension', message: 'Qualité {quality}/100 et seulement {satisfaction}% de demande servie. Le vestiaire demande une causerie.' },
  { id: 'quality-foot-2', category: 'QUALITY_CRASH', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Changement tactique', message: '{quality}/100 de qualité. Si c’était un match, le coach aurait déjà utilisé ses cinq changements.' },
  { id: 'quality-foot-3', category: 'QUALITY_CRASH', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Mi-temps nécessaire', message: 'La qualité tombe à {quality}/100. Petite pause au tableau tactique avant la deuxième période ?' },
  { id: 'quality-pop-1', category: 'QUALITY_CRASH', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Épisode compliqué', message: 'Qualité {quality}/100. Même la saison la plus controversée d’une série mérite un épisode de rattrapage.' },
  { id: 'quality-pop-2', category: 'QUALITY_CRASH', intensity: 'LIGHT', reference: 'CULTURE', title: 'Mode réparation', message: '{quality}/100 de qualité. Le bouton “redémarrer proprement” commence à avoir du charme.' },

  { id: 'profit-foot-1', category: 'PROFIT_STAR', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Homme du match', message: '{line} sort {lineResult} aujourd’hui. Contrat prolongé jusqu’en 2042.' },
  { id: 'profit-foot-2', category: 'PROFIT_STAR', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Triplé financier', message: '{line} transporte {linePassengers} voyageurs et gagne {lineResult}. Là, le recrutement commence à ressembler à du génie.' },
  { id: 'profit-foot-3', category: 'PROFIT_STAR', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Titulaire indiscutable', message: '{line} vient encore de faire le travail. Pas besoin de VAR pour voir que celle-là fonctionne.' },
  { id: 'profit-pop-1', category: 'PROFIT_STAR', intensity: 'MEDIUM', reference: 'CULTURE', title: 'La bonne formule', message: '{line} produit {lineResult}. Garde la recette, elle vient de passer le contrôle qualité.' },
  { id: 'profit-pop-2', category: 'PROFIT_STAR', intensity: 'LIGHT', reference: 'CULTURE', title: 'Ça déroule', message: '{line} fait tourner les voyageurs et les comptes dans le même sens. C’est presque suspect.' },

  { id: 'great-foot-1', category: 'GREAT_DAY', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Victoire propre', message: '{passengers} voyageurs, {quality}/100 de qualité et {satisfaction}% de demande servie. Victoire sans trembler.' },
  { id: 'great-foot-2', category: 'GREAT_DAY', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Soir de trophée', message: '{passengers} voyageurs avec {quality}/100 de qualité. Pour une fois, même le Roast est obligé d’applaudir.' },
  { id: 'great-foot-3', category: 'GREAT_DAY', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Clean sheet', message: 'Qualité {quality}/100, demande servie à {satisfaction}%. Journée sans but encaissé.' },
  { id: 'great-pop-1', category: 'GREAT_DAY', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Épisode cinq étoiles', message: '{passengers} voyageurs et un réseau qui tourne proprement. Le scénario a enfin arrêté de chercher un drame.' },
  { id: 'great-pop-2', category: 'GREAT_DAY', intensity: 'LIGHT', reference: 'CULTURE', title: 'Tout est au vert', message: 'Qualité {quality}/100. Oui, CLU Roast sait aussi dire quand c’est bien.' },

  { id: 'cash-foot-1', category: 'CASH_HOARD', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Budget de mercato', message: '{balance} en caisse. Le président attend toujours que quelqu’un lui explique pourquoi le mercato n’a pas commencé.' },
  { id: 'cash-foot-2', category: 'CASH_HOARD', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Trésor de guerre', message: '{balance} disponibles. À ce rythme tu peux acheter les panneaux, les sièges et le stade autour.' },
  { id: 'cash-foot-3', category: 'CASH_HOARD', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Propriétaire très patient', message: '{balance} dorment en trésorerie. Le réseau joue clairement le 0-0 avec son propre budget.' },
  { id: 'cash-pop-1', category: 'CASH_HOARD', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Coffre-fort simulé', message: '{balance} en caisse. On construit un réseau ou une exposition permanente de billets ?' },
  { id: 'cash-pop-2', category: 'CASH_HOARD', intensity: 'LIGHT', reference: 'CULTURE', title: 'Épargne maximale', message: 'La trésorerie affiche {balance}. Même le bouton “investir” commence à se sentir ignoré.' },

  { id: 'mega-foot-1', category: 'MEGA_PROJECT', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Projet de finale', message: '{project} coûte {projectCost}. Tu n’as pas construit une ligne, tu as déposé un dossier de candidature pour une Coupe du monde.' },
  { id: 'mega-foot-2', category: 'MEGA_PROJECT', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Mercato infrastructure', message: '{projectCost} pour {project}. Le directeur sportif vient de vérifier si les rails savent marquer des buts.' },
  { id: 'mega-foot-3', category: 'MEGA_PROJECT', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Transfert record', message: '{project} à {projectCost}. Même le panneau des transferts aurait besoin d’une ligne supplémentaire.' },
  { id: 'mega-pop-1', category: 'MEGA_PROJECT', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Projet blockbuster', message: '{project} affiche {projectCost} de travaux. Le générique de fin va devoir remercier la banque.' },
  { id: 'mega-pop-2', category: 'MEGA_PROJECT', intensity: 'LIGHT', reference: 'CULTURE', title: 'Très grand format', message: '{projectCost} pour {project}. On avait demandé une infrastructure, pas une nouvelle merveille du monde.' },

  { id: 'wait-foot-1', category: 'WAITING_ROOM', intensity: 'MEDIUM', reference: 'FOOTBALL', title: 'Temps additionnel', message: '{wait} min d’attente moyenne. L’arbitre vient de demander combien de panneaux de temps additionnel il fallait.' },
  { id: 'wait-foot-2', category: 'WAITING_ROOM', intensity: 'EPIC', reference: 'FOOTBALL', title: 'Match reporté', message: '{wait} min d’attente moyenne. À ce niveau, les voyageurs ont le temps de regarder les deux mi-temps.' },
  { id: 'wait-foot-3', category: 'WAITING_ROOM', intensity: 'LIGHT', reference: 'FOOTBALL', title: 'Échauffement prolongé', message: '{wait} min avant de partir. Les voyageurs sont désormais parfaitement échauffés.' },
  { id: 'wait-pop-1', category: 'WAITING_ROOM', intensity: 'MEDIUM', reference: 'CULTURE', title: 'Version longue', message: '{wait} min d’attente moyenne. Même les éditions director’s cut trouvent ça généreux.' },
  { id: 'wait-pop-2', category: 'WAITING_ROOM', intensity: 'LIGHT', reference: 'CULTURE', title: 'Salle d’attente', message: 'Avec {wait} min d’attente, les stations commencent à mériter une machine à café.' },
]
