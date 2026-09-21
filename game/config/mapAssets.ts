/**
 * Point d'entrée unique pour les fonds cartographiques de CLU Métropole.
 *
 * TEMPORAIRE : pendant la mise en production initiale, les PMTiles sont servis
 * via l'URL publique R2 `r2.dev`. Quand `maps.useclu.pro` sera actif, il suffira
 * de remplacer uniquement la valeur ci-dessous par :
 *
 *   https://maps.useclu.pro
 */
export const GAME_MAP_ASSET_BASE_URL = 'https://pub-6ef94121c43244d0b29c016b647e66d0.r2.dev'

export function gameMapAssetUrl(objectKey: string): string {
  const normalizedKey = objectKey.trim().replace(/^\/+/, '')
  return `${GAME_MAP_ASSET_BASE_URL}/${normalizedKey}`
}
