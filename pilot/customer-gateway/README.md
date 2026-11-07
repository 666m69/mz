# MZcode — Verified Customer Delivery Gateway (STAGING ONLY)

## Decision and scope

Builds an **email-verified bridge** from the existing `idea_requests` table to the reviewed Skills Server private, encrypted ZIP delivery API. This patch does **not** deploy or change `mzcodehub.com`, production D1, Cloudflare Access, automatic production deployments, pricing, billing, or live customer records.

The Gateway authenticates the **recipient's email** by a limited one-time code. A short MZ reference **never authenticates** file downloads. The code is not a password substitute for full KYC/legal identity verification.

## Implemented API

| Method | Path | Authentication | Result |
|---|---|---|---|
| POST | `/api/customer/verification/start` | Same-origin; IP/idea rate limits | Always generic 202 for valid reference/email format, sends an 8-digit code **only** to the recorded email when it matches |
| POST | `/api/customer/verification/confirm` | Matching email + OTP | 30-minute `HttpOnly; Secure; SameSite=Strict` cookie |
| POST | `/api/customer/session/logout` | Same-origin | Deletes session and clears cookie |
| GET | `/api/customer/requests/:ref` | Customer session bound to that exact idea request | Status, not private customer data; delivery availability from Skills run |
| GET | `/api/customer/requests/:ref/artifact` | Same verified session | Proxies a **bounded** verified ZIP from a private Skills Server service binding; no token in browser |
| POST | `/api/customer/admin/link` | Disabled unless explicitly enabled; 256-bit admin bearer | Verifies owner-approved real Skills request+successful run+ZIP before sealing the private request token |
| POST | `/api/customer/admin/revoke` | Same disabled-by-default admin API | Irreversibly denies gateway download |
| scheduled | Cron handler | Cloudflare infrastructure | Removes expired OTPs, sessions and old rate counters; never removes delivery mappings |

The Web UI is staged at `site/delivery/index.html` (route `/delivery/`), with self-hosted CSS and JavaScript. It never exposes or stores customer capability tokens and does not persist OTPs in browser storage. The first two steps are *mailbox proof* and *private project status/download*.

## Safe staging configuration

1. Create a **new dedicated D1 database** for `GATEWAY_DB`; apply `pilot/customer-gateway/schema.sql` to this database only. The gateway must **not** run a migration against existing `mzcode_ideas` or Skills Server production D1.
2. Bind existing ideas D1 as `IDEAS_DB` **read-only in application logic**. The Gateway queries `SELECT id,email,status FROM idea_requests ...` and does not update it; any D1 binding token still carries the Workers account's effective permissions, so application audit is essential.
3. Bind a separate **private** Skills Worker using a Cloudflare Service Binding named `SKILLS_SERVICE`. No public Skills URL or Access bypass is needed. The Skills Worker must already be configured with a working isolated SKILLS_DB, source-approved release, signed review and private encrypted ZIP storage. **Do not use QA fixture data or production owner tokens.**
4. Add two unrelated 32-byte random Base64URL strings (43 characters) as **secret** bindings: `GATEWAY_HMAC_KEY` and `GATEWAY_DATA_KEY`. Do not reuse the Skills Server keys.
5. Add `RESEND_API_KEY` as a secret only when its existing free allowance, sender domain `info@mzcodehub.com`, and verified service setup have been independently confirmed. The test harness uses `TEST_MAILER` and **never sends an external email**.
6. Keep `GATEWAY_ADMIN_ENABLED` **absent** by default. The link/revoke API must be exposed only behind validated Cloudflare Access with a strong private `GATEWAY_ADMIN_SECRET` and an owner-approved workflow; do not make an admin token or owner capability available to visitors. Prefer a private service-to-service caller.
7. Keep Workers.dev subdomain disabled and site maintenance redirect enabled during acceptance. There is no public route until acceptance and owner authorization.
8. After confirming test-only verified delivery and approved retention policy, configure the gateway's scheduled cleanup in staging, verify that no new charges were incurred, and then perform production rollout as a separate explicit release approval.

## Acceptance gates

Automated CI integration covers a synthetic email/OTP send, wrong email and nonexistent reference, 5 failed attempts, one-time code consumption, HttpOnly cookie expiry and logout, two distinct genuine locally generated Arabic web apps submitted to the real Skills Server, admin-only link validation, encrypted token storage, downloaded ZIP bytes, cross-customer access denial, immutable revocation and expired-data cleanup.

**Not yet claimed:** Real Resend delivery to a customer's inbox, production service binding, QA Worker hosted gateway against actual Cloudflare D1, production customer interface, fully autonomous owner approval/building, support for arbitrary app categories or commercial/PDPL sign-off. The public static form `/delivery/` MUST NOT be linked from the production customer journey until the API is deployed, acceptance-tested and authorized.

## Privacy and operational constraints

- The existing intake table retains customer email under the existing policy; Gateway D1 stores **HMAC email digests, random hashed sessions, OTP digests and encrypted Skills tokens**, not OTPs or raw private capabilities.
- OTP: 8 decimal digits, valid 10 minutes, at most 5 failed attempts per challenge, limited sends per IP and per idea per hour.
- Session: 30 minutes, HttpOnly cookie; no secret in URL, HTML, localStorage, status JSON or response headers.
- Owner-created mappings may not be silently reassigned; gateway revocation is irreversible. A more comprehensive legal erasure policy will require separate retention review.
- If sending fails, an OTP challenge is removed (the API's generic acknowledgement deliberately prevents account enumeration); do not claim email was delivered.
- All D1 and external service errors are normalized to non-sensitive HTTP response codes. Internal exception text must never be returned to clients.
- Production is **NO-GO** until the full journey is verified with both UI and hosted backend and the owner authorizes it.
