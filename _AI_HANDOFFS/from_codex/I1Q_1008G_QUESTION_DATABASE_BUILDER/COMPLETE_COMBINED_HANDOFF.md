# I1Q-1008G Complete Combined Handoff

Status: **COMPLETE — RESTRICTED INTERNAL DATABASE, NOT RELEASED**

The completed I1Q-1008F Gold Set was transformed without additional extraction. All 16,690 questions became one database record each, in exact drill and question order. Repeated wording remains repeated data.

## Result

- 97 drills, 16,690 records;
- 3,054 primary and 13,636 follow-up questions;
- 10,123 ambiguity-marked records retained;
- 14,578 unique verbatim strings;
- 870 duplicate-string groups covering 2,982 rows;
- zero missing questions, zero regenerated IDs, zero rewritten questions;
- zero production mutations and zero learner releases.

## Restricted deliverables

The `TARGET_BOUNDARY` package contains:

- `question-database.sqlite`;
- `question-manifest.json`;
- `question-record.schema.json` and PostgreSQL schema;
- import-ready JSON, CSV, and SQL;
- counts by drill, topic, specialty, subject, and organ system;
- `questions-per-drill.md`;
- build and validation reports.

The restricted Question Database hash is `67d88833ae29a632b0b60277b2363f5994cf9574e6566002b48062eec413e4d5`. The occurrence projection root is `c5935a43fa64ca64662c0a5c25fa6001868265c1c896aeab69ca662db5e6b523`; the ordered database-record root is `8d3c59e433383788d9ac71b53d78f8cad3b8be343118f54d58ac921e835dacfc`.

## Metadata boundary

Calendar drill dates and medical taxonomy fields were absent from the Gold Set. They remain explicitly unknown rather than inferred. Existing question type, confidence, ambiguity, timestamps, and provenance were copied losslessly.

## Validation

All four imports reconcile at the typed record and provenance level. RFC 4180 spreadsheet validation passed for 16,690 rows and 40 columns. Restricted permissions, content hashes, rollups, duplicate preservation, source immutability, and no-production-mutation gates pass.

## Failure recovery

Two superseded generations were preserved in restricted quarantine. The first exposed a floating-point aggregate rejected by the canonical hasher; the second exposed PostgreSQL DDL/insert column drift during independent review. The accepted generation uses exact spacing arithmetic, exact DDL/insert parity, and one atomic SQL transaction. No source or production state was affected.

## Release state

This database is restricted internal infrastructure. It does not contain MCQs, answers, a canonical library, an ontology, a concept graph, or a learner-facing release. The intended future order remains: per-drill quizzes, per-drill MCQs, global search, then a future canonical library.
