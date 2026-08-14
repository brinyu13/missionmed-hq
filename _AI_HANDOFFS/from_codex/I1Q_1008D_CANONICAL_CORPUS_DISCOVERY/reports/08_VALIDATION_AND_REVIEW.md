# Validation and multidisciplinary review

Scope: engineering, safety, evidence, human-factors, accessibility, and medical review of
the discovery package. Status: **artifact-quality pass; production objective blocked**.

Abbreviations: entity tag (ETag), Multipurpose Internet Mail Extensions type (MIME),
JavaScript Object Notation (JSON), Hash-based Message Authentication Code (HMAC), and
Cloudflare R2 object storage (R2).

## Engineering and safety validation

- Probe syntax check: pass.
- Offline self-test: 14/14 checks, zero network, zero writes.
- Independent fixture suite: 6/6 pass, zero live network.
- Live probe: 411 bounded read-only requests; 105 candidates; 196 bodies; zero raw retention.
- List bodies: double-read and byte-stable; artifacts/local baseline: single read, no ETag or snapshot pin.
- Exact host/route/method allowlists: pass.
- Redirect, MIME, size, encoding, status, JSON, schema, identity, and path failures: fail closed.
- Nested-wrapper identity mismatch: rejected.
- Non-derivable identifier/direct-path case: rejected before network.
- Per-run HMAC aliases: same-run joinable, cross-run unlinkable.
- Atomic output containment and symlink protection: pass.
- Raw canary leakage suite: pass.
- Handoff validator: 35 receipt invariants, 4 bound hashes, 28 safe files, and 53 links pass.
- Runtime/shared mutation: zero.

The two safe utilities and final live receipt are bound by hashes in the discovery receipt.

## Sentinel review

Sentinel authorized only GET/HEAD discovery, zero-retention transcript/Nodes inspection,
immutable local database queries, and new safe handoff files. It prohibited media-detail
backfills, environment/credential reads, direct database access before owner resolution,
R2 listing without mediated authority, and all extraction before scope/privacy/rights/speaker
gates. The implementation stayed inside those conditions.

## Evidence review

The evidence model separates observed, derived, attested, and unknown claims. Counts always
name their population. Consumer projection is never called a universe; labels are never
called speaker authority; byte duplicates are never called semantic duplicates. Completeness
is capped at C1_OBSERVED.

## Medical review

Metadata discovery is complete within current access, but speaker, educational intent,
privacy, rights, and medical approval are blocked. No transcript-derived questions were
extracted or generated in this mission, so medical correctness, psychometric quality, and
release eligibility are not applicable.

## UX and accessibility review

Interactive UI, responsive layout, keyboard behavior, focus, and contrast are not applicable
to this static handoff. Markdown semantics are applicable: headings are sequential, status is
textual rather than color-dependent, tables have headers, links are descriptive, counts state
scope, and the first screen exposes outcome and next action.

Final claim: the discovery artifacts are suitable for successor use. The canonical corpus
and downstream Question Factory are not production-ready until the external gates pass.
