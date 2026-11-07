-- Staging Skills Server D1 only. Never run against live site DB.
-- The mapping is created only by a trusted server-side intake integration,
-- after binding the original site's reference to the Skills Server request.
CREATE TABLE IF NOT EXISTS mz_customer_delivery (
  reference TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL UNIQUE REFERENCES ss_requests(id),
  email TEXT NOT NULL,
  verified_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(reference) BETWEEN 6 AND 40),
  CHECK (length(email) BETWEEN 3 AND 254),
  CHECK (verified_at IS NULL OR verified_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX IF NOT EXISTS mz_customer_delivery_request ON mz_customer_delivery(request_id);
CREATE TRIGGER IF NOT EXISTS mz_customer_delivery_no_reassign
BEFORE UPDATE OF reference,request_id,email,verified_at,revoked_at ON mz_customer_delivery
WHEN NEW.reference != OLD.reference OR NEW.request_id != OLD.request_id
 OR NEW.email != OLD.email
 OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT OLD.verified_at)
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
 SELECT RAISE(ABORT,'customer_delivery_immutable');
END;
