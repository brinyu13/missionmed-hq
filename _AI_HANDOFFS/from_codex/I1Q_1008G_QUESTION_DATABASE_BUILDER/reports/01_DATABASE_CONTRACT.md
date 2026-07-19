# Database Contract

The existing occurrence-specific `question_id` is the primary key. It is never regenerated from wording. The only occurrence uniqueness constraint beyond the primary key is `(drill_id, question_order)`. No wording, normalized wording, metadata label, or semantic hash has a uniqueness constraint.

Each record contains:

- drill and sequence identity plus exact order;
- verbatim wording and the existing nullable minimally normalized field;
- microsecond start/end timestamps;
- existing question form, confidence, and ambiguity evidence;
- explicit unclassified placeholders for metadata absent from the Gold Set;
- transcript and Nodes hashes, binding roots, processing receipt, source aliases, and record hash.

The import SQL contains no `ON CONFLICT DO NOTHING`, deduplication, merge, release grant, migration wrapper, or production connection logic. A collision fails closed.
