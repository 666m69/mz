# MZcode — Travel Agency Seasons (B2B) | Private MVP

Standalone prototype developed for discovery of a **B2B hospitality sales workflow**, NOT a worldwide booking calendar or an individual traveler offer portal.

## Updated client role (confirmed 2026-11-04)
- Client contact works **within the hotel's marketing department**; functional role: **marketing coordinator** (exact HR job title not yet established).
- The system is an internal **hotel B2B marketing operations assistant**. It is NOT a marketplace, independent agency, personal brokerage or commission platform.
- Primary workflow: source-market calendar → upcoming opportunity → choose tour operator/travel agency → draft proposed cooperation → internal hotel review/approval → staff-led outreach **only if appropriately authorized** → log response and next follow-up → verify results against the hotel's actual reservation records when a future authorized integration exists.
- Treat approvals, prices, allocations, attributed bookings and commission calculations as **out of scope for v0.1**, not as implicit privileges of employment.
- A staff position does not itself establish permission to send using official accounts or grant access to hotel PMS/CRM. Obtain hotel policy and appropriate permission before implementing a sending connector or operational integration.
- Existing demo stores fictitious company records **on the local device only**. A future multiuser version requires controlled staff sign-in, separate hotel workspaces, audit logs and backup, with hotel-owned data protected.

## Grounding from customer call
The target is **tour operators and travel agencies**. The recorded discussion mentions international holiday/season timing, approaching partners in advance, grouping target source markets, proposing hotel offers and tracking outreach/results. The contact is now confirmed as a hotel marketing-department employee; the exact title remains unclear. No approved remuneration, outbound account authorization, commission entitlement, hotel rates, target country list, confirmed sales or permission for bulk messaging was established.

This implementation intentionally uses a **generic demo**, not the customer's real name, property name, recording, or contact details, since this repository is public.

## What actually works
- Fetch public holidays for 14 selectable source markets and current/next year from Nager.Date V4 REST API, on explicit user action only. Source: https://nagerholidays.com/api .
- Validate country/date and show provenance and timestamp. Explicitly **NOT** school holidays, demand forecasting, confirmation of room availability, or all exhibitions. If API is unavailable, no fake holidays appear.
- Add manual events with optional HTTPS source link, visibly labeled unverified.
- List opportunities in the next 120 days, sorted by date; use market segmentation (GCC, Türkiye/Central Asia, Europe/Americas, Indonesia). These are editable research presets, not customer-specific facts.
- Create/edit stage/delete local agency records (with next follow-up date). No email address or personal-contact fields.
- Draft Arabic/English **unsent** B2B outreach messages; avoid claims of confirmed discounts or room allocations.
- CSV export with spreadsheet-formula injection guard. Explicit local-only reset.

## How to preview
No paid services or dependencies. Requires a local static server because ESM is not supported reliably via file URLs:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory pilot/tourism-b2b
```

Open http://127.0.0.1:8000. Do not enter real client contacts or hotel secrets.

## Run tests

```bash
node --test pilot/tests/tourism-b2b.test.mjs
```

The repository's `npm test` also includes `pilot/tests/*.test.mjs` if its existing script remains unchanged.

## Known limitations before giving this to a customer

1. **Single-browser demo, no account and no backend database.** localStorage is not a secure multi-user CRM and will be lost when browser data is cleared. No team permissions or backup.
2. Public holiday coverage varies by country. Lunar/Islamic dates and exhibitions require official confirmation and appropriate sources. API availability/CORS must be tested from a real browser; no guaranteed uptime or tariff declared.
3. No sending emails, WhatsApp automation, scraping contacts, invitations, calendar notifications, tracking leads through to confirmed hotel reservations, or commission reporting. Never promise these as present capabilities.
4. Do not present a user-entered outreach stage or alleged booking as proof of attribution, invoice, or payable commission.
5. For later production version: obtain a signed hotel authorization, define permissible lead sources and GDPR/PDPL marketing consent, apply tenant isolation, backups, secrets, source freshness and structured audit trail.
6. Before showing a real customer sample, replace/curate the country groups using their actual source market list and define campaign lead time (e.g., 60/90/120 days) as an adjustable planning parameter.

## Delivery boundary
Branch-only generic MVP. No Pages production deployment, no payment, no third-party accounts, no customer data, and no client-facing promises. Obtain the client's written review of requirements and scope before a commercial quote or public portfolio case study.
