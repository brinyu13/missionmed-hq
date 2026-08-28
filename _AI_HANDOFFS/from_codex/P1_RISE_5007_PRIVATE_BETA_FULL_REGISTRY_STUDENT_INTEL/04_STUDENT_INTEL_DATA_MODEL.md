# Student Intel Data Model

Migration `rise/sql/006_student_intel.sql` adds:

- `beta_notice_acknowledgments`
- `student_intel_submitter_identities`
- `student_intel_submissions`
- `student_intel_sources`
- `student_intel_moderation_events`
- `student_intel_verification_runs`
- `student_intel_corroborations`
- `student_intel_canonical_promotions`

Identity is split from the student-visible submission. The submission stores only an HMAC-derived subject key; the canonical subject reference and display name remain in the private identity table. Anonymous-to-students reports expose neither field through student SQL projections or APIs.

The model preserves original and display claims separately, source type/URL/label, observed and submission dates, visibility, moderation lock, verification state, high-priority state, attempt timing, corroboration count, immutable moderation history, and immutable promotion-candidate provenance.

Student Intel is foreign-keyed to any visible `program_specialty_id`; no specialty or research-depth restriction is encoded.

`rise/sql/006_student_intel.down.sql` revokes runtime access only. It deliberately retains all submissions, identities, sources, audit rows, and promotion candidates.

Status: **physical disposable PostgreSQL rehearsal passed; production unapplied**.

