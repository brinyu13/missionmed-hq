# D1-500 Timeline Production Launch Complete Combined Handoff

Generated: 2026-08-04T21:48:07Z.

This handoff includes the complete substantive content of every D1-500 Markdown report. The controlling result is PASS: Timeline Builder Version 1 is live, verified for its authorized Matrix population, and all 45 release units are closed.

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_EXECUTIVE_RELEASE_REPORT.md -->
# D1-500 Executive Release Report

Final checkpoint: 2026-08-04T21:48:07Z.

Result: **PASS — Timeline Builder is live, independently verified, and released to the authorized Matrix population.** The final Matrix metadata/source-custody unit is closed without changing the live Matrix runtime.

Progress is 45 of 45 fixed work units (100%). Engineering confidence is 100%. Confidence that the application is live online in Matrix is 100% because the live route, real Matrix navigation, real active-360 launch, persistence, and production health were directly verified.

## Live release

- URL: `https://missionmedinstitute.com/timeline/`
- Matrix entry: `https://missionmedinstitute.com/member-dashboard/#timeline`
- Source commit: `296d74272b520502f35b3d2d5bf7fb9a508a1e7c`
- Static release: `timeline-0c5cc515a76346d6`
- WordPress runtime: `timeline-wp-0fc51f8906decb8e`
- Railway deployment: `d9ec6013-35e3-4f33-a75d-4ac5d936eed2` (`SUCCESS`)
- PostgreSQL schema: `d1-timeline-db-500.1`
- Rollout: `timeline_enabled=true`, `rollout_stage=eligible_360`
- Eligibility authority: active LearnDash course `3893` access; a generic WordPress role is insufficient.

## Verified acceptance

- Local release: typecheck PASS; 616/616 tests PASS; package verification 23/23; sealed-release verification 62/62.
- Protected presentation: Founder package 28/28 hashes PASS; the accepted D1-409H-A1 integration adaptation remains unchanged.
- Founder-equivalent canary, approved administrator, and real active-360 student journeys passed.
- Real active-360 Matrix navigation, consent, create, save, reload, edit, logout/re-entry, and token-expiry fail-closed behavior passed.
- Representative eligible-student export passed; second-student list/read/write isolation passed.
- Non-360, revoked, anonymous, cross-student, and direct-Railway access were denied.
- Synthetic users and all related WordPress, LearnDash, Timeline membership, active document, and active grant state were removed or retired; the cleanup audit remains append-only.
- Railway health is 200/no-store and names the exact static release and schema.
- Timeline-scoped backups, isolated PostgreSQL restore, kill switch, and scoped WordPress rollback are ready and evidenced.
- No StoryForge, Arena, USCE Admin, DNS, CDN, or unrelated production application was modified by the Timeline release.

## Governing release seal

Founder authorization permitted the bounded Matrix-owner metadata and source-custody closure. Governing manifest commit `9e02238b195c548b10b5343a33bd247b5de0cee4` pins immutable source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0`, tree `291a1f4dff573e2f64635ddd069ac9275f3984ff`, and exact source references for all ten protected Matrix assets. The official Matrix guard passed 10/10 source and origin checks plus 9/9 applicable public checks with zero warnings or failures. The Critical Systems gate passed 142 checks with 3 documented warnings and 0 failures. No Matrix or unrelated production runtime was mutated by this closure.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_AUTHORITY_AND_SOURCE_MANIFEST.md -->
# D1-500 Authority and Source Manifest

## Authority

- Governing Constitution: MissionMed Platform v1, Revision 3.
- Engineering guardrail: MR-079.
- Founder authorizations consumed: M0 recovery; Critical Systems reconciliation; protected-system metadata amendment; provider backups; secret generation and server-side installation; Kinsta/WordPress/Railway deployment; synthetic fixtures; canary; eligible-360 activation; Browser and Computer Use; final Matrix metadata and source-custody closure.
- Canonical D1-500 implementation worktree: `/Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered`.
- Branch: `codex/d1-500-critical-registration`.
- Accepted source base: `49ba56dacd2cddfc2fb2241839d54a03e85bc271`.
- Final pushed source: `296d74272b520502f35b3d2d5bf7fb9a508a1e7c`.
- Governing Matrix manifest commit: `9e02238b195c548b10b5343a33bd247b5de0cee4`.
- Immutable Matrix source custody: commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0`, tree `291a1f4dff573e2f64635ddd069ac9275f3984ff`, remotely reachable from both recorded V1 Study Schedule branches.

