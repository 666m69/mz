# MZcode Saudi Assistant — live model preview, 2026-11-04

## Confirmed status
- **Live Workers AI inference has been verified through the connected Cloudflare account** using `@cf/meta/llama-3.1-8b-instruct-fp8` (example 50 tokens used 0.80 Neurons). This proves the model/API credentials work, **not** that the user-facing preview request has been exercised end-to-end.
- Verified Cloudflare Pages deployment on the developer branch: `https://feat-saudi-assistant-workers.mz702.pages.dev/assistant/`, successful deployment from `feat/saudi-assistant-workers-ai-20261103`.
- The model is enabled **only for the exact preview alias above** through the code gate. `mzcodehub.com` remains fail-closed unless an explicit production environment toggle is set. No production toggle was set, no production DB migration or merge occurred.
- Existing preview D1 database `mz702-qa-preview` contains new `mz_assistant_limits` table and index; no customer rows were modified. This was verified through D1 SQL.
- The preview quota is **2 requests per IP per UTC day and 4 requests globally per UTC day**. Shared, pre-existing Cloudflare AI usage consumes the same account-wide free allocation and is not monitored automatically by this counter.
- The screenshot from the account dashboard at the beginning of this test showed **0/10,000 daily Neurons**. Subsequent test calls consumed a small part of that free allocation. The connected OAuth account **cannot read billing/subscription settings**; do not assert the account plan or guaranteed zero billing.
- Prompt history is held only in browser memory, up to four messages, with explicit consent before forwarding to Cloudflare. D1 stores only pseudonymized HMAC rate buckets, not the conversations. Sensitive text detection is best-effort and must not be treated as comprehensive.

## Technical architecture
- Built worker bundles `site/assistant-api.js` and serves static files at `/assistant/`. POST `/api/assistant` calls the server-side `env.AI.run` binding. No model secrets are embedded in frontend.
- Backend enforces same-origin, schema/size checks, consent, simple sensitive-input checks, rate limits, response caps. Unsupported / unimplemented skills cannot be executed by the LLM.
- Local school note, property draft and browser checklist remain usable if the model is disabled or unavailable.
- The direct inference sample exposed a Saudi-dialect quality issue; stronger prompting has been added, but quality is still under review.

## Verified tests
- GitHub Actions verification for the branch passed, including built Worker syntax, bundled assets, mock AI backend, privacy gates and preview-only enablement.
- Real AI HTTP API test via Cloudflare connected account succeeded. **The full browser-to-preview API and mobile testing have not been performed with a real Cloudflare browser session.**
- The preview deployment status is `success`; user-facing assistant quality is not yet approved.

## Release restrictions
1. Keep production `main` and `mzcodehub.com` untouched.
2. Never claim the free allocation is a hard financial cap on paid accounts. It is not. A Cloudflare billing read permission or owner visual confirmation of plan is needed for certainty.
3. Do not merge/deploy the preview gating logic to production without separate owner approval and appropriate quotas and data privacy review.
4. Do not send real pupil, patient, customer, identity or other sensitive information to the model during testing.

Reference: https://developers.cloudflare.com/workers-ai/platform/pricing/
