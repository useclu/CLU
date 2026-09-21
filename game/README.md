# CLU Métropole

CLU Métropole est le mode jeu de CLU.

## Principes techniques

- Le jeu est accessible depuis `/game`.
- Le jeu ne dépend pas de `/editor`.
- Le gameplay fonctionne côté client.
- Aucun backend n'est requis pour le gameplay.
- Aucune API payante n'est requise.
- Les sauvegardes sont stockées localement sur l'appareil.
- Les systèmes du jeu sont séparés par domaine.
- Les données configurables sont séparées du moteur.
- Les composants spécifiques au jeu restent dans `game/`.

## Structure

- `components/` : interface du jeu
- `composables/` : logique Vue/Nuxt
- `config/` : configuration générale
- `data/` : données statiques et configurables
- `engine/` : moteur de simulation
- `storage/` : sauvegardes locales, copies de secours et import/export
- `types/` : types TypeScript
- `utils/` : outils génériques internes au jeu
- `assets/` : ressources propres à CLU Métropole

La page Nuxt `pages/game/index.vue` est volontairement minimale :
elle sert uniquement de porte d'entrée vers le dossier `game/`.

## Version gameplay actuelle

- V44 / Internationalisation & sauvegardes : 8 langues (FR/EN/DE/NL/ES/IT/PT/PL), formats locaux et choix persistant ; quotas séparés de 10 parties libres et 10 sauvegardes Défi, avec nettoyage automatique des Défis après 30 jours.
- V43 / Audit final technique : cohérence complète avant i18n, suppression définitive du fallback PMTiles réseau et historique hebdomadaire borné/dédupliqué sur les parties très longues.
- V42 / Accessibilité : navigation clavier et focus visibles, sémantique des dialogues/onglets, fermeture Échap, recherche de ville en combobox, contraste renforcé et respect automatique de `prefers-reduced-motion`.
- V41 / Grand check-up : audit intégral, garde-fous longue durée, historiques bornés et nettoyage cohérent lors de la suppression de lignes.
- V40 / Gros Lot 23 : Cartes réelles Open Data 1.0, bascule des territoires vers de vrais fonds OpenStreetMap/Protomaps locaux et pipeline reproductible.
- V39 / Gros Lot 22 : Tutoriel & Wiki 1.0, coach interactif sur les vraies actions, progression locale persistante, Wiki recherchable et aide contextuelle depuis les modules de jeu.
- V38 / Gros Lot 21 : Défis 1.0, Défi du jour déterministe sur carte réelle, timer réel jusqu’à 60 minutes, lecture seule forte, archives quotidiennes optionnelles expirant après 30 jours, Défi entre amis par code et résultats comparables.
- V37 / Gros Lot 20 : Expérience Premium, menu principal refondu, soundtrack hors ligne, mixeur audio, marqueurs de station DOM robustes et coût/longueur du prochain segment prévisualisés en temps réel.
- V36 / Gros Lot 19 : CLU Roast 1.0, historique et popup contextuelle, correction robuste des marqueurs de station et dock de conception responsive.
- V35 / Gros Lot 18 : Tracé intelligent & Cartographie 4.0, routage assisté par mode, points de passage libres, géométrie persistante des segments, corridors conseillés et correction définitive des marqueurs de station.
- V34 / Correctif majeur : Carte fictive régionale 3.0, tissu urbain riche, infrastructures, arrêts à halo blanc et véhicules noirs réduits.
- V33 / Correctif majeur : écran de chargement animé, chargement des cartes stabilisé et vrais drapeaux SVG.
- V32 / Gros Lot 17 : 11 territoires réels jouables, Carte fictive régionale 2.0 avec départements/centaines de communes/multiples pôles, drapeaux dans le sélecteur et nouvelle distinction visuelle petits points d’arrêt / gros véhicules ambrés semi-transparents.
- V31 / Gros Lot 16 : première version des métropoles fictives procédurales par seed ; le générateur régional et la convention visuelle de V31 sont supersédés par V32.
- V30 / Gros Lot 15 : correctif de visibilité des tracés V29, catalogue territorial universel, choix de carte visuel (Random / Carte fictive / territoires réels) et sauvegardes réellement multi-territoires.
- V29 / Gros Lot 14 : Carte & Tracés 2.0, courbes locales bornées, bifurcations plus propres, sélection/focus premium, aperçu de construction, rendu gros réseaux optimisé et fondations multi-territoires.
- V28 / Gros Lot 13 : Bilan permanent, snapshots hebdomadaires, records, histoire de partie et Annuler/Rétablir de tracé.
- V27 / Gros Lot 12 : Événements & Communes 2.0, priorisation du centre d’attention et préparation du réglage CLU Roast.
- V26 / Gros Lot 11 : Sauvegardes 2.0, export/import `.clumetro`, duplication, renommage, backups de migration, refus des saves futures et vocabulaire Conception/Construction/En service.
- V25.1 : paramètres globaux sombres et confort joueur ; suppression du thème clair.
- V24 / Gros Lot 9 : Économie 2.0, financement public, crédit clarifié et corrections de tracé/branches.
- Les valeurs de balancing économique restent centralisées dans `config/`.


