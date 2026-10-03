/**
 * Point d'entrée unique pour les fonds cartographiques de CLU Métropole.
 *
 * Les PMTiles de production sont servis par le domaine R2 personnalisé CLU.
 * Le sous-domaine public `r2.dev` utilisé pendant la phase de mise en place DNS
 * n'est plus une dépendance du jeu.
 */
export const GAME_MAP_ASSET_BASE_URL = 'https://maps.useclu.pro'

export function gameMapAssetUrl(objectKey: string): string {
  const normalizedKey = objectKey.trim().replace(/^\/+/, '')
  return `${GAME_MAP_ASSET_BASE_URL}/${normalizedKey}`
}
