export type StopSuggestionMode =
  | 'METRO'
  | 'RER'
  | 'TRAIN'
  | 'TRAM'

export type StopSuggestionService = {
  mode: StopSuggestionMode
  index: string
  walk: boolean
  served: boolean
}

export type StopSuggestion = {
  id: string
  name: string
  aliases: string[]
  services: StopSuggestionService[]
  source: 'CLU'
}

/*
 * Catalogue intégré des suggestions d'arrêts CLU.
 *
 * Généré à partir des lignes Métro, RER, Transilien et Tramway
 * fournies pour CLU. Les UUID des projets d'origine ne sont
 * volontairement jamais conservés.
 *
 * `served` indique que la ligne dessert réellement la station.
 * `walk` indique qu'une correspondance connue se fait à pied.
 */
export const stopSuggestionsCatalog: StopSuggestion[] = [
  {
    id: 'abbesses',
    name: 'Abbesses',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ablon',
    name: 'Ablon',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'acheres-grand-cormier',
    name: 'Achères Grand Cormier',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'acheres-ville',
    name: 'Achères Ville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'acheres-ville',
    name: 'Achères – Ville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'adrienne-bolland',
    name: 'Adrienne Bolland',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aeroport-ch-de-gaulle-1',
    name: 'Aéroport Ch. de Gaulle 1',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aeroport-ch-de-gaulle-2-tgv',
    name: 'Aéroport Ch. de Gaulle 2 TGV',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aeroport-ch-de-gaulle-2-tgv',
    name: 'Aéroport Ch. de Gaulle 2 – TGV',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aeroport-charles-de-gaulle',
    name: 'Aéroport Charles-de-Gaulle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aeroport-dorly',
    name: 'Aéroport d’Orly',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aime-cesaire',
    name: 'Aimé Césaire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'alcide-dorbigny',
    name: 'Alcide d’Orbigny',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'alesia',
    name: 'Alésia',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'alexandra-david-neel',
    name: 'Alexandra David-Néel',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'alexandre-dumas',
    name: 'Alexandre Dumas',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'allee-de-la-tour-rendez-vous',
    name: 'Allée de la Tour - Rendez-Vous',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'allee-royale',
    name: 'Allée Royale',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'alma-marceau',
    name: 'Alma – Marceau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'amedee-gordini',
    name: 'Amédée Gordini',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'anatole-france',
    name: 'Anatole France',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'andresy',
    name: 'Andrésy',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'angelique-compoint',
    name: 'Angélique Compoint',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'anna-de-noailles',
    name: 'Anna de Noailles',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'anny-flore',
    name: 'Anny Flore',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'antony',
    name: 'Antony',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'antonypole-wissous-centre',
    name: 'Antonypôle – Wissous Centre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'anvers',
    name: 'Anvers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'arboretum',
    name: 'Arboretum',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'arcueil-cachan',
    name: 'Arcueil - Cachan',
    aliases: [
      'Arcueil – Cachan',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'argenteuil',
    name: 'Argenteuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'argentine',
    name: 'Argentine',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'arpajon',
    name: 'Arpajon',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'arts-et-metiers',
    name: 'Arts et Métiers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'asnieres-quatre-routes',
    name: 'Asnières – Quatre Routes',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'asnieres-sur-seine',
    name: 'Asnières-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'assemblee-nationale',
    name: 'Assemblée Nationale',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'athis-mons',
    name: 'Athis-Mons',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'auber',
    name: 'Auber',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aubergenville-elisabethville',
    name: 'Aubergenville – Élisabethville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aubervilliers-pantin-quatre-chemins',
    name: 'Aubervilliers – Pantin Quatre Chemins',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'auguste-delaune',
    name: 'Auguste Delaune',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'auguste-perret',
    name: 'Auguste Perret',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aulnay-sous-bois',
    name: 'Aulnay-sous-Bois',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'aulnay-val-francilia',
    name: 'Aulnay – Val Francilia',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'auvers-sur-oise',
    name: 'Auvers-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avenue-de-france',
    name: 'Avenue de France',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: true,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avenue-du-president-kennedy',
    name: 'Avenue du Président Kennedy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avenue-emile-zola',
    name: 'Avenue Émile Zola',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avenue-foch',
    name: 'Avenue Foch',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avenue-henri-martin',
    name: 'Avenue Henri-Martin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'avron',
    name: 'Avron',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bagneaux-sur-loing',
    name: 'Bagneaux-sur-Loing',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bagneux',
    name: 'Bagneux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bagneux-lucie-aubrac',
    name: 'Bagneux Lucie Aubrac',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bagneux-lucie-aubrac',
    name: 'Bagneux - Lucie Aubrac',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bailly',
    name: 'Bailly',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'balard',
    name: 'Balard',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ballancourt',
    name: 'Ballancourt',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'barbara',
    name: 'Barbara',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'barbes-rochechouart',
    name: 'Barbès – Rochechouart',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'baron-le-roy',
    name: 'Baron Le Roy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'basilique-de-st-denis',
    name: 'Basilique de St-Denis',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bastille',
    name: 'Bastille',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'baudelaire',
    name: 'Baudelaire',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'becon-les-bruyeres',
    name: 'Bécon-les-Bruyères',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'beethoven-concorde',
    name: 'Beethoven – Concorde',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bel-air',
    name: 'Bel-Air',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'belleville',
    name: 'Belleville',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bellevue',
    name: 'Bellevue',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'belloy-saint-martin',
    name: 'Belloy – Saint-Martin',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'belvedere',
    name: 'Belvédère',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'berault',
    name: 'Bérault',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bercy',
    name: 'Bercy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bessancourt',
    name: 'Bessancourt',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'beynes',
    name: 'Beynes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bibliotheque-f-mitterrand',
    name: 'Bibliothèque F. Mitterrand',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bibliotheque-francois-mitterrand',
    name: 'Bibliothèque François Mitterrand',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bievres',
    name: 'Bièvres',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'billancourt',
    name: 'Billancourt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bir-hakeim',
    name: 'Bir-Hakeim',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'blanche',
    name: 'Blanche',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'blumenthal',
    name: 'Blumenthal',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bobigny-pablo-picasso',
    name: 'Bobigny Pablo Picasso',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bobigny-drancy',
    name: 'Bobigny - Drancy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bobigny-pablo-picasso',
    name: 'Bobigny - Pablo Picasso',
    aliases: [
      'Bobigny – Pablo Picasso',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bobigny-pantin-raymond-queneau',
    name: 'Bobigny – Pantin Raymond Queneau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boigneville',
    name: 'Boigneville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bois-briard',
    name: 'Bois Briard',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bois-de-saint-eutrope',
    name: 'Bois de Saint-Eutrope',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bois-colombes',
    name: 'Bois-Colombes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bois-le-roi',
    name: 'Bois-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boissiere',
    name: 'Boissière',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boissise-le-roi',
    name: 'Boissise-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boissy-laillerie',
    name: 'Boissy-l’Aillerie',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boissy-saint-leger',
    name: 'Boissy-Saint-Léger',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bolivar',
    name: 'Bolivar',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bondy',
    name: 'Bondy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bonne-nouvelle',
    name: 'Bonne Nouvelle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bonnieres',
    name: 'Bonnières',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boran-sur-oise',
    name: 'Boran-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'botzaris',
    name: 'Botzaris',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boucicaut',
    name: 'Boucicaut',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bouffemont-moisselles',
    name: 'Bouffémont – Moisselles',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bougival',
    name: 'Bougival',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boulainvilliers',
    name: 'Boulainvilliers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boulogne-jean-jaures',
    name: 'Boulogne Jean Jaurès',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boulogne-pont-de-saint-cloud',
    name: 'Boulogne Pont de Saint-Cloud',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bouray',
    name: 'Bouray',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bourg-la-reine',
    name: 'Bourg-la-Reine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bourron-marlotte-grez',
    name: 'Bourron-Marlotte – Grez',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bourse',
    name: 'Bourse',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boussy-saint-antoine',
    name: 'Boussy-Saint-Antoine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'boutigny',
    name: 'Boutigny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'brancion',
    name: 'Brancion',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'breguet-sabin',
    name: 'Bréguet – Sabin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bretagne',
    name: 'Bretagne',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bretigny',
    name: 'Brétigny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'breuillet',
    name: 'Breuillet',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'breuillet-village',
    name: 'Breuillet – Village',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'breval',
    name: 'Bréval',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'brimborion',
    name: 'Brimborion',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'brochant',
    name: 'Brochant',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'brunoy',
    name: 'Brunoy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bruyeres-sur-oise',
    name: 'Bruyères-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bry-sur-marne',
    name: 'Bry-sur-Marne',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bry-villiers-champigny',
    name: 'Bry - Villiers - Champigny',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bueil',
    name: 'Bueil',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'buno-gironville',
    name: 'Buno-Gironville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bures-sur-yvette',
    name: 'Bures-sur-Yvette',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'bussy-saint-georges',
    name: 'Bussy-Saint-Georges',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'butte-du-chapeau-rouge',
    name: 'Butte du Chapeau Rouge',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'butte-pinson',
    name: 'Butte Pinson',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'buttes-chaumont',
    name: 'Buttes Chaumont',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'buzenval',
    name: 'Buzenval',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cadet',
    name: 'Cadet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cambronne',
    name: 'Cambronne',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'camille-groult',
    name: 'Camille Groult',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'camp-des-loges',
    name: 'Camp des Loges',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'campo-formio',
    name: 'Campo-Formio',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'canal-saint-denis',
    name: 'Canal Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cardinal-lemoine',
    name: 'Cardinal Lemoine',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'carle-darthe',
    name: 'Carle – Darthé',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'caroline-aigle',
    name: 'Caroline Aigle',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'carrefour-pleyel',
    name: 'Carrefour Pleyel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'censier-daubenton',
    name: 'Censier – Daubenton',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'centre-de-chatillon',
    name: 'Centre de Châtillon',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-le-haut',
    name: 'Cergy le Haut',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-prefecture',
    name: 'Cergy Préfecture',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-saint-christophe',
    name: 'Cergy Saint-Christophe',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-le-haut',
    name: 'Cergy – Le Haut',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-prefecture',
    name: 'Cergy – Préfecture',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cergy-st-christophe',
    name: 'Cergy – St-Christophe',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cernay',
    name: 'Cernay',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cesar',
    name: 'César',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cesson',
    name: 'Cesson',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chamarande',
    name: 'Chamarande',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champ-de-courses-denghien',
    name: 'Champ de Courses d’Enghien',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champ-de-mars',
    name: 'Champ de Mars',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champagne-sur-oise',
    name: 'Champagne-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champagne-sur-seine',
    name: 'Champagne-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champbenoist-poigny',
    name: 'Champbenoist - Poigny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champigny',
    name: 'Champigny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champigny-centre',
    name: 'Champigny Centre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champlan',
    name: 'Champlan',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champs-elysees-clemenceau',
    name: 'Champs-Élysées Clemenceau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'champs-elysees-clemenceau',
    name: 'Champs-Élysées – Clemenceau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'changis-saint-jean',
    name: 'Changis - Saint-Jean',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chanteloup-les-vignes',
    name: 'Chanteloup-les-Vignes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chantilly-gouvieux',
    name: 'Chantilly Gouvieux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaponval',
    name: 'Chaponval',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chardon-lagache',
    name: 'Chardon Lagache',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'charenton-ecoles',
    name: 'Charenton – Écoles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'charlebourg',
    name: 'Charlebourg',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'charles-de-gaulle-etoile',
    name: 'Charles de Gaulle – Étoile',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'charles-michels',
    name: 'Charles Michels',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'charonne',
    name: 'Charonne',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chars',
    name: 'Chars',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chartrettes',
    name: 'Chartrettes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateau-de-vincennes',
    name: 'Château de Vincennes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateau-deau',
    name: 'Château d’Eau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateau-rouge',
    name: 'Château Rouge',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateau-landon',
    name: 'Château-Landon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateau-thierry',
    name: 'Château-Thierry',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chateaudun-barbes',
    name: 'Châteaudun – Barbès',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chatelet',
    name: 'Châtelet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chatelet-les-halles',
    name: 'Châtelet – Les Halles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chatillon-montrouge',
    name: 'Châtillon Montrouge',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chatillon-montrouge',
    name: 'Châtillon - Montrouge',
    aliases: [
      'Châtillon – Montrouge',
    ],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chatou-croissy',
    name: 'Chatou – Croissy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaumont-en-vexin',
    name: 'Chaumont-en-Vexin',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaussee-dantin-la-fayette',
    name: 'Chaussée d’Antin La Fayette',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaussee-dantin-la-fayette',
    name: 'Chaussée d’Antin – La Fayette',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaville-velizy',
    name: 'Chaville Vélizy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaville-rive-droite',
    name: 'Chaville - Rive Droite',
    aliases: [
      'Chaville – Rive Droite',
    ],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chaville-rive-gauche',
    name: 'Chaville – Rive Gauche',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chelles-gournay',
    name: 'Chelles – Gournay',
    aliases: [
      'Chelles - Gournay',
    ],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chemin-dantony',
    name: 'Chemin d’Antony',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chemin-des-reniers',
    name: 'Chemin des Reniers',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chemin-vert',
    name: 'Chemin Vert',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chevaleret',
    name: 'Chevaleret',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chevilly-larue',
    name: 'Chevilly-Larue',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chezy-sur-marne',
    name: 'Chézy-sur-Marne',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'chilly-mazarin',
    name: 'Chilly-Mazarin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'choisy-le-roi',
    name: 'Choisy-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '9',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'christ-de-saclay',
    name: 'Christ de Saclay',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'christophe-colomb',
    name: 'Christophe Colomb',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cimetiere-de-st-denis',
    name: 'Cimetière de St-Denis',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cimetiere-parisien-divry',
    name: 'Cimetière Parisien d’Ivry',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cite',
    name: 'Cité',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cite-universitaire',
    name: 'Cité Universitaire',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cite-jardin',
    name: 'Cité-Jardin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'clamart',
    name: 'Clamart',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'clichy-levallois',
    name: 'Clichy - Levallois',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'clichy-montfermeil',
    name: 'Clichy - Montfermeil',
    aliases: [
      'Clichy – Montfermeil',
    ],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'clichy-sous-bois-mairie',
    name: 'Clichy-sous-Bois - Mairie',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cluny-la-sorbonne',
    name: 'Cluny – La Sorbonne',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'coignieres',
    name: 'Coignières',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'colette-besson',
    name: 'Colette Besson',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'colombes',
    name: 'Colombes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'colonel-fabien',
    name: 'Colonel Fabien',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'combs-la-ville-quincy',
    name: 'Combs-la-Ville – Quincy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'commerce',
    name: 'Commerce',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'compans',
    name: 'Compans',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'concorde',
    name: 'Concorde',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'conflans-fin-doise',
    name: 'Conflans Fin d\'Oise',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'conflans-fin-doise',
    name: 'Conflans – Fin d’Oise',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'conflans-sainte-honorine',
    name: 'Conflans-Sainte-Honorine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'constant-coquelin',
    name: 'Constant Coquelin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'convention',
    name: 'Convention',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'corbeil-essonnes',
    name: 'Corbeil-Essonnes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'corentin-cariou',
    name: 'Corentin Cariou',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'corentin-celton',
    name: 'Corentin Celton',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cormeilles-en-parisis',
    name: 'Cormeilles-en-Parisis',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'corvisart',
    name: 'Corvisart',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cosmonautes',
    name: 'Cosmonautes',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'coteaux-beauclair',
    name: 'Coteaux Beauclair',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'coteaux-de-lorge',
    name: 'Coteaux de l’Orge',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'couilly-saint-germain-quincy',
    name: 'Couilly – Saint-Germain Quincy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'coulommiers',
    name: 'Coulommiers',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'cour-saint-emilion',
    name: 'Cour Saint-Émilion',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'courbevoie',
    name: 'Courbevoie',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'courcelle-sur-yvette',
    name: 'Courcelle-sur-Yvette',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'courcelles',
    name: 'Courcelles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'couronnes',
    name: 'Couronnes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'crecy-la-chapelle',
    name: 'Crécy-la-Chapelle',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'creil',
    name: 'Creil',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'crepy-en-valois',
    name: 'Crépy-en-Valois',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'creteil-pompadour',
    name: 'Créteil Pompadour',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'creteil-lechat',
    name: 'Créteil - L\'Échat',
    aliases: [
      'Créteil – L’Échat',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'creteil-prefecture',
    name: 'Créteil – Préfecture',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'creteil-universite',
    name: 'Créteil – Université',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'crimee',
    name: 'Crimée',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'croix-de-chavaux',
    name: 'Croix de Chavaux',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'crouy-sur-ourcq',
    name: 'Crouy-sur-Ourcq',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'c-ur-dorly',
    name: 'Cœur d’Orly',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dammartin-juilly-saint-mard',
    name: 'Dammartin – Juilly Saint-Mard',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'danton',
    name: 'Danton',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'danube',
    name: 'Danube',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'daumesnil',
    name: 'Daumesnil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'delaunay-belleville',
    name: 'Delaunay-Belleville',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'delphine-seyrig',
    name: 'Delphine Seyrig',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'denfert-rochereau',
    name: 'Denfert-Rochereau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'desnouettes',
    name: 'Desnouettes',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'deuil-montmagny',
    name: 'Deuil – Montmagny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dewoitine',
    name: 'Dewoitine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'diane-arbus',
    name: 'Diane Arbus',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'didot',
    name: 'Didot',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'division-leclerc',
    name: 'Division Leclerc',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'domaine-cherioux',
    name: 'Domaine Chérioux',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'domont',
    name: 'Domont',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dordives',
    name: 'Dordives',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dourdan',
    name: 'Dourdan',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dourdan-la-foret',
    name: 'Dourdan – La Forêt',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'drancy',
    name: 'Drancy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'drancy-avenir',
    name: 'Drancy – Avenir',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dreux',
    name: 'Dreux',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dugny-la-courneuve',
    name: 'Dugny – La Courneuve',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dugommier',
    name: 'Dugommier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'dupleix',
    name: 'Dupleix',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'duroc',
    name: 'Duroc',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ecole-militaire',
    name: 'École Militaire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ecole-veterinaire-de-maisons-alfort',
    name: 'École Vétérinaire de Maisons-Alfort',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ecouen-ezanville',
    name: 'Écouen – Ézanville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'edgar-quinet',
    name: 'Edgar Quinet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'eglise-dauteuil',
    name: 'Église d’Auteuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'eglise-de-pantin',
    name: 'Église de Pantin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'egly',
    name: 'Égly',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ella-fitzgerald',
    name: 'Ella Fitzgerald',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'emerainville-pontault-combault',
    name: 'Émerainville Pontault-Combault',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'enghien-les-bains',
    name: 'Enghien-les-Bains',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epinay-orgemont',
    name: 'Épinay - Orgemont',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epinay-sur-orge',
    name: 'Épinay-sur-Orge',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epinay-sur-seine',
    name: 'Épinay-sur-Seine',
    aliases: [
      'Épinay-sur-Seine - Gare',
    ],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epinay-villetaneuse',
    name: 'Épinay – Villetaneuse',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epinettes-pouchet',
    name: 'Épinettes – Pouchet',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epluches',
    name: 'Épluches',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'epone-mezieres',
    name: 'Épône – Mézières',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'eragny-neuville',
    name: 'Éragny – Neuville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ermont-halte',
    name: 'Ermont Halte',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ermont-eaubonne',
    name: 'Ermont – Eaubonne',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'esbly',
    name: 'Esbly',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'escadrille-normandie-niemen',
    name: 'Escadrille Normandie-Niémen',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'esplanade-de-la-defense',
    name: 'Esplanade de la Défense',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'essonnes-robinson',
    name: 'Essonnes – Robinson',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'etampes',
    name: 'Étampes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'etienne-marcel',
    name: 'Étienne Marcel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'etrechy',
    name: 'Étréchy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'europe',
    name: 'Europe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'evreux-normandie',
    name: 'Évreux Normandie',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'evry-val-de-seine',
    name: 'Évry Val de Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'evry-courcouronnes',
    name: 'Évry-Courcouronnes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'evry-courcouronnes-centre',
    name: 'Évry-Courcouronnes Centre',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'exelmans',
    name: 'Exelmans',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'faidherbe-chaligny',
    name: 'Faidherbe – Chaligny',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'falguiere',
    name: 'Falguière',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'faremoutiers-pommeuse',
    name: 'Faremoutiers - Pommeuse',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'faubourg-de-larche',
    name: 'Faubourg de l’Arche',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'felix-faure',
    name: 'Félix Faure',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ferme-neuve',
    name: 'Ferme Neuve',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ferrieres-fontenay',
    name: 'Ferrières – Fontenay',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'filles-du-calvaire',
    name: 'Filles du Calvaire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontaine-le-port',
    name: 'Fontaine-le-Port',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontaine-michalon',
    name: 'Fontaine-Michalon',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontainebleau-avon',
    name: 'Fontainebleau – Avon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontenay-aux-roses',
    name: 'Fontenay-aux-Roses',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontenay-le-fleury',
    name: 'Fontenay-le-Fleury',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fontenay-sous-bois',
    name: 'Fontenay-sous-Bois',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fort-daubervilliers',
    name: 'Fort d\'Aubervilliers',
    aliases: [
      'Fort d’Aubervilliers',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'four-peary',
    name: 'Four – Peary',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'fourqueux-bel-air',
    name: 'Fourqueux – Bel Air',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'franconville-le-plessis-bouchard',
    name: 'Franconville Le Plessis Bouchard',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'franconville-le-plessis-bouchard',
    name: 'Franconville – Le Plessis Bouchard',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'franklin-d-roosevelt',
    name: 'Franklin D. Roosevelt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'freinville-sevran',
    name: 'Freinville - Sevran',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'frepillon',
    name: 'Frépillon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'front-populaire',
    name: 'Front Populaire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gabriel-peri',
    name: 'Gabriel Péri',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gagny',
    name: 'Gagny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gaite',
    name: 'Gaîté',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gallieni',
    name: 'Gallieni',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gambetta',
    name: 'Gambetta',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'garancieres-la-queue',
    name: 'Garancières – La Queue',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'garches-marnes-la-coquette',
    name: 'Garches - Marnes-la-Coquette',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-dausterlitz',
    name: 'Gare d’Austerlitz',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-de-gennevilliers',
    name: 'Gare de Gennevilliers',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-de-lest',
    name: 'Gare de l’Est',
    aliases: [
      'Paris Est',
    ],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-de-lyon',
    name: 'Gare de Lyon',
    aliases: [
      'Paris Gare de Lyon',
    ],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-de-noisy-le-sec',
    name: 'Gare de Noisy-le-Sec',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-de-saint-denis',
    name: 'Gare de Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gare-du-nord',
    name: 'Gare du Nord',
    aliases: [
      'Paris Gare du Nord',
      'Paris – Gare du Nord',
    ],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: true,
        served: false,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gargan',
    name: 'Gargan',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gargenville',
    name: 'Gargenville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'garges-sarcelles',
    name: 'Garges – Sarcelles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'garibaldi',
    name: 'Garibaldi',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gaston-roulaud',
    name: 'Gaston Roulaud',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gennevilliers',
    name: 'Gennevilliers',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gentilly',
    name: 'Gentilly',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'george-v',
    name: 'George V',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'georges-brassens',
    name: 'Georges Brassens',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'georges-millandy',
    name: 'Georges Millandy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'georges-pompidou',
    name: 'Georges Pompidou',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'germaine-tailleferre',
    name: 'Germaine Tailleferre',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gif-sur-yvette',
    name: 'Gif-sur-Yvette',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gilbert-bonnemaison',
    name: 'Gilbert Bonnemaison',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gisors',
    name: 'Gisors',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'glaciere',
    name: 'Glacière',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'goncourt',
    name: 'Goncourt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gonesse',
    name: 'Gonesse',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'goussainville',
    name: 'Goussainville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'grand-bourg',
    name: 'Grand Bourg',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'grands-boulevards',
    name: 'Grands Boulevards',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gravigny-balizy',
    name: 'Gravigny – Balizy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gretz-armainvilliers',
    name: 'Gretz-Armainvilliers',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'grigny-centre',
    name: 'Grigny Centre',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'gros-noyer-saint-prix',
    name: 'Gros Noyer – Saint-Prix',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'groslay',
    name: 'Groslay',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'guerard-la-celle-sur-morin',
    name: 'Guérard - La Celle-sur-Morin',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'guy-moquet',
    name: 'Guy Môquet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'guyancourt',
    name: 'Guyancourt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'guynemer',
    name: 'Guynemer',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'haussmann',
    name: 'Haussmann',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: true,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'havre-caumartin',
    name: 'Havre – Caumartin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'helene-boucher',
    name: 'Hélène Boucher',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'henri-farman',
    name: 'Henri Farman',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'herblay-sur-seine',
    name: 'Herblay-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hericy',
    name: 'Héricy',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hoche',
    name: 'Hoche',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'honore-de-balzac',
    name: 'Honoré de Balzac',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-avicenne',
    name: 'Hôpital Avicenne',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-beclere',
    name: 'Hôpital Béclère',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-bicetre',
    name: 'Hôpital Bicêtre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-de-montfermeil',
    name: 'Hôpital de Montfermeil',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-delafontaine',
    name: 'Hôpital Delafontaine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hopital-robert-debre',
    name: 'Hôpital Robert Debré',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hotel-de-ville',
    name: 'Hôtel de Ville',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hotel-de-ville-de-bobigny',
    name: 'Hôtel de Ville de Bobigny',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'hotel-de-ville-de-la-courneuve',
    name: 'Hôtel de Ville de la Courneuve',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'houdan',
    name: 'Houdan',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'houilles-carrieres-sur-seine',
    name: 'Houilles Carrières-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'houilles-carrieres-sur-seine',
    name: 'Houilles - Carrières-sur-Seine',
    aliases: [
      'Houilles – Carrières-sur-Seine',
    ],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'iena',
    name: 'Iéna',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'igny',
    name: 'Igny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'inovel-parc-nord',
    name: 'Inovel Parc Nord',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'invalides',
    name: 'Invalides',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'isles-armentieres-congis',
    name: 'Isles - Armentières - Congis',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'issou-porcheville',
    name: 'Issou – Porcheville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'issy',
    name: 'Issy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'issy-rer',
    name: 'Issy RER',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'issy-val-de-seine',
    name: 'Issy – Val de Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ivry-sur-seine',
    name: 'Ivry-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: true,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jacqueline-auriol',
    name: 'Jacqueline Auriol',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jacques-bonsergent',
    name: 'Jacques Bonsergent',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jacques-prevert',
    name: 'Jacques Prévert',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jacques-henri-lartigue',
    name: 'Jacques-Henri Lartigue',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jardin-parisien',
    name: 'Jardin Parisien',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jasmin',
    name: 'Jasmin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jaures',
    name: 'Jaurès',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'javel',
    name: 'Javel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'javel-andre-citroen',
    name: 'Javel – André Citroën',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jean-moulin',
    name: 'Jean Moulin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jean-rostand',
    name: 'Jean Rostand',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jean-vilar',
    name: 'Jean Vilar',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'joinville-le-pont',
    name: 'Joinville-le-Pont',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'joncherolles',
    name: 'Joncherolles',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jourdain',
    name: 'Jourdain',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jouy-en-josas',
    name: 'Jouy-en-Josas',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jules-joffrin',
    name: 'Jules Joffrin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'jussieu',
    name: 'Jussieu',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'juvisy',
    name: 'Juvisy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'juziers',
    name: 'Juziers',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'kleber',
    name: 'Kléber',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-barre-ormesson',
    name: 'La Barre – Ormesson',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-belle-epine',
    name: 'La Belle Épine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-borne-blanche',
    name: 'La Borne Blanche',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-briqueterie',
    name: 'La Briqueterie',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-celle-saint-cloud',
    name: 'La Celle-Saint-Cloud',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-chapelle',
    name: 'La Chapelle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-courneuve-8-mai-1945',
    name: 'La Courneuve 8 Mai 1945',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-courneuve-aubervilliers',
    name: 'La Courneuve – Aubervilliers',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-courneuve-six-routes',
    name: 'La Courneuve – Six Routes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-croix-de-berny',
    name: 'La Croix de Berny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-defense',
    name: 'La Défense',
    aliases: [
      'La Défense - Grande Arche',
    ],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-dhuys',
    name: 'La Dhuys',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-ferme',
    name: 'La Ferme',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-ferte-alais',
    name: 'La Ferté-Alais',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-ferte-milon',
    name: 'La Ferté-Milon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-ferte-sous-jouarre',
    name: 'La Ferté-sous-Jouarre',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-fourche',
    name: 'La Fourche',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-fraternelle',
    name: 'La Fraternelle',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-frette-montigny',
    name: 'La Frette – Montigny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-garenne-colombes',
    name: 'La Garenne-Colombes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-grande-paroisse',
    name: 'La Grande-Paroisse',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-hacquiniere',
    name: 'La Hacquinière',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-motte-picquet-grenelle',
    name: 'La Motte-Picquet Grenelle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-motte-picquet-grenelle',
    name: 'La Motte-Picquet – Grenelle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-muette',
    name: 'La Muette',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-norville',
    name: 'La Norville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-noue',
    name: 'La Noue',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-plaine-stade-de-france',
    name: 'La Plaine – Stade de France',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-remise-a-jorelle',
    name: 'La Remise à Jorelle',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-tour-maubourg',
    name: 'La Tour-Maubourg',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-varenne-chennevieres',
    name: 'La Varenne Chennevières',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-verriere',
    name: 'La Verrière',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-verrieres',
    name: 'La Verrières',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'la-villetertre',
    name: 'La Villetertre',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'labbaye',
    name: 'L\'Abbaye',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lacepede',
    name: 'Lacépède',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lagny-thorigny',
    name: 'Lagny - Thorigny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lamarck-caulaincourt',
    name: 'Lamarck – Caulaincourt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lamartine',
    name: 'Lamartine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'laplace',
    name: 'Laplace',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lardy',
    name: 'Lardy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'laumiere',
    name: 'Laumière',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lavallee',
    name: 'LaVallée',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-blanc-mesnil',
    name: 'Le Blanc-Mesnil',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-bourget',
    name: 'Le Bourget',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-bourget-aeroport',
    name: 'Le Bourget – Aéroport',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-bras-de-fer-evry-genopole',
    name: 'Le Bras de Fer – Évry Génopole',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-chenay-gagny',
    name: 'Le Chénay – Gagny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-coudray-montceaux',
    name: 'Le Coudray-Montceaux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-guichet',
    name: 'Le Guichet',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-hameau',
    name: 'Le Hameau',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-kremlin-bicetre',
    name: 'Le Kremlin Bicêtre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-luth',
    name: 'Le Luth',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-mee-sur-seine',
    name: 'Le Mée-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-mesnil-amelot',
    name: 'Le Mesnil-Amelot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-parc-de-saint-maur',
    name: 'Le Parc de Saint-Maur',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-peletier',
    name: 'Le Peletier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-perray',
    name: 'Le Perray',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-plessis-belleville',
    name: 'Le Plessis-Belleville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-plessis-chenet',
    name: 'Le Plessis-Chenet',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-raincy-villemomble-montfermeil',
    name: 'Le Raincy Villemomble Montfermeil',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-stade',
    name: 'Le Stade',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-val-dor',
    name: 'Le Val d\'Or',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-vert-de-maisons',
    name: 'Le Vert de Maisons',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-vesinet-centre',
    name: 'Le Vésinet – Centre',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-vesinet-le-pecq',
    name: 'Le Vésinet – Le Pecq',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'le-village',
    name: 'Le Village',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ledru-rollin',
    name: 'Ledru-Rollin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'leon-blum',
    name: 'Léon Blum',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-agnettes',
    name: 'Les Agnettes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-ardoines',
    name: 'Les Ardoines',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-baconnets',
    name: 'Les Baconnets',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-beatus',
    name: 'Les Béatus',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-boullereaux-champigny',
    name: 'Les Boullereaux Champigny',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-cholettes',
    name: 'Les Cholettes',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-clairieres-de-verneuil',
    name: 'Les Clairières de Verneuil',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-coquetiers',
    name: 'Les Coquetiers',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-coteaux',
    name: 'Les Coteaux',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-courtilles',
    name: 'Les Courtilles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-essarts-le-roi',
    name: 'Les Essarts – Le Roi',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-fauvelles',
    name: 'Les Fauvelles',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-flanades',
    name: 'Les Flanades',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-gobelins',
    name: 'Les Gobelins',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-gresillons',
    name: 'Les Grésillons',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-halles',
    name: 'Les Halles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-milons',
    name: 'Les Milons',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-mobiles',
    name: 'Les Mobiles',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-moulineaux',
    name: 'Les Moulineaux',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-mureaux',
    name: 'Les Mureaux',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-noues',
    name: 'Les Noues',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-pavillons-sous-bois',
    name: 'Les Pavillons-sous-Bois',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-peintres',
    name: 'Les Peintres',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-portes-de-saint-cyr',
    name: 'Les Portes de Saint-Cyr',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-sablons',
    name: 'Les Sablons',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-saules',
    name: 'Les Saules',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-vallees',
    name: 'Les Vallées',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'les-yvris-noisy-le-grand',
    name: 'Les Yvris Noisy-le-Grand',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'letang-la-ville',
    name: 'L\'Étang-la-Ville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'letang-les-sablons',
    name: 'L’Étang – Les Sablons',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lhay-les-roses',
    name: 'L’Haÿ-les-Roses',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'liancourt-saint-pierre',
    name: 'Liancourt – Saint-Pierre',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'liberation',
    name: 'Libération',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'liberte',
    name: 'Liberté',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'liege',
    name: 'Liège',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lieusaint-moissy',
    name: 'Lieusaint – Moissy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lile-saint-denis',
    name: 'L’Île-Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'limay',
    name: 'Limay',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lisiere-pereire',
    name: 'Lisière Pereire',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lisle-adam-parmain',
    name: 'L’Isle-Adam – Parmain',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'livry-sur-seine',
    name: 'Livry-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lizy-sur-ourcq',
    name: 'Lizy-sur-Ourcq',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'locheres',
    name: 'Lochères',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lognes',
    name: 'Lognes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'londe',
    name: 'L’Onde',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'longjumeau',
    name: 'Longjumeau',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'longueville',
    name: 'Longueville',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louis-blanc',
    name: 'Louis Blanc',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louise-michel',
    name: 'Louise Michel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lourmel',
    name: 'Lourmel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louveciennes',
    name: 'Louveciennes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louvois',
    name: 'Louvois',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louvre-rivoli',
    name: 'Louvre – Rivoli',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'louvres',
    name: 'Louvres',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lozere',
    name: 'Lozère',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'luxembourg',
    name: 'Luxembourg',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'luzarches',
    name: 'Luzarches',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'lycee-henri-sellier',
    name: 'Lycée Henri Sellier',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mabillon',
    name: 'Mabillon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'madeleine',
    name: 'Madeleine',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'magenta',
    name: 'Magenta',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mail-de-la-plaine',
    name: 'Mail de la Plaine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-daubervilliers',
    name: 'Mairie d\'Aubervilliers',
    aliases: [
      'Mairie d’Aubervilliers',
    ],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-clichy',
    name: 'Mairie de Clichy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-montreuil',
    name: 'Mairie de Montreuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-montrouge',
    name: 'Mairie de Montrouge',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-pierrefitte',
    name: 'Mairie de Pierrefitte',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-saint-ouen',
    name: 'Mairie de Saint-Ouen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-st-ouen',
    name: 'Mairie de St-Ouen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-velizy',
    name: 'Mairie de Vélizy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-vileneuve-la-garenne',
    name: 'Mairie de Vileneuve-la-Garenne',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-de-vitry-sur-seine',
    name: 'Mairie de Vitry-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-des-lilas',
    name: 'Mairie des Lilas',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-dissy',
    name: 'Mairie d’Issy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mairie-divry',
    name: 'Mairie d’Ivry',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maison-blanche',
    name: 'Maison Blanche',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maisons-alfort-alfortville',
    name: 'Maisons-Alfort – Alfortville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maisons-alfort-les-juilliottes',
    name: 'Maisons-Alfort – Les Juilliottes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maisons-alfort-stade',
    name: 'Maisons-Alfort – Stade',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maisons-laffitte',
    name: 'Maisons-Laffitte',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maisse',
    name: 'Maisse',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'malabry',
    name: 'Malabry',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'malakoff-plateau-de-vanves',
    name: 'Malakoff Plateau de Vanves',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'malakoff-rue-etienne-dolet',
    name: 'Malakoff Rue Étienne Dolet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'malesherbes',
    name: 'Malesherbes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mantes-station',
    name: 'Mantes Station',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mantes-la-jolie',
    name: 'Mantes-la-Jolie',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maraichers',
    name: 'Maraîchers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marcadet-poissonniers',
    name: 'Marcadet – Poissonniers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marcel-sembat',
    name: 'Marcel Sembat',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marche-de-saint-denis',
    name: 'Marché de Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marche-de-st-denis',
    name: 'Marché de St-Denis',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marchezais-broue',
    name: 'Marchezais – Broué',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mareil-marly',
    name: 'Mareil – Marly',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mareil-sur-mauldre',
    name: 'Mareil-sur-Mauldre',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mareuil-sur-ourcq',
    name: 'Mareuil-sur-Ourcq',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marguerite-long',
    name: 'Marguerite Long',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marguerite-perey',
    name: 'Marguerite Perey',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marie-de-miribel',
    name: 'Marie de Miribel',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marles-en-brie',
    name: 'Marles-en-Brie',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marly-le-roi',
    name: 'Marly-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marne-la-vallee-chessy',
    name: 'Marne-la-Vallée Chessy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marolles-en-hurepoix',
    name: 'Marolles-en-Hurepoix',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'marx-dormoy',
    name: 'Marx Dormoy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maryse-bastie',
    name: 'Maryse Bastié',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'massy-europe',
    name: 'Massy – Europe',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'massy-opera',
    name: 'Massy – Opéra',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'massy-palaiseau',
    name: 'Massy – Palaiseau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'massy-verrieres',
    name: 'Massy – Verrières',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maubert-mutualite',
    name: 'Maubert – Mutualité',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maule',
    name: 'Maule',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maurecourt',
    name: 'Maurecourt',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maurice-audin',
    name: 'Maurice Audin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'maurice-lachatre',
    name: 'Maurice Lachâtre',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meaux',
    name: 'Meaux',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'melun',
    name: 'Melun',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'menilmontant',
    name: 'Ménilmontant',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mennecy',
    name: 'Mennecy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meriel',
    name: 'Mériel',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mery-sur-oise',
    name: 'Méry-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meudon',
    name: 'Meudon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meudon-val-fleury',
    name: 'Meudon Val Fleury',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meudon-la-foret',
    name: 'Meudon-la-Forêt',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meudon-sur-seine',
    name: 'Meudon-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'meulan-hardricourt',
    name: 'Meulan – Hardricourt',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'michel-bizot',
    name: 'Michel Bizot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'michel-ange-auteuil',
    name: 'Michel-Ange Auteuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'michel-ange-molitor',
    name: 'Michel-Ange Molitor',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'michel-ange-auteuil',
    name: 'Michel-Ange – Auteuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'michel-ange-molitor',
    name: 'Michel-Ange – Molitor',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mirabeau',
    name: 'Mirabeau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'miromesnil',
    name: 'Miromesnil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mitry-claye',
    name: 'Mitry – Claye',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'monceau',
    name: 'Monceau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montargis',
    name: 'Montargis',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montempoivre',
    name: 'Montempoivre',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montereau',
    name: 'Montereau',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montfort-laumaury-mere',
    name: 'Montfort-l’Aumaury – Méré',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montgallet',
    name: 'Montgallet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montgeron-crosne',
    name: 'Montgeron – Crosne',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montgeroult-courcelles',
    name: 'Montgeroult – Courcelles',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montigny-beauchamp',
    name: 'Montigny – Beauchamp',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montigny-sur-loing',
    name: 'Montigny-sur-Loing',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montparnasse-bienvenue',
    name: 'Montparnasse Bienvenüe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montparnasse-bienvenue',
    name: 'Montparnasse – Bienvenüe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montreuil',
    name: 'Montreuil',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montreuil-hopital',
    name: 'Montreuil – Hôpital',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montry-conde',
    name: 'Montry – Condé',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montsoult-maffliers',
    name: 'Montsoult – Maffliers',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'montsouris',
    name: 'Montsouris',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'moret-veneux-les-sablons',
    name: 'Moret – Veneux-les-Sablons',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mormant',
    name: 'Mormant',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mortcerf',
    name: 'Mortcerf',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'moulin-vert',
    name: 'Moulin Vert',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'moulin-galant',
    name: 'Moulin-Galant',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'moulon-campus',
    name: 'Moulon Campus',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mouroux',
    name: 'Mouroux',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'mouton-duvernet',
    name: 'Mouton-Duvernet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'musee-de-sevres',
    name: 'Musée de Sèvres',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'musee-dorsay',
    name: 'Musée d’Orsay',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'musee-mac-val',
    name: 'Musée MAC VAL',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nangis',
    name: 'Nangis',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanterre-universite',
    name: 'Nanterre Université',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanterre-la-boule',
    name: 'Nanterre - La Boule',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanterre-la-folie',
    name: 'Nanterre – La Folie',
    aliases: [
      'Nanterre - La Folie',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanterre-prefecture',
    name: 'Nanterre – Préfecture',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanterre-ville',
    name: 'Nanterre – Ville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanteuil-le-haudouin',
    name: 'Nanteuil-le-Haudouin',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nanteuil-saacy',
    name: 'Nanteuil - Saâcy',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nation',
    name: 'Nation',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nationale',
    name: 'Nationale',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nemours-saint-pierre',
    name: 'Nemours – Saint-Pierre',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'neuilly-plaisance',
    name: 'Neuilly-Plaisance',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'neuilly-porte-maillot',
    name: 'Neuilly – Porte Maillot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'neuville-universite',
    name: 'Neuville Université',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'neuville-universite',
    name: 'Neuville – Université',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nezel-aulnay',
    name: 'Nézel – Aulnay',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nogent-lartaud-charly',
    name: 'Nogent-l\'Artaud - Charly',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nogent-le-perreux',
    name: 'Nogent - Le Perreux',
    aliases: [
      'Nogent – Le Perreux',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nogent-sur-marne',
    name: 'Nogent-sur-Marne',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'nointel-mours',
    name: 'Nointel – Mours',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noisiel',
    name: 'Noisiel',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noisy-champs',
    name: 'Noisy – Champs',
    aliases: [
      'Noisy - Champs',
    ],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noisy-le-grand-mont-dest',
    name: 'Noisy-le-Grand Mont d’Est',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noisy-le-roi',
    name: 'Noisy-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noisy-le-sec',
    name: 'Noisy-le-Sec',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'notre-dame-de-lorette',
    name: 'Notre-Dame-de-Lorette',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'notre-dame-des-anges',
    name: 'Notre-Dame-des-Anges',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'notre-dame-des-champs',
    name: 'Notre-Dame-des-Champs',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'noveos',
    name: 'Noveos',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'oberkampf',
    name: 'Oberkampf',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'odeon',
    name: 'Odéon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'olympiades',
    name: 'Olympiades',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'opera',
    name: 'Opéra',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orangis-bois-de-lepine',
    name: 'Orangis – Bois de l’Épine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orgerus-behoust',
    name: 'Orgerus – Béhoust',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orly-gaston-viens',
    name: 'Orly – Gaston Viens',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orly-ville',
    name: 'Orly – Ville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ormoy-villiers',
    name: 'Ormoy-Villiers',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orry-la-ville-coye',
    name: 'Orry-la-Ville Coye',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'orsay-ville',
    name: 'Orsay – Ville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'osny',
    name: 'Osny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ourcq',
    name: 'Ourcq',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ozoir-la-ferriere',
    name: 'Ozoir-la-Ferrière',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pablo-neruda',
    name: 'Pablo Neruda',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'palais-royal-musee-du-louvre',
    name: 'Palais Royal Musée du Louvre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'palais-royal-musee-du-louvre',
    name: 'Palais-Royal – Musée du Louvre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'palaiseau',
    name: 'Palaiseau',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'palaiseau-villebon',
    name: 'Palaiseau – Villebon',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pantin',
    name: 'Pantin',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-andre-malraux',
    name: 'Parc André Malraux',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-de-sceaux',
    name: 'Parc de Sceaux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-de-st-cloud',
    name: 'Parc de St-Cloud',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-des-chanteraines',
    name: 'Parc des Chanteraines',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-des-expositions',
    name: 'Parc des Expositions',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-des-sports',
    name: 'Parc des Sports',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-du-blanc-mesnil',
    name: 'Parc du Blanc-Mesnil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-du-chateau',
    name: 'Parc du Château',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parc-pierre-lagravere',
    name: 'Parc Pierre Lagravère',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'paris-montparnasse',
    name: 'Paris – Montparnasse',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'parmentier',
    name: 'Parmentier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'passy',
    name: 'Passy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pasteur',
    name: 'Pasteur',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'paul-eluard',
    name: 'Paul Éluard',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'paul-valery',
    name: 'Paul Valéry',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pave-blanc',
    name: 'Pavé Blanc',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pelleport',
    name: 'Pelleport',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pere-lachaise',
    name: 'Père Lachaise',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pereire',
    name: 'Pereire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pereire-levallois',
    name: 'Pereire – Levallois',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pernety',
    name: 'Pernety',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'persan-beaumont',
    name: 'Persan – Beaumont',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'petit-jouy-les-loges',
    name: 'Petit Jouy – Les Loges',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'petit-noisy',
    name: 'Petit Noisy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'petit-pierrefitte',
    name: 'Petit Pierrefitte',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'petit-vaux',
    name: 'Petit Vaux',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'petit-chatenay',
    name: 'Petit-Châtenay',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'philippe-auguste',
    name: 'Philippe Auguste',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'picpus',
    name: 'Picpus',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pierre-de-geyter',
    name: 'Pierre de Geyter',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pierre-et-marie-curie',
    name: 'Pierre et Marie Curie',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pierrefitte-stains',
    name: 'Pierrefitte – Stains',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pierrelaye',
    name: 'Pierrelaye',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pigalle',
    name: 'Pigalle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'place-de-clichy',
    name: 'Place de Clichy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'place-de-la-logistique',
    name: 'Place de la Logistique',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'place-des-fetes',
    name: 'Place des Fêtes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'place-ditalie',
    name: 'Place d’Italie',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'place-monge',
    name: 'Place Monge',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'plaisance',
    name: 'Plaisance',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'plaisir-grignon',
    name: 'Plaisir – Grignon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'plaisir-les-clayes',
    name: 'Plaisir – Les Clayes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pointe-du-lac',
    name: 'Pointe du Lac',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'poissonniere',
    name: 'Poissonnière',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'poissy',
    name: 'Poissy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-cardinet',
    name: 'Pont Cardinet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-bezons',
    name: 'Pont de Bezons',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-bondy',
    name: 'Pont de Bondy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-lalma',
    name: 'Pont de l’Alma',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-levallois-becon',
    name: 'Pont de Levallois Bécon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-neuilly',
    name: 'Pont de Neuilly',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-rungis',
    name: 'Pont de Rungis',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-de-sevres',
    name: 'Pont de Sèvres',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-du-garigliano',
    name: 'Pont du Garigliano',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-marie',
    name: 'Pont Marie',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-neuf',
    name: 'Pont Neuf',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pont-petit',
    name: 'Pont Petit',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ponthierry-pringy',
    name: 'Ponthierry – Pringy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pontoise',
    name: 'Pontoise',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porchefontaine',
    name: 'Porchefontaine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'port-royal',
    name: 'Port-Royal',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-daubervilliers',
    name: 'Porte d’Aubervilliers',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-dauphine',
    name: 'Porte Dauphine',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-dauteuil',
    name: 'Porte d’Auteuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-bagnolet',
    name: 'Porte de Bagnolet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-champerret',
    name: 'Porte de Champerret',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-charenton',
    name: 'Porte de Charenton',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-choisy',
    name: 'Porte de Choisy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-clichy',
    name: 'Porte de Clichy',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-clignancourt',
    name: 'Porte de Clignancourt',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-la-chapelle',
    name: 'Porte de la Chapelle',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-la-villette',
    name: 'Porte de la Villette',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-lessonne',
    name: 'Porte de l’Essonne',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-montreuil',
    name: 'Porte de Montreuil',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-pantin',
    name: 'Porte de Pantin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-rungis',
    name: 'Porte de Rungis',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-saint-cloud',
    name: 'Porte de Saint-Cloud',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-saint-ouen',
    name: 'Porte de Saint-Ouen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-st-ouen',
    name: 'Porte de St-Ouen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-vanves',
    name: 'Porte de Vanves',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-versailles',
    name: 'Porte de Versailles',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-de-vincennes',
    name: 'Porte de Vincennes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-des-lilas',
    name: 'Porte des Lilas',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3bis',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-dissy',
    name: 'Porte d’Issy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-ditalie',
    name: 'Porte d’Italie',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: true,
        served: false,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-divry',
    name: 'Porte d’Ivry',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-doree',
    name: 'Porte Dorée',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-dorleans',
    name: 'Porte d’Orléans',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'porte-maillot',
    name: 'Porte Maillot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'poterne-des-peupliers',
    name: 'Poterne des Peupliers',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pre-saint-gervais',
    name: 'Pré-Saint-Gervais',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7bis',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'precy-sur-oise',
    name: 'Précy-sur-Oise',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'presles-courcelles',
    name: 'Presles – Courcelles',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'provins',
    name: 'Provins',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'puteaux',
    name: 'Puteaux',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pyramides',
    name: 'Pyramides',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'pyrenees',
    name: 'Pyrénées',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'quai-de-la-gare',
    name: 'Quai de la Gare',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'quai-de-la-rapee',
    name: 'Quai de la Rapée',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'quatre-septembre',
    name: 'Quatre-Septembre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rambouillet',
    name: 'Rambouillet',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rambuteau',
    name: 'Rambuteau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ranelagh',
    name: 'Ranelagh',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'raspail',
    name: 'Raspail',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'reaumur-sebastopol',
    name: 'Réaumur – Sébastopol',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rennes',
    name: 'Rennes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'republique',
    name: 'République',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'republique-marx-dormoy',
    name: 'République - Marx Dormoy',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'reuilly-diderot',
    name: 'Reuilly – Diderot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'richard-lenoir',
    name: 'Richard-Lenoir',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'richelieu-drouot',
    name: 'Richelieu – Drouot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'riquet',
    name: 'Riquet',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ris-orangis',
    name: 'Ris-Orangis',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'robert-schuman',
    name: 'Robert Schuman',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'robert-wagner',
    name: 'Robert Wagner',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'robespierre',
    name: 'Robespierre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'robinson',
    name: 'Robinson',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'roger-semat',
    name: 'Roger Sémat',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'roissy-en-brie',
    name: 'Roissy-en-Brie',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'romain-rolland',
    name: 'Romain Rolland',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'romainville-carnot',
    name: 'Romainville – Carnot',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rome',
    name: 'Rome',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rosa-parks',
    name: 'Rosa Parks',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rose-bertin-centre-commercial',
    name: 'Rose Bertin - Centre Commercial',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rosny-bois-perrier',
    name: 'Rosny – Bois Perrier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rosny-bois-perrier',
    name: 'Rosny-Bois-Perrier',
    aliases: [
      'Rosny – Bois-Perrier',
    ],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rosny-sous-bois',
    name: 'Rosny-sous-Bois',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rosny-sur-seine',
    name: 'Rosny-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rougemont-chanteloup',
    name: 'Rougemont - Chanteloup',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rouget-de-lisle',
    name: 'Rouget de Lisle',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rue-de-la-pompe',
    name: 'Rue de la Pompe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rue-des-boulets',
    name: 'Rue des Boulets',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rue-du-bac',
    name: 'Rue du Bac',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rue-saint-maur',
    name: 'Rue Saint-Maur',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rueil-malmaison',
    name: 'Rueil-Malmaison',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rueil-suresnes-mont-valerien',
    name: 'Rueil - Suresnes - Mont Valérien',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'rungis-la-fraternelle',
    name: 'Rungis – La Fraternelle',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saarinen',
    name: 'Saarinen',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-ambroise',
    name: 'Saint-Ambroise',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-augustin',
    name: 'Saint-Augustin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-cheron',
    name: 'Saint-Chéron',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-cloud',
    name: 'Saint-Cloud',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-cyr',
    name: 'Saint-Cyr',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis',
    name: 'Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis-pleyel',
    name: 'Saint-Denis Pleyel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: true,
        served: false,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis-pte-de-paris',
    name: 'Saint-Denis Pte de Paris',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis-gare',
    name: 'Saint-Denis - Gare',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis-pleyel',
    name: 'Saint-Denis – Pleyel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: true,
        served: false,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-denis-porte-de-paris',
    name: 'Saint-Denis - Porte de Paris',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-fargeau',
    name: 'Saint-Fargeau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3bis',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-francois-xavier',
    name: 'Saint-François-Xavier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-georges',
    name: 'Saint-Georges',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-germain-des-pres',
    name: 'Saint-Germain-des-Prés',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-germain-en-laye',
    name: 'Saint-Germain-en-Laye',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-gratien',
    name: 'Saint-Gratien',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-jacques',
    name: 'Saint-Jacques',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-lazare',
    name: 'Saint-Lazare',
    aliases: [
      'Paris Saint-Lazare',
    ],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-leu-desserent',
    name: 'Saint-Leu-d’Esserent',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-leu-la-foret',
    name: 'Saint-Leu-la-Forêt',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-mammes',
    name: 'Saint-Mammès',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-mande',
    name: 'Saint-Mandé',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-marcel',
    name: 'Saint-Marcel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-martin-detampes',
    name: 'Saint-Martin-d’Étampes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-maur-creteil',
    name: 'Saint-Maur - Créteil',
    aliases: [
      'Saint-Maur – Créteil',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-michel',
    name: 'Saint-Michel',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-michel-notre-dame',
    name: 'Saint-Michel – Notre-Dame',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: false,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-michel-sur-orge',
    name: 'Saint-Michel-sur-Orge',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-nom-la-breteche-foret-de-marly',
    name: 'Saint-Nom-la-Bretèche Forêt de Marly',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-nom-la-breteche-foret-de-marly',
    name: 'Saint-Nom-la-Bretèche - Forêt de Marly',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '13',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-ouen',
    name: 'Saint-Ouen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-ouen-laumone',
    name: 'Saint-Ouen-l’Aumône',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-ouen-laumone-liesse',
    name: 'Saint-Ouen-l’Aumône Liesse',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-ouen-laumone-liesse',
    name: 'Saint-Ouen-l’Aumône – Liesse',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-paul',
    name: 'Saint-Paul',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-philippe-du-roule',
    name: 'Saint-Philippe du Roule',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-placide',
    name: 'Saint-Placide',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-quentin-en-yvelines',
    name: 'Saint-Quentin en-Yvelines',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-quentin-en-yvelines',
    name: 'Saint-Quentin-en-Yvelines',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-quentin-en-yvelines-montigny-le-bretonneux',
    name: 'Saint-Quentin-en-Yvelines Montigny-le-Bretonneux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-remy-les-chevreuse',
    name: 'Saint-Rémy lès-Chevreuse',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-sebastien-froissart',
    name: 'Saint-Sébastien – Froissart',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'saint-sulpice',
    name: 'Saint-Sulpice',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sainte-colombe-septveilles',
    name: 'Sainte-Colombe - Septveilles',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sainte-genevieve-des-bois',
    name: 'Sainte-Geneviève-des-Bois',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sannois',
    name: 'Sannois',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'santeuil-le-perchay',
    name: 'Santeuil – Le Perchay',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sarcelles-saint-brice',
    name: 'Sarcelles – Saint-Brice',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sartrouville',
    name: 'Sartrouville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'satory',
    name: 'Satory',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'savigny-le-temple-nandy',
    name: 'Savigny-le-Temple – Nandy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'savigny-sur-orge',
    name: 'Savigny-sur-Orge',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sceaux',
    name: 'Sceaux',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'segur',
    name: 'Ségur',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sentier',
    name: 'Sentier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'serge-gainsbourg',
    name: 'Serge Gainsbourg',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sermaise',
    name: 'Sermaise',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'seugy',
    name: 'Seugy',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'severine',
    name: 'Séverine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevran-beaudottes',
    name: 'Sevran Beaudottes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevran-beaudottes',
    name: 'Sevran – Beaudottes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevran-livry',
    name: 'Sevran – Livry',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '16',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevres-babylone',
    name: 'Sèvres – Babylone',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevres-lecourbe',
    name: 'Sèvres – Lecourbe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevres-rive-gauche',
    name: 'Sèvres – Rive Gauche',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevres-ville-davray',
    name: 'Sèvres – Ville d’Avray',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sevres-ville-davray',
    name: 'Sèvres - Ville-d\'Avray',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'simplon',
    name: 'Simplon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'soleil-levant',
    name: 'Soleil Levant',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'solferino',
    name: 'Solférino',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'souppes-chateau-landon',
    name: 'Souppes – Château-Landon',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'square-sainte-odille',
    name: 'Square Sainte-Odille',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'st-denis-universite',
    name: 'St-Denis Université',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '5',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stade-charlety',
    name: 'Stade Charléty',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3a',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stade-de-france',
    name: 'Stade de France',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stade-de-france-saint-denis',
    name: 'Stade de France – Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stade-geo-andre',
    name: 'Stade Géo André',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stains-la-cerisaie',
    name: 'Stains – La Cerisaie',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'stalingrad',
    name: 'Stalingrad',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '5',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'strasbourg-saint-denis',
    name: 'Strasbourg – Saint-Denis',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '8',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sucy-bonneuil',
    name: 'Sucy – Bonneuil',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'sully-morland',
    name: 'Sully – Morland',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'suresnes-longchamp',
    name: 'Suresnes – Longchamp',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'suresnes-mont-valerien',
    name: 'Suresnes - Mont Valérien',
    aliases: [
      'Suresnes – Mont Valérien',
    ],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'survilliers-fosses',
    name: 'Survilliers Fosses',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'suzanne-lenglen',
    name: 'Suzanne Lenglen',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '8',
        walk: true,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '3a',
        walk: true,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'suzanne-valadon',
    name: 'Suzanne Valadon',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '5',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'tacoignieres-richebourg',
    name: 'Tacoignières – Richebourg',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'taverny',
    name: 'Taverny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'telegraphe',
    name: 'Télégraphe',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '11',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'temple',
    name: 'Temple',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'ternes',
    name: 'Ternes',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'theatre-gerard-philipe',
    name: 'Théâtre Gérard Philipe',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'theatre-la-piscine',
    name: 'Théâtre La Piscine',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'therese-pierre',
    name: 'Thérèse Pierre',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '3b',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'thiais-orly',
    name: 'Thiais – Orly',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'thieux-nantouillet',
    name: 'Thieux – Nantouillet',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'K',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'thomery',
    name: 'Thomery',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'thun-le-paradis',
    name: 'Thun-le-Paradis',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'timbaud',
    name: 'Timbaud',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'tolbiac',
    name: 'Tolbiac',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'torcy',
    name: 'Torcy',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'tournan-en-brie',
    name: 'Tournan-en-Brie',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'traite-de-rome',
    name: 'Traité de Rome',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trappes',
    name: 'Trappes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'triangle-de-gonesse',
    name: 'Triangle de Gonesse',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '17',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '19',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trie-chateau',
    name: 'Trie-Château',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'triel-sur-seine',
    name: 'Triel-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trilport',
    name: 'Trilport',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trinite-destienne-dorves',
    name: 'Trinité – d’Estienne d’Orves',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trocadero',
    name: 'Trocadéro',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '6',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'trois-communes',
    name: 'Trois Communes',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'tuileries',
    name: 'Tuileries',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'us',
    name: 'Us',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaires-torcy',
    name: 'Vaires - Torcy',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'val-dargenteuil',
    name: 'Val d’Argenteuil',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'val-de-fontenay',
    name: 'Val de Fontenay',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '1',
        walk: false,
        served: false,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '1',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'val-deurope',
    name: 'Val d’Europe',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vallee-aux-loups',
    name: 'Vallée aux Loups',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'valmondois',
    name: 'Valmondois',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaneau',
    name: 'Vaneau',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '10',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vanves-malakoff',
    name: 'Vanves – Malakoff',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'varenne',
    name: 'Varenne',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '13',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vauban',
    name: 'Vauban',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vauboyen',
    name: 'Vauboyen',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaucelles',
    name: 'Vaucelles',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaucresson',
    name: 'Vaucresson',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaugirard',
    name: 'Vaugirard',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vaux-sur-seine',
    name: 'Vaux-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vavin',
    name: 'Vavin',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '4',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'velizy-2',
    name: 'Vélizy 2',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'verdun-hoche',
    name: 'Verdun – Hoche',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'verneuil-letang',
    name: 'Verneuil-l\'Étang',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'P',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vernon-giverny',
    name: 'Vernon – Giverny',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vernou-sur-seine',
    name: 'Vernou-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vernouillet-verneuil',
    name: 'Vernouillet – Verneuil',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'versailles-chantiers',
    name: 'Versailles Chantiers',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'versailles-chateau',
    name: 'Versailles Château',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'versailles-rive-droite',
    name: 'Versailles Rive Droite',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'versailles-chantiers',
    name: 'Versailles – Chantiers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '18',
        walk: false,
        served: true,
      },
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'U',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'V',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vert-galant',
    name: 'Vert-Galant',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'viarmes',
    name: 'Viarmes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'victor-basch',
    name: 'Victor Basch',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'victor-hugo',
    name: 'Victor Hugo',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vigneux-sur-seine',
    name: 'Vigneux-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villabe',
    name: 'Villabé',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villaines',
    name: 'Villaines',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'H',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villejuif-leo-lagrange',
    name: 'Villejuif Léo Lagrange',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villejuif-louis-aragon',
    name: 'Villejuif Louis Aragon',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villejuif-paul-vaillant-couturier',
    name: 'Villejuif Paul Vaillant-Couturier',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villejuif-gustave-roussy',
    name: 'Villejuif - Gustave Roussy',
    aliases: [
      'Villejuif – Gustave Roussy',
    ],
    services: [
      {
        mode: 'METRO',
        index: '14',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villejuif-louis-aragon',
    name: 'Villejuif - Louis Aragon',
    aliases: [
      'Villejuif – Louis Aragon',
    ],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '7',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '7',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villeneuve-triage',
    name: 'Villeneuve Triage',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villeneuve-le-roi',
    name: 'Villeneuve-le-Roi',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villeneuve-saint-georges',
    name: 'Villeneuve-Saint-Georges',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villennes-sur-seine',
    name: 'Villennes-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'J',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villeparisis-mitry-le-neuf',
    name: 'Villeparisis Mitry-le-Neuf',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villepinte',
    name: 'Villepinte',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'B',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villepreux-les-clayes',
    name: 'Villepreux – Les Clayes',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villetaneuse-universite',
    name: 'Villetaneuse Université',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villetaneuse-universite',
    name: 'Villetaneuse – Université',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '11',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '8',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villiers',
    name: 'Villiers',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '2',
        walk: false,
        served: true,
      },
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villiers-neauphle-pontchartrain',
    name: 'Villiers Neauphle – Pontchartrain',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villiers-le-bel-gonesse-arnouville',
    name: 'Villiers-le-Bel – Gonesse – Arnouville',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villiers-montbarbin',
    name: 'Villiers – Montbarbin',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '14',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'villiers-sur-marne-le-plessis-trevise',
    name: 'Villiers-sur-Marne Le Plessis-Trévise',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'E',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vincennes',
    name: 'Vincennes',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'A',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'viroflay-rive-gauche',
    name: 'Viroflay Rive Gauche',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'viroflay-rive-droite',
    name: 'Viroflay - Rive Droite',
    aliases: [
      'Viroflay – Rive Droite',
    ],
    services: [
      {
        mode: 'TRAIN',
        index: 'L',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'viroflay-rive-gauche',
    name: 'Viroflay – Rive Gauche',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: false,
      },
      {
        mode: 'TRAIN',
        index: 'N',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '6',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'viry-chatillon',
    name: 'Viry-Châtillon',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vitry-centre',
    name: 'Vitry Centre',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '15',
        walk: false,
        served: true,
      },
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: false,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vitry-sur-seine',
    name: 'Vitry-sur-Seine',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'C',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'volontaires',
    name: 'Volontaires',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '12',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'voltaire',
    name: 'Voltaire',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vosves',
    name: 'Vosves',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'vulaines-sur-seine-samoreau',
    name: 'Vulaines-sur-Seine – Samoreau',
    aliases: [],
    services: [
      {
        mode: 'TRAIN',
        index: 'R',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'wagram',
    name: 'Wagram',
    aliases: [],
    services: [
      {
        mode: 'METRO',
        index: '3',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'watteau-rondenay',
    name: 'Watteau – Rondenay',
    aliases: [],
    services: [
      {
        mode: 'TRAM',
        index: '9',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
  {
    id: 'yerres',
    name: 'Yerres',
    aliases: [],
    services: [
      {
        mode: 'RER',
        index: 'D',
        walk: false,
        served: true,
      },
    ],
    source: 'CLU',
  },
]

export function normalizeStopSuggestionText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’']/g, '')
    .replace(/[–—‑-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function suggestionTextScore(
  suggestion: StopSuggestion,
  query: string,
) {
  const candidates = [
    suggestion.name,
    ...suggestion.aliases,
  ].map(normalizeStopSuggestionText)

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

    const words = candidate.split(' ')

    if (words.some(word => word.startsWith(query))) {
      score = Math.max(score, 600)
      continue
    }

    if (candidate.includes(query)) {
      score = Math.max(score, 400)
    }
  }

  return score
}

export function searchStopSuggestions(
  value: string,
  options: {
    currentMode?: StopSuggestionMode | null
    currentIndex?: string | null
    limit?: number
  } = {},
) {
  const query = normalizeStopSuggestionText(value)

  if (query.length < 2) {
    return []
  }

  const {
    currentMode = null,
    currentIndex = null,
    limit = 6,
  } = options

  return stopSuggestionsCatalog
    .map((suggestion) => {
      let score = suggestionTextScore(
        suggestion,
        query,
      )

      if (score === 0) {
        return null
      }

      if (currentMode && currentIndex) {
        const servedByCurrentLine =
          suggestion.services.some(
            service =>
              service.served
              && service.mode === currentMode
              && service.index === currentIndex,
          )

        if (servedByCurrentLine) {
          score += 250
        }
      }

      score -= normalizeStopSuggestionText(
        suggestion.name,
      ).length / 1000

      return {
        suggestion,
        score,
      }
    })
    .filter(
      (result): result is {
        suggestion: StopSuggestion
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

export function getStopSuggestionById(
  id: string,
) {
  return stopSuggestionsCatalog.find(
    suggestion => suggestion.id === id,
  ) ?? null
}