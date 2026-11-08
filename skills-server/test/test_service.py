"""Behavioral regression tests for the bounded, fail-closed Skills runner service."""
import contextlib
import io
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "runner"))
import agent


class FakeStop:
    def __init__(self, on_wait=None):
        self.stopped = False
        self.waits = []
        self.on_wait = on_wait

    def is_set(self):
        return self.stopped

    def wait(self, seconds):
        self.waits.append(seconds)
        if self.on_wait:
            self.on_wait(seconds)


class RunnerServiceTests(unittest.TestCase):
    def test_idle_wait_and_drain_two_jobs(self):
        results = iter(["idle", "succeeded", "failed"])
        calls = []
        stop = FakeStop()
        def run():
            calls.append(1)
            return next(results)
        self.assertEqual(agent.serve(poll_seconds=12, max_jobs=2, stop_event=stop, run_once=run), 0)
        self.assertEqual(len(calls), 3)
        self.assertEqual(stop.waits, [12])

    def test_graceful_shutdown_after_idle_does_not_claim_again(self):
        stop = FakeStop()
        stop.on_wait = lambda _delay: setattr(stop, "stopped", True)
        work = mock.Mock(return_value="idle")
        self.assertEqual(agent.serve(stop_event=stop, run_once=work), 0)
        work.assert_called_once()

    def test_control_failure_exits_instead_of_repeated_polling(self):
        work = mock.Mock(side_effect=RuntimeError("Bearer private-secret"))
        log = io.StringIO()
        with contextlib.redirect_stderr(log):
            self.assertEqual(agent.serve(stop_event=FakeStop(), run_once=work), 1)
        work.assert_called_once()
        self.assertEqual(log.getvalue(), "control_unavailable\n")
        self.assertNotIn("private-secret", log.getvalue())

    def test_runtime_budget_caps_idle_wait(self):
        now = [100.0]
        stop = FakeStop(on_wait=lambda seconds: now.__setitem__(0, now[0] + seconds))
        work = mock.Mock(return_value="idle")
        self.assertEqual(agent.serve(poll_seconds=20, max_seconds=3, stop_event=stop,
                                     run_once=work, clock=lambda: now[0]), 0)
        work.assert_called_once()
        self.assertEqual(stop.waits, [3])

    def test_job_budget_stops_after_one_result_without_wait(self):
        stop = FakeStop()
        work = mock.Mock(return_value="technical_review")
        self.assertEqual(agent.serve(max_jobs=1, stop_event=stop, run_once=work), 0)
        work.assert_called_once()
        self.assertFalse(stop.waits)

    def test_service_cli_attaches_signal_handlers_and_limits(self):
        with mock.patch.object(sys, "argv", ["agent.py", "--serve", "--poll-seconds", "3",
                                             "--max-jobs", "2", "--max-seconds", "10"]):
            with mock.patch.object(agent.signal, "signal") as handler:
                with mock.patch.object(agent, "serve", return_value=0) as run:
                    self.assertEqual(agent.main(), 0)
        self.assertEqual(handler.call_count, 2)
        self.assertEqual(run.call_args.args, (3.0, 2, 10))
        self.assertIn("stop_event", run.call_args.kwargs)

    def test_reject_invalid_and_wrong_mode_options(self):
        bad = [
            ["--serve", "--poll-seconds", "0"],
            ["--serve", "--poll-seconds", "61"],
            ["--serve", "--max-jobs", "25"],
            ["--serve", "--max-seconds", "86401"],
            ["--once", "--max-jobs", "1"],
        ]
        for args in bad:
            with self.subTest(args=args):
                with mock.patch.object(sys, "argv", ["agent.py", *args]):
                    with contextlib.redirect_stderr(io.StringIO()):
                        with self.assertRaises(SystemExit) as exit_case:
                            agent.main()
                        self.assertEqual(exit_case.exception.code, 2)

    def test_sandbox_preflight_stops_before_claiming_any_job(self):
        with mock.patch.object(agent, "sandbox_ready", return_value=False), \
             mock.patch.object(agent, "post") as post:
            with self.assertRaises(agent.SandboxUnavailable):
                agent.once()
            post.assert_not_called()
        work = mock.Mock()
        log = io.StringIO()
        with contextlib.redirect_stderr(log):
            self.assertEqual(agent.serve(run_once=work, probe_check=lambda: False), 1)
        work.assert_not_called()
        self.assertEqual(log.getvalue(), "sandbox_unavailable\n")

    def test_runtime_sandbox_failure_does_not_finalize_job_or_look_successful(self):
        job = {"id": "synthetic-job", "lease": "synthetic-lease"}
        with mock.patch.object(agent, "sandbox_ready", return_value=True), \
             mock.patch.object(agent, "post", return_value={"job": job}) as post, \
             mock.patch.object(agent, "execute", return_value={"ok": False, "error": "sandbox_unavailable"}):
            with self.assertRaises(agent.SandboxUnavailable):
                agent.once()
            post.assert_called_once_with("claim", {})
        log = io.StringIO()
        with contextlib.redirect_stderr(log):
            self.assertEqual(agent.serve(run_once=mock.Mock(side_effect=agent.SandboxUnavailable()), probe_check=lambda: True), 1)
        self.assertEqual(log.getvalue(), "sandbox_unavailable\n")

    def test_exact_stale_lease_409_is_skipped_and_next_job_runs(self):
        job = {"id": "synthetic-job", "lease": "synthetic-lease"}
        with mock.patch.object(agent, "post", side_effect=[{"job": job}, agent.StaleLease("stale_lease")]) as post, \
             mock.patch.object(agent, "execute", return_value={"ok": False, "error": "build_failed"}):
            self.assertEqual(agent.once(preflight=False), "stale_lease")
            self.assertEqual(post.call_count, 2)
        tasks = iter(["stale_lease", "succeeded"])
        self.assertEqual(agent.serve(max_jobs=2, run_once=lambda: next(tasks),
                                     probe_check=lambda: True), 0)

    def test_only_signed_stale_lease_reply_is_recoverable(self):
        def response(status, payload):
            fake = mock.Mock()
            fake.status = status
            fake.read.return_value = payload
            return fake
        conn = mock.Mock()
        with mock.patch.dict(agent.os.environ, {
            "SKILLS_URL": "https://skills.example.test", "SKILLS_RUNNER_TOKEN": "test-only"
        }), mock.patch.object(agent.http.client, "HTTPSConnection", return_value=conn):
            conn.getresponse.return_value = response(409, b'{"error":"stale_lease"}')
            with self.assertRaises(agent.StaleLease):
                agent.post("jobs/synthetic-job/complete", {}, "synthetic-lease")
            conn.getresponse.return_value = response(409, b'{"error":"daily_limit"}')
            with self.assertRaises(RuntimeError):
                agent.post("jobs/synthetic-job/complete", {}, "synthetic-lease")
            conn.getresponse.return_value = response(409, b'{"error":"stale_lease"}')
            with self.assertRaises(RuntimeError):
                agent.post("claim", {})



if __name__ == "__main__":
    unittest.main(verbosity=2)
