-- MZ Code Hub open-idea intake (independent D1 database)
CREATE TABLE IF NOT EXISTS idea_requests (
 id TEXT PRIMARY KEY,
 idea TEXT NOT NULL CHECK(length(idea) BETWEEN 20 AND 5000),
 email TEXT NOT NULL,
 name TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL,
 created_ms INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','quoted','accepted','building','delivered','rejected')),
 notification_status TEXT NOT NULL DEFAULT 'pending',
 notification_error TEXT,
 receipt_email_status TEXT NOT NULL DEFAULT 'pending_setup',
 receipt_email_provider_id TEXT,
 receipt_email_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_idea_requests_status_created ON idea_requests(status,created_ms DESC);
CREATE INDEX IF NOT EXISTS idx_idea_requests_ip_created ON idea_requests(ip_hash,created_ms DESC);

-- Lifecycle changes are written by authenticated /api/admin/ideas/:uuid PATCH operations.
CREATE TABLE IF NOT EXISTS idea_status_events (
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL,
 actor TEXT NOT NULL,
 from_status TEXT NOT NULL,
 to_status TEXT NOT NULL,
 created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idea_status_events_request ON idea_status_events(request_id,created_ms DESC);
