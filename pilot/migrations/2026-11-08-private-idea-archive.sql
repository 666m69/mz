-- Run on the existing ideas D1 only after schema inspection and before deploying the updated intake Worker.
-- No ideas are deleted or made publicly available; existing requests default to private execution and reuse=0.
ALTER TABLE idea_requests ADD COLUMN idea_kind TEXT NOT NULL DEFAULT 'execution' CHECK(idea_kind IN ('concept','execution'));
ALTER TABLE idea_requests ADD COLUMN reuse_permission INTEGER NOT NULL DEFAULT 0 CHECK(reuse_permission IN (0,1));
ALTER TABLE idea_requests ADD COLUMN concept_consent_version TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX IF NOT EXISTS idx_idea_archive_created ON idea_requests(idea_kind,created_ms DESC);
CREATE INDEX IF NOT EXISTS idx_idea_archive_reuse ON idea_requests(reuse_permission,created_ms DESC);
