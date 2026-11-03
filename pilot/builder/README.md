# MZcode App Builder v1 — internal, not deployed

## What was implemented

This is an **actual static application code generator**, not the existing Lab scenario simulator. It accepts a short Arabic or English idea, applies `pilot/capability-gate.mjs`, and generates four standalone files for a **local checklist** application. Supported v1 categories are simple **tasks** and **shopping lists** only. The generated app has add, edit, complete, delete, filter and browser-local persistence. Arabic RTL and mobile-first styling are included.

It does **not** generate arbitrary applications, use an LLM to write code, run visitor input as code, create a server/backend, expose a public build API, host apps, or deliver a project to a customer. External integrations, login, payments, databases and high-risk requests are routed to manual review by the advisory gate. Rule matching is not a complete policy or security system.

## Run (Node.js >=22.13, no dependencies)

```bash
npm test
node pilot/builder/engine.mjs 'أريد تطبيق ويب بسيط لتنظيم مهامي اليومية وإكمالها'
```

The CLI prints the isolated output directory under `./.mz-generated/mz-app-*`. To preview a generated app on your own computer:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory .mz-generated/mz-app-REPLACE_ME
```

Visit `http://127.0.0.1:8000/`. Output is excluded from Git through `.gitignore`.

## Trust and privacy boundaries

- **No user text is executed:** Only audited static source templates are emitted. No `eval`, dynamic module loading, shell or package install.
- **Allowlist:** Unknown ideas are rejected (`UNSUPPORTED_IDEA`); external requirements are flagged (`REVIEW_REQUIRED`).
- **No customer uploads or secrets:** The output includes a normalized blueprint but not the original visitor idea.
- **Output location:** Trusted local CLI caller controls `outputRoot`; names are random and never interpolated from a visitor's text. Do not expose `outputRoot` to visitor input.
- **Frontend:** CSP, text-only rendering of user-entered items, no remote requests; each generated app has its own localStorage namespace.
- **No public execution sandbox:** This deliberately does not run visitor-supplied JavaScript. A hosted multi-tenant builder will require isolated workers, quotas, authentication, audit logs, content moderation, explicit approval, privacy and IP rights handling before integration.

## Verified scope / blockers

- **9 tests passed locally** on Node.js 22.16: plan validation, actual file generation, independent app IDs, injection rejection, and a mock DOM run of add/edit/toggle/filter/reload/delete plus text-only rendering.
- Exact Git blob hashes of the core generator files were compared against the published branch files.
- An attempt to run Chromium headless in the local execution environment timed out. Therefore **real browser/mobile compatibility and production runtime have not been verified**. The mock DOM test is not a substitute for Chrome/Safari manual testing.
- No changes were merged into `main`, no Cloudflare deployments, customer notifications, database migrations or production requests were made by this change.
- Next gate: manually inspect the generated ZIP in a real browser; then review threat model and customer-data workflow before considering a preview environment or production deployment.
