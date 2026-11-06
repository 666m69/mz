# MZcode Orchestrator v1 — isolated engineering prototype

## What is implemented
A real deterministic, **reviewed static web-app pipeline** for a narrow class of Arabic ideas (personal tasks/shopping checklists only):

1. Route visitor-like **synthetic** Arabic text through a fail-closed intent gateway.
2. Select the `local-checklist` skill from the versioned reviewed registry, with its pinned adapter digest.
3. Build actual `index.html`, `app.js`, `styles.css`, `blueprint.json` files using the existing audited static builder.
4. Exercise the **trusted** runtime in a bounded Node DOM fixture (add, persistence, completion, filtering, reload, edit, delete) and validate the HTML and artifact limits.
5. Package the four reviewed files into a private ZIP and verify its contents, with `acceptance.json` recording SHA-256, checks and restrictions.

```sh
node --test skills-server/test/registry-integrity.test.mjs skills-server/test/intent-guard.test.mjs orchestrator/test/*.test.mjs
node orchestrator/cli.mjs --synthetic
```

No billing, hosting, extra subscriptions, cloud runners, production deployment, network access, or access to real customer records is required or enabled.

## Scope & security
- Supported: standalone browser-local checklist apps. Files work offline after opening locally.
- Explicitly **not** supported by this path: complex e-commerce, company purchasing systems, remote sync, user accounts, native mobile hardware, AI-generated executable code, payments, external integrations, or arbitrary websites.
- Counter: recognized but marked `requires_trusted_linux_runner`; never silently built by the checklist adapter.
- Unsupported/ambiguous requests return `manual_review`; no files are written.
- Untrusted idea text is **data only**, not a command, path, module, source file or JavaScript.
- Trusted `outputRoot` must be supplied by the operator; it must never be accepted from a visitor request.
- Source SHA-256 hashes in `skills-server/reviewed.json` are immutable; modified adapters require a separately registered and tested version.
- ZIP artifacts stay in a private temporary directory, are not auto-published, and have no customer download URL.
- A Node simulated DOM is **not** an actual Chromium browser E2E. It verifies behavior but cannot establish production correctness.
- `Node.js vm` is NOT a sandbox for untrusted code; only code-reviewed static runtime is run there.

## Next gates
- Pass Linux seccomp, Python service tests, Chromium browser acceptance, and verify QA runner digest match.
- Add an authorized private runner to drive the actual versioned Skills Server queue and produce auditable artifacts.
- Implement authenticated, consent-aware, tenant-isolated customer intake with individual quotas and retention/deletion controls.
- Add new *versioned* vetted adapters one by one; AI may extract structured fields but cannot run arbitrary visitor code.
- Prove a hosted synthetic end-to-end run under a zero-additional-cost quota **before** making any public production offer.

## Commercial claim
The website may say "خلّ التقنية علينا" as a service promise, but must NOT claim any idea is automatically built in real time. This branch has an isolated working example, not customer-facing Orchestrator deployment.
