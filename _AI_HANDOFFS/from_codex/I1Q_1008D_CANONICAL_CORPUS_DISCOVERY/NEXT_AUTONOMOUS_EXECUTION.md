# Next autonomous execution

Recommended successor: **I1Q-1008E — Owner-Attested Corpus Freeze and Restricted
Speaker/Privacy Adjudication**.

## Current entry state

- Completeness: `C1_OBSERVED`
- Candidate sources: 105 under an unratified broad predicate
- Primary transcript artifacts available: 97
- Nodes artifacts available: 99
- Extraction: blocked
- Questions extracted/generated: 0

## Required inputs before resumption

Abbreviations: Cloudflare R2 object storage (R2) and MissionMed Headquarters/Content
Intelligence Engine (HQ/CIE).

1. named corpus-owner scope/denominator/exclusion receipt;
2. exact Supabase/media-index project pin and snapshot-scoped read authority;
3. mediated R2 listing authority;
4. authenticated, proven non-mutating HQ/CIE inventory access;
5. source-specific privacy, rights, and attribution decisions;
6. segment-level Dr. J speaker-adjudication authority.

If none of these inputs is supplied, do not rerun unauthenticated discovery or polish the
legacy bank. The safe local work is exhausted.

## First actions after authority arrives

1. Verify the committed probe and test hashes against `evidence/discovery_receipts.json`.
2. Run the fixture-only suite; require 6/6 and the offline self-test; require zero network
   in both test modes.
3. Build the restricted owner roster using stable boundary-key aliases. Keep the key and raw
   roster outside the repository.
4. Reconcile the roster with R2, database/index, HQ/CIE, runtime, consumer, and local sets.
5. Resolve all eight sources without a current primary transcript.
6. Rerun the live probe into a new timestamped receipt; never overwrite historical evidence
   without preserving its hash in the restricted audit log.
7. Raise completeness only after the owner signs the reconciled denominator.

From the I1Q worktree root, the probe invocation is intentionally parameterized:

```text
cd <I1Q-worktree-root>
node _AI_HANDOFFS/from_codex/I1Q_1008D_CANONICAL_CORPUS_DISCOVERY/tools/sanitize_runtime_corpus_probe.mjs --output _AI_HANDOFFS/from_codex/I1Q_1008D_CANONICAL_CORPUS_DISCOVERY/evidence/<new-safe-receipt>.json --registry-input <approved-local-registry>
```

Do not add auth headers, tokens, cookies, raw identifiers, or transcript content to the tool
or command history. Do not call a media-detail route that can backfill.

## Extraction start condition

Extraction starts only when every retained corpus member has exactly one authorized primary
transcript, stable segment locators, rights/privacy clearance, and adjudicated Dr. J segment
authority. Process every member, preserve exact provenance and verbatim/reconstructed state,
quarantine ambiguity, then compare with the 845 rows carried forward from the bound
[I1Q-1008C legacy audit](../I1Q_STATQUESTIONS_1008C_SOURCE_FACTORY/reports/02_LEGACY_V4_AUDIT_REPORT.md).
