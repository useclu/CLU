PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parties_en_ligne (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  administrateur_id TEXT NOT NULL,
  administrateur_pseudo TEXT NOT NULL,
  visibilite TEXT NOT NULL CHECK (visibilite IN ('privee', 'publique_code', 'ouverte')),
  statut TEXT NOT NULL DEFAULT 'lobby' CHECK (statut IN ('lobby', 'en_cours', 'hors_ligne', 'fermee')),
  carte_id TEXT,
  carte_nom TEXT,
  budget_mode TEXT NOT NULL DEFAULT 'global' CHECK (budget_mode IN ('global', 'divise')),
  lecture_seule_par_defaut INTEGER NOT NULL DEFAULT 1 CHECK (lecture_seule_par_defaut IN (0, 1)),
  places_max INTEGER NOT NULL DEFAULT 5 CHECK (places_max BETWEEN 1 AND 5),
  joueurs_connectes INTEGER NOT NULL DEFAULT 0 CHECK (joueurs_connectes >= 0),
  entrees_ouvertes INTEGER NOT NULL DEFAULT 1 CHECK (entrees_ouvertes IN (0, 1)),
  date_creation INTEGER NOT NULL,
  date_modification INTEGER NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0, 1)),
  FOREIGN KEY (administrateur_id) REFERENCES utilisateurs(id)
);

CREATE INDEX IF NOT EXISTS idx_parties_en_ligne_ouvertes
  ON parties_en_ligne (actif, visibilite, statut, entrees_ouvertes, joueurs_connectes);

CREATE INDEX IF NOT EXISTS idx_parties_en_ligne_admin
  ON parties_en_ligne (administrateur_id, actif, date_modification);
