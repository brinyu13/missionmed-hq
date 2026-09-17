# I1Q 1006 Staging and Canary

## Local verification

- VERIFIED: Local synthetic app ran at `http://127.0.0.1:4176/` during QA.
- VERIFIED: Health endpoint returned `200` with mode `LOCAL_SYNTHETIC_DEMO`.
- VERIFIED: The same service started without demo mode reports `AUTH_ADAPTER_REQUIRED` and returns `401` for protected APIs.
- VERIFIED: Browser tests covered all twelve workflows, three viewport widths, autosave, keyboard activation, disabled medical approval, disabled release assembly, and console health.

## Staging status

BLOCKED: No canonical staging environment was identified or authorized.

BLOCKED: Candidate SQL was not previewed or applied.

BLOCKED: Canonical auth and datastore adapters are absent.

BLOCKED: STAT and Drills staging adapters were not installed.

VERIFIED: No protected runtime was changed to simulate staging.

## Canary status

BLOCKED: No canary was deployed.

VERIFIED: All candidate feature flags default false.

VERIFIED: No cache purge, CDN write, R2 write, WordPress change, Railway change, Supabase write, or live smoke test occurred.

## Required deployment sequence

After registration, decision, auth, datastore, privacy, and staging gates are resolved:

1. Create approved backup and rollback records.
2. Validate the forward-only migration on an approved preview branch.
3. Deploy the internal service behind canonical authentication.
4. Run API, RLS, security, accessibility, and load suites.
5. Execute compensating rollback and verify health.
6. Re-deploy internal canary with all consumer flags off.
7. Validate checksums, logs, and health.
8. Enable only the approved internal audience.
9. Keep STAT, Drills, and student-release flags off until adapter and content gates pass.

## Rollback proof

VERIFIED: A compensating disable migration and hash manifest exist.

BLOCKED: Rollback was designed but not executed. Therefore rollback is not proven.

## Gate 12

FAILED TO ENTER: Staging and canary gates were not attempted because prerequisites are external and protected.
