# Capability matrix — 2026-11-03

| Capability | Evidence | State |
| --- | --- | --- |
| Visitor idea intake | pilot/mz-ideas-worker.js POST /api/ideas, D1 INSERT, rate limit and idempotency | Implemented in repository; live test not rerun in this task |
| Customer receipt | Resend call only when RESEND_API_KEY exists; accepted is not delivered | Conditional; delivery unverified |
| Idea tracking | GET /api/ideas/{uuid or short reference} returns status only | Implemented |
| Requirement brief | pilot/lab/engine.js deterministic rules | Implemented, not AI application generation |
| Interactive prototype | pilot/lab/prototype.js offline HTML scenario simulator | Implemented simulation, not business app |
| Capability gate | pilot/capability-gate.mjs | New isolated branch implementation; not integrated or deployed |
| Real application build from arbitrary visitor text | No isolated build executor evidenced | NOT IMPLEMENTED |
| Automated integration tests and release per customer | No per-customer pipeline evidenced | NOT IMPLEMENTED |
| Customer-specific deployment and delivery | No per-customer isolated environment evidenced | NOT IMPLEMENTED |
| Real price quote | Current deterministic estimate only | Not verified, non-binding |
| IP rights | Consent to reuse must be separate and explicit | Not evidenced as enforced workflow |

## Release gates
Do not merge capability gate without running npm test and reviewing false negatives/positives. This gate is advisory only: regex detection is not an adequate security boundary. No visitor idea may run as source code or shell command. Implement isolated per-customer build jobs, quotas, approval and audit before claiming actual automated delivery. No production mutation made in this branch.
