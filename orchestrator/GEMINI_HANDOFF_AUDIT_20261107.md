# Gemini handoff audit — 2026-11-07

**Disposition: NO-GO for importing the supplied orchestration/runner/vault into production.** The original artifacts remain unmodified in the owner's Google Drive, verified against their supplied SHA-256 fingerprints. This PR only introduces a fresh **unwired staging-only** private ZIP vault with explicit owner checks and negative tests; it does **not** import the unsafe Gemini files, connect the public /idea route, publish visitors' apps, or enable payments.

## Verified handoff

- `mz-platform-source-and-tests-20261106.zip`: **37,041 bytes**, SHA-256 `5f8aaa39072885b160acd7e6f9178f2a6d6efce4160e598dbc020c7ab72088e6`.
- `MZ-ORD-MW5D195U-9B7D16.zip`: **5,080 bytes**, SHA-256 `f506f7b900221b05bc69bbe1d826f8c9385aed1a52389b91a25403efef40fbaf`.
- Archive CRC tests passed. The packaged application contains byte-for-byte copies of `apps/daily-tasks/index.html`, `style.css`, and `app.js` in the source archive.
- The supplied "raw logs" document is a prose summary of process exit codes, not an independently reproducible stdout/stderr transcript.

## Independent execution on Node 22.16 and Python 3.13

- Passed: `test_service.py` **7/7** (but it tests an **in-file MockQueueService**, not the actual deployed queue); `test_skills_lifecycle.mjs` 8 lifecycle stages; `test_intent_classifier.mjs` **50/50 synthetic samples**; `boundary.test.mjs`, `control.test.mjs`, `restart.test.mjs`, `runner.test.mjs`.
- `test_isolation.py`: **6/7**, `test_06_memory_bound` failed `MemoryError` at a 64-MiB address-space cap in this Python runtime. Evidence is environment-sensitive, but 7/7 cannot be claimed for this independent run.
- The original `test_orchestrator_pipeline.mjs` fails `ENOENT` because it references absolute paths under Gemini's former `/working_dir/...`. A *local QA copy only* with those paths corrected completes the synthetic pipeline and generates a ZIP of **5,080 bytes**; that test does not establish a production deployment or customer authentication.
- Original Chromium/Selenium tests likewise use fixed Gemini absolute paths and require packages not available in this environment. The independent container Chromium refuses access to local HTTP origins under organizational browser policy; that policy was not bypassed. **No independently passed real-browser reload check is claimed.**

## Confirmed blocking security issues in received code

1. `delivery/vault.mjs`: a fixed default HMAC secret, optional `requestClientId` allowing an owner check to be omitted, and unsigned visitor identifiers are unacceptable for commercial delivery. A safe local negative test proved the omitted-client-ID bypass.
2. `orchestrator/engine.mjs`: global (not client-scoped) idempotency keys. A second synthetic client using the same key receives the first client's order record; proven with a local negative test.
3. `skills-server/isolation.py`: `os.fork` + rlimits are *resource constraints*, not complete Linux sandboxing (no network namespace or seccomp); untrusted child-to-parent `pickle.loads` must not be used as a trusted IPC deserializer.
4. `orchestrator/packager.mjs`: concatenates filesystem paths into generated Python source and shells out via `execSync`; it needs a reviewed, parameterized ZIP builder and path validation.
5. `delivery/vault.mjs`: 30-day retention and PDPL compliance are metadata assertions, without a scheduled purge, durable authenticated access boundary, or evidence of at-rest encryption.
6. Both the registry and orchestrator persist only in memory; there is no proven production-safe worker service or deployed client delivery API.
7. The submitted `wrangler.toml` includes `[env.preview]`, while Cloudflare's `wrangler preview` error explicitly requires a top-level `previews` configuration. Moreover, the submitted `main = "worker/index.mjs"` path is absent from the delivered ZIP. **Do not publish this config to production.**
8. The original code merely substitutes into fixed reviewed HTML/CSS/JS templates; it is not an open-ended app generator.

## Improvements in this PR

- New `orchestrator/private-vault.mjs` prototype: requires a caller-provided 32+ byte secret (no default), server-validated client identity, exact client/token/order bindings, a private static artifact path, per-client directories, HMAC integrity check with timing-safe comparison, no silent overwrite, expiry/revocation, explicit purge function, persistence between Node processes through private receipt files.
- New `orchestrator/test/private-vault.test.mjs` with negative coverage for missing identity, cross-client download, forged/expired tokens, duplicate storage, path traversal, revocation and retention.
- **This vault is NOT yet connected to any public API.** A trusted authenticated API must bind the caller's verified identity and invoke purge on a real schedule before it may be considered for production.

## Required before GO

Prove the authenticated visitor-to-owner binding, persistent/isolated queue, worker sandbox with real network/syscall restrictions, acceptance of actual ZIP bytes via reviewed source hashes, hosted Chromium E2E, upload-download with two unrelated test clients, expiration and purge scheduling, and PDPL review. Keep the existing production branch and customer data untouched.
