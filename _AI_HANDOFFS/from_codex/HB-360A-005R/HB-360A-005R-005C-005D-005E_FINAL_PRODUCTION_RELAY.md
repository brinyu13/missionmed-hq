# HB-360A Final Parallel Execution Relay

**RESULT:** FOUNDER REVIEW REQUIRED  
**PRODUCTION:** NOT DEPLOYED  
**FOUNDER APPROVAL:** PENDING  
**Evidence date:** 2026-09-06 (America/New_York)

## Executive verdict

- HB-360A-005C is a real, fixture-only, actual-Claude implementation ready for Founder visual review. It is isolated, clean, unpushed, and does not use production data or provider APIs.
- HB-360A-005R was revalidated. Authority, direct CIE boundary, growth, release-liquidity, HQ anonymous media-proxy containment, and public-GitHub MMVS containment are closed.
- Core production gates remain open: `G-RT`, `G-MMVS`, `G-HB-ID`, `G-WEBEX`, and `G-CF`.
- HB-360A-005D has not started. HB-360A-005E has not deployed. There are no 005D migrations/flags and no 005E release IDs/live URLs/persona tests to claim.
- This relay does not promote partial evidence to completion. No production release is authorized before Founder approval and the open gates are independently closed.

## Authority and custody

- Canonical MissionMed OS authority commit: `83113bff53400a757decf24dc37099333e80c662` on `origin/main`.
- Decision records:
  - `decisions/DR-196_hb_360a_final_parallel_005c_and_005r_execution_authority.md`
  - `decisions/DR-197_hb_360a_final_bounded_mr_079_execution_amendment.md`
- Authority receipt: `handoffs/from_codex/HB_360A_FINAL_AUTHORITY_REGISTRATION/HB_360A_FINAL_AUTHORITY_REGISTRATION_RECEIPT.md`.
- Founder execution prompt SHA-256: `d626905093b6c02e990082f0047aa739afd914343bdfd551d3a804c29bae7282`.
- Registration Lease V2: request `e5d0e0d5-cca2-430e-8b8d-979b01bc46f5`, lease `96efe29c-1a4b-4fa8-92ad-dacb65b358d0`, fencing epoch `1332`, released successfully.
- Final relay path Lease V2: lease `23fd038b-32e2-483b-ab4a-8357a1f240a4`, fencing epoch `1339`; release and provider-clear readback are recorded after the commit/push transaction.
- Universal BOOT, `HB-360A-005R-X`, and `HB-360A-005C` routes passed against HQ tip `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- `tools/lint_os.py` passed with pre-existing warnings only. Remote readback matched all eight registered OS artifacts.

## HB-360A-005C — actual Claude fixture prototype

### Custody

- Worktree: `/Users/brianb/MissionMed_worktrees/hb-360a-005c-prototype`
- Branch: `claude/hb-360a-005c-prototype`
- Base: `e71b3902f40e82e4d27813cc54aa836bc13d2c35`
- Local head: `b8030990b8916634e78a05d76251af278d79c9b4`
- Commits ahead of `origin/main`, not pushed:
  - `1823976` — core interactive prototype
  - `a772450` — 112 screenshots and verification harness
  - `b803099` — true-mobile viewport correction and evidence
- Working tree: clean.
- Actual Claude Code core session: `90ebfad6-4dd8-419d-84f2-88f11ef0836d`.
- Corrective Claude Code session: `caf81c89-8454-47d1-a9ce-c9469948e843`.

### Demo and artifact hashes

- Founder demo: `/Users/brianb/MissionMed_worktrees/hb-360a-005c-prototype/_AI_HANDOFFS/from_claude_code/HB-360A-005C/HB-360A-005C_PROTOTYPE.html`
- Source: `/Users/brianb/MissionMed_worktrees/hb-360a-005c-prototype/homebase-v1/prototypes/hb-360a-005c/index.html`
- Source and handoff are byte-identical; SHA-256: `e6658b4c702d1cee26bd17bd129207174e2bc685b879d18cd6558f038ca52791`.
- Screenshot index SHA-256: `2a4ff6647fb15534855d99864f7c3753493a5d8b93f1d9f5974efacc7515b2be`.
- Handoff package includes the prototype, notes, accessibility report, 005D addendum, README, screenshot index, and 112 PNGs.

### Fixture and QA coverage

The exact 13 fixtures are:

`admin_directives`, `admin_queue`, `admin_rx`, `admin_security`, `student_degraded`, `student_departed`, `student_group_visibility_modes`, `student_one_on_one`, `student_returning_10_days`, `student_single_session`, `student_step_up`, `student_transferred`, and `student_two_sessions`.

- JavaScript syntax: PASS.
- HTML identity/source-handoff parity: PASS.
- Exact fixture IDs: PASS.
- PNG inventory: 112 total; 56 desktop at `1440x900`, 56 mobile at `390x844`: PASS.
- External runtime URLs: none.
- Temporary root files: none.
- Scoped git-diff verification: PASS.
- Browser CLI defect found and rejected: `--window-size=390,844` reported a false mobile viewport with `innerWidth=500`.
- All 56 mobile images were regenerated with the bundled Playwright runtime and explicit `390x844`, device scale factor 1.
- Every mobile route read back `innerWidth=390`, root `clientWidth=390`, root/body `scrollWidth=390`, selector right edge `390`, and no selector/heading intersection: 56/56 PASS.
- Pixel-level top-label check across all 56 mobile PNGs: PASS.
- Representative visual review passed for S01, S05 own-segments, S11 player, AD10 Rx, AD12 directives, and AD17 providers. Group segments stack cleanly and date fields wrap without clipping.
- Direct `file://` opening was blocked by browser security policy; no workaround was attempted. The local handoff is available for direct file review in Codex/Finder.

