-- STAGING ONLY. Apply to a dedicated, empty CUSTOMER_GATEWAY_DB.
-- Does not modify production idea_requests or Skills Server D1 tables.
CREATE TABLE IF NOT EXISTS cv_challenges (
  idea_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL CHECK(length(code_hash)=64),
  email_hash TEXT NOT NULL CHECK(length(email_hash)=64),
  challenge_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  consumed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS cv_challenges_expiry ON cv_challenges(expires_at);
CREATE TABLE IF NOT EXISTS cv_sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
  idea_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS cv_sessions_expiry ON cv_sessions(expires_at);
CREATE INDEX IF NOT EXISTS cv_sessions_idea ON cv_sessions(idea_id);
CREATE TABLE IF NOT EXISTS cv_limits (
  scope TEXT NOT NULL, subject_hash TEXT NOT NULL, hour_bucket INTEGER NOT NULL,
  used INTEGER NOT NULL CHECK(used>0),
  PRIMARY KEY(scope,subject_hash,hour_bucket)
);
CREATE TABLE IF NOT EXISTS cv_deliveries (
  idea_id TEXT PRIMARY KEY,
  skills_request_id TEXT NOT NULL,
  skills_run_id TEXT NOT NULL,
  request_token_cipher TEXT NOT NULL,
  linked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER,
  CHECK(length(skills_request_id)=36 AND length(skills_run_id)=36)
);
CREATE TRIGGER IF NOT EXISTS cv_delivery_immutable
  BEFORE UPDATE OF idea_id,skills_request_id,skills_run_id,request_token_cipher ON cv_deliveries
  BEGIN SELECT RAISE(ABORT,'delivery_binding_immutable'); END;
CREATE TRIGGER IF NOT EXISTS cv_delivery_no_unrevoke
  BEFORE UPDATE OF revoked_at ON cv_deliveries
  WHEN OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
  BEGIN SELECT RAISE(ABORT,'delivery_revocation_immutable'); END;

-- A verified mailbox never implies authorization to deliver an executable ZIP.
CREATE TABLE IF NOT EXISTS cv_delivery_agreements (
 idea_id TEXT PRIMARY KEY REFERENCES cv_deliveries(idea_id),
 agreement_sha256 TEXT NOT NULL CHECK(length(agreement_sha256)=64),
 approved_at INTEGER NOT NULL CHECK(approved_at>0)
);
CREATE TRIGGER IF NOT EXISTS cv_agreement_immutable BEFORE UPDATE ON cv_delivery_agreements
BEGIN SELECT RAISE(ABORT,'agreement_immutable'); END;
CREATE TRIGGER IF NOT EXISTS cv_agreement_no_delete BEFORE DELETE ON cv_delivery_agreements
BEGIN SELECT RAISE(ABORT,'agreement_immutable'); END;
