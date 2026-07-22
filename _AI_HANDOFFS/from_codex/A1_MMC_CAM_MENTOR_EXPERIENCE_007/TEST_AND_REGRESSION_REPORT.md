# Test and Regression Report

RESULT: `LOCAL_007_VALIDATION_PASS`

## Final local result

The 007 mentor candidate passes the complete authorized local/non-staging validation set. No credential-gated staging proof, configured database, provider, or production check is represented as run.

## Mentor contract and backend evidence

| Suite | Result |
| --- | --- |
| Mentor query contract | PASS — exact envelope, deterministic ordering, three-plus-four bound, assignment isolation, honest state, publication disabled |
| Mentor command owner | PASS — 11 kinds, one owner each, 99 concurrent replays, subject continuity, assignment expiry, capture-to-review behavior, zero provider dispatch |
| Mentor route | PASS — 14 routes, private authorization, exact loopback origin, CSRF, no-store, Operations gate, production/LIVE denial |
| Mentor scale | PASS — 1,000 students, 10,000 work items, 500 reviews, 100 sessions for one selected student, page bound 100, opaque cursor |
| Shared-server registration | PASS — authenticated boundary, default-off behavior, STAGING denial, role separation, historical-pipeline seal |
| Local review mount | PASS — default off, production/STAGING denial, historical and unsupported asset denial, symlink escape denial, strict headers |
| JS/SQL parity manifest | PASS — 97 SQL functions, 229 safe error codes, unapplied migration state |

The parity gate initially detected source-hash drift after a late source change. The manifest was regenerated from final inputs and the no-write equality gate then passed. This is the intended behavior of the drift gate.

## Browser and product evidence

The isolated Founder review suite passed **73/73** checks in system Google Chrome 150 through Chromium automation:

| Lane | Passed |
| --- | ---: |
| Static isolation/fallback | 8/8 |
| Fixture security | 11/11 |
| Route and workflow | 9/9 |
| Multi-tab fencing | 5/5 |
| Honest state matrix | 8/8 |
| Keyboard and focus baseline | 9/9 |
| Responsive/visual structure | 6/6 |
| Performance/bounded scale | 9/9 |
| Automated usability heuristics | 8/8 |

The screenshot-manifest validator separately passed **6/6** checks. It verified 22 synthetic JPEGs, required widths/states, environment labels, byte sizes, SHA-256 values, absence of ephemeral URLs/absolute user paths, and explicit non-production classification.

Behavioral proof includes route-owned subject identity, exact deep links, same-origin navigation, attention defer/dismiss readback, pinned session start/capture/review, one active session across two tabs, cross-subject capture denial, no durable browser cache, loading/empty/partial/stale/error/revoked/offline/conflict states, dialog focus return, route-heading focus, reduced motion, no page overflow, long RTL/Unicode wrapping, and bounded transcript rendering.

## Foundation and legacy regression

All 006 CAM foundation validators and all legacy MMC validators whose own gates do not require staging credentials/targets passed in the final non-staging run. Coverage includes state, gateway security, opaque assets, cutover, evidence, identity, publication, schema, principal derivation, private JSON, historical seals, command concurrency, job fencing, private mount, persistence integration, pipeline/worker, selection continuity, roster/identity, student resolution, Webex policy/routes, and v1 core compatibility.

Credential/target-gated staging persistence, staging roster, configured Supabase/RLS, and real provider proofs remain `NOT RUN`. They require separate 009 authority and cannot be converted into local tests.

The report-only critical-systems gate also passed all protected-path, shared-server syntax, and 26-file relative-import checks with network checks intentionally skipped. Its network and three external browser-journey warnings are recorded as `NOT RUN`, not silently converted to production evidence.

## Independent review

A fresh read-only audit found one bounded capture-ID issue: review IDs derived from capture IDs could exceed the route-safe maximum. The implementation now accepts a 185-character capture ID yielding an exact 200-character review ID, rejects a 186-character capture ID with `422` before mutation, and proves zero rejected-case changes to captures, audit, outbox, receipts, or command IDs. Final audit verdict:

- P0: 0
- P1: 0
- P2: 0
- Verdict: PASS

The post-commit release audit then identified a user-specific absolute fallback path in the browser-test runtime. A portability-only corrective commit now derives that path from the current home directory while preserving the explicit environment override. Syntax and all 73 Chromium checks passed again after the correction; the final code/evidence identity is `90cd9998b29beeb1dc484380bd32b5759478822d`.

## Claim boundary

This is strong deterministic local evidence, not proof of representative mentor task time, five-second comprehension, Axe, Firefox, WebKit, VoiceOver, NVDA, TalkBack, iOS/Android touch behavior, configured RLS, provider behavior, staging, or production. Those remain explicit later gates.
