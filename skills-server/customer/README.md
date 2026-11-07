# Customer-verified delivery — isolated staging gate

**Status: source + tests only. Not publicly enabled.**

The production site's `mz_contact_requests` and the Skills Server's `ss_requests` are currently in **different D1 environments**. They must **not** be joined by an untrusted browser-supplied reference. A trusted backend must create an immutable mapping after authenticating the original request and obtaining consent. The site currently does **not** prove that a submitted email address belongs to the visitor.

## Implemented in this branch

- `customer/verified-delivery.mjs`: HMAC-SHA256 proof, 10-minute TTL, exact request UUID and normalized mailbox binding; fail-closed authorization against an immutable reference mapping and the corresponding active, nonrevoked artifact.
- `migrations/0004_customer_delivery.sql`: staging-only mapping and anti-reassignment trigger. Do not apply to production without migration review.
- `test/customer-verified-delivery.test.mjs`: wrong email, request, run, reference, expired proof, unverified/revoked mapping and expired/revoked artifact rejection.
- No public token-minting route, no secret in browser, no email sent, no Cloudflare Access change, no new paid services.

## Remaining work before final commercial acceptance

1. Establish actual mailbox ownership via a mail provider that supports verified sender and outbound transactional mail. Deliver a one-time challenge **to that mailbox**; persist hashed challenge, enforce atomic one-use redemption and rate limits. `issueProof` must only be invoked by this trusted verification service after successful redemption.
2. Securely map a live `mz_contact_requests.reference` to an actual Skills Server `ss_requests.id` with explicit consent, no user-controlled arbitrary UUID. Confirm which D1 holds the authoritative customer email and use a server-side integration.
3. Provide a protected customer status/download route that calls `authorizeCustomerDownload` and the existing Skills Server artifact endpoint with a server-side credential, never exposing owner/runner tokens.
4. Test a full end-to-end real mailbox challenge → one customer intake → actual generated app → private ZIP download → cross-user denial → revoke and purge in hosted staging. Inspect email deliverability, D1 isolation and privacy/retention.
5. Only then request commercial production rollout approval; keep maintenance/Access intact until authorized.

**Security caveat:** HMAC proof validation alone is not mailbox verification. Do not allow an unauthenticated caller to invoke `issueProof` or set `verified_at`. Tests here do not claim real email delivery.
