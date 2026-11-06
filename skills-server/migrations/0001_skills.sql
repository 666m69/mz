-- Apply only to a new, dedicated skills database. No migration of customer records.
CREATE TABLE ss_skills (
  id TEXT PRIMARY KEY, active_version TEXT, rollback_version TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ss_releases (
  skill_id TEXT NOT NULL REFERENCES ss_skills(id), version TEXT NOT NULL, manifest TEXT NOT NULL,
  digest TEXT NOT NULL, test_status TEXT NOT NULL DEFAULT 'pending' CHECK(test_status IN ('pending','passed','failed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(skill_id,version)
);
CREATE TRIGGER ss_release_immutable BEFORE UPDATE OF skill_id,version,manifest,digest ON ss_releases
BEGIN SELECT RAISE(ABORT,'immutable_release'); END;
CREATE TABLE ss_requests (
  id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES ss_skills(id), input_cipher TEXT NOT NULL,
  private_consent INTEGER NOT NULL CHECK(private_consent=1), created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX ss_requests_time ON ss_requests(created_at);
CREATE TABLE ss_jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('test','build')),
  request_id TEXT REFERENCES ss_requests(id), skill_id TEXT NOT NULL, version TEXT NOT NULL, digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, lease TEXT, lease_until INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER, result TEXT, error_code TEXT,
  FOREIGN KEY(skill_id,version) REFERENCES ss_releases(skill_id,version),
  CHECK((kind='test' AND request_id IS NULL) OR (kind='build' AND request_id IS NOT NULL))
);
CREATE UNIQUE INDEX ss_one_review ON ss_jobs(skill_id,version) WHERE kind='test';
CREATE INDEX ss_queue ON ss_jobs(status,created_at);
CREATE INDEX ss_client_jobs ON ss_jobs(request_id,created_at);
CREATE INDEX ss_jobs_time ON ss_jobs(created_at);
CREATE INDEX ss_skill_jobs ON ss_jobs(skill_id,created_at);
CREATE TABLE ss_artifacts (job_id TEXT PRIMARY KEY REFERENCES ss_jobs(id), cipher TEXT NOT NULL);
CREATE TABLE ss_ops (scope TEXT NOT NULL, key TEXT NOT NULL, hash TEXT NOT NULL, response TEXT NOT NULL,
  PRIMARY KEY(scope,key));
CREATE TABLE ss_rates (actor TEXT PRIMARY KEY, minute INTEGER NOT NULL, used INTEGER NOT NULL);
CREATE TABLE ss_audit (seq INTEGER PRIMARY KEY, event TEXT NOT NULL, target TEXT NOT NULL,
  at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TRIGGER ss_audit_locked BEFORE UPDATE ON ss_audit BEGIN SELECT RAISE(ABORT,'audit_locked'); END;
CREATE TRIGGER ss_audit_permanent BEFORE DELETE ON ss_audit BEGIN SELECT RAISE(ABORT,'audit_locked'); END;
CREATE TRIGGER ss_intake_cap BEFORE INSERT ON ss_requests
WHEN (SELECT count(*) FROM ss_requests WHERE created_at >= unixepoch('now','start of day'))>=24
BEGIN SELECT RAISE(ABORT,'daily_limit'); END;
CREATE TRIGGER ss_storage_intake BEFORE INSERT ON ss_requests WHEN (SELECT count(*) FROM ss_requests)>=400
BEGIN SELECT RAISE(ABORT,'capacity_limit'); END;
CREATE TRIGGER ss_job_check BEFORE INSERT ON ss_jobs BEGIN
  SELECT CASE WHEN (SELECT count(*) FROM ss_jobs)>=400 THEN RAISE(ABORT,'capacity_limit') END;
  SELECT CASE WHEN (SELECT count(*) FROM ss_jobs WHERE created_at >= unixepoch('now','start of day'))>=24
    THEN RAISE(ABORT,'daily_limit') END;
  SELECT CASE WHEN (SELECT count(*) FROM ss_jobs WHERE status IN ('queued','running'))>=8
    THEN RAISE(ABORT,'queue_full') END;
  SELECT CASE WHEN NEW.kind='build' AND NOT EXISTS (
    SELECT 1 FROM ss_requests q JOIN ss_skills s ON s.id=q.skill_id
    JOIN ss_releases r ON r.skill_id=s.id AND r.version=s.active_version
    WHERE q.id=NEW.request_id AND s.id=NEW.skill_id AND s.enabled=1 AND s.active_version=NEW.version
      AND r.test_status='passed' AND r.digest=NEW.digest) THEN RAISE(ABORT,'inactive_release') END;
  SELECT CASE WHEN NEW.kind='build' AND (SELECT count(*) FROM ss_jobs WHERE request_id=NEW.request_id)>=3
    THEN RAISE(ABORT,'request_limit') END;
  SELECT CASE WHEN NEW.kind='build' AND (SELECT count(*) FROM ss_jobs WHERE skill_id=NEW.skill_id AND kind='build'
    AND created_at>=unixepoch('now','start of day')) >=
    (SELECT json_extract(manifest,'$.limits.daily_builds') FROM ss_releases WHERE skill_id=NEW.skill_id AND version=NEW.version)
    THEN RAISE(ABORT,'daily_limit') END;
END;
CREATE TRIGGER ss_intake_audit AFTER INSERT ON ss_requests BEGIN
  INSERT INTO ss_audit(event,target) VALUES('owner.intake',NEW.id); END;
CREATE TRIGGER ss_release_audit AFTER INSERT ON ss_releases BEGIN
  INSERT INTO ss_audit(event,target) VALUES('owner.review',NEW.skill_id||'@'||NEW.version); END;
CREATE TRIGGER ss_job_audit AFTER INSERT ON ss_jobs BEGIN
  INSERT INTO ss_audit(event,target) VALUES(NEW.kind||'.queued',NEW.id); END;
CREATE TRIGGER ss_job_changed AFTER UPDATE OF status,attempts ON ss_jobs
WHEN NEW.status!=OLD.status OR NEW.attempts!=OLD.attempts BEGIN
  INSERT INTO ss_audit(event,target) VALUES(NEW.kind||'.'||NEW.status,NEW.id);
  UPDATE ss_releases SET test_status=CASE NEW.status WHEN 'succeeded' THEN 'passed' ELSE 'failed' END
    WHERE NEW.kind='test' AND NEW.status IN ('succeeded','failed') AND skill_id=NEW.skill_id AND version=NEW.version;
END;
-- An append-only owner decision atomically checks the reviewed version and previous revision.
CREATE TABLE ss_decisions (seq INTEGER PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES ss_skills(id),
  action TEXT NOT NULL CHECK(action IN ('activate','disable','rollback')), version TEXT, expected INTEGER NOT NULL);
CREATE TRIGGER ss_guard_decision BEFORE INSERT ON ss_decisions BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ss_skills WHERE id=NEW.skill_id AND revision=NEW.expected)
    THEN RAISE(ABORT,'stale_revision') END;
  SELECT CASE WHEN NEW.action!='disable' AND NOT EXISTS (SELECT 1 FROM ss_releases
    WHERE skill_id=NEW.skill_id AND version=NEW.version AND test_status='passed') THEN RAISE(ABORT,'review_required') END;
  SELECT CASE WHEN NEW.action='rollback' AND NOT EXISTS (SELECT 1 FROM ss_skills
    WHERE id=NEW.skill_id AND rollback_version=NEW.version) THEN RAISE(ABORT,'invalid_rollback') END;
END;
CREATE TRIGGER ss_apply_decision AFTER INSERT ON ss_decisions BEGIN
  UPDATE ss_skills SET enabled=(NEW.action!='disable'), revision=revision+1,
    rollback_version=CASE WHEN NEW.action!='disable' AND active_version IS NOT NEW.version THEN active_version ELSE rollback_version END,
    active_version=CASE WHEN NEW.action='disable' THEN active_version ELSE NEW.version END WHERE id=NEW.skill_id;
  UPDATE ss_jobs SET status='failed',error_code='release_withdrawn',finished_at=unixepoch(),lease=NULL,lease_until=NULL
    WHERE kind='build' AND skill_id=NEW.skill_id AND status IN ('queued','running') AND (NEW.action='disable' OR version!=NEW.version);
  INSERT INTO ss_audit(event,target) VALUES('owner.'||NEW.action,NEW.skill_id);
END;
CREATE TABLE ss_finishes (job_id TEXT PRIMARY KEY REFERENCES ss_jobs(id), lease TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('succeeded','failed')), result TEXT, error_code TEXT);
CREATE TRIGGER ss_finish_guard BEFORE INSERT ON ss_finishes BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM ss_jobs WHERE id=NEW.job_id AND status='running'
    AND lease=NEW.lease AND lease_until>unixepoch()) THEN RAISE(ABORT,'stale_lease') END;
END;
CREATE TRIGGER ss_finish_apply AFTER INSERT ON ss_finishes BEGIN
  UPDATE ss_jobs SET status=NEW.status,result=NEW.result,error_code=NEW.error_code,finished_at=unixepoch(),lease=NULL,lease_until=NULL
    WHERE id=NEW.job_id;
END;
