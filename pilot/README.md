# MZ Code Hub — October/November 2026 isolated improvements

## Production state — 2026-11-02

**Important:** Cloudflare Pages project `mz702` still serves the original MZcode Hub website. Its current ad-hoc production upload is **not represented** by old GitHub `main`. This branch must **not** be merged and redeployed as the site without recovering the full deployed source.

### Live — idea intake
- Public: https://mzcodehub.com/idea (also www).
- API: POST https://mzcodehub.com/api/ideas
- Worker: `mzcode-ideas-preview` (name retained from isolated QA).
- D1: `mzcode_ideas` (database ID stored in `OPERATIONS.md`).
- Feature: open-ended Arabic idea description, name/email, explicit consent, UUID reference, DB storage, hourly IP hash limit.
- Security: 10 KB streaming body limit, JSON-only, origin check, input validation, salted IP hash, no secrets committed.
- Source: `mz-ideas-worker.js`; schema: `schema.sql`.

### Restricted admin inbox
- Protected: https://mzcodehub.com/admin/ideas
- API: GET `/api/admin/ideas` (latest 50 requests).
- Worker: `mzcode-ideas-admin` (workers.dev not enabled).
- Cloudflare Access protects /admin* and /api/admin* for account members. Worker **also cryptographically verifies** the Access JWT signature, expiry, issuer and admin application audience.
- Current UI is **read-only**: email clients manually through the displayed links. No automatic notifications, payments, or CRM status updates implemented.
- Authenticated login was **not** E2E tested because no signed-in admin session was available; anonymous browser access was verified to land on Access login.

### Quote generator
- The **existing** Pages tool at https://mzcodehub.com/tools/quote/ was discovered during audit and intentionally **preserved**.
- An alternative printable Arabic builder is versioned in `mz-quote-worker.js` and deployed at an isolated Worker preview, **not** routed over the original site tool.
- Do not attach `mzcode-quote` to the existing `/tools/quote*` route without regression comparison.

## Tests already performed
- Form rendered through Cloudflare Browser Rendering on the live domain without Cloudflare login.
- Real POST returned 201, a UUID and corresponding D1 record; QA data was deleted afterward.
- Invalid email/short idea: 400; unsupported media type: 415; rate limit after 3 requests: 429.
- Required consent checked in browser; real form submission succeeded.
- Homepage / and /privacy returned 200 after Worker route changes.
- Anonymous /admin and /admin/ideas returned Cloudflare Access login.
- Quote alternative tested 2 x 100 SAR → subtotal 200, VAT 30, total 230.
- Original quote page restored and publicly viewable.

## Open issues before full commercial launch
1. Recover **complete** Pages production source, Functions and assets; make GitHub single source of truth.
2. Add a prominent CTA for /idea to the current homepage and existing navigation once its source is recovered.
3. Implement admin status updates, auditable history and lead email notifications without new paid services.
4. Review idea intake privacy policy, data retention and rights language, then enable appropriate bot protection/monitoring.
5. Add auto-generated project scope/pricing and prototype only after a working lead funnel.
6. Conduct logged-in admin integration tests, mobile accessibility, load checks and full security audit.
7. Keep all tools on the Free tier unless the owner approves a change.

See `OPERATIONS.md` for exact routes and rollback procedures.


## New production changes verified on 2026-11-02
- Current homepage Worker source saved at `pilot/production-snapshots/mzcodehub-public-entry-20261102.mjs` before modification.
- Patched source in `pilot/mzcodehub-public-entry-with-idea-cta.mjs`. **Live homepage CTA now points to `/idea`**, verified in an anonymous browser with inherited signing and OG-image bindings intact.
- `POST /api/ideas` attempts an email notification via the Cloudflare `send_email` binding to the verified account destination. A live QA request was recorded as `notification_status='sent'` after the send call; this is an API send result, **not independent proof of inbox delivery**. Earlier attempts failed before the address-binding fix, and test rows were subsequently deleted.
- New authenticated `PATCH /api/admin/ideas/:id` changes status with an audit log. Deployed behind Cloudflare Access, but **signed-in browser acceptance testing is still outstanding**.
- Validated 17 public URLs (home, privacy, terms, all six listed tools, both games, idea intake, contact token, robots, sitemap, OG image) returned HTTP 200. Valid contact-form submission returned reference `MZ-CABAEDFC972243F7`.
- The existing quote tool remains intact and is the live default; our alternative prototype remains isolated.
- Main branch still does **not** reproduce the Pages deployment. Do not auto-deploy the old GitHub project.
- No paid plan or paid AI model activated.
