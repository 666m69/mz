# MZcode Saudi Assistant — Workers AI integration (development only)

## Verified integrations
- Existing Cloudflare Pages project `mz702` contains an `AI` binding in **preview and production**. This was read through the connected Cloudflare account; no existing secret value was retrieved.
- Preview also has `DB` (D1) and `MZ_CONTACT_SECRET`. The backend uses those bindings rather than exposing any model key to the browser.
- Model: `@cf/meta/llama-3.1-8b-instruct-fp8` (Cloudflare Workers AI, server-side).
- Built assistant page: `/assistant/`. Same-origin API: `POST /api/assistant`.

## Current operation
- The endpoint is **disabled by default** until `MZ_ASSISTANT_AI_ENABLED=true` is explicitly added to a reviewed preview deployment. No live inference has been run during this development task.
- The original on-device checklist, school message and property draft tools remain available after a successful AI response; model text **never executes tools** or shell code.
- The UI requires explicit consent, then sends only the typed message and at most four recent messages. No conversation content is inserted into D1. It is shared with Cloudflare Workers AI for inference; the user must not provide personal, pupil or patient information.
- Sensitive patterns are blocked server-side where recognized; this is **not a guarantee** that all sensitive information will be detected.
- D1 quota schema is `pilot/migrations/assistant-ai-rate.sql`; do not apply to production without a review. Stores HMAC-hashed per-IP/day buckets and global/day counters, no plaintext IP or chat transcript.
- Daily safeguards: three requests per visitor and 12 requests globally per UTC day (at least initially). These caps limit exposure but **do not prove** the account cannot incur charges.

## Deployment prerequisites — not yet executed
1. Verify Cloudflare account's billing plan and active free quota. The connected OAuth lacks billing-read scope; subscription lookup returned 403, so costlessness cannot be proven. Workers AI Free includes 10,000 Neurons/day, but Workers Paid bills above this allocation.
2. Check with the owner before any live inference, ensure current usage is inside the free allocation, and enforce budget stop on the account.
3. **Completed:** D1 quota table and index were applied to the existing `mz702-qa-preview` D1 only; verified via sqlite_master. No customer rows were queried or modified. Next, test the preview Worker with AI disabled.
4. Enable `MZ_ASSISTANT_AI_ENABLED=true` in **preview only**, verify Arabic response, rate limits, privacy warnings, CSP and mobile display. Inspect spend/usage afterward.
5. Only after owner approval, review release to production with audited quota, monitoring, rollback path, and privacy notice.

## Tests
- `npm test` on a draft PR runs all project tests plus `pilot/tests/assistant-ai.test.mjs` and `pilot/tests/assistant-worker-build.test.mjs` on GitHub Actions.
- API tests use a **mock AI binding**, not a chargeable model call. They cover consent, origins, history validation, PII screening, per-user rate limit, explicit disable and model outages.
- The Worker build test checks `build/worker.mjs` syntax, bundled assistant assets and a same-origin request through the fully built Worker.

## Free allocation references
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/pages/functions/bindings/

This branch does not change the production site or production database and does not enable AI billing or send client data to any model. It created one quota table and index in the *preview-only* database, without touching existing tables.
