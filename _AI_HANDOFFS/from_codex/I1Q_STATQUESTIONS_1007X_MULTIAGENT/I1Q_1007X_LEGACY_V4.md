# I1Q-1007X Legacy v4 Reconciliation

## Verdict

`STATIC_V4_RECONCILED, IMPORT AND MEDICAL APPROVAL NOT PERFORMED`

The canonical static v4 migration contains exactly 845 question rows. A separate current STAT CDN mirror contains 3,961 runtime items. The two collections use disjoint identifiers and must not be conflated.

No production database was read or changed. No legacy content was imported, approved, retired, replaced, or published.

## Authority And Method

Brian authorized a read-only hashed export of the canonical v4 dataset and non-student aggregate exposure metadata. The source used here was the repository migration:

`supabase/migrations/20260420111000_stat_dataset_ingest.sql`

The migration was executed only in a temporary local PostgreSQL cluster with minimal local roles and a local `dataset_registry` dependency. The cluster contained no production credentials or student data. Aggregate queries and a restricted temporary NDJSON export were used for reconciliation. The export contains medical content and was not committed, printed, or included in a handoff.

## Static v4 Result

| Measure | Observed |
| --- | ---: |
| Migration SHA-256 | `9bbd46e329933f1ebe5642e48238f9e0ac9f29bd772ad40675123e1d2c313f0e` |
| Inserted rows | 845 |
| Distinct question IDs | 845 |
| Dataset versions | 1 |
| Dataset version | `v4` |
| Required-field nulls | 0 |
| Missing explanations | 0 |
| Base items | 517 |
| Vignette-suffix items | 328 |
| Vignettes with a base sibling | 328 |
| Bases with a vignette sibling | 328 |
| Duplicate-prompt groups | 11 |
| Duplicate full-content groups | 0 |
| Rows with duplicate choices | 0 |
| Minimum prompt length | 29 |
| Maximum prompt length | 263 |
| Minimum explanation length | 49 |
| Maximum explanation length | 238 |
| Canonical dataset registry hash | `eae68f7c33948b8a2df53315d0b533fa2e24683c068d4bcac3aea7d2c8fd1b15` |
| Restricted NDJSON rows | 845 |
| Restricted NDJSON bytes | 459,647 |
| Restricted NDJSON SHA-256 | `066df25d6c46e2e04904ab13ea2aab2c8b5631c6ff76551a0e6d24d4664008cb` |

All 845 static rows store `answer = A`. This is a verified source property. It is not, by itself, proof of student-facing answer-position bias because STAT sealed-pack choice permutation may transform presentation order. The adapter must preserve the frozen choice-order contract and prove that answer mapping remains server-only.

The migration references `universal_questions_v4.json`, but that source file was not present in the worktree or the canonical `/Users/brianb/MissionMed` checkout. The migration is therefore the currently observed canonical static source for this reconciliation.

## Current CDN STAT Mirror

The current read-only CDN mirror is structurally different from the static 845-row v4 dataset.

| Artifact | Count | SHA-256 |
| --- | ---: | --- |
| Runtime array | 3,961 | `b38297a6bad8fdf30bc4e4ac326664132e2e55a14c81a01b2ae0238a6ac2ef7c` |
| Lookup object | 3,961 | `7e3783c0ffffb4f468581fe892cd6dc749ab76e5b5e3c334f9ae0976fce2198d` |
| Index groups | 4 | `b87aba6404dd56a8c399753d0988bcf036a7dfef6046325f3869fe0dbea76ca3` |

Runtime records expose exactly these observed keys:

`choices`, `correct_answer`, `difficulty_score`, `id`, `question`, `step`, `subject`, `tier`, `type`

Additional verified aggregates:

| Measure | Observed |
| --- | ---: |
| Distinct runtime IDs | 3,961 |
| Duplicate runtime-ID groups | 0 |
| Four-choice records with keys A through D | 3,961 |
| Records containing `correct_answer` | 3,961 |
| Correct-answer values matching a choice key | 3,961 |
| Records with `correct_answer = A` | 3,961 |
| Subjects | 21 |
| Question types | 10 |
| Step levels | 2 |
| Tiers | 3 |
| Lookup keys matching runtime IDs | 3,961 of 3,961 |
| Static v4 IDs intersecting runtime IDs | 0 |

The index artifact groups identifiers by `question_type`, `step_level`, `subject`, and `tier`. The lookup artifact contains metadata only and contains no observed `correct_answer` or `explanation` fields.

PROTECTED: the answer-bearing runtime artifact is part of the current STAT estate. This run did not modify it. Its exposure and sealed-pack role require independent security validation before any I1Q adapter can be enabled.

The all-`A` source property is therefore present in both observed collections. This is a mandatory adapter and assessment-science audit queue, but it is not proof that students see a fixed answer position because sealed-pack generation may permute choices and maintain a separate server-only answer map.

## Identity And Mapping Ruling

The I1Q compatibility boundary must use composite `dataset_version + question_id` identity. For the static dataset, the initial lineage identity is `v4 + question_id` and the immutable source hash is derived from the exact nine-field row.

Each future mapping must preserve:

- original dataset version and question ID
- exact nine-field source projection
- source and content hashes
- historical-attempt join identity
- base and vignette sibling relationship
- duplicate-family membership
- import and review event history
- retirement or replacement lineage without destructive mutation

No Item, Item Revision, Concept, or Variant Group identity was written in this run. Those records require the additive I1Q datastore and versioned import adapter.

## Review Queues

The 845 rows are legacy content, not approved I1Q revisions. They require independent editorial and credentialed physician review on exact immutable revisions before I1Q release eligibility.

The following deterministic queues can be generated after import:

- all-answer-A transformation audit
- eleven duplicate-prompt groups
- 328 base and vignette sibling pairs
- answer and medical-safety review
- dated or guideline-sensitive claim review
- explanation quality review
- distractor quality review
- exposure-priority review using authorized aggregate telemetry
- lineage repair where a historical source cannot be recovered
- retirement and replacement candidates

No medical-risk or quality ranking is claimed here because no credentialed medical review and no authorized aggregate exposure export were available in this run.

## Gates

| Gate | Status |
| --- | --- |
| Canonical static count | PASS, 845 |
| Static source hash | PASS |
| Required nine fields | PASS |
| Unique composite identity | PASS for the observed static source |
| Current CDN mirror distinguished | PASS |
| Historical join mapping | SPECIFIED, not persisted |
| Medical review | NOT RUN |
| Assessment-quality review | NOT RUN |
| I1Q import | NOT RUN |
| STAT consumer enablement | OFF |
| Student publication | BLOCKED |

## Conclusion

The actual static legacy v4 count is 845. The 3,961-item current CDN mirror is a separate dataset and cannot be used as a replacement count or silently joined by identifier. Both remain unchanged.
