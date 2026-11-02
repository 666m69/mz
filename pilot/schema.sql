-- MZ Code Hub open-idea intake (independent D1 database)
CREATE TABLE IF NOT EXISTS idea_requests (
 id TEXT PRIMARY KEY,
 idea TEXT NOT NULL CHECK(length(idea) BETWEEN 20 AND 5000),
 email TEXT NOT NULL,
 name TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL,
 created_ms INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','quoted','accepted','building','delivered','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_idea_requests_status_created ON idea_requests(status,created_ms DESC);
CREATE INDEX IF NOT EXISTS idx_idea_requests_ip_created ON idea_requests(ip_hash,created_ms DESC);
