-- MZcode Skills Server: private delivery retention and revocation.
-- Apply ONLY to a dedicated Skills Server D1 database AFTER 0001_skills.sql.
-- Do NOT apply to the production customer ideas/contact database.
-- Existing QA artifacts receive expiry derived from job finished_at.
ALTER TABLE ss_artifacts ADD COLUMN download_expires_at INTEGER;
ALTER TABLE ss_artifacts ADD COLUMN purge_after INTEGER;
ALTER TABLE ss_artifacts ADD COLUMN revoked_at INTEGER;

UPDATE ss_artifacts
SET download_expires_at = COALESCE(
      (SELECT finished_at FROM ss_jobs WHERE id=ss_artifacts.job_id),
      unixepoch()
    ) + 1209600,
    purge_after = COALESCE(
      (SELECT finished_at FROM ss_jobs WHERE id=ss_artifacts.job_id),
      unixepoch()
    ) + 2592000
WHERE download_expires_at IS NULL;

CREATE INDEX ss_artifact_retention ON ss_artifacts(purge_after)
  WHERE purge_after IS NOT NULL;

-- Defensive checks on all future inserts and modifications.
CREATE TRIGGER ss_artifacts_retention_insert
BEFORE INSERT ON ss_artifacts
WHEN NEW.download_expires_at IS NULL
   OR NEW.purge_after IS NULL
   OR NEW.purge_after <= NEW.download_expires_at
   OR NEW.download_expires_at <= unixepoch()
   OR NEW.revoked_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'invalid_artifact_retention'); END;

CREATE TRIGGER ss_artifacts_retention_update
BEFORE UPDATE OF download_expires_at,purge_after ON ss_artifacts
WHEN NEW.download_expires_at != OLD.download_expires_at
   OR NEW.purge_after != OLD.purge_after
BEGIN SELECT RAISE(ABORT, 'immutable_artifact_retention'); END;

-- The worker code adds a scheduled handler but does NOT activate a cron.
-- Any real purge schedule requires explicit staging verification first.
