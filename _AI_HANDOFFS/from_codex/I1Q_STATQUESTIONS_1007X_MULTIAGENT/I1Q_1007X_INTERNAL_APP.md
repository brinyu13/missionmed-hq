# I1Q-1007X Internal Application

## Verdict

`LOCAL SYNTHETIC APPLICATION OPERATIONAL, INTERNAL DEPLOYMENT BLOCKED`

## Implemented Workflows

The local shell exposes 17 internal workflows: dashboard, corpus inventory, source detail, privacy status, transcript evidence, extraction runs, candidate triage, question authoring, distractor review, evidence claims, editorial review, physician review, revision comparison, search and filters, release assembly, incidents, and audit trail.

Sixteen deterministic operational states are available in local synthetic mode. The UI uses API-backed rendering, exact revision hashes, explicit assignment acceptance, actor-scoped review controls, current evidence checks, credential and governance gates, protected answer fields, and disabled release commands.

## Integrated Repairs

The current candidate adds:

- session and CSRF bootstrap
- internal platform and review feature gates
- explicit draft save and candidate submission routes
- actor-scoped revision, source, evidence, reviewer, and review reads
- purpose-scoped answer and rationale retrieval for an accepted reviewer of one exact immutable revision
- closed-world response validation, denial and success audit events, no-store HTTP caching, and disabled verdicts when protected review content is unavailable
- source lineage bound across inventory, source record, privacy record, transcript artifact, and sanitized segment
- fail-closed ambiguous lineage behavior
- expired-evidence decision gating
- persistent single-path action feedback
- mobile navigation state and stronger focus contrast
- complete styles for core state, context, review, pagination, and transcript components

A three-source DOM regression proves that selecting the second inventory source cannot display the first source or first transcript segment. A separate DOM regression proves that an accepted editorial reviewer can inspect the exact answer, choice rationales, explanation, source anchors, and evidence claims without browser storage persistence.

## Safety Boundary

Local mode uses only non-clinical synthetic fixtures. It is blocked in production. No real candidate, medical approval, raw transcript, student data, answer map, or consumer activation is present.

## External Gate

The application lacks canonical auth, a wired Postgres repository, an approved host, GitHub deployment workflow, staging browser proof, assistive-technology proof, and human validation. Both internal flags and all student and consumer flags remain off.
