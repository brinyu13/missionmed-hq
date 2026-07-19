# I1Q-1008G Transform-Only Decision

Status: accepted for this ticket.

The I1Q-1008F Gold Set is immutable input. Every one of its 16,690 occurrence-specific question IDs is reused unchanged and produces exactly one database row. Wording is never an identity key, so repeated wording remains repeated data.

The accepted Gold Set does not contain calendar drill dates or specialty, subject, topic, subtopic, organ-system, or cognitive-level metadata. Those fields remain present as `null` or `UNCLASSIFIED`; filesystem dates, relative timestamps, question wording, learner answers, and provisional concept clusters are not used to invent labels.

`question_form`, source confidence, ambiguity status, ordering, timestamps, hashes, and provenance are copied losslessly. All records remain `RESTRICTED_ONLY`.

The copied Gold status `RETAINED` means only that the occurrence was retained in the accepted Gold Set. It is not medical approval, clinical validation, assessment approval, or release eligibility. Medical approval was not performed.

No database migration or import is authorized. The PostgreSQL file is an offline import artifact only. Consumer flags, learner release, and production mutation remain closed.
