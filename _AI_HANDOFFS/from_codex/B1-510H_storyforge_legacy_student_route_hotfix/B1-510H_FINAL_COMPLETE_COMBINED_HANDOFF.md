# B1-510H Final Complete Combined Handoff

## Final verdict

**STORYFORGE CANONICAL STUDENT ROUTING HOTFIX BLOCKED — FOUNDER ACTION REQUIRED**

The exact production defect is proven and the smallest safe routing/entitlement
candidate is implemented, tested, committed, and clean. It was not deployed.
A route-only cutover would fail all eligible students at the next identity
gate, because the two-account pilot never established durable population sync
for the broader 360 audience.

## Authority and baseline

- worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`;
- branch: `codex/b1-503-storyforge-product-recovery`;
- starting HEAD: `fd7df97db10a2ac5ea2fa9de6f85b3dd7f2c459d`;
- implementation commit:
  `a8a156e4b6c213bb667cc6b0959be90692e4b8b9`;
- upstream: `origin/codex/b1-503-storyforge-product-recovery`;
- no push or pull request.

The current production product is unchanged:

- URL: `https://missionmedinstitute.com/storyforge/`;
- release: `v-a790ce4e3168384f`;
- release commit: `1bb6e8b917d6993c4af08e9ff2408313835f123d`;
- index SHA-256: `2071b79c42260b97b5369e26c7662b517d0ed67948e4d15d848e38c574fe5263`;
- app SHA-256: `9aaf9d3670eea84ff41aa84859384c4bd945b753c80dd880601a9637fa8361df`;
- route SHA-256: `2837cde673a9bb66d334c903053926c51cddf1582f6d52b698ab20e4964b616a`;
- release PHP SHA-256: `01c6871355683ee87ce9e648480bb226ce0d393ef05cae77700943e086552f2f`;
- Railway deployment: `d5b98049-e24e-45e7-8c1f-6c6dbaef0714`, SUCCESS/RUNNING,
  one replica.

## Exact root cause

The protected Matrix runtime deliberately unlocks its legacy static
StoryForge module for course-3893 students. Its locked JavaScript contains the
twelve sample stories and renders the exact Founder-reported markers. The
isolated StoryForge SSO plugin has a separate adapter that redirects
`#storyforge` to `/storyforge/`, but it was enqueued only after an exact
two-user pilot allowlist passed.

Thus Founder/admin pilot identities received the current application while
ordinary enrolled students received the active protected Bootstrap Demo.
This is not cache drift, a service worker, a role-specific bundle, an iframe,
or a silent current-app fallback.

## Canonical entitlement

- LearnDash course ID: `3893`;
- authority: live `mmhq_cam_build_entitlement()`;
- authority source/live SHA-256:
  `548d0b30ab341948c59411408f9b8aabd175941d0b5ca3a0a0f90af300f11c98`.

The existing function applies current enrollment, expiry, revocation,
restriction, and purchase-state rules. No 360 WordPress role, synthetic cohort,
or permanent roster allowlist was created.

Production summary-only evidence:

- WordPress users scanned: 906;
- trusted/verified/active entitlements: 440;
- entitled non-admin students: 439;
- mapped entitled non-admin students: 0;
- StoryForge allowlisted WordPress identities: 2;
- PostgreSQL `sf_users`: 2;
- PostgreSQL stories: 6.

## Real affected-account reproduction

A real authenticated expected-positive identity, S04, has current course 3893
and trusted/verified/active entitlement. In Chrome:

1. `/member-dashboard/#storyforge` rendered the exact Bootstrap Demo and static
   sample content.
2. `/storyforge/` loaded the current shell, then truthfully denied access as
   `StoryForge is not enabled for this account.`

Screenshots:

- `evidence/B1-510H_affected_student_before_legacy.png`;
- `evidence/B1-510H_affected_student_before_direct_denial.png`.

The originally named `/mnt/data` screenshot was unavailable, so it was not
fabricated or claimed.

