# MissionAccounts 5400A — Founder acceptance audit

**P0 PRIVACY: CONTAINED. FOUNDER ACCEPTANCE: FAIL. ZOOM DUPLICATION: DEFECT.**

Audit closed for the evidence and authorized operations available in this continuation at 2026-09-07T00:57:43.313120+00:00. The full acceptance execution remains incomplete: real student-browser journeys and persisted core workflows are NOT VERIFIED. This is a documented failed acceptance review, not an independent release seal.

The Matrix MissionAccounts route now returns only a generic HTTP 503. Authorized direct Railway API access remains isolated. The gateway cache defect is not certified repaired, and the Matrix route must stay off until the complete reopening matrix passes.

## Executive verdict

| Field | Result |
| --- | --- |
| P0 privacy | CONTAINED — Matrix route off; no private payload in final probes |
| Founder acceptance | FAIL |
| Estimated product completion | 40% — evidence-based readiness estimate, not completed acceptance |
| Matrix integration | 10% — some route/SSO plumbing exists; discoverability and usable safe entry fail |
| Mentor / Dr J experience | 25% — provisional, observed through Founder admin role presenting Dr J |
| Student real-world experience | 0% acceptance credit — genuine student browser journey NOT VERIFIED |
| Functional control coverage | 35% (35/99) action/result cases; 0/6 persisted core workflows |
| Broken controls | 4 distinct navigation families |
| Incorrectly disabled controls | 9 observed core families / 41 occurrences; identity workflow also disabled |
| Zoom duplication | DEFECT — 2 duplicate canonical classes; 76 extra review identities/days |
| StoryForge canon fidelity | 60% estimated combined appearance/behavior; not pixel or role acceptance |
| Repair run required | YES |
| Recommended next ticket | MX-MISSIONACCOUNTS-5401R — bounded functionality, cache and Zoom repair |


Percentages describe different denominators. Product readiness rounds a weighted rubric: data/API 20/25, provider readiness 8/15, Matrix 2/20, Mentor 6.25/25, Student 0/15 = 36.25%, rounded to the nearest ten (40%). The Mentor/Student experience blend weights Mentor twice: (2×25+0)/3≈17% demonstrated experience readiness. Unknown student behavior receives no acceptance credit; it is not a claim that the underlying UI quality has been measured at zero. See the UX report for category scores and limitations.

## What changed in production

Only `missionaccounts/infra/wordpress/missionmed-missionaccounts-route.php` changed. Its dedicated `/missionaccounts` guard denies all route requests before the feature flag, so turning the flag off cannot fall through to another WordPress handler. It returns `missionaccounts_temporarily_unavailable` with `Cache-Control: no-store, private`. The direct Railway app, its flags, data, Stripe behavior and Zoom evidence were unchanged.

