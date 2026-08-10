# B1-513R V1 → V2 Story Survival Contract

**ABSOLUTE SAFETY LAW.** Every existing real student story survives V2 byte-for-byte in every canonical dimension. This contract binds every V2 migration and is enforced by an automated, protected manifest — not by prose or good intentions.

## 1. Survival invariants (per existing story, all releases)

Same: canonical story ID · owner (student UUID + WordPress binding) · title + prefix flag · truthful source/original telling (text + provenance chain) · working text (byte-identical; becomes the Full Story by LABEL only — zero-copy, doc B1-513/03) · transcript(s) · permanent audio asset IDs, objects, and playback path · Learning Lesson · student priority (`student_score`) · categories/intended uses (IDs and associations) · review state + reviewer attribution + feedback + internal notes · mentor notes and media · audit/provenance events · created/updated/submitted/reviewed timestamps · privacy semantics (NULL visibility = private-for-observation; submitted access unchanged) · every child-row relationship and count.

Forbidden, mechanically: destructive migration; re-import; mass rewrite; AI regeneration of any student text; abandoning rows behind new tables; ID replacement or remapping; silent privacy/category/submission/visibility change; silent audio relocation or re-encoding. **Never manufacture an Original Telling**: a story whose original is not truthfully distinct (no preserved separate source/audio/transcript) renders Original = the earliest truthful text it has, exactly as production does today — no synthesized "original" row, ever.

## 2. Additive mapping (evidence-based, from the live schema)

- V1 canonical story → the SAME V2 story row. No copy, no new ID.
- V1 Working Version → V2 "Full Story" — a published Content & Display LABEL on the existing `workingVersion` section. Zero data movement; label reversible in one publish.
- V1 immutable original/revisions → Original Telling, unchanged storage and protection.
- 30-Second / NNQ Setup → **absent until the student creates them** (`sf_story_versions` rows). Absence renders as the "+" tab, never as empty synthesized content.
- All other V2 domains (visibility columns, consent, invitations, contributions, activity, prompts) are new additive tables/columns with NULL-safe reads (B1-513 doc 10, extended by doc 13 here).

## 3. The Story Survival Manifest (mandatory, automated, protected)

Codex must implement `sf_survival_manifest` tooling that runs **before and after every V2 production migration**, writing a protected (0600, outside web root) JSON manifest keyed by story ID with, per story: owner UUID · SHA-256 of working text · SHA-256 of original text · SHA-256 of Learning Lesson · title hash · priority value · category ID set hash · intended-use ID set hash · review status + reviewed_by + status_changed_at · visibility column value (NULL preserved as NULL) · submitted_at/last_submitted_at · audio_asset id list + R2 object HEAD (exists, byte size) · transcript reference hashes · mentor note count + media count · revision count · reflection count · audit event count · row_version. Plus global counts: users, stories, recordings, notes, media rows. **IDs, hashes, and counts only — no private prose in the manifest.**

Comparison gate (automated, exit non-zero on any mismatch):

| Check | Acceptance |
|---|---|
| Story loss | 0 — every pre-ID present post |
| Owner changes | 0 |
| Working/original/lesson/title hash changes | 0 unexplained (an "explained" change requires an allowlist entry citing an audited user action between snapshots — expected to be empty during cutover freezes) |
| Unauthorized visibility changes | 0 — NULL stays NULL; values change only via audited student action |
| Missing audio (row or R2 HEAD) | 0 |
| Missing transcripts | 0 |
| Priority/taxonomy/review/timestamp changes | 0 unexplained |
| Child counts (revisions, notes, media, reflections, audit) | ≥ pre values, never lower |
| Row count deltas on `sf_users`/`sf_stories` | 0 from migration |

**Any mismatch = STOP-SAFE**: halt the release train, do not proceed to the next step, do not "fix forward," restore posture per the rollback ledger, and report the exact diff to the Founder. The manifest tool itself is Terra-grade mechanical work; its gate is absolute.

## 4. Operational preconditions (per migrating release)

Fresh locked Railway backup + fresh Kinsta snapshot + PG18 dump with **isolated restore rehearsal proven** (counts read back from the restored instance), all receipted, **before** the pre-manifest; migration applies once through the guarded runner (B1-511/512 pattern) inside one transaction with ledger row; post-manifest + comparison immediately after; Critical Systems zero-fail before and after; the four-identity canary matrix after activation.

## 5. Verification in this package

The R prototype layer was red-teamed specifically for survival coherence: no code path mutates existing story rows, re-imports, changes IDs, or silently widens visibility (verify/REDTEAM.md §5, PASS). Executable probes re-confirm: historical stories not converted by consent (probe 12), retell/restore monotone history (10–11), promotion creates NEW rows only (21–22). The megarun prompt (doc 19) makes this contract a binding STOP-SAFE gate.