## Sealed product

- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-0fc51f8906decb8e`.
- Payload: `artifacts/D1-500_KINSTA_RUNTIME_0FC51F89_RELEASE_PAYLOAD.tar.gz`.
- Payload SHA-256: `57ed9146f44c5d3684a5a873782c19c2da1f1ba4fb832b5708d71ec041fb73f4`.
- Runtime `release.php`: `e424edc9fd022dd225c84763707ef18dece073fddb433821e040bada5e25b820`.
- MU route: `258da3f2a5edf95899f921f5d617ef4f861260ca1be24dd5a8e1c1d4c5621403`.
- WordPress SSO plugin: `20e64ed5af824e8c265a6e9a048f3164967680ce5d752eeda519c66eec8cb6b6`.
- Matrix launch adapter: `a13c9cd6fa5420f19cc47691c09da07e79f9813b6ee774066f0d89230c131b8c`; origin and the operational versioned public URLs (`?ver=500.0.2` and `?ver=500.0.7`) match. The unused bare URL remains an older cached object and is not injected.

## Presentation authority

The Founder-supplied D1-409H visual master package verifies 28/28 protected hashes. The frozen HTML and CSS are unchanged. The active A1 JavaScript is the accepted integration adaptation, not an approximation or redesign. Its transition from the original frozen script must continue to be cited as accepted integration authority; the referenced `D1-411A_PROTECTED_HASH_MANIFEST.json` is absent and is recorded as a documentation gap, not a runtime mismatch.

## Authority result

The Critical Systems manifest registers the live Timeline release and passes its report-only gate at 142 PASS, 3 WARN, 0 FAIL. The separately delegated Matrix runtime lock is reconciled to immutable source and exact current production delivery in governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4`. Its official guard passes all ten origin checks and all nine applicable public checks with zero warnings or failures. Authority result: PASS; no open release unit remains.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_PRODUCTION_ARCHITECTURE_AND_TARGETS.md -->
# D1-500 Production Architecture and Targets

## Request path

1. An authenticated Matrix page loads the Timeline launch adapter.
2. The adapter shows the Timeline entry only when the server-provided eligibility state permits it.
3. `/timeline/` checks WordPress session, feature stage, administrator allowlist or active LearnDash course 3893 access, and consent.
4. Eligible pre-consent users receive the consent page; acceptance of `d1-500-v1` returns to the canonical route.
5. WordPress exchanges the session for a 120-second Timeline JWT and proxies same-origin `/timeline/api/v1/**` requests.
6. The Kinsta gateway signs requests with a server-only gateway secret; Railway rejects direct public access without it.
7. Railway maps the immutable WordPress user ID to a Timeline principal and executes through `timeline_authenticated` with FORCE RLS.

## Exact providers

- Kinsta company: `60d2928a-3253-4350-89e9-8f58a0827584`.
- Kinsta site: `abb6097b-9884-4b75-a9c7-d247728395cc`.
- Kinsta production environment: `a23bbbca-55af-4d03-9447-1015a1e18dc8`.
- Kinsta root: `/www/theresidencyacademy_209/public`.
- Railway workspace: `b6ab449c-1c87-46e0-95f8-3394c3ca7b14`.
- Railway project: `295b3d56-f555-4851-91f4-eb32d7dc88e1`.
- Railway production environment: `d0705d67-83d5-4b53-942d-3862d9906529`.
- API service: `12bfaf69-f883-42b5-a380-b6beea49f251`.
- PostgreSQL service: `134e537e-d48b-4452-acf6-8c3af2ce03db`.

## Routes

- Matrix: `https://missionmedinstitute.com/member-dashboard/#timeline`.
- Application: `https://missionmedinstitute.com/timeline/`.
- Token: `https://missionmedinstitute.com/wp-json/missionmed-timeline/v1/token`.
- Same-origin API: `https://missionmedinstitute.com/timeline/api/v1/**`.
- Health: `https://mission-timeline-api-production.up.railway.app/healthz`.

Secrets exist only in approved server-side locations. No secret value is stored in Git, payloads, screenshots, reports, or this package.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_IMPLEMENTATION_AND_CHANGE_LEDGER.md -->
# D1-500 Implementation and Change Ledger

## Source changes

