# MZcode — Real idea → generated app → encrypted D1 → private ZIP (hosted acceptance)

**Test date:** 2026-11-07, approximately 04:00 UTC.  
**Environment:** Disposable Cloudflare Workers Queue consumer + dedicated D1 + KV; not production.  
**Result:** **PASS, 17/17 steps; zero failed steps.** Final KV receipt: `{"ok":true,"executed":17,"lastPhase":"purge"}`. All individual stage results independently fetched from Cloudflare KV management API.

## What changed compared with the previous hosted acceptance

The previous hosted acceptance used **static synthetic artifact files** in its build-completion stages. This test replaced them with `skills-server/qa/reviewed-edge-builder.mjs`: a source-pinned, deterministic Cloudflare Workers port of `pilot/builder/engine.mjs`, `pilot/builder/runtime.js` and `pilot/builder/styles.css`. The builder receives the **actual AES-GCM-decrypted request input from D1**, validates that it is a source-approved `local-checklist`, and produces real, distinct four-file standalone Arabic RTL apps.

Node parity tests compare the four resulting files byte-for-byte to the original reviewed Node builder (except the expected randomized app UUID in HTML); runtime persistence smoke tests also pass. No visitor-supplied JS is evaluated or included in a template. The edge port remains **staging-only** and is not a Linux seccomp sandbox or an open-ended generative application builder.

## Hosted D1 results

| Phase | Result |
|---|---|
| init | Fresh D1 migrations 0001, 0002, 0003; expired fixture created |
| release | Reviewed `local-checklist@1.0.0` release submitted |
| review | Reviewer-role test job completed |
| activate | Version activated |
| intake-a, intake-b | Two separate synthetic clients; different ideas and Arabic titles |
| build-a, claim-a | A enqueued and leased |
| finish-a | **Actual app generated** from A's decrypted idea, category `tasks`; 4 files saved encrypted in D1 |
| verify-a | Authenticated HTTP ZIP read **10,574 bytes**, actual blueprint/title/RTL/runtime contents verified; other requester, anonymous and runner rejected |
| revoke-a | Client revocation denied; owner revoke succeeded; revocation cannot be reversed |
| build-b, claim-b | B enqueued and leased |
| finish-b | **Different actual app generated** from B's idea, category `shopping`; 4 files saved encrypted |
| verify-b | Authenticated HTTP ZIP read **10,597 bytes**, genuine shopping blueprint/title verified; other requester, anonymous and runner rejected |
| sql-guard | Setting download expiration to `NULL` blocked |
| purge | One expired file deleted, two current encrypted artifacts retained |

Each `verify` step parses the received ZIP `STORE` local entries, confirms all four allowlisted files, parses `blueprint.json`, compares its category/title with those recorded when building, verifies the HTML title and RTL direction, and checks that the generated JavaScript uses browser-local storage.

## Security and limitations

- Temporary Worker had **no public Workers.dev endpoint**. Trigger was authenticated Cloudflare Queue API → Queue consumer. Cloudflare Access rules remained unchanged.
- Temporary credentials were generated for QA only as Cloudflare secret bindings. No real customers, payment information or production database was accessed.
- 14-day download TTL, 30-day purge eligibility and irreversible revoke were exercised in hosted D1.
- Actual Linux seccomp runner and browser runtime are tested **separately in CI**. This hosted test uses the reviewed Workers-safe renderer, not a Linux container and not AI-generated untrusted code.
- Source-pinned templates currently support only **local task/shopping lists** via the checklist skill in this hosted test. Unsupported applications require human review.
- **NO-GO for automatic commercial launch** until verified real customer identity/contact, secure public intake-to-private-delivery authentication and operational notifications are implemented and accepted. The current request capability protects request access but does not prove that an email recipient is the same person.

## CI evidence

Cloudflare Pages Preview for commit `ad04c0e96f1ef8d86b22b3b29f6e211e9426dd4b` succeeded: **44/44 Node**, **17/17 Python** plus **7/7 Linux isolation** and **17/17 control tests**. New independent parity tests detected and fixed a JSON newline discrepancy, and negative tests identified visually obfuscated input using tatweel. The edge renderer now conservatively rejects tatweel, bidirectional control characters and zero-width controls before processing visitor ideas.

## Resource lifecycle

**Verified complete cleanup:** Cloudflare API confirmed successful deletion of the disposable Queue consumer, QA Worker, Queue, D1 and KV. A separate account read then returned **5 D1 databases, 0 Queues and 0 KV namespaces**; disposable D1 absent, original Skills QA Worker still closed. Production Pages SHA `b6bc35d8` has `success`, `production_deployments_enabled=false`, and the visitor maintenance redirect remains enabled. No live customer D1 or production routes were touched.

**PR:** #44, isolated staging branch `feat/d1-delivery-retention-20261107`.
