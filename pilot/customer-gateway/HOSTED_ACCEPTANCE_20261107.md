# MZcode — 27/27 hosted customer-verified delivery acceptance

**Date:** 2026-11-07, verified 08:06:37 UTC / 11:06:37 Saudi Arabia.  
**Verdict:** PASS for synthetic-customer staging gateway; **public commercial rollout still gated**.

## Source evidence

All **27 of 27** phase records returned `ok: true` (0 failed), then a final Cloudflare KV receipt returned:

```json
{"ok":true,"executed":27,"lastPhase":"portal-purge"}
```

Verified from the authenticated Cloudflare account KV management API. The tests ran inside a **private Cloudflare Queue consumer** with:
- brand-new dedicated **Skills Server D1**;
- a separate dedicated **ideas D1** containing only two synthetic records;
- a separate **customer gateway D1** with the new `cv_*` schema;
- a temporary **Queues** delivery trigger and **KV** evidence store.

No public Worker subdomain, paid account upgrade, production customer data, Cloudflare Access bypass or live site change.

## First 17 phases — real app generation and private Skills delivery

1–4. Fresh 0001/0002/0003 Skills D1 schema; approved template release/review/activation.
5–8. Synthetic requests A and B; request A enqueued and leased.
9–11. Actual approved task-list app generated from A's decrypted idea; encrypted four-file artifact persisted; **10,574-byte ZIP** downloaded with correct private capability; foreign request/anonymous/runner denied; revocation immutable.
12–15. Client B build job enqueued and leased; distinct approved shopping-list app generated from B's decrypted idea; encrypted ZIP **10,597 bytes** downloaded; foreign request/anonymous/runner denied.
16–17. SQLite trigger prevented NULL expiry update; expired artifact purged and two unexpired artifacts preserved.

## Last 10 phases — new customer gateway

| Step | Outcome |
|---|---|
| portal-init | Dedicated gateway and ideas D1 schemas initialized with **synthetic** idea records |
| portal-link | Owner-only link verified actual successful Skills job and encrypted the real request capability |
| portal-wrong-mail | Wrong mailbox got generic 202 but **no email** and no unverified ZIP |
| portal-send | Eight-digit code created only for matching synthetic registered mailbox; **zero external emails sent** |
| portal-confirm | Wrong code denied; matching code produced a 30-minute `Secure; HttpOnly; SameSite=Strict` cookie; replay denied |
| portal-status | Verified customer could read their own request's linked delivery status `ready` |
| portal-download | Verified customer downloaded actual **10,597-byte ZIP** containing the generated shopping app from Cloudflare D1 |
| portal-cross | Same customer's cookie could not download another request's ZIP |
| portal-revoke | Owner revocation immediately denied the previously valid download |
| portal-purge | Expired OTP and sessions removed, while existing delivery ownership mapping remained intact |

The browser portal is staged in `site/delivery/index.html`, wired to verification/start/confirm/status/download/logout endpoints. All private capabilities remain server-side, encrypted; public tracking references alone confer no download rights.

## Corrections and test coverage

- An initial CI gate identified an invalid Base64URL padding policy for the encrypted delivery token. Corrected unpadded AES-GCM IV/ciphertext parsing before release; local integration tests passed.
- Added proof against wrong email, unknown reference, OTP brute force, replay, expired cookie, logout, cross-tenant access, owner-only administrative link, immutable revocation and cleanup.
- The hosted QA uses **actual D1**, not a local SQLite simulator, and validates the same Skills APIs and customer gateway module under a Cloudflare Worker runtime.
- Hosted QA uses an injected **fake mailer** solely for synthetic `example.invalid` addresses. It does not prove the real Resend provider can deliver mail to a human inbox.

## Remaining mandatory gates

1. Verify real Resend message delivery and sender authentication in a staging environment using an address owned and authorized for testing (no arbitrary recipients), with free quota checks.
2. Configure secure Cloudflare Worker service binding and admin Access controls in staging, then browser-test the actual public static delivery UI end to end.
3. Confirm customer data/OTP retention, privacy notice, role permissions, and observed gateway delivery after scheduled cleanup.
4. Keep automated app building limited to reviewed templates. Host a separately controlled and audited Linux runner if broader application categories are required.
5. Explicitly approve any production deployment after evidence. `mzcodehub.com` remains in maintenance with automatic production deployments disabled.

**No commercial/production GO** until those gates are satisfied.
