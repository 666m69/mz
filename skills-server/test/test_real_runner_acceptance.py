"""Execute the actual digest-pinned Linux runner against both reviewed adapters.

This verifies the real worker *build*, not a synthetic ZIP fixture. It runs
locally on CI's Linux host; hosted Cloudflare D1/Access acceptance is separate.
"""
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "runner"))
import agent


class RealRunnerAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(agent.CATALOG.read_text())

    def run_reviewed(self, skill, kind, idea=None):
        data = self.registry[skill]
        adapter = data["adapters"][data["default_adapter"]]
        job = {"skill_id":skill,"kind":kind,"digest":adapter["digest"]}
        if idea is not None:
            job["input"] = {"idea":idea}
        result = agent.execute(job)
        self.assertTrue(result.get("ok"), f"{skill} {kind}: {result}")
        return result

    def test_checklist_and_counter_pass_real_negative_review(self):
        for skill in ("local-checklist", "local-counter"):
            with self.subTest(skill=skill):
                result = self.run_reviewed(skill, "test")
                self.assertEqual(result.get("checks"), [
                    "schema", "negative_input", "standalone_files",
                    "runtime_mutation", "runtime_persistence"
                ])

    def test_real_checklist_generates_and_tests_arabic_app(self):
        result = self.run_reviewed(
            "local-checklist", "build",
            "أريد قائمة مهام شخصية محلية أضيف إليها مهام اليوم وأحفظها في هذا الجهاز"
        )
        files = result.get("files")
        self.assertEqual(sorted(files), ["app.js","blueprint.json","index.html","styles.css"])
        self.assertIn('dir="rtl"',files["index.html"])
        self.assertIn("connect-src 'none'",files["index.html"])
        blueprint=json.loads(files["blueprint.json"])
        self.assertEqual(blueprint["kind"],"local-checklist")
        self.assertEqual(blueprint["storage"],"localStorage on the visitor device only")
        self.assertFalse(blueprint["automatedRelease"])

    def test_real_counter_generates_isolated_persistent_app(self):
        result = self.run_reviewed(
            "local-counter", "build",
            "أريد عداد محاولات محلي مع زيادة ونقصان وحفظ الرقم عند إغلاق المتصفح"
        )
        files=result.get("files")
        self.assertEqual(sorted(files), ["app.js","blueprint.json","index.html","styles.css"])
        self.assertIn('dir="rtl"',files["index.html"])
        blueprint=json.loads(files["blueprint.json"])
        self.assertEqual(blueprint["kind"],"local-counter")
        self.assertEqual(blueprint["storage"],"browser-local")

if __name__ == "__main__":
    unittest.main()
