# Metadata Limits

The accepted Gold Set directly supports question type, extraction confidence, and ambiguity. Those fields are copied without reinterpretation.

It does not contain authoritative calendar drill dates, specialty, subject, topic, subtopic, organ system, or cognitive level. Every database row still includes those columns, but the current values are `null` or `UNCLASSIFIED` with status `SOURCE_METADATA_ABSENT_UNCLASSIFIED`.

This is intentional. Guessing from wording would create a new medical classification layer and conflict with the ticket's no-ontology and no-rewrite constraints. The schema permits later occurrence-level enrichment through a separate governed process without changing question identity or wording.

No metadata value implies medical correctness, physician review, assessment approval, rights clearance, or learner-release eligibility.

The copied source status `RETAINED` means retained as a Gold Set occurrence only. Medical approval was not performed.