Source branch: `codex/mx-missionaccounts-5400a-containment`, isolated from clean committed `305df76`. Deployed containment commit: **ece63b6**. Exact deployed file: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-missionaccounts-route.php`.

| Artifact | SHA-256 |
| --- | --- |
| Before / private rollback preimage | 328b685cf5d627a52f1335a2e021c1249b801b0415c8f3becb90ec13f7bd6251 |
| Deployed containment | ac5053d7ce7e86b5417a8fa67a380f1c365da97832d0908bb33b319688ba1eee |
| Final generic 503 response, 142 bytes | 178de43b7b8e625112e5d8823aa898fdf1d33fdc19919e6e8f03d0702b86aa37 |

Backup: `/www/theresidencyacademy_209/private/MX-MISSIONACCOUNTS-5400A-CONT-route-preimage.php`, mode 0600. Live and backup hashes were read back after deployment and again during report preparation. Restoring the old file would reopen the unsafe route and is **not a safe operational rollback** until the cache exclusion is verified.

An affected-path purge was sent through the installed Kinsta MU plugin's documented loopback immediate-purge protocol for `missionmedinstitute.com/missionaccounts`; no site-wide purge was performed. The empty successful purge response alone is not treated as proof. Subsequent unchanged-URL requests returned 503, Kinsta MISS and Cloudflare DYNAMIC. No cache-busting query was needed for the core bootstrap checks.

Local and remote PHP lint passed. The route guard returned 503 for root, trailing-slash root, bootstrap and session with its feature flag false; an unrelated member-dashboard path fell through normally. `git diff --check` passed. No shared Matrix shell asset changed.

## P0 acceptance matrix

| Test | Observed | Verdict |
| --- | --- | --- |
| Anonymous Matrix bootstrap | 503, generic 142-byte body, no private data | CONTAINMENT PASS |
| Founder Matrix bootstrap | 503; Founder payload intentionally unavailable | Availability acceptance NOT PASS |
| Student 620 Matrix bootstrap | 503; no private payload | Contained; self-only usable response NOT PASS |
| Student 624 Matrix bootstrap | 503; no private payload | Contained; self-only usable response NOT PASS |
| 620 → 624 and 624 → 620 through Matrix | All private routes denied 503 | CONTAINMENT PASS |
| Alternating users then anonymous, same bootstrap URL | Identical generic denial; Kinsta MISS | CONTAINMENT PASS |
| Actual logout → private route | No actual browser logout transition executed | NOT VERIFIED; token-free HTTP denial is separate |
| Incognito / clean browser | In-app and Chrome navigation blocked by client tooling | NOT VERIFIED; no private payload was observed |
| Cache purge / repeated reload request | Final root and repeated bootstrap 503 / MISS / no-store | HTTP PASS; physical browser reload NOT VERIFIED |
| Direct Railway Founder | 200, Founder role, 347 student identities, 4,018 events | API PASS |
| Direct Railway student 620 | 200, own record only, 18 events, own subject matched | API PASS |
| Direct Railway student 624 | 200, own record only, 17 events, own subject matched | API PASS |
| Direct student admin-list and foreign student resource | 403 for both principals | API PASS |
| Direct /api/me with foreign student_id parameter | 200 self-only; foreign selector ignored | Isolation PASS; not a literal 403 |
| Direct anonymous bootstrap / invalid-token session | 401 / 401 | API PASS |


The fresh principal harness ran at 2026-09-07 00:30:51 UTC using legitimate existing WordPress pilot identities 1, 620 and 624; signed credentials existed only in process memory. This is server-principal evidence, **not a real student browser session**. The final anonymous root/bootstrap sequence at 00:41:43–45 UTC stayed safe. Early urllib requests returned a 403 before the expected application response and were insufficient evidence; they are preserved but superseded by the identified 503 checks. Browser attempts returned `net::ERR_BLOCKED_BY_CLIENT`; no browser security boundary was bypassed.

## Acceptance blockers

| ID | Severity | Finding | Required closure |
| --- | --- | --- | --- |
| A01 | P0 contained | Shared-cache bootstrap disclosed Founder data across users before containment | Provider cache exclusion and full real-role cold/warm/logout matrix before reopening |
| A02 | P1 | Matrix search returned “No direct match”; intended entry absent | Real entitled Founder, Dr J and students discover and open from current Matrix |
| A03 | P1 | Four navigation actions throw and leave stale content | Correct hash parsing/model shape and exercise the original visible controls |
| A04 | P1 | Six core capabilities false; nine observed families disabled | Finish authoritative transactions and prove each safe workflow before scoped activation |
| A05 | P1 | Zoom has duplicate canonical classes and isolated review attendance | Source-preserving reconciliation; replay invariants and financial derivation proof |
| A06 | P1 | Real student and separate Dr J role not demonstrated | Genuine authenticated role sessions; no View As substitute |
| A07 | P1 | Persistence, audit, reversal and role propagation unproved | Six full workflow chains with safe fixtures |
| A08 | P2 | Provider copy/schedule/state contradict live capabilities | Runtime-driven schedule, source and integration status; separate Test setup from Live gate |
| A09 | P2 | Competing uncapped/capped confirmation amounts; enabled contact inputs with disabled Save | Explain authoritative ceiling/holds and accurate editability; no billing-rule change |
| A10 | P2 | Responsive full workflows and error recovery not exercised | 1440 / 1024 / about 390 real-role functional matrix |

## Zoom: source to billing

Fresh read-only Supabase aggregates at 00:43–00:44 UTC establish:

| Layer | Historical import | Current | Meaning |
| --- | --- | --- | --- |
| Student identity records | 271 | 347 | 76 new isolated needs_review identities |
| All session rows | 419 | 421 | 2 additional API sessions |
| Confirmed canonical classes | 100 | 102 | Same start + Step as historical classes |
| Raw participant rows | 5498 | 5575 | 77 preserved provider rows |
| Attendance events | 3941 | 4018 | 77 new effective events |
| Active attendance days | 3264 | 3340 | 76 additional needs_review, non-billable days |


For June 8, one historical and one API confirmed class share **16:16:34 UTC / s1**, and another pair share **18:03:16 UTC / s23**. Each pair has two different meeting/instance keys, so provider-key idempotency alone misses the duplication. **72/77** new participant rows exactly match a historical row after normalized name plus identical join/leave time, class start and Step comparison. This is a canonical duplication defect, not merely harmless provider source links.

The 77 effective events belong to 76 needs_review identities and currently yield only 76 active `needs_review` days. The import's raw-stage result of zero events does not describe the following reconciliation transaction, which created them. Current decisions=0, invoices=0, charges=0, consents=0. No financial collection inflation was found in these tables; future billing safety after identity resolution is **NOT VERIFIED** and must not be declared safe. Same-day deduplication does not by itself solve duplicate identities or class counts. No source row, identity, event, session or day was changed by this audit.

Historical confirmed classes are **34 / 35 / 31** by cycle; the 5301P report's live **36 / 35 / 31** already includes the two added June classes. The visible list of **254 people** is the non-device subset: 347 = 254 non-device + 93 device/review records (17 historical + 76 added), all not absorbed/excluded. This explains the subset difference without inventing 17 missing humans, but the UI needs clearer labels. Existing historical holds remain material; READY is not approval or collectibility.

## Evidence, scope and next work

All **43 prior files** match their SHA manifest, including screenshots and private DOM captures. The P0 alert is unchanged at SHA-256 `224e2756b1aed985de5269ccc30d823e7e6c056530bdc8a6ec54c3ad15cb920a`. Private evidence stays local and is not committed. Sanitized derived aggregates and control inventory are in the containment branch.

The original 5301P completion and 5300A canon were inspected as claims/specification, not inherited acceptance. The canonical prototype hash matches `3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8`. Current direct runtime/auth/adapter/Stripe asset hashes matched the committed production source. A final direct HTML read at 00:58:27 UTC also matched the exact 655,690-byte generated file, SHA-256 030f50b2f53627cf5f19e5ee7ebaa14b71b47a3a76a1a009ac2776f29f3b78a5. Prior screenshots were inspected alongside canonical evidence; no new pixel-complete or mobile acceptance is claimed.

BOOT universal and inherited 5301P dependency checks passed. The explicit Founder continuation authorized this narrow emergency decision; 5400A was not added to the authority registry. Existing dirty worktrees and OS records were preserved. Initial lease transport/parser attempts did not authorize writes. The deployed change used the verified scoped lease recorded in the decision; its later keeper loss stopped subsequent protected writes. Final report writes use a fresh scoped lease and provider-native release verification.

Companion reports: [CONTROL_MATRIX](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5400A_CONTROL_MATRIX.md); [CANON_VS_LIVE](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5400A_CANON_VS_LIVE.md); [REAL_WORLD_UX_AUDIT](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5400A_REAL_WORLD_UX_AUDIT.md); [TO_CODEX_REPAIR_SPEC](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5400A_TO_CODEX_REPAIR_SPEC.md).

The requested audit cannot honestly be called fully executed while the intended entry is disabled and genuine role/persistence/browser tests remain unavailable. The next repair ticket must close those named tests, not merely run old suites or remove capability disables.
