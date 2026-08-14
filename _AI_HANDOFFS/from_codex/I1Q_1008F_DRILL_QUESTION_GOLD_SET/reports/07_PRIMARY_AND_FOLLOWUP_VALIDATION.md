# Primary and Follow-Up Validation

The first retained Dr. J medical prompt after a verified student call is the sequence primary. Later transcript-grounded Dr. J prompts in the same alternating question/answer cycle are follow-ups until a new student is called or the sequence ends. Rapid follow-ups inside five seconds remain representable; the accepted live runtime’s five-second suppression is comparison evidence, not a Gold rule.

Multi-part prompts in one transcript record receive distinct code-point source spans and ordered identities. Repeated wording remains distinct within and across sequences and drills because identity includes drill, sequence, role, order, and provenance. A correction of a prior question is preserved as a later ordered prompt when the source supports it; it is not globally deduplicated.

Every retained question records verbatim oral wording inside the restricted boundary. Minimal normalization is optional and limited to authorized filler, punctuation, fragment-join, unambiguous-pronoun, and transcription-punctuation operations. Ambiguous wording remains verbatim-only and quarantined. No answer, clinical fact, answer choice, textbook rewrite, approval, or release status is invented.

The final 97-shard set contains 3,054 primary and 13,636 follow-up questions, or 18.30% primary and 81.70% follow-up. Every one of the 16,690 questions retains verbatim oral wording and exact transcript provenance; zero optional normalized rewrites were emitted. There are 10,123 ambiguity-marked questions, all restricted. Sagan's final semantic sample passed 194/194 and Osler's deduplicated panel passed 91/91.