- Added the production Railway API build, health identity, WordPress session/JWT/gateway adapter, same-origin API proxy, consent gate, LearnDash entitlement check, Matrix entry, and production release packaging.
- Added PostgreSQL identity, grant-hardening, role, RLS, migration, backup, and rollback assets.
- Repaired Railway build duplication without weakening typecheck or validation.
- Repaired anonymous handoff to explicit 303/no-store behavior.
- Repaired Matrix output injection to be nonrecursive after an experimental output-buffer build produced a blank Matrix response.
- Changed eligible Matrix navigation to use eligibility rather than post-consent access; route/token/API still require consent.
- Set consent GET/HEAD status explicitly to 200.
- Changed consent-page Referrer-Policy to `same-origin`, preserving the Origin needed for the same-site POST while withholding cross-site referrer detail.

## Production changes

- Created Kinsta and PostgreSQL backups.
- Applied six accepted PostgreSQL migration/role assets.
- Deployed Railway API deployment `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`.
- Installed immutable WordPress runtime `timeline-wp-0fc51f8906decb8e`.
- Enabled Founder/admin canary, then eligible-360 rollout after security gates passed.
- Final settings: enabled, stage `eligible_360`, approved admin ID `85`, eligibility verified, entitlement version `learndash-course-3893-live-2026-08-04`, consent `d1-500-v1`.

## Final authority closure

- Reconciled only `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` in commit `9e02238b195c548b10b5343a33bd247b5de0cee4`.
- Updated the exact five stale Matrix metadata groups and added immutable commit/tree/path/SHA-256 custody for all ten protected assets.
- Verified 10/10 immutable source, 10/10 private Kinsta origin, and 9/9 applicable public delivery hashes.
- Imported no unrelated dirty-worktree change and performed no live Matrix, CDN, WordPress, Kinsta, Railway, database, or DNS mutation during closure.

## Defects and disposition

- Duplicate Railway install: repaired.
- Missing provider secrets: Founder installed them server-side; no values entered evidence.
- Blank Matrix experiment: automatically rolled back, then repaired with bounded nonrecursive injection.
- Consent inherited 404: repaired.
- Consent POST rejected opaque Origin: repaired.
- Pre-consent eligible student lacked navigation entry: repaired.
- Synthetic residue: removed from WordPress, usermeta, LearnDash activity, Timeline programs, active documents, and active grants; principals are soft-DELETED and audit/outbox history remains.

No protected presentation redesign occurred.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_IDENTITY_ENTITLEMENT_AUTHORIZATION_AND_RLS.md -->
# D1-500 Identity, Entitlement, Authorization, and RLS

## Identity and entitlement

- Stable principal key: immutable Timeline UUID mapped to immutable WordPress user ID.
- Student authority: active LearnDash access to published Closed course `3893`.
- Generic login, subscriber role, direct URL possession, and client-side state are insufficient.
- Administrator authority: WordPress administrator plus the exact approved allowlist; final allowlist contains only user ID `85`.
- Remote persistence also requires consent version `d1-500-v1`.
- JWT lifetime is 120 seconds. Expired tokens fail closed; reloading under a valid WordPress session performs a new exchange and restores the correct principal context.

## Boundary results

- Anonymous token request: 401 `session_required`.
- Anonymous same-origin API: 401 `session_required`.
- Direct Railway API without gateway authority: 403 `GATEWAY_REQUIRED`.
- Non-360 and revoked personas: 403 `eligibility_required`, no Matrix entry.
- Account switch and destroyed session: prior token/context rejected.
- Second eligible student: first student's list/read/write targets were absent or 404.

## PostgreSQL controls

- Schema: `d1-timeline-db-500.1`.
- Tables: 20.
- RLS policies: 53.
- FORCE RLS omissions: 0.
- Public table privileges: 0.
- Runtime role: `timeline_authenticated`; least-privilege service/grant roles are separate.
- Administrator document access requires a bounded, expiring, independently audited resource grant.

## Fixture cleanup

Controlled WordPress IDs 1299-1303 were deleted after testing. Their posts, usermeta, LearnDash access rows, Timeline program memberships, active documents, and active grants are zero. The five Timeline principals are `DELETED`; three controlled documents are soft-`DELETED`; append-only audit and outbox evidence remains. Cleanup audit ID: `d1-500-fixture-cleanup-20260804`.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_BACKUP_RESTORE_AND_ROLLBACK_RECEIPT.md -->
# D1-500 Backup, Restore, and Rollback Receipt

## Backups

