# PSV Quality + Deep Research Boost Guarded Deployment Report

Date: 2026-09-21

## Outcome

PSV v1.2.0 is live and feature-off safe at exact pushed commit `aadf3aec4114342f67e28837cd56705712f4e7b0` under DR-331/DR-332.

The bounded writer calibration is frozen as `mmps-prompt.v5`; no further writer-prompt iteration occurred in this engineering lane. Program Discovery P1 remains live. The deployless PSV Admin foundation and Deep Research Boost Stage A/guarded Stage B code are installed. Boost remains intentionally disabled because its two dedicated server-side keys are absent, and Stage B has no verified provider configuration.

## Exact release custody

- ZIP SHA-256: `3341f804f796ef8016f6b0f95f9c900517cb9104cc51b4edd046df4cdc8f51ea`
- Manifest SHA-256: `c72d32b37e34d08e0e220c31510549d2b640dd905041c2969c437007875e32f6`
- Live manifest: 28/28 PASS; zero extra and zero missing files
- Production PHP lint: 25/25 PASS
- Private package: `/www/theresidencyacademy_209/private/psv-deploy-aadf3ae-1.2.0/`
- Immediate rollback: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-1.2.0-aadf3ae-20260921T212505Z/live-retired`

## Guarded promotion state delta

The first atomic promotion reached the known Kinsta CLI PHP exit-139 condition after the additive installer had completed. Its guard restored exact v1.1.0 and released PATH lease epoch 3631. Read-only containment established schema v8, six immutable Production prompt rows and otherwise unchanged state. The final epoch-3632 retry performed only an exact atomic code swap, made no further database write and released successfully.

Additive production state:

- PSV schema: 6 → 8
- Prompt versions: 0 → 6; all six explicit `PRODUCTION`
- Research missions: new table, 0 rows
- Research artifacts: 0 rows
- Existing counts unchanged: roots7, runs32, library9, audit86, jobs1, job_items5, provider_attempts54, similarity_fingerprints9, similarity_buckets576, edit_revisions2

No File Vault table/code, RISE code/data, ROOT, run, library document, provider attempt or student prose was changed.

## PSV Admin acceptance

Authenticated live verification as `brinyu` showed:

- canonical `PSV Admin` home/shell;
- `PSV Admin → Prompt Management`;
- six immutable Production prompt contracts;
- exact-body/version/status/creator/change-note display;
- structured Fable package import into Draft only;
- explicit Draft → Testing → Production workflow and retained rollback contract;
- security-critical ROOT, grounding, privacy and authorization rules explicitly outside editable prompt text;
- Research Queue present and empty.

Production generation resolves an explicit active prompt version and retains code fallback to the last known-good baseline. Prompt changes no longer require plugin deployment.

## Privacy, regression and owner boundaries

- Dedicated OpenAI key: defined/nonempty by boolean-only check; value never inspected.
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined.
- Test constants: undefined.
- `MMED_PSV_MISSION_KEY_K1`: absent.
- `MMED_PSV_RETURN_KEY_K1`: absent.
- Boost mode: off.
- Auto-return: off.
- Anonymous PSV bootstrap/admin: HTTP 404.
- Anonymous Stage B namespace: HTTP 404.
- Public home and PSV flag: HTTP 200.
- RISE health: HTTP 200, current registry `rise_registry_acgme_2026-09-20_50d08ea6f2da`, source rights current.
- Protected File Vault sentinels unchanged: controller `e60b2695…`, repository `a9784255…`, scanner `6b5cf0eb…`, current-owner mutable JS `3f9f0152…`, retained immutable/versioned JS `0a3caa65…`, CSS `87c932a3…`.
- Stage A hands only validated program evidence to the RISE owner; PSV never writes RISE directly.
- Stage B remains physically unregistered until its dedicated return key, global enablement and a dated/reviewer-attributed provider verification all exist.

## Remaining human-only gate

Stage A cannot be activated until MissionMed secret custody installs `MMED_PSV_MISSION_KEY_K1` server-side. Stage B separately requires `MMED_PSV_RETURN_KEY_K1` and a provider-specific verified configuration; no current provider qualifies. Neither key may be printed, pasted into chat, committed or copied from another application.

After secure installation, activate Stage A in `members` or bounded `allowlist` mode, verify one signed mission/manual-return/quarantine/admin-QA/RISE-owner-handoff/fresh-RISE-readback cycle, then consider Stage B only for an independently verified provider. Until then, the production feature is safely installed but Boost remains off.

## Independent production verdict

Fresh independent read-only production verification returned **PASS** with no P0/P1. It independently matched exact commit/source/live custody, schema v8, all six Production prompt families, empty research tables, privacy and Boost fail-closed state, public/anonymous route boundaries, current File Vault sentinels, RISE health/source rights, the immediate rollback and authoritative zero active PSV lease.
