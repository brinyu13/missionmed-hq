# Exact Inputs for the B1-507 Full Production Megarun

Date: 2026-07-29

## Verified source

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- HEAD: `82669485c187cd3127ab2c84cb79864d827e0aef`
- Application-source commit: `df42c5e05dd11f63c7ea17f99127e43e2d03347c`
- Upstream SHA: `0bd7da46b5f25122ad53cd73f8eaf6eb1f546409`
- Divergence: 18 ahead, 0 behind
- Deterministic release candidate: `v-0892c26c62d96206`
- Starting state for B1-507A: clean; only the dossier is added.
- Production baseline: commit `6f45dbbd2150ba11000236a4959f70434f6edb77`, release `v-0912286e7dfc2327`

The final megarun must reverify every value before mutating anything. It must not start from upstream as if upstream contains the candidate.

## Authority documents to attach

At minimum attach or provide the exact repository paths for:

1. V5 canonical HTML: `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
2. V5.5 prototype and r2: `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/storyforge-v5.5-prototype.html` and `storyforge-v5.5-prototype-r2.html`
3. B1-504A Product Authority Lock, Phase 1 Blueprint, API/Data/Flag Contracts, R2 Lifecycle, Provider Bakeoff, Acceptance/Rollout/Rollback, and Combined Handoff
4. B1-504B Infrastructure Lock, Integration Contract, Routing/WordPress Spec, Database/RLS Spec, R2 Spec, Provider Lock, Feature-Flag Authority, Deployment/Rollback Runbook, and Combined Handoff
5. B1-505C Delivery Execution Plan
6. B1-506A Fable Authority Amendment, Executable SQL/Contracts, Readiness/External Gates, and Combined Handoff
7. B1-506B Fable Binding Rulings
8. B1-506C Complete Combined Handoff, Dormant Deployment Preflight, Implementation Handoff, and Rollback Runbook Amendment
9. All B1-507A documents, especially the Complete Combined Handoff, Blocker Register, Deployment Sequence, and Acceptance Criteria

The final prompt must include new bounded rulings/receipts for FG-1, RP-8 equivalence/selection, C1-C4, C5 if needed, and 360 enrollment authority before their dependent work.

## Systems Codex must access

1. local Git worktree and terminal;
2. GitHub `brinyu13/missionmed-hq`;
3. Railway project `missionmed-storyforge-v5`, production environment, API service, and PostgreSQL;
4. MyKinsta MissionMed Institute live site and SSH/SFTP or approved deployment channel;
5. live WordPress administrator session;
6. Cloudflare account, Workers/routes, and R2;
7. OpenAI organization/project/security/data-control/billing surfaces;
8. supported desktop/mobile browsers and assistive technologies;
9. current MissionMed protected-runtime/system-manifest writer and regression routes.

## Environment and secret names

Values must come from authorized secret managers/fresh receipts and must never be printed.

### Existing runtime

- `STORYFORGE_DATABASE_URL`
- `STORYFORGE_JWT_SECRET` or approved JWKS variables
- `STORYFORGE_JWKS_URL`
- `STORYFORGE_JWT_ISSUER`
- `STORYFORGE_JWT_AUDIENCE`
- `STORYFORGE_ALLOWED_ORIGINS`
- `STORYFORGE_BASE_PATH`
- `STORYFORGE_PUBLIC_ORIGIN`
- `STORYFORGE_MATRIX_BASE_URL`
- `STORYFORGE_ORIGIN_API_ONLY`
- `STORYFORGE_STATIC_DIR`
- `STORYFORGE_WP_BOOTSTRAP_PATH`
- `STORYFORGE_WP_TOKEN_PATH`
- `STORYFORGE_TOKEN_REFRESH_SKEW_SECONDS`

### Phase 1 voice/storage/provider

- `STORYFORGE_R2_ENDPOINT`
- `STORYFORGE_R2_REGION`
- `STORYFORGE_R2_BUCKET`
- `STORYFORGE_R2_ACCESS_KEY_ID`
- `STORYFORGE_R2_SECRET_ACCESS_KEY`
- `STORYFORGE_R2_SIGNED_URL_TTL_SECONDS`
- `STORYFORGE_TRANSCRIBE_PROVIDER`
- `STORYFORGE_OPENAI_API_KEY`
- `STORYFORGE_TRANSCRIBE_PRIMARY_MODEL`
- `STORYFORGE_TRANSCRIBE_FALLBACK_MODEL`
- `STORYFORGE_VOICE_FORCE_OFF`
- `STORYFORGE_VALID_COHORTS`
- `STORYFORGE_VOICE_DAILY_MINUTES`
- `STORYFORGE_SWEEPS`
- `STORYFORGE_AUDIO_RECONCILIATION`
- `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED`

### Build/deploy and guarded migration

- `STORYFORGE_EXPECTED_COMMIT`
- `STORYFORGE_DEPLOY_GIT_COMMIT`
- `STORYFORGE_SOURCE_MODE`
- `STORYFORGE_SOURCE_ARCHIVE`
- `STORYFORGE_SOURCE_ARCHIVE_SHA256`
- `STORYFORGE_DB_BACKUP_ID`
- `STORYFORGE_DB_BACKUP_RECEIPT`
- `STORYFORGE_DB_BACKUP_RECEIPT_SHA256`
- `STORYFORGE_RAILWAY_PROJECT_ID`
- `STORYFORGE_RAILWAY_ENVIRONMENT_ID`
- `STORYFORGE_RAILWAY_DATABASE_SERVICE_ID`
- `STORYFORGE_EXPECTED_PGHOST`
- `STORYFORGE_EXPECTED_PGPORT`
- `STORYFORGE_EXPECTED_PGUSER`
- `STORYFORGE_EXPECTED_PGDATABASE`
- `STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER`
- `STORYFORGE_EXPECTED_USER_COUNT`
- `STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT`
- `STORYFORGE_FOUNDER_USER_ID`
- `STORYFORGE_APP_DB_PASSWORD`
- `STORYFORGE_MIGRATION_CONFIRM`
- provider-injected `RAILWAY_*` and `PG*` target variables required by the guarded script

`STORYFORGE_PLATFORM_OFF` appeared in an earlier packet but is not consumed by current runtime source. The megarun must not claim it as an exercised kill switch.

## Founder actions that may occur

- provide the bounded FG-1 decision;
- provide/approve the consented 40-passage, six-accent human corpus;
- approve/confirm MissionMed’s OpenAI BAA/Healthcare Addendum/ZDR/retention posture;
- complete OpenAI, Cloudflare, Kinsta, GitHub, or Railway MFA if challenged;
- provide or approve representative Founder/admin/eligible-360/ineligible identities;
- ratify the final 360 enrollment authority/receipt;
- authorize remote writes, migration apply, cutover, provider activation, reconciliation `on`, and enrolled-360 activation at explicit gates.

Codex must pause only at the exact MFA/decision/irreversible boundary and continue all independent lanes.

## Production URL and audience

- URL: `https://missionmedinstitute.com/storyforge/`
- Audience: Founder, WordPress administrators, and currently enrolled 360 Match Mentorship students.
- Public/anonymous access: prohibited.

