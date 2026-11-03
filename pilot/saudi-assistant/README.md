# MZcode Saudi Assistant — v1 (private preview)

**Scope:** one front-end assistant, Arabic RTL, Saudi green (`#006c35`), tested mobile/desktop layout. It is a **guided intent router with explicit small working tools**, **not** an LLM or a general AI agent. It does not invoke hosted APIs, bill users, log visitors, upload documents, access WhatsApp or verify real-estate licenses.

## What works today

- User enters an informal Arabic request. A deterministic, locally executed router identifies limited intents and explains what is / is not supported.
- School communication: collects grade, topic, recipient type; produces a draft to copy/download as plain text. It does not send WhatsApp messages.
- Real estate: collects property details; produces **draft only**, never marks license verified or content ready for publishing.
- Tasks/shopping: actual interactive browser checklist, persisted in localStorage with explicit delete option; maximum 150 items per browser.
- Unsupported file-conversion, health, arbitrary app generation and harmful requests receive explicit capability boundaries.

## How to review

```bash
cd pilot/saudi-assistant
python3 -m http.server 8000 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8000`. No npm dependencies or accounts are required. Use HTTPS before any hosted deployment. LocalStorage is the only persisted state; chat messages and drafts are not saved between reloads. The one-file offline preview is a reviewer convenience only, not production code.

## Tests performed

- `node --test pilot/tests/saudi-assistant.test.mjs` — 11/11 passed on Node v22.16.
- Chromium rendering and interactions on 390px phone and 1366px desktop: school message generated, checklist add/reopen/complete/delete, real-estate draft, zero page errors. The restricted test environment blocked browsing to localhost and file URLs, so the browser harness used `page.set_content`, injected the same locally checked JS after transforming ES module imports to globals, and a localStorage stub. This is a partial browser test, **not** full HTTP/CSP deployment verification.
- All five Git blob hashes were cross-checked against tested local sources.

## Next release gates

This preview **is not integrated** with Skills Server worker or live website and must not be called a deployed assistant. Existing Skills Server remains owner/runner controlled; never expose owner or runner tokens to visitors. Before a real public assistant: decide a safe public API and limits; consent-based user identity/memory; isolated per-user workspaces and deletion; abuse and privacy controls; real reviewed skills execution; model provider configuration/budget; full CSP/network end-to-end tests; regulatory/legal source refresh; human review for sensitive outputs.

No production changes, no D1 migrations, no external expenditure.
