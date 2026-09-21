import type { GameHelpCategory, GameWikiArticle } from '../../types/help'

export const GAME_HELP_CATEGORY_LABELS: Record<GameHelpCategory, string> = {
  PRISE_EN_MAIN: 'Prise en main',
  RESEAU: 'Réseau & construction',
  EXPLOITATION: 'Exploitation',
  FINANCES: 'Finances',
  TERRITOIRE: 'Territoire & communes',
  PROGRESSION: 'Progression',
  DEFIS: 'Défis',
  SAUVEGARDES: 'Sauvegardes',
}

export const GAME_WIKI_ARTICLES: GameWikiArticle[] = [
  {
    id: 'prise-en-main', category: 'PRISE_EN_MAIN', title: 'Bien démarrer',
    summary: 'Les cinq réflexes qui évitent de construire un réseau impossible à exploiter.',
    keywords: ['debut', 'commencer', 'nouvelle partie', 'conseils'],
    paragraphs: [
      'CLU Métropole vous laisse beaucoup de liberté. Commencez par observer le territoire, choisissez un premier corridor crédible, puis construisez une ligne que votre budget peut réellement exploiter.',
      'Le jeu sépare volontairement l’investissement, l’exploitation et la qualité de service. Une ligne spectaculaire mais sous-équipée peut devenir un problème financier et opérationnel.',
    ],
    bullets: ['Vérifiez le prix total avant de lancer les travaux.', 'Gardez de la trésorerie pour le matériel roulant et les premières journées.', 'Consultez Réseau, Finances et Événements régulièrement.', 'Utilisez le Bilan pour comprendre les tendances sur plusieurs semaines.'],
    related: ['construction-ligne', 'finances', 'capacite-saturation'],
  },
  {
    id: 'interface', category: 'PRISE_EN_MAIN', title: 'Lire l’interface',
    summary: 'Carte dominante, modules à gauche, indicateurs globaux en haut et actions de partie à droite.',
    keywords: ['interface', 'hud', 'menu', 'panneaux'],
    paragraphs: ['Un seul grand panneau de travail est affiché à la fois. Les modules Réseau, Communes, Finances, Événements et Objectifs donnent chacun une lecture différente de la même partie.'],
    bullets: ['Le bandeau supérieur résume date, budget, voyageurs et moral.', 'Le bouton Bilan ouvre l’historique détaillé.', 'Le menu ☰ donne accès aux paramètres, au Wiki et au tutoriel.'],
  },
  {
    id: 'reseau', category: 'RESEAU', title: 'Module Réseau',
    summary: 'Le centre opérationnel de vos lignes, stations, matériels et niveaux de service.',
    keywords: ['reseau', 'ligne', 'stations', 'service'],
    paragraphs: ['Réseau regroupe l’identité des lignes, leur tracé, les stations, les correspondances, le matériel, la capacité, la saturation, la régularité, la maintenance et la qualité.'],
    bullets: ['Sélectionnez une ligne pour afficher ses détails.', 'Les chiffres d’exploitation évoluent avec la simulation réelle.', 'Une ligne en conception n’est pas encore une ligne en service.'],
    related: ['construction-ligne', 'materiel-roulant', 'capacite-saturation'],
  },
  {
    id: 'construction-ligne', category: 'RESEAU', title: 'Construire une ligne',
    summary: 'Créer, tracer, vérifier le coût, puis lancer les travaux.',
    keywords: ['creer', 'construction', 'tracer', 'prix', 'travaux'],
    paragraphs: ['Le bouton Créer ouvre la configuration de la ligne. Une fois le mode et l’infrastructure choisis, placez les stations sur la carte. La prévisualisation indique la longueur et le coût avant le clic.', 'Le projet reste modifiable tant que vous n’avez pas lancé les travaux. Annuler le projet supprime la conception provisoire ; Undo/Redo permet de revenir sur les étapes de tracé.'],
    bullets: ['Prix = ajout actuellement prévisualisé.', 'Prix total = coût estimé du projet complet.', 'Manque = budget supplémentaire nécessaire si la trésorerie ne suffit pas.', 'Le mode Assisté suit les corridors pertinents ; Libre garde une géométrie directe.'],
    related: ['stations-correspondances', 'tracage', 'finances'],
  },
  {
    id: 'tracage', category: 'RESEAU', title: 'Tracé assisté et tracé libre',
    summary: 'Deux façons de dessiner sans enlever la main au joueur.',
    keywords: ['trace', 'assiste', 'libre', 'route', 'rail'],
    paragraphs: ['Le tracé Assisté cherche des corridors cohérents avec le mode : voirie pour bus, grands axes pour BRT, corridors urbains pour tram et ferroviaires pour RER/train. Le métro reste plus libre.', 'Le tracé Libre relie vos points sans aimantation aux infrastructures. Vous pouvez changer de mode pendant la conception.'],
  },
  {
    id: 'stations-correspondances', category: 'RESEAU', title: 'Stations & correspondances',
    summary: 'Une station est un objet exploitable ; une correspondance relie plusieurs services.',
    keywords: ['station', 'arret', 'correspondance', 'terminus', 'pole'],
    paragraphs: ['Une station existante peut être réutilisée pendant un tracé pour créer une vraie station partagée. Des stations distinctes suffisamment proches peuvent aussi former une correspondance.', 'La distance influence la qualité de correspondance : rapprocher les points d’échange rend les transferts plus efficaces.'],
    related: ['reseau', 'qualite-service'],
  },
  {
    id: 'materiel-roulant', category: 'EXPLOITATION', title: 'Matériel roulant',
    summary: 'Acheter suffisamment de véhicules pour assurer le service demandé.',
    keywords: ['vehicule', 'train', 'rame', 'bus', 'achat', 'flotte'],
    paragraphs: ['Chaque ligne a un besoin de véhicules lié à sa longueur, son mode et son niveau de service. Une flotte trop petite réduit la fréquence réellement obtenue.', 'Les améliorations de matériel renforcent progressivement capacité, vitesse, fiabilité, efficacité ou embarquement selon le système existant.'],
    bullets: ['Gardez une réserve raisonnable au lieu d’affecter 100 % de la flotte.', 'Une fréquence théorique n’est pas garantie si le parc disponible est insuffisant.'],
    related: ['reserve-regulation', 'maintenance-fiabilite'],
  },
  {
    id: 'capacite-saturation', category: 'EXPLOITATION', title: 'Capacité, saturation & attente',
    summary: 'Comprendre pourquoi une ligne transporte moins de voyageurs qu’elle n’en attire.',
    keywords: ['capacite', 'saturation', 'attente', 'voyageurs', 'file'],
    paragraphs: ['La demande potentielle n’est pas automatiquement transportée. La capacité disponible, la fréquence, la file d’attente et la qualité de service déterminent combien de voyageurs montent réellement.', 'Une saturation durable augmente l’attente, les renoncements et peut dégrader le moral.'],
    bullets: ['Ajoutez des véhicules si la flotte limite la fréquence.', 'Augmentez le niveau de service si l’exploitation peut suivre.', 'Surveillez la capacité réelle, pas uniquement la demande.'],
    related: ['materiel-roulant', 'qualite-service'],
  },
  {
    id: 'reserve-regulation', category: 'EXPLOITATION', title: 'Réserve & régulation',
    summary: 'Garder une marge pour absorber les incidents et les pointes.',
    keywords: ['reserve', 'regulation', 'manuel', 'auto', 'frequence'],
    paragraphs: ['La réserve correspond aux véhicules disponibles mais non engagés dans le service nominal. Elle permet de renforcer une ligne ou de compenser des besoins supplémentaires.', 'La régulation automatique simplifie la gestion. Le mode manuel vous laisse décider du renfort lorsque vous voulez intervenir plus finement.'],
  },
  {
    id: 'maintenance-fiabilite', category: 'EXPLOITATION', title: 'Maintenance & fiabilité',
    summary: 'Éviter qu’un réseau rentable se dégrade lentement.',
    keywords: ['maintenance', 'fiabilite', 'panne', 'etat'],
    paragraphs: ['La maintenance est un coût d’exploitation qui protège la fiabilité. Sous-investir peut sembler rentable à court terme mais dégrade progressivement le service.', 'La fiabilité influence la qualité perçue et les performances opérationnelles.'],
  },
  {
    id: 'qualite-service', category: 'EXPLOITATION', title: 'Qualité de service',
    summary: 'Un indicateur synthétique qui doit toujours être lu avec ses causes.',
    keywords: ['qualite', 'regularite', 'moral', 'service'],
    paragraphs: ['La qualité ne doit pas être lue comme une note magique. Elle reflète plusieurs dimensions du service et sert surtout à repérer où l’exploitation se dégrade.', 'Consultez les causes dominantes : attente, saturation, régularité, fiabilité et autres composantes opérationnelles.'],
  },
  {
    id: 'finances', category: 'FINANCES', title: 'Finances',
    summary: 'Trésorerie, recettes, dépenses, investissement, dette et financement public.',
    keywords: ['argent', 'finances', 'budget', 'recettes', 'depenses'],
    paragraphs: ['Les grands investissements ne sont pas censés être financés uniquement par les billets. CLU Métropole sépare recettes d’exploitation, aides publiques, objectifs et crédit.', 'Une trésorerie à zéro n’est pas automatiquement un game over. Le problème devient critique lorsque la situation est réellement irrécupérable.'],
    related: ['credit-dette', 'tarification'],
  },
  {
    id: 'credit-dette', category: 'FINANCES', title: 'Crédit & dette',
    summary: 'Financer un développement sans transformer chaque projet en argent gratuit.',
    keywords: ['credit', 'dette', 'pret', 'interet', 'score credit'],
    paragraphs: ['Le crédit est encadré par une capacité d’emprunt, un score, des échéances et des intérêts. Une demande trop élevée peut être refusée plutôt que réduite silencieusement.', 'La dette est un outil de développement, mais les remboursements futurs pèsent sur l’exploitation.'],
  },
  {
    id: 'tarification', category: 'FINANCES', title: 'Tarification & contrôle',
    summary: 'Billets, abonnements, fraude et contrôle : des revenus d’exploitation, pas une imprimante à métro.',
    keywords: ['ticket', 'billet', 'abonnement', 'fraude', 'controle', 'amende'],
    paragraphs: ['La tarification peut être guidée ou libre selon les règles de la partie. Les billets, abonnements et amendes contribuent fortement au fonctionnement mais ne remplacent pas tous les financements de développement.', 'Le contrôle réduit la fraude mais a lui aussi un coût et doit rester cohérent avec votre politique d’exploitation.'],
  },
  {
    id: 'communes', category: 'TERRITOIRE', title: 'Communes',
    summary: 'Des acteurs territoriaux avec population, relation, demandes et possibilités de cofinancement.',
    keywords: ['commune', 'ville', 'relation', 'negociation', 'cofinancement'],
    paragraphs: ['Les communes ne sont pas de simples décorations. Leur population, leur desserte et votre relation influencent les demandes et les négociations.', 'Une commune peut proposer un projet, demander un renforcement de service ou participer financièrement selon la situation réelle.'],
  },
  {
    id: 'evenements', category: 'TERRITOIRE', title: 'Événements & Infos',
    summary: 'Le centre d’attention quotidien du réseau.',
    keywords: ['evenement', 'infos', 'alerte', 'priorite'],
    paragraphs: ['Ce module ne cherche pas à produire une avalanche d’alertes. Il remonte d’abord les quelques sujets qui méritent votre attention : saturation, demande, qualité, dette, opportunités ou bonne performance.', 'Les problèmes proviennent surtout de l’état réel de la partie, avec anti-répétition pour éviter le bruit.'],
  },
  {
    id: 'objectifs', category: 'PROGRESSION', title: 'Objectifs',
    summary: 'Des jalons dynamiques avec récompenses, pas une liste infinie de quêtes.',
    keywords: ['objectif', 'mission', 'recompense', 'progression'],
    paragraphs: ['Les objectifs s’adaptent à la partie et servent à créer des caps de progression. Ils peuvent apporter des récompenses utiles au développement.', 'Ils ne remplacent pas votre propre stratégie et ne constituent pas un score universel du réseau.'],
  },
  {
    id: 'bilan', category: 'PROGRESSION', title: 'Bilan & historique',
    summary: 'Relire toute la partie depuis le Jour 1 et comparer les semaines.',
    keywords: ['bilan', 'statistiques', 'semaine', 'historique', 'courbe'],
    paragraphs: ['Le Bilan conserve les cumuls, records et snapshots hebdomadaires de la partie. La semaine est l’unité naturelle pour suivre l’évolution économique et opérationnelle.', 'Utilisez les courbes pour distinguer une mauvaise journée d’une vraie tendance.'],
  },
  {
    id: 'defi-du-jour', category: 'DEFIS', title: 'Défi du jour',
    summary: 'La même épreuve officielle pour tout le monde, sur une carte réelle et pour une durée limitée.',
    keywords: ['defi', 'jour', 'timer', 'quotidien', 'score'],
    paragraphs: ['Le Défi du jour est déterministe à partir de la date : actualiser la page ne change pas l’épreuve. La carte est toujours réelle, avec capital, contraintes et objectifs imposés.', 'Le chrono continue après un rechargement. À la fin ou après une heure maximum, la partie est réellement figée en lecture seule.'],
    bullets: ['Aucune triche.', 'Fin manuelle possible.', 'Échec plus strict qu’en partie libre.', 'Une archive peut être conservée 30 jours si vous le choisissez.'],
  },
  {
    id: 'defi-ami', category: 'DEFIS', title: 'Défier un ami',
    summary: 'Partager exactement la même configuration sans serveur.',
    keywords: ['ami', 'code', 'defi', 'aleatoire', 'personnalise'],
    paragraphs: ['Une Partie aléatoire crée automatiquement une épreuve complète. Une Partie personnalisée vous laisse choisir carte, seed éventuelle, capital, objectifs, contraintes, modes, difficulté et durée.', 'Le code CLU1 contient une configuration versionnée et contrôlée. Le code résultat CLUR1 permet ensuite de comparer deux performances sur la même épreuve.'],
  },
  {
    id: 'sauvegardes', category: 'SAUVEGARDES', title: 'Sauvegardes',
    summary: 'Sauvegardes locales versionnées, import/export et protections de migration.',
    keywords: ['save', 'sauvegarde', 'import', 'export', 'backup'],
    paragraphs: ['Les parties sont stockées localement dans IndexedDB. Le format .clumetro permet d’exporter et réimporter une partie sans dépendre d’un serveur.', 'Les migrations créent les protections nécessaires avant de convertir une ancienne sauvegarde. Une sauvegarde issue d’une version future est refusée proprement.'],
    bullets: ['Les parties libres normales n’expirent pas.', 'Toutes les sauvegardes Défi sont séparées des parties libres, limitées à 10 et supprimées automatiquement après 30 jours.'],
  },
  {
    id: 'roast', category: 'PRISE_EN_MAIN', title: 'CLU Roast',
    summary: 'La personnalité du jeu, basée sur votre vraie gestion, sans effet gameplay.',
    keywords: ['roast', 'blague', 'notification', 'personnalite'],
    paragraphs: ['CLU Roast analyse localement quelques situations marquantes et affiche des commentaires avec anti-répétition et cooldown. Il ne modifie jamais les règles, l’économie ou la simulation.', 'Vous pouvez le désactiver ou modifier sa fréquence dans Paramètres.'],
  },
]

export function getGameWikiArticle(id: string | null | undefined) {
  if (!id) return null
  return GAME_WIKI_ARTICLES.find(article => article.id === id) ?? null
}