## Gros Lot 12 — Événements & Communes 2.0 (V27)

V27 enrichit les propositions communales (dont le renforcement de service), les négociations et l’historique territorial. Les événements deviennent contextuels aux résultats réels du réseau, le centre Événements & Infos priorise les trois urgences principales, et le réglage CLU Roast est préparé dans les paramètres.


## Gros Lot 13 — Bilan & historique (V28)

V28 ajoute un Bilan permanent accessible depuis la barre principale, un historique structuré en semaines de 7 jours, des snapshots persistants, des comparaisons et courbes, des records et une timeline. La conception/modification des lignes dispose aussi d'un vrai Annuler/Rétablir temporaire avant validation.


## Gros Lot 14 — Carte & Tracés 2.0 (V29)

V29 remplace le tracé visuel strictement angulaire par un lissage local borné qui conserve chaque station comme point exact et ne peut pas reproduire les grandes boucles de l'ancienne spline globale. Les branches disposent d'un départ tangent au tronc lorsque c'est possible. La carte met en retrait les lignes hors contexte, distingue mieux terminus/bifurcations/correspondances, adapte l'épaisseur au zoom, affiche un aperçu du prochain segment pendant la conception et sépare légèrement les corridors réellement partagés.

Le renderer du réseau est désormais unique dans `GameMap` : l'ancien overlay MapBridge ne redessine plus toutes les lignes. Les véhicules peuvent mettre à jour leur seule source sans recalculer la géométrie du réseau. Une cache de géométrie visuelle limite également les recalculs de courbes.

La configuration de l'Île-de-France est centralisée dans `config/territories.ts` (basemap, limites, centre, fichiers de communes, palette territoriale et locale). Le moteur territorial charge maintenant les datasets par territoire afin de préparer les futures cartes sans créer un moteur spécifique par ville.


## Gros Lot 15 — Territoires & choix de carte 1.0 (V30)

V30 sécurise d'abord le rendu des polylignes après la régression visuelle V29 : une couche centrale sans `line-offset` garantit que les tracés restent visibles tout en conservant les courbes locales bornées et la topologie des branches.

La création de partie dispose maintenant d'un véritable sélecteur de cartes avec Random, l'emplacement de la future Carte fictive par seed et le catalogue des 11 territoires réels prévus : Paris / Île-de-France, Londres, Berlin, Randstad, Bruxelles, Madrid, Milan, Varsovie, Lisbonne, Prague et Berne. Seule l'Île-de-France possède son dataset dans V30 ; les autres cartes sont présentées honnêtement comme « À venir ».

Le territoire sélectionné est réellement transmis à la création de sauvegarde. Le format d'import/export reconnaît le catalogue multi-territoires et refuse proprement de charger un territoire dont le dataset n'est pas installé, au lieu de substituer silencieusement Paris.


## Gros Lot 16 — Métropoles fictives procédurales 1.0 (V31)

V31 rend la tuile « Carte fictive » réellement jouable. Le générateur est entièrement local et déterministe : une seed et quatre paramètres (taille, densité, structure urbaine et eau) reconstruisent les mêmes communes, populations, pôles et éléments de fond à chaque chargement. La sauvegarde ne duplique donc pas le dataset généré ; elle stocke uniquement les paramètres nécessaires à sa reconstruction.

