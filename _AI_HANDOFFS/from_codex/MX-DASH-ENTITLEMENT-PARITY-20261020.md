# Matrix LearnDash entitlement parity

Status: PARTIAL - entitlement repair LIVE and verified; genuine student StoryForge workspace acceptance BLOCKED by separate unmapped identity. No overall completion claim.

Authority DR-518, canonical OS0b4fc6ed4d0b5849a6543c27e4126ac4198f9f02. Product branch codex/mx-dash-entitlement-parity-20261020 based on ffb44cb; exact three-path SHARED:ENTITLEMENTS source lease f684a188-1b22-4e4f-94d7-01094d5719ab epoch6338. Prior registry6336 failed closed, released/provider0; unrelated default CURRENT restored exactly. Filing lease6337 normally released/provider0. Dirty work preserved.

Root cause: central gate resolves paid student full=true but legacy DrJ deny wins for StoryForge. Native StoryForge SSO separately relies on CAM360-only enrollment; current IV Prep-only student proves eligibility_required despite Matrix full=true. Verified course options3893/5227, both published closed courses. TargetsA both qualifying; targetsB/C only Arena Basic4204 with neither qualifying course. No individual workaround or enrollment write.

Only production delta: class-mmed-access-gate.php, before SHA222f24843c3a67a660a6353ee1621529f5b786a651eeb8003baebf103aae40af. Current LearnDash checks replace cached/list-only qualification; a new grant precedes cached free tier. Existing DrJ full-grant filter recognizes same qualifier; student-only StoryForge entitlement filter shares it. Existing explicit restricted security, mentor/admin, globally disabled/unreleased features, non-enrolled/other-program behavior, authentication/nonce/token gates retained. No app internals or shared-auth source changed.

Untouched production hook dependencies pinned in DR-518: DrJ30308cdf1b62942b42afb05b57fd91318767ef2cb62df75c7fcb134d8d118d67 and SFSSO97b706bc3393c35a41b93854a7adc08cfaae744a3bf8dd2ece9bb3b21692af07. All15 runtime assets preflight origin/public/local PASS, manifest unchanged. Canonical preflight helper used because source-base historical helper has resolved empty-array defect; no helper modification.

## Before / after

- TargetA: active3893+5227; before full=true but Matrix StoryForge restricted_role. After tier=enrolled/full=true, StoryForge Matrix allowed, SSO allowed, zero released Matrix catalog apps denied. Existing StoryForge identity mapping present.
- Actual Complete-only account: before Matrix full=true, SSO eligibility_required. After full=true and SSO allowed. Its separate StoryForge identity mapping is absent.
- TargetsB/C: current LearnDash grants only Arena Basic4204, no3893/5227; unchanged full=false and StoryForge SSO eligibility_required. Enrollment correction, if required, is an operator-owned separate action; no records changed here.
- Current registered restrictions, administrator full access, mentor boundaries and explicit restricted security retained. DrJ-only safe local fixture retains restriction. No synthetic production account or enrollment was created.

## Verification and deployment

- Source implementation commit462cf86fa8f5ae9d187d5e09cea26a12407f72ea pushed nonforce; independent exact staged candidate ca2f72a2d03414298fd88b8fccb733f2cb2cf85e8a97351a016dc1584ef550d9 approved. Security reviewer independently reran PHP lint and120 assertions: 360-only, Complete-only, both, new enrollment in each, DrJ-only, registered, admin, anonymous; stale free tier, historical expired/revoked enrollment, direct-route/REST, explicit security, mentor/admin and unreleased controls.
- One deployed file: wp-content/plugins/missionmed-hub/includes/class-mmed-access-gate.php. Before222f24843c3a67a660a6353ee1621529f5b786a651eeb8003baebf103aae40af -> after9e8e7899db00a00874bb6918765469e67792b27567a5e37f1bdc266518d7c283. Atomic same-filesystem rename after remote PHP lint, candidate SHA, current preimage and both dependency SHA checks. Independent live hash/readback PASS.
- Rollback VERIFIED: /www/theresidencyacademy_209/private/mx-dash-parity-rollback-20261020-6338/class-mmed-access-gate.php, exact222f preimage. Restore only this file atomically under current protected release authority; verify hash and access gates. No backup restore was performed.
- All15 canonical Matrix runtime guard local/origin/public PASS before and after; no locked runtime, cards/art, seasonal rail/status, Option C, first paint, app source or runtime-manifest change. Central resolver is not a manifest asset entry; runtime lock UNCHANGED.
- Actual anonymous Matrix302 and protected REST401; independent anonymous StoryForge token request403 csrf_failed. Dynamic StoryForge route no-store/max-age0, Cloudflare DYNAMIC and Kinsta BYPASS. No static/CDN asset changed, no broad cache purge needed. New full grants precede cached Matrix free tier; existing legitimate LearnDash cache-invalidation hook retained.

## Exact remaining blocker and owner routing

The genuine existing student QA browser at /storyforge/ changed from "360 access is not currently active" to "Authentication failed (503)". Read-only response diagnosis confirms /wp-admin/admin-ajax.php error code storyforge_identity_unmapped. This is SSO's existing identity prerequisite after successful entitlement, not a remaining course denial. No token issued, UUID invented, identity metadata written or legacy provisioning helper invoked by this patch. Full StoryForge workspace/browser acceptance remains OPEN; no Administrator substitute.

StoryForge canonical sole production owner chat019fa173-f8b9-7571-9a0f-37746c728b1e notified once with exact evidence for owner-scoped canonical identity admission. Current DR-518 excludes identity writes and does not transfer ownership. The independent reviewer confirms PARTIAL, no rollback trigger from this fail-closed mapping error alone.

Final exact task provider release readback is recorded in /Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/MX-DASH-ENTITLEMENT-PARITY-20261020/provider-closeout.json. Registry6336/6337 were normally released with zero task claims/waiters; source6338 is the only product claim to close. No unrelated leases are released.
