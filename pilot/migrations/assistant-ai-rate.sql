-- Dedicated limits for MZcode AI assistant. Apply in a preview D1 first; NEVER to production without review.
-- No messages or plaintext IP addresses are stored.
CREATE TABLE IF NOT EXISTS mz_assistant_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits >= 0),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mz_assistant_limits_updated ON mz_assistant_limits(updated_at);
-- A future scheduled maintenance job may delete rows older than 14 days.