- Timeline-scoped Kinsta snapshot: `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- The exact oldest manual backup `B1-508 pre deployment 2026-07-31` was deleted only after the authorized inventory checks passed.
- Replacement Kinsta backup: `D1-500-PRE-20260804T161859Z`, READY, restore control present, retained until August 18.
- Railway PostgreSQL manual volume backup: READY, 843 MB, restore control present.
- Logical dump: `/Users/brianb/MissionMed_private_backups/D1-500/20260804T162100Z/timeline-pre-migration.dump`.
- Dump SHA-256: `65ae8326ee7a2ba7115486187ec978494c7beae714daeb32379c2873f89436cd`.
- PostgreSQL 18 custom archive isolated restore: PASS; temporary restore database removed.

## Rollback and kill switch

- Kill switch rehearsal: setting `timeline_enabled=false` and `rollout_stage=off` removed admission and returned `timeline_disabled`; exact eligible-360 settings were restored and read back.
- WordPress scoped rollback was exercised when experimental runtime `eeb4786` caused a blank Matrix response: the previous Timeline MU route/runtime pointer was restored, PHP restarted, cache purged, and Matrix health reverified before the corrected release proceeded.
- Current rollback target is limited to the Timeline plugin, MU route, immutable runtime pointer, Railway API deployment, and Timeline schema. It must not restore the whole Kinsta environment unless independently justified because that could affect unrelated applications.
- API rollback: disable admission first, then stop/redeploy the exact Railway service; health must identify the restored release before re-entry.
- Database rollback policy: preserve the successful additive schema unless verified corruption requires the provider backup or validated logical restore.

Current release pointer: `releases/timeline-wp-0fc51f8906decb8e`. Prior immutable Timeline runtimes remain available. Backup and scoped rollback readiness: PASS.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_FOUNDER_ADMIN_CANARY_REPORT.md -->
# D1-500 Founder and Administrator Canary Report

Result: PASS.

- Canary ran before general student activation.
- Founder-equivalent controlled persona reached the canonical route and exercised the production identity path.
- Approved real administrator reached the route under exact allowlist authority.
- Unapproved administrator was denied without an audited resource grant.
- Student access remained disabled during the initial canary stage.
- Create, save, reload, edit, export, logout/re-entry, stale-token rejection, and account-switch invalidation were exercised across the approved and controlled personas.
- Anonymous, second-user, and direct API denials passed.
- Production health named the correct static release and schema.
- Browser console critical errors: 0 in the recorded canary journeys.
- Protected visual authority remained materially unchanged.
- Kill switch and scoped rollback were available before student activation.

The controlled administrator was removed after testing. Final approved administrator allowlist: WordPress user ID `85` only.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_STUDENT_ROLLOUT_REPORT.md -->
# D1-500 Student Rollout Report

Student rollout state: **LIVE for eligible 360 students**.

## Canonical eligibility

- Source: production LearnDash active access to published Closed course `3893`.
- Entitlement version: `learndash-course-3893-live-2026-08-04`.
- Login or generic student role alone is insufficient.
- Revocation removes route/token access and the Matrix entry.

## Live journeys

- Real active-360 student saw exactly one native Timeline entry in Matrix.
- Matrix entry opened the 200 consent page, accepted `d1-500-v1`, and returned through 303 to the canonical app.
- The real student created a controlled event, saved it remotely, reloaded in another browser, edited it, and observed the updated persisted value.
- A representative second eligible student exported `Canary_D1_Timeline_2026-08-04.png`; the real active-student account's export button was profile-incomplete because Full name was blank, so export acceptance is based on the authorized representative eligible identity.
- The second eligible student could not list, read, or write the first student's records.
- Non-360, expired/revoked, anonymous, and direct-URL/direct-API personas were denied.
- Logout/re-entry and account switching invalidated the previous principal context.
- Token expiry changed the UI to read-only and preserved local draft state; a valid session reload re-exchanged identity.

## Discoverability

- Navigation entry: live at `/member-dashboard/#timeline`.
- Direct route: live at `/timeline/` for entitled users.
- Anonymous direct route: 303/no-store to the approved Matrix flow.
- Operational versioned public Matrix adapter hash: `a13c9cd6fa5420f19cc47691c09da07e79f9813b6ee774066f0d89230c131b8c` (`?ver=500.0.2` and `?ver=500.0.7`). The bare URL is not the injected runtime URL.

All controlled synthetic users and entitlement rows were removed after the tests. Eligible-360 activation remains enabled.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_LIVE_BROWSER_AND_VISUAL_VERIFICATION.md -->
# D1-500 Live Browser and Visual Verification

Result: PASS for the live Timeline application.

