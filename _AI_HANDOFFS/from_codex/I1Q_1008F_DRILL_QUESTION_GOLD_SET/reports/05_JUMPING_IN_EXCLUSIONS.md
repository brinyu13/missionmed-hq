# Jumping-In Exclusions

Jumping-in is handled as a drill-opening state, not as an ordinary keyword filter. An explicit or ambiguous opening jumping-in prompt fails closed and is never promoted into the question set. Its learner response exchange remains part of the exclusion span until a verified transition into the normal student-call state.

The restricted record preserves:

- whether jumping-in was detected and excluded;
- prompt and answer-exchange source bindings;
- opening and closing timestamps;
- exclusion reason codes and confidence;
- the transition record into normal drill processing;
- an ambiguity queue entry when the opening boundary cannot be resolved safely.

Multiple opening exchanges are representable. Absence of the literal phrase does not fabricate a jumping-in event; ambiguous orientation speech is quarantined if it could otherwise contaminate the first student sequence. Excluded spans are validated not to overlap any retained question binding.

Across the final 97 shards, 88 opening jumping-in states were detected. The state machine excluded 3,303 prompt records and 2,135 answer-exchange records. Validation found zero overlap between an excluded jumping-in binding and a retained question binding. These are record/exchange counts, not distinct medical-question counts, and contain no transcript text or student identifiers.
