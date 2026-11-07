# MZcode — email OTP acceptance, Nov 7, 2026 (staging)

**Status: PASS for one real restricted-recipient owner email sent via isolated Cloudflare Worker (19:42 UTC / 22:42 Saudi). Live OTP verification and public customer delivery are NOT YET PASSED. Production was untouched.**

## Verified facts

- Cloudflare Email Routing has exactly one account-verified destination, the MZcode owner Gmail address `666m69@gmail.com` (verified 2026-10-31). Existing `mzcode-ideas-preview` Worker already has a `send_email` binding restricted to that address, and source sends from `info@mzcodehub.com`.
- The connected owner mailbox contains several genuine `[MZ Code Hub] New project idea` notifications dated Nov 2–6. These **prove historical idea notifications were received**, not that a new OTP was sent or received today.
- Cloudflare Email Service on Workers Free may send to **pre-verified destination addresses**, not arbitrary customers. Customer-wide sending requires a separately authorized transactional mail integration (e.g., a configured and verified Resend account, with its credential stored as a server-side Cloudflare secret). **No paid upgrade is authorized.**
- A new `QA_EMAIL` fallback was added to `pilot/customer-gateway/worker.mjs`, with an exact `QA_VERIFIED_TO` recipient comparison. It returns `false` without sending to any other address; only an accepted Cloudflare message receipt counts as a send.
- Dedicated simulated tests validate recipient restrictions, generic enumeration-resistant responses, sender identity and deletion of unsent OTP challenges, plus the existing 5-attempt/10-minute TTL/session isolation tests.
- Earlier one-off QA attempt: a temporary Queue and KV were removed after upload of an earlier private mail QA Worker was blocked; no live OTP was sent in that attempt. See the successful independent email delivery test below.
- Cloudflare Pages Preview SHA `049df3d2544406db8cf8bd47fdb333f7ad1e065e` succeeded with **48/48 Node tests, 17 Python tests and 7 Linux isolation tests** (other test groups passed, zero failures). An intermittent proof-tampering test was fixed by ensuring the altered signature character actually differs.
- No customer record, production D1, Cloudflare Access policy, production domain, or existing email route was modified. No additional paid plan was activated.

## Requirements for a real mail-to-download acceptance

1. A staging-bound email sender verified for `info@mzcodehub.com` with a legitimate outbound credential and permission to send test messages. On the free Cloudflare path, limit recipient exactly to an account-verified address. If testing an arbitrary recipient, use an existing free transactional provider plan and verified sender; never put the key in this repository or the user chat.
2. Prepare isolated staging D1 for the customer gateway and the Skills Server, with a trusted read-only view of the authoritative idea record and an internal Skills service binding.
3. Trigger a single authorized customer test: match reference and recorded mailbox, send OTP, independently confirm inbox receipt, redeem exactly once, issue 30-minute HttpOnly session, build a reviewed real app, verify ZIP download, reject cross-customer attempts and revoke.
4. Verify owner signoff before public routing; default admin endpoints stay disabled, maintenance stays on. No release while the actual outbound email acceptance is unproven.

## Safe staging setup

- Never deploy `QA_EMAIL` on the public site or use it as arbitrary-recipient transport. A Cloudflare binding must have `destination_address` limited to `666m69@gmail.com`, and `QA_VERIFIED_TO` set to exactly the same value.
- The gateway uses `TEST_MAILER` only in automated tests, `QA_EMAIL` only when bound in staging, and `RESEND_API_KEY` only when explicitly provisioned as a secret. If no sender is available, verification returns a 503 and no code is accepted.
- The gateway never returns the OTP, session token or Skills capability to the browser except the HttpOnly session cookie after successful verification.

## New independent live email delivery proof — 2026-11-07 19:42 UTC

- **PASS** for a **single non-OTP** real email via a newly created disposable private Worker `mzcode-mail-qa-once-20261107` with Cloudflare `send_email` binding restricted to the account-verified destination `666m69@gmail.com`. Source sender was `info@mzcodehub.com`.
- Worker had **workers.dev subdomain disabled** and `fetch` always returned 404. The only invocation was a one-off authenticated temporary Queue `mzcode-mail-qa-once-q-20261107` with consumer batch size 1 and retries 0. Queue message accepted by Cloudflare; backlog returned to zero.
- The connected owner Gmail independently showed **exact subject** `[MZcode QA] isolated verified-recipient email check 2026-11-07`, message timestamp `2026-11-07T19:42:24Z`, and the expected unique body. Gmail message ID `1a1b788a527f56dc` (not an OTP).
- Cleaned up **consumer, Queue and Worker** via Cloudflare API and checked they are absent. Verified Cloudflare then had **0 Queues, 0 KV**, and the preexisting **5 D1 databases** were unchanged. Pages production SHA still `b6bc35d8087f`; production automatic deployment disabled.
- **No external Resend API key was available or used. No customer OTP was transmitted or verified end to end.** The free Cloudflare sending route is limited to account-verified recipients; it is not a general client email solution.
- Next required commercial gate: a properly provisioned transactional sender in an isolated staging Worker plus real idea→OTP→verified session→private ZIP download test; no production rollout without that proof.

## Hosted real OTP trial with existing verified recipient — 2026-11-07 20:16 UTC

- **Partial PASS, not final customer acceptance.** Staged `pilot/customer-gateway/qa-live-mail-entry.mjs` on a new **private** Cloudflare Worker, with three separate fresh D1 databases (Skills, ideas, customer gateway), disposable Queue and KV. No public `workers.dev` subdomain; no customer production data.
- 21/21 consecutive hosted phases **passed**, including 17 Skills acceptance phases (two actual reviewed Arabic task/shopping apps, encrypted ZIP and authorization/retention checks) plus gateway initialization, approved owner-only mapping, wrong-mailbox denial, and generating a one-time OTP through Cloudflare's restricted `send_email` binding.
- **Independently confirmed a real OTP email was delivered** to the account-verified `666m69@gmail.com`: Gmail message ID `1a1b7a839d54829d`, timestamp `2026-11-07T20:16:50Z`, subject `رمز استلام طلبك | MZ-99464EEE8000`, From header `info@mzcodehub.com`. No OTP code is included in the report, repository, logs or receipts.
- The OTP confirmation step was **NOT executed**: transferring the received OTP from the mail connector to a private Cloudflare Queue was blocked by a platform safety control. No attempt was made to bypass the block. No verified HttpOnly session, real-email-authenticated ZIP download, cross-client session test or revocation after the live OTP should be claimed from this run; earlier 27/27 tests covered these using *mocked* email only.
- Destroyed the QA Queue consumer, Worker, Queue, three test D1 databases and KV. Verified **0 Queues, 0 KV, original 5 D1 databases**, no test Worker. Production Pages SHA remained `b6bc35d8087f` with automatic production deployment off.
- No Resend credential was available or used, no paid services were subscribed to, and production/Access was not touched.

**Commercial conclusion:** still **NO-GO**. To finish the live flow, provide a temporary, protected customer-facing UI where an authorized tester types their OTP directly over HTTPS, rather than moving mailbox secrets across connected tools. Verify one-use redemption, HttpOnly session, actual ZIP download, cross-client denial and cleanup, then seek explicit production release approval.
