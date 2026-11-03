# MZcode Skills Server v1 — development-only

## Evidence and current status

Repository branch: `feat/skills-server-v1-20261103` (based on `feat/real-app-builder-v1-20261103`). Cloudflare connection read-only inventory succeeded: Pages `mz702`, `kafu-mz702`; 10 Workers; 4 D1 databases. **No Cloudflare resource was created or modified.**

This is a **local, in-memory prototype**, not a persistent, multi-tenant or production-ready Skills Server. No build execution on Cloudflare. The only executor is a vetted template generator (task and shopping checklist). The second skill is a second category using the same trusted generator, **not an independent app architecture**. It cannot safely execute arbitrary generated code or visitor scripts.

## Run

Node.js >=22.13, no new packages:

```sh
export MZ_SKILLS_OWNER_TOKEN='replace-with-32-plus-random-secret-characters'
node pilot/skills/local-api.mjs
# open http://127.0.0.1:8789/admin
node --test pilot/tests/skills-server.test.mjs
```

The loopback API is deliberately not public. Keep tokens out of git. The local admin interface uses an in-memory token field; do not use it on a public domain.

### Routes

All require `Authorization: Bearer <owner-token>`:
- `GET /internal/skills` — current definitions.
- `GET /internal/skills/:id/versions` — history.
- `POST /internal/skills` — register *disabled* next version of an approved handler; requires `test_status=verified_unit`.
- `PATCH /internal/skills/:id/enabled` — owner enable/disable.
- `POST /internal/skills/:id/rollback` — copy a previous version as a new **disabled** version.
- `POST /internal/skills/:id/run` — bounded template build; requires `Idempotency-Key` (8–80 alphanumeric/underscore/dash).
- `GET /internal/skills/audit` — in-memory audit.
- `GET /internal/skills/runs/:id` — in-memory run result.

A registration cannot introduce a new executable handler; only audited `checklist` and `shopping` are allowed. `test_status` is a manually supplied field, **not proof of tests**; a real approval/CI attestation must replace it before any production enablement.

## Safety limits and blockers

- Owner token is checked with timing-safe comparison. This is **not** a full identity provider or production RBAC.
- Rate limit: ten run attempts per minute per service process, **not** distributed/per-user.
- Idempotency: in-memory; does not persist across restarts. The key is bound to a SHA-256 request digest and conflicting payloads are rejected; storage is still in-memory and must be made durable before multi-user use.
- Registry, logs, run state are all in memory; restart loses history and updates. No D1 migrations have been applied.
- Generated app files live in `.mz-generated` and are excluded from git. No per-customer isolation, encryption, retention policy, quotas or secure deletion.
- API is loopback-only. No external deployment, price, payment, customer data, or publication.
- No arbitrary shell execution, npm installs, dynamic plugins, LLM-generated code execution or customer-provided code.
- Input schemas are descriptors, not a general JSON Schema validator. Need stronger schema validation and separate approvals.
- Local tests were **added but not verified by an actual runner in this task**; attempted container execution failed with an infrastructure error. Therefore no test pass rate is claimed for this branch. Previous builder test reports are not proof of these new tests.
- The local admin screen supports list/enable/disable/audit only; version registration and rollback are API-only. This is not a complete owner console.

## Next release gate

Run `npm test` on the branch, fix any failures, add persistent D1 migrations and rollback strategy, bind idempotency to request digest, implement distributed rate limits and durable audit, owner identity, actual CI-attested skill activation, and isolate per-customer build runners with quotas. Prove one end-to-end run in a real browser. Only after these checks should a separate preview be considered. Production remains untouched.
