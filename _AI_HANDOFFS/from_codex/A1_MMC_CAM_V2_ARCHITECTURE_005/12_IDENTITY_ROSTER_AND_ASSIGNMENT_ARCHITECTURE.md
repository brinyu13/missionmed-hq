# 12 Identity, Roster, and Assignment Architecture

RESULT: `IDENTITY_FAIL_CLOSED_ARCHITECTURE_DEFINED`

## Authority rule

MMC does not own canonical student identity. It owns a versioned `verified_local_subject_link` connecting an external canonical subject reference to MMC coaching objects, plus a separate mentor Assignment. The current route’s `canonical_student_identity: true` claim conflicts with the foundation migration’s explicit non-authoritative reference model and must not survive.

Identity answers “which subject does this evidence refer to?” Assignment answers “which mentor may act for this subject now?” Neither implies the other.

## States

`UNVERIFIED`, `PROBABLE`, `MANUAL_REVIEW`, `CONFLICT`, `VERIFIED_LOCAL_LINK`, and `REVOKED` are the canonical identity decision states. The familiar display label `VERIFIED` may be used only with the full text “Verified local subject link,” never “canonical student.”

Automatic promotion requires policy-approved strong anchors from at least two genuinely independent upstream authority families, no fixture/tenant conflict, current evidence, threshold calibration, and no contradictory anchor. Separate adapters or fields that repeat one upstream record are one source. A name, email, filename, Webex title, Calendar title, meeting title, or caller-supplied confidence alone can never verify a student. Live automatic promotion remains disabled until a predeclared labeled evaluation, including at least 5,000 adversarial negative pairs, demonstrates zero false positives; human review remains the default.

## Attested source envelope

Only a server-side allowlisted adapter can issue:

```text
adapter_id/version · source_system · upstream_authority_family/root_record_id
source_record_opaque_id
subject_anchor_type/value_digest · observed_at · expires_at
read_authority_decision · tenant/environment · payload_hash
evidence_status · signature/HMAC · correlation_id
```

The verifier checks an approved strong-anchor registry, adapter allowlist, signature, evidence status, freshness, tenant/environment, anchor semantics, upstream lineage, and independence. Two labels/adapters derived from one upstream authority are one source. Unknown source types are not strong by default. Browser-entered JSON remains a diagnostic note and has zero verification weight.

## Candidate comparison

The review screen shows source asset/session, proposed subject, competing candidates, active assignments, each anchor’s source/type/status/freshness, conflicts, confidence method, and downstream impact. It never preselects a candidate solely from name/title. Reviewer actions are select candidate, reject all, request evidence, mark duplicate, or escalate. “Approve and analyze” is split into separate decisions and capabilities.

## Decision rules

- Fixture IDs and real assets are structurally different environments; no override can bridge them.
- Name/email/title matching can discover candidates only.
- A conflict blocks automatic and ordinary manual verification until resolved or an explicitly governed override cites an already attested strong anchor.
- Admin approval cannot manufacture a source reference; it chooses among verified source candidates and records reason.
- Low confidence and stale evidence route to review.
- Identity decision is versioned and idempotent; it never mutates external systems.
- Media attachment, analysis, and publication recheck current identity and assignment at command execution.

## Assignment lifecycle

Assignment states are `PROPOSED → ACTIVE → EXPIRED/REVOKED/REASSIGNED`. Activation requires verified principals, subject link, scope, effective dates, granting authority, and audit. Assignment does not promote identity. Expiration/revocation immediately denies that former mentor's reads, writes, job retries, source attachment, review approval, and new publication; that mentor's cached protected data is cleared. It does not silently revoke the exact student's separately authorized access to an existing publication projection, whose correction/withdrawal/expiry/retention lifecycle is independent. Historical mentor access follows retention/legal policy and is never inferred from a former assignment.

## Merge, duplicate, and historical identity

- Duplicate candidates remain separate until an authorized merge decision.
- Merge creates a surviving link plus immutable alias/tombstone and a reconciliation job; it does not delete evidence.
- Cross-subject object movement requires per-object review, before/after hashes, and rollback—not a bulk database ID rewrite.
- Historical identifiers retain validity interval and source; UI shows prior name/ID only under appropriate need.
- A split correction can restore wrongly merged subjects and identifies every affected session/object/publication.

## Correction and revocation

Correction creates a new Identity Decision, marks the prior decision superseded/revoked, freezes dependent jobs, and queues impact review. Operational objects are not silently moved. Publications derived from a wrong link are withdrawn immediately and treated as a privacy incident. Reanalysis waits for explicit reattachment approval.

## Audit and rollback

Every candidate generation, evidence read, comparison, decision, override, merge/split, assignment activation/expiry, attachment, and denied action records actor, role, subject/assignment, source digests, decision policy/version, reason, before/after hashes, and correlation. Rollback is a new decision, not audit deletion.

## Roster and UI behavior

Roster is a read projection of subject links and assignments, not browser JSON. Rows show identity state, independent-source count, newest evidence date, conflict, assignment scope/expiry, and safe next action. Strong anchors open in the evidence inspector with sensitive values minimized. No green “verified” treatment appears without accessible state text.

## Isolation and adversarial suite

Required cases include fabricated browser anchors, unverified evidence status, unknown source type, two fields from one system, same-name subjects, changed email, fixture ID, cross-tenant anchor, stale anchor, conflicting immutable IDs, revoked assignment, expired reviewer page, duplicate approval click, merge then split, wrong-subject real media, and publication after revocation.

Release gates:

- Fabricated/caller-authored/name/email/title-only evidence produces no verified link.
- Automatic verification requires two attested independent upstream authority families and the 5,000-pair adversarial evaluation; any false positive is release blocking and keeps live automatic promotion disabled.
- Manual decision cannot bypass fixture, tenant, or unresolved conflict protection.
- All identity and assignment changes are reversible/auditable.
- Cross-subject and inactive-assignment server/RLS/browser matrices return no data or write effect.
- Real media never attaches to a fixture or unresolved subject.