Le fond procédural contient des zones urbanisées, parcs, eau, axes routiers, rails décoratifs, bâtiments stylisés et libellés de pôles. Les communes générées passent ensuite dans le moteur territorial normal : demandes communales, fréquentation liée à la population, objectifs et bilan n'utilisent pas un moteur parallèle.

V31 fixe aussi une convention cartographique simple : les stations/arrêts sont des carrés visibles dès le zoom régional tandis que les véhicules restent des points ronds. Une couche de hit-test invisible garde les stations faciles à sélectionner sans modifier leur apparence.

## Gros Lot 17 — Territoires jouables & Carte fictive régionale 2.0 (V32)

V32 remplace la petite génération urbaine de V31 par un générateur régional déterministe : selon la taille choisie, une seed produit 110 à 240 communes, 5 à 8 départements, 10 à 21 pôles urbains, ainsi que population, eau, relief stylisé, réseaux routiers/ferroviaires de fond, zones urbanisées et bâtiments. Une carte fictive reste reconstruite localement à partir de ses paramètres et utilise exactement le même moteur de simulation que les autres territoires.

Le catalogue rend jouables Paris / Île-de-France, Londres, Berlin, Randstad, Bruxelles, Madrid, Milan, Varsovie, Lisbonne, Prague et Berne. Paris conserve son dataset PMTiles/communes détaillé ; les dix nouvelles cartes utilisent des datasets régionaux locaux de gameplay, structurés autour de vrais grands pôles et d'une géographie régionale approximative, sans prétendre reproduire rue par rue une cartographie exhaustive. New York, Montréal et Tokyo sont affichés comme territoires futurs « À venir ».

Le sélecteur de cartes affiche désormais les drapeaux des pays à la place des codes FR/GB/DE. Sur la carte, les stations redeviennent de petits points fixes ; les véhicules sont volontairement beaucoup plus gros, ambrés et semi-transparents afin de ne plus être confondus avec les arrêts.



## Carte fictive régionale 3.0 & lisibilité réseau (V34)

V34 reprend la génération fictive en profondeur. Le territoire conserve son échelle régionale (départements, centaines de communes, pôles multiples), mais ajoute désormais un véritable tissu urbain procédural : îlots résidentiels/commerciaux/industriels, grilles de rues locales, avenues radiales, rocades, axes régionaux plus sinueux, maillage ferroviaire de fond, bâtiments regroupés par hauteur, aéroports et équipements (hôpitaux, universités, centres commerciaux, stades et quartiers d'affaires). Le GeoJSON reste compact grâce aux géométries MultiPolygon/MultiLineString afin de préserver le chargement stabilisé en V33.

À faible zoom, les limites communales des cartes fictives sont volontairement moins dominantes pour laisser lire la ville, les axes et les zones bâties. Les détails apparaissent progressivement avec le zoom : îlots, rues, bâtiments puis 2.5D. Les anciennes cartes fictives V31-V33 sont migrées vers la génération V34.

La convention visuelle du réseau est également renforcée : un arrêt est un point de la couleur de sa ligne entouré d'un halo blanc franc, visible dès le zoom régional ; les véhicules restent noirs semi-transparents mais sont légèrement réduits.


## Gros Lot 18 — Tracé intelligent & Cartographie 4.0 (V35)

V35 transforme le dessin d'une ligne en tracé assisté. Entre deux stations, le moteur peut désormais rechercher un chemin sur les infrastructures disponibles : le bus privilégie la voirie, le tram les rues structurantes et les corridors ferroviaires, le RER/train les rails, tandis que le métro reste volontairement plus libre. Le générateur de métropoles fictives passe en version 3 (plus de communes avec tissu urbain visible et davantage de liaisons régionales), tandis que le joueur conserve toujours le dernier mot grâce aux modes Assisté/Libre et à des points de passage invisibles qui permettent de forcer un détour sans créer une fausse station.

La géométrie proposée est prévisualisée avant le clic puis enregistrée segment par segment dans la ligne. Elle est donc utilisée par le rendu, la longueur économique du projet, les temps de parcours et la position visuelle des véhicules ; les courbes ne sont plus une simple décoration déconnectée de la simulation. Les branches, prolongements, modifications et l'historique Annuler/Rétablir restent compatibles. Les anciennes lignes sans géométrie V35 continuent d'utiliser le rendu adaptatif V29/V30 et ne sont pas cassées par la migration.

Pendant une conception assistée, la carte peut souligner discrètement les corridors pertinents pour le mode choisi afin d'expliquer le chemin proposé. Les cartes fictives montrent leurs îlots, rues, bâtiments et POI plus tôt au zoom pour mieux lire le tissu urbain. Les stations sont désormais rendues par une couche unique au-dessus du réseau : petit point de la couleur de la ligne avec contour blanc. Les véhicules restent noirs semi-transparents et sont encore légèrement réduits.

## Correctif majeur de chargement & lisibilité carte (V33)

V33 stabilise le chantier territoires de V32. Les arrêts utilisent désormais la couleur exacte de leur ligne avec un contour blanc, tandis que les véhicules sont de gros points noirs semi-transparents. Le sélecteur de cartes n'utilise plus les emoji-drapeaux (qui s'affichaient comme FR/GB/DE sous Windows) : les drapeaux sont dessinés directement en SVG dans l'interface.

