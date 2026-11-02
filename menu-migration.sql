CREATE TABLE IF NOT EXISTS mz_menus (
 id TEXT PRIMARY KEY,
 owner_hash TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(length(payload)<=350000),
 updated_at TEXT NOT NULL
);