## Implemented candidate

1. `mmsf_access_state()` now lets only a native student continue beyond the
   pilot allowlist. The same trusted/verified/active entitlement check remains
   mandatory. Admins and mentors still require their existing exact gates.
2. The obsolete pilot cohort filter applies only to explicit pilot identities;
   it cannot replace canonical LearnDash access for ordinary students.
3. The existing Matrix launch adapter is enqueued in the document head.
4. An initial `#storyforge` hash is evaluated immediately, before DOM readiness,
   while click and hashchange behavior retain the same same-origin target.
5. The Critical Systems manifest was reconciled only to the already accepted
   B1-510 live bytes and release metadata.

No current StoryForge product byte changed.

## Why the candidate was not deployed

The WordPress bridge requires `_missionmed_storyforge_user_id`. PostgreSQL RLS
also requires the same UUID and WordPress ID in one eligible `sf_users` row.
All 439 eligible non-admin students lack both sides of that mapping. A redirect
without population would merely change the failure from legacy UI to
`storyforge_identity_unmapped`.

The architecture says WordPress identity/eligibility is synchronized into
StoryForge, but no current repository or production component performs that
population. Inventing JIT provisioning would add a new authentication/data
mechanism; a one-time 439-row sync would require explicit backup, reconciliation,
and future-enrollment rules. Neither choice was silently made.

Additionally, only 8 of the 11 exact supplied roster identifiers resolve. S03,
S06, and S10 require Founder confirmation. The other eight are all current,
trusted, active, and unmapped.

## Changed files

- `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`;
- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`;
- `wp-content/plugins/missionmed-storyforge-sso/assets/matrix-launch.js`;
- `storyforge-v5/tests/unit/student-routing-hotfix.test.mjs`;
- this required ignored evidence/handoff package.

No Matrix protected source was changed.

## Tests and gates

- focused routing: 3/3;
- unit: 227/227;
- browser E2E: 59/59;
- conformance/accessibility: 72/72;
- PostgreSQL runtime/RLS: 12/12;
- acceptance: 130/130;
- PostgreSQL authorization and B1-503 conformance matrices: PASS;
- PHP/JS syntax: PASS;
- API-only build: PASS;
- deterministic provenance: PASS;
- secret scan: PASS;
- npm audit: zero vulnerabilities;
- Matrix protected guard: PASS with approved/local/origin/public equality;
- Critical Systems enforced: 112 PASS, 2 WARN, 0 FAIL;
- Railway last-hour HTTP 5xx: zero;
- Railway last-hour application error logs: zero;
- diff check: PASS.

The Docker-backed WordPress integration runner remains unavailable because its
configured local container socket is absent; prior steering prohibits further
container-runtime troubleshooting. It is reported as unavailable, not passed.

## Voice and data safety

Voice scope remains the existing separate Founder-only capability. No feature
flag, provider, R2, recording, transcription, audio, reconciliation, schema,
RLS, story, or student-content change occurred. No production user metadata or
database row was written.

## External decisions/actions required

1. Founder supplies the correct existing identifiers for S03, S06, and S10.
2. Binding authority selects the durable population mechanism:
   - authorize a repeatable, backup-bound synchronization of current eligible
     WordPress identities into existing UUID metadata and `sf_users`, including
     the future-enrollment cadence; or
   - authorize a narrowly designed JIT provisioning path and its security tests.
3. Create fresh Kinsta/plugin/meta and PostgreSQL 18 backup/restore receipts.
4. Run a no-PII dry-run reconciliation and require zero mapping conflicts.
5. Apply exact mappings, deploy only the two SSO files, purge only evidenced
   StoryForge/Matrix caches, and execute the full live identity/path matrix.

## Deployment and rollback status

- B1-510H deployment: none;
- cache actions: none;
- production writes: none;
- rollback execution: none required;
- B1-510 recovery baseline remains intact;
- local implementation is committed and the tracked worktree is clean before
  this ignored handoff package is force-added.