L'entrée dans une partie passe maintenant par un véritable écran de chargement plein écran, animé, avec étapes et progression. Le HUD de jeu reste masqué jusqu'à ce que le territoire, la carte et les systèmes de partie soient prêts. En cas d'échec ou de délai anormal, l'écran affiche une erreur explicite avec Réessayer / Retour au menu au lieu de rester indéfiniment sur « Initialisation de la carte… ».

Pour les territoires locaux et procéduraux, MapLibre démarre avec un style minimal puis charge le GeoJSON régional après l'initialisation du moteur. Cela évite que le chargement global attende le parsing de toute la région. Le fond procédural a aussi été allégé sur les détails invisibles à l'échelle régionale (notamment les milliers de petits bâtiments et labels secondaires), sans réduire le nombre de communes, départements ou pôles utilisés par la simulation.


## Gros Lot 19 — CLU Roast & personnalité (V36)

V36 active enfin CLU Roast. Le système est 100 % local : il analyse le rapport de simulation et la situation financière après une journée, sélectionne une situation réellement remarquable (saturation, déficit, dette, parc surdimensionné, qualité, attente, excellente performance, etc.) puis choisit une phrase dans une banque dédiée. Les messages n'ont aucun effet caché sur l'économie ou le moral. Un cooldown global, un cooldown par catégorie et une mémoire des dernières phrases limitent les répétitions.

La banque française contient 55 variantes, avec 33 références football et 22 références culture générale. Elle est séparée du moteur afin que le futur chantier langues puisse fournir des banques propres à chaque locale plutôt que de traduire littéralement les blagues. Le joueur peut désactiver complètement CLU Roast ou choisir Rare / Standard / Fréquent dans les paramètres globaux. Les Roast récents sont conservés dans la sauvegarde et visibles dans Événements & Infos. La notification de jeu apparaît en bas à droite, juste à gauche des contrôles de zoom, sans interrompre les actions.

V36 corrige aussi les deux régressions visuelles signalées en V35 : les stations utilisent maintenant deux couches MapLibre distinctes (halo blanc puis cœur couleur de ligne), remontées au-dessus du réseau à chaque rafraîchissement ; et le dock de conception est réparti sur plusieurs lignes adaptatives. Le bouton de point de passage est retiré de l'interface afin de garder Assisté / Libre simple et lisible.


## Gros Lot 20 — Expérience Premium (V37)

V37 transforme l'accueil en véritable menu de jeu : dernière partie mise en avant, navigation Nouvelle partie / En ligne / Défi / Sauvegardes / Paramètres, version visible, fond réseau animé et transitions entre les grandes scènes. Les écrans En ligne et Défi restent honnêtement préparatoires : ils n'activent pas de faux service réseau.

Le jeu dispose désormais d'un système audio local avec une musique de menu et deux ambiances de partie originales embarquées dans `assets/audio/`. Les effets d'interface sont synthétisés via Web Audio. Le mixeur global ajoute volume général, musique, effets sonores et mutes indépendants ; aucune connexion ni API n'est nécessaire.

