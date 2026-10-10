export interface GameWorldPlaceAnchor {
  name: string
  longitude: number
  latitude: number
  kind?: 'CITY' | 'TOWN' | 'VILLAGE' | 'SUBURB' | 'OTHER'
  population?: number | null
}

export interface GameWorldTerritorySettings {
  version: 1
  /** Nom court de la localité choisie par le joueur. */
  cityName: string
  /** Libellé complet renvoyé par le moteur de recherche, conservé pour lever les homonymes. */
  displayName: string
  countryName: string
  /** ISO 3166-1 alpha-2 en majuscules. */
  countryCode: string
  /** Région / État / canton quand disponible. */
  adminName?: string | null
  longitude: number
  latitude: number
  /** Rayon de jeu autour du centre, en kilomètres. */
  radiusKm: number
  /** Langue cartographique privilégiée, sans obligation qu'elle fasse partie des 8 langues UI. */
  preferredLocale: string
  /** Population de la localité quand la source de recherche la fournit. */
  estimatedPopulation?: number | null
  /** Identifiants OSM facultatifs, utiles pour stabiliser la sélection et de futures données urbaines. */
  osmType?: string | null
  osmId?: number | null
  /** Localités réelles découvertes depuis les tuiles OpenMapTiles du périmètre. */
  placeAnchors?: GameWorldPlaceAnchor[]
}

export interface GameWorldCitySearchResult extends GameWorldTerritorySettings {
  importance: number
}
