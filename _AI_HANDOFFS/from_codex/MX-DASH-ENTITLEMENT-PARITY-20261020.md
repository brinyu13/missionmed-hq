# Matrix LearnDash entitlement parity

Status: implementation candidate, production unchanged pending independent review.

Authority DR-518, canonical OS0b4fc6ed4d0b5849a6543c27e4126ac4198f9f02. Product branch codex/mx-dash-entitlement-parity-20261020 based on ffb44cb; exact three-path SHARED:ENTITLEMENTS source lease f684a188-1b22-4e4f-94d7-01094d5719ab epoch6338. Prior registry6336 failed closed, released/provider0; unrelated default CURRENT restored exactly. Filing lease6337 normally released/provider0. Dirty work preserved.

Root cause: central gate resolves paid student full=true but legacy DrJ deny wins for StoryForge. Native StoryForge SSO separately relies on CAM360-only enrollment; current IV Prep-only student proves eligibility_required despite Matrix full=true. Verified course options3893/5227, both published closed courses. TargetsA both qualifying; targetsB/C only Arena Basic4204 with neither qualifying course. No individual workaround or enrollment write.

Only production delta: class-mmed-access-gate.php, before SHA222f24843c3a67a660a6353ee1621529f5b786a651eeb8003baebf103aae40af. Current LearnDash checks replace cached/list-only qualification; a new grant precedes cached free tier. Existing DrJ full-grant filter recognizes same qualifier; student-only StoryForge entitlement filter shares it. Existing explicit restricted security, mentor/admin, globally disabled/unreleased features, non-enrolled/other-program behavior, authentication/nonce/token gates retained. No app internals or shared-auth source changed.

Untouched production hook dependencies pinned in DR-518: DrJ30308cdf1b62942b42afb05b57fd91318767ef2cb62df75c7fcb134d8d118d67 and SFSSO97b706bc3393c35a41b93854a7adc08cfaae744a3bf8dd2ece9bb3b21692af07. All15 runtime assets preflight origin/public/local PASS, manifest unchanged. Canonical preflight helper used because source-base historical helper has resolved empty-array defect; no helper modification.

Tests, deployment, rollback, actual student verification and provider closeout: pending.
