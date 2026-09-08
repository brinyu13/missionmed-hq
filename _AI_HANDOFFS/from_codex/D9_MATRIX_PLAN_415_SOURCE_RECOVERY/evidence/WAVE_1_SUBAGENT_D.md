# Wave 1 Subagent D — Packaging, CI, Release, and Rollback Analyst

## ROLE

D9-415 Wave 1 Subagent D — Packaging, CI, Release, and Rollback Analyst.

## SCOPE

Read-only analysis of repository tooling, Matrix guard, CI, deterministic packaging, release lineage, rollback, and Scheduler CDN risk. No state changed.

## FILES AND SYSTEMS INSPECTED

Repository packages/ignore/deploy/rollback/validation files, Matrix lock/guard, D9-410 deployment/testing reports, Y1-CAM-4005 candidate/backup, and D9-415 requirements.

## FACTS ESTABLISHED

- `origin/main` has no plugin source and no GitHub workflows.
- Root build is `echo build-placeholder`; nested HQ package only provides runtime start.
- Existing deploy tooling is not a source-linked plugin pipeline.
- Matrix guard is a selected-file backup/upload verifier, not a complete source/package/staging pipeline.
- `preflight --brian-approved` can return success even with warnings/failures and must never be a CI pass condition.
- Scheduler mount consumes mutable unpinned CDN HTML outside the package.
- Production controller `23da5c...` matches Y1-CAM-4005 candidate exactly; active lock `c0a538...` matches its pre-change backup exactly.
- The Y1-CAM-4005 candidate changes entitlement evaluation by adding authority-mode validation, requiring `revocation_checked`, and accepting a LearnDash-current-access authority mode. This is auth/entitlement-significant.
- A repository-wide backup-name gate would hit inherited unrelated top-level MU backup files; D9-415 validation must be scoped without modifying unrelated protected source.

## CONFLICTS

- Production/lock controller mismatch.
- Observed drift is entitlement-significant while D9-415 forbids auth/entitlement changes.
- Global backup scan versus inherited unrelated repository state.

## P0 BLOCKERS

- Do not import/commit/tag/package/attest while the controller conflict remains unresolved.
- A trusted immutable tag requires a quiescent cutoff and recapture after the final authorized production write.
- Protected-hash CI cannot pass against the active lock today.
- Generic `--brian-approved` is not an adequate exact authority decision.

## P1 RISKS

- Guard uploads are sequential and partial-release prone.
- Selected-file backups are incomplete rollback artifacts.
- Network-dependent guard checks are nondeterministic for CI.
- Branch metadata can contaminate package bytes.
- Scheduler CDN can drift independently.

## RECOMMENDED MAIN-AGENT ACTIONS

- Keep the freeze.
- Obtain exact authority for `23da5c...`, Y1-CAM-4005, and a no-further-write cutoff.
- After clearance, use a stdlib-only clean-tree deterministic packager with canonical ordering/timestamps/modes/metadata and no network/deploy action.
- Build twice in separate temporary directories.
- Add least-privilege read-only CI; never invoke production guard modes or `--brian-approved` in CI.
- Preserve both Calendar CSS hashes and require D9-416 to pin Scheduler HTML lineage.

## EVIDENCE PATHS

Matrix lock/guard, D9-410 deployment/testing reports, repository package/deploy files, and Y1-CAM-4005 candidate/backup.

## CONFIDENCE

High for tooling/packaging facts and controller provenance; medium-high for release implications pending authorization/cutoff.

## UNRESOLVED QUESTIONS

Y1-CAM-4005 authorization, production quiescence, exact cutoff, scoped backup-scan rule, artifact retention, and Scheduler CDN authority.

