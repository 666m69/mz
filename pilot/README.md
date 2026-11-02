# MZ Code Hub — Open Ideas MVP

An isolated Arabic RTL intake prototype for `/idea` and `POST /api/ideas`. It is **not** the current production website and does not replace the live Pages deployment.

## User flow
1. Visitor enters any idea and an email. No predefined categories.
2. Worker validates input, rejects cross-origin requests, applies a per-IP hourly limit, and stores request in a D1 database.
3. Visitor gets a reference ID. No payment, automatic AI-generated prototype, automatic quotation or delivery is claimed.
4. Administrator reviews the database manually, then changes status through an authenticated future admin interface.

## Setup (Cloudflare free resources, separate from existing D1)
- Create a D1 database `mzcode_ideas` and apply `schema.sql`.
- Deploy `mz-ideas-worker.js` with D1 binding named `DB` and secret `HASH_SALT` (random 32+ bytes). No secret is committed.
- Test on worker preview or isolated test hostname. Do not attach a production route until end-to-end testing passes.
- After protecting the production admin routes, attach `mzcodehub.com/idea*` and `mzcodehub.com/api/ideas*` (plus www equivalents), preserving all other routes.
- Current Cloudflare Access has overlapping public policies; validate access precedence for new routes before exposing.
- Do not turn on GitHub-to-production deployments yet: current Pages production has direct uploads not represented in the repository.

## API
POST /api/ideas
Content-Type: application/json
{"idea":"string 20–5000 chars","email":"valid email","name":"optional 0–100 chars","website":"empty honeypot"}
201 {"ok":true,"id":"UUID"}
400 invalid content, 403 origin, 415 media type, 429 rate-limited, 503 unavailable.

## Verification
- GET /idea: 200, RTL mobile form; homepage unchanged.
- Valid POST: 201, row exists in isolated D1, UUID returned.
- Short idea, malformed email, oversized request and wrong media type: rejected; no row created.
- After three submissions from same client IP in 60 minutes: 429.
- Cross-origin POST: 403.
- No D1 binding / database outage: 503, never show false success.
- Existing /api/contact, /admin, /tools, /games and inbox routing unchanged.
- Verify both apex and www and check Cloudflare Access does not force login on public idea path.
- Security next: Turnstile or equivalent bot protection, robust request-body byte cap (read stream safely), consent/privacy and retention policy, authenticated admin views, email notifications, backup and deletion workflow.

## Current limitations
- No AI design engine, PDF proposals, admin dashboard, payments, notifications, automated pricing or staging deployment.
- The temporary privacy notice requires legal review before public launch.
- Existing GitHub main branch shows an older personal website, not the current production Pages site. First recover and version the direct-upload production artifact, test matching release, then integrate this pilot into the canonical codebase.