### 005C disposition

`FOUNDER REVIEW REQUIRED`. The prototype is not a live release and is not Founder-approved until Dr. Brian explicitly approves it.

## HB-360A-005R gate matrix

| Gate | State | Evidence-backed disposition |
|---|---|---|
| G-AUTH | CLOSED | DR-196/DR-197 registered and canonical remote readback matched. |
| G-CIE | CLOSED | Direct CIE boundary remains contained. |
| G-GROWTH | CLOSED | Prior bounded evidence remains valid. |
| G-RLIQ | CLOSED | Prior bounded evidence remains valid. |
| HQ anonymous media proxy | CLOSED | Anonymous proxy containment passed. |
| MMVS public GitHub exposure | CLOSED | Repository made private under lease; Git objects/content unchanged; anonymous GitHub reads now 404. |
| G-RT | OPEN | Matrix deployed-runtime lineage does not reconcile to current source. |
| G-MMVS | OPEN — HARD STOP | Runtime/source lineage mismatch, anonymous APIs/mutations, permissive credentialed CORS, and direct consumers remain. |
| G-HB-ID | OPEN | Identity ambiguity and unsafe enrollment-binding/data-function behavior remain. |
| G-WEBEX | OPEN | Full-admin Control Hub evidence and final app authorization/configuration are missing. |
| G-CF | OPEN | R2/Stream delivery lacks required access, origin, signing, watermark, worker, and webhook controls. |

## Open-gate evidence

### G-RT — Matrix runtime drift

- HQ main: `e71b390…`; source branch: `e467f2b…`.
- Matrix2 students JS source/origin SHA-256: `8f216228f56d44a46c64ff10aacdbfa9cb38420afaf96ee20ea7a1546a14e6ac`.
- Public CDN remains stale: `010bc9b86308f66161090e789dac918c2be05608dcc848a8efa513d0ccd27cf5` with year-long caching.
- Active shell asset `student-os.16ca42c53ca2e890.js` SHA begins `0b112c74`; the artifact is absent from source custody.
- Popup CSS is healthy at SHA beginning `4f78078e`.
- Manifest is stale at SHA beginning `ba2e065e`; immutable source begins `60e7169b`.
- Lowest-blast-radius route: reconcile from a clean source/runtime lineage or defer the Matrix host while Wave 2 flags remain off.

### G-MMVS — source/runtime/API security hard stop

- Railway project `7ea1f353-b877-42f9-b989-f60c7920c640`; service `0808dd8f-ee98-433f-9827-0ebcbfed9d70`; deployment `1b499811-9b7b-4cfb-b306-9ba59d7b9f81`.
- Running image begins `sha256:432ee`; deployment commit/branch/repository metadata are null.
- `app.py` SHA-256 lineages do not match: running `c8c49ea5…`, private Git `58233d661…`, ignored local `9882de6c…`, historical public `7b9864c0…`.
- Anonymous reads remain exposed: `/videos` `200`/313 records, `/api/drills` `200`/97 records, `/review/queue` `200`/3 records.
- Mutations are unauthenticated; credentialed CORS accepts arbitrary/null origins.
- Arena, Drills, and Daily call Railway directly. The WordPress proxy redirects to HTML/unauthenticated behavior.
- Current registry has 313 IDs; ID-set hash begins `e483019b`. Ten live-only IDs must be preserved during reconciliation.
- Making GitHub private contained one exposure only; it did not close G-MMVS.

### G-HB-ID — identity ambiguity

- Railway project `d69472c4-3a6e-4484-ac0e-bab1e29a88b3`; environment `f2eb9399-ea91-42d0-9024-77d402523f69`; service `bd7921ee-7ee5-4a82-84e7-c6dfa0892c5e`; deployment `0121f6df-2070-48be-96f9-1c448c6d2178` succeeded.
- Deployed source reports branch beginning `e869`, pinned revision beginning `112921f`; `/healthz` is too minimal to prove exact release identity.
- Live counts observed: 1 active session, 12 enrollments, 3 bound.
- Blockers: non-unique WordPress identities, unscoped `LIMIT 1`, email/username auto-bind behavior, public `SECURITY DEFINER` function `hb_own_enrollment_ids`, and no durable JTI/release/migration ledger.

