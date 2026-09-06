# I1Q 1006 Legacy v4 Recovery

## Verified current evidence

- VERIFIED: The checked-in v4 seed migration documents 845 rows.
- VERIFIED: The migration contains 845 `dataset_questions` insert statements.
- VERIFIED: The migration names `/Users/brianb/MissionMed/universal_questions_v4.json` as historical source provenance.
- VERIFIED: That external static JSON was not available at the checked path and was not accessed elsewhere.
- PROTECTED: The legacy Dr. J QuestionBank directory was not entered.
- BLOCKED: A read-only canonical v4 export is not authorized by current I1Q governance.

## Recovery mapping

VERIFIED: `fixtures/legacy_v4_mapping.synthetic.json` defines mapping without embedding legacy medical content:

- dataset version to legacy dataset version
- question ID to legacy question ID
- prompt and A-D choices to immutable revision content
- answer and explanation to internal answer-bearing revision fields
- historical join key to dataset version plus question ID plus content hash

## Required import outputs

Each recoverable row must create or link:

- legacy source record
- concept or explicit placeholder
- variant group
- item
- immutable item revision
- import map
- exposure priority
- risk and quality flags
- retro-review queue state

## Safety triage

The future queue must rank:

1. Known or suspected answer-key defects
2. High historical exposure
3. Thin or absent explanations
4. Unsafe or implausible distractors
5. Duplicate or near-duplicate families
6. Expired or unsupported claims
7. Low lineage completeness

VERIFIED: Previously live status is not an approval signal in the candidate design.

VERIFIED: No legacy item is marked approved or release eligible.

## Reconciliation status

- Expected from checked-in provenance: 845
- Reconciled against canonical static export: 0
- Imported: 0
- Historical join test against real attempts: not run

BLOCKED: Gate 9 remains closed until static export authorization, row reconciliation, and historical join validation are complete.