- Browsers: signed-in Chrome plus a separate in-app Browser profile.
- Viewports: desktop and narrow/mobile layouts.
- Real Matrix identity and native Timeline navigation verified.
- Consent, route return, home, Builder, Edit Timeline, Media, Export, persistence, and reload states inspected.
- Cross-browser persistence verified using the same real active-360 account.
- Separate eligible-student export verified.
- Anonymous redirect and denied-persona journeys verified outside the authenticated profiles.
- Critical console errors in acceptance journeys: 0.

The live mobile home view contains the accepted headline “Turn your medical journey into an interview-ready timeline,” Matrix return control, 360 member access badge, guided workflow, File Vault fast-start section, and the fixed bottom navigation. No material presentation regression was observed.

Protected visual verification:

- Founder visual package: 28/28 hashes PASS.
- Sealed release: 62/62 hashes PASS.
- Static release remains `timeline-0c5cc515a76346d6`.
- No Timeline source change altered the protected HTML or CSS.

Known documentation gap: the active A1 adapter references a `D1-411A_PROTECTED_HASH_MANIFEST.json` that is not present. The adapter itself is the accepted integration adaptation and matches the deployed sealed release; this gap does not change the browser verdict.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_DEPLOYMENT_AND_RELEASE_RECEIPT.md -->
# D1-500 Deployment and Release Receipt

- Final source: `296d74272b520502f35b3d2d5bf7fb9a508a1e7c`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-0fc51f8906decb8e`.
- Payload SHA-256: `57ed9146f44c5d3684a5a873782c19c2da1f1ba4fb832b5708d71ec041fb73f4`.
- Kinsta current pointer: `releases/timeline-wp-0fc51f8906decb8e`.
- Railway deployment: `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`, SUCCESS.
- Railway image digest: `sha256:bbbc05f29891faa3c11e7df84403957347fdd860db2e480cc66c7e267eaff202`.
- PostgreSQL deployment: `3a7f1381-74d4-4327-ac22-6a3e2483eec6`, SUCCESS.
- Schema: `d1-timeline-db-500.1`.
- Production option: enabled; `eligible_360`; canary IDs `[85]`; eligibility verified.
- Canonical route: `https://missionmedinstitute.com/timeline/`.

## Live byte verification

- Runtime: `e424edc9fd022dd225c84763707ef18dece073fddb433821e040bada5e25b820`.
- MU route: `258da3f2a5edf95899f921f5d617ef4f861260ca1be24dd5a8e1c1d4c5621403`.
- Plugin: `20e64ed5af824e8c265a6e9a048f3164967680ce5d752eeda519c66eec8cb6b6`.
- Matrix adapter origin and operational versioned public URLs: `a13c9cd6fa5420f19cc47691c09da07e79f9813b6ee774066f0d89230c131b8c`; the unused bare URL remains an older cached object.

## Verification

- Typecheck PASS.
- Automated tests: 616/616 PASS (129 TypeScript, 487 JavaScript).
- Package verification: 23/23 PASS.
- Release hashes: 62/62 PASS.
- Critical Systems: 142 PASS, 3 WARN, 0 FAIL.
- Matrix runtime lock: 10/10 immutable-source matches, 10/10 Kinsta-origin matches, 9/9 applicable public matches, 0 WARN, 0 FAIL; governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4`.
- Anonymous route: three consecutive 303/no-store/MISS responses.
- Direct Railway without gateway: 403 `GATEWAY_REQUIRED`.

Release payloads contain no secret value. The immutable payload is locally sealed and deployed; it is referenced by the protected manifest and final package checksum. Final metadata closure changed no live Matrix, Timeline, or unrelated production byte.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_LIVE_HEALTH_AND_OPERATIONS.md -->
# D1-500 Live Health and Operations

Current health: PASS.

- Endpoint: `https://mission-timeline-api-production.up.railway.app/healthz`.
- HTTP: 200.
- Cache-Control: `no-store`.
- Service: `mission-timeline`.
- Version: `timeline-0c5cc515a76346d6`.
- Schema: `d1-timeline-db-500.1`.
- Railway deployment: `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`, SUCCESS.
- Public direct data endpoint without gateway: 403 `GATEWAY_REQUIRED`.
- Anonymous same-origin API: 401 `session_required`.

Operational controls:

