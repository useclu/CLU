export const CLU_ONLINE_MAX_JOUEURS = 5;
export const CLU_ONLINE_MAX_ATTENTE = 20;
export const CLU_ONLINE_PROTOCOL_VERSION = 6;
export const CLU_ONLINE_MUTATION_RATE_WINDOW_MS = 10_000;
export const CLU_ONLINE_MUTATION_RATE_MAX = 120;
export const CLU_ONLINE_GRACE_MS = 60 * 1000;
export const CLU_ONLINE_PENDING_REQUEST_MS = 2 * 60 * 1000;
export const CLU_ONLINE_PENDING_RECONNECT_MS = 30 * 1000;
export const CLU_ONLINE_RESERVATION_MS = 5 * 60 * 1000;
export const CLU_ONLINE_WS_TICKET_TTL_MS = 20 * 1000;
export const CLU_ONLINE_ALPHABET_CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CLU_ONLINE_MAX_SNAPSHOT_MESSAGE = 12_000_000;
export const CLU_ONLINE_MAX_WS_MESSAGE = 700_000;
export const CLU_ONLINE_MAX_MUTATION_MESSAGE = 650_000;
export const CLU_ONLINE_MAX_PATCHES = 600;
export const CLU_ONLINE_SNAPSHOT_INTERVAL = 20;
export const CLU_ONLINE_SNAPSHOT_META_KEY = "jeu:snapshot:meta";
export const CLU_ONLINE_SNAPSHOT_CHUNK_PREFIX = "jeu:snapshot:chunk:";
export const CLU_ONLINE_SNAPSHOT_CHUNK_SIZE = 512_000;
export const CLU_ONLINE_MUTATION_PREFIX = "jeu:mutation:";

export const CLU_ONLINE_PERMISSIONS = Object.freeze([
  "chat",
  "construire_lignes",
  "modifier_lignes",
  "supprimer_lignes",
  "construire_stations",
  "modifier_stations",
  "supprimer_stations",
  "gerer_materiel_roulant",
  "gerer_depots",
  "gerer_exploitation",
  "gerer_horaires",
  "gerer_frequences",
  "gerer_tarification",
  "effectuer_depenses",
  "gerer_finances",
  "gerer_budget",
  "gerer_emprunts",
  "gerer_subventions",
  "gerer_urbanisme",
  "gerer_projets",
  "gerer_temps_simulation",
  "gerer_incidents",
  "gerer_pcc",
  "gerer_evenements",
  "modifier_parametres_jeu",
  "importer_donnees",
]);

export function permissionsOnlineToutes() {
  return Object.fromEntries(CLU_ONLINE_PERMISSIONS.map(cle => [cle, true]));
}

export function permissionsOnlineLectureSeule() {
  const resultat = Object.fromEntries(CLU_ONLINE_PERMISSIONS.map(cle => [cle, false]));
  resultat.chat = true;
  return resultat;
}

export function permissionsOnlineEdition() {
  const resultat = permissionsOnlineToutes();
  resultat.gerer_finances = false;
  resultat.gerer_budget = false;
  resultat.gerer_emprunts = false;
  resultat.gerer_subventions = false;
  resultat.modifier_parametres_jeu = false;
  resultat.importer_donnees = false;
  return resultat;
}

export function permissionsOnlineConstructeur() {
  const resultat = permissionsOnlineLectureSeule();
  for (const cle of [
    "construire_lignes", "modifier_lignes", "supprimer_lignes",
    "construire_stations", "modifier_stations", "supprimer_stations",
    "gerer_depots", "effectuer_depenses",
  ]) resultat[cle] = true;
  return resultat;
}

export function permissionsOnlineExploitant() {
  const resultat = permissionsOnlineLectureSeule();
  for (const cle of [
    "gerer_materiel_roulant", "gerer_depots", "gerer_exploitation",
    "gerer_horaires", "gerer_frequences", "gerer_incidents", "gerer_pcc",
    "effectuer_depenses",
  ]) resultat[cle] = true;
  return resultat;
}

export function permissionsOnlineFinancier() {
  const resultat = permissionsOnlineLectureSeule();
  for (const cle of [
    "gerer_tarification", "effectuer_depenses", "gerer_finances",
    "gerer_budget", "gerer_emprunts", "gerer_subventions",
  ]) resultat[cle] = true;
  return resultat;
}

export function permissionsOnlineGestionnaire() {
  const resultat = permissionsOnlineLectureSeule();
  for (const cle of [
    "gerer_exploitation", "gerer_horaires", "gerer_frequences",
    "gerer_urbanisme", "gerer_projets", "gerer_temps_simulation",
    "gerer_incidents", "gerer_pcc", "gerer_evenements", "effectuer_depenses",
  ]) resultat[cle] = true;
  return resultat;
}

export function permissionsPourProfilOnline(profil) {
  if (profil === "observateur") return permissionsOnlineLectureSeule();
  if (profil === "constructeur") return permissionsOnlineConstructeur();
  if (profil === "exploitant") return permissionsOnlineExploitant();
  if (profil === "financier") return permissionsOnlineFinancier();
  if (profil === "gestionnaire") return permissionsOnlineGestionnaire();
  if (profil === "edition") return permissionsOnlineEdition();
  if (profil === "complet") return permissionsOnlineToutes();
  return null;
}

export function nettoyerPermissionsOnline(valeur, base = permissionsOnlineLectureSeule()) {
  const resultat = { ...base };
  if (!valeur || typeof valeur !== "object") return resultat;
  for (const cle of CLU_ONLINE_PERMISSIONS) {
    if (Object.prototype.hasOwnProperty.call(valeur, cle)) resultat[cle] = valeur[cle] === true;
  }
  return resultat;
}
