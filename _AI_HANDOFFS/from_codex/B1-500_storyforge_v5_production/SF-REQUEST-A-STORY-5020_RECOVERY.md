# SF-REQUEST-A-STORY-5020 — Request-a-Story Delivery Recovery

## 1. RESULT

**DEPLOYED — FULLY VERIFIED**

The universal Request-a-Story delivery repair is live. Completed guest text or voice submissions now hydrate one private student-library story and one recipient notification atomically. The guest receives a server-confirmed popup and durable receipt, can download the retained local audio and a Word-compatible transcript, and the resulting story carries a contributor/relationship designation.

Raghav Gupta's earlier recording cannot be recovered: production contains no uploaded audio segment, byte, transcript, audio asset, or completed contribution from that attempt. Nothing was fabricated. Ten existing unexpired Raghav invitations remain available; his mother must record again through her existing link to create the story.

## 2. Incident evidence and root cause

Read-only production evidence showed Raghav's parent/sibling invitations were delivered, opened, and started, but all four guest voice sessions ended cancelled with zero segments and zero bytes. Railway saw status/open/cancel traffic but no segment, finish, or contribution request.

The defect had five parts:

1. The browser added multipart field `mimeType`, but the WordPress gateway accepted only `seq`, `durationMs`, and file `segment`; segment POSTs were rejected before Railway.
2. Guest status polling shared the mutation rate-limit bucket and could starve recording requests with HTTP 429.
3. A completed contribution created only a candidate; it did not atomically hydrate a library story or recipient notification.
4. Story projection dropped contribution origin metadata, preventing a family/friend designation.
5. The guest had no server-confirmed receipt or trustworthy local download safeguards.

## 3. Final fix

### Database transaction

`storyforge-v5/infra/postgres/migrations/20260912190000_sf_request_story_delivery_hydration.sql`

- Adds private `public.sf_guest_hydrate_contribution(uuid)`.
- Both completed text and voice contribution functions invoke it in the same transaction.
- Creates exactly one private story, original, revision, and `guest_contributor` authored segment.
- Marks the contribution promoted and creates exactly one `request.story_received` notification.
- Records contribution id, relationship, and contributor first name in story origin.
- Makes retries idempotent, returning the same story and notification.
- Rechecks student eligibility plus request/guest feature flags.
- Direct helper execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `storyforge_app`.
- Changes no table, RLS policy, table grant, identity, role, or enrollment row.

### API and browser

- Removes the rejected guest multipart field.
- Keeps original browser audio chunks for the contributor's local download.
- Separates read-only status polling from mutation rate limits.
- Preserves contribution origin in story projection.
- Requires a promoted contribution plus `storyId` and `notificationId` before reporting success.
- Correctly unwraps the API's `{ contribution: ... }` response.
- Shows modal confirmation: “Story saved and [student] notified.”
- Shows a persistent “Your story is safe with [student]” receipt.
- Offers original-audio and Word-compatible `.doc` transcript downloads.
- Shows `◆ From [name] · [relationship]` in the student's library.

## 4. Local/disposable verification

All final gates passed on sealed implementation commit `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`:

- `git diff --check`: PASS
- touched JavaScript syntax: PASS
- touched shell syntax: PASS
- `npm test`: **507/507 PASS**
- focused delivery/RLS tests: **2/2 PASS**
- full PostgreSQL 18.4 primary suite: **39/39 PASS**
- reconciliation/survival suite: **140/140 PASS**
- targeted Request-a-Story Playwright: **5/5 PASS**
- full Playwright/e2e: **98/98 PASS**
- disposable WordPress integration: **8/8 PASS**
- full product conformance: **72/72 PASS**
- release build/provenance: PASS
- secret scan: PASS

The end-to-end test proves guest submission → server receipt → confirmation popup → Word transcript download → student notification → hydrated private story → contributor badge. A story owned by another student remains unavailable.

Final integration receipt:

`storyforge-v5/.local/integration-evidence/run.9a31cd26b849c02917d2beb9209dce8d3d7d53ae.01295dd6-5b20-46f2-9c8c-638987ecf90b/RUN_STATUS.json`

