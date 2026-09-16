# Existing Student Program Data Contract

Canonical truth remains `rise.student_program_states`, keyed by the authenticated pseudonymous subject and release-bound program identity. The implementation does not create an administrator-owned list.

The additive migration introduces:

- `gold_starred boolean not null default false` on the existing relationship;
- indexes supporting subject, gold, and updated ordering;
- a minimal `student_program_subjects` identity projection for admin discovery;
- owner-scoped identity writes and operator-only reads under forced RLS;
- operator SELECT on student program state, with no operator UPDATE/DELETE path.

Admin detail joins current canonical catalog context at read time. Private student notes are deliberately omitted from administrator responses. The student-facing and administrator-facing gold indicator read the same column.