Le dock de conception exploite maintenant la géométrie de prévisualisation avant le clic pour afficher la longueur et le coût que produirait réellement le prochain point, avec delta et avertissement de trésorerie. Enfin, les stations utilisent des marqueurs DOM MapLibre indépendants du canvas : cœur de la couleur de ligne, contour blanc, au-dessus du réseau.


## Gros Lot 21 — Défis 1.0 (V38)

V38 active le Défi du jour sans backend : une date UTC produit de façon déterministe la même carte réelle, le même capital, les mêmes modes autorisés, contraintes et objectifs. Le chrono utilise `startedAt` / `endsAt`, persiste dans la sauvegarde et ne repart donc pas à zéro après un rechargement. À la fin manuelle, à l’expiration ou lors d’un échec hardcore, le résultat est figé et la partie bascule en lecture seule au niveau des actions de gameplay, y compris `Jour suivant`.

Le joueur peut conserver un Défi terminé comme archive de consultation. Depuis V44, toutes les sauvegardes Défi sont regroupées séparément dans Sauvegardes, partagent un quota de 10 et expirent automatiquement après 30 jours ; les parties libres normales ne sont jamais concernées par cette expiration. Les Défis terminés ne sont pas proposés par le bouton Continuer mais restent accessibles depuis leur dossier Sauvegardes tant qu’ils n’ont pas expiré.

Le menu En ligne ouvre désormais deux entrées distinctes : **Défier un ami**, disponible, et **Jouer ensemble sur la même partie**, clairement marqué pour plus tard. En entrant dans Défier un ami, le joueur retrouve Partie aléatoire, Partie personnalisée et l’import d’un code reçu. Une partie aléatoire ou personnalisée est encodée dans un code `CLU1` versionné et contrôlé par checksum ; aucune infrastructure serveur n’est requise. Les résultats utilisent un code `CLUR1` avec empreinte de la configuration afin de refuser une comparaison entre deux défis différents. Le coop live reste volontairement hors périmètre de V38.

L’accueil V38 met en avant le Défi du jour en or et En ligne en rouge, avec un fond abstrait de réseau vivant qui n’est plus lié visuellement à l’Île-de-France. Le micro-polish V37 est également intégré : hiérarchie `Prix` / `Prix total` / `Manque…`, maintien des longueurs en temps réel et rendu du mot « Métropole » sans le contour typographique qui déformait les e/E.


## Gros Lot 22 — Tutoriel & Wiki 1.0 (V39)

V39 ajoute une couche d’aide sans créer un moteur parallèle. Le tutoriel fonctionne directement sur une vraie partie libre : il observe l’état réel du panneau actif, des lignes et stations sélectionnées, du Bilan et du calendrier. Une étape n’est validée que lorsque l’action demandée a réellement eu lieu. La progression est persistée localement, peut être mise en pause, ignorée ou recommencée, et le système reste volontairement absent des défis chronométrés pour ne pas parasiter leurs règles.

Le Wiki est entièrement local et recherchable. Ses articles couvrent prise en main, construction et tracés, stations/correspondances, matériel roulant, capacité/saturation, réserve/régulation, maintenance, qualité, finances/crédit/tarification, communes, événements, objectifs, Bilan, Défis, sauvegardes et CLU Roast. Depuis un panneau de jeu, le bouton `?` ouvre directement l’article correspondant au contexte au lieu de renvoyer systématiquement vers l’accueil du Wiki.

Tutoriel et Wiki disposent chacun d’un réglage global. La progression du tutoriel peut être réinitialisée depuis Paramètres. Les langues restent volontairement hors de V39 et constituent toujours un chantier ultérieur distinct.


## Gros Lot 23 — Cartes réelles Open Data 1.0 (V40)

V40 retire le faux fond régional procédural des territoires Londres, Berlin, Randstad, Bruxelles, Madrid, Milan, Varsovie, Lisbonne, Prague et Berne. Ces cartes utilisent désormais le même pipeline vectoriel réel que le fond de référence : OpenStreetMap rendu avec MapLibre/Protomaps. Chaque territoire possède un chemin PMTiles local dédié sous `public/game/map/real/`. Depuis V40.1, aucun secours PMTiles distant n'est utilisé : le fichier local est requis afin d'éviter les erreurs HTTP Byte Serving observées pendant les tests.

