# I1Q-1007X Authentication and Authorization Test Matrix

Status: BASELINE; CANONICAL ADAPTER NOT IMPLEMENTED

Verdict: BLOCK

## Authority Context

DR-006 and MissionMed OS PR #12 now authorize reuse of the canonical MissionMed internal authentication/session chain. The original authority gap was a snapshot-time root-recovery finding. This matrix remains mandatory because authorization, expiry, revocation, CSRF, IDOR, and reviewer binding are not repaired.

## Identity Adapter Contract

The adapter must return a server-derived immutable actor containing a canonical subject and an explicitly mapped I1Q role set. The request may not supply actor ID, reviewer ID authority, credentials, or roles. Database context must be created from that actor for one transaction and then cleared.

## Session and Boundary Cases

| ID | Case | Expected result | Candidate status | Evidence / gap |
| --- | --- | --- | --- | --- |
| AUTH-001 | Public health request | `200`, no protected data | PASS LOCAL | `/api/health` is public |
| AUTH-002 | Protected API without identity adapter | `401` | PASS LOCAL | Candidate fails closed |
| AUTH-003 | Valid canonical session, mapped read-only role | Only answer-free authorized resources | FAIL | Generic item revision read exposes answer fields |
| AUTH-004 | Valid session, unknown WordPress role | `403`, no role fallback | NOT IMPLEMENTED | No canonical role mapper |
| AUTH-005 | Actor ID supplied by request header/body/query | Ignored and rejected where ambiguous | NOT IMPLEMENTED | Resolver contract undefined |
| AUTH-006 | Expired session | `401`; cookie cleared where canonical flow requires | BLOCKED | No adapter test; inspected HQ source warns and accepts expiry |
| AUTH-007 | Revoked session | `401` | NOT TESTED | Revocation contract absent |
| AUTH-008 | Logout followed by API request | `401` | NOT TESTED | Canonical logout integration absent |
| AUTH-009 | Session fixation / pre-login cookie reuse | Session identifier and CSRF rotate | NOT TESTED | Adapter absent |
| AUTH-010 | Auth service outage | `503` or controlled `401`; no demo/admin fallback | NOT TESTED | Failure contract absent |
| AUTH-011 | Direct URL to internal UI | Authentication gate before protected data | NOT TESTED | No canonical host integration |
| AUTH-012 | Direct API resource enumeration | Per-entity authorization and IDOR protection | FAIL | Generic list/get accepts any read role |
| AUTH-013 | Cookie mutation without CSRF header | `403` | FAIL | I1Q server has no CSRF validation |
| AUTH-014 | Invalid CSRF token | `403` | FAIL | I1Q server has no CSRF validation |
| AUTH-015 | Cross-origin mutation | Rejected by origin/CSRF policy | NOT IMPLEMENTED | Restrictive CORS does not itself prove CSRF protection |
| AUTH-016 | Role escalation by body payload | `403`; payload cannot grant authority | FAIL | Reviewer registration accepts credential/role payload from admin |
| AUTH-017 | Admin acts as another reviewer | `403` | FAIL CONFIRMED | Admin bypasses reviewer actor equality |
| AUTH-018 | Medical event on editorial assignment | `422` or `403` | FAIL CONFIRMED | Assignment review type is not compared |
| AUTH-019 | Self-review and delegated self-review | Rejected | PARTIAL | Application checks direct/delegated author equality; DB/RLS proof absent |
| AUTH-020 | Local demo in deployed environment | Startup failure | NOT IMPLEMENTED | Loopback proxy can appear local |
| AUTH-021 | Canonical actor reused on pooled DB connection | No identity bleed | NOT TESTED | Transactional adapter absent |
| AUTH-022 | Service-role credential in browser/client | Impossible; secret scan clean | NOT TESTED END-TO-END | No deployed bundle or secret scan evidence |

## Endpoint Authorization Target

| Endpoint class | Allowed actor | Required context | Answer-bearing |
| --- | --- | --- | --- |
| Dashboard summaries | Authenticated internal role | Aggregate, privacy-safe | No |
| Candidate authoring | Assigned author/content operator | Exact candidate and source-safe view | Only explicit author workflow |
| Editorial review | Assigned editorial reviewer | Accepted assignment, exact revision | Yes, purpose-audited |
| Medical review | Assigned credentialed physician | Accepted medical assignment, exact revision | Yes, purpose-audited |
| Rights/privacy decisions | Assigned owner workflow | Exact source and authority record | No answer requirement |
| Release assembly | Assigned release manager | Eligible exact revisions | Server-only answer set, purpose-audited |
| Release attestation | Assigned medical-governance lead | Validation evidence and medical chain | Server-only |
| Publication ratification | Brian authority | Ratified evidence bundle | No generic endpoint |
| STAT pre-answer | Authenticated participant through existing STAT RPC | Sealed duel | No |
| STAT post-answer | Authenticated participant | Server-finalized duel | Yes, scoped to duel |
| Generic resource API | Remove or explicit allowlist only | Per-entity DTO | Never answer-bearing |

## Required Evidence

- Canonical adapter unit and integration tests.
- Protected HQ/WordPress/Arena/Matrix regression baseline.
- Expired, revoked, logout, fixation, outage, wrong-role, direct URL, direct API, and CSRF tests.
- Role-mapping fixture approved by Root and Security.
- Browser and raw HTTP tests against preview.
- Database context isolation across pooled concurrent requests.
- No demo mode, actor headers, client role claims, or service credentials in deploy artifact.

## Exit Rule

All rows marked FAIL, BLOCKED, NOT IMPLEMENTED, or NOT TESTED must pass before staging certification. Expiry acceptance in the inspected HQ source must be reconciled through the Critical Systems gate without weakening shared auth.
