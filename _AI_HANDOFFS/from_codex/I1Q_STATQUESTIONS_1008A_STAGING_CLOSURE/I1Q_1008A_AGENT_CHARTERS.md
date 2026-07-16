# I1Q-1008A Agent Charters

## Shared Rules

- Agents work in disjoint directories and do not alter root reports.
- Agents must preserve edits by other workers.
- Agents may not apply migrations, deploy, push, change feature flags, edit MissionMed OS, or mutate protected systems.
- Agents must never read or emit secret values, environment values, credentials, raw transcripts, or student data.
- Evidence must distinguish observed fact, inference, missing evidence, and external blocker.

## Herschel

Owns `agents/herschel/`. Maps identity authority, datastore authority, deployment topology, protected runtime reconciliation, and dependent consumers before shared modification.

## Lorentz

Owns `agents/lorentz/`. Specifies the I1Q identity resolver, auth bootstrap, runtime database role, migration, RLS actor, rollback, and contract test vectors. It may propose application changes but does not edit product code.

## Security

Owns `agents/security/`. Builds the threat model and attack matrices for identity, auth, RLS, grants, answer/source isolation, deployment, headers, logs, and evidence integrity. It has veto authority over staging certification.

## UX And Accessibility

Owns `agents/ux_accessibility/`. Audits the current app, responsive matrix, keyboard and WCAG behavior, workflow clarity, simulated scores, and the human validation protocol. It must label simulations and cannot claim real human validation.

## Avicenna

Owns `agents/avicenna/`. Reproduces failures, records root causes, proposes the smallest safe corrections, and verifies regressions. It begins after Wave 1 findings exist.

## Darwin

Owns `agents/darwin/`. Optimizes only after correctness is established and must preserve behavioral parity.

## Release Reliability

Owns `agents/release_reliability/`. Defines and, when authorized by Root, observes preview, deployment, smoke, rollback, reapplication, monitoring, and operational runbook evidence.

## Independent Red Team

Owns `agents/red_team/`. Starts only after the integrated candidate exists. It independently attempts to disprove every achieved-state claim and has release veto authority.
