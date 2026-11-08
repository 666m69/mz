# MZcode hosted acceptance and zero-extra-plan guard — 2026-11-08

## Scope
Branch `feat/visual-concept-private-archive-20261108`; no merge, public route or production deployment. Production Pages `mz702` SHA before and after: `b6bc35d8087f5cf0d7c8d916e0c0a6146f3adf61`.

## GitHub Actions startup_failure remediation
- Previous `actions/checkout@v4`-based workflow runs produced `startup_failure` with **zero jobs**.
- A no-Marketplace shell clone and pinned `GITHUB_SHA` successfully launched, and ran full Skills Server tests.
- Patched `.github/workflows/verify.yml` and `.github/workflows/mzcode-verify.yml` **on feature branch**, without altering production.
- PR-head `Verify MZcode` run [42452568403](https://github.com/666m69/mz/actions/runs/42452568403): SUCCESS.
- PR-head `Verify MZcode changes` run [42452568383](https://github.com/666m69/mz/actions/runs/42452568383): SUCCESS.
- Independent Chromium (360px mobile), D1 intake and repository suite run [42451467072](https://github.com/666m69/mz/actions/runs/42451467072): SUCCESS, reported 203/203 tests passed within full suite.
- The underlying Marketplace action policy setting was not readable through the connector. The replacement avoids the failing dependency; it does not claim to modify GitHub's global action policy.

## Hosted Cloudflare staging (actual Workers runtime and D1)
Initial account inventory: 5 D1 databases, 10 Workers, 0 Queues and 0 KV. Production Pages SHA unchanged. Created **one disposable D1**, **one disposable Queue**, **one private Worker** with `workers.dev` and preview URLs both disabled, Queue max concurrency 1, batch size 1, retries 0.

Source: `pilot/hosted/visual-archive-acceptance.mjs` importing the actual modified idea intake, admin, and customer gateway modules. Worker fetch always 404. No real mailbox, OTP email, customer data, external payment, external model, third-party API, or actual app build. Queue messages were authorized by a temporary nonce and short expiry.

### Phase archive — PASS
1. Optional product reuse permission defaults false and persists in private D1.
2. Idempotent replay returns prior tracking code; permission-flip replay rejected (409).
3. Separate explicit opt-in persists true.
4. No-consent request rejected (400), status lookup returns no PII.
5. Unauthenticated archive API rejected (403).
Test-inserted ideas deleted afterward; preexisting QA ideas remained at **2 records** with **1 opt-in**.

### Phase delivery — PASS
1. Owner-only linked job API with synthetic Skills-service fixture.
2. Wrong mailbox gets generic 202 but no OTP, wrong OTP denied, verified HttpOnly SameSite session issued, replay denied.
3. Authenticated client **cannot download ZIP prior to agreement**, HTTP 409. No artifact fetch upstream.
4. Owner records a synthetic 64-char SHA-256 agreement evidence; private stub ZIP becomes available; conflicting approval denied.
5. Cross-reference access denied, revocation denies ZIP again.

**Limitation:** The post-agreement ZIP was a controlled synthetic Skills response rather than a live real-build artifact; earlier isolated hosted Skills tests had validated actual reviewed app ZIP generation separately. The new hosted run did not test real email provider delivery or a public-browser-to-hosted-API route.

## Cost and limits
Cloudflare Free-plan docs current at this acceptance:
- Workers: 100,000 requests/day, 100 Worker scripts; Queue runtime in this test only 2 tiny phase deliveries.
- D1 Free: max 10 databases, 5 million rows read/day, 100,000 rows written/day, 5 GB combined storage.
- Queues Free: 10,000 operations/day (reads, writes, deletes), 24-hour retention.
- Pages Free: 500 builds/month; no new Pages preview was deployed here.

Temporary resources were bounded by **6/10** D1 databases, **11/100** Worker scripts, **1** Queue, zero new KV, and no public URLs; Queue reported **0 backlog**. Temporary D1 reached **73,728 bytes**, under the 5 GB limit. **Cleanup completed and independently verified:** removed temporary Queue consumer, Queue, private Worker and temporary D1 in sequence. Account inventory returned to **5 D1, 10 Workers, 0 Queues, 0 KV**; none of the temporary objects remain. Pages production SHA unchanged. Three expendable GitHub Actions diagnostic workflows were also removed from the QA branch in one commit to minimize future runs.

**Billing audit limitation:** Cloudflare account subscription, billable-usage and billing-usage API calls all returned **403**, so no actual statement/invoice confirmation is possible with this token. This action did **not** enable or subscribe to a paid feature; expected incremental platform charges are **zero on the Free plan within remaining quota**, but the actual account plan and charges cannot be independently proven with current billing permissions. No promise of zero account-wide spend is made. GitHub repository is public and the successful workflows use the standard `ubuntu-latest` GitHub-hosted runner, which GitHub officially lists as free for public repositories; no larger runner or artifact upload was requested.

## Release gate
Remain in review/draft. Before production rollout: inspect account billing settings directly, check live D1 schema and back up before additive migrations, configure restricted owner-only Access/permissions, real secured staged browser/API acceptance, clear privacy retention/consent withdrawal process. Any commercial public release needs a separate deliberate rollout after complete evidence.
