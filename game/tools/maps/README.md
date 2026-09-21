# V40 — Pipeline cartes réelles

Les territoires réels de CLU Métropole utilisent maintenant un fond OpenStreetMap au format PMTiles compatible Protomaps/MapLibre.

## Principe

- `public/game/map/real/<territoire>.pmtiles` est toujours prioritaire.
- Si le fichier local n'est pas présent, le jeu bloque proprement le chargement et demande l'installation de la carte ; aucun fallback PMTiles distant n'est utilisé depuis V40.1.
- Pour la version distribuée/payante, les extraits locaux doivent être générés et embarqués : le gameplay ne doit pas dépendre en permanence d'un service cartographique distant.
- Les limites administratives réelles sont attendues sous `public/game/map/real/<territoire>-municipalities.geojson`. Tant qu'un fichier n'est pas installé, V40 conserve uniquement les anciennes zones CLU comme secours pour la simulation des communes ; elles ne servent plus au fond de carte.

## Générer les PMTiles locaux

Le script `install-real-basemaps.ps1` utilise le CLI officiel `pmtiles` et un build quotidien Protomaps. Il extrait uniquement les emprises utiles au jeu, puis vérifie chaque archive.

Sources principales : OpenStreetMap (ODbL), Protomaps basemap/PMTiles et extraits Geofabrik pour la traçabilité des territoires.


## V40.1 — extension du catalogue

Le script installe aussi : New York, Ottawa, Tokyo, Vienne, Copenhague, Stockholm, Oslo, Helsinki, Athenes, Budapest, Istanbul, Sao Paulo et Sydney. Les cartes deja validees sont verifiees puis ignorees avec `[SKIP]`. En cas de coupure reseau, chaque nouvelle region est retentee automatiquement.

Les fichiers generes sont : `new-york.pmtiles`, `ottawa.pmtiles`, `tokyo.pmtiles`, `vienna.pmtiles`, `copenhagen.pmtiles`, `stockholm.pmtiles`, `oslo.pmtiles`, `helsinki.pmtiles`, `athens.pmtiles`, `budapest.pmtiles`, `istanbul.pmtiles`, `sao-paulo.pmtiles` et `sydney.pmtiles`.
