# MZcode — email OTP acceptance, Nov 7, 2026 (staging)

**Status: NOT PASSED for live mail OTP. Code tests passed; no production integration was enabled.**

## Verified facts

- Cloudflare Email Routing has exactly one account-verified destination, the MZcode owner Gmail address `666m69@gmail.com` (verified 2026-10-31). Existing `mzcode-ideas-preview` Worker already has a `send_email` binding restricted to that address, and source sends from `info@mzcodehub.com`.
- The connected owner mailbox contains several genuine `[MZ Code Hub] New project idea` notifications dated Nov 2–6. These **prove historical idea notifications were received**, not that a new OTP was sent or received today.
- Cloudflare Email Service on Workers Free may send to **pre-verified destination addresses**, not arbitrary customers. Customer-wide sending requires a separately authorized transactional mail integration (e.g., a configured and verified Resend account, with its credential stored as a server-side Cloudflare secret). **No paid upgrade is authorized.**
- A new `QA_EMAIL` fallback was added to `pilot/customer-gateway/worker.mjs`, with an exact `QA_VERIFIED_TO` recipient comparison. It returns `false` without sending to any other address; only an accepted Cloudflare message receipt counts as a send.
- Dedicated simulated tests validate recipient restrictions, generic enumeration-resistant responses, sender identity and deletion of unsent OTP challenges, plus the existing 5-attempt/10-minute TTL/session isolation tests.
- Live one-off test infrastructure: a disposable Queue and KV were created and successfully deleted. The tool's safety gate blocked uploading the proposed private email-sending QA Worker. **No live OTP was sent**; no attempt was made to bypass the block.
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
