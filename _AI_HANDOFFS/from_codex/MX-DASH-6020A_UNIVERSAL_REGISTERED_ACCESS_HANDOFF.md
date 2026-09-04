# MX-DASH-6020A Universal Registered Access Handoff

## Final state

- Result: COMPLETE
- Production: LIVE at `https://missionmedinstitute.com/member-dashboard/`
- Released: 2026-09-04 UTC
- Source commit: `ffb44cb55fbc6a6c88a200d626fdc3f43f49a881`
- Runtime-lock commit: `4ba9ee1d05bb7db4a04a97691d5564d7c78a4860`
- Rollback: `/www/theresidencyacademy_209/private/mx-dash-6020a-rollback-20260904T185414Z`

Matrix Dashboard 2.0 is now the authenticated front door for every registered
MissionMed user. Dashboard discovery and app authorization are separate. The
server resolves every app decision, the client renders that decision, and
premium direct routes and REST requests re-check the same server policy.

## Mission and authority

- Mission: `MX-DASH-6020A`
- Canonical authority: `DR-183` and bounded execution amendment `DR-184`
- Canonical MissionMed OS commit: `a282fc6e984a6417091bffcfc97cc2eed1db071a`
- Authority registration receipt:
  `handoffs/from_codex/MX_DASH_6020A_AUTHORITY_REGISTRATION/MX_DASH_6020A_AUTHORITY_REGISTRATION_RECEIPT.md`
- Universal BOOT and ticket BOOT: PASS at MissionMed OS HQ
  `569e63de284fe086a0da588333f7b96ac72a2409`
- Registrar/lease tests: 55/55 PASS. The OS lint retained the same five
  pre-existing missing-host-path findings as canonical baseline and added none.

## Source custody

- Product worktree:
  `/Users/brianb/MissionMed_worktrees/MX-DASH-6010B-webgl-morph`
- Product branch: `codex/mx-dash-6010b-locked-art-webgl-morph`
- Product commit: `ffb44cb55fbc6a6c88a200d626fdc3f43f49a881`
- Runtime-lock branch: `codex/mx-dash-6020a-runtime-lock`
- Runtime-lock commit: `4ba9ee1d05bb7db4a04a97691d5564d7c78a4860`
- Both branches were pushed normally; no force push, reset, clean, stash,
  rebase, or unrelated worktree overwrite occurred.
- Pre-existing modified 6010B handoff and untracked 6010B rollback directory
  were preserved and excluded from both commits.

## Canonical entitlement sources

The production audit verified these existing WordPress/LearnDash sources:

- `mmed_course_360elite` -> LearnDash course `3893` (Mission Residency 360)
- `mmed_course_complete` -> LearnDash course `3646` (IV Prep Complete)
- existing Matrix enrollment mappings: `3893`, `5227`, `3646`, `3848`
- direct and group/current LearnDash access via
  `learndash_user_get_enrolled_courses()` and `sfwd_lms_has_access()`
- per-user stronger grants in `_mmed_matrix_allowed_modules`
- trusted administrator capability `manage_options`
- the existing Dr J restricted-persona function and locked-route list as a
  deny overlay
- existing LOR explicit revocation metadata as a deny overlay

No new course, product, order, role, or subscription identifier was guessed.
The live installation had no saved Matrix enrolled-course/free-module option,
so its established defaults and verified mappings were preserved.

## Resolver and policy

`MMED_Access_Gate` is the single resolver. It emits browser-safe `visible`,
`allowed`, `released`, `reason`, `name`, and allowed-only `launch_url` fields.
Resolution order is:

1. anonymous denial and explicit restricted-persona/revocation denial;
2. administrator access;
3. verified 360 or IV Prep Complete full access to released apps;
4. existing per-user and enrolled-tier grants;
5. registered-user baseline;
6. visible but locked.

Registered baseline: Dashboard, My Profile, StoryForge, LOR Studio, Calendar,
My Appointments, and RISE, plus preserved account basics. The canonical live
LOR name is **LOR Studio**. Globally unreleased destinations such as Med
Messenger, Dr J Live Drills, Settings, and CAM remain unavailable.

Existing enrolled-tier grants for Scheduler, File Vault, Timeline, and Arena
remain intact. Per-user module grants remain intact. A real restricted 360
persona retained its higher-priority StoryForge denial, while a separate real
unrestricted 360 persona received all released applications.

## Persona matrix

| Persona | Dashboard 2.0 | Baseline | Other released apps | Evidence |
|---|---:|---:|---:|---|
| Real admin | PASS | PASS | Existing admin/full behavior | production resolver + live browser |
| Real unrestricted 360 | PASS | PASS | PASS, full | production resolver |
| IV Prep Complete | PASS | PASS | PASS, full | deterministic authenticated course-3646 fixture; no suitable live account existed |
| Real registered non-enrolled | PASS | PASS | Visible/locked | production resolver + authenticated HTTP guard |
| Existing partial paid | PASS | PASS | Existing stronger grants only | deterministic authenticated course-5227 fixture; no suitable non-admin live account existed |
| Anonymous | DENIED | DENIED | DENIED | live HTTP 302 to login |

