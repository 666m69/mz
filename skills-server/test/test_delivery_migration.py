"""QA-only SQLite contract tests for the staged Cloudflare D1 artifact retention migration."""
import sqlite3
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "migrations"
JOB = "f63a86a7-c7f8-49c7-acb8-cc77c162050f"
SKILL = "local-checklist"

class DeliveryMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        # Cloudflare D1 has unixepoch(); some Python/OS SQLite builds do not.
        self.db.create_function("unixepoch", 0, lambda: int(time.time()))
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript((ROOT / "0001_skills.sql").read_text())
        self.db.execute("INSERT INTO ss_skills(id) VALUES(?)", (SKILL,))
        self.db.execute(
            "INSERT INTO ss_releases(skill_id,version,manifest,digest) VALUES(?,?,?,?)",
            (SKILL, "1.0.0", '{"limits":{"daily_builds":2}}', "0"*64),
        )
        self.db.execute(
            "INSERT INTO ss_jobs(id,kind,skill_id,version,digest,status,finished_at) "
            "VALUES(?,'test',?, '1.0.0', ?, 'succeeded', unixepoch()-2592001)",
            (JOB, SKILL, "0"*64),
        )
        self.db.execute("INSERT INTO ss_artifacts(job_id,cipher) VALUES(?,?)", (JOB,"sealed-value"))
        self.db.executescript((ROOT / "0002_delivery_retention.sql").read_text())

    def tearDown(self):
        self.db.close()

    def test_existing_artifact_backfill_uses_job_finish_time(self):
        row = self.db.execute(
            "SELECT a.download_expires_at,a.purge_after,j.finished_at "
            "FROM ss_artifacts a JOIN ss_jobs j ON a.job_id=j.id WHERE a.job_id=?",(JOB,)
        ).fetchone()
        self.assertEqual(row[0]-row[2],14*86400)
        self.assertEqual(row[1]-row[2],30*86400)

    def test_revocation_is_allowed(self):
        self.db.execute("UPDATE ss_artifacts SET revoked_at=unixepoch() WHERE job_id=?",(JOB,))
        self.assertIsNotNone(self.db.execute(
            "SELECT revoked_at FROM ss_artifacts WHERE job_id=?",(JOB,)).fetchone()[0])

    def test_expiry_extension_is_immutable(self):
        with self.assertRaisesRegex(sqlite3.IntegrityError, "immutable_artifact_retention"):
            self.db.execute("UPDATE ss_artifacts SET download_expires_at=download_expires_at+86400 WHERE job_id=?",(JOB,))

    def test_missing_retention_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO ss_artifacts(job_id,cipher) VALUES(?,?)",
                            ("9a66e8bd-5ac9-4d37-8ff6-90b5513de5d1","missing-retention"))

    def test_purge_removes_expired_artifacts_only(self):
        self.db.execute("DELETE FROM ss_artifacts WHERE purge_after IS NOT NULL AND purge_after<=unixepoch()")
        self.assertIsNone(self.db.execute("SELECT job_id FROM ss_artifacts WHERE job_id=?",(JOB,)).fetchone())

if __name__ == "__main__":
    unittest.main()
