# Validation and Safety

Validation directly compared every database row with the Gold Set in drill and question order. Question ID, sequence identity, role, verbatim wording, nullable normalized value, timestamps, transcript and Nodes hashes, binding roots, and provenance all reconcile.

JSON, CSV, SQL, and SQLite each independently produced 16,690 typed records with identical projection and record roots. Schema validation passed for all 16,690 rows in every format.

Duplicate wording was measured but never collapsed: 870 duplicate-string groups cover 2,982 rows. All 10,123 ambiguity-marked rows remain present. The 97 drill rollups sum to 16,690, and every requested metadata rollup includes the `UNCLASSIFIED` bucket rather than dropping absent values.

Average timestamp spacing uses consecutive question starts in question order, including zero gaps. Each drill retains the exact numerator and denominator plus a deterministic decimal string.

The source Gold Set contract and shard-set root remained unchanged. No source, production, consumer, learner, registry, database, migration, Drive, or deployment mutation occurred.