## 5. Git and artifact identity

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-REQUEST-A-STORY-5020`
- Branch: `codex/sf-request-a-story-hydration-5020`
- Sealed implementation commit: `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`
- Release id: `v-d6991f3e6724a47a`
- app alias/SHA: `05a518020aa4` / `05a518020aa43bf79798dc596bc2cef0722bced81489e3d692fa9c05766ed6c7`
- styles alias/SHA: `4e355c213eac` / `4e355c213eacfae803f7636a8542e16a486b346530d236dccad8fe06657d6448`
- auth unchanged: `d2cfc4e447d2`
- logo unchanged: `f091d62ac584`
- migration SHA: `957a9bfcd7240eed95e81eaa409ba35c3fa9eb5a4b0cb7f18e5ca731a62b40a2`
- `server/app.mjs` SHA: `f4fb115bdae19bbfef6ab3ae9e445c243c79ef4975f163845d3fcacfc6c8aca6`
- `server/guest-voice.mjs` SHA: `e010a18d34daab2e1d6730e5f1815843a3d5b311e70d320a6884f79101ac29df`
- WordPress route SHA: `c2506b5b0ae16fdf140ea6d834e6a45085ff3af5313ac7fb84f672d62d64dc33`
- WordPress release SHA: `a5d91cb1fa7927ed1a85298aa285759f91bdca0c9d4ce935efe144a12f50e7e8`

## 6. Production predecessors and recovery

### Local private recovery

Root: `/Users/brianb/MissionMed_recovery/SF-REQUEST-A-STORY-5020.kljpF51z`

- PostgreSQL 18 custom dump: `storyforge-production-before.dump`
  - SHA `acfc092679a86ef17472c216bfbb23f2ebab757a6df704947f27ac3eac17560d`
  - 1,654,396 bytes; `brianb:staff`; mode `0600`
  - `pg_restore --list`: PASS
  - full disposable restore: PASS with 441 users, 132 stories, and 33 ledger rows
- predecessor functions: `predecessor-functions.sql`
  - SHA `6a1d6d90dc53436f6c0b8ecdd155d994ec0f6ea9357bbd34e14eb09e2b773f8b`
  - 7,347 bytes; mode `0600`
- API predecessor archive: `api-predecessor-4c1978d.tar.gz`
  - SHA `78ece70c052f94a269cf3d734c09bfd17fb73a3d5bb08ff588489a81b63b25d4`
- candidate archive: `api-candidate-9a31cd2.tar.gz`
  - SHA `9424adce948c07aba283e5e89f161a1ee95fca665ae6e99df404f58ee33bcd0e`

### Kinsta private recovery

Root: `/www/theresidencyacademy_209/private/sf-request-a-story-5020/20260912TLpBnI3Z`

- prior current target: `releases/f0f858f8d656683460126399923736882fe4b89e`
- prior route SHA: `6360677dbe2ed21eeb6d9b4fb6caab69c60b65e096c6bf60705965fa973a401f`
- prior release SHA: `a1f7b030b3496212c270d9b7e4a33e141337fa4a2468499f4bbf65b2c0fb42f1`
- rollback route: `rollback-pre-cutover/prior-route.php`
- owner/group: `theresidencyacademy:www-data`
- original route/release mode: `0444`

Rollback restores the predecessor API archive and provenance variable, restores both captured predecessor database functions under an advisory-locked transaction while deleting only ledger `20260912190000`, and atomically returns the Kinsta route/current pointer to the recorded predecessor.

## 7. Deployment

Deployment order was **database → API → WordPress release**. Each layer is backward-compatible with its predecessor, preserving student access throughout.

### PostgreSQL

- Railway project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- environment: `bcef8734-e42b-44df-8488-c2a3de68213f`
- service: `a4a66362-c3ba-475a-ae21-2aa46624bafe`
- PostgreSQL: 18.6 over TLS
- system identifier: `7667256745042145332`
- applied in one transaction under the migration's advisory lock
- ledger version: `20260912190000`
- backup id: `96a08c27-3c26-46f7-8033-c3e73fc80f26`
- exact migration SHA and commit verified after apply
- data/policy counts remained 441 users, 132 stories, 0 contributions, 2 notifications, 75 policies

### Railway API

- service: `storyforge-v5-api` (`dab015bf-15ef-4698-9f16-cbf8cf23de7a`)
- predecessor deployment: `f8c48798-6b35-46bb-806d-0e2a166ef277`
- deployed from the exact archived `storyforge-v5` tree at commit `9a31cd2...`
- deployment: `bea02e9f-88de-41b9-adc0-026b691d99d8`
- status: `SUCCESS`
- created: `2026-09-12T23:38:03.002Z`
- image: `sha256:4a73607f4347bd370a02524ebd8ab6d2998232924c011332eda73f9eb39e10e6`
- live provenance variable: `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`

### Kinsta WordPress release

- site root: `/www/theresidencyacademy_209/public`
- exact immutable release published under commit `9a31cd2...`
- current pointer: `releases/9a31cd26b849c02917d2beb9209dce8d3d7d53ae`
- route and pointer replaced atomically from pre-verified hidden siblings
- route/release hashes and `0444` metadata verified immediately
- PHP syntax: PASS
- no global cache purge was performed
- SSO plugin remained byte-identical at `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7`

## 8. Production acceptance

| Gate | Result |
|---|---|
| `/storyforge/` | PASS — HTTP 200; exact new aliases |
| public and direct `/healthz` | PASS — HTTP 200, no-store |
| Raghav legitimate 360 session | PASS — HTTP 200, same WordPress identity, role student |
| canonical administrator session | PASS — HTTP 200, same identity, role admin, WordPress-admin authority, no student cohort |
| ordinary non-360 | PASS DENY — `eligibility_required` |
| anonymous | PASS DENY — HTTP 401 |
| invalid token | PASS DENY — HTTP 401 |
| cross-student private story | PASS DENY — HTTP 404, no private content |
| live Request-a-Story browser screen | PASS — authenticated page loaded with invitation workflow |
| live app bytes | PASS — exact `05a518020aa4...` hash and 656,126 bytes |
| receipt/download/badge strings in live asset | PASS |
| API HTTP 5xx since deploy | PASS — zero |
| API exception/fatal/panic scan | PASS — zero |
| Kinsta StoryForge fatal/parse/uncaught scan | PASS — zero |

Raghav still has ten active unexpired invitation links and zero completed contributions. No test story or notification was fabricated in his account.

## 9. Matrix scoped drift proof

Brian supplied the exact guard-required authorization for ticket `SF-REQUEST-A-STORY-5020` and the six named keys. The supported command used before and after deployment was:

```text
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-REQUEST-A-STORY-5020 \
  --assets student_os_js,student_os_css,class_mmed_student_os_php,calendar_v4_js,calendar_v4_css,storyforge_js \
  --verify-public --brian-approved
