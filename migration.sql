CREATE TABLE IF NOT EXISTS mz_contact_requests (
 request_id TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
 service TEXT NOT NULL, message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new',
 consent_version TEXT NOT NULL DEFAULT '2026-10-29',
 payload_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mz_contact_rate (
 ip_hash TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL,
 PRIMARY KEY(ip_hash,window_start)
);
