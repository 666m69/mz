# MZ Code Hub — production operations and rollback

Captured 2026-11-02. **This document is not a production Pages source backup.** It records additive Worker routes only.

## Baseline
- Zone `mzcodehub.com` on Cloudflare Free plan, DNS apex/www -> `mz702.pages.dev`.
- Pages project: `mz702`; most recent observed production deployment `857239b0-7cb5-4ad2-9006-4d97d26148d4` (2026-11-01 02:11 UTC, success).
- Pages source metadata references `666m69/mz`, but that repo's main branch is older and automatic production deployments were disabled. Direct Pages uploads contain newer code.
- Existing catch-all Worker `mzcodehub-public-entry` routes:
  - `mzcodehub.com/*`: `d75f0aa1da294ebf8c35b2ee98fbc9e8`
  - `www.mzcodehub.com/*`: `54e62be0c0d947449485e7565c834710`
- **Do not change the catch-all routes or account-wide Access app.**

## Added /idea
- Worker `mzcode-ideas-preview` (public Worker-level Access bypass, scoped to this Worker).
- D1 name: `mzcode_ideas`; DB: `3c64b8bc-bd82-449e-b556-a7fc745ddaba`; secret binding `HASH_SALT` (never printed/committed).
- Routes:
  - `mzcodehub.com/idea*`: `0e5dfe69107d44ea81f0e36d17434b33`
  - `www.mzcodehub.com/idea*`: `6b582243175e40d7a5d931ec0a64068d`
  - `mzcodehub.com/api/ideas*`: `972ae6f4b668482d9b7543cc4041da82`
  - `www.mzcodehub.com/api/ideas*`: `ee1914a577b24886920e2a76afefeb7b`
- Preview URL: `https://mzcode-ideas-preview.666m69.workers.dev/idea`.
- One real production test returned HTTP 201, with D1 row verified. All 5 QA rows were removed; database count observed to be zero afterward.

## Admin read-only inbox
- Worker `mzcode-ideas-admin`, D1 read-only queries, public Worker subdomain disabled.
- Admin application Access AUD (public identifier): `92323b54a2124456358a22cd875b15fc92c9a9df`.
- Cloudflare Access issuer: `https://nameless-bonus-3327.cloudflareaccess.com`.
- Restricted:
  - `mzcodehub.com/admin/ideas*`: `b87646c63bb14ce69870553e11556063`
  - `www.mzcodehub.com/admin/ideas*`: `640d8b8db3dc4d98b8676b2fd5c2c420`
  - `mzcodehub.com/api/admin/ideas*`: `da448881e3234540ba44e4582ef19788`
  - `www.mzcodehub.com/api/admin/ideas*`: `b70d2e580d184ad6894e0a74c3bdebd1`
- Worker also verifies signed Access RS256 JWT using Access public JWKS endpoint. Anonymous visit to /admin/ideas showed Access sign-in.

## Existing quotation tool
The existing Pages /tools/quote/ was discovered on the homepage. Two temporary routes overriding it were **removed**, and the existing tool was verified restored:
- Deleted route IDs: `d19e1c61aedd498581a5f60462de2adb`, `0c2a62fa90314714aa39dbce41411452`.
- New alternative source kept in GitHub as `mz-quote-worker.js`; preview `https://mzcode-quote.666m69.workers.dev/tools/quote` remains available for comparison. It does NOT override the live Pages page.

## Emergency rollback — exact Cloudflare API
List routes first: `GET /zones/ccafb7839c821c38d42003d24112ff5b/workers/routes`.
Delete only the route IDs listed above for the feature being reverted:
`DELETE /zones/ccafb7839c821c38d42003d24112ff5b/workers/routes/{route_id}`.
Do **not** delete the original wildcard routes or Pages project. If removing ideas, remove /idea and /api/ideas paths together. If removing admin inbox, remove /admin/ideas and /api/admin/ideas paths together. Keep D1 data until retention/deletion policy is reviewed, unless explicitly asked to delete.
After rollback verify `/`, `/privacy`, `/tools/quote/`, `/admin`, and `/api/contact`.

## Known gaps
- Existing homepage does not yet link to /idea.
- Read-only admin inbox: does not modify request statuses, notify info@ or quote prices.
- Existing Pages assets/Functions do not yet have a restorable, parity-tested source snapshot in GitHub.
- Browser Rendering anonymous tests do not replace an authenticated admin session test.