```

It exited 0 and printed `Override accepted by --brian-approved` both times.

Exact pre/post origin/public hashes were byte-identical:

- `student_os_js`: `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a`
- `student_os_css`: `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`
- `class_mmed_student_os_php`: `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d`
- `calendar_v4_js`: `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480`
- `calendar_v4_css`: `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e`
- `storyforge_js`: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`

No seventh drift appeared. The other protected assets remained lock-exact:

- scheduler: `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578`
- File Vault JS: `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd`
- File Vault CSS: `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990`
- StoryForge Matrix CSS: `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`

No `missionmed-hub` source, Matrix runtime, manifest, guard, or lock was modified, staged, copied, restored, refreshed, or deployed.

## 10. Rollback and final production state

Rollback invoked: **NO**. No rollback condition occurred.

Production is live on:

- database ledger `20260912190000`, exact migration SHA `957a9bfc...`;
- Railway deployment `bea02e9f-88de-41b9-adc0-026b691d99d8`, image `sha256:4a73607f...`;
- Kinsta current release `9a31cd26b849c02917d2beb9209dce8d3d7d53ae`;
- app alias `05a518020aa4` and styles alias `4e355c213eac`;
- unchanged WordPress SSO and unchanged Matrix protected runtime.

## 11. Residual uncertainty / required human action

The repaired path is proven by the complete PostgreSQL, WordPress, Playwright, and browser acceptance stack. A real production guest submission was deliberately not manufactured in Raghav's account. His mother must retry through her existing active link. Upon completion she should see the confirmation popup and downloads; Raghav should receive a notification and a private library story marked with her name/relationship.