### G-WEBEX — provider authority/configuration

- Webex Meetings and Developer portal sessions are authenticated; Control Hub is not authenticated.
- `MissionMed Matrix Integration` has broad `spark:all`, recording, and transcript capabilities, but required webhook scopes are absent.
- `Guest Token Source` is approved only as a guest issuer. `Guest Access` is submitted and not approved.
- Personal meeting defaults: 4 upcoming meetings; AI/transcripts/chapters on; automatic recording off; automatic sharing off.
- Required human action: a Webex Full Administrator must sign into `admin.webex.com` with MFA, verify Control Hub configuration, and—only if the selected design requires it—authorize and save the service app.

### G-CF — Cloudflare/R2/Stream protection

- R2 bucket `missionmed-videos`: approximately 1.38k objects / 30.04 GB.
- `cdn.missionmedinstitute.com` is public and active with TLS 1.3; `r2.dev` is off; CORS permits wildcard GET/HEAD. No access lock or durable request-log evidence was found.
- Stream: 40 videos total, 37 ready; 1/40 signed, 0/40 origin-restricted, no watermarks, and no signing keys.
- No CDN Access application, media Worker, or Stream webhook was found.

## MMVS public-GitHub containment — completed bounded repair

- Repository: `brinyu13/missionmed-mmvs`, database ID `1197817111`, GraphQL ID `R_kgDOR2U9Fw`.
- The only provider change was visibility `public` to `private`.
- Provider mutation occurred under Lease V2 `dd56d1f2-201f-477f-9905-6c6d28a3e37c`, epoch `1335`, during `2026-09-06T03:29:38.782562Z`–`03:30:08.782562Z`.
- Main head remained `6d71c7dfe3a0047d75c28caa1fe9228f921d7ce0`.
- Git blobs remained identical: `app.py` `263e92e13c1228f2538a8981e55611de9d246784` (4370 B); registry `fd9825046847ce14eb5bbcfc77696c319ec89eee` (571934 B).
- Content SHA-256 remained identical: app `7b9864c094be22bf87e5229bc35db8dcfc3eb0eb3715c898d7f385061e371806`; registry `44f7a5b92d1e4ea6fafd88fb45a2660c8334f4cb57a121020ba881ce0fd7a99c`.
- Anonymous GitHub REST/raw reads return `404`; Railway `/health`, `/videos`, and `/api/drills` remain `200`.
- Evidence: `_AI_HANDOFFS/from_codex/HB-360A-005R/HB-360A-005R_MMVS_PUBLIC_GITHUB_CONTAINMENT.md`, committed/pushed as `ec6a890c55b2dd2e00de8b483049204ff9b3ec2d`.
- Do not roll back to public. Public visibility is unsafe; any replacement must be a separately authorized secure delivery path.

## HB-360A-005D status

- NOT STARTED.
- No 005D implementation commits, schema migrations, provider changes, or feature flags exist.
- Entry requires explicit Founder approval of 005C and closure of the production gates applicable to the selected implementation.

## HB-360A-005E status

- NOT DEPLOYED.
- No 005E release/deployment IDs, live URLs, enabled feature flags, or authenticated persona-test results exist.
- Rollback remains feature-off/no-production-change because no 005E release was made.

## Rollback and deferments

- 005C is isolated to its local worktree and branch; rollback is deletion/abandonment of that isolated branch only after preserving any requested evidence.
- The MMVS GitHub containment should not be reversed to public.
- Matrix, MMVS, HomeBase identity, Webex, and Cloudflare repairs require their own exact-scoped leases, backups, provider-native readbacks, regressions, and evidence. They remain deferred—not waived.
- Expired, unreleased historical lease rows are inactive; final coordination readback must show zero active leases and zero active waiters.

## Exact next actions

1. Dr. Brian reviews the local 005C demo and either approves it or returns exact corrections.
2. After approval, close `G-RT`, `G-MMVS`, `G-HB-ID`, `G-WEBEX`, and `G-CF` with separately fenced, lowest-blast-radius repairs.
3. Obtain the required Webex Full Admin/MFA witness for Control Hub.
4. Implement 005D only after its entry gates are green; record commits, migrations, flags, and regression evidence.
5. Stage 005E only after 005D validation; record release IDs, live URLs, authenticated persona tests, security results, and rollback proof.

## Founder decision terminal

RESULT: FOUNDER REVIEW REQUIRED  
DEMO: /Users/brianb/MissionMed_worktrees/hb-360a-005c-prototype/_AI_HANDOFFS/from_claude_code/HB-360A-005C/HB-360A-005C_PROTOTYPE.html  
DR BRIAN ACTION: APPROVE 005C or REJECT 005C: [corrections]
