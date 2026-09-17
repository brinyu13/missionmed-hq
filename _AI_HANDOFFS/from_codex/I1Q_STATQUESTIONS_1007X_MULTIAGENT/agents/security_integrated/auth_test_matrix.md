# I1Q-1007X Integrated Auth Test Matrix

## Current Scope

This matrix evaluates the HTTP and platform authorization mechanics at commit `4b154e8` and separates local synthetic proof from unavailable canonical-session proof.

## Matrix

| ID | Attack or condition | Expected | Evidence | Result |
| --- | --- | --- | --- | --- |
| AUTH-001 | No identity resolver | All protected APIs deny | Health test plus server source | PASS, 401 default |
| AUTH-002 | Resolver outage | Deny without internal detail | Security regression test | PASS |
| AUTH-003 | Resolver returns unvalidated context | Deny | Security regression test | PASS |
| AUTH-004 | Missing session object | Deny | Security regression test | PASS |
| AUTH-005 | Expired session | Deny | Security regression test | PASS |
| AUTH-006 | Revoked session | Deny | Security regression test | PASS |
| AUTH-007 | Stale validation timestamp | Deny | Security regression test | PASS |
| AUTH-008 | Future validation beyond skew | Deny | Source inspection | PASS by condition, not an independent request test |
| AUTH-009 | Unknown or empty roles | Deny | `normalizeActor` inspection and tests | PASS |
| AUTH-010 | Wrong application role | Deny workflow command | Platform tests | PASS for covered commands |
| AUTH-011 | Forged reviewer or actor ID | Deny | Security regression test | PASS |
| AUTH-012 | Assignment type swap | Deny | Security regression test | PASS |
| AUTH-013 | Exact revision hash swap | Deny | Security regression test | PASS |
| AUTH-014 | Direct self-review | Deny | Application and SQL inspection | PASS statically and in application tests |
| AUTH-015 | Direct delegated self-review | Deny | Application and SQL inspection | PASS for one delegation edge |
| AUTH-016 | Missing CSRF token | Deny mutation | Security regression test | PASS |
| AUTH-017 | Wrong CSRF token | Deny mutation | Security regression test | PASS |
| AUTH-018 | Missing, null, malformed, or untrusted Origin | Deny mutation | Security regression test and source inspection | PASS |
| AUTH-019 | Local demo in production | Deny | Security regression test | PASS |
| AUTH-020 | Local demo behind forwarded headers | Deny | Security regression test | PASS |
| AUTH-021 | Caller-supplied artifact phase | Cannot unlock post-answer | Security regression and adapter tests | PASS |
| AUTH-022 | Forged participant finalization | Deny | WeakSet-bound trusted context tests | PASS locally |
| AUTH-023 | Generic write mass assignment | Deny unknown fields without echo | Security regression test | PASS |
| AUTH-024 | Unassigned read-only actor requests draft revision | Deny by assignment or approved state | Independent attack probe | FAIL, draft returned |
| AUTH-025 | Internal API request while both internal flags are off | Deny | Independent attack probe | FAIL, dashboard HTTP 200 |
| AUTH-026 | Canonical WordPress and HQ session | Fresh actor and roles | No adapter or staging path | NOT RUN |
| AUTH-027 | Canonical logout and revocation | Immediate denial | No adapter or staging path | NOT RUN |
| AUTH-028 | Shared auth cookie, CORS, and session fixation | Secure under browser | No staging browser path | NOT RUN |

## Findings

The injected adapter boundary is intentionally strict, but the executable main entrypoint never supplies that adapter. Once a resolver is supplied, generic reads are not assignment scoped and internal flags do not gate the service. The safe no-resolver 401 behavior therefore cannot be used as evidence that an integrated service is authorized correctly.

The resolver is also the authority for I1Q roles, CSRF token, trusted origins, and participant finalization. No canonical implementation proves that these values are derived server-side from current MissionMed and I1Q records.

## Changes

None. The application and tests were read-only.

## Tests

The current integrated focused run passed 112 cases, failed 6 review-workflow cases, and skipped one database execution case. The core identity and CSRF cases remained green. The independent attack probe reproduced AUTH-024 and AUTH-025 with synthetic, non-medical data.

## Risks And Blockers

State C remains blocked by AUTH-024 through AUTH-028. The shared HQ defects already recorded by ecosystem mapping also require their own protected authority and regression process. This packet does not authorize shared-auth changes.

## Confidence

High, `0.98`, for the local auth results. Low for live auth because no canonical adapter, URL, session, or browser was available.

## Paths

- `i1q-question-platform/src/auth.mjs`
- `i1q-question-platform/src/server.mjs`
- `i1q-question-platform/src/platform.mjs`
- `i1q-question-platform/tests/security-regressions.test.mjs`
- `i1q-question-platform/tests/app.test.mjs`

## Root Handoff

Root should require an app-owned assignment filter for generic reads, an actual server feature-gate middleware, and a canonical resolver contract before any authenticated deployment attempt. Then rerun this matrix with real expiry, revocation, logout, CORS, and CSRF behavior on staging.
