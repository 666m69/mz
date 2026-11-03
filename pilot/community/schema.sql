-- MZ Community Lab — isolated tables; safe to re-run. No alteration to commercial leads.
CREATE TABLE IF NOT EXISTS mz_lab_ideas (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  voter_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  idea TEXT NOT NULL CHECK(length(idea) BETWEEN 12 AND 800),
  nickname TEXT NOT NULL DEFAULT '' CHECK(length(nickname) <= 40),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_hash,content_hash)
);
CREATE INDEX IF NOT EXISTS idx_mz_lab_ideas_pending ON mz_lab_ideas(status,created_at DESC);
CREATE TABLE IF NOT EXISTS mz_lab_votes (
  voter_hash TEXT PRIMARY KEY,
  project TEXT NOT NULL CHECK(project IN ('kafu','formah','marib')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mz_lab_votes_project ON mz_lab_votes(project);
CREATE TABLE IF NOT EXISTS mz_lab_reviews (
  voter_hash TEXT NOT NULL,
  project TEXT NOT NULL CHECK(project IN ('code','kafu','formah','marib')),
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 600),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(voter_hash,project)
);
CREATE TABLE IF NOT EXISTS mz_lab_rate (
  scope TEXT NOT NULL,
  bucket TEXT NOT NULL,
  period INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(scope,bucket,period)
);