# MZcode Skills Server — isolated QA gates (2026-11-08)

## Confirmed account inventory (read-only)
- Dedicated Worker: `mzcode-skills-qa-20261104`; Workers.dev and Preview URLs are both disabled.
- Dedicated D1: `mzcode-skills-qa-20261104` (UUID in `wrangler.qa.jsonc`).
- Cloudflare Access has a self-hosted app restricted to the QA hostname and an ephemeral non-identity policy.
- No changes to `mz`, `mzcodes`, `mzcodehub-public-entry`, Pages `mz702`, or production D1.
- Access and Worker bindings exist, but **the QA service is presently closed**; a protected, live URL and end-to-end service execution have not been newly accepted in this branch.
- Commercial Worker previews failed previously for `mz` and `mzcodes`. Do not repair these by enabling public preview URLs on production. Use the separate QA host with an authenticated short-lived test session.

## Acceptance gates

1. **Local autonomous runner:** run `node --test skills-server/test/auto-service.test.mjs` on Linux with Python 3.10+, Node 24 and libseccomp. The test creates two synthetic jobs, launches one bounded `--serve` worker, then verifies both jobs succeeded without calling `--once`; ZIP must be private and deterministic.
2. **Hosted QA:** independently re-check Access protection, Worker deployment, isolated D1 binding and valid secrets; only then enable a temporary protected QA URL. Never grant public bypass. Reuse synthetic inputs and revoke temporary service tokens afterward. Keep workers.dev and Preview URLs disabled at rest.
3. **Failure and quota:** assert `queue_full`, `daily_limit`, `capacity_limit`, `stale_lease`, `lease_exhausted`, authentication failures and `Retry-After` behavior. Simulate failed runner and stopped runner. Do not queue real customer data.
4. **Billing:** verify available Cloudflare/GitHub execution allowance and billing before scheduling unattended runs or enabling an always-on host. Presence of a free-tier resource does not establish a zero-charge guarantee.
5. **Release:** separate owner approval is required for merge to `main`, customer intake, pricing, payment, public availability, and any new paid resources.

## Operational decision
The bounded `--serve` process polls while its trusted Linux host is running; it **does not** create an on-demand hosted execution service. The automated-local acceptance gate proves the queue consumer works under an active supervisor, not that every commercial visitor triggers a build. A protected hosted wakeup solution and capacity budget remain release blockers.

`wrangler.local.jsonc` remains an intentionally unbound local fixture. `wrangler.qa.jsonc` is a scoped record of the existing QA resource IDs, and should not be deployed without the Access and version checks above.
