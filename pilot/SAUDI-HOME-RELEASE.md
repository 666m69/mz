# MZcode Saudi homepage — implementation and release gate (2026-11-04)

## Current verified state

The work is isolated in GitHub branch `feat/saudi-home-intake-20261104`, draft PR #22. It does **not** change `main` or the production `mzcodehub.com` routing and D1 data.

- Existing MZ logo asset and original blue/dark/white design remain unchanged; `saudi-entry.css` adds green accents.
- Homepage headline: «ارررحب 🫡»، «قول وش الوضع؟»، «MZcode — أكبر نتيجة بأقل جهد 👍»، «وش اللي مجهدك؟ 😌».
- Homepage form accepts any idea/need (20–1600 characters), optional response email, **mandatory consent**, honeypot, idempotency key, and returns **only server-confirmed** `MZ-XXXXXXXXXXXX` reference.
- Submitted requests remain **private**, never shared as public ideas. No email is sent unless an address was supplied; the UI truthfully reports customer-email status.
- Read-only ticket status lookup stays on the same origin; a link to browse `#tools` appears after receipt.
- Existing games, product cards, services, contact form and original live-console remain; GitHub tests and mobile audit pass.

## QA database and preview

- Cloudflare Pages project `mz702` builds the branch to **preview**, for example `https://feat-saudi-home-intake-20261.mz702.pages.dev/`.
- A private preview-only `idea_requests` table and two indexes were added to `mz702-qa-preview` D1 `4eb640fd-5199-4a18-88b2-1f4c55da81e1`. No production D1 writes or destructive schema operations.
- The Pages preview route `POST /api/ideas` calls the same audited idea handler with the QA D1 and QA hash secret. It is *host-scoped* to this exact preview alias. No production host is served by that QA handler.
- GitHub's `npm test`, built-worker request tests, and 390px mobile viewport audit passed.
- **Important external test blocker**: GitHub's HTTP QA attempt could not open the preview. Cloudflare Access redirected the request to `nameless-bonus-3327.cloudflareaccess.com` sign-in (HTTP 200 at the login page). Therefore an external browser-to-Cloudflare-D1 send and subsequent lookup was **NOT verified**. The QA D1 table had **0 rows** after the attempt. Do not mark end-to-end acceptance passed.
- **Never bypass/disable Cloudflare Access** without separate authorization, and do not make an anonymous-access assertion for protected preview URLs.

## Safe release steps (not completed)

1. An authorized reviewer opens the preview in a session permitted by existing Cloudflare Access. Verify hero on mobile, game/tools links, keyboard focus, and that logo/branding are unchanged.
2. Run an authorized end-to-end **synthetic** submission to QA D1 (no names, email or customer data) and verify `201` receipt, `200` identical retry, and status GET. Log test reference and clean it only if approved as QA data.
3. Check real production public-entry Worker and `mzcode-ideas-preview` Workers routes; **Pages production source and root Worker are not guaranteed parity with GitHub main**. Plan coordinated release of updated ideas intake backend (optional email) *before* enabling direct homepage submission, with a tested rollback.
4. Validate notifications with and without customer email; verify idempotency/rate limit, no data leakage, and privacy language with all existing routes.
5. Obtain explicit approval before production merge and route changes. Keep existing DB/client data intact.

## Future opt-in work profile

The audio discussion included an idea to tailor services based on a visitor's previous ChatGPT use. A regular website **cannot read ChatGPT account Memory or private chat history directly** merely because the visitor ticks a consent checkbox. There is no authorized integration implemented here. Future opt-in workflow: the visitor supplies only selected technical tasks/interests (or a self-reviewed import), reviews a short extracted profile, and chooses retention/deletion; exclude medical, personal, family and other sensitive content. Never promise access to private ChatGPT memory or usage on subscriptions without an official authorized provider mechanism.

Business model caution: ChatGPT/Claude/Gemini consumer subscriptions do not automatically grant transferable multi-user API access. Separate supplier API terms, consumption accounting, and actual costs must be verified before making price promises.
