-- MZcode QA-only hardening after 0002_delivery_retention.sql.
-- Fix SQLite NULL comparisons: a != b is NULL when either side is NULL.
-- Do NOT apply to customer D1 or run more than once unnecessarily.
DROP TRIGGER IF EXISTS ss_artifacts_retention_update;
CREATE TRIGGER ss_artifacts_retention_update
BEFORE UPDATE OF download_expires_at,purge_after ON ss_artifacts
WHEN NEW.download_expires_at IS NOT OLD.download_expires_at
  OR NEW.purge_after IS NOT OLD.purge_after
BEGIN
  SELECT RAISE(ABORT,'immutable_artifact_retention');
END;

-- Revocation is irreversible: require owner-issued replacement rather than
-- mutating an existing artifact's revoked_at back to NULL.
CREATE TRIGGER ss_artifacts_revocation_monotonic
BEFORE UPDATE OF revoked_at ON ss_artifacts
WHEN OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at
BEGIN
  SELECT RAISE(ABORT,'immutable_artifact_revocation');
END;