- Admission kill switch: WordPress `missionmed_timeline_settings`.
- Feature-off values: `timeline_enabled=false`, `rollout_stage=off`.
- Current values: enabled, `eligible_360`.
- Rate limit: 30 requests per 60 seconds.
- JWT TTL: 120 seconds.
- Kinsta current release is an atomic symlink to an immutable directory.
- Structured server logs use request IDs and avoid password/secret output.
- Backup and scoped rollback receipts are in the companion recovery report.

The real Matrix and app journeys remained functional after fixture cleanup. No unrelated-application regression was observed.

Post-authority-closure recheck at 2026-08-04T21:49Z: the anonymous canonical route returned the approved 303 Matrix handoff; Railway health returned `ok=true`, service `mission-timeline`, version `timeline-0c5cc515a76346d6`, and schema `d1-timeline-db-500.1`; Kinsta current still resolved to `releases/timeline-wp-0fc51f8906decb8e`.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_KNOWN_LIMITATIONS_AND_FOLLOWUPS.md -->
# D1-500 Known Limitations and Follow-ups

## Resolved release authority

The former delegated Matrix runtime-lock blocker is closed. Founder-authorized governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4` binds all ten protected assets to immutable source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0` and exact live delivery. The official guard passed with zero mismatch, warning, or override. Overall result is PASS.

## Non-blocking documentation

- The accepted A1 JavaScript adaptation references `D1-411A_PROTECTED_HASH_MANIFEST.json`, which is absent. Add the exact accepted adapter transition manifest in the next authority-maintenance release.
- The operational versioned Matrix adapter URLs serve the sealed current bytes. The unused bare asset URL still serves an older long-lived cached object; it is not injected by the current route. A future cache-maintenance action may remove it, but it is not a launch blocker.
- The real active-360 account had a blank Full name, so its export button was profile-incomplete. Export passed through a separate authorized eligible-student fixture that used the same production authorization and export path.
- JWT TTL is intentionally short at 120 seconds. Expiry changes the app to read-only and preserves local work; a valid-session reload re-enters. A future release may add silent refresh only if separately authorized and tested.
- The controlled real-student pilot record remains associated with the approved test account unless the Founder asks for deletion through the normal product flow. No synthetic account or entitlement residue remains.

## Founder action required

None for Version 1 release closure. Future Version 2 product evolution follows the normal MissionMed accepted-baseline, implementation, local-verification, deployment-gate, and authorized release workflow.

---

<!-- source: /Users/brianb/MissionMed_worktrees/D1-500-Critical-Registered/_AI_HANDOFFS/from_codex/D1-500_TIMELINE_PRODUCTION_LAUNCH/D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md -->
# D1-500 Critical Systems Reconciliation

Final closure addendum: the later Founder authorization for Matrix metadata and source custody was applied in governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4`. All ten protected Matrix assets match immutable source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0`, private origin, and public delivery where applicable. The Matrix guard passes with zero warnings/failures and the Critical Systems gate passes 142/3/0. No live Matrix runtime mutation occurred. Any approval-request language below is retained as historical pre-authorization evidence and is superseded by this addendum.

Historical checkpoint note: the approval request and pre-mutation language in
this report were satisfied by the Founder and superseded by protected-system
registration commit `b75c789`. The resulting Critical Systems gate passes 140
checks with 3 warnings and 0 failures; no protected application runtime was
changed by the metadata amendment.

Prepared: 2026-08-04T14:42:16Z
Scope: read-only authority, source, private-origin, public-CDN, rollback, and
Matrix recovery-source reconciliation. No Kinsta, WordPress, Matrix, USCE,
Arena, CDN, R2, DNS, manifest, or other production state was changed.

## Verdict

The two Critical Systems asset failures are **not unexplained or unauthorized
production drift**.

