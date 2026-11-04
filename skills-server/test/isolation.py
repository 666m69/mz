"""Negative tests against the actual local build supervisor, using only fixed test fixtures."""
import json
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "runner"))
import agent

class IsolationTests(unittest.TestCase):
    def test_access_credentials_are_bound_to_one_tls_origin(self):
        import os
        env = {"SKILLS_URL":"https://qa.example","SKILLS_RUNNER_TOKEN":"synthetic",
               "SKILLS_ACCESS_CLIENT_ID":"synthetic-id","SKILLS_ACCESS_CLIENT_SECRET":"synthetic-secret",
               "SKILLS_ACCESS_ORIGIN":"https://qa.example"}
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(agent.http.client,"HTTPSConnection") as https:
            conn = https.return_value
            conn.getresponse.return_value.status = 200
            conn.getresponse.return_value.read.return_value = b"{}"
            agent.post("claim", {})
            headers = conn.request.call_args.args[3]
            self.assertEqual(headers["CF-Access-Client-Id"], env["SKILLS_ACCESS_CLIENT_ID"])
            self.assertEqual(headers["CF-Access-Client-Secret"], env["SKILLS_ACCESS_CLIENT_SECRET"])
            for wrong in ("https://other.example","http://127.0.0.1","https://qa.example:8443"):
                os.environ["SKILLS_URL"] = wrong
                with self.assertRaises(ValueError):
                    agent.post("claim", {})
            self.assertEqual(conn.request.call_count, 1)

    def test_pinned_sources(self):
        for item in json.loads(agent.CATALOG.read_text()).values():
            for adapter in item["adapters"].values():
                self.assertEqual(agent.source_bytes(adapter)[1], adapter["digest"])

    def test_digest_mismatch_never_enters_child(self):
        with mock.patch.object(agent, "isolated", side_effect=AssertionError):
            result = agent.execute({"skill_id":"local-counter","kind":"build","digest":"0"*64})
        self.assertEqual(result["error"],"digest_mismatch")

    def test_seccomp_failure_is_closed(self):
        with mock.patch.object(agent, "syscall_filter", side_effect=OSError):
            result = agent.isolated({"probe.mjs":b"console.log('unsafe')" }, "probe.mjs", [], {}, probe=True)
        self.assertEqual(result,{"ok":False,"error":"sandbox_unavailable"})

    def test_wall_timeout_kills_sleeping_fixture(self):
        result=agent.isolated({"wait.mjs":b"setTimeout(()=>{},15000)"}, "wait.mjs", [], {}, probe=True)
        self.assertEqual(result,{"ok":False,"error":"timeout"})

    def test_cpu_ceiling_terminates_busy_fixture(self):
        result=agent.isolated({"busy.mjs":b"while(true){}"}, "busy.mjs", [], {}, probe=True)
        self.assertEqual(result,{"ok":False,"error":"resource_limit"})

    def test_wrong_idea_not_promoted_to_a_project(self):
        for skill,item in json.loads(agent.CATALOG.read_text()).items():
            adapter=next(iter(item["adapters"].values()))
            result=agent.execute({"skill_id":skill,"kind":"build","digest":adapter["digest"],
                                  "input":{"idea":"أريد بناء متجر لبيع السلع وحسابات الإنجاز"}})
            self.assertEqual(result,{"ok":False,"error":"unsupported_idea"})

if __name__ == "__main__":
    unittest.main(verbosity=2)