## Required Phase 1 features

Browser microphone permission and recording; pause/resume/stop/cancel; segmented authorized upload; private temporary storage; near-live primary/fallback transcription; transcript preservation/editing; story save; RP-8-selected assembly; permanent private attachment; canonical replay; 90-second Keep Waiting/Save Without Audio; reload/restart/delayed recovery; temporary cleanup; explicit/lifecycle deletion; weekly dry-run and approved automatic permanent-audio deletion; audit, RLS, privacy, accessibility, rollback, and controlled cohort activation.

## Deferred features

Student-facing AI assessment, scoring, rewriting, themes, analogies, coaching, Socratic questions, and mentor intelligence. No required audio-lifecycle capability may be relabeled deferred.

## Blockers the megarun must resolve

The exact 18 rows in `B1-507A_BLOCKER_REGISTER.md`: GitHub custody, stale manifest, WordPress multipart/DELETE, replay conformance, FG-1, RP-8, R2, production migrations, RP-7, human corpus, 360 entitlement authority, FABLE-C1 through C4, PROBE-C5, fresh backup/restore, and real-service/device/accessibility QA.

## Completion standard

The megarun succeeds only when every checkbox in `B1-507A_PRODUCTION_ACCEPTANCE_CRITERIA.md` is evidenced at the exact production SHA/release and the authorized audience is live. The required final declaration is:

```text
STORYFORGE PHASE 1 IS FULLY LIVE
```

If any mandatory capability remains default-off, unconfigured, fake-tested only, authority-blocked, or unavailable to enrolled 360 students, it must return the exact partial rollout state instead.
