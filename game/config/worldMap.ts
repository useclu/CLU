/**
 * Carte mondiale CLU Métropole.
 *
 * Le fond de carte reste fourni sous forme de tuiles vectorielles : une partie ne
 * télécharge jamais « le monde », seulement les tuiles visibles dans son périmètre.
 * Les services de recherche/localités passent par l'API CLU en production afin de
 * centraliser validation, cache et éventuel changement de fournisseur.
 */
export const WORLD_MAP_STYLE_URLS = {
  DARK: 'https://tiles.openfreemap.org/styles/fiord',
  LIGHT: 'https://tiles.openfreemap.org/styles/positron',
} as const

const WORLD_CLU_API_BASE_URL = import.meta.dev ? '/clu-api' : 'https://api.useclu.pro'

/** Recherche mondiale normalisée et mise en cache par le Worker CLU. */
export const WORLD_CITY_SEARCH_URL = `${WORLD_CLU_API_BASE_URL}/api/world/villes`
/** Secours réservé au développement localhost avant déploiement du Worker. */
export const WORLD_CITY_SEARCH_FALLBACK_URL = 'https://photon.komoot.io/api'

/** Localités réelles du périmètre, normalisées et mises en cache par le Worker CLU. */
export const WORLD_LOCALITY_SEARCH_URL = `${WORLD_CLU_API_BASE_URL}/api/world/localites`
/** Secours direct réservé au développement localhost avant un wrangler deploy. */
export const WORLD_LOCALITY_SEARCH_FALLBACK_URL = 'https://overpass-api.de/api/interpreter'

export const WORLD_MIN_RADIUS_KM = 10
export const WORLD_MAX_RADIUS_KM = 100
export const WORLD_DEFAULT_RADIUS_KM = 30

export const WORLD_CITY_SEARCH_CACHE_MS = 6 * 60 * 60 * 1000
/** Une recherche déjà connue peut dépanner hors-ligne / pendant une panne API pendant 7 jours. */
export const WORLD_CITY_SEARCH_STALE_MS = 7 * 24 * 60 * 60 * 1000
export const WORLD_LOCALITY_CACHE_MS = 7 * 24 * 60 * 60 * 1000
/** Les localités changent lentement : un cache local ancien reste exploitable jusqu'à 30 jours. */
export const WORLD_LOCALITY_STALE_MS = 30 * 24 * 60 * 60 * 1000
export const WORLD_LOCALITY_FETCH_TIMEOUT_MS = 14_500
export const WORLD_LOCALITY_MAX_ANCHORS = 56
