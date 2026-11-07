# MZcode Skills Server — D1 private delivery retention (staging, 2026-11-07)

**Status:** isolated engineering branch only. Do not modify mzcodehub.com production DB, Worker routes, secrets, or public visitor flow from this PR.

## Existing foundation

The reviewed Skills Server already has a D1-backed leased work queue, a versioned skills registry, a private request capability, AES-GCM encrypted `ss_artifacts` rows, and an authenticated ZIP retrieval route. This change extends the existing system instead of adding a separate R2 subscription or duplicating the store.

## What changes

- Migration `0002_delivery_retention.sql`: `ss_artifacts.download_expires_at`, `purge_after`, `revoked_at` with backfill and retention checks. Run only after `0001_skills.sql` on the **dedicated SKILLS_DB**. No action on the real customer ideas/contact D1.
- New build artifacts have a download window of **14 days** and are eligible for deletion after **30 days**.
- Artifact reads return **404** when expired, revoked, missing, or malformed. The existing `authenticate` + `scope` guard still enforces the request capability.
- Private owner-only revocation: `POST /api/requests/{request_id}/runs/{job_id}/revoke` with valid Owner Bearer token, `Content-Type: application/json`, `Idempotency-Key: <12-80 allowed characters>` and body `{}`.
- A `scheduled()` handler can purge expired D1 artifact rows. **No Cron Trigger is activated** by this source change.
- No changes to the pricing, billing, public visitors, production domains, or real customer data.

## Safe staged acceptance

1. Create a fresh **dedicated test D1** with migration 0001 and then 0002; do not reuse the live customers' D1.
2. Configure Skills Server secrets and Access restrictions in test only. No secret values in PRs or logs.
3. Register and approve a reviewed checklist skill, submit **two synthetic** distinct requests A and B, build each with reviewed runner, and validate their independent request capabilities.
4. Assert A's capability cannot inspect/download B's ZIP; anonymous and runner callers are denied; expired and revoked A cannot download; B still can.
5. Advance expiry in QA test DB only, invoke the scheduler entrypoint, and verify the correct artifact was deleted with audit metadata retained.
6. Ensure the Pages/Workers preview job passes Node, Python, and migration tests. Do not weaken Cloudflare Access or publish the service on the public domain.

## Open gates / limitations

- Request-scoped bearer capabilities are **not equivalent to email ownership verification or full customer login**. Do not email a ZIP link until the recipient is verified through a trusted delivery workflow.
- A real scheduled Cron Trigger requires separate validation and deployment after the staging pilot; without it, expired ZIPs become inaccessible but remain stored.
- The Node filesystem-based `orchestrator/private-vault.mjs` prototype is not directly deployable to Cloudflare Workers; the D1-backed Skills Server is the intended edge storage path.
- The reviewed builder still covers only a fixed class of local checklist applications. No general open-ended generation is claimed.
- Staging migration testing is against SQLite contract and existing Skills Server emulation. It is **not** proof that an external customer can currently receive a ZIP from production.

**Rollback:** deploy the previous Skills Server Worker version; retain the added nullable D1 columns and audit records. Never delete customer rows or roll back the real customer D1.
