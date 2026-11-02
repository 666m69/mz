# MZ Executive Dashboard — production deployment, 2026-11-02

Private URLs: https://mzcodehub.com/admin/executive and https://www.mzcodehub.com/admin/executive
Protected JSON endpoint: GET /api/admin/executive?period=7|30|90|all
Cloudflare Worker: mzcode-executive-dashboard; workers.dev disabled.
Existing Cloudflare Access admin app plus JWT signature/audience/issuer/expiry verification in Worker. Anonymous URL returned Access sign-in. Signed-in end-to-end test is pending.

Source-backed KPI definitions:
IDEAS_DB (mzcode_ideas): idea_requests count within period; advanced opportunity = stages quoted, accepted or building; quote-stage = stage quoted, not proven money; unconfirmed notifications = notification_status other than sent.
CONTACT_DB (mz-contact): mz_contact_requests count; suspected tests are records with status=test or explicit QA/test markers in name/email/message; non-test is a heuristic and does not imply verified customers. mz_menus = all-time count of saved menus, not conversion.
HUB_DB (mzcode-hub-independent-20261101): events = sum of recorded events in selected period. Empty events table does not mean zero visitors.
Site visits, sessions, visitor-to-lead conversion rate, revenue and profit are UNAVAILABLE (not zero) without authoritative data sources.

Confirmed D1 snapshot at dashboard build: ideas 0; contacts 4 (all suspected/explicit tests); saved menus 1; recorded events 0.
Data API only returns aggregate non-PII values. Worker contains no paid model calls or added tracking. Existing D1 read-only usage and no new paid subscription.

Added four specific routes (revert by deleting only these IDs, preserve wildcard site Worker and other admin routes):
mzcodehub.com/admin/executive*: 60cecca52d5c44dabf018277554e05d0
www.mzcodehub.com/admin/executive*: 530cd0c8164c40369972e1916bca28ba
mzcodehub.com/api/admin/executive*: c498d70ec52c479fa92c0ded27ef5708
www.mzcodehub.com/api/admin/executive*: 0f53c9b6036941bebf86950248ab54b0

Validation: D1 queries succeeded; HTML rendered with 4 KPI cards, periods 7/30/90/all; frontend JS passed syntax check in Browser Rendering. Anonymous dashboard access was blocked by Cloudflare Access. Signed-in admin QA remains.
Production GitHub main remains source-incomplete relative to Pages ad hoc deployment; do not merge this branch into main or auto-deploy Pages until source parity restored.