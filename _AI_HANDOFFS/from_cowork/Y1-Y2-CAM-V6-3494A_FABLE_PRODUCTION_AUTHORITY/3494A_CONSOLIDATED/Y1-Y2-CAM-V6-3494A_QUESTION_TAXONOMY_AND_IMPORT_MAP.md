# Y1-Y2-CAM-V6-3494A — QUESTION TAXONOMY + IMPORT MAP

## 1. Normalized taxonomy (30 tags, multi-tag by law)

`CORE(pin) · TRADITIONAL · PERSONAL(≡personality/self-awareness) · BACKGROUND · MOTIVATION · SPECIALTY · PROGRAM_FIT · BEHAVIORAL · SITUATIONAL · CONFLICT · TEAMWORK · LEADERSHIP · FAILURE · MISTAKE_SAFETY · ETHICS · STRESS_PRESSURE · STRENGTHS · WEAKNESSES · HOBBIES · CAREER_GOALS · CV_BASED · RESEARCH · CLINICAL_EXPERIENCE · PATIENT_INTERACTION · COMMUNICATION · ADVERSITY · RED_FLAGS · HEALTHCARE_POLICY · CREATIVE_UNUSUAL · CLOSING`

Rules: 1–4 tags per question; BEHAVIORAL is a style flag AND a tag; CORE is a pin, not a topic; RED_FLAGS marks questions requiring careful coaching (never "gotcha" framing); tags are curation-editable, IDs are not.

## 2. Import pipeline

1. Parse manifest (`_MVP_QUESTION_IMPORT_MANIFEST.md` — authoritative extraction, verbatim text incl. [sic]). 2. Create records with stable IDs + provenance (`source`, `source_number`). 3. Apply seed tags from manifest. 4. Pin CORE-01..10 (`core_priority=true`). 5. Mark `behavioral=true` for all BEH + MR142 items tagged BEH. 6. Set `followup_eligible=true` default except CLOSING. 7. Asset status: `planned` for CORE×{Kelly,Woods}, `none` elsewhere. 8. Emit import report (counts: 10 CORE + 142 MR142 + 41 BEH + 1 collection record). **Exclusions enforced by the parser**: the three "Questions to Ask…" sections are structurally skipped and asserted absent (CI test greps for "Questions to Ask" content in the corpus and fails if found).

## 3. Duplicate review (explicit later process)

Curation UI (Mentor/Admin): side-by-side candidates (string-similarity suggestions), actions LINK-EQUIVALENT / LINK-COMPOUND / LINK-NEAR-DUP / DISTINCT; links change surfacing only (deduped drawer with "also appears as"), stats accrue to link target; nothing deleted; full audit. Founder-core pins always win surfacing.

## 4. Revisioning

`canonical_text` immutable per revision; MissionMed edits create `rev:2` with `edited_from` provenance; sessions record the revision used; [sic] flags cleared only via revision.
