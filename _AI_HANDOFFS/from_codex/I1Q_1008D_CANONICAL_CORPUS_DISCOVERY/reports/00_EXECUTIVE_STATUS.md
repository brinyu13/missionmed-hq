# Executive status and mandatory metrics

Scope: I1Q-1008D read-only corpus discovery. Evidence cutoff:
2026-07-17T05:51:03-04:00. Limitation: current runtime observations are not an
owner attestation of the complete Dr. J corpus.

Abbreviations: United States Medical Licensing Examination (USMLE), content delivery network
(CDN), Cloudflare R2 object storage (R2), MissionMed Headquarters/Content Intelligence Engine
(HQ/CIE), and entity tag (ETag).

## Outcome

The current runtime exposes **313** unique registry records. A deliberately broad,
unratified `division=USMLE` predicate nominates **105** candidate sources. The consumer
drill projection contains **97** of those candidates and omits **8**. The local runtime
baseline contains **303** registry records and **95** candidates under the same predicate.

The observed three-surface split is exact:

- 87 candidates are in live runtime, consumer projection, and local baseline;
- 10 are in live runtime and the consumer projection but not the local baseline;
- 8 are in live runtime and the local baseline but not the consumer projection;
- 0 are outside live runtime in either compared surface.

The safe artifact sweep checked the canonical transcript and Nodes location for every
candidate. It validated **97 transcript JSON artifacts** and **99 Nodes JSON artifacts**.
Exactly **97 sources have both**, **2 have Nodes only**, and **6 have neither**. All
14 unavailable artifact checks returned a sanitized not-found class at the pinned CDN
location. This does not prove absence from R2 or alternate storage.

This is a strong current inventory, but the authoritative corpus remains unproven.
Completeness grade is **C1_OBSERVED** and question extraction remains **BLOCKED**.
The list surfaces were double-read and byte-stable; artifacts and the local registry were
read once and were not protected by a snapshot pin or ETag.

## Required end-of-run metrics

| Metric | Result | Interpretation |
|---|---:|---|
| Current live registry records | 313 | Current runtime surface, not Dr. J scope |
| Unratified source candidates | 105 | Broad candidate envelope, not canonical membership |
| Primary transcript artifacts discovered and structurally validated | 97 | Unique byte hashes; all payload-bound |
| Nodes artifacts discovered and structurally validated | 99 | Unique byte hashes; 97 payload-bound, 2 locator-bound |
| Probe-defined canonical artifact locations checked | 210 | Two classes across 105 unratified candidates |
| Artifact bodies integrity-processed | 196 | 97 transcript + 99 Nodes bodies |
| Artifacts processed for question extraction | 0 | Extraction was not authorized |
| Corpus proven complete | No | Owner/scope and upstream reconciliation are absent |
| Explicit questions extracted | 0 | Not started |
| Implicit or reconstructed questions extracted | 0 | Not started |
| Teaching statements converted to candidate questions | 0 | Not started |
| Unique transcript-derived concepts after semantic deduplication | Not measured; 0 produced/established | Corpus content total was not measured |
| Transcript/legacy overlaps | Not measurable; 0 established | Must follow canonical extraction |
| Transcript-derived concepts absent from legacy | Not measurable; 0 established | Must follow canonical extraction |
| Legacy rows without established transcript provenance | 845/845 | Unestablished linkage, not proof of corpus absence |
| Transcript-derived four-choice MCQs | 0 | None generated |
| Credentialed medical reviews | 0 | No transcript-derived questions were extracted or generated in this mission |
| Approved questions | 0 | No medical governance authority is assigned |
| Quarantined transcript-derived questions | 0 | The 105 held objects are sources, not questions |
| Source candidates held outside extraction | 105 | Scope/privacy/rights/speaker gates remain blocked |

The 845-row metric is carried forward from the bound
[I1Q-1008C deterministic legacy audit](../../I1Q_STATQUESTIONS_1008C_SOURCE_FACTORY/reports/02_LEGACY_V4_AUDIT_REPORT.md).
Those rows remain secondary comparison material. They do not define the corpus, and this
mission did not polish or promote them.

## Unresolved corpus gaps

- a named owner has not attested the source-universe predicate or denominator;
- six candidates lack both current canonical artifacts and two lack a primary transcript;
- authenticated HQ/CIE, exact Supabase project ownership, and mediated R2 listing remain unavailable;
- no per-source rights/privacy manifest or segment-level Dr. J authority exists;
- source labels do not establish speaker identity or educational intent.

Exact next action: obtain the owner-attested universe and restricted authority grants,
reconcile the 105-candidate receipt against upstream R2/database/HQ inventories, bind one
authorized primary transcript per member, then rerun the safe probe before extraction.