Les profils V32 restent uniquement comme filet de sécurité temporaire pour les zones de simulation des communes si le GeoJSON administratif réel correspondant n'est pas présent. Ils ne génèrent plus le fond de carte et ne doivent plus être présentés comme de la géographie réelle. Les fichiers administratifs réels attendus sont documentés dans `game/tools/maps/`.

Un script PowerShell reproductible extrait les dix emprises depuis un build quotidien Protomaps vers des PMTiles locaux et vérifie les archives. Les références de sources et les obligations d'attribution OpenStreetMap/Protomaps sont documentées à côté du script.


## V40.1 — Extension du catalogue reel

Ajout comme cartes jouables Open Data locales : New York, Ottawa, Tokyo, Vienne, Copenhague, Stockholm, Oslo, Helsinki, Athenes, Budapest, Istanbul, Sao Paulo et Sydney. Elles utilisent le meme moteur MapLibre/PMTiles local que les autres territoires V40 et un fallback de communes CLU uniquement pour la simulation tant que les limites administratives reelles ne sont pas installees.

Ajout dans `Nouvelle partie` en `A venir` : Rabat, Dubai, Dublin, Kiev, Moscou, New Delhi, Riyad, Seoul, Zagreb, Alger, Pekin, Mexico, Le Caire, Buenos Aires et Bogota.


## V41 — Grand check-up intégral

V41 ne rajoute pas de nouvelle fonctionnalité. Elle consolide la base avant l'accessibilité et l'audit final : le moteur borne désormais les historiques financiers et communaux qui pouvaient croître sans limite sur les parties très longues, et la migration normalise également les anciens historiques de simulation à leur fenêtre utile.

La suppression d'une ligne nettoie maintenant son état de simulation et retire les objectifs dynamiques qui ciblaient cette ligne, évitant les objectifs orphelins ou validés artificiellement après suppression. Les totaux financiers, statistiques et relations communales restent cumulés indépendamment de ces historiques bornés.


## V43 — Audit final technique

V43 ferme la phase technique précédant l’internationalisation. Le catalogue des territoires, le script d’installation PMTiles, les Défis, les sauvegardes/migrations, la simulation et les principaux composants Vue ont été recroisés sans ajout de fonctionnalité de gameplay.

Le dernier reliquat de secours PMTiles distant est supprimé du modèle de données et du composant carte : une carte réelle utilise exclusivement son fichier PMTiles local. Si ce fichier manque, le jeu affiche l’erreur d’installation prévue au lieu de tenter silencieusement une source HTTP externe incompatible avec le Byte Serving.

Le Bilan hebdomadaire est maintenant borné à 1 040 snapshots (environ vingt ans de jeu) et les semaines dupliquées d’une ancienne sauvegarde sont fusionnées lors de la migration. L’historique détaillé des objectifs conserve les 500 réussites les plus récentes tout en maintenant un compteur cumulé séparé. Les records, totaux financiers, compteurs et milestones restent indépendants de ces fenêtres afin de préserver l’historique global sans laisser les sauvegardes croître sans limite.


## V44 — Internationalisation & sauvegardes

V44 active l’internationalisation complète de l’interface de CLU Métropole en huit langues : Français, English, Deutsch, Nederlands, Español, Italiano, Português et Polski. Le choix est une préférence globale locale, sans drapeau, peut être changé sans recharger la partie et pilote également les formats de nombres, montants, dates, libellés d’accessibilité, Tutoriel/Wiki et Défis. Les noms créés par le joueur (parties, lignes, stations) et les noms propres issus des données ne sont jamais modifiés par la traduction.

La gestion des sauvegardes sépare maintenant **Parties** et **Défis** dans la fenêtre Sauvegardes. Les parties libres disposent de 10 emplacements maximum ; créer, importer ou dupliquer une onzième partie est refusé jusqu’à la suppression d’une sauvegarde. Les sauvegardes Défi disposent de leur propre quota indépendant de 10 et sont nettoyées automatiquement après 30 jours. Mettre à jour une sauvegarde existante ne consomme jamais un nouvel emplacement. Ces limites sont imposées dans la couche IndexedDB elle-même afin de ne pas pouvoir être contournées par une autre interface.