| Check | Central pin | Verified live SHA-256 | Classification |
|---|---|---|---|
| `cdn_usce_admin_live` | `115aa040f57a0fdaf3f49f6e398423b93635633b901eb01d7ffc85142e91ddd4` | `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c` | Primary: stale/incomplete manifest. Secondary: source-repository synchronization problem. |
| `cdn_arena_live` | `19a519f583439056af56bcf513f2fb26f872369c458ac958093bde48d9acb12a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | Primary: stale/incomplete manifest. Secondary: source-repository synchronization problem. |

Both current objects were created by documented, bounded production changes,
but those accepted bytes were never ratified into the active central manifest.
The current central `LIVE/` files match neither the old pins nor the live
objects, so they must not be used as deployment source.

## USCE proof

- Private R2 and public CDN are byte-identical: 172,888 bytes, SHA-256
  `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`.
- Public `Last-Modified`: `2026-06-29T19:40:48Z`.
- The retained post-deployment artifact is byte-identical:
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/CX-OFFER-337-USCE-ADMIN-LOGIN-COPY/_AI_BACKUPS/MM-USCE-ADMIN-ARCHIVE-PERSISTENCE-20260629T194005Z/usce_admin-after.html`.
- The deployment report records the exact transition from `115aa040...ddd4`
  to `9b6eade1...c29c`, live marker validation, the pre-change backups, and the
  rollback hash:
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/CX-OFFER-337-USCE-ADMIN-LOGIN-COPY/_AI_HANDOFFS/from_codex/MM-USCE-ADMIN-ARCHIVE-PERSISTENCE_FIX_REPORT.md`.
- Repeated fresh public downloads were byte-identical and contained all four
  required Critical Systems markers.

## Arena proof and safety caveat

- Private R2 and public CDN are byte-identical: 975,417 bytes, SHA-256
  `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`.
- Public `Last-Modified`: `2026-07-15T04:29:49Z`.
- The accepted source is byte-identical:
  `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4006/candidates/arena/arena.html`.
- The retained rollback capture is also byte-identical:
  `/Users/brianb/MissionMed_AI_Sandbox/_ROLLBACK/U1_GR_2518R_SHARED_20260715T154252Z/files/arena/arena.html`.
- Y1-CAM-4005R records the exact Arena deployment and final live hash;
  Y1-CAM-4006 preserves and verifies that same Arena baseline without changing
  it; Y1-CAM-4007 independently validates the accepted source hash.
- Repeated fresh public downloads were byte-identical and contained all three
  required Critical Systems markers.

This observed/accepted-byte reconciliation is **not an Arena safety
certification**. Y1-CAM-4008A separately records an open credential-logging P0
in the accepted `7bb0...` runtime and an undeployed redaction candidate. D1-500
must not edit, deploy, or imply remediation of Arena.

## Prior authority implementation

Commit `f23d7daeb289c7340ec4ab1903956cc4cfec282a` on pushed branches
`b1-502-storyforge-production-deployment` and
`codex/b1-503-storyforge-product-recovery` already implements these exact two
metadata pins and explains that neither USCE nor Arena was mutated. It is not in
`origin/main` and contains broad StoryForge registration, so it must **not** be
cherry-picked wholesale. Only the two asset-check changes may be reproduced in
a clean, scoped authority commit after Founder approval.

## Matrix recovery-source resolution

The Matrix source gap is resolved without a runtime override or production
copy. Immutable Git commit
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0`, tree
`291a1f4dff573e2f64635ddd069ac9275f3984ff`, contains all ten current lock
assets at the exact canonical paths and hashes. It is remotely reachable from:

- `origin/codex/v1-study-schedule-production-connected-rc`;
- `origin/codex/v1-study-schedule-8010d-validation`.

The official Matrix guard was run from a disposable `git archive` extraction of
that immutable commit. All ten local/source hashes, production-origin hashes,
and requested public hashes matched; result: **PASS**. No Matrix source or live
asset was edited. A Matrix runtime-lock override is neither needed nor
recommended.

The clean local J1 File Vault implementation worktree independently contains
the same ten exact bytes, but immutable commit `60e7169b...` is the preferred
recovery reference because it is remotely reachable. These histories are
parallel; `60e7169b...` does not descend from J1.

## Exact bounded manifest amendment

After Founder approval, change only the following existing asset-check fields
in a clean D1-500 authority worktree. Set `last_updated_utc` to the amendment
commit time. Do not copy the broad StoryForge commit and do not touch live
objects.

```json
{
  "asset_checks": {
    "cdn_usce_admin_live": {
      "approved_sha256": "9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c",
      "local_source_note": "Metadata-only reconciliation to the documented 2026-06-29 archive-precedence repair. Private R2, public CDN, and retained post-deploy artifact are byte-identical. Central LIVE source remains SOURCE_SYNC_UNRESOLVED. No USCE runtime mutation is authorized by this amendment."
    },
    "cdn_arena_live": {
      "approved_sha256": "7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705",
      "local_source_path": "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4006/candidates/arena/arena.html",
      "local_source_note": "Metadata-only reconciliation to the Y1-CAM-4005R deployed and Y1-CAM-4006/4007 validated baseline. Private R2, public CDN, accepted source, and retained rollback capture are byte-identical. Central LIVE source remains SOURCE_SYNC_UNRESOLVED. Open Y1-CAM-4008A credential-logging P0 remains unresolved; this pin is not a safety certification. No Arena runtime mutation is authorized by this amendment."
    }
  }
}
```

