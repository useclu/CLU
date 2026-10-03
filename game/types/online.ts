export type CluOnlineVisibility = 'privee' | 'publique_code' | 'ouverte'
export type CluOnlineBudgetMode = 'global' | 'divise'
export type CluOnlineMemberStatus = 'en_attente' | 'accepte' | 'refuse'
export type CluOnlineRole = 'administrateur' | 'membre'
export type CluOnlinePermissionProfile = 'observateur' | 'constructeur' | 'exploitant' | 'financier' | 'gestionnaire' | 'edition' | 'complet'
export type CluOnlineAccountType = 'invite' | 'gratuit' | 'premium'

export type CluOnlinePermission =
  | 'chat'
  | 'construire_lignes'
  | 'modifier_lignes'
  | 'supprimer_lignes'
  | 'construire_stations'
  | 'modifier_stations'
  | 'supprimer_stations'
  | 'gerer_materiel_roulant'
  | 'gerer_depots'
  | 'gerer_exploitation'
  | 'gerer_horaires'
  | 'gerer_frequences'
  | 'gerer_tarification'
  | 'effectuer_depenses'
  | 'gerer_finances'
  | 'gerer_budget'
  | 'gerer_emprunts'
  | 'gerer_subventions'
  | 'gerer_urbanisme'
  | 'gerer_projets'
  | 'gerer_temps_simulation'
  | 'gerer_incidents'
  | 'gerer_pcc'
  | 'gerer_evenements'
  | 'modifier_parametres_jeu'
  | 'importer_donnees'

export type CluOnlinePermissions = Partial<Record<CluOnlinePermission, boolean>>

export interface CluOnlineMapSummary {
  id: string | null
  nom: string | null
}

export interface CluOnlineGameConfig {
  carte: CluOnlineMapSummary
  budgetInitial: number | null
  budgetMode: CluOnlineBudgetMode
  lectureSeuleParDefaut: boolean
}

export interface CluOnlineGame {
  id?: string
  code: string
  nom: string
  administrateurId?: string
  administrateurPseudo?: string
  visibilite: CluOnlineVisibility
  statut: 'lobby' | 'en_cours' | 'hors_ligne' | 'fermee'
  entreesOuvertes: boolean
  chatActif?: boolean
  placesMax: number
  joueursConnectes?: number
  config: CluOnlineGameConfig
  dateCreation?: number
  premiumAdminJusquA?: number | null
}

export interface CluOnlineMember {
  id: string
  pseudo: string
  estInvite: boolean
  typeCompte: CluOnlineAccountType
  role: CluOnlineRole
  statut: CluOnlineMemberStatus
  connecte: boolean
  muet: boolean
  dateArrivee: number
  graceJusquA?: number | null
  demandeExpireA?: number | null
  permissions?: CluOnlinePermissions
}

export interface CluOnlineBlockedMember {
  cle: string
  pseudo: string
  estInvite: boolean
  dateBlocage: number
  libelle: string
}

export interface CluOnlineOpenGame {
  code: string
  nom: string
  administrateurPseudo: string
  statut: 'lobby' | 'en_cours'
  carte: CluOnlineMapSummary
  budgetMode: CluOnlineBudgetMode
  lectureSeuleParDefaut: boolean
  placesMax: number
  joueursConnectes: number
  dateCreation: number
  dateModification: number
}

export interface CluOnlineChatMessage {
  id: string
  auteurId: string
  auteurPseudo: string
  texte: string
  date: number
}

export interface CluOnlineCreateInput {
  nom: string
  visibilite: CluOnlineVisibility
  carte: CluOnlineMapSummary
  budgetInitial: number | null
  budgetMode: CluOnlineBudgetMode
  lectureSeuleParDefaut: boolean
}

export interface CluOnlineJoinInput {
  code: string
  pseudoInvite?: string
}

export interface CluOnlineGamePatch {
  op: 'add' | 'remove' | 'replace'
  path: string
  value?: unknown
}

export interface CluOnlineGameSnapshotPayload {
  version: number
  save: import('./game').GameSave
  raison?: 'connexion' | 'acceptation' | 'resynchronisation' | 'initialisation' | 'simulation'
}

export interface CluOnlineGameMutationPayload {
  actionId: string
  version: number
  auteurId: string
  patches: CluOnlineGamePatch[]
  date: number
}

export interface CluOnlineClockState {
  playing: boolean
  speed: 0.5 | 1 | 2
  elapsedMs: number
  updatedAt: number
}


export interface CluOnlineBudgetShare {
  membreId: string
  pseudo: string
  montant: number
}

export interface CluOnlineBudgetState {
  mode: CluOnlineBudgetMode
  totalDisponible: number
  reserveCommune: number
  soldePersonnel: number | null
  repartition?: CluOnlineBudgetShare[]
}

export interface CluOnlineStatePayload {
  partie: CluOnlineGame
  moi: CluOnlineMember | null
  membres: CluOnlineMember[]
  demandesEnAttente: CluOnlineMember[]
  bloques: CluOnlineBlockedMember[]
  permissionsDisponibles?: CluOnlinePermission[]
  budget?: CluOnlineBudgetState
  jeuVersion?: number
  jeuPret?: boolean
  horloge?: CluOnlineClockState
}

export type CluOnlineAdminAction =
  | 'accepter_membre'
  | 'refuser_membre'
  | 'expulser_membre'
  | 'debloquer'
  | 'definir_permissions'
  | 'definir_profil'
  | 'definir_muet'
  | 'definir_visibilite'
  | 'definir_entrees_ouvertes'
  | 'definir_defaut_edition'
  | 'definir_budget_mode'
  | 'definir_chat_actif'
  | 'repartir_budget_egalement'
  | 'redistribuer_budget'
