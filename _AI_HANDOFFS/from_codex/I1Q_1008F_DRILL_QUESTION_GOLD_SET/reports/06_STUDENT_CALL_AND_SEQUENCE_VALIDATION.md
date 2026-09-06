# Student Call and Sequence Validation

Student-call detection is transcript-speaker-grounded. The accepted alias catalog is derived per drill from non-instructor speaker labels, with controlled first-name aliases. Full names are preferred; ordinary-word names require stronger next-speaker confirmation. A name repeated inside learner speech cannot open a sequence because only a verified Dr. J turn can initiate the call state.

A retained sequence must contain exactly one primary question. A student call followed only by administration or nonmedical instruction is preserved as an exclusion decision, not an empty Gold sequence. Each answer span joins one exact question in the same drill and sequence; Dr. J self-answers, overlaps, interruptions, delayed answers, and a new student arriving before closure receive explicit status or ambiguity flags rather than fabricated learner answers.

Semantic validation recomputes every identity, join, count, timestamp bound, and ordered root. It requires contiguous sequence order, one primary at position one, exact follow-up ordering, and equality between primary-question and retained-sequence counts.

The frozen set contains 3,054 retained student-call sequences and exactly 3,054 primary questions. All 97 shards have contiguous sequence and question order, one primary per retained sequence, valid question/answer joins, and globally unique content-derived IDs. Sagan's structural/provenance sample passed 194/194. Student names and sequence mappings remain restricted.