The amendment must also record Matrix recovery reference
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0` and its ten-of-ten guard PASS as
source recovery evidence. It must not change any Matrix approved hash, version,
production path, or public URL.

## Timeline protected-system registration required before installation

Timeline is not yet represented in the active central Critical Systems
manifest. The same clean authority commit must register, while feature and
access remain off:

- system `timeline_builder`, owner `MissionMed Matrix / Founder`;
- runtime owner `railway_mission_timeline`, project
  `295b3d56-f555-4851-91f4-eb32d7dc88e1`, production environment
  `d0705d67-83d5-4b53-942d-3862d9906529`, API service
  `12bfaf69-f883-42b5-a380-b6beea49f251`, PostgreSQL service
  `134e537e-d48b-4452-acf6-8c3af2ce03db`, start command `npm start`, health
  path `/healthz`;
- WordPress owner `missionmed-timeline-sso` and MU owner
  `missionmed-timeline-route.php`;
- canonical routes `/timeline/`, `/timeline/api/**`, and
  `/wp-json/missionmed-timeline/v1/token`;
- protected source paths under `packages/mission-timeline/`,
  `wp-content/plugins/missionmed-timeline-sso/`, and the Timeline MU route;
- exact release `timeline-wp-c228658bc70bc395`, payload SHA-256
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`;
- default-off WordPress option `missionmed_timeline_settings` with
  `timeline_enabled=false` and `rollout_stage=off`;
- canonical eligibility authority: active LearnDash access to published Closed
  course `3893`, never WordPress login or generic role alone;
- anonymous redirect, feature-off denial, direct-API denial, health/release,
  canary, eligible-360, ineligible, revoked, logout, account-switch, and
  cross-student browser checks;
- fresh Kinsta and Timeline PostgreSQL backups before mutation; kill switch by
  setting Timeline rollout off; rollback limited to the Timeline plugin, MU
  route, immutable release pointer, API deployment, and Timeline-owned schema.

## Rollback-safe procedure after approval

1. Use the existing clean D1-500 worktree; do not touch the dirty canonical
   checkout.
2. Apply only the two asset-check changes, Matrix recovery-reference metadata,
   and Timeline registration above.
3. Validate JSON and review the exact protected-manifest diff.
4. Run the Critical Systems gate with network enforcement and the Matrix guard
   against an immutable extraction of `60e7169b...`.
5. Require zero asset, route, import, source, origin, or public mismatch.
   Protected-path dirtiness outside the clean worktree remains a global warning
   and cannot be relabeled as clean.
6. Commit and push the bounded authority amendment for review.
7. Before any production install, create and verify fresh Kinsta and Timeline
   PostgreSQL backups and confirm the exact provider targets.
8. Install only the sealed Timeline payload feature-off/access-off. Stop on any
   new failure or unexpected hash. Roll back only Timeline if verification
   fails.

## Founder decision required

The evidence is sufficient to amend stale metadata and register Timeline, but
the governing protected manifest cannot be changed under the current
reconciliation-only authorization. The release block remains active until the
Founder approves the bounded authority amendment and the clean gates pass.

Exact authorization wording:

> I, Brian, authorize D1-500 to modify the protected MissionMed Critical
> Systems manifest in the existing clean D1-500 worktree only. The amendment
> may (1) replace the USCE Admin approved SHA-256 with
> `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`,
> (2) replace the Arena approved SHA-256 with
> `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`,
> (3) add the source-sync and Arena-P0 notes exactly recorded in
> `D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`, (4) record immutable Matrix
> recovery source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0`
> and its ten-of-ten guard PASS without changing any Matrix approved hash or
> production asset, and (5) register Timeline Builder's exact owners, protected
> paths, routes, Railway/PostgreSQL targets, release identity, default-off
> controls, checks, backups, kill switch, and rollback described in that
> report. This is metadata and registration authority only; it does not
> authorize any USCE, Arena, Matrix, CDN/R2, HQ, Supabase, DNS, Kinsta,
> WordPress, or other production mutation. Apply the amendment as a bounded
> reviewed commit, run the Critical Systems and Matrix gates, and stop on any
> new failure or unexpected hash. The Arena pin acknowledges observed accepted
> bytes and does not certify or waive the open Y1-CAM-4008A P0.