The real registered non-enrolled production persona received StoryForge, LOR
Studio, Calendar, My Appointments, RISE, Dashboard, and Profile. HomeBase,
Scheduler, IV Prep On-Call, RankList IQ, Arena, and File Vault resolved locked.
The LOR server contract admitted that persona while preserving explicit LOR
revocation as the higher-priority denial.

## Locked-state UX and security

- Featured and catalog destinations remain discoverable.
- Locked cards receive a visible text/icon badge, semantic locked state,
  explanatory detail panel, and disabled Locked CTA.
- Launcher matches remain visible and explain the lock without navigating.
- Left-rail destinations use the server decision; globally coming items remain
  locked.
- Client state cannot grant server access.
- Real registered non-enrolled direct `/rank-list-engine/` request: HTTP 403
  with `X-MissionMed-Matrix-Access: entitlement-denied`.
- Real registered non-enrolled `/wp-json/rlq/v1/load` request with valid
  WordPress cookie and nonce: HTTP 403,
  `mmed_matrix_entitlement_required`.
- The short-lived QA auth session token was destroyed immediately after each
  request and was never printed or written to a file.

## RankList credential remediation

- The production inline Supabase service-role fallback was removed.
- Its value never left the production process and never entered logs, source,
  tests, screenshots, commits, handoffs, or chat.
- It was migrated in place to a versioned sodium secretbox ciphertext stored
  as a non-autoloaded WordPress option and rooted in the existing WordPress
  authentication secret.
- Provider environment loading remains the first-choice loader; encrypted
  backend storage is the server-only fallback.
- Source scan found no credential-shaped token.
- Secure loader readback: PASS.
- RankList public health: HTTP 200 JSON PASS.
- RankList server-authenticated Supabase read: PASS.
- Rotation/revocation was intentionally deferred because an account-wide
  consumer inventory and a safe new secret-key creation/revocation operation
  were not available in this run. DR-183 explicitly allows secure-path
  migration first when consumer ownership is ambiguous.

## QA

- PHP syntax for every changed PHP file: PASS.
- JavaScript syntax: PASS.
- Entitlement contract: 51 assertions PASS.
- Browser policy contract: 15 assertions PASS.
- MX-DASH-6010B regression suite: 22/22 PASS.
- All eight pencil-to-cinematic WebGL morphs: PASS, six distinct progress
  frames each, WebGL2, one maximum context, matched create/dispose counts.
- Keyboard focus morph: PASS.
- Reduced motion and WebGL fallback: PASS.
- Admin-only editor: PASS.
- Classic fallback: PASS.
- Locked-state mobile fixture at exact 390x844: width 390, document width 390,
  eight cards, four locked badges/cards, explanatory detail, disabled CTA,
  no illegal navigation, keyboard morph PASS.
- Live Chrome at exact 390x844: viewport 390, document width 390, eight cards,
  eight morphs, no horizontal overflow.
- Live server-rendered payload contains access/apps state; live page loads
  `student-os.38507e1ac8a555ba.js` and
  `mmed-dashboard-v2.6010b-students.js`.

## Production hashes

```text
e5a2625c8722650f01eba69ba6e9cf3647286e307e1e95c0c4bbca1a80a7f6d1  missionmed-lor-studio-contract.php
67b264386046379f25d556fbe314f9c921d8449099fea94ba6b27842ee7d3be7  missionmed-matrix-entitlement-guard.php
ab87e7272aebdf44f82e640f2d0f7f08111caae67f339c874e9ab85eedf08721  missionmed-matrix-lor-studio-entry.php
cf2251762f7e88357467a9225eae27e19fe67d7ad44311faecce63b506344a0e  missionmed-matrix-runtime-pin.php
3e9e3eedc7b703d63f814544b48ec2c0d0eefa589b28e0cf72d1af6a33c88ab9  missionmed-rise-sso.php
c76fff0117ceac00e587fcdb0b8f77019b5bbfb782923738e087aeb9c089a14f  missionmed-rlq-bff.php
8f216228f56d44a46c64ff10aacdbfa9cb38420afaf96ee20ea7a1546a14e6ac  mmed-dashboard-v2.6010b-students.js
c6638f7d210f751db2927d8916dcef5e107ea185fc6429df989627f13fef8919  mmed-dashboard-v2.6010b-true-morph.css
38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a  student-os.38507e1ac8a555ba.js
38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a  student-os.js
222f24843c3a67a660a6353ee1621529f5b786a651eeb8003baebf103aae40af  class-mmed-access-gate.php
```

Origin and public cache-busted Student OS hashes both equal the approved
`38507e1...` value.

## Runtime lock, rollback, and closeout

- Updated only `student_os_js` in the runtime-lock manifest.
- Updated-lock guard preflight: approved/local/origin/public all
  `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a`.
- Previous active immutable runtime rollback:
  `student-os.373a4be9d77ebaf4.js`, SHA-256
  `373a4be9d77ebaf4e8c55f664ffc481d300d24d0e78bf30e5aff94b993caac98`.
- Production rollback package permissions are private (`0700`), with nine
  exact preimages and two exact absent-before markers. Preimage hash readback
  for RankList, runtime pin, Student OS, and access gate passed.
- WordPress emitted known early text-domain debug notices during WP-CLI QA;
  they did not affect request status, syntax, entitlement, or application
  results.
- All task leases were released or naturally expired; final provider-native
  active-lease and waiter readback is recorded at closeout.
