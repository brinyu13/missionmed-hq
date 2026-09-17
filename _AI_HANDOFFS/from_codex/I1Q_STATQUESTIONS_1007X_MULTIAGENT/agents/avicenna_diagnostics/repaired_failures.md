# Repaired Failures

## Scope

Record of repairs already present in the final integrated snapshot. Avicenna did not implement or modify these repairs.

## Verified Repaired Areas

### Privacy mechanics

The final suite passes the closed eight-class privacy taxonomy, source-complete pilot mechanics, exact-binomial lower-bound gates, deterministic normalization, Dr. J-only working-field allowlist, speaker mapping checks, identifying-anecdote suppression, and public excerpt and media denial. The focused and integrated privacy tests are green.

### Authentication and API boundaries

The final suite passes fresh-session checks, fail-closed resolver outage behavior, CSRF and trusted-Origin enforcement, static path containment, normalized production-mode demo denial, workflow-managed resource protection, answer isolation, restricted-source isolation, and sensitive mass-assignment rejection.

### UI bootstrap and workflow shell

The dashboard boot regression and all seventeen required internal workflow declarations pass. Accessibility landmarks, named controls, focus rules, reduced-motion behavior, responsive rules, and native keyboard activation pass static and JSDOM tests.

### Feature-flag contract

The current validator now requires all six flags:

- `internal_platform_enabled`
- `internal_review_enabled`
- `student_content_enabled`
- `student_release_enabled`
- `stat_adapter_enabled`
- `drills_adapter_enabled`

This repair is why the old four-flag evidence estate now fails closed instead of silently passing.

### Local datastore adapter mechanics

The untracked PostgreSQL repository passes fake-driver tests for dedicated transactions, actor verification, fixed parameterized RPCs, rollback paths, connection release, input allowlists, hash validation, duplicate identity rejection, and closed transaction handles.

## Changes Made By Avicenna

None outside this diagnostics packet.

## Tests

- Full local suite: `194` passed, `0` failed, `1` skipped.
- Evidence validator: reproducible failure with `19` errors.
- Syntax checks: `4` passed.

## Not Repaired

- Generated evidence has not been reconciled or regenerated.
- The generator still targets the old `0001` migration pair.
- The 1007X migration has not run against PostgreSQL.
- SQL channel policy enforcement and official leak-test binding are absent.
- Application and SQL review-assignment behavior still diverge.
- No canonical datastore or authentication adapter is wired into the server.

## Risks And Blockers

A green local suite proves that current assertions pass. It does not convert skipped database execution or uncovered contract gaps into repaired behavior.

## Paths

- Privacy: `i1q-question-platform/src/privacy.mjs`, `src/pipeline.mjs`, `tests/privacy-regressions.test.mjs`
- Security: `src/auth.mjs`, `src/server.mjs`, `tests/security-regressions.test.mjs`
- UI: `public/app.js`, `public/index.html`, `tests/ui.test.mjs`
- Datastore candidate: `src/postgres-repository.mjs`, `tests/postgres-repository.test.mjs`
- Validator: `src/validate-evidence.mjs`, `tests/evidence-validator.test.mjs`

## Confidence

High for local mechanics covered by the final suite. No production or medical-content confidence is asserted.

## Root Handoff

Preserve these green repairs while fixing the uncovered migration and evidence gaps. Do not weaken the validator to make stale evidence pass.
