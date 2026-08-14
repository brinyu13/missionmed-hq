# I1Q-1007X-MA Privacy and Source Model

Status: CONTROL DEFINED; EXTRACTION BLOCKED
Artifact zone: evidence-only
Date: 2026-07-15
Authority: MissionMed OS commit `93c0404794fe105235b80514c75fffc3177f140b`, mission `I1Q-1006`, Question Platform passport, and `DR-006`

## Governing Determinations

1. The authoritative registry classifies all 97 records in the governed corpus category. Under DR-006, authoritative registry metadata is sufficient to classify all 97 sources as `verified_drj` at the **source level** for internal use.
2. Source-level corpus classification is not speaker-segment attribution. All 97 sources are multi-speaker, so no source may be retained wholesale.
3. Ninety-six sources have explicit source-specific speaker evidence that can support a deterministic restricted-zone allowlist. This evidence is not copied into working or evidence outputs.
4. One source has only generic-role evidence. It remains `verified_drj` at source level, but its Dr J segment mapping is unresolved. Its default retained-segment count is zero until a source-owner attestation or equally authoritative MissionMed mapping is recorded by the interim privacy owner.
5. `verified_drj` is an attribution classification, not public rights clearance, credential verification, medical approval, or permission to publish quotations, transcript excerpts, or media.

## Four-Zone Model

| Zone | Permitted contents | Permitted operations | Promotion rule |
|---|---|---|---|
| **Raw** | Authoritative source-system objects and metadata in their original systems | Read-only inventory and authorized fetch | Raw objects never promote directly to extraction |
| **Restricted** | Minimal fetched copies, original text, original labels, source metadata, source-to-opaque-ID map, gold labels, and redaction diagnostics | Least-privilege processing, annotation, adjudication, and deletion under audit | Only an allowlisted, validated transform may emit a working copy |
| **Working-redacted** | Dr J-only redacted text, opaque nonsemantic references, timestamps, typed redaction markers, and pipeline provenance | Privacy-safe extraction and quarantined candidate generation after the pilot gate passes | No promotion while any source or global privacy gate is open |
| **Evidence-only** | Aggregate counts, digests, thresholds, statuses, and non-reversible run evidence | Git filing, audit, and release review | Must contain no raw text, source metadata strings, original labels, names, or unredacted identifiers |

Raw and restricted zones are both restricted-access, but they have different ownership. The raw zone remains the immutable source-system truth. The restricted zone is a controlled processing boundary and must never become a second source of record.

## Required Removal Classes

| Class | Required action |
|---|---|
| `NON_DRJ_SPEECH` | Remove the entire segment, including student, unknown, generic-role, third-party, overlapping, and ambiguously attributed speech |
| `STUDENT_NAME` | Remove the span; suppress the segment when surrounding context remains identifying |
| `STUDENT_OTHER_IDENTIFIER` | Remove direct and linkable student identifiers, affiliations, handles, contact details, and cohort details |
| `PATIENT_DIRECT_IDENTIFIER` | Remove direct patient identifiers and linked identifiers |
| `PATIENT_QUASI_IDENTIFIER` | Remove dates, locations, demographics, relationships, rare attributes, and combinations that can identify a patient |
| `THIRD_PARTY_IDENTITY` | Remove identities and linkable descriptors of clinicians, staff, relatives, institutions, and other persons |
| `IDENTIFYING_CLINICAL_ANECDOTE` | Suppress the complete anecdote window when span redaction cannot reliably break re-identification linkage |
| `SOURCE_METADATA` | Remove source titles, URLs, paths, filenames, original IDs, original speaker labels, and metadata-derived strings |

The classes are a union. A segment matching more than one class receives every applicable removal action; no detector or class can vote another class back into the output.

## Deterministic Transform

1. **Admit the source.** Require a `verified_drj` source-level decision, exact artifact digest, expected JSON type, expected record-key allowlist, and complete timestamp, speaker, and text fields. Reject malformed or changed input.
2. **Create an opaque mapping.** Assign random, nonsemantic working source and segment references. Keep the source mapping only in the restricted zone.
3. **Apply the speaker allowlist first.** Retain a segment only when its original label exactly matches the source-specific authoritative Dr J mapping. Fuzzy label matching, title inference, voice inference, and majority-speaker inference are prohibited. Unknown, mixed, overlapping, or ambiguous segments are removed.
4. **Run the fixed redaction ensemble.** Use pinned detector, ruleset, dictionary, and normalization versions with deterministic settings. The output is the union of all detected removal classes.
5. **Suppress context, not only tokens.** Evaluate the full anecdote window across adjacent segments. If rare facts or combined quasi-identifiers can still single out a person, suppress the complete linked window.
6. **Construct a new object from an allowlist.** Never clone the input and edit fields in place. The only working fields are opaque references, millisecond timestamps, normalized `DRJ` role, `redacted_text`, applied class codes, and pipeline version.
7. **Reject forbidden fields.** Schema validation fails on unknown fields and specifically forbids raw text, original speaker labels, source metadata, reversible source IDs, and parallel raw/redacted values.
8. **Scan the serialized output.** Run identity, metadata, high-entropy, path, URL, email, telephone, account, and forbidden-key checks over the final bytes. Any hit quarantines the whole source.
9. **Seal evidence.** Record input bundle digest, pipeline digest, gold-set digest, output digest, counts, and pass/fail only. Per-source mappings and diagnostic snippets remain restricted.

The same pinned input and pipeline must produce byte-identical working output. Uncertainty always resolves to removal or quarantine, never retention.

## Working-Copy Contract

A compliant working copy:

- contains only positively mapped Dr J segments;
- contains no original or non-Dr J speaker labels;
- exposes `redacted_text` only, never a raw-text sibling field;
- uses non-linkable typed placeholders or whole-window suppression;
- carries no title, URL, path, filename, source-system ID, or person name;
- is unavailable to extraction until both per-source validation and the global gold-label pilot pass; and
- remains internal and restricted from public quotation, excerpt, or clip use.

## Current Disposition

No governed working-redacted copy or passing privacy pilot is evidenced. The existing candidate privacy implementation is rejected because it returns raw text with redacted text, omits required classes, and can pass an aggregate despite zero recall for a required class. Therefore all 97 sources remain blocked from extraction. The generic-only source has the additional unresolved segment-attribution block.
